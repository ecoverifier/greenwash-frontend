"use client";

import { useState } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";

export default function Home() {
  const [claim, setClaim] = useState("");
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setReport("");

    try {
      const res = await axios.post(
        "https://greenwash-api-production.up.railway.app/check",
        { claim }
      );
      setReport(res.data.report);
    } catch {
      setReport("❌ Something went wrong. Please try again.");
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 text-gray-900 font-serif px-6 py-10 md:px-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-extrabold text-green-800 mb-4 leading-tight tracking-tight">
          🌿 Greenwashing Checker
        </h1>
        <p className="text-lg md:text-xl text-green-700 mb-8">
          Enter a company’s sustainability claim below. We’ll evaluate it using real-world sources and return a detailed analysis.
        </p>

        <form
          onSubmit={submit}
          className="bg-white shadow-md rounded-2xl p-6 md:p-8 space-y-4"
        >
          <textarea
            rows={4}
            className="w-full p-4 text-lg border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
            placeholder="e.g., Google says its data centers are 100% sustainable"
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            required
          />
          <button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-white text-lg font-semibold py-3 rounded-lg transition duration-300"
            disabled={loading}
          >
            {loading ? "Checking..." : "Evaluate Claim"}
          </button>
        </form>

        {report && (
          <div className="mt-10 bg-white shadow-lg border border-green-200 rounded-2xl p-6 md:p-8 prose prose-green max-w-none">
            <ReactMarkdown>{report}</ReactMarkdown>
          </div>
        )}
      </div>
    </main>
  );
}