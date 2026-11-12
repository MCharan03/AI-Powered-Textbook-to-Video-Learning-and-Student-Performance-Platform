# Admin UI Kit — Standardization Reference

This kit standardizes the Admin Portal (light SaaS theme). When restyling an admin page,
use these components and rules. **Never change a page's business logic, API calls, props,
props signature, or route IDs.** Only restyle/reorganize.

## Design tokens (CSS variables)

- Background: `var(--admin-bg)` (#F8FAFC) — page background only
- Cards/surfaces: `var(--admin-surface)` (#FFFFFF)
- Raised surface: `var(--admin-surface-raised)` (#F1F5F9)
- Border: `var(--admin-border)` (#E2E8F0)
- Text: `var(--admin-text)` (#0F172A), secondary: `var(--admin-text-secondary)` (#64748B)
- Primary: `var(--admin-primary)` (#2563EB), soft bg: `var(--admin-primary-soft)`
- Success: `var(--admin-success)` (#16A34A) soft `var(--admin-success-soft)`
- Warning: `var(--admin-warning)` (#D97706) soft `var(--admin-warning-soft)`
- Error: `var(--admin-error)` (#DC2626) soft `var(--admin-error-soft)`
- Radii: `var(--radius-sm)` 6px, `var(--radius-md)` 8px, `var(--radius-lg)` 10px
- Shadows: `var(--shadow-sm)`, `var(--shadow-md)`, `var(--shadow-lg)`

NO dark backgrounds, no gradients, no emojis in UI (use lucide-react icons), no excessive rounding.

## CSS utility classes (defined in `styles/globals.css`)

- Buttons: `adm-btn` + `adm-btn-primary | adm-btn-secondary | adm-btn-ghost | adm-btn-danger`, optional `adm-btn-sm`
- Inputs/select/textarea: `adm-input`, `adm-select`, `adm-textarea`; error variant `adm-input-error`
- Labels: `adm-label`, hint text `adm-help-text`, inline error `adm-field-error`
- Card: `adm-card`
- Badge: `adm-badge` (combine with token bg/color inline styles)
- Table: wrap table in `adm-table-wrapper`, table gets `adm-table` (styled headers/rows/hover)

## Components (`frontend/src/components/admin/`)

```tsx
import { PageHeader } from '../../components/admin/PageHeader';
<PageHeader title="Students" description="Manage student records…" actions={<button className="adm-btn adm-btn-primary">+ Add Student</button>} />

import { StatCard } from '../../components/admin/StatCard';        // props: label, value, icon (LucideIcon), hint, tone, loading, onClick
import { Modal } from '../../components/admin/Modal';               // props: open, onClose, title, subtitle?, children, footer?, maxWidth?
import { ConfirmDialog } from '../../components/admin/ConfirmDialog'; // props: open, title, message, confirmLabel?, danger?, loading?, onConfirm, onCancel
import { SearchBar } from '../../components/admin/SearchBar';       // props: value, onChange, onSubmit?, placeholder?
import { Pagination } from '../../components/admin/Pagination';     // props: page, totalPages, total, pageSize, onPageChange, onPageSizeChange?
import { EmptyState } from '../../components/admin/EmptyState';     // props: title?, description?, action?, icon?
import { LoadingState } from '../../components/admin/LoadingState'; // props: label?, rows?, variant? ('table'|'inline')
import { ErrorState } from '../../components/admin/ErrorState';     // props: message, onRetry?
import { MessageBanner } from '../../components/admin/MessageBanner'; // props: message: {text, type:'success'|'error'} | null, onDismiss?
import { FormField } from '../../components/admin/FormField';       // props: label, name?, type ('text'|'email'|'password'|'number'|'date'|'tel'|'select'|'textarea'), value, onChange(value:string), placeholder?, required?, disabled?, error?, helpText?, options? {value,label}[], style?
import { ActionMenu } from '../../components/admin/ActionMenu';     // props: items: {label, icon?, onClick, danger?, disabled?}[], ariaLabel?
import { WorkflowStepper } from '../../components/admin/WorkflowStepper'; // props: steps: string[], currentStep: number (0-based), compact?
```

Existing shared components were restyled for light theme and stay in use:

```tsx
import { SurfacePanel } from '../../components/SurfacePanel'; // card with optional title/actions
import { DataTable, Column } from '../../components/DataTable'; // light-themed table, onRowClick, emptyMessage
import { StatusBadge } from '../../components/StatusBadge';   // status pill, handles many statuses
```

## Standard page structure (every admin page)

1. `<PageHeader title=… description=… actions={primary action} />` at top.
2. `<MessageBanner message={…} onDismiss={…} />` if the page has feedback messages.
3. Key summary info (counts/stat cards) where meaningful.
4. Search/filter controls in a `SurfacePanel` (keep existing filter state and API query params).
5. Main table in a `SurfacePanel` via `DataTable`; loading → `<LoadingState />` inside panel; error → `<ErrorState />`; empty → `DataTable emptyMessage` or `<EmptyState />`.
6. `Pagination` under tables when the endpoint supports paging.
7. Modals: replace hand-rolled fixed-position overlays with `Modal` (form footer: Cancel `adm-btn-secondary`, Save `adm-btn-primary`).
8. Destructive actions: replace `window.confirm` with `ConfirmDialog` (danger). Keep the same underlying API call.
9. Row actions: prefer `ActionMenu` (kebab) when a row has 3+ actions; simple 1–2 inline buttons are fine.

## Table cell conventions

- Status columns use `StatusBadge`.
- Secondary/muted text: `color: var(--admin-text-secondary)`, 12px.
- Emphasis text: fontWeight 600, `var(--admin-text)`.
- Right-align numeric columns via `Column.align: 'right'`.
- Missing values render as `—`, never fabricated.

## Workflow presentation (textbook/AI pipeline)

- Textbook stage/status/next action should be visible: use `StatusBadge` for status, and where helpful `WorkflowStepper` with the pipeline steps:
  `['Upload Textbook','Extract Curriculum','Review & Approve','Video Plans','Scripts','Videos','Publish']`.
- Do not merge distinct review gates (textbook review, video plans, scripts, videos, quizzes) into one screen — they stay in their existing routes.
- Never let unapproved content appear available to students; approval buttons/gates stay exactly as they are.

## Icons

Use `lucide-react`. Common choices: GraduationCap (students), Users (parents), Presentation (teachers), UserCog (users), LibraryBig (subjects), BookOpen (chapters), ListTree (topics), List (subtopics), BookText (textbooks), Clapperboard (video studio), Film (video plans), ScrollText (scripts), MonitorPlay (video review), FileQuestion (quizzes), Activity (pipeline), Network (hierarchy), ShieldCheck (review), Settings, Upload, Plus, Search, RefreshCw, Trash2, Pencil, Eye, X, Check, ChevronRight/Left, AlertTriangle, MoreVertical, PlayCircle, Sparkles.
