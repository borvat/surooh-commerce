-- DEVELOPMENT ONLY: do not apply to the live Lovable/Supabase database.
-- Append-only warehouse events: no direct browser writes. Backend gateway must
-- authenticate actor, verify order + channel ownership, and issue verified writes.
CREATE TABLE IF NOT EXISTS public.warehouse_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  channel_id uuid NOT NULL REFERENCES public.sales_channels(id),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  event_kind text NOT NULL CHECK (event_kind IN (
    'PICK_LIST_PRINTED', 'PICKING_STARTED', 'PICKING_COMPLETED',
    'PACKING_CHECKED', 'CARRIER_LABEL_VERIFIED', 'HANDOFF_RECORDED'
  )),
  evidence_reference text,
  operation_key text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT warehouse_events_evidence_required CHECK (
    event_kind NOT IN ('CARRIER_LABEL_VERIFIED', 'HANDOFF_RECORDED')
    OR NULLIF(btrim(evidence_reference), '') IS NOT NULL
  ),
  CONSTRAINT warehouse_events_operation_uniq UNIQUE (organization_id, operation_key)
);
CREATE INDEX IF NOT EXISTS warehouse_events_order_idx
  ON public.warehouse_events (organization_id, order_id, occurred_at);
ALTER TABLE public.warehouse_events ENABLE ROW LEVEL SECURITY;
-- Deny all access to anonymous and authenticated clients until approved
-- server-side API/RPC, roles, and multi-tenant tests are in place.
REVOKE ALL ON public.warehouse_events FROM PUBLIC, anon, authenticated;
-- Even privileged APIs must validate order/channel membership in one transaction.
-- No SECURITY DEFINER recording RPC is created in this phase.
COMMENT ON TABLE public.warehouse_events IS
  'Staging schema only: immutable warehouse audit events; no frontend write access; deployment requires separate review.';
