import { experimental_generateVideo as generateVideo } from 'ai';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const OUT = 'public/videos/tanitim';
mkdirSync(OUT, { recursive: true });

const CHARACTER =
  'Jako, a cheerful African grey parrot mascot exactly as in the reference image: grey feathers, red tail, black leather varsity jacket with gold trim and gold letters, gold chain with a crown medallion, small gold earring.';
const STYLE =
  '3D animated Pixar-style cartoon, same look in every shot. Setting: a dark, luxurious black-and-gold game lounge with warm golden rim light and soft bokeh. Smooth cinematic camera.';
const VOICE =
  'Jako speaks native Istanbul Turkish, voiced by a native Turkish male voice actor with perfect Turkish pronunciation and absolutely no foreign accent; warm, energetic, fluent, natural and friendly, same voice in every scene. His beak moves in sync with the words.';
const AUDIO = 'Audio: only Jako\'s voice and subtle matching sound effects. No background music. No on-screen text, no subtitles, no logos.';

const scenes = [
  ['01-giris', 'jako-merhaba', 'Jako flies in from the background flapping his wings, lands softly in the center, spreads his wings wide and waves at the camera with a big smile. Gold sparkles float around him.', 'Selam kanka! Alkanka\'ya hoş geldin!'],
  ['02-okey', 'jako-dusunen', 'Jako sits at a green-felt okey table in a tournament with three other players, holding his wooden tile rack. He thinks with a wing on his chin, then confidently places the final tile and finishes the hand. He grins at the camera.', 'Okey turnuvasında eli bitirdim, sıra sende!'],
  ['03-tavla', 'jako-zar', 'Jako plays backgammon (tavla) at a wooden board in a tournament. He shakes two dice in his wing, throws them, they roll and both show six. He moves his checkers quickly and points at the board, excited.', 'Düşeş geldi! Tavlada kimse beni durduramaz!'],
  ['04-bilardo', 'jako', 'Jako leans over a billiards table in a tournament holding a cue stick with his wings, takes aim, and makes a clean shot; the ball rolls into the pocket. He spins the cue and winks at the camera.', 'Bilardoda da rakip tanımam kanka!'],
  ['05-sampiyon', 'jako-kazandi', 'Jako lifts a big golden tournament trophy and happily dances, bobbing his head and flapping his wings to the rhythm, as gold coins and confetti rain down around him.', 'Turnuvayı kazandım! Bu iş böyle!'],
  ['06-rutbe', 'jako-duyuru', 'Jako hops up a staircase of glowing golden steps; with each step his crown medallion glows brighter. At the top he strikes a proud pose.', 'Aktif ol, rütbeni yükselt, efsane ol!'],
  ['07-sosyal', 'jako-telegram', 'Jako holds a smartphone and takes a cool selfie, then winks at the camera. The phone screen glows with colorful social media style lights.', 'Bizi takip et, etkinliklere katıl, ödülleri kap!'],
  ['08-kapanis', 'jako-merhaba', 'Jako winks at the camera, waves his wing as if saying come on, then flaps his wings and flies up and away out of the frame, leaving gold sparkles behind.', 'Hadi kanka, turnuvada seni bekliyoruz!'],
];

async function run([id, img, action, line]) {
  const file = `${OUT}/${id}.mp4`;
  if (existsSync(file)) return console.log('skip', id);
  const text = `${STYLE} ${CHARACTER} ${action} Jako looks into the camera and says in Turkish: "${line}" ${VOICE} ${AUDIO}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const t = Date.now();
      const res = await generateVideo({
        model: 'google/veo-3.1-generate-001',
        prompt: { image: readFileSync(`public/images/mascots/${img}.png`), text },
        aspectRatio: '16:9',
        duration: 8,
        generateAudio: true,
      });
      const v = res.videos[0];
      writeFileSync(file, Buffer.from(v.uint8Array ?? Buffer.from(v.base64, 'base64')));
      return console.log('done', id, Math.round((Date.now() - t) / 1000) + 's');
    } catch (e) {
      console.log('fail', id, attempt, e.message?.slice(0, 200));
    }
  }
}

const ids = process.argv.slice(2);
const todo = ids.length ? scenes.filter((s) => ids.includes(s[0])) : scenes;
const queue = [...todo];
await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) await run(queue.shift()); }));
console.log('all finished');
