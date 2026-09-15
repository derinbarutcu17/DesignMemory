# Design System: Northwind Procurement Console

## 1. Color Palette & Roles

| Token | Class | Value |
| --- | --- | --- |
| color.primary | `bg-primary` | `#1d4ed8` |
| color.success | `text-success` | `#15803d` |
| color.warning | `text-warning` | `#b45309` |
| color.danger | `text-danger` | `#b91c1c` |
| color.surface | `bg-surface` | `#ffffff` |
| color.surfaceRaised | `bg-surface-raised` | `#f8fafc` |
| color.border | `border-border` | `#e2e8f0` |
| color.text | `text-text` | `#0f172a` |
| color.textMuted | `text-text-muted` | `#64748b` |

## 2. Spacing

| Token | Class | Value |
| --- | --- | --- |
| spacing.1 | `p-1` | `4px` |
| spacing.2 | `p-2` | `8px` |
| spacing.3 | `p-3` | `12px` |
| spacing.4 | `p-4` | `16px` |
| spacing.6 | `p-6` | `24px` |
| spacing.8 | `p-8` | `32px` |

## 3. Shape & Radius

| Token | Class | Value |
| --- | --- | --- |
| borderRadius.sm | `rounded-sm` | `6px` |
| borderRadius.md | `rounded-md` | `10px` |
| borderRadius.lg | `rounded-lg` | `14px` |
| borderRadius.full | `rounded-full` | `9999px` |

## 4. Typography Rules

| Token | Class | Value |
| --- | --- | --- |
| fontSize.xs | `text-xs` | `12px` |
| fontSize.sm | `text-sm` | `14px` |
| fontSize.base | `text-base` | `15px` |
| fontSize.lg | `text-lg` | `18px` |
| fontSize.xl | `text-xl` | `22px` |
| fontSize.2xl | `text-2xl` | `28px` |

## 5. Components

### DataTable

Dense data table for supplier and contract lists.

Must use: `border-border`, `text-sm`, `hover:bg-surface-raised`

Disallowed: `style={{`

States: hover

### StatusBadge

Small pill label for contract and risk states.

Must use: `rounded-full`, `text-xs`, `border`

Disallowed: `style={{`

Variants: primary, success, warning, danger, info, neutral

### StatCard

KPI summary card with trend sparkline.

Must use: `rounded-lg`, `bg-surface`, `border-border`, `shadow-card`

Disallowed: `style={{`, `bg-[`

States: hover

### AlertBanner

Inline notice for spend, contract, and risk alerts.

Must use: `rounded-md`, `border`, `text-sm`

Disallowed: `style={{`

### Drawer

Right-side detail panel for contracts and suppliers.

Must use: `rounded-lg`, `bg-surface`, `shadow-overlay`

Disallowed: `style={{`

States: focus

### ChartFrame

Wrapper for token-driven SVG charts.

Must use: `border-border`, `rounded-lg`, `bg-surface`

Disallowed: `style={{`, `fill="`
