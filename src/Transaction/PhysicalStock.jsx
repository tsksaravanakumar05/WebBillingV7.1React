// ─────────────────────────────────────────────────────────────────────────────
//  PhysicalStock.jsx  —  React Physical Stock Form
//  Design & template fully aligned with SaleReturn.jsx:
//    • Same CSS class names (sb-wrap, sb-body, sb-toolbar, sb-tbl, sb-btn, etc.)
//    • Same panel layout (panelStyle / panelTitle)
//    • Same grid structure, sticky header, row selection
//    • Same loading overlay, toast, confirm modal patterns
//    • Same keyboard shortcut scheme (F1=Save, F10=Clear, F12=Columns, ESC=Quit)
//    • Same ProductSearchPopup design
//    • Same F12Popup column settings design
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState, useEffect, useRef, useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../components/Common";
import Topbar from "../components/Topbar";

// ─── API CONSTANTS ────────────────────────────────────────────────────────────
const PhysicalStockInsertUrl = "/api/PhysicalStockApp/InsertPhysicalStock";
const SelectItemListUrl      = "/api/PhysicalStockApp/SelectItemList";
const SelectItemByCodeUrl    = "/api/ItemMasterApp/SelectItemMasterbyCodeId";
const ProductListUrl         = "/api/ItemMasterApp/GetProductListV7";
const VisibleColumnsUrl      = "/Login/VisibleColumns";

// ─── GRID COLUMNS ─────────────────────────────────────────────────────────────
const PS_COLUMNS = [
  { key: "ProductCode",      label: "Product Code",      width: 150, hidden: false },
  { key: "ProductName",      label: "Description",       width: 250, hidden: false, readOnly: true },
  { key: "ClosingStock",     label: "Closing Qty",       width: 100, hidden: false, readOnly: true, type: "float" },
  { key: "PhysicalStockQty", label: "Physical Stock",    width: 100, hidden: false, type: "float" },
  { key: "ExcessStorageQty", label: "Excess/Storage Qty",width: 150, hidden: false, readOnly: true, type: "float" },
  { key: "LandingCost",      label: "Landing Cost",      width: 100, hidden: false, type: "float" },
  { key: "DifferentValue",   label: "Different Value",   width: 120, hidden: false, readOnly: true, type: "float" },
];

const PS_INVISIBLE_COLUMNS = [
  { key: "OpeningStock",      label: "OpeningStock"      },
  { key: "PurchaseQty",       label: "PurchaseQty"       },
  { key: "InwardQty",         label: "InwardQty"         },
  { key: "PurchaseReturnQty", label: "PurchaseReturnQty" },
  { key: "SaleQty",           label: "SaleQty"           },
  { key: "SaleReturnQty",     label: "SaleReturnQty"     },
  { key: "OutwardQty",        label: "OutwardQty"        },
  { key: "TransferOut",       label: "TransferOut"       },
  { key: "AdjPlusQty",        label: "AdjPlusQty"        },
  { key: "AdjSubQty",         label: "AdjSubQty"         },
  { key: "ClosingStock",      label: "ClosingStock"      },
  { key: "PhysicalStockQty",  label: "PhysicalStockQty"  },
  { key: "ExcessStorageQty",  label: "ExcessStorageQty"  },
  { key: "LandingCost",       label: "LandingCost"       },
  { key: "DifferentValue",    label: "DifferentValue"    },
];

const DEFAULT_COL_SETTINGS = PS_COLUMNS.map(c => ({
  key:     c.key,
  label:   c.label,
  width:   c.width,
  visible: !c.hidden,
}));

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const vn    = v => parseFloat(v) || 0;
const f2    = v => parseFloat(vn(v).toFixed(2));
const ns    = v => (v == null ? "" : String(v));
const today = () => new Date().toISOString().slice(0, 10);
const dateformat = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  const dd   = String(dt.getDate()).padStart(2, "0");
  const mm   = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

let _rid = 5000;
const genRid = () => ++_rid;

// ─── ROW FACTORY ──────────────────────────────────────────────────────────────
const mkRow = () => ({
  _rid:              genRid(),
  _isNew:            true,
  _dirty:            false,
  Id:                0,
  ProductCode:       "",
  ProductName:       "",
  ProductId:         0,
  OpeningStock:      0,
  UOMDecimal:        0,
  PurchaseQty:       0,
  InwardQty:         0,
  PurchaseReturnQty: 0,
  SaleQty:           0,
  SaleReturnQty:     0,
  OutwardQty:        0,
  TransferOut:       0,
  AdjPlusQty:        0,
  AdjSubQty:         0,
  ClosingStock:      0,
  PhysicalStockQty:  "",
  ExcessStorageQty:  "",
  LandingCost:       0,
  DifferentValue:    0,
  EditMode:          0,
  Refdate:           "",
});

