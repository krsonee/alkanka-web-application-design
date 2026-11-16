// Tek seferlik: panel islem dosyalarina log satirlarini satir numarasiyla ekler. Is bitince silinir.
// ins = o satirin ONUNE ayni girintiyle ekle, rep = o satiri degistir (girinti korunur).
// DRY=1 ile calisinca hicbir sey yazmaz, sadece hedef satirlari gosterir.
import { readFileSync, writeFileSync } from 'node:fs'

const ROOT = '/vercel/share/v0-project/app/panel/'
const DRY = process.env.DRY === '1'
const L = (area, rest) => `await logPanel('${area}', ${rest})`

const spec = {
  'actions.ts': [
    [52, 'ins', L('logo', `'Paylaşım görseli kaydedildi'`)],
    [94, 'ins', L('logo', `'Reklam alanları kaydedildi', null, \`\${Object.keys(value).length} dolu alan\``)],
    [121, 'ins', L('hero', `'Sayfa başlığı kaydedildi', page.path`)],
    [135, 'ins', L('hero', `'Sayfa başlığı varsayılana döndü', page.path`)],
    [157, 'ins', L('texts', `'Site yazıları kaydedildi', null, \`\${Object.keys(value).length} özel metin\``)],
    [204, 'ins', L('slide', `'Slayt kaydedildi', value.title || id`)],
    [209, 'ins', L('slide', `'Slayt kaydedildi', value.title || id`)],
    [227, 'ins', L('slide', `'Slayt eklendi', id`)],
    [248, 'ins', L('logo', `kind === 'sponsors' ? 'Sponsor logoları kaydedildi' : 'Takım logoları kaydedildi', null, \`\${Object.keys(value).length} logo\``)],
    [273, 'ins', L('slide', `'Slayt sırası değişti', id, dir < 0 ? 'öne alındı' : 'arkaya alındı'`)],
    [310, 'ins', L('slide', `'Slayt kopyalandı', copy.title`)],
    [325, 'ins', L('slide', `'Slayt silindi', list.find((s) => s.id === id)?.title ?? id`)],
    [331, 'ins', L('slide', `'Slayt varsayılana döndü', id`)],
    [359, 'ins', L('logo', `'Ana sayfa ve masa açma ayarları kaydedildi'`)],
  ],
  'arena-actions.ts': [
    [87, 'ins', L('games', `'Oyun ayarları kaydedildi', null, \`mini oyun kazanma oranı %\${winRate}\``)],
    [131, 'ins', L('tournaments', `id ? 'Turnuva güncellendi' : 'Turnuva oluşturuldu', input.title, \`giriş \${input.entryFee} KC · ödül \${input.prizePool} KC · \${input.maxPlayers} kişi\``)],
    [142, 'ins', L('tournaments', `'Turnuva silindi', \`Turnuva #\${Number(form.get('id'))}\`, 'Kayıt ücretleri iade edildi'`)],
    [153, 'ins', L('tournaments', `'Turnuva başlatıldı', \`Turnuva #\${Number(form.get('id'))}\``)],
    [164, 'ins', L('tournaments', `'Turnuva iptal edildi', \`Turnuva #\${Number(form.get('id'))}\`, 'Kayıt ücretleri iade edildi'`)],
    [177, 'ins', L('tournaments', `'Maç kazananı girildi', \`Turnuva #\${Number(form.get('id'))}\`, \`tur \${Number(form.get('round'))} · maç \${Number(form.get('match'))} · kazanan \${winner}\``)],
    [188, 'ins', L('tournaments', `'Turnuva katılımcısı çıkarıldı', \`Kayıt #\${Number(form.get('entryId'))}\`, 'Ücreti iade edildi'`)],
    [199, 'ins', L('games', `'Masa kapatıldı', String(form.get('id')), 'Bahisler iade edildi'`)],
  ],
  'ambient-actions.ts': [[20, 'ins', L('growth', `'Masa doluluğu ayarı kaydedildi'`)]],
  'app-settings-actions.ts': [[19, 'ins', L('push', `'Uygulama ödülleri kaydedildi', null, \`kurulum \${value.installBonus} KC · bildirim \${value.pushBonus} KC · ikisi birden +\${value.comboBonus} KC\``)]],
  'avatar-actions.ts': [
    [15, 'ins', L('market', `input.id ? 'Avatar güncellendi' : 'Avatar eklendi', input.name`)],
    [27, 'ins', L('market', `'Avatar silindi', id`)],
  ],
  'boost-actions.ts': [[13, 'ins', L('badges', `'Kampanya ve çarpan ayarları kaydedildi'`)]],
  'branding-actions.ts': [
    [18, 'ins', L('branding', `url ? 'Header logosu kaydedildi' : 'Varsayılan logoya dönüldü'`)],
    [25, 'ins', L('branding', `'Varsayılan uygulama ikonuna dönüldü'`)],
  ],
  'catalog-actions.ts': [
    [18, 'ins', `const KIND_LABEL: Record<string, string> = { events: 'Etkinlikler', predictions: 'Tahminler', campaigns: 'Kampanyalar', bonuses: 'Bonuslar', rewards: 'Mini oyun ödülleri' }`],
    [105, 'ins', L('rewards', `'Mini oyun ödülleri kaydedildi'`)],
    [129, 'ins', L('catalog', `'İçerik listesi kaydedildi', KIND_LABEL[kind] ?? kind, \`\${Array.isArray(items) ? items.length : 0} kayıt\``)],
    [141, 'ins', L('catalog', `'Kategori sıralaması kaydedildi'`)],
    [153, 'ins', `await logPanel(kind === 'rewards' ? 'rewards' : 'catalog', 'Varsayılana döndürüldü', KIND_LABEL[kind] ?? kind)`],
  ],
  'cember-actions.ts': [
    [32, 'ins', L('cember', `'Anlık etkinlik bütçesi değişti', null, budget.dailyKc ? \`günde \${budget.dailyKc} KC\` : 'limit kaldırıldı'`)],
    [46, 'ins', L('cember', `'Sohbet aktivite eşiği değişti', null, budget.chatAlert ? \`saatte \${budget.chatAlert} mesaj\` : 'kapatıldı'`)],
    [69, 'ins', L('cember', `'Anlık etkinlik başlatıldı', r.events.find((e) => e.id === eventId)?.title ?? eventId, \`\${trTime(r.at)} için kuruldu\``)],
    [85, 'ins', L('cember', `'Anlık tur iptal edildi', events.find((e) => e.id === eventId)?.title ?? eventId, trTime(slotIso)`)],
    [107, 'ins', L('cember', `'Jako Çemberi etkinlikleri kaydedildi', null, \`\${events.length} etkinlik\``)],
    [118, 'ins', L('cember', `'Ek tur kuruldu', eventId, time`)],
  ],
  'community-actions.ts': [
    [37, 'rep', [
      `return guard(async () => {`,
      `  const message = await setReviewStatus(id, status)`,
      `  await logPanel('community', status === 'approved' ? 'Yorum yayınlandı' : 'Yorum reddedildi', \`Yorum #\${id}\`)`,
      `  return message`,
      `})`,
    ]],
    [44, 'ins', L('community', `ok ? 'Yorum kanıtı onaylandı' : 'Yorum kanıtı reddedildi', \`Yorum #\${id}\``)],
    [55, 'ins', `if (posted) await logPanel('community', 'Haftalık karne gönderildi', null, \`\${posted} kanal\`)`],
    [62, 'ins', L('community', `'Yorum silindi', \`Yorum #\${id}\``)],
    [69, 'ins', L('community', `'Şikâyet kaldırıldı', \`Şikâyet #\${id}\``)],
    [74, 'rep', [
      `return guard(async () => {`,
      `  const message = await updateComplaint(id, status, reply)`,
      `  await logPanel('community', 'Şikâyet yanıtlandı', \`Şikâyet #\${id}\`, \`\${status}\${reply ? \` · \${String(reply).slice(0, 200)}\` : ''}\`)`,
      `  return message`,
      `})`,
    ]],
    [78, 'rep', [
      `return guard(async () => {`,
      `  const message = await addLeagueMatch(input)`,
      `  await logPanel('community', 'Tahmin maçı eklendi', \`\${input.home} - \${input.away}\`, input.league)`,
      `  return message`,
      `})`,
    ]],
    [91, 'ins', `if (added) await logPanel('community', 'Fikstür maçları yayınlandı', null, \`\${added} maç\`)`],
    [98, 'ins', `if (r.settled) await logPanel('community', 'Maçlar otomatik sonuçlandırıldı', null, \`\${r.settled} maç\`)`],
    [103, 'rep', [
      `return guard(async () => {`,
      `  const message = await deleteLeagueMatch(id)`,
      `  await logPanel('community', 'Tahmin maçı silindi', \`Maç #\${id}\`)`,
      `  return message`,
      `})`,
    ]],
    [109, 'ins', L('community', `'Maç sonucu girildi ve puanlandı', \`Maç #\${id}\`, \`\${home}-\${away} · \${r.picks} tahmin · \${r.winners} kazanan\``)],
  ],
  'faq-actions.ts': [[15, 'ins', L('faqs', `input.id ? 'Soru güncellendi' : 'Soru eklendi', input.question`)]],
  'growth-actions.ts': [
    [24, 'ins', `if (changed) await logPanel('growth', 'Sponsor giriş adresi değişti', siteId, \`\${url}\${notify ? ' · üyelere bildirildi' : ''}\`)`],
    [38, 'ins', L('growth', `input.id ? 'Affiliate link güncellendi' : 'Affiliate link eklendi', r.code`)],
    [48, 'ins', L('growth', `active ? 'Affiliate link açıldı' : 'Affiliate link durduruldu', \`Link #\${id}\``)],
    [55, 'ins', L('growth', `'Affiliate link silindi', \`Link #\${id}\``)],
    [75, 'ins', L('growth', `flagged ? 'Üye şüpheli işaretlendi' : 'Şüpheli işareti kaldırıldı', await memberTag(userId)`)],
    [83, 'ins', L('growth', `approve ? 'Sponsor hesabı onaylandı' : 'Sponsor hesabı reddedildi', await memberTag(userId), \`sponsor \${siteId}\${note ? \` · \${note}\` : ''}\``)],
    [93, 'ins', L('growth', `'Çevrim verisi yüklendi', \`Sponsor \${siteId}\`, \`\${period} · \${r.rows} satır · \${r.matched} eşleşme\``)],
  ],
  'inbox-actions.ts': [
    [38, 'ins', L('messages', `userId ? 'Üyeye mesaj gönderildi' : 'Tüm üyelere mesaj gönderildi', userId ? targetLabel : null, title`)],
    [49, 'ins', L('messages', `'Mesaj silindi', \`Mesaj #\${id}\``)],
  ],
  'kp-actions.ts': [
    [34, 'ins', L('badges', `'Kazananlar şeridi kaydedildi'`)],
    [56, 'ins', L('badges', `'Seviyeler kaydedildi', null, \`\${levels.length} seviye\``)],
    [63, 'ins', L('badges', `'Puan kuralları kaydedildi'`)],
    [70, 'ins', L('badges', `cfg.enabled ? 'Haftalık görev yayına alındı' : 'Haftalık görev kapatıldı'`)],
    [78, 'ins', L('badges', `'Online ödülleri kaydedildi'`)],
    [85, 'ins', L('badges', `'Rozet kaydedildi', input.name`)],
    [92, 'ins', L('badges', `'Rozet silindi', id`)],
    [107, 'ins', `if (ok) await logPanel('badges', 'Rozet verildi', await memberTag(userId), \`\${badgeId}\${note ? \` · \${note}\` : ''}\`)`],
    [112, 'rep', [
      `return guard(async () => {`,
      `  const message = await awardContest(badgeId)`,
      `  await logPanel('badges', 'Yarışma rozeti dağıtıldı', badgeId, typeof message === 'string' ? message : null)`,
      `  return message`,
      `})`,
    ]],
    [120, 'ins', L('badges', `'Rozet geri alındı', badgeId ?? \`Kayıt #\${awardId}\``)],
    [127, 'ins', L('badges', `points > 0 ? 'Kanka puanı eklendi' : 'Kanka puanı düşüldü', await memberTag(userId), \`\${points} KP · \${note}\``)],
  ],
  'legal-actions.ts': [[24, 'ins', L('texts', `'Yasal metinler kaydedildi', null, \`\${Object.keys(value).length} sayfa özelleştirildi\``)]],
  'limits-actions.ts': [
    [21, 'ins', L('limits', `'Gizli kısıtlama kaydedildi', await memberTag(userId)`)],
    [31, 'ins', L('limits', `'Gizli kısıtlama kaldırıldı', await memberTag(userId)`)],
  ],
  'market-actions.ts': [
    [24, 'ins', L('market', `input.id ? 'Ürün güncellendi' : 'Ürün eklendi', input.name`)],
    [31, 'ins', L('market', `'Ürün silindi', id`)],
    [38, 'ins', L('market', `approve ? 'Market talebi onaylandı' : 'Market talebi reddedildi', \`Talep #\${id}\`, note || null`)],
  ],
  'marketing-actions.ts': [
    [20, 'rep', `async function run(fn: () => Promise<unknown>, success: string, log: [action: string, target?: string | null, detail?: string | null], layout = false): Promise<Result> {`],
    [24, 'ins', `await logPanel('marketing', ...log)`],
    [33, 'rep', `return run(() => saveTracking(input), 'Etiketler kaydedildi. Sitede birkaç dakika içinde çalışmaya başlar.', ['Ölçüm etiketleri kaydedildi'], true)`],
    [37, 'rep', `return run(() => saveCampaign(input), input.id ? 'Kampanya güncellendi.' : 'Kampanya linki oluşturuldu.', [input.id ? 'Kampanya güncellendi' : 'Kampanya linki oluşturuldu', input.name || input.code, \`kod \${input.code} · maliyet \${input.cost}\`])`],
    [41, 'rep', `return run(() => deleteCampaign(id), 'Kampanya silindi.', ['Kampanya silindi', \`Kampanya #\${id}\`])`],
    [45, 'rep', `return run(() => saveEarning(input), input.id ? 'Hakediş güncellendi.' : 'Hakediş kaydı eklendi.', [input.id ? 'Hakediş güncellendi' : 'Hakediş eklendi', \`Sponsor \${input.siteId} · \${input.period}\`, \`\${input.amount} \${input.currency}\`])`],
    [49, 'rep', `return run(() => setEarningStatus(id, status), 'Durum güncellendi.', ['Hakediş durumu değişti', \`Hakediş #\${id}\`, status])`],
    [53, 'rep', `return run(() => deleteEarning(id), 'Kayıt silindi.', ['Hakediş silindi', \`Hakediş #\${id}\`])`],
  ],
  'members-actions.ts': [[64, 'rep', `await logAudit('Üye listesi dışa aktarıldı', null, \`\${r.count} üye dışa aktarıldı\`)`]],
  'mobile-actions.ts': [[40, 'ins', L('push', `'Seçili kitleye bildirim gönderildi', title, \`\${input.segment} · \${ids.length} üye · \${sent} cihaz\${failed ? \` · \${failed} başarısız\` : ''}\``)]],
  'push-actions.ts': [[18, 'ins', L('push', `'Tüm cihazlara bildirim gönderildi', title, \`\${r.sent} cihaz\${r.failed ? \` · \${r.failed} başarısız\` : ''}\``)]],
  'raffle-actions.ts': [[14, 'ins', L('badges', `'Rozet çekilişi yapıldı', badgeId, \`ödül \${prize} KP\``)]],
  'referral-actions.ts': [[21, 'ins', L('growth', `'Davet ödülleri kaydedildi'`)]],
  'seo-actions.ts': [
    [24, 'ins', L('seo', `'Yönlendirme kaydedildi', from, to`)],
    [35, 'ins', L('seo', `'Yönlendirme silindi', from`)],
    [43, 'ins', L('seo', `'404 kaydı silindi', path`)],
    [71, 'ins', L('seo', `'Rehber yazısı kaydedildi', title, \`/rehber/\${slug}\``)],
    [82, 'ins', L('seo', `'Rehber yazısı silindi', \`Yazı #\${id}\``)],
    [89, 'ins', L('seo', `'Fırsat silindi', \`Fırsat #\${id}\``)],
    [96, 'ins', L('seo', `on ? 'Fırsat yayını açıldı' : 'Fırsat yayını kapatıldı'`)],
    [110, 'ins', L('seo', `'Site başlığı ve açıklaması kaydedildi'`)],
    [127, 'ins', L('seo', `'Arama motoru doğrulama kodları kaydedildi'`)],
  ],
  'site-actions.ts': [[17, 'ins', L('sponsors', `input.id ? 'Sponsor güncellendi' : 'Sponsor eklendi', input.name`)]],
  'social-actions.ts': [
    [37, 'ins', L('social', `'Sosyal medya hesapları kaydedildi'`)],
    [49, 'ins', L('social', `'Sosyal doğrulama bağlantısı kaydedildi', PLATFORM_LABEL[platform]`)],
    [61, 'ins', L('social', `'Sosyal doğrulama bağlantısı kaldırıldı', PLATFORM_LABEL[platform]`)],
    [71, 'ins', L('social', `approve ? 'Sosyal hesap doğrulandı' : 'Sosyal hesap reddedildi', await memberTag(userId), \`\${platform}\${note ? \` · \${note}\` : ''}\``)],
    [79, 'ins', L('social', `'Sosyal etkinlik açıldı', input.title, \`\${input.platform} · \${input.reward} KP\``)],
    [89, 'ins', L('social', `active ? 'Sosyal etkinlik açıldı' : 'Sosyal etkinlik kapatıldı', \`Etkinlik #\${id}\``)],
    [96, 'ins', L('social', `'Sosyal etkinlik silindi', \`Etkinlik #\${id}\``)],
    [104, 'ins', L('social', `approve ? 'Etkinlik katılımı onaylandı' : 'Etkinlik katılımı reddedildi', await memberTag(userId), \`Etkinlik #\${eventId}\${note ? \` · \${note}\` : ''}\``)],
  ],
  'studio-actions.ts': [
    [49, 'ins', L('studio', `'Marka kiti kaydedildi', input.name`)],
    [56, 'ins', L('studio', `'Marka kiti silindi', \`Marka #\${id}\``)],
    [63, 'ins', L('studio', `'Stüdyo görseli silindi', \`Görsel #\${id}\``)],
    [70, 'ins', L('studio', `'Stüdyo üretim kaydı silindi', \`Üretim #\${id}\``)],
  ],
  'task-actions.ts': [
    [19, 'ins', L('tasks', `input.id ? 'Görev güncellendi' : 'Görev eklendi', input.title, \`\${input.points} KP\``)],
    [29, 'ins', L('tasks', `'Görev talebi onaylandı', \`Talep #\${claimId}\``)],
    [39, 'ins', L('tasks', `'Görev talebi reddedildi', \`Talep #\${claimId}\``)],
  ],
  'theme-actions.ts': [[14, 'ins', L('market', `'Masa teması satış ayarı kaydedildi', input.id, \`\${input.price} KC · en az seviye \${input.minLevel}\${input.active ? '' : ' · kapalı'}\``)]],
  'tour-actions.ts': [
    [26, 'ins', L('tour', `'Site turu ayarları kaydedildi', null, \`bitirme ödülü \${saved.reward} KC\``)],
    [36, 'ins', L('tour', `'Tur ödül engeli kaldırıldı', await memberTag(userId)`)],
  ],
  'visibility-actions.ts': [
    [86, 'ins', `await logPanel(module, visible ? 'Sitede gösterildi' : 'Siteden gizlendi', \`\${KIND_LABEL[kind]} · \${id}\`)`],
    [41, 'ins', [
      `const KIND_LABEL: Record<VisibilityKind, string> = {`,
      `  sponsor: 'Sponsor', task: 'Görev', faq: 'SSS', market: 'Market ürünü', badge: 'Rozet', social: 'Sosyal etkinlik', arena: 'Oyun',`,
      `  slide: 'Slayt', mini: 'Mini oyun', event: 'Etkinlik', prediction: 'Tahmin', campaign: 'Kampanya', bonus: 'Bonus', tournament: 'Turnuva',`,
      `}`,
      ``,
    ]],
  ],
  'withdraw-actions.ts': [
    [32, 'rep', [
      `return guard(async () => {`,
      `  const message = await approveWithdrawal(id, reward)`,
      `  await logPanel('community', 'Çekim paylaşımı onaylandı', \`Paylaşım #\${id}\`, \`\${reward.coin} KC · \${reward.kp} KP\${reward.item ? \` · \${reward.item}\` : ''}\`)`,
      `  return message`,
      `})`,
    ]],
    [38, 'ins', L('community', `'Çekim paylaşımı reddedildi', \`Paylaşım #\${id}\`, note || null`)],
    [45, 'ins', L('community', `'Çekim paylaşımı sahte işaretlendi', \`Paylaşım #\${id}\`, 'Üye paylaşımdan engellendi'`)],
    [52, 'ins', L('community', `'Çekim paylaşımı silindi', \`Paylaşım #\${id}\``)],
    [59, 'ins', L('community', `'Paylaşım engeli kaldırıldı', await memberTag(userId)`)],
    [66, 'ins', L('community', `'Çekim paylaşımı ayarları kaydedildi'`)],
    [73, 'ins', L('community', `reward ? 'Site çekim ödülü kaydedildi' : 'Site çekim ödülü varsayılana döndü', \`Sponsor \${siteId}\``)],
  ],
}

