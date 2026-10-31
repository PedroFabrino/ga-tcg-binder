import sharp from "sharp";
import fs from "fs";
import path from "path";

// Color palette
const BG = "#0a0f18";
const CARD_BG = "#111827";
const CARD_BORDER = "#1f293d";
const TEXT_MUTED = "#94a3b8";
const TEXT_WHITE = "#ffffff";
const INDIGO = "#6366f1";
const PURPLE = "#a855f7";
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const ROSE = "#f43f5e";

interface CardSectionConfig {
  title: string;
  badge: string;
  badgeColor: string;
  badgeBg: string;
  subtitle: string;
  bodySvg: string;
  height: number;
}

function makeCardSvg(cfg: CardSectionConfig): string {
  return `
    <rect x="0" y="0" width="860" height="${cfg.height}" rx="14" fill="${CARD_BG}" stroke="${CARD_BORDER}" stroke-width="1.5"/>
    <!-- Header -->
    <text x="32" y="46" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="20" font-weight="700" fill="${TEXT_WHITE}">${cfg.title}</text>
    <rect x="710" y="26" width="120" height="26" rx="6" fill="${cfg.badgeBg}"/>
    <text x="770" y="43" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="11" font-weight="600" fill="${cfg.badgeColor}">${cfg.badge}</text>
    <text x="32" y="74" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="13" fill="${TEXT_MUTED}">${cfg.subtitle}</text>
    <line x1="32" y1="92" x2="828" y2="92" stroke="${CARD_BORDER}" stroke-width="1"/>
    ${cfg.bodySvg}
  `;
}

function buildScreenshotSvg(title: string, tag: string, desc: string, cardCfg: CardSectionConfig): Buffer {
  const cardContent = makeCardSvg(cardCfg);
  const fullSvg = `
  <svg width="1376" height="768" viewBox="0 0 1376 768" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0b1120"/>
        <stop offset="50%" stop-color="#070b14"/>
        <stop offset="100%" stop-color="#05080f"/>
      </linearGradient>
      <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#4f46e5" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#9333ea" stop-opacity="0.1"/>
      </linearGradient>
      <filter id="shadow" x="-5%" y="-5%" width="110%" height="115%">
        <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000000" flood-opacity="0.6"/>
      </filter>
    </defs>

    <!-- Canvas Background -->
    <rect width="1376" height="768" fill="url(#bgGrad)"/>
    <circle cx="200" cy="150" r="320" fill="url(#glow)"/>
    <circle cx="1150" cy="600" r="280" fill="url(#glow)"/>

    <!-- Left Hero Sidebar Info -->
    <g transform="translate(64, 90)">
      <!-- App Identity Badge -->
      <rect x="0" y="0" width="180" height="32" rx="16" fill="rgba(99, 102, 241, 0.15)" stroke="rgba(99, 102, 241, 0.4)" stroke-width="1"/>
      <text x="90" y="21" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#a5b4fc" letter-spacing="1">GRAND ARCHIVE TCG</text>

      <text x="0" y="80" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="800" fill="#ffffff" letter-spacing="-0.5">${title}</text>
      
      <rect x="0" y="105" width="80" height="4" rx="2" fill="${INDIGO}"/>

      <!-- Subtitle &amp; highlights -->
      <text x="0" y="145" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="500" fill="#cbd5e1" width="320">
        <tspan x="0" dy="0">${tag}</tspan>
      </text>

      <foreignObject x="0" y="175" width="340" height="340">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #94a3b8; line-height: 1.6;">
          ${desc}
        </div>
      </foreignObject>

      <!-- Watermark / Footer branding -->
      <g transform="translate(0, 520)">
        <rect x="0" y="0" width="40" height="40" rx="10" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)"/>
        <text x="20" y="26" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#ffffff">🗃️</text>
        <text x="52" y="20" font-family="sans-serif" font-size="13" font-weight="700" fill="#f8fafc">GA Collector Assistant</text>
        <text x="52" y="36" font-family="sans-serif" font-size="11" fill="#64748b">Root Platform • MyP Integration</text>
      </g>
    </g>

    <!-- Main Live App Component View (Right) -->
    <g transform="translate(450, 80)" filter="url(#shadow)">
      ${cardContent}
    </g>
  </svg>
  `;
  return Buffer.from(fullSvg);
}

