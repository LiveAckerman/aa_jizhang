import { Injectable, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { UploadService } from '../upload/upload.service'
import { PaymentRecord, OcrRecognitionResult } from './ocr.types'
import FormData from 'form-data'
import fetch from 'node-fetch'

@Injectable()
export class OcrService {
  private readonly ocrApiUrl: string
  private readonly ocrApiKey: string

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

    // 3. 解析文字，提取支付记录
    const records = this.parsePaymentRecords(
      ocrResult.fullText,
      ocrResult.results,
    )

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
