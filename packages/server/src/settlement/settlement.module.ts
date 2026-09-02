import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Settlement } from './settlement.entity'
import { SettlementRound } from './settlement-round.entity'
import { TxShareSettlement } from './tx-share-settlement.entity'
import { Transaction } from '../transaction/transaction.entity'
import { SettlementService } from './settlement.service'
import { SettlementController } from './settlement.controller'
import { BookModule } from '../book/book.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Settlement,
      SettlementRound,
      TxShareSettlement,
      Transaction,
    ]),
    forwardRef(() => BookModule),
  ],
  providers: [SettlementService],
  controllers: [SettlementController],
  exports: [SettlementService],
})
export class SettlementModule {}
