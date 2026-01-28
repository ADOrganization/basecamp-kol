# Basecamp KOL Management Platform

## Current Session Context (Jan 28, 2026)

### Recent Fixes (This Session)

1. **Financial Summary** - Now includes PaymentReceipts (KOL-submitted proof) in paidOut and monthlySpend calculations

2. **Multiple Clients Per Campaign** - Added CampaignClient junction table for many-to-many relationship. Campaigns can now have multiple client organizations.

3. **Client Analytics - Real Data** - Replaced mock Math.random() trend data with actual post metrics:
   - Dashboard trend uses real post timestamps and cumulative growth
   - Analytics WoW changes calculated from actual period comparisons
   - Portfolio health shows real 7-day vs previous 7-day changes

4. **Period-Over-Period Metrics** - Client portal now shows accurate growth percentages

### Key Schema Change

New `CampaignClient` junction table for multi-client campaigns:
```prisma
model CampaignClient {
  id           String   @id @default(cuid())
  campaignId   String
  clientId     String
  campaign     Campaign     @relation(...)
  client       Organization @relation("CampaignClients", ...)
  @@unique([campaignId, clientId])
}
```

### Key Files

- `/src/app/api/kols/route.ts` - KOL roster API with paymentReceipts
- `/src/app/api/campaigns/[id]/route.ts` - Campaign API with campaignClients
- `/src/app/client/dashboard/page.tsx` - Client dashboard with real trend data
- `/src/app/client/analytics/page.tsx` - Analytics with real WoW changes
- `/src/app/(admin)/dashboard/page.tsx` - Agency dashboard with financial summary

### Payment/Earnings Logic

- Payments: `Payment` model (PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED)
- Receipts: `PaymentReceipt` model (KOL-submitted proof via Telegram)
- totalEarnings = receipts if available (actual proof), else completed payments

### Deployment

- GitHub: ADOrganization/basecamp-kol
- Production: admin.basecampnetwork.xyz (Vercel)
- Deploy: `vercel --prod --yes && vercel alias set <deployment> admin.basecampnetwork.xyz`
