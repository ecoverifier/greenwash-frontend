// Utility functions for portfolio management
import { Portfolio, PortfolioCompany, PortfolioInsights, PortfolioReport } from '@/app/types/portfolio';

export const calculatePortfolioInsights = (portfolio: Portfolio): PortfolioInsights => {
  const companies = portfolio.companies;
  const totalCompanies = companies.length;

  if (totalCompanies === 0) {
    return {
      averageScore: 0,
      totalCompanies: 0,
      scoreDistribution: { excellent: 0, good: 0, fair: 0, poor: 0 },
      highPerformers: [],
      lowPerformers: [],
      trend: { improving: 0, declining: 0, stable: 0 }
    };
  }

  // Calculate average score
  const averageScore = companies.reduce((sum, company) => sum + company.greenscore, 0) / totalCompanies;

  // Calculate score distribution
  const scoreDistribution = companies.reduce((dist, company) => {
    if (company.greenscore >= 80) dist.excellent++;
    else if (company.greenscore >= 60) dist.good++;
    else if (company.greenscore >= 40) dist.fair++;
    else dist.poor++;
    return dist;
  }, { excellent: 0, good: 0, fair: 0, poor: 0 });

  // Sort companies by score
  const sortedByScore = [...companies].sort((a, b) => b.greenscore - a.greenscore);
  
  // Get top and bottom performers
  const highPerformers = sortedByScore.slice(0, 3);
  const lowPerformers = sortedByScore.slice(-3).reverse();

  // For now, trend analysis is simplified (would require historical data)
  const trend = {
    improving: 0,
    declining: 0,
    stable: totalCompanies
  };

  return {
    averageScore: Math.round(averageScore * 10) / 10,
    totalCompanies,
    scoreDistribution,
    highPerformers,
    lowPerformers,
    trend
  };
};

export const generatePortfolioReport = (portfolio: Portfolio): PortfolioReport => {
  return {
    portfolio,
    insights: calculatePortfolioInsights(portfolio),
    generatedAt: new Date().toISOString()
  };
};

export const getScoreColor = (score: number): string => {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
};

export const getScoreColorBg = (score: number): string => {
  if (score >= 80) return 'bg-green-100';
  if (score >= 60) return 'bg-yellow-100';
  if (score >= 40) return 'bg-orange-100';
  return 'bg-red-100';
};

export const getScoreLabel = (score: number): string => {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
};

export const exportPortfolioToCSV = (portfolio: Portfolio): string => {
  const headers = ['Company', 'GreenScore', 'Score Label', 'Added Date', 'Last Updated'];
  const rows = portfolio.companies.map(company => [
    company.company,
    company.greenscore.toString(),
    getScoreLabel(company.greenscore),
    new Date(company.addedAt).toLocaleDateString(),
    new Date(company.lastUpdated).toLocaleDateString()
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');

  return csvContent;
};

export const downloadPortfolioCSV = (portfolio: Portfolio): void => {
  const csvContent = exportPortfolioToCSV(portfolio);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${portfolio.name.replace(/[^a-zA-Z0-9]/g, '_')}_portfolio.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};