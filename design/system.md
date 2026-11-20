# Livefy design system

Captured from the repository on 2026-11-20. Read-only sync: no project source was edited.

## Sources

| Source | Role |
| --- | --- |
| `apps/desktop/src/styles.css` | The only token source. Tailwind v4 CSS entry with `@theme inline`, `:root` (light), `.dark` (dark), and two `@layer` blocks. |
| `apps/desktop/components.json` | Declares `"css": "src/styles.css"` and `"config": ""` (Tailwind v4, no separate config file). `style: base-nova`, `baseColor: neutral`, `cssVariables: true`. |
| `apps/desktop/src/components/ui/*.tsx` | Installed primitives: `alert`, `button`, `card`, `field`, `input`, `label`, `separator`. Their class lists are the geometry recorded under "Component rules". |
| `apps/desktop/src/components/visual-shell.tsx` + the `.visual-shell` / `.provider-surface` / `.visual-mark` / `.visual-content` rules in `styles.css` | The shared shell the loading state lives in. |
| `odd/tasks/mvp-theme-issue-14.md` | Records the theme origin: tweakcn "Claude green" registry theme, and the decision that Geist Variable is the locally loaded font. |
| `.pi/skills/shadcn/SKILL.md`, `.pi/skills/shadcn/rules/composition.md` | The project premise that every surface is built from official shadcn/ui items, and the loading rules: `Skeleton` for placeholders, no custom `animate-pulse` divs, `Button` + `Spinner` + `disabled` for pending actions, and `Progress` for measured progress. |

Verified counts with a script over `apps/desktop/src/styles.css`: **53 light tokens** in `:root`, **52 dark tokens** in `.dark` (only `--tracking-normal` is absent from `.dark`), and **66 entries** in the `@theme inline` bridge. Every value below is copied verbatim from that file; nothing is invented, converted, or rounded.

## Colors — light (`:root`)

| Token | Value | Usage |
| --- | --- | --- |
| `--background` | `oklch(1.0000 0 0)` | Page background; `body` via `bg-background`. |
| `--foreground` | `oklch(0.2850 0 0)` | Default text on background; `ring-foreground/10` on cards. |
| `--card` | `oklch(1.0000 0 0)` | Card surface. |
| `--card-foreground` | `oklch(0.2850 0 0)` | Text inside a card. |
| `--popover` | `oklch(1.0000 0 0)` | Popover surface. |
| `--popover-foreground` | `oklch(0.2850 0 0)` | Popover text. |
| `--primary` | `oklch(0.9347 0.1825 120.5229)` | Brand lime: brand mark fill, default button fill. |
| `--primary-foreground` | `oklch(0 0 0)` | Content on primary: the black `L` and button labels. |
| `--secondary` | `oklch(0.9692 0.0121 96.4218)` | Secondary button fill. |
| `--secondary-foreground` | `oklch(0.2850 0 0)` | Secondary button label. |
| `--muted` | `oklch(0.9845 0.0026 106.4477)` | Shell background (`.visual-shell`), muted fills. |
| `--muted-foreground` | `oklch(0.5103 0 0)` | Body copy under a card title, alert descriptions. |
| `--accent` | `oklch(0.9353 0.1021 109.4248)` | Accent fill (hover/selected surfaces). |
| `--accent-foreground` | `oklch(0.2994 0.0327 118.0959)` | Text on accent. |
| `--destructive` | `oklch(0.5771 0.2152 27.3250)` | Destructive text and destructive alert copy. |
| `--border` | `oklch(0.9269 0.0160 110.5685)` | Default border, alert border, separator fill. |
| `--input` | `oklch(0.9448 0.0134 115.8392)` | Input border. |
| `--ring` | `oklch(0.9347 0.1825 120.5229)` | Focus ring (`ring-3 ring-ring/50`). |
| `--chart-1` | `oklch(0 0 0)` | Chart series 1. |
| `--chart-2` | `oklch(0.9347 0.1825 120.5229)` | Chart series 2. |
| `--chart-3` | `oklch(0.6959 0.1491 162.4796)` | Chart series 3. |
| `--chart-4` | `oklch(0.6962 0.1306 112.3662)` | Chart series 4. |
| `--chart-5` | `oklch(0.5103 0 0)` | Chart series 5. |
| `--sidebar` | `oklch(0.9845 0.0026 106.4477)` | Sidebar surface. |
| `--sidebar-foreground` | `oklch(0.2850 0 0)` | Sidebar text. |
| `--sidebar-primary` | `oklch(0 0 0)` | Sidebar primary action fill. |
| `--sidebar-primary-foreground` | `oklch(1.0000 0 0)` | Sidebar primary action label. |
| `--sidebar-accent` | `oklch(0.9353 0.1021 109.4248)` | Sidebar active item fill. |
| `--sidebar-accent-foreground` | `oklch(0.2994 0.0327 118.0959)` | Sidebar active item text. |
| `--sidebar-border` | `oklch(0.9269 0.0160 110.5685)` | Sidebar border. |
| `--sidebar-ring` | `oklch(0.9347 0.1825 120.5229)` | Sidebar focus ring. |
| `--destructive-foreground` | `oklch(1.0000 0 0)` | Text on destructive fill. |

