ALTER TABLE `NewsletterMessages`
    ADD COLUMN `recipientData` TEXT NULL;

ALTER TABLE `NewsletterErrors`
    ADD COLUMN `recipientData` TEXT NULL;
