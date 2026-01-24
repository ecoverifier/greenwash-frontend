"use client";
import { useState, useEffect, Fragment } from "react";
import axios from "axios";
import { Analytics } from "@vercel/analytics/next";
import jsPDF from "jspdf";
import { HiArrowUpCircle } from "react-icons/hi2";
import { FaArrowDown } from "react-icons/fa";
import Layout from "./components/Layout";
import ReportsSidebar from "./components/ReportsSidebar";

import { auth, provider, db, signInWithPopup, signOut } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";

/** ---------------------------
 * Types (UPDATED for Option A)
 * -------------------------- */
type ESGFinding = {
  date: string; // audit date
  article_date?: string | null; // publish date extracted from page (ISO)
  title: string; // article title
  summary: string; // event sentence

  source_url: string;
  source_domain?: string;

  // Option A trust metadata
  trusted_for_score?: boolean;
  domain_is_trusted?: boolean;
  domain_credibility_score?: number;
  domain_category?: string;

  // 6-factor analysis
  severity: number; // −1..+1 (− = beneficial, + = harmful)
  credibility: number; // 0..1 (model’s source reliability estimate)
  recency: number; // 0..1
  scope: number; // 0.2..1
  confidence: number; // 0..1

  // scoring
  event_risk_score: number; // −1..+1 (post-compression)
  event_score_0_100: number; // 0..100 (higher = better)
  contribution?: number; // 0..1
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
    final_risk: number;
  };
};

type TopDriver = {
  title: string;
  url: string;
  event_risk_score: number;
  event_score_0_100: number;
  contribution_pct: number;
  credibility: number;
  recency: number;
  scope: number;
  domain_credibility_score?: number;
  domain_category?: string;
  domain_is_trusted?: boolean;
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
    score: number; // 0..100 (higher = lower risk)
    risk_score?: number; // mean risk −1..+1
    risk_level?: string; // low/medium/high/very high
    rationale?: string;
    factors?: string[];
    note: string;
    why?: string;
    top_drivers?: TopDriver[];
    counts?: {
      total_events: number;
      harmful_events: number;
      beneficial_events: number;
      trusted_events_used_for_score: number;
    };
    trusted_thresholds?: {
      min_domain_cred: number;
      min_model_cred: number;
      min_trusted_events_for_score: number;
    };
    base_score?: number; // optional legacy
  };
};

/** ---------------------------
 * Helpers
 * -------------------------- */
