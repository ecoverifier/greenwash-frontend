// Portfolio-related TypeScript types
export interface PortfolioCompany {
  id: string;
  company: string;
  greenscore: number;
  addedAt: string;
  lastUpdated: string;
  reportId?: string; // Reference to the full report if available
}

export interface Portfolio {
  id: string;
  name: string;
  description?: string;
  companies: PortfolioCompany[];
  createdAt: string;
  updatedAt: string;
  uid?: string; // For authenticated users
}

export interface PortfolioInsights {
  averageScore: number;
  totalCompanies: number;
  scoreDistribution: {
    excellent: number; // 80-100
    good: number;      // 60-79
    fair: number;      // 40-59
    poor: number;      // 0-39
  };
  highPerformers: PortfolioCompany[]; // Top 3 by GreenScore
  lowPerformers: PortfolioCompany[];  // Bottom 3 by GreenScore
  trend: {
    improving: number;
    declining: number;
    stable: number;
  };
}

export interface PortfolioReport {
  portfolio: Portfolio;
  insights: PortfolioInsights;
  generatedAt: string;
}