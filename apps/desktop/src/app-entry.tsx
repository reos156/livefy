import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { Button } from '@/components/ui/button'
import { VisualShell } from './components/visual-shell'
import { WaitingScreen } from './components/waiting-screen'
import { ShopWizard } from './shop-wizard'
import { LogoutButton } from './lib/session'
import { shopErrorMessage, shopFunctions, type ShopView, type WizardInput } from './lib/shop-api'

// The surface a completed wizard lands on. R2 replaces this summary with the initial
// dashboard in its own scope; until then it carries the accepted first-live call to
// action, and the entry stays inert because no live screen exists yet.
function ShopSummary({ shop, onEdit }: { shop: ShopView; onEdit: () => void }) {
  return <VisualShell title="Tu tienda">
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-medium">{shop.name}</h2>
      <p className="text-muted-foreground">{shop.description}</p>
      <dl className="flex flex-col gap-1 text-sm">
        <div><dt className="inline font-medium">Categorías: </dt><dd className="inline">{shop.categories.join(', ')}</dd></div>
        <div><dt className="inline font-medium">Medios de pago: </dt><dd className="inline">{shop.paymentMethods.join(', ')}</dd></div>
        <div><dt className="inline font-medium">Bot TikTok: </dt><dd className="inline">{shop.tiktokBotHandle ?? 'pendiente de asignación'}</dd></div>
        <div><dt className="inline font-medium">WhatsApp bot: </dt><dd className="inline">{shop.whatsappBotNumber ?? 'pendiente de asignación'}</dd></div>
      </dl>
      <Button disabled>Conectá tu primer live</Button>
      <Button variant="outline" onClick={onEdit}>Editar datos de la tienda</Button>
      <LogoutButton />
    </div>
  </VisualShell>
}

export function AppEntry() {
  const shop = useQuery(shopFunctions.current)
  const completeWizard = useMutation(shopFunctions.completeWizard)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // S2: the same create-or-update mutation serves the first completion and every
  // later edit, so the summary can reopen the form prefilled with the stored shop.
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
  return <ShopSummary shop={shop} onEdit={() => setEditing(true)} />
}
