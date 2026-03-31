import { createFileRoute, useRouter, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { authApi } from '@/lib/api-client'
import { authStore } from '@/lib/auth-store'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/auth/register')({
  component: RegisterPage,
})

const registerSchema = z.object({
  fullName: z.string().min(1, 'Ime je obavezno').max(255),
  email: z.string().email('Unesite ispravnu email adresu'),
  password: z
    .string()
    .min(8, 'Minimum 8 karaktera')
    .regex(/[A-Z]/, 'Mora imati jedno veliko slovo')
    .regex(/[0-9]/, 'Mora imati jedan broj'),
})

type RegisterForm = z.infer<typeof registerSchema>

function RegisterPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  async function onSubmit(values: RegisterForm) {
    setServerError(null)
    try {
      const result = await authApi.register(values)
      authStore.setAuth(result.token, result.user)
      router.navigate({ to: '/dashboard' })
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Greška pri registraciji')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold">PrintFarm</h1>
          <p className="text-muted-foreground text-sm mt-1">Kreirajte besplatan nalog</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Ime i prezime</label>
            <input
              {...register('fullName')}
              type="text"
              placeholder="Nikola Petrović"
              className={cn(inputClass, errors.fullName && errorBorderClass)}
              autoComplete="name"
            />
            {errors.fullName && <p className="text-destructive text-xs">{errors.fullName.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <input
              {...register('email')}
              type="email"
              placeholder="vas@email.com"
              className={cn(inputClass, errors.email && errorBorderClass)}
              autoComplete="email"
            />
            {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Lozinka</label>
            <input
              {...register('password')}
              type="password"
              placeholder="••••••••"
              className={cn(inputClass, errors.password && errorBorderClass)}
              autoComplete="new-password"
            />
            {errors.password && <p className="text-destructive text-xs">{errors.password.message}</p>}
          </div>

          {serverError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-destructive text-sm">
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(buttonClass, 'w-full')}
          >
            {isSubmitting ? 'Kreiranje naloga...' : 'Kreiraj nalog'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Već imate nalog?{' '}
          <Link to="/auth/login" className="text-foreground underline underline-offset-4">
            Prijavite se
          </Link>
        </p>
      </div>
    </div>
  )
}

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
const errorBorderClass = 'border-destructive'
const buttonClass = 'inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-medium h-10 px-4 py-2 transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed'
