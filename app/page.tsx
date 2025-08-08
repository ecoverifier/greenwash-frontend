"use client";
import { useState, useEffect } from "react";
import axios from "axios";
// Importing icons from Radix UI and React Icons
import { PaperPlaneIcon, DownloadIcon } from "@radix-ui/react-icons";
import jsPDF from "jspdf"; // For PDF generation, though not fully implemented in this snippet
import { FaUserCircle, FaRobot, FaPlus, FaTrashAlt } from "react-icons/fa";
import { HiArrowUpCircle } from "react-icons/hi2";
import { RiChatNewLine } from "react-icons/ri";
import { FiLogIn, FiLogOut, FiMenu, FiX } from "react-icons/fi";
import { FaArrowDown } from "react-icons/fa";

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
  orderBy,
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
  // State for sidebar visibility (mobile)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // State for verifying status (e.g., during audit)
  const [verifying, setVerifying] = useState(false);

  // State to track if a session (audit) has started
  const [sessionStarted, setSessionStarted] = useState(false);
  // User authentication state
  const [user, setUser] = useState<User | null>(null);
  // Error message state
  const [error, setError] = useState("");

  // Function to handle user logout
  const handleLogout = async () => {
    try {
      await signOut(auth); // Sign out from Firebase
      setUser(null); // Clear user state
      setReport(null); // Clear current report
      setCompany(""); // Clear company input
      setSessionStarted(false); // Reset session
      setActiveReportId(null); // Clear active report ID
    } catch (err) {
      console.error("Logout failed", err);
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
  const [reports, setReports] = useState<any[]>(() => {
    // Initialize reports from local storage on client-side
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("anon_reports");
      return stored ? JSON.parse(stored) : [];
    }
    return [];
  });
  // State for the currently active (displayed) report ID
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

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
        where("uid", "==", uid), // Filter by user ID
        orderBy("createdAt", "desc") // Order by creation date
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
      console.error("Login failed", err);
      setError("Login failed. Please try again.");
    }
  };

  // Function to submit a new ESG audit request
  const submit = async (e?: any) => {
    if (e) e.preventDefault(); // Prevent default form submission
    if (!company.trim() || loading) return; // Don't submit if company is empty or already loading

    setError(""); // Clear previous errors
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
        `https://greenwash-api-production.up.railway.app/generate-audit?company=${encodeURIComponent(company)}`
      );
      if (res.status < 200 || res.status >= 300 || !res.data) {
        throw new Error(`Bad response: ${res.status}`);
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
      console.error("Error:", err);
      setError(
        err?.response?.data?.detail
          ? `Backend error: ${err.response.data.detail}`
          : "Failed to retrieve audit report. Please try again."
      );
    } finally {
      setLoading(false);
    }
    
  };

  // State for scroll button visibility
  const [showScrollButton, setShowScrollButton] = useState(true);

  // Effect to handle scroll button visibility
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      // Hide button after scrolling down 200px
      setShowScrollButton(scrollY < 200);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll); // Cleanup event listener
  }, []);

  return (
    <>
      {/* Header Section */}
      <header className="md:ml-64 sticky top-0 z-50 bg-white px-6 py-3 flex items-center justify-between relative">
        {/* Left: Mobile menu + Brand (desktop) */}
        <div className="flex items-center gap-3">
          {/* Mobile toggle (mobile only) */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="md:hidden text-emerald-600"
            aria-label="Toggle Sidebar"
          >
            {isSidebarOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
          </button>

          {/* Brand for desktop (hidden on mobile) */}
          <div className="hidden md:flex items-center gap-2">
            <img src="favicon.ico" alt="EcoVerifier Logo" className="w-6 h-6" />
            <span className="text-lg font-semibold text-emerald-600 tracking-tight">
              EcoVerifier
            </span>
          </div>
        </div>

        {/* Center: Brand on mobile only */}
        <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2 md:hidden">
          <img src="favicon.ico" alt="EcoVerifier Logo" className="w-6 h-6" />
          <span className="text-base font-semibold text-emerald-600 tracking-tight">
            EcoVerifier
          </span>
        </div>

        {/* Right: Login/Logout button */}
        <div className="flex gap-5">
          {user ? (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm font-medium text-red-500 hover:text-red-600 transition hover:bg-stone-100 p-2 rounded-md"
            >
              <FiLogOut className="w-4 h-4" />
              Logout
            </button>
          ) : (
            <button
              onClick={login}
              className="flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition hover:bg-stone-100 p-2 rounded-md"
            >
              <FiLogIn className="w-4 h-4" />
              Login with Google
            </button>
          )}

        </div>

      </header>

      {/* Background gradient for the top section */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-white via-[#f7f9fb] to-transparent -z-10" />

      {/* Main Layout (Sidebar + Content) */}
      <div className="flex min-h-screen bg-[#f7f9fb] text-gray-900 font-sans">

        {/* Sidebar */}
        <aside
          className={`fixed top-0 left-0 h-screen w-full max-w-xs md:w-64 bg-white shadow-xl flex flex-col transition-transform duration-300 ease-in-out
            ${isSidebarOpen ? "translate-x-0 z-[60]" : "-translate-x-full z-40"}
            md:translate-x-0 md:z-40 border-r border-gray-100`}
        >
          {/* Sidebar Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
            <h2 className="text-sm font-semibold text-gray-900 tracking-wide uppercase">
              Reports
            </h2>
            {/* New Chat button */}
            <button
              disabled={!sessionStarted}
              onClick={() => {
                setReport(null);
                setCompany("");
                setActiveReportId(null);
                setSessionStarted(false);
                if (window.innerWidth < 768) setIsSidebarOpen(false); // Close sidebar on mobile
              }}
              className={`inline-flex items-center gap-1 text-xs font-medium transition p-2 rounded-md ${
                sessionStarted
                  ? "bg-stone-100 hover:bg-stone-200 text-emerald-600 hover:text-emerald-700"
                  : "bg-stone-50 text-gray-300 cursor-not-allowed"
              }`}
              title="New Score"
            >
              <RiChatNewLine className="w-5 h-5" />
              New Chat
            </button>
          </div>

          {/* Scrollable area for reports list */}
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Reports List */}
            <div className="flex-1 px-4 py-3 space-y-2">
              {reports.map((r) => (
                <div
                  key={r.id}
                  onClick={() => {
                    setReport(r.report); // Set report for display
                    setCompany(r.company); // Set company name in input
                    setActiveReportId(r.id); // Set active report
                    setSessionStarted(true); // Start session
                    if (window.innerWidth < 768) setIsSidebarOpen(false); // Close sidebar on mobile
                  }}
                  className={`group relative p-3 rounded-md text-sm cursor-pointer transition-all duration-200 shadow-sm ${
                    r.id === activeReportId
                      ? "bg-gray-100 shadow-inner"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <span className="block pr-6 font-medium text-sm text-gray-800 leading-tight truncate">
                    {r.company}
                  </span>

                  {/* Trash icon for deleting reports */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent triggering parent onClick
                      setReports((prev) => {
                        const updated = prev.filter((rep) => rep.id !== r.id);
                        const active = r.id === activeReportId;

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

                      // Delete from Firestore for authenticated users
                      if (user) {
                        deleteDoc(doc(db, "reports", r.id));
                      }
                    }}
                    className="absolute top-2.5 right-3 text-gray-400 hover:text-red-500 transition-opacity opacity-100 md:opacity-0 md:group-hover:opacity-100"
                    title="Delete report"
                  >
                    <FaTrashAlt className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Mobile Overlay for sidebar */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-30 z-30 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main Content Area */}
        <main className="md:pl-64 flex-1 px-6 py-5 sm:px-10 bg-gray-50 min-h-screen">

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
                  <p className="text-sm text-red-500 font-medium mb-4">
                    "Please enter a real company.'"
                  </p>
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
                      className="w-full p-4 border border-gray-300 rounded-lg shadow-md resize-none focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm bg-white"
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
                      I'm Ishan Singh, a high school student driven by the intersection of tech, finance, and environmental accountability. 
                      EcoVerifier is my effort to hold companies accountable by turning vague ESG claims into measurable, event-based scores.
                    </p>
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
                  <h1 className="text-3xl font-bold tracking-tight">Sustainability Report</h1>
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
                        Auditing the company using environmental news and Mistral reasoning...
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
                        <h3 className="text-lg font-medium text-gray-900">GreenScore</h3>

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
                                    [{s.source_type}] {s.impact} impact, {s.direction} direction — {s.date}
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
        </main>
      </div>
    </>
  );
}
