-- Postgres Row-Level Security — the second seatbelt below app-level access.
-- Even if app code forgets a tenant filter, the database refuses the row.
-- Applied to the money-touching tables (orders, transactions) per the
-- architecture default. See references/tenancy.md.
--
-- HOW TENANT ID REACHES POSTGRES:
--   Before Payload runs its queries for a request, set a TRANSACTION-LOCAL
--   session var (the `true` third arg is is_local — critical with PgBouncer /
--   connection pooling; a session-level setting on a shared connection leaks):
--
--     SELECT set_config('app.tenant_id', $1, true);
--
-- NOTE on column type: these policies assume tenant_id is stored as text/uuid.
-- Payload's postgres adapter stores relationships as integer/uuid FKs — adjust
-- the cast below to match your generated schema (run `payload generate:types`
-- and inspect the orders/transactions table). Verify the actual column name
-- (likely `tenant_id`) against the migration Payload generates.

-- ORDERS -------------------------------------------------------------------
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON orders;
CREATE POLICY tenant_isolation ON orders
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

-- TRANSACTIONS -------------------------------------------------------------
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON transactions;
CREATE POLICY tenant_isolation ON transactions
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

-- The DB role Payload connects as must NOT be a superuser or own these tables
-- in a way that bypasses RLS; FORCE ROW LEVEL SECURITY above also subjects the
-- table owner to the policy. Create a dedicated app role for the connection.
