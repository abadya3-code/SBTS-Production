-- SBTS Sprint 5: authentication and deployment hardening.
-- Applied by scripts/apply-sbts-domain-migrations.ts.

ALTER TABLE `users`
  ADD COLUMN `failedLoginAttempts` int NOT NULL DEFAULT 0 AFTER `passwordHash`;

ALTER TABLE `users`
  ADD COLUMN `lockedUntil` timestamp NULL AFTER `failedLoginAttempts`;

ALTER TABLE `users`
  ADD COLUMN `passwordChangedAt` timestamp NULL AFTER `lockedUntil`;

UPDATE `users`
SET `email` = LOWER(TRIM(`email`))
WHERE `email` IS NOT NULL;

CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);

UPDATE `security_settings`
SET `minPasswordLength` = 12
WHERE `minPasswordLength` < 12;
