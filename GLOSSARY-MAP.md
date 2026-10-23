# Glossary Map

## Contexts

- [Collection & Deck Management](./CONTEXT.md): tracks physical collections, print populations, deck allocation, and marketplace data for Grand Archive.
- [GrandTable Tabletop](./apps/table/CONTEXT.md): a webcam-play Table where two Seats share mirrored board state and video.

## Relationships

- **Table → Collection**: `apps/table` shares the definitions of `Card`, `Printing`, and `Deck` from the root `CONTEXT.md`; it does not redefine them. The two contexts are otherwise independent, and `apps/table` depends on the collection context only through the `@ga/contracts` package and `api.gatcg.com`, not through the collection database.
