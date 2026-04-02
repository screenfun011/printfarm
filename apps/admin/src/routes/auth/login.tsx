import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { authApi } from '../../lib/api-client.js'
import { authStore } from '../../lib/auth-store.js'

function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [requireTotp, setRequireTotp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await authApi.login({
        email,
        password,
        ...(requireTotp ? { totpCode } : {}),
      })

      if ('requireTotp' in result) {
        setRequireTotp(true)
        setLoading(false)
        return
      }

      authStore.setAuth(result.token, result.admin)
      navigate({ to: '/dashboard' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Greška pri prijavi'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950">
      <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">PrintFarm</h1>
          <p className="mt-1 text-sm text-gray-400">Super Admin Panel</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!requireTotp ? (
            <>
              <div>
                <label className="mb-1 block text-sm text-gray-300">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                  placeholder="admin@printfarm.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-300">Lozinka</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="mb-1 block text-sm text-gray-300">TOTP Kod (6 cifara)</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={totpCode}
                onChange={e => setTotpCode(e.target.value)}
                required
                autoFocus
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-center text-2xl tracking-widest text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                placeholder="000000"
              />
              <button
                type="button"
                onClick={() => setRequireTotp(false)}
                className="mt-2 text-sm text-gray-400 hover:text-gray-200"
              >
                ← Nazad
              </button>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? 'Prijavljivanje...' : requireTotp ? 'Potvrdi kod' : 'Prijavi se'}
          </button>
        </form>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/auth/login')({ component: LoginPage })
