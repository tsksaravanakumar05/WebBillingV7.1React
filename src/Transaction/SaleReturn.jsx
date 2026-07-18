// ─────────────────────────────────────────────────────────────────────────────
//  SaleReturn.jsx  —  React Sale Return Form
//  Header redesigned to match original UI image exactly:
//    Left panel  → Sale Return Details (ReturnNo, ReturnDate, ReturnType dropdown)
//    Middle panel→ Customer Details (Customer, MobileNo+CRM, CRM Value+CurrentBal+Stock)
//    Right panel → Rs. amount, SalesMan dropdown, Cashier input
//  Bottom totals → Gross Amt, Disc%, Disc Amt | GST Amt, CESS Amt, Coinage | Others(+), Others(-), Net Total
//  Removed: radio buttons, Original Bill No search bar
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState, useEffect, useRef, useCallback,useMemo,
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
const LoginPasswordUrl       = "/api/LoginApp/EditPassword";
const VisibleColumnsUrl      = "/Login/VisibleColumns";
const SelectSaleBillUrl      = "/api/SaleReturnApp/SaleReturnLoadPD";
const BillNoCheckUrl         = "/api/SaleApp/BillNoCheck"; 
const CRMBalanceUrl          = "/api/SalesReportApp/CRMBalanceReport";
const CurrentBalanceUrl      = "/api/SupplierApp/CurrentBalance";
const FocusColumnsUrl        = "/Login/FocusColumns";



