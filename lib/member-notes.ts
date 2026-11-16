import 'server-only'
import { rows, sql } from '@/lib/db'
import { getPanelSession } from '@/lib/panel-auth'
import { ensureMemberAdmin, logAudit, memberLabel } from '@/lib/members-admin'
import { NOTE_MAX, type MemberNote } from '@/lib/members-bulk-shared'

type RawNote = { id: string; user_id: string; author: string; author_username: string; body: string; created_at: string }

/** Staff-only notes on a member, newest first. The member never sees them. */
export async function listMemberNotes(userId: string): Promise<MemberNote[]> {
  await ensureMemberAdmin()
  const session = await getPanelSession()
  const r = await rows<RawNote>(sql`SELECT id, user_id, author, author_username, body, created_at FROM member_notes
    WHERE user_id = ${userId} ORDER BY created_at DESC, id DESC LIMIT 100`)
  return r.map((n) => ({
    id: Number(n.id),
    author: n.author,
    body: n.body,
    createdAt: new Date(n.created_at).toISOString(),
    canDelete: !!session && (session.isOwner || session.username === n.author_username),
  }))
}

export async function addMemberNote(userId: string, body: string) {
  await ensureMemberAdmin()
  const session = await getPanelSession()
  if (!session) throw new Error('Oturum süren doldu, tekrar giriş yap.')
  const text = body.trim()
  if (text.length < 3) throw new Error('Not en az 3 karakter olmalı.')
  if (text.length > NOTE_MAX) throw new Error(`Not en fazla ${NOTE_MAX} karakter olabilir (yazdığın ${text.length}).`)
  const label = await memberLabel(userId)
  await rows(sql`INSERT INTO member_notes (user_id, author, author_username, body)
    VALUES (${userId}, ${session.displayName}, ${session.username}, ${text})`)
  await logAudit('Üye notu eklendi', label, text.slice(0, 200))
}

export async function deleteMemberNote(noteId: number) {
  await ensureMemberAdmin()
  const session = await getPanelSession()
  if (!session) throw new Error('Oturum süren doldu, tekrar giriş yap.')
  const [note] = await rows<RawNote>(sql`SELECT id, user_id, author, author_username, body, created_at FROM member_notes WHERE id = ${noteId}`)
  if (!note) throw new Error('Not bulunamadı, silinmiş olabilir.')
  if (!session.isOwner && session.username !== note.author_username) throw new Error('Bu notu sadece yazan kişi ya da ana yönetici silebilir.')
  await rows(sql`DELETE FROM member_notes WHERE id = ${noteId}`)
  const label = await memberLabel(note.user_id).catch(() => note.user_id)
  await logAudit('Üye notu silindi', label, `${note.author}: ${note.body.slice(0, 180)}`)
}
