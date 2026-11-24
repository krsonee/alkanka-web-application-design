/** The commit this deployment was built from. Empty outside Vercel, where there is no newer build to compare against. */
export const BUILD = process.env.VERCEL_GIT_COMMIT_SHA ?? ''
