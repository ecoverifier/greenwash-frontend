"use client";

import { useState } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/app/firebase";
import type { ReportType } from "../types/audit";

type SavedReport = { id: string; company: string; report: ReportType };
interface Props {
  reports: SavedReport[];
  activeReportId: string | null;
  sessionStarted: boolean;
  user: User | null;
  disabled?: boolean;
  onNewChat: () => void;
  onSelectReport: (report: SavedReport) => void;
  onDeleteReport: (id: string) => void;
  onCloseSidebar?: () => void;
}
export default function ReportsSidebar({ reports, activeReportId, user, disabled, onNewChat, onSelectReport, onDeleteReport, onCloseSidebar }: Props) {
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  async function remove(id: string) {
    setError(""); setDeleting(id);
    try { if (user) await deleteDoc(doc(db, "reports", id)); onDeleteReport(id); }
    catch { setError("Couldn’t delete that report. Please try again."); }
    finally { setDeleting(null); }
  }
  return <div className="history-content">
    <button className="history-new" disabled={disabled} onClick={() => { onNewChat(); onCloseSidebar?.(); }}>+ Check another company</button>
    {error && <p role="alert" className="history-error">{error}</p>}
    {reports.length ? <ul className="history-list">{reports.map((entry) => <li key={entry.id}>
      <button className="history-select" disabled={disabled} aria-current={entry.id === activeReportId ? "true" : undefined} onClick={() => { onSelectReport(entry); onCloseSidebar?.(); }}>{entry.report.company || entry.company}</button>
      <button className="history-delete" disabled={disabled || deleting !== null} onClick={() => remove(entry.id)} aria-label={`Delete ${entry.company} report`}>{deleting === entry.id ? "…" : "✕"}</button>
    </li>)}</ul> : <p className="history-empty">Your company checks will appear here.</p>}
  </div>;
}
