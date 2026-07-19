import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { ModelInfo } from '@shared/types'
import { Button, Field, Input, Modal, Select, Spinner, Textarea } from '@renderer/components/ui'
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

  // Load data and reset the form each time the modal opens.
  useEffect(() => {
    if (!open) return
    void loadProviders()
    void loadTemplates()
    setName(defaultSessionName())
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
    setSubmitting(true)
    try {
      const session = await createSession({
        name: name.trim() || defaultSessionName(),
        templateId,
        providerId,
        model: model.trim(),
        openingMessage
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
            ) : models.length > 0 ? (
              <Select id="hatch-model" value={model} onChange={(e) => setModel(e.target.value)}>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
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
        </div>
      )}
    </Modal>
  )
}
