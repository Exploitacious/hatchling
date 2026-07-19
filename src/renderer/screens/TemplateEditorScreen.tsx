import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, Copy, Lock, Save } from 'lucide-react'
import { Badge, Button, Field, Input, Spinner } from '@renderer/components/ui'
import { useTemplatesStore } from '@renderer/store/useTemplatesStore'
import { errorMessage } from '@renderer/lib/errorMessage'
import { DEFAULT_OPENING_MESSAGE } from '@shared/constants'

// Element renderers for the live preview. There is no Tailwind typography
// plugin in this project (see tailwind.config.js), so every markdown element
// is styled by hand to stay legible on the dark hatch surface. Defined at
// module scope because the map is static — recreating it per render would
// remount the whole preview tree on each keystroke.
const previewComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mb-3 mt-5 text-xl font-semibold text-hatch-text first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-5 text-lg font-semibold text-hatch-text first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-4 text-base font-semibold text-hatch-text first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-2 mt-4 text-sm font-semibold text-hatch-text first:mt-0">{children}</h4>
  ),
  p: ({ children }) => <p className="mb-3 text-sm leading-relaxed text-hatch-text">{children}</p>,
  a: ({ children, href }) => (
    <a href={href} className="text-hatch-accent underline hover:text-hatch-accent-hover">
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 ml-5 list-disc space-y-1 text-sm text-hatch-text">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 ml-5 list-decimal space-y-1 text-sm text-hatch-text">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-hatch-text">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-2 border-hatch-border pl-3 text-sm italic text-hatch-muted">
      {children}
    </blockquote>
  ),
  // Inline code. Fenced blocks nest a <code> inside <pre>; the <pre> renderer
  // below neutralizes this inline styling so blocks don't get a doubled chip.
  code: ({ children }) => (
    <code className="rounded bg-hatch-surface-2 px-1.5 py-0.5 font-mono text-[0.8125rem] text-hatch-text">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-md border border-hatch-border bg-hatch-surface p-3 font-mono text-[0.8125rem] text-hatch-text [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-4 border-hatch-border" />,
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-hatch-border px-2 py-1 text-left font-semibold text-hatch-text">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-hatch-border px-2 py-1 text-hatch-text">{children}</td>
  )
}

