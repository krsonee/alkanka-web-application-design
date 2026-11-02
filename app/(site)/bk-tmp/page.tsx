import { LandscapeFit } from '@/components/alkanka/arena/landscape-fit'
import { BatakTmpPreview } from './preview'

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-6xl px-2 py-2">
      <LandscapeFit force menu={<span>menu</span>}>
        <BatakTmpPreview />
      </LandscapeFit>
    </main>
  )
}
