---
"name": "open rep"
"description": "Club Modern — focused opening practice in muted walnut, stone, and chalk."
"colors":
  "page": "#eae6e1"
  "surface": "#fcfaf7"
  "text": "#292521"
  "secondary": "#65594f"
  "accent": "#756052"
  "accent-hover": "#604d40"
  "accent-ink": "#584334"
  "accent-soft": "#e9e0d6"
  "on-accent": "#fcfaf7"
  "border": "#cdc3b9"
  "control-border": "#a99a8c"
  "board-frame": "#493c32"
  "board-light": "#e7d9c6"
  "board-dark": "#a48a73"
  "board-coordinate-light": "#584334"
  "board-coordinate-dark": "#30271f"
  "error-ink": "#953f32"
  "error-surface": "#f7e8e2"
  "hint-ink": "#725016"
  "hint-surface": "#f5edda"
  "success-ink": "#425846"
  "success-surface": "#e7eee3"
  "hint-arrow": "rgb(245, 158, 11)"
"typography":
  "display":
    "fontFamily": "Hanken Grotesk, Arial, sans-serif"
    "fontSize": "clamp(28px, 2.6vw, 36px)"
    "fontWeight": 650
    "lineHeight": 1.2
    "letterSpacing": "-.035em"
  "headline":
    "fontFamily": "Hanken Grotesk, Arial, sans-serif"
    "fontSize": "32px"
    "fontWeight": 650
    "lineHeight": 1.15
    "letterSpacing": "-.035em"
  "title":
    "fontFamily": "Hanken Grotesk, Arial, sans-serif"
    "fontSize": "24px"
    "fontWeight": 650
    "lineHeight": 1.2
    "letterSpacing": "-.025em"
  "status":
    "fontFamily": "Hanken Grotesk, Arial, sans-serif"
    "fontSize": "22px"
    "fontWeight": 650
    "lineHeight": 1.2
    "letterSpacing": "-.02em"
  "body":
    "fontFamily": "Hanken Grotesk, Arial, sans-serif"
    "fontSize": "15px"
    "fontWeight": 400
    "lineHeight": 1.5
  "label":
    "fontFamily": "Hanken Grotesk, Arial, sans-serif"
    "fontSize": "13px"
    "fontWeight": 550
  "button":
    "fontFamily": "Hanken Grotesk, Arial, sans-serif"
    "fontSize": "13px"
    "fontWeight": 600
"rounded":
  "board": "2px"
  "badge": "4px"
  "sm": "6px"
  "panel": "12px"
"spacing":
  "4": "4px"
  "8": "8px"
  "10": "10px"
  "12": "12px"
  "14": "14px"
  "16": "16px"
  "20": "20px"
  "24": "24px"
  "28": "28px"
  "36": "36px"
  "48": "48px"
"components":
  "button-primary":
    "backgroundColor": "{colors.accent}"
    "textColor": "{colors.on-accent}"
    "typography": "{typography.button}"
    "rounded": "{rounded.sm}"
    "padding": "11px 14px"
  "button-primary-hover":
    "backgroundColor": "{colors.accent-hover}"
    "textColor": "{colors.on-accent}"
  "button-secondary":
    "backgroundColor": "transparent"
    "textColor": "{colors.text}"
    "typography": "{typography.button}"
    "rounded": "{rounded.sm}"
    "padding": "11px 14px"
  "button-secondary-pressed":
    "backgroundColor": "{colors.accent-soft}"
    "textColor": "{colors.accent-ink}"
  "select-control":
    "backgroundColor": "{colors.surface}"
    "textColor": "{colors.text}"
    "rounded": "{rounded.sm}"
    "padding": "11px 12px"
  "control-panel":
    "backgroundColor": "{colors.surface}"
    "textColor": "{colors.text}"
    "rounded": "{rounded.panel}"
    "padding": "28px"
  "status-card":
    "backgroundColor": "{colors.accent-soft}"
    "textColor": "{colors.text}"
    "rounded": "{rounded.sm}"
    "padding": "20px"
  "side-badge":
    "backgroundColor": "{colors.accent-soft}"
    "textColor": "{colors.accent-ink}"
    "rounded": "{rounded.badge}"
    "padding": "5px 9px"
  "navigation":
    "textColor": "{colors.on-accent}"
---

# Design System: open rep

