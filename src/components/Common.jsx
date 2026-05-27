// ─────────────────────────────────────────────────────────────────────────────
//  Common.jsx  (CashierCommon)
//  Shared utilities, API helpers, hooks, and UI components
//  used across all Cashier/Master pages.
//
//  CHANGELOG (TransactionPassword migration):
//  • Added TransactionPassword API endpoint constants
//  • Added editPassword() centralised helper
//    → removes all try/catch + fetch boilerplate from TransactionPassword.jsx
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";

// ─── 1. LOCAL-STORAGE HELPERS ─────────────────────────────────────────────────
export const getStr   = (k) => localStorage.getItem(k) || "";
export const getLocal = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

// ─── 2. BASE URL ──────────────────────────────────────────────────────────────
export const BASE_URL = "http://localhost:64215";

// ─── 3. CASHIER API ENDPOINT CONSTANTS ───────────────────────────────────────
export const CashierSelect = "/api/CashierApp/SelectCashier";
export const CashierInsert = "/api/CashierApp/InsertCashier";
export const CashierDelete = "/api/CashierApp/DeleteCashier";
export const SelectCounter = "/api/CashierApp/SelectCounter_local";

// ─── 4. TRANSACTION PASSWORD API ENDPOINT CONSTANTS ──────────────────────────
//  Centralised here so TransactionPassword.jsx only imports CC.Txn* names
//  and never constructs URL strings itself.
export const TxnSelectPassword = "/api/LoginApp/SelectTransactionPassword";
export const TxnUpdatePassword = "/api/LoginApp/UpdateTransactionPassword";
export const TxnEditPassword   = "/api/LoginApp/EditPassword";

// ─── 5. REPACKING MASTER API ENDPOINT CONSTANTS ───────────────────────────────
//  Centralised here so RepackingMaster.jsx imports CC.Repacking* names only
//  and never constructs URL strings itself.
export const RepackingMaxNo      = "/api/RepackingMasterApp/MaxRepackingNo";
export const RepackingInsert     = "/api/RepackingMasterApp/InsertRepackingMaster";
export const RepackingDelete     = "/api/RepackingMasterApp/DeleteRepackingMaster";
export const RepackingEdit       = "/api/RepackingMasterApp/EditRepackingMaster";
export const RepackingSelect     = "/api/RepackingMasterApp/SelectRepackingMaster";
//RepackingItemMaster
// export const RepackingCombo      = "/api/RepackingMasterApp/SelectRepackingMasterItem";
export const RepackingCombo      = "/api/RepackingMasterApp/RepackingItemMaster";
export const ItemByCode          = "/api/ItemMasterApp/SelectItemMasterbyCodeId";
  export const RepackingEditPwd    = "/api/LoginApp/EditPassword";

// ─── 6. AUTH HEADERS (token + user identity) ──────────────────────────────────
//  Single source of truth — every fetch in the app must go through
//  api() / insertapi() / editPassword() which all call authHeaders().
//  No component should call localStorage.getItem("token") directly.
export const authHeaders = () => ({
  "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
  "Userid":        localStorage.getItem("userid")     || "0",
  "Profile":       localStorage.getItem("Profile")    || "Admin",
  "LoginCheck":    localStorage.getItem("LoginCheck") || "1",
});

// ─── 6. URL BUILDER ───────────────────────────────────────────────────────────
//  All fetch calls must go through mkUrl so BASE_URL is always prepended.
//  No component should concatenate BASE_URL itself.
const mkUrl = (path) => BASE_URL + path;

// ─── 7. SESSION / COMPANY VARIABLES ──────────────────────────────────────────
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

// ─── 8. API HELPERS ───────────────────────────────────────────────────────────

/**
 * api()
 * General-purpose POST (with optional query-string params).
 * Normalises IsSuccess → ok, Data1 → data, Message → message.
 * Handles 406 / 404 / 500 / empty-response / JSON-parse errors centrally.
 *
 * Usage: await CC.api(path, bodyObject, extraHeaders?, queryParams?)
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

    // ── Standard HTTP error handling ─────────────────────────────────────────
    if (res.status === 406) {
      alert("Already Login Another User Please Login Again!!!");
      window.location.href = "/Login";
      return { ok: false };
    }
    if (res.status === 404) return { ok: false, _http404: true, message: `404: ${fullUrl}` };
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
 * insertapi()
 * Insert / update POST — returns raw parsed JSON (IsSuccess / Data2 conventions).
 * All auth headers, BASE_URL, JSON stringify, and network errors handled here.
 *
 * Usage: await CC.insertapi(path, bodyObject, extraHeaders?)
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

/**
 * deleteapi()
 * Delete POST — identical contract to insertapi() but semantically labelled.
 * Returns raw parsed JSON; all auth headers and BASE_URL handled here.
 *
 * Usage: await CC.deleteapi(path, bodyObject, extraHeaders?)
 */
