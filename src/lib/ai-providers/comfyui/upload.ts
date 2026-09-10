import { randomUUID } from 'node:crypto'
import { fetchWithProviderProxy } from '@/lib/http/outbound-proxy'
import { decodeBase64WithLimit, MAX_IMAGE_BYTES } from '@/lib/http/body-limits'
import { captureProviderHttpFailure, readProviderJsonResponse } from '@/lib/ai-providers/failure'
import { buildComfyUiUrl } from './config'

const DATA_URL_EXTENSION_BY_MIME: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

function decodeImageDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string; extension: string } {
  const base64Start = dataUrl.indexOf(';base64,')
  if (!dataUrl.startsWith('data:') || base64Start === -1) {
    throw new Error('COMFYUI_REFERENCE_IMAGE_DATA_URL_INVALID')
  }
  const mimeType = dataUrl.slice('data:'.length, base64Start).split(';')[0]?.trim() ?? ''
  const extension = DATA_URL_EXTENSION_BY_MIME[mimeType]
  if (!extension) {
    throw new Error(`COMFYUI_REFERENCE_IMAGE_MIME_UNSUPPORTED: ${mimeType}`)
  }
  const buffer = decodeBase64WithLimit(
    dataUrl.slice(base64Start + ';base64,'.length),
    MAX_IMAGE_BYTES,
    'comfyui reference image',
  )
  return { buffer, mimeType, extension }
}

/**
 * Upload one reference image into the ComfyUI input directory and return the
 * stored filename for a LoadImage node. This precedes the /prompt submission
 * and creates no queued work, so a retried attempt re-uploading under a fresh
 * name is harmless — the submission fence only guards the /prompt call.
 */
export async function uploadComfyUiInputImage(input: {
  readonly baseUrl: string
  readonly dataUrl: string
  readonly authHeaders?: Readonly<Record<string, string>>
}): Promise<string> {
  const { buffer, mimeType, extension } = decodeImageDataUrl(input.dataUrl)
  const uploadName = `waoo-ref-${randomUUID()}.${extension}`

  const form = new FormData()
  form.append('image', new Blob([new Uint8Array(buffer)], { type: mimeType }), uploadName)
  form.append('type', 'input')
  form.append('overwrite', 'true')

  const response = await fetchWithProviderProxy(buildComfyUiUrl(input.baseUrl, 'upload/image'), {
    method: 'POST',
    headers: { ...(input.authHeaders ?? {}) },
    body: form,
  })
  if (!response.ok) {
    throw await captureProviderHttpFailure({ response, provider: 'comfyui', phase: 'submit' })
  }

  const payload = await readProviderJsonResponse<{ name?: unknown; subfolder?: unknown }>({
    response,
    provider: 'comfyui',
    phase: 'submit',
  })
  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  if (!name) {
    throw new Error('COMFYUI_UPLOAD_RESPONSE_NAME_MISSING')
  }
  const subfolder = typeof payload.subfolder === 'string' ? payload.subfolder.trim() : ''
  // LoadImage resolves "subfolder/name" relative to the input directory.
  return subfolder ? `${subfolder}/${name}` : name
}
