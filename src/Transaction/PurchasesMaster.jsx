// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  PurchasesMaster.jsx  â€”  Full rewrite with all bugs fixed
//
//  Fixes applied:
//  1. FORM_COLUMNS moved to module level (was inside component â€” recreated every render)
//  2. handleFocusFormColOpen â€” fixed useCallback deps (was copy-pasted from useEffect)
//  3. Global keyboard useEffect â€” added handleFocusFormColOpen + focusFormColOpen to deps/guard
//  4. Mount useEffect â€” merged two duplicate effects into one (loadMaxPurchaseNo/loadSuppliers were called twice)
//  5. Column config useEffect â€” added loadFocusFormColumns
//  6. applyBillDiscount â€” fixed setRowsâ†’setGridRows, calcSaleRowâ†’calcRow, CC.vnâ†’valNum (was referencing non-existent fns)
//  7. Inclusive Purchase Rate â€” fixed infinite-reduction bug: PurchaseRate cell now only
//     re-derives IncPurRate when the user actually edits it; otherwise the exclusive rate
//     is always recomputed from the stored IncPurRate (never from the already-converted value).
//  8. F2 Free Product â€” the row now turns green (like the legacy jQuery "editedRow" cellclass)
//     whenever FreeQtyStatus === 1, so it's visually obvious which rows are free-product rows.
//  9. PURCHASE MODE (Purchase / Sales Patty / Arrival / Patty Bill) â€” ported from
//     frmpurchase.cs rdbpurchase/rdbpatti/rdbsalespatty/rdbarrival + clsfunction.CMBTPatty.
//     A 4-way radio group drives dynamic labels (Purchase Noâ†’Arrival No, etc.), extra
//     Arrival fields (Days / Dispatched Date), a Patty side-panel (Commission % or
//     Lorry-Freight/Cooly Bag-Rate Ã— Kgs/Bags â€” mirrors grdPatty math exactly), and the
//     deduction of the Patty total from the Net Amount. Default mode is PURCHASE, so every
//     existing calculation/validation/save path behaves exactly as before unless the user
//     explicitly switches mode.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../Master/MasterPage.css";
import "../TransactionStyle/PurchasesMaster.css";
import Topbar from "../components/Topbar";
import * as CC  from "../components/Common";
import * as CC1 from "../components/Common";
import * as MSG from "../components/Messages";
import   DateFieldDDMMYYYY from "../Commondatetime";
import { Save, Printer, Monitor, X, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";


// â”€â”€ Grid Combo Popup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
          <span>Select {state.title}</span>
          <button onClick={onClose}>X</button>
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
          style={{ margin: "7px 8px", width: "calc(100% - 16px)", padding: "5px 8px", border: "1px solid var(--clr-border-default)", borderRadius: 4, fontSize: 12, outline: "none", boxSizing: "border-box" }}
        />
        <div ref={listRef} style={{ flex: 1, overflowY: "auto", minHeight: 150 }}>
          {localLoading ? (
            <div style={{ padding: "10px", textAlign: "center", color: "var(--clr-text-mid)" }}>Saving...</div>
          ) : filt.length === 0 ? (
            <div className="mp-dd-empty" style={{ padding: "10px", color: "var(--clr-text-faint)" }}>No results for "{q}"</div>
          ) : (
            filt.map((item, idx) => (
              <div key={item[state.valueProp]} data-idx={idx}
                style={{ padding: "6px 12px", cursor: "pointer", background: idx === hilite ? "var(--clr-primary)" : "var(--clr-bg-white)", color: idx === hilite ? "var(--clr-text-white)" : "var(--clr-text-primary)" }}
                onClick={() => onSelect(item)}
                onMouseEnter={() => setHilite(idx)}>
                {item[state.labelProp]}
              </div>
            ))
          )}
        </div>
        {isNew && !localLoading && (
          <div style={{ padding: "8px", background: "var(--clr-success-bg)", color: "var(--clr-success-text)", borderTop: "1px solid var(--clr-success-border)", cursor: "pointer", fontWeight: 600, fontSize: 13 }}
            onClick={onCreate}>
            + Create new {state.title}: <strong>"{q.trim()}"</strong>
          </div>
        )}
      </div>
    </div>
  );
}

// â”€â”€â”€ Pure helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const valNum   = (v)  => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const nullStr  = (v)  => (v == null || v === undefined ? "" : String(v));
const roundOff = (v)  => Math.round(valNum(v) * 100) / 100;
const fmt2     = (v)  => valNum(v).toFixed(2);
const fmt0     = (v)  => valNum(v).toFixed(0);
const today    = ()   => new Date().toISOString().split("T")[0];
const dateOnly = (s) => {
  if (!s) return "";
  if (s instanceof Date && !isNaN(s)) return s.toISOString().split("T")[0];
  const raw = String(s).trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const m = /\/Date\((\d+)\)\//.exec(s);
  if (m) return new Date(+m[1]).toISOString().split("T")[0];
  const dm = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(raw);
  if (dm) {
    const a = dm[1].padStart(2, "0");
    const b = dm[2].padStart(2, "0");
    const y = dm[3];
    return Number(dm[1]) > 12 ? `${y}-${b}-${a}` : `${y}-${a}-${b}`;
  }
  const dt = new Date(raw);
  return isNaN(dt) ? raw.split("T")[0] : dt.toISOString().split("T")[0];
};
const jsonDate = (s) => dateOnly(s) || today();
const purchaseListDate = (row) => dateOnly(
  row?.PurchaseDate
  ?? row?.purchaseDate
  ?? row?.purchasedate
  ?? row?.Purchase_Date
  ?? row?.PurDate
  ?? row?.purDate
  ?? row?.PDate
  ?? row?.pDate
  ?? row?.BillDate
  ?? row?.billDate
  ?? row?.Date
  ?? row?.date
);

// â”€â”€â”€ Blank grid-row factory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  // â”€â”€ Patty / Arrival grid fields (mirror grdPurchaseBags / LotNo / Mark in frmpurchase.cs) â”€â”€
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

// â”€â”€â”€ Blank totals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Batch No label â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const getBatchNoLabel = () => {
  try {
    const ms = JSON.parse(localStorage.getItem("Mainsetting") || "[{}]");
    const name = ms?.[0]?.BatchNoName;
    return name && name.trim() !== "" ? name : "Batch No";
  } catch { return "Batch No"; }
};

// â”€â”€â”€ Grid column definitions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// NOTE: Bags / LotNo / Mark carry `modes` â€” they are only shown when purchaseMode
// is ARRIVAL / PATTY / SALESPATTY (mirrors grdPurchase.Columns[...].Visible toggling
// inside LoadArrival() in frmpurchase.cs). All other columns are visible in every mode
// (modes: undefined â‡’ "always").
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

// â”€â”€â”€ CALC_KEYS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CALC_KEYS = new Set([
  "MRP", "PurchaseRate", "cdpercent", "DiscountPercent", "CESSPer", "SPLCESS",
  "TaxPercent", "FreeQty", "TransPer", "ItemQty", "NomQty", "Salerate",
  "ProfitPer", "SaleDiscPer", "SaleGST", "Meter", "Pcs", "WholeSalerate",
]);

// â”€â”€â”€ BATCH_ID_KEYS â€” no financial recalc needed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BATCH_ID_KEYS = new Set(["BrandId", "ModelId", "ColorId", "SizeId"]);

// â”€â”€â”€ FIX 1: FORM_COLUMNS at module level (not inside component) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Was inside the component body â€” caused recreation on every render and broke
// useCallback dependency arrays that referenced it indirectly via loadFocusFormColumns.
const FORM_COLUMNS = [
  { column: "dtppurchasedate", text: "PurchaseDate" },
  { column: "dtpduedate",      text: "DueDate"      },
  { column: "cmbpurchaseType", text: "PurchaseType" },
  { column: "cmbsupplier",     text: "Supplier"     },
  { column: "txtinvoiceno",    text: "InvoiceNo"    },
  { column: "dtpinvoicedate",  text: "InvoiceDate"  },
  { column: "txtinvoiceamt",   text: "InvoiceAmt"   },
  { column: "gridpurchase",    text: "GridPurchase" },
  { column: "txtotherplus",    text: "Others(+)"    },
  { column: "txtothersub",     text: "Others(-)"    },
  { column: "txtremarks",      text: "Remarks"      },
];

const PURCHASE_SCREEN_VISIBLE_COLUMNS = new Set([
  "ProductCode",
  "ProductName",
  "PurchaseRate",
  "ItemQty",
  "Amount",
]);

// â”€â”€â”€ PATTY_ROW_TEMPLATE â€” mirrors grdPatty seed rows (COMMISSION/LORRY FREIGHT/COOLY) â”€
// used only as a fallback when PattySelect returns nothing yet, so the panel isn't empty.
const PATTY_ROW_TEMPLATE = [
  { Id: 0, PattyName: "COMMISSION" },
  { Id: 0, PattyName: "LORRY FREIGHT" },
  { Id: 0, PattyName: "COOLY" },
];

const PURCHASE_QUICK_CREATE_KEY = "purchase_supplier_quick_create_state";
const PURCHASE_PRODUCT_QUICK_CREATE_KEY = "purchase_product_quick_create_state";
const isQuickCreateEnabled = (v) => v === true || v === "true" || v === "1" || v === 1;
const normalizeProductValue = (value) => String(value || "").trim().toUpperCase();

// â”€â”€â”€ MODE_LABELS â€” mirrors the lbPurchaseNo/lbPurchaseDate/lbPurchaseType.Text
// swap done inside LoadArrival() in frmpurchase.cs for each radio mode. â”€â”€â”€â”€â”€â”€â”€â”€â”€
const MODE_LABELS = {
  PURCHASE:   { no: "Purchase No",  date: "Purchase Date",   type: "Purchase Type",   title: "Purchase Details"  },
  ARRIVAL:    { no: "Arrival No",   date: "Arrival Date",    type: "Arrival Type",    title: "Arrival Details"   },
  PATTY:      { no: "Patty No",     date: "Arrival Date",    type: "Patty Type",      title: "Patty Details"     },
  SALESPATTY: { no: "SalePatty No", date: "SalePatty Date",  type: "SalePatty Type",  title: "SalePatty Details" },
};

const PURCHASE_UI_VISIBLE_COLUMNS = new Set([
  "ProductCode",
  "ProductName",
  "UOM",
  "PurchaseRate",
  "ItemQty",
  "Amount",
]);

