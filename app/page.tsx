"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { PaperPlaneIcon, DownloadIcon } from "@radix-ui/react-icons";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  const [claim, setClaim] = useState("");
  const [report, setReport] = useState<ReportType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sampleIndex, setSampleIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const samples = [
    "e.g., Google says its data centers are 100% sustainable",
    "e.g., Amazon claims to reach net-zero by 2040",
    "e.g., Tesla says all vehicles are carbon neutral"
  ];

  useEffect(() => {
    const currentSample = samples[sampleIndex];
    if (charIndex < currentSample.length) {
      const timeout = setTimeout(() => {
        setCharIndex((prev) => prev + 1);
      }, 30);
      return () => clearTimeout(timeout);
    } else {
      const nextTimeout = setTimeout(() => {
        setSampleIndex((prev) => (prev + 1) % samples.length);
        setCharIndex(0);
      }, 2000);
      return () => clearTimeout(nextTimeout);
    }
  }, [charIndex, sampleIndex]);

  const submit = async (e?: any) => {
    if (e) e.preventDefault();
    if (!claim.trim()) return;

    setLoading(true);
    setError("");
    setReport(null);

    try {
      const res = await axios.post(
        "https://greenwash-api-production.up.railway.app/check",
        { claim }
      );
      if (res.data.error) throw new Error(res.data.error);
      setReport(res.data);
    } catch (err: any) {
      setError("Something went wrong. Please try again.");
    }

    setLoading(false);
  };

  const downloadPDF = () => {
    if (!report) return;
  
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;
  
    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(40, 167, 69);
    doc.text("EcoVerifier Sustainability Report", pageWidth / 2, y, { align: "center" });
    y += 15;
  
    // Restated Claim
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(33, 37, 41);
    doc.text("Restated Claim:", 14, y);
    y += 7;
    const restatedClaimLines = doc.splitTextToSize(report.restated_claim, 180);
    doc.text(restatedClaimLines, 14, y);
    y += restatedClaimLines.length * 7 + 5;
  
    // Evaluation
    doc.text("Evaluation:", 14, y);
    y += 7;
    doc.text(`Verdict: ${report.verdict}`, 14, y);
    y += 7;
    const explanationLines = doc.splitTextToSize(report.explanation, 180);
    doc.text(explanationLines, 14, y);
    y += explanationLines.length * 7 + 5;
  
    // Sources
    doc.text("Sources:", 14, y);
    y += 8;
  
    report.sources.forEach((source, index) => {
      if (y > 270) { // page break if too low
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
  
      const strengthsLines = doc.splitTextToSize(`Strengths: ${source.strengths}`, 180);
      doc.text(strengthsLines, 14, y);
      y += strengthsLines.length * 6;
  
      const limitationsLines = doc.splitTextToSize(`Limitations: ${source.limitations}`, 180);
      doc.text(limitationsLines, 14, y);
      y += limitationsLines.length * 6 + 5;
    });
  
    // Save
    doc.save("greenwatch_report.pdf");
  };
  

  return (
    <main className="min-h-screen bg-[#f7f9fb] text-gray-900 font-sans px-6 py-12 md:px-10">
      <header className="flex items-center justify-between max-w-5xl mx-auto mb-12">
        <div className="flex items-center space-x-4">
          <img src="favicon.ico" alt="Logo" className="h-10 w-10" />
          <h1 className="text-2xl font-semibold text-emerald-600 tracking-tight">EcoVerifier</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto text-center mb-8">
        <p className="text-lg text-gray-700 leading-relaxed">
          Enter a sustainability claim. We'll analyze it using real-world evidence.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="max-w-2xl mx-auto relative bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm"
      >
        <textarea
          rows={3}
          className="w-full resize-none p-5 pr-14 text-base text-gray-800 bg-white focus:outline-none font-medium placeholder-gray-400"
          placeholder={`${samples[sampleIndex].slice(0, charIndex)}${charIndex < samples[sampleIndex].length ? '|' : ''}`}
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
        />
        <button
          type="submit"
          className="absolute bottom-4 right-4 bg-emerald-500 text-white p-2 rounded-full shadow-md hover:bg-emerald-600 active:scale-95 transition"
          disabled={loading}
        >
          {loading ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <PaperPlaneIcon className="h-5 w-5" />
          )}
        </button>
      </form>

      {loading && (
        <div className="max-w-2xl mx-auto text-center mt-4 text-sm text-gray-500">Analyzing claim...</div>
      )}

      {error && (
        <div className="max-w-2xl mx-auto mt-5 bg-red-100 border border-red-300 text-red-700 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

{report && (
  <div className="max-w-3xl mx-auto mt-12 px-4 py-6 bg-white rounded-2xl shadow-lg border border-gray-200">
    <div className="flex justify-between items-center mb-6">
      <h2 className="text-2xl font-bold text-emerald-700">Report</h2>
      <button
        onClick={downloadPDF}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition"
      >
        <DownloadIcon className="h-4 w-4" /> Download PDF
      </button>
    </div>

    <section className="space-y-6 text-gray-800 leading-relaxed text-[15px]">
      <div>
        <h3 className="text-lg font-semibold text-emerald-600 mb-2">Restated Claim</h3>
        <p>{report.restated_claim}</p>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-emerald-600 mb-2">Evaluation</h3>
        <p className="text-base font-medium text-gray-900 mb-1">{report.verdict}</p>
        <p>{report.explanation}</p>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-emerald-600 mb-2">Sources</h3>
        <ol className="list-decimal list-inside space-y-4">
          {report.sources.map((source, idx) => (
            <li key={idx}>
              <p className="font-semibold text-emerald-700">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {source.title}
                </a>
              </p>
              <p className="text-sm text-gray-700 mb-1">{source.summary}</p>
              <p className="text-sm text-gray-600"><strong>Strengths:</strong> {source.strengths}</p>
              <p className="text-sm text-gray-600"><strong>Limitations:</strong> {source.limitations}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  </div>
)}

    </main>
  );
}
