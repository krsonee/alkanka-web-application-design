export const PASSWORD_HINT = 'En az 10 karakter, içinde hem harf hem rakam olsun.'

/** Returns why a panel password is too weak, or null when it is acceptable. Shared by the form and the server. */
export function passwordProblem(password: string, username = ''): string | null {
  if (password.length < 10) return 'Şifre en az 10 karakter olmalı.'
  if (password.length > 200) return 'Şifre en fazla 200 karakter olabilir.'
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return 'Şifrede hem harf hem rakam olmalı.'
  if (new Set(password).size < 5) return 'Şifre çok tekdüze; en az 5 farklı karakter kullan.'
  const name = username.trim().toLowerCase()
  if (name.length >= 3 && password.toLowerCase().includes(name)) return 'Şifre kullanıcı adını içermemeli.'
  return null
}
