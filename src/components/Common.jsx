// ─────────────────────────────────────────────────────────────────────────────
//  Common.jsx  (CashierCommon)
//  Shared utilities, API helpers, hooks, and UI components
//  used across all Cashier/Master pages.
//
//  CHANGELOG:
//  • Added TransactionPassword API endpoint constants
//  • Added editPassword() centralised helper
//    → removes all try/catch + fetch boilerplate from TransactionPassword.jsx
//  • Added RateChange API endpoint constants
//    → RateChangeSelect, RateChangeUpdate, RateChangeItemSelect, RateChangeItemByCode
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


// Add these to section 5 (or the relevant API section) in Common.jsx
export const ASelectCompanySetting = "/api/loginApp/SelectCompanySetting";
export const UpdateCompanySetting  = "/api/loginApp/UpdateCompanySetting";
export const ScriptUpdate          = "/api/loginApp/UpdateScript"; // Assuming this exists based on your code
// ─── 4. TRANSACTION PASSWORD API ENDPOINT CONSTANTS ──────────────────────────
export const TxnSelectPassword = "/api/LoginApp/SelectTransactionPassword";
export const TxnUpdatePassword = "/api/LoginApp/UpdateTransactionPassword";
export const TxnEditPassword   = "/api/LoginApp/EditPassword";

// ─── Department ───────────────────────────────────────────────────────────────
export const DepartmentSelect = "/api/DepartmentApp/SelectDepartment";
export const DepartmentInsert = "/api/DepartmentApp/InsertDepartment";
export const DepartmentDelete = "/api/DepartmentApp/DeleteDepartment";

// ─── 5. REPACKING MASTER API ENDPOINT CONSTANTS ───────────────────────────────
export const RepackingMaxNo      = "/api/RepackingMasterApp/MaxRepackingNo";
export const RepackingInsert     = "/api/RepackingMasterApp/InsertRepackingMaster";
export const RepackingDelete     = "/api/RepackingMasterApp/DeleteRepackingMaster";
export const RepackingEdit       = "/api/RepackingMasterApp/EditRepackingMaster";
export const RepackingSelect     = "/api/RepackingMasterApp/SelectRepackingMaster";
export const RepackingCombo      = "/api/RepackingMasterApp/RepackingItemMaster";
export const ItemByCode          = "/api/ItemMasterApp/SelectItemMasterbyCodeId";
export const RepackingEditPwd    = "/api/LoginApp/EditPassword";

// ─── Brand Master ─────────────────────────────────────────────────────────────
export const BrandSelect = "/api/BrandApp/SelectBrand";
export const BrandInsert = "/api/BrandApp/InsertBrand";
export const BrandDelete = "/api/BrandApp/DeleteBrand";


// ─────────────────────────────────────────────────────────────────────────────
//  ADD THESE CONSTANTS TO YOUR EXISTING Common.jsx
//  Place after the existing CashierDelete line
// ─────────────────────────────────────────────────────────────────────────────

// ─── SALE API CONSTANTS ───────────────────────────────────────────────────────
const SaleMaxNo           = "/api/SaleApp/MaxSaleNo";
const SaleInsertUrl       = "/api/SaleApp/InsertSale";
const SaleEditUrl         = "/api/SaleApp/EditSale";
const SaleSelectUrl       = "/api/SaleApp/SelectSaleV7";
const SaleDeleteUrl       = "/api/SaleApp/DeleteSale";
const BillHoldSelectUrl   = "/api/SaleApp/BillHoldName";
const BillHoldInsertUrl   = "/api/SaleApp/BillHold";
const BillUnHoldUrl       = "/api/SaleApp/BillUnHold";
const BillHoldDeleteUrl   = "/api/SaleApp/BillHoldDelete";
const SelectItemByCodeUrl = "/api/ItemMasterApp/SelectItemMasterbyCodeId";
const ProductListUrl      = "/api/ItemMasterApp/GetProductListV7";
const GetCustomerUrl      = "/api/SupplierApp/SelectSupplierAll";
const SalesManSelectUrl   = "/api/SalesManApp/SelectSalesMan_V7";
const SelectCardMasterUrl = "/api/SaleApp/SelectSaleType";
const CRMBalanceUrl       = "/api/SalesReportApp/CRMBalanceReport";

const F5SelectUrl         = "/api/SaleApp/SelectSaleV7";
const VisibleColumnsUrl   = "/Login/VisibleColumns";
const FocusColumnsUrl     = "/Login/FocusColumns";
const CurrentBalanceUrl = "/SupplierApp/CurrentBalance";
const SelectExpiryByIdUrl = "/api/ItemMasterApp/SelectExpStock"; // adjust to your actual endpoint

// ─── ITEM MASTER (for product search in grid) ────────────────────────────────
export const SelectItemMasterbyId = "/api/ItemMasterApp/SelectItemMasterbyCodeId";
export const SelectExpDate        = "/api/ItemMasterApp/SelectExpStock";