// 1. Decks &amp; Shortages Dashboard
const decksCard: CardSectionConfig = {
  title: "Constructed Decks &amp; Shortages",
  badge: "3 ACTIVE DECKS",
  badgeColor: "#818cf8",
  badgeBg: "rgba(99, 102, 241, 0.15)",
  subtitle: "Live inventory tracking across your active decks with Hard vs. Shared categorization",
  height: 600,
  bodySvg: `
    <!-- Deck 1 -->
    <g transform="translate(32, 115)">
      <rect x="0" y="0" width="796" height="135" rx="10" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="20" y="32" font-family="sans-serif" font-size="17" font-weight="700" fill="#f8fafc">Fire Crux Merlin</text>
      <text x="20" y="54" font-family="sans-serif" font-size="12" fill="#94a3b8">Champion: Merlin, Kingslayer • 60 Cards</text>
      
      <rect x="670" y="16" width="105" height="24" rx="6" fill="rgba(244, 63, 94, 0.15)"/>
      <text x="722" y="32" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="700" fill="#fb7185">4 HARD MISSING</text>

      <rect x="20" y="75" width="220" height="42" rx="6" fill="#0f172a"/>
      <text x="32" y="93" font-family="sans-serif" font-size="11" fill="#64748b">HARD SHORTAGES (BUY)</text>
      <text x="32" y="109" font-family="sans-serif" font-size="12" font-weight="600" fill="#fda4af">4x Creative Shock</text>

      <rect x="255" y="75" width="240" height="42" rx="6" fill="#0f172a"/>
      <text x="267" y="93" font-family="sans-serif" font-size="11" fill="#64748b">SHARED SHORTAGES (ROTATE)</text>
      <text x="267" y="109" font-family="sans-serif" font-size="12" font-weight="600" fill="#fde047">2x Quietus Blade (from Tristan)</text>
    </g>

    <!-- Deck 2 -->
    <g transform="translate(32, 268)">
      <rect x="0" y="0" width="796" height="135" rx="10" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="20" y="32" font-family="sans-serif" font-size="17" font-weight="700" fill="#f8fafc">Wind Umbra Tristan</text>
      <text x="20" y="54" font-family="sans-serif" font-size="12" fill="#94a3b8">Champion: Tristan, Shadowdancer • 60 Cards</text>
      
      <rect x="670" y="16" width="105" height="24" rx="6" fill="rgba(16, 185, 129, 0.15)"/>
      <text x="722" y="32" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="700" fill="#34d399">100% COMPLETE</text>

      <rect x="20" y="75" width="756" height="42" rx="6" fill="#0f172a"/>
      <text x="32" y="101" font-family="sans-serif" font-size="13" font-weight="500" fill="#34d399">✓ All cards in this deck are owned with dedicated copies. Ready to play!</text>
    </g>

    <!-- Deck 3 -->
    <g transform="translate(32, 421)">
      <rect x="0" y="0" width="796" height="135" rx="10" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="20" y="32" font-family="sans-serif" font-size="17" font-weight="700" fill="#f8fafc">Water Fractals Diao Chan</text>
      <text x="20" y="54" font-family="sans-serif" font-size="12" fill="#94a3b8">Champion: Diao Chan, Dreaming Wish • 60 Cards</text>

      <rect x="670" y="16" width="105" height="24" rx="6" fill="rgba(245, 158, 11, 0.15)"/>
      <text x="722" y="32" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="700" fill="#fbbf24">3 SHARED</text>

      <rect x="20" y="75" width="756" height="42" rx="6" fill="#0f172a"/>
      <text x="32" y="93" font-family="sans-serif" font-size="11" fill="#64748b">REVEZAMENTO ENTRE DECKS</text>
      <text x="32" y="109" font-family="sans-serif" font-size="12" font-weight="600" fill="#fde047">3x Shimmering Refraction (Deck Silvie)</text>
    </g>
  `
};

