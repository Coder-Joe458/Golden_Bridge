/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const caseCode = "CA-LA-25-11-10";

  const heroImageUrl = "https://golden-bridge-deal-img.s3.us-west-2.amazonaws.com/CA-LA-25-11-10-1.jpg";
  const galleryImages = [
    {
      url: "https://golden-bridge-deal-img.s3.us-west-2.amazonaws.com/CA-LA-25-11-10-2.jpg",
      altEn: "Sunlit Los Angeles living area staged for closing day",
      altZh: "洛杉矶成交流程中的阳光客厅布置",
      sortOrder: 0
    },
    {
      url: "https://golden-bridge-deal-img.s3.us-west-2.amazonaws.com/CA-LA-25-11-10-3.jpg",
      altEn: "Primary suite with downtown Los Angeles skyline view",
      altZh: "俯瞰洛杉矶市中心天际线的主卧套房",
      sortOrder: 1
    },
    {
      url: "https://golden-bridge-deal-img.s3.us-west-2.amazonaws.com/CA-LA-25-11-10-4.jpg",
      altEn: "Rooftop lounge highlighting the borrower’s renovation plan",
      altZh: "展示借款人改造计划的屋顶休闲区",
      sortOrder: 2
    }
  ];

  const baseData = {
    city: "Los Angeles",
    state: "CA",
    priceDisplayEn: "$1.45M jumbo financing",
    priceDisplayZh: "约 145 万美元大额贷款",
    timelineEn: "Closed in 21 days",
    timelineZh: "21 天完成放款",
    borrowerTypeEn: "Tech founders purchasing a second home",
    borrowerTypeZh: "科技创业者购置第二套住房",
    productEn: "Jumbo ARM · 80% LTV",
    productZh: "大额 ARM · 80% 成数",
    highlightEn: "Rate locked at 5.75% with asset-based underwriting",
    highlightZh: "资产核算审批，利率锁定 5.75%",
    heroImageUrl,
    published: true
  };

  await prisma.dealCase.upsert({
    where: { caseCode },
    update: {
      ...baseData,
      images: {
        deleteMany: {},
        create: galleryImages
      }
    },
    create: {
      caseCode,
      ...baseData,
      images: {
        create: galleryImages
      }
    }
  });

  console.log(`Deal case "${caseCode}" seeded successfully.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

