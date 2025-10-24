"use client";
import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { HiArrowUpCircle } from "react-icons/hi2";
import { FaArrowDown } from "react-icons/fa";
import AddToPortfolioButton from "./components/AddToPortfolioButton";
import Layout from "./components/Layout";
import ReportsSidebar from "./components/ReportsSidebar";
import jsPDF from "jspdf";

// Firebase
import { auth, provider, db, signInWithPopup, signOut } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, addDoc, getDocs, deleteDoc, doc, query, where } from "firebase/firestore";

// === Types ===
type ESGFinding = {
  date?: string;
  title: string;
  impact: "high" | "medium" | "low";
  direction: "positive" | "negative" | "unclear";
  source_type?: string;
  summary?: string;
  source_url: string;
  source_domain?: string;
};

type SourceItem = {
  title?: string;
  url: string;
  source_domain?: string;
  source_type?: string;
  impact: "high" | "medium" | "low";
  direction: "positive" | "negative" | "unclear";
  summary?: string;
  date?: string;
};

type ReportType = {
  company: string;
  eco_audit: {
    last_audit_date?: string;
    total_events: number;
    high_risk_flag_count: number;
    concern_level: string;
    summary?: string;
    findings: ESGFinding[];
  };
  greenscore: {
    score: number;
    base_score?: number;
    rationale?: string;
    factors?: string[];
    note?: string;
  };
  sources?: SourceItem[];
};

// === Config ===
const API_BASE = process.env.NEXT_PUBLIC_ECOVERIFIER_API ?? "https://greenwash-api-production.up.railway.app";

