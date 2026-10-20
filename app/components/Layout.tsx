"use client";

import { cloneElement, isValidElement, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, provider, signInWithPopup, signOut } from "@/app/firebase";

interface LayoutProps {
  children: ReactNode;
  title?: string;
  showSidebar?: boolean;
  sidebarContent?: ReactNode;
}

export default function Layout({ children, showSidebar = false, sidebarContent }: LayoutProps) {
  const [user, setUser] = useState<User | null>(null);
  const [accountError, setAccountError] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const historyRef = useRef<HTMLDialogElement>(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  async function accountAction() {
    setAccountError(""); setAccountBusy(true);
    try { if (user) await signOut(auth); else await signInWithPopup(auth, provider); }
    catch { setAccountError("Couldn’t update your account. Please try again."); }
    finally { setAccountBusy(false); }
  }
  const history = isValidElement<{ onCloseSidebar?: () => void }>(sidebarContent)
    ? cloneElement(sidebarContent, { onCloseSidebar: () => historyRef.current?.close() }) : sidebarContent;

  return <>
    <header className="site-header">
      <Link href="/" className="site-brand" aria-label="EcoVerifier home"><span className="brand-mark" aria-hidden="true">e</span>EcoVerifier</Link>
      <nav aria-label="Main navigation" className="site-nav">
        {showSidebar && <button onClick={() => historyRef.current?.showModal()}>History</button>}
        <button onClick={accountAction} disabled={accountBusy}>{accountBusy ? "Please wait…" : user ? "Sign out" : "Sign in"}</button>
      </nav>
    </header>
    {accountError && <p role="alert" className="account-notice">{accountError}</p>}
    {showSidebar && <dialog ref={historyRef} className="history-dialog" aria-labelledby="history-title" onClick={(event) => { if (event.target === event.currentTarget) historyRef.current?.close(); }}>
      <div className="history-inner">
        <div className="history-heading"><h2 id="history-title">Your reports</h2><button onClick={() => historyRef.current?.close()} aria-label="Close history">✕</button></div>
        {history}
      </div>
    </dialog>}
    <main className="site-main">{children}</main>
  </>;
}
