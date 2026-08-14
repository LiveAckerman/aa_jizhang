import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { UploadService } from './upload.service'

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * 上传头像
   * POST /api/upload/avatar
   */
  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('请选择文件')
    }

    // 验证文件类型
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('只支持 jpg、png、webp 格式的图片')
    }

    // 验证文件大小 (5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      throw new BadRequestException('图片大小不能超过 5MB')
    }

    // 上传到 Cloudflare R2
    const url = await this.uploadService.uploadToR2(file, 'avatar')

    return {
      code: 0,
      message: '上传成功',
      data: { url },
    }
  }

  /**
   * 上传通用图片（账单凭证 / 账本封面等）
   * POST /api/upload/image
   */
  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('请选择文件')
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif']
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('只支持 jpg、png、webp、gif 格式的图片')
    }

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      throw new BadRequestException('图片大小不能超过 10MB')
    }

    const url = await this.uploadService.uploadToR2(file, 'transaction')

    return {
      code: 0,
      message: '上传成功',
      data: { url },
    }
  }
}
