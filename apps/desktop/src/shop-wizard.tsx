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
// Per-kind datum rules, mirrored from the mutation: the server stays authoritative and
// these only spare a round trip and point at the step that blocks.
const PHONE_SEPARATORS = /[\s.-]/g
const PHONE_DIGITS = /^[0-9]{7,15}$/
const KEY_VALUE = /^[A-Za-z0-9._@-]{3,40}$/
const ACCOUNT_VALUE = /^[\p{L}0-9 .#-]{5,60}$/u
const WHATSAPP_SEPARATORS = /[\s-]/g
const WHATSAPP_DIGITS = /^[0-9]{7,15}$/
const COLOMBIA_DIAL_CODE = '+57'

// One rule per catalogue datum kind, so a new method reuses the rule its `dataKind` names.
const DATUM_RULES: Record<CatalogPaymentMethod['dataKind'], { valid: (value: string) => boolean; message: string }> = {
  phone: {
    valid: value => PHONE_DIGITS.test(value.replace(PHONE_SEPARATORS, '')),
    message: 'Usá entre 7 y 15 dígitos.',
  },
  key: {
    valid: value => KEY_VALUE.test(value),
    message: 'Revisá la llave: usá entre 3 y 40 caracteres, sin espacios.',
  },
  account: {
    valid: value => ACCOUNT_VALUE.test(value),
    message: 'Revisá la cuenta: usá entre 5 y 60 caracteres con letras, números, espacios y ".-#".',
  },
}

const STEPS = [
  { number: 1, label: 'Tu tienda' },
  { number: 2, label: 'Cómo te pagan' },
  { number: 3, label: 'Contacto' },
] as const

type Step = (typeof STEPS)[number]['number']
// The step is the only piece of wizard navigation a caller can own. When it lives in the
// URL, a transient remount re-reads it instead of falling back to the first step.
export type WizardStep = Step

const STEP_LEADS: Record<Step, string> = {
  1: 'Cómo te van a encontrar. Elegí lo que mejor describe lo que vendés.',
  2: 'Marcá los medios que aceptás y cargá el dato de cada uno. Al menos uno.',
  3: 'Tu WhatsApp de contacto, para coordinar la entrega.',
}

type Form = {
  name: string
  description: string
  categorySlugs: string[]
  paymentMethodSlugs: string[]
  // Keyed by payment-method slug: each accepted method owns exactly one datum.
  paymentData: Record<string, string>
  dialCode: string
  whatsappNumber: string
}

// A datum verdict belongs to its method, so its key carries the slug next to the step fields.
type DatumField = `paymentData:${string}`
type ErrorKey = Exclude<keyof Form, 'paymentData'> | DatumField
type Errors = Partial<Record<ErrorKey, string>>

function datumField(slug: string): DatumField {
  return `paymentData:${slug}`
}

const STEP_FIELDS: Record<Step, Exclude<keyof Form, 'paymentData'>[]> = {
  1: ['name', 'description', 'categorySlugs'],
  2: ['paymentMethodSlugs'],
  3: ['dialCode', 'whatsappNumber'],
}

function initialForm(initial: ShopView | null | undefined): Form {
  return {
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    categorySlugs: initial?.categorySlugs ?? [],
    paymentMethodSlugs: initial?.paymentMethodSlugs ?? [],
    paymentData: Object.fromEntries((initial?.paymentData ?? []).map(entry => [entry.slug, entry.value])),
    dialCode: initial?.whatsapp.dialCode ?? COLOMBIA_DIAL_CODE,
    whatsappNumber: initial?.whatsapp.number ?? '',
  }
}

// The catalogue declares which datum each method captures, so every selected method
// reveals its own field instead of a single hard-coded one.
function selectedMethods(form: Form, paymentMethods: CatalogPaymentMethod[]) {
  return paymentMethods.filter(method => form.paymentMethodSlugs.includes(method.slug))
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

  // Every selected method needs its own datum; its kind decides the rule.
  for (const method of selectedMethods(form, paymentMethods)) {
    const value = (form.paymentData[method.slug] ?? '').trim()
    if (value.length === 0) errors[datumField(method.slug)] = `Ingresá el dato de ${method.label}.`
    else if (!DATUM_RULES[method.dataKind].valid(value)) errors[datumField(method.slug)] = DATUM_RULES[method.dataKind].message
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

const STEP_COMPLETE_HINT = 'Podés editarlo después.'

// The footer sentence is the first rule the step itself reports, so it cannot drift from
// the validation the advance runs and never asks for something the step does not enforce.
// A complete step reassures instead of inventing a requirement.
function stepHint(step: Step, form: Form, paymentMethods: CatalogPaymentMethod[], dialCodes: CatalogDialCode[]): string {
  const blocking = Object.values(validateStep(step, form, paymentMethods, dialCodes))
  return blocking[0] ?? STEP_COMPLETE_HINT
}

function toInput(form: Form, paymentMethods: CatalogPaymentMethod[]): WizardInput {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    categorySlugs: form.categorySlugs,
    paymentMethodSlugs: form.paymentMethodSlugs,
    // Exactly one datum per selected method and none for an unselected one: the server
    // rejects a value that outlives the method it belongs to.
    paymentData: selectedMethods(form, paymentMethods).map(method => ({
      slug: method.slug,
      value: (form.paymentData[method.slug] ?? '').trim(),
    })),
    whatsapp: { dialCode: form.dialCode, number: form.whatsappNumber.replace(WHATSAPP_SEPARATORS, '') },
  }
}

function StepProgress({ step }: { step: Step }) {
  const current = STEPS[step - 1]
  return <div className="flex flex-col gap-3">
    {/* Announced on every change: the bar alone says nothing to a screen reader. */}
    <p aria-live="polite" className="text-sm text-muted-foreground">{`Paso ${step} de 3`}</p>
    {/* One continuous bar whose filled share is the step over three. The value travels as
        `aria-valuenow`/`aria-valuetext`, so the progress is announced instead of read from
        the colour, and the label carries the completed/current distinction. */}
    <div
      role="progressbar"
      aria-label={`Paso ${step} de 3 · ${current.label}`}
      aria-valuetext={`Paso ${step} de 3 · ${current.label}`}
      aria-valuemin={1}
      aria-valuemax={STEPS.length}
      aria-valuenow={step}
      className="h-1.5 w-full overflow-hidden rounded-full bg-border"
    >
      <div aria-hidden="true" className="h-full rounded-full bg-primary" style={{ width: `${(step / STEPS.length) * 100}%` }} />
    </div>
    <ol aria-label="Pasos de la configuración" className="flex gap-2">
      {STEPS.map(item => <li
        key={item.number}
        aria-current={item.number === step ? 'step' : undefined}
        className="flex-1 text-xs text-muted-foreground"
      >{`${item.number} · ${item.label}`}</li>)}
    </ol>
  </div>
}

export function ShopWizard({ initial, categories, paymentMethods, dialCodes, step: ownedStep, onStepChange, onCancel, pending = false, error, footer, onSubmit }: {
  initial?: ShopView | null
  categories: CatalogCategory[]
  paymentMethods: CatalogPaymentMethod[]
  dialCodes: CatalogDialCode[]
  step?: WizardStep
  onStepChange?: (step: WizardStep) => void
  // The screen that hosts the wizard owns where cancelling lands; without it the wizard
  // paints no cancel control, so a first run has nothing to cancel.
  onCancel?: () => void
  pending?: boolean
  error?: string | null
  footer?: ReactNode
  onSubmit: (input: WizardInput) => void
}) {
  const [form, setForm] = useState<Form>(() => initialForm(initial))
  const [internalStep, setInternalStep] = useState<Step>(1)
  const step = ownedStep ?? internalStep
  const [errors, setErrors] = useState<Errors>({})

  // Every move reports itself, so an owning caller (the URL) can record it. The internal
  // state keeps the wizard working unchanged for callers that own nothing.
  function goTo(next: Step) {
    setInternalStep(next)
    onStepChange?.(next)
  }

  function update<K extends Exclude<keyof Form, 'paymentData'>>(key: K, value: Form[K]) {
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

  // Each datum lives and is cleared on its own: correcting Nequi never clears the
  // verdict of the Bre-B key.
  function updateDatum(slug: string, value: string) {
    setForm(current => ({ ...current, paymentData: { ...current.paymentData, [slug]: value } }))
    setErrors(current => {
      const field = datumField(slug)
      if (current[field] === undefined) return current
      const nextErrors = { ...current }
      delete nextErrors[field]
      return nextErrors
    })
  }

  function toggleInList(key: 'categorySlugs' | 'paymentMethodSlugs', slug: string) {
    setForm(current => ({
      ...current,
      [key]: current[key].includes(slug) ? current[key].filter(item => item !== slug) : [...current[key], slug],
    }))
    // The datum belongs to the payment method, so its verdict is stale as soon as that
    // method's selection changes.
    setErrors(current => {
      const nextErrors = { ...current }
      delete nextErrors[key]
      if (key === 'paymentMethodSlugs') delete nextErrors[datumField(slug)]
      return nextErrors
    })
  }

  function applyStepErrors(found: Errors) {
    setErrors(current => {
      const nextErrors = { ...current }
      for (const field of STEP_FIELDS[step]) delete nextErrors[field]
      if (step === 2) {
        for (const key of Object.keys(nextErrors) as ErrorKey[]) {
          if (key.startsWith('paymentData:')) delete nextErrors[key]
        }
      }
      return { ...nextErrors, ...found }
    })
  }

  function advance() {
    const found = validateStep(step, form, paymentMethods, dialCodes)
    applyStepErrors(found)
    if (Object.keys(found).length > 0) return
    if (step < 3) goTo((step + 1) as Step)
  }

  function back() {
    if (step > 1) goTo((step - 1) as Step)
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
      goTo(blocking.number)
      return
    }
    onSubmit(toInput(form, paymentMethods))
  }

  return <VisualShell title="Configurá tu tienda" wide>
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
          {/* The step lead above already says what this group offers: repeating it here
              reads the same sentence twice. */}
          <FieldLegend>Medios de pago</FieldLegend>
          <Field
            data-invalid={errors.paymentMethodSlugs ? true : undefined}
            aria-invalid={errors.paymentMethodSlugs ? true : undefined}
          >
            {/* One card per method, two per row once the wizard is wide enough and one
                when it is not: the container query follows the form's own width. */}
            <div className="grid grid-cols-1 items-start gap-3 @sm/field-group:grid-cols-2">
              {paymentMethods.map(method => {
                const selected = form.paymentMethodSlugs.includes(method.slug)
                const field = datumField(method.slug)
                const datumError = errors[field]
                const inputId = `payment-datum-${method.slug}`
                const hintId = `${inputId}-hint`
                const errorId = `${inputId}-error`
                // The datum opens inside the method's own card: there is no separate section
                // and no shared field, so the operator sees which method each value belongs to.
                // `min-w-0` lets the column shrink below the label's min-content width, and
                // the label itself wraps instead of the card of another column paying for it.
                return <div
                  key={method.slug}
                  data-slot="payment-method"
                  data-selected={selected || undefined}
                  className={cn('min-w-0 rounded-xl border', selected ? 'border-primary ring-1 ring-primary' : 'border-border')}
                >
                  <Button
                    type="button"
                    aria-pressed={selected}
                    variant="ghost"
                    // The primitive keeps button copy on one line; a catalogue label is prose
                    // that has to wrap inside its own card.
                    className="h-auto w-full flex-col items-start gap-0.5 rounded-xl px-3.5 py-3 text-left whitespace-normal break-words"
                    onClick={() => toggleInList('paymentMethodSlugs', method.slug)}
                  >
                    <span className="min-w-0 font-medium">{method.label}</span>
                    <span className="min-w-0 text-xs font-normal text-muted-foreground">{method.description}</span>
                  </Button>
                  {selected && <Field data-invalid={datumError ? true : undefined} className="min-w-0 px-3.5 pb-3.5">
                    <FieldLabel htmlFor={inputId}>{method.dataLabel}</FieldLabel>
                    <Input
                      id={inputId}
                      inputMode={method.dataKind === 'phone' ? 'tel' : undefined}
                      value={form.paymentData[method.slug] ?? ''}
                      aria-invalid={datumError ? true : undefined}
                      aria-describedby={datumError ? `${hintId} ${errorId}` : hintId}
                      onChange={event => updateDatum(method.slug, event.target.value)}
                    />
                    <FieldDescription id={hintId}>{method.dataHint}</FieldDescription>
                    {datumError && <FieldError id={errorId}>{datumError}</FieldError>}
                  </Field>}
                </div>
              })}
            </div>
            {errors.paymentMethodSlugs && <FieldError>{errors.paymentMethodSlugs}</FieldError>}
          </Field>
        </FieldSet>
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

      {/* Every control of the form lives here, on one row inside the card: back and
          cancel on the left, what the step still needs in the middle, the primary action
          on the right. */}
      <div data-slot="wizard-footer" className="flex flex-wrap items-center gap-2 border-t pt-4">
        {step > 1 && <Button type="button" variant="outline" onClick={back}>Atrás</Button>}
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>}
        <p data-slot="wizard-hint" className="min-w-0 flex-1 text-sm text-muted-foreground">
          {stepHint(step, form, paymentMethods, dialCodes)}
        </p>
        {/* Distinct keys on purpose. Sharing a position made React reuse the pressed node, so
            the `type=button` the operator clicked became the `type=submit` of the last step
            mid-dispatch; the browser then ran that node's activation behaviour and submitted
            the form, saving the shop and bouncing to the panel from step 2. */}
        {step < 3
          ? <Button key="advance" type="button" onClick={advance}>Continuar</Button>
          : <Button key="save" type="submit" disabled={pending} data-icon={pending ? 'inline-start' : undefined}>
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