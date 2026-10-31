# 0031: @dnd-kit for Deck Priority and Section Reordering

## Status

Accepted

## Context

Per [ADR 0030](./0030-two-section-deck-priority-allocation.md) and [Spec #189](https://github.com/PedroFabrino/ga-tcg-binder/issues/189), Collectors need an intuitive, fast way to reorder decks within their current section (Competitive or 4Fun) as well as move decks across sections (promoting a 4Fun deck to Competitive or demoting a Competitive deck).

The interaction must work seamlessly across:
- Deck list view (table / row layout)
- Deck card view (grid layout)
- Touch devices and keyboard-only accessibility (meeting WCAG standards and avoiding mouse-only locks).

[AGENTS.md](../../AGENTS.md) specifies that introducing any new dependency requires an ADR.

We considered three options:
1. **HTML5 Native Drag-and-Drop API**: Lightweight with zero dependencies, but notoriously buggy across mobile browsers, difficult to style during drag previews, and lacks accessible keyboard listeners out of the box.
2. **`react-beautiful-dnd`**: Legacy library, unmaintained, and incompatible with modern React 19 / Next.js concurrent features.
3. **`@dnd-kit` (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`)**: The modern standard for React drag-and-drop. Modular, lightweight, zero external runtime bloat, works smoothly in grid and list layouts, natively supports touch and keyboard navigation, and works cleanly with Next.js App Router client components.

## Decision

We adopt `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` for drag-and-drop deck reordering:
- Drag handles and drop containers will support dragging within the same section and dropping between `competitive` and `4fun` droppable containers.
- Drag events trigger optimistic UI reordering, dispatched via server action / API call with rollback on failure.
- A menu fallback ("Move Up", "Move Down", "Move to Competitive", "Move to 4Fun") is always available on every deck card/row for touch and keyboard accessibility.

## Consequences

- Introduces `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` to `package.json`.
- Clean, accessible reordering in both card and list views with minimal code footprint.
