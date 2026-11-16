'use client'

import { useState, useTransition } from 'react'
import { CalendarClock, Copy, ExternalLink, FilePlus2, Pencil, Pin, PinOff, Send, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { askConfirm } from '@/components/panel/confirm-dialog'
import { KnownChatField } from '@/components/panel/tg-chat-field'
import { Card, btn, btnDanger, btnGhost, input } from '@/components/panel/tg-hub-ui'
import { PostEditor } from '@/components/panel/tg-post-editor'
import { ButtonsField, CheckList, MediaField, OptionsField, TargetField, type Update } from '@/components/panel/tg-post-fields'
import { NO_TIMING, PlanShelf, ScheduleField, TemplateFill, type Timing } from '@/components/panel/tg-post-plans'
import { BUTTON_ICON, MediaTile, PostPreview } from '@/components/panel/tg-post-preview'
import { RafflePanel } from '@/components/panel/tg-post-raffle'
import { ListenHelp, Note, badge, useRun, when, type Run } from '@/components/panel/tg-post-ui'
import {
  addPostTargetAction,
  checkPostTargets,
  copyPostAction,
  deletePlanAction,
  deleteSendAction,
  draftFromPostAction,
  editPostAction,
  forgetSendAction,
  morePostsAction,
  pinSendAction,
  savePlanAction,
  sendPostAction,
  testPostAction,
} from '@/app/panel/tg-post-actions'
import {
  CAPTION_LIMIT,
  EMPTY_POST,
  ORIGIN_LABEL,
  REPEAT_LABEL,
  TEXT_LIMIT,
  fillTemplate,
  finalText,
  hasButtons,
  localToIso,
  needsListener,
  plainText,
  postProblems,
  templateFields,
  visibleLength,
  type PlanRow,
  type PostButton,
  type PostCenterData,
  type PostContent,
  type PostRow,
  type PostSendRow,
  type TargetCheck,
} from '@/lib/tg-posts-shared'

const LISTEN_REASON = 'açılır yazı, üyeye özel, oy ve çekiliş butonları bu botla çalışmaz.'

function Counter({ length, limit, note }: { length: number; limit: number; note?: string }) {
  return (
    <p className={cn('text-xs tabular-nums', length > limit ? 'text-destructive' : 'text-muted-foreground')}>
      {`${length} / ${limit} karakter`}
      {note ? ` · ${note}` : ''}
    </p>
  )
}

function Problems({ items }: { items: string[] }) {
  if (!items.length) return null
  return (
    <ul role="alert" className="flex flex-col gap-1 text-sm leading-relaxed text-destructive">
      {items.map((p) => (
        <li key={p}>{p}</li>
      ))}
    </ul>
  )
}

/** Field setters for one part of a post held in state. */
function partsOf(setContent: (fn: (prev: PostContent) => PostContent) => void) {
  const media: Update<PostContent['media']> = (fn) => setContent((c) => ({ ...c, media: fn(c.media) }))
  const buttons: Update<PostContent['buttons']> = (fn) => setContent((c) => ({ ...c, buttons: fn(c.buttons) }))
  const options = (patch: Partial<PostContent['options']>) => setContent((c) => ({ ...c, options: { ...c.options, ...patch } }))
  const text = (html: string) => setContent((c) => ({ ...c, text: html }))
  return { media, buttons, options, text }
}

// --- New post --------------------------------------------------------------------

export function PostComposer({ data }: { data: PostCenterData }) {
  const [content, setContent] = useState<PostContent>(EMPTY_POST)
  const [form, setForm] = useState({ key: 0, text: '' })
  const [opened, setOpened] = useState<{ id: number; kind: 'draft' | 'template' } | null>(null)
  const [name, setName] = useState('')
  const [later, setLater] = useState(false)
  const [timing, setTiming] = useState<Timing>(NO_TIMING)
  const [botId, setBotId] = useState(() => (data.bots.find((b) => data.targets.some((t) => t.botId === b.id)) ?? data.bots[0])?.id ?? 0)
  const [chatIds, setChatIds] = useState<string[]>([])
  const [checks, setChecks] = useState<TargetCheck[] | null>(null)
  const [testChat, setTestChat] = useState(data.testChat)
  const [newChat, setNewChat] = useState('')
  const { pending, msg, run } = useRun()
  const set = partsOf(setContent)

  if (!data.bots.length) {
    return (
      <Card title="Yeni post">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Post göndermek için önce bir bot gerekli. “Otomasyonlar → Bağlantı & Cron” sekmesinden botunu ekle, sonra buraya dön.
        </p>
      </Card>
    )
  }

  const bot = data.bots.find((b) => b.id === botId) ?? data.bots[0]
  const targets = data.targets.filter((t) => t.botId === bot.id)
  const chosen = targets.filter((t) => chatIds.includes(t.chatId))
  const chosenIds = chosen.map((t) => t.chatId)
  const text = finalText(content, data.sponsors)
  const length = visibleLength(text)
  const empty = !length && !content.media.length
  const blank = empty && !hasButtons(content)
  const problems = empty ? [] : postProblems(content, text)
  const listens = data.listening.includes(bot.id)
  const deaf = !listens && needsListener(content.buttons)
  const blocked = pending || empty || problems.length > 0 || deaf
  const fields = templateFields(content)
  // A record deleted or scheduled elsewhere is no longer the one being edited.
  const openRow = opened ? data.plans.find((p) => p.id === opened.id && p.kind === opened.kind) : undefined
  const current = openRow ? opened : null
  const sendAt = localToIso(timing.at)
  const names = chosen.map((t) => t.title || t.chatId).join(', ')

  const pickTargets = (ids: string[]) => {
    setChatIds(ids)
    setChecks(null)
  }
  /** Puts a whole post into the form; the editor only reads its text when it mounts, so it is remounted. */
  const load = (next: PostContent) => {
    setContent(next)
    setForm((f) => ({ key: f.key + 1, text: next.text }))
    setChecks(null)
  }
  const reset = () => {
    load(EMPTY_POST)
    setOpened(null)
    setName('')
    setLater(false)
    setTiming(NO_TIMING)
  }
  const openPlan = async (plan: PlanRow) => {
    if (!blank && !(await askConfirm(`Formdaki yazının yerine “${plan.name}” gelsin mi? Kaydetmediğin değişiklikler gider.`))) return
    load(plan.content)
    if (plan.botId && data.bots.some((b) => b.id === plan.botId)) setBotId(plan.botId)
    setChatIds(plan.chatIds)
    setOpened({ id: plan.id, kind: plan.kind === 'template' ? 'template' : 'draft' })
    setName(plan.name)
  }
  const fill = (values: Parameters<typeof fillTemplate>[1]) => {
    load(fillTemplate(content, values))
    // Filled in, it is a post made from the template and must not be saved back over it.
    if (current?.kind === 'template') {
      setOpened(null)
      setName('')
    }
  }
  const save = (kind: 'draft' | 'template') =>
    run(
      () => savePlanAction({ id: current?.kind === kind ? current.id : null, kind, name, botId: bot.id, chatIds: chosenIds, content }),
      (result) => result.ok && result.id && setOpened({ id: result.id, kind }),
    )
  const draftId = current?.kind === 'draft' ? current.id : null
  const send = async () => {
    if (!(await askConfirm(`Post şu ${chosen.length} hedefe gönderilsin mi: ${names}`))) return
    run(
      async () => {
        const result = await sendPostAction({ content, botId: bot.id, chatIds: chosenIds })
        if (result.ok && draftId) await deletePlanAction(draftId)
        return result
      },
      (result) => {
        setChecks(null)
        if (result.ok) reset()
      },
    )
  }
  const schedule = async () => {
    if (!sendAt) return
    const repeat = timing.repeat === 'none' ? '' : `, ${REPEAT_LABEL[timing.repeat].toLocaleLowerCase('tr-TR')} tekrarlanarak`
    if (!(await askConfirm(`Post ${when(sendAt)} tarihinde${repeat} şu ${chosen.length} hedefe gönderilsin mi: ${names}`))) return
    run(
      () => savePlanAction({ id: draftId, kind: 'scheduled', name, botId: bot.id, chatIds: chosenIds, content, sendAt, repeat: timing.repeat, graceMin: timing.graceMin }),
      (result) => result.ok && reset(),
    )
  }

  const listenHelp = <ListenHelp bot={bot} reason={LISTEN_REASON} pending={pending} run={run} />

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        <PlanShelf plans={data.plans} openId={current?.id ?? null} pending={pending} onOpen={openPlan} run={run} />
        {current && openRow && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/5 p-3">
            <p className="min-w-0 text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
              {current.kind === 'template'
                ? `“${openRow.name}” şablonu açık. Alanlarını doldurup gönder ya da şablonun kendisini değiştirip güncelle.`
                : `“${openRow.name}” taslağı açık. Gönderince ya da zamanlayınca taslaklardan çıkar.`}
            </p>
            <button type="button" className={cn(btnGhost, 'gap-1.5')} disabled={pending} onClick={reset}>
              <FilePlus2 className="size-4" aria-hidden="true" />
              Boş postla başla
            </button>
          </div>
        )}
        <Card title="Yazı" hint="Biçim vermek için yazıyı seçip üstteki düğmelere bas. Yanda Telegram’da nasıl görüneceğini görürsün.">
          <PostEditor key={form.key} initial={form.text} label="Post yazısı" onChange={set.text} />
          <Counter length={length} limit={TEXT_LIMIT} note={content.media.length ? `medyanın altına ${CAPTION_LIMIT} karaktere kadar sığar` : undefined} />
        </Card>
        {fields.length > 0 && <TemplateFill key={form.key} fields={fields} sponsors={data.sponsors} onFill={fill} />}
        <Card title="Medya" hint="İstersen fotoğraf, video, GIF ya da dosya ekle.">
          <MediaField media={content.media} update={set.media} library={data.library} />
        </Card>
        <Card title="Butonlar" hint="Postun altına basılabilir butonlar ekle: link, kod, üyeye özel içerik, oylama, çekiliş ya da bota yönlendirme.">
          <ButtonsField key={form.key} rows={content.buttons} update={set.buttons} listens={listens} listenHelp={listenHelp} bots={data.bots} />
        </Card>
      </div>

      <div className="min-w-0 xl:sticky xl:top-4 xl:row-span-2">
        <Card title="Önizleme">
          <PostPreview content={content} text={text} sender={chosen[0]?.title || bot.name} />
        </Card>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Card title="Nereye gidecek" hint="Postu gönderecek botu ve gideceği kanal ya da grupları seç.">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Gönderecek bot
            <select
              className={input}
              value={bot.id}
              onChange={(e) => {
                setBotId(Number(e.target.value))
                pickTargets([])
              }}
            >
              {data.bots.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.username ? `${b.name} (@${b.username})` : b.name}
                </option>
              ))}
            </select>
          </label>
          <TargetField targets={targets} selected={chosenIds} onChange={pickTargets} />
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground">
              Listede olmayan kanal ya da grup
              <KnownChatField label="Listede olmayan kanal ya da grup" value={newChat} onChange={setNewChat} exclude={targets.map((t) => t.chatId)} />
            </div>
            <button
              type="button"
              className={btnGhost}
              disabled={pending || !newChat.trim()}
              onClick={() => run(() => addPostTargetAction(bot.id, newChat), (result) => result.ok && setNewChat(''))}
            >
              Hedef ekle
            </button>
          </div>
          <button
            type="button"
            className={cn(btnGhost, 'self-start')}
            disabled={pending || !chosen.length}
            onClick={() =>
              run(async () => {
                const result = await checkPostTargets(bot.id, chosenIds, content.options.pin)
                setChecks(result.checks)
                return { ok: result.ok, message: result.message }
              })
            }
          >
            Bot bu hedeflere gönderebilir mi, bak
          </button>
          {checks && <CheckList checks={checks} />}
        </Card>

        <Card title="Seçenekler">
          <OptionsField
            options={content.options}
            set={(patch) => {
              set.options(patch)
              if ('pin' in patch) setChecks(null)
            }}
            sponsors={data.sponsors}
          />
        </Card>

        <Card title="Gönder" hint="Göndermeden önce postu kendine ya da bir deneme grubuna atıp Telegram’da nasıl göründüğüne bak.">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground">
              Deneme sohbeti
              <KnownChatField label="Deneme sohbeti" value={testChat} onChange={setTestChat} placeholder="Sayı ID’n, -100… ya da @kanaladi" />
            </div>
            <button type="button" className={btnGhost} disabled={blocked || !testChat.trim()} onClick={() => run(() => testPostAction({ content, botId: bot.id, chat: testChat }))}>
              Önce bana gönder
            </button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Kendi hesabına denemek için Telegram sayı ID’ni yaz ve bu bota bir kez /start de. Deneme postu listeye yazılmaz.
          </p>
          <fieldset className="flex flex-col gap-3">
            <legend className="pb-2 text-xs text-muted-foreground">Ne zaman gitsin</legend>
            <div className="flex flex-wrap gap-1">
              {[
                { on: !later, label: 'Şimdi', pick: () => setLater(false) },
                { on: later, label: 'İleri bir zamanda', pick: () => setLater(true) },
              ].map((choice) => (
                <button
                  key={choice.label}
                  type="button"
                  aria-pressed={choice.on}
                  onClick={choice.pick}
                  className={cn('flex h-9 items-center rounded-lg border px-3 text-sm font-medium', choice.on ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-muted')}
                >
                  {choice.label}
                </button>
              ))}
            </div>
            {later && <ScheduleField value={timing} onChange={setTiming} />}
          </fieldset>
          <Problems items={problems} />
          {deaf && <p className="text-sm leading-relaxed text-destructive">Bu bot buton basışlarını dinlemiyor; {LISTEN_REASON} Butonu seçip “Dinlemeyi aç”a bas ya da buton türünü değiştir.</p>}
          {later ? (
            <button type="button" className={cn(btn, 'gap-2 self-start')} disabled={blocked || !chosen.length || !sendAt} onClick={schedule}>
              <CalendarClock className="size-4" aria-hidden="true" />
              {pending ? 'Çalışıyor…' : !chosen.length ? 'Önce hedef seç' : !sendAt ? 'Tarih ve saat seç' : `${chosen.length} hedef için zamanla`}
            </button>
          ) : (
            <button type="button" className={cn(btn, 'gap-2 self-start')} disabled={blocked || !chosen.length} onClick={send}>
              <Send className="size-4" aria-hidden="true" />
              {pending ? 'Çalışıyor…' : chosen.length ? `${chosen.length} hedefe gönder` : 'Önce hedef seç'}
            </button>
          )}
          <Note msg={msg} />
        </Card>

        <Card
          title="Sonra kullanmak için kaydet"
          hint="Taslak yarım kalan postu saklar. Şablon tekrar tekrar kullanılır: yazıda ya da butonlarda {sponsor}, {kod} ve {link} yazdığın yerler, şablonu her açı��ında sorulur."
        >
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Ad (taslakta boş bırakabilirsin)
            <input className={input} value={name} maxLength={80} placeholder="Örn: Hafta sonu bonus duyurusu" onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnGhost} disabled={pending || blank} onClick={() => save('draft')}>
              {current?.kind === 'draft' ? 'Taslağı güncelle' : 'Taslak olarak kaydet'}
            </button>
            <button type="button" className={btnGhost} disabled={pending || blank || !name.trim()} onClick={() => save('template')}>
              {current?.kind === 'template' ? 'Şablonu güncelle' : 'Şablon olarak kaydet'}
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}

