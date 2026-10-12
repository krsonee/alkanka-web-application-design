import { betterAuth } from 'better-auth'
import { pool } from '@/lib/db'

function authOrigin(): string {
  const candidates = [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    process.env.V0_RUNTIME_URL,
    'https://alkanka.com',
  ]
  for (const raw of candidates) {
    if (!raw) continue
    try {
      return new URL(raw).origin
    } catch {
      continue
    }
  }
  return 'https://alkanka.com'
}

const origin = authOrigin()

function authSecret(): string | undefined {
  // Render does not set BETTER_AUTH_SECRET. The panel session key is already
  // generated there, and production refuses the built-in default secret.
  for (const value of [process.env.BETTER_AUTH_SECRET, process.env.AUTH_SECRET, process.env.ADMIN_SESSION_SECRET]) {
    const secret = value?.trim()
    if (secret) return secret
  }
  return undefined
}

export const auth = betterAuth({
  database: pool,
  baseURL: origin,
  secret: authSecret(),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  user: {
    changeEmail: { enabled: true, updateEmailWithoutVerification: true },
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
    origin,
    'https://alkanka.com',
    'https://www.alkanka.com',
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`] : []),
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
