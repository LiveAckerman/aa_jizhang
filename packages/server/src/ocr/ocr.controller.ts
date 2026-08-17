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

@Controller('ocr')
@UseGuards(JwtAuthGuard)
export class OcrController {
  constructor(
    private readonly ocrService: OcrService,
    private readonly transactionService: TransactionService,
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

    for (const txDto of dto.transactions) {
      try {
        const transaction = await this.transactionService.create(userId, {
          bookId: txDto.bookId,
          type: txDto.type || 'shared',
          amount: txDto.amount,
          category: txDto.category,
          note: txDto.note,
          spentAt: txDto.spentAt,
          payerId: userId, // OCR识别默认付款人为当前用户
          splitMethod: 'average', // 默认平均分摊
          participantIds: [], // 需要前端传递或后续选择
        })
        createdTransactions.push(transaction)
      } catch (error: any) {
        // 记录错误但继续处理其他记录
        console.error(`创建交易失败: ${error?.message || '未知错误'}`)
      }
    }

    return {
      code: 0,
      message: `成功创建 ${createdTransactions.length} 条记录`,
      data: {
        count: createdTransactions.length,
        transactions: createdTransactions,
      },
    }
  }
}
