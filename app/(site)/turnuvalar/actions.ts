'use server'

import { revalidatePath } from 'next/cache'
import { addEntry, getTournament } from '@/lib/tournaments'

export type JoinState = { ok?: boolean; message?: string; fee?: number }

const NICK = /^[a-zA-Z0-9_.ğüşöçıİĞÜŞÖÇ]{3,20}$/
const TG = /^@?[a-zA-Z0-9_]{5,32}$/

export async function joinTournament(_: JoinState, form: FormData): Promise<JoinState> {
  const id = Number(form.get('id'))
  const nickname = String(form.get('nickname') ?? '').trim()
  const telegramRaw = String(form.get('telegram') ?? '').trim()
  if (!NICK.test(nickname)) return { message: 'Kullanıcı adı 3-20 karakter olmalı (harf, rakam, _ ve .).' }
  if (!TG.test(telegramRaw)) return { message: 'Telegram kullanıcı adını @kanka şeklinde yaz.' }
  const telegram = telegramRaw.startsWith('@') ? telegramRaw : `@${telegramRaw}`

  try {
    const t = await getTournament(id)
    if (!t) return { message: 'Turnuva bulunamadı.' }
    if (t.status !== 'kayit') return { message: 'Bu turnuvanın kayıtları kapandı.' }
    if (t.entries.some((e) => e.nickname.toLowerCase() === nickname.toLowerCase())) return { message: 'Bu kullanıcı adı zaten kayıtlı.' }
    if (t.entries.length >= t.maxPlayers) return { message: 'Kontenjan doldu.' }
    const ok = await addEntry(id, nickname, telegram)
    if (!ok) return { message: 'Kayıt yapılamadı, kontenjan dolmuş olabilir.' }
    revalidatePath('/turnuvalar')
    revalidatePath('/panel')
    return { ok: true, fee: t.entryFee, message: `Kaydın alındı ${nickname}! Eşleşmeler Telegram'dan duyurulacak.` }
  } catch (error) {
    console.error('[turnuva] kayıt hatası', error)
    return { message: 'Bir sorun oluştu, tekrar dene.' }
  }
}
