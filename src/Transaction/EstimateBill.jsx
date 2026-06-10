// ─────────────────────────────────────────────────────────────────────────────
//  EstimateBill.jsx  —  React Estimate Billing Form
//  FULL REWRITE: Added BatchPopup, ExpiryDateListPopup, SaleRate Password,
//                SalesManCode column, Ctrl+G Focus/Reorder — all from SaleBill
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import "../TransactionStyle/SaleBill.css";
import "../Master/MasterPage.css";
import * as CC from "../components/Common";
import Topbar from "../components/Topbar";

// ─── API CONSTANTS ────────────────────────────────────────────────────────────
const SaleMaxNo           = "/api/SaleApp/MaxSaleNo";
const SaleInsertUrl       = "/api/SaleApp/InsertSale";
const SaleEditUrl         = "/api/SaleApp/EditSale";
const SaleDeleteUrl       = "/api/SaleApp/DeleteSale";
const SelectItemByCodeUrl = "/api/ItemMasterApp/SelectItemMasterbyCodeId";
const ProductListUrl      = "/api/ItemMasterApp/GetProductListV7";
const GetCustomerUrl      = "/api/SupplierApp/SelectSupplierAll";
const SalesManSelectUrl   = "/api/SalesManApp/SelectSalesMan_V7";
const SelectCardMasterUrl = "/api/SaleApp/SelectSaleType";
const CRMBalanceUrl       = "/api/SalesReportApp/CRMBalanceReport";
const LoginPasswordUrl    = "/api/LoginApp/EditPassword";
const F5SelectUrl         = "/api/SaleApp/SelectSaleV7";
const VisibleColumnsUrl   = "/Login/VisibleColumns";
const FocusColumnsUrl     = "/Login/FocusColumns";
const CurrentBalanceUrl   = "/SupplierApp/CurrentBalance";
const SelectExpiryByIdUrl = "/api/ItemMasterApp/SelectExpStock";
const BASE_URL            = "http://localhost:64215";

// ─── COLUMN DEFINITIONS ───────────────────────────────────────────────────────
const SALE_COLUMNS = [
  { key: "SalesManCode",    label: "SM Code",       width: 140, hidden: true,  type: "smcode" },
  { key: "ProductCode",     label: "Product Code",  width: 130, hidden: false },
  { key: "ProductName",     label: "Description",   width: 240, hidden: false, readOnly: true },
  { key: "MRP",             label: "MRP",           width: 90,  hidden: true,  readOnly: true, type: "float" },
  { key: "SaleRate",        label: "Sale Rate",     width: 100, hidden: false, type: "float" },
  { key: "ItemQty",         label: "Qty",           width: 80,  hidden: false, type: "float" },
  { key: "DiscountPercent", label: "Disc%",         width: 75,  hidden: false, type: "float" },
  { key: "CDPercent",       label: "CD%",           width: 75,  hidden: true,  type: "float" },
  { key: "TaxPercent",      label: "GST%",          width: 75,  hidden: false, type: "float" },
  { key: "CESSPer",         label: "CESS%",         width: 75,  hidden: true,  type: "float" },
  { key: "TaxAmt",          label: "GST Amt",       width: 90,  hidden: true,  type: "float" },
  { key: "CESSAmount",      label: "CESS Amt",      width: 90,  hidden: true,  type: "float" },
  { key: "SPLCESS",         label: "SPL CESS",      width: 80,  hidden: true,  type: "float" },
  { key: "SPLCESSAmount",   label: "SPL CESS Amt",  width: 100, hidden: true,  type: "float" },
  { key: "DiscountAmt",     label: "Disc Amt",      width: 90,  hidden: true,  type: "float" },
  { key: "CDAmount",        label: "CD Amt",        width: 90,  hidden: true,  type: "float" },
  { key: "LandingCost",     label: "Landing Cost",  width: 100, hidden: true,  type: "float" },
  { key: "UOM",             label: "UOM",           width: 70,  hidden: true,  readOnly: true },
  { key: "HSNCode",         label: "HSN Code",      width: 100, hidden: true,  readOnly: true },
  { key: "Bat_No",          label: "Batch No",      width: 100, hidden: true },
  { key: "FreeQty",         label: "Free Qty",      width: 80,  hidden: true,  type: "int" },
  { key: "Remarks",         label: "Remarks",       width: 130, hidden: true },
  { key: "Amount",          label: "Amount",        width: 100, hidden: false, readOnly: true, type: "float" },
];

const DEFAULT_COL_SETTINGS = SALE_COLUMNS.map(c => ({
  key: c.key, label: c.label, width: c.width, visible: !c.hidden,
}));

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const vn    = v => parseFloat(v) || 0;
const ro    = v => Math.round(v * 100) / 100;
const f2    = v => parseFloat(vn(v).toFixed(2));
const ns    = v => (v == null ? "" : String(v));
const today = () => new Date().toISOString().slice(0, 10);

let _rid = 3000;
const genRid = () => ++_rid;

