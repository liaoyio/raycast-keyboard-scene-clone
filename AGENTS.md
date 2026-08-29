# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Durable design direction

- Use `/Users/liaoyi/Desktop/raycast-keyboard-landing-main` as the interaction and visual-polish reference for the keyboard landing prototype.
- On desktop, never swap a full-viewport static keyboard image for a differently sized 3D projection. Keep the scene footprint stable and reveal it only from a verified first-frame-ready state (or use a size-matched fallback).
- Match the reference's restrained dark `Watch video` button treatment and complete responsive navigation behavior, including a functional animated mobile menu.
- Load repository-bundled fonts through `next/font/local`; do not hand-write global `@font-face` rules or depend on `next/font/google` during builds.
- Use Tailwind CSS utilities for project-owned layout and component styling. Keep authored CSS limited to theme variables/tokens and named `@keyframes`; do not add CSS Modules or ad-hoc selector styles without documenting a concrete exception.
- Do not introduce thin custom hooks for generic browser or React behavior. Prefer the project's established hooks library, and reserve custom hooks for cohesive domain state machines or resource lifecycles.
- Name project-owned TypeScript and TSX modules in kebab-case; retain framework-mandated filenames such as `next.config.ts`, `next-env.d.ts`, `layout.tsx`, and `page.tsx`.
- Use the shared `cn()` helper for conditional or merged Tailwind class names. Do not build dynamic `className` values with template-literal ternaries.
- Encapsulate repeated component anatomy and styling in small composable components, following shadcn-style headless composition. Do not hoist long Tailwind strings into standalone `*_CLASSES` constants, and inline single-use IDs or media-query strings.
- Prefer Tailwind `data-*`, `aria-*`, and group/peer variants for visual state. Keep JavaScript responsible for state and behavior instead of repeating visibility or transform ternaries across child class names.
