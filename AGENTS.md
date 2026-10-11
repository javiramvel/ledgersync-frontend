# AI Agent Instructions for Treasury Dashboard

## Role & Project Context
You are a senior frontend architect building an enterprise-grade, SEC-compliant Corporate Treasury Dashboard for tokenized securities. 
The stack is Next.js 14+ (App Router), React 19 (React Compiler enabled), TypeScript, and Tailwind CSS.

## Strict Next.js App Router Rules
- **NEVER** use the old Pages router (no `getServerSideProps`, `getStaticProps`, or `pages/` directory).
- Default to **Server Components** for all data fetching and UI rendering.
- Only use `"use client"` when absolutely necessary (e.g., using React hooks `useState`, `useEffect`, or interacting with the `window` object / browser APIs).
- Use **Server Actions** (`"use server"`) for data mutations and interacting with our AWS Fargate compliance APIs. Keep AWS credentials strictly on the server.

## Code Style & Architecture
- Write modular, readable, and highly typed code. Use strictly typed interfaces for all props and state.
- Use Tailwind CSS for all styling. Do not use inline styles or external CSS modules.
- Ensure all components are accessible (a11y) and responsive.

## Financial & Blockchain Integrity (Stellar/Freighter)
- When interacting with the Stellar SDK (`@stellar/stellar-sdk`) or Freighter Wallet (`@stellar/freighter-api`), all transaction signing MUST occur on the client side.
- Never log, store, or transmit a private key. Only handle public keys and signed XDR transaction strings.
- Treat every state change as a financial transaction: handle errors gracefully and provide explicit loading states to the user.

## UI / UX Design Language (Apple HIG / macOS Style)
- **Theme:** Must support Next.js Day/Night (Light/Dark) modes.
- **Typography:** Clean, crisp, and highly legible. Use Tailwind's `antialiased` class. Text defaults to `text-slate-900` in light mode and `dark:text-white` in dark mode.
- **Menus & Navigation:** Mimic macOS. Use translucent backgrounds (`bg-white/70 dark:bg-black/50`), backdrop blur (`backdrop-blur-xl`), subtle borders (`border-white/20`), and rounded corners (`rounded-2xl` or `rounded-xl`).
- **Interactions:** Buttons must have a "glow" or lift effect on hover. Use `transition-all duration-200 ease-out hover:scale-[1.02] hover:shadow-lg`.
- **Button Colors (Semantic):**
  - Primary: Blue (`bg-blue-600 hover:bg-blue-500`)
  - Success/Execute: Green (`bg-green-600 hover:bg-green-500`)
  - Destructive: Red (`bg-red-600 hover:bg-red-500`)
  - Admin/Special: Purple (`bg-purple-600 hover:bg-purple-500`)
