import { TmpStage } from './stage'

export default async function Page({ searchParams }: { searchParams: Promise<{ g?: string }> }) {
  const { g } = await searchParams
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <TmpStage game={g ?? 'bilardo'} />
    </main>
  )
}
