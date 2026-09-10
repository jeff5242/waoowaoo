import { afterEach, describe, expect, it } from 'vitest'
import { comfyUiAsyncTaskProvider } from '@/lib/ai-providers/comfyui/async-task'
import { buildComfyUiAuthHeaders, resolveComfyUiBaseUrl } from '@/lib/ai-providers/comfyui/config'
import { resolveComfyUiOptionSchema } from '@/lib/ai-providers/comfyui/models'
import {
  buildComfyUiTextToImageGraph,
  COMFYUI_TEXT_TO_IMAGE_MODEL_ID,
  resolveComfyUiImageDimensions,
} from '@/lib/ai-providers/comfyui/workflows'

const COMFYUI_ENV_KEYS = [
  'COMFYUI_BASE_URL',
  'COMFYUI_CHECKPOINT_NAME',
  'COMFYUI_NEGATIVE_PROMPT',
  'COMFYUI_STEPS',
  'COMFYUI_CFG',
  'COMFYUI_SAMPLER_NAME',
  'COMFYUI_SCHEDULER',
] as const

afterEach(() => {
  for (const key of COMFYUI_ENV_KEYS) delete process.env[key]
})

describe('resolveComfyUiImageDimensions', () => {
  it('maps 1:1 at 1K to the SDXL native square', () => {
    expect(resolveComfyUiImageDimensions({ aspectRatio: '1:1', resolution: '1K' }))
      .toEqual({ width: 1024, height: 1024 })
  })

  it('keeps latent dimensions on the 8px grid for every declared ratio', () => {
    for (const aspectRatio of ['16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9']) {
      const { width, height } = resolveComfyUiImageDimensions({ aspectRatio, resolution: '1K' })
      expect(width % 8).toBe(0)
      expect(height % 8).toBe(0)
      const [widthRatio, heightRatio] = aspectRatio.split(':').map(Number)
      expect(width / height).toBeCloseTo(widthRatio! / heightRatio!, 1)
    }
  })

  it('roughly quadruples the pixel area at 2K', () => {
    const oneK = resolveComfyUiImageDimensions({ aspectRatio: '1:1', resolution: '1K' })
    const twoK = resolveComfyUiImageDimensions({ aspectRatio: '1:1', resolution: '2K' })
    expect(twoK.width * twoK.height).toBeGreaterThan(3.9 * oneK.width * oneK.height)
  })

  it('rejects an unknown resolution', () => {
    expect(() => resolveComfyUiImageDimensions({ resolution: '8K' })).toThrow('COMFYUI_RESOLUTION_INVALID')
  })
})

describe('buildComfyUiTextToImageGraph', () => {
  it('threads the prompt and env-configured checkpoint into the graph', () => {
    process.env.COMFYUI_CHECKPOINT_NAME = 'my-model.safetensors'
    const graph = buildComfyUiTextToImageGraph({ prompt: 'a lighthouse at dusk', aspectRatio: '16:9' })
    expect(graph.positive!.inputs.text).toBe('a lighthouse at dusk')
    expect(graph.checkpoint!.inputs.ckpt_name).toBe('my-model.safetensors')
    expect(graph.sampler!.class_type).toBe('KSampler')
    expect(graph.save!.class_type).toBe('SaveImage')
  })

  it('rejects a non-numeric steps override instead of submitting a broken graph', () => {
    process.env.COMFYUI_STEPS = 'twenty'
    expect(() => buildComfyUiTextToImageGraph({ prompt: 'x' })).toThrow('COMFYUI_ENV_INVALID')
  })
})

describe('comfyUiAsyncTaskProvider external ids', () => {
  it('round-trips COMFYUI:IMAGE:promptId', () => {
    const externalId = comfyUiAsyncTaskProvider.formatExternalId({ type: 'IMAGE', requestId: 'abc-123' })
    expect(externalId).toBe('COMFYUI:IMAGE:abc-123')
    expect(comfyUiAsyncTaskProvider.canParseExternalId(externalId)).toBe(true)
    expect(comfyUiAsyncTaskProvider.parseExternalId(externalId)).toEqual({
      provider: 'COMFYUI',
      type: 'IMAGE',
      requestId: 'abc-123',
    })
  })

  it('rejects unknown external id shapes', () => {
    expect(() => comfyUiAsyncTaskProvider.parseExternalId('COMFYUI:VIDEO:abc')).toThrow()
    expect(() => comfyUiAsyncTaskProvider.parseExternalId('COMFYUI:IMAGE:')).toThrow()
  })
})

describe('resolveComfyUiOptionSchema', () => {
  it('accepts declared aspect ratios and resolutions and refuses reference images', () => {
    const schema = resolveComfyUiOptionSchema('image', COMFYUI_TEXT_TO_IMAGE_MODEL_ID)
    expect(schema.validators.aspectRatio!('16:9').ok).toBe(true)
    expect(schema.validators.aspectRatio!('17:5').ok).toBe(false)
    expect(schema.validators.resolution!('1K').ok).toBe(true)
    expect(schema.validators.resolution!('4K').ok).toBe(false)
    expect(schema.validators.referenceImages!([]).ok).toBe(true)
    expect(schema.validators.referenceImages!(['https://example.com/ref.png']).ok).toBe(false)
  })

  it('refuses other modalities and model ids', () => {
    expect(() => resolveComfyUiOptionSchema('video', COMFYUI_TEXT_TO_IMAGE_MODEL_ID)).toThrow('COMFYUI_MODEL_UNSUPPORTED')
    expect(() => resolveComfyUiOptionSchema('image', 'unknown-model')).toThrow('COMFYUI_MODEL_UNSUPPORTED')
  })
})

describe('buildComfyUiAuthHeaders', () => {
  it('sends no Authorization header without a key', () => {
    expect(buildComfyUiAuthHeaders()).toEqual({})
    expect(buildComfyUiAuthHeaders('   ')).toEqual({})
  })

  it('maps user:password onto HTTP Basic per RFC 7617', () => {
    expect(buildComfyUiAuthHeaders('alice:secret')).toEqual({
      Authorization: `Basic ${Buffer.from('alice:secret', 'utf8').toString('base64')}`,
    })
  })

  it('sends any other value as a Bearer token', () => {
    expect(buildComfyUiAuthHeaders('my-token')).toEqual({ Authorization: 'Bearer my-token' })
  })
})

describe('resolveComfyUiBaseUrl', () => {
  it('prefers the configured provider base URL and strips trailing slashes', () => {
    expect(resolveComfyUiBaseUrl('http://192.168.1.10:8188/')).toBe('http://192.168.1.10:8188')
  })

  it('falls back to COMFYUI_BASE_URL, then the loopback default', () => {
    process.env.COMFYUI_BASE_URL = 'http://gpu-box.local:8188'
    expect(resolveComfyUiBaseUrl()).toBe('http://gpu-box.local:8188')
    delete process.env.COMFYUI_BASE_URL
    expect(resolveComfyUiBaseUrl()).toBe('http://127.0.0.1:8188')
  })
})
