# Privacy Policy for GA TCG Binder Market Bot

*Last updated: October 21, 2026*

## 1. Overview
GA TCG Binder Market Bot ("the Bot", "we", "our") is an automated notification bot developed for the Root platform. The Bot monitors public Grand Archive Trading Card Game (TCG) singles inventory and prices across configured game stores and delivers stock updates to designated Root community channels.

## 2. Information We Collect
The Bot operates strictly as a notification broadcaster.
- **We DO NOT collect** personal data, user chat messages, direct messages, voice data, or personal account credentials from Root users.
- **We DO NOT read** incoming messages sent by members in the Root community channels.
- **Data processed**: The Bot only processes public marketplace listing data (card names, set editions, prices, availability) and reads the target Root Channel GUID (`ROOT_BOT_MARKET_CHANNEL_ID`) configured by the server administrator to broadcast notification announcements.

## 3. Data Storage & Security
- Public market inventory data is synchronized and stored in our secure, encrypted database (Turso/libSQL).
- Notification outbox logs record public card restock announcements and message broadcast status (`messageId`, `sentAt`).
- No personally identifiable information (PII) is stored or tracked.

## 4. Third-Party Services
- **Root Platform**: Operates subject to Root's Terms of Service and Privacy Policy.
- **Turso / libSQL**: Database provider used for persistence of public marketplace inventory state.

## 5. Permissions
The Bot requires only standard permissions to:
- Post messages in the specific channels configured by the community administrator.

## 6. Contact & Inquiries
For questions, data requests, or support regarding the Bot:
- Repository: [https://github.com/PedroFabrino/ga-tcg-binder](https://github.com/PedroFabrino/ga-tcg-binder)
- Developer: Pedro Fabrino (`pfabrino@gmail.com`)
