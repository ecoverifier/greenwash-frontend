
"use client";
import { useState, useEffect, Fragment } from "react";
import axios from "axios";
// Importing icons from Radix UI and React Icons
import { PaperPlaneIcon, DownloadIcon } from "@radix-ui/react-icons";
import { Analytics } from "@vercel/analytics/next"
import jsPDF from "jspdf"; // For PDF generation, though not fully implemented in this snippet
import { FaUserCircle, FaRobot, FaPlus, FaTrashAlt } from "react-icons/fa";
import { HiArrowUpCircle } from "react-icons/hi2";
import { RiChatNewLine } from "react-icons/ri"; 
import { FiLogIn, FiLogOut, FiMenu, FiX } from "react-icons/fi";
import { FaArrowDown } from "react-icons/fa";
import AddToPortfolioButton from "./components/AddToPortfolioButton";
import Layout from "./components/Layout";
import ReportsSidebar from "./components/ReportsSidebar";

// Firebase imports - ensure you have a 'firebase.ts' file with these exports
// Example:
// import { initializeApp } from "firebase/app";
// import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
// import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, where, orderBy } from "firebase/firestore";
// const firebaseConfig = { ... }; // Your Firebase config
// const app = initializeApp(firebaseConfig);
// export const auth = getAuth(app);
// export const provider = new GoogleAuthProvider();
// export const db = getFirestore(app);
import { auth, provider, db, signInWithPopup, signOut } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
} from "firebase/firestore";

// TypeScript types for the ESG report structure
type ESGFinding = {
  date: string;
  title: string;
  summary: string;

  // from backend
  source_url: string;
  source_domain?: string;

  // 6-factor analysis
  severity: number;     // −1..+1 (your prompt defines −1 = positive, +1 = harm)
  credibility: number;  // 0..1
  recency: number;      // 0..1
  scope: number;        // 0.2..1
  confidence: number;   // 0..1

  // scoring
  event_risk_score: number;   // −1..+1 (post-compression)
  event_score_0_100: number;  // 0..100 (mapped from −1..+1)
  contribution?: number;      // 0..1 fraction of total |abs(risk)|
  calc?: {
    inputs: {
      severity: number;
      credibility: number;
      recency: number;
      scope: number;
      confidence: number;
    };
    influence: number;
    raw_risk: number;
    compressed: number;
    adjustment: number;
    final_risk: number;
  };
};

type SourceItem = {
  title: string;
  url: string;
  source_domain?: string;
  summary: string;
  date: string;
  severity: number;
  credibility: number;
  scope: number;
  event_risk_score: number;
  event_score_0_100: number;
};

type TopDriver = {
  title: string;
  url: string;
  event_risk_score: number;
  event_score_0_100: number;
  contribution_pct: number; // 0..100
  credibility: number;
  recency: number;
  scope: number;
};

type ReportType = {
  company: string;
  eco_audit: {
    last_audit_date: string;
    total_events: number;
    high_risk_flag_count: number;
    concern_level: string;
    summary: string;
    findings: ESGFinding[];
  };
  greenscore: {
    score: number;             // 0..100 (higher = lower risk)
    risk_score?: number;       // mean_risk −1..+1 (backend returns this)
    risk_level?: string;       // low/medium/high/very high
    rationale?: string;
    factors?: string[];
    note: string;
    why?: string;              // NEW: explanatory paragraph
    top_drivers?: TopDriver[]; // NEW
    counts?: {
      total_events: number;
      harmful_events: number;
      beneficial_events: number;
    };
    base_score?: number;       // keep optional for compatibility
  };
  sources?: SourceItem[];
};

// helpers for % and 0–100 clamping
function pct(n: number | undefined) {
  const v = Math.max(0, Math.min(1, n ?? 0));
  return Math.round(v * 100);
}
function clamp100(n: number | undefined) {
  const v = Number.isFinite(n as any) ? Number(n) : 0;
  return Math.max(0, Math.min(100, v));
}