## Colors — dark (`.dark`)

Dark activates through the `.dark` class on an ancestor. There is no persisted selector and no automatic system following (`odd/tasks/mvp-theme-issue-14.md`, `apps/desktop/README.md`).

| Token | Value | Usage |
| --- | --- | --- |
| `--background` | `oklch(0.2679 0.0036 106.6427)` | Page background. |
| `--foreground` | `oklch(0.9576 0.0027 106.4494)` | Default text on background. |
| `--card` | `oklch(0.2928 0.0018 106.5092)` | Card surface. |
| `--card-foreground` | `oklch(0.9818 0.0054 95.0986)` | Text inside a card. |
| `--popover` | `oklch(0.3085 0.0035 106.6039)` | Popover surface. |
| `--popover-foreground` | `oklch(0.9211 0.0040 106.4781)` | Popover text. |
| `--primary` | `oklch(0.9347 0.1825 120.5229)` | Brand lime (unchanged between themes). |
| `--primary-foreground` | `oklch(0.1913 0 0)` | Content on primary. |
| `--secondary` | `oklch(0.9818 0.0054 95.0986)` | Secondary button fill. |
| `--secondary-foreground` | `oklch(0.3085 0.0035 106.6039)` | Secondary button label. |
| `--muted` | `oklch(0.2213 0.0038 106.7070)` | Shell background, muted fills. |
| `--muted-foreground` | `oklch(0.7713 0.0169 99.0657)` | Body copy under a card title, alert descriptions. |
| `--accent` | `oklch(0.2130 0.0078 95.4245)` | Accent fill. |
| `--accent-foreground` | `oklch(0.9663 0.0080 98.8792)` | Text on accent. |
| `--destructive` | `oklch(0.6368 0.2078 25.3313)` | Destructive text, destructive alert copy. |
| `--border` | `oklch(0.3618 0.0101 106.8928)` | Border, alert border, separator fill. |
| `--input` | `oklch(0.4336 0.0113 100.2195)` | Input border. |
| `--ring` | `oklch(0.9347 0.1825 120.5229)` | Focus ring. |
| `--chart-1` | `oklch(0.9347 0.1825 120.5229)` | Chart series 1. |
| `--chart-2` | `oklch(0.6959 0.1491 162.4796)` | Chart series 2. |
| `--chart-3` | `oklch(0.8734 0.1029 210.3009)` | Chart series 3. |
| `--chart-4` | `oklch(0.6962 0.1306 112.3662)` | Chart series 4. |
| `--chart-5` | `oklch(0.8699 0 0)` | Chart series 5. |
| `--sidebar` | `oklch(0.2357 0.0024 67.7077)` | Sidebar surface. |
| `--sidebar-foreground` | `oklch(0.8074 0.0142 93.0137)` | Sidebar text. |
| `--sidebar-primary` | `oklch(0.9347 0.1825 120.5229)` | Sidebar primary action fill. |
| `--sidebar-primary-foreground` | `oklch(0 0 0)` | Sidebar primary action label. |
| `--sidebar-accent` | `oklch(0.1680 0.0020 106.6177)` | Sidebar active item fill. |
| `--sidebar-accent-foreground` | `oklch(0.8074 0.0142 93.0137)` | Sidebar active item text. |
| `--sidebar-border` | `oklch(0.9401 0 0)` | Sidebar border. |
| `--sidebar-ring` | `oklch(0.7731 0 0)` | Sidebar focus ring. |
| `--destructive-foreground` | `oklch(1.0000 0 0)` | Text on destructive fill. |

