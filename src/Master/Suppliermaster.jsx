import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./SupplierMaster.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const mkUrl    = (path) => (path.startsWith("/") ? path : "/" + path);
const getStr   = (k)    => localStorage.getItem(k) || "";
const getLocal = (k)    => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

const authHeaders = () => ({
  "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
  "Userid":        localStorage.getItem("userid")     || "0",
  "Profile":       localStorage.getItem("Profile")    || "Admin",
  "LoginCheck":    localStorage.getItem("LoginCheck") || "1",
});

const api = async (path, body = null, extraHeaders = {}, queryParams = null) => {
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
      headers: { "Content-Type": "application/json; charset=utf-8", ...authHeaders(), ...extraHeaders },
      body: body !== null ? JSON.stringify(body) : null,
    });
    if (res.status === 406) { alert("Already Login Another User Please Login Again!!!"); window.location.href = "/Login"; return { ok: false }; }
    if (res.status === 404) return { ok: false, _http404: true, message: `404: ${fullUrl}` };
    if (res.status === 500) { const t = await res.text(); console.error(`500 on ${fullUrl}:`, t.slice(0, 500)); return { ok: false, message: "Server error 500" }; }
    const text = await res.text();
    if (!text.trim()) return { ok: false, message: "Empty response" };
    try {
      const j = JSON.parse(text);
      if (j.IsSuccess !== undefined && j.ok      === undefined) j.ok      = j.IsSuccess;
      if (j.Data1     !== undefined && j.data    === undefined) j.data    = j.Data1;
      if (j.Message   !== undefined && j.message === undefined) j.message = j.Message;
      return j;
    } catch { return { ok: false, message: text }; }
  } catch (err) { return { ok: false, _netErr: true, message: err.message }; }
};

const insertApi = async (path, body = null, extraHeaders = {}) => {
  try {
    const res = await fetch(mkUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", ...authHeaders(), ...extraHeaders },
      body: body !== null ? JSON.stringify(body) : null,
    });
    const text = await res.text();
    if (!text.trim()) return { ok: false, message: "Empty response" };
    const j = JSON.parse(text);
    if (j.IsSuccess !== undefined && j.ok      === undefined) j.ok      = j.IsSuccess;
    if (j.Data1     !== undefined && j.data    === undefined) j.data    = j.Data1;
    if (j.Message   !== undefined && j.message === undefined) j.message = j.Message;
    return j;
  } catch (err) { return { ok: false, message: err.message }; }
};

const vn  = (v) => parseFloat(v) || 0;
const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

// ─── Uppercase helper ─────────────────────────────────────────────────────────
function applyUppercase(e, onChange) {
  const el    = e.target;
  const start = el.selectionStart;
  const end   = el.selectionEnd;
  const upper = el.value.toUpperCase();
  onChange(upper);
  requestAnimationFrame(() => {
    if (el && document.activeElement === el) {
      el.setSelectionRange(start, end);
    }
  });
}

// ─── Shared style injection ───────────────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("smActiveSelStyle")) {
  const s = document.createElement("style");
  s.id = "smActiveSelStyle";
  s.textContent = `
    @keyframes smPopIn {
      from { transform: scale(0.88); opacity: 0; }
      to   { transform: scale(1);    opacity: 1; }
    }
    .sm-active-sel {
      text-align: center;
      font-size: 16px;
      padding: 2px 2px;
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      background: #f8fafc;
      cursor: pointer;
      width: 56px;
    }
    .sm-active-sel:focus { outline: 2px solid #3b82f6; }

    /* ── Salesman picker modal ── */
    .sm-picker-overlay {
      position: fixed; inset: 0;
      background: rgba(10,20,40,0.50);
      backdrop-filter: blur(2px);
      display: flex; align-items: center; justify-content: center;
      z-index: 9998;
    }
    .sm-picker-box {
      background: #fff;
      border-radius: 8px;
      width: 280px;
      max-height: 480px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 16px 48px rgba(0,0,0,.3);
      overflow: hidden;
      animation: smPopIn 0.15s ease;
    }
    .sm-picker-hdr {
      background: #1a2e4a;
      color: #fff;
      padding: 9px 14px;
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .sm-picker-hdr button {
      background: none; border: none; color: #fff;
      font-size: 16px; cursor: pointer; line-height: 1;
    }
    .sm-picker-search {
      padding: 8px 10px;
      border-bottom: 1px solid #e5e7eb;
    }
    .sm-picker-search input {
      width: 100%; box-sizing: border-box;
      border: 1px solid #cbd5e1; border-radius: 5px;
      padding: 5px 8px; font-size: 13px; outline: none;
    }
    .sm-picker-search input:focus { border-color: #3b82f6; }
    .sm-picker-list {
      flex: 1; overflow-y: auto;
    }
    .sm-picker-item {
      padding: 7px 12px;
      font-size: 13px;
      color: #1a2e4a;
      cursor: pointer;
      border-bottom: 1px solid #f1f5f9;
    }
    .sm-picker-item:hover,
    .sm-picker-item.focused { background: #e8f0fe; }
    .sm-picker-empty {
      padding: 16px 12px;
      font-size: 12px;
      color: #94a3b8;
      text-align: center;
    }
  `;
  document.head.appendChild(s);
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────
function ConfirmModal({ message, onYes, onNo }) {
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
          <button style={{ ...modalStyles.btn, ...modalStyles.no }}  onClick={onNo}>✘ No</button>
        </div>
      </div>
    </div>
  );
}