function pct01(n: number | undefined) {
  const v = Math.max(0, Math.min(1, n ?? 0));
  return Math.round(v * 100);
}
function clamp100(n: number | undefined) {
  const v = Number.isFinite(n as any) ? Number(n) : 0;
  return Math.max(0, Math.min(100, v));
}
function fmtISODateShort(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function Home() {
  const [verifying, setVerifying] = useState(false);
  const [openRow, setOpenRow] = useState<Record<number, boolean>>({});

  const [sessionStarted, setSessionStarted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [isRetryableError, setIsRetryableError] = useState(false);

  const examples = ["Enter a company name", "e.g. Apple, Shell, or Tesla"];
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState("");
  const [exampleIndex, setExampleIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const [company, setCompany] = useState("");
  const [report, setReport] = useState<ReportType | null>(null);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  // NEW: event filters for usability
  const [eventFilter, setEventFilter] = useState<"all" | "trusted" | "harmful" | "beneficial">("all");

  // typing animation
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
        if (charIndex === current.length) {
          setIsDeleting(true);
        }
      }
    }, speed);

    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, exampleIndex, examples]);

  // init local reports
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("anon_reports");
      if (stored) setReports(JSON.parse(stored));
    }
  }, []);

  // auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      fetchReports(u?.uid);
    });
    return () => unsubscribe();
  }, []);

  const fetchReports = async (uid?: string) => {
    if (uid) {
      const q = query(collection(db, "reports"), where("uid", "==", uid));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as any[];
      data.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setReports(data);
    } else {
      const stored = localStorage.getItem("anon_reports");
      setReports(stored ? JSON.parse(stored) : []);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setReport(null);
      setCompany("");
      setSessionStarted(false);
      setActiveReportId(null);
      setError("");
      setIsRetryableError(false);
    } catch (err) {
      setError("Logout failed. Please try again.");
    }
  };

  const login = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError("Login failed. Please try again.");
    }
  };

  const submit = async (e?: any) => {
    if (e) e.preventDefault();
    if (!company.trim() || loading) return;

    setError("");
    setIsRetryableError(false);
    setLoading(true);
    setReport(null);
    setSessionStarted(true);
    setEventFilter("all");
    setOpenRow({});

    const newId = crypto.randomUUID();
    const newReportEntry = { id: newId, company, report: null };
    setReports((prev) => [newReportEntry, ...prev]);
    setActiveReportId(newId);

    try {
      const res = await axios.get(
        `https://greenwash-api-production.up.railway.app/generate-audit?company=${encodeURIComponent(company)}`,
        {
          timeout: 90000,
          validateStatus: (status) => status >= 200 && status < 500,
        }
      );

      if (res.status >= 400) {
        throw { response: res, status: res.status, data: res.data };
      }

      const result = res.data as ReportType;

      if (typeof result?.greenscore?.score !== "number") {
        throw new Error("Malformed API response (missing greenscore.score)");
      }

      setReports((prev) => prev.map((r) => (r.id === newId ? { ...r, report: result } : r)));
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
            setError("The company name you entered appears to be invalid or not a legitimate business. Please enter a real company name.");
            setIsRetryableError(false);
            break;
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
    }
  };

  // scroll button
  const [showScrollButton, setShowScrollButton] = useState(false);
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

  const handleNewChat = () => {
    setReport(null);
    setCompany("");
    setActiveReportId(null);
    setSessionStarted(false);
    setError("");
    setIsRetryableError(false);
    setEventFilter("all");
    setOpenRow({});
  };

  const handleSelectReport = (r: any) => {
    setReport(r.report);
    setCompany(r.company);
    setActiveReportId(r.id);
    setSessionStarted(true);
    setError("");
    setIsRetryableError(false);
    setEventFilter("all");
    setOpenRow({});
  };

  const handleDeleteReport = (reportId: string) => {
    setReports((prev) => {
      const updated = prev.filter((rep) => rep.id !== reportId);
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

      if (!user) localStorage.setItem("anon_reports", JSON.stringify(updated));
      return updated;
    });
  };

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

  // derived list: filter events for usability
  const allFindings = report?.eco_audit?.findings ?? [];
  const filteredFindings = allFindings.filter((f) => {
    const r = Number(f.event_risk_score ?? 0);
    if (eventFilter === "trusted") return !!f.trusted_for_score;
    if (eventFilter === "harmful") return r > 0;
    if (eventFilter === "beneficial") return r < 0;
    return true;
  });

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

              {verifying && <p className="text-sm text-gray-500 animate-pulse mb-4">Analyzing company...</p>}

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700 font-medium mb-2">{error}</p>
                  {isRetryableError && (
                    <button
                      onClick={() => {
                        setError("");
                        setIsRetryableError(false);
                        if (company.trim()) submit();
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
                  <textarea
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
                  />
                  {company.length === 0 && (
                    <div className="absolute top-4 left-4 text-gray-400 pointer-events-none text-sm">{animatedPlaceholder}</div>
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
                  <header className="space-y-4 border-b border-slate-200 pb-6">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 border border-emerald-100">
                          <span className="text-[11px]">EcoVerifier</span>
                          <span className="h-1 w-1 rounded-full bg-emerald-500" />
                          <span>Automated ESG risk check</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Environmental Risk Report</h1>
                        <p className="text-sm text-gray-500 max-w-xl">
                          We scan independent sources and extract <strong>ESG events</strong> about this company, then compute a GreenScore and explain why.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500">
                      {[
                        ["1", "Company"],
                        ["2", "GreenScore"],
                        ["3", "What we found"],
                        ["4", "Events & sources"],
                      ].map(([n, label]) => (
                        <span key={n} className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1 border border-slate-200">
                          <span className="h-4 w-4 rounded-full bg-slate-900 text-[10px] text-white flex items-center justify-center">{n}</span>
                          {label}
                        </span>
                      ))}
                    </div>
                  </header>

                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">1. Company you asked us to check</h2>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:px-5 sm:py-4 text-base leading-relaxed">{company}</div>
                  </section>

                  {loading && !report && (
                    <section className="space-y-4">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Audit status</h2>
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

                  {report && !error && (
                    <>
                      {/* At-a-glance */}
                      {(() => {
                        const gs = Math.max(0, Math.min(100, report.greenscore?.score ?? 0));
                        let levelLabel = "Medium risk";
                        let levelColor = "bg-amber-50 text-amber-900 border-amber-200";
                        if (gs >= 80) {
                          levelLabel = "Low risk";
                          levelColor = "bg-emerald-50 text-emerald-900 border-emerald-200";
                        } else if (gs < 50) {
                          levelLabel = "High risk";
                          levelColor = "bg-red-50 text-red-900 border-red-200";
                        }

                        return (
                          <section className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 sm:px-5 sm:py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Summary at a glance</p>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${levelColor}`}>
                                  Environmental verdict: {levelLabel}
                                </span>
                                <span className="text-sm text-gray-600">
                                  GreenScore <span className="font-semibold">{gs}</span> / 100
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-4 text-xs sm:text-sm text-gray-600">
                              <div>
                                <p className="font-semibold text-gray-900">{report.eco_audit.total_events}</p>
                                <p>Events returned</p>
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{report.eco_audit.high_risk_flag_count}</p>
                                <p>Serious issues flagged</p>
                              </div>
                              {report.greenscore?.counts && (
                                <div>
                                  <p className="font-semibold text-gray-900">
                                    {report.greenscore.counts.harmful_events} harmful • {report.greenscore.counts.beneficial_events} beneficial
                                  </p>
                                  <p>Event balance</p>
                                </div>
                              )}
                            </div>
                          </section>
                        );
                      })()}

                      {/* Company */}
                      <section className="space-y-2">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Company audited</h3>
                        <p className="text-xl font-semibold text-gray-900">{report.company}</p>
                      </section>

                      {/* 2. GreenScore */}
                      <section className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-7 shadow-sm space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                              <span>2. GreenScore</span>
                              {(() => {
                                const gs = Math.max(0, Math.min(100, report.greenscore?.score ?? 0));
                                let label = "Medium risk";
                                let badgeClass = "bg-amber-100 text-amber-800 border-amber-200";
                                if (gs >= 80) {
                                  label = "Low risk";
                                  badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-200";
                                } else if (gs < 50) {
                                  label = "High risk";
                                  badgeClass = "bg-red-100 text-red-800 border-red-200";
                                }
                                return (
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeClass}`}>
                                    {label}
                                  </span>
                                );
                              })()}
                            </h3>
                            <p className="mt-1 text-sm text-gray-600 max-w-xl">
                              GreenScore is a 0–100 rating of this company&apos;s environmental risk based on extracted ESG events.
                              <strong> Higher scores mean lower environmental risk.</strong>
                            </p>
                          </div>
                        </div>

                        {(() => {
                          const gs = Math.max(0, Math.min(100, report.greenscore?.score ?? 0));
                          const factors =
                            report.greenscore.factors && report.greenscore.factors.length > 0
                              ? report.greenscore.factors
                              : report.greenscore.rationale
                              ? [report.greenscore.rationale]
                              : [];
                          const topThreeFactors = factors.slice(0, 3);

                          return (
                            <div className="flex flex-col md:flex-row items-start gap-6">
                              {/* circular */}
                              <div className="flex flex-col items-center gap-2">
                                <svg width="112" height="112" viewBox="0 0 36 36">
                                  <circle cx="18" cy="18" r="16" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
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
                                    style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.8s ease" }}
                                  />
                                  <text x="18" y="20.5" textAnchor="middle" fill="#111827" fontSize="11" fontWeight="bold">
                                    {gs}%
                                  </text>
                                </svg>
                                <p className="text-xs text-gray-500 text-center">0 = very high risk • 100 = very low risk</p>
                              </div>

                              <div className="flex-1 space-y-3">
                                {report.greenscore?.why && <p className="text-sm text-gray-700">{report.greenscore.why}</p>}

                                {topThreeFactors.length > 0 && (
                                  <div className="space-y-1">
                                    <h4 className="text-sm font-semibold text-gray-900">Main reasons for this score</h4>
                                    <ul className="mt-1 text-sm text-gray-700 list-disc pl-5 space-y-1.5">
                                      {topThreeFactors.map((f: string, i: number) => (
                                        <li key={i}>{f}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {report.greenscore?.note && <p className="text-xs text-gray-500">{report.greenscore.note}</p>}

                                {/* CLARITY PANEL (NEW) */}
                                {report.greenscore?.trusted_thresholds && report.greenscore?.counts && (
                                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <h4 className="text-sm font-semibold text-gray-900">How GreenScore is calculated (clarity)</h4>

                                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-700">
                                      <div className="rounded-lg bg-white border border-slate-200 p-3">
                                        <p className="text-gray-500">Events returned</p>
                                        <p className="text-base font-semibold">{report.greenscore.counts.total_events}</p>
                                      </div>
                                      <div className="rounded-lg bg-white border border-slate-200 p-3">
                                        <p className="text-gray-500">Used in score (trusted)</p>
                                        <p className="text-base font-semibold">{report.greenscore.counts.trusted_events_used_for_score}</p>
                                      </div>
                                      <div className="rounded-lg bg-white border border-slate-200 p-3">
                                        <p className="text-gray-500">Scoring rule</p>
                                        <p className="text-[11px] leading-snug">
                                          We compute GreenScore from trusted events only. If too few trusted events exist, we fall back to all events.
                                        </p>
                                      </div>
                                    </div>

                                    <div className="mt-3 text-[11px] text-gray-600 leading-relaxed space-y-1">
                                      <p>
                                        <span className="font-medium">Trusted event rule:</span> allowlisted OR domain credibility ≥{" "}
                                        <span className="font-mono">{report.greenscore.trusted_thresholds.min_domain_cred}</span> AND model credibility ≥{" "}
                                        <span className="font-mono">{report.greenscore.trusted_thresholds.min_model_cred}</span>.
                                      </p>
                                      <p>
                                        <span className="font-medium">Fallback:</span> if trusted events &lt;{" "}
                                        <span className="font-mono">{report.greenscore.trusted_thresholds.min_trusted_events_for_score}</span>, we compute GreenScore from all events.
                                      </p>
                                      <p>
                                        <span className="font-medium">Sign convention:</span> impact is −1..+1 where{" "}
                                        <span className="font-semibold">+1 = harmful</span> and <span className="font-semibold">−1 = beneficial</span>.
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {/* legend */}
                                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                  <div className="flex items-center gap-2 rounded-md border border-emerald-100 bg-emerald-50 px-2.5 py-1.5">
                                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                                    <div>
                                      <p className="font-semibold text-emerald-900">80–100</p>
                                      <p className="text-[11px] text-emerald-900/80">Low environmental risk, strong record.</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 rounded-md border border-amber-100 bg-amber-50 px-2.5 py-1.5">
                                    <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                                    <div>
                                      <p className="font-semibold text-amber-900">50–79</p>
                                      <p className="text-[11px] text-amber-900/80">Medium risk, mixed record.</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 rounded-md border border-red-100 bg-red-50 px-2.5 py-1.5">
                                    <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                                    <div>
                                      <p className="font-semibold text-red-900">0–49</p>
                                      <p className="text-[11px] text-red-900/80">High risk, repeated or serious issues.</p>
                                    </div>
                                  </div>
                                </div>

                                {/* key drivers */}
                                {Array.isArray(report.greenscore?.top_drivers) && report.greenscore.top_drivers.length > 0 && (
                                  <div className="mt-4">
                                    <h4 className="text-sm font-semibold text-gray-900">Key sources influencing this score</h4>
                                    <ul className="mt-2 space-y-3">
                                      {report.greenscore.top_drivers.map((d: any, i: number) => {
                                        const pct = Math.max(0, Math.min(100, d.contribution_pct || 0));
                                        return (
                                          <li key={i} className="border rounded-md p-3 bg-gray-50">
                                            <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 font-medium hover:underline">
                                              {d.title}
                                            </a>
                                            <div className="mt-1 text-[11px] text-gray-600">
                                              Event score: <span className="font-mono">{d.event_score_0_100}</span> • Impact (−1..+1):{" "}
                                              <span className="font-mono">{Number(d.event_risk_score ?? 0).toFixed(3)}</span> • Contribution:{" "}
                                              <span className="font-mono">{pct.toFixed(1)}%</span>
                                            </div>
                                            <div className="mt-2 w-full bg-gray-200 h-2 rounded">
                                              <div className="h-2 rounded" style={{ width: `${pct}%`, backgroundColor: "#10b981" }} />
                                            </div>
                                            <div className="mt-2 text-[11px] text-gray-500">
                                              Credibility {Number(d.credibility ?? 0).toFixed(2)} • Recency {Number(d.recency ?? 0).toFixed(2)} • Scope{" "}
                                              {Number(d.scope ?? 0).toFixed(2)}
                                            </div>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </section>

                      {/* 3. Summary */}
                      <section className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-7 shadow-sm space-y-2">
                        <h3 className="text-base font-semibold text-gray-900">3. What we found</h3>
                        {report.greenscore?.counts && (
                          <p className="text-sm text-gray-600 mt-1">
                            Harmful events: {report.greenscore.counts.harmful_events} • Beneficial events:{" "}
                            {report.greenscore.counts.beneficial_events} • Used in score:{" "}
                            {report.greenscore.counts.trusted_events_used_for_score}
                          </p>
                        )}
                        <div className="text-sm text-gray-700 leading-relaxed space-y-1 mt-2">
                          <p>
                            <strong>Total events returned:</strong> {report.eco_audit.total_events}
                          </p>
                          <p>
                            <strong>Serious issues flagged:</strong> {report.eco_audit.high_risk_flag_count}
                          </p>
                          <p>
                            <strong>Overall concern level:</strong> {report.eco_audit.concern_level}
                          </p>
                          <p className="mt-2">{report.eco_audit.summary}</p>
                        </div>
                      </section>

                      {/* 4. Events & sources (RENAMED + FILTERS + TRUST BADGES) */}
                      <section className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                          <div>
                            <h3 className="text-base font-semibold text-gray-900">4. Events we found (with sources)</h3>
                            <p className="text-xs text-gray-500 mt-1">
                              Each row is one extracted ESG event. “Used in score” means it passed the trust gate (Option A).
                            </p>
                          </div>

                          {/* Filters */}
                          <div className="flex flex-wrap gap-2">
                            {[
                              ["all", "All events"],
                              ["trusted", "Used in score"],
                              ["harmful", "Harmful"],
                              ["beneficial", "Beneficial"],
                            ].map(([k, label]) => (
                              <button
                                key={k}
                                onClick={() => setEventFilter(k as any)}
                                className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                                  eventFilter === k
                                    ? "bg-emerald-600 text-white border-emerald-600"
                                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {Array.isArray(filteredFindings) && filteredFindings.length > 0 ? (
                          <div className="overflow-x-auto bg-white border border-gray-200 rounded-2xl">
                            <table className="min-w-full text-xs sm:text-sm">
                              <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                  <th scope="col" className="px-3 py-2 text-left font-medium">
                                    Event & source
                                  </th>
                                  <th scope="col" className="px-3 py-2 text-left font-medium">
                                    Event score
                                    <span className="block text-[10px] text-gray-400">0–100 (higher = better)</span>
                                  </th>
                                  <th scope="col" className="px-3 py-2 text-left font-medium">
                                    Impact
                                    <span className="block text-[10px] text-gray-400">+1 harmful · −1 beneficial</span>
                                  </th>
                                  <th scope="col" className="px-3 py-2 text-left font-medium">
                                    Severity
                                  </th>
                                  <th scope="col" className="px-3 py-2 text-left font-medium">
                                    Confidence
                                  </th>
                                  <th scope="col" className="px-3 py-2 text-left font-medium">
                                    Contribution
                                  </th>
                                  <th scope="col" className="px-3 py-2 text-left font-medium">
                                    Cred.
                                  </th>
                                  <th scope="col" className="px-3 py-2 text-left font-medium">
                                    Recency
                                  </th>
                                  <th scope="col" className="px-3 py-2 text-left font-medium">
                                    Scope
                                  </th>
                                  <th scope="col" className="px-3 py-2 text-left font-medium">
                                    Dates
                                  </th>
                                </tr>
                              </thead>

                              <tbody className="divide-y">
                                {filteredFindings.map((f, i) => {
                                  const es100 = clamp100(f.event_score_0_100);
                                  const risk = Number(f.event_risk_score ?? 0);
                                  const contrPct = Number.isFinite(f.contribution as any) ? pct01(f.contribution) : 0;
                                  const pub = fmtISODateShort(f.article_date);
                                  const audit = f.date ? new Date(f.date).toLocaleDateString() : "";

                                  return (
                                    <Fragment key={i}>
                                      <tr className="hover:bg-gray-50">
                                        {/* Event & source cell (UPDATED) */}
                                        <td className="px-3 py-2 align-top">
                                          <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              {f.trusted_for_score ? (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                  Used in score
                                                </span>
                                              ) : (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                                  Not used
                                                </span>
                                              )}
                                              {f.source_domain && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">
                                                  {f.source_domain}
                                                </span>
                                              )}
                                              {typeof f.domain_credibility_score === "number" && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">
                                                  domain cred: {f.domain_credibility_score.toFixed(2)}
                                                </span>
                                              )}
                                            </div>

                                            <button
                                              type="button"
                                              className="text-left text-gray-900 font-medium hover:underline"
                                              onClick={() => setOpenRow((o) => ({ ...o, [i]: !o[i] }))}
                                              title="Show details"
                                            >
                                              {f.summary || f.title || f.source_url}
                                            </button>

                                            <a
                                              href={f.source_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-blue-600 hover:underline text-xs"
                                            >
                                              {f.title || "Open source article"}
                                            </a>
                                          </div>
                                        </td>

                                        <td className="px-3 py-2 font-mono align-top">{es100}</td>
                                        <td className="px-3 py-2 font-mono align-top">{risk.toFixed(3)}</td>
                                        <td className="px-3 py-2 font-mono align-top">{Number(f.severity ?? 0).toFixed(2)}</td>
                                        <td className="px-3 py-2 font-mono align-top">{Number(f.confidence ?? 0).toFixed(2)}</td>

                                        <td className="px-3 py-2 align-top">
                                          <div className="flex items-center gap-2">
                                            <span className="font-mono text-[11px]">{contrPct}%</span>
                                            <div className="h-2 w-20 bg-gray-200 rounded">
                                              <div className="h-2 rounded" style={{ width: `${contrPct}%`, backgroundColor: "#10b981" }} />
                                            </div>
                                          </div>
                                        </td>

                                        <td className="px-3 py-2 font-mono align-top">{Number(f.credibility ?? 0).toFixed(2)}</td>
                                        <td className="px-3 py-2 font-mono align-top">{Number(f.recency ?? 0).toFixed(2)}</td>
                                        <td className="px-3 py-2 font-mono align-top">{Number(f.scope ?? 0).toFixed(2)}</td>

                                        <td className="px-3 py-2 text-[11px] text-gray-600 align-top whitespace-nowrap">
                                          {pub ? (
                                            <>
                                              <div>
                                                <span className="text-gray-400">Published:</span> {pub}
                                              </div>
                                            </>
                                          ) : (
                                            <div className="text-gray-400">Published: —</div>
                                          )}
                                          <div>
                                            <span className="text-gray-400">Audited:</span> {audit || "—"}
                                          </div>
                                        </td>
                                      </tr>

                                      {/* expanded detail */}
                                      {openRow[i] && (
                                        <tr className="bg-gray-50/60">
                                          <td className="px-3 py-3 text-sm text-gray-700" colSpan={10}>
                                            <div className="space-y-2">
                                              {f.summary && <p>{f.summary}</p>}

                                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-gray-600">
                                                <div className="rounded-md bg-white border border-gray-200 p-2">
                                                  <p className="text-gray-500">Trust gate</p>
                                                  <p className="font-mono">
                                                    used={String(!!f.trusted_for_score)} • allowlisted={String(!!f.domain_is_trusted)} • dom_cred=
                                                    {typeof f.domain_credibility_score === "number" ? f.domain_credibility_score.toFixed(2) : "—"} • model_cred=
                                                    {Number(f.credibility ?? 0).toFixed(2)}
                                                  </p>
                                                </div>
                                                <div className="rounded-md bg-white border border-gray-200 p-2">
                                                  <p className="text-gray-500">Event scoring</p>
                                                  <p className="font-mono">
                                                    score100={clamp100(f.event_score_0_100)} • impact={Number(f.event_risk_score ?? 0).toFixed(3)} • contrib=
                                                    {Number.isFinite(f.contribution as any) ? (f.contribution as number).toFixed(3) : "—"}
                                                  </p>
                                                </div>
                                                <div className="rounded-md bg-white border border-gray-200 p-2">
                                                  <p className="text-gray-500">6 factors</p>
                                                  <p className="font-mono">
                                                    sev={Number(f.severity ?? 0).toFixed(2)} • cred={Number(f.credibility ?? 0).toFixed(2)} • rec=
                                                    {Number(f.recency ?? 0).toFixed(2)} • scope={Number(f.scope ?? 0).toFixed(2)} • conf=
                                                    {Number(f.confidence ?? 0).toFixed(2)}
                                                  </p>
                                                </div>
                                              </div>

                                              <a className="text-blue-600 hover:underline break-all" href={f.source_url} target="_blank" rel="noopener noreferrer">
                                                {f.source_url}
                                              </a>
                                            </div>
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
                          <p className="text-sm text-gray-600">No events match this filter.</p>
                        )}

                        <p className="text-xs text-gray-500 mt-2">
                          Notes: Event score is 0–100 (higher = less environmental risk). “Impact” is −1..+1 where <strong>+1 is harmful</strong> and{" "}
                          <strong>−1 is beneficial</strong>. Contribution shows how much that event explains the overall magnitude in the returned list.
                        </p>
                      </section>
                    </>
                  )}

                  {error && !loading && (
                    <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded-2xl text-sm" role="alert">
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
