# Basecamp KOL Management Platform

## Current Session Context (Jan 28, 2026)

### Critical Issues Being Fixed

1. **KOL Roster Total Paid** - Should tally ALL payments from ALL KOLs' payment tabs (with proof/receipts), not just COMPLETED status payments

2. **Payments Tab Count Stuck at 0** - The count next to "Payments" tab in KOL profiles shows (0) even when payments exist. Need to ensure `paymentsCount` is returned correctly from API.

3. **Total Earnings Consolidation** - Remove redundant "total" line at bottom of KOL profile. The total earnings should only appear in the top right section.

4. **Telegram Bot** - FIXED and working. Webhook registered at `https://admin.basecampnetwork.xyz/api/telegram/webhook`

### Key Files

- `/src/app/api/kols/route.ts` - KOL roster API, calculates totalEarnings from payments
- `/src/app/api/kols/[id]/route.ts` - Individual KOL API, returns totalEarnings and paymentsCount
- `/src/app/(admin)/kols/[id]/page.tsx` - KOL profile page, displays payments and earnings
- `/src/components/agency/kol-table.tsx` - KOL roster table component
- `/src/app/(admin)/dashboard/page.tsx` - Dashboard with financial summary

### Payment/Earnings Logic

- Payments are stored in `Payment` model with status: PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED
- Payment receipts are in `PaymentReceipt` model (KOL-submitted proof via Telegram)
- `totalEarnings` should include both Payment records AND PaymentReceipt records
- The roster's "Total Paid" should sum all payments/receipts across all KOLs

### Deployment

- GitHub: ADOrganization/basecamp-kol
- Production: admin.basecampnetwork.xyz (Vercel)
- Deploy: `vercel --prod --yes && vercel alias set <deployment> admin.basecampnetwork.xyz`

### Recent Fixes Applied

- Redirect loop fixed (redirect to /admin/login instead of /login)
- Telegram webhook self-healing added
- Dashboard metrics diversified (8 metrics now shown)
- Production URL hardcoded for webhook registration
