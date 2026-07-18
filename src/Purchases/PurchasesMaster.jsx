// ─────────────────────────────────────────────────────────────────────────────
//  PurchasesMaster.jsx  —  Full rewrite with all bugs fixed
//
//  Fixes applied:
//  1. FORM_COLUMNS moved to module level (was inside component — recreated every render)
//  2. handleFocusFormColOpen — fixed useCallback deps (was copy-pasted from useEffect)
//  3. Global keyboard useEffect — added handleFocusFormColOpen + focusFormColOpen to deps/guard
//  4. Mount useEffect — merged two duplicate effects into one (loadMaxPurchaseNo/loadSuppliers were called twice)
//  5. Column config useEffect — added loadFocusFormColumns
//  6. applyBillDiscount — fixed setRows→setGridRows, calcSaleRow→calcRow, CC.vn→valNum (was referencing non-existent fns)
//  7. Inclusive Purchase Rate — fixed infinite-reduction bug: PurchaseRate cell now only
//     re-derives IncPurRate when the user actually edits it; otherwise the exclusive rate
//     is always recomputed from the stored IncPurRate (never from the already-converted value).
//  8. F2 Free Product — the row now turns green (like the legacy jQuery "editedRow" cellclass)
//     whenever FreeQtyStatus === 1, so it's visually obvious which rows are free-product rows.
//  9. PURCHASE MODE (Purchase / Sales Patty / Arrival / Patty Bill) — ported from
//     frmpurchase.cs rdbpurchase/rdbpatti/rdbsalespatty/rdbarrival + clsfunction.CMBTPatty.
//     A 4-way radio group drives dynamic labels (Purchase No→Arrival No, etc.), extra
//     Arrival fields (Days / Dispatched Date), a Patty side-panel (Commission % or
//     Lorry-Freight/Cooly Bag-Rate × Kgs/Bags — mirrors grdPatty math exactly), and the
//     deduction of the Patty total from the Net Amount. Default mode is PURCHASE, so every
//     existing calculation/validation/save path behaves exactly as before unless the user
//     explicitly switches mode.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./PurchasesMaster.css";
import Topbar from "../components/Topbar";
import * as CC  from "../components/Common";
import * as CC1 from "../components/Common";
import * as MSG from "../components/Messages";