// ─── COMBOBOX ─────────────────────────────────────────────────────────────────
function ComboBox({ options, value, onChange, onEnterKey, placeholder, style, inputRef: extRef }) {
  const [q, setQ]           = useState("");
  const [open, setOpen]     = useState(false);
  const [hilite, setHilite] = useState(0);
  const wrapRef = useRef(null);
  const inpRef  = useRef(null);
  const listRef = useRef(null);
  const ref = extRef || inpRef;

  const selectedLabel = options.find(o => String(o.value) === String(value))?.label || "";

  const handleFocus = () => { setQ(selectedLabel); setOpen(true); setHilite(0); };

  const filtered = options.filter(o =>
    o.label.toUpperCase().includes(q.toUpperCase())
  ).slice(0, 150);

  useEffect(() => { setHilite(0); }, [q]);
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${hilite}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [hilite]);
  useEffect(() => {
    const handler = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false); setQ(selectedLabel);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selectedLabel]);

  const selectOption = opt => { onChange(String(opt.value)); setQ(opt.label.toUpperCase()); setOpen(false); };
  const handleKeyDown = e => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHilite(h => Math.min(h + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setHilite(h => Math.max(h - 1, 0)); }
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && filtered[hilite]) selectOption(filtered[hilite]);
      onEnterKey?.();
    }
    if (e.key === "Escape") { setOpen(false); setQ(selectedLabel); }
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", flex: 1, minWidth: 0, ...style }}>
      <input ref={ref} className="sb-select"
        value={open ? q : selectedLabel.toUpperCase()}
        placeholder={placeholder} autoComplete="off"
        onFocus={handleFocus}
        onChange={e => { setQ(e.target.value.toUpperCase()); setOpen(true); }}
        onKeyDown={handleKeyDown}
        style={{ width: "100%", cursor: "text" }}
      />
      {open && filtered.length > 0 && (
        <div ref={listRef} style={{
          position: "absolute", top: "100%", left: 0, right: 0,
          background: "#fff", border: "1px solid #c5d8f8", borderRadius: 4,
          zIndex: 9999, maxHeight: 220, overflowY: "auto",
          boxShadow: "0 8px 24px rgba(31,101,222,.15)",
        }}>
          {filtered.map((opt, idx) => (
            <div key={opt.value} data-idx={idx}
              onMouseDown={() => selectOption(opt)}
              onMouseEnter={() => setHilite(idx)}
              style={{
                padding: "5px 10px", fontSize: 12, cursor: "pointer",
                background: idx === hilite ? "#deeafb" : idx % 2 === 0 ? "#fff" : "#fafbff",
                borderLeft: idx === hilite ? "3px solid #1f65de" : "3px solid transparent",
                color: "#1a2e4a", fontWeight: idx === hilite ? 600 : 400,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}
            >{opt.label}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── GRID SALESMAN COMBOBOX ───────────────────────────────────────────────────
const SmCodeCell = forwardRef(function SmCodeCell(
  { salesmen, value, onChange, onKeyDown, onFocus }, ref
) {
  const [q, setQ]           = useState("");
  const [open, setOpen]     = useState(false);
  const [hilite, setHilite] = useState(0);
  const wrapRef  = useRef(null);
  const inputRef = useRef(null);
  const listRef  = useRef(null);

  useImperativeHandle(ref, () => inputRef.current);

  const selected     = salesmen.find(s => String(s.Id) === String(value));
  const displayLabel = selected
    ? `${selected.SalesManCode || selected.Id} - ${selected.SalesManName}`
    : "";

  const filtered = salesmen.filter(s => {
    const ql = q.toLowerCase();
    return (
      String(s.SalesManCode || s.Id).toLowerCase().includes(ql) ||
      String(s.SalesManName || "").toLowerCase().includes(ql)
    );
  }).slice(0, 80);

  useEffect(() => { setHilite(0); }, [q]);
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${hilite}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [hilite]);
  useEffect(() => {
    const handler = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false); setQ("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectItem = s => {
    onChange(String(s.Id));
    setQ(""); setOpen(false);
    setTimeout(() => {
      onKeyDown?.({ key: "Enter", preventDefault: () => {} });
    }, 20);
  };

  const handleKeyDown = e => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHilite(h => Math.min(h + 1, filtered.length - 1)); return; }
    if (e.key === "ArrowUp")   { e.preventDefault(); setHilite(h => Math.max(h - 1, 0)); return; }
    if (e.key === "Escape")    { setOpen(false); setQ(""); return; }
    if (e.key === "Enter") {
      if (open && filtered[hilite]) { e.preventDefault(); selectItem(filtered[hilite]); return; }
      setOpen(false); setQ("");
      onKeyDown?.(e); return;
    }
    if (e.key === "Tab") { setOpen(false); setQ(""); return; }
    if (!open) onKeyDown?.(e);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <input
        ref={inputRef}
        className="sb-cell-input"
        value={open ? q : displayLabel}
        placeholder="SM Code..."
        autoComplete="off"
        onFocus={() => { onFocus?.(); setQ(""); setOpen(true); setHilite(0); }}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={handleKeyDown}
        style={{ width: "100%", boxSizing: "border-box", fontSize: 11 }}
      />
      {open && filtered.length > 0 && (
        <div ref={listRef} style={{
          position: "fixed", width: 260,
          background: "#fff", border: "1px solid #c5d8f8", borderRadius: 6,
          zIndex: 99999, maxHeight: 200, overflowY: "auto",
          boxShadow: "0 8px 24px rgba(31,101,222,.2)",
        }}>
          {filtered.map((s, idx) => (
            <div key={s.Id} data-idx={idx}
              onMouseDown={() => selectItem(s)}
              onMouseEnter={() => setHilite(idx)}
              style={{
                padding: "5px 10px", fontSize: 11, cursor: "pointer",
                background: idx === hilite ? "#deeafb" : idx % 2 === 0 ? "#fff" : "#fafbff",
                borderLeft: idx === hilite ? "3px solid #1f65de" : "3px solid transparent",
                color: "#1a2e4a", fontWeight: idx === hilite ? 600 : 400,
                display: "flex", gap: 8, alignItems: "center",
              }}
            >
              <span style={{ minWidth: 38, fontSize: 10, fontWeight: 700, color: "#1f65de", background: "#e8f0fe", borderRadius: 3, padding: "1px 5px", textAlign: "center", flexShrink: 0 }}>
                {s.SalesManCode || s.Id}
              </span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.SalesManName}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// ─── ROW CALCULATION ─────────────────────────────────────────────────────────
function calcSaleRow(row) {
  const qty = vn(row.ItemQty), saleRate = vn(row.SaleRate);
  const gst = vn(row.TaxPercent), cess = vn(row.CESSPer);
  const splcess = vn(row.SPLCESS), discPer = vn(row.DiscountPercent), cdPer = vn(row.CDPercent);
  if (qty === 0 || saleRate === 0) {
    return { ...row, DiscountAmt: 0, CDAmount: 0, TaxAmt: 0, CESSAmount: 0, SPLCESSAmount: 0, Amount: 0, LandingCost: 0, CTAmount: 0, STAmount: 0 };
  }
  const taxTotal   = gst + cess;
  const withoutTax = taxTotal > 0 ? saleRate / ((taxTotal / 100) + 1) : saleRate;
  const orgRate    = withoutTax * qty;
  const cdAmt      = ro(orgRate * (cdPer / 100));
  const afterCD    = orgRate - cdAmt;
  const discAmt    = ro(afterCD * (discPer / 100));
  const landingCost = afterCD - discAmt;
  const ctAmt      = ro(landingCost * ((gst / 2) / 100));
  const stAmt      = ro(landingCost * ((gst / 2) / 100));
  const cessAmt    = ro(landingCost * (cess / 100));
  const gstAmt     = ctAmt + stAmt;
  const splcessAmt = splcess * qty;
  const amount     = f2(landingCost + gstAmt + cessAmt + splcessAmt);
  return {
    ...row,
    WithoutTaxRate: f2(withoutTax), OrgRate: f2(orgRate / qty),
    CDAmount: f2(cdAmt), DiscountAmt: f2(discAmt),
    LandingCost: f2(landingCost / qty), TaxAmt: f2(gstAmt),
    CTAmount: f2(ctAmt), STAmount: f2(stAmt),
    CESSAmount: f2(cessAmt), SPLCESSAmount: f2(splcessAmt), Amount: amount,
  };
}

const mkRow = () => ({
  _rid: genRid(), _isNew: true, _dirty: false,
  SDId: 0, ProductRefId: 0, ProductCode: "", ProductName: "",
  MRP: 0, SaleRate: 0, ItemQty: "", UOMDecimal: 0,
  TaxPercent: 0, TaxAmt: 0, CESSPer: 0, CESSAmount: 0,
  SPLCESS: 0, SPLCESSAmount: 0, DiscountPercent: 0, DiscountAmt: 0,
  CDPercent: 0, CDAmount: 0, LandingCost: 0, OrgRate: 0,
  CTAmount: 0, STAmount: 0, Amount: 0, UOM: "", HSNCode: "",
  PurchaseRate: 0, StockQty: 0, BatchRefid: null, NegativetStock: false,
  SalesRateType: true, WithoutTaxRate: 0, FreeQty: 0, Remarks: "",
  PrinterName: "", NStock: 0, SRDetailsId: 0, Bat_No: "",
  CRMPoints: 0, SalesManCode: 0, SalesManComm: 0,
});

const fmtRow = obj => ({
  ...obj, _rid: obj._rid || genRid(), _isNew: false, _dirty: false,
  MRP: f2(vn(obj.MRP)), SaleRate: f2(vn(obj.SaleRate)), ItemQty: ns(obj.ItemQty),
  TaxPercent: f2(vn(obj.TaxPercent)), TaxAmt: f2(vn(obj.TaxAmt)),
  _origSaleRate: f2(vn(obj.SaleRate)),
  CESSPer: f2(vn(obj.CESSPer)), CESSAmount: f2(vn(obj.CESSAmount)),
  DiscountPercent: f2(vn(obj.DiscountPercent)), DiscountAmt: f2(vn(obj.DiscountAmt)),
  Amount: f2(vn(obj.Amount)), LandingCost: f2(vn(obj.Landingcost || obj.LandingCost)),
  SalesManCode: vn(obj.SalesManCode || obj.SalesmanRefid || 0),
});

// ─── CUSTOMER SEARCH POPUP ────────────────────────────────────────────────────
function CustomerSearchPopup({ customers, onSelect, onClose }) {
  const [q, setQ] = useState("");
  const [hilite, setHilite] = useState(0);
  const inputRef = useRef(null);
  const listRef  = useRef(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 30); }, []);
  const filtered = customers.filter(c => {
    const name = String(c.AccountName || "").toLowerCase();
    const mob  = String(c.MobileNo || "").toLowerCase();
    const ql   = q.toLowerCase();
    return name.includes(ql) || mob.includes(ql);
  }).slice(0, 150);
  useEffect(() => { setHilite(0); }, [q]);
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${hilite}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [hilite]);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,20,40,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 8600 }}>
      <div style={{ background: "#fff", borderRadius: 10, width: 580, maxHeight: 480, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 16px 48px rgba(31,101,222,.22)", border: "1px solid #d0ddf5" }}>
        <div style={{ background: "linear-gradient(135deg,#1b3a8f 0%,#1f65de 100%)", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", flex: 1 }}>👤 Customer Search</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,.65)", background: "rgba(255,255,255,.15)", borderRadius: 10, padding: "2px 8px" }}>{filtered.length} records</span>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", width: 22, height: 22, borderRadius: "50%", cursor: "pointer", fontSize: 11 }}>✕</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #eaecf4", background: "#f8faff", gap: 8 }}>
          <span style={{ fontSize: 16, color: "#7895c8" }}>⌕</span>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search by Name or Mobile No..."
            style={{ flex: 1, border: "none", background: "transparent", fontSize: 13, color: "#1a2e4a", outline: "none" }}
            onKeyDown={e => {
              if (e.key === "ArrowDown")  { e.preventDefault(); setHilite(h => Math.min(h + 1, filtered.length - 1)); }
              if (e.key === "ArrowUp")    { e.preventDefault(); setHilite(h => Math.max(h - 1, 0)); }
              if (e.key === "Enter")      { e.preventDefault(); if (filtered[hilite]) onSelect(filtered[hilite]); }
              if (e.key === "Escape")     { e.preventDefault(); onClose(); }
            }} />
        </div>
        <div style={{ display: "flex", gap: 8, padding: "4px 10px", background: "#f0f4fc", borderBottom: "1px solid #dde6f5", fontSize: 9.5, fontWeight: 700, color: "#6b7a99", textTransform: "uppercase" }}>
          <span style={{ width: 180 }}>Customer Name</span>
          <span style={{ width: 120 }}>Mobile No</span>
          <span style={{ flex: 1 }}>Address</span>
          <span style={{ width: 80 }}>GSTIN</span>
        </div>
        <div ref={listRef} style={{ overflowY: "auto", flex: 1 }}>
          {filtered.length === 0
            ? <div style={{ textAlign: "center", color: "#94a3b8", padding: 20, fontSize: 12 }}>No customers found</div>
            : filtered.map((c, idx) => (
              <div key={c.Id} data-idx={idx} onClick={() => onSelect(c)} onMouseEnter={() => setHilite(idx)}
                style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 10px", cursor: "pointer", borderBottom: "1px solid #f3f5fb", background: idx === hilite ? "#deeafb" : idx % 2 === 0 ? "#fff" : "#fafbff", borderLeft: idx === hilite ? "3px solid #1f65de" : "3px solid transparent", fontSize: 11.5 }}>
                <span style={{ width: 180, color: "#1f65de", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.AccountName}</span>
                <span style={{ width: 120, color: "#16a34a", fontWeight: 600 }}>{c.MobileNo || "—"}</span>
                <span style={{ flex: 1, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[c.Address1, c.City].filter(Boolean).join(", ") || "—"}</span>
                <span style={{ width: 80, color: "#8b99b5", fontSize: 10 }}>{c.GSTINNo || "—"}</span>
              </div>
            ))
          }
        </div>
        <div style={{ display: "flex", gap: 12, padding: "5px 12px", background: "#f8faff", borderTop: "1px solid #eaecf4" }}>
          {["↑↓ Navigate", "Enter Select", "Esc Close"].map(h => (
            <span key={h} style={{ fontSize: 9.5, color: "#8b99b5", display: "flex", alignItems: "center", gap: 3 }}>
              <kbd style={{ background: "#1f65de", color: "#fff", fontSize: 8.5, fontWeight: 700, padding: "1px 4px", borderRadius: 2 }}>{h.split(" ")[0]}</kbd>
              {h.split(" ").slice(1).join(" ")}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── BATCH POPUP ──────────────────────────────────────────────────────────────
function BatchPopup({ batches, onSelect, onClose }) {
  const [hilite, setHilite] = useState(0);
  const listRef = useRef(null);
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${hilite}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [hilite]);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,20,40,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 8800 }}>
      <div style={{ background: "#fff", borderRadius: 10, width: 560, maxHeight: 420, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 16px 48px rgba(31,101,222,.22)", border: "1px solid #d0ddf5" }}>
        <div style={{ background: "linear-gradient(135deg,#1b3a8f 0%,#1f65de 100%)", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", flex: 1 }}>📦 Select Batch</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,.65)", background: "rgba(255,255,255,.15)", borderRadius: 10, padding: "2px 8px" }}>{batches.length} batches</span>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", width: 22, height: 22, borderRadius: "50%", cursor: "pointer", fontSize: 11 }}>✕</button>
        </div>
        <div style={{ display: "flex", gap: 8, padding: "4px 10px", background: "#f0f4fc", borderBottom: "1px solid #dde6f5", fontSize: 9.5, fontWeight: 700, color: "#6b7a99", textTransform: "uppercase" }}>
          <span style={{ width: 120 }}>Batch No</span>
          <span style={{ width: 90, textAlign: "right" }}>MRP</span>
          <span style={{ width: 90, textAlign: "right" }}>Sale Rate</span>
          <span style={{ width: 90, textAlign: "right" }}>Stock</span>
          <span style={{ width: 100 }}>Exp Date</span>
          <span style={{ width: 80 }}>Mfg Date</span>
        </div>
        <div ref={listRef} style={{ overflowY: "auto", flex: 1 }}>
          {batches.map((b, idx) => (
            <div key={b.Batchid || idx} data-idx={idx}
              onClick={() => onSelect(b)}
              onMouseEnter={() => setHilite(idx)}
              onKeyDown={e => {
                if (e.key === "ArrowDown") setHilite(h => Math.min(h + 1, batches.length - 1));
                if (e.key === "ArrowUp")   setHilite(h => Math.max(h - 1, 0));
                if (e.key === "Enter")     onSelect(batches[hilite]);
                if (e.key === "Escape")    onClose();
              }}
              style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 10px", cursor: "pointer", borderBottom: "1px solid #f3f5fb", background: idx === hilite ? "#deeafb" : idx % 2 === 0 ? "#fff" : "#fafbff", borderLeft: idx === hilite ? "3px solid #1f65de" : "3px solid transparent", fontSize: 11.5 }}
            >
              <span style={{ width: 120, color: "#1f65de", fontWeight: 700 }}>{b.BatchNo || b.Bat_No || "—"}</span>
              <span style={{ width: 90, textAlign: "right", color: "#475569" }}>₹{f2(vn(b.MRP)).toFixed(2)}</span>
              <span style={{ width: 90, textAlign: "right", color: "#16a34a", fontWeight: 600 }}>₹{f2(vn(b.SalesRate || b.SaleRate)).toFixed(2)}</span>
              <span style={{ width: 90, textAlign: "right", color: vn(b.Stock) <= 0 ? "#dc2626" : "#1a2e4a" }}>{vn(b.Stock).toFixed(0)}</span>
              <span style={{ width: 100, color: "#8b5cf6", fontSize: 10.5 }}>{b.ExpDate ? String(b.ExpDate).slice(0, 10) : "—"}</span>
              <span style={{ width: 80, color: "#94a3b8", fontSize: 10.5 }}>{b.MFDate ? String(b.MFDate).slice(0, 10) : "—"}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, padding: "5px 12px", background: "#f8faff", borderTop: "1px solid #eaecf4" }}>
          {["↑↓ Navigate", "Enter Select", "Esc Close"].map(h => (
            <span key={h} style={{ fontSize: 9.5, color: "#8b99b5", display: "flex", alignItems: "center", gap: 3 }}>
              <kbd style={{ background: "#1f65de", color: "#fff", fontSize: 8.5, fontWeight: 700, padding: "1px 4px", borderRadius: 2 }}>{h.split(" ")[0]}</kbd>
              {h.split(" ").slice(1).join(" ")}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── EXPIRY DATE LIST POPUP ───────────────────────────────────────────────────
function ExpiryDateListPopup({ expiryList, onSelect, onClose }) {
  const [hilite, setHilite] = useState(0);
  const listRef = useRef(null);
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${hilite}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [hilite]);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,20,40,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 8900 }}>
      <div style={{ background: "#fff", borderRadius: 8, width: 380, maxHeight: 400, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 8px 32px rgba(31,101,222,.22)", border: "1px solid #d0ddf5" }}>
        <div style={{ background: "#1a2e4a", color: "#fff", padding: "8px 14px", display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>📅 Expiry Date Product List</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 14 }}>✕</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px", padding: "4px 10px", background: "#f0f4fc", borderBottom: "1px solid #dde6f5", fontSize: 11, fontWeight: 700, color: "#6b7a99", textTransform: "uppercase" }}>
          <span>Expdate</span><span>MFdate</span><span style={{ textAlign: "right" }}>Stock</span>
        </div>
        <div ref={listRef} style={{ overflowY: "auto", flex: 1 }}>
          {expiryList.length === 0
            ? <div style={{ textAlign: "center", color: "#94a3b8", padding: 20, fontSize: 12 }}>No records found</div>
            : expiryList.map((item, idx) => (
              <div key={idx} data-idx={idx}
                onClick={() => onSelect(item)}
                onMouseEnter={() => setHilite(idx)}
                onKeyDown={e => {
                  if (e.key === "ArrowDown") setHilite(h => Math.min(h + 1, expiryList.length - 1));
                  if (e.key === "ArrowUp")   setHilite(h => Math.max(h - 1, 0));
                  if (e.key === "Enter")     onSelect(expiryList[hilite]);
                  if (e.key === "Escape")    onClose();
                }}
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px", padding: "6px 10px", cursor: "pointer", borderBottom: "1px solid #f3f5fb", background: idx === hilite ? "#deeafb" : idx % 2 === 0 ? "#fff" : "#fafbff", borderLeft: idx === hilite ? "3px solid #1f65de" : "3px solid transparent", fontSize: 12 }}
              >
                <span style={{ color: "#475569" }}>{item.Expdate ? String(item.Expdate).slice(0, 10).split("-").reverse().join("/") : "—"}</span>
                <span style={{ color: "#475569" }}>{item.MFdate ? String(item.MFdate).slice(0, 10).split("-").reverse().join("/") : ""}</span>
                <span style={{ textAlign: "right", fontWeight: 700, color: vn(item.Stock) <= 0 ? "#dc2626" : "#1a2e4a", background: idx === hilite ? "transparent" : vn(item.Stock) <= 15 ? "#fed7aa" : "transparent", borderRadius: 3, padding: "0 4px" }}>
                  {vn(item.Stock).toFixed(0)}
                </span>
              </div>
            ))
          }
        </div>
        <div style={{ display: "flex", gap: 12, padding: "5px 12px", background: "#f8faff", borderTop: "1px solid #eaecf4" }}>
          {["↑↓ Navigate", "Enter Select", "Esc Close"].map(h => (
            <span key={h} style={{ fontSize: 9.5, color: "#8b99b5", display: "flex", alignItems: "center", gap: 3 }}>
              <kbd style={{ background: "#1f65de", color: "#fff", fontSize: 8.5, fontWeight: 700, padding: "1px 4px", borderRadius: 2 }}>{h.split(" ")[0]}</kbd>
              {h.split(" ").slice(1).join(" ")}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── PRODUCT SEARCH POPUP ────────────────────────────────────────────────────
function ProductSearchPopup({ products, onSelect, onClose, anchorPos }) {
  const [q, setQ] = useState("");
  const [hilite, setHilite] = useState(0);
  const inputRef = useRef(null);
  const listRef  = useRef(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 30); }, []);
  const filtered = products.filter(p =>
    String(p.PName || "").toLowerCase().includes(q.toLowerCase()) ||
    String(p.Prod_code || "").toLowerCase().includes(q.toLowerCase())
  ).slice(0, 120);
  useEffect(() => { setHilite(0); }, [q]);
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${hilite}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [hilite]);
  return (
    <div className="sb-prod-search" style={{ top: anchorPos?.top || 160, left: (anchorPos?.left + 250) || 20 }}>
      <div className="sb-prod-search-hdr">
        <span className="sb-ps-title">Product Search</span>
        <span className="sb-ps-count">{filtered.length} items</span>
        <button className="sb-ps-close" onClick={onClose}>✕</button>
      </div>
      <div className="sb-ps-input-wrap">
        <span className="sb-ps-icon">⌕</span>
        <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Type code or name…" className="sb-ps-input"
          onKeyDown={e => {
            if (e.key === "ArrowDown")  { e.preventDefault(); setHilite(h => Math.min(h + 1, filtered.length - 1)); }
            if (e.key === "ArrowUp")    { e.preventDefault(); setHilite(h => Math.max(h - 1, 0)); }
            if (e.key === "Enter")      { e.preventDefault(); if (filtered[hilite]) onSelect(filtered[hilite]); }
            if (e.key === "Escape")     { e.preventDefault(); onClose(); }
          }} />
      </div>
      <div className="sb-ps-cols">
        <span style={{ width: 90 }}>Code</span>
        <span style={{ flex: 1 }}>Product Name</span>
        <span style={{ width: 72, textAlign: "right" }}>Rate</span>
        <span style={{ width: 60, textAlign: "right" }}>Stock</span>
      </div>
      <div ref={listRef} className="sb-prod-list">
        {filtered.length === 0
          ? <div className="sb-ps-empty">No products found</div>
          : filtered.map((p, idx) => (
            <div key={p.Id} data-idx={idx}
              className={`sb-prod-item${idx === hilite ? " hi" : ""}`}
              onClick={() => onSelect(p)} onMouseEnter={() => setHilite(idx)}>
              <span className="sb-prod-code">{p.Prod_Code || p.ProductCode}</span>
              <span className="sb-prod-name">{p.PName || p.ProductName}</span>
              <span className="sb-prod-rate">₹{f2(vn(p.SaleRate || p.SalesRate)).toFixed(2)}</span>
              <span className="sb-prod-stock">{vn(p.Stock).toFixed(0)}</span>
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
function F5ViewModal({ rows, onEdit, onClose, fromDate, toDate, onSearch, isEstimate }) {
  const [sel, setSel] = useState(null);
  const [from, setFrom] = useState(fromDate);
  const [to, setTo] = useState(toDate);
  return (
    <div className="mp-ov" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mp-modal-box sb-f5-modal">
        <div className="mp-modal-hdr">
          <span>{isEstimate ? "📋 Estimate Bill View" : "📋 Sale Bill View"}</span>
          <button onClick={onClose}>✕</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", background: "#f5f9ff", borderBottom: "1px solid #dde6f5", flexShrink: 0 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#4a5568" }}>From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ height: 26, border: "1px solid #c5d8f8", borderRadius: 4, padding: "0 6px", fontSize: 12, outline: "none" }} />
          <label style={{ fontSize: 11, fontWeight: 700, color: "#4a5568" }}>To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ height: 26, border: "1px solid #c5d8f8", borderRadius: 4, padding: "0 6px", fontSize: 12, outline: "none" }} />
          <button className="mp-btn sv" style={{ height: 26, padding: "0 14px", fontSize: 11 }} onClick={() => onSearch(from, to)}>🔍 Search</button>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>({rows.length} records)</span>
        </div>
        <div className="mp-modal-body" style={{ height: 420, overflowY: "auto", padding: 0 }}>
          <table className="sb-f5-tbl">
            <thead><tr><th>Bill No</th><th>Bill Date</th><th>Customer</th><th style={{ textAlign: "right" }}>Amount</th><th>Type</th></tr></thead>
            <tbody>
              {rows.length === 0
                ? <tr><td colSpan={5} style={{ textAlign: "center", color: "#94a3b8", padding: 18 }}>No records found</td></tr>
                : rows.map(r => (
                  <tr key={r.Id} className={sel?.Id === r.Id ? "sel" : ""} onClick={() => setSel(r)} onDoubleClick={() => onEdit(r.Id)}>
                    <td>{r.EstimateDisplay || r.EstimateNo || r.BillNoDisplay || r.BillNo}</td>
                    <td>{String(r.EstimateDate || r.Date || "").slice(0, 10)}</td>
                    <td>{r.CusName}</td>
                    <td style={{ textAlign: "right" }}>₹{f2(vn(r.NetAmt))}</td>
                    <td>{r.EstimateType || r.Type}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
        <div className="mp-modal-ftr">
          <button className="mp-btn" onClick={onClose}>Close</button>
          {sel && <button className="mp-btn sv" onClick={() => onEdit(sel.Id)}>✏️ Edit</button>}
        </div>
      </div>
    </div>
  );
}

// ─── PASSWORD MODAL ───────────────────────────────────────────────────────────
function PwModal({ title, comid, onOk, onClose }) {
  const [val, setVal] = useState("");
  const verify = async () => {
    if (!val) return;
    const res = await CC.api(LoginPasswordUrl, null, {}, { password: val, type: "EditPassword", Comid: comid });
    if (res.ok ?? res.IsSuccess ?? false) { onOk(); onClose(); }
    else window.alert("Invalid Password !!!");
  };
  return (
    <div className="mp-ov">
      <div className="mp-modal-box" style={{ width: 280, padding: "20px 24px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "#1f65de" }}>🔐 {title}</div>
        <input type="password" autoFocus value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") verify(); if (e.key === "Escape") onClose(); }}
          style={{ width: "100%", padding: "6px 10px", border: "1px solid #c5d8f8", borderRadius: 4, fontSize: 13, marginBottom: 14, outline: "none" }}
          placeholder="Enter password…" />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="mp-btn" onClick={onClose}>Cancel</button>
          <button className="mp-btn sv" onClick={verify}>OK</button>
        </div>
      </div>
    </div>
  );
}

// ─── F12 COLUMN SETTINGS POPUP ───────────────────────────────────────────────
function F12Popup({ colSettings, comid, onSave, onClose, toast }) {
  const [local, setLocal] = useState(colSettings.map(s => ({ ...s })));
  const toggle = key => setLocal(prev => prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
  const setWid = (key, w) => setLocal(prev => prev.map(c => c.key === key ? { ...c, width: parseInt(w) || c.width } : c));
  const handleSave = async () => {
    const payload = local.map(c => ({ Comid: parseInt(comid) || 1, filename: "Estimate", column: c.key, Visible: c.visible === true, Width: parseInt(c.width) || 100 }));
    try {
      const res = await fetch(VisibleColumnsUrl, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8", ...CC.authHeaders() }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.ok) { toast?.("✅ Column settings saved"); onSave(local); }
      else { toast?.("⚠️ " + (data.message || "Saved locally")); onSave(local); }
    } catch { onSave(local); }
  };
  return (
    <div className="mp-ov">
      <div className="mp-modal-box" style={{ width: 500, maxHeight: "82vh" }}>
        <div className="mp-modal-hdr"><span>⚙ Estimate Grid Columns (F12)</span><button onClick={onClose}>✕</button></div>
        <div className="mp-modal-body" style={{ overflowY: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
            <thead><tr>{["Column", "Visible", "Width (px)"].map(h => <th key={h} style={{ background: "#1a2e4a", color: "#fff", padding: "6px 10px", textAlign: "left", fontWeight: 600, position: "sticky", top: 0, zIndex: 2 }}>{h}</th>)}</tr></thead>
            <tbody>
              {local.map((c, i) => (
                <tr key={c.key} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                  <td style={{ padding: "5px 10px", borderBottom: "1px solid #eaecf4", fontSize: 12 }}>{c.label}</td>
                  <td style={{ padding: "5px 10px", textAlign: "center", borderBottom: "1px solid #eaecf4" }}><input type="checkbox" checked={!!c.visible} onChange={() => toggle(c.key)} /></td>
                  <td style={{ padding: "5px 10px", borderBottom: "1px solid #eaecf4" }}><input type="number" min={40} max={600} value={c.width} style={{ width: 70, border: "1px solid #d4dbe8", borderRadius: 3, padding: "2px 6px", fontSize: 12, textAlign: "right" }} onChange={e => setWid(c.key, e.target.value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mp-modal-ftr"><button className="mp-btn sv" onClick={handleSave}>💾 Save</button><button className="mp-btn" onClick={onClose}>Cancel</button></div>
      </div>
    </div>
  );
}

// ─── CTRL+G COLUMN FOCUS/REORDER POPUP ───────────────────────────────────────
function CtrlGFocusPopup({ colSettings, comid, mcomid, onSaved, onClose, toast }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const url = `/Content/Appdata/Visible/${mcomid}/EstimateFocus.json?v=${Date.now()}`;
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

  const toggleFocus = key => setItems(prev => prev.map(it => it.key === key ? { ...it, focus: !it.focus } : it));
  const onDragStart = (e, idx) => { setDragIdx(idx); e.dataTransfer.effectAllowed = "move"; };
  const onDragOver  = (e, idx) => { e.preventDefault(); setOverIdx(idx); };
  const onDrop      = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setOverIdx(null); return; }
    setItems(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      return next.map((it, i) => ({ ...it, index: i }));
    });
    setDragIdx(null); setOverIdx(null);
  };

  const handleSave = async () => {
    const payload = items.map((it, i) => ({
      filename: "EstimateFocus", column: it.key, Index: i, Focus: it.focus, Comid: parseInt(comid) || 1,
    }));
    try {
      const res = await fetch(FocusColumnsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", ...CC.authHeaders() },
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
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", flex: 1 }}>⚡ Ctrl+G — Column Focus & Reorder</span>
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
                onDragStart={e => onDragStart(e, idx)}
                onDragOver={e => onDragOver(e, idx)}
                onDrop={e => onDrop(e, idx)}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 14px", cursor: "grab", background: overIdx === idx ? "#deeafb" : dragIdx === idx ? "#e8f0fe" : idx % 2 === 0 ? "#fff" : "#fafbff", borderBottom: "1px solid #f0f4fc", borderLeft: overIdx === idx ? "3px solid #1f65de" : "3px solid transparent", userSelect: "none" }}
              >
                <span style={{ color: "#94a3b8", fontSize: 14 }}>⠿</span>
                <span style={{ width: 22, height: 22, borderRadius: 4, background: "#f0f4fc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#6b7a99", fontWeight: 700, flexShrink: 0 }}>{idx + 1}</span>
                <span style={{ flex: 1, fontSize: 12, color: "#1a2e4a", fontWeight: 500 }}>{it.label}</span>
                <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                  <input type="checkbox" checked={!!it.focus} onChange={() => toggleFocus(it.key)} style={{ width: 14, height: 14, accentColor: "#1f65de" }} />
                  <span style={{ fontSize: 10.5, color: it.focus ? "#1f65de" : "#94a3b8", fontWeight: 600 }}>{it.focus ? "Focus ON" : "Focus OFF"}</span>
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

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function EstimateBill() {
  const navigate = useNavigate();
  const { confirm, ConfirmUI } = CC.useConfirm();
  const { toast, toasts }      = CC.useToast();

  const isEstimate = true; // This page is always Estimate mode; F8 navigates to SaleBill

  // ── Refs ──────────────────────────────────────────────────────────────────
  const unlockedRidRef       = useRef(null);
  const pendingRateChangeRef = useRef(null);
  const pwOkRef              = useRef(null);
  const rowsRef              = useRef([]);
  const cellRefs             = useRef({});
  const custRef              = useRef(null);
  const smRef                = useRef(null);
  const remarksRef           = useRef(null);
  const payInputRefs         = useRef([]);
  const srdetailsRef         = useRef([]);
  const batchListRef         = useRef([]);
  const focusColsRef         = useRef([]);

  // ── State ─────────────────────────────────────────────────────────────────
  const [colSettings,      setColSettings]      = useState(DEFAULT_COL_SETTINGS);
  const [focusCols,        setFocusCols]        = useState([]);
  const [f12Open,          setF12Open]          = useState(false);
  const [ctrlGOpen,        setCtrlGOpen]        = useState(false);
  const [batchPopup,       setBatchPopup]       = useState(null);
  const [expiryListPopup,  setExpiryListPopup]  = useState(null);
  const [perm,             setPerm]             = useState({ View: 0, Add: 0, Edit: 0, Delete: 0 });
  const [isAuthorized,     setIsAuthorized]     = useState(false);
  const [customers,        setCustomers]        = useState([]);
  const [salesmen,         setSalesmen]         = useState([]);
  const [billNo,           setBillNo]           = useState("");
  const [billDate,         setBillDate]         = useState(today());
  const [custId,           setCustId]           = useState("");
  const [custMobile,       setCustMobile]       = useState("");
  const [smId,             setSmId]             = useState("");
  const [remarks,          setRemarks]          = useState("");
  const [editId,           setEditId]           = useState(0);
  const [crmValue,         setCrmValue]         = useState("0.00");
  const [curBal,           setCurBal]           = useState("0.00");
  const [stockLbl,         setStockLbl]         = useState("0.00");
  const [rows,             setRows]             = useState([mkRow()]);
  const [selRid,           setSelRid]           = useState(null);
  const [payRows,          setPayRows]          = useState([]);
  const [totals,           setTotals]           = useState({ GrossAmt: 0, DiscAmt: 0, GSTAmt: 0, CESSAmt: 0, OtherPlus: 0, OtherMinus: 0, Coinage: 0, NetAmt: 0 });
  const [otherPlus,        setOtherPlus]        = useState("");
  const [otherMinus,       setOtherMinus]       = useState("");
  const [discPer,          setDiscPer]          = useState("");
  const [gstSplit,         setGstSplit]         = useState([]);
  const [loading,          setLoading]          = useState(false);
  const [ldMsg,            setLdMsg]            = useState("Loading...");
  const [pw,               setPw]              = useState(null);
  const [prodPopup,        setProdPopup]        = useState(null);
  const [prodList,         setProdList]         = useState([]);
  const [custPopup,        setCustPopup]        = useState(false);
  const [f5Open,           setF5Open]           = useState(false);
  const [f5Rows,           setF5Rows]           = useState([]);
  const [lastBillNo,       setLastBillNo]       = useState(() => localStorage.getItem("lastEstimateNo") || "—");
  const [lastBillAmt,      setLastBillAmt]      = useState(() => parseFloat(localStorage.getItem("lastEstimateAmt")) || 0);

  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => { focusColsRef.current = focusCols; }, [focusCols]);

  const regCell = (rid, key, el) => {
    if (!cellRefs.current[rid]) cellRefs.current[rid] = {};
    if (el) cellRefs.current[rid][key] = el;
    else delete cellRefs.current[rid]?.[key];
  };

  const visCols = colSettings.filter(c => c.visible);

  const validRows = rows.filter(r => r.ProductRefId && vn(r.ItemQty) > 0);
  const itemCount = validRows.length;
  const totalQty  = validRows.reduce((s, r) => s + vn(r.ItemQty), 0);

  // ── Session ────────────────────────────────────────────────────────────────
  const [sess] = useState(() => {
    try {
      const main0 = (CC.getLocal("Mainsetting")    || [{}])[0] || {};
      const com0  = (CC.getLocal("Companysetting") || [{}])[0] || {};
      const Comid  = CC.getStr("Comid")  || "1";
      const MComid = CC.getStr("MComid") || Comid;
      const isCC   = !!main0.CommonCompany;
      return {
        Comid: isCC ? MComid : Comid, MComid,
        BillNoType:   com0.BillType   || "Daily Reset On Company",
        BillNoPrefix: com0.BillPrefix || "",
        BillNoDigit:  com0.NumberDigit || 0,
        CashId:       CC.getStr("CustomerCashid") || "0",
        CashierId:    CC.getStr("CashierRefid")   || "0",
        Tamil:        !!main0.ProductNameTamil,
        CommonCompany: isCC,
        CommonCompanyDiffStock: !!main0.CommonCompanyDiffStock,
        MulipleMRP:   !!com0.MultiMRP,
        SaleSubMaster: !!main0.SaleSubMaster,
        Herbalife:    !!main0.Herbalife,
        DayClose:     !!main0.DayClose,
        TaxName:      com0.POSTax || "Exclusive",
      };
    } catch {
      return { Comid: "1", MComid: "1", CashId: "0", CashierId: "0", BillNoType: "Daily Reset On Company", BillNoPrefix: "", BillNoDigit: 0 };
    }
  });

  // ── Load column config ────────────────────────────────────────────────────
  const loadColCfg = useCallback(async (comid) => {
    try {
      const url = `/Content/Appdata/Visible/${comid}/Estimate.json?v=${Date.now()}`;
      const res = await fetch(url, { headers: CC.authHeaders() });
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
      const url = `/Content/Appdata/Visible/${mcomid}/EstimateFocus.json?v=${Date.now()}`;
      const res = await fetch(url, { headers: CC.authHeaders?.() || {} });
      if (!res.ok) return;
      const saved = await res.json();
      if (!Array.isArray(saved)) return;
      const ordered = saved
        .filter(s => s.Focus === true)
        .sort((a, b) => (a.Index ?? 99) - (b.Index ?? 99))
        .map(s => s.column);
      focusColsRef.current = ordered;
      setFocusCols(ordered);
    } catch {}
  }, []);

  // ── Permission check ──────────────────────────────────────────────────────
  useEffect(() => {
    const menuStr = localStorage.getItem("menulist");
    if (!menuStr) { alert("Session Close Please Login !!!"); navigate("/"); return; }
    const menulist = JSON.parse(menuStr);
    let menudata = menulist.filter(o => o.PageName === "Billing-Estimate");
    if (!menudata || menudata.length === 0) menudata = menulist.filter(o => o.PageName === "Billing-POS");
    if (!menudata || menudata.length === 0 || menudata[0].View === 0) {
      alert("Page Access Permission Denied !!!");
      setTimeout(() => navigate("/Home"), 3000); return;
    }
    setPerm({ View: menudata[0].View, Add: menudata[0].Add, Edit: menudata[0].Edit, Delete: menudata[0].Delete });
    setIsAuthorized(true);
    setTimeout(() => {
      const firstRow = rowsRef.current[0];
      if (firstRow) cellRefs.current[firstRow._rid]?.["ProductCode"]?.focus();
    }, 200);
  }, [navigate]);

  const redirectIfDualLogin = useCallback((res) => {
    if (res?._dualLogin || res?.redis === false) {
      alert("Already Login Another User Please Login Again!!!");
      navigate("/"); return true;
    }
    return false;
  }, [navigate]);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthorized) return;
    (async () => {
      setLoading(true); setLdMsg("Loading...");
      await Promise.all([loadDropdowns(), loadBillNo(), loadColCfg(sess.Comid), loadFocusCols(sess.MComid)]);
      setLoading(false);
    })();
  // eslint-disable-next-line
  }, [isAuthorized]);

  const loadBillNo = useCallback(async () => {
    const res = await CC.api(SaleMaxNo, null, {}, {
      date: billDate, CId: sess.CashierId, Comid: sess.Comid,
      NumberDigit: sess.BillNoDigit, BillPrefix: sess.BillNoPrefix,
      BillType: sess.BillNoType, Estimate: 1, BM: 0,
    });
    if (redirectIfDualLogin(res)) return;
    const no = res.No || res.data || res.Data1 || "";
    if (no) setBillNo(ns(no));
  // eslint-disable-next-line
  }, [sess, billDate]);

  const loadDropdowns = useCallback(async () => {
    const comidParam = sess.CommonCompany ? sess.MComid : sess.Comid;
    const [custRes, smRes, cardRes] = await Promise.all([
      CC.api(GetCustomerUrl, null, {}, { Comid: comidParam, AccountType: "CUSTOMER" }),
      CC.api(SalesManSelectUrl, null, {}, { Comid: comidParam }),
      CC.api(SelectCardMasterUrl, null, {}, { Comid: sess.Comid }),
    ]);
    if (redirectIfDualLogin(custRes)) return;
    const pick = r => r.data || r.Data1 || r || [];
    setCustomers(Array.isArray(pick(custRes)) ? pick(custRes) : []);
    setSalesmen(Array.isArray(pick(smRes))   ? pick(smRes)   : []);
    const cardList = Array.isArray(pick(cardRes)) ? pick(cardRes) : [];
    if (cardList.length > 0) {
      setPayRows(cardList.map(c => ({ CardAccountRefId: c.CardAccountRefId, Saletype: c.Saletype || c.CardType || ns(c.AccountName), CardType: c.CardType || "CASH", Amount: "", Scharge: vn(c.Scharge), SchargeAmt: 0 })));
    } else {
      setPayRows([
        { CardAccountRefId: 0, Saletype: "CASH",   CardType: "CASH",   Amount: "", Scharge: 0, SchargeAmt: 0 },
        { CardAccountRefId: 1, Saletype: "CARD",   CardType: "CARD",   Amount: "", Scharge: 0, SchargeAmt: 0 },
        { CardAccountRefId: 2, Saletype: "UPI",    CardType: "UPI",    Amount: "", Scharge: 0, SchargeAmt: 0 },
        { CardAccountRefId: 3, Saletype: "CREDIT", CardType: "CREDIT", Amount: "", Scharge: 0, SchargeAmt: 0 },
      ]);
    }
  // eslint-disable-next-line
  }, [sess]);

  // ── Totals recalc ─────────────────────────────────────────────────────────
  const recalcTotals = useCallback((rowsArr, oPlus, oMinus) => {
    let grossAmt = 0, gstAmt = 0, cessAmt = 0, discAmt = 0, cdAmt = 0;
    const gstMap = {};
    rowsArr.forEach(r => {
      if (!r.ProductRefId || !vn(r.ItemQty)) return;
      const calc = calcSaleRow(r);
      grossAmt += vn(calc.OrgRate) * vn(r.ItemQty) || vn(calc.LandingCost) * vn(r.ItemQty);
      gstAmt   += vn(calc.TaxAmt);
      cessAmt  += vn(calc.CESSAmount);
      discAmt  += vn(calc.DiscountAmt);
      cdAmt    += vn(calc.CDAmount);
      const key = f2(vn(r.TaxPercent));
      if (!gstMap[key]) gstMap[key] = { TaxPercent: key, TaxAmt: 0, CTAmount: 0, STAmount: 0 };
      gstMap[key].TaxAmt   += vn(calc.TaxAmt);
      gstMap[key].CTAmount += vn(calc.CTAmount);
      gstMap[key].STAmount += vn(calc.STAmount);
    });
    const netAmt = f2(grossAmt + gstAmt + cessAmt + vn(oPlus) - (discAmt + cdAmt) - vn(oMinus));
    setGstSplit(Object.values(gstMap).filter(g => g.TaxAmt > 0));
    setTotals({ GrossAmt: f2(grossAmt), DiscAmt: f2(discAmt + cdAmt), GSTAmt: f2(gstAmt), CESSAmt: f2(cessAmt), OtherPlus: vn(oPlus), OtherMinus: vn(oMinus), Coinage: 0, NetAmt: netAmt });
    return netAmt;
  }, []);

  useEffect(() => { recalcTotals(rows, otherPlus, otherMinus); }, [rows, otherPlus, otherMinus, recalcTotals]);

  const payTotals = (() => {
    const recvd = payRows.reduce((s, r) => s + vn(r.Amount), 0);
    return { recvd: f2(recvd), toPay: f2(totals.NetAmt - recvd) };
  })();

  // ── Customer handlers ─────────────────────────────────────────────────────
  const handleCustomerSelect = useCallback(async (custObj) => {
    const cid = String(custObj.Id);
    setCustId(cid); setCustMobile(custObj.MobileNo || ""); setCustPopup(false);
    const [crmRes, balRes] = await Promise.all([
      CC.api(CRMBalanceUrl, null, {}, { Id: cid, Fromdate: billDate, Comid: sess.Comid, MComid: sess.MComid }),
      fetch(`${BASE_URL}${CurrentBalanceUrl}?Id=${cid}&MComid=${sess.MComid}&TillDate=${billDate}&Comid=${sess.Comid}&AccountType=CUSTOMER`, { headers: { "NRN": "1", ...CC.authHeaders() } }).then(r => r.json()).catch(() => null),
    ]);
    if (!crmRes._netErr && (crmRes.ok ?? crmRes.IsSuccess)) {
      const arr = Array.isArray(crmRes.data) ? crmRes.data : [];
      setCrmValue(arr.length > 0 ? f2(vn(arr[0].Value)).toFixed(2) : "0.00");
    }
    if (balRes !== null) {
      const bal = parseFloat(balRes.Data1 ?? balRes.data ?? 0);
      setCurBal(isNaN(bal) ? "0.00" : f2(bal).toFixed(2));
    }
  }, [sess, billDate]);

  const handleCustomerChange = useCallback(async (cid) => {
    setCustId(cid);
    const found = customers.find(c => String(c.Id) === cid);
    setCustMobile(found?.MobileNo || "");
    if (!cid) { setCrmValue("0.00"); setCurBal("0.00"); return; }
    const [crmRes, balRes] = await Promise.all([
      CC.api(CRMBalanceUrl, null, {}, { Id: cid, Fromdate: billDate, Comid: sess.Comid, MComid: sess.MComid }),
      fetch(`${CurrentBalanceUrl}?Id=${cid}&MComid=${sess.MComid}&TillDate=${billDate}&Comid=${sess.Comid}&AccountType=CUSTOMER`, { headers: { "NRN": "1", ...CC.authHeaders() } }).then(r => r.json()).catch(() => null),
    ]);
    if (!crmRes._netErr && (crmRes.ok ?? crmRes.IsSuccess)) {
      const arr = Array.isArray(crmRes.data) ? crmRes.data : [];
      setCrmValue(arr.length > 0 ? f2(vn(arr[0].Value)).toFixed(2) : "0.00");
    }
    if (balRes !== null) {
      const bal = parseFloat(balRes.Data1 ?? balRes.data ?? 0);
      setCurBal(isNaN(bal) ? "0.00" : f2(bal).toFixed(2));
    }
  }, [sess, billDate, customers]);

  // ── Fill item into row ────────────────────────────────────────────────────
  const fillItemIntoRow = useCallback((rid, item) => {
    setRows(prev => prev.map(r => {
      if (r._rid !== rid) return r;
      setStockLbl(vn(item.Stock).toFixed(0));
      return {
        ...r,
        ProductRefId:    item.Id,
        ProductCode:     item.Prod_Code || item.ProductCode,
        ProductName:     sess.Tamil ? (item.PrinterName || item.PName) : (item.PName || item.ProductName),
        PrinterName:     item.PrinterName || "",
        MRP:             f2(vn(item.MRP)),
        SaleRate:        f2(vn(item.SaleRate || item.SalesRate)),
        _origSaleRate:   f2(vn(item.SaleRate || item.SalesRate)),
        PurchaseRate:    f2(vn(item.PurRate)),
        TaxPercent:      f2(vn(item.GST)),
        CESSPer:         f2(vn(item.CESS)),
        SPLCESS:         f2(vn(item.SPLCESS)),
        UOM:             item.UOM || "",
        UOMDecimal:      item.UOMDecimal || 0,
        HSNCode:         item.HSNCode || "",
        StockQty:        vn(item.Stock),
        SalesRateType:   !!item.SaleRateType,
        NegativetStock:  !!item.NegativetStock,
        NStock:          item.Nstock || 0,
        DiscountPercent: f2(vn(item.SaleDiscountPer)),
        CRMPoints:       vn(item.CRMPoints),
        ItemQty:         item.UOMDecimal === 0 ? "1" : "",
        _dirty: true,
      };
    }));
    setProdPopup(null);
    setTimeout(() => {
      const defaultCols = visCols.map(vc => SALE_COLUMNS.find(c => c.key === vc.key)).filter(Boolean).filter(cd => !cd.readOnly).map(cd => cd.key);
      const COLS = focusColsRef.current.length > 0 ? focusColsRef.current.filter(k => defaultCols.includes(k)) : defaultCols;
      const pcIdx = COLS.indexOf("ProductCode");
      const nextCol = pcIdx >= 0 && pcIdx < COLS.length - 1 ? COLS[pcIdx + 1] : "ItemQty";
      const el = cellRefs.current[rid]?.[nextCol];
      if (el) { el.focus(); el.select?.(); }
    }, 50);
  }, [sess, visCols]);

  // ── Fill batch item into row ──────────────────────────────────────────────
  const fillBatchItemIntoRow = useCallback(async (rid, batchItem) => {
    setRows(prev => prev.map(r => {
      if (r._rid !== rid) return r;
      setStockLbl(vn(batchItem.Stock).toFixed(0));
      return {
        ...r,
        ProductRefId:    batchItem.Id,
        ProductCode:     batchItem.ProductCode,
        ProductName:     sess.Tamil ? (batchItem.PrinterName || batchItem.ProductName) : batchItem.ProductName,
        PrinterName:     batchItem.PrinterName || "",
        _origSaleRate:   f2(vn(batchItem.SalesRate || batchItem.SaleRate)),
        MRP:             f2(vn(batchItem.MRP)),
        SaleRate:        f2(vn(batchItem.SalesRate || batchItem.SaleRate)),
        PurchaseRate:    f2(vn(batchItem.PurchaseRate)),
        TaxPercent:      f2(vn(batchItem.GST)),
        CESSPer:         f2(vn(batchItem.CESS)),
        SPLCESS:         f2(vn(batchItem.SPLCESS)),
        UOM:             batchItem.UOM || "",
        UOMDecimal:      batchItem.UOMDecimal || 0,
        HSNCode:         batchItem.HSNCode || "",
        StockQty:        vn(batchItem.Stock),
        BatchRefid:      batchItem.Batchid || null,
        Bat_No:          batchItem.BatchNo || "",
        DiscountPercent: f2(vn(batchItem.SaleDiscountPer)),
        ItemQty:         batchItem.UOMDecimal === 0 ? "1" : "",
        _dirty: true,
      };
    }));
    setBatchPopup(null);

    // Check expiry after batch select
    if (batchItem.ManufactureDate === 1 || batchItem.ExpriyDate === 1) {
      try {
        const expRes = await CC.api(SelectExpiryByIdUrl, null, {}, { Id: batchItem.Id, Comid: sess.MComid });
        const expList = Array.isArray(expRes.data) ? expRes.data : Array.isArray(expRes.Data1) ? expRes.Data1 : [];
        if (expList.length > 0) setExpiryListPopup({ rid, list: expList });
      } catch {}
    }

    setTimeout(() => {
      const defaultCols = visCols.map(vc => SALE_COLUMNS.find(c => c.key === vc.key)).filter(Boolean).filter(cd => !cd.readOnly).map(cd => cd.key);
      const COLS = focusColsRef.current.length > 0 ? focusColsRef.current.filter(k => defaultCols.includes(k)) : defaultCols;
      const pcIdx = COLS.indexOf("ProductCode");
      const nextCol = pcIdx >= 0 && pcIdx < COLS.length - 1 ? COLS[pcIdx + 1] : "ItemQty";
      const el = cellRefs.current[rid]?.[nextCol];
      if (el) { el.focus(); el.select?.(); }
    }, 50);
  }, [sess, visCols]);

  // ── Fetch product by code ─────────────────────────────────────────────────
  const fetchProductByCode = useCallback(async (rid, code) => {
    if (!code.trim()) return;
    const payload = {
      code: code.trim().toUpperCase(),
      Comid: sess.MComid, CComid: sess.Comid,
      Id: 0, Batchwise: 1,
    };
    const res = await CC.api(SelectItemByCodeUrl, null, {}, payload);
    if (redirectIfDualLogin(res)) return;
    const arr = Array.isArray(res.data) ? res.data : Array.isArray(res.Data1) ? res.Data1 : [];
    if (arr.length === 0) { toast("❌ Invalid Product Code", true); return; }

    // Batchwise check
    if (arr[0]?.BatchStatus === 1 || arr[0]?.BatchwiseStock === 1) {
      if (arr.length === 1 && arr[0].BatchNo === code.trim().toUpperCase()) {
        fillBatchItemIntoRow(rid, arr[0]);
      } else {
        batchListRef.current = arr;
        setBatchPopup({ rid, batches: arr });
      }
      return;
    }

    // Normal flow
    if (arr.length === 1) {
      fillItemIntoRow(rid, arr[0]);
      if (arr[0].ManufactureDate === 1 || arr[0].ExpriyDate === 1) {
        try {
          const expRes = await CC.api(SelectExpiryByIdUrl, null, {}, { Id: arr[0].Id, Comid: sess.MComid });
          const expList = Array.isArray(expRes.data) ? expRes.data : Array.isArray(expRes.Data1) ? expRes.Data1 : [];
          if (expList.length > 0) setExpiryListPopup({ rid, list: expList });
        } catch {}
      }
    } else {
      setProdList(arr);
      setProdPopup({ rid, pos: { top: 200, left: 80 } });
    }
  }, [sess, fillItemIntoRow, fillBatchItemIntoRow]);

  // ── Cell change ───────────────────────────────────────────────────────────
  const handleCellChange = useCallback((rid, colKey, value) => {
    setRows(prev => prev.map(r => {
      if (r._rid !== rid) return r;
      const updated = { ...r, [colKey]: value, _dirty: true };
      if (["ItemQty","SaleRate","TaxPercent","CESSPer","SPLCESS","DiscountPercent","CDPercent"].includes(colKey)) {
        return calcSaleRow(updated);
      }
      return updated;
    }));
  }, []);

  // ── Sale rate blur (password check) ──────────────────────────────────────
  const handleSaleRateBlur = useCallback((rid) => {
    const row = rowsRef.current.find(r => r._rid === rid);
    if (!row?.SalesRateType) return;
    const newRate  = f2(vn(row.SaleRate));
    const origRate = f2(vn(row._origSaleRate ?? row.SaleRate));
    if (newRate === origRate) { unlockedRidRef.current = null; return; }
    if (unlockedRidRef.current === rid) {
      setRows(prev => prev.map(r => {
        if (r._rid !== rid) return r;
        return calcSaleRow({ ...r, SaleRate: newRate, _origSaleRate: newRate, _dirty: true });
      }));
      unlockedRidRef.current = null;
      return;
    }
    pendingRateChangeRef.current = { rid, value: newRate, origRate };
    pwOkRef.current = () => {
      const { rid: r, value: v } = pendingRateChangeRef.current;
      setRows(prev => prev.map(row => {
        if (row._rid !== r) return row;
        return calcSaleRow({ ...row, SaleRate: v, _origSaleRate: v, _dirty: true });
      }));
      pendingRateChangeRef.current = null;
      unlockedRidRef.current = null;
    };
    setPw({ title: "Sale Rate Change Password" });
    setRows(prev => prev.map(r => {
      if (r._rid !== rid) return r;
      return calcSaleRow({ ...r, SaleRate: origRate, _dirty: true });
    }));
  }, []);

  // ── Load products ─────────────────────────────────────────────────────────
  const loadProductsForPopup = useCallback(async (rid) => {
    if (prodList.length > 0) { setProdPopup({ rid, pos: { top: 160, left: 80 } }); return; }
    setLoading(true); setLdMsg("Loading products...");
    const res = await CC.api(ProductListUrl, null, {}, { Comid: sess.Comid });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    const arr = Array.isArray(res.data) ? res.data : Array.isArray(res.Data1) ? res.Data1 : Array.isArray(res) ? res : [];
    setProdList(arr);
    setProdPopup({ rid, pos: { top: 160, left: 80 } });
  // eslint-disable-next-line
  }, [sess, prodList]);

  // ── Cell keydown ──────────────────────────────────────────────────────────
  const handleCellKeyDown = useCallback((e, rid, colKey) => {
    const defaultCols = visCols
      .map(vc => SALE_COLUMNS.find(c => c.key === vc.key))
      .filter(Boolean)
      .filter(cd => !cd.readOnly)
      .map(cd => cd.key);

    const ALL_COLS = focusColsRef.current.length > 0
      ? focusColsRef.current.filter(k => defaultCols.includes(k))
      : defaultCols;

    const COLS = ["ProductCode", ...ALL_COLS.filter(k => k !== "ProductCode")];
    const colIdx = COLS.indexOf(colKey);
    const rowIdx = rowsRef.current.findIndex(r => r._rid === rid);

    const focusCell = (targetRid, targetKey) => {
      setTimeout(() => {
        const el = cellRefs.current[targetRid]?.[targetKey];
        if (el) { el.focus(); el.select?.(); }
      }, 10);
    };

    // ── SaleRate Tab/ArrowRight — password check ──────────────────────────
    if ((e.key === "Tab" || e.key === "ArrowRight") && colKey === "SaleRate") {
      const curRow = rowsRef.current.find(r => r._rid === rid);
      if (curRow?.SalesRateType) {
        const newRate  = f2(vn(curRow.SaleRate));
        const origRate = f2(vn(curRow._origSaleRate ?? curRow.SaleRate));
        if (newRate !== origRate) {
          e.preventDefault();
          pendingRateChangeRef.current = { rid, value: newRate, origRate };
          pwOkRef.current = () => {
            const { rid: r, value: v } = pendingRateChangeRef.current;
            setRows(prev => prev.map(row => {
              if (row._rid !== r) return row;
              return calcSaleRow({ ...row, SaleRate: v, _origSaleRate: v, _dirty: true });
            }));
            pendingRateChangeRef.current = null;
            setTimeout(() => {
              if (colIdx >= 0 && colIdx < COLS.length - 1) {
                const el = cellRefs.current[rid]?.[COLS[colIdx + 1]];
                if (el) { el.focus(); el.select?.(); }
              }
            }, 30);
          };
          setRows(prev => prev.map(r => {
            if (r._rid !== rid) return r;
            return calcSaleRow({ ...r, SaleRate: origRate, _dirty: true });
          }));
          setPw({ title: "Sale Rate Change Password" });
          return;
        }
      }
    }

    // ── SaleRate Enter — password check ───────────────────────────────────
    if (e.key === "Enter" && colKey === "SaleRate") {
      e.preventDefault();
      const curRow = rowsRef.current.find(r => r._rid === rid);
      if (!curRow?.SalesRateType) {
        focusCell(rid, COLS[colIdx + 1] ?? COLS[0]);
        return;
      }
      const newRate  = f2(vn(curRow.SaleRate));
      const origRate = f2(vn(curRow._origSaleRate ?? curRow.SaleRate));
      if (newRate === origRate) {
        if (colIdx >= 0 && colIdx < COLS.length - 1) focusCell(rid, COLS[colIdx + 1]);
        return;
      }
      pendingRateChangeRef.current = { rid, value: newRate, origRate };
      pwOkRef.current = () => {
        const { rid: r, value: v } = pendingRateChangeRef.current;
        setRows(prev => prev.map(row => {
          if (row._rid !== r) return row;
          return calcSaleRow({ ...row, SaleRate: v, _origSaleRate: v, _dirty: true });
        }));
        pendingRateChangeRef.current = null;
        setTimeout(() => {
          if (colIdx >= 0 && colIdx < COLS.length - 1) {
            const el = cellRefs.current[rid]?.[COLS[colIdx + 1]];
            if (el) { el.focus(); el.select?.(); }
          }
        }, 30);
      };
      setRows(prev => prev.map(r => {
        if (r._rid !== rid) return r;
        return calcSaleRow({ ...r, SaleRate: origRate, _dirty: true });
      }));
      setPw({ title: "Sale Rate Change Password" });
      return;
    }

    // ── ItemQty Enter — same line merge check ─────────────────────────────
    if (e.key === "Enter" && colKey === "ItemQty") {
      e.preventDefault();
      const curRow = rowsRef.current.find(r => r._rid === rid);
      if (!curRow?.ProductRefId || vn(curRow.ItemQty) === 0) return;
      const duplicate = rowsRef.current.find(r =>
        r._rid !== rid &&
        r.ProductRefId === curRow.ProductRefId &&
        f2(vn(r.SaleRate)) === f2(vn(curRow.SaleRate)) &&
        !r._isFree
      );
      if (duplicate) {
        const mergedQty = f2(vn(duplicate.ItemQty) + vn(curRow.ItemQty));
        setRows(prev => {
          const updated = prev.map(r => r._rid !== duplicate._rid ? r : calcSaleRow({ ...r, ItemQty: String(mergedQty), _dirty: true })).filter(r => r._rid !== rid);
          return updated.length === 0 ? [mkRow()] : updated;
        });
        setTimeout(() => { const el = cellRefs.current[duplicate._rid]?.["ItemQty"]; if (el) { el.focus(); el.select?.(); } }, 60);
        return;
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (colKey === "ProductCode") {
        const row = rowsRef.current.find(r => r._rid === rid);
        if (row?.ProductCode?.trim()) fetchProductByCode(rid, row.ProductCode);
        else loadProductsForPopup(rid);
        return;
      }
      if (colIdx >= 0 && colIdx < COLS.length - 1) {
        focusCell(rid, COLS[colIdx + 1]);
      } else {
        const curRows = rowsRef.current;
        const curRow  = curRows.find(r => r._rid === rid);
        const isLast  = rowIdx === curRows.length - 1;
        if (isLast) {
          if (curRow?.ProductRefId) {
            const newRow = mkRow();
            setRows(prev => [...prev, newRow]);
            setTimeout(() => { cellRefs.current[newRow._rid]?.["ProductCode"]?.focus(); }, 80);
          } else focusCell(rid, "ProductCode");
        } else {
          const nextRow = curRows[rowIdx + 1];
          setTimeout(() => { const el = cellRefs.current[nextRow._rid]?.["ProductCode"]; if (el) { el.focus(); el.select?.(); } }, 20);
        }
      }
      return;
    }

    if (e.key === "ArrowDown" && rowIdx < rowsRef.current.length - 1) { e.preventDefault(); focusCell(rowsRef.current[rowIdx + 1]._rid, colKey); }
    if (e.key === "ArrowUp"   && rowIdx > 0)                          { e.preventDefault(); focusCell(rowsRef.current[rowIdx - 1]._rid, colKey); }
    if (e.key === "ArrowRight" && colIdx < COLS.length - 1)           { e.preventDefault(); focusCell(rid, COLS[colIdx + 1]); }
    if (e.key === "ArrowLeft"  && colIdx > 0)                         { e.preventDefault(); focusCell(rid, COLS[colIdx - 1]); }
    if (e.key === "Delete")  { e.preventDefault(); doDeleteRow(rid); }
    if (e.key === " " && colKey === "ProductCode") { e.preventDefault(); loadProductsForPopup(rid); }
  // eslint-disable-next-line
  }, [visCols, fetchProductByCode, loadProductsForPopup]);

  // ── Delete row ────────────────────────────────────────────────────────────
  const doDeleteRow = useCallback(async (rid) => {
    const ok = await confirm("Do you want to Delete this Row?");
    if (!ok) return;
    setRows(prev => { const next = prev.filter(r => r._rid !== rid); return next.length === 0 ? [mkRow()] : next; });
  }, [confirm]);

  // ── Bill discount ─────────────────────────────────────────────────────────
  const applyBillDiscount = useCallback(() => {
    const per = vn(discPer);
    if (!per) return;
    setRows(prev => prev.map(r => (!r.ProductRefId || !vn(r.ItemQty)) ? r : calcSaleRow({ ...r, DiscountPercent: per, _dirty: true })));
  }, [discPer]);

  // ── Clear form ────────────────────────────────────────────────────────────
  const clearForm = useCallback(async () => {
    unlockedRidRef.current = null;
    setEditId(0);
    setCustId(""); setCustMobile(""); setSmId(""); setRemarks("");
    setOtherPlus(""); setOtherMinus(""); setDiscPer("");
    setCrmValue("0.00"); setCurBal("0.00"); setStockLbl("0.00");
    setRows([mkRow()]);
    setPayRows(pr => pr.map(r => ({ ...r, Amount: "" })));
    setSelRid(null);
    await loadBillNo();
    setTimeout(() => {
      const firstRow = rowsRef.current[0];
      if (firstRow) cellRefs.current[firstRow._rid]?.["ProductCode"]?.focus();
    }, 100);
  }, [loadBillNo]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const doSave = useCallback(async () => {
    if (!perm.Add && !perm.Edit) { toast("❌ Permission Denied", true); return; }
    const validRows = rows.filter(r => r.ProductRefId && vn(r.ItemQty) > 0);
    if (validRows.length === 0) { toast("❌ Add at least one item", true); return; }

    const totalPay = payRows.reduce((s, r) => s + vn(r.Amount), 0);
    let effectivePayRows = payRows;
    if (totalPay === 0) {
      const cashIdx = payRows.findIndex(r => r.CardType === "CASH");
      const idx = cashIdx >= 0 ? cashIdx : 0;
      effectivePayRows = payRows.map((r, i) => i === idx ? { ...r, Amount: totals.NetAmt.toFixed(2) } : { ...r, Amount: "" });
      setPayRows(effectivePayRows);
    }

    const ok = await confirm("Do you want to Save Estimate Bill?");
    if (!ok) return;

    setLoading(true); setLdMsg("Saving...");
    const custObj = customers.find(c => String(c.Id) === String(custId));

    const saledetails = validRows.map(r => ({
      SDId: r.SDId || 0, ProductRefId: r.ProductRefId, ProductCode: r.ProductCode,
      ProductName: r.ProductName, PrintName: r.PrinterName || r.ProductName,
      MRP: f2(vn(r.MRP)), SaleRate: f2(vn(r.SaleRate)), ItemQty: f2(vn(r.ItemQty)),
      Amount: f2(vn(r.Amount)), TaxPercent: f2(vn(r.TaxPercent)), TaxAmt: f2(vn(r.TaxAmt)),
      CESSPer: f2(vn(r.CESSPer)), CESSAmount: f2(vn(r.CESSAmount)),
      SPLCESS: f2(vn(r.SPLCESS)), SPLCESSAmount: f2(vn(r.SPLCESSAmount)),
      DiscountPercent: f2(vn(r.DiscountPercent)), DiscountAmt: f2(vn(r.DiscountAmt)),
      cdpercent: f2(vn(r.CDPercent)), cdAmount: f2(vn(r.CDAmount)),
      Landingcost: f2(vn(r.LandingCost)), CTAmount: f2(vn(r.CTAmount)), STAmount: f2(vn(r.STAmount)),
      PurchaseRate: f2(vn(r.PurchaseRate)), UOM: r.UOM || "", HSNcode: r.HSNCode || "",
      StockQty: vn(r.StockQty), BatchRefid: r.BatchRefid || null,
      SalesmanRefid: r.SalesManCode ? parseInt(r.SalesManCode) : (smId ? parseInt(smId) : null),
      SalesManCode:  r.SalesManCode ? parseInt(r.SalesManCode) : (smId ? parseInt(smId) : 0),
      FreeQty: 0, NOMS: 0, NOMSQty: 0,
      SaleRate_org: f2(vn(r.OrgRate)), remarks: r.Remarks || "",
      SRDetailsId: r.SRDetailsId || 0, Bat_No: r.Bat_No || "",
    }));

    const payFiltered = effectivePayRows.filter(p => vn(p.Amount) > 0).map(p => ({
      CardAccountRefId: p.CardAccountRefId, Saletype: p.Saletype,
      CardType: p.CardType, Amount: f2(vn(p.Amount)), SchargeAmt: f2(vn(p.SchargeAmt)),
      CustomerRefid: custId ? parseInt(custId) : parseInt(sess.CashId),
    }));

    const payload = [{
      Id: editId, SRId: 0,
      CustomerRefId: custId ? parseInt(custId) : parseInt(sess.CashId),
      SaleNo: 0, CompanyRefId: parseInt(sess.Comid),
      SaleNoDisplay: billNo, SaleDate: billDate, SaleType: "CASH",
      OthersplusAmt: vn(otherPlus), OtherssubAmt: vn(otherMinus),
      Grossamt: totals.GrossAmt, taxamount: totals.GSTAmt,
      CESSAmount: totals.CESSAmt, SPLCESSAmount: 0,
      disper: vn(discPer), discamount: totals.DiscAmt,
      NetAmount: totals.NetAmt, coinage: 0, Remarks: remarks,
      CashierRefId: parseInt(sess.CashierId) || 0,
      salesmanRefId: smId ? parseInt(smId) : null,
      DeleteStatus: true, BillHoldName: "",
      CustomerName: custObj?.AccountName || "",
      Address1: custObj?.Address1 || "", Address2: custObj?.Address2 || "",
      City: custObj?.City || "", Email: custObj?.Email || "",
      PhoneNo: custObj?.MobileNo || "", Pincode: custObj?.Pincode || "",
      TinNo: custObj?.GSTINNo || "", IGSTBill: custObj?.IGSTBill || "GST",
      Modified_By: localStorage.getItem("username") || "",
      ModifiedStatus: editId > 0 ? 1 : 0, Modified_Date: billDate,
      SaleDetails: saledetails, SaleAmountDetails: payFiltered, StockDetails: [],
    }];

    const headers = {
      "Comid": String(sess.Comid), "ApiType": "1", "LocalV7": "2",
      "cashid": String(sess.CashId), "BillType": sess.BillNoType,
      "BillPerfix": sess.BillNoPrefix, "BillHoldName": "",
      "BillDigit": String(sess.BillNoDigit), "EncashAmt": "0", "EncashPoint": "0",
      "SubSalemaster": sess.SaleSubMaster ? "1" : "0",
      "Commoncompany": sess.CommonCompany ? "true" : "false",
      "CommoncompanyDiffStock": sess.CommonCompanyDiffStock ? "true" : "false",
      "MulipleMRP": sess.MulipleMRP ? "true" : "false",
      "Herballife": sess.Herbalife ? "1" : "0",
      "Estimate": "1",   // ← Always 1 for EstimateBill
      "PrintA4Invoice": "1", "SmallPrint": "0", "BillFormat": "Default",
      "DayClose": sess.DayClose ? "1" : "0", "MirrorTable": "0",
      "LocalDB": "0", "RO": "0",
    };

    const res = await CC.insertapi(SaleInsertUrl, payload, headers);
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res.ok ?? res.IsSuccess) {
      localStorage.setItem("lastEstimateNo",  billNo);
      localStorage.setItem("lastEstimateAmt", totals.NetAmt.toString());
      setLastBillNo(billNo);
      setLastBillAmt(totals.NetAmt);
      toast("✅ Estimate Saved Successfully");
      await clearForm();
    } else {
      toast("❌ " + (res.Message || res.message || "Save Failed"), true);
    }
  // eslint-disable-next-line
  }, [perm, confirm, clearForm, sess, payRows, totals, rows,
      custId, smId, remarks, billNo, billDate, editId, otherPlus, otherMinus,
      discPer, customers]);

  // ── Delete bill ───────────────────────────────────────────────────────────
  const doDeleteBill = useCallback(async () => {
    if (!editId) { toast("No bill to delete", true); return; }
    if (!perm.Delete) { toast("❌ Delete Permission Denied", true); return; }
    const ok = await confirm("Do you want to Cancel this Bill?");
    if (!ok) return;
    setLoading(true);
    const headers = {
      Comid: String(sess.Comid), Cid: String(sess.CashierId), SRId: "0",
      BillType: sess.BillNoType, SRStockDetails: JSON.stringify(srdetailsRef.current),
      Reason: "", Estimate: "1",
      MirrorTable: "0", Updateid: "", LocalDB: "0",
      DayClose: sess.DayClose ? "1" : "0", SaleDate: billDate, Id: String(editId),
    };
    const res = await CC.api(SaleDeleteUrl, [], headers, null);
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res.ok ?? res.IsSuccess) { toast("✅ Deleted Successfully"); await clearForm(); }
    else toast("❌ " + (res.message || res.Message || "Delete Failed"), true);
  // eslint-disable-next-line
  }, [editId, perm, confirm, sess, clearForm, billDate]);

  // ── F5 view ───────────────────────────────────────────────────────────────
  const openF5 = useCallback(async (from = billDate, to = billDate) => {
    setLoading(true); setLdMsg("Loading bills...");
    const res = await CC.api(F5SelectUrl, null, {}, { Comid: sess.Comid, Fromdate: from, Todate: to, Id: 0, Estimate: 1 });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    const arr = Array.isArray(res.data) ? res.data : Array.isArray(res.Data1) ? res.Data1
              : Array.isArray(res?.Data?.[0]?.salemaster) ? res.Data[0].salemaster : [];
    setF5Rows(arr); setF5Open(true);
  // eslint-disable-next-line
  }, [sess, billDate]);

  // ── Edit bill ─────────────────────────────────────────────────────────────
  const doEditBill = useCallback(async (id) => {
    setF5Open(false);
    if (!perm.Edit) { toast("❌ Edit Permission Denied", true); return; }
    setLoading(true); setLdMsg("Loading bill...");
    const res = await CC.api(SaleEditUrl, null, {}, {
      Id: id, SaleNo: 0, Date: billDate, Comid: sess.Comid,
      Cid: 0, Estimate: 1, CustId: 0, Tamil: !!sess.Tamil,
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (!(res.ok ?? res.IsSuccess)) { toast("❌ " + (res.message || "Load Failed"), true); return; }
    const data = Array.isArray(res.Data) ? res.Data[0] : res.data;
    if (!data) { toast("❌ No data found", true); return; }
    const saledetails = data[0].SaleDetails || [];
    setEditId(data[0].Id || id);
    srdetailsRef.current = data[0].srdetails || [];
    setBillNo(ns(data[0].SaleNoDisplay || data[0].SaleNo));
    setBillDate(String(data[0].SaleDate || "").slice(0, 10) || today());
    const cid = ns(data[0].CustomerRefId);
    setCustId(cid);
    const found = customers.find(c => String(c.Id) === cid);
    setCustMobile(found?.MobileNo || "");
    setSmId(ns(data[0].salesmanRefId || ""));
    setRemarks(ns(data[0].Remarks));
    setOtherPlus(ns(data[0].OthersplusAmt || ""));
    setOtherMinus(ns(data[0].OtherssubAmt || ""));
    const loadedRows = saledetails.map(r => calcSaleRow(fmtRow({ ...mkRow(), ...r, _rid: genRid() })));
    setRows(loadedRows.length > 0 ? loadedRows : [mkRow()]);
    const saleAmts = data[0].SaleAmountDetails || [];
    setPayRows(pr => pr.map(p => {
      const found = saleAmts.find(a => a.CardAccountRefId === p.CardAccountRefId);
      return found ? { ...p, Amount: found.Amount > 0 ? f2(found.Amount).toFixed(2) : "" } : { ...p, Amount: "" };
    }));
  // eslint-disable-next-line
  }, [sess, billDate, perm, customers]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = e => {
      if (prodPopup || f5Open || pw || f12Open || custPopup || ctrlGOpen || batchPopup || expiryListPopup) return;
      if (e.key === "F1")  { e.preventDefault(); doSave(); }
      if (e.key === "F2")  { e.preventDefault(); doSave(); }
      if (e.key === "F5")  { e.preventDefault(); openF5(); }
      if (e.key === "F8")  { e.preventDefault(); navigate("/Sale"); }
      if (e.key === "F9")  { e.preventDefault(); if (!editId) return; pwOkRef.current = doDeleteBill; setPw({ title: "F9 Delete Password" }); }
      if (e.key === "F10") { e.preventDefault(); confirm("Do You Want To Clear?").then(ok => ok && clearForm()); }
      if (e.key === "F12") { e.preventDefault(); setF12Open(true); }
      if (e.key === "Escape") { e.preventDefault(); confirm("Do You Want To Quit?").then(ok => ok && navigate(-1)); }
      if (e.ctrlKey && e.key === "g") { e.preventDefault(); setCtrlGOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line
  }, [prodPopup, f5Open, pw, f12Open, custPopup, ctrlGOpen, batchPopup, expiryListPopup,
      doSave, openF5, doDeleteBill, clearForm, editId]);

  if (!isAuthorized) return null;

  const RIGHT_KEYS = new Set([
    "Amount","SaleRate","ItemQty","MRP","TaxPercent","DiscountPercent",
    "TaxAmt","CESSAmount","LandingCost","DiscountAmt","CDAmount",
    "SPLCESS","SPLCESSAmount","FreeQty","CDPercent","CESSPer",
  ]);

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="sb-wrap">
      {ConfirmUI}
      <Topbar />
      <div className="sb-body">

        {/* ── Header panel ── */}
        <div className="sb-header-panel">
          <div className="sb-action-btns">
            <button className="sb-action-btn" onClick={doSave} title="F1 Save Estimate">
              <span className="btn-icon">💾</span><span>F1</span>
            </button>
            <button className="sb-action-btn" onClick={() => navigate("/Sale")} title="F8 Sale Bill">
              <span className="btn-icon">🧾</span>
              <span style={{ color: "#1f65de", fontWeight: 700 }}>F8</span>
            </button>
            <button className="sb-action-btn"
              onClick={() => { if (!editId) return; pwOkRef.current = doDeleteBill; setPw({ title: "F9 Delete" }); }}
              title="F9 Delete">
              <span className="btn-icon" style={{ color: "#dc2626" }}>🗑</span>
              <span style={{ color: "#dc2626" }}>F9</span>
            </button>
            <button className="sb-action-btn" onClick={clearForm} title="F10 Clear">
              <span className="btn-icon">🔄</span><span>F10</span>
            </button>
            <button className="sb-action-btn" onClick={() => setF12Open(true)} title="F12 Columns">
              <span className="btn-icon">⚙</span><span>F12</span>
            </button>
          </div>

          <div className="sb-divider" />

          <div className="sb-fields-center">
            {/* Mode badge */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "#fff7ed", border: "1px solid #fed7aa",
              borderRadius: 6, padding: "3px 10px", marginBottom: 4,
              fontSize: 11, fontWeight: 700, color: "#ea580c",
            }}>
              📋 ESTIMATE MODE
              <span style={{ fontSize: 9.5, fontWeight: 400, opacity: 0.7 }}>(F8 → Sale Bill)</span>
            </div>

            {/* Customer row */}
            <div className="sb-field-row">
              <span className="sb-field-lbl">Customer</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
                <ComboBox
                  inputRef={custRef}
                  options={[{ value: "", label: "" }, ...customers.map(c => ({ value: String(c.Id), label: c.AccountName }))]}
                  value={custId}
                  onChange={handleCustomerChange}
                  onEnterKey={() => { const firstRow = rowsRef.current[0]; if (firstRow) cellRefs.current[firstRow._rid]?.["ProductCode"]?.focus(); }}
                  placeholder="-- Select Customer --"
                />
                <button onClick={() => setCustPopup(true)} title="Search Customer"
                  style={{ width: 28, height: 28, flexShrink: 0, background: "#1f65de", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  🔍
                </button>
              </div>
              <span className="sb-field-lbl-sm" style={{ marginLeft: 8 }}>SalesMan</span>
              <ComboBox
                inputRef={smRef}
                options={[{ value: "", label: "" }, ...salesmen.map(s => ({ value: String(s.Id), label: s.SalesManName }))]}
                value={smId}
                onChange={setSmId}
                onEnterKey={() => { const firstRow = rowsRef.current[0]; if (firstRow) cellRefs.current[firstRow._rid]?.["ProductCode"]?.focus(); }}
                placeholder="-- Select --"
                style={{ maxWidth: 160 }}
              />
            </div>

            {/* Info row */}
            <div className="sb-field-row">
              <span className="sb-field-lbl">CRM Value</span>
              <span className="sb-badge-green">{crmValue}</span>
              <span className="sb-field-lbl-sm" style={{ marginLeft: 12 }}>Current Bal</span>
              <span className="sb-badge-green">{curBal}</span>
              {custMobile && (
                <>
                  <span className="sb-field-lbl-sm" style={{ marginLeft: 12 }}>Mobile</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#1f65de", background: "#e8f0fe", borderRadius: 4, padding: "1px 8px", border: "1px solid #c5d8f8" }}>{custMobile}</span>
                </>
              )}
              <span className="sb-field-lbl-sm" style={{ marginLeft: 12 }}>Stock</span>
              <span className="sb-badge-red">{stockLbl}</span>
            </div>
          </div>

          <div className="sb-divider" />

          <div className="sb-bill-info">
            <div className="sb-bill-amount" style={{ color: "#ea580c" }}>
              ₹{totals.NetAmt.toFixed(2)}
            </div>
            <div className="sb-bill-row"><label>Bill No</label><span>{billNo || "—"}</span></div>
            <div className="sb-bill-row">
              <label>Bill Date</label>
              <input type="date" className="sb-date-input" value={billDate} onChange={e => setBillDate(e.target.value)} />
            </div>
            {editId > 0 && <div style={{ fontSize: 10, color: "#16a34a", fontWeight: 700 }}>✏️ EDIT MODE</div>}
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="sb-content">

          {/* ── SALE GRID ── */}
          <div className="sb-grid-wrap">
            <div className="sb-grid-scroll">
              <table className="sb-tbl">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>S.No</th>
                    {visCols.map(c => (
                      <th key={c.key} style={{ width: c.width, minWidth: c.width, textAlign: RIGHT_KEYS.has(c.key) ? "right" : undefined }}>{c.label}</th>
                    ))}
                    <th style={{ width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row._rid} className={selRid === row._rid ? "sel" : ""} onClick={() => setSelRid(row._rid)}>
                      <td className="sb-sno">{idx + 1}</td>
                      {visCols.map(col => {
                        const m       = SALE_COLUMNS.find(c => c.key === col.key) || {};
                        const val     = row[col.key];
                        const isRight = RIGHT_KEYS.has(col.key);
                        const isRO    = !!m.readOnly;
                        const isFloat = m.type === "float";
                        const isInt   = m.type === "int";
                        const isAmt   = col.key === "Amount";

                        return (
                          <td key={col.key} style={{ textAlign: isRight ? "right" : undefined }}>
                            {isRO && col.key !== "ProductName" ? (
                              <span className="sb-cell-calc" style={{ display: "block", padding: "0 4px", color: isAmt ? "#ea580c" : undefined, fontWeight: isAmt ? 700 : undefined }}>
                                {isFloat && val ? f2(val).toFixed(2) : ns(val)}
                              </span>
                            ) : col.key === "ProductCode" ? (
                              <input
                                ref={el => regCell(row._rid, col.key, el)}
                                className="sb-cell-input"
                                value={ns(val)}
                                onChange={e => handleCellChange(row._rid, col.key, e.target.value.toUpperCase())}
                                onKeyDown={e => handleCellKeyDown(e, row._rid, col.key)}
                                onFocus={() => setSelRid(row._rid)}
                                placeholder="Code / Barcode"
                                style={{ width: "100%", boxSizing: "border-box" }}
                              />
                            ) : col.key === "ProductName" ? (
                              <input
                                ref={el => regCell(row._rid, col.key, el)}
                                className="sb-cell-input"
                                value={ns(val)}
                                readOnly
                                style={{ width: "100%", boxSizing: "border-box", background: "transparent", border: "none", cursor: "default", color: "#475569" }}
                                placeholder="—"
                              />
                            ) : col.key === "SalesManCode" ? (
                              <SmCodeCell
                                ref={el => regCell(row._rid, col.key, el)}
                                salesmen={salesmen}
                                value={row.SalesManCode || ""}
                                onChange={v => handleCellChange(row._rid, "SalesManCode", v)}
                                onKeyDown={e => handleCellKeyDown(e, row._rid, col.key)}
                                onFocus={() => setSelRid(row._rid)}
                              />
                            ) : (isFloat || isInt) ? (
                              <input
                                ref={el => regCell(row._rid, col.key, el)}
                                className={`sb-cell-input${isRight ? " right" : ""}`}
                                type="number"
                                step={isInt ? "1" : (col.key === "ItemQty" && row.UOMDecimal === 0 ? "1" : "0.01")}
                                value={val === 0 && !row.ProductRefId ? "" : (val ?? "")}
                                onChange={e => handleCellChange(row._rid, col.key, e.target.value)}
                                onKeyDown={e => handleCellKeyDown(e, row._rid, col.key)}
                                onFocus={() => {
                                  setSelRid(row._rid);
                                  if (col.key === "SaleRate") unlockedRidRef.current = null;
                                }}
                                onBlur={() => { if (col.key === "SaleRate") handleSaleRateBlur(row._rid); }}
                                placeholder={isInt ? "0" : "0.00"}
                                style={{ width: "100%", boxSizing: "border-box" }}
                              />
                            ) : (
                              <input
                                ref={el => regCell(row._rid, col.key, el)}
                                className="sb-cell-input"
                                value={ns(val)}
                                onChange={e => handleCellChange(row._rid, col.key, e.target.value)}
                                onKeyDown={e => handleCellKeyDown(e, row._rid, col.key)}
                                onFocus={() => setSelRid(row._rid)}
                                placeholder={col.label}
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

          {/* ── PAYMENT SIDE PANEL ── */}
          <div className="sb-payment-panel">
            <div className="sb-pay-grid">
              <div className="sb-pay-hdr" style={{ color: "#ea580c" }}>📋 Estimate Settlement</div>
              <table className="sb-pay-tbl">
                <thead><tr><th>Payment Type</th><th className="right">Amount</th></tr></thead>
                <tbody>
                  {payRows.map((p, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 12, fontWeight: 600 }}>{p.Saletype}</td>
                      <td>
                        <input className="sb-pay-input" type="number" step="0.01"
                          ref={el => { payInputRefs.current[i] = el; }}
                          value={p.Amount}
                          onChange={e => setPayRows(prev => prev.map((r, j) => j === i ? { ...r, Amount: e.target.value } : r))}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (i < payRows.length - 1) {
                                const filled = payRows.slice(0, i + 1).reduce((s, r) => s + vn(r.Amount), 0);
                                const rem = f2(totals.NetAmt - filled);
                                if (rem > 0) setPayRows(prev => prev.map((r, j) => j === i + 1 ? { ...r, Amount: rem.toFixed(2) } : r));
                                setTimeout(() => payInputRefs.current[i + 1]?.focus(), 10);
                              } else {
                                remarksRef.current?.focus();
                              }
                            }
                          }}
                          placeholder="0.00" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: "4px 8px" }}>
                <div className="sb-recv-amt">Received: ₹{payTotals.recvd.toFixed(2)}</div>
                <div className="sb-topay-amt">{payTotals.toPay >= 0 ? "Balance" : "Return"}: ₹{Math.abs(payTotals.toPay).toFixed(2)}</div>
              </div>
              <div className="sb-remarks-wrap">
                <input className="sb-remarks-input" placeholder="Remarks..." ref={remarksRef}
                  value={remarks} onChange={e => setRemarks(e.target.value.toUpperCase())}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); doSave(); } }} />
              </div>
            </div>

            <div className="sb-totals">
              <div className="sb-total-row"><label>Gross Amt</label><span>{totals.GrossAmt.toFixed(2)}</span></div>
              <div className="sb-total-row"><label>Disc Amt</label><span>{totals.DiscAmt.toFixed(2)}</span></div>
              <div className="sb-total-row"><label>GST Amt</label><span>{totals.GSTAmt.toFixed(2)}</span></div>
              <div className="sb-total-row"><label>CESS Amt</label><span>{totals.CESSAmt.toFixed(2)}</span></div>
              <div className="sb-total-row">
                <label>Others(+)</label>
                <input className="sb-pay-input" style={{ width: 70 }} type="number" step="0.01"
                  value={otherPlus} onChange={e => setOtherPlus(e.target.value)} placeholder="0.00" />
              </div>
              <div className="sb-total-row">
                <label>Others(-)</label>
                <input className="sb-pay-input" style={{ width: 70 }} type="number" step="0.01"
                  value={otherMinus} onChange={e => setOtherMinus(e.target.value)} placeholder="0.00" />
              </div>
              <div className="sb-total-sep" />
              <div className="sb-total-row net">
                <label>Net Total</label>
                <span style={{ color: "#ea580c" }}>₹{totals.NetAmt.toFixed(2)}</span>
              </div>
            </div>

            {/* GST Split */}
            {gstSplit.length > 0 && (
              <div style={{ background: "#fff", border: "1px solid #c5d8f8", borderRadius: 6, overflow: "hidden", flexShrink: 0, maxHeight: 72, display: "flex", flexDirection: "column" }}>
                <div style={{ background: "#1b3a8f", color: "#fff", fontSize: 10.5, fontWeight: 700, padding: "3px 10px", flexShrink: 0 }}>GST Split</div>
                <div style={{ overflowY: "auto", flex: 1 }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
                    <thead><tr>{["GST%", "GST Amt", "CGST", "SGST"].map(h => <th key={h} style={{ background: "#2d4a9f", color: "#fff", fontSize: 9.5, padding: "2px 6px", border: "1px solid rgba(255,255,255,.15)", textAlign: "right", position: "sticky", top: 0 }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {gstSplit.map((g, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? "#f8faff" : "#fff" }}>
                          <td style={{ padding: "2px 6px", border: "1px solid #eaecf4", textAlign: "center", fontSize: 10.5 }}>{g.TaxPercent}%</td>
                          <td style={{ padding: "2px 6px", border: "1px solid #eaecf4", textAlign: "right", fontSize: 10.5 }}>{f2(g.TaxAmt).toFixed(2)}</td>
                          <td style={{ padding: "2px 6px", border: "1px solid #eaecf4", textAlign: "right", fontSize: 10.5 }}>{f2(g.CTAmount).toFixed(2)}</td>
                          <td style={{ padding: "2px 6px", border: "1px solid #eaecf4", textAlign: "right", fontSize: 10.5 }}>{f2(g.STAmount).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Bottom info bar */}
            <div style={{ background: "#fff", border: "1px solid #c5d8f8", borderRadius: 6, padding: "6px 10px", flexShrink: 0, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 600, color: "#4a5568" }}>Item Qty</span>
                  <span style={{ background: "#e8f0fe", color: "#1f65de", fontWeight: 800, fontSize: 13, borderRadius: 4, padding: "1px 10px", border: "1px solid #c5d8f8" }}>
                    {totalQty % 1 === 0 ? totalQty.toFixed(0) : totalQty.toFixed(2)}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 600, color: "#4a5568" }}>Count</span>
                  <span style={{ background: "#e8f0fe", color: "#1f65de", fontWeight: 800, fontSize: 13, borderRadius: 4, padding: "1px 10px", border: "1px solid #c5d8f8" }}>
                    {itemCount}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, color: "#4a5568", fontSize: 11 }}>Last Estimate No</span>
                <span style={{ fontWeight: 700, color: "#1a2e4a", fontSize: 11 }}>{lastBillNo}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, color: "#4a5568", fontSize: 11 }}>Last Amount</span>
                <span style={{ fontWeight: 700, color: "#16a34a", fontSize: 11 }}>{lastBillAmt > 0 ? `₹${lastBillAmt.toFixed(2)}` : "None"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── BOTTOM TOOLBAR ── */}
        <div className="sb-toolbar">
          <button className="sb-btn sv" onClick={doSave} disabled={loading} style={{ background: "#fff7ed", border: "1px solid #fed7aa", color: "#ea580c" }}>
            💾 F1 Save Estimate
          </button>
          <button className="sb-btn" onClick={openF5}>📋 F5 View</button>
          <button className="sb-btn" onClick={() => navigate("/Sale")}
            style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", fontWeight: 700 }}>
            🧾 F8 Sale Bill
          </button>
          <button className="sb-btn" onClick={applyBillDiscount}>
            Disc%:
            <input style={{ width: 50, border: "1px solid #c5d8f8", borderRadius: 3, fontSize: 11, padding: "1px 4px", marginLeft: 3 }}
              type="number" step="0.01" value={discPer} onChange={e => setDiscPer(e.target.value)} onClick={e => e.stopPropagation()} />
            <span style={{ marginLeft: 2 }}>Apply</span>
          </button>
          <button className="sb-btn" onClick={() => setF12Open(true)}>⚙ F12 Columns</button>
          <button className="sb-btn" onClick={() => setCtrlGOpen(true)} title="Ctrl+G Column Focus/Reorder">⚡ Ctrl+G</button>
          <button className="sb-btn" onClick={clearForm} disabled={loading}>🔄 F10 Clear</button>
          {editId > 0 && (
            <button className="sb-btn dl"
              onClick={() => { pwOkRef.current = doDeleteBill; setPw({ title: "F9 Delete Password" }); }}
              disabled={loading}>🗑 F9 Delete</button>
          )}
          <button className="sb-btn dl" onClick={() => navigate(-1)}>✕ Esc Exit</button>
          {loading && <span style={{ fontSize: 11, color: "#6b7a99" }}>⏳ {ldMsg}</span>}
        </div>
      </div>

      {/* ── LOADING OVERLAY ── */}
      {loading && (
        <div className="sb-loader-ov">
          <div className="sb-ldr-box"><div className="sb-spin" /><div className="sb-ldr-msg">{ldMsg}</div></div>
        </div>
      )}

      {/* ── MODALS ── */}
      {pw && (
        <PwModal title={pw.title} comid={sess.Comid}
          onOk={() => { pwOkRef.current?.(); }}
          onClose={() => setPw(null)} />
      )}

      {/* ── BATCH POPUP ── */}
      {batchPopup && (
        <BatchPopup
          batches={batchPopup.batches}
          onSelect={item => fillBatchItemIntoRow(batchPopup.rid, item)}
          onClose={() => setBatchPopup(null)}
        />
      )}

      {/* ── EXPIRY DATE LIST POPUP ── */}
      {expiryListPopup && (
        <ExpiryDateListPopup
          expiryList={expiryListPopup.list}
          onSelect={item => {
            const rid = expiryListPopup.rid;
            setRows(prev => prev.map(r =>
              r._rid !== rid ? r : {
                ...r,
                MfgDate:    item.MFDate  || "",
                ExpDate:    item.ExpDate || "",
                Bat_No:     item.BatchNo || r.Bat_No || "",
                BatchRefid: item.Batchid || r.BatchRefid || null,
                StockQty:   vn(item.Stock),
                _dirty: true,
              }
            ));
            setStockLbl(vn(item.Stock).toFixed(0));
            setExpiryListPopup(null);
            setTimeout(() => {
              const el = cellRefs.current[rid]?.["ItemQty"];
              if (el) { el.focus(); el.select?.(); }
            }, 50);
          }}
          onClose={() => setExpiryListPopup(null)}
        />
      )}

      {f12Open && (
        <F12Popup colSettings={colSettings} comid={sess.Comid} toast={toast}
          onSave={newCols => { setColSettings(newCols); setF12Open(false); }}
          onClose={() => setF12Open(false)} />
      )}

      {ctrlGOpen && (
        <CtrlGFocusPopup
          colSettings={colSettings}
          comid={sess.Comid}
          mcomid={sess.MComid}
          toast={toast}
          onSaved={() => loadFocusCols(sess.MComid)}
          onClose={() => setCtrlGOpen(false)}
        />
      )}

      {custPopup && (
        <CustomerSearchPopup customers={customers} onSelect={handleCustomerSelect} onClose={() => setCustPopup(false)} />
      )}

      {prodPopup && (
        <ProductSearchPopup products={prodList} onSelect={item => { fillItemIntoRow(prodPopup.rid, item); }} onClose={() => setProdPopup(null)} anchorPos={prodPopup.pos} />
      )}

      {f5Open && (
        <F5ViewModal rows={f5Rows} onEdit={doEditBill} onClose={() => setF5Open(false)}
          fromDate={billDate} toDate={billDate} onSearch={openF5} isEstimate={isEstimate} />
      )}

      <CC.ToastList toasts={toasts} />
    </div>
  );
}