## Typography

| Token | Value | Usage |
| --- | --- | --- |
| `--font-sans` | `Asta Sans, ui-sans-serif, sans-serif, system-ui` | Registry value. Declared, but no Asta Sans asset is loaded. |
| `--font-heading` | `var(--font-sans)` | `font-heading` utility, used by `CardTitle`. |
| `--font-serif` | `Georgia, serif` | Declared only; not used by the shell. |
| `--font-mono` | `JetBrains Mono, monospace` | Declared only; no JetBrains Mono asset is loaded. |
| `--tracking-normal` | `0em` | `body { letter-spacing }`. The only token present in `:root` and absent from `.dark`. |
| `--letter-spacing` | `0em` | Bridged to `--letter-spacing` utility names. |

Effective font in `@layer base` (`html`): `'Geist Variable', ui-sans-serif, sans-serif, system-ui`, loaded locally through `@fontsource-variable/geist`. That rule is the real font in use; the `--font-sans` token is the registry declaration. No remote font request exists in the project.

Type sizes in use come from the primitives, not from tokens: `CardTitle` is `text-base` (1rem) with `leading-snug` and `font-medium`; card and alert text is `text-sm` (0.875rem); `.visual-content p` is `0.875rem/1.6` in `--muted-foreground`; the brand mark glyph is `1.25rem` at `font-weight: 700`.

## Spacing

| Token | Value | Usage |
| --- | --- | --- |
| `--spacing` | `0.25rem` | The single spacing unit. `spacing(1)` = 0.25rem, `gap-3.5` = 0.875rem, `spacing(4)` = 1rem, `gap-5` = 1.25rem. |

Shell and card spacing, read from `styles.css` and the primitive class lists: `.visual-shell` padding `clamp(1rem, 4vw, 3rem)`; `.provider-surface` gap `1.25rem`, `max-width: 30rem`; card `--card-spacing` = `spacing(4)` = 1rem vertical padding and horizontal padding; card header gap `1rem` with `flex-row gap-3.5` in the shell; `.visual-content` gap `1.25rem`.

## Radius

| Token | Value | Usage |
| --- | --- | --- |
| `--radius` | `1rem` | Base radius; identical in both themes. |
| `--radius-sm` | `calc(var(--radius) * 0.6)` | = 0.6rem. **The brand mark radius.** |
| `--radius-md` | `calc(var(--radius) * 0.8)` | = 0.8rem. |
| `--radius-lg` | `var(--radius)` | = 1rem. `rounded-lg` on Button, Alert and Input. |
| `--radius-xl` | `calc(var(--radius) * 1.4)` | = 1.4rem. `rounded-xl` on Card. |
| `--radius-2xl` | `calc(var(--radius) * 1.8)` | = 1.8rem. |
| `--radius-3xl` | `calc(var(--radius) * 2.2)` | = 2.2rem. |
| `--radius-4xl` | `calc(var(--radius) * 2.6)` | = 2.6rem. |

## Shadows

Light values from `:root`, dark values from `.dark`.

