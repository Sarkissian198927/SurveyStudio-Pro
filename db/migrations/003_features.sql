ALTER TABLE users ADD COLUMN verified_at timestamptz;
CREATE TABLE identity_tokens (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 purpose text NOT NULL CHECK(purpose IN ('reset','verify')), token_hash char(64) NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE mail_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id) ON DELETE CASCADE,
 organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
 payload_encrypted text NOT NULL, status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','sent','failed')),
 attempts integer NOT NULL DEFAULT 0, last_error_code text, created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz
);
CREATE TABLE report_shares (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), survey_version_id uuid NOT NULL REFERENCES survey_versions(id),
 organization_id uuid NOT NULL REFERENCES organizations(id), token_hash char(64) NOT NULL UNIQUE,
 minimum_group integer NOT NULL CHECK(minimum_group>=5), expires_at timestamptz NOT NULL, revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE survey_comments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
 author_id uuid NOT NULL REFERENCES users(id), body varchar(4000) NOT NULL,
 resolved boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE survey_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
 revision integer NOT NULL,document jsonb NOT NULL,author_id uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(survey_id,revision)
);
CREATE FUNCTION prevent_published_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Published versions are immutable'; END; $$;
CREATE TRIGGER published_immutable BEFORE UPDATE OR DELETE ON survey_versions FOR EACH ROW EXECUTE FUNCTION prevent_published_change();
CREATE FUNCTION prevent_audit_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit events are append-only'; END; $$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION prevent_audit_change();
CREATE INDEX mail_queue_idx ON mail_jobs(status,created_at);
CREATE INDEX comments_survey_idx ON survey_comments(survey_id,created_at);
CREATE INDEX history_survey_idx ON survey_history(survey_id,revision DESC);
ALTER TABLE report_shares ADD COLUMN snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE export_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), survey_id uuid NOT NULL REFERENCES surveys(id),
 requested_by uuid NOT NULL REFERENCES users(id), format text NOT NULL CHECK(format IN ('csv','xlsx','pdf')),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','done','failed')),
 file_path text, error_code text, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '1 hour'
);
