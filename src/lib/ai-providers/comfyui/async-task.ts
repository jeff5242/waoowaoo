import type {
  AsyncTaskProviderRegistration,
  FormatAsyncExternalIdInput,
  ParsedAsyncExternalId,
} from '@/lib/ai-providers/async-task-types'
import { normalizeAsyncPollResult } from '@/lib/ai-providers/async-task-types'
import { resolveComfyUiBaseUrl } from './config'
import { cancelComfyUiTask, queryComfyUiStatus } from './queue'

function parseComfyUiExternalId(externalId: string): ParsedAsyncExternalId {
  const parts = externalId.split(':')
  const type = parts[1]
  if (type !== 'IMAGE' || parts.length !== 3 || !parts[2]) {
    throw new Error(`Invalid ComfyUI externalId: "${externalId}", expected COMFYUI:IMAGE:promptId`)
  }
  return {
    provider: 'COMFYUI',
    type,
    requestId: parts[2],
  }
}

function formatComfyUiExternalId(input: FormatAsyncExternalIdInput): string {
  return `COMFYUI:${input.type}:${input.requestId}`
}

async function resolveComfyUiPollBaseUrl(
  context: Parameters<AsyncTaskProviderRegistration['poll']>[0]['context'],
): Promise<string> {
  const { baseUrl } = await context.getProviderConfig(context.userId, 'comfyui')
  return resolveComfyUiBaseUrl(baseUrl)
}

export const comfyUiAsyncTaskProvider: AsyncTaskProviderRegistration = {
  providerCode: 'COMFYUI',
  providerKey: 'comfyui',
  canParseExternalId: (externalId) => externalId.startsWith('COMFYUI:'),
  parseExternalId: parseComfyUiExternalId,
  formatExternalId: formatComfyUiExternalId,
  poll: async ({ parsed, context }) => {
    const baseUrl = await resolveComfyUiPollBaseUrl(context)
    const result = await queryComfyUiStatus(baseUrl, parsed.requestId)
    if (result.failed) {
      if (!result.failure) {
        throw new Error('COMFYUI_FAILED_STATUS_CLASSIFICATION_REQUIRED')
      }
      return normalizeAsyncPollResult({
        status: 'failed',
        failure: result.failure,
      })
    }
    if (result.completed) {
      return normalizeAsyncPollResult({
        status: 'completed',
        imageUrl: result.resultDataUrl,
        resultUrl: result.resultDataUrl,
      })
    }
    return normalizeAsyncPollResult({
      status: 'pending',
      pendingPhase: result.status === 'QUEUED' ? 'queued' : 'running',
    })
  },
  cancel: async ({ parsed, context }) => {
    const baseUrl = await resolveComfyUiPollBaseUrl(context)
    await cancelComfyUiTask(baseUrl, parsed.requestId)
  },
}
