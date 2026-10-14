## Parent
#1

## What to build
Scaffold the Next.js full-stack project with Tailwind CSS, Drizzle ORM, and libSQL. Implement the Card Catalog schema and an automated sync pipeline that fetches the ~2,535 Grand Archive cards from `https://api.gatcg.com/cards/search` including all print editions, circulations, and population numbers. Deliver a responsive catalog search interface allowing users to filter by element, class, type, and set, view card art, and inspect exact population counts with a visual "Low Population" badge on printings with population <= 1,000.

## Acceptance criteria
- [ ] Next.js app scaffolding runs with TypeScript, Tailwind CSS, and libSQL + Drizzle ORM.
- [ ] Catalog database schema captures cards, print editions, circulations, foil flags, and population counts.
- [ ] Catalog sync script or API route pulls complete card data from `api.gatcg.com` with pagination and error handling.
- [ ] Card catalog search page supports text search, element filter, class filter, and set filter.
- [ ] Card details show all available printings with foil/non-foil status, collector number, and exact population count.
- [ ] "Low Population" badge renders on printings where population <= 1,000.
- [ ] Automated tests verify catalog queries and filtering against fixture data.

## Blocked by
None — can start immediately.
