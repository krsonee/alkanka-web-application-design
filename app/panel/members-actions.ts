'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import {
  adjustPoints,
  awardBadge,
  awardBadgeId,
  deleteRole,
  isRoleBadge,
  listRoles,
  listSpecialBadges,
  revokeAward,
  saveRole,
  setMemberRole,
  type RoleInput,
} from '@/lib/kanka-puan'
import { roleSummary, type RoleLimit, type RoleLimits } from '@/lib/kanka-puan-shared'
import { closeSignup, openSignup } from '@/lib/signup-gate'
import { listLedger } from '@/lib/wallet-ledger'
import type { LedgerPage } from '@/lib/wallet-ledger-shared'
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
  type MemberFilters,
  type MemberRow,
  type MemberSort,
  MEMBER_SORTS,
  type MemberStatus,
} from '@/lib/members-admin'
import { RESET_LINK_MINUTES, createResetLink, setMemberPassword, updateMemberInfo, type MemberInfoInput } from '@/lib/member-account'
import { bulkMembers } from '@/lib/members-bulk'
import { addMemberNote, deleteMemberNote, listMemberNotes } from '@/lib/member-notes'
import type { BulkInput, BulkSkipped, MemberNote } from '@/lib/members-bulk-shared'

type Result = { ok: true; message: string } | { ok: false; error: string }

export type MemberDetailFull = MemberDetail & { staffNotes: MemberNote[] }
export type BulkOutcome = { ok: true; message: string; done: number; skipped: BulkSkipped[] } | { ok: false; error: string }

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

export async function memberLedgerAction(userId: string, page: number): Promise<LedgerPage | null> {
  if (!(await canPanel('users'))) return null
  return listLedger(String(userId), Number(page) || 0)
}

export type MemberExtra = Pick<MemberFilters, 'sort' | 'source' | 'from' | 'to' | 'minBalance' | 'maxBalance' | 'telegram'>

function cleanExtra(extra: MemberExtra | undefined): MemberExtra {
  const e = extra ?? {}
  return {
    sort: MEMBER_SORTS.includes(e.sort as MemberSort) ? e.sort : 'yeni',
    source: String(e.source ?? '').slice(0, 60),
    from: String(e.from ?? ''),
    to: String(e.to ?? ''),
    minBalance: e.minBalance ?? null,
    maxBalance: e.maxBalance ?? null,
    telegram: e.telegram === 'var' || e.telegram === 'yok' ? e.telegram : '',
  }
}

export async function searchMembersAction(
  q: string,
  status: MemberStatus | 'tumu',
  page = 0,
  extra?: MemberExtra,
): Promise<{ members: MemberRow[]; counts: Record<MemberStatus | 'tumu', number>; total: number; page: number; pageSize: number } | null> {
  if (!(await canPanel('users'))) return null
  return listMembers({ ...cleanExtra(extra), q: q.slice(0, 80), status, page })
}

export async function exportMembersAction(
  q: string,
  status: MemberStatus | 'tumu',
  extra?: MemberExtra,
): Promise<{ ok: true; csv: string; count: number; capped: boolean } | { ok: false; error: string }> {
  if (!(await canPanel('users'))) return { ok: false, error: 'Bu işlem için yetkin yok.' }
  const r = await exportMembersCsv({ ...cleanExtra(extra), q: q.slice(0, 80), status })
  await logAudit('Üye listesi dışa aktarıldı', null, `${r.count} üye dışa aktarıldı`)
  return { ok: true, ...r }
}

export async function memberDetailAction(userId: string): Promise<MemberDetailFull | null> {
  if (!(await canPanel('users'))) return null
  const [detail, staffNotes] = await Promise.all([memberDetail(String(userId)), listMemberNotes(String(userId))])
  return detail ? { ...detail, staffNotes } : null
}

export async function addNoteAction(userId: string, body: string) {
  return guard(async () => {
    await addMemberNote(String(userId), String(body))
    return 'Not eklendi. Sadece panel personeli görür.'
  })
}

export async function deleteNoteAction(noteId: number) {
  return guard(async () => {
    await deleteMemberNote(Number(noteId))
    return 'Not silindi.'
  })
}

