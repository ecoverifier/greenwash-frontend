"use client";
import React, { useState, useEffect } from 'react';
import { Portfolio, PortfolioCompany } from '@/app/types/portfolio';
import CreatePortfolioModal from '@/app/components/CreatePortfolioModal';
import PortfolioView from '@/app/components/PortfolioView';
import Layout from '@/app/components/Layout';
import { FaPlus, FaFolderOpen, FaTrashAlt } from 'react-icons/fa';
import { auth, db } from '@/app/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  updateDoc
} from 'firebase/firestore';

interface Report {
  id: string;
  company: string;
  uid?: string;
  createdAt: string;
  report: {
    company: string;
    greenscore: {
      score: number;
    };
  };
}

const PortfolioPage: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
  const [editingPortfolio, setEditingPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      fetchData(u?.uid);
    });
    return () => unsubscribe();
  }, []);

  const fetchData = async (uid?: string) => {
    setLoading(true);
    try {
      await Promise.all([
        fetchPortfolios(uid),
        fetchReports(uid)
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPortfolios = async (uid?: string) => {
    if (uid) {
      // Fetch from Firestore for authenticated users
      const q = query(
        collection(db, 'portfolios'),
        where('uid', '==', uid)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as Portfolio[];
      // Sort client-side by createdAt descending
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPortfolios(data);
    } else {
      // Fetch from localStorage for anonymous users
      const stored = localStorage.getItem('anon_portfolios');
      setPortfolios(stored ? JSON.parse(stored) : []);
    }
  };

  const fetchReports = async (uid?: string) => {
    if (uid) {
      // Fetch from Firestore for authenticated users
      const q = query(
        collection(db, 'reports'),
        where('uid', '==', uid)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as Report[];
      // Sort client-side by createdAt descending
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setReports(data);
    } else {
      // Fetch from localStorage for anonymous users
      const stored = localStorage.getItem('anon_reports');
      setReports(stored ? JSON.parse(stored) : []);
    }
  };

  const handleCreatePortfolio = async (portfolioData: Omit<Portfolio, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    
    try {
      if (user) {
        // Save to Firestore for authenticated users (let Firestore generate ID)
        const docRef = await addDoc(collection(db, 'portfolios'), {
          ...portfolioData,
          createdAt: now,
          updatedAt: now,
          uid: user.uid
        });
        
        const newPortfolio: Portfolio = {
          ...portfolioData,
          id: docRef.id,
          createdAt: now,
          updatedAt: now,
          uid: user.uid
        };
        
        setPortfolios(prev => [newPortfolio, ...prev]);
      } else {
        // Save to localStorage for anonymous users
        const newPortfolio: Portfolio = {
          ...portfolioData,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
          uid: undefined
        };
        
        const updatedPortfolios = [newPortfolio, ...portfolios];
        localStorage.setItem('anon_portfolios', JSON.stringify(updatedPortfolios));
        setPortfolios(prev => [newPortfolio, ...prev]);
      }
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error('Error creating portfolio:', error);
    }
  };

  const handleDeletePortfolio = async (portfolioId: string) => {
    if (!confirm('Are you sure you want to delete this portfolio?')) {
      return;
    }

    try {
      if (user) {
        // Delete from Firestore
        await deleteDoc(doc(db, 'portfolios', portfolioId));
      } else {
        // Update localStorage
        const updatedPortfolios = portfolios.filter(p => p.id !== portfolioId);
        localStorage.setItem('anon_portfolios', JSON.stringify(updatedPortfolios));
      }

      setPortfolios(prev => prev.filter(p => p.id !== portfolioId));
      if (selectedPortfolio?.id === portfolioId) {
        setSelectedPortfolio(null);
      }
    } catch (error) {
      console.error('Error deleting portfolio:', error);
    }
  };

  const handleEditPortfolio = (portfolio: Portfolio) => {
    setEditingPortfolio(portfolio);
    setIsCreateModalOpen(true);
  };

  const handleUpdatePortfolio = async (portfolioId: string, portfolioData: Omit<Portfolio, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const updatedAt = new Date().toISOString();
      const updatedPortfolio = {
        ...portfolioData,
        updatedAt
      };

      if (user) {
        // Update in Firestore
        await updateDoc(doc(db, 'portfolios', portfolioId), updatedPortfolio);
      } else {
        // Update localStorage for anonymous users
        const updatedPortfolios = portfolios.map(p => 
          p.id === portfolioId 
            ? { ...p, ...updatedPortfolio }
            : p
        );
        localStorage.setItem('anon_portfolios', JSON.stringify(updatedPortfolios));
      }

      // Update local state
      setPortfolios(prev => prev.map(p => 
        p.id === portfolioId 
          ? { ...p, ...updatedPortfolio }
          : p
      ));
      
      // Update selected portfolio if it's the one being edited
      if (selectedPortfolio?.id === portfolioId) {
        setSelectedPortfolio(prev => prev ? { ...prev, ...updatedPortfolio } : null);
      }

      // Close modal and reset editing state
      setIsCreateModalOpen(false);
      setEditingPortfolio(null);
    } catch (error) {
      console.error('Error updating portfolio:', error);
    }
  };

  const handleAddCompany = async (portfolioId: string, company: PortfolioCompany) => {
    const portfolioIndex = portfolios.findIndex(p => p.id === portfolioId);
    if (portfolioIndex === -1) return;

    const updatedPortfolios = [...portfolios];
    const portfolio = { ...updatedPortfolios[portfolioIndex] };
    portfolio.companies = [...portfolio.companies, company];
    portfolio.updatedAt = new Date().toISOString();
    updatedPortfolios[portfolioIndex] = portfolio;

    try {
      if (user) {
        // Update in Firestore
        await updateDoc(doc(db, 'portfolios', portfolioId), {
          companies: portfolio.companies,
          updatedAt: portfolio.updatedAt
        });
      } else {
        // Update localStorage
        localStorage.setItem('anon_portfolios', JSON.stringify(updatedPortfolios));
      }

      setPortfolios(updatedPortfolios);
      if (selectedPortfolio?.id === portfolioId) {
        setSelectedPortfolio(portfolio);
      }
    } catch (error) {
      console.error('Error adding company to portfolio:', error);
    }
  };

  const handleRemoveCompany = async (portfolioId: string, companyId: string) => {
    const portfolioIndex = portfolios.findIndex(p => p.id === portfolioId);
    if (portfolioIndex === -1) return;

    const updatedPortfolios = [...portfolios];
    const portfolio = { ...updatedPortfolios[portfolioIndex] };
    portfolio.companies = portfolio.companies.filter(c => c.id !== companyId);
    portfolio.updatedAt = new Date().toISOString();
    updatedPortfolios[portfolioIndex] = portfolio;

    try {
      if (user) {
        // Update in Firestore
        await updateDoc(doc(db, 'portfolios', portfolioId), {
          companies: portfolio.companies,
          updatedAt: portfolio.updatedAt
        });
      } else {
        // Update localStorage
        localStorage.setItem('anon_portfolios', JSON.stringify(updatedPortfolios));
      }

      setPortfolios(updatedPortfolios);
      if (selectedPortfolio?.id === portfolioId) {
        setSelectedPortfolio(portfolio);
      }
    } catch (error) {
      console.error('Error removing company from portfolio:', error);
    }
  };

  // Convert reports to available companies for the create modal
  const availableCompanies = reports
    .filter(r => r.report?.greenscore?.score !== undefined)
    .map(r => ({
      company: r.report.company,
      greenscore: r.report.greenscore.score,
      reportId: r.id
    }));

  return (
    <Layout title="Portfolios - EcoVerifier" showSidebar={false}>
      {loading ? (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
            <p className="mt-2 text-gray-900 text-sm lg:text-base">Loading portfolios...</p>
          </div>
        </div>
      ) : (
        <div className="min-h-screen bg-gray-50">
          {/* Page Header */}
          <div className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Portfolios</h1>
                  <p className="text-sm lg:text-base text-gray-800 mt-1">
                    Create and manage portfolios to track multiple companies' sustainability performance
                  </p>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm lg:text-base whitespace-nowrap"
                >
                  <FaPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">Create Portfolio</span>
                  <span className="sm:hidden">Create</span>
                </button>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
              {/* Portfolio List */}
              <div className="lg:col-span-1 order-1 lg:order-1">
                <div className="bg-white rounded-lg shadow-sm p-4">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Your Portfolios ({portfolios.length})
                  </h2>
                  
                  {portfolios.length === 0 ? (
                    <div className="text-center py-6 lg:py-8 text-gray-900">
                      <FaFolderOpen className="w-8 h-8 lg:w-12 lg:h-12 mx-auto mb-3 text-gray-400" />
                      <p className="text-sm">No portfolios yet</p>
                      <p className="text-xs">Create your first portfolio to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {portfolios.map((portfolio) => (
                        <div
                          key={portfolio.id}
                          className={`relative group rounded-lg transition border-2 ${
                            selectedPortfolio?.id === portfolio.id
                              ? 'bg-emerald-50 border-emerald-200'
                              : 'bg-gray-50 hover:bg-gray-100 border-transparent'
                          }`}
                        >
                          <button
                            onClick={() => setSelectedPortfolio(portfolio)}
                            className="w-full text-left p-3 pr-12"
                          >
                            <div className="font-medium text-gray-900 truncate text-sm lg:text-base">
                              {portfolio.name}
                            </div>
                            <div className="text-xs lg:text-sm text-gray-900">
                              {portfolio.companies.length} companies
                            </div>
                            {portfolio.companies.length > 0 && (
                              <div className="text-xs text-gray-900 mt-1">
                                Avg: {(
                                  portfolio.companies.reduce((sum, c) => sum + c.greenscore, 0) / 
                                  portfolio.companies.length
                                ).toFixed(1)}
                              </div>
                            )}
                          </button>
                          
                          {/* Delete button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePortfolio(portfolio.id);
                            }}
                            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 transition-opacity opacity-0 group-hover:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                            title="Delete portfolio"
                          >
                            <FaTrashAlt className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Portfolio Detail */}
              <div className="lg:col-span-3 order-2 lg:order-2">
                {selectedPortfolio ? (
                  <PortfolioView
                    portfolio={selectedPortfolio}
                    onEdit={handleEditPortfolio}
                    onDelete={handleDeletePortfolio}
                    onAddCompany={handleAddCompany}
                    onRemoveCompany={handleRemoveCompany}
                  />
                ) : (
                  <div className="bg-white rounded-lg shadow-sm p-8 lg:p-12 text-center">
                    <FaFolderOpen className="w-12 h-12 lg:w-16 lg:h-16 mx-auto mb-4 text-gray-400" />
                    <h3 className="text-lg lg:text-xl font-medium text-gray-900 mb-2">
                      {portfolios.length === 0 ? 'Create Your First Portfolio' : 'Select a Portfolio'}
                    </h3>
                    <p className="text-sm lg:text-base text-gray-800 mb-6">
                      {portfolios.length === 0 
                        ? 'Get started by creating a portfolio to track multiple companies.'
                        : 'Choose a portfolio from the list above to view its details and manage companies.'}
                    </p>
                    {portfolios.length === 0 && (
                      <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="px-4 lg:px-6 py-2 lg:py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm lg:text-base"
                      >
                        Create Your First Portfolio
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Create/Edit Portfolio Modal */}
          <CreatePortfolioModal
            isOpen={isCreateModalOpen}
            onClose={() => {
              setIsCreateModalOpen(false);
              setEditingPortfolio(null);
            }}
            onSave={handleCreatePortfolio}
            onUpdate={handleUpdatePortfolio}
            editingPortfolio={editingPortfolio}
            availableCompanies={availableCompanies}
          />
        </div>
      )}
    </Layout>
  );
};

export default PortfolioPage;