## Overview

**Creative North Star: "Club Modern"**

Club Modern takes its character from a contemporary chess club: muted walnut, stone ground, chalk surfaces, and warm ink. Hanken Grotesk gives headings and controls the same clear, humanist voice. The geometric SVG mark carries the identity without ornamental illustration.

The working interface is compact but comfortably spaced. Tonal surfaces group related controls, a dark perimeter gives the board weight, and short transitions clarify state. Terracotta, amber, and muted green communicate errors, hints, and completion; they do not replace the brown identity palette.

**Key Characteristics:**

- Muted walnut identity with chalk control surfaces.
- One humanist sans family with compact, moderately weighted headings.
- Small control corners, roomier panel corners, and restrained depth.
- Explicit labels, visible focus, and semantic feedback beyond color.

## Colors

The palette combines muted walnut with warm stone and chalk; the frontmatter records the normative values from the implementation.

### Primary

- **Muted walnut** (`accent`): header and primary actions; `accent-hover` deepens button hover.
- **Walnut ink** (`accent-ink`): links, focus outlines, selected controls, and tap-selected squares.
- **Soft walnut** (`accent-soft`): secondary pressed states, quiet badges, and neutral training status.
- **Chalk on walnut** (`on-accent`): text and marks on the accent surface.

### Secondary

These are functional feedback colors, not additional brand accents.

- **Terracotta** (`error-ink`, `error-surface`): incorrect moves, validation errors, and engine attention states.
- **Amber** (`hint-ink`, `hint-surface`, `hint-arrow`): hint cards, highlighted pieces, and move arrows. The board highlight uses translucent amber and an inset amber stroke.
- **Muted green** (`success-ink`, `success-surface`): accepted-move feedback and completed status.

### Neutral

- **Stone** (`page`): application ground.
- **Chalk** (`surface`): controls, panels, guide, dialog, and board status overlays.
- **Warm ink** (`text`) and **secondary ink** (`secondary`): main and supporting copy.
- **Soft rule** (`border`) and **control rule** (`control-border`): section separators and explicit control edges.
- **Dark walnut frame** (`board-frame`): sturdy board perimeter.
- **Light wood** (`board-light`) and **dark wood** (`board-dark`): chess squares; their coordinate tokens keep notation legible on each tone.

**The Brown Identity Rule.** Use walnut for identity, primary actions, and selected states; reserve terracotta, amber, and muted green for feedback.

## Typography

**Display Font:** Hanken Grotesk (Arial, sans-serif fallback).
**Body Font:** Hanken Grotesk (Arial, sans-serif fallback).

The variable font is self-hosted from `public/fonts/hanken-grotesk/HankenGrotesk-Variable.ttf`, with normal weights from 100–900 and swap loading. Its open forms keep compact instructions and move notation readable without a separate display or monospace family.

### Hierarchy

- **Display:** task headings use the display token, with a responsive size capped at 36px; tablet and phone overrides use 32px and 28px.
- **Headline:** dialog headings use the headline token; phones reduce the size to 28px.
- **Title:** panel headings use the title token; phones use 23px. Status headings use the status token.
- **Body:** default copy uses the body token. Supporting descriptions use 14px; status, hints, and compact instructions use 13px with a more open line height where needed.
- **Label:** form labels use the label token; compact metadata is 11–12px. Buttons use the separate button token. Keep labels in natural case.
- **Notation and progress:** use tabular numerals for paired move notation and numeric session progress. The wordmark is heavier (750) and tightly tracked; it is a brand treatment, not a heading weight.

**The Shared Voice Rule.** Use Hanken Grotesk for headings, body copy, controls, and chess notation; use weight and size to establish hierarchy.

## Layout

The shared desktop container is capped at 1312px with 48px side gutters. The working grid pairs a flexible board region capped at 640px with a control region of at least 350px, separated by 48px. Panels use internal spacing rather than nested decorative cards. The common spacing vocabulary is recorded in the frontmatter; most controls and groups use the 8–28px steps.

At 1199px and below, gutters become 32px, the inter-column gap is 28px, and the control column is 352px. At 900px and below, content becomes one column, capped at 640px with 24px side gutters and a 24px group gap. At 599px and below, gutters become 16px and navigation is condensed to the brand and practice guide. At 359px and below, piece palettes become three columns and board actions stack. Panels adapt their padding across these widths; preserve the same grouping and control legibility rather than shrinking text to fit.

