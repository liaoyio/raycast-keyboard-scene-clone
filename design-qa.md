# Design QA

## Source of truth

- Reference implementation: `/Users/liaoyi/Desktop/raycast-keyboard-landing-main`
- Reference desktop capture: `/Users/liaoyi/.codex/visualizations/2026/08/29/01a04c33-8ab8-7143-a230-8a2de66330b6/raycast-audit/qa-reference-1440x900.png`
- Reference mobile captures: `qa-reference-879x900-closed.png` and `qa-reference-879x900-open.png` in the same audit directory
- Fidelity target: the reference repository's header, hero, CTA surfaces, keyboard framing, responsive navigation, and loading behavior

## Implementation under review

- Page shell and project-owned CSS entry: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`
- Header and controls: `src/components/keyboard/nav.tsx`, `src/components/keyboard/button.tsx`, `src/components/keyboard/video-dialog.tsx`
- Hero and scene lifecycle: `src/components/keyboard/hero.tsx`, `src/components/keyboard/scene.tsx`, `src/components/keyboard/scene-error-boundary.tsx`
- Input and audio domain hooks: `useKeyboardInput` in `src/components/keyboard/input.ts`, `useKeyAudio` in `src/components/keyboard/audio.ts`
- Conditional class merging: `cn` in `src/utils/cn.ts`, backed by `cnfast`
- Local preview: validated with the retained Next.js development server before the production build.

`src/app/globals.css` contains only the Tailwind import, theme tokens, and named keyframes. Project-owned component styling is expressed with Tailwind utilities in `className`, including responsive, state, arbitrary-value, and pseudo-element variants; conditional class lists use the shared `cnfast`-backed `cn` helper so conflicting Tailwind utilities merge predictably. Generic media-query, intersection-observer, event-listener, stable-callback, and scroll-lock behavior comes from `usehooks-ts`; the two project hooks remain because they own the keyboard input state machine and Web Audio resource lifecycle.

## Viewports, density, and states

All source/prototype pairs were captured at device scale factor 1.

| Viewport   | State                      | Evidence                                                          |
| ---------- | -------------------------- | ----------------------------------------------------------------- |
| 1440 × 900 | Desktop, scene ready       | `qa-comparison-production-1440x900-final.png`                     |
| 1440 × 900 | Focused header/hero crop   | `qa-focus-nav-hero-production-final.png`                          |
| 879 × 900  | Mobile navigation closed   | `qa-comparison-production-879x900-closed-final.png`               |
| 879 × 900  | Mobile navigation open     | `qa-comparison-production-879x900-open-final.png`                 |
| 320 × 900  | Narrowest supported layout | `qa-production-320x900-final.png`                                 |
| 1440 × 900 | Cold-load timeline         | `qa-cold-load-sequence.jpg` plus the 0/100/500/1500/4000ms frames |
| 1440 × 900 | Forced GLB failure         | `qa-scene-error-fallback-1440x900.png`                            |

Audit directory: `/Users/liaoyi/.codex/visualizations/2026/08/29/01a04c33-8ab8-7143-a230-8a2de66330b6/raycast-audit`

## Full-view comparison

The final 1440 × 900 source/prototype pair aligns on the header container, hero vertical rhythm, 512.07px title width, CTA sizing and spacing, notice placement, scene background, keyboard scale, and bottom fade. The exact Inter font is self-hosted, removing the earlier fallback-font width drift.

At 879 × 900, the closed state aligns on header geometry, hero placement, title width, CTA row, notice, and static keyboard. The open state aligns on overlay size, blur, link rhythm, divider, and login placement. At 320 × 900, the page has no horizontal overflow; both CTAs stack at 250px width and the static keyboard remains inside the viewport.

## Focused comparison

The focused header/hero composite confirms:

- matching Raycast wordmark, navigation order, login and download hierarchy;
- matching logo lockup, type size/weight/line height, subtitle wrap, and CTA surfaces;
- the dark Watch video button uses the reference's restrained 25% white ring instead of the previous high-contrast treatment;
- the keyboard occupies a fixed 400px desktop slot and no longer changes the page geometry while Three.js initializes.

## Loading and failure states

Cold-load measurements on a fresh origin:

- 0–100ms: no Canvas yet; the desktop stage keeps its fixed footprint at opacity 0; the mobile static keyboard is `display: none` on desktop.
- 500ms: Canvas exists and the complete scene is fading in as one layer.
- 1500ms onward: opacity 1, `aria-busy=false`, stable keyboard geometry.

This removes the original large-static-image-to-small-model flash. A forced missing-GLB test keeps the hero intact and reveals a size-matched WebP fallback inside the same slot; no route-level runtime error UI appears.

## Interaction and runtime checks

- Watch video opens the native modal with the YouTube iframe; Escape closes it.
- With focus on non-interactive page content, Arrow keys and Space still trigger the 3D keyboard response while preserving the browser's native scrolling behavior.
- Supported physical keys are derived from actual non-static GLB Mesh names instead of a narrow letter/digit/arrow regex.
- Links, buttons, form controls, contenteditable elements, and button/link roles are ignored by keyboard-scene input; disabled scenes release held keys, pointer input is removed while inactive, and macOS Command-key lost-keyup cleanup is present.
- At 879px the menu locks body scrolling, reports `aria-expanded=true`, and Escape closes it, restores body overflow, and returns focus to the opener.
- At 1000px the static WebP is used with no Canvas; at 1001px and above the 3D scene is mounted.
- Offscreen/video-open scenes stop input and switch the post-ready Canvas to demand rendering.

Normal final-preview logs:

- Desktop: one dependency warning from React Three Fiber's use of deprecated `THREE.Clock`; no application error.
- 879px and 320px: no console messages.
- The forced missing-GLB fixture intentionally records a 404 and WebGL context loss; these are confined to the induced error test.

## Findings and iteration history

Resolved before final pass:

- P1: desktop SSR showed a large static keyboard before replacing it with a smaller model. Fixed with a deterministic 400px scene footprint, desktop-hidden static branch, pre-oriented camera, first-frame readiness, and whole-stage fade.
- P1: the navigation was structurally thin and lost behaviors at intermediate/mobile widths. Rebuilt as three responsive tiers with real links, menu semantics, body lock, Escape handling, focus restoration, and collision-safe spacing.
- P1: scene resource failures could escape to route-level error UI. Added a local Error Boundary with a size-matched fallback.
- P2: Watch video color/ring and interaction states did not match the source. Replaced with shared light/dark button variants and explicit hover, active, and focus-visible states.
- P2: remote font loading produced a fallback-font geometry mismatch. Replaced with the exact locally hosted Inter asset.
- P2: an artificial after-hero spacer created a 15px mobile width loss and unnecessary scroll. Removed it and verified 320px and 879px scroll widths.

Remaining P3 notes:

- Automated keyboard focus makes the prototype's close/focus ring slightly more visible than the source. This is intentional accessible focus treatment and does not alter pointer-rest visuals.
- The `THREE.Clock` deprecation warning originates in the current React Three Fiber dependency and has no visible or functional effect.

No actionable P0, P1, or P2 mismatch remains in the tested states.

final result: passed
