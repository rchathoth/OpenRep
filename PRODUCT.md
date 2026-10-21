# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

OpenRep serves intermediate chess players trying to learn opening theory. Practice should help them learn strong opening continuations through repeated decisions from a chosen position.

## Product Purpose

Provide short, focused chess practice: set up a position, choose a playing side, and practice strong moves against varied engine replies. A successful session gives the player repeated opportunities to find the best move and learn from feedback and hints.

## Positioning

The current mechanism combines exact-best-move player validation with varied, quality-filtered opponent replies. It supports practice from user-arranged positions rather than requiring a predefined opening course. Do not claim unique market positioning or measured learning outcomes without evidence.

## Operating Context

Players use a desktop or mobile browser. They arrange pieces, choose their side and board orientation, and start training. During practice, they drag pieces or tap a piece and destination. Hints support difficult decisions. Players can review a completed line or return to setup to practice another.

## Capabilities and Constraints

Preserve these user-confirmed product rules:

- Stockfish runs locally in browser workers. Training requires no network requests after engine assets initialize.
- Player validation and hints use Stockfish's exact best move with MultiPV 1. An unchanged position reuses its validated result.
- Opponent turns request up to five candidate lines. Use the deepest completed search and sample uniformly among legal moves within 100 centipawns of the best score.
- Winning mate alternatives must preserve forced mate; losing mate alternatives cannot allow a faster mate. Use the best move when only one qualifies or exact scores are unavailable.
- Sessions end at checkmate, a draw, or 20 committed half-moves (ten full moves) from the starting position.
- Preserve hints, promotion selection, cancellation, stale-result protection, and opponent-reply retry without replaying an accepted player move.
- Keep desktop and mobile web support. Current implementation uses Next.js, React, TypeScript, chess.js, and pinned Stockfish assets.

## Brand Commitments

The existing interface uses the name “open rep”; metadata and documentation also use “OpenReps.” Canonical spelling remains an open decision. The user-approved Club Modern visual system is recorded in `DESIGN.md`, with machine-readable extensions in `.impeccable/design.json`. The guide captures the current implementation and replaces the former lowercase `design.md`; existing UI code and assets remain the implementation evidence.

## Evidence on Hand

`README.md` documents current workflows and engine behavior. `tests/` contains unit and browser regression coverage. `THIRD_PARTY_NOTICES.md` and `licenses/` hold Stockfish licensing/source information; preserve those notices. No testimonials, performance benchmarks, or verified learning-outcome studies have been supplied.

## Product Principles

- Center practice on opening decisions for intermediate players.
- Keep player acceptance reliable and consistent with hints.
- Vary opponent replies without abandoning move-quality safeguards.
- Keep sessions bounded and recover safely from interrupted searches.
- Preserve responsive, browser-local practice.

## Accessibility & Inclusion

Retain labeled controls, visible focus, live status announcements, accessible completion-dialog behavior, and feedback distinguishable without color. Preserve touch support, reduced-motion handling, and forced-colors support documented in the existing design guide.

## Open Decisions

Canonical product-name spelling and any future curated opening curriculum, saved repertoire, or progress tracking remain unconfirmed. Do not describe them as current capabilities.
