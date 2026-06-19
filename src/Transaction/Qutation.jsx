// ─────────────────────────────────────────────────────────────────────────────
//  Quotation.jsx  —  React Quotation Form
//  Design, structure, UI flow, table layout, button styles, popup styles,
//  form alignment, and overall look & feel matches SaleReturn.jsx exactly.
//
//  Header layout (3-panel, same as SaleReturn):
//    Left panel   → Quotation Details (QuotationNo, QuotationDate, QuoteType)
//    Middle panel → Customer Details (Customer, MobileNo+CRM, Verified+Approved)
//    Right panel  → Rs. amount, SalesMan dropdown, Remarks input
//  Bottom totals → Gross Amt, Disc%, Disc Amt | GST Amt, CESS Amt, Coinage | Others(+), Others(-), Net Total
//  Toolbar       → F1 Save | F3 Edit | F5 View | F10 Clear | DEL Delete | ESC Exit
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState, useEffect, useRef, useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../components/Common";
import Topbar from "../components/Topbar";
import "../TransactionStyle/Quotation.css";
import "../Master/MasterPage.css";

// ─── QUOTATION API CONSTANTS ──────────────────────────────────────────────────
const QuotationMaxNo      = "/api/QuotationApp/MaxQuotationNo";
const QuotationInsertUrl  = "/api/QuotationApp/InsertQuotation";
const QuotationEditUrl    = "/api/QuotationApp/EditQuotation";
const QuotationSelectUrl  = "/api/QuotationApp/SelectQuotation";
const QuotationDeleteUrl  = "/api/QuotationApp/DeleteQuotation";
const SelectItemByCodeUrl = "/api/ItemMasterApp/SelectItemMasterbyCodeId";
const ProductListUrl      = "/api/ItemMasterApp/GetProductListV7";
const GetCustomerUrl      = "/api/SupplierApp/SelectSupplierAll";
const SalesManSelectUrl   = "/api/SalesManApp/SelectSalesMan_V7";
const LoginPasswordUrl    = "/api/LoginApp/EditPassword";
const VisibleColumnsUrl   = "/Login/VisibleColumns";
const FocusColumnsUrl     = "/Login/FocusColumns";
const CRMBalanceUrl       = "/api/SalesReportApp/CRMBalanceReport";
const CurrentBalanceUrl   = "/api/SupplierApp/CurrentBalance";

// ─── QUOTATION GRID COLUMNS ───────────────────────────────────────────────────
const QT_COLUMNS = [
  { key: "ProductCode",     label: "Product Code", width: 130, hidden: false },
  { key: "ProductName",     label: "Description",  width: 240, hidden: false, readOnly: true },
  { key: "MRP",             label: "MRP",          width: 90,  hidden: true,  readOnly: true, type: "float" },
  { key: "SaleRate",        label: "Rate",         width: 100, hidden: false, type: "float" },
  { key: "Qty",             label: "Qty",          width: 80,  hidden: false, type: "float" },
  { key: "DiscountPercent", label: "Disc%",        width: 75,  hidden: false, type: "float" },
  { key: "TaxPercent",      label: "GST%",         width: 75,  hidden: false, type: "float" },
  { key: "CESSPer",         label: "CESS%",        width: 75,  hidden: true,  type: "float" },
  { key: "TaxAmt",          label: "GST Amt",      width: 90,  hidden: true,  readOnly: true, type: "float" },
  { key: "DiscountAmt",     label: "Disc Amt",     width: 90,  hidden: true,  readOnly: true, type: "float" },
  { key: "UOM",             label: "UOM",          width: 70,  hidden: true,  readOnly: true },
  { key: "HSNCode",         label: "HSN Code",     width: 100, hidden: true,  readOnly: true },
  { key: "Remarks",         label: "Remarks",      width: 130, hidden: true },
  { key: "Amount",          label: "Amount",       width: 100, hidden: false, readOnly: true, type: "float" },
];

const DEFAULT_COL_SETTINGS = QT_COLUMNS.map(c => ({
  key:     c.key,
  label:   c.label,
  width:   c.width,
  visible: !c.hidden,
}));