export function TemplateEditorScreen() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const isEditing = Boolean(id)

  const templates = useTemplatesStore((s) => s.templates)
  const loading = useTemplatesStore((s) => s.loading)
  const load = useTemplatesStore((s) => s.load)
  const create = useTemplatesStore((s) => s.create)
  const update = useTemplatesStore((s) => s.update)
  const duplicate = useTemplatesStore((s) => s.duplicate)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [openingMessage, setOpeningMessage] = useState(DEFAULT_OPENING_MESSAGE)
  // The id whose data currently populates the fields. Keying hydration on the
  // id (not a boolean) makes the same-instance route change from a built-in to
  // its fresh copy re-hydrate without flashing the old content.
  const [hydratedId, setHydratedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [duplicating, setDuplicating] = useState(false)

  // Ensure templates are loaded so an editor opened by deep link (or a page
  // refresh) can resolve its id. Guarded by a ref so a load that returns an
  // empty list is not retried into a loop.
  const initiatedLoadRef = useRef(false)
  useEffect(() => {
    if (templates.length === 0 && !loading && !initiatedLoadRef.current) {
      initiatedLoadRef.current = true
      void load()
    }
  }, [templates.length, loading, load])

  // "Settled" means the id can be resolved to a verdict: either the list has
  // entries, or our load attempt has finished. Until then we show a spinner
  // rather than a premature not-found.
  const settled = templates.length > 0 || (initiatedLoadRef.current && !loading)
  const template = isEditing ? templates.find((t) => t.id === id) : undefined
  const notFound = isEditing && settled && !template
  const readOnly = Boolean(template?.isBuiltin)

  // Populate local fields once the target template is available, re-running if
  // the route id changes underneath us (built-in -> duplicated copy).
  useEffect(() => {
    if (!isEditing || !id || hydratedId === id || !template) return
    setName(template.name)
    setDescription(template.description ?? '')
    setContent(template.content)
    setOpeningMessage(template.openingMessage)
    setHydratedId(id)
  }, [isEditing, id, template, hydratedId])

  const showSpinner = isEditing && !notFound && hydratedId !== id
  const canSave = !readOnly && name.trim().length > 0 && !saving

  async function handleSave(): Promise<void> {
    if (!canSave) return
    setSaving(true)
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      content,
      openingMessage: openingMessage.trim() || DEFAULT_OPENING_MESSAGE
    }
    try {
      if (isEditing && id) {
        await update({ id, ...payload })
        toast.success('Template saved.')
      } else {
        await create(payload)
        toast.success('Template created.')
      }
      navigate('/templates')
    } catch (err) {
      toast.error(errorMessage(err))
      setSaving(false) // navigate unmounts on success; only reset on failure
    }
  }

  async function handleDuplicate(): Promise<void> {
    if (!id || duplicating) return
    setDuplicating(true)
    try {
      const copy = await duplicate(id)
      toast.success('Duplicated — now editing your copy.')
      navigate(`/templates/${copy.id}/edit`)
    } catch (err) {
      toast.error(errorMessage(err))
      setDuplicating(false)
    }
  }

  // Cmd/Ctrl+S saves. A latest-ref keeps the window listener stable across
  // renders while always calling the current save closure (which closes over
  // the live field values).
  const saveRef = useRef(handleSave)
  useEffect(() => {
    saveRef.current = handleSave
  })
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        void saveRef.current()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (notFound) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <div>
          <h1 className="text-lg font-semibold text-hatch-text">Template not found</h1>
          <p className="mt-1 text-sm text-hatch-muted">
            This template may have been deleted or the link is out of date.
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/templates')}>
          <ArrowLeft className="h-4 w-4" />
          Back to templates
        </Button>
      </div>
    )
  }

  if (showSpinner) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-6">
      <div className="flex shrink-0 items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-hatch-text">
            {isEditing ? 'Edit template' : 'New template'}
            {readOnly && <Badge tone="accent">Built-in</Badge>}
          </h1>
          <p className="text-sm text-hatch-muted">
            Write the personality file in markdown; the preview updates live.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" onClick={() => navigate('/templates')}>
            Cancel
          </Button>
          {!readOnly && (
            <Button variant="primary" onClick={() => void handleSave()} disabled={!canSave}>
              {saving ? <Spinner className="text-black" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          )}
        </div>
      </div>

      {readOnly && (
        <div className="flex shrink-0 items-center justify-between gap-4 rounded-md border border-hatch-border bg-hatch-surface-2 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-hatch-muted">
            <Lock className="h-4 w-4 shrink-0" aria-hidden />
            The built-in template is read-only. Duplicate it to edit.
          </div>
          <Button
            variant="secondary"
            onClick={() => void handleDuplicate()}
            disabled={duplicating}
          >
            {duplicating ? <Spinner /> : <Copy className="h-4 w-4" />}
            Duplicate to edit
          </Button>
        </div>
      )}

      <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Name" htmlFor="template-name">
          <Input
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Snarky Sidekick"
            disabled={readOnly}
          />
        </Field>
        <Field label="Description" htmlFor="template-description">
          <Input
            id="template-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional — a short summary"
            disabled={readOnly}
          />
        </Field>
        <Field label="Opening message" htmlFor="template-opening">
          <Input
            id="template-opening"
            value={openingMessage}
            onChange={(e) => setOpeningMessage(e.target.value)}
            disabled={readOnly}
          />
        </Field>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-md border border-hatch-border">
          <div className="shrink-0 border-b border-hatch-border px-3 py-1.5 text-xs font-medium text-hatch-muted">
            Markdown
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <CodeMirror
              value={content}
              onChange={setContent}
              extensions={[markdown()]}
              theme="dark"
              height="100%"
              editable={!readOnly}
              readOnly={readOnly}
              className="h-full text-sm"
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-md border border-hatch-border">
          <div className="shrink-0 border-b border-hatch-border px-3 py-1.5 text-xs font-medium text-hatch-muted">
            Preview
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4">
            {content.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={previewComponents}>
                {content}
              </ReactMarkdown>
            ) : (
              <p className="text-sm text-hatch-muted">Nothing to preview yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
