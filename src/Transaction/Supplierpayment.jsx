// ─────────────────────────────────────────────────────────────────────────────
//  SupplierPayment.jsx
//
//  Full React port of SupplierPayment.js (jQuery/jqxGrid → React hooks).
//  Design, layout, and structure mirrors CustomerReceipt.jsx exactly.
//
//  SESSION
//   • Comid, MComid from localStorage
//   • PaymentBillWise        ← Mainsetting[0].PaymentBill
//   • SupplierPaymentViewDialog ← Mainsetting[0].SupplierPaymentViewDialog
//   • MirrorTable            ← MirrorTableOnline
//
//  GRID COLUMNS (matches JS gridcolumns exactly)
//   SupplierName(popup) | Cash | RTGSAmt | RTGSNo |
//   ChequeAmt | ChequeNo | ChequeDate | BankName(popup) | ClearStatus |
//   Discount | Narration | Amount(calc, readonly)
//   Hidden: SupplierRefId, BankRefId, UpdateId, Id, EditMode
//
//  KEY BEHAVIOURS
//   1. Date picker → FillGridData (SelectSupplierPaymentDate)
//   2. SupplierName Enter → open Supplier popup → on select: BalanceFetch
//   3. BankName Enter → open Bank popup
//   4. Cash/RTGS/Cheque/Discount → calculation() → set Amount
//      PaymentBillWise=true: Amount > balance → reject
//   5. Amount Enter → PaymentBillWise? open PendingBills window : navigate
//   6. ChequeAmt > 0 → Bank required
//      RTGSAmt  > 0 → Bank required
//   7. RTGSNo Enter → if RTGSAmt>0 go to Bank else next
//   8. ChequeDate Enter → if ChequeAmt>0 go to Bank else next
//   9. F1 → PaymentSave (only Id==null rows; pageedit only → cannot update)
//  10. Del on saved row (Id != null) → PasswordModal → DeleteSupplierPayment → reload
//  11. Del on unsaved row → remove row immediately
//  12. F5 → F5View popup (date range + supplier filter, list of payments)
//       Ctrl+V on selected F5 row → PrintView → open VoucherPrints
//  13. After save → SupplierPaymentViewDialog? Print/View/No dialog
//  14. PendingBills grid: EnterAmt auto-fill, sum validation, close → PaymentSave
//  15. F12 → Column settings (show/hide + width, persisted in localStorage)
//  16. Esc → close open popup or confirm quit
//
//  APIs added to Common.jsx (see Common.jsx additions section at bottom of file):
//   CC.SelectSupplierPaymentDate
//   CC.InsertSupplierPayment
//   CC.DeleteSupplierPayment
//   CC.SelectSupplierPaymentF5
//   CC.SupplierPendingReport
//   CC.PrintViewUrl            (already in Common.jsx)
//   CC.ReportViewerBase        (already in Common.jsx)
//   CC.GetSupplierAll          (already in Common.jsx)
//   CC.BankAllSelect           (already in Common.jsx)
//   CC.CurrentBalance          (already in Common.jsx)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../Master/MasterPage.css";

import Topbar from "../components/Topbar";
import * as CC from "../components/Common";
import * as MSG from "../components/Messages";
import   DateFieldDDMMYYYY from "../Commondatetime";


// ─── Field-name constants (match JS exactly) ─────────────────────────────────
const grdId               = "Id";
const grdEditMode         = "EditMode";
const grdPaymentDate      = "PaymentDate";
const grdAmount           = "Amount";
const grdBankId           = "BankRefId";
const grdCashAmount       = "CashAmount";
const grdChequeAmount     = "ChequeAmount";
const grdChequeNo         = "ChequeNumber";
const grdChequeDate       = "ChequeDate";
const grdChequeStatus     = "ClearedStatus";
const grdDiscountAmount   = "DiscountAmount";
const grdNarration        = "Narration";
const grdRTGSAmt          = "RTGSAmt";
const grdRTGSNo           = "RTGSNo";
const grdSupplierName     = "SupplierName";
const grdSupplierRefId    = "SupplierRefId";
const grdBankName         = "BankName";
const grdUpdateId         = "UpdateId";

// ─── Column navigation order (mirrors JS GirdNextCell logic) ─────────────────
const COL_NAV = [
  grdSupplierName,
  grdCashAmount, grdRTGSAmt, grdRTGSNo,
  grdChequeAmount, grdChequeNo, grdChequeDate,
  grdBankName, grdChequeStatus,
  grdDiscountAmount, grdNarration, grdAmount,
];


// ─── ALL_COLUMNS definition (visible/hidden/widths match JS gridcolumns) ─────
const ALL_COLUMNS = [
  { field: grdSupplierName,   label: "Supplier Name", type: "popup",  width: 220, hidden: false },
  { field: grdCashAmount,     label: "Cash",          type: "float",  width: 100, hidden: false },
  { field: grdRTGSAmt,        label: "RTGS Amt",      type: "float",  width: 100, hidden: false },
  { field: grdRTGSNo,         label: "RTGS No",       type: "string", width: 100, hidden: false },
  { field: grdChequeAmount,   label: "Cheque Amt",    type: "float",  width: 100, hidden: true  },
  { field: grdChequeNo,       label: "Cheque No",     type: "int",    width: 100, hidden: false },
  { field: grdChequeDate,     label: "Cheque Date",   type: "date",   width: 110, hidden: true  },
  { field: grdBankName,       label: "Bank Name",     type: "popup",  width: 120, hidden: false },
  { field: grdChequeStatus,   label: "Clear Status",  type: "toggle", width: 80,  hidden: false },
  { field: grdDiscountAmount, label: "Discount",      type: "float",  width: 90,  hidden: false },
  { field: grdNarration,      label: "Narration",     type: "string", width: 200, hidden: false },
  { field: grdAmount,         label: "Amount",        type: "float",  width: 110, hidden: false, readonly: true },
];

// ─── makeNewRow ───────────────────────────────────────────────────────────────
const makeNewRow = () => ({
  [grdId]:             null,
  [grdEditMode]:       1,
  [grdSupplierName]:   "",
  [grdSupplierRefId]:  null,
  [grdCashAmount]:     "0.00",
  [grdRTGSAmt]:        "0.00",
  [grdRTGSNo]:         "",
  [grdChequeAmount]:   "0.00",
  [grdChequeNo]:       "",
  [grdChequeDate]:     "",
  [grdBankName]:       "",
  [grdBankId]:         null,
  [grdChequeStatus]:   true,
  [grdDiscountAmount]: "0.00",
  [grdNarration]:      "",
  [grdAmount]:         "0.00",
  [grdUpdateId]:       "",
  [grdPaymentDate]:    "",
  _uid: CC.uid(),
});

