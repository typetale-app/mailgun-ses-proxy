/*
  Warnings:

  - A unique constraint covering the columns `[messageId]` on the table `SystemMails` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `SystemMails` ALTER COLUMN `messageId` DROP DEFAULT;

-- CreateTable
CREATE TABLE `SystemMailNotifications` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `notificationId` VARCHAR(191) NOT NULL,
    `messageId` VARCHAR(191) NOT NULL,
    `rawEvent` TEXT NOT NULL,
    `timestamp` DATETIME(3) NOT NULL,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SystemMailNotifications_notificationId_key`(`notificationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DashboardUser` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` TEXT NOT NULL,
    `name` VARCHAR(191) NULL,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DashboardUser_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DashboardSettings` (
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `updated` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `SystemMails_messageId_key` ON `SystemMails`(`messageId`);

-- AddForeignKey
ALTER TABLE `SystemMailNotifications` ADD CONSTRAINT `SystemMailNotifications_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `SystemMails`(`messageId`) ON DELETE RESTRICT ON UPDATE CASCADE;
