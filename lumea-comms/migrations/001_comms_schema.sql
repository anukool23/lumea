CREATE SCHEMA IF NOT EXISTS comms;

CREATE TABLE IF NOT EXISTS comms.email_log (
  id         BIGSERIAL PRIMARY KEY,
  recipient  VARCHAR(255) NOT NULL,
  subject    TEXT,
  type       VARCHAR(50),
  status     VARCHAR(20),
  sent_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_log_recipient ON comms.email_log(recipient);
CREATE INDEX IF NOT EXISTS idx_email_log_type ON comms.email_log(type);
