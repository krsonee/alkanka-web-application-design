import type { PreparedUpdate } from './types'

const BEFORE_FAQ = '## Sıkça sorulan sorular'

export const PREPARED_UPDATES: PreparedUpdate[] = [
  {
    kind: 'update',
    slug: 'blackjack-nasil-oynanir-kurallar',
    title: 'Blackjack Nasıl Oynanır? 21 Kuralları ve Temel Strateji',
    note: 'Yazı 359 kelimeydi. Yumuşak el, bölme, ikiye katlama, sigorta ve örnek eller bölümleri eklenir.',
    before: BEFORE_FAQ,
    marker: '## Yumuşak el ve sert el',
    sections: `## Yumuşak el ve sert el

Blackjack stratejisinin yarısı elinde as olup olmadığına bakar.

- **Sert el:** İçinde as olmayan ya da ası 1 saymak zorunda kaldığın eldir. Örneğin 10 ve 6 sert 16'dır. Bir kart daha çekersen batabilirsin.
- **Yumuşak el:** İçinde 11 sayılan bir as olan eldir. Örneğin as ve 6 yumuşak 17'dir. Bir kart çekip batman mümkün değildir, çünkü gelen kart büyükse as 1 sayılır.

Bu fark kararını değiştirir. Sert 17'de her zaman durulur. Yumuşak 17'de ise kart çekmek daha iyidir, çünkü elin kötüleşme riski düşük, iyileşme ihtimali yüksektir.

Yumuşak eller için kısa kurallar:

- **Yumuşak 13-17:** Kart çek. Krupiyenin açık kartı 5 ya da 6 ise ikiye katlamak daha kazançlıdır.
- **Yumuşak 18:** Krupiyenin kartı 2-8 arasındaysa dur, 9, 10 ya da as ise kart çek.
- **Yumuşak 19 ve üstü:** Her zaman dur.

## Hangi çiftler bölünür?

İlk iki kartın aynıysa bölme hakkın olur. Bölünce ikinci ele de bahis koyarsın, yani riskin iki katına çıkar. Bu yüzden her çift bölünmez.

- **İki as:** Her zaman böl. Tek başına 12 zayıf bir eldir, iki ayrı as ise iki güçlü başlangıçtır.
- **İki 8:** Her zaman böl. 16 masanın en kötü elidir, iki tane 8 ise iki ayrı 18 şansıdır.
- **İki 9:** Krupiyenin kartı 7, 10 ya da as değilse böl. Bu üç kartta 18 ile durmak yeterlidir.
- **İki 7, iki 6, iki 3, iki 2:** Krupiyenin kartı 2-6 arasındaysa böl, yüksekse kart çek.
- **İki 5:** Bölme. Elinde 10 var, ikiye katlamak daha iyidir.
- **İki 10 (ya da resimli kart):** Bölme. 20 neredeyse her eli kazanır.

## İkiye katlama ne zaman yapılır?

İkiye katladığında bahsin iki katına çıkar ve sadece bir kart alırsın. Bu hamle, senin elin güçlü ve krupiyenin eli zayıfken yapılır.

1. Elin **11** ise krupiyenin kartı as olmadığı sürece katla.
2. Elin **10** ise krupiyenin kartı 2-9 arasındaysa katla.
3. Elin **9** ise krupiyenin kartı 3-6 arasındaysa katla.

Bunların dışında ikiye katlamak çoğu zaman bahsi boşa büyütmektir.

## Sigorta nedir, alınır mı?

Krupiyenin açık kartı as olduğunda bazı masalarda **sigorta** teklif edilir. Sigorta, krupiyenin kapalı kartının 10 değerinde çıkacağına oynanan ayrı bir yan bahistir. Matematiksel olarak oyuncunun aleyhinedir: uzun vadede sigorta alan oyuncu almayan oyuncudan daha çok kaybeder. Temel strateji sigortayı her zaman reddeder.

## Örnek eller

**Örnek 1:** Elinde 10 ve 6 var, krupiyenin açık kartı 5. Sert 16 kötü bir eldir ama krupiye de zayıf karttadır ve 17'ye kadar çekmek zorundadır. Dur ve krupiyenin batmasını bekle.

**Örnek 2:** Elinde 10 ve 6 var, krupiyenin açık kartı 10. Bu sefer krupiye güçlü. Durursan büyük ihtimalle kaybedersin, o yüzden kart çek.

**Örnek 3:** Elinde as ve 7 var, krupiyenin açık kartı 9. Yumuşak 18 iyi görünür ama krupiyenin 19 yapma ihtimali yüksektir. Kart çek; batma riskin yok.

**Örnek 4:** Elinde 6 ve 5 var, krupiyenin açık kartı 4. Elin 11, krupiye zayıf. İkiye katla.`,
  },
  {
    kind: 'update',
    slug: 'tavla-terimleri-sozlugu',
    title: 'Tavla Terimleri Sözlüğü: Mars, Kapı, Pul, Hane ve Daha Fazlası',
    note: 'Yazı 359 kelimeydi. Bütün zar isimleri, masada sık duyulan sözler ve terimlerle anlatılan örnek bir oyun eklenir.',
    before: BEFORE_FAQ,
    marker: '## Bütün zar isimleri',
    sections: `## Bütün zar isimleri

Tavlada 21 farklı zar gelebilir ve her birinin bir adı vardır. Büyük sayı önce söylenir. Söylenişler yöreden yöreye biraz değişir, ama aşağıdaki isimler her masada anlaşılır.

Altılı zarlar:

- **Şeş-yek:** 6-1
- **Şeş-dü:** 6-2
- **Şeş-se:** 6-3
- **Şeş-cehar:** 6-4
- **Şeş-beş:** 6-5

Beşli zarlar:

- **Penc-ü yek:** 5-1
- **Penc-ü dü:** 5-2
- **Penc-ü se:** 5-3
- **Penc-ü cehar:** 5-4

Dörtlü zarlar:

- **Cehar-ı yek:** 4-1
- **Cehar-ı dü:** 4-2
- **Cehar-ı se:** 4-3

Küçük zarlar:

- **Se-yek:** 3-1
- **Se-ba-dü:** 3-2
- **Dü-yek (iki-bir):** 2-1

Çift zarlar yukarıdaki listede sayılır: hepyek, dubara, dü se, dört cehar, dübeş ve düşeş.

## Masada sık duyulan sözler

- **Gele:** Zar atıp hiçbir hamle yapamamaktır. Kırık pulun varken rakibin evindeki kapılara denk gelen zar atarsan gele olursun ve sıra rakibe geçer.
- **Açık vermek:** Bir pulu tek başına bırakmaktır. Rakip o haneye gelebilecek bir zar atarsa pulun kırılır.
- **Kapı almak:** Aynı haneye ikinci pulu getirip orayı güvene almaktır.
- **Beş kapı, altı kapı:** Arka arkaya kurulan kapıların sayısıdır. Altı kapı kuran oyuncunun arkasında kalan rakip pul hiçbir zarla geçemez.
- **Pul kaçırmak:** Rakibin evinde kalan pulu güvenli bir haneye taşımaktır.
- **Zar tutmak:** Bir oyuncunun istediği zarı attığını söylemek için kullanılan şakayla karışık sözdür. Online tavlada zarı sistem atar, yani zar tutulamaz.
- **Hamle:** Bir zarla yapılan tek pul hareketidir. Normal zarda iki, çift zarda dört hamle yapılır.
- **El:** Baştan sona oynanan tek bir oyundur. Maçlar genellikle 3 ya da 5 puana oynanır.
- **Kırık yemek:** Pulunun kırılmasıdır. Kırık yiyen oyuncu önce o pulu oyuna sokmak zorundadır.
- **Giriş hanesi:** Kırık pulun oyuna döndüğü hanedir. Rakibin evindeki altı haneden biridir ve attığın zara göre belirlenir; o hanede kapı varsa pul giremez.
- **Mars etmek:** Rakibi hiç pul toplatmadan yenmektir. "Mars oldum" diyen oyuncu ise o eli iki puanla kaybetmiştir.
- **Pul bindirmek:** Kapı olan bir haneye üçüncü, dördüncü pulu getirmektir. Güvenlidir ama fazlası pulları boşa harcar.
- **Büyük atmak:** Altılı ve beşli zarlar atmaktır. Yarış bölümünde büyük atan öne geçer.

## Terimlerle örnek bir oyun

Sözlüğü ezberlemek yerine bir oyunun nasıl anlatıldığına bak:

1. İlk zar **se-yek** geldi. Oyuncu evinde bir **kapı aldı**.
2. Rakip **şeş-beş** attı ve arkadaki pulunu **kaçırdı**.
3. Oyuncu **penc-ü dü** attı, bir pulunu **açık verdi**.
4. Rakip tam o haneye gelen zarı attı ve pulu **kırdı**. Pul **bara** gitti.
5. Oyuncu kırık pulunu sokmak için zar attı ama rakibin evindeki **kapılara** denk geldi: **gele**.
6. Rakip bu arada **beş kapı** kurdu, sonra evini tamamen **kapattı**.
7. Rakip pullarını **toplamaya** başladı. Oyuncu hiç pul toplayamadan oyun bitti: **mars**.

Bu yedi satırda sözlüğün neredeyse yarısı geçti. Masada birkaç el oynadıktan sonra bu kelimeler kendiliğinden yerine oturur.`,
  },
  {
    kind: 'update',
    slug: 'kafa-topu-nasil-oynanir',
    title: 'Kafa Topu Online Nasıl Oynanır? Kafa Topu Gol Taktikleri',
    note: 'Yazı 459 kelimeydi. Yeni başlayan hataları, skora göre oyun planı, telefonda oynama ipuçları ve kısa bir alıştırma planı eklenir.',
    before: BEFORE_FAQ,
    marker: '## Yeni başlayanların en sık yaptığı hatalar',
    sections: `## Yeni başlayanların en sık yaptığı hatalar

1. **Sürekli zıplamak.** Havadayken yön değiştiremezsin. Gereksiz her zıplama, topun yere düştüğü anda seni oyun dışı bırakır. Top sana doğru gelmiyorsa yerde kal.
2. **Topun peşinden koşmak.** Topun şu an olduğu yere değil, düşeceği yere git. Top havadayken bir an dur, nereye ineceğine bak, sonra hareket et.
3. **Her topa şut çekmek.** Şut alçak toplarda işe yarar. Yüksek topa şut tuşuyla girersen ıskalarsın, top arkana düşer.
4. **Gol attıktan sonra geri çekilmemek.** Top yeniden ortadan düşer. Rakip kaleye yakın kalırsan kendi kalen boş kalır.
5. **Köşeye sıkışmak.** Kendi kalenin dibinde top sürmek en tehlikeli durumdur. Topu ilk fırsatta kafayla yükseltip uzaklaştır.

## Skora göre oyun planı

Maç 60 saniye olduğu için skor durumu her şeyi değiştirir.

**Öndeysen:** Acele etme. Orta sahanın biraz gerisinde dur, topu kafayla rakip yarıya gönder ve rakibin sana gelmesini bekle. Son 10 saniyede kalene yaklaş, ama çizgiye yapışma; aşırtma topları kafayla kesebileceğin bir adım önde dur.

**Gerideysen:** Rakibi kendi yarısına sıkıştır. Topu yere düşürmeden üst üste kafa vuruşlarıyla ilerle. Rakip sürekli savunma yaparken hata yapma ihtimali artar. Son saniyelerde kalen boş kalsa bile öne çık; bir gol yemekle iki gol yemek arasında fark yoktur, kaybetmek kaybetmektir.

**Beraberdeyken:** İlk golü atan genellikle kazanır, çünkü geride kalan risk almak zorunda kalır. Sabırlı ol ve rakibin açık vermesini bekle.

## Telefonda oynarken ipuçları

- Telefonu iki elinle tut; yön tuşları bir başparmağında, zıpla ve şut diğerinde olsun.
- Başparmaklarını tuşların üstünde hazır beklet. Parmağını ekrandan kaldırıp indirmek tepki süreni uzatır.
- Yön tuşunu bırakmadan zıplayabilirsin. Koşarak zıplamak, durarak zıplamaktan daha uzağa taşır.
- Ekran parlaklığını aç ve bildirimleri sessize al. Maç ortasında gelen bir bildirim golü yedirir.

## 10 dakikalık alıştırma planı

Zamanlama okuyarak değil oynayarak oturur. Kolay botla şu sırayı dene:

1. **İlk 3 maç:** Hiç şut çekme, sadece kafayla oyna. Topun kafanın hangi noktasına değince nereye gittiğini gör.
2. **Sonraki 3 maç:** Hiç zıplama, sadece yerde kal ve şut çek. Şutun menzilini ve açısını öğren.
3. **Son 4 maç:** İkisini birleştir. Yüksek topa kafa, alçak topa şut.

Bu on maçın sonunda orta bota geçebilirsin. Orta botu rahat yenmeye başladığında zor bota ve gerçek oyunculara hazırsın.`,
  },
]
