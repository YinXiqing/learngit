const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:5000'

export async function serverFetch(path: string, init?: RequestInit) {
  return fetch(`${BACKEND}${path}`, { cache: 'no-store', ...init })
}
