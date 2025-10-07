export type LoanDirectoryEntry = {
  state: string;
  lender: string;
  product: string;
  highlight: string;
  broker: string;
};

export type LoanProduct = {
  id: string;
  state: string;
  name: string;
  rate: string;
  ltv: string;
  closingSpeed: string;
  successRate: number;
  criteria: string[];
  brokerCode: string;
};

export const loanDirectory: LoanDirectoryEntry[] = [
  {
    state: "California",
    lender: "Pacific Crest Lending",
    product: "30-Year Fixed - First-Time Buyer Advantage",
    highlight: "Down payment from 15%, credit score 680+ eligible",
    broker: "Joanna W. - Bay Area specialist"
  },
  {
    state: "New York",
    lender: "Empire State Mortgage",
    product: "Premium Jumbo Loan",
    highlight: "Supports 90% LTV with streamlined income verification",
    broker: "Michael C. - Manhattan licensed broker"
  },
  {
    state: "Washington",
    lender: "Rainier Financial",
    product: "Tech Professional Accelerator",
    highlight: "Accepts international credit history, expedited underwriting",
    broker: "Karen P. - Seattle senior advisor"
  },
  {
    state: "Massachusetts",
    lender: "Commonwealth Trust",
    product: "Education Leader Mortgage",
    highlight: "Employer contribution counts toward down payment, extra 0.15% rate credit",
    broker: "Ben S. - Boston partner"
  },
  {
    state: "Virginia",
    lender: "Old Dominion Capital",
    product: "Public Service Green Mortgage",
    highlight: "30% faster approvals, flexible hybrid rate options",
    broker: "Christina L. - DC metro"
  },
  {
    state: "Texas",
    lender: "Lone Star Home Finance",
    product: "Self-Employed Cashflow Loan",
    highlight: "Bank statements + 1099 accepted, average close in 12 days",
    broker: "Eduardo G. - Austin / Dallas dual license"
  },
  {
    state: "Florida",
    lender: "Sunline Mortgage",
    product: "Vacation Rental Financing",
    highlight: "Short-term rental income qualified, rates from 5.8%",
    broker: "Amy T. - Miami team"
  },
  {
    state: "North Carolina",
    lender: "Blue Ridge Lending",
    product: "Remote Work Starter Mortgage",
    highlight: "Down payment from 10%, relocation advisory included",
    broker: "Jordan M. - Charlotte director"
  },
  {
    state: "Colorado",
    lender: "Summit Peak Mortgage",
    product: "Sustainable Home Loan",
    highlight: "Energy-efficient homes save 0.25% in fees",
    broker: "Sophie D. - Denver team"
  },
  {
    state: "Illinois",
    lender: "Lakeside Capital",
    product: "Urban High-Rise Program",
    highlight: "Co-borrowers eligible for first-time buyer incentives",
    broker: "Marcus H. - Chicago market lead"
  }
];

