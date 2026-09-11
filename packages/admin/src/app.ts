import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import AdminJS, { ComponentLoader } from 'adminjs'
import AdminJSExpress from '@adminjs/express'
import Adapter, { Database, Resource } from '@adminjs/sql'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import session from 'express-session'
import helmet from 'helmet'
import createFileStore from 'session-file-store'
import type { AdminConfig } from './config.js'
import { createAuthProvider } from './auth.js'
import { createAdminApiClient } from './business-api.js'
import { buildResources } from './resources.js'
import { createStatisticsHandler } from './statistics.js'
import { zhCNTranslations } from './translations.js'

const require = createRequire(import.meta.url)
const lightboxStylesPath = new URL('../../../node_modules/yet-another-react-lightbox/dist/styles.css', import.meta.url).pathname

AdminJS.registerAdapter({ Database, Resource })

export interface AdminRuntime {
  admin: AdminJS
  closeDatabase: () => Promise<void>
}

export const createAdminRuntime = async (
  config: AdminConfig,
): Promise<AdminRuntime> => {
  const database = await new Adapter('postgresql', {
    connectionString: config.databaseUrl,
    database: config.databaseName,
  }).init()

  const componentLoader = new ComponentLoader()
  const dashboardComponent = componentLoader.add('StatisticsDashboard', './components/dashboard')
  const mediaComponent = componentLoader.add('MediaProperty', './components/media-property')
  const moneyComponent = componentLoader.add('MoneyProperty', './components/money-property')
  const userComponent = componentLoader.add('UserProperty', './components/user-property')
  const splitsComponent = componentLoader.add('SplitsProperty', './components/splits-property')
  const relatedRecordsComponent = componentLoader.add('RelatedRecordsProperty', './components/related-records-property')
  componentLoader.override('SidebarResourceSection', './components/sidebar-resource-section')
  componentLoader.override('SidebarPages', './components/sidebar-pages')
  const knex = database.tables()[0]?.knex
  if (!knex) throw new Error('数据库没有可用于统计的资源')
  const adminApi = config.adminApiToken ? createAdminApiClient(config) : null
  const admin = new AdminJS({
    rootPath: config.rootPath,
    componentLoader,
    resources: buildResources(database, {
      media: mediaComponent,
      money: moneyComponent,
      user: userComponent,
      splits: splitsComponent,
      relatedRecords: relatedRecordsComponent,
    }, knex, adminApi),
    dashboard: {
      handler: createStatisticsHandler(knex),
      component: dashboardComponent,
    },
    pages: {
      statistics: {
        handler: createStatisticsHandler(knex),
        component: dashboardComponent,
        icon: 'BarChart2',
      },
    },
    branding: {
      companyName: '一起分账吧',
      withMadeWithLove: false,
    },
    assets: {
      styles: [`${config.rootPath}/assets/yarl.css`],
    },
    locale: {
      language: 'zh-CN',
      availableLanguages: ['zh-CN'],
      translations: { 'zh-CN': zhCNTranslations },
    },
  })
  return {
    admin,
    closeDatabase: async () => {
      await knex?.destroy()
    },
  }
}

export const createApp = async (
  admin: AdminJS,
  config: AdminConfig,
): Promise<express.Express> => {
  await mkdir(config.sessionDir, { recursive: true, mode: 0o700 })

  const app = express()
  app.disable('x-powered-by')
  if (config.trustProxy > 0) app.set('trust proxy', config.trustProxy)
  app.use(helmet({ contentSecurityPolicy: false }))
  app.get(`${config.rootPath}/assets/yarl.css`, (_request, response) => {
    response.type('text/css').sendFile(lightboxStylesPath)
  })
  app.get('/healthz', (_request, response) => response.status(200).json({ ok: true }))

  app.post(
    `${config.rootPath}/login`,
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 5,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: '登录尝试过多，请稍后再试。',
    }),
  )

  const FileStore = createFileStore(session)
  const sessionStore = new FileStore({
    path: config.sessionDir,
    ttl: 8 * 60 * 60,
    retries: 1,
    logFn: () => undefined,
  })
  const componentLoader = admin.options.componentLoader ?? new ComponentLoader()
  const router = AdminJSExpress.buildAuthenticatedRouter(
    admin,
    {
      provider: createAuthProvider(config, componentLoader),
      cookieName: 'departure-admin',
      cookiePassword: config.sessionSecret,
    },
    undefined,
    {
      name: 'departure-admin',
      secret: config.sessionSecret,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000,
      },
    },
  )

  app.use(admin.options.rootPath, router)
  return app
}
