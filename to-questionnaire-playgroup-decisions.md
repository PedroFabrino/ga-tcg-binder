# Grand Archive Playgroup Decisions: Collection & Binder Manager

**Purpose:** Verify and align on the core rules, sharing mechanics, and collection preferences for our shared Grand Archive TCG web app before we lock in features.

**From:** Project Lead — **To:** Initial Playgroup Testers — **How your answers will be used:** Directly shape the rules for card sharing, friend borrowing, scarcity tracking, and deck shortages in the app.

## Context

We are building a dedicated Grand Archive TCG web app for our playgroup. It syncs with the official card catalog to track our physical binders, highlights card shortages when building decks, and lets us see each other's idle/spare cards so we can easily borrow what we need for game nights and tournaments. We've drafted the core system architecture, but several non-technical product rules need your direct input so the app matches how we actually play, collect, and share cards.

## How to answer

Please take ~10 minutes to jot down your thoughts under each question stub (`>`). Brief answers, bullet points, or "don't care / either way" are totally fine. If something is a hard preference, please note it!

---

## Card Sharing & Deck Contention

### When building multiple decks, do you physically swap staple cards between deck sleeves, or do you prefer each deck to have its own dedicated physical copies?

_Why this matters: It decides whether the app assumes 4 owned copies of a staple can satisfy multiple decks at once, or warns you of a shortage as soon as a card is claimed by another deck._

> 

### If two of your decks need the same physical card and you don't own enough for both, how should the app resolve the conflict?

_Why this matters: It decides whether you can explicitly assign priority to one deck or if the app should just flag a shared contention warning on both._

> 

### Do you want the app to strictly enforce tournament deck limits (60 Main Deck, 12 Material Deck), or allow work-in-progress test lists with flexible counts?

_Why this matters: It decides whether shortage reports require complete legal decks or can evaluate partial draft lists._

> 

---

## Playgroup Lending & Privacy

### When borrowing cards for an event, is knowing who has idle spare copies enough, or do you want the app to track active loans and returns?

_Why this matters: It decides whether we keep the friend network lightweight (view-only idle badges) or build a full checkout/check-in tracking log._

> 

### Are you comfortable with our playgroup seeing your entire physical collection, or do you want the ability to mark specific cards or binders as private?

_Why this matters: It determines whether collection visibility between linked friends is fully mutual or requires granular privacy toggles._

> 

### Should friends be able to inspect your active decklists, or only see the cards sitting idle in your binder?

_Why this matters: It prevents accidentally exposing secret tournament tech or surprise deck builds before local tournaments._

> 

### If a card is in your collection but not currently in any of your active decks, should the app always assume it is available to borrow?

_Why this matters: It decides whether we need a "Personal Collection / Not for Loan" tag for rare trophies or sentimental cards you keep in your binder._

> 

---

## Collection Tracking & Scarcity

### Do you want to track your collection by exact printing finish (Foil vs. Non-Foil, 1st Edition vs. Alter Edition), or do you primarily care about having playable game copies regardless of printing?

_Why this matters: It decides whether the quick-add and search flows require selecting exact print editions or default to generic copies._

> 

### We currently measure card scarcity using official publisher print population counts (e.g., cards under 1,000 copies) rather than market dollar prices. Is population count sufficient for you, or do you need market prices?

_Why this matters: We deferred TCGPlayer market pricing to avoid API volatility, but need to know if secondary market values are essential to how you evaluate your binder._

> 

### What circulating print count feels like a true "Low Population / Rare" collector card in Grand Archive to you?

_Why this matters: We set the default scarcity badge threshold at 1,000 copies, and want to know if that matches your intuition or should be higher/lower (e.g., 500 or 2,500)._

> 

---

## Ingestion & Day-to-Day Use

### How would you prefer to enter your existing collection into the app initially?

_Why this matters: We are supporting a phone camera scanner (via desktop QR code pairing), bulk text paste, and manual search, and want to know which to optimize first._

> 

### How often do you buy new Grand Archive product, open packs, or trade cards?

_Why this matters: It helps us understand whether updating your collection is a weekly habit or an occasional bulk update after major set releases._

> 

---

## Meta Decks & Tournament Prep

### Where do you usually find decklists when researching meta trends or tournament winners?

_Why this matters: We built integration with grandarchivestats.com and Omnidex imports, but want to ensure we support Silvie.gg, YouTube decklists, or Discord exports if you use them._

> 

### When inspecting a tournament deck list to see what cards you are missing, what summary view is most helpful to you?

_Why this matters: It decides whether the shortage dashboard highlights missing cards by element/class, raw missing count, or which cards can immediately be borrowed from friends._

> 

---

## Anything else?

### Is there any feature, annoyance with existing TCG tools, or specific workflow you want to make sure we include from day one?

> 
