BEGIN;

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.is_platform_admin', true), '')::boolean, false);
$$;

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tenants;
CREATE POLICY tenant_isolation ON tenants
  USING (app.is_platform_admin() OR id = app.current_tenant_id())
  WITH CHECK (app.is_platform_admin() OR id = app.current_tenant_id());

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON users;
CREATE POLICY tenant_isolation ON users
  USING (app.is_platform_admin() OR "tenantId" = app.current_tenant_id())
  WITH CHECK (app.is_platform_admin() OR "tenantId" = app.current_tenant_id());

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON courses;
CREATE POLICY tenant_isolation ON courses
  USING (app.is_platform_admin() OR "tenantId" = app.current_tenant_id())
  WITH CHECK (app.is_platform_admin() OR "tenantId" = app.current_tenant_id());

ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON modules;
CREATE POLICY tenant_isolation ON modules
  USING (app.is_platform_admin() OR "tenantId" = app.current_tenant_id())
  WITH CHECK (app.is_platform_admin() OR "tenantId" = app.current_tenant_id());

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON lessons;
CREATE POLICY tenant_isolation ON lessons
  USING (app.is_platform_admin() OR "tenantId" = app.current_tenant_id())
  WITH CHECK (app.is_platform_admin() OR "tenantId" = app.current_tenant_id());

ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON enrollments;
CREATE POLICY tenant_isolation ON enrollments
  USING (app.is_platform_admin() OR "tenantId" = app.current_tenant_id())
  WITH CHECK (app.is_platform_admin() OR "tenantId" = app.current_tenant_id());

ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON lesson_progress;
CREATE POLICY tenant_isolation ON lesson_progress
  USING (app.is_platform_admin() OR "tenantId" = app.current_tenant_id())
  WITH CHECK (app.is_platform_admin() OR "tenantId" = app.current_tenant_id());

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON certificates;
CREATE POLICY tenant_isolation ON certificates
  USING (app.is_platform_admin() OR "tenantId" = app.current_tenant_id())
  WITH CHECK (app.is_platform_admin() OR "tenantId" = app.current_tenant_id());

ALTER TABLE course_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_sales FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_sale_access ON course_sales;
CREATE POLICY course_sale_access ON course_sales
  USING (app.is_platform_admin() OR "tenantId" = app.current_tenant_id())
  WITH CHECK (app.is_platform_admin() OR "tenantId" = app.current_tenant_id());

ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhook_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_webhook_event_access ON payment_webhook_events;
CREATE POLICY payment_webhook_event_access ON payment_webhook_events
  USING (app.is_platform_admin() OR "tenantId" = app.current_tenant_id())
  WITH CHECK (app.is_platform_admin() OR "tenantId" = app.current_tenant_id());

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_ticket_access ON support_tickets;
CREATE POLICY support_ticket_access ON support_tickets
  USING (app.is_platform_admin() OR "tenantId" = app.current_tenant_id())
  WITH CHECK (app.is_platform_admin() OR "tenantId" = app.current_tenant_id());

ALTER TABLE platform_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_staff FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_admin_only ON platform_staff;
CREATE POLICY platform_admin_only ON platform_staff
  USING (app.is_platform_admin())
  WITH CHECK (app.is_platform_admin());

ALTER TABLE platform_staff_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_staff_permissions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_admin_only ON platform_staff_permissions;
CREATE POLICY platform_admin_only ON platform_staff_permissions
  USING (app.is_platform_admin())
  WITH CHECK (app.is_platform_admin());

ALTER TABLE platform_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_admin_only ON platform_audit_logs;
CREATE POLICY platform_admin_only ON platform_audit_logs
  USING (app.is_platform_admin())
  WITH CHECK (app.is_platform_admin());

ALTER TABLE platform_fee_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_fee_payouts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_admin_only ON platform_fee_payouts;
CREATE POLICY platform_admin_only ON platform_fee_payouts
  USING (app.is_platform_admin())
  WITH CHECK (app.is_platform_admin());

COMMIT;