// â”€â”€â”€ TotalRow sub-component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function TotalRow({ label, value }) {
  return (
    <div className="total-row">
      <span className="total-label">{label}</span>
      <span className="total-value">{value}</span>
    </div>
  );
}
// exceedsDecimalLimit â€” UOMDecimal-à® à®µà®¿à®Ÿ à®…à®¤à®¿à®•à®®à®¾à®© decimal digits à®‡à®°à¯à®¨à¯à®¤à®¾ true return à®ªà®£à¯à®£à¯à®®à¯.
// UOMDecimal = 2 â†’ "12.345" (dot-à®•à¯à®•à¯ à®ªà®¿à®©à¯ 3 digits) => true (block à®ªà®£à¯à®£à®©à¯à®®à¯)
// UOMDecimal = 0 â†’ "." à®•à¯‚à®Ÿ allow à®ªà®£à¯à®£à®•à¯à®•à¯‚à®Ÿà®¾à®¤à¯
const exceedsDecimalLimit = (value, decimals) => {
  const str = String(value ?? "");
  const dotIdx = str.indexOf(".");
  if (dotIdx === -1) return false;
  const fracLen = str.length - dotIdx - 1;
  return fracLen > valNum(decimals);
};
// â”€â”€â”€ PRINT CHOICE DIALOG (A4 Print/View â€” mirrors Sale module's PrintChoiceDialog) â”€â”€
function PurchasePrintChoiceDialog({ onPrint, onView, onSkip }) {
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
          Purchase Bill Saved Successfully!
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
              fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
            }}><Printer size={16} strokeWidth={2.2} />Print</button>
          <button
            onClick={onView}
            style={{
              padding: "8px 16px", borderRadius: 5,
              border: "1px solid #c5d8f8", background: "#e8f0fe",
              color: "#1f65de", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
            }}><Monitor size={16} strokeWidth={2.2} />View</button>
          <button
            onClick={onSkip}
            style={{
              padding: "8px 16px", borderRadius: 5,
              border: "1px solid #d4dbe8", background: "#f8faff",
              color: "#4a5568", fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}>Skip</button>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€ PurchasesMaster â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function Purchase() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    document.title = "Purchase-Kassapos";
  }, []);
  const externalOpenRef = useRef("");
  const fromPattyPurchaseView = !!location.state?.pattyPurchaseOpen;
  const quickCreateState = location.state?.quickCreate;
  const productCreateConfirmRef = useRef(false);

  const { confirm, ConfirmUI } = CC.useConfirm();
  const { toast,   toasts    } = MSG.useToast();

  // â”€â”€ Permission / authorization â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    console.log("Location State:", location);
    console.log("Menu:", menulist);

    if (fromPattyPurchaseView) {
      // Temporary full access only for the current Patty Purchase View handoff.
      setPerm({ View: 1, Add: 1, Edit: 1, Delete: 1 });
      setIsAuthorized(true);
      return;
    }

    if ((!menudata || menudata.length === 0) || menudata[0].View === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => navigate("/Home"), 3000);
      return;
    }

    setPerm({ View: menudata[0].View, Add: menudata[0].Add, Edit: menudata[0].Edit, Delete: menudata[0].Delete });
    setIsAuthorized(true);
  }, [navigate, location.state]);

  // â”€â”€ Session â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [sess] = useState(() => {
    try { return CC.buildSession("Purchase"); }
    catch { return { Comid: "1", MComid: "1", IdComList: "1", MirrorTable: "0", menudata: [] }; }
  });

  // â”€â”€ A4 Print/View â€” CacheKey based architecture (mirrors SaleBill.jsx) â”€â”€â”€â”€â”€
  // Reads Companysetting/Mainsetting directly from localStorage (same source
  // Sale module reads), completely independent of the existing `sess` object
  // above â€” nothing about `sess` or any existing state/logic is touched.
  const printSess = useMemo(() => {
    try {
      const main0 = (CC.getLocal("Mainsetting")    || [{}])[0] || {};
      const com0  = (CC.getLocal("Companysetting") || [{}])[0] || {};
      return {
        BillFormatName: com0.PurchaseBillFormat || com0.SaleBillFormat || "Default",
        CompanyName:    com0.Companyname || "",
        Address1:       com0.Address1    || "",
        Address2:       com0.Address2    || "",
        City:           com0.City        || "",
        Pincode:        com0.Pincode     || "",
        Phone:          com0.Phone       || "",
        GSTNo:          com0.GSTNo       || "",
        Email:          com0.Email       || "",
        StateCode:      com0.State       || "",
        YearName:       com0.YearName    || "",
        POSLine1:       com0.POSLine1    || "",
        POSLine2:       com0.POSLine2    || "",
        POSLine3:       com0.POSLine3    || "",
        POSLine4:       com0.POSLine4    || "",
        POSLine5:       com0.POSLine5    || "",
        No_Of_Bills:    com0.No_Of_Bills || "1",
        BankLine1:      com0.BankLine1   || "",
        BankLine2:      com0.BankLine2   || "",
        BankLine3:      com0.BankLine3   || "",
        BankLine4:      com0.BankLine4   || "",
        BankLine5:      com0.BankLine5   || "",
        PrintA4:        !!main0.A4BillPrint,
      };
    } catch {
      return { BillFormatName: "Default", CompanyName: "", No_Of_Bills: "1", PrintA4: false };
    }
  }, []);

  // [printDialog] Print/View/Skip dialog state â€” set after a successful Save
  // once the backend returns the CacheKey (Data15). Null = hidden.
  const [printDialog, setPrintDialog] = useState(null);

  // buildPrintDetails() â€” identical logic/shape to Sale module's buildPrintDetails(),
  // just sourced from printSess instead of Sale's sess.
  const buildPrintDetails = useCallback(() => {
    return new URLSearchParams({
      BillFormatName: printSess.BillFormatName,
      EBillFormatName: printSess.BillFormatName,
      CompanyName:    printSess.CompanyName,
      Address1:       printSess.Address1,
      Address2:       printSess.Address2,
      City:           printSess.City,
      Pincode:        printSess.Pincode,
      MobileNo:       printSess.Phone,
      GSTNO:          printSess.GSTNo,
      Email:          printSess.Email,
      Year:           printSess.YearName,
      StateCode:      printSess.StateCode,
      StateName:      "",
      SaleCon1:       printSess.POSLine1,
      SaleCon2:       printSess.POSLine2,
      SaleCon3:       printSess.POSLine3,
      SaleCon4:       printSess.POSLine4,
      SaleCon5:       printSess.POSLine5,
      NoofBills:      printSess.No_Of_Bills,
      Bank1:          printSess.BankLine1,
      Bank2:          printSess.BankLine2,
      Bank3:          printSess.BankLine3,
      Bank4:          printSess.BankLine4,
      Bank5:          printSess.BankLine5,
      FromEmailId:    "keykassapos@gmail.com",
      FromEmailPwd:   "rlreahjhtwhpkelf",
    }).toString();
  }, [printSess]);

  // openReportViewer() â€” identical logic to Sale module's openReportViewer():
  // autoPrint=true  â†’ tiny hidden window, auto-clicks btnPrint, closes itself (direct print)
  // autoPrint=false â†’ full window (view/preview mode)
  // Only the ReportName is changed (SaleInvoice â†’ PurchaseInvoice) to select the
  // correct Crystal Report on the server; the CacheKey â†’ Cache â†’ ReportData â†’
  // ReportSubData â†’ PrintDetails â†’ Crystal Report flow on the backend is unchanged.
  const openReportViewer = useCallback((autoPrint = false, copy = "Original", cacheKey = "") => {
    const printDetails = buildPrintDetails();
    const A4Print = autoPrint ? "1" : "0";

    const url = `${CC.BASE_URL}/Reports/ReportViewer.aspx` +
                `?ReportName=PurchaseInvoice` +
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

  // â”€â”€ Master-form state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  const [openingBalance, setOpeningBalance] = useState("0.00");
  const [paidAmount,     setPaidAmount    ] = useState("0.00");
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

  // â”€â”€ PURCHASE MODE (mirrors rdbpurchase / rdbpatti / rdbsalespatty / rdbarrival +
  //     clsfunction.CMBTPatty in frmpurchase.cs) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // "PURCHASE" (default) â†’ every existing calculation/validation/save path is
  // 100% unchanged. Switching mode only adds behaviour on top; nothing about the
  // PURCHASE-mode path is altered.
  const [purchaseMode, setPurchaseMode] = useState("PURCHASE"); // PURCHASE | PATTY | SALESPATTY | ARRIVAL
  const isPurchaseMode = purchaseMode === "PURCHASE";
  // Derived flag â€” true whenever the Patty side-panel + deduction math should engage
  // (mirrors "PattyStatus == 2" i.e. rdbpatti or rdbsalespatty checked in the .cs).
  const pattyMode = purchaseMode === "PATTY" || purchaseMode === "SALESPATTY";
  const modeLabels = MODE_LABELS[purchaseMode];
const [pattyFeatureEnabled, setPattyFeatureEnabled] = useState(false);
  // Arrival-only fields (mirror txtdays / dtpdispatchedDate in the .cs)
  const [arrivalDays,    setArrivalDays   ] = useState(0);
  const [dispatchedDate, setDispatchedDate] = useState(today());

  // Patty vehicle/person fields (mirror txtvehicleno / txtperson / dtppattidate)
  const [pattyVehicleNo, setPattyVehicleNo] = useState("");
  const [pattyPerson,    setPattyPerson]    = useState("");
  const [pattyDate,      setPattyDate]      = useState(today());

  // Patty grid rows (Commission / Lorry Freight / Cooly) â€” loaded from PattySelect
  // the first time the user switches into PATTY / SALESPATTY mode.
  const [pattyRows,   setPattyRows  ] = useState([]);
  const [pattyLoaded, setPattyLoaded] = useState(false);

  // Arrival: Days â†’ Dispatched Date auto-fill (mirrors the DueDate auto-fill pattern
  // already used for creditDays below, applied instead to Arrival's own date pair).
  useEffect(() => {
    if (purchaseMode !== "ARRIVAL" || !arrivalDays) return;
    const base = new Date(purchaseDate);
    if (isNaN(base.getTime())) return;
    base.setDate(base.getDate() + arrivalDays);
    setDispatchedDate(base.toISOString().split("T")[0]);
  }, [purchaseDate, arrivalDays, purchaseMode]);

  // â”€â”€ Supplier autocomplete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [supplierQuery,    setSupplierQuery   ] = useState("");
  const [supplierDropdown, setSupplierDropdown] = useState([]);
  const [supplierDDOpen,   setSupplierDDOpen  ] = useState(false);
  const [supplierSelIdx,   setSupplierSelIdx  ] = useState(0);
  const supplierCreateVisible = isQuickCreateEnabled(sess.AllowQuickMasterCreation)
    && !!supplierQuery.trim()
    && !supplierList.some((s) => (s.AccountName || "").trim().toLowerCase() === supplierQuery.trim().toLowerCase());

  // â”€â”€ Totals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [totals, setTotals] = useState(EMPTY_TOTALS);

  // â”€â”€ Grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [gridRows,     setGridRows    ] = useState([makeGridRow()]);
  const [selectedCell, setSelectedCell] = useState({ rowKey: null, colKey: null });
  const [gstSplit,     setGstSplit    ] = useState([]);

  // â”€â”€ Search / view â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [searchNo,  setSearchNo ] = useState("");
  const [viewList,  setViewList ] = useState([]); // eslint-disable-line

  // â”€â”€ Edit state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [editId,      setEditId     ] = useState(0);
  const [updateIdEdit,setUpdateIdEdit] = useState("");
  const [loading,     setLoading    ] = useState(false);
  const originalStockDetailsRef = useRef([]);

  // â”€â”€ Edit Password modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [editPwdOpen,       setEditPwdOpen      ] = useState(false);
  const [editPwdValue,      setEditPwdValue     ] = useState("");
  const [editPwdLoading,    setEditPwdLoading   ] = useState(false);
  const [editPwdError,      setEditPwdError     ] = useState("");
  const [pendingEditAction, setPendingEditAction] = useState(null);

  // â”€â”€ Popups â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [productPopup,    setProductPopup   ] = useState({ open: false, rowKey: null, list: [], query: "" });
  const [purchaseProducts, setPurchaseProducts] = useState(() => CC.getCachedProductList(sess.MComid));
  const [mrpPopup,        setMrpPopup       ] = useState({ open: false, rowKey: null, list: [] });
  const [itemCreatePopup, setItemCreatePopup] = useState({ open: false, rowKey: null, code: "" });
  const [serialNoPopup,   setSerialNoPopup  ] = useState({ open: false, rowKey: null, textRefId: "", list: [], returnColKey: "ItemQty" });
  const [serialNoList,    setSerialNoList   ] = useState([]);
  const [gridComboPopup,  setGridComboPopup ] = useState({ open: false, rowKey: null, colKey: null, query: "", list: [], valueProp: "", labelProp: "", title: "" });


  // â”€â”€ BatchWise masters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [batchWise,  setBatchWise ] = useState(false);
  const [brandList,  setBrandList ] = useState([]);
  const [modelList,  setModelList ] = useState([]);
  const [colorList,  setColorList ] = useState([]);
  const [sizeList,   setSizeList  ] = useState([]);

  // â”€â”€ F5 List View â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ F12 column config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [f12Open,   setF12Open  ] = useState(false);
  const [colConfig, setColConfig] = useState(() => makeDefaultColConfig());
  const [f12Draft,  setF12Draft ] = useState([]);
  const colConfigRef = useRef(makeDefaultColConfig());

  useEffect(() => { colConfigRef.current = colConfig; }, [colConfig]);

  // â”€â”€ Ctrl+G Grid Focus Columns â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [focusColOpen,    setFocusColOpen   ] = useState(false);
  const [focusColDraft,   setFocusColDraft  ] = useState([]);
  const [focusColDragIdx, setFocusColDragIdx] = useState(null);

  // â”€â”€ Ctrl+F Form Focus Columns â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [focusFormColOpen,    setFocusFormColOpen   ] = useState(false);
  const [focusFormColDraft,   setFocusFormColDraft  ] = useState([]);
  const [focusFormDragIdx,    setFocusFormDragIdx   ] = useState(null);
  const quickCreateHandledRef = useRef(false);

  // â”€â”€ Batch-column visibility flags â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const bStatus = batchWise && (colConfig.find(c => c.key === "BrandId")?.visible ?? true) ? 1 : 0;
  const sStatus = batchWise && (colConfig.find(c => c.key === "SizeId" )?.visible ?? true) ? 1 : 0;
  const cStatus = batchWise && (colConfig.find(c => c.key === "ColorId")?.visible ?? true) ? 1 : 0;
  const mStatus = batchWise && (colConfig.find(c => c.key === "ModelId")?.visible ?? true) ? 1 : 0;

  // â”€â”€ Column visibility helper â€” combines F12 colConfig with mode-restricted
  // columns (Bags/LotNo/Mark only in ARRIVAL/PATTY/SALESPATTY; mirrors the
  // grdPurchase.Columns[...].Visible toggling in LoadArrival()). â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const isColVisible = useCallback((col) => {
    if (col.modes && !col.modes.includes(purchaseMode)) return false;
    if (!PURCHASE_SCREEN_VISIBLE_COLUMNS.has(col.key)) return false;
    const cfg = colConfig.find((x) => x.key === col.key);
    return cfg ? cfg.visible : col.defaultVisible;
  }, [colConfig, purchaseMode]);

  // â”€â”€ Refs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  const applyProductToRowRef = useRef(null);
  const f12PrevCellRef       = useRef(null);
  const initialFocusDone     = useRef(false);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  ROW CALCULATION
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  ROW CALCULATION
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const calcRow = useCallback((row) => {
     const qty        = valNum(row.ItemQty) ;
    if(sess.MultipleUOMBilling==true){
    if(row.ItemQty==0){
         const qty        = valNum(row.NomQty) ;
    }

    }
   
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
  setPattyFeatureEnabled(enabled);
  if (!enabled) setPurchaseMode("PURCHASE");
}, [isAuthorized]);
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  GST SPLIT + TOTALS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Effect 1 â€” IGST/GST status à®®à®¾à®±à¯à®®à¯à®ªà¯‹à®¤à¯ à®®à®Ÿà¯à®Ÿà¯à®®à¯ trigger à®†à®•à®£à¯à®®à¯.
// calcRow-à® dependency-à®² à®µà¯ˆà®•à¯à®•à®² â€” à®à®©à¯à®©à®¾ calcRow, igstStatus à®®à®¾à®±à¯à®®à¯à®ªà¯‹à®¤à¯‡
// à®®à®¾à®±à¯à®®à¯ (useCallback deps common), à®…à®¤à¯ˆ à®µà®šà¯à®šà®¾ taxMode à®®à®¾à®¤à¯à®¤à¯à®®à¯à®ªà¯‹à®¤à¯
// à®‡à®¨à¯à®¤ effect à®¤à¯‡à®µà¯ˆà®¯à®¿à®²à¯à®²à®¾à®® à®®à®±à¯à®ªà®Ÿà®¿ run à®†à®•à®¿ calcRow 2 à®¤à®Ÿà®µà¯ˆ call à®†à®•à¯à®®à¯.
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  PATTY MODE â€” load & recompute (only active when pattyMode === true)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  // inside Calculation() in frmpurchase.cs â€” summed across every non-free-product row).
  const totKgs  = gridRows.reduce((s, r) => (r.ProductCode && !valNum(r.FreeQtyStatus)) ? s + valNum(r.ItemQty) : s, 0);
  const totBags = gridRows.reduce((s, r) => (r.ProductCode && !valNum(r.FreeQtyStatus)) ? s + valNum(r.Bags)    : s, 0);

  // Per-row Patty amount â€” mirrors the exact branch order in frmpurchase.cs (~line 2698-2741):
  //   1) if Percentage is filled  â†’ % of product total
  //   2) else if BagRate is filled â†’ LORRY FREIGHT: BagRate Ã— TotKgs, COOLY: BagRate Ã— TotBags
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

  // Final Net Amount â€” identical to totals.netAmt when Patty mode is off.
  // When on, the patty total is deducted (mirrors Ptotal = TotalItemAmt ... - patty ...).
  const finalNetAmt = pattyMode
    ? fmt2(roundOff(valNum(totals.netAmt) - valNum(pattyTotal)))
    : totals.netAmt;

  const effectiveInvoiceNo = String(purchaseNo || "");
  const effectiveInvoiceAmt = fmt2(finalNetAmt || "0.00");
  const billAmountValue = fmt2(finalNetAmt || "0.00");
  const closingBalanceValue = fmt2(valNum(openingBalance) + valNum(billAmountValue) - valNum(paidAmount));

  useEffect(() => {
    setInvoiceNo(String(purchaseNo || ""));
    setInvoiceAmt(fmt2(finalNetAmt || "0.00"));
  }, [purchaseNo, finalNetAmt]);

  // Credit days â†’ DueDate auto-update
  useEffect(() => {
    if (!creditDays || creditDays <= 0 || !invoiceDate) return;
    const base = new Date(invoiceDate);
    if (isNaN(base.getTime())) return;
    base.setDate(base.getDate() + creditDays);
    setDueDate(base.toISOString().split("T")[0]);
  }, [invoiceDate, creditDays]);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  FOCUS FORM COLUMNS (Ctrl+F)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loadFocusFormColumns = useCallback(async () => {
    let draft = FORM_COLUMNS.map((c, i) => ({
      filename: "PurchaseFormFocus",
      column:   c.column,
      label:    c.text,
      Index:    i,
      Focus:    true,
      Comid:    sess.MComid,
    }));
    console.log("ðŸ”µ [loadFocusFormColumns] default draft:", draft.map(d => `${d.column}(Focus:${d.Focus})`));
  
    try {
      const url = CC.BASE_URL + `${CC1.GetFocusColumnsUrl}?comid=${sess.Comid}&filename=PurchaseFormFocus`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...CC.authHeaders() },
        body: JSON.stringify({ comid: sess.Comid, filename: "PurchaseFormFocus" }),
      });
      if (res.ok) {
        const saved = await res.json();
        console.log("ðŸŸ¡ [loadFocusFormColumns] backend saved data:", saved);
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
      } else {
        console.log("ðŸ”´ [loadFocusFormColumns] fetch not ok, status:", res.status);
      }
    } catch (err) {
      console.log("ðŸ”´ [loadFocusFormColumns] fetch failed / first use:", err);
    }
    console.log("ðŸŸ¢ [loadFocusFormColumns] FINAL draft after merge:", draft.map(d => `${d.column}(Focus:${d.Focus}, Index:${d.Index})`));
    setFocusFormColDraft(draft);
  }, [sess.MComid, sess.Comid]);
  // FIX 2: correct useCallback deps â€” was wrongly copy-pasted from useEffect
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
        toast("âœ… Form Columns Focus Enabled. Refreshingâ€¦");
        setTimeout(() => window.location.reload(true), 1000);
      } else {
        toast(`âŒ ${res?.message || "Save failed !!!."}`, true);
      }
    } catch {
      setLoading(false);
      toast("âŒ Technical Fault. Contact Software Vendor !!!.", true);
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
  const focusformcolumns = FORM_COLUMNS
  .filter((c) => {
    const d = focusFormColDraft.find((x) => x.column === c.column);
    return d ? d.Focus : true;   // backend/draft-à®² off à®ªà®£à¯à®£à®¿ à®‡à®°à¯à®¨à¯à®¤à®¾ à®®à®Ÿà¯à®Ÿà¯à®®à¯ skip
  })
  .map((c) => ({ column: c.column, focus: 1 }));

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
  
    const isFocusEnabled = (col) => {
      const d = focusFormColDraft.find((x) => x.column === col);
      return d ? d.Focus : true;
    };
  
    let startIdx;
    if (!currentColumn) {
      startIdx = -1; // start from the beginning
    } else {
      // Look up currentColumn's position in the FULL FORM_COLUMNS list,
      // not the Focus-filtered one â€” the current field's own Focus flag
      // must not block us from finding what comes after it.
      startIdx = FORM_COLUMNS.findIndex((c) => c.column === currentColumn);
      if (startIdx === -1) return; // truly doesn't exist
    }
  
    // Walk forward through FORM_COLUMNS and find the next Focus-enabled column
    let nextCol = null;
    for (let i = startIdx + 1; i < FORM_COLUMNS.length; i++) {
      if (isFocusEnabled(FORM_COLUMNS[i].column)) {
        nextCol = FORM_COLUMNS[i].column;
        break;
      }
    }
  
    if (!nextCol) {
      jumpToGrid();
      return;
    }
  
    const focusMap = {
      dtppurchasedate: () => document.getElementById("dtppurchasedate")?.focus(),
      cmbpurchaseType: () => purchaseTypeRef.current?.focus(),
      dtpduedate:      () => document.getElementById("dtpduedate")?.focus(),
      cmbsupplier:     () => supplierRef.current?.focus(),
      txtinvoiceno:    () => invoiceNoRef.current?.focus(),
      dtpinvoicedate:  () => document.getElementById("dtpinvoicedate")?.focus(),  // if you convert invoice date too
      txtinvoiceamt:   () => invoiceAmtRef.current?.focus(),
      gridpurchase:    jumpToGrid,
      txtotherplus:    () => otherPlusRef.current?.focus(),
      txtothersub:     () => otherSubRef.current?.focus(),
      txtremarks:      () => remarksRef.current?.focus(),
    };
    focusMap[nextCol]?.();
  }, [focusFormColDraft, gridRows, orderedGridColumns]);

  useEffect(() => {
    if (!initialFocusDone.current && focusformcolumns.length > 0) {
      initialFocusDone.current = true;
      setTimeout(() => nextFocusForm(), 150);
    }
  }, [focusformcolumns, nextFocusForm]);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  LOAD FUNCTIONS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  const saveQuickCreateState = useCallback((extra = {}) => {
    const snapshot = {
      purchaseNo, purchaseDate, dueDate, invoiceDate, invoiceNo, invoiceAmt,
      remarks, purchaseType, igstStatus, igstChecked,
      supplierId, supplierQuery, supplierInfo, creditDays,
      taxMode, purRateInclusive, otherPlus, otherSub, tcsPercent, tcsAmt,
      lorryNo, discPer, purchaseMode, pattyFeatureEnabled,
      arrivalDays, dispatchedDate, pattyVehicleNo, pattyPerson, pattyDate,
      pattyRows, pattyLoaded, totals, gridRows, selectedCell, gstSplit,
      editId, updateIdEdit, serialNoList,
      ...extra,
    };
    sessionStorage.setItem(extra.storageKey || PURCHASE_QUICK_CREATE_KEY, JSON.stringify(snapshot));
  }, [
    purchaseNo, purchaseDate, dueDate, invoiceDate, invoiceNo, invoiceAmt,
    remarks, purchaseType, igstStatus, igstChecked,
    supplierId, supplierQuery, supplierInfo, creditDays,
    taxMode, purRateInclusive, otherPlus, otherSub, tcsPercent, tcsAmt,
    lorryNo, discPer, purchaseMode, pattyFeatureEnabled,
    arrivalDays, dispatchedDate, pattyVehicleNo, pattyPerson, pattyDate,
    pattyRows, pattyLoaded, totals, gridRows, selectedCell, gstSplit,
    editId, updateIdEdit, serialNoList,
  ]);

  const restoreQuickCreateState = useCallback((snapshot) => {
    if (!snapshot || typeof snapshot !== "object") return;
    setPurchaseNo(snapshot.purchaseNo || "");
    setPurchaseDate(snapshot.purchaseDate || today());
    setDueDate(snapshot.dueDate || today());
    setInvoiceDate(snapshot.invoiceDate || today());
    setInvoiceNo(snapshot.invoiceNo || "");
    setInvoiceAmt(snapshot.invoiceAmt || "0.00");
    setRemarks(snapshot.remarks || "");
    setPurchaseType(snapshot.purchaseType || "CREDIT");
    setIgstStatus(snapshot.igstStatus || "GST");
    setIgstChecked(!!snapshot.igstChecked);
    setSupplierId(snapshot.supplierId || "");
    setSupplierQuery(snapshot.supplierQuery || "");
    setSupplierInfo(snapshot.supplierInfo || { address: "", city: "", phone: "", balance: "0.00" });
    setOpeningBalance(snapshot.openingBalance || "0.00");
    setPaidAmount(snapshot.paidAmount || "0.00");
    setCreditDays(snapshot.creditDays || 0);
    setTaxMode(snapshot.taxMode || "exclusive");
    setPurRateInclusive(!!snapshot.purRateInclusive);
    setOtherPlus(snapshot.otherPlus || "0.00");
    setOtherSub(snapshot.otherSub || "0.00");
    setTcsPercent(snapshot.tcsPercent || "0.00");
    setTcsAmt(snapshot.tcsAmt || "0.00");
    setLorryNo(snapshot.lorryNo || "");
    setDiscPer(snapshot.discPer || "0.00");
    setPurchaseMode("PURCHASE");
    setPattyFeatureEnabled(!!snapshot.pattyFeatureEnabled);
    setArrivalDays(snapshot.arrivalDays || 0);
    setDispatchedDate(snapshot.dispatchedDate || today());
    setPattyVehicleNo(snapshot.pattyVehicleNo || "");
    setPattyPerson(snapshot.pattyPerson || "");
    setPattyDate(snapshot.pattyDate || today());
    setPattyRows(Array.isArray(snapshot.pattyRows) ? snapshot.pattyRows : []);
    setPattyLoaded(!!snapshot.pattyLoaded);
    setTotals(snapshot.totals || EMPTY_TOTALS);
    setGridRows(Array.isArray(snapshot.gridRows) && snapshot.gridRows.length ? snapshot.gridRows : [makeGridRow()]);
    setSelectedCell(snapshot.selectedCell || { rowKey: null, colKey: null });
    setGstSplit(Array.isArray(snapshot.gstSplit) ? snapshot.gstSplit : []);
    setEditId(snapshot.editId || 0);
    setUpdateIdEdit(snapshot.updateIdEdit || "");
    setSerialNoList(Array.isArray(snapshot.serialNoList) ? snapshot.serialNoList : []);
  }, []);

  const loadPurchaseProducts = useCallback(async () => {
    const cached = CC.getCachedProductList(sess.MComid);
    if (cached.length > 0) {
      setPurchaseProducts(cached);
      return cached;
    }
    const arr = await CC.preloadProductListForComid(sess.MComid, { path: CC.GetProductListV7 });
    setPurchaseProducts(arr);
    return arr;
  }, [sess.MComid, redirectIfDualLogin]);

  const focusProductField = useCallback((rowKey, colKey = "ProductCode") => {
    if (!rowKey) return;
    setTimeout(() => focusCellRef.current?.(rowKey, colKey), 80);
  }, []);

  const navigateProductQuickCreate = useCallback((context) => {
    const code = String(context?.typedProductCode || "").trim();
    const name = String(context?.typedProductName || "").trim();
    if ((!code && !name) || !isQuickCreateEnabled(sess.AllowQuickProductCreation)) return false;
    const storageKey = `${PURCHASE_PRODUCT_QUICK_CREATE_KEY}:${Date.now()}`;
    saveQuickCreateState({
      storageKey,
      productQuickCreateContext: {
        rowKey: context.rowKey,
        field: context.field || (code ? "ProductCode" : "ProductName"),
        typedProductCode: code,
        typedProductName: name,
      },
    });
    navigate("/Itemmaster", {
      state: {
        quickCreate: {
          quickCreateType: "product",
          productCreateReturn: true,
          openLastPage: true,
          source: "purchase",
          returnTo: location.pathname,
          storageKey,
          rowKey: context.rowKey,
          field: context.field || (code ? "ProductCode" : "ProductName"),
          initialProductCode: code,
          initialProductName: name,
        },
      },
    });
    return true;
  }, [location.pathname, navigate, saveQuickCreateState, sess.AllowQuickProductCreation]);

  const startProductQuickCreate = useCallback(async (context) => {
    const code = String(context?.typedProductCode || "").trim();
    const name = String(context?.typedProductName || "").trim();
    const field = context?.field || (code ? "ProductCode" : "ProductName");
    if ((!code && !name) || !isQuickCreateEnabled(sess.AllowQuickProductCreation) || productCreateConfirmRef.current) return false;
    productCreateConfirmRef.current = true;
    const message = code
      ? `Product code "${code}" does not exist.\nDo you want to create a new Product?`
      : `Product "${name}" does not exist.\nDo you want to create a new Product?`;
    const ok = await confirm({ title: "Create New Product", message });
    productCreateConfirmRef.current = false;
    if (!ok) {
      focusProductField(context?.rowKey, field);
      return true;
    }
    return navigateProductQuickCreate({ ...context, field, typedProductCode: code, typedProductName: name });
  }, [confirm, focusProductField, navigateProductQuickCreate, sess.AllowQuickProductCreation]);

  const navigateSupplierQuickCreate = useCallback((typedName) => {
    const name = String(typedName || "").trim();
    if (!name || !isQuickCreateEnabled(sess.AllowQuickMasterCreation)) return false;
    saveQuickCreateState();
    navigate("/Supplier", {
      state: {
        quickCreate: {
          source: "purchase",
          returnTo: location.pathname,
          storageKey: PURCHASE_QUICK_CREATE_KEY,
          typedName: name,
        },
      },
    });
    return true;
  }, [location.pathname, navigate, saveQuickCreateState, sess.AllowQuickMasterCreation]);

  const startSupplierQuickCreate = useCallback(async (typedName) => {
    const name = String(typedName || "").trim();
    if (!name || !isQuickCreateEnabled(sess.AllowQuickMasterCreation)) return false;
    const ok = await confirm({
      title: "Create New Supplier",
      message: `Supplier "${name}" does not exist.\nDo you want to create it?`,
    });
    if (!ok) {
      setTimeout(() => {
        supplierRef.current?.focus?.();
        supplierRef.current?.select?.();
      }, 30);
      return true;
    }
    return navigateSupplierQuickCreate(name);
  }, [confirm, navigateSupplierQuickCreate, sess.AllowQuickMasterCreation]);

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

  // FIX 4: single mount useEffect â€” previously two separate effects both called
  // loadMaxPurchaseNo + loadSuppliers, causing duplicate API calls on mount.
  useEffect(() => {
    if (!isAuthorized) return;
    loadMaxPurchaseNo();
    loadSuppliers();
    loadBatchWiseMasters();
    loadFocusFormColumns();
    loadPurchaseProducts();
  }, [isAuthorized, loadMaxPurchaseNo, loadSuppliers, loadBatchWiseMasters, loadFocusFormColumns, loadPurchaseProducts]);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  SUPPLIER HANDLERS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSupplierChange = useCallback(async (sid, opts = {}) => {
    const { skipIgst = false, preserveOpeningBalance = false } = opts;
    setSupplierId(sid);
    if (!sid) {
      setSupplierInfo({ address: "", city: "", phone: "", balance: "0.00" });
      setOpeningBalance("0.00");
      setPaidAmount("0.00");
      return;
    }
    const local = supplierList.find((s) => String(s.Id) === String(sid));

    const applyIgstFromSupplier = (supplierObj) => {
      if (skipIgst) return;                         // â† don't touch igst when caller already resolved it
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
    if (!preserveOpeningBalance) {
      setOpeningBalance(balance);
    }
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
    setOpeningBalance("0.00");
    setPaidAmount("0.00");
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
    setSupplierDDOpen(filtered.length > 0 || (isQuickCreateEnabled(sess.AllowQuickMasterCreation) && !!value.trim()));
  }, [sess.AllowQuickMasterCreation, supplierList]);

  const confirmSupplierSelection = useCallback((supplier) => {
    setSupplierQuery(supplier.AccountName || "");
    setSupplierDDOpen(false);
    setSupplierDropdown([]);
    handleSupplierChange(String(supplier.Id));
    setTimeout(() => nextFocusForm("cmbsupplier"), 50);
  }, [handleSupplierChange, nextFocusForm]);

  const supplierInputKeyDown = useCallback(async (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const maxIdx = supplierDropdown.length + (supplierCreateVisible ? 1 : 0) - 1;
      if (!supplierDDOpen) openSupplierDropdown();
      else setSupplierSelIdx((i) => Math.min(i + 1, Math.max(maxIdx, 0)));
      return;
    }
    if (e.key === "ArrowUp")  { e.preventDefault(); setSupplierSelIdx((i) => Math.max(i - 1, 0)); return; }
    if (e.key === "Escape")   { setSupplierDDOpen(false); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      if (supplierDDOpen) {
        const chosen = supplierDropdown[supplierSelIdx];
        if (chosen) confirmSupplierSelection(chosen);
        else if (supplierCreateVisible) await startSupplierQuickCreate(supplierQuery);
        else toast("âŒ Select Valid Supplier !!!.", true);
        return;
      }
      if (supplierId) { nextFocusForm("cmbsupplier"); return; }
      if (supplierQuery.trim()) {
        const exact = supplierList.find((s) => (s.AccountName || "").trim().toLowerCase() === supplierQuery.trim().toLowerCase());
        if (exact) { confirmSupplierSelection(exact); return; }
        if (await startSupplierQuickCreate(supplierQuery)) return;
      }
      toast("âŒ Select Valid Supplier !!!.", true);
    }
  }, [supplierDDOpen, supplierDropdown, supplierSelIdx, supplierId, supplierQuery, supplierList, supplierCreateVisible, openSupplierDropdown, confirmSupplierSelection, toast, nextFocusForm, startSupplierQuickCreate]);

  useEffect(() => {
    if (!supplierId) return;
    const found = supplierList.find((s) => String(s.Id) === String(supplierId));
    if (found) setSupplierQuery(found.AccountName || "");
  }, [supplierId, supplierList]);

  useEffect(() => {
    if (!quickCreateState || quickCreateHandledRef.current) return;
    if (quickCreateState.quickCreateType !== "product" && supplierList.length === 0) return;
    quickCreateHandledRef.current = true;

    let snapshot = null;
    try {
      snapshot = JSON.parse(sessionStorage.getItem(quickCreateState.storageKey || PURCHASE_QUICK_CREATE_KEY) || "null");
    } catch {}
    sessionStorage.removeItem(quickCreateState.storageKey || PURCHASE_QUICK_CREATE_KEY);
    restoreQuickCreateState(snapshot);

    const clearNavState = () => navigate(location.pathname, { replace: true, state: null });

    if (quickCreateState.quickCreateType === "product") {
      const ctx = quickCreateState;
      const snapCtx = snapshot?.productQuickCreateContext || {};
      const rowKey = ctx.rowKey || snapCtx.rowKey;
      const field = ctx.field || snapCtx.field || "ProductCode";

      const restoreFocus = () => focusProductField(rowKey, field);

      if (!ctx.created) {
        setTimeout(restoreFocus, 120);
        clearNavState();
        return;
      }

      (async () => {
        try {
          const products = await loadPurchaseProducts();
          const match = products.find((p) =>
            String(p.Id) === String(ctx.productId) ||
            normalizeProductValue(p.ProductCode || p.Prod_Code) === normalizeProductValue(ctx.productCode) ||
            normalizeProductValue(p.ProductName || p.PName) === normalizeProductValue(ctx.productName)
          );
          if (match && rowKey) {
            applyProductToRowRef.current?.(rowKey, match);
          } else {
            toast("âš ï¸ Newly created product could not be auto-selected.", true);
            restoreFocus();
          }
        } catch {
          restoreFocus();
        } finally {
          productCreateConfirmRef.current = false;
          clearNavState();
        }
      })();
      return;
    }

    if (quickCreateState.created && quickCreateState.entityId) {
      setSupplierQuery(quickCreateState.entityName || snapshot?.supplierQuery || "");
      handleSupplierChange(String(quickCreateState.entityId));
    }

    setTimeout(() => {
      supplierRef.current?.focus?.();
      supplierRef.current?.select?.();
    }, 120);

    clearNavState();
  }, [
    quickCreateState, supplierList, restoreQuickCreateState, handleSupplierChange,
    navigate, location.pathname, loadPurchaseProducts, toast, focusProductField,
  ]);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  GRID HELPERS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const focusCell = useCallback((rowKey, colKey) => {
    setSelectedCell({ rowKey, colKey });
    setTimeout(() => {
      const el = document.getElementById(`cell_${rowKey}_${colKey}`);
      if (el) { el.focus(); el.select?.(); }
    }, 20);
  }, []);
  focusCellRef.current = focusCell;

  const deleteGridRow = useCallback((rowKey) => {
    const targetRow = gridRows.find((r) => r._key === rowKey);
    if (!targetRow) return;

    setGridRows((prev) => {
      const updated = prev.filter((r) => r._key !== rowKey);
      if (updated.length === 0) updated.push(makeGridRow());
      return updated;
    });

    if (targetRow.TextRefId) {
      setSerialNoList((prev) => prev.filter((s) => s.IndexRefId !== targetRow.TextRefId));
    }
  }, [gridRows]);

  const handleCellChange = useCallback((rowKey, colKey, value) => {
    setGridRows((prev) => {
      const idx = prev.findIndex((r) => r._key === rowKey);
      if (idx === -1) return prev;
      
      let row = { ...prev[idx] };

      if (colKey === "ItemQty") {
        if (exceedsDecimalLimit(value, row.UOMDecimal)) {
          return prev;   // UOMDecimal 0 â‡’ don't allow decimal typing
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

  // FIX 6: applyBillDiscount â€” was referencing setRows (doesn't exist) and
  // calcSaleRow (doesn't exist). Fixed to use setGridRows + calcRow.
  const applyBillDiscount = useCallback(() => {
    const per = valNum(discPer);
    if (!per) return;
    setGridRows((prev) => prev.map((r) => {
      if (!r.ProductRefId || !valNum(r.ItemQty)) return r;
      return calcRow({ ...r, DiscountPercent: String(per) });
    }));
  }, [discPer, calcRow]);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  FOCUS GRID COLUMNS (Ctrl+G)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        toast("âœ… Columns Reorder & Focus Enabled. Refreshingâ€¦");
        setTimeout(() => window.location.reload(true), 1000);
      } else { toast(`âŒ ${res?.message || "Save failed !!!."}`, true); }
    } catch { setLoading(false); toast("âŒ Technical Fault. Contact Software Vendor !!!.", true); }
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  F12 COLUMN CONFIG
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loadColConfig = useCallback(async () => {
    try {
       const res = await fetch(
            CC.BASE_URL + `${CC.GetFocusColumnsUrl}?comid=${sess.Comid}&filename=Purchase`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...CC.authHeaders(),   // â† same headers your other API calls use
              },
            }
          );
           const data = await res.json();
      if (!Array.isArray(data) || !data.length) return;
      // const res = await CC.api(`/Content/Appdata/Visible/${sess.Comid}/Purchase.json`, null, {}, { v: Date.now() });
    //  const data = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : Array.isArray(res?.Data1) ? res.Data1 : [];
      if (!Array.isArray(data) || data.length === 0) return;
      const alwaysVisibleCols = new Set(["ProductCode", "ProductName", "ItemQty", "PurchaseRate", "Amount"]);
      setColConfig((prev) => prev.map((cfg) => {
        const saved = data.find((d) => d.column === cfg.key);
        if (!saved) {
          return alwaysVisibleCols.has(cfg.key) ? { ...cfg, visible: true } : cfg;
        }
        return {
          ...cfg,
          visible: alwaysVisibleCols.has(cfg.key) ? true : saved.Visible !== false,
          width: saved.Width,
        };
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
      Visible: c.visible, Width: Number(c.width), Comid: sess.MComid,
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
        toast("âœ… Columns Visible & Width Updated Successfully.");
      } else { toast(`âŒ ${data.message || "Save failed !!!."}`, true); }
    } catch { setLoading(false); toast("âŒ Technical Fault. Contact Software Vendor !!!.", true); }
  }, [f12Draft, sess.MComid, toast]);

  const f12SetVisible = useCallback((key, val) => {
    setF12Draft((prev) => prev.map((c) => (c.key === key ? { ...c, visible: val } : c)));
  }, []);
  const f12SetWidth = useCallback((key, val) => {
    setF12Draft((prev) => prev.map((c) => (c.key === key ? { ...c, width: Number(val) || c.width } : c)));
  }, []);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  PRODUCT APPLY / FILL
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const applyProductToRow = useCallback((rowKey, p) => {
    setGridRows((prev) => {
      const idx = prev.findIndex((r) => r._key === rowKey);
      if (idx === -1) return prev;
      let row = {
  ...prev[idx],
  Id:              p.PDId          || 0,
  ProductRefId:    p.ProductRefId||p.Id,
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
      // Expirydays > 0 à®†à®©à®¾, MfgDate (default today) à®…à®Ÿà®¿à®ªà¯à®ªà®Ÿà¯ˆà®¯à®¿à®²à¯ ExpiryDate auto-calculate
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
  applyProductToRowRef.current = applyProductToRow;

  const applyPopupSelectedProduct = useCallback(async (rowKey, item) => {
    const code = String(item?.Prod_Code || item?.PCode || item?.ProductCode || "").trim().toUpperCase();
    if (!code) {
      applyProductToRow(rowKey, item);
      return;
    }

    try {
      setLoading(true);
      const res = await CC.api(CC.ItemByCode, null, {}, {
        code,
        Comid: sess.MComid,
        CComid: sess.Comid,
        Id: 0,
        Batchwise: 0,
      });
      if (redirectIfDualLogin(res)) return;
      if (res?._netErr || res?._http404) {
        applyProductToRow(rowKey, item);
        return;
      }

      const arr =
        Array.isArray(res)        ? res :
        Array.isArray(res?.Data1) ? res.Data1 :
        Array.isArray(res?.data)  ? res.data : [];

      if (arr.length === 0) {
        applyProductToRow(rowKey, item);
        return;
      }

      const selectedId = String(item?.Id ?? item?.ProductRefId ?? "");
      const selectedBatchId = String(item?.Batchid ?? item?.BatchRefId ?? "");
      const selectedBatchNo = String(item?.BatchNo ?? item?.Bat_No ?? "").trim().toUpperCase();
      const selectedMrp = fmt2(item?.MRP ?? 0);

      const resolved = arr.find((candidate) => {
        if (selectedId && String(candidate?.Id ?? candidate?.ProductRefId ?? "") === selectedId) return true;
        if (selectedBatchId && String(candidate?.Batchid ?? candidate?.BatchRefId ?? "") === selectedBatchId) return true;
        if (selectedBatchNo && String(candidate?.BatchNo ?? candidate?.Bat_No ?? "").trim().toUpperCase() === selectedBatchNo) return true;
        if (valNum(selectedMrp) > 0 && fmt2(candidate?.MRP ?? 0) === selectedMrp) return true;
        return false;
      }) || arr[0];

      applyProductToRow(rowKey, resolved);
    } catch (err) {
      console.error(err);
      applyProductToRow(rowKey, item);
    } finally {
      setLoading(false);
    }
  }, [sess, applyProductToRow, redirectIfDualLogin]);

  const handlePurchaseProductNameCommit = useCallback(async (rowKey, rawValue) => {
    const name = String(rawValue || "").trim();
    if (!name) return false;
    const products = await loadPurchaseProducts();
    const exact = products.find((p) =>
      normalizeProductValue(p.ProductName || p.PName) === normalizeProductValue(name)
    );
    if (exact) {
      applyProductToRow(rowKey, exact);
      return true;
    }
    if (!isQuickCreateEnabled(sess.AllowQuickProductCreation)) return false;
    await startProductQuickCreate({
      rowKey,
      field: "ProductName",
      typedProductCode: "",
      typedProductName: name,
    });
    return true;
  }, [loadPurchaseProducts, applyProductToRow, sess.AllowQuickProductCreation, startProductQuickCreate]);

  const fillProductByCode = useCallback(async (code, rowKey) => {
    if (!code?.trim()) return;
    try {
      setLoading(true);
      const res = await CC.api(CC.ItemByCode, null, {}, {
        code: code.trim(), Comid: sess.MComid, CComid: sess.Comid, Id: 0, Batchwise: 0,
      });
      if (redirectIfDualLogin(res)) return;
      if (res?._netErr || res?._http404) { toast("âŒ Technical Fault. Contact Software Vendor !!!.", true); return; }
      const objPlist =
        Array.isArray(res)        ? res :
        Array.isArray(res?.Data1) ? res.Data1 :
        Array.isArray(res?.data)  ? res.data   : [];
      if (objPlist.length === 0) {
        if (!isQuickCreateEnabled(sess.AllowQuickProductCreation)) {
          toast("âŒ Invalid Product Code !!!.", true);
          return;
        }
        await startProductQuickCreate({
          rowKey,
          field: "ProductCode",
          typedProductCode: code.trim(),
          typedProductName: "",
        });
        return;
      }
      if (objPlist.length === 1) { applyProductToRow(rowKey, objPlist[0]); return; }
      setMrpPopup({ open: true, rowKey, list: objPlist });
    } catch (err) {
      console.error(err);
      toast("âŒ Product lookup failed", true);
    } finally { setLoading(false); }
  }, [sess, applyProductToRow, redirectIfDualLogin, toast, startProductQuickCreate]);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  F5 VIEW
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // const handleF5View = useCallback(async (objlist = {}) => {
  //   if (!perm.Edit) { toast("âŒ Page Edit Permission Denied !!!.", true); return; }
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
  //     if (!res.ok) { toast(`âŒ ${res.message || "Failed to load purchase list !!!."}`, true); return; }
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
  //     toast(`âŒ ${err.message || "Technical Fault. Contact Software Vendor !!!."}`, true);
  //   } finally { setLoading(false); }
  // }, [perm.Edit, purchaseDate, searchNo, sess.Comid, redirectIfDualLogin, toast]);
const handleF5View = useCallback(async (objlist = {}) => {
  if (!perm.Edit && !fromPattyPurchaseView) {
    toast("Error: Page Edit Permission Denied", true);
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
      toast(`Error: ${res.message || "Failed to load purchase list"}`, true);
      return;
    }

    console.log("API Response :", res);

    // Master & Detail
    const masterList = res.Data1 || [];
    const detailList = res.Data2 || [];

    // Merge Master + Detail
    const mergedList = masterList.map((master) => ({
      ...master,
      PurchaseDate: purchaseListDate(master),
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
    setF5DetailList(detailList); // à®µà¯‡à®£à¯à®Ÿà¯à®®à¯†à®©à¯à®±à®¾à®²à¯ à®µà¯ˆà®¤à¯à®¤à¯à®•à¯à®•à¯Šà®³à¯à®³à®²à®¾à®®à¯
    setF5TotalAmt(total.toFixed(2));
    setF5ExpandedRow(null);
    setListViewOpen(true);

  } catch (err) {
    toast(
      `Error: ${err.message || "Technical fault. Contact software vendor"}`,
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
  fromPattyPurchaseView,
]);
  const getDetailsForMaster = useCallback((masterId) =>
    f5DetailList.filter((d) => String(d.PurchaseRefId) === String(masterId)),
  [f5DetailList]);

  const toggleF5Row = useCallback((id) =>
    setF5ExpandedRow((prev) => (prev === id ? null : id)),
  []);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  CLEAR
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleClear = useCallback(() => {
    setEditId(0);
    setPurchaseDate(today()); setDueDate(today()); setInvoiceDate(today());
    setInvoiceNo(""); setInvoiceAmt("0.00"); setRemarks("");
    setPurchaseType("CREDIT"); setIgstStatus("GST"); setIgstChecked(false);
    setSupplierId(""); setSupplierInfo({ address: "", city: "", phone: "", balance: "0.00" });
    setOpeningBalance("0.00"); setPaidAmount("0.00");
    setOtherPlus("0.00"); setOtherSub("0.00");
    setTcsPercent("0.00"); setTcsAmt("0.00");
    setLoadding(""); setLorryNo("");
    setGridRows([makeGridRow()]); setGstSplit([]); setTotals({ ...EMPTY_TOTALS });
    loadMaxPurchaseNo(); setUpdateIdEdit(""); setSerialNoList([]);
    originalStockDetailsRef.current = [];
    setSupplierQuery(""); setSupplierDDOpen(false);
    // Arrival-only fields reset
    setArrivalDays(0); setDispatchedDate(today());
    setPattyVehicleNo(""); setPattyPerson(""); setPattyDate(today());
    setPurchaseMode("PURCHASE");
    setPattyRows((prev) => prev.map((r) => ({ ...r, Percentage: "0.00", BagRate: "0.00", ComAmt: "0.00" })));
    setTimeout(() => nextFocusForm(), 150);
  }, [loadMaxPurchaseNo, nextFocusForm]);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  SANITIZE DETAIL ROW
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const sanitizeDetailRow = useCallback((r, paidValue = paidAmount) => {
    const n = (v) => { const x = parseFloat(v); return isNaN(x) ? 0 : x; };
    const i = (v) => { const x = parseInt(v, 10); return isNaN(x) ? 0 : x; };
    const resolvedLotNo = (r.LotNo ?? r.Bat_No ?? "").toString().trim();
    const resolvedMark = (r.Mark ?? "").toString().trim();
    return {
       Id:i(r.PDId) ??0,
      PDId: i(r.PDId), ProductRefId: i(r.ProductRefId),
      ProductCode: r.ProductCode || "", ProductName: r.ProductName || "",
      HSNCode: r.HSNCode || "", UOM: r.UOM || "",
      UOMDecimal: i(r.UOMDecimal), UOMRefid: i(r.UOMRefid) || null,
      MRP: n(r.MRP), OldMRP: n(r.OldMRP), OldPurchaseRate: n(r.OldPurchaseRate),
      PurchaseRate: n(r.PurchaseRate), cdpercent: n(r.cdpercent), cdAmount: n(r.cdAmount),
      DiscountPercent: n(r.DiscountPercent), DiscountAmt: n(r.DiscountAmt),
      CESSPer: n(r.CESSPer), CESSAmount: n(paidValue),
      SPLCESS: n(r.SPLCESS), SPLCESSAmount: n(paidValue),
      TaxPercent: n(r.TaxPercent), TaxAmt: n(r.TaxAmt),
      CTAmount: n(r.CTAmount), STAmount: n(r.STAmount),
      CTPer: n(r.CTPer), STPer: n(r.STPer),
      Noms: i(r.Noms), NomQty: i(r.NomQty),
      ItemQty: n(r.ItemQty), FreeQty: n(r.FreeQty),
      StockQty: n(r.StockQty), StockQtyNew: n(r.StockQtyNew),
      Nstock: n(r.Nstock), RealQty: n(r.RealQty),
      TotalPcs: n(r.TotalPcs), Meter: n(r.Meter), Pcs: n(r.Pcs),
      Bags: n(r.Bags), LotNo: resolvedLotNo, Mark: resolvedMark,
      ExpiryDate: r.ExpiryDate || "", MfgDate: (r.MfgDate && r.MfgDate.trim() !== "") ? r.MfgDate : ((r.ExpiryDate && r.ExpiryDate.trim() !== "") ? CC.today() : ""),
      Bat_No: resolvedLotNo, BatchRefId: r.BatchRefId ? (parseInt(r.BatchRefId, 10) || null) : null,
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
  }, [paidAmount]);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  EDIT
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleEdit = useCallback(async (pid, pno, options = {}) => {
    const canOpenFromView = options.allowView === true || fromPattyPurchaseView;
    if (!options.allowView && (canOpenFromView ? !perm.View : !perm.Edit)) {
      toast(`âŒ Page ${canOpenFromView ? "View" : "Edit"} Permission Denied !!!.`, true);
      return;
    }
    setLoading(true);
 
    const activeMode = options.mode || purchaseMode;

     let Patty = 0;
    let SPatty = 0;
    let ptype = 0;
    if (pattyFeatureEnabled ) {
      Patty = 1;
    } 
    if (activeMode === "PATTY") {
      ptype = 2;
    }  else if (activeMode === "ARRIVAL") {
      ptype = 1;
    }

   if (activeMode === "SALESPATTY") {
      SPatty = 1;
    }
    const res = await CC.api(CC.EditPurchase, null, {patty: Patty, SalesPatty: SPatty,ptype: ptype}, { Id: pid, PNo: pno, Comid: sess.Comid, BatchwiseSizeStock: 0 });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res?._netErr || res?._http404) { toast(`Error: ${res?.message || "Edit load failed"}`, true); return; }
    const editList = Array.isArray(res) ? res : Array.isArray(res?.Data1) ? res.Data1 : Array.isArray(res?.data) ? res.data : [];
    if (editList.length > 0) {
      const pm = editList[0];
      const pd = pm.PurchaseDetails || [];
      const igst = pm.IGSTBill;

      // â”€â”€ FIX: if the saved purchase's IGSTBill is missing/blank/0, â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // fall back to the supplier master's current IGST setting instead of
      // silently defaulting to "GST".
      let isIgst;
      if (igst === "IGST" || igst === "1" || igst === 1 || igst === "2" || igst === 2) {
        isIgst = true;
      } else {
        // ambiguous / null / undefined / "" â€” look up supplier
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
      originalStockDetailsRef.current = Array.isArray(pm.StockDetails) ? pm.StockDetails : [];
      setPurchaseDate(jsonDate(pm.PurchaseDate)); setDueDate(jsonDate(pm.DueDate));
      setInvoiceDate(jsonDate(pm.PurchaseDate || pm.SupplierInvoiceDate));
      setPurchaseNo(pm.PurchaseNo || ""); setInvoiceNo(pm.SupplierInvoiceNo || pm.PurchaseNo || "");
      setInvoiceAmt(fmt2(pm.NetAmt)); setOtherPlus(fmt2(pm.Others_A)); setOtherSub(fmt2(pm.Others_D));
      setRemarks(pm.Remarks || "");
      setPurchaseType(pm.PurchaseType === "CA" ? "CASH" : "CREDIT");
      setSupplierId(String(pm.SupplierRefId));
      handleSupplierChange(String(pm.SupplierRefId), { skipIgst: true, preserveOpeningBalance: true });
      setOpeningBalance(fmt2(pm.CESSAmount || 0));
      setPaidAmount(fmt2(pm.SPLCESSAmount || 0));
      setIgstStatus(newIgstStatus);
      setIgstChecked(isIgst);
      setSerialNoList(pm.SerialNoDetails || []);

      // â”€â”€ Restore purchaseMode from the saved bill (mirrors clsfunction.Patty / SalesPatty / PattyStatus) â”€â”€
    const savedPattyFlag    = Number(pm.PattyStatus);
const savedSalesPattyFlag = pm.SalesPatty === 1 || pm.SalesPatty === "1";
const savedArrivalType    = pm.PurchaseType === "AR" || savedPattyFlag === 1;

setPurchaseMode("PURCHASE");

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

  // à®®à¯à®¤à®²à®¿à®²à¯ à®®à¯à®´à¯ Patty list-à® load à®ªà®£à¯à®£à¯ (COMMISSION, COOLY, LORRY FREIGHT, SUNGAM...)
  try {
    const res = await CC.api(CC.PattySelect, null, {}, { Comid: sess.MComid });
    const fullList = Array.isArray(res) ? res : (res?.data ?? res?.Data1 ?? []);
    const baseList = (fullList && fullList.length > 0) ? fullList : PATTY_ROW_TEMPLATE;

    // Full list-à®²à¯ à®’à®µà¯à®µà¯Šà®°à¯ row-à®•à¯à®•à¯à®®à¯, saved data à®‡à®°à¯à®¨à¯à®¤à®¾à®²à¯ à®…à®¤à¯ˆ merge à®ªà®£à¯à®£à¯
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
        LotNo:   r.LotNo || r.Bat_No || "",
        Bat_No:  r.Bat_No || r.LotNo || "",
        Mark:    r.Mark || "",
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
      toast(`Error: ${res?.message || "Edit load failed"}`, true);
    }
  }, [perm, sess, taxMode, supplierList, handleSupplierChange, toast, redirectIfDualLogin, nextFocusForm, purchaseMode, pattyFeatureEnabled, fromPattyPurchaseView]);

  useEffect(() => {
    const req = location.state?.pattyPurchaseOpen;
    if (!req?.id || !req?.requestKey) return;
    if (externalOpenRef.current === req.requestKey) return;

    externalOpenRef.current = req.requestKey;
    const nextMode = "PURCHASE";
    setPurchaseMode("PURCHASE");

    setTimeout(() => {
      handleEdit(req.id, req.pno || 0, { mode: nextMode, allowView: true });
    }, 0);

    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate, handleEdit]);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  DELETE
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleDelete = useCallback(async (overrideId, overridePno, overrideUpdateId) => {
    const targetId       = overrideId  || editId;
    const displayPno     = overridePno || purchaseNo;
    const targetUpdateId = "";

    if (!perm.Delete) { toast("âŒ Page Delete Permission Denied !!!.", true); return; }
    if (!targetId)    { toast("âŒ No Delete Id !!!.", true); return; }

    const ok = await confirm(`Do You Want To Delete Purchase Master. This is Purchase No ${displayPno}?`);
    if (!ok) return;

    // â”€â”€ Step 1: Fetch the purchase detail first (mirrors SaleEditUrl fetch in handleF5Delete)
    // so we always have the original stock rows even when deleting from F5 list
    // without having loaded the record into the form first.
    setLoading(true);
    let stockDetails = Array.isArray(originalStockDetailsRef.current)
      ? [...originalStockDetailsRef.current]
      : [];
    let deleteAmountHeaders = {
      SupplierRefId: String(supplierId || ""),
      NetAmt: String(valNum(billAmountValue)),
      BillAmount: String(valNum(billAmountValue)),
      PaidAmount: String(valNum(paidAmount)),
      AdvanceAmt: String(valNum(paidAmount)),
      SPLCESSAmount: String(valNum(paidAmount)),
      CESSAmount: String(valNum(openingBalance)),
      OpeningBal: String(valNum(openingBalance)),
      ClosingBalance: String(valNum(closingBalanceValue)),
    };

    try {
      const editRes = await CC.api(CC.EditPurchase, null, {}, {
        Id: targetId, PNo: displayPno, Comid: sess.Comid, BatchwiseSizeStock: 0,
      });
      if (redirectIfDualLogin(editRes)) return;

      const editList = Array.isArray(editRes)
        ? editRes
        : Array.isArray(editRes?.Data1)
          ? editRes.Data1
          : Array.isArray(editRes?.data)
            ? editRes.data
            : [];

      if (editList.length > 0) {
        const pm = editList[0];
        if (Array.isArray(pm.StockDetails) && pm.StockDetails.length > 0) {
          stockDetails = pm.StockDetails;
        }
        deleteAmountHeaders = {
          SupplierRefId: String(pm.SupplierRefId || supplierId || ""),
          NetAmt: String(valNum(pm.NetAmt ?? billAmountValue)),
          BillAmount: String(valNum(pm.BillAmount ?? pm.NetAmt ?? billAmountValue)),
          PaidAmount: String(valNum(pm.SPLCESSAmount ?? pm.AdvanceAmt ?? paidAmount)),
          AdvanceAmt: String(valNum(pm.AdvanceAmt ?? pm.SPLCESSAmount ?? paidAmount)),
          SPLCESSAmount: String(valNum(pm.SPLCESSAmount ?? pm.AdvanceAmt ?? paidAmount)),
          CESSAmount: String(valNum(pm.CESSAmount ?? pm.OpeningBal ?? openingBalance)),
          OpeningBal: String(valNum(pm.OpeningBal ?? pm.CESSAmount ?? openingBalance)),
          ClosingBalance: String(valNum(pm.ClosingBalance ?? closingBalanceValue)),
        };

        // â”€â”€ Build StockDetails from fetched detail rows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Mirrors the edit-case stockDetails logic in handleSave
      }
    } catch (err) {
      console.error("Stock fetch before delete failed:", err);
      // Continue with empty stockDetails rather than blocking the delete
    }

    // â”€â”€ Step 2: Delete with StockDetails â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const res = await CC.api(CC.DeletePurchase, stockDetails, {  // â† pass as body, not params
      Comid:       String(sess.Comid),
      Id:          String(targetId),
      MirrorTable: "0",
      Updateid:    targetUpdateId || "",
      LocalDB:     "0",
      DayClose:    sess.DayClose ? "1" : "0",
      ...deleteAmountHeaders,
    }, null);

    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res._netErr) { toast(`âŒ ${res.message}`, true); return; }

    if (res.ok) {
      toast("âœ… " + (res.message || "Purchase deleted successfully!"));
      handleClear();
      if (listViewOpen) handleF5View({});
    } else {
      if (res.redis === false) { alert("Already Login Another User Please Login Again!!!"); navigate("/"); return; }
      toast(`âŒ ${res.message || "Delete failed !!!."}`, true);
    }
  }, [perm, editId, purchaseNo, updateIdEdit, sess, confirm, toast,
      redirectIfDualLogin, handleClear, listViewOpen, handleF5View, navigate,
      supplierId, billAmountValue, paidAmount, openingBalance, closingBalanceValue]);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  EDIT PASSWORD
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  F2 FREE PRODUCT
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleF2FreeProduct = useCallback(async () => {
    if (!selectedCell.rowKey) { toast("âŒ Invalid Check It !!!.", true); return; }
    const row = gridRows.find((r) => r._key === selectedCell.rowKey);
    if (!row) return;
    if (!row.ProductRefId) toast("âŒ Invalid Check It !!!.", true);
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  GRID KEYBOARD
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
          if (expiry <= new Date()) { toast("âŒ Already This Product Was Expired !!!.", true); return; }
          const expDate = expiry.toISOString().split("T")[0];
          setGridRows((prev) => prev.map((r) => r._key === rowKey ? { ...r, ExpiryDate: expDate } : r));
        }
      }

      if (colKey === "ExpiryDate") {
        const row = gridRows[rowIdx];
        if (row.ExpiryDate && new Date(row.ExpiryDate) <= new Date()) {
          toast("âŒ Already This Product Was Expired !!!.", true); return;
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  SAVE
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    if (!perm.Add) { toast("Page Add Permission Denied !!!.", true); return; }
    if (!supplierId) { toast("Select Valid Supplier !!!.", true); supplierRef.current?.focus(); return; }
    if (valNum(finalNetAmt) <= 0) { toast("Net Total must not be Negative !!!.", true); return; }
    if (valNum(paidAmount) < 0) { toast("Paid Amount must not be Negative !!!.", true); return; }

    const mainSet = JSON.parse(localStorage.getItem("Mainsetting") || "[{}]");
    const batchWiseStock = mainSet?.[0]?.BatchWiseStock ?? false;
    const textileSerial = mainSet?.[0]?.TextilesSerialNowiseBilling ?? false;
    if (batchWiseStock || textileSerial) {
      const dataRows = gridRows.filter((r) => r.ProductCode !== "");
      if (textileSerial) {
        for (const r of dataRows) {
          if (valNum(r.SerialNoStatus) === 1) {
            const serials = serialNoList.filter((s) => s.IndexRefId === r.TextRefId);
            if (serials.length === 0) { toast(`Enter Serial Numbers for item: ${r.ProductName || r.ProductCode} !!!.`, true); return; }
            if (serials.length !== valNum(r.ItemQty)) {
              toast(`Serial No count (${serials.length}) must equal Quantity (${r.ItemQty}) for ${r.ProductName || r.ProductCode} !!!.`, true); return;
            }
          }
        }
      }
    }

    const ok = await confirm("Wish to Save Purchase Details ?");
    if (!ok) return;

    setLoading(true);
    const supplier = supplierList.find((s) => String(s.Id) === String(supplierId)) || {};
    const purchaseDetails = gridRows.filter((r) => r.ProductCode !== "").map(sanitizeDetailRow);
    const purtype = purchaseType === "CASH" ? "CA" : "CR";
    const stockDetails = editId > 0
      ? (Array.isArray(originalStockDetailsRef.current) ? originalStockDetailsRef.current : [])
      : [];

    const purchasePattyDetails = (Array.isArray(pattyRows) ? pattyRows : [])
      .map((row) => {
        const percentageAmount = valNum(row.ComAmt || computePattyRowAmt(row));
        return {
          PattyMasterRefId: parseInt(row.Id, 10) || 0,
          Percentage: valNum(row.Percentage),
          Name: row.PattyName || "",
          PercentageAmount: percentageAmount,
        };
      })
      .filter((row) => row.PercentageAmount !== 0);

    const purchaseMaster = [{
      Id: editId,
      Modified_By: parseInt(localStorage.getItem("userid") || "0", 10),
      SupplierRefId: parseInt(supplierId, 10) || 0,
      PurchaseNo: purchaseNo,
      CompanyRefId: parseInt(sess.Comid, 10) || 0,
      PurchaseDate: purchaseDate,
      PurchaseType: purtype,
      IGSTBill: igstStatus,
      taxamount: valNum(totals.gstAmt),
      CTAmount: valNum(totals.cgstAmt),
      STAmount: valNum(totals.sgstAmt),
      SupplierInvoiceNo: effectiveInvoiceNo,
      SupplierInvoiceDate: purchaseDate,
      NetAmt: valNum(finalNetAmt),
      discamount: valNum(totals.discAmt),
      cdamount: valNum(totals.cdAmt),
      Others_A: valNum(otherPlus),
      Others_D: valNum(otherSub),
      DueDate: dueDate,
      DisplayAmount: 0,
      FreightCharges: valNum(totals.transAmt),
      CESSAmount: valNum(openingBalance),
      SPLCESSAmount: valNum(paidAmount),
      Remarks: remarks,
      UpdateId: updateIdEdit || "",
      Credit: 0,
      Debit: valNum(finalNetAmt),
      IGSTAmount: 0,
      SupplierName: supplier.AccountName || "",
      Address1: supplier.Address1 || "",
      Address2: supplier.Address2 || "",
      City: supplier.City || "",
      Phone: supplier.MobileNo || "",
      Tin: supplier.GSTNo || "",
      Email: supplier.Email || "",
      PaymentRefId: null,
      PoRefId: null,
      MultiPurchaseOrderMasterRefid: 0,
      PurchaseDetails: purchaseDetails,
      StockDetails: stockDetails,
      SerialNoDetails: serialNoList,
      PattyStatus: 3,
      SalesPatty: 0,
      PattyAmount: 0,
      PurchasePattyDetails: purchasePattyDetails,
      VehicleNo: "",
      Person: "",
      OpeningBal: valNum(openingBalance),
      BillAmount: valNum(billAmountValue),
      AdvanceAmt: valNum(paidAmount),
      ClosingBalance: valNum(closingBalanceValue),
    }];

    const res = await CC.insertapi(CC.InsertPurchase, purchaseMaster, {
      Comid: String(sess.Comid),
      ApiType: "1",
      MirrorTable: String(sess.MirrorTable ?? "0"),
      batchstockstatus: (() => {
        const ms = JSON.parse(localStorage.getItem("Mainsetting") || "[{}]");
        return (ms?.[0]?.BatchWiseStock === true || ms?.[0]?.TextilesSerialNowiseBilling === true) ? "1" : "0";
      })(),
      ItemMasterRateUpdate: String(sess.PurchaseItemmasterSave ?? false),
      Commoncompany: String(sess.Commoncompany ?? false),
      CommoncompanyDiffStock: String(sess.CommoncompanyDiffStock ?? false),
      SupplierMulitipleAllow: String(sess.SupplierMulitipleAllow ?? false),
      MulipleMRP: String(sess.MulipleMRP ?? false),
      BatchPerfix: String(sess.BatchPerfix ?? ""),
      BatchDigit: String(parseInt(sess.BatchDigit, 10) || 0),
      LocalDB: "0",
      Patty: String(sess.CMBTPatty ?? "0"),
      DayClose: "0",
      PrintA4Invoice: String(sess.SaveDislogPurchase ?? 1),
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res.ok || res.IsSuccess) {
      toast((res.message || "Purchase saved successfully!"));
      const cacheKey = res.Data15 || "";
      if (cacheKey) {
        setPrintDialog({
          billNo: res.BillNo || res.Data2 || purchaseNo,
          netAmt: Math.round(valNum(finalNetAmt)),
          cacheKey,
        });
      }
      handleClear();
    } else {
      toast(`${res.message || "Save failed !!!."}`, true);
    }
  }, [
    perm, supplierId, finalNetAmt, paidAmount, gridRows, purchaseType, editId, updateIdEdit,
    purchaseNo, sess, purchaseDate, dueDate, igstStatus, totals, otherPlus, otherSub,
    remarks, supplierList, serialNoList, confirm, toast, redirectIfDualLogin, handleClear,
    sanitizeDetailRow, effectiveInvoiceNo, printSess, openingBalance, billAmountValue, closingBalanceValue,
  ]);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  GLOBAL KEYBOARD SHORTCUTS
  // FIX 3: added handleFocusFormColOpen + focusFormColOpen to deps and guard
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const onKey = (e) => {
      // FIX 3a: added focusFormColOpen to the popup-open guard
     if (productPopup.open || f12Open || listViewOpen || focusColOpen || focusFormColOpen || serialNoPopup.open || f3PromptOpen) return;

      if (e.keyCode === 112) { e.preventDefault(); handleSave(); }           // F1
      if (e.keyCode === 113) { e.preventDefault(); handleF2FreeProduct(); }  // F2
      if (e.keyCode === 114) {                                                // F3 â€” Edit by Purchase No
        e.preventDefault();
        if (!perm.Edit) { toast("âŒ Page Edit Permission Denied !!!.", true); return; }
        openEditPassword({ type: "F3_PROMPT" });
      }
      if (e.keyCode === 115) { e.preventDefault(); handleDelete(); }         // F4
      if (e.keyCode === 116) { e.preventDefault(); handleF5View({}); }       // F5
      if (e.keyCode === 120) {                                                // F9
        e.preventDefault();
        if (!perm.Delete) { toast("âŒ Page Delete Permission Denied !!!.", true); return; }
        if (!editId) { toast("âŒ No Delete Id !!!.", true); return; }
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  RENDER CELL
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderCell = useCallback((row, col) => {
    const isSelected = selectedCell.rowKey === row._key && selectedCell.colKey === col.key;
    const cellId     = `cell_${row._key}_${col.key}`;
    // FIX 8: mirror the legacy jQuery "editedRow" cellclass â€” free-product rows
    // (FreeQtyStatus === 1) get a soft green tint on every cell in the row.
    const isFreeRow  = valNum(row.FreeQtyStatus) === 1;

    if (!col.editable) {
      return (
        <td key={col.key} className={`grid-cell readonly ${col.align === "right" ? "right" : ""} ${isFreeRow ? "free-product-row" : ""}`}
          style={isFreeRow ? { background: "var(--clr-success-bg)" } : undefined}>
          {row[col.key] ?? ""}
        </td>
      );
    }

    const onFocus = (e) => {
      e.target.select?.();
      setSelectedCell({ rowKey: row._key, colKey: col.key });
    };

    // ItemQty â€” Serial-No-wise billing lock (mirrors jQuery cellbeginedit block on grdItemQty
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
            style={isFreeRow ? { background: "var(--clr-success-bg)" } : undefined}>
            <input
              id={cellId}
              className="cell-input right"
              style={{ width: "100%", cursor: "pointer", background: isFreeRow ? "var(--clr-success-bg)" : "var(--clr-bg-soft)" }}
              value={row[col.key] ?? ""}
              readOnly
              title="Serial No item â€” click to enter Serial Numbers"
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

    // Bat_No â€” red border when required but empty
    if (col.key === "Bat_No") {
      const needsBatch = valNum(row.BatchStatus) === 1 && !row.Bat_No?.trim();
      return (
        <td key={col.key} className={`grid-cell editable ${isSelected ? "selected" : ""} ${isFreeRow ? "free-product-row" : ""}`}
          style={isFreeRow ? { background: "var(--clr-success-bg)" } : undefined}>
          <input id={cellId} type="text" className="cell-input" value={row[col.key] ?? ""}
            onChange={(e) => handleCellChange(row._key, col.key, e.target.value)}
            onFocus={onFocus} onKeyDown={(e) => handleGridKeyDown(e, row._key, col.key)} tabIndex={0}
            style={needsBatch ? { borderBottom: "2px solid var(--clr-danger)", background: "var(--clr-danger-bg)" } : (isFreeRow ? { background: "var(--clr-success-bg)" } : {})}
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
            style={isFreeRow ? { background: "var(--clr-success-bg)" } : undefined}>
            <input id={cellId} className="cell-input" style={{ width: "100%", cursor: "pointer", background: isFreeRow ? "var(--clr-success-bg)" : "var(--clr-bg-white)" }} value={dispText} readOnly
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
          style={isFreeRow ? { background: "var(--clr-success-bg)" } : undefined}>
          <select id={cellId} className="cell-input" style={{ width: "100%", background: isFreeRow ? "var(--clr-success-bg)" : undefined }} value={row[col.key] ?? ""}
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

    if (col.key === "ProductName") {
      return (
        <td key={col.key} className={`grid-cell editable ${isSelected ? "selected" : ""} ${isFreeRow ? "free-product-row" : ""}`}
          style={isFreeRow ? { background: "var(--clr-success-bg)" } : undefined}>
          <input
            id={cellId}
            type="text"
            className="cell-input"
            style={isFreeRow ? { background: "var(--clr-success-bg)" } : undefined}
            value={row[col.key] ?? ""}
            onChange={(e) => handleCellChange(row._key, col.key, e.target.value)}
            onFocus={onFocus}
            onBlur={(e) => {
              void handlePurchaseProductNameCommit(row._key, e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Tab") {
                const typedName = String(e.currentTarget.value || "").trim();
                if (typedName && !row.ProductRefId) {
                  e.preventDefault();
                  void handlePurchaseProductNameCommit(row._key, typedName);
                  return;
                }
              }
              handleGridKeyDown(e, row._key, col.key);
            }}
            tabIndex={0}
          />
        </td>
      );
    }

    // Default: text / date / number
    return (
      <td key={col.key} className={`grid-cell editable ${isSelected ? "selected" : ""} ${col.align === "right" ? "right" : ""} ${isFreeRow ? "free-product-row" : ""}`}
        style={isFreeRow ? { background: "var(--clr-success-bg)" } : undefined}>
        <input id={cellId} type={col.type === "date" ? "date" : "text"}
          className={`cell-input ${col.align === "right" ? "right" : ""}`}
          style={isFreeRow ? { background: "var(--clr-success-bg)" } : undefined}
          value={row[col.key] ?? ""}
          onChange={(e) => handleCellChange(row._key, col.key, e.target.value)}
          onFocus={onFocus} onKeyDown={(e) => handleGridKeyDown(e, row._key, col.key)} tabIndex={0}
        />
      </td>
    );
  }, [selectedCell, handleCellChange, handleGridKeyDown, bStatus, sStatus, cStatus, mStatus, brandList, modelList, colorList, sizeList, serialNoList, handlePurchaseProductNameCommit]);

  if (!isAuthorized) return null;

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  RENDER
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="pur-root">
      {ConfirmUI}

      {/* â”€â”€ A4 PRINT/VIEW DIALOG (CacheKey-based, mirrors SaleBill.jsx) â”€â”€ */}
      {printDialog && (
        <PurchasePrintChoiceDialog
          onPrint={async () => {
            setPrintDialog(null);
            const noOfBills = parseInt(printSess.No_Of_Bills, 10) || 1;
            for (let i = 0; i < noOfBills; i++) {
              const copy = i === 0 ? "Original" : i === 1 ? "Duplicate Copy" : "Triplicate Copy";
              openReportViewer(true, copy, printDialog.cacheKey);
              await new Promise((r) => setTimeout(r, 500));
            }
          }}
          onView={() => {
            setPrintDialog(null);
            openReportViewer(false, "Original", printDialog.cacheKey);
          }}
          onSkip={() => setPrintDialog(null)}
        />
      )}

      {/* â”€â”€ Ctrl+F Form Focus Columns Modal â”€â”€ */}
      {focusFormColOpen && (
        <div className="popup-overlay">
          <div className="popup-window f12-popup" style={{ width: 480, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <div className="popup-header">
              <span>Form Columns Reorder &amp; Focus (Ctrl+F)</span>
              <button className="popup-close" onClick={() => setFocusFormColOpen(false)}><X size={16} strokeWidth={2.5} /></button>
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
                      style={{ background: focusFormDragIdx === idx ? "var(--clr-bg-row-hover)" : "transparent", cursor: "grab" }}>
                      <td style={{ textAlign: "center", fontWeight: 600 }}>{idx + 1}</td>
                      <td>{d.label}</td>
                      <td style={{ textAlign: "center" }}>
                        <input type="checkbox" checked={!!d.Focus}
                          onChange={() => handleFocusFormToggle(idx, !d.Focus)}
                          style={{ width: 14, height: 14, accentColor: "var(--clr-primary)" }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="popup-footer">
              <button className="btn btn-primary btn-sm" onClick={handleFocusFormColSave} disabled={loading}><Save size={14} strokeWidth={2.4} /> Save</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setFocusFormColOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <Topbar />

      {/* â”€â”€ Product Lookup Popup â”€â”€ */}
      {productPopup.open && (
        <ProductPopup productPopup={productPopup} setProductPopup={setProductPopup}
          applyProductToRow={applyPopupSelectedProduct} sess={sess} setLoading={setLoading}
          products={purchaseProducts}
          loadProducts={loadPurchaseProducts}
          allowQuickCreate={isQuickCreateEnabled(sess.AllowQuickProductCreation)}
          onCreateProduct={(value) => startProductQuickCreate({
            rowKey: productPopup.rowKey,
            field: "ProductName",
            typedProductCode: "",
            typedProductName: value,
          })} />
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

      {/* â”€â”€ MRP Selection Popup â”€â”€ */}
      {mrpPopup.open && (
        <MRPSelectionPopup mrpPopup={mrpPopup} setMrpPopup={setMrpPopup} applyProductToRow={applyProductToRow} />
      )}

      {/* â”€â”€ Serial Number Popup â”€â”€ */}
      {serialNoPopup.open && (
        <SerialNoPopup serialNoPopup={serialNoPopup} setSerialNoPopup={setSerialNoPopup}
          serialNoList={serialNoList} setSerialNoList={setSerialNoList} setGridRows={setGridRows} gridRows={gridRows} calcRow={calcRow} />
      )}

      {/* â”€â”€ F12 Column Config â”€â”€ */}
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
              }}><X size={16} strokeWidth={2.5} /></button>
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
              <button className="btn btn-primary btn-sm" onClick={handleF12Save} disabled={loading}><Save size={14} strokeWidth={2.4} /> Save</button>
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

      {/* â”€â”€ F3: Purchase No Prompt Modal â”€â”€ */}
      {f3PromptOpen && (
        <div style={{ position: "fixed", inset: 0, background: "var(--clr-modal-overlay)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
          <div style={{ background: "var(--clr-bg-white)", borderRadius: 10, padding: "22px 28px 18px", minWidth: 260, maxWidth: 320, boxShadow: "0 8px 32px var(--clr-shadow-box)", border: "1px solid var(--clr-border-default)", textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: "var(--clr-text-primary)" }}>Edit {modeLabels.no} (F3)</div>
            <div style={{ fontSize: 12, color: "var(--clr-text-muted)", marginBottom: 8, textAlign: "left" }}>Enter the {modeLabels.no}</div>
            <input
              ref={f3InputRef}
              type="text"
              style={{ width: "100%", padding: "7px 10px", border: "1px solid var(--clr-border-default)", borderRadius: 6, fontSize: 14, outline: "none", boxSizing: "border-box" }}
              value={f3PromptValue}
              onChange={(e) => { setF3PromptValue(e.target.value); setF3PromptError(""); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleF3PromptSubmit(); }
                if (e.key === "Escape") { setF3PromptOpen(false); }
              }}
              placeholder="e.g. 1024"
            />
            {f3PromptError && <div style={{ color: "var(--clr-danger-dark)", fontSize: 12, marginTop: 6 }}>{f3PromptError}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "center" }}>
              <button
                style={{ padding: "7px 22px", borderRadius: 6, border: "none", background: "linear-gradient(135deg,var(--clr-primary),var(--clr-primary-hover))", color: "var(--clr-text-white)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                onClick={handleF3PromptSubmit}
                disabled={!f3PromptValue.trim()}
              >
                OK
              </button>
              <button
                style={{ padding: "7px 22px", borderRadius: 6, border: "1px solid var(--clr-border-default)", background: "var(--clr-bg-soft)", color: "var(--clr-text-muted)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                onClick={() => setF3PromptOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€ F5 List View â”€â”€ */}
     
      {listViewOpen && (
        <div className="popup-overlay">
          <div className="popup-window f5-popup f5-modal-box">
            <div className="popup-header">
              <span>Purchase List View (F5)</span>
              <button className="popup-close" onClick={() => { setListViewOpen(false); setF5MasterList([]); setF5DetailList([]); setF5SupplierId(""); setFromDate(today()); setToDate(today()); }}><X size={16} strokeWidth={2.5} /></button>
            </div>
            <div className="f5-filter-panel">
              <div className="f5-filter-grid">
                <label>From Date</label>
                {/* <input type="date" className="form-ctrl" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                 */}
                 

<div
  onKeyDown={(e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      nextFocusForm("fromdate");
    }
  }}
>
  <DateFieldDDMMYYYY
    id="fromdate"
    value={fromDate}
    onChange={setFromDate}
    disabled={false}
  />
</div>
                {/* <label>To Date</label>
                <input type="date" className="form-ctrl" value={toDate} onChange={(e) => setToDate(e.target.value)} /> */}
   <label>To Date</label>

<div
  onKeyDown={(e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      nextFocusForm("todate");
    }
  }}
>
  <DateFieldDDMMYYYY
    id="todate"
    value={toDate}
    onChange={setToDate}
    disabled={false}
  />
</div>           
              
                <div className="f5-supplier-wrap">
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
                    <div className="f5-supplier-dropdown">
                      {supplierList.filter(s => !f5SupplierSearch || s.AccountName.toLowerCase().includes(f5SupplierSearch.trim().toLowerCase())).map((s, idx) => (
                        <div key={s.Id} className={`f5-supplier-option${idx === f5SupplierHi ? " hilite" : ""}`}
                          onMouseEnter={() => setF5SupplierHi(idx)}
                          onClick={() => { setF5SupplierId(String(s.Id)); setF5SupplierSearch(s.AccountName); setF5SupplierOpen(false); }}>
                          {s.AccountName}
                        </div>
                      ))}
                      {supplierList.filter(s => !f5SupplierSearch || s.AccountName.toLowerCase().includes(f5SupplierSearch.trim().toLowerCase())).length === 0 && (
                        <div className="f5-supplier-empty">No suppliers found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="f5-filter-row">
                <label className="f5-label-w90">Search No</label>
                <input className="form-ctrl f5-input-w140" value={searchNo} onChange={(e) => setSearchNo(e.target.value)} />
                <button className="tbtn tbtn-save" onClick={() => handleF5View({ fromdate: fromDate, todate: toDate, supplierid: f5SupplierId })}>View</button>
                <div className="f5-total">Total Amt : {f5TotalAmt}</div>
              </div>
            </div>
            <div className="popup-body f5-modal-body">
              <table className="view-grid f5-table">
                <thead>
                  <tr><th className="f5-th-toggle" /><th>Purchase No</th><th>Date</th><th>Type</th><th>Supplier</th><th className="right">Net Amount</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {f5MasterList.length === 0 && (
                    <tr><td colSpan={7} className="no-data f5-no-data">No records found. Enter a search term and press Search.</td></tr>
                  )}
                  {f5MasterList.map((m) => {
                    const isExpanded = f5ExpandedRow === m.Id;
                    const rowDetails = getDetailsForMaster(m.Id);
                    return (
                      <React.Fragment key={m.Id}>
                        <tr className={`view-row f5-row${isExpanded ? " expanded" : ""}`}>
                          <td className="f5-toggle-cell" onClick={() => toggleF5Row(m.Id)} title={isExpanded ? "Collapse" : "Expand"}>{isExpanded ? <ChevronDown size={15} strokeWidth={2.5} /> : <ChevronRight size={15} strokeWidth={2.5} />}</td>
                          <td>{m.PurNo}</td>
                          <td>{purchaseListDate(m)}</td>
                          <td><span className={`badge ${m.PurchaseType === "CA" ? "badge-cash" : "badge-credit"}`}>{m.PurchaseType === "CA" ? "Cash" : "Credit"}</span></td>
                          <td>{m.SupName}</td>
                          <td className="right">{fmt2(m.NetAmt)}</td>
                          <td>
                            <button className="tbtn-sm edit" onClick={() => { if (!perm.Edit) { toast("Edit Permission Denied", true); return; } openEditPassword({ type: "EDIT", id: m.Id, pno: m.PurchaseNo }); }}><Pencil size={14} strokeWidth={2.3} /> Edit</button>
                            <button className="tbtn-sm delete" onClick={() => { if (!perm.Delete) { toast("Delete Permission Denied", true); return; } openEditPassword({ type: "DELETE", id: m.Id, updateId: m.UpdateId || "", pno: m.PurchaseNo }); }}><Trash2 size={14} strokeWidth={2.3} /> Del</button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`d_${m.Id}`}>
                            <td colSpan={7} className="f5-detail-cell">
                              {rowDetails.length === 0 ? (
                                <span className="f5-detail-empty">No product details found.</span>
                              ) : (
                                <table className="view-grid nested-grid f5-detail-table">
                                  <thead>
                                    <tr className="f5-detail-header-row">
                                      <th className="f5-detail-col-code">Code</th><th className="f5-detail-col-desc">Description</th>
                                      <th className="right f5-detail-col-mrp">MRP</th><th className="right f5-detail-col-rate">Pur. Rate</th>
                                      <th className="right f5-detail-col-qty">Qty</th><th className="right f5-detail-col-gst">GST(%)</th>
                                      <th className="right f5-detail-col-gstamt">GST Amt</th><th className="right f5-detail-col-disc">Disc(%)</th>
                                      <th className="right f5-detail-col-discamt">Disc Amt</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {rowDetails.map((d, idx) => (
                                      <tr key={`${m.Id}_detail_${idx}`} className={`view-row f5-detail-row${idx % 2 !== 0 ? " odd" : ""}`}>
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

      {/* Purchase Master */}
      <div className="pur-master pur-master-simple">
        <div className="pur-top-card pur-top-left">
          <div className="pur-top-title">{modeLabels.title}</div>
          <div className="field-group">
            <label>{modeLabels.no}</label>
            <input className="form-ctrl disabled" value={purchaseNo} readOnly />
          </div>
          <div className="pur-date-row">
            <div className="field-group">
              <label>{modeLabels.date}<span className="req">*</span></label>
              <div
                ref={purchaseDateRef}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    nextFocusForm("dtppurchasedate");
                  }
                }}
              >
                <DateFieldDDMMYYYY id="dtppurchasedate" value={purchaseDate} onChange={setPurchaseDate} disabled={false} />
              </div>
            </div>
            <div className="field-group pur-days-field">
              <label>Days</label>
              <input className="form-ctrl disabled" value={creditDays || 0} readOnly />
            </div>
          </div>
          <div className="field-group">
            <label>{modeLabels.type}</label>
            <select
              ref={purchaseTypeRef}
              className="form-ctrl"
              value={purchaseType}
              onChange={(e) => setPurchaseType(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  nextFocusForm("cmbpurchaseType");
                }
              }}
            >
              <option value="CREDIT">CREDIT</option>
              <option value="CASH">CASH</option>
            </select>
          </div>
        </div>

        <div className="pur-top-card pur-top-middle">
          <div className="pur-top-title">Supplier Details</div>
          <div className="field-group wide" ref={supplierContainerRef} style={{ position: "relative" }}>
            <label>Supplier <span className="req">*</span></label>
            <input
              ref={supplierRef}
              className="form-ctrl"
              value={supplierQuery}
              onChange={(e) => handleSupplierInputChange(e.target.value)}
              onFocus={() => { openSupplierDropdown(); }}
              onClick={() => { if (!supplierDDOpen) openSupplierDropdown(); }}
              onKeyDown={supplierInputKeyDown}
              onBlur={() => setTimeout(() => {
                setSupplierDDOpen(false);
                if (!supplierId && supplierQuery.trim()) {
                  const exact = supplierList.find((s) => (s.AccountName || "").trim().toLowerCase() === supplierQuery.trim().toLowerCase());
                  if (exact) confirmSupplierSelection(exact);
                }
              }, 180)}
              placeholder="Select SupplierName"
              autoComplete="off"
            />
            {supplierDDOpen && (
              <div style={{ position: "absolute", zIndex: 9000, top: "100%", left: 0, right: 0, background: "var(--clr-bg-white)", border: "1px solid var(--clr-border-default)", borderRadius: "0 0 6px 6px", boxShadow: "0 4px 16px var(--clr-shadow-toast)", maxHeight: 220, overflowY: "auto" }}>
                {supplierDropdown.map((s, i) => (
                  <div
                    key={s.Id}
                    onMouseDown={() => confirmSupplierSelection(s)}
                    style={{ padding: "6px 10px", cursor: "pointer", fontSize: 13, background: i === supplierSelIdx ? "var(--clr-bg-row-hover)" : "var(--clr-bg-white)", borderBottom: "1px solid var(--clr-bg-soft)", fontWeight: i === supplierSelIdx ? 600 : 400 }}
                  >
                    {s.AccountName}
                  </div>
                ))}
                {supplierCreateVisible && (
                  <div
                    onMouseDown={() => { void startSupplierQuickCreate(supplierQuery); }}
                    style={{ padding: "6px 10px", cursor: "pointer", fontSize: 13, background: supplierSelIdx === supplierDropdown.length ? "var(--clr-bg-row-hover)" : "var(--clr-bg-white)", borderBottom: "1px solid var(--clr-bg-soft)", fontWeight: 700, color: "var(--clr-primary, #1f65de)" }}
                  >
                    + Create New Supplier: {supplierQuery.trim()}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="pur-supplier-fields">
            <div className="field-group">
              <label>Address</label>
              <input className="form-ctrl disabled" value={supplierInfo.address || ""} readOnly />
            </div>
            <div className="field-group">
              <label>City</label>
              <input className="form-ctrl disabled" value={supplierInfo.city || ""} readOnly />
            </div>
            <div className="field-group">
              <label>ContactNo</label>
              <input className="form-ctrl disabled" value={supplierInfo.phone || ""} readOnly />
            </div>
          </div>
          <div className="pur-current-bal-line">
            <span>Current Bal</span>
            <strong>{openingBalance}</strong>
          </div>
        </div>

        <div className="pur-top-card pur-top-right pur-title-box">
          <div className="pur-title-text">Purchase</div>
        </div>
      </div>

      {/* Grid */}
      {/* â”€â”€ Grid â”€â”€ */}
      <div className="mp-grid-wrap pur-grid-stretch" ref={gridRef}>
        <div className="mp-gscroll">
          <table className="mp-tbl pur-grid" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th className="sno-col">S.No</th>
                {orderedGridColumns.filter((c) => PURCHASE_UI_VISIBLE_COLUMNS.has(c.key) && isColVisible(c)).map((c) => {
                  const cfg = colConfig.find((x) => x.key === c.key);
                  const colWidth = cfg ? cfg.width : c.defaultWidth;
                  return <th key={c.key} style={{ width: colWidth, minWidth: colWidth, maxWidth: colWidth }} className={c.align === "right" ? "right" : ""}>{c.label}</th>;
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
                    style={isFreeRow ? { background: "var(--clr-success-bg)" } : undefined}
                    title={isFreeRow ? "Free Product Row (F2)" : undefined}>
                    <td className="sno-col center" style={isFreeRow ? { background: "var(--clr-success-bg)" } : undefined}>{idx + 1}</td>
                    {orderedGridColumns.filter((c) => PURCHASE_UI_VISIBLE_COLUMNS.has(c.key) && isColVisible(c)).map((c) => {
                      const cfg = colConfig.find((x) => x.key === c.key);
                      return renderCell(row, { ...c, width: cfg ? cfg.width : c.defaultWidth });
                    })}
                    <td className="del-col center" style={isFreeRow ? { background: "var(--clr-success-bg)" } : undefined}>{row.ProductCode && <button className="del-row-btn" onClick={() => deleteGridRow(row._key)} title="Delete Row (Shift+Del)"><Trash2 size={14} strokeWidth={2.4} /></button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Panel */}
      <div className="pur-bottom pur-bottom-simple">
        <div className="pur-bottom-card pur-balance-list">
          <div className="pur-balance-row"><span>Previous Bal</span><strong className="info">{openingBalance}</strong></div>
          <div className="pur-balance-row"><span>Bill Amount</span><strong>{billAmountValue}</strong></div>
          <div className="pur-balance-row"><span>Total Amount</span><strong>{billAmountValue}</strong></div>
          <div className="pur-balance-row pur-paid-row"><span>Paid Amount</span><input className="form-ctrl right sm pur-small-input" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} onFocus={(e) => e.target.select()} /></div>
          <div className="pur-balance-row"><span>Closing Bal</span><strong className="danger">{closingBalanceValue}</strong></div>
        </div>

        <div className="pur-bottom-card pur-bill-display-card">
          <div className="pur-bill-display">Rs.{billAmountValue}</div>
        </div>

        <div className="pur-bottom-card pur-others-card">
          <div className="pur-other-inline"><span>Others (-)</span><input ref={otherSubRef} className="form-ctrl right sm pur-small-input" value={otherSub} onChange={(e) => setOtherSub(e.target.value)} onFocus={(e) => e.target.select()} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); nextFocusForm("txtothersub"); } }} /></div>
          <div className="pur-other-inline"><span>Others (+)</span><input ref={otherPlusRef} className="form-ctrl right sm pur-small-input" value={otherPlus} onChange={(e) => setOtherPlus(e.target.value)} onFocus={(e) => e.target.select()} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); nextFocusForm("txtotherplus"); } }} /></div>
          <input ref={remarksRef} className="form-ctrl sm pur-remarks-hidden" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Remarks..." onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); nextFocusForm("txtremarks"); } }} />
        </div>
      </div>
      {/* -- Ctrl+G Grid Focus Columns Modal -- */}
      {focusColOpen && (
        <div className="popup-overlay">
          <div className="popup-window f12-popup" style={{ width: 520, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <div className="popup-header">
              <span>Columns Reorder &amp; Focus Enabled (Ctrl+G)</span>
              <button className="popup-close" onClick={() => setFocusColOpen(false)}>X</button>
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
                        style={{ background: focusColDragIdx === idx ? "var(--clr-bg-row-hover)" : "transparent", cursor: "grab" }}>
                        <td style={{ textAlign: "center", userSelect: "none", fontWeight: 600 }}>{idx + 1}</td>
                        <td>{base?.label || d.column}</td>
                        <td style={{ textAlign: "center" }}>
                          <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, cursor: "pointer" }}>
                            <input type="checkbox" checked={!!d.Focus} onChange={() => handleFocusToggle(idx, "Focus", !d.Focus)} style={{ width: 14, height: 14, accentColor: "var(--clr-primary)" }} />
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="popup-footer">
              <button className="btn btn-primary btn-sm" onClick={handleFocusColSave} disabled={loading}>Save</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setFocusColOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* -- Keyboard hint bar -- */}
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
        <kbd>Arrows</kbd> Navigate Rows &nbsp;|&nbsp;
        <kbd>Shift+Del</kbd> Delete Row
      </div>

      {/* -- Loading overlay -- */}
      {loading && (
        <div className="mp-loader-ov">
          <div className="mp-ldr-box"><div className="mp-spin" /><div className="mp-ldr-msg">Processing…</div></div>
        </div>
      )}

      <MSG.ToastList toasts={toasts} />

      {/* -- Edit Password Modal -- */}
      {editPwdOpen && (
        <div style={{ position: "fixed", inset: 0, background: "var(--clr-modal-overlay)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
          <div style={{ background: "var(--clr-bg-white)", borderRadius: 10, padding: "22px 28px 18px", minWidth: 240, maxWidth: 300, boxShadow: "0 8px 32px var(--clr-shadow-box)", border: "1px solid var(--clr-border-default)", textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: "var(--clr-text-primary)" }}>Edit Password</div>
            <input type="password" autoFocus
              style={{ width: "100%", padding: "7px 10px", border: "1px solid var(--clr-border-default)", borderRadius: 6, fontSize: 14, outline: "none", boxSizing: "border-box" }}
              value={editPwdValue}
              onChange={(e) => { setEditPwdValue(e.target.value); setEditPwdError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleEditPasswordSubmit(); if (e.key === "Escape") { setEditPwdOpen(false); setPendingEditAction(null); } }}
              placeholder="Enter password…" disabled={editPwdLoading} />
            {editPwdError && <div style={{ color: "var(--clr-danger-dark)", fontSize: 12, marginTop: 6 }}>{editPwdError}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "center" }}>
              <button style={{ padding: "7px 22px", borderRadius: 6, border: "none", background: "linear-gradient(135deg,var(--clr-primary),var(--clr-primary-hover))", color: "var(--clr-text-white)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                onClick={handleEditPasswordSubmit} disabled={editPwdLoading || !editPwdValue.trim()}>
                {editPwdLoading ? "..." : "OK"}
              </button>
              <button style={{ padding: "7px 22px", borderRadius: 6, border: "1px solid var(--clr-border-default)", background: "var(--clr-bg-soft)", color: "var(--clr-text-muted)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                onClick={() => { setEditPwdOpen(false); setPendingEditAction(null); }} disabled={editPwdLoading}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- ProductPopup -------------------------------------------------------------
function ProductPopup({ productPopup, setProductPopup, applyProductToRow, sess, setLoading, allowQuickCreate, onCreateProduct, products, loadProducts }) {
  const [localQuery, setLocalQuery] = useState(productPopup.query || "");
  const [localList,  setLocalList ] = useState(productPopup.list  || []);
  const [selIdx,     setSelIdx    ] = useState(0);
  const inputRef = useRef(null);
  const visibleList = localList.slice(0, 120);

  useEffect(() => {
    inputRef.current?.focus();
    if (productPopup.autoLoad) doSearch("");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doSearch = useCallback(async (q) => {
    let allProducts = Array.isArray(products) ? products : [];
    if (allProducts.length === 0 && loadProducts) {
      setLoading(true);
      try {
        allProducts = await loadProducts();
      } finally {
        setLoading(false);
      }
    }
    if (!q?.trim()) { setLocalList(allProducts); return; }
    const search = q.toLowerCase();
    const filtered = allProducts.filter((p) =>
      (p.Prod_Code || p.PCode || p.ProductCode || "").toLowerCase().includes(search) ||
      (p.PName || p.ProductName || "").toLowerCase().includes(search)
    );
    setLocalList(filtered);
    setSelIdx(0);
  }, [products, loadProducts, setLoading]);

  const handleKey = (e) => {
    const createVisible = allowQuickCreate && !!localQuery.trim() && !localList.some((p) =>
      normalizeProductValue(p.PName || p.ProductName) === normalizeProductValue(localQuery)
    );
    const maxIdx = createVisible ? visibleList.length : Math.max(visibleList.length - 1, 0);
    if (e.key === "ArrowDown")  { e.preventDefault(); setSelIdx((i) => Math.min(i + 1, maxIdx)); }
    else if (e.key === "ArrowUp")  { e.preventDefault(); setSelIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter")    {
      if (createVisible && selIdx === visibleList.length) onCreateProduct?.(localQuery.trim());
      else if (visibleList[selIdx]) applyProductToRow(productPopup.rowKey, visibleList[selIdx]);
    }
    else if (e.key === "Escape")   { setProductPopup({ open: false, rowKey: null, list: [], query: "" }); }
  };

  const createVisible = allowQuickCreate && !!localQuery.trim() && !localList.some((p) =>
    normalizeProductValue(p.PName || p.ProductName) === normalizeProductValue(localQuery)
  );

  return (
    <div className="popup-overlay">
      <div className="popup-window product-popup">
        <div className="popup-header">
          <span>Product Lookup</span>
          <button className="popup-close" onClick={() => setProductPopup({ open: false, rowKey: null, list: [], query: "" })}>X</button>
        </div>
        <div className="popup-body">
          <input ref={inputRef} className="popup-search-input" placeholder="Search by code or name…"
            value={localQuery} onChange={(e) => { setLocalQuery(e.target.value); doSearch(e.target.value); }} onKeyDown={handleKey} />
          <div className="popup-list-wrap">
            <table className="popup-table">
              <thead><tr><th>Code</th><th>Description</th><th>UOM</th><th>Pur.Rate</th><th>MRP</th><th>GST</th><th>LandingCost</th><th>SaleRate</th></tr></thead>
              <tbody>
                {visibleList.map((p, i) => (
                  <tr key={p.Id} className={i === selIdx ? "popup-row selected" : "popup-row"} onClick={() => applyProductToRow(productPopup.rowKey, p)}>
                    <td>{p.Prod_Code}</td><td>{p.PName}</td><td>{p.UOM}</td>
                    <td className="right">{valNum(p.PurRate).toFixed(2)}</td>
                    <td className="right">{valNum(p.MRP).toFixed(2)}</td>
                    <td className="right">{valNum(p.GST).toFixed(2)}</td>
                    <td className="right">{valNum(p.LandingCost).toFixed(2)}</td>
                    <td className="right">{valNum(p.SaleRate).toFixed(2)}</td>
                  </tr>
                ))}
                {createVisible && (
                  <tr
                    className={selIdx === visibleList.length ? "popup-row selected" : "popup-row"}
                    onClick={() => onCreateProduct?.(localQuery.trim())}
                  >
                    <td colSpan={8} style={{ fontWeight: 700, color: "var(--clr-primary, #1f65de)" }}>
                      + Create New Product: {localQuery.trim()}
                    </td>
                  </tr>
                )}
                {localList.length === 0 && <tr><td colSpan={6} className="no-data">No records found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- MRPSelectionPopup --------------------------------------------------------
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
        <div className="popup-header"><span>Select MRP / Batch Variant</span><button className="popup-close" onClick={close}>X</button></div>
        <div className="popup-body">
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--clr-text-muted)" }}>Multiple variants found. Select one to add to the grid.</p>
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
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--clr-text-faint)" }}>Arrow keys to navigate · Enter to select · Esc to cancel</div>
        </div>
      </div>
    </div>
  );
}

// --- ItemCreatePopup ----------------------------------------------------------
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
          <button className="popup-close" onClick={handleClose}>X</button>
        </div>
        <iframe src="/Itemmaster" title="ItemMaster" style={{ flex: 1, border: "none", width: "100%" }} />
        <div style={{ padding: "8px 16px", background: "var(--clr-bg-soft)", borderTop: "1px solid var(--clr-border-table)", fontSize: 12, color: "var(--clr-text-muted)", flexShrink: 0 }}>
          Create the new item above, then close this window to auto-load it into the grid.
          <button style={{ marginLeft: 16, padding: "4px 16px", borderRadius: 5, border: "none", background: "var(--clr-primary)", color: "var(--clr-text-white)", fontWeight: 600, cursor: "pointer", fontSize: 12 }} onClick={handleClose}>
            Done - Close &amp; Load Item
          </button>
        </div>
      </div>
    </div>
  );
}

// --- SerialNoPopup ------------------------------------------------------------
function SerialNoPopup({ serialNoPopup, setSerialNoPopup, serialNoList, setSerialNoList, setGridRows, gridRows, calcRow }) {
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const { rowKey, textRefId, returnColKey } = serialNoPopup;
  const [rows,  setRows ] = useState(() => serialNoPopup.list.length > 0 ? serialNoPopup.list.map((s) => ({ id: uid(), value: s.BatchNo })) : [{ id: uid(), value: "" }]);
  const [error, setError] = useState("");
  const inputRefs = useRef({});
  const currentRow = gridRows.find((r) => r._key === rowKey) || null;

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
    if (!currentRow?.ProductRefId) { setError("Invalid product row for Serial No save !!!."); return; }
    const filtered = serialNoList.filter((s) => s.IndexRefId !== textRefId);
    setSerialNoList([
      ...filtered,
      ...values.map((val) => ({
        BatchNo: val,
        IndexRefId: textRefId,
        RItemQty: 0,
        ItemQty: 1,
        Batchid: parseInt(currentRow.BatchRefId, 10) || 0,
        ProductRefid: parseInt(currentRow.ProductRefId, 10) || 0,
        MRP: parseFloat(currentRow.MRP) || 0,
        PurchaseRate: parseFloat(currentRow.PurchaseRate) || 0,
        LandingCost: parseFloat(currentRow.LandingCost) || 0,
        VAT: parseFloat(currentRow.TaxPercent) || 0,
        SalesRate: parseFloat(currentRow.Salerate || currentRow.SalesRate) || 0,
      })),
    ]);
    setGridRows((prev) => {
      const idx = prev.findIndex((r) => r._key === rowKey);
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = calcRow({ ...updated[idx], ItemQty: String(values.length) });
      return updated;
    });
    setSerialNoPopup({ open: false, rowKey: null, textRefId: "", list: [], returnColKey: "ItemQty" });
    restoreFocusToGrid();
  }, [rows, serialNoList, textRefId, rowKey, currentRow, setSerialNoList, setGridRows, setSerialNoPopup, restoreFocusToGrid, calcRow]);

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
        <div className="popup-header"><span>Serial Numbers</span><button className="popup-close" onClick={close}>X</button></div>
        <div className="popup-body" style={{ overflowY: "auto", flex: 1 }}>
          <table className="popup-table" style={{ width: "100%" }}>
            <thead><tr><th style={{ width: 40 }}>S.No</th><th>Serial No</th><th style={{ width: 30 }} /></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td style={{ textAlign: "center", color: "var(--clr-text-muted)" }}>{i + 1}</td>
                  <td>
                    <input ref={(el) => { inputRefs.current[r.id] = el; }} className="cell-input" style={{ width: "100%" }}
                      value={r.value} onChange={(e) => handleChange(r.id, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, i)} autoComplete="off" />
                  </td>
                  <td>
                    <button style={{ background: "none", border: "none", color: "var(--clr-danger)", cursor: "pointer", fontSize: 13 }}
                      onClick={() => setRows((prev) => { const next = prev.filter((_, j) => j !== i); return next.length === 0 ? [{ id: uid(), value: "" }] : next; })}
                      title="Remove row (Shift+Del)">X</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {error && <div style={{ color: "var(--clr-danger-dark)", fontSize: 12, padding: "4px 8px" }}>{error}</div>}
          <div style={{ fontSize: 11, color: "var(--clr-text-faint)", padding: "4px 8px" }}>Enter - next row &nbsp;|&nbsp; F1 - Done &nbsp;|&nbsp; Shift+Del - remove row</div>
        </div>
        <div className="popup-footer">
          <button className="btn btn-primary btn-sm" onClick={handleDone}>F1 Done ({rows.filter(r => r.value.trim()).length} serials)</button>
          <button className="btn btn-secondary btn-sm" onClick={close}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

