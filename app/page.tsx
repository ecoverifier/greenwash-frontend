"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { PaperPlaneIcon, DownloadIcon } from "@radix-ui/react-icons";
import jsPDF from "jspdf";
import { FaUserCircle, FaRobot, FaPlus, FaTrashAlt } from "react-icons/fa";
import { HiArrowUpCircle } from "react-icons/hi2";
import { RiChatNewLine } from "react-icons/ri";
import { FiLogIn, FiLogOut, FiMenu, FiX } from "react-icons/fi";
import { FaArrowDown } from "react-icons/fa";




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

type ESGFinding = {
  date: string;
  title: string;
  impact: "high" | "medium" | "low";
  direction: "positive" | "negative" | "unclear";
  source_type: string;
  summary: string;
  source_url: string;
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
    factors: string[];
    note: string;
  };
};


export default function Home() {
  // 🔒 Auth state and logout
const [isSidebarOpen, setIsSidebarOpen] = useState(false);
const [verifying, setVerifying] = useState(false);

const [sessionStarted, setSessionStarted] = useState(false);
const [user, setUser] = useState<User | null>(null);
const [error, setError] = useState("");

const handleLogout = async () => {
  try {
    await signOut(auth);
    setUser(null);
    setReport(null);
    setCompany("");
    setSessionStarted(false);
    setActiveReportId(null);
  } catch (err) {
    console.error("Logout failed", err);
    setError("Logout failed. Please try again.");
  }
};

// ✅ Placeholder typing animation (cleaned and simplified)
const examples = [
  "e.g. Amazon",
  "e.g. Apple",
  "e.g. Shell",
];

const [animatedPlaceholder, setAnimatedPlaceholder] = useState("");
const [exampleIndex, setExampleIndex] = useState(0);
const [charIndex, setCharIndex] = useState(0);
const [isDeleting, setIsDeleting] = useState(false);
const [company, setCompany] = useState("");

useEffect(() => {
  const current = examples[exampleIndex];
  let speed = isDeleting ? 25 : 60;

  const timeout = setTimeout(() => {
    if (isDeleting) {
      setAnimatedPlaceholder((prev) => prev.slice(0, -1));
      setCharIndex((prev) => prev - 1);
      if (charIndex === 0) {
        setIsDeleting(false);
        setExampleIndex((prev) => (prev + 1) % examples.length);
      }
    } else {
      setAnimatedPlaceholder(current.slice(0, charIndex + 1));
      setCharIndex((prev) => prev + 1);
      if (charIndex === current.length) {
        setIsDeleting(true);
      }
    }
  }, speed);

  return () => clearTimeout(timeout);
}, [charIndex, isDeleting, exampleIndex]);

// 📦 Report data
const [report, setReport] = useState<ReportType | null>(null);
const [loading, setLoading] = useState(false);
const [reports, setReports] = useState<any[]>(() => {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("anon_reports");
    return stored ? JSON.parse(stored) : [];
  }
  return [];
});
const [activeReportId, setActiveReportId] = useState<string | null>(null);

// 🔑 Auth state change listener
useEffect(() => {
  onAuthStateChanged(auth, (u) => {
    setUser(u);
    fetchReports(u?.uid);
  });
}, []);

// 🔍 Fetch user or local reports
const fetchReports = async (uid?: string) => {
  if (uid) {
    const q = query(
      collection(db, "reports"),
      where("uid", "==", uid),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setReports(data);
  } else {
    const stored = localStorage.getItem("anon_reports");
    setReports(stored ? JSON.parse(stored) : []);
  }
};

// 🔐 Login
const login = async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error("Login failed", err);
    setError("Login failed. Please try again.");
  }
};

