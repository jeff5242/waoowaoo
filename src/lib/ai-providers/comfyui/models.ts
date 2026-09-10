import type { AiOptionSchema } from '@/lib/ai-registry/types'
import type { PlatformModelPreset } from '@/lib/platform-models/types'
import {
  buildMediaOptionSchema,
  enumValidator,
  stringArrayValidator,
  type MediaModality,
} from '@/lib/ai-providers/shared/option-schema'
import {
  COMFYUI_IMAGE_ASPECT_RATIOS,
  COMFYUI_IMAGE_RESOLUTIONS,
  COMFYUI_TEXT_TO_IMAGE_MODEL_ID,
} from './workflows'

export const COMFYUI_BUILTIN_CAPABILITY_CATALOG_ENTRIES = [
  {
    modelType: 'image',
    provider: 'comfyui',
    modelId: COMFYUI_TEXT_TO_IMAGE_MODEL_ID,
    capabilities: {
      image: {
        resolutionOptions: [...COMFYUI_IMAGE_RESOLUTIONS],
        maxReferenceImages: 1,
      },
    },
  },
] as const

// Generation runs on the operator's own hardware; the platform pays nothing.
// A zero cost still derives the minimum retail rate, so cloud billing keeps a
// consistent per-image receipt.
export const COMFYUI_BUILTIN_PRICING_CATALOG_ENTRIES = [
  {
    apiType: 'image',
    provider: 'comfyui',
    modelId: COMFYUI_TEXT_TO_IMAGE_MODEL_ID,
    cost: { mode: 'flat', flatAmount: 0 },
  },
] as const

export const COMFYUI_API_CONFIG_CATALOG_MODELS = [
  {
    modelId: COMFYUI_TEXT_TO_IMAGE_MODEL_ID,
    name: 'ComfyUI Text to Image',
    type: 'image',
    provider: 'comfyui',
  },
] as const

export const COMFYUI_PLATFORM_MODEL_PRESETS = [] as const satisfies ReadonlyArray<PlatformModelPreset>

export function resolveComfyUiOptionSchema(modality: MediaModality, modelId: string): AiOptionSchema {
  if (modality !== 'image' || modelId !== COMFYUI_TEXT_TO_IMAGE_MODEL_ID) {
    throw new Error(`COMFYUI_MODEL_UNSUPPORTED:${modality}:${modelId}`)
  }
  return buildMediaOptionSchema('image', {
    excludedKeys: ['keepOriginalAspectRatio', 'responseFormat', 'size', 'quality'],
    validators: {
      aspectRatio: enumValidator(COMFYUI_IMAGE_ASPECT_RATIOS),
      resolution: enumValidator(COMFYUI_IMAGE_RESOLUTIONS),
      outputFormat: enumValidator(['png']),
      referenceImages: stringArrayValidator({ maxLength: 1 }),
    },
    normalize: (options) => ({
      ...options,
      outputFormat: options.outputFormat ?? 'png',
      referenceImages: options.referenceImages ?? [],
    }),
  })
}
