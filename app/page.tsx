"use client";
import { useState, useEffect } from "react";
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
  impact: "high" | "medium" | "low";
  direction: "positive" | "negative" | "unclear";
  source_type: string;
  summary: string;
  source_url: string;
  // backend now may include:
  source_domain?: string;
};

type SourceItem = {
  title: string;
  url: string;
  source_domain?: string;
  source_type: string;
  impact: "high" | "medium" | "low";
  direction: "positive" | "negative" | "unclear";
  summary: string;
  date: string;
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
    score: number;
    base_score?: number;    // NEW
    rationale?: string;     // NEW
    factors?: string[];     // make optional for compatibility
    note: string;
  };
  sources?: SourceItem[];   // NEW
};


// Main React component for the ESG Analyzer application
export default function Home() {
  // State for verifying status (e.g., during audit)
  const [verifying, setVerifying] = useState(false);

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
                  <h2 className="text-3xl font-bold text-emerald-700 text-center">About EcoVerifier</h2>
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
                      EcoVerifier is our effort to hold companies accountable by turning vague ESG claims into measurable, event-based scores.
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
                      <div>
                        <span className="font-medium text-gray-900">Lead Backend Developer:</span> Risith Kankanamge (risithcha@gmail.com)
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">Lead Frontend Developers:</span> Ritvik Rajkumar (rajkumarritvik1@gmail.com) and Santhosh Ilaiyaraja (santhosh.ilaiyaraja21@gmail.com)
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
            // Report display section
            <div className="max-w-3xl mx-auto px-6 py-10 space-y-10 bg-gray-50">

              <div className="max-w-3xl mx-auto px-6 py-12 space-y-16 text-gray-800 font-sans">

                {/* Title */}
                <header className="space-y-2 border-b pb-6">
                  <h1 className="text-3xl font-bold tracking-tight">Environmental Risk Report</h1>
                  <p className="text-gray-500 text-sm">Generated by automated RAG pipeline reasoning and source verification.</p>
                </header>

                {/* Submitted Claim */}
                <section className="space-y-4">
                  <h2 className="text-xl font-semibold text-gray-900">Submitted Company</h2>
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-5 text-base leading-relaxed">
                    {company}
                  </div>
                </section>

                {/* Report Body */}
                <section className="space-y-10">
                  {/* Loading State for report display */}
                  {loading && !report && (
                    <section className="space-y-4">
                      <h2 className="text-xl font-semibold text-gray-900">Audit Status</h2>
                      <div className="text-gray-500 italic animate-pulse">
                        Auditing the company using environmental news and Claude reasoning...
                      </div>
                    </section>
                  )}

                  {/* Report Display */}
                  {report && !error && (
                    <>
                      {/* Company Info */}
                      <div className="space-y-2">
                        <h3 className="text-lg font-medium text-gray-900">Company Audited</h3>
                        <p className="text-xl font-semibold text-gray-900">{report.company}</p>
                      </div>

                      {/* GreenScore Visualization */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-medium text-gray-900">GreenScore</h3>
                          <AddToPortfolioButton
                            company={report.company}
                            greenscore={Math.max(0, Math.min(100, report.greenscore?.score ?? 0))}
                            reportId={activeReportId || undefined}
                            className="ml-4"
                          />
                        </div>

                        {(() => {
                          const gs = Math.max(0, Math.min(100, report.greenscore?.score ?? 0));
                          return (
                            <div className="flex items-start gap-6">
                              {/* Circular meter */}
                              <svg width="100" height="100" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="16" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                                <circle
                                  cx="18" cy="18" r="16" fill="none"
                                  stroke={`hsl(${(gs / 100) * 120}, 100%, 40%)`}
                                  strokeWidth="3" strokeDasharray="100"
                                  strokeDashoffset={100 - gs}
                                  strokeLinecap="round"
                                  transform="rotate(-90 18 18)"
                                  style={{ transition: "stroke-dashoffset 1s ease, stroke 1s ease" }}
                                />
                                <text x="18" y="21" textAnchor="middle" fill="#111827" fontSize="10" fontWeight="bold">
                                  {gs}%
                                </text>
                              </svg>

                              {/* Rationale / factors */}
                              <div className="flex-1">
                                {/* Show base vs final if available */}
                                {typeof report.greenscore.base_score === "number" && (
                                  <p className="text-xs text-gray-500 mb-1">
                                    Base: {report.greenscore.base_score} • Final: {gs}
                                  </p>
                                )}
                                <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
                                  {(
                                    (report.greenscore.factors && report.greenscore.factors.length > 0)
                                      ? report.greenscore.factors
                                      : (report.greenscore.rationale ? [report.greenscore.rationale] : [])
                                  ).map((f, i) => <li key={i}>{f}</li>)}
                                </ul>
                                {report.greenscore?.note && (
                                  <p className="text-xs text-gray-500 mt-2">{report.greenscore.note}</p>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>


                      {/* Audit Summary */}
                      <div className="space-y-2">
                        <h3 className="text-lg font-medium text-gray-900">Audit Summary</h3>
                        <div className="text-base text-gray-700 leading-relaxed">
                          <p><strong>Total Events:</strong> {report.eco_audit.total_events}</p>
                          <p><strong>High-Risk Issues:</strong> {report.eco_audit.high_risk_flag_count}</p>
                          <p><strong>Concern Level:</strong> {report.eco_audit.concern_level}</p>
                          <p className="mt-2">{report.eco_audit.summary}</p>
                        </div>
                      </div>

                      {/* ESG Findings */}
                      {/* Sources */}
                      <div className="space-y-6">
                        <h3 className="text-lg font-medium text-gray-900">Sources</h3>

                        {/* Prefer top-level sources if present; else fall back to findings */}
                        <ul className="space-y-6 list-none">
                          {(report.sources && report.sources.length > 0
                            ? report.sources.map((s, idx) => (
                                <li key={idx} className="space-y-2 border-t pt-4">
                                  <a
                                    href={s.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 font-semibold hover:underline"
                                  >
                                    {s.title || s.url}
                                  </a>
                                  <p className="text-sm text-gray-700">{s.summary}</p>
                                  <p className="text-xs text-gray-500">
                                    {s.source_domain ? `${s.source_domain} • ` : ""}
                                    {s.source_type ? `[${s.source_type}] ` : ""}{s.impact} impact, {s.direction} direction — {s.date}
                                  </p>
                                </li>
                              ))
                            : report.eco_audit.findings.map((f, idx) => (
                                <li key={idx} className="space-y-2 border-t pt-4">
                                  <a
                                    href={f.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 font-semibold hover:underline"
                                  >
                                    {f.title}
                                  </a>
                                  <p className="text-sm text-gray-700">{f.summary}</p>
                                  <p className="text-xs text-gray-500">
                                    {f.source_domain ? `${f.source_domain} • ` : ""}
                                    [{f.source_type}] {f.impact} impact, {f.direction} direction — {f.date}
                                  </p>
                                </li>
                              ))
                          )}
                        </ul>
                      </div>

                    </>
                  )}
                  {/* Error message for report display */}
                  {error && !loading && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                      <strong className="font-bold">Error!</strong>
                      <span className="block sm:inline"> {error}</span>
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}
      </div>
    </Layout>
  );
}
