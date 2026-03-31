import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { filesApi } from '@/lib/api-client'
import { useRef } from 'react'
import { Upload, Trash2, FileBox } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/files')({
  component: FilesPage,
})

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function FilesPage() {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['files'],
    queryFn: filesApi.list,
  })

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => filesApi.upload(formData),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['files'] }),
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => filesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['files'] }),
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('name', file.name.replace(/\.3mf$/i, ''))
    uploadMutation.mutate(formData)

    // Reset input
    e.target.value = ''
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Fajlovi</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{files.length} .3mf fajlova</p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
          className={cn(buttonClass, 'flex items-center gap-2')}
        >
          <Upload className="w-4 h-4" />
          {uploadMutation.isPending ? 'Upload...' : 'Upload .3mf'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".3mf"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {uploadMutation.error && (
        <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-destructive text-sm">
          {uploadMutation.error.message}
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Učitavanje...</p>
      ) : files.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <FileBox className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nema fajlova. Uploadujte prvi .3mf fajl.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card divide-y divide-border">
          {files.map(file => (
            <div key={file.id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileBox className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{file.originalFilename} · {formatBytes(file.fileSizeBytes)}</p>
                </div>
              </div>
              <button
                onClick={() => removeMutation.mutate(file.id)}
                disabled={removeMutation.isPending}
                className="text-muted-foreground hover:text-destructive transition-colors ml-4 shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const buttonClass = 'inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-medium h-9 px-4 transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed'
