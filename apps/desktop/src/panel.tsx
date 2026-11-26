import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
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
  XIcon,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LogoutButton, useLogout } from './lib/session'
import { useLiveSurface } from './lib/live-surface'
import { dashboardFunctions, type LiveConnection } from './lib/shop-api'
import { WaitingScreen } from './components/waiting-screen'

// Operator copy for the state the backend reports. `null` is not a state of its own:
// it means there is no live, which the operator reads as disconnected. After the six-state
// legend left the column, this map is the only place those states reach the screen, through
// the top bar badge.
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

// One column of the workspace. Each is a labelled region whose card stretches to the row
// height, so the three columns stay aligned whatever content arrives. The body is a flex
// column that is allowed to shrink (`min-h-0`), which is what lets the live column hand
// its remaining height to the viewer instead of scrolling it.
function Column({ id, title, aside, header, children }: {
  id: string
  title: string
  aside?: ReactNode
  header?: ReactNode
  children: ReactNode
}) {
  return <section aria-labelledby={id} className="flex min-h-0 min-w-0">
    <Card className="min-h-0 w-full gap-0 overflow-hidden py-0">
      <CardHeader className="flex flex-row flex-wrap items-center gap-2 border-b border-border py-2.5">
        <h2 id={id} className="text-[0.7rem] font-medium tracking-[0.05em] text-muted-foreground uppercase">{title}</h2>
        {aside && <div className={cn('flex items-center gap-2', !header && 'ml-auto')}>{aside}</div>}
        {header && <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">{header}</div>}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 py-2.5">{children}</CardContent>
    </Card>
  </section>
}

// The handle rule the open button reads. The authoritative copy lives in the main process
// (`electron/live-surface.cjs`), which validates it before building the address and
// loading it; this copy only decides whether the button is enabled and which reason the
// operator reads. The renderer never builds or names a URL.
const CHANNEL_PATTERN = /^(?=.*[A-Za-z0-9])[A-Za-z0-9._]{2,24}$/
const CHANNEL_REASON_ID = 'live-channel-reason'

function channelProblem(raw: string): string | null {
  const value = raw.trim()
  if (!value) return 'Escribí el handle del canal para abrir el live.'
  if (!CHANNEL_PATTERN.test(value)) {
    return 'Ese handle no sirve: letras, números, punto y guion bajo, entre 2 y 24 caracteres, sin la arroba.'
  }
  return null
}

function LiveColumn() {
  const live = useLiveSurface()
  const { status } = live
  // Session state, not persisted: the last handle typed survives while the panel stays
  // mounted, and the retry asks for the channel that actually failed.
  const [channel, setChannel] = useState('')
  const [requested, setRequested] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)
  const handle = channel.trim()
  const problem = channelProblem(channel)
  // The field is the only way in, so the button stays inert until what it would open is a
  // channel main will accept.
  const canOpen = live.available && !problem && !status.mounted && !opening
  // The explanation only exists while there is one to give, so the field and the button
  // never point at an element that was not rendered.
  const reasonId = problem ? CHANNEL_REASON_ID : undefined

  async function open() {
    if (!canOpen) return
    setOpening(true)
    try {
      await live.mount(handle)
      setRequested(handle)
    } finally {
      setOpening(false)
    }
  }

  // The field lives in the header: it is what the column is about, and keeping it out of
  // the body leaves the body's whole remainder to the viewer.
  // One row: the column title already names the area, so the field's label is for assistive
  // technology only and never takes a line of its own at any column width.
  const channelField = <>
    <Label htmlFor="live-channel" className="sr-only">Canal de TikTok</Label>
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      {/* The arroba is a fixed part of the address, never something the operator types. */}
      <span aria-hidden="true" className="text-muted-foreground">@</span>
      <Input
        id="live-channel"
        className="min-w-0 flex-1"
        value={channel}
        onChange={event => setChannel(event.target.value)}
        placeholder="handle"
        autoComplete="off"
        spellCheck={false}
        aria-describedby={reasonId}
        aria-invalid={problem && handle ? true : undefined}
      />
    </div>
    <Button onClick={() => { void open() }} disabled={!canOpen} aria-describedby={reasonId}>Abrir el live</Button>
    {status.mounted && <Button
      variant="outline"
      size="icon-sm"
      aria-label="Cerrar visor"
      title="Cerrar visor"
      onClick={() => { void live.unmount() }}
    >
      <XIcon aria-hidden="true" />
    </Button>}
  </>

  return <Column
    id="column-live"
    title="Live de TikTok"
    // The operator opens the live explicitly. The surface is owned by the main process, so
    // this sends a channel instead of embedding anything in this document.
    header={live.available
      ? channelField
      : <Button disabled aria-describedby="first-live-note">Conectá tu primer live</Button>}
  >
    {/* The reason the button is inert is visible text and the button points at it, so the
        explanation is not carried by an attribute alone. */}
    {live.available
      ? problem && <p id={CHANNEL_REASON_ID} className="text-xs text-muted-foreground">{problem}</p>
      : <p id="first-live-note" className="text-xs text-muted-foreground">La conexión de lives llega en la próxima etapa.</p>}
    {status.state === 'failed' && <Alert variant="destructive" role="alert">
      <AlertDescription>{`TikTok no cargó: ${status.reason}. Revisá la conexión y reintentá.`}</AlertDescription>
      <AlertAction>
        <Button variant="outline" size="xs" onClick={() => { if (requested) void live.restart(requested) }}>Reintentar</Button>
      </AlertAction>
    </Alert>}
    {/* One status element: the spinner is decoration next to the sentence, not a second
        announcement of the same load. */}
    {status.state === 'loading' && <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
      <Spinner aria-hidden="true" role="presentation" /> Cargando TikTok…
    </p>}
    {/* The guest paints over this rectangle, so the empty state belongs to `idle` alone:
        during a load or after a failure it would contradict what the column just said. The
        viewer takes the rest of the column but keeps a floor, so a narrow column can never
        collapse it to nothing. */}
    <div
      ref={live.frame}
      role="region"
      aria-label="Superficie del live de TikTok"
      aria-busy={status.state === 'loading' || undefined}
      className="grid min-h-40 flex-1 place-items-center overflow-hidden rounded-lg border border-dashed border-border bg-muted p-4 text-center"
    >
      {status.state === 'idle' && <div>
        <p className="text-xs font-medium text-foreground">Ningún live conectado</p>
        <p className="text-xs text-muted-foreground">Al conectar, el live se abre en una superficie aislada, sin Node y con sandbox.</p>
      </div>}
    </div>
    {/* S6: the local ingestor health and its gap. Empty until R3 owns those readings,
        so the screen states the absence instead of inventing a measurement. */}
    <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
      <span>Ingestor: <strong className="font-semibold text-foreground">sin sesión</strong></span>
      <span>Brecha: <strong className="font-semibold text-foreground">—</strong></span>
    </div>
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

// --- Reparto ajustable de las tres columnas -------------------------------------------
// Session state only: the widths live while the panel is mounted and are never persisted.
// The three columns and the two rails always add up to the width that was measured, which
// is what keeps a resize from leaving a horizontal overflow or a column of no width.
const COLUMN_MIN = [340, 240, 260] as const
// The width below which the three columns cannot all keep their minimum and still fill the
// row. It is the sum of the minimums plus the two rails, and it is what decides between the
// split and the stacked layout (see `useColumnWidths`).
const MIN_TOTAL = COLUMN_MIN[0] + COLUMN_MIN[1] + COLUMN_MIN[2]
const SEPARATOR_WIDTH = 10
const KEY_STEP = 16
const KEY_STEP_LARGE = 48
const DEFAULT_WIDTHS: Widths = [556, 322, 386]
const NARROW_QUERY = '(max-width: 1100px)'
type Widths = [number, number, number]

// What shrinks when the workspace narrows is the slack above the three minimums, never the
// minimums themselves: fitting a column to 1 px left the tracks summing to the measured
// width while every number derived from them — the rails' ARIA, the keyboard step — was
// wrong. The proportions the operator chose are kept in the slack, so a split that was
// already fitted is returned unchanged.
function fitWidths(widths: Widths, budget: number): Widths {
  const total = widths[0] + widths[1] + widths[2]
  if (budget <= 0 || total <= 0) return widths
  // There is no honest three-column split below this width: it would have to break a
  // minimum or overflow the row sideways. The caller stacks instead.
  if (budget < MIN_TOTAL) return widths
  const slack = budget - MIN_TOTAL
  const extras: Widths = [
    Math.max(0, widths[0] - COLUMN_MIN[0]),
    Math.max(0, widths[1] - COLUMN_MIN[1]),
    Math.max(0, widths[2] - COLUMN_MIN[2]),
  ]
  const extraTotal = extras[0] + extras[1] + extras[2]
  // A set already sitting on its minimums has no proportion to keep, so the slack follows
  // the minimums themselves instead of dividing by zero.
  const share = extraTotal > 0 ? extras : [...COLUMN_MIN]
  const shareTotal = extraTotal > 0 ? extraTotal : MIN_TOTAL
  const fitted: Widths = [
    COLUMN_MIN[0] + Math.round(slack * share[0] / shareTotal),
    COLUMN_MIN[1] + Math.round(slack * share[1] / shareTotal),
    COLUMN_MIN[2] + Math.round(slack * share[2] / shareTotal),
  ]
  // Rounding is the only difference left. It lands on the column with the most room above
  // its minimum, which has at least one pixel of it whenever the residue is negative, so
  // the correction can never push a column under its minimum.
  const residue = budget - (fitted[0] + fitted[1] + fitted[2])
  if (residue !== 0) {
    let target: 0 | 1 | 2 = 0
    for (const index of [1, 2] as const) {
      if (fitted[index] - COLUMN_MIN[index] > fitted[target] - COLUMN_MIN[target]) target = index
    }
    fitted[target] += residue
  }
  return fitted
}

// Two neighbouring columns share one total: a separator only moves the line between them,
// so one gives exactly what the other takes and neither drops below its minimum.
function moveColumns(widths: Widths, index: 0 | 1, target: number): Widths {
  const pair = widths[index] + widths[index + 1]
  const lower = COLUMN_MIN[index]
  const upper = Math.max(lower, pair - COLUMN_MIN[index + 1])
  const next = Math.min(Math.max(Math.round(target), lower), upper)
  const moved: Widths = [...widths]
  moved[index] = next
  moved[index + 1] = Math.round(pair - next)
  return moved
}

function contentWidth(element: HTMLElement): number {
  const style = getComputedStyle(element)
  const padding = (['paddingLeft', 'paddingRight'] as const).reduce((total, key) => {
    const value = Number.parseFloat(style[key])
    return total + (Number.isFinite(value) ? value : 0)
  }, 0)
  const width = element.clientWidth - padding
  return Number.isFinite(width) && width > 0 ? width : 0
}

// The artboard's breakpoint, read from `matchMedia` instead of a CSS media query because
// the pixel widths are session state: below it the layout is one column and the separators
// have nothing to separate, so they leave the DOM instead of being drawn and hidden.
function useNarrowWorkspace(): boolean {
  const read = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(NARROW_QUERY).matches
    : false
  const [narrow, setNarrow] = useState(read)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(NARROW_QUERY)
    const update = (event: MediaQueryListEvent) => setNarrow(event.matches)
    setNarrow(query.matches)
    if (typeof query.addEventListener === 'function') query.addEventListener('change', update)
    else if (typeof query.addListener === 'function') query.addListener(update)
    return () => {
      if (typeof query.removeEventListener === 'function') query.removeEventListener('change', update)
      else if (typeof query.removeListener === 'function') query.removeListener(update)
    }
  }, [])
  return narrow
}

