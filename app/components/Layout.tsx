"use client";
import React, { useState, useEffect } from 'react';
import { auth } from '@/app/firebase';
import { signInWithPopup, signOut, provider } from '@/app/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { FiLogIn, FiLogOut, FiMenu, FiX } from 'react-icons/fi';
import { FaPlus } from 'react-icons/fa';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  showSidebar?: boolean;
  sidebarContent?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  title = "EcoVerifier", 
  showSidebar = false,
  sidebarContent 
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <>
      {/* Header Section - Consistent across all pages */}
      <header className={`${showSidebar ? 'md:ml-64' : ''} sticky top-0 z-50 bg-white px-6 py-3 flex items-center justify-between relative shadow-sm border-b`}>
        {/* Left: Mobile menu + Brand */}
        <div className="flex items-center gap-3">
          {/* Mobile toggle (only show if sidebar is enabled) */}
          {showSidebar && (
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="md:hidden text-emerald-600"
              aria-label="Toggle Sidebar"
            >
              {isSidebarOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
            </button>
          )}

          {/* Brand for desktop */}
          <div className="hidden md:flex items-center gap-2">
            <a href="/" className="flex items-center gap-2">
              <img src="/favicon.ico" alt="EcoVerifier Logo" className="w-6 h-6" />
              <span className="text-lg font-semibold text-emerald-600 tracking-tight">
                EcoVerifier
              </span>
            </a>
          </div>
        </div>

        {/* Center: Brand on mobile only */}
        <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2 md:hidden">
          <a href="/" className="flex items-center gap-2">
            <img src="/favicon.ico" alt="EcoVerifier Logo" className="w-6 h-6" />
            <span className="text-base font-semibold text-emerald-600 tracking-tight">
              EcoVerifier
            </span>
          </a>
        </div>

        {/* Right: Navigation and Login/Logout */}
        <div className="flex items-center gap-3">
          {/* Navigation Links - Show on mobile when no sidebar, hide when sidebar exists */}
          <nav className={`${showSidebar ? 'hidden lg:flex' : 'flex'} items-center gap-2 lg:gap-4`}>
            
          </nav>
          
          {user ? (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm font-medium text-red-500 hover:text-red-600 transition hover:bg-stone-100 p-2 rounded-md"
            >
              <FiLogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          ) : (
            <button
              onClick={handleLogin}
              className="flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition hover:bg-stone-100 p-2 rounded-md"
            >
              <FiLogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Login</span>
            </button>
          )}
        </div>
      </header>

      {/* Sidebar (if enabled) */}
      {showSidebar && sidebarContent && (
        <>
          <aside
            className={`fixed top-0 left-0 h-screen w-full max-w-xs md:w-64 bg-white shadow-xl flex flex-col transition-transform duration-300 ease-in-out z-[60]
              ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
              md:translate-x-0 md:z-40 border-r border-gray-100`}
          >
            {sidebarContent}
          </aside>

          {/* Mobile Overlay for sidebar */}
          {isSidebarOpen && (
            <div
              className="fixed inset-0 bg-black bg-opacity-30 z-30 md:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}
        </>
      )}

      {/* Main Content */}
      <main className={`${showSidebar ? 'md:pl-64' : ''} min-h-screen bg-gray-50`}>
        {children}
      </main>
    </>
  );
};

export default Layout;