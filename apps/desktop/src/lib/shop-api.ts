import { makeFunctionReference } from 'convex/server'

// The shop document as the operator sees it. `_id` never crosses the boundary as a
// selectable value: the backend derives it from the authenticated identity.
export type ShopView = {
  shopId: string
  name: string
  description: string
  categorySlugs: string[]
  paymentMethodSlugs: string[]
  breBKey: string | null
  whatsapp: { dialCode: string; number: string }
  tiktokBotHandle: string | null
  whatsappBotNumber: string | null
}

export type WizardInput = {
  name: string
  description: string
  categorySlugs: string[]
  paymentMethodSlugs: string[]
  breBKey?: string
  whatsapp: { dialCode: string; number: string }
}

// Catalogue rows as the backend publishes them: the screen renders whatever the
// database holds, so a new category or country is a data change, never a code change.
export type CatalogCategory = { slug: string; label: string }
export type CatalogPaymentMethod = { slug: string; label: string; description: string; requiresKey: boolean }
export type CatalogDialCode = { iso2: string; label: string; dial: string }

// Closed set the backend publishes. Typing the copy map against it turns a renamed or
// new code into a typecheck failure instead of a silent generic fallback.
export type ShopValidationCode =
  | 'shop-name-required'
  | 'shop-description-required'
  | 'shop-field-too-long'
  | 'shop-categories-required'
  | 'shop-payment-methods-required'
  | 'shop-list-too-long'
  | 'shop-category-unknown'
  | 'shop-payment-method-unknown'
  | 'shop-breb-key-required'
  | 'shop-breb-key-invalid'
  | 'shop-breb-key-unexpected'
  | 'shop-dial-code-unknown'
  | 'shop-whatsapp-invalid'
  | 'shop-not-found'

// `code` stays a plain string because the value arrives from the network; the lookup
// below narrows it back to the closed set at runtime.
export type ShopValidationPayload = { code?: string; field?: string }

// Typed references keep the renderer honest about the backend contract while
// `_generated/api` still lacks the module, which only its codegen run can add.
export const shopFunctions = {
  current: makeFunctionReference<'query', Record<string, never>, ShopView | null>('shops:current'),
  completeWizard: makeFunctionReference<'mutation', WizardInput, ShopView>('shops:completeWizard'),
}

export const catalogFunctions = {
  categories: makeFunctionReference<'query', Record<string, never>, CatalogCategory[]>('catalog:categories'),
  paymentMethods: makeFunctionReference<'query', Record<string, never>, CatalogPaymentMethod[]>('catalog:paymentMethods'),
  dialCodes: makeFunctionReference<'query', Record<string, never>, CatalogDialCode[]>('catalog:dialCodes'),
}

const copy: Record<ShopValidationCode, string> = {
  'shop-name-required': 'Ingresá el nombre de la tienda.',
  'shop-description-required': 'Ingresá una descripción.',
  'shop-field-too-long': 'Ese dato es demasiado largo.',
  'shop-categories-required': 'Elegí al menos una categoría.',
  'shop-payment-methods-required': 'Elegí al menos un medio de pago.',
  'shop-list-too-long': 'Quitá algún ítem: la lista es demasiado larga.',
  'shop-category-unknown': 'Esa categoría ya no está disponible. Recargá la pantalla.',
  'shop-payment-method-unknown': 'Ese medio de pago ya no está disponible. Recargá la pantalla.',
  'shop-breb-key-required': 'Ingresá tu llave Bre-B.',
  'shop-breb-key-invalid': 'Revisá la llave: usá entre 3 y 40 caracteres, sin espacios.',
  'shop-breb-key-unexpected': 'Quitá la llave Bre-B o elegí ese medio de pago.',
  'shop-dial-code-unknown': 'Elegí un indicativo de la lista.',
  'shop-whatsapp-invalid': 'Ingresá un WhatsApp de contacto: entre 7 y 15 dígitos.',
  'shop-not-found': 'No encontramos tu tienda. Recargá la pantalla.',
}

/** Turns a backend validation code into the sentence the operator reads. */
export function shopErrorMessage(cause: unknown): string {
  const payload = (cause as { data?: ShopValidationPayload })?.data
  const code = payload?.code
  const known = code && Object.hasOwn(copy, code) ? copy[code as ShopValidationCode] : undefined
  return known ?? 'No pudimos guardar la tienda. Probá de nuevo.'
}