// The grid is measured once it exists and again whenever it changes size: the sidebar
// collapsing, the window resizing, the operator dragging a rail. jsdom reports no layout,
// so nothing happens there and the ARIA contract falls back to the default widths.
function useColumnWidths(narrow: boolean) {
  const grid = useRef<HTMLDivElement | null>(null)
  const [widths, setWidths] = useState<Widths>(DEFAULT_WIDTHS)
  // Whether the measured width can hold the three minimums and both rails. When it cannot,
  // the workspace stacks instead of drawing a split it cannot honour: the alternatives are a
  // column under its minimum or a row that scrolls sideways, and S14 rules out both. The
  // stacked layout is the one the artboard already uses below its breakpoint, so the same
  // screen simply arrives a little earlier (a window just above 1100 px with the sidebar
  // expanded is the only real case).
  const [fits, setFits] = useState(true)

  useEffect(() => {
    if (narrow) return
    const element = grid.current
    if (!element) return
    function measure() {
      const available = contentWidth(element as HTMLElement)
      if (available <= 0) return
      const next = available - SEPARATOR_WIDTH * 2
      if (next <= 0) return
      setFits(next >= MIN_TOTAL)
      setWidths(current => {
        const fitted = fitWidths(current, next)
        return fitted[0] === current[0] && fitted[1] === current[1] && fitted[2] === current[2] ? current : fitted
      })
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(element)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [narrow])

  return {
    grid,
    widths,
    fits,
    resize: (index: 0 | 1, target: number) => setWidths(current => moveColumns(current, index, target)),
  }
}

// The rail itself is the control, so it carries the window-splitter semantics: role,
// orientation, value and keyboard steps. No installed primitive splits a layout — the
// Separator primitive is a static divider — so it draws the line inside this rail and the
// rail owns the interaction. `aria-valuemin`/`aria-valuemax` are exactly the range the keys
// and the drag deliver (`moveColumns` clamps to the same pair), and the value always sits
// inside it, so a step is delivered in full until the bound rather than spent correcting a
// value that had drifted out of range.
function ColumnSeparator({ index, label, width, min, max, onResize }: {
  index: 0 | 1
  label: string
  width: number
  min: number
  max: number
  onResize: (index: 0 | 1, target: number) => void
}) {
  const rail = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{ x: number; width: number } | null>(null)

  return <div
    ref={rail}
    role="separator"
    tabIndex={0}
    aria-orientation="vertical"
    aria-label={label}
    aria-valuemin={min}
    aria-valuemax={Math.max(min, max)}
    aria-valuenow={width}
    aria-valuetext={`${width} píxeles`}
    title="Arrastrá o usá las flechas (16 px, Shift 48 px) para ajustar el ancho"
    className="group/separator relative flex w-2.5 touch-none cursor-col-resize items-center justify-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    onKeyDown={event => {
      const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onResize(index, width - step)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        onResize(index, width + step)
      }
    }}
    onPointerDown={event => {
      drag.current = { x: event.clientX, width }
      rail.current?.setPointerCapture?.(event.pointerId)
      event.preventDefault()
    }}
    onPointerMove={event => {
      const start = drag.current
      if (!start) return
      onResize(index, start.width + (event.clientX - start.x))
    }}
    onPointerUp={() => { drag.current = null }}
    onPointerCancel={() => { drag.current = null }}
  >
    <Separator orientation="vertical" aria-hidden="true" className="absolute inset-y-1 left-1/2 -translate-x-1/2" />
    <span aria-hidden="true" className="relative flex h-11 w-4 flex-col items-center justify-center gap-1 rounded-full border border-border bg-card text-muted-foreground group-hover/separator:bg-muted">
      <span className="size-0.5 rounded-full bg-current" />
      <span className="size-0.5 rounded-full bg-current" />
      <span className="size-0.5 rounded-full bg-current" />
    </span>
  </div>
}

