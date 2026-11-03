ALTER TABLE surveys DROP CONSTRAINT surveys_privacy_mode_check;
ALTER TABLE surveys ADD CONSTRAINT surveys_privacy_mode_check CHECK(privacy_mode IN ('anonymous','pseudonymous','identifiable'));
CREATE TABLE invitees (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL REFERENCES organizations(id),identity_encrypted text NOT NULL,email_hash char(64) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(survey_id,email_hash)
);
CREATE TABLE invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),invitee_id uuid NOT NULL REFERENCES invitees(id) ON DELETE CASCADE,
 publication_id uuid NOT NULL REFERENCES publications(id),token_hash char(64) NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL,revoked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE participant_links (
 session_id uuid PRIMARY KEY REFERENCES response_sessions(id) ON DELETE CASCADE,
 invitee_id uuid NOT NULL REFERENCES invitees(id) ON DELETE CASCADE,
 publication_id uuid NOT NULL REFERENCES publications(id),invitation_id uuid NOT NULL UNIQUE REFERENCES invitations(id),
 UNIQUE(invitee_id,publication_id)
);
CREATE FUNCTION enforce_personal_link() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE mode text; linked_publication uuid; linked_survey uuid;
BEGIN
 SELECT v.document#>>'{privacy,mode}',r.publication_id,v.survey_id INTO mode,linked_publication,linked_survey FROM response_sessions r JOIN survey_versions v ON v.id=r.survey_version_id WHERE r.id=new.session_id;
 IF mode NOT IN ('pseudonymous','identifiable') OR linked_publication<>new.publication_id THEN RAISE EXCEPTION 'Anonymous or mismatched response cannot have a participant link'; END IF;
 IF NOT EXISTS(SELECT 1 FROM invitees p JOIN invitations i ON i.invitee_id=p.id WHERE p.id=new.invitee_id AND p.survey_id=linked_survey AND i.id=new.invitation_id AND i.publication_id=new.publication_id) THEN RAISE EXCEPTION 'Invitation belongs to another survey'; END IF;
 RETURN new;
END; $$;
CREATE TRIGGER participant_privacy BEFORE INSERT OR UPDATE ON participant_links FOR EACH ROW EXECUTE FUNCTION enforce_personal_link();
