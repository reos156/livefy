import { useState, type ReactNode } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { Outlet, useNavigate, useSearch } from '@tanstack/react-router'
import { WaitingScreen } from './components/waiting-screen'
import { Panel } from './panel'
import { ShopWizard, type WizardStep } from './shop-wizard'
import { LogoutButton } from './lib/session'
import {
  catalogFunctions,
  shopErrorMessage,
  shopFunctions,
  type CatalogCategory,
  type CatalogDialCode,
  type CatalogPaymentMethod,
  type ShopView,
  type WizardInput,
} from './lib/shop-api'

type ShopScreen = {
  // `null` is a first-run operator: no shop exists yet, and the wizard is the screen.
  shop: ShopView | null
  categories: CatalogCategory[]
  paymentMethods: CatalogPaymentMethod[]
  dialCodes: CatalogDialCode[]
}

// The catalogues the form offers, read once per surface. Painting the form before they
// arrive would show an empty category set the operator could not complete.
function useShopScreen(): ShopScreen | undefined {
  const shop = useQuery(shopFunctions.current)
  const categoryRows = useQuery(catalogFunctions.categories)
  const paymentMethodRows = useQuery(catalogFunctions.paymentMethods)
  const dialCodeRows = useQuery(catalogFunctions.dialCodes)
  if (
    shop === undefined ||
    categoryRows === undefined ||
    paymentMethodRows === undefined ||
    dialCodeRows === undefined
  ) return undefined
  // A catalogue that resolved without rows answers `null` from the hook; the screen
  // still renders so the operator is never stuck on a loading cue that cannot end.
  return {
    shop,
    categories: categoryRows ?? [],
    paymentMethods: paymentMethodRows ?? [],
    dialCodes: dialCodeRows ?? [],
  }
}

// The form itself. It owns the submission — the same create-or-update mutation serves the
// first completion and every later edit — while the surface that hosts it owns navigation.
function StoreForm({ screen, initial, step, onStepChange, onCancel, onSaved, footer }: {
  screen: ShopScreen
  initial: ShopView | null
  step?: WizardStep
  onStepChange?: (step: WizardStep) => void
  onCancel?: () => void
  onSaved?: () => void
  footer?: ReactNode
}) {
  const completeWizard = useMutation(shopFunctions.completeWizard)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function submit(input: WizardInput) {
    setPending(true)
    setError(null)
    void completeWizard(input)
      .then(() => onSaved?.())
      .catch(cause => setError(shopErrorMessage(cause)))
      .finally(() => setPending(false))
  }

  return <ShopWizard
    initial={initial}
    categories={screen.categories}
    paymentMethods={screen.paymentMethods}
    dialCodes={screen.dialCodes}
    step={step}
    onStepChange={onStepChange}
    onCancel={onCancel}
    pending={pending}
    error={error}
    onSubmit={submit}
    footer={footer}
  />
}

export function AppEntry() {
  const screen = useShopScreen()
  if (!screen) return <WaitingScreen label="Cargando tu tienda" />
  // S12/D3: no shop keeps the operator in the wizard, whatever path they arrived on. A
  // first run has no panel to cancel back to, and the form deliberately carries no
  // session control — except here, where the panel that owns one does not exist yet and
  // removing it would leave a brand-new operator with no way to close the session.
  if (screen.shop === null) return <StoreForm screen={screen} initial={null} footer={<LogoutButton />} />
  // S12/D2: a configured shop lands on the routed surface. The choice of panel or form
  // lives in the URL, so a transient remount re-reads it instead of a lost `useState`.
  return <Outlet />
}

export function PanelSurface() {
  const navigate = useNavigate()
  // S2: the panel reopens the form that created the shop, prefilled, for later edits.
  // A fresh edit opens on the first step, whatever step the previous one was left on.
  return <Panel onEditStore={() => { void navigate({ to: '/app/store', search: { paso: 1 } }) }} />
}

// The store form has its own path under the panel. Entering it is what says the operator is
// editing, and the step travels in the search string, so neither survives only in memory.
export function StoreSurface() {
  const screen = useShopScreen()
  const { paso } = useSearch({ from: '/app/store' })
  const navigate = useNavigate()
  if (!screen) return <WaitingScreen label="Cargando tu tienda" />
  function backToPanel() {
    void navigate({ to: '/app' })
  }
  return <StoreForm
    screen={screen}
    initial={screen.shop}
    step={paso}
    onStepChange={step => { void navigate({ to: '/app/store', search: { paso: step }, replace: true }) }}
    onCancel={backToPanel}
    onSaved={backToPanel}
  />
}