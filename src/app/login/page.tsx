'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [nextPath, setNextPath] = useState('/products')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      setNextPath(params.get('next') || '/products')
    }
  }, [])

  useEffect(() => {
    async function checkCurrentSession() {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        router.replace(nextPath)
        return
      }

      setCheckingSession(false)
    }

    void checkCurrentSession()
  }, [nextPath, router])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.replace(nextPath)
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #312e81, #4f46e5, #7c3aed)' }}
      >
        <div className="flex items-center gap-3 text-white/80 text-sm">
          <span className="spinner" />
          Đang kiểm tra phiên đăng nhập...
        </div>
      </main>
    )
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #312e81 0%, #4f46e5 40%, #7c3aed 100%)' }}
    >
      {/* Decorative blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, #818cf8, transparent 70%)' }}
      />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full opacity-15"
        style={{ background: 'radial-gradient(circle, #c084fc, transparent 70%)' }}
      />

      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-md space-y-5 rounded-2xl p-8 animate-slide-up"
        style={{
          background: 'rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Logo */}
        <div className="text-center space-y-2">
          <div
            className="inline-flex h-14 w-14 items-center justify-center rounded-xl text-white font-bold text-lg"
            style={{ background: 'linear-gradient(135deg, #818cf8, #6366f1)' }}
          >
            TH
          </div>
          <h1 className="text-2xl font-bold text-white">Đăng nhập</h1>
          <p className="text-sm text-indigo-200">TapHoaThao — Quản lý cửa hàng</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-indigo-100">Email</label>
          <input
            className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-indigo-300/60"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1.5px solid rgba(255, 255, 255, 0.15)',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.08)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
              e.currentTarget.style.boxShadow = 'none'
            }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="admin@example.com"
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-indigo-100">Mật khẩu</label>
          <input
            className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-indigo-300/60"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1.5px solid rgba(255, 255, 255, 0.15)',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.08)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
              e.currentTarget.style.boxShadow = 'none'
            }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>

        {error ? (
          <div className="rounded-lg px-4 py-2.5 text-sm"
            style={{ background: 'rgba(225, 29, 72, 0.2)', color: '#fda4af' }}
          >
            {error}
          </div>
        ) : null}

        <button
          disabled={loading}
          className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            boxShadow: '0 4px 15px rgba(79, 70, 229, 0.4)',
          }}
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
          }}
          type="submit"
        >
          {loading ? (
            <>
              <span className="spinner" />
              Đang đăng nhập...
            </>
          ) : (
            'Đăng nhập'
          )}
        </button>
      </form>
    </main>
  )
}
