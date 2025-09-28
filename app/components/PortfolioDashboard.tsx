"use client";
import React, { useState, useEffect } from 'react';
import { Portfolio } from '@/app/types/portfolio';
import { calculatePortfolioInsights, getScoreColor } from '@/app/utils/portfolioUtils';
import { FaFolderOpen, FaArrowRight } from 'react-icons/fa';
import { auth, db } from '@/app/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  getDocs,
  query,
  where
} from 'firebase/firestore';

const PortfolioDashboard: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      fetchPortfolios(u?.uid);
    });
    return () => unsubscribe();
  }, []);

  const fetchPortfolios = async (uid?: string) => {
    setLoading(true);
    try {
      if (uid) {
        // Fetch recent portfolios from Firestore for authenticated users
        const q = query(
          collection(db, 'portfolios'),
          where('uid', '==', uid)
        );
        const snapshot = await getDocs(q);
        let data = snapshot.docs.map((doc) => ({ 
          id: doc.id, 
          ...doc.data() 
        })) as Portfolio[];
        // Sort client-side by updatedAt descending and take first 3
        data.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        data = data.slice(0, 3); // Limit to 3 results after sorting
        setPortfolios(data);
      } else {
        // Fetch from localStorage for anonymous users
        const stored = localStorage.getItem('anon_portfolios');
        const allPortfolios = stored ? JSON.parse(stored) : [];
        // Get the 3 most recently updated portfolios
        const recent = allPortfolios
          .sort((a: Portfolio, b: Portfolio) => 
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )
          .slice(0, 3);
        setPortfolios(recent);
      }
    } catch (error) {
      console.error('Error fetching portfolios:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-100 rounded"></div>
            <div className="h-16 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (portfolios.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Portfolios</h3>
        <div className="text-center py-8">
          <FaFolderOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-800 text-sm mb-4">
            Create portfolios to track multiple companies' sustainability performance
          </p>
          <a
            href="/portfolios"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm"
          >
            Create Your First Portfolio
            <FaArrowRight className="w-3 h-3" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Your Portfolios</h3>
        <a
          href="/portfolios"
          className="text-sm text-emerald-600 hover:text-emerald-700 transition flex items-center gap-1"
        >
          View All
          <FaArrowRight className="w-3 h-3" />
        </a>
      </div>
      
      <div className="space-y-3">
        {portfolios.map((portfolio) => {
          const insights = calculatePortfolioInsights(portfolio);
          return (
            <a
              key={portfolio.id}
              href="/portfolios"
              className="block p-4 border border-gray-200 rounded-lg hover:border-emerald-200 hover:bg-emerald-50 transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-1">{portfolio.name}</h4>
                  <div className="flex items-center gap-4 text-sm text-gray-800">
                    <span>{insights.totalCompanies} companies</span>
                    {insights.totalCompanies > 0 && (
                      <>
                        <span className="text-gray-300">•</span>
                        <span className={`font-medium ${getScoreColor(insights.averageScore)}`}>
                          Avg: {insights.averageScore}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">
                    Updated {new Date(portfolio.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </a>
          );
        })}
      </div>
      
      {portfolios.length >= 3 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <a
            href="/portfolios"
            className="block text-center text-sm text-emerald-600 hover:text-emerald-700 transition"
          >
            View All Portfolios →
          </a>
        </div>
      )}
    </div>
  );
};

export default PortfolioDashboard;