// ─── CUSTOMER / SUPPLIER ─────────────────────────────────────────────────────
export const GetSupplierAll       = "/api/SupplierApp/SelectSupplierAll_v7";   // AccountType=CUSTOMER or SUPPLIER
export const GetSupplier          = "/api/SupplierApp/SelectSupplierAll_v7";
export const CurrentBalance       = "/api/SupplierApp/CurrentBalance";
export const SelectCustomerSaleRate = "/api/SupplierApp/InsertCustomerSaleRate"; // CustomerwiseSaleRate

// ─── SALESMAN ────────────────────────────────────────────────────────────────
export const SalesManSelectV7     = "/api/SalesManApp/SelectSalesMan_V7";

// ─── CARD MASTER (Payment Types) ─────────────────────────────────────────────

export const SelectSaleType       = "/api/SaleApp/SelectSaleType";  // alias


// ─── CRM ─────────────────────────────────────────────────────────────────────
export const CRMBalance           = "/api/SalesReportApp/CRMBalanceReport";

// ─── LOGIN PASSWORD (for F6 Edit / F9 Delete password) ───────────────────────
export const LoginPasswordUrl     = "/api/LoginApp/EditPassword";

        //BankApp
        //public static string BankMaxNo = "/CashApp/MaxAdjustmentNo";
        export const BankDateSelect = "/api/BankApp/SelectBankDate";
        export const BankAllSelect = "/api/BankApp/SelectBankList";
        export const BankSelect = "/api/BankApp/SelectBank";
        export const BankInsert = "/api/BankApp/InsertBank";
        export const BankDelete = "/api/BankApp/DeleteBank";

        //CardMasterApp
        export const InsertCardMaster = "/api/CardMasterApp/InsertCardMaster";
        export const SelectCardMaster = "/api/CardMasterApp/SelectCardMaster";
        export const DeleteCardMaster = "/api/CardMasterApp/DeleteCardMaster";

        //AccountGroupApp
        export const SelectAccountGroup = "/api/AccountGroupApp/SelectAccountGroup";
        export const InsertAccountGroup = "/api/AccountGroupApp/InsertAccountGroup";
        export const DeleteAccountGroup = "/api/AccountGroupApp/DeleteAccountGroup";
        //UOM
        export const UOMSelect = "/api/UOMApp/SelectUOM";
        export const UOMInsert = "/api/UOMApp/InsertUOM";
        export const UOMDelete = "/api/UOMApp/DeleteUOM";
  //Salesman
  export const SalesManSelect = "/api/SalesManApp/SelectSalesMan"; 
  export const SalesManInsert = "/api/SalesManApp/InsertSalesMan";
  export const SalesManDelete = "/api/SalesManApp/DeleteSalesMan";
 

          // ─── Supplier Master API Links ────────────────────────────────────────────────
export const SupplierMasterSelect = "/api/SupplierApp/SelectSupplier";
export const SupplierMasterInsert = "/api/SupplierApp/InsertSupplier";
export const SupplierMasterDelete = "/api/SupplierApp/DeleteSupplier";

  //SizeMaster

  export const SizeSelect = "/api/SizeMasterApp/SelectSizeMaster";
  export const SizeInsert = "/api/SizeMasterApp/InsertSizeMaster";
  export const SizeDelete = "/api/SizeMasterApp/DeleteSizeMaster";
 
  //ColorMaster
  export const SelectColor = "/api/ColorMasterApp/SelectColorMaster";
  export const InsertColor = "/api/ColorMasterApp/InsertColorMaster";
  export const DeleteColor = "/api/ColorMasterApp/DeleteColorMaster";
 
  //ModelMaster
  export const SelectModel = "/api/ColorMasterApp/SelectColorMaster";
  export const InsertModel = "/api/ColorMasterApp/InsertColorMaster";
  export const DeleteModel = "/api/ColorMasterApp/DeleteColorMaster";

// ─── 6. AUTH HEADERS (token + user identity) ──────────────────────────────────
export const authHeaders = () => ({
  "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
  "Userid":        localStorage.getItem("userid")     || "0",
  "Profile":       localStorage.getItem("Profile")    || "Admin",
  "LoginCheck":    localStorage.getItem("LoginCheck") || "1",
});
console.log(localStorage.getItem("token"));
export const loadSalesmanData = async (MComid) => {
  try {
    const res = await fetch(
      mkUrl(SalesManSelect) + `?Comid=${Number(MComid)}`,
      { method: "POST", headers: authHeaders() }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data)       ? data
         : Array.isArray(data.data)  ? data.data
         : Array.isArray(data.Data1) ? data.Data1
         : [];
  } catch (e) {
    console.error("loadSalesmanData error:", e);
    return [];
  }
};
export const ValNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
export const NullToString = (v) => (v == null ? "" : String(v));

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
// export const buildSession = (pageName) => {
//   try {
//     const main0       = (getLocal("Mainsetting") || [{}])[0] || {};
//     const Comid       = getStr("Comid")    || "1";
//     const MComid      = getStr("MComid")   || Comid;
//     const IdComList   = getStr("IdComList") || Comid;
//     const MirrorTable = getStr("MirrorTableOnline") || "0";
//     return {
//       Comid:    main0.CommonCompany ? MComid : Comid,
//       MComid,
//       IdComList,
//       MirrorTable,
//       menudata: (getLocal("menulist") || []).filter(o => o.PageName === pageName),
//     };
//   } catch {
//     return { Comid: "1", MComid: "1", IdComList: "1", MirrorTable: "0", menudata: [] };
//   }
// };