// --- Sent posts ------------------------------------------------------------------

const STATUS: Record<PostSendRow['status'], { label: string; className: string }> = {
  sent: { label: 'Yayında', className: 'bg-success/15 text-success' },
  failed: { label: 'Gönderilemedi', className: 'bg-destructive/10 text-destructive' },
  deleted: { label: 'Silindi', className: 'bg-muted text-muted-foreground' },
}

/** What the panel knows about how often a button was used, in words. */
function buttonStat(b: PostButton, post: PostRow) {
  const votes = post.content.buttons.flat().filter((x) => x.kind === 'vote')
  const total = votes.reduce((sum, v) => sum + (post.stats.counts[v.id] ?? 0), 0)
  switch (b.kind) {
    case 'vote': {
      const n = post.stats.counts[b.id] ?? 0
      return votes.length > 1 && total > 0 ? `${n} oy · %${Math.round((n / total) * 100)}` : `${n} oy`
    }
    case 'raffle':
      return `${post.stats.raffle?.entries ?? 0} katılımcı`
    case 'popup':
    case 'member':
      return `${post.clicks[b.id] ?? 0} basış`
    case 'link':
      return b.track ? `${post.clicks[b.id] ?? 0} tıklama` : 'sayılmıyor'
    default:
      return 'Telegram saymıyor'
  }
}

