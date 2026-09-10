import { createScopedLogger } from '@/lib/logging/core'
import { requireSelectedModelId } from '@/lib/ai-providers/shared/model-selection'
import type { AiProviderImageExecutionContext, GenerateResult } from '@/lib/ai-providers/runtime-types'
import { buildComfyUiAuthHeaders, resolveComfyUiBaseUrl } from './config'
import { submitComfyUiPrompt } from './submission'
import { uploadComfyUiInputImage } from './upload'
import {
  buildComfyUiImageToImageGraph,
  buildComfyUiTextToImageGraph,
  COMFYUI_TEXT_TO_IMAGE_MODEL_ID,
} from './workflows'

export async function executeComfyUiImageGeneration(
  input: AiProviderImageExecutionContext,
): Promise<GenerateResult> {
  const modelId = requireSelectedModelId(input.selection, 'comfyui:image')
  if (modelId !== COMFYUI_TEXT_TO_IMAGE_MODEL_ID) {
    throw new Error(`COMFYUI_IMAGE_MODEL_UNSUPPORTED: ${modelId}`)
  }

  const baseUrl = resolveComfyUiBaseUrl(input.providerConfig.baseUrl)
  const authHeaders = buildComfyUiAuthHeaders(input.providerConfig.apiKey)
  const options = input.options ?? {}
  const referenceImages = options.referenceImages ?? []
  const referenceImage = referenceImages[0]

  const logger = createScopedLogger({ module: 'worker.comfyui-image', action: 'comfyui_image_generate' })
  logger.info({
    message: 'ComfyUI image generation request',
    details: {
      modelId,
      mode: referenceImage ? 'img2img' : 'txt2img',
      referenceImagesCount: referenceImages.length,
      aspectRatio: options.aspectRatio ?? null,
      resolution: options.resolution ?? null,
    },
  })

  const graph = referenceImage
    ? buildComfyUiImageToImageGraph({
      prompt: input.prompt,
      referenceImageName: await uploadComfyUiInputImage({
        baseUrl,
        dataUrl: referenceImage,
        authHeaders,
      }),
      aspectRatio: options.aspectRatio,
      resolution: options.resolution,
    })
    : buildComfyUiTextToImageGraph({
      prompt: input.prompt,
      aspectRatio: options.aspectRatio,
      resolution: options.resolution,
    })

  const promptId = await submitComfyUiPrompt({
    baseUrl,
    graph,
    scope: 'comfyui:image:submit',
    authHeaders,
  })

  return {
    success: true,
    async: true,
    requestId: promptId,
    externalId: `COMFYUI:IMAGE:${promptId}`,
  }
}
