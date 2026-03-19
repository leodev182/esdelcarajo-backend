-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "LogEvent" AS ENUM ('USER_LOGIN', 'USER_LOGOUT', 'USER_REGISTERED', 'USER_BANNED', 'USER_UNBANNED', 'USER_ROLE_CHANGED', 'ORDER_CREATED', 'ORDER_STATUS_UPDATED', 'ORDER_CANCELLED', 'ORDER_PAYMENT_CONFIRMED', 'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRODUCT_DELETED', 'UNHANDLED_EXCEPTION', 'CUSTOM_EVENT');

-- CreateTable
CREATE TABLE "Log" (
    "id" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL,
    "event" "LogEvent" NOT NULL,
    "message" TEXT NOT NULL,
    "method" TEXT,
    "url" TEXT,
    "statusCode" INTEGER,
    "userId" TEXT,
    "userEmail" TEXT,
    "errorMessage" TEXT,
    "context" TEXT,
    "isPermanent" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Log_createdAt_idx" ON "Log"("createdAt");

-- CreateIndex
CREATE INDEX "Log_level_createdAt_idx" ON "Log"("level", "createdAt");

-- CreateIndex
CREATE INDEX "Log_isPermanent_expiresAt_idx" ON "Log"("isPermanent", "expiresAt");

-- CreateIndex
CREATE INDEX "Log_userId_idx" ON "Log"("userId");
