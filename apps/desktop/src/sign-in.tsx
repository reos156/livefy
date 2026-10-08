import { useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { useSignInAdapter } from './lib/sign-in'
const invalidCopy = 'Unable to sign in. Check your email and password and try again.'
const challengeCopy = 'Additional verification is required. Contact support to complete sign-in; access has not been confirmed.'
export function SignIn({ onPendingChange }: { onPendingChange?: (pending: boolean) => void }) {
  const adapter = useSignInAdapter()
  const lock = useRef(false)
  const completed = useRef(false)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const disabled = pending || adapter.fetching || done
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current || adapter.fetching || completed.current) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
      setError('Enter a valid email address and password.'); return
    }
    lock.current = true; setPending(true); onPendingChange?.(true); setError('')
    const submittedPassword = password
    setPassword('')
    try {
      const result = await adapter.password({ emailAddress: email, password: submittedPassword })
      if (result !== 'complete') { setError(result === 'challenge' ? challengeCopy : invalidCopy); return }
      const finalized = await adapter.finalize()
      if (finalized !== 'complete') { setError(finalized === 'challenge' ? challengeCopy : invalidCopy); return }
      completed.current = true; setDone(true)
    } catch { setError(invalidCopy) }
    finally { lock.current = false; setPending(false); onPendingChange?.(false) }
  }
  return <section aria-label="Sign in" className="flex flex-col gap-4">
    <h2>Sign in with email and password</h2>
    <form onSubmit={event => void submit(event)} noValidate aria-busy={pending || adapter.fetching} className="flex flex-col gap-4">
      <label htmlFor="sign-in-email">Email</label>
      <input id="sign-in-email" type="text" inputMode="email" autoComplete="username" required
        value={email} onChange={event => setEmail(event.target.value)} disabled={disabled} />
      <label htmlFor="sign-in-password">Password</label>
      <input id="sign-in-password" type="password" autoComplete="current-password" required
        value={password} onChange={event => setPassword(event.target.value)} disabled={disabled} />
      <Button type="submit" disabled={disabled}>Sign in</Button>
    </form>
    {error && <p role="alert">{error}</p>}
    <p role="status">{pending || adapter.fetching ? 'Sign-in request in progress.' : done ?
      'Sign-in completed; waiting for backend access confirmation.' : 'Enter your existing account credentials.'}</p>
  </section>
}
