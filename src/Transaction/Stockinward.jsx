// ─────────────────────────────────────────────────────────────────────────────
//  StockInward.jsx  —  React Stock Inward / Outward / Transfer Form
//  Full port of stockinward.js logic with SaleReturn.jsx design pattern.
//
//  MODES  : Inward | Outward | Transfer  (radio button at top)
//  HOTKEYS: F1=Save  F3=Edit  F5=View  F9=Delete  F10=Clear  F12=ColConfig
//           Ctrl+F=Form Focus  Ctrl+G=Grid Focus  F2=PO Load  F6=Purchase Load
//           F4=Download Excel  F7=Upload Excel  F11=SaleOrder
//           ESC=Quit
//
//  BatchWise Stock: Brand / Model / Color / Size / Gender / ToSize columns
//  mirrored from stockinward.js loadgrid() combobox column definitions.
//
//  FIX: removed the broken `focusEnabledCols` useMemo block. It referenced an
//  undeclared `focusCols` state variable (only `focusColsRef`, a useRef, exists
//  in this file), which threw a ReferenceError on every render and crashed the
//  component. The memo's output was also never consumed anywhere else — grid
//  navigation (handleCellKeyDown) already reads focusColsRef.current directly —
//  so removing it is safe and fixes the crash with no behavior change.
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../components/Common";
import "../TransactionStyle/SaleBill.css";
import "./Stockinward.css";
import Topbar from "../components/Topbar";
import   DateFieldDDMMYYYY from "../Commondatetime";

// ─── GRID COLUMNS DEFINITION ─────────────────────────────────────────────────
// Mirrors stockinward.js InVisibleColumns + BatchWise combobox columns from loadgrid()
const GRID_COLUMNS = [
  { key: "ProductCode", label: "Product Code",  width: 130, hidden: false },
  { key: "ProductName", label: "Description",   width: 260, hidden: false, readOnly: true },
  { key: "UOM",         label: "UOM",           width: 70,  hidden: true,  readOnly: true },
  { key: "StockQty",    label: "Stock Qty",     width: 90,  hidden: true,  readOnly: true, type: "float" },
  { key: "ItemQty",     label: "Quantity",      width: 90,  hidden: false, type: "float" },
  { key: "Noms",        label: "Bags",          width: 80,  hidden: true,  type: "int" },
  { key: "NomsQty",     label: "NomsQty",       width: 80,  hidden: true,  readOnly: true, type: "float" },
  { key: "MRP",         label: "MRP",           width: 90,  hidden: true,  type: "float" },
  { key: "PurRate",     label: "Pur.Rate",      width: 100, hidden: false, type: "float" },
  { key: "landingCost", label: "Landing Cost",  width: 100, hidden: true,  type: "float" },
  { key: "SaleRate",    label: "SaleRate",      width: 100, hidden: true,  type: "float" },
  { key: "NomsRate",    label: "POQty",         width: 90,  hidden: false, type: "float" },
  { key: "ProfitAmt",   label: "BalQty",        width: 90,  hidden: false, readOnly: true, type: "float" },
  { key: "ProfitPer",   label: "Profit(%)",     width: 85,  hidden: true,  type: "float" },
  { key: "SaleDiscPer", label: "Sale Disc(%)",  width: 85,  hidden: true,  type: "float" },
  { key: "SaleDiscAmt", label: "Sale DiscAmt",  width: 90,  hidden: true,  type: "float" },
  { key: "NetSaleRate", label: "Net SaleRate",  width: 90,  hidden: true,  readOnly: true, type: "float" },
  { key: "Bat_No",      label: "Batch No",      width: 100, hidden: true },
  { key: "ExpiryDate",  label: "Expiry Date",   width: 100, hidden: true },
  { key: "MfgDate",     label: "Mfg Date",      width: 100, hidden: true },
  { key: "Revised",     label: "Narration",     width: 130, hidden: true },
  // ── BatchWise columns (mirrors jQuery loadgrid combobox definitions) ────────
  { key: "BrandId",     label: "Brand",         width: 110, hidden: true,  batchOnly: true, type: "combo" },
  { key: "ModelId",     label: "Model",         width: 110, hidden: true,  batchOnly: true, type: "combo" },
  { key: "ColorId",     label: "Color",         width: 110, hidden: true,  batchOnly: true, type: "combo" },
  { key: "SizeId",      label: "Size",          width: 100, hidden: true,  batchOnly: true, type: "combo" },
  { key: "ToSizeId",    label: "To Size",       width: 100, hidden: true,  batchOnly: true, type: "combo" },
  { key: "GengerId",    label: "Gender",        width: 100, hidden: true,  batchOnly: true, type: "combo" },
  { key: "SizeDiff",    label: "Size Diff",     width: 80,  hidden: true,  type: "float" },
  { key: "Sizeper",     label: "Size(%)",       width: 80,  hidden: true,  type: "float" },
  { key: "SizeAmt",     label: "Size Amt",      width: 80,  hidden: true,  type: "float" },
  { key: "Amount",      label: "Amount",        width: 100, hidden: false, readOnly: true, type: "float" },
];

const DEFAULT_COL_SETTINGS = GRID_COLUMNS.map(c => ({
  key: c.key, label: c.label, width: c.width, visible: !c.hidden,
}));

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const vn    = v => parseFloat(v) || 0;
const f2    = v => parseFloat(vn(v).toFixed(2));
const ns    = v => (v == null ? "" : String(v));
const today = () => new Date().toISOString().slice(0, 10);

let _rid = 5000;
const genRid = () => ++_rid;

