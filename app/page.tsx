"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { PaperPlaneIcon } from "@radix-ui/react-icons";

// === Types ===
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

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 to-teal-100 text-gray-900 font-montserrat px-4 py-10 md:px-8">
      {/* Header */}
      <header className="flex items-center justify-between max-w-5xl mx-auto mb-12">
        <div className="flex items-center space-x-3">
          <img src="/logo.svg" alt="Logo" className="h-10 w-10" />
          <h1 className="text-2xl font-bold text-emerald-700 tracking-tight">Greenwatch</h1>
        </div>
      </header>

      {/* Claim prompt */}
      <div className="max-w-2xl mx-auto text-center mb-6">
        <p className="text-xl text-gray-800">
          Enter a sustainability claim below. We'll analyze it using real-world sources.
        </p>
      </div>

      {/* Chatbox */}
      <form
        onSubmit={submit}
        className="max-w-2xl mx-auto relative bg-white border border-emerald-200 rounded-xl overflow-hidden shadow-sm"
      >
        <textarea
          rows={3}
          className="w-full resize-none p-4 pr-12 text-base text-gray-900 bg-white focus:outline-none font-medium"
          placeholder={samples[sampleIndex].slice(0, charIndex)}
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
        />
        <button
          type="submit"
          className="absolute bottom-3 right-3 bg-gradient-to-r from-teal-400 to-emerald-400 text-white p-2 rounded-full shadow-md transition"
          disabled={loading}
        >
          <PaperPlaneIcon className="h-5 w-5" />
        </button>
      </form>

      {/* Error message */}
      {error && (
        <div className="max-w-2xl mx-auto mt-4 bg-red-100 border border-red-300 text-red-700 rounded-md p-4 text-sm">
          {error}
        </div>
      )}

      {/* Report Output */}
      {report && (
        <div className="max-w-3xl mx-auto mt-10 space-y-8">
          <div className="bg-white border border-gray-200 rounded-xl shadow p-6">
            <h2 className="text-xl font-semibold text-emerald-800 mb-2">Restated Claim</h2>
            <p className="text-gray-900 leading-relaxed">{report.restated_claim}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow p-6">
            <h2 className="text-xl font-semibold text-emerald-800 mb-2">Evaluation</h2>
            <p className="text-base text-gray-900 font-medium mb-2">{report.verdict}</p>
            <p className="text-gray-800 leading-relaxed">{report.explanation}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow p-6">
            <h2 className="text-xl font-semibold text-emerald-800 mb-4">Sources Analyzed</h2>
            <ul className="space-y-4">
              {report.sources.map((source, idx) => (
                <li key={idx} className="border border-emerald-100 rounded-md p-4">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block font-semibold text-emerald-700 hover:underline mb-1"
                  >
                    {source.title}
                  </a>
                  <p className="text-sm text-gray-700 mb-1">{source.summary}</p>
                  <p className="text-sm text-gray-600"><strong>Strengths:</strong> {source.strengths}</p>
                  <p className="text-sm text-gray-600"><strong>Limitations:</strong> {source.limitations}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}
