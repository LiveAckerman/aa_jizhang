import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ShareToken } from './share-token.entity'
import { ShareTokenService } from './share-token.service'
import { ShareSummaryController } from './share-summary.controller'
import { BookModule } from '../book/book.module'
import { TransactionModule } from '../transaction/transaction.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([ShareToken]),
    forwardRef(() => BookModule),
    forwardRef(() => TransactionModule),
  ],
  providers: [ShareTokenService],
  controllers: [ShareSummaryController],
  exports: [ShareTokenService],
})
export class ShareTokenModule {}
