let clockOffset = 0

/** Shared SWR fetcher for Çember endpoints; also syncs the local clock to the server's Date header so every screen plays the round in lockstep. */
export const cemberFetch = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' })
  const date = res.headers.get('date')
  if (url.includes('/me') && date) {
    const server = Date.parse(date)
    if (Number.isFinite(server)) clockOffset = server + 500 - Date.now()
  }
  return res.json()
}

export const serverNow = () => Date.now() + clockOffset
