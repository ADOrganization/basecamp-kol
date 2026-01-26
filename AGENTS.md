# Vercelman - Web Interface Guidelines

> Based on [Vercel's Web Interface Guidelines](https://vercel.com/design/guidelines) and [GitHub Repository](https://github.com/vercel-labs/web-interface-guidelines)

When building or modifying UI components, follow these guidelines strictly.

---

## Interactions

### Keyboard & Focus
- **MUST** support full keyboard navigation per WAI-ARIA APG
- **MUST** show visible focus indicators (prefer `:focus-visible` over `:focus`)
- **MUST** manage focus when opening/closing modals, drawers, dialogs
- **MUST** trap focus within modals until dismissed
- **SHOULD** support Escape to close overlays, dialogs, popovers

### Hit Targets
- **MUST** use minimum 24px hit targets (44px on mobile)
- **SHOULD** provide generous, forgiving click areas
- **MUST** respect browser zoom up to 200%

### State Management
- **SHOULD** persist UI state in URL (filters, pagination, tabs)
- **SHOULD** support deep-linking for shareable states
- **MUST** use optimistic UI updates where possible
- **MUST** ensure hydration-safe form inputs (no flash of incorrect state)

---

## Animations

### Performance
- **MUST** honor `prefers-reduced-motion` media query
- **MUST** prefer CSS animations over JavaScript
- **MUST** animate only compositor-friendly properties (`transform`, `opacity`)
- **NEVER** animate layout properties (`width`, `height`, `top`, `left`)

### Behavior
- **MUST** make animations interruptible
- **SHOULD** use input-driven animations over autoplay
- **SHOULD** add animation only when it clarifies cause-effect relationships
- **NEVER** use animation purely for decoration

---

## Layout

### Alignment
- **MUST** align all elements deliberately (no arbitrary positioning)
- **SHOULD** use optical alignment (±1px adjustments when perception matters)
- **MUST** verify layouts across all breakpoints and device sizes

### CSS Best Practices
- **SHOULD** use CSS flexbox/grid over JavaScript measurements
- **MUST** respect safe areas on notched devices (`env(safe-area-inset-*)`)
- **SHOULD** avoid multiple scrollbars in nested containers
- **MUST** set explicit dimensions on images to prevent layout shift

---

## Content & Typography

### Text
- **MUST** use inline help text over tooltips when possible
- **MUST** use stable skeleton screens (avoid layout shift on load)
- **MUST** set accurate, descriptive page titles
- **MUST** handle all states: empty, loading, error, dense data

### Formatting
- **MUST** use typographic quotation marks (" " ' ') not straight quotes
- **MUST** use tabular/monospace numbers for data comparison
- **MUST** provide redundant status cues beyond color alone
- **SHOULD** use semantic HTML over ARIA attributes when possible

### Accessibility
- **MUST** provide meaningful `aria-label` for icon-only buttons
- **MUST** use color-blind-friendly palettes for charts
- **MUST** ensure minimum 4.5:1 contrast ratio (prefer APCA over WCAG 2)

---

## Forms

### Submission
- **MUST** submit on Enter for single-field forms
- **MUST** use ⌘/⌃+Enter for textarea submission (Enter = newline)
- **MUST** submit on last control's Enter in multi-field forms

### Labels & Inputs
- **MUST** associate every control with a label (visible or aria-label)
- **MUST** make labels clickable to activate their controls
- **NEVER** block paste in any input field
- **NEVER** pre-disable submit buttons (validate on submit)

### Validation
- **MUST** accept free text input, validate after—don't block typing
- **SHOULD** show validation feedback inline, near the field
- **MUST** preserve form data on validation errors
- **MUST** support password managers and 2FA autofill flows

---

## Performance

### Testing
- **MUST** test with CPU throttling (4x slowdown)
- **MUST** test with network throttling (Slow 3G)
- **MUST** test in low-power/battery-saver modes

### Optimization
- **MUST** virtualize large lists (>50 items)
- **MUST** set explicit image dimensions (prevent CLS)
- **SHOULD** preconnect to critical third-party domains
- **SHOULD** subset fonts with `unicode-range`

---

## Design & Visual

### Shadows & Borders
- **SHOULD** use layered shadows to mimic realistic lighting
- **SHOULD** combine crisp borders with semi-transparent strokes
- **MUST** use concentric border-radius for nested elements

### Colors & Theming
- **MUST** set `color-scheme: dark` on html element for dark mode
- **MUST** use explicit colors for native form controls in dark mode
- **MUST** set `theme-color` meta tag matching background color
- **MUST** ensure proper contrast ratios across all themes

---

## Copywriting (Vercel Style)

### Voice & Tone
- **MUST** use active voice ("Install the CLI" not "The CLI will be installed")
- **MUST** use action-oriented language ("Install the CLI" not "You will need the CLI")
- **MUST** write in second person, avoid first person
- **MUST** be clear & concise—use as few words as possible

### Formatting
- **MUST** use Title Case for headings & buttons (Chicago style)
- **MUST** use sentence case on marketing pages
- **MUST** use numerals for counts ("8 deployments" not "eight deployments")
- **SHOULD** prefer "&" over "and" in UI labels

### Numbers & Units
- **MUST** separate numbers & units with non-breaking space (`10 MB` → `10&nbsp;MB`)
- **MUST** keep keyboard shortcuts together (`⌘ + K` → `⌘&nbsp;+&nbsp;K`)
- **MUST** use consistent decimal places in currency (0 or 2, never mixed)

### Placeholders
- **MUST** use consistent placeholder formats:
  - Strings: `YOUR_API_TOKEN_HERE`
  - Numbers: `0123456789`

### Error Messages
- **MUST** guide users toward solutions, not just state problems
- **MUST** use positive framing when possible
- **NEVER** use ambiguous labels like "Continue"—be specific about the action

---

## Quick Reference

| Category | Key Rule |
|----------|----------|
| Keyboard | Full WAI-ARIA APG support, visible focus |
| Targets | 24px min (44px mobile) |
| Animation | Honor `prefers-reduced-motion`, CSS only |
| Forms | Enter submits, never block typing |
| Lists | Virtualize >50 items |
| Contrast | 4.5:1 minimum, prefer APCA |
| Voice | Active, concise, second person |
| Numbers | Use numerals, non-breaking spaces |

---

## Usage

This file can be used by AI coding assistants (Claude Code, Cursor, Copilot) to apply these guidelines during code generation. Place in project root as `AGENTS.md`.

Sources:
- [Vercel Design Guidelines](https://vercel.com/design/guidelines)
- [GitHub: vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines)
