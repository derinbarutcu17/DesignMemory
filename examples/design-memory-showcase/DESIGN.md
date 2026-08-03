# Design System: Design Memory Showcase

## 1. Color Palette & Roles

| Token | Class | Value |
| --- | --- | --- |
| color.primary | `bg-primary` | `#2563eb` |
| color.surface | `bg-surface` | `#ffffff` |
| color.text | `bg-text` | `#0f172a` |
| color.brand.blue | `bg-brand-blue` | `#2563eb` |
| button.background | `bg-background` | `color.primary` |

## 2. Spacing

| Token | Class | Value |
| --- | --- | --- |
| spacing.sm | `p-sm` | `8px` |
| spacing.md | `p-md` | `16px` |

## 3. Shape & Radius

| Token | Class | Value |
| --- | --- | --- |
| borderRadius.sm | `rounded-sm` | `4px` |
| borderRadius.lg | `rounded-lg` | `8px` |

## 4. Typography Rules

| Token | Class | Value |
| --- | --- | --- |
| fontSize.sm | `text-sm` | `14px` |
| fontSize.lg | `text-lg` | `18px` |

## 5. Tokens

| Token | Class | Value |
| --- | --- | --- |
| typography.body | `typography.body` | `{"fontFamily":"Inter","fontWeight":"400","fontSize":"14px","lineHeight":"20px"}` |

## 6. Components

### Button

Primary action button for forms and dialogs.

Must use: `bg-primary`, `px-4`, `py-2`

Disallowed: `style={{`

States: hover

Variants: primary, secondary