export const deleteapi = async (path, body = null, extraHeaders = {}) => {
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

/**
 * editPassword()
 * Dedicated helper for the Transaction Password verification modal.
 * Centralises the /api/LoginApp/EditPassword call so TransactionPassword.jsx
 * contains ZERO fetch / auth / BASE_URL logic.
 *
 * @param {object} payload  - { password, type, Comid }
 *   type values: "EditPassword" | "FormConfig" | "AdminPower"
 * @returns {{ ok: boolean, message?: string }}
 *
 * Usage (TransactionPassword.jsx):
 *   const res = await CC.editPassword({ password: pwdValue, type: typeStr, Comid: sess.Comid });
 *   if (res.ok) { ... } else { showError(res.message) }
 */
export const editPassword = async ({ password, type, Comid }) => {
  try {
    const qs = new URLSearchParams({
      password: String(password),
      type: String(type),
      Comid: String(Comid),
    }).toString();

    const res = await fetch(
      mkUrl(`${TxnEditPassword}?${qs}`),
      {
        method: "POST",
        headers: {
          ...authHeaders(),
        },
      }
    );

    // ── HTTP error handling ─────────────────────────────
    if (res.status === 406) {
      alert("Already Login Another User Please Login Again!!!");
      window.location.href = "/Login";
      return { ok: false };
    }

    if (res.status === 404) {
      return {
        ok: false,
        message: "API Not Found",
      };
    }

    const text = await res.text();

    if (!text.trim()) {
      return {
        ok: false,
        message: "Empty response",
      };
    }

    try {
      const j = JSON.parse(text);

      if (j.IsSuccess !== undefined && j.ok === undefined)
        j.ok = j.IsSuccess;

      if (j.Message !== undefined && j.message === undefined)
        j.message = j.Message;

      return j;
    } catch {
      return {
        ok: false,
        message: text,
      };
    }
  } catch (err) {
    return {
      ok: false,
      message: err.message,
    };
  }
};

/**
 * repackingEditPassword()
 * Centralised password-verification helper for RepackingMaster.
 * Uses the MVC-style /Login/EditPassword route (no /api/ prefix).
 * Wraps the call so RepackingMaster.jsx has ZERO fetch/auth/BASE_URL logic.
 *
 * @param {object} opts - { password, type, Comid }
 *   type: "EditPassword" | "FormConfig" | "AdminPower"
 * @returns {{ ok: boolean, message?: string }}
 *
 * Usage (RepackingMaster.jsx):
 *   const res = await CC.repackingEditPassword({ password: pwdValue, type: "EditPassword", Comid: sess.Comid });
 *   if (res.ok) { ... } else { alert("Invalid Password !!!."); }
 */
// export const repackingEditPassword = async ({ password, type, Comid }) => {
//   return api(TxnEditPassword, null, {}, { password, type, Comid });
// };
export const repackingEditPassword = ({ password, type, Comid }) =>
  api(TxnEditPassword, null, {}, { password, type, Comid });
// ─── 9. MISC HELPERS ──────────────────────────────────────────────────────────
/** Generates a unique row key */
export const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36);

/**
 * applyUppercase()
 * Converts an input value to UPPERCASE while preserving the cursor position.
 * Usage: onChange={e => CC.applyUppercase(e, val => updateCell(idx, "Field", val))}
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

/**
 * handleEnterNext()
 * Moves focus to the next visible, enabled input/select/textarea in the grid.
 * Usage: onKeyDown={e => CC.handleEnterNext(e, inputRefs, idx, colIdx, totalCols, totalRows, addRow, grid, rowValidator)}
 */
export function handleEnterNext(e, inputRefs, curRow, curCol, totalCols, totalRows, onLastCell, grid, rowValidator) {
  if (e.key !== "Enter") return;
  e.preventDefault();

  let nextRow = curRow;
  let nextCol = curCol + 1;

  // Last column reached
  if (nextCol >= totalCols) {
    const currentRow = grid[curRow];
    const isFilled   = rowValidator(currentRow);

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
    onLastCell?.();
    setTimeout(() => { inputRefs.current[nextRow]?.[0]?.focus(); }, 100);
    return;
  }

  // Normal — focus next cell
  setTimeout(() => { inputRefs.current[nextRow]?.[nextCol]?.focus(); }, 30);
}

// ─── 10. SHARED INLINE STYLES ─────────────────────────────────────────────────
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

// ─── 11. CONFIRM MODAL COMPONENT ──────────────────────────────────────────────
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

// ─── 12. useConfirm HOOK ──────────────────────────────────────────────────────
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

// ─── 13. useToast HOOK ────────────────────────────────────────────────────────
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