import type { AiProviderAdapter } from '@/lib/ai-providers/runtime-types'
import { describeMediaVariantBase } from '@/lib/ai-providers/shared/media-adapter'
import { comfyUiConnectionTester } from './connection-test'
import { comfyUiFailureAdapter } from './failure'
import { executeComfyUiImageGeneration } from './image'
import { resolveComfyUiOptionSchema } from './models'

export const comfyUiAdapter: AiProviderAdapter = {
  providerKey: 'comfyui',
  failure: comfyUiFailureAdapter,
  image: {
    describe: (selection) => describeMediaVariantBase({
      modality: 'image',
      selection,
      executionMode: 'async',
      optionSchema: resolveComfyUiOptionSchema('image', selection.modelId),
    }),
    execute: executeComfyUiImageGeneration,
  },
  connectionTest: comfyUiConnectionTester,
}
