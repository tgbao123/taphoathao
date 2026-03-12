'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabaseClient'

export function useRequireSession() {
  const router = useRouter()
  const pathname = usePathname()
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    let mounted = true

    async function checkSession() {
      const { data } = await supabase.auth.getSession()

      if (!mounted) return

      if (!data.session) {
        const next = pathname ? `?next=${encodeURIComponent(pathname)}` : ''
        router.replace(`/login${next}`)
        return
      }

      setCheckingSession(false)
    }

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        const next = pathname ? `?next=${encodeURIComponent(pathname)}` : ''
        router.replace(`/login${next}`)
        return
      }

      if (mounted) {
        setCheckingSession(false)
      }
    })

    void checkSession()

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [pathname, router])

  return { checkingSession }
}
