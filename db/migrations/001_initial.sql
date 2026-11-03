-- SurveyStudio Pro 0.1.0. Runs atomically via db/migrate.cjs.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(160) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(320) NOT NULL,
  password_hash text NOT NULL,
  display_name varchar(120) NOT NULL,
  status varchar(12) NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_ci_unique ON users (lower(email));
CREATE TABLE organization_members (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(12) NOT NULL CHECK (role IN ('owner','admin','member')),
  PRIMARY KEY (organization_id,user_id)
);
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title varchar(160) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,organization_id)
);
CREATE TABLE project_members (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(12) NOT NULL CHECK (role IN ('owner','editor','viewer')),
  PRIMARY KEY (project_id,user_id)
);
CREATE TABLE surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL,
  title varchar(160) NOT NULL,
  state varchar(12) NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','published','paused','archived')),
  privacy_mode varchar(20) NOT NULL DEFAULT 'anonymous' CHECK (privacy_mode='anonymous'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,organization_id),
  FOREIGN KEY(project_id,organization_id) REFERENCES projects(id,organization_id)
);
CREATE TABLE survey_drafts (
  survey_id uuid PRIMARY KEY REFERENCES surveys(id) ON DELETE CASCADE,
  revision integer NOT NULL DEFAULT 1 CHECK(revision>=1),
  document jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE survey_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  survey_id uuid NOT NULL,
  version_no integer NOT NULL CHECK(version_no>=1),
  document jsonb NOT NULL,
  schema_sha256 char(64) NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(survey_id,version_no),
  UNIQUE(id,organization_id),
  FOREIGN KEY(survey_id,organization_id) REFERENCES surveys(id,organization_id)
);
CREATE TABLE publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  survey_id uuid NOT NULL,
  survey_version_id uuid NOT NULL,
  slug varchar(80) NOT NULL UNIQUE,
  state varchar(12) NOT NULL DEFAULT 'active' CHECK(state IN ('active','paused','closed')),
  opens_at timestamptz,
  closes_at timestamptz,
  max_responses integer CHECK(max_responses>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(survey_id,organization_id) REFERENCES surveys(id,organization_id),
  FOREIGN KEY(survey_version_id,organization_id) REFERENCES survey_versions(id,organization_id),
  CHECK(closes_at IS NULL OR opens_at IS NULL OR closes_at>opens_at)
);
CREATE INDEX publications_survey_idx ON publications(survey_id,created_at DESC);
CREATE TABLE response_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  publication_id uuid NOT NULL REFERENCES publications(id),
  survey_version_id uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  answer_sha256 char(64) NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(publication_id,idempotency_key),
  FOREIGN KEY(survey_version_id,organization_id) REFERENCES survey_versions(id,organization_id)
);
CREATE INDEX sessions_publication_idx ON response_sessions(publication_id);
CREATE TABLE response_items (
  session_id uuid NOT NULL REFERENCES response_sessions(id) ON DELETE CASCADE,
  question_key varchar(100) NOT NULL,
  answer_json jsonb NOT NULL,
  PRIMARY KEY(session_id,question_key)
);
CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  actor_user_id uuid REFERENCES users(id),
  action varchar(80) NOT NULL,
  resource_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_org_time_idx ON audit_events(organization_id,created_at DESC);