// ─── ROW FACTORY ──────────────────────────────────────────────────────────────
const mkRow = () => ({
  _rid: genRid(), _isNew: true, _dirty: false,
  PDId: 0, ProductRefId: 0, ProductCode: "", ProductName: "",
  MRP: 0, PurRate: 0, landingCost: 0, SaleRate: 0,
  ItemQty: "", Noms: 0, NomsQty: 0, UOMDecimal: 0, UOM: "",
  StockQty: 0, Bat_No: "", BatchRefid: 0, BatchStatus: 0,
  ProfitPer: 0, ProfitAmt: 0, SaleDiscPer: 0, SaleDiscAmt: 0,
  NetSaleRate: 0, NomsRate: 0, SaleRateorg: 0,
  Amount: 0, NStock: 0, RealQty: 0,
  ExpiryDate: "", MfgDate: "", Revised: "",
  SerialNoType: 0, SerialNoStatus: 0,
  // BatchWise fields — mirrors jQuery grdBrandId, grdModelId, grdColorId, grdSizeId, grdGengerId, grdToSizeId
  SizeId: 0, BrandId: 0, ModelId: 0, ColorId: 0, GengerId: 0, ToSizeId: 0,
  SizeCombo: "", BrandCombo: "", ModelCombo: "", ColorCombo: "", GengerCombo: "", ToSizeCombo: "",
  SizeDiff: 0, Sizeper: 0, SizeAmt: 0,
  ToSizeId: 0, SizeDiff: 0, Sizeper: 0, SizeAmt: 0,
  TextRefId: "", UOMRefid: 0, StockQtyNew: 0, EditMode: 0,
});
function BatchPopup({ batches, onSelect, onClose }) {
  const [hilite, setHilite] = React.useState(0);
  const listRef = React.useRef(null);
 
  React.useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${hilite}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [hilite]);
 
  // Keyboard support
  React.useEffect(() => {
    const onKey = e => {
      if (e.key === "ArrowDown")  { e.preventDefault(); setHilite(h => Math.min(h + 1, batches.length - 1)); }
      if (e.key === "ArrowUp")    { e.preventDefault(); setHilite(h => Math.max(h - 1, 0)); }
      if (e.key === "Enter")      { e.preventDefault(); if (batches[hilite]) onSelect(batches[hilite]); }
      if (e.key === "Escape")     { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hilite, batches, onSelect, onClose]);
 
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(10,20,40,.45)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9800,
    }}>
      <div style={{
        background: "#fff", borderRadius: 10, width: 620, maxHeight: 460,
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: "0 16px 48px rgba(31,101,222,.22)", border: "1px solid #d0ddf5",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg,#1b3a8f 0%,#1f65de 100%)",
          padding: "10px 14px", display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", flex: 1 }}>
            📦 Select Batch
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,.65)",
            background: "rgba(255,255,255,.15)", borderRadius: 10, padding: "2px 8px",
          }}>
            {batches.length} batches
          </span>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,.15)", border: "none", color: "#fff",
            width: 22, height: 22, borderRadius: "50%", cursor: "pointer", fontSize: 11,
          }}>✕</button>
        </div>
 
        {/* Column headers */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "130px 1fr 90px 90px 90px 100px",
          padding: "4px 10px", background: "#f0f4fc",
          borderBottom: "1px solid #dde6f5",
          fontSize: 9.5, fontWeight: 700, color: "#6b7a99",
          letterSpacing: ".4px", textTransform: "uppercase",
        }}>
          <span>Batch No</span>
          <span>Product</span>
          <span style={{ textAlign: "right" }}>MRP</span>
          <span style={{ textAlign: "right" }}>Pur.Rate</span>
          <span style={{ textAlign: "right" }}>Stock</span>
          <span>Expiry</span>
        </div>
 
        {/* Rows */}
        <div ref={listRef} style={{ overflowY: "auto", flex: 1 }}>
          {batches.length === 0 ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: 20, fontSize: 12 }}>
              No batches found
            </div>
          ) : batches.map((b, idx) => (
            <div
              key={b.Batchid || b.BatchRefid || idx}
              data-idx={idx}
              onClick={() => onSelect(b)}
              onMouseEnter={() => setHilite(idx)}
              style={{
                display: "grid",
                gridTemplateColumns: "130px 1fr 90px 90px 90px 100px",
                padding: "6px 10px", cursor: "pointer",
                borderBottom: "1px solid #f3f5fb",
                background: idx === hilite ? "#deeafb" : idx % 2 === 0 ? "#fff" : "#fafbff",
                borderLeft: idx === hilite ? "3px solid #1f65de" : "3px solid transparent",
                fontSize: 11.5, alignItems: "center",
              }}
            >
              <span style={{ color: "#1f65de", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {b.BatchNo || b.Bat_No || "—"}
              </span>
              <span style={{ color: "#1a2e4a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {b.ProductName || ""}
              </span>
              <span style={{ textAlign: "right", color: "#475569" }}>
                ₹{parseFloat(b.MRP || 0).toFixed(2)}
              </span>
              <span style={{ textAlign: "right", color: "#16a34a", fontWeight: 600 }}>
                ₹{parseFloat(b.PurchaseRate || b.PurRate || 0).toFixed(2)}
              </span>
              <span style={{
                textAlign: "right", fontWeight: 700,
                color: parseFloat(b.Stock || 0) <= 0 ? "#dc2626" : "#1a2e4a",
              }}>
                {parseFloat(b.Stock || 0).toFixed(0)}
              </span>
              <span style={{ color: "#8b5cf6", fontSize: 10.5 }}>
                {b.ExpiryDate || b.ExpDate ? String(b.ExpiryDate || b.ExpDate).slice(0, 10) : "—"}
              </span>
            </div>
          ))}
        </div>
 
        {/* Footer hints */}
        <div style={{
          display: "flex", gap: 14, padding: "5px 12px",
          background: "#f8faff", borderTop: "1px solid #eaecf4",
        }}>
          {[["↑↓", "Navigate"], ["Enter", "Select"], ["Esc", "Close"]].map(([k, l]) => (
            <span key={k} style={{ fontSize: 9.5, color: "#8b99b5", display: "flex", alignItems: "center", gap: 3 }}>
              <kbd style={{
                background: "#1f65de", color: "#fff", fontSize: 8.5,
                fontWeight: 700, padding: "1px 4px", borderRadius: 2,
              }}>{k}</kbd>
              {l}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
 

 


const fmtRow = obj => ({
  ...mkRow(), ...obj,
  _rid: obj._rid || genRid(), _isNew: false, _dirty: false,
  MRP:         f2(vn(obj.MRP)),
  PurRate:     f2(vn(obj.PurRate || obj.PurchaseRate)),
  landingCost: f2(vn(obj.landingCost || obj.LandingCost)),
  SaleRate:    f2(vn(obj.SaleRate)),
  ProfitPer:   f2(vn(obj.ProfitPer)),
  ProfitAmt:   f2(vn(obj.ProfitAmt)),
  SaleDiscPer: f2(vn(obj.SaleDiscPer)),
  SaleDiscAmt: f2(vn(obj.SaleDiscAmt)),
  SizeDiff:    f2(vn(obj.SizeDiff)),
  Sizeper:     f2(vn(obj.Sizeper)),
  SizeAmt:     f2(vn(obj.SizeAmt)),
  NomsRate:    f2(vn(obj.NomsRate)),
  Amount:      f2(vn(obj.Amount)),
  // Preserve BatchWise IDs
  BrandId:  vn(obj.BrandId)  || 0,
  ModelId:  vn(obj.ModelId)  || 0,
  ColorId:  vn(obj.ColorId)  || 0,
  SizeId:   vn(obj.SizeId)   || 0,
  GengerId: vn(obj.GengerId) || 0,
  ToSizeId: vn(obj.ToSizeId) || 0,
  ItemQty: (() => {
    const d = vn(obj.UOMDecimal);
    const q = vn(obj.ItemQty);
    return d === 0 ? q.toFixed(0) : d === 2 ? q.toFixed(2) : q.toFixed(3);
  })(),
  StockQty: (() => {
    const d = vn(obj.UOMDecimal);
    const q = vn(obj.StockQty);
    return d === 0 ? q.toFixed(0) : d === 2 ? q.toFixed(2) : q.toFixed(3);
  })(),
});

// ─── ROW AMOUNT CALCULATION ───────────────────────────────────────────────────
function calcRowAmount(row, mode) {
  const qty = vn(row.ItemQty);
  if (!row.ProductRefId || qty === 0) return { ...row, Amount: 0 };
  let amt = 0;
  if (mode === "inward")   amt = f2(vn(row.PurRate)  * qty);
  if (mode === "outward")  amt = f2(vn(row.SaleRate) * qty);
  if (mode === "transfer") amt = f2(vn(row.SaleRate) * qty);
  const profitAmt = vn(row.NomsRate) !== 0
    ? f2(vn(row.NomsRate) - qty)
    : vn(row.ProfitAmt);
  return { ...row, Amount: amt, ProfitAmt: profitAmt, StockQtyNew: qty };
}

// ─── COMBOBOX COMPONENT ───────────────────────────────────────────────────────
function ComboBox({ options = [], value, onChange, onEnterKey, placeholder, style, inputRef: extRef, disabled }) {
  const [q, setQ]           = useState("");
  const [open, setOpen]     = useState(false);
  const [hilite, setHilite] = useState(0);
  const wrapRef = useRef(null);
  const inpRef  = useRef(null);
  const listRef = useRef(null);
  const ref     = extRef || inpRef;

  const selectedLabel = useMemo(
    () => options.find(o => String(o.value) === String(value))?.label || "",
    [options, value]
  );
  const filtered = useMemo(
    () => options.filter(o => o.label?.toUpperCase().includes(q.toUpperCase())).slice(0, 150),
    [options, q]
  );

  useEffect(() => { setHilite(0); }, [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${hilite}"]`)?.scrollIntoView({ block: "nearest" });
  }, [hilite]);
  useEffect(() => {
    const h = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false); setQ(selectedLabel);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [selectedLabel]);

  const pick = opt => { onChange(String(opt.value)); setQ(opt.label); setOpen(false); };

  return (
    <div ref={wrapRef} style={{ position: "relative", flex: 1, minWidth: 0, ...style }}>
      <input ref={ref} className="si-select"
        value={open ? q : selectedLabel}
        placeholder={placeholder} autoComplete="off" disabled={disabled}
        onFocus={() => { setQ(selectedLabel); setOpen(true); setHilite(0); }}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={e => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHilite(h => Math.min(h + 1, filtered.length - 1)); }
          if (e.key === "ArrowUp")   { e.preventDefault(); setHilite(h => Math.max(h - 1, 0)); }
          if (e.key === "Enter")     { e.preventDefault(); if (open && filtered[hilite]) pick(filtered[hilite]); else onEnterKey?.(); }
          if (e.key === "Escape")    { setOpen(false); setQ(selectedLabel); }
        }}
        style={{ width: "100%", cursor: disabled ? "not-allowed" : "text" }}
      />
      {open && !disabled && filtered.length > 0 && (
        <div ref={listRef} style={{
          position: "absolute", top: "100%", left: 0, right: 0,
          background: "#fff", border: "1px solid #c5d8f8",
          borderRadius: 4, zIndex: 9999, maxHeight: 220, overflowY: "auto",
          boxShadow: "0 8px 24px rgba(31,101,222,.15)",
        }}>
          {filtered.map((opt, idx) => (
            <div key={opt.value} data-idx={idx}
              onMouseDown={() => pick(opt)}
              onMouseEnter={() => setHilite(idx)}
              style={{
                padding: "5px 10px", fontSize: 12, cursor: "pointer",
                background: idx === hilite ? "#deeafb" : idx % 2 === 0 ? "#fff" : "#fafbff",
                borderLeft: idx === hilite ? "3px solid #1f65de" : "3px solid transparent",
                color: "#1a2e4a", fontWeight: idx === hilite ? 600 : 400,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ── Fetch StockDetails for a specific record before delete ────────────────────

// ─── INLINE SELECT for BatchWise grid cells ───────────────────────────────────
function GridSelect({ options, value, onChange, onKeyDown, cellId, onFocus }) {
  return (
    <select
      id={cellId}
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      style={{
        width: "100%", height: 24, border: "1px solid #c5d8f8",
        borderRadius: 3, fontSize: 11, outline: "none",
        background: "transparent", color: "#1a2e4a",
      }}
    >
      <option value="">--</option>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ─── PASSWORD MODAL ───────────────────────────────────────────────────────────
function PwModal({ title, comid, onOk, onClose }) {
  const [val, setVal] = useState("");
  const verify = async () => {
    if (!val) return;
    const res = await CC.api(CC.CFG_EditPwd, null, {}, { password: val, type: "EditPassword", Comid: comid });
    if (res.ok ?? res.IsSuccess ?? false) { onOk(); onClose(); }
    else window.alert("Invalid Password !!!");
  };
  return (
    <div className="si-overlay" style={{ zIndex: 99999 }}>
      <div className="si-modal" style={{ width: 300, padding: "22px 26px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "#1f65de" }}>🔐 {title}</div>
        <input type="password" autoFocus value={val} placeholder="Enter password…"
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") verify(); if (e.key === "Escape") onClose(); }}
          style={{ width: "100%", padding: "7px 10px", border: "1px solid #c5d8f8", borderRadius: 4, fontSize: 13, marginBottom: 14, outline: "none" }}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="si-btn" onClick={onClose}>Cancel</button>
          <button className="si-btn sv" onClick={verify}>OK</button>
        </div>
      </div>
    </div>
  );
}

// ─── PRODUCT SEARCH POPUP ─────────────────────────────────────────────────────
function ProductSearchPopup({ products, onSelect, onClose }) {
  const [q, setQ]           = useState("");
  const [hilite, setHilite] = useState(0);
  const inputRef = useRef(null);
  const listRef  = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 30); }, []);
  const filtered = useMemo(() => products.filter(p =>
    String(p.ProductName || p.PName || "").toLowerCase().includes(q.toLowerCase()) ||
    String(p.ProductCode || p.Prod_Code || "").toLowerCase().includes(q.toLowerCase())
  ).slice(0, 120), [products, q]);

  useEffect(() => { setHilite(0); }, [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${hilite}"]`)?.scrollIntoView({ block: "nearest" });
  }, [hilite]);

  return (
    <div style={{
      position: "fixed", top: 120, left: 80, zIndex: 9800,
      background: "#fff", border: "1px solid #c5d8f8", borderRadius: 8,
      width: 820, height: "80vh", display: "flex", flexDirection: "column",
      boxShadow: "0 16px 48px rgba(31,101,222,.2)",
    }}>
      <div style={{
        background: "linear-gradient(135deg,#1b3a8f,#1f65de)", padding: "8px 14px",
        borderRadius: "8px 8px 0 0", display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 13, flex: 1 }}>🔍 Product Search</span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,.65)", background: "rgba(255,255,255,.15)", padding: "2px 8px", borderRadius: 10 }}>
          {filtered.length} items
        </span>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", width: 22, height: 22, borderRadius: "50%", cursor: "pointer", fontSize: 11 }}>✕</button>
      </div>
      <div style={{ padding: "6px 10px", borderBottom: "1px solid #edf0f7", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "#7895c8", fontSize: 16 }}>⌕</span>
        <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
          placeholder="Type code or product name…"
          style={{ flex: 1, border: "none", outline: "none", fontSize: 12, color: "#1a2e4a" }}
          onKeyDown={e => {
            if (e.key === "ArrowDown")  { e.preventDefault(); setHilite(h => Math.min(h + 1, filtered.length - 1)); }
            if (e.key === "ArrowUp")    { e.preventDefault(); setHilite(h => Math.max(h - 1, 0)); }
            if (e.key === "Enter")      { if (filtered[hilite]) onSelect(filtered[hilite]); }
            if (e.key === "Escape")     { onClose(); }
          }}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 90px 80px 80px", background: "#f0f4fc", padding: "4px 10px", fontSize: 10.5, fontWeight: 700, color: "#4a5568", borderBottom: "1px solid #dde6f5" }}>
        <span>Code</span><span>Name</span><span style={{ textAlign: "right" }}>Pur.Rate</span>
        <span style={{ textAlign: "right" }}>Sale Rate</span><span style={{ textAlign: "right" }}>Stock</span>
      </div>
      <div ref={listRef} style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0
          ? <div style={{ textAlign: "center", color: "#94a3b8", padding: 20, fontSize: 12 }}>No products found</div>
          : filtered.map((p, idx) => (
            <div key={p.Id} data-idx={idx} onClick={() => onSelect(p)} onMouseEnter={() => setHilite(idx)}
              style={{
                display: "grid", gridTemplateColumns: "110px 1fr 90px 80px 80px",
                padding: "5px 10px", fontSize: 12, cursor: "pointer",
                background: idx === hilite ? "#deeafb" : idx % 2 === 0 ? "#fff" : "#fafbff",
                borderLeft: idx === hilite ? "3px solid #1f65de" : "3px solid transparent",
                borderBottom: "1px solid #f3f5fb",
              }}>
              <span style={{ fontWeight: 600, color: "#4a5568", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.ProductCode || p.Prod_Code}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#1a2e4a" }}>{p.ProductName || p.PName}</span>
              <span style={{ textAlign: "right", color: "#1a2e4a" }}>₹{f2(vn(p.PurchaseRate)).toFixed(2)}</span>
              <span style={{ textAlign: "right", color: "#1a2e4a" }}>₹{f2(vn(p.SalesRate || p.SaleRate)).toFixed(2)}</span>
              <span style={{ textAlign: "right", color: vn(p.Stock) < 0 ? "#dc2626" : "#16a34a", fontWeight: 600 }}>{vn(p.Stock).toFixed(0)}</span>
            </div>
          ))
        }
      </div>
      <div style={{ background: "#f8faff", borderTop: "1px solid #edf0f7", padding: "5px 12px", display: "flex", gap: 14, fontSize: 10.5, color: "#6b7a99" }}>
        <span><kbd style={{ background: "#1f65de", color: "#fff", padding: "1px 5px", borderRadius: 3, fontSize: 9.5 }}>↑↓</kbd> Navigate</span>
        <span><kbd style={{ background: "#1f65de", color: "#fff", padding: "1px 5px", borderRadius: 3, fontSize: 9.5 }}>Enter</kbd> Select</span>
        <span><kbd style={{ background: "#1f65de", color: "#fff", padding: "1px 5px", borderRadius: 3, fontSize: 9.5 }}>Esc</kbd> Close</span>
      </div>
    </div>
  );
}

// ─── F5 VIEW MODAL ────────────────────────────────────────────────────────────
function F5ViewModal({ rows, mode, onEdit, onDelete, onClose, fromDate, toDate, onSearch }) {
  const [from, setFrom] = useState(fromDate);
  const [to,   setTo]   = useState(toDate);
  const total = rows.reduce((s, r) => s + vn(r.NetAmt || r.NetAmount || r.Netamt), 0);
  const modeLabel = mode === "inward" ? "Inward" : mode === "outward" ? "Outward" : "Transfer";

  return (
    <div className="si-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="si-modal" style={{ width: 1000, height: "85vh", display: "flex", flexDirection: "column" }}>
        <div className="si-modal-hdr">
          <span>📋 Stock {modeLabel} View (F5)</span>
          <button onClick={onClose}>✕</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#f5f9ff", borderBottom: "1px solid #dde6f5", flexWrap: "wrap" }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#4a5568" }}>From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            style={{ height: 28, border: "1px solid #c5d8f8", borderRadius: 4, padding: "0 6px", fontSize: 12 }} />
          <label style={{ fontSize: 11, fontWeight: 700, color: "#4a5568" }}>To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            style={{ height: 28, border: "1px solid #c5d8f8", borderRadius: 4, padding: "0 6px", fontSize: 12 }} />
          <button className="si-btn sv" style={{ height: 28, padding: "0 14px", fontSize: 11 }}
            onClick={() => onSearch(from, to)}>🔍 Search</button>
          <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: 14 }}>
            Total : ₹{f2(total).toFixed(2)}
          </span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {["Stock No", "Stock Date", mode === "transfer" ? "Branch" : mode === "outward" ? "Customer" : "Supplier", "Amount", "Remarks", "Actions"].map(h => (
                  <th key={h} style={{ background: "#1b3a8f", color: "#fff", padding: "7px 10px", textAlign: h === "Amount" ? "right" : "left", position: "sticky", top: 0, zIndex: 2 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "#94a3b8", padding: 20 }}>No records found.</td></tr>}
              {rows.map((r, i) => (
                <tr key={r.Id || i} style={{ background: i % 2 === 0 ? "#fff" : "#fafbff", borderBottom: "1px solid #eaecf4" }}>
                  <td style={{ padding: "5px 10px", fontWeight: 700 }}>{r.PurchaseNo || r.StockNo || "—"}</td>
                  <td style={{ padding: "5px 10px" }}>{String(r.PurchaseDate || r.StockDate || "").slice(0, 10)}</td>
                  <td style={{ padding: "5px 10px" }}>{r.SupplierName || r.CustomerName || r.BranchName || ""}</td>
                  <td style={{ padding: "5px 10px", textAlign: "right", fontWeight: 700 }}>₹{f2(vn(r.NetAmt || r.NetAmount)).toFixed(2)}</td>
                  <td style={{ padding: "5px 10px", color: "#6b7a99" }}>{r.PurchaseType || r.Remarks || ""}</td>
                  <td style={{ padding: "5px 10px", textAlign: "center" }}>
                    <button onClick={() => onEdit(r.Id)} style={{ marginRight: 6, padding: "3px 10px", fontSize: 11, borderRadius: 4, border: "1px solid #c5d8f8", background: "#e8f0fe", color: "#1f65de", fontWeight: 600, cursor: "pointer" }}>✏ Edit</button>
                    <button onClick={() => onDelete(r.Id, r.PurchaseNo)} style={{ padding: "3px 10px", fontSize: 11, borderRadius: 4, border: "1px solid #fecaca", background: "#fee2e2", fontWeight: 600, cursor: "pointer" }}>🗑 Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 14px", borderTop: "1px solid #eaecf4", background: "#f8faff" }}>
          <button className="si-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
const bwNull = v => (v === 0 || v === "" || v == null) ? null : v;
// ─── F12 COLUMN SETTINGS MODAL ────────────────────────────────────────────────
function F12Modal({ colSettings, comid, onSave, onClose, toast, batchWise }) {
  const [local, setLocal] = useState(colSettings.map(c => ({ ...c })));
  const toggle = key => setLocal(p => p.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
  const setWid = (key, w) => setLocal(p => p.map(c => c.key === key ? { ...c, width: parseInt(w) || c.width } : c));

  const handleSave = async () => {
    const payload = local.map(c => ({
      Comid: parseInt(comid) || 1,
      filename: "StockInward",
      column: c.key, Visible: c.visible === true, Width: parseInt(c.width) || 100,
    }));
    try {
      const res = await CC.insertapi(CC.CFG_VisibleCols, payload);
      if (res.ok) { toast?.("✅ Column settings saved"); onSave(local); }
      else { toast?.("⚠️ " + (res.message || "Saved locally")); onSave(local); }
    } catch { onSave(local); }
  };

  // Filter batchOnly columns if BatchWise is off
  const displayCols = local.filter(c => {
    const base = GRID_COLUMNS.find(g => g.key === c.key);
    if (base?.batchOnly && !batchWise) return false;
    return true;
  });

  return (
    <div className="si-overlay">
      <div className="si-modal" style={{ width: 520, maxHeight: "82vh" }}>
        <div className="si-modal-hdr"><span>⚙ Grid Column Settings (F12)</span><button onClick={onClose}>✕</button></div>
        <div style={{ overflowY: "auto", maxHeight: "60vh" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
            <thead>
              <tr>
                {["Column", "Visible", "Width (px)"].map(h => (
                  <th key={h} style={{ background: "#1b3a8f", color: "#fff", padding: "6px 10px", textAlign: "left", position: "sticky", top: 0 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayCols.map((c, i) => {
                const base = GRID_COLUMNS.find(g => g.key === c.key);
                return (
                  <tr key={c.key} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                    <td style={{ padding: "5px 10px", borderBottom: "1px solid #eaecf4" }}>
                      {c.label}
                      {base?.batchOnly && (
                        <span style={{ marginLeft: 6, fontSize: 9.5, background: "#fef3c7", color: "#92400e", padding: "1px 5px", borderRadius: 8 }}>BatchWise</span>
                      )}
                    </td>
                    <td style={{ padding: "5px 10px", textAlign: "center", borderBottom: "1px solid #eaecf4" }}>
                      <input type="checkbox" checked={!!c.visible} onChange={() => toggle(c.key)} />
                    </td>
                    <td style={{ padding: "5px 10px", borderBottom: "1px solid #eaecf4" }}>
                      <input type="number" min={40} max={600} value={c.width}
                        style={{ width: 70, border: "1px solid #d4dbe8", borderRadius: 3, padding: "2px 6px", fontSize: 12, textAlign: "right" }}
                        onChange={e => setWid(c.key, e.target.value)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "10px 14px", borderTop: "1px solid #eaecf4", background: "#f8faff" }}>
          <button className="si-btn sv" onClick={handleSave}>💾 Save</button>
          <button className="si-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
 const sanitizeRowForInsert = row => ({
  ...row,
  BrandId:  bwNull(row.BrandId),
  ModelId:  bwNull(row.ModelId),
  ColorId:  bwNull(row.ColorId),
  SizeId:   bwNull(row.SizeId),
  GengerId: bwNull(row.GengerId),
  ToSizeId: bwNull(row.ToSizeId),
});
// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function StockInward() {
  const navigate               = useNavigate();
  const { confirm, ConfirmUI } = CC.useConfirm();
  const { toast, toasts }      = CC.useToast();

  // ── Session ──────────────────────────────────────────────────────────────
  const [sess] = useState(() => {
    try {
      const main0 = (CC.getLocal("Mainsetting")    || [{}])[0] || {};
      const com0  = (CC.getLocal("Companysetting") || [{}])[0] || {};
      const Comid  = CC.getStr("Comid")  || "1";
      const MComid = CC.getStr("MComid") || Comid;
      return {
        Comid:    main0.CommonCompany ? MComid : Comid,
        MComid,
        FYear:    com0.FYear || "2024",
        CompanyName: com0.Companyname || "",
        Address1: com0.Address1 || "",
        Address2: com0.Address2 || "",
        City:     com0.City || "",
        Phone:    com0.Phone || "",
        Ecotech:              !!main0.Ecotech,
        BatchWiseStock:       !!main0.BatchWiseStock,
        AlwaysBatchAll:       !!main0.AlwaysBatchCreatedAllItem,
        MultipleUOM:          !!main0.MultipleUOMBilling,
        ProductNameKeyPress:  !!main0.ProductNameKeyPress,
        StockApprovalStatus:  !!main0.StockApprovalStatus,
        StockTransferA4Print: !!main0.StockTransferShowSaveDialog,
        BatchSizeStock:       (main0.BatchWiseStock || main0.TextilesSerialNowiseBilling) ? 1 : 0,
        NomsQtyName:          main0.NomsQtyName || "NomsQty",
        BatchNoPerfix:        main0.BatchNoPerfix || "",
        BatchNoDigit:         main0.BatchNoDigit || 0,
        MultiMRP:             !!com0.MultiMRP,
        priv:                 CC.getStr("priv") || "User",
        loginuser:            CC.getStr("username") || "",
      };
    } catch {
      return { Comid: "1", MComid: "1", FYear: "2024", Ecotech: false, BatchWiseStock: false, BatchSizeStock: 0, priv: "User", loginuser: "" };
    }
  });
  
const fetchStockDetailsForDelete = useCallback(async (id, currentMode) => {
  const url = currentMode === "inward" ? CC.SI_Edit
            : currentMode === "outward" ? CC.SO_Edit
            : CC.ST_Edit;
  const extraHeaders = currentMode === "inward" || currentMode === "outward"
    ? { Ecotech: sess.Ecotech ? "1" : "0" }
    : {};
  try {
    const res = await CC.api(url, null, extraHeaders, {
      Id: id, PNo: 0, Comid: sess.Comid,
      BatchwiseSizeStock: sess.BatchSizeStock,
    });
    if (!(res.ok ?? res.IsSuccess)) return [];
    const data = currentMode === "transfer"
      ? (Array.isArray(res.Data) ? res.Data[0] : null)
      : (Array.isArray(res.data) ? res.data[0] : res.data);
    return data?.StockDetails || data?.[0]?.StockDetails || [];
  } catch {
    return [];
  }
}, [sess]);
  // ── Column settings ───────────────────────────────────────────────────────
  const [colSettings, setColSettings] = useState(DEFAULT_COL_SETTINGS);
  const [f12Open,     setF12Open]     = useState(false);
const [batchPopup, setBatchPopup] = useState(null); 
  const visCols = useMemo(
    () => colSettings.filter(c => {
      if (!c.visible) return false;
      if ((c.key === "NomsRate" || c.key === "ProfitAmt") && !sess.Ecotech) return false;
      // BatchWise columns only visible when BatchWiseStock is ON
      const base = GRID_COLUMNS.find(g => g.key === c.key);
      if (base?.batchOnly && !sess.BatchWiseStock) return false;
      return true;
    }),
    [colSettings, sess.Ecotech, sess.BatchWiseStock]
  );
 
const fillBatchItemIntoRow = useCallback((rid, item, codeStatus) => {
  setRows(prev => prev.map(r => {
    if (r._rid !== rid) return r;
    return {
      ...r,
      ProductRefId: item.Id,
      ProductCode: codeStatus === 1 ? (item.BatchNo || "") : (item.ProductCode || item.Prod_Code || ""),
      ProductName: item.ProductName || "",
      BatchRefid:  item.Batchid || item.BatchRefid || 0,
      Bat_No:      item.BatchNo || "",
      BatchStatus: 1,
      SerialNoType: item.SerialNoType || 0,
      MRP:         f2(vn(item.MRP)),
      PurRate:     f2(vn(item.PurchaseRate)),
      landingCost: f2(vn(item.LandingCost)),
      SaleRate:    f2(vn(item.SalesRate || item.SaleRate)),
      SaleRateorg: f2(vn(item.SalesRate || item.SaleRate)),
      UOM:         item.UOM || "",
      UOMDecimal:  item.UOMDecimal || 0,
        UOMRefid:     item.UOMRefid ||item.UomRefid || 0,
      StockQty:    vn(item.Stock),
      ColorId:    item.ColorId   || 0, ColorCombo: item.ColorCombo || "",
      BrandId:    item.BrandId   || 0, BrandCombo: item.BrandCombo || "",
      SizeId:     item.SizeId    || 0, SizeCombo:  item.SizeCombo  || "",
      Amount: 0,
      ItemQty: item.UOMDecimal === 0 ? "1" : "",
      _dirty: true,
    };
  }));
  setProdPopup(null);

  setTimeout(() => {
    const firstFocus = focusColsRef.current.find(k => k !== "ProductCode") || "ItemQty";
    cellRefs.current[rid]?.[firstFocus]?.focus();
    cellRefs.current[rid]?.[firstFocus]?.select?.();
  }, 50);
}, []);

  const loadColCfg = useCallback(async (comid) => {
    try {
      const res = await fetch(`Content/Appdata/Visible/${comid}/StockInward.json?v=${Date.now()}`, { headers: CC.authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;
      setColSettings(prev => prev.map(col => {
        const s = data.find(x => x.column === col.key);
        return s ? { ...col, visible: s.Visible === true, width: Number(s.Width) || col.width } : col;
      }));
    } catch {}
  }, []);

  const focusColsRef = useRef([]);
  const loadFocusCols = useCallback(async (mcomid) => {
    try {
      const res = await fetch(`/Content/Appdata/Visible/${mcomid}/StockInwardFocus.json?v=${Date.now()}`, { headers: CC.authHeaders() });
      if (!res.ok) return;
      const saved = await res.json();
      if (!Array.isArray(saved)) return;
      focusColsRef.current = saved
        .filter(s => s.Focus === true)
        .sort((a, b) => (a.Index ?? 99) - (b.Index ?? 99))
        .map(s => s.column);
    } catch {}
  }, []);

  // ── BatchWise master lists ─────────────────────────────────────────────────
  // Mirrors jQuery: brandlist / sizelist / modellist / colorlist / genderlist
  const [brandList,  setBrandList ] = useState([]);
  const [modelList,  setModelList ] = useState([]);
  const [colorList,  setColorList ] = useState([]);
  const [sizeList,   setSizeList  ] = useState([]);
  const [genderList, setGenderList] = useState([]);

  // Convert DB array to {value, label} for GridSelect
  const toBrandOpts  = useMemo(() => brandList.map(b => ({ value: String(b.Id), label: b.BrandName  || b.Name || String(b.Id) })), [brandList]);
  const toModelOpts  = useMemo(() => modelList.map(b => ({ value: String(b.Id), label: b.ModelName  || b.Name || String(b.Id) })), [modelList]);
  const toColorOpts  = useMemo(() => colorList.map(b => ({ value: String(b.Id), label: b.ColorName  || b.Name || String(b.Id) })), [colorList]);
  const toSizeOpts   = useMemo(() => sizeList.map(b  => ({ value: String(b.Id), label: String(b.SizeName || b.Name || b.Id) })), [sizeList]);
  const toGenderOpts = useMemo(() => genderList.map(b=> ({ value: String(b.Id), label: b.GenderName || b.Name || String(b.Id) })), [genderList]);

  const loadBatchWiseMasters = useCallback(async () => {
    if (!sess.BatchWiseStock) return;
    const norm = r => Array.isArray(r) ? r : (r?.data ?? r?.Data1 ?? []);
    try {
      const [bRes, mRes, cRes, sRes, gRes] = await Promise.all([
    CC.api(CC.BrandSelect, null, {}, { Comid: sess.MComid }),
      CC.api(CC.SelectModel, null, {}, { Comid: sess.MComid }),
      CC.api(CC.SelectColor, null, {}, { Comid: sess.MComid }),
      CC.api(CC.SizeSelect,  null, {}, { Comid: sess.MComid }),
        CC.api(CC.BW_Gender, null, {}, { Comid: sess.MComid }),
      ]);
      setBrandList(norm(bRes));
      setModelList(norm(mRes));
      setColorList(norm(cRes));
      setSizeList(norm(sRes));
      setGenderList(norm(gRes));
    } catch (e) {
      console.warn("BatchWise masters load failed:", e);
    }
  }, [sess.BatchWiseStock, sess.MComid]);

  // ── Permissions ───────────────────────────────────────────────────────────
  const [perm,         setPerm]         = useState({ View: 0, Add: 0, Edit: 0, Delete: 0 });
  const [isAuthorized, setIsAuthorized] = useState(false);

  // ── Mode ──────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState("inward");
  const modeRef = useRef("inward");
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // ── Combo data ────────────────────────────────────────────────────────────
  const [supplierList, setSupplierList] = useState([]);
  const [customerList, setCustomerList] = useState([]);
  const [branchList,   setBranchList]   = useState([]);
  const [poNoList,     setPoNoList]     = useState([]);
  const [userList,     setUserList]     = useState([]);
  const [productList,  setProductList]  = useState([]);

  // ── Header fields ─────────────────────────────────────────────────────────
  const [stockNo,     setStockNo]     = useState("");
  const [stockDate,   setStockDate]   = useState(today());
  const [invoiceNo,   setInvoiceNo]   = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [supplierId,  setSupplierId]  = useState("");
  const [remarks,     setRemarks]     = useState("");
  const [quality,     setQuality]     = useState("");
  const [delivery,    setDelivery]    = useState("");
  const [checkListNo, setCheckListNo] = useState("");
  const [poId,        setPoId]        = useState(0);
  const [poUserId,    setPoUserId]    = useState("");
  const [vUserId,     setVUserId]     = useState("");
  const [ecoUserFlag, setEcoUserFlag] = useState(0);
  const [ecoPDate,    setEcoPDate]    = useState({ from: today(), to: today() });
  const [ecoVDate,    setEcoVDate]    = useState({ from: today(), to: today() });
  const [fprint,      setFprint]      = useState(false);
  const [ftax,        setFtax]        = useState("");
  const [totAmtDisplay, setTotAmtDisplay] = useState("0.00");

  // ── Grid state ────────────────────────────────────────────────────────────
  const [rows,    setRows]    = useState([mkRow()]);
  const [selRid,  setSelRid]  = useState(null);
  const [totalAmt, setTotalAmt] = useState(0);
  const rowsRef = useRef(rows);
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  // ── Edit state ────────────────────────────────────────────────────────────
  const [editId,       setEditId]       = useState(0);
  const [updateIdEdit, setUpdateIdEdit] = useState("");
  const [realStockList,setRealStockList]= useState([]);
  const [mirrorTable,  setMirrorTable]  = useState(0);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [ldMsg,   setLdMsg]   = useState("Loading...");
  const [pw,      setPw]      = useState(null);
  const pwOkRef    = useRef(null);
  const [f5Open,   setF5Open]   = useState(false);
  const [f5Rows,   setF5Rows]   = useState([]);
  const [prodPopup,setProdPopup]= useState(null);

  const cellRefs = useRef({});
  const suppRef  = useRef(null);

  const regCell = (rid, key, el) => {
    if (!cellRefs.current[rid]) cellRefs.current[rid] = {};
    if (el) cellRefs.current[rid][key] = el;
    else delete cellRefs.current[rid]?.[key];
  };

  const redirectIfDual = useCallback(res => {
    if (res?._dualLogin || res?.redis === false) {
      alert("Already Login Another User Please Login Again!!!");
      navigate("/");
      return true;
    }
    return false;
  }, [navigate]);

  // ── Permission check ──────────────────────────────────────────────────────
  useEffect(() => {
    const menuStr = localStorage.getItem("menulist");
    if (!menuStr) { alert("Session Close Please Login !!!."); navigate("/"); return; }
    const menulist = JSON.parse(menuStr);
    const menudata = menulist.filter(o => o.PageName === "Stock Inward/Outward/Transfer");
    if (!menudata.length || menudata[0].View === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => navigate("/Home"), 3000);
      return;
    }
    setPerm({ View: menudata[0].View, Add: menudata[0].Add, Edit: menudata[0].Edit, Delete: menudata[0].Delete });
    setIsAuthorized(true);
    const mt = parseInt(localStorage.getItem("MirrorTableOnline") || "0");
    setMirrorTable(mt);
  }, [navigate]);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthorized) return;
    (async () => {
      setLoading(true);
      await Promise.all([
        loadCombos(),
        loadMaxNo("inward"),
        loadColCfg(sess.Comid),
        loadFocusCols(sess.MComid),
        loadBatchWiseMasters(),        // ← BatchWise master lists
      ]);
      setLoading(false);
    })();
  // eslint-disable-next-line
  }, [isAuthorized]);

  // ── Load combos ───────────────────────────────────────────────────────────
  const loadCombos = useCallback(async () => {
    const [supRes, cusRes, brRes, poRes, usrRes] = await Promise.all([
      CC.api(CC.SUP_All, null, {}, { Comid: sess.Comid, AccountType: "SUPPLIER" }),
      CC.api(CC.SUP_All, null, {}, { Comid: sess.Comid, AccountType: "CUSTOMER" }),
      CC.api(CC.BRANCH_List, null, {}, { Comid: sess.MComid }),
      CC.api(CC.PO_NoCombo, null, {}, { Comid: sess.Comid }),
      CC.api(CC.USR_UserCombo, null, {}, { Comid: sess.Comid }),
    ]);
    const pick = r => Array.isArray(r?.data) ? r.data : Array.isArray(r?.Data1) ? r.Data1 : [];
    setSupplierList(pick(supRes));
    setCustomerList(pick(cusRes));
    setBranchList(pick(brRes).filter(b => String(b.Id) !== String(sess.Comid)));
    setPoNoList(pick(poRes));
    setUserList(pick(usrRes));

    const pRes = await CC.api(CC.IM_ProductList, null, {}, { Comid: sess.Comid });
    setProductList(pick(pRes));
  }, [sess]);

  // ── Load max stock no ─────────────────────────────────────────────────────
  const loadMaxNo = useCallback(async (m) => {
    const url = m === "inward" ? CC.SI_MaxNo : m === "outward" ? CC.SO_MaxNo : CC.ST_MaxNo;
    const comid = m === "transfer" ? sess.MComid : sess.Comid;
    const res = await CC.api(url, null, {}, { Comid: comid });
    if (res.ok ?? res.IsSuccess) setStockNo(ns(res.No || res.data || ""));
  }, [sess]);

  // ── Recalc totals ─────────────────────────────────────────────────────────
  const recalcTotals = useCallback((rowsArr, m = modeRef.current) => {
    let total = 0;
    const updated = rowsArr.map(r => {
      if (!r.ProductCode) return r;
      const calc = calcRowAmount(r, m);
      total += vn(calc.Amount);
      return calc;
    });
    setTotalAmt(f2(total));
    if (sess.Ecotech) {
      const t = f2(total + vn(ftax));
      setTotAmtDisplay(t.toFixed(2));
    }
    return updated;
  }, [sess.Ecotech, ftax]);

  useEffect(() => {
    const updated = recalcTotals(rows, mode);
    setRows(prev => prev.map((r, i) => updated[i] ? { ...r, Amount: updated[i].Amount, ProfitAmt: updated[i].ProfitAmt } : r));
  // eslint-disable-next-line
  }, [rows.map(r => `${r._rid}:${r.ItemQty}:${r.PurRate}:${r.SaleRate}`).join("|"), mode]);

  // ── Fill item into row — now includes BatchWise fields ────────────────────
  // Mirrors jQuery FillItems() which sets BrandCombo/SizeCombo/ColorCombo etc.
  const fillItemIntoRow = useCallback((rid, item) => {
    setRows(prev => prev.map(r => {
      if (r._rid !== rid) return r;
      const newRow = {
        ...r,
        ProductRefId: item.Id,
        ProductCode:  item.ProductCode || item.Prod_Code,
        ProductName:  item.ProductName || item.PName,
        MRP:          f2(vn(item.MRP)),
        PurRate:      f2(vn(item.PurchaseRate)),
        landingCost:  f2(vn(item.LandingCost)),
        SaleRate:     f2(vn(item.SalesRate || item.SaleRate)),
        ProfitPer:    f2(vn(item.ProfitPer)),
        ProfitAmt:    f2(vn(item.ProfitAmt)),
        SaleDiscPer:  f2(vn(item.SaleDiscountPer)),
        SaleDiscAmt:  f2(vn(item.SaleDiscountAmt)),
        NomsRate:     f2(vn(item.NomsRate)),
        SaleRateorg:  f2(vn(item.SalesRate || item.SaleRate)),
        UOM:          item.UOM || "",
        BatchRefid:   item.Batchid || item.BatchRefid || 0,
        UOMRefid:     item.UOMRefid ||item.UomRefid || 0,
        UOMDecimal:   item.UOMDecimal || 0,
        StockQty:     vn(item.Stock),
       
        NomsQty:      vn(item.NomsQty),
        NStock:       vn(item.Nstock),
        BatchStatus:  item.BatchwiseStock || (sess.AlwaysBatchAll ? 1 : 0),
        SerialNoType: item.SerialNoType || 0,
        SerialNoStatus: item.SerialNoType || 0,
        Bat_No:       sess.Ecotech ? (item.Remarks || "") : "",
        ItemQty:      item.UOMDecimal === 0 ? "1" : "",
        // ── BatchWise: pre-fill from product master (mirrors jQuery FillItems) ──
        // stockinward.js sets: BrandCombo, ColorCombo, SizeCombo, BrandId, ColorId, SizeId
        BrandId:   item.BrandId   || 0,
        ModelId:   item.ModelId   || 0,
        ColorId:   item.ColorId   || 0,
        SizeId:    item.SizeId    || 0,
        GengerId:  item.GengerId  || 0,
        ToSizeId:  item.ToSizeId  || 0,
        SizeCombo: item.SizeCombo || "",
        BrandCombo:item.BrandCombo|| "",
        ColorCombo:item.ColorCombo|| "",
        ModelCombo:item.ModelCombo|| "",
        SizeDiff:  f2(vn(item.SizeDiff)),
        _dirty: true,
      };
      return newRow;
    }));
    setProdPopup(null);
    setTimeout(() => {
      const firstFocus = focusColsRef.current.find(k => k !== "ProductCode") || "ItemQty";
      cellRefs.current[rid]?.[firstFocus]?.focus();
      cellRefs.current[rid]?.[firstFocus]?.select?.();
    }, 50);
  }, [sess.Ecotech, sess.AlwaysBatchAll]);

  // ── Fetch product by code ─────────────────────────────────────────────────
 const fetchByCode = useCallback(async (rid, code) => {
  if (!code.trim()) return;
  const codeU = code.trim().toUpperCase();
  const batchwise = modeRef.current === "inward" ? 0 : sess.BatchSizeStock;
  const res = await CC.api(CC.IM_ByCode, null, {}, {
    code: codeU,
    Comid: sess.MComid, CComid: sess.Comid,
    Id: 0, Batchwise: batchwise,
  });
  if (redirectIfDual(res)) return;
  const arr = Array.isArray(res.data) ? res.data : Array.isArray(res.Data1) ? res.Data1 : [];
  if (arr.length === 0) { toast("❌ Invalid Product Code", true); return; }

  // Outward/Transfer with BatchWise: rows may be batch records
  if (modeRef.current !== "inward" && arr[0]?.BatchStatus === 1) {
    if (arr.length === 1 && (arr[0].BatchNo || "").toUpperCase() === codeU) {
      fillBatchItemIntoRow(rid, arr[0], 1);
    } else if (arr.length === 1) {
      fillBatchItemIntoRow(rid, arr[0], 0);
    } else {
      setBatchPopup({ rid, list: arr });
    }
    return;
  }

  if (arr.length === 1) fillItemIntoRow(rid, arr[0]);
  else setProdPopup({ rid });
}, [sess, fillItemIntoRow, fillBatchItemIntoRow, redirectIfDual, toast]);

  // ── Cell change ───────────────────────────────────────────────────────────
  const handleCellChange = useCallback((rid, colKey, value) => {
    setRows(prev => prev.map(r => {
      if (r._rid !== rid) return r;
      if (colKey === "ItemQty") {
        if (r.UOMDecimal === 0 && String(value).includes(".")) {
          return r;
        }
      }
      const updated = { ...r, [colKey]: value, _dirty: true };
      if (colKey === "ProfitPer") {
        updated.ProfitAmt = f2(vn(updated.landingCost) * (vn(value) / 100));
      }
      if (colKey === "SaleDiscPer") {
        updated.SaleDiscAmt = f2(vn(updated.SaleRate) * (vn(value) / 100));
        updated.NetSaleRate = f2(vn(updated.SaleRate) - updated.SaleDiscAmt);
      }
      if (colKey === "SaleDiscAmt") {
        const sr = vn(updated.SaleRate);
        updated.SaleDiscPer = sr !== 0 ? f2((vn(value) / sr) * 100) : 0;
        updated.NetSaleRate = f2(sr - vn(value));
      }
      return calcRowAmount(updated, modeRef.current);
    }));
  }, []);

  // ── Cell keydown ──────────────────────────────────────────────────────────
  const handleCellKeyDown = useCallback((e, rid, colKey) => {
    const editableCols = visCols
      .map(vc => GRID_COLUMNS.find(c => c.key === vc.key))
      .filter(cd => cd && !cd.readOnly && cd.type !== "combo")
      .map(cd => cd.key);

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
      if (colKey === "ProductCode") {
        const row = rowsRef.current.find(r => r._rid === rid);
        if (row?.ProductCode?.trim()) fetchByCode(rid, row.ProductCode);
        else setProdPopup({ rid });
        return;
      }
      if (colIdx >= 0 && colIdx < COLS.length - 1) {
        focusCell(rid, COLS[colIdx + 1]);
      } else {
        const curRows = rowsRef.current;
        const isLast  = rowIdx === curRows.length - 1;
        if (isLast) {
          const curRow = curRows[rowIdx];
          if (curRow?.ProductRefId) {
            const nr = mkRow();
            setRows(prev => [...prev, nr]);
            setTimeout(() => { cellRefs.current[nr._rid]?.["ProductCode"]?.focus(); }, 80);
          } else focusCell(rid, "ProductCode");
        } else {
          focusCell(curRows[rowIdx + 1]._rid, "ProductCode");
        }
      }
      return;
    }
    if (e.key === "ArrowDown"  && rowIdx < rowsRef.current.length - 1) { e.preventDefault(); focusCell(rowsRef.current[rowIdx + 1]._rid, colKey); }
    if (e.key === "ArrowUp"    && rowIdx > 0)                           { e.preventDefault(); focusCell(rowsRef.current[rowIdx - 1]._rid, colKey); }
    if (e.key === "ArrowRight" && colIdx < COLS.length - 1)             { e.preventDefault(); focusCell(rid, COLS[colIdx + 1]); }
    if (e.key === "ArrowLeft"  && colIdx > 0)                           { e.preventDefault(); focusCell(rid, COLS[colIdx - 1]); }
    if (e.key === "Delete")    { e.preventDefault(); doDeleteRow(rid); }
    if (e.key === " " && colKey === "ProductCode") { e.preventDefault(); setProdPopup({ rid }); }
  // eslint-disable-next-line
  }, [visCols, fetchByCode]);

  // ── AddSizeRow — mirrors jQuery methods.AddSizeRow ────────────────────────
  // When SizeDiff/Sizeper/SizeAmt is set, auto-generates rows from fromSize → toSize
  const doAddSizeRow = useCallback((rid, isPercentage) => {
    setRows(prev => {
      const rowIdx = prev.findIndex(r => r._rid === rid);
      if (rowIdx === -1) return prev;
      const srcRow = prev[rowIdx];
      const sizediff = vn(srcRow.SizeDiff) || 1;
      const per      = isPercentage ? vn(srcRow.Sizeper) : vn(srcRow.SizeAmt);
      if (!per) return prev;

      const fromSizeId = vn(srcRow.SizeId);
      const toSizeId   = vn(srcRow.ToSizeId);
      if (fromSizeId === toSizeId) return prev;

      // Build new rows for each size step
      const fromSizeIdx = sizeList.findIndex(s => s.Id === fromSizeId) + 1;
      const toSizeIdx   = sizeList.findIndex(s => s.Id === toSizeId);
      let   oldsalerate = vn(srcRow.SaleRate);
      const newRows     = [];

      for (let i = fromSizeIdx; i <= toSizeIdx; i++) {
        const sz = sizeList[i];
        if (!sz) continue;
        const saleratenew = isPercentage
          ? parseFloat((oldsalerate + oldsalerate * (per / 100)).toFixed(2))
          : parseFloat((oldsalerate + per).toFixed(2));
        oldsalerate = saleratenew;
        const nr = {
          ...mkRow(),
          ...srcRow,
          _rid:    genRid(),
          _isNew:  true,
          SizeId:  sz.Id,
          ToSizeId:sz.Id,
          SaleRate:f2(saleratenew),
          ItemQty: "",
          Amount:  0,
        };
        newRows.push(nr);
      }

      if (!newRows.length) return prev;
      const result = [...prev];
      result.splice(rowIdx + 1, 0, ...newRows);
      return result;
    });
  }, [sizeList]);

  // ── Delete row ────────────────────────────────────────────────────────────
  const doDeleteRow = useCallback(async (rid) => {
    const ok = await confirm("Do you want to Delete this Row?");
    if (!ok) return;
    setRows(prev => {
      const next = prev.filter(r => r._rid !== rid);
      return next.length === 0 ? [mkRow()] : next;
    });
  }, [confirm]);

  // ── Mode change ───────────────────────────────────────────────────────────
  const handleModeChange = useCallback(async (newMode) => {
    await doClear(newMode);
    setMode(newMode);
    await loadMaxNo(newMode);
  }, []); // eslint-disable-line

  // ── Clear form ────────────────────────────────────────────────────────────
  const doClear = useCallback(async (m = modeRef.current) => {
    setEditId(0);
    setStockNo("");
    setStockDate(today());
    setInvoiceNo("");
    setInvoiceDate(today());
    setSupplierId("");
    setRemarks("");
    setQuality("");
    setDelivery("");
    setCheckListNo("");
    setPoId(0);
    setPoUserId("");
    setVUserId("");
    setEcoUserFlag(0);
    setFtax("");
    setFprint(false);
    setUpdateIdEdit("");
    setRealStockList([]);
    setRows([mkRow()]);
    setSelRid(null);
    await loadMaxNo(m || modeRef.current);
    setTimeout(() => {
      const fr = rowsRef.current[0];
      if (fr) cellRefs.current[fr._rid]?.["ProductCode"]?.focus();
    }, 100);
  }, [loadMaxNo]);

  // ── Grid validity check ───────────────────────────────────────────────────
  const gridEmptyCheck = useCallback(() => {
    let grid = [...rowsRef.current];
    const last = grid[grid.length - 1];
    if (!last?.ProductCode) { grid.pop(); }
    if (grid.length === 0) { toast("❌ Add at least one item", true); return false; }
    for (let i = 0; i < grid.length; i++) {
      if (!sess.Ecotech && !grid[i].ProductRefId) {
        toast("❌ Enter Valid Product Code in Row " + (i + 1), true);
        setTimeout(() => cellRefs.current[grid[i]._rid]?.["ProductCode"]?.focus(), 50);
        return false;
      }
      if ((vn(grid[i].ItemQty) + vn(grid[i].Noms)) === 0) {
        toast("❌ Enter Quantity in Row " + (i + 1), true);
        setTimeout(() => cellRefs.current[grid[i]._rid]?.["ItemQty"]?.focus(), 50);
        return false;
      }
      if (!sess.Ecotech && vn(grid[i].Amount) === 0) {
        toast("❌ Amount is 0 in Row " + (i + 1), true);
        return false;
      }
      // BatchWise: validate Bat_No when BatchStatus=1
   
    }
    return true;
  }, [sess.Ecotech, sess.BatchWiseStock, toast]);

  // ── Supplier options ──────────────────────────────────────────────────────
  const supplierOptions = useMemo(() => {
    const base = [{ value: "", label: "" }];
    if (mode === "inward")   return [...base, ...supplierList.map(s => ({ value: String(s.Id), label: s.AccountName || s.SupplierName }))];
    if (mode === "outward")  return [...base, ...customerList.map(c => ({ value: String(c.Id), label: c.AccountName || c.CustomerName }))];
   if (mode === "transfer") return [...base, ...branchList
  .filter(b => String(b.Id) !== String(sess.Comid))
  .map(b => ({ value: String(b.Id), label: b.BranchName }))];
    return base;
  }, [mode, supplierList, customerList, branchList]);

  const supplierPlaceholder = mode === "inward" ? "Select Supplier" : mode === "outward" ? "Select Customer" : "Select Branch";
  const supplierLabel       = mode === "inward" ? "Supplier"        : mode === "outward" ? "Customer"        : "Branch";

  // ── SAVE — INWARD ─────────────────────────────────────────────────────────
  const doInwardSave = useCallback(async () => {
    if (!perm.Add && !editId) { toast("❌ Add Permission Denied", true); return; }
    if (!gridEmptyCheck()) return;
    const ok = await confirm("Wish to Save Stock Inward Details?");
    if (!ok) return;
    setLoading(true); setLdMsg("Saving...");
    const details = rowsRef.current.filter(r => r.ProductCode).map(sanitizeRowForInsert);
    let PoCon = 1;
    if (sess.Ecotech) {
      for (const r of details) { if (vn(r.ProfitAmt) > 0) { PoCon = 0; break; } }
    }
    const poItem  = poNoList.find(p => String(p.Id) === String(poUserId));
    const supItem = supplierList.find(s => String(s.Id) === String(supplierId));
    const payload = [{
      Id: editId, SupplierRefid: supplierId ? parseInt(supplierId) : null,
      CompanyRefId: sess.Comid, SupplierName: supItem?.AccountName || "",
      StockDate: new Date(stockDate).toISOString(),
      InvoiceDate: new Date(invoiceDate).toISOString(),
      Remarks: remarks, Quality: quality, Modified_By: sess.loginuser,
      UpdateId: checkListNo, Ecotech: sess.Ecotech ? 1 : 0,
      Ftax: sess.Ecotech ? ftax : null, NetAmt: f2(totalAmt),
      Eservice: sess.Ecotech ? parseInt(delivery) || null : null,
      POId: poId, POCon: PoCon, PONo: poItem?.label || "",
      InvoiceNo: invoiceNo, StockNo: stockNo,
      StockInwardDetails: details, StockDetails: realStockList, SerialNoDetails: [],
    }];
    const headers = {
      batchstockstatus: String(sess.BatchSizeStock),
      Ecotech: sess.Ecotech ? "1" : "0",
      BatchPerfix: sess.BatchNoPerfix,
      BatchDigit: String(sess.BatchNoDigit),
      MirrorTable: String(mirrorTable),
      LocalDB: "0",
    };
    const res = await CC.insertapi(CC.SI_Insert, payload, headers);
    setLoading(false);
    if (redirectIfDual(res)) return;
    if (res.ok ?? res.IsSuccess) {
      toast("✅ " + (res.message || "Stock Inward Saved"));
      await doClear("inward");
    } else {
      toast("❌ " + (res.message || "Save Failed"), true);
    }
 }, [perm, editId, gridEmptyCheck, confirm, sess, poNoList, supplierList, supplierId,
    stockDate, invoiceDate, remarks, quality, checkListNo, delivery, ftax, poId, poUserId,
    invoiceNo, stockNo, realStockList, mirrorTable, totalAmt, doClear, toast, redirectIfDual]);

  // ── SAVE — OUTWARD ────────────────────────────────────────────────────────
  const doOutwardSave = useCallback(async () => {
    if (!perm.Add && !editId) { toast("❌ Add Permission Denied", true); return; }
    if (!gridEmptyCheck()) return;
    const ok = await confirm("Wish to Save Stock Outward Details?");
    if (!ok) return;
    setLoading(true); setLdMsg("Saving...");
    let chkprint = 0;
    const details = rowsRef.current.filter(r => r.ProductCode).map(sanitizeRowForInsert);
    if (sess.Ecotech && fprint) chkprint = 1;
    const userItem  = userList.find(u => String(u.Id) === String(poUserId));
    const userItem1 = userList.find(u => String(u.Id) === String(vUserId));
    const payload = [{
      Id: editId, SupplierRefid: supplierId ? parseInt(supplierId) : null,
      StockDate: new Date(stockDate).toISOString(), Remarks: remarks,
      NoRoll: delivery, NoBox: quality, CompanyRefId: parseInt(sess.Comid),NetAmt:f2(totalAmt),
      fprint: chkprint, Modified_By: sess.loginuser, UpdateId: checkListNo, MId: 0,
      EcotechDate: (sess.Ecotech && (ecoUserFlag === 1 || ecoUserFlag === 3)) ? `${ecoPDate.from},${ecoPDate.to}` : null,
      EcotechDate1: (sess.Ecotech && (ecoUserFlag === 2 || ecoUserFlag === 3)) ? `${ecoVDate.from},${ecoVDate.to}` : null,
      ecouser: sess.Ecotech ? ecoUserFlag : null,
      StockNo: 0,
      Uname: sess.Ecotech ? (userItem?.Id || null) : null,
      Uname1: sess.Ecotech ? (userItem1?.Id || null) : null,
      InvoiceNo: invoiceNo, InvoiceDate: new Date(invoiceDate).toISOString(),
      StockInwardDetails: details, StockDetails: realStockList, SerialNoDetails: "",
    }];
    const res = await CC.insertapi(CC.SO_Insert, payload, { MirrorTable: String(mirrorTable) ,LocalDB:"0"});
    setLoading(false);
    if (redirectIfDual(res)) return;
    if (res.ok ?? res.IsSuccess) {
      toast("✅ " + (res.message || "Stock Outward Saved"));
      await doClear("outward");
    } else {
      toast("❌ " + (res.message || "Save Failed"), true);
    }
}, [perm, editId, gridEmptyCheck, confirm, sess, poNoList, supplierList, supplierId,
    stockDate, invoiceDate, remarks, quality, checkListNo, delivery, ftax, poId, poUserId,
    invoiceNo, stockNo, realStockList, mirrorTable, totalAmt, doClear, toast, redirectIfDual]);
  // ── SAVE — TRANSFER ───────────────────────────────────────────────────────
  const doTransferSave = useCallback(async () => {
    if (!perm.Add && !editId) { toast("❌ Add Permission Denied", true); return; }
    if (!supplierId) { toast("❌ Select Valid Branch", true); return; }
    if (!gridEmptyCheck()) return;
    const ok = await confirm("Wish to Save Stock Transfer Details?");
    if (!ok) return;
    setLoading(true); setLdMsg("Saving...");
   const details = rowsRef.current.filter(r => r.ProductCode).map(sanitizeRowForInsert);
    const payload = [{
      Id: editId, SupplierRefid: parseInt(supplierId),
      StockDate: new Date(stockDate).toISOString(), Remarks: remarks,
      CompanyRefId: parseInt(sess.Comid), Modified_By: sess.loginuser,
      UpdateId: "", Univercell: false, StockNo: 0,
      StockInwardDetails: details, StockDetails: realStockList, SerialNoDetails: "", SaleorderId: 0,
    }];
    const res = await CC.insertapi(CC.ST_Insert, payload, {
      SaleorderId: "0", MirrorTable: String(mirrorTable),
      StockApprovalStatus: sess.StockApprovalStatus ? "1" : "0",
      MComid: sess.MComid,
    });
    setLoading(false);
    if (redirectIfDual(res)) return;
    if (res.ok ?? res.IsSuccess) {
      toast("✅ " + (res.message || "Stock Transfer Saved"));
      if (sess.StockTransferA4Print) {
        const prOk = await confirm("Do you want to View Stock Transfer?");
        if (prOk) {
          await CC.insertapi(CC.ST_PrintView, { Id: res.data, Type: "StockTransfer", CompanyName: sess.CompanyName });
          window.open(`../Reports/ReportViewer.aspx?ReportName=StockTransfer&A4Print=0`, "_blank");
        }
      }
      await doClear("transfer");
    } else {
      toast("❌ " + (res.message || "Save Failed"), true);
    }
 }, [perm, editId, gridEmptyCheck, confirm, sess, poNoList, supplierList, supplierId,
    stockDate, invoiceDate, remarks, quality, checkListNo, delivery, ftax, poId, poUserId,
    invoiceNo, stockNo, realStockList, mirrorTable, totalAmt, doClear, toast, redirectIfDual]);

  const doSave = () => {
    if (mode === "inward")        doInwardSave();
    else if (mode === "outward")  doOutwardSave();
    else                          doTransferSave();
  };

  // ── EDIT helpers ──────────────────────────────────────────────────────────
  const loadEditDetails = useCallback((master, details) => {
    const fmtDetails = details.map(d => fmtRow({
      ...d,
      PurRate: d.PurRate || d.PurchaseRate,
      NomsRate: (sess.Ecotech && mode === "inward" && master.POId)
        ? vn(d.ProfitAmt) + vn(d.ItemQty)
        : vn(d.NomsRate),
    }));
    setEditId(master[0].Id || 0);
    setStockNo(ns(master[0].StockNo));
    setStockDate(String(master[0].StockDate || "").slice(0, 10) || today());
    setInvoiceNo(ns(master[0].InvoiceNo));
    setInvoiceDate(String(master[0].InvoiceDate || "").slice(0, 10) || today());
    setSupplierId(ns(master[0].SupplierRefid || master[0].SupplierRefId || ""));
    setRemarks(ns(master[0].Remarks));
    setUpdateIdEdit(ns(master[0].UpdateId));
    setRealStockList(master[0].StockDetails || []);
    setQuality(ns(master[0].NoBox || master[0].Quality || ""));
    setDelivery(ns(master[0].Delivery || master[0].NoRoll || ""));
    setCheckListNo(ns(master[0].UpdateId || ""));
    setFtax(ns(master[0].Ftax || ""));
    setPoId(master[0].POId || 0);
    if (sess.Ecotech) {
      setFprint(master.fprint === 1);
      if (master.ecouser) setEcoUserFlag(master.ecouser);
      if (master.Uname)   setPoUserId(ns(master.Uname));
      if (master.Uname1)  setVUserId(ns(master.Uname1));
    }
    setRows(fmtDetails.length > 0 ? [...fmtDetails, mkRow()] : [mkRow()]);
  }, [sess.Ecotech, mode]);

  const doInwardEdit = useCallback(async (pid, pno) => {
    if (!perm.Edit) { toast("❌ Edit Permission Denied", true); return; }
    setLoading(true); setLdMsg("Loading...");
    const res = await CC.api(CC.SI_Edit, null, { Ecotech: sess.Ecotech ? "1" : "0" }, {
      Id: pid, PNo: pno, Comid: sess.Comid, BatchwiseSizeStock: sess.BatchSizeStock,
    });
    setLoading(false);
    if (redirectIfDual(res)) return;
    if (res.ok ?? res.IsSuccess) {
      const data = Array.isArray(res) ? res.Data1 : res.data;
      if (data) { loadEditDetails(data, data[0].StockInwardDetails || []); setF5Open(false); }
    } else toast("❌ " + (res.message || "Load Failed"), true);
  }, [perm, sess, loadEditDetails, redirectIfDual, toast]);

  const doOutwardEdit = useCallback(async (pid, pno) => {
    if (!perm.Edit) { toast("❌ Edit Permission Denied", true); return; }
    setLoading(true); setLdMsg("Loading...");
    const res = await CC.api(CC.SO_Edit, null, { Ecotech: sess.Ecotech ? "1" : "0" }, {
      Id: pid, PNo: pno, Comid: sess.Comid,BatchwiseSizeStock:sess.BatchSizeStock,
    });
    setLoading(false);
    if (redirectIfDual(res)) return;
    if (res.ok ?? res.IsSuccess) {
  const data = Array.isArray(res) ? res.Data1 : res.data;
      if (data) { loadEditDetails(data, data[0].StockInwardDetails || []); setF5Open(false); }
    } else toast("❌ " + (res.message || "Load Failed"), true);
  }, [perm, sess, loadEditDetails, redirectIfDual, toast]);

  const doTransferEdit = useCallback(async (pid, pno) => {
    if (!perm.Edit) { toast("❌ Edit Permission Denied", true); return; }
    setLoading(true); setLdMsg("Loading...");
    const res = await CC.api(CC.ST_Edit, null, {}, { Id: pid, PNo: pno, Comid: sess.Comid });
    setLoading(false);
    if (redirectIfDual(res)) return;
    if (res.ok ?? res.IsSuccess) {
      const data = Array.isArray(res.Data) ? res.Data[0] : res.data;
      if (data) { loadEditDetails(data, data.StockInwardDetails || []); setF5Open(false); }
    } else toast("❌ " + (res.message || "Load Failed"), true);
  }, [perm, sess, loadEditDetails, redirectIfDual, toast]);

  const doEditById = (id) => {
    if (mode === "inward")        doInwardEdit(id, 0);
    else if (mode === "outward")  doOutwardEdit(id, 0);
    else                          doTransferEdit(id, 0);
  };

  // ── DELETE ────────────────────────────────────────────────────────────────
// ── DELETE ────────────────────────────────────────────────────────────────────
const doDelete = useCallback(async () => {
  if (!perm.Delete) { toast("❌ Delete Permission Denied", true); return; }
  if (!editId) { toast("❌ No record to delete", true); return; }
  const ok = await confirm(`Delete Stock ${mode === "inward" ? "Inward" : mode === "outward" ? "Outward" : "Transfer"} No ${stockNo}?`);
  if (!ok) return;
  setLoading(true); setLdMsg("Deleting...");

  const stockDetailsForDelete = realStockList.length > 0
    ? realStockList
    : await fetchStockDetailsForDelete(editId, mode); // ← pass mode here too

  const url = mode === "inward" ? CC.SI_Delete : mode === "outward" ? CC.SO_Delete : CC.ST_Delete;
  const res = await CC.api(url, stockDetailsForDelete, {
    Year: sess.FYear, Comid: sess.Comid, Id: String(editId),
    MirrorTable: String(mirrorTable), UpdateId: updateIdEdit, LocalDB: "0",
  });
  setLoading(false);
  if (redirectIfDual(res)) return;
  if (res.ok ?? res.IsSuccess) {
    toast("✅ " + (res.message || "Deleted Successfully"));
    await doClear();
  } else toast("❌ " + (res.message || "Delete Failed"), true);
}, [perm, editId, mode, stockNo, realStockList, sess, mirrorTable, updateIdEdit,
    confirm, doClear, redirectIfDual, toast, fetchStockDetailsForDelete]);
  // ── F5 VIEW ───────────────────────────────────────────────────────────────
  const openF5 = useCallback(async (from = stockDate, to = stockDate) => {
    if (!perm.Edit) { toast("❌ Edit Permission Denied", true); return; }
    setLoading(true); setLdMsg("Loading...");
    const url = mode === "inward" ? CC.SI_Select : mode === "outward" ? CC.SO_Select : CC.ST_Select;
    const res = await CC.api(url, null, {}, { Comid: sess.Comid, Fromdate: from, Todate: to, Id: 0, SearchNo: "" });
    setLoading(false);
    if (redirectIfDual(res)) return;
    const data = Array.isArray(res.Data) ? res.Data[0] : res.data?.[0];
    const master = data?.purchasemaster || data?.salemaster || [];
    setF5Rows(Array.isArray(master) ? master : []);
    setF5Open(true);
  }, [mode, sess, stockDate, perm, redirectIfDual, toast]);

  // ── PO LOAD (F2) ──────────────────────────────────────────────────────────
  const doPOEdit = useCallback(async (pid, pno) => {
    if (!perm.Edit) { toast("❌ Edit Permission Denied", true); return; }
    setLoading(true); setLdMsg("Loading PO...");
    const res = await CC.api(CC.PO_Edit, null, { EcoStock: "1" }, { Id: pid, PNo: pno, Comid: sess.Comid, univercell: true });
    setLoading(false);
    if (redirectIfDual(res)) return;
    if (!(res.ok ?? res.IsSuccess)) { toast("❌ " + (res.message || "PO load failed"), true); return; }
    const data = Array.isArray(res.Data) ? res.Data[0] : res.data;
    if (!data) return;
    setPoId(data.Id || 0);
    setSupplierId(ns(data.SupplierRefId));
    setFtax(f2(vn(data.FTax)).toFixed(2));
    const details = data.PurchaseDetails || [];
    const ecoStock = data.EcoPo || [];
    const merged = details.map(d => {
      const match = ecoStock.find(e => e.ProductRefId === d.ProductRefId);
      return { ...d, NomsRate: match ? match.Bal : vn(d.NomsRate) };
    });
    const fmtd = merged.map(d => fmtRow({ ...mkRow(), ...d, PurRate: d.PurRate || d.PurchaseRate }));
    setRows([...fmtd, mkRow()]);
  }, [perm, sess, redirectIfDual, toast]);
const selectedPartyInfo = useMemo(() => {
  if (!supplierId) return null;
  const list = mode === "inward" ? supplierList : mode === "outward" ? customerList : branchList;
  return list.find(s => String(s.Id) === String(supplierId)) || null;
}, [supplierId, mode, supplierList, customerList, branchList]);
  // ── KEYBOARD SHORTCUTS ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = async e => {
    if (prodPopup || batchPopup || f5Open || pw || f12Open) return;
      if (e.key === "F1")  { e.preventDefault(); doSave(); }
      if (e.key === "F2")  { e.preventDefault(); if (mode === "inward") { const v = prompt("Enter Purchase Order No", ""); if (v) doPOEdit(0, v); } }
      if (e.key === "F3")  {
        e.preventDefault();
        const v = prompt(`Enter Stock ${mode === "inward" ? "Inward" : mode === "outward" ? "Outward" : "Transfer"} No`, "");
        if (v) {
          if (mode === "inward")        doInwardEdit(0, v);
          else if (mode === "outward")  doOutwardEdit(0, v);
          else                          doTransferEdit(0, v);
        }
      }
      if (e.key === "F5")  { e.preventDefault(); openF5(); }
      if (e.key === "F9")  {
        e.preventDefault();
        if (!perm.Delete) { toast("❌ Delete Permission Denied", true); return; }
        if (!editId) { toast("❌ No record to delete", true); return; }
        pwOkRef.current = doDelete;
        setPw({ title: "F9 Delete Password" });
      }
      if (e.key === "F10") { e.preventDefault(); const ok = await confirm("Do You Want To Clear?"); if (ok) doClear(); }
      if (e.key === "F12") { e.preventDefault(); setF12Open(true); }
      if (e.key === "F4") {
        e.preventDefault();
        const ok = await confirm("Do You Want To Download Item List?");
        if (ok) {
          const res = await CC.api(CC.IM_TransferList, null, {}, { Comid: sess.Comid });
          if (res.ok) toast("✅ Download initiated");
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        const ok = await confirm("Do You Want To Quit?");
        if (ok) navigate(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line
}, [mode, prodPopup, batchPopup, f5Open, pw, f12Open, editId, perm, doSave, openF5, doDelete, doClear, doPOEdit]);

  if (!isAuthorized) return null;

  const RIGHT_KEYS = new Set(["ItemQty","Noms","NomsQty","MRP","PurRate","landingCost","SaleRate",
    "ProfitPer","ProfitAmt","SaleDiscPer","SaleDiscAmt","NetSaleRate","NomsRate","Amount","StockQty",
    "SizeDiff","Sizeper","SizeAmt"]);

  const validRows  = rows.filter(r => r.ProductRefId && vn(r.ItemQty) > 0);
  const totalItems = validRows.length;
  const totalQty   = validRows.reduce((s, r) => s + vn(r.ItemQty), 0);

  const getQualityLabel  = () => "Remarks";
  const getDeliveryLabel = () => "Item Qty";
  const getServiceLabel  = () =>"TotalAmt";

  const fl    = { display: "flex", alignItems: "center", gap: 6 };
  const lbl   = { fontSize: 11, fontWeight: 700, color: "#4a5568", minWidth: 80, flexShrink: 0 };
  const inp   = { height: 24, border: "1px solid #b8ccee", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", background: "#fff", color: "#1a2e4a" };
  const panel = { border: "1px solid #c8d8ee", borderRadius: 5, background: "#fff", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 };
  const ptitle= { fontSize: 11, fontWeight: 700, color: "#4a5568", borderBottom: "1px solid #e2e8f0", paddingBottom: 3, marginBottom: 2 };

  // ── Render BatchWise cell ─────────────────────────────────────────────────
  // Mirrors jQuery columntype:'combobox' columns: BrandCombo, ModelCombo, etc.
  const renderBatchCell = (row, col, cellId) => {
    const optMap = {
      BrandId:  toBrandOpts,
      ModelId:  toModelOpts,
      ColorId:  toColorOpts,
      SizeId:   toSizeOpts,
      ToSizeId: toSizeOpts,
      GengerId: toGenderOpts,
    };
    const opts = optMap[col.key] || [];
    const handleChange = val => {
      handleCellChange(row._rid, col.key, parseInt(val) || 0);
      // When SizeId changes on a row with SizeDiff, offer to auto-generate size range
      if (col.key === "ToSizeId" && vn(row.Sizeper)) {
        doAddSizeRow(row._rid, true);
      }
      if (col.key === "ToSizeId" && vn(row.SizeAmt)) {
        doAddSizeRow(row._rid, false);
      }
    };
    return (
      <GridSelect
        cellId={cellId}
        options={opts}
        value={String(row[col.key] || "")}
        onChange={handleChange}
        onFocus={() => setSelRid(row._rid)}
        onKeyDown={e => {
          if (e.key === "Enter") {
            e.preventDefault();
            // Tab to next cell in grid
            const editableCols = visCols
              .map(vc => GRID_COLUMNS.find(c => c.key === vc.key))
              .filter(cd => cd && !cd.readOnly)
              .map(cd => cd.key);
            const colIdx = editableCols.indexOf(col.key);
            const next = editableCols[colIdx + 1];
            if (next) setTimeout(() => cellRefs.current[row._rid]?.[next]?.focus(), 10);
          }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            // Let native select handle up/down
          }
          if (e.key === "Delete") { e.preventDefault(); doDeleteRow(row._rid); }
        }}
      />
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: "100vh", width: "100vw", display: "flex", flexDirection: "column", background: "#eef3fb", overflow: "hidden", fontFamily: "'Inter', sans-serif", fontSize: 12 }}>
      {ConfirmUI}
      <Topbar />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* ── MODE SELECTOR ── */}
        <div style={{ background: "#1b3a8f", padding: "0 12px", display: "flex", alignItems: "center", gap: 0, flexShrink: 0 }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 13, marginRight: 20, whiteSpace: "nowrap" }}>
            📦 Stock Inward / Outward / Transfer
          </span>
          {[
            { val: "inward",   label: "📥 Inward"   },
            { val: "outward",  label: "📤 Outward"  },
            { val: "transfer", label: "🔄 Transfer"  },
          ].map(opt => (
            <button key={opt.val} onClick={() => handleModeChange(opt.val)}
              style={{
                padding: "8px 20px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
                background: mode === opt.val ? "#fff" : "transparent",
                color: mode === opt.val ? "#1b3a8f" : "rgba(255,255,255,.75)",
                borderBottom: mode === opt.val ? "3px solid #1f65de" : "3px solid transparent",
                transition: "all .15s",
              }}>
              {opt.label}
            </button>
          ))}
          {/* BatchWise indicator badge */}
          {sess.BatchWiseStock && (
            <span style={{ marginLeft: 12, background: "#f59e0b", color: "#1a2e4a", fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 10 }}>
              🏷 BatchWise ON
            </span>
          )}
          {editId > 0 && (
            <span style={{ marginLeft: 14, background: "#f59e0b", color: "#1a2e4a", fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 10 }}>
              ✏️ EDIT MODE — #{stockNo}
            </span>
          )}
        </div>

        {/* ── HEADER PANELS ── */}
        <div style={{ display: "flex", gap: 8, padding: "8px 10px", background: "#f5f8fd", borderBottom: "1px solid #d0ddf5", alignItems: "stretch", flexShrink: 0 }}>

          {/* LEFT: Stock Details */}
          <div style={{ ...panel, minWidth: 230, flexShrink: 0 }}>
            <div style={ptitle}>Stock Details</div>
            <div style={fl}>
              <label style={lbl}>Stock No</label>
              <input style={{ ...inp, flex: 1 }} value={stockNo} readOnly onChange={() => {}} />
            </div>
            <div style={fl}>
              <label style={lbl}>Stock Date</label>
              <input type="date" style={{ ...inp, flex: 1 }} value={stockDate} onChange={e => setStockDate(e.target.value)} />
            </div>
           
          </div>

          {/* MIDDLE: Supplier/Customer/Branch */}
          <div style={{ ...panel, flex: 1 }}>
            <div style={ptitle}>{supplierLabel} Details</div>
            
           <div style={fl}>
  <label style={lbl}>{supplierLabel}</label>
  <ComboBox inputRef={suppRef} options={supplierOptions} value={supplierId}
    onChange={setSupplierId}
    onEnterKey={() => { const fr = rowsRef.current[0]; if (fr) cellRefs.current[fr._rid]?.["ProductCode"]?.focus(); }}
    placeholder={supplierPlaceholder}
  />
</div>
{selectedPartyInfo && (
  <div style={{
    display: "flex", gap: 14, padding: "3px 6px",
    background: "#f0f7ff", borderRadius: 4, border: "1px solid #dde9f8",
    flexWrap: "wrap",
  }}>
    {(selectedPartyInfo.Address1 || selectedPartyInfo.Address || selectedPartyInfo.BranchAddress) && (
      <span style={{ fontSize: 10.5, color: "#4a5568", display: "flex", alignItems: "center", gap: 3 }}>
        📍 {selectedPartyInfo.Address1 || selectedPartyInfo.Address || selectedPartyInfo.BranchAddress}
        {(selectedPartyInfo.Address2 || selectedPartyInfo.City) &&
          `, ${selectedPartyInfo.Address2 || selectedPartyInfo.City}`}
      </span>
    )}
    {(selectedPartyInfo.Phone || selectedPartyInfo.Mobile || selectedPartyInfo.MobileNo) && (
      <span style={{ fontSize: 10.5, color: "#1f65de", fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
        📞 {selectedPartyInfo.Phone || selectedPartyInfo.Mobile || selectedPartyInfo.MobileNo}
      </span>
    )}
  </div>
)}
            {sess.Ecotech && mode === "outward" && (
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ ...fl, flex: 1 }}>
                  <label style={{ ...lbl, minWidth: 40 }}>User</label>
                  <ComboBox options={[{ value: "", label: "" }, ...userList.map(u => ({ value: String(u.Id), label: u.UserName || u.Name }))]}
                    value={poUserId} onChange={setPoUserId} placeholder="User 1" />
                </div>
                <div style={{ ...fl, flex: 1 }}>
                  <ComboBox options={[{ value: "", label: "" }, ...userList.map(u => ({ value: String(u.Id), label: u.UserName || u.Name }))]}
                    value={vUserId} onChange={setVUserId} placeholder="User 2" />
                </div>
              </div>
            )}
            {sess.Ecotech && mode === "outward" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11 }}>
                <label style={{ ...lbl, minWidth: 60 }}>P-Date</label>
                <input type="date" style={{ ...inp, width: 120 }} value={ecoPDate.from} onChange={e => setEcoPDate(p => ({ ...p, from: e.target.value }))} />
                <span style={{ color: "#6b7a99" }}>~</span>
                <input type="date" style={{ ...inp, width: 120 }} value={ecoPDate.to} onChange={e => setEcoPDate(p => ({ ...p, to: e.target.value }))} />
              </div>
            )}
          </div>

          {/* RIGHT: Totals + extra fields */}
          {/* RIGHT: Amount + Tax only */}
<div style={{ ...panel, minWidth: 200, flexShrink: 0, justifyContent: "center" }}>
  <div style={{ textAlign: "center", fontSize: 24, fontWeight: 800, color: "#16a34a", paddingBottom: 6 }}>
  Rs.{(totalAmt + vn(ftax)).toFixed(2)}
</div>
  <div style={{ display: "flex", justifyContent: "center", gap: 16, paddingBottom: 6, borderBottom: "1px solid #e2e8f0", marginBottom: 4 }}>
    <span style={{ fontSize: 11, color: "#4a5568", fontWeight: 600 }}>
      Items: <strong style={{ color: "#1b3a8f" }}>{totalItems}</strong>
    </span>
    <span style={{ fontSize: 11, color: "#4a5568", fontWeight: 600 }}>
      Qty: <strong style={{ color: "#1b3a8f" }}>
        {totalQty % 1 === 0 ? totalQty.toFixed(0) : totalQty.toFixed(3)}
      </strong>
    </span>
  </div>
  <div style={fl}>
    <label style={{ ...lbl, minWidth: 70 }}>Tax/Others</label>
    <input style={{ ...inp, flex: 1 }} value={ftax} onChange={e => {
      setFtax(e.target.value);
      if (sess.Ecotech) setTotAmtDisplay(f2(totalAmt + vn(e.target.value)).toFixed(2));
    }} type="number" step="0.01" />
  </div>
</div>
        </div>

        {/* ── GRID ── */}
        <div style={{ flex: 1, overflow: "auto", background: "#fff" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed", minWidth: 800, fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ width: 44, background: "#1b3a8f", color: "#fff", padding: "6px 4px", position: "sticky", top: 0, zIndex: 3, fontSize: 11, textAlign: "center" }}>S.No</th>
                {visCols.map(c => {
                  const base = GRID_COLUMNS.find(g => g.key === c.key);
                  return (
                    <th key={c.key} style={{
                      width: c.width, minWidth: c.width,
                      background: base?.batchOnly ? "#1e4d8c" : "#1b3a8f",
                      color: "#fff", padding: "6px 8px",
                      position: "sticky", top: 0, zIndex: 3,
                      fontSize: 11, fontWeight: 600,
                      textAlign: RIGHT_KEYS.has(c.key) ? "right" : "left",
                      whiteSpace: "nowrap",
                    }}>
                      {c.label}
                      {base?.batchOnly && <span style={{ fontSize: 8, display: "block", opacity: 0.7 }}>batch</span>}
                    </th>
                  );
                })}
                <th style={{ width: 38, background: "#1b3a8f", color: "#fff", padding: "6px 4px", position: "sticky", top: 0, zIndex: 3 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row._rid}
                  onClick={() => setSelRid(row._rid)}
                  style={{ background: selRid === row._rid ? "#a8c8f5" : idx % 2 === 0 ? "#fff" : "#fafbff", cursor: "pointer", borderBottom: "1px solid #eaecf4" }}>
                  <td style={{ textAlign: "center", color: "#8b99b5", fontSize: 11, padding: "2px 4px" }}>{idx + 1}</td>

                  {visCols.map(col => {
                    const m     = GRID_COLUMNS.find(c => c.key === col.key) || {};
                    const val   = row[col.key];
                    const isRO  = !!m.readOnly;
                    const isNum = m.type === "float" || m.type === "int";
                    const isAmt = col.key === "Amount";
                    const align = RIGHT_KEYS.has(col.key) ? "right" : "left";
                    const cellId= `cell_${row._rid}_${col.key}`;

                    // ── BatchWise combo columns ──────────────────────────────
                    if (m.type === "combo" && m.batchOnly) {
                      return (
                        <td key={col.key} style={{ padding: "1px 2px" }}>
                          {renderBatchCell(row, col, cellId)}
                        </td>
                      );
                    }

                    return (
                      <td key={col.key} style={{ padding: "1px 2px", textAlign: align }}>
                        {isRO ? (
                          <span className="sb-cell-calc" style={{ display: "block", padding: "0 4px", color: isAmt ? "#1f65de" : undefined, fontWeight: isAmt ? 700 : undefined }}>
                            {isNum && val ? f2(val).toFixed(2) : ns(val)}
                          </span>
                        ) : col.key === "ProductCode" ? (
                          <input
                            ref={el => regCell(row._rid, col.key, el)}
                            id={cellId}
                            value={ns(val)}
                            autoComplete="off"
                            onChange={e => handleCellChange(row._rid, col.key, e.target.value.toUpperCase())}
                            onKeyDown={e => handleCellKeyDown(e, row._rid, col.key)}
                            onFocus={() => setSelRid(row._rid)}
                            placeholder="Code / Barcode"
                            style={{ width: "100%", border: "1px solid #c5d8f8", borderRadius: 3, padding: "3px 6px", fontSize: 12, outline: "none", background: "transparent" }}
                          />
                        ) : isNum ? (
                          <input
                            ref={el => regCell(row._rid, col.key, el)}
                            id={cellId}
                            type="number"
                            step={m.type === "int" ? "1" : (col.key === "ItemQty" && row.UOMDecimal === 0 ? "1" : "0.01")}
                            value={val === 0 && !row.ProductRefId ? "" : (val ?? "")}
                            onChange={e => handleCellChange(row._rid, col.key, e.target.value)}
                            onKeyDown={e => handleCellKeyDown(e, row._rid, col.key)}
                            onFocus={() => setSelRid(row._rid)}
                            placeholder="0"
                            style={{
                              width: "100%", border: "1px solid #c5d8f8", borderRadius: 3,
                              padding: "3px 6px", fontSize: 12, outline: "none",
                              background: "transparent", textAlign: "right",
                              // BatchStatus indicator: highlight Bat_No when needed
                              ...(col.key === "Bat_No" && row.BatchStatus === 1 && !row.Bat_No?.trim()
                                ? { borderColor: "#ef4444", background: "#fff7f7" }
                                : {}),
                            }}
                          />
                        ) : (
                          <input
                            ref={el => regCell(row._rid, col.key, el)}
                            id={cellId}
                            value={ns(val)}
                            onChange={e => handleCellChange(row._rid, col.key, e.target.value)}
                            onKeyDown={e => handleCellKeyDown(e, row._rid, col.key)}
                            onFocus={() => setSelRid(row._rid)}
                            placeholder={col.label}
                            style={{
                              width: "100%", border: "1px solid #c5d8f8", borderRadius: 3,
                              padding: "3px 6px", fontSize: 12, outline: "none", background: "transparent",
                              // Batch No required indicator
                              ...(col.key === "Bat_No" && row.BatchStatus === 1 && !row.Bat_No?.trim()
                                ? { borderColor: "#ef4444", background: "#fff7f7" }
                                : {}),
                            }}
                          />
                        )}
                      </td>
                    );
                  })}

                  <td style={{ textAlign: "center", padding: "1px 2px" }}>
                    <button onClick={e => { e.stopPropagation(); doDeleteRow(row._rid); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 15, padding: "2px 4px", borderRadius: 3 }}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── BOTTOM TOTAL BAR ── */}
    {/* ── BOTTOM TOTAL BAR ── */}
<div style={{ display: "flex", alignItems: "center", gap: 12, padding: "5px 14px", background: "#f0f7ff", borderTop: "1px solid #d0ddf5", flexShrink: 0, flexWrap: "wrap" }}>
  {/* Remarks input */}
  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <label style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", whiteSpace: "nowrap" }}>Remarks</label>
    <input
      style={{ height: 24, border: "1px solid #b8ccee", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", background: "#fff", color: "#1a2e4a", width: 200 }}
      value={remarks}
      onChange={e => setRemarks(e.target.value.toUpperCase())}
      placeholder="Remarks..."
    />
  </div>
  <div style={{ width: 1, height: 20, background: "#c8d8ee" }} />
  <span style={{ fontSize: 11, color: "#4a5568", fontWeight: 600 }}>
    Items: <strong style={{ color: "#1a2e4a" }}>{totalItems}</strong>
  </span>
  <span style={{ fontSize: 11, color: "#4a5568", fontWeight: 600 }}>
    Total Qty: <strong style={{ color: "#1a2e4a" }}>{totalQty % 1 === 0 ? totalQty.toFixed(0) : totalQty.toFixed(3)}</strong>
  </span>
  <span style={{ fontSize: 11, color: "#4a5568", fontWeight: 600 }}>
    Total Amt: <strong style={{ fontSize: 14, color: "#16a34a" }}>₹{totalAmt.toFixed(2)}</strong>
  </span>
  {sess.Ecotech && (
    <span style={{ fontSize: 11, color: "#4a5568", fontWeight: 600 }}>
      Net Total: <strong style={{ fontSize: 14, color: "#1f65de" }}>₹{totAmtDisplay}</strong>
    </span>
  )}
  {sess.BatchWiseStock && (
    <span style={{ fontSize: 11, color: "#92400e", fontWeight: 600, background: "#fef3c7", padding: "2px 8px", borderRadius: 8 }}>
      🏷 Batch/Size active
    </span>
  )}
</div>

        {/* ── TOOLBAR ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", background: "#fff", borderTop: "1px solid #d0ddf5", borderLeft: "4px solid #1f65de", flexShrink: 0, flexWrap: "wrap" }}>
          <button className="si-btn sv" onClick={doSave} disabled={loading}>💾 F1 - Save</button>
          {mode === "inward" && sess.Ecotech && (
            <button className="si-btn" onClick={() => { const v = prompt("Enter PO No", ""); if (v) doPOEdit(0, v); }}>📋 F2 - PO Load</button>
          )}
          <button className="si-btn" onClick={openF5}>✏ F3 - Edit</button>
          <button className="si-btn" onClick={openF5}>📋 F5 - View</button>
          <button className="si-btn" onClick={() => setF12Open(true)}>⚙ F12 - Cols</button>
          <button className="si-btn" onClick={() => confirm("Do You Want To Clear?").then(ok => ok && doClear())}>🔄 F10 - Clear</button>
          {editId > 0 && (
            <button className="si-btn dl" onClick={() => { pwOkRef.current = doDelete; setPw({ title: "F9 Delete Password" }); }} disabled={loading}>
              🗑 F9 - Delete
            </button>
          )}
          <button className="si-btn dl" onClick={() => navigate(-1)}>✕ ESC - Exit</button>
          {loading && <span style={{ fontSize: 11, color: "#6b7a99" }}>⏳ {ldMsg}</span>}
          <span style={{ marginLeft: "auto", display: "flex", gap: 10, fontSize: 10.5, color: "#6b7a99" }}>
            <span><kbd style={{ background: "#1f65de", color: "#fff", padding: "1px 5px", borderRadius: 3, fontSize: 9 }}>F1</kbd> Save</span>
            <span><kbd style={{ background: "#1f65de", color: "#fff", padding: "1px 5px", borderRadius: 3, fontSize: 9 }}>F3</kbd> Edit</span>
            <span><kbd style={{ background: "#1f65de", color: "#fff", padding: "1px 5px", borderRadius: 3, fontSize: 9 }}>F5</kbd> View</span>
            <span><kbd style={{ background: "#6b7a99", color: "#fff", padding: "1px 5px", borderRadius: 3, fontSize: 9 }}>Space</kbd> Product List</span>
          </span>
        </div>
      </div>

      {/* ── LOADING OVERLAY ── */}
      {loading && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,20,40,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000 }}>
          <div style={{ background: "#fff", borderRadius: 8, padding: "22px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, boxShadow: "0 16px 48px rgba(0,0,0,.25)" }}>
            <div style={{ width: 32, height: 32, border: "4px solid #deeafb", borderTopColor: "#1f65de", borderRadius: "50%", animation: "si-spin .55s linear infinite" }} />
            <div style={{ fontSize: 12, color: "#4a5568", fontWeight: 600 }}>{ldMsg}</div>
          </div>
        </div>
      )}

      {/* ── MODALS ── */}
      {pw && <PwModal title={pw.title} comid={sess.Comid} onOk={() => { pwOkRef.current?.(); }} onClose={() => setPw(null)} />}

      {f12Open && (
        <F12Modal
          colSettings={colSettings}
          comid={sess.Comid}
          toast={toast}
          batchWise={sess.BatchWiseStock}
          onSave={c => { setColSettings(c); setF12Open(false); }}
          onClose={() => setF12Open(false)}
        />
      )}

    

{prodPopup && (
  <ProductSearchPopup
    products={productList}
    onSelect={item => { fillItemIntoRow(prodPopup.rid, item); }}
    onClose={() => setProdPopup(null)}
  />
)}

{batchPopup && (
  <BatchPopup
    batches={batchPopup.list}
    onSelect={item => {
      fillBatchItemIntoRow(batchPopup.rid, item, 1);
      setBatchPopup(null);
    }}
    onClose={() => setBatchPopup(null)}
  />
)}


      {f5Open && (
        <F5ViewModal
          rows={f5Rows} mode={mode}
          onEdit={id => { setF5Open(false); doEditById(id); }}
     onDelete={(id, no) => {
  const snapshotMode = mode; // ← snapshot current mode at click time
  pwOkRef.current = async () => {
    const ok = await confirm(`Delete Stock No "${no}"?`);
    if (!ok) return;
    setLoading(true); setLdMsg("Fetching stock details...");

    const stockDetailsForDelete = await fetchStockDetailsForDelete(id, snapshotMode);

    setLdMsg("Deleting...");
    const url = snapshotMode === "inward" ? CC.SI_Delete
              : snapshotMode === "outward" ? CC.SO_Delete
              : CC.ST_Delete;

    const res = await CC.api(url, stockDetailsForDelete, {
      Comid: sess.Comid, Id: String(id),
      Year: sess.FYear, MirrorTable: String(mirrorTable),
      UpdateId: "", LocalDB: "0",
    });
    setLoading(false);
    if (res.ok ?? res.IsSuccess) { toast("✅ Deleted"); await openF5(); }
    else toast("❌ " + (res.message || "Delete Failed"), true);
  };
  setPw({ title: "Delete Password" });
}}
          onClose={() => setF5Open(false)}
          fromDate={stockDate} toDate={stockDate}
          onSearch={openF5}
        />
      )}

      <CC.ToastList toasts={toasts} />

      {/* ── GLOBAL STYLES ── */}
    </div>
  );
}
