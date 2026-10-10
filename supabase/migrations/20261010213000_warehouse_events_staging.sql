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
-- Enforce immutable audit rows even if a privileged role accidentally grants DML.
CREATE OR REPLACE FUNCTION public.reject_warehouse_event_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'warehouse_events are append-only';
END;
$$;
DROP TRIGGER IF EXISTS warehouse_events_no_update_delete ON public.warehouse_events;
CREATE TRIGGER warehouse_events_no_update_delete
BEFORE UPDATE OR DELETE ON public.warehouse_events
FOR EACH ROW EXECUTE FUNCTION public.reject_warehouse_event_mutation();

-- Prevent an event from linking an order to a different organization's channel.
CREATE OR REPLACE FUNCTION public.check_warehouse_event_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.sales_channels c ON c.id = NEW.channel_id
    WHERE o.id = NEW.order_id
      AND o.organization_id = NEW.organization_id
      AND o.channel_id = NEW.channel_id
      AND c.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'warehouse event order/account scope mismatch';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS warehouse_events_validate_scope ON public.warehouse_events;
CREATE TRIGGER warehouse_events_validate_scope
BEFORE INSERT ON public.warehouse_events
FOR EACH ROW EXECUTE FUNCTION public.check_warehouse_event_scope();

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
