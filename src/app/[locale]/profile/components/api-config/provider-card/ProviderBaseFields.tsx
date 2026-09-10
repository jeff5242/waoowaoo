'use client'

import type { ProviderCardProps, ProviderCardTranslator } from './types'
import type { UseProviderCardStateResult } from './hooks/useProviderCardState'
import { AppIcon } from '@/components/ui/icons'

interface ProviderBaseFieldsProps {
  provider: ProviderCardProps['provider']
  t: ProviderCardTranslator
  state: UseProviderCardStateResult
  showBaseUrlField?: boolean
}

export function ProviderBaseFields({ provider, t, state, showBaseUrlField }: ProviderBaseFieldsProps) {
  const requiresApiKey = provider.requiresApiKey !== false
  // A provider without an API key requirement is configured entirely by its
  // base URL, so the URL row always shows for it.
  const showBaseUrl = showBaseUrlField || !requiresApiKey
  return (
    <div className="space-y-2 px-4 pt-3">
      {requiresApiKey ? (
        <div className="glass-surface-soft flex items-center gap-3 rounded-xl px-3 py-2">
          <span className="shrink-0 text-xs font-medium text-[var(--glass-text-secondary)]">
            {t('apiKeyLabel')}
          </span>
          {state.isEditing ? (
            <form
              className="flex min-w-0 flex-1 items-center gap-2"
              onSubmit={(event) => { event.preventDefault(); state.handleSaveKey() }}
            >
              <input
                type="password"
                autoComplete="off"
                value={state.tempKey}
                onChange={(event) => state.setTempKey(event.target.value)}
                placeholder={t('enterApiKey')}
                aria-label={t('apiKeyLabel')}
                className="glass-input-base min-w-0 flex-1 px-3 py-1.5 text-xs"
                autoFocus
              />
              <button type="submit" className="glass-icon-btn-sm" aria-label={t('save')}>
                <AppIcon name="check" className="h-4 w-4" />
              </button>
              <button type="button" onClick={state.handleCancelEdit} className="glass-icon-btn-sm" aria-label={t('cancel')}>
                <AppIcon name="close" className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="text-xs text-[var(--glass-text-tertiary)]">
                {provider.hasApiKey ? t('keyConfigured') : t('notConfigured')}
              </span>
              <button type="button" onClick={state.startEditKey} className="glass-btn-base glass-btn-soft px-2.5 py-1.5 text-xs">
                <AppIcon name={provider.hasApiKey ? 'edit' : 'plus'} className="h-3.5 w-3.5" />
                {provider.hasApiKey ? t('configure') : t('configureApiKey')}
              </button>
            </div>
          )}
        </div>
      ) : null}
      {showBaseUrl ? (
        <div className="glass-surface-soft flex items-center gap-3 rounded-xl px-3 py-2">
          <span className="shrink-0 text-xs font-medium text-[var(--glass-text-secondary)]">
            {t('baseUrl')}
          </span>
          {state.isEditingBaseUrl ? (
            <form
              className="flex min-w-0 flex-1 items-center gap-2"
              onSubmit={(event) => { event.preventDefault(); state.handleSaveBaseUrl() }}
            >
              <input
                type="url"
                autoComplete="off"
                value={state.tempBaseUrl}
                onChange={(event) => state.setTempBaseUrl(event.target.value)}
                placeholder={t('enterBaseUrl')}
                aria-label={t('baseUrl')}
                className="glass-input-base min-w-0 flex-1 px-3 py-1.5 text-xs"
                autoFocus
              />
              <button type="submit" className="glass-icon-btn-sm" aria-label={t('save')}>
                <AppIcon name="check" className="h-4 w-4" />
              </button>
              <button type="button" onClick={state.handleCancelEditBaseUrl} className="glass-icon-btn-sm" aria-label={t('cancel')}>
                <AppIcon name="close" className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="truncate text-xs text-[var(--glass-text-tertiary)]">
                {provider.baseUrl || t('notConfigured')}
              </span>
              <button type="button" onClick={state.startEditBaseUrl} className="glass-btn-base glass-btn-soft px-2.5 py-1.5 text-xs">
                <AppIcon name={provider.baseUrl ? 'edit' : 'plus'} className="h-3.5 w-3.5" />
                {t('configureBaseUrl')}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
