CREATE TABLE assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES projects(id),
 mime_type text NOT NULL CHECK(mime_type IN ('image/png','image/jpeg','image/webp')),
 bytes integer NOT NULL CHECK(bytes>0 AND bytes<=1400000),sha256 char(64) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(project_id,sha256)
);
ALTER TABLE export_jobs ADD COLUMN survey_version_id uuid REFERENCES survey_versions(id);