// ── Grid Combo Popup ─────────────────────────────────────────────────────────
function GridComboPopup({ state, setState, sess, setLoading, handleCellChange, setColorList, setSizeList, setModelList, setBrandList, moveToNextCell }) {
  const [q, setQ] = useState(state.query || "");
  const [hilite, setHilite] = useState(0);
  const [localLoading, setLocalLoading] = useState(false);
  const listRef = useRef(null);
  const srchRef = useRef(null);
  
  const filt = state.list.filter(x => (x[state.labelProp]||"").toLowerCase().includes(q.toLowerCase()));
  const isNew = q.trim().length > 0 && filt.length === 0 && !state.list.some(x => (x[state.labelProp]||"").toLowerCase() === q.trim().toLowerCase());

  useEffect(() => { setTimeout(() => srchRef.current?.focus(), 50); }, []);
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${hilite}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [hilite]);

  const onClose = () => setState(p => ({ ...p, open: false }));

  const onSelect = (item) => {
    handleCellChange(state.rowKey, state.colKey, item[state.valueProp]);
    onClose();
    moveToNextCell(state.rowKey, state.colKey);
  };

  const onCreate = async () => {
    if (!isNew || localLoading) return;
    setLocalLoading(true);
    let apiEndpoint = "";
    let payload = {};
    if (state.colKey === "ColorId") {
      apiEndpoint = CC.InsertColor;
      payload = [{ Id:0, ColorName: q.trim(), Active: 1, EditMode: 1 }];
    } else if (state.colKey === "SizeId") {
      apiEndpoint = CC.SizeInsert;
      payload = [{ Id:0, SizeName: q.trim(), Active: 1, EditMode: 1 }];
    } else if (state.colKey === "ModelId") {
      apiEndpoint = CC.InsertModel;
      payload = [{ Id:0,ModelName: q.trim(), Active: 1, EditMode: 1 }];
    } else if (state.colKey === "BrandId") {
      apiEndpoint = CC.BrandInsert;
      payload = [{ Id:0,BrandName: q.trim(), Active: 1, EditMode: 1 }];
    }
    
    try {
      const res = await CC.insertapi(apiEndpoint, payload, {
        Comid:       String(parseInt(sess.Comid)),
        MirrorTable: String(sess.MirrorTable),
        IdComList:   "",
        ApiType:     "0",
      });
      if (res.ok ?? res.IsSuccess ?? true) {
        if (state.colKey === "ColorId") {
          const lres = await CC.api(CC.SelectColor, null, {}, { Comid: sess.MComid });
          const nl = Array.isArray(lres) ? lres : (lres?.data ?? lres?.Data1 ?? []);
          setColorList(nl);
          const match = nl.find(x => x.ColorName.toLowerCase() === q.trim().toLowerCase());
          if (match) onSelect(match); else onClose();
        } else if (state.colKey === "SizeId") {
          const lres = await CC.api(CC.SizeSelect, null, {}, { Comid: sess.MComid });
          const nl = Array.isArray(lres) ? lres : (lres?.data ?? lres?.Data1 ?? []);
          setSizeList(nl);
          const match = nl.find(x => x.SizeName.toLowerCase() === q.trim().toLowerCase());
          if (match) onSelect(match); else onClose();
        } else if (state.colKey === "ModelId") {
          const lres = await CC.api(CC.SelectModel, null, {}, { Comid: sess.MComid });
          const nl = Array.isArray(lres) ? lres : (lres?.data ?? lres?.Data1 ?? []);
          setModelList(nl);
          const match = nl.find(x => x.ModelName.toLowerCase() === q.trim().toLowerCase());
          if (match) onSelect(match); else onClose();
        } else if (state.colKey === "BrandId") {
          const lres = await CC.api(CC.BrandSelect, null, {}, { Comid: sess.MComid });
          const nl = Array.isArray(lres) ? lres : (lres?.data ?? lres?.Data1 ?? []);
          setBrandList(nl);
          const match = nl.find(x => x.BrandName.toLowerCase() === q.trim().toLowerCase());
          if (match) onSelect(match); else onClose();
        }
      } else {
        alert("Failed to create " + state.title);
        onClose();
      }
    } catch (e) {
      console.error(e);
      alert("Error creating " + state.title);
      onClose();
    }
    setLocalLoading(false);
  };

  return (
    <div className="mp-ov" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mp-modal-box" style={{ width: 340, maxHeight: "65vh" }}>
        <div className="mp-modal-hdr">
          <span>🔽 {state.title}</span>
          <button onClick={onClose}>✕</button>
        </div>
        <input ref={srchRef} value={q}
          onChange={e => { setQ(e.target.value); setHilite(0); }}
          onKeyDown={e => {
            if (e.key === "ArrowDown") { e.preventDefault(); setHilite(h => Math.min(h + 1, filt.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setHilite(h => Math.max(h - 1, 0)); }
            if (e.key === "Enter") {
              e.preventDefault();
              if (filt.length > 0) onSelect(filt[hilite] ?? filt[0]);
              else if (isNew) onCreate();
            }
            if (e.key === "Escape") { e.preventDefault(); onClose(); }
          }}
          placeholder={`Search ${state.title}...`}
          style={{ margin: "7px 8px", width: "calc(100% - 16px)", padding: "5px 8px", border: "1px solid #c5d8f8", borderRadius: 4, fontSize: 12, outline: "none", boxSizing: "border-box" }}
        />
        <div ref={listRef} style={{ flex: 1, overflowY: "auto", minHeight: 150 }}>
          {localLoading ? (
            <div style={{ padding: "10px", textAlign: "center", color: "#666" }}>Saving...</div>
          ) : filt.length === 0 ? (
            <div className="mp-dd-empty" style={{ padding: "10px", color: "#999" }}>No results for "{q}"</div>
          ) : (
            filt.map((item, idx) => (
              <div key={item[state.valueProp]} data-idx={idx}
                style={{ padding: "6px 12px", cursor: "pointer", background: idx === hilite ? "#3b82f6" : "#fff", color: idx === hilite ? "#fff" : "#333" }}
                onClick={() => onSelect(item)}
                onMouseEnter={() => setHilite(idx)}>
                {item[state.labelProp]}
              </div>
            ))
          )}
        </div>
        {isNew && !localLoading && (
          <div style={{ padding: "8px", background: "#f0fdf4", color: "#166534", borderTop: "1px solid #bbf7d0", cursor: "pointer", fontWeight: 600, fontSize: 13 }}
            onClick={onCreate}>
            ➕ Create new {state.title}: <strong>"{q.trim()}"</strong>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────
const valNum   = (v)  => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const nullStr  = (v)  => (v == null || v === undefined ? "" : String(v));
const roundOff = (v)  => Math.round(valNum(v) * 100) / 100;
const fmt2     = (v)  => valNum(v).toFixed(2);
const fmt0     = (v)  => valNum(v).toFixed(0);
const today    = ()   => new Date().toISOString().split("T")[0];
const jsonDate = (s)  => {
  if (!s) return today();
  const m = /\/Date\((\d+)\)\//.exec(s);
  if (m) return new Date(+m[1]).toISOString().split("T")[0];
  return s.split("T")[0];
};

// ─── Blank grid-row factory ───────────────────────────────────────────────────
const makeGridRow = () => ({
  _key:               CC.uid(),
  PDId:               "",
  ProductRefId:       "",
  ProductCode:        "",
  ProductName:        "",
  HSNCode:            "",
  UOM:                "",
  UOMDecimal:         3,
  UOMRefid:           "",
  MRP:                "0.00",
  OldMRP:             "0.00",
  OldPurchaseRate:    "0.00",
  PurchaseRate:       "0.00",
  IncPurRate:         "0.00",
  PurchaserateTemp:   "0.00",
  cdpercent:          "0.00",
  cdAmount:           "0.00",
  DiscountPercent:    "0.00",
  DiscountAmt:        "0.00",
  CESSPer:            "0.00",
  CESSAmount:         "0.00",
  SPLCESS:            "0.00",
  SPLCESSAmount:      "0.00",
  TaxPercent:         "0.00",
  TaxAmt:             "0.00",
  CTAmount:           "0.00",
  STAmount:           "0.00",
  CTPer:              "0.00",
  STPer:              "0.00",
  Noms:               "0",
  NomQty:             "0",
  ItemQty:            "0",
  FreeQty:            "0.00",
  StockQty:           "0.00",
  StockQtyNew:        "0.00",
  Nstock:             "0.00",
  RealQty:            "0.00",
  TotalPcs:           "0.00",
  Meter:              "0.00",
  Pcs:                "0.00",
  ExpiryDate:         "",
  MfgDate:            today(),
  Bat_No:             "",
  BatchRefId:         "",
  BatchStatus:        0,
  Expirydays:         "0",
  Salerate:           "0.00",
  WholeSalerate:      "0.00",
  ProfitPer:          "0.00",
  ProfitAmt:          "0.00",
  SaleDiscPer:        "0.00",
  SaleDiscAmt:        "0.00",
  NetSaleRate:        "0.00",
  SaleGST:            "0.00",
  SizeDiff:           "0.00",
  Sizeper:            "0.00",
  SizeAmt:            "0.00",
  TransPer:           "0.00",
  TransAmt:           "0.00",
  LandingCost:        "0.00",
  IGSTAmt:            "0.00",
  Amount:             "0.00",
  ProductTotal:       "0.00",
  PoRefId:            "",
  EditMode:           0,
  SerialNoStatus:     0,
  FreeQtyStatus:      0,
  MrpStatus:          0,
  Narration:          "",
  TextRefId:          "",
  SizeId:             "",
  BrandId:            "",
  ModelId:            "",
  ColorId:            "",
  GengerId:           "",
  // ── Patty / Arrival grid fields (mirror grdPurchaseBags / LotNo / Mark in frmpurchase.cs) ──
  Bags:               "0.00",
  LotNo:              "",
  Mark:               "",
  ToSizeId:           "",
  SizeCombo:          "",
  BrandCombo:         "",
  ModelCombo:         "",
  ColorCombo:         "",
  GengerCombo:        "",
  ToSizeCombo:        "",
});

// ─── Blank totals ─────────────────────────────────────────────────────────────
const EMPTY_TOTALS = {
  productTotal: "0.00",
  transAmt:     "0.00",
  cdAmt:        "0.00",
  discAmt:      "0.00",
  gstAmt:       "0.00",
  cessAmt:      "0.00",
  cgstAmt:      "0.00",
  sgstAmt:      "0.00",
  netAmt:       "0.00",
  displayAmt:   "0.00",
  totalQty:     "0.00",
};

// ─── Batch No label ───────────────────────────────────────────────────────────
const getBatchNoLabel = () => {
  try {
    const ms = JSON.parse(localStorage.getItem("Mainsetting") || "[{}]");
    const name = ms?.[0]?.BatchNoName;
    return name && name.trim() !== "" ? name : "Batch No";
  } catch { return "Batch No"; }
};

// ─── Grid column definitions ──────────────────────────────────────────────────
// NOTE: Bags / LotNo / Mark carry `modes` — they are only shown when purchaseMode
// is ARRIVAL / PATTY / SALESPATTY (mirrors grdPurchase.Columns[...].Visible toggling
// inside LoadArrival() in frmpurchase.cs). All other columns are visible in every mode
// (modes: undefined ⇒ "always").
const BASE_COLUMNS = [
  { key: "ProductCode",     label: "Product Code",  defaultWidth: 110, align: "left",  editable: true,  type: "text",  defaultVisible: true  },
  { key: "ProductName",     label: "Description",   defaultWidth: 200, align: "left",  editable: true,  type: "text",  defaultVisible: true  },
  { key: "HSNCode",         label: "HSN Code",      defaultWidth: 90,  align: "left",  editable: true,  type: "text",  defaultVisible: true  },
  { key: "MRP",             label: "MRP",           defaultWidth: 80,  align: "right", editable: true,  type: "num",   defaultVisible: true  },
  { key: "PurchaseRate",    label: "Pur.Rate",      defaultWidth: 85,  align: "right", editable: true,  type: "num",   defaultVisible: true  },
  { key: "NomQty",          label: "NomQty",        defaultWidth: 70,  align: "right", editable: true,  type: "int",   defaultVisible: true  },
  { key: "UOM",             label: "UOM",           defaultWidth: 60,  align: "left",  editable: false, type: "text",  defaultVisible: true  },
  { key: "StockQty",        label: "Stock",         defaultWidth: 70,  align: "right", editable: false, type: "num",   defaultVisible: true  },
  { key: "ItemQty",         label: "Quantity",      defaultWidth: 80,  align: "right", editable: true,  type: "num",   defaultVisible: true  },
  { key: "FreeQty",         label: "Free Qty",      defaultWidth: 75,  align: "right", editable: true,  type: "num",   defaultVisible: true  },
  { key: "Bags",            label: "Bags",          defaultWidth: 70,  align: "right", editable: true,  type: "num",   defaultVisible: true,  modes: ["ARRIVAL", "PATTY", "SALESPATTY"] },
  { key: "cdpercent",       label: "C.D(%)",        defaultWidth: 70,  align: "right", editable: true,  type: "num",   defaultVisible: true  },
  { key: "cdAmount",        label: "C.D Amt",       defaultWidth: 75,  align: "right", editable: false, type: "num",   defaultVisible: true  },
  { key: "DiscountPercent", label: "Disc(%)",       defaultWidth: 65,  align: "right", editable: true,  type: "num",   defaultVisible: true  },
  { key: "DiscountAmt",     label: "Disc Amt",      defaultWidth: 75,  align: "right", editable: false, type: "num",   defaultVisible: true  },
  { key: "TaxPercent",      label: "GST(%)",        defaultWidth: 65,  align: "right", editable: true,  type: "num",   defaultVisible: true  },
  { key: "TaxAmt",          label: "GST Amt",       defaultWidth: 75,  align: "right", editable: false, type: "num",   defaultVisible: true  },
  { key: "CESSPer",         label: "CESS(%)",       defaultWidth: 65,  align: "right", editable: true,  type: "num",   defaultVisible: false },
  { key: "CESSAmount",      label: "CESS Amt",      defaultWidth: 75,  align: "right", editable: false, type: "num",   defaultVisible: false },
  { key: "LandingCost",     label: "Landing Cost",  defaultWidth: 100, align: "right", editable: false, type: "num",   defaultVisible: true  },
  { key: "Bat_No",          label: getBatchNoLabel(), defaultWidth: 90, align: "left",  editable: true,  type: "text",  defaultVisible: false },
  { key: "MfgDate",         label: "Mfg Date",      defaultWidth: 95,  align: "left",  editable: true,  type: "date",  defaultVisible: false },
  { key: "ExpiryDate",      label: "Exp Date",      defaultWidth: 95,  align: "left",  editable: true,  type: "date",  defaultVisible: false },
  { key: "LotNo",           label: "Lot No",        defaultWidth: 90,  align: "left",  editable: true,  type: "text",  defaultVisible: true,  modes: ["ARRIVAL", "PATTY", "SALESPATTY"] },
  { key: "Mark",            label: "Mark",          defaultWidth: 90,  align: "left",  editable: true,  type: "text",  defaultVisible: true,  modes: ["ARRIVAL", "PATTY", "SALESPATTY"] },
  { key: "Salerate",        label: "Sale Rate",     defaultWidth: 85,  align: "right", editable: true,  type: "num",   defaultVisible: true  },
  { key: "BrandId",         label: "Brand",         defaultWidth: 100, align: "left",  editable: true,  type: "text",  defaultVisible: true  },
  { key: "ModelId",         label: "Model",         defaultWidth: 100, align: "left",  editable: true,  type: "text",  defaultVisible: true  },
  { key: "ColorId",         label: "Color",         defaultWidth: 100, align: "left",  editable: true,  type: "text",  defaultVisible: true  },
  { key: "SizeId",          label: "Size",          defaultWidth: 100, align: "left",  editable: true,  type: "text",  defaultVisible: true  },
  { key: "Amount",          label: "Amount",        defaultWidth: 90,  align: "right", editable: false, type: "num",   defaultVisible: true  },
];

const makeDefaultColConfig = () =>
  BASE_COLUMNS.map((c) => ({ key: c.key, visible: c.defaultVisible, width: c.defaultWidth }));

// ─── CALC_KEYS ────────────────────────────────────────────────────────────────
const CALC_KEYS = new Set([
  "MRP", "PurchaseRate", "cdpercent", "DiscountPercent", "CESSPer", "SPLCESS",
  "TaxPercent", "FreeQty", "TransPer", "ItemQty", "NomQty", "Salerate",
  "ProfitPer", "SaleDiscPer", "SaleGST", "Meter", "Pcs", "WholeSalerate",
]);

// ─── BATCH_ID_KEYS — no financial recalc needed ───────────────────────────────
const BATCH_ID_KEYS = new Set(["BrandId", "ModelId", "ColorId", "SizeId"]);

// ─── FIX 1: FORM_COLUMNS at module level (not inside component) ──────────────
// Was inside the component body — caused recreation on every render and broke
// useCallback dependency arrays that referenced it indirectly via loadFocusFormColumns.
const FORM_COLUMNS = [
  { column: "dtppurchasedate", text: "PurchaseDate" },
  { column: "cmbpurchaseType", text: "PurchaseType" },
  { column: "dtpduedate",      text: "DueDate"      },
  { column: "cmbsupplier",     text: "Supplier"     },
  { column: "txtinvoiceno",    text: "InvoiceNo"    },
  { column: "dtpinvoicedate",  text: "InvoiceDate"  },
  { column: "txtinvoiceamt",   text: "InvoiceAmt"   },
  { column: "gridpurchase",    text: "GridPurchase" },
  { column: "txtotherplus",    text: "Others(+)"    },
  { column: "txtothersub",     text: "Others(-)"    },
  { column: "txtremarks",      text: "Remarks"      },
];

// ─── PATTY_ROW_TEMPLATE — mirrors grdPatty seed rows (COMMISSION/LORRY FREIGHT/COOLY) ─
// used only as a fallback when PattySelect returns nothing yet, so the panel isn't empty.
const PATTY_ROW_TEMPLATE = [
  { Id: 0, PattyName: "COMMISSION" },
  { Id: 0, PattyName: "LORRY FREIGHT" },
  { Id: 0, PattyName: "COOLY" },
];

// ─── MODE_LABELS — mirrors the lbPurchaseNo/lbPurchaseDate/lbPurchaseType.Text
// swap done inside LoadArrival() in frmpurchase.cs for each radio mode. ─────────
const MODE_LABELS = {
  PURCHASE:   { no: "Purchase No",  date: "Purchase Date",   type: "Purchase Type",   title: "Purchase Details"  },
  ARRIVAL:    { no: "Arrival No",   date: "Arrival Date",    type: "Arrival Type",    title: "Arrival Details"   },
  PATTY:      { no: "Patty No",     date: "Arrival Date",    type: "Patty Type",      title: "Patty Details"     },
  SALESPATTY: { no: "SalePatty No", date: "SalePatty Date",  type: "SalePatty Type",  title: "SalePatty Details" },
};

// ─── TotalRow sub-component ───────────────────────────────────────────────────
function TotalRow({ label, value }) {
  return (
    <div className="total-row">
      <span className="total-label">{label}</span>
      <span className="total-value">{value}</span>
    </div>
  );
}
// exceedsDecimalLimit — UOMDecimal-ஐ விட அதிகமான decimal digits இருந்தா true return பண்ணும்.
// UOMDecimal = 2 → "12.345" (dot-க்கு பின் 3 digits) => true (block பண்ணனும்)
// UOMDecimal = 0 → "." கூட allow பண்ணக்கூடாது
const exceedsDecimalLimit = (value, decimals) => {
  const str = String(value ?? "");
  const dotIdx = str.indexOf(".");
  if (dotIdx === -1) return false;
  const fracLen = str.length - dotIdx - 1;
  return fracLen > valNum(decimals);
};
// ─── PurchasesMaster ──────────────────────────────────────────────────────────
export default function Purchase() {
  const navigate = useNavigate();

  const { confirm, ConfirmUI } = MSG.useConfirm();
  const { toast,   toasts    } = MSG.useToast();

  // ── Permission / authorization ─────────────────────────────────────────────
  const [perm,         setPerm        ] = useState({ View: 0, Add: 0, Edit: 0, Delete: 0 });
  const [isAuthorized, setIsAuthorized] = useState(false);

  const redirectIfDualLogin = useCallback((res) => {
    if (res?._dualLogin || res?.redis === false) {
      alert("Already Login Another User Please Login Again!!!");
      navigate("/");
      return true;
    }
    return false;
  }, [navigate]);

  useEffect(() => {
    const menuStr = localStorage.getItem("menulist");
    if (!menuStr) { alert("Session Close Please Login !!!."); navigate("/"); return; }
    const menulist = JSON.parse(menuStr);
    const menudata = menulist.filter(obj => obj.PageName === "Purchase");
    if (!menudata || menudata.length === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => navigate("/Home"), 3000);
      return;
    }
    if (menudata[0].View === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => navigate("/Home"), 3000);
      return;
    }
    setPerm({ View: menudata[0].View, Add: menudata[0].Add, Edit: menudata[0].Edit, Delete: menudata[0].Delete });
    setIsAuthorized(true);
  }, [navigate]);

  // ── Session ────────────────────────────────────────────────────────────────
  const [sess] = useState(() => {
    try { return CC.buildSession("Purchase"); }
    catch { return { Comid: "1", MComid: "1", IdComList: "1", MirrorTable: "0", menudata: [] }; }
  });

  // ── Master-form state ──────────────────────────────────────────────────────
  const [purchaseNo,    setPurchaseNo   ] = useState("");
  const [purchaseDate,  setPurchaseDate ] = useState(today());
  const [dueDate,       setDueDate      ] = useState(today());
  const [invoiceDate,   setInvoiceDate  ] = useState(today());
  const [invoiceNo,     setInvoiceNo    ] = useState("");
  const [invoiceAmt,    setInvoiceAmt   ] = useState("0.00");
  const [f3PromptOpen,  setF3PromptOpen ] = useState(false);
  const [f3PromptValue, setF3PromptValue] = useState("");
  const [f3PromptError, setF3PromptError] = useState("");
  const f3InputRef = useRef(null);
  const [remarks,       setRemarks      ] = useState("");
  const [purchaseType,  setPurchaseType ] = useState("CREDIT");
  const [igstStatus,    setIgstStatus   ] = useState("GST");
  const [igstChecked,   setIgstChecked  ] = useState(false);
  const [supplierList,  setSupplierList ] = useState([]);
  const [supplierId,    setSupplierId   ] = useState("");
  const [supplierInfo,  setSupplierInfo ] = useState({ address: "", city: "", phone: "", balance: "0.00" });
  const [creditDays,    setCreditDays   ] = useState(0);
  const [taxMode,       setTaxMode      ] = useState("exclusive");
  const [purRateInclusive, setPurRateInclusive] = useState(false);
  const [otherPlus,     setOtherPlus    ] = useState("0.00");
  const [otherSub,      setOtherSub     ] = useState("0.00");
  const [tcsPercent,    setTcsPercent   ] = useState("0.00"); // eslint-disable-line
  const [tcsAmt,        setTcsAmt       ] = useState("0.00"); // eslint-disable-line
  const [loadding,      setLoadding     ] = useState("");     // eslint-disable-line
  const [lorryNo,       setLorryNo      ] = useState("");     // eslint-disable-line
  const [discPer,       setDiscPer      ] = useState("0.00");

  // ── PURCHASE MODE (mirrors rdbpurchase / rdbpatti / rdbsalespatty / rdbarrival +
  //     clsfunction.CMBTPatty in frmpurchase.cs) ───────────────────────────────
  // "PURCHASE" (default) → every existing calculation/validation/save path is
  // 100% unchanged. Switching mode only adds behaviour on top; nothing about the
  // PURCHASE-mode path is altered.
  const [purchaseMode, setPurchaseMode] = useState("PURCHASE"); // PURCHASE | PATTY | SALESPATTY | ARRIVAL
  // Derived flag — true whenever the Patty side-panel + deduction math should engage
  // (mirrors "PattyStatus == 2" i.e. rdbpatti or rdbsalespatty checked in the .cs).
  const pattyMode = purchaseMode === "PATTY" || purchaseMode === "SALESPATTY";
  const modeLabels = MODE_LABELS[purchaseMode];
const [pattyFeatureEnabled, setPattyFeatureEnabled] = useState(true);
  // Arrival-only fields (mirror txtdays / dtpdispatchedDate in the .cs)
  const [arrivalDays,    setArrivalDays   ] = useState(0);
  const [dispatchedDate, setDispatchedDate] = useState(today());

  // Patty vehicle/person fields (mirror txtvehicleno / txtperson / dtppattidate)
  const [pattyVehicleNo, setPattyVehicleNo] = useState("");
  const [pattyPerson,    setPattyPerson]    = useState("");
  const [pattyDate,      setPattyDate]      = useState(today());

  // Patty grid rows (Commission / Lorry Freight / Cooly) — loaded from PattySelect
  // the first time the user switches into PATTY / SALESPATTY mode.
  const [pattyRows,   setPattyRows  ] = useState([]);
  const [pattyLoaded, setPattyLoaded] = useState(false);

  // Arrival: Days → Dispatched Date auto-fill (mirrors the DueDate auto-fill pattern
  // already used for creditDays below, applied instead to Arrival's own date pair).
  useEffect(() => {
    if (purchaseMode !== "ARRIVAL" || !arrivalDays) return;
    const base = new Date(purchaseDate);
    if (isNaN(base.getTime())) return;
    base.setDate(base.getDate() + arrivalDays);
    setDispatchedDate(base.toISOString().split("T")[0]);
  }, [purchaseDate, arrivalDays, purchaseMode]);

  // ── Supplier autocomplete ──────────────────────────────────────────────────
  const [supplierQuery,    setSupplierQuery   ] = useState("");
  const [supplierDropdown, setSupplierDropdown] = useState([]);
  const [supplierDDOpen,   setSupplierDDOpen  ] = useState(false);
  const [supplierSelIdx,   setSupplierSelIdx  ] = useState(0);

  // ── Totals ─────────────────────────────────────────────────────────────────
  const [totals, setTotals] = useState(EMPTY_TOTALS);

  // ── Grid ───────────────────────────────────────────────────────────────────
  const [gridRows,     setGridRows    ] = useState([makeGridRow()]);
  const [selectedCell, setSelectedCell] = useState({ rowKey: null, colKey: null });
  const [gstSplit,     setGstSplit    ] = useState([]);

  // ── Search / view ──────────────────────────────────────────────────────────
  const [searchNo,  setSearchNo ] = useState("");
  const [viewList,  setViewList ] = useState([]); // eslint-disable-line

  // ── Edit state ─────────────────────────────────────────────────────────────
  const [editId,      setEditId     ] = useState(0);
  const [updateIdEdit,setUpdateIdEdit] = useState("");
  const [loading,     setLoading    ] = useState(false);

  // ── Edit Password modal ────────────────────────────────────────────────────
  const [editPwdOpen,       setEditPwdOpen      ] = useState(false);
  const [editPwdValue,      setEditPwdValue     ] = useState("");
  const [editPwdLoading,    setEditPwdLoading   ] = useState(false);
  const [editPwdError,      setEditPwdError     ] = useState("");
  const [pendingEditAction, setPendingEditAction] = useState(null);

  // ── Popups ─────────────────────────────────────────────────────────────────
  const [productPopup,    setProductPopup   ] = useState({ open: false, rowKey: null, list: [], query: "" });
  const [mrpPopup,        setMrpPopup       ] = useState({ open: false, rowKey: null, list: [] });
  const [itemCreatePopup, setItemCreatePopup] = useState({ open: false, rowKey: null, code: "" });
  const [serialNoPopup,   setSerialNoPopup  ] = useState({ open: false, rowKey: null, textRefId: "", list: [], returnColKey: "ItemQty" });
  const [serialNoList,    setSerialNoList   ] = useState([]);
  const [gridComboPopup,  setGridComboPopup ] = useState({ open: false, rowKey: null, colKey: null, query: "", list: [], valueProp: "", labelProp: "", title: "" });


  // ── BatchWise masters ──────────────────────────────────────────────────────
  const [batchWise,  setBatchWise ] = useState(false);
  const [brandList,  setBrandList ] = useState([]);
  const [modelList,  setModelList ] = useState([]);
  const [colorList,  setColorList ] = useState([]);
  const [sizeList,   setSizeList  ] = useState([]);

  // ── F5 List View ───────────────────────────────────────────────────────────
  const [listViewOpen,     setListViewOpen    ] = useState(false);
  const [f5MasterList,     setF5MasterList    ] = useState([]);
  const [f5DetailList,     setF5DetailList    ] = useState([]);
  const [f5TotalAmt,       setF5TotalAmt      ] = useState("0.00");
  const [f5ExpandedRow,    setF5ExpandedRow   ] = useState(null);
  const [fromDate,         setFromDate        ] = useState(today());
  const [toDate,           setToDate          ] = useState(today());
  const [f5SupplierId,     setF5SupplierId    ] = useState("");
  const [f5SupplierSearch, setF5SupplierSearch] = useState("");
  const [f5SupplierOpen,   setF5SupplierOpen  ] = useState(false);
  const [f5SupplierHi,     setF5SupplierHi    ] = useState(0);

  // ── F12 column config ──────────────────────────────────────────────────────
  const [f12Open,   setF12Open  ] = useState(false);
  const [colConfig, setColConfig] = useState(() => makeDefaultColConfig());
  const [f12Draft,  setF12Draft ] = useState([]);
  const colConfigRef = useRef(makeDefaultColConfig());

  useEffect(() => { colConfigRef.current = colConfig; }, [colConfig]);

  // ── Ctrl+G Grid Focus Columns ──────────────────────────────────────────────
  const [focusColOpen,    setFocusColOpen   ] = useState(false);
  const [focusColDraft,   setFocusColDraft  ] = useState([]);
  const [focusColDragIdx, setFocusColDragIdx] = useState(null);

  // ── Ctrl+F Form Focus Columns ──────────────────────────────────────────────
  const [focusFormColOpen,    setFocusFormColOpen   ] = useState(false);
  const [focusFormColDraft,   setFocusFormColDraft  ] = useState([]);
  const [focusFormDragIdx,    setFocusFormDragIdx   ] = useState(null);

  // ── Batch-column visibility flags ──────────────────────────────────────────
  const bStatus = batchWise && (colConfig.find(c => c.key === "BrandId")?.visible ?? true) ? 1 : 0;
  const sStatus = batchWise && (colConfig.find(c => c.key === "SizeId" )?.visible ?? true) ? 1 : 0;
  const cStatus = batchWise && (colConfig.find(c => c.key === "ColorId")?.visible ?? true) ? 1 : 0;
  const mStatus = batchWise && (colConfig.find(c => c.key === "ModelId")?.visible ?? true) ? 1 : 0;

  // ── Column visibility helper — combines F12 colConfig with mode-restricted
  // columns (Bags/LotNo/Mark only in ARRIVAL/PATTY/SALESPATTY; mirrors the
  // grdPurchase.Columns[...].Visible toggling in LoadArrival()). ───────────────
  const isColVisible = useCallback((col) => {
    if (col.modes && !col.modes.includes(purchaseMode)) return false;
    const cfg = colConfig.find((x) => x.key === col.key);
    return cfg ? cfg.visible : col.defaultVisible;
  }, [colConfig, purchaseMode]);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const supplierRef          = useRef(null);
  const invoiceNoRef         = useRef(null);
  const invoiceAmtRef        = useRef(null);
  const remarksRef           = useRef(null);
  const purchaseDateRef      = useRef(null);
  const dueDateRef           = useRef(null);
  const invoiceDateRef       = useRef(null);
  const purchaseTypeRef      = useRef(null);
  const otherPlusRef         = useRef(null);
  const otherSubRef          = useRef(null);
  const gridRef              = useRef(null);
  const supplierContainerRef = useRef(null);
  const focusCellRef         = useRef(null);
  const f12PrevCellRef       = useRef(null);
  const initialFocusDone     = useRef(false);

  // ─────────────────────────────────────────────────────────────────────────
  //  ROW CALCULATION
  // ─────────────────────────────────────────────────────────────────────────
//   const calcRow = useCallback((row) => {
//     const qty        = valNum(row.ItemQty) + valNum(row.NomQty);
//     const nomqty     = valNum(row.NomQty) === 0 ? 1 : valNum(row.NomQty);
//     const purRate    = valNum(row.PurchaseRate);
    
//     // Calculate the raw amounts based on entered rate
//     const enteredAmt = roundOff(purRate * qty);
//     const cdAmt      = roundOff(enteredAmt * (valNum(row.cdpercent) / 100));
//     const discAmt    = roundOff((enteredAmt - cdAmt) * (valNum(row.DiscountPercent) / 100));
//     const netEnteredAmt = enteredAmt - cdAmt - discAmt;

//     let taxableAmt, gstAmt;
//     const taxPercent = valNum(row.TaxPercent);

//     if (taxMode === "inclusive") {
//         taxableAmt = roundOff(netEnteredAmt / (1 + (taxPercent / 100)));
//         gstAmt = roundOff(netEnteredAmt - taxableAmt);
//     } else {
//         taxableAmt = roundOff(netEnteredAmt);
//         gstAmt = roundOff(taxableAmt * (taxPercent / 100));
//     }

//     const netRate = qty !== 0 ? roundOff(taxableAmt / qty) : 0;
//     const transAmt   = roundOff(taxableAmt * (valNum(row.TransPer) / 100));
//     const cessAmt    = roundOff(taxableAmt * (valNum(row.CESSPer) / 100));
//     const splCessAmt = roundOff(qty * valNum(row.SPLCESS));

//     const isIGST = igstStatus === "IGST" || igstStatus === "UGST";
//     const ctAmt = isIGST ? gstAmt : roundOff(gstAmt / 2);
//     const stAmt = isIGST ? 0 : gstAmt - ctAmt;
//     const igstAmtOut = 0;

//     const landingCost = qty !== 0
//       ? roundOff(netRate + (gstAmt + cessAmt + splCessAmt) / qty)
//       : 0;

//     let amount;
//     if (taxMode === "inclusive") {
//        amount = roundOff(netEnteredAmt + cessAmt + splCessAmt + transAmt);
//     } else {
//        amount = roundOff(netEnteredAmt + gstAmt + cessAmt + splCessAmt + transAmt);
//     }

//     const stockQty  = roundOff(nomqty * qty + valNum(row.FreeQty));
//    return {
//   ...row,
//   PurchaseRate: taxMode === "inclusive"
//     ? fmt2(netRate)
//     : row.PurchaseRate,

//   cdAmount:      fmt2(cdAmt),
//   DiscountAmt:   fmt2(discAmt),
//   TransAmt:      fmt2(transAmt),
//   CESSAmount:    fmt2(cessAmt),
//   SPLCESSAmount: fmt2(splCessAmt),
//   TaxAmt:        fmt2(gstAmt),
//   CTAmount:      fmt2(ctAmt),
//   STAmount:      fmt2(stAmt),
//   IGSTAmt:       fmt2(igstAmtOut),
//   LandingCost:   fmt2(landingCost),
//   Amount:        fmt2(amount),
//   ProductTotal:  fmt2(enteredAmt),
//   StockQtyNew:   fmt2(stockQty),
// };
//   }, [igstStatus, taxMode]);
// ─────────────────────────────────────────────────────────────────────────
  //  ROW CALCULATION
  // ─────────────────────────────────────────────────────────────────────────
  const calcRow = useCallback((row) => {
    const qty        = valNum(row.ItemQty) + valNum(row.NomQty);
    const nomqty     = valNum(row.NomQty) === 0 ? 1 : valNum(row.NomQty);
    const purRate    = valNum(row.PurchaseRate);

    // Calculate the raw amounts based on entered rate
    const enteredAmt = roundOff(purRate * qty);
    const cdAmt      = roundOff(enteredAmt * (valNum(row.cdpercent) / 100));
    const discAmt    = roundOff((enteredAmt - cdAmt) * (valNum(row.DiscountPercent) / 100));
    const netEnteredAmt = enteredAmt - cdAmt - discAmt;

    let taxableAmt, gstAmt;
    const taxPercent = valNum(row.TaxPercent);

    if (taxMode === "inclusive") {
        taxableAmt = roundOff(netEnteredAmt / (1 + (taxPercent / 100)));
        gstAmt = roundOff(netEnteredAmt - taxableAmt);
    } else {
        taxableAmt = roundOff(netEnteredAmt);
        gstAmt = roundOff(taxableAmt * (taxPercent / 100));
    }

    const netRate = qty !== 0 ? roundOff(taxableAmt / qty) : 0;
    const transAmt   = roundOff(taxableAmt * (valNum(row.TransPer) / 100));
    const cessAmt    = roundOff(taxableAmt * (valNum(row.CESSPer) / 100));
    const splCessAmt = roundOff(qty * valNum(row.SPLCESS));

    const isIGST = igstStatus === "IGST" || igstStatus === "UGST";
    const ctAmt = isIGST ? gstAmt : roundOff(gstAmt / 2);
    const stAmt = isIGST ? 0 : gstAmt - ctAmt;
    const igstAmtOut = 0;

    const landingCost = qty !== 0
      ? roundOff(netRate + (gstAmt + cessAmt + splCessAmt) / qty)
      : 0;

    let amount;
    if (taxMode === "inclusive") {
       amount = roundOff(netEnteredAmt + cessAmt + splCessAmt + transAmt);
    } else {
       amount = roundOff(netEnteredAmt + gstAmt + cessAmt + splCessAmt + transAmt);
    }

    const stockQty  = roundOff(nomqty * qty + valNum(row.FreeQty));

    return {
      ...row,
      cdAmount:      fmt2(cdAmt),
      DiscountAmt:   fmt2(discAmt),
      TransAmt:      fmt2(transAmt),
      CESSAmount:    fmt2(cessAmt),
      SPLCESSAmount: fmt2(splCessAmt),
      TaxAmt:        fmt2(gstAmt),
      CTAmount:      fmt2(ctAmt),
      STAmount:      fmt2(stAmt),
      IGSTAmt:       fmt2(igstAmtOut),
      LandingCost:   fmt2(landingCost),
      Amount:        fmt2(amount),
      ProductTotal:  fmt2(enteredAmt),
      StockQtyNew:   fmt2(stockQty),
    };
  }, [igstStatus, taxMode]);
  // Recalculate all rows when global tax settings change so existing rows reflect the new IGST/CGST split
  useEffect(() => {
    setGridRows((prev) => {
      let changed = false;
      const newRows = prev.map((r) => {
        if (r.ProductCode) {
          changed = true;
          return calcRow(r);
        }
        return r;
      });
      return changed ? newRows : prev;
    });
  }, [igstStatus, taxMode, calcRow]);

useEffect(() => {
  const mainSet = JSON.parse(localStorage.getItem("Mainsetting") || "[{}]");
  const val = mainSet?.[0]?.PattyStatus;
  const enabled = val === true || val === "true" || val === 1 || val === "1";
  setPattyFeatureEnabled("true");
  if (!enabled) setPurchaseMode("PURCHASE");
}, [isAuthorized]);
  // ─────────────────────────────────────────────────────────────────────────
  //  GST SPLIT + TOTALS
  // ─────────────────────────────────────────────────────────────────────────
  // Effect 1 — IGST/GST status மாறும்போது மட்டும் trigger ஆகணும்.
// calcRow-ஐ dependency-ல வைக்கல — ஏன்னா calcRow, igstStatus மாறும்போதே
// மாறும் (useCallback deps common), அதை வச்சா taxMode மாத்தும்போது
// இந்த effect தேவையில்லாம மறுபடி run ஆகி calcRow 2 தடவை call ஆகும்.
// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
  setGridRows((prev) => {
    let changed = false;
    const newRows = prev.map((r) => {
      if (r.ProductCode) {
        changed = true;
        return calcRow(r);
      }
      return r;
    });
    return changed ? newRows : prev;
  });
}, [igstStatus]);


const prevTaxModeRef = useRef(taxMode);
// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
  const prevMode = prevTaxModeRef.current;
  if (prevMode !== taxMode) {
    setGridRows((prev) => prev.map((r) => {
      if (!r.ProductCode) return r;
      const tax = valNum(r.TaxPercent);
      let rate = valNum(r.PurchaseRate);
      if (tax > 0) {
        if (prevMode === "exclusive" && taxMode === "inclusive") {
          rate = rate / (1 + tax / 100);
        } else if (prevMode === "inclusive" && taxMode === "exclusive") {
          rate = rate * (1 + tax / 100);
        }
      }
      return calcRow({ ...r, PurchaseRate: fmt2(rate) });
    }));
  }
  prevTaxModeRef.current = taxMode;
}, [taxMode]);
  const updateGstSplit = useCallback((rows) => {
    const map = {};
    rows.forEach((r) => {
      if (!r.ProductCode) return;
      const key = fmt2(valNum(r.TaxPercent));
      if (!map[key]) map[key] = { TaxPercent: key, TaxAmt: 0, CTAmount: 0, STAmount: 0 };
      map[key].TaxAmt   += valNum(r.TaxAmt);
      map[key].CTAmount += valNum(r.CTAmount);
      map[key].STAmount += valNum(r.STAmount);
    });
    setGstSplit(Object.values(map).filter((x) => valNum(x.TaxPercent) > 0));
  }, []);

  const recalcTotals = useCallback((rows) => {
    let prodTotal = 0, tGst = 0, tCess = 0, tSplCess = 0, tCt = 0, tSt = 0,
        tTrans = 0, tCd = 0, tDisc = 0, totalQty = 0;
    rows.forEach((r) => {
      if (nullStr(r.ProductCode) !== "") {
        prodTotal += valNum(r.ProductTotal);
        tGst      += valNum(r.TaxAmt);
        tCess     += valNum(r.CESSAmount);
        tSplCess  += valNum(r.SPLCESSAmount);
        tCt       += valNum(r.CTAmount);
        tSt       += valNum(r.STAmount);
        tTrans    += valNum(r.TransAmt);
        tCd       += valNum(r.cdAmount);
        tDisc     += valNum(r.DiscountAmt);
        totalQty  += valNum(r.ItemQty);
      }
    });
    const oPlus     = valNum(otherPlus);
    const oSub      = valNum(otherSub);
    const tcsPer    = valNum(tcsPercent);
    let grossTotal;
    if (taxMode === "inclusive") {
        grossTotal = prodTotal + tCess + tSplCess + tTrans + oPlus - tCd - tDisc - oSub;
    } else {
        grossTotal = prodTotal + tGst + tCess + tSplCess + tTrans + oPlus - tCd - tDisc - oSub;
    }
    const tcsAmt1   = roundOff(grossTotal * (tcsPer / 100));
    const netAmt    = roundOff(grossTotal + tcsAmt1);
    const newTotals = {
      productTotal: fmt2(prodTotal), transAmt: fmt2(tTrans),
      cdAmt: fmt2(tCd),             discAmt:  fmt2(tDisc),
      gstAmt: fmt2(tGst),           cessAmt:  fmt2(tCess),
      cgstAmt: fmt2(tCt),           sgstAmt:  fmt2(tSt),
      netAmt: fmt2(netAmt),         displayAmt: fmt2(netAmt),
      totalQty: fmt2(totalQty),
    };
    setTotals(newTotals);
    setTcsAmt(fmt2(tcsAmt1));
    updateGstSplit(rows);
    return newTotals;
  }, [otherPlus, otherSub, tcsPercent, updateGstSplit, taxMode]);

  useEffect(() => { recalcTotals(gridRows); }, [gridRows, otherPlus, otherSub, recalcTotals]);

  // ─────────────────────────────────────────────────────────────────────────
  //  PATTY MODE — load & recompute (only active when pattyMode === true)
  // ─────────────────────────────────────────────────────────────────────────
  const loadPattyList = useCallback(async () => {
    try {
      const res = await CC.api(CC.PattySelect, null, {}, { Comid: sess.MComid });
      const list = Array.isArray(res) ? res : (res?.data ?? res?.Data1 ?? []);
      const source = (list && list.length > 0) ? list : PATTY_ROW_TEMPLATE;
      setPattyRows(source.map((p) => ({
        _key:       CC.uid(),
        Id:         p.Id || 0,
        PattyName:  p.PattyName || "",
        Percentage: fmt2(p.Percentage || 0),
        BagRate:    fmt2(p.BagRate || 0),
        ComAmt:     "0.00",
      })));
    } catch {
      setPattyRows(PATTY_ROW_TEMPLATE.map((p) => ({
        _key: CC.uid(), Id: 0, PattyName: p.PattyName, Percentage: "0.00", BagRate: "0.00", ComAmt: "0.00",
      })));
    }
    setPattyLoaded(true);
  }, [sess.MComid]);

  // Load once, the first time Patty mode is switched on (mirrors PattySelect() cache check)
  useEffect(() => {
    if (pattyMode && !pattyLoaded) loadPattyList();
  }, [pattyMode, pattyLoaded, loadPattyList]);

  const updatePattyPercentage = useCallback((key, value) => {
    setPattyRows((prev) => prev.map((r) => (r._key === key ? { ...r, Percentage: value } : r)));
  }, []);

  const updatePattyBagRate = useCallback((key, value) => {
    setPattyRows((prev) => prev.map((r) => (r._key === key ? { ...r, BagRate: value } : r)));
  }, []);

  // Totals needed by the Bag-Rate branch (mirrors TotKgs / TotBags accumulated
  // inside Calculation() in frmpurchase.cs — summed across every non-free-product row).
  const totKgs  = gridRows.reduce((s, r) => (r.ProductCode && !valNum(r.FreeQtyStatus)) ? s + valNum(r.ItemQty) : s, 0);
  const totBags = gridRows.reduce((s, r) => (r.ProductCode && !valNum(r.FreeQtyStatus)) ? s + valNum(r.Bags)    : s, 0);

  // Per-row Patty amount — mirrors the exact branch order in frmpurchase.cs (~line 2698-2741):
  //   1) if Percentage is filled  → % of product total
  //   2) else if BagRate is filled → LORRY FREIGHT: BagRate × TotKgs, COOLY: BagRate × TotBags
  const computePattyRowAmt = useCallback((r) => {
    const pct = valNum(r.Percentage);
    if (pct !== 0) return roundOff(valNum(totals.productTotal) * (pct / 100));
    const bagRate = valNum(r.BagRate);
    if (bagRate === 0) return 0;
    if (r.PattyName === "LORRY FREIGHT") return roundOff(bagRate * totKgs);
    if (r.PattyName === "COOLY")         return roundOff(bagRate * totBags);
    return 0;
  }, [totals.productTotal, totKgs, totBags]);

  const pattyTotal = pattyMode
    ? fmt2(pattyRows.reduce((sum, r) => sum + computePattyRowAmt(r), 0))
    : "0.00";

  // Final Net Amount — identical to totals.netAmt when Patty mode is off.
  // When on, the patty total is deducted (mirrors Ptotal = TotalItemAmt ... - patty ...).
  const finalNetAmt = pattyMode
    ? fmt2(roundOff(valNum(totals.netAmt) - valNum(pattyTotal)))
    : totals.netAmt;

  // Credit days → DueDate auto-update
  useEffect(() => {
    if (!creditDays || creditDays <= 0 || !invoiceDate) return;
    const base = new Date(invoiceDate);
    if (isNaN(base.getTime())) return;
    base.setDate(base.getDate() + creditDays);
    setDueDate(base.toISOString().split("T")[0]);
  }, [invoiceDate, creditDays]);

  // ─────────────────────────────────────────────────────────────────────────
  //  FOCUS FORM COLUMNS (Ctrl+F)
  // ─────────────────────────────────────────────────────────────────────────
  const loadFocusFormColumns = useCallback(async () => {
    let draft = FORM_COLUMNS.map((c, i) => ({
      filename: "PurchaseFormFocus",
      column:   c.column,
      label:    c.text,
      Index:    i,
      Focus:    true,
      Comid:    sess.MComid,
    }));
    try {
      const url = CC.BASE_URL + `${CC1.GetFocusColumnsUrl}?comid=${sess.Comid}&filename=PurchaseFormFocus`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...CC.authHeaders() },
        body: JSON.stringify({ comid: sess.Comid, filename: "PurchaseFormFocus" }),
      });
      if (res.ok) {
        const saved = await res.json();
        if (Array.isArray(saved) && saved.length > 0) {
          saved.forEach((s) => {
            const idx = draft.findIndex((d) => d.column === s.column);
            if (idx !== -1) {
              draft[idx].Focus = s.Focus === true || s.Focus === "true" || s.Focus === 1;
              draft[idx].Index = s.Index;
            }
          });
          draft.sort((a, b) => a.Index - b.Index);
        }
      }
    } catch { /* first use — keep defaults */ }
    setFocusFormColDraft(draft);
  }, [sess.MComid, sess.Comid]);
  // FIX 2: correct useCallback deps — was wrongly copy-pasted from useEffect
  const handleFocusFormColOpen = useCallback(async () => {
    await loadFocusFormColumns();
    setFocusFormColOpen(true);
  }, [loadFocusFormColumns]);

  const handleFocusFormColSave = useCallback(async () => {
    const payload = focusFormColDraft.map((d, i) => ({
      filename: "PurchaseFormFocus",
      column:   d.column,
      Index:    i,
      Focus:    d.Focus,
      Comid:    sess.MComid,
    }));
    try {
      setLoading(true);
      const res = await CC.insertapi(CC.FocusColumns, payload);
      setLoading(false);
      if (redirectIfDualLogin(res)) return;
      if (res?.ok || res?.IsSuccess) {
        setFocusFormColOpen(false);
        toast("✅ Form Columns Focus Enabled. Refreshing…");
        setTimeout(() => window.location.reload(true), 1000);
      } else {
        toast(`❌ ${res?.message || "Save failed !!!."}`, true);
      }
    } catch {
      setLoading(false);
      toast("❌ Technical Fault. Contact Software Vendor !!!.", true);
    }
  }, [focusFormColDraft, sess.MComid, redirectIfDualLogin, toast]);

  const handleFocusFormDragStart = useCallback((idx) => { setFocusFormDragIdx(idx); }, []);
  const handleFocusFormDragOver  = useCallback((e, idx) => {
    e.preventDefault();
    if (focusFormDragIdx === null || focusFormDragIdx === idx) return;
    setFocusFormColDraft((prev) => {
      const next = [...prev];
      const [moved] = next.splice(focusFormDragIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setFocusFormDragIdx(idx);
  }, [focusFormDragIdx]);
  const handleFocusFormDragEnd   = useCallback(() => { setFocusFormDragIdx(null); }, []);
  const handleFocusFormToggle    = useCallback((idx, val) => {
    setFocusFormColDraft((prev) => prev.map((d, i) => (i === idx ? { ...d, Focus: val } : d)));
  }, []);

  // Runtime focus-enabled form columns (mirrors jQuery focusformcolumns[])
  const focusformcolumns = focusFormColDraft
    .filter((d) => d.Focus)
    .map((d) => ({ column: d.column, focus: 1 }));

  const orderedGridColumns = React.useMemo(() => {
    if (!focusColDraft || focusColDraft.length === 0) return BASE_COLUMNS;
    const ordered = [];
    focusColDraft.forEach((d) => {
      const baseCol = BASE_COLUMNS.find((c) => c.key === d.column);
      if (baseCol) ordered.push(baseCol);
    });
    BASE_COLUMNS.forEach((c) => {
      if (!ordered.some((o) => o.key === c.key)) ordered.push(c);
    });
    return ordered;
  }, [focusColDraft]);

  // Navigate to next form field (mirrors jQuery NextFocus / OnFocus)
  const nextFocusForm = useCallback((currentColumn) => {
    const jumpToGrid = () => {
      const targetRow = gridRows[gridRows.length - 1];
      if (targetRow) {
        setTimeout(() => {
          const firstCol = orderedGridColumns.find(c => c.editable)?.key || "ProductCode";
          const el = document.getElementById(`cell_${targetRow._key}_${firstCol}`);
          if (el) { el.focus(); el.select?.(); }
        }, 50);
      }
    };

    let next;
    if (!currentColumn) {
      if (focusformcolumns.length === 0) return;
      next = focusformcolumns[0];
    } else {
      const idx = focusformcolumns.findIndex((f) => f.column === currentColumn);
      if (idx === -1) return;
      if (idx === focusformcolumns.length - 1) {
        jumpToGrid();
        return;
      }
      next = focusformcolumns[idx + 1];
    }

    if (!next) return;

    const focusMap = {
      dtppurchasedate: () => purchaseDateRef.current?.focus(),
      cmbpurchaseType: () => purchaseTypeRef.current?.focus(),
      dtpduedate:      () => dueDateRef.current?.focus(),
      cmbsupplier:     () => supplierRef.current?.focus(),
      txtinvoiceno:    () => invoiceNoRef.current?.focus(),
      dtpinvoicedate:  () => invoiceDateRef.current?.focus(),
      txtinvoiceamt:   () => invoiceAmtRef.current?.focus(),
      gridpurchase:    jumpToGrid,
      txtotherplus:    () => otherPlusRef.current?.focus(),
      txtothersub:     () => otherSubRef.current?.focus(),
      txtremarks:      () => remarksRef.current?.focus(),
    };
    focusMap[next.column]?.();
  }, [focusformcolumns, gridRows, orderedGridColumns]);

  useEffect(() => {
    if (!initialFocusDone.current && focusformcolumns.length > 0) {
      initialFocusDone.current = true;
      setTimeout(() => nextFocusForm(), 150);
    }
  }, [focusformcolumns, nextFocusForm]);

  // ─────────────────────────────────────────────────────────────────────────
  //  LOAD FUNCTIONS
  // ─────────────────────────────────────────────────────────────────────────
  const loadMaxPurchaseNo = useCallback(async () => {
    const res = await CC.api(CC.MaxPurchaseNo, null, {}, { Comid: sess.Comid });
    if (redirectIfDualLogin(res)) return;
    if (res.ok) setPurchaseNo(res.data ?? res.Data1 ?? "");
  }, [sess.Comid, redirectIfDualLogin]);

  const loadSuppliers = useCallback(async () => {
    const res = await CC.api(CC.SupplierList, null, {}, { Comid: sess.MComid, AccountType: "Supplier" });
    if (redirectIfDualLogin(res)) return;
    if (Array.isArray(res)) setSupplierList(res);
    else setSupplierList(res?.data || res?.Data1 || []);
  }, [sess.MComid, redirectIfDualLogin]);

  const loadBatchWiseMasters = useCallback(async () => {
    const mainSet  = JSON.parse(localStorage.getItem("Mainsetting") || "[{}]");
    const isBatch  = mainSet?.[0]?.BatchWiseStock === true;
    setBatchWise(isBatch);
    if (!isBatch) return;
    const [bRes, mRes, cRes, sRes] = await Promise.all([
      CC.api(CC.BrandSelect, null, {}, { Comid: sess.MComid }),
      CC.api(CC.SelectModel, null, {}, { Comid: sess.MComid }),
      CC.api(CC.SelectColor, null, {}, { Comid: sess.MComid }),
      CC.api(CC.SizeSelect,  null, {}, { Comid: sess.MComid }),
    ]);
    const norm = (r) => (Array.isArray(r) ? r : r?.data ?? r?.Data1 ?? []);
    setBrandList(norm(bRes)); setModelList(norm(mRes));
    setColorList(norm(cRes)); setSizeList(norm(sRes));
  }, [sess.MComid]);

  // FIX 4: single mount useEffect — previously two separate effects both called
  // loadMaxPurchaseNo + loadSuppliers, causing duplicate API calls on mount.
  useEffect(() => {
    if (!isAuthorized) return;
    loadMaxPurchaseNo();
    loadSuppliers();
    loadBatchWiseMasters();
    loadFocusFormColumns();
  }, [isAuthorized, loadMaxPurchaseNo, loadSuppliers, loadBatchWiseMasters, loadFocusFormColumns]);

  // ─────────────────────────────────────────────────────────────────────────
  //  SUPPLIER HANDLERS
  // ─────────────────────────────────────────────────────────────────────────
  const handleSupplierChange = useCallback(async (sid, opts = {}) => {
    const { skipIgst = false } = opts;
    setSupplierId(sid);
    if (!sid) { setSupplierInfo({ address: "", city: "", phone: "", balance: "0.00" }); return; }
    const local = supplierList.find((s) => String(s.Id) === String(sid));

    const applyIgstFromSupplier = (supplierObj) => {
      if (skipIgst) return;                         // ← don't touch igst when caller already resolved it
      const igstVal = supplierObj?.IGSTBill;
      const isIgst  = igstVal === "IGST" || igstVal === "1" || igstVal === 2 || igstVal === "2";
      setIgstStatus(isIgst ? "IGST" : "GST");
      setIgstChecked(isIgst);
    };

    if (local) {
      setSupplierInfo({
        address: `${local.Address1 || ""} ${local.Address2 || ""}`.trim(),
        city:    local.City     || "",
        phone:   local.MobileNo || "",
        balance: "0.00",
      });
      applyIgstFromSupplier(local);
      const cd = parseInt(local.CreditBillDays ?? 0, 10) || 0;
      setCreditDays(cd);
      if (cd > 0) {
        const base = new Date();
        base.setDate(base.getDate() + cd);
        setDueDate(base.toISOString().split("T")[0]);
      }
    } else {
      const res = await CC.api(CC.SupplierById, null, {}, { Id: sid, Comid: sess.MComid });
      if (redirectIfDualLogin(res)) return;
      const s = res?.data?.[0] ?? res?.Data?.[0] ?? (Array.isArray(res?.data) ? res.data[0] : null);
      if (s) {
        setSupplierInfo({
          address: `${s.Address1 || ""} ${s.Address2 || ""}`.trim(),
          city:    s.City     || "",
          phone:   s.MobileNo || "",
          balance: "0.00",
        });
        applyIgstFromSupplier(s);
      }
    }
    const balRes = await CC.api(CC.CurrentBalance, null, {}, {
      Id: Number(sid), Comid: Number(sess.Comid), MComid: Number(sess.MComid),
      TillDate: purchaseDate || today(), AccountType: "SUPPLIER",
    });
    if (redirectIfDualLogin(balRes)) return;
    const balance = balRes?.ok ? fmt2(valNum(balRes.data)) : "0.00";
    setSupplierInfo((prev) => ({ ...prev, balance }));
  }, [sess.Comid, sess.MComid, supplierList, purchaseDate, redirectIfDualLogin]);

  const openSupplierDropdown = useCallback(() => {
    if (supplierList.length === 0) return;
    setSupplierDropdown(supplierList);
    setSupplierSelIdx(0);
    setSupplierDDOpen(true);
  }, [supplierList]);

  const handleSupplierInputChange = useCallback((value) => {
    setSupplierQuery(value);
    setSupplierId("");
    setSupplierInfo({ address: "", city: "", phone: "", balance: "0.00" });
    if (!value.trim()) {
      setSupplierDropdown(supplierList);
      setSupplierSelIdx(0);
      setSupplierDDOpen(supplierList.length > 0);
      return;
    }
    const q = value.toLowerCase();
    const filtered = supplierList.filter((s) => (s.AccountName || "").toLowerCase().includes(q));
    setSupplierDropdown(filtered);
    setSupplierSelIdx(0);
    setSupplierDDOpen(filtered.length > 0);
  }, [supplierList]);

  const confirmSupplierSelection = useCallback((supplier) => {
    setSupplierQuery(supplier.AccountName || "");
    setSupplierDDOpen(false);
    setSupplierDropdown([]);
    handleSupplierChange(String(supplier.Id));
    setTimeout(() => nextFocusForm("cmbsupplier"), 50);
  }, [handleSupplierChange, nextFocusForm]);

  const supplierInputKeyDown = useCallback((e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!supplierDDOpen) openSupplierDropdown();
      else setSupplierSelIdx((i) => Math.min(i + 1, supplierDropdown.length - 1));
      return;
    }
    if (e.key === "ArrowUp")  { e.preventDefault(); setSupplierSelIdx((i) => Math.max(i - 1, 0)); return; }
    if (e.key === "Escape")   { setSupplierDDOpen(false); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      if (supplierDDOpen) {
        const chosen = supplierDropdown[supplierSelIdx];
        if (chosen) confirmSupplierSelection(chosen);
        else toast("❌ Select Valid Supplier !!!.", true);
        return;
      }
      if (supplierId) { nextFocusForm("cmbsupplier"); return; }
      if (supplierQuery.trim()) {
        const exact = supplierList.find((s) => (s.AccountName || "").toLowerCase() === supplierQuery.toLowerCase());
        if (exact) { confirmSupplierSelection(exact); return; }
      }
      toast("❌ Select Valid Supplier !!!.", true);
    }
  }, [supplierDDOpen, supplierDropdown, supplierSelIdx, supplierId, supplierQuery, supplierList, openSupplierDropdown, confirmSupplierSelection, toast]);

  useEffect(() => {
    if (!supplierId) return;
    const found = supplierList.find((s) => String(s.Id) === String(supplierId));
    if (found) setSupplierQuery(found.AccountName || "");
  }, [supplierId, supplierList]);

  // ─────────────────────────────────────────────────────────────────────────
  //  GRID HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  const focusCell = useCallback((rowKey, colKey) => {
    setSelectedCell({ rowKey, colKey });
    setTimeout(() => {
      const el = document.getElementById(`cell_${rowKey}_${colKey}`);
      if (el) { el.focus(); el.select?.(); }
    }, 20);
  }, []);
  focusCellRef.current = focusCell;

  const deleteGridRow = useCallback((rowKey) => {
    setGridRows((prev) => {
      const updated = prev.filter((r) => r._key !== rowKey);
      if (updated.length === 0) updated.push(makeGridRow());
      return updated;
    });
  }, []);

  const handleCellChange = useCallback((rowKey, colKey, value) => {
    setGridRows((prev) => {
      const idx = prev.findIndex((r) => r._key === rowKey);
      if (idx === -1) return prev;
      
      let row = { ...prev[idx] };

      if (colKey === "ItemQty") {
        if (exceedsDecimalLimit(value, row.UOMDecimal)) {
          return prev;   // UOMDecimal 0 ⇒ don't allow decimal typing
        }
      }
      row[colKey] = value;
if (colKey === "MfgDate") {
  const expDays = valNum(row.Expirydays);
  if (value && expDays > 0) {
    const mfg = new Date(value);
    if (!isNaN(mfg.getTime())) {
      mfg.setDate(mfg.getDate() + expDays);
      row.ExpiryDate = mfg.toISOString().split("T")[0];
    }
  }
}
      if (purRateInclusive && colKey === "PurchaseRate") {
        row.IncPurRate = valNum(value);
      } else if (!purRateInclusive && colKey === "PurchaseRate") {
        row.IncPurRate = null;
      }
      
      const updated = [...prev];
      updated[idx] = row;
      return updated;
    });
  }, [purRateInclusive]);

  const handleGridBlur = useCallback((rowKey, colKey, value) => {
    setGridRows((prev) => {
      const idx = prev.findIndex((r) => r._key === rowKey);
      if (idx === -1) return prev;
      
      let r = { ...prev[idx] };
      if (value !== undefined) {
       if (colKey === "ItemQty" && exceedsDecimalLimit(value, r.UOMDecimal)) {
          // Keep old value
        } else {
          r[colKey] = value;
        }
      }

      if (purRateInclusive) {
        let incPr = valNum(r.IncPurRate);
        const tax = valNum(r.TaxPercent);

        if (colKey === "PurchaseRate") {
          const enteredValue = valNum(value);
          if (enteredValue > 0) incPr = enteredValue;
        } else if (incPr === 0) {
          const rawPr = valNum(r.PurchaseRate);
          if (rawPr > 0) incPr = rawPr;
        }

        if (incPr > 0) {
          r.IncPurRate   = incPr;
          r.PurchaseRate = tax > 0 ? (incPr / (1 + tax / 100)).toFixed(2) : incPr.toFixed(2);
        }
      }

      if (!BATCH_ID_KEYS.has(colKey) && CALC_KEYS.has(colKey)) {
        r = calcRow(r);
      }
      
      const updated = [...prev];
      updated[idx] = r;
      return updated;
    });
  }, [purRateInclusive, calcRow]);

  // FIX 6: applyBillDiscount — was referencing setRows (doesn't exist) and
  // calcSaleRow (doesn't exist). Fixed to use setGridRows + calcRow.
  const applyBillDiscount = useCallback(() => {
    const per = valNum(discPer);
    if (!per) return;
    setGridRows((prev) => prev.map((r) => {
      if (!r.ProductRefId || !valNum(r.ItemQty)) return r;
      return calcRow({ ...r, DiscountPercent: String(per) });
    }));
  }, [discPer, calcRow]);

  // ─────────────────────────────────────────────────────────────────────────
  //  FOCUS GRID COLUMNS (Ctrl+G)
  // ─────────────────────────────────────────────────────────────────────────
  const loadFocusColumns = useCallback(async () => {
    const liveColConfig = colConfigRef.current;
    const visibleBases  = BASE_COLUMNS.filter((c) => {
      const cfg = liveColConfig.find((x) => x.key === c.key);
      return cfg ? cfg.visible : c.defaultVisible;
    });
    let draft = visibleBases.map((c, i) => ({
      filename: "PurchaseFocus", column: c.key, label: c.label,
      Index: i, Focus: true, Comid: sess.MComid,
    }));
    try {
      const url = CC.BASE_URL + `${CC1.GetFocusColumnsUrl}?comid=${sess.Comid}&filename=PurchaseFocus`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...CC.authHeaders() },
        body: JSON.stringify({ comid: sess.Comid, filename: "PurchaseFocus" }),
      });
      if (res.ok) {
        const saved = await res.json();
        if (Array.isArray(saved) && saved.length > 0) {
          saved.forEach((s) => {
            const idx = draft.findIndex((d) => d.column === s.column);
            if (idx !== -1) {
              draft[idx].Focus = s.Focus === true || s.Focus === "true" || s.Focus === 1;
              draft[idx].Index = s.Index;
            }
          });
          draft.sort((a, b) => a.Index - b.Index);
        }
      }
    } catch { /* first use */ }
    setFocusColDraft(draft);
  }, [sess.MComid, sess.Comid]);

  const handleFocusColOpen = useCallback(async () => {
    await loadFocusColumns();
    setFocusColOpen(true);
  }, [loadFocusColumns]);

  const handleFocusColSave = useCallback(async () => {
    const payload = focusColDraft.map((d, i) => ({
      filename: "PurchaseFocus", column: d.column, Index: i, Focus: d.Focus, Comid: sess.MComid,
    }));
    try {
      setLoading(true);
      const res = await CC.insertapi(CC.FocusColumns, payload);
      setLoading(false);
      if (redirectIfDualLogin(res)) return;
      if (res?.ok || res?.IsSuccess) {
        setFocusColOpen(false);
        toast("✅ Columns Reorder & Focus Enabled. Refreshing…");
        setTimeout(() => window.location.reload(true), 1000);
      } else { toast(`❌ ${res?.message || "Save failed !!!."}`, true); }
    } catch { setLoading(false); toast("❌ Technical Fault. Contact Software Vendor !!!.", true); }
  }, [focusColDraft, sess.MComid, redirectIfDualLogin, toast]);

  const focusgridcolumns    = focusColDraft.map((d) => ({ column: d.column, focus: d.Focus ? 1 : 0 }));
  const focusgridcolumnsRef = useRef(focusgridcolumns);
  focusgridcolumnsRef.current = focusgridcolumns;

  const handleFocusDragStart = useCallback((idx) => { setFocusColDragIdx(idx); }, []);
  const handleFocusDragOver  = useCallback((e, idx) => {
    e.preventDefault();
    if (focusColDragIdx === null || focusColDragIdx === idx) return;
    setFocusColDraft((prev) => {
      const next = [...prev];
      const [moved] = next.splice(focusColDragIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setFocusColDragIdx(idx);
  }, [focusColDragIdx]);
  const handleFocusDragEnd   = useCallback(() => { setFocusColDragIdx(null); }, []);
  const handleFocusToggle    = useCallback((idx, field, val) => {
    setFocusColDraft((prev) => prev.map((d, i) => (i === idx ? { ...d, [field]: val } : d)));
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  //  F12 COLUMN CONFIG
  // ─────────────────────────────────────────────────────────────────────────
  const loadColConfig = useCallback(async () => {
    try {
      const res = await fetch(CC.BASE_URL + `${CC1.GetFocusColumnsUrl}?comid=${sess.Comid}&filename=Purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...CC.authHeaders() },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return;
      setColConfig((prev) => prev.map((cfg) => {
        const saved = data.find((d) => d.column === cfg.key);
        if (!saved) return cfg;
        return { ...cfg, visible: saved.Visible === false ? true : false, width: saved.Width };
      }));
    } catch { /* first use */ }
  }, [sess.Comid]);

  // FIX 5: added loadFocusFormColumns to this useEffect
  useEffect(() => {
    if (!isAuthorized) return;
    loadColConfig();
    loadFocusColumns();
    loadFocusFormColumns();
  }, [isAuthorized, loadColConfig, loadFocusColumns, loadFocusFormColumns]);

  const handleF12Open = useCallback(() => {
    f12PrevCellRef.current = { ...selectedCell };
    setF12Draft(colConfig.map((c) => ({ ...c })));
    setF12Open(true);
  }, [colConfig, selectedCell]);

  const handleF12Save = useCallback(async () => {
    const payload = f12Draft.map((c) => ({
      filename: "Purchase", column: c.key,
      Visible: !c.visible, Width: Number(c.width), Comid: sess.MComid,
    }));
    try {
      setLoading(true);
      const res = await fetch(CC.BASE_URL + CC.VisibleColumnsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", ...CC.authHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setLoading(false);
      if (data.ok) {
        setColConfig(f12Draft.map((c) => ({ ...c })));
        setF12Open(false);
        const prev = f12PrevCellRef.current;
        if (prev?.rowKey && prev?.colKey) {
          setTimeout(() => {
            const el = document.getElementById(`cell_${prev.rowKey}_${prev.colKey}`);
            if (el) { el.focus(); el.select?.(); }
          }, 50);
        }
        toast("✅ Columns Visible & Width Updated Successfully.");
      } else { toast(`❌ ${data.message || "Save failed !!!."}`, true); }
    } catch { setLoading(false); toast("❌ Technical Fault. Contact Software Vendor !!!.", true); }
  }, [f12Draft, sess.MComid, toast]);

  const f12SetVisible = useCallback((key, val) => {
    setF12Draft((prev) => prev.map((c) => (c.key === key ? { ...c, visible: val } : c)));
  }, []);
  const f12SetWidth = useCallback((key, val) => {
    setF12Draft((prev) => prev.map((c) => (c.key === key ? { ...c, width: Number(val) || c.width } : c)));
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  //  PRODUCT APPLY / FILL
  // ─────────────────────────────────────────────────────────────────────────
  const applyProductToRow = useCallback((rowKey, p) => {
    setGridRows((prev) => {
      const idx = prev.findIndex((r) => r._key === rowKey);
      if (idx === -1) return prev;
      let row = {
  ...prev[idx],
  ProductRefId:    p.Id,
  ProductCode:     p.ProductCode || p.Prod_Code || "",
  ProductName:     p.ProductName || p.PName     || "",
  HSNCode:         p.HSNCode     || "",
  UOM:             p.UOM         || "",
  UOMDecimal:      p.UOMDecimal  ?? 3,
  UOMRefid:        p.UomRefid    || p.UOMRefId  || "",
  MRP:             fmt2(p.MRP            || 0),
  OldMRP:          fmt2(p.MRP            || 0),
  PurchaseRate:    fmt2(p.PurchaseRate   || p.PurRate  || 0),
  OldPurchaseRate: fmt2(p.PurchaseRate   || p.PurRate  || 0),
  IncPurRate:      fmt2(p.PurchaseRate   || p.PurRate  || 0),
  TaxPercent:      fmt2(p.GST            || 0),
  LandingCost:     fmt2(p.LandingCost    || 0),
  Salerate:        fmt2(p.SalesRate      || p.SaleRate || 0),
  WholeSalerate:   fmt2(p.WholeSaleRate  || 0),
  ProfitPer:       fmt2(p.ProfitPer      || 0),
  ProfitAmt:       fmt2(p.ProfitAmt      || 0),
  CESSPer:         fmt2(p.CESS           || 0),
  SPLCESS:         fmt2(p.SPLCESS        || 0),
  SaleDiscPer:     fmt2(p.SaleDiscountPer|| 0),
  Expirydays:      fmt0(p.ExpiryDays     || 0),
  StockQty:        fmt2(p.Stock          || 0),
  Nstock:          fmt2(p.Nstock         || 0),
  SerialNoStatus:  p.SerialNoType    || 0,
  BatchStatus:     p.BatchwiseStock  || 0,
  NomQty:          p.NomsQty         || "0",
  TransPer:        "0.00",
  TextRefId: p.SerialNoStatus === 1
    ? (prev[idx].TextRefId || CC.uid())
    : prev[idx].TextRefId || "",
};
      // Expirydays > 0 ஆனா, MfgDate (default today) அடிப்படையில் ExpiryDate auto-calculate
      const expDaysNum = valNum(row.Expirydays);
      if (expDaysNum > 0 && row.MfgDate) {
        const mfg = new Date(row.MfgDate);
        if (!isNaN(mfg.getTime())) {
          mfg.setDate(mfg.getDate() + expDaysNum);
          row.ExpiryDate = mfg.toISOString().split("T")[0];
        }
      }

      row = calcRow(row);
      row = calcRow(row);
      const updated = [...prev];
      updated[idx]  = row;
      const last = updated[updated.length - 1];
      if (last._key === rowKey || last.ProductCode !== "") updated.push(makeGridRow());
      return updated;
    });
    setProductPopup({ open: false, rowKey: null, list: [], query: "" });

    // Auto-advance focus
    setTimeout(() => {
      const visibleCols = orderedGridColumns.filter((c) => {
        const cfg = colConfigRef.current.find(x => x.key === c.key);
        return c.editable && (cfg ? cfg.visible : c.defaultVisible);
      });
      const liveFocus = focusgridcolumnsRef.current;
      const focusEnabledCols = liveFocus.length > 0
        ? visibleCols.filter((c) => {
            const fc = liveFocus.find((f) => f.column === c.key);
            return fc ? fc.focus === 1 : true;
          })
        : visibleCols;
      const pcIdx  = focusEnabledCols.findIndex(c => c.key === "ProductCode");
      const nextCol = focusEnabledCols[pcIdx + 1] ?? null;
      if (nextCol) focusCellRef.current(rowKey, nextCol.key);
    }, 80);

    // Serial No popup
    const mainSet      = JSON.parse(localStorage.getItem("Mainsetting") || "[{}]");
    const textileSerial = sess.TextilesSerialNowiseBilling;
    if (textileSerial && p.SerialNoType === 1) {
      setTimeout(() => {
        setGridRows((prev) => {
          const row = prev.find((r) => r._key === rowKey);
          if (!row) return prev;
          setSerialNoList((currentSerials) => {
            const existingSerials = currentSerials.filter((s) => s.IndexRefId === row.TextRefId);
            setSerialNoPopup({ open: true, rowKey, textRefId: row.TextRefId, list: existingSerials, returnColKey: "ItemQty" });
            return currentSerials;
          });
          return prev;
        });
      }, 30);
    }
  }, [calcRow, serialNoList, setSerialNoPopup]);

  const fillProductByCode = useCallback(async (code, rowKey) => {
    if (!code?.trim()) return;
    try {
      setLoading(true);
      const res = await CC.api(CC.ItemByCode, null, {}, {
        code: code.trim(), Comid: sess.MComid, CComid: sess.Comid, Id: 0, Batchwise: 0,
      });
      if (redirectIfDualLogin(res)) return;
      if (res?._netErr || res?._http404) { toast("❌ Technical Fault. Contact Software Vendor !!!.", true); return; }
      const objPlist =
        Array.isArray(res)        ? res :
        Array.isArray(res?.Data1) ? res.Data1 :
        Array.isArray(res?.data)  ? res.data   : [];
      if (objPlist.length === 0) {
        const mainSet = JSON.parse(localStorage.getItem("Mainsetting") || "[{}]");
        const productCreatePurchase = mainSet?.[0]?.Product_Purchase ?? false;
        if (!productCreatePurchase) { toast("❌ Invalid Product Code !!!.", true); return; }
        const ok = await confirm("Items Not Exists. Do You Want to Create New Items?");
        if (!ok) return;
        setItemCreatePopup({ open: true, rowKey, code: code.trim() });
        return;
      }
      if (objPlist.length === 1) { applyProductToRow(rowKey, objPlist[0]); return; }
      setMrpPopup({ open: true, rowKey, list: objPlist });
    } catch (err) {
      console.error(err);
      toast("❌ Product lookup failed", true);
    } finally { setLoading(false); }
  }, [sess, applyProductToRow, redirectIfDualLogin, toast, confirm]);

  // ─────────────────────────────────────────────────────────────────────────
  //  F5 VIEW
  // ─────────────────────────────────────────────────────────────────────────
  // const handleF5View = useCallback(async (objlist = {}) => {
  //   if (!perm.Edit) { toast("❌ Page Edit Permission Denied !!!.", true); return; }
  //   const fromdate = objlist.fromdate ?? purchaseDate;
  //   const todate   = objlist.todate   ?? purchaseDate;
  //   const Id       = objlist.supplierid ?? 0;
  //   const SearchNo = objlist.SearchNo ?? searchNo;
  //   const fmtDate  = (d) => {
  //     if (!d) return "";
  //     const dt = new Date(d);
  //     if (isNaN(dt)) return d;
  //     return `${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getDate()).padStart(2, "0")}/${dt.getFullYear()}`;
  //   };
  //   setLoading(true);
  //   try {
  //     var PattyStatus = 0;
                         
  //     PattyStatus=purchaseMode=="PURCHASE" ? 3 : PurchaseMode=="PATTY" ? 2 : PurchaseMode=="SALESPATTY" ? 2 : PurchaseMode=="ARRIVAL" ? 1 : 3;
  //       var SPatty=0;
  //     SPatty= purchaseMode=="SALESPATTY" ? 1 :0;
  //     const res = await CC.api(CC.SelectPurchase, null, {Patty:PattyStatus,SalesPatty:SPatty}, {
  //       Comid: Number(sess.Comid), Fromdate: fmtDate(fromdate),
  //       Todate: fmtDate(todate), Id: Number(Id),
  //     });
  //     if (redirectIfDualLogin(res)) return;
  //     if (!res.ok) { toast(`❌ ${res.message || "Failed to load purchase list !!!."}`, true); return; }
  //     const dataNode   = res.Data?.[0] ?? res.data?.[0] ?? {};
  //     const masterList = dataNode.purchasemaster ?? [];
  //     const detailList = dataNode.purchasedetails ?? [];
  //     const total      = masterList.reduce((sum, m) => sum + (parseFloat(m.NetAmt) || 0), 0);
  //     console.log(res, "F5 View Data");  
  //     setF5MasterList(masterList);
  //     setF5DetailList(detailList);
  //     setF5TotalAmt(total.toFixed(2));
  //     setF5ExpandedRow(null);
  //     setListViewOpen(true);
  //   } catch (err) {
  //     toast(`❌ ${err.message || "Technical Fault. Contact Software Vendor !!!."}`, true);
  //   } finally { setLoading(false); }
  // }, [perm.Edit, purchaseDate, searchNo, sess.Comid, redirectIfDualLogin, toast]);
const handleF5View = useCallback(async (objlist = {}) => {
  if (!perm.Edit) {
    toast("❌ Page Edit Permission Denied !!!.", true);
    return;
  }

  const fromdate = objlist.fromdate ?? purchaseDate;
  const todate = objlist.todate ?? purchaseDate;
  const Id = objlist.supplierid ?? 0;

  const fmtDate = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return `${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getDate()).padStart(2, "0")}/${dt.getFullYear()}`;
  };

  setLoading(true);

  try {
    let PattyStatus = 3;
    let SPatty = 0;

    if (purchaseMode === "PURCHASE") {
      PattyStatus = 3;
    } else if (purchaseMode === "PATTY") {
      PattyStatus = 2;
    } else if (purchaseMode === "SALESPATTY") {
      PattyStatus = 2;
      SPatty = 1;
    } else if (purchaseMode === "ARRIVAL") {
      PattyStatus = 1;
    }

    const res = await CC.api(
      CC.SelectPurchase,
      null,
      {
        Patty: PattyStatus,
        SalesPatty: SPatty,
      },
      {
        Comid: Number(sess.Comid),
        Fromdate: fmtDate(fromdate),
        Todate: fmtDate(todate),
        Id: Number(Id),
      }
    );

    if (redirectIfDualLogin(res)) return;

    if (!res.ok) {
      toast(`❌ ${res.message || "Failed to load purchase list !!!."}`, true);
      return;
    }

    console.log("API Response :", res);

    // Master & Detail
    const masterList = res.Data1 || [];
    const detailList = res.Data2 || [];

    // Merge Master + Detail
    const mergedList = masterList.map((master) => ({
      ...master,
      details: detailList.filter(
        (detail) => Number(detail.PurchaseRefId) === Number(master.Id)
      ),
    }));

    // Total Amount
    const total = mergedList.reduce(
      (sum, row) => sum + (parseFloat(row.NetAmt) || 0),
      0
    );

    console.log("Merged List :", mergedList);

    setF5MasterList(mergedList);
    setF5DetailList(detailList); // வேண்டுமென்றால் வைத்துக்கொள்ளலாம்
    setF5TotalAmt(total.toFixed(2));
    setF5ExpandedRow(null);
    setListViewOpen(true);

  } catch (err) {
    toast(
      `❌ ${err.message || "Technical Fault. Contact Software Vendor !!!."}`,
      true
    );
  } finally {
    setLoading(false);
  }
}, [
  perm.Edit,
  purchaseDate,
  purchaseMode,
  sess.Comid,
  redirectIfDualLogin,
  toast,
]);
  const getDetailsForMaster = useCallback((masterId) =>
    f5DetailList.filter((d) => String(d.PurchaseRefId) === String(masterId)),
  [f5DetailList]);

  const toggleF5Row = useCallback((id) =>
    setF5ExpandedRow((prev) => (prev === id ? null : id)),
  []);

  // ─────────────────────────────────────────────────────────────────────────
  //  CLEAR
  // ─────────────────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    setEditId(0);
    setPurchaseDate(today()); setDueDate(today()); setInvoiceDate(today());
    setInvoiceNo(""); setInvoiceAmt("0.00"); setRemarks("");
    setPurchaseType("CREDIT"); setIgstStatus("GST"); setIgstChecked(false);
    setSupplierId(""); setSupplierInfo({ address: "", city: "", phone: "", balance: "0.00" });
    setOtherPlus("0.00"); setOtherSub("0.00");
    setTcsPercent("0.00"); setTcsAmt("0.00");
    setLoadding(""); setLorryNo("");
    setGridRows([makeGridRow()]); setGstSplit([]); setTotals({ ...EMPTY_TOTALS });
    loadMaxPurchaseNo(); setUpdateIdEdit(""); setSerialNoList([]);
    setSupplierQuery(""); setSupplierDDOpen(false);
    // Arrival-only fields reset
    setArrivalDays(0); setDispatchedDate(today());
    setPattyVehicleNo(""); setPattyPerson(""); setPattyDate(today());
    // Patty panel resets to unloaded so its percentages start fresh next time it's opened,
    // but purchaseMode (which mode the user is in) itself is left as-is — same as legacy
    // CMBTPatty being a persistent company setting rather than something cleared per-bill.
    setPattyRows((prev) => prev.map((r) => ({ ...r, Percentage: "0.00", BagRate: "0.00", ComAmt: "0.00" })));
    setTimeout(() => nextFocusForm(), 150);
  }, [loadMaxPurchaseNo, nextFocusForm]);

  // ─────────────────────────────────────────────────────────────────────────
  //  SANITIZE DETAIL ROW
  // ─────────────────────────────────────────────────────────────────────────
  const sanitizeDetailRow = useCallback((r) => {
    const n = (v) => { const x = parseFloat(v); return isNaN(x) ? 0 : x; };
    const i = (v) => { const x = parseInt(v, 10); return isNaN(x) ? 0 : x; };
    return {
      PDId: i(r.PDId), ProductRefId: i(r.ProductRefId),
      ProductCode: r.ProductCode || "", ProductName: r.ProductName || "",
      HSNCode: r.HSNCode || "", UOM: r.UOM || "",
      UOMDecimal: i(r.UOMDecimal), UOMRefid: i(r.UOMRefid) || null,
      MRP: n(r.MRP), OldMRP: n(r.OldMRP), OldPurchaseRate: n(r.OldPurchaseRate),
      PurchaseRate: n(r.PurchaseRate), cdpercent: n(r.cdpercent), cdAmount: n(r.cdAmount),
      DiscountPercent: n(r.DiscountPercent), DiscountAmt: n(r.DiscountAmt),
      CESSPer: n(r.CESSPer), CESSAmount: n(r.CESSAmount),
      SPLCESS: n(r.SPLCESS), SPLCESSAmount: n(r.SPLCESSAmount),
      TaxPercent: n(r.TaxPercent), TaxAmt: n(r.TaxAmt),
      CTAmount: n(r.CTAmount), STAmount: n(r.STAmount),
      CTPer: n(r.CTPer), STPer: n(r.STPer),
      Noms: i(r.Noms), NomQty: i(r.NomQty),
      ItemQty: n(r.ItemQty), FreeQty: n(r.FreeQty),
      StockQty: n(r.StockQty), StockQtyNew: n(r.StockQtyNew),
      Nstock: n(r.Nstock), RealQty: n(r.RealQty),
      TotalPcs: n(r.TotalPcs), Meter: n(r.Meter), Pcs: n(r.Pcs),
      Bags: n(r.Bags), LotNo: r.LotNo || "", Mark: r.Mark || "",
      ExpiryDate: r.ExpiryDate || "", MfgDate: (r.MfgDate && r.MfgDate.trim() !== "") ? r.MfgDate : ((r.ExpiryDate && r.ExpiryDate.trim() !== "") ? CC.today() : ""),
      Bat_No: r.Bat_No || "", BatchRefId: r.BatchRefId ? (parseInt(r.BatchRefId, 10) || null) : null,
      BatchStatus: i(r.BatchStatus), Expirydays: i(r.Expirydays),
      Salerate: n(r.Salerate), WholeSalerate: n(r.WholeSalerate),
      ProfitPer: n(r.ProfitPer), ProfitAmt: n(r.ProfitAmt),
      SaleDiscPer: n(r.SaleDiscPer), SaleDiscAmt: n(r.SaleDiscAmt),
      NetSaleRate: n(r.NetSaleRate), SaleGST: n(r.SaleGST),
      TransPer: n(r.TransPer), TransAmt: n(r.TransAmt),
      LandingCost: n(r.LandingCost), IGSTAmt: n(r.IGSTAmt),
      Amount: n(r.Amount), ProductTotal: n(r.ProductTotal),
      PoRefId: i(r.PoRefId) || 0, EditMode: i(r.EditMode),
      SerialNoStatus: i(r.SerialNoStatus), FreeQtyStatus: i(r.FreeQtyStatus),
      MrpStatus: i(r.MrpStatus), Narration: r.Narration || "",
      TextRefId: r.TextRefId || "",
      SizeId: i(r.SizeId) || 0, BrandId: i(r.BrandId) || 0,
      ModelId: i(r.ModelId) || 0, ColorId: i(r.ColorId) || 0,
      GengerId: i(r.GengerId) || 0, ToSizeId: i(r.ToSizeId) || 0,
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  //  EDIT
  // ─────────────────────────────────────────────────────────────────────────
  const handleEdit = useCallback(async (pid, pno) => {
    if (!perm.Edit) { toast("❌ Page Edit Permission Denied !!!.", true); return; }
    setLoading(true);
 
     let Patty = 0;
    let SPatty = 0;
    let ptype = 0;
    if (pattyFeatureEnabled ) {
      Patty = 1;
    } 
    if (purchaseMode === "PATTY") {
      ptype = 2;
    }  else if (purchaseMode === "ARRIVAL") {
      ptype = 1;
    }

   if (purchaseMode === "SALESPATTY") {
      SPatty = 1;
    }
    const res = await CC.api(CC.EditPurchase, null, {patty: Patty, SalesPatty: SPatty,ptype: ptype}, { Id: pid, PNo: pno, Comid: sess.Comid, BatchwiseSizeStock: 0 });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res._netErr || res._http404) { toast(`❌ ${res.message || "Edit load failed !!!."}`, true); return; }
    if (res.ok && res.Data1 && res.Data1.length > 0) {
      const pm = res.Data1[0];
      const pd = pm.PurchaseDetails || [];

      const igst = pm.IGSTBill;

      // ── FIX: if the saved purchase's IGSTBill is missing/blank/0, ─────────
      // fall back to the supplier master's current IGST setting instead of
      // silently defaulting to "GST".
      let isIgst;
      if (igst === "IGST" || igst === "1" || igst === 1 || igst === "2" || igst === 2) {
        isIgst = true;
      } else {
        // ambiguous / null / undefined / "" — look up supplier
        let supplierObj = supplierList.find((s) => String(s.Id) === String(pm.SupplierRefId));
        if (!supplierObj) {
          const sRes = await CC.api(CC.SupplierById, null, {}, { Id: pm.SupplierRefId, Comid: sess.MComid });
          supplierObj = sRes?.data?.[0] ?? sRes?.Data?.[0] ?? (Array.isArray(sRes?.data) ? sRes.data[0] : null);
        }
        const supIgst = supplierObj?.IGSTBill;
        isIgst = supIgst === "IGST" || supIgst === "1" || supIgst === 1 || supIgst === "2" || supIgst === 2;
      }

      const newIgstStatus = isIgst ? "IGST" : "GST";

      setEditId(pm.Id); setUpdateIdEdit(pm.UpdateId || "");
      setPurchaseDate(jsonDate(pm.PurchaseDate)); setDueDate(jsonDate(pm.DueDate));
      setInvoiceDate(jsonDate(pm.SupplierInvoiceDate));
      setPurchaseNo(pm.PurchaseNo || ""); setInvoiceNo(pm.SupplierInvoiceNo || "");
      setInvoiceAmt(fmt2(pm.NetAmt)); setOtherPlus(fmt2(pm.Others_A)); setOtherSub(fmt2(pm.Others_D));
      setRemarks(pm.Remarks || "");
      setPurchaseType(pm.PurchaseType === "CA" ? "CASH" : "CREDIT");
      setSupplierId(String(pm.SupplierRefId));
      handleSupplierChange(String(pm.SupplierRefId), { skipIgst: true });
      setIgstStatus(newIgstStatus);
      setIgstChecked(isIgst);
      setSerialNoList(pm.SerialNoDetails || []);

      // ── Restore purchaseMode from the saved bill (mirrors clsfunction.Patty / SalesPatty / PattyStatus) ──
    const savedPattyFlag    = Number(pm.PattyStatus);
const savedSalesPattyFlag = pm.SalesPatty === 1 || pm.SalesPatty === "1";
const savedArrivalType    = pm.PurchaseType === "AR" || savedPattyFlag === 1;

if (savedArrivalType) {
  setPurchaseMode("ARRIVAL");
} else if (savedPattyFlag === 2 && savedSalesPattyFlag) {
  setPurchaseMode("SALESPATTY");
} else if (savedPattyFlag === 2) {
  setPurchaseMode("PATTY");
} else {
  setPurchaseMode("PURCHASE");
}

      if (savedArrivalType) {
        setDispatchedDate(jsonDate(pm.DueDate));
      }

      // if (savedPattyFlag || savedSalesPattyFlag) {
      //   const savedPatty = pm.PurchasePattyDetails || pm.PattyDetails || [];
      //   if (savedPatty.length > 0) {
      //     setPattyRows(savedPatty.map((p) => ({
      //       _key: CC.uid(), Id: p.PattyMasterRefId || p.Id || 0,
      //       PattyName: p.Name || p.PattyName || "",
      //       Percentage: fmt2(p.Percentage || 0),
      //       BagRate: fmt2(p.BagRate || 0),
      //       ComAmt: fmt2(p.PercentageAmount || p.ComAmt || 0),
      //     })));
      //     setPattyLoaded(true);
      //   }
      // }
      if (savedPattyFlag || savedSalesPattyFlag) {
  const savedPatty = pm.PurchasePattyDetails || pm.PattyDetails || [];

  // முதலில் முழு Patty list-ஐ load பண்ணு (COMMISSION, COOLY, LORRY FREIGHT, SUNGAM...)
  try {
    const res = await CC.api(CC.PattySelect, null, {}, { Comid: sess.MComid });
    const fullList = Array.isArray(res) ? res : (res?.data ?? res?.Data1 ?? []);
    const baseList = (fullList && fullList.length > 0) ? fullList : PATTY_ROW_TEMPLATE;

    // Full list-ல் ஒவ்வொரு row-க்கும், saved data இருந்தால் அதை merge பண்ணு
    const merged = baseList.map((p) => {
      const savedRow = savedPatty.find(
        (s) => (s.Name || s.PattyName) === p.PattyName
             || Number(s.PattyMasterRefId || s.Id) === Number(p.Id)
      );
      return {
        _key: CC.uid(),
        Id: p.Id || 0,
        PattyName: p.PattyName || "",
        Percentage: fmt2(savedRow?.Percentage || 0),
        BagRate: fmt2(savedRow?.BagRate || 0),
        ComAmt: fmt2(savedRow?.PercentageAmount || savedRow?.ComAmt || 0),
      };
    });

    setPattyRows(merged);
  } catch {

    setPattyRows(savedPatty.map((p) => ({
      _key: CC.uid(), Id: p.PattyMasterRefId || p.Id || 0,
      PattyName: p.Name || p.PattyName || "",
      Percentage: fmt2(p.Percentage || 0),
      BagRate: fmt2(p.BagRate || 0),
      ComAmt: fmt2(p.PercentageAmount || p.ComAmt || 0),
    })));
  }
  setPattyLoaded(true);
}

      // calcRowWithIgst stays exactly as before, just uses newIgstStatus
      const calcRowWithIgst = (row) => {
        const qty           = valNum(row.ItemQty) + valNum(row.NomQty);
        const nomqty         = valNum(row.NomQty) === 0 ? 1 : valNum(row.NomQty);
        const purRate        = valNum(row.PurchaseRate);
        const enteredAmt     = roundOff(purRate * qty);
        const cdAmt          = roundOff(enteredAmt * (valNum(row.cdpercent) / 100));
        const discAmt        = roundOff((enteredAmt - cdAmt) * (valNum(row.DiscountPercent) / 100));
        const netEnteredAmt  = enteredAmt - cdAmt - discAmt;
        const taxPercent     = valNum(row.TaxPercent);
        let taxableAmt, gstAmt;
        if (taxMode === "inclusive") {
          taxableAmt = roundOff(netEnteredAmt / (1 + (taxPercent / 100)));
          gstAmt     = roundOff(netEnteredAmt - taxableAmt);
        } else {
          taxableAmt = roundOff(netEnteredAmt);
          gstAmt     = roundOff(taxableAmt * (taxPercent / 100));
        }
        const netRate    = qty !== 0 ? roundOff(taxableAmt / qty) : 0;
        const transAmt   = roundOff(taxableAmt * (valNum(row.TransPer) / 100));
        const cessAmt    = roundOff(taxableAmt * (valNum(row.CESSPer) / 100));
        const splCessAmt = roundOff(qty * valNum(row.SPLCESS));
        const isIGSTRow  = newIgstStatus === "IGST" || newIgstStatus === "UGST";
        const ctAmt      = isIGSTRow ? gstAmt : roundOff(gstAmt / 2);
        const stAmt      = isIGSTRow ? 0 : gstAmt - ctAmt;
        const landingCost = qty !== 0
          ? roundOff(netRate + (gstAmt + cessAmt + splCessAmt) / qty)
          : 0;
        let amount;
        if (taxMode === "inclusive") {
          amount = roundOff(netEnteredAmt + cessAmt + splCessAmt + transAmt);
        } else {
          amount = roundOff(netEnteredAmt + gstAmt + cessAmt + splCessAmt + transAmt);
        }
        const stockQty = roundOff(nomqty * qty + valNum(row.FreeQty));
        return {
          ...row,
          cdAmount:      fmt2(cdAmt),
          DiscountAmt:   fmt2(discAmt),
          TransAmt:      fmt2(transAmt),
          CESSAmount:    fmt2(cessAmt),
          SPLCESSAmount: fmt2(splCessAmt),
          TaxAmt:        fmt2(gstAmt),
          CTAmount:      fmt2(ctAmt),
          STAmount:      fmt2(stAmt),
          IGSTAmt:       fmt2(0),
          LandingCost:   fmt2(landingCost),
          Amount:        fmt2(amount),
          ProductTotal:  fmt2(enteredAmt),
          StockQtyNew:   fmt2(stockQty),
        };
      };

      const rows = pd.map((r) => calcRowWithIgst({
        ...makeGridRow(), ...r,
        BrandId: r.BrandId ? String(r.BrandId) : "",
        ModelId: r.ModelId ? String(r.ModelId) : "",
        ColorId: r.ColorId ? String(r.ColorId) : "",
        SizeId:  r.SizeId  ? String(r.SizeId)  : "",
        Bags:    r.Bags != null ? fmt2(r.Bags) : "0.00",
        LotNo:   r.LotNo || "",
        Mark:    r.Mark  || "",
        _origItemQty:        valNum(r.ItemQty),
        _origBatchRefId:     r.BatchRefId || 0,
        MfgDate:    r.MfgDate    ? jsonDate(r.MfgDate)    : "",
        ExpiryDate: r.ExpiryDate ? jsonDate(r.ExpiryDate) : "",
        _origPDRefid:        r.PDRefid || null,
        _origSerialNoStatus: r.SerialNoStatus || 0,
      }));
      rows.push(makeGridRow());
      setGridRows(rows);
      setTimeout(() => nextFocusForm(), 150);
    } else {
      toast(`❌ ${res.message || "Edit load failed !!!."}`, true);
    }
  }, [perm, sess, taxMode, supplierList, handleSupplierChange, toast, redirectIfDualLogin, nextFocusForm]);

  // ─────────────────────────────────────────────────────────────────────────
  //  DELETE
  // ─────────────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (overrideId, overridePno, overrideUpdateId) => {
    const targetId       = overrideId  || editId;
    const displayPno     = overridePno || purchaseNo;
    const targetUpdateId = overrideUpdateId !== undefined ? overrideUpdateId : updateIdEdit;

    if (!perm.Delete) { toast("❌ Page Delete Permission Denied !!!.", true); return; }
    if (!targetId)    { toast("❌ No Delete Id !!!.", true); return; }

    const ok = await confirm(`Do You Want To Delete Purchase Master. This is Purchase No ${displayPno}?`);
    if (!ok) return;

    // ── Step 1: Fetch the purchase detail first (mirrors SaleEditUrl fetch in handleF5Delete)
    // so we always have the original stock rows even when deleting from F5 list
    // without having loaded the record into the form first.
    setLoading(true);
    let stockDetails = [];

    try {
      const editRes = await CC.api(CC.EditPurchase, null, {}, {
        Id: targetId, PNo: displayPno, Comid: sess.Comid, BatchwiseSizeStock: 0,
      });
      if (redirectIfDualLogin(editRes)) return;

      if (editRes.ok && editRes.Data1 && editRes.Data1.length > 0) {
        const pm = editRes.Data1[0];
        const pd = pm.PurchaseDetails || [];

        // ── Build StockDetails from fetched detail rows ─────────────────────
        // Mirrors the edit-case stockDetails logic in handleSave
        stockDetails = pd
          .filter(r => valNum(r.ItemQty) > 0)
          .map(r => ({
            ProductRefid:   parseInt(r.ProductRefId, 10) || 0,
            Batchid:        parseInt(r.BatchRefId,   10) || 0,
            RealQty:        valNum(r.ItemQty),
            Qty:            0.0,
            MfDate:         r.MfgDate    || "",
            ExpDate:        r.ExpiryDate || "",
            SerialNoStatus: parseInt(r.SerialNoStatus, 10) || 0,
            AdjustType:     0,
            PDRefid:        r.PDId || null,
            ItemQty:        0.0,
            Bags:           0.0,
          }));
      }
    } catch (err) {
      console.error("Stock fetch before delete failed:", err);
      // Continue with empty stockDetails rather than blocking the delete
    }

    // ── Step 2: Delete with StockDetails ──────────────────────────────────────
    const res = await CC.api(CC.DeletePurchase, stockDetails, {  // ← pass as body, not params
      Year:        (new Date().getFullYear()).toString(),
      Comid:       String(sess.Comid),
      Id:          String(targetId),
      MirrorTable: String(sess.MirrorTable),
      Updateid:    targetUpdateId || "",
      LocalDB:     String(sess.LocalDB ?? "0"),
      univercell:  "false",
      DayClose:    "0",
      Date:        new Date().toLocaleDateString("en-GB"),
    }, null);

    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

    if (res.ok) {
      toast("✅ " + (res.message || "Purchase deleted successfully!"));
      handleClear();
      if (listViewOpen) handleF5View({});
    } else {
      if (res.redis === false) { alert("Already Login Another User Please Login Again!!!"); navigate("/"); return; }
      toast(`❌ ${res.message || "Delete failed !!!."}`, true);
    }
  }, [perm, editId, purchaseNo, updateIdEdit, sess, confirm, toast,
      redirectIfDualLogin, handleClear, listViewOpen, handleF5View, navigate]);

  // ─────────────────────────────────────────────────────────────────────────
  //  EDIT PASSWORD
  // ─────────────────────────────────────────────────────────────────────────
  const openEditPassword = useCallback((action) => {
    setPendingEditAction(action); setEditPwdValue(""); setEditPwdError(""); setEditPwdOpen(true);
  }, []);

  const handleEditPasswordSubmit = useCallback(async () => {
    if (!editPwdValue.trim()) return;
    setEditPwdLoading(true); setEditPwdError("");
    const res = await CC.api(CC.EditPassword, null, {}, { password: editPwdValue, type: "EditPassword", Comid: sess.Comid });
    setEditPwdLoading(false);
    if (res?.ok === true || res?.data?.ok === true) {
      setEditPwdOpen(false); setEditPwdValue("");
      const action = pendingEditAction; setPendingEditAction(null);
      if (!action) return;
      if (action.type === "EDIT")   { setListViewOpen(false); handleEdit(action.id, action.pno || 0); }
      if (action.type === "DELETE") {
        setListViewOpen(false); setEditId(action.id); setUpdateIdEdit(action.updateId || "");
        handleDelete(action.id, action.pno || "", action.updateId || "");
      }
      if (action.type === "F3_PROMPT") {
        setF3PromptValue("");
        setF3PromptError("");
        setF3PromptOpen(true);
        setTimeout(() => f3InputRef.current?.focus(), 80);
      }
    } else { setEditPwdError("Invalid Password !!!."); }
  }, [editPwdValue, sess.Comid, pendingEditAction, handleEdit, handleDelete, toast]);

  // ─────────────────────────────────────────────────────────────────────────
  //  F2 FREE PRODUCT
  // ─────────────────────────────────────────────────────────────────────────
  const handleF2FreeProduct = useCallback(async () => {
    if (!selectedCell.rowKey) { toast("❌ Invalid Check It !!!.", true); return; }
    const row = gridRows.find((r) => r._key === selectedCell.rowKey);
    if (!row) return;
    if (!row.ProductRefId) toast("❌ Invalid Check It !!!.", true);
    const ok = await confirm("Wish to Update Free Product Details ?");
    if (!ok) return;
    setGridRows((prev) => {
      const idx = prev.findIndex((r) => r._key === selectedCell.rowKey);
      if (idx === -1) return prev;
      const r = prev[idx];
      const updated = valNum(r.FreeQtyStatus) === 1
        ? calcRow({ ...r, FreeQtyStatus: 0, PurchaseRate: r.OldPurchaseRate })
        : calcRow({ ...r, FreeQtyStatus: 1, PurchaseRate: "0.00", cdpercent: "0.00", DiscountPercent: "0.00", CESSPer: "0.00", SPLCESS: "0.00" });
      const rows = [...prev];
      rows[idx] = updated;
      return rows;
    });
  }, [selectedCell.rowKey, gridRows, calcRow, confirm, toast]);

  // ─────────────────────────────────────────────────────────────────────────
  //  GRID KEYBOARD
  // ─────────────────────────────────────────────────────────────────────────
  const handleGridKeyDown = useCallback((e, rowKey, colKey) => {
    const visibleCols = orderedGridColumns.filter((c) => isColVisible(c) && c.editable);
    const colIdx = visibleCols.findIndex((c) => c.key === colKey);
    const rowIdx = gridRows.findIndex((r) => r._key === rowKey);

    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();

      // Always compute the new state for this cell and recalculate row
      setGridRows((prev) => {
        const idx = prev.findIndex((r) => r._key === rowKey);
        if (idx === -1) return prev;

        let r = { ...prev[idx] };

        if (e.target && e.target.value !== undefined) {
         if (colKey === "ItemQty" && exceedsDecimalLimit(e.target.value, r.UOMDecimal)) {
            // Keep old value
          } else {
            r[colKey] = e.target.value;
          }
        }

        if (purRateInclusive) {
          let incPr = valNum(r.IncPurRate);
          const tax = valNum(r.TaxPercent);

          if (colKey === "PurchaseRate") {
            const enteredValue = valNum(e.target.value);
            if (enteredValue > 0) incPr = enteredValue;
          } else if (incPr === 0) {
            const rawPr = valNum(r.PurchaseRate);
            if (rawPr > 0) incPr = rawPr;
          }

          if (incPr > 0) {
            r.IncPurRate   = incPr;
            r.PurchaseRate = tax > 0
              ? (incPr / (1 + tax / 100)).toFixed(2)
              : incPr.toFixed(2);
          }
        }

        if (!BATCH_ID_KEYS.has(colKey) && CALC_KEYS.has(colKey)) {
           r = calcRow(r);
        }

        const updated = [...prev];
        updated[idx] = r;
        return updated;
      });

      if (colKey === "ProductCode") {
        const row  = gridRows[rowIdx];
        const code = nullStr(row.ProductCode).trim();
        if (code === "") { setProductPopup({ open: true, rowKey, list: [], query: "", autoLoad: true }); return; }
        fillProductByCode(code, rowKey); return;
      }

      if (colKey === "ItemQty") {
        const row = gridRows[rowIdx];
        const mainSet = JSON.parse(localStorage.getItem("Mainsetting") || "[{}]");
        const textileSerial = mainSet?.[0]?.TextilesSerialNowiseBilling ?? false;
        calcRow(row);
        if (textileSerial && valNum(row.SerialNoStatus) === 1) {
          const existingSerials = serialNoList.filter((s) => s.IndexRefId === row.TextRefId);
          setSerialNoPopup({ open: true, rowKey, textRefId: row.TextRefId, list: existingSerials, returnColKey: "ItemQty" });
          return;
        }
      }

      if (colKey === "MfgDate") {
        const row = gridRows[rowIdx];
        const expDays = parseInt(row.Expirydays, 10) || 0;
        if (row.MfgDate && expDays > 0) {
          const expiry = new Date(row.MfgDate);
          expiry.setDate(expiry.getDate() + expDays);
          if (expiry <= new Date()) { toast("❌ Already This Product Was Expired !!!.", true); return; }
          const expDate = expiry.toISOString().split("T")[0];
          setGridRows((prev) => prev.map((r) => r._key === rowKey ? { ...r, ExpiryDate: expDate } : r));
        }
      }

      if (colKey === "ExpiryDate") {
        const row = gridRows[rowIdx];
        if (row.ExpiryDate && new Date(row.ExpiryDate) <= new Date()) {
          toast("❌ Already This Product Was Expired !!!.", true); return;
        }
      }

      // Move next cell (respects Ctrl+G focus settings)
      const liveFocusCols    = focusgridcolumnsRef.current;
      const focusEnabledCols = visibleCols.filter((c) => {
        const fc = liveFocusCols.find((f) => f.column === c.key);
        return fc ? fc.focus === 1 : true;
      });
      const focusColIdx  = focusEnabledCols.findIndex((c) => c.key === colKey);
      const nextFocusCol = focusEnabledCols[focusColIdx + 1];
      const firstFocusCol = focusEnabledCols[0]?.key ?? visibleCols[0].key;

      const moveNext = () => {
        if (nextFocusCol) {
          focusCell(rowKey, nextFocusCol.key);
        } else if (rowIdx < gridRows.length - 1) {
          focusCell(gridRows[rowIdx + 1]._key, firstFocusCol);
        } else {
          const emptyRow = makeGridRow();
          setGridRows((prev) => [...prev, emptyRow]);
          setTimeout(() => focusCell(emptyRow._key, firstFocusCol), 50);
        }
      };

      if (colKey === "MRP") {
        const row = gridRows[rowIdx];

        const mulipleMRP = sess.MulipleMRP === true || sess.MulipleMRP === "true" || sess.MulipleMRP === "1";
        const newMrp = valNum(row.MRP);
        const oldMrp = valNum(row.OldMRP);

        if (mulipleMRP && row.ProductRefId && oldMrp !== 0 && newMrp !== 0 && newMrp !== oldMrp) {
          confirm("This is New MRP Rate for this Item. Do You Want To Add MultipleMRP Product ?").then((ok) => {
            if (ok) {
              // OK => mark ONLY current row
              setGridRows((prev) =>
                prev.map((r) => (r._key === rowKey ? { ...r, MrpStatus: 1 } : r))
              );
            } else {
              // Cancel => restore ONLY current row MRP back to OldMRP
              setGridRows((prev) =>
                prev.map((r) => (r._key === rowKey ? { ...r, MRP: String(oldMrp) } : r))
              );
            }
            // keep legacy navigation AFTER user decision
            moveNext();
          });
          // important: stop legacy navigation until confirm resolves
          return;
        }
      }

      // If confirmation not required, continue as before.
      moveNext();

    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIdx < gridRows.length - 1) focusCell(gridRows[rowIdx + 1]._key, colKey);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIdx > 0) focusCell(gridRows[rowIdx - 1]._key, colKey);
    } else if (e.key === "ArrowRight" && colIdx < visibleCols.length - 1) {
      if (e.currentTarget.selectionStart === e.currentTarget.value?.length) {
        e.preventDefault(); focusCell(rowKey, visibleCols[colIdx + 1].key);
      }
    } else if (e.key === "ArrowLeft" && colIdx > 0) {
      if (e.currentTarget.selectionStart === 0) {
        e.preventDefault(); focusCell(rowKey, visibleCols[colIdx - 1].key);
      }
    } else if (e.key === "Delete" && e.shiftKey) {
      deleteGridRow(rowKey);
    }
  }, [gridRows, isColVisible, orderedGridColumns, fillProductByCode, deleteGridRow, focusCell, serialNoList, setSerialNoPopup, toast, purRateInclusive, calcRow]);

  // ─────────────────────────────────────────────────────────────────────────
  //  SAVE
  // ─────────────────────────────────────────────────────────────────────────

  const handleF3PromptSubmit = useCallback(() => {
    const value = f3PromptValue.trim();
    if (!value || valNum(value) === 0) {
      setF3PromptError("Enter Valid Purchase Number !!!.");
      return;
    }
    setF3PromptOpen(false);
    handleEdit(0, value);
  }, [f3PromptValue, handleEdit]);

  const handleSave = useCallback(async () => {
    if (!perm.Add) { toast("❌ Page Add Permission Denied !!!.", true); return; }
    if (!supplierId) { toast("❌ Select Valid Supplier !!!.", true); supplierRef.current?.focus(); return; }
    if (!invoiceNo.trim()) { toast("❌ Enter Supplier Invoice Number !!!.", true); invoiceNoRef.current?.focus(); return; }
    if (valNum(finalNetAmt) <= 0) { toast("❌ Net Total must not be Negative !!!.", true); return; }
    if (valNum(invoiceAmt) !== valNum(finalNetAmt)) {
      toast("❌ Invoice Amount Not Equal To Net Total Amount !!!.", true); invoiceAmtRef.current?.focus(); return;
    }
    const mainSet        = JSON.parse(localStorage.getItem("Mainsetting") || "[{}]");
    const batchWiseStock = mainSet?.[0]?.BatchWiseStock ?? false;
    const textileSerial  = mainSet?.[0]?.TextilesSerialNowiseBilling ?? false;
    if (batchWiseStock || textileSerial) {
      const dataRows = gridRows.filter((r) => r.ProductCode !== "");
      if (textileSerial) {
        for (const r of dataRows) {
          if (valNum(r.SerialNoStatus) === 1) {
            const serials = serialNoList.filter((s) => s.IndexRefId === r.TextRefId);
            if (serials.length === 0) { toast(`❌ Enter Serial Numbers for item: ${r.ProductName || r.ProductCode} !!!.`, true); return; }
            if (serials.length !== valNum(r.ItemQty)) {
              toast(`❌ Serial No count (${serials.length}) must equal Quantity (${r.ItemQty}) for ${r.ProductName || r.ProductCode} !!!.`, true); return;
            }
          }
        }
      }
    }
    const ok = await confirm("Wish to Save Purchase Details ?");
    if (!ok) return;
    setLoading(true);
    const supplier         = supplierList.find((s) => String(s.Id) === String(supplierId)) || {};
    const purchaseDetails  = gridRows.filter((r) => r.ProductCode !== "").map(sanitizeDetailRow);
    const purtype          = purchaseType === "CASH" ? "CA" : "CR";
    const stockDetails     = editId > 0
      ? gridRows.filter((r) => r.ProductCode !== "" && valNum(r._origItemQty) > 0).map((r) => ({
          ProductRefid: parseInt(r.ProductRefId, 10) || 0,
          Batchid: parseInt(r._origBatchRefId, 10) || 0,
          RealQty: valNum(r._origItemQty), Qty: 0.0,
          MfDate: r.MfgDate || "", ExpDate: r.ExpiryDate || "",
          SerialNoStatus: parseInt(r._origSerialNoStatus, 10) || 0,
          AdjustType: 0, PDRefid: r.PDRefid || null, ItemQty: 0.0, Bags: 0.0,
        }))
      : [];

    // ── Patty details payload (mirrors PattyModel[] → PurchasePattyDetails) ──
    // Only rows with a nonzero % OR a nonzero BagRate are sent, matching
    // "if (Conversion.Val(ComAmt) != 0)" in the .cs, now covering both branches.
    const purchasePattyDetails = pattyMode
      ? pattyRows
          .filter((r) => valNum(r.Percentage) !== 0 || valNum(r.BagRate) !== 0)
          .map((r) => ({
            PattyMasterRefId: Number(r.Id) || 0,
            Name:             r.PattyName,
            Percentage:       valNum(r.Percentage),
            BagRate:          valNum(r.BagRate),
            PercentageAmount: computePattyRowAmt(r),
          }))
      : [];

    // Arrival mode reuses the Purchase save endpoint but with its own type code
    // and Dispatched Date standing in for DueDate (mirrors PM.DueDate = dtpdispatchedDate
    // and rdbarrival.Checked branch around line 7379 in frmpurchase.cs).
    const effectivePurchaseType = purchaseMode === "ARRIVAL" ? "AR" : purtype;
    const effectiveDueDate      = purchaseMode === "ARRIVAL" ? dispatchedDate : dueDate;
 const PattyStatus=purchaseMode=="PURCHASE" ? 3 : purchaseMode=="PATTY" ? 2 : purchaseMode=="SALESPATTY" ? 2 : purchaseMode=="ARRIVAL" ? 1 : 3;
    const purchaseMaster = [{
      Id: editId, Modified_By: parseInt(localStorage.getItem("userid") || "0", 10),
      SupplierRefId: parseInt(supplierId, 10) || 0,
      PurchaseNo: purchaseNo, CompanyRefId: parseInt(sess.Comid, 10) || 0,
      PurchaseDate: purchaseDate, PurchaseType: effectivePurchaseType, IGSTBill: igstStatus,
      taxamount: valNum(totals.gstAmt), CTAmount: valNum(totals.cgstAmt), STAmount: valNum(totals.sgstAmt),
      SupplierInvoiceNo: invoiceNo, SupplierInvoiceDate: invoiceDate,
      NetAmt: valNum(finalNetAmt), discamount: valNum(totals.discAmt),
      cdamount: valNum(totals.cdAmt), Others_A: valNum(otherPlus), Others_D: valNum(otherSub),
      DueDate: effectiveDueDate, DisplayAmount: valNum(finalNetAmt),
      FreightCharges: valNum(totals.transAmt), CESSAmount: valNum(totals.cessAmt),
      SPLCESSAmount: 0, Remarks: remarks, UpdateId: updateIdEdit || "",
      Credit: 0, Debit: valNum(finalNetAmt), IGSTAmount: 0,
      SupplierName: supplier.AccountName || "",
      Address1: supplier.Address1 || "", Address2: supplier.Address2 || "",
      City: supplier.City || "", Phone: supplier.MobileNo || "", Tin: supplier.GSTNo || "",
      Email: supplier.Email || "", PaymentRefId: null, PoRefId: null, MultiPurchaseOrderMasterRefid: 0,
      PurchaseDetails: purchaseDetails, StockDetails: stockDetails, SerialNoDetails: serialNoList,
      // ── Patty / SalesPatty / Arrival flags — mirror clsfunction.CMBTPatty / SalesPatty
      // branches; harmless/empty for plain PURCHASE mode. ─────────────────────────────
      PattyStatus:     PattyStatus,
      SalesPatty: purchaseMode === "SALESPATTY" ? 1 : 0,
      PattyAmount: pattyMode ? valNum(pattyTotal) : 0,
      PurchasePattyDetails: purchasePattyDetails,
      VehicleNo: pattyMode ? pattyVehicleNo : "",
      Person:    pattyMode ? pattyPerson    : "",
    }];
console.log("Saving purchaseMaster:", purchaseMaster);
    const res = await CC.insertapi(CC.InsertPurchase, purchaseMaster, {
      Comid: String(sess.Comid), MirrorTable: String(sess.MirrorTable), IdComList: String(sess.IdComList),
      batchstockstatus: (() => {
        const ms = JSON.parse(localStorage.getItem("Mainsetting") || "[{}]");
        return (ms?.[0]?.BatchWiseStock === true || ms?.[0]?.TextilesSerialNowiseBilling === true) ? "1" : "0";
      })(),
      ItemMasterRateEditUpdate: String(sess.ItemMasterRateUpdate ?? false),
      CommonCompany: String(sess.Commoncompany ?? false),
      CommonCompanyDiffStock: String(sess.CommoncompanyDiffStock ?? false),
      SupplierMulitipleAllow: String(sess.SupplierMulitipleAllow ?? false),
      MulipleMRP: String(sess.MulipleMRP ?? false),
      ItemMasterRateUpdate: String(sess.PurchaseItemmasterSave === "1" ? "true" :"false"),
      BatchPerfix: String(sess.BatchPerfix ?? ""),
      BatchDigit: String(parseInt(sess.BatchDigit, 10) || 0),
      LocalDB: String(parseInt(sess.LocalDB, 10) || 0),
      // ── Patty flag on the insert-api mapping — reflects the current mode ──
      Patty: pattyMode ? "1" : "0",
      DayClose: "0", BillFormatName: "", PrintA4Invoice: "0",
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res.ok || res.IsSuccess) {
      toast("✅ " + (res.message || "Purchase saved successfully!"));
      handleClear();
    } else { toast(`❌ ${res.message || "Save failed !!!."}`, true); }
  }, [
    perm, supplierId, invoiceNo, totals, invoiceAmt, finalNetAmt, pattyMode, pattyRows, pattyTotal,
    purchaseMode, dispatchedDate, pattyVehicleNo, pattyPerson, computePattyRowAmt,
    gridRows, purchaseType, editId, updateIdEdit, purchaseNo, sess,
    purchaseDate, invoiceDate, dueDate, igstStatus,
    otherPlus, otherSub, remarks, supplierList, serialNoList,
    confirm, toast, redirectIfDualLogin, handleClear, sanitizeDetailRow,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  //  GLOBAL KEYBOARD SHORTCUTS
  // FIX 3: added handleFocusFormColOpen + focusFormColOpen to deps and guard
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      // FIX 3a: added focusFormColOpen to the popup-open guard
     if (productPopup.open || f12Open || listViewOpen || focusColOpen || focusFormColOpen || serialNoPopup.open || f3PromptOpen) return;

      if (e.keyCode === 112) { e.preventDefault(); handleSave(); }           // F1
      if (e.keyCode === 113) { e.preventDefault(); handleF2FreeProduct(); }  // F2
      if (e.keyCode === 114) {                                                // F3 — Edit by Purchase No
        e.preventDefault();
        if (!perm.Edit) { toast("❌ Page Edit Permission Denied !!!.", true); return; }
        openEditPassword({ type: "F3_PROMPT" });
      }
      if (e.keyCode === 115) { e.preventDefault(); handleDelete(); }         // F4
      if (e.keyCode === 116) { e.preventDefault(); handleF5View({}); }       // F5
      if (e.keyCode === 120) {                                                // F9
        e.preventDefault();
        if (!perm.Delete) { toast("❌ Page Delete Permission Denied !!!.", true); return; }
        if (!editId) { toast("❌ No Delete Id !!!.", true); return; }
        openEditPassword({ type: "DELETE", id: editId, updateId: updateIdEdit });
      }
      if (e.keyCode === 121) { e.preventDefault(); handleClear(); }          // F10
      if (e.keyCode === 123) { e.preventDefault(); handleF12Open(); }        // F12
      if (e.ctrlKey && e.keyCode === 71) { e.preventDefault(); handleFocusColOpen(); }   // Ctrl+G
      if (e.ctrlKey && e.keyCode === 70) { e.preventDefault(); handleFocusFormColOpen(); } // Ctrl+F
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    // FIX 3b: added handleFocusFormColOpen + focusFormColOpen to dependency array
    handleSave, handleF2FreeProduct, handleF5View, handleDelete, handleClear, handleF12Open,
    handleFocusColOpen, handleFocusFormColOpen,
    productPopup.open, f12Open, listViewOpen, focusColOpen, focusFormColOpen, serialNoPopup.open,
    gridRows, perm.Delete, editId, updateIdEdit, openEditPassword, toast,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  //  RENDER CELL
  // ─────────────────────────────────────────────────────────────────────────
  const renderCell = useCallback((row, col) => {
    const isSelected = selectedCell.rowKey === row._key && selectedCell.colKey === col.key;
    const cellId     = `cell_${row._key}_${col.key}`;
    // FIX 8: mirror the legacy jQuery "editedRow" cellclass — free-product rows
    // (FreeQtyStatus === 1) get a soft green tint on every cell in the row.
    const isFreeRow  = valNum(row.FreeQtyStatus) === 1;

    if (!col.editable) {
      return (
        <td key={col.key} className={`grid-cell readonly ${col.align === "right" ? "right" : ""} ${isFreeRow ? "free-product-row" : ""}`}
          style={isFreeRow ? { background: "#e6f9ec" } : undefined}>
          {row[col.key] ?? ""}
        </td>
      );
    }

    const onFocus = (e) => {
      e.target.select?.();
      setSelectedCell({ rowKey: row._key, colKey: col.key });
    };

    // ItemQty — Serial-No-wise billing lock (mirrors jQuery cellbeginedit block on grdItemQty
    // when SerialNoStatus == 1: direct typing is refused, quantity can only be set by entering
    // the Serial No list, whose count becomes the ItemQty).
    if (col.key === "ItemQty" && valNum(row.SerialNoStatus) === 1) {
      const mainSet = JSON.parse(localStorage.getItem("Mainsetting") || "[{}]");
      const textileSerial = mainSet?.[0]?.TextilesSerialNowiseBilling ?? false;
      if (textileSerial) {
        const openSerialPopup = () => {
          let textRefId = row.TextRefId;
          if (!textRefId) {
            textRefId = CC.uid();
            setGridRows((prev) => prev.map((r) => (r._key === row._key ? { ...r, TextRefId: textRefId } : r)));
          }
          const existingSerials = serialNoList.filter((s) => s.IndexRefId === textRefId);
          setSerialNoPopup({ open: true, rowKey: row._key, textRefId, list: existingSerials, returnColKey: "ItemQty" });
        };
        return (
          <td key={col.key} className={`grid-cell editable ${isSelected ? "selected" : ""} right ${isFreeRow ? "free-product-row" : ""}`}
            style={isFreeRow ? { background: "#e6f9ec" } : undefined}>
            <input
              id={cellId}
              className="cell-input right"
              style={{ width: "100%", cursor: "pointer", background: isFreeRow ? "#e6f9ec" : "#f1f5f9" }}
              value={row[col.key] ?? ""}
              readOnly
              title="Serial No item — click to enter Serial Numbers"
              onFocus={() => setSelectedCell({ rowKey: row._key, colKey: col.key })}
              onClick={openSerialPopup}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); openSerialPopup(); }
                else handleGridKeyDown(e, row._key, col.key);
              }}
              tabIndex={0}
            />
          </td>
        );
      }
    }

    // Bat_No — red border when required but empty
    if (col.key === "Bat_No") {
      const needsBatch = valNum(row.BatchStatus) === 1 && !row.Bat_No?.trim();
      return (
        <td key={col.key} className={`grid-cell editable ${isSelected ? "selected" : ""} ${isFreeRow ? "free-product-row" : ""}`}
          style={isFreeRow ? { background: "#e6f9ec" } : undefined}>
          <input id={cellId} type="text" className="cell-input" value={row[col.key] ?? ""}
            onChange={(e) => handleCellChange(row._key, col.key, e.target.value)}
            onFocus={onFocus} onKeyDown={(e) => handleGridKeyDown(e, row._key, col.key)} tabIndex={0}
            style={needsBatch ? { borderBottom: "2px solid #ef4444", background: "#fff7f7" } : (isFreeRow ? { background: "#e6f9ec" } : {})}
            title={needsBatch ? "Batch No required for this item" : ""}
          />
        </td>
      );
    }

    // BatchWise dropdowns
    const batchDropdowns = {
      BrandId: { active: bStatus === 1, list: brandList, valueProp: "Id", labelProp: "BrandName", title: "Brand" },
      ModelId: { active: mStatus === 1, list: modelList, valueProp: "Id", labelProp: "ModelName", title: "Model" },
      ColorId: { active: cStatus === 1, list: colorList, valueProp: "Id", labelProp: "ColorName", title: "Color" },
      SizeId:  { active: sStatus === 1, list: sizeList,  valueProp: "Id", labelProp: "SizeName", title: "Size"  },
    };
    const ddConfig = batchDropdowns[col.key];
    if (ddConfig?.active) {
      if (["BrandId", "ColorId", "SizeId", "ModelId"].includes(col.key)) {
        const selectedItem = ddConfig.list.find(x => String(x[ddConfig.valueProp]) === String(row[col.key]));
        const dispText = selectedItem ? selectedItem[ddConfig.labelProp] : "";
        return (
          <td key={col.key} className={`grid-cell editable ${isSelected ? "selected" : ""} ${isFreeRow ? "free-product-row" : ""}`}
            style={isFreeRow ? { background: "#e6f9ec" } : undefined}>
            <input id={cellId} className="cell-input" style={{ width: "100%", cursor: "pointer", background: isFreeRow ? "#e6f9ec" : "#fff" }} value={dispText} readOnly
              onFocus={() => {
                setSelectedCell({ rowKey: row._key, colKey: col.key });
                setGridComboPopup({ open: true, rowKey: row._key, colKey: col.key, query: "", list: ddConfig.list, valueProp: ddConfig.valueProp, labelProp: ddConfig.labelProp, title: ddConfig.title });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "ArrowDown") {
                  e.preventDefault();
                  setGridComboPopup({ open: true, rowKey: row._key, colKey: col.key, query: "", list: ddConfig.list, valueProp: ddConfig.valueProp, labelProp: ddConfig.labelProp, title: ddConfig.title });
                } else {
                  handleGridKeyDown(e, row._key, col.key);
                }
              }} tabIndex={0} placeholder="-- Select --" />
          </td>
        );
      }
      return (
        <td key={col.key} className={`grid-cell editable ${isSelected ? "selected" : ""} ${isFreeRow ? "free-product-row" : ""}`}
          style={isFreeRow ? { background: "#e6f9ec" } : undefined}>
          <select id={cellId} className="cell-input" style={{ width: "100%", background: isFreeRow ? "#e6f9ec" : undefined }} value={row[col.key] ?? ""}
            onFocus={() => setSelectedCell({ rowKey: row._key, colKey: col.key })}
            onChange={(e) => handleCellChange(row._key, col.key, e.target.value)}
            onKeyDown={(e) => handleGridKeyDown(e, row._key, col.key)} tabIndex={0}>
            <option value="">-- Select --</option>
            {ddConfig.list.map((item) => (
              <option key={item[ddConfig.valueProp]} value={item[ddConfig.valueProp]}>{item[ddConfig.labelProp]}</option>
            ))}
          </select>
        </td>
      );
    }

    // Default: text / date / number
    return (
      <td key={col.key} className={`grid-cell editable ${isSelected ? "selected" : ""} ${col.align === "right" ? "right" : ""} ${isFreeRow ? "free-product-row" : ""}`}
        style={isFreeRow ? { background: "#e6f9ec" } : undefined}>
        <input id={cellId} type={col.type === "date" ? "date" : "text"}
          className={`cell-input ${col.align === "right" ? "right" : ""}`}
          style={isFreeRow ? { background: "#e6f9ec" } : undefined}
          value={row[col.key] ?? ""}
          onChange={(e) => handleCellChange(row._key, col.key, e.target.value)}
          onFocus={onFocus} onKeyDown={(e) => handleGridKeyDown(e, row._key, col.key)} tabIndex={0}
        />
      </td>
    );
  }, [selectedCell, handleCellChange, handleGridKeyDown, bStatus, sStatus, cStatus, mStatus, brandList, modelList, colorList, sizeList, serialNoList]);

  if (!isAuthorized) return null;

  // ─────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="pur-root">
      {ConfirmUI}

      {/* ── Ctrl+F Form Focus Columns Modal ── */}
      {focusFormColOpen && (
        <div className="popup-overlay">
          <div className="popup-window f12-popup" style={{ width: 480, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <div className="popup-header">
              <span>Form Columns Reorder &amp; Focus (Ctrl+F)</span>
              <button className="popup-close" onClick={() => setFocusFormColOpen(false)}>✕</button>
            </div>
            <div className="popup-body" style={{ overflowY: "auto", flex: 1 }}>
              <table className="popup-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ width: 70, textAlign: "center" }}>Position</th>
                    <th style={{ textAlign: "left" }}>Field Name</th>
                    <th style={{ width: 80, textAlign: "center" }}>Focus</th>
                  </tr>
                </thead>
                <tbody>
                  {focusFormColDraft.map((d, idx) => (
                    <tr key={d.column} draggable
                      onDragStart={() => handleFocusFormDragStart(idx)}
                      onDragOver={(e) => handleFocusFormDragOver(e, idx)}
                      onDragEnd={handleFocusFormDragEnd}
                      style={{ background: focusFormDragIdx === idx ? "#e0f2fe" : "transparent", cursor: "grab" }}>
                      <td style={{ textAlign: "center", fontWeight: 600 }}>{idx + 1}</td>
                      <td>{d.label}</td>
                      <td style={{ textAlign: "center" }}>
                        <input type="checkbox" checked={!!d.Focus}
                          onChange={() => handleFocusFormToggle(idx, !d.Focus)}
                          style={{ width: 14, height: 14, accentColor: "#1f65de" }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="popup-footer">
              <button className="btn btn-primary btn-sm" onClick={handleFocusFormColSave} disabled={loading}>💾 Save</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setFocusFormColOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <Topbar />

      {/* ── Product Lookup Popup ── */}
      {productPopup.open && (
        <ProductPopup productPopup={productPopup} setProductPopup={setProductPopup}
          applyProductToRow={applyProductToRow} sess={sess} setLoading={setLoading} />
      )}
      
      {gridComboPopup.open && (
        <GridComboPopup state={gridComboPopup} setState={setGridComboPopup}
          sess={sess} setLoading={setLoading} handleCellChange={handleCellChange}
          setColorList={setColorList} setSizeList={setSizeList} setModelList={setModelList} setBrandList={setBrandList}
          moveToNextCell={(rowKey, colKey) => {
            // Find next editable col and focus it
            const colIdx = colConfig.findIndex(c => c.key === colKey);
            if (colIdx === -1) return;
            let nextColKey = colKey;
            for (let i = colIdx + 1; i < colConfig.length; i++) {
              if (colConfig[i]?.visible) {
                nextColKey = colConfig[i].key; break;
              }
            }
            if (nextColKey !== colKey) {
              setTimeout(() => {
                const el = document.getElementById(`cell-${rowKey}-${nextColKey}`);
                if (el) el.focus();
              }, 50);
            }
          }}
        />
      )}

      {/* ── MRP Selection Popup ── */}
      {mrpPopup.open && (
        <MRPSelectionPopup mrpPopup={mrpPopup} setMrpPopup={setMrpPopup} applyProductToRow={applyProductToRow} />
      )}

      {/* ── Serial Number Popup ── */}
      {serialNoPopup.open && (
        <SerialNoPopup serialNoPopup={serialNoPopup} setSerialNoPopup={setSerialNoPopup}
          serialNoList={serialNoList} setSerialNoList={setSerialNoList} setGridRows={setGridRows} calcRow={calcRow} />
      )}

      {/* ── F12 Column Config ── */}
      {f12Open && (
        <div className="popup-overlay">
          <div className="popup-window f12-popup">
            <div className="popup-header">
              <span>Column Configuration (F12)</span>
              <button className="popup-close" onClick={() => {
                setF12Open(false);
                const prev = f12PrevCellRef.current;
                if (prev?.rowKey && prev?.colKey) {
                  setTimeout(() => { const el = document.getElementById(`cell_${prev.rowKey}_${prev.colKey}`); if (el) { el.focus(); el.select?.(); } }, 50);
                }
              }}>✕</button>
            </div>
            <div className="popup-body">
              <table className="popup-table">
                <thead><tr><th style={{ width: 180 }}>Column</th><th style={{ width: 70, textAlign: "center" }}>Visible</th><th style={{ width: 70, textAlign: "right" }}>Width</th></tr></thead>
                <tbody>
                  {f12Draft.map((cfg) => {
                    const base = BASE_COLUMNS.find((c) => c.key === cfg.key);
                    if (!base) return null;
                    return (
                      <tr key={cfg.key}>
                        <td>{base.label}</td>
                        <td className="center"><input type="checkbox" checked={cfg.visible} onChange={(e) => f12SetVisible(cfg.key, e.target.checked)} /></td>
                        <td><input type="number" style={{ width: 60 }} value={cfg.width} onChange={(e) => f12SetWidth(cfg.key, e.target.value)} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="popup-footer">
              <button className="btn btn-primary btn-sm" onClick={handleF12Save} disabled={loading}>💾 Save</button>
              <button className="btn btn-secondary btn-sm" onClick={() => {
                setF12Open(false);
                const prev = f12PrevCellRef.current;
                if (prev?.rowKey && prev?.colKey) {
                  setTimeout(() => { const el = document.getElementById(`cell_${prev.rowKey}_${prev.colKey}`); if (el) { el.focus(); el.select?.(); } }, 50);
                }
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── F3: Purchase No Prompt Modal ── */}
      {f3PromptOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,20,40,0.45)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: "22px 28px 18px", minWidth: 260, maxWidth: 320, boxShadow: "0 8px 32px rgba(0,0,0,0.22)", border: "1px solid #c5d8f8", textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: "#1e293b" }}>🔍 Edit {modeLabels.no} (F3)</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, textAlign: "left" }}>Enter the {modeLabels.no}</div>
            <input
              ref={f3InputRef}
              type="text"
              style={{ width: "100%", padding: "7px 10px", border: "1px solid #c5d8f8", borderRadius: 6, fontSize: 14, outline: "none", boxSizing: "border-box" }}
              value={f3PromptValue}
              onChange={(e) => { setF3PromptValue(e.target.value); setF3PromptError(""); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleF3PromptSubmit(); }
                if (e.key === "Escape") { setF3PromptOpen(false); }
              }}
              placeholder="e.g. 1024"
            />
            {f3PromptError && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 6 }}>{f3PromptError}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "center" }}>
              <button
                style={{ padding: "7px 22px", borderRadius: 6, border: "none", background: "linear-gradient(135deg,#3b82f6,#1d4ed8)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                onClick={handleF3PromptSubmit}
                disabled={!f3PromptValue.trim()}
              >
                ✔ OK
              </button>
              <button
                style={{ padding: "7px 22px", borderRadius: 6, border: "1px solid #c5d8f8", background: "#f5f9ff", color: "#6b7a99", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                onClick={() => setF3PromptOpen(false)}
              >
                ✘ Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── F5 List View ── */}
      {listViewOpen && (
        <div className="popup-overlay">
          <div className="popup-window f5-popup" style={{ width: 980, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <div className="popup-header">
              <span>Purchase List View (F5)</span>
              <button className="popup-close" onClick={() => { setListViewOpen(false); setF5MasterList([]); setF5DetailList([]); setF5SupplierId(""); setFromDate(today()); setToDate(today()); }}>✕</button>
            </div>
            <div style={{ padding: "12px", borderBottom: "1px solid #c5d8f8", background: "#f5f9ff" }}>
              <div style={{ display: "grid", gridTemplateColumns: "90px 140px 80px 140px 180px", gap: "10px", alignItems: "center", marginBottom: "10px" }}>
                <label>From Date</label>
                <input type="date" className="form-ctrl" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                <label>To Date</label>
                <input type="date" className="form-ctrl" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                <div style={{ position: "relative", width: "100%" }}>
                  <input type="text" className="form-ctrl" placeholder="Select Supplier Name"
                    value={f5SupplierOpen ? f5SupplierSearch : (supplierList.find(s => String(s.Id) === String(f5SupplierId))?.AccountName || "")}
                    onChange={(e) => { setF5SupplierSearch(e.target.value); setF5SupplierOpen(true); setF5SupplierHi(0); if (e.target.value.trim() === "") setF5SupplierId(""); }}
                    onFocus={() => { setF5SupplierSearch(""); setF5SupplierOpen(true); setF5SupplierHi(0); }}
                    onBlur={() => setTimeout(() => setF5SupplierOpen(false), 200)}
                    onKeyDown={(e) => {
                      const filtered = supplierList.filter(s => !f5SupplierSearch || s.AccountName.toLowerCase().includes(f5SupplierSearch.trim().toLowerCase()));
                      if (e.key === "ArrowDown") { e.preventDefault(); setF5SupplierHi(prev => Math.min(prev + 1, Math.max(0, filtered.length - 1))); }
                      if (e.key === "ArrowUp")   { e.preventDefault(); setF5SupplierHi(prev => Math.max(prev - 1, 0)); }
                      if (e.key === "Enter") { e.preventDefault(); if (filtered[f5SupplierHi]) { setF5SupplierId(String(filtered[f5SupplierHi].Id)); setF5SupplierSearch(filtered[f5SupplierHi].AccountName); setF5SupplierOpen(false); } }
                      if (e.key === "Escape") setF5SupplierOpen(false);
                    }}
                  />
                  {f5SupplierOpen && (
                    <div style={{ position: "absolute", top: "100%", left: 0, width: "100%", maxHeight: 200, overflowY: "auto", background: "#fff", border: "1px solid #c5d8f8", borderRadius: 3, zIndex: 9999, boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
                      {supplierList.filter(s => !f5SupplierSearch || s.AccountName.toLowerCase().includes(f5SupplierSearch.trim().toLowerCase())).map((s, idx) => (
                        <div key={s.Id} style={{ padding: "6px 8px", fontSize: 13, cursor: "pointer", background: idx === f5SupplierHi ? "#e8f0fe" : "transparent", color: "#1a2e4a" }}
                          onMouseEnter={() => setF5SupplierHi(idx)}
                          onClick={() => { setF5SupplierId(String(s.Id)); setF5SupplierSearch(s.AccountName); setF5SupplierOpen(false); }}>
                          {s.AccountName}
                        </div>
                      ))}
                      {supplierList.filter(s => !f5SupplierSearch || s.AccountName.toLowerCase().includes(f5SupplierSearch.trim().toLowerCase())).length === 0 && (
                        <div style={{ padding: "6px 8px", fontSize: 13, color: "#94a3b8" }}>No suppliers found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <label style={{ width: "90px" }}>Search No</label>
                <input className="form-ctrl" style={{ width: "140px" }} value={searchNo} onChange={(e) => setSearchNo(e.target.value)} />
                <button className="tbtn tbtn-save" onClick={() => handleF5View({ fromdate: fromDate, todate: toDate, supplierid: f5SupplierId })}>View</button>
                <div style={{ marginLeft: "auto", color: "#16a34a", fontWeight: "bold", fontSize: "20px" }}>Total Amt : {f5TotalAmt}</div>
              </div>
            </div>
            <div className="popup-body" style={{ overflowY: "auto", flex: 1, padding: 0 }}>
              <table className="view-grid" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr><th style={{ width: 32 }} /><th>Purchase No</th><th>Date</th><th>Type</th><th>Supplier</th><th className="right">Net Amount</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {f5MasterList.length === 0 && (
                    <tr><td colSpan={7} className="no-data" style={{ textAlign: "center", padding: 18, color: "#94a3b8" }}>No records found. Enter a search term and press Search.</td></tr>
                  )}
                  {f5MasterList.map((m) => {
                    const isExpanded = f5ExpandedRow === m.Id;
                    const rowDetails = getDetailsForMaster(m.Id);
                    return (
                      <React.Fragment key={m.Id}>
                        <tr className="view-row" style={{ cursor: "pointer", background: isExpanded ? "#deeafb" : undefined }}>
                          <td style={{ textAlign: "center", width: 32, userSelect: "none", fontSize: 12 }} onClick={() => toggleF5Row(m.Id)} title={isExpanded ? "Collapse" : "Expand"}>{isExpanded ? "▼" : "▶"}</td>
                          <td>{m.PurNo}</td>
                          <td>{jsonDate(m.PurchaseDate)}</td>
                          <td><span className={`badge ${m.PurchaseType === "CA" ? "badge-cash" : "badge-credit"}`}>{m.PurchaseType === "CA" ? "Cash" : "Credit"}</span></td>
                          <td>{m.SupName}</td>
                          <td className="right">{fmt2(m.NetAmt)}</td>
                          <td>
                            <button className="tbtn-sm edit" onClick={() => { if (!perm.Edit) { toast("❌ Page Edit Permission Denied !!!.", true); return; } openEditPassword({ type: "EDIT", id: m.Id, pno: m.PurchaseNo }); }}>✏ Edit</button>
                            <button className="tbtn-sm delete" onClick={() => { if (!perm.Delete) { toast("❌ Page Delete Permission Denied !!!.", true); return; } openEditPassword({ type: "DELETE", id: m.Id, updateId: m.UpdateId || "", pno: m.PurchaseNo }); }}>🗑 Del</button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`d_${m.Id}`}>
                            <td colSpan={7} style={{ padding: "6px 24px 10px 42px", background: "#f8fafc", borderBottom: "2px solid #bfdbfe" }}>
                              {rowDetails.length === 0 ? (
                                <span style={{ color: "#94a3b8", fontSize: 12 }}>No product details found.</span>
                              ) : (
                                <table className="view-grid nested-grid" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                  <thead>
                                    <tr style={{ background: "#2d4a9f", color: "#fff" }}>
                                      <th style={{ width: 100 }}>Code</th><th style={{ width: 220 }}>Description</th>
                                      <th className="right" style={{ width: 80 }}>MRP</th><th className="right" style={{ width: 90 }}>Pur. Rate</th>
                                      <th className="right" style={{ width: 70 }}>Qty</th><th className="right" style={{ width: 70 }}>GST(%)</th>
                                      <th className="right" style={{ width: 80 }}>GST Amt</th><th className="right" style={{ width: 70 }}>Disc(%)</th>
                                      <th className="right" style={{ width: 80 }}>Disc Amt</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {rowDetails.map((d, idx) => (
                                      <tr key={`${m.Id}_detail_${idx}`} className="view-row" style={{ background: idx % 2 === 0 ? "#fff" : "#f5f9ff" }}>
                                        <td>{d.ProductCode}</td><td>{d.ProductName}</td>
                                        <td className="right">{fmt2(d.MRP)}</td><td className="right">{fmt2(d.PurchaseRate)}</td>
                                        <td className="right">{fmt2(d.ItemQty)}</td><td className="right">{fmt2(d.TaxPercent)}</td>
                                        <td className="right">{fmt2(d.TaxAmt)}</td><td className="right">{fmt2(d.DiscountPercent)}</td>
                                        <td className="right">{fmt2(d.DiscountAmt)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="popup-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => { setListViewOpen(false); setF5MasterList([]); setF5DetailList([]); setF5SupplierId(""); setFromDate(today()); setToDate(today()); }}>Close (Esc)</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Master Form ── */}
      <div className="pur-master">
        {/* ── Mode radio group (mirrors rdbpurchase / rdbsalespatty / rdbarrival / rdbpatti) ── */}
       <div className="master-row" style={{ marginBottom: 6 }}>
  <label className="radio-label"><input type="radio" checked={purchaseMode === "PURCHASE"} onChange={() => setPurchaseMode("PURCHASE")} /> Purchase</label>
  {pattyFeatureEnabled && (
    <>
      <label className="radio-label"><input type="radio" checked={purchaseMode === "SALESPATTY"} onChange={() => setPurchaseMode("SALESPATTY")} /> Sales Patty</label>
      <label className="radio-label"><input type="radio" checked={purchaseMode === "ARRIVAL"}    onChange={() => setPurchaseMode("ARRIVAL")} /> Arrival</label>
      <label className="radio-label"><input type="radio" checked={purchaseMode === "PATTY"}      onChange={() => setPurchaseMode("PATTY")} /> Patty Bill</label>
    </>
  )}
  <span style={{ marginLeft: 12, fontWeight: 700, color: "#1f2937" }}>{modeLabels.title}</span>
</div>

        {/* ── Arrival-only fields (Days / Dispatched Date — matches the screenshot) ── */}
        {purchaseMode === "ARRIVAL" && (
          <div className="master-row">
            <div className="field-group"><label>Days</label>
              <input className="form-ctrl right" value={arrivalDays}
                onChange={(e) => setArrivalDays(parseInt(e.target.value, 10) || 0)} />
            </div>
            <div className="field-group"><label>Dispatched Date</label>
              <input type="date" className="form-ctrl" value={dispatchedDate}
                onChange={(e) => setDispatchedDate(e.target.value)} />
            </div>
          </div>
        )}

        {/* ── Patty-only fields (Vehicle No / Person / Patty Date — mirrors txtvehicleno / txtperson / dtppattidate) ── */}
        {pattyMode && (
          <div className="master-row">
            <div className="field-group"><label>Vehicle No</label>
              <input className="form-ctrl" value={pattyVehicleNo} onChange={(e) => setPattyVehicleNo(e.target.value)} />
            </div>
            <div className="field-group"><label>Person</label>
              <input className="form-ctrl" value={pattyPerson} onChange={(e) => setPattyPerson(e.target.value)} />
            </div>
            <div className="field-group"><label>Patty Date</label>
              <input type="date" className="form-ctrl" value={pattyDate} onChange={(e) => setPattyDate(e.target.value)} />
            </div>
          </div>
        )}

        <div className="master-row">
          <div className="field-group"><label>{modeLabels.no}</label><input className="form-ctrl disabled" value={purchaseNo} readOnly /></div>
          <div className="field-group"><label>{modeLabels.date} <span className="req">*</span></label><input ref={purchaseDateRef} type="date" className="form-ctrl" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} onKeyDown={(e) => { if(e.key === "Enter") { e.preventDefault(); nextFocusForm("dtppurchasedate"); } }} /></div>
          <div className="field-group"><label>Due Date</label><input ref={dueDateRef} type="date" className="form-ctrl" value={dueDate} onChange={(e) => setDueDate(e.target.value)} onKeyDown={(e) => { if(e.key === "Enter") { e.preventDefault(); nextFocusForm("dtpduedate"); } }} /></div>
          <div className="field-group"><label>{modeLabels.type}</label><select ref={purchaseTypeRef} className="form-ctrl" value={purchaseType} onChange={(e) => setPurchaseType(e.target.value)} onKeyDown={(e) => { if(e.key === "Enter") { e.preventDefault(); nextFocusForm("cmbpurchaseType"); } }}><option value="CREDIT">CREDIT</option><option value="CASH">CASH</option></select></div>

          {/* Supplier autocomplete */}
          <div className="field-group wide" ref={supplierContainerRef} style={{ position: "relative" }}>
            <label>Supplier <span className="req">*</span></label>
            <input ref={supplierRef} className="form-ctrl" value={supplierQuery}
              onChange={(e) => handleSupplierInputChange(e.target.value)}
              onFocus={() => { openSupplierDropdown(); }}
              onClick={() => { if (!supplierDDOpen) openSupplierDropdown(); }}
              onKeyDown={supplierInputKeyDown}
              onBlur={() => setTimeout(() => {
                setSupplierDDOpen(false);
                if (!supplierId && supplierQuery.trim()) {
                  const exact = supplierList.find((s) => (s.AccountName || "").toLowerCase() === supplierQuery.toLowerCase());
                  if (exact) confirmSupplierSelection(exact);
                }
              }, 180)}
              placeholder="Type or click to browse suppliers…" autoComplete="off" />
            {supplierDDOpen && (
              <div style={{ position: "absolute", zIndex: 9000, top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #cbd5e1", borderRadius: "0 0 6px 6px", boxShadow: "0 4px 16px rgba(0,0,0,0.13)", maxHeight: 220, overflowY: "auto" }}>
                {supplierDropdown.map((s, i) => (
                  <div key={s.Id} onMouseDown={() => confirmSupplierSelection(s)}
                    style={{ padding: "6px 10px", cursor: "pointer", fontSize: 13, background: i === supplierSelIdx ? "#deeafb" : "#fff", borderBottom: "1px solid #f1f5f9", fontWeight: i === supplierSelIdx ? 600 : 400 }}>
                    {s.AccountName}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="field-group"><label>Invoice No <span className="req">*</span></label>
            <input ref={invoiceNoRef} className="form-ctrl" value={invoiceNo || ""}
              onChange={(e) => setInvoiceNo(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); nextFocusForm("txtinvoiceno"); } }} />
          </div>
          <div className="field-group"><label>Invoice Date</label><input ref={invoiceDateRef} type="date" className="form-ctrl" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); nextFocusForm("dtpinvoicedate"); } }} /></div>
          <div className="field-group">
            <label>Invoice Amount <span className="req">*</span></label>
            <input ref={invoiceAmtRef} className="form-ctrl right" value={invoiceAmt}
              onChange={(e) => setInvoiceAmt(e.target.value)} onFocus={(e) => e.target.select()}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); nextFocusForm("txtinvoiceamt"); } }} />
          </div>
          <div className="field-group">
            <label>Bill Amount</label>
            <div className={"bill-amt-display" + (valNum(finalNetAmt) > 0 && valNum(invoiceAmt) === valNum(finalNetAmt) ? " bill-amt-match" : valNum(finalNetAmt) > 0 ? " bill-amt-mismatch" : "")}>
              ₹ {finalNetAmt}
            </div>
          </div>
        </div>

        {/* Supplier info strip */}
        <div className="supplier-strip">
          <span className="supplier-badge addr">{supplierInfo.address}</span>
          <span className="supplier-badge city">{supplierInfo.city}</span>
          <span className="supplier-badge phone">📞 {supplierInfo.phone}</span>
          <span className="supplier-badge bal">Balance: ₹{supplierInfo.balance}</span>
          <div className="tax-mode-group">
            <label className="radio-label"><input type="radio" name="taxmode" value="exclusive" checked={taxMode === "exclusive"} onChange={() => setTaxMode("exclusive")} /> Exclusive</label>
            <label className="radio-label"><input type="radio" name="taxmode" value="inclusive" checked={taxMode === "inclusive"} onChange={() => setTaxMode("inclusive")} /> Inclusive</label>
          </div>
          <label className="igst-label">
            <input type="checkbox" checked={igstChecked} onChange={(e) => { setIgstChecked(e.target.checked); setIgstStatus(e.target.checked ? "IGST" : "GST"); }} /> IGST
          </label>
          <label className="igst-label" style={{ marginLeft: 15 }}>
            <input type="checkbox" checked={purRateInclusive} onChange={(e) => setPurRateInclusive(e.target.checked)} /> Inclusive Pur. Rate
          </label>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="grid-wrap" ref={gridRef}>
        <div className="grid-scroll">
          <table className="pur-grid">
            <thead>
              <tr>
                <th className="sno-col">S.No</th>
                {orderedGridColumns.filter(isColVisible).map((c) => {
                  const cfg = colConfig.find((x) => x.key === c.key);
                  return <th key={c.key} style={{ minWidth: cfg ? cfg.width : c.defaultWidth }} className={c.align === "right" ? "right" : ""}>{c.label}</th>;
                })}
                <th className="del-col">Del</th>
              </tr>
            </thead>
            <tbody>
              {gridRows.map((row, idx) => {
                // FIX 8: highlight free-product rows in green, mirroring purchase.js's
                // legacy "editedRow" cellclass that fires when FreeQtyStatus == 1.
                const isFreeRow = valNum(row.FreeQtyStatus) === 1;
                return (
                  <tr key={row._key}
                    className={`grid-row ${selectedCell.rowKey === row._key ? "row-active" : ""} ${isFreeRow ? "free-product-row" : ""}`}
                    style={isFreeRow ? { background: "#e6f9ec" } : undefined}
                    title={isFreeRow ? "Free Product Row (F2)" : undefined}>
                    <td className="sno-col center" style={isFreeRow ? { background: "#e6f9ec" } : undefined}>{idx + 1}</td>
                    {orderedGridColumns.filter(isColVisible).map((c) => {
                      const cfg = colConfig.find((x) => x.key === c.key);
                      return renderCell(row, { ...c, width: cfg ? cfg.width : c.defaultWidth });
                    })}
                    <td className="del-col center" style={isFreeRow ? { background: "#e6f9ec" } : undefined}>
                      {row.ProductCode && <button className="del-row-btn" onClick={() => deleteGridRow(row._key)} title="Delete Row (Shift+Del)">✕</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Bottom Panel ── */}
      <div className="pur-bottom">
        <div className="bottom-left">
          <div className="gst-split-panel">
            <table className="gst-table">
              <thead><tr><th>GST%</th><th>GST Amt</th><th>CGST</th><th>SGST</th></tr></thead>
              <tbody>
                {gstSplit.length === 0
                  ? <tr><td colSpan={4} className="no-data">No GST data</td></tr>
                  : gstSplit.map((g, i) => (
                    <tr key={g.TaxPercent ?? i}>
                      <td className="right">{g.TaxPercent}</td><td className="right">{fmt2(g.TaxAmt)}</td>
                      <td className="right">{fmt2(g.CTAmount)}</td><td className="right">{fmt2(g.STAmount)}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>

          {/* ── Patty Panel (visible only in PATTY / SALESPATTY mode) ─────────────────
              Mirrors grdPatty: PattyName / Com% / BagRate / Amount(ComAmt), with a
              running total (txtpattytotamt) that gets deducted from the Net Amount.
              Amount uses computePattyRowAmt(), which follows the exact %-then-BagRate
              branch order from frmpurchase.cs (Lorry Freight × TotKgs, Cooly × TotBags). */}
        {pattyMode && (
  <div className="gst-split-panel" style={{ marginTop: 10 }}>
    <div style={{ maxHeight: 150, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 4 }}>
      <table className="gst-table" style={{ width: "100%" }}>
        <thead style={{ position: "sticky", top: 0, background: "#f8fafc", zIndex: 1 }}>
          <tr><th style={{ textAlign: "left" }}>Patty</th><th>%</th><th>Bag Rate</th><th>Amount</th></tr>
        </thead>
        <tbody>
          {pattyRows.length === 0 ? (
            <tr><td colSpan={4} className="no-data">Loading patty list…</td></tr>
          ) : pattyRows.map((r) => (
            <tr key={r._key}>
              <td style={{ textAlign: "left" }}>{r.PattyName}</td>
              <td className="right">
                <input
                  className="form-ctrl right sm"
                  style={{ width: 55 }}
                  value={r.Percentage}
                  onChange={(e) => updatePattyPercentage(r._key, e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
              </td>
              <td className="right">
                <input
                  className="form-ctrl right sm"
                  style={{ width: 60 }}
                  value={r.BagRate}
                  onChange={(e) => updatePattyBagRate(r._key, e.target.value)}
                  onFocus={(e) => e.target.select()}
                  title={r.PattyName === "LORRY FREIGHT" ? "₹ per Kg" : r.PattyName === "COOLY" ? "₹ per Bag" : ""}
                />
              </td>
              <td className="right">{fmt2(computePattyRowAmt(r))}</td>
            </tr>
          ))}
          {pattyRows.length > 0 && (
            <tr>
              <td style={{ textAlign: "left", fontWeight: 700 }}>Total</td>
              <td /><td />
              <td className="right" style={{ fontWeight: 700 }}>{pattyTotal}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    <div style={{ fontSize: 11, color: "#64748b", padding: "4px 2px" }}>
      Total Kgs: {fmt2(totKgs)} &nbsp;|&nbsp; Total Bags: {fmt2(totBags)}
    </div>
  </div>
)}
          <div className="charges-qty-row">
            <div className="other-fields-panel">
              <div className="panel-title">Additional Charges</div>
              <div className="other-row"><label>Others (+)</label><input ref={otherPlusRef} className="form-ctrl right sm" value={otherPlus} onChange={(e) => setOtherPlus(e.target.value)} onFocus={(e) => e.target.select()} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); nextFocusForm("txtotherplus"); } }} /></div>
              <div className="other-row"><label>Others (-)</label><input ref={otherSubRef} className="form-ctrl right sm" value={otherSub} onChange={(e) => setOtherSub(e.target.value)} onFocus={(e) => e.target.select()} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); nextFocusForm("txtothersub"); } }} /></div>
            </div>
            <div className="qty-remarks-panel">
              <div className="panel-title">Qty &amp; Remarks</div>
              <div className="other-row"><label>Total Item Qty</label><span className="qty-display">{totals.totalQty ?? "0.00"}</span></div>
              <div className="other-row remarks-row">
                <label>Remarks</label>
                <input ref={remarksRef} className="form-ctrl sm" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Enter remarks…" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); nextFocusForm("txtremarks"); } }} />
              </div>
            </div>
          </div>
        </div>
        <div className="totals-panel">
          <div className="panel-title">Bill Summary</div>
          <table className="bill-summary-table">
            <tbody>
              <tr>
                <td className="bs-label">Product Total</td><td className="bs-value">{totals.productTotal}</td>
                <td className="bs-label">C.D Amount</td><td className="bs-value">{totals.cdAmt}</td>
                <td className="bs-label">GST Amount</td><td className="bs-value">{totals.gstAmt}</td>
                <td className="bs-label">CGST Amount</td><td className="bs-value">{totals.cgstAmt}</td>
              </tr>
              <tr>
                <td className="bs-label">Transport Amt</td><td className="bs-value">{totals.transAmt}</td>
                <td className="bs-label">Discount Amt</td><td className="bs-value">{totals.discAmt}</td>
                <td className="bs-label">CESS Amount</td><td className="bs-value">{totals.cessAmt}</td>
                <td className="bs-label">SGST Amount</td><td className="bs-value">{totals.sgstAmt}</td>
              </tr>
              {pattyMode && (
                <tr>
                  <td className="bs-label">Patty Amount</td><td className="bs-value">{pattyTotal}</td>
                  <td className="bs-label">Net Amount</td><td className="bs-value" style={{ fontWeight: 700 }}>{finalNetAmt}</td>
                  <td className="bs-label" />
                  <td className="bs-value" />
                  <td className="bs-label" />
                  <td className="bs-value" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Ctrl+G Grid Focus Columns Modal ── */}
      {focusColOpen && (
        <div className="popup-overlay">
          <div className="popup-window f12-popup" style={{ width: 520, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <div className="popup-header">
              <span>Columns Reorder &amp; Focus Enabled (Ctrl+G)</span>
              <button className="popup-close" onClick={() => setFocusColOpen(false)}>✕</button>
            </div>
            <div className="popup-body" style={{ overflowY: "auto", flex: 1 }}>
              <table className="popup-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={{ width: 80, textAlign: "center" }}>Position</th><th style={{ textAlign: "left" }}>Column Name</th><th style={{ width: 90, textAlign: "center" }}>Focus</th></tr></thead>
                <tbody>
                  {focusColDraft.map((d, idx) => {
                    const base = BASE_COLUMNS.find((c) => c.key === d.column);
                    return (
                      <tr key={d.column} draggable
                        onDragStart={() => handleFocusDragStart(idx)}
                        onDragOver={(e) => handleFocusDragOver(e, idx)}
                        onDragEnd={handleFocusDragEnd}
                        style={{ background: focusColDragIdx === idx ? "#e0f2fe" : "transparent", cursor: "grab" }}>
                        <td style={{ textAlign: "center", userSelect: "none", fontWeight: 600 }}>{idx + 1}</td>
                        <td>{base?.label || d.column}</td>
                        <td style={{ textAlign: "center" }}>
                          <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, cursor: "pointer" }}>
                            <input type="checkbox" checked={!!d.Focus} onChange={() => handleFocusToggle(idx, "Focus", !d.Focus)} style={{ width: 14, height: 14, accentColor: "#1f65de" }} />
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="popup-footer">
              <button className="btn btn-primary btn-sm" onClick={handleFocusColSave} disabled={loading}>💾 Save</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setFocusColOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Keyboard hint bar ── */}
      <div className="mp-hint">
        <kbd>F1</kbd> Save &nbsp;|&nbsp;
        <kbd>F2</kbd> Free Product &nbsp;|&nbsp;
        <kbd>F3</kbd> {modeLabels.no} Search &nbsp;|&nbsp;
        <kbd>F4</kbd> Delete &nbsp;|&nbsp;
        <kbd>F5</kbd> List View &nbsp;|&nbsp;
        <kbd>F9</kbd> Delete (pwd) &nbsp;|&nbsp;
        <kbd>F10</kbd> Clear &nbsp;|&nbsp;
        <kbd>F12</kbd> Columns &nbsp;|&nbsp;
        <kbd>Ctrl+G</kbd> Grid Focus &nbsp;|&nbsp;
        <kbd>Ctrl+F</kbd> Form Focus &nbsp;|&nbsp;
        <kbd>Enter / Tab</kbd> Next Cell &nbsp;|&nbsp;
        <kbd>↑↓</kbd> Navigate Rows &nbsp;|&nbsp;
        <kbd>Shift+Del</kbd> Delete Row
      </div>

      {/* ── Loading overlay ── */}
      {loading && (
        <div className="mp-loader-ov">
          <div className="mp-ldr-box"><div className="mp-spin" /><div className="mp-ldr-msg">Processing…</div></div>
        </div>
      )}

      <MSG.ToastList toasts={toasts} />

      {/* ── Edit Password Modal ── */}
      {editPwdOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,20,40,0.45)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: "22px 28px 18px", minWidth: 240, maxWidth: 300, boxShadow: "0 8px 32px rgba(0,0,0,0.22)", border: "1px solid #c5d8f8", textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: "#1e293b" }}>🔒 Edit Password</div>
            <input type="password" autoFocus
              style={{ width: "100%", padding: "7px 10px", border: "1px solid #c5d8f8", borderRadius: 6, fontSize: 14, outline: "none", boxSizing: "border-box" }}
              value={editPwdValue}
              onChange={(e) => { setEditPwdValue(e.target.value); setEditPwdError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleEditPasswordSubmit(); if (e.key === "Escape") { setEditPwdOpen(false); setPendingEditAction(null); } }}
              placeholder="Enter password…" disabled={editPwdLoading} />
            {editPwdError && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 6 }}>{editPwdError}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "center" }}>
              <button style={{ padding: "7px 22px", borderRadius: 6, border: "none", background: "linear-gradient(135deg,#3b82f6,#1d4ed8)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                onClick={handleEditPasswordSubmit} disabled={editPwdLoading || !editPwdValue.trim()}>
                {editPwdLoading ? "…" : "✔ OK"}
              </button>
              <button style={{ padding: "7px 22px", borderRadius: 6, border: "1px solid #c5d8f8", background: "#f5f9ff", color: "#6b7a99", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                onClick={() => { setEditPwdOpen(false); setPendingEditAction(null); }} disabled={editPwdLoading}>
                ✘ Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ProductPopup ─────────────────────────────────────────────────────────────
function ProductPopup({ productPopup, setProductPopup, applyProductToRow, sess, setLoading }) {
  const [localQuery, setLocalQuery] = useState(productPopup.query || "");
  const [localList,  setLocalList ] = useState(productPopup.list  || []);
  const [selIdx,     setSelIdx    ] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (productPopup.autoLoad) doSearch("");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doSearch = useCallback(async (q) => {
    setLoading(true);
    try {
      const res = await CC.api(CC.GetProductListV7, null, {}, { Comid: sess.MComid });
      const allProducts = res?.Data1 || res?.data?.Data1 || res?.data || [];
      if (!q?.trim()) { setLocalList(allProducts); return; }
      const search = q.toLowerCase();
      const filtered = allProducts.filter((p) =>
        (p.Prod_Code || p.PCode || "").toLowerCase().includes(search) ||
        (p.PName || "").toLowerCase().includes(search)
      );
      setLocalList(filtered); setSelIdx(0);
    } finally { setLoading(false); }
  }, [sess, setLoading]);

  const handleKey = (e) => {
    if (e.key === "ArrowDown")  { e.preventDefault(); setSelIdx((i) => Math.min(i + 1, localList.length - 1)); }
    else if (e.key === "ArrowUp")  { e.preventDefault(); setSelIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter")    { if (localList[selIdx]) applyProductToRow(productPopup.rowKey, localList[selIdx]); }
    else if (e.key === "Escape")   { setProductPopup({ open: false, rowKey: null, list: [], query: "" }); }
  };

  return (
    <div className="popup-overlay">
      <div className="popup-window product-popup">
        <div className="popup-header">
          <span>Product Lookup</span>
          <button className="popup-close" onClick={() => setProductPopup({ open: false, rowKey: null, list: [], query: "" })}>✕</button>
        </div>
        <div className="popup-body">
          <input ref={inputRef} className="popup-search-input" placeholder="Search by code or name…"
            value={localQuery} onChange={(e) => { setLocalQuery(e.target.value); doSearch(e.target.value); }} onKeyDown={handleKey} />
          <div className="popup-list-wrap">
            <table className="popup-table">
              <thead><tr><th>Code</th><th>Description</th><th>UOM</th><th>Pur.Rate</th><th>MRP</th><th>GST</th><th>LandingCost</th><th>SaleRate</th></tr></thead>
              <tbody>
                {localList.map((p, i) => (
                  <tr key={p.Id} className={i === selIdx ? "popup-row selected" : "popup-row"} onClick={() => applyProductToRow(productPopup.rowKey, p)}>
                    <td>{p.Prod_Code}</td><td>{p.PName}</td><td>{p.UOM}</td>
                    <td className="right">{valNum(p.PurRate).toFixed(2)}</td>
                    <td className="right">{valNum(p.MRP).toFixed(2)}</td>
                    <td className="right">{valNum(p.GST).toFixed(2)}</td>
                    <td className="right">{valNum(p.LandingCost).toFixed(2)}</td>
                    <td className="right">{valNum(p.SaleRate).toFixed(2)}</td>
                  </tr>
                ))}
                {localList.length === 0 && <tr><td colSpan={6} className="no-data">No records found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MRPSelectionPopup ────────────────────────────────────────────────────────
function MRPSelectionPopup({ mrpPopup, setMrpPopup, applyProductToRow }) {
  const [selIdx, setSelIdx] = React.useState(0);
  const tbodyRef = React.useRef(null);
  React.useEffect(() => {
    const row = tbodyRef.current?.querySelectorAll("tr")[selIdx];
    row?.scrollIntoView({ block: "nearest" });
  }, [selIdx]);
  const close = () => setMrpPopup({ open: false, rowKey: null, list: [] });
  const confirmSelection = (item) => { applyProductToRow(mrpPopup.rowKey, item); close(); };
  const handleKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelIdx((i) => Math.min(i + 1, mrpPopup.list.length - 1)); }
    else if (e.key === "ArrowUp")  { e.preventDefault(); setSelIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter")    { e.preventDefault(); const item = mrpPopup.list[selIdx]; if (item) confirmSelection(item); }
    else if (e.key === "Escape")   { close(); }
  };
  return (
    <div className="popup-overlay" onKeyDown={handleKey} tabIndex={-1} style={{ outline: "none" }} ref={(el) => el?.focus()}>
      <div className="popup-window product-popup" style={{ maxWidth: 620 }}>
        <div className="popup-header"><span>Select MRP / Batch Variant</span><button className="popup-close" onClick={close}>✕</button></div>
        <div className="popup-body">
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "#64748b" }}>Multiple variants found. Select one to add to the grid.</p>
          <div className="popup-list-wrap">
            <table className="popup-table">
              <thead><tr><th>Code</th><th>Description</th><th>MRP</th><th>Pur.Rate</th><th>UOM</th><th>Stock</th><th>Batch No</th></tr></thead>
              <tbody ref={tbodyRef}>
                {mrpPopup.list.map((p, i) => (
                  <tr key={p.Id ?? i} className={i === selIdx ? "popup-row selected" : "popup-row"} onClick={() => confirmSelection(p)} style={{ cursor: "pointer" }}>
                    <td>{p.ProductCode || p.Prod_Code || p.PCode || ""}</td>
                    <td>{p.ProductName || p.PName || ""}</td>
                    <td className="right">{valNum(p.MRP).toFixed(2)}</td>
                    <td className="right">{valNum(p.PurchaseRate ?? p.PurRate).toFixed(2)}</td>
                    <td>{p.UOM || ""}</td>
                    <td className="right">{valNum(p.Stock).toFixed(2)}</td>
                    <td>{p.Bat_No || p.BatchNo || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8" }}>↑↓ to navigate · Enter to select · Esc to cancel</div>
        </div>
      </div>
    </div>
  );
}

// ─── ItemCreatePopup ──────────────────────────────────────────────────────────
function ItemCreatePopup({ itemCreatePopup, setItemCreatePopup, applyProductToRow, sess, setLoading }) {
  const { open, rowKey, code } = itemCreatePopup;
  React.useEffect(() => {
    if (open) { sessionStorage.setItem("POPValue", (code || "").toUpperCase()); sessionStorage.setItem("POPStatus", "ON"); }
  }, [open, code]);
  const handleClose = async () => {
    const savedCode = sessionStorage.getItem("POPValue") || code || "";
    sessionStorage.setItem("POPValue", ""); sessionStorage.setItem("POPStatus", "OFF");
    setItemCreatePopup({ open: false, rowKey: null, code: "" });
    if (!savedCode.trim()) return;
    try {
      setLoading(true);
      const res = await CC.api(CC.ItemByCode, null, {}, { code: savedCode.trim(), Comid: sess.MComid, CComid: sess.Comid, Id: 0, Batchwise: 0 });
      const objlist = Array.isArray(res) ? res : Array.isArray(res?.Data1) ? res.Data1 : Array.isArray(res?.data) ? res.data : [];
      if (objlist.length === 0) { alert("Invalid Product Code !!!."); return; }
      applyProductToRow(rowKey, objlist[0]);
    } catch (err) { console.error("ItemCreatePopup close error:", err); }
    finally { setLoading(false); }
  };
  if (!open) return null;
  return (
    <div className="popup-overlay" style={{ zIndex: 1100 }}>
      <div className="popup-window" style={{ width: "calc(100vw - 60px)", height: "calc(100vh - 80px)", maxWidth: "none", display: "flex", flexDirection: "column", padding: 0 }}>
        <div className="popup-header" style={{ flexShrink: 0 }}>
          <span>ItemMaster — Create New Item (Code: {code})</span>
          <button className="popup-close" onClick={handleClose}>✕</button>
        </div>
        <iframe src="/Itemmaster" title="ItemMaster" style={{ flex: 1, border: "none", width: "100%" }} />
        <div style={{ padding: "8px 16px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", fontSize: 12, color: "#64748b", flexShrink: 0 }}>
          Create the new item above, then close this window to auto-load it into the grid.
          <button style={{ marginLeft: 16, padding: "4px 16px", borderRadius: 5, border: "none", background: "#3b82f6", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 12 }} onClick={handleClose}>
            ✔ Done — Close &amp; Load Item
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SerialNoPopup ────────────────────────────────────────────────────────────
function SerialNoPopup({ serialNoPopup, setSerialNoPopup, serialNoList, setSerialNoList, setGridRows, calcRow }) {
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const { rowKey, textRefId, returnColKey } = serialNoPopup;
  const [rows,  setRows ] = useState(() => serialNoPopup.list.length > 0 ? serialNoPopup.list.map((s) => ({ id: uid(), value: s.BatchNo })) : [{ id: uid(), value: "" }]);
  const [error, setError] = useState("");
  const inputRefs = useRef({});

  useEffect(() => {
    const firstId = rows[0]?.id;
    if (firstId) setTimeout(() => inputRefs.current[firstId]?.focus(), 80);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const restoreFocusToGrid = useCallback(() => {
    const col = returnColKey || "ItemQty";
    setTimeout(() => { const el = document.getElementById(`cell_${rowKey}_${col}`); if (el) { el.focus(); el.select?.(); } }, 60);
  }, [rowKey, returnColKey]);

  const close = useCallback(() => {
    setGridRows((prev) => {
      const idx = prev.findIndex((r) => r._key === rowKey);
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = calcRow(updated[idx]);
      return updated;
    });
    setSerialNoPopup({ open: false, rowKey: null, textRefId: "", list: [], returnColKey: "ItemQty" });
    restoreFocusToGrid();
  }, [setSerialNoPopup, restoreFocusToGrid, setGridRows, rowKey, calcRow]);

  const handleDone = useCallback(() => {
    const cleaned = rows.filter((r, i) => r.value.trim() !== "" || (i === 0 && rows.length === 1));
    if (cleaned.length === 0 || (cleaned.length === 1 && cleaned[0].value.trim() === "")) { setError("Enter at least one Serial No !!!."); return; }
    const values = cleaned.map((r) => r.value.trim()).filter(Boolean);
    if (new Set(values).size !== values.length) { setError("Duplicate Serial No found !!!."); return; }
    const filtered = serialNoList.filter((s) => s.IndexRefId !== textRefId);
    setSerialNoList([...filtered, ...values.map((val) => ({ BatchNo: val, IndexRefId: textRefId, RItemQty: 0, ItemQty: 1, Batchid: 0, ProductRefid: 0, MRP: 0, PurchaseRate: 0, LandingCost: 0, VAT: 0, SalesRate: 0 }))]);
    setGridRows((prev) => {
      const idx = prev.findIndex((r) => r._key === rowKey);
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = calcRow({ ...updated[idx], ItemQty: String(values.length) });
      return updated;
    });
    setSerialNoPopup({ open: false, rowKey: null, textRefId: "", list: [], returnColKey: "ItemQty" });
    restoreFocusToGrid();
  }, [rows, serialNoList, textRefId, rowKey, setSerialNoList, setGridRows, setSerialNoPopup, restoreFocusToGrid, calcRow]);

  const handleKeyDown = useCallback((e, idx) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = rows[idx].value.trim();
      if (!val) { setError("Enter the SerialNo !!!."); return; }
      if (rows.some((r, i) => i !== idx && r.value.trim() === val)) { setError(`Duplicate SerialNo: ${val}`); return; }
      setError("");
      setRows((prev) => { const next = [...prev]; if (idx === prev.length - 1) next.push({ id: uid(), value: "" }); return next; });
      setTimeout(() => {
        const nextId = rows[idx + 1]?.id;
        if (nextId) inputRefs.current[nextId]?.focus();
        else setRows((prev) => { const lastId = prev[prev.length - 1]?.id; if (lastId) setTimeout(() => inputRefs.current[lastId]?.focus(), 30); return prev; });
      }, 20);
    } else if (e.key === "Delete" && e.shiftKey) {
      e.preventDefault();
      setRows((prev) => { const next = prev.filter((_, i) => i !== idx); return next.length === 0 ? [{ id: uid(), value: "" }] : next; });
    } else if (e.key === "F1") { e.preventDefault(); handleDone(); }
    else if (e.key === "Escape") { close(); }
  }, [rows, handleDone, close]);

  const handleChange = (id, value) => {
    setError("");
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, value } : r));
  };

  return (
    <div className="popup-overlay" style={{ zIndex: 1200 }}>
      <div className="popup-window" style={{ width: 300, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        <div className="popup-header"><span>Serial Numbers</span><button className="popup-close" onClick={close}>✕</button></div>
        <div className="popup-body" style={{ overflowY: "auto", flex: 1 }}>
          <table className="popup-table" style={{ width: "100%" }}>
            <thead><tr><th style={{ width: 40 }}>S.No</th><th>Serial No</th><th style={{ width: 30 }} /></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td style={{ textAlign: "center", color: "#64748b" }}>{i + 1}</td>
                  <td>
                    <input ref={(el) => { inputRefs.current[r.id] = el; }} className="cell-input" style={{ width: "100%" }}
                      value={r.value} onChange={(e) => handleChange(r.id, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, i)} autoComplete="off" />
                  </td>
                  <td>
                    <button style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13 }}
                      onClick={() => setRows((prev) => { const next = prev.filter((_, j) => j !== i); return next.length === 0 ? [{ id: uid(), value: "" }] : next; })}
                      title="Remove row (Shift+Del)">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {error && <div style={{ color: "#dc2626", fontSize: 12, padding: "4px 8px" }}>{error}</div>}
          <div style={{ fontSize: 11, color: "#94a3b8", padding: "4px 8px" }}>Enter → next row &nbsp;|&nbsp; F1 → Done &nbsp;|&nbsp; Shift+Del → remove row</div>
        </div>
        <div className="popup-footer">
          <button className="btn btn-primary btn-sm" onClick={handleDone}>✔ F1 Done ({rows.filter(r => r.value.trim()).length} serials)</button>
          <button className="btn btn-secondary btn-sm" onClick={close}>Cancel</button>
        </div>
      </div>
    </div>
  );
}