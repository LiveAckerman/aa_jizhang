import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BookModule } from '../book/book.module'
import { TransactionModule } from '../transaction/transaction.module'
import { UserModule } from '../user/user.module'
import { AdminAuditLog } from './admin-audit-log.entity'
import { AdminController } from './admin.controller'
import { AdminApiGuard } from './admin-api.guard'
import { AdminService } from './admin.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminAuditLog]),
    UserModule,
    BookModule,
    TransactionModule,
  ],
  controllers: [AdminController],
  providers: [AdminApiGuard, AdminService],
})
export class AdminModule {}
