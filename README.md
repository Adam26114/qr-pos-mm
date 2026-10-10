# QR POS Myanmar

QR menu and counter POS service for cafes and restaurants, built with Next.js 16, React 19, Convex, Better Auth and Bun/Turborepo.

The first implemented slice provides owner email/password accounts, password recovery, one store per owner, and a fourteen-day trial with a protected Burmese/English workspace.

See [local setup and tests](docs/development.md), the [approved product specification](docs/product/spec.md), and the [implementation tickets](docs/product/implementation-plan.md).

Shared shadcn/ui components live in `packages/ui`; import them through `@workspace/ui/components/*`.