// ─── ROW CALCULATION ──────────────────────────────────────────────────────────
function calcRow(row) {
  const physical    = vn(row.PhysicalStockQty);
  const closing     = vn(row.ClosingStock);
  const landingCost = vn(row.LandingCost);
  const excess      = f2(physical - closing);
  const diffValue   = landingCost <= 0 ? 0 : f2(excess * landingCost);
  return { ...row, ExcessStorageQty: excess, DifferentValue: diffValue };
}

// ─── RIGHT-ALIGN KEYS ─────────────────────────────────────────────────────────
const RIGHT_KEYS = new Set([
  "ClosingStock", "PhysicalStockQty", "ExcessStorageQty", "LandingCost", "DifferentValue",
]);

// ─── INLINE STYLES (matching SaleReturn pattern) ──────────────────────────────
const fieldInput = {
  height: 24, border: "1px solid #b8ccee", borderRadius: 3,
  padding: "0 6px", fontSize: 12, outline: "none",
  background: "#fff", color: "#1a2e4a",
};
const fieldLabel = {
  fontSize: 12, fontWeight: 600, color: "#4a5568",
  minWidth: 80, flexShrink: 0,
};

// ─── PRODUCT SEARCH POPUP (SaleReturn style) ──────────────────────────────────
function ProductSearchPopup({ products, onSelect, onClose, anchorPos }) {
  const [q, setQ]           = useState("");
  const [hilite, setHilite] = useState(0);
  const inputRef = useRef(null);
  const listRef  = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 30); }, []);

  const filtered = products.filter(p =>
    String(p.PName || p.ProductName || "").toLowerCase().includes(q.toLowerCase()) ||
    String(p.Prod_Code || p.ProductCode || "").toLowerCase().includes(q.toLowerCase())
  ).slice(0, 120);

  useEffect(() => { setHilite(0); }, [q]);
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${hilite}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [hilite]);

  return (
    <div className="sb-prod-search" style={{ top: anchorPos?.top || 160, left: (anchorPos?.left + 250) || 20 }}>
      <div className="sb-prod-search-hdr">
        <span className="sb-ps-title">🔍 Product Search</span>
        <span className="sb-ps-count">{filtered.length} items</span>
        <button className="sb-ps-close" onClick={onClose}>✕</button>
      </div>
      <div className="sb-ps-input-wrap">
        <span className="sb-ps-icon">⌕</span>
        <input
          ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
          placeholder="Type code or name…" className="sb-ps-input"
          onKeyDown={e => {
            if (e.key === "ArrowDown") { e.preventDefault(); setHilite(h => Math.min(h + 1, filtered.length - 1)); }
            if (e.key === "ArrowUp")   { e.preventDefault(); setHilite(h => Math.max(h - 1, 0)); }
            if (e.key === "Enter")     { e.preventDefault(); if (filtered[hilite]) onSelect(filtered[hilite]); }
            if (e.key === "Escape")    { e.preventDefault(); onClose(); }
          }}
        />
      </div>
      <div className="sb-ps-cols">
        <span style={{ width: 90 }}>Code</span>
        <span style={{ flex: 1 }}>Product Name</span>
        <span style={{ width: 80, textAlign: "right" }}>Stock</span>
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

// ─── EXP DATE WINDOW ─────────────────────────────────────────────────────────
function ExpDateWindow({ onClose, onSave, productId }) {
  const [expRows, setExpRows] = useState([{ _rid: genRid(), Qty: "", ExpDate: "", MFDate: "" }]);

  const addExpRow    = () => setExpRows(prev => [...prev, { _rid: genRid(), Qty: "", ExpDate: "", MFDate: "" }]);
  const updateExpRow = (rid, field, val) => setExpRows(prev => prev.map(r => r._rid === rid ? { ...r, [field]: val } : r));
  const deleteExpRow = (rid) => setExpRows(prev => prev.length > 1 ? prev.filter(r => r._rid !== rid) : prev);

  const handleSave = () => {
    const validRows = expRows.filter(r => vn(r.Qty) > 0);
    const totalQty  = validRows.reduce((s, r) => s + vn(r.Qty), 0);
    onSave(validRows, totalQty, productId);
    onClose();
  };

  return (
    <div className="mp-ov" style={{ zIndex: 8800 }}>
      <div className="mp-modal-box" style={{ width: 420, overflow: "hidden" }}>
        <div className="mp-modal-hdr">
          <span>📅 Exp Date Entry</span>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="mp-modal-body">
          <div style={{
            display: "grid", gridTemplateColumns: "40px 1fr 1fr 1fr 36px",
            padding: "4px 6px", fontSize: 11, fontWeight: 700,
            color: "#4a5568", background: "#f0f4ff", borderRadius: 4, marginBottom: 6,
          }}>
            <span>S.No</span><span>Qty</span><span>Exp Date</span><span>MF Date</span><span></span>
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {expRows.map((row, idx) => (
              <div key={row._rid} style={{
                display: "grid", gridTemplateColumns: "40px 1fr 1fr 1fr 36px",
                gap: 4, marginBottom: 4, alignItems: "center",
              }}>
                <span style={{ fontSize: 11, color: "#94a3b8", textAlign: "center" }}>{idx + 1}</span>
                <input type="number" style={{ ...fieldInput, width: "100%" }}
                  value={row.Qty} onChange={e => updateExpRow(row._rid, "Qty", e.target.value)} placeholder="0" />
                <input type="date" style={{ ...fieldInput, width: "100%" }}
                  value={row.ExpDate} onChange={e => updateExpRow(row._rid, "ExpDate", e.target.value)} />
                <input type="date" style={{ ...fieldInput, width: "100%" }}
                  value={row.MFDate} onChange={e => updateExpRow(row._rid, "MFDate", e.target.value)} />
                <button onClick={() => deleteExpRow(row._rid)} className="mp-del-btn" style={{ fontSize: 13 }}>🗑</button>
              </div>
            ))}
          </div>
          <button onClick={addExpRow} style={{
            marginTop: 6, padding: "4px 12px", background: "#e8f0fe",
            border: "1px solid #c5d8f8", borderRadius: 4,
            color: "#1f65de", fontSize: 12, cursor: "pointer",
          }}>+ Add Row</button>
        </div>
        <div className="mp-modal-ftr">
          <button className="mp-btn sv" onClick={handleSave}>✔ Save</button>
          <button className="mp-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── F12 COLUMN SETTINGS (SaleReturn style) ───────────────────────────────────
function F12Popup({ colSettings, comid, onSave, onClose, toast }) {
  const [local, setLocal] = useState(colSettings.map(s => ({ ...s })));
  const toggle = key => setLocal(prev => prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
  const setWid = (key, w) => setLocal(prev => prev.map(c => c.key === key ? { ...c, width: parseInt(w) || c.width } : c));

  const handleSave = async () => {
    const payload = local.map(c => ({
      Comid:    parseInt(comid) || 1,
      filename: "PhysicalStockApply",
      column:   c.key,
      Visible:  c.visible === true,
      Width:    parseInt(c.width) || 100,
    }));
    try {
      const res  = await fetch(VisibleColumnsUrl, {
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
          <span>⚙ Column Settings (F12)</span>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="mp-modal-body" style={{ overflowY: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
            <thead>
              <tr>
                {["Column", "Visible", "Width (px)"].map(h => (
                  <th key={h} style={{
                    color: "#fff", padding: "6px 10px", textAlign: "left",
                    fontWeight: 600, position: "sticky", top: 0, zIndex: 2, background: "#1a2e4a",
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
export default function PhysicalStock() {
  const navigate               = useNavigate();
  const { confirm, ConfirmUI } = CC.useConfirm();
  const { toast, toasts }      = CC.useToast();

const skipEnterRef = useRef({}); // ← ADD THIS

  // ── Column Settings ──────────────────────────────────────────────────────
  const [colSettings, setColSettings] = useState(DEFAULT_COL_SETTINGS);
  const [f12Open,     setF12Open]     = useState(false);
  const visCols = colSettings.filter(c => c.visible);

  const loadColCfg = useCallback(async (comid) => {
    try {
      const url = `Content/Appdata/Visible/${comid}/PhysicalStockApply.json?v=${Date.now()}`;
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

  // ── Session ───────────────────────────────────────────────────────────────
  const [sess] = useState(() => {
    try {
      const main0 = (CC.getLocal("Mainsetting") || [{}])[0] || {};
      const Comid  = CC.getStr("Comid")  || "1";
      const MComid = CC.getStr("MComid") || Comid;
      const isCC   = !!main0.CommonCompany;
      return {
        Comid:        isCC ? MComid : Comid,
        MComid,
        CommonCompany: isCC,
        DayClose:     !!main0.DayClose,
      };
    } catch {
      return { Comid: "1", MComid: "1", CommonCompany: false, DayClose: false };
    }
  });

  // ── State ─────────────────────────────────────────────────────────────────
  const [perm,         setPerm]         = useState({ View: 0, Add: 0, Edit: 0, Delete: 0 });
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [refDate,      setRefDate]      = useState(today());
  const [rows,         setRows]         = useState([mkRow()]);
  const [selRid,       setSelRid]       = useState(null);
  const [diffValue,    setDiffValue]    = useState("0.00");
  const [prodPopup,    setProdPopup]    = useState(null);
  const [prodList,     setProdList]     = useState([]);
  const [expWin,       setExpWin]       = useState(null);
  const [expDateList,  setExpDateList]  = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [ldMsg,        setLdMsg]        = useState("Loading...");

  const rowsRef  = useRef(rows);
  const cellRefs = useRef({});
  useEffect(() => { rowsRef.current = rows; }, [rows]);

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
    const menudata = menulist.filter(o => o.PageName === "Physical Stock");
    if (!menudata || menudata.length === 0 || menudata[0].View === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => navigate("/Home"), 3000);
      return;
    }
    setPerm({ View: menudata[0].View, Add: menudata[0].Add, Edit: menudata[0].Edit, Delete: menudata[0].Delete });
    setIsAuthorized(true);
  }, [navigate]);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthorized) return;
    (async () => {
      await loadColCfg(sess.Comid);
      clearForm();
    })();
  // eslint-disable-next-line
  }, [isAuthorized]);

  const redirectIfDualLogin = useCallback((res) => {
    if (res?._dualLogin || res?.redis === false) {
      alert("Already Login Another User Please Login Again!!!");
      navigate("/");
      return true;
    }
    return false;
  }, [navigate]);

  // ── Recalc totals ─────────────────────────────────────────────────────────
  const recalcTotals = useCallback((rowsArr) => {
    let total = 0;
    rowsArr.forEach(r => { if (r.PhysicalStockQty !== "") total += vn(r.DifferentValue); });
    setDiffValue(total.toFixed(2));
  }, []);

  useEffect(() => { recalcTotals(rows); }, [rows, recalcTotals]);

  // ── Fill items into row ───────────────────────────────────────────────────
const fillItemsIntoRow = useCallback(async (rid, itemId,Stock) => {
  const res = await CC.api(SelectItemListUrl, null,
    { Comid: sess.Comid, MComid: sess.MComid },
    { Id: itemId, date: dateformat(refDate), Comid: sess.Comid, MComid: sess.MComid }
  );
  if (redirectIfDualLogin(res)) return;
  const arr = Array.isArray(res.data)  ? res.data
            : Array.isArray(res.Data1) ? res.Data1
            : Array.isArray(res)       ? res : [];

  if (arr.length === 0) {
    toast("❌ Invalid Product Code !!!", true);
    setTimeout(() => cellRefs.current[rid]?.["ProductCode"]?.focus(), 50);
    return;
  }

  const obj = arr[0];

  // ── FIX 1: Normalize UOMDecimal safely (was: obj.UOMDemical || obj.UOMDecimal)
  // UOMDemical is a backend typo that sometimes appears; fall back gracefully
  const rawUOM = obj.UOMDecimal ?? obj.UOMDemical ?? obj.UomDecimal ?? 0;
  const uom = [0, 2, 3].includes(parseInt(rawUOM)) ? parseInt(rawUOM) : 0;

  // ── FIX 2: Normalize ClosingStock (was: obj.Closingqty alone — missing fallbacks)
  const rawClosing =Stock?? 0;
  const closingDisplay = (() => {
    const val = parseFloat(rawClosing) || 0;
    if (uom === 2) return val.toFixed(2);
    if (uom === 3) return val.toFixed(3);
    return Math.round(val).toFixed(0);   // integer UOM — whole numbers only
  })();

  // ── FIX 3: Normalize LandingCost (was: obj.PurRate alone — missing fallbacks)
  const rawLanding = obj.LandingCost ?? obj.Landingcost ?? obj.PurRate
                  ?? obj.PurchaseRate ?? obj.purchaserate ?? 0;
  const landingDisplay = parseFloat(rawLanding || 0).toFixed(2);

  const isDupe = rowsRef.current.some(r => r._rid !== rid && r.ProductId === obj.Id);
  if (isDupe) {
    toast("❌ Duplicate Product !!!", true);
    setTimeout(() => cellRefs.current[rid]?.["ProductCode"]?.focus(), 50);
    return;
  }

  setRows(prev => prev.map(r => {
    if (r._rid !== rid) return r;
    const updated = {
      ...r,
      ProductCode:      obj.ProductCode  || obj.Prod_Code || "",
      ProductId:        obj.Id           || obj.ProductId || 0,
      ProductName:      obj.ProductName  || obj.PName     || "",
      UOMDecimal:       uom,
      ClosingStock:     closingDisplay,   // ← FIX 2: correct value + correct decimals
      PhysicalStockQty: "",
      ExcessStorageQty: "",
      LandingCost:      landingDisplay,   // ← FIX 3: correct field with fallbacks
      DifferentValue:   0,
      _dirty:           true,
    };
    // Trigger exp-date window if product requires batch/expiry entry
    if (obj.ExpiryDate == 1) setExpWin({ rid, productId: obj.Id });
    return updated;
  }));

  setTimeout(() => {
    cellRefs.current[rid]?.["PhysicalStockQty"]?.focus();
    cellRefs.current[rid]?.["PhysicalStockQty"]?.select();
  }, 60);
}, [sess, refDate, redirectIfDualLogin, toast]);

  // ── Fetch product by code ─────────────────────────────────────────────────
  const fetchProductByCode = useCallback(async (rid, code) => {
    if (!code.trim()) return;
    const res = await CC.api(SelectItemByCodeUrl, null, {},
      { code: code.trim().toUpperCase(), Comid: sess.MComid, CComid: sess.Comid, Id: 0, Batchwise: 0 }
    );
    if (redirectIfDualLogin(res)) return;
    const arr = Array.isArray(res.data)  ? res.data
              : Array.isArray(res.Data1) ? res.Data1 : [];
    if (arr.length === 0) {
      toast("❌ Invalid Product Code !!!", true);
      setTimeout(() => cellRefs.current[rid]?.["ProductCode"]?.focus(), 50);
      return;
    }
    if (arr.length === 1) {
      await fillItemsIntoRow(rid, arr[0].Id,arr[0].Stock);
    } else {
      setProdList(arr);
      setProdPopup({ rid, pos: { top: 200, left: 80 } });
    }
  }, [sess, fillItemsIntoRow, redirectIfDualLogin, toast]);

  // ── Load product list for popup ───────────────────────────────────────────
  const loadProductsForPopup = useCallback(async (rid) => {
    if (prodList.length > 0) { setProdPopup({ rid, pos: { top: 160, left: 80 } }); return; }
    setLoading(true); setLdMsg("Loading products...");
    const res = await CC.api(ProductListUrl, null, {}, { Comid: sess.Comid });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    const arr = Array.isArray(res.data)  ? res.data
              : Array.isArray(res.Data1) ? res.Data1 : [];
    setProdList(arr);
    setProdPopup({ rid, pos: { top: 160, left: 80 } });
  }, [sess, prodList, redirectIfDualLogin]);

  // ── Cell change ───────────────────────────────────────────────────────────
  const handleCellChange = useCallback((rid, colKey, value) => {
    setRows(prev => prev.map(r => {
      if (r._rid !== rid) return r;
      const updated = { ...r, [colKey]: value, _dirty: true };
      if (colKey === "PhysicalStockQty" || colKey === "LandingCost") return calcRow(updated);
      return updated;
    }));
  }, []);

  // ── Delete row ────────────────────────────────────────────────────────────
  const doDeleteRow = useCallback(async (rid) => {
    const ok = await confirm("Do you want to Delete this Row?");
    if (!ok) return;
    setRows(prev => {
      const filtered = prev.filter(r => r._rid !== rid);
      const removedRow = prev.find(r => r._rid === rid);
      if (removedRow?.ProductId) setExpDateList(el => el.filter(e => e.MProductId !== removedRow.ProductId));
      return filtered.length === 0 ? [mkRow()] : filtered;
    });
  }, [confirm]);

  // ── Exp date save ─────────────────────────────────────────────────────────
  const handleExpDateSave = useCallback((expRows, totalQty, productId) => {
    setExpDateList(prev => {
      const filtered  = prev.filter(e => e.MProductId !== productId);
      const newEntries = expRows
        .filter(r => vn(r.Qty) > 0 && (r.ExpDate || r.MFDate))
        .map(r => ({ MProductId: productId, ExpDate: r.ExpDate, MFDate: r.MFDate, Qty: r.Qty }));
      return [...filtered, ...newEntries];
    });
    if (expWin?.rid) {
      setRows(prev => prev.map(r => {
        if (r._rid !== expWin.rid) return r;
        return calcRow({ ...r, PhysicalStockQty: totalQty.toFixed(2), _dirty: true });
      }));
    }
    setExpWin(null);
  }, [expWin]);

  // ── Clear form ────────────────────────────────────────────────────────────
  const clearForm = useCallback(() => {
    const newRows = [mkRow()];
    setRows(newRows);
    setSelRid(null);
    setDiffValue("0.00");
    setExpDateList([]);
    setTimeout(() => { cellRefs.current[newRows[0]._rid]?.["ProductCode"]?.focus(); }, 100);
  }, []);

  // ── Grid empty check ──────────────────────────────────────────────────────
  const gridemptycheck = useCallback(() => {
    const currentRows = rowsRef.current;
    const lastRow = currentRows[currentRows.length - 1];
    let workRows = currentRows;
    if ((lastRow.ProductCode === "" || lastRow.ProductCode == null) && currentRows.length > 1) {
      workRows = currentRows.slice(0, -1);
      setRows(workRows);
    }
    for (let i = 0; i < workRows.length; i++) {
      if (workRows[i].ProductCode === "" || workRows[i].ProductCode == null) {
        toast("❌ Enter All code in the Grid !!!", true);
        setTimeout(() => cellRefs.current[workRows[i]._rid]?.["ProductCode"]?.focus(), 50);
        return false;
      }
    }
    return true;
  }, [toast]);

  // ── Check duplicate ───────────────────────────────────────────────────────
  const checkDuplicate = useCallback(() => {
    const ids    = rowsRef.current.map(r => r.ProductId).filter(id => id > 0);
    const unique = new Set(ids);
    if (ids.length !== unique.size) { toast("❌ Duplicate Products Found !!!", true); return false; }
    return true;
  }, [toast]);

  // ── Validate exp date qty ─────────────────────────────────────────────────
  const validateExpDateQty = useCallback(() => {
    if (expDateList.length === 0) return true;
    const grouped = {};
    expDateList.forEach(e => { grouped[e.MProductId] = (grouped[e.MProductId] || 0) + vn(e.Qty); });
    for (const [id, qty] of Object.entries(grouped)) {
      const row = rowsRef.current.find(r => r.ProductId == id);
      if (row && vn(row.PhysicalStockQty) !== vn(qty)) {
        toast("❌ ExpDate Qty Not Equal Physical Stock Qty", true);
        return false;
      }
    }
    return true;
  }, [expDateList, toast]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const doSave = useCallback(async () => {
    if (perm.Add === 0) { toast("❌ Page Add Permission Denied !!!", true); return; }
    if (!checkDuplicate()) return;
    if (!gridemptycheck()) return;
    if (!validateExpDateQty()) return;

    const ok = await confirm("Do you Want to Save the Physical Stock Details?");
    if (!ok) return;

    const currentRows = rowsRef.current;
    let griddata = currentRows.filter(r => r.ExcessStorageQty != 0);
    if (griddata.length > 0) {
      griddata = griddata.map(r => ({ ...r, Refdate: dateformat(refDate) }));
    } else {
      griddata = currentRows.map(r => ({ ...r, Refdate: dateformat(refDate) }));
    }

    setLoading(true); setLdMsg("Saving...");
    const headers = {
      Comid:        String(sess.Comid),
      RefDate:      dateformat(refDate),
      Expstocklist: JSON.stringify(expDateList),
    };

    const res = await CC.insertapi(PhysicalStockInsertUrl, griddata, headers);
    setLoading(false);
    if (redirectIfDualLogin(res)) return;

    if (res.ok ?? res.IsSuccess) {
      toast("✅ Physical Stock Saved Successfully");
      clearForm();
    } else {
      toast("❌ " + (res.message || res.Message || "Save Failed"), true);
    }
  }, [perm, confirm, checkDuplicate, gridemptycheck, validateExpDateQty,
      sess, refDate, expDateList, clearForm, redirectIfDualLogin, toast]);

  // ── Cell keydown ──────────────────────────────────────────────────────────
const handleCellKeyDown = useCallback((e, rid, colKey) => {
  const editableCols = visCols
    .map(vc => PS_COLUMNS.find(c => c.key === vc.key))
    .filter(Boolean)
    .filter(cd => !cd.readOnly)
    .map(cd => cd.key);

  const COLS = ["ProductCode", ...editableCols.filter(k => k !== "ProductCode")];
  const colIdx = COLS.indexOf(colKey);
  const rowIdx = rowsRef.current.findIndex(r => r._rid === rid);

  const focusCell = (targetRid, targetKey, skipEnter = false) => {
    setTimeout(() => {
      if (skipEnter) skipEnterRef.current[targetRid] = true;
      const el = cellRefs.current[targetRid]?.[targetKey];
      if (el) { el.focus(); el.select?.(); }
    }, 10);
  };

  if (e.key === "Enter") {
    e.preventDefault();

    // Consume carry-over Enter from programmatic focus
    if (skipEnterRef.current[rid]) {
      delete skipEnterRef.current[rid];
      return;
    }

    if (colKey === "ProductCode") {
      const row = rowsRef.current.find(r => r._rid === rid);
      if (row?.ProductCode?.trim()) fetchProductByCode(rid, row.ProductCode);
      else loadProductsForPopup(rid);
      return;
    }

    if (colKey === "PhysicalStockQty" || colKey === "LandingCost") {
      const curRows = rowsRef.current;
      const isLast  = rowIdx === curRows.length - 1;
      if (isLast) {
        const curRow = curRows.find(r => r._rid === rid);
        if (curRow?.ProductId) {
          const newRow = mkRow();
          setRows(prev => [...prev, newRow]);
          setTimeout(() => {
            skipEnterRef.current[newRow._rid] = true;
            cellRefs.current[newRow._rid]?.["ProductCode"]?.focus();
          }, 80);
        } else { focusCell(rid, "ProductCode", true); }
      } else {
        focusCell(curRows[rowIdx + 1]._rid, "ProductCode", true);
      }
      return;
    }

    if (colIdx >= 0 && colIdx < COLS.length - 1) {
      focusCell(rid, COLS[colIdx + 1]);
    } else {
      const curRows = rowsRef.current;
      const isLast  = rowIdx === curRows.length - 1;
      if (isLast) {
        const curRow = curRows.find(r => r._rid === rid);
        if (curRow?.ProductId) {
          const newRow = mkRow();
          setRows(prev => [...prev, newRow]);
          setTimeout(() => {
            skipEnterRef.current[newRow._rid] = true;
            cellRefs.current[newRow._rid]?.["ProductCode"]?.focus();
          }, 80);
        } else { focusCell(rid, "ProductCode", true); }
      } else {
        focusCell(curRows[rowIdx + 1]._rid, "ProductCode", true);
      }
    }
    return;
  }

  if (e.key === "ArrowDown" && rowIdx < rowsRef.current.length - 1) { e.preventDefault(); focusCell(rowsRef.current[rowIdx + 1]._rid, colKey); }
  if (e.key === "ArrowUp"   && rowIdx > 0)                           { e.preventDefault(); focusCell(rowsRef.current[rowIdx - 1]._rid, colKey); }
  if (e.key === "ArrowRight" && colIdx < COLS.length - 1)            { e.preventDefault(); focusCell(rid, COLS[colIdx + 1]); }
  if (e.key === "ArrowLeft"  && colIdx > 0)                          { e.preventDefault(); focusCell(rid, COLS[colIdx - 1]); }
  if (e.key === "Delete")    { e.preventDefault(); doDeleteRow(rid); }
  if (e.key === " " && colKey === "ProductCode") { e.preventDefault(); loadProductsForPopup(rid); }
}, [visCols, fetchProductByCode, loadProductsForPopup, doDeleteRow]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = e => {
      if (prodPopup || f12Open || expWin) return;
      if (e.keyCode === 112) { e.preventDefault(); doSave(); }
      if (e.keyCode === 121) { e.preventDefault(); confirm("Do You Want To Clear?").then(ok => ok && clearForm()); }
      if (e.keyCode === 27)  { e.preventDefault(); confirm("Do You Want To Quit?").then(ok => ok && navigate(-1)); }
      if (e.keyCode === 123) { e.preventDefault(); setF12Open(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prodPopup, f12Open, expWin, doSave, clearForm, confirm, navigate]);

  // ── Date enter key ────────────────────────────────────────────────────────
  const handleDateKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const firstRow = rowsRef.current[0];
      if (firstRow) cellRefs.current[firstRow._rid]?.["ProductCode"]?.focus();
    }
  };

  if (!isAuthorized) return null;

  const panelStyle = {
    border: "1px solid #c8d8ee", borderRadius: 4, background: "#fff",
    padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6,
  };
  const panelTitle = {
    fontSize: 11, fontWeight: 700, color: "#4a5568",
    borderBottom: "1px solid #e2e8f0", paddingBottom: 4, marginBottom: 2,
  };

  const totalItems = rows.filter(r => r.ProductId > 0).length;

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="sb-wrap">
      {ConfirmUI}
      <Topbar />

      <div className="sb-body">

        {/* ══ HEADER ══════════════════════════════════════════════════════ */}
        <div style={{
          display: "flex", gap: 10, padding: "8px 10px",
          background: "#f5f8fd", borderBottom: "1px solid #d0ddf5", alignItems: "stretch",
        }}>

          {/* LEFT: Physical Stock Details */}
          <div style={{ ...panelStyle, minWidth: 260, flexShrink: 0 }}>
            <div style={panelTitle}>Physical Stock Details</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label style={{ ...fieldLabel, minWidth: 78 }}>Ref Date</label>
              <input
                type="date"
                style={{ ...fieldInput, flex: 1 }}
                value={refDate}
                onChange={e => setRefDate(e.target.value)}
                onKeyDown={handleDateKeyDown}
              />
            </div>
          </div>

          {/* RIGHT: Summary */}
          <div style={{ ...panelStyle, flex: 1 }}>
            <div style={panelTitle}>Summary</div>
            <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#4a5568" }}>Total Items</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: "#1f65de" }}>{totalItems}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#4a5568" }}>Difference Value</span>
                <span style={{
                  fontSize: 22, fontWeight: 800,
                  color: diffValue.startsWith("-") ? "#dc2626" : "#16a34a",
                }}>₹{diffValue}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ══ GRID ════════════════════════════════════════════════════════ */}
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
                        const m       = PS_COLUMNS.find(c => c.key === col.key) || {};
                        const val     = row[col.key];
                        const isRight = RIGHT_KEYS.has(col.key);
                        const isRO    = !!m.readOnly;
                        const isFloat = m.type === "float";
                        const isDiffVal = col.key === "DifferentValue";
                        const isExcess  = col.key === "ExcessStorageQty";

                        return (
                          <td key={col.key} style={{ textAlign: isRight ? "right" : undefined }}>
                            {isRO ? (
                              <span className="sb-cell-calc" style={{
                                display: "block", padding: "0 4px",
                                color: isDiffVal
                                  ? (vn(val) < 0 ? "#dc2626" : "#16a34a")
                                  : isExcess
                                    ? (vn(val) < 0 ? "#dc2626" : "#1a2e4a")
                                    : "#475569",
                                fontWeight: isDiffVal ? 700 : 400,
                              }}>
                                {isFloat && val !== "" ? f2(val).toFixed(2) : ns(val)}
                              </span>
                            ) : col.key === "ProductCode" ? (
                              <input
                                ref={el => regCell(row._rid, col.key, el)}
                                className="sb-cell-input"
                                value={ns(val)}
                                onChange={e => handleCellChange(row._rid, col.key, e.target.value.toUpperCase())}
                                onKeyDown={e => handleCellKeyDown(e, row._rid, col.key)}
                                onFocus={() => setSelRid(row._rid)}
                                placeholder="Code / Scan"
                                style={{ width: "100%", boxSizing: "border-box", fontWeight: 600 }}
                              />
                            ) : isFloat ? (
                              <input
                                ref={el => regCell(row._rid, col.key, el)}
                                type="number"
                                className={`sb-cell-input${isRight ? " right" : ""}`}
                                step={row.UOMDecimal === 0 ? "1" : "0.01"}
                                value={val === 0 && !row.ProductId ? "" : (val ?? "")}
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

        {/* ══ BOTTOM TOTALS ═══════════════════════════════════════════════ */}
        <div style={{
          display: "flex", alignItems: "center", gap: 24,
          padding: "8px 16px", background: "#f8fafd",
          borderTop: "1px solid #d0ddf5", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#4a5568" }}>Total Items</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#1f65de" }}>{totalItems}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#4a5568" }}>Difference Value</span>
            <span style={{
              fontSize: 18, fontWeight: 800,
              color: diffValue.startsWith("-") ? "#dc2626" : "#16a34a",
            }}>₹{diffValue}</span>
          </div>
        </div>

        {/* ══ TOOLBAR ═════════════════════════════════════════════════════ */}
        <div className="sb-toolbar">
          <button className="sb-btn sv" onClick={doSave} disabled={loading}
            style={{ background: "var(--clr-primary)", borderColor: "var(--clr-primary)" }}>
            💾 F1 - Save
          </button>
          <button className="sb-btn" onClick={clearForm} disabled={loading}>🔄 F10 - Clear</button>
          <button className="sb-btn" onClick={() => setF12Open(true)}>⚙ F12 - Columns</button>
          <button className="sb-btn dl" onClick={() => confirm("Do You Want To Quit?").then(ok => ok && navigate(-1))}>
            ✕ ESC - Exit
          </button>
          {loading && <span style={{ fontSize: 11, color: "#6b7a99" }}>⏳ {ldMsg}</span>}
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#6b7a99" }}>
            Secondary Levercare: <b style={{ color: "#1a2e4a" }}>18001232105</b>&nbsp; Mon–Sat 9AM–9PM
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
          onSelect={async item => {
            setProdPopup(null);
            await fillItemsIntoRow(prodPopup.rid, item.Id);
          }}
          onClose={() => setProdPopup(null)}
          anchorPos={prodPopup.pos}
        />
      )}

      {expWin && (
        <ExpDateWindow
          productId={expWin.productId}
          onSave={handleExpDateSave}
          onClose={() => setExpWin(null)}
        />
      )}

      <CC.ToastList toasts={toasts} />
    </div>
  );
}