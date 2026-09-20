# RevMate UI Guidelines

Rules for how UI gets built in this repo, so screens stay consistent as more
of them get added. Read this before adding a new page or component.

## Design tokens

Never hardcode colors, spacing scales, or radii — use the semantic Tailwind
classes mapped from `src/styles.css`, so dark mode (already defined via the
`.dark` class, not yet wired to a toggle) works for free once it's turned on.

| Use | Class |
| --- | --- |
| Page background | `bg-background` |
| Card / panel background | `bg-card` |
| Primary text | `text-foreground` |
| Secondary/meta text | `text-muted-foreground` |
| Borders / dividers | `border-border` |
| Primary action | `bg-primary text-primary-foreground` |
| Subtle hover surface | `hover:bg-accent hover:text-accent-foreground` |
| Destructive action | `bg-destructive text-destructive-foreground` |

Radii: `rounded-md` for buttons/inputs/small cards, `rounded-lg` for post
cards and larger panels, `rounded-full` for avatars and pill badges.

## Layout

- Base text size is `text-sm`. Page titles are `text-2xl font-semibold
  tracking-tight`; section headings are `text-lg font-semibold`.
- Icons from `lucide-react` at `size-4` inline with text, `size-5` in nav
  items. Always pair an icon-only button with a `title` attribute at minimum
  (see Tooltips below).
- Sidebar-driven pages (currently just `/`) follow the pattern in
  `src/routes/index.tsx`: an edge-to-edge flex row (`<div className="flex">`),
  `<Sidebar />` pinned to the true left edge, and the page content in its own
  `mx-auto max-w-*` wrapper *inside* `<main>` so content stays centered
  without dragging the sidebar away from the window edge.
- Simple standalone pages (forms, detail pages) use `mx-auto max-w-xl` or
  `max-w-5xl` directly, per `src/routes/ask.tsx` / `src/routes/cars/index.tsx`.

## Auth gating

RevMate is browse-first: nobody hits a login wall for reading car pages,
questions, or posts. An account is only required to *write* something (post,
comment, like, ask a question, list something). Don't hide the input behind
a "log in to..." message — show the real control and gate the action itself:

```tsx
const { user } = useAuth();
const { open: openAuthModal } = useAuthModal();

// on the input itself, so it fires before they've typed anything:
onFocus={() => !user && openAuthModal("Create a free account to comment.")}

// and again on submit, in case focus was never triggered (paste, autofill):
if (!user) {
  openAuthModal("Create a free account to comment.");
  return;
}
```

`useAuthModal` (`src/hooks/useAuthModal.tsx`) and `<AuthPromptModal />`
(`src/components/AuthPromptModal.tsx`) are already wired into the root layout
— call `openAuthModal(reason)` from anywhere, don't build another modal.

## Tooltips — first port of call for icon-only controls

Any control that is icon-only (no visible text label) must have a tooltip,
not just a bare `title` attribute, once there's more than one on a screen —
`title` alone is invisible on touch and inconsistent across browsers. Use
the existing shadcn primitive at `src/components/ui/tooltip.tsx`:

```tsx
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <button onClick={toggle}>{collapsed ? <PanelLeft /> : <PanelLeftClose />}</button>
    </TooltipTrigger>
    <TooltipContent>{collapsed ? "Expand sidebar" : "Collapse sidebar"}</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

A single `<TooltipProvider>` should wrap the app once `useAuthModal` mounts
this many icon buttons app-wide (`__root.tsx` is the place) rather than one
per component. Retrofit `Sidebar.tsx`'s collapse button and any other
icon-only button (like/comment/share icons in `PostCard.tsx`, once they lose
their adjacent count label) to use this instead of relying on `title` alone.

## Loading states — skeleton loaders, not "Loading…" text

Any list or card that fetches data must render a skeleton shaped like the
real content while loading, not a plain text line. Use
`src/components/ui/skeleton.tsx`:

```tsx
{isLoading && (
  <div className="space-y-4">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-1.5 h-4 w-2/3" />
      </div>
    ))}
  </div>
)}
```

Known spots still using plain "Loading…" text that should move to a skeleton
next: the feed in `src/routes/index.tsx`, and the cars list in
`src/routes/cars/index.tsx`.

## Empty states

Match the existing pattern: `rounded-lg border border-dashed border-border
p-8 text-center text-sm text-muted-foreground`, one sentence, no icon needed
unless it clarifies the action to take.

## Forms

Plain HTML inputs styled with `rounded-md border border-input bg-background
px-3 py-2 text-sm` — this repo deliberately doesn't reach for the shadcn
`<Input>`/`<Textarea>` wrappers for simple forms yet, so match the existing
inline style rather than mixing both. Wrap label + control in the `Field`
pattern from `src/routes/ask.tsx` if the form has more than one input.