const modalStyles = {
  overlay: { position:"fixed", inset:0, background:"rgba(10,20,40,0.55)", backdropFilter:"blur(2px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 },
  modal:   { background:"#fff", borderRadius:"10px", padding:"28px 32px 22px", minWidth:"280px", maxWidth:"360px", textAlign:"center", boxShadow:"0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)", border:"1px solid #e2e8f0", animation:"smPopIn 0.15s ease" },
  icon:    { width:"40px", height:"40px", borderRadius:"50%", background:"linear-gradient(135deg,#3b82f6,#1d4ed8)", color:"#fff", fontSize:"20px", fontWeight:"700", lineHeight:"40px", margin:"0 auto 14px" },
  msg:     { fontSize:"14px", color:"#1e293b", fontWeight:"500", margin:"0 0 20px", lineHeight:"1.5" },
  btns:    { display:"flex", gap:"10px", justifyContent:"center" },
  btn:     { padding:"7px 26px", borderRadius:"6px", border:"none", fontSize:"13px", fontWeight:"600", cursor:"pointer", outline:"none" },
  yes:     { background:"linear-gradient(135deg,#22c55e,#16a34a)", color:"#fff", boxShadow:"0 2px 6px rgba(34,197,94,0.35)" },
  no:      { background:"#f1f5f9", color:"#475569", border:"1px solid #cbd5e1" },
};

// ─── useConfirm hook ──────────────────────────────────────────────────────────
function useConfirm() {
  const [conf, setConf] = useState(null);
  const confirm = useCallback((message) => new Promise((resolve) => setConf({ message, resolve })), []);
  const handleYes = useCallback(() => { conf?.resolve(true);  setConf(null); }, [conf]);
  const handleNo  = useCallback(() => { conf?.resolve(false); setConf(null); }, [conf]);
  const ConfirmUI = conf ? <ConfirmModal message={conf.message} onYes={handleYes} onNo={handleNo} /> : null;
  return { confirm, ConfirmUI };
}

// ─── SalesmanPicker ───────────────────────────────────────────────────────────
// Mirrors jQuery SaleManWindow + SalesManList + gridSaleManWindow logic exactly:
//   - Shows a search input (like #inputD)
//   - Filters the list as you type (like the 'input' handler on #inputD)
//   - Arrow-down / Enter from search moves focus to list (like key==40 / key==13 in #inputD)
//   - Enter on a list item commits selection (like key==13 in gridSaleManWindow keydown)
//   - Sets both SalesName (textField) and SalemanRefid (valueField) on the row
//   - Escape closes without change
function SalesmanPicker({ salesmanList, initialSearch = "", onSelect, onClose }) {
  const [search,       setSearch]       = useState(initialSearch);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const searchRef = useRef(null);
  const listRef   = useRef(null);

  // Filter list — mirrors jQuery 'contains' filter on SalesManName
  const filtered = salesmanList.filter(s =>
    !search.trim() ||
    (
      s.SalesManName ||
      s.salesmanname ||
      s.SalesmanName ||
      ""
    )
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  useEffect(() => {
    // Pre-populate search with current cell value (mirrors #inputD val + trigger('input'))
    setTimeout(() => {
      searchRef.current?.focus();
      searchRef.current?.select();
    }, 60);
  }, []);

  // Reset focused index when filter changes
  useEffect(() => { setFocusedIndex(0); }, [search]);

  // Scroll focused item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`.sm-picker-item.focused`);
    el?.scrollIntoView({ block: "nearest" });
  }, [focusedIndex, filtered.length]);

  function commitSelection(item) {
    // Mirrors gridSaleManWindow keydown Enter:
    //   gridSupplier.jqxGrid('setcellvalue', rowindexC, grdSalesManId, Id);
    //   gridSupplier.jqxGrid('setcellvalue', rowindexC, grdSalesMan, SalesManName);
    onSelect({
      SalesManName:
      item.SalesManName ||
      item.salesmanname ||
      item.SalesmanName ||
      "",
      Id:           item.Id           || item.id           || null,
    });
  }

  function onSearchKeyDown(e) {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }

    // Arrow-down: move focus to list (mirrors key==40 in #inputD keydown)
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filtered.length > 0) {
        listRef.current?.querySelector(".sm-picker-item")?.focus();
        setFocusedIndex(0);
      }
      return;
    }

    // Enter on search input (mirrors key==13 in #inputD keydown)
    if (e.key === "Enter") {
      e.preventDefault();
      if (!search.trim()) {
        // Empty search + Enter → close without selecting (mirrors jQuery behaviour)
        onClose();
        return;
      }
      if (filtered.length === 1) {
        commitSelection(filtered[0]);
        return;
      }
      if (filtered.length > 1) {
        // Select first match (mirrors displayrows[0])
        commitSelection(filtered[0]);
        return;
      }
      // No matches — in jQuery this opens SalesManCreate(); here just close
      onClose();
    }
  }

  function onItemKeyDown(e, item, idx) {
    if (e.key === "Escape")    { e.preventDefault(); onClose();              return; }
    if (e.key === "ArrowUp")   {
      e.preventDefault();
      if (idx === 0) { searchRef.current?.focus(); return; }
      setFocusedIndex(idx - 1);
      listRef.current?.querySelectorAll(".sm-picker-item")[idx - 1]?.focus();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (idx < filtered.length - 1) {
        setFocusedIndex(idx + 1);
        listRef.current?.querySelectorAll(".sm-picker-item")[idx + 1]?.focus();
      }
      return;
    }
    if (e.key === "Enter") { e.preventDefault(); commitSelection(item); }
  }

  return (
    <div className="sm-picker-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sm-picker-box" role="dialog" aria-modal="true" aria-label="Select Sales Man">
        <div className="sm-picker-hdr">
          <span>Select Sales Man</span>
          <button onClick={onClose} tabIndex={-1}>✕</button>
        </div>

        {/* Search — mirrors #inputD */}
        <div className="sm-picker-search">
          <input
            ref={searchRef}
            type="text"
            placeholder="Search Sales Man"
            value={search}
            onChange={e => setSearch(e.target.value.toUpperCase())}
            onKeyDown={onSearchKeyDown}
          />
        </div>

        {/* List — mirrors gridSaleManWindow rows */}
        <div className="sm-picker-list" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="sm-picker-empty">No salesman found</div>
          ) : (
            filtered.map((item, idx) => (
              <div
                key={item.Id ?? item.id ?? idx}
                className={`sm-picker-item${focusedIndex === idx ? " focused" : ""}`}
                tabIndex={0}
                onClick={() => commitSelection(item)}
                onKeyDown={e => onItemKeyDown(e, item, idx)}
                onMouseEnter={() => setFocusedIndex(idx)}
              >
                {item.SalesManName || item.salesmanname || ""}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── EDITABLE COLUMNS CONFIG ──────────────────────────────────────────────────
// SalesName column type is "salesman" — handled specially in renderCell.
// All other columns, fields, labels, widths, validation unchanged.
const ALL_COLUMNS = [
  { field: "AccountName",     label: "Supplier Name",   type: "string",        maxLen: 500, width: 180, hidden: false, required: true },
  { field: "Code",            label: "Code",            type: "string",        maxLen: 50,  width: 90,  hidden: false },
  // ── Changed type from "string" to "salesman" — triggers picker on Enter ──
  { field: "SalesName",       label: "Sales Man",       type: "salesman",      maxLen: 200, width: 130, hidden: false },
  { field: "Address1",        label: "Address 1",       type: "string",        maxLen: 500, width: 130, hidden: false },
  { field: "Address2",        label: "Address 2",       type: "string",        maxLen: 500, width: 130, hidden: true  },
  { field: "City",            label: "City",            type: "string",        maxLen: 500, width: 100, hidden: false },
  { field: "Pincode",         label: "Pincode",         type: "int",           maxLen: 8,   width: 80,  hidden: true  },
  { field: "MobileNo",        label: "Mobile No",       type: "string",        maxLen: 50,  width: 110, hidden: false },
  { field: "Phone",           label: "Phone",           type: "string",        maxLen: 50,  width: 90,  hidden: true  },
  { field: "GSTINNo",         label: "GSTIN No",        type: "string",        maxLen: 50,  width: 140, hidden: false },
  { field: "Email",           label: "Email",           type: "string",        maxLen: 100, width: 130, hidden: true  },
  { field: "CreditBillDays",  label: "Credit Days",     type: "int",           maxLen: 8,   width: 80,  hidden: true  },
  { field: "CreditBillLimit", label: "Credit Limit",    type: "float",         maxLen: 18,  width: 100, hidden: true  },
  { field: "OpeningBalance",  label: "Opening Bal",     type: "float",         maxLen: 18,  width: 100, hidden: true  },
  { field: "StateCode",       label: "State Code",      type: "string",        maxLen: 50,  width: 90,  hidden: true  },
  { field: "StateName",       label: "Place of Supply", type: "string",        maxLen: 100, width: 110, hidden: true  },
  { field: "IGSTBill",        label: "GST Type",        type: "select",        options: ["GST","IGST"], width: 90, hidden: false },
  { field: "Active",          label: "Active",          type: "active-select",              width: 70,  hidden: false },
];

// ─── SupplierMaster ───────────────────────────────────────────────────────────
export default function SupplierMaster() {
  const navigate  = useNavigate();
  const toastId   = useRef(0);
  const cellRefs  = useRef({});

  const { confirm, ConfirmUI } = useConfirm();

  // ── Session ────────────────────────────────────────────────────────────────
  const [sess] = useState(() => {
    const main0       = (getLocal("Mainsetting") || [{}])[0] || {};
    const comidRaw    = getStr("Comid")  || "1";
    const MComid      = getStr("MComid") || comidRaw;
    const MirrorTable = getStr("MirrorTableOnline") || "0";
    const IdComList   = getStr("IdComList") || comidRaw;
    const useMain     = !!main0.CommonCompany || !!main0.SupplierCommonCompany || MirrorTable === "1";
    const Comid       = useMain ? MComid : comidRaw;
    const SupplierMulitipleAllow = !!main0.SupplierMulitipleAllow;
    const menudata    = (getLocal("menulist") || []).filter(o => o.PageName === "Supplier");
    const perm        = menudata[0] || { View: 1, Add: 1, Edit: 1, Delete: 1 };
    return { Comid, MComid, IdComList, MirrorTable, SupplierMulitipleAllow, perm };
  });
  const { Comid, MComid, IdComList, MirrorTable, SupplierMulitipleAllow, perm } = sess;

  // ── State ──────────────────────────────────────────────────────────────────
  const [grid,    setGrid]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [selIdx,  setSelIdx]  = useState(null);
  const [toasts,  setToasts]  = useState([]);

  // ── NEW: Salesman list state ───────────────────────────────────────────────
  // Mirrors jQuery: SalesManList() loads once and populates gridSaleManWindow.
  // We load from /SalesMan/SelectSalesMan with MComid (same as jQuery: MComid).
  // API returns array of { Id, SalesManName (or salesmanname), ... }
  const [salesmanList,    setSalesmanList]    = useState([]);
  const [salesmanLoading, setSalesmanLoading] = useState(false);

  // ── NEW: Salesman picker open state ───────────────────────────────────────
  // pickerTarget = { rowIdx, currentName } when picker is open; null when closed.
  const [pickerTarget, setPickerTarget] = useState(null);

  // ── Column settings (F12) ──────────────────────────────────────────────────
  const [colSettings, setColSettings] = useState(() =>
    ALL_COLUMNS.map(c => ({ field: c.field, label: c.label, hidden: c.hidden, width: c.width }))
  );
  const [f12Open, setF12Open] = useState(false);

  const visibleColumns = ALL_COLUMNS.filter(c => {
    const cs = colSettings.find(s => s.field === c.field);
    return cs ? !cs.hidden : !c.hidden;
  }).map(c => {
    const cs = colSettings.find(s => s.field === c.field);
    return { ...c, width: cs?.width ?? c.width };
  });

  const editableFields = visibleColumns.map(c => c.field);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const toast = useCallback((msg, isErr = false) => {
    const id = ++toastId.current;
    setToasts(p => [...p, { id, msg, isErr }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  // ── Focus helper ───────────────────────────────────────────────────────────
  const focusCell = useCallback((rowIdx, field) => {
    setTimeout(() => {
      const el = cellRefs.current[`${rowIdx}_${field}`];
      if (el) { el.focus(); if (el.select) el.select(); }
    }, 40);
  }, []);

  // ── Blank row factory ──────────────────────────────────────────────────────
  const makeNewRow = (name = "") => ({
    _uid:            uid(),
    Id:              null,
    AccountName:     name,
    AccountType:     "SUPPLIER",
    Code:            "",
    SalesName:       "",
    SalemanRefid:    null,   // ← stores selected salesman Id (grdSalesManId)
    Address1:        "",
    Address2:        "",
    City:            "",
    Pincode:         "",
    MobileNo:        "",
    Phone:           "",
    GSTINNo:         "",
    Email:           "",
    OpeningBalance:  "0.00",
    CreditBillDays:  "0",
    CreditBillLimit: "0.00",
    StateName:       "",
    StateCode:       "",
    IGSTBill:        "GST",
    Active:          1,
    EditMode:        1,
  });

  // ── NEW: Load salesman list ────────────────────────────────────────────────
  // Mirrors jQuery SalesManList() → POST /SalesMan/SelectSalesMan { Comid: MComid }
  // Called once on mount, before grid load, so the list is ready when the grid
  // renders and the user presses Enter on the SalesName cell.
  const loadSalesmanList = useCallback(async () => {
    setSalesmanLoading(true);
    // const res = await api("/SalesMan/SelectSalesMan", { Comid: Number(MComid) });
    const res = await fetch(
      `/SalesMan/SelectSalesMan?Comid=${Number(MComid)}`,
      {
        method: "GET",
        headers: {
          ...authHeaders(),
        },
      }
    ).then(r => r.json());
      
   
    
    setSalesmanLoading(false);
    if (res.ok === false && res._http404) {
      // Silently ignore if endpoint not found in this environment
      return;
    }
    // API returns array directly (HTTP 200 with array body from service layer)
    // or wrapped in res.data / res.Data1
    const raw = Array.isArray(res)       ? res      :
                Array.isArray(res.data)  ? res.data :
                Array.isArray(res.Data1) ? res.Data1 : [];
    setSalesmanList(raw);
  }, [MComid]);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const prefill = sessionStorage.getItem("masterPrefill") || "";
    setLoading(true);
    const res = await api("/Supplier/SelectSupplier", null, {}, {
      Comid: Number(Comid), Startindex: -1, PageCount: 20,
      AccountType: "SUPPLIER", Keyword: "", Column: "",
    });
    setLoading(false);
    if (res._http404) { toast("❌ 404 — /Supplier/SelectSupplier not found", true); return; }
    if (res._netErr)  { toast(`❌ Network: ${res.message}`, true); return; }
    if (res.redis === false) { alert("Already Login Another User Please Login Again!!!"); window.location.href = "/Login"; return; }
    if (!res.ok) { toast(`❌ ${res.message || "Failed to load suppliers"}`, true); }

    const rawList = Array.isArray(res.data) ? res.data : Array.isArray(res.Data1) ? res.Data1 : [];
    const existing = rawList.map(r => {

      // DB-la salesman id mattum irundha
      // salesmanList-la irundhu name map pannum
      const salesmanId =
        r.SalemanRefid ??
        r.SalesmanRefid ??
        r.SalesManRefid ??
        null;
    
      const salesmanObj = salesmanList.find(
        s => Number(s.Id ?? s.id) === Number(salesmanId)
      );
    
      return {
        ...r,
        _uid: uid(),
        AccountType: r.AccountType || "SUPPLIER",
    
        // Salesman display name
        SalesName:
          r.SalesName ||
          r.SaleName ||
          r.salesmanname ||
          salesmanObj?.SalesManName ||
          salesmanObj?.salesmanname ||
          "",
    
        // Salesman Id
        SalemanRefid: salesmanId,
    
        OpeningBalance: parseFloat(vn(r.OpeningBalance)).toFixed(2),
        CreditBillLimit: parseFloat(vn(r.CreditBillLimit)).toFixed(2),
        CreditBillDays: String(parseInt(vn(r.CreditBillDays)) || 0),
    
        Active:
          r.Active === 1 || r.Active === true
            ? 1
            : 0,
    
        EditMode: 0,
      };
    });

    const blank = makeNewRow(prefill);
    setGrid([...existing, blank]);
    setSelIdx(existing.length);
    focusCell(existing.length, "AccountName");
    sessionStorage.setItem("masterPrefill", "");
  },[Comid, focusCell, toast, salesmanList]); // eslint-disable-line

  // ── On mount: load salesman list first, then grid data ────────────────────
  // Mirrors jQuery methods.init() → SaleManWindow() runs at init,
  // and SalesManList(grid) is called each time the picker opens.
  // We load the list upfront so there's no delay when picker opens.
  useEffect(() => {
    const init = async () => {
      await loadSalesmanList();
      await loadData();
    };
  
    init();
  }, [loadSalesmanList, loadData]);

  // ── Add row ────────────────────────────────────────────────────────────────
  const addRow = useCallback(() => {
    setGrid(prev => {
      const newRow = makeNewRow();
      const next   = [...prev, newRow];
      const newIdx = next.length - 1;
      setSelIdx(newIdx);
      focusCell(newIdx, "AccountName");
      return next;
    });
  }, [focusCell]); // eslint-disable-line

  const updateCell = useCallback((idx, field, value) => {
    setGrid(prev =>
      prev.map((r, i) => i === idx ? { ...r, [field]: value, EditMode: 1 } : r)
    );
  }, []);

  // ── NEW: Open salesman picker ─────────────────────────────────────────────
  // Mirrors jQuery Enter on grdSalesMan column → opens #SaleManWindow,
  // pre-populates #inputD with current cell value, triggers input filter.
  const openSalesmanPicker = useCallback((rowIdx) => {
    const currentName = grid[rowIdx]?.SalesName || "";
    setPickerTarget({ rowIdx, currentName });
  }, [grid]);

  // ── NEW: Handle salesman selection from picker ────────────────────────────
  // Mirrors jQuery gridSaleManWindow keydown Enter:
  //   gridSupplier.jqxGrid('setcellvalue', rowindexC, grdSalesManId, Id);
  //   gridSupplier.jqxGrid('setcellvalue', rowindexC, grdSalesMan, SalesManName);
  //   then GirdNextCell(...)
  const onSalesmanSelect = useCallback(({ SalesManName, Id }) => {
    if (pickerTarget == null) return;
    const { rowIdx } = pickerTarget;

    setGrid(prev =>
      prev.map((r, i) =>
        i === rowIdx
          ? { ...r, SalesName: SalesManName || "", SalemanRefid: Id ?? null, EditMode: 1 }
          : r
      )
    );

    setPickerTarget(null);

    // After picker closes, move to next cell (mirrors GirdNextCell after salesman select)
    setTimeout(() => {
      setGrid(currentGrid => {
        moveNext(rowIdx, "SalesName", currentGrid);
        return currentGrid;
      });
    }, 60);
  }, [pickerTarget]); // eslint-disable-line

  const onSalesmanPickerClose = useCallback(() => {
    const rowIdx = pickerTarget?.rowIdx;
    setPickerTarget(null);
    // Return focus to the SalesName cell (mirrors jQuery: gridSupplier focus after close)
    if (rowIdx != null) focusCell(rowIdx, "SalesName");
  }, [pickerTarget, focusCell]);

  // ── Keypress validation ────────────────────────────────────────────────────
  function isValidChar(colDef, currentVal, charStr) {
    if (!colDef) return true;
    if (colDef.type === "int")   return /^\d$/.test(charStr);
    if (colDef.type === "float") {
      if (charStr === "." && currentVal.includes(".")) return false;
      return /[\d.]/.test(charStr);
    }
    return true;
  }

  // ── Enter navigation ───────────────────────────────────────────────────────
  const moveNext = useCallback((rowIdx, field, currentGrid) => {
    const colIdx   = editableFields.indexOf(field);
    const rowCount = currentGrid.length;
    if (colIdx === -1) return;

    if (colIdx < editableFields.length - 1) {
      focusCell(rowIdx, editableFields[colIdx + 1]);
    } else {
      if (rowIdx < rowCount - 1) {
        setSelIdx(rowIdx + 1);
        focusCell(rowIdx + 1, editableFields[0]);
      } else {
        const newRow = makeNewRow();
        setGrid(prev => {
          const next = [...prev, newRow];
          const ni   = next.length - 1;
          setSelIdx(ni);
          focusCell(ni, editableFields[0]);
          return next;
        });
      }
    }
  }, [editableFields, focusCell]); // eslint-disable-line

  // ── Cell keydown ───────────────────────────────────────────────────────────
  const onCellKeyDown = useCallback((e, rowIdx, field) => {
    const colDef = ALL_COLUMNS.find(c => c.field === field);

    if (e.key.length === 1 && colDef) {
      if (!isValidChar(colDef, String(grid[rowIdx]?.[field] ?? ""), e.key)) {
        e.preventDefault();
        return;
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const row   = grid[rowIdx];
      const value = row?.[field];

      // ── Salesman cell Enter → open picker (mirrors jQuery Enter on grdSalesMan) ──
      if (field === "SalesName") {
        openSalesmanPicker(rowIdx);
        return;
      }

      if (field === "AccountName") {
        if (!String(value || "").trim()) { toast("❌ Enter Supplier Name !!!", true); return; }
        if (!SupplierMulitipleAllow) {
          const names = grid
            .filter((r, i) => i !== rowIdx && String(r.AccountName || "").trim())
            .map(r => String(r.AccountName).trim().toLowerCase());
          if (names.includes(String(value).trim().toLowerCase())) {
            toast("❌ Duplicate Supplier Name !!!", true); return;
          }
        }
      }

      if (colDef?.type === "float") updateCell(rowIdx, field, parseFloat(vn(value)).toFixed(2));
      if (colDef?.type === "int")   updateCell(rowIdx, field, String(parseInt(vn(value)) || 0));

      moveNext(rowIdx, field, grid);
    }

    if (e.key === "Delete" && e.ctrlKey) { e.preventDefault(); deleteRow(rowIdx); }
  }, [grid, SupplierMulitipleAllow, moveNext, updateCell, toast, openSalesmanPicker]); // eslint-disable-line

  // ── gridemptycheck ─────────────────────────────────────────────────────────
  const gridemptycheck = useCallback((currentGrid) => {
    let g = [...currentGrid];
    if (g.length > 1 && !String(g[g.length - 1].AccountName || "").trim()) g = g.slice(0, -1);
    for (let i = 0; i < g.length; i++) {
      if (g[i].EditMode === 1 && !String(g[i].AccountName || "").trim()) {
        toast("❌ Enter All Supplier Name in the Grid !!!", true);
        setSelIdx(i); focusCell(i, "AccountName");
        return { ok: false, cleanedGrid: g };
      }
    }
    return { ok: true, cleanedGrid: g };
  }, [focusCell, toast]);

  // ── deleteRow ──────────────────────────────────────────────────────────────
  const deleteRow = useCallback(async (idx) => {
    if (!perm.Delete) { toast("❌ Page Delete Permission Denied !!!", true); return; }
    const row     = grid[idx];
    const isSaved = row.Id != null && row.Id !== 0;

    if (isSaved) {
      const ok = await confirm(`Do you want to delete "${row.AccountName || ""}"?`);
      if (!ok) return;

      setLoading(true);
      const url =
        `/Supplier/DeleteSupplier?Id=${Number(row.Id)}` +
        `&AccountType=SUPPLIER&Comid=${Number(Comid)}&MirrorTable=${Number(MirrorTable)}`;
      const res = await api(url, null, { "IdComList": String(IdComList) });
      setLoading(false);
      if (res.redis === false) { alert("Already Login Another User Please Login Again!!!"); window.location.href = "/Login"; return; }
      if (res.ok) {
        toast("✅ " + (res.message || "Deleted successfully"));
        setGrid(prev => { const next = prev.filter((_, i) => i !== idx); const ns = Math.max(0, next.length - 1); setSelIdx(ns); focusCell(ns, "AccountName"); return next; });
      } else { toast(`❌ ${res.message || "Delete failed"}`, true); }
    } else {
      setGrid(prev => { const next = prev.filter((_, i) => i !== idx); const ns = Math.max(0, next.length - 1); setSelIdx(ns); focusCell(ns, "AccountName"); return next; });
    }
  }, [grid, Comid, MirrorTable, IdComList, perm, focusCell, toast, confirm]);

  // ── handleSave ─────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const { ok: emptyOk, cleanedGrid } = gridemptycheck(grid);
    if (!emptyOk) return;
    setGrid(cleanedGrid);

    let dirty = [];
    let flag  = 1;

    if (perm.Add === 0 && perm.Edit === 0) { toast("❌ Page Add & Update Permission Denied !!!", true); flag = 0; }
    else if (perm.Add === 1 && perm.Edit === 1) {
      dirty = cleanedGrid.filter(r => r.EditMode === 1);
      if (!dirty.length) { toast("⚠️ No Data Modified, Cannot Update !!!", true); flag = 0; }
    } else if (perm.Add === 1 && perm.Edit === 0) {
      dirty = cleanedGrid.filter(r => r.EditMode === 1 && r.Id == null);
      if (!dirty.length) { const any = cleanedGrid.filter(r => r.EditMode === 1); toast(any.length ? "❌ Page Edit Permission Denied !!!" : "⚠️ No Data Modified, Cannot Update !!!", true); flag = 0; }
    } else if (perm.Edit === 1 && perm.Add === 0) {
      dirty = cleanedGrid.filter(r => r.EditMode === 1 && r.Id != null);
      if (!dirty.length) { const any = cleanedGrid.filter(r => r.EditMode === 1); toast(any.length ? "❌ Page Add Permission Denied !!!" : "⚠️ No Data Modified, Cannot Update !!!", true); flag = 0; }
    }

    if (flag === 0) { addRow(); return; }

    if (!SupplierMulitipleAllow) {
      const names = cleanedGrid.filter(r => String(r.AccountName || "").trim()).map(r => String(r.AccountName).trim().toLowerCase());
      if (new Set(names).size !== names.length) { toast("❌ Duplicate Supplier Name found !!!", true); return; }
    }

    const hasNew      = dirty.some(r => r.Id == null || r.Id === 0);
    const hasExisting = dirty.some(r => r.Id != null && r.Id !== 0);
    let confirmMsg    = "Do you want to save the Supplier details?";
    if (hasExisting && !hasNew)  confirmMsg = "Do you want to update the Supplier details?";
    if (hasExisting && hasNew)   confirmMsg = "Do you want to save & update the Supplier details?";

    const proceed = await confirm(confirmMsg);
    if (!proceed) { addRow(); return; }

    const payload = dirty.map(({ _uid, ...rest }) => ({
      ...rest,
      Id:              rest.Id ?? null,
      AccountType:     rest.AccountType || "SUPPLIER",
      Active:          rest.Active === true || rest.Active === 1 ? 1 : 0,
      OpeningBalance:  parseFloat(vn(rest.OpeningBalance))  || 0,
      CreditBillLimit: parseFloat(vn(rest.CreditBillLimit)) || 0,
      CreditBillDays:  parseInt(vn(rest.CreditBillDays))    || 0,
      // SalemanRefid: persisted from picker selection or original DB value
      SalemanRefid:    rest.SalemanRefid || null,
    }));

    setLoading(true);
    const res = await insertApi("/Supplier/InsertSupplier", payload, {
      "Comid": String(Comid), "SupplierMulitipleAllow": String(SupplierMulitipleAllow),
      "AccountTypeNew": "SUPPLIER", "MirrorTable": String(MirrorTable),
      "Tamil": "0", "IdComList": String(IdComList), "ApiType": "1",
    });
    setLoading(false);

    if (res.redis === false) { alert("Already Login Another User Please Login Again!!!"); window.location.href = "/Login"; return; }

    if (res.ok) {
      toast("✅ " + (res.message || "Saved successfully!"));
      if (sessionStorage.getItem("POPStatus") === "ON") {
        sessionStorage.setItem("POPValue", String(res.Id ?? res.Data2 ?? ""));
        sessionStorage.setItem("POPName",  dirty[0]?.AccountName || "");
        sessionStorage.setItem("POPStatus", "OFF");
        navigate(-1); return;
      }
      const retField = sessionStorage.getItem("masterReturnField");
      if (retField) {
        sessionStorage.setItem("masterReturnValue", String(res.Data2 ?? res.Id ?? ""));
        sessionStorage.setItem("masterReturnName",  dirty[0]?.AccountName || "");
        sessionStorage.removeItem("masterReturnField");
        setTimeout(() => navigate(-1), 800);
      } else { await loadData(); }
    } else { toast(`❌ ${res.message || "Save failed"}`, true); }
  }, [grid, Comid, MirrorTable, IdComList, SupplierMulitipleAllow, perm, navigate, loadData, gridemptycheck, addRow, toast, confirm]);

  // ── handleEsc ──────────────────────────────────────────────────────────────
  const handleEsc = useCallback(() => {
    if (!window.confirm("Do You Want To Quit Page?")) return;
    if (sessionStorage.getItem("POPStatus") === "ON") {
      sessionStorage.setItem("POPValue", "-1");
      sessionStorage.setItem("POPStatus", "OFF");
      navigate(-1);
    } else { navigate("/Home"); }
  }, [navigate]);

  // ── Global keyboard shortcuts ──────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      // Do not fire shortcuts while salesman picker is open
      if (pickerTarget != null) return;
      if (f12Open) return;
      if (e.keyCode === 112) { e.preventDefault(); handleSave(); }
      if (e.keyCode === 27)  { e.preventDefault(); handleEsc();  }
      if (e.keyCode === 123) { e.preventDefault(); setF12Open(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleEsc, f12Open, pickerTarget]);

  // ── F12 column settings ────────────────────────────────────────────────────
  const saveColSettings = useCallback(() => {
    try { localStorage.setItem("supplier_colSettings", JSON.stringify(colSettings)); } catch {}
    setF12Open(false);
    toast("✅ Column settings saved");
  }, [colSettings, toast]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("supplier_colSettings") || "null");
      if (saved && Array.isArray(saved)) setColSettings(saved);
    } catch {}
  }, []);

  // ── Cell renderer ──────────────────────────────────────────────────────────
  function renderCell(row, rowIdx, colDef) {
    const { field, type, maxLen, options } = colDef;
    const value  = row[field] ?? "";
    const refKey = `${rowIdx}_${field}`;
    const common = {
      ref:       el => { if (el) cellRefs.current[refKey] = el; else delete cellRefs.current[refKey]; },
      onFocus:   ()  => setSelIdx(rowIdx),
      onKeyDown: e   => onCellKeyDown(e, rowIdx, field),
    };

    // ── Active column ──────────────────────────────────────────────────────
    if (type === "active-select") {
      return (
        <select
          {...common}
          className="sm-active-sel"
          value={value === 1 || value === true ? "1" : "0"}
          onChange={e => updateCell(rowIdx, field, e.target.value === "1" ? 1 : 0)}
          title={value === 1 || value === true ? "Active" : "Inactive"}
        >
          <option value="1">✓</option>
          <option value="0">✗</option>
        </select>
      );
    }

    // ── Select column ──────────────────────────────────────────────────────
    if (type === "select") {
      return (
        <select
          {...common}
          className="mp-cell-select"
          value={value ?? ""}
          onChange={e => updateCell(rowIdx, field, e.target.value)}
        >
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }

    // ── Salesman cell ──────────────────────────────────────────────────────
    // Mirrors jQuery: SalesName is a read-display text input.
    // The user cannot type a name directly; Enter opens the picker.
    // The cell shows the saved SalesName (display text) from DB or picker selection.
    // Clicking the cell also opens the picker (mirrors jQuery celldoubleclick).
    if (type === "salesman") {
      return (
        <input
          {...common}
          className="mp-cell-input"
          type="text"
          readOnly
          style={{ cursor: "pointer", background: "#f8fafc" }}
          value={String(value)}
          title="Press Enter or double-click to select Sales Man"
          onDoubleClick={() => openSalesmanPicker(rowIdx)}
          // readOnly prevents typing; Enter is handled in onKeyDown → openSalesmanPicker
        />
      );
    }

    const isNumeric = type === "int" || type === "float";

    const handleChange = isNumeric
      ? (e => updateCell(rowIdx, field, e.target.value))
      : (e => applyUppercase(e, (val) => updateCell(rowIdx, field, val)));

    return (
      <input
        {...common}
        className="mp-cell-input"
        style={isNumeric ? { textAlign: "right" } : {}}
        type="text"
        maxLength={maxLen || 200}
        value={String(value)}
        onChange={handleChange}
        onBlur={e => {
          if (type === "float") updateCell(rowIdx, field, parseFloat(vn(e.target.value)).toFixed(2));
          if (type === "int")   updateCell(rowIdx, field, String(parseInt(vn(e.target.value)) || 0));
        }}
        onDoubleClick={e => e.target.select?.()}
      />
    );
  }

  // ── F12 popup ──────────────────────────────────────────────────────────────
  function F12Popup() {
    const [localSettings, setLocalSettings] = useState(colSettings.map(s => ({ ...s })));

    function toggleVisible(field) {
      setLocalSettings(prev => prev.map(s => s.field === field ? { ...s, hidden: !s.hidden } : s));
    }
    function changeWidth(field, val) {
      const w = parseInt(val) || 0;
      setLocalSettings(prev => prev.map(s => s.field === field ? { ...s, width: w } : s));
    }

    return (
      <div style={f12Styles.overlay}>
        <div style={f12Styles.popup}>
          <div style={f12Styles.popupHdr}>
            <span>⚙ Column Settings (F12)</span>
            <button style={f12Styles.closeBtn} onClick={() => setF12Open(false)}>✕</button>
          </div>
          <div style={f12Styles.popupBody}>
            <table style={f12Styles.colTbl}>
              <thead>
                <tr>
                  <th style={f12Styles.colTh}>Column</th>
                  <th style={f12Styles.colTh}>Visible</th>
                  <th style={f12Styles.colTh}>Width (px)</th>
                </tr>
              </thead>
              <tbody>
                {localSettings.map(s => (
                  <tr key={s.field}>
                    <td style={f12Styles.colTd}>{s.label || s.field}</td>
                    <td style={{ ...f12Styles.colTd, textAlign: "center" }}>
                      <input type="checkbox" checked={!s.hidden} onChange={() => toggleVisible(s.field)} style={{ width: 15, height: 15, cursor: "pointer" }} />
                    </td>
                    <td style={f12Styles.colTd}>
                      <input type="number" min="40" max="500" value={s.width} onChange={e => changeWidth(s.field, e.target.value)} style={f12Styles.widthInput} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={f12Styles.popupFtr}>
            <button style={f12Styles.saveColBtn} onClick={() => { setColSettings(localSettings); setTimeout(saveColSettings, 50); }}>💾 Save</button>
            <button style={f12Styles.cancelColBtn} onClick={() => setF12Open(false)}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="mp-wrap">
      {ConfirmUI}

      {loading && (
        <div className="mp-loader-ov">
          <div className="mp-ldr-box"><div className="mp-spin" /><div className="mp-ldr-msg">Processing…</div></div>
        </div>
      )}

      {f12Open && <F12Popup />}

      {/* ── NEW: Salesman picker modal ── */}
      {pickerTarget != null && (
        <SalesmanPicker
          salesmanList={salesmanList}
          initialSearch={pickerTarget.currentName}
          onSelect={onSalesmanSelect}
          onClose={onSalesmanPickerClose}
        />
      )}

      {/* Header */}
      <div className="mp-hdr">
        <div className="mp-hdr-left">
          <div className="mp-icon">S</div>
          <div>
            <div className="mp-title">Supplier Master</div>
            <div className="mp-sub">Co: {Comid} — Manage supplier records</div>
          </div>
        </div>
        <button className="mp-back" onClick={handleEsc}>← Back</button>
      </div>

      <div className="mp-body">
        {/* Toolbar */}
        <div className="mp-toolbar">
          <button className="mp-btn sv" onClick={handleSave} disabled={loading}>💾 F1 Save</button>
          <button className="mp-btn nw" onClick={addRow}     disabled={loading}>➕ Add Row</button>
          <button className="mp-btn dl" onClick={handleEsc}>✕ Esc</button>
          <button className="mp-btn" style={btnF12Style} onClick={() => setF12Open(true)} title="Column Settings">⚙ F12 Columns</button>
          {salesmanLoading && <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 8 }}>Loading salesman…</span>}
        </div>

        {/* Grid */}
        <div className="mp-grid-wrap" style={{ overflowX: "auto" }}>
          <table className="mp-tbl" style={{ minWidth: visibleColumns.reduce((a, c) => a + c.width, 150) + "px" }}>
            <thead>
              <tr>
                <th style={{ width: 45 }}>S.No</th>
                {visibleColumns.map(c => (
                  <th key={c.field} style={{ width: c.width, minWidth: c.width, textAlign: c.field === "Active" ? "center" : undefined }}>{c.label}</th>
                ))}
                <th style={{ width: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {grid.map((row, rowIdx) => (
                <tr
                  key={row._uid}
                  className={[
                    selIdx === rowIdx                        ? "sel"   : "",
                    row.Active === 0 || row.Active === false ? "inact" : "",
                    row.EditMode === 1                       ? "mod"   : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => { setSelIdx(rowIdx); focusCell(rowIdx, "AccountName"); }}
                >
                  <td className="sno">{rowIdx + 1}</td>
                  {visibleColumns.map(colDef => (
                    <td key={colDef.field} style={{ padding: "2px 4px", textAlign: colDef.field === "Active" ? "center" : undefined }}>
                      {renderCell(row, rowIdx, colDef)}
                    </td>
                  ))}
                  <td style={{ textAlign: "center", padding: "2px 4px" }}>
                    <button className="mp-del-btn" onClick={e => { e.stopPropagation(); deleteRow(rowIdx); }}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {grid.length === 0 && !loading && (
            <div className="mp-empty">No records. Press ➕ to add a supplier.</div>
          )}
        </div>

        <div className="mp-hint">
          <kbd>Enter</kbd> next cell &nbsp;|&nbsp;
          <kbd>Enter on Sales Man</kbd> select salesman &nbsp;|&nbsp;
          <kbd>Ctrl+Delete</kbd> delete row &nbsp;|&nbsp;
          <kbd>F1</kbd> save &nbsp;|&nbsp;
          <kbd>F12</kbd> column settings &nbsp;|&nbsp;
          <kbd>Esc</kbd> back
        </div>
      </div>

      {/* Toasts */}
      <div className="toasts">
        {toasts.map(t => (
          <div key={t.id} className={`toast${t.isErr ? " err" : ""}`}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}

// ── F12 popup styles ──────────────────────────────────────────────────────────
const f12Styles = {
  overlay:      { position:"fixed", inset:0, background:"rgba(10,20,40,.50)", zIndex:9000, display:"flex", alignItems:"center", justifyContent:"center" },
  popup:        { background:"#fff", borderRadius:8, width:480, maxHeight:"80vh", display:"flex", flexDirection:"column", boxShadow:"0 16px 48px rgba(0,0,0,.3)", overflow:"hidden" },
  popupHdr:     { background:"#1a2e4a", color:"#fff", padding:"10px 16px", fontSize:13, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"space-between" },
  closeBtn:     { background:"none", border:"none", color:"#fff", fontSize:17, cursor:"pointer", lineHeight:1, padding:"0 4px" },
  popupBody:    { flex:1, overflowY:"auto", padding:12 },
  popupFtr:     { padding:"10px 14px", display:"flex", gap:8, justifyContent:"flex-end", borderTop:"1px solid #e5e7eb" },
  colTbl:       { borderCollapse:"collapse", width:"100%" },
  colTh:        { background:"#1a2e4a", color:"#fff", padding:"6px 10px", fontSize:11, fontWeight:600, textAlign:"left", position:"sticky", top:0 },
  colTd:        { padding:"5px 10px", fontSize:12, color:"#1a2e4a", borderBottom:"1px solid #eaecf4" },
  widthInput:   { border:"1px solid #d4dbe8", borderRadius:3, padding:"2px 6px", fontSize:12, width:70, textAlign:"right", outline:"none" },
  saveColBtn:   { background:"#1a2e4a", color:"#fff", border:"none", borderRadius:4, padding:"6px 18px", fontSize:12, fontWeight:700, cursor:"pointer" },
  cancelColBtn: { background:"#fff", color:"#6b7280", border:"1px solid #d1d5db", borderRadius:4, padding:"6px 14px", fontSize:12, fontWeight:600, cursor:"pointer" },
};

const btnF12Style = {
  background: "#fff", color: "#374151", border: "1px solid #9ca3af", marginLeft: "auto",
};