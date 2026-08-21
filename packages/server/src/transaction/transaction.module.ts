import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Transaction } from './transaction.entity'
import { TransactionLog } from './transaction-log.entity'
import { TxShareSettlement } from '../settlement/tx-share-settlement.entity'
import { TransactionService } from './transaction.service'
import { TransactionController } from './transaction.controller'
import { BookModule } from '../book/book.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, TransactionLog, TxShareSettlement]),
    BookModule,
  ],
  controllers: [TransactionController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}
