ALTER TABLE projects ADD COLUMN parent_project_id uuid;
ALTER TABLE projects ADD CONSTRAINT project_folder_tenant_fk FOREIGN KEY(parent_project_id,organization_id) REFERENCES projects(id,organization_id);
ALTER TABLE projects ADD CONSTRAINT project_not_own_parent CHECK(parent_project_id IS NULL OR parent_project_id<>id);
