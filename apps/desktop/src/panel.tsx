import { useState, type ReactNode } from 'react'
import { useQuery } from 'convex/react'
import { cn } from 'cn'
import {
  ChevronsLeftIcon,
  ChevronsRightIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MoonIcon,
  PackageIcon,
  ReceiptIcon,
  StoreIcon,
  SunIcon,
  UserRoundIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LogoutButton, useLogout } from './lib/session'
import { dashboardFunctions, type DashboardMetrics, type LiveConnection } from './lib/shop-api'
import { WaitingScreen } from './components/waiting-screen'

// S9: every state the panel must distinguish, in the order the scope names them.
const LIVE_STATES: LiveConnection[] = ['connected', 'reconnecting', 'offline', 'suspended-risk', 'disconnected', 'ended']

// Operator copy for the state the backend reports. `null` is not a state of its own:
// it means there is no live, which the operator reads as disconnected.
const connectionCopy: Record<LiveConnection, string> = {
  connected: 'Conectado',
  reconnecting: 'Reconectando',
  offline: 'Sin conexión',
  'suspended-risk': 'Suspendido',
  disconnected: 'Desconectado',
  ended: 'Finalizado',
}

// The explanation both disabled controls point at: there is one shop per operator and
// no notification system, so the controls stay inert instead of implying a feature.

// The project's tokens already answer to `.dark` on the document root, so the toggle owns
// that single class and reports its state through `aria-pressed`.
function useThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  function toggle() {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    setDark(next)
  }
  return { dark, toggle }
}

// Sidebar structure, not a control: semantic HTML over the project's own tokens. The
// unreachable destinations stay visible and honestly disabled (no screen exists yet),
// and never link anywhere. Collapsed, the label leaves the DOM so the rail is icon-only
// and the accessible name comes from `aria-label`, which keeps every item reachable.
function NavItem({ label, icon: Icon, current = false, soon = false, collapsed = false, onClick }: {
  label: string
  icon: LucideIcon
  current?: boolean
  soon?: boolean
  collapsed?: boolean
  onClick?: () => void
}) {
  return <li>
    <button
      type="button"
      aria-current={current ? 'page' : undefined}
      aria-disabled={soon ? true : undefined}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      disabled={soon}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors',
        collapsed && 'justify-center px-0 py-2',
        current ? 'bg-muted font-semibold text-foreground' : 'text-muted-foreground',
        soon ? 'cursor-not-allowed opacity-55' : 'hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {!collapsed && <span>{label}</span>}
      {soon && !collapsed && <span className="ml-auto text-[0.6rem] tracking-[0.04em] uppercase">pronto</span>}
    </button>
  </li>
}