| Token | Value | Usage |
| --- | --- | --- |
| `--shadow-color` | `hsl(0 0% 0% / 0.08)` / dark `hsl(0 0% 0% / 0.3)` | Shadow tint. |
| `--shadow-opacity` | `0.12` / dark `0.24` | Shadow opacity setting. |
| `--shadow-blur` | `20px` / dark `28px` | Shadow blur setting. |
| `--shadow-spread` | `0px` / dark `0px` | Shadow spread setting. |
| `--shadow-offset-x` | `0px` / dark `0px` | Shadow x offset. |
| `--shadow-offset-y` | `8px` / dark `10px` | Shadow y offset. |
| `--shadow-2xs` | `0px 8px 20px 0px hsl(0 0% 0% / 0.06)` / dark `0px 10px 28px 0px hsl(0 0% 0% / 0.12)` | Smallest shadow step. |
| `--shadow-xs` | `0px 8px 20px 0px hsl(0 0% 0% / 0.06)` / dark `0px 10px 28px 0px hsl(0 0% 0% / 0.12)` | Same value as `2xs`. |
| `--shadow-sm` | `0px 8px 20px 0px hsl(0 0% 0% / 0.12), 0px 1px 2px -1px hsl(0 0% 0% / 0.12)` / dark `0px 10px 28px 0px hsl(0 0% 0% / 0.24), 0px 1px 2px -1px hsl(0 0% 0% / 0.24)` | Small shadow. |
| `--shadow` | `0px 8px 20px 0px hsl(0 0% 0% / 0.12), 0px 1px 2px -1px hsl(0 0% 0% / 0.12)` / dark `0px 10px 28px 0px hsl(0 0% 0% / 0.24), 0px 1px 2px -1px hsl(0 0% 0% / 0.24)` | Default shadow. |
| `--shadow-md` | `0px 8px 20px 0px hsl(0 0% 0% / 0.12), 0px 2px 4px -1px hsl(0 0% 0% / 0.12)` / dark `0px 10px 28px 0px hsl(0 0% 0% / 0.24), 0px 2px 4px -1px hsl(0 0% 0% / 0.24)` | Medium shadow. |
| `--shadow-lg` | `0px 8px 20px 0px hsl(0 0% 0% / 0.12), 0px 4px 6px -1px hsl(0 0% 0% / 0.12)` / dark `0px 10px 28px 0px hsl(0 0% 0% / 0.24), 0px 4px 6px -1px hsl(0 0% 0% / 0.24)` | Large shadow. |
| `--shadow-xl` | `0px 8px 20px 0px hsl(0 0% 0% / 0.12), 0px 8px 10px -1px hsl(0 0% 0% / 0.12)` / dark `0px 10px 28px 0px hsl(0 0% 0% / 0.24), 0px 8px 10px -1px hsl(0 0% 0% / 0.24)` | Extra-large shadow. |
| `--shadow-2xl` | `0px 8px 20px 0px hsl(0 0% 0% / 0.30)` / dark `0px 10px 28px 0px hsl(0 0% 0% / 0.60)` | Largest shadow. |

No shared-shell rule in `styles.css` currently applies a shadow token; the card boundary is `ring-1 ring-foreground/10` (`apps/desktop/src/components/ui/card.tsx`).

## Tailwind bridge (`@theme inline`)

The bridge maps utility names onto the semantic tokens; it adds no new colors.

- `--color-*` → `var(--*)` for `background`, `foreground`, `card`, `card-foreground`, `popover`, `popover-foreground`, `primary`, `primary-foreground`, `secondary`, `secondary-foreground`, `muted`, `muted-foreground`, `accent`, `accent-foreground`, `destructive`, `destructive-foreground`, `border`, `input`, `ring`, `chart-1…5`, `sidebar`, `sidebar-foreground`, `sidebar-primary`, `sidebar-primary-foreground`, `sidebar-accent`, `sidebar-accent-foreground`, `sidebar-border`, `sidebar-ring`, `shadow-color`.
- `--font-heading` → `var(--font-sans)`; `--font-sans`, `--font-serif`, `--font-mono` and `--radius` are restated with literal values.
- Radius utilities as listed under "Radius"; `--tracking-tighter/tight/wide/wider/widest` computed from `--tracking-normal`; the `--shadow-*`, `--spacing` and `--letter-spacing` names are passed through to their `:root` tokens.

