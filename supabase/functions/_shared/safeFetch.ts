/**
 * SSRF-safe URL validation and fetch.
 * - Whitelist: https:// only
 * - DNS resolution before fetch to catch rebinding
 * - Blocks private/reserved/link-local/loopback/cloud metadata IPs
 * - No redirect following (redirect: 'manual')
 * - 10s timeout
 */

const PRIVATE_IP_PATTERNS = [
  /^127\./,                           // 127.0.0.0/8 loopback
  /^10\./,                            // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./,       // 172.16.0.0/12
  /^192\.168\./,                       // 192.168.0.0/16
  /^169\.254\./,                       // 169.254.0.0/16 (AWS metadata, link-local)
  /^0\./,                              // 0.0.0.0/8
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // 100.64.0.0/10 (CGNAT)
  /^192\.0\.0\./,                      // 192.0.0.0/24
  /^198\.1[89]\./,                     // 198.18.0.0/15 (benchmark)
  /^::1$/,                             // IPv6 loopback
  /^fc/i,                              // fc00::/7 (IPv6 ULA)
  /^fd/i,                              // fd00::/8 (IPv6 ULA)
  /^fe[89ab]/i,                        // fe80::/10 (IPv6 link-local)
  /^::ffff:(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/, // IPv4-mapped IPv6
]

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(ip))
}

/**
 * Validate a URL for safe external fetching.
 * Returns the validated URL string or null if unsafe.
 */
export async function validateUrl(urlStr: string): Promise<string | null> {
  let u: URL
  try {
    u = new URL(urlStr)
  } catch {
    return null
  }

  // Whitelist https:// only
  if (u.protocol !== 'https:') return null

  // Block IP literals in hostname (bypass DNS resolution)
  if (/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) && isPrivateIp(u.hostname)) return null
  if (u.hostname.startsWith('[')) return null // IPv6 literals

  // DNS resolution: resolve hostname to IP before fetch
  try {
    const ips = await Deno.resolveDns(u.hostname, 'A')
    const ipv6 = await Deno.resolveDns(u.hostname, 'AAAA').catch(() => [] as string[])
    const allIps = [...ips, ...ipv6]

    if (allIps.length === 0) return null
    if (allIps.some(isPrivateIp)) return null
  } catch {
    // DNS resolution failed — block
    return null
  }

  return urlStr
}

/**
 * Fetch a URL with SSRF protections.
 * Returns the Response or null if the URL is unsafe or the fetch fails.
 */
export async function safeFetch(
  urlStr: string,
  options: RequestInit = {},
): Promise<Response | null> {
  const validated = await validateUrl(urlStr)
  if (!validated) return null

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10_000)

  try {
    const res = await fetch(validated, {
      ...options,
      signal: controller.signal,
      redirect: 'manual', // Do not follow redirects (could redirect to private IP)
    })
    clearTimeout(timeoutId)
    return res
  } catch {
    clearTimeout(timeoutId)
    return null
  }
}
