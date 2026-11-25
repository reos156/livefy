import { makeFunctionReference } from 'convex/server'

// The shop document as the operator sees it. `_id` never crosses the boundary as a
// selectable value: the backend derives it from the authenticated identity.
export type ShopView = {
  shopId: string
  name: string
  description: string
  categories: string[]
  paymentMethods: string[]
  personalWhatsapp: string | null
  tiktokBotHandle: string | null
  whatsappBotNumber: string | null
}

export type WizardInput = {
  name: string
  description: string
  categories: string[]
  paymentMethods: string[]
  personalWhatsapp?: string
}

export type ShopValidationPayload = { code?: string; field?: string }

// Typed references keep the renderer honest about the backend contract while
// `_generated/api` still lacks the module, which only its codegen run can add.
export const shopFunctions = {
  current: makeFunctionReference<'query', Record<string, never>, ShopView | null>('shops:current'),
  completeWizard: makeFunctionReference<'mutation', WizardInput, ShopView>('shops:completeWizard'),
}

const copy: Record<string, string> = {
  'shop-name-required': 'Ingresá el nombre de la tienda.',
  'shop-description-required': 'Ingresá una descripción.',
  'shop-categories-required': 'Agregá al menos una categoría.',
  'shop-payment-methods-required': 'Agregá al menos un medio de pago.',
  'shop-item-empty': 'Completá o quitá el ítem vacío.',
  'shop-item-too-long': 'Ese ítem es demasiado largo.',
  'shop-list-too-long': 'Quitá algún ítem: la lista es demasiado larga.',
  'shop-field-too-long': 'Ese dato es demasiado largo.',
}

/** Turns a backend validation code into the sentence the operator reads. */
export function shopErrorMessage(cause: unknown): string {
  const payload = (cause as { data?: ShopValidationPayload })?.data
  const known = payload?.code ? copy[payload.code] : undefined
  return known ?? 'No pudimos guardar la tienda. Probá de nuevo.'
}
