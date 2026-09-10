import { defineAiProviderManifest } from '@/lib/ai-providers/manifest'
import { comfyUiAdapter } from './adapter'
import { comfyUiAsyncTaskProvider } from './async-task'
import { COMFYUI_DEFAULT_BASE_URL } from './config'
import {
  COMFYUI_API_CONFIG_CATALOG_MODELS,
  COMFYUI_BUILTIN_CAPABILITY_CATALOG_ENTRIES,
  COMFYUI_BUILTIN_PRICING_CATALOG_ENTRIES,
  COMFYUI_PLATFORM_MODEL_PRESETS,
} from './models'

export const comfyUiProviderManifest = defineAiProviderManifest({
  providerKey: 'comfyui',
  adapter: comfyUiAdapter,
  apiConfig: {
    visibility: 'visible',
    name: 'ComfyUI',
    baseUrl: COMFYUI_DEFAULT_BASE_URL,
    // A self-hosted ComfyUI instance authenticates by network reachability;
    // the base URL is the whole configuration.
    requiresApiKey: false,
  },
  platformCredentials: { envPrefix: 'PLATFORM_COMFYUI', requiresBaseUrl: true },
  asyncTasks: [comfyUiAsyncTaskProvider],
  catalogs: {
    capabilities: COMFYUI_BUILTIN_CAPABILITY_CATALOG_ENTRIES,
    pricing: COMFYUI_BUILTIN_PRICING_CATALOG_ENTRIES,
    apiConfigModels: COMFYUI_API_CONFIG_CATALOG_MODELS,
    platformModels: COMFYUI_PLATFORM_MODEL_PRESETS,
  },
  // The v1 text-to-image workflow takes no reference media, but every image
  // adapter must bind its modality to one transport contract; inline data URLs
  // match the self-hosted deployment capability.
  mediaInputs: [
    { modality: 'image', transports: { image: ['inline-data-url'] } },
  ],
})