// ─── QUOTE TYPE OPTIONS ───────────────────────────────────────────────────────
const QUOTE_TYPES = [
  { value: "QUOTATION", label: "QUOTATION" },
  { value: "ESTIMATE",  label: "ESTIMATE"  },
  { value: "PROFORMA",  label: "PROFORMA"  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const vn    = v => parseFloat(v) || 0;
const roVal = v => Math.round(v * 100) / 100;
const f2    = v => parseFloat(vn(v).toFixed(2));
const ns    = v => (v == null ? "" : String(v));
const today = () => new Date().toISOString().slice(0, 10);

let _rid = 5000;
const genRid = () => ++_rid;

// ─── ROW CALCULATION (same logic as SaleReturn, inclusive GST) ────────────────
function calcQuotRow(row) {
  const qty     = vn(row.Qty);
  const rate    = vn(row.SaleRate);
  const gst     = vn(row.TaxPercent);
  const cess    = vn(row.CESSPer);
  const discPer = vn(row.DiscountPercent);

  if (qty === 0 || rate === 0) {
    return {
      ...row,
      DiscountAmt: 0, TaxAmt: 0, CESSAmount: 0,
      Amount: 0, LandingCost: 0, CTAmount: 0, STAmount: 0,
    };
  }

  const taxTotal   = gst + cess;
  const withoutTax = taxTotal > 0 ? rate / ((taxTotal / 100) + 1) : rate;
  const orgRate    = withoutTax * qty;
  const discAmt    = roVal(orgRate * (discPer / 100));
  const landing    = orgRate - discAmt;
  const ctAmt      = roVal(landing * ((gst / 2) / 100));
  const stAmt      = roVal(landing * ((gst / 2) / 100));
  const cessAmt    = roVal(landing * (cess / 100));
  const gstAmt     = ctAmt + stAmt;
  const amount     = f2(landing + gstAmt + cessAmt);

  return {
    ...row,
    WithoutTaxRate: f2(withoutTax),
    OrgRate:        f2(orgRate / qty),
    DiscountAmt:    f2(discAmt),
    LandingCost:    f2(landing / qty),
    TaxAmt:         f2(gstAmt),
    CTAmount:       f2(ctAmt),
    STAmount:       f2(stAmt),
    CESSAmount:     f2(cessAmt),
    Amount:         amount,
  };
}

const mkRow = () => ({
  _rid: genRid(), _isNew: true, _dirty: false,
  QDId: 0, ProductRefId: 0, ProductCode: "", ProductName: "",
  MRP: 0, SaleRate: 0, Qty: "", UOMDecimal: 0,
  TaxPercent: 0, TaxAmt: 0, CESSPer: 0, CESSAmount: 0,
  DiscountPercent: 0, DiscountAmt: 0, LandingCost: 0, OrgRate: 0,
  CTAmount: 0, STAmount: 0, Amount: 0, UOM: "", HSNCode: "",
  WithoutTaxRate: 0, Remarks: "",
});

const fmtRow = obj => ({
  ...obj,
  _rid: obj._rid || genRid(),
  _isNew: false, _dirty: false,
  MRP:             f2(vn(obj.MRP)),
  SaleRate:        f2(vn(obj.SaleRate)),
  Qty:             ns(obj.Qty || obj.ItemQty || ""),
  TaxPercent:      f2(vn(obj.TaxPercent)),
  TaxAmt:          f2(vn(obj.TaxAmt)),
  CESSPer:         f2(vn(obj.CESSPer)),
  CESSAmount:      f2(vn(obj.CESSAmount)),
  DiscountPercent: f2(vn(obj.DiscountPercent)),
  DiscountAmt:     f2(vn(obj.DiscountAmt)),
  Amount:          f2(vn(obj.Amount)),
  LandingCost:     f2(vn(obj.Landingcost || obj.LandingCost)),
});

// ─── COMBOBOX (identical to SaleReturn) ──────────────────────────────────────
function ComboBox({ options, value, onChange, onEnterKey, placeholder, style, inputRef: extRef, disabled }) {
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

  const selectOption = opt => {
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
        disabled={disabled}
        onFocus={() => { setQ(selectedLabel); setOpen(true); setHilite(0); }}
        onChange={e => { setQ(e.target.value.toUpperCase()); setOpen(true); }}
        onKeyDown={handleKeyDown}
        style={{ width: "100%", cursor: disabled ? "not-allowed" : "text" }}
      />
      {open && !disabled && filtered.length > 0 && (
        <div ref={listRef} style={{
          position: "absolute", top: "100%", left: 0, right: 0,
          background: "#fff", border: "1px solid #c7d8ff",
          borderRadius: 4, zIndex: 9999,
          maxHeight: 220, overflowY: "auto",
          boxShadow: "0 8px 24px rgba(15,155,110,.15)",
        }}>
          {filtered.map((opt, idx) => (
            <div key={opt.value} data-idx={idx}
              onMouseDown={() => selectOption(opt)}
              onMouseEnter={() => setHilite(idx)}
              style={{
                padding: "5px 10px", fontSize: 12, cursor: "pointer",
                background: idx === hilite ? "#d1f5e9" : idx % 2 === 0 ? "#fff" : "#fafbff",
                borderLeft: idx === hilite ? "3px solid #0f9b6e" : "3px solid transparent",
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

// ─── PASSWORD MODAL (identical pattern to SaleReturn) ─────────────────────────
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
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "#0f9b6e" }}>🔐 {title}</div>
        <input type="password" autoFocus value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") verify(); if (e.key === "Escape") onClose(); }}
          style={{ width: "100%", padding: "6px 10px", border: "1px solid #c7d8ff", borderRadius: 4, fontSize: 13, marginBottom: 14, outline: "none" }}
          placeholder="Enter password…" />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="mp-btn" onClick={onClose}>Cancel</button>
          <button className="mp-btn sv" onClick={verify}>OK</button>
        </div>
      </div>
    </div>
  );
}

// ─── PRODUCT SEARCH POPUP (same structure as SaleReturn) ──────────────────────
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
    <div className="sb-prod-search" style={{ top: anchorPos?.top || 160, left: (anchorPos?.left || 0) + 250 }}>
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
        <span style={{ width: 72, textAlign: "right" }}>Rate</span>
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

// ─── F5 VIEW MODAL (same layout / pattern as SaleReturn F5ViewModal) ──────────
function F5ViewModal({ rows, details, onEdit, onDelete, onClose, fromDate, toDate, onSearch }) {
  const [from,       setFrom]       = useState(fromDate);
  const [to,         setTo]         = useState(toDate);
  const [expandedId, setExpandedId] = useState(null);
  const totalAmt = rows.reduce((s, r) => s + vn(r.NetAmt || r.NetAmount || r.Netamt), 0);

  const toggleExpand = (id) => setExpandedId(prev => prev === id ? null : id);

  const getRowDetails = (id) =>
    (details || []).filter(d =>
      String(d.SaleRefId || d.QuotationRefId || d.SaleId || "") === String(id)
    );

  return (
    <div className="mp-ov" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mp-modal-box sb-f5-modal" style={{ width: 980, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div className="mp-modal-hdr">
          <span>📋 Quotation View (F5)</span>
          <button onClick={onClose}>✕</button>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
          background: "#f4f8ff", borderBottom: "1px solid #d6e4ff", flexShrink: 0, flexWrap: "wrap",
        }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#4a5568" }}>From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            style={{ height: 28, border: "1px solid #c7d8ff", borderRadius: 4, padding: "0 6px", fontSize: 12 }} />
          <label style={{ fontSize: 11, fontWeight: 700, color: "#4a5568" }}>To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            style={{ height: 28, border: "1px solid #c7d8ff", borderRadius: 4, padding: "0 6px", fontSize: 12 }} />
          <button className="mp-btn sv" style={{ height: 28, padding: "0 14px", fontSize: 11 }}
            onClick={() => onSearch(from, to)}>🔍 Search</button>
          <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: 15 }}>
            Total : ₹{f2(totalAmt).toFixed(2)}
          </span>
        </div>
        <div className="mp-modal-body" style={{ flex: 1, overflowY: "auto", padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ color: "#fff", position: "sticky", top: 0, zIndex: 2 }}>
                <th style={{ background: "var(--clr-primary-dark)", padding: "6px 6px", width: 28, textAlign: "center" }}></th>
                <th style={{ background: "var(--clr-primary-dark)", padding: "6px 10px", textAlign: "left" }}>Quote No</th>
                <th style={{ background: "var(--clr-primary-dark)", padding: "6px 10px", textAlign: "left" }}>Date</th>
                <th style={{ background: "var(--clr-primary-dark)", padding: "6px 10px", textAlign: "left" }}>Customer</th>
                <th style={{ background: "var(--clr-primary-dark)", padding: "6px 10px", textAlign: "left" }}>Type</th>
                <th style={{ background: "var(--clr-primary-dark)", padding: "6px 10px", textAlign: "right" }}>Net Amt</th>
                <th style={{ background: "var(--clr-primary-dark)", padding: "6px 10px", textAlign: "center" }}>Actions</th>
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
                    <tr style={{ background: i % 2 === 0 ? "#fff" : "#f7faff", borderBottom: "1px solid #eaecf4" }}>
                      {/* ── expand/collapse arrow (matches jQuery rowdetails arrow) ── */}
                      <td style={{ padding: "5px 6px", textAlign: "center", width: 28 }}>
                        <button
                          onClick={() => toggleExpand(rowId)}
                          title={isExpanded ? "Collapse details" : "Expand details"}
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            fontSize: 13, color: "#4f8cff", padding: 0, lineHeight: 1,
                            transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                            transition: "transform 0.15s",
                            display: "inline-block",
                          }}
                        >▶</button>
                      </td>
                      <td style={{ padding: "5px 10px", fontWeight: 700 }}>{r.QuotationNoDisplay || r.SaleNo || r.BillNo || "—"}</td>
                      <td style={{ padding: "5px 10px" }}>{String(r.QuotationDate || r.SaleDate || r.BillDate || "").slice(0, 10)}</td>
                      <td style={{ padding: "5px 10px" }}>{r.CustomerName || r.AccountName || ""}</td>
                      <td style={{ padding: "5px 10px" }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                          background: "#eaf2ff", color: "#2563eb",
                        }}>
                          {r.SaleType || r.QuoteType || "QUOTATION"}
                        </span>
                      </td>
                      <td style={{ padding: "5px 10px", textAlign: "right", fontWeight: 700 }}>
                        ₹{f2(vn(r.NetAmt || r.NetAmount || r.Netamt)).toFixed(2)}
                      </td>
                      <td style={{ padding: "5px 10px", textAlign: "center" }}>
                        <button onClick={() => onEdit(r.Id)} style={{
                          marginRight: 6, padding: "3px 10px", fontSize: 11, borderRadius: 4,
                          border: "1px solid #bfd4ff",
background: "#edf4ff",
color: "#2563eb", fontWeight: 600, cursor: "pointer",
                        }}>✏ Edit</button>
                        <button onClick={() => onDelete(r.Id, r.QuotationNoDisplay || r.BillNo)} style={{
                          padding: "3px 10px", fontSize: 11, borderRadius: 4,
                          border: "1px solid #fecaca", background: "#fee2e2",
                          fontWeight: 600, cursor: "pointer",
                        }}>🗑 Del</button>
                      </td>
                    </tr>
                    {/* ── expanded product details sub-row (matches jQuery initrowdetails nested grid) ── */}
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
                                      { label: "Code",     align: "left"  },
                                      { label: "Description", align: "left" },
                                      { label: "MRP",      align: "right" },
                                      { label: "Rate",     align: "right" },
                                      { label: "Qty",      align: "right" },
                                      { label: "GST(%)",   align: "right" },
                                      { label: "GST Amt",  align: "right" },
                                      { label: "Disc(%)",  align: "right" },
                                      { label: "Disc Amt", align: "right" },
                                    ].map(h => (
                                      <th key={h.label} style={{
                                        background: "#4f8cff", color: "#fff",
                                        padding: "4px 8px", textAlign: h.align,
                                        fontWeight: 600, fontSize: 11,
                                      }}>{h.label}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {rowDetails.map((d, di) => (
                                    <tr key={di} style={{ background: di % 2 === 0 ? "#fff" : "#f7faff", borderBottom: "1px solid #e2e8f0" }}>
                                      <td style={{ padding: "3px 8px" }}>{d.ProductCode || ""}</td>
                                      <td style={{ padding: "3px 8px" }}>{d.ProductName || ""}</td>
                                      <td style={{ padding: "3px 8px", textAlign: "right" }}>{f2(vn(d.MRP)).toFixed(2)}</td>
                                      <td style={{ padding: "3px 8px", textAlign: "right" }}>{f2(vn(d.SaleRate)).toFixed(2)}</td>
                                      <td style={{ padding: "3px 8px", textAlign: "right" }}>{f2(vn(d.ItemQty || d.Qty)).toFixed(2)}</td>
                                      <td style={{ padding: "3px 8px", textAlign: "right" }}>{f2(vn(d.TaxPercent)).toFixed(2)}</td>
                                      <td style={{ padding: "3px 8px", textAlign: "right" }}>{f2(vn(d.TaxAmt)).toFixed(2)}</td>
                                      <td style={{ padding: "3px 8px", textAlign: "right" }}>{f2(vn(d.DiscountPercent)).toFixed(2)}</td>
                                      <td style={{ padding: "3px 8px", textAlign: "right" }}>{f2(vn(d.DiscountAmt)).toFixed(2)}</td>
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
        <div className="mp-modal-ftr">
          <button className="mp-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
// ─── CTRL+G COLUMN REORDER / FOCUS POPUP ─────────────────────────────────────
function CtrlGFocusPopup({ colSettings, comid, mcomid, onSaved, onClose, toast }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const url = `/Content/Appdata/Visible/${mcomid}/QuotationFocus.json?v=${Date.now()}`;
        const res = await fetch(url, { headers: CC.authHeaders?.() || {} });
        let saved = [];
        if (res.ok) { try { saved = await res.json(); } catch {} }

        const base = colSettings
          .filter(c => c.visible)
          .map((c, i) => {
            const sv = Array.isArray(saved) ? saved.find(s => s.column === c.key) : null;
            return {
              key:   c.key,
              label: c.label,
              focus: sv ? sv.Focus === true : true,
              index: sv ? (sv.Index ?? i) : i,
            };
          });
        base.sort((a, b) => a.index - b.index);
        setItems(base);
      } catch {
        setItems(colSettings.filter(c => c.visible).map((c, i) => ({
          key: c.key, label: c.label, focus: true, index: i,
        })));
      } finally {
        setLoading(false);
      }
    })();
  }, [colSettings, mcomid]);

  const toggleFocus = key =>
    setItems(prev => prev.map(it => it.key === key ? { ...it, focus: !it.focus } : it));

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
      filename: "QuotationFocus",
      column:   it.key,
      Index:    i,
      Focus:    it.focus,
      Comid:    parseInt(comid) || 1,
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
    } catch (err) {
      toast?.("⚠️ Save failed: " + err.message);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(10,20,40,.45)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 8700,
    }}>
      <div style={{
        background: "#fff", borderRadius: 10, width: 420, maxHeight: "80vh",
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: "0 16px 48px rgba(31,101,222,.22)", border: "1px solid #d0ddf5",
      }}>
        <div style={{
          background: "linear-gradient(135deg,#1b3a8f 0%,#1f65de 100%)",
          padding: "10px 14px", display: "flex", alignItems: "center",
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", flex: 1 }}>
            ⚡ Ctrl+G — Column Focus & Reorder
          </span>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,.15)", border: "none", color: "#fff",
            width: 22, height: 22, borderRadius: "50%", cursor: "pointer", fontSize: 11,
          }}>✕</button>
        </div>
        <div style={{
          background: "#f0f7ff", borderBottom: "1px solid #dde6f5",
          padding: "6px 12px", fontSize: 10.5, color: "#4a5568",
        }}>
          🖱 <strong>Drag rows</strong> to reorder &nbsp;|&nbsp;
          ☑ <strong>Check</strong> to enable focus navigation
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "6px 0" }}>
          {loading
            ? <div style={{ textAlign: "center", padding: 20, color: "#94a3b8", fontSize: 12 }}>Loading...</div>
            : items.map((it, idx) => (
              <div
                key={it.key}
                draggable
                onDragStart={e => onDragStart(e, idx)}
                onDragOver={e => onDragOver(e, idx)}
                onDrop={e => onDrop(e, idx)}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "6px 14px", cursor: "grab",
                  background: overIdx === idx ? "#deeafb" : dragIdx === idx ? "#e8f0fe" : idx % 2 === 0 ? "#fff" : "#fafbff",
                  borderBottom: "1px solid #f0f4fc",
                  borderLeft: overIdx === idx ? "3px solid #1f65de" : "3px solid transparent",
                  transition: "background .07s",
                  userSelect: "none",
                }}
              >
                <span style={{ color: "#94a3b8", fontSize: 14, cursor: "grab" }}>⠿</span>
                <span style={{
                  width: 22, height: 22, borderRadius: 4,
                  background: "#f0f4fc", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 11, color: "#6b7a99", fontWeight: 700,
                  flexShrink: 0,
                }}>{idx + 1}</span>
                <span style={{ flex: 1, fontSize: 12, color: "#1a2e4a", fontWeight: 500 }}>
                  {it.label}
                </span>
                <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                  <input type="checkbox" checked={!!it.focus}
                    onChange={() => toggleFocus(it.key)} style={{ display: "none" }} />
                  <div style={{
                    width: 34, height: 18, borderRadius: 9,
                    background: it.focus ? "#1f65de" : "#d0d8ea",
                    position: "relative", cursor: "pointer", transition: "background .2s",
                  }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: "50%", background: "#fff",
                      position: "absolute", top: 2,
                      left: it.focus ? 18 : 2, transition: "left .2s",
                      boxShadow: "0 1px 3px rgba(0,0,0,.2)",
                    }} />
                  </div>
                </label>
              </div>
            ))
          }
        </div>
        <div style={{
          display: "flex", gap: 8, justifyContent: "flex-end",
          padding: "10px 14px", borderTop: "1px solid #eaecf4", background: "#f8faff",
        }}>
          <button onClick={onClose} style={{
            padding: "6px 16px", borderRadius: 4, border: "1px solid #c5d8f8",
            background: "#fff", color: "#1a2e4a", fontSize: 12, cursor: "pointer",
          }}>Cancel</button>
          <button onClick={handleSave} style={{
            padding: "6px 16px", borderRadius: 4, border: "none",
            background: "#1f65de", color: "#fff", fontSize: 12,
            cursor: "pointer", fontWeight: 700,
          }}>💾 Save & Apply</button>
        </div>
      </div>
    </div>
  );
}

