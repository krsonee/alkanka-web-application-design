import 'server-only'
import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'

/**
 * Addresses a request made on behalf of someone else must never reach: this machine, private networks,
 * link-local (cloud metadata lives there) and ranges that only wrap an IPv4 address.
 */
const INSIDE = new BlockList()
const V4: [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 3],
]
const V6: [string, number][] = [
  ['::', 127],
  ['64:ff9b::', 96],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
]
for (const [net, bits] of V4) INSIDE.addSubnet(net, bits, 'ipv4')
for (const [net, bits] of V6) INSIDE.addSubnet(net, bits, 'ipv6')

export class InsideAddressError extends Error {}

const bare = (host: string) => host.replace(/^\[|\]$/g, '')

export function isInsideAddress(address: string) {
  const family = isIP(address)
  if (!family) return true
  return INSIDE.check(address, family === 6 ? 'ipv6' : 'ipv4')
}

async function addressesOf(host: string) {
  const name = bare(host)
  if (isIP(name)) return [name]
  return (await lookup(name, { all: true, verbatim: true })).map((a) => a.address)
}

/** True when the name answers with an inside address. A name that does not resolve is not "inside". */
export async function pointsInside(host: string) {
  try {
    return (await addressesOf(host)).some(isInsideAddress)
  } catch {
    return false
  }
}

/** Throws unless the address is plain http(s) and every address its host answers with is a public one. */
export async function assertPublicUrl(raw: string) {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new InsideAddressError('Geçersiz adres.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new InsideAddressError('Sadece http ve https adresleri açılır.')
  if (url.username || url.password) throw new InsideAddressError('Geçersiz adres.')
  const found = await addressesOf(url.hostname)
  if (!found.length || found.some(isInsideAddress)) throw new InsideAddressError('Bu adres açılamaz.')
  return url
}