const vn    = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const fmt2  = (v) => vn(v).toFixed(2);
const todayISO = () => new Date().toISOString().slice(0, 10);
const isoToMDY = (iso) => { if (!iso) return ""; const [y,m,d] = iso.split("-"); return `${m}/${d}/${y}`; };


// ─────────────────────────────────────────────────────────────────────────────
// POPUP WINDOW (reusable — identical to CustomerReceipt)
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
// SEARCHABLE LIST (mirrors inputS / inputB + grid keydown logic)
// ─────────────────────────────────────────────────────────────────────────────
function SearchableList({ items, labelField, prefill, onChange, onClose, placeholder }) {
  const [q,  setQ ] = useState(prefill || "");
  const [fi, setFi] = useState(-1);
  const inputRef    = useRef(null);
  const listRef     = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 60); }, []);

  const filtered = items.filter(item =>
    String(item[labelField] || "").toLowerCase().includes(q.toLowerCase())
  );

  const pick = (item) => onChange(item);

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nx = Math.min(fi + 1, filtered.length - 1);
      setFi(nx); listRef.current?.children[nx]?.focus();
    }
    if (e.key === "Enter") {
      e.preventDefault();
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
          value={q} onChange={e => { setQ(e.target.value); setFi(-1); }}
          onKeyDown={onKeyDown} style={{ height:28,width:"100%" }} />
      </div>
      <div ref={listRef} style={{ overflowY:"auto",flex:1 }}>
        {filtered.length === 0 && <div style={{ padding:12,color:"#94a3b8",fontSize:12,textAlign:"center" }}>No results</div>}
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
        ↑↓ Navigate &nbsp;|&nbsp; Enter Select &nbsp;|&nbsp; Esc Close
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
    else { alert("Invalid Password !!!."); }
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
// PRINT/VIEW/NO DIALOG  (mirrors MsgBoxViewPrint — "Supplier Payment" variant)
// ─────────────────────────────────────────────────────────────────────────────
function PrintViewDialog({ onPrint, onView, onNo }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(10,20,40,0.55)",
      zIndex:9300,display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ background:"#fff",borderRadius:10,padding:"24px 30px 18px",
        minWidth:280,textAlign:"center",boxShadow:"0 8px 32px rgba(0,0,0,0.22)" }}>
        <div style={{ fontSize:14,fontWeight:600,marginBottom:18,color:"#1e293b" }}>
          Do you want to Print Supplier Payment or View?
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
// PENDING BILLS WINDOW  (mirrors PaymentWindow + gridpendingbills logic)
// Supplier-specific: uses SupplierPendingReport data
// ─────────────────────────────────────────────────────────────────────────────
function PendingBillsWindow({ bills, supplierName, totalAmount, onConfirm, onClose }) {
  const [rows, setRows]   = useState(() => bills.map(b => ({ ...b, EnterAmt: "" })));
  const inputRefs         = useRef({});

  useEffect(() => { setTimeout(() => inputRefs.current[0]?.focus(), 80); }, []);

  const updateEnter = (i, val) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, EnterAmt: val } : r));

  const sumEnter = (rs) => rs.reduce((a, r) => a + vn(r.EnterAmt), 0);

  const handleKeyDown = (e, i) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      inputRefs.current[i + 1]?.focus();
      return;
    }
    if (e.key !== "Enter") return;
    e.preventDefault();

    const net = vn(totalAmount);
    const cur = vn(rows[i].EnterAmt);
    const bal = vn(rows[i].Balance);

    // auto-fill logic (mirrors JS gridpendingbills keydown)
    const rowsCopy = [...rows];
    if (cur === 0) {
      const remaining = net - sumEnter(rowsCopy.map((r,j)=>j===i?{...r,EnterAmt:"0"}:r));
      if (bal < remaining) {
        rowsCopy[i] = { ...rowsCopy[i], EnterAmt: bal.toFixed(2) };
      } else if (remaining > 0) {
        rowsCopy[i] = { ...rowsCopy[i], EnterAmt: remaining.toFixed(2) };
      }
      setRows(rowsCopy);
    }

    const newSum = sumEnter(rowsCopy);
    if (newSum >= net || i === rows.length - 1) {
      const balSum = rows.reduce((a, r) => a + vn(r.Balance), 0);
      if (newSum < net && balSum <= newSum) {
        // all balance exhausted — proceed
        onConfirm(rowsCopy);
      } else if (Math.abs(newSum - net) < 0.001) {
        onConfirm(rowsCopy);
      } else if (i === rows.length - 1 && newSum < net) {
        MSG && alert("Supplier Excess Payment Amount Not Allowed !!!.");
      } else {
        onConfirm(rowsCopy);
      }
      return;
    }
    inputRefs.current[i + 1]?.focus();
  };

  const total = rows.reduce((a, r) => a + vn(r.Amount || r.TotAmt || 0), 0).toFixed(2);

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(10,20,40,0.5)",
      zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ background:"#fff",borderRadius:8,width:720,maxHeight:"82vh",
        display:"flex",flexDirection:"column",boxShadow:"0 16px 48px rgba(0,0,0,.3)" }}>
        <div style={{ background:"#1a2e4a",color:"#fff",padding:"10px 16px",fontSize:13,
          fontWeight:700,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
          <span>📋 Pending Bills — {supplierName}</span>
          <button style={{ background:"none",border:"none",color:"#fff",fontSize:17,cursor:"pointer" }} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding:"6px 14px",background:"#f8fafc",borderBottom:"1px solid #e5e7eb",flexShrink:0 }}>
          <span style={{ fontSize:12,fontWeight:600,color:"#1a2e4a" }}>Payment Amount: </span>
          <span style={{ fontSize:14,fontWeight:700,color:"#15803d" }}>{fmt2(totalAmount)}</span>
        </div>
        <div style={{ flex:1,overflowY:"auto" }}>
          <table className="mp-tbl" style={{ tableLayout:"fixed",width:"100%" }}>
            <thead>
              <tr>
                <th style={{ width:44 }}>S.No</th>
                <th style={{ width:100 }}>Date</th>
                <th>Bill No</th>
                <th style={{ width:100,textAlign:"right" }}>Bill Amt</th>
                <th style={{ width:100,textAlign:"right" }}>Balance</th>
                <th style={{ width:110,textAlign:"right" }}>Enter Amt</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="sno">{i + 1}</td>
                  <td>{r.Date ? String(r.Date).slice(0,10) : ""}</td>
                  <td>{r.BillNo || r.billno || ""}</td>
                  <td style={{ textAlign:"right" }}>{fmt2(r.TotAmt)}</td>
                  <td style={{ textAlign:"right" }}>{fmt2(r.Balance)}</td>
                  <td style={{ padding:"2px 4px" }}>
                    <input
                      ref={el => { if(el) inputRefs.current[i]=el; else delete inputRefs.current[i]; }}
                      className="mp-cell-input" type="text"
                      value={r.EnterAmt}
                      style={{ textAlign:"right",border:"1px solid #93c5fd",borderRadius:4,
                        background:"#fff",width:"100%",boxSizing:"border-box" }}
                      onChange={e => updateEnter(i, e.target.value)}
                      onKeyDown={e => handleKeyDown(e, i)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <div className="mp-empty">No pending bills found.</div>}
        </div>
        <div style={{ padding:"8px 14px",display:"flex",justifyContent:"space-between",
          alignItems:"center",borderTop:"1px solid #e5e7eb",flexShrink:0 }}>
          <span style={{ fontSize:12,fontWeight:600,color:"#1f65de" }}>Total: {total}</span>
          <button className="mp-btn sv" onClick={() => onConfirm(rows)}>✔ Confirm</button>
          <button className="mp-btn dl" onClick={onClose}>✕ Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// F5 VIEW WINDOW  (mirrors F5View + gridf5view logic)
