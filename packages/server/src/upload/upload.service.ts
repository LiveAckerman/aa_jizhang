import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'

@Injectable()
export class UploadService {
  private s3Client: S3Client
  private bucketName: string
  private publicUrl: string

  constructor(private readonly configService: ConfigService) {
    // Cloudflare R2 配置
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID')
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID')
    const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY')
    this.bucketName = this.configService.get<string>('R2_BUCKET_NAME')
    this.publicUrl = this.configService.get<string>('R2_PUBLIC_URL')

    // 初始化 S3 客户端（R2 兼容 S3 API）
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    })
  }

  /**
   * 上传文件到 Cloudflare R2
   */
  async uploadToR2(
    file: Express.Multer.File,
    folder: string = 'uploads',
  ): Promise<string> {
    // 生成唯一文件名
    const ext = file.originalname.split('.').pop()
    const filename = `${folder}/${uuidv4()}.${ext}`

    // 上传到 R2
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: filename,
      Body: file.buffer,
      ContentType: file.mimetype,
    })

    await this.s3Client.send(command)

    // 返回公开访问 URL
    return `${this.publicUrl}/${filename}`
  }

  /**
   * 生成唯一文件名
   */
  generateFilename(originalName: string, folder: string = 'uploads'): string {
    const ext = originalName.split('.').pop()
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    return `${folder}/${timestamp}-${randomStr}.${ext}`
  }
}
