"use client";

import { useState } from "react";
import axios from "axios";

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

  const submit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setReport(null);

    try {
      const res = await axios.post(
        "https://greenwash-api-production.up.railway.app/check",
        { claim }
      );
      if (res.data.error) {
        throw new Error(res.data.error);
      }
      setReport(res.data);
    } catch (err: any) {
      setError("❌ Something went wrong. Please try again.");
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
          Enter a company’s sustainability claim below. We’ll evaluate it using real-world sources and return a detailed analysis.
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

        {error && (
          <div className="mt-6 bg-red-100 border border-red-300 text-red-800 rounded-lg p-4">
            {error}
          </div>
        )}

{loading && (
  <div className="mt-10 flex justify-center">
    <svg className="animate-spin h-10 w-10 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  </div>
)}

{report && (
  <div className="mt-10 space-y-10">
    <div>
      <h2 className="text-2xl font-bold text-green-800 mb-4">📚 Sources Used</h2>
      <div className="grid md:grid-cols-2 gap-6">
        {report.sources.map((source, idx) => (
          <div key={idx} className="bg-white border border-green-200 p-4 rounded-xl shadow-sm space-y-2">
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="block text-lg font-semibold text-green-700 hover:underline">
              {source.title}
            </a>
            <p className="text-sm text-gray-700"><strong>Summary:</strong> {source.summary}</p>
            <p className="text-sm text-green-800"><strong>Strengths:</strong> {source.strengths}</p>
            <p className="text-sm text-red-700"><strong>Limitations:</strong> {source.limitations}</p>
          </div>
        ))}
      </div>
    </div>

    <div className="bg-white border border-green-300 p-6 rounded-xl shadow-md space-y-4">
      <h2 className="text-2xl font-bold text-green-800">📝 Final Evaluation</h2>
      <p className="text-green-700 text-lg"><strong>Restated Claim:</strong> {report.restated_claim}</p>
      <p className="text-lg font-semibold">
        {report.verdict === "Genuine" && "✅ Genuine"}
        {report.verdict === "Vague or misleading" && "⚠️ Vague or misleading"}
        {report.verdict === "Likely greenwashing" && "❌ Likely greenwashing"}
      </p>
      <p className="text-gray-800">{report.explanation}</p>
    </div>
  </div>
)}

      </div>
    </main>
  );
}