import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { jobsApi, filesApi, printersApi, type CreateJob } from '@/lib/api-client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Square, Pause, Play, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/jobs')({
  component: JobsPage,
})

const createJobSchema = z.object({
  name: z.string().min(1, 'Naziv je obavezan'),
  fileId: z.string().uuid('Odaberite fajl'),
  printerIds: z.array(z.string().uuid()).min(1, 'Odaberite bar jedan štampač'),
  copies: z.coerce.number().int().min(1).max(100).default(1),
  priority: z.coerce.number().int().min(0).max(100).default(0),
})

type CreateJobForm = z.infer<typeof createJobSchema>

const STATUS_COLORS: Record<string, string> = {
  queued: 'bg-yellow-100 text-yellow-700',
  preparing: 'bg-blue-100 text-blue-700',
  printing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  canceled: 'bg-gray-100 text-gray-600',
  paused: 'bg-orange-100 text-orange-700',
}

function JobsPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)

  const { data: jobs = [], isLoading } = useQuery({ queryKey: ['jobs'], queryFn: jobsApi.list })
  const { data: files = [] } = useQuery({ queryKey: ['files'], queryFn: filesApi.list })
  const { data: printers = [] } = useQuery({ queryKey: ['printers'], queryFn: printersApi.list })

  const createMutation = useMutation({
    mutationFn: (data: CreateJob) => jobsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['jobs'] }); setShowCreate(false); reset() },
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => jobsApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  })

  const pauseMutation = useMutation({
    mutationFn: (id: string) => jobsApi.pause(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  })

  const resumeMutation = useMutation({
    mutationFn: (id: string) => jobsApi.resume(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => jobsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateJobForm>({
    resolver: zodResolver(createJobSchema),
    defaultValues: { copies: 1, priority: 0 },
  })

  const activePrinters = printers.filter(p => p.isActive)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Jobovi</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{jobs.length} ukupno</p>
        </div>
        <button onClick={() => setShowCreate(true)} className={cn(buttonClass, 'flex items-center gap-2')}>
          <Plus className="w-4 h-4" />
          Novi job
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-medium mb-4">Novi print job</h2>
          <form onSubmit={handleSubmit(d => createMutation.mutate({ ...d, printerIds: Array.isArray(d.printerIds) ? d.printerIds : [d.printerIds] }))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Naziv</label>
                <input {...register('name')} placeholder="Naziv joba" className={cn(inputClass, errors.name && errorClass)} />
                {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Fajl</label>
                <select {...register('fileId')} className={cn(inputClass, errors.fileId && errorClass)}>
                  <option value="">Odaberite .3mf fajl</option>
                  {files.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                {errors.fileId && <p className="text-destructive text-xs">{errors.fileId.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Kopije</label>
                <input {...register('copies')} type="number" min={1} max={100} className={inputClass} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Prioritet (0-100)</label>
                <input {...register('priority')} type="number" min={0} max={100} className={inputClass} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Štampači</label>
              <div className="flex flex-wrap gap-2">
                {activePrinters.map(p => (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" value={p.id} {...register('printerIds')} className="rounded" />
                    <span className="text-sm">{p.name}</span>
                  </label>
                ))}
                {activePrinters.length === 0 && (
                  <p className="text-muted-foreground text-sm">Nema aktivnih štampača</p>
                )}
              </div>
              {errors.printerIds && <p className="text-destructive text-xs">{errors.printerIds.message}</p>}
            </div>

            {createMutation.error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-destructive text-sm">
                {createMutation.error.message}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setShowCreate(false); reset() }} className={ghostButtonClass}>Otkaži</button>
              <button type="submit" disabled={createMutation.isPending} className={buttonClass}>
                {createMutation.isPending ? 'Kreiranje...' : 'Kreiraj job'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Jobs list */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Učitavanje...</p>
      ) : jobs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground text-sm">Nema jobova. Kreirajte prvi print job.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card divide-y divide-border">
          {jobs.map(job => (
            <div key={job.id} className="flex items-center justify-between px-5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{job.name}</p>
                <p className="text-xs text-muted-foreground">{job.copies} kopija · prioritet {job.priority}</p>
              </div>

              <div className="flex items-center gap-3 ml-4 shrink-0">
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[job.status] ?? 'bg-gray-100 text-gray-600')}>
                  {job.status}
                </span>

                <div className="flex items-center gap-1">
                  {job.status === 'printing' && (
                    <button onClick={() => pauseMutation.mutate(job.id)} className={iconBtn} title="Pauziraj">
                      <Pause className="w-4 h-4" />
                    </button>
                  )}
                  {job.status === 'paused' && (
                    <button onClick={() => resumeMutation.mutate(job.id)} className={iconBtn} title="Nastavi">
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  {['queued', 'preparing', 'printing', 'paused'].includes(job.status) && (
                    <button onClick={() => cancelMutation.mutate(job.id)} className={iconBtn} title="Otkaži">
                      <Square className="w-4 h-4" />
                    </button>
                  )}
                  {['completed', 'canceled', 'failed'].includes(job.status) && (
                    <button onClick={() => removeMutation.mutate(job.id)} className={cn(iconBtn, 'hover:text-destructive')} title="Obriši">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const errorClass = 'border-destructive'
const buttonClass = 'inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-medium h-9 px-4 transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed'
const ghostButtonClass = 'inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 transition-colors hover:bg-accent hover:text-accent-foreground'
const iconBtn = 'p-1 text-muted-foreground hover:text-foreground transition-colors'
