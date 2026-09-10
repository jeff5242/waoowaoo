import { ProviderSubmissionError } from '@/lib/ai-exec/submission-error'
import { EXTERNAL_OPERATION } from '@/lib/external-operation/registry'
import { getErrorSpec } from '@/lib/errors/codes'
import {
  fetchProviderWithRetry,
  ProviderHttpError,
  readProviderJsonResponse,
} from '@/lib/ai-providers/failure'
import { fetchWithProviderProxy } from '@/lib/http/outbound-proxy'
import { buildComfyUiUrl } from './config'
import type { ComfyUiWorkflowGraph } from './workflows'

const COMFYUI_SUBMIT_DIAGNOSTIC_MAX_LENGTH = 512

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * ComfyUI validates the whole graph before queueing: a 400 response with an
 * error envelope (`error` / `node_errors`) proves no job was created, so it is
 * a definite `rejected` disposition. Every other failure stays a transport
 * error and the submission fence records `outcome_unknown`.
 */
function throwComfyUiSubmissionRejection(input: {
  readonly payload: unknown
  readonly httpStatus: number | null
  readonly cause: unknown
}): void {
  const envelope = asRecord(input.payload)
  if (!envelope) return
  const error = asRecord(envelope.error)
  const nodeErrors = asRecord(envelope.node_errors)
  if (!error && (!nodeErrors || Object.keys(nodeErrors).length === 0)) return
  const message = (
    readString(error?.message)
    || readString(error?.type)
    || getErrorSpec('PROVIDER_SUBMISSION_REJECTED').defaultMessage
  ).slice(0, COMFYUI_SUBMIT_DIAGNOSTIC_MAX_LENGTH)
  throw new ProviderSubmissionError('PROVIDER_SUBMISSION_REJECTED', message, {
    disposition: 'rejected',
    provider: 'comfyui',
    details: {
      providerCode: readString(error?.type) || 'comfyui_prompt_rejected',
      httpStatus: input.httpStatus,
    },
    cause: input.cause,
  })
}

export async function submitComfyUiPrompt(input: {
  readonly baseUrl: string
  readonly graph: ComfyUiWorkflowGraph
  readonly scope: string
}): Promise<string> {
  let response: Response
  try {
    response = await fetchProviderWithRetry({
      url: buildComfyUiUrl(input.baseUrl, 'prompt'),
      provider: 'comfyui',
      phase: 'submit',
      options: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: input.graph }),
        operation: EXTERNAL_OPERATION.PROVIDER_SUBMIT,
        cache: 'no-store',
        scope: input.scope,
        fetchFn: fetchWithProviderProxy,
      },
    })
  } catch (error: unknown) {
    if (error instanceof ProviderHttpError && error.statusCode === 400) {
      throwComfyUiSubmissionRejection({
        payload: error.errorEnvelope,
        httpStatus: error.statusCode,
        cause: error,
      })
    }
    throw error
  }

  const payload = await readProviderJsonResponse({
    response,
    provider: 'comfyui',
    phase: 'submit',
  })
  const envelope = asRecord(payload)
  const promptId = readString(envelope?.prompt_id)
  if (promptId) return promptId

  throwComfyUiSubmissionRejection({
    payload,
    httpStatus: response.status,
    cause: {
      name: 'ComfyUiSubmissionResponse',
      message: 'ComfyUI /prompt response did not contain a prompt_id',
      statusCode: response.status,
      errorEnvelope: payload,
    },
  })
  throw new Error('COMFYUI_SUBMIT_RESPONSE_PROMPT_ID_MISSING')
}