function safeUUID() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {}
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeCompany(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function isValidReport(data: any): data is ReportType {
  return (
    data &&
    typeof data.company === "string" &&
    data.greenscore && typeof data.greenscore.score === "number" &&
    data.eco_audit && Array.isArray(data.eco_audit.findings)
  );
}

export default function Home() {
  // Core state
  const [verifying, setVerifying] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [isRetryableError, setIsRetryableError] = useState(false);
  const [company, setCompany] = useState("");
  const [report, setReport] = useState<ReportType | null>(null);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [inflightId, setInflightId] = useState<string | null>(null);

  // Animated placeholder
  const examples = ["Enter a company name", "e.g. Amazon, Apple, Shell, or Tesla"];
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState("");
  const [exampleIndex, setExampleIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  // Scroll button visibility
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Initialize reports from localStorage (anon)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("anon_reports");
      if (stored) setReports(JSON.parse(stored));
    } catch {
      localStorage.removeItem("anon_reports");
    }
  }, []);

  // Auth state listener + fetch reports
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      fetchReports(u?.uid);
    });
    return () => unsubscribe();
  }, []);

  const fetchReports = useCallback(async (uid?: string) => {
    if (uid) {
      const q = query(collection(db, "reports"), where("uid", "==", uid));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      data.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setReports(data);
    } else {
      try {
        const stored = localStorage.getItem("anon_reports");
        setReports(stored ? JSON.parse(stored) : []);
      } catch {
        setReports([]);
        localStorage.removeItem("anon_reports");
      }
    }
  }, []);

  // Typing animation
  useEffect(() => {
    const current = examples[exampleIndex];
    const speed = isDeleting ? 25 : 60;
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
        if (charIndex === current.length) setIsDeleting(true);
      }
    }, speed);
    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, exampleIndex]);

  // Scroll button show/hide
  useEffect(() => {
    const setInitialState = () => {
      if (typeof window !== "undefined") setShowScrollButton(window.scrollY < 200);
    };
    const handleScroll = () => {
      if (typeof window !== "undefined") setShowScrollButton(window.scrollY < 200);
    };
    setInitialState();
    if (typeof window !== "undefined") {
      window.addEventListener("scroll", handleScroll);
      return () => window.removeEventListener("scroll", handleScroll);
    }
  }, []);

  // Auth actions
  const login = useCallback(async () => {
    try { await signInWithPopup(auth, provider); } catch { setError("Login failed. Please try again."); }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
      setUser(null);
      setReport(null);
      setCompany("");
      setSessionStarted(false);
      setActiveReportId(null);
      setError("");
      setIsRetryableError(false);
    } catch {
      setError("Logout failed. Please try again.");
    }
  }, []);

  // New chat
  const handleNewChat = useCallback(() => {
    setReport(null);
    setCompany("");
    setActiveReportId(null);
    setSessionStarted(false);
    setError("");
    setIsRetryableError(false);
  }, []);

  const handleSelectReport = useCallback((r: any) => {
    setReport(r.report);
    setCompany(r.company);
    setActiveReportId(r.id);
    setSessionStarted(true);
    setError("");
    setIsRetryableError(false);
  }, []);

  const handleDeleteReport = useCallback(async (reportId: string) => {
    if (user) {
      try { await deleteDoc(doc(db, "reports", reportId)); } catch {}
    }
    setReports((prev) => {
      const updated = prev.filter((rep) => rep.id !== reportId);
      if (!user) localStorage.setItem("anon_reports", JSON.stringify(updated));
      const active = reportId === activeReportId;
      if (active) {
        if (updated.length > 0) {
          const next = updated[0];
          setReport(next.report);
          setCompany(next.company);
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
      return updated;
    });
  }, [activeReportId, user]);

  // Submit
  const submit = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (loading) return;

    const normalized = normalizeCompany(company);
    if (!normalized) {
      setError("Please enter a company name to analyze.");
      setIsRetryableError(false);
      return;
    }

    setError("");
    setIsRetryableError(false);
    setLoading(true);
    setVerifying(true);
    setReport(null);
    setSessionStarted(true);

    const newId = safeUUID();
    const newReportEntry = { id: newId, company: normalized, report: null };

    setReports((prev) => [newReportEntry, ...prev]);
    setActiveReportId(newId);
    setInflightId(newId);

    const controller = new AbortController();

    try {
      const res = await axios.get(
        `${API_BASE}/generate-audit?company=${encodeURIComponent(normalized)}`,
        { timeout: 90000, validateStatus: (s) => s >= 200 && s < 500, signal: controller.signal }
      );

      if (res.status >= 400) {
        throw { response: res, status: res.status, data: res.data };
      }

      const data = res.data;
      if (!isValidReport(data)) throw new Error("Malformed API response (missing required fields)");

      if (inflightId !== newId) return; // ignore stale response

      setReports((prev) => {
        const updated = prev.map((r) => (r.id === newId ? { ...r, report: data } : r));
        if (!user) localStorage.setItem("anon_reports", JSON.stringify(updated));
        return updated;
      });
      setActiveReportId(newId);
      setReport(data);

      if (user) {
        await addDoc(collection(db, "reports"), {
          uid: user.uid,
          company: normalized,
          report: data,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      if (err?.code === "ECONNABORTED" || err?.message?.includes("timeout")) {
        setError("The request timed out. The analysis is taking longer than expected. Please try again.");
        setIsRetryableError(true);
      } else if (err?.code === "ERR_NETWORK" || err?.message?.includes("Network Error")) {
        setError("Network error. Please check your internet connection and try again.");
        setIsRetryableError(true);
      } else if (err?.code === "ERR_INTERNET_DISCONNECTED") {
        setError("No internet connection. Please check your connection and try again.");
        setIsRetryableError(true);
      } else if (!err?.response && !err?.status) {
        setError("Unable to connect to our servers. Please check your internet connection and try again.");
        setIsRetryableError(true);
      } else if (err?.response?.data?.detail || err?.data?.detail) {
        const errorDetail = err.response?.data?.detail || err.data?.detail;
        const errorCode = errorDetail.error;
        const errorMessage = errorDetail.message;
        const retryGuidance = errorDetail.retry_guidance;
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
          case "INVALID_COMPANY":
            setError("Please enter a valid, real company name for analysis.");
            setIsRetryableError(false);
            break;
          default:
            if (errorMessage) {
              setError(`Validation failed: ${errorMessage}`);
              setIsRetryableError(!!retryGuidance);
            } else {
              setError("Company validation failed. Please try a different company name.");
              setIsRetryableError(false);
            }
        }
      } else if ((err?.response?.status || err?.status) === 429) {
        setError("Too many requests. Please wait a moment before trying again.");
        setIsRetryableError(true);
      } else if ((err?.response?.status || err?.status) >= 500) {
        setError("Our servers are experiencing issues. Please try again later.");
        setIsRetryableError(true);
      } else {
        setError("Failed to retrieve audit report. Please check your connection and try again.");
        setIsRetryableError(true);
      }
    } finally {
      setLoading(false);
      setVerifying(false);
      setInflightId(null);
    }

    return () => controller.abort();
  }, [company, inflightId, loading, user]);

  // PDF export
  const downloadPdf = useCallback(() => {
    if (!report) return;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`EcoVerifier Report — ${report.company}`, 14, 18);
    doc.setFontSize(11);
    const gs = Math.max(0, Math.min(100, report.greenscore?.score ?? 0));
    doc.text(`GreenScore: ${gs}`, 14, 28);
    doc.text(`Total Events: ${report.eco_audit.total_events}`, 14, 36);
    doc.text(`High-Risk Issues: ${report.eco_audit.high_risk_flag_count}`, 14, 44);
    doc.text(`Concern Level: ${report.eco_audit.concern_level}`, 14, 52);
    const summary = report.eco_audit.summary ?? "";
    const wrapped = doc.splitTextToSize(summary, 180);
    doc.text(wrapped, 14, 64);
    doc.save(`EcoVerifier_${report.company.replace(/\s+/g, "_")}.pdf`);
  }, [report]);

  // Sidebar content
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
    <Layout showSidebar={true} sidebarContent={sidebarContent} title="EcoVerifier">
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-white via-[#f7f9fb] to-transparent -z-10" />

      <div className="flex-1 px-6 py-5 sm:px-10 bg-gray-50 min-h-screen">
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
                <p className="text-sm text-gray-500 animate-pulse mb-4">Analyzing company...</p>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg" aria-live="polite">
                  <p className="text-sm text-red-700 font-medium mb-2">{error}</p>
                  {isRetryableError && (
                    <button
                      onClick={() => {
                        setError("");
                        setIsRetryableError(false);
                        if (normalizeCompany(company)) submit();
                      }}
                      className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded transition-colors"
                    >
                      Try Again
                    </button>
                  )}
                </div>
              )}

              <form onSubmit={submit} className="relative mt-12">
                <div className="relative">
                  <label htmlFor="company" className="sr-only">Company name</label>
                  <textarea
                    id="company"
                    rows={4}
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (!loading) submit(e);
                      }
                    }}
                    className="w-full p-4 border border-gray-300 rounded-lg shadow-md resize-none focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm text-gray-900 bg-white"
                    placeholder=""
                    aria-describedby="company-help"
                  />
                  {company.length === 0 && (
                    <div className="absolute top-4 left-4 text-gray-400 pointer-events-none text-sm">
                      {animatedPlaceholder}
                    </div>
                  )}
                  <p id="company-help" className="sr-only">Press Enter to submit. Use Shift+Enter for a new line.</p>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className={`absolute bottom-3 right-3 ${loading ? "bg-gray-300 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"} text-white p-2 md:p-3 rounded-full shadow-md transition`}
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

              <div className="w-full flex justify-center py-6 px-4 md:px-8">
                <a
                  href="#about"
                  className={`fixed bottom-6 z-50 p-4 rounded-full justify-center shadow-lg bg-emerald-600 text-white transition-transform duration-500 ease-in-out ${showScrollButton ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"}`}
                  aria-label="Scroll to About"
                >
                  <FaArrowDown className="w-4 h-4" />
                </a>
              </div>

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
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-10 space-y-10 bg-gray-50">
            <div className="max-w-3xl mx-auto px-6 py-12 space-y-16 text-gray-800 font-sans">
              <header className="space-y-2 border-b pb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Environmental Risk Report</h1>
                  <p className="text-gray-500 text-sm">Generated by automated RAG pipeline reasoning and source verification.</p>
                </div>
                {report && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={downloadPdf}
                      className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-md"
                    >
                      Download PDF
                    </button>
                    <button
                      onClick={handleNewChat}
                      className="text-sm bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 px-3 py-2 rounded-md"
                    >
                      New audit
                    </button>
                  </div>
                )}
              </header>

              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">Submitted Company</h2>
                <div className="bg-gray-50 border border-gray-200 rounded-md p-5 text-base leading-relaxed">{company}</div>
              </section>

              <section className="space-y-10">
                {loading && !report && (
                  <section className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-900">Audit Status</h2>
                    <div className="text-gray-500 italic animate-pulse">Auditing the company using environmental news and model reasoning...</div>
                  </section>
                )}

                {report && !error && (
                  <>
                    <div className="space-y-2">
                      <h3 className="text-lg font-medium text-gray-900">Company Audited</h3>
                      <p className="text-xl font-semibold text-gray-900">{report.company}</p>
                    </div>

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
                              <text x="18" y="21" textAnchor="middle" fill="#111827" fontSize="10" fontWeight="bold">{gs}%</text>
                            </svg>
                            <div className="flex-1">
                              {typeof report.greenscore.base_score === "number" && (
                                <p className="text-xs text-gray-500 mb-1">Base: {report.greenscore.base_score} • Final: {gs}</p>
                              )}
                              <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
                                {(
                                  report.greenscore.factors && report.greenscore.factors.length > 0
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

                    <div className="space-y-2">
                      <h3 className="text-lg font-medium text-gray-900">Audit Summary</h3>
                      <div className="text-base text-gray-700 leading-relaxed">
                        <p><strong>Total Events:</strong> {report.eco_audit.total_events}</p>
                        <p><strong>High-Risk Issues:</strong> {report.eco_audit.high_risk_flag_count}</p>
                        <p><strong>Concern Level:</strong> {report.eco_audit.concern_level}</p>
                        {report.eco_audit.summary && <p className="mt-2">{report.eco_audit.summary}</p>}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <h3 className="text-lg font-medium text-gray-900">Sources</h3>
                      <ul className="space-y-6 list-none">
                        {(report.sources && report.sources.length > 0
                          ? report.sources.map((s, idx) => (
                              <li key={idx} className="space-y-2 border-t pt-4">
                                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold hover:underline">
                                  {s.title || s.url}
                                </a>
                                {s.summary && <p className="text-sm text-gray-700">{s.summary}</p>}
                                <p className="text-xs text-gray-500">
                                  {s.source_domain ? `${s.source_domain} • ` : ""}
                                </p>
                              </li>
                            ))
                          : report.eco_audit.findings.map((f, idx) => (
                              <li key={idx} className="space-y-2 border-t pt-4">
                                <a href={f.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold hover:underline">
                                  {f.title}
                                </a>
                                {f.summary && <p className="text-sm text-gray-700">{f.summary}</p>}
                                <p className="text-xs text-gray-500">
                                  {f.source_domain ? `${f.source_domain} • ` : ""}
                                </p>
                              </li>
                            ))
                        )}
                      </ul>
                    </div>
                  </>
                )}

                {error && !loading && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert" aria-live="polite">
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