function Workspace({ shopName, leadCount, narrow }: {
  shopName: string
  leadCount: number
  narrow: boolean
}) {
  const columns = useColumnWidths(narrow)
  // One column below the artboard breakpoint, and one column when the measured width cannot
  // hold all three minimums: the split would have to break a minimum or overflow the row, so
  // the workspace stacks at that size and returns to the split as soon as it fits again.
  const stacked = narrow || !columns.fits
  const template = `${columns.widths[0]}px ${SEPARATOR_WIDTH}px ${columns.widths[1]}px ${SEPARATOR_WIDTH}px minmax(0, 1fr)`

  return <main aria-labelledby="workspace-title" className="min-h-0 flex-1">
    <h1 id="workspace-title" className="sr-only">{`Panel de ${shopName}`}</h1>
    <div
      ref={columns.grid}
      data-slot="workspace"
      className={cn(
        'grid p-4',
        narrow ? 'grid-cols-1 gap-2.5 overflow-y-auto'
          // Stacked by measurement: the panel still owns a viewport-sized height, so the grid
          // is the scroller that keeps the stacked columns reachable.
          : stacked ? 'h-full min-h-0 grid-cols-1 gap-2.5 overflow-y-auto'
            : 'h-full min-h-0 items-stretch',
      )}
      style={stacked ? undefined : ({ gridTemplateColumns: template } as CSSProperties)}
    >
      <LiveColumn />
      {!stacked && <ColumnSeparator
        index={0}
        label="Ancho de la columna Live de TikTok"
        width={columns.widths[0]}
        min={COLUMN_MIN[0]}
        // The pair shares one total: the real ceiling is what the next column can give up
        // while keeping its own minimum, and ARIA must not promise more than the drag does.
        max={columns.widths[0] + columns.widths[1] - COLUMN_MIN[1]}
        onResize={columns.resize}
      />}
      <ProductsColumn />
      {!stacked && <ColumnSeparator
        index={1}
        label="Ancho de la columna Productos"
        width={columns.widths[1]}
        min={COLUMN_MIN[1]}
        max={columns.widths[1] + columns.widths[2] - COLUMN_MIN[2]}
        onResize={columns.resize}
      />}
      <LeadsColumn count={leadCount} />
    </div>
  </main>
}

