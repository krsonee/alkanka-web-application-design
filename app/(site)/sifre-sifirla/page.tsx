import type { Metadata } from 'next'
import { ResetPasswordForm } from '@/components/alkanka/reset-password-form'

export const metadata: Metadata = {
  title: 'Şifre sıfırla | AL KANKA',
  robots: { index: false },
}

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16">
      <ResetPasswordForm token={token ?? null} invalid={Boolean(error)} />
    </main>
  )
}
