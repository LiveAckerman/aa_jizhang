import { Module } from '@nestjs/common'
import { OcrController } from './ocr.controller'
import { OcrService } from './ocr.service'
import { UploadModule } from '../upload/upload.module'
import { TransactionModule } from '../transaction/transaction.module'
import { BookModule } from '../book/book.module'

@Module({
  imports: [UploadModule, TransactionModule, BookModule],
  controllers: [OcrController],
  providers: [OcrService],
  exports: [OcrService],
})
export class OcrModule {}
