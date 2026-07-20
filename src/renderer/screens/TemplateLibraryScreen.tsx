import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FilePlus, Pencil, Copy, Trash2, Upload, Plus } from 'lucide-react'
import type { Template } from '@shared/types'
import { Badge, Button, Card, EmptyState, IconButton, Modal } from '@renderer/components/ui'
import { useTemplatesStore } from '@renderer/store/useTemplatesStore'
import { formatDateTime } from '@renderer/lib/format'
import { errorMessage } from '@renderer/lib/errorMessage'

/** Strips a file extension for use as the default template name on import. */
function stripExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(0, dot) : fileName
}

export function TemplateLibraryScreen() {
  const navigate = useNavigate()
  const templates = useTemplatesStore((s) => s.templates)
  const loading = useTemplatesStore((s) => s.loading)
  const load = useTemplatesStore((s) => s.load)
  const duplicate = useTemplatesStore((s) => s.duplicate)
  const remove = useTemplatesStore((s) => s.remove)
  const create = useTemplatesStore((s) => s.create)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<Template | null>(null)

  useEffect(() => {
    void load()
  }, [load])

  function openImportPicker(): void {
    fileInputRef.current?.click()
  }

  function onFileSelected(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    // Reset the input so selecting the same file twice still fires onChange.
    event.target.value = ''
    if (!file) return

    setImporting(true)
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      create({ name: stripExtension(file.name), content: text })
        .then(() => {
          toast.success(`Imported "${file.name}"`)
        })
        .catch((err: unknown) => {
          toast.error(errorMessage(err))
        })
        .finally(() => {
          setImporting(false)
        })
    }
    reader.onerror = () => {
      toast.error('Could not read that file.')
      setImporting(false)
    }
    reader.readAsText(file)
  }

  async function onDuplicate(template: Template): Promise<void> {
    setDuplicatingId(template.id)
    try {
      await duplicate(template.id)
      toast.success(`Duplicated "${template.name}"`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setDuplicatingId(null)
    }
  }

  async function onConfirmDelete(): Promise<void> {
    if (!confirmTarget) return
    const template = confirmTarget
    setDeletingId(template.id)
    try {
      await remove(template.id)
      toast.success(`Deleted "${template.name}"`)
      setConfirmTarget(null)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-hatch-text">Templates</h1>
          <p className="text-sm text-hatch-muted">
            Personality files that seed a hatch — reusable, editable, and forkable.
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,text/markdown"
            className="hidden"
            onChange={onFileSelected}
          />
          <Button variant="secondary" onClick={openImportPicker} disabled={importing}>
            <Upload className="h-4 w-4" />
            {importing ? 'Importing…' : 'Import'}
          </Button>
        </div>
      </div>

      {!loading && templates.length === 0 ? (
        <EmptyState
          icon={FilePlus}
          title="No templates yet"
          description="Create a template or import a markdown file to get started."
          action={
            <Button variant="primary" onClick={() => navigate('/templates/new')}>
              Create new
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => {
            const previewLine = template.openingMessage.split('\n')[0]?.trim()
            return (
              <Card key={template.id} className="group relative flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-medium text-hatch-text">{template.name}</h2>
                    {template.isBuiltin && (
                      <Badge tone="accent" className="mt-1.5">
                        Built-in
                      </Badge>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <IconButton
                      label="Edit template"
                      onClick={() => navigate(`/templates/${template.id}/edit`)}
                    >
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label="Duplicate template"
                      disabled={duplicatingId === template.id}
                      onClick={() => void onDuplicate(template)}
                    >
                      <Copy className="h-4 w-4" />
                    </IconButton>
                    {!template.isBuiltin && (
                      <IconButton
                        label="Delete template"
                        disabled={deletingId === template.id}
                        onClick={() => setConfirmTarget(template)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    )}
                  </div>
                </div>

                {previewLine && (
                  <p className="line-clamp-2 text-sm text-hatch-muted">{previewLine}</p>
                )}

                <p className="mt-auto text-xs text-hatch-muted">
                  Updated {formatDateTime(template.updatedAt)}
                </p>
              </Card>
            )
          })}

          <Card
            interactive
            role="button"
            tabIndex={0}
            onClick={() => navigate('/templates/new')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                navigate('/templates/new')
              }
            }}
            className="flex min-h-[9.5rem] flex-col items-center justify-center gap-2 border-dashed text-hatch-muted"
          >
            <Plus className="h-6 w-6" aria-hidden />
            <span className="text-sm font-medium">Create new</span>
          </Card>
        </div>
      )}

      <Modal
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        title="Delete template"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void onConfirmDelete()}
              disabled={deletingId === confirmTarget?.id}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-hatch-muted">
          Delete "{confirmTarget?.name}"? This cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