export const loanProducts: LoanProduct[] = [
  {
    id: "CA-01",
    state: "California",
    name: "Pacific Crest Lending - Bay Area Elite Fixed",
    rate: "From 5.65%",
    ltv: "Up to 85% LTV",
    closingSpeed: "Average 14-day close",
    successRate: 92,
    criteria: ["Tech professionals", "Credit score 700+", "Alt doc available"],
    brokerCode: "J.Ward@***"
  },
  {
    id: "CA-02",
    state: "California",
    name: "Golden Gate Mortgage - Silicon Starter",
    rate: "From 5.85%",
    ltv: "Up to 90% LTV",
    closingSpeed: "Average 18-day close",
    successRate: 88,
    criteria: ["First-time buyers", "RSUs counted", "Hybrid rate"],
    brokerCode: "C.Feng@***"
  },
  {
    id: "NY-01",
    state: "New York",
    name: "Empire State Mortgage - Metro Flex ARM",
    rate: "From 5.45%",
    ltv: "Up to 80% LTV",
    closingSpeed: "Average 20-day close",
    successRate: 89,
    criteria: ["NYC metro", "Investment property", "DSCR eligible"],
    brokerCode: "M.Collins@***"
  },
  {
    id: "NY-02",
    state: "New York",
    name: "Hudson Valley - International Bridge",
    rate: "From 5.75%",
    ltv: "Up to 75% LTV",
    closingSpeed: "Average 15-day close",
    successRate: 94,
    criteria: ["New immigrants", "Global assets", "Fast funding"],
    brokerCode: "A.Xu@***"
  },
  {
    id: "WA-01",
    state: "Washington",
    name: "Rainier Financial - Cloud Workforce Loan",
    rate: "From 5.68%",
    ltv: "Up to 85% LTV",
    closingSpeed: "Average 16-day close",
    successRate: 90,
    criteria: ["Remote workers", "Tech sector", "CDFI options"],
    brokerCode: "E.Song@***"
  },
  {
    id: "TX-01",
    state: "Texas",
    name: "Lone Star Home Finance - Flex Income",
    rate: "From 5.52%",
    ltv: "Up to 87% LTV",
    closingSpeed: "Average 12-day close",
    successRate: 91,
    criteria: ["Self-employed", "Bank statement program", "Quick closing"],
    brokerCode: "D.Rivera@***"
  },
  {
    id: "FL-01",
    state: "Florida",
    name: "Sunline Mortgage - Coastal Retreat",
    rate: "From 5.58%",
    ltv: "Up to 82% LTV",
    closingSpeed: "Average 19-day close",
    successRate: 87,
    criteria: ["Vacation homes", "Short-term rentals", "High rental yield"],
    brokerCode: "L.Mendez@***"
  },
  {
    id: "MA-01",
    state: "Massachusetts",
    name: "Commonwealth Trust - Scholar Prime",
    rate: "From 5.40%",
    ltv: "Up to 88% LTV",
    closingSpeed: "Average 17-day close",
    successRate: 90,
    criteria: ["Education sector", "Research staff", "Grant stacking"],
    brokerCode: "R.Klein@***"
  },
  {
    id: "CO-01",
    state: "Colorado",
    name: "Summit Peak - Alpine Green Mortgage",
    rate: "From 5.60%",
    ltv: "Up to 83% LTV",
    closingSpeed: "Average 15-day close",
    successRate: 89,
    criteria: ["Green homes", "Energy certification", "Hybrid rate"],
    brokerCode: "S.Doyle@***"
  },
  {
    id: "VA-01",
    state: "Virginia",
    name: "Old Dominion - Federal FastTrack",
    rate: "From 5.48%",
    ltv: "Up to 85% LTV",
    closingSpeed: "Average 13-day close",
    successRate: 95,
    criteria: ["Public sector", "Fast approvals", "Fixed/ARM mix"],
    brokerCode: "T.Nguyen@***"
  },
  {
    id: "NC-01",
    state: "North Carolina",
    name: "Blue Ridge Lending - Relocation Prime",
    rate: "From 5.63%",
    ltv: "Up to 86% LTV",
    closingSpeed: "Average 18-day close",
    successRate: 88,
    criteria: ["Remote roles", "Relocation support", "Lower down payment"],
    brokerCode: "H.Oliver@***"
  },
  {
    id: "IL-01",
    state: "Illinois",
    name: "Lakeside Capital - Metro Highrise",
    rate: "From 5.70%",
    ltv: "Up to 80% LTV",
    closingSpeed: "Average 21-day close",
    successRate: 86,
    criteria: ["High-rise condos", "Co-borrower friendly", "Urban core"],
    brokerCode: "C.Jones@***"
  }
];

export const chatQuestions: string[] = [
  "Where is the property you plan to finance? Let me know the city, state, or zip code.",
  "What timeline are you targeting for closing? Have you already signed a purchase contract?",
  "Which loan factors matter the most to you? For example: rate, loan-to-value, speed to close, or document requirements."
];