// 2. Market Deal Alerts
const dealAlertsCard: CardSectionConfig = {
  title: "Automated Market Deal Alerts",
  badge: "BRAZILIAN MARKET (MyP)",
  badgeColor: "#34d399",
  badgeBg: "rgba(16, 185, 129, 0.15)",
  subtitle: "Receive real-time notifications when needed cards are listed at or below market value",
  height: 570,
  bodySvg: `
    <!-- Scope Selection Switcher -->
    <g transform="translate(32, 120)">
      <text x="0" y="0" font-family="sans-serif" font-size="14" font-weight="600" fill="#ffffff">Alert Scope Preference</text>
      
      <!-- Option 1 Active -->
      <rect x="0" y="16" width="385" height="100" rx="8" fill="#1e293b" stroke="#6366f1" stroke-width="2"/>
      <circle cx="26" cy="42" r="7" fill="#6366f1"/>
      <circle cx="26" cy="42" r="3" fill="#ffffff"/>
      <text x="44" y="47" font-family="sans-serif" font-size="15" font-weight="700" fill="#ffffff">All Shortages</text>
      <text x="44" y="70" font-family="sans-serif" font-size="12" fill="#94a3b8">Hard shortages + shared deck rotations</text>
      <text x="44" y="88" font-family="sans-serif" font-size="12" fill="#94a3b8">+ personal collector wantlist</text>

      <!-- Option 2 -->
      <rect x="410" y="16" width="385" height="100" rx="8" fill="#0f172a" stroke="#334155" stroke-width="1"/>
      <circle cx="436" cy="42" r="7" fill="none" stroke="#64748b" stroke-width="2"/>
      <text x="454" y="47" font-family="sans-serif" font-size="15" font-weight="700" fill="#cbd5e1">Hard Shortages Only</text>
      <text x="454" y="70" font-family="sans-serif" font-size="12" fill="#64748b">Only unowned cards you need to buy</text>
      <text x="454" y="88" font-family="sans-serif" font-size="12" fill="#64748b">+ personal wantlist</text>
    </g>

    <!-- Channel routing box -->
    <g transform="translate(32, 270)">
      <rect x="0" y="0" width="796" height="56" rx="8" fill="#0f172a" stroke="#334155" stroke-width="1"/>
      <text x="20" y="33" font-family="sans-serif" font-size="13" fill="#94a3b8">Delivering alerts to your private thread:</text>
      <rect x="290" y="16" width="160" height="25" rx="5" fill="rgba(99, 102, 241, 0.2)"/>
      <text x="370" y="33" text-anchor="middle" font-family="monospace" font-size="12" font-weight="600" fill="#a5b4fc">#alerts-pedro</text>
    </g>

    <!-- Recent Deal Ping Sample -->
    <g transform="translate(32, 355)">
      <text x="0" y="0" font-family="sans-serif" font-size="13" font-weight="700" fill="#64748b" letter-spacing="1">SAMPLE BOT NOTIFICATION (DISPATCHED DIRECTLY TO YOU)</text>
      <rect x="0" y="14" width="796" height="130" rx="8" fill="#1e1e2e" stroke="#4338ca" stroke-width="1.5"/>
      <circle cx="30" cy="40" r="14" fill="#4338ca"/>
      <text x="30" y="45" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#ffffff">🔥</text>
      <text x="56" y="38" font-family="sans-serif" font-size="15" font-weight="700" fill="#ffffff">Market Deal Found: Creative Shock (DOp 1st)</text>
      <text x="56" y="58" font-family="sans-serif" font-size="12" fill="#a5b4fc">Targeted for: Fire Crux Merlin (Hard Shortage)</text>

      <line x1="20" y1="74" x2="776" y2="74" stroke="#2e2e42" stroke-width="1"/>

      <text x="30" y="102" font-family="sans-serif" font-size="13" fill="#94a3b8">Listed by Store: <tspan fill="#f8fafc" font-weight="600">Cards Brasil TCG</tspan></text>
      <text x="320" y="102" font-family="sans-serif" font-size="13" fill="#94a3b8">Listing Price: <tspan fill="#34d399" font-weight="700">R$ 18,50</tspan></text>
      <text x="540" y="102" font-family="sans-serif" font-size="13" fill="#94a3b8">Benchmark Avg: <tspan fill="#94a3b8" text-decoration="line-through">R$ 28,00</tspan> (-34%)</text>
    </g>
  `
};

