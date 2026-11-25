import { useState, type FormEvent, type ReactNode } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { VisualShell } from './components/visual-shell'
import type { ShopView, WizardInput } from './lib/shop-api'

// Same bounds the mutation enforces; here they only spare a round trip, never replace it.
const MAX_NAME = 80
const MAX_DESCRIPTION = 500
const MAX_LIST_ITEMS = 10
const MAX_LIST_ITEM = 40
const MAX_WHATSAPP = 32

type Form = {
  name: string
  description: string
  categories: string[]
  paymentMethods: string[]
  personalWhatsapp: string
}

type Errors = Partial<Record<keyof Form, string>>

function initialForm(initial: ShopView | null | undefined): Form {
  return {
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    categories: initial?.categories ?? [],
    paymentMethods: initial?.paymentMethods ?? [],
    personalWhatsapp: initial?.personalWhatsapp ?? '',
  }
}

function validate(form: Form): Errors {
  const errors: Errors = {}
  const name = form.name.trim()
  if (!name) errors.name = 'Ingresá el nombre de la tienda.'
  else if (name.length > MAX_NAME) errors.name = 'El nombre es demasiado largo.'

  const description = form.description.trim()
  if (!description) errors.description = 'Ingresá una descripción.'
  else if (description.length > MAX_DESCRIPTION) errors.description = 'La descripción es demasiado larga.'

  if (form.categories.length === 0) errors.categories = 'Agregá al menos una categoría.'
  else if (form.categories.length > MAX_LIST_ITEMS) errors.categories = 'Quitá algún ítem: la lista es demasiado larga.'
  else if (form.categories.some(item => !item.trim())) errors.categories = 'Completá o quitá el ítem vacío.'
  else if (form.categories.some(item => item.trim().length > MAX_LIST_ITEM)) errors.categories = 'Ese ítem es demasiado largo.'

  if (form.paymentMethods.length === 0) errors.paymentMethods = 'Agregá al menos un medio de pago.'
  else if (form.paymentMethods.length > MAX_LIST_ITEMS) errors.paymentMethods = 'Quitá algún ítem: la lista es demasiado larga.'
  else if (form.paymentMethods.some(item => !item.trim())) errors.paymentMethods = 'Completá o quitá el ítem vacío.'
  else if (form.paymentMethods.some(item => item.trim().length > MAX_LIST_ITEM)) errors.paymentMethods = 'Ese ítem es demasiado largo.'

  if (form.personalWhatsapp.trim().length > MAX_WHATSAPP) errors.personalWhatsapp = 'Ese número es demasiado largo.'
  return errors
}

function toInput(form: Form): WizardInput {
  const personalWhatsapp = form.personalWhatsapp.trim()
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    categories: form.categories.map(item => item.trim()),
    paymentMethods: form.paymentMethods.map(item => item.trim()),
    ...(personalWhatsapp ? { personalWhatsapp } : {}),
  }
}

// The identifiers belong to the platform, so the screen shows them and offers no
// control: an operator must never be able to point the shop at another bot.
function BotIdentifiers({ initial }: { initial?: ShopView | null }) {
  return <FieldSet>
    <FieldLegend>Datos de tus bots</FieldLegend>
    <FieldDescription>Los asigna la plataforma. No se editan acá.</FieldDescription>
    <FieldGroup>
      <p className="text-sm">{`Bot TikTok: ${initial?.tiktokBotHandle ?? 'pendiente de asignación'}`}</p>
      <p className="text-sm">{`WhatsApp bot: ${initial?.whatsappBotNumber ?? 'pendiente de asignación'}`}</p>
    </FieldGroup>
  </FieldSet>
}

