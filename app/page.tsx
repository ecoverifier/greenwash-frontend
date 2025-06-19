"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { auth, provider, db, signInWithPopup, signOut } from "./firebase";
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
import { onAuthStateChanged, User } from "firebase/auth";

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

type Chat = {
  id: string;
  claim: string;
  report: ReportType;
  createdAt: string;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [claim, setClaim] = useState("");
  const [report, setReport] = useState<ReportType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const q = query(
          collection(db, "chats"),
          where("uid", "==", currentUser.uid),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        const userChats = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Chat));
        setChats(userChats);
      } else {
        setChats([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const saveChat = async (claim: string, report: ReportType) => {
    if (!user) return;
    const docRef = await addDoc(collection(db, "chats"), {
      uid: user.uid,
      claim,
      report,
      createdAt: new Date().toISOString(),
    });
    setChats([{ id: docRef.id, claim, report, createdAt: new Date().toISOString() }, ...chats]);
  };

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
      if (res.data.error && !res.data.restated_claim) {
        throw new Error(res.data.error);
      }
      setReport(res.data);
      await saveChat(claim, res.data);
      
      setReport(res.data);
      await saveChat(claim, res.data);
    } catch {
      setError("❌ Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  const loadChat = (chat: Chat) => {
    setClaim(chat.claim);
    setReport(chat.report);
    setError("");
    setLoading(false);
  };

  const deleteChat = async (chatId: string) => {
    await deleteDoc(doc(db, "chats", chatId));
    setChats(chats.filter((c) => c.id !== chatId));
  };

  const newChat = () => {
    setClaim("");
    setReport(null);
    setError("");
    setLoading(false);
  };

  return (
    <div className="flex">
      {/* Sidebar */}
      <aside className="w-1/4 bg-white border-r border-green-200 p-4 h-screen overflow-y-auto shadow-inner">
        {user ? (
          <>
            <div className="mb-6">
              <button
                onClick={newChat}
                className="w-full bg-green-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-green-600 mb-2"
              >
                + New Chat
              </button>
              <button
                onClick={() => signOut(auth)}
                className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
              >
                Sign Out
              </button>
            </div>
            <h3 className="text-green-700 font-bold mb-3">Your Chats</h3>
            <ul className="space-y-2">
              {chats.map((chat) => (
                <li key={chat.id} className="flex justify-between items-start">
                  <button
                    onClick={() => loadChat(chat)}
                    className="text-left flex-1 p-2 border border-green-100 rounded-md hover:bg-green-50"
                  >
                    <p className="text-sm font-semibold truncate">{chat.claim}</p>
                    <p className="text-xs text-gray-500">{new Date(chat.createdAt).toLocaleString()}</p>
                  </button>
                  <button
                    onClick={() => deleteChat(chat.id)}
                    className="text-red-500 hover:text-red-700 px-2"
                    title="Delete"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <button
            onClick={() => signInWithPopup(auth, provider)}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-green-700"
          >
            Sign in with Google
          </button>
        )}
      </aside>

      {/* Main Content */}
      <main className="w-full md:w-3/4 min-h-screen bg-gradient-to-br from-green-50 to-green-100 text-gray-900 px-4 py-10 md:px-8 font-serif">
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
    </div>
  );
}
