# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
pnpm dev          # start dev server
pnpm build        # production build
pnpm lint         # eslint
pnpm test         # run tests (Node built-in test runner, no Jest/Vitest)
```

Tests live in `lib/**/*.test.ts` and run with `node --experimental-strip-types --test`. There is no test framework — use the built-in `node:test` and `node:assert` modules.

Schema changes require:
```bash
pnpm prisma migrate dev   # create + apply migration
pnpm prisma generate      # regenerate client after schema changes
```

## Stack

- **Next.js 16.2.2** (App Router) — read `node_modules/next/dist/docs/` before writing any Next.js code; this version has breaking changes
- **React 19** with TypeScript
- **Prisma 7** — uses the `PrismaPg` driver adapter; the `datasource` block has no `url` field, connection comes from env at runtime via `new PrismaPg({ connectionString: process.env.DATABASE_URL })`
- **better-auth** for session management
- **Base UI** (`@base-ui/react`) — UI primitives; components in `components/ui/` wrap Base UI, not Radix
- **Tailwind CSS v4**
- **pnpm** as package manager

## Architecture

### Route layout

```
app/
  (auth)/         # login, setup — no sidebar
  (dashboard)/    # main app — sidebar layout, requires session
    dashboard/    # home page
    contacts/     # list, new, [id] detail + edit
    events/
    settings/
  api/            # REST routes
```

### Auth pattern

- **Server Components**: call `requireSession()` from `lib/session.ts` — redirects to `/login` if unauthenticated
- **API Routes**: call `requireApiSession()` from `lib/api-auth.ts` — returns `{ error }` to return early, or `{ session }`

### Database

`lib/db.ts` exports a singleton `prisma` client. Import it as `import { prisma } from "@/lib/db"`.

### Notifications

`lib/notifications/notify.ts` runs the daily digest (Telegram + email). Triggered by a cron route or external scheduler.

## Key gotchas

**Prisma 7**: The driver adapter pattern means `PrismaPg` must be passed to `PrismaClient({ adapter })`. Do not use the old `datasource url` field or `DATABASE_URL` directly in schema.

**Button `render` prop**: `<Button render={<Link href="..." />}>` — Base UI uses a `render` prop for polymorphic rendering, not `asChild`.

**Shadcn CLI**: Components are added via `pnpm shadcn add <component>` but the underlying primitives come from `@base-ui/react`, not Radix. The component API may differ from shadcn docs.

**Birthday storage**: Stored as three separate nullable int fields (`birthdayDay`, `birthdayMonth`, `birthdayYear`) to support partial dates (e.g. month+day without year).

**Settings singleton**: The `Settings` table always has exactly one row with `id = "singleton"`.
