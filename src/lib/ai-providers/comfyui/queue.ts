import { createScopedLogger } from '@/lib/logging/core'
import { fetchWithProviderProxy } from '@/lib/http/outbound-proxy'
import { MAX_IMAGE_BYTES, readResponseBufferWithLimit } from '@/lib/http/body-limits'
import { createProviderAsyncTaskFailure } from '@/lib/ai-providers/shared/async-task-status'
import { captureProviderHttpFailure, readProviderJsonResponse } from '@/lib/ai-providers/failure'
import type { FailureRecord } from '@/lib/errors/failure'
import { buildComfyUiUrl } from './config'

const comfyUiLogger = createScopedLogger({ module: 'ai-provider.comfyui', provider: 'comfyui' })

const IMAGE_MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

export interface ComfyUiQueueStatus {
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  completed: boolean
  failed: boolean
  failure?: FailureRecord
  /**
   * Completed results are returned inline as a data: URL. The operator's
   * ComfyUI host is typically a private-network address the platform's
   * SSRF-guarded media download refuses, so the adapter fetches `/view`
   * itself and hands the bytes over as a wire-level data URL.
   */
  resultDataUrl?: string
}

interface ComfyUiOutputImageRef {
  filename: string
  subfolder: string
  type: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readHistoryOutputImage(historyEntry: Record<string, unknown>): ComfyUiOutputImageRef | null {
  const outputs = asRecord(historyEntry.outputs)
  if (!outputs) return null
  for (const nodeOutput of Object.values(outputs)) {
    const node = asRecord(nodeOutput)
    const images = Array.isArray(node?.images) ? node.images : []
    for (const imageRaw of images) {
      const image = asRecord(imageRaw)
      const filename = readString(image?.filename)
      if (!filename) continue
      const type = readString(image?.type)
      // `temp` entries are previews; only `output` images are final results.
      if (type && type !== 'output') continue
      return {
        filename,
        subfolder: readString(image?.subfolder),
        type: type || 'output',
      }
    }
  }
  return null
}

function readHistoryFailureMessage(historyEntry: Record<string, unknown>): string {
  const status = asRecord(historyEntry.status)
  const messages = Array.isArray(status?.messages) ? status.messages : []
  for (const messageRaw of messages) {
    if (!Array.isArray(messageRaw) || messageRaw.length < 2) continue
    const [eventName, eventPayload] = messageRaw
    if (eventName !== 'execution_error') continue
    const payload = asRecord(eventPayload)
    const exceptionMessage = readString(payload?.exception_message)
    const nodeType = readString(payload?.node_type)
    if (exceptionMessage) {
      return nodeType ? `${nodeType}: ${exceptionMessage}` : exceptionMessage
    }
  }
  return readString(status?.status_str) || 'ComfyUI execution failed'
}

type ComfyUiAuthHeaders = Readonly<Record<string, string>>

async function fetchComfyUiJson(
  url: string,
  phase: 'poll' | 'result',
  authHeaders: ComfyUiAuthHeaders,
): Promise<unknown> {
  const response = await fetchWithProviderProxy(url, {
    method: 'GET',
    headers: { Accept: 'application/json', ...authHeaders },
  })
  if (!response.ok) {
    throw await captureProviderHttpFailure({ response, provider: 'comfyui', phase })
  }
  return await readProviderJsonResponse({ response, provider: 'comfyui', phase })
}

async function downloadComfyUiOutputImage(
  baseUrl: string,
  image: ComfyUiOutputImageRef,
  authHeaders: ComfyUiAuthHeaders,
): Promise<string> {
  const query = new URLSearchParams({
    filename: image.filename,
    subfolder: image.subfolder,
    type: image.type,
  })
  const viewUrl = buildComfyUiUrl(baseUrl, `view?${query.toString()}`)
  const response = await fetchWithProviderProxy(viewUrl, { method: 'GET', headers: { ...authHeaders } })
  if (!response.ok) {
    throw await captureProviderHttpFailure({ response, provider: 'comfyui', phase: 'result' })
  }
  const buffer = await readResponseBufferWithLimit(response, MAX_IMAGE_BYTES, 'comfyui image result')
  const extension = image.filename.split('.').pop()?.toLowerCase() ?? ''
  const mimeType = IMAGE_MIME_BY_EXTENSION[extension]
    ?? response.headers.get('content-type')?.split(';')[0]?.trim()
    ?? 'image/png'
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

function readQueuePhase(queuePayload: unknown, promptId: string): 'QUEUED' | 'RUNNING' | null {
  const queue = asRecord(queuePayload)
  if (!queue) return null
  const matches = (entries: unknown): boolean => Array.isArray(entries) && entries.some((entryRaw) => (
    Array.isArray(entryRaw) && entryRaw.some((cell) => readString(cell) === promptId)
  ))
  if (matches(queue.queue_running)) return 'RUNNING'
  if (matches(queue.queue_pending)) return 'QUEUED'
  return null
}

export async function queryComfyUiStatus(
  baseUrl: string,
  promptId: string,
  authHeaders: ComfyUiAuthHeaders = {},
): Promise<ComfyUiQueueStatus> {
  const historyPayload = await fetchComfyUiJson(
    buildComfyUiUrl(baseUrl, `history/${encodeURIComponent(promptId)}`),
    'poll',
    authHeaders,
  )
  const historyEntry = asRecord(asRecord(historyPayload)?.[promptId])

  if (historyEntry) {
    const status = asRecord(historyEntry.status)
    const statusStr = readString(status?.status_str)
    if (statusStr === 'error') {
      const message = readHistoryFailureMessage(historyEntry)
      return {
        status: 'FAILED',
        completed: false,
        failed: true,
        failure: createProviderAsyncTaskFailure({
          provider: 'comfyui',
          code: 'EXTERNAL_ERROR',
          message,
          cause: status,
        }),
      }
    }

    const image = readHistoryOutputImage(historyEntry)
    if (!image) {
      return {
        status: 'COMPLETED',
        completed: true,
        failed: true,
        failure: createProviderAsyncTaskFailure({
          provider: 'comfyui',
          code: 'EMPTY_RESPONSE',
          message: 'ComfyUI task completed without an output image',
          cause: { promptId, statusStr },
        }),
      }
    }

    comfyUiLogger.info({
      action: 'comfyui.queue.completed',
      message: 'ComfyUI task completed, downloading output',
      details: { promptId, filename: image.filename },
    })
    const resultDataUrl = await downloadComfyUiOutputImage(baseUrl, image, authHeaders)
    return {
      status: 'COMPLETED',
      completed: true,
      failed: false,
      resultDataUrl,
    }
  }

  const queuePayload = await fetchComfyUiJson(buildComfyUiUrl(baseUrl, 'queue'), 'poll', authHeaders)
  const phase = readQueuePhase(queuePayload, promptId)
  comfyUiLogger.debug({
    action: 'comfyui.queue.status',
    message: 'ComfyUI queue status polled',
    details: { promptId, phase: phase ?? 'unknown' },
  })
  // A prompt absent from both /history and /queue is usually mid-handoff
  // between the two; report running so the generation budget keeps counting
  // and a genuinely lost job terminates via the generation timeout.
  return {
    status: phase === 'QUEUED' ? 'QUEUED' : 'RUNNING',
    completed: false,
    failed: false,
  }
}

/**
 * Best-effort cancellation. `/interrupt` aborts whatever prompt is currently
 * executing, so it is only sent after `/queue` proves this prompt is the one
 * running; a pending prompt is deleted from the queue instead. 4xx responses
 * mean the job is already terminal or unknown and are tolerated as a no-op;
 * only transport/5xx failures throw.
 */
export async function cancelComfyUiTask(
  baseUrl: string,
  promptId: string,
  authHeaders: ComfyUiAuthHeaders = {},
): Promise<void> {
  const queuePayload = await fetchComfyUiJson(buildComfyUiUrl(baseUrl, 'queue'), 'poll', authHeaders)
  const phase = readQueuePhase(queuePayload, promptId)
  if (!phase) {
    comfyUiLogger.info({
      action: 'comfyui.queue.cancel_noop',
      message: 'ComfyUI cancel skipped: prompt already terminal or unknown',
      details: { promptId },
    })
    return
  }

  const response = phase === 'QUEUED'
    ? await fetchWithProviderProxy(buildComfyUiUrl(baseUrl, 'queue'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ delete: [promptId] }),
    })
    : await fetchWithProviderProxy(buildComfyUiUrl(baseUrl, 'interrupt'), {
      method: 'POST',
      headers: { ...authHeaders },
    })
  if (!response.ok && response.status >= 500) {
    throw await captureProviderHttpFailure({ response, provider: 'comfyui', phase: 'cancel' })
  }

  comfyUiLogger.info({
    action: 'comfyui.queue.cancelled',
    message: 'ComfyUI cancel requested',
    details: { promptId, phase },
  })
}
