"use client";

import { useState, useEffect, Fragment } from "react";
import axios from "axios";
import { Analytics } from "@vercel/analytics/next";
import { HiArrowUpCircle } from "react-icons/hi2";
import { FaArrowDown, FaChevronDown, FaChevronUp } from "react-icons/fa";
import Layout from "./components/Layout";
import ReportsSidebar from "./components/ReportsSidebar";

import { auth, provider, db, signInWithPopup, signOut } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";

/** ---------------------------
 * Types
 * -------------------------- */
type ESGFinding = {
  date: string;
  article_date?: string | null;
  title: string;
  summary: string;
  source_url: string;
  source_domain?: string;

  trusted_for_score?: boolean;
  domain_is_trusted?: boolean;
  domain_credibility_score?: number;
  domain_category?: string;

  severity: number;
  credibility: number;
  recency: number;
  scope: number;
  confidence: number;

  event_risk_score: number;
  event_score_0_100: number;
  contribution?: number;
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
    score: number;
    risk_score?: number;
    risk_level?: string;
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
    base_score?: number;
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
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getVerdict(gs: number) {
  if (gs >= 80) {
    return {
      label: "Low environmental risk",
      shortLabel: "Low risk",
      badgeClass: "bg-emerald-50 text-emerald-900 border-emerald-200",
      dotClass: "bg-emerald-500",
      progressClass: "bg-emerald-500",
    };
  }

  if (gs < 50) {
    return {
      label: "High environmental risk",
      shortLabel: "High risk",
      badgeClass: "bg-red-50 text-red-900 border-red-200",
      dotClass: "bg-red-500",
      progressClass: "bg-red-500",
    };
  }

  return {
    label: "Mixed environmental record",
    shortLabel: "Medium risk",
    badgeClass: "bg-amber-50 text-amber-900 border-amber-200",
    dotClass: "bg-amber-500",
    progressClass: "bg-amber-500",
  };
}

function getImpactPill(risk: number) {
  if (risk > 0.15) {
    return {
      label: "Harmful",
      className: "bg-red-50 text-red-800 border-red-200",
    };
  }

  if (risk < -0.15) {
    return {
      label: "Beneficial",
      className: "bg-emerald-50 text-emerald-800 border-emerald-200",
    };
  }

  return {
    label: "Mixed / minor",
    className: "bg-slate-50 text-slate-700 border-slate-200",
  };
}

function getTopReasons(report: ReportType | null) {
  if (!report) return [] as string[];

  const factors =
    report.greenscore?.factors && report.greenscore.factors.length > 0
      ? report.greenscore.factors
      : report.greenscore?.rationale
      ? [report.greenscore.rationale]
      : [];

  const reasons = [...factors];

  if (report.greenscore?.why) {
    reasons.unshift(report.greenscore.why);
  }

  return reasons.filter(Boolean).slice(0, 3);
}

export default function Home() {
  const [verifying, setVerifying] = useState(false);
  const [openRow, setOpenRow] = useState<Record<number, boolean>>({});
  const [showMethodology, setShowMethodology] = useState(false);
  const [showFullEvents, setShowFullEvents] = useState(false);

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

  const [eventFilter, setEventFilter] = useState<"all" | "trusted" | "harmful" | "beneficial">("all");

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

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("anon_reports");
      if (stored) setReports(JSON.parse(stored));
    }
  }, []);

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
    } catch {
      setError("Logout failed. Please try again.");
    }
  };

  const login = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch {
      setError("Login failed. Please try again.");
    }
  };

  const submit = async (e?: any) => {
    if (e) e.preventDefault();
    if (!company.trim() || loading) return;

    setError("");
    setIsRetryableError(false);
    setLoading(true);
    setVerifying(true);
    setReport(null);
    setSessionStarted(true);
    setEventFilter("all");
    setOpenRow({});
    setShowMethodology(false);
    setShowFullEvents(false);

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
      setVerifying(false);
    }
  };

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
    setShowMethodology(false);
    setShowFullEvents(false);
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
    setShowMethodology(false);
    setShowFullEvents(false);
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

  const allFindings = report?.eco_audit?.findings ?? [];
  const filteredFindings = allFindings.filter((f) => {
    const r = Number(f.event_risk_score ?? 0);
    if (eventFilter === "trusted") return !!f.trusted_for_score;
    if (eventFilter === "harmful") return r > 0;
    if (eventFilter === "beneficial") return r < 0;
    return true;
  });

  const findingsToRender = showFullEvents ? filteredFindings : filteredFindings.slice(0, 5);

  const countsForFilter = {
    all: allFindings.length,
    trusted: allFindings.filter((f) => !!f.trusted_for_score).length,
    harmful: allFindings.filter((f) => Number(f.event_risk_score ?? 0) > 0).length,
    beneficial: allFindings.filter((f) => Number(f.event_risk_score ?? 0) < 0).length,
  };

  const gs = Math.max(0, Math.min(100, report?.greenscore?.score ?? 0));
  const verdict = getVerdict(gs);
  const topReasons = getTopReasons(report);
  const trustedUsed = report?.greenscore?.counts?.trusted_events_used_for_score ?? 0;

  return (
    <Layout showSidebar={true} sidebarContent={sidebarContent} title="EcoVerifier">
      <Analytics />

      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-50 via-white to-slate-50" />
        <div className="absolute -top-24 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute top-40 right-[-120px] h-[340px] w-[340px] rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute bottom-[-160px] left-[-140px] h-[420px] w-[420px] rounded-full bg-lime-200/30 blur-3xl" />
      </div>

      <div className="flex-1 px-4 sm:px-8 py-6 min-h-screen">
        {!sessionStarted ? (
          <div className="w-full max-w-3xl mx-auto text-center pt-10 sm:pt-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/70 px-4 py-1.5 text-xs text-emerald-900 shadow-sm backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              EcoVerifier • Automated ESG event audit
            </div>

            <h1 className="mt-6 text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900">
              Find out how sustainable companies <span className="text-emerald-700">really</span> are.
            </h1>

            <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
              We analyze ESG events from trusted sources and turn them into one clear environmental verdict.
            </p>

            <div className="mt-10 rounded-3xl border border-slate-200 bg-white/80 shadow-xl shadow-emerald-100/40 backdrop-blur p-4 sm:p-6 text-left">
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm font-semibold text-slate-900">Company name</label>
                <span className="text-xs text-slate-500">Press Enter to run</span>
              </div>

              <div className="mt-3 relative">
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (!loading) submit(e);
                    }
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base text-slate-900 shadow-sm outline-none focus:ring-4 focus:ring-emerald-200 focus:border-emerald-400 transition"
                  placeholder={animatedPlaceholder || "Enter a company name"}
                />

                <button
                  type="button"
                  onClick={() => !loading && submit()}
                  disabled={loading}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition ${
                    loading ? "bg-slate-200 text-slate-500" : "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98]"
                  }`}
                  aria-label="Submit"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Analyzing…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <HiArrowUpCircle className="h-5 w-5" />
                      Run audit
                    </span>
                  )}
                </button>
              </div>

              <div className="mt-4">
                {verifying && <p className="text-sm text-slate-500 animate-pulse">Analyzing company…</p>}

                {error && (
                  <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm text-red-800 font-semibold">We couldn’t finish this audit.</p>
                    <p className="mt-1 text-sm text-red-700">{error}</p>
                    {isRetryableError && (
                      <button
                        onClick={() => {
                          setError("");
                          setIsRetryableError(false);
                          if (company.trim()) submit();
                        }}
                        className="mt-3 inline-flex items-center rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-red-700 border border-red-200 hover:bg-red-100 transition"
                      >
                        Try again
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {[
                  ["Simple verdict", "Get one score plus the main reasons behind it."],
                  ["Trusted sources", "We prioritize credible reporting when scoring."],
                  ["Open methodology", "See the full logic only if you want it."],
                ].map(([t, d]) => (
                  <div key={t} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="font-semibold text-slate-900">{t}</p>
                    <p className="mt-1 text-slate-600">{d}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-full flex justify-center py-10">
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

            <section id="about" className="scroll px-2 sm:px-0 mb-20">
              <div className="max-w-3xl mx-auto space-y-8">
                <h2 className="text-3xl font-bold text-emerald-700 text-center">An Initiative of the Literally Finance Project</h2>
                <p className="text-slate-700 text-base leading-relaxed text-center">
                  EcoVerifier analyzes companies’ environmental behavior using real-world ESG events, trusted sources, and AI to generate a custom GreenScore.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm text-slate-700">
                  <div className="rounded-3xl border border-slate-200 bg-white/70 backdrop-blur p-5">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Who It’s For</h3>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Students exploring sustainability in economics or policy</li>
                      <li>ESG-conscious investors screening companies</li>
                      <li>Researchers comparing ESG scores with real outcomes</li>
                    </ul>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white/70 backdrop-blur p-5">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Tech Stack</h3>
                    <ul className="list-disc list-inside space-y-1">
                      <li>React + Next.js</li>
                      <li>Tailwind CSS</li>
                      <li>Firebase (Auth & Firestore)</li>
                      <li>OpenRouter + Brave Search API</li>
                    </ul>
                  </div>
                </div>

                <blockquote className="italic text-sm text-slate-600 border-l-4 border-emerald-400 pl-4 mt-4">
                  “55% of global customers are skeptical of the sustainability claims of most brands.” — YouGov, 2023
                </blockquote>
              </div>
            </section>
          </div>
        ) : (
          <div className="min-h-[560px]">
            <div className="max-w-5xl mx-auto px-0 sm:px-2 py-6 sm:py-10">
              <div className="rounded-[28px] border border-slate-200 bg-white/75 shadow-xl shadow-emerald-100/30 backdrop-blur">
                <div className="px-5 py-6 sm:px-8 sm:py-8 space-y-8 text-slate-900 font-sans">
                  <header className="space-y-4 border-b border-slate-200 pb-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900 border border-emerald-100">
                          <span className="text-[11px]">EcoVerifier</span>
                          <span className="h-1 w-1 rounded-full bg-emerald-500" />
                          <span>Automated ESG risk check</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Environmental Risk Report</h1>
                        <p className="text-sm text-slate-600 max-w-2xl">
                          One verdict first. Full evidence and scoring details below.
                        </p>
                      </div>
                    </div>
                  </header>

                  <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 sm:p-7 shadow-lg shadow-emerald-100/20">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                      <div className="space-y-4 flex-1">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Company</p>
                          <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight">{report?.company || company}</h2>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${verdict.badgeClass}`}>
                            <span className={`h-2.5 w-2.5 rounded-full ${verdict.dotClass}`} />
                            {verdict.label}
                          </span>
                          <span className="text-sm text-slate-600">
                            Based on {report?.eco_audit?.total_events ?? 0} events
                            {trustedUsed > 0 ? ` • ${trustedUsed} used in score` : ""}
                          </span>
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-slate-900">Why this score</p>
                          {topReasons.length > 0 ? (
                            <ul className="mt-2 space-y-2 text-sm text-slate-700">
                              {topReasons.map((reason, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                                  <span>{reason}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-2 text-sm text-slate-600">No explanation was returned for this audit.</p>
                          )}
                        </div>
                      </div>

                      <div className="w-full lg:w-[280px] rounded-3xl border border-slate-200 bg-slate-50 p-5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">GreenScore</p>
                        <div className="mt-2 flex items-end gap-2">
                          <span className="text-5xl font-extrabold tracking-tight">{gs}</span>
                          <span className="pb-1 text-slate-500">/ 100</span>
                        </div>
                        <div className="mt-4 h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
                          <div className={`h-2.5 rounded-full ${verdict.progressClass}`} style={{ width: `${gs}%` }} />
                        </div>
                        <p className="mt-3 text-sm text-slate-600">Higher score = lower environmental risk.</p>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-2xl border border-slate-200 bg-white p-3">
                            <p className="text-xs text-slate-500">Flagged</p>
                            <p className="text-lg font-semibold">{report?.eco_audit?.high_risk_flag_count ?? 0}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white p-3">
                            <p className="text-xs text-slate-500">Concern</p>
                            <p className="text-lg font-semibold">{report?.eco_audit?.concern_level ?? "—"}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {loading && !report && (
                    <section className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
                        <p className="text-sm text-slate-600 italic">
                          Auditing this company using environmental news and our risk model…
                        </p>
                      </div>
                    </section>
                  )}

                  {report && !error && (
                    <>
                      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="rounded-3xl border border-slate-200 bg-white/80 p-5">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What we found</p>
                          <p className="mt-2 text-sm text-slate-700 leading-relaxed">{report.eco_audit.summary}</p>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-white/80 p-5">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Event mix</p>
                          <div className="mt-3 space-y-2 text-sm text-slate-700">
                            <div className="flex items-center justify-between">
                              <span>Harmful</span>
                              <span className="font-semibold">{report.greenscore?.counts?.harmful_events ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Beneficial</span>
                              <span className="font-semibold">{report.greenscore?.counts?.beneficial_events ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Used in score</span>
                              <span className="font-semibold">{trustedUsed}</span>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-white/80 p-5">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">How to read this</p>
                          <ul className="mt-3 space-y-2 text-sm text-slate-700">
                            <li>Higher GreenScore = lower risk.</li>
                            <li>Harmful events push score down.</li>
                            <li>Beneficial events push score up.</li>
                            <li>Open any event for full details.</li>
                          </ul>
                        </div>
                      </section>

                      <section className="rounded-3xl border border-slate-200 bg-white/80 p-5 sm:p-6 shadow-lg shadow-emerald-100/20">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900">Key events</h3>
                            <p className="text-sm text-slate-600 mt-1">
                              Start with the biggest signals. Expand a row to see scoring details.
                            </p>
                          </div>

                          <div className="inline-flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">
                            {[
                              ["all", "All"],
                              ["trusted", "Used in score"],
                              ["harmful", "Harmful"],
                              ["beneficial", "Beneficial"],
                            ].map(([k, label]) => {
                              const isActive = eventFilter === (k as any);
                              const count = (countsForFilter as any)[k] ?? 0;
                              return (
                                <button
                                  key={k}
                                  onClick={() => {
                                    setEventFilter(k as any);
                                    setShowFullEvents(false);
                                  }}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                                    isActive
                                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                  }`}
                                >
                                  {label} <span className={`${isActive ? "text-white/80" : "text-slate-500"}`}>({count})</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {Array.isArray(findingsToRender) && findingsToRender.length > 0 ? (
                          <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white">
                            <table className="min-w-full text-sm">
                              <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                  <th className="px-4 py-3 text-left font-semibold">Event</th>
                                  <th className="px-4 py-3 text-left font-semibold">Impact</th>
                                  <th className="px-4 py-3 text-left font-semibold">Contribution</th>
                                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {findingsToRender.map((f, i) => {
                                  const risk = Number(f.event_risk_score ?? 0);
                                  const contrPct = Number.isFinite(f.contribution as any) ? pct01(f.contribution) : 0;
                                  const pub = fmtISODateShort(f.article_date);
                                  const impact = getImpactPill(risk);
                                  const rowKey = i;

                                  return (
                                    <Fragment key={`${f.source_url}-${i}`}>
                                      <tr className="hover:bg-slate-50/70 align-top">
                                        <td className="px-4 py-4">
                                          <div className="space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                              {f.trusted_for_score && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 font-semibold">
                                                  Used in score
                                                </span>
                                              )}
                                              {f.source_domain && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                                                  {f.source_domain}
                                                </span>
                                              )}
                                            </div>

                                            <button
                                              type="button"
                                              className="text-left font-semibold text-slate-900 hover:underline"
                                              onClick={() => setOpenRow((o) => ({ ...o, [rowKey]: !o[rowKey] }))}
                                            >
                                              {f.summary || f.title || f.source_url}
                                            </button>

                                            <a
                                              href={f.source_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center text-xs font-semibold text-blue-600 hover:underline"
                                            >
                                              {f.title || "Open source article"}
                                            </a>
                                          </div>
                                        </td>

                                        <td className="px-4 py-4">
                                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${impact.className}`}>
                                            {impact.label}
                                          </span>
                                        </td>

                                        <td className="px-4 py-4">
                                          <div className="flex items-center gap-3 min-w-[140px]">
                                            <span className="text-xs font-mono text-slate-700 w-10">{contrPct}%</span>
                                            <div className="h-2 w-24 bg-slate-200 rounded-full overflow-hidden">
                                              <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${contrPct}%` }} />
                                            </div>
                                          </div>
                                        </td>

                                        <td className="px-4 py-4 text-xs text-slate-600 whitespace-nowrap">{pub || "—"}</td>
                                      </tr>

                                      {openRow[rowKey] && (
                                        <tr className="bg-slate-50/70">
                                          <td className="px-4 py-4" colSpan={4}>
                                            <div className="space-y-4 text-sm text-slate-700">
                                              {f.summary && <p>{f.summary}</p>}

                                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                                                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                                                  <p className="text-slate-500 font-semibold">Event score</p>
                                                  <p className="mt-1 font-mono text-slate-900">{clamp100(f.event_score_0_100)} / 100</p>
                                                </div>

                                                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                                                  <p className="text-slate-500 font-semibold">Impact</p>
                                                  <p className="mt-1 font-mono text-slate-900">{Number(f.event_risk_score ?? 0).toFixed(3)}</p>
                                                </div>

                                                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                                                  <p className="text-slate-500 font-semibold">Severity / confidence</p>
                                                  <p className="mt-1 font-mono text-slate-900">
                                                    sev={Number(f.severity ?? 0).toFixed(2)} • conf={Number(f.confidence ?? 0).toFixed(2)}
                                                  </p>
                                                </div>

                                                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                                                  <p className="text-slate-500 font-semibold">Credibility / recency / scope</p>
                                                  <p className="mt-1 font-mono text-slate-900">
                                                    {Number(f.credibility ?? 0).toFixed(2)} • {Number(f.recency ?? 0).toFixed(2)} • {Number(f.scope ?? 0).toFixed(2)}
                                                  </p>
                                                </div>
                                              </div>

                                              <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                                                <p className="font-semibold text-slate-900">Trust gate</p>
                                                <p className="mt-1 font-mono">
                                                  used={String(!!f.trusted_for_score)} • allowlisted={String(!!f.domain_is_trusted)} • dom_cred=
                                                  {typeof f.domain_credibility_score === "number" ? f.domain_credibility_score.toFixed(2) : "—"} • model_cred=
                                                  {Number(f.credibility ?? 0).toFixed(2)}
                                                </p>
                                              </div>

                                              <a
                                                className="text-blue-600 hover:underline break-all font-semibold"
                                                href={f.source_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                              >
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
                          <p className="mt-4 text-sm text-slate-600">No events match this filter.</p>
                        )}

                        {filteredFindings.length > 5 && (
                          <div className="mt-4">
                            <button
                              type="button"
                              onClick={() => setShowFullEvents((v) => !v)}
                              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              {showFullEvents ? (
                                <>
                                  Show fewer events <FaChevronUp className="h-3 w-3" />
                                </>
                              ) : (
                                <>
                                  Show all {filteredFindings.length} events <FaChevronDown className="h-3 w-3" />
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </section>

                      <section className="rounded-3xl border border-slate-200 bg-white/80 p-5 sm:p-6 shadow-lg shadow-emerald-100/10">
                        <button
                          type="button"
                          onClick={() => setShowMethodology((v) => !v)}
                          className="w-full flex items-center justify-between gap-3 text-left"
                        >
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900">How GreenScore is calculated</h3>
                            <p className="mt-1 text-sm text-slate-600">
                              Open this if you want the trust rules, thresholds, and scoring logic.
                            </p>
                          </div>
                          {showMethodology ? <FaChevronUp className="h-4 w-4 text-slate-500" /> : <FaChevronDown className="h-4 w-4 text-slate-500" />}
                        </button>

                        {showMethodology && (
                          <div className="mt-5 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-700">
                              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                <p className="text-slate-500">Events returned</p>
                                <p className="text-base font-semibold">{report.greenscore?.counts?.total_events ?? report.eco_audit.total_events}</p>
                              </div>
                              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                <p className="text-slate-500">Used in score</p>
                                <p className="text-base font-semibold">{trustedUsed}</p>
                              </div>
                              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                <p className="text-slate-500">Scoring rule</p>
                                <p className="text-[11px] leading-snug">
                                  We score trusted events first. If too few trusted events exist, we fall back to all events.
                                </p>
                              </div>
                            </div>

                            {report.greenscore?.trusted_thresholds && (
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 space-y-2">
                                <p>
                                  <span className="font-semibold">Trusted event rule:</span> allowlisted OR domain credibility ≥{" "}
                                  <span className="font-mono">{report.greenscore.trusted_thresholds.min_domain_cred}</span> AND model credibility ≥{" "}
                                  <span className="font-mono">{report.greenscore.trusted_thresholds.min_model_cred}</span>.
                                </p>
                                <p>
                                  <span className="font-semibold">Fallback:</span> if trusted events &lt;{" "}
                                  <span className="font-mono">{report.greenscore.trusted_thresholds.min_trusted_events_for_score}</span>, use all events.
                                </p>
                                <p>
                                  <span className="font-semibold">Sign convention:</span> impact is −1..+1 where <span className="font-semibold">+1 = harmful</span> and{" "}
                                  <span className="font-semibold">−1 = beneficial</span>.
                                </p>
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                              <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                                <div>
                                  <p className="font-semibold text-emerald-900">80–100</p>
                                  <p className="text-[11px] text-emerald-900/80">Low risk</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2">
                                <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                                <div>
                                  <p className="font-semibold text-amber-900">50–79</p>
                                  <p className="text-[11px] text-amber-900/80">Medium risk</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-3 py-2">
                                <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                                <div>
                                  <p className="font-semibold text-red-900">0–49</p>
                                  <p className="text-[11px] text-red-900/80">High risk</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </section>
                    </>
                  )}

                  {error && !loading && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-3xl text-sm" role="alert">
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
