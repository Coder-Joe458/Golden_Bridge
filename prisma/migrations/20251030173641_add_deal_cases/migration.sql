-- CreateTable
CREATE TABLE "DealCase" (
    "id" TEXT NOT NULL,
    "caseCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "priceDisplayEn" TEXT NOT NULL,
    "priceDisplayZh" TEXT NOT NULL,
    "timelineEn" TEXT NOT NULL,
    "timelineZh" TEXT NOT NULL,
    "borrowerTypeEn" TEXT NOT NULL,
    "borrowerTypeZh" TEXT NOT NULL,
    "productEn" TEXT NOT NULL,
    "productZh" TEXT NOT NULL,
    "highlightEn" TEXT NOT NULL,
    "highlightZh" TEXT NOT NULL,
    "heroImageUrl" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealCaseImage" (
    "id" TEXT NOT NULL,
    "dealCaseId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "altEn" TEXT NOT NULL,
    "altZh" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DealCaseImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DealCase_caseCode_key" ON "DealCase"("caseCode");

-- CreateIndex
CREATE INDEX "DealCaseImage_dealCaseId_sortOrder_idx" ON "DealCaseImage"("dealCaseId", "sortOrder");

-- AddForeignKey
ALTER TABLE "DealCaseImage" ADD CONSTRAINT "DealCaseImage_dealCaseId_fkey" FOREIGN KEY ("dealCaseId") REFERENCES "DealCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
