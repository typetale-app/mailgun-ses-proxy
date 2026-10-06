-- DRAFT: schedule this migration separately on large databases. `start` runs
-- migrate deploy; the feature flag does NOT prevent the index build.
-- Refuse a table-copy / blocking fallback if online DDL is unsupported.
CREATE INDEX `idx_notifications_type_id_created`
ON `NewsletterNotifications` (`type`, `id`, `created`)
ALGORITHM=INPLACE LOCK=NONE;
