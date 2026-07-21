// ─────────────────────────────────────────────────────────────────────────────
//  SaleBill.jsx  —  React Sale Billing Form
//  FIXED: A4Print API call added before ReportViewer.aspx opens
//         (mirrors JS BillPrint() function exactly)
//  UPDATED: Customer Search Popup + Ctrl+G Column Reorder/Focus Popup
//           + Orange Item Count + Fixed GST Split Layout + Fixed Grid Height
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import "../TransactionStyle/SaleBill.css";
import "../Master/MasterPage.css";
import * as CC from "../components/Common";
import Topbar from "../components/Topbar";

// ─── EXTRACTED GLOBALS FROM Common.jsx ───────────────────────────────────────
// (Aliases removed - using CC.* directly)


const BASE_URL = "http://localhost:64215";



// ─── COMBOBOX ─────────────────────────────────────────────────────────────────
function ComboBox({ options, value, onChange, onEnterKey, placeholder, style, inputRef: extRef }) {
  const [q, setQ]           = useState("");
  const [open, setOpen]     = useState(false);
  const [hilite, setHilite] = useState(0);
  const wrapRef  = useRef(null);
  const inpRef   = useRef(null);
  const listRef  = useRef(null);
  const ref = extRef || inpRef;

  const selectedLabel = options.find(o => String(o.value) === String(value))?.label || "";

  const handleFocus = () => {
    setQ(selectedLabel);
    setOpen(true);
    setHilite(0);
  };

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
        setOpen(false);
        setQ(selectedLabel);
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
      if (open && filtered[hilite]) { selectOption(filtered[hilite]); }
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
        onFocus={handleFocus}
        onChange={e => { setQ(e.target.value.toUpperCase()); setOpen(true); }}
        onKeyDown={handleKeyDown}
        style={{ width: "100%", cursor: "text" }}
      />
      {open && filtered.length > 0 && (
        <div
          ref={listRef}
          style={{
            position: "absolute", top: "100%", left: 0, right: 0,
            background: "#fff", border: "1px solid #c5d8f8",
            borderRadius: 4, zIndex: 9999,
            maxHeight: 220, overflowY: "auto",
            boxShadow: "0 8px 24px rgba(31,101,222,.15)",
          }}
        >
          {filtered.map((opt, idx) => (
            <div
              key={opt.value}
              data-idx={idx}
              onMouseDown={() => selectOption(opt)}
              onMouseEnter={() => setHilite(idx)}
              style={{
                padding: "5px 10px",
                fontSize: 12,
                cursor: "pointer",
                background: idx === hilite ? "#deeafb" : idx % 2 === 0 ? "#fff" : "#fafbff",
                borderLeft: idx === hilite ? "3px solid #1f65de" : "3px solid transparent",
                color: "#1a2e4a",
                fontWeight: idx === hilite ? 600 : 400,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SALE ROW CALCULATION ─────────────────────────────────────────────────────
function calcSaleRow(row) {
  const qty      = CC.vn(row.ItemQty);
  const saleRate = CC.vn(row.SaleRate);
  const gst      = CC.vn(row.TaxPercent);
  const cess     = CC.vn(row.CESSPer);
  const splcess  = CC.vn(row.SPLCESS);
  const discPer  = CC.vn(row.DiscountPercent);
  const cdPer    = CC.vn(row.CDPercent);

  if (qty === 0 || saleRate === 0) {
    return {
      ...row,
      DiscountAmt: 0, CDAmount: 0, TaxAmt: 0, CESSAmount: 0,
      SPLCESSAmount: 0, Amount: 0, LandingCost: 0, CTAmount: 0, STAmount: 0,
    };
  }

  const taxTotal   = gst + cess;
  const withoutTax = taxTotal > 0 ? saleRate / ((taxTotal / 100) + 1) : saleRate;
  const orgRate    = withoutTax * qty;
  const cdAmt      = CC.roVal(orgRate * (cdPer / 100));
  const afterCD    = orgRate - cdAmt;
  const discAmt    = CC.roVal(afterCD * (discPer / 100));
  const landingCost = afterCD - discAmt;
  const ctAmt      = CC.roVal(landingCost * ((gst / 2) / 100));
  const stAmt      = CC.roVal(landingCost * ((gst / 2) / 100));
  const cessAmt    = CC.roVal(landingCost * (cess / 100));
  const gstAmt     = ctAmt + stAmt;
  const splcessAmt = splcess * qty;
  const amount     = CC.f2(landingCost + gstAmt + cessAmt + splcessAmt);
  row.StockQtyNew =qty;

  return {
    ...row,
    WithoutTaxRate: CC.f2(withoutTax),
    OrgRate:        CC.f2(orgRate / qty),
    CDAmount:       CC.f2(cdAmt),
    DiscountAmt:    CC.f2(discAmt),
    LandingCost:    CC.f2(landingCost / qty),
    TaxAmt:         CC.f2(gstAmt),
    CTAmount:       CC.f2(ctAmt),
    STAmount:       CC.f2(stAmt),
    CESSAmount:     CC.f2(cessAmt),
    SPLCESSAmount:  CC.f2(splcessAmt),
    Amount:         amount,
    StockQtyNew:    qty,
  };
}

const exceedsDecimalLimit = (value, decimals) => {
  const str = String(value ?? "");
  const dotIdx = str.indexOf(".");
  if (dotIdx === -1) return false;
  const fracLen = str.length - dotIdx - 1;
  const limit = CC.vn(decimals);
  if (limit === 0) return true;
  return fracLen > limit;
};

const mkRow = () => ({
  _rid: CC.genRid(), _isNew: true, _dirty: false,
  SDId: 0, ProductRefId: 0, ProductCode: "", ProductName: "",
  MRP: 0, SaleRate: 0, ItemQty: "", UOMDecimal: 0,
  TaxPercent: 0, TaxAmt: 0, CESSPer: 0, CESSAmount: 0,
  SPLCESS: 0, SPLCESSAmount: 0, DiscountPercent: 0, DiscountAmt: 0,
  CDPercent: 0, CDAmount: 0, LandingCost: 0, OrgRate: 0,
  CTAmount: 0, STAmount: 0, Amount: 0, UOM: "", HSNCode: "",
  PurchaseRate: 0, StockQty: 0,StockQtyNew:0, BatchRefid: null, NegativetStock: false,
  SalesRateType: true, WithoutTaxRate: 0, FreeQty: 0, Remarks: "",
  PrinterName: "", NStock: 0, SRDetailsId: 0, Bat_No: "",
  ExpDate: "", MfgDate: "",
  CRMPoints: 0, SalesManCode: 0, SalesManComm: 0,
});

const fmtRow = obj => ({
  ...obj,
  _rid: obj._rid || CC.genRid(),
  _isNew: false, _dirty: false,
  MRP:             CC.f2(CC.vn(obj.MRP)),
  SaleRate:        CC.f2(CC.vn(obj.SaleRate)),
  ItemQty:         CC.ns(obj.ItemQty),
  TaxPercent:      CC.f2(CC.vn(obj.TaxPercent)),
  _origSaleRate:   CC.f2(CC.vn(obj.SaleRate)),
  TaxAmt:          CC.f2(CC.vn(obj.TaxAmt)),
  CESSPer:         CC.f2(CC.vn(obj.CESSPer)),
  CESSAmount:      CC.f2(CC.vn(obj.CESSAmount)),
  DiscountPercent: CC.f2(CC.vn(obj.DiscountPercent)),
  DiscountAmt:     CC.f2(CC.vn(obj.DiscountAmt)),
  Amount:          CC.f2(CC.vn(obj.Amount)),
  LandingCost:     CC.f2(CC.vn(obj.Landingcost || obj.LandingCost)),
  SalesManCode:    CC.vn(obj.SalesManCode || obj.SalesmanRefid || 0),
});

// ─── PRINT CHOICE DIALOG ──────────────────────────────────────────────────────
function PrintChoiceDialog({ onPrint, onView, onSkip }) {
  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(10,20,40,.5)",
      display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 99999,
    }}>
      <div style={{
        background: "#fff", borderRadius: 10,
        width: 320, padding: "20px 24px",
        boxShadow: "0 16px 48px rgba(31,101,222,.25)",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1a2e4a", marginBottom: 16 }}>
          🖨 Bill Saved Successfully!
        </div>
        <div style={{ fontSize: 12, color: "#6b7a99", marginBottom: 20 }}>
          What would you like to do?
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button
            onClick={onPrint}
            style={{
              padding: "8px 16px", borderRadius: 5, border: "none",
              background: "#1f65de", color: "#fff", fontWeight: 700,
              fontSize: 13, cursor: "pointer",
            }}>🖨 Print</button>
          <button
            onClick={onView}
            style={{
              padding: "8px 16px", borderRadius: 5,
              border: "1px solid #c5d8f8", background: "#e8f0fe",
              color: "#1f65de", fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}>👁 View</button>
          <button
            onClick={onSkip}
            style={{
              padding: "8px 16px", borderRadius: 5,
              border: "1px solid #d4dbe8", background: "#f8faff",
              color: "#4a5568", fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}>✕ Skip</button>
        </div>
      </div>
    </div>
  );
}

// ─── CUSTOMER SEARCH POPUP ────────────────────────────────────────────────────
function CustomerSearchPopup({ customers, onSelect, onClose }) {
  const [q, setQ]           = useState("");
  const [hilite, setHilite] = useState(0);
  const inputRef = useRef(null);
  const listRef  = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 30); }, []);

  const filtered = customers.filter(c => {
    const name   = String(c.AccountName || "").toLowerCase();
    const mobile = String(c.MobileNo || "").toLowerCase();
    const ql     = q.toLowerCase();
    return name.includes(ql) || mobile.includes(ql);
  }).slice(0, 150);

  useEffect(() => { setHilite(0); }, [q]);
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${hilite}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [hilite]);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(10,20,40,.45)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 8600,
    }}>
      <div style={{
        background: "#fff", borderRadius: 10, width: 580, maxHeight: 480,
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: "0 16px 48px rgba(31,101,222,.22)",
        border: "1px solid #d0ddf5",
      }}>
        <div style={{
          background: "linear-gradient(135deg,#1b3a8f 0%,#1f65de 100%)",
          padding: "10px 14px", display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", flex: 1 }}>
            👤 Customer Search
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,.65)",
            background: "rgba(255,255,255,.15)", borderRadius: 10, padding: "2px 8px",
          }}>{filtered.length} records</span>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,.15)", border: "none", color: "#fff",
            width: 22, height: 22, borderRadius: "50%", cursor: "pointer", fontSize: 11,
          }}>✕</button>
        </div>
        <div style={{
          display: "flex", alignItems: "center", padding: "8px 12px",
          borderBottom: "1px solid #eaecf4", background: "#f8faff", gap: 8,
        }}>
          <span style={{ fontSize: 16, color: "#7895c8" }}>⌕</span>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search by Name or Mobile No..."
            style={{
              flex: 1, border: "none", background: "transparent",
              fontSize: 13, color: "#1a2e4a", outline: "none", fontFamily: "inherit",
            }}
            onKeyDown={e => {
              if (e.key === "ArrowDown")  { e.preventDefault(); setHilite(h => Math.min(h + 1, filtered.length - 1)); }
              if (e.key === "ArrowUp")    { e.preventDefault(); setHilite(h => Math.max(h - 1, 0)); }
              if (e.key === "Enter")      { e.preventDefault(); if (filtered[hilite]) onSelect(filtered[hilite]); }
              if (e.key === "Escape")     { e.preventDefault(); onClose(); }
            }}
          />
        </div>
        <div style={{
          display: "flex", gap: 8, padding: "4px 10px",
          background: "#f0f4fc", borderBottom: "1px solid #dde6f5",
          fontSize: 9.5, fontWeight: 700, color: "#6b7a99",
          letterSpacing: ".4px", textTransform: "uppercase",
        }}>
          <span style={{ width: 180 }}>Customer Name</span>
          <span style={{ width: 120 }}>Mobile No</span>
          <span style={{ flex: 1 }}>Address</span>
          <span style={{ width: 80 }}>GSTIN</span>
        </div>
        <div ref={listRef} style={{ overflowY: "auto", flex: 1 }}>
          {filtered.length === 0
            ? <div style={{ textAlign: "center", color: "#94a3b8", padding: 20, fontSize: 12 }}>
                No customers found
              </div>
            : filtered.map((c, idx) => (
              <div
                key={c.Id}
                data-idx={idx}
                onClick={() => onSelect(c)}
                onMouseEnter={() => setHilite(idx)}
                style={{
                  display: "flex", gap: 8, alignItems: "center",
                  padding: "5px 10px", cursor: "pointer",
                  borderBottom: "1px solid #f3f5fb",
                  background: idx === hilite ? "#deeafb" : idx % 2 === 0 ? "#fff" : "#fafbff",
                  borderLeft: idx === hilite ? "3px solid #1f65de" : "3px solid transparent",
                  fontSize: 11.5, transition: "background .07s",
                }}
              >
                <span style={{ width: 180, color: "#1f65de", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.AccountName}
                </span>
                <span style={{ width: 120, color: "#16a34a", fontWeight: 600 }}>{c.MobileNo || "—"}</span>
                <span style={{ flex: 1, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[c.Address1, c.City].filter(Boolean).join(", ") || "—"}
                </span>
                <span style={{ width: 80, color: "#8b99b5", fontSize: 10 }}>{c.GSTINNo || "—"}</span>
              </div>
            ))
          }
        </div>
        <div style={{
          display: "flex", gap: 12, padding: "5px 12px",
          background: "#f8faff", borderTop: "1px solid #eaecf4",
        }}>
          {["↑↓ Navigate", "Enter Select", "Esc Close"].map(h => (
            <span key={h} style={{ fontSize: 9.5, color: "#8b99b5", display: "flex", alignItems: "center", gap: 3 }}>
              <kbd style={{ background: "#1f65de", color: "#fff", fontSize: 8.5, fontWeight: 700, padding: "1px 4px", borderRadius: 2 }}>
                {h.split(" ")[0]}
              </kbd>
              {h.split(" ").slice(1).join(" ")}
            </span>
          ))}
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
         const url = `${CC.GetFocusColumnsUrl}`;
        //const url = `/Content/Appdata/Visible/${mcomid}/SaleFocus.json?v=${Date.now()}`;
       const res = await CC.api(
      url,
      null,
      {},
      { comid:comid, filename: "SaleFocus" }
    );

    if (!res || res._netErr) return;

    const saved = Array.isArray(res) ? res
                : Array.isArray(res?.data)  ? res.data
                : Array.isArray(res?.Data1) ? res.Data1
                : [];
        // let saved = [];
        // if (res.ok) { try { saved = await res.json(); } catch {} }

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
      } catch (err){
        setItems(colSettings.filter(c => c.visible).map((c, i) => ({
          key: c.key, label: c.label, focus: true, index: i,
        })));
      } finally {
        setLoading(false);
      }
    })();
  }, [colSettings, comid]);

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
    filename: "SaleFocus",
    column:   it.key,
    Index:    i,
    Focus:    it.focus,
    Comid:    parseInt(comid) || 1,
  }));

  try {
    const res = await CC.insertapi(CC.SO_FocusColumnsUrl, payload);

    if (res?.ok || res?.IsSuccess) {
      toast?.("✅ Focus/Reorder saved.");
      onSaved?.();
      onClose();
    } else {
      toast?.("⚠️ " + (res?.message || "Save failed"));
      onClose();
    }
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
          🖱 <strong>Drag rows</strong> to reorder &nbsp;|&nbsp; ☑ <strong>Check</strong> to enable focus navigation
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
                <span style={{ flex: 1, fontSize: 12, color: "#1a2e4a", fontWeight: 500 }}>{it.label}</span>
                <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                  <input type="checkbox" checked={!!it.focus} onChange={() => toggleFocus(it.key)} style={{ display: "none" }} />
                  <div style={{
                    width: 34, height: 18, borderRadius: 9,
                    background: it.focus ? "#1f65de" : "#d0d8ea",
                    position: "relative", cursor: "pointer",
                    transition: "background .2s",
                  }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: "50%",
                      background: "#fff", position: "absolute",
                      top: 2, left: it.focus ? 18 : 2,
                      transition: "left .2s",
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
            background: "#1f65de", color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 700,
          }}>💾 Save & Apply</button>
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
  const payload = local.map(c => ({
    Comid: parseInt(comid) || 1,
    filename: "Sale",
    column: c.key,
    Visible: c.visible === true,
    Width: parseInt(c.width) || 100,
  }));

  try {
    const res = await CC.insertapi(CC.VisibleColumnsUrl, payload);
    console.log("F12 save res:", res);

    if (res?.ok || res?.IsSuccess) { 
      toast?.("✅ Column settings saved"); 
      onSave(local); 
    } else { 
      toast?.("⚠️ " + (res?.message || "Saved locally")); 
      onSave(local); 
    }
  }catch  (err) {
    console.error("F12 Save error:", err);
    onSave(local);
  }
};

  return (
    <div className="mp-ov">
      <div className="mp-modal-box" style={{ width: 500, maxHeight: "82vh" }}>
        <div className="mp-modal-hdr">
          <span>⚙ Sale Grid Column Settings (F12)</span>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="mp-modal-body" style={{ overflowY: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
            <thead>
              <tr>
                {["Column", "Visible", "Width (px)"].map(h => (
                  <th key={h} style={{
                    background: "#1a2e4a", color: "#fff",
                    padding: "6px 10px", textAlign: "left", fontWeight: 600,
                    position: "sticky", top: 0, zIndex: 2,
                  }}>{h}</th>
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
                    <input
                      type="number" min={40} max={600} value={c.width}
                      style={{ width: 70, border: "1px solid #d4dbe8", borderRadius: 3, padding: "2px 6px", fontSize: 12, textAlign: "right" }}
                      onChange={e => setWid(c.key, e.target.value)}
                    />
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
// ─── PRODUCT SEARCH POPUP ────────────────────────────────────────────────────
// ─── PRODUCT SEARCH POPUP ────────────────────────────────────────────────────
function ProductSearchPopup({ products, onSelect, onClose, anchorPos, isTamil }) {
  const [q, setQ]           = useState("");
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
    <div className="sb-prod-search" style={{ top: anchorPos?.top || 160, left: anchorPos?.left+250 || 20 }}>
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
            if (e.key === "ArrowDown")  { e.preventDefault(); setHilite(h => Math.min(h + 1, filtered.length - 1)); }
            if (e.key === "ArrowUp")    { e.preventDefault(); setHilite(h => Math.max(h - 1, 0)); }
            if (e.key === "Enter")      { e.preventDefault(); if (filtered[hilite]) onSelect(filtered[hilite]); }
            if (e.key === "Escape")     { e.preventDefault(); onClose(); }
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
              onClick={() => onSelect(p)}
              onMouseEnter={() => setHilite(idx)}>

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
// ─── PRODUCT SEARCH POPUP ────────────────────────────────────────────────────
// function ProductSearchPopup({ products, onSelect, onClose, anchorPos }) {
//   const [q, setQ]           = useState("");
//   const [hilite, setHilite] = useState(0);
//   const inputRef = useRef(null);
//   const listRef  = useRef(null);

//   useEffect(() => { setTimeout(() => inputRef.current?.focus(), 30); }, []);

//   const filtered = products.filter(p =>
//     String(p.PName || "").toLowerCase().includes(q.toLowerCase()) ||
//     String(p.Prod_code || "").toLowerCase().includes(q.toLowerCase())
//   ).slice(0, 120);

//   useEffect(() => { setHilite(0); }, [q]);
//   useEffect(() => {
//     const el = listRef.current?.querySelector(`[data-idx="${hilite}"]`);
//     if (el) el.scrollIntoView({ block: "nearest" });
//   }, [hilite]);

//   return (
//     <div className="sb-prod-search" style={{ top: anchorPos?.top || 160, left: anchorPos?.left+250 || 20 }}>
//       <div className="sb-prod-search-hdr">
//         <span className="sb-ps-title">Product Search</span>
//         <span className="sb-ps-count">{filtered.length} items</span>
//         <button className="sb-ps-close" onClick={onClose} title="Close (Esc)">✕</button>
//       </div>
//       <div className="sb-ps-input-wrap">
//         <span className="sb-ps-icon">⌕</span>
//         <input
//           ref={inputRef}
//           value={q}
//           onChange={e => setQ(e.target.value)}
//           placeholder="Type code or name…"
//           className="sb-ps-input"
//           onKeyDown={e => {
//             if (e.key === "ArrowDown")  { e.preventDefault(); setHilite(h => Math.min(h + 1, filtered.length - 1)); }
//             if (e.key === "ArrowUp")    { e.preventDefault(); setHilite(h => Math.max(h - 1, 0)); }
//             if (e.key === "Enter")      { e.preventDefault(); if (filtered[hilite]) onSelect(filtered[hilite]); }
//             if (e.key === "Escape")     { e.preventDefault(); onClose(); }
//           }}
//         />
//       </div>
//       <div className="sb-ps-cols">
//         <span style={{ width: 90 }}>Code</span>
//         <span style={{ flex: 1 }}>ProductName</span>
//         <span style={{ width: 72, textAlign: "right" }}>SaleRate</span>
//         <span style={{ width: 60, textAlign: "right" }}>Stock</span>
//       </div>
//       <div ref={listRef} className="sb-prod-list">
//         {filtered.length === 0
//           ? <div className="sb-ps-empty">No products found</div>
//           : filtered.map((p, idx) => (
//             <div key={p.Id} data-idx={idx}
//               className={`sb-prod-item${idx === hilite ? " hi" : ""}`}
//               onClick={() => onSelect(p)}
//               onMouseEnter={() => setHilite(idx)}>
//               <span className="sb-prod-code">{p.Prod_Code ? p.Prod_Code : p.ProductCode}</span>
//               <span className="sb-prod-name">{p.PName ? p.PName : p.ProductName}</span>
//               <span className="sb-prod-rate">₹{CC.f2(CC.vn(p.SaleRate ? p.SaleRate : p.SalesRate)).toFixed(2)}</span>
//               <span className="sb-prod-stock">{CC.vn(p.Stock).toFixed(0)}</span>
//             </div>
//           ))
//         }
//       </div>
//       <div className="sb-ps-footer">
//         <span><kbd>↑↓</kbd> Navigate</span>
//         <span><kbd>Enter</kbd> Select</span>
//         <span><kbd>Esc</kbd> Close</span>
//       </div>
//     </div>
//   );
// }

// ─── F5 VIEW MODAL ────────────────────────────────────────────────────────────
function F5ViewModal({ rows, details, onEdit, onDelete, onClose, fromDate, toDate, onSearch }) {
  const [from, setFrom]           = useState(fromDate);
  const [to, setTo]               = useState(toDate);
  const [expandedId, setExpandedId] = useState(null);

  const getDetails = (masterId) => (details || []).filter(d => String(d.SaleRefId) === String(masterId));
  const totalAmt   = rows.reduce((s, r) => s + CC.vn(r.NetAmt), 0);

  return (
    <div className="mp-ov" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mp-modal-box sb-f5-modal" style={{ width: 980, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div className="mp-modal-hdr">
          <span>📋 Sale Bill View (F5)</span>
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
          <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: 15, color: "#16a34a" }}>
            Total Amt : {CC.f2(totalAmt).toFixed(2)}
          </span>
        </div>
        <div className="mp-modal-body" style={{ flex: 1, overflowY: "auto", padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#1a2e4a", color: "#fff", position: "sticky", top: 0, zIndex: 2 }}>
                <th style={{ width: 32 }} />
                <th style={{ padding: "6px 10px", textAlign: "left" }}>Bill No</th>
                <th style={{ padding: "6px 10px", textAlign: "left" }}>Bill Date</th>
                <th style={{ padding: "6px 10px", textAlign: "left" }}>Customer</th>
                <th style={{ padding: "6px 10px", textAlign: "right" }}>Net Amt</th>
                <th style={{ padding: "6px 10px", textAlign: "left" }}>Type</th>
                <th style={{ padding: "6px 10px", textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "#94a3b8", padding: 20 }}>No records found.</td></tr>
              )}
              {rows.map((r, i) => {
                const isExp  = expandedId === r.Id;
                const rowDets = getDetails(r.Id);
                return (
                  <React.Fragment key={r.Id}>
                    <tr style={{ background: isExp ? "#deeafb" : i % 2 === 0 ? "#fff" : "#fafbff",
                      borderBottom: "1px solid #eaecf4", cursor: "pointer" }}>
                      <td style={{ textAlign: "center", width: 32, fontSize: 12, userSelect: "none" }}
                        onClick={() => setExpandedId(isExp ? null : r.Id)}>
                        {isExp ? "▼" : "▶"}
                      </td>
                      <td style={{ padding: "5px 10px", color: "#1f65de", fontWeight: 700 }}>
                        {r.BillNoDisplay || r.BillNo}
                      </td>
                      <td style={{ padding: "5px 10px" }}>{String(r.BillDate || "").slice(0, 10)}</td>
                      <td style={{ padding: "5px 10px" }}>{r.CustomerName}</td>
                      <td style={{ padding: "5px 10px", textAlign: "right", fontWeight: 700, color: "#16a34a" }}>
                        ₹{CC.f2(CC.vn(r.NetAmt)).toFixed(2)}
                      </td>
                      <td style={{ padding: "5px 10px" }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                          background: r.SaleType === "CASH" ? "#dcfce7" : "#dbeafe",
                          color:      r.SaleType === "CASH" ? "#16a34a" : "#1d4ed8",
                        }}>{r.SaleType}</span>
                      </td>
                      <td style={{ padding: "5px 10px", textAlign: "center" }}>
                        <button onClick={() => onEdit(r.Id)} style={{
                          marginRight: 6, padding: "3px 10px", fontSize: 11, borderRadius: 4,
                          border: "1px solid #c5d8f8", background: "#e8f0fe",
                          color: "#1f65de", fontWeight: 600, cursor: "pointer",
                        }}>✏ Edit</button>
                        <button onClick={() => onDelete(r.Id, r.BillNoDisplay || r.BillNo)} style={{
                          padding: "3px 10px", fontSize: 11, borderRadius: 4,
                          border: "1px solid #fecaca", background: "#fee2e2",
                          color: "#dc2626", fontWeight: 600, cursor: "pointer",
                        }}>🗑 Del</button>
                      </td>
                    </tr>
                    {isExp && (
                      <tr key={`det_${r.Id}`}>
                        <td colSpan={7} style={{ padding: "6px 24px 10px 42px",
                          background: "#f8fafc", borderBottom: "2px solid #bfdbfe" }}>
                          {rowDets.length === 0
                            ? <span style={{ color: "#94a3b8", fontSize: 12 }}>No product details found.</span>
                            : (
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                                <thead>
                                  <tr style={{ background: "#2d4a9f", color: "#fff" }}>
                                    {["Code","Description","MRP","Sale Rate","Qty","GST%","GST Amt","Disc%","Disc Amt"].map(h => (
                                      <th key={h} style={{ padding: "3px 8px",
                                        textAlign: ["MRP","Sale Rate","Qty","GST%","GST Amt","Disc%","Disc Amt"].includes(h) ? "right" : "left" }}>
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {rowDets.map((d, di) => (
                                    <tr key={di} style={{ background: di % 2 === 0 ? "#fff" : "#f5f9ff" }}>
                                      <td style={{ padding: "3px 8px" }}>{d.ProductCode}</td>
                                      <td style={{ padding: "3px 8px" }}>{d.ProductName}</td>
                                      <td style={{ padding: "3px 8px", textAlign: "right" }}>{CC.f2(CC.vn(d.MRP)).toFixed(2)}</td>
                                      <td style={{ padding: "3px 8px", textAlign: "right" }}>{CC.f2(CC.vn(d.SaleRate)).toFixed(2)}</td>
                                      <td style={{ padding: "3px 8px", textAlign: "right" }}>{CC.f2(CC.vn(d.ItemQty)).toFixed(2)}</td>
                                      <td style={{ padding: "3px 8px", textAlign: "right" }}>{CC.f2(CC.vn(d.TaxPercent)).toFixed(2)}</td>
                                      <td style={{ padding: "3px 8px", textAlign: "right" }}>{CC.f2(CC.vn(d.TaxAmt)).toFixed(2)}</td>
                                      <td style={{ padding: "3px 8px", textAlign: "right" }}>{CC.f2(CC.vn(d.DiscountPercent)).toFixed(2)}</td>
                                      <td style={{ padding: "3px 8px", textAlign: "right" }}>{CC.f2(CC.vn(d.DiscountAmt)).toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )
                          }
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

// ─── BILL HOLD MODAL ──────────────────────────────────────────────────────────
function BillHoldModal({ holds, onLoad, onDelete, onClose }) {
  const [sel, setSel] = useState(null);
  return (
    <div className="mp-ov" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mp-modal-box sb-hold-modal">
        <div className="mp-modal-hdr"><span>📋 Bill Hold List</span><button onClick={onClose}>✕</button></div>
        <div className="mp-modal-body">
          {holds.length === 0
            ? <div style={{ textAlign: "center", color: "#94a3b8", padding: 14 }}>No bill holds</div>
            : holds.map((h, i) => (
              <div key={i} onClick={() => setSel(h)}
                style={{
                  padding: "6px 10px", cursor: "pointer", borderBottom: "1px solid #eaecf4",
                  background: sel?.HoldName === h.HoldName ? "#a8c8f5" : "#fff",
                  fontWeight: 600, fontSize: 12,
                }}>
                {h.HoldName}
              </div>
            ))
          }
        </div>
        <div className="mp-modal-ftr">
          <button className="mp-btn" onClick={onClose}>Cancel</button>
          {sel && <button className="mp-btn dl" onClick={() => onDelete(sel.HoldName)}>🗑 Delete</button>}
          {sel && <button className="mp-btn sv" onClick={() => onLoad(sel.HoldName)}>✅ Load</button>}
        </div>
      </div>
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
  const displayLabel = selected ? `${selected.SalesManCode || selected.Id} - ${selected.SalesManName}` : "";

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
      if (wrapRef.current && !wrapRef.current.contains(e.target)) { setOpen(false); setQ(""); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectItem = s => {
    onChange(String(s.Id));
    setQ(""); setOpen(false);
    setTimeout(() => { onKeyDown?.({ key: "Enter", preventDefault: () => {} }); }, 20);
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
          position: "fixed", width: 260, background: "#fff",
          border: "1px solid #c5d8f8", borderRadius: 6, zIndex: 99999,
          maxHeight: 200, overflowY: "auto",
          boxShadow: "0 8px 24px rgba(31,101,222,.2)",
        }}>
          {filtered.map((s, idx) => (
            <div
              key={s.Id}
              data-idx={idx}
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
              <span style={{
                minWidth: 38, fontSize: 10, fontWeight: 700,
                color: "#1f65de", background: "#e8f0fe",
                borderRadius: 3, padding: "1px 5px", textAlign: "center", flexShrink: 0,
              }}>{s.SalesManCode || s.Id}</span>
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

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function SaleBill() {
  const unlockedRidRef       = useRef(null);
  const pendingRateChangeRef = useRef(null);
  const navigate             = useNavigate();
  const { confirm, ConfirmUI } = CC.useConfirm();
  const { toast, toasts }    = CC.useToast();

  const [f5DeletePending, setF5DeletePending] = useState(null);
  const [focusCols, setFocusCols]             = useState([]);
  const [f5AmtDetails, setF5AmtDetails]       = useState([]);
  const focusColsRef                          = useRef([]);
  const focusConfiguredRef  = useRef(false);
  const [f5Details, setF5Details]             = useState([]);
  const pendingRateInputRef                   = useRef({});

  // ── Column Settings ────────────────────────────────────────────────────────
  const [colSettings, setColSettings] = useState(CC.SB_DEFAULT_COL_SETTINGS);
  const [f12Open,     setF12Open]     = useState(false);
  const [ctrlGOpen,   setCtrlGOpen]   = useState(false);

  const [expiryListPopup, setExpiryListPopup] = useState(null);
  const srdetailsRef  = useRef([]);
  const remarksRef    = useRef(null);
  const payInputRefs  = useRef([]);

  const loadColCfg = useCallback(async (comid) => {
    try {
       const url =  CC.BASE_URL + `${CC.GetFocusColumnsUrl}?comid=${sess.Comid}&filename=Sale`;
      //const url = `/Content/Appdata/Visible/${comid}/Sale.json?v=${Date.now()}`;
     
        const res = await fetch(
           url,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...CC.authHeaders(),   // ← same headers your other API calls use
              },
            }
          );
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;
      setColSettings(prev => prev.map(col => {
        const s = data.find(x => x.column === col.key);
        return s ? { ...col, visible: s.Visible === true, width: Number(s.Width) || col.width } : col;
      }));
    } catch {}
  }, []);

  useEffect(() => { focusColsRef.current = focusCols; }, [focusCols]);



  const visCols = colSettings.filter(c => c.visible);

  // ── Session ────────────────────────────────────────────────────────────────
  const [sess] = useState(() => {
    try {
      const main0  = (CC.getLocal("Mainsetting")    || [{}])[0] || {};
      const com0   = (CC.getLocal("Companysetting") || [{}])[0] || {};
      const Comid  = CC.getStr("Comid")  || "1";
      const MComid = CC.getStr("MComid") || Comid;
      const IdComList = CC.getStr("IdComList") || Comid;
      const isCC   = !!main0.CommonCompany;
      return {
        Comid:        isCC ? MComid : Comid,
        MComid, IdComList,
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
        BillPrintClosingBalance: !!main0.BillPrintClosingBalance,
        CRMValueSingle: CC.vn(com0.CRMPointValue) || 0,
        ItemwiseCRMPoint: !!main0.ItemwiseCRMPoint,
        // ── Print settings from Companysetting ──────────────────────────────
        BillFormatName: com0.SaleBillFormat || "Default",
        CompanyName:    com0.Companyname    || "",
        Address1:       com0.Address1       || "",
        Address2:       com0.Address2       || "",
        City:           com0.City           || "",
        Pincode:        com0.Pincode        || "",
        Phone:          com0.Phone          || "",
        GSTNo:          com0.GSTNo          || "",
        Email:          com0.Email          || "",
        StateCode:      com0.State          || "",
        YearName:       com0.YearName       || "",
        POSLine1:       com0.POSLine1       || "",
        POSLine2:       com0.POSLine2       || "",
        POSLine3:       com0.POSLine3       || "",
        POSLine4:       com0.POSLine4       || "",
        POSLine5:       com0.POSLine5       || "",
        No_Of_Bills:    com0.No_Of_Bills    || "1",
        BankLine1:      com0.BankLine1      || "",
        BankLine2:      com0.BankLine2      || "",
        BankLine3:      com0.BankLine3      || "",
        BankLine4:      com0.BankLine4      || "",
        BankLine5:      com0.BankLine5      || "",
        PrintA4:        !!main0.A4BillPrint,
        PrintSmall:     !!main0.SmallBillPrint,
      };
    } catch {
      return {
        Comid: "1", MComid: "1", IdComList: "1",
        CashId: "0", CashierId: "0",
        BillNoType: "Daily Reset On Company", BillNoPrefix: "", BillNoDigit: 0,
        SaleSubMaster: false, Herbalife: false, DayClose: false, TaxName: "Exclusive",
        BillFormatName: "Default", CompanyName: "", PrintA4: false, PrintSmall: false,
      };
    }
  });
// const loadFocusCols = useCallback(async (mcomid) => {
//   try {
//      const url =  CC.GetFocusColumnsUrl;
//     const res = await CC.api(
//       url,
//       null,
//       {},
//       { comid: sess.Comid, filename: "SaleFocus" }
//     );

//     if (!res || res._netErr) return;

//     const saved = Array.isArray(res) ? res
//                 : Array.isArray(res?.data)  ? res.data
//                 : Array.isArray(res?.Data1) ? res.Data1
//                 : [];

//     if (!Array.isArray(saved) || saved.length === 0) return;

//     const ordered = saved
//       .filter(s => s.Focus === true)
//       .sort((a, b) => (a.Index ?? 99) - (b.Index ?? 99))
//       .map(s => s.column);

//     focusColsRef.current = ordered;
//     setFocusCols(ordered);
//   }catch  (err) {
//     console.error("F12 Save error:", err);
    
//   }
// }, [sess.Comid]);
const loadFocusCols = useCallback(async (mcomid) => {
  try {
    const url = CC.GetFocusColumnsUrl;
    const res = await CC.api(url, null, {}, { comid: sess.Comid, filename: "SaleFocus" });

    if (!res || res._netErr) return;

    const saved = Array.isArray(res) ? res
                : Array.isArray(res?.data)  ? res.data
                : Array.isArray(res?.Data1) ? res.Data1
                : [];

    if (!Array.isArray(saved) || saved.length === 0) return; // settings இதுவரை save ஆகல -> fallback behavior தொடரும்

    focusConfiguredRef.current = true;   // ✅ settings இருக்கு (எல்லாம் OFF ஆனாலும் சரி) என்று mark பண்ணு

    const ordered = saved
      .filter(s => s.Focus === true)
      .sort((a, b) => (a.Index ?? 99) - (b.Index ?? 99))
      .map(s => s.column);

    focusColsRef.current = ordered;   // [] ஆகவும் இருக்கலாம் — அதுவும் valid state
    setFocusCols(ordered);
  } catch (err) {
    console.error("F12 Save error:", err);
  }
}, [sess.Comid]);
  const [perm,         setPerm]         = useState({ View: 0, Add: 0, Edit: 0, Delete: 0 });
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [tamilMode, setTamilMode] = useState(sess.Tamil);

  const [customers,  setCustomers]  = useState([]);
  const [salesmen,   setSalesmen]   = useState([]);
  const [cardTypes,  setCardTypes]  = useState([]);

  const [billNo,     setBillNo]     = useState("");
  const [billDate,   setBillDate]   = useState(CC.today());
  const [custId,     setCustId]     = useState("");
  const [custMobile, setCustMobile] = useState("");
  const [smId,       setSmId]       = useState("");
  const [remarks,    setRemarks]    = useState("");
  const [editId,     setEditId]     = useState(0);

  const [crmValue,   setCrmValue]   = useState("0.00");
  const [curBal,     setCurBal]     = useState("0.00");
  const [custCardRefId, setCustCardRefId] = useState("0");
  const [crmPointRate, setCrmPointRate] = useState(0);
  const [crmValueRate, setCrmValueRate] = useState(0);
  const [custOpCrmPoints, setCustOpCrmPoints] = useState(0);
  const [custOpCrmValue, setCustOpCrmValue] = useState(0);
  const [stockLbl,   setStockLbl]   = useState("0.00");

  const [rows,       setRows]       = useState([mkRow()]);
  const [selRid,     setSelRid]     = useState(null);
  const [payRows,    setPayRows]    = useState([]);
  const [totals,     setTotals]     = useState({
    GrossAmt: 0, DiscAmt: 0, GSTAmt: 0, CESSAmt: 0,
    OtherPlus: 0, OtherMinus: 0, Coinage: 0, NetAmt: 0,
  });
  const [otherPlus,  setOtherPlus]  = useState("");
  const [otherMinus, setOtherMinus] = useState("");
  const [discPer,    setDiscPer]    = useState("");
  const [gstSplit,   setGstSplit]   = useState([]);

  const [loading,    setLoading]    = useState(false);
  const [ldMsg,      setLdMsg]      = useState("Loading...");
  const [pw,         setPw]         = useState(null);
  const pwOkRef = useRef(null);

  const [lastBillNo,  setLastBillNo]  = useState(() => localStorage.getItem("lastBillNo")  || "—");
  const [lastBillAmt, setLastBillAmt] = useState(() => parseFloat(localStorage.getItem("lastBillAmt")) || 0);
  const [printDialog, setPrintDialog] = useState(null);

  const [prodPopup,  setProdPopup]  = useState(null);
  const [prodList,   setProdList]   = useState([]);
  const [custPopup,  setCustPopup]  = useState(false);
  const [f5Open,     setF5Open]     = useState(false);
  const [f5Rows,     setF5Rows]     = useState([]);
  const [holdOpen,   setHoldOpen]   = useState(false);
  const [holdRows,   setHoldRows]   = useState([]);
  const [billHoldName, setBillHoldName] = useState("");

  const [batchPopup, setBatchPopup] = useState(null);
  const batchListRef = useRef([]);

  const rowsRef  = useRef(rows);
  const cellRefs = useRef({});
  const origCrmRef = useRef({ OpeningPoint: 0, OpeningValue: 0 });
  const custMetaRef = useRef({
    curBal: 0,
    custCardRefId: "0",
    crmPointRate: 0,
    crmValueRate: 0,
    custOpCrmPoints: 0,
    custOpCrmValue: 0
  });

  useEffect(() => {
    custMetaRef.current = {
      curBal,
      custCardRefId,
      crmPointRate,
      crmValueRate,
      custOpCrmPoints,
      custOpCrmValue
    };
  }, [curBal, custCardRefId, crmPointRate, crmValueRate, custOpCrmPoints, custOpCrmValue]);
  const custRef  = useRef(null);
  const smRef    = useRef(null);
  const ratePasswordVerifiedRef = useRef(false);

  useEffect(() => { rowsRef.current = rows; }, [rows]);

  const regCell = (rid, key, el) => {
    if (!cellRefs.current[rid]) cellRefs.current[rid] = {};
    if (el) cellRefs.current[rid][key] = el;
    else delete cellRefs.current[rid]?.[key];
  };

  const validRows = rows.filter(r => r.ProductRefId && CC.vn(r.ItemQty) > 0);
  const itemCount = validRows.length;
  const totalQty  = validRows.reduce((s, r) => s + CC.vn(r.ItemQty), 0);

  // ── Permission check ──────────────────────────────────────────────────────
  useEffect(() => {
    const menuStr = localStorage.getItem("menulist");
    if (!menuStr) {
      localStorage.removeItem("lastBillNo");
      localStorage.removeItem("lastBillAmt");
      alert("Session Close Please Login !!!.");
      navigate("/");
      return;
    }
    const menulist = JSON.parse(menuStr);
    const menudata = menulist.filter(o => o.PageName === "Billing-POS");
    if (!menudata || menudata.length === 0 || menudata[0].View === 0) {
      alert("Page Access Permission Denied !!!");
      setTimeout(() => navigate("/Home"), 3000);
      return;
    }
    setLoading(false);
    setTimeout(() => {
      const firstRow = rowsRef.current[0];
      if (firstRow) cellRefs.current[firstRow._rid]?.["ProductCode"]?.focus();
    }, 200);
    setPerm({ View: menudata[0].View, Add: menudata[0].Add, Edit: menudata[0].Edit, Delete: menudata[0].Delete });
    setIsAuthorized(true);
  }, [navigate]);

  const redirectIfDualLogin = useCallback((res) => {
    if (res?._dualLogin || res?.redis === false) {
      alert("Already Login Another User Please Login Again!!!");
      localStorage.removeItem("lastBillNo");
      localStorage.removeItem("lastBillAmt");
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
      await Promise.all([loadDropdowns(), loadBillNo(), loadColCfg(sess.Comid), loadFocusCols(sess.MComid)]);
      setLoading(false);
    })();
  // eslint-disable-next-line
  }, [isAuthorized]);

  // ── Batch Popup ────────────────────────────────────────────────────────────
  function BatchPopup({ batches, onSelect, onClose }) {
    const [hilite, setHilite] = useState(0);
    const listRef = useRef(null);
    useEffect(() => {
      const el = listRef.current?.querySelector(`[data-idx="${hilite}"]`);
      if (el) el.scrollIntoView({ block: "nearest" });
    }, [hilite]);
    return (
      <div style={{
        position: "fixed", inset: 0, background: "rgba(10,20,40,.35)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 8800,
      }}>
        <div style={{
          background: "#fff", borderRadius: 10, width: 560, maxHeight: 420,
          display: "flex", flexDirection: "column", overflow: "hidden",
          boxShadow: "0 16px 48px rgba(31,101,222,.22)", border: "1px solid #d0ddf5",
        }}>
          <div style={{
            background: "linear-gradient(135deg,#1b3a8f 0%,#1f65de 100%)",
            padding: "10px 14px", display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", flex: 1 }}>📦 Select Batch</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,.65)", background: "rgba(255,255,255,.15)", borderRadius: 10, padding: "2px 8px" }}>
              {batches.length} batches
            </span>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", width: 22, height: 22, borderRadius: "50%", cursor: "pointer", fontSize: 11 }}>✕</button>
          </div>
          <div style={{
            display: "flex", gap: 8, padding: "4px 10px",
            background: "#f0f4fc", borderBottom: "1px solid #dde6f5",
            fontSize: 9.5, fontWeight: 700, color: "#6b7a99",
            letterSpacing: ".4px", textTransform: "uppercase",
          }}>
            <span style={{ width: 120 }}>Batch No</span>
            <span style={{ width: 90, textAlign: "right" }}>MRP</span>
            <span style={{ width: 90, textAlign: "right" }}>Sale Rate</span>
            <span style={{ width: 90, textAlign: "right" }}>Stock</span>
            <span style={{ width: 100 }}>Exp Date</span>
            <span style={{ width: 80 }}>Mfg Date</span>
          </div>
          <div ref={listRef} style={{ overflowY: "auto", flex: 1 }}>
            {batches.map((b, idx) => (
              <div
                key={b.Batchid || idx}
                data-idx={idx}
                onClick={() => onSelect(b)}
                onMouseEnter={() => setHilite(idx)}
                style={{
                  display: "flex", gap: 8, alignItems: "center",
                  padding: "6px 10px", cursor: "pointer",
                  borderBottom: "1px solid #f3f5fb",
                  background: idx === hilite ? "#deeafb" : idx % 2 === 0 ? "#fff" : "#fafbff",
                  borderLeft: idx === hilite ? "3px solid #1f65de" : "3px solid transparent",
                  fontSize: 11.5,
                }}
              >
                <span style={{ width: 120, color: "#1f65de", fontWeight: 700 }}>{b.BatchNo || b.Bat_No || "—"}</span>
                <span style={{ width: 90, textAlign: "right", color: "#475569" }}>₹{CC.f2(CC.vn(b.MRP)).toFixed(2)}</span>
                <span style={{ width: 90, textAlign: "right", color: "#16a34a", fontWeight: 600 }}>₹{CC.f2(CC.vn(b.SalesRate || b.SaleRate)).toFixed(2)}</span>
                <span style={{ width: 90, textAlign: "right", color: CC.vn(b.Stock) <= 0 ? "#dc2626" : "#1a2e4a" }}>{CC.vn(b.Stock).toFixed(0)}</span>
                <span style={{ width: 100, color: "#8b5cf6", fontSize: 10.5 }}>{b.ExpDate ? String(b.ExpDate).slice(0, 10) : "—"}</span>
                <span style={{ width: 80, color: "#94a3b8", fontSize: 10.5 }}>{b.MFDate ? String(b.MFDate).slice(0, 10) : "—"}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, padding: "5px 12px", background: "#f8faff", borderTop: "1px solid #eaecf4" }}>
            {["↑↓ Navigate", "Enter Select", "Esc Close"].map(h => (
              <span key={h} style={{ fontSize: 9.5, color: "#8b99b5", display: "flex", alignItems: "center", gap: 3 }}>
                <kbd style={{ background: "#1f65de", color: "#fff", fontSize: 8.5, fontWeight: 700, padding: "1px 4px", borderRadius: 2 }}>
                  {h.split(" ")[0]}
                </kbd>
                {h.split(" ").slice(1).join(" ")}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Expiry Date List Popup ─────────────────────────────────────────────────
  function ExpiryDateListPopup({ expiryList, onSelect, onClose }) {
    const [hilite, setHilite] = useState(0);
    const listRef = useRef(null);
    useEffect(() => {
      const el = listRef.current?.querySelector(`[data-idx="${hilite}"]`);
      if (el) el.scrollIntoView({ block: "nearest" });
    }, [hilite]);
    return (
      <div style={{
        position: "fixed", inset: 0, background: "rgba(10,20,40,.35)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 8900,
      }}>
        <div style={{
          background: "#fff", borderRadius: 8, width: 380, maxHeight: 400,
          display: "flex", flexDirection: "column", overflow: "hidden",
          boxShadow: "0 8px 32px rgba(31,101,222,.22)", border: "1px solid #d0ddf5",
        }}>
          <div style={{ background: "#1a2e4a", color: "#fff", padding: "8px 14px", display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>📅 Expiry Date Product List</span>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>✕</button>
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 80px",
            padding: "4px 10px", background: "#f0f4fc", borderBottom: "1px solid #dde6f5",
            fontSize: 11, fontWeight: 700, color: "#6b7a99",
            textTransform: "uppercase", letterSpacing: ".4px",
          }}>
            <span>Expdate</span><span>MFdate</span><span style={{ textAlign: "right" }}>Stock</span>
          </div>
          <div ref={listRef} style={{ overflowY: "auto", flex: 1 }}>
            {expiryList.length === 0
              ? <div style={{ textAlign: "center", color: "#94a3b8", padding: 20, fontSize: 12 }}>No records found</div>
              : expiryList.map((item, idx) => (
                <div
                  key={idx}
                  data-idx={idx}
                  onClick={() => onSelect(item)}
                  onMouseEnter={() => setHilite(idx)}
                  style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr 80px",
                    padding: "6px 10px", cursor: "pointer",
                    borderBottom: "1px solid #f3f5fb",
                    background: idx === hilite ? "#deeafb" : idx % 2 === 0 ? "#fff" : "#fafbff",
                    borderLeft: idx === hilite ? "3px solid #1f65de" : "3px solid transparent",
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: "#475569" }}>
                    {item.Expdate ? String(item.Expdate).slice(0, 10).split("-").reverse().join("/") : "—"}
                  </span>
                  <span style={{ color: "#475569" }}>
                    {item.MFdate ? String(item.MFdate).slice(0, 10).split("-").reverse().join("/") : ""}
                  </span>
                  <span style={{
                    textAlign: "right", fontWeight: 700,
                    color: CC.vn(item.Stock) <= 0 ? "#dc2626" : "#1a2e4a",
                    background: idx === hilite ? "transparent" : CC.vn(item.Stock) <= 15 ? "#fed7aa" : "transparent",
                    borderRadius: 3, padding: "0 4px",
                  }}>{CC.vn(item.Stock).toFixed(0)}</span>
                </div>
              ))
            }
          </div>
          <div style={{ display: "flex", gap: 12, padding: "5px 12px", background: "#f8faff", borderTop: "1px solid #eaecf4" }}>
            {["↑↓ Navigate", "Enter Select", "Esc Close"].map(h => (
              <span key={h} style={{ fontSize: 9.5, color: "#8b99b5", display: "flex", alignItems: "center", gap: 3 }}>
                <kbd style={{ background: "#1f65de", color: "#fff", fontSize: 8.5, fontWeight: 700, padding: "1px 4px", borderRadius: 2 }}>
                  {h.split(" ")[0]}
                </kbd>
                {h.split(" ").slice(1).join(" ")}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Load Bill No ──────────────────────────────────────────────────────────
  const loadBillNo = useCallback(async () => {
    const res = await CC.api(CC.SaleMaxNo, null, {}, {
      date: billDate, CId: sess.CashierId, Comid: sess.Comid,
      NumberDigit: sess.BillNoDigit, BillPrefix: sess.BillNoPrefix,
      BillType: sess.BillNoType, Estimate: 0, BM: 0,
    });
    if (redirectIfDualLogin(res)) return;
    const no = res.No || res.data || res.Data1 || "";
    if (no) setBillNo(CC.ns(no));
  // eslint-disable-next-line
  }, [sess, billDate]);

  const loadDropdowns = useCallback(async () => {
    const comidParam = sess.CommonCompany ? sess.MComid : sess.Comid;
    const [custRes, smRes, cardRes] = await Promise.all([
      CC.api(CC.SO_GetCustomerUrl, null, {}, { Comid: comidParam, AccountType: "CUSTOMER" }),
      CC.api(CC.SO_SalesManSelectUrl, null, {}, { Comid: comidParam }),
      CC.api(CC.SelectCardMasterUrl, null, {}, { Comid: sess.Comid }),
    ]);
    if (redirectIfDualLogin(custRes)) return;
    const pick = r => r.data || r.Data1 || r || [];
    setCustomers(Array.isArray(pick(custRes)) ? pick(custRes) : []);
    setSalesmen(Array.isArray(pick(smRes))   ? pick(smRes)   : []);
    const cardList = Array.isArray(pick(cardRes)) ? pick(cardRes) : [];
    if (cardList.length > 0) {
      setPayRows(cardList.map(c => ({
        CardAccountRefId: c.CardAccountRefId,
        Saletype: c.Saletype || c.CardType || CC.ns(c.AccountName),
        CardType: c.CardType || "CASH",
        Amount: "",
        Scharge: CC.vn(c.Scharge),
        SchargeAmt: 0,
        BankRefid: c.BankRefid || null,
      })));
    } else {
      setPayRows([
        { CardAccountRefId: 0, Saletype: "CASH",   CardType: "CASH",   Amount: "", Scharge: 0, SchargeAmt: 0, BankRefid: null },
        { CardAccountRefId: 1, Saletype: "CARD",   CardType: "CARD",   Amount: "", Scharge: 0, SchargeAmt: 0, BankRefid: null },
        { CardAccountRefId: 2, Saletype: "UPI",    CardType: "UPI",    Amount: "", Scharge: 0, SchargeAmt: 0, BankRefid: null },
        { CardAccountRefId: 3, Saletype: "CREDIT", CardType: "CREDIT", Amount: "", Scharge: 0, SchargeAmt: 0, BankRefid: null },
      ]);
    }
  // eslint-disable-next-line
  }, [sess]);

  // ── Totals recalc ─────────────────────────────────────────────────────────
  const recalcTotals = useCallback((rowsArr, oPlus, oMinus) => {
    let grossAmt = 0, gstAmt = 0, cessAmt = 0, discAmt = 0, cdAmt = 0;
    const gstMap = {};
    rowsArr.forEach(r => {
      if (!r.ProductRefId || !CC.vn(r.ItemQty)) return;
      const calc = calcSaleRow(r);
      grossAmt += CC.vn(calc.OrgRate) * CC.vn(r.ItemQty) || CC.vn(calc.LandingCost) * CC.vn(r.ItemQty);
      gstAmt   += CC.vn(calc.TaxAmt);
      cessAmt  += CC.vn(calc.CESSAmount);
      discAmt  += CC.vn(calc.DiscountAmt);
      cdAmt    += CC.vn(calc.CDAmount);
      const key = CC.f2(CC.vn(r.TaxPercent));
      if (!gstMap[key]) gstMap[key] = { TaxPercent: key, TaxAmt: 0, CTAmount: 0, STAmount: 0 };
      gstMap[key].TaxAmt   += CC.vn(calc.TaxAmt);
      gstMap[key].CTAmount += CC.vn(calc.CTAmount);
      gstMap[key].STAmount += CC.vn(calc.STAmount);
    });
    const netAmt = CC.f2(grossAmt + gstAmt + cessAmt + CC.vn(oPlus) - (discAmt + cdAmt) - CC.vn(oMinus));
    setGstSplit(Object.values(gstMap).filter(g => g.TaxAmt > 0));
    setTotals({
      GrossAmt: CC.f2(grossAmt), DiscAmt: CC.f2(discAmt + cdAmt),
      GSTAmt: CC.f2(gstAmt), CESSAmt: CC.f2(cessAmt),
      OtherPlus: CC.vn(oPlus), OtherMinus: CC.vn(oMinus), Coinage: 0, NetAmt: netAmt,
    });
    return netAmt;
  }, []);

  useEffect(() => { recalcTotals(rows, otherPlus, otherMinus); }, [rows, otherPlus, otherMinus, recalcTotals]);

  const payTotals = (() => {
    const recvd = payRows.reduce((s, r) => s + CC.vn(r.Amount), 0);
    return { recvd: CC.f2(recvd), toPay: CC.f2(totals.NetAmt - recvd) };
  })();

  // ── Customer select ────────────────────────────────────────────────────────
  const handleCustomerSelect = useCallback(async (custObj) => {
    const cid = String(custObj.Id);
    setCustId(cid);
    setCustMobile(custObj.MobileNo || "");
    setCustPopup(false);

    setCustCardRefId(String(custObj.customercardtypeRefId || "0"));
    if (sess.ItemwiseCRMPoint) {
      setCrmPointRate(1);
      setCrmValueRate(sess.CRMValueSingle);
    } else {
      setCrmPointRate(CC.vn(custObj.CRMPoint));
      setCrmValueRate(CC.vn(custObj.CRMValue));
    }

    setCustOpCrmPoints(0);
    setCustOpCrmValue(0);

    const [crmRes, balRes] = await Promise.all([
      CC.api(CC.SO_CRMBalanceUrl, null, {}, { Id: cid, Fromdate: billDate, Comid: sess.Comid, MComid: sess.MComid }),
      CC.api(CC.SO_CurrentBalanceUrl, null, {}, { Id: cid, MComid: sess.MComid, TillDate: billDate, Comid: sess.Comid, AccountType: "CUSTOMER" }),
    ]);

    if (!crmRes._netErr && (crmRes.ok ?? crmRes.IsSuccess)) {
      const arr = Array.isArray(crmRes.data) ? crmRes.data : [];
      setCrmValue(arr.length > 0 ? CC.f2(CC.vn(arr[0].Value)).toFixed(2) : "0.00");
      if (arr.length > 0) {
        const data = arr[0];
        setCustOpCrmPoints(CC.vn(data.Points));
        setCustOpCrmValue(CC.vn(data.Value));
      } else {
        setCustOpCrmPoints(0);
        setCustOpCrmValue(0);
      }
    }
    if (balRes && !balRes._netErr) {
      const bal = parseFloat(balRes.Data1 ?? balRes.data ?? 0);
      setCurBal(isNaN(bal) ? "0.00" : CC.f2(bal).toFixed(2));
    } else {
      setCurBal("0.00");
    }
  }, [sess, billDate]);

  const handleCustomerChange = useCallback(async (cid) => {
    setCustId(cid);
    const found = customers.find(c => String(c.Id) === cid);
    setCustMobile(found?.MobileNo || "");
    
    if (found) {
      setCustCardRefId(String(found.customercardtypeRefId || "0"));
      if (sess.ItemwiseCRMPoint) {
        setCrmPointRate(1);
        setCrmValueRate(sess.CRMValueSingle);
      } else {
        setCrmPointRate(CC.vn(found.CRMPoint));
        setCrmValueRate(CC.vn(found.CRMValue));
      }
    } else {
      setCustCardRefId("0");
      setCrmPointRate(0);
      setCrmValueRate(0);
    }
    
    if (!cid) { setCrmValue("0.00"); setCurBal("0.00"); return; }

    setCustOpCrmPoints(0);
    setCustOpCrmValue(0);

    const [crmRes, balRes] = await Promise.all([
      CC.api(CC.SO_CRMBalanceUrl, null, {}, { Id: cid, Fromdate: billDate, Comid: sess.Comid, MComid: sess.MComid }),
      CC.api(CC.SO_CurrentBalanceUrl, null, {}, { Id: cid, MComid: sess.MComid, TillDate: billDate, Comid: sess.Comid, AccountType: "CUSTOMER" }),
    ]);

    if (!crmRes._netErr && (crmRes.ok ?? crmRes.IsSuccess)) {
      const arr = Array.isArray(crmRes.data) ? crmRes.data : [];
      setCrmValue(arr.length > 0 ? CC.f2(CC.vn(arr[0].Value)).toFixed(2) : "0.00");
      if (arr.length > 0) {
        const data = arr[0];
        setCustOpCrmPoints(CC.vn(data.Points));
        setCustOpCrmValue(CC.vn(data.Value));
      } else {
        setCustOpCrmPoints(0);
        setCustOpCrmValue(0);
      }
    }
    if (balRes && !balRes._netErr) {
      const bal = parseFloat(balRes.Data1 ?? balRes.data ?? 0);
      setCurBal(isNaN(bal) ? "0.00" : CC.f2(bal).toFixed(2));
    } else {
      setCurBal("0.00");
    }
  }, [sess, billDate, customers]);
  // ── getRowEnabledCols — FIXED ──────────────────────────────────────────────
// Ctrl+G order is now the ONLY basis for ordering. Overrides (SaleRate /
// ItemQty) are injected exactly once, immediately after "ProductCode", and
// only if that field is not already part of the user's Ctrl+G focus list.
// Everything after the override continues from the very next Ctrl+G column
// — it never restarts and never re-inserts the override again.
  // const getRowEnabledCols = useCallback((rid) => {
  //   const defaultCols = visCols
  //     .map(vc => CC.SB_COLUMNS.find(c => c.key === vc.key))
  //     .filter(Boolean)
  //     .filter(cd => !cd.readOnly)
  //     .map(cd => cd.key);

  //   // The user's actual Ctrl+G order (fallback to default visible order if none configured)
  //   const ctrlGOrder = focusConfiguredRef.current === true
  //     ? focusColsRef.current.filter(k => defaultCols.includes(k))
  //     : defaultCols;

  //   const baseOrder = ["ProductCode", ...ctrlGOrder.filter(k => k !== "ProductCode")];

  //   const row = rowsRef.current.find(r => r._rid === rid);
  //   if (!row) return baseOrder;

  //   const isOpenRate = !row.SalesRateType;
  //   const isFracQty  = CC.vn(row.UOMDecimal) > 0;   // Rule 2: UOMDecimal > 0 (not UOM text)

  //   // Only force a field if the business rule applies AND it isn't already
  //   // part of the Ctrl+G order (if it's already there, normal order handles it).
  //   const overrides = defaultCols.filter(k => {
  //     if (k === "SaleRate") return isOpenRate && !ctrlGOrder.includes("SaleRate");
  //     if (k === "ItemQty")  return isFracQty  && !ctrlGOrder.includes("ItemQty");
  //     return false;
  //   });

  //   if (overrides.length === 0) return baseOrder;

  //   const rest = baseOrder.filter(k => k !== "ProductCode");
  //   // ProductCode -> (temporary overrides, once) -> rest of Ctrl+G order, untouched
  //   return ["ProductCode", ...overrides, ...rest];
  // }, [visCols]);
const getRowEnabledCols = useCallback((rid) => {
    const defaultCols = visCols
      .map(vc => CC.SB_COLUMNS.find(c => c.key === vc.key))
      .filter(Boolean)
      .filter(cd => !cd.readOnly)
      .map(cd => cd.key);

    const ctrlGOrder = focusConfiguredRef.current === true
      ? focusColsRef.current.filter(k => defaultCols.includes(k))
      : defaultCols;

    const baseOrder = ["ProductCode", ...ctrlGOrder.filter(k => k !== "ProductCode")];

    const row = rowsRef.current.find(r => r._rid === rid);
    if (!row) return baseOrder;

    const isOpenRate = !row.SalesRateType;

    // ✅ FIX — UOMDecimal>0 ஆனாலும், அல்லது UOM text "KG"/"KGS" ஆனாலும் — ரெண்டையும் accept பண்ணு
    const uomUpper  = (row.UOM || "").toUpperCase();
    const isFracQty = CC.vn(row.UOMDecimal) > 0 || uomUpper === "KG" || uomUpper === "KGS";

    const overrides = defaultCols.filter(k => {
      if (k === "SaleRate") return isOpenRate && !ctrlGOrder.includes("SaleRate");
      if (k === "ItemQty")  return isFracQty  && !ctrlGOrder.includes("ItemQty");
      return false;
    });

    if (overrides.length === 0) return baseOrder;

    const rest = baseOrder.filter(k => k !== "ProductCode");
    return ["ProductCode", ...overrides, ...rest];
  }, [visCols]);
  const goToNextField = useCallback((rid, fromColKey) => {
    const COLS = getRowEnabledCols(rid);
    const colIdx = COLS.indexOf(fromColKey);
    const rowIdx = rowsRef.current.findIndex(r => r._rid === rid);

    const focusCell = (targetRid, targetKey) => {
      if (targetKey === "ItemQty") {
        const r = rowsRef.current.find(x => x._rid === targetRid);
        if (r && CC.vn(r.ItemQty) === 0) {
          setRows(prev => prev.map(row =>
            row._rid === targetRid
              ? calcSaleRow({ ...row, ItemQty: "1", _dirty: true })
              : row
          ));
        }
      }
      setTimeout(() => {
        const el = cellRefs.current[targetRid]?.[targetKey];
        if (el) { el.focus(); el.select?.(); }
      }, 10);
    };

    if (colIdx >= 0 && colIdx < COLS.length - 1) {
      focusCell(rid, COLS[colIdx + 1]);
    } else {
      const curRows = rowsRef.current;
      const curRow  = curRows.find(r => r._rid === rid);
      const isLast  = rowIdx === curRows.length - 1;
      const firstCol = COLS.length > 0 ? COLS[0] : "ProductCode";
      
      if (isLast) {
        if (curRow?.ProductRefId) {
          const newRow = mkRow();
          setRows(prev => [...prev, newRow]);
          setTimeout(() => { cellRefs.current[newRow._rid]?.[firstCol]?.focus(); }, 80);
        } else {
          focusCell(rid, firstCol);
        }
      } else {
        const nextRow = curRows[rowIdx + 1];
        setTimeout(() => {
          const el = cellRefs.current[nextRow._rid]?.[firstCol];
          if (el) { el.focus(); el.select?.(); }
        }, 20);
      }
    }
  }, [getRowEnabledCols]);
  // const getRowEnabledCols = useCallback((rid) => {
  //   const defaultCols = visCols
  //     .map(vc => CC.SB_COLUMNS.find(c => c.key === vc.key))
  //     .filter(Boolean)
  //     .filter(cd => !cd.readOnly)
  //     .map(cd => cd.key);

  //   const ALL_COLS = focusColsRef.current.length > 0
  //     ? focusColsRef.current.filter(k => defaultCols.includes(k))
  //     : defaultCols;

  //   const row = rowsRef.current.find(r => r._rid === rid);
  //   if (!row) return ["ProductCode", ...ALL_COLS.filter(k => k !== "ProductCode")];

  //   const isKgs = row.UOM?.toUpperCase() === "KG" || row.UOM?.toUpperCase() === "KGS";
  //   const isOpenRate = !!row.SalesRateType;

  //   const rowCols = defaultCols.filter(k => {
  //     if (ALL_COLS.includes(k)) return true;
  //     if (isKgs && k === "ItemQty") return true;
  //     if (isOpenRate && k === "SaleRate") return true;
  //     return false;
  //   });

  //   return ["ProductCode", ...rowCols.filter(k => k !== "ProductCode")];
  // }, [visCols]);

  // ── Fill item into row ─────────────────────────────────────────────────────
  const fillItemIntoRow = useCallback((rid, item) => {
    setRows(prev => prev.map(r => {
      if (r._rid !== rid) return r;
      const newRow = {
        ...r,
        ProductRefId:    item.Id,
        ProductCode:     item.Prod_Code ? item.Prod_Code : item.ProductCode,
        ProductName:     tamilMode ? (item.PrinterName || item.PName) : item.PName ? item.PName : item.ProductName,
        PrinterName:     item.PrinterName || "",
        MRP:             CC.f2(CC.vn(item.MRP)),
        SaleRate:        CC.f2(CC.vn(item.SaleRate ? item.SaleRate : item.SalesRate)),
        PurchaseRate:    CC.f2(CC.vn(item.PurRate)),
        _origSaleRate:   CC.f2(CC.vn(item.SaleRate ? item.SaleRate : item.SalesRate)),
        TaxPercent:      CC.f2(CC.vn(item.GST)),
        CESSPer:         CC.f2(CC.vn(item.CESS)),
        SPLCESS:         CC.f2(CC.vn(item.SPLCESS)),
        UOM:             item.UOM || "",
        UOMDecimal:      item.UOMDecimal || 0,
        HSNCode:         item.HSNCode || "",
        StockQty:        CC.vn(item.Stock),
        SalesRateType:   item.SaleRateType,
        NegativetStock:  !!item.NegativetStock,
        NStock:          item.Nstock || 0,
        DiscountPercent: CC.f2(CC.vn(item.SaleDiscountPer)),
        CRMPoints:       item.CRMPoints ? 1 : 0,
       StockQtyNew: "1",
        ItemQty:         "1",
        _dirty: true,
      };
      setStockLbl(CC.vn(item.Stock).toFixed(0));
     return calcSaleRow(newRow); 
    }));
    setProdPopup(null);

    // setTimeout(() => {
    //   const defaultCols = visCols
    //     .map(vc => CC.SB_COLUMNS.find(c => c.key === vc.key))
    //     .filter(Boolean)
    //     .filter(cd => !cd.readOnly)
    //     .map(cd => cd.key);

    //   const COLS = focusColsRef.current.length > 0
    //     ? focusColsRef.current.filter(k => defaultCols.includes(k))
    //     : defaultCols;

    //   const pcIdx  = COLS.indexOf("ProductCode");
    //   const nextCol = pcIdx >= 0 && pcIdx < COLS.length - 1 ? COLS[pcIdx + 1] : "ItemQty";
    //   const el = cellRefs.current[rid]?.[nextCol];
    //   if (el) { el.focus(); el.select?.(); }
    // }, 50);
    setTimeout(() => goToNextField(rid, "ProductCode"), 50);
  }, [sess, visCols, goToNextField]);

  // ── Fetch product by code ──────────────────────────────────────────────────
  const fetchProductByCode = useCallback(async (rid, code) => {
    if (!code.trim()) return;
    const payload = {
      code: code.trim().toUpperCase(),
      Comid: sess.MComid, CComid: sess.Comid,
      Id: 0, Batchwise: 1,
    };
    const res = await CC.api(CC.SO_SelectItemByCodeUrl, null, {}, payload);
    if (redirectIfDualLogin(res)) return;
    const arr = Array.isArray(res.data) ? res.data
              : Array.isArray(res.Data1) ? res.Data1 : [];
    if (arr.length === 0) { toast("❌ Invalid Product Code", true); return; }

    if (arr[0]?.BatchStatus === 1 || arr[0]?.BatchwiseStock === 1) {
      if (arr.length === 1 && arr[0].BatchNo === code.trim().toUpperCase()) {
        fillBatchItemIntoRow(rid, arr[0]);
      } else {
        batchListRef.current = arr;
        setBatchPopup({ rid, batches: arr });
      }
      return;
    }

    if (arr.length === 1) {
      fillItemIntoRow(rid, arr[0]);
      if (arr[0].ManufactureDate === 1 || arr[0].ExpriyDate === 1) {
        try {
          const expRes = await CC.api(CC.SelectExpiryByIdUrl, null, {}, { Id: arr[0].Id, Comid: sess.MComid });
          const expList = Array.isArray(expRes.data) ? expRes.data
                        : Array.isArray(expRes.Data1) ? expRes.Data1 : [];
          if (expList.length > 0) setExpiryListPopup({ rid, list: expList });
        } catch {}
      }
    } else {
      setProdList(arr);
      setProdPopup({ rid, pos: { top: 200, left: 80 } });
    }
  }, [sess, fillItemIntoRow]);

  const fillBatchItemIntoRow = useCallback(async (rid, batchItem) => {
    setRows(prev => prev.map(r => {
      if (r._rid !== rid) return r;
      const newRow = {
        ...r,
        ProductRefId:    batchItem.Id,
        ProductCode:     batchItem.ProductCode,
        ProductName:     tamilMode ? (batchItem.PrinterName || batchItem.ProductName) : batchItem.ProductName,
        PrinterName:     batchItem.PrinterName || "",
        _origSaleRate:   CC.f2(CC.vn(batchItem.SalesRate || batchItem.SaleRate)),
        MRP:             CC.f2(CC.vn(batchItem.MRP)),
        SaleRate:        CC.f2(CC.vn(batchItem.SalesRate || batchItem.SaleRate)),
        PurchaseRate:    CC.f2(CC.vn(batchItem.PurchaseRate)),
        TaxPercent:      CC.f2(CC.vn(batchItem.GST)),
        CESSPer:         CC.f2(CC.vn(batchItem.CESS)),
        SPLCESS:         CC.f2(CC.vn(batchItem.SPLCESS)),
        UOM:             batchItem.UOM || "",
        UOMDecimal:      batchItem.UOMDecimal || 0,
        HSNCode:         batchItem.HSNCode || "",
        StockQty:        CC.vn(batchItem.Stock),
        BatchRefid:      batchItem.Batchid || null,
        Bat_No:          batchItem.BatchNo || "",
        SalesRateType:   batchItem.SaleRateType,
        DiscountPercent: CC.f2(CC.vn(batchItem.SaleDiscountPer)),
        CRMPoints:       batchItem.CRMPoints ? 1 : 0,
        ItemQty:         "1",
        _dirty: true,
      };
      setStockLbl(CC.vn(batchItem.Stock).toFixed(0));
       return calcSaleRow(newRow); 
    }));
    setBatchPopup(null);

    if (batchItem.ManufactureDate === 1 || batchItem.ExpriyDate === 1) {
      try {
        const expRes = await CC.api(CC.SelectExpiryByIdUrl, null, {}, { Id: batchItem.Id, Comid: sess.MComid });
        const expList = Array.isArray(expRes.data) ? expRes.data
                      : Array.isArray(expRes.Data1) ? expRes.Data1 : [];
        if (expList.length > 0) setExpiryListPopup({ rid, list: expList });
      } catch {}
    }

    setTimeout(() => goToNextField(rid, "ProductCode"), 50);
  }, [sess, visCols, goToNextField]);

  // ── Cell change ────────────────────────────────────────────────────────────
  const handleCellChange = useCallback((rid, colKey, value) => {
    setRows(prev => prev.map(r => {
      if (r._rid !== rid) return r;
      if (colKey === "ItemQty") {
        if (exceedsDecimalLimit(value, r.UOMDecimal)) {
          return r;
        }
      }
      const updated = { ...r, [colKey]: value, _dirty: true };
      if (["ItemQty","SaleRate","TaxPercent","CESSPer","SPLCESS","DiscountPercent","CDPercent"].includes(colKey)) {
        return calcSaleRow(updated);
      }
      return updated;
    }));
  }, []);

  const handleSaleRateBlur = useCallback((rid) => {
    const row = rowsRef.current.find(r => r._rid === rid);
    if (!row?.SalesRateType) return;
    const newRate  = CC.f2(CC.vn(row.SaleRate));
    const origRate = CC.f2(CC.vn(row._origSaleRate ?? row.SaleRate));
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
    setPw({ title: " Sale Rate Change Password" });
    setRows(prev => prev.map(r => {
      if (r._rid !== rid) return r;
      return calcSaleRow({ ...r, SaleRate: origRate, _dirty: true });
    }));
  }, []);

  // ── Load product list ──────────────────────────────────────────────────────
  const loadProductsForPopup = useCallback(async (rid) => {
    if (prodList.length > 0) { setProdPopup({ rid, pos: { top: 160, left: 80 } }); return; }
    setLoading(true); setLdMsg("Loading products...");
    const res = await CC.api(CC.SO_ProductListUrl, null, {}, { Comid: sess.Comid });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    const arr = Array.isArray(res.data) ? res.data : Array.isArray(res.Data1) ? res.Data1 : Array.isArray(res) ? res : [];
    setProdList(arr);
    setProdPopup({ rid, pos: { top: 160, left: 80 } });
  // eslint-disable-next-line
  }, [sess, prodList]);

  // ── Cell keydown ───────────────────────────────────────────────────────────
  const handleCellKeyDown = useCallback((e, rid, colKey) => {
    const COLS = getRowEnabledCols(rid);
    const colIdx = COLS.indexOf(colKey);
    const rowIdx = rowsRef.current.findIndex(r => r._rid === rid);

    // const focusCell = (targetRid, targetKey) => {
    //   setTimeout(() => {
    //     const el = cellRefs.current[targetRid]?.[targetKey];
    //     if (el) { el.focus(); el.select?.(); }
    //   }, 10);
    // };
   const focusCell = (targetRid, targetKey) => {
  if (targetKey === "ItemQty") {
    const r = rowsRef.current.find(x => x._rid === targetRid);
    if (r && CC.vn(r.ItemQty) === 0) {
      setRows(prev => prev.map(row =>
        row._rid === targetRid
          ? calcSaleRow({ ...row, ItemQty: "1", _dirty: true })
          : row
      ));
    }
  }
  setTimeout(() => {
    const el = cellRefs.current[targetRid]?.[targetKey];
    if (el) { el.focus(); el.select?.(); }
  }, 10);
};

    const advanceFocus = () => {}; // REMOVED

    // SaleRate ArrowRight — password check
    if (e.key === "ArrowRight" && colKey === "SaleRate") {
      const curRow = rowsRef.current.find(r => r._rid === rid);
      if (curRow?.SalesRateType) {
        const newRate  = CC.f2(CC.vn(curRow.SaleRate));
        const origRate = CC.f2(CC.vn(curRow._origSaleRate ?? curRow.SaleRate));
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
              goToNextField(rid, colKey);
            }, 30);
          };
          setRows(prev => prev.map(r => {
            if (r._rid !== rid) return r;
            return calcSaleRow({ ...r, SaleRate: origRate, _dirty: true });
          }));
          setPw({ title: " Sale Rate Change Password" });
          return;
        }
      }
    }

    // SaleRate Enter/Tab — password check
    if ((e.key === "Enter" || e.key === "Tab") && colKey === "SaleRate") {
      e.preventDefault();
      const curRow = rowsRef.current.find(r => r._rid === rid);
      if (!curRow?.SalesRateType) {
        goToNextField(rid, colKey);
        return;
      }
      const newRate  = CC.f2(CC.vn(curRow.SaleRate));
      const origRate = CC.f2(CC.vn(curRow._origSaleRate ?? curRow.SaleRate));
      if (newRate === origRate) {
        goToNextField(rid, colKey);
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
          goToNextField(rid, colKey);
        }, 30);
      };
      setRows(prev => prev.map(r => {
        if (r._rid !== rid) return r;
        return calcSaleRow({ ...r, SaleRate: origRate, _dirty: true });
      }));
      setPw({ title: " Sale Rate Change Password" });
      return;
    }

    // ItemQty Enter/Tab — same-line merge check
    if ((e.key === "Enter" || e.key === "Tab") && colKey === "ItemQty") {
      e.preventDefault();
      const curRow = rowsRef.current.find(r => r._rid === rid);
      if (!curRow?.ProductRefId) return;
      const qty = CC.vn(curRow.ItemQty);
      if (qty === 0) return;

      const duplicate = rowsRef.current.find(r =>
        r._rid !== rid &&
        r.ProductRefId === curRow.ProductRefId &&
        CC.f2(CC.vn(r.SaleRate)) === CC.f2(CC.vn(curRow.SaleRate)) &&
        !r._isFree
      );

      if (duplicate) {
        const mergedQty = CC.f2(CC.vn(duplicate.ItemQty) + qty);
        setRows(prev => {
          const updated = prev.map(r => {
            if (r._rid !== duplicate._rid) return r;
            return calcSaleRow({ ...r, ItemQty: String(mergedQty), _dirty: true });
          }).filter(r => r._rid !== rid);
          return updated.length === 0 ? [mkRow()] : updated;
        });
        setTimeout(() => {
          const el = cellRefs.current[duplicate._rid]?.["ItemQty"];
          if (el) { el.focus(); el.select?.(); }
        }, 60);
        return;
      }
    }

    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      if (colKey === "ProductCode") {
        const row = rowsRef.current.find(r => r._rid === rid);
        if (row?.ProductCode?.trim()) fetchProductByCode(rid, row.ProductCode);
        else loadProductsForPopup(rid);
        return;
      }
      goToNextField(rid, colKey);
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
    if (e.key === "Delete") { e.preventDefault(); doDeleteRow(rid); }
    if (e.key === " " && colKey === "ProductCode") {
      e.preventDefault(); loadProductsForPopup(rid);
    }
  // eslint-disable-next-line
  }, [visCols, fetchProductByCode, loadProductsForPopup, goToNextField, getRowEnabledCols]);

  // ── Delete row ────────────────────────────────────────────────────────────
  const doDeleteRow = useCallback(async (rid) => {
    const ok = await confirm("Do you want to Delete this Row?");
    if (!ok) return;
    setRows(prev => {
      const next = prev.filter(r => r._rid !== rid);
      return next.length === 0 ? [mkRow()] : next;
    });
  }, [confirm]);

  // ── Bill discount ─────────────────────────────────────────────────────────
  const applyBillDiscount = useCallback(() => {
    const per = CC.vn(discPer);
    if (!per) return;
    setRows(prev => prev.map(r => {
      if (!r.ProductRefId || !CC.vn(r.ItemQty)) return r;
      return calcSaleRow({ ...r, DiscountPercent: per, _dirty: true });
    }));
  }, [discPer]);

  // ── Clear form ────────────────────────────────────────────────────────────
  const clearForm = useCallback(async () => {
    origCrmRef.current = { OpeningPoint: 0, OpeningValue: 0 };
    unlockedRidRef.current = null;
    setEditId(0);
    setCustId(""); setCustMobile(""); setSmId(""); setRemarks(""); setBillHoldName("");
    setOtherPlus(""); setOtherMinus(""); setDiscPer("");
    setCrmValue("0.00"); setCurBal("0.00"); setStockLbl("0.00");
    setCustCardRefId("0"); setCrmPointRate(0); setCrmValueRate(0);
    setCustOpCrmPoints(0); setCustOpCrmValue(0);
    setRows([mkRow()]);
    setPayRows(pr => pr.map(r => ({ ...r, Amount: "" })));
    setSelRid(null);
    await loadBillNo();
    setTimeout(() => {
      const firstRow = rowsRef.current[0];
      if (firstRow) cellRefs.current[firstRow._rid]?.["ProductCode"]?.focus();
    }, 100);
  }, [loadBillNo]);

  
  const buildPrintDetails = useCallback(() => {
    return new URLSearchParams({
      BillFormatName: sess.BillFormatName,
      EBillFormatName: sess.BillFormatName,
      CompanyName:    sess.CompanyName,
      Address1:       sess.Address1,
      Address2:       sess.Address2,
      City:           sess.City,
      Pincode:        sess.Pincode,
      MobileNo:       sess.Phone,
      GSTNO:          sess.GSTNo,
      Email:          sess.Email,
      Year:           sess.YearName,
      StateCode:      sess.StateCode,
      StateName:      "",
      SaleCon1:       sess.POSLine1,
      SaleCon2:       sess.POSLine2,
      SaleCon3:       sess.POSLine3,
      SaleCon4:       sess.POSLine4,
      SaleCon5:       sess.POSLine5,
      NoofBills:      sess.No_Of_Bills,
      Bank1:          sess.BankLine1,
      Bank2:          sess.BankLine2,
      Bank3:          sess.BankLine3,
      Bank4:          sess.BankLine4,
      Bank5:          sess.BankLine5,
      FromEmailId:    "keykassapos@gmail.com",
      FromEmailPwd:   "rlreahjhtwhpkelf",
    }).toString();
  }, [sess]);

  /**
   * callA4PrintApi — mirrors JS BillPrint() → /Sale/A4Print POST
   * This stores the sale data into Session so ReportViewer can read it.
   *
   * @param {object} saleData  — the sale master object (from InsertSale response)
   * @param {number} whatsapp  — 0 = view/print, 1 = whatsapp
   */
  const callA4PrintApi = useCallback(async (saleData, whatsapp = 0) => {
    const printDetails = {
      BillFormatName: sess.BillFormatName,
      CompanyName:    sess.CompanyName,
      Address1:       sess.Address1,
      Address2:       sess.Address2,
      City:           sess.City,
      Pincode:        sess.Pincode,
      MobileNo:       sess.Phone,
      GSTNO:          sess.GSTNo,
      Email:          sess.Email,
      StateCode:      sess.StateCode,
      StateName:      "",
      SaleCon1:       sess.POSLine1,
      SaleCon2:       sess.POSLine2,
      SaleCon3:       sess.POSLine3,
      SaleCon4:       sess.POSLine4,
      SaleCon5:       sess.POSLine5,
      NoofBills:      sess.No_Of_Bills,
      Bank1:          sess.BankLine1,
      Bank2:          sess.BankLine2,
      Bank3:          sess.BankLine3,
      Bank4:          sess.BankLine4,
      Bank5:          sess.BankLine5,
      FromEmailId:    "keykassapos@gmail.com",
      FromEmailPwd:   "rlreahjhtwhpkelf",
      Comid:          parseInt(sess.Comid) || 1,
      WhatsAppApi:    whatsapp,
      WhatsAppURL:    "",
    };

    try {
      const res = await fetch(`${CC.BASE_URL}${CC.A4PrintUrl}`, {
       
        method: "POST",
        headers: {
          "Content-Type":  "application/json; charset=utf-8",
          "Printdetails":  JSON.stringify(printDetails),
          ...CC.authHeaders(),
        },
        body: JSON.stringify(saleData),
      });
      const data = await res.json();
         
      return data?.ok === true;
    } catch (err) {
      console.error("A4Print API error:", err);
      return false;
    }
  }, [sess]);

  /**
   * openReportViewer — opens ReportViewer.aspx with correct params
   * autoPrint=true  → small window, triggers btnPrint click (direct print)
   * autoPrint=false → full window (view mode)
   */
const openReportViewer = useCallback((
  autoPrint = false,
  copy = "Original",
  cacheKey = ""
) => {
  const printDetails = buildPrintDetails();
  const A4Print = autoPrint ? "1" : "0";

  const url = `${BASE_URL}/Reports/ReportViewer.aspx` +
              `?ReportName=SaleInvoice` +
              `&Copy=${copy}` +
              `&A4Print=${A4Print}` +
              `&MailSendStatus=0` +
              `&CacheKey=${encodeURIComponent(cacheKey)}` +
              `&${printDetails}`;

  if (autoPrint) {
    const w = window.open(url, "_blank",
      `width=25,height=25,toolbar=0,menubar=0,status=0`);
    if (w) {
      w.addEventListener("load", () => {
        setTimeout(() => {
          w.document.getElementById("btnPrint")?.click();
          w.close();
        }, 100);
      });
    }
  } else {
    window.open(url, "_blank",
      `width=${screen.width},height=${screen.height - 100},toolbar=0`);
  }
}, [buildPrintDetails]);

  // ── Save ──────────────────────────────────────────────────────────────────
// ── Save ──────────────────────────────────────────────────────────────────
const doSave = useCallback(async (isCashBill = false, overridePayRows = null) => {
  if (!perm.Add && !perm.Edit) { toast("❌ Permission Denied", true); return; }
  const validRows = rows.filter(r => r.ProductRefId && CC.vn(r.ItemQty) > 0);

  if (validRows.length === 0) { toast("❌ Add at least one item", true); return; }
  const stockDetails = editId > 0
    ? validRows
        .filter(r => r._origItemQty && CC.vn(r._origItemQty) > 0)
        .map(r => ({
          ProductRefid: r.ProductRefId,
          Batchid: r._origBatchRefid || 0,
          RealQty: CC.f2(CC.vn(r._origItemQty)),
          Qty: 0.0,
          MfDate: toMMDDYYYY(r._origMfgDate),
          ExpDate: toMMDDYYYY(r._origExpiryDate),
          SerialNoStatus: 0,
          AdjustType: 0,
          PDRefid: r._origPDRefid || null,
          ItemQty: CC.f2(CC.vn(r._origItemQty)),
          Bags: CC.vn(r._origBags) || 0,
        }))
    : [];

  // ✅ FIX: overridePayRows வந்தா அதையே base-ஆ எடு, பழைய payRows state வேண்டாம்
  const basePayRows = overridePayRows || payRows;
  const totalPay   = basePayRows.reduce((s, r) => s + CC.vn(r.Amount), 0);
  const nonCashPay = basePayRows.filter(r => r.CardType !== "CASH").reduce((s, r) => s + CC.vn(r.Amount), 0);
  const cashOnly   = nonCashPay === 0;

  let effectivePayRows = basePayRows;

  // ✅ FIX: overridePayRows explicit-ஆ கொடுக்கப்பட்டா (F7 credit போன்ற cases),
  // auto-cash-fill logic-ஐ SKIP பண்ணு — caller already deliberate-ஆ set பண்ணிட்டாங்க
  if (!overridePayRows && (totalPay === 0 || isCashBill || cashOnly)) {
    const cashIdx = basePayRows.findIndex(r => r.CardType === "CASH");
    const idx     = cashIdx >= 0 ? cashIdx : 0;
    effectivePayRows = basePayRows.map((r, i) =>
      i === idx ? { ...r, Amount: totals.NetAmt.toFixed(2) } : { ...r, Amount: "" }
    );
    setPayRows(effectivePayRows);
  }

  const ok = await confirm("Do you want to Save Sale Bill Details?");
  if (!ok) return;

  setLoading(true); setLdMsg("Saving...");
  const username = localStorage.getItem("username") || "";
  const custObj  = customers.find(c => String(c.Id) === String(custId));

  const saledetails = validRows.map(r => ({
    SDId: r.SDId || 0, ProductRefId: r.ProductRefId, ProductCode: r.ProductCode,
    ProductName: r.ProductName, PrintName: r.PrinterName || r.ProductName,
    MRP: CC.f2(CC.vn(r.MRP)), SaleRate: CC.f2(CC.vn(r.SaleRate)), ItemQty: CC.f2(CC.vn(r.ItemQty)),
    Amount: CC.f2(CC.vn(r.Amount)), TaxPercent: CC.f2(CC.vn(r.TaxPercent)), TaxAmt: CC.f2(CC.vn(r.TaxAmt)),
    CESSPer: CC.f2(CC.vn(r.CESSPer)), CESSAmount: CC.f2(CC.vn(r.CESSAmount)),
    SPLCESS: CC.f2(CC.vn(r.SPLCESS)), SPLCESSAmount: CC.f2(CC.vn(r.SPLCESSAmount)),
    DiscountPercent: CC.f2(CC.vn(r.DiscountPercent)), DiscountAmt: CC.f2(CC.vn(r.DiscountAmt)),
    cdpercent: CC.f2(CC.vn(r.CDPercent)), cdAmount: CC.f2(CC.vn(r.CDAmount)),
    Landingcost: CC.f2(CC.vn(r.LandingCost)), CTAmount: CC.f2(CC.vn(r.CTAmount)),
    STAmount: CC.f2(CC.vn(r.STAmount)), PurchaseRate: CC.f2(CC.vn(r.PurchaseRate)),
    UOM: r.UOM || "", HSNcode: r.HSNCode || "", StockQty: CC.vn(r.StockQty),StockQtyNew:CC.f2(CC.vn(r.ItemQty)),
    BatchRefid: r.BatchRefid || null,
    ExpiryDate: r.ExpDate || r.ExpiryDate || null,
    MfgDate: r.MfgDate || null,
    SalesmanRefid: r.SalesManCode ? parseInt(r.SalesManCode) : (smId ? parseInt(smId) : null),
    SalesManCode:  r.SalesManCode ? parseInt(r.SalesManCode) : (smId ? parseInt(smId) : 0),
    FreeQty: 0, NOMS: 0, NOMSQty: 0,
    SaleRate_org: CC.f2(CC.vn(r.OrgRate)), remarks: r.Remarks || "",
     CRMPoints: CC.vn(r.CRMPoints) === 1 ? 1 : 0,
    SRDetailsId: r.SRDetailsId || 0, Bat_No: r.Bat_No || "",
  }));

  const payFiltered = effectivePayRows.filter(p => CC.vn(p.Amount) > 0).map(p => ({
    CardAccountRefId: p.CardAccountRefId, Saletype: p.Saletype,
    CardType: p.CardType, Amount: CC.f2(CC.vn(p.Amount)), SchargeAmt: CC.f2(CC.vn(p.SchargeAmt)),
    CustomerRefid: custId ? parseInt(custId) : parseInt(sess.CashId),
    BankRefid: p.BankRefid || null,
  }));

  let saleType     = "CASH";
  const hasCard    = payFiltered.some(p => p.CardType === "CARD"   && p.Amount > 0);
  const hasUPI     = payFiltered.some(p => p.CardType === "UPI"    && p.Amount > 0);
  const hasCredit  = payFiltered.some(p => p.CardType === "CREDIT" && p.Amount > 0);
  const hasCash    = payFiltered.some(p => p.CardType === "CASH"   && p.Amount > 0);
  const typeCount  = [hasCard, hasUPI, hasCredit, hasCash].filter(Boolean).length;
  if (typeCount > 1)  saleType = "SPLIT";
  else if (hasCard)   saleType = "CARD";
  else if (hasUPI)    saleType = "UPI";
  else if (hasCredit) saleType = "CREDIT";
// ✅ சரி — Sale.js logic exact-ஆ replicate பண்ணுங்க
// row-level CRMPoints flag ==1 ஆன rows மட்டும் சேருங்க (ItemwiseCRMPoint setting இங்க பொருந்தாது)
const crmBillAmount = validRows.reduce(
  (sum, r) => sum + (CC.vn(r.CRMPoints) === 1 ? CC.vn(r.Amount) : 0),
  0
);
  // const crmBillAmount = sess.ItemwiseCRMPoint
  //   ? validRows.reduce((sum, r) => sum + (CC.vn(r.CRMPoints) > 0 ? CC.vn(r.Amount) : 0), 0)
  //   : validRows.reduce((sum, r) => sum + CC.vn(r.Amount), 0);
  const {
    curBal: refCurBal,
    custCardRefId: refCustCardRefId,
    crmPointRate: refCrmPointRate,
    crmValueRate: refCrmValueRate,
    custOpCrmPoints: refCustOpCrmPoints,
    custOpCrmValue: refCustOpCrmValue
  } = custMetaRef.current;

  const usedCRMPointRow = payFiltered.find(p => String(p.CardType).toUpperCase() === "CRMPOINTS");
  const usedValue = usedCRMPointRow ? CC.vn(usedCRMPointRow.Amount) : 0;
  const usedPoint = refCrmValueRate > 0 ? CC.f2((usedValue * refCrmPointRate) / refCrmValueRate) : 0;
  
  const paidAmount = payFiltered.reduce((sum, p) => sum + CC.vn(p.Amount), 0);

  const subSalemasterFlag = (
    refCrmPointRate !== 0 ||
    sess.BillPrintClosingBalance ||
    sess.PrintA4 ||
    sess.SaleSubMaster
  ) ? "1" : "0";

const saleMaster1 = subSalemasterFlag === "1" ? {
    OpeningBalance: CC.vn(refCurBal),
    ClosingBalance: CC.vn(refCurBal) + totals.NetAmt - paidAmount,
    PaidAmount: 0,
    BillAmount: 0,
    DriverName: "",
    CourierName: "",
    CourierNo: "",
    VehicleNo: "",
    DCustomerName: "",
    DAddress1: "",
    DAddress2: "",
    DCity: "",
    DPhoneNo: "",
    DPincode: "",
    CustomerName: custObj?.AccountName || "",
    Address1: custObj?.Address1 || "",
    Address2: custObj?.Address2 || "",
    City: custObj?.City || "",
    Email: custObj?.Email || "",
    PhoneNo: custObj?.MobileNo || "",
    Pincode: custObj?.Pincode || "",
    TinNo: custObj?.GSTINNo || "",
    IGSTBill: custObj?.IGSTBill || "GST",
    PONO: "",
    DCNo: "",
    DCDate: "",
    WorkingDate: "",
    LRDate: "",
    TransportName: "",
    Through: "",
    BillSaleType: "",
    PONoDateNew: "",
    OpeningPoint: refCustOpCrmPoints - origCrmRef.current.OpeningPoint,
    OpeningValue: refCustOpCrmValue - origCrmRef.current.OpeningValue,
    UsedPoint: usedPoint,
    UsedValue: usedValue,
    CRMPoint: refCrmPointRate,
    CRMValue: refCrmValueRate,
    CRMValueSingle: sess.CRMValueSingle,
    CRMBillAmount: crmBillAmount,
    ShippingName: "",
    ShippingAddress1: "",
    ShippingAddress2: "",
    ShippingCity: "",
    ShippingPhone: "",
    ShippingPincode: "",
    TCSPer: 0,
    TCSAmt: 0,
    LorryNo: "",
    EwbNo: "",
    LRNo: "",
} : undefined;
const cdAmountTotal = validRows.reduce((s, r) => s + CC.vn(r.CDAmount), 0);

const payload = [{
    Id: editId, SRId: 0,
    CustomerCardRefid: refCustCardRefId ? parseInt(refCustCardRefId) : 0,
    ...(saleMaster1 ? { SaleMaster1: saleMaster1 } : {}),
    CustomerRefId: custId ? parseInt(custId) : parseInt(sess.CashId),
    SaleNo: 0, CompanyRefId: parseInt(sess.Comid),
    SaleNoDisplay: billNo, SaleDate: billDate, SaleType: saleType,
    OthersplusAmt: CC.vn(otherPlus), OtherssubAmt: CC.vn(otherMinus),
    Grossamt: totals.GrossAmt, taxamount: totals.GSTAmt,
    CESSAmount: totals.CESSAmt, SPLCESSAmount: 0,
    SalesReturnAmt: 0,
    DeleteStatus: 1,
    ShiftCode: 0,
    OpeningBalCmbt: CC.vn(refCurBal),
    Duedate: billDate,
    disper: CC.vn(discPer), discamount: totals.DiscAmt,
    cdamount: CC.f2(cdAmountTotal),
    Cashtender: paidAmount.toFixed(2),
    Cashrecevier: paidAmount.toFixed(2),
    schargePer: 0,
    OldBillAmount: 0,
    TodaySaving: 0,
    NetAmount: Math.round(CC.vn(totals.NetAmt)), coinage: 0, Remarks: remarks,
    CashierRefId: parseInt(sess.CashierId) || 0,
    salesmanRefId: smId ? parseInt(smId) : null,
    BillFormatName: sess.BillFormatName,
    BillHoldName: billHoldName,
    CustomerName: custObj?.AccountName || "",
    Address1: custObj?.Address1 || "", Address2: custObj?.Address2 || "",
    City: custObj?.City || "", Email: custObj?.Email || "",
    PhoneNo: custObj?.MobileNo || "", Pincode: custObj?.Pincode || "",
    StateCode: custObj?.StateCode || "", StateName: custObj?.StateName || "",
    MobileNo: sess.Phone || "",
    TinNo: custObj?.GSTINNo || "", IGSTBill: custObj?.IGSTBill || "GST",
    Credit: hasCredit ? payFiltered.find(p => p.CardType === "CREDIT")?.Amount || 0 : 0,
    Modified_By: username,
    ModifiedStatus: editId > 0 ? 1 : 0, Modified_Date: billDate,
    SaleDetails: saledetails, SaleAmountDetails: payFiltered,
    StockDetails: stockDetails, srstockdetails: [],
}];
  // const payload = [{
  //   Id: editId, SRId: 0,
  //   CustomerCardRefid: refCustCardRefId ? parseInt(refCustCardRefId) : 0,
  //   ...(saleMaster1 ? { SaleMaster1: saleMaster1 } : {}),
  //   CustomerRefId: custId ? parseInt(custId) : parseInt(sess.CashId),
  //   SaleNo: 0, CompanyRefId: parseInt(sess.Comid),
  //   SaleNoDisplay: billNo, SaleDate: billDate, SaleType: saleType,
  //   OthersplusAmt: CC.vn(otherPlus), OtherssubAmt: CC.vn(otherMinus),
  //   Grossamt: totals.GrossAmt, taxamount: totals.GSTAmt,
  //   CESSAmount: totals.CESSAmt, SPLCESSAmount: 0,
  //   disper: CC.vn(discPer), discamount: totals.DiscAmt,
  //   NetAmount: totals.NetAmt, coinage: 0, Remarks: remarks,
  //   CashierRefId: parseInt(sess.CashierId) || 0,
  //   salesmanRefId: smId ? parseInt(smId) : null,
  //   DeleteStatus: true, BillHoldName: billHoldName,
  //   CustomerName: custObj?.AccountName || "",
  //   Address1: custObj?.Address1 || "", Address2: custObj?.Address2 || "",
  //   City: custObj?.City || "", Email: custObj?.Email || "",
  //   PhoneNo: custObj?.MobileNo || "", Pincode: custObj?.Pincode || "",
  //   TinNo: custObj?.GSTINNo || "", IGSTBill: custObj?.IGSTBill || "GST",
  //   Credit: hasCredit ? payFiltered.find(p => p.CardType === "CREDIT")?.Amount || 0 : 0,
  //   Modified_By: username,
  //   ModifiedStatus: editId > 0 ? 1 : 0, Modified_Date: billDate,
  //   SaleDetails: saledetails, SaleAmountDetails: payFiltered, StockDetails:stockDetails,
  // }];

  const headers = {
    "Comid":      String(sess.Comid), "ApiType": "1", "LocalV7": "0",
    "cashid":     String(sess.CashId), "BillType": sess.BillNoType,
    "BillPerfix": sess.BillNoPrefix, "BillHoldName": billHoldName,
    "BillDigit":  String(sess.BillNoDigit), "EncashAmt": "0", "EncashPoint": "0",
    "SubSalemaster":             subSalemasterFlag,
    "React":                     1,
    "Commoncompany":             sess.CommonCompany ? "true" : "false",
    "CommoncompanyDiffStock":    sess.CommonCompanyDiffStock ? "true" : "false",
    "MulipleMRP":                sess.MulipleMRP ? "true" : "false",
    "Herballife":                sess.Herbalife ? "1" : "0", "Estimate": "0",
    "PrintA4Invoice":            sess.PrintA4 ? "1" : "0",
    "SmallPrint":                sess.PrintSmall ? "1" : "0",
    "BillFormat":                sess.BillFormatName,
    "DayClose":                  sess.DayClose ? "1" : "0",
    "MirrorTable": "0", "LocalDB": "0", "RO": "0",
  };
  console.log(payload);
  console.log("stockDetails going to payload:", stockDetails);
  const res = await CC.insertapi(CC.SaleInsertUrl, payload, headers);
  setLoading(false);
  if (redirectIfDualLogin(res)) return;

  if (res.ok ?? res.IsSuccess) {
    localStorage.setItem("lastBillNo",  billNo);
    const roundedNet = Math.round(CC.vn(totals.NetAmt));
    localStorage.setItem("lastBillAmt", roundedNet.toString());
    setLastBillNo(billNo);
    setLastBillAmt(roundedNet);
    toast("✅ Bill Saved");

    const cacheKey = res.Data15 || "";
    setPrintDialog({
      billNo:   res.BillNo || res.Data2 || billNo,
      netAmt:   roundedNet,
      cacheKey: cacheKey,
    });

    await clearForm();
  } else {
    toast("❌ " + (res.Message || res.message || "Save Failed"), true);
  }
// eslint-disable-next-line
}, [perm, confirm, clearForm, sess, payRows, totals, rows,
    custId, smId, remarks, billNo, billDate, editId, otherPlus, otherMinus,
    discPer, customers, billHoldName, callA4PrintApi]);
    

  const doCreditSave = useCallback(async () => {
    if (totals.NetAmt <= 0) {
      toast("❌ Add at least one item", true);
      return;
    }

    let creditIdx = payRows.findIndex(r => r.CardType === "CREDIT");
    if (creditIdx === -1) creditIdx = payRows.length - 1;

    if (!custId || String(custId) === "0" || String(custId) === String(sess.CashId)) {
      toast("❌ Select Any One Customer !!!", true);
      if (custRef.current) custRef.current.focus();
      return;
    }

    const updated = payRows.map((r, idx) =>
      idx === creditIdx
        ? { ...r, Amount: totals.NetAmt.toFixed(2) }
        : { ...r, Amount: "" }
    );

    setPayRows(updated);
    await doSave(false, updated);
  }, [totals.NetAmt, payRows, custId, sess.CashId, toast, doSave]);

  // ── Delete bill ───────────────────────────────────────────────────────────
  // ── Date formatter: yyyy-MM-dd (or ISO date) -> MM/dd/yyyy ────────────────
  const toMMDDYYYY = (dateStr) => {
    if (!dateStr) return "";

    const parts = String(dateStr).slice(0, 10).split("-");

    if (parts.length !== 3) return "";

    const [yyyy, mm, dd] = parts;

    return `${mm}/${dd}/${yyyy}`;
  };

  const buildStockRestoreDetails = useCallback((sourceRows) => {
    return sourceRows
      .filter(r => CC.vn(r._origItemQty ?? r.ItemQty) > 0)
      .map(r => ({
        ProductRefid: r.ProductRefId || 0,
        Batchid: r._origBatchRefid || r.BatchRefid || 0,
        RealQty: CC.f2(CC.vn(r._origItemQty ?? r.ItemQty)),
        Qty: 0.0,
        MfDate: toMMDDYYYY(r._origMfgDate || r.MfgDate),
        ExpDate: toMMDDYYYY(r._origExpiryDate || r.ExpiryDate),
        SerialNoStatus: 0,
        AdjustType: 0,
        PDRefid: r._origPDRefid || r.PDRefid || null,
        ItemQty: CC.f2(CC.vn(r._origItemQty ?? r.ItemQty)),
        Bags: CC.vn(r._origBags ?? r.Pcs) || 0,
      }));
  }, []);

  const doDeleteBill = useCallback(async () => {
    if (!editId) { toast("No bill to delete", true); return; }
    if (!perm.Delete) { toast("❌ Delete Permission Denied", true); return; }
    const ok = await confirm("Do you want to Cancel this Bill?");
    if (!ok) return;
    setLoading(true);
    const stockDetails = buildStockRestoreDetails(rows);
    const headers = {
      Comid: String(sess.Comid), Cid: String(sess.CashierId), SRId: "0",
      BillType: sess.BillNoType, SRStockDetails: JSON.stringify(srdetailsRef.current),
      Reason: "", Estimate: "0", MirrorTable: "0", Updateid: "",
      LocalDB: "0", DayClose: sess.DayClose ? "1" : "0",
      SaleDate: billDate, Id: String(editId),
    };
    const res = await CC.api(CC.SaleDeleteUrl, stockDetails, headers, null);
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res.ok ?? res.IsSuccess) { toast("✅ Bill Deleted Successfully"); await clearForm(); }
    else toast("❌ " + (res.message || res.Message || "Delete Failed"), true);
  // eslint-disable-next-line
  }, [editId, perm, confirm, sess, clearForm, rows, billDate, buildStockRestoreDetails]);

  // ── F5 view ───────────────────────────────────────────────────────────────
  const openF5 = useCallback(async (from = billDate, to = billDate) => {
    if (!perm.Edit) { toast("❌ Edit Permission Denied", true); return; }
    setLoading(true); setLdMsg("Loading bills...");
    const res = await CC.api(CC.F5SelectUrl, null, {}, {
      Comid: sess.Comid, Fromdate: from, Todate: to, Id: 0, Estimate: 0
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;

    const dataNode    = Array.isArray(res?.Data) ? res.Data[0]
                      : Array.isArray(res?.data) ? res.data[0] : {};
    const master      = dataNode?.salemaster        || [];
    const details     = dataNode?.saledetails       || [];
    const amtDetails  = dataNode?.saleamountdetails || [];

    setF5Rows(master);
    setF5Details(details);
    setF5AmtDetails(amtDetails);
    setF5Open(true);
  }, [sess, billDate, perm, redirectIfDualLogin]);
  const doEditBill = useCallback(async (id) => {
    setF5Open(false);
    if (!perm.Edit) { toast("❌ Edit Permission Denied", true); return; }
    setLoading(true); setLdMsg("Loading bill...");
    const res = await CC.api(CC.SaleEditUrl, null, {}, {
      Id: id, SaleNo: 0, Date: billDate, Comid: sess.Comid,
      Cid: 0, Estimate: 0, CustId: 0, Tamil: tamilMode ? true : false,
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (!(res.ok ?? res.IsSuccess)) { toast("❌ " + (res.message || "Load Failed"), true); return; }
    const data = Array.isArray(res.Data) ? res.Data[0] : res.data;
    if (!data) { toast("❌ No data found", true); return; }
    const saledetails = data[0].SaleDetails || [];
    console.log("Raw saledetails from API:", saledetails[0]);
    setEditId(data[0].Id || id);
    srdetailsRef.current = data[0].srdetails || [];
    setBillNo(CC.ns(data[0].SaleNoDisplay || data[0].SaleNo));
    setBillDate(String(data[0].SaleDate || "").slice(0, 10) || CC.today());
    const cid = CC.ns(data[0].CustomerRefId);
    setCustId(cid);
    const found = customers.find(c => String(c.Id) === cid);
    setCustMobile(found?.MobileNo || "");
    setSmId(CC.ns(data[0].salesmanRefId || ""));
    setRemarks(CC.ns(data[0].Remarks));
    setOtherPlus(CC.ns(data[0].OthersplusAmt || ""));
    setOtherMinus(CC.ns(data[0].OtherssubAmt || ""));
 const loadedRows = saledetails.map(r => calcSaleRow(fmtRow({
  ...mkRow(),
  ...r,
  _rid: CC.genRid(),
  _origItemQty: CC.vn(r.ItemQty),       // old qty தனியா store
  _origBatchRefid: r.BatchRefid || 0,
  _origMfgDate: r.MfgDate || "",
  _origExpiryDate: r.ExpiryDate || "",
  _origPDRefid: r.PDRefid || null,
  _origBags: r.Pcs || 0,
})));
setRows(loadedRows.length > 0 ? loadedRows : [mkRow()]);
    setRows(loadedRows.length > 0 ? loadedRows : [mkRow()]);

    const sm = data[0].SaleMaster1 || data[0].salemaster1 || data[0].Salemaster1;
    const smObj = Array.isArray(sm) ? sm[0] : sm;
    if (smObj) {
      const p = CC.vn(smObj.BillPoint !== undefined ? smObj.BillPoint : smObj.OpeningPoint);
      const uP = CC.vn(smObj.UsedPoint);
      const v = CC.vn(smObj.BillValue !== undefined ? smObj.BillValue : smObj.OpeningValue);
      const uV = CC.vn(smObj.UsedValue);
      origCrmRef.current = {
        OpeningPoint: p - uP,
        OpeningValue: v - uV
      };
    } else {
      origCrmRef.current = { OpeningPoint: 0, OpeningValue: 0 };
    }

    const saleAmts = (data[0].SaleAmountDetails || []).length > 0
      ? data[0].SaleAmountDetails
      : f5AmtDetails.filter(a => a != null && String(a.SaleRefId) === String(id));
    setPayRows(pr => pr.map(p => {
      const found = saleAmts.find(a => a.CardAccountRefId === p.CardAccountRefId);
      return found 
        ? { 
            ...p, 
            Amount: found.Amount > 0 ? CC.f2(found.Amount).toFixed(2) : "",
            BankRefid: found.BankRefid ?? p.BankRefid,
          } 
        : { 
            ...p, 
            Amount: "" 
          };
    }));
  // eslint-disable-next-line
  }, [sess, billDate, perm, customers]);
  const handleF5EditRequest = useCallback((id) => {
    setF5Open(false);
    pwOkRef.current = () => doEditBill(id);
    setPw({ title: "Edit Bill Password" });
  }, [doEditBill]);

  // ── Edit bill ─────────────────────────────────────────────────────────────


  const handleF5Delete = useCallback((id, billNo) => {
    pwOkRef.current = async () => {
      const ok = await confirm(`Do you want to Cancel Bill "${billNo}"?`);
      if (!ok) return;
      setLoading(true); setLdMsg("Deleting...");
      const editRes = await CC.api(CC.SaleEditUrl, null, {}, {
        Id: id, SaleNo: 0, Date: billDate, Comid: sess.Comid,
        Cid: 0, Estimate: 0, CustId: 0, Tamil: false,
      });
      if (redirectIfDualLogin(editRes)) return;
      const data      = Array.isArray(editRes.Data) ? editRes.Data[0] : editRes.data;
      const srDetails = data?.[0]?.srdetails || [];
      const saleDate  = String(data?.[0]?.SaleDate || billDate).slice(0, 10);
      const headers   = {
        Comid: String(sess.Comid), Cid: String(sess.CashierId), SRId: "0",
        BillType: sess.BillNoType, SRStockDetails: JSON.stringify(srDetails),
        Reason: "", Estimate: "0", MirrorTable: "0", Updateid: "",
        LocalDB: "0", DayClose: sess.DayClose ? "1" : "0",
        SaleDate: saleDate, Id: String(id),
      };
      const stockDetails = buildStockRestoreDetails(data?.[0]?.SaleDetails || []);
      const res = await CC.api(CC.SaleDeleteUrl, stockDetails, headers, null);
      setLoading(false);
      if (redirectIfDualLogin(res)) return;
      if (res.ok ?? res.IsSuccess) {
        toast("✅ Bill Deleted Successfully");
        const from = f5Rows[0] ? String(f5Rows[0].BillDate).slice(0, 10) : billDate;
        const to   = f5Rows[f5Rows.length-1] ? String(f5Rows[f5Rows.length-1].BillDate).slice(0, 10) : billDate;
        await openF5(from, to);
      } else {
        toast("❌ " + (res.message || res.Message || "Delete Failed"), true);
      }
    };
    setPw({ title: "Delete Password" });
  }, [sess, billDate, confirm, toast, redirectIfDualLogin, f5Rows, openF5, buildStockRestoreDetails]);

  // ── Bill hold ─────────────────────────────────────────────────────────────
  const doBillHold = useCallback(async () => {
    if (totals.NetAmt <= 0) {
      const res = await CC.api(CC.BillHoldSelectUrl, null, {}, { Cid: sess.CashierId, Comid: sess.Comid });
      if (redirectIfDualLogin(res)) return;
      const arr = Array.isArray(res.data) ? res.data : Array.isArray(res.Data1) ? res.Data1 : [];
      setHoldRows(arr); setHoldOpen(true); return;
    }
    const holdName = window.prompt("Enter Bill Hold Name", "");
    if (!holdName?.trim()) return;
    const saledetails = rows.filter(r => r.ProductRefId && CC.vn(r.ItemQty) > 0);
    setLoading(true);
    const res = await CC.insertapi(CC.BillHoldInsertUrl, saledetails, {
      "Comid": sess.Comid, "Cashierid": sess.CashierId,
      "CustomerRefid": custId || sess.CashId,
      "Holdname": holdName.trim().toUpperCase(),
      "Holddate": billDate,
    });
    setLoading(false);
    if (res.ok ?? res.IsSuccess) { toast("✅ Bill Hold Saved"); await clearForm(); }
    else toast("❌ " + (res.Message || "Hold Failed"), true);
  // eslint-disable-next-line
  }, [totals, sess, rows, custId, billDate, clearForm]);

  const loadHold = useCallback(async (name) => {
    setHoldOpen(false);
    const res = await CC.api(CC.BillUnHoldUrl, null, {}, { holdname: name.replace("&", "%26"), Cid: sess.CashierId, Comid: sess.Comid });
    if (redirectIfDualLogin(res)) return;
    const arr = Array.isArray(res.data) ? res.data : Array.isArray(res.Data1) ? res.Data1 : [];
    if (arr.length > 0) {
      const loaded = arr.map(r => calcSaleRow(fmtRow({ ...mkRow(), ...r, _rid: CC.genRid() })));
      setRows(loaded); setBillHoldName(name);
      if (arr[0].CustomerRefid) {
        const cid = CC.ns(arr[0].CustomerRefid);
        setCustId(cid);
        const found = customers.find(c => String(c.Id) === cid);
        setCustMobile(found?.MobileNo || "");
        handleCustomerChange(cid);
      }
    }
  // eslint-disable-next-line
  }, [sess, customers]);

  const deleteHold = useCallback(async (name) => {
    const ok = await confirm(`Delete hold "${name}"?`);
    if (!ok) return;
    const res = await CC.api(CC.BillHoldDeleteUrl, null, {}, { holdname: name, Cid: sess.CashierId, Comid: sess.Comid });
    if (res.ok ?? res.IsSuccess) { toast("✅ Deleted"); setHoldOpen(false); }
    else toast("❌ " + (res.message || "Failed"), true);
  }, [sess, confirm, toast]);

  const toggleTamilPrint = useCallback(() => {
    setTamilMode(prev => {
      const next = !prev;
      toast(next ? "✅ Tamil Print Enabled" : "✅ English Print Enabled");
      return next;
    });
  }, [toast]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = e => {
      if (e.repeat) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "t") {
        e.preventDefault();
        e.stopPropagation();
        toggleTamilPrint();
        return;
      }

      if (prodPopup || holdOpen || f5Open || pw || f12Open || custPopup || ctrlGOpen
          || batchPopup || expiryListPopup) return;

      if (e.key === "F1")  { e.preventDefault(); doSave(true); }
      if (e.key === "F2")  { e.preventDefault(); doSave(false); }
      if (e.key === "F7")  { e.preventDefault(); doCreditSave(); }
      if (e.key === "F4")  { e.preventDefault(); doBillHold(); }
      if (e.key === "F5")  { e.preventDefault(); openF5(); }
      if (e.key === "F8")  { e.preventDefault(); navigate("/EstimateBill"); }
      if (e.key === "F9")  { e.preventDefault(); if (!editId) return; pwOkRef.current = doDeleteBill; setPw({ title: "F9 Delete Password" }); }
      if (e.key === "F10") { e.preventDefault(); confirm("Do You Want To Clear?").then(ok => ok && clearForm()); }
      if (e.key === "F12") { e.preventDefault(); setF12Open(true); }
      if (e.key === "Escape") { e.preventDefault(); confirm("Do You Want To Quit?").then(ok => ok && navigate(-1)); }
      if (e.ctrlKey && e.key === "g") { e.preventDefault(); setCtrlGOpen(true); }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  // eslint-disable-next-line
  }, [prodPopup, holdOpen, f5Open, pw, f12Open, custPopup, ctrlGOpen,
      doSave, doCreditSave, doBillHold, openF5, doDeleteBill, clearForm, editId, toggleTamilPrint]);

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

      {/* ── PRINT DIALOG ── */}
      {printDialog && (
        <PrintChoiceDialog
         onPrint={async () => {
  setPrintDialog(null);
  const noOfBills = parseInt(sess.No_Of_Bills) || 1;
  for (let i = 0; i < noOfBills; i++) {
    const copy = i === 0 ? "Original" :
                 i === 1 ? "Duplicate Copy" : "Triplicate Copy";
    openReportViewer(true, copy, printDialog.cacheKey);
    await new Promise(r => setTimeout(r, 500));
  }
}}
onView={() => {
  setPrintDialog(null);
  openReportViewer(false, "Original", printDialog.cacheKey);
}}
          onSkip={() => setPrintDialog(null)}
        />
      )}

      <Topbar />

      <div className="sb-body">
        {/* ── Header panel ── */}
        <div className="sb-header-panel">
          <div className="sb-action-btns">
            <button className="sb-action-btn" onClick={() => doSave(true)}   title="F1 Cash Bill"><span className="btn-icon">🖨</span><span>F1</span></button>
            <button className="sb-action-btn" onClick={() => doSave(false)}  title="F2 Split Bill"><span className="btn-icon">💳</span><span>F2</span></button>
            <button className="sb-action-btn" onClick={doCreditSave} title="F7 Credit Bill"><span className="btn-icon">🧾</span><span>F7</span></button>
            <button className="sb-action-btn" onClick={() => { if (!editId) return; pwOkRef.current = doDeleteBill; setPw({ title: "F9 Delete" }); }} title="F9 Delete">
              <span className="btn-icon" style={{ color: "#dc2626" }}>🗑</span><span style={{ color: "#dc2626" }}>F9</span>
            </button>
            <button className="sb-action-btn" onClick={doBillHold}          title="F4 Bill Hold"><span className="btn-icon">📌</span><span>F4</span></button>
            <button className="sb-action-btn" onClick={clearForm}           title="F10 Clear"><span className="btn-icon">🔄</span><span>F10</span></button>
            <button className="sb-action-btn" onClick={() => setF12Open(true)} title="F12 Columns"><span className="btn-icon">⚙</span><span>F12</span></button>
          </div>

          <div className="sb-divider" />

          <div className="sb-fields-center">
            {billHoldName && <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a" }}>📌 Bill Hold: {billHoldName}</div>}

            {/* Customer row */}
            <div className="sb-field-row">
              <span className="sb-field-lbl">Customer</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
                <ComboBox
                  inputRef={custRef}
                  options={[
                    { value: "", label: "" },
                    ...customers.map(c => ({ value: String(c.Id), label: c.AccountName }))
                  ]}
                  value={custId}
                  onChange={handleCustomerChange}
                  onEnterKey={() => {
                    const firstRow = rowsRef.current[0];
                    if (firstRow) cellRefs.current[firstRow._rid]?.["ProductCode"]?.focus();
                  }}
                  placeholder="-- Select Customer --"
                />
                <button
                  onClick={() => setCustPopup(true)}
                  title="Search Customer (by Name / Mobile)"
                  style={{
                    width: 28, height: 28, flexShrink: 0,
                    background: "#1f65de", color: "#fff",
                    border: "none", borderRadius: 4, cursor: "pointer",
                    fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >🔍</button>
                <button
                  type="button"
                  className={`language-mode-badge ${tamilMode ? "tamil" : "english"}`}
                  onClick={toggleTamilPrint}
                  title="Click to switch Tamil / English"
                  aria-label={`Current language: ${tamilMode ? "Tamil" : "English"}. Click to switch language.`}
                >
                  {tamilMode ? "Tamil" : "English"}
                </button>
              </div>
              <span className="sb-field-lbl-sm" style={{ marginLeft: 8 }}>SalesMan</span>
              <ComboBox
                inputRef={smRef}
                options={[
                  { value: "", label: "" },
                  ...salesmen.map(s => ({ value: String(s.Id), label: s.SalesManName }))
                ]}
                value={smId}
                onChange={setSmId}
                onEnterKey={() => {
                  const firstRow = rowsRef.current[0];
                  if (firstRow) cellRefs.current[firstRow._rid]?.["ProductCode"]?.focus();
                }}
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
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: "#1f65de",
                    background: "#e8f0fe", borderRadius: 4, padding: "1px 8px",
                    border: "1px solid #c5d8f8",
                  }}>{custMobile}</span>
                </>
              )}
              <span className="sb-field-lbl-sm" style={{ marginLeft: 12 }}>Stock</span>
              <span className="sb-badge-red">{stockLbl}</span>
            </div>
          </div>

          <div className="sb-divider" />

          <div className="sb-bill-info">
            <div className="sb-bill-amount">₹{Math.round(CC.vn(totals.NetAmt))}</div>
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
                        const m       = CC.SB_COLUMNS.find(c => c.key === col.key) || {};
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
                                {isFloat && val ? CC.f2(val).toFixed(2) : CC.ns(val)}
                              </span>
                            ) : col.key === "ProductCode" ? (
                              <input
                                ref={el => regCell(row._rid, col.key, el)}
                                className="sb-cell-input"
                                value={CC.ns(val)}
                                onChange={e => handleCellChange(row._rid, col.key, e.target.value.toUpperCase())}
                                onKeyDown={e => handleCellKeyDown(e, row._rid, col.key)}
                                onFocus={() => setSelRid(row._rid)}
                                placeholder="Barcode"
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
                                onChange={e => handleCellChange(row._rid, col.key, e.target.value)}
                                onKeyDown={e => handleCellKeyDown(e, row._rid, col.key)}
                                onFocus={() => {
                                  setSelRid(row._rid);
                                  if (col.key === "SaleRate") unlockedRidRef.current = null;
                                }}
                                placeholder={isInt ? "0" : "0.00"}
                                style={{ width: "100%", boxSizing: "border-box" }}
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
              <div className="sb-pay-hdr">💳 Payment Settlement</div>
              <table className="sb-pay-tbl">
                <thead><tr><th>Payment Type</th><th className="right">Amount</th></tr></thead>
                <tbody>
                  {payRows.map((p, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 12, fontWeight: 600 }}>{p.Saletype}</td>
                      <td>
                        <input
                          className="sb-pay-input"
                          type="number"
                          step="0.01"
                          ref={el => { payInputRefs.current[i] = el; }}
                          value={p.Amount}
                          onChange={e => setPayRows(prev => prev.map((r, j) => j === i ? { ...r, Amount: e.target.value } : r))}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (i < payRows.length - 1) {
                                const filled = payRows.slice(0, i + 1).reduce((s, r) => s + CC.vn(r.Amount), 0);
                                const rem    = CC.f2(totals.NetAmt - filled);
                                if (rem > 0) {
                                  setPayRows(prev => prev.map((r, j) =>
                                    j === i + 1 ? { ...r, Amount: rem.toFixed(2) } : r
                                  ));
                                }
                                setTimeout(() => payInputRefs.current[i + 1]?.focus(), 10);
                              } else {
                                remarksRef.current?.focus();
                              }
                            }
                          }}
                          placeholder="0.00"
                        />
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
                <input
                  className="sb-remarks-input"
                  placeholder="Remarks..."
                  ref={remarksRef}
                  value={remarks}
                  onChange={e => setRemarks(e.target.value.toUpperCase())}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); doSave(false); } }}
                />
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
              <div className="sb-total-row net"><label>Net Total</label><span>₹{Math.round(CC.vn(totals.NetAmt))}</span></div>
            </div>

            {/* ── GST SPLIT ── */}
            {gstSplit.length > 0 && (
              <div style={{
                background: "#fff", border: "1px solid #c5d8f8",
                borderRadius: 6, overflow: "hidden", flexShrink: 0,
                maxHeight: 72, display: "flex", flexDirection: "column",
              }}>
                <div style={{
                  background: "#1b3a8f", color: "#fff",
                  fontSize: 10.5, fontWeight: 700, padding: "3px 10px", flexShrink: 0,
                }}>GST Split</div>
                <div style={{ overflowY: "auto", flex: 1 }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
                    <thead>
                      <tr>
                        {["GST%", "GST Amt", "CGST", "SGST"].map(h => (
                          <th key={h} style={{
                            background: "#2d4a9f", color: "#fff",
                            fontSize: 9.5, padding: "2px 6px",
                            border: "1px solid rgba(255,255,255,.15)",
                            textAlign: "right", position: "sticky", top: 0,
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gstSplit.map((g, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? "#f8faff" : "#fff" }}>
                          <td style={{ padding: "2px 6px", border: "1px solid #eaecf4", textAlign: "center", fontSize: 10.5 }}>{g.TaxPercent}%</td>
                          <td style={{ padding: "2px 6px", border: "1px solid #eaecf4", textAlign: "right", fontSize: 10.5 }}>{CC.f2(g.TaxAmt).toFixed(2)}</td>
                          <td style={{ padding: "2px 6px", border: "1px solid #eaecf4", textAlign: "right", fontSize: 10.5 }}>{CC.f2(g.CTAmount).toFixed(2)}</td>
                          <td style={{ padding: "2px 6px", border: "1px solid #eaecf4", textAlign: "right", fontSize: 10.5 }}>{CC.f2(g.STAmount).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── BOTTOM INFO BAR ── */}
            <div style={{
              background: "#fff", border: "1px solid #c5d8f8",
              borderRadius: 6, padding: "6px 10px", flexShrink: 0, fontSize: 12,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 600, color: "#4a5568" }}>Item Qty</span>
                  <span style={{
                    background: "#e8f0fe", color: "#1f65de",
                    fontWeight: 800, fontSize: 13, borderRadius: 4, padding: "1px 10px",
                    border: "1px solid #c5d8f8",
                  }}>{totalQty % 1 === 0 ? totalQty.toFixed(0) : totalQty.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 600, color: "#4a5568" }}>Count</span>
                  <span style={{
                    background: "#e8f0fe", color: "#1f65de",
                    fontWeight: 800, fontSize: 13, borderRadius: 4, padding: "1px 10px",
                    border: "1px solid #c5d8f8",
                  }}>{itemCount}</span>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, color: "#4a5568", fontSize: 11 }}>Last Bill No</span>
                <span style={{ fontWeight: 700, color: "#1a2e4a", fontSize: 11 }}>{lastBillNo}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, color: "#4a5568", fontSize: 11 }}>Last Bill Amount</span>
                <span style={{ fontWeight: 700, color: "#16a34a", fontSize: 11 }}>
                  {lastBillAmt > 0 ? `₹${Math.round(CC.vn(lastBillAmt))}` : "None"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── BOTTOM TOOLBAR ── */}
        <div className="sb-toolbar">
          <button className="sb-btn sv" onClick={() => doSave(true)}  disabled={loading}>💾 F1 Cash Bill</button>
          <button className="sb-btn sv" onClick={() => doSave(false)} disabled={loading}>💳 F2 Split Bill</button>
          <button className="sb-btn sv" onClick={doCreditSave} disabled={loading}>🧾 F7 Credit Bill</button>
          <button className="sb-btn"   onClick={openF5}>📋 F5 View</button>
          <button className="sb-btn"   onClick={() => navigate("/EstimateBill")}
            style={{ background: "#fff7ed", border: "1px solid #fed7aa", color: "#ea580c", fontWeight: 700 }}>
            📋 F8 Estimate
          </button>
          <button className="sb-btn"   onClick={doBillHold}>📌 F4 Bill Hold</button>
        <button
  className="sb-btn"
  onClick={() => {
    const per = CC.vn(discPer);
    if (!per) { toast("❌ Enter Discount %", true); return; }
    setRows(prev => prev.map(r => {
      if (!r.ProductRefId || !CC.vn(r.ItemQty)) return r;
      return calcSaleRow({ ...r, DiscountPercent: String(per), _dirty: true });
    }));
    toast(`✅ ${per}% discount applied to all rows`);
  }}
  title="Apply bill-level discount to all rows"
>
  Disc%:
  <input
    style={{ width: 50, border: "1px solid #c5d8f8", borderRadius: 3, fontSize: 11, padding: "1px 4px", marginLeft: 3 }}
    type="number"
    step="0.01"
    value={discPer}
    onChange={e => setDiscPer(e.target.value)}
    onClick={e => e.stopPropagation()}
    onKeyDown={e => {
      if (e.key === "Enter") {
        e.stopPropagation();
        const per = CC.vn(discPer);
        if (!per) { toast("❌ Enter Discount %", true); return; }
        setRows(prev => prev.map(r => {
          if (!r.ProductRefId || !CC.vn(r.ItemQty)) return r;
          return calcSaleRow({ ...r, DiscountPercent: String(per), _dirty: true });
        }));
        toast(`✅ ${per}% discount applied to all rows`);
      }
    }}
  />
  <span style={{ marginLeft: 2 }}>Apply</span>
</button>
          <button className="sb-btn"   onClick={() => setF12Open(true)}>⚙ F12 Columns</button>
          <button className="sb-btn"   onClick={() => setCtrlGOpen(true)} title="Ctrl+G Column Focus/Reorder">⚡ Ctrl+G</button>
          <button className="sb-btn"   onClick={clearForm} disabled={loading}>🔄 F10 Clear</button>
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
          <div className="sb-ldr-box">
            <div className="sb-spin" />
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

      {batchPopup && (
        <BatchPopup
          batches={batchPopup.batches}
          onSelect={item => { fillBatchItemIntoRow(batchPopup.rid, item); }}
          onClose={() => setBatchPopup(null)}
        />
      )}

      {expiryListPopup && (
        <ExpiryDateListPopup
          expiryList={expiryListPopup.list}
          onSelect={item => {
            const rid = expiryListPopup.rid;
            setRows(prev => prev.map(r =>
              r._rid !== rid ? r : {
                ...r,
                MfgDate:    item.MFdate  || "",
                ExpDate:    item.Expdate || "",
                Bat_No:     item.BatchNo || r.Bat_No || "",
                BatchRefid: item.Batchid || r.BatchRefid || null,
                StockQty:   CC.vn(item.Stock),
                _dirty: true,
              }
            ));
            setStockLbl(CC.vn(item.Stock).toFixed(0));
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

      {custPopup && (
        <CustomerSearchPopup
          customers={customers}
          onSelect={handleCustomerSelect}
          onClose={() => setCustPopup(false)}
        />
      )}

     {prodPopup && (
  <ProductSearchPopup
    products={prodList}
    isTamil={tamilMode}
    onSelect={item => { fillItemIntoRow(prodPopup.rid, item); }}
    onClose={() => setProdPopup(null)}
    anchorPos={prodPopup.pos}
  />
)}

      {f5Open && (
        <F5ViewModal
          rows={f5Rows}
          details={f5Details}
          onEdit={handleF5EditRequest}
          onDelete={handleF5Delete}
          onClose={() => setF5Open(false)}
          fromDate={billDate}
          toDate={billDate}
          onSearch={openF5}
        />
      )}

      {holdOpen && (
        <BillHoldModal
          holds={holdRows}
          onLoad={loadHold}
          onDelete={deleteHold}
          onClose={() => setHoldOpen(false)}
        />
      )}

      <CC.ToastList toasts={toasts} />
    </div>
  );
}