export function Panel({ onEditStore }: { onEditStore: () => void }) {
  const stats = useQuery(dashboardFunctions.getDashboardStats)
  // Session-only chrome state: the rail, the theme and the column widths are remembered
  // while the panel is mounted, which is all the operator asked for.
  const [collapsed, setCollapsed] = useState(false)
  const { dark, toggle: toggleTheme } = useThemeToggle()
  const narrow = useNarrowWorkspace()
  if (stats === undefined) return <WaitingScreen label="Cargando tu panel" />
  // The dashboard query still carries `metrics`; the panel stopped painting them and only
  // reads the shop identity, the live connection and the leads it already had.
  const { liveConnection } = stats
  // S11: ending the commercial live is explicit, and it is only possible while a live
  // is connected. Closing the app stops the local runner, not the live.
  const canEndLive = liveConnection === 'connected'
  return <div className={cn(
    'grid bg-background text-foreground',
    collapsed ? 'grid-cols-[3.5rem_1fr]' : 'grid-cols-[13.75rem_1fr]',
    // The workspace is exactly the viewport when it is side by side: that is what gives
    // the live column a bounded height for its viewer. Stacked, the page scrolls instead.
    narrow ? 'min-h-svh' : 'h-svh overflow-hidden',
  )}>
    <Sidebar
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed(current => !current)}
      onOpenStore={onEditStore}
    />
    <div className="flex min-h-0 min-w-0 flex-col">
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
      <Workspace
        shopName={stats.shopName}
        leadCount={stats.lives.length}
        narrow={narrow}
      />
    </div>
  </div>
}