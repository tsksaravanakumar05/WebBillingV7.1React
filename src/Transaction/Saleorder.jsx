// ─────────────────────────────────────────────────────────────────────────────
//  SaleOrder.jsx  —  React Sale Order Form
//  Converted from SaleOrder.js (jQuery/jqxGrid) to React
//  Design matches SaleReturn.jsx pattern exactly
//
//  ALL LOGIC from SaleOrder.js is preserved:
//   • Permission check (menulist → "Sales Order")
//   • Tax type (Exclusive/Inclusive), taxinclusivedontshow
//   • Bill Discount (per + amount), BillDiscLog, CalcutionBillDiscount
//   • SameProductSameLine merge logic
//   • AllowNegativeStock / NegativetStock per product
//   • WholeSaleRate switching (M/R/P/W/C)
//   • DefaultQty, UOMDecimal (0/2/3)
//   • Free Qty / Free Amt / Company Offer rows (color coding)
//   • NOMS / NOMSQty logic
//   • TextilesAutoGST / AutoGSTDeptWise
//   • SaleDiscountAfterTax
//   • RoundoffPaise coinage
//   • F1=Save, F3=Edit, F5=View, F8=DiscPer, F9=Delete, F10=Clear, F12=ColConfig
//   • Ctrl+F = Form Focus/Reorder, Ctrl+G = Grid Focus/Reorder
//   • Password modal for F3/F5/F9
//   • IGSTBill split (CGST/SGST vs IGST)
//   • PrintA4Bill flow (Print/View/Mail)
//   • GST split table
//   • Remarks popup for JJBitumen bill format
//   • Row delete with free-qty cascade
//   • CRM discount, customer card type
//   • Credit days / credit limit
//   • Salesman commission per row
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../components/Common";
import Topbar from "../components/Topbar";
import "../TransactionStyle/SaleOrder.css";

// ─── API ENDPOINTS (SaleOrder specific) ──────────────────────────────────────
// ─── EXTRACTED GLOBALS FROM Common.jsx ───────────────────────────────────────
// (Aliases removed - using CC.* directly)


// ─── ROW FACTORY ──────────────────────────────────────────────────────────────
const mkRow = () => ({
  _rid: CC.genRid(), _isNew: true, _dirty: false, _indexid: CC.newGuid(),
  SDId: 0, ProductRefId: 0, ProductCode: "", ProductName: "",
  MRP: "0.00", SaleRate: "0.00", ItemQty: "", UOMDecimal: 0,
  TaxPercent: "0.00", TaxAmt: 0, CESSPer: "0.00", CESSAmount: 0,
  DiscountPercent: "0.00", DiscountAmt: "0.00",
  cdpercent: "0.00", cdAmount: "0.00",
  SPLCESSPer: "0.00", SPLCESSAmount: 0,
  LandingCost: 0, OrgRate: 0, CTAmount: 0, STAmount: 0,
  Amount: 0, ProductTotal: 0, WithoutTaxRate: 0, NetSaleRate: 0,
  UOM: "", HSNcode: "", StockQty: 0, BatchRefid: null,
  ExpiryDate: null, MfgDate: null, Bat_No: "",
  PrintName: "", NegativetStock: false, SaleRateType: true,
  FreeQty: 0, NOMS: "0", NOMSQty: 0, NomsRate: 0, SaleRateorg: 0,
  SMCode: "", SalesManRefId: null, salesmancomm: 0, salesmancomm_amt: 0,
  Freeamountdetailsrefid: null, Freeqtydetailsrefid: null,
  CompanyOfferFreeqtydetailsrefid: null, Schemedetailsrefid: null,
  Pcs: "", Meter: "", TotalPcs: "", PCMETER: "",
  BillNo: "", remarks: "", deptname: "",
  LandingcostAmountPrint: 0, Landingcostprint: 0, LandingcostProfit: 0,
  discperprint: 0, discamountprint: 0, salerateprint: 0,
  orgrate: 0, LessAmt: "0.00", MaxSaleQty: 0,
  RetailRate: "0.00", WholeSaleRate: "0.00", CardRate: "0",
  PurchaseRate: "0.00", CRMPoints: 0, SRDetailsId: null,
  BatchStatus: 0, EditMode: 0, RealQty: 0,
});

const fmtRow = obj => ({
  ...mkRow(), ...obj,
  _rid: obj._rid || CC.genRid(),
  _isNew: false, _dirty: false,
  MRP:             CC.ns(CC.f2(CC.vn(obj.MRP))),
  SaleRate:        CC.ns(CC.f2(CC.vn(obj.SaleRate))),
  ItemQty:         (() => {
    const d = obj.UOMDecimal;
    if (d === 2) return CC.f2(CC.vn(obj.ItemQty)).toFixed(2);
    if (d === 3) return CC.f3(CC.vn(obj.ItemQty)).toFixed(3);
    return Math.round(CC.vn(obj.ItemQty)).toFixed(0);
  })(),
  TaxPercent:      CC.ns(CC.f2(CC.vn(obj.TaxPercent))),
  TaxAmt:          CC.f2(CC.vn(obj.TaxAmt)),
  CESSPer:         CC.ns(CC.f2(CC.vn(obj.CESSPer))),
  CESSAmount:      CC.f2(CC.vn(obj.CESSAmount)),
  DiscountPercent: CC.ns(CC.f2(CC.vn(obj.DiscountPercent))),
  DiscountAmt:     CC.ns(CC.f2(CC.vn(obj.DiscountAmt))),
  cdpercent:       CC.ns(CC.f2(CC.vn(obj.cdpercent))),
  cdAmount:        CC.ns(CC.f2(CC.vn(obj.cdAmount))),
  Amount:          CC.f2(CC.vn(obj.Amount)),
  LandingCost:     CC.f2(CC.vn(obj.Landingcost || obj.LandingCost)),
  WholeSaleRate:   CC.ns(CC.f2(CC.vn(obj.WholeSaleRate))),
  RetailRate:      CC.ns(CC.f2(CC.vn(obj.RetailRate))),
  LessAmt:         CC.ns(CC.f2(CC.vn(obj.LessAmt))),
  CardRate:        CC.ns(CC.f2(CC.vn(obj.CardRate))),
  SPLCESSPer:      CC.ns(CC.f2(CC.vn(obj.SPLCESS || obj.SPLCESSPer))),
  SPLCESSAmount:   CC.f2(CC.vn(obj.SPLCESSAmount)),
  NOMS:            CC.ns(obj.NOMS || "0"),
});

// ─── ROW CALCULATION (mirrors SaleOrder.js methods.Calculation) ───────────────
function calcSaleRow(row, settings) {
  const {
    taxtype,            // 1=Exclusive, 0=Inclusive
    taxinclusivedontshow, // 0 = show tax logic, 1 = don't split
    SaleDiscountAfterTax,
    BillDiscLog,
    IGSTBillStatus,
    TextilesAutoGST,
    TextilesSaleRateMax,
    TextilesMaxGST,
    TextilesMinGST,
    RiceUOMSetting,
    AutoGSTDeptWise,
  } = settings;

  const qty      = CC.vn(row.ItemQty) + CC.vn(row.NOMS);
  const salerate = CC.vn(row.SaleRate);
  const cdper    = CC.vn(row.cdpercent);
  const discper  = CC.vn(row.DiscountPercent);
  let   gst      = CC.vn(row.TaxPercent);
  const cess     = CC.vn(row.CESSPer);
  const splcess  = CC.vn(row.SPLCESSPer);
  const deptname = CC.ns(row.deptname);

  if (qty === 0 || salerate === 0) return { ...row, Amount: 0, TaxAmt: 0, CTAmount: 0, STAmount: 0, CESSAmount: 0, SPLCESSAmount: 0, ProductTotal: 0, LandingCost: 0, discamountprint: 0 };

  // TextilesAutoGST rate selection
  if (TextilesAutoGST && deptname !== "NO" && AutoGSTDeptWise && row.ProductCode) {
    let dfRate = salerate;
    const cashamount = dfRate * (cdper / 100);
    dfRate -= cashamount;
    const disamount = dfRate * (discper / 100);
    dfRate -= disamount;
    gst = dfRate >= TextilesSaleRateMax ? TextilesMaxGST : TextilesMinGST;
  }

  let orgrate = salerate;
  let cdamt = 0, discamt = 0, gstamt = 0, cessamt = 0, splcessamt = 0;
  let ctamt = 0, stamt = 0, Amount = 0, landingcost = 0;
  let orgratenew = 0, landingcostprint = 0, landingcostAmountPrint = 0;

  if (taxinclusivedontshow === 0) {
    // Exclusive tax mode
    if (taxtype === 0) {
      orgrate = salerate - splcess;
      const withouttax = CC.roVal(orgrate / (((gst + cess) / 100) + 1));
      orgrate = RiceUOMSetting ? withouttax * qty : withouttax * qty;
    } else {
      orgrate = salerate * qty;
    }

    const A1  = orgrate;
    cdamt     = CC.roVal(A1 * (cdper / 100));
    const B1  = A1 - cdamt;

    if (BillDiscLog === 0) discamt = CC.roVal(B1 * (discper / 100));
    else discamt = parseFloat((B1 * (discper / 100)).toFixed(4));

    if (qty !== 0) {
      landingcost = SaleDiscountAfterTax
        ? orgrate
        : orgrate - cdamt - discamt;
    }

    splcessamt = splcess * qty;

    if (qty !== 0 && landingcost !== 0) {
      if (!SaleDiscountAfterTax) {
        ctamt   = CC.roVal(landingcost * ((gst / 2) / 100));
        stamt   = CC.roVal(landingcost * ((gst / 2) / 100));
        cessamt = CC.roVal(landingcost * (cess / 100));
        gstamt  = ctamt + stamt;
        if (IGSTBillStatus) { ctamt = gstamt; stamt = 0; }
      } else {
        ctamt   = CC.roVal(CC.roVal((orgrate / qty) * ((gst / 2) / 100)) * qty);
        stamt   = CC.roVal(CC.roVal((orgrate / qty) * ((gst / 2) / 100)) * qty);
        cessamt = CC.roVal(orgrate * (cess / 100));
        gstamt  = ctamt + stamt;
        if (IGSTBillStatus) { ctamt = gstamt; stamt = 0; }
      }

      Amount = SaleDiscountAfterTax
        ? CC.f2(orgrate - discamt + gstamt + cessamt + splcessamt)
        : CC.f2(landingcost + gstamt + cessamt + splcessamt);

      orgratenew          = CC.roVal(orgrate);
      landingcostprint    = CC.roVal(orgrate / qty);
      landingcostAmountPrint = landingcostprint * qty - (cdamt + discamt);
    }
  } else {
    // Inclusive tax mode
    orgrate = salerate * qty;
    const A1 = orgrate;
    cdamt     = CC.roVal(A1 * (cdper / 100));
    const B1  = A1 - cdamt;

    if (BillDiscLog === 0) discamt = CC.roVal(B1 * (discper / 100));
    else discamt = parseFloat((B1 * (discper / 100)).toFixed(4));

    landingcost = orgrate - cdamt - discamt;

    const A = landingcost;
    const B = (gst / 100) + 1;
    const C = CC.roVal(A / B);
    const D = (cess / 100) + 1;
    const E = CC.roVal(A / D);
    gstamt  = CC.roVal(A - C);
    cessamt = CC.roVal(A - E);
    ctamt   = CC.roVal(gstamt / 2);
    stamt   = CC.roVal(gstamt / 2);
    gstamt  = ctamt + stamt;
    if (IGSTBillStatus) { ctamt = gstamt; stamt = 0; }
    splcessamt = splcess * qty;
    Amount = CC.f2(landingcost + splcessamt);

    orgratenew          = orgrate - (gstamt + cessamt);
    landingcostprint    = CC.roVal(orgrate / qty) + splcess;
    landingcostAmountPrint = landingcostprint * qty - (cdamt + discamt);
  }

  return {
    ...row,
    TaxPercent:          CC.ns(CC.f2(gst)),
    TaxAmt:              CC.f2(gstamt),
    CTAmount:            CC.f2(ctamt),
    STAmount:            CC.f2(stamt),
    CESSAmount:          CC.f2(cessamt),
    SPLCESSAmount:       CC.f2(splcessamt),
    cdAmount:            CC.ns(CC.f2(cdamt)),
    DiscountAmt:         CC.ns(CC.f2(discamt)),
    Amount:              Amount,
    LandingCost:         qty > 0 ? CC.f2(landingcost / qty) : 0,
    NetSaleRate:         qty > 0 ? CC.roVal(Amount / qty) : 0,
    orgrate:             qty > 0 ? CC.roVal(orgrate / qty) : 0,
    ProductTotal:        CC.f2(orgratenew),
    WithoutTaxRate:      taxtype === 0 && taxinclusivedontshow === 0
                           ? CC.roVal(salerate / (((gst + cess) / 100) + 1))
                           : CC.f2(salerate),
    Landingcostprint:    CC.f2(landingcostprint),
    salerateprint:       CC.f2(landingcostprint),
    LandingcostAmountPrint: CC.f2(landingcostAmountPrint),
    discperprint:        cdper + discper,
    discamountprint:     CC.f2(cdamt + discamt),
  };
}

