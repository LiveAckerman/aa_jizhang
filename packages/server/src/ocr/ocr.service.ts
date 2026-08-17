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
    } catch (error) {
      throw new BadRequestException(
        `OCR识别失败: ${error.message || '未知错误'}`,
      )
    }
  }

  /**
   * 解析支付记录（智能提取）
   */
  private parsePaymentRecords(fullText: string, results: any[]): PaymentRecord[] {
    const records: PaymentRecord[] = []

    // 规则1: 微信支付格式
    // "向XXX转账" + "¥123.45"
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

    // 规则2: 支付宝格式
    // "付款给XXX" + "123.45元"
    const alipayPattern = /付款给(.+?)[\s\S]*?(\d+\.?\d*)元/g
    while ((match = alipayPattern.exec(fullText)) !== null) {
      records.push({
        merchant: match[1].trim(),
        amount: Math.round(parseFloat(match[2]) * 100),
        confidence: 0.9,
        source: 'alipay',
      })
    }

    // 规则3: 通用格式（微信/支付宝转账成功页）
    // "转账金额" + "¥123.45" 或 "123.45元"
    if (records.length === 0) {
      const amountPattern1 = /转账金额[\s\S]*?[¥￥](\d+\.?\d*)/g
      const amountPattern2 = /(\d+\.?\d*)元/g

      while ((match = amountPattern1.exec(fullText)) !== null) {
        const amount = Math.round(parseFloat(match[1]) * 100)
        if (amount > 0) {
          records.push({
            merchant: '未知商户',
            amount,
            confidence: 0.7,
            source: 'generic',
          })
        }
      }

      if (records.length === 0) {
        while ((match = amountPattern2.exec(fullText)) !== null) {
          const amount = Math.round(parseFloat(match[1]) * 100)
          if (amount > 0 && amount < 1000000) {
            // 限制金额合理范围
            records.push({
              merchant: '未知商户',
              amount,
              confidence: 0.5,
              source: 'generic',
            })
          }
        }
      }
    }

    // 规则4: 提取可能的商户名（中文2-10字）
    if (records.length > 0 && records.some((r) => r.merchant === '未知商户')) {
      const merchantPattern = /([一-龥]{2,10})/g
      const merchants: string[] = []
      while ((match = merchantPattern.exec(fullText)) !== null) {
        const text = match[1]
        // 过滤无意义的词
        if (
          !['支付', '转账', '收款', '付款', '成功', '完成', '金额', '备注'].includes(
            text,
          )
        ) {
          merchants.push(text)
        }
      }

      // 尝试为"未知商户"分配商户名
      let merchantIndex = 0
      records.forEach((record) => {
        if (record.merchant === '未知商户' && merchants[merchantIndex]) {
          record.merchant = merchants[merchantIndex]
          merchantIndex++
        }
      })
    }

    return records
  }

  /**
   * 智能匹配分类
   */
  private enrichRecords(records: PaymentRecord[]): PaymentRecord[] {
    return records.map((record) => {
      const category = this.guessCategory(record.merchant)
      const spentAt = new Date().toISOString()

      return {
        ...record,
        category,
        spentAt,
        note: record.merchant,
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
