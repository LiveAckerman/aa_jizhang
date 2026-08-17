import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm'

/** OCR识别的支付记录 */
export interface PaymentRecord {
  merchant: string // 商户名
  amount: number // 金额（分）
  confidence: number // 置信度 0-1
  source: 'wechat' | 'alipay' | 'generic' // 来源
  category?: string // 推测的分类
  spentAt?: string // 时间
  note?: string // 备注
}

/** OCR识别结果 */
export interface OcrRecognitionResult {
  imageUrl: string // 上传后的图片URL
  records: PaymentRecord[] // 识别出的支付记录
  rawOcrResult: string // 原始OCR文本
}
