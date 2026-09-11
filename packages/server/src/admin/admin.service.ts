import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AdminAuditLog } from './admin-audit-log.entity'

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name)

  constructor(
    @InjectRepository(AdminAuditLog)
    private readonly auditRepo: Repository<AdminAuditLog>,
  ) {}

  async audit(input: {
    actor?: string
    action: string
    resource: string
    resourceId: string
    payload?: Record<string, unknown> | null
  }): Promise<void> {
    try {
      await this.auditRepo.save(
        this.auditRepo.create({
          actor: input.actor?.trim().slice(0, 128) || 'admin',
          action: input.action.slice(0, 32),
          resource: input.resource.slice(0, 32),
          resourceId: input.resourceId.slice(0, 36),
          payload: input.payload ?? null,
        }),
      )
    } catch (error) {
      // 审计失败不能把已经成功的业务操作伪装成失败，但必须留下服务端告警。
      this.logger.error(
        `后台操作审计写入失败: ${input.action} ${input.resource}/${input.resourceId}`,
        error instanceof Error ? error.stack : String(error),
      )
    }
  }
}
