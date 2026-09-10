import { createScopedLogger } from '@/lib/logging/core'
import { requireSelectedModelId } from '@/lib/ai-providers/shared/model-selection'
import type { AiProviderImageExecutionContext, GenerateResult } from '@/lib/ai-providers/runtime-types'
import { buildComfyUiAuthHeaders, resolveComfyUiBaseUrl } from './config'
import { submitComfyUiPrompt } from './submission'
import { buildComfyUiTextToImageGraph, COMFYUI_TEXT_TO_IMAGE_MODEL_ID } from './workflows'

export async function executeComfyUiImageGeneration(
  input: AiProviderImageExecutionContext,
): Promise<GenerateResult> {
  const modelId = requireSelectedModelId(input.selection, 'comfyui:image')
  if (modelId !== COMFYUI_TEXT_TO_IMAGE_MODEL_ID) {
    throw new Error(`COMFYUI_IMAGE_MODEL_UNSUPPORTED: ${modelId}`)
  }

  const baseUrl = resolveComfyUiBaseUrl(input.providerConfig.baseUrl)
  const options = input.options ?? {}

  const logger = createScopedLogger({ module: 'worker.comfyui-image', action: 'comfyui_image_generate' })
  logger.info({
    message: 'ComfyUI image generation request',
    details: {
      modelId,
      aspectRatio: options.aspectRatio ?? null,
      resolution: options.resolution ?? null,
    },
  })

  const graph = buildComfyUiTextToImageGraph({
    prompt: input.prompt,
    aspectRatio: options.aspectRatio,
    resolution: options.resolution,
  })

  const promptId = await submitComfyUiPrompt({
    baseUrl,
    graph,
    scope: 'comfyui:image:submit',
    authHeaders: buildComfyUiAuthHeaders(input.providerConfig.apiKey),
  })

  return {
    success: true,
    async: true,
    requestId: promptId,
    externalId: `COMFYUI:IMAGE:${promptId}`,
  }
}
