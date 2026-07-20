import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Check, Eye, EyeOff, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import type {
  CreateProviderInput,
  KeyStorageMode,
  ModelInfo,
  Provider,
  ProviderShape
} from '@shared/types'
import { PROVIDER_SHAPES } from '@shared/constants'
import { invoke } from '@renderer/lib/ipc'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Select,
  Spinner,
  Tabs,
  Toggle
} from '@renderer/components/ui'
import { useProvidersStore } from '@renderer/store/useProvidersStore'
import { useSettingsStore } from '@renderer/store/useSettingsStore'
import { errorMessage } from '@renderer/lib/errorMessage'

type SettingsTab = 'providers' | 'models'

function shapeMeta(shape: ProviderShape) {
  return PROVIDER_SHAPES.find((s) => s.shape === shape)
}

export function SettingsScreen() {
  const [tab, setTab] = useState<SettingsTab>('providers')
  const theme = useSettingsStore((s) => s.theme)
  const toggleTheme = useSettingsStore((s) => s.toggleTheme)

  return (
    <div className="mx-auto h-full max-w-4xl space-y-6 overflow-y-auto p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-hatch-text">Settings</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-hatch-muted">Dark mode</span>
          <Toggle checked={theme === 'dark'} onChange={toggleTheme} label="Toggle dark mode" />
        </div>
      </div>

      <Tabs
        tabs={[
          { id: 'providers', label: 'Providers' },
          { id: 'models', label: 'Models' }
        ]}
        active={tab}
        onChange={(id) => setTab(id as SettingsTab)}
      />

      {tab === 'providers' ? <ProvidersTab /> : <ModelsTab />}
    </div>
  )
}

function ProvidersTab() {
  const providers = useProvidersStore((s) => s.providers)
  const loading = useProvidersStore((s) => s.loading)
  const load = useProvidersStore((s) => s.load)
  const create = useProvidersStore((s) => s.create)

  useEffect(() => {
    void load()
  }, [load])

  if (loading && providers.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <StorageModeBanner />
      {providers.length === 0 ? (
        <EmptyState
          title="No providers configured"
          description="Add a provider below to start hatching — including the offline Mock provider, which needs no key or network."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {providers.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} />
          ))}
        </div>
      )}
      <AddProviderCard onCreate={create} />
    </div>
  )
}

/**
 * Warns when API keys aren't in the OS keychain. Silent in the normal case
 * (keychain present); shows the app-key fallback downgrade or the no-storage
 * error when relevant.
 */
function StorageModeBanner() {
  const [mode, setMode] = useState<KeyStorageMode | null>(null)

  useEffect(() => {
    let active = true
    void invoke('apiKeys:storageMode', undefined).then((m) => {
      if (active) setMode(m)
    })
    return () => {
      active = false
    }
  }, [])

  if (mode === null || mode === 'os-keychain') return null
  const unavailable = mode === 'unavailable'

  return (
    <div className="flex items-start gap-3 rounded-md border border-hatch-warning/40 bg-hatch-warning/10 px-4 py-3 text-sm">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-hatch-warning" />
      <div className="text-hatch-text">
        {unavailable ? (
          <>
            <span className="font-medium">Key storage unavailable.</span> No secure store
            was found, so API keys can&apos;t be saved on this system. Install an OS
            keychain (gnome-keyring / libsecret or kwallet) and restart. The offline Mock
            provider still works without a key.
          </>
        ) : (
          <>
            <span className="font-medium">OS keychain unavailable.</span> API keys are
            encrypted with an app-managed key stored in your data folder. This works
            everywhere but is weaker than a system keychain — anyone who can read your user
            data can read your keys.
          </>
        )}
      </div>
    </div>
  )
}