// ─────────────────────────────────────────────────────────────────────────────
function F5ViewWindow({ suppliers, comid, mcomid, onClose, onPrintView, loading, setLoading }) {
  const [fromDate,     setFromDate    ] = useState(todayISO());
  const [toDate,       setToDate      ] = useState(todayISO());
  const [suppId,       setSuppId      ] = useState(0);
  const [suppName,     setSuppName    ] = useState("");
  const [rows,         setRows        ] = useState([]);
  const [total,        setTotal       ] = useState("0.00");
  const [selIdx,       setSelIdx      ] = useState(null);
  const [showSuppPop,  setShowSuppPop ] = useState(false);

  const doView = useCallback(async () => {
    if (!fromDate || !toDate) { alert("Select From/To dates"); return; }
    if (isoToMDY(fromDate) > isoToMDY(toDate)) { alert("From Date Is Greater Than To Date"); return; }
    setLoading(true);
    const res = await CC.api(CC.SelectSupplierPaymentF5, null, {}, {
      Comid: Number(comid), Fromdate: isoToMDY(fromDate), Todate: isoToMDY(toDate), Id: suppId
    });
    setLoading(false);
    if (!res.ok) { alert(res.message || "Error loading data"); return; }
    const data = Array.isArray(res.data) ? res.data : Array.isArray(res.Data1) ? res.Data1 : [];
    setRows(data);
    const t = data.reduce((a, r) => a + vn(r.Amount), 0).toFixed(2);
    setTotal(t);
  }, [fromDate, toDate, suppId, comid, setLoading]);

  // load on mount
  useEffect(() => { doView(); }, []); // eslint-disable-line

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(10,20,40,0.5)",
      zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ background:"#fff",borderRadius:8,width:"88vw",maxHeight:"88vh",
        display:"flex",flexDirection:"column",boxShadow:"0 16px 48px rgba(0,0,0,.3)" }}>
        {/* header */}
        <div style={{ background:"#1a2e4a",color:"#fff",padding:"10px 16px",fontSize:13,
          fontWeight:700,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
          <span>📋 Supplier Payment — F5 View</span>
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
          <label style={{ fontSize:12,fontWeight:600,color:"#475569" }}>Supplier</label>
          <input readOnly className="mp-cell-input"
            value={suppName} placeholder="All Suppliers"
            onClick={() => setShowSuppPop(true)}
            style={{ height:28,width:180,cursor:"pointer",border:"1px solid #93c5fd",borderRadius:4,background:"#f8fafc" }} />
          {suppName && (
            <button className="mp-del-btn" style={{ fontSize:11,padding:"2px 7px" }}
              onClick={() => { setSuppId(0); setSuppName(""); }}>✕</button>
          )}
          <button className="mp-btn sv" onClick={doView} disabled={loading} style={{ marginLeft:4 }}>🔍 View</button>
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
                <th style={{ width:80 }}>Date</th>
                <th>Supplier Name</th>
                <th style={{ width:90,textAlign:"right" }}>Cash</th>
                <th style={{ width:90,textAlign:"right" }}>RTGS</th>
                <th style={{ width:90,textAlign:"right" }}>Cheque</th>
                <th style={{ width:90,textAlign:"right" }}>Discount</th>
                <th style={{ width:100,textAlign:"right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={selIdx === i ? "sel" : ""} onClick={() => setSelIdx(i)}>
                  <td className="sno">{i + 1}</td>
                  <td>{r.PaymentDate ? String(r.PaymentDate).slice(0,10) : ""}</td>
                  <td>{r.SupplierName}</td>
                  <td style={{ textAlign:"right" }}>{fmt2(r.CashAmount)}</td>
                  <td style={{ textAlign:"right" }}>{fmt2(r.RTGSAmt)}</td>
                  <td style={{ textAlign:"right" }}>{fmt2(r.ChequeAmount)}</td>
                  <td style={{ textAlign:"right" }}>{fmt2(r.DiscountAmount)}</td>
                  <td style={{ textAlign:"right",fontWeight:600 }}>{fmt2(r.Amount)}</td>
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
      {/* Supplier popup inside F5 window */}
      {showSuppPop && (
        <PopupWindow title="Select Supplier" onClose={() => setShowSuppPop(false)} width={340}>
          <SearchableList items={suppliers} labelField="AccountName" placeholder="Search Supplier…"
            onChange={item => { setSuppId(item.Id ?? 0); setSuppName(item.AccountName || ""); setShowSuppPop(false); }}
            onClose={() => setShowSuppPop(false)} />
        </PopupWindow>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// F12 COLUMN SETTINGS  (mirrors F12Config logic — identical to CustomerReceipt)
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
export default function SupplierPayment() {
  const navigate = useNavigate();
  const { confirm, ConfirmUI } = MSG.useConfirm();
  const { toast,   toasts    } = MSG.useToast();

  // ── Permission state ─────────────────────────────────────────────────────
  const [perm,         setPerm        ] = useState({ View:0,Add:0,Edit:0,Delete:0 });
  const [isAuthorized, setIsAuthorized] = useState(false);

  // ── Session ──────────────────────────────────────────────────────────────
  const [sess] = useState(() => {
    try {
      const main0  = (CC.getLocal("Mainsetting")    || [{}])[0] || {};
      const Comid       = CC.getStr("Comid")  || "1";
      const MComid      = CC.getStr("MComid") || Comid;
      const MirrorTable = CC.getStr("MirrorTableOnline") || "0";
      return {
        Comid, MComid, MirrorTable,
        PaymentBillWise:             main0.PaymentBill                 ?? false,
        SupplierPaymentViewDialog:   main0.SupplierPaymentViewDialog   ?? false,
      };
    } catch {
      return { Comid:"1", MComid:"1", MirrorTable:"0", PaymentBillWise:false, SupplierPaymentViewDialog:false };
    }
  });

  // ── Component state ──────────────────────────────────────────────────────
  const [grid,    setGrid   ] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selDate, setSelDate] = useState(todayISO());
  const [selIdx,  setSelIdx ] = useState(null);
  const [currentBalance, setCurrentBalance] = useState("0.00");

  // combo data
  const [suppliers, setSuppliers] = useState([]);
  const [banks,     setBanks    ] = useState([]);

  // popup states
  const [supplierPopup, setSupplierPopup] = useState({ open:false,rowIdx:null,prefill:"" });
  const [bankPopup,     setBankPopup     ] = useState({ open:false,rowIdx:null,prefill:"" });
  const [pwModal,       setPwModal       ] = useState(null);   // {rowIdx}
  const [pvDialog,      setPvDialog      ] = useState(null);   // print/view after save
  const [pendingWin,    setPendingWin    ] = useState(null);   // {bills, rowIdx}
  const [f5Open,        setF5Open        ] = useState(false);
  const [f12Open,       setF12Open       ] = useState(false);

  // refs
  const gridRef   = useRef([]);
  const inputRefs = useRef({});
  const permRef   = useRef({ View:0,Add:0,Edit:0,Delete:0 });

  // ── Column settings (F12, localStorage persisted) ────────────────────────
  const [colSettings, setColSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("sp_colSettings") || "null");
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
    try { localStorage.setItem("sp_colSettings", JSON.stringify(local)); } catch {}
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
    const menudata = menulist.filter(o => o.PageName === "Supplier Payment");
    if (!menudata || menudata.length === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => navigate("/Home"), 3000); return;
    }
    if (menudata[0].View === 0) {
      alert("Page Access Permission Denied !!!.");
      navigate("/Home"); return;
    }
    const p = { View:menudata[0].View, Add:menudata[0].Add, Edit:menudata[0].Edit, Delete:menudata[0].Delete };
    setPerm(p); permRef.current = p;
    setIsAuthorized(true);
  }, [navigate]);

  // ── Load combos on mount ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthorized) return;
    loadSuppliers(); loadBanks();
  }, [isAuthorized]); // eslint-disable-line

  const loadSuppliers = useCallback(async () => {
    const res = await CC.api(CC.GetSupplierAll, null, {},
      { Comid: Number(sess.Comid), AccountType: "SUPPLIER", Keyword: "", Column: "" });
    if (redirectIfDualLogin(res)) return;
    setSuppliers(Array.isArray(res?.data) ? res.data : Array.isArray(res?.Data1) ? res.Data1 : []);
  }, [sess.Comid, redirectIfDualLogin]);

  const loadBanks = useCallback(async () => {
    const res = await CC.api(CC.BankAllSelect, null, {}, { Comid: Number(sess.Comid) });
    if (redirectIfDualLogin(res)) return;
    setBanks(Array.isArray(res?.data) ? res.data : Array.isArray(res?.Data1) ? res.Data1 : []);
  }, [sess.Comid, redirectIfDualLogin]);

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
  const calculation = useCallback((idx, newRow) => {
    const row = newRow || gridRef.current[idx];
    if (!row) return true;
    const cash   = vn(row[grdCashAmount]);
    const rtgs   = vn(row[grdRTGSAmt]);
    const cheque = vn(row[grdChequeAmount]);
    const disc   = vn(row[grdDiscountAmount]);
    const total  = cash + rtgs + cheque + disc;
    if (sess.PaymentBillWise) {
      const bal = vn(currentBalance);
      if (total > bal) {
        toast("❌ Total Amount Greater than Balance Amount!!!", true);
        focusCell(idx, grdCashAmount);
        return false;
      }
    }
    updateCell(idx, grdAmount, total.toFixed(2));
    return true;
  }, [sess.PaymentBillWise, currentBalance, updateCell, toast, focusCell]);

  // ── BalanceFetch (mirrors methods.BalanceFetch) ──────────────────────────
  const balanceFetch = useCallback(async (sid, dateISO, rowIdx) => {
    if (!sid) return;
    const res = await CC.api(CC.CurrentBalance, null, {}, {
      Id: Number(sid), Comid: Number(sess.Comid), MComid: Number(sess.MComid),
      TillDate: isoToMDY(dateISO), AccountType: "SUPPLIER"
    });
    if (redirectIfDualLogin(res)) return;
    if (res.ok) {
      const bal = parseFloat(res.data || 0).toFixed(2);
      setCurrentBalance(bal);
      updateCell(rowIdx, grdAmount, "0.00"); // reset amount on supplier change
    } else {
      setCurrentBalance("0.00");
    }
  }, [sess.Comid, sess.MComid, redirectIfDualLogin, updateCell]);

  // ── FillGridData (mirrors methods.FillGridData) ──────────────────────────
  const fillGridData = useCallback(async () => {
    if (!selDate) { alert("Select Date!!!"); return; }
    setLoading(true);
    setCurrentBalance("0.00");
    const res = await CC.api(
        CC.SelectSupplierPaymentDate,
        null,
        {},
        {
          Fromdate: isoToMDY(selDate),
          Comid: Number(sess.Comid)
        }
      );
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }
    let data = [];
    if (res.ok && Array.isArray(res?.data)  && res.data.length)  data = res.data;
    else if (res.ok && Array.isArray(res?.Data1) && res.Data1.length) data = res.Data1;

    const existing = data.map(o => ({
      ...o,
      [grdAmount]:         fmt2(o[grdAmount]),
      [grdCashAmount]:     fmt2(o[grdCashAmount]),
      [grdChequeAmount]:   fmt2(o[grdChequeAmount]),
      [grdRTGSAmt]:        fmt2(o[grdRTGSAmt]),
      [grdDiscountAmount]: fmt2(o[grdDiscountAmount]),
      [grdEditMode]:       0,
      _uid: CC.uid(),
    }));
    const blank = makeNewRow();
    const full  = [...existing, blank];
    gridRef.current = full;
    setGrid(full);
    const lastIdx = full.length - 1;
    setSelIdx(lastIdx);
    focusCell(lastIdx, grdSupplierName);
  }, [selDate, sess.Comid, redirectIfDualLogin, toast, focusCell]);

  // initial load
  useEffect(() => { if (isAuthorized) fillGridData(); }, [isAuthorized]); // eslint-disable-line

  // ── addRow ───────────────────────────────────────────────────────────────
  const addRow = useCallback(() => {
    const blank = makeNewRow();
    setGrid(prev => {
      const next = [...prev, blank];
      gridRef.current = next;
      const idx = next.length - 1;
      setSelIdx(idx);
      focusCell(idx, grdSupplierName);
      return next;
    });
  }, [focusCell]);

  // ── deleteRow (mirrors Del key + DeleteSupplierPayment) ──────────────────
  const deleteRow = useCallback(async (idx) => {
    const row = gridRef.current[idx];
    if (!row) return;
    if (row[grdId] != null && row[grdId] !== 0) {
      if (!permRef.current.Delete) { toast("❌ Page Delete Permission Denied !!!.", true); return; }
      setPwModal({ rowIdx: idx });
    } else {
      setGrid(prev => {
        const next = prev.filter((_, i) => i !== idx);
        gridRef.current = next;
        const si = Math.max(0, next.length - 1);
        setSelIdx(si); focusCell(si, grdSupplierName);
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
    const name     = row[grdSupplierName] || "";
    const ok = await confirm(`Wish to Delete the Record ${name}?`);
    if (!ok) { addRow(); return; }
    setLoading(true);
    const res = await CC.api(
      CC.DeleteSupplierPayment,
      null,
      {},
      {
        Id: Number(id),
        Comid: Number(sess.Comid),
        MirrorTable: Number(sess.MirrorTable),
        Updateid: String(updateId || ""),
        LocalDB: Number(sess.LocalDB || 1),
      }
    );
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res.ok) {
      toast("✅ " + (res.message || "Deleted"));
      setGrid(prev => {
        const next = prev.filter((_, i) => i !== idx);
        gridRef.current = next;
        const si = Math.max(0, next.length - 1);
        setSelIdx(si); focusCell(si, grdSupplierName);
        return next;
      });
    } else {
      toast(`❌ ${res.message || "Delete failed"}`, true);
    }
  }, [sess, confirm, toast, focusCell, redirectIfDualLogin, addRow]);

  // ── gridemptycheck (mirrors methods.gridemptycheck) ──────────────────────
  const gridemptycheck = useCallback((g) => {
    let cleaned = [...g];
    const last = cleaned[cleaned.length - 1];
    if (cleaned.length > 1 && (!last[grdSupplierRefId] || last[grdSupplierRefId] == null)) {
      cleaned = cleaned.slice(0, -1);
    }
    for (let i = 0; i < cleaned.length; i++) {
      const r = cleaned[i];
      if (r[grdEditMode] !== 1) continue;
      if (!r[grdSupplierName]) {
        toast("❌ Enter All Supplier Name in the Grid !!!.", true);
        setSelIdx(i); focusCell(i, grdSupplierName); return { ok:false, cleaned };
      }
      const amt = vn(r[grdAmount]);
      const c = vn(r[grdCashAmount]), rt = vn(r[grdRTGSAmt]),
            ch = vn(r[grdChequeAmount]), di = vn(r[grdDiscountAmount]);
      if (amt > 0 && c === 0 && rt === 0 && ch === 0 && di === 0) {
        toast("❌ Enter Any one Amount in the Grid !!!.", true);
        setSelIdx(i); focusCell(i, grdCashAmount); return { ok:false, cleaned };
      }
      if (ch > 0 && !r[grdBankName]) {
        toast("❌ Select Bank Name !!!.", true);
        setSelIdx(i); focusCell(i, grdBankName); return { ok:false, cleaned };
      }
      if (rt > 0 && !r[grdBankName]) {
        toast("❌ Select Bank Name !!!.", true);
        setSelIdx(i); focusCell(i, grdBankName); return { ok:false, cleaned };
      }
      if (amt === 0) {
        toast("❌ Enter Any one Amount in the Grid !!!.", true);
        setSelIdx(i); focusCell(i, grdCashAmount); return { ok:false, cleaned };
      }
    }
    return { ok:true, cleaned };
  }, [toast, focusCell]);

  // ── PaymentSave (mirrors methods.PaymentSave) ────────────────────────────
  const paymentSave = useCallback(async (pendingDetails = []) => {
    const { ok, cleaned } = gridemptycheck(gridRef.current);
    if (!ok) return;
    setGrid(cleaned); gridRef.current = cleaned;

    const { Add, Edit } = permRef.current;
    if (Add === 0 && Edit === 0) { toast("❌ Page Add & Update Permission Denied !!!.", true); addRow(); return; }

    const dirty = cleaned.filter(r => r[grdEditMode] === 1 && (r[grdId] == null || r[grdId] === 0));
    if (dirty.length === 0) {
      if (Add === 1) {
        toast("❌ Cannot Update !!!. Delete Row then Add New Entry!!!.", true);
      } else {
        toast("⚠️ No new data to save.", true);
      }
      addRow(); return;
    }

    const ok2 = await confirm("Do you Want to Save the Supplier Payment Details?");
    if (!ok2) { addRow(); return; }

    const payload = dirty.map(({ _uid, ...rest }) => ({
      ...rest,
      [grdPaymentDate]:    isoToMDY(selDate),
      [grdCashAmount]:     vn(rest[grdCashAmount]),
      [grdRTGSAmt]:        vn(rest[grdRTGSAmt]),
      [grdChequeAmount]:   vn(rest[grdChequeAmount]),
      [grdDiscountAmount]: vn(rest[grdDiscountAmount]),
      [grdAmount]:         vn(rest[grdAmount]),
    }));

    setLoading(true);
    const res = await CC.insertapi(
      CC.InsertSupplierPayment,
      payload,
      {
        Paymentdetails: JSON.stringify(pendingDetails),
        Comid: String(sess.Comid),
        MirrorTable: String(sess.MirrorTable),
        LocalDB: String(sess.LocalDB || 1),
      }
    );
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

    if (res.ok || res.IsSuccess) {
      if (sess.SupplierPaymentViewDialog) {
        setPvDialog({ message: res.message || "Saved successfully!" });
      } else {
        toast("✅ " + (res.message || "Saved successfully!"));
        fillGridData();
      }
    } else {
      toast(`❌ ${res.message || "Save failed"}`, true);
      addRow();
    }
  }, [gridemptycheck, addRow, selDate, sess, confirm, toast, redirectIfDualLogin, fillGridData]);

  // ── open VoucherPrints  ──────────────────────────────────────────────────
  const openVoucherPrint = useCallback(async (a4Print = "0") => {
    const url = `${CC.ReportViewerBase}?ReportName=VoucherPrints&A4Print=${a4Print}&VoucherPrint=Supplier`;
    const w = window.open(url, "_blank",
      `directories=0,titlebar=0,toolbar=0,location=0,status=0,menubar=0,scrollbars=yes,resizable=no,width=${screen.width},height=${screen.height - 100}`
    );
    if (w) { w.addEventListener("load", () => { w.document.title = "Supplier Payment"; }, false); }
    if (a4Print === "1") setTimeout(() => w?.close(), 10);
  }, []);

  // ── PrintView (Ctrl+V in F5) ─────────────────────────────────────────────
  const doPrintView = useCallback(async (id) => {
    const ok = window.confirm("Do you want to View Supplier Payment?");
    if (!ok) return;
    setLoading(true);
    const res = await CC.api(CC.PrintViewUrl, null, {}, { Id: Number(id), Type: "SupplierPayment" });
    setLoading(false);
    if (res.ok) openVoucherPrint("0");
  }, [openVoucherPrint]);

  // ── moveNext (mirrors GirdNextCell) ─────────────────────────────────────
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

  // ── openPendingBills ─────────────────────────────────────────────────────
  const openPendingBills = useCallback(async (rowIdx, sid) => {
    setLoading(true);
    const res = await CC.api(CC.SupplierPendingReport, null, {},
      { GroupBy: Number(sid), Comid: Number(sess.Comid), MComid: Number(sess.MComid) });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    const bills = Array.isArray(res?.data) ? res.data : Array.isArray(res?.Data1) ? res.Data1 : Array.isArray(res) ? res : [];
    if (bills.length === 0) return;
    setPendingWin({ bills, rowIdx });
  }, [sess.Comid, sess.MComid, redirectIfDualLogin]);

  // ── handleCellKeyDown (mirrors gridSupplierPayment keydown) ─────────────
const handleCellKeyDown = useCallback((e, idx, field) => {
    if (e.keyCode === 46 && e.ctrlKey) { e.preventDefault(); deleteRow(idx); return; }
    if (e.key !== "Enter") return;
    e.preventDefault();

    const row   = gridRef.current[idx];
    if (!row) return;
    const value = row[field];

    // Helper — target column visible-ஆ இருந்தா நேரடியா focus பண்ணு,
    // இல்லாட்டி moveNext()-ஐ கூப்பிட்டு COL_NAV வழியா next visible
    // column-க்கு தானாகவே போகும்.
    const goToOrSkip = (targetField, fromField) => {
      const isVisible = visibleColumns.some(vc => vc.field === targetField);
      if (isVisible) {
        focusCell(idx, targetField);
      } else {
        moveNext(idx, fromField);
      }
    };

    if (field === grdSupplierName) {
      setSupplierPopup({ open:true, rowIdx:idx, prefill:row[grdSupplierName] || "" });
    }
    else if (field === grdBankName) {
      setBankPopup({ open:true, rowIdx:idx, prefill:row[grdBankName] || "" });
    }
    else if (field === grdCashAmount) {
      updateCell(idx, grdCashAmount, fmt2(value));
      if (!calculation(idx, { ...row, [grdCashAmount]: value })) return;
      moveNext(idx, field);
    }
    else if (field === grdRTGSAmt) {
      updateCell(idx, grdRTGSAmt, fmt2(value));
      if (!calculation(idx, { ...row, [grdRTGSAmt]: value })) return;

      if (vn(value) > 0) {
        // RTGSAmt > 0 → RTGSNo (visible ஆ இருந்தா, இல்லாட்டி skip)
        goToOrSkip(grdRTGSNo, grdRTGSAmt);
      } else {
        updateCell(idx, grdRTGSNo, "");
        // ✅ FIX: field-ஐ grdRTGSNo-ஆ கொடுத்து moveNext கூப்பிடணும் —
        // COL_NAV-ல் RTGSAmt-க்கு அடுத்தது RTGSNo, அதை கடந்து அடுத்த
        // column-க்கு (ChequeAmount அல்லது அதற்கு அடுத்தது) போகணும்.
        moveNext(idx, grdRTGSNo);
      }
    }
    else if (field === grdRTGSNo) {
      if (vn(row[grdRTGSAmt]) > 0) {
        // BankName-க்கு போ (visible ஆ இருந்தா, இல்லாட்டி skip)
        goToOrSkip(grdBankName, grdRTGSNo);
      } else {
        moveNext(idx, field);
      }
    }
    else if (field === grdChequeAmount) {
      updateCell(idx, grdChequeAmount, fmt2(value));
      if (!calculation(idx, { ...row, [grdChequeAmount]: value })) return;
      if (vn(value) > 0) {
        // ChequeNo-க்கு போ (visible ஆ இருந்தா, இல்லாட்டி skip)
        goToOrSkip(grdChequeNo, grdChequeAmount);
      } else {
        updateCell(idx, grdChequeNo, "");
        updateCell(idx, grdChequeDate, "");
        // Discount-க்கு போ (visible ஆ இருந்தா, இல்லாட்டி skip)
        goToOrSkip(grdDiscountAmount, grdChequeAmount);
      }
    }
    else if (field === grdChequeNo) {
      if (vn(row[grdChequeAmount]) > 0) {
        // ChequeDate-க்கு போ (visible ஆ இருந்தா, இல்லாட்டி skip)
        goToOrSkip(grdChequeDate, grdChequeNo);
      } else {
        moveNext(idx, field);
      }
    }
    else if (field === grdChequeDate) {
      if (vn(row[grdChequeAmount]) > 0) {
        // BankName-க்கு போ (visible ஆ இருந்தா, இல்லாட்டி skip)
        goToOrSkip(grdBankName, grdChequeDate);
      } else {
        moveNext(idx, field);
      }
    }
    else if (field === grdDiscountAmount) {
      updateCell(idx, grdDiscountAmount, fmt2(value));
      if (!calculation(idx, { ...row, [grdDiscountAmount]: value })) return;
      moveNext(idx, field);
    }
    else if (field === grdAmount) {
      const c = vn(row[grdCashAmount]), rt = vn(row[grdRTGSAmt]),
            ch = vn(row[grdChequeAmount]), di = vn(row[grdDiscountAmount]);
      if (vn(value) > 0 && (c > 0 || rt > 0 || ch > 0 || di > 0)) {
        if (!calculation(idx)) return;
        if (sess.PaymentBillWise) {
          const sid = row[grdSupplierRefId];
          openPendingBills(idx, sid);
        } else {
          moveNext(idx, field);
        }
      } else {
        if (!calculation(idx)) return;
        focusCell(idx, grdCashAmount);
        toast("❌ Enter Any one Payment Option!!!", true);
      }
    }
    else {
      moveNext(idx, field);
    }
  }, [calculation, moveNext, focusCell, updateCell, toast, sess.PaymentBillWise, deleteRow, visibleColumns, openPendingBills]);

  // ── Popup selection handlers ─────────────────────────────────────────────
  const onSupplierSelect = useCallback((item) => {
    const idx = supplierPopup.rowIdx;
    updateCells(idx, {
      [grdSupplierName]:  item.AccountName || "",
      [grdSupplierRefId]: item.Id ?? null,
    });
    setSupplierPopup({ open:false, rowIdx:null, prefill:"" });
    balanceFetch(item.Id, selDate, idx);
    moveNext(idx, grdSupplierName);
  }, [supplierPopup.rowIdx, updateCells, balanceFetch, selDate, moveNext]);

  const onBankSelect = useCallback((item) => {
    const idx = bankPopup.rowIdx;
    updateCells(idx, {
      [grdBankName]: item.AccountName || "",
      [grdBankId]:   item.Id ?? null,
    });
    setBankPopup({ open:false, rowIdx:null, prefill:"" });
    moveNext(idx, grdBankName);
  }, [bankPopup.rowIdx, updateCells, moveNext]);

  // ── Inline cell renderer (mirrors CustomerReceipt renderCell exactly) ────
  function renderCell(row, realIdx, colDef) {
    const { field, type, readonly } = colDef;
    const value   = row[field] ?? (colDef.type === "float" || colDef.type === "int" ? "0.00" : "");
    const inView  = !!(row[grdId] && row[grdEditMode] === 0);
    const readOnly = !!(inView || readonly);

    const base = {
      background:  readOnly ? "transparent" : "#fff",
      border:      readOnly ? "none" : "1px solid #93c5fd",
      borderRadius: readOnly ? 0 : 4,
      color:       readOnly ? "inherit" : "#1e293b",
      boxShadow:   readOnly ? "none" : "0 0 0 2px rgba(59,130,246,.12)",
      padding:     readOnly ? "2px 4px" : undefined,
      cursor:      readOnly ? "default" : "text",
    };
    const numStyle = { ...base, textAlign:"right" };
    const ref = el => {
      if (el) inputRefs.current[`${realIdx}-${field}`] = el;
      else delete inputRefs.current[`${realIdx}-${field}`];
    };

    // toggle (checkbox)
    if (type === "toggle") {
      const isOn = value === true || value === 1;
      return (
        <div
          ref={ref} tabIndex={readOnly ? -1 : 0}
          onKeyDown={e => {
            if (e.key === " ") { e.preventDefault(); if (!readOnly) updateCell(realIdx, field, !isOn); }
            if (e.key === "Enter") { e.preventDefault(); if (!readOnly) updateCell(realIdx, field, !isOn); moveNext(realIdx, field); }
          }}
          onClick={() => { if (!readOnly) updateCell(realIdx, field, !isOn); }}
          style={{ display:"flex",justifyContent:"center",alignItems:"center",outline:"none",borderRadius:4 }}
          onFocus={() => setSelIdx(realIdx)}>
          <div style={{ width:34,height:18,borderRadius:9,background:isOn?"#16a34a":"#d1d5db",
            position:"relative",cursor:readOnly?"not-allowed":"pointer",transition:"background .2s",flexShrink:0 }}>
            <div style={{ position:"absolute",top:2,left:isOn?16:2,width:14,height:14,borderRadius:"50%",
              background:"#fff",boxShadow:"0 1px 3px rgba(0,0,0,.25)",transition:"left .2s" }} />
          </div>
        </div>
      );
    }

    // popup (supplier / bank)
    if (type === "popup") {
      const openPopup = () => {
        if (readOnly) return;
        if (field === grdSupplierName) setSupplierPopup({ open:true, rowIdx:realIdx, prefill:String(value) });
        else if (field === grdBankName) setBankPopup({ open:true, rowIdx:realIdx, prefill:String(value) });
      };
      return (
        <input ref={ref} className="mp-cell-input" type="text" readOnly
          value={String(value)}
          style={{ ...base, cursor:readOnly?"default":"pointer", background:readOnly?"transparent":"#f8fafc" }}
          placeholder={readOnly ? "" : "Enter to select…"}
          onFocus={() => setSelIdx(realIdx)}
          onClick={openPopup}
          onKeyDown={e => handleCellKeyDown(e, realIdx, field)} />
      );
    }

    // date
    if (type === "date") return (
      <input ref={ref} className="mp-cell-input" type="date"
        value={String(value).slice(0,10) || ""}
        readOnly={readOnly}
        style={{ ...base, width:"100%", fontSize:12 }}
        onFocus={() => setSelIdx(realIdx)}
        onKeyDown={e => handleCellKeyDown(e, realIdx, field)}
        onChange={e => !readOnly && updateCell(realIdx, field, e.target.value)} />
    );

    // numeric / string
    const isNum = type === "float" || type === "int";
    return (
      <input ref={ref} className="mp-cell-input" type="text"
        value={String(value)}
        readOnly={readOnly}
        style={isNum ? numStyle : base}
        onFocus={() => setSelIdx(realIdx)}
        onKeyDown={e => handleCellKeyDown(e, realIdx, field)}
        onChange={e => {
          if (readOnly) return;
          if (isNum) updateCell(realIdx, field, e.target.value);
          else CC.applyUppercase(e, v => updateCell(realIdx, field, v));
        }}
        onBlur={e => {
          if (readOnly) return;
          if (type === "float") updateCell(realIdx, field, fmt2(e.target.value));
          if (type === "int")   updateCell(realIdx, field, String(parseInt(e.target.value) || 0));
        }} />
    );
  }

  // ── Global keyboard shortcuts ─────────────────────────────────────────────
  const anyPopupOpen = () => supplierPopup.open || bankPopup.open || !!pwModal || !!pendingWin;

  useEffect(() => {
    const onKey = (e) => {
      if (e.keyCode === 27) {
        e.preventDefault();
        if (supplierPopup.open) { setSupplierPopup({ open:false,rowIdx:null,prefill:"" }); return; }
        if (bankPopup.open)     { setBankPopup({ open:false,rowIdx:null,prefill:"" }); return; }
        if (f5Open)             { setF5Open(false); return; }
        if (f12Open)            { setF12Open(false); return; }
        confirm("Do You Want To Quit Page?").then(ok => { if (ok) navigate("/Home"); });
        return;
      }
      if (anyPopupOpen()) return;
      if (e.keyCode === 112) { e.preventDefault(); if (!sess.PaymentBillWise) paymentSave([]); }   // F1
      if (e.keyCode === 116) { e.preventDefault(); setF5Open(true); }                              // F5
      if (e.keyCode === 123) { e.preventDefault(); setF12Open(true); }                             // F12
      if (e.keyCode === 46 && !e.ctrlKey && selIdx != null) { e.preventDefault(); deleteRow(selIdx); } // Del
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line
  }, [supplierPopup.open, bankPopup.open, pwModal, pendingWin, f5Open, f12Open,
      selIdx, paymentSave, deleteRow, confirm, navigate, sess.PaymentBillWise]);

  // ── Block until authorized ───────────────────────────────────────────────
  if (!isAuthorized) return null;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="mp-wrap supplier-page">
      {ConfirmUI}

      {/* ── Supplier Popup ── */}
      {supplierPopup.open && (
        <PopupWindow title="Select Supplier" onClose={() => setSupplierPopup({ open:false,rowIdx:null,prefill:"" })} width={420}>
          <SearchableList items={suppliers} labelField="AccountName" prefill={supplierPopup.prefill}
            placeholder="Search Supplier…" onChange={onSupplierSelect}
            onClose={() => setSupplierPopup({ open:false,rowIdx:null,prefill:"" })} />
        </PopupWindow>
      )}

      {/* ── Bank Popup ── */}
      {bankPopup.open && (
        <PopupWindow title="Select Bank" onClose={() => setBankPopup({ open:false,rowIdx:null,prefill:"" })} width={340}>
          <SearchableList items={banks} labelField="AccountName" prefill={bankPopup.prefill}
            placeholder="Search Bank…" onChange={onBankSelect}
            onClose={() => setBankPopup({ open:false,rowIdx:null,prefill:"" })} />
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
          onPrint={() => { openVoucherPrint("1"); toast("✅ " + pvDialog.message); setPvDialog(null); fillGridData(); }}
          onView ={() => { openVoucherPrint("0"); toast("✅ " + pvDialog.message); setPvDialog(null); fillGridData(); }}
          onNo   ={() => { toast("✅ " + pvDialog.message); setPvDialog(null); fillGridData(); }} />
      )}

      {/* ── Pending Bills Window ── */}
      {pendingWin && (() => {
        const row = gridRef.current[pendingWin.rowIdx] || {};
        return (
          <PendingBillsWindow
            bills={pendingWin.bills}
            supplierName={row[grdSupplierName] || ""}
            totalAmount={row[grdAmount] || "0"}
            onConfirm={(details) => {
              setPendingWin(null);
              const filtered = details.filter(d => d.EnterAmt && vn(d.EnterAmt) !== 0);
              paymentSave(filtered);
            }}
            onClose={() => setPendingWin(null)} />
        );
      })()}

      {/* ── F5 View Window ── */}
      {f5Open && (
        <F5ViewWindow
          suppliers={suppliers} comid={sess.Comid} mcomid={sess.MComid}
          onClose={() => setF5Open(false)}
          onPrintView={doPrintView}
          loading={loading} setLoading={setLoading} />
      )}

      {/* ── F12 Column Settings ── */}
      {f12Open && <F12Popup colSettings={colSettings} onSave={saveColSettings} onClose={() => setF12Open(false)} />}

      <Topbar />

      <div className="mp-body">
        {/* ── TOP TOOLBAR ── */}
        <div className="mp-toolbar" style={{ display:"flex",alignItems:"center",gap:8,padding:"6px 10px",flexWrap:"wrap" }}>
          <div className="mp-toolbar-title">Supplier Payment</div>

          {/* Date picker */}
          <div style={{ display:"flex",alignItems:"center",gap:6,marginLeft:12 }}>
            <label style={{ fontSize:12,fontWeight:600,color:"#475569" }}>Date</label>
            <input type="date" className="mp-cell-input"
              style={{ height:28,width:150,border:"1px solid #93c5fd",borderRadius:4 }}
              value={selDate}
              onChange={e => setSelDate(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") fillGridData(); }} />
          </div>

          {/* Current balance */}
          <div style={{ marginLeft:"auto",display:"flex",alignItems:"center",gap:6,
            background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:6,padding:"4px 12px" }}>
            <span style={{ fontSize:12,fontWeight:600,color:"#15803d" }}>Balance:</span>
            <span style={{ fontSize:14,fontWeight:700,color:"#15803d" }}>{currentBalance}</span>
          </div>
        </div>

        {/* ── GRID ── */}
        <div className="mp-grid-wrap" style={{ overflowX:"auto",overflowY:"auto" }}>
          <table className="mp-tbl" style={{
            minWidth: visibleColumns.reduce((a,c) => a + c.width, 110) + "px",
            tableLayout:"fixed", width:"100%"
          }}>
            <thead>
              <tr>
                <th style={{ width:44 }}>S.No</th>
                {visibleColumns.map(c => (
                  <th key={c.field} style={{ width:c.width, minWidth:c.width,
                    textAlign: c.type==="float" || c.type==="toggle" ? "center" : undefined }}>
                    {c.label}
                  </th>
                ))}
                <th style={{ width:44,textAlign:"center" }}>Del</th>
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
                      <button className="mp-del-btn"
                        onClick={e => { e.stopPropagation(); deleteRow(idx); }}>🗑</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {grid.length === 0 && !loading && (
            <div className="mp-empty">No records. Press ➕ to add a row.</div>
          )}
        </div>

        {/* ── BOTTOM TOOLBAR ── */}
        <div className="mp-toolbar" style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 10px",flexWrap:"wrap" }}>
          <button className="mp-btn nw" onClick={addRow} disabled={loading}>➕ Add Row</button>
          <button className="mp-btn sv"
            onClick={() => { if (!sess.PaymentBillWise) paymentSave([]); }}
            disabled={loading}>💾 F1 Save</button>
          <button className="mp-btn" style={{ background:"#0891b2",color:"#fff",borderColor:"#0891b2" }}
            onClick={fillGridData} disabled={loading}>🔄 Reload Date</button>
          <button className="mp-btn" style={{ background:"#7c3aed",color:"#fff",borderColor:"#7c3aed" }}
            onClick={() => setF5Open(true)} disabled={loading}>📋 F5 View</button>
          <button className="mp-btn"
            style={{ background:"var(--color-background-secondary)",color:"var(--color-text-primary)",border:"1px solid #9ca3af" }}
            onClick={() => setF12Open(true)}>⚙ F12 Columns</button>
          <button className="mp-btn dl"
            onClick={() => confirm("Do You Want To Quit Page?").then(ok => { if (ok) navigate("/Home"); })}
            style={{ marginLeft:"auto" }}>✕ Esc Quit</button>
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