function cleanBulk(input: BulkInput): BulkInput | null {
  if (input?.kind === 'message') return { kind: 'message', title: String(input.title ?? ''), body: String(input.body ?? ''), url: String(input.url ?? '') }
  if (input?.kind === 'gift') return { kind: 'gift', amount: Number(input.amount), message: String(input.message ?? '') }
  if (input?.kind === 'suspend') return { kind: 'suspend', duration: String(input.duration ?? ''), reason: String(input.reason ?? '') }
  return null
}

const BULK_DONE: Record<BulkInput['kind'], string> = {
  message: 'üyenin gelen kutusuna mesaj gönderildi',
  gift: 'üyeye hediye gönderildi',
  suspend: 'üye donduruldu, açık oturumları kapatıldı',
}

export async function bulkMembersAction(ids: string[], input: BulkInput): Promise<BulkOutcome> {
  if (!(await canPanel('users'))) return { ok: false, error: 'Bu işlem için yetkin yok ya da oturum süren doldu.' }
  const clean = cleanBulk(input)
  if (!clean) return { ok: false, error: 'Geçersiz işlem.' }
  if (clean.kind === 'message' && !(await canPanel('messages'))) return { ok: false, error: 'Toplu mesaj için "Site içi mesajlar" yetkin de olmalı.' }
  try {
    const r = await bulkMembers(Array.isArray(ids) ? ids.map(String) : [], clean)
    revalidatePath('/panel')
    const left = r.skipped.length ? ` ${r.skipped.length} üye atlandı.` : ''
    return { ok: true, message: `${r.done} ${BULK_DONE[clean.kind]}.${left}`, done: r.done, skipped: r.skipped }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'İşlem yapılamadı.' }
  }
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

export async function memberActivityAction(userId: string): Promise<{
  activity: MemberActivity
  badges: { id: string; name: string; tier: string }[]
  roles: { id: string; name: string; summary: string }[]
  roleId: string | null
  canRoles: boolean
} | null> {
  if (!(await canPanel('users'))) return null
  const [activity, badges, roles, canRoles] = await Promise.all([
    memberActivity(String(userId)),
    listSpecialBadges().catch(() => []),
    listRoles().catch(() => []),
    canPanel('roles'),
  ])
  const roleIds = new Set(roles.map((r) => r.id))
  return {
    activity,
    badges: badges.filter((b) => !roleIds.has(b.id)).map((b) => ({ id: b.id, name: b.name, tier: b.tier })),
    roles: roles.map((r) => ({ id: r.id, name: r.name, summary: roleSummary(r.staff, r.limits) })),
    roleId: activity.badges.find((b) => roleIds.has(b.id))?.id ?? null,
    canRoles,
  }
}

const NO_ROLE_PERMISSION = 'Rol vermek ve düzenlemek için "Görevliler" yetkin olmalı.'

async function roleGuard(fn: () => Promise<string>) {
  return guard(async () => {
    if (!(await canPanel('roles'))) throw new Error(NO_ROLE_PERMISSION)
    return fn()
  })
}

export async function memberRoleAction(userId: string, roleId: string | null) {
  return roleGuard(async () => {
    const name = await setMemberRole(String(userId), roleId ? String(roleId) : null)
    await logAudit(name ? 'Rol verildi' : 'Rol kaldırıldı', await memberLabel(String(userId)), name)
    return name
      ? `${name} rolü verildi. Sohbette ve sitede görünmesi birkaç dakika sürebilir.`
      : 'Rol kaldırıldı. Üye tekrar seviyesiyle görünür.'
  })
}

export async function saveRoleAction(input: RoleInput) {
  return roleGuard(async () => {
    const staff = !!input.staff
    const on = (limit: RoleLimit) => (input.limits ? !!input.limits[limit] : staff)
    const limits: RoleLimits = { kp: on('kp'), rank: on('rank'), market: on('market'), events: on('events') }
    const role = { id: input.id ? String(input.id) : undefined, name: String(input.name), icon: String(input.icon), style: String(input.style), staff, limits }
    await saveRole(role)
    const summary = roleSummary(staff, limits)
    await logAudit(role.id ? 'Rol düzenlendi' : 'Rol oluşturuldu', null, `${role.name.trim()}${summary ? ` · ${summary}` : ' · sadece görünüm'}`)
    return role.id ? 'Rol güncellendi.' : 'Rol oluşturuldu. Üye detayındaki "Hediye ve rozet" sekmesinden verebilirsin.'
  })
}

