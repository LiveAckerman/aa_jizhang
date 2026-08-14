import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { StatsService } from './stats.service'
import { StatsController } from './stats.controller'
import { BookMember } from '../book/book-member.entity'
import { Transaction } from '../transaction/transaction.entity'

@Module({
  imports: [TypeOrmModule.forFeature([BookMember, Transaction])],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
