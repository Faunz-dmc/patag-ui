-- Additive PATAG admin foundation. The migration runner supplies one transaction.
CREATE SCHEMA IF NOT EXISTS patag_private;
REVOKE ALL ON SCHEMA patag_private FROM PUBLIC;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='patag_api') THEN CREATE ROLE patag_api NOLOGIN NOBYPASSRLS; END IF; END $$;
GRANT patag_api TO postgres;
GRANT USAGE ON SCHEMA public, auth, patag_private TO patag_api;
GRANT USAGE ON SCHEMA patag_private TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO patag_api;

CREATE TABLE IF NOT EXISTS public.patag_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
  municipality text NOT NULL CHECK(length(trim(municipality)) BETWEEN 1 AND 100), province text NOT NULL DEFAULT 'Bulacan' CHECK(province='Bulacan'),
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.patag_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100), email text NOT NULL CHECK(length(email)<=254),
  role text NOT NULL CHECK(role IN ('administrator','maintenance','citizen')), active boolean NOT NULL DEFAULT true,
  province text NOT NULL DEFAULT 'Bulacan' CHECK(province='Bulacan'), municipality text CHECK(length(trim(municipality)) BETWEEN 1 AND 100),
  team_id uuid REFERENCES public.patag_teams(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((role='maintenance' AND team_id IS NOT NULL AND municipality IS NOT NULL) OR (role<>'maintenance' AND team_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS patag_profiles_email ON public.patag_profiles(lower(email));
CREATE TABLE IF NOT EXISTS public.patag_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
  description text NOT NULL CHECK(length(description) BETWEEN 1 AND 4000), hazards text NOT NULL DEFAULT '' CHECK(length(hazards)<=2000),
  severity text NOT NULL DEFAULT 'Medium' CHECK(severity IN ('Low','Medium','High')),
  status text NOT NULL DEFAULT 'Submitted' CHECK(status IN ('Submitted','Under Review','Verified','Assigned','In Progress','Resolved','Rejected','Duplicate')),
  road text NOT NULL CHECK(length(trim(road)) BETWEEN 1 AND 200), barangay text NOT NULL CHECK(length(trim(barangay)) BETWEEN 1 AND 100),
  municipality text NOT NULL CHECK(length(trim(municipality)) BETWEEN 1 AND 100), province text NOT NULL DEFAULT 'Bulacan' CHECK(province='Bulacan'),
  landmark text NOT NULL DEFAULT '' CHECK(length(landmark)<=300), latitude double precision NOT NULL CHECK(latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180), reporter_id uuid NOT NULL REFERENCES public.patag_profiles(id),
  jurisdiction text NOT NULL DEFAULT 'Bulacan-wide administrator scope' CHECK(length(trim(jurisdiction)) BETWEEN 1 AND 200),
  team_id uuid REFERENCES public.patag_teams(id), duplicate_of uuid REFERENCES public.patag_reports(id),
  flagged boolean NOT NULL DEFAULT false, public_photos_approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 0,
  CHECK(duplicate_of IS NULL OR duplicate_of<>id), CHECK ((status='Duplicate')=(duplicate_of IS NOT NULL)),
  CHECK(status NOT IN ('Assigned','In Progress','Resolved') OR team_id IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS public.patag_assignments (
  report_id uuid PRIMARY KEY REFERENCES public.patag_reports(id), team_id uuid NOT NULL REFERENCES public.patag_teams(id),
  assigned_by uuid NOT NULL REFERENCES public.patag_profiles(id), priority text NOT NULL CHECK(priority IN ('Low','Medium','High')),
  note text NOT NULL DEFAULT '' CHECK(length(note)<=2000), target_date date, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.patag_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid REFERENCES public.patag_reports(id),
  uploaded_by uuid NOT NULL REFERENCES public.patag_profiles(id), object_path text NOT NULL UNIQUE,
  name text NOT NULL CHECK(length(name) BETWEEN 1 AND 200), kind text NOT NULL CHECK(kind IN ('before','after')),
  mime_type text NOT NULL CHECK(mime_type IN ('image/png','image/jpeg','image/webp')), size integer NOT NULL CHECK(size BETWEEN 8 AND 8388608),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.patag_report_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid NOT NULL REFERENCES public.patag_reports(id),
  actor_id uuid NOT NULL REFERENCES public.patag_profiles(id), actor text NOT NULL, action text NOT NULL,
  from_status text, to_status text NOT NULL, note text NOT NULL DEFAULT '' CHECK(length(note)<=2000), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.patag_repair_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid NOT NULL REFERENCES public.patag_reports(id),
  actor_id uuid NOT NULL REFERENCES public.patag_profiles(id), phase text NOT NULL CHECK(length(phase) BETWEEN 1 AND 100),
  note text NOT NULL CHECK(length(note) BETWEEN 1 AND 2000), photo_ids uuid[] NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.patag_completions (
  report_id uuid PRIMARY KEY REFERENCES public.patag_reports(id), submitted_by uuid NOT NULL REFERENCES public.patag_profiles(id),
  state text NOT NULL CHECK(state IN ('Awaiting Verification','Additional Work Requested','Verified')),
  note text NOT NULL CHECK(length(note) BETWEEN 1 AND 2000), photo_ids uuid[] NOT NULL CHECK(cardinality(photo_ids)>0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.patag_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.patag_profiles(id),
  report_id uuid NOT NULL REFERENCES public.patag_reports(id), title text NOT NULL CHECK(length(title) BETWEEN 1 AND 300),
  read boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.patag_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL REFERENCES public.patag_profiles(id), action text NOT NULL,
  resource_id text NOT NULL, municipality text, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key uuid, request_hash text, response jsonb, UNIQUE(actor_id,idempotency_key)
);
CREATE TABLE IF NOT EXISTS public.patag_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK(id), agency text NOT NULL CHECK(length(trim(agency)) BETWEEN 1 AND 200),
  city text NOT NULL CHECK(length(trim(city)) BETWEEN 1 AND 100), province text NOT NULL DEFAULT 'Bulacan' CHECK(province='Bulacan'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.patag_settings(id,agency,city) VALUES(true,'Bulacan-wide administrator scope','Bulacan') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS patag_private.sessions (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id), expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS patag_private.rate_limits (
  key text PRIMARY KEY, window_start timestamptz NOT NULL, attempts integer NOT NULL CHECK(attempts>0)
);
ALTER TABLE patag_private.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE patag_private.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS patag_reports_scope_status ON public.patag_reports(municipality,status,created_at DESC,id);
CREATE INDEX IF NOT EXISTS patag_reports_barangay ON public.patag_reports(barangay);
CREATE INDEX IF NOT EXISTS patag_reports_status ON public.patag_reports(status,created_at DESC);
CREATE INDEX IF NOT EXISTS patag_reports_team ON public.patag_reports(team_id,status);
CREATE INDEX IF NOT EXISTS patag_reports_owner ON public.patag_reports(reporter_id,created_at DESC);
CREATE INDEX IF NOT EXISTS patag_history_report ON public.patag_report_history(report_id,created_at);
CREATE INDEX IF NOT EXISTS patag_evidence_report ON public.patag_evidence(report_id);
CREATE INDEX IF NOT EXISTS patag_assignments_team ON public.patag_assignments(team_id);
CREATE INDEX IF NOT EXISTS patag_notices_recipient ON public.patag_notifications(user_id,read,created_at DESC);
CREATE INDEX IF NOT EXISTS patag_audit_scope_time ON public.patag_audit_events(municipality,created_at DESC);
CREATE INDEX IF NOT EXISTS patag_profiles_scope ON public.patag_profiles(municipality,role,active);
CREATE INDEX IF NOT EXISTS patag_profiles_team ON public.patag_profiles(team_id);
CREATE INDEX IF NOT EXISTS patag_updates_report ON public.patag_repair_updates(report_id,created_at);
CREATE INDEX IF NOT EXISTS patag_sessions_expiry ON patag_private.sessions(expires_at);

CREATE OR REPLACE FUNCTION patag_private.actor() RETURNS public.patag_profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT p FROM public.patag_profiles p WHERE p.id=(SELECT auth.uid()) AND p.active
    AND EXISTS(SELECT 1 FROM auth.sessions s WHERE s.id=(auth.jwt()->>'session_id')::uuid AND s.user_id=p.id)
    AND (coalesce(auth.jwt()->>'aal','aal1')='aal2' OR NOT EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id=p.id AND f.status='verified'))
$$;
CREATE OR REPLACE FUNCTION patag_private.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce((patag_private.actor()).role='administrator',false) $$;
CREATE OR REPLACE FUNCTION patag_private.in_scope(city text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT coalesce((patag_private.actor()).id IS NOT NULL AND ((patag_private.actor()).municipality IS NULL OR lower((patag_private.actor()).municipality)=lower(city)),false)
$$;
CREATE OR REPLACE FUNCTION patag_private.can_report(ref uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (SELECT 1 FROM public.patag_reports r WHERE r.id=ref AND patag_private.in_scope(r.municipality) AND (
    patag_private.is_admin() OR ((patag_private.actor()).role='citizen' AND r.reporter_id=(SELECT auth.uid())) OR ((patag_private.actor()).role='maintenance' AND r.team_id=(patag_private.actor()).team_id)))
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA patag_private FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA patag_private TO authenticated,patag_api;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['teams','profiles','reports','assignments','evidence','report_history','repair_updates','completions','notifications','audit_events','settings'] LOOP
    EXECUTE format('ALTER TABLE public.patag_%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.patag_%I FROM PUBLIC,anon,authenticated',t);
    EXECUTE format('GRANT SELECT ON public.patag_%I TO authenticated,patag_api',t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS profiles_read ON public.patag_profiles;
CREATE POLICY profiles_read ON public.patag_profiles FOR SELECT TO authenticated,patag_api USING (
  (patag_private.actor()).id IS NOT NULL AND (id=auth.uid() OR (patag_private.is_admin() AND patag_private.in_scope(municipality)))
);
DROP POLICY IF EXISTS teams_read ON public.patag_teams;
CREATE POLICY teams_read ON public.patag_teams FOR SELECT TO authenticated,patag_api USING ((patag_private.actor()).id IS NOT NULL AND patag_private.in_scope(municipality));
DROP POLICY IF EXISTS reports_read ON public.patag_reports;
CREATE POLICY reports_read ON public.patag_reports FOR SELECT TO authenticated,patag_api USING (patag_private.can_report(id));
DROP POLICY IF EXISTS evidence_read ON public.patag_evidence;
CREATE POLICY evidence_read ON public.patag_evidence FOR SELECT TO authenticated,patag_api USING (patag_private.can_report(report_id) OR ((patag_private.actor()).id IS NOT NULL AND uploaded_by=auth.uid() AND report_id IS NULL));
DROP POLICY IF EXISTS notifications_read ON public.patag_notifications;
CREATE POLICY notifications_read ON public.patag_notifications FOR SELECT TO authenticated,patag_api USING ((patag_private.actor()).id IS NOT NULL AND user_id=auth.uid() AND patag_private.can_report(report_id));
DROP POLICY IF EXISTS audit_read ON public.patag_audit_events;
CREATE POLICY audit_read ON public.patag_audit_events FOR SELECT TO authenticated,patag_api USING (patag_private.is_admin() AND patag_private.in_scope(municipality));
DROP POLICY IF EXISTS settings_read ON public.patag_settings;
CREATE POLICY settings_read ON public.patag_settings FOR SELECT TO authenticated,patag_api USING ((patag_private.actor()).id IS NOT NULL);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['assignments','report_history','repair_updates','completions'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS report_read ON public.patag_%I',t);
    EXECUTE format('CREATE POLICY report_read ON public.patag_%I FOR SELECT TO authenticated,patag_api USING(patag_private.can_report(report_id))',t);
  END LOOP;
END $$;

-- patag_api is NOLOGIN and never granted to browser roles. Only the BFF assumes it.
GRANT INSERT,UPDATE ON public.patag_profiles,public.patag_teams,public.patag_reports,public.patag_assignments,public.patag_evidence,public.patag_completions,public.patag_notifications TO patag_api;
GRANT INSERT ON public.patag_report_history,public.patag_repair_updates,public.patag_audit_events TO patag_api;
GRANT UPDATE ON public.patag_settings TO patag_api;
DROP POLICY IF EXISTS profiles_write ON public.patag_profiles;
CREATE POLICY profiles_write ON public.patag_profiles FOR ALL TO patag_api USING (patag_private.is_admin() AND patag_private.in_scope(municipality)) WITH CHECK(patag_private.is_admin() AND patag_private.in_scope(municipality));
DROP POLICY IF EXISTS teams_write ON public.patag_teams;
CREATE POLICY teams_write ON public.patag_teams FOR ALL TO patag_api USING(patag_private.is_admin() AND patag_private.in_scope(municipality)) WITH CHECK(patag_private.is_admin() AND patag_private.in_scope(municipality));
DROP POLICY IF EXISTS reports_write ON public.patag_reports;
CREATE POLICY reports_write ON public.patag_reports FOR UPDATE TO patag_api USING(patag_private.can_report(id)) WITH CHECK(patag_private.can_report(id));
DROP POLICY IF EXISTS reports_insert ON public.patag_reports;
CREATE POLICY reports_insert ON public.patag_reports FOR INSERT TO patag_api WITH CHECK((patag_private.actor()).role='citizen' AND reporter_id=auth.uid() AND patag_private.in_scope(municipality));
DROP POLICY IF EXISTS evidence_insert ON public.patag_evidence;
CREATE POLICY evidence_insert ON public.patag_evidence FOR INSERT TO patag_api WITH CHECK(uploaded_by=auth.uid() AND (patag_private.actor()).id IS NOT NULL AND (report_id IS NULL OR patag_private.can_report(report_id)));
DROP POLICY IF EXISTS evidence_attach ON public.patag_evidence;
CREATE POLICY evidence_attach ON public.patag_evidence FOR UPDATE TO patag_api USING(uploaded_by=auth.uid()) WITH CHECK(uploaded_by=auth.uid() AND patag_private.can_report(report_id));
DROP POLICY IF EXISTS notifications_update ON public.patag_notifications;
CREATE POLICY notifications_update ON public.patag_notifications FOR UPDATE TO patag_api USING(user_id=auth.uid() AND patag_private.can_report(report_id)) WITH CHECK(user_id=auth.uid() AND patag_private.can_report(report_id));
DROP POLICY IF EXISTS notifications_insert ON public.patag_notifications;
CREATE POLICY notifications_insert ON public.patag_notifications FOR INSERT TO patag_api WITH CHECK(patag_private.can_report(report_id));
DROP POLICY IF EXISTS audit_insert ON public.patag_audit_events;
CREATE POLICY audit_insert ON public.patag_audit_events FOR INSERT TO patag_api WITH CHECK(actor_id=auth.uid() AND (patag_private.actor()).id IS NOT NULL AND patag_private.in_scope(municipality));
DROP POLICY IF EXISTS settings_update ON public.patag_settings;
CREATE POLICY settings_update ON public.patag_settings FOR UPDATE TO patag_api USING(patag_private.is_admin() AND (patag_private.actor()).municipality IS NULL) WITH CHECK(patag_private.is_admin() AND (patag_private.actor()).municipality IS NULL);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['assignments','report_history','repair_updates','completions'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS report_write ON public.patag_%I',t);
    EXECUTE format('CREATE POLICY report_write ON public.patag_%I FOR ALL TO patag_api USING(patag_private.can_report(report_id)) WITH CHECK(patag_private.can_report(report_id))',t);
  END LOOP;
END $$;

DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='patag-evidence' AND public) THEN RAISE EXCEPTION 'patag-evidence must be private; review existing bucket before migration'; END IF;
END $$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('patag-evidence','patag-evidence',false,8388608,ARRAY['image/png','image/jpeg','image/webp']) ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION patag_private.notify_report(ref uuid, message text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT patag_private.can_report(ref) OR length(message)>300 THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501'; END IF;
  INSERT INTO public.patag_notifications(user_id,report_id,title)
  SELECT p.id,r.id,message FROM public.patag_profiles p JOIN public.patag_reports r ON r.id=ref
  WHERE p.active AND p.province=r.province AND (p.municipality IS NULL OR lower(p.municipality)=lower(r.municipality))
    AND (p.role='administrator' OR p.id=r.reporter_id OR (p.role='maintenance' AND p.team_id=r.team_id));
END $$;
REVOKE ALL ON FUNCTION patag_private.notify_report(uuid,text) FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION patag_private.notify_report(uuid,text) TO patag_api;
DROP POLICY IF EXISTS audit_api_read ON public.patag_audit_events;
CREATE POLICY audit_api_read ON public.patag_audit_events FOR SELECT TO patag_api USING(actor_id=auth.uid() AND (patag_private.actor()).id IS NOT NULL);
CREATE INDEX IF NOT EXISTS patag_reports_road_location ON public.patag_reports(lower(road),latitude,longitude);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='patag_api' AND (rolcanlogin OR rolbypassrls OR rolsuper)) THEN RAISE EXCEPTION 'Existing patag_api must be NOLOGIN NOBYPASSRLS NOSUPERUSER'; END IF;
END $$;
