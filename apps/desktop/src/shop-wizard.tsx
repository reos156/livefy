import { useState, type FormEvent, type ReactNode } from 'react'
import { cn } from 'cn'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { VisualShell } from './components/visual-shell'
import type { CatalogCategory, CatalogDialCode, CatalogPaymentMethod, ShopView, WizardInput } from './lib/shop-api'

// Same bounds and rules the mutation enforces; here they only spare a round trip and
// point at the step that blocks, never replace the server's verdict.
const MAX_NAME = 80
const MAX_DESCRIPTION = 500
const MAX_CATEGORIES = 10
const MAX_PAYMENT_METHODS = 4
const MIN_BRE_B_KEY = 3
const MAX_BRE_B_KEY = 40
const BRE_B_KEY = /^[A-Za-z0-9._@-]+$/
const WHATSAPP_SEPARATORS = /[\s-]/g
const WHATSAPP_DIGITS = /^[0-9]{7,15}$/
const COLOMBIA_DIAL_CODE = '+57'

const STEPS = [
  { number: 1, label: 'Tu tienda' },
  { number: 2, label: 'Cómo te pagan' },
  { number: 3, label: 'Contacto' },
] as const

type Step = (typeof STEPS)[number]['number']

const STEP_LEADS: Record<Step, string> = {
  1: 'Cómo te van a encontrar. Elegí lo que mejor describe lo que vendés.',
  2: 'Elegí los medios que aceptás. Al menos uno.',
  3: 'Tu WhatsApp de contacto, para coordinar la entrega.',
}

type Form = {
  name: string
  description: string
  categorySlugs: string[]
  paymentMethodSlugs: string[]
  breBKey: string
  dialCode: string
  whatsappNumber: string
}

type Errors = Partial<Record<keyof Form, string>>

const STEP_FIELDS: Record<Step, (keyof Form)[]> = {
  1: ['name', 'description', 'categorySlugs'],
  2: ['paymentMethodSlugs', 'breBKey'],
  3: ['dialCode', 'whatsappNumber'],
}

function initialForm(initial: ShopView | null | undefined): Form {
  return {
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    categorySlugs: initial?.categorySlugs ?? [],
    paymentMethodSlugs: initial?.paymentMethodSlugs ?? [],
    breBKey: initial?.breBKey ?? '',
    dialCode: initial?.whatsapp.dialCode ?? COLOMBIA_DIAL_CODE,
    whatsappNumber: initial?.whatsapp.number ?? '',
  }
}

// The catalogue marks which method carries a key of its own, so revealing the Bre-B
// field follows the data the backend serves instead of a hard-coded label.
function selectedMethods(form: Form, paymentMethods: CatalogPaymentMethod[]) {
  return paymentMethods.filter(method => form.paymentMethodSlugs.includes(method.slug))
}

function needsKey(form: Form, paymentMethods: CatalogPaymentMethod[]) {
  return selectedMethods(form, paymentMethods).some(method => method.requiresKey)
}

function validateStore(form: Form): Errors {
  const errors: Errors = {}
  const name = form.name.trim()
  if (!name) errors.name = 'Ingresá el nombre de la tienda.'
  else if (name.length > MAX_NAME) errors.name = 'El nombre es demasiado largo.'

  const description = form.description.trim()
  if (!description) errors.description = 'Ingresá una descripción.'
  else if (description.length > MAX_DESCRIPTION) errors.description = 'La descripción es demasiado larga.'

  if (form.categorySlugs.length === 0) errors.categorySlugs = 'Elegí al menos una categoría.'
  else if (form.categorySlugs.length > MAX_CATEGORIES) errors.categorySlugs = 'Quitá alguna: la lista es demasiado larga.'
  return errors
}

