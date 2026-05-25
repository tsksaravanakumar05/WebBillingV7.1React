// ─────────────────────────────────────────────────────────────────────────────
//  CashierCommon.jsx
//  Shared utilities, API helpers, hooks, and UI components
//  used across all Cashier/Master pages.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";

// ─── 1. LOCAL-STORAGE HELPERS ─────────────────────────────────────────────────
export const getStr   = (k) => localStorage.getItem(k) || "";
export const getLocal = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

export const BASE_URL = "http://localhost:64215";
// Cashier API Links
export const CashierSelect = "/api/CashierApp/SelectCashier";
export const CashierInsert = "/api/CashierApp/InsertCashier";
export const CashierDelete = "/api/CashierApp/DeleteCashier";
export const SelectCounter = "/api/CashierApp/SelectCounter_local";
// ─── 2. AUTH HEADERS (token + user identity) ──────────────────────────────────
export const authHeaders = () => ({
  "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
  "Userid":        localStorage.getItem("userid")     || "0",
  "Profile":       localStorage.getItem("Profile")    || "Admin",
  "LoginCheck":    localStorage.getItem("LoginCheck") || "1",
});

// ─── 3. URL BUILDER ───────────────────────────────────────────────────────────
//export const mkUrl = (path) => (path.startsWith("/") ? path : "/" + path);
const mkUrl = (path) => {
  return BASE_URL + path;
};

// ─── 4. SESSION / COMPANY VARIABLES ──────────────────────────────────────────
/**
 * Call once per page (inside useState initialiser).
 * @param {string} pageName  - must match the PageName stored in "menulist"
 * @returns {{ Comid, MComid, IdComList, MirrorTable, menudata }}
 */
export const buildSession = (pageName) => {
  try {
    const main0       = (getLocal("Mainsetting") || [{}])[0] || {};
    const Comid       = getStr("Comid")    || "1";
    const MComid      = getStr("MComid")   || Comid;
    const IdComList   = getStr("IdComList") || Comid;
    const MirrorTable = getStr("MirrorTableOnline") || "0";
    return {
      Comid:    main0.CommonCompany ? MComid : Comid,
      MComid,
      IdComList,
      MirrorTable,
      menudata: (getLocal("menulist") || []).filter(o => o.PageName === pageName),
    };
  } catch {
    return { Comid: "1", MComid: "1", IdComList: "1", MirrorTable: "0", menudata: [] };
  }
};

// ─── 5. API HELPERS ───────────────────────────────────────────────────────────

/**
 * General-purpose POST (with optional query-string params).
 * Normalises IsSuccess → ok, Data1 → data, Message → message.
 */
export const api = async (path, body = null, extraHeaders = {}, queryParams = null) => {
  try {
    let fullUrl = mkUrl(path);

    if (queryParams && typeof queryParams === "object") {
      const qs = new URLSearchParams(
        Object.entries(queryParams)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => [k, String(v)])
      ).toString();
      if (qs) fullUrl += "?" + qs;
    }

    const res = await fetch(fullUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...authHeaders(),
        ...extraHeaders,
      },
      body: body !== null ? JSON.stringify(body) : undefined,
    });
    var a=1;

    // ── standard HTTP error handling ──
    if (res.status === 406) {
      alert("Already Login Another User Please Login Again!!!");
      window.location.href = "/Login";
      return { ok: false };
    }
    if (res.status === 404) return { ok: false, _http404: true,  message: `404: ${fullUrl}` };
    if (res.status === 500) {
      const t = await res.text();
      console.error(`500 on ${fullUrl}:`, t.slice(0, 500));
      return { ok: false, message: "Server error 500 — see console" };
    }

    const text = await res.text();
    if (!text.trim()) return { ok: false, message: "Empty response" };

    try {
      const j = JSON.parse(text);
      if (j.IsSuccess !== undefined && j.ok      === undefined) j.ok      = j.IsSuccess;
      if (j.Data1     !== undefined && j.data    === undefined) j.data    = j.Data1;
      if (j.Message   !== undefined && j.message === undefined) j.message = j.Message;
      return j;
    } catch { return { ok: false, message: text }; }

  } catch (err) {
    return { ok: false, _netErr: true, message: err.message };
  }
};

/**
 * Insert/update POST — returns raw parsed JSON.
 * Used when the server response uses IsSuccess / Data2 conventions.
 */
export const insertapi = async (path, body = null, extraHeaders = {}) => {
  try {
    const res = await fetch(mkUrl(path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...authHeaders(),
        ...extraHeaders,
      },
      body: body != null ? JSON.stringify(body) : null,
    });
    const text = await res.text();
    return JSON.parse(text);
  } catch (err) {
    return { ok: false, message: err.message };
  }
};

// ─── 6. MISC HELPERS ─────────────────────────────────────────────────────────
/** Generates a unique row key */
export const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36);

/**
 * Converts an input value to UPPERCASE while preserving the cursor position.
 * Usage: onChange={e => applyUppercase(e, val => updateCell(idx, "FieldName", val))}
 */
export function applyUppercase(e, onChange) {
  const el    = e.target;
  const start = el.selectionStart;
  const end   = el.selectionEnd;
  onChange(el.value.toUpperCase());
  requestAnimationFrame(() => {
    if (el && document.activeElement === el) {
      el.setSelectionRange(start, end);
    }
  });
}

// ─── Common.js — add this export ─────────────────────────────────────────────
// Moves focus to the next visible, enabled input/select/textarea in the page
// Usage: onKeyDown={e => CC.handleEnterNext(e)}

