-- AlterTable
ALTER TABLE "BrokerProfile" ADD COLUMN     "loanPrograms" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "maxLoanToValue" INTEGER,
ADD COLUMN     "maxRate" DECIMAL(6,3),
ADD COLUMN     "minCreditScore" INTEGER,
ADD COLUMN     "minRate" DECIMAL(6,3),
ADD COLUMN     "notes" TEXT;
