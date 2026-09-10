import { fetchWithProviderProxy } from '@/lib/http/outbound-proxy'
import { projectConnectionTestFailure } from '@/lib/ai-providers/shared/connection-test'
import { captureProviderHttpFailure } from '@/lib/ai-providers/failure'
import type {
  AiProviderConnectionTester,
  AiProviderConnectionTestStep,
} from '@/lib/ai-providers/runtime-types'
import { buildComfyUiUrl, resolveComfyUiBaseUrl } from './config'
import { comfyUiFailureAdapter } from './failure'

export const comfyUiConnectionTester: AiProviderConnectionTester = {
  diagnose: async (input) => {
    const steps: AiProviderConnectionTestStep[] = []
    const baseUrl = resolveComfyUiBaseUrl(input.baseUrl)
    try {
      const response = await fetchWithProviderProxy(buildComfyUiUrl(baseUrl, 'system_stats'), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) {
        const failure = await captureProviderHttpFailure({
          response,
          provider: 'comfyui',
          phase: 'connection',
        })
        steps.push({ name: 'models', status: 'fail', ...projectConnectionTestFailure(comfyUiFailureAdapter, failure) })
        return { success: false, steps }
      }
      steps.push({ name: 'models', status: 'pass', messageKey: 'connectionTest.modelsOk' })
      steps.push({ name: 'imageGen', status: 'skip', messageKey: 'connectionTest.skippedSpend' })
      return { success: true, steps }
    } catch (error) {
      steps.push({ name: 'models', status: 'fail', ...projectConnectionTestFailure(comfyUiFailureAdapter, error) })
      return { success: false, steps }
    }
  },
}
