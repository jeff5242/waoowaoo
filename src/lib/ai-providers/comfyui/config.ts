export const COMFYUI_DEFAULT_BASE_URL = 'http://127.0.0.1:8188'

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '')
}

export function resolveComfyUiBaseUrl(configuredBaseUrl?: string): string {
  const configured = configuredBaseUrl?.trim()
  if (configured) return normalizeBaseUrl(configured)
  const override = process.env.COMFYUI_BASE_URL?.trim()
  if (override) return normalizeBaseUrl(override)
  return COMFYUI_DEFAULT_BASE_URL
}

export function buildComfyUiUrl(baseUrl: string, path: string): string {
  return `${normalizeBaseUrl(baseUrl)}/${path.replace(/^\/+/, '')}`
}

/**
 * ComfyUI itself has no auth; operators protect it with a reverse proxy.
 * The optional API key field maps onto that proxy's scheme: a `user:password`
 * value becomes HTTP Basic credentials, anything else is sent as a Bearer
 * token. An empty key sends no Authorization header.
 */
export function buildComfyUiAuthHeaders(apiKey?: string): Record<string, string> {
  const trimmed = apiKey?.trim()
  if (!trimmed) return {}
  if (trimmed.includes(':')) {
    return { Authorization: `Basic ${Buffer.from(trimmed, 'utf8').toString('base64')}` }
  }
  return { Authorization: `Bearer ${trimmed}` }
}
