'use client'

import type { ArenaGame, ArenaGameSettings } from '@/lib/arena'
import { StakeGate } from './stake-gate'
import { Tavla } from './tavla'
import { Okey } from './okey'
import { Bilardo } from './bilardo'

const RULES: Record<ArenaGame, string[]> = {
  tavla: [
    'Standart tavla kuralları: 15 pul, kırık pul bara gider ve önce oyuna girmek zorundadır.',
    'Çift atarsan zarı dört kez oynarsın. Oynanabilecek en çok zarı oynamak zorunlusun.',
    'Tüm pulların evine geldiğinde toplamaya başlarsın. 15 pulu ilk toplayan kazanır.',
  ],
  okey: [
    '4 kişilik masa: sen ve 3 rakip. Gösterge taşının bir üstü okeydir, istediğin taşın yerine geçer.',
    'Sıran gelince ortadan çek ya da soldaki rakibin attığı taşı al, sonra bir taş at.',
    'Elindeki 14 taşı seri (aynı renk sıralı) ve per (aynı sayı farklı renk) olarak dizince ya da 7 çift yapınca bitir.',
  ],
  bilardo: [
    '8 top kuralı: ilk sokulan top grubunu belirler, düz (1-7) ya da çizgili (9-15).',
    'Kendi topunu sokarsan tekrar vurursun. Beyazı sokmak ya da önce rakip topa vurmak faul sayılır.',
    'Grubunu temizledikten sonra siyah 8 numarayı sokan kazanır. Siyah erken düşerse kaybedersin.',
  ],
}

export function ArenaStage({ game, settings }: { game: ArenaGame; settings: ArenaGameSettings }) {
  return (
    <StakeGate game={game} settings={settings} rules={RULES[game]}>
      {(api) => (game === 'tavla' ? <Tavla {...api} /> : game === 'okey' ? <Okey {...api} /> : <Bilardo {...api} />)}
    </StakeGate>
  )
}
