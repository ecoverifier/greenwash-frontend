"use client";
import React, { useState } from 'react';
import { Portfolio, PortfolioCompany } from '@/app/types/portfolio';
import { FaPlus, FaTimes } from 'react-icons/fa';
import { HiCheck } from 'react-icons/hi2';

interface CreatePortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (portfolio: Omit<Portfolio, 'id' | 'createdAt' | 'updatedAt'>) => void;
  availableCompanies?: Array<{ company: string; greenscore: number; reportId: string }>;
  editingPortfolio?: Portfolio | null;
  onUpdate?: (portfolioId: string, portfolio: Omit<Portfolio, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

const CreatePortfolioModal: React.FC<CreatePortfolioModalProps> = ({
  isOpen,
  onClose,
  onSave,
  availableCompanies = [],
  editingPortfolio = null,
  onUpdate
}) => {
  const [portfolioName, setPortfolioName] = useState(editingPortfolio?.name || '');
  const [portfolioDescription, setPortfolioDescription] = useState(editingPortfolio?.description || '');
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>(
    editingPortfolio?.companies.map(c => c.company) || []
  );
  const [customCompany, setCustomCompany] = useState('');
  const [customScore, setCustomScore] = useState<number>(50);

  // Reset form when editingPortfolio changes
  React.useEffect(() => {
    if (editingPortfolio) {
      setPortfolioName(editingPortfolio.name);
      setPortfolioDescription(editingPortfolio.description || '');
      setSelectedCompanies(editingPortfolio.companies.map(c => c.company));
    } else {
      setPortfolioName('');
      setPortfolioDescription('');
      setSelectedCompanies([]);
    }
    setCustomCompany('');
    setCustomScore(50);
  }, [editingPortfolio, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!portfolioName.trim()) return;

    const companies: PortfolioCompany[] = [];
    
    // Add selected existing companies
    selectedCompanies.forEach(companyName => {
      const company = availableCompanies.find(c => c.company === companyName);
      if (company) {
        companies.push({
          id: crypto.randomUUID(),
          company: company.company,
          greenscore: company.greenscore,
          addedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          reportId: company.reportId
        });
      }
    });

    // Add custom company if provided
    if (customCompany.trim()) {
      companies.push({
        id: crypto.randomUUID(),
        company: customCompany.trim(),
        greenscore: customScore,
        addedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });
    }

    const portfolioData: Omit<Portfolio, 'id' | 'createdAt' | 'updatedAt'> = {
      name: portfolioName.trim(),
      description: portfolioDescription.trim() || undefined,
      companies
    };

    if (editingPortfolio && onUpdate) {
      // Edit mode
      onUpdate(editingPortfolio.id, portfolioData);
    } else {
      // Create mode
      onSave(portfolioData);
    }
    
    // Reset form
    setPortfolioName('');
    setPortfolioDescription('');
    setSelectedCompanies([]);
    setCustomCompany('');
    setCustomScore(50);
  };

  const toggleCompanySelection = (companyName: string) => {
    setSelectedCompanies(prev => 
      prev.includes(companyName)
        ? prev.filter(name => name !== companyName)
        : [...prev, companyName]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              {editingPortfolio ? 'Edit Portfolio' : 'Create Portfolio'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <FaTimes className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Portfolio Name *
              </label>
              <input
                type="text"
                value={portfolioName}
                onChange={(e) => setPortfolioName(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm text-gray-900"
                placeholder="e.g., Tech Giants, Green Energy"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={portfolioDescription}
                onChange={(e) => setPortfolioDescription(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none text-sm text-gray-900"
                rows={2}
                placeholder="Optional description..."
              />
            </div>

            {availableCompanies.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add from analyzed companies
                </label>
                <div className="max-h-28 sm:max-h-32 overflow-y-auto border border-gray-200 rounded-md p-2 space-y-1">
                  {availableCompanies.map((company) => (
                    <label
                      key={company.company}
                      className="flex items-center gap-2 cursor-pointer p-1 hover:bg-gray-50 rounded text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCompanies.includes(company.company)}
                        onChange={() => toggleCompanySelection(company.company)}
                        className="text-emerald-600 flex-shrink-0"
                      />
                      <span className="flex-1 truncate">{company.company}</span>
                      <span className="text-xs text-gray-800 flex-shrink-0">
                        {company.greenscore}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Add custom company
              </label>
              <div className="space-y-3">
                <input
                  type="text"
                  value={customCompany}
                  onChange={(e) => setCustomCompany(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm text-gray-900"
                  placeholder="Company name"
                />
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Estimated GreenScore: {customScore}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={customScore}
                    onChange={(e) => setCustomScore(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition text-sm order-2 sm:order-1 sm:flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!portfolioName.trim()}
                className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition text-sm order-1 sm:order-2 sm:flex-1"
              >
                {editingPortfolio ? 'Update Portfolio' : 'Create Portfolio'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreatePortfolioModal;