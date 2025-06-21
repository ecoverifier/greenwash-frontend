"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { PaperPlaneIcon, DownloadIcon } from "@radix-ui/react-icons";
import jsPDF from "jspdf";
import { FaUserCircle, FaRobot, FaPlus, FaTrashAlt } from "react-icons/fa";
import { HiArrowUpCircle } from "react-icons/hi2";
import { RiChatNewLine } from "react-icons/ri";
import { FiLogIn, FiLogOut } from "react-icons/fi";




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

type ReportType = {
  restated_claim: string;
  sources: {
    title: string;
    url: string;
    summary: string;
    strengths: string;
    limitations: string;
  }[];
  verdict: string;
  explanation: string;
};

export default function Home() {
  // 🔒 Auth state and logout
const [sessionStarted, setSessionStarted] = useState(false);
const [user, setUser] = useState<User | null>(null);
const [error, setError] = useState("");

const handleLogout = async () => {
  try {
    await signOut(auth);
    setUser(null);
    setReport(null);
    setClaim("");
    setSessionStarted(false);
    setActiveReportId(null);
  } catch (err) {
    console.error("Logout failed", err);
    setError("Logout failed. Please try again.");
  }
};

// ✅ Placeholder typing animation (cleaned and simplified)
const examples = [
  "e.g. Amazon says it will be net-zero by 2040",
  "e.g. Apple will stop using plastic packaging",
  "e.g. Shell claims 50% carbon reduction by 2035",
];

const [animatedPlaceholder, setAnimatedPlaceholder] = useState("");
const [exampleIndex, setExampleIndex] = useState(0);
const [charIndex, setCharIndex] = useState(0);
const [isDeleting, setIsDeleting] = useState(false);
const [claim, setClaim] = useState("");

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
  if (!claim.trim()) return;

  setLoading(true);
  setError("");
  setReport(null);
  setSessionStarted(true);

  const tempId = `temp-${Date.now()}`;
  const tempReport = { id: tempId, claim, report: null, loading: true };
  setReports((prev) => [tempReport, ...prev]);
  setActiveReportId(tempId);

  if (!user) {
    localStorage.setItem(
      "anon_reports",
      JSON.stringify([{ ...tempReport }, ...reports])
    );
  }

  try {
    const res = await axios.post(
      "https://greenwash-api-production.up.railway.app/check",
      { claim }
    );
    if (res.data.error) throw new Error(res.data.error);

    if (user) {
      const docRef = await addDoc(collection(db, "reports"), {
        uid: user.uid,
        claim,
        report: res.data,
        createdAt: new Date().toISOString(),
      });
      setActiveReportId(docRef.id);
    }

    setReport(res.data);
    setReports((prev) =>
      prev.map((r) =>
        r.id === tempId ? { ...r, report: res.data, loading: false } : r
      )
    );

    if (!user) {
      const updated = reports.map((r) =>
        r.id === tempId ? { ...r, report: res.data, loading: false } : r
      );
      localStorage.setItem("anon_reports", JSON.stringify(updated));
    }
  } catch (err: any) {
    console.error("Claim submit failed:", err.message);
    setError("Something went wrong. Please try again.");
    setReports((prev) => prev.filter((r) => r.id !== tempId));
    if (!user) {
      localStorage.setItem(
        "anon_reports",
        JSON.stringify(reports.filter((r) => r.id !== tempId))
      );
    }
  }

  setLoading(false);
};

