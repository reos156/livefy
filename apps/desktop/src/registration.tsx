import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRegistrationAdapter } from './lib/registration'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'

type Step = 'credentials' | 'send' | 'verify' | 'finish' | 'done' | 'existing' | 'unsupported'
const existingCopy = 'An account already exists. Use sign in; registration will not sign you in.'
function safeError(error: unknown): string {
  const value = error as { code?: string; errors?: { code?: string }[] } | null
  const code = value?.errors?.[0]?.code ?? value?.code
  switch (code) {
    case 'form_identifier_exists': return existingCopy
    case 'form_code_incorrect': return 'The email code is invalid. Try again.'
    case 'verification_expired': return 'The email code expired. Request another code.'
    case 'form_password_pwned': return 'Choose a different password.'
    case 'form_password_length_too_short': return 'Use a password with at least 8 characters.'
    case 'too_many_requests': return 'Too many attempts. Wait before trying again.'
    default: return 'Unable to complete this step. Please try again.'
  }
}

// Adapter completion is not backend access.
export function Registration({ onPendingChange }: { onPendingChange?: (pending: boolean) => void }) {
  const { signUp, fetchStatus, isAuthenticated, isLoading } = useRegistrationAdapter()
  const lock = useRef(false)
  const providerPending = useRef(false)
  providerPending.current = fetchStatus === 'fetching'
  const completed = useRef(false)
  const [pending, setPending] = useState(false)
  const [step, setStep] = useState<Step>('credentials')
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const disabled = pending || fetchStatus === 'fetching' || isLoading || isAuthenticated
  useEffect(() => {
    onPendingChange?.(lock.current || fetchStatus === 'fetching')
  }, [fetchStatus, onPendingChange])

  async function checked(action: () => Promise<{ error: unknown }>) {
    const result = await action()
    if (result.error) throw result.error
  }
  function requirements(): 'complete' | 'email' | 'stop' {
    if (signUp.isTransferable || signUp.existingSession) {
      setStep('existing'); setError(existingCopy); return 'stop'
    }
    if (signUp.missingFields.length || signUp.unverifiedFields.some(field => field !== 'email_address') ||
      (signUp.status !== 'complete' && signUp.status !== 'missing_requirements')) {
      setStep('unsupported')
      setError('Registration requires additional information not supported here. Contact support.')
      return 'stop'
    }
    if (signUp.status === 'complete' && !signUp.unverifiedFields.length) return 'complete'
    if (signUp.unverifiedFields.includes('email_address')) return 'email'
    setError('Registration is incomplete. Please retry or contact support.')
    return 'stop'
  }
  async function finish() {
    if (requirements() !== 'complete' || completed.current) return
    setStep('finish')
    // Keep navigation local; access is independently confirmed by Convex.
    await checked(() => signUp.finalize())
    completed.current = true
    setStep('done')
  }
  async function send() {
    if (requirements() !== 'email') return
    if (step !== 'verify') setStep('send') // Retry this attempt, not password().
    await checked(() => signUp.verifications.sendEmailCode())
    setCode(''); setStep('verify')
  }
  async function run(action: () => Promise<void>) {
    if (lock.current || disabled || completed.current) return
    lock.current = true; setPending(true); onPendingChange?.(true); setError('')
    try { await action() } catch (failure) {
      const message = safeError(failure)
      if (message === existingCopy) setStep('existing')
      setError(message)
    } finally { lock.current = false; setPending(false); onPendingChange?.(providerPending.current) }
  }
  function register(event: FormEvent) {
    event.preventDefault()
    void run(async () => {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('Enter a valid email address.'); return
      }
      if (password.length < 8) { setError('Use a password with at least 8 characters.'); return }
      const submittedPassword = password
      setPassword('')
      await checked(() => signUp.password({ emailAddress: email, password: submittedPassword }))
      const next = requirements()
      if (next === 'complete') await finish()
      else if (next === 'email') await send()
    })
  }
  function verify(event: FormEvent) {
    event.preventDefault()
    void run(async () => {
      if (!code.trim()) { setError('Enter the email code.'); return }
      await checked(() => signUp.verifications.verifyEmailCode({ code }))
      const next = requirements()
      if (next === 'complete') await finish()
      else if (next === 'email') setError('Registration is incomplete. Check the code or contact support.')
    })
  }
  return <section className="flex flex-col gap-4" aria-label="Registration">
    <h2>Register with email and password</h2>
    <p>Existing accounts are not signed in automatically. Use sign in for an existing account.</p>
    {/* Pinned Clerk React source mounts this target for custom-flow CAPTCHA. */}
    <div id="clerk-captcha" />
    {step === 'credentials' && <form onSubmit={register} noValidate className="flex flex-col gap-4" aria-busy={pending}>
      <FieldGroup>
        <Field data-disabled={disabled}>
          <FieldLabel htmlFor="registration-email">Email</FieldLabel>
          <Input id="registration-email" type="text" inputMode="email" autoComplete="email" required
            value={email} onChange={event => setEmail(event.target.value)} disabled={disabled} />
        </Field>
        <Field data-disabled={disabled}>
          <FieldLabel htmlFor="registration-password">Password</FieldLabel>
          <Input id="registration-password" type="password" autoComplete="new-password" required minLength={8}
            value={password} onChange={event => setPassword(event.target.value)} disabled={disabled} />
        </Field>
      </FieldGroup>
      <p>Use at least 8 characters.</p>
      <Button type="submit" disabled={disabled}>Register</Button>
    </form>}
    {step === 'send' && <Button disabled={disabled} onClick={() => void run(send)}>Send email code</Button>}
    {step === 'verify' && <form onSubmit={verify} className="flex flex-col gap-4" aria-busy={pending}>
      <FieldGroup>
        <Field data-disabled={disabled}>
          <FieldLabel htmlFor="registration-code">Email code</FieldLabel>
          <Input id="registration-code" autoComplete="one-time-code" value={code}
            onChange={event => setCode(event.target.value)} disabled={disabled} />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={disabled}>Verify email</Button>
      <Button type="button" variant="outline" disabled={disabled} onClick={() => void run(send)}>Resend code</Button>
    </form>}
    {step === 'finish' && <Button disabled={disabled} onClick={() => void run(finish)}>Finish registration</Button>}
    {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
    <Alert role="status"><AlertDescription>{pending ? 'Registration request in progress.' : step === 'done' ?
      'Registration completed; waiting for backend access confirmation.' : 'No authenticated session confirmed.'}</AlertDescription></Alert>
  </section>
}