// 3. Wantlist &amp; Omnidex Gap Import
const wantlistCard: CardSectionConfig = {
  title: "Personal Wantlist &amp; Omnidex Gap Import",
  badge: "SYNCED WITH WEB",
  badgeColor: "#c084fc",
  badgeBg: "rgba(168, 85, 247, 0.15)",
  subtitle: "Track custom acquisition targets with Foil / Normal filters and one-click Omnidex imports",
  height: 560,
  bodySvg: `
    <!-- Top summary bar -->
    <g transform="translate(32, 115)">
      <rect x="0" y="0" width="796" height="60" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="24" y="36" font-family="sans-serif" font-size="14" font-weight="600" fill="#ffffff">Paste Omnidex Decklist URL or Gap Code</text>
      <rect x="635" y="15" width="140" height="30" rx="6" fill="#6366f1"/>
      <text x="705" y="35" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="700" fill="#ffffff">+ Import Shortages</text>
    </g>

    <!-- Table of wanted cards -->
    <g transform="translate(32, 195)">
      <!-- Header row -->
      <rect x="0" y="0" width="796" height="32" rx="4" fill="#0f172a"/>
      <text x="20" y="21" font-family="sans-serif" font-size="11" font-weight="700" fill="#64748b">CARD NAME</text>
      <text x="320" y="21" font-family="sans-serif" font-size="11" font-weight="700" fill="#64748b">FINISH</text>
      <text x="460" y="21" font-family="sans-serif" font-size="11" font-weight="700" fill="#64748b">QTY NEEDED</text>
      <text x="640" y="21" font-family="sans-serif" font-size="11" font-weight="700" fill="#64748b">MAX TARGET (BRL)</text>

      <!-- Row 1 -->
      <g transform="translate(0, 42)">
        <rect x="0" y="0" width="796" height="50" rx="6" fill="#1e293b"/>
        <text x="20" y="30" font-family="sans-serif" font-size="14" font-weight="600" fill="#ffffff">Grand Crusader's Ring</text>
        <rect x="315" y="14" width="60" height="22" rx="4" fill="rgba(245, 158, 11, 0.2)"/>
        <text x="345" y="29" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="700" fill="#fbbf24">FOIL</text>
        <text x="490" y="30" font-family="sans-serif" font-size="14" font-weight="700" fill="#cbd5e1">1x</text>
        <text x="660" y="30" font-family="sans-serif" font-size="14" font-weight="700" fill="#34d399">R$ 150,00</text>
      </g>

      <!-- Row 2 -->
      <g transform="translate(0, 102)">
        <rect x="0" y="0" width="796" height="50" rx="6" fill="#1e293b"/>
        <text x="20" y="30" font-family="sans-serif" font-size="14" font-weight="600" fill="#ffffff">Blaze Alight</text>
        <rect x="315" y="14" width="60" height="22" rx="4" fill="rgba(148, 163, 184, 0.2)"/>
        <text x="345" y="29" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="700" fill="#cbd5e1">NORMAL</text>
        <text x="490" y="30" font-family="sans-serif" font-size="14" font-weight="700" fill="#cbd5e1">2x</text>
        <text x="660" y="30" font-family="sans-serif" font-size="14" font-weight="700" fill="#34d399">R$ 25,00</text>
      </g>

      <!-- Row 3 -->
      <g transform="translate(0, 162)">
        <rect x="0" y="0" width="796" height="50" rx="6" fill="#1e293b"/>
        <text x="20" y="30" font-family="sans-serif" font-size="14" font-weight="600" fill="#ffffff">Pyretic Prognosis</text>
        <rect x="315" y="14" width="60" height="22" rx="4" fill="rgba(148, 163, 184, 0.2)"/>
        <text x="345" y="29" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="700" fill="#cbd5e1">NORMAL</text>
        <text x="490" y="30" font-family="sans-serif" font-size="14" font-weight="700" fill="#cbd5e1">2x</text>
        <text x="660" y="30" font-family="sans-serif" font-size="14" font-weight="700" fill="#34d399">R$ 35,00</text>
      </g>

      <!-- Row 4 -->
      <g transform="translate(0, 222)">
        <rect x="0" y="0" width="796" height="50" rx="6" fill="#1e293b"/>
        <text x="20" y="30" font-family="sans-serif" font-size="14" font-weight="600" fill="#ffffff">Imperial Countermeasure</text>
        <rect x="315" y="14" width="60" height="22" rx="4" fill="rgba(148, 163, 184, 0.2)"/>
        <text x="345" y="29" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="700" fill="#cbd5e1">NORMAL</text>
        <text x="490" y="30" font-family="sans-serif" font-size="14" font-weight="700" fill="#cbd5e1">2x</text>
        <text x="660" y="30" font-family="sans-serif" font-size="14" font-weight="700" fill="#34d399">R$ 15,00</text>
      </g>
    </g>
  `
};