export function handleEnterNext(e, inputRefs, curRow, curCol, totalCols, totalRows, onLastCell, grid, rowValidator) {
  if (e.key !== "Enter") return;
  e.preventDefault();

  let nextRow = curRow;
  let nextCol = curCol + 1;

  // Last column reached
  if (nextCol >= totalCols) {

    const currentRow = grid[curRow];
    const isFilled = rowValidator(currentRow);

    if (!isFilled) {
      // Row not filled — jump to first empty col in same row
      for (let c = 0; c < totalCols; c++) {
        const el = inputRefs.current[curRow]?.[c];
        if (el && !el.value?.trim()) {
          setTimeout(() => el.focus(), 30);
          return;
        }
      }
      return;
    }

    // Row filled — go next row col 0
    nextCol = 0;
    nextRow = curRow + 1;
  }

  // Next row doesn't exist yet — create it then focus
  if (nextRow >= totalRows) {
    onLastCell?.();                          // addRow()
    setTimeout(() => {
      inputRefs.current[nextRow]?.[0]?.focus(); // ✅ longer delay — wait for render
    }, 100);                                 // 100ms so new row renders first
    return;
  }

  // Normal — focus next cell
  setTimeout(() => {
    inputRefs.current[nextRow]?.[nextCol]?.focus();
  }, 30);
}

// ─── 7. SHARED INLINE STYLES ─────────────────────────────────────────────────

/** Pop-in animation + active-select styles (injected once per page load) */
if (typeof document !== "undefined" && !document.getElementById("cmActiveSelStyle")) {
  const s = document.createElement("style");
  s.id = "cmActiveSelStyle";
  s.textContent = `
    @keyframes cmPopIn {
      from { transform: scale(0.88); opacity: 0; }
      to   { transform: scale(1);    opacity: 1; }
    }
    .cm-active-sel {
      text-align: center;
      font-size: 16px;
      padding: 2px 4px;
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      background: #f8fafc;
      cursor: pointer;
      width: 62px;
    }
    .cm-active-sel:focus { outline: 2px solid #3b82f6; }
  `;
  document.head.appendChild(s);
}

export const modalStyles = {
  overlay: { position:"fixed", inset:0, background:"rgba(10,20,40,0.55)", backdropFilter:"blur(2px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 },
  modal:   { background:"#fff", borderRadius:"10px", padding:"28px 32px 22px", minWidth:"280px", maxWidth:"360px", textAlign:"center", boxShadow:"0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)", border:"1px solid #e2e8f0", animation:"cmPopIn 0.15s ease" },
  icon:    { width:"40px", height:"40px", borderRadius:"50%", background:"linear-gradient(135deg,#3b82f6,#1d4ed8)", color:"#fff", fontSize:"20px", fontWeight:"700", lineHeight:"40px", margin:"0 auto 14px" },
  msg:     { fontSize:"14px", color:"#1e293b", fontWeight:"500", margin:"0 0 20px", lineHeight:"1.5" },
  btns:    { display:"flex", gap:"10px", justifyContent:"center" },
  btn:     { padding:"7px 26px", borderRadius:"6px", border:"none", fontSize:"13px", fontWeight:"600", cursor:"pointer", outline:"none" },
  yes:     { background:"linear-gradient(135deg,#22c55e,#16a34a)", color:"#fff", boxShadow:"0 2px 6px rgba(34,197,94,0.35)" },
  no:      { background:"#f1f5f9", color:"#475569", border:"1px solid #cbd5e1" },
};

// ─── 8. CONFIRM MODAL COMPONENT ───────────────────────────────────────────────
export function ConfirmModal({ message, onYes, onNo }) {
  const yesBtnRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => yesBtnRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") { e.preventDefault(); onNo(); } };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onNo]);

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.modal} role="dialog" aria-modal="true">
        <div style={modalStyles.icon}>?</div>
        <p style={modalStyles.msg}>{message}</p>
        <div style={modalStyles.btns}>
          <button ref={yesBtnRef} style={{ ...modalStyles.btn, ...modalStyles.yes }} onClick={onYes}>✔ Yes</button>
          <button style={{ ...modalStyles.btn, ...modalStyles.no }} onClick={onNo}>✘ No</button>
        </div>
      </div>
    </div>
  );
}

// ─── 9. useConfirm HOOK ───────────────────────────────────────────────────────
/**
 * Returns { confirm, ConfirmUI }.
 * Usage:
 *   const { confirm, ConfirmUI } = useConfirm();
 *   const ok = await confirm("Are you sure?");
 */

export function useConfirm() {
  const [conf, setConf] = useState(null);
  const confirm   = useCallback((message) => new Promise((resolve) => setConf({ message, resolve })), []);
  const handleYes = useCallback(() => { conf?.resolve(true);  setConf(null); }, [conf]);
  const handleNo  = useCallback(() => { conf?.resolve(false); setConf(null); }, [conf]);
  const ConfirmUI = conf
    ? <ConfirmModal message={conf.message} onYes={handleYes} onNo={handleNo} />
    : null;
  return { confirm, ConfirmUI };
}

// ─── 10. useToast HOOK ────────────────────────────────────────────────────────
/**
 * Returns { toast, toasts }.
 * Render <ToastList toasts={toasts} /> at the bottom of your component.
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

/** Companion render component for useToast */
export function ToastList({ toasts }) {
  return (
    <div className="toasts">
      {toasts.map(t => (
        <div key={t.id} className={`toast${t.isErr ? " err" : ""}`}>{t.msg}</div>
      ))}
    </div>
  );
}