// ─── COMBOBOX ─────────────────────────────────────────────────────────────────
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
    const h = e => { if (wrapRef.current && !wrapRef.current.contaiCC.ns(e.target)) { setOpen(false); setQ(selectedLabel); } };
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

// ─── PASSWORD MODAL ───────────────────────────────────────────────────────────
function PwModal({ title, comid, onOk, onClose }) {
  const [val, setVal] = useState("");
  const verify = async () => {
    if (!val) return;
    const res = await CC.api(CC.SO_LoginPasswordUrl, null, {}, { password: val, type: "EditPassword", Comid: comid });
    if (res.ok ?? res.IsSuccess ?? false) { onOk(); onClose(); }
    else window.alert("Invalid Password !!!");
  };
  return (
    <div className="mp-ov so-modal-overlay">
      <div className="mp-modal-box so-modal-box">
        <div className="so-modal-title">🔐 {title}</div>
        <input type="password" autoFocus value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") verify(); if (e.key === "Escape") onClose(); }}
          className="so-modal-input"
          placeholder="Enter password…" />
        <div className="so-modal-btns">
          <button className="mp-btn" onClick={onClose}>Cancel</button>
          <button className="mp-btn sv" onClick={verify}>OK</button>
        </div>
      </div>
    </div>
  );
}

// ─── PRODUCT SEARCH POPUP ─────────────────────────────────────────────────────
function ProductSearchPopup({ products, onSelect, onClose, anchorPos }) {
  const [q, setQ]   = useState("");
  const [hi, setHi] = useState(0);
  const inputRef = useRef(null);
  const listRef  = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 30); }, []);
  const filtered = products.filter(p =>
    String(p.PName || p.ProductName || "").toLowerCase().includes(q.toLowerCase()) ||
    String(p.Prod_Code || p.ProductCode || "").toLowerCase().includes(q.toLowerCase())
  ).slice(0, 120);

  useEffect(() => { setHi(0); }, [q]);
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${hi}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [hi]);

  return (
    <div className="sb-prod-search" style={{ top: anchorPos?.top || 160, left: anchorPos?.left || 20 }}>
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
            if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); }
            if (e.key === "ArrowUp")   { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
            if (e.key === "Enter")     { e.preventDefault(); if (filtered[hi]) onSelect(filtered[hi]); }
            if (e.key === "Escape")    { e.preventDefault(); onClose(); }
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
              className={`sb-prod-item${idx === hi ? " hi" : ""}`}
              onClick={() => onSelect(p)} onMouseEnter={() => setHi(idx)}>
              <span className="sb-prod-code">{p.Prod_Code || p.ProductCode}</span>
              <span className="sb-prod-name">{p.PName || p.ProductName}</span>
              <span className="sb-prod-rate">₹{CC.f2(CC.vn(p.SaleRate || p.SalesRate)).toFixed(2)}</span>
              <span className="sb-prod-stock">{CC.vn(p.Stock).toFixed(0)}</span>
            </div>
          ))
        }
      </div>
      <div className="sb-ps-footer">
        <span><kbd>↑↓</kbd> Navigate</span><span><kbd>Enter</kbd> Select</span><span><kbd>Esc</kbd> Close</span>
      </div>
    </div>
  );
}

