// ─────────────────────────────────────────────────────────────────────────────
//  StockAdjustment.jsx
//
//  Full React port of StockAdjustment.js (jQuery/jqxGrid → React hooks).
//  Structure, layout & patterns mirror BankVoucher.jsx exactly.
//
//  SESSION
//   • Comid, MComid, MirrorTable from localStorage
//   • BatchStatus  ← Mainsetting[0].BatchWiseStock || Mainsetting[0].TextilesSerialNowiseBilling
//   • MultipleUOMBilling ← Mainsetting[0].MultipleUOMBilling
//   • univercell   ← Mainsetting[0].univercell  (governs Edit-lock rules on DAMAGE / Repair Return rows)
//
//  TOP FORM
//   • Date   (AdjustDate)                       — Enter → focus Type
//   • Type   (AdjustType) dropdown (typelist)    — Enter → reload empty grid
//   • Adjustment Ref No (readonly, server max+1)
//   • Remarks
//   • Total Qty / Total Amt (readonly, calculated)
//
//  GRID COLUMNS (matches JS gridcolumns exactly)
//   ProductCode(popup) | Description(readonly) | StockQty(readonly) | Qty | Rate | Amount(readonly)
//   Hidden: ProductRefId, PDId, Nstock, BatchRefid, UOMRefid, NomQty, StockQtyNew,
//           MfgDate, ExpiryDate, UOMDecimal, RealQty, EditMode
//
//  KEY BEHAVIOURS
//   1. ProductCode Enter (empty) → open Item Description popup (search/select)
//   2. ProductCode Enter (value) → FillItemCode → resolves Batch / MRP-duplicate / Multi-UOM
//      windows as needed, then fills row via FillItems/FillBatchItems
//   3. Qty Enter      : validates >0, decimal precision per row's UOMDecimal, → next cell
//   4. Rate Enter     : fix(2) → Amount cell
//   5. Everything else → default next-cell logic (next visible column, or ProductCode of next row)
//   6. F1 → permission check, gridemptycheck, AllowStock* server-side style validation
//      (Excess/Free Sample treated as "purchase-like" stock-increase types; all other
//      types are "sale-like" stock-decrease types requiring sufficient RealQty/Stock),
//      confirm, InsertStockAdjustment API, toast + Clear()
//   7. F3 → PasswordModal → prompt for Adjustment Ref No → FillStockAdjustment(0, No)
//   8. F5 → F5ViewWindow (date range + Type filter) → SelectStockAdjustment
//      double-click row → PasswordModal → FillStockAdjustment(Id, 0)
//   9. F9 → PasswordModal → AllowStockAllDelete check → confirm → DeleteStockAdjustment
//  10. F10 → confirm → Clear()
//  11. Del on a row → (if EditId != 0) AllowStock check first, then confirm → remove row
//  12. Esc → close open popup, else confirm quit to /Home
//  13. univercell edit-lock: on FillStockAdjustment, if RepairReturnMasterRefId != null →
//      block edit; if AdjustType === "DAMAGE" and FMStatus is 1 or 2 → block edit with message
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../Master/MasterPage.css";


import Topbar from "../components/Topbar";
import * as CC from "../components/Common";
import * as MSG from "../components/Messages";

// ─── Extra endpoints (Stock Adjustment specific) ─────────────────────────────
const ItemMasterSelectByCode   = "/api/ItemMasterApp/SelectItemMasterbyCodeId";
const ItemMasterSelectAll      = "/api/ItemMasterApp/SelectItemMaster";
const StockAdjustmentMaxNo     = "/api/StockAdjustmentApp/MaxAdjustmentNo";
const StockAdjustmentInsert    = "/api/StockAdjustmentApp/InsertStockAdjustment";
const StockAdjustmentEdit      = "/api/StockAdjustmentApp/EditStockAdjustment";
const StockAdjustmentDelete    = "/api/StockAdjustmentApp/DeleteStockAdjustment";
const StockAdjustmentSelect    = "/api/StockAdjustmentApp/SelectStockAdjustment";

// ─── Field-name constants (match JS exactly) ─────────────────────────────────
const grdProductCode  = "ProductCode";
const grdProductName  = "ProductName"; 
const grdProductId    = "ProductRefId";
const grdRate         = "LandingCost";
const grdQuantity     = "ItemQty";
const grdUOMDecimal   = "UOMDecimal";
const grdRealQty      = "RealQty";
const grdBatchRefid   = "BatchRefid";
const grdUOMRefid     = "UOMRefid";
const grdNOMSQty      = "NomQty";
const grdStockQtyNew  = "StockQtyNew";
const grdAmount       = "Amount";
const grdId           = "PDId";
const grdNStock       = "Nstock";
const grdEditMode     = "EditMode";
const grdStockQty     = "StockQty";
const grdExpiryDate   = "ExpiryDate";
const grdMfgDate      = "MfgDate";

const typelist = [
  "Wastage",
  "Breakage",
  "Damage",
  "Excess",
  "Expired",
  "Free Sample",
  "Man Handling",
  "Shortage",
];

// Types treated like the JS "Excess / Free Sample" branch (stock-increase / purchase-like)
const PURCHASE_LIKE_TYPES = ["Excess", "Free Sample"];

// ─── Column navigation order (mirrors JS GirdNextCell default order) ────────
const COL_NAV = [
  grdProductCode,
  grdStockQty,
  grdQuantity,
  grdRate,
  grdAmount,
];

// ─── ALL_COLUMNS definition (visible/hidden/widths match JS gridcolumns) ─────
const ALL_COLUMNS = [
  { field: grdProductCode, label: "Product Code", type: "popup",    width: 130, hidden: false },
  { field: grdProductName, label: "Description",  type: "readonly", width: 300, hidden: false },
  { field: grdStockQty,    label: "StockQty",      type: "readonly", width: 100, hidden: false },
  { field: grdQuantity,    label: "Qty",           type: "qty",      width: 100, hidden: false },
  { field: grdRate,        label: "Rate",          type: "float",    width: 100, hidden: false },
  { field: grdAmount,      label: "Amount",        type: "readonly", width: 100, hidden: false },
];

// ─── makeNewRow ───────────────────────────────────────────────────────────────
const makeNewRow = () => ({
  [grdId]:           null,
  [grdEditMode]:      1,
  [grdProductCode]:   "",
  [grdProductName]:   "",
  [grdProductId]:     null,
  [grdStockQty]:      "",
  [grdQuantity]:      "",
  [grdRate]:          "0.00",
  [grdAmount]:        "0.00",
  [grdUOMDecimal]:    0,
  [grdNStock]:        0,
  [grdBatchRefid]:    null,
  [grdUOMRefid]:      null,
  [grdNOMSQty]:       null,
  [grdStockQtyNew]:   0,
  [grdMfgDate]:       "",
  [grdExpiryDate]:    "",
  [grdRealQty]:       0,
  _uid: CC.uid(),
});

const vn      = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const fmt2    = (v) => vn(v).toFixed(2);
const todayISO = () => new Date().toISOString().slice(0, 10);
const isoToMDY = (iso) => { if (!iso) return ""; const [y, m, d] = iso.split("-"); return `${m}/${d}/${y}`; };

const fmtByDecimal = (v, decimal) => {
  const n = vn(v);
  if (decimal === 2) return n.toFixed(2);
  if (decimal === 3) return n.toFixed(3);
  return n.toFixed(0);
};

