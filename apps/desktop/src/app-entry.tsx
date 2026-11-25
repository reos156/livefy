import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { WaitingScreen } from './components/waiting-screen'
import { Panel } from './panel'
import { ShopWizard } from './shop-wizard'
import { LogoutButton } from './lib/session'
import { shopErrorMessage, shopFunctions, type WizardInput } from './lib/shop-api'

export function AppEntry() {
  const shop = useQuery(shopFunctions.current)
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

  if (shop === undefined) return <WaitingScreen label="Cargando tu tienda" />
  if (shop === null || editing) return <ShopWizard
    initial={shop}
    pending={pending}
    error={error}
    footer={<LogoutButton />}
    onSubmit={submit}
  />
  // S12: no shop keeps the operator in the wizard (D3), and a configured shop lands
  // on the dashboard (D2). The retired summary had no other destination.
  return <Panel onEditStore={() => setEditing(true)} />
}