let total = 0
for (const [file, ops] of Object.entries(spec)) {
  const path = ROOT + file
  const lines = readFileSync(path, 'utf8').split('\n')
  if (lines.some((l) => l.includes("from '@/lib/panel-log'"))) {
    console.log('atlandi (zaten islenmis):', file)
    continue
  }
  if (DRY) {
    console.log(`\n=== ${file}`)
    for (const [line, kind] of [...ops].sort((a, b) => a[0] - b[0])) {
      const show = (n) => `${String(n).padStart(4)} ${(lines[n - 1] ?? '<<YOK>>').slice(0, 150)}`
      console.log(`${kind} ${kind === 'ins' ? `${show(line - 1)}\n    ${show(line)}` : show(line)}`)
    }
    continue
  }
  const uses = JSON.stringify(ops)
  for (const [line, kind, code] of [...ops].sort((a, b) => b[0] - a[0])) {
    const at = line - 1
    const indent = /^\s*/.exec(lines[at])[0]
    const block = (Array.isArray(code) ? code : [code]).map((c) => (c ? indent + c : ''))
    if (kind === 'ins') lines.splice(at, 0, ...block)
    else lines.splice(at, 1, ...block)
    total++
  }
  if (file !== 'members-actions.ts') {
    const names = ['logPanel', uses.includes('memberTag(') ? 'memberTag' : null].filter(Boolean).join(', ')
    const firstImport = lines.findIndex((l) => l.startsWith('import '))
    lines.splice(firstImport, 0, `import { ${names} } from '@/lib/panel-log'`)
  }
  writeFileSync(path, lines.join('\n'))
}
console.log(DRY ? '\nkuru calisma bitti' : `uygulanan: ${total}`)
