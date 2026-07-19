# BG Amazon Pricing Tool — Roadmap

This file tracks planned improvements and feature ideas. Pull requests welcome.
Items within each section are roughly prioritised top-to-bottom.

---

## In Progress / Recently Shipped

- [x] FBA fee calculator with 2026 price bands and fuel surcharge
- [x] m19 advertising stage tracker (PRE_LAUNCH → STABLE)
- [x] Bilingual UI (EN / ZH)
- [x] CSV import: Amazon Business Report + Advertising Report + Inventory Report
- [x] FBA Fee Preview import to bulk-create product entries
- [x] Hover tooltips on all key fields (Amazon definitions + source links)
- [x] Dimension auto-calculator → size tier auto-selection
- [x] Flow guide modal + pricing rules quick reference
- [x] Coupon cost calculator (flat fee + % of attributed sales)
- [x] Kill signal alerts (ACoS runaway, stale stage, no sales)
- [x] Mobile responsiveness (< 640px): hamburger drawer sidebar, single-column form grids, full-screen product modal with sticky footer, horizontally scrollable stage timeline, 44px tap targets *(shipped 2026-07-07)*
- [x] Keyboard shortcut `N` to open Add Product modal *(shipped 2026-07-07)*
- [x] Modal focus management: focus trap, close on Escape, focus returns to trigger *(shipped 2026-07-07)*
- [x] Undo last check-in action (soft delete with 8s Undo toast, also on add) *(shipped 2026-07-07)*
- [x] Sensitivity table: margin across ±$2 price range with per-row fee recompute *(shipped 2026-07-07)*
- [x] Break-even units/month calculator (fixed overheads ÷ contribution margin) *(shipped 2026-07-07)*
- [x] Landed cost calculator: CNY unit price → USD landed cost with duty rate input, feeds COGS *(shipped 2026-07-07)*
- [x] Dark/light mode toggle (CSS variable palette swap, persisted, follows OS on first visit) *(shipped 2026-07-07, round 2)*
- [x] "What-if" mode: lock target margin, solve for required COGS to hit a given price (and the reverse: min price from COGS) *(shipped 2026-07-07, round 2)*
- [x] Side-by-side tier comparison view: List / Your Price / Sale / Clearance with per-tier profit $ and margin % *(shipped 2026-07-07, round 2)*
- [x] Fee waterfall breakdown: price → fees → net margin as labelled CSS bars *(shipped 2026-07-07, round 2)*
- [x] CSV import validation report: per-row errors (field + reason) instead of silent skips *(shipped 2026-07-07, round 2)*
- [x] Plain-language kill-signal explanations with actual numbers + RULE thresholds *(shipped 2026-07-07, round 2)*
- [x] Sidebar product search/filter by name or ASIN *(shipped 2026-07-07, round 2)*
- [x] Sample product badged + one-click removable in the empty state *(shipped 2026-07-07, round 2)*
- [x] Auto-backup nudge: Export JSON reminder after 30 days without a backup *(shipped 2026-07-07, round 2)*
- [x] Versioned FBA fee schedule: dated `FEE_SCHEDULE` block, rate updates are one block swap *(shipped 2026-07-07, round 2)*
- [x] Inventory & sales velocity tracking in weekly check-ins (units in stock, units sold,
      days of cover, stockout/reorder/overstock badges) — manual entry or CSV import *(shipped 2026-07-20)*
- [x] Amazon size-tier string mapping fixed for real export formats (camelCase-concatenated
      strings like `UsLargeStandardSize`, and "Bulky" tier terminology) *(shipped 2026-07-20)*

---

## Near-Term (next 1–3 sprints)

### UX / Polish
- Drag-to-reorder products in sidebar
- Bulk-select and bulk-archive products

### Calculator Improvements
- Coupon price point shown inside the tier comparison table

---

## Medium-Term

### Cloud Storage & Sync
- Replace `localStorage` with a real backend (Cloudflare D1 + Workers or Supabase)
- User accounts with email/password or Google OAuth
- Data persists across devices and browsers
- Export all data to JSON or CSV for backup / migration

### Amazon SP-API Integration (Real-Time Data)
- Connect to Amazon Selling Partner API (SP-API) via OAuth
- Auto-pull live listing price, BSR, review count per ASIN
- Auto-pull FBA inventory levels and days of cover directly, without a manual weekly CSV
  export/import (inventory levels + computed days of cover already work today via the
  Inventory Report import — this item is only about replacing the manual export step)
- Detect price changes made outside this tool and flag discrepancies
- Pull actual FBA fee estimates from `getMyFeesEstimate` endpoint

### Advertising API Integration
- Connect to Amazon Advertising API
- Auto-fill ACoS, spend, ad sales from live campaign data (no CSV export needed)
- Surface top-10 keywords by spend per ASIN
- Flag campaigns with ACoS > break-even

### Multi-Marketplace Support
- Currently US-only fee tables; add UK, DE, FR, IT, ES, CA, JP, AU
- Marketplace selector per product (not per account)
- VAT handling for EU marketplaces
- Currency conversion with configurable exchange rates

---

## Longer-Term / Strategic

### Team & Multi-User
- Shared workspaces: multiple users on the same product catalogue
- Role-based access: read-only analyst vs. pricing manager
- Change log: who changed what price and when
- Comment threads on products / check-ins

### Analytics & Reporting
- Portfolio-level P&L dashboard: blended margin, total ad spend, total revenue
- TACoS trend chart per product (30/60/90-day rolling)
- Stage progression report: average days per stage across all products
- Cohort analysis: products launched same month vs. current health
- Exportable PDF / Google Sheets report

### Pricing Automation
- Rule-based auto-price: "if ACoS > X for 7 days, drop price by $Y"
- Integration with repricers (Sellics, BQool, Informed.co) via webhook
- Scheduled price changes (go on sale Friday, revert Sunday)
- Prime Day / BFCM price playbook automation

### Competitor Intelligence
- Track competitor ASINs: price, BSR, review count over time
- Alert when a competitor drops below your price by > $X
- Buy Box win rate tracking (requires SP-API)

### Supplier / COGS Management
- Multiple COGS scenarios per product (current supplier vs. alternative quote)
- Currency-aware COGS: enter in CNY, convert at live rate
- COGS history log: track cost changes and their margin impact
- Inbound shipment tracker: link shipments to products, track landed cost per batch

### Notifications & Alerts
- Email / Slack alerts for kill signals, stage graduation criteria met
- Weekly digest: products needing attention, stage changes this week
- Price alert: notify when your listing price is suppressed by Amazon

---

## Known Issues / Tech Debt

- All state is `localStorage` only — clearing browser storage loses all data
  *(mitigated 2026-07-07: auto-backup nudge prompts a JSON export after 30 days)*
- ~~No input validation on CSV import (malformed rows silently skipped)~~
  Fixed 2026-07-07: rows are validated (`validateCSVRow`) and skipped rows are
  reported per-row with field + reason
- ~~FBA fee tables are hardcoded — need a mechanism to update when Amazon changes rates~~
  Fixed 2026-07-07: all fee numbers live in one dated `FEE_SCHEDULE` block —
  updates are a single block swap (LOGIC.md §1.4)
- ~~No unit tests~~ `test.js` covers fee tables, price solver, inverse solver,
  kill signals + explanations, CSV validation, waterfall, backup nudge,
  sensitivity/break-even/landed-cost calculators, inventory status, and Amazon
  size-tier mapping (332 tests — run with `npm test`)
- Single `index.html` file — split into modules when adding build step
