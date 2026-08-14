import { Injectable, Logger } from '@nestjs/common'

/**
 * 汇率服务：接免费公开 API，内存缓存 24h。
 * 使用 frankfurter.app（欧洲央行数据，免费、无 key）。
 * 只保留最常用币种，避免返回体过大。
 */
const SUPPORTED_CURRENCIES = [
  { code: 'USD', name: '美元', symbol: '$' },
  { code: 'EUR', name: '欧元', symbol: '€' },
  { code: 'JPY', name: '日元', symbol: '¥' },
  { code: 'HKD', name: '港币', symbol: 'HK$' },
  { code: 'GBP', name: '英镑', symbol: '£' },
  { code: 'KRW', name: '韩元', symbol: '₩' },
  { code: 'SGD', name: '新加坡元', symbol: 'S$' },
  { code: 'THB', name: '泰铢', symbol: '฿' },
  { code: 'AUD', name: '澳元', symbol: 'A$' },
  { code: 'CAD', name: '加元', symbol: 'C$' },
]

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CNY_ALWAYS = { code: 'CNY', name: '人民币', symbol: '¥', rate: 1 }

interface RateCache {
  fetchedAt: number
  data: Array<{ code: string; name: string; symbol: string; rate: number }>
}

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger('ExchangeRateService')
  private cache: RateCache | null = null

  async getRates() {
    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return { fetchedAt: new Date(this.cache.fetchedAt).toISOString(), rates: this.cache.data }
    }
    const rates = await this.fetchFromFrankfurter()
    if (rates) {
      this.cache = { fetchedAt: Date.now(), data: rates }
      return { fetchedAt: new Date(this.cache.fetchedAt).toISOString(), rates }
    }
    // 抓取失败：如有旧缓存返回旧的；否则返回仅 CNY
    if (this.cache) {
      return { fetchedAt: new Date(this.cache.fetchedAt).toISOString(), rates: this.cache.data, stale: true }
    }
    return { fetchedAt: new Date().toISOString(), rates: [CNY_ALWAYS], stale: true }
  }

  /**
   * frankfurter 用法：GET https://api.frankfurter.app/latest?from=CNY&to=USD,EUR,...
   * 返回 rates 是 { USD: 0.14, EUR: 0.13, ... }（1 CNY = X 目标币）。
   * 我们要的是 1 目标币 = ? CNY，取倒数。
   */
  private async fetchFromFrankfurter(): Promise<RateCache['data'] | null> {
    const codes = SUPPORTED_CURRENCIES.map((c) => c.code).join(',')
    const url = `https://api.frankfurter.app/latest?from=CNY&to=${codes}`
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(6000) })
      if (!resp.ok) {
        this.logger.warn(`frankfurter HTTP ${resp.status}`)
        return null
      }
      const json = (await resp.json()) as { rates?: Record<string, number> }
      if (!json.rates) return null
      const out: RateCache['data'] = [CNY_ALWAYS]
      for (const c of SUPPORTED_CURRENCIES) {
        const r = json.rates[c.code]
        if (!r || r <= 0) continue
        out.push({
          code: c.code,
          name: c.name,
          symbol: c.symbol,
          rate: Number((1 / r).toFixed(6)), // 1 目标币 = X CNY
        })
      }
      return out
    } catch (e: any) {
      this.logger.warn(`fetch rates failed: ${e.message || e}`)
      return null
    }
  }
}
