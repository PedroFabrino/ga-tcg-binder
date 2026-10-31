# Privacy Policy for Grand Archive Collector Assistant & GA TCG Binder

*Last updated: October 30, 2026*

## 1. Overview
Grand Archive Collector Assistant ("the App", "GA TCG Binder", "we", "our") is a companion tool, marketplace notifier, and deck shortage tracking suite developed for Grand Archive TCG players, collectors, and communities across the web application and the Root platform.

The App provides interactive deck inventory management, collection tracking, personal wantlists, automated market deal notifications, and community marketplace broadcast updates.

## 2. Information We Collect and Process

### A. Root App GUI & Cloud Service
- **Root Profile Information**: When you register or link using your Root profile (`Register with Root`), we receive your public Root username and unique Root user identifier to pair your session with your GA Binder account.
- **Account Pairing**: If you link an existing account using a 6-character code from the web portal, we link your Root user ID to your existing collector profile.
- **User Preferences**: We store your selected notification preferences (e.g., whether Deal Alerts are enabled, alert scope mode: *All Shortages* vs. *Hard Shortages Only*, and preferred UI language `en` / `pt-BR`).
- **Community Channel Configurations**: For community administrators, we store the channel IDs and channel group IDs selected to receive public market broadcast updates and private notification threads.
- **We DO NOT collect or read**: Private chat messages, voice communications, or passwords from your Root account. The Root App operates strictly via graphical user interface (GUI) and dedicated RPC endpoints.

### B. Deck and Collection Data
- Decks imported (via URL or deck text), card quantities, wishlists (Wantlists), and shortage lists are processed and stored to calculate card shortages and trigger relevant deal alerts.

### C. Public Marketplace Data
- The App periodically synchronizes public singles pricing, availability, and seller listings from public marketplace feeds (currently exclusive to the Brazilian market via MyP). This data is public store data and contains no buyer personal information.

## 3. Data Storage & Security
- All user data and synchronized collection data are securely stored in an encrypted database (Turso / libSQL).
- Ephemeral pairing codes expire automatically after 10 minutes.
- The Root cloud bot is secret-free: it holds no database credentials and connects securely to the backend via signed, authenticated RPC endpoints.

## 4. Regional Marketplace Limitations
- Marketplace deal alert notifications, price scraping, and market broadcast updates are currently exclusive to the **Brazilian market** (singles listed via MyP). Decks, shortages, and collection tracking features function globally for all players regardless of region.

## 5. Third-Party Services
- **Root Platform**: The in-community app runs on Root's platform and complies with Root's platform policies and terms.
- **Turso / libSQL**: Database provider used for encrypted data persistence.
- **NextAuth.js**: Authentication provider for web portal user accounts.

## 6. Data Retention & Deletion
Users may unlink their Root account from GA TCG Binder at any time through the app interface or request complete deletion of their account data by contacting the developer.

## 7. Contact & Inquiries
For questions, data requests, or support regarding this privacy policy or the application:
- **Repository**: [https://github.com/PedroFabrino/ga-tcg-binder](https://github.com/PedroFabrino/ga-tcg-binder)
- **Developer**: Pedro Fabrino (`pfabrino@gmail.com`)