export async function deleteRoleAction(id: string) {
  return roleGuard(async () => {
    await deleteRole(String(id))
    await logAudit('Rol silindi', null, String(id))
    return 'Rol silindi, bu roldeki üyelerden de kaldırıldı.'
  })
}

export async function signupGateAction(open: boolean, hours: number, slots: number) {
  return guard(async () => {
    if (!open) {
      await closeSignup()
      await logAudit('Yeni üyelik kapatıldı', null, null)
      revalidatePath('/', 'layout')
      return 'Yeni üyelik kapatıldı.'
    }
    const h = Math.floor(Number(hours) || 0)
    const cap = Math.floor(Number(slots) || 0)
    await openSignup(h, cap > 0 ? cap : null)
    await logAudit('Yeni üyelik açıldı', null, `${h > 0 ? `${h} saat` : 'süresiz'}${h > 0 && cap > 0 ? ` · ${cap} kayıt` : ''}`)
    revalidatePath('/', 'layout')
    return h > 0
      ? `Yeni üyelik ${h} saatliğine açıldı${cap > 0 ? `, ${cap} kayıt dolunca da kapanır` : ''}.`
      : 'Yeni üyelik süresiz açıldı. Kapatmak için "Şimdi kapat" düğmesini kullan.'
  })
}

export async function giftAction(userId: string, amount: number, message: string) {
  return guard(async () => {
    const balance = await giftMember(String(userId), Number(amount), String(message))
    return `Hediye gönderildi, gelen kutusuna bildirim düştü. Yeni bakiye: ${balance.toLocaleString('tr-TR')} KC`
  })
}

export async function memberBadgeAction(userId: string, badgeId: string, note: string) {
  return guard(async () => {
    if (await isRoleBadge(String(badgeId))) throw new Error('Roller "Rol ver" kartından verilir.')
    const ok = await awardBadge(String(badgeId), String(userId), `manuel-${Date.now()}`, String(note).trim() || undefined)
    if (!ok) throw new Error('Rozet verilemedi.')
    await logAudit('Rozet verildi', await memberLabel(String(userId)), `${badgeId}${note ? ` · ${note}` : ''}`)
    return 'Rozet verildi, bonus puanı hesabına eklendi.'
  })
}

export async function memberRevokeBadgeAction(userId: string, awardId: number) {
  return guard(async () => {
    const badgeId = await awardBadgeId(Number(awardId))
    if (!badgeId) throw new Error('Rozet kaydı bulunamadı.')
    if ((await isRoleBadge(badgeId)) && !(await canPanel('roles'))) throw new Error('Rol rozetlerini geri almak için rol yetkin olmalı.')
    await revokeAward(Number(awardId))
    await logAudit('Rozet geri alındı', await memberLabel(String(userId)), badgeId)
    return 'Rozet ve bonus puanı geri alındı.'
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

export async function memberInfoAction(userId: string, input: MemberInfoInput) {
  return guard(async () => {
    const changed = await updateMemberInfo(String(userId), {
      name: String(input?.name ?? ''),
      email: String(input?.email ?? ''),
      phone: String(input?.phone ?? ''),
    })
    return changed.length ? 'Üyelik bilgileri güncellendi.' : 'Değişen bir şey yok.'
  })
}

export async function memberPasswordAction(userId: string, password: string) {
  return guard(async () => {
    await setMemberPassword(String(userId), String(password ?? ''))
    return 'Şifre değiştirildi. Üyenin açık oturumları kapatıldı.'
  })
}

export type ResetLinkOutcome = { ok: true; url: string; minutes: number } | { ok: false; error: string }

export async function memberResetLinkAction(userId: string): Promise<ResetLinkOutcome> {
  if (!(await canPanel('users'))) return { ok: false, error: 'Bu işlem için yetkin yok ya da oturum süren doldu.' }
  try {
    return { ok: true, url: await createResetLink(String(userId)), minutes: RESET_LINK_MINUTES }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Bağlantı üretilemedi.' }
  }
}

export async function unlinkTelegramAction(userId: string) {
  return guard(async () => {
    await unlinkTelegram(String(userId))
    return 'Telegram bağlantısı kaldırıldı.'
  })
}
