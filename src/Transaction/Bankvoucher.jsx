// ─────────────────────────────────────────────────────────────────────────────
//  BankVoucher.jsx
//
//  Full React port of BankVoucher.js (jQuery/jqxGrid → React hooks).
//  Structure, layout & patterns mirror SupplierPayment.jsx exactly.
//
//  SESSION
//   • Comid, MirrorTable from localStorage
//   • BankSaveViewDialog ← Mainsetting[0].BankSaveViewDialog
//
//  TOP FORM
//   • Type  (Receipt / Payment) dropdown — Enter → focus Bank
//   • Bank  dropdown (from CC.BankAllSelect)             — Enter → focus Date
//   • Date  (Refdate) — Enter → FillGridData (CC.BankDateSelect)
//   • Total (readonly, calculated)
//
//  GRID COLUMNS (matches JS gridcolumns exactly)
//   AccountName(popup) | Amount | RTGSAmt | RTGSNo | ChequeNo |
//   ChequeDate | ClearStatus(toggle, default true) | Narration
//   Hidden: AccountRefId, UpdateId, Id, EditMode
//
//  KEY BEHAVIOURS
//   1. AccountName Enter (empty) → open Account popup (search/select/create)
//   2. Amount Enter   : >0 → fix(2), calculation(), → ChequeNo
//                       else → AccountName (next-cell default)
//   3. RTGSAmt Enter  : >0 → fix(2), calculation(), → RTGSNo
//                       else → AccountName (next-cell default)
//   4. RTGSNo Enter   → Narration
//   5. ChequeDate Enter → Narration
//   6. Everything else (ChequeNo / ClearStatus / Narration) → default next
//      cell logic (next visible column, or AccountName of next row)
//   7. F1 → validate Type/Bank/Date selected, stamp rows, gridemptycheck,
//      confirm, InsertBank API. BankSaveViewDialog → Print/View/No dialog,
//      else toast + reload (FillGridData)
//   8. Del on saved row (Id != 0) → PasswordModal → DeleteBank → reload row
//      Del on unsaved row → remove row immediately
//   9. F5 → F5View popup (date range) → CC.BankSelect → list grid
//      Ctrl+V on selected F5 row → PrintView → open BankVoucherPrint
//  10. F12 → Column settings (show/hide + width, persisted in localStorage)
//  11. Esc → close open popup or confirm quit to /Home
//
//  VISUAL REDESIGN NOTE:
//  Only the presentational layer was changed to match the "bm-*" card design
//  system used in BrandMaster.jsx (blue card border + gradient header,
//  rounded card, bm-btn pill buttons, bm-cell-input focus glow,
//  bm-grid-wrap fixed-height scrollable grid, lucide-react icons, etc.).
//  The bm-* classes live in the same MasterPage.css imported below.
//  The Type/Bank/Date/Total top form row keeps its own field layout — it
//  isn't part of Brand's design (Brand has no header fields) and was only
//  relocated into the card body, not restyled. The 4 overlay popups
//  (PopupWindow/SearchableList, PasswordModal, PrintViewDialog,
//  F5ViewWindow, F12Popup) are completely untouched — independent modals,
//  not part of the bm-* card.
//  All state, effects, handlers, API calls, validation, variable names and
//  control flow are 100% unchanged from the original BankVoucher.jsx.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Save, Plus, RotateCw, ClipboardList, Settings, XCircle, Trash2 } from "lucide-react";
import "../Master/MasterPage.css";

import Topbar from "../components/Topbar";
import * as CC from "../components/Common";
import * as MSG from "../components/Messages";
import   DateFieldDDMMYYYY from "../Commondatetime";

// ─── Extra endpoint (Account list for Bank Voucher — Cash accounts) ─────────
const AccountGroupCashSelect = "/api/AccountGroupApp/SelectAccountGroupCash";

// ─── Field-name constants (match JS exactly) ─────────────────────────────────
const grdId             = "Id";
const grdEditMode       = "EditMode";
const grdRefdate        = "Refdate";
const grdType           = "Type";
const grdAccountName    = "AccountName";
const grdAccountId      = "AccountRefId";
const grdNarration      = "Narration";
const grdAmount         = "Amount";
const grdBankId         = "BankRefid";
const grdChequeDate     = "ChequeDate";
const grdChequeNo       = "ChequeNo";
const grdRTGSAmt        = "RTGSAmt";
const grdRTGSNo         = "RTGSNo";
const grdUpdateId       = "UpdateId";
const grdChequeStataus  = "ChequeStataus";

const Typeslist = ["Receipt", "Payment"];

// ─── Column navigation order (mirrors JS GirdNextCell default order) ────────
const COL_NAV = [
  grdAccountName,
  grdAmount, grdRTGSAmt, grdRTGSNo,
  grdChequeNo, grdChequeDate, grdChequeStataus,
  grdNarration,
];

// ─── ALL_COLUMNS definition (visible/hidden/widths match JS gridcolumns) ─────
const ALL_COLUMNS = [
  { field: grdAccountName,   label: "Account Name", type: "popup",  width: 350, hidden: false },
  { field: grdAmount,        label: "Amount",        type: "float",  width: 250, hidden: false },
  { field: grdRTGSAmt,       label: "RTGS Amt",      type: "float",  width: 100, hidden: false },
  { field: grdRTGSNo,        label: "RTGS No",       type: "string", width: 100, hidden: false },
  { field: grdChequeNo,      label: "Cheque No",     type: "int",    width: 130, hidden: false },
  { field: grdChequeDate,    label: "Cheque Date",   type: "date",   width: 130, hidden: false },
  { field: grdChequeStataus, label: "Clear Status",  type: "toggle", width: 90,  hidden: false },
  { field: grdNarration,     label: "Narration",     type: "string", width: 280, hidden: false },
];

// ─── makeNewRow ───────────────────────────────────────────────────────────────
const makeNewRow = () => ({
  [grdId]:             null,
  [grdEditMode]:       1,
  [grdAccountName]:    "",
  [grdAccountId]:      null,
  [grdAmount]:         "0.00",
  [grdRTGSAmt]:        "0.00",
  [grdRTGSNo]:         "",
  [grdChequeNo]:       "",
  [grdChequeDate]:     "",
  [grdChequeStataus]:  true,
  [grdNarration]:      "",
  [grdUpdateId]:       "",
  [grdType]:           "",
  [grdRefdate]:        "",
  [grdBankId]:         null,
  _uid: CC.uid(),
});

const vn   = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const fmt2 = (v) => vn(v).toFixed(2);
const todayISO = () => new Date().toISOString().slice(0, 10);
const isoToMDY = (iso) => { if (!iso) return ""; const [y, m, d] = iso.split("-"); return `${m}/${d}/${y}`; };