// ─────────────────────────────────────────────────────────────────────────────
// POPUP WINDOW (reusable — identical to BankVoucher)
// ─────────────────────────────────────────────────────────────────────────────
function PopupWindow({ title, children, onClose, width = 700, height = 460 }) {
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
// ITEM DESCRIPTION SEARCHABLE LIST (mirrors #input + gridItemDescriptionWindow)
// ─────────────────────────────────────────────────────────────────────────────
function SearchableList({ items, labelField, codeField, prefill, onChange, onClose, placeholder }) {
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
      if (filtered.length === 0) return;
      const target = fi >= 0 ? filtered[fi] : filtered[0];
      if (target) pick(target);
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
        <table className="mp-tbl" style={{ tableLayout:"fixed",width:"100%" }}>
          <thead>
            <tr>
              <th style={{ width:100 }}>Product Code</th>
              <th>Product Name</th>
              <th style={{ width:120,textAlign:"right" }}>Landing Cost</th>
              <th style={{ width:120,textAlign:"right" }}>Opening Stock</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={4} style={{ padding:12,color:"#94a3b8",fontSize:12,textAlign:"center" }}>No results</td></tr>
            )}
            {filtered.map((item, i) => (
              <tr key={i} tabIndex={0}
                style={{ cursor:"pointer", background: fi===i ? "#dbeafe" : "transparent" }}
                onClick={() => pick(item)}
                onKeyDown={e => itemKeyDown(e, item, i)}
                onFocus={() => setFi(i)}>
                <td>{item[codeField]}</td>
                <td>{item[labelField]}</td>
                <td style={{ textAlign:"right" }}>{item.LandingCost}</td>
                <td style={{ textAlign:"right" }}>{item.OpeningStock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding:"4px 10px",fontSize:10,color:"#94a3b8",borderTop:"1px solid #f1f5f9",flexShrink:0 }}>
        ↑↓ Navigate &nbsp;|&nbsp; Enter Select &nbsp;|&nbsp; Esc Close
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH WINDOW (mirrors gridbatch / BatchWindow)
// ─────────────────────────────────────────────────────────────────────────────
function BatchWindow({ items, onChange, onClose }) {
  const [fi, setFi] = useState(0);
  const listRef = useRef(null);

  useEffect(() => { setTimeout(() => listRef.current?.children[0]?.focus(), 60); }, []);

  const itemKeyDown = (e, item, i) => {
    if (e.key === "Enter")     { e.preventDefault(); onChange(item); }
    if (e.key === "ArrowDown") { e.preventDefault(); const nx = Math.min(i+1, items.length-1); setFi(nx); listRef.current?.children[nx]?.focus(); }
    if (e.key === "ArrowUp")   { e.preventDefault(); const pv = Math.max(i-1, 0); setFi(pv); listRef.current?.children[pv]?.focus(); }
    if (e.key === "Escape")    onClose();
  };

  return (
    <div ref={listRef} style={{ overflowY:"auto",flex:1 }}>
      <table className="mp-tbl" style={{ tableLayout:"fixed",width:"100%" }}>
        <thead>
          <tr>
            <th>Batch No</th>
            <th style={{ width:110,textAlign:"right" }}>Stock</th>
            <th style={{ width:110 }}>Mfg Date</th>
            <th style={{ width:110 }}>Expiry Date</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} tabIndex={0}
              style={{ cursor:"pointer", background: fi===i ? "#dbeafe" : "transparent" }}
              onClick={() => onChange(item)}
              onKeyDown={e => itemKeyDown(e, item, i)}
              onFocus={() => setFi(i)}>
              <td>{item.BatchNo}</td>
              <td style={{ textAlign:"right" }}>{item.Stock}</td>
              <td>{item.MFdate ? String(item.MFdate).slice(0,10) : ""}</td>
              <td>{item.Expdate ? String(item.Expdate).slice(0,10) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MRP / DUPLICATE-CODE WINDOW (mirrors gridmrp / MRPWindow)
// ─────────────────────────────────────────────────────────────────────────────
function MrpWindow({ items, onChange, onClose }) {
  const [fi, setFi] = useState(0);
  const listRef = useRef(null);

  useEffect(() => { setTimeout(() => listRef.current?.children[0]?.focus(), 60); }, []);

  const itemKeyDown = (e, item, i) => {
    if (e.key === "Enter")     { e.preventDefault(); onChange(item); }
    if (e.key === "ArrowDown") { e.preventDefault(); const nx = Math.min(i+1, items.length-1); setFi(nx); listRef.current?.children[nx]?.focus(); }
    if (e.key === "ArrowUp")   { e.preventDefault(); const pv = Math.max(i-1, 0); setFi(pv); listRef.current?.children[pv]?.focus(); }
    if (e.key === "Escape")    onClose();
  };

  return (
    <div ref={listRef} style={{ overflowY:"auto",flex:1 }}>
      <table className="mp-tbl" style={{ tableLayout:"fixed",width:"100%" }}>
        <thead>
          <tr>
            <th>Product Name</th>
            <th style={{ width:110,textAlign:"right" }}>Landing Cost</th>
            <th style={{ width:110,textAlign:"right" }}>Stock</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} tabIndex={0}
              style={{ cursor:"pointer", background: fi===i ? "#dbeafe" : "transparent" }}
              onClick={() => onChange(item)}
              onKeyDown={e => itemKeyDown(e, item, i)}
              onFocus={() => setFi(i)}>
              <td>{item.ProductName}</td>
              <td style={{ textAlign:"right" }}>{item.LandingCost}</td>
              <td style={{ textAlign:"right" }}>{item.Stock}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-UOM WINDOW (mirrors gridunit / Unitwindow)
// ─────────────────────────────────────────────────────────────────────────────
function UnitWindow({ items, onChange, onClose }) {
  const [rows, setRows] = useState(items.map(it => ({ ...it })));
  const [fi, setFi] = useState(0);
  const listRef = useRef(null);

  useEffect(() => { setTimeout(() => listRef.current?.children[0]?.focus(), 60); }, []);

  const itemKeyDown = (e, item, i) => {
    if (e.key === "Enter")     { e.preventDefault(); onChange(item); }
    if (e.key === "ArrowDown") { e.preventDefault(); const nx = Math.min(i+1, rows.length-1); setFi(nx); listRef.current?.children[nx]?.focus(); }
    if (e.key === "ArrowUp")   { e.preventDefault(); const pv = Math.max(i-1, 0); setFi(pv); listRef.current?.children[pv]?.focus(); }
    if (e.key === "Escape")    onClose();
  };

  return (
    <div ref={listRef} style={{ overflowY:"auto",flex:1 }}>
      <table className="mp-tbl" style={{ tableLayout:"fixed",width:"100%" }}>
        <thead>
          <tr>
            <th>UOM</th>
            <th style={{ width:90,textAlign:"right" }}>Nos</th>
            <th style={{ width:110,textAlign:"right" }}>Sale Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, i) => (
            <tr key={i} tabIndex={0}
              style={{ cursor:"pointer", background: fi===i ? "#dbeafe" : "transparent" }}
              onClick={() => onChange(item)}
              onKeyDown={e => itemKeyDown(e, item, i)}
              onFocus={() => setFi(i)}>
              <td>{item.UOMName}</td>
              <td style={{ textAlign:"right" }}>
                <input className="mp-cell-input" type="text" value={item.Nos ?? ""}
                  style={{ width:"100%",textAlign:"right" }}
                  onChange={e => setRows(p => p.map((r,ix) => ix===i ? { ...r, Nos:e.target.value } : r))} />
              </td>
              <td style={{ textAlign:"right" }}>{item.SaleRate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPIRY / MFG DATE WINDOW (mirrors gridexp / ExpWindow)
// ─────────────────────────────────────────────────────────────────────────────
function ExpWindow({ items, onChange, onClose }) {
  const [fi, setFi] = useState(0);
  const listRef = useRef(null);

  useEffect(() => { setTimeout(() => listRef.current?.children[0]?.focus(), 60); }, []);

  const itemKeyDown = (e, item, i) => {
    if (e.key === "Enter")     { e.preventDefault(); onChange(item); }
    if (e.key === "ArrowDown") { e.preventDefault(); const nx = Math.min(i+1, items.length-1); setFi(nx); listRef.current?.children[nx]?.focus(); }
    if (e.key === "ArrowUp")   { e.preventDefault(); const pv = Math.max(i-1, 0); setFi(pv); listRef.current?.children[pv]?.focus(); }
    if (e.key === "Escape")    onClose();
  };

  return (
    <div ref={listRef} style={{ overflowY:"auto",flex:1 }}>
      <table className="mp-tbl" style={{ tableLayout:"fixed",width:"100%" }}>
        <thead>
          <tr>
            <th>Mfg Date</th>
            <th>Expiry Date</th>
            <th style={{ width:90,textAlign:"right" }}>Stock</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} tabIndex={0}
              style={{ cursor:"pointer", background: fi===i ? "#dbeafe" : "transparent" }}
              onClick={() => onChange(item)}
              onKeyDown={e => itemKeyDown(e, item, i)}
              onFocus={() => setFi(i)}>
              <td>{item.MFdate ? String(item.MFdate).slice(0,10) : ""}</td>
              <td>{item.Expdate ? String(item.Expdate).slice(0,10) : ""}</td>
              <td style={{ textAlign:"right" }}>{item.Stock}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
// F5 VIEW WINDOW  (mirrors F5View + gridf5view + nested details grid)
// ─────────────────────────────────────────────────────────────────────────────
function F5ViewWindow({ comid, onClose, onSelectRow, onEditRow, onDeleteRow, loading, setLoading }) {
  const [fromDate, setFromDate] = useState(todayISO());
  const [toDate,   setToDate  ] = useState(todayISO());
  const [type,     setType    ] = useState(typelist[0]);
  const [masters,  setMasters ] = useState([]);
  const [details,  setDetails ] = useState([]);
  const [total,    setTotal   ] = useState("0.00");
  const [selIdx,   setSelIdx  ] = useState(null);
  const [expandedIdx, setExpandedIdx] = useState(null);

  const doView = useCallback(async () => {
    if (!fromDate || !toDate) { alert("Select From/To dates"); return; }
    if (isoToMDY(fromDate) > isoToMDY(toDate)) { alert("From Date Is Greater Than To Date"); return; }
    setLoading(true);
    const res = await CC.api(StockAdjustmentSelect, null, {}, {
      Comid: Number(comid), Fromdate: isoToMDY(fromDate), Todate: isoToMDY(toDate), Id: 0, fault: false
    });
    setLoading(false);
    if (!res.ok) { alert(res.message || "Error loading data"); return; }
    const dataset = Array.isArray(res.Data) ? res.Data[0] : (res.data?.[0] || {});
    const masterdata = dataset?.purchasemaster || dataset?.AdjustMaster || [];
    const detailsdata = dataset?.purchasedetails || dataset?.AdjustDetails || [];
    setMasters(masterdata);
    setDetails(detailsdata);
    const t = masterdata.reduce((a, r) => a + vn(r.NetAmt ?? r.Amount), 0).toFixed(2);
    setTotal(t);
  }, [fromDate, toDate, comid, setLoading]);

  useEffect(() => { doView(); }, []); // eslint-disable-line

  const rowsForMaster = (id) => details.filter(d => d.PurchaseRefId === id || d.AdjustRefId === id);

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(10,20,40,0.5)",
      zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ background:"#fff",borderRadius:8,width:"82vw",maxHeight:"88vh",
        display:"flex",flexDirection:"column",boxShadow:"0 16px 48px rgba(0,0,0,.3)" }}>
        {/* header */}
        <div style={{ background:"#1a2e4a",color:"#fff",padding:"10px 16px",fontSize:13,
          fontWeight:700,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
          <span>📋 Stock Adjustment — F5 View</span>
          <button style={{ background:"none",border:"none",color:"#fff",fontSize:17,cursor:"pointer" }} onClick={onClose}>✕</button>
        </div>
        {/* filter bar */}
        <div style={{ padding:"8px 14px",display:"flex",gap:12,alignItems:"center",flexWrap:"wrap" }}>
          <label style={{ fontSize:12,fontWeight:600,color:"#475569" }}>From</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            style={{ height:28,width:140,border:"1px solid #93c5fd",borderRadius:4 }} />
          <label style={{ fontSize:12,fontWeight:600,color:"#475569" }}>To</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            style={{ height:28,width:140,border:"1px solid #93c5fd",borderRadius:4 }} />
          <label style={{ fontSize:12,fontWeight:600,color:"#475569" }}>Type</label>
          <select value={type} onChange={e => setType(e.target.value)}
            style={{ height:28,width:150,border:"1px solid #93c5fd",borderRadius:4 }}>
            {typelist.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
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
                <th style={{ width:120 }}>AdjustNo</th>
                <th style={{ width:120 }}>AdjustDate</th>
                <th style={{ width:130 }}>AdjustType</th>
                <th style={{ width:120,textAlign:"right" }}>Amount</th>
                <th>Remarks</th>
                <th style={{ width:130,textAlign:"center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {masters.map((r, i) => (
                 <React.Fragment key={r.Id || i}>
                  <tr key={i}
                    className={selIdx === i ? "sel" : ""}
                    onClick={() => setSelIdx(i)}
                    onDoubleClick={() => onSelectRow(r.Id)}
                    style={{ cursor:"pointer" }}>
                    <td className="sno">
                      <span style={{ cursor:"pointer", marginRight:6 }}
                        onClick={(e) => { e.stopPropagation(); setExpandedIdx(p => p === i ? null : i); }}>
                        {expandedIdx === i ? "▾" : "▸"}
                      </span>
                      {i + 1}
                    </td>
                    <td>{r.PurchaseNo ?? r.AdjustNo}</td>
                    <td>{r.PurchaseDate ? String(r.PurchaseDate).slice(0,10) : (r.AdjustDate ? String(r.AdjustDate).slice(0,10) : "")}</td>
                    <td>{r.PurchaseType ?? r.AdjustType}</td>
                    <td style={{ textAlign:"right",fontWeight:600 }}>{fmt2(r.NetAmt ?? r.Amount)}</td>
                    <td>{r.SupplierName ?? r.Remarks}</td>
                    <td style={{ textAlign:"center" }}>
                      <button onClick={(e) => { e.stopPropagation(); onEditRow(r.Id); }} style={{
                        marginRight: 6, padding: "3px 10px", fontSize: 11, borderRadius: 4,
                        border: "1px solid #bfd4ff",
                        background: "#edf4ff",
                        color: "#2563eb", fontWeight: 600, cursor: "pointer",
                      }}>✏ Edit</button>
                      <button onClick={(e) => { e.stopPropagation(); onDeleteRow(r.Id, r.PurchaseNo ?? r.AdjustNo); }} style={{
                        padding: "3px 10px", fontSize: 11, borderRadius: 4,
                        border: "1px solid #fecaca", background: "#fee2e2",
                        fontWeight: 600, cursor: "pointer",
                      }}>🗑 Del</button>
                    </td>
                  </tr>
                  {expandedIdx === i && (
                    <tr>
                      <td></td>
                      <td colSpan={6} style={{ padding:"6px 10px",background:"#f8fafc" }}>
                        <table className="mp-tbl" style={{ width:"100%" }}>
                          <thead>
                            <tr>
                              <th style={{ width:100 }}>Code</th>
                              <th>Description</th>
                              <th style={{ width:90,textAlign:"right" }}>ItemQty</th>
                              <th style={{ width:100,textAlign:"right" }}>Rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rowsForMaster(r.Id).map((d, di) => (
                              <tr key={di}>
                                <td>{d.ProductCode}</td>
                                <td>{d.ProductName}</td>
                                <td style={{ textAlign:"right" }}>{fmt2(d.ItemQty)}</td>
                                <td style={{ textAlign:"right" }}>{d.PurchaseRate}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              
              ))}
            </tbody>
          </table>
          {masters.length === 0 && !loading && <div className="mp-empty">No records found.</div>}
        </div>
        {/* footer */}
        <div style={{ padding:"8px 14px",display:"flex",justifyContent:"space-between",
          alignItems:"center",borderTop:"1px solid #e5e7eb",flexShrink:0 }}>
          <span style={{ fontSize:11,color:"#94a3b8" }}>Double-click a row to edit it</span>
          <button className="mp-btn dl" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function StockAdjustment() {
  const navigate = useNavigate();
  const { confirm, ConfirmUI } = MSG.useConfirm();
  const { toast,   toasts    } = MSG.useToast();

  // ── Permission state ─────────────────────────────────────────────────────
  const [perm,         setPerm        ] = useState({ View:0,Add:0,Edit:0,Delete:0 });
  const [isAuthorized, setIsAuthorized] = useState(false);

  // ── Session ──────────────────────────────────────────────────────────────
  const [sess] = useState(() => {
    try {
      const main0 = (CC.getLocal("Mainsetting") || [{}])[0] || {};
      const Comid       = CC.getStr("Comid")  || "1";
      const MComid      = CC.getStr("MComid") || Comid;
      const MirrorTable = CC.getStr("MirrorTableOnline") || "0";
      const BatchStatus = (main0.BatchWiseStock === true || main0.TextilesSerialNowiseBilling === true) ? 1 : 0;
      return {
        Comid,
        MComid,
        MirrorTable,
        LocalDB: main0.LocalDB || 0,
        BatchStatus,
        MultipleUOMBilling: main0.MultipleUOMBilling === true,
        univercell: main0.univercell === true,
      };
    } catch {
      return { Comid:"1", MComid:"1", MirrorTable:"0", BatchStatus:0, MultipleUOMBilling:false, univercell:false };
    }
  });

  // ── Component state ──────────────────────────────────────────────────────
  const [grid,    setGrid   ] = useState([makeNewRow()]);
  const [loading, setLoading] = useState(false);
  const [selIdx,  setSelIdx ] = useState(0);
  const [totalAmt, setTotalAmt] = useState("");
  const [totalQty, setTotalQty] = useState("");

  // Top form
  const [adjustDate, setAdjustDate]   = useState(todayISO());
  const [adjustType, setAdjustType]   = useState(typelist[0]);
  const [adjustNo,   setAdjustNo]     = useState("");
  const [remarks,    setRemarks]      = useState("");

  // Edit-mode tracking
  const [editId,       setEditId]       = useState(0);
  const [updateIdEdit, setUpdateIdEdit] = useState("");
  const [realStockList, setRealStockList] = useState([]);

  // popup states
  const [itemPopup, setItemPopup] = useState({ open:false, rowIdx:null, prefill:"" });
  const [batchPopup, setBatchPopup] = useState(null);   // { rowIdx, list }
  const [mrpPopup,   setMrpPopup]   = useState(null);   // { rowIdx, list }
  const [unitPopup,  setUnitPopup]  = useState(null);   // { rowIdx, list }
  const [expPopup,   setExpPopup]   = useState(null);   // { rowIdx, list }
  const [pwModal,    setPwModal]    = useState(null);   // { purpose: 'F3'|'F5'|'F9'|'F5Edit'|'F5Delete', payload }
  const [f5Open,     setF5Open]     = useState(false);
  const [f5Key,      setF5Key]      = useState(0);

  // combo / lookup data
  const [productList, setProductList] = useState([]);

  // refs
  const gridRef     = useRef([makeNewRow()]);
  const inputRefs   = useRef({});
  const permRef     = useRef({ View:0,Add:0,Edit:0,Delete:0 });
  const dateRef     = useRef(null);
  const typeRef     = useRef(null);
  const refnoRef    = useRef(null);
  const remarksRef  = useRef(null);
  const f5IdRef     = useRef(null);
  const f5DeleteRef = useRef(null); // { id, no } for F5-row Delete button

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
    const menudata = menulist.filter(o => o.PageName === "Stock Adjustment");
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

  // ── Load product list on mount ───────────────────────────────────────────
  const loadProductList = useCallback(async () => {
    const res = await CC.api(
      ItemMasterSelectAll,
      null,
      {},
      {
        Comid: Number(sess.Comid),
        Startindex: 0,
        PageCount: 100,
        Keyword: "",
        Column: ""
      }
    );
  
    if (redirectIfDualLogin(res)) return;
  
    setProductList(
      Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.Data1)
        ? res.Data1
        : []
    );
  }, [redirectIfDualLogin, sess.Comid]);

  useEffect(() => {
    if (!isAuthorized) return;
    loadProductList();
  }, [isAuthorized]); // eslint-disable-line

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
      const next = prev.map((r, i) => i === idx ? { ...r, [field]:value, [grdEditMode]: r[grdEditMode] === 0 ? 1 : r[grdEditMode] } : r);
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
    let totalamount = 0;
    let totalqty = 0;
    const next = rows.map(r => {
      const nomqty = vn(r[grdNOMSQty]) === 0 ? 1 : vn(r[grdNOMSQty]);
      const qty = vn(r[grdQuantity]);
      const stockQtyNew = nomqty * qty;
      const amount = vn(r[grdRate]) * qty;
      const updated = { ...r, [grdStockQtyNew]: stockQtyNew, [grdAmount]: amount.toFixed(2) };
      totalamount += vn(updated[grdAmount]);
      totalqty += vn(updated[grdQuantity]);
      return updated;
    });
    gridRef.current = next;
    setGrid(next);
    setTotalAmt(totalamount.toFixed(2));
    setTotalQty(totalqty.toFixed(2));
  }, []);

  // ── addRow ───────────────────────────────────────────────────────────────
  const addRow = useCallback(() => {
    const blank = makeNewRow();
    setGrid(prev => {
      const next = [...prev, blank];
      gridRef.current = next;
      const idx = next.length - 1;
      setSelIdx(idx);
      focusCell(idx, grdProductCode);
      return next;
    });
  }, [focusCell]);

  // ── loadgrid (mirrors methods.loadgrid) ──────────────────────────────────
  const loadgrid = useCallback((data) => {
    let rows = Array.isArray(data) && data.length ? data.map(o => ({
      ...o,
      [grdStockQty]: fmtByDecimal(o[grdStockQty], o[grdUOMDecimal]),
      [grdQuantity]: fmtByDecimal(o[grdQuantity], o[grdUOMDecimal]),
      [grdRate]:     fmt2(o[grdRate]),
      [grdEditMode]: 0,
      _uid: CC.uid(),
    })) : [];
    rows = [...rows, makeNewRow()];
    gridRef.current = rows;
    setGrid(rows);
    const lastIdx = rows.length - 1;
    setSelIdx(lastIdx);
    calculation(rows);
  }, [calculation]);

  // ── Fetch max adjustment number ──────────────────────────────────────────
  const fetchMaxAdjustNo = useCallback(async () => {
    const res = await CC.api(StockAdjustmentMaxNo, null, {}, { Comid: Number(sess.Comid) });
    if (redirectIfDualLogin(res)) return;
    if (res.ok) setAdjustNo(res.No ?? "");
    else toast(`❌ ${res.error || "Could not fetch Adjustment No"}`, true);
  }, [sess.Comid, redirectIfDualLogin, toast]);

  // ── Clear (mirrors methods.Clear) ────────────────────────────────────────
  const clearGrid = useCallback(() => {
    setEditId(0);
    setUpdateIdEdit("");
    setTotalAmt("");
    setTotalQty("");
    setRemarks("");
    setRealStockList([]);
    setAdjustDate(todayISO());
    loadgrid([]);
    fetchMaxAdjustNo();
    setAdjustType(typelist[0]);
    setTimeout(() => dateRef.current?.focus(), 60);
  }, [loadgrid, fetchMaxAdjustNo]);

  // initial load
  useEffect(() => {
    if (!isAuthorized) return;
    clearGrid();
    // eslint-disable-next-line
  }, [isAuthorized]);

  // ── gridemptycheck (mirrors methods.gridemptycheck) ──────────────────────
  const gridemptycheck = useCallback((g) => {
    let cleaned = [...g];
    const last = cleaned[cleaned.length - 1];
    if (cleaned.length > 1 && (!last[grdProductCode] || last[grdProductCode] === "")) {
      cleaned = cleaned.slice(0, -1);
    }
    for (let i = 0; i < cleaned.length; i++) {
      const r = cleaned[i];
      if (r[grdEditMode] !== 1) continue;
      if (!r[grdProductCode]) {
        toast("❌ Enter All Code in the Grid !!!.", true);
        setSelIdx(i); focusCell(i, grdProductCode); return { ok:false, cleaned };
      }
      if (vn(r[grdQuantity]) === 0) {
        toast("❌ Enter All Qty in the Grid !!!.", true);
        setSelIdx(i); focusCell(i, grdProductId); return { ok:false, cleaned };
      }
      if (vn(r[grdRate]) === 0) {
        toast("❌ Enter All SaleRate in the Grid !!!.", true);
        setSelIdx(i); focusCell(i, grdRate); return { ok:false, cleaned };
      }
    }
    return { ok:true, cleaned };
  }, [toast, focusCell]);

  // ── AllowStock-style validation (business rule placeholders) ────────────
  // JS relied on externally-defined AllowStock / AllowStockAllSale /
  // AllowStockAllPurchase / AllowStockAllDelete helpers (not present in the
  // source file) to verify enough RealQty/Stock exists for "sale-like"
  // (stock-decreasing) adjustment types. We mirror the same call contract
  // here so business logic can be wired in without touching the UI.
  const isPurchaseLikeType = (type) => PURCHASE_LIKE_TYPES.includes(type);

  const allowStockAll = useCallback((rows, purchaseLike) => {
    // Stock-decreasing (sale-like) types must not let RealQty go negative.
    if (purchaseLike) return { ok: true };
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r[grdEditMode] !== 1 && r[grdId] == null) continue;
      const qty = vn(r[grdQuantity]);
      const stockQty = vn(r[grdStockQty]);
      if (vn(r[grdNStock]) === 1 && qty > stockQty) {
        return { ok: false, idx: i };
      }
    }
    return { ok: true };
  }, []);

  const allowStockSingle = useCallback((row, purchaseLike) => {
    if (purchaseLike) return true;
    const qty = vn(row[grdQuantity]);
    const stockQty = vn(row[grdStockQty]);
    if (vn(row[grdNStock]) === 1 && qty > stockQty) return false;
    return true;
  }, []);

  // ── deleteRow (mirrors Del key on grid) ──────────────────────────────────
  const deleteRow = useCallback((idx) => {
    const row = gridRef.current[idx];
    if (!row) return;
    const purchaseLike = isPurchaseLikeType(adjustType);

    const doRemove = () => {
      setGrid(prev => {
        const rowscount = prev.length;
        let next;
        if (rowscount > 1) next = prev.filter((_, i) => i !== idx);
        else next = [makeNewRow()];
        gridRef.current = next;
        const si = Math.max(0, next.length - 1);
        setSelIdx(si); focusCell(si, grdProductCode);
        calculation(next);
        return next;
      });
    };

    if (editId !== 0 && row[grdId] != null && row[grdId] !== "") {
      if (!allowStockSingle(row, purchaseLike)) {
        setSelIdx(idx); focusCell(idx, grdQuantity);
        toast("❌ Insufficient stock to remove this row !!!.", true);
        return;
      }
      confirm("Do you Want to Delete Row?").then(ok => { if (ok) doRemove(); });
    } else {
      confirm("Do you Want to Delete Row?").then(ok => { if (ok) doRemove(); });
    }
  }, [adjustType, editId, allowStockSingle, confirm, toast, focusCell, calculation]);

  // ── FillItems (mirrors methods.FillItems) ────────────────────────────────
  const fillItems = useCallback((item, rowIdx) => {
    if (!item) {
      toast("❌ Invaild Product Code !!!.", true);
      setSelIdx(rowIdx); focusCell(rowIdx, grdProductCode);
      return;
    }
    const stock = fmtByDecimal(item.Stock, item.UOMDecimal);
    updateCells(rowIdx, {
      [grdProductCode]: item.ProductCode,
      [grdProductId]:   item.Id,
      [grdProductName]: item.ProductName,
      [grdUOMDecimal]:  item.UOMDecimal,
      [grdNStock]:      item.Nstock,
      [grdRate]:        vn(item.LandingCost).toFixed(2),
      [grdStockQty]:    stock,
      [grdEditMode]:    1,
    });
    if (item.ManufactureDate === 1 || item.ExpriyDate === 1) {
      setExpPopup({ rowIdx, list: item._expList || [] });
    } else {
      focusCell(rowIdx, grdQuantity);
    }
  }, [updateCells, focusCell, toast]);

  // ── FillBatchItems (mirrors methods.FillBatchItems) ──────────────────────
  const fillBatchItems = useCallback((item, rowIdx) => {
    if (!item) {
      toast("❌ Invaild Product Code !!!.", true);
      setSelIdx(rowIdx); focusCell(rowIdx, grdProductCode);
      return;
    }
    const stock = fmtByDecimal(item.Stock, item.UOMDecimal);
    updateCells(rowIdx, {
      [grdProductCode]: item.ProductCode,
      [grdProductId]:   item.Id,
      [grdProductName]: item.ProductName,
      [grdUOMDecimal]:  item.UOMDecimal,
      [grdRate]:        vn(item.LandingCost).toFixed(2),
      [grdBatchRefid]:  item.Batchid,
      [grdStockQty]:    stock,
      [grdEditMode]:    1,
    });
    if (item.ManufactureDate === 1 || item.ExpriyDate === 1) {
      setExpPopup({ rowIdx, list: item._expList || [] });
    } else {
      focusCell(rowIdx, grdQuantity);
    }
  }, [updateCells, focusCell, toast]);

  // ── FillItemCode (mirrors methods.FillItemCode) ──────────────────────────
  const fillItemCode = useCallback(async (code, rowIdx) => {
    const res = await CC.api(ItemMasterSelectByCode, null, {}, {
      code: String(code), Comid: Number(sess.MComid), CComid: Number(sess.Comid), Id: 0, Batchwise: sess.BatchStatus,
    });
    if (redirectIfDualLogin(res)) return;
    const list = Array.isArray(res?.data) ? res.data : Array.isArray(res?.Data1) ? res.Data1 : [];
    if (list.length === 0) {
      toast("❌ Invaild Product Code !!!.", true);
      setSelIdx(rowIdx); focusCell(rowIdx, grdProductCode);
      return;
    }
    if (list[0].BatchStatus === 1) {
      if (list.length === 1 && list[0].BatchNo === code) {
        fillBatchItems(list[0], rowIdx);
      } else {
        setBatchPopup({ rowIdx, list });
      }
    } else {
      if (list.length === 1) {
        if (sess.MultipleUOMBilling && list[0].NomsQty !== 0 && Array.isArray(list[0]._uomList)) {
          setUnitPopup({ rowIdx, list: list[0]._uomList, productItem: list[0] });
        } else {
          fillItems(list[0], rowIdx);
        }
      } else {
        setMrpPopup({ rowIdx, list });
      }
    }
  }, [sess, redirectIfDualLogin, toast, focusCell, fillBatchItems, fillItems]);

  // ── FillStockAdjustment (mirrors methods.FillStockAdjustment, F3/F5 edit load) ──
  const fillStockAdjustment = useCallback(async (id, no) => {
    setLoading(true);
    const res = await CC.api(StockAdjustmentEdit, null, {}, { Id: Number(id) || 0, PNo: Number(no) || 0, Comid: Number(sess.Comid) });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    const list = Array.isArray(res?.data) ? res.data : Array.isArray(res?.Data1) ? res.Data1 : [];
    if (list.length === 0) {
      toast("❌ Record not found !!!.", true);
      return;
    }
    const master = list[0];

    if (sess.univercell) {
      let err = false;
      let msg = "";
      if (master.RepairReturnMasterRefId != null) {
        msg = "Can't Edit Because It is Repair Return Product";
        err = true;
      } else if (master.AdjustType === "DAMAGE") {
        err = true;
        if (master.FMStatus === 2) {
          msg = "Already Accepted By HO can't Edit";
        } else if (master.FMStatus === 1) {
          msg = "Product Send For HO Approvel/Please Inform HO to reject for Edit Option";
        } else {
          err = false;
        }
      }
      if (err) {
        toast(`❌ ${msg}`, true);
        clearGrid();
        return;
      }
    }

    setRealStockList(master.StockDetails || []);
    setAdjustDate(master.AdjustDate ? String(master.AdjustDate).slice(0,10) : todayISO());
    setAdjustType(master.AdjustType || typelist[0]);
    setAdjustNo(master.AdjustNo);
    setRemarks(master.Remarks || "");
    setTotalAmt(master.Amount != null ? String(master.Amount) : "");
    setEditId(master.Id);
    setUpdateIdEdit(master.UpdateId || "");
    loadgrid(master.AdjustmentDetails || []);
  }, [sess, redirectIfDualLogin, toast, loadgrid, clearGrid]);

  // ── StockAdjustmentSave (F1, mirrors InsertStockAdjustment flow) ─────────
  const stockAdjustmentSave = useCallback(async () => {
    if (!permRef.current.Add) { toast("❌ Page Add Permission Denied !!!.", true); return; }

    const { ok, cleaned } = gridemptycheck(gridRef.current);
    if (!ok) return;
    setGrid(cleaned); gridRef.current = cleaned;

    const purchaseLike = isPurchaseLikeType(adjustType);
    const allow = allowStockAll(cleaned, purchaseLike);
    if (!allow.ok) {
      setSelIdx(allow.idx); focusCell(allow.idx, grdQuantity);
      toast("❌ Insufficient stock for one or more rows !!!.", true);
      return;
    }

    const ok2 = await confirm("Do you Want to Save the Stock Adjustment Details?");
    if (!ok2) { addRow(); return; }

    const stockmaster = [{
      Id: editId,
      CompanyRefId: Number(sess.Comid),
      AdjustNo: 0,
      AdjustType: adjustType,
      AdjustDate: isoToMDY(adjustDate),
      Remarks: remarks,
      Modified_By: CC.getStr("loginusername") || "",
      UpdateId: "",
      FMStatus: (sess.univercell && adjustType === "DAMAGE") ? 1 : 0,
      RepairReturnMasterRefId: null,
      Amount: vn(totalAmt),
      AdjustmentDetails: cleaned.map(({ _uid, ...rest }) => rest),
      StockDetails: realStockList,
    }];

    setLoading(true);
    const res = await CC.insertapi(
        StockAdjustmentInsert,
        stockmaster,
        {
          MirrorTable: String(Number(sess.MirrorTable) || 0),
          LocalDB: String(Number(sess.LocalDB) || 0)
        }
      );
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

    if (res.ok) {
      toast("✅ " + (res.message || "Saved Successfully"));
      clearGrid();
    } else {
      toast(`❌ ${res.message || "Save failed"}`, true);
    }
  }, [gridemptycheck, allowStockAll, adjustType, confirm, addRow, editId, sess, adjustDate, remarks,
      totalAmt, realStockList, redirectIfDualLogin, toast, clearGrid, focusCell]);

  // ── StockAdjustmentDelete (F9, mirrors Presskey == "F9" ajax flow) ───────
  const doDeleteAfterPwd = useCallback(async () => {
    if (!permRef.current.Delete) { toast("❌ Page Delete Permission Denied !!!.", true); return; }
    if (editId === 0) { toast("❌ No Delete Id !!!.", true); return; }

    const purchaseLike = isPurchaseLikeType(adjustType);
    const allow = allowStockAll(gridRef.current, purchaseLike ? 0 : 1);
    if (!allow.ok) {
      setSelIdx(allow.idx); focusCell(allow.idx, grdQuantity);
      toast("❌ Insufficient stock to delete this adjustment !!!.", true);
      return;
    }

    const ok = await confirm(`Do You Want TO Delete Stock Adjustment.This is Adjust No ${adjustNo}?`);
    if (!ok) return;

    setLoading(true);
    const res = await CC.deleteapi(
        StockAdjustmentDelete,
        realStockList,
        {
          Comid: String(sess.Comid),
          Id: String(editId),
          MirrorTable: String(sess.MirrorTable),
          Updateid: String(updateIdEdit), // small d
          LocalDB: String(sess.LocalDB || 0)
        }
      );
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res.IsSuccess) {
      toast("✅ " + (res.message || "Deleted"));
      clearGrid();
    } else {
      toast(`❌ ${res.message || "Delete failed"}`, true);
    }
  }, [editId, adjustType, allowStockAll, confirm, adjustNo, sess, updateIdEdit, realStockList,
      redirectIfDualLogin, toast, clearGrid, focusCell]);

  // ── F5 row Delete button (mirrors Quotation.jsx handleF5Delete) ──────────
  // Loads the selected record's data first (to get its StockDetails/UpdateId),
  // confirms, deletes it via the same DeleteStockAdjustment API, then refreshes
  // the F5 list. Independent of the existing F9/double-click edit flows.
  const doF5RowDelete = useCallback(async (id, adjustNoForRecord) => {
    if (!permRef.current.Delete) { toast("❌ Page Delete Permission Denied !!!.", true); return; }

    setLoading(true);
    const res = await CC.api(StockAdjustmentEdit, null, {}, { Id: Number(id) || 0, PNo: 0, Comid: Number(sess.Comid) });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    const list = Array.isArray(res?.data) ? res.data : Array.isArray(res?.Data1) ? res.Data1 : [];
    if (list.length === 0) { toast("❌ Record not found !!!.", true); return; }
    const master = list[0];

    const ok = await confirm(`Do You Want TO Delete Stock Adjustment.This is Adjust No ${adjustNoForRecord ?? master.AdjustNo}?`);
    if (!ok) return;

    setLoading(true);
    const res2 = await CC.deleteapi(
        StockAdjustmentDelete,
        master.StockDetails || [],
        {
          Comid: String(sess.Comid),
          Id: String(master.Id),
          MirrorTable: String(sess.MirrorTable),
          Updateid: String(master.UpdateId || ""),
          LocalDB: String(sess.LocalDB || 0)
        }
      );
    setLoading(false);
    if (redirectIfDualLogin(res2)) return;
    console.log("[doF5RowDelete] DeleteStockAdjustment response:", res2); // TEMP DEBUG — remove after diagnosing
    if (res.IsSuccess) {
      toast("✅ " + (res2.message || "Deleted"));
      if (editId === master.Id) clearGrid();
      setF5Key(k => k + 1);
    } else {
      toast(`❌ ${res2.message || "Delete failed"}`, true);
    }
  }, [sess, confirm, redirectIfDualLogin, toast, editId, clearGrid]);

  // ── moveNext (mirrors GirdNextCell, default → ProductCode of next row) ──
  const moveNext = useCallback((rowIdx, colField) => {
    const ci = COL_NAV.indexOf(colField);
    if (ci < COL_NAV.length - 1) {
      focusCell(rowIdx, COL_NAV[ci + 1]);
    } else {
      if (rowIdx >= gridRef.current.length - 1) addRow();
      else { setSelIdx(rowIdx + 1); focusCell(rowIdx + 1, COL_NAV[0]); }
    }
  }, [focusCell, addRow]);

  // ── Item popup selection ─────────────────────────────────────────────────
  const onItemSelect = useCallback((item) => {
    const idx = itemPopup.rowIdx;
    setItemPopup({ open:false, rowIdx:null, prefill:"" });
    fillItemCode(item.ProductCode, idx);
  }, [itemPopup.rowIdx, fillItemCode]);

  // ── handleCellKeyDown (mirrors gridStockAdjustment keydown) ─────────────
  const handleCellKeyDown = useCallback((e, idx, field) => {
    if (e.keyCode === 46) { // Delete
      e.preventDefault(); deleteRow(idx); return;
    }
    if (e.key !== "Enter") return;
    e.preventDefault();

    const row = gridRef.current[idx];
    if (!row) return;
    const value = row[field];

    if (field === grdProductCode) {
      if (value == null || value === "") {
        setItemPopup({ open:true, rowIdx:idx, prefill:"" });
      } else {
        fillItemCode(value, idx);
      }
    }
    else if (field === grdQuantity) {
      if (value == null || value === "" || vn(value) < 0) {
        toast("❌ Enter Quantity!!!", true);
        return;
      }
      moveNext(idx, field);
      calculation(gridRef.current);
    }
    else if (field === grdRate) {
      const rate = vn(value).toFixed(2);
      updateCell(idx, grdRate, rate);
      moveNext(idx, grdAmount);
      calculation(gridRef.current.map((r,i) => i===idx ? { ...r, [grdRate]:rate } : r));
    }
    else {
      moveNext(idx, field);
      calculation(gridRef.current);
    }
  }, [moveNext, updateCell, calculation, deleteRow, fillItemCode, toast]);

  // ── Inline cell renderer ─────────────────────────────────────────────────
  function renderCell(row, realIdx, colDef) {
    const { field, type } = colDef;
    const value = row[field] ?? ((type === "float" || type === "qty") ? "" : "");

    const base = {
      background:  "#fff",
      border:      "1px solid #93c5fd",
      borderRadius: 4,
      color:       "#1e293b",
      boxShadow:   "0 0 0 2px rgba(59,130,246,.12)",
      cursor:      "text",
    };
    const numStyle = { ...base, textAlign:"right" };
    const ref = el => {
      if (el) inputRefs.current[`${realIdx}-${field}`] = el;
      else delete inputRefs.current[`${realIdx}-${field}`];
    };

    if (type === "readonly") {
      return (
        <div style={{ padding:"4px 6px", color:"#475569",
          textAlign: field === grdStockQty || field === grdAmount ? "right" : "left" }}>
          {value}
        </div>
      );
    }

    // popup (Product Code)
    if (type === "popup") {
      const openPopup = () => setItemPopup({ open:true, rowIdx:realIdx, prefill:String(value) });
      return (
        <input ref={ref} className="mp-cell-input" type="text"
          value={String(value)}
          style={{ ...base, cursor:"pointer", background:"#f8fafc" }}
          placeholder="Enter to select…"
          onFocus={() => setSelIdx(realIdx)}
          onChange={e => CC.applyUppercase(e, v => updateCell(realIdx, field, v))}
          onClick={openPopup}
          onKeyDown={e => handleCellKeyDown(e, realIdx, field)} />
      );
    }

    // qty (decimal precision driven by row's UOMDecimal)
    if (type === "qty") {
      return (
        <input ref={ref} className="mp-cell-input" type="text"
          value={String(value)}
          style={numStyle}
          onFocus={() => setSelIdx(realIdx)}
          onKeyDown={e => handleCellKeyDown(e, realIdx, field)}
          onChange={e => updateCell(realIdx, field, e.target.value)}
          onBlur={e => updateCell(realIdx, field, fmtByDecimal(e.target.value, row[grdUOMDecimal]))} />
      );
    }

    // numeric / string
    const isNum = type === "float" || type === "int";
    return (
      <input ref={ref} className="mp-cell-input" type="text"
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
  const anyPopupOpen = () => itemPopup.open || !!batchPopup || !!mrpPopup || !!unitPopup || !!expPopup || !!pwModal;

  useEffect(() => {
    const onKey = (e) => {
      if (e.keyCode === 27) { // Esc
        e.preventDefault();
        if (itemPopup.open) { setItemPopup({ open:false,rowIdx:null,prefill:"" }); return; }
        if (batchPopup)     { setBatchPopup(null); return; }
        if (mrpPopup)       { setMrpPopup(null); return; }
        if (unitPopup)       { setUnitPopup(null); return; }
        if (expPopup)       { setExpPopup(null); return; }
        if (f5Open)         { setF5Open(false); return; }
        if (pwModal) return;
        confirm("Do You Want To Quit?").then(ok => { if (ok) navigate("/Home"); });
        return;
      }
      if (anyPopupOpen() || f5Open) return;

      if (e.keyCode === 112) { // F1 Save
        e.preventDefault();
        if (!permRef.current.Add) { toast("❌ Page Add Permission Denied !!!.", true); return; }
        stockAdjustmentSave();
      }
      if (e.keyCode === 114) { // F3 Edit (by Adjust No)
        e.preventDefault();
        if (!permRef.current.Edit) { toast("❌ Page Edit Permission Denied !!!.", true); return; }
        setPwModal({ purpose:"F3" });
      }
      if (e.keyCode === 121) { // F10 Clear
        e.preventDefault();
        confirm("Do You Want To Clear?").then(ok => { if (ok) clearGrid(); });
      }
      if (e.keyCode === 116) { // F5 View
        e.preventDefault();
        setF5Open(true);
      }
      if (e.keyCode === 120) { // F9 Delete
        e.preventDefault();
        if (!permRef.current.Delete) { toast("❌ Page Delete Permission Denied !!!.", true); return; }
        if (editId === 0) { toast("❌ No Delete Id !!!.", true); return; }
        setPwModal({ purpose:"F9" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line
  }, [itemPopup.open, batchPopup, mrpPopup, unitPopup, expPopup, pwModal, f5Open,
      editId, stockAdjustmentSave, clearGrid, confirm, navigate]);

  // ── F5 row double-click → password gate → load for edit ──────────────────
  const onF5SelectRow = useCallback((id) => {
    if (!permRef.current.Edit) { toast("❌ Page Edit Permission Denied !!!.", true); return; }
    f5IdRef.current = id;
    setPwModal({ purpose:"F5" });
  }, [toast]);

  // ── F5 row Edit button (mirrors Quotation.jsx doEditQuotation: direct load, no password) ──
  const onF5EditRow = useCallback((id) => {
    if (!permRef.current.Edit) { toast("❌ Page Edit Permission Denied !!!.", true); return; }
    setF5Open(false);
    fillStockAdjustment(id, 0);
  }, [toast, fillStockAdjustment]);

  // ── F5 row Delete button (mirrors Quotation.jsx handleF5Delete: password gate first) ──
  const onF5DeleteRow = useCallback((id, adjustNoForRecord) => {
    if (!permRef.current.Delete) { toast("❌ Page Delete Permission Denied !!!.", true); return; }
    f5DeleteRef.current = { id, no: adjustNoForRecord };
    setPwModal({ purpose:"F5Delete" });
  }, [toast]);

  // ── F3 prompt for Adjustment Number (mirrors prompt()) ───────────────────
  const [f3Prompt, setF3Prompt] = useState(null); // {value}

  const onPwModalOk = useCallback(() => {
    if (!pwModal) return;
    if (pwModal.purpose === "F3") {
      setF3Prompt({ value: "" });
    } else if (pwModal.purpose === "F5") {
      setF5Open(false);
      fillStockAdjustment(f5IdRef.current, 0);
    } else if (pwModal.purpose === "F9") {
      doDeleteAfterPwd();
    } else if (pwModal.purpose === "F5Delete") {
      const target = f5DeleteRef.current;
      if (target) doF5RowDelete(target.id, target.no);
    }
  }, [pwModal, fillStockAdjustment, doDeleteAfterPwd, doF5RowDelete]);

  // ── Block until authorized ───────────────────────────────────────────────
  if (!isAuthorized) return null;

  const visibleColumns = ALL_COLUMNS;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="mp-wrap stockadjustment-page">
      {ConfirmUI}

      {/* ── Item Description Popup ── */}
      {itemPopup.open && (
        <PopupWindow title="Item Description" width={700} onClose={() => setItemPopup({ open:false,rowIdx:null,prefill:"" })}>
          <SearchableList items={productList} labelField="ProductName" codeField="ProductCode" prefill={itemPopup.prefill}
            placeholder="Search Description Name…" onChange={onItemSelect}
            onClose={() => setItemPopup({ open:false,rowIdx:null,prefill:"" })} />
        </PopupWindow>
      )}

      {/* ── Batch Window ── */}
      {batchPopup && (
        <PopupWindow title="Select Batch" width={520} onClose={() => setBatchPopup(null)}>
          <BatchWindow items={batchPopup.list}
            onChange={(item) => { const idx = batchPopup.rowIdx; setBatchPopup(null); fillBatchItems(item, idx); }}
            onClose={() => setBatchPopup(null)} />
        </PopupWindow>
      )}

      {/* ── MRP / Duplicate-code Window ── */}
      {mrpPopup && (
        <PopupWindow title="Select Product" width={480} onClose={() => setMrpPopup(null)}>
          <MrpWindow items={mrpPopup.list}
            onChange={(item) => { const idx = mrpPopup.rowIdx; setMrpPopup(null); fillItems(item, idx); }}
            onClose={() => setMrpPopup(null)} />
        </PopupWindow>
      )}

      {/* ── Multi-UOM Window ── */}
      {unitPopup && (
        <PopupWindow title="Select Unit" width={420} onClose={() => setUnitPopup(null)}>
          <UnitWindow items={unitPopup.list}
            onChange={(item) => {
              const idx = unitPopup.rowIdx;
              setUnitPopup(null);
              updateCells(idx, { [grdNOMSQty]: vn(item.Nos), [grdUOMRefid]: item.UOMId });
              if (unitPopup.productItem) fillItems(unitPopup.productItem, idx);
              else focusCell(idx, grdQuantity);
            }}
            onClose={() => setUnitPopup(null)} />
        </PopupWindow>
      )}

      {/* ── Expiry / Mfg Date Window ── */}
      {expPopup && (
        <PopupWindow title="Select Batch / Expiry" width={480} onClose={() => setExpPopup(null)}>
          <ExpWindow items={expPopup.list}
            onChange={(item) => {
              const idx = expPopup.rowIdx;
              setExpPopup(null);
              updateCells(idx, { [grdExpiryDate]: item.Expdate, [grdMfgDate]: item.MFdate });
              focusCell(idx, grdQuantity);
            }}
            onClose={() => setExpPopup(null)} />
        </PopupWindow>
      )}

      {/* ── Password Modal (F3 / F5 / F9) ── */}
      {pwModal && (
        <PasswordModal title={(pwModal.purpose === "F9" || pwModal.purpose === "F5Delete") ? "Delete Pwd" : "Edit Pwd"} comid={sess.Comid}
          onOk={onPwModalOk}
          onClose={() => setPwModal(null)} />
      )}

      {/* ── F3 Adjustment Number Prompt ── */}
      {f3Prompt && (
        <div style={{ position:"fixed",inset:0,background:"rgba(10,20,40,0.55)",
          zIndex:9250,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <div style={{ background:"#fff",borderRadius:8,width:300,
            padding:"20px 22px 16px",boxShadow:"0 8px 32px rgba(0,0,0,0.25)" }}>
            <div style={{ fontSize:13,fontWeight:700,marginBottom:12,color:"#1a2e4a" }}>
              Enter the Stock Adjustment Number
            </div>
            <input type="text" autoFocus value={f3Prompt.value}
              onChange={e => setF3Prompt({ value: e.target.value })}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  if (vn(f3Prompt.value) !== 0) {
                    const no = f3Prompt.value; setF3Prompt(null);
                    fillStockAdjustment(0, no);
                  } else {
                    toast("❌ Enter Vaild Adjustment Number !!!.", true);
                  }
                }
                if (e.key === "Escape") setF3Prompt(null);
              }}
              style={{ width:"100%",padding:"6px 10px",border:"1px solid #c5d8f8",
                borderRadius:4,fontSize:13,marginBottom:14,outline:"none",boxSizing:"border-box" }} />
            <div style={{ display:"flex",gap:8,justifyContent:"flex-end" }}>
              <button className="mp-btn" onClick={() => setF3Prompt(null)}>Cancel</button>
              <button className="mp-btn sv" onClick={() => {
                if (vn(f3Prompt.value) !== 0) {
                  const no = f3Prompt.value; setF3Prompt(null);
                  fillStockAdjustment(0, no);
                } else {
                  toast("❌ Enter Vaild Adjustment Number !!!.", true);
                }
              }}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* ── F5 View Window ── */}
      {f5Open && (
        <F5ViewWindow
          key={f5Key}
          comid={sess.Comid}
          onClose={() => setF5Open(false)}
          onSelectRow={onF5SelectRow}
          onEditRow={onF5EditRow}
          onDeleteRow={onF5DeleteRow}
          loading={loading} setLoading={setLoading} />
      )}

      <Topbar />

      <div className="mp-body">
        {/* ── TOP TOOLBAR ── */}
        <div className="mp-toolbar" style={{ display:"flex",alignItems:"center",gap:8,padding:"6px 10px",flexWrap:"wrap" }}>
          <div className="mp-toolbar-title">Stock Adjustment</div>

          {/* Date picker */}
          <div style={{ display:"flex",alignItems:"center",gap:6,marginLeft:12 }}>
            <label style={{ fontSize:12,fontWeight:600,color:"#475569" }}>Date</label>
            <input ref={dateRef} type="date" className="mp-cell-input"
              style={{ height:28,width:150,border:"1px solid #93c5fd",borderRadius:4 }}
              value={adjustDate}
              onChange={e => setAdjustDate(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { if (!adjustDate) toast("❌ Select Date", true); else typeRef.current?.focus(); } }} />
          </div>

          {/* Type dropdown */}
          <div style={{ display:"flex",alignItems:"center",gap:6 }}>
            <label style={{ fontSize:12,fontWeight:600,color:"#475569" }}>Type</label>
            <select ref={typeRef} className="mp-cell-input"
              style={{ height:30,width:140,border:"1px solid #93c5fd",borderRadius:4 }}
              value={adjustType}
              onChange={e => { setAdjustType(e.target.value); }}
              onKeyDown={e => { if (e.key === "Enter") { loadgrid([]); } }}>
              {typelist.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Adjustment Ref No (readonly) */}
          <div style={{ display:"flex",alignItems:"center",gap:6 }}>
            <label style={{ fontSize:12,fontWeight:600,color:"#475569" }}>Adjust No</label>
            <input ref={refnoRef} type="text" className="mp-cell-input" readOnly
              style={{ height:28,width:100,border:"1px solid #cbd5e1",borderRadius:4,background:"#f1f5f9" }}
              value={adjustNo} />
          </div>

          {/* Remarks */}
          <div style={{ display:"flex",alignItems:"center",gap:6,flex:1,minWidth:200 }}>
            <label style={{ fontSize:12,fontWeight:600,color:"#475569" }}>Remarks</label>
            <input ref={remarksRef} type="text" className="mp-cell-input"
              style={{ height:28,width:"100%",border:"1px solid #93c5fd",borderRadius:4 }}
              value={remarks}
              onChange={e => setRemarks(e.target.value)} />
          </div>

          {/* Totals */}
          <div style={{ display:"flex",alignItems:"center",gap:6,
            background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:6,padding:"4px 12px" }}>
            <span style={{ fontSize:12,fontWeight:600,color:"#15803d" }}>Qty:</span>
            <span style={{ fontSize:13,fontWeight:700,color:"#15803d" }}>{totalQty}</span>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:6,
            background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:6,padding:"4px 12px" }}>
            <span style={{ fontSize:12,fontWeight:600,color:"#15803d" }}>Amount:</span>
            <span style={{ fontSize:14,fontWeight:700,color:"#15803d" }}>{totalAmt}</span>
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
                    textAlign: c.type==="float" || c.type==="qty" || c.field===grdStockQty || c.field===grdAmount ? "right" : undefined }}>
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
                          textAlign: colDef.type==="float" || colDef.type==="qty" || colDef.field===grdStockQty || colDef.field===grdAmount ? "right" : undefined }}
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
          <button className="mp-btn sv" onClick={stockAdjustmentSave} disabled={loading}>💾 F1 Save</button>
          <button className="mp-btn" style={{ background:"#0891b2",color:"#fff",borderColor:"#0891b2" }}
            onClick={() => { if (!permRef.current.Edit) { toast("❌ Page Edit Permission Denied !!!.", true); return; } setPwModal({ purpose:"F3" }); }}
            disabled={loading}>✏ F3 Edit</button>
          <button className="mp-btn" style={{ background:"#7c3aed",color:"#fff",borderColor:"#7c3aed" }}
            onClick={() => setF5Open(true)} disabled={loading}>📋 F5 View</button>
          <button className="mp-btn" style={{ background:"#dc2626",color:"#fff",borderColor:"#dc2626" }}
            onClick={() => {
              if (!permRef.current.Delete) { toast("❌ Page Delete Permission Denied !!!.", true); return; }
              if (editId === 0) { toast("❌ No Delete Id !!!.", true); return; }
              setPwModal({ purpose:"F9" });
            }} disabled={loading}>🗑 F9 Delete</button>
          <button className="mp-btn"
            style={{ background:"var(--color-background-secondary)",color:"var(--color-text-primary)",border:"1px solid #9ca3af" }}
            onClick={() => confirm("Do You Want To Clear?").then(ok => { if (ok) clearGrid(); })}
            disabled={loading}>♻ F10 Clear</button>
          <button className="mp-btn dl"
            onClick={() => confirm("Do You Want To Quit?").then(ok => { if (ok) navigate("/Home"); })}
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