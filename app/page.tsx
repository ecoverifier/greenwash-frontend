"use client";

import { useEffect, useRef, useState } from "react";
import { Analytics } from "@vercel/analytics/next";
import { onAuthStateChanged, type User } from "firebase/auth";
import { addDoc, collection, getDocs, query, where } from "firebase/firestore";
import Layout from "./components/Layout";
import ReportsSidebar from "./components/ReportsSidebar";
import { auth, db } from "./firebase";
import type { ReportType } from "./types/audit";
import { generateAudit } from "./utils/openrouter";

type SavedReport = { id: string; company: string; report: ReportType; createdAt?: string };
function localReports(): SavedReport[] {
  try { const data = JSON.parse(localStorage.getItem("anon_reports") || "[]"); return Array.isArray(data) ? data.filter((r) => r?.report?.eco_audit?.findings) : []; }
  catch { return []; }
}

export default function Home() {
  const [company, setCompany] = useState("");
  const [report, setReport] = useState<ReportType | null>(null);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const busy = useRef(false);
  const resultRef = useRef<HTMLElement>(null);

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setUser(u);
    if (!u) { setReports(localReports()); return; }
    try {
      const snapshot = await getDocs(query(collection(db, "reports"), where("uid", "==", u.uid)));
      setReports(snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as SavedReport)).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")));
    } catch { setNotice("Your saved reports couldn’t load. You can still check a company."); }
  }), []);
  useEffect(() => {
    if (!loading) return;
    const start = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [loading]);
  useEffect(() => { if (report || loading || error) resultRef.current?.focus(); }, [report, loading, error]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current || !company.trim()) return;
    busy.current = true;
    const name = company.trim();
    setLoading(true); setElapsed(0); setReport(null); setActiveId(null); setError(""); setNotice("");
    try {
      const result = await generateAudit(name);
      const entry: SavedReport = { id: crypto.randomUUID(), company: name, report: result, createdAt: new Date().toISOString() };
      setReport(result);
      try {
        if (user) {
          const saved = await addDoc(collection(db, "reports"), { ...entry, uid: user.uid });
          entry.id = saved.id;
        } else { localStorage.setItem("anon_reports", JSON.stringify([entry, ...localReports()])); }
        setReports((previous) => [entry, ...previous]); setActiveId(entry.id);
      } catch { setNotice("Report ready. History couldn’t be saved on this device."); }
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong. Please try again."); }
    finally { busy.current = false; setLoading(false); }
  }
  const findings = report?.eco_audit.findings || [];
  const scored = report?.greenscore.scoring_version === 2 && report.greenscore.evidence_sufficient === true;
  const score = report?.greenscore.score || 0;
  const sidebar = <ReportsSidebar reports={reports} activeReportId={activeId} sessionStarted={!!report || !!error} user={user}
    onNewChat={() => { if (busy.current) return; setReport(null); setCompany(""); setError(""); setNotice(""); setActiveId(null); }}
    onSelectReport={(entry) => { if (busy.current) return; setReport(entry.report); setCompany(entry.company); setActiveId(entry.id); setError(""); setNotice(""); }}
    onDeleteReport={(id) => { const updated = reports.filter((r) => r.id !== id); setReports(updated); if (!user) { try { localStorage.setItem("anon_reports", JSON.stringify(updated)); } catch { setNotice("History couldn’t be updated."); } } if (activeId === id) { setReport(null); setActiveId(null); } }} />;

  return <Layout showSidebar sidebarContent={sidebar}>
    <Analytics />
    <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16 text-slate-900">
      <header className="mb-8">
        <p className="text-sm font-semibold text-emerald-700 mb-3">A clearer look at company claims</p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">How does a company treat the planet?</h1>
        <p className="mt-4 text-slate-600 leading-relaxed">Look up its environmental record, with sources you can read for yourself.</p>
      </header>
      <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label htmlFor="company" className="block text-sm font-semibold mb-2">Company name</label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input id="company" value={company} onChange={(event) => setCompany(event.target.value)} disabled={loading} maxLength={200} required placeholder="e.g. Apple" autoComplete="organization" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-50" />
          <button disabled={loading || !company.trim()} className="rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">{loading ? "Checking…" : "Check company"}</button>
        </div>
        <p className="mt-3 text-xs text-slate-500">No account needed. Research can take up to two minutes.</p>
      </form>
      <section ref={resultRef} tabIndex={-1} aria-label="Company research" aria-busy={loading} className="mt-6 outline-none">
        {loading && <div role="status" aria-live="polite" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8">
          <div className="flex items-center gap-4"><span aria-hidden="true" className="h-7 w-7 shrink-0 rounded-full border-[3px] border-emerald-200 border-t-emerald-700 motion-safe:animate-spin" /><h2 className="text-xl font-semibold">Checking {company.trim()}</h2></div>
          <p className="mt-4 text-slate-700">Searching environmental reporting and building a source-backed summary.</p>
          <p className="mt-3 text-sm text-emerald-800">{elapsed >= 60 ? "Still working. Broader research can take a little longer." : "Your report will appear here as soon as it’s ready."}</p>
          <p className="mt-4 text-xs text-slate-500" aria-hidden="true">{elapsed}s elapsed · Usually ready within two minutes</p>
        </div>}
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900"><h2 className="font-semibold">We couldn’t finish this check</h2><p className="mt-2 text-sm">{error}</p><button onClick={() => { document.getElementById("company")?.focus(); }} className="mt-3 text-sm underline">Review the name and try again</button></div>}
        {report && <div className="space-y-5">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div><h2 className="text-2xl font-semibold">{report.company}</h2><p className="mt-2 text-sm text-slate-500">{findings.length} findings · {report.greenscore.source_count ?? new Set(findings.map((f) => f.source_domain)).size} source websites</p></div>
              {scored && <div className="text-right"><p className="text-3xl font-semibold">{score}<span className="text-base font-normal text-slate-400"> / 100</span></p><p className="text-xs text-slate-500 mt-1">GreenScore · Higher is better</p></div>}
            </div>
            <p className="mt-5 font-semibold text-emerald-800">{scored ? (score >= 80 ? "Mostly positive evidence" : score < 50 ? "Evidence of environmental concerns" : "A mixed environmental record") : "More evidence needed for a score"}</p>
            {!scored && <p className="mt-2 text-sm text-slate-600">{report.greenscore.scoring_version === 2 ? "A score needs relevant evidence from at least three different source websites. You can still read what we found below." : "This saved report uses an older scoring method. Check the company again for an updated assessment."}</p>}
            <p className="mt-4 leading-relaxed text-slate-700">{report.eco_audit.summary}</p>
            {!!report.greenscore.excluded_findings && <p className="mt-3 text-sm text-slate-500">Some incomplete findings were excluded. The assessment uses only the findings below.</p>}
          </article>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-lg font-semibold">What we found</h2>
            <div className="mt-2 divide-y divide-slate-100">{findings.map((finding, index) => <details key={`${finding.source_url}-${index}`} className="py-4">
              <summary className="cursor-pointer font-medium leading-relaxed">{finding.title}<span className={`ml-2 text-xs font-normal ${finding.event_risk_score > 0 ? "text-red-700" : finding.event_risk_score < 0 ? "text-emerald-700" : "text-slate-500"}`}>{finding.event_risk_score > 0 ? "Concern" : finding.event_risk_score < 0 ? "Progress" : "Mixed"}</span></summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{finding.summary}</p>
              <a href={finding.source_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-emerald-700 underline break-all">Read source{finding.source_domain ? ` · ${finding.source_domain}` : ""} ↗</a>
              {finding.article_date && <p className="mt-2 text-xs text-slate-500">Published {finding.article_date}</p>}
            </details>)}</div>
          </section>
          <details className="px-1 text-sm text-slate-600"><summary className="cursor-pointer font-medium">About this assessment</summary><div className="mt-3 space-y-3 leading-relaxed"><p>AI researches environmental events using web search. Links and claims are not independently verified. This is a starting point for research, not a certified sustainability rating.</p><p>For updated reports, each source website has equal weight, shared between its findings. Event impact combines severity, credibility, recency, scope and confidence. The score starts at 50; harmful evidence lowers it and beneficial evidence raises it. Mixed findings have no directional impact.</p><p>We withhold the score unless at least three source websites provide directional evidence. Different websites can share ownership or repeat the same reporting, so source count does not guarantee independent corroboration.</p></div></details>
        </div>}
        {notice && <p role="status" className="mt-4 text-sm text-slate-600">{notice}</p>}
      </section>
    </div>
  </Layout>;
}