// ─────────────────────────────────────────────────────────────────────────────
// POPUP WINDOW (reusable — identical to SupplierPayment)
// ─────────────────────────────────────────────────────────────────────────────
function PopupWindow({ title, children, onClose, width = 320, height = 460 }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(10,20,40,0.45)",zIndex:8500,
      display:"flex",alignItems:"center",justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"#fff",borderRadius:8,boxShadow:"0 8px 32px rgba(0,0,0,0.22)",
        width,maxHeight:height,display:"flex",flexDirection:"column",overflow:"hidden" }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ padding:"9px 14px",background:"#1a2e4a",color:"#fff",fontWeight:700,
          fontSize:13,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0 }}>
          <span>{title}</span>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#fff",
            cursor:"pointer",fontSize:17,lineHeight:1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCHABLE LIST  (mirrors inputC + gridAccountNameWindow keydown logic,
// including "AccountName Not Exists. Do You Want to Create New AccountName?")
// ─────────────────────────────────────────────────────────────────────────────
function SearchableList({ items, labelField, prefill, onChange, onClose, onCreate, placeholder }) {
  const [q,  setQ ] = useState(prefill || "");
  const [fi, setFi] = useState(-1);
  const inputRef    = useRef(null);
  const listRef     = useRef(null);

  useEffect(() => {
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 60);
  }, []);

  const filtered = items.filter(item =>
    String(item[labelField] || "").toLowerCase().includes(q.toLowerCase())
  );

  const pick = (item) => onChange(item);

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filtered.length === 0) return;
      const nx = Math.min(fi + 1, filtered.length - 1);
      setFi(nx); listRef.current?.children[nx]?.focus();
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (!q.trim()) return; // nothing to do
      if (filtered.length === 0) {
        // AccountName Not Exists. Do You Want to Create New AccountName?
        onCreate && onCreate(q.trim());
        return;
      }
      const target = fi >= 0 ? filtered[fi] : filtered[0];
      if (target) pick(target); else onClose();
    }
    if (e.key === "Escape") onClose();
  };

  const itemKeyDown = (e, item, i) => {
    if (e.key === "Enter")     { e.preventDefault(); pick(item); }
    if (e.key === "ArrowDown") { e.preventDefault(); const nx = Math.min(i+1, filtered.length-1); setFi(nx); listRef.current?.children[nx]?.focus(); }
    if (e.key === "ArrowUp")   { e.preventDefault(); if(i>0){setFi(i-1);listRef.current?.children[i-1]?.focus();}else{setFi(-1);inputRef.current?.focus();} }
    if (e.key === "Escape")    onClose();
  };

  return (
    <>
      <div style={{ padding:"6px 8px",borderBottom:"1px solid #e2e8f0",flexShrink:0 }}>
        <input ref={inputRef} className="mp-cell-input" placeholder={placeholder}
          value={q} onChange={e => { setQ(e.target.value.toUpperCase()); setFi(-1); }}
          onKeyDown={onKeyDown} style={{ height:28,width:"100%" }} />
      </div>
      <div ref={listRef} style={{ overflowY:"auto",flex:1 }}>
        {filtered.length === 0 && (
          <div style={{ padding:12,color:"#94a3b8",fontSize:12,textAlign:"center" }}>
            {q.trim()
              ? <>No results — press <b>Enter</b> to create a new Account named "{q.trim()}"</>
              : "No results"}
          </div>
        )}
        {filtered.map((item, i) => (
          <div key={i} tabIndex={0}
            style={{ padding:"7px 12px",cursor:"pointer",fontSize:13,
              background: fi===i ? "#dbeafe" : "transparent",
              borderBottom:"1px solid #f1f5f9" }}
            onClick={() => pick(item)}
            onKeyDown={e => itemKeyDown(e, item, i)}
            onFocus={() => setFi(i)}>
            {item[labelField]}
          </div>
        ))}
      </div>
      <div style={{ padding:"4px 10px",fontSize:10,color:"#94a3b8",borderTop:"1px solid #f1f5f9",flexShrink:0 }}>
        ↑↓ Navigate &nbsp;|&nbsp; Enter Select / Create &nbsp;|&nbsp; Esc Close
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PASSWORD MODAL  (mirrors EditPasswordWindow + txtEditpassword logic)
// ─────────────────────────────────────────────────────────────────────────────
function PasswordModal({ title, comid, onOk, onClose }) {
  const [val, setVal] = useState("");
  const verify = async () => {
    if (!val.trim()) return;
    const res = await CC.api(CC.LoginPasswordUrl, null, {},
      { password: val, type: "EditPassword", Comid: comid });
    if (res.ok ?? res.IsSuccess) { onOk(); onClose(); }
    else { alert("Invaild Password !!!."); }
  };
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(10,20,40,0.55)",
      zIndex:9200,display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ background:"#fff",borderRadius:8,width:260,
        padding:"20px 22px 16px",boxShadow:"0 8px 32px rgba(0,0,0,0.25)" }}>
        <div style={{ fontSize:13,fontWeight:700,marginBottom:12,color:"#1a2e4a" }}>🔐 {title}</div>
        <input type="password" autoFocus value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if(e.key==="Enter") verify(); if(e.key==="Escape") onClose(); }}
          style={{ width:"100%",padding:"6px 10px",border:"1px solid #c5d8f8",
            borderRadius:4,fontSize:13,marginBottom:14,outline:"none",boxSizing:"border-box" }}
          placeholder="Enter password…" />
        <div style={{ display:"flex",gap:8,justifyContent:"flex-end" }}>
          <button className="mp-btn" onClick={onClose}>Cancel</button>
          <button className="mp-btn sv" onClick={verify}>OK</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRINT/VIEW/NO DIALOG  (mirrors MsgBoxViewPrint — "Bank Payment" variant)
// ─────────────────────────────────────────────────────────────────────────────
function PrintViewDialog({ onPrint, onView, onNo }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(10,20,40,0.55)",
      zIndex:9300,display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ background:"#fff",borderRadius:10,padding:"24px 30px 18px",
        minWidth:280,textAlign:"center",boxShadow:"0 8px 32px rgba(0,0,0,0.22)" }}>
        <div style={{ fontSize:14,fontWeight:600,marginBottom:18,color:"#1e293b" }}>
          Do you to Print Bank Payment or View?
        </div>
        <div style={{ display:"flex",gap:10,justifyContent:"center" }}>
          <button className="mp-btn sv" onClick={onPrint}>🖨 Print</button>
          <button className="mp-btn" style={{ background:"#0891b2",color:"#fff",borderColor:"#0891b2" }} onClick={onView}>👁 View</button>
          <button className="mp-btn" style={{ background:"#f1f5f9",color:"#475569" }} onClick={onNo}>✕ No</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// F5 VIEW WINDOW  (mirrors F5View + gridf5view logic)
