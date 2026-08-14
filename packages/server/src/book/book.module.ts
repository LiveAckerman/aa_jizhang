import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Book } from './book.entity'
import { BookMember } from './book-member.entity'
import { BookGroup } from './book-group.entity'
import { User } from '../user/user.entity'
import { Transaction } from '../transaction/transaction.entity'
import { BookService } from './book.service'
import { BookController } from './book.controller'
import { BookGroupService } from './book-group.service'
import { BookGroupController } from './book-group.controller'

@Module({
  imports: [TypeOrmModule.forFeature([Book, BookMember, BookGroup, User, Transaction])],
  controllers: [BookController, BookGroupController],
  providers: [BookService, BookGroupService],
  exports: [BookService, BookGroupService, TypeOrmModule],
})
export class BookModule {}
