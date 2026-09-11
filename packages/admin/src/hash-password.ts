import { Writable } from 'node:stream'
import { createInterface } from 'node:readline/promises'
import bcrypt from 'bcryptjs'

class MutedOutput extends Writable {
  muted = false

  _write(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    if (!this.muted) process.stdout.write(chunk, encoding)
    callback()
  }
}

const output = new MutedOutput()
if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error('该命令需要在交互式终端中运行。')
  process.exit(1)
}
const prompt = createInterface({ input: process.stdin, output, terminal: true })

try {
  process.stdout.write('管理员密码：')
  output.muted = true
  const password = await prompt.question('')
  output.muted = false
  process.stdout.write('\n再次输入：')
  output.muted = true
  const confirmation = await prompt.question('')
  output.muted = false
  process.stdout.write('\n')

  if (password !== confirmation) throw new Error('两次输入的密码不一致')
  console.log(await bcrypt.hash(password, 12))
} catch (error) {
  output.muted = false
  console.error(error instanceof Error ? error.message : '生成密码哈希失败')
  process.exitCode = 1
} finally {
  prompt.close()
}
