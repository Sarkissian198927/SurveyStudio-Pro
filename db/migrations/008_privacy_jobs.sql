ALTER TABLE mail_jobs ADD COLUMN invitee_id uuid REFERENCES invitees(id) ON DELETE CASCADE;
