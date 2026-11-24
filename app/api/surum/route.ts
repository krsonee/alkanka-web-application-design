import { BUILD } from '@/lib/build-id'

// Built once per deployment and served as a file: asking for it costs no function run and never reaches the database.
export const dynamic = 'force-static'

export function GET() {
  return Response.json({ build: BUILD })
}