// ─── F12 COLUMN SETTINGS (mirrors SaleReturn F12Popup) ───────────────────────
function F12Popup({ colSettings, comid, onSave, onClose, toast }) {
  const [local, setLocal] = useState(colSettings.map(s => ({ ...s })));
  const toggle = key => setLocal(prev => prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
  const setWid = (key, w) => setLocal(prev => prev.map(c => c.key === key ? { ...c, width: parseInt(w) || c.width } : c));

  const handleSave = async () => {
    const payload = local.map(c => ({
      Comid: parseInt(comid) || 1,
      filename: "Quotation",
      column: c.key,
      Visible: c.visible === true,
      Width: parseInt(c.width) || 100,
    }));
    try {
      const res = await fetch(VisibleColumnsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", ...CC.authHeaders() },
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
        <div className="mp-modal-hdr">
          <span>⚙ Quotation Grid Column Settings (F12)</span>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="mp-modal-body" style={{ overflowY: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
            <thead>
              <tr>
                {["Column", "Visible", "Width (px)"].map(h => (
                  <th key={h} style={{ color: "#fff", padding: "6px 10px", textAlign: "left", fontWeight: 600, position: "sticky", top: 0, zIndex: 2, background: "#075e40" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {local.map((c, i) => (
                <tr key={c.key} style={{ background: i % 2 === 0 ? "#f7faff" : "#fff" }}>
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

// ─── INLINE STYLE CONSTANTS (same as SaleReturn) ─────────────────────────────
const fieldInput = {
  height: 24,
  border: "1px solid #c7d8ff",
  borderRadius: 3,
  padding: "0 6px",
  fontSize: 12,
  outline: "none",
  background: "#fff",
  color: "#1a2e4a",
};

const fieldLabel = {
  fontSize: 12,
  fontWeight: 600,
  color: "#4a5568",
  minWidth: 80,
  flexShrink: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function Quotation() {
  const navigate               = useNavigate();
  const { confirm, ConfirmUI } = CC.useConfirm();
  const { toast, toasts }      = CC.useToast();

  // ── Column Settings ────────────────────────────────────────────────────────
  const [colSettings, setColSettings] = useState(DEFAULT_COL_SETTINGS);
  const [f12Open,     setF12Open]     = useState(false);
  const visCols = colSettings.filter(c => c.visible);

  const loadColCfg = useCallback(async (comid) => {
    try {
      const url = `Content/Appdata/Visible/${comid}/Quotation.json?v=${Date.now()}`;
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

  // ── Session ────────────────────────────────────────────────────────────────
  const [sess] = useState(() => {
    try {
      const main0 = (CC.getLocal("Mainsetting")    || [{}])[0] || {};
      const com0  = (CC.getLocal("Companysetting") || [{}])[0] || {};
      const Comid  = CC.getStr("Comid")  || "1";
      const MComid = CC.getStr("MComid") || Comid;
      const isCC   = !!main0.CommonCompany;
      return {
        Comid:        isCC ? MComid : Comid,
        MComid,
        BillNoType:   com0.BillType    || "Daily Reset On Company",
        BillNoPrefix: com0.BillPrefix  || "",
        BillNoDigit:  com0.NumberDigit || 0,
        CashId:       CC.getStr("CustomerCashid") || "0",
        CashierId:    CC.getStr("CashierRefid")   || "0",
        CashierName:  CC.getStr("CashierName")    || "",
        CommonCompany: isCC,
        DayClose:     !!main0.DayClose,
      };
    } catch {
      return {
        Comid: "1", MComid: "1",
        BillNoType: "Daily Reset On Company", BillNoPrefix: "", BillNoDigit: 0,
        CashId: "0", CashierId: "0", CashierName: "",
        CommonCompany: false, DayClose: false,
      };
    }
  });

  // ── State ──────────────────────────────────────────────────────────────────
  const [perm,         setPerm]         = useState({ View: 0, Add: 0, Edit: 0, Delete: 0 });
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [customers,  setCustomers]  = useState([]);
  const [salesmen,   setSalesmen]   = useState([]);

  const [quotationNo,   setQuotationNo]   = useState("");
  const [quotationDate, setQuotationDate] = useState(today());
  const [quoteType,     setQuoteType]     = useState("QUOTATION");
  const [custId,        setCustId]        = useState("");
  const [custMobile,    setCustMobile]    = useState("");
  const [smId,          setSmId]          = useState("");
  const [cashier,       setCashier]       = useState("");
  const [crmNo,         setCrmNo]         = useState("");
  const [crmValue,      setCrmValue]      = useState("0.00");
  const [curBal,        setCurBal]        = useState("0.00");
  const [remarks,       setRemarks]       = useState("");
  const [verified,      setVerified]      = useState(false);
  const [approved,      setApproved]      = useState(false);
  const [editId,        setEditId]        = useState(0);

  const [rows,       setRows]       = useState([mkRow()]);
  const [selRid,     setSelRid]     = useState(null);
  const [totals,     setTotals]     = useState({
    GrossAmt: 0, DiscAmt: 0, GSTAmt: 0, CESSAmt: 0, NetAmt: 0,
  });
  const [discPer,    setDiscPer]    = useState("");
  const [otherPlus,  setOtherPlus]  = useState("");
  const [otherMinus, setOtherMinus] = useState("");
  const [coinage,    setCoinage]    = useState("");
  const [gstSplit,   setGstSplit]   = useState([]);

  const [loading,    setLoading]    = useState(false);
  const [ldMsg,      setLdMsg]      = useState("Loading...");
  const [pw,         setPw]         = useState(null);
  const pwOkRef = useRef(null);

  const [lastQuoteNo,  setLastQuoteNo]  = useState(() => localStorage.getItem("lastQuoteNo")  || "—");
  const [lastQuoteAmt, setLastQuoteAmt] = useState(() => parseFloat(localStorage.getItem("lastQuoteAmt")) || 0);

  const [prodPopup,  setProdPopup]  = useState(null);
  const [prodList,   setProdList]   = useState([]);
  const [f5Open,     setF5Open]     = useState(false);
  const [f5Rows,     setF5Rows]     = useState([]);
  const [f5Details,  setF5Details]  = useState([]); 
  const rowsRef  = useRef(rows);
  const cellRefs = useRef({});
  const custRef  = useRef(null);
  const [focusCols,  setFocusCols]  = useState([]);
  const focusColsRef                = useRef([]);
  const [ctrlGOpen,  setCtrlGOpen]  = useState(false);

  const loadFocusCols = useCallback(async (mcomid) => {
    try {
      const url = `/Content/Appdata/Visible/${mcomid}/QuotationFocus.json?v=${Date.now()}`;
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
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => { focusColsRef.current = focusCols; }, [focusCols]);

  // init cashier from session
  useEffect(() => {
    setCashier(sess.CashierName || localStorage.getItem("CashierName") || "");
  }, [sess]);

  const regCell = (rid, key, el) => {
    if (!cellRefs.current[rid]) cellRefs.current[rid] = {};
    if (el) cellRefs.current[rid][key] = el;
    else delete cellRefs.current[rid]?.[key];
  };

  const validRows = rows.filter(r => r.ProductRefId && vn(r.Qty) > 0);
  const itemCount = validRows.length;
  const totalQty  = validRows.reduce((s, r) => s + vn(r.Qty), 0);

  // ── Permission check ───────────────────────────────────────────────────────
  useEffect(() => {
    const menuStr = localStorage.getItem("menulist");
    if (!menuStr) {
      alert("Session Close Please Login !!!.");
      navigate("/");
      return;
    }
    const menulist = JSON.parse(menuStr);
    const menudata = menulist.filter(o =>
      o.PageName === "Quotation" || o.PageName === "Sale Quotation" || o.PageName === "Billing-Quotation"
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

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthorized) return;
    (async () => {
      setLoading(true); setLdMsg("Loading...");
      await Promise.all([loadDropdowns(), loadQuotationNo(), loadColCfg(sess.Comid), loadFocusCols(sess.MComid)]);
      setLoading(false);
    })();
    // eslint-disable-next-line
  }, [isAuthorized]);

  // ── Load Quotation No ──────────────────────────────────────────────────────
  const loadQuotationNo = useCallback(async () => {
    const res = await CC.api(QuotationMaxNo, null, {}, {
      date: quotationDate, CId: sess.CashierId, Comid: sess.Comid,
      NumberDigit: sess.BillNoDigit, BillPrefix: sess.BillNoPrefix,
      BillType: sess.BillNoType,
    });
    if (redirectIfDualLogin(res)) return;
    const no = res.No || res.QuotationNo || res.data || res.Data1 || "";
    if (no) setQuotationNo(ns(no));
    // eslint-disable-next-line
  }, [sess, quotationDate]);

  // ── Load Dropdowns ─────────────────────────────────────────────────────────
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

  // ── Customer change → load CRM + Balance ──────────────────────────────────
  const handleCustomerChange = useCallback(async (cid) => {
    setCustId(cid);
    const found = customers.find(c => String(c.Id) === cid);
    setCustMobile(found?.MobileNo || "");
    if (!cid) { setCrmValue("0.00"); setCurBal("0.00"); return; }

    const [crmRes, balRes] = await Promise.all([
      CC.api(CRMBalanceUrl, null, {}, { Id: cid, Fromdate: quotationDate, Comid: sess.Comid, MComid: sess.MComid }),
      CC.api(CurrentBalanceUrl, null, {}, { Id: cid, MComid: sess.MComid, TillDate: quotationDate, Comid: sess.Comid, AccountType: "CUSTOMER" }),
    ]);

    if (!crmRes._netErr && (crmRes.ok ?? crmRes.IsSuccess)) {
      const arr = Array.isArray(crmRes.data) ? crmRes.data : [];
      setCrmValue(arr.length > 0 ? f2(vn(arr[0].Value)).toFixed(2) : "0.00");
    }
    if (balRes && !balRes._netErr) {
      const bal = parseFloat(balRes.Data1 ?? balRes.data ?? 0);
      setCurBal(isNaN(bal) ? "0.00" : f2(bal).toFixed(2));
    } else {
      setCurBal("0.00");
    }
  }, [sess, quotationDate, customers]);

  // ── Totals recalc ──────────────────────────────────────────────────────────
  const recalcTotals = useCallback((rowsArr, dPer, oPlus, oMinus, coin) => {
    let grossAmt = 0, gstAmt = 0, cessAmt = 0, discAmt = 0;
    const gstMap = {};

    rowsArr.forEach(r => {
      if (!r.ProductRefId || !vn(r.Qty)) return;
      const calc = calcQuotRow(r);
      grossAmt += vn(calc.OrgRate) * vn(r.Qty);
      gstAmt   += vn(calc.TaxAmt);
      cessAmt  += vn(calc.CESSAmount);
      discAmt  += vn(calc.DiscountAmt);

      const key = f2(vn(r.TaxPercent));
      if (!gstMap[key]) gstMap[key] = { TaxPercent: key, TaxAmt: 0, CTAmount: 0, STAmount: 0 };
      gstMap[key].TaxAmt   += vn(calc.TaxAmt);
      gstMap[key].CTAmount += vn(calc.CTAmount);
      gstMap[key].STAmount += vn(calc.STAmount);
    });

    const billDisc   = vn(dPer) > 0 ? f2(grossAmt * (vn(dPer) / 100)) : 0;
    const totalDisc  = f2(discAmt + billDisc);
    const netAmt     = f2(grossAmt + gstAmt + cessAmt + vn(oPlus) - totalDisc - vn(oMinus) + vn(coin));

    setGstSplit(Object.values(gstMap).filter(g => g.TaxAmt > 0));
    setTotals({
      GrossAmt: f2(grossAmt), DiscAmt: totalDisc,
      GSTAmt: f2(gstAmt), CESSAmt: f2(cessAmt), NetAmt: netAmt,
    });
    return netAmt;
  }, []);

  useEffect(() => {
    recalcTotals(rows, discPer, otherPlus, otherMinus, coinage);
  }, [rows, discPer, otherPlus, otherMinus, coinage, recalcTotals]);

  // ── Fill item into row ─────────────────────────────────────────────────────
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
        TaxPercent:      f2(vn(item.GST || item.TaxPercent)),
        CESSPer:         f2(vn(item.CESS || item.CESSPer)),
        UOM:             item.UOM     || "",
        UOMDecimal:      item.UOMDecimal || 0,
        HSNCode:         item.HSNCode || "",
        DiscountPercent: f2(vn(item.SaleDiscountPer || item.DiscountPercent)),
        Qty:             item.UOMDecimal === 0 ? "1" : "",
        _dirty: true,
      };
      return newRow;
    }));
    setProdPopup(null);
    setTimeout(() => {
      const editableCols = QT_COLUMNS
        .filter(c => !c.readOnly && c.key !== "ProductCode")
        .map(c => c.key);

      const firstFocusCol =
        focusColsRef.current.length > 0
          ? focusColsRef.current.find(k => k !== "ProductCode" && editableCols.includes(k))
          : "Qty"; // ← default fallback

      const targetCol = firstFocusCol || "Qty";
      const el = cellRefs.current[rid]?.[targetCol];
      if (el) { el.focus(); el.select?.(); }
    }, 50);
  }, []); // focusColsRef is a ref — no dependency needed

  // ── Fetch product by code ──────────────────────────────────────────────────
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
  }, [sess, fillItemIntoRow, toast]);

  // ── Load product list for popup ────────────────────────────────────────────
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

  // ── Cell change ────────────────────────────────────────────────────────────
  const handleCellChange = useCallback((rid, colKey, value) => {
    setRows(prev => prev.map(r => {
      if (r._rid !== rid) return r;
      const updated = { ...r, [colKey]: value, _dirty: true };
      if (["Qty", "SaleRate", "TaxPercent", "CESSPer", "DiscountPercent"].includes(colKey)) {
        return calcQuotRow(updated);
      }
      return updated;
    }));
  }, []);

  // ── Cell keydown ───────────────────────────────────────────────────────────
  const handleCellKeyDown = useCallback((e, rid, colKey) => {
    const editableCols = visCols
      .map(vc => QT_COLUMNS.find(c => c.key === vc.key))
      .filter(Boolean)
      .filter(cd => !cd.readOnly)
      .map(cd => cd.key);

    const COLS =
      focusColsRef.current.length > 0
        ? [
            "ProductCode",
            ...focusColsRef.current.filter(
              k => k !== "ProductCode" && editableCols.includes(k)
            ),
          ]
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
  }, [visCols, fetchProductByCode, loadProductsForPopup, focusCols]); // ✅ focusCols added

  // ── Delete row ─────────────────────────────────────────────────────────────
  const doDeleteRow = useCallback(async (rid) => {
    const ok = await confirm("Do you want to Delete this Row?");
    if (!ok) return;
    setRows(prev => {
      const next = prev.filter(r => r._rid !== rid);
      return next.length === 0 ? [mkRow()] : next;
    });
  }, [confirm]);

  const username = localStorage.getItem("username") || "";

  // ── Clear form ─────────────────────────────────────────────────────────────
  const clearForm = useCallback(async () => {
    setEditId(0);
    setCustId(""); setCustMobile(""); setSmId(""); setRemarks("");
    setCrmNo(""); setCrmValue("0.00"); setCurBal("0.00");
    setVerified(false); setApproved(false);
    setDiscPer(""); setOtherPlus(""); setOtherMinus(""); setCoinage("");
    setRows([mkRow()]);
    setSelRid(null);
    await loadQuotationNo();
    setTimeout(() => {
      const firstRow = rowsRef.current[0];
      if (firstRow) cellRefs.current[firstRow._rid]?.["ProductCode"]?.focus();
    }, 100);
  }, [loadQuotationNo]);

  // ── Save ───────────────────────────────────────────────────────────────────
  const doSave = useCallback(async () => {
    if (!perm.Add && !perm.Edit) { toast("❌ Permission Denied", true); return; }
    if (!custId) { toast("❌ Select a Customer", true); return; }
    const vRows = rows.filter(r => r.ProductRefId && vn(r.Qty) > 0);
    if (vRows.length === 0) { toast("❌ Add at least one product", true); return; }

    const ok = await confirm("Do you want to Save Quotation?");
    if (!ok) return;

    setLoading(true); setLdMsg("Saving...");
    const custObj = customers.find(c => String(c.Id) === String(custId));

    const quotedetails = vRows.map(r => ({
      QDId:            r.QDId || 0,
      ProductRefId:    r.ProductRefId,
      ProductCode:     r.ProductCode,
      ProductName:     r.ProductName,
      MRP:             f2(vn(r.MRP)),
      SaleRate:        f2(vn(r.SaleRate)),
      ItemQty:         f2(vn(r.Qty)),
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
      remarks:         r.Remarks || "",
    }));

    const payload = [{
      Id:               editId,
      CustomerRefId:    parseInt(custId),
      CompanyRefId:     parseInt(sess.Comid),
      SaleNoDisplay:    quotationNo,
      SaleNo:           quotationNo,
      SaleDate:         quotationDate,
      SaleType:         quoteType,
      OtherssubAmt:     vn(otherMinus),
      OthersplusAmt:    vn(otherPlus),
      disper:           vn(discPer),
      Coinage:          vn(coinage),
      Grossamt:         totals.GrossAmt,
      taxamount:        totals.GSTAmt,
      CESSAmount:       totals.CESSAmt,
      discamount:       totals.DiscAmt,
      NetAmount:        totals.NetAmt,
      Remarks:          remarks,
      CashierRefId:     parseInt(sess.CashierId) || 0,
      salesmanRefId:    smId ? parseInt(smId) : null,
      Verified:         verified ? 1 : 0,
      Approved:         approved ? 1 : 0,
      DeleteStatus:     true,
      CustomerName:     custObj?.AccountName || "",
      Address1:         custObj?.Address1    || "",
      PhoneNo:          custObj?.MobileNo    || "",
      TinNo:            custObj?.GSTINNo     || "",
      Modified_By:      username,
      ModifiedStatus:   editId > 0 ? 1 : 0,
      Modified_Date:    quotationDate,
      SaleDetails: quotedetails,
    }];

    const headers = {
      "Comid":      String(sess.Comid),
      "cashid":     String(sess.CashId),
      "BillType":   sess.BillNoType,
      "BillPerfix": sess.BillNoPrefix,
      "BillDigit":  String(sess.BillNoDigit),
      "DayClose":   sess.DayClose ? "1" : "0",
      "MirrorTable": "0", "LocalDB": "0",
    };

    const res = await CC.insertapi(QuotationInsertUrl, payload, headers);
    setLoading(false);
    if (redirectIfDualLogin(res)) return;

    if (res.ok ?? res.IsSuccess) {
      const savedNo = res.BillNo || res.Data2 || quotationNo;
      localStorage.setItem("lastQuoteNo",  savedNo);
      localStorage.setItem("lastQuoteAmt", totals.NetAmt.toString());
      setLastQuoteNo(savedNo);
      setLastQuoteAmt(totals.NetAmt);
      toast("✅ Quotation Saved");
      await clearForm();
    } else {
      toast("❌ " + (res.Message || res.message || "Save Failed"), true);
    }
    // eslint-disable-next-line
  }, [perm, confirm, clearForm, sess, totals, rows, custId, remarks,
      quotationNo, quotationDate, editId, otherMinus, otherPlus, discPer, coinage,
      customers, quoteType, smId, verified, approved]);

  // ── Delete quotation ───────────────────────────────────────────────────────
  const doDeleteQuotation = useCallback(async () => {
    if (!editId) { toast("No quotation to delete", true); return; }
    if (!perm.Delete) { toast("❌ Delete Permission Denied", true); return; }
    const ok = await confirm("Do you want to Delete this Quotation?");
    if (!ok) return;
    setLoading(true);

    const extraHeaders = {
      Comid:       String(sess.Comid),
      Id:          String(editId),
      Date:        quotationDate,
      DayClose:    sess.DayClose ? "1" : "0",
      MirrorTable: "0",
      Updateid:    "0",
      LocalDB:     "2",
    };

    const res = await CC.api(QuotationDeleteUrl, null, extraHeaders, { Id: editId });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res.ok ?? res.IsSuccess) {
      toast("✅ Quotation Deleted Successfully");
      await clearForm();
    } else {
      toast("❌ " + (res.message || res.Message || "Delete Failed"), true);
    }
  }, [editId, perm, confirm, sess, clearForm, quotationDate]);

  // ── F5 view ────────────────────────────────────────────────────────────────
// ── F5 view ────────────────────────────────────────────────────────────────
const openF5 = useCallback(async (from = quotationDate, to = quotationDate) => {
  if (!perm.Edit) { toast("❌ Edit Permission Denied", true); return; }
  setLoading(true); setLdMsg("Loading quotations...");
  const res = await CC.api(QuotationSelectUrl, null, {}, {
    Comid: sess.Comid, Fromdate: from, Todate: to, Id: 0,
  });
  setLoading(false);
  if (redirectIfDualLogin(res)) return;

  let master = [];
  let details = [];
  if (Array.isArray(res?.Data)) {
    const node = res.Data[0];
    master  = node?.salemaster  || node?.SaleMaster  || node?.quotationmaster || res.Data || [];
    details = node?.saledetails || node?.SaleDetails || node?.quotationdetails || [];
  } else if (Array.isArray(res?.data)) {
    const node = res.data[0];
    master  = node?.salemaster  || node?.SaleMaster  || node?.quotationmaster || res.data || [];
    details = node?.saledetails || node?.SaleDetails || node?.quotationdetails || [];
  } else if (Array.isArray(res)) {
    master = res;
  }

  setF5Rows(Array.isArray(master)  ? master  : []);
  setF5Details(Array.isArray(details) ? details : []);
  setF5Open(true);
}, [sess, quotationDate, perm, redirectIfDualLogin]);

  // ── Edit quotation ─────────────────────────────────────────────────────────
  const doEditQuotation = useCallback(async (id) => {
    setF5Open(false);
    if (!perm.Edit) { toast("❌ Edit Permission Denied", true); return; }
    setLoading(true); setLdMsg("Loading quotation...");
    const res = await CC.api(QuotationEditUrl, null, {}, {
      Id: id, SaleReturnNo: 0, Comid: sess.Comid,
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (!(res.ok ?? res.IsSuccess)) { toast("❌ " + (res.message || "Load Failed"), true); return; }

    const data    = Array.isArray(res.Data) ? res.Data[0] : res.data;
    if (!data) { toast("❌ No data found", true); return; }

    const master  = Array.isArray(data) ? data[0] : data;
    const details = master.SaleDetails || master.QuotationDetails || [];

    setEditId(master.Id || id);
    setQuotationNo(ns(master.SaleNo || master.QuotationNo));
    setQuotationDate(String(master.SaleDate || master.QuotationDate || "").slice(0, 10) || today());
    setQuoteType(master.SaleType || master.QuoteType || "QUOTATION");
    setCustId(ns(master.CustomerRefId));
    const found = customers.find(c => String(c.Id) === ns(master.CustomerRefId));
    setCustMobile(found?.MobileNo || "");
    setSmId(ns(master.salesmanRefId || ""));
    setRemarks(ns(master.Remarks));
    setVerified(!!master.Verified);
    setApproved(!!master.Approved);
    setOtherMinus(ns(master.OtherssubAmt || ""));
    setOtherPlus(ns(master.OthersplusAmt || ""));
    setDiscPer(ns(master.disper || ""));
    setCoinage(ns(master.Coinage || ""));

    const loadedRows = details.map(r => calcQuotRow(fmtRow({ ...mkRow(), ...r, _rid: genRid() })));
    setRows(loadedRows.length > 0 ? loadedRows : [mkRow()]);
    // eslint-disable-next-line
  }, [sess, perm, customers]);

  const handleF5Delete = useCallback((id, billNo) => {
    pwOkRef.current = async () => {
      const ok = await confirm(`Delete Quotation "${billNo}"?`);
      if (!ok) return;
      setLoading(true); setLdMsg("Deleting...");

      const extraHeaders = {
        Comid:       String(sess.Comid),
        Id:          String(id),
        Date:        quotationDate,
        DayClose:    sess.DayClose ? "1" : "0",
        MirrorTable: "0",
        Updateid:    "0",
        LocalDB:     "2",
      };

      const res = await CC.api(QuotationDeleteUrl, null, extraHeaders, { Id: id });
      setLoading(false);
      if (redirectIfDualLogin(res)) return;
      if (res.ok ?? res.IsSuccess) {
        toast("✅ Quotation Deleted");
        await openF5();
      } else {
        toast("❌ " + (res.message || res.Message || "Delete Failed"), true);
      }
    };
    setPw({ title: "Delete Password" });
  }, [sess, quotationDate, confirm, toast, redirectIfDualLogin, openF5]);

  // ── Keyboard shortcuts (mirrors SaleReturn exactly) ────────────────────────
  useEffect(() => {
    const onKey = e => {
      if (prodPopup || f5Open || pw || f12Open || ctrlGOpen) return;
      if (e.key === "F1")  { e.preventDefault(); doSave(); }
      if (e.key === "F3")  { e.preventDefault(); openF5(); }
      if (e.key === "F5")  { e.preventDefault(); openF5(); }
      if (e.key === "F9")  { e.preventDefault(); if (!editId) return; pwOkRef.current = doDeleteQuotation; setPw({ title: "F9 Delete Password" }); }
      if (e.key === "F10") { e.preventDefault(); confirm("Do You Want To Clear?").then(ok => ok && clearForm()); }
      if (e.key === "F12") { e.preventDefault(); setF12Open(true); }
      if (e.key === "Escape") { e.preventDefault(); confirm("Do You Want To Quit?").then(ok => ok && navigate(-1)); }
      // Ctrl+G — open column focus/tab-order settings (matches jQuery Ctrl+G behaviour)
      // Ctrl+G — open column tab-order settings (matches jQuery Ctrl+G / focuswindow behaviour)
      if (e.ctrlKey && e.key === "g") { e.preventDefault(); setCtrlGOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line
  },[prodPopup, f5Open, pw, f12Open, ctrlGOpen, doSave, openF5, doDeleteQuotation, clearForm, editId]);
  if (!isAuthorized) return null;

  const RIGHT_KEYS = new Set([
    "Amount", "SaleRate", "Qty", "MRP", "TaxPercent", "DiscountPercent",
    "TaxAmt", "CESSAmount", "DiscountAmt", "CESSPer",
  ]);

  // ─── shared panel style ────────────────────────────────────────────────────
  const panelStyle = {
    border: "1px solid #c7d8ff",
    borderRadius: 4,
    background: "#fff",
    padding: "8px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  };

  const panelTitle = {
    fontSize: 11,
    fontWeight: 700,
    color: "#4a5568",
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: 4,
    marginBottom: 2,
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="sb-wrap">
      {ConfirmUI}
      <Topbar />

      <div className="sb-body">

        {/* ══════════════════════════════════════════════════════════════════
            HEADER — 3 panel layout matching SaleReturn exactly
        ══════════════════════════════════════════════════════════════════ */}
        <div style={{
          display: "flex",
          gap: 10,
          padding: "8px 10px",
          background: "#f4f8ff",
          borderBottom: "1px solid #d6e4ff",
          alignItems: "stretch",
        }}>

          {/* ── LEFT PANEL: Quotation Details ── */}
          <div style={{ ...panelStyle, minWidth: 220, flexShrink: 0 }}>
            <div style={panelTitle}>Quotation Details</div>

            {/* QuotationNo */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label style={{ ...fieldLabel, minWidth: 82 }}>QuotationNo</label>
              <input
                style={{ ...fieldInput, flex: 1 }}
                value={quotationNo}
                onChange={e => setQuotationNo(e.target.value)}
                readOnly
              />
            </div>

            {/* QuotationDate */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label style={{ ...fieldLabel, minWidth: 82 }}>Date</label>
              <input
                type="date"
                style={{ ...fieldInput, flex: 1 }}
                value={quotationDate}
                onChange={e => setQuotationDate(e.target.value)}
              />
            </div>

            {/* QuoteType dropdown */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label style={{ ...fieldLabel, minWidth: 82 }}>QuoteType</label>
              <select
                style={{ ...fieldInput, flex: 1 }}
                value={quoteType}
                onChange={e => setQuoteType(e.target.value)}
              >
                {QUOTE_TYPES.map(qt => (
                  <option key={qt.value} value={qt.value}>{qt.label}</option>
                ))}
              </select>
            </div>

            {editId > 0 && (
              <div style={{ fontSize: 10, color: "#0f9b6e", fontWeight: 700 }}>✏️ EDIT MODE</div>
            )}
          </div>

          {/* ── MIDDLE PANEL: Customer Details ── */}
          <div style={{ ...panelStyle, flex: 1 }}>
            <div style={panelTitle}>Customer Details</div>

            {/* Customer */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label style={fieldLabel}>Customer</label>
              <ComboBox
                inputRef={custRef}
                options={[{ value: "", label: "" }, ...customers.map(c => ({ value: String(c.Id), label: c.AccountName }))]}
                value={custId}
                onChange={handleCustomerChange}
                onEnterKey={() => {
                  const fr = rowsRef.current[0];
                  if (fr) cellRefs.current[fr._rid]?.["ProductCode"]?.focus();
                }}
                placeholder="Select CustomerName"
              />
            </div>

            {/* MobileNo + CRM */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label style={fieldLabel}>MobileNo</label>
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  style={{ ...fieldInput, width: "100%" }}
                  value={custMobile}
                  readOnly
                  placeholder="Select MobileNo"
                />
              </div>
              <label style={{ ...fieldLabel, minWidth: 36, marginLeft: 8 }}>CRM</label>
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  style={{ ...fieldInput, width: "100%" }}
                  value={crmNo}
                  onChange={e => setCrmNo(e.target.value)}
                  placeholder="Select CRMNO"
                />
              </div>
            </div>

            {/* CRM Value + CurrentBal + Verified + Approved */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#4a5568" }}>CRM Value</label>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#16a34a", minWidth: 48 }}>{crmValue}</span>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#4a5568" }}>CurrentBal</label>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#16a34a", minWidth: 48 }}>{curBal}</span>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} />
                Verified
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} />
                Approved
              </label>
            </div>
          </div>

          {/* ── RIGHT PANEL: Amount + SalesMan + Remarks ── */}
          <div style={{ ...panelStyle, minWidth: 240, flexShrink: 0, alignItems: "stretch" }}>
            {/* Net Amount — large green (same position as SaleReturn) */}
            <div style={{ textAlign: "center", fontSize: 22, fontWeight: 800, color: "#0f9b6e", letterSpacing: 0.5, paddingBottom: 4 }}>
              Rs.{totals.NetAmt.toFixed(2)}
            </div>

            {/* SalesMan */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label style={{ ...fieldLabel, minWidth: 58 }}>SalesMan</label>
              <ComboBox
                options={[{ value: "", label: "SELECT SALESMAN" }, ...salesmen.map(s => ({ value: String(s.Id), label: s.SalesManName }))]}
                value={smId}
                onChange={setSmId}
                placeholder="Select SalesMan"
              />
            </div>

            {/* Remarks */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label style={{ ...fieldLabel, minWidth: 58 }}>Remarks</label>
              <input
                style={{ ...fieldInput, flex: 1 }}
                value={remarks}
                onChange={e => setRemarks(e.target.value.toUpperCase())}
                placeholder="Remarks"
              />
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            GRID (identical pattern to SaleReturn)
        ══════════════════════════════════════════════════════════════════ */}
        <div className="sb-content" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div className="sb-grid-wrap" style={{ flex: 1 }}>
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
                        const m       = QT_COLUMNS.find(c => c.key === col.key) || {};
                        const val     = row[col.key];
                        const isRight = RIGHT_KEYS.has(col.key);
                        const isRO    = !!m.readOnly;
                        const isFloat = m.type === "float";
                        const isAmt   = col.key === "Amount";

                        return (
                          <td key={col.key} style={{ textAlign: isRight ? "right" : undefined }}>
                            {isRO && col.key !== "ProductName" ? (
                              <span className="sb-cell-calc" style={{
                                display: "block", padding: "0 4px",
                                color: isAmt ? "#0f9b6e" : undefined,
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
                            ) : isFloat ? (
                              <input
                                ref={el => regCell(row._rid, col.key, el)}
                                className={`sb-cell-input${isRight ? " right" : ""}`}
                                type="number"
                                step={col.key === "Qty" && row.UOMDecimal === 0 ? "1" : "0.01"}
                                value={val === 0 && !row.ProductRefId ? "" : (val ?? "")}
                                onChange={e => handleCellChange(row._rid, col.key, e.target.value)}
                                onKeyDown={e => handleCellKeyDown(e, row._rid, col.key)}
                                onFocus={() => setSelRid(row._rid)}
                                placeholder="0.00"
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
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            BOTTOM SECTION — GST split left + Totals grid (mirrors SaleReturn)
        ══════════════════════════════════════════════════════════════════ */}
        <div style={{
          display: "flex",
          gap: 0,
          borderTop: "1px solid #c8ead9",
          background: "#f4f8ff",
          flexShrink: 0,
        }}>

          {/* ── GST SPLIT TABLE (left) ── */}
          <div style={{
            minWidth: 340, maxWidth: 360,
            borderRight: "1px solid #c8ead9",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "80px 1fr 1fr 1fr",
              background: "#e8f7f1",
              borderBottom: "1px solid #d6e4ff",
              padding: "4px 8px",
              fontSize: 11, fontWeight: 700, color: "#4a5568",
            }}>
              <span>GST %</span>
              <span style={{ textAlign: "right" }}>GST Amt</span>
              <span style={{ textAlign: "right" }}>CGST Amt</span>
              <span style={{ textAlign: "right" }}>SGST Amt</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", maxHeight: 100 }}>
              {gstSplit.length === 0
                ? <div style={{ textAlign: "center", color: "#94a3b8", padding: "12px 8px", fontSize: 11 }}>No data to display</div>
                : gstSplit.map((g, i) => (
                  <div key={i} style={{
                    display: "grid",
                    gridTemplateColumns: "80px 1fr 1fr 1fr",
                    padding: "3px 8px",
                    fontSize: 11,
                    background: i % 2 === 0 ? "#fff" : "#f7faff",
                    borderBottom: "1px solid #edf0f7",
                  }}>
                    <span style={{ color: "#4a5568" }}>{g.TaxPercent}%</span>
                    <span style={{ textAlign: "right", color: "#1a2e4a" }}>{f2(g.TaxAmt).toFixed(2)}</span>
                    <span style={{ textAlign: "right", color: "#1a2e4a" }}>{f2(g.CTAmount).toFixed(2)}</span>
                    <span style={{ textAlign: "right", color: "#1a2e4a" }}>{f2(g.STAmount).toFixed(2)}</span>
                  </div>
                ))
              }
            </div>
          </div>

          {/* ── TOTALS GRID (right, 3×3 — same as SaleReturn) ── */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", fontSize: 12 }}>

            {/* Col 1 */}
            <div style={{ borderRight: "1px solid #c8ead9", display: "flex", flexDirection: "column" }}>
              {[
                { label: "Gross Amt", value: totals.GrossAmt.toFixed(2), readOnly: true },
                { label: "Disc(%)",   value: discPer, onChange: setDiscPer, type: "number" },
                { label: "Disc Amt",  value: totals.DiscAmt.toFixed(2), readOnly: true },
              ].map((item, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "4px 10px", borderBottom: "1px solid #edf0f7", gap: 6,
                }}>
                  <span style={{ color: "#4a5568", fontWeight: 600 }}>{item.label}</span>
                  {item.readOnly
                    ? <span style={{ fontWeight: 700, color: "#1a2e4a", minWidth: 80, textAlign: "right" }}>{item.value}</span>
                    : <input
                        type={item.type || "text"}
                        step="0.01"
                        value={item.value}
                        onChange={e => item.onChange(e.target.value)}
                        style={{ ...fieldInput, width: 90, textAlign: "right" }}
                        placeholder="0.00"
                      />
                  }
                </div>
              ))}
            </div>

            {/* Col 2 */}
            <div style={{ borderRight: "1px solid #c8ead9", display: "flex", flexDirection: "column" }}>
              {[
                { label: "GST Amt",  value: totals.GSTAmt.toFixed(2),  readOnly: true },
                { label: "CESS Amt", value: totals.CESSAmt.toFixed(2), readOnly: true },
                { label: "Coinage",  value: coinage, onChange: setCoinage, type: "number" },
              ].map((item, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "4px 10px", borderBottom: "1px solid #edf0f7", gap: 6,
                }}>
                  <span style={{ color: "#4a5568", fontWeight: 600 }}>{item.label}</span>
                  {item.readOnly
                    ? <span style={{ fontWeight: 700, color: "#1a2e4a", minWidth: 80, textAlign: "right" }}>{item.value}</span>
                    : <input
                        type={item.type || "text"}
                        step="0.01"
                        value={item.value}
                        onChange={e => item.onChange(e.target.value)}
                        style={{ ...fieldInput, width: 90, textAlign: "right" }}
                        placeholder="0.00"
                      />
                  }
                </div>
              ))}
            </div>

            {/* Col 3 */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {[
                { label: "Others(+)", value: otherPlus,  onChange: setOtherPlus,  type: "number" },
                { label: "Others(-)", value: otherMinus, onChange: setOtherMinus, type: "number" },
                { label: "Net Total", value: totals.NetAmt.toFixed(2), readOnly: true, bold: true },
              ].map((item, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "4px 10px", borderBottom: "1px solid #edf0f7", gap: 6,
                }}>
                  <span style={{ color: item.bold ? "#1a2e4a" : "#4a5568", fontWeight: item.bold ? 700 : 600 }}>{item.label}</span>
                  {item.readOnly
                    ? <span style={{ fontWeight: 800, color: "#1a2e4a", minWidth: 80, textAlign: "right", fontSize: item.bold ? 14 : 12 }}>{item.value}</span>
                    : <input
                        type={item.type || "text"}
                        step="0.01"
                        value={item.value}
                        onChange={e => item.onChange(e.target.value)}
                        style={{ ...fieldInput, width: 90, textAlign: "right" }}
                        placeholder="0.00"
                      />
                  }
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            BOTTOM TOOLBAR — mirrors SaleReturn toolbar exactly
        ══════════════════════════════════════════════════════════════════ */}
        <div className="sb-toolbar" style={{ borderLeftColor: "var(--clr-primary)" }}>
          <button className="sb-btn sv" onClick={doSave} disabled={loading}
            style={{ background: "var(--clr-primary)", borderColor: "var(--clr-primary)" }}>
            💾 F1 - Save
          </button>
          <button className="sb-btn" onClick={openF5}>✏ F3 - Edit</button>
          <button className="sb-btn" onClick={openF5}>📋 F5 - View</button>
          <button className="sb-btn" onClick={() => setF12Open(true)}>⚙ F12</button>
          <button className="sb-btn" onClick={clearForm} disabled={loading}>🔄 F10 Clear</button>
          <button className="sb-btn" onClick={() => setCtrlGOpen(true)} title="Ctrl+G Column Focus/Reorder">
  ⚡ Ctrl+G
</button>
          {editId > 0 && (
            <button className="sb-btn dl"
              onClick={() => { pwOkRef.current = doDeleteQuotation; setPw({ title: "F9 Delete Password" }); }}
              disabled={loading}>🗑 F9 - Delete</button>
          )}
          <button className="sb-btn dl"
            onClick={() => { if (!editId) return; pwOkRef.current = doDeleteQuotation; setPw({ title: "DEL Delete" }); }}>
            🗑 DEL - Delete
          </button>
          <button className="sb-btn dl" onClick={() => navigate(-1)}>✕ ESC - Exit</button>
          {loading && <span style={{ fontSize: 11, color: "#6b7a99" }}>⏳ {ldMsg}</span>}
          {/* right-side info */}
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "#6b7a99" }}>
            <span>Qty: <b style={{ color: "#1a2e4a" }}>{totalQty % 1 === 0 ? totalQty.toFixed(0) : totalQty.toFixed(2)}</b></span>
            <span>Items: <b style={{ color: "#1a2e4a" }}>{itemCount}</b></span>
            <span>Last: <b style={{ color: "#0f9b6e" }}>{lastQuoteNo}</b></span>
            {lastQuoteAmt > 0 && <span>Amt: <b style={{ color: "#16a34a" }}>₹{lastQuoteAmt.toFixed(2)}</b></span>}
          </span>
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
          onEdit={id => { setF5Open(false); doEditQuotation(id); }}
          onDelete={handleF5Delete}
          onClose={() => setF5Open(false)}
          fromDate={quotationDate}
          toDate={quotationDate}
          onSearch={openF5}
        />
      )}


      <CC.ToastList toasts={toasts} />
    </div>
  );
}