import type { AdminConfig } from './config.js'

export type AdminApiClient = {
  request<T>(
    method: 'POST' | 'PATCH' | 'DELETE',
    path: string,
    payload?: unknown,
  ): Promise<T>
}

type ApiEnvelope<T> = {
  code?: number
  message?: string
  data?: T
}

const trimBaseUrl = (value: string): string => value.replace(/\/+$/, '')

export const createAdminApiClient = (
  config: Pick<AdminConfig, 'adminApiUrl' | 'adminApiToken' | 'adminEmail'>,
): AdminApiClient => {
  const baseUrl = trimBaseUrl(config.adminApiUrl)

  return {
    async request<T>(
      method: 'POST' | 'PATCH' | 'DELETE',
      path: string,
      payload?: unknown,
    ) {
      if (!config.adminApiToken) {
        throw new Error('未配置 ADMIN_API_TOKEN，后台写操作已关闭')
      }

      const response = await fetch(`${baseUrl}/${path.replace(/^\/+/, '')}`, {
        method,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-admin-api-token': config.adminApiToken,
          'x-admin-actor': config.adminEmail,
        },
        body: method === 'DELETE' ? undefined : JSON.stringify(payload ?? {}),
      })

      const raw = await response.text()
      let envelope: ApiEnvelope<T> = {}
      if (raw) {
        try {
          envelope = JSON.parse(raw) as ApiEnvelope<T>
        } catch {
          throw new Error(`后台业务 API 返回了无效响应（HTTP ${response.status}）`)
        }
      }

      if (!response.ok || envelope.code !== 0) {
        const message =
          typeof envelope.message === 'string' && envelope.message
            ? envelope.message
            : `后台业务 API 请求失败（HTTP ${response.status}）`
        throw new Error(message)
      }

      return envelope.data as T
    },
  }
}