function ItemList({ legend, idPrefix, description, addLabel, itemLabel, removeLabel, items, invalid, onChange, onAdd, onRemove }: {
  legend: string
  idPrefix: string
  description: string
  addLabel: string
  itemLabel: (index: number) => string
  removeLabel: (index: number) => string
  items: string[]
  invalid?: string
  onChange: (index: number, value: string) => void
  onAdd: () => void
  onRemove: (index: number) => void
}) {
  return <FieldSet>
    <FieldLegend>{legend}</FieldLegend>
    <FieldDescription>{description}</FieldDescription>
    <FieldGroup>
      {items.map((item, index) => (
        <Field key={index} data-invalid={invalid ? true : undefined}>
          <FieldLabel htmlFor={`${idPrefix}-${index}`}>{itemLabel(index)}</FieldLabel>
          <div className="flex items-center gap-2">
            <Input
              id={`${idPrefix}-${index}`}
              value={item}
              aria-invalid={invalid ? true : undefined}
              onChange={event => onChange(index, event.target.value)}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => onRemove(index)}>
              {removeLabel(index)}
            </Button>
          </div>
        </Field>
      ))}
      {items.length < MAX_LIST_ITEMS && <div>
        <Button type="button" variant="outline" onClick={onAdd}>{addLabel}</Button>
      </div>}
      {invalid && <FieldError>{invalid}</FieldError>}
    </FieldGroup>
  </FieldSet>
}

export function ShopWizard({ initial, pending = false, error, footer, onSubmit }: {
  initial?: ShopView | null
  pending?: boolean
  error?: string | null
  footer?: ReactNode
  onSubmit: (input: WizardInput) => void
}) {
  const [form, setForm] = useState<Form>(() => initialForm(initial))
  const [errors, setErrors] = useState<Errors>({})

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm(current => ({ ...current, [key]: value }))
  }
  function updateItem(key: 'categories' | 'paymentMethods', index: number, value: string) {
    setForm(current => ({ ...current, [key]: current[key].map((item, at) => (at === index ? value : item)) }))
  }
  function addItem(key: 'categories' | 'paymentMethods') {
    setForm(current => ({ ...current, [key]: [...current[key], ''] }))
  }
  function removeItem(key: 'categories' | 'paymentMethods', index: number) {
    setForm(current => ({ ...current, [key]: current[key].filter((_, at) => at !== index) }))
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const found = validate(form)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    onSubmit(toInput(form))
  }

  return <VisualShell title="Configurá tu tienda">
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      {error && <Alert role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
      <FieldGroup>
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
      </FieldGroup>

      <ItemList
        legend="Categorías"
        idPrefix="categoria"
        description="Qué vendés. Podés cargar más de una."
        addLabel="Agregar categoría"
        itemLabel={index => `Categoría ${index + 1}`}
        removeLabel={index => `Quitar categoría ${index + 1}`}
        items={form.categories}
        invalid={errors.categories}
        onChange={(index, value) => updateItem('categories', index, value)}
        onAdd={() => addItem('categories')}
        onRemove={index => removeItem('categories', index)}
      />

      <ItemList
        legend="Medios de pago"
        idPrefix="medio-pago"
        description="Con qué te pagan. Al menos uno."
        addLabel="Agregar medio de pago"
        itemLabel={index => `Medio de pago ${index + 1}`}
        removeLabel={index => `Quitar medio de pago ${index + 1}`}
        items={form.paymentMethods}
        invalid={errors.paymentMethods}
        onChange={(index, value) => updateItem('paymentMethods', index, value)}
        onAdd={() => addItem('paymentMethods')}
        onRemove={index => removeItem('paymentMethods', index)}
      />

      <Field data-invalid={errors.personalWhatsapp ? true : undefined}>
        <FieldLabel htmlFor="personal-whatsapp">WhatsApp personal (opcional)</FieldLabel>
        <FieldDescription>Solo para avisos. No reemplaza al bot.</FieldDescription>
        <Input
          id="personal-whatsapp"
          value={form.personalWhatsapp}
          aria-invalid={errors.personalWhatsapp ? true : undefined}
          onChange={event => update('personalWhatsapp', event.target.value)}
        />
        {errors.personalWhatsapp && <FieldError>{errors.personalWhatsapp}</FieldError>}
      </Field>

      <BotIdentifiers initial={initial} />

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending} data-icon={pending ? 'inline-start' : undefined}>
          {pending && <Spinner data-icon="inline-start" />}
          {pending ? 'Guardando…' : 'Guardar tienda'}
        </Button>
      </div>
    </form>
    {/* Outside the form on purpose: a caller-supplied control that omits
        `type="button"` defaults to a submit button, and would then save the shop. */}
    {footer && <div className="flex items-center gap-2">{footer}</div>}
  </VisualShell>
}