Interactive controls have a minimum height of 44px. Piece tools retain a 44px minimum width. Dialog width is bounded by the viewport with 16px side clearance. These constraints also apply when text wraps.

## Elevation & Depth

Stone, chalk, soft walnut, and thin rules create ordinary surface separation. Panels and the guide are flat. The board perimeter is dark rather than shadowed. Board status and feedback overlays use a small diffuse shadow; the native modal uses a deeper shadow and a dark translucent backdrop. Exact shadow values live in the extension sidecar.

**The Grounded Surface Rule.** Keep ordinary panels flat; reserve shadows for board overlays and modal elevation.

State transitions are brief: controls use 160ms with the shared ease-out curve; progress uses 250ms and newly committed notation uses 280ms. The loading dot pulses while work is pending, and move-result feedback fades within 900ms. Reduced-motion preferences disable animation and transitions.

## Shapes

Controls and small status surfaces have gently curved corners using `sm`; panels, guide, and dialog use `panel`. Small badges and move groups use `badge`, while the board and progress track use the nearly square `board` radius. Thin borders define fields and secondary actions. Selected piece tools use a stronger two-pixel border; tap-selected board squares use an inset three-pixel outline. Circular dots and feedback discs remain reserved for compact indicators.

## Components

### Buttons

Restrained, solid primary actions and lightly outlined secondary actions share the button typography and small radius. Primary actions use walnut and chalk, deepen on hover, and have a 50px minimum height. Secondary actions are transparent with a control border; hover and pressed states add soft walnut and walnut ink. Most use 11px by 14px padding; context may adjust horizontal padding. Active presses dim slightly. Disabled buttons use muted neutral fill and ink with a non-interactive cursor.

Focus-visible controls use a three-pixel walnut-ink outline with four-pixel offset. On the walnut header the focus outline becomes chalk. Preserve the explicit focus treatment rather than relying on hover.

### Chips

Badges identify playing side or active setup tool. Use compact natural-case text, soft walnut fill, walnut ink, and a small badge radius. They communicate state; they are not a separate navigation system.

### Cards / Containers

Control panels are chalk with the panel radius, generous padding, and no shadow. Internal sections use a thin separator and spacing. Training status cards use the smaller control radius and soft walnut; error and completion states switch to their semantic surfaces. Feedback combines a dot, heading, and explanatory copy.

### Inputs / Fields

Native selects use chalk, warm ink, the control border, small corners, and 11px by 12px padding. Hover deepens the border; focus uses the shared outline. Labels sit above fields and remain visible. Setup errors appear in a terracotta message surface with alert semantics; disabled controls use the shared muted treatment.

### Navigation

The walnut header holds the SVG mark, lowercase wordmark, active practice link, and disclosure guide. The active link has a quiet bottom rule. Navigation is compact and natural-case; the practice link disappears at the phone breakpoint while the guide remains available. Header focus uses chalk for visibility.

### Board and session notation

Keep the board's wood tones and dark perimeter consistent between setup and training. Tap selection uses walnut ink; hint selection uses amber with a distinct inset treatment. Feedback overlays use actual SVG icons. Piece palettes show the standard piece artwork inside small rectangular controls, with a stronger edge for the active tool.

Committed notation groups move number, White move, and Black move into compact rounded groups, with tabular numerals and a solid walnut treatment on the latest move. Keep this visual language tied to recorded session history. It must not imply a suggested or unplayed continuation.

### Completion dialog

Use the native modal surface, panel corners, chalk ground, deeper modal shadow, and stacked primary and secondary actions. Retain its initial focus, Escape behavior, and return-focus behavior when reusing it.

## Do's and Don'ts

### Do:

- **Do** reuse the CSS custom properties for colors and the existing SVG mark and icons.
- **Do** pair feedback color with text, a recognizable icon, or a visible state treatment.
- **Do** keep controls at least 44px tall and preserve the visible focus outline.
- **Do** retain reduced-motion and forced-colors treatments on new components.

### Don't:

- **Don't** restore the superseded pastel-green and serif visual identity.
- **Don't** use feedback green as the primary action or tap-selection color.
- **Don't** add shadows to ordinary panels or turn restrained controls into pill shapes.
