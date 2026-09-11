import bcrypt from 'bcryptjs'
import { ComponentLoader, DefaultAuthProvider } from 'adminjs'
import type { AdminConfig } from './config.js'

export const authenticateAdmin = async (
  email: string | undefined,
  password: string | undefined,
  config: Pick<AdminConfig, 'adminEmail' | 'adminPasswordHash'>,
): Promise<{ email: string; title: string } | null> => {
  if (!email || !password || email.toLowerCase() !== config.adminEmail) {
    return null
  }

  const matches = await bcrypt.compare(password, config.adminPasswordHash)
  return matches
    ? { email: config.adminEmail, title: '系统管理员' }
    : null
}

export const createAuthProvider = (
  config: Pick<AdminConfig, 'adminEmail' | 'adminPasswordHash'>,
  componentLoader: ComponentLoader,
): DefaultAuthProvider =>
  new DefaultAuthProvider({
    componentLoader,
    authenticate: async ({ email, password }) =>
      authenticateAdmin(email, password, config),
  })
