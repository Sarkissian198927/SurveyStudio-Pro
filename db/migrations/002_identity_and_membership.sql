-- Additive migration: preserve all existing users, projects and survey data.
CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_sessions_user_idx ON auth_sessions(user_id);

-- Repair legacy project-only memberships before enforcing tenant consistency.
INSERT INTO organization_members(organization_id,user_id,role)
SELECT DISTINCT p.organization_id, pm.user_id, 'member'
FROM project_members pm JOIN projects p ON p.id=pm.project_id
ON CONFLICT DO NOTHING;
ALTER TABLE project_members ADD COLUMN organization_id uuid;
UPDATE project_members pm SET organization_id=p.organization_id FROM projects p WHERE p.id=pm.project_id;
ALTER TABLE project_members ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE project_members ADD CONSTRAINT project_members_project_tenant_fk
  FOREIGN KEY(project_id,organization_id) REFERENCES projects(id,organization_id) ON DELETE CASCADE;
ALTER TABLE project_members ADD CONSTRAINT project_members_user_tenant_fk
  FOREIGN KEY(organization_id,user_id) REFERENCES organization_members(organization_id,user_id) ON DELETE CASCADE;
