import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { aiApi } from '@/lib/api-client'
import { ScanEye } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/ai')({
  component: AiPage,
})

const DETECTION_LABELS: Record<string, string> = {
  spaghetti: 'Špageti',
  detached: 'Odvojeno',
  layer_shift: 'Pomeraj sloja',
  warping: 'Vitoperenje',
  stringing: 'Niti',
  unknown: 'Nepoznato',
}

const ACTION_COLORS: Record<string, string> = {
  none: 'bg-red-100 text-red-700',
  notified: 'bg-gray-100 text-gray-600',
  paused: 'bg-orange-100 text-orange-700',
  canceled: 'bg-gray-100 text-gray-600',
  skip_object: 'bg-blue-100 text-blue-700',
}

function AiPage() {
  const qc = useQueryClient()

  const { data: detections = [], isLoading } = useQuery({
    queryKey: ['ai-detections'],
    queryFn: aiApi.listDetections,
    refetchInterval: 10_000,
  })

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'pause' | 'cancel' | 'skip_object' | 'dismiss' }) =>
      aiApi.takeAction(id, action),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-detections'] }),
  })

  const unresolved = detections.filter(d => d.actionTaken === 'none')
  const resolved = detections.filter(d => d.actionTaken !== 'none')

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">AI Detekcije</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {unresolved.length} aktivnih · {resolved.length} rešenih
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Učitavanje...</p>
      ) : detections.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <ScanEye className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nema AI detekcija</p>
        </div>
      ) : (
        <div className="space-y-6">
          {unresolved.length > 0 && (
            <div>
              <h2 className="text-sm font-medium mb-3 text-destructive">Aktivne detekcije</h2>
              <div className="rounded-lg border border-destructive/20 bg-card divide-y divide-border">
                {unresolved.map(d => (
                  <DetectionRow
                    key={d.id}
                    detection={d}
                    onAction={(action) => actionMutation.mutate({ id: d.id, action })}
                    isPending={actionMutation.isPending}
                  />
                ))}
              </div>
            </div>
          )}

          {resolved.length > 0 && (
            <div>
              <h2 className="text-sm font-medium mb-3 text-muted-foreground">Rešene detekcije</h2>
              <div className="rounded-lg border border-border bg-card divide-y divide-border opacity-60">
                {resolved.map(d => (
                  <DetectionRow key={d.id} detection={d} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DetectionRow({
  detection: d,
  onAction,
  isPending,
}: {
  detection: ReturnType<typeof aiApi.listDetections> extends Promise<infer T> ? T[number] : never
  onAction?: (action: 'pause' | 'cancel' | 'skip_object' | 'dismiss') => void
  isPending?: boolean
}) {
  const isActive = d.actionTaken === 'none'

  return (
    <div className="px-5 py-3 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{DETECTION_LABELS[d.detectionType] ?? d.detectionType}</span>
          <span className="text-xs text-muted-foreground">{Math.round(d.confidence * 100)}% sigurnost</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {new Date(d.createdAt).toLocaleString('sr-RS')}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ACTION_COLORS[d.actionTaken] ?? 'bg-gray-100 text-gray-600')}>
          {d.actionTaken === 'none' ? 'Nereseno' : d.actionTaken}
        </span>

        {isActive && onAction && (
          <div className="flex gap-1">
            {(['pause', 'cancel', 'skip_object', 'dismiss'] as const).map(action => (
              <button
                key={action}
                onClick={() => onAction(action)}
                disabled={isPending}
                className="text-xs px-2 py-1 rounded border border-border hover:bg-accent transition-colors disabled:opacity-50"
              >
                {action === 'skip_object' ? 'Skip' : action === 'dismiss' ? 'Odbaci' : action === 'pause' ? 'Pauziraj' : 'Otkaži'}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