// 🚀 Submit a claim
const submit = async (e?: any) => {
  if (e) e.preventDefault();
  if (!company.trim() || loading) return;

  setError("");
  setLoading(true);
  setReport(null);
  setSessionStarted(true);

  const newId = crypto.randomUUID();
  const newReportEntry = { id: newId, company, report: null };
  setReports((prev) => [newReportEntry, ...prev]);
  setActiveReportId(newId);

  try {
    const res = await axios.get(
      `https://greenwash-api-production.up.railway.app/generate-audit?company=${encodeURIComponent(company)}`
    );
    const result = res.data;

    setReports((prev) =>
      prev.map((r) =>
        r.id === newId ? { ...r, report: result } : r
      )
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
  } catch (err) {
    console.error("Error:", err);
    setError("Failed to retrieve audit report.");
  } finally {
    setLoading(false);
  }
};






const [showScrollButton, setShowScrollButton] = useState(true);

useEffect(() => {
  const handleScroll = () => {
    const scrollY = window.scrollY;
    setShowScrollButton(scrollY < 200); // hide after 200px scroll
  };

  window.addEventListener("scroll", handleScroll);
  return () => window.removeEventListener("scroll", handleScroll);
}, []);


  return (
    <>
  
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

    {/* Right: About button */}
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




<div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-white via-[#f7f9fb] to-transparent -z-10" />


  {/* Main Layout */}
  <div className="flex min-h-screen bg-[#f7f9fb] text-gray-900 font-sans">
    
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
    <button
      disabled={!sessionStarted}
      onClick={() => {
        setReport(null);
        setCompany("");
        setActiveReportId(null);
        setSessionStarted(false);
        if (window.innerWidth < 768) setIsSidebarOpen(false);
      }}
      className={`inline-flex items-center gap-1 text-xs font-medium transition p-2 rounded-md ${
        sessionStarted
          ? "bg-stone-100 hover:bg-stone-200 text-emerald-600 hover:text-emerald-700"
          : "bg-stone-50 text-gray-300 cursor-not-allowed"
      }`}
      title="New Claim"
    >
      <RiChatNewLine className="w-5 h-5" />
      New Chat
    </button>

  </div>

  {/* Scrollable area includes both content and footer */}
  <div className="flex-1 overflow-y-auto flex flex-col">
    {/* Reports List */}
    <div className="flex-1 px-4 py-3 space-y-2">
      {reports.map((r) => (
        <div
          key={r.id}
          onClick={() => {
            setReport(r.report);
            setCompany(r.company);
            setActiveReportId(r.id);
            setSessionStarted(true);
            if (window.innerWidth < 768) setIsSidebarOpen(false);
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

          {/* Trash icon – hidden by default, shown on hover */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setReports((prev) => {
                const updated = prev.filter((rep) => rep.id !== r.id);
                const active = r.id === activeReportId;

                if (active) {
                  if (updated.length > 0) {
                    const next = updated[0];
                    setReport(next.report);
                    setCompany(next.claim);
                    setActiveReportId(next.id);
                    setSessionStarted(true);
                  } else {
                    setReport(null);
                    setCompany("");
                    setActiveReportId(null);
                    setSessionStarted(false);
                    setLoading(false);
                    setVerifying(false);

                    
                  }
                }

                if (!user) {
                  localStorage.setItem("anon_reports", JSON.stringify(updated));
                }

                return updated;
              });

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




    {/* Mobile Overlay */}
    {isSidebarOpen && (
      <div
        className="fixed inset-0 bg-opacity-30 z-30 md:hidden"
        onClick={() => setIsSidebarOpen(false)}
      />
    )}

    {/* Main Content */}
    <main className="md:pl-64 flex-1 px-6 py-5 sm:px-10 bg-gray-50 min-h-screen">


      {/* Content */}
      {!sessionStarted ? (
        
        <div className="w-full max-w-2xl mx-auto text-center space-y-12 pt-12">
          
          <div className="space-y-6 min-h-screen">
            <h1 className="text-4xl md:text-6xl font-extrabold text-emerald-700 leading-tight">
              Check your portfolios for sustainability.
            </h1>
            <p className="text-gray-600 text-md md:text-lg max-w-xl mx-auto">
              EcoVerifier helps you cut through greenwashing by analyzing environmental claims using trusted sources.
            </p>

            {verifying && (
              <p className="text-sm text-gray-500 animate-pulse mb-4">
                Analyzing company...
              </p>
            )}

            {error && (
              <p className="text-sm text-red-500 font-medium mb-4">
                "Please enter a valid sustainability claim. An example of a valid sustainability claim is: 'Apple will be carbon neutral by 2040.'"
              </p>
            )}


            <form onSubmit={submit} className="relative mt-12">
  <div className="relative">
    <textarea
      rows={4}
      value={company}
      onChange={(e) => setCompany(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (!loading) {
            submit(e);
          }
        }
      }}
      
      className="w-full p-4 border border-gray-300 rounded-lg shadow-md resize-none focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm bg-white"
    />
    {company.length === 0 && (
      <div className="absolute top-4 left-4 text-gray-400 pointer-events-none text-sm">
        {animatedPlaceholder}
      </div>
    )}
  </div>
  <button
  type="submit"
  disabled={loading}
  className={`absolute bottom-3 right-3 ${
    loading ? "bg-gray-300 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
  } text-white p-2 md:p-3 rounded-full shadow-md transition`}
  aria-label="Submit"
>
  {loading ? (
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
                EcoVerifier helps critically evaluate environmental claims using trusted data and AI.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm text-gray-700">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Who It's For</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Students researching climate responsibility</li>
                    <li>ESG investors analyzing environmental factors</li>
                    <li>Consumers checking company pledges</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Tech Stack</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>React + Next.js</li>
                    <li>Tailwind CSS</li>
                    <li>Firebase (Auth & DB)</li>
                    <li>GPT 4.1 + Brave API</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">About the Creator</h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  I'm Ishan Singh, a high school student passionate about tech and economics.
                  EcoVerifier is my initiative to fight misinformation and greenwashing with AI.
                </p>
              </div>

              <blockquote className="italic text-sm text-gray-500 border-l-4 border-emerald-400 pl-4 mt-4">
                “55% of global customers are skeptical of the sustainability claims of most brands.” — YouGov, 2023
              </blockquote>
            </div>
          </section>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto px-6 py-10 space-y-10 bg-gray-50">

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-16 text-gray-800 font-sans">

{/* Title */}
<header className="space-y-2 border-b pb-6">
  <h1 className="text-3xl font-bold tracking-tight">Claim Analysis Report</h1>
  <p className="text-gray-500 text-sm">Generated by automated RAG pipeline reasoning and source verification.</p>
</header>

{/* Submitted Claim */}
<section className="space-y-4">
  <h2 className="text-xl font-semibold text-gray-900">Submitted Claim</h2>
  <div className="bg-gray-50 border border-gray-200 rounded-md p-5 text-base leading-relaxed">
    {company}
  </div>
</section>

{/* Report Body */}
<section className="space-y-10">
  {/* Loading State */}
  {loading && !report && (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Audit Status</h2>
      <div className="text-gray-500 italic animate-pulse">
        Auditing the company using environmental news and AI reasoning...
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
        <div className="flex items-center gap-6">
          <svg width="100" height="100" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="16" fill="none" stroke="#e5e7eb" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke={`hsl(${(report.greenscore.score / 100) * 120}, 100%, 40%)`}
              strokeWidth="3"
              strokeDasharray="100"
              strokeDashoffset={100 - report.greenscore.score}
              strokeLinecap="round"
              transform="rotate(-90 18 18)"
              style={{ transition: "stroke-dashoffset 1s ease, stroke 1s ease" }}
            />
            <text x="18" y="21" textAnchor="middle" fill="#111827" fontSize="10" fontWeight="bold">
              {report.greenscore.score}%
            </text>
          </svg>
          <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
            {report.greenscore.factors.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
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
      <div className="space-y-6">
        <h3 className="text-lg font-medium text-gray-900">ESG Findings</h3>
        <ul className="space-y-6 list-none">
          {report.eco_audit.findings.map((finding, idx) => (
            <li key={idx} className="space-y-2 border-t pt-4">
              <a
                href={finding.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 font-semibold hover:underline"
              >
                {finding.title}
              </a>
              <p className="text-sm text-gray-700">{finding.summary}</p>
              <p className="text-sm text-gray-600 italic">
                [{finding.source_type}] {finding.impact} impact, {finding.direction} direction — {finding.date}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* Download Button */}
      
    </>
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

