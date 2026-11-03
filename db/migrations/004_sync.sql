CREATE TABLE device_tokens (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash char(64) NOT NULL UNIQUE,expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days',
 revoked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sync_operations (
 user_id uuid NOT NULL REFERENCES users(id),operation_id varchar(128) NOT NULL,
 payload_hash char(64) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,operation_id)
);
