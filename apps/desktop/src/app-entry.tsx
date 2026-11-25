import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { Button } from '@/components/ui/button'
import { VisualShell } from './components/visual-shell'
import { WaitingScreen } from './components/waiting-screen'
import { ShopWizard } from './shop-wizard'
import { LogoutButton } from './lib/session'
import { catalogFunctions, shopErrorMessage, shopFunctions, type CatalogCategory, type ShopView, type WizardInput } from './lib/shop-api'

// Catalogue slugs are stored on the shop, so the summary resolves them back to the
// labels the operator chose. An entry the table no longer holds falls back to its slug
// instead of disappearing.
function labelsFor(slugs: string[], catalogue: Array<{ slug: string; label: string }>) {
  return slugs.map(slug => catalogue.find(entry => entry.slug === slug)?.label ?? slug).join(', ')
}

// The surface a completed wizard lands on. R2 replaces this summary with the initial
// dashboard in its own scope; until then it carries the accepted first-live call to
// action, and the entry stays inert because no live screen exists yet.
function ShopSummary({ shop, categories, onEdit }: { shop: ShopView; categories: CatalogCategory[]; onEdit: () => void }) {
  const { dialCode, number } = shop.whatsapp
  return <VisualShell title="Tu tienda">
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-medium">{shop.name}</h2>
      <p className="text-muted-foreground">{shop.description}</p>
      <dl className="flex flex-col gap-1 text-sm">
        <div><dt className="inline font-medium">Categorías: </dt><dd className="inline">{labelsFor(shop.categorySlugs, categories)}</dd></div>
        <div><dt className="inline font-medium">Medios de pago: </dt><dd className="inline">{shop.paymentMethodSlugs.join(', ')}</dd></div>
        <div><dt className="inline font-medium">WhatsApp de contacto: </dt><dd className="inline">{`${dialCode} ${number}`}</dd></div>
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
  // The screen offers exactly what the database holds, never a list compiled into the app.
  const categoryRows = useQuery(catalogFunctions.categories)
  const paymentMethodRows = useQuery(catalogFunctions.paymentMethods)
  const dialCodeRows = useQuery(catalogFunctions.dialCodes)
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
  return <ShopSummary shop={shop} categories={categories} onEdit={() => setEditing(true)} />
}