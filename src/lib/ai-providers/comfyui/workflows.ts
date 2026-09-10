import { randomInt } from 'node:crypto'

/**
 * ComfyUI executes a node graph, not a (model, prompt) pair. This module owns
 * the graph template for the catalog's `text-to-image` model and the mapping
 * from canonical options (aspectRatio, resolution) onto graph node inputs.
 *
 * The checkpoint and sampling parameters are host facts about the operator's
 * own ComfyUI installation, not creative parameters, so they come from worker
 * environment variables instead of the option schema.
 */

export const COMFYUI_TEXT_TO_IMAGE_MODEL_ID = 'text-to-image'

export const COMFYUI_IMAGE_ASPECT_RATIOS = [
  '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9',
] as const

export const COMFYUI_IMAGE_RESOLUTIONS = ['1K', '2K'] as const

const RESOLUTION_TARGET_AREA: Record<(typeof COMFYUI_IMAGE_RESOLUTIONS)[number], number> = {
  '1K': 1024 * 1024,
  '2K': 2048 * 2048,
}

const DEFAULT_CHECKPOINT_NAME = 'sd_xl_base_1.0.safetensors'
const DEFAULT_STEPS = 25
const DEFAULT_CFG = 6.5
const DEFAULT_SAMPLER_NAME = 'euler'
const DEFAULT_SCHEDULER = 'normal'
const DEFAULT_NEGATIVE_PROMPT = 'text, watermark, logo, low quality, blurry, deformed'
const LATENT_DIMENSION_STEP = 8

export interface ComfyUiWorkflowGraph {
  [nodeId: string]: {
    class_type: string
    inputs: Record<string, unknown>
  }
}

function readEnvString(name: string, fallback: string): string {
  const value = process.env[name]?.trim()
  return value || fallback
}

function readEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`COMFYUI_ENV_INVALID: ${name} must be a positive number`)
  }
  return parsed
}

function parseAspectRatio(aspectRatio: string): { widthRatio: number; heightRatio: number } {
  const [widthRaw, heightRaw] = aspectRatio.split(':')
  const widthRatio = Number(widthRaw)
  const heightRatio = Number(heightRaw)
  if (!Number.isFinite(widthRatio) || !Number.isFinite(heightRatio) || widthRatio <= 0 || heightRatio <= 0) {
    throw new Error(`COMFYUI_ASPECT_RATIO_INVALID: ${aspectRatio}`)
  }
  return { widthRatio, heightRatio }
}

export function resolveComfyUiImageDimensions(input: {
  aspectRatio?: string
  resolution?: string
}): { width: number; height: number } {
  const aspectRatio = input.aspectRatio ?? '1:1'
  const resolution = (input.resolution ?? '1K') as (typeof COMFYUI_IMAGE_RESOLUTIONS)[number]
  const targetArea = RESOLUTION_TARGET_AREA[resolution]
  if (!targetArea) throw new Error(`COMFYUI_RESOLUTION_INVALID: ${input.resolution}`)
  const { widthRatio, heightRatio } = parseAspectRatio(aspectRatio)
  const rawWidth = Math.sqrt(targetArea * (widthRatio / heightRatio))
  const width = Math.max(
    LATENT_DIMENSION_STEP,
    Math.round(rawWidth / LATENT_DIMENSION_STEP) * LATENT_DIMENSION_STEP,
  )
  const height = Math.max(
    LATENT_DIMENSION_STEP,
    Math.round((rawWidth * (heightRatio / widthRatio)) / LATENT_DIMENSION_STEP) * LATENT_DIMENSION_STEP,
  )
  return { width, height }
}

export function buildComfyUiTextToImageGraph(input: {
  prompt: string
  aspectRatio?: string
  resolution?: string
}): ComfyUiWorkflowGraph {
  const { width, height } = resolveComfyUiImageDimensions(input)
  const checkpointName = readEnvString('COMFYUI_CHECKPOINT_NAME', DEFAULT_CHECKPOINT_NAME)
  const negativePrompt = readEnvString('COMFYUI_NEGATIVE_PROMPT', DEFAULT_NEGATIVE_PROMPT)
  const steps = Math.round(readEnvNumber('COMFYUI_STEPS', DEFAULT_STEPS))
  const cfg = readEnvNumber('COMFYUI_CFG', DEFAULT_CFG)
  const samplerName = readEnvString('COMFYUI_SAMPLER_NAME', DEFAULT_SAMPLER_NAME)
  const scheduler = readEnvString('COMFYUI_SCHEDULER', DEFAULT_SCHEDULER)

  return {
    checkpoint: {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: checkpointName },
    },
    positive: {
      class_type: 'CLIPTextEncode',
      inputs: { text: input.prompt, clip: ['checkpoint', 1] },
    },
    negative: {
      class_type: 'CLIPTextEncode',
      inputs: { text: negativePrompt, clip: ['checkpoint', 1] },
    },
    latent: {
      class_type: 'EmptyLatentImage',
      inputs: { width, height, batch_size: 1 },
    },
    sampler: {
      class_type: 'KSampler',
      inputs: {
        seed: randomInt(0, 2 ** 31),
        steps,
        cfg,
        sampler_name: samplerName,
        scheduler,
        denoise: 1,
        model: ['checkpoint', 0],
        positive: ['positive', 0],
        negative: ['negative', 0],
        latent_image: ['latent', 0],
      },
    },
    decode: {
      class_type: 'VAEDecode',
      inputs: { samples: ['sampler', 0], vae: ['checkpoint', 2] },
    },
    save: {
      class_type: 'SaveImage',
      inputs: { images: ['decode', 0], filename_prefix: 'waoowaoo' },
    },
  }
}