// ─── SALE RETURN GRID COLUMNS ─────────────────────────────────────────────────
const SR_COLUMNS = [
  { key: "ProductCode",     label: "Product Code",  width: 130, hidden: false },
   { key: "BillNo",          label: "Bill No",       width: 90,  hidden: false },
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

// ─── RETURN TYPE OPTIONS ──────────────────────────────────────────────────────
const RETURN_TYPES = [
  { value: "CASH",   label: "CASH" },
  { value: "CREDIT", label: "CREDIT" },
  { value: "CRN",    label: "CRN" },
  { value: "DBN",    label: "DBN" },
];

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

// ─── COMBOBOX ─────────────────────────────────────────────────────────────────
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
function ProductSearchPopup({ products, onSelect, onClose, anchorPos,isTamil }) {
  const [q, setQ] = useState("");
  const [hilite, setHilite] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 30); }, []);

  const filtered = products.filter(p =>
    String(p.PName || "").toLowerCase().includes(q.toLowerCase()) ||
    String(p.Prod_Code || "").toLowerCase().includes(q.toLowerCase())
  ).slice(0, 120);

  useEffect(() => { setHilite(0); }, [q]);
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${hilite}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [hilite]);

  return (
    <div className="sb-prod-search" style={{ top: anchorPos?.top || 160, left: anchorPos?.left + 250 || 20 }}>
      <div className="sb-prod-search-hdr">
        <span className="sb-ps-title">Product Search</span>
        <span className="sb-ps-count">{filtered.length} items</span>
        <button className="sb-ps-close" onClick={onClose} title="Close (Esc)">✕</button>
      </div>
      <div className="sb-ps-input-wrap">
        <span className="sb-ps-icon">⌕</span>
        <input
          ref={inputRef}
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Type code or name…"
          className="sb-ps-input"
          onKeyDown={e => {
            if (e.key === "ArrowDown") { e.preventDefault(); setHilite(h => Math.min(h + 1, filtered.length - 1)); }
            if (e.key === "ArrowUp")   { e.preventDefault(); setHilite(h => Math.max(h - 1, 0)); }
            if (e.key === "Enter")     { e.preventDefault(); if (filtered[hilite]) onSelect(filtered[hilite]); }
            if (e.key === "Escape")    { e.preventDefault(); onClose(); }
          }}
        />
      </div>
      {isTamil ? (
        <div className="sb-ps-cols">
          <span style={{ width: 90 }}>Code</span>
          <span style={{ flex: 1 }}>Description</span>
          <span style={{ width: 140 }}>TamilName</span>
        </div>
      ) : (
        <div className="sb-ps-cols">
          <span style={{ width: 80 }}>Code</span>
          <span style={{ flex: 1 }}>Description</span>
          <span style={{ width: 50, textAlign: "center" }}>UOM</span>
          <span style={{ width: 65, textAlign: "right" }}>MRP</span>
          <span style={{ width: 65, textAlign: "right" }}>SaleRate</span>
          <span style={{ width: 50, textAlign: "right" }}>GST%</span>
        </div>
      )}
      <div ref={listRef} className="sb-prod-list">
        {filtered.length === 0
          ? <div className="sb-ps-empty">No products found</div>
          : filtered.map((p, idx) => (
            <div key={p.Id} data-idx={idx}
              className={`sb-prod-item${idx === hilite ? " hi" : ""}`}
              onClick={() => onSelect(p)} onMouseEnter={() => setHilite(idx)}>

               {isTamil ? (
                              <>
                                <span className="sb-prod-code" style={{ width: 90 }}>
                                  {p.Prod_Code ? p.Prod_Code : p.ProductCode}
                                </span>
                                <span className="sb-prod-name" style={{ flex: 1 }}>
                                  {p.PName ? p.PName : p.ProductName}
                                </span>
                                <span style={{ width: 140, color: "#1f65de", fontWeight: 600 }}>
                                  {p.PrinterName || "—"}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="sb-prod-code" style={{ width: 80 }}>
                                  {p.Prod_Code ? p.Prod_Code : p.ProductCode}
                                </span>
                                <span className="sb-prod-name" style={{ flex: 1 }}>
                                  {p.PName ? p.PName : p.ProductName}
                                </span>
                                <span style={{ width: 50, textAlign: "center", fontSize: 10.5, color: "#6b7a99" }}>
                                  {p.UOM || "—"}
                                </span>
                                <span style={{ width: 65, textAlign: "right", color: "#475569" }}>
                                  ₹{CC.f2(CC.vn(p.MRP)).toFixed(2)}
                                </span>
                                <span className="sb-prod-rate" style={{ width: 65, textAlign: "right" }}>
                                  ₹{CC.f2(CC.vn(p.SaleRate ? p.SaleRate : p.SalesRate)).toFixed(2)}
                                </span>
                                <span style={{ width: 50, textAlign: "right", color: "#8b5cf6" }}>
                                  {CC.f2(CC.vn(p.GST)).toFixed(2)}
                                </span>
                              </>
                            )}
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
// ─── BILL NO LOOKUP / LOAD SALE (mirrors LoadSDWindow + LoadSD in SaleReturn.js) ──
function BillLoadPopup({ items, onConfirm, onClose, billNo }) {
  const [qtyMap, setQtyMap] = useState(() =>
    Object.fromEntries(items.map(i => [i.Indexid1 || i.Id, ""]))
  );
  const setQty = (key, v) => setQtyMap(prev => ({ ...prev, [key]: v }));

  return (
    <div className="mp-ov" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mp-modal-box" style={{ width: 760, maxHeight: "82vh" }}>
        <div className="mp-modal-hdr">
          <span>📄 Load Sale Bill #{billNo} — Select Return Qty</span>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="mp-modal-body" style={{ overflowY: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
            <thead>
              <tr>
                {["Code", "Description", "SaleRate", "SaleQty", "AvailQty", "ReturnQty"].map(h => (
                  <th key={h} style={{ background: "#1a2e4a", color: "#fff", padding: "6px 8px", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const key = it.Indexid1 || it.Id;
                return (
                  <tr key={key} style={{ background: i % 2 === 0 ? "#fff" : "#fafbff" }}>
                    <td style={{ padding: "4px 8px" }}>{it.Productcode}</td>
                    <td style={{ padding: "4px 8px" }}>{it.ProductName}</td>
                    <td style={{ padding: "4px 8px", textAlign: "right" }}>{f2(vn(it.PurRate)).toFixed(2)}</td>
                    <td style={{ padding: "4px 8px", textAlign: "right" }}>{it.ItemQty}</td>
                    <td style={{ padding: "4px 8px", textAlign: "right" }}>{vn(it.AvaiableQty).toFixed(2)}</td>
                    <td style={{ padding: "4px 8px", textAlign: "right" }}>
                      <input type="number" step="0.01" value={qtyMap[key]}
                        onChange={e => setQty(key, e.target.value)}
                        style={{ width: 80, textAlign: "right", border: "1px solid #c5d8f8", borderRadius: 3, padding: "2px 6px" }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mp-modal-ftr">
          <button className="mp-btn sv"
            onClick={() => onConfirm(items.map(it => ({ ...it, ReturnQty: qtyMap[it.Indexid1 || it.Id] })))}>
            ✅ Load Selected Qty
          </button>
          <button className="mp-btn" onClick={onClose}>Cancel</button>
        </div>
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
      <div className="mp-modal-box sb-f5-modal" style={{ width: 980, height: "85vh", display: "flex", flexDirection: "column" }}>
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
                <th style={{ background: "var(--clr-primary-dark)", padding: "6px 10px", textAlign: "left" }}>Return No</th>
                <th style={{ background: "var(--clr-primary-dark)", padding: "6px 10px", textAlign: "left" }}>Return Date</th>
                <th style={{ background: "var(--clr-primary-dark)", padding: "6px 10px", textAlign: "left" }}>Customer</th>
                <th style={{ background: "var(--clr-primary-dark)", padding: "6px 10px", textAlign: "left" }}>Type</th>
                <th style={{ background: "var(--clr-primary-dark)", padding: "6px 10px", textAlign: "right" }}>Net Amt</th>
                <th style={{ background: "var(--clr-primary-dark)", padding: "6px 10px", textAlign: "center" }}>Actions</th>
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
                    {r.SaleReturnNoDisplay || r.SaleReturnNo || r.SaleNo || r.BillNo || "—"}
                  </td>
                  <td style={{ padding: "5px 10px" }}>{String(r.ReturnDate || r.BillDate || r.SaleDate || "").slice(0, 10)}</td>
                  <td style={{ padding: "5px 10px" }}>{r.CustomerName || r.AccountName || ""}</td>
                  <td style={{ padding: "5px 10px" }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                      background: (r.LorryNo === "CRN" || r.SaleType === "CRN") ? "#fef2f2" : "#fefce8",
                      color:      (r.LorryNo === "CRN" || r.SaleType === "CRN") ? "#dc2626"  : "#ca8a04",
                    }}>
                      {(r.LorryNo === "CRN" || r.SaleType === "CRN") ? "Credit Note" : "Debit Note"}
                    </span>
                  </td>
                  <td style={{ padding: "5px 10px", textAlign: "right", fontWeight: 700 }}>
                    ₹{f2(vn(r.NetAmt || r.NetAmount || r.Netamt)).toFixed(2)}
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
    Comid:    parseInt(comid) || 1,
    filename: "SaleReturn",
    column:   c.key,
    Visible:  !c.visible,   // ← invert to match jQuery/Purchase convention
    Width:    parseInt(c.width) || 100,
  }));

  try {
    const res = await CC.insertapi(CC.VisibleColumnsUrl, payload);
    if (res?.ok || res?.IsSuccess) {
      toast?.("✅ Column settings saved");
      onSave(local);
    } else {
      toast?.("⚠️ " + (res?.message || "Saved locally"));
      onSave(local);
    }
  } catch (err) {
    console.error("F12 Save error:", err);
    onSave(local);
  }
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
                  <th key={h} style={{ color: "#fff", padding: "6px 10px", textAlign: "left", fontWeight: 600, position: "sticky", top: 0, zIndex: 2,background:"#1a2e4a" }}>{h}</th>
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

// ─── INLINE INPUT STYLE ───────────────────────────────────────────────────────
const fieldInput = {
  height: 24,
  border: "1px solid #b8ccee",
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
export default function SaleReturn() {
  const navigate               = useNavigate();
  const { confirm, ConfirmUI } = CC.useConfirm();
  const { toast, toasts }      = CC.useToast();
const [focusCols, setFocusCols] = useState([]);
const focusColsRef              = useRef([]);
const [ctrlGOpen, setCtrlGOpen] = useState(false);
  // ── Column Settings ──────────────────────────────────────────────────────
  const [colSettings, setColSettings] = useState(DEFAULT_COL_SETTINGS);
  const [f12Open,     setF12Open]     = useState(false);
  const visCols = colSettings.filter(c => c.visible);

  const focusEnabledCols = useMemo(() => {
    const defaultCols = visCols
      .map(vc => SR_COLUMNS?.find(c => c.key === vc.key))
      .filter(Boolean)
      .filter(cd => !cd.readOnly)
      .map(cd => cd.key);

    if (focusCols.length === 0) return defaultCols;
    return defaultCols.filter(k => focusCols.includes(k));
  }, [visCols, focusCols]);


  // ── Session ──────────────────────────────────────────────────────────────
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
        BillFormatName: com0.SaleBillFormat || "Default",
      };
    } catch {
      return {
        Comid: "1", MComid: "1",
        BillNoType: "Daily Reset On Company", BillNoPrefix: "", BillNoDigit: 0,
        CashId: "0", CashierId: "0", CashierName: "",
        CommonCompany: false, DayClose: false, BillFormatName: "Default",
      };
    }
  });
const loadColCfg = useCallback(async (comid) => {
  try {
    const url = CC.BASE_URL + `${CC.GetFocusColumnsUrl}?comid=${sess.Comid}&filename=SaleReturn`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...CC.authHeaders() },
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data)) return;
    setColSettings(prev => prev.map(col => {
      const s = data.find(x => x.column === col.key);
      if (!s) return col;
      // ── Invert exactly as jQuery/Purchase does ──
      const visible = s.Visible === false ? true : false;
      return { ...col, visible, width: Number(s.Width) || col.width };
    }));
  } catch {}
}, [sess.Comid]);
  // ── State ─────────────────────────────────────────────────────────────────
  const [perm,         setPerm]         = useState({ View: 0, Add: 0, Edit: 0, Delete: 0 });
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [customers,  setCustomers]  = useState([]);
  const [salesmen,   setSalesmen]   = useState([]);
const [billLoadOpen, setBillLoadOpen] = useState(false);
const [billLoadItems, setBillLoadItems] = useState([]); // rows fetched from original sale
const [billLoadNo, setBillLoadNo] = useState("");
  const [returnNo,   setReturnNo]   = useState("");
  const [returnDate, setReturnDate] = useState(today());
  const [custId,     setCustId]     = useState("");
  const [custMobile, setCustMobile] = useState("");
  const [smId,       setSmId]       = useState("");
  const [cashier,    setCashier]    = useState("");
  const [crmNo,      setCrmNo]      = useState("");
  const [crmValue,   setCrmValue]   = useState("0.00");
  const [curBal,     setCurBal]     = useState("0.00");
  const [stockLbl,   setStockLbl]   = useState("0.00");
  const [remarks,    setRemarks]    = useState("");
  const [returnType, setReturnType] = useState("CASH");
  const [editId,     setEditId]     = useState(0);

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

  const [lastReturnNo,  setLastReturnNo]  = useState(() => localStorage.getItem("lastReturnNo")  || "—");
  const [lastReturnAmt, setLastReturnAmt] = useState(() => parseFloat(localStorage.getItem("lastReturnAmt")) || 0);

  const [prodPopup,  setProdPopup]  = useState(null);
  const [prodList,   setProdList]   = useState([]);
  const [f5Open,     setF5Open]     = useState(false);
  const [f5Rows,     setF5Rows]     = useState([]);

  const rowsRef  = useRef(rows);
  const cellRefs = useRef({});
  const custRef  = useRef(null);
  const remarksRef = useRef(null);

  useEffect(() => { rowsRef.current = rows; }, [rows]);
useEffect(() => { focusColsRef.current = focusCols; }, [focusCols]);

const loadFocusCols = useCallback(async (mcomid) => {
  try {
  const url =  CC.BASE_URL + `${CC1.GetFocusColumnsUrl}?comid=${sess.Comid}&filename=SaleReturnFocus`;
    //const url = `/Content/Appdata/Visible/${mcomid}/SaleReturnFocus.json?v=${Date.now()}`;
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
  // init cashier from session
  useEffect(() => {
    setCashier(sess.CashierName || localStorage.getItem("CashierName") || "");
  }, [sess]);

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
    await Promise.all([loadDropdowns(), loadReturnNo(), loadColCfg(sess.Comid), loadFocusCols(sess.MComid)]);
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
// ─── CTRL+G COLUMN REORDER / FOCUS POPUP ─────────────────────────────────────
function CtrlGFocusPopup({ colSettings, comid, mcomid, onSaved, onClose, toast }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  useEffect(() => {
    (async () => {
      try {
         const url =  CC.BASE_URL + `${CC1.GetFocusColumnsUrl}?comid=${sess.Comid}&filename=SaleReturnFocus`;
       // const url = `/Content/Appdata/Visible/${mcomid}/SaleReturnFocus.json?v=${Date.now()}`;
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
      filename: "SaleReturnFocus",   // ← SaleReturn specific
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
  // ── Customer change → load CRM + Balance ─────────────────────────────────
  const handleCustomerChange = useCallback(async (cid) => {
    setCustId(cid);
    const found = customers.find(c => String(c.Id) === cid);
    setCustMobile(found?.MobileNo || "");
    if (!cid) { setCrmValue("0.00"); setCurBal("0.00"); setStockLbl("0.00"); return; }

    const [crmRes, balRes] = await Promise.all([
      CC.api(CRMBalanceUrl, null, {}, { Id: cid, Fromdate: returnDate, Comid: sess.Comid, MComid: sess.MComid }),
      CC.api(CurrentBalanceUrl, null, {}, { Id: cid, MComid: sess.MComid, TillDate: returnDate, Comid: sess.Comid, AccountType: "CUSTOMER" }),
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
  }, [sess, returnDate, customers]);

  // ── Totals recalc ─────────────────────────────────────────────────────────
  const recalcTotals = useCallback((rowsArr, dPer, oPlus, oMinus, coin) => {
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

    // apply bill discount % on top
    const billDisc = vn(dPer) > 0 ? f2(grossAmt * (vn(dPer) / 100)) : 0;
    const totalDisc = f2(discAmt + billDisc);
    const netAmt = f2(grossAmt + gstAmt + cessAmt + vn(oPlus) - totalDisc - vn(oMinus) + vn(coin));

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
      setStockLbl(vn(item.Stock).toFixed(0));
      return newRow;
    }));
    setProdPopup(null);

    setTimeout(() => {
      // ✅ FIX: focusColsRef-ல் உள்ள first column-க்கு போ
      // ProductCode தவிர முதல் column எது என்று பார்க்கும்
      const editableCols = SR_COLUMNS
        .filter(c => !c.readOnly && c.key !== "ProductCode")
        .map(c => c.key);

      const firstFocusCol =
        focusColsRef.current.length > 0
          ? focusColsRef.current.find(k => k !== "ProductCode" && editableCols.includes(k))
          : "ReturnQty"; // ← default fallback

      const targetCol = firstFocusCol || "ReturnQty";
      const el = cellRefs.current[rid]?.[targetCol];
      if (el) { el.focus(); el.select?.(); }
    }, 50);
}, []); // focusColsRef is a ref — no dependency needed

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
// ─── BillNo cell → fetch original sale bill for return (mirrors LoadSD) ─────
// ─── BillNo cell → validate bill, then load its items (mirrors BillNoCheck → LoadSD) ──
const fetchBillForReturn = useCallback(async (rid, billNoVal) => {
  const billNoNum = parseInt(billNoVal, 10);
  if (!billNoVal || !String(billNoVal).trim() || isNaN(billNoNum)) {
    toast("❌ Enter a valid Bill No", true);
    return;
  }

  setLoading(true); setLdMsg("Checking Bill No...");

  // Step 1 — validate the bill number, matches backend:
  // BillNoCheck(Int32 BillNo, string date, Int32 Cid, string BillType, Int32 Comid)
  const checkRes = await CC.api(BillNoCheckUrl, null, {}, {
    BillNo:   billNoNum,
    date:     returnDate,                 // dd/MM/yyyy or yyyy-MM-dd per backend expectation
    Cid:      parseInt(sess.CashierId) || 0,
    BillType: sess.BillNoType,
    Comid:    sess.Comid,
  });

  if (redirectIfDualLogin(checkRes)) { setLoading(false); return; }

  // Backend returns "0" (string/number) for an invalid bill, otherwise the
  // internal Sid to be used for loading the bill's items.
  const checkVal = checkRes?.data ?? checkRes?.Data1 ?? checkRes?.Data ?? checkRes;
  if (checkVal === "0" || checkVal === 0 || checkVal == null) {
    setLoading(false);
    toast("❌ Invalid Bill No !!!", true);
    return;
  }
  const sid = checkVal;

  // Step 2 — load the bill's items (equivalent of LoadSD(temp))
  setLdMsg("Loading bill items...");
  const res = await CC.api(SelectSaleBillUrl, null, {}, {
    SMid:      sid,
    Comid:     sess.Comid,
    MComid:    sess.MComid,
    Batchwise: 0,
    Serialno:  0,
  });
  setLoading(false);
  if (redirectIfDualLogin(res)) return;

  const arr = Array.isArray(res.data) ? res.data
            : Array.isArray(res.Data1) ? res.Data1
            : Array.isArray(res.Data)  ? res.Data : [];
  if (arr.length === 0) { toast("❌ No items found for this Bill", true); return; }

  setBillLoadItems(arr);
  setBillLoadNo(billNoVal);
  setBillLoadOpen(true);
  billLoadRowRef.current = rid;
}, [sess, returnDate]);

const billLoadRowRef = useRef(null);

// Confirm handler: replaces current blank row(s) with the chosen return items
// Confirm handler: replaces current blank row(s) with the chosen return items
// Confirm handler: replaces current blank row(s) with the chosen return items
const applyBillLoadItems = useCallback((selectedItems) => {
  const usable = selectedItems.filter(it => vn(it.ReturnQty) > 0);
  if (usable.length === 0) { setBillLoadOpen(false); return; }

  setRows(prev => {
    const triggerRid = billLoadRowRef.current;
    const base = prev.filter(r => !(r._rid === triggerRid && !r.ProductRefId));

    const newRows = usable.map(it => {
      // ── Defensive field mapping: backend may return different casing
      //    depending on endpoint (LoadSD vs SelectSaleBillUrl). Try every
      //    known variant before falling back to 0.
      const pick = (...keys) => {
        for (const k of keys) {
          if (it[k] !== undefined && it[k] !== null && it[k] !== "") return it[k];
        }
        return 0;
      };

      // For numeric fields the backend may return valid fallbacks where
      // the first key is 0 (e.g. SaleRate=0, PurRate=25.50). Keep existing
      // behavior for non-numeric/text keys.
      const pickNumericNonZero = (...keys) => {
        for (const k of keys) {
          const v = it[k];
          if (v === undefined || v === null || v === "") continue;
          const n = vn(v);
          if (n !== 0) return v;
        }
        // fallback: use regular pick (preserves original behavior if backend
        // truly returns 0 for all keys)
        return pick(...keys);
      };

      const saleRate  = f2(vn(pickNumericNonZero("SaleRate", "PurRate", "SalesRate", "Rate", "salerate")));
      const mrp       = f2(vn(pickNumericNonZero("MRP", "Mrp", "mrp")));
      const taxPer    = f2(vn(pickNumericNonZero("TaxPercent", "TaxPer", "GST", "Gst")));
      const discPer   = f2(vn(pick("DiscountPercent", "DiscountPer", "Discper")));
      const cessPer   = f2(vn(pick("CESSPer", "CessPer", "CESS")));
      const uomDec    = vn(pick("UOMDecimal", "UomDecimal")) || 0;
      const stockQty  = vn(pick("AvaiableQty", "AvailableQty", "StockQty"));
      const prodId    = pick("ProductId", "ProductRefId", "ProductRefid");
      const prodCode  = pick("Productcode", "ProductCode");
      const prodName  = pick("ProductName", "Productname");
      const batchId   = pick("BatchRefid", "Batchid") || null;
      const batchNo   = pick("BatchNo", "Bat_No", "BatchNo1") || "";
      const saleRefId = pick("Id", "SaleRefId", "SDRefid");   // ← THIS LINE — links back to original sale detail row
      const uom       = pick("UOM", "Uom") || "";

      if (saleRate === 0) {
        console.warn("⚠️ Bill load: SaleRate resolved to 0 for item", it);
      }
      if (!saleRefId) {
        console.warn("⚠️ Bill load: SaleRefId/Id resolved to falsy — stock won't reduce on save", it);
      }

      const row = {
        ...mkRow(),
        BillNo:          billLoadNo,
        ProductRefId:    prodId,
        ProductCode:     prodCode,
        ProductName:     prodName,
        SaleRate:        saleRate,
        MRP:             mrp,
        ReturnQty:       ns(it.ReturnQty),
        UOMDecimal:      uomDec,
        UOM:             uom,
        TaxPercent:      taxPer,
        DiscountPercent: discPer,
        CESSPer:         cessPer,
        BatchRefid:      batchId,
        Bat_No:          batchNo,
        SaleRefId:       saleRefId,   // ← used by doSave to populate SDRefid in the payload
        StockQty:        stockQty,
        _origItemQty:    vn(pick("ItemQty", "SaleQty")),
        _origBatchRefid: batchId || 0,
        _origMfgDate:    pick("MFDate", "MfgDate") || "",
        _origExpiryDate: pick("ExpDate", "ExpiryDate") || "",
        _origPDRefid:    saleRefId,
      };

      return calcReturnRow(row);
    });

    return [...base, ...newRows, mkRow()];
  });

  setBillLoadOpen(false);
  toast(`✅ ${usable.length} item(s) loaded from Bill #${billLoadNo}`);
}, [billLoadNo]);
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
      if (colKey === "ReturnQty") {
        if (r.UOMDecimal === 0 && String(value).includes(".")) {
          return r;
        }
      }
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

    // ✅ focusColsRef.current — always latest value (ref, not state)
    // ✅ Focus=true items only — already filtered in loadFocusCols
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

  // ── Clear form ────────────────────────────────────────────────────────────
  const clearForm = useCallback(async () => {
    setEditId(0);
    setCustId(""); setCustMobile(""); setSmId(""); setRemarks("");
    setCrmNo(""); setCrmValue("0.00"); setCurBal("0.00"); setStockLbl("0.00");
    setDiscPer(""); setOtherPlus(""); setOtherMinus(""); setCoinage("");
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
    if (!custId&&returnType!="CASH") { toast("❌ Select a Customer", true); return; }
  const vRows = rows.filter(r => r.ProductRefId && vn(r.ReturnQty) > 0);
if (vRows.length === 0) { toast("❌ Add at least one return item", true); return; }

const zeroRateRow = vRows.find(r => vn(r.SaleRate) === 0 || vn(r.Amount) === 0);
if (zeroRateRow) {
  toast(`❌ "${zeroRateRow.ProductName}" has SaleRate/Amount = 0 — fix before saving`, true);
  return;
}
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
       SDRefid:         r.SaleRefId || 0,
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
      StockQty:        vn(r.ReturnQty),
      StockQtyNew:     vn(r.ReturnQty),
      BatchRefid:      r.BatchRefid || null,
      Bat_No:          r.Bat_No || "",
       BillNo:          r.BillNo || null,        // ← also include, matches jQuery's grdBillNo on the row
  SaleRefId:       r.SaleRefId || 0, 
      remarks:         r.Remarks || "",
    }));
 const stockDetails = editId > 0
      ? vRows
          .filter(r => r._origItemQty && vn(r._origItemQty) > 0)
          .map(r => ({
            ProductRefid: r.ProductRefId,
            Batchid: r._origBatchRefid || 0,
            RealQty: f2(vn(r._origItemQty)),
            Qty: 0.0,
            MfDate: r._origMfgDate ? String(r._origMfgDate).slice(0,10).split("-").reverse().join("/") : "",
            ExpDate: r._origExpiryDate ? String(r._origExpiryDate).slice(0,10).split("-").reverse().join("/") : "",
            SerialNoStatus: 0,
            AdjustType: 0,
            PDRefid: r._origPDRefid || null,
            ItemQty: f2(vn(r._origItemQty)),
            Bags: vn(r._origBags) || 0,
          }))
      : [];
    const payload = [{
      Id:               editId,
      CustomerRefId:    custId ? parseInt(custId) : parseInt(sess.CashId),
      CompanyRefId:     parseInt(sess.Comid),
      SaleNoDisplay:    returnNo,
      SaleNo:           returnNo,
      SaleDate:         returnDate,
      SaleType:         returnType,
      LorryNo:          returnType,
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
      DeleteStatus:     true,
      CustomerName:     custObj?.AccountName || "",
      Address1:         custObj?.Address1    || "",
      Address2:         custObj?.Address2    || "",
      City:             custObj?.City        || "",
      PhoneNo:          custObj?.MobileNo    || "",
      TinNo:            custObj?.GSTINNo     || "",
      IGSTBill:         custObj?.IGSTBill    || "GST",
      Modified_By:      username,
      ModifiedStatus:   editId > 0 ? 1 : 0,
      Modified_Date:    returnDate,
      SaleDetails: returndetails,
       StockDetails: stockDetails, 
    }];
   console.log(payload);
    const headers = {
      "Comid":      String(sess.Comid),
      "cashid":     String(sess.CashId),
      "BillType":   sess.BillNoType,
      "BillPerfix": sess.BillNoPrefix,
      "BillDigit":  String(sess.BillNoDigit),
      "DayClose":   sess.DayClose ? "1" : "0",
      "MirrorTable": "0", "LocalDB": "0",
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
      returnNo, returnDate, editId, otherMinus, otherPlus, discPer, coinage,
      customers, returnType, smId]);

  // ── Delete return ─────────────────────────────────────────────────────────
const doDeleteReturn = useCallback(async () => {
    if (!editId) { toast("No return to delete", true); return; }
    if (!perm.Delete) { toast("❌ Delete Permission Denied", true); return; }
    const ok = await confirm("Do you want to Cancel this Return?");
    if (!ok) return;
    setLoading(true); setLdMsg("Loading return details...");

    // ── FIX: mirror SaleBill.handleF5Delete / handleF5Delete in this file —
    // fetch the SAVED record fresh from SaleReturnEditUrl right before delete,
    // instead of trusting whatever is currently in the `rows` state (which
    // may be a stale edit-load, or edited-but-unsaved values).
    const editRes = await CC.api(SaleReturnEditUrl, null, {}, {
      Id: editId, SaleReturnNo: 0, Comid: sess.Comid,
    });

    if (redirectIfDualLogin(editRes)) { setLoading(false); return; }
    if (!editRes || !(editRes.ok ?? editRes.IsSuccess)) {
      setLoading(false);
      toast("❌ Failed to load return details", true);
      return;
    }

    const data    = Array.isArray(editRes.Data) ? editRes.Data[0] : editRes.data;
    const master  = Array.isArray(data) ? data[0] : data;
    const details = master?.SaleReturnDetails || master?.SaleDetails || [];

    // Build List<StockDetailsModel> from the FRESH, DB-saved details —
    // exactly mirrors handleF5Delete's body-building logic below.
    const body = details
      .filter(r => vn(r.ItemQty || r.ReturnQty) > 0)
      .map(r => ({
        ProductRefid:   r.ProductRefId  || r.ProductRefid  || 0,
        Batchid:        r.BatchRefid    || r.Batchid        || 0,
        RealQty:        vn(r.ItemQty    || r.ReturnQty),
        Qty:            0,
        MfDate:         "",
        ExpDate:        "",
        SerialNoStatus: 0,
        AdjustType:     0,
        PDRefid:        r.SRDId         || r.PDRefid        || null,
        ItemQty:        vn(r.ItemQty    || r.ReturnQty),
        Bags:           0,
      }));

    const extraHeaders = {
      Comid:       String(sess.Comid),
      Id:          String(editId),
      Date:        returnDate,
      DayClose:    sess.DayClose ? "1" : "0",
      MirrorTable: "0",
      Updateid:    "0",
      LocalDB:     "2",
    };

    const res = await CC.api(SaleReturnDeleteUrl, body, extraHeaders, null);

    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res.ok ?? res.IsSuccess) {
      toast("✅ Return Deleted Successfully");
      await clearForm();
    } else {
      toast("❌ " + (res.message || res.Message || "Delete Failed"), true);
    }
  }, [editId, perm, confirm, sess, clearForm, returnDate, redirectIfDualLogin, toast]);

  // ── F5 view ───────────────────────────────────────────────────────────────
  const openF5 = useCallback(async (from = returnDate, to = returnDate) => {
    if (!perm.Edit) { toast("❌ Edit Permission Denied", true); return; }
    setLoading(true); setLdMsg("Loading returns...");
    const res = await CC.api(SaleReturnSelectUrl, null, {}, {
      Comid: sess.Comid, Fromdate: from, Todate: to, Id: 0,
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;

    let master = [];
    if (Array.isArray(res?.Data)) {
      const node = res.Data[0];
      master = node?.salereturnmaster || node?.SaleReturnMaster
            || node?.salemaster       || node?.SaleMaster
            || res.Data || [];
    } else if (Array.isArray(res?.data)) {
      const node = res.data[0];
      master = node?.salereturnmaster || node?.SaleReturnMaster
            || node?.salemaster       || node?.SaleMaster
            || res.data || [];
    } else if (Array.isArray(res)) {
      master = res;
    }

    const normalized = master.map(r => ({
      ...r,
      SaleReturnNoDisplay: r.SaleReturnNoDisplay || r.SaleReturnNo || r.SaleNo || r.BillNo || "—",
      ReturnDate:   r.ReturnDate  || r.BillDate  || r.SaleDate || "",
      CustomerName: r.CustomerName || r.AccountName || "",
      NetAmt:       r.NetAmt || r.NetAmount || r.Netamt || 0,
      LorryNo:      r.LorryNo || r.SaleType || "CRN",
    }));

    setF5Rows(Array.isArray(normalized) ? normalized : []);
    setF5Open(true);
  }, [sess, returnDate, perm, redirectIfDualLogin]);

  // ── Edit return ───────────────────────────────────────────────────────────
  const doEditReturn = useCallback(async (id) => {
    setF5Open(false);
    if (!perm.Edit) { toast("❌ Edit Permission Denied", true); return; }
    setLoading(true); setLdMsg("Loading return...");
    const res = await CC.api(SaleReturnEditUrl, null, {}, {
      Id: id, SaleReturnNo:0,Comid: sess.Comid,
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (!(res.ok ?? res.IsSuccess)) { toast("❌ " + (res.message || "Load Failed"), true); return; }
    const data = Array.isArray(res.Data) ? res.Data[0] : res.data;
    if (!data) { toast("❌ No data found", true); return; }

    const master  = Array.isArray(data) ? data[0] : data;
    const details = master.SaleReturnDetails || master.SaleDetails || [];

    setEditId(master.Id || id);
    setReturnNo(ns(master.SaleNoDisplay || master.SaleNo));
    setReturnDate(String(master.ReturnDate || "").slice(0, 10) || today());
    setReturnType(master.LorryNo || master.SaleType || "CASH");
    setCustId(ns(master.CustomerRefId));
    const found = customers.find(c => String(c.Id) === ns(master.CustomerRefId));
    setCustMobile(found?.MobileNo || "");
    setSmId(ns(master.salesmanRefId || ""));
    setRemarks(ns(master.Remarks));
    setOtherMinus(ns(master.OtherssubAmt || ""));
    setOtherPlus(ns(master.OthersplusAmt || ""));
    setDiscPer(ns(master.disper || ""));
    setCoinage(ns(master.Coinage || ""));
    const loadedRows = details.map(r => calcReturnRow(fmtRow({
      ...mkRow(),
      ...r,
      _rid: genRid(),
      _origItemQty:    vn(r.ItemQty || r.ReturnQty),
      _origBatchRefid: r.BatchRefid || 0,
      _origMfgDate:    r.MfgDate || "",
      _origExpiryDate: r.ExpiryDate || "",
      _origPDRefid:    r.SRDId || r.PDRefid || null,
      _origBags:       r.Bags || r.Pcs || 0,
    })));
    setRows(loadedRows.length > 0 ? loadedRows : [mkRow()]);
  // eslint-disable-next-line
  }, [sess, perm, customers]);

const handleF5Delete = useCallback((id, billNo) => {
    pwOkRef.current = async () => {
      const ok = await confirm(`Cancel Return "${billNo}"?`);
      if (!ok) return;
      setLoading(true); setLdMsg("Loading return details...");

      // First fetch the return details to build StockDetailsModel body
      const editRes = await CC.api(SaleReturnEditUrl, null, {}, {
      Id: id, SaleReturnNo:0,Comid: sess.Comid,
      });

      if (!editRes || !(editRes.ok ?? editRes.IsSuccess)) {
        setLoading(false);
        toast("❌ Failed to load return details", true);
        return;
      }

      const data    = Array.isArray(editRes.Data) ? editRes.Data[0] : editRes.data;
      const master  = Array.isArray(data) ? data[0] : data;
      const details = master?.SaleReturnDetails || master?.SaleDetails || [];

      // Build List<StockDetailsModel> from fetched details
      const body = details
        .filter(r => vn(r.ItemQty || r.ReturnQty) > 0)
        .map(r => ({
          ProductRefid:   r.ProductRefId  || r.ProductRefid  || 0,
          Batchid:        r.BatchRefid    || r.Batchid        || 0,
          RealQty:        vn(r.ItemQty    || r.ReturnQty),
          Qty:            0,
          MfDate:         "",
          ExpDate:        "",
          SerialNoStatus: 0,
          AdjustType:     0,
          PDRefid:        r.SRDId         || r.PDRefid        || null,
          ItemQty:       0,
          Bags:           0,
        }));
console.log("Deleting return with body:", body);
      const extraHeaders = {
        Comid:       String(sess.Comid),
        Id:          String(id),
        Date:        returnDate,
        DayClose:    sess.DayClose ? "1" : "0",
        MirrorTable: "0",
        Updateid:    "0",
        LocalDB:     "0",
      };

      const res = await CC.api(SaleReturnDeleteUrl, body, extraHeaders, null);
      setLoading(false);
      if (redirectIfDualLogin(res)) return;
      if (res.ok ?? res.IsSuccess) {
        toast("✅ Return Deleted");
        await openF5();
      } else {
        toast("❌ " + (res.message || res.Message || "Delete Failed"), true);
      }
    };
    setPw({ title: "Delete Password" });
  }, [sess, returnDate, confirm, toast, redirectIfDualLogin, openF5]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = e => {
      if (prodPopup || f5Open || pw || f12Open || ctrlGOpen) return;
      if (e.key === "F1")  { e.preventDefault(); doSave(); }
      if (e.ctrlKey && e.key === "g") { e.preventDefault(); setCtrlGOpen(true); }
      if (e.key === "F3")  { e.preventDefault(); openF5(); }   // F3=Edit per image toolbar
      if (e.key === "F5")  { e.preventDefault(); openF5(); }
      if (e.key === "F9")  { e.preventDefault(); if (!editId) return; pwOkRef.current = doDeleteReturn; setPw({ title: "F9 Delete Password" }); }
      if (e.key === "F10") { e.preventDefault(); confirm("Do You Want To Clear?").then(ok => ok && clearForm()); }
      if (e.key === "F12") { e.preventDefault(); setF12Open(true); }
      if (e.key === "Escape") { e.preventDefault(); confirm("Do You Want To Quit?").then(ok => ok && navigate(-1)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line
  }, [prodPopup, f5Open, pw, f12Open, doSave, openF5, doDeleteReturn, clearForm, editId]);

  if (!isAuthorized) return null;

  const RIGHT_KEYS = new Set([
    "Amount","SaleRate","ReturnQty","MRP","TaxPercent","DiscountPercent",
    "TaxAmt","CESSAmount","DiscountAmt","CESSPer",
  ]);

  // ─── shared panel style ────────────────────────────────────────────────────
  const panelStyle = {
    border: "1px solid #c8d8ee",
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
      <Topbar />

      <div className="sb-body">

        {/* ══════════════════════════════════════════════════════════════════
            HEADER — 3 panel layout matching the image exactly
        ══════════════════════════════════════════════════════════════════ */}
        <div style={{
          display: "flex",
          gap: 10,
          padding: "8px 10px",
          background: "#f5f8fd",
          borderBottom: "1px solid #d0ddf5",
          alignItems: "stretch",
        }}>

          {/* ── LEFT PANEL: Sale Return Details ── */}
          <div style={{ ...panelStyle, minWidth: 220, flexShrink: 0 }}>
            <div style={panelTitle}>Sale Return Details</div>

            {/* ReturnNo */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label style={{ ...fieldLabel, minWidth: 78 }}>ReturnNo</label>
              <input
                style={{ ...fieldInput, flex: 1 }}
                value={returnNo}
                onChange={e => setReturnNo(e.target.value)}
                readOnly
              />
            </div>

            {/* ReturnDate */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label style={{ ...fieldLabel, minWidth: 78 }}>ReturnDate</label>
              <input
                type="date"
                style={{ ...fieldInput, flex: 1 }}
                value={returnDate}
                onChange={e => setReturnDate(e.target.value)}
              />
            </div>

            {/* ReturnType — simple dropdown */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label style={{ ...fieldLabel, minWidth: 78 }}>ReturnType</label>
              <select
                style={{ ...fieldInput, flex: 1 }}
                value={returnType}
                onChange={e => setReturnType(e.target.value)}
              >
                {RETURN_TYPES.map(rt => (
                  <option key={rt.value} value={rt.value}>{rt.label}</option>
                ))}
              </select>
            </div>

            {editId > 0 && (
              <div style={{ fontSize: 10, color: "#1f65de", fontWeight: 700 }}>✏️ EDIT MODE</div>
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
              {/* Mobile as a simple read-only combobox-like select */}
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

            {/* CRM Value + CurrentBal + Stock */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#4a5568" }}>CRM Value</label>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#16a34a", minWidth: 48 }}>{crmValue}</span>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#4a5568" }}>CurrentBal</label>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#16a34a", minWidth: 48 }}>{curBal}</span>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#4a5568" }}>Stock</label>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", minWidth: 48 }}>{stockLbl}</span>
            </div>
          </div>

          {/* ── RIGHT PANEL: Amount + SalesMan + Cashier ── */}
          <div style={{ ...panelStyle, minWidth: 240, flexShrink: 0, alignItems: "stretch" }}>
            {/* Net Amount — large green */}
            <div style={{ textAlign: "center", fontSize: 22, fontWeight: 800, color: "#16a34a", letterSpacing: 0.5, paddingBottom: 4 }}>
              Rs.{totals.NetAmt.toFixed(2)}
            </div>

            {/* SalesMan */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label style={{ ...fieldLabel, minWidth: 58 }}>SalesMan</label>
              <ComboBox
                options={[{ value: "", label: "" }, ...salesmen.map(s => ({ value: String(s.Id), label: s.SalesManName }))]}
                value={smId}
                onChange={setSmId}
                placeholder="Select SalesMan"
              />
            </div>

            {/* Cashier */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label style={{ ...fieldLabel, minWidth: 58 }}>Cashier</label>
              <input
                style={{ ...fieldInput, flex: 1 }}
                value={cashier}
                onChange={e => setCashier(e.target.value)}
                placeholder="Cashier"
              />
            </div>
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
                                color: isAmt ? "#1f65de" : undefined,
                                fontWeight: isAmt ? 700 : undefined,
                              }}>
                                {isFloat && val ? f2(val).toFixed(2) : ns(val)}
                              </span>
                            )  : col.key === "BillNo" ? (
  <input
    ref={el => regCell(row._rid, col.key, el)}
    className="sb-cell-input"
    value={ns(val)}
    onChange={e => handleCellChange(row._rid, col.key, e.target.value)}
    onKeyDown={e => {
      if (e.key === "Enter") {
        e.preventDefault();
        const v = rowsRef.current.find(r => r._rid === row._rid)?.BillNo;
        if (v) fetchBillForReturn(row._rid, v);
        else handleCellKeyDown(e, row._rid, col.key); // fall through to normal nav
        return;
      }
      handleCellKeyDown(e, row._rid, col.key);
    }}
    onFocus={() => setSelRid(row._rid)}
    placeholder="Bill No"
    style={{ width: "100%", boxSizing: "border-box" }}
  />
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
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            BOTTOM SECTION — GST split left + Totals grid (matches image)
        ══════════════════════════════════════════════════════════════════ */}
        <div style={{
          display: "flex",
          gap: 0,
          borderTop: "1px solid #d0ddf5",
          background: "#f8fafd",
          flexShrink: 0,
        }}>

          {/* ── GST SPLIT TABLE (left) ── */}
          <div style={{
            minWidth: 340, maxWidth: 360,
            borderRight: "1px solid #d0ddf5",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "80px 1fr 1fr 1fr",
              background: "#e8edf7",
              borderBottom: "1px solid #d0ddf5",
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
                    background: i % 2 === 0 ? "#fff" : "#f5f8fd",
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

          {/* ── TOTALS GRID (right, 3×3 matching image) ── */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", fontSize: 12 }}>

            {/* Col 1 */}
            <div style={{ borderRight: "1px solid #d0ddf5", display: "flex", flexDirection: "column" }}>
              {[
                { label: "Gross Amt",  value: totals.GrossAmt.toFixed(2), readOnly: true },
                { label: "Disc(%)",    value: discPer, onChange: setDiscPer, type: "number" },
                { label: "Disc Amt",   value: totals.DiscAmt.toFixed(2), readOnly: true },
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
            <div style={{ borderRight: "1px solid #d0ddf5", display: "flex", flexDirection: "column" }}>
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
            BOTTOM TOOLBAR — matches image: F1-CashBill | F3-Edit | F5-View | F9-Delete | DEL-Delete | ESC-Exit
        ══════════════════════════════════════════════════════════════════ */}
        <div className="sb-toolbar" style={{ borderLeftColor: "var(--clr-primary)" }}>
          <button className="sb-btn sv" onClick={doSave} disabled={loading}
            style={{ background: "var(--clr-primary)", borderColor: "var(--clr-primary)" }}>
            💾 F1 - CashBill
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
              onClick={() => { pwOkRef.current = doDeleteReturn; setPw({ title: "F9 Delete Password" }); }}
              disabled={loading}>🗑 F9 - Delete</button>
          )}
          <button className="sb-btn dl"
            onClick={() => { if (!editId) return; pwOkRef.current = doDeleteReturn; setPw({ title: "DEL Delete" }); }}>
            🗑 DEL - Delete
          </button>
          <button className="sb-btn dl" onClick={() => navigate(-1)}>✕ ESC - Exit</button>
          {loading && <span style={{ fontSize: 11, color: "#6b7a99" }}>⏳ {ldMsg}</span>}
          {/* right-side info */}
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "#6b7a99" }}>
            <span>Return Qty: <b style={{ color: "#1a2e4a" }}>{totalQty % 1 === 0 ? totalQty.toFixed(0) : totalQty.toFixed(2)}</b></span>
            <span>Items: <b style={{ color: "#1a2e4a" }}>{itemCount}</b></span>
            <span>Last: <b style={{ color: "#1f65de" }}>{lastReturnNo}</b></span>
            {lastReturnAmt > 0 && <span>Amt: <b style={{ color: "#16a34a" }}>₹{lastReturnAmt.toFixed(2)}</b></span>}
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

      {prodPopup && (
        <ProductSearchPopup
          products={prodList}
          isTamil={sess.Tamil}
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
{billLoadOpen && (
  <BillLoadPopup
    items={billLoadItems}
    billNo={billLoadNo}
    onConfirm={applyBillLoadItems}
    onClose={() => setBillLoadOpen(false)}
  />
)}
      <CC.ToastList toasts={toasts} />
    </div>
  );
}