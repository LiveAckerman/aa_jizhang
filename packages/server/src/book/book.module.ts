import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Book } from './book.entity'
import { BookMember } from './book-member.entity'
import { BookService } from './book.service'
import { BookController } from './book.controller'

@Module({
  imports: [TypeOrmModule.forFeature([Book, BookMember])],
  controllers: [BookController],
  providers: [BookService],
  exports: [BookService, TypeOrmModule],
})
export class BookModule {}