// ─── 8. API HELPERS ───────────────────────────────────────────────────────────
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

      // ── Purchase-specific settings from Mainsetting ──
      batchstockstatus:       String(main0.batchstockstatus       ?? 0),
   
      ItemMasterRateUpdate:   String(main0.ItemMasterRateUpdate   ?? false),
      Commoncompany:          String(main0.CommonCompany          ?? false),
      CommoncompanyDiffStock: String(main0.CommonCompanyDiffStock ?? false),
      SupplierMulitipleAllow: String(main0.SupplierMulitipleAllow ?? false),
      MulipleMRP:             String(main0.MulipleMRP             ?? false),
      BatchPerfix:            String(main0.BatchPerfix            ?? ""),
      BatchDigit:             String(main0.BatchNoDigit             ?? 0),
      LocalDB:                String(main0.LocalDB                ?? 0),
    };
  } catch {
    return { Comid: "1", MComid: "1", IdComList: "1", MirrorTable: "0", menudata: [],
             batchstockstatus: "0", ItemMasterRateUpdate: "false",
             Commoncompany: "false", CommoncompanyDiffStock: "false",
             SupplierMulitipleAllow: "false", MulipleMRP: "false",
             BatchPerfix: "", BatchDigit: "0", LocalDB: "0" };
  }
};
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

    if (res.status === 406) {
      return { ok: false, _dualLogin: true };
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

    if (res.status === 406) return { ok: false, _dualLogin: true };
    if (res.status === 500) {
      const t = await res.text();
      // Server returned HTML error page — extract meaningful message
      const match = t.match(/<i>(.*?)<\/i>/);
      const msg = match ? match[1] : (t.slice(0, 300));
      console.error("500 InsertAPI:", msg);
      return { ok: false, IsSuccess: false, Message: msg, message: msg };
    }

    const text = await res.text();
    if (!text.trim()) return { ok: false, IsSuccess: false, Message: "Empty response", message: "Empty response" };

    try {
      const j = JSON.parse(text);
      if (j.IsSuccess !== undefined && j.ok      === undefined) j.ok      = j.IsSuccess;
      if (j.Message   !== undefined && j.message === undefined) j.message = j.Message;
      return j;
    } catch {
      return { ok: false, IsSuccess: false, message: text.slice(0, 300) };
    }
  } catch (err) {
    return { ok: false, _netErr: true, message: err.message };
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
 */
export const editPassword = async ({ password, type, Comid }) => {
  try {
    const qs = new URLSearchParams({
      password: String(password),
      type:     String(type),
      Comid:    String(Comid),
    }).toString();

    const res = await fetch(mkUrl(`${TxnEditPassword}?${qs}`), {
      method: "POST",
      headers: { ...authHeaders() },
    });

    if (res.status === 406) {
      alert("Already Login Another User Please Login Again!!!");
      return { ok: false, _dualLogin: true };
    }
    if (res.status === 404) return { ok: false, message: "API Not Found" };

    const text = await res.text();
    if (!text.trim()) return { ok: false, message: "Empty response" };

    try {
      const j = JSON.parse(text);
      if (j.IsSuccess !== undefined && j.ok      === undefined) j.ok      = j.IsSuccess;
      if (j.Message   !== undefined && j.message === undefined) j.message = j.Message;
      return j;
    } catch {
      return { ok: false, message: text };
    }
  } catch (err) {
    return { ok: false, message: err.message };
  }
};

/**
 * repackingEditPassword()
 * Centralised password-verification helper for RepackingMaster.
 */
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

  if (nextCol >= totalCols) {
    const currentRow = grid[curRow];
    const isFilled   = rowValidator(currentRow);

    if (!isFilled) {
      for (let c = 0; c < totalCols; c++) {
        const el = inputRefs.current[curRow]?.[c];
        if (el && !el.value?.trim()) {
          setTimeout(() => el.focus(), 30);
          return;
        }
      }
      return;
    }

    nextCol = 0;
    nextRow = curRow + 1;
  }

  if (nextRow >= totalRows) {
    onLastCell?.();
    setTimeout(() => { inputRefs.current[nextRow]?.[0]?.focus(); }, 100);
    return;
  }

  setTimeout(() => { inputRefs.current[nextRow]?.[nextCol]?.focus(); }, 30);
}

// ─── 10. SHARED INLINE STYLES ─────────────────────────────────────────────────
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