# HotCol Waiter

Waiter portal for Café and Restaurant properties with Apex `waiterOrderingEnabled`.

## Local run

1. Apply shared DB schema from **hotcol-user/BackEnd**:
   ```bash
   npx prisma db push --accept-data-loss
   ```
   (Adds waiter `passkey` / `isActive`, tenant flags, payment-approval model.)

2. Waiter API (port **4002**):
   ```bash
   cd BackEnd
   npm install
   npx prisma generate
   npm run dev
   ```

3. Frontend — set `NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4002/graphql` in `.env.local`, then:
   ```bash
   npm run dev
   ```

## Notes

- Login is **6-digit passkey only** (globally unique).
- Waiter never marks orders paid; optional payment-approval requests go to cashier.
