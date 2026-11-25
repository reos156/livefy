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

// S9: the panel must distinguish these six live states. `null` means the operator has
// no live at all, which is not one of them.
export type LiveConnection =
  | 'connected'
  | 'reconnecting'
  | 'offline'
  | 'suspended-risk'
  | 'disconnected'
  | 'ended'

export type DashboardMetrics = {
  activeLives: number
  newLeads: number
  pendingLeads: number
  // 0..1; the screen formats it as a percentage.
  conversionRate: number
  // Whole Colombian pesos.
  estimatedSales: number
}

// D-D: the five metrics are part of the contract before their sources exist, so the
// screen and the query keep this exact shape when R3 and R4 start filling it.
export type DashboardStats = {
  shopId: string
  shopName: string
  liveConnection: LiveConnection | null
  metrics: DashboardMetrics
  lives: Array<{ liveId: string; status: LiveConnection }>
}

// Closed set the backend publishes. Typing the copy map against it turns a renamed or
// new code into a typecheck failure instead of a silent generic fallback.
export type ShopValidationCode =
  | 'shop-name-required'
  | 'shop-description-required'
  | 'shop-categories-required'
  | 'shop-payment-methods-required'
  | 'shop-item-empty'
  | 'shop-item-too-long'
  | 'shop-list-too-long'
  | 'shop-field-too-long'

// `code` stays a plain string because the value arrives from the network; the lookup
// below narrows it back to the closed set at runtime.
export type ShopValidationPayload = { code?: string; field?: string }

// Typed references keep the renderer honest about the backend contract while
// `_generated/api` still lacks the module, which only its codegen run can add.
export const shopFunctions = {
  current: makeFunctionReference<'query', Record<string, never>, ShopView | null>('shops:current'),
  completeWizard: makeFunctionReference<'mutation', WizardInput, ShopView>('shops:completeWizard'),
}

// The empty argument object is the contract: the shop comes from the identity, so the
// client has no identifier to send (S3).
export const dashboardFunctions = {
  getDashboardStats: makeFunctionReference<'query', Record<string, never>, DashboardStats>('dashboard:getDashboardStats'),
}

const copy: Record<ShopValidationCode, string> = {
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
  const code = payload?.code
  const known = code && Object.hasOwn(copy, code) ? copy[code as ShopValidationCode] : undefined
  return known ?? 'No pudimos guardar la tienda. Probá de nuevo.'
}