function ProviderCard({ provider }: { provider: Provider }) {
  const update = useProvidersStore((s) => s.update)
  const remove = useProvidersStore((s) => s.remove)
  const saveKey = useProvidersStore((s) => s.saveKey)
  const hasKey = useProvidersStore((s) => s.hasKey)
  const testConnection = useProvidersStore((s) => s.testConnection)

  const meta = shapeMeta(provider.shape)

  const [baseUrl, setBaseUrl] = useState(provider.baseUrl ?? '')
  const [savingBaseUrl, setSavingBaseUrl] = useState(false)

  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [keySet, setKeySet] = useState<boolean | null>(null)

  const [testing, setTesting] = useState(false)
  const [testOk, setTestOk] = useState<boolean | null>(null)

  const [removing, setRemoving] = useState(false)

  // Keep the local edit buffer in sync if the store's copy changes underneath us
  // (e.g. after our own save round-trips through the main process).
  useEffect(() => {
    setBaseUrl(provider.baseUrl ?? '')
  }, [provider.baseUrl])

  useEffect(() => {
    if (!meta?.needsApiKey) return
    let cancelled = false
    hasKey(provider.id)
      .then((result) => {
        if (!cancelled) setKeySet(result)
      })
      .catch((err) => {
        if (!cancelled) toast.error(errorMessage(err))
      })
    return () => {
      cancelled = true
    }
  }, [provider.id, meta?.needsApiKey, hasKey])

  async function saveBaseUrl(): Promise<void> {
    // Skip the round-trip when the field didn't actually change on blur.
    if (baseUrl === (provider.baseUrl ?? '')) return
    setSavingBaseUrl(true)
    try {
      await update({ id: provider.id, baseUrl: baseUrl.trim() || null })
      toast.success('Base URL saved')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSavingBaseUrl(false)
    }
  }

  async function handleSaveKey(): Promise<void> {
    if (!apiKey.trim()) return
    setSavingKey(true)
    try {
      await saveKey(provider.id, apiKey.trim())
      setKeySet(true)
      setApiKey('')
      setShowKey(false)
      toast.success('API key saved')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSavingKey(false)
    }
  }

  async function handleTest(): Promise<void> {
    setTesting(true)
    setTestOk(null)
    try {
      const result = await testConnection(provider.id)
      setTestOk(result.ok)
      if (result.ok) {
        toast.success('Connection ok')
      } else {
        toast.error(result.error ?? 'Connection failed')
      }
    } catch (err) {
      setTestOk(false)
      toast.error(errorMessage(err))
    } finally {
      setTesting(false)
    }
  }

  async function handleRemove(): Promise<void> {
    if (!window.confirm(`Remove provider "${provider.name}"? This cannot be undone.`)) return
    setRemoving(true)
    try {
      await remove(provider.id)
      toast.success('Provider removed')
    } catch (err) {
      toast.error(errorMessage(err))
      setRemoving(false)
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-hatch-text">{provider.name}</p>
          <Badge tone="neutral" className="mt-1">
            {meta?.label ?? provider.shape}
          </Badge>
        </div>
        <IconButton label="Remove provider" onClick={() => void handleRemove()} disabled={removing}>
          {removing ? <Spinner /> : <Trash2 className="h-4 w-4" />}
        </IconButton>
      </div>

      {meta?.needsBaseUrl && (
        <Field label="Base URL" htmlFor={`base-url-${provider.id}`}>
          <Input
            id={`base-url-${provider.id}`}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            onBlur={() => void saveBaseUrl()}
            placeholder={meta.defaultBaseUrl}
            disabled={savingBaseUrl}
          />
        </Field>
      )}

      {meta?.needsApiKey && (
        <Field label="API key" htmlFor={`api-key-${provider.id}`}>
          <>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  id={`api-key-${provider.id}`}
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={keySet ? 'Key set — enter a new key to replace it' : 'Enter API key'}
                  className="pr-9"
                />
                <IconButton
                  label={showKey ? 'Hide key' : 'Show key'}
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-1 top-1 h-7 w-7"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </IconButton>
              </div>
              <Button
                variant="secondary"
                onClick={() => void handleSaveKey()}
                disabled={savingKey || !apiKey.trim()}
              >
                {savingKey ? <Spinner /> : null}
                Save key
              </Button>
            </div>
            {keySet === true && (
              <p className="flex items-center gap-1 text-xs text-hatch-success">
                <Check className="h-3.5 w-3.5" /> Key set
              </p>
            )}
          </>
        </Field>
      )}

      <div className="mt-1 flex items-center gap-2">
        <Button variant="secondary" onClick={() => void handleTest()} disabled={testing}>
          {testing ? <Spinner /> : null}
          Test connection
        </Button>
        {testOk === true && (
          <span className="flex items-center gap-1 text-xs text-hatch-success">
            <Check className="h-3.5 w-3.5" /> Connected
          </span>
        )}
      </div>
    </Card>
  )
}

interface AddProviderCardProps {
  onCreate: (input: CreateProviderInput) => Promise<Provider>
}

function AddProviderCard({ onCreate }: AddProviderCardProps) {
  const [shape, setShape] = useState<ProviderShape>(PROVIDER_SHAPES[0].shape)
  const meta = shapeMeta(shape)
  const [name, setName] = useState(meta?.label ?? '')
  const [baseUrl, setBaseUrl] = useState(meta?.defaultBaseUrl ?? '')
  const [creating, setCreating] = useState(false)

  function onShapeChange(next: ProviderShape): void {
    setShape(next)
    const nextMeta = shapeMeta(next)
    setName(nextMeta?.label ?? '')
    setBaseUrl(nextMeta?.defaultBaseUrl ?? '')
  }

  async function handleCreate(): Promise<void> {
    if (!name.trim()) return
    setCreating(true)
    try {
      await onCreate({
        shape,
        name: name.trim(),
        baseUrl: meta?.needsBaseUrl ? baseUrl.trim() || null : null
      })
      toast.success('Provider added')
      onShapeChange(PROVIDER_SHAPES[0].shape)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Plus className="h-4 w-4 text-hatch-muted" />
        <p className="text-sm font-medium text-hatch-text">Add provider</p>
      </div>

      <Field label="Type" htmlFor="new-provider-shape">
        <Select
          id="new-provider-shape"
          value={shape}
          onChange={(e) => onShapeChange(e.target.value as ProviderShape)}
        >
          {PROVIDER_SHAPES.map((s) => (
            <option key={s.shape} value={s.shape}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Name" htmlFor="new-provider-name">
        <Input id="new-provider-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>

      {meta?.needsBaseUrl && (
        <Field label="Base URL" htmlFor="new-provider-baseurl">
          <Input
            id="new-provider-baseurl"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={meta.defaultBaseUrl}
          />
        </Field>
      )}

      <p className="text-xs text-hatch-muted">{meta?.description}</p>

      <Button variant="primary" onClick={() => void handleCreate()} disabled={creating || !name.trim()}>
        {creating ? <Spinner className="text-black" /> : null}
        Add
      </Button>
    </Card>
  )
}

function ModelsTab() {
  const providers = useProvidersStore((s) => s.providers)
  const loadProviders = useProvidersStore((s) => s.load)
  const listModels = useProvidersStore((s) => s.listModels)
  const defaultProviderId = useSettingsStore((s) => s.defaultProviderId)
  const defaultModel = useSettingsStore((s) => s.defaultModel)
  const setDefaultModel = useSettingsStore((s) => s.setDefaultModel)

  const [providerId, setProviderId] = useState(defaultProviderId ?? '')
  const [models, setModels] = useState<ModelInfo[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [manualModel, setManualModel] = useState('')

  useEffect(() => {
    void loadProviders()
  }, [loadProviders])

  // Seed a provider selection once the list is available.
  useEffect(() => {
    if (providerId || providers.length === 0) return
    const preferred =
      defaultProviderId && providers.some((p) => p.id === defaultProviderId)
        ? defaultProviderId
        : providers[0].id
    setProviderId(preferred)
  }, [providers, providerId, defaultProviderId])

  useEffect(() => {
    if (!providerId) return
    let cancelled = false
    setModels([])
    setModelsError(null)
    setModelsLoading(true)
    listModels(providerId)
      .then((list) => {
        if (cancelled) return
        setModels(list)
        setModelsLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setModelsError(errorMessage(err))
        setModelsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [providerId, listModels])

  function chooseModel(model: string): void {
    if (!providerId || !model.trim()) return
    setDefaultModel(providerId, model.trim())
    toast.success('Default model set')
  }

  if (providers.length === 0) {
    return (
      <EmptyState
        title="No providers configured"
        description="Add a provider on the Providers tab before choosing a default model."
      />
    )
  }

  const currentProvider = providers.find((p) => p.id === defaultProviderId)

  return (
    <div className="max-w-md space-y-4">
      {defaultProviderId && defaultModel && (
        <p className="text-sm text-hatch-muted">
          Current default: <span className="text-hatch-text">{currentProvider?.name ?? defaultProviderId}</span> /{' '}
          <span className="text-hatch-text">{defaultModel}</span>
        </p>
      )}

      <Field label="Provider" htmlFor="models-provider">
        <Select id="models-provider" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Default model"
        htmlFor="models-model"
        hint={modelsError ? `${modelsError} — enter a model id manually.` : undefined}
      >
        {modelsLoading ? (
          <div className="flex h-10 items-center gap-2 text-sm text-hatch-muted">
            <Spinner /> Loading models…
          </div>
        ) : models.length > 0 ? (
          <Select
            id="models-model"
            value={
              defaultProviderId === providerId &&
              defaultModel &&
              models.some((m) => m.id === defaultModel)
                ? defaultModel
                : ''
            }
            onChange={(e) => chooseModel(e.target.value)}
          >
            <option value="" disabled>
              Select a model
            </option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id}
              </option>
            ))}
          </Select>
        ) : (
          <div className="flex gap-2">
            <Input
              id="models-model"
              value={manualModel}
              onChange={(e) => setManualModel(e.target.value)}
              placeholder="Enter a model id"
            />
            <Button
              variant="secondary"
              onClick={() => chooseModel(manualModel)}
              disabled={!manualModel.trim()}
            >
              Set
            </Button>
          </div>
        )}
      </Field>
    </div>
  )
}
