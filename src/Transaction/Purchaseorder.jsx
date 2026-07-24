// ─────────────────────────────────────────────────────────────────────────────
//  PurchaseOrder.jsx  —  React Purchase Order Form
//  Converted from PurchaseOrder.js (jQuery/jqxGrid) to React
//  Design matches SaleOrder.jsx pattern exactly
//
//  ALL LOGIC from PurchaseOrder.js is preserved:
//   • Permission check (menulist → "Purchase Order")
//   • EcoTech / univercell flags
//   • SaveDislogPurchaseOrder → PrintA4Bill
//   • Manual/Auto purchase number (MPNo / APNo radio)
//   • Supplier details load (address, city, contactno, creditdays, IGSTBill)
//   • PO Req (cmbporeq) convert from Quotation
//   • Ctrl+F = Form Focus/Reorder, Ctrl+G = Grid Focus/Reorder
//   • Ctrl+A = Delivery Address popup
//   • F1=Save, F3=Edit, F5=View, F9=Delete, F10=Clear, F12=ColConfig
//   • Password modal (PasswordType 0=FormPwd, 1=EditPwd, 2=AdminPwd)
//   • Grid cell Enter navigation with GirdFocusNextCell logic
//   • Del key = row delete confirmation
//   • Product code/name lookup (FillItems/FillItems1/FillItemsCode)
//   • MRP window for multiple results
//   • Row calculation: exclusive GST, CD%, Disc%, landing cost
//   • IGSTBillStatus toggle (CGST/SGST vs IGST)
//   • PF %/amount (EcoTech) and OtherPlus/OtherSub
//   • GST split table (gstsplitdetails)
//   • F5View with date range + supplier filter
//   • PrintA4 flow (Print/View/Mail)
//   • purchaseeditloaddetails with numeric formatting
//   • clear() full form reset
//   • SaleEdit (Quotation convert)
//   • Focus columns (PurchaseOrderFocus.json)
//   • Form focus columns (PurchaseOrderFormFocus.json)
//   • Pcs/Meter → total qty calculation
//   • UOMDecimal (0/2/3) qty formatting
//   • SaleLandingCostCompare (PurchaseRate vs MRP guard)
//
//  GRID INPUT FIXES (mirrors SaleOrder.jsx exactly):
//   • Removed editingCellRef (was undeclared — caused silent crash)
//   • Removed onBlur / handleCellBlur (was resetting qty while typing)
//   • ItemQty now recalcs on every change (same as SaleOrder)
//   • onFocus just sets selRid, no select() interference
//   • handleCellKeyDown ItemQty Enter: single setRows call
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../components/Common";
import Topbar from "../components/Topbar";
import   DateFieldDDMMYYYY from "../Commondatetime";
// import "./PurchaseOrder.css";

// ─── API ENDPOINTS ────────────────────────────────────────────────────────────
const PurchaseOrderMaxNo     = "/api/PurchaseOrderApp/MaxPurchaseOrderNo";
const PurchaseOrderInsertUrl = "/api/PurchaseOrderApp/InsertPurchaseOrder";
const PurchaseOrderEditUrl   = "/api/PurchaseOrderApp/EditPurchaseOrder";
const PurchaseOrderSelectUrl = "/api/PurchaseOrderApp/SelectPurchaseOrderV7";
const PurchaseOrderDeleteUrl = "/api/PurchaseOrderApp/DeletePurchaseOrder";
const QuotationEditUrl       = "/api/QuotationApp/EditQuotation";
const SelectItemByCodeUrl    = "/api/ItemMasterApp/SelectItemMasterbyCodeId";
const ProductListUrl         = "/api/ItemMasterApp/GetProductListV7";
const GetSupplierUrl         = "/api/SupplierApp/SelectSupplierAll";
const LoginPasswordUrl       = "/api/loginApp/EditPassword";
const VisibleColumnsUrl      = "/Login/VisibleColumns";
const FocusColumnsUrl        = "/Login/FocusColumns";
const PoReqUrl               = "/api/PurchaseOrderApp/SelectPoReq";

// ─── PURCHASE TYPE OPTIONS ────────────────────────────────────────────────────
const PURCHASE_TYPES = [
  { value: "CASH",   label: "CASH" },
  { value: "CREDIT", label: "CREDIT" },
];

// ─── GRID COLUMNS DEFINITION ─────────────────────────────────────────────────
const PO_COLUMNS = [
  { key: "ProductCode",      label: "Product Code",  width: 150, hidden: false },
  { key: "ProductName",      label: "Description",   width: 300, hidden: false, readOnly: true },
  { key: "MRP",              label: "MRP",           width: 100, hidden: true,  type: "float" },
  { key: "PurchaseRate",     label: "Pur.Rate",      width: 100, hidden: false, type: "float" },
  { key: "Pcs",              label: "Pcs",           width: 100, hidden: true,  type: "float" },
  { key: "Meter",            label: "Meter",         width: 100, hidden: true,  type: "float" },
  { key: "ProductTotal",     label: "Product Total", width: 100, hidden: true,  type: "float", readOnly: true },
  { key: "Noms",             label: "Noms",          width: 100, hidden: true,  type: "int" },
  { key: "NomsQty",          label: "NomsQty",       width: 100, hidden: true,  type: "int",   readOnly: true },
  { key: "UOM",              label: "UOM",           width: 100, hidden: false, readOnly: true },
  { key: "StockQty",         label: "StockQty",      width: 100, hidden: true,  type: "float", readOnly: true },
  { key: "ItemQty",          label: "Quantity",      width: 100, hidden: false, type: "float" },
  { key: "cdpercent",        label: "C.D(%)",        width: 100, hidden: true,  type: "float" },
  { key: "cdAmount",         label: "C.D Amt",       width: 100, hidden: true,  type: "float" },
  { key: "DiscountPercent",  label: "Disc(%)",       width: 100, hidden: true,  type: "float" },
  { key: "DiscountAmt",      label: "Disc Amt",      width: 100, hidden: true,  type: "float" },
  { key: "TaxPercent",       label: "GST(%)",        width: 100, hidden: false, type: "float" },
  { key: "TaxAmt",           label: "GST Amt",       width: 100, hidden: true,  type: "float" },
  { key: "LandingCost",      label: "Landing Cost",  width: 100, hidden: true,  type: "float", readOnly: true },
  { key: "Salerate",         label: "SaleRate",      width: 100, hidden: true,  type: "float" },
  { key: "UnitSpecification",label: "UnitSpec",      width: 100, hidden: true,  readOnly: true },
  { key: "Amount",           label: "Amount",        width: 100, hidden: false, readOnly: true, type: "float" },
  { key: "CTAmount",         label: "CGST Amt",      width: 100, hidden: true,  type: "float", readOnly: true },
  { key: "STAmount",         label: "SGST Amt",      width: 100, hidden: true,  type: "float", readOnly: true },
];

const DEFAULT_COL_SETTINGS = PO_COLUMNS.map(c => ({
  key: c.key, label: c.label, width: c.width, visible: !c.hidden,
}));

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const vn    = v => parseFloat(v) || 0;
const roVal = v => Math.round(v * 100) / 100;
const f2    = v => parseFloat(vn(v).toFixed(2));
const f3    = v => parseFloat(vn(v).toFixed(3));
const ns    = v => (v == null ? "" : String(v));
const today = () => new Date().toISOString().slice(0, 10);

let _rid = 5000;
const genRid  = () => ++_rid;
const newGuid = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0;
  return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
});

// ─── ROW FACTORY ──────────────────────────────────────────────────────────────
const mkRow = () => ({
  _rid: genRid(), _isNew: true, _dirty: false, _indexid: newGuid(),
  PDId: 0, PurchaseOrderDeleteid: 0,
  ProductRefId: 0, ProductCode: "", ProductName: "",
  MRP: "0.00", PurchaseRate: "0.00", LandingCost: "0.00",
  ItemQty: "", UOMDecimal: 0, Noms: "0", NomsQty: 0,
  TaxPercent: "0.00", TaxAmt: 0,
  CTAmount: 0, STAmount: 0, CTPer: "0.00", STPer: "0.00",
  cdpercent: "0.00", cdAmount: "0.00",
  DiscountPercent: "0.00", DiscountAmt: "0.00",
  Amount: 0, ProductTotal: 0,
  UOM: "", StockQty: 0,
  Pcs: "", Meter: "",
  Salerate: "0.00", UnitSpecification: "",
  EditMode: 0,
});

const fmtRow = obj => ({
  ...mkRow(), ...obj,
  _rid: obj._rid || genRid(),
  _isNew: false, _dirty: false,
  MRP:             ns(f2(vn(obj.MRP))),
  PurchaseRate:    ns(f2(vn(obj.PurchaseRate))),
  LandingCost:     ns(f2(vn(obj.LandingCost))),
  ItemQty: (() => {
    const d = obj.UOMDecimal;
    if (d === 2) return f2(vn(obj.ItemQty)).toFixed(2);
    if (d === 3) return f3(vn(obj.ItemQty)).toFixed(3);
    return Math.round(vn(obj.ItemQty)).toFixed(0);
  })(),
  TaxPercent:      ns(f2(vn(obj.TaxPercent))),
  TaxAmt:          f2(vn(obj.TaxAmt)),
  CTAmount:        f2(vn(obj.CTAmount)),
  STAmount:        f2(vn(obj.STAmount)),
  DiscountPercent: ns(f2(vn(obj.DiscountPercent))),
  DiscountAmt:     ns(f2(vn(obj.DiscountAmt))),
  cdpercent:       ns(f2(vn(obj.cdpercent))),
  cdAmount:        ns(f2(vn(obj.cdAmount))),
  Noms:            ns(Math.round(vn(obj.Noms || obj.NOMS || 0))),
  NomsQty:         Math.round(vn(obj.NomsQty || 0)),
  Meter:           ns(f2(vn(obj.Meter))),
  Salerate:        ns(f2(vn(obj.Salerate || obj.SaleRate || obj.SalesRate))),
  Amount:          f2(vn(obj.Amount)),
  ProductTotal:    f2(vn(obj.ProductTotal)),
});

// ─── ROW CALCULATION (mirrors PurchaseOrder.js methods.Calculation per-row) ──
function calcPurchaseRow(row, igstBill) {
  const qty     = vn(row.ItemQty) + vn(row.Noms);
  const purrate = vn(row.PurchaseRate);
  const cdper   = vn(row.cdpercent);
  const discper = vn(row.DiscountPercent);
  const gst     = vn(row.TaxPercent);

  if (qty === 0 || purrate === 0) {
    return {
      ...row,
      Amount: 0, TaxAmt: 0, CTAmount: 0, STAmount: 0,
      DiscountAmt: "0.00", cdAmount: "0.00",
      LandingCost: "0.00", ProductTotal: 0,
    };
  }

  const puramt = purrate * qty;
  const cdamt  = roVal(puramt * (cdper / 100));
  const disamt = roVal((puramt - cdamt) * (discper / 100));

  const c1 = qty !== 0 ? cdamt / qty : 0;
  const d1 = qty !== 0 ? disamt / qty : 0;
  const netpurrate = roVal(purrate - (c1 + d1));

  let gstamt = 0, ctamt = 0, stamt = 0, landingcost = 0, Amt = 0;

  if (netpurrate !== 0 && qty !== 0) {
    ctamt       = roVal((netpurrate * qty) * ((gst / 2) / 100));
    stamt       = ctamt;
    gstamt      = roVal(ctamt + stamt);
    if (igstBill) { ctamt = gstamt; stamt = 0; }
    landingcost = roVal(netpurrate + gstamt / qty);
    Amt         = roVal((puramt - (cdamt + disamt)) + gstamt);
  }

  return {
    ...row,
    ProductTotal:    f2(puramt),
    cdAmount:        ns(f2(cdamt)),
    DiscountAmt:     ns(f2(disamt)),
    TaxAmt:          f2(gstamt),
    CTAmount:        f2(ctamt),
    STAmount:        f2(stamt),
    LandingCost:     ns(f2(landingcost)),
    Amount:          f2(Amt),
  };
}

