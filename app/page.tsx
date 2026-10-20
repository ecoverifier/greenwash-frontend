"use client";

import { useEffect, useRef, useState } from "react";
import AuditResult from "./components/AuditResult";
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
      setActiveId(entry.id);
      // History writes must never keep a completed report in its loading state.
      void (async () => {
        try {
          if (user) {
            const saved = await addDoc(collection(db, "reports"), { ...entry, uid: user.uid });
            setActiveId((current) => current === entry.id ? saved.id : current);
            setReports((previous) => [{ ...entry, id: saved.id }, ...previous]);
          } else {
            localStorage.setItem("anon_reports", JSON.stringify([entry, ...localReports()]));
            setReports((previous) => [entry, ...previous]);
          }
        } catch { setNotice("Report ready. History couldn’t be saved on this device."); }
      })();
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong. Please try again."); }
    finally { busy.current = false; setLoading(false); }
  }

  const sidebar = <ReportsSidebar disabled={loading} reports={reports} activeReportId={activeId} sessionStarted={!!report || !!error} user={user}
    onNewChat={() => { if (busy.current) return; setReport(null); setCompany(""); setError(""); setNotice(""); setActiveId(null); }}
    onSelectReport={(entry) => { if (busy.current) return; setReport(entry.report); setCompany(entry.company); setActiveId(entry.id); setError(""); setNotice(""); }}
    onDeleteReport={(id) => { const updated = reports.filter((r) => r.id !== id); setReports(updated); if (!user) { try { localStorage.setItem("anon_reports", JSON.stringify(updated)); } catch { setNotice("History couldn’t be updated."); } } if (activeId === id) { setReport(null); setActiveId(null); } }} />;

  return <Layout showSidebar sidebarContent={sidebar}>
    <div className={`audit-page ${report || loading ? "has-result" : ""}`}>
      <header className="audit-intro">
        <h1>{report || loading ? "Company check" : <>Look past the<br className="hero-break" /> green claims.</>}</h1>
        {!report && !loading && <p>A company’s environmental record, made clearer.</p>}
      </header>
      <form onSubmit={submit} className="company-search">
        <label htmlFor="company" className="sr-only">Company name or website</label>
        <div className="search-field">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
          <input id="company" value={company} onChange={(event) => setCompany(event.target.value)} disabled={loading} maxLength={200} required placeholder="Company name or website" autoComplete="organization" />
          <button disabled={loading || !company.trim()}>{loading ? "Checking…" : <>Check <span aria-hidden="true">↗</span></>}</button>
        </div>
        {!report && !loading && <div className="search-help"><span>Try</span>{["Apple", "Amazon", "Shell"].map((name) => <button key={name} type="button" onClick={() => { setCompany(name); document.getElementById("company")?.focus(); }}>{name}</button>)}<span className="no-account">No account needed</span></div>}
      </form>
      <section ref={resultRef} tabIndex={-1} aria-label="Company research" aria-busy={loading} className="research-region">
        {loading && <div className="research-loading" role="status" aria-live="polite">
          <div className="loading-heading"><span className="research-spinner" aria-hidden="true" /><h2>Researching {company.trim()}</h2></div>
          <p>Checking company reports and independent sources.</p>
          <div className="loading-preview" aria-hidden="true"><span /><span /><span /></div>
          <p className="loading-time" aria-hidden="true">{elapsed}s · {elapsed >= 60 ? "Still researching. Thanks for your patience." : "This can take up to two minutes."}</p>
        </div>}
        {error && <div role="alert" className="research-error"><h2>We couldn’t complete this check</h2><p>{error}</p><button onClick={() => document.getElementById("company")?.focus()}>Review the company name ↑</button></div>}
        {report && <AuditResult key={activeId || report.eco_audit.last_audit_date} report={report} />}
        {notice && <p role="status" className="research-notice">{notice}</p>}
      </section>
      {!report && !loading && !error && <p className="landing-note">Company claims. Independent reporting.<br />One place to start your research.</p>}
    </div>
  </Layout>;
}
