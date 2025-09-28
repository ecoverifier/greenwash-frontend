"use client";
import React, { useState } from 'react';
import { Portfolio, PortfolioCompany } from '@/app/types/portfolio';
import { calculatePortfolioInsights, getScoreColor, getScoreColorBg, getScoreLabel, downloadPortfolioCSV } from '@/app/utils/portfolioUtils';
import { FaDownload, FaEdit, FaTrashAlt, FaPlus, FaMinus } from 'react-icons/fa';
import { HiTrendingUp, HiTrendingDown } from 'react-icons/hi';

interface PortfolioViewProps {
  portfolio: Portfolio;
  onEdit: (portfolio: Portfolio) => void;
  onDelete: (portfolioId: string) => void;
  onAddCompany: (portfolioId: string, company: PortfolioCompany) => void;
  onRemoveCompany: (portfolioId: string, companyId: string) => void;
}

const PortfolioView: React.FC<PortfolioViewProps> = ({
  portfolio,
  onEdit,
  onDelete,
  onAddCompany,
  onRemoveCompany
}) => {
  const [showInsights, setShowInsights] = useState(true);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyScore, setNewCompanyScore] = useState(50);
  const [showAddForm, setShowAddForm] = useState(false);

  const insights = calculatePortfolioInsights(portfolio);

  const handleAddCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;

    const newCompany: PortfolioCompany = {
      id: crypto.randomUUID(),
      company: newCompanyName.trim(),
      greenscore: newCompanyScore,
      addedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    onAddCompany(portfolio.id, newCompany);
    setNewCompanyName('');
    setNewCompanyScore(50);
    setShowAddForm(false);
  };

  const handleExportCSV = () => {
    downloadPortfolioCSV(portfolio);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 lg:p-6 space-y-4 lg:space-y-6">
      {/* Portfolio Header */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
        <div className="flex-1">
          <h2 className="text-xl lg:text-2xl font-bold text-gray-900">{portfolio.name}</h2>
          {portfolio.description && (
            <p className="text-sm lg:text-base text-gray-800 mt-1">{portfolio.description}</p>
          )}
          <p className="text-xs lg:text-sm text-gray-900 mt-2">
            Created: {new Date(portfolio.createdAt).toLocaleDateString()}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 text-xs lg:text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center gap-1"
          >
            <FaDownload className="w-3 h-3" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={() => onEdit(portfolio)}
            className="px-3 py-2 text-xs lg:text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition flex items-center gap-1"
          >
            <FaEdit className="w-3 h-3" />
            <span className="hidden sm:inline">Edit</span>
          </button>
          <button
            onClick={() => onDelete(portfolio.id)}
            className="px-3 py-2 text-xs lg:text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition flex items-center gap-1"
          >
            <FaTrashAlt className="w-3 h-3" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      </div>

      {/* Portfolio Insights */}
      <div className="border-t pt-4 lg:pt-6">
        <button
          onClick={() => setShowInsights(!showInsights)}
          className="flex items-center gap-2 text-base lg:text-lg font-semibold text-gray-900 hover:text-emerald-600 transition mb-4"
        >
          Portfolio Insights
          {showInsights ? <FaMinus className="w-4 h-4" /> : <FaPlus className="w-4 h-4" />}
        </button>

        {showInsights && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
              <div className="bg-emerald-50 p-3 lg:p-4 rounded-lg">
                <h3 className="text-xs lg:text-sm font-medium text-emerald-800 mb-2">Average GreenScore</h3>
                <div className="text-xl lg:text-2xl font-bold text-emerald-600">
                  {insights.averageScore.toFixed(1)}
                </div>
              </div>
              
              <div className="bg-blue-50 p-3 lg:p-4 rounded-lg">
                <h3 className="text-xs lg:text-sm font-medium text-blue-800 mb-2">Total Companies</h3>
                <div className="text-xl lg:text-2xl font-bold text-blue-600">
                  {insights.totalCompanies}
                </div>
              </div>
              
              <div className="bg-purple-50 p-3 lg:p-4 rounded-lg sm:col-span-2 lg:col-span-1">
                <h3 className="text-xs lg:text-sm font-medium text-purple-800 mb-2">Score Rating</h3>
                <div className="text-lg lg:text-lg font-bold text-purple-600">
                  {getScoreLabel(insights.averageScore)}
                </div>
              </div>
            </div>

            {/* Score Distribution */}
            <div>
              <h3 className="text-xs lg:text-sm font-medium text-gray-900 mb-3">Score Distribution</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
                <div className="text-center p-2 lg:p-3 bg-green-50 rounded-lg">
                  <div className="text-base lg:text-lg font-bold text-green-600">
                    {insights.scoreDistribution.excellent}
                  </div>
                  <div className="text-xs text-green-700">Excellent (80+)</div>
                </div>
                <div className="text-center p-2 lg:p-3 bg-yellow-50 rounded-lg">
                  <div className="text-base lg:text-lg font-bold text-yellow-600">
                    {insights.scoreDistribution.good}
                  </div>
                  <div className="text-xs text-yellow-700">Good (60-79)</div>
                </div>
                <div className="text-center p-2 lg:p-3 bg-orange-50 rounded-lg">
                  <div className="text-base lg:text-lg font-bold text-orange-600">
                    {insights.scoreDistribution.fair}
                  </div>
                  <div className="text-xs text-orange-700">Fair (40-59)</div>
                </div>
                <div className="text-center p-2 lg:p-3 bg-red-50 rounded-lg">
                  <div className="text-base lg:text-lg font-bold text-red-600">
                    {insights.scoreDistribution.poor}
                  </div>
                  <div className="text-xs text-red-700">Poor (0-39)</div>
                </div>
              </div>
            </div>

            {/* Top and Bottom Performers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
              {insights.highPerformers.length > 0 && (
                <div>
                  <h3 className="text-xs lg:text-sm font-medium text-gray-900 mb-3 flex items-center gap-1">
                    <HiTrendingUp className="w-4 h-4 text-green-500" />
                    Top Performers
                  </h3>
                  <div className="space-y-2">
                    {insights.highPerformers.map((company) => (
                      <div key={company.id} className="flex justify-between items-center p-2 bg-green-50 rounded text-sm">
                        <span className="font-medium truncate mr-2">{company.company}</span>
                        <span className="font-bold text-green-600 flex-shrink-0">{company.greenscore}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {insights.lowPerformers.length > 0 && (
                <div>
                  <h3 className="text-xs lg:text-sm font-medium text-gray-900 mb-3 flex items-center gap-1">
                    <HiTrendingDown className="w-4 h-4 text-red-500" />
                    Areas for Improvement
                  </h3>
                  <div className="space-y-2">
                    {insights.lowPerformers.map((company) => (
                      <div key={company.id} className="flex justify-between items-center p-2 bg-red-50 rounded text-sm">
                        <span className="font-medium truncate mr-2">{company.company}</span>
                        <span className="font-bold text-red-600 flex-shrink-0">{company.greenscore}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Companies List */}
      <div className="border-t pt-4 lg:pt-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-3">
          <h3 className="text-base lg:text-lg font-semibold text-gray-900">Companies</h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-2 text-xs lg:text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition flex items-center justify-center gap-1"
          >
            <FaPlus className="w-3 h-3" />
            Add Company
          </button>
        </div>

        {/* Add Company Form */}
        {showAddForm && (
          <form onSubmit={handleAddCompany} className="mb-4 p-3 lg:p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="lg:col-span-1">
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm text-gray-900"
                  placeholder="Company name"
                  required
                />
              </div>
              <div className="lg:col-span-1">
                <div className="text-xs text-gray-900 mb-1">Score: {newCompanyScore}</div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={newCompanyScore}
                  onChange={(e) => setNewCompanyScore(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div className="flex gap-2 lg:col-span-1">
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition flex-1 text-sm"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-900 rounded-md hover:bg-gray-50 transition text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Companies List - Mobile Cards and Desktop Table */}
        <div className="lg:hidden">
          {/* Mobile Card Layout */}
          <div className="space-y-3">
            {portfolio.companies.map((company) => (
              <div key={company.id} className="bg-gray-50 rounded-lg p-3 border">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-gray-900 text-sm flex-1 mr-2">{company.company}</h4>
                  <button
                    onClick={() => onRemoveCompany(portfolio.id, company.id)}
                    className="text-red-500 hover:text-red-700 transition flex-shrink-0"
                    title="Remove company"
                  >
                    <FaTrashAlt className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className={`font-bold ${getScoreColor(company.greenscore)}`}>
                      Score: {company.greenscore}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColorBg(company.greenscore)} ${getScoreColor(company.greenscore)}`}>
                      {getScoreLabel(company.greenscore)}
                    </span>
                  </div>
                  <span className="text-gray-900">
                    {new Date(company.addedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="hidden lg:block">
          {/* Desktop Table Layout */}
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-medium text-gray-900">Company</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-900">GreenScore</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-900">Rating</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-900">Added</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.companies.map((company) => (
                  <tr key={company.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-2 font-medium">{company.company}</td>
                    <td className={`py-3 px-2 font-bold ${getScoreColor(company.greenscore)}`}>
                      {company.greenscore}
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColorBg(company.greenscore)} ${getScoreColor(company.greenscore)}`}>
                        {getScoreLabel(company.greenscore)}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-sm text-gray-900">
                      {new Date(company.addedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-2">
                      <button
                        onClick={() => onRemoveCompany(portfolio.id, company.id)}
                        className="text-red-500 hover:text-red-700 transition"
                        title="Remove company"
                      >
                        <FaTrashAlt className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {portfolio.companies.length === 0 && (
          <div className="text-center py-6 lg:py-8 text-gray-900">
            <p className="text-sm lg:text-base">No companies in this portfolio yet.</p>
            <p className="text-xs lg:text-sm">Click "Add Company" to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PortfolioView;