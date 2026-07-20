import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ModelInfo } from '@shared/types'
import { Button, Field, Input, Modal, Select, Spinner, Textarea } from '@renderer/components/ui'
import { formatTokens } from '@renderer/lib/format'
import { useUiStore } from '@renderer/store/useUiStore'
import { useProvidersStore } from '@renderer/store/useProvidersStore'
import { useTemplatesStore } from '@renderer/store/useTemplatesStore'
import { useSessionsStore } from '@renderer/store/useSessionsStore'
import { useSettingsStore } from '@renderer/store/useSettingsStore'
import { errorMessage } from '@renderer/lib/errorMessage'

function defaultSessionName(): string {
  const d = new Date()
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
  return `Hatch — ${date}`
}

export function NewHatchModal() {
  const open = useUiStore((s) => s.newHatchOpen)
  const close = useUiStore((s) => s.closeNewHatch)
  const navigate = useNavigate()

  const providers = useProvidersStore((s) => s.providers)
  const loadProviders = useProvidersStore((s) => s.load)
  const listModels = useProvidersStore((s) => s.listModels)
  const templates = useTemplatesStore((s) => s.templates)
  const loadTemplates = useTemplatesStore((s) => s.load)
  const createSession = useSessionsStore((s) => s.create)
  const defaultProviderId = useSettingsStore((s) => s.defaultProviderId)
  const defaultModel = useSettingsStore((s) => s.defaultModel)

  const [name, setName] = useState(defaultSessionName())
  const [templateId, setTemplateId] = useState('')
  const [providerId, setProviderId] = useState('')
  const [model, setModel] = useState('')
  const [openingMessage, setOpeningMessage] = useState('')
  const [models, setModels] = useState<ModelInfo[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Advanced options — all optional; defaults apply when left blank.
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [customModel, setCustomModel] = useState(false)
  const [contextOverride, setContextOverride] = useState('')
  const [temperature, setTemperature] = useState('')

  // Load data and reset the form each time the modal opens. Resetting
  // `submitting` here matters: the component never unmounts (it renders null
  // when closed), so a successful start would otherwise leave the flag stuck
  // true and the Start button disabled-with-spinner on every later open.
  useEffect(() => {
    if (!open) return
    void loadProviders()
    void loadTemplates()
    setName(defaultSessionName())
    setSubmitting(false)
    setAdvancedOpen(false)
    setCustomModel(false)
    setContextOverride('')
    setTemperature('')
  }, [open, loadProviders, loadTemplates])

  // Seed default template + provider once the lists are present.
  useEffect(() => {
    if (!open) return
    if (!templateId && templates.length > 0) {
      const initial = templates.find((t) => t.isBuiltin) ?? templates[0]
      setTemplateId(initial.id)
      setOpeningMessage(initial.openingMessage)
    }
    if (!providerId && providers.length > 0) {
      const preferred =
        defaultProviderId && providers.some((p) => p.id === defaultProviderId)
          ? defaultProviderId
          : providers[0].id
      setProviderId(preferred)
    }
  }, [open, templates, providers, templateId, providerId, defaultProviderId])

  // Load models whenever the selected provider changes.
  useEffect(() => {
    if (!open || !providerId) return
    let cancelled = false
    setModels([])
    setModelsError(null)
    setModelsLoading(true)
    listModels(providerId)
      .then((list) => {
        if (cancelled) return
        setModels(list)
        const preferred =
          defaultProviderId === providerId && defaultModel && list.some((m) => m.id === defaultModel)
            ? defaultModel
            : (list[0]?.id ?? '')
        setModel(preferred)
        setModelsLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setModelsError(errorMessage(err))
        setModel('')
        setModelsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, providerId, listModels, defaultProviderId, defaultModel])

  function onTemplateChange(id: string): void {
    setTemplateId(id)
    const template = templates.find((t) => t.id === id)
    if (template) setOpeningMessage(template.openingMessage)
  }

  const canStart = Boolean(templateId && providerId && model.trim()) && !submitting

  async function start(): Promise<void> {
    if (!canStart) return

    // Validate advanced fields up front so bad values fail here, not mid-hatch.
    const contextText = contextOverride.trim()
    const parsedContext = contextText ? Number(contextText) : undefined
    if (parsedContext !== undefined && (!Number.isFinite(parsedContext) || parsedContext <= 0)) {
      toast.error('Context window must be a positive number of tokens.')
      return
    }
    const tempText = temperature.trim()
    const parsedTemp = tempText ? Number(tempText) : undefined
    if (parsedTemp !== undefined && (!Number.isFinite(parsedTemp) || parsedTemp < 0)) {
      toast.error('Temperature must be a number ≥ 0 (the provider validates its own range).')
      return
    }

    // Effective window: the user's override wins; otherwise the provider-reported
    // window for the selected model; otherwise unknown (app default, "estimated").
    const reported = models.find((m) => m.id === model.trim())?.contextWindow
    const resolvedWindow = parsedContext ?? reported

    setSubmitting(true)
    try {
      const session = await createSession({
        name: name.trim() || defaultSessionName(),
        templateId,
        providerId,
        model: model.trim(),
        openingMessage,
        contextWindow: resolvedWindow !== undefined ? Math.floor(resolvedWindow) : undefined,
        temperature: parsedTemp
      })
      close()
      navigate(`/sessions/${session.id}/chat`)
    } catch (err) {
      toast.error(errorMessage(err))
      setSubmitting(false)
    }
  }

  const noProviders = providers.length === 0

  return (
    <Modal
      open={open}
      onClose={close}
      title="New Hatch"
      footer={
        !noProviders && (
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" onClick={start} disabled={!canStart}>
              {submitting ? <Spinner className="text-black" /> : null}
              Start Hatching
            </Button>
          </>
        )
      }
    >
      {noProviders ? (
        <div className="space-y-4">
          <p className="text-sm text-hatch-muted">
            No providers are configured yet. Add one — including the offline Mock provider — to
            start hatching.
          </p>
          <Button
            variant="primary"
            onClick={() => {
              close()
              navigate('/settings')
            }}
          >
            Go to Settings
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Session name" htmlFor="hatch-name">
            <Input id="hatch-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

          <Field label="Template" htmlFor="hatch-template">
            <Select
              id="hatch-template"
              value={templateId}
              onChange={(e) => onTemplateChange(e.target.value)}
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Provider" htmlFor="hatch-provider">
            <Select
              id="hatch-provider"
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Model"
            htmlFor="hatch-model"
            hint={modelsError ? `${modelsError} — enter a model id manually.` : undefined}
          >
            {modelsLoading ? (
              <div className="flex h-10 items-center gap-2 text-sm text-hatch-muted">
                <Spinner /> Loading models…
              </div>
            ) : models.length > 0 && !customModel ? (
              <Select id="hatch-model" value={model} onChange={(e) => setModel(e.target.value)}>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.contextWindow ? `${m.id} · ${formatTokens(m.contextWindow)}` : m.id}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                id="hatch-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Enter a model id"
              />
            )}
          </Field>

          <Field label="Opening message" htmlFor="hatch-opening">
            <Textarea
              id="hatch-opening"
              rows={2}
              value={openingMessage}
              onChange={(e) => setOpeningMessage(e.target.value)}
            />
          </Field>

          <div>
            <button
              type="button"
              className="flex items-center gap-1 text-xs font-medium text-hatch-muted transition-colors hover:text-hatch-text"
              onClick={() => setAdvancedOpen((v) => !v)}
              aria-expanded={advancedOpen}
            >
              {advancedOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              Advanced
            </button>

            {advancedOpen && (
              <div className="mt-3 space-y-4 rounded-md border border-hatch-border bg-hatch-surface-2 p-4">
                <label className="flex items-center gap-2 text-sm text-hatch-text">
                  <input
                    type="checkbox"
                    checked={customModel}
                    onChange={(e) => {
                      setCustomModel(e.target.checked)
                      if (e.target.checked) setModel('')
                    }}
                    className="h-4 w-4 accent-hatch-accent"
                  />
                  Enter a custom model id
                </label>

                <Field
                  label="Context window override (tokens)"
                  htmlFor="hatch-context"
                  hint="Blank = the model's reported window, or the app default when unknown."
                >
                  <Input
                    id="hatch-context"
                    inputMode="numeric"
                    value={contextOverride}
                    onChange={(e) => setContextOverride(e.target.value)}
                    placeholder="e.g. 1000000"
                  />
                </Field>

                <Field
                  label="Temperature"
                  htmlFor="hatch-temperature"
                  hint="Blank = provider default. Unsupported values are rejected by the provider."
                >
                  <Input
                    id="hatch-temperature"
                    inputMode="decimal"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    placeholder="e.g. 0.7"
                  />
                </Field>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
