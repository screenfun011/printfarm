import { createFileRoute, useRouter, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { authApi } from '@/lib/api-client'
import { authStore } from '@/lib/auth-store'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/auth/login')({
  component: LoginPage,
})

const loginSchema = z.object({
  email: z.string().email('Unesite ispravnu email adresu'),
  password: z.string().min(1, 'Lozinka je obavezna'),
  totpCode: z.string().length(6).optional().or(z.literal('')),
})

type LoginForm = z.infer<typeof loginSchema>

function LoginPage() {
  const router = useRouter()
  const [requireTotp, setRequireTotp] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(values: LoginForm) {
    setServerError(null)
    try {
      const result = await authApi.login({
        email: values.email,
        password: values.password,
        totpCode: values.totpCode || undefined,
      })

      if ('requireTotp' in result) {
        setRequireTotp(true)
        return
      }

      authStore.setAuth(result.token, result.user)
      router.navigate({ to: '/dashboard' })
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Greška pri prijavi')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold">PrintFarm</h1>
          <p className="text-muted-foreground text-sm mt-1">Prijavite se na vaš nalog</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!requireTotp ? (
            <>
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
                  autoComplete="current-password"
                />
                {errors.password && <p className="text-destructive text-xs">{errors.password.message}</p>}
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">TOTP Kod</label>
              <p className="text-muted-foreground text-xs">Unesite 6-cifreni kod iz vaše autentifikacione aplikacije</p>
              <input
                {...register('totpCode')}
                type="text"
                placeholder="123456"
                maxLength={6}
                className={cn(inputClass, 'text-center tracking-widest text-lg', errors.totpCode && errorBorderClass)}
                autoComplete="one-time-code"
                autoFocus
              />
            </div>
          )}

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
            {isSubmitting ? 'Prijava...' : requireTotp ? 'Potvrdi' : 'Prijavi se'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Nemate nalog?{' '}
          <Link to="/auth/register" className="text-foreground underline underline-offset-4">
            Registrujte se
          </Link>
        </p>
      </div>
    </div>
  )
}

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
const errorBorderClass = 'border-destructive'
const buttonClass = 'inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-medium h-10 px-4 py-2 transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed'