function validatePayments(form: Form, paymentMethods: CatalogPaymentMethod[]): Errors {
  const errors: Errors = {}
  if (form.paymentMethodSlugs.length === 0) errors.paymentMethodSlugs = 'Elegí al menos un medio de pago.'
  else if (form.paymentMethodSlugs.length > MAX_PAYMENT_METHODS) errors.paymentMethodSlugs = 'Quitá alguno: la lista es demasiado larga.'

  if (needsKey(form, paymentMethods)) {
    const key = form.breBKey.trim()
    if (key.length === 0) errors.breBKey = 'Ingresá tu llave Bre-B.'
    else if (key.length < MIN_BRE_B_KEY || key.length > MAX_BRE_B_KEY || !BRE_B_KEY.test(key)) {
      errors.breBKey = 'Revisá la llave: usá entre 3 y 40 caracteres, sin espacios.'
    }
  }
  return errors
}

function validateContact(form: Form, dialCodes: CatalogDialCode[]): Errors {
  const errors: Errors = {}
  if (!dialCodes.some(dial => dial.dial === form.dialCode)) errors.dialCode = 'Elegí un indicativo de la lista.'
  // The backend stores digits only, so the screen accepts spaces and dashes and strips them.
  const digits = form.whatsappNumber.replace(WHATSAPP_SEPARATORS, '')
  if (!WHATSAPP_DIGITS.test(digits)) errors.whatsappNumber = 'Ingresá un WhatsApp de contacto: entre 7 y 15 dígitos.'
  return errors
}

function validateStep(step: Step, form: Form, paymentMethods: CatalogPaymentMethod[], dialCodes: CatalogDialCode[]): Errors {
  if (step === 1) return validateStore(form)
  if (step === 2) return validatePayments(form, paymentMethods)
  return validateContact(form, dialCodes)
}

function toInput(form: Form, paymentMethods: CatalogPaymentMethod[]): WizardInput {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    categorySlugs: form.categorySlugs,
    paymentMethodSlugs: form.paymentMethodSlugs,
    // Required exactly while the method that carries it is selected, so a deselected
    // Bre-B never sends a value the backend would reject as unexpected.
    ...(needsKey(form, paymentMethods) ? { breBKey: form.breBKey.trim() } : {}),
    whatsapp: { dialCode: form.dialCode, number: form.whatsappNumber.replace(WHATSAPP_SEPARATORS, '') },
  }
}

function StepProgress({ step }: { step: Step }) {
  return <div className="flex flex-col gap-3">
    {/* Announced on every change: the bars alone say nothing to a screen reader. */}
    <p aria-live="polite" className="text-sm text-muted-foreground">{`Paso ${step} de 3`}</p>
    <ol aria-label="Pasos de la configuración" className="flex gap-2">
      {STEPS.map(item => {
        const state = item.number < step ? 'done' : item.number === step ? 'current' : 'todo'
        return <li
          key={item.number}
          data-state={state}
          aria-current={state === 'current' ? 'step' : undefined}
          className="flex flex-1 flex-col gap-2"
        >
          <span aria-hidden="true" className={cn('h-1 rounded-full bg-border', state !== 'todo' && 'bg-primary')} />
          <span className={cn('text-xs text-muted-foreground', state === 'current' && 'font-medium text-foreground')}>
            {`${item.number} · ${item.label}`}
          </span>
        </li>
      })}
    </ol>
  </div>
}

