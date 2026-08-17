import { Module } from '@nestjs/common'
import { OcrController } from './ocr.controller'
import { OcrService } from './ocr.service'
import { UploadModule } from '../upload/upload.module'
import { TransactionModule } from '../transaction/transaction.module'

@Module({
  imports: [UploadModule, TransactionModule],
  controllers: [OcrController],
  providers: [OcrService],
  exports: [OcrService],
})
export class OcrModule {}