// 🧾 PDF download
const downloadPDF = () => {
  if (!report) return;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(40, 167, 69);
  doc.text("EcoVerifier Sustainability Report", pageWidth / 2, y, {
    align: "center",
  });
  y += 15;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(33, 37, 41);
  doc.text("Restated Claim:", 14, y);
  y += 7;
  const restatedClaimLines = doc.splitTextToSize(report.restated_claim, 180);
  doc.text(restatedClaimLines, 14, y);
  y += restatedClaimLines.length * 7 + 5;

  doc.text("Evaluation:", 14, y);
  y += 7;
  doc.text(`Verdict: ${report.verdict}`, 14, y);
  y += 7;
  const explanationLines = doc.splitTextToSize(report.explanation, 180);
  doc.text(explanationLines, 14, y);
  y += explanationLines.length * 7 + 5;

  doc.text("Sources:", 14, y);
  y += 8;

  report.sources.forEach((source, index) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.text(`${index + 1}. ${source.title}`, 14, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    const summaryLines = doc.splitTextToSize(`Summary: ${source.summary}`, 180);
    doc.text(summaryLines, 14, y);
    y += summaryLines.length * 6;

    const strengthsLines = doc.splitTextToSize(
      `Strengths: ${source.strengths}`,
      180
    );
    doc.text(strengthsLines, 14, y);
    y += strengthsLines.length * 6;

    const limitationsLines = doc.splitTextToSize(
      `Limitations: ${source.limitations}`,
      180
    );
    doc.text(limitationsLines, 14, y);
    y += limitationsLines.length * 6 + 5;
  });

  doc.save("greenwatch_report.pdf");
};


  return (
    <div className="flex min-h-screen bg-[#f7f9fb] text-gray-900 font-sans">
      {/* Sidebar */}
      <aside className="w-65 bg-white border-r border-gray-200 px-6 py-6 shadow-md rounded-md">
      <div className="flex items-center justify-between mb-6">
  <h2 className="text-lg font-bold text-emerald-700 tracking-tight">
    Reports
  </h2>

  {/* New Claim Button */}
  <button
    onClick={() => {
      setReport(null);
      setClaim("");
      setActiveReportId(null);
      setSessionStarted(false);
    }}
    className="flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition"
    title="New Claim"
  >
    <RiChatNewLine className="w-5 h-5" />
  </button>
</div>



  {/* Report List */}
  <div className="space-y-4">
    {reports.map((r) => (
      <div
        key={r.id}
        onClick={() => {
          setReport(r.report);
          setClaim(r.claim);
          setActiveReportId(r.id);
          setSessionStarted(true);
        }}
        className={`relative group p-4 rounded-lg border text-sm cursor-pointer transition-all duration-200 ${
          r.id === activeReportId
            ? "bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200"
            : "bg-white hover:bg-gray-50 border-gray-200"
        }`}
      >
        <span className="block pr-6 text-gray-800 font-medium truncate">
          {r.claim}
        </span>

        {/* Delete Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setReports((prev) => {
              const updatedReports = prev.filter((rep) => rep.id !== r.id);
              if (activeReportId === r.id) {
                if (updatedReports.length > 0) {
                  const nextActive = updatedReports[0];
                  setReport(nextActive.report);
                  setClaim(nextActive.claim);
                  setActiveReportId(nextActive.id);
                  setSessionStarted(true);
                } else {
                  setReport(null);
                  setClaim("");
                  setActiveReportId(null);
                  setSessionStarted(false);
                }
              }
              if (!user) {
                localStorage.setItem(
                  "anon_reports",
                  JSON.stringify(updatedReports)
                );
              }
              return updatedReports;
            });
            if (user) {
              deleteDoc(doc(db, "reports", r.id));
            }
          }}
          className="absolute top-3 right-3 text-red-400 hover:text-red-600 transition"
          title="Delete report"
        >
          <FaTrashAlt className="w-4 h-4" />
        </button>
      </div>
    ))}
  </div>
</aside>


  


<main className="flex-1 px-6 py-10 sm:px-10 bg-gray-50 transition-all duration-300 min-h-screen">
  {/* Header */}
  <div className="flex justify-between items-center mb-12">
    <div className="flex items-center gap-3">
      <img src="favicon.ico" alt="EcoVerifier Logo" className="w-10 h-10" />
      <span className="text-2xl font-semibold text-emerald-600 tracking-tight">
        EcoVerifier
      </span>
    </div>

    {user ? (
      <button
        onClick={handleLogout}
        className="inline-flex items-center gap-2 text-sm font-medium text-red-500 hover:text-red-600 border border-red-100 hover:border-red-300 px-3 py-1.5 rounded-md transition-all shadow-sm hover:shadow-md"
      >
        <FiLogOut className="w-4 h-4" />
        Logout
      </button>
    ) : (
      <button
        onClick={login}
        className="inline-flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 border border-emerald-100 hover:border-emerald-300 px-3 py-1.5 rounded-md transition-all shadow-sm hover:shadow-md"
      >
        <FiLogIn className="w-4 h-4" />
        Login with Google
      </button>
    )}
  </div>

  {/* Welcome Page */}
  {!sessionStarted ? (
    <div className="w-full max-w-2xl mx-auto text-center space-y-12 pt-12">
      <div className="space-y-6">
        <h1 className="text-5xl sm:text-6xl font-extrabold text-emerald-700 leading-tight">
          Verify Sustainability Claims in Seconds.
        </h1>
        <p className="text-gray-600 text-lg max-w-xl mx-auto">
          EcoVerifier helps you cut through greenwashing by analyzing
          environmental claims using trusted sources.
        </p>
      </div>

      <form onSubmit={submit} className="relative mt-12">
        <div className="relative">
          <textarea
            rows={4}
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            className="w-full p-4 border border-gray-300 rounded-lg shadow-md resize-none focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm bg-white"
          />
          {claim.length === 0 && (
            <div className="absolute top-4 left-4 text-gray-400 pointer-events-none text-sm">
              {animatedPlaceholder}
            </div>
          )}
        </div>
        <button
          type="submit"
          className="absolute bottom-3 right-3 bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-full shadow-md transition"
          aria-label="Submit"
        >
          <HiArrowUpCircle className="w-6 h-6" />
        </button>

      </form>
    </div>
  ) : (
    <div className="max-w-2xl space-y-8 mx-auto">
      {/* User Message */}
<div className="flex items-start gap-4">
  <div className="text-emerald-700">
    <FaUserCircle className="w-8 h-8" />
  </div>
  <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 shadow-sm text-sm leading-relaxed max-w-full">
    {claim}
  </div>
</div>

{/* Bot Message */}
<div className="flex items-start gap-4">
  <div className="text-white bg-emerald-600 p-1.5 rounded-full">
    <FaRobot className="w-6 h-6" />
  </div>
  <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 shadow-sm text-sm">
    {loading ? (
      <span className="animate-pulse text-gray-700">Analyzing claim...</span>
    ) : (
      <p className="text-md font-bold">Report Generated</p>
    )}
  </div>
</div>


      {/* Report Display */}
      {report && (
        <div className="flex items-start gap-4">

          <div className="bg-white border border-gray-200 rounded-xl px-6 py-6 shadow space-y-6 text-sm w-full">
            <div>
              <p className="text-xs uppercase font-semibold text-gray-500 mb-1">Rephrased Claim</p>
              <p>{report.restated_claim}</p>
            </div>
            <div>
              <p className="text-xs uppercase font-semibold text-gray-500 mb-1">Verdict</p>
              <p className="font-medium">{report.verdict}</p>
            </div>
            <div>
              <p className="text-xs uppercase font-semibold text-gray-500 mb-1">Explanation</p>
              <p>{report.explanation}</p>
            </div>
            <div>
              <p className="text-xs uppercase font-semibold text-gray-500 mb-1">Sources</p>
              <ol className="list-decimal list-inside space-y-4">
                {report.sources.map((source, idx) => (
                  <li key={idx}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-emerald-600 hover:underline"
                    >
                      {source.title}
                    </a>
                    <p className="text-gray-700">{source.summary}</p>
                    <p>
                      <strong>Strengths:</strong> {source.strengths}
                    </p>
                    <p>
                      <strong>Limitations:</strong> {source.limitations}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
            <button
              onClick={downloadPDF}
              className="inline-flex items-center gap-2 bg-gray-100 border border-gray-300 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-xs font-medium transition"
            >
              Download PDF
            </button>
          </div>
        </div>
      )}
    </div>
  )}
</main>



    </div>
  );
  
  
}