function Sidebar({ collapsed, onToggleCollapsed, onOpenStore }: {
  collapsed: boolean
  onToggleCollapsed: () => void
  onOpenStore: () => void
}) {
  return <aside
    id="panel-sidebar"
    aria-label="Principal"
    className={cn('flex flex-col gap-1 border-r border-border bg-card py-3', collapsed ? 'px-1' : 'px-2.5')}
  >
    <div className={cn('flex items-center gap-2 pb-2', collapsed ? 'flex-col' : 'px-2')}>
      {!collapsed && <span className="visual-mark" aria-hidden="true">L</span>}
      {!collapsed && <strong className="text-sm font-semibold">Livefy</strong>}
      <Button
        variant="ghost"
        size="icon-xs"
        className={cn(!collapsed && 'ml-auto')}
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
        aria-controls="panel-sidebar"
        aria-label={collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
        title={collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
      >
        {collapsed ? <ChevronsRightIcon aria-hidden="true" /> : <ChevronsLeftIcon aria-hidden="true" />}
      </Button>
    </div>
    <nav aria-label="Operación" className="flex flex-col gap-1">
      {!collapsed && <p className="px-2 text-[0.625rem] tracking-[0.06em] text-muted-foreground uppercase">Operación</p>}
      <ul className="flex flex-col gap-0.5">
        <NavItem label="Panel" icon={LayoutDashboardIcon} current collapsed={collapsed} />
        <NavItem label="Leads" icon={UsersIcon} soon collapsed={collapsed} />
        <NavItem label="Ventas" icon={ReceiptIcon} soon collapsed={collapsed} />
      </ul>
    </nav>
    <nav aria-label="Catálogo" className="flex flex-col gap-1">
      {!collapsed && <p className="px-2 text-[0.625rem] tracking-[0.06em] text-muted-foreground uppercase">Catálogo</p>}
      <ul className="flex flex-col gap-0.5">
        <NavItem label="Productos" icon={PackageIcon} soon collapsed={collapsed} />
        <NavItem label="Tienda" icon={StoreIcon} collapsed={collapsed} onClick={onOpenStore} />
      </ul>
    </nav>
    <div className="flex-1" />
    {/* The existing sign-out keeps working in both widths; on the rail its label leaves
        the painted surface and an icon carries it, so the control still fits. */}
    <div className={cn('p-1', collapsed && 'flex justify-center')}>
      <div className={collapsed ? 'relative size-7 [&_button]:size-7 [&_button]:gap-0 [&_button]:p-0 [&_button]:text-[0px]' : undefined}>
        <LogoutButton />
        {collapsed && <LogOutIcon aria-hidden="true" className="pointer-events-none absolute inset-0 m-auto size-3.5 text-muted-foreground" />}
      </div>
    </div>
  </aside>
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <Card size="sm" className="gap-1">
    <CardHeader>
      <CardDescription className="text-[0.65rem] tracking-[0.04em] uppercase">{label}</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-xl font-bold tracking-tight text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">Sin datos todavía</p>
    </CardContent>
  </Card>
}

function KpiRow({ metrics }: { metrics: DashboardMetrics }) {
  const kpis = [
    { label: 'Lives activos', value: String(metrics.activeLives) },
    { label: 'Leads nuevos', value: String(metrics.newLeads) },
    { label: 'Pendientes', value: String(metrics.pendingLeads) },
    { label: 'Conversión', value: `${Math.round(metrics.conversionRate * 100)} %` },
    { label: 'Ventas estimadas', value: `$${new Intl.NumberFormat('es-CO').format(metrics.estimatedSales)}` },
  ]
  return <div className="grid grid-cols-2 gap-2.5 px-4 pt-3.5 lg:grid-cols-5">
    {kpis.map(kpi => <Kpi key={kpi.label} {...kpi} />)}
  </div>
}

// The top bar's shop identity occupies the slot the dashboard kit reserves for a
// workspace switcher. One shop per operator today, so it is inert and says why instead
// of offering a dropdown with a single entry.
// One shop per operator, so this states which shop the panel is showing instead of
// pretending to switch between several.
function ShopIdentity({ name }: { name: string }) {
  return <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
    <StoreIcon aria-hidden="true" className="size-4 text-muted-foreground" />
    <span className="truncate">{name}</span>
  </p>
}

// The kit's account menu, with only the entries that exist. `Panel` closes the menu and
// stays, `Modo oscuro` runs the same theme toggle as the top bar, and `Log out` is the
// existing sign-out.
function UserMenu({ onToggleTheme }: { onToggleTheme: () => void }) {
  const logout = useLogout()
  return <DropdownMenu>
    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Menú de la cuenta" />}>
      <UserRoundIcon aria-hidden="true" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="min-w-40">
      <DropdownMenuGroup>
        <DropdownMenuItem>Panel</DropdownMenuItem>
        <DropdownMenuItem onClick={onToggleTheme}>Modo oscuro</DropdownMenuItem>
        <DropdownMenuItem disabled={!logout} onClick={logout}>Log out</DropdownMenuItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
}

// One column of the workspace. Each is a labelled region whose card stretches to the
// row height, so the three columns stay aligned whatever content arrives.
function Column({ id, title, aside, children }: { id: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return <section aria-labelledby={id} className="flex min-w-0">
    <Card className="w-full gap-0 py-0">
      <CardHeader className="flex flex-row items-center gap-2 border-b border-border py-2.5">
        <h2 id={id} className="text-[0.7rem] font-medium tracking-[0.05em] text-muted-foreground uppercase">{title}</h2>
        {aside && <div className="ml-auto flex items-center gap-2">{aside}</div>}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2 py-2.5">{children}</CardContent>
    </Card>
  </section>
}

function LiveColumn({ connection }: { connection: LiveConnection | null }) {
  // No live at all is not a state: the header stays empty rather than claiming that
  // the last one ended, and the legend below still shows the six real states.
  return <Column
    id="column-live"
    title="Live de TikTok"
    aside={connection ? <Badge variant="outline">{connection}</Badge> : undefined}
  >
    {/* D-A: live capture does not exist yet, so the call to action stays visible and
        inert with the note that explains why, instead of pointing at nothing. */}
    <Button className="self-start" disabled aria-describedby="first-live-note">Conectá tu primer live</Button>
    <p id="first-live-note" className="text-xs text-muted-foreground">La conexión de lives llega en la próxima etapa.</p>
    <div className="grid min-h-40 place-items-center rounded-lg border border-dashed border-border bg-muted p-4 text-center">
      <div>
        <p className="text-xs font-medium text-foreground">Ningún live conectado</p>
        <p className="text-xs text-muted-foreground">Al conectar, el live se abre en una superficie aislada, sin Node y con sandbox.</p>
      </div>
    </div>
    {/* S6: the local ingestor health and its gap. Empty until R3 owns those readings,
        so the screen states the absence instead of inventing a measurement. */}
    <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
      <span>Ingestor: <strong className="font-semibold text-foreground">sin sesión</strong></span>
      <span>Brecha: <strong className="font-semibold text-foreground">—</strong></span>
    </div>
    <ul aria-label="Estados del live" className="flex flex-wrap gap-1">
      {LIVE_STATES.map(state => <li key={state}>
        <Badge
          variant={state === connection ? 'default' : 'outline'}
          aria-current={state === connection ? 'true' : undefined}
        >
          {state}
        </Badge>
      </li>)}
    </ul>
    <p className="text-xs text-muted-foreground">El login visual no autentica al ingestor. Cerrar la app detiene sólo la captura local, no el live comercial.</p>
  </Column>
}

function ProductsColumn() {
  return <Column
    id="column-products"
    title="Productos"
    aside={<Button variant="outline" size="sm" disabled>Crear</Button>}
  >
    <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-2.5 py-2 text-xs">
      <span>Producto activo</span>
      <strong className="font-semibold text-foreground">ninguno</strong>
    </div>
    <div className="flex min-h-40 flex-col justify-center rounded-lg border border-dashed border-border bg-muted p-4 text-center">
      <p className="text-xs font-medium text-foreground">Arrastrá un producto acá</p>
      <p className="text-xs text-muted-foreground">El activo es el que se ofrece y se notifica según el estado de cada lead.</p>
    </div>
    <p className="text-xs text-muted-foreground">Sin productos cargados. Se persisten en Convex.</p>
  </Column>
}

// S8 names the six columns the lead table will carry. With no leads there is no row,
// so the header is the whole honest content: no placeholder rows.
const LEAD_COLUMNS = ['Handle', 'WhatsApp', 'Estado', 'Ítems', 'Total', 'Última']

function LeadsColumn({ count }: { count: number }) {
  return <Column
    id="column-leads"
    title="Leads"
    aside={<span className="text-xs text-muted-foreground">{`${count} en el live`}</span>}
  >
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {LEAD_COLUMNS.map(column => <TableHead key={column} className="px-1 text-[0.65rem] whitespace-nowrap">{column}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody />
      </Table>
    </div>
    <div className="flex min-h-40 flex-col justify-center rounded-lg border border-dashed border-border bg-muted p-4 text-center">
      <p className="text-xs font-medium text-foreground">Sin leads todavía</p>
      <p className="text-xs text-muted-foreground">Entran en tiempo real. El comprobante se valida o rechaza en esta columna.</p>
    </div>
  </Column>
}

export function Panel({ onEditStore }: { onEditStore: () => void }) {
  const stats = useQuery(dashboardFunctions.getDashboardStats)
  // Session-only chrome state: the rail and the theme are remembered while the panel is
  // mounted, which is all the operator asked for.
  const [collapsed, setCollapsed] = useState(false)
  const { dark, toggle: toggleTheme } = useThemeToggle()
  if (stats === undefined) return <WaitingScreen label="Cargando tu panel" />
  const { metrics, liveConnection } = stats
  // S11: ending the commercial live is explicit, and it is only possible while a live
  // is connected. Closing the app stops the local runner, not the live.
  const canEndLive = liveConnection === 'connected'
  return <div className={cn(
    'grid min-h-svh bg-background text-foreground',
    collapsed ? 'grid-cols-[3.5rem_1fr]' : 'grid-cols-[13.75rem_1fr]',
  )}>
    <Sidebar
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed(current => !current)}
      onOpenStore={onEditStore}
    />
    <div className="flex min-w-0 flex-col">
      <header className="flex items-center gap-2.5 border-b border-border bg-card px-4 py-2.5">
        <ShopIdentity name={stats.shopName} />
        <span className="flex-1" />
        <Badge variant="outline" className="gap-1.5">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-muted-foreground" />
          {liveConnection ? connectionCopy[liveConnection] : 'Desconectado'}
        </Badge>
        <Button disabled={!canEndLive} title={canEndLive ? undefined : 'Requiere un live conectado'}>Finalizar live</Button>
        <Button
          variant="ghost"
          size="icon"
          aria-pressed={dark}
          aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          title={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          onClick={toggleTheme}
        >
          {dark ? <SunIcon aria-hidden="true" /> : <MoonIcon aria-hidden="true" />}
        </Button>
        <UserMenu onToggleTheme={toggleTheme} />
      </header>
      <KpiRow metrics={metrics} />
      <div className="grid flex-1 grid-cols-1 items-start gap-2.5 p-4 lg:grid-cols-[1.35fr_1fr_1.3fr]">
        <LiveColumn connection={liveConnection} />
        <ProductsColumn />
        <LeadsColumn count={stats.lives.length} />
      </div>
    </div>
  </div>
}