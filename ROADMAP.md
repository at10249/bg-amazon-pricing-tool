# BG Amazon Pricing Tool — Roadmap

This file tracks planned improvements and feature ideas. Pull requests welcome.
Items within each section are roughly prioritised top-to-bottom.

---

## In Progress / Recently Shipped

- [x] FBA fee calculator with 2026 price bands and fuel surcharge
- [x] m19 advertising stage tracker (PRE_LAUNCH → STABLE)
- [x] Bilingual UI (EN / ZH)
- [x] CSV import: Amazon Business Report + Advertising Report
- [x] FBA Fee Preview import to bulk-create product entries
- [x] Hover tooltips on all key fields (Amazon definitions + source links)
- [x] Dimension auto-calculator → size tier auto-selection
- [x] Flow guide modal + pricing rules quick reference
- [x] Coupon cost calculator (flat fee + % of attributed sales)
- [x] Kill signal alerts (ACoS runaway, stale stage, no sales)

---

## Near-Term (next 1–3 sprints)

### Mobile Responsiveness
- Responsive layout: collapse sidebar to a bottom nav or hamburger drawer on screens < 640px
- Stack `.g2` / `.g3` form grids to single column on mobile
- Make the product modal full-screen on mobile with sticky footer buttons
- Ensure the stage timeline scrolls horizontally rather than overflowing
- Minimum 44px tap targets throughout

### UX / Polish
- Keyboard shortcut to open Add Product modal (`N`)
- Tab focus management in modals (trap focus, close on Escape)
- Undo last check-in action (soft delete with restore)
- Drag-to-reorder products in sidebar
- Bulk-select and bulk-archive products
- Dark/light mode toggle

### Calculator Improvements
- Show all three price points (Your Price / Sale / Coupon) side-by-side in one view
- Sensitivity table: how margin changes across ±$2 price range
- "What-if" mode: lock target margin, solve for required COGS to hit a given price
- Break-even units/month calculator (fixed overheads ÷ contribution margin)
- Landed cost calculator: CNY unit price → USD landed cost with duty rate input

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
- Auto-pull FBA inventory levels and days of cover
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
- No input validation on CSV import (malformed rows silently skipped)
- FBA fee tables are hardcoded — need a mechanism to update when Amazon changes rates
- No unit tests; business logic (fee solver, stage graduation) should be tested
- Single `index.html` file — split into modules when adding build step