## Component rules

| Component | Rules recorded from source | Source path |
| --- | --- | --- |
| Shared shell | `main.visual-shell`: flex, `min-height: 100svh`, centred, padding `clamp(1rem, 4vw, 3rem)`, background `var(--muted)`. `body` has `min-width: 20rem` (= 320px only at a 16px root). | `apps/desktop/src/styles.css`, `apps/desktop/src/components/visual-shell.tsx` |
| Card | `flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/10`, `--card-spacing: --spacing(4)`. Shell usage adds `w-full max-w-[30rem] wrap-anywhere`. Card radius is `rounded-xl` = 1.4rem. | `apps/desktop/src/components/ui/card.tsx`, `apps/desktop/src/components/visual-shell.tsx` |
| Card header / title / content | Header: `grid auto-rows-min items-start gap-1 px-(--card-spacing)`, composed in the shell as `flex flex-row items-center gap-3.5`. Title: `font-heading text-base leading-snug font-medium`, wrapping an `h1`. Content: `px-(--card-spacing)` inside `.visual-content` (column, `gap: 1.25rem`). | `apps/desktop/src/components/ui/card.tsx` |
| Brand mark | `.visual-mark`: `display:grid; place-items:center; width:2.75rem; height:2.75rem; border-radius: calc(var(--radius) * 0.6)` (= 0.6rem); `background: var(--primary)`; `color: var(--primary-foreground)`; `font-size: 1.25rem`; `font-weight: 700`; `aria-hidden="true"`; the glyph is the letter `L`. Never re-shape or re-size it. | `apps/desktop/src/styles.css`, `apps/desktop/src/components/visual-shell.tsx` |
| Provider surface | `.provider-surface`: column, `gap: 1.25rem`, `max-width: 30rem`, `overflow-wrap: anywhere`, `font-family: 'Geist Variable', …`. Used when a provider owns its own card; same mark + `h1` header. | `apps/desktop/src/styles.css` |
| Status and errors | Statuses inside the shell use `Alert` with `role="status"` (polite); errors use the destructive Alert with `role="alert"`. Alert: `grid gap-0.5 rounded-lg border px-2.5 py-2 text-sm bg-card text-card-foreground`; description `text-sm text-muted-foreground`; destructive variant puts description text in `text-destructive/90`. | `apps/desktop/src/components/ui/alert.tsx` |
| Button | `inline-flex items-center justify-center rounded-lg text-sm font-medium` + default size `h-8 px-2.5 gap-1.5`; `size: sm` `h-7`, `lg` `h-9`, `icon` `size-8`. Variants: `default` (`bg-primary text-primary-foreground hover:bg-primary/80`), `outline`, `secondary`, `ghost`, `destructive`, `link`. Focus is primitive-owned: `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`; disabled is `pointer-events-none opacity-50`. | `apps/desktop/src/components/ui/button.tsx` |
| Input | `h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base md:text-sm`, `dark:bg-input/30`, `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`, `aria-invalid:border-destructive`. | `apps/desktop/src/components/ui/input.tsx` |
| Field / Label | Field group `flex flex-col gap-2`; label `text-sm leading-none font-medium`; description `text-sm leading-normal text-muted-foreground`; error `text-sm text-destructive` with `role="alert"`. | `apps/desktop/src/components/ui/field.tsx`, `apps/desktop/src/components/ui/label.tsx` |
| Separator | `shrink-0 bg-border`, horizontal `h-px w-full`, vertical `w-px self-stretch`. | `apps/desktop/src/components/ui/separator.tsx` |
| Focus | The project adds `:focus-visible` only to ordinary links without `data-slot` (`outline: 2px solid var(--foreground); outline-offset: 3px; box-shadow: 0 0 0 3px var(--ring)`). It never overrides primitive focus. | `apps/desktop/src/styles.css` |
| Motion | The existing `.brand-loader` / `.brand-dots` cues animate regardless of `prefers-reduced-motion` by explicit owner decision; the accessible state is announced out of band, never by the animation. | `apps/desktop/src/styles.css` |

