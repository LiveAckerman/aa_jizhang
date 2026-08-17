import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  Body,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { OcrService } from './ocr.service'
import { BatchCreateFromOcrDto } from './dto/batch-create-from-ocr.dto'
import { TransactionService } from '../transaction/transaction.service'
import { BookService } from '../book/book.service'

@Controller('ocr')
@UseGuards(JwtAuthGuard)
export class OcrController {
  constructor(
    private readonly ocrService: OcrService,
    private readonly transactionService: TransactionService,
    private readonly bookService: BookService,
  ) {}

  /**
   * 识别支付截图
   * POST /api/ocr/recognize-receipt
   */
  @Post('recognize-receipt')
  @UseInterceptors(FileInterceptor('file'))
  async recognizeReceipt(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('请上传图片')
    }

    // 验证文件类型
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('只支持 jpg、png、webp 格式')
    }

    // 验证文件大小
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('图片不能超过 10MB')
    }

    const data = await this.ocrService.recognizeReceipt(file)

    return {
      code: 0,
      message: '识别成功',
      data,
    }
  }

  /**
   * 批量创建交易记录（从OCR结果）
   * POST /api/ocr/batch-create-transactions
   */
  @Post('batch-create-transactions')
  async batchCreateTransactions(
    @CurrentUser('sub') userId: string,
    @Body() dto: BatchCreateFromOcrDto,
  ) {
    if (!dto.transactions || dto.transactions.length === 0) {
      throw new BadRequestException('交易列表不能为空')
    }

    const createdTransactions: any[] = []
    const errors: string[] = []
    // 缓存每个账本的成员参与人，避免重复查询
    const participantCache: Record<string, string[]> = {}

    for (const txDto of dto.transactions) {
      try {
        const type = txDto.type || 'shared'
        let participantIds: string[] = []

        // 共享账平均分摊：默认全体成员参与
        if (type === 'shared') {
          if (!participantCache[txDto.bookId]) {
            const members = await this.bookService.listMemberIds(txDto.bookId)
            participantCache[txDto.bookId] = members
          }
          participantIds = participantCache[txDto.bookId]
        }

        const transaction = await this.transactionService.create(userId, {
          bookId: txDto.bookId,
          type,
          amount: txDto.amount,
          category: txDto.category,
          note: txDto.note,
          spentAt: txDto.spentAt,
          payerId: userId, // OCR识别默认付款人为当前用户
          splitMethod: 'average', // 默认平均分摊
          participantIds,
        })
        createdTransactions.push(transaction)
      } catch (error: any) {
        const msg = error?.message || '未知错误'
        errors.push(msg)
        console.error(`创建交易失败: ${msg}`)
      }
    }

    // 全部失败时抛错，让前端感知（避免"提示成功但实际0条"）
    if (createdTransactions.length === 0) {
      throw new BadRequestException(
        `创建失败：${errors[0] || '请检查账本和金额'}`,
      )
    }

    return {
      code: 0,
      message: `成功创建 ${createdTransactions.length} 条记录`,
      data: {
        count: createdTransactions.length,
        failed: errors.length,
        transactions: createdTransactions,
      },
    }
  }
}