// 4. Community Admin &amp; Pairing
const adminAndPairingCard: CardSectionConfig = {
  title: "Community Market Channel &amp; Pairing",
  badge: "ADMINISTRATOR TOOLS",
  badgeColor: "#fbbf24",
  badgeBg: "rgba(245, 158, 11, 0.15)",
  subtitle: "Configure community broadcast channels and manage collector account link status",
  height: 570,
  bodySvg: `
    <!-- Account Link Status Bar -->
    <g transform="translate(32, 115)">
      <rect x="0" y="0" width="796" height="74" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <circle cx="36" cy="37" r="16" fill="rgba(16, 185, 129, 0.2)"/>
      <text x="36" y="42" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#34d399">✓</text>
      <text x="68" y="31" font-family="sans-serif" font-size="15" font-weight="700" fill="#ffffff">Collector Connected: Pedro Fabrino</text>
      <text x="68" y="52" font-family="sans-serif" font-size="12" fill="#94a3b8">Friend Code: GA-89C4D • Synchronized with web binder</text>

      <rect x="670" y="22" width="105" height="30" rx="6" fill="#0f172a" stroke="#334155" stroke-width="1"/>
      <text x="722" y="41" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="600" fill="#cbd5e1">Manage Link</text>
    </g>

    <!-- Admin Channel Control -->
    <g transform="translate(32, 210)">
      <text x="0" y="0" font-family="sans-serif" font-size="14" font-weight="700" fill="#ffffff">Market Broadcast Dump Channel</text>
      <text x="0" y="20" font-family="sans-serif" font-size="12" fill="#94a3b8">Select the channel where public marketplace listings are published</text>

      <g transform="translate(0, 35)">
        <rect x="0" y="0" width="530" height="44" rx="8" fill="#0f172a" stroke="#4338ca" stroke-width="1.5"/>
        <text x="20" y="27" font-family="sans-serif" font-size="13" font-weight="600" fill="#ffffff">📁 GA Market &gt; #market-feed (Active)</text>

        <rect x="545" y="0" width="251" height="44" rx="8" fill="#10b981"/>
        <text x="670" y="27" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="#ffffff">⚡ Provision Channels</text>
      </g>
    </g>

    <!-- Broadcast Language selector -->
    <g transform="translate(32, 335)">
      <text x="0" y="0" font-family="sans-serif" font-size="13" font-weight="600" fill="#94a3b8">Community Broadcast Language</text>
      <g transform="translate(0, 15)">
        <rect x="0" y="0" width="180" height="38" rx="8" fill="#1e293b" stroke="#6366f1" stroke-width="1.5"/>
        <text x="90" y="24" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="#ffffff">Português (pt-BR)</text>

        <rect x="195" y="0" width="180" height="38" rx="8" fill="#0f172a" stroke="#334155" stroke-width="1"/>
        <text x="285" y="24" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="500" fill="#64748b">English (en)</text>
      </g>
    </g>

    <!-- Info box -->
    <g transform="translate(32, 435)">
      <rect x="0" y="0" width="796" height="85" rx="8" fill="rgba(245, 158, 11, 0.1)" stroke="rgba(245, 158, 11, 0.3)" stroke-width="1"/>
      <text x="24" y="28" font-family="sans-serif" font-size="13" font-weight="700" fill="#fbbf24">Notice for Server Administrators</text>
      <text x="24" y="50" font-family="sans-serif" font-size="12" fill="#cbd5e1">Clicking "Provision Channels" automatically creates the GA Market channel group, adds the</text>
      <text x="24" y="68" font-family="sans-serif" font-size="12" fill="#cbd5e1">#market text broadcast channel, and sets up the in-channel assistant dashboard.</text>
    </g>
  `
};