export function ShopWizard({ initial, categories, paymentMethods, dialCodes, pending = false, error, footer, onSubmit }: {
  initial?: ShopView | null
  categories: CatalogCategory[]
  paymentMethods: CatalogPaymentMethod[]
  dialCodes: CatalogDialCode[]
  pending?: boolean
  error?: string | null
  footer?: ReactNode
  onSubmit: (input: WizardInput) => void
}) {
  const [form, setForm] = useState<Form>(() => initialForm(initial))
  const [step, setStep] = useState<Step>(1)
  const [errors, setErrors] = useState<Errors>({})

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm(current => ({ ...current, [key]: value }))
    // A verdict describes the value that failed. Once the operator edits that value the
    // message is stale, so it goes away instead of accusing a valid entry.
    setErrors(current => {
      if (current[key] === undefined) return current
      const nextErrors = { ...current }
      delete nextErrors[key]
      return nextErrors
    })
  }

  function toggleInList(key: 'categorySlugs' | 'paymentMethodSlugs', slug: string) {
    setForm(current => ({
      ...current,
      [key]: current[key].includes(slug) ? current[key].filter(item => item !== slug) : [...current[key], slug],
    }))
    // The key belongs to the payment method, so its verdict is stale as soon as the
    // selection changes.
    setErrors(current => {
      const nextErrors = { ...current }
      delete nextErrors[key]
      if (key === 'paymentMethodSlugs') delete nextErrors.breBKey
      return nextErrors
    })
  }

  function applyStepErrors(found: Errors) {
    setErrors(current => {
      const nextErrors = { ...current }
      for (const field of STEP_FIELDS[step]) delete nextErrors[field]
      return { ...nextErrors, ...found }
    })
  }

  function advance() {
    const found = validateStep(step, form, paymentMethods, dialCodes)
    applyStepErrors(found)
    if (Object.keys(found).length > 0) return
    if (step < 3) setStep((step + 1) as Step)
  }

  function back() {
    if (step > 1) setStep((step - 1) as Step)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const foundByStep: Record<Step, Errors> = {
      1: validateStore(form),
      2: validatePayments(form, paymentMethods),
      3: validateContact(form, dialCodes),
    }
    setErrors(Object.assign({}, ...Object.values(foundByStep)))
    const blocking = STEPS.find(item => Object.keys(foundByStep[item.number]).length > 0)
    if (blocking) {
      setStep(blocking.number)
      return
    }
    onSubmit(toInput(form, paymentMethods))
  }

  const revealsKey = needsKey(form, paymentMethods)

  return <VisualShell title="Configurá tu tienda">
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <StepProgress step={step} />

      {error && <Alert role="alert"><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="flex flex-col gap-1">
        <h2>{STEPS[step - 1].label}</h2>
        <p>{STEP_LEADS[step]}</p>
      </div>

      {step === 1 && <FieldGroup>
        <Field data-invalid={errors.name ? true : undefined}>
          <FieldLabel htmlFor="shop-name">Nombre de la tienda</FieldLabel>
          <Input
            id="shop-name"
            value={form.name}
            aria-invalid={errors.name ? true : undefined}
            onChange={event => update('name', event.target.value)}
          />
          {errors.name && <FieldError>{errors.name}</FieldError>}
        </Field>
        <Field data-invalid={errors.description ? true : undefined}>
          <FieldLabel htmlFor="shop-description">Descripción</FieldLabel>
          <Input
            id="shop-description"
            value={form.description}
            aria-invalid={errors.description ? true : undefined}
            onChange={event => update('description', event.target.value)}
          />
          {errors.description && <FieldError>{errors.description}</FieldError>}
        </Field>
        <FieldSet>
          <FieldLegend>Categorías</FieldLegend>
          <FieldDescription>Qué vendés. Podés elegir más de una.</FieldDescription>
          <Field
            data-invalid={errors.categorySlugs ? true : undefined}
            aria-invalid={errors.categorySlugs ? true : undefined}
          >
            <div className="flex flex-wrap gap-2">
              {categories.map(category => {
                const selected = form.categorySlugs.includes(category.slug)
                return <Button
                  key={category.slug}
                  type="button"
                  size="sm"
                  variant={selected ? 'default' : 'outline'}
                  aria-pressed={selected}
                  onClick={() => toggleInList('categorySlugs', category.slug)}
                >
                  {category.label}
                </Button>
              })}
            </div>
            {errors.categorySlugs && <FieldError>{errors.categorySlugs}</FieldError>}
          </Field>
        </FieldSet>
      </FieldGroup>}

      {step === 2 && <FieldGroup>
        <FieldSet>
          <FieldLegend>Medios de pago</FieldLegend>
          <FieldDescription>Tocá los que aceptás.</FieldDescription>
          <Field
            data-invalid={errors.paymentMethodSlugs ? true : undefined}
            aria-invalid={errors.paymentMethodSlugs ? true : undefined}
          >
            <div className="flex flex-col gap-2">
              {paymentMethods.map(method => {
                const selected = form.paymentMethodSlugs.includes(method.slug)
                return <Button
                  key={method.slug}
                  type="button"
                  aria-pressed={selected}
                  variant={selected ? 'default' : 'outline'}
                  className="h-auto w-full flex-col items-start gap-0.5 py-3 text-left"
                  onClick={() => toggleInList('paymentMethodSlugs', method.slug)}
                >
                  <span className="font-medium">{method.label}</span>
                  <span className={cn('text-xs font-normal', selected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                    {method.description}
                  </span>
                </Button>
              })}
            </div>
            {errors.paymentMethodSlugs && <FieldError>{errors.paymentMethodSlugs}</FieldError>}
          </Field>
        </FieldSet>

        {revealsKey && <Field data-invalid={errors.breBKey ? true : undefined}>
          <FieldLabel htmlFor="bre-b-key">Tu llave Bre-B</FieldLabel>
          <Input
            id="bre-b-key"
            value={form.breBKey}
            aria-invalid={errors.breBKey ? true : undefined}
            aria-describedby={errors.breBKey ? 'bre-b-key-hint bre-b-key-error' : 'bre-b-key-hint'}
            onChange={event => update('breBKey', event.target.value)}
          />
          {errors.breBKey && <FieldError id="bre-b-key-error">{errors.breBKey}</FieldError>}
          <FieldDescription id="bre-b-key-hint">
            Celular, documento o llave alfanumérica. Se la das a tu cliente para que te pague.
          </FieldDescription>
        </Field>}
      </FieldGroup>}

      {step === 3 && <FieldGroup>
        <Field data-invalid={errors.dialCode ? true : undefined}>
          <FieldLabel htmlFor="whatsapp-dial">Indicativo</FieldLabel>
          <Select
            value={form.dialCode}
            items={dialCodes.map(dial => ({ value: dial.dial, label: `${dial.dial} · ${dial.label}` }))}
            onValueChange={value => {
              if (typeof value === 'string') update('dialCode', value)
            }}
          >
            <SelectTrigger id="whatsapp-dial" className="w-full" aria-invalid={errors.dialCode ? true : undefined}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {dialCodes.map(dial => <SelectItem key={dial.iso2} value={dial.dial}>{`${dial.dial} · ${dial.label}`}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
          {errors.dialCode && <FieldError>{errors.dialCode}</FieldError>}
        </Field>
        <Field data-invalid={errors.whatsappNumber ? true : undefined}>
          <FieldLabel htmlFor="whatsapp-number">Número de WhatsApp</FieldLabel>
          <Input
            id="whatsapp-number"
            inputMode="tel"
            value={form.whatsappNumber}
            aria-invalid={errors.whatsappNumber ? true : undefined}
            onChange={event => update('whatsappNumber', event.target.value)}
          />
          <FieldDescription>Te escriben ahí para coordinar la entrega.</FieldDescription>
          {errors.whatsappNumber && <FieldError>{errors.whatsappNumber}</FieldError>}
        </Field>
      </FieldGroup>}

      <div className="flex items-center gap-2">
        {step > 1 && <Button type="button" variant="outline" onClick={back}>Atrás</Button>}
        <span className="flex-1" />
        {step < 3
          ? <Button type="button" onClick={advance}>Continuar</Button>
          : <Button type="submit" disabled={pending} data-icon={pending ? 'inline-start' : undefined}>
            {pending && <Spinner data-icon="inline-start" />}
            {pending ? 'Guardando…' : 'Guardar tienda'}
          </Button>}
      </div>
    </form>
    {/* Outside the form on purpose: a caller-supplied control that omits
        `type="button"` defaults to a submit button, and would then save the shop. */}
    {footer && <div className="flex items-center gap-2">{footer}</div>}
  </VisualShell>
}