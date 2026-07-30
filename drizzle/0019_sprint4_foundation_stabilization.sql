-- SBTS 2.2.1 — normalize theme persistence values and defaults.
-- Additive/data-normalizing only; no user records are removed.

UPDATE `users`
SET `preferredTheme` = CASE
  WHEN `preferredTheme` IN ('dark', 'modern', 'sbts-custom') THEN 'modern'
  WHEN `preferredTheme` = 'manus' THEN 'manus'
  ELSE 'standard'
END
WHERE `preferredTheme` IS NULL
   OR `preferredTheme` NOT IN ('standard', 'modern', 'manus');

ALTER TABLE `users`
  MODIFY COLUMN `preferredTheme` varchar(20) NULL DEFAULT 'standard';
