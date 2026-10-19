# Open Rep — design direction

## The idea

**Good moves. Made a habit.** Open Rep is a quiet place to build a stronger chess
repertoire through repetition. It should feel like a well-made chess book opened
on a desk: thoughtful, tactile, and immediately useful.

The visual references are [Anthropic / Claude](https://www.anthropic.com/) for
editorial serifs, warm space, and expressive line illustration, and
[David](https://davidprotein.com/) for confident typography, short copy, and simple
visual statements. These are directional references. Open Rep uses its own mark,
illustrations, language, and palette.

## Principles

- **The board is the product.** Keep the position and its controls easy to find.
  Branding should frame practice, never compete with it.
- **Warm, with conviction.** Pair a generous serif with precise sans-serif labels.
  Use black ink, ivory paper, and one memorable green accent.
- **Fewer, stronger shapes.** Use solid surfaces, thin rules, original line art,
  and restrained corners. Avoid glass, gradients, heavy shadows, and decorative
  card stacks.
- **Practice has a rhythm.** Make setup, the active turn, hints, and completion
  visually legible. Progress always comes from the actual session.
- **Simple words, real actions.** Explain what to do next. Every navigation item
  and control must have a working destination or action.
- **Let the design speak.** Keep one brand statement and essential instructions.
  Omit marketing subtext, numbered section markers, board captions, redundant
  counters, and explanatory sections that repeat what the controls already show.

## Color system

| Token | Value | Purpose |
| --- | --- | --- |
| `--page` | `#F7F7F0` | Warm ivory page |
| `--surface` | `#FDFDF8` | Solid paper panels and controls |
| `--text` | `#232820` | Ink; headings, body, icons |
| `--secondary` | `#656B5E` | Supporting copy |
| `--accent` | `#C4DDB0` | Pastel green; primary action, brand tile, selected controls |
| `--accent-hover` | `#B5D29D` | Hover on primary actions |
| `--accent-ink` | `#354A2B` | Accessible green text, links, focus and selection outlines |
| `--accent-soft` | `#EAF1E2` | Quiet green status surfaces |
| `--border` | `#DADDD0` | Layout rules and panel edges |
| `--control-border` | `#8B927F` | Form-control boundaries |
| `--board-light` | `#F0F0DE` | Light chess squares |
| `--board-dark` | `#A8BE92` | Sage chess squares |
| `--error-ink` | `#923C31` | Invalid positions and incorrect attempts |
| `--error-surface` | `#F8EBE5` | Error feedback surface |
| `--hint-ink` | `#71511D` | Conceptual hint copy |
| `--hint-surface` | `#F5EEDB` | Hint surface |

Pastel green is a **background accent**, paired with ink-colored text. Do not use
it as small text on ivory or as the only indication of state. Visual chess hints
remain amber so that they stay distinct from green selection and success.

## Typography

- Display: `Georgia, "Times New Roman", serif`. These system fonts give the app a
  classic editorial voice with no external font requests or layout shifts.
- UI: `Arial, Helvetica, sans-serif`. Use crisp, familiar type for controls,
  essential instructions, engine messages, and move counts.
- Wordmark: lowercase **open rep**, bold serif, tight tracking, 32px desktop.
- Hero: 56–64px desktop, 38–44px mobile; regular serif, tight line-height. Emphasize
  the second phrase in italic, rather than introducing another typeface.
- Screen headings: 28–32px serif. Panel headings: 22–24px serif.
- Body and controls: 14–15px with generous line-height. Supporting labels: 12px.
- Use tabular numbers for progress. Keep long messages free to wrap.

## Brand and iconography

The **open-board mark** consists of four open corners surrounding a small central
square. It suggests a board, an opening, and returning to a position. Render it in
ink on a pastel-green tile, or alone at small sizes. It must remain recognizable
in one color.

Use an original knight illustration with a looping move path in the introduction.
Its slightly organic strokes soften the rigorous geometry of the board. Keep the
illustration decorative (`aria-hidden`), modest in size, and out of the way on
small screens. Do not reproduce Claude's starburst or David's wordmark.

Utility icons share a 24px viewBox, rounded stroke caps, and a 1.5–1.8px stroke.
Use arrows, flip, reset, and hint symbols only where they clarify an action. Keep
visible text labels; icons do not replace accessible control names.

## Layout

1. A thin header: brand at left, ivory background, and a bottom rule.
2. A compact editorial introduction: a two-line serif statement
   and the knight illustration at right. Training
   uses a shorter introduction so attention returns to the board.
3. The workspace: a large square board at left, a narrower controls panel at
   right. Headings establish a natural reading order. Frame the
   board with solid paper and a fine border; keep the chessboard itself square.
4. Setup: two six-piece palettes, playing-side settings, flip/reset actions, and
   a full-width pastel-green **Start training** button.
5. Training: actual half-move progress, playing side, a live turn/status card,
   hints, promotion selection, return to setup, and engine license links.
6. End at the workspace. No method section, marketing footer, or repeated brand
   copy. Keep engine license links in the training panel.

Maximum content width: 1120px. Desktop workspace: flexible board column plus a
352px control column, separated by 32px. At 900px and below, stack the panel under
the board and cap the content width at 640px. Mobile page padding is 16px; desktop
padding is 40px. Maintain a useful layout at 320px without horizontal scrolling.

Use an 8px spacing rhythm, 24–40px between major blocks, 4–8px corner radii, and
thin borders. Buttons and piece choices have at least 44px by 44px tap targets.
At narrow widths, split each six-piece palette into two rows of three if needed.

## States and motion

- Selected piece / remove mode: pastel-green fill, dark-green border, and the
  existing `aria-pressed` state. Keep the selected piece's name visible.
- Ready / successful: soft green with a dark status dot and an explicit message.
- Starting / checking / replying: explicit text and a subtly pulsing dot.
- Incorrect / error: muted terracotta, an explicit message, and existing retry
  controls. Errors remain distinguishable without color.
- Hint: parchment amber; preserve the three-stage hint behavior.
- Completion: a paper dialog with the brand mark, serif title, and clear next
  actions. Preserve native dialog focus management and keyboard dismissal.
- Hover transitions: 150ms, limited to color and border. No entrance animation,
  parallax, or moving decorative artwork.

## Accessibility and implementation

Use semantic headings, labeled selects, named buttons, a skip link, visible focus
rings, live status announcements, and decorative SVGs hidden from assistive
technology. Preserve reduced-motion and forced-colors support. Solid surfaces
make reduced-transparency settings naturally compatible. Text contrast should
meet WCAG AA; use dark green for focus and selection instead of pastel outlines.

Implement the system in `app/globals.css`; share SVG primitives through
`components/Brand.tsx` and board colors through `components/boardAppearance.ts`.
Restyle setup, training, feedback, and the completion dialog together. Keep chess
validation, engine lifetime, move selection, hints, touch behavior, and session
limits intact. Use no additional runtime dependency or remotely hosted font.

Validate with lint, TypeScript, the production build, existing unit and browser
tests, and visual inspection of desktop/mobile setup, training, and completion.
