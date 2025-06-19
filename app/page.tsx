"use client";
import { useState } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";

export default function Home() {
  const [claim, setClaim] = useState("");
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setReport("");

    try {
      const res = await axios.post("https://greenwash-api-production.up.railway.app/check", {
        claim,
      });
      setReport(res.data.report);
    } catch {
      setReport("❌ Something went wrong. Please try again.");
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen px-6 py-10 bg-white max-w-2xl mx-auto text-gray-900">
      <h1 className="text-3xl font-bold mb-4">Greenwashing Checker</h1>
      <p className="text-gray-600 mb-6">
        Enter a sustainability claim. We’ll investigate and return a GPT-generated report.
      </p>
      <form onSubmit={submit} className="mb-6 space-y-4">
        <textarea
          rows={4}
          className="w-full p-3 border rounded"
          placeholder="e.g., Google is 100% renewable"
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          required
        />
        <button
          type="submit"
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Checking..." : "Evaluate Claim"}
        </button>
      </form>

      {report && (
        <div className="prose max-w-none">
          <ReactMarkdown>{report}</ReactMarkdown>
        </div>
      )}
    </main>
  );
}








