import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { join } from 'path'
import { AuthModule } from './auth/auth.module'
import { BookModule } from './book/book.module'
import { UserModule } from './user/user.module'
import { UploadModule } from './upload/upload.module'
import { User } from './user/user.entity'
import { Book } from './book/book.entity'
import { BookMember } from './book/book-member.entity'

@Module({
  imports: [
    // 读取项目根目录的 .env
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, '../../../.env'),
    }),
    // 数据库连接（MySQL）
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get('DB_HOST'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.get('DB_USERNAME'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_DATABASE'),
        entities: [User, Book, BookMember],
        synchronize: true, // 开发环境自动建表；生产环境应关闭并用迁移
        timezone: '+08:00',
        charset: 'utf8mb4',
      }),
    }),
    AuthModule,
    UserModule,
    BookModule,
    UploadModule,
  ],
})
export class AppModule {}
