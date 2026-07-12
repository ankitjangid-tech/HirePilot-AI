BEGIN;

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS notification_type VARCHAR(50) DEFAULT 'general';

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50);

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS reference_id INTEGER;

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

UPDATE notifications
SET notification_type = CASE
  WHEN LOWER(message) LIKE '%shortlisted%' THEN 'shortlisted'
  WHEN LOWER(message) LIKE '%not selected%' OR LOWER(message) LIKE '%rejected%' THEN 'rejected'
  WHEN LOWER(message) LIKE '%selected%' THEN 'selected'
  WHEN LOWER(message) LIKE '%interview%' THEN 'interview_scheduled'
  ELSE 'general'
END
WHERE notification_type IS NULL OR notification_type = 'general';

UPDATE notifications
SET is_read = false
WHERE is_read IS NULL;

UPDATE notifications
SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_candidate_created
ON notifications(candidate_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_reference
ON notifications(reference_type, reference_id);

COMMIT;
