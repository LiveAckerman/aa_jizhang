import { Injectable, BadRequestException, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { UploadService } from '../upload/upload.service'
import { PaymentRecord, OcrRecognitionResult } from './ocr.types'
import FormData from 'form-data'
import fetch from 'node-fetch'

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name)
  private readonly ocrApiUrl: string
  private readonly ocrApiKey: string
  private readonly aiSummaryBaseUrl: string
  private readonly aiSummaryApiKey: string
  private readonly aiSummaryModel: string

  constructor(
    private readonly configService: ConfigService,
    private readonly uploadService: UploadService,
  ) {
    this.ocrApiUrl =
      this.configService.get<string>('OCR_API_URL') ||
      'https://utils.songin.ai/v1/ocr/recognize'
    this.ocrApiKey =
      this.configService.get<string>('OCR_API_KEY') ||
      'ai-music-utils-api-key'
    this.aiSummaryBaseUrl =
      this.configService.get<string>('AI_SUMMARY_BASE_URL') || ''
    this.aiSummaryApiKey =
      this.configService.get<string>('AI_SUMMARY_API_KEY') || ''
    this.aiSummaryModel =
      this.configService.get<string>('AI_SUMMARY_MODEL') || 'gpt-4o-mini'
  }

  /**
   * 识别支付截图
   */
  async recognizeReceipt(
    file: Express.Multer.File,
  ): Promise<OcrRecognitionResult> {
    // 1. 调用OCR API识别文字
    const ocrResult = await this.callOcrApi(file)

    if (!ocrResult.success) {
      throw new BadRequestException('OCR识别失败')
    }

    // 2. 上传原图到R2
    const imageUrl = await this.uploadService.uploadToR2(file, 'ocr')

    let records: PaymentRecord[]

    // 3. 尝试使用 AI 总结服务智能解析
    if (this.aiSummaryBaseUrl && this.aiSummaryApiKey) {
      try {
        records = await this.parseWithAI(ocrResult.fullText)
      } catch (error: any) {
        // 失败则降级到原规则解析
        this.logger.warn(`AI总结失败，降级规则解析: ${error?.message || error}`)
        records = this.parsePaymentRecords(
          ocrResult.fullText,
          ocrResult.results,
        )
      }
    } else {
      // 未配置 AI 服务，直接使用规则解析
      records = this.parsePaymentRecords(
        ocrResult.fullText,
        ocrResult.results,
      )
    }

    // 4. 智能匹配分类
    const enrichedRecords = this.enrichRecords(records)

    return {
      imageUrl,
      records: enrichedRecords,
      rawOcrResult: ocrResult.fullText,
    }
  }

  /**
   * 调用OCR API
   */
  private async callOcrApi(file: Express.Multer.File): Promise<any> {
    const formData = new FormData()
    formData.append('file', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    })
    formData.append('language', 'ch_en')
    formData.append('detectAngle', 'true')

    try {
      const response = await fetch(this.ocrApiUrl, {
        method: 'POST',
        headers: {
          'x-api-key': this.ocrApiKey,
          ...formData.getHeaders(),
        },
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`OCR API返回错误: ${response.statusText}`)
      }

      return await response.json()
    } catch (error: any) {
      throw new BadRequestException(
        `OCR识别失败: ${error?.message || '未知错误'}`,
      )
    }
  }

  /**
   * 使用 AI 总结服务解析 OCR 文本
   */
  private async parseWithAI(fullText: string): Promise<PaymentRecord[]> {
    const prompt = `请从以下 OCR 识别的文本中提取支付记录信息。

OCR 文本：
${fullText}

请分析这段文本，提取其中的支付记录，返回 JSON 数组格式，每条记录包含：
- merchant: 商户名称（字符串，如果无法识别则为"未知商户"）
- amount: 金额（整数，单位为分/cents，务必将元转换为分，即乘以100）
- confidence: 置信度（0-1之间的浮点数）
- source: 来源（'wechat' | 'alipay' | 'generic'）
- spentAt: 支付时间（ISO 8601 格式字符串，如果文本中有时间则解析，否则使用当前时间）

金额换算示例（务必遵守）：
- 文本 "¥15.00" 或 "15.00元" → amount: 1500（不是 15）
- 文本 "¥100" 或 "100元"     → amount: 10000（不是 100）
- 文本 "0.5元"                → amount: 50（不是 0.5）

其他注意事项：
1. 如果是账单详情页（包含"支付成功"/"交易成功"等），通常只有一笔记录
2. 如果是列表页，可能有多笔记录
3. 排除汇总金额（如"本月支出"、"总计"等）
4. 只返回 JSON 数组，不要其他解释文字，不要 markdown 代码块

示例输出：
[
  {
    "merchant": "星巴克",
    "amount": 4500,
    "confidence": 0.9,
    "source": "wechat",
    "spentAt": "2026-08-25T10:30:00.000Z"
  }
]`

    const requestBody = {
      model: this.aiSummaryModel,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1,
    }

    const url = `${this.aiSummaryBaseUrl}/chat/completions`
    const startedAt = Date.now()

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.aiSummaryApiKey}`,
        },
        body: JSON.stringify(requestBody),
        // 30s 超时，避免 AI 服务无响应时阻塞 OCR 接口
        timeout: 30_000,
      })

      if (!response.ok) {
        // 失败详情拼进 error message，由上层统一 warn 一次
        const errorText = await response.text().catch(() => '')
        throw new Error(
          `AI API ${response.status} ${response.statusText} ${errorText.slice(0, 200)}`,
        )
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || '[]'

      // 提取 JSON 数组（可能被 markdown 代码块包裹）
      let jsonText = content.trim()
      const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1]
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(jsonText)
      } catch {
        throw new Error(`AI返回内容非JSON: ${jsonText.slice(0, 200)}`)
      }
      if (!Array.isArray(parsed)) {
        throw new Error(`AI返回不是数组: ${jsonText.slice(0, 200)}`)
      }
      const records = parsed as PaymentRecord[]

      // 验证并标准化数据
      const normalized = records
        .filter((r) => r.merchant && r.amount > 0)
        .map((r) => ({
          merchant: String(r.merchant).slice(0, 20),
          amount: Math.round(Number(r.amount)),
          confidence: Math.max(0, Math.min(1, Number(r.confidence) || 0.85)),
          source: ['wechat', 'alipay', 'generic'].includes(r.source)
            ? r.source
            : 'generic',
          spentAt: r.spentAt || new Date().toISOString(),
        }))

      // 金额单位校验：LLM 常忘记「元→分」的换算，直接返回元值
      // 检测：若 AI 返回值除以100后匹配不上 OCR 文本中的金额、
      //      但原值恰好匹配得上，则判定单位错误，抛出以触发规则解析降级
      const ocrAmounts = this.extractAmountsFromText(fullText)
      if (ocrAmounts.length > 0) {
        for (const r of normalized) {
          const yuanFromAI = r.amount / 100
          const rawAsYuan = r.amount
          const yuanMatches = ocrAmounts.some(
            (a) => Math.abs(a - yuanFromAI) < 0.005,
          )
          const rawMatches = ocrAmounts.some(
            (a) => Math.abs(a - rawAsYuan) < 0.005,
          )
          if (!yuanMatches && rawMatches) {
            throw new Error(
              `AI疑似金额单位错误: 返回${r.amount}(应为分)但匹配到OCR原文中的元值`,
            )
          }
        }
      }

      // 成功路径只留一行：条数 + 耗时
      this.logger.log(
        `AI解析成功 ${normalized.length}条 +${Date.now() - startedAt}ms`,
      )

      return normalized
    } catch (error: any) {
      throw new Error(`AI 总结失败: ${error?.message || '未知错误'}`)
    }
  }

  /**
   * 从 OCR 文本中提取候选金额（元），用于 AI 返回值的合理性校验
   */
  private extractAmountsFromText(text: string): number[] {
    const matches = text.match(/\d+(?:\.\d{1,2})?/g) || []
    return matches
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0 && n < 1_000_000)
  }

  /**
   * 解析支付记录（智能提取）
   */
  private parsePaymentRecords(fullText: string, results: any[]): PaymentRecord[] {
    const records: PaymentRecord[] = []

    // ── 规则 0 (最高优先级)：结构化账单详情页 ──────────────────────────────
    // 特征：含「支付成功」/「收款成功」/「交易成功」或「当前状态」+「支付」
    // 包含：微信/支付宝/银联扫码付款详情页
    const isDetailPage =
      fullText.includes('支付成功') ||
      fullText.includes('收款成功') ||
      fullText.includes('交易成功') ||
      (fullText.includes('当前状态') && fullText.includes('支付'))

    if (isDetailPage) {
      // 1. 从 results 中找大字号金额（bounding box 高度 > 60px + 匹配金额格式）
      //    详情页的主金额通常用大字号居中显示，如 -15.00 / 15.00 / ¥15.00
      const amountTextRe = /^[¥￥-]?\s*(\d+\.\d{1,2})$/
      let amount = 0
      let maxBoxHeight = 0
      for (const r of results) {
        const text = (r.text || '').trim()
        const m = text.match(amountTextRe)
        if (!m) continue
        const boxHeight = Math.abs((r.box?.[2]?.[1] ?? 0) - (r.box?.[0]?.[1] ?? 0))
        if (boxHeight > maxBoxHeight) {
          maxBoxHeight = boxHeight
          amount = Math.round(parseFloat(m[1]) * 100)
        }
      }

      // 2. 提取商户名：优先「商户全称」（更准确），其次「商户名称」/「收款方」，最后「商品」
      let merchant = ''
      const fieldPatterns = [
        /商户全称\n(.+?)(?:\n|$)/,
        /商户名称\n(.+?)(?:\n|$)/,
        /收款方\n(.+?)(?:\n|$)/,
        /商品\n(.+?)(?:\n|$)/,
      ]
      for (const pat of fieldPatterns) {
        const m = fullText.match(pat)
        const val = (m?.[1] ?? '').trim()
        if (!val) continue
        // 跳过看起来是订单号/编号的值（纯数字、含"号：" 等）
        if (/号[：:]/.test(val) || /^[\d\s-]+$/.test(val)) continue
        merchant = val.slice(0, 20)
        break
      }

      // 3. 提取支付时间（「支付时间」/「交易时间」字段）
      let spentAt = new Date().toISOString()
      const timeFieldMatch = fullText.match(/(?:支付|交易|完成)时间\n(.+?)(?:\n|$)/)
      if (timeFieldMatch) {
        try {
          // "2026年8月18日11:20:40" 或 "2026年08月15日11:33:55"
          const raw = timeFieldMatch[1]
            .replace(/(\d+)年(\d+)月(\d+)日\s*/, (_, y, mo, d) =>
              `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T`,
            )
            .trim()
          const dateObj = new Date(raw)
          if (!isNaN(dateObj.getTime())) spentAt = dateObj.toISOString()
        } catch (_) {}
      }

      if (amount > 0) {
        records.push({
          merchant: merchant || '未知商户',
          amount,
          confidence: merchant ? 0.92 : 0.75,
          source: 'wechat',
          spentAt,
        })
      }

      // 详情页只有一笔，直接返回
      return records
    }

    // ── 规则 1: 微信转账页 "向XXX转账 ¥123.45" ──────────────────────────────
    const wechatPattern = /向(.+?)转账[\s\S]*?[¥￥](\d+\.?\d*)/g
    let match: RegExpExecArray | null

    while ((match = wechatPattern.exec(fullText)) !== null) {
      records.push({
        merchant: match[1].trim(),
        amount: Math.round(parseFloat(match[2]) * 100),
        confidence: 0.9,
        source: 'wechat',
      })
    }

    // ── 规则 2: 支付宝页 "付款给XXX 123.45元" ───────────────────────────────
    const alipayPattern = /付款给(.+?)[\s\S]*?(\d+\.?\d*)元/g
    while ((match = alipayPattern.exec(fullText)) !== null) {
      records.push({
        merchant: match[1].trim(),
        amount: Math.round(parseFloat(match[2]) * 100),
        confidence: 0.9,
        source: 'alipay',
      })
    }

    // ── 规则 3: 通用行扫描（账单列表、付款成功页等）──────────────────────────
    // 逐行查找 "¥金额"，并向上关联最近的商户名
    if (records.length === 0) {
      const lines = fullText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)

      // 汇总类关键词：这类金额是统计值，需排除（如"本月支出¥836.87"）
      const summaryKeywords = [
        '统计', '本月', '本周', '本年', '合计', '总计',
        '总支出', '总收入', '收入', '结余', '余额', '较上',
      ]

      // 金额：¥/￥ 后跟数字（最多两位小数）
      const amountRe = /[¥￥]\s*(\d+(?:\.\d{1,2})?)/

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const m = line.match(amountRe)
        if (!m) continue

        // 排除汇总金额
        if (summaryKeywords.some((k) => line.includes(k))) continue

        const amount = Math.round(parseFloat(m[1]) * 100)
        if (amount <= 0 || amount > 100000000) continue

        // 向上最多回溯 4 行，找最近的商户名（含中文、且非噪声行）
        let merchant = '未知商户'
        for (let j = i - 1; j >= 0 && j >= i - 4; j--) {
          const prev = lines[j]
          if (this.isNoiseLine(prev)) continue
          if (/[一-龥]{2,}/.test(prev)) {
            merchant = prev.replace(/[·.。\s]+$/, '').slice(0, 20)
            break
          }
        }

        records.push({
          merchant,
          amount,
          confidence: 0.75,
          source: 'generic',
        })
      }
    }

    return records
  }

  /**
   * 判断是否为噪声行（时间、状态、操作提示等，不应作为商户名）
   */
  private isNoiseLine(line: string): boolean {
    if (!line) return true
    // 纯时间：11:07 / 10:55 或日期
    if (/^\d{1,2}[:：]\d{2}/.test(line)) return true
    if (/^\d{4}[-/年]/.test(line)) return true
    // 纯数字/金额行
    if (/^[¥￥\d.\s]+$/.test(line)) return true
    // 常见状态/操作词
    const noiseWords = [
      '付款成功',
      '交易成功',
      '支付成功',
      '收款成功',
      '查看详情',
      '账单详情',
      '付款方式',
      '服务消息',
      '支付消息',
      '大额消费',
      '自动扣款',
      '备注',
    ]
    return noiseWords.some((w) => line.includes(w))
  }

  /**
   * 智能匹配分类，并补全 spentAt（如已有则保留）
   */
  private enrichRecords(records: PaymentRecord[]): PaymentRecord[] {
    return records.map((record) => {
      const category = this.guessCategory(record.merchant)
      return {
        ...record,
        category,
        // 保留规则0提取的真实支付时间，没有时才用当前时间
        spentAt: record.spentAt || new Date().toISOString(),
        note: record.note || record.merchant,
      }
    })
  }

  /**
   * 根据商户名猜测分类
   */
  private guessCategory(merchant: string): string {
    const rules = [
      {
        keywords: [
          '餐',
          '饭店',
          '小吃',
          '奶茶',
          '咖啡',
          '火锅',
          '麦当劳',
          '肯德基',
          '星巴克',
          '必胜客',
          '海底捞',
          '烧烤',
          '面馆',
          '饺子',
          '粥',
        ],
        category: 'food',
      },
      {
        keywords: [
          '滴滴',
          '出租车',
          '公交',
          '地铁',
          '打车',
          '租车',
          '停车',
          '加油',
        ],
        category: 'transport',
      },
      {
        keywords: ['酒店', '宾馆', '民宿', '旅馆', '客栈'],
        category: 'hotel',
      },
      {
        keywords: ['电影', '门票', '景区', '博物馆', '展览'],
        category: 'ticket',
      },
      {
        keywords: ['超市', '购物', '商场', '便利店', '全家', '罗森', '7-11'],
        category: 'shopping',
      },
      {
        keywords: ['KTV', '网吧', '游戏', '娱乐', '酒吧', '夜店'],
        category: 'entertainment',
      },
      {
        keywords: ['饮料', '饮品', '果汁', '水'],
        category: 'drink',
      },
      {
        keywords: ['医院', '药店', '诊所', '药房'],
        category: 'medical',
      },
    ]

    for (const rule of rules) {
      if (rule.keywords.some((kw) => merchant.includes(kw))) {
        return rule.category
      }
    }

    return 'other'
  }
}
