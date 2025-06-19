"use client";

import { useState } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";

interface ReportData {
  restated?: string;
  articles?: string;
  analysis?: string;
  rationale?: string;
  verdict?: string;
  error?: string;
}

export default function Home() {
  const [claim, setClaim] = useState("");
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setReport(null);

    try {
      const res = await axios.post(
        "https://greenwash-api-production.up.railway.app/check",
        { claim }
      );
      setReport(res.data);
    } catch {
      setReport({ error: "❌ Something went wrong. Please try again." });
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 text-gray-900 px-4 py-10 md:px-8 font-serif">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-extrabold text-green-800 mb-4 leading-tight tracking-tight">
          🌿 Greenwashing Checker
        </h1>
        <p className="text-lg md:text-xl text-green-700 mb-6">
          Enter a company’s sustainability claim below. We’ll evaluate it using
          real-world sources and return a detailed analysis.
        </p>

        <form
          onSubmit={submit}
          className="bg-white shadow-lg rounded-2xl p-6 space-y-4"
        >
          <textarea
            rows={4}
            className="w-full p-4 text-base border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
            placeholder="e.g., Google says its data centers are 100% sustainable"
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            required
          />
          <button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition duration-300"
            disabled={loading}
          >
            {loading ? "Checking..." : "Evaluate Claim"}
          </button>
        </form>

        {report && !report.error && (
          <div className="mt-10 bg-white border border-green-200 rounded-xl p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-xl font-bold text-green-800 mb-1">
                ✅ Restated Claim
              </h2>
              <p>{report.restated}</p>
            </div>
            <div>
              <h2 className="text-xl font-bold text-green-800 mb-1">
                📚 Articles
              </h2>
              <div className="prose prose-green max-w-none">
                <ReactMarkdown>{report.articles || ""}</ReactMarkdown>
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-green-800 mb-1">
                🔍 Analysis
              </h2>
              <p>{report.analysis}</p>
            </div>
            <div>
              <h2 className="text-xl font-bold text-green-800 mb-1">
                🧮 Rationale
              </h2>
              <p>{report.rationale}</p>
            </div>
            <div className="border-l-4 pl-4 mt-4 text-green-800 bg-green-50 border-green-500 font-semibold">
              {report.verdict}
            </div>
          </div>
        )}

        {report?.error && (
          <div className="mt-6 p-4 bg-red-100 border border-red-300 text-red-800 rounded-lg">
            {report.error}
          </div>
        )}
      </div>
    </main>
  );
}
