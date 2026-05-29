// ─────────────────────────────────────────────────────────────────────────────
//  Messages.jsx
//  All shared UI alert/confirm/toast components and hooks.
//  Extracted from Common.jsx so Common stays pure utility-only.
//
//  EXPORTS:
//   • modalStyles         — shared inline style object
//   • ConfirmModal        — modal dialog component
//   • useConfirm()        — hook → { confirm, ConfirmUI }
//   • useToast()          — hook → { toast, toasts }
//   • ToastList           — render companion for useToast
//
//  USAGE IN ANY PAGE:
//   import * as MSG from "./Messages";
//   const { confirm, ConfirmUI } = MSG.useConfirm();
//   const { toast,   toasts    } = MSG.useToast();
//   ...
//   {ConfirmUI}
//   <MSG.ToastList toasts={toasts} />
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Shared pop-in animation (injected once per page load) ────────────────────
if (typeof document !== "undefined" && !document.getElementById("msgPopInStyle")) {
  const s = document.createElement("style");
  s.id = "msgPopInStyle";
  s.textContent = `
    @keyframes msgPopIn {
      from { transform: scale(0.88); opacity: 0; }
      to   { transform: scale(1);    opacity: 1; }
    }
  `;
  document.head.appendChild(s);
}

// ─── 1. SHARED MODAL STYLES ───────────────────────────────────────────────────
export const modalStyles = {
  overlay: {
    position:"fixed", inset:0, background:"rgba(10,20,40,0.55)",
    backdropFilter:"blur(2px)", display:"flex", alignItems:"center",
    justifyContent:"center", zIndex:9999,
  },
  modal: {
    background:"#fff", borderRadius:"10px", padding:"28px 32px 22px",
    minWidth:"280px", maxWidth:"360px", textAlign:"center",
    boxShadow:"0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)",
    border:"1px solid #e2e8f0", animation:"msgPopIn 0.15s ease",
  },
  icon: {
    width:"40px", height:"40px", borderRadius:"50%",
    background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",
    color:"#fff", fontSize:"20px", fontWeight:"700",
    lineHeight:"40px", margin:"0 auto 14px",
  },
  msg:  { fontSize:"14px", color:"#1e293b", fontWeight:"500", margin:"0 0 20px", lineHeight:"1.5" },
  btns: { display:"flex", gap:"10px", justifyContent:"center" },
  btn:  { padding:"7px 26px", borderRadius:"6px", border:"none", fontSize:"13px", fontWeight:"600", cursor:"pointer", outline:"none" },
  yes:  { background:"linear-gradient(135deg,#22c55e,#16a34a)", color:"#fff", boxShadow:"0 2px 6px rgba(34,197,94,0.35)" },
  no:   { background:"#f1f5f9", color:"#475569", border:"1px solid #cbd5e1" },
};

// ─── 2. CONFIRM MODAL COMPONENT ───────────────────────────────────────────────
/**
 * Internal modal rendered by useConfirm.
 * Not normally used directly — use the ConfirmUI returned by useConfirm() instead.
 */
export function ConfirmModal({ message, onYes, onNo }) {
  const yesBtnRef = useRef(null);

  // Auto-focus the Yes button when the modal opens
  useEffect(() => {
    const t = setTimeout(() => yesBtnRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  // Escape key → No
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onNo(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onNo]);

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.modal} role="dialog" aria-modal="true">
        <div style={modalStyles.icon}>?</div>
        <p style={modalStyles.msg}>{message}</p>
        <div style={modalStyles.btns}>
          <button
            ref={yesBtnRef}
            style={{ ...modalStyles.btn, ...modalStyles.yes }}
            onClick={onYes}
          >
            ✔ Yes
          </button>
          <button
            style={{ ...modalStyles.btn, ...modalStyles.no }}
            onClick={onNo}
          >
            ✘ No
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 3. useConfirm HOOK ───────────────────────────────────────────────────────
/**
 * Returns { confirm, ConfirmUI }.
 *
 * Usage:
 *   const { confirm, ConfirmUI } = useConfirm();
 *   // In JSX: {ConfirmUI}
 *   // In handler: const ok = await confirm("Are you sure?");
 */
export function useConfirm() {
  const [conf, setConf] = useState(null);

  const confirm = useCallback(
    (message) => new Promise((resolve) => setConf({ message, resolve })),
    []
  );

  const handleYes = useCallback(() => { conf?.resolve(true);  setConf(null); }, [conf]);
  const handleNo  = useCallback(() => { conf?.resolve(false); setConf(null); }, [conf]);

  const ConfirmUI = conf
    ? <ConfirmModal message={conf.message} onYes={handleYes} onNo={handleNo} />
    : null;

  return { confirm, ConfirmUI };
}

// ─── 4. useToast HOOK ─────────────────────────────────────────────────────────
/**
 * Returns { toast, toasts }.
 * Render <ToastList toasts={toasts} /> at the bottom of your component.
 *
 * Usage:
 *   const { toast, toasts } = useToast();
 *   toast("✅ Saved!");           // success
 *   toast("❌ Error msg", true);  // error (red)
 */
export function useToast(durationMs = 3500) {
  const toastId = useRef(0);
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg, isErr = false) => {
    const id = ++toastId.current;
    setToasts(p => [...p, { id, msg, isErr }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), durationMs);
  }, [durationMs]);

  return { toast, toasts };
}

// ─── 5. ToastList COMPONENT ───────────────────────────────────────────────────
/**
 * Companion render component for useToast.
 * Place at the bottom of your page JSX.
 *
 * Usage: <MSG.ToastList toasts={toasts} />
 * (requires .toasts / .toast / .toast.err CSS in MasterPage.css)
 */
export function ToastList({ toasts }) {
  return (
    <div className="toasts">
      {toasts.map(t => (
        <div key={t.id} className={`toast${t.isErr ? " err" : ""}`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
