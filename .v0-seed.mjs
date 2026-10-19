import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)
const sites = ['NovaBet','Orbitly','Kuzey','Apex Club','Zirve','Mavi Ada']
const matches = [
 ['Galatasaray - Beşiktaş','Süper Lig','Maçta 2.5 üst'],['Fenerbahçe - Samsunspor','Süper Lig','Fenerbahçe kazanır'],
 ['Liverpool - Man. United','Premier Lig','KG var'],['Barcelona - Sevilla','La Liga','Barcelona -1.5'],
 ['Bayern - Dortmund','Bundesliga','Toplam 3.5 üst'],['PSG - Marsilya','Ligue 1','PSG kazanır'],
 ['Juventus - Napoli','Serie A','İlk yarı 0.5 üst'],['Lakers - Warriors','NBA','Toplam 225.5 üst'],
 ['Trabzonspor - Göztepe','Süper Lig','Trabzonspor kazanır'],['Arsenal - Tottenham','Premier Lig','Arsenal kazanır'],
 ['Atletico - Valencia','La Liga','KG yok'],['Benfica - Porto','Liga Portugal','Maçta 2.5 üst'],
 ['Ajax - PSV','Eredivisie','KG var'],['Celtics - Heat','NBA','Celtics -4.5'],
 ['Başakşehir - Kasımpaşa','Süper Lig','Maçta 1.5 üst'],['Chelsea - Newcastle','Premier Lig','Chelsea kazanır'],
 ['Roma - Lazio','Serie A','KG var'],['Leverkusen - Leipzig','Bundesliga','Toplam 2.5 üst'],
 ['Real Sociedad - Betis','La Liga','Ev sahibi kazanır'],['Anadolu Efes - Fenerbahçe Beko','EuroLeague','Toplam 160.5 üst'],
 ['Man. City - Aston Villa','Premier Lig','Man. City -1.5'],['Kayserispor - Antalyaspor','Süper Lig','KG var'],
 ['Inter - Atalanta','Serie A','Inter kazanır'],['Lyon - Monaco','Ligue 1','Maçta 2.5 üst'],['Nuggets - Suns','NBA','Nuggets kazanır']]
const rows = matches.map((m, i) => {
  const old = +(1.4 + ((i * 37) % 70) / 100).toFixed(2)
  const nw = +(old + 0.6 + ((i * 53) % 150) / 100).toFixed(2)
  const open = i < 10
  let openedMin, filledMin = null, result = null, resultMin = null
  if (open) openedMin = 2 + i * 5
  else {
    const k = i - 10
    openedMin = k < 8 ? 60 + k * 35 : 1500 + (k - 8) * 180
    filledMin = openedMin - (5 + (k * 7) % 40)
    if (k >= 4) { result = k % 3 === 0 ? 'lost' : 'won'; resultMin = filledMin - 90 }
  }
  return { i, site: sites[i % sites.length], m, old, nw, open, openedMin, filledMin, result, resultMin, max: [200,250,300,400,500][i % 5] }
})
for (const r of rows) {
  await sql`INSERT INTO special_odds (source_chat, source_msg, idx, site_name, link, match, league, market, old_odd, new_odd, kickoff, limit_text, body, status, result, opened_at, filled_at, result_at)
  VALUES ('__ornek', ${200 + r.i}, 0, ${r.site}, 'https://example.com', ${r.m[0]}, ${r.m[1]}, ${r.m[2]}, ${r.old}, ${r.nw}, ${r.open ? 'Bugün 21:00' : 'Bugün 19:00'}, ${'Maks. ' + r.max + ' TL'}, 'Örnek paylaşım', ${r.open ? 'open' : 'filled'}, ${r.result},
   now() - make_interval(mins => ${r.openedMin}::int),
   ${r.filledMin === null ? null : sql`now() - make_interval(mins => ${r.filledMin}::int)`},
   ${r.resultMin === null ? null : sql`now() - make_interval(mins => ${r.resultMin}::int)`})
  ON CONFLICT DO NOTHING`.catch(async e => { throw e })
}
const c = await sql`SELECT status, count(*) c FROM special_odds WHERE source_chat='__ornek' AND source_msg >= 200 GROUP BY status`
console.log(JSON.stringify(c))
