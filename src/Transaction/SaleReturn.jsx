// ─────────────────────────────────────────────────────────────────────────────
//  SaleReturn.jsx  —  React Sale Return Form
//  Design mirrors SaleBill.jsx exactly
//  Uses Common.jsx api(), insertapi(), useConfirm(), useToast(), authHeaders()
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState, useEffect, useRef, useCallback,
  useImperativeHandle, forwardRef,
} from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../components/Common";
import Topbar from "../components/Topbar";
import "../TransactionStyle/Salereturn.css";
import "../Master/MasterPage.css";

// ─── SALE RETURN API CONSTANTS ────────────────────────────────────────────────
const SaleReturnMaxNo        = "/api/SaleReturnApp/MaxSaleReturnNo";
const SaleReturnInsertUrl    = "/api/SaleReturnApp/InsertSaleReturn";
const SaleReturnEditUrl      = "/api/SaleReturnApp/EditSaleReturn";
const SaleReturnSelectUrl    = "/api/SaleReturnApp/SelectSaleReturn";
const SaleReturnDeleteUrl    = "/api/SaleReturnApp/DeleteSaleReturn";
const SelectItemByCodeUrl    = "/api/ItemMasterApp/SelectItemMasterbyCodeId";
const ProductListUrl         = "/api/ItemMasterApp/GetProductListV7";
const GetCustomerUrl         = "/api/SupplierApp/SelectSupplierAll";
const SalesManSelectUrl      = "/api/SalesManApp/SelectSalesMan_V7";
const SelectCardMasterUrl    = "/api/SaleApp/SelectSaleType";
const LoginPasswordUrl       = "/api/LoginApp/EditPassword";
const VisibleColumnsUrl      = "/Login/VisibleColumns";
const FocusColumnsUrl        = "/Login/FocusColumns";
const SelectSaleBillUrl      = "/api/SaleReturnApp/SelectSaleBillForReturn"; // get original bill
const SelectExpiryByIdUrl    = "/api/ItemMasterApp/SelectExpStock";

const BASE_URL = "http://localhost:64215";

// ─── SALE RETURN GRID COLUMNS ─────────────────────────────────────────────────
const SR_COLUMNS = [
  { key: "ProductCode",     label: "Product Code",  width: 130, hidden: false },
  { key: "ProductName",     label: "Description",   width: 240, hidden: false, readOnly: true },
  { key: "MRP",             label: "MRP",           width: 90,  hidden: true,  readOnly: true, type: "float" },
  { key: "SaleRate",        label: "Sale Rate",     width: 100, hidden: false, type: "float" },
  { key: "ReturnQty",       label: "Return Qty",    width: 85,  hidden: false, type: "float" },
  { key: "DiscountPercent", label: "Disc%",         width: 75,  hidden: false, type: "float" },
  { key: "TaxPercent",      label: "GST%",          width: 75,  hidden: false, type: "float" },
  { key: "CESSPer",         label: "CESS%",         width: 75,  hidden: true,  type: "float" },
  { key: "TaxAmt",          label: "GST Amt",       width: 90,  hidden: true,  type: "float" },
  { key: "DiscountAmt",     label: "Disc Amt",      width: 90,  hidden: true,  type: "float" },
  { key: "UOM",             label: "UOM",           width: 70,  hidden: true,  readOnly: true },
  { key: "HSNCode",         label: "HSN Code",      width: 100, hidden: true,  readOnly: true },
  { key: "Bat_No",          label: "Batch No",      width: 100, hidden: true },
  { key: "Remarks",         label: "Remarks",       width: 130, hidden: true },
  { key: "Amount",          label: "Amount",        width: 100, hidden: false, readOnly: true, type: "float" },
];

const DEFAULT_COL_SETTINGS = SR_COLUMNS.map(c => ({
  key:     c.key,
  label:   c.label,
  width:   c.width,
  visible: !c.hidden,
}));

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const vn    = v => parseFloat(v) || 0;
const roVal = v => Math.round(v * 100) / 100;
const f2    = v => parseFloat(vn(v).toFixed(2));
const ns    = v => (v == null ? "" : String(v));
const today = () => new Date().toISOString().slice(0, 10);

let _rid = 3000;
const genRid = () => ++_rid;

// ─── ROW CALCULATION ──────────────────────────────────────────────────────────
function calcReturnRow(row) {
  const qty      = vn(row.ReturnQty);
  const saleRate = vn(row.SaleRate);
  const gst      = vn(row.TaxPercent);
  const cess     = vn(row.CESSPer);
  const discPer  = vn(row.DiscountPercent);

  if (qty === 0 || saleRate === 0) {
    return {
      ...row,
      DiscountAmt: 0, TaxAmt: 0, CESSAmount: 0,
      Amount: 0, LandingCost: 0, CTAmount: 0, STAmount: 0,
    };
  }

  const taxTotal    = gst + cess;
  const withoutTax  = taxTotal > 0 ? saleRate / ((taxTotal / 100) + 1) : saleRate;
  const orgRate     = withoutTax * qty;
  const discAmt     = roVal(orgRate * (discPer / 100));
  const landingCost = orgRate - discAmt;
  const ctAmt       = roVal(landingCost * ((gst / 2) / 100));
  const stAmt       = roVal(landingCost * ((gst / 2) / 100));
  const cessAmt     = roVal(landingCost * (cess / 100));
  const gstAmt      = ctAmt + stAmt;
  const amount      = f2(landingCost + gstAmt + cessAmt);

  return {
    ...row,
    WithoutTaxRate: f2(withoutTax),
    OrgRate:        f2(orgRate / qty),
    DiscountAmt:    f2(discAmt),
    LandingCost:    f2(landingCost / qty),
    TaxAmt:         f2(gstAmt),
    CTAmount:       f2(ctAmt),
    STAmount:       f2(stAmt),
    CESSAmount:     f2(cessAmt),
    Amount:         amount,
  };
}

const mkRow = () => ({
  _rid: genRid(), _isNew: true, _dirty: false,
  SRDId: 0, ProductRefId: 0, ProductCode: "", ProductName: "",
  MRP: 0, SaleRate: 0, ReturnQty: "", UOMDecimal: 0,
  TaxPercent: 0, TaxAmt: 0, CESSPer: 0, CESSAmount: 0,
  DiscountPercent: 0, DiscountAmt: 0, LandingCost: 0, OrgRate: 0,
  CTAmount: 0, STAmount: 0, Amount: 0, UOM: "", HSNCode: "",
  StockQty: 0, BatchRefid: null, WithoutTaxRate: 0,
  Remarks: "", Bat_No: "", SaleRefId: 0,
});

const fmtRow = obj => ({
  ...obj,
  _rid: obj._rid || genRid(),
  _isNew: false, _dirty: false,
  MRP:             f2(vn(obj.MRP)),
  SaleRate:        f2(vn(obj.SaleRate)),
  ReturnQty:       ns(obj.ReturnQty || obj.ItemQty || ""),
  TaxPercent:      f2(vn(obj.TaxPercent)),
  TaxAmt:          f2(vn(obj.TaxAmt)),
  CESSPer:         f2(vn(obj.CESSPer)),
  CESSAmount:      f2(vn(obj.CESSAmount)),
  DiscountPercent: f2(vn(obj.DiscountPercent)),
  DiscountAmt:     f2(vn(obj.DiscountAmt)),
  Amount:          f2(vn(obj.Amount)),
  LandingCost:     f2(vn(obj.Landingcost || obj.LandingCost)),
});