// Main React component for the ESG Analyzer application
export default function Home() {
  // State for verifying status (e.g., during audit)
  const [verifying, setVerifying] = useState(false);

  // expand/collapse state for per-row details in the sources table
  const [openRow, setOpenRow] = useState<Record<number, boolean>>({});


  // State to track if a session (audit) has started
  const [sessionStarted, setSessionStarted] = useState(false);
  // User authentication state
  const [user, setUser] = useState<User | null>(null);
  // Error message state
  const [error, setError] = useState("");
  // State to track if error is retryable (for system errors)
  const [isRetryableError, setIsRetryableError] = useState(false);

  // Function to handle user logout
  const handleLogout = async () => {
    try {
      await signOut(auth); // Sign out from Firebase
      setUser(null); // Clear user state
      setReport(null); // Clear current report
      setCompany(""); // Clear company input
      setSessionStarted(false); // Reset session
      setActiveReportId(null); // Clear active report ID
      setError(""); // Clear any errors
      setIsRetryableError(false); // Clear retry state
    } catch (err) {
      setError("Logout failed. Please try again.");
    }
  };

  // Placeholder typing animation for the input field
  const examples = [
    "Enter a company name",
    "e.g. Amazon, Apple, Shell, or Tesla",
  ];

  const [animatedPlaceholder, setAnimatedPlaceholder] = useState("");
  const [exampleIndex, setExampleIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  // State for the company input
  const [company, setCompany] = useState("");

  // Effect for the typing animation
  useEffect(() => {
    const current = examples[exampleIndex];
    let speed = isDeleting ? 25 : 60; // Typing speed

    const timeout = setTimeout(() => {
      if (isDeleting) {
        // Deleting characters
        setAnimatedPlaceholder((prev) => prev.slice(0, -1));
        setCharIndex((prev) => prev - 1);
        if (charIndex === 0) {
          setIsDeleting(false); // Start typing next example
          setExampleIndex((prev) => (prev + 1) % examples.length); // Cycle through examples
        }
      } else {
        // Typing characters
        setAnimatedPlaceholder(current.slice(0, charIndex + 1));
        setCharIndex((prev) => prev + 1);
        if (charIndex === current.length) {
          setIsDeleting(true); // Start deleting after full word is typed
        }
      }
    }, speed);

    return () => clearTimeout(timeout); // Cleanup timeout
  }, [charIndex, isDeleting, exampleIndex, examples]); // Dependencies for the effect

  // State for the current audit report data
  const [report, setReport] = useState<ReportType | null>(null);
  // State for loading status during API calls
  const [loading, setLoading] = useState(false);
  // State for stored reports (from Firebase or local storage)
  const [reports, setReports] = useState<any[]>([]);
  // State for the currently active (displayed) report ID
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  // Effect to handle client-side initialization
  useEffect(() => {
    // Initialize reports from local storage only on client-side
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem("anon_reports");
      if (stored) {
        setReports(JSON.parse(stored));
      }
    }
  }, []);

  // Effect to listen for Firebase authentication state changes
  useEffect(() => {
    // This listener will fetch reports whenever auth state changes
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u); // Set the current user
      fetchReports(u?.uid); // Fetch reports for the user (or anonymous)
    });
    return () => unsubscribe(); // Cleanup listener on component unmount
  }, []);

  // Function to fetch reports from Firestore or local storage
  const fetchReports = async (uid?: string) => {
    if (uid) {
      // If user is authenticated, fetch from Firestore
      const q = query(
        collection(db, "reports"),
        where("uid", "==", uid) // Filter by user ID
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as any[];
      // Sort client-side by createdAt descending
      data.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setReports(data);
    } else {
      // If anonymous, fetch from local storage
      const stored = localStorage.getItem("anon_reports");
      setReports(stored ? JSON.parse(stored) : []);
    }
  };

  // Function to handle Google login
  const login = async () => {
    try {
      await signInWithPopup(auth, provider); // Trigger Google sign-in popup
    } catch (err) {
      setError("Login failed. Please try again.");
    }
  };

  // Function to submit a new ESG audit request
  const submit = async (e?: any) => {
    if (e) e.preventDefault(); // Prevent default form submission
    if (!company.trim() || loading) return; // Don't submit if company is empty or already loading

    setError(""); // Clear previous errors
    setIsRetryableError(false); // Clear retry state
    setLoading(true); // Set loading state
    setReport(null); // Clear previous report
    setSessionStarted(true); // Indicate that a session has started

    // Generate a new ID for the report entry
    const newId = crypto.randomUUID();
    const newReportEntry = { id: newId, company, report: null };
    // Add the new entry to the reports list (optimistic update)
    setReports((prev) => [newReportEntry, ...prev]);
    setActiveReportId(newId); // Set this new report as active

    try {
      const res = await axios.get(
        `https://greenwash-api-production.up.railway.app/generate-audit?company=${encodeURIComponent(company)}`,
        {
          timeout: 90000, // 90 second timeout for long-running analysis
          validateStatus: function (status) {
            return status >= 200 && status < 500; // Accept 4xx errors to handle them properly
          }
        }
      );
      
      // Handle non-2xx status codes
      if (res.status >= 400) {
        // This will be caught by the catch block and handled appropriately
        throw {
          response: res,
          status: res.status,
          data: res.data
        };
      }
      
      const result = res.data as ReportType;
    
      // basic guards
      if (typeof result?.greenscore?.score !== "number") {
        throw new Error("Malformed API response (missing greenscore.score)");
      }
    
      // Update list + current view
      setReports((prev) =>
        prev.map((r) => (r.id === newId ? { ...r, report: result } : r))
      );
      setActiveReportId(newId);
      setReport(result);
    
      if (!user) {
        const updated = [{ id: newId, company, report: result }, ...reports];
        localStorage.setItem("anon_reports", JSON.stringify(updated));
      } else {
        await addDoc(collection(db, "reports"), {
          uid: user.uid,
          company,
          report: result,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      
      // Handle axios-specific errors first
      if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
        setError("The request timed out. The analysis is taking longer than expected. Please try again.");
        setIsRetryableError(true);
      } else if (err?.code === 'ERR_NETWORK' || err?.message?.includes('Network Error')) {
        setError("Network error. Please check your internet connection and try again.");
        setIsRetryableError(true);
      } else if (err?.code === 'ERR_INTERNET_DISCONNECTED') {
        setError("No internet connection. Please check your connection and try again.");
        setIsRetryableError(true);
      } else if (!err?.response && !err?.status) {
        // No response means network issue
        setError("Unable to connect to our servers. Please check your internet connection and try again.");
        setIsRetryableError(true);
      } else if (err?.response?.data?.detail || err?.data?.detail) {
        const errorDetail = err.response?.data?.detail || err.data?.detail;
        const errorCode = errorDetail.error;
        const errorMessage = errorDetail.message;
        const retryGuidance = errorDetail.retry_guidance;
        
        // Handle different error codes with specific messages
        switch (errorCode) {
          case "EMPTY_INPUT":
            setError("Please enter a company name to analyze.");
            setIsRetryableError(false);
            break;
          case "TOO_LONG":
            setError("Company name is too long. Please provide a shorter, valid company name.");
            setIsRetryableError(false);
            break;
          case "VALIDATION_SYSTEM_ERROR":
            setError(retryGuidance || "Our validation system is temporarily unavailable. Please try again in a few moments.");
            setIsRetryableError(true);
            break;
          case "COMPANY_REJECTED":
            setError("The company name you entered appears to be invalid or not a legitimate business. Please enter a real company name.");
            setIsRetryableError(false);
            break;
          case "INVALID_COMPANY":
            setError("Please enter a valid, real company name for analysis.");
            setIsRetryableError(false);
            break;
          default:
            // Handle other structured errors
            if (errorMessage) {
              setError(`Validation failed: ${errorMessage}`);
              setIsRetryableError(!!retryGuidance);
            } else {
              setError("Company validation failed. Please try a different company name.");
              setIsRetryableError(false);
            }
        }
      } else if ((err?.response?.status || err?.status) === 429) {
        // Rate limiting
        setError("Too many requests. Please wait a moment before trying again.");
        setIsRetryableError(true);
      } else if ((err?.response?.status || err?.status) >= 500) {
        // Server errors
        setError("Our servers are experiencing issues. Please try again later.");
        setIsRetryableError(true);
      } else {
        // General network or other errors
        setError("Failed to retrieve audit report. Please check your connection and try again.");
        setIsRetryableError(true);
      }
    } finally {
      setLoading(false);
    }
    
  };

  // State for scroll button visibility (start false for hydration safety)
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Effect to handle scroll button visibility
  useEffect(() => {
    // Set initial scroll button state safely
    const setInitialState = () => {
      if (typeof window !== 'undefined') {
        setShowScrollButton(window.scrollY < 200);
      }
    };
    
    const handleScroll = () => {
      if (typeof window !== 'undefined') {
        const scrollY = window.scrollY;
        // Hide button after scrolling down 200px
        setShowScrollButton(scrollY < 200);
      }
    };

    // Set initial state
    setInitialState();

    if (typeof window !== 'undefined') {
      window.addEventListener("scroll", handleScroll);
      return () => window.removeEventListener("scroll", handleScroll); // Cleanup event listener
    }
  }, []);

  // Helper functions for sidebar actions
  const handleNewChat = () => {
    setReport(null);
    setCompany("");
    setActiveReportId(null);
    setSessionStarted(false);
    setError("");
    setIsRetryableError(false);
  };

  const handleSelectReport = (r: any) => {
    setReport(r.report);
    setCompany(r.company);
    setActiveReportId(r.id);
    setSessionStarted(true);
    setError("");
    setIsRetryableError(false);
  };

  const handleDeleteReport = (reportId: string) => {
    setReports((prev) => {
      const updated = prev.filter((rep) => rep.id !== reportId);
      const active = reportId === activeReportId;

      if (active) {
        // If deleting the active report, switch to the first available or clear
        if (updated.length > 0) {
          const next = updated[0];
          setReport(next.report);
          setCompany(next.company);
          setActiveReportId(next.id);
          setSessionStarted(true);
        } else {
          // No more reports, clear everything
          setReport(null);
          setCompany("");
          setActiveReportId(null);
          setSessionStarted(false);
          setLoading(false);
          setVerifying(false);
        }
      }

      // Update local storage for anonymous users
      if (!user) {
        localStorage.setItem("anon_reports", JSON.stringify(updated));
      }

      return updated;
    });
  };

  // Create sidebar content
  const sidebarContent = (
    <ReportsSidebar
      reports={reports}
      activeReportId={activeReportId}
      sessionStarted={sessionStarted}
      user={user}
      onNewChat={handleNewChat}
      onSelectReport={handleSelectReport}
      onDeleteReport={handleDeleteReport}
    />
  );

  return (
    <Layout 
      showSidebar={true} 
      sidebarContent={sidebarContent}
      title="EcoVerifier"
    >
      {/* Background gradient for the top section */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-white via-[#f7f9fb] to-transparent -z-10" />

      {/* Main Content Area */}
      <div className="flex-1 px-6 py-5 sm:px-10 bg-gray-50 min-h-screen">

          {/* Initial state: Input form and About section */}
          {!sessionStarted ? (
            <div className="w-full max-w-2xl mx-auto text-center space-y-12 pt-12">

              <div className="space-y-6 min-h-screen">
                <h1 className="text-4xl md:text-6xl font-extrabold text-emerald-700 leading-tight">
                  Find out how sustainable companies really are.
                </h1>
                <p className="text-gray-600 text-md md:text-lg max-w-xl mx-auto">
                  EcoVerifier helps you make sustainable, responsible investing decisions by analyzing companies and returning environmental reports on them.
                </p>

                {verifying && (
                  <p className="text-sm text-gray-500 animate-pulse mb-4">
                    Analyzing company...
                  </p>
                )}

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700 font-medium mb-2">
                      {error}
                    </p>
                    {isRetryableError && (
                      <button
                        onClick={() => {
                          setError("");
                          setIsRetryableError(false);
                          if (company.trim()) {
                            submit();
                          }
                        }}
                        className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded transition-colors"
                      >
                        Try Again
                      </button>
                    )}
                  </div>
                )}

                {/* Input form for company name */}
                <form onSubmit={submit} className="relative mt-12">
                  <div className="relative">
                    <textarea
                      rows={4}
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault(); // Prevent new line on Enter
                          if (!loading) {
                            submit(e); // Submit on Enter (without Shift)
                          }
                        }
                      }}
                      className="w-full p-4 border border-gray-300 rounded-lg shadow-md resize-none focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm text-gray-900 bg-white"
                      placeholder="" // Placeholder is handled by animatedPlaceholder
                    />
                    {/* Animated placeholder */}
                    {company.length === 0 && (
                      <div className="absolute top-4 left-4 text-gray-400 pointer-events-none text-sm">
                        {animatedPlaceholder}
                      </div>
                    )}
                  </div>
                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className={`absolute bottom-3 right-3 ${
                      loading ? "bg-gray-300 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
                    } text-white p-2 md:p-3 rounded-full shadow-md transition`}
                    aria-label="Submit"
                  >
                    {loading ? (
                      // Loading spinner
                      <svg className="animate-spin h-5 w-5 md:h-6 md:w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    ) : (
                      <HiArrowUpCircle className="md:w-6 md:h-6 h-5 w-5" />
                    )}
                  </button>
                </form>

                {/* Scroll Button */}
                <div className="w-full flex justify-center py-6 px-4 md:px-8">
                  <a
                    href="#about"
                    className={`fixed bottom-6 z-50 p-4 rounded-full justify-center shadow-lg bg-emerald-600 text-white transition-transform duration-500 ease-in-out ${
                      showScrollButton ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
                    }`}
                    aria-label="Scroll to About"
                  >
                    <FaArrowDown className="w-4 h-4" />
                  </a>
                </div>

              </div>

              {/* About Section */}
              <section id="about" className="scroll px-2 sm:px-0 mb-20">
                <div className="max-w-2xl mx-auto space-y-8">
                  <h2 className="text-3xl font-bold text-emerald-700 text-center">An Initiative of the Literally Finance Project</h2>
                  <p className="text-gray-700 text-base leading-relaxed text-center">
                    EcoVerifier analyzes companies’ environmental behavior using real-world ESG events, trusted sources, and AI to generate a custom GreenScore.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm text-gray-700">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Who It's For</h3>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Students exploring sustainability in economics or policy</li>
                        <li>ESG-conscious investors screening companies</li>
                        <li>Researchers comparing ESG scores with real outcomes</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Tech Stack</h3>
                      <ul className="list-disc list-inside space-y-1">
                        <li>React + Next.js</li>
                        <li>Tailwind CSS</li>
                        <li>Firebase (Auth & Firestore)</li>
                        <li>OpenRouter + Brave Search API</li>
                      </ul>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">About the Creator</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      Hi, I'm Ishan Singh, the creator of Literally Finance (team@literallyfinance.com). I'm a high schooler driven by the intersection of tech, finance, and environmental accountability. 
                      EcoVerifier is my effort to hold companies accountable by turning vague ESG claims into measurable, event-based scores.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Our Team</h3>
                    <p className="text-sm text-gray-700 leading-relaxed mb-3">
                      EcoVerifier was built by a passionate team of students combining technology, sustainability, and finance.
                    </p>
                    <div className="text-sm text-gray-700 space-y-2">
                      <div>
                        <span className="font-medium text-gray-900">Lead Developer:</span> Ishan Singh (26singhishan@gmail.com)
                      </div>
                    </div>
                  </div>

                  <blockquote className="italic text-sm text-gray-500 border-l-4 border-emerald-400 pl-4 mt-4">
                    “55% of global customers are skeptical of the sustainability claims of most brands.” — YouGov, 2023
                  </blockquote>
                </div>
              </section>

            </div>
          ) : (

            <div className="min-h-[560px] bg-gradient-to-b from-emerald-50/40 via-slate-50 to-white">
  <div className="max-w-5xl mx-auto px-4 py-10">
    <div className="rounded-3xl border border-slate-200 bg-white/80 shadow-sm backdrop-blur-sm">
      <div className="px-6 py-8 sm:px-10 sm:py-10 space-y-10 text-gray-900 font-sans">
        {/* Header */}
        <header className="space-y-4 border-b border-slate-200 pb-6">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 border border-emerald-100">
                <span className="text-[11px]">EcoVerifier</span>
                <span className="h-1 w-1 rounded-full bg-emerald-500" />
                <span>Automated ESG risk check</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Environmental Risk Report
              </h1>
              <p className="text-sm text-gray-500 max-w-xl">
                We scan recent, independent news and reports about this company to
                estimate its environmental risk and explain why.
              </p>
            </div>
          </div>

          {/* Steps / nav hint */}
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1 border border-slate-200">
              <span className="h-4 w-4 rounded-full bg-slate-900 text-[10px] text-white flex items-center justify-center">
                1
              </span>
              Company
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1 border border-slate-200">
              <span className="h-4 w-4 rounded-full bg-slate-900 text-[10px] text-white flex items-center justify-center">
                2
              </span>
              GreenScore
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1 border border-slate-200">
              <span className="h-4 w-4 rounded-full bg-slate-900 text-[10px] text-white flex items-center justify-center">
                3
              </span>
              Findings
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1 border border-slate-200">
              <span className="h-4 w-4 rounded-full bg-slate-900 text-[10px] text-white flex items-center justify-center">
                4
              </span>
              Articles checked
            </span>
          </div>
        </header>

        {/* 1. Company user asked to check */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            1. Company you asked us to check
          </h2>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:px-5 sm:py-4 text-base leading-relaxed">
            {company}
          </div>
        </section>

        {/* Loading state */}
        {loading && !report && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Audit status
            </h2>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-sm text-gray-600 italic">
                  Auditing this company using environmental news and our risk model…
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Main report */}
        {report && !error && (
          <>
            {/* At-a-glance summary strip */}
            {(() => {
              const gs = Math.max(0, Math.min(100, report.greenscore?.score ?? 0));

              let levelLabel = "Medium risk";
              let levelColor =
                "bg-amber-50 text-amber-900 border-amber-200";
              if (gs >= 80) {
                levelLabel = "Low risk";
                levelColor =
                  "bg-emerald-50 text-emerald-900 border-emerald-200";
              } else if (gs < 50) {
                levelLabel = "High risk";
                levelColor = "bg-red-50 text-red-900 border-red-200";
              }

              return (
                <section className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 sm:px-5 sm:py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Summary at a glance
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${levelColor}`}
                      >
                        Environmental verdict: {levelLabel}
                      </span>
                      <span className="text-sm text-gray-600">
                        GreenScore <span className="font-semibold">{gs}</span> / 100
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs sm:text-sm text-gray-600">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {report.eco_audit.total_events}
                      </p>
                      <p>Events reviewed</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {report.eco_audit.high_risk_flag_count}
                      </p>
                      <p>Serious issues flagged</p>
                    </div>
                    {report.greenscore?.counts && (
                      <div>
                        <p className="font-semibold text-gray-900">
                          {report.greenscore.counts.harmful_events} harmful •{" "}
                          {report.greenscore.counts.beneficial_events} beneficial
                        </p>
                        <p>Event balance</p>
                      </div>
                    )}
                  </div>
                </section>
              );
            })()}

            {/* Company info */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Company audited
              </h3>
              <p className="text-xl font-semibold text-gray-900">
                {report.company}
              </p>
            </section>

            {/* 2. GreenScore */}
            <section className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-7 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <span>2. GreenScore</span>
                    {(() => {
                      const gs = Math.max(
                        0,
                        Math.min(100, report.greenscore?.score ?? 0)
                      );
                      let label = "Medium risk";
                      let badgeClass =
                        "bg-amber-100 text-amber-800 border-amber-200";

                      if (gs >= 80) {
                        label = "Low risk";
                        badgeClass =
                          "bg-emerald-100 text-emerald-800 border-emerald-200";
                      } else if (gs < 50) {
                        label = "High risk";
                        badgeClass =
                          "bg-red-100 text-red-800 border-red-200";
                      }

                      return (
                        <span
                          className={`
                            inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                            ${badgeClass}
                          `}
                        >
                          {label}
                        </span>
                      );
                    })()}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600 max-w-xl">
                    GreenScore is a 0–100 rating of this company&apos;s environmental risk
                    based on recent, independent news and reports.{" "}
                    <strong>Higher scores mean lower environmental risk.</strong>
                  </p>
                </div>

                
              </div>

              {(() => {
                const gs = Math.max(
                  0,
                  Math.min(100, report.greenscore?.score ?? 0)
                );
                const base =
                  typeof report.greenscore.base_score === "number"
                    ? report.greenscore.base_score
                    : null;

                const factors =
                  report.greenscore.factors &&
                  report.greenscore.factors.length > 0
                    ? report.greenscore.factors
                    : report.greenscore.rationale
                    ? [report.greenscore.rationale]
                    : [];

                const topThreeFactors = factors.slice(0, 3);

                return (
                  <div className="flex flex-col md:flex-row items-start gap-6">
                    {/* Circular meter */}
                    <div className="flex flex-col items-center gap-2">
                      <svg width="112" height="112" viewBox="0 0 36 36">
                        <circle
                          cx="18"
                          cy="18"
                          r="16"
                          fill="none"
                          stroke="#e5e7eb"
                          strokeWidth="3.5"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="16"
                          fill="none"
                          stroke={`hsl(${(gs / 100) * 120}, 100%, 40%)`}
                          strokeWidth="3.5"
                          strokeDasharray="100"
                          strokeDashoffset={100 - gs}
                          strokeLinecap="round"
                          transform="rotate(-90 18 18)"
                          style={{
                            transition:
                              "stroke-dashoffset 0.8s ease, stroke 0.8s ease",
                          }}
                        />
                        <text
                          x="18"
                          y="20.5"
                          textAnchor="middle"
                          fill="#111827"
                          fontSize="11"
                          fontWeight="bold"
                        >
                          {gs}%
                        </text>
                      </svg>
                      <p className="text-xs text-gray-500 text-center">
                        0 = very high risk • 100 = very low risk
                      </p>
                    </div>

                    {/* Explanation / drivers */}
                    <div className="flex-1 space-y-3">
                      {base !== null && (
                        <p className="text-xs text-gray-500">
                          <span className="font-medium">Base score:</span>{" "}
                          {base} &nbsp;•&nbsp;
                          <span className="font-medium">Final score:</span>{" "}
                          {gs}
                        </p>
                      )}

                      {report.greenscore?.why && (
                        <p className="text-sm text-gray-700">
                          {report.greenscore.why}
                        </p>
                      )}

                      {topThreeFactors.length > 0 && (
                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold text-gray-900">
                            Main reasons for this score
                          </h4>
                          <ul className="mt-1 text-sm text-gray-700 list-disc pl-5 space-y-1.5">
                            {topThreeFactors.map((f: string, i: number) => (
                              <li key={i}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {report.greenscore?.note && (
                        <p className="text-xs text-gray-500">
                          {report.greenscore.note}
                        </p>
                      )}

                      {/* Simple legend */}
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div className="flex items-center gap-2 rounded-md border border-emerald-100 bg-emerald-50 px-2.5 py-1.5">
                          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                          <div>
                            <p className="font-semibold text-emerald-900">
                              80–100
                            </p>
                            <p className="text-[11px] text-emerald-900/80">
                              Low environmental risk, strong record.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 rounded-md border border-amber-100 bg-amber-50 px-2.5 py-1.5">
                          <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                          <div>
                            <p className="font-semibold text-amber-900">
                              50–79
                            </p>
                            <p className="text-[11px] text-amber-900/80">
                              Medium risk, mixed record.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 rounded-md border border-red-100 bg-red-50 px-2.5 py-1.5">
                          <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                          <div>
                            <p className="font-semibold text-red-900">
                              0–49
                            </p>
                            <p className="text-[11px] text-red-900/80">
                              High risk, repeated or serious issues.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Optional: key drivers list */}
                      {Array.isArray(report.greenscore?.top_drivers) &&
                        report.greenscore.top_drivers.length > 0 && (
                          <div className="mt-4">
                            <h4 className="text-sm font-semibold text-gray-900">
                              Key articles influencing this score
                            </h4>
                            <ul className="mt-2 space-y-3">
                              {report.greenscore.top_drivers.map(
                                (d: any, i: number) => {
                                  const pct = Math.max(
                                    0,
                                    Math.min(100, d.contribution_pct || 0)
                                  );
                                  return (
                                    <li
                                      key={i}
                                      className="border rounded-md p-3 bg-gray-50"
                                    >
                                      <a
                                        href={d.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-blue-600 font-medium hover:underline"
                                      >
                                        {d.title}
                                      </a>
                                      <div className="mt-1 text-[11px] text-gray-600">
                                        Event score:{" "}
                                        <span className="font-mono">
                                          {d.event_score_0_100}
                                        </span>{" "}
                                        • Impact (−1..+1):{" "}
                                        <span className="font-mono">
                                          {Number(
                                            d.event_risk_score ?? 0
                                          ).toFixed(3)}
                                        </span>{" "}
                                        • Contribution:{" "}
                                        <span className="font-mono">
                                          {pct.toFixed(1)}%
                                        </span>
                                      </div>
                                      <div className="mt-2 w-full bg-gray-200 h-2 rounded">
                                        <div
                                          className="h-2 rounded"
                                          style={{
                                            width: `${pct}%`,
                                            backgroundColor: "#10b981",
                                          }}
                                        />
                                      </div>
                                      <div className="mt-2 text-[11px] text-gray-500">
                                        Credibility{" "}
                                        {d.credibility.toFixed(2)} • Recency{" "}
                                        {d.recency.toFixed(2)} • Scope{" "}
                                        {d.scope.toFixed(2)}
                                      </div>
                                    </li>
                                  );
                                }
                              )}
                            </ul>
                          </div>
                        )}
                    </div>
                  </div>
                );
              })()}
            </section>

            {/* 3. Audit summary */}
            <section className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-7 shadow-sm space-y-2">
              <h3 className="text-base font-semibold text-gray-900">
                3. What we found
              </h3>
              {report.greenscore?.counts && (
                <p className="text-sm text-gray-600 mt-1">
                  Harmful events:{" "}
                  {report.greenscore.counts.harmful_events} • Beneficial
                  events: {report.greenscore.counts.beneficial_events}
                </p>
              )}
              <div className="text-sm text-gray-700 leading-relaxed space-y-1 mt-2">
                <p>
                  <strong>Total events reviewed:</strong>{" "}
                  {report.eco_audit.total_events}
                </p>
                <p>
                  <strong>Serious issues flagged:</strong>{" "}
                  {report.eco_audit.high_risk_flag_count}
                </p>
                <p>
                  <strong>Overall concern level:</strong>{" "}
                  {report.eco_audit.concern_level}
                </p>
                <p className="mt-2">{report.eco_audit.summary}</p>
              </div>
            </section>

            {/* 4. Sources & event details */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-gray-900">
                4. Articles we checked
              </h3>
              {Array.isArray(report.eco_audit?.findings) &&
              report.eco_audit.findings.length > 0 ? (
                <div className="overflow-x-auto bg-white border border-gray-200 rounded-2xl">
                  <table className="min-w-full text-xs sm:text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th
                          scope="col"
                          className="px-3 py-2 text-left font-medium"
                        >
                          Title
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-2 text-left font-medium"
                        >
                          Event score
                          <span className="block text-[10px] text-gray-400">
                            0–100 (higher = better)
                          </span>
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-2 text-left font-medium"
                        >
                          Impact
                          <span className="block text-[10px] text-gray-400">
                            −1 harmful · +1 positive
                          </span>
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-2 text-left font-medium"
                        >
                          Severity
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-2 text-left font-medium"
                        >
                          Confidence
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-2 text-left font-medium"
                        >
                          Contribution
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-2 text-left font-medium"
                        >
                          Cred.
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-2 text-left font-medium"
                        >
                          Recency
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-2 text-left font-medium"
                        >
                          Scope
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-2 text-left font-medium"
                        >
                          Date / source
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {report.eco_audit.findings.map((f, i) => {
                        const es100 = clamp100(f.event_score_0_100);
                        const risk = Number(f.event_risk_score ?? 0);
                        const contrPct = Number.isFinite(
                          f.contribution as any
                        )
                          ? pct(f.contribution)
                          : 0;
                        const domain = f.source_domain;
                        const date = f.date;

                        return (
                          <Fragment key={i}>
                            <tr className="hover:bg-gray-50">
                              <td className="px-3 py-2 align-top">
                                <button
                                  type="button"
                                  className="text-left text-blue-600 hover:underline"
                                  onClick={() =>
                                    setOpenRow((o) => ({
                                      ...o,
                                      [i]: !o[i],
                                    }))
                                  }
                                  title="Show details"
                                >
                                  {f.title || f.source_url}
                                </button>
                              </td>
                              <td className="px-3 py-2 font-mono align-top">
                                {es100}
                              </td>
                              <td className="px-3 py-2 font-mono align-top">
                                {risk.toFixed(3)}
                              </td>
                              <td className="px-3 py-2 font-mono align-top">
                                {Number(f.severity ?? 0).toFixed(2)}
                              </td>
                              <td className="px-3 py-2 font-mono align-top">
                                {Number(f.confidence ?? 0).toFixed(2)}
                              </td>
                              <td className="px-3 py-2 align-top">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[11px]">
                                    {contrPct}%
                                  </span>
                                  <div className="h-2 w-20 bg-gray-200 rounded">
                                    <div
                                      className="h-2 rounded"
                                      style={{
                                        width: `${contrPct}%`,
                                        backgroundColor: "#10b981",
                                      }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2 font-mono align-top">
                                {Number(f.credibility ?? 0).toFixed(2)}
                              </td>
                              <td className="px-3 py-2 font-mono align-top">
                                {Number(f.recency ?? 0).toFixed(2)}
                              </td>
                              <td className="px-3 py-2 font-mono align-top">
                                {Number(f.scope ?? 0).toFixed(2)}
                              </td>
                              <td className="px-3 py-2 text-[11px] text-gray-600 align-top">
                                {date}
                                {domain ? ` • ${domain}` : ""}
                              </td>
                            </tr>

                            {openRow[i] && (
                              <tr className="bg-gray-50/60">
                                <td
                                  className="px-3 py-3 text-sm text-gray-700"
                                  colSpan={10}
                                >
                                  {f.summary && (
                                    <p className="mb-2">{f.summary}</p>
                                  )}
                                  <a
                                    className="text-blue-600 hover:underline break-all"
                                    href={f.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {f.source_url}
                                  </a>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  No sources were found for this audit.
                </p>
              )}

              <p className="text-xs text-gray-500 mt-2">
                Notes: Event score is 0–100 (higher = less environmental risk).
                “Impact” is the underlying −1..+1 value used in our model.
                Contribution shows how much that event explains the overall risk.
              </p>
            </section>
          </>
        )}

        {/* Error message */}
        {error && !loading && (
          <div
            className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded-2xl text-sm"
            role="alert"
          >
            <strong className="font-semibold">We couldn&apos;t finish this audit.</strong>
            <span className="block mt-1">{error}</span>
          </div>
        )}
      </div>
    </div>
  </div>
</div>


          )}
      </div>
    </Layout>
  );
}
