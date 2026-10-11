import { BookOpen, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

type Step = { title: string; body: ReactNode }

const code = 'rounded bg-background px-1.5 py-0.5 font-mono text-xs text-foreground'

function steps(cronUrl: string): Step[] {
  return [
    {
      title: 'Telegram hesabı ve kendi kanalını aç',
      body: (
        <ol className="flex list-decimal flex-col gap-1.5 pl-5">
          <li>Telefonuna Telegram’ı kur ve numaranla hesap aç.</li>
          <li>
            Sol üst menü → <b>Yeni Kanal</b> → kanal adını ve açıklamasını yaz.
          </li>
          <li>
            Kanal türünü <b>Herkese açık</b> seç ve bir kullanıcı adı belirle (ör. <span className={code}>@alkankaresmi</span>). Gizli kanal da olur, sadece sonraki adımda ID gerekir.
          </li>
          <li>İstediğin kadar kanal açabilirsin. Hepsini aşağıda ayrı ayrı bağlayabilirsin.</li>
        </ol>
      ),
    },
    {
      title: 'BotFather ile bot oluştur ve token al',
      body: (
        <ol className="flex list-decimal flex-col gap-1.5 pl-5">
          <li>
            Telegram aramasına <span className={code}>@BotFather</span> yaz. Mavi tikli resmi hesabı aç ve <b>Başlat</b>’a bas.
          </li>
          <li>
            <span className={code}>/newbot</span> yaz ve gönder.
          </li>
          <li>Botun görünen adını yaz (ör. AL KANKA Duyuru).</li>
          <li>
            Kullanıcı adını yaz. Sonu mutlaka <span className={code}>bot</span> ile bitmeli (ör. <span className={code}>alkanka_duyuru_bot</span>).
          </li>
          <li>
            BotFather sana <span className={code}>123456789:AAH...</span> şeklinde bir <b>token</b> verir. Bu kod botun şifresidir. Kimseyle paylaşma, sadece bu panele yapıştır.
          </li>
          <li>Birden fazla bot açabilirsin. Her kanal için ayrı bot kullanmak zorunda değilsin, tek bot birçok kanala paylaşabilir.</li>
        </ol>
      ),
    },
    {
      title: 'Botu kanalına yönetici yap',
      body: (
        <ol className="flex list-decimal flex-col gap-1.5 pl-5">
          <li>Kendi kanalını aç → kanal adına dokun → <b>Yöneticiler</b> (Administrators).</li>
          <li>
            <b>Yönetici ekle</b> → botunun kullanıcı adını ara (ör. <span className={code}>@alkanka_duyuru_bot</span>) → seç.
          </li>
          <li>
            <b>Mesaj gönder</b> (Post messages) yetkisinin açık olduğundan emin ol. Diğer yetkileri kapatabilirsin.
          </li>
          <li>
            Kaydet. Bot artık kanalında post atabilir. Bu adımı paylaşım yapacağın <b>her kanal</b> için tekrarla.
          </li>
        </ol>
      ),
    },
    {
      title: 'Botu bu panele bağla',
      body: (
        <ol className="flex list-decimal flex-col gap-1.5 pl-5">
          <li>
            Aşağıdaki <b>Bot ekle</b> kutusuna token’ı yapıştır ve <b>Bağla</b>’ya bas.
          </li>
          <li>Panel token’ı Telegram’a sorar. Doğruysa botun adı listede görünür. Token şifrelenerek saklanır ve bir daha tam hali gösterilmez.</li>
          <li>Token’ı yanlışlıkla paylaştıysan BotFather’da <span className={code}>/revoke</span> ile yenile, eski botu panelden silip yeni token’la tekrar ekle.</li>
        </ol>
      ),
    },
    {
      title: 'Hedef kanalı ekle ve test et',
      body: (
        <ol className="flex list-decimal flex-col gap-1.5 pl-5">
          <li>
            Bot kartındaki <b>Hedef kanal ekle</b> alanına kanalının kullanıcı adını yaz (ör. <span className={code}>@alkankaresmi</span>).
          </li>
          <li>
            Gizli kanal kullanıyorsan kanaldan bir postu <span className={code}>@userinfobot</span> botuna ilet. Gelen cevaptaki <span className={code}>-100</span> ile başlayan sayıyı yaz.
          </li>
          <li>Panel botun o kanalda yönetici olup olmadığını kontrol eder. Değilse hata mesajı neyin eksik olduğunu söyler.</li>
          <li>
            Bağlandıktan sonra <b>Test</b>’e bas. Kanalına “AL KANKA bot bağlantısı çalışıyor.” mesajı gelmeli.
          </li>
        </ol>
      ),
    },
    {
      title: 'Resmi marka kanallarını kaynak olarak ekle',
      body: (
        <ol className="flex list-decimal flex-col gap-1.5 pl-5">
          <li>
            Markanın <b>resmi</b> Telegram kanal adını yaz. Kanal herkese açık olmalı: tarayıcıda <span className={code}>t.me/s/kanaladi</span> açılıyorsa uygun.
          </li>
          <li>Marka adını ve senin giriş linkini yaz. Posttaki tüm linkler bu linke çevrilir, altına da “giriş ve bonus için tıkla” butonu eklenir.</li>
          <li>
            Sadece promo postlarını almak istiyorsan filtreye <span className={code}>promo, kod, bonus, freespin</span> gibi kelimeler yaz. Boş bırakırsan tüm yeni postlar gelir.
          </li>
          <li>
            <b>Hangi kanala</b> seçeneğinden tek bir kanal seçebilir ya da <b>Tüm kanallar</b> diyerek her bağlı kanala aynı anda paylaşabilirsin.
          </li>
          <li>İlk kontrolde eski postlar paylaşılmaz. Sadece eklemeden sonra gelen yeni postlar gider. Aynı post asla iki kez paylaşılmaz.</li>
        </ol>
      ),
    },
    {
      title: 'Otomatik kontrolü aç (dakikada bir)',
      body: (
        <ol className="flex list-decimal flex-col gap-1.5 pl-5">
          <li>
            Ücretsiz <b>cron-job.org</b> sitesine üye ol ve <b>Create cronjob</b>’a bas.
          </li>
          <li>
            URL alanına şu adresi yapıştır:
            <code className="mt-1 block break-all rounded-lg bg-background p-2 font-mono text-xs text-foreground">{cronUrl}</code>
          </li>
          <li>
            Zamanlamayı <b>Every 1 minute</b> (her dakika) seç ve kaydet.
          </li>
          <li>Bu adres gizli anahtar içerir, kimseyle paylaşma. Paylaştıysan aşağıdan <b>Anahtarı yenile</b>’ye bas ve cron-job.org’daki adresi güncelle.</li>
          <li>
            Beklemeden denemek için her zaman <b>Şimdi kontrol et</b> butonunu kullanabilirsin.
          </li>
        </ol>
      ),
    },
    {
      title: 'Sorun giderme',
      body: (
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>
            <b>Bot token geçersiz:</b> Token’ı eksik kopyalamış olabilirsin. BotFather’da <span className={code}>/mybots</span> → bot → API Token’dan tekrar kopyala.
          </li>
          <li>
            <b>Bot kanalda yönetici değil:</b> 3. adımı tekrar yap ve “Mesaj gönder” yetkisini aç.
          </li>
          <li>
            <b>Kanal herkese açık değil:</b> Kaynak kanal gizli. Sadece herkese açık resmi kanallar okunabilir.
          </li>
          <li>
            <b>Video gelmedi:</b> Telegram 20 MB üstü videoları linkten kabul etmiyor. Bu durumda post metin olarak paylaşılır.
          </li>
          <li>
            <b>Hiç post gelmiyor:</b> Filtre kelimelerini kontrol et ve “Son hareketler” listesine bak. Atlanan postlar orada nedeniyle yazar.
          </li>
        </ul>
      ),
    },
  ]
}

export function TelegramGuide({ cronUrl, open }: { cronUrl: string; open: boolean }) {
  return (
    <details open={open} className="group rounded-2xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <BookOpen className="size-5 text-primary" aria-hidden />
          <span className="flex flex-col">
            <span className="font-display text-lg font-bold uppercase text-foreground">Kurulum rehberi</span>
            <span className="text-xs text-muted-foreground">Telegram hesabını, botunu ve kanallarını adım adım bağla</span>
          </span>
        </span>
        <ChevronDown className="size-5 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ol className="flex flex-col gap-2 px-5 pb-5">
        {steps(cronUrl).map((step, i) => (
          <li key={step.title}>
            <details className="group/step rounded-xl bg-secondary">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                <span className="flex-1 text-sm font-semibold text-foreground">{step.title}</span>
                <ChevronDown className="size-4 text-muted-foreground transition-transform group-open/step:rotate-180" aria-hidden />
              </summary>
              <div className="px-3 pb-4 pl-13 text-sm leading-relaxed text-foreground">{step.body}</div>
            </details>
          </li>
        ))}
      </ol>
    </details>
  )
}
