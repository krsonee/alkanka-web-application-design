import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

export const ADMIN_COOKIE = 'alk_admin'

function sessionToken() {
  const secret = process.env.ADMIN_PASSWORD
  if (!secret) return null
  return createHmac('sha256', secret).update('alkanka-admin-session').digest('hex')
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export function checkPassword(input: string) {
  const secret = process.env.ADMIN_PASSWORD
  return Boolean(secret) && safeEqual(input, secret!)
}

export function createSessionValue() {
  return sessionToken()
}

export async function isAdmin() {
  const expected = sessionToken()
  if (!expected) return false
  const value = (await cookies()).get(ADMIN_COOKIE)?.value
  return Boolean(value) && safeEqual(value!, expected)
}

export function adminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD)
}