function SendLine({ send, pending, run }: { send: PostSendRow; pending: boolean; run: Run }) {
  const status = STATUS[send.status]
  const live = send.status === 'sent'
  const remove = async () => {
    if (await askConfirm(`"${send.chatTitle}" sohbetindeki post Telegram’dan silinsin mi? Geri alınamaz.`)) run(() => deleteSendAction(send.id))
  }
  const forget = async () => {
    if (await askConfirm(`"${send.chatTitle}" kaydı listeden kaldırılsın mı? Telegram’daki mesaja dokunulmaz.`)) run(() => forgetSendAction(send.id))
  }
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {send.link && live ? (
          <a href={send.link} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1 text-sm font-semibold text-primary underline">
            <span className="truncate">{send.chatTitle || send.chatId}</span>
            <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="sr-only">(Telegram’da yeni sekmede açılır)</span>
          </a>
        ) : (
          <span className="min-w-0 truncate text-sm font-semibold text-foreground">{send.chatTitle || send.chatId}</span>
        )}
        <span className={cn(badge, status.className)}>{status.label}</span>
        {send.pinned && live && <span className={cn(badge, 'bg-primary/10 text-primary')}>Sabit</span>}
        <span className="text-xs text-muted-foreground">{when(send.sentAt)}</span>
      </div>
      {(send.editedAt || (live && (send.unpinAt || send.deleteAt))) && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {[
            send.editedAt && `Son düzenleme ${when(send.editedAt)}`,
            live && send.unpinAt && `Sabitten kalkacak ${when(send.unpinAt)}`,
            live && send.deleteAt && `Silinecek ${when(send.deleteAt)}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
      {send.error && <p className="text-xs leading-relaxed text-destructive [overflow-wrap:anywhere]">{send.error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {live && (
          <button type="button" className={cn(btnGhost, 'gap-1.5')} disabled={pending} onClick={() => run(() => pinSendAction(send.id, !send.pinned))}>
            {send.pinned ? <PinOff className="size-4" aria-hidden="true" /> : <Pin className="size-4" aria-hidden="true" />}
            {send.pinned ? 'Sabitten kaldır' : 'Sabitle'}
          </button>
        )}
        {live && send.canDelete && (
          <button type="button" className={cn(btnDanger, 'gap-1.5')} disabled={pending} onClick={remove}>
            <Trash2 className="size-4" aria-hidden="true" />
            Telegram’dan sil
          </button>
        )}
        {(!live || !send.canDelete) && (
          <button type="button" className={btnGhost} disabled={pending} onClick={forget}>
            Kaydı listeden kaldır
          </button>
        )}
        {live && !send.canDelete && <span className="text-xs text-muted-foreground">48 saati geçti; bot silemez, düzenleyebilir.</span>}
      </div>
    </li>
  )
}

function EditForm({ post, data, pending, run, onClose }: { post: PostRow; data: PostCenterData; pending: boolean; run: Run; onClose: () => void }) {
  const auto = post.origin !== 'panel'
  const [content, setContent] = useState<PostContent>(post.content)
  const set = partsOf(setContent)
  const live = post.sends.filter((s) => s.status === 'sent')
  const underMedia = live.some((s) => s.textOnMedia)
  const text = auto ? content.text : finalText(content, data.sponsors)
  const problems = postProblems(content, text).filter((p) => !(auto && p.startsWith('Yazı ya da medya')))
  const listens = post.botId != null && data.listening.includes(post.botId)
  const listenHelp = (
    <p role="alert" className="text-xs leading-relaxed text-destructive">
      Bu postu gönderen bot buton basışlarını dinlemiyor; bu buton türü çalışmaz. “Yeni post” sekmesinde o botu seçip “Dinlemeyi aç”a bas.
    </p>
  )

  return (
    <div className="grid gap-4 rounded-lg border border-border bg-background p-3 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        {post.locked ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Bu postun yazısında özel emoji ya da panelin yeniden kuramadığı bir biçim var. Yazı Telegram’da olduğu gibi kalır; buradan sadece butonları değişir.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold text-foreground">Yazı</h4>
            <PostEditor initial={post.content.text} label={`${post.id} numaralı postun yazısı`} onChange={set.text} />
            <Counter length={visibleLength(text)} limit={underMedia ? CAPTION_LIMIT : TEXT_LIMIT} note={underMedia ? 'yazı medyanın altında duruyor' : undefined} />
          </div>
        )}
        {!auto && content.media.length > 0 && (
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold text-foreground">Medya</h4>
            <MediaField media={content.media} update={set.media} library={data.library} fixed />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold text-foreground">Butonlar</h4>
          <ButtonsField rows={content.buttons} update={set.buttons} listens={listens} listenHelp={listenHelp} bots={data.bots} />
          {post.stats.raffle || Object.keys(post.stats.counts).length > 0 ? (
            <p className="text-xs leading-relaxed text-muted-foreground">Oy ya da çekili�� butonunu silersen o butonun sayıları da görünmez olur; yazısını değiştirmek sayıları etkilemez.</p>
          ) : null}
        </div>
        {!auto && (
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold text-foreground">Seçenekler</h4>
            <OptionsField options={content.options} set={set.options} sponsors={data.sponsors} sent />
          </div>
        )}
        {auto && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {`${post.origin === 'manual' ? 'Bu post kanala panel dışından atıldı.' : 'Bu postu bir otomasyon attı.'} ${post.locked ? 'Butonları' : 'Yazısı ve butonları'} değişir; medyası sadece Telegram’da durduğu için burada görünmez ve değişmez.`}
          </p>
        )}
        <Problems items={problems} />
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} disabled={pending || problems.length > 0} onClick={() => run(() => editPostAction(post.id, content), (result) => result.ok && onClose())}>
            {pending ? 'Uygulanıyor…' : `Telegram’daki ${live.length} kopyaya uygula`}
          </button>
          <button type="button" className={btnGhost} disabled={pending} onClick={onClose}>
            Vazgeç
          </button>
        </div>
      </div>
      <PostPreview content={content} text={text} sender={live[0]?.chatTitle || post.botName} counts={post.stats.counts} />
    </div>
  )
}

function CopyForm({ post, data, pending, run, onClose }: { post: PostRow; data: PostCenterData; pending: boolean; run: Run; onClose: () => void }) {
  const [chatIds, setChatIds] = useState<string[]>([])
  const targets = data.targets.filter((t) => t.botId === post.botId)
  const chosen = targets.filter((t) => chatIds.includes(t.chatId))
  const copy = async () => {
    const names = chosen.map((t) => t.title || t.chatId).join(', ')
    if (!(await askConfirm(`Post şu ${chosen.length} hedefe gönderilsin mi: ${names}`))) return
    run(
      () => copyPostAction(post.id, chosen.map((t) => t.chatId)),
      (result) => result.ok && onClose(),
    )
  }
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        {`Post ${post.botName} ile gider. Zaten gittiği bir sohbeti seçersen oraya bir kez daha atılır. Kopya sabitlenmez, zamanlı silme taşımaz.`}
      </p>
      <TargetField targets={targets} selected={chosen.map((t) => t.chatId)} onChange={setChatIds} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} disabled={pending || !chosen.length} onClick={copy}>
          {pending ? 'Gönderiliyor…' : chosen.length ? `${chosen.length} hedefe gönder` : 'Hedef seç'}
        </button>
        <button type="button" className={btnGhost} disabled={pending} onClick={onClose}>
          Vazgeç
        </button>
      </div>
    </div>
  )
}

function PostCard({ post, data, onChanged }: { post: PostRow; data: PostCenterData; onChanged: () => void }) {
  const [mode, setMode] = useState<'edit' | 'copy' | null>(null)
  const { pending, msg, run: start } = useRun()
  const run: Run = (fn, after) =>
    start(fn, (result) => {
      after?.(result)
      if (result.ok) onChanged()
    })

  const live = post.sends.filter((s) => s.status === 'sent')
  const snippet = plainText(post.content.text).trim()
  const telegramMedia = post.content.media.length ? 0 : (post.sends[0]?.mediaCount ?? 0)
  const buttons = post.content.buttons.flat()
  const toggle = (next: 'edit' | 'copy') => setMode(mode === next ? null : next)

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className={cn(badge, post.origin === 'panel' ? 'bg-primary/10 text-primary' : 'bg-muted text-foreground')}>{ORIGIN_LABEL[post.origin]}</span>
        <span className="font-medium text-foreground">{post.botName}</span>
        {post.author && <span>{`gönderen: ${post.author}`}</span>}
        <span>{when(post.createdAt)}</span>
        {post.note && <span className="min-w-0 [overflow-wrap:anywhere]">{post.note}</span>}
      </div>

      {snippet ? (
        <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">{snippet}</p>
      ) : (
        !post.locked && <p className="text-sm text-muted-foreground">Yazısız post</p>
      )}

      {post.content.media.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Postun medyası">
          {post.content.media.map((m, i) => (
            <li key={`${m.path}-${i}`} className="size-16 overflow-hidden rounded-md border border-border">
              <MediaTile item={m} />
            </li>
          ))}
        </ul>
      )}
      {telegramMedia > 0 && <p className="text-xs text-muted-foreground">{`${telegramMedia} medya (Telegram’da duruyor)`}</p>}

      {buttons.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Butonlar ve sayıları">
          {buttons.map((b) => {
            const Icon = BUTTON_ICON[b.kind]
            return (
              <li key={b.id} className="flex min-w-0 items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1 text-xs">
                <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate font-medium text-foreground">{b.label || 'Adsız buton'}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{buttonStat(b, post)}</span>
              </li>
            )
          })}
        </ul>
      )}
      <RafflePanel post={post} pending={pending} run={run} />

      {post.sends.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Gönderildiği sohbetler">
          {post.sends.map((s) => (
            <SendLine key={s.id} send={s} pending={pending} run={run} />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className={cn(btnGhost, 'gap-1.5')} aria-expanded={mode === 'edit'} disabled={pending || !live.length} onClick={() => toggle('edit')}>
          <Pencil className="size-4" aria-hidden="true" />
          Düzenle
        </button>
        <button type="button" className={cn(btnGhost, 'gap-1.5')} aria-expanded={mode === 'copy'} disabled={pending || post.botId == null} onClick={() => toggle('copy')}>
          <Copy className="size-4" aria-hidden="true" />
          Başka hedefe ya da tekrar gönder
        </button>
        {post.origin === 'panel' && (
          <button type="button" className={cn(btnGhost, 'gap-1.5')} disabled={pending} onClick={() => run(() => draftFromPostAction(post.id))}>
            <FilePlus2 className="size-4" aria-hidden="true" />
            Taslağa kopyala
          </button>
        )}
      </div>
      {!live.length && <p className="text-xs text-muted-foreground">Bu postun Telegram’da duran kopyası yok; düzenlenemez.</p>}

      {mode === 'edit' && <EditForm post={post} data={data} pending={pending} run={run} onClose={() => setMode(null)} />}
      {mode === 'copy' && <CopyForm post={post} data={data} pending={pending} run={run} onClose={() => setMode(null)} />}
      <Note msg={msg} />
    </li>
  )
}

export function PostList({ data }: { data: PostCenterData }) {
  const [older, setOlder] = useState<PostRow[]>([])
  const [olderMore, setOlderMore] = useState<boolean | null>(null)
  const [loading, startLoading] = useTransition()

  const firstIds = new Set(data.posts.map((p) => p.id))
  const posts = [...data.posts, ...older.filter((p) => !firstIds.has(p.id))]
  const hasMore = olderMore ?? data.hasMore
  const last = posts[posts.length - 1]
  const firstPageEnd = data.posts[data.posts.length - 1]?.id

  const loadMore = () =>
    startLoading(async () => {
      if (!last) return
      const page = await morePostsAction(last.id)
      setOlder((prev) => [...prev, ...page.posts])
      setOlderMore(page.hasMore)
    })

  /** The first page refreshes itself with the panel; pages loaded on demand are fetched again here. */
  const reloadOlder = () => {
    if (!older.length || !firstPageEnd) return
    startLoading(async () => {
      const fresh: PostRow[] = []
      let cursor = firstPageEnd
      let more = true
      while (more && fresh.length < older.length) {
        const page = await morePostsAction(cursor)
        if (!page.posts.length) break
        fresh.push(...page.posts)
        cursor = page.posts[page.posts.length - 1].id
        more = page.hasMore
      }
      setOlder(fresh)
      setOlderMore(more)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Panelden ve otomasyonlardan (kanal aktarımı, post paylaşım) çıkan postlar burada. Botun dinlediği kanallara telefondan ya da başka araçla atılan postlar da “Panel dışı”
        etiketiyle düşer; bot dinlemeye başlamadan önce atılanlar görünmez. Buton tıklamaları, oylar ve çekiliş katılımı postun altında yazar. Telegram görüntülenme sayısını botlara
        vermez. Bot 48 saatten eski mesajı silemez ama düzenleyebilir.
      </p>
      {posts.length === 0 ? (
        <Card title="Henüz post yok">
          <p className="text-sm leading-relaxed text-muted-foreground">“Yeni post” sekmesinden ilk postunu gönderince burada görünür.</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} data={data} onChanged={reloadOlder} />
          ))}
        </ul>
      )}
      {hasMore && (
        <button type="button" className={cn(btnGhost, 'self-center')} disabled={loading} onClick={loadMore}>
          {loading ? 'Yükleniyor…' : 'Daha eski postları göster'}
        </button>
      )}
    </div>
  )
}