## Loading indication rule

- A loading state is expressed with an official registry item: `spinner` (indeterminate wait), `skeleton` (reserved content shape), `progress` (measured progress), or `button` + `spinner` + `disabled` + `data-icon` (a pending action). Never a bespoke loader: no pulsing brand mark, no hand-animated dots, no hand-styled shimmer. Sources: `.pi/skills/shadcn/SKILL.md` ("Use `Skeleton` for loading placeholders. No custom `animate-pulse` divs.", "Button has no `isPending`/`isLoading`. Compose with `Spinner` + `data-icon` + `disabled`.") and `.pi/skills/shadcn/rules/composition.md`.
- Installed today: `alert`, `button`, `card`, `field`, `input`, `label`, `separator` (`apps/desktop/src/components/ui`). `spinner`, `skeleton` and `progress` are **not installed**; a direction that needs one names it explicitly instead of drawing a substitute mechanism.
- Primitive colours are not restyled (`--primary` on a card is 1.17:1 in light), so a loading direction is judged on the contrast its primitive already has, not on a colour override. Measured: spinner glyph as `currentColor` on `--card` 14.35:1 light / 12.36:1 dark; `--muted` skeleton block on `--card` 1.05:1 / 1.23:1 (`--accent` 1.19:1 / 1.26:1); `--primary` progress indicator on a `--primary/20` track 1.14:1 / 3.74:1.

## Measured contrast (WCAG 2.x ratios)

Computed from the token values above with the OKLCH → linear sRGB → relative-luminance formula in a throwaway script. Text pairs need 4.5:1; non-text boundaries need 3:1.

| Pair | Light | Dark |
| --- | --- | --- |
| `--foreground` on `--background` | 14.35 | 13.40 |
| `--foreground` on `--card` | 14.35 | 12.36 |
| `--card-foreground` on `--card` | 14.35 | 13.27 |
| `--muted-foreground` on `--card` | 5.74 | 6.79 |
| `--muted-foreground` on `--muted` | 5.49 | 8.38 |
| `--primary-foreground` on `--primary` | 17.91 | 15.71 |
| `--primary` on `--card` | **1.17** | 11.92 |
| `--primary` on `--background` | **1.17** | 12.93 |
| `--destructive` on `--card` | 4.83 | 3.71 |
| `--border` on `--card` | 1.24 | 1.30 |
| `--input` on `--card` | 1.17 | 1.75 |
| `--ring` on `--card` | 1.17 | 11.92 |

Design consequence, used by every loading direction: **the lime `--primary` cannot carry information alone on a light card (1.17:1)**. Lime motion is always paired with a `--foreground` element (14.35:1 light, 12.36:1 dark) or drawn as a fill inside a `--foreground` boundary, exactly as the brand mark pairs lime with a black `L` (17.91:1 light, 15.71:1 dark). `--muted-foreground`, `--border`, `--input` and `--muted` are surface tints, not state carriers.

## Known gaps

- `--font-sans` names Asta Sans and `--font-mono` names JetBrains Mono, but no assets for them are loaded; the effective font is Geist Variable, loaded locally (`apps/desktop/src/styles.css`, `apps/desktop/README.md`). A self-contained artboard cannot reference that local file, so `design/system.html` and the artboards use the project's declared fallback chain `'Geist Variable', ui-sans-serif, sans-serif, system-ui` and will render with the system UI font. No remote font request is made anywhere.
- There is no persisted theme choice and no automatic system following; `.dark` on an ancestor is the only switch.
- The repository has no token file besides `apps/desktop/src/styles.css`; charts and sidebar tokens are declared but no shell screen currently consumes them.