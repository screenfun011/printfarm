import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { printersApi, type AddPrinter } from '@/lib/api-client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/printers')({
  component: PrintersPage,
})

const BAMBU_MODELS = ['a1', 'a1_mini', 'p1p', 'p1s', 'x1c', 'x1e', 'h2d'] as const

const addPrinterSchema = z.object({
  name: z.string().min(1, 'Naziv je obavezan').max(255),
  model: z.enum(BAMBU_MODELS, { message: 'Odaberite model' }),
  serialNumber: z.string().min(1, 'Serijski broj je obavezan'),
  ipAddress: z.string().ip({ message: 'Unesite ispravnu IP adresu' }),
  accessCode: z.string().min(8, 'Pristupni kod mora imati minimum 8 karaktera'),
})

type AddPrinterForm = z.infer<typeof addPrinterSchema>

function PrintersPage() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)

  const { data: printers = [], isLoading } = useQuery({
    queryKey: ['printers'],
    queryFn: printersApi.list,
  })

  const addMutation = useMutation({
    mutationFn: (data: AddPrinter) => printersApi.add(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['printers'] })
      setShowAdd(false)
      reset()
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => printersApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['printers'] }),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AddPrinterForm>({
    resolver: zodResolver(addPrinterSchema),
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Štampači</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{printers.length} ukupno</p>
        </div>
        <button onClick={() => setShowAdd(true)} className={cn(buttonClass, 'flex items-center gap-2')}>
          <Plus className="w-4 h-4" />
          Dodaj štampač
        </button>
      </div>

      {/* Add printer form */}
      {showAdd && (
        <div className="mb-6 rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-medium mb-4">Novi štampač</h2>
          <form onSubmit={handleSubmit(d => addMutation.mutate(d))} className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Naziv</label>
              <input {...register('name')} placeholder="Printer 1" className={cn(inputClass, errors.name && errorClass)} />
              {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Model</label>
              <select {...register('model')} className={cn(inputClass, errors.model && errorClass)}>
                <option value="">Odaberite model</option>
                {BAMBU_MODELS.map(m => (
                  <option key={m} value={m}>{m.toUpperCase().replace('_', ' ')}</option>
                ))}
              </select>
              {errors.model && <p className="text-destructive text-xs">{errors.model.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Serijski broj</label>
              <input {...register('serialNumber')} placeholder="01S00C123456789" className={cn(inputClass, errors.serialNumber && errorClass)} />
              {errors.serialNumber && <p className="text-destructive text-xs">{errors.serialNumber.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">IP adresa (LAN)</label>
              <input {...register('ipAddress')} placeholder="192.168.1.100" className={cn(inputClass, errors.ipAddress && errorClass)} />
              {errors.ipAddress && <p className="text-destructive text-xs">{errors.ipAddress.message}</p>}
            </div>

            <div className="space-y-1.5 col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Pristupni kod</label>
              <input {...register('accessCode')} placeholder="12345678" className={cn(inputClass, errors.accessCode && errorClass)} />
              {errors.accessCode && <p className="text-destructive text-xs">{errors.accessCode.message}</p>}
            </div>

            {addMutation.error && (
              <div className="col-span-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-destructive text-sm">
                {addMutation.error.message}
              </div>
            )}

            <div className="col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={() => { setShowAdd(false); reset() }} className={ghostButtonClass}>
                Otkaži
              </button>
              <button type="submit" disabled={addMutation.isPending} className={buttonClass}>
                {addMutation.isPending ? 'Dodavanje...' : 'Dodaj'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Printers list */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Učitavanje...</p>
      ) : printers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground text-sm">Nema štampača. Dodajte prvi štampač.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {printers.map(printer => (
            <div key={printer.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium text-sm">{printer.name}</p>
                  <p className="text-xs text-muted-foreground">{printer.model.toUpperCase().replace('_', ' ')}</p>
                </div>
                <div className="flex items-center gap-1">
                  {printer.status === 'online' ? (
                    <Wifi className="w-4 h-4 text-green-600" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{printer.ipAddress}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{printer.serialNumber}</span>
                <button
                  onClick={() => removeMutation.mutate(printer.id)}
                  disabled={removeMutation.isPending}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
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
const ghostButtonClass = 'inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50'
