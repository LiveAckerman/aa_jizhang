import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { join } from 'path'
import { AuthModule } from './auth/auth.module'
import { BookModule } from './book/book.module'
import { UserModule } from './user/user.module'
import { UploadModule } from './upload/upload.module'
import { TransactionModule } from './transaction/transaction.module'
import { ExchangeRateModule } from './exchange-rate/exchange-rate.module'
import { StatsModule } from './stats/stats.module'
import { SettlementModule } from './settlement/settlement.module'
import { OcrModule } from './ocr/ocr.module'
import { User } from './user/user.entity'
import { Book } from './book/book.entity'
import { BookMember } from './book/book-member.entity'
import { BookGroup } from './book/book-group.entity'
import { Transaction } from './transaction/transaction.entity'
import { TransactionLog } from './transaction/transaction-log.entity'
import { Settlement } from './settlement/settlement.entity'

@Module({
  imports: [
    // 读取项目根目录的 .env
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, '../../../.env'),
    }),
    // 数据库连接（PostgreSQL）
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USERNAME'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_DATABASE'),
        entities: [User, Book, BookMember, BookGroup, Transaction, TransactionLog, Settlement],
        synchronize: true, // 开发环境自动建表；生产环境应关闭并用迁移
        // 断线重连：热重载 / 网络抖动后自动重建连接，避免复用已被服务端关闭的死连接
        keepConnectionAlive: true,
        // node-postgres 连接池参数（远程库长连接必配）
        extra: {
          max: 10, // 池最大连接数
          // 本地空闲连接 30s 后主动回收，需 < 服务端的 idle 超时，防止拿到已被关闭的死连接
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000, // 建连超时
          keepAlive: true, // 开启 TCP keepalive
          allowExitOnIdle: false,
        },
        // 连接被服务端异常关闭时自动重试，避免请求直接 500
        retryAttempts: 5,
        retryDelay: 2000,
      }),
    }),
    AuthModule,
    UserModule,
    BookModule,
    UploadModule,
    TransactionModule,
    ExchangeRateModule,
    StatsModule,
    SettlementModule,
    OcrModule,
  ],
})
export class AppModule {}
