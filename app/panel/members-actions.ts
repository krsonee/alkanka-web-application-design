'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { adjustPoints, awardBadge, listSpecialBadges } from '@/lib/kanka-puan'
import {
  adjustWallet,
  banMember,
  exportMembersCsv,
  giftMember,
  listMembers,
  logAudit,
  memberActivity,
  memberDetail,
  memberLabel,
  type MemberActivity,
  restoreMember,
  revokeSessions,
  suspendMember,
  unlinkTelegram,
  type MemberDetail,
  type MemberRow,
  type MemberStatus,
} from '@/lib/members-admin'

type Result = { ok: true; message: string } | { ok: false; error: string }

async function guard(fn: () => Promise<string>): Promise<Result> {
  if (!(await canPanel('users'))) return { ok: false, error: 'Bu işlem için yetkin yok ya da oturum süren doldu.' }
  try {
    const message = await fn()
    revalidatePath('/panel')
    return { ok: true, message }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'İşlem yapılamadı.' }
  }
}

export async function searchMembersAction(
  q: string,
  status: MemberStatus | 'tumu',
  page = 0,
): Promise<{ members: MemberRow[]; counts: Record<MemberStatus | 'tumu', number>; total: number; page: number; pageSize: number } | null> {
  if (!(await canPanel('users'))) return null
  return listMembers({ q: q.slice(0, 80), status, page })
}

export async function exportMembersAction(q: string, status: MemberStatus | 'tumu'): Promise<{ ok: true; csv: string; count: number } | { ok: false; error: string }> {
  if (!(await canPanel('users'))) return { ok: false, error: 'Bu işlem için yetkin yok.' }
  const r = await exportMembersCsv({ q: q.slice(0, 80), status })
  await logAudit('members.export', null, `${r.count} üye dışa aktarıldı`)
  return { ok: true, ...r }
}

export async function memberDetailAction(userId: string): Promise<MemberDetail | null> {
  if (!(await canPanel('users'))) return null
  return memberDetail(String(userId))
}

export async function suspendAction(userId: string, duration: string, reason: string) {
  return guard(async () => {
    await suspendMember(String(userId), String(duration), String(reason))
    return 'Hesap donduruldu, açık oturumları kapatıldı.'
  })
}

export async function banAction(userId: string, reason: string, ipBlock: boolean) {
  return guard(async () => {
    await banMember(String(userId), String(reason), !!ipBlock)
    return ipBlock ? 'Üye kalıcı banlandı, IP adresi de engellendi.' : 'Üye kalıcı banlandı.'
  })
}

export async function restoreAction(userId: string) {
  return guard(async () => {
    await restoreMember(String(userId))
    return 'Hesap tekrar açıldı.'
  })
}

export async function walletAction(userId: string, amount: number, reason: string) {
  return guard(async () => {
    const balance = await adjustWallet(String(userId), Number(amount), String(reason))
    return `Bakiye güncellendi. Yeni bakiye: ${balance.toLocaleString('tr-TR')} KC`
  })
}

export async function memberActivityAction(userId: string): Promise<{ activity: MemberActivity; badges: { id: string; name: string; tier: string }[] } | null> {
  if (!(await canPanel('users'))) return null
  const [activity, badges] = await Promise.all([memberActivity(String(userId)), listSpecialBadges().catch(() => [])])
  return { activity, badges: badges.map((b) => ({ id: b.id, name: b.name, tier: b.tier })) }
}

export async function giftAction(userId: string, amount: number, message: string) {
  return guard(async () => {
    const balance = await giftMember(String(userId), Number(amount), String(message))
    return `Hediye gönderildi, gelen kutusuna bildirim düştü. Yeni bakiye: ${balance.toLocaleString('tr-TR')} KC`
  })
}

export async function memberBadgeAction(userId: string, badgeId: string, note: string) {
  return guard(async () => {
    const ok = await awardBadge(String(badgeId), String(userId), `manuel-${Date.now()}`, String(note).trim() || undefined)
    if (!ok) throw new Error('Rozet verilemedi.')
    await logAudit('Rozet verildi', await memberLabel(String(userId)), `${badgeId}${note ? ` · ${note}` : ''}`)
    return 'Rozet verildi, bonus puanı hesabına eklendi.'
  })
}

export async function memberPointsAction(userId: string, points: number, note: string) {
  return guard(async () => {
    if (String(note).trim().length < 3) throw new Error('Gerekçe yazmalısın.')
    await adjustPoints(String(userId), Number(points), String(note))
    await logAudit(Number(points) > 0 ? 'Kanka puanı eklendi' : 'Kanka puanı düşüldü', await memberLabel(String(userId)), `${points} KP · ${note}`)
    return 'Kanka puanı güncellendi.'
  })
}

export async function revokeSessionsAction(userId: string) {
  return guard(async () => {
    await revokeSessions(String(userId))
    return 'Tüm oturumlar kapatıldı. Üye tekrar giriş yapmak zorunda.'
  })
}

export async function unlinkTelegramAction(userId: string) {
  return guard(async () => {
    await unlinkTelegram(String(userId))
    return 'Telegram bağlantısı kaldırıldı.'
  })
}
