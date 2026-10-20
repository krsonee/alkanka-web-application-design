import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { pool } from '@/lib/db'
import { mailEnabled, sendResetMail, sendVerifyMail } from '@/lib/mail'

export const auth = betterAuth({
  database: pool,
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL),
  emailAndPassword: {
    enabled: true,
    autoSignIn: !mailEnabled,
    requireEmailVerification: mailEnabled,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      await sendResetMail(user.email, url)
    },
  },
  emailVerification: {
    sendOnSignUp: mailEnabled,
    sendOnSignIn: mailEnabled,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerifyMail(user.email, user.name, url)
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-up/email') return
      const name = String(ctx.body?.name ?? '').normalize('NFC').trim()
      if (name.length < 3 || name.includes('@')) {
        throw new APIError('BAD_REQUEST', { message: 'Kullanıcı adı en az 3 karakter olmalı ve @ içermemeli.' })
      }
      const { rows } = await pool.query('SELECT 1 FROM "user" WHERE lower(trim(name)) = lower($1) LIMIT 1', [name])
      if (rows.length) {
        throw new APIError('BAD_REQUEST', { message: 'Bu kullanıcı adı alınmış, başka bir tane dene.' })
      }
      return { context: { ...ctx, body: { ...ctx.body, name } } }
    }),
    // One active device per member: a fresh login revokes every other session.
    after: createAuthMiddleware(async (ctx) => {
      const fresh = ctx.context.newSession
      if (!fresh) return
      await pool
        .query('DELETE FROM "session" WHERE "userId" = $1 AND id <> $2', [fresh.user.id, fresh.session.id])
        .catch(() => {})
    }),
  },
  user: {
    changeEmail: { enabled: true, updateEmailWithoutVerification: true },
    additionalFields: {
      phone: { type: 'string', required: false, input: true },
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    customRules: {
      '/sign-in/email': { window: 60, max: 10 },
      '/sign-up/email': { window: 60, max: 3 },
      '/request-password-reset': { window: 60, max: 3 },
      '/send-verification-email': { window: 60, max: 3 },
    },
  },
  trustedOrigins: [
    ...(process.env.NODE_ENV === 'development'
      ? [
          'http://localhost:3000',
          ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
          ...(process.env.V0_DEV_APP_URL ? [process.env.V0_DEV_APP_URL] : []),
          ...(process.env.V0_BUILD_URL ? [process.env.V0_BUILD_URL] : []),
          ...(process.env.V0_SANDBOX_URL ? [process.env.V0_SANDBOX_URL] : []),
        ]
      : []),
    ...(process.env.NODE_ENV === 'production'
      ? [
          'https://alkanka.com',
          'https://www.alkanka.com',
          ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
          ...(process.env.VERCEL_PROJECT_PRODUCTION_URL ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`] : []),
        ]
      : []),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  ...(process.env.NODE_ENV === 'development'
    ? {
        advanced: {
          // Required by the cross-site v0 preview iframe. Without these
          // attributes, login succeeds but the next request appears signed out.
          defaultCookieAttributes: {
            sameSite: 'none' as const,
            secure: true,
          },
        },
      }
    : {}),
})