// ─── PASSWORD MODAL ───────────────────────────────────────────────────────────
function PwModal({ title, comid, onOk, onClose }) {
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const inpRef = useRef(null);

  useEffect(() => { setTimeout(() => inpRef.current?.focus(), 120); }, []);

  const submit = async () => {
    if (!pwd.trim()) { setErr("Enter password"); return; }
    const type =
      title.includes("Edit")   ? "EditPassword" :
      title.includes("Delete") ? "EditPassword" :
      title.includes("Admin")  ? "AdminPower"   :
      "FormConfig";
    try {
      const data = await CC.api(LoginPasswordUrl, null, {}, {
        password: pwd, type, Comid: parseInt(comid) || 1,
      });
      if (data.ok ?? data.IsSuccess ?? false) { onOk(); onClose(); }
      else { setErr("Invalid Password !!!"); setPwd(""); setTimeout(() => inpRef.current?.focus(), 50); }
    } catch { setErr("Network Error"); }
  };

  return (
    <div className="mp-ov" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mp-modal-box" style={{ width: 220 }}>
        <div className="mp-modal-hdr"><span>🔒 {title}</span><button onClick={onClose}>✕</button></div>
        <div className="mp-modal-body" style={{ padding: "14px 16px" }}>
          <input ref={inpRef} type="password" value={pwd}
            onChange={e => { setPwd(e.target.value); setErr(""); }}
            onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") onClose(); }}
            style={{ width: "100%", height: 28, border: "1px solid #b8ccee", borderRadius: 3, padding: "0 8px", fontSize: 13, outline: "none" }}
            placeholder="Password" />
          {err && <div style={{ color: "#dc2626", fontSize: 11, marginTop: 4 }}>{err}</div>}
        </div>
        <div className="mp-modal-ftr">
          <button className="mp-btn sv" onClick={submit}>✔ OK</button>
          <button className="mp-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── COMBOBOX (searchable select) ────────────────────────────────────────────
function ComboBox({ options, value, onChange, onEnterKey, placeholder, style, inputRef: extRef, disabled }) {
  const [q, setQ]       = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi]     = useState(0);
  const wrapRef = useRef(null);
  const inpRef  = useRef(null);
  const listRef = useRef(null);
  const ref = extRef || inpRef;

  const selectedLabel = options.find(o => String(o.value) === String(value))?.label || "";
  const filtered = options.filter(o => o.label.toUpperCase().includes(q.toUpperCase())).slice(0, 200);

  useEffect(() => { setHi(0); }, [q]);
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${hi}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [hi]);
  useEffect(() => {
    const h = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) { setOpen(false); setQ(selectedLabel); }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [selectedLabel]);

  const select = opt => { onChange(String(opt.value)); setQ(opt.label.toUpperCase()); setOpen(false); };
  const kd = e => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi(h => Math.min(h + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && filtered[hi]) select(filtered[hi]);
      onEnterKey?.();
    }
    if (e.key === "Escape") { setOpen(false); setQ(selectedLabel); }
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", flex: 1, minWidth: 0, ...style }}>
      <input ref={ref} className="sb-select"
        value={open ? q : selectedLabel.toUpperCase()}
        placeholder={placeholder} autoComplete="off" disabled={disabled}
        onFocus={() => { setQ(selectedLabel); setOpen(true); setHi(0); }}
        onChange={e => { setQ(e.target.value.toUpperCase()); setOpen(true); }}
        onKeyDown={kd}
        style={{ width: "100%", cursor: disabled ? "not-allowed" : "text" }}
      />
      {open && !disabled && filtered.length > 0 && (
        <div ref={listRef} style={{
          position: "absolute", top: "100%", left: 0, right: 0,
          background: "#fff", border: "1px solid #c5d8f8", borderRadius: 4,
          zIndex: 9999, maxHeight: 220, overflowY: "auto",
          boxShadow: "0 8px 24px rgba(31,101,222,.15)",
        }}>
          {filtered.map((opt, idx) => (
            <div key={opt.value} data-idx={idx}
              onMouseDown={() => select(opt)} onMouseEnter={() => setHi(idx)}
              style={{
                padding: "5px 10px", fontSize: 12, cursor: "pointer",
                background: idx === hi ? "#deeafb" : idx % 2 === 0 ? "#fff" : "#fafbff",
                borderLeft: idx === hi ? "3px solid #1f65de" : "3px solid transparent",
                color: "#1a2e4a", fontWeight: idx === hi ? 600 : 400,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{opt.label}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PRODUCT SEARCH POPUP ────────────────────────────────────────────────────
function ProductSearchPopup({ products, onSelect, onClose, anchorPos }) {
  const [q, setQ]   = useState("");
  const [hi, setHi] = useState(0);
  const listRef     = useRef(null);
  const inpRef      = useRef(null);

  useEffect(() => { setTimeout(() => inpRef.current?.focus(), 60); }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return products.slice(0, 300);
    const lq = q.toLowerCase();
    return products.filter(p =>
      (p.ProductName || p.PName || "").toLowerCase().includes(lq) ||
      (p.ProductCode || p.Prod_Code || "").toLowerCase().startsWith(lq)
    ).slice(0, 300);
  }, [products, q]);

  useEffect(() => {
    if (hi >= filtered.length) setHi(Math.max(0, filtered.length - 1));
  }, [filtered, hi]);

  const scrollHi = useCallback(idx => {
    const el = listRef.current?.querySelector(`[data-idx="${idx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, []);

  const handleKey = e => {
    if (e.key === "ArrowDown") { e.preventDefault(); const next = Math.min(hi + 1, filtered.length - 1); setHi(next); scrollHi(next); }
    if (e.key === "ArrowUp")   { e.preventDefault(); const prev = Math.max(hi - 1, 0); setHi(prev); scrollHi(prev); }
    if (e.key === "Enter")     { e.preventDefault(); if (filtered[hi]) onSelect(filtered[hi]); }
    if (e.key === "Escape")    { onClose(); }
  };

  return (
    <div className="sb-prod-search" style={{ top: anchorPos?.top || 120, left: anchorPos?.left || 80, width: 820, height: "80vh" }}>
      <div className="sb-prod-search-hdr">
        <span className="sb-ps-title">🔍 Product Search</span>
        <span className="sb-ps-count">{filtered.length} items</span>
        <button className="sb-ps-close" onClick={onClose}>✕</button>
      </div>
      <div className="sb-ps-input-wrap">
        <span className="sb-ps-icon">⌕</span>
        <input ref={inpRef} value={q} onChange={e => { setQ(e.target.value); setHi(0); }}
          onKeyDown={handleKey} placeholder="Type to filter…" className="sb-ps-input" />
      </div>
      <div className="sb-ps-cols">
        <span style={{ width: 70 }}>Code</span>
        <span style={{ flex: 1 }}>Description</span>
        <span style={{ width: 45, textAlign: "center" }}>UOM</span>
        <span style={{ width: 60, textAlign: "right" }}>MRP</span>
        <span style={{ width: 60, textAlign: "right" }}>PurRate</span>
        <span style={{ width: 45, textAlign: "right" }}>GST%</span>
        <span style={{ width: 75, textAlign: "right" }}>LandingCost</span>
        <span style={{ width: 60, textAlign: "right" }}>SaleRate</span>
      </div>
      <div ref={listRef} className="sb-prod-list">
        {filtered.length === 0
          ? <div className="sb-ps-empty">No products found</div>
          : filtered.map((p, idx) => (
            <div key={p.Id} data-idx={idx}
              className={`sb-prod-item${idx === hi ? " hi" : ""}`}
              onClick={() => onSelect(p)} onMouseEnter={() => setHi(idx)}>
              <span className="sb-prod-code" style={{ width: 70 }}>
                {p.Prod_Code || p.ProductCode}
              </span>
              <span className="sb-prod-name" style={{ flex: 1 }}>
                {p.PName || p.ProductName}
              </span>
              <span style={{ width: 45, textAlign: "center", fontSize: 10.5, color: "#6b7a99" }}>
                {p.UOM || "—"}
              </span>
              <span style={{ width: 60, textAlign: "right", color: "#475569" }}>
                ₹{f2(vn(p.MRP)).toFixed(2)}
              </span>
              <span className="sb-prod-rate" style={{ width: 60, textAlign: "right" }}>
                ₹{f2(vn(p.PurchaseRate)).toFixed(2)}
              </span>
              <span style={{ width: 45, textAlign: "right", color: "#8b5cf6" }}>
                {f2(vn(p.GST)).toFixed(2)}
              </span>
              <span style={{ width: 75, textAlign: "right", color: "#ea580c" }}>
                ₹{f2(vn(p.LandingCost)).toFixed(2)}
              </span>
              <span style={{ width: 60, textAlign: "right", color: "#16a34a", fontWeight: 600 }}>
                ₹{f2(vn(p.SaleRate ?? p.SalesRate)).toFixed(2)}
              </span>
            </div>
          ))
        }
      </div>
      <div className="sb-ps-footer">
        <span><kbd>↑↓</kbd> Navigate</span>
        <span><kbd>Enter</kbd> Select</span>
        <span><kbd>Esc</kbd> Close</span>
      </div>
    </div>
  );
}

// ─── F5 VIEW MODAL ────────────────────────────────────────────────────────────
function F5ViewModal({ rows, details, suppliers, onEdit, onDelete, onClose, fromDate, toDate, onSearch }) {
  const [from, setFrom]     = useState(fromDate);
  const [to, setTo]         = useState(toDate);
  const [suppId, setSuppId] = useState("0");
  const [expandedId, setExpandedId] = useState(null);
  const totalAmt = rows.reduce((s, r) => s + vn(r.NetAmt || r.NetAmount || r.Netamt || r.Amount), 0);

  const toggleExpand = id => setExpandedId(prev => prev === id ? null : id);
  const getRowDetails = id =>
    (details || []).filter(d =>
      String(d.PurchaseRefId || d.PurchaseId || d.PurchaseOrderRefId || "") === String(id)
    );

  return (
    <div className="mp-ov" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mp-modal-box sb-f5-modal" style={{ width: 1050, height: "85vh", display: "flex", flexDirection: "column" }}>
        <div className="mp-modal-hdr">
          <span>📋 Purchase Order View (F5)</span>
          <button onClick={onClose}>✕</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#f5f9ff", borderBottom: "1px solid #dde6f5", flexShrink: 0 }}>
          <label style={{ fontSize: 11, fontWeight: 700 }}>From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            style={{ height: 28, border: "1px solid #c5d8f8", borderRadius: 4, padding: "0 6px", fontSize: 12 }} />
          <label style={{ fontSize: 11, fontWeight: 700 }}>To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            style={{ height: 28, border: "1px solid #c5d8f8", borderRadius: 4, padding: "0 6px", fontSize: 12 }} />
          <label style={{ fontSize: 11, fontWeight: 700 }}>Supplier</label>
          <select value={suppId} onChange={e => setSuppId(e.target.value)}
            style={{ height: 28, border: "1px solid #c5d8f8", borderRadius: 4, padding: "0 6px", fontSize: 12, minWidth: 140 }}>
            <option value="0">All Suppliers</option>
            {(suppliers || []).map(s => <option key={s.Id} value={s.Id}>{s.AccountName}</option>)}
          </select>
          <button className="mp-btn sv" style={{ height: 28, padding: "0 14px", fontSize: 11 }}
            onClick={() => onSearch(from, to, suppId)}>🔍 Search</button>
          <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: 15 }}>Total: ₹{f2(totalAmt).toFixed(2)}</span>
        </div>
        <div className="mp-modal-body" style={{ flex: 1, overflowY: "auto", padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ background: "#1a2e4a", color: "#fff", padding: "6px 6px", width: 28, textAlign: "center", position: "sticky", top: 0, zIndex: 2 }}></th>
                {["Purchase No", "Purchase Date", "Purchase Type", "Supplier Name", "Amount", "Actions"].map(h => (
                  <th key={h} style={{ background: "#1a2e4a", color: "#fff", padding: "6px 10px", textAlign: h === "Amount" ? "right" : "left", position: "sticky", top: 0, zIndex: 2 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "#94a3b8", padding: 20 }}>No records found.</td></tr>
              )}
              {rows.map((r, i) => {
                const rowId      = r.Id;
                const isExpanded = expandedId === rowId;
                const rowDetails = getRowDetails(rowId);
                return (
                  <React.Fragment key={r.Id || i}>
                    <tr style={{ background: i % 2 === 0 ? "#fff" : "#fafbff", borderBottom: "1px solid #eaecf4" }}>
                      <td style={{ padding: "5px 6px", textAlign: "center", width: 28 }}>
                        <button onClick={() => toggleExpand(rowId)}
                          style={{
                            background: "none", border: "none", cursor: "pointer", fontSize: 13,
                            color: "#4f8cff", padding: 0,
                            transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                            transition: "transform 0.15s", display: "inline-block",
                          }}>▶</button>
                      </td>
                      <td style={{ padding: "5px 10px", fontWeight: 700 }}>{r.OrderNo || r.PurchaseNo || r.BillNo || "—"}</td>
                      <td style={{ padding: "5px 10px" }}>{r.Date || r.PurchaseDate || r.BillDate || ""}</td>
                      <td style={{ padding: "5px 10px" }}>{r.Type || r.PurchaseType || ""}</td>
                      <td style={{ padding: "5px 10px" }}>{r.SupName || r.SupplierName || r.AccountName || ""}</td>
                      <td style={{ padding: "5px 10px", textAlign: "right", fontWeight: 700 }}>₹{f2(vn(r.NetAmt || r.NetAmount || r.Amount)).toFixed(2)}</td>
                      <td style={{ padding: "5px 10px", textAlign: "center" }}>
                        <button onClick={() => onEdit(r.Id)}
                          style={{ marginRight: 6, padding: "3px 10px", fontSize: 11, borderRadius: 4, border: "1px solid #c5d8f8", background: "#e8f0fe", color: "#1f65de", fontWeight: 600, cursor: "pointer" }}>✏ Edit</button>
                        <button onClick={() => onDelete(r.Id, r.OrderNo || r.PurchaseNo || r.BillNo)}
                          style={{ padding: "3px 10px", fontSize: 11, borderRadius: 4, border: "1px solid #fecaca", background: "#fee2e2", color: "#dc2626", fontWeight: 600, cursor: "pointer" }}>🗑 Del</button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} style={{ padding: 0, background: "#eaf2ff" }}>
                          <div style={{ margin: 10 }}>
                            {rowDetails.length === 0 ? (
                              <div style={{ padding: "8px 12px", fontSize: 11, color: "#94a3b8" }}>No product details available.</div>
                            ) : (
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                                <thead>
                                  <tr>
                                    {[
                                      { label: "Code",       align: "left"  },
                                      { label: "Description",align: "left"  },
                                      { label: "MRP",        align: "right" },
                                      { label: "Pur.Rate",   align: "right" },
                                      { label: "Qty",        align: "right" },
                                      { label: "GST(%)",     align: "right" },
                                      { label: "GST Amt",    align: "right" },
                                      { label: "Disc(%)",    align: "right" },
                                      { label: "Amount",     align: "right" },
                                    ].map(h => (
                                      <th key={h.label} style={{ background: "#1f65de", color: "#fff", padding: "4px 8px", textAlign: h.align, fontWeight: 600, fontSize: 11 }}>{h.label}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {rowDetails.map((d, di) => (
                                    <tr key={di} style={{ background: di % 2 === 0 ? "#fff" : "#f7faff", borderBottom: "1px solid #e2e8f0" }}>
                                      <td style={{ padding: "3px 8px" }}>{d.ProductCode || ""}</td>
                                      <td style={{ padding: "3px 8px" }}>{d.ProductName || ""}</td>
                                      <td style={{ padding: "3px 8px", textAlign: "right" }}>{f2(vn(d.MRP)).toFixed(2)}</td>
                                      <td style={{ padding: "3px 8px", textAlign: "right" }}>{f2(vn(d.PurchaseRate)).toFixed(2)}</td>
                                      <td style={{ padding: "3px 8px", textAlign: "right" }}>{f2(vn(d.ItemQty || d.Qty)).toFixed(2)}</td>
                                      <td style={{ padding: "3px 8px", textAlign: "right" }}>{f2(vn(d.TaxPercent)).toFixed(2)}</td>
                                      <td style={{ padding: "3px 8px", textAlign: "right" }}>{f2(vn(d.TaxAmt)).toFixed(2)}</td>
                                      <td style={{ padding: "3px 8px", textAlign: "right" }}>{f2(vn(d.DiscountPercent)).toFixed(2)}</td>
                                      <td style={{ padding: "3px 8px", textAlign: "right" }}>{f2(vn(d.Amount)).toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mp-modal-ftr"><button className="mp-btn" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

// ─── F12 COLUMN SETTINGS ─────────────────────────────────────────────────────
function F12Popup({ colSettings, comid, onSave, onClose, toast }) {
  const [local, setLocal] = useState(colSettings.map(s => ({ ...s })));
  const toggle = key => setLocal(p => p.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
  const setWid = (key, w) => setLocal(p => p.map(c => c.key === key ? { ...c, width: parseInt(w) || c.width } : c));

  const handleSave = async () => {
    const payload = local.map(c => ({
      Comid: parseInt(comid) || 1, filename: "PurchaseOrder",
      column: c.key, Visible: c.visible === true, Width: parseInt(c.width) || 100,
    }));
    try {
      const res = await fetch(VisibleColumnsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", ...CC.authHeaders?.() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) { toast?.("✅ Column settings saved"); onSave(local); }
      else { toast?.("⚠️ " + (data.message || "Saved locally"), false); onSave(local); }
    } catch { onSave(local); }
  };

  return (
    <div className="mp-ov">
      <div className="mp-modal-box" style={{ width: 500, maxHeight: "82vh" }}>
        <div className="mp-modal-hdr"><span>⚙ Purchase Order Grid Column Settings (F12)</span><button onClick={onClose}>✕</button></div>
        <div className="mp-modal-body" style={{ overflowY: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
            <thead>
              <tr>{["Column", "Visible", "Width (px)"].map(h =>
                <th key={h} style={{ color: "#fff", padding: "6px 10px", background: "#1a2e4a", position: "sticky", top: 0, zIndex: 2 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {local.map((c, i) => (
                <tr key={c.key} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                  <td style={{ padding: "5px 10px", borderBottom: "1px solid #eaecf4", fontSize: 12 }}>{c.label}</td>
                  <td style={{ padding: "5px 10px", textAlign: "center", borderBottom: "1px solid #eaecf4" }}>
                    <input type="checkbox" checked={!!c.visible} onChange={() => toggle(c.key)} />
                  </td>
                  <td style={{ padding: "5px 10px", borderBottom: "1px solid #eaecf4" }}>
                    <input type="number" min={40} max={600} value={c.width}
                      style={{ width: 70, border: "1px solid #d4dbe8", borderRadius: 3, padding: "2px 6px", fontSize: 12, textAlign: "right" }}
                      onChange={e => setWid(c.key, e.target.value)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mp-modal-ftr">
          <button className="mp-btn sv" onClick={handleSave}>💾 Save</button>
          <button className="mp-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Ctrl+G Grid Focus/Reorder Popup ─────────────────────────────────────────
function CtrlGFocusPopup({ colSettings, comid, mcomid, onSaved, onClose, toast }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const url = `/Content/Appdata/Visible/${mcomid}/PurchaseOrderFocus.json?v=${Date.now()}`;
        const res = await fetch(url, { headers: CC.authHeaders?.() || {} });
        let saved = [];
        if (res.ok) { try { saved = await res.json(); } catch {} }
        const base = colSettings.filter(c => c.visible).map((c, i) => {
          const sv = Array.isArray(saved) ? saved.find(s => s.column === c.key) : null;
          return { key: c.key, label: c.label, focus: sv ? sv.Focus === true : true, index: sv ? (sv.Index ?? i) : i };
        });
        base.sort((a, b) => a.index - b.index);
        setItems(base);
      } catch {
        setItems(colSettings.filter(c => c.visible).map((c, i) => ({ key: c.key, label: c.label, focus: true, index: i })));
      } finally { setLoading(false); }
    })();
  }, [colSettings, mcomid]);

  const toggleFocus = key => setItems(p => p.map(it => it.key === key ? { ...it, focus: !it.focus } : it));
  const onDragStart = (e, idx) => { setDragIdx(idx); e.dataTransfer.effectAllowed = "move"; };
  const onDragOver  = (e, idx) => { e.preventDefault(); setOverIdx(idx); };
  const onDrop      = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setOverIdx(null); return; }
    setItems(prev => {
      const next = [...prev]; const [m] = next.splice(dragIdx, 1); next.splice(idx, 0, m);
      return next.map((it, i) => ({ ...it, index: i }));
    });
    setDragIdx(null); setOverIdx(null);
  };

  const handleSave = async () => {
    const payload = items.map((it, i) => ({
      filename: "PurchaseOrderFocus", column: it.key, Index: i, Focus: it.focus,
      Comid: parseInt(comid) || 1,
    }));
    try {
      const res = await fetch(FocusColumnsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", ...CC.authHeaders?.() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) { toast?.("✅ Focus/Reorder saved."); onSaved?.(); onClose(); }
      else { toast?.("⚠️ " + (data.message || "Save failed")); onClose(); }
    } catch (err) { toast?.("⚠️ Save failed: " + err.message); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,20,40,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 8700 }}>
      <div style={{ background: "#fff", borderRadius: 10, width: 420, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 16px 48px rgba(31,101,222,.22)", border: "1px solid #d0ddf5" }}>
        <div style={{ background: "linear-gradient(135deg,#1b3a8f 0%,#1f65de 100%)", padding: "10px 14px", display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", flex: 1 }}>⚡ Ctrl+G — Grid Column Focus & Reorder</span>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", width: 22, height: 22, borderRadius: "50%", cursor: "pointer", fontSize: 11 }}>✕</button>
        </div>
        <div style={{ background: "#f0f7ff", borderBottom: "1px solid #dde6f5", padding: "6px 12px", fontSize: 10.5, color: "#4a5568" }}>
          🖱 <strong>Drag rows</strong> to reorder &nbsp;|&nbsp; ☑ <strong>Check</strong> to enable focus navigation
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "6px 0" }}>
          {loading
            ? <div style={{ textAlign: "center", padding: 20, color: "#94a3b8", fontSize: 12 }}>Loading...</div>
            : items.map((it, idx) => (
              <div key={it.key} draggable
                onDragStart={e => onDragStart(e, idx)} onDragOver={e => onDragOver(e, idx)}
                onDrop={e => onDrop(e, idx)} onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "6px 14px", cursor: "grab",
                  background: overIdx === idx ? "#deeafb" : dragIdx === idx ? "#e8f0fe" : idx % 2 === 0 ? "#fff" : "#fafbff",
                  borderBottom: "1px solid #f0f4fc",
                  borderLeft: overIdx === idx ? "3px solid #1f65de" : "3px solid transparent",
                  userSelect: "none",
                }}>
                <span style={{ color: "#94a3b8", fontSize: 14 }}>⠿</span>
                <span style={{ width: 22, height: 22, borderRadius: 4, background: "#f0f4fc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#6b7a99", fontWeight: 700 }}>{idx + 1}</span>
                <span style={{ flex: 1, fontSize: 12, color: "#1a2e4a", fontWeight: 500 }}>{it.label}</span>
                <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                  <input type="checkbox" checked={!!it.focus} onChange={() => toggleFocus(it.key)} style={{ display: "none" }} />
                  <div style={{ width: 34, height: 18, borderRadius: 9, background: it.focus ? "#1f65de" : "#d0d8ea", position: "relative", transition: "background .2s" }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: it.focus ? 18 : 2, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
                  </div>
                </label>
              </div>
            ))
          }
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "10px 14px", borderTop: "1px solid #eaecf4", background: "#f8faff" }}>
          <button onClick={onClose} style={{ padding: "6px 16px", borderRadius: 4, border: "1px solid #c5d8f8", background: "#fff", color: "#1a2e4a", fontSize: 12, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSave} style={{ padding: "6px 16px", borderRadius: 4, border: "none", background: "#1f65de", color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>💾 Save & Apply</button>
        </div>
      </div>
    </div>
  );
}

// ─── Ctrl+F Form Focus Popup ──────────────────────────────────────────────────
function CtrlFFocusPopup({ formColumns, mcomid, comid, onSaved, onClose, toast }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const url = `/Content/Appdata/Visible/${mcomid}/PurchaseOrderFormFocus.json?v=${Date.now()}`;
        const res = await fetch(url, { headers: CC.authHeaders?.() || {} });
        let saved = [];
        if (res.ok) { try { saved = await res.json(); } catch {} }
        const base = formColumns.map((c, i) => {
          const sv = Array.isArray(saved) ? saved.find(s => s.column === c.column) : null;
          return { key: c.column, label: c.text, focus: sv ? sv.Focus === true : true, index: sv ? (sv.Index ?? i) : i };
        });
        base.sort((a, b) => a.index - b.index);
        setItems(base);
      } catch {
        setItems(formColumns.map((c, i) => ({ key: c.column, label: c.text, focus: true, index: i })));
      } finally { setLoading(false); }
    })();
  }, [formColumns, mcomid]);

  const toggleFocus = key => setItems(p => p.map(it => it.key === key ? { ...it, focus: !it.focus } : it));
  const onDragStart = (e, idx) => { setDragIdx(idx); e.dataTransfer.effectAllowed = "move"; };
  const onDragOver  = (e, idx) => { e.preventDefault(); setOverIdx(idx); };
  const onDrop      = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setOverIdx(null); return; }
    setItems(prev => {
      const next = [...prev]; const [m] = next.splice(dragIdx, 1); next.splice(idx, 0, m);
      return next.map((it, i) => ({ ...it, index: i }));
    });
    setDragIdx(null); setOverIdx(null);
  };

  const handleSave = async () => {
    const payload = items.map((it, i) => ({
      filename: "PurchaseOrderFormFocus", column: it.key, Index: i, Focus: it.focus,
      Comid: parseInt(comid) || 1,
    }));
    try {
      const res = await fetch(FocusColumnsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", ...CC.authHeaders?.() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) { toast?.("✅ Form Focus/Reorder saved."); onSaved?.(); onClose(); }
      else { toast?.("⚠️ " + (data.message || "Save failed")); onClose(); }
    } catch (err) { toast?.("⚠️ Save failed: " + err.message); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,20,40,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 8700 }}>
      <div style={{ background: "#fff", borderRadius: 10, width: 380, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 16px 48px rgba(31,101,222,.22)", border: "1px solid #d0ddf5" }}>
        <div style={{ background: "linear-gradient(135deg,#1b3a8f 0%,#1f65de 100%)", padding: "10px 14px", display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", flex: 1 }}>📋 Ctrl+F — Form Field Focus & Reorder</span>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", width: 22, height: 22, borderRadius: "50%", cursor: "pointer", fontSize: 11 }}>✕</button>
        </div>
        <div style={{ background: "#f0f7ff", borderBottom: "1px solid #dde6f5", padding: "6px 12px", fontSize: 10.5, color: "#4a5568" }}>
          🖱 <strong>Drag rows</strong> to reorder &nbsp;|&nbsp; ☑ <strong>Check</strong> to enable focus
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "6px 0" }}>
          {loading
            ? <div style={{ textAlign: "center", padding: 20, color: "#94a3b8", fontSize: 12 }}>Loading...</div>
            : items.map((it, idx) => (
              <div key={it.key} draggable
                onDragStart={e => onDragStart(e, idx)} onDragOver={e => onDragOver(e, idx)}
                onDrop={e => onDrop(e, idx)} onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "6px 14px", cursor: "grab",
                  background: overIdx === idx ? "#deeafb" : dragIdx === idx ? "#e8f0fe" : idx % 2 === 0 ? "#fff" : "#fafbff",
                  borderBottom: "1px solid #f0f4fc",
                  borderLeft: overIdx === idx ? "3px solid #1f65de" : "3px solid transparent",
                  userSelect: "none",
                }}>
                <span style={{ color: "#94a3b8", fontSize: 14 }}>⠿</span>
                <span style={{ width: 22, height: 22, borderRadius: 4, background: "#f0f4fc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#6b7a99", fontWeight: 700 }}>{idx + 1}</span>
                <span style={{ flex: 1, fontSize: 12, color: "#1a2e4a", fontWeight: 500 }}>{it.label}</span>
                <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                  <input type="checkbox" checked={!!it.focus} onChange={() => toggleFocus(it.key)} style={{ display: "none" }} />
                  <div style={{ width: 34, height: 18, borderRadius: 9, background: it.focus ? "#1f65de" : "#d0d8ea", position: "relative", transition: "background .2s" }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: it.focus ? 18 : 2, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
                  </div>
                </label>
              </div>
            ))
          }
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "10px 14px", borderTop: "1px solid #eaecf4", background: "#f8faff" }}>
          <button onClick={onClose} style={{ padding: "6px 16px", borderRadius: 4, border: "1px solid #c5d8f8", background: "#fff", color: "#1a2e4a", fontSize: 12, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSave} style={{ padding: "6px 16px", borderRadius: 4, border: "none", background: "#1f65de", color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>💾 Save & Apply</button>
        </div>
      </div>
    </div>
  );
}

// ─── Delivery Address Popup (Ctrl+A) ─────────────────────────────────────────
function DeliveryAddressPopup({ d1, d2, onChange, onClose }) {
  const [v1, setV1] = useState(d1);
  const [v2, setV2] = useState(d2);
  const ref1 = useRef(null);
  useEffect(() => { setTimeout(() => ref1.current?.focus(), 100); }, []);

  return (
    <div className="mp-ov" onClick={e => { if (e.target === e.currentTarget) onClose(v1, v2); }}>
      <div className="mp-modal-box" style={{ width: 420 }}>
        <div className="mp-modal-hdr"><span>📦 Delivery Address</span><button onClick={() => onClose(v1, v2)}>✕</button></div>
        <div className="mp-modal-body" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#4a5568" }}>Address Line 1</label>
            <input ref={ref1} value={v1} onChange={e => setV1(e.target.value)}
              onKeyDown={e => e.key === "Enter" && document.getElementById("po-d2")?.focus()}
              style={{ display: "block", width: "100%", marginTop: 4, height: 28, border: "1px solid #b8ccee", borderRadius: 3, padding: "0 8px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#4a5568" }}>Address Line 2</label>
            <input id="po-d2" value={v2} onChange={e => setV2(e.target.value)}
              onKeyDown={e => e.key === "Enter" && onClose(v1, v2)}
              style={{ display: "block", width: "100%", marginTop: 4, height: 28, border: "1px solid #b8ccee", borderRadius: 3, padding: "0 8px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
        </div>
        <div className="mp-modal-ftr">
          <button className="mp-btn sv" onClick={() => { onChange(v1, v2); onClose(v1, v2); }}>✔ OK</button>
          <button className="mp-btn" onClick={() => onClose(v1, v2)}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── INLINE STYLES ────────────────────────────────────────────────────────────
const fieldInput = { height: 24, border: "1px solid #b8ccee", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", background: "#fff", color: "#1a2e4a" };
const fieldLabel = { fontSize: 12, fontWeight: 600, color: "#4a5568", minWidth: 80, flexShrink: 0 };
const panelStyle = { border: "1px solid #c8d8ee", borderRadius: 4, background: "#fff", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 };
const panelTitle = { fontSize: 11, fontWeight: 700, color: "#4a5568", borderBottom: "1px solid #e2e8f0", paddingBottom: 4, marginBottom: 2 };

const RIGHT_KEYS = new Set([
  "Amount", "PurchaseRate", "ItemQty", "MRP", "TaxPercent",
  "DiscountPercent", "TaxAmt", "DiscountAmt", "cdpercent", "cdAmount",
  "Pcs", "Meter", "Noms", "LandingCost", "ProductTotal",
  "CTAmount", "STAmount", "Salerate", "StockQty", "NomsQty",
]);

// ─── FORM COLUMNS FOR Ctrl+F ──────────────────────────────────────────────────
const FORM_COLUMNS = [
  { text: "OrderDate",    column: "dtppurchasedate" },
  { text: "PurchaseType", column: "cmbpurchaseType" },
  { text: "Supplier",     column: "cmbsupplier"     },
  { text: "GridPurchase", column: "gridpurchase"    },
  { text: "Others(+)",    column: "txtotherplus"    },
  { text: "Others(-)",    column: "txtothersub"     },
  { text: "Remarks",      column: "txtremarks"      },
];

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function PurchaseOrder() {
  const navigate               = useNavigate();
  const { confirm, ConfirmUI } = CC.useConfirm();
  const { toast, toasts }      = CC.useToast();

  // ── Settings from localStorage ────────────────────────────────────────────
  const [settings] = useState(() => {
    try {
      const main0 = (CC.getLocal("Mainsetting")    || [{}])[0] || {};
      const com0  = (CC.getLocal("Companysetting") || [{}])[0] || {};
      const Comid  = CC.getStr("Comid")  || "1";
      const MComid = CC.getStr("MComid") || Comid;
      return {
        Comid:  main0.CommonCompany ? MComid : Comid,
        MComid,
        BillPrefix:             com0.BillPrefix || "",
        PrintA4Bill:            main0.SaveDislogPurchaseOrder ? 1 : 0,
        univercell:             main0.univercell  || false,
        EcoTech:                main0.Ecotech     || false,
        SaleLandingCostCompare: false,
        BillFormatName:         com0.SaleReturnBillFormat || "PurchaseOrder",
        CompanyName: com0.Companyname || "",
        CAddress1:   com0.Address1   || "",
        CAddress2:   com0.Address2   || "",
        CCity:       com0.City       || "",
        CPincode:    com0.Pincode    || "",
        CMobileNo:   com0.Phone      || "",
        GSTNO:       com0.GSTNo      || "",
        Email:       com0.Email      || "",
        StateCode:   com0.State      || "",
        NoofBills:   com0.No_Of_Bills || 1,
      };
    } catch {
      return {
        Comid: "1", MComid: "1", BillPrefix: "",
        PrintA4Bill: 0, univercell: false, EcoTech: false,
        SaleLandingCostCompare: false, BillFormatName: "PurchaseOrder",
        CompanyName: "", CAddress1: "", CAddress2: "", CCity: "", CPincode: "",
        CMobileNo: "", GSTNO: "", Email: "", StateCode: "", NoofBills: 1,
      };
    }
  });

  // ── Column / Focus Settings ────────────────────────────────────────────────
  const [colSettings, setColSettings] = useState(DEFAULT_COL_SETTINGS);
  const [f12Open,     setF12Open]     = useState(false);
  const [ctrlGOpen,   setCtrlGOpen]   = useState(false);
  const [ctrlFOpen,   setCtrlFOpen]   = useState(false);
  const visCols = colSettings.filter(c => c.visible);
 const [focusCols, setFocusCols] = useState([]);
  const focusColsRef = useRef([]);
  useEffect(() => { focusColsRef.current = focusCols; }, [focusCols]);
  const focusEnabledCols = useMemo(() => {
    const defaultCols = visCols
      .map(vc => PO_COLUMNS?.find(c => c.key === vc.key))
      .filter(Boolean)
      .filter(cd => !cd.readOnly)
      .map(cd => cd.key);

    if (focusCols.length === 0) return defaultCols;
    return defaultCols.filter(k => focusCols.includes(k));
  }, [visCols, focusCols]);

  const loadColCfg = useCallback(async (comid) => {
    try {
      const url = `/Content/Appdata/Visible/${comid}/PurchaseOrder.json?v=${Date.now()}`;
      const res = await fetch(url, { headers: CC.authHeaders?.() || {} });
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;
      setColSettings(prev => prev.map(col => {
        const s = data.find(x => x.column === col.key);
        return s ? { ...col, visible: s.Visible === true, width: Number(s.Width) || col.width } : col;
      }));
    } catch {}
  }, []);

 

  const loadFocusCols = useCallback(async (mcomid) => {
    try {
      const url = `/Content/Appdata/Visible/${mcomid}/PurchaseOrderFocus.json?v=${Date.now()}`;
      const res = await fetch(url, { headers: CC.authHeaders?.() || {} });
      if (!res.ok) return;
      const saved = await res.json();
      if (!Array.isArray(saved)) return;
      const ordered = saved.filter(s => s.Focus === true)
        .sort((a, b) => (a.Index ?? 99) - (b.Index ?? 99))
        .map(s => s.column);
      focusColsRef.current = ordered;
      setFocusCols(ordered);
    } catch {}
  }, []);

  // ── State ─────────────────────────────────────────────────────────────────
  const [perm,         setPerm]         = useState({ View: 0, Add: 0, Edit: 0, Delete: 0 });
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [suppliers,    setSuppliers]    = useState([]);
  const [prodList,     setProdList]     = useState([]);
  const [poReqList,    setPoReqList]    = useState([]);

  const [purchaseNo,       setPurchaseNo]       = useState("");
  const [manualPurchaseNo, setManualPurchaseNo] = useState("");
  const [autoPurchaseNo,   setAutoPurchaseNo]   = useState("");
  const [purchaseNoMode,   setPurchaseNoMode]   = useState("AP"); // "MP" or "AP"

  const [purchaseDate, setPurchaseDate] = useState(today());
  const [purchaseType, setPurchaseType] = useState("CASH");
  const [suppId,       setSuppId]       = useState("");
  const [supplierDetails, setSupplierDetails] = useState({ address: "", city: "", contactno: "", balance: "0.00" });
  const [creditdays,   setCreditdays]   = useState(0);
  const [igstBill,     setIgstBill]     = useState(false);
  const [remarks,      setRemarks]      = useState("");
  const [poReqId,      setPoReqId]      = useState("");
  const [editId,       setEditId]       = useState(0);

  const [pfPer,        setPfPer]        = useState("0.00");
  const [pfAmt,        setPfAmt]        = useState("0.00");
  const [otherPlus,    setOtherPlus]    = useState("0.00");
  const [otherMinus,   setOtherMinus]   = useState("0.00");

  const [d1, setD1]           = useState("");
  const [d2, setD2]           = useState("");
  const [addrOpen, setAddrOpen] = useState(false);

  const [rows,     setRows]     = useState([mkRow()]);
  const [selRid,   setSelRid]   = useState(null);
  const [totals,   setTotals]   = useState({ ProductTotal: 0, GSTAmt: 0, DiscAmt: 0, CdAmt: 0, NetAmt: 0, TotalQty: 0 });
  const [gstSplit, setGstSplit] = useState([]);

  const [loading,  setLoading]  = useState(false);
  const [ldMsg,    setLdMsg]    = useState("Loading...");
  const [pw,       setPw]       = useState(null);
  const pwOkRef = useRef(null);

  const [prodPopup, setProdPopup] = useState(null);
  const [f5Open,    setF5Open]    = useState(false);
  const [f5Rows,    setF5Rows]    = useState([]);
  const [f5Details, setF5Details] = useState([]);

  const rowsRef  = useRef(rows);
  const cellRefs = useRef({});
  const suppRef  = useRef(null);

  useEffect(() => { rowsRef.current = rows; }, [rows]);

  // ── Selected row for stock/rate display ───────────────────────────────────
  const selectedRow = useMemo(() => rows.find(r => r._rid === selRid) || null, [rows, selRid]);
  const currentStockDisplay = (selectedRow && selectedRow.ProductRefId)
    ? f2(vn(selectedRow.StockQty)).toFixed(selectedRow.UOMDecimal === 0 ? 0 : (selectedRow.UOMDecimal || 2))
    : "0.00";
  const currentRateDisplay = (selectedRow && selectedRow.ProductRefId)
    ? f2(vn(selectedRow.PurchaseRate)).toFixed(2)
    : "0.00";

  const regCell = (rid, key, el) => {
    if (!cellRefs.current[rid]) cellRefs.current[rid] = {};
    if (el) cellRefs.current[rid][key] = el;
    else delete cellRefs.current[rid]?.[key];
  };

  // ── Permission check ──────────────────────────────────────────────────────
  useEffect(() => {
    const menuStr = localStorage.getItem("menulist");
    if (!menuStr) { alert("Session Close Please Login !!!."); navigate("/"); return; }
    const menulist = JSON.parse(menuStr);
    const menudata = menulist.filter(o => o.PageName === "Purchase Order");
    if (!menudata || menudata.length === 0) { alert("Page Access Permission Denied !!!."); setTimeout(() => navigate("/Home"), 3000); return; }
    if (menudata[0].View === 0) { alert("Page Access Permission Denied !!!."); navigate("/Home"); return; }
    setPerm({ View: menudata[0].View, Add: menudata[0].Add, Edit: menudata[0].Edit, Delete: menudata[0].Delete });
    setIsAuthorized(true);
  }, [navigate]);

  const redirectIfDualLogin = useCallback(res => {
    if (res?._dualLogin || res?.redis === false) { alert("Already Login Another User Please Login Again!!!"); navigate("/"); return true; }
    return false;
  }, [navigate]);

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthorized) return;
    (async () => {
      setLoading(true); setLdMsg("Loading...");
      await Promise.all([loadDropdowns(), loadPurchaseNo(), loadColCfg(settings.Comid), loadFocusCols(settings.MComid)]);
      setLoading(false);
      setTimeout(() => {
        const fr = rowsRef.current[0];
        if (fr) cellRefs.current[fr._rid]?.["ProductCode"]?.focus();
      }, 200);
    })();
    // eslint-disable-next-line
  }, [isAuthorized]);

  // ── Load Purchase No ─────────────────────────────────────────────────────
  const loadPurchaseNo = useCallback(async () => {
    const res = await CC.api(PurchaseOrderMaxNo, null, {}, { Comid: settings.Comid });
    if (redirectIfDualLogin(res)) return;
    const no = res.No || res.data || "";
    if (no) { setPurchaseNo(ns(no)); setAutoPurchaseNo(ns(no)); }
  }, [settings.Comid, redirectIfDualLogin]);

  // ── Load Dropdowns ───────────────────────────────────────────────────────
  const loadDropdowns = useCallback(async () => {
    const comid = settings.Comid;
    const [suppRes, poRes] = await Promise.all([
      CC.api(GetSupplierUrl, null, {}, { Comid: comid, AccountType: "SUPPLIER" }),
      CC.api(PoReqUrl, null, {}, { Comid: comid }).catch(() => ({ data: [] })),
    ]);
    if (redirectIfDualLogin(suppRes)) return;
    const pick = r => r.data || r.Data1 || r || [];
    setSuppliers(Array.isArray(pick(suppRes)) ? pick(suppRes) : []);
    setPoReqList(Array.isArray(pick(poRes)) ? pick(poRes) : []);
  }, [settings.Comid, redirectIfDualLogin]);

  // ── Supplier Details Load ─────────────────────────────────────────────────
  const loadSupplierDetails = useCallback((sid) => {
    if (!sid) {
      setSupplierDetails({ address: "", city: "", contactno: "", balance: "0.00" });
      return;
    }
    const found = suppliers.find(s => String(s.Id) === String(sid));
    if (found) {
      const addr = found.Address2 ? `${found.Address1},${found.Address2}` : (found.Address1 || "");
      setSupplierDetails({ address: addr, city: found.City || "", contactno: found.MobileNo || "", balance: "0.00" });
      setCreditdays(found.CreditBillDays || 0);
      setIgstBill(found.IGSTBill || false);
    }
  }, [suppliers]);

  const handleSupplierChange = useCallback((sid) => {
    setSuppId(sid);
    loadSupplierDetails(sid);
  }, [loadSupplierDetails]);

  // ── Purchase No mode radio ────────────────────────────────────────────────
  const handlePurchaseNoMode = useCallback((mode) => {
    setPurchaseNoMode(mode);
    if (mode === "MP") { setManualPurchaseNo(""); setAutoPurchaseNo(""); }
    else { setManualPurchaseNo(""); setAutoPurchaseNo(purchaseNo); }
  }, [purchaseNo]);

  // ── Recalc totals ─────────────────────────────────────────────────────────
  const recalcAllTotals = useCallback((rowsArr, oPlus, oMinus, pfAmtVal) => {
    let productTotal = 0, gstTotal = 0, discTotal = 0, cdTotal = 0;
    let ctTotal = 0, stTotal = 0, qtyTotal = 0;
    const gstMap = {};

    rowsArr.forEach(r => {
      if (!r.ProductRefId) return;
      productTotal += vn(r.ProductTotal);
      gstTotal     += vn(r.TaxAmt);
      discTotal    += vn(r.DiscountAmt);
      cdTotal      += vn(r.cdAmount);
      ctTotal      += vn(r.CTAmount);
      stTotal      += vn(r.STAmount);
      qtyTotal     += vn(r.ItemQty);

      const key = f2(vn(r.TaxPercent));
      if (!gstMap[key]) gstMap[key] = { TaxPercent: key, TaxAmt: 0, CTAmount: 0, STAmount: 0 };
      gstMap[key].TaxAmt   += vn(r.TaxAmt);
      gstMap[key].CTAmount += vn(r.CTAmount);
      gstMap[key].STAmount += vn(r.STAmount);
    });

    const splcess  = settings.EcoTech ? (oPlus + vn(pfAmtVal)) * (18 / 100) : 0;
    const transAmt = settings.EcoTech ? vn(pfAmtVal) : 0;
    const netAmt   = f2(productTotal + gstTotal + splcess + transAmt + oPlus - cdTotal - discTotal - oMinus);

    setGstSplit(Object.values(gstMap).filter(g => g.TaxAmt > 0));
    setTotals({ ProductTotal: f2(productTotal), GSTAmt: f2(gstTotal), DiscAmt: f2(discTotal), CdAmt: f2(cdTotal), NetAmt: netAmt, TotalQty: f2(qtyTotal) });
  }, [settings.EcoTech]);

  // Recalc on any relevant state change
  useEffect(() => {
    recalcAllTotals(rows, vn(otherPlus), vn(otherMinus), vn(pfAmt));
    // eslint-disable-next-line
  }, [rows, otherPlus, otherMinus, pfAmt]);

  // ── PF % / PF Amt (EcoTech) ───────────────────────────────────────────────
  const handlePfPerEnter = useCallback(() => {
    const pf  = vn(pfPer);
    const net = totals.NetAmt;
    const amt = net * pf / 100;
    setPfAmt(amt.toFixed(2));
  }, [pfPer, totals.NetAmt]);

  const handlePfAmtEnter = useCallback(() => {
    const amt = vn(pfAmt);
    const net = totals.NetAmt;
    const per = net !== 0 ? (amt / net) * 100 : 0;
    setPfPer(per.toFixed(2));
  }, [pfAmt, totals.NetAmt]);

  // ── Fill item into row ────────────────────────────────────────────────────
  const fillItemIntoRow = useCallback((rid, item) => {
    setRows(prev => {
      const newRows = prev.map(r => {
        if (r._rid !== rid) return r;
        const updated = {
          ...r,
          ProductRefId:      item.Id,
          ProductCode:       item.ProductCode || item.Prod_Code || "",
          ProductName:       item.ProductName || item.PName || "",
          MRP:               ns(f2(vn(item.MRP))),
          PurchaseRate:      ns(f2(vn(item.PurchaseRate))),
          LandingCost:       ns(f2(vn(item.LandingCost))),
          TaxPercent:        ns(f2(vn(item.GST || item.TaxPercent))),
          UOM:               item.UOM || "",
          UOMDecimal:        item.UOMDecimal || 0,
          NomsQty:           item.NomsQty || 0,
          StockQty:          item.Stock || 0,
          Salerate:          ns(f2(vn(item.SalesRate || item.SaleRate))),
          UnitSpecification: item.Remarks || "",
          ItemQty:           "1",
          _dirty:            true,
        };
        if (settings.SaleLandingCostCompare && vn(updated.MRP) < vn(updated.PurchaseRate)) {
          toast("⚠️ Purchase Rate is Greater than MRP!", true);
        }
        return calcPurchaseRow(updated, igstBill);
      });
      return newRows;
    });

    setProdPopup(null);

    setTimeout(() => {
      const editableCols = PO_COLUMNS.filter(c => !c.readOnly && c.key !== "ProductCode").map(c => c.key);
      const firstFocusCol = focusColsRef.current.length > 0
        ? focusColsRef.current.find(k => k !== "ProductCode" && editableCols.includes(k))
        : "ItemQty";
      const el = cellRefs.current[rid]?.[firstFocusCol || "ItemQty"];
      if (el) { el.focus(); el.select?.(); }
    }, 50);
  }, [settings, igstBill, toast]);

  // ── Fetch product by code ─────────────────────────────────────────────────
  const fetchProductByCode = useCallback(async (rid, code) => {
    if (!code.trim()) return;
    const res = await CC.api(SelectItemByCodeUrl, null, {}, {
      code: code.trim().toUpperCase(),
      Comid: settings.MComid, CComid: settings.Comid,
      Id: 0, Batchwise: 0,
    });
    if (redirectIfDualLogin(res)) return;
    const arr = Array.isArray(res.data) ? res.data : Array.isArray(res.Data1) ? res.Data1 : [];
    if (arr.length === 0) { toast("❌ Invalid Product Code !!!", true); return; }
    if (arr.length === 1) fillItemIntoRow(rid, arr[0]);
    else { setProdList(arr); setProdPopup({ rid, pos: { top: 200, left: 80 } }); }
  }, [settings, fillItemIntoRow, redirectIfDualLogin, toast]);

  // ── Load product list for popup ───────────────────────────────────────────
  const loadProductsForPopup = useCallback(async (rid) => {
    if (prodList.length > 0) { setProdPopup({ rid, pos: { top: 160, left: 80 } }); return; }
    setLoading(true); setLdMsg("Loading products...");
    const res = await CC.api(ProductListUrl, null, {}, { Comid: settings.Comid });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    const arr = Array.isArray(res.data) ? res.data : Array.isArray(res.Data1) ? res.Data1 : [];
    setProdList(arr);
    setProdPopup({ rid, pos: { top: 160, left: 80 } });
  }, [settings, prodList, redirectIfDualLogin]);

  // ── Cell change — mirrors SaleOrder.handleCellChange exactly ─────────────
  // KEY FIX: no editingCellRef, no onBlur; ItemQty included in recalc list
  const handleCellChange = useCallback((rid, colKey, value) => {
    setRows(prev => prev.map(r => {
      if (r._rid !== rid) return r;
      if (colKey === "ItemQty") {
        if (r.UOMDecimal === 0 && String(value).includes(".")) {
          return r;
        }
      }
      let updated = { ...r, [colKey]: value, _dirty: true };

      // Pcs/Meter → auto-compute ItemQty
      if (colKey === "Pcs" || colKey === "Meter") {
        const pcs   = colKey === "Pcs"   ? vn(value) : vn(r.Pcs);
        const meter = colKey === "Meter" ? vn(value) : vn(r.Meter) || 1;
        const totalqty = pcs * meter;
        const dec = r.UOMDecimal;
        updated.ItemQty = dec === 0 ? Math.round(totalqty).toFixed(0) : dec === 2 ? totalqty.toFixed(2) : totalqty.toFixed(3);
      }

      // PurchaseRate vs MRP guard
      if (colKey === "PurchaseRate" && settings.SaleLandingCostCompare) {
        if (vn(value) > vn(r.MRP)) toast("⚠️ Purchase Rate is Greater than MRP!", true);
      }

      // Recalc on any numeric-affecting column — includes ItemQty (KEY FIX)
      if ([
        "ItemQty", "PurchaseRate", "TaxPercent", "DiscountPercent", "DiscountAmt",
        "cdpercent", "cdAmount", "MRP", "Noms", "Pcs", "Meter",
      ].includes(colKey)) {
        return calcPurchaseRow(updated, igstBill);
      }
      return updated;
    }));
  }, [igstBill, settings, toast]);

  // ── Delete row ────────────────────────────────────────────────────────────
  const doDeleteRow = useCallback(async (rid) => {
    const ok = await confirm("Do you Want to Delete Row?");
    if (!ok) return;
    setRows(prev => {
      const next = prev.filter(r => r._rid !== rid);
      return next.length === 0 ? [mkRow()] : next;
    });
  }, [confirm]);

  // ── Cell keydown — mirrors SaleOrder.handleCellKeyDown exactly ────────────
  const handleCellKeyDown = useCallback((e, rid, colKey) => {
    const editableCols = visCols
      .map(vc => PO_COLUMNS.find(c => c.key === vc.key))
      .filter(Boolean).filter(cd => !cd.readOnly).map(cd => cd.key);

    const COLS = focusColsRef.current.length > 0
      ? ["ProductCode", ...focusColsRef.current.filter(k => k !== "ProductCode" && editableCols.includes(k))]
      : ["ProductCode", ...editableCols.filter(k => k !== "ProductCode")];

    const colIdx = COLS.indexOf(colKey);
    const rowIdx = rowsRef.current.findIndex(r => r._rid === rid);

    const focusCell = (targetRid, targetKey) => {
      setTimeout(() => {
        const el = cellRefs.current[targetRid]?.[targetKey];
        if (el) { el.focus(); el.select?.(); }
      }, 10);
    };

    if (e.key === "Enter") {
      e.preventDefault();

      // ProductCode Enter → fetch product
      if (colKey === "ProductCode") {
        const row = rowsRef.current.find(r => r._rid === rid);
        if (row?.ProductCode?.trim()) fetchProductByCode(rid, row.ProductCode);
        else loadProductsForPopup(rid);
        return;
      }

      // PurchaseRate validation
      if (colKey === "PurchaseRate") {
        const row = rowsRef.current.find(r => r._rid === rid);
        if (vn(row?.PurchaseRate) === 0) { toast("Enter the PurchaseRate !!!", true); return; }
        if (settings.SaleLandingCostCompare && vn(row?.MRP) < vn(row?.PurchaseRate)) {
          toast("Purchase Rate is Greater than MRP Cost !!!", true); return;
        }
      }

      // ItemQty validation — single setRows call, mirrors SaleOrder exactly
      if (colKey === "ItemQty") {
        const row = rowsRef.current.find(r => r._rid === rid);
        if ((vn(row?.ItemQty) + vn(row?.Noms)) === 0) {
          setRows(prev => prev.map(r => r._rid === rid
            ? calcPurchaseRow({ ...r, ItemQty: "1" }, igstBill) : r));
        }
      }

      // Pcs/Meter → finalize ItemQty then navigate
      if (colKey === "Pcs" || colKey === "Meter") {
        const row = rowsRef.current.find(r => r._rid === rid);
        if (row) {
          const pcs   = vn(row.Pcs);
          const meter = vn(row.Meter) || 1;
          const total = pcs * meter;
          const dec   = row.UOMDecimal;
          const fmt   = dec === 0 ? Math.round(total).toFixed(0) : dec === 2 ? total.toFixed(2) : total.toFixed(3);
          setRows(prev => prev.map(r => r._rid !== rid ? r : calcPurchaseRow({ ...r, ItemQty: fmt }, igstBill)));
        }
      }

      // Move to next column, or next row / new row
      if (colIdx >= 0 && colIdx < COLS.length - 1) {
        focusCell(rid, COLS[colIdx + 1]);
      } else {
        const curRows = rowsRef.current;
        const isLast  = rowIdx === curRows.length - 1;
        if (isLast) {
          const curRow = curRows.find(r => r._rid === rid);
          if (curRow?.ProductRefId) {
            const newRow = mkRow();
            setRows(prev => [...prev, newRow]);
            setTimeout(() => { cellRefs.current[newRow._rid]?.["ProductCode"]?.focus(); }, 80);
          } else { focusCell(rid, "ProductCode"); }
        } else {
          const nextRow = curRows[rowIdx + 1];
          setTimeout(() => { cellRefs.current[nextRow._rid]?.["ProductCode"]?.focus(); }, 20);
        }
      }
      return;
    }

    if (e.key === "ArrowDown" && rowIdx < rowsRef.current.length - 1) { e.preventDefault(); focusCell(rowsRef.current[rowIdx + 1]._rid, colKey); }
    if (e.key === "ArrowUp"   && rowIdx > 0)  { e.preventDefault(); focusCell(rowsRef.current[rowIdx - 1]._rid, colKey); }
    if (e.key === "ArrowRight" && colIdx < COLS.length - 1) { e.preventDefault(); focusCell(rid, COLS[colIdx + 1]); }
    if (e.key === "ArrowLeft"  && colIdx > 0) { e.preventDefault(); focusCell(rid, COLS[colIdx - 1]); }
    if (e.key === "Delete") { e.preventDefault(); doDeleteRow(rid); }
    if (e.key === " " && colKey === "ProductCode") { e.preventDefault(); loadProductsForPopup(rid); }
  }, [visCols, fetchProductByCode, loadProductsForPopup, doDeleteRow, toast, settings, igstBill]);

  // ── Grid validation ───────────────────────────────────────────────────────
  const gridemptycheck = useCallback(() => {
    let rowsArr = [...rowsRef.current];
    const last = rowsArr[rowsArr.length - 1];
    if (last && (!last.ProductCode || last.ProductCode === "")) {
      if (rowsArr.length > 1) rowsArr = rowsArr.slice(0, -1);
    }
    for (let i = 0; i < rowsArr.length; i++) {
      const r = rowsArr[i];
      if (!r.ProductRefId) {
        toast("Enter All Valid Product Code in the Grid !!!", true);
        cellRefs.current[r._rid]?.["ProductCode"]?.focus();
        return false;
      }
      if ((vn(r.ItemQty) + vn(r.Noms)) === 0) {
        toast("Enter All Quantity in the Grid !!!", true);
        cellRefs.current[r._rid]?.["ItemQty"]?.focus();
        return false;
      }
      if (vn(r.PurchaseRate) === 0) { toast("Enter All PurchaseRate in the Grid !!!", true); return false; }
      if (vn(r.Amount) === 0)       { toast("Enter All Amount in the Grid !!!", true); return false; }
    }
    setRows(rowsArr.length > 0 ? rowsArr : [mkRow()]);
    return true;
  }, [toast]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const doSave = useCallback(async () => {
    if (!perm.Add && editId === 0) { toast("❌ Page Add Permission Denied !!!", true); return; }
    if (!gridemptycheck()) return;
    if (!suppId) { toast("❌ Select Valid Supplier !!!", true); suppRef.current?.focus(); return; }

    const confirmed = await confirm("Wish to Save Purchase Order Bill Details ?");
    if (!confirmed) return;

    const suppObj = suppliers.find(s => String(s.Id) === String(suppId));
    const finalPurchaseNo = purchaseNoMode === "MP" ? manualPurchaseNo : autoPurchaseNo || purchaseNo;

    setLoading(true); setLdMsg("Saving...");

    const purchasedetails = rowsRef.current
      .filter(r => r.ProductRefId && (vn(r.ItemQty) + vn(r.Noms)) > 0)
      .map(r => ({ ...r, PDId: r.PDId ?? 0 }));

    const purchasemaster = [{
      Id:                  editId,
      SupplierRefId:       parseInt(suppId) || 0,
      PurchaseNo:          parseInt(finalPurchaseNo) || 0,
      CompanyRefId:        parseInt(settings.Comid),
      SupplierInvoiceDate: purchaseDate + "T00:00:00",
      DueDate:             purchaseDate + "T00:00:00",
      SupplierInvoiceNo:   "",
      PurchaseDate:        purchaseDate,
      PurchaseType:        purchaseType,
      Modified_By:         localStorage.getItem("username") || "",
      SupplierName:        suppObj?.AccountName || "",
      Address1:            suppObj?.Address1    || "",
      Address2:            suppObj?.Address2    || "",
      City:                suppObj?.City        || "",
      Email:               suppObj?.Email       || "",
      Phone:               suppObj?.MobileNo    || "",
      Tin:                 suppObj?.GSTNo       || "",
      IGSTBill:            igstBill === true ? 1 : 0,
      creditdays:          creditdays,
      Others_A:            vn(otherPlus),
      Others_D:            vn(otherMinus),
      cdamount:            settings.EcoTech ? vn(pfPer) : 0,
      discamount:          settings.EcoTech ? vn(pfAmt) : 0,
      taxamount:           totals.GSTAmt,
      NetAmt:              totals.NetAmt,
      Remarks:             remarks,
      DeleteStatus:        1,
      PD1:                 d1,
      PD2:                 d2,
      PRNO:                "",
      Ecotech:             settings.EcoTech ? 1 : 0,
      MPNo:                purchaseNoMode === "MP" ? manualPurchaseNo : "",
      PurchaseDetails:     purchasedetails,
    }];

    const res = await CC.insertapi(PurchaseOrderInsertUrl, purchasemaster, {
      PrintA4Invoice: String(settings.PrintA4Bill),
      Ecotech:        settings.EcoTech ? 1 : 0,
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;

    if (res.ok ?? res.IsSuccess) {
      toast("✅ Purchase Order Saved Successfully");
      if (settings.PrintA4Bill === 1) {
        const { CompanyName, CAddress1, CAddress2, CCity, CPincode, CMobileNo, GSTNO, Email: CEmail, StateCode } = settings;
        const PrintDetails = `&CompanyName=${CompanyName}&Address1=${CAddress1}&Address2=${CAddress2}&City=${CCity}&Pincode=${CPincode}&MobileNo=${CMobileNo}&GSTNO=${GSTNO}&Email=${CEmail}&StateCode=${StateCode}&PD1=${d1}&PD2=${d2}`;
        const choice     = window.confirm("Do you want to Print or View PurchaseOrder?") ? "Print" : "View";
        const reportName = settings.EcoTech ? "PurchaseOrderEcoTech" : "PurchaseOrder";
        if (choice === "Print") {
          window.open(`../Reports/ReportViewer.aspx?ReportName=${reportName}&Copy=Original&A4Print=1&MailSendStatus=0${PrintDetails}`, "_blank",
            `directories=0,titlebar=0,toolbar=0,location=0,status=0,menubar=0,scrollbars=yes,resizable=no,width=25,height=25`);
        } else {
          window.open(`../Reports/ReportViewer.aspx?ReportName=${reportName}&Copy=Original&A4Print=0&MailSendStatus=0${PrintDetails}`, "_blank",
            `directories=0,titlebar=0,toolbar=0,location=0,status=0,menubar=0,scrollbars=yes,resizable=no,width=${screen.width},height=${screen.height - 100}`);
        }
      }
      await clearForm();
    } else {
      toast("❌ " + (res.Message || res.message || "Save Failed"), true);
    }
  }, [
    perm, editId, gridemptycheck, suppId, suppliers, settings, purchaseNoMode,
    manualPurchaseNo, autoPurchaseNo, purchaseNo, purchaseDate, purchaseType,
    igstBill, creditdays, otherPlus, otherMinus, pfPer, pfAmt, totals, remarks,
    d1, d2, confirm, redirectIfDualLogin, toast,
  ]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const doDelete = useCallback(async () => {
    if (!editId) { toast("No Delete Id !!!", true); return; }
    if (!perm.Delete) { toast("❌ Page Delete Permission Denied !!!", true); return; }
    const ok = await confirm(`Do You Want TO Delete Purchase Order. This is Order No ${purchaseNo}?`);
    if (!ok) return;
    setLoading(true);
    const res = await CC.api(PurchaseOrderDeleteUrl, null, {}, { Id: editId });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res.ok ?? res.IsSuccess) { toast("✅ " + (res.message || "Deleted Successfully")); await clearForm(); }
    else { toast("❌ " + (res.message || "Delete Failed"), true); }
  }, [editId, perm, purchaseNo, confirm, redirectIfDualLogin, toast]);

  // ── F5 View ───────────────────────────────────────────────────────────────
  const openF5 = useCallback(async (from = purchaseDate, to = purchaseDate, sid = "0") => {
    if (!perm.Edit) { toast("❌ Page Edit Permission Denied !!!", true); return; }
    setLoading(true); setLdMsg("Loading orders...");
    const res = await CC.api(PurchaseOrderSelectUrl, null, {}, {
      Comid: settings.Comid, Fromdate: from, Todate: to, Id: parseInt(sid) || 0,
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res?.IsSuccess === false || res?.ok === false) {
      toast("❌ " + (res?.Message || res?.message || "Load Failed"), true); return;
    }
    setF5Rows(Array.isArray(res?.Data1) ? res.Data1 : []);
    setF5Details(Array.isArray(res?.Data2) ? res.Data2 : []);
    setF5Open(true);
  }, [settings, perm, purchaseDate, redirectIfDualLogin, toast]);

  // ── F5 delete from modal ──────────────────────────────────────────────────
  const handleF5Delete = useCallback(async (id, billNo) => {
    if (!perm.Delete) { toast("❌ Page Delete Permission Denied !!!", true); return; }
    pwOkRef.current = async () => {
      const ok = await confirm(`Delete Purchase Order "${billNo}"?`);
      if (!ok) return;
      setLoading(true); setLdMsg("Deleting...");
      const res = await CC.api(PurchaseOrderDeleteUrl, null, {}, { Id: id });
      setLoading(false);
      if (redirectIfDualLogin(res)) return;
      if (res.ok ?? res.IsSuccess) { toast("✅ " + (res.message || "Deleted Successfully")); await openF5(); }
      else { toast("❌ " + (res.message || "Delete Failed"), true); }
    };
    setPw({ title: "Delete Pwd" });
  }, [perm, confirm, redirectIfDualLogin, toast, openF5]);

  // ── Edit ──────────────────────────────────────────────────────────────────
  const doEdit = useCallback(async (id, pno = 0) => {
    setF5Open(false);
    if (!perm.Edit) { toast("❌ Page Edit Permission Denied !!!", true); return; }
    setLoading(true); setLdMsg("Loading order...");

    const res = await CC.api(PurchaseOrderEditUrl, null, {
      EcoStock: settings.EcoTech ? "2" : "0",
    }, { Id: id, PNo: pno, Comid: settings.Comid, univercell: false });

    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (!(res.ok ?? res.IsSuccess)) { toast("❌ " + (res.message || "Load Failed"), true); return; }

    const master = Array.isArray(res.Data1) && res.Data1.length > 0 ? res.Data1[0] : null;
    if (!master) { toast("❌ No data found", true); return; }

    const details = Array.isArray(res.Data2) && res.Data2.length > 0
      ? res.Data2
      : (master.PurchaseDetails || master.purchasedetails || master.PurchaseDetail || []);

    setEditId(master.Id || id);

    if (settings.EcoTech) { setPurchaseNo((master.PurchaseNo || "") + settings.BillPrefix); }
    else { setPurchaseNo(ns(master.PurchaseNo)); }
    setAutoPurchaseNo(ns(master.PurchaseNo));

    setPurchaseDate(String(master.PurchaseDate || "").slice(0, 10) || today());
    setPurchaseType(master.PurchaseType === "CREDIT" ? "CREDIT" : "CASH");
    setSuppId(ns(master.SupplierRefId));
    loadSupplierDetails(ns(master.SupplierRefId));
    setIgstBill(master.IGSTBill || false);
    setCreditdays(master.creditdays || 0);
    setRemarks(ns(master.Remarks));
    setOtherPlus(ns(master.OthersplusAmt ?? master.Others_A ?? "0.00"));
    setOtherMinus(ns(master.OtherssubAmt ?? master.Others_D ?? "0.00"));

    if (settings.EcoTech) {
      setPfAmt(ns(master.discamount || "0.00"));
      setPfPer(ns(master.cdamount   || "0.00"));
    }

    if (details.length === 0) {
      toast("⚠️ No detail rows found for this order.", true);
      setRows([mkRow()]);
      return;
    }

    const igst = master.IGSTBill || false;
    const loadedRows = details.map(obj => {
      const formatted = {
        ...mkRow(), ...obj,
        ProductRefId:    obj.ProductRefId || obj.ProductId || obj.ItemId || 0,
        MRP:             ns(f2(vn(obj.MRP))),
        LandingCost:     ns(f2(vn(obj.LandingCost))),
        PurchaseRate:    ns(f2(vn(obj.PurchaseRate))),
        cdpercent:       ns(f2(vn(obj.cdpercent))),
        cdAmount:        settings.EcoTech ? "0.00" : ns(f2(vn(obj.cdAmount))),
        DiscountPercent: ns(f2(vn(obj.DiscountPercent))),
        DiscountAmt:     ns(f2(vn(obj.DiscountAmt))),
        TaxPercent:      ns(f2(vn(obj.TaxPercent))),
        TaxAmt:          f2(vn(obj.TaxAmt)),
        Noms:            ns(Math.round(vn(obj.Noms || obj.NOMS || 0))),
        NomsQty:         Math.round(vn(obj.NomsQty || 0)),
        CTAmount:        f2(vn(obj.CTAmount)),
        STAmount:        f2(vn(obj.STAmount)),
        Meter:           ns(f2(vn(obj.Meter))),
        Salerate:        ns(f2(vn(obj.Salerate || obj.SaleRate || obj.SalesRate))),
        ItemQty: (() => {
          const d = obj.UOMDecimal || 0;
          if (d === 2) return f2(vn(obj.ItemQty)).toFixed(2);
          if (d === 3) return f3(vn(obj.ItemQty)).toFixed(3);
          return Math.round(vn(obj.ItemQty)).toFixed(0);
        })(),
        _isNew: false, _dirty: false,
      };
      return calcPurchaseRow(formatted, igst);
    });
    setRows(loadedRows.length > 0 ? loadedRows : [mkRow()]);
  }, [settings, perm, redirectIfDualLogin, loadSupplierDetails, toast]);

  // ── Quotation convert ─────────────────────────────────────────────────────
  const doQuotationConvert = useCallback(async (qno) => {
    if (!perm.Edit) { toast("❌ Page Edit Permission Denied !!!", true); return; }
    setLoading(true);
    const res = await CC.api(QuotationEditUrl, null, {}, { Id: 0, QuotationNo: qno, Comid: settings.Comid });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (!(res.ok ?? res.IsSuccess)) { toast("❌ " + (res.message || "Load Failed"), true); return; }
    const data   = Array.isArray(res.Data1) ? res.Data[0] : res.data;
    if (!data) { toast("❌ No data found", true); return; }
    const master  = Array.isArray(data) ? data[0] : data;
    const details = (master.SaleDetails || []).filter(c => c.cdAmount == qno);
    details.forEach(item => { item.cdAmount = 0; });
    const loadedRows = details.map(obj => {
      const fr = { ...mkRow(), ...obj, cdAmount: "0.00", _isNew: false, _dirty: false };
      return calcPurchaseRow(fr, igstBill);
    });
    setRows(loadedRows.length > 0 ? loadedRows : [mkRow()]);
  }, [settings, perm, redirectIfDualLogin, igstBill, toast]);

  // ── Clear form ────────────────────────────────────────────────────────────
  const clearForm = useCallback(async () => {
    setEditId(0);
    setSuppId(""); setSupplierDetails({ address: "", city: "", contactno: "", balance: "0.00" });
    setRemarks(""); setCreditdays(0); setIgstBill(false);
    setOtherPlus("0.00"); setOtherMinus("0.00");
    setPfPer("0.00"); setPfAmt("0.00");
    setD1(""); setD2(""); setPoReqId("");
    setPurchaseNoMode("AP"); setManualPurchaseNo(""); setAutoPurchaseNo("");
    setRows([mkRow()]);
    setSelRid(null);
    await loadPurchaseNo();
    setTimeout(() => {
      const fr = rowsRef.current[0];
      if (fr) cellRefs.current[fr._rid]?.["ProductCode"]?.focus();
    }, 100);
  }, [loadPurchaseNo]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = e => {
      if (prodPopup || f5Open || pw || f12Open || ctrlGOpen || ctrlFOpen || addrOpen) return;
      if (e.keyCode === 112) { e.preventDefault(); doSave(); }
      if (e.keyCode === 114) {
        e.preventDefault();
        pwOkRef.current = () => {
          const value = prompt("Enter the Purchase Order Number", "");
          if (value && !isNaN(value) && Number(value) !== 0) doEdit(0, Number(value));
        };
        setPw({ title: "Edit Pwd" });
      }
      if (e.keyCode === 116) { e.preventDefault(); openF5(); }
      if (e.keyCode === 120) {
        e.preventDefault();
        if (!perm.Delete) { toast("Page Delete Permission Denied !!!", true); return; }
        if (!editId) { toast("No Delete Id !!!", true); return; }
        pwOkRef.current = doDelete;
        setPw({ title: "Edit Pwd" });
      }
      if (e.keyCode === 121) { e.preventDefault(); confirm("Do You Want To Clear?").then(ok => ok && clearForm()); }
      if (e.keyCode === 123) { e.preventDefault(); setF12Open(true); }
      if (e.ctrlKey && e.keyCode === 70) { e.preventDefault(); setCtrlFOpen(true); }
      if (e.ctrlKey && e.keyCode === 71) { e.preventDefault(); setCtrlGOpen(true); }
      if (e.ctrlKey && e.keyCode === 65) { e.preventDefault(); setAddrOpen(true); }
      if (e.keyCode === 27) { e.preventDefault(); confirm("Do You Want To Quit?").then(ok => ok && navigate(-1)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prodPopup, f5Open, pw, f12Open, ctrlGOpen, ctrlFOpen, addrOpen, doSave, openF5, doDelete, clearForm, confirm, navigate, editId, perm, toast]);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const validRows = rows.filter(r => r.ProductRefId && vn(r.ItemQty) + vn(r.Noms) > 0);
  const itemCount = rows.filter(r => r.ProductRefId).length;
  const totalQty  = validRows.reduce((s, r) => s + vn(r.ItemQty), 0);

  if (!isAuthorized) return null;

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div className="sb-wrap">
      {ConfirmUI}

      {ctrlGOpen && (
        <CtrlGFocusPopup colSettings={colSettings} comid={settings.Comid} mcomid={settings.MComid}
          toast={toast} onSaved={() => loadFocusCols(settings.MComid)} onClose={() => setCtrlGOpen(false)} />
      )}

      {ctrlFOpen && (
        <CtrlFFocusPopup formColumns={FORM_COLUMNS} mcomid={settings.MComid} comid={settings.Comid}
          toast={toast} onSaved={() => {}} onClose={() => setCtrlFOpen(false)} />
      )}

      {addrOpen && (
        <DeliveryAddressPopup d1={d1} d2={d2}
          onChange={(v1, v2) => { setD1(v1); setD2(v2); }}
          onClose={() => setAddrOpen(false)} />
      )}

      <Topbar />

      <div className="sb-body">

        {/* ══════════════════════════════════════════════════════════════════
            HEADER — 3 panel layout
        ══════════════════════════════════════════════════════════════════ */}
        <div style={{ display: "flex", gap: 10, padding: "8px 10px", background: "#f5f8fd", borderBottom: "1px solid #d0ddf5", alignItems: "stretch", flexWrap: "wrap" }}>

          {/* ── LEFT PANEL: Purchase Order Details ── */}
          <div style={{ ...panelStyle, minWidth: 240, flexShrink: 0 }}>
            <div style={panelTitle}>Purchase Order Details</div>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label style={{ ...fieldLabel, minWidth: 78 }}>PurchaseNo</label>
              <input style={{ ...fieldInput, flex: 1 }}
                value={purchaseNoMode === "MP" ? manualPurchaseNo : autoPurchaseNo}
                onChange={e => purchaseNoMode === "MP" ? setManualPurchaseNo(e.target.value) : setAutoPurchaseNo(e.target.value)}
                readOnly={purchaseNoMode === "AP"} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 82 }}>
              <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <input type="radio" name="poNoMode" value="MP" checked={purchaseNoMode === "MP"}
                  onChange={() => handlePurchaseNoMode("MP")} />
                Manual
              </label>
              <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <input type="radio" name="poNoMode" value="AP" checked={purchaseNoMode === "AP"}
                  onChange={() => handlePurchaseNoMode("AP")} />
                Auto
              </label>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}> 
              <label style={{ ...fieldLabel, minWidth: 78 }}>Order Date</label>          
              <DateFieldDDMMYYYY id="pri-from-date" value={purchaseDate}  onChange={setPurchaseDate} onKeyDown={e => e.key === "Enter" && document.getElementById("po-type")?.focus()}/>    
              {/* <input type="date" style={{ ...fieldInput, flex: 1 }} value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
                onKeyDown={e => e.key === "Enter" && document.getElementById("po-type")?.focus()} /> */}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label style={{ ...fieldLabel, minWidth: 78 }}>Order Type</label>
              <select id="po-type" style={{ ...fieldInput, flex: 1 }} value={purchaseType}
                onChange={e => setPurchaseType(e.target.value)}
                onKeyDown={e => e.key === "Enter" && suppRef.current?.focus()}>
                {PURCHASE_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
              </select>
            </div>

            {editId > 0 && <div style={{ fontSize: 10, color: "#1a6e3a", fontWeight: 700 }}>✏️ EDIT MODE</div>}
          </div>

          {/* ── CENTRE PANEL: Supplier ── */}
          <div style={{ ...panelStyle, flex: 1, minWidth: 260 }}>
            <div style={panelTitle}>Supplier Details</div>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label style={{ ...fieldLabel, minWidth: 72 }}>Supplier</label>
              <ComboBox
                inputRef={suppRef}
                options={[{ value: "", label: "" }, ...suppliers.map(s => ({ value: String(s.Id), label: s.AccountName }))]}
                value={suppId}
                onChange={handleSupplierChange}
                onEnterKey={() => document.getElementById("po-poreq")?.focus()}
                placeholder="Select SupplierName"
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label style={{ ...fieldLabel, minWidth: 72 }}>PO Req</label>
              <select id="po-poreq" style={{ ...fieldInput, flex: 1 }} value={poReqId}
                onChange={e => { setPoReqId(e.target.value); if (e.target.value) doQuotationConvert(e.target.value); }}>
                <option value="">-- Select PO Req --</option>
                {poReqList.map(p => <option key={p.Id} value={p.Id}>{p.QuotationNo || p.BillNo}</option>)}
              </select>
            </div>

            <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
              <span style={{ color: "#4a5568" }}>📍 {supplierDetails.address || "—"}</span>
              <span style={{ color: "#4a5568" }}>🏙 {supplierDetails.city || "—"}</span>
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
              <span style={{ color: "#4a5568" }}>📞 {supplierDetails.contactno || "—"}</span>
              {creditdays > 0 && <span style={{ color: "#e67e22", fontWeight: 700 }}>Credit: {creditdays}d</span>}
              {igstBill    && <span style={{ color: "#8e44ad", fontWeight: 700 }}>IGST</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label style={{ ...fieldLabel, minWidth: 72 }}>Current Bal</label>
              <span style={{ fontWeight: 700, color: "#1a2e4a" }}>₹{supplierDetails.balance}</span>
            </div>
          </div>

          {/* ── RIGHT PANEL: Other Details ── */}
          <div style={{ ...panelStyle, minWidth: 200, flexShrink: 0 }}>
            <div style={panelTitle}>Other Details</div>

            {/* Stock / Rate info bar */}
            <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "3px 8px", background: "#edf2fb", borderBottom: "1px solid #d0ddf5", fontSize: 11, marginBottom: 4 }}>
              <span style={{ color: "#4a5568", fontWeight: 600 }}>
                Current Stock: <span style={{ color: "#1a2e4a", fontWeight: 700, marginLeft: 4 }}>{currentStockDisplay}</span>
              </span>
              <span style={{ color: "#4a5568", fontWeight: 600 }}>
                Rs: <span style={{ color: "#1a2e4a", fontWeight: 700, marginLeft: 4 }}>₹{currentRateDisplay}</span>
              </span>
            </div>

            {settings.EcoTech && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <label style={{ ...fieldLabel, minWidth: 60 }}>P&F %</label>
                  <input type="number" style={{ ...fieldInput, flex: 1, textAlign: "right" }} value={pfPer}
                    onChange={e => setPfPer(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handlePfPerEnter()} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <label style={{ ...fieldLabel, minWidth: 60 }}>P&F Amt</label>
                  <input type="number" style={{ ...fieldInput, flex: 1, textAlign: "right" }} value={pfAmt}
                    onChange={e => setPfAmt(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handlePfAmtEnter()} />
                </div>
              </>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label style={{ ...fieldLabel, minWidth: 60 }}>Remarks</label>
              <input style={{ ...fieldInput, flex: 1 }} value={remarks}
                onChange={e => setRemarks(e.target.value)}
                onKeyDown={e => e.key === "Enter" && document.getElementById("po-otherplus")?.focus()} />
            </div>

            {d1 && (
              <div style={{ fontSize: 10, color: "#6b7a99", borderTop: "1px solid #edf0f7", paddingTop: 4 }}>
                📦 {d1}{d2 && ` / ${d2}`}
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            GRID
        ══════════════════════════════════════════════════════════════════ */}
        <div className="sb-content" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div className="sb-grid-wrap" style={{ flex: 1 }}>
            <div className="sb-grid-scroll">
              <table className="sb-tbl">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>S.No</th>
                    {visCols.map(vc => {
                      const def = PO_COLUMNS.find(c => c.key === vc.key);
                      return (
                        <th key={vc.key} style={{ width: vc.width, minWidth: vc.width, textAlign: RIGHT_KEYS.has(vc.key) ? "right" : undefined }}>
                          {def?.label || vc.label}
                        </th>
                      );
                    })}
                    <th style={{ width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row._rid}
                      className={selRid === row._rid ? "sel" : ""}
                      style={{ background: idx % 2 === 0 ? "#fff" : "#fafbff" }}
                      onClick={() => setSelRid(row._rid)}>
                      <td className="sb-sno">{idx + 1}</td>
                      {visCols.map(vc => {
                        const def     = PO_COLUMNS.find(c => c.key === vc.key);
                        const val     = row[vc.key];
                        const isRO    = !!def?.readOnly;
                        const isRight = RIGHT_KEYS.has(vc.key);
                        const isFloat = def?.type === "float";
                        const isInt   = def?.type === "int";
                        const isAmt   = vc.key === "Amount";

                        return (
                          <td key={vc.key} style={{ textAlign: isRight ? "right" : undefined }}>
                            {isRO ? (
                              /* Read-only display cell */
                              <span className="sb-cell-calc" style={{
                                display: "block", padding: "0 4px",
                                color:      isAmt ? "#1f65de" : undefined,
                                fontWeight: isAmt ? 700        : undefined,
                              }}>
                                {(isFloat || isInt) && typeof val === "number" ? val.toFixed(2) : ns(val)}
                              </span>
                            ) : vc.key === "ProductCode" ? (
                              /* ProductCode — text input, uppercase, space=popup */
                              <input
                                ref={el => regCell(row._rid, vc.key, el)}
                                className="sb-cell-input"
                                value={ns(val)}
                                onChange={e => handleCellChange(row._rid, vc.key, e.target.value.toUpperCase())}
                                onKeyDown={e => handleCellKeyDown(e, row._rid, vc.key)}
                                onFocus={() => setSelRid(row._rid)}
                                placeholder="Code / Barcode"
                                style={{ width: "100%", boxSizing: "border-box" }}
                              />
                            ) : vc.key === "ProductName" ? (
                              /* ProductName — readonly display via input (for layout) */
                              <input
                                ref={el => regCell(row._rid, vc.key, el)}
                                className="sb-cell-input"
                                value={ns(val)}
                                readOnly
                                style={{ width: "100%", boxSizing: "border-box", background: "transparent", border: "none", cursor: "default", color: "#475569" }}
                                placeholder="—"
                              />
                            ) : (isFloat || isInt) ? (
                              /* Numeric editable cell — KEY FIX: no onBlur */
                              <input
                                ref={el => regCell(row._rid, vc.key, el)}
                                className={`sb-cell-input${isRight ? " right" : ""}`}
                                type="number"
                                step={isInt ? "1" : (vc.key === "ItemQty" && row.UOMDecimal === 0 ? "1" : "0.01")}
                                value={val === 0 && !row.ProductRefId ? "" : (val ?? "")}
                                onChange={e => handleCellChange(row._rid, vc.key, e.target.value)}
                                onKeyDown={e => handleCellKeyDown(e, row._rid, vc.key)}
                                onFocus={() => setSelRid(row._rid)}
                                placeholder={isInt ? "0" : "0.00"}
                                style={{ width: "100%", boxSizing: "border-box" }}
                              />
                            ) : (
                              /* Text editable cell — KEY FIX: no onBlur */
                              <input
                                ref={el => regCell(row._rid, vc.key, el)}
                                className="sb-cell-input"
                                value={ns(val)}
                                onChange={e => handleCellChange(row._rid, vc.key, e.target.value)}
                                onKeyDown={e => handleCellKeyDown(e, row._rid, vc.key)}
                                onFocus={() => setSelRid(row._rid)}
                                placeholder={def?.label || vc.label}
                                style={{ width: "100%", boxSizing: "border-box" }}
                              />
                            )}
                          </td>
                        );
                      })}
                      <td style={{ textAlign: "center" }}>
                        <button className="mp-del-btn" style={{ fontSize: 14 }}
                          onClick={e => { e.stopPropagation(); doDeleteRow(row._rid); }}>🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            BOTTOM SECTION — GST split + Totals
        ══════════════════════════════════════════════════════════════════ */}
        <div style={{ display: "flex", borderTop: "1px solid #d0ddf5", background: "#f8faff", minHeight: 96, flexShrink: 0 }}>

          {/* GST Split */}
          <div style={{ width: 320, borderRight: "1px solid #d0ddf5", display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 1fr", background: "#e8edf7", borderBottom: "1px solid #d0ddf5", padding: "4px 8px", fontSize: 11, fontWeight: 700, color: "#4a5568" }}>
              <span>GST %</span>
              <span style={{ textAlign: "right" }}>GST Amt</span>
              <span style={{ textAlign: "right" }}>CGST Amt</span>
              <span style={{ textAlign: "right" }}>SGST Amt</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", maxHeight: 100 }}>
              {gstSplit.length === 0
                ? <div style={{ textAlign: "center", color: "#94a3b8", padding: "12px 8px", fontSize: 11 }}>No data to display</div>
                : gstSplit.map((g, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 1fr", padding: "3px 8px", fontSize: 11, background: i % 2 === 0 ? "#fff" : "#f5f8fd", borderBottom: "1px solid #edf0f7" }}>
                    <span style={{ color: "#4a5568" }}>{f2(g.TaxPercent).toFixed(2)}%</span>
                    <span style={{ textAlign: "right" }}>{f2(g.TaxAmt).toFixed(2)}</span>
                    <span style={{ textAlign: "right" }}>{f2(g.CTAmount).toFixed(2)}</span>
                    <span style={{ textAlign: "right" }}>{f2(g.STAmount).toFixed(2)}</span>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Totals 3-col grid */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", fontSize: 12 }}>

            {/* Col 1 */}
            <div style={{ borderRight: "1px solid #d0ddf5", display: "flex", flexDirection: "column" }}>
              {[
                { label: "Gross Amt", value: totals.ProductTotal.toFixed(2), readOnly: true },
                { label: "C.D Amt",   value: totals.CdAmt.toFixed(2),        readOnly: true },
                { label: "Disc Amt",  value: totals.DiscAmt.toFixed(2),      readOnly: true },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px", borderBottom: "1px solid #edf0f7", gap: 6 }}>
                  <span style={{ color: "#4a5568", fontWeight: 600 }}>{item.label}</span>
                  <span style={{ fontWeight: 700, color: "#1a2e4a", minWidth: 80, textAlign: "right" }}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* Col 2 */}
            <div style={{ borderRight: "1px solid #d0ddf5", display: "flex", flexDirection: "column" }}>
              {[
                { label: "GST Amt",                           value: totals.GSTAmt.toFixed(2), readOnly: true },
                { label: settings.EcoTech ? "P&F Amt" : "Others(+)", value: otherPlus, onChange: setOtherPlus, type: "number", id: "po-otherplus" },
                { label: "Others(-)",                         value: otherMinus, onChange: setOtherMinus, type: "number" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px", borderBottom: "1px solid #edf0f7", gap: 6 }}>
                  <span style={{ color: "#4a5568", fontWeight: 600 }}>{item.label}</span>
                  {item.readOnly
                    ? <span style={{ fontWeight: 700, color: "#1a2e4a", minWidth: 80, textAlign: "right" }}>{item.value}</span>
                    : <input id={item.id} type={item.type || "text"} step="0.01" value={item.value}
                        onChange={e => item.onChange(e.target.value)}
                        style={{ ...fieldInput, width: 90, textAlign: "right" }} placeholder="0.00" />
                  }
                </div>
              ))}
            </div>

            {/* Col 3 */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {[
                { label: "Total Qty", value: totalQty % 1 === 0 ? totalQty.toFixed(0) : totalQty.toFixed(3), readOnly: true },
                { label: "Items",     value: String(itemCount),         readOnly: true },
                { label: "Net Total", value: totals.NetAmt.toFixed(2),  readOnly: true, bold: true },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px", borderBottom: "1px solid #edf0f7", gap: 6 }}>
                  <span style={{ color: item.bold ? "#1a2e4a" : "#4a5568", fontWeight: item.bold ? 700 : 600 }}>{item.label}</span>
                  <span style={{ fontWeight: item.bold ? 800 : 700, color: "#1a2e4a", minWidth: 80, textAlign: "right", fontSize: item.bold ? 14 : 12 }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            BOTTOM TOOLBAR
        ══════════════════════════════════════════════════════════════════ */}
        <div className="sb-toolbar" style={{ borderLeftColor: "#1a6e3a" }}>
          <button className="sb-btn sv" onClick={doSave} disabled={loading} style={{ background: "#1a6e3a", borderColor: "#1a6e3a" }}>
            💾 F1 - {purchaseType === "CREDIT" ? "CREDITOrder" : "CashOrder"}
          </button>
          <button className="sb-btn" onClick={() => {
            pwOkRef.current = () => {
              const value = prompt("Enter the Purchase Order Number", "");
              if (value && !isNaN(value) && Number(value) !== 0) doEdit(0, Number(value));
            };
            setPw({ title: "Edit Pwd" });
          }}>✏ F3 - Edit</button>
          <button className="sb-btn" onClick={() => openF5()}>📋 F5 - View</button>
          <button className="sb-btn" onClick={() => setF12Open(true)}>⚙ F12</button>
          <button className="sb-btn" onClick={() => setCtrlGOpen(true)} title="Ctrl+G Grid Focus/Reorder">⚡ Ctrl+G</button>
          <button className="sb-btn" onClick={() => setCtrlFOpen(true)} title="Ctrl+F Form Focus/Reorder">📋 Ctrl+F</button>
          <button className="sb-btn" onClick={() => setAddrOpen(true)} title="Ctrl+A Delivery Address">📦 Ctrl+A</button>
          <button className="sb-btn" onClick={() => confirm("Do You Want To Clear?").then(ok => ok && clearForm())} disabled={loading}>🔄 F10 Clear</button>
          {editId > 0 && (
            <button className="sb-btn dl"
              onClick={() => {
                if (!perm.Delete) { toast("❌ Page Delete Permission Denied !!!", true); return; }
                pwOkRef.current = doDelete;
                setPw({ title: "Edit Pwd" });
              }}
              disabled={loading}>🗑 F9 - Delete</button>
          )}
          <button className="sb-btn dl" onClick={() => navigate(-1)}>✕ ESC - Exit</button>
          {loading && <span style={{ fontSize: 11, color: "#6b7a99" }}>⏳ {ldMsg}</span>}

          {/* Right-side info */}
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "#6b7a99" }}>
            <span>Qty: <b style={{ color: "#1a2e4a" }}>{totalQty % 1 === 0 ? totalQty.toFixed(0) : totalQty.toFixed(3)}</b></span>
            <span>Items: <b style={{ color: "#1a2e4a" }}>{itemCount}</b></span>
            <span>Net: <b style={{ color: "#16a34a" }}>₹{totals.NetAmt.toFixed(2)}</b></span>
          </span>
        </div>
      </div>

      {/* LOADING OVERLAY */}
      {loading && (
        <div className="sb-loader-ov">
          <div className="sb-ldr-box">
            <div className="sb-spin" style={{ borderTopColor: "#1a6e3a" }} />
            <div className="sb-ldr-msg">{ldMsg}</div>
          </div>
        </div>
      )}

      {/* MODALS */}
      {pw && (
        <PwModal title={pw.title} comid={settings.Comid}
          onOk={() => { pwOkRef.current?.(); }}
          onClose={() => setPw(null)} />
      )}

      {f12Open && (
        <F12Popup colSettings={colSettings} comid={settings.Comid} toast={toast}
          onSave={newCols => { setColSettings(newCols); setF12Open(false); }}
          onClose={() => setF12Open(false)} />
      )}

      {prodPopup && (
        <ProductSearchPopup
          products={prodList}
          onSelect={item => { fillItemIntoRow(prodPopup.rid, item); }}
          onClose={() => setProdPopup(null)}
          anchorPos={prodPopup.pos}
        />
      )}

      {f5Open && (
        <F5ViewModal
          rows={f5Rows}
          details={f5Details}
          suppliers={suppliers}
          onEdit={id => doEdit(id)}
          onDelete={handleF5Delete}
          onClose={() => setF5Open(false)}
          fromDate={purchaseDate}
          toDate={purchaseDate}
          onSearch={openF5}
        />
      )}

      <CC.ToastList toasts={toasts} />
    </div>
  );
}