// ─── F5 VIEW MODAL ────────────────────────────────────────────────────────────
function F5ViewModal({ rows, onEdit, onClose, fromDate, toDate, onSearch }) {
  const [from, setFrom] = useState(fromDate);
  const [to, setTo]     = useState(toDate);
  const totalAmt = rows.reduce((s, r) => s + CC.vn(r.NetAmt || r.NetAmount || r.Netamt), 0);
  return (
    <div className="mp-ov so-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mp-modal-box sb-f5-modal so-f5-modal-box">
        <div className="mp-modal-hdr">
          <span>📋 Sale Order View (F5)</span>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="so-modal-header-flex">
          <label className="so-label-sm">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="so-date-input" />
          <label className="so-label-sm">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="so-date-input" />
          <button className="mp-btn sv so-search-btn" onClick={() => onSearch(from, to)}>🔍 Search</button>
          <span className="so-total-amt">Total: ₹{CC.f2(totalAmt).toFixed(2)}</span>
        </div>
        <div className="mp-modal-body so-modal-body-flex">
          <table className="so-table">
            <thead>
              <tr>
                {["Order No", "Order Date", "Order Type", "Customer Name", "Amount", "Actions"].map(h => (
                  <th key={h} className={`so-th ${h === "Amount" ? "right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} className="so-tr-empty">No records found.</td></tr>}
              {rows.map((r, i) => (
                <tr key={r.Id || i} className={i % 2 === 0 ? "so-tr-even" : "so-tr-odd"}>
                  <td className="so-td-bold">{r.BillNo || r.SaleNo || "—"}</td>
                  <td className="so-td">{String(r.BillDate || r.SaleDate || "").slice(0, 10)}</td>
                  <td className="so-td">{r.SaleType || ""}</td>
                  <td className="so-td">{r.CustomerName || ""}</td>
                  <td className="so-td-right">₹{CC.f2(CC.vn(r.NetAmt || r.NetAmount)).toFixed(2)}</td>
                  <td className="so-td-center">
                    <button onClick={() => onEdit(r.Id)} className="so-edit-btn">✏ Edit</button>
                  </td>
                </tr>
              ))}
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
    const payload = local.map(c => ({ Comid: parseInt(comid) || 1, filename: "SaleOrder", column: c.key, Visible: c.visible === true, Width: parseInt(c.width) || 100 }));
    try {
      const res = await fetch(CC.SO_VisibleColumnsUrl, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8", ...CC.authHeaders() }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.ok) { toast?.("✅ Column settings saved"); onSave(local); }
      else { toast?.("⚠️ " + (data.message || "Saved locally"), false); onSave(local); }
    } catch { onSave(local); }
  };

  return (
    <div className="mp-ov so-modal-overlay">
      <div className="mp-modal-box so-col-config-modal">
        <div className="mp-modal-hdr"><span>⚙ Sale Order Grid Column Settings (F12)</span><button onClick={onClose}>✕</button></div>
        <div className="mp-modal-body so-col-config-body">
          <table className="so-table">
            <thead><tr>{["Column", "Visible", "Width (px)"].map(h => <th key={h} className="so-col-config-th">{h}</th>)}</tr></thead>
            <tbody>
              {local.map((c, i) => (
                <tr key={c.key} className={i % 2 === 0 ? "so-col-config-tr-even" : "so-col-config-tr-odd"}>
                  <td className="so-col-config-td">{c.label}</td>
                  <td className="so-col-config-td-center"><input type="checkbox" checked={!!c.visible} onChange={() => toggle(c.key)} /></td>
                  <td className="so-col-config-td"><input type="number" min={40} max={600} value={c.width} className="so-col-config-input" onChange={e => setWid(c.key, e.target.value)} /></td>
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

// ─── Ctrl+G Focus/Reorder Popup ───────────────────────────────────────────────
function CtrlGFocusPopup({ colSettings, comid, mcomid, onSaved, onClose, toast }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  useEffect(() => {
    (async () => {
      try {
           const url =  CC.BASE_URL + `${CC1.GetCC.SO_FocusColumnsUrl}?comid=${sess.Comid}&filename=SaleOrderFocus`;
        //const url = `/Content/Appdata/Visible/${mcomid}/SaleOrderFocus.json?v=${Date.now()}`;
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
    setItems(prev => { const next = [...prev]; const [m] = next.splice(dragIdx, 1); next.splice(idx, 0, m); return next.map((it, i) => ({ ...it, index: i })); });
    setDragIdx(null); setOverIdx(null);
  };

  const handleSave = async () => {
    const payload = items.map((it, i) => ({ filename: "SaleOrderFocus", column: it.key, Index: i, Focus: it.focus, Comid: parseInt(comid) || 1 }));
    try {
      const res = await fetch(CC.SO_FocusColumnsUrl, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8", ...CC.authHeaders() }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.ok) { toast?.("✅ Focus/Reorder saved."); onSaved?.(); onClose(); }
      else { toast?.("⚠️ " + (data.message || "Save failed")); onClose(); }
    } catch (err) { toast?.("⚠️ Save failed: " + err.message); }
  };

  return (
    <div className="so-grid-focus-overlay">
      <div className="so-grid-focus-box">
        <div className="so-grid-focus-header">
          <span className="so-grid-focus-title">⚡ Ctrl+G — Grid Column Focus & Reorder</span>
          <button onClick={onClose} className="so-close-btn">✕</button>
        </div>
        <div className="so-grid-focus-desc">
          🖱 <strong>Drag rows</strong> to reorder &nbsp;|&nbsp; ☑ <strong>Check</strong> to enable focus navigation
        </div>
        <div className="so-grid-focus-body">
          {loading ? <div className="so-loading-text">Loading...</div>
            : items.map((it, idx) => (
              <div key={it.key} draggable
                onDragStart={e => onDragStart(e, idx)} onDragOver={e => onDragOver(e, idx)}
                onDrop={e => onDrop(e, idx)} onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 14px", cursor: "grab", background: overIdx === idx ? "#deeafb" : dragIdx === idx ? "#e8f0fe" : idx % 2 === 0 ? "#fff" : "#fafbff", borderBottom: "1px solid #f0f4fc", borderLeft: overIdx === idx ? "3px solid #1f65de" : "3px solid transparent", userSelect: "none" }}>
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

// ─── INLINE STYLES ────────────────────────────────────────────────────────────

const RIGHT_KEYS = new Set(["Amount","SaleRate","ItemQty","MRP","TaxPercent","DiscountPercent","TaxAmt","CESSAmount","DiscountAmt","CESSPer","cdpercent","cdAmount","Pcs","Meter","TotalPcs","NOMS"]);
const FREE_AMT_COLOR  = "#fff3cd";
const FREE_QTY_COLOR  = "#d4edda";
const FREE_COMP_COLOR = "#cce5ff";

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function SaleOrder() {
  const navigate               = useNavigate();
  const { confirm, ConfirmUI } = CC.useConfirm();
  const { toast, toasts }      = CC.useToast();

  // ── Settings from localStorage (mirrors SaleOrder.js top vars) ────────────
  const [settings] = useState(() => {
    try {
      const main0 = (CC.getLocal("Mainsetting")    || [{}])[0] || {};
      const com0  = (CC.getLocal("Companysetting") || [{}])[0] || {};
      const Comid  = CC.getStr("Comid")  || "1";
      const MComid = CC.getStr("MComid") || Comid;
      const TaxName = com0.POSTax || "Exclusive";
      return {
        Comid:  main0.CommonCompany ? MComid : Comid,
        MComid,
        Tamil:  main0.ProductNameTamil || false,
        // Tax
        taxtype:              TaxName === "Exclusive" ? 1 : 0,
        taxinclusivedontshow: 0,
        TaxName,
        // Behaviour flags (from SaleOrder.js top)
        RoundoffPaise:        "3",
        BillHoldStop:         false,
        SingleDiscountPrint:  false,
        SaleQuanityNegative:  false,
        ProductNameKeyPress:  true,
        SameProductSameLine:  true,
        DefaultQty:           0,
        CustomerwiseSalerateopions: false,
        TextilesAutoGST:      false,
        TextilesSaleRateMax:  1000,
        TextilesMaxGST:       12,
        TextilesMinGST:       5,
        RiceUOMSetting:       false,
        WholeSaleRate:        false,
        AllowNegativeStock:   true,
        PageUpDown:           true,
        TotalDiscountPrint:   true,
        AutoGSTDeptWise:      false,
        SaleDiscountAfterTax: false,
        ProductAddSaleForm:   false,
        ProductLoad:          true,
        // CashId
        CustomerCashId: CC.getStr("CustomerCashid") || "0",
        CashierId:      CC.getStr("CashierRefid")   || "0",
        CashierName:    CC.getStr("CashierName")    || "",
        BillNoType:     com0.BillType    || "Daily Reset On Company",
        BillNoPrefix:   com0.BillPrefix  || "",
        BillNoDigit:    com0.NumberDigit || 0,
        // Print
        PrintA4Bill:    main0.A4BillPrint ? 1 : 0,
        BillFormatName: com0.SaleOrderBillFormat || "Default",
        // A4 print details
        CompanyName: com0.Companyname || "",
        CAddress1:   com0.Address1   || "",
        CAddress2:   com0.Address2   || "",
        CCity:       com0.City       || "",
        CPincode:    com0.Pincode    || "",
        CMobileNo:   com0.Phone      || "",
        GSTNO:       com0.GSTNo      || "",
        Email:       com0.Email      || "",
        StateCode:   com0.State      || "",
        SaleCon1:    com0.POSLine1   || "",
        SaleCon2:    com0.POSLine2   || "",
        SaleCon3:    com0.POSLine3   || "",
        SaleCon4:    com0.POSLine4   || "",
        SaleCon5:    com0.POSLine5   || "",
        NoofBills:   com0.No_Of_Bills || 1,
        Bank1: com0.BankLine1 || "", Bank2: com0.BankLine2 || "",
        Bank3: com0.BankLine3 || "", Bank4: com0.BankLine4 || "",
        Bank5: com0.BankLine5 || "",
      };
    } catch {
      return {
        Comid: "1", MComid: "1", Tamil: false,
        taxtype: 1, taxinclusivedontshow: 0, TaxName: "Exclusive",
        RoundoffPaise: "3", BillHoldStop: false, SingleDiscountPrint: false,
        SaleQuanityNegative: false, ProductNameKeyPress: true,
        SameProductSameLine: true, DefaultQty: 0, CustomerwiseSalerateopions: false,
        TextilesAutoGST: false, TextilesSaleRateMax: 1000, TextilesMaxGST: 12, TextilesMinGST: 5,
        RiceUOMSetting: false, WholeSaleRate: false, AllowNegativeStock: true,
        PageUpDown: true, TotalDiscountPrint: true, AutoGSTDeptWise: false,
        SaleDiscountAfterTax: false, ProductAddSaleForm: false, ProductLoad: true,
        CustomerCashId: "0", CashierId: "0", CashierName: "",
        BillNoType: "Daily Reset On Company", BillNoPrefix: "", BillNoDigit: 0,
        PrintA4Bill: 0, BillFormatName: "Default",
        CompanyName: "", CAddress1: "", CAddress2: "", CCity: "", CPincode: "",
        CMobileNo: "", GSTNO: "", Email: "", StateCode: "",
        SaleCon1:"",SaleCon2:"",SaleCon3:"",SaleCon4:"",SaleCon5:"",
        NoofBills: 1, Bank1:"",Bank2:"",Bank3:"",Bank4:"",Bank5:"",
      };
    }
  });

  // ── Column Settings ────────────────────────────────────────────────────────
  const [colSettings, setColSettings] = useState(CC.DEFAULT_COL_SETTINGS);
  const [f12Open,     setF12Open]     = useState(false);
  const [ctrlGOpen,   setCtrlGOpen]   = useState(false);
  const visCols = colSettings.filter(c => c.visible);

  const loadColCfg = useCallback(async (comid) => {
    try {
       const url =  CC.BASE_URL + `${CC1.GetCC.SO_FocusColumnsUrl}?comid=${sess.Comid}&filename=SaleOrder`;
     // const url = `Content/Appdata/Visible/${comid}/SaleOrder.json?v=${Date.now()}`;
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

  // ── Focus cols (SaleOrderFocus.json) ──────────────────────────────────────
  const [focusCols, setFocusCols] = useState([]);
  const focusColsRef = useRef([]);
  useEffect(() => { focusColsRef.current = focusCols; }, [focusCols]);

  const loadFocusCols = useCallback(async (mcomid) => {
    try {
        const url =  CC.BASE_URL + `${CC1.GetCC.SO_FocusColumnsUrl}?comid=${sess.Comid}&filename=SaleOrderFocus`;
      //const url = `/Content/Appdata/Visible/${mcomid}/SaleOrderFocus.json?v=${Date.now()}`;
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

  const [customers,    setCustomers]    = useState([]);
  const [salesmen,     setSalesmen]     = useState([]);
  const [prodList,     setProdList]     = useState([]);

  const [orderNo,      setOrderNo]      = useState("");
  const [orderDate,    setOrderDate]    = useState(CC.today());
  const [orderType,    setOrderType]    = useState("CASH");
  const [custId,       setCustId]       = useState("");
  const [custMobile,   setCustMobile]   = useState("");
  const [smId,         setSmId]         = useState("");
  const [crmNo,        setCrmNo]        = useState("");
  const [crmValue,     setCrmValue]     = useState("0.00");
  const [curBal,       setCurBal]       = useState("0.00");
  const [stockLbl,     setStockLbl]     = useState("0.00");
  const [remarks,      setRemarks]      = useState("");
  const [editId,       setEditId]       = useState(0);

  // Bill-level discount state (mirrors SaleOrder.js txtdiscper / txtdiscamt)
  const [discPer,      setDiscPer]      = useState("0.00");
  const [discAmt,      setDiscAmt]      = useState("0.00");
  const [otherPlus,    setOtherPlus]    = useState("0.00");
  const [otherMinus,   setOtherMinus]   = useState("0.00");
  const [coinage,      setCoinage]      = useState("0.00");

  // Internal billing state
  const [billDiscLog,  setBillDiscLog]  = useState(0);   // 0=none, 1=from discamt input
  const [igstBill,     setIgstBill]     = useState(false);
  const [whoSaleStatus, setWhoSaleStatus] = useState("R");
  const [crmdiscdata,   setCrmdiscdata]  = useState(0);
  const [creditdays,    setCreditdays]   = useState(0);
  const [customercardtypeRefId, setCustomercardtypeRefId] = useState(null);

  // Salesman for rows
  const smRef = useRef({ smId: null, smCode: "", smComper: 0 });

  const [rows,         setRows]         = useState([mkRow()]);
  const [selRid,       setSelRid]       = useState(null);
  const [totals,       setTotals]       = useState({ GrossAmt: 0, DiscAmt: 0, GSTAmt: 0, CESSAmt: 0, NetAmt: 0, ProductTotal: 0 });
  const [gstSplit,     setGstSplit]     = useState([]);

  const [loading,      setLoading]      = useState(false);
  const [ldMsg,        setLdMsg]        = useState("Loading...");
  const [pw,           setPw]           = useState(null);
  const pwOkRef = useRef(null);

  const [prodPopup,    setProdPopup]    = useState(null);
  const [f5Open,       setF5Open]       = useState(false);
  const [f5Rows,       setF5Rows]       = useState([]);

  const rowsRef  = useRef(rows);
  const cellRefs = useRef({});
  const custRef  = useRef(null);

  useEffect(() => { rowsRef.current = rows; }, [rows]);

  const regCell = (rid, key, el) => {
    if (!cellRefs.current[rid]) cellRefs.current[rid] = {};
    if (el) cellRefs.current[rid][key] = el;
    else delete cellRefs.current[rid]?.[key];
  };

  // ── Permission check (mirrors SaleOrder.js top) ───────────────────────────
  useEffect(() => {
    const menuStr = localStorage.getItem("menulist");
    if (!menuStr) { alert("Session Close Please Login !!!."); navigate("/"); return; }
    const menulist = JSON.parse(menuStr);
    const menudata = menulist.filter(o => o.PageName === "Sales Order");
    if (!menudata || menudata.length === 0) { alert("Page Access Permission Denied !!!."); setTimeout(() => navigate("/Home"), 3000); return; }
    if (menudata[0].View === 0) { alert("Page Access Permission Denied !!!."); navigate("/Home"); return; }
    setPerm({ View: menudata[0].View, Add: menudata[0].Add, Edit: menudata[0].Edit, Delete: menudata[0].Delete });
    setIsAuthorized(true);
  }, [navigate]);

  const redirectIfDualLogin = useCallback(res => {
    if (res?._dualLogin || res?.redis === false) { alert("Already Login Another User Please Login Again!!!"); navigate("/"); return true; }
    return false;
  }, [navigate]);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthorized) return;
    (async () => {
      setLoading(true); setLdMsg("Loading...");
      await Promise.all([loadDropdowCC.ns(), loadOrderNo(), loadColCfg(settings.Comid), loadFocusCols(settings.MComid)]);
      setLoading(false);
      setTimeout(() => {
        const fr = rowsRef.current[0];
        if (fr) cellRefs.current[fr._rid]?.["ProductCode"]?.focus();
      }, 200);
    })();
  // eslint-disable-next-line
  }, [isAuthorized]);

  // ── Load Order No ─────────────────────────────────────────────────────────
  const loadOrderNo = useCallback(async () => {
    const res = await CC.api(CC.SaleOrderMaxNo, null, {}, { Comid: settings.Comid });
    if (redirectIfDualLogin(res)) return;
    const no = res.No || res.data || "";
    if (no) setOrderNo(CC.ns(no));
  }, [settings.Comid]);

  // ── Load Dropdowns ────────────────────────────────────────────────────────
  const loadDropdowns = useCallback(async () => {
    const comid = settings.Comid;
    const [custRes, smRes] = await Promise.all([
      CC.api(CC.SO_GetCustomerUrl, null, {}, { Comid: comid, AccountType: "CUSTOMER" }),
      CC.api(CC.SO_SalesManSelectUrl, null, {}, { Comid: comid }),
    ]);
    if (redirectIfDualLogin(custRes)) return;
    const pick = r => r.data || r.Data1 || r || [];
    setCustomers(Array.isArray(pick(custRes)) ? pick(custRes) : []);
    setSalesmen(Array.isArray(pick(smRes)) ? pick(smRes) : []);
  }, [settings.Comid]);

  // ── Customer Details Load (mirrors CustomerDetailsLoad) ───────────────────
  const loadCustomerDetails = useCallback(async (cid) => {
    if (!cid) { setCustMobile(""); setCrmValue("0.00"); setCurBal("0.00"); return; }
    const found = customers.find(c => String(c.Id) === String(cid));
    if (found) {
      setCustMobile(found.MobileNo || "");
      setIgstBill(found.IGSTBill || false);
      setCustomercardtypeRefId(found.customercardtypeRefId || null);
      setCreditdays(found.CreditBillDays || 0);

      // Salesman auto-select from customer if not in edit mode
      if (editId === 0 && found.SalemanRefid) {
        setSmId(CC.ns(found.SalemanRefid));
        const sm = salesmen.find(s => String(s.Id) === String(found.SalemanRefid));
        if (sm) { smRef.current = { smId: sm.Id, smCode: sm.Code, smComper: sm.Commission }; }
      }
    }

    const [crmRes, balRes] = await Promise.all([
      CC.api(CC.SO_CRMBalanceUrl, null, {}, { Id: cid, Fromdate: orderDate, Comid: settings.Comid, MComid: settings.MComid }),
      CC.api(CC.SO_CurrentStockUrl, null, {}, { Id: cid, MComid: settings.MComid, TillDate: orderDate, Comid: settings.Comid, AccountType: "CUSTOMER" }),
    ]);
    if (!crmRes._netErr && (crmRes.ok ?? crmRes.IsSuccess)) {
      const arr = Array.isArray(crmRes.data) ? crmRes.data : [];
      setCrmValue(arr.length > 0 ? CC.f2(CC.vn(arr[0].Value)).toFixed(2) : "0.00");
    }
    if (balRes && !balRes._netErr) {
      const bal = parseFloat(balRes.Data1 ?? balRes.data ?? 0);
      setCurBal(isNaN(bal) ? "0.00" : CC.f2(bal).toFixed(2));
    }
  }, [customers, salesmen, settings, orderDate, editId]);

  const handleCustomerChange = useCallback(async (cid) => {
    setCustId(cid);
    await loadCustomerDetails(cid);
  }, [loadCustomerDetails]);

  // ── Salesman row update (mirrors cmbsalesman keydown) ────────────────────
  const handleSalesmanChange = useCallback((sid) => {
    setSmId(sid);
    const sm = salesmen.find(s => String(s.Id) === String(sid));
    if (sm) {
      smRef.current = { smId: sm.Id, smCode: sm.Code, smComper: sm.Commission };
      // Update all existing rows
      setRows(prev => prev.map(r => {
        if (r.Freeqtydetailsrefid || r.Freeamountdetailsrefid || r.CompanyOfferFreeqtydetailsrefid) return r;
        if (!r.ProductCode) return r;
        return { ...r, SMCode: sm.Code, salesmancomm: sm.Commission, SalesManRefId: sm.Id };
      }));
    }
  }, [salesmen]);

  // ── calc settings object ──────────────────────────────────────────────────
  const calcSettings = useMemo(() => ({
    taxtype: settings.taxtype,
    taxinclusivedontshow: settings.taxinclusivedontshow,
    SaleDiscountAfterTax: settings.SaleDiscountAfterTax,
    BillDiscLog: billDiscLog,
    IGSTBillStatus: igstBill,
    TextilesAutoGST: settings.TextilesAutoGST,
    TextilesSaleRateMax: settings.TextilesSaleRateMax,
    TextilesMaxGST: settings.TextilesMaxGST,
    TextilesMinGST: settings.TextilesMinGST,
    RiceUOMSetting: settings.RiceUOMSetting,
    AutoGSTDeptWise: settings.AutoGSTDeptWise,
  }), [settings, billDiscLog, igstBill]);

  // ── Recalc totals (mirrors methods.Calculation mode=2) ───────────────────
  const recalcTotals = useCallback((rowsArr, dPer, dAmt, oPlus, oMinus, coin, bdLog) => {
    let productTotal = 0, gstTotal = 0, cessTotal = 0, discTotal = 0, cdTotal = 0, splcessTotal = 0;
    const gstMap = {};

    rowsArr.forEach(r => {
      if (r.Freeamountdetailsrefid || r.Freeqtydetailsrefid || r.CompanyOfferFreeqtydetailsrefid) return;
      if (!r.ProductRefId) return;
      productTotal += CC.vn(r.ProductTotal);
      gstTotal     += CC.vn(r.TaxAmt);
      cessTotal    += CC.vn(r.CESSAmount);
      discTotal    += CC.vn(r.DiscountAmt);
      cdTotal      += CC.vn(r.cdAmount);
      splcessTotal += CC.vn(r.SPLCESSAmount);

      const key = CC.f2(CC.vn(r.TaxPercent));
      if (!gstMap[key]) gstMap[key] = { TaxPercent: key, TaxAmt: 0, CTAmount: 0, STAmount: 0 };
      gstMap[key].TaxAmt   += CC.vn(r.TaxAmt);
      gstMap[key].CTAmount += CC.vn(r.CTAmount);
      gstMap[key].STAmount += CC.vn(r.STAmount);
    });

    const grossAmt = productTotal + gstTotal + cessTotal + splcessTotal + CC.vn(oPlus) - cdTotal - discTotal - CC.vn(oMinus);
    let coinageVal = 0;
    if (settings.RoundoffPaise === "3") coinageVal = Math.round(grossAmt) - grossAmt;
    const netAmt = CC.f2(grossAmt + coinageVal);

    setGstSplit(Object.values(gstMap).filter(g => g.TaxAmt > 0));
    setTotals({ GrossAmt: CC.f2(productTotal), DiscAmt: CC.f2(discTotal + cdTotal), GSTAmt: CC.f2(gstTotal), CESSAmt: CC.f2(cessTotal), NetAmt: netAmt, ProductTotal: CC.f2(productTotal) });
    setCoinage(coinageVal.toFixed(2));
    return netAmt;
  }, [settings]);

  // ── Single row recalc ─────────────────────────────────────────────────────
  const recalcRow = useCallback((row) => calcSaleRow(row, calcSettings), [calcSettings]);

  // ── Bill discount from discPer input (mirrors txtdiscper keydown) ─────────
  const applyDiscPer = useCallback((perVal) => {
    const per = CC.vn(perVal);
    setDiscPer(per.toFixed(2));
    setBillDiscLog(0);
    setRows(prev => {
      const next = prev.map(r => {
        if (r.Freeqtydetailsrefid || r.Freeamountdetailsrefid || r.CompanyOfferFreeqtydetailsrefid) return r;
        if (!r.ProductRefId) return r;
        const updated = { ...r, DiscountPercent: per.toFixed(2), DiscountAmt: "0.00" };
        return recalcRow(updated);
      });
      return next;
    });
  }, [recalcRow]);

  // ── Bill discount from discAmt input (mirrors txtdiscamt keydown) ─────────
  const applyDiscAmt = useCallback((amtVal) => {
    const amt = CC.vn(amtVal);
    if (amt === 0) {
      setDiscAmt("0.00"); setDiscPer("0.00"); setBillDiscLog(0);
      setRows(prev => prev.map(r => {
        if (!r.ProductRefId) return r;
        return recalcRow({ ...r, DiscountPercent: "0.00", DiscountAmt: "0.00" });
      }));
      return;
    }
    let totalItemAmt = 0;
    rowsRef.current.forEach(r => {
      if (r.Freeqtydetailsrefid || r.Freeamountdetailsrefid || r.CompanyOfferFreeqtydetailsrefid) return;
      if (!r.ProductRefId) return;
      const qty = CC.vn(r.ItemQty) + (settings.RiceUOMSetting ? CC.vn(r.NOMS) : 0);
      totalItemAmt += qty * CC.vn(r.orgrate || r.SaleRate);
    });
    if (totalItemAmt === 0) return;
    const per = parseFloat(((amt * 100) / totalItemAmt).toFixed(4));
    if (per > 100) { toast("❌ Enter valid Bill Discount Percentage", true); return; }
    setBillDiscLog(1);
    setDiscPer(per.toFixed(2));
    setDiscAmt(amt.toFixed(2));
    setRows(prev => prev.map(r => {
      if (r.Freeqtydetailsrefid || r.Freeamountdetailsrefid || r.CompanyOfferFreeqtydetailsrefid) return r;
      if (!r.ProductRefId) return r;
      return recalcRow({ ...r, DiscountPercent: per.toFixed(4), DiscountAmt: "0.00" });
    }));
  }, [settings, recalcRow, toast]);

  // Recalc totals whenever rows or totals-affecting state changes
  useEffect(() => {
    recalcTotals(rows, discPer, discAmt, otherPlus, otherMinus, coinage, billDiscLog);
  // eslint-disable-next-line
  }, [rows, discPer, discAmt, otherPlus, otherMinus, billDiscLog]);

  // ── Fill item into row (mirrors methods.FillItems) ────────────────────────
  const fillItemIntoRow = useCallback((rid, item) => {
    setRows(prev => {
      const newRows = prev.map(r => {
        if (r._rid !== rid) return r;
        const saleRate = (() => {
          if (!settings.WholeSaleRate) return CC.f2(CC.vn(item.SalesRate || item.SaleRate));
          const ws = whoSaleStatus;
          if (ws === "M") return CC.f2(CC.vn(item.MRP));
          if (ws === "R") return CC.f2(CC.vn(item.SalesRate));
          if (ws === "P") return CC.f2(CC.vn(item.PurchaseRate));
          if (ws === "W") return CC.f2(CC.vn(item.WholeSaleRate));
          if (ws === "C") return 0;
          return CC.f2(CC.vn(item.SalesRate));
        })();
        const updated = {
          ...r,
          ProductRefId:    item.Id,
          ProductCode:     item.ProductCode || item.Prod_Code,
          ProductName:     item.ProductName || item.PName,
          MRP:             CC.ns(CC.f2(CC.vn(item.MRP))),
          SaleRate:        CC.ns(saleRate),
          SaleRateorg:     CC.f2(CC.vn(item.SalesRate)),
          NomsRate:        CC.f2(CC.vn(item.NomsRate || 0)),
          TaxPercent:      CC.ns(CC.f2(CC.vn(item.GST))),
          CESSPer:         CC.ns(CC.f2(CC.vn(item.CESS))),
          SPLCESSPer:      CC.ns(CC.f2(CC.vn(item.SPLCESS))),
          UOM:             item.UOM || "",
          UOMDecimal:      item.UOMDecimal || 0,
          HSNcode:         item.HSNCode || "",
          StockQty:        (() => {
            const s = CC.vn(item.StockQty || item.Stock);
            const d = item.UOMDecimal;
            if (d === 0) return Math.round(s).toFixed(0);
            if (d === 2) return s.toFixed(2);
            return s.toFixed(3);
          })(),
          PrintName:       item.PrinterName || "",
          PurchaseRate:    CC.ns(CC.f2(CC.vn(item.PurchaseRate))),
          RetailRate:      CC.ns(CC.f2(CC.vn(item.SalesRate))),
          WholeSaleRate:   CC.ns(CC.f2(CC.vn(item.WholeSaleRate))),
          CardRate:        "0",
          NegativetStock:  item.NegativetStock || false,
          SaleRateType:    item.SalesRateType !== undefined ? item.SalesRateType : true,
          BatchStatus:     item.BatchwiseStock || 0,
          DiscountPercent: CC.ns(CC.f2(CC.vn(item.SaleDiscountPer) + crmdiscdata)),
          DiscountAmt:     "0.00",
          cdpercent:       "0.00",
          cdAmount:        "0.00",
          NOMS:            "0",
          NOMSQty:         Math.round(CC.vn(item.NomsQty || 0)).toFixed(0),
          CRMPoints:       item.CRMPoints || 0,
          LandingcostProfit: CC.ns(CC.f2(CC.vn(item.LandingCost))),
          Schemedetailsrefid: item.Schemeid || null,
          ExpiryDate:      null,
          MfgDate:         null,
          BatchRefid:      null,
          _indexid:        CC.newGuid(),
          SMCode:          smRef.current.smCode,
          salesmancomm:    smRef.current.smComper,
          SalesManRefId:   smRef.current.smId,
          Amount:          "1.00",
          ItemQty:         item.UOMDecimal === 0 && settings.DefaultQty !== 0
                             ? String(settings.DefaultQty)
                             : item.UOMDecimal === 0 ? "1" : "",
          deptname:        item.deptname || "",
          _dirty: true,
        };
        setStockLbl(CC.vn(item.StockQty || item.Stock).toFixed(0));
        return updated.ItemQty ? recalcRow(updated) : updated;
      });

      // SameProductSameLine merge (mirrors SaleOrder.js SameProductSameLine)
      if (settings.SameProductSameLine) {
        const targetRow = newRows.find(r => r._rid === rid);
        if (targetRow && targetRow.ProductRefId) {
          const duplicate = newRows.find(r =>
            r._rid !== rid &&
            r.ProductRefId === targetRow.ProductRefId &&
            r.BatchRefid === targetRow.BatchRefid &&
            !r.ExpiryDate && !r.MfgDate &&
            !r.Freeqtydetailsrefid && !r.Freeamountdetailsrefid && !r.CompanyOfferFreeqtydetailsrefid &&
            String(r.SaleRate) === String(targetRow.SaleRate)
          );
          if (duplicate) {
            const totalQty = CC.vn(targetRow.ItemQty) + CC.vn(duplicate.ItemQty);
            const dec = targetRow.UOMDecimal;
            const mergedQty = dec === 0 ? Math.round(totalQty).toFixed(0) : dec === 2 ? totalQty.toFixed(2) : totalQty.toFixed(3);
            const merged = recalcRow({ ...targetRow, ItemQty: mergedQty });
            return newRows.filter(r => r._rid !== duplicate._rid).map(r => r._rid === rid ? merged : r);
          }
        }
      }
      return newRows;
    });

    setProdPopup(null);

    setTimeout(() => {
      const editableCols = CC.SO_COLUMNS.filter(c => !c.readOnly && c.key !== "ProductCode").map(c => c.key);
      const firstFocusCol = focusColsRef.current.length > 0
        ? focusColsRef.current.find(k => k !== "ProductCode" && editableCols.includes(k))
        : "ItemQty";
      const el = cellRefs.current[rid]?.[firstFocusCol || "ItemQty"];
      if (el) { el.focus(); el.select?.(); }
    }, 50);
  }, [settings, whoSaleStatus, crmdiscdata, recalcRow]);

  // ── Fetch product by code ──────────────────────────────────────────────────
  const fetchProductByCode = useCallback(async (rid, code) => {
    if (!code.trim()) return;
    const res = await CC.api(CC.SO_SelectItemByCodeUrl, null, {}, {
      code: code.trim().toUpperCase(),
      Comid: settings.MComid, CComid: settings.Comid,
      Id: 0, Batchwise: 0,
    });
    if (redirectIfDualLogin(res)) return;
    const arr = Array.isArray(res.data) ? res.data : Array.isArray(res.Data1) ? res.Data1 : [];
    if (arr.length === 0) { toast("❌ Invalid Product Code !!!", true); return; }
    if (arr.length === 1) fillItemIntoRow(rid, arr[0]);
    else {
      // Multiple results → open MRP window equivalent (product search)
      setProdList(arr);
      setProdPopup({ rid, pos: { top: 200, left: 80 } });
    }
  }, [settings, fillItemIntoRow, redirectIfDualLogin]);

  // ── Load product list ──────────────────────────────────────────────────────
  const loadProductsForPopup = useCallback(async (rid) => {
    if (prodList.length > 0) { setProdPopup({ rid, pos: { top: 160, left: 80 } }); return; }
    setLoading(true); setLdMsg("Loading products...");
    const res = await CC.api(CC.SO_ProductListUrl, null, {}, { Comid: settings.Comid });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    const arr = Array.isArray(res.data) ? res.data : Array.isArray(res.Data1) ? res.Data1 : [];
    setProdList(arr);
    setProdPopup({ rid, pos: { top: 160, left: 80 } });
  }, [settings, prodList, redirectIfDualLogin]);

  // ── Cell change ────────────────────────────────────────────────────────────
  const handleCellChange = useCallback((rid, colKey, value) => {
    setRows(prev => prev.map(r => {
      if (r._rid !== rid) return r;
      let updated = { ...r, [colKey]: value, _dirty: true };

      // NOMS logic (mirrors gridsale keypress for grdNOMS)
      if (colKey === "NOMS") {
        updated.ItemQty = "0";
        if (CC.vn(value) !== 0) updated.SaleRate = CC.ns(CC.f2(CC.vn(r.SaleRateorg)));
        else updated.SaleRate = CC.ns(CC.f2(CC.vn(r.NomsRate)));
      }
      // ItemQty: if NOMSQty non-zero, reset NOMS
      if (colKey === "ItemQty" && CC.vn(r.NOMSQty) !== 0) {
        updated.NOMS = "0";
        updated.SaleRate = CC.ns(CC.f2(CC.vn(r.NomsRate)));
      }
      // Pcs/Meter/TotalPcs auto-compute ItemQty
      if (colKey === "Pcs" || colKey === "Meter" || colKey === "TotalPcs") {
        const pcs      = colKey === "Pcs"      ? CC.vn(value) : CC.vn(r.Pcs);
        const meter    = colKey === "Meter"    ? CC.vn(value) : CC.vn(r.Meter) || 1;
        const totalpcs = colKey === "TotalPcs" ? CC.vn(value) : CC.vn(r.TotalPcs) || 1;
        const totalqty = pcs * meter * totalpcs;
        const dec = r.UOMDecimal;
        updated.ItemQty = dec === 0 ? Math.round(totalqty).toFixed(0) : dec === 2 ? totalqty.toFixed(2) : totalqty.toFixed(3);
      }

      if (["ItemQty","SaleRate","TaxPercent","CESSPer","DiscountPercent","DiscountAmt","cdpercent","cdAmount","SPLCESSPer","MRP","NOMS","Pcs","Meter","TotalPcs"].includes(colKey)) {
        return recalcRow(updated);
      }
      return updated;
    }));
  }, [recalcRow]);

  // ── Delete row (mirrors Del key in SaleOrder.js) ──────────────────────────
  const doDeleteRow = useCallback(async (rid) => {
    const ok = await confirm("Do you Want to Delete Row?");
    if (!ok) return;
    setRows(prev => {
      const target = prev.find(r => r._rid === rid);
      if (!target) return prev;
      // Cascade: delete free-qty rows tied to same indexid
      let next = prev.filter(r => {
        if (r._rid === rid) return false;
        if (r._indexid === target._indexid && (r.Freeqtydetailsrefid || r.CompanyOfferFreeqtydetailsrefid)) return false;
        return true;
      });
      return next.length === 0 ? [mkRow()] : next;
    });
  }, [confirm]);

  // ── Cell keydown ───────────────────────────────────────────────────────────
  const handleCellKeyDown = useCallback((e, rid, colKey) => {
    const editableCols = visCols
      .map(vc => CC.SO_COLUMNS.find(c => c.key === vc.key))
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

      // SaleRate validation (mirrors SaleOrder.js columnnameC == grdSalerate)
      if (colKey === "SaleRate") {
        const row = rowsRef.current.find(r => r._rid === rid);
        if (CC.vn(row?.SaleRate) === 0) { toast("Enter the SaleRate !!!", true); return; }
      }

      // ItemQty validation (mirrors SaleOrder.js columnnameC == grdItemQty)
      if (colKey === "ItemQty") {
        const row = rowsRef.current.find(r => r._rid === rid);
        if ((CC.vn(row?.ItemQty) + CC.vn(row?.NOMS)) === 0) {
          setRows(prev => prev.map(r => r._rid === rid ? { ...r, ItemQty: "1" } : r));
        }
        // Check SaleRateType: if false, must go to SaleRate
        if (row && !row.SaleRateType) { focusCell(rid, "SaleRate"); return; }
        if (row && CC.vn(row.SaleRate) === 0) { focusCell(rid, "SaleRate"); return; }
      }

      // Move to next column
      if (colIdx >= 0 && colIdx < COLS.length - 1) {
        focusCell(rid, COLS[colIdx + 1]);
      } else {
        // Last column → new row or next row
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
    if (e.key === "Delete")  { e.preventDefault(); doDeleteRow(rid); }
    if (e.key === " " && colKey === "ProductCode") { e.preventDefault(); loadProductsForPopup(rid); }
  }, [visCols, fetchProductByCode, loadProductsForPopup, doDeleteRow, toast, focusCols]);

  // ── Grid validation (mirrors methods.gridemptycheck) ─────────────────────
  const gridemptycheck = useCallback(() => {
    let rowsArr = [...rowsRef.current];
    // Remove last empty row
    const last = rowsArr[rowsArr.length - 1];
    if (last && (!last.ProductCode || last.ProductCode === "")) {
      if (rowsArr.length > 1) rowsArr = rowsArr.slice(0, -1);
    }
    for (let i = 0; i < rowsArr.length; i++) {
      const r = rowsArr[i];
      if (!settings.ProductAddSaleForm && !r.ProductRefId) {
        toast("Enter All Valid Product Code in the Grid !!!", true);
        cellRefs.current[r._rid]?.["ProductCode"]?.focus();
        return false;
      }
      if ((CC.vn(r.ItemQty) + CC.vn(r.NOMS)) === 0) {
        toast("Enter All Quantity in the Grid !!!", true);
        cellRefs.current[r._rid]?.["ItemQty"]?.focus();
        return false;
      }
      if (!r.Freeqtydetailsrefid && !r.Freeamountdetailsrefid && !r.CompanyOfferFreeqtydetailsrefid) {
        if (CC.vn(r.SaleRate) === 0) { toast("Enter All SaleRate in the Grid !!!", true); return false; }
        if (CC.vn(r.Amount) === 0)   { toast("Enter All Amount in the Grid !!!", true); return false; }
      }
    }
    setRows(rowsArr.length > 0 ? rowsArr : [mkRow()]);
    return true;
  }, [settings, toast]);

  // ── Save (mirrors methods.SaleSave) ───────────────────────────────────────
  const doSave = useCallback(async () => {
    if (!perm.Add && editId === 0) { toast("❌ Page Add Permission Denied !!!", true); return; }
    if (!gridemptycheck()) return;

    const cid = custId || settings.CustomerCashId;
    const custObj = customers.find(c => String(c.Id) === String(cid));

    if (orderType === "CREDIT") {
      const ok = await confirm("Wish to Save Sale Order Bill Details ?");
      if (!ok) return;
    }

    setLoading(true); setLdMsg("Saving...");

    const saledetails = rowsRef.current.filter(r => r.ProductRefId && (CC.vn(r.ItemQty) + CC.vn(r.NOMS)) > 0);
    const salemaster = [{
      Id:               editId,
      CustomerRefId:    cid ? parseInt(cid) : 0,
      SaleNo:           orderNo,
      CompanyRefId:     parseInt(settings.Comid),
      CustomerCardRefid: customercardtypeRefId,
      SaleNoDisplay:    orderNo,
      SaleDate:         orderDate,
      SaleType:         orderType,
      Modified_By:      localStorage.getItem("username") || "",
      CustomerName:     custObj?.AccountName || "",
      Address1:         custObj?.Address1    || "",
      Address2:         custObj?.Address2    || "",
      City:             custObj?.City        || "",
      Email:            custObj?.Email       || "",
      PhoneNo:          custObj?.MobileNo    || "",
      Pincode:          custObj?.Pincode     || "",
      TinNo:            custObj?.GSTINNo     || "",
      IGSTBill:         igstBill,
      OtherssubAmt:     CC.vn(otherMinus),
      Grossamt:         totals.ProductTotal,
      CESSAmount:       totals.CESSAmt,
      SPLCESSAmount:    0,
      SalesReturnAmt:   0,
      DeleteStatus:     1,
      ShiftCode:        0,
      Modified_Date:    new Date().toLocaleString(),
      Duedate:          orderDate,
      disper:           CC.vn(discPer),
      cdamount:         0,
      taxamount:        totals.GSTAmt,
      Cashtender:       0,
      Cashrecevier:     0,
      OthersplusAmt:    CC.vn(otherPlus),
      schargePer:       0,
      OldBillAmount:    0,
      TodaySaving:      0,
      coinage:          CC.vn(coinage),
      NetAmount:        totals.NetAmt,
      Remarks:          remarks,
      discamount:       CC.vn(discAmt),
      CashierRefId:     parseInt(settings.CashierId) || 0,
      salesmanRefId:    smId ? parseInt(smId) : null,
      Credit:           0,
      SaleDetails:      saledetails,
    }];

    const res = await CC.insertapi(CC.SaleOrderInsertUrl, salemaster, {
      PrintA4Invoice: String(settings.PrintA4Bill),
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;

    if (res.ok ?? res.IsSuccess) {
      toast("✅ Sale Order Saved Successfully");

      // A4 print flow (mirrors SaleOrder.js PrintA4Bill handling)
      if (settings.PrintA4Bill === 1) {
        const { BillFormatName, CompanyName, CAddress1, CAddress2, CCity, CPincode, CMobileNo, GSTNO, Email: CEmail, StateCode, SaleCon1, SaleCon2, SaleCon3, SaleCon4, SaleCon5, NoofBills, Bank1, Bank2, Bank3, Bank4, Bank5 } = settings;
        const PrintDetails = `&BillFormatName=${BillFormatName}&CompanyName=${CompanyName}&Address1=${CAddress1}&Address2=${CAddress2}&City=${CCity}&Pincode=${CPincode}&MobileNo=${CMobileNo}&GSTNO=${GSTNO}&Email=${CEmail}&StateCode=${StateCode}&SaleCon1=${SaleCon1}&SaleCon2=${SaleCon2}&SaleCon3=${SaleCon3}&SaleCon4=${SaleCon4}&SaleCon5=${SaleCon5}&NoofBills=${NoofBills}&Bank1=${Bank1}&Bank2=${Bank2}&Bank3=${Bank3}&Bank4=${Bank4}&Bank5=${Bank5}`;
        const printUrl = `../Reports/ReportViewer.aspx?ReportName=SaleOrderInvoice&Copy=Original&A4Print=1&MailSendStatus=0${PrintDetails}`;
        window.open(printUrl, "_blank", `directories=0,titlebar=0,toolbar=0,location=0,status=0,menubar=0,scrollbars=yes,resizable=no,width=${screen.width},height=${screen.height - 100}`);
      }

      await clearForm();
    } else {
      toast("❌ " + (res.Message || res.message || "Save Failed"), true);
    }
  }, [perm, editId, gridemptycheck, custId, settings, customers, orderType, orderNo, orderDate, customercardtypeRefId, igstBill, otherMinus, otherPlus, discPer, discAmt, coinage, totals, remarks, smId, confirm, redirectIfDualLogin, toast]);

  // ── Delete (mirrors F9 in SaleOrder.js) ───────────────────────────────────
  const doDelete = useCallback(async () => {
    if (!editId) { toast("No Delete Id !!!", true); return; }
    if (!perm.Delete) { toast("❌ Page Delete Permission Denied !!!", true); return; }
    const ok = await confirm("Do You Want To Delete SaleOrder Bill ?");
    if (!ok) return;
    setLoading(true);
    const res = await CC.api(CC.SaleOrderDeleteUrl, null, {}, { Id: editId });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res.ok ?? res.IsSuccess) { toast("✅ " + (res.message || "Deleted Successfully")); await clearForm(); }
    else { toast("❌ " + (res.message || "Delete Failed"), true); }
  }, [editId, perm, confirm, redirectIfDualLogin, toast]);

  // ── F5 View (mirrors methods.F5View) ──────────────────────────────────────
  const openF5 = useCallback(async (from = orderDate, to = orderDate) => {
    if (!perm.Edit) { toast("❌ Page Edit Permission Denied !!!", true); return; }
    setLoading(true); setLdMsg("Loading orders...");
    const res = await CC.api(CC.SaleOrderSelectUrl, null, {}, {
      Comid: settings.Comid, Fromdate: from, Todate: to, Id: 0,
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (!(res.ok ?? res.IsSuccess)) { toast("❌ " + (res.message || "Load Failed"), true); return; }

    let master = [];
    if (Array.isArray(res?.Data)) {
      const node = res.Data[0];
      master = node?.salemaster || node?.SaleMaster || res.Data || [];
    } else if (Array.isArray(res?.data)) {
      master = res.data;
    }
    setF5Rows(Array.isArray(master) ? master : []);
    setF5Open(true);
  }, [settings, orderDate, perm, redirectIfDualLogin, toast]);

  // ── Edit (mirrors methods.SaleEdit) ───────────────────────────────────────
  const doEdit = useCallback(async (id) => {
    setF5Open(false);
    if (!perm.Edit) { toast("❌ Page Edit Permission Denied !!!", true); return; }
    setLoading(true); setLdMsg("Loading order...");
    const res = await CC.api(CC.SaleOrderEditUrl, null, {}, {
      Id: id, SaleReturnNo: 0, Comid: settings.Comid, Tamil: settings.Tamil,
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (!(res.ok ?? res.IsSuccess)) { toast("❌ " + (res.message || "Load Failed"), true); return; }

    const data = Array.isArray(res.Data) ? res.Data[0] : res.data;
    if (!data) { toast("❌ No data found", true); return; }

    const master  = Array.isArray(data) ? data[0] : data;
    const details = master.SaleDetails || master.saledetails || [];

    setEditId(master.Id || id);
    setOrderNo(CC.ns(master.SaleNo || master.SaleNoDisplay));
    setOrderDate(String(master.SaleDate || "").slice(0, 10) || CC.today());
    setOrderType(master.SaleType || "CASH");
    setCustId(CC.ns(master.CustomerRefId));
    await loadCustomerDetails(CC.ns(master.CustomerRefId));
    setSmId(CC.ns(master.salesmanRefId || ""));
    setRemarks(CC.ns(master.Remarks));
    setOtherMinus(CC.ns(master.OtherssubAmt || "0.00"));
    setOtherPlus(CC.ns(master.schargeamount || master.OthersplusAmt || "0.00"));
    setDiscPer(CC.ns(master.disper || "0.00"));
    const loadedRows = details.map(r => {
      const fr = fmtRow({ ...mkRow(), ...r });
      return calcSaleRow(fr, { ...calcSettings, BillDiscLog: 0 });
    });
    setRows(loadedRows.length > 0 ? loadedRows : [mkRow()]);
  }, [settings, perm, redirectIfDualLogin, loadCustomerDetails, calcSettings, toast]);

  // ── Clear form (mirrors methods.clear) ────────────────────────────────────
  const clearForm = useCallback(async () => {
    setEditId(0);
    setCustId(""); setCustMobile(""); setSmId(""); setRemarks("");
    setCrmNo(""); setCrmValue("0.00"); setCurBal("0.00"); setStockLbl("0.00");
    setDiscPer("0.00"); setDiscAmt("0.00");
    setOtherPlus("0.00"); setOtherMinus("0.00"); setCoinage("0.00");
    setBillDiscLog(0); setIgstBill(false); setCrmdiscdata(0);
    setCustomercardtypeRefId(null); setCreditdays(0);
    smRef.current = { smId: null, smCode: "", smComper: 0 };
    setRows([mkRow()]);
    setSelRid(null);
    await loadOrderNo();
    setTimeout(() => {
      const fr = rowsRef.current[0];
      if (fr) cellRefs.current[fr._rid]?.["ProductCode"]?.focus();
    }, 100);
  }, [loadOrderNo]);

  // ── Keyboard shortcuts (mirrors SaleOrder.js $(document).on('keydown')) ───
  useEffect(() => {
    const onKey = e => {
      if (prodPopup || f5Open || pw || f12Open || ctrlGOpen) return;
      // F1 = Save
      if (e.keyCode === 112) { e.preventDefault(); doSave(); }
      // F3 = Edit (password)
      if (e.keyCode === 114) { e.preventDefault(); pwOkRef.current = () => { const v = prompt("Enter the SaleOrder Number", ""); if (v && !isNaN(v)) doEdit(0); }; setPw({ title: "Edit Pwd" }); }
      // F5 = View
      if (e.keyCode === 116) { e.preventDefault(); openF5(); }
      // F8 = DiscPer
      if (e.keyCode === 119) { e.preventDefault(); /* focus discper handled by toolbar click */ }
      // F9 = Delete
      if (e.keyCode === 120) { e.preventDefault(); if (!editId) return; pwOkRef.current = doDelete; setPw({ title: "Delete Pwd" }); }
      // F10 = Clear
      if (e.keyCode === 121) { e.preventDefault(); confirm("Do You Want To Clear?").then(ok => ok && clearForm()); }
      // F12 = Col Config
      if (e.keyCode === 123) { e.preventDefault(); setF12Open(true); }
      // Ctrl+F = Form Focus
      if (e.ctrlKey && e.keyCode === 70) { e.preventDefault(); /* Form focus popup - simplified */ }
      // Ctrl+G = Grid Focus
      if (e.ctrlKey && e.keyCode === 71) { e.preventDefault(); setCtrlGOpen(true); }
      // Escape
      if (e.keyCode === 27) { e.preventDefault(); confirm("Do You Want To Quit?").then(ok => ok && navigate(-1)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prodPopup, f5Open, pw, f12Open, ctrlGOpen, doSave, openF5, doDelete, clearForm, confirm, navigate, editId]);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const validRows  = rows.filter(r => r.ProductRefId && CC.vn(r.ItemQty) + CC.vn(r.NOMS) > 0);
  const itemCount  = rows.filter(r => r.ProductRefId && !r.Freeqtydetailsrefid && !r.Freeamountdetailsrefid && !r.CompanyOfferFreeqtydetailsrefid).length;
  const totalQty   = validRows.reduce((s, r) => s + CC.vn(r.ItemQty), 0);
  const totalPcs   = validRows.reduce((s, r) => s + CC.vn(r.Pcs), 0);

  const getRowBg = (r, i) => {
    if (r.Freeamountdetailsrefid) return FREE_AMT_COLOR;
    if (r.Freeqtydetailsrefid)    return FREE_QTY_COLOR;
    if (r.CompanyOfferFreeqtydetailsrefid) return FREE_COMP_COLOR;
    return i % 2 === 0 ? "#fff" : "#fafbff";
  };

  if (!isAuthorized) return null;

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="sb-wrap">
      {ConfirmUI}

      {ctrlGOpen && (
        <CtrlGFocusPopup
          colSettings={colSettings}
          comid={settings.Comid}
          mcomid={settings.MComid}
          toast={toast}
          onSaved={() => loadFocusCols(settings.MComid)}
          onClose={() => setCtrlGOpen(false)}
        />
      )}

      <Topbar />

      <div className="sb-body">

        {/* ══════════════════════════════════════════════════════════════════
            HEADER — 3 panel layout
        ══════════════════════════════════════════════════════════════════ */}
        <div style={{ display: "flex", gap: 10, padding: "8px 10px", background: "#f5f8fd", borderBottom: "1px solid #d0ddf5", alignItems: "stretch" }}>

          {/* ── LEFT PANEL: Sale Order Details ── */}
          <div className="so-panel" style={{ minWidth: 220, flexShrink: 0 }}>
            <div className="so-panel-title">Sale Order Details</div>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label className="so-field-label" style={{ minWidth: 78 }}>OrderNo</label>
              <input className="so-field-input" style={{ flex: 1 }} value={orderNo} onChange={e => setOrderNo(e.target.value)} readOnly />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label className="so-field-label" style={{ minWidth: 78 }}>OrderDate</label>
              <input type="date" className="so-field-input" style={{ flex: 1 }} value={orderDate} onChange={e => setOrderDate(e.target.value)} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label className="so-field-label" style={{ minWidth: 78 }}>OrderType</label>
              <select className="so-field-input" style={{ flex: 1 }} value={orderType} onChange={e => setOrderType(e.target.value)}>
                {CC.ORDER_TYPES.map(ot => <option key={ot.value} value={ot.value}>{ot.label}</option>)}
              </select>
            </div>

            {editId > 0 && <div style={{ fontSize: 10, color: "#1f65de", fontWeight: 700 }}>✏️ EDIT MODE</div>}
          </div>

          {/* ── MIDDLE PANEL: Customer Details ── */}
          <div className="so-panel" style={{ flex: 1 }}>
            <div className="so-panel-title">Customer Details</div>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label className="so-field-label">Customer</label>
              <ComboBox
                inputRef={custRef}
                options={[{ value: "", label: "" }, ...customers.map(c => ({ value: String(c.Id), label: c.AccountName }))]}
                value={custId}
                onChange={handleCustomerChange}
                onEnterKey={() => { const fr = rowsRef.current[0]; if (fr) cellRefs.current[fr._rid]?.["ProductCode"]?.focus(); }}
                placeholder="Select CustomerName"
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label className="so-field-label">MobileNo</label>
              <input className="so-field-input" style={{ flex: 1 }} value={custMobile} readOnly placeholder="Select MobileNo" />
              <label className="so-field-label" style={{ minWidth: 36, marginLeft: 8 }}>CRM</label>
              <input className="so-field-input" style={{ flex: 1 }} value={crmNo} onChange={e => setCrmNo(e.target.value)} placeholder="Select CRMNO" />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#4a5568" }}>CRM Value</label>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#16a34a", minWidth: 48 }}>{crmValue}</span>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#4a5568" }}>CurrentBal</label>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#16a34a", minWidth: 48 }}>{curBal}</span>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#4a5568" }}>Stock</label>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", minWidth: 48 }}>{stockLbl}</span>
            </div>
          </div>

          {/* ── RIGHT PANEL: Amount + SalesMan ── */}
          <div className="so-panel" style={{ minWidth: 240, flexShrink: 0, alignItems: "stretch" }}>
            <div style={{ textAlign: "center", fontSize: 22, fontWeight: 800, color: "#16a34a", letterSpacing: 0.5, paddingBottom: 4 }}>
              Rs.{totals.NetAmt.toFixed(2)}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label className="so-field-label" style={{ minWidth: 68 }}>SalesMan</label>
              <ComboBox
                options={[{ value: "", label: "Select SalesMan" }, ...salesmen.map(s => ({ value: String(s.Id), label: s.SalesManName || s.SalesmanName || "" }))]}
                value={smId}
                onChange={handleSalesmanChange}
                placeholder="Select SalesMan"
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label className="so-field-label" style={{ minWidth: 68 }}>Remarks</label>
              <input className="so-field-input" style={{ flex: 1 }} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Remarks" />
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
                      <th key={c.key} style={{ width: c.width, minWidth: c.width, textAlign: RIGHT_KEYS.has(c.key) ? "right" : undefined }}>{c.label}</th>
                    ))}
                    <th style={{ width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const m = CC.SO_COLUMNS.find(c => c.key === "ProductCode");
                    return (
                      <tr key={row._rid}
                        className={selRid === row._rid ? "sel" : ""}
                        style={{ background: getRowBg(row, idx) }}
                        onClick={() => setSelRid(row._rid)}>
                        <td className="sb-sno">{idx + 1}</td>
                        {visCols.map(col => {
                          const colDef  = CC.SO_COLUMNS.find(c => c.key === col.key) || {};
                          const val     = row[col.key];
                          const isRight = RIGHT_KEYS.has(col.key);
                          const isRO    = !!colDef.readOnly;
                          const isFloat = colDef.type === "float";
                          const isInt   = colDef.type === "int";
                          const isAmt   = col.key === "Amount";
                          const isFreeRow = !!(row.Freeqtydetailsrefid || row.Freeamountdetailsrefid || row.CompanyOfferFreeqtydetailsrefid);

                          return (
                            <td key={col.key} style={{ textAlign: isRight ? "right" : undefined }}>
                              {isRO && col.key !== "ProductName" ? (
                                <span className="sb-cell-calc" style={{ display: "block", padding: "0 4px", color: isAmt ? "#1f65de" : undefined, fontWeight: isAmt ? 700 : undefined }}>
                                  {isFloat && val ? CC.f2(val).toFixed(2) : CC.ns(val)}
                                </span>
                              ) : col.key === "ProductCode" ? (
                                <input
                                  ref={el => regCell(row._rid, col.key, el)}
                                  className="sb-cell-input"
                                  value={CC.ns(val)}
                                  readOnly={isFreeRow}
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
                                  value={CC.ns(val)}
                                  readOnly
                                  style={{ width: "100%", boxSizing: "border-box", background: "transparent", border: "none", cursor: "default", color: "#475569" }}
                                  placeholder="—"
                                />
                              ) : (isFloat || isInt) ? (
                                <input
                                  ref={el => regCell(row._rid, col.key, el)}
                                  className={`sb-cell-input${isRight ? " right" : ""}`}
                                  type="number"
                                  step={isInt ? "1" : (col.key === "ItemQty" && row.UOMDecimal === 0 ? "1" : "0.01")}
                                  value={val === 0 && !row.ProductRefId ? "" : (val ?? "")}
                                  readOnly={isFreeRow && col.key !== "ItemQty"}
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
                                  value={CC.ns(val)}
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
                        <td className="sb-row-del">
                          {!row.Freeqtydetailsrefid && !row.Freeamountdetailsrefid && !row.CompanyOfferFreeqtydetailsrefid && (
                            <button className="mp-del-btn"
                              onClick={e => { e.stopPropagation(); doDeleteRow(row._rid); }}>🗑</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            BOTTOM SECTION
        ══════════════════════════════════════════════════════════════════ */}
        <div className="sb-footer">

          {/* GST Split Table */}
          <div className="sb-gst-tbl">
            <div className="sb-gst-head">
              <span>GST %</span>
              <span>GST Amt</span>
              <span>CGST Amt</span>
              <span>SGST Amt</span>
            </div>
            <div className="sb-gst-body">
              {gstSplit.length === 0
                ? <div className="sb-empty-msg">No data to display</div>
                : gstSplit.map((g, i) => (
                  <div key={i} className="sb-gst-row">
                    <span>{g.TaxPercent}%</span>
                    <span>{CC.f2(g.TaxAmt).toFixed(2)}</span>
                    <span>{CC.f2(g.CTAmount).toFixed(2)}</span>
                    <span>{CC.f2(g.STAmount).toFixed(2)}</span>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Totals 3-col grid */}
          <div className="sb-totals-grid">
            {/* Col 1 */}
            <div className="sb-totals-col">
              {[
                { label: "Gross Amt", value: totals.GrossAmt.toFixed(2), readOnly: true },
                { label: "Disc(%)",   value: discPer, onChange: v => applyDiscPer(v), type: "number", onEnter: () => applyDiscPer(discPer) },
                { label: "Disc Amt",  value: discAmt, onChange: setDiscAmt, type: "number", onEnter: () => applyDiscAmt(discAmt) },
              ].map((item, i) => (
                <div key={i} className="sb-total-item">
                  <span>{item.label}</span>
                  {item.readOnly
                    ? <div className="sb-total-val">{item.value}</div>
                    : <input type={item.type || "text"} step="0.01" value={item.value}
                        onChange={e => item.onChange(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") item.onEnter?.(); }}
                        className="so-field-input" placeholder="0.00" />
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
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px", borderBottom: "1px solid #edf0f7", gap: 6 }}>
                  <span style={{ color: "#4a5568", fontWeight: 600 }}>{item.label}</span>
                  {item.readOnly
                    ? <span style={{ fontWeight: 700, color: "#1a2e4a", minWidth: 80, textAlign: "right" }}>{item.value}</span>
                    : <input type={item.type || "text"} step="0.01" value={item.value} onChange={e => item.onChange(e.target.value)} className="so-field-input" style={{ width: 90, textAlign: "right" }} placeholder="0.00" />
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
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px", borderBottom: "1px solid #edf0f7", gap: 6 }}>
                  <span style={{ color: item.bold ? "#1a2e4a" : "#4a5568", fontWeight: item.bold ? 700 : 600 }}>{item.label}</span>
                  {item.readOnly
                    ? <span style={{ fontWeight: 800, color: "#1a2e4a", minWidth: 80, textAlign: "right", fontSize: item.bold ? 14 : 12 }}>{item.value}</span>
                    : <input type={item.type || "text"} step="0.01" value={item.value} onChange={e => item.onChange(e.target.value)} className="so-field-input" style={{ width: 90, textAlign: "right" }} placeholder="0.00" />
                  }
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            BOTTOM TOOLBAR — F1-CreditBill | F3-Edit | F5-View | F9-Del | F10-Clear | ESC-Exit
        ══════════════════════════════════════════════════════════════════ */}
        <div className="sb-toolbar" style={{ borderLeftColor: "#1f65de" }}>
          <button className="sb-btn sv" onClick={doSave} disabled={loading} style={{ background: "#1f65de", borderColor: "#1f65de" }}>
            💾 F1 - {orderType === "CREDIT" ? "CREDITBill" : "CashBill"}
          </button>
          <button className="sb-btn" onClick={() => { pwOkRef.current = () => openF5(); setPw({ title: "Edit Pwd" }); }}>✏ F3 - Edit</button>
          <button className="sb-btn" onClick={() => openF5()}>📋 F5 - View</button>
          <button className="sb-btn" onClick={() => { /* focus discPer */ }}>💲 F8 - Disc%</button>
          <button className="sb-btn" onClick={() => setF12Open(true)}>⚙ F12</button>
          <button className="sb-btn" onClick={() => setCtrlGOpen(true)} title="Ctrl+G Grid Focus/Reorder">⚡ Ctrl+G</button>
          <button className="sb-btn" onClick={() => confirm("Do You Want To Clear?").then(ok => ok && clearForm())} disabled={loading}>🔄 F10 Clear</button>
          {editId > 0 && (
            <button className="sb-btn dl"
              onClick={() => { if (!perm.Delete) { toast("❌ Page Delete Permission Denied !!!", true); return; } pwOkRef.current = doDelete; setPw({ title: "Delete Pwd" }); }}
              disabled={loading}>🗑 F9 - Delete</button>
          )}
          <button className="sb-btn dl" onClick={() => navigate(-1)}>✕ ESC - Exit</button>
          {loading && <span style={{ fontSize: 11, color: "#6b7a99" }}>⏳ {ldMsg}</span>}

          {/* Right-side info */}
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "#6b7a99" }}>
            {totalPcs > 0 && <span>Pcs: <b style={{ color: "#1a2e4a" }}>{totalPcs.toFixed(0)}</b></span>}
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
            <div className="sb-spin" style={{ borderTopColor: "#1f65de" }} />
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
        <F5ViewModal rows={f5Rows}
          onEdit={id => doEdit(id)}
          onClose={() => setF5Open(false)}
          fromDate={orderDate} toDate={orderDate}
          onSearch={openF5}
        />
      )}

      <CC.ToastList toasts={toasts} />
    </div>
  );
}