// ─────────────────────────────────────────────────────────────────────────────
function F5ViewWindow({ comid, onClose, onPrintView, loading, setLoading }) {
  const [fromDate, setFromDate] = useState(todayISO());
  const [toDate,   setToDate  ] = useState(todayISO());
  const [rows,     setRows    ] = useState([]);
  const [total,    setTotal   ] = useState("0.00");
  const [selIdx,   setSelIdx  ] = useState(null);

  const doView = useCallback(async () => {
    if (!fromDate || !toDate) { alert("Select From/To dates"); return; }
    if (isoToMDY(fromDate) > isoToMDY(toDate)) { alert("From Date Is Greater Than To Date"); return; }
    setLoading(true);
    const res = await CC.api(CC.BankSelect, null, {}, {
      Comid: Number(comid), Fromdate: isoToMDY(fromDate), Todate: isoToMDY(toDate), Id: 0
    });
    setLoading(false);
    if (!res.ok) { alert(res.message || "Error loading data"); return; }
    const data = Array.isArray(res.data) ? res.data : Array.isArray(res.Data1) ? res.Data1 : [];
    setRows(data);
    const t = data.reduce((a, r) => a + vn(r.Amount), 0).toFixed(2);
    setTotal(t);
  }, [fromDate, toDate, comid, setLoading]);

  // load on mount
  useEffect(() => { doView(); }, []); // eslint-disable-line

  // Ctrl+V on selected row → PrintView
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.keyCode === 86) {
        e.preventDefault();
        if (selIdx == null) return;
        const row = rows[selIdx];
        if (!row || row.Id == null || row.Id === 0) return;
        onPrintView(row.Id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selIdx, rows, onPrintView]);

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(10,20,40,0.5)",
      zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ background:"#fff",borderRadius:8,width:"82vw",maxHeight:"88vh",
        display:"flex",flexDirection:"column",boxShadow:"0 16px 48px rgba(0,0,0,.3)" }}>
        {/* header */}
        <div style={{ background:"#1a2e4a",color:"#fff",padding:"10px 16px",fontSize:13,
          fontWeight:700,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
          <span>📋 Bank Voucher — F5 View</span>
          <button style={{ background:"none",border:"none",color:"#fff",fontSize:17,cursor:"pointer" }} onClick={onClose}>✕</button>
        </div>
        {/* filter bar */}
        <div style={{ padding:"8px 14px",display:"flex",gap:12,alignItems:"center",
          flexWrap:"wrap",background:"#f8fafc",borderBottom:"1px solid #e5e7eb",flexShrink:0 }}>
          <label style={{ fontSize:12,fontWeight:600,color:"#475569" }}>From</label>
          <input type="date" className="mp-cell-input"
            value={fromDate} onChange={e => setFromDate(e.target.value)}
            style={{ height:28,width:140,border:"1px solid #93c5fd",borderRadius:4 }} />
          <label style={{ fontSize:12,fontWeight:600,color:"#475569" }}>To</label>
          <input type="date" className="mp-cell-input"
            value={toDate} onChange={e => setToDate(e.target.value)}
            style={{ height:28,width:140,border:"1px solid #93c5fd",borderRadius:4 }} />
          <button id="btnview" className="mp-btn sv" onClick={doView} disabled={loading} style={{ marginLeft:4 }}>🔍 View</button>
          <span style={{ marginLeft:"auto",fontSize:12,fontWeight:700,color:"#1a2e4a" }}>
            Total: <span style={{ color:"#15803d" }}>{total}</span>
          </span>
        </div>
        {/* grid */}
        <div style={{ flex:1,overflowY:"auto" }}>
          <table className="mp-tbl" style={{ tableLayout:"fixed",width:"100%" }}>
            <thead>
              <tr>
                <th style={{ width:44 }}>S.No</th>
                <th>Account Name</th>
                <th style={{ width:120,textAlign:"right" }}>Amount</th>
                <th>Narration</th>
                <th style={{ width:100 }}>Date</th>
                <th style={{ width:120 }}>Type</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={selIdx === i ? "sel" : ""} onClick={() => setSelIdx(i)}>
                  <td className="sno">{i + 1}</td>
                  <td>{r.AccountName}</td>
                  <td style={{ textAlign:"right",fontWeight:600 }}>{fmt2(r.Amount)}</td>
                  <td>{r.Narration}</td>
                  <td>{r.Refdate ? String(r.Refdate).slice(0,10) : ""}</td>
                  <td>{r.Type}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && !loading && <div className="mp-empty">No records found.</div>}
        </div>
        {/* footer */}
        <div style={{ padding:"8px 14px",display:"flex",justifyContent:"space-between",
          alignItems:"center",borderTop:"1px solid #e5e7eb",flexShrink:0 }}>
          <span style={{ fontSize:11,color:"#94a3b8" }}>Ctrl+V on selected row → Print/View</span>
          <button className="mp-btn dl" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// F12 COLUMN SETTINGS  (mirrors F12Config logic — identical to SupplierPayment)
// ─────────────────────────────────────────────────────────────────────────────
function F12Popup({ colSettings, onSave, onClose }) {
  const [local, setLocal] = useState(colSettings.map(s => ({ ...s })));
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(10,20,40,.5)",
      zIndex:9100,display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ background:"#fff",borderRadius:8,width:450,maxHeight:"80vh",
        display:"flex",flexDirection:"column",boxShadow:"0 16px 48px rgba(0,0,0,.3)",overflow:"hidden" }}>
        <div style={{ background:"#1a2e4a",color:"#fff",padding:"10px 16px",fontSize:13,
          fontWeight:700,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <span>⚙ Column Settings (F12)</span>
          <button style={{ background:"none",border:"none",color:"#fff",fontSize:17,cursor:"pointer" }} onClick={onClose}>✕</button>
        </div>
        <div style={{ flex:1,overflowY:"auto",padding:12 }}>
          <table style={{ borderCollapse:"collapse",width:"100%" }}>
            <thead>
              <tr>
                {["Column","Visible","Width (px)"].map(h => (
                  <th key={h} style={{ background:"#1a2e4a",color:"#fff",padding:"6px 10px",fontSize:11,fontWeight:600,textAlign:"left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {local.map(s => (
                <tr key={s.field}>
                  <td style={{ padding:"5px 10px",fontSize:12,borderBottom:"1px solid #eaecf4" }}>{s.label}</td>
                  <td style={{ padding:"5px 10px",textAlign:"center",borderBottom:"1px solid #eaecf4" }}>
                    <input type="checkbox" checked={!s.hidden}
                      onChange={() => setLocal(p => p.map(x => x.field === s.field ? { ...x, hidden: !x.hidden } : x))} />
                  </td>
                  <td style={{ padding:"5px 10px",borderBottom:"1px solid #eaecf4" }}>
                    <input type="number" min="40" max="600" value={s.width}
                      style={{ width:70,border:"1px solid #d4dbe8",borderRadius:3,padding:"2px 6px",fontSize:12,textAlign:"right" }}
                      onChange={e => setLocal(p => p.map(x => x.field === s.field ? { ...x, width: parseInt(e.target.value) || x.width } : x))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding:"10px 14px",display:"flex",gap:8,justifyContent:"flex-end",borderTop:"1px solid #e5e7eb" }}>
          <button onClick={() => onSave(local)}
            style={{ background:"#1a2e4a",color:"#fff",border:"none",borderRadius:4,
              padding:"6px 18px",fontSize:12,fontWeight:700,cursor:"pointer" }}>💾 Save</button>
          <button onClick={onClose}
            style={{ background:"#fff",color:"#6b7280",border:"1px solid #d1d5db",
              borderRadius:4,padding:"6px 14px",fontSize:12,cursor:"pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function BankVoucher() {
  const navigate = useNavigate();
  const { confirm, ConfirmUI } = MSG.useConfirm();
  const { toast,   toasts    } = MSG.useToast();

  // ── Permission state ─────────────────────────────────────────────────────
  const [perm,         setPerm        ] = useState({ View:0,Add:0,Edit:0,Delete:0 });
  const [isAuthorized, setIsAuthorized] = useState(false);

  // ── Session ──────────────────────────────────────────────────────────────
  const [sess] = useState(() => {
    try {
      const main0  = (CC.getLocal("Mainsetting") || [{}])[0] || {};
      const Comid       = CC.getStr("Comid")  || "1";
      const MirrorTable = CC.getStr("MirrorTableOnline") || "0";
      return {
        Comid, MirrorTable,
        BankSaveViewDialog: main0.BankSaveViewDialog ?? false,
      };
    } catch {
      return { Comid:"1", MirrorTable:"0", BankSaveViewDialog:false };
    }
  });

  // ── Component state ──────────────────────────────────────────────────────
  const [grid,    setGrid   ] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selDate, setSelDate] = useState(todayISO());
  const [selIdx,  setSelIdx ] = useState(null);
  const [total,   setTotal  ] = useState("0.00");

  // Top form: Type & Bank
  const [voucherType, setVoucherType] = useState(Typeslist[1]); // default "Payment" (selectedIndex 1 in JS)
  const [bankId,      setBankId     ] = useState(null);
  const [bankName,    setBankName   ] = useState("");

  // combo data
  const [accounts, setAccounts] = useState([]);
  const [banks,    setBanks   ] = useState([]);

  // popup states
  const [accountPopup, setAccountPopup] = useState({ open:false, rowIdx:null, prefill:"" });
  const [pwModal,      setPwModal      ] = useState(null);   // {rowIdx}
  const [pvDialog,     setPvDialog     ] = useState(null);   // print/view after save
  const [f5Open,       setF5Open       ] = useState(false);
  const [f12Open,      setF12Open      ] = useState(false);

  // refs
  const gridRef   = useRef([]);
  const inputRefs = useRef({});
  const permRef   = useRef({ View:0,Add:0,Edit:0,Delete:0 });
  const typeRef   = useRef(null);
  const bankRef   = useRef(null);
  const dateRef   = useRef(null);

  // ── Column settings (F12, localStorage persisted) ────────────────────────
  const [colSettings, setColSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("bv_colSettings") || "null");
      if (saved && Array.isArray(saved)) return saved;
    } catch {}
    return ALL_COLUMNS.map(c => ({ field:c.field, label:c.label, hidden:c.hidden, width:c.width }));
  });

  const visibleColumns = ALL_COLUMNS.filter(c => {
    const cs = colSettings.find(s => s.field === c.field);
    return cs ? !cs.hidden : !c.hidden;
  }).map(c => {
    const cs = colSettings.find(s => s.field === c.field);
    return { ...c, width: cs?.width ?? c.width };
  });

  const saveColSettings = useCallback((local) => {
    try { localStorage.setItem("bv_colSettings", JSON.stringify(local)); } catch {}
    setColSettings(local); setF12Open(false);
    toast("✅ Column settings saved");
  }, [toast]);

  // ── redirectIfDualLogin ──────────────────────────────────────────────────
  const redirectIfDualLogin = useCallback((res) => {
    if (res?._dualLogin || res?.redis === false) {
      alert("Already Login Another User Please Login Again!!!");
      navigate("/"); return true;
    }
    return false;
  }, [navigate]);

  // ── Permission guard ─────────────────────────────────────────────────────
  useEffect(() => {
    const menuStr = localStorage.getItem("menulist");
    if (!menuStr) { alert("Session Close Please Login !!!."); navigate("/"); return; }
    const menulist = JSON.parse(menuStr);
    const menudata = menulist.filter(o => o.PageName === "Bank Voucher");
    if (!menudata || menudata.length === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => navigate("/Home"), 3000); return;
    }
    if (menudata[0].View === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => navigate("/Home"), 3000); return;
    }
    const p = { View:menudata[0].View, Add:menudata[0].Add, Edit:menudata[0].Edit, Delete:menudata[0].Delete };
    setPerm(p); permRef.current = p;
    setIsAuthorized(true);
  }, [navigate]);

  // ── Load combos on mount ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthorized) return;
    loadAccounts(); loadBanks();
  }, [isAuthorized]); // eslint-disable-line

  const loadAccounts = useCallback(async () => {
    const res = await CC.api(
      AccountGroupCashSelect,
      null,
      {},
      {
        Comid: Number(sess.Comid),
        Cashid: 0
      }
    );
    if (redirectIfDualLogin(res)) return;
    setAccounts(Array.isArray(res?.data) ? res.data : Array.isArray(res?.Data1) ? res.Data1 : []);
  }, [sess.Comid, redirectIfDualLogin]);

  const loadBanks = useCallback(async () => {
    const res = await CC.api(CC.BankAllSelect, null, {}, { Comid: Number(sess.Comid) });
    if (redirectIfDualLogin(res)) return;
    const data = Array.isArray(res?.data) ? res.data : Array.isArray(res?.Data1) ? res.Data1 : [];
    setBanks(data);
    if (data.length > 0 && bankId == null) {
      setBankId(data[0].Id);
      setBankName(data[0].AccountName || "");
    }
  }, [sess.Comid, redirectIfDualLogin]); // eslint-disable-line

  // ── focusCell ────────────────────────────────────────────────────────────
  const focusCell = useCallback((rowIdx, field) => {
    setTimeout(() => {
      const el = inputRefs.current[`${rowIdx}-${field}`];
      if (el) { el.focus(); el.select?.(); }
    }, 40);
  }, []);

  // ── updateCell / updateCells ─────────────────────────────────────────────
  const updateCell = useCallback((idx, field, value) => {
    setGrid(prev => {
      const next = prev.map((r, i) => i === idx ? { ...r, [field]:value, [grdEditMode]:r[grdId] ? r[grdEditMode] : 1 } : r);
      gridRef.current = next; return next;
    });
  }, []);

  const updateCells = useCallback((idx, fields) => {
    setGrid(prev => {
      const next = prev.map((r, i) => i === idx ? { ...r, ...fields } : r);
      gridRef.current = next; return next;
    });
  }, []);

  // ── calculation (mirrors methods.calculation) ────────────────────────────
  const calculation = useCallback((g) => {
    const rows = g || gridRef.current;
    let amt = 0;
    for (const r of rows) {
      if (String(r[grdAmount] ?? "") !== "" || String(r[grdRTGSAmt] ?? "") !== "") {
        const t1 = vn(r[grdAmount]);
        const t2 = vn(r[grdRTGSAmt]);
        amt += t1 > 0 ? t1 : t2;
      }
    }
    setTotal(amt.toFixed(2));
  }, []);

  // recalc total whenever grid changes
  useEffect(() => { calculation(grid); }, [grid, calculation]);

  // ── addRow ───────────────────────────────────────────────────────────────
  const addRow = useCallback(() => {
    const blank = makeNewRow();
    setGrid(prev => {
      const next = [...prev, blank];
      gridRef.current = next;
      const idx = next.length - 1;
      setSelIdx(idx);
      focusCell(idx, grdAccountName);
      return next;
    });
  }, [focusCell]);

  // ── FillGridData (mirrors loadgriddetails) ───────────────────────────────
  const fillGridData = useCallback(async (editPass = 0) => {
    if (!selDate) { alert("Select Date"); return; }
    if (!voucherType) { alert("Select Type!!!"); typeRef.current?.focus(); return; }
    if (bankId == null) { alert("Select bank!!!"); bankRef.current?.focus(); return; }

    setLoading(true);
    const res = await CC.api(CC.BankDateSelect, null, {}, {
      Fromdate: isoToMDY(selDate),
      type: voucherType,
      Bid: String(bankId),
      Comid: String(sess.Comid),
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

    let data = [];
    if (res.ok && Array.isArray(res?.data) && res.data.length) data = res.data;
    else if (res.ok && Array.isArray(res?.Data1) && res.Data1.length) data = res.Data1;

    const existing = data.map(o => ({
      ...o,
      [grdAmount]:   fmt2(o[grdAmount]),
      [grdRTGSAmt]:  fmt2(o[grdRTGSAmt]),
      [grdEditMode]: 0,
      _uid: CC.uid(),
    }));
    const blank = makeNewRow();
    const full  = [...existing, blank];
    gridRef.current = full;
    setGrid(full);
    const lastIdx = full.length - 1;
    setSelIdx(lastIdx);
    if (editPass === 0) {
      focusCell(lastIdx, grdAccountName);
    }
  }, [selDate, voucherType, bankId, sess.Comid, redirectIfDualLogin, toast, focusCell]);

  // ── Clear (mirrors methods.Clear) ────────────────────────────────────────
  const clearGrid = useCallback(() => {
    setTotal("");
    const blank = [makeNewRow()];
    gridRef.current = blank;
    setGrid(blank);
    setSelIdx(0);
    focusCell(0, grdAccountName);
  }, [focusCell]);

  // initial load
  useEffect(() => {
    if (!isAuthorized) return;
    clearGrid();
    setTimeout(() => fillGridData(0), 250);
    // eslint-disable-next-line
  }, [isAuthorized]);

  // ── gridemptycheck (mirrors methods.gridemptycheck) ──────────────────────
  const gridemptycheck = useCallback((g) => {
    let cleaned = [...g];
    const last = cleaned[cleaned.length - 1];
    if (cleaned.length > 1 && (!last[grdAccountId] || last[grdAccountId] == null)) {
      cleaned = cleaned.slice(0, -1);
    }
    for (let i = 0; i < cleaned.length; i++) {
      const r = cleaned[i];
      if (r[grdEditMode] !== 1) continue;
      if (!r[grdAccountName]) {
        toast("❌ Enter All Account Name in the Grid !!!.", true);
        setSelIdx(i); focusCell(i, grdAccountName); return { ok:false, cleaned };
      }
      const amt  = vn(r[grdAmount]);
      const rtgs = vn(r[grdRTGSAmt]);
      if (amt === 0 && rtgs === 0) {
        toast("❌ Enter Any one Amount in the Grid !!!.", true);
        setSelIdx(i); focusCell(i, grdAmount); return { ok:false, cleaned };
      }
    }
    return { ok:true, cleaned };
  }, [toast, focusCell]);

  // ── deleteRow (mirrors Del key + DeleteBank) ─────────────────────────────
  const deleteRow = useCallback((idx) => {
    const row = gridRef.current[idx];
    if (!row) return;
    if (row[grdId] != null && row[grdId] !== 0) {
      if (!permRef.current.Delete) { toast("❌ Page Delete Permission Denied !!!.", true); return; }
      setPwModal({ rowIdx: idx });
    } else {
      setGrid(prev => {
        const rowscount = prev.length;
        let next;
        if (rowscount > 1) {
          next = prev.filter((_, i) => i !== idx);
        } else {
          next = [makeNewRow()];
        }
        gridRef.current = next;
        const si = Math.max(0, next.length - 1);
        setSelIdx(si); focusCell(si, grdAccountName);
        return next;
      });
    }
  }, [toast, focusCell]);

  // ── doDeleteAfterPwd ─────────────────────────────────────────────────────
  const doDeleteAfterPwd = useCallback(async (idx) => {
    const row = gridRef.current[idx];
    if (!row) return;
    const id       = row[grdId];
    const updateId = row[grdUpdateId] || "";
    const name     = row[grdAccountName] || "";
    const ok = await confirm(`Wish to Delete the Record ${name}?`);
    if (!ok) return;
    setLoading(true);
    const res = await CC.api(
      CC.BankDelete,
      null,
      {},
      {
        Id: Number(id),
        Comid: Number(sess.Comid),
        MirrorTable: Number(sess.MirrorTable),
        Updateid: String(updateId || ""),
        LocalDB: Number(sess.LocalDB || 0),
      }
    );
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res.ok) {
      toast("✅ " + (res.message || "Deleted"));
      setGrid(prev => {
        const rowscount = prev.length;
        let next;
        if (rowscount > 1) next = prev.filter((_, i) => i !== idx);
        else next = [makeNewRow()];
        gridRef.current = next;
        const si = Math.max(0, next.length - 1);
        setSelIdx(si); focusCell(si, grdAccountId);
        return next;
      });
    } else {
      toast(`❌ ${res.message || "Delete failed"}`, true);
    }
  }, [sess, confirm, toast, focusCell, redirectIfDualLogin]);

  // ── open VoucherPrints (BankVoucherPrint) ────────────────────────────────
  const openVoucherPrint = useCallback(async (a4Print = "0") => {
    const url = `${CC.ReportViewerBase}?ReportName=BankVoucherPrint&A4Print=${a4Print}`;
    const w = window.open(url, "_blank",
      `directories=0,titlebar=0,toolbar=0,location=0,status=0,menubar=0,scrollbars=yes,resizable=no,width=${screen.width},height=${screen.height - 100}`
    );
    if (w) { w.addEventListener("load", () => { w.document.title = "Bank Voucher"; }, false); }
    if (a4Print === "1") setTimeout(() => w?.close(), 10);
  }, []);

  // ── PrintView (Ctrl+V in F5) ─────────────────────────────────────────────
  const doPrintView = useCallback(async (id) => {
    const ok = window.confirm("Do you to View Bank Voucher ?");
    if (!ok) return;
    setLoading(true);
    const res = await CC.api(CC.PrintViewUrl, null, {}, { Id: Number(id), Type: "BankVoucher" });
    setLoading(false);
    if (res.ok) openVoucherPrint("0");
  }, [openVoucherPrint]);

  // ── BankSave (F1, mirrors InsertBank flow) ───────────────────────────────
  const bankSave = useCallback(async () => {
    const { ok, cleaned } = gridemptycheck(gridRef.current);
    if (!ok) return;
    setGrid(cleaned); gridRef.current = cleaned;

    if (!permRef.current.Add) { toast("❌ Page Add Permission Denied !!!.", true); addRow(); return; }

    if (!voucherType) { toast("❌ Select Type", true); typeRef.current?.focus(); return; }
    if (bankId == null) { toast("❌ Select bank", true); bankRef.current?.focus(); return; }
    if (!selDate) { toast("❌ Select Date", true); dateRef.current?.focus(); return; }

    // stamp Type / Refdate / BankRefid onto every row (mirrors JS griddata loop)
    const stamped = cleaned.map(r => ({
      ...r,
      [grdType]:    voucherType,
      [grdRefdate]: isoToMDY(selDate),
      [grdBankId]:  bankId,
    }));
    gridRef.current = stamped; setGrid(stamped);

    // pageadd == 1 → only Id == null rows
    const dirty = stamped.filter(r => r[grdId] == null);
    if (dirty.length === 0) {
      toast("❌ Cannot Update !!!.Delete Row then Add New Entry!!!.", true);
      addRow(); return;
    }

    const ok2 = await confirm("Do you Want to Save the Bank Voucher Details?");
    if (!ok2) return;

    const payload = dirty.map(({ _uid, ...rest }) => ({
      ...rest,
      [grdAmount]: Number(vn(rest[grdAmount])) || 0,
      [grdRTGSAmt]: Number(vn(rest[grdRTGSAmt])) || 0,
    }));

    
    console.log("=== BANK SAVE DEBUG ===");
    console.log("sess =", sess);
    console.log("headers =", {
      Comid: String(sess.Comid),
      MirrorTable: String(sess.MirrorTable),
      LocalDB: String(sess.LocalDB),
    });
    console.log("payload =", payload);
    console.log("first row =", payload[0]);

    setLoading(true);
    const res = await CC.insertapi(
      CC.BankInsert,
      payload,
      {
        Comid: String(Number(sess.Comid) || 0),
        MirrorTable: String(Number(sess.MirrorTable) || 0),
        LocalDB: String(Number(sess.LocalDB) || 0),
      }
    );
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

    if (res.ok || res.IsSuccess) {
      if (sess.BankSaveViewDialog) {
        setPvDialog({ message: res.message || "Saved Successfully" });
      } else {
        toast("✅ " + (res.message || "Saved Successfully"));
        fillGridData(0);
      }
    } else {
      toast(`❌ ${res.message || "Save failed"}`, true);
    }
  }, [gridemptycheck, addRow, voucherType, bankId, selDate, sess, confirm, toast, redirectIfDualLogin, fillGridData]);

  // ── moveNext (mirrors GirdNextCell, default → AccountName of next row) ──
  const moveNext = useCallback((rowIdx, colField) => {
    const visOrder = COL_NAV.filter(f => visibleColumns.some(vc => vc.field === f));
    const ci = visOrder.indexOf(colField);
    if (ci < visOrder.length - 1) {
      focusCell(rowIdx, visOrder[ci + 1]);
    } else {
      if (rowIdx >= gridRef.current.length - 1) addRow();
      else { setSelIdx(rowIdx + 1); focusCell(rowIdx + 1, visOrder[0]); }
    }
  }, [visibleColumns, focusCell, addRow]);

  // ── Account popup selection / create handlers ───────────────────────────
  const onAccountSelect = useCallback((item) => {
    const idx = accountPopup.rowIdx;
    updateCells(idx, {
      [grdAccountName]: item.AccountName || "",
      [grdAccountId]:   item.Id ?? null,
    });
    setAccountPopup({ open:false, rowIdx:null, prefill:"" });
    focusCell(idx, grdAmount);
  }, [accountPopup.rowIdx, updateCells, focusCell]);

  const onAccountCreate = useCallback(async (name) => {
    const yes = window.confirm("AccountName Not Exists. Do You Want to Create New AccountName?");
    if (!yes) return;
    setLoading(true);
    const res = await CC.insertapi(CC.InsertAccountGroup, {
      AccountName: name.toUpperCase(),
      Comid: Number(sess.Comid),
      Cash: 0,
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res.ok || res.IsSuccess) {
      const newId = res.data?.Id ?? res.Data2 ?? res.Id ?? null;
      await loadAccounts();
      const idx = accountPopup.rowIdx;
      updateCells(idx, {
        [grdAccountName]: name.toUpperCase(),
        [grdAccountId]:   newId,
      });
      setAccountPopup({ open:false, rowIdx:null, prefill:"" });
      focusCell(idx, grdAmount);
      toast("✅ " + (res.message || "Account Created"));
    } else {
      toast(`❌ ${res.message || "Create failed"}`, true);
    }
  }, [sess.Comid, accountPopup.rowIdx, updateCells, focusCell, loadAccounts, toast, redirectIfDualLogin]);

  // ── handleCellKeyDown (mirrors gridBankVoucher keydown) ─────────────────
  const handleCellKeyDown = useCallback((e, idx, field) => {
    if (e.keyCode === 46 && e.ctrlKey) { e.preventDefault(); deleteRow(idx); return; }
    if (e.key !== "Enter") return;
    e.preventDefault();

    const row = gridRef.current[idx];
    if (!row) return;
    const value = row[field];

    if (field === grdAccountName) {
      if (value == null || value === "") {
        setAccountPopup({ open:true, rowIdx:idx, prefill:"" });
      } else {
        moveNext(idx, field);
      }
    }
    else if (field === grdAmount) {
      if (vn(value) > 0) {
        updateCell(idx, grdAmount, fmt2(value));
        calculation(gridRef.current.map((r,i) => i===idx ? { ...r, [grdAmount]:fmt2(value) } : r));
        focusCell(idx, grdChequeNo);
      } else {
        focusCell(idx, grdAccountName);
      }
    }
    else if (field === grdRTGSAmt) {
      if (vn(value) > 0) {
        updateCell(idx, grdRTGSAmt, fmt2(value));
        calculation(gridRef.current.map((r,i) => i===idx ? { ...r, [grdRTGSAmt]:fmt2(value) } : r));
        focusCell(idx, grdRTGSNo);
      } else {
        focusCell(idx, grdAccountName);
      }
    }
    else if (field === grdRTGSNo) {
      focusCell(idx, grdNarration);
    }
    else if (field === grdChequeDate) {
      focusCell(idx, grdNarration);
    }
    else {
      // ChequeNo, ClearStatus, Narration → default next-cell logic
      moveNext(idx, field);
    }
  }, [moveNext, focusCell, updateCell, calculation, deleteRow]);

  // ── Inline cell renderer (mirrors SupplierPayment renderCell) ───────────
  function renderCell(row, realIdx, colDef) {
    const { field, type } = colDef;
    const value   = row[field] ?? (type === "float" || type === "int" ? "0.00" : "");
    const readOnly = false; // BankVoucher: rows remain editable even after load

    const base = { cursor: "text" };
    const numStyle = { ...base, textAlign:"right" };
    const ref = el => {
      if (el) inputRefs.current[`${realIdx}-${field}`] = el;
      else delete inputRefs.current[`${realIdx}-${field}`];
    };

    // toggle (Clear Status checkbox)
    if (type === "toggle") {
      const isOn = value === true || value === 1;
      return (
        <div
          ref={ref} tabIndex={0}
          onKeyDown={e => {
            if (e.key === " ") { e.preventDefault(); updateCell(realIdx, field, !isOn); }
            if (e.key === "Enter") { e.preventDefault(); moveNext(realIdx, field); }
          }}
          onClick={() => updateCell(realIdx, field, !isOn)}
          style={{ display:"flex",justifyContent:"center",alignItems:"center",outline:"none",borderRadius:4 }}
          onFocus={() => setSelIdx(realIdx)}>
          <div style={{ width:34,height:18,borderRadius:9,background:isOn?"#1e7e34":"#d1d5db",
            position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0 }}>
            <div style={{ position:"absolute",top:2,left:isOn?16:2,width:14,height:14,borderRadius:"50%",
              background:"#fff",boxShadow:"0 1px 3px rgba(0,0,0,.25)",transition:"left .2s" }} />
          </div>
        </div>
      );
    }

    // popup (Account Name)
    if (type === "popup") {
      const openPopup = () => setAccountPopup({ open:true, rowIdx:realIdx, prefill:String(value) });
      return (
        <input ref={ref} className="bm-cell-input" type="text"
          value={String(value)}
          style={{ ...base, cursor:"pointer", background:"#f8fafc" }}
          placeholder="Enter to select…"
          onFocus={() => setSelIdx(realIdx)}
          onChange={e => CC.applyUppercase(e, v => updateCell(realIdx, field, v))}
          onClick={openPopup}
          onKeyDown={e => handleCellKeyDown(e, realIdx, field)} />
      );
    }

    // date
    if (type === "date") return (
      <input ref={ref} className="bm-cell-input" type="date"
        value={String(value).slice(0,10) || ""}
        style={{ ...base, width:"100%", fontSize:12 }}
        onFocus={() => setSelIdx(realIdx)}
        onKeyDown={e => handleCellKeyDown(e, realIdx, field)}
        onChange={e => updateCell(realIdx, field, e.target.value)} />
    );

    // numeric / string
    const isNum = type === "float" || type === "int";
    return (
      <input ref={ref} className="bm-cell-input" type="text"
        value={String(value)}
        style={isNum ? numStyle : base}
        onFocus={() => setSelIdx(realIdx)}
        onKeyDown={e => handleCellKeyDown(e, realIdx, field)}
        onChange={e => {
          if (isNum) updateCell(realIdx, field, e.target.value);
          else CC.applyUppercase(e, v => updateCell(realIdx, field, v));
        }}
        onBlur={e => {
          if (type === "float") updateCell(realIdx, field, fmt2(e.target.value));
          if (type === "int")   updateCell(realIdx, field, String(parseInt(e.target.value) || ""));
        }} />
    );
  }

  // ── Global keyboard shortcuts ─────────────────────────────────────────────
  const anyPopupOpen = () => accountPopup.open || !!pwModal || !!pvDialog;

  useEffect(() => {
    const onKey = (e) => {
      if (e.keyCode === 27) { // Esc
        e.preventDefault();
        if (accountPopup.open) { setAccountPopup({ open:false,rowIdx:null,prefill:"" }); return; }
        if (f5Open)  { setF5Open(false); return; }
        if (f12Open) { setF12Open(false); return; }
        if (pwModal) return;
        confirm("Do You Want To Quit Page?").then(ok => { if (ok) navigate("/dashboard"); });
        return;
      }
      if (anyPopupOpen()) return;
      if (e.keyCode === 112) { e.preventDefault(); bankSave(); }                                  // F1
      if (e.keyCode === 116) { e.preventDefault(); setF5Open(true); }                              // F5
      if (e.keyCode === 123) { e.preventDefault(); setF12Open(true); }                             // F12
      if (e.keyCode === 46 && !e.ctrlKey && selIdx != null) { e.preventDefault(); deleteRow(selIdx); } // Del
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line
  }, [accountPopup.open, pwModal, pvDialog, f5Open, f12Open,
      selIdx, bankSave, deleteRow, confirm, navigate]);

  // ── Block until authorized ───────────────────────────────────────────────
  if (!isAuthorized) return null;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="bm-shell">
      {ConfirmUI}

      {/* ── Account Name Popup ── */}
      {accountPopup.open && (
        <PopupWindow title="Select Account Name" onClose={() => setAccountPopup({ open:false,rowIdx:null,prefill:"" })} width={340}>
          <SearchableList items={accounts} labelField="AccountName" prefill={accountPopup.prefill}
            placeholder="Search Account Name…" onChange={onAccountSelect}
            onCreate={onAccountCreate}
            onClose={() => setAccountPopup({ open:false,rowIdx:null,prefill:"" })} />
        </PopupWindow>
      )}

      {/* ── Password Modal (Delete) ── */}
      {pwModal && (
        <PasswordModal title="Edit Password" comid={sess.Comid}
          onOk={() => doDeleteAfterPwd(pwModal.rowIdx)}
          onClose={() => setPwModal(null)} />
      )}

      {/* ── Print/View Dialog (after save) ── */}
      {pvDialog && (
        <PrintViewDialog
          onPrint={() => { openVoucherPrint("1"); toast("✅ " + pvDialog.message); setPvDialog(null); fillGridData(0); }}
          onView ={() => { openVoucherPrint("0"); toast("✅ " + pvDialog.message); setPvDialog(null); fillGridData(0); }}
          onNo   ={() => { toast("✅ " + pvDialog.message); setPvDialog(null); fillGridData(0); }} />
      )}

      {/* ── F5 View Window ── */}
      {f5Open && (
        <F5ViewWindow
          comid={sess.Comid}
          onClose={() => setF5Open(false)}
          onPrintView={doPrintView}
          loading={loading} setLoading={setLoading} />
      )}

      {/* ── F12 Column Settings ── */}
      {f12Open && <F12Popup colSettings={colSettings} onSave={saveColSettings} onClose={() => setF12Open(false)} />}

      <Topbar />

      <div className="bm-layout">
        <div className="bm-card">
          <div className="bm-card-header">
            <div className="bm-card-header-title">Bank Voucher</div>
            <button
              type="button"
              className="bm-close-x"
              aria-label="Close"
              onClick={() => confirm("Do You Want To Quit Page?").then(ok => { if (ok) navigate("/dashboard"); })}
            >
              ✕
            </button>
          </div>

          <div className="bm-card-body">
            <div className="bm-report-title">Bank Voucher</div>

        {/* ── TOP FORM ── */}
        <div style={{ display:"flex",alignItems:"center",gap:8,paddingBottom:14,borderBottom:"1px solid #e8ecf0",flexWrap:"wrap" }}>
          {/* Type dropdown */}
          <div style={{ display:"flex",alignItems:"center",gap:6,marginLeft:12 }}>
            <label style={{ fontSize:12,fontWeight:600,color:"#475569" }}>Type</label>
            <select ref={typeRef} className="bm-cell-input"
              style={{ height:30,width:140 }}
              value={voucherType}
              onChange={e => setVoucherType(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { if (!voucherType) toast("❌ Select Type", true); else bankRef.current?.focus(); } }}>
              {Typeslist.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Bank dropdown */}
          <div style={{ display:"flex",alignItems:"center",gap:6 }}>
            <label style={{ fontSize:12,fontWeight:600,color:"#475569" }}>Bank</label>
            <select ref={bankRef} className="bm-cell-input"
              style={{ height:30,width:200 }}
              value={bankId ?? ""}
              onChange={e => {
                const id = Number(e.target.value);
                setBankId(id);
                const b = banks.find(x => x.Id === id);
                setBankName(b?.AccountName || "");
              }}
              onKeyDown={e => { if (e.key === "Enter") { if (bankId == null) toast("❌ Select bank", true); else dateRef.current?.focus(); } }}>
              {banks.map(b => <option key={b.Id} value={b.Id}>{b.AccountName}</option>)}
            </select>
          </div>

          {/* Date picker */}
          <div style={{ display:"flex",alignItems:"center",gap:6 }}>
            <label style={{ fontSize:12,fontWeight:600,color:"#475569" }}>Date</label>
            <input ref={dateRef} type="date" className="bm-cell-input"
              style={{ height:28,width:150 }}
              value={selDate}
              onChange={e => setSelDate(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") fillGridData(1); }} />
          </div>

          {/* Total */}
          <div style={{ marginLeft:"auto",display:"flex",alignItems:"center",gap:6,
            background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:6,padding:"4px 12px" }}>
            <span style={{ fontSize:12,fontWeight:600,color:"#15803d" }}>Total:</span>
            <span style={{ fontSize:14,fontWeight:700,color:"#15803d" }}>{total}</span>
          </div>
        </div>

        {/* ── GRID ── */}
        <div className="bm-grid-wrap" style={{ overflowX:"auto",overflowY:"auto" }}>
          <table className="bm-tbl" style={{
            minWidth: visibleColumns.reduce((a,c) => a + c.width, 110) + "px",
            tableLayout:"fixed", width:"100%"
          }}>
            <thead>
              <tr>
                <th style={{ width:50 }}>S.No</th>
                {visibleColumns.map(c => (
                  <th key={c.field} style={{ width:c.width, minWidth:c.width,
                    textAlign: c.type==="float" || c.type==="toggle" ? "center" : undefined }}>
                    {c.label}
                  </th>
                ))}
                <th style={{ width:44,textAlign:"center" }}></th>
              </tr>
            </thead>
            <tbody>
              {grid.map((row, idx) => {
                const isSel  = selIdx === idx;
                const isMod  = row[grdEditMode] === 1;
                return (
                  <tr key={row._uid}
                    className={[isSel?"sel":"", isMod?"mod":""].filter(Boolean).join(" ")}
                    onClick={() => setSelIdx(idx)}>
                    <td className="sno">{idx + 1}</td>
                    {visibleColumns.map(colDef => (
                      <td key={colDef.field}
                        style={{ padding:"2px 4px",
                          textAlign: colDef.type==="float" || colDef.type==="toggle" ? "center" : undefined }}
                        onClick={e => {
                          e.stopPropagation(); setSelIdx(idx);
                          setTimeout(() => {
                            const el = inputRefs.current[`${idx}-${colDef.field}`];
                            if (el) { el.focus(); el.select?.(); }
                          }, 20);
                        }}>
                        {renderCell(row, idx, colDef)}
                      </td>
                    ))}
                    <td style={{ textAlign:"center",padding:"2px 4px" }}>
                      <button className="bm-icon-btn del" title="Delete row"
                        onClick={e => { e.stopPropagation(); deleteRow(idx); }}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {grid.length === 0 && !loading && (
            <div className="bm-empty">No records. Press ➕ Add Row to add a row.</div>
          )}
        </div>

        {/* ── BOTTOM TOOLBAR ── */}
        <div className="bm-actions">
          <button className="bm-btn" onClick={addRow} disabled={loading}>
            <Plus size={16} />
            Add Row
          </button>
          <button className="bm-btn bm-btn-primary" onClick={bankSave} disabled={loading}>
            <Save size={16} />
            F1 Save
          </button>
          <button className="bm-btn" onClick={() => fillGridData(1)} disabled={loading}>
            <RotateCw size={16} />
            Reload Date
          </button>
          <button className="bm-btn" onClick={() => setF5Open(true)} disabled={loading}>
            <ClipboardList size={16} />
            F5 View
          </button>
          <button className="bm-btn" onClick={() => setF12Open(true)}>
            <Settings size={16} />
            F12 Columns
          </button>
          <button
            className="bm-btn bm-btn-secondary"
            onClick={() => confirm("Do You Want To Quit Page?").then(ok => { if (ok) navigate("/dashboard"); })}
          >
            <XCircle size={16} />
            Esc Quit
          </button>
        </div>
          </div>
        </div>
      </div>

      {/* ── Loading overlay ── */}
      {loading && (
        <div className="mp-loader-ov">
          <div className="mp-ldr-box">
            <div className="mp-spin" />
            <div className="mp-ldr-msg">Processing…</div>
          </div>
        </div>
      )}

      <MSG.ToastList toasts={toasts} />
    </div>
  );
}