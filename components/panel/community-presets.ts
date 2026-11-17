import type { Complaint } from '@/lib/community'

export const REVIEW_REJECT_REASONS = [
  'Yorumda küfür ya da hakaret var',
  'Yorum reklam ya da başka siteye yönlendirme içeriyor',
  'İddia kanıtsız; ekran görüntüsüyle şikâyet olarak gönderebilirsin',
  'Yorum bu siteyle ilgili değil',
]

/** A ready reply also sets the status it belongs to; nothing is saved until "Kaydet". */
export const COMPLAINT_REPLIES: { label: string; status: Complaint['status']; text: string }[] = [
  {
    label: 'Bilgi iste',
    status: 'open',
    text: 'Şikâyetini aldık. İnceleyebilmemiz için sitedeki kullanıcı adını ve işlemin tarihini destek hattımıza yazar mısın?',
  },
  {
    label: 'Siteye iletildi',
    status: 'forwarded',
    text: 'Şikâyetini siteye ilettik. Cevap gelince buraya yazacağız.',
  },
  {
    label: 'Çözüldü',
    status: 'resolved',
    text: 'Site ile görüştük, sorun çözüldü. Hâlâ sorun yaşıyorsan destek hattımıza yaz.',
  },
  {
    label: 'Ödeme yapıldı',
    status: 'resolved',
    text: 'Site ödemenin yapıldığını bildirdi. Hesabını kontrol et; ulaşmadıysa destek hattımıza yaz.',
  },
  {
    label: 'Kural ihlali yok',
    status: 'rejected',
    text: 'İncelememizde sitenin kendi kurallarına aykırı bir işlem göremedik, bu yüzden şikâyeti kapatıyoruz. Yeni bir kanıtın olursa tekrar yazabilirsin.',
  },
]