// ─── RETURN TYPE OPTIONS ──────────────────────────────────────────────────────
const RETURN_TYPES = [
  { value: "CREDIT", label: "Credit Note" },
  { value: "CASH", label: "Debit Note"  },
];

// ─── COMBOBOX (same as SaleBill) ──────────────────────────────────────────────
function ComboBox({ options, value, onChange, onEnterKey, placeholder, style, inputRef: extRef }) {
  const [q, setQ]           = useState("");
  const [open, setOpen]     = useState(false);
  const [hilite, setHilite] = useState(0);
  const wrapRef = useRef(null);
  const inpRef  = useRef(null);
  const listRef = useRef(null);
  const ref = extRef || inpRef;

  const selectedLabel = options.find(o => String(o.value) === String(value))?.label || "";

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

  const selectOption = (opt) => {
    onChange(String(opt.value));
    setQ(opt.label.toUpperCase());
    setOpen(false);
  };

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
      <input
        ref={ref}
        className="sb-select"
        value={open ? q : selectedLabel.toUpperCase()}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => { setQ(selectedLabel); setOpen(true); setHilite(0); }}
        onChange={e => { setQ(e.target.value.toUpperCase()); setOpen(true); }}
        onKeyDown={handleKeyDown}
        style={{ width: "100%", cursor: "text" }}
      />
      {open && filtered.length > 0 && (
        <div ref={listRef} style={{
          position: "absolute", top: "100%", left: 0, right: 0,
          background: "#fff", border: "1px solid #c5d8f8",
          borderRadius: 4, zIndex: 9999,
          maxHeight: 220, overflowY: "auto",
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
    <div className="mp-ov" style={{ zIndex: 99999 }}>
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

// ─── PRODUCT SEARCH POPUP ─────────────────────────────────────────────────────
function ProductSearchPopup({ products, onSelect, onClose, anchorPos }) {
  const [q, setQ]           = useState("");
  const [hilite, setHilite] = useState(0);
  const inputRef = useRef(null);
  const listRef  = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 30); }, []);

  const filtered = products.filter(p =>
    String(p.PName || "").toLowerCase().includes(q.toLowerCase()) ||
    String(p.Prod_Code || p.ProductCode || "").toLowerCase().includes(q.toLowerCase())
  ).slice(0, 120);

  useEffect(() => { setHilite(0); }, [q]);
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${hilite}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [hilite]);

  return (
    <div className="sb-prod-search" style={{ top: anchorPos?.top || 160, left: anchorPos?.left + 250 || 20 }}>
      <div className="sb-prod-search-hdr">
        <span className="sb-ps-title">🔍 Product Search</span>
        <span className="sb-ps-count">{filtered.length} items</span>
        <button className="sb-ps-close" onClick={onClose}>✕</button>
      </div>
      <div className="sb-ps-input-wrap">
        <span className="sb-ps-icon">⌕</span>
        <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
          placeholder="Type code or name…" className="sb-ps-input"
          onKeyDown={e => {
            if (e.key === "ArrowDown")  { e.preventDefault(); setHilite(h => Math.min(h + 1, filtered.length - 1)); }
            if (e.key === "ArrowUp")    { e.preventDefault(); setHilite(h => Math.max(h - 1, 0)); }
            if (e.key === "Enter")      { e.preventDefault(); if (filtered[hilite]) onSelect(filtered[hilite]); }
            if (e.key === "Escape")     { e.preventDefault(); onClose(); }
          }}
        />
      </div>
      <div className="sb-ps-cols">
        <span style={{ width: 90 }}>Code</span>
        <span style={{ flex: 1 }}>Product Name</span>
        <span style={{ width: 72, textAlign: "right" }}>Sale Rate</span>
        <span style={{ width: 60, textAlign: "right" }}>Stock</span>
      </div>
      <div ref={listRef} className="sb-prod-list">
        {filtered.length === 0
          ? <div className="sb-ps-empty">No products found</div>
          : filtered.map((p, idx) => (
            <div key={p.Id} data-idx={idx}
              className={`sb-prod-item${idx === hilite ? " hi" : ""}`}
              onClick={() => onSelect(p)}
              onMouseEnter={() => setHilite(idx)}>
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
function F5ViewModal({ rows, onEdit, onDelete, onClose, fromDate, toDate, onSearch }) {
  const [from, setFrom] = useState(fromDate);
  const [to, setTo]     = useState(toDate);
  const totalAmt = rows.reduce((s, r) => s + vn(r.NetAmt || r.NetAmount), 0);

  return (
    <div className="mp-ov" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mp-modal-box sb-f5-modal" style={{ width: 980, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div className="mp-modal-hdr">
          <span>📋 Sale Return View (F5)</span>
          <button onClick={onClose}>✕</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
          background: "#f5f9ff", borderBottom: "1px solid #dde6f5", flexShrink: 0, flexWrap: "wrap" }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#4a5568" }}>From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            style={{ height: 28, border: "1px solid #c5d8f8", borderRadius: 4, padding: "0 6px", fontSize: 12 }} />
          <label style={{ fontSize: 11, fontWeight: 700, color: "#4a5568" }}>To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            style={{ height: 28, border: "1px solid #c5d8f8", borderRadius: 4, padding: "0 6px", fontSize: 12 }} />
          <button className="mp-btn sv" style={{ height: 28, padding: "0 14px", fontSize: 11 }}
            onClick={() => onSearch(from, to)}>🔍 Search</button>
          <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: 15 }}>
            Total Return : ₹{f2(totalAmt).toFixed(2)}
          </span>
        </div>
        <div className="mp-modal-body" style={{ flex: 1, overflowY: "auto", padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ color: "#fff", position: "sticky", top: 0, zIndex: 2 }}>
                <th style={{ background:"var( --clr-primary-dark)",padding: "6px 10px", textAlign: "left" }}>Return No</th>
                <th style={{ background:"var( --clr-primary-dark)",padding: "6px 10px", textAlign: "left" }}>Return Date</th>
                <th style={{ background:"var( --clr-primary-dark)",padding: "6px 10px", textAlign: "left" }}>Customer</th>
                <th style={{ background:"var( --clr-primary-dark)",padding: "6px 10px", textAlign: "left" }}>Type</th>
                <th style={{ background:"var( --clr-primary-dark)",padding: "6px 10px", textAlign: "right" }}>Net Amt</th>
                <th style={{ background:"var( --clr-primary-dark)",padding: "6px 10px", textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "#94a3b8", padding: 20 }}>No records found.</td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={r.Id || i} style={{
                  background: i % 2 === 0 ? "#fff" : "#fafbff",
                  borderBottom: "1px solid #eaecf4",
                }}>
                  <td style={{ padding: "5px 10px", fontWeight: 700 }}>
                    {r.SaleReturnNoDisplay || r.SaleReturnNo || r.SaleNo}
                  </td>
                  <td style={{ padding: "5px 10px" }}>{String(r.ReturnDate || r.SaleDate || "").slice(0, 10)}</td>
                  <td style={{ padding: "5px 10px" }}>{r.CustomerName}</td>
                  <td style={{ padding: "5px 10px" }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                      background: r.LorryNo === "CRN" ? "#fef2f2" : "#fefce8",
                      color:      r.LorryNo === "CRN" ? "#dc2626"  : "#ca8a04",
                    }}>{r.LorryNo === "CRN" ? "Credit Note" : "Debit Note"}</span>
                  </td>
                  <td style={{ padding: "5px 10px", textAlign: "right", fontWeight: 700 }}>
                    ₹{f2(vn(r.NetAmt || r.NetAmount)).toFixed(2)}
                  </td>
                  <td style={{ padding: "5px 10px", textAlign: "center" }}>
                    <button onClick={() => onEdit(r.Id)} style={{
                      marginRight: 6, padding: "3px 10px", fontSize: 11, borderRadius: 4,
                      border: "1px solid #c5d8f8", background: "#e8f0fe",
                      color: "#1f65de", fontWeight: 600, cursor: "pointer",
                    }}>✏ Edit</button>
                    <button onClick={() => onDelete(r.Id, r.SaleReturnNoDisplay || r.BillNo)} style={{
                      padding: "3px 10px", fontSize: 11, borderRadius: 4,
                      border: "1px solid #fecaca", background: "#fee2e2",
                      fontWeight: 600, cursor: "pointer",
                    }}>🗑 Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mp-modal-ftr">
          <button className="mp-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── F12 COLUMN SETTINGS ─────────────────────────────────────────────────────
function F12Popup({ colSettings, comid, onSave, onClose, toast }) {
  const [local, setLocal] = useState(colSettings.map(s => ({ ...s })));
  const toggle = key => setLocal(prev => prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
  const setWid = (key, w) => setLocal(prev => prev.map(c => c.key === key ? { ...c, width: parseInt(w) || c.width } : c));

  const handleSave = async () => {
    const payload = local.map(c => ({
      Comid: parseInt(comid) || 1,
      filename: "SaleReturn",
      column: c.key,
      Visible: c.visible === true,
      Width: parseInt(c.width) || 100,
    }));
    try {
      const res  = await fetch(CC.BASE_URL + VisibleColumnsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", ...CC.authHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) { toast?.("✅ Column settings saved"); onSave(local); }
      else { toast?.("⚠️ Saved locally"); onSave(local); }
    } catch { onSave(local); }
  };

  return (
    <div className="mp-ov">
      <div className="mp-modal-box" style={{ width: 500, maxHeight: "82vh" }}>
        <div className="mp-modal-hdr">
          <span>⚙ Return Grid Column Settings (F12)</span>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="mp-modal-body" style={{ overflowY: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
            <thead>
              <tr>
                {["Column", "Visible", "Width (px)"].map(h => (
                  <th key={h} style={{  color: "#fff", padding: "6px 10px", textAlign: "left", fontWeight: 600, position: "sticky", top: 0, zIndex: 2 }}>{h}</th>
                ))}
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

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function SaleReturn() {
  const navigate               = useNavigate();
  const { confirm, ConfirmUI } = CC.useConfirm();
  const { toast, toasts }      = CC.useToast();

  // ── Column Settings ──────────────────────────────────────────────────────
  const [colSettings, setColSettings] = useState(DEFAULT_COL_SETTINGS);
  const [f12Open,     setF12Open]     = useState(false);

  const visCols = colSettings.filter(c => c.visible);

  const loadColCfg = useCallback(async (comid) => {
    try {
      const url = `${CC.BASE_URL}/Content/Appdata/Visible/${comid}/SaleReturn.json?v=${Date.now()}`;
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

  // ── Session ──────────────────────────────────────────────────────────────
  const [sess] = useState(() => {
    try {
      const main0 = (CC.getLocal("Mainsetting")    || [{}])[0] || {};
      const com0  = (CC.getLocal("Companysetting") || [{}])[0] || {};
      const Comid = CC.getStr("Comid")  || "1";
      const MComid = CC.getStr("MComid") || Comid;
      const isCC  = !!main0.CommonCompany;
      return {
        Comid:        isCC ? MComid : Comid,
        MComid,
        BillNoType:   com0.BillType    || "Daily Reset On Company",
        BillNoPrefix: com0.BillPrefix  || "",
        BillNoDigit:  com0.NumberDigit || 0,
        CashId:       CC.getStr("CustomerCashid") || "0",
        CashierId:    CC.getStr("CashierRefid")   || "0",
        CommonCompany: isCC,
        DayClose:     !!main0.DayClose,
        BillFormatName: com0.SaleBillFormat || "Default",
      };
    } catch {
      return {
        Comid: "1", MComid: "1",
        BillNoType: "Daily Reset On Company", BillNoPrefix: "", BillNoDigit: 0,
        CashId: "0", CashierId: "0", CommonCompany: false, DayClose: false,
        BillFormatName: "Default",
      };
    }
  });

  // ── State ─────────────────────────────────────────────────────────────────
  const [perm,         setPerm]         = useState({ View: 0, Add: 0, Edit: 0, Delete: 0 });
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [customers,  setCustomers]  = useState([]);
  const [salesmen,   setSalesmen]   = useState([]);

  const [returnNo,   setReturnNo]   = useState("");
  const [returnDate, setReturnDate] = useState(today());
  const [custId,     setCustId]     = useState("");
  const [custMobile, setCustMobile] = useState("");
  const [remarks,    setRemarks]    = useState("");
  const [returnType, setReturnType] = useState("CREDIT"); // CRN = Credit Note, DBN = Debit Note
  const [editId,     setEditId]     = useState(0);
  const [origBillNo, setOrigBillNo] = useState(""); // original sale bill no for return

  const [rows,       setRows]       = useState([mkRow()]);
  const [selRid,     setSelRid]     = useState(null);
  const [totals,     setTotals]     = useState({
    GrossAmt: 0, DiscAmt: 0, GSTAmt: 0, CESSAmt: 0, NetAmt: 0,
  });
  const [otherMinus, setOtherMinus] = useState("");
  const [gstSplit,   setGstSplit]   = useState([]);

  const [loading,    setLoading]    = useState(false);
  const [ldMsg,      setLdMsg]      = useState("Loading...");
  const [pw,         setPw]         = useState(null);
  const pwOkRef = useRef(null);

  const [lastReturnNo,  setLastReturnNo]  = useState(() => localStorage.getItem("lastReturnNo")  || "—");
  const [lastReturnAmt, setLastReturnAmt] = useState(() => parseFloat(localStorage.getItem("lastReturnAmt")) || 0);

  const [prodPopup,  setProdPopup]  = useState(null);
  const [prodList,   setProdList]   = useState([]);
  const [f5Open,     setF5Open]     = useState(false);
  const [f5Rows,     setF5Rows]     = useState([]);

  const [billSearchOpen, setBillSearchOpen] = useState(false);
  const [billSearchNo,   setBillSearchNo]   = useState("");

  const rowsRef  = useRef(rows);
  const cellRefs = useRef({});
  const custRef  = useRef(null);
  const remarksRef = useRef(null);

  useEffect(() => { rowsRef.current = rows; }, [rows]);

  const regCell = (rid, key, el) => {
    if (!cellRefs.current[rid]) cellRefs.current[rid] = {};
    if (el) cellRefs.current[rid][key] = el;
    else delete cellRefs.current[rid]?.[key];
  };

  const validRows = rows.filter(r => r.ProductRefId && vn(r.ReturnQty) > 0);
  const itemCount = validRows.length;
  const totalQty  = validRows.reduce((s, r) => s + vn(r.ReturnQty), 0);

  // ── Permission check ──────────────────────────────────────────────────────
  useEffect(() => {
    const menuStr = localStorage.getItem("menulist");
    if (!menuStr) {
      alert("Session Close Please Login !!!.");
      navigate("/");
      return;
    }
    const menulist = JSON.parse(menuStr);
    // Adjust PageName to match your menu setup
    const menudata = menulist.filter(o =>
      o.PageName === "Sale Return" || o.PageName === "SaleReturn" || o.PageName === "Billing-SaleReturn"
    );
    if (!menudata || menudata.length === 0 || menudata[0].View === 0) {
      alert("Page Access Permission Denied !!!");
      setTimeout(() => navigate("/Home"), 3000);
      return;
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
      navigate("/");
      return true;
    }
    return false;
  }, [navigate]);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthorized) return;
    (async () => {
      setLoading(true); setLdMsg("Loading...");
      await Promise.all([loadDropdowns(), loadReturnNo(), loadColCfg(sess.Comid)]);
      setLoading(false);
    })();
  // eslint-disable-next-line
  }, [isAuthorized]);

  // ── Load Return No ────────────────────────────────────────────────────────
  const loadReturnNo = useCallback(async () => {
    const res = await CC.api(SaleReturnMaxNo, null, {}, {
      date: returnDate, CId: sess.CashierId, Comid: sess.Comid,
      NumberDigit: sess.BillNoDigit, BillPrefix: sess.BillNoPrefix,
      BillType: sess.BillNoType,
    });
    if (redirectIfDualLogin(res)) return;
    const no = res.No || res.data || res.Data1 || "";
    if (no) setReturnNo(ns(no));
  // eslint-disable-next-line
  }, [sess, returnDate]);

  // ── Load Dropdowns ────────────────────────────────────────────────────────
  const loadDropdowns = useCallback(async () => {
    const comidParam = sess.CommonCompany ? sess.MComid : sess.Comid;
    const [custRes, smRes] = await Promise.all([
      CC.api(GetCustomerUrl, null, {}, { Comid: comidParam, AccountType: "CUSTOMER" }),
      CC.api(SalesManSelectUrl, null, {}, { Comid: comidParam }),
    ]);
    if (redirectIfDualLogin(custRes)) return;
    const pick = r => r.data || r.Data1 || r || [];
    setCustomers(Array.isArray(pick(custRes)) ? pick(custRes) : []);
    setSalesmen (Array.isArray(pick(smRes))   ? pick(smRes)   : []);
  // eslint-disable-next-line
  }, [sess]);

  // ── Totals recalc ─────────────────────────────────────────────────────────
  const recalcTotals = useCallback((rowsArr, oMinus) => {
    let grossAmt = 0, gstAmt = 0, cessAmt = 0, discAmt = 0;
    const gstMap = {};

    rowsArr.forEach(r => {
      if (!r.ProductRefId || !vn(r.ReturnQty)) return;
      const calc = calcReturnRow(r);
      grossAmt += vn(calc.OrgRate) * vn(r.ReturnQty);
      gstAmt   += vn(calc.TaxAmt);
      cessAmt  += vn(calc.CESSAmount);
      discAmt  += vn(calc.DiscountAmt);

      const key = f2(vn(r.TaxPercent));
      if (!gstMap[key]) gstMap[key] = { TaxPercent: key, TaxAmt: 0, CTAmount: 0, STAmount: 0 };
      gstMap[key].TaxAmt   += vn(calc.TaxAmt);
      gstMap[key].CTAmount += vn(calc.CTAmount);
      gstMap[key].STAmount += vn(calc.STAmount);
    });

    const netAmt = f2(grossAmt + gstAmt + cessAmt - discAmt - vn(oMinus));
    setGstSplit(Object.values(gstMap).filter(g => g.TaxAmt > 0));
    setTotals({
      GrossAmt: f2(grossAmt), DiscAmt: f2(discAmt),
      GSTAmt: f2(gstAmt), CESSAmt: f2(cessAmt), NetAmt: netAmt,
    });
    return netAmt;
  }, []);

  useEffect(() => { recalcTotals(rows, otherMinus); }, [rows, otherMinus, recalcTotals]);

  // ── Fill item into row ────────────────────────────────────────────────────
  const fillItemIntoRow = useCallback((rid, item) => {
    setRows(prev => prev.map(r => {
      if (r._rid !== rid) return r;
      const newRow = {
        ...r,
        ProductRefId:    item.Id,
        ProductCode:     item.Prod_Code || item.ProductCode,
        ProductName:     item.PName     || item.ProductName,
        MRP:             f2(vn(item.MRP)),
        SaleRate:        f2(vn(item.SaleRate || item.SalesRate)),
        TaxPercent:      f2(vn(item.GST)),
        CESSPer:         f2(vn(item.CESS)),
        UOM:             item.UOM     || "",
        UOMDecimal:      item.UOMDecimal || 0,
        HSNCode:         item.HSNCode || "",
        StockQty:        vn(item.Stock),
        DiscountPercent: f2(vn(item.SaleDiscountPer)),
        ReturnQty:       item.UOMDecimal === 0 ? "1" : "",
        _dirty: true,
      };
      return newRow;
    }));
    setProdPopup(null);
    setTimeout(() => {
      const el = cellRefs.current[rid]?.["ReturnQty"];
      if (el) { el.focus(); el.select?.(); }
    }, 50);
  }, []);

  // ── Fetch product by code ─────────────────────────────────────────────────
  const fetchProductByCode = useCallback(async (rid, code) => {
    if (!code.trim()) return;
    const res = await CC.api(SelectItemByCodeUrl, null, {}, {
      code: code.trim().toUpperCase(),
      Comid: sess.MComid, CComid: sess.Comid,
      Id: 0, Batchwise: 0,
    });
    if (redirectIfDualLogin(res)) return;
    const arr = Array.isArray(res.data) ? res.data
              : Array.isArray(res.Data1) ? res.Data1 : [];
    if (arr.length === 0) { toast("❌ Invalid Product Code", true); return; }
    if (arr.length === 1) fillItemIntoRow(rid, arr[0]);
    else {
      setProdList(arr);
      setProdPopup({ rid, pos: { top: 200, left: 80 } });
    }
  }, [sess, fillItemIntoRow]);

  // ── Load product list ─────────────────────────────────────────────────────
  const loadProductsForPopup = useCallback(async (rid) => {
    if (prodList.length > 0) { setProdPopup({ rid, pos: { top: 160, left: 80 } }); return; }
    setLoading(true); setLdMsg("Loading products...");
    const res = await CC.api(ProductListUrl, null, {}, { Comid: sess.Comid });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    const arr = Array.isArray(res.data) ? res.data : Array.isArray(res.Data1) ? res.Data1 : [];
    setProdList(arr);
    setProdPopup({ rid, pos: { top: 160, left: 80 } });
  // eslint-disable-next-line
  }, [sess, prodList]);

  // ── Cell change ───────────────────────────────────────────────────────────
  const handleCellChange = useCallback((rid, colKey, value) => {
    setRows(prev => prev.map(r => {
      if (r._rid !== rid) return r;
      const updated = { ...r, [colKey]: value, _dirty: true };
      if (["ReturnQty","SaleRate","TaxPercent","CESSPer","DiscountPercent"].includes(colKey)) {
        return calcReturnRow(updated);
      }
      return updated;
    }));
  }, []);

  // ── Cell keydown ──────────────────────────────────────────────────────────
  const handleCellKeyDown = useCallback((e, rid, colKey) => {
    const editableCols = visCols
      .map(vc => SR_COLUMNS.find(c => c.key === vc.key))
      .filter(Boolean)
      .filter(cd => !cd.readOnly)
      .map(cd => cd.key);

    const COLS   = ["ProductCode", ...editableCols.filter(k => k !== "ProductCode")];
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
          } else {
            focusCell(rid, "ProductCode");
          }
        } else {
          const nextRow = curRows[rowIdx + 1];
          setTimeout(() => {
            const el = cellRefs.current[nextRow._rid]?.["ProductCode"];
            if (el) { el.focus(); el.select?.(); }
          }, 20);
        }
      }
      return;
    }

    if (e.key === "ArrowDown" && rowIdx < rowsRef.current.length - 1) {
      e.preventDefault(); focusCell(rowsRef.current[rowIdx + 1]._rid, colKey);
    }
    if (e.key === "ArrowUp" && rowIdx > 0) {
      e.preventDefault(); focusCell(rowsRef.current[rowIdx - 1]._rid, colKey);
    }
    if (e.key === "ArrowRight" && colIdx < COLS.length - 1) {
      e.preventDefault(); focusCell(rid, COLS[colIdx + 1]);
    }
    if (e.key === "ArrowLeft" && colIdx > 0) {
      e.preventDefault(); focusCell(rid, COLS[colIdx - 1]);
    }
    if (e.key === "Delete")  { e.preventDefault(); doDeleteRow(rid); }
    if (e.key === " " && colKey === "ProductCode") {
      e.preventDefault(); loadProductsForPopup(rid);
    }
  // eslint-disable-next-line
  }, [visCols, fetchProductByCode, loadProductsForPopup]);

  // ── Delete row ────────────────────────────────────────────────────────────
  const doDeleteRow = useCallback(async (rid) => {
    const ok = await confirm("Do you want to Delete this Row?");
    if (!ok) return;
    setRows(prev => {
      const next = prev.filter(r => r._rid !== rid);
      return next.length === 0 ? [mkRow()] : next;
    });
  }, [confirm]);
  const username = localStorage.getItem("username") || "";
  // ── Load original sale bill for return ────────────────────────────────────
  const loadOriginalBill = useCallback(async () => {
    if (!billSearchNo.trim()) { toast("❌ Enter Bill No to search", true); return; }
    setLoading(true); setLdMsg("Loading bill...");
    const res = await CC.api(SelectSaleBillUrl, null, {}, {
      BillNo: billSearchNo.trim(), Comid: sess.Comid,
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;

    const arr = Array.isArray(res.data) ? res.data
              : Array.isArray(res.Data1) ? res.Data1 : [];

    if (arr.length === 0) { toast("❌ Bill not found", true); return; }

    // Fill customer
    const master = arr[0];
    if (master.CustomerRefId) {
      setCustId(ns(master.CustomerRefId));
      const found = customers.find(c => String(c.Id) === ns(master.CustomerRefId));
      setCustMobile(found?.MobileNo || "");
    }

    // Fill items from original bill (set return qty to 0 — user fills)
    const details = master.SaleDetails || arr;
    const loadedRows = details.map(d => calcReturnRow(fmtRow({
      ...mkRow(), ...d, _rid: genRid(),
      ReturnQty: "",   // user enters how much to return
      SaleRefId: master.Id || 0,
    })));
    setRows(loadedRows.length > 0 ? loadedRows : [mkRow()]);
    toast("✅ Bill loaded — enter return quantities");
    setBillSearchOpen(false);
  // eslint-disable-next-line
  }, [billSearchNo, sess, customers]);

  // ── Clear form ────────────────────────────────────────────────────────────
  const clearForm = useCallback(async () => {
    setEditId(0);
    setCustId(""); setCustMobile(""); setRemarks("");
    setOrigBillNo(""); setBillSearchNo(""); setOtherMinus("");
    setRows([mkRow()]);
    setSelRid(null);
    await loadReturnNo();
    setTimeout(() => {
      const firstRow = rowsRef.current[0];
      if (firstRow) cellRefs.current[firstRow._rid]?.["ProductCode"]?.focus();
    }, 100);
  }, [loadReturnNo]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const doSave = useCallback(async () => {
    if (!perm.Add && !perm.Edit) { toast("❌ Permission Denied", true); return; }
    if (!custId) { toast("❌ Select a Customer", true); return; }
    const vRows = rows.filter(r => r.ProductRefId && vn(r.ReturnQty) > 0);
    if (vRows.length === 0) { toast("❌ Add at least one return item", true); return; }

    const ok = await confirm("Do you want to Save Sale Return?");
    if (!ok) return;

    setLoading(true); setLdMsg("Saving...");
    const custObj = customers.find(c => String(c.Id) === String(custId));

    const returndetails = vRows.map(r => ({
      SRDId:           r.SRDId || 0,
      ProductRefId:    r.ProductRefId,
      ProductCode:     r.ProductCode,
      ProductName:     r.ProductName,
      MRP:             f2(vn(r.MRP)),
      SaleRate:        f2(vn(r.SaleRate)),
      ItemQty:         f2(vn(r.ReturnQty)),
      Amount:          f2(vn(r.Amount)),
      TaxPercent:      f2(vn(r.TaxPercent)),
      TaxAmt:          f2(vn(r.TaxAmt)),
      CESSPer:         f2(vn(r.CESSPer)),
      CESSAmount:      f2(vn(r.CESSAmount)),
      DiscountPercent: f2(vn(r.DiscountPercent)),
      DiscountAmt:     f2(vn(r.DiscountAmt)),
      Landingcost:     f2(vn(r.LandingCost)),
      CTAmount:        f2(vn(r.CTAmount)),
      STAmount:        f2(vn(r.STAmount)),
      UOM:             r.UOM    || "",
      HSNcode:         r.HSNCode || "",
      StockQty:        vn(r.StockQty),
      BatchRefid:      r.BatchRefid || null,
      Bat_No:          r.Bat_No || "",
      SaleRefId:       r.SaleRefId || 0,
      remarks:         r.Remarks || "",
    }));

    const payload = [{
      Id:               editId,
      CustomerRefId:    custId ? parseInt(custId) : parseInt(sess.CashId),
      CompanyRefId:     parseInt(sess.Comid),
      SaleReturnNoDisplay: returnNo,
      SaleDate:       returnDate,
      SaleType:         returnType,
      LorryNo:          returnType, // CRN or DBN
      OtherssubAmt:     vn(otherMinus),
      Grossamt:         totals.GrossAmt,
      taxamount:        totals.GSTAmt,
      CESSAmount:       totals.CESSAmt,
      discamount:       totals.DiscAmt,
      NetAmount:        totals.NetAmt,
      Remarks:          remarks,
      CashierRefId:     parseInt(sess.CashierId) || 0,
      DeleteStatus:     true,
      CustomerName:     custObj?.AccountName || "",
      Address1:         custObj?.Address1    || "",
      Address2:         custObj?.Address2    || "",
      City:             custObj?.City        || "",
      PhoneNo:          custObj?.MobileNo    || "",
      TinNo:            custObj?.GSTINNo     || "",
      IGSTBill:         custObj?.IGSTBill    || "GST",
      Modified_By: username,
      ModifiedStatus:   editId > 0 ? 1 : 0,
      Modified_Date:    returnDate,
      SaleReturnDetails: returndetails,
    }];

    const headers = {
      "Comid":      String(sess.Comid),
      "cashid":     String(sess.CashId),
      "BillType":   sess.BillNoType,
      "BillPerfix": sess.BillNoPrefix,
      "BillDigit":  String(sess.BillNoDigit),
      "DayClose":   sess.DayClose ? "1" : "0",
      "MirrorTable": "0", "LocalDB": "2",
    };

    const res = await CC.insertapi(SaleReturnInsertUrl, payload, headers);
    setLoading(false);
    if (redirectIfDualLogin(res)) return;

    if (res.ok ?? res.IsSuccess) {
      const savedNo = res.BillNo || res.Data2 || returnNo;
      localStorage.setItem("lastReturnNo",  savedNo);
      localStorage.setItem("lastReturnAmt", totals.NetAmt.toString());
      setLastReturnNo(savedNo);
      setLastReturnAmt(totals.NetAmt);
      toast("✅ Sale Return Saved");
      await clearForm();
    } else {
      toast("❌ " + (res.Message || res.message || "Save Failed"), true);
    }
  // eslint-disable-next-line
  }, [perm, confirm, clearForm, sess, totals, rows, custId, remarks,
      returnNo, returnDate, editId, otherMinus, customers, returnType]);

  // ── Delete return ─────────────────────────────────────────────────────────
  const doDeleteReturn = useCallback(async () => {
    if (!editId) { toast("No return to delete", true); return; }
    if (!perm.Delete) { toast("❌ Delete Permission Denied", true); return; }
    const ok = await confirm("Do you want to Cancel this Return?");
    if (!ok) return;
    setLoading(true);
    const headers = {
      Comid:    String(sess.Comid),
      Cid:      String(sess.CashierId),
      DayClose: sess.DayClose ? "1" : "0",
      SaleDate: returnDate,
      Id:       String(editId),
    };
    const res = await CC.api(SaleReturnDeleteUrl, [], headers, null);
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res.ok ?? res.IsSuccess) { toast("✅ Return Deleted Successfully"); await clearForm(); }
    else toast("❌ " + (res.message || res.Message || "Delete Failed"), true);
  // eslint-disable-next-line
  }, [editId, perm, confirm, sess, clearForm, returnDate]);

  // ── F5 view ───────────────────────────────────────────────────────────────
  const openF5 = useCallback(async (from = returnDate, to = returnDate) => {
    if (!perm.Edit) { toast("❌ Edit Permission Denied", true); return; }
    setLoading(true); setLdMsg("Loading returns...");
    const res = await CC.api(SaleReturnSelectUrl, null, {}, {
      Comid: sess.Comid, Fromdate: from, Todate: to, Id: 0,
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    const dataNode = Array.isArray(res?.Data) ? res.Data[0]
                   : Array.isArray(res?.data) ? res.data[0] : {};
    const master   = dataNode?.salereturnmaster || dataNode?.salemaster || [];
    setF5Rows(Array.isArray(master) ? master : []);
    setF5Open(true);
  }, [sess, returnDate, perm, redirectIfDualLogin]);

  // ── Edit return ───────────────────────────────────────────────────────────
  const doEditReturn = useCallback(async (id) => {
    setF5Open(false);
    if (!perm.Edit) { toast("❌ Edit Permission Denied", true); return; }
    setLoading(true); setLdMsg("Loading return...");
    const res = await CC.api(SaleReturnEditUrl, null, {}, {
      Id: id, Comid: sess.Comid, CId: 0,
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (!(res.ok ?? res.IsSuccess)) { toast("❌ " + (res.message || "Load Failed"), true); return; }
    const data = Array.isArray(res.Data) ? res.Data[0] : res.data;
    if (!data) { toast("❌ No data found", true); return; }

    const master  = Array.isArray(data) ? data[0] : data;
    const details = master.SaleReturnDetails || master.SaleDetails || [];

    setEditId(master.Id || id);
    setReturnNo(ns(master.SaleReturnNoDisplay || master.SaleReturnNo));
    setReturnDate(String(master.ReturnDate || "").slice(0, 10) || today());
    setReturnType(master.LorryNo || "CRN");
    setCustId(ns(master.CustomerRefId));
    const found = customers.find(c => String(c.Id) === ns(master.CustomerRefId));
    setCustMobile(found?.MobileNo || "");
    setRemarks(ns(master.Remarks));
    setOtherMinus(ns(master.OtherssubAmt || ""));
    const loadedRows = details.map(r => calcReturnRow(fmtRow({ ...mkRow(), ...r, _rid: genRid() })));
    setRows(loadedRows.length > 0 ? loadedRows : [mkRow()]);
  // eslint-disable-next-line
  }, [sess, perm, customers]);

  const handleF5Delete = useCallback((id, billNo) => {
    pwOkRef.current = async () => {
      const ok = await confirm(`Cancel Return "${billNo}"?`);
      if (!ok) return;
      setLoading(true);
      const headers = {
        Comid: String(sess.Comid), Cid: String(sess.CashierId),
        DayClose: sess.DayClose ? "1" : "0", SaleDate: returnDate, Id: String(id),
      };
      const res = await CC.api(SaleReturnDeleteUrl, [], headers, null);
      setLoading(false);
      if (redirectIfDualLogin(res)) return;
      if (res.ok ?? res.IsSuccess) {
        toast("✅ Return Deleted");
        await openF5();
      } else {
        toast("❌ " + (res.message || "Delete Failed"), true);
      }
    };
    setPw({ title: "Delete Password" });
  }, [sess, returnDate, confirm, toast, redirectIfDualLogin, openF5]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = e => {
      if (prodPopup || f5Open || pw || f12Open || billSearchOpen) return;
      if (e.key === "F2")  { e.preventDefault(); doSave(); }
      if (e.key === "F5")  { e.preventDefault(); openF5(); }
      if (e.key === "F9")  { e.preventDefault(); if (!editId) return; pwOkRef.current = doDeleteReturn; setPw({ title: "F9 Delete Password" }); }
      if (e.key === "F10") { e.preventDefault(); confirm("Do You Want To Clear?").then(ok => ok && clearForm()); }
      if (e.key === "F12") { e.preventDefault(); setF12Open(true); }
      if (e.key === "Escape") { e.preventDefault(); confirm("Do You Want To Quit?").then(ok => ok && navigate(-1)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line
  }, [prodPopup, f5Open, pw, f12Open, billSearchOpen,
      doSave, openF5, doDeleteReturn, clearForm, editId]);

  if (!isAuthorized) return null;

  const RIGHT_KEYS = new Set([
    "Amount","SaleRate","ReturnQty","MRP","TaxPercent","DiscountPercent",
    "TaxAmt","CESSAmount","DiscountAmt","CESSPer",
  ]);

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="sb-wrap">
      {ConfirmUI}

      <Topbar />

      <div className="sb-body">

        {/* ── HEADER PANEL ── */}
        <div className="sb-header-panel" >

          {/* Action Buttons */}
          <div className="sb-action-btns">
            <button className="sb-action-btn" onClick={doSave} title="F2 Save Return"
             >
              <span className="btn-icon">💾</span><span>F2</span>
            </button>
            <button className="sb-action-btn" onClick={() => { if (!editId) return; pwOkRef.current = doDeleteReturn; setPw({ title: "F9 Delete" }); }}
              title="F9 Delete" >
              <span className="btn-icon">🗑</span><span>F9</span>
            </button>
            <button className="sb-action-btn" onClick={clearForm} title="F10 Clear">
              <span className="btn-icon">🔄</span><span>F10</span>
            </button>
            <button className="sb-action-btn" onClick={() => setF12Open(true)} title="F12 Columns">
              <span className="btn-icon">⚙</span><span>F12</span>
            </button>
          </div>

          <div className="sb-divider" />

          {/* Center Fields */}
          <div className="sb-fields-center">

            {/* Return Type + Bill Search */}
            <div className="sb-field-row">
              <span className="sb-field-lbl">Return Type</span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {RETURN_TYPES.map(rt => (
                  <label key={rt.value} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                    <input type="radio" name="returnType" value={rt.value}
                      checked={returnType === rt.value}
                      onChange={() => setReturnType(rt.value)}
                     
                    />
                    <span style={{ color: returnType === rt.value ? "var(--clr-primary)" : "#4a5568" }}>{rt.label}</span>
                  </label>
                ))}
              </div>
              <span className="sb-field-lbl-sm" style={{ marginLeft: 16 }}>Bill No</span>
              <input
                value={billSearchNo}
                onChange={e => setBillSearchNo(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === "Enter") loadOriginalBill(); }}
                placeholder="Original Bill No..."
                style={{ height: 26, border: "1px solid #c5d8f8", borderRadius: 4, padding: "0 8px", fontSize: 12, width: 130, outline: "none" }}
              />
              <button onClick={loadOriginalBill}
                style={{ height: 26, padding: "0 10px", background: " #1f65de", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                🔍 Load
              </button>
            </div>

            {/* Customer Row */}
            <div className="sb-field-row">
              <span className="sb-field-lbl">Customer</span>
              <ComboBox
                inputRef={custRef}
                options={[{ value: "", label: "" }, ...customers.map(c => ({ value: String(c.Id), label: c.AccountName }))]}
                value={custId}
                onChange={v => { setCustId(v); const f = customers.find(c => String(c.Id) === v); setCustMobile(f?.MobileNo || ""); }}
                onEnterKey={() => { const fr = rowsRef.current[0]; if (fr) cellRefs.current[fr._rid]?.["ProductCode"]?.focus(); }}
                placeholder="-- Select Customer --"
              />
              {custMobile && (
                <>
                  <span className="sb-field-lbl-sm" style={{ marginLeft: 8 }}>Mobile</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#1f65de", background: "#e8f0fe", borderRadius: 4, padding: "1px 8px", border: "1px solid #c5d8f8" }}>
                    {custMobile}
                  </span>
                </>
              )}
            </div>

          </div>

          <div className="sb-divider" />

          {/* Bill Info */}
          <div className="sb-bill-info">
            <div style={{ fontSize: 20, fontWeight: 800, color: " #1f65de", letterSpacing: 0.5 }}>
              ₹{totals.NetAmt.toFixed(2)}
            </div>
            <div className="sb-bill-row">
              <label>Return No</label>
              <span style={{ color: " #1f65de" }}>{returnNo || "—"}</span>
            </div>
            <div className="sb-bill-row">
              <label>Return Date</label>
              <input type="date" className="sb-date-input" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
            </div>
            {editId > 0 && <div style={{ fontSize: 10, color: " #1f65de", fontWeight: 700 }}>✏️ EDIT MODE</div>}
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div className="sb-content">

          {/* ── RETURN GRID ── */}
          <div className="sb-grid-wrap">
            <div className="sb-grid-scroll">
              <table className="sb-tbl">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>S.No</th>
                    {visCols.map(c => (
                      <th key={c.key} style={{
                        width: c.width, minWidth: c.width,
                        textAlign: RIGHT_KEYS.has(c.key) ? "right" : undefined,
                       
                      }}>{c.label}</th>
                    ))}
                    <th style={{ width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row._rid}
                      className={selRid === row._rid ? "sel" : ""}
                      onClick={() => setSelRid(row._rid)}>
                      <td className="sb-sno">{idx + 1}</td>
                      {visCols.map(col => {
                        const m       = SR_COLUMNS.find(c => c.key === col.key) || {};
                        const val     = row[col.key];
                        const isRight = RIGHT_KEYS.has(col.key);
                        const isRO    = !!m.readOnly;
                        const isFloat = m.type === "float";
                        const isInt   = m.type === "int";
                        const isAmt   = col.key === "Amount";

                        return (
                          <td key={col.key} style={{ textAlign: isRight ? "right" : undefined }}>
                            {isRO && col.key !== "ProductName" ? (
                              <span className="sb-cell-calc" style={{
                                display: "block", padding: "0 4px",
                                color: isAmt ? " #1f65de" : undefined,
                                fontWeight: isAmt ? 700 : undefined,
                              }}>
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
                            ) : (isFloat || isInt) ? (
                              <input
                                ref={el => regCell(row._rid, col.key, el)}
                                className={`sb-cell-input${isRight ? " right" : ""}`}
                                type="number"
                                step={isInt ? "1" : (col.key === "ReturnQty" && row.UOMDecimal === 0 ? "1" : "0.01")}
                                value={val === 0 && !row.ProductRefId ? "" : (val ?? "")}
                                onChange={e => handleCellChange(row._rid, col.key, e.target.value)}
                                onKeyDown={e => handleCellKeyDown(e, row._rid, col.key)}
                                onFocus={() => setSelRid(row._rid)}
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

          {/* ── SIDE PANEL ── */}
          <div className="sb-payment-panel">

            {/* Remarks + Other Deduction */}
            <div style={{ background: "#fff", border: "1px solid #c5d8f8", borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
              <div style={{  color: "#fff", fontSize: 11, fontWeight: 700, padding: "5px 10px" }}>
                📝 Return Details
              </div>
              <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#4a5568", minWidth: 70 }}>Others(-)</label>
                  <input className="sb-pay-input" type="number" step="0.01"
                    value={otherMinus} onChange={e => setOtherMinus(e.target.value)} placeholder="0.00"
                    style={{ width: "100%", border: "1px solid #c5d8f8", borderRadius: 3 }} />
                </div>
                <input
                  className="sb-remarks-input"
                  placeholder="Remarks..."
                  ref={remarksRef}
                  value={remarks}
                  onChange={e => setRemarks(e.target.value.toUpperCase())}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); doSave(); } }}
                  style={{ borderColor: " #c5d8f8" }}
                />
              </div>
            </div>

            {/* Totals */}
            <div className="sb-totals" style={{ border: "1px solid var(--clr-primary-light)" }}>
              <div className="sb-total-row"><label>Gross Amt</label><span>{totals.GrossAmt.toFixed(2)}</span></div>
              <div className="sb-total-row"><label>Disc Amt</label><span>{totals.DiscAmt.toFixed(2)}</span></div>
              <div className="sb-total-row"><label>GST Amt</label><span>{totals.GSTAmt.toFixed(2)}</span></div>
              <div className="sb-total-row"><label>CESS Amt</label><span>{totals.CESSAmt.toFixed(2)}</span></div>
              <div className="sb-total-sep" />
              <div className="sb-total-row net">
                <label style={{ color: " #1f65de" }}>Return Total</label>
                <span style={{ color: " #1f65de" }}>₹{totals.NetAmt.toFixed(2)}</span>
              </div>
            </div>

            {/* GST Split */}
            {gstSplit.length > 0 && (
              <div style={{ background: "var(--clr-primary-dark)", border: "1px solid var(--clr-primary-light)", borderRadius: 6, overflow: "hidden", flexShrink: 0, maxHeight: 72, display: "flex", flexDirection: "column" }}>
                <div style={{  color: "#fff", fontSize: 10.5, fontWeight: 700, padding: "3px 10px", flexShrink: 0 }}>
                  GST Split
                </div>
                <div style={{ overflowY: "auto", flex: 1 }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
                    <thead>
                      <tr>
                        {["GST%", "GST Amt", "CGST", "SGST"].map(h => (
                          <th key={h} style={{ background: "#1b3a8f", color: "#fff", fontSize: 9.5, padding: "2px 6px", border: "1px solid rgba(255,255,255,.15)", textAlign: "right", position: "sticky", top: 0 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gstSplit.map((g, i) => (
                        <tr key={i} style={{ background:"#fff"}}>
                          <td style={{ padding: "2px 6px", border: "1px solid var(--clr-primary-light)", textAlign: "center", fontSize: 10.5 }}>{g.TaxPercent}%</td>
                          <td style={{ padding: "2px 6px", border: "1px solid var(--clr-primary-light)", textAlign: "right", fontSize: 10.5 }}>{f2(g.TaxAmt).toFixed(2)}</td>
                          <td style={{ padding: "2px 6px", border: "1px solid var(--clr-primary-light)", textAlign: "right", fontSize: 10.5 }}>{f2(g.CTAmount).toFixed(2)}</td>
                          <td style={{ padding: "2px 6px", border: "1px solid var(--clr-primary-light)", textAlign: "right", fontSize: 10.5 }}>{f2(g.STAmount).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Bottom Info */}
            <div style={{ background: "#fff", border: "1px solid var(--clr-primary-light)", borderRadius: 6, padding: "6px 10px", flexShrink: 0, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 600, color: "#4a5568" }}>Return Qty</span>
                  <span style={{ background: "#e8f0fe", color: "var(--clr-primary)", fontWeight: 800, fontSize: 13, borderRadius: 4, padding: "1px 10px",border: "1px solid #c5d8f8", }}>
                    {totalQty % 1 === 0 ? totalQty.toFixed(0) : totalQty.toFixed(2)}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 600, color: "#4a5568" }}>Items</span>
                  <span style={{ background: "#e8f0fe",border: "1px solid #c5d8f8", color: "var(--clr-primary)", fontWeight: 800, fontSize: 13, borderRadius: 4, padding: "1px 10px",border: "1px solid #c5d8f8", }}>
                    {itemCount}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, color: "#4a5568", fontSize: 11 }}>Last Return No</span>
                <span style={{ fontWeight: 700,  fontSize: 11 }}>{lastReturnNo}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, color: "#4a5568", fontSize: 11 }}>Last Return Amt</span>
                <span style={{ fontWeight: 700,border: "1px solid #c5d8f8", color: "var(--clr-primary)", fontSize: 11 }}>
                  {lastReturnAmt > 0 ? `₹${lastReturnAmt.toFixed(2)}` : "None"}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* ── BOTTOM TOOLBAR ── */}
        <div className="sb-toolbar" style={{ borderLeftColor: "var(--clr-primary)" }}>
          <button className="sb-btn sv" onClick={doSave} disabled={loading}
            style={{ background: "var(--clr-primary)", borderColor: "var(--clr-primary)" }}>
            💾 F2 Save Return
          </button>
          <button className="sb-btn" onClick={openF5}>📋 F5 View</button>
          <button className="sb-btn" onClick={() => setF12Open(true)}>⚙ F12 Columns</button>
          <button className="sb-btn" onClick={clearForm} disabled={loading}>🔄 F10 Clear</button>
          {editId > 0 && (
            <button className="sb-btn dl"
              onClick={() => { pwOkRef.current = doDeleteReturn; setPw({ title: "F9 Delete Password" }); }}
              disabled={loading}>🗑 F9 Delete</button>
          )}
          <button className="sb-btn dl" onClick={() => navigate(-1)}>✕ Esc Exit</button>
          {loading && <span style={{ fontSize: 11, color: "#6b7a99" }}>⏳ {ldMsg}</span>}
        </div>

      </div>

      {/* ── LOADING OVERLAY ── */}
      {loading && (
        <div className="sb-loader-ov">
          <div className="sb-ldr-box">
            <div className="sb-spin" style={{ borderTopColor: "var(--clr-primary)" }} />
            <div className="sb-ldr-msg">{ldMsg}</div>
          </div>
        </div>
      )}

      {/* ── MODALS ── */}
      {pw && (
        <PwModal title={pw.title} comid={sess.Comid}
          onOk={() => { pwOkRef.current?.(); }}
          onClose={() => setPw(null)} />
      )}

      {f12Open && (
        <F12Popup
          colSettings={colSettings}
          comid={sess.Comid}
          toast={toast}
          onSave={newCols => { setColSettings(newCols); setF12Open(false); }}
          onClose={() => setF12Open(false)}
        />
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
          onEdit={id => { setF5Open(false); doEditReturn(id); }}
          onDelete={handleF5Delete}
          onClose={() => setF5Open(false)}
          fromDate={returnDate}
          toDate={returnDate}
          onSearch={openF5}
        />
      )}

      <CC.ToastList toasts={toasts} />
    </div>
  );
}