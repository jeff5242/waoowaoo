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
