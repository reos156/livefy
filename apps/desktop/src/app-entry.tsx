import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { WaitingScreen } from './components/waiting-screen'
import { Panel } from './panel'
import { ShopWizard } from './shop-wizard'
import { LogoutButton } from './lib/session'
import { catalogFunctions, shopErrorMessage, shopFunctions, type WizardInput } from './lib/shop-api'

export function AppEntry() {
  const shop = useQuery(shopFunctions.current)
  // The screen offers exactly what the database holds, never a list compiled into the app.
  const categoryRows = useQuery(catalogFunctions.categories)
  const paymentMethodRows = useQuery(catalogFunctions.paymentMethods)
  const dialCodeRows = useQuery(catalogFunctions.dialCodes)
  const completeWizard = useMutation(shopFunctions.completeWizard)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // S2: the same create-or-update mutation serves the first completion and every
  // later edit, so the panel can reopen the form prefilled with the stored shop.
  const [editing, setEditing] = useState(false)

  function submit(input: WizardInput) {
    setPending(true)
    setError(null)
    void completeWizard(input)
      .then(() => setEditing(false))
      .catch(cause => setError(shopErrorMessage(cause)))
      .finally(() => setPending(false))
  }

  // The form offers the catalogues; painting it before they arrive would show an
  // empty category set the operator could not complete.
  if (
    shop === undefined ||
    categoryRows === undefined ||
    paymentMethodRows === undefined ||
    dialCodeRows === undefined
  ) return <WaitingScreen label="Cargando tu tienda" />
  // A catalogue that resolved without rows answers `null` from the hook; the screen
  // still renders so the operator is never stuck on a loading cue that cannot end.
  const categories = categoryRows ?? []
  const paymentMethods = paymentMethodRows ?? []
  const dialCodes = dialCodeRows ?? []
  if (shop === null || editing) return <ShopWizard
    initial={shop}
    categories={categories}
    paymentMethods={paymentMethods}
    dialCodes={dialCodes}
    pending={pending}
    error={error}
    footer={<LogoutButton />}
    onSubmit={submit}
  />
  // S12: no shop keeps the operator in the wizard (D3), and a configured shop lands
  // on the dashboard (D2). The retired summary had no other destination.
  return <Panel onEditStore={() => setEditing(true)} />
