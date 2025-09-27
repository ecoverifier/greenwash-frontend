"use client";
import React, { useState, useEffect } from 'react';
import { Portfolio, PortfolioCompany } from '@/app/types/portfolio';
import { FaPlus, FaCheck } from 'react-icons/fa';
import { auth, db } from '@/app/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc
} from 'firebase/firestore';

interface AddToPortfolioButtonProps {
  company: string;
  greenscore: number;
  reportId?: string;
  className?: string;
}

const AddToPortfolioButton: React.FC<AddToPortfolioButtonProps> = ({
  company,
  greenscore,
  reportId,
  className = ""
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [addedTo, setAddedTo] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      fetchPortfolios(u?.uid);
    });
    return () => unsubscribe();
  }, []);

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
      
      // Check which portfolios already contain this company
      const alreadyAdded = data
        .filter(portfolio => 
          portfolio.companies.some(c => c.company === company)
        )
        .map(portfolio => portfolio.id);
      setAddedTo(alreadyAdded);
    } else {
      // Fetch from localStorage for anonymous users
      const stored = localStorage.getItem('anon_portfolios');
      const data = stored ? JSON.parse(stored) : [];
      setPortfolios(data);
      
      // Check which portfolios already contain this company
      const alreadyAdded = data
        .filter((portfolio: Portfolio) => 
          portfolio.companies.some((c: PortfolioCompany) => c.company === company)
        )
        .map((portfolio: Portfolio) => portfolio.id);
      setAddedTo(alreadyAdded);
    }
  };

  const handleAddToPortfolio = async (portfolioId: string) => {
    const portfolio = portfolios.find(p => p.id === portfolioId);
    if (!portfolio) return;

    // Check if company already exists in portfolio
    if (portfolio.companies.some(c => c.company === company)) {
      return; // Already added
    }

    const newCompany: PortfolioCompany = {
      id: crypto.randomUUID(),
      company,
      greenscore,
      addedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      reportId
    };

    const updatedPortfolio = {
      ...portfolio,
      companies: [...portfolio.companies, newCompany],
      updatedAt: new Date().toISOString()
    };

    try {
      if (user) {
        // Update in Firestore
        await updateDoc(doc(db, 'portfolios', portfolioId), {
          companies: updatedPortfolio.companies,
          updatedAt: updatedPortfolio.updatedAt
        });
      } else {
        // Update localStorage
        const updatedPortfolios = portfolios.map(p => 
          p.id === portfolioId ? updatedPortfolio : p
        );
        localStorage.setItem('anon_portfolios', JSON.stringify(updatedPortfolios));
      }

      // Update local state
      setPortfolios(prev => prev.map(p => 
        p.id === portfolioId ? updatedPortfolio : p
      ));
      setAddedTo(prev => [...prev, portfolioId]);
      setShowDropdown(false);
    } catch (error) {
      console.error('Error adding company to portfolio:', error);
    }
  };

  if (portfolios.length === 0) {
    return (
      <a
        href="/portfolios"
        className={`inline-flex items-center gap-1 px-3 py-1 text-xs bg-emerald-100 text-emerald-700 rounded-full hover:bg-emerald-200 transition ${className}`}
      >
        <FaPlus className="w-3 h-3" />
        Create Portfolio
      </a>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-emerald-100 text-emerald-700 rounded-full hover:bg-emerald-200 transition"
      >
        <FaPlus className="w-3 h-3" />
        Add to Portfolio
      </button>

      {showDropdown && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-48">
          <div className="p-2">
            <div className="text-xs font-medium text-gray-700 mb-2 px-2">
              Add "{company}" to:
            </div>
            <div className="max-h-40 overflow-y-auto">
              {portfolios.map(portfolio => {
                const isAdded = addedTo.includes(portfolio.id);
                return (
                  <button
                    key={portfolio.id}
                    onClick={() => !isAdded && handleAddToPortfolio(portfolio.id)}
                    disabled={isAdded}
                    className={`w-full text-left px-2 py-1 text-xs rounded hover:bg-gray-50 transition flex items-center gap-2 ${
                      isAdded ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 cursor-pointer'
                    }`}
                  >
                    {isAdded && <FaCheck className="w-3 h-3 text-green-500" />}
                    <span className="flex-1 truncate">
                      {portfolio.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {portfolio.companies.length}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="border-t mt-2 pt-2">
              <a
                href="/portfolios"
                className="block w-full text-center px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 rounded transition"
              >
                Manage Portfolios
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Overlay to close dropdown */}
      {showDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
};

export default AddToPortfolioButton;