async function main() {
  const assetsDir = path.join(process.cwd(), "apps/ga-tcg-root-app/assets");
  const artDir = "C:/Users/pfabr/.gemini/antigravity/brain/6d1f6dd8-b972-491d-98b7-c55549f0cf42";

  console.log("Generating high-resolution screenshots for gallery...");

  // 1. Decks &amp; Shortages
  const buf1 = buildScreenshotSvg(
    "DECK SHORTAGES",
    "Live Inventory &amp; Shortage Computation",
    "Track your active constructed decks in real time. Automatically distinguishes between <b style='color:#fda4af;'>Hard Shortages</b> (unowned cards you must purchase) and <b style='color:#fde047;'>Shared Shortages</b> (cards already owned in other active decks to rotate between games).",
    decksCard
  );
  await sharp(buf1).jpeg({ quality: 95 }).toFile(path.join(assetsDir, "screenshot-decks.jpg"));
  await sharp(buf1).png().toFile(path.join(assetsDir, "screenshot-decks.png"));
  await sharp(buf1).png().toFile(path.join(artDir, "screenshot-decks.png"));
  console.log("✓ Created screenshot-decks (1376x768)");

  // 2. Deal Alerts
  const buf2 = buildScreenshotSvg(
    "MARKET ALERTS",
    "Automated Singles Deal Notifier",
    "Get private real-time pings the moment missing cards are listed on the marketplace below market value.<br/><br/><i style='color:#34d399;'>Exclusive to the Brazilian market (MyP).</i> Choose between receiving alerts for all shortages or strictly unowned cards.",
    dealAlertsCard
  );
  await sharp(buf2).jpeg({ quality: 95 }).toFile(path.join(assetsDir, "screenshot-deal-alerts.jpg"));
  await sharp(buf2).png().toFile(path.join(assetsDir, "screenshot-deal-alerts.png"));
  await sharp(buf2).png().toFile(path.join(artDir, "screenshot-deal-alerts.png"));
  console.log("✓ Created screenshot-deal-alerts (1376x768)");

  // 3. Wantlist &amp; Omnidex
  const buf3 = buildScreenshotSvg(
    "WANTLIST &amp; SYNC",
    "Collector Wishlist &amp; Omnidex Gaps",
    "Manage your acquisition wishlist with precision finish filtering (<b style='color:#fbbf24;'>Foil</b> vs. <b style='color:#cbd5e1;'>Normal</b>) and custom target prices in BRL.<br/><br/>One-click import turns any public Omnidex decklist or missing card gap directly into tracking items.",
    wantlistCard
  );
  await sharp(buf3).jpeg({ quality: 95 }).toFile(path.join(assetsDir, "screenshot-wantlist.jpg"));
  await sharp(buf3).png().toFile(path.join(assetsDir, "screenshot-wantlist.png"));
  await sharp(buf3).png().toFile(path.join(artDir, "screenshot-wantlist.png"));
  console.log("✓ Created screenshot-wantlist (1376x768)");

  // 4. Admin &amp; Pairing
  const buf4 = buildScreenshotSvg(
    "COMMUNITY SETUP",
    "1-Click Provisioning &amp; Account Pairing",
    "Zero-friction onboarding: new players can click <b style='color:#a5b4fc;'>Register with Root</b> to start immediately, or pair existing web accounts using a 6-digit code.<br/><br/>Community admins can select broadcast channels or provision the entire channel structure with a single click.",
    adminAndPairingCard
  );
  await sharp(buf4).jpeg({ quality: 95 }).toFile(path.join(assetsDir, "screenshot-admin-setup.jpg"));
  await sharp(buf4).png().toFile(path.join(assetsDir, "screenshot-admin-setup.png"));
  await sharp(buf4).png().toFile(path.join(artDir, "screenshot-admin-setup.png"));
  console.log("✓ Created screenshot-admin-setup (1376x768)");

  console.log("All screenshots generated and synchronized successfully!");
}

main().catch(console.error);
