// ─────────────────────────────────────────────────────────────────────────────
//  PurchasesMaster.jsx
//
//  Imports:
//   • CC.*  from Common.jsx   — API helpers, session, uid, authHeaders, etc.
//   • MSG.* from Messages.jsx — useConfirm, useToast, ToastList
//
//  Features mirrored from SalesManMaster:
//   • Permission guard via useEffect + isAuthorized state (View=0 → redirect)
//   • Dual-login guard — any 406 / res.redis===false → navigate("/Login/Index")
//   • useConfirm (MSG) replaces inline confirmDialog/MsgDialog state
//   • useToast   (MSG) replaces custom toast state
//   • CC.api / CC.insertapi replace inline apiFetch
//   • CC.buildSession for session/company variables
//   • Global keyboard shortcuts (F1 Save · F3 Search · F4 Delete · F9/F10 Clear · F12 Columns)
//   • Loading overlay consistent with SalesManMaster style
//   • All business logic, API URLs, payloads, DB fields unchanged
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./PurchasesMaster.css";
import Topbar from "../components/Topbar";
import * as CC  from "../components/Common";
import * as MSG from "../components/Messages";

// ─── Pure helpers (no React state) ───────────────────────────────────────────
const valNum  = (v)   => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const nullStr = (v)   => (v == null || v === undefined ? "" : String(v));
const roundOff = (v)  => Math.round(valNum(v) * 100) / 100;
const fmt2    = (v)   => valNum(v).toFixed(2);
const fmt0    = (v)   => valNum(v).toFixed(0);
const today   = ()    => new Date().toISOString().split("T")[0];
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
  MfgDate:            "",
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
// ─── Bat_No label from MainSet (mirrors jQuery BatchNoText) ──────────────────
const getBatchNoLabel = () => {
  try {
    const ms = JSON.parse(localStorage.getItem("Mainsetting") || "[{}]");
    const name = ms?.[0]?.BatchNoName;
    return name && name.trim() !== "" ? name : "Batch No";
  } catch { return "Batch No"; }
};

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
  { key: "Salerate",        label: "Sale Rate",     defaultWidth: 85,  align: "right", editable: true,  type: "num",   defaultVisible: true  },
  { key: "BrandId",         label: "Brand",         defaultWidth: 100, align: "left",  editable: true,  type: "text",  defaultVisible: true  },
  { key: "ModelId",         label: "Model",         defaultWidth: 100, align: "left",  editable: true,  type: "text",  defaultVisible: true  },
  { key: "ColorId",         label: "Color",         defaultWidth: 100, align: "left",  editable: true,  type: "text",  defaultVisible: true  },
  { key: "SizeId",          label: "Size",          defaultWidth: 100, align: "left",  editable: true,  type: "text",  defaultVisible: true  },
  { key: "Amount",          label: "Amount",        defaultWidth: 90,  align: "right", editable: false, type: "num",   defaultVisible: true  },
];


// Build initial colConfig from BASE_COLUMNS defaults
const makeDefaultColConfig = () =>
  BASE_COLUMNS.map((c) => ({ key: c.key, visible: c.defaultVisible, width: c.defaultWidth }));

// ─── Keys that trigger row recalculation on change ───────────────────────────
const CALC_KEYS = new Set([
  "MRP", "PurchaseRate", "cdpercent", "DiscountPercent", "CESSPer", "SPLCESS",
  "TaxPercent", "FreeQty", "TransPer", "ItemQty", "NomQty", "Salerate",
  "ProfitPer", "SaleDiscPer", "SaleGST", "Meter", "Pcs", "WholeSalerate",
]);

// ─── TotalRow sub-component ───────────────────────────────────────────────────
function TotalRow({ label, value }) {
  return (
    <div className="total-row">
      <span className="total-label">{label}</span>
      <span className="total-value">{value}</span>
    </div>
  );
}

// ─── PurchasesMaster ──────────────────────────────────────────────────────────
export default function Purchase() {
  const navigate = useNavigate();

  // ── MSG hooks ──────────────────────────────────────────────────────────────
  const { confirm, ConfirmUI } = MSG.useConfirm();
  const { toast,   toasts    } = MSG.useToast();

  // ── Permission / authorization state ──────────────────────────────────────
  const [perm,         setPerm        ] = useState({ View: 0, Add: 0, Edit: 0, Delete: 0 });
  const [isAuthorized, setIsAuthorized] = useState(false);

  // ── Dual-login guard helper ────────────────────────────────────────────────
  const redirectIfDualLogin = useCallback((res) => {
    if (res?._dualLogin || res?.redis === false) {
      alert("Already Login Another User Please Login Again!!!");
      navigate("/");
      return true;
    }
    return false;
  }, [navigate]);

  // ── Permission guard ───────────────────────────────────────────────────────
  useEffect(() => {
    const menuStr = localStorage.getItem("menulist");

    if (!menuStr) {
      alert("Session Close Please Login !!!.");
      navigate("/");
      return;
    }

    const menulist = JSON.parse(menuStr);
    const menudata = menulist.filter(obj => obj.PageName === "Purchase");

    if (!menudata || menudata.length === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => { navigate("/Home"); }, 3000);
      return;
    }

    if (menudata[0].View === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => { navigate("/Home"); }, 3000);
      return;
    }

    setPerm({
      View:   menudata[0].View,
      Add:    menudata[0].Add,
      Edit:   menudata[0].Edit,
      Delete: menudata[0].Delete,
    });
    setIsAuthorized(true);
  }, [navigate]);

  // ── Session ────────────────────────────────────────────────────────────────

  const [sess] = useState(() => {
    try {
      return CC.buildSession("Purchase");
    } catch {
      return { Comid: "1", MComid: "1", IdComList: "1", MirrorTable: "0", menudata: [] };
    }
  });

  // ── Master-form state ──────────────────────────────────────────────────────
  const [purchaseNo,    setPurchaseNo   ] = useState("");
  const [purchaseDate,  setPurchaseDate ] = useState(today());
  const [dueDate,       setDueDate      ] = useState(today());
  const [invoiceDate,   setInvoiceDate  ] = useState(today());
  const [invoiceNo,     setInvoiceNo    ] = useState("");
  const [invoiceAmt,    setInvoiceAmt   ] = useState("0.00");
  const [remarks,       setRemarks      ] = useState("");
  const [purchaseType,  setPurchaseType ] = useState("CREDIT");
  const [igstStatus,    setIgstStatus   ] = useState("GST");
  const [igstChecked,   setIgstChecked  ] = useState(false);
  const [supplierList,  setSupplierList ] = useState([]);
  const [supplierId,    setSupplierId   ] = useState("");
  const [supplierInfo,  setSupplierInfo ] = useState({ address: "", city: "", phone: "", balance: "0.00" });
  // ── Credit Days (mirrors jQuery: var creditdays = 0) ──────────────────────
  // Fetched from supplierList[CreditBillDays] on supplier select;
  // used to auto-compute DueDate = InvoiceDate + creditdays.
  const [creditDays,    setCreditDays   ] = useState(0);
  const [taxMode,       setTaxMode      ] = useState("exclusive");
  const [otherPlus,     setOtherPlus    ] = useState("0.00");
  const [otherSub,      setOtherSub     ] = useState("0.00");
  const [tcsPercent,    setTcsPercent   ] = useState("0.00");  // eslint-disable-line
  const [tcsAmt,        setTcsAmt       ] = useState("0.00");  // eslint-disable-line
  const [loadding,      setLoadding     ] = useState("");       // eslint-disable-line
  const [lorryNo,       setLorryNo      ] = useState("");       // eslint-disable-line

  // ── Supplier autocomplete state ─────────────────────────────────────────────
const [supplierQuery,    setSupplierQuery   ] = useState("");
const [supplierDropdown, setSupplierDropdown] = useState([]); // filtered list
const [supplierDDOpen,   setSupplierDDOpen  ] = useState(false);
const [supplierSelIdx,   setSupplierSelIdx  ] = useState(0);
  // ── Totals ─────────────────────────────────────────────────────────────────
  const [totals, setTotals] = useState(EMPTY_TOTALS);

  // ── Grid ───────────────────────────────────────────────────────────────────
  const [gridRows,      setGridRows    ] = useState([makeGridRow()]);
  const [selectedCell,  setSelectedCell] = useState({ rowKey: null, colKey: null });
  const [gstSplit,      setGstSplit    ] = useState([]);

  // ── Search / view grid ─────────────────────────────────────────────────────
  const [searchNo,  setSearchNo ] = useState("");
  const [viewList,  setViewList ] = useState([]);

  // ── Edit state ─────────────────────────────────────────────────────────────
  const [editId,  setEditId ] = useState(0);
  const [loading, setLoading] = useState(false);

  // ── Edit Password modal state ───────────────────────────────────────────────
// Mirrors jQuery: EditPasswordWindow(type), Presskey, PasswordType
const [editPwdOpen,    setEditPwdOpen   ] = useState(false);
const [editPwdValue,   setEditPwdValue  ] = useState("");
const [editPwdLoading, setEditPwdLoading] = useState(false);
const [editPwdError,   setEditPwdError  ] = useState("");

// pendingEditAction: what to do after password succeeds
// { type: "EDIT", id, pno } | { type: "DELETE", id, updateId }
const [pendingEditAction, setPendingEditAction] = useState(null);

// updateIdEdit: mirrors jQuery UpdateIdEdit (used in delete header)
const [updateIdEdit, setUpdateIdEdit] = useState("");

  // ── Product popup state ────────────────────────────────────────────────────
  const [productPopup, setProductPopup] = useState({ open: false, rowKey: null, list: [], query: "" });

  // ── MRP Selection Popup state (Case 3: >1 result from SelectItemMasterbyCodeId)
  // Mirrors jQuery MRPWindow("#mrpwindow", gridmrp, objPlist)
  const [mrpPopup, setMrpPopup] = useState({ open: false, rowKey: null, list: [] });

  // ── Item Create Popup state (Case 1: 0 results, ProductCreate_Purchase=true)
  // Mirrors jQuery #somediv dialog → /Itemmaster iframe
  const [itemCreatePopup, setItemCreatePopup] = useState({ open: false, rowKey: null, code: "" });

// Replace the old batchPopup state with:
const [serialNoPopup, setSerialNoPopup] = useState({
  open: false, rowKey: null, textRefId: "", list: [], returnColKey: "ItemQty"
});
// ── Serial number list (mirrors jQuery SerialNodatalist) ──────────────────
const [serialNoList, setSerialNoList] = useState([]);
// ── BatchWise master lists ─────────────────────────────────────────────────
// Mirrors jQuery: brandlist / sizelist / modellist / colorlist
const [batchWise,   setBatchWise  ] = useState(false); // MainSet[0].BatchWiseStock
const [brandList,   setBrandList  ] = useState([]);
const [modelList,   setModelList  ] = useState([]);
const [colorList,   setColorList  ] = useState([]);
const [sizeList,    setSizeList   ] = useState([]);

// ── F5 List View popup ─────────────────────────────────────────────────────
const [listViewOpen,  setListViewOpen ] = useState(false);
const [f5MasterList,  setF5MasterList ] = useState([]);
const [f5DetailList,  setF5DetailList ] = useState([]);
const [f5TotalAmt,    setF5TotalAmt   ] = useState("0.00");
const [f5ExpandedRow, setF5ExpandedRow] = useState(null);
const [fromDate,      setFromDate     ] = useState(today());
const [toDate,        setToDate       ] = useState(today());
const [f5SupplierId,  setF5SupplierId ] = useState("");
  // ── F12 column config popup ────────────────────────────────────────────────
  const [f12Open,   setF12Open  ] = useState(false);
  // colConfig: runtime visible/width per column — loaded from server JSON on mount
  const [colConfig, setColConfig] = useState(() => makeDefaultColConfig());
  // colConfigRef: always-current ref so loadFocusColumns reads live F12 visibility
  // (mirrors jQuery: gridpurchase.jqxGrid('iscolumnvisible', col) read at Ctrl+G time)
  const colConfigRef = useRef(makeDefaultColConfig());
  // f12Draft: editable copy used only while F12 popup is open
  const [f12Draft,  setF12Draft ] = useState([]);

  // Keep colConfigRef.current always in sync with colConfig state.
  // This lets loadFocusColumns (a stable useCallback) read the live F12 visibility
  // without needing colConfig in its dependency array — mirrors jQuery's live
  // gridpurchase.jqxGrid('iscolumnvisible', col) call inside the Ctrl+G handler.
  useEffect(() => {
    colConfigRef.current = colConfig;
  }, [colConfig]);

  // ── Batch-column visibility flags
  const bStatus = batchWise && (colConfig.find(c => c.key === "BrandId")?.visible ?? true) ? 1 : 0;
  const sStatus = batchWise && (colConfig.find(c => c.key === "SizeId" )?.visible ?? true) ? 1 : 0;
  const cStatus = batchWise && (colConfig.find(c => c.key === "ColorId")?.visible ?? true) ? 1 : 0;
  const mStatus = batchWise && (colConfig.find(c => c.key === "ModelId")?.visible ?? true) ? 1 : 0;
  // ── FocusColumns (Ctrl+G) state ────────────────────────────────────────────
const [focusColOpen,   setFocusColOpen  ] = useState(false);
const [focusColDraft,  setFocusColDraft ] = useState([]);   // { column, Index, Focus, filename, Comid }[]
const [focusColDragIdx, setFocusColDragIdx] = useState(null); // drag-and-drop source index

  // ── Refs ───────────────────────────────────────────────────────────────────
  const supplierRef    = useRef(null);
  const invoiceNoRef   = useRef(null);
  const invoiceAmtRef  = useRef(null);
  const remarksRef     = useRef(null);
  const gridRef        = useRef(null);
  const supplierContainerRef = useRef(null);  // wraps the autocomplete control
  const focusCellRef   = useRef(null);        // set after focusCell is declared; avoids TDZ in applyProductToRow

  // ── Row calculation ────────────────────────────────────────────────────────
  const calcRow = useCallback((row) => {
    const qty        = valNum(row.ItemQty) + valNum(row.NomQty);
    const nomqty     = valNum(row.NomQty) === 0 ? 1 : valNum(row.NomQty);
    const purRate    = valNum(row.PurchaseRate);
    const purAmt     = roundOff(purRate * qty);
    const cdAmt      = roundOff(purAmt * (valNum(row.cdpercent) / 100));
    const discAmt    = roundOff((purAmt - cdAmt) * (valNum(row.DiscountPercent) / 100));
    const netRate    = qty !== 0 ? roundOff(purRate - (cdAmt + discAmt) / qty) : 0;
    const transAmt   = roundOff(netRate * qty * (valNum(row.TransPer) / 100));
    const cessAmt    = roundOff(netRate * qty * (valNum(row.CESSPer) / 100));
    const splCessAmt = roundOff(qty * valNum(row.SPLCESS));
    const ctAmt      = igstStatus === "IGST" || igstStatus === "UGST"
      ? 0
      : roundOff(netRate * qty * ((valNum(row.TaxPercent) / 2) / 100));
    const stAmt      = igstStatus === "IGST" || igstStatus === "UGST" ? 0 : ctAmt;
    const gstAmt     = roundOff(ctAmt + stAmt);
    const landingCost = qty !== 0
      ? roundOff(netRate + (gstAmt + cessAmt + splCessAmt) / qty)
      : 0;
    // jQuery: Amt = puramt - (cdamt + disamt) + (gstamt + cessamt + splcessamt + transamt)
    const amount    = roundOff(purAmt - (cdAmt + discAmt) + (gstAmt + cessAmt + splCessAmt + transAmt));
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
      IGSTAmt:       (igstStatus === "IGST" || igstStatus === "UGST") ? fmt2(gstAmt) : "0.00",
      LandingCost:   fmt2(landingCost),
      Amount:        fmt2(amount),
      ProductTotal:  fmt2(purAmt),   // jQuery: grdProductTotal = puramt (gross before disc/gst)
      StockQtyNew:   fmt2(stockQty),
    };
  }, [igstStatus]);

  // ── GST split helper ───────────────────────────────────────────────────────
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

  // ── Recalculate bill totals (matches jQuery Calculation function exactly) ───
  const recalcTotals = useCallback((rows) => {
    let prodTotal = 0, tGst = 0, tCess = 0, tSplCess = 0, tCt = 0, tSt = 0,
        tTrans = 0, tCd = 0, tDisc = 0, totalQty = 0;
    rows.forEach((r) => {
      if (nullStr(r.ProductCode) !== "") {
        // jQuery: producttotal = sum of grdProductTotal (= purAmt, gross before disc/gst)
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
    const oPlus  = valNum(otherPlus);
    const oSub   = valNum(otherSub);
    const tcsPer = valNum(tcsPercent);
    // jQuery: GrossTotal = producttotal + gst + cess + splcess + trans + otherplus - cd - disc - othersub
    const grossTotal = prodTotal + tGst + tCess + tSplCess + tTrans + oPlus - tCd - tDisc - oSub;
    const tcsAmt1    = roundOff(grossTotal * (tcsPer / 100));
    // jQuery: nettotal = grossTotal + tcsAmt
    const netAmt     = roundOff(grossTotal + tcsAmt1);
    const newTotals = {
      productTotal: fmt2(prodTotal),
      transAmt:     fmt2(tTrans),
      cdAmt:        fmt2(tCd),
      discAmt:      fmt2(tDisc),
      gstAmt:       fmt2(tGst),
      cessAmt:      fmt2(tCess),
      cgstAmt:      fmt2(tCt),
      sgstAmt:      fmt2(tSt),
      netAmt:       fmt2(netAmt),
      displayAmt:   fmt2(netAmt),
      totalQty:     fmt2(totalQty),
    };
    setTotals(newTotals);
    setTcsAmt(fmt2(tcsAmt1));
    updateGstSplit(rows);
    return newTotals;
  }, [otherPlus, otherSub, tcsPercent, updateGstSplit]);

  // Rerun totals whenever grid rows or other charges change
  useEffect(() => {
    recalcTotals(gridRows);
  }, [gridRows, otherPlus, otherSub, recalcTotals]);

  // ── Credit Days: InvoiceDate change → DueDate auto-update ───────────────────
  // Mirrors jQuery dtpinvoicedate keydown (line 3653):
  //   dtpduedate.jqxDateTimeInput('setDate', AddDays(dtpinvoicedate.getDate(), creditdays));
  // Runs whenever invoiceDate changes (if creditDays > 0).
  useEffect(() => {
    if (!creditDays || creditDays <= 0) return;
    if (!invoiceDate) return;
    const base = new Date(invoiceDate);
    if (isNaN(base.getTime())) return;
    base.setDate(base.getDate() + creditDays);
    setDueDate(base.toISOString().split("T")[0]);
  }, [invoiceDate, creditDays]);

  // ── loadMaxPurchaseNo ──────────────────────────────────────────────────────
  const loadMaxPurchaseNo = useCallback(async () => {
    const res = await CC.api(CC.MaxPurchaseNo, null, {}, { Comid: sess.Comid });
    if (redirectIfDualLogin(res)) return;
    // if (res.ok) setPurchaseNo(res.No);
    // if (res.ok) setPurchaseNo(res.No || "");
    if (res.ok) setPurchaseNo(res.data ?? res.Data1 ?? "");
  }, [sess.Comid, redirectIfDualLogin]);

  // ── loadSuppliers ──────────────────────────────────────────────────────────
  const loadSuppliers = useCallback(async () => {
    const res = await CC.api(
      CC.SupplierList,
      null,
      {},
      {
        Comid: sess.MComid,
        AccountType: "Supplier"
      }
    );
  
    if (redirectIfDualLogin(res)) return;
  
   // ✅ After
if (Array.isArray(res)) {
  setSupplierList(res);
} else {
  setSupplierList(res?.data || res?.Data1 || []);
}
  }, [sess.MComid, redirectIfDualLogin]);

  // On mount: load purchase number + supplier list
  useEffect(() => {
    if (!isAuthorized) return;
    loadMaxPurchaseNo();
    loadSuppliers();
  }, [isAuthorized, loadMaxPurchaseNo, loadSuppliers]);

  // ── loadBatchWiseMasters — mirrors jQuery loadgrid() when BatchWisePurchaseSale==true ──
// Called once on mount (loadstatus guard = useState above).
// APIs come from Common.jsx: BrandSelect, SelectModel, SelectColor, SizeSelect
const loadBatchWiseMasters = useCallback(async () => {
  const mainSet = JSON.parse(localStorage.getItem("Mainsetting") || "[{}]");
  const isBatch = mainSet?.[0]?.BatchWiseStock === true;
  setBatchWise(isBatch);
  if (!isBatch) return;

  // Fire all four in parallel (mirrors jQuery calling them sequentially, but parallel is fine)
  const [bRes, mRes, cRes, sRes] = await Promise.all([
    CC.api(CC.BrandSelect, null, {}, { Comid: sess.MComid }),
    CC.api(CC.SelectModel, null, {}, { Comid: sess.MComid }),
    CC.api(CC.SelectColor, null, {}, { Comid: sess.MComid }),
    CC.api(CC.SizeSelect,  null, {}, { Comid: sess.MComid }),
  ]);

  const norm = (r) => (Array.isArray(r) ? r : r?.data ?? r?.Data1 ?? []);
  setBrandList(norm(bRes));
  setModelList(norm(mRes));
  setColorList(norm(cRes));
  setSizeList (norm(sRes));
}, [sess.MComid]);

// On mount — load BatchWise masters alongside purchase number + suppliers
useEffect(() => {
  if (!isAuthorized) return;
  loadMaxPurchaseNo();
  loadSuppliers();
  loadBatchWiseMasters();       // ← ADD THIS LINE
}, [isAuthorized, loadMaxPurchaseNo, loadSuppliers, loadBatchWiseMasters]);

  // ── handleSupplierChange ───────────────────────────────────────────────────
//   const handleSupplierChange = useCallback(async (sid) => {
//     setSupplierId(sid);
//     if (!sid) { setSupplierInfo({ address: "", city: "", phone: "", balance: "0.00" }); return; }

// const res = await CC.api(
//   CC.SupplierById,
//   null,
//   {},
//   { Id: sid, Comid: sess.Comid }
// );
// if (redirectIfDualLogin(res)) return;

// // CC.api normalises Data1 → data, so use res.data not res.Data
// const list = Array.isArray(res) ? res : (res.data || res.Data1 || res.Data || []);
// if (list.length > 0) {
//   const s = list[0];
//   setSupplierInfo({
//     address: `${s.Address1 || ""} ${s.Address2 || ""}`.trim(),
//     city:    s.City     || "",
//     phone:   s.MobileNo || "",
//     balance: fmt2(s.Balance || 0),
//   });
// }
//   }, [sess.Comid, redirectIfDualLogin]);

// ── handleSupplierChange ───────────────────────────────────────────────────
// Read supplier info (address/city/phone) from already-loaded supplierList.
// Current Balance is always fetched from /api/SupplierApp/CurrentBalance,
// matching the legacy jQuery SupplierDetailsLoad() call exactly.
const handleSupplierChange = useCallback(async (sid) => {
  setSupplierId(sid);
  if (!sid) { setSupplierInfo({ address: "", city: "", phone: "", balance: "0.00" }); return; }

  // ── Step 1: populate address/city/phone from local list ──────────────────
  const local = supplierList.find((s) => String(s.Id) === String(sid));
  if (local) {
    setSupplierInfo({
      address: `${local.Address1 || ""} ${local.Address2 || ""}`.trim(),
      city:    local.City     || "",
      phone:   local.MobileNo || "",
      balance: "0.00",           // placeholder until API returns
    });

    // ── Credit Days logic — mirrors jQuery SupplierDetailsLoad lines 3778 + 3803 ──
    // jQuery: creditdays = objlist[0].CreditBillDays;
    // jQuery: dtpduedate.setDate(AddDays(new Date(), creditdays));
    const cd = parseInt(local.CreditBillDays ?? 0, 10) || 0;
    setCreditDays(cd);
    if (cd > 0) {
      const base = new Date();  // jQuery uses new Date() (today) on supplier select
      base.setDate(base.getDate() + cd);
      setDueDate(base.toISOString().split("T")[0]);
    }
  } else {
    // Fallback: hit API with MComid for address fields
    const res = await CC.api(
      CC.SupplierById,
      null,
      {},
      { Id: sid, Comid: sess.MComid }
    );
    if (redirectIfDualLogin(res)) return;
    const s = res?.data?.[0] ?? res?.Data?.[0] ?? (Array.isArray(res?.data) ? res.data[0] : null);
    if (s) {
      setSupplierInfo({
        address: `${s.Address1 || ""} ${s.Address2 || ""}`.trim(),
        city:    s.City     || "",
        phone:   s.MobileNo || "",
        balance: "0.00",         // placeholder until API returns
      });
    }
  }

  // ── Step 2: fetch Current Balance from dedicated API (mirrors jQuery) ─────
  // jQuery payload: {Id, Comid, MComid, TillDate, AccountType}
  const balRes = await CC.api(
    CC.CurrentBalance,
    null,
    {},
    {
      Id:          Number(sid),
      Comid:       Number(sess.Comid),
      MComid:      Number(sess.MComid),
      TillDate:    purchaseDate || today(),
      AccountType: "SUPPLIER",
    }
  );
  if (redirectIfDualLogin(balRes)) return;

  const balance = balRes?.ok
    ? fmt2(valNum(balRes.data))
    : "0.00";

  setSupplierInfo((prev) => ({ ...prev, balance }));
}, [sess.Comid, sess.MComid, supplierList, purchaseDate, redirectIfDualLogin]);



// ── openSupplierDropdown — show full list on focus (mirrors jqxComboBox open) ──
// jQuery: cmbsupplier.jqxComboBox opens and shows ALL items on focus/click
// with no filter applied. This replicates that behavior exactly.
const openSupplierDropdown = useCallback(() => {
  if (supplierList.length === 0) return;
  setSupplierDropdown(supplierList);   // show ALL — no filter
  setSupplierSelIdx(0);
  setSupplierDDOpen(true);
}, [supplierList]);

// ── handleSupplierInputChange — filter supplier list as user types ──────────
// Mode 1 (empty value): show ALL — matches jqxComboBox open-on-focus behavior.
// Mode 2 (has value)  : filter to matching rows only.
const handleSupplierInputChange = useCallback((value) => {
  setSupplierQuery(value);
  setSupplierId("");
  setSupplierInfo({ address: "", city: "", phone: "", balance: "0.00" });

  if (!value.trim()) {
    // Cleared → show full list (mirrors ComboBox reverting to full source)
    setSupplierDropdown(supplierList);
    setSupplierSelIdx(0);
    setSupplierDDOpen(supplierList.length > 0);
    return;
  }

  const q = value.toLowerCase();
  const filtered = supplierList.filter((s) =>
    (s.AccountName || "").toLowerCase().includes(q)
  );
  setSupplierDropdown(filtered);
  setSupplierSelIdx(0);
  setSupplierDDOpen(filtered.length > 0);
}, [supplierList]);

// ── confirmSupplierSelection — mirrors jQuery cmbsupplier Enter handler ─────
// Called when user presses Enter or clicks a dropdown row.
// Populates address/city/phone from local list; balance via handleSupplierChange.
const confirmSupplierSelection = useCallback((supplier) => {
  setSupplierQuery(supplier.AccountName || "");
  setSupplierDDOpen(false);
  setSupplierDropdown([]);
  handleSupplierChange(String(supplier.Id));  // loads address + balance
  // After confirming supplier, move focus to InvoiceNo (mirrors NextFocus('cmbsupplier'))
  setTimeout(() => invoiceNoRef.current?.focus(), 50);
}, [handleSupplierChange]);

// ── supplierInputKeyDown — keyboard nav for autocomplete ────────────────────
// Mirrors jQuery cmbsupplier keydown (keyCode 13 = Enter):
//   • Dropdown open  → select highlighted item or show error
//   • Dropdown closed, supplierId set → move to InvoiceNo (NextFocus)
//   • Dropdown closed, no supplierId  → try exact match, else error
//   • ArrowDown/Up   → move highlight inside open dropdown
//   • Escape         → close dropdown without selecting
const supplierInputKeyDown = useCallback((e) => {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (!supplierDDOpen) {
      // Pressing down when closed opens the full list (same as focus)
      openSupplierDropdown();
    } else {
      setSupplierSelIdx((i) => Math.min(i + 1, supplierDropdown.length - 1));
    }
    return;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    setSupplierSelIdx((i) => Math.max(i - 1, 0));
    return;
  }
  if (e.key === "Escape") {
    setSupplierDDOpen(false);
    return;
  }

  if (e.key === "Enter") {
    e.preventDefault();
    if (supplierDDOpen) {
      // Dropdown is open → confirm highlighted item
      const chosen = supplierDropdown[supplierSelIdx];
      if (chosen) {
        confirmSupplierSelection(chosen);
      } else {
        toast("❌ Select Valid Supplier !!!.", true);
      }
      return;
    }
    // Dropdown is closed
    if (supplierId) {
      // Already confirmed — advance focus (mirrors NextFocus('cmbsupplier'))
      invoiceNoRef.current?.focus();
      return;
    }
    // No confirmed selection — try exact-text match before showing error
    if (supplierQuery.trim()) {
      const exact = supplierList.find(
        (s) => (s.AccountName || "").toLowerCase() === supplierQuery.toLowerCase()
      );
      if (exact) {
        confirmSupplierSelection(exact);
        return;
      }
    }
    toast("❌ Select Valid Supplier !!!.", true);
  }
}, [
  supplierDDOpen, supplierDropdown, supplierSelIdx, supplierId,
  supplierQuery, supplierList,
  openSupplierDropdown, confirmSupplierSelection, toast,
]);

// Keep supplier text input synced when supplierId changes externally (e.g. edit load)
useEffect(() => {
  if (!supplierId) return;
  const found = supplierList.find((s) => String(s.Id) === String(supplierId));
  if (found) setSupplierQuery(found.AccountName || "");
}, [supplierId, supplierList]);
  // ── applyProductToRow ──────────────────────────────────────────────────────
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
        PurchaseRate:    fmt2(p.PurchaseRate   || 0),
        OldPurchaseRate: fmt2(p.PurchaseRate   || 0),
        TaxPercent:      fmt2(p.GST            || 0),
        LandingCost:     fmt2(p.LandingCost    || 0),
        Salerate:        fmt2(p.SalesRate      || 0),
        WholeSalerate:   fmt2(p.WholeSaleRate  || 0),
        ProfitPer:       fmt2(p.ProfitPer      || 0),
        ProfitAmt:       fmt2(p.ProfitAmt      || 0),
        CESSPer:         fmt2(p.CESS           || 0),
        SPLCESS:         fmt2(p.SPLCESS        || 0),
        SaleDiscPer:     fmt2(p.SaleDiscountPer|| 0),
        Expirydays:      fmt0(p.ExpriyDays     || 0),
        StockQty:        fmt2(p.Stock          || 0),
        Nstock:          fmt2(p.Nstock         || 0),
        SerialNoStatus:  p.SerialNoType    || 0,
        BatchStatus:     p.BatchwiseStock  || 0,   // ← stored; Bat_No cell is typed by user
        NomQty:          p.NomsQty         || "0",
        TransPer:        "0.00",
        // Assign a TextRefId (GUID) now so the serial-no list can be keyed to this row
        TextRefId: p.SerialNoType === 1
             ? (prev[idx].TextRefId || CC.uid())
             : prev[idx].TextRefId || "",
      };
  
      row = calcRow(row);
      const updated = [...prev];
      updated[idx]  = row;
      const last = updated[updated.length - 1];
      if (last._key === rowKey || last.ProductCode !== "") updated.push(makeGridRow());
      return updated;
    });
  
    setProductPopup({ open: false, rowKey: null, list: [], query: "" });

    // ── Auto-advance focus to next visible editable column after ProductCode ──
    // Mirrors jQuery FillItems() which moves focus to the next input after loading.
    // Uses the same focusCell + colConfig logic as handleGridKeyDown's "Move Next Cell".
    // setTimeout(() => {
    //   const liveColConfig = colConfigRef.current;
    //   const visibleEditableCols = BASE_COLUMNS.filter((c) => {
    //     const cfg = liveColConfig.find((x) => x.key === c.key);
    //     return c.editable && (cfg ? cfg.visible : c.defaultVisible);
    //   });
    //   const pcIdx = visibleEditableCols.findIndex((c) => c.key === "ProductCode");
    //   const nextCol = visibleEditableCols[pcIdx + 1];
    //   if (nextCol) {
    //     focusCellRef.current(rowKey, nextCol.key);
    //   }
    // }, 50);

    setTimeout(() => {
      // Build visible+editable columns (same as handleGridKeyDown)
      const visibleCols = BASE_COLUMNS.filter((c) => {
        const cfg = colConfigRef.current.find(x => x.key === c.key);
        return c.editable && (cfg ? cfg.visible : c.defaultVisible);
      });

      // Filter to only focus-enabled columns (respects Ctrl+G user selection).
      // If focusgridcolumns is empty (not yet loaded), fall back to all visible cols.
      const liveFocus = focusgridcolumnsRef.current;
      const focusEnabledCols = liveFocus.length > 0
        ? visibleCols.filter((c) => {
            const fc = liveFocus.find((f) => f.column === c.key);
            // If the column has no entry in focusgridcolumns, default allow it.
            // If it has an entry, only allow when focus === 1.
            return fc ? fc.focus === 1 : true;
          })
        : visibleCols;

      // Find the first focus-enabled column AFTER ProductCode.
      // This is the column we should land on after the user picks a product —
      // Description (ProductName) is skipped if its Focus is 0.
      const pcIdx = focusEnabledCols.findIndex(c => c.key === "ProductCode");
      const nextCol = focusEnabledCols[pcIdx + 1] ?? null;

      if (nextCol) {
        focusCellRef.current(rowKey, nextCol.key);
      }
    }, 80);



    // ── SerialNoType === 1 → open serial-number entry popup ──
    // Only when TextilesSerialNowiseBilling setting is ON (mirrors jQuery FillItems check)
    const mainSet = JSON.parse(localStorage.getItem("Mainsetting") || "[{}]");
    const textileSerial = mainSet?.[0]?.TextilesSerialNowiseBilling ?? false;

if (textileSerial && p.SerialNoType === 1) {
  setTimeout(() => {
    setGridRows((prev) => {
      const row = prev.find((r) => r._key === rowKey);
      if (!row) return prev;
      setSerialNoList((currentSerials) => {
        const existingSerials = currentSerials.filter(
          (s) => s.IndexRefId === row.TextRefId
        );
        setSerialNoPopup({
          open: true,
          rowKey,
          textRefId: row.TextRefId,
          list: existingSerials,
          returnColKey: "ItemQty",  // after close, focus ItemQty cell on this row
        });
        return currentSerials; // no change to list
      });
      return prev; // no change to rows
    });
  }, 30);
}
  }, [calcRow, serialNoList, setSerialNoPopup]);

  // ── fillProductByCode ─────────────────────────────────────────────────────
  // Mirrors legacy jQuery FillItemsCode() EXACTLY:
  //
  //   API: POST /ItemMaster/SelectItemMasterbyCodeId
  //        { code, Comid: MComid, CComid: Comid, Id: 0, Batchwise: 0 }
  //
  //   Result Count Decision Tree (jQuery lines 4929–4999):
  //   ┌─ 0 items ──► ProductCreate_Purchase=false → show "Invalid Product Code" error
  //   │               ProductCreate_Purchase=true  → confirm() → open Item Create Popup
  //   ├─ 1 item  ──► FillItems() → direct grid add, NO popup
  //   └─ >1 items ─► MRPWindow() → open MRP Selection Popup, user picks one
  //
  // The Product Lookup Popup (productwindow) is NEVER opened by this function.
  // It is only opened when ProductCode cell is empty (handled in handleGridKeyDown).
  const fillProductByCode = useCallback(async (code, rowKey) => {
    if (!code?.trim()) return;

    try {
      setLoading(true);

      // ── API call mirrors jQuery ServiceCallById("/ItemMaster/SelectItemMasterbyCodeId", ...)
      // CC.ItemByCode = "/api/ItemMasterApp/SelectItemMasterbyCodeId"
      const res = await CC.api(
        CC.ItemByCode,
        null,
        {},
        {
          code:    code.trim(),
          Comid:   sess.MComid,
          CComid:  sess.Comid,
          Id:      0,
          Batchwise: 0,
        }
      );

      if (redirectIfDualLogin(res)) return;

      if (res?._netErr || res?._http404) {
        toast("❌ Technical Fault. Contact Software Vendor !!!.", true);
        return;
      }

      // Normalise response to array — API returns Data1 array directly
      const objPlist =
        Array.isArray(res)         ? res :
        Array.isArray(res?.Data1)  ? res.Data1 :
        Array.isArray(res?.data)   ? res.data :
        [];

      // ── Case 1: 0 results ─────────────────────────────────────────────────
      // jQuery: if (objPlist.length == 0) { if (!ProductCreate_Purchase) MsgBox(...); else confirm+dialog }
      if (objPlist.length === 0) {
        // Read ProductCreate_Purchase from Mainsetting (same var as jQuery line 70)
        const mainSet = JSON.parse(localStorage.getItem("Mainsetting") || "[{}]");
        const productCreatePurchase = mainSet?.[0]?.Product_Purchase ?? false;

        if (!productCreatePurchase) {
          // jQuery: MsgBox("Invaild Product Code !!!."); select cell; return
          toast("❌ Invalid Product Code !!!.", true);
          return;
        }

        // jQuery: confirm("Items Not Exists. Do You Want to Create New Items?")
        //         → open #somediv dialog (iframe /Itemmaster)
        const ok = await confirm("Items Not Exists. Do You Want to Create New Items?");
        if (!ok) return;

        // Open Item Create popup (replaces jQuery #somediv dialog + iframe /Itemmaster)
        setItemCreatePopup({ open: true, rowKey, code: code.trim() });
        return;
      }

      // ── Case 2: exactly 1 result ──────────────────────────────────────────
      // jQuery: methods.FillItems(objPlist, rowindex) — direct grid add, no popup
      if (objPlist.length === 1) {
        applyProductToRow(rowKey, objPlist[0]);
        return;
      }

      // ── Case 3: more than 1 result ────────────────────────────────────────
      // jQuery: MRPWindow("#mrpwindow", gridmrp, objPlist) — show MRP selection popup
      // Same product code with multiple MRP/Batch variants — user must pick one
      setMrpPopup({ open: true, rowKey, list: objPlist });

    } catch (err) {
      console.error(err);
      toast("❌ Product lookup failed", true);
    } finally {
      setLoading(false);
    }
  }, [
    sess,
    applyProductToRow,
    redirectIfDualLogin,
    toast,
    confirm,
  ]);
// Columns that should NOT trigger calcRow (mirrors jQuery empty else-if for batch fields)
const BATCH_ID_KEYS = new Set(["BrandId", "ModelId", "ColorId", "SizeId"]);

const handleCellChange = useCallback((rowKey, colKey, value) => {
  setGridRows((prev) => {
    const idx = prev.findIndex((r) => r._key === rowKey);
    if (idx === -1) return prev;
    let row = { ...prev[idx], [colKey]: value };
    // Batch dropdown columns: store value only, no financial recalc
    if (!BATCH_ID_KEYS.has(colKey) && CALC_KEYS.has(colKey)) {
      row = calcRow(row);
    }
    const updated = [...prev];
    updated[idx] = row;
    return updated;
  });
}, [calcRow]);

   // ── handleF5View ─────────────────────────────────────────────────────────────
  // Mirrors the jQuery F5View() method:
  //   Permission check → API POST /Purchase/SelectPurchase
  //   → Store master + details → Calculate total → Open popup
  //
  // Call signature  : handleF5View({ fromdate, todate, Id, SearchNo })
  //   All fields are optional; pass {} to load with current form state.
  // ─────────────────────────────────────────────────────────────────────────────
  const handleF5View = useCallback(async (objlist = {}) => {
    // 1. Permission guard (mirrors pageedit == 0 check)
    if (!perm.Edit) {
      toast("❌ Page Edit Permission Denied !!!.", true);
      return;
    }
 
    // 2. Build date range — fall back to current purchaseDate when not supplied
    const fromdate = objlist.fromdate ?? purchaseDate;
    const todate   = objlist.todate   ?? purchaseDate;
    const Id       = objlist.Id       ?? 0;
    const SearchNo = objlist.SearchNo ?? searchNo;
 
    // 3. Format dates to MM/dd/yyyy (matches jQuery $.jqx.dataFormat.formatdate)
    const fmtDate = (d) => {
      if (!d) return "";
      const dt = new Date(d);
      if (isNaN(dt)) return d; // already formatted or invalid — pass through
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      const yyyy = dt.getFullYear();
      return `${mm}/${dd}/${yyyy}`;
    };
 
    setLoading(true);
 
    try {
      // 4. API call — POST /Purchase/SelectPurchase
      //    Payload mirrors jQuery: { Comid, Fromdate, Todate, Id, SearchNo }
      //    NOTE: CC.SelectPurchase has a typo in Common.jsx ("/api//Purchase/…").
      //    We call the correct MVC route directly — same endpoint as the original jQuery $.ajax.
      // ✅ AFTER — params sent as ?Comid=1&Fromdate=...&SearchNo= → server binds correctly
const res = await CC.api(
  CC.SelectPurchase,
  null,        // no JSON body
  {},          // no extra headers
  { Comid: Number(sess.Comid), Fromdate: fmtDate(fromdate),
    Todate: fmtDate(todate),   Id: Number(Id), SearchNo: String(SearchNo) }
);
 
      // 5. Dual-login guard
      if (redirectIfDualLogin(res)) return;
 
      // 6. API-level error
      if (!res.ok) {
        toast(`❌ ${res.message || "Failed to load purchase list !!!."}`, true);
        return;
      }
 
      // 7. Extract master + details from response shape:
      //    { Data: [{ purchasemaster: [], purchasedetails: [] }] }
      //    (mirrors jQuery data.Data[0].purchasemaster / purchasedetails)
      const dataNode      = res.Data?.[0] ?? res.data?.[0] ?? {};
      const masterList    = dataNode.purchasemaster  ?? [];
      const detailList    = dataNode.purchasedetails ?? [];
 
      // 8. Calculate total (mirrors jQuery loop: total += masterdata[i].NetAmt)
      const total = masterList.reduce((sum, m) => sum + (parseFloat(m.NetAmt) || 0), 0);
 
      // 9. Store in state
      setF5MasterList(masterList);
      setF5DetailList(detailList);
      setF5TotalAmt(total.toFixed(2));
      setF5ExpandedRow(null);   // collapse all rows on fresh load
 
      // 10. Open popup
      setListViewOpen(true);
 
    } catch (err) {
      toast(`❌ ${err.message || "Technical Fault. Contact Software Vendor !!!."}`, true);
    } finally {
      setLoading(false);
    }
  }, [
    perm.Edit,
    purchaseDate,
    searchNo,
    sess.Comid,
    redirectIfDualLogin,
    toast,
  ]);



    // ── getDetailsForMaster ───────────────────────────────────────────────────────
  // Mirrors jQuery initrowdetails filter: PurchaseRefId === master.Id (uid)
  // ─────────────────────────────────────────────────────────────────────────────
  const getDetailsForMaster = useCallback((masterId) =>
    f5DetailList.filter(
      (d) => String(d.PurchaseRefId) === String(masterId)
    ),
  [f5DetailList]);
 
  // Toggle expand/collapse for a master row
  const toggleF5Row = useCallback((id) =>
    setF5ExpandedRow((prev) => (prev === id ? null : id)),
  []);

  // ── focusCell ──────────────────────────────────────────────────────────────
  const focusCell = useCallback((rowKey, colKey) => {
    setSelectedCell({ rowKey, colKey });
    setTimeout(() => {
      const el = document.getElementById(`cell_${rowKey}_${colKey}`);
      if (el) { el.focus(); el.select?.(); }
    }, 20);
  }, []);

  // Keep ref in sync so applyProductToRow (declared earlier) can call it without TDZ
  focusCellRef.current = focusCell;

  // ── deleteRow (grid) ───────────────────────────────────────────────────────
  const deleteGridRow = useCallback((rowKey) => {
    setGridRows((prev) => {
      const updated = prev.filter((r) => r._key !== rowKey);
      if (updated.length === 0) updated.push(makeGridRow());
      return updated;
    });
  }, []);

  // ── handleF2FreeProduct — mirrors jQuery F2 (keyCode 113) behavior ──────────
// Toggles "Free Product" mode on the currently selected grid row.
// F2 = Free-Qty toggle: zero out PurchaseRate (and related fields) or restore.
const handleF2FreeProduct = useCallback(async () => {
  // Must have a row selected
  if (!selectedCell.rowKey) {
    toast("❌ Invalid Check It !!!.", true);
    return;
  }

  const row = gridRows.find((r) => r._key === selectedCell.rowKey);
  if (!row) return;

  // jQuery: if ProductRefId is empty, shows "Invalid" but still proceeds
  if (!row.ProductRefId) {
    toast("❌ Invalid Check It !!!.", true);
    // jQuery continues even after this; we match that behavior
  }

  const ok = await confirm("Wish to Update Free Product Details ?");
  if (!ok) return;

  setGridRows((prev) => {
    const idx = prev.findIndex((r) => r._key === selectedCell.rowKey);
    if (idx === -1) return prev;
    const r = prev[idx];
    let updated;

    if (valNum(r.FreeQtyStatus) === 1) {
      // Currently free → restore
      updated = calcRow({
        ...r,
        FreeQtyStatus: 0,
        PurchaseRate: r.OldPurchaseRate,     // restore original rate
      });
    } else {
      // Not free → make free (zero out rate and all charges)
      updated = calcRow({
        ...r,
        FreeQtyStatus:   1,
        PurchaseRate:    "0.00",
        cdpercent:       "0.00",
        DiscountPercent: "0.00",
        CESSPer:         "0.00",
        SPLCESS:         "0.00",
      });
    }

    const rows = [...prev];
    rows[idx] = updated;
    return rows;
  });
}, [selectedCell.rowKey, gridRows, calcRow, confirm, toast]);


// ── handleGridKeyDown ──────────────────────────────────────────────────────
// const handleGridKeyDown = useCallback((e, rowKey, colKey) => {
//   const visibleCols = BASE_COLUMNS.filter((c) => {
//     const cfg = colConfig.find((x) => x.key === c.key);
//     return c.editable && (cfg ? cfg.visible : true);
//   });
//   const colIdx = visibleCols.findIndex((c) => c.key === colKey);
//   const rowIdx = gridRows.findIndex((r) => r._key === rowKey);

//   if (e.key === "Enter" || e.key === "Tab") {
//     e.preventDefault();

//     // ── ProductCode ────────────────────────────────────────────────────────
//     if (colKey === "ProductCode") {
//       const row = gridRows[rowIdx];
//       const code = nullStr(row.ProductCode).trim();
//       if (code === "") {
//         setProductPopup({ open: true, rowKey, list: [], query: "", autoLoad: true });
//         return;
//       }
//       fillProductByCode(code, rowKey);
//       return;
//     }

//     // ── ItemQty: open serial popup if applicable ───────────────────────────
//     if (colKey === "ItemQty") {
//       const row = gridRows[rowIdx];
//       const mainSet = JSON.parse(localStorage.getItem("Mainsetting") || "[{}]");
//       const textileSerial = mainSet?.[0]?.TextilesSerialNowiseBilling ?? false;
//       if (textileSerial && valNum(row.SerialNoStatus) === 1) {
//         const existingSerials = serialNoList.filter((s) => s.IndexRefId === row.TextRefId);
//         setSerialNoPopup({
//           open: true,
//           rowKey,
//           textRefId: row.TextRefId,
//           list: existingSerials,
//           returnColKey: "ItemQty",
//         });
//         return;
//       }
//     }

//     // ── MfgDate: auto-calculate ExpiryDate = MfgDate + Expirydays ─────────
//     if (colKey === "MfgDate") {
//       const row = gridRows[rowIdx];
//       const mfgDate = row.MfgDate;
//       const expDays = parseInt(row.Expirydays, 10) || 0;
//       if (mfgDate && expDays > 0) {
//         const expiry = new Date(mfgDate);
//         expiry.setDate(expiry.getDate() + expDays);
//         if (expiry <= new Date()) {
//           toast("❌ Already This Product Was Expired !!!.", true);
//           return;
//         }
//         const expDate = expiry.toISOString().split("T")[0];
//         setGridRows((prev) =>
//           prev.map((r) => r._key === rowKey ? { ...r, ExpiryDate: expDate } : r)
//         );
//       }
//     }

//     // ── ExpiryDate: validate not already expired ───────────────────────────
//     if (colKey === "ExpiryDate") {
//       const row = gridRows[rowIdx];
//       if (row.ExpiryDate && new Date(row.ExpiryDate) <= new Date()) {
//         toast("❌ Already This Product Was Expired !!!.", true);
//         return;
//       }
//     }

//     // ── Navigate to next cell ──────────────────────────────────────────────
//     const nextColIdx = colIdx + 1;
//     if (nextColIdx < visibleCols.length) {
//       focusCell(rowKey, visibleCols[nextColIdx].key);
//     } else if (rowIdx < gridRows.length - 1) {
//       focusCell(gridRows[rowIdx + 1]._key, visibleCols[0].key);
//     } else {
//       const emptyRow = makeGridRow();
//       setGridRows((prev) => [...prev, emptyRow]);
//       setTimeout(() => focusCell(emptyRow._key, visibleCols[0].key), 50);
//     }

//   } else if (e.key === "ArrowDown") {
//     e.preventDefault();
//     if (rowIdx < gridRows.length - 1) focusCell(gridRows[rowIdx + 1]._key, colKey);
//   } else if (e.key === "ArrowUp") {
//     e.preventDefault();
//     if (rowIdx > 0) focusCell(gridRows[rowIdx - 1]._key, colKey);
//   } else if (e.key === "ArrowRight" && colIdx < visibleCols.length - 1) {
//     if (e.currentTarget.selectionStart === e.currentTarget.value?.length) {
//       e.preventDefault();
//       focusCell(rowKey, visibleCols[colIdx + 1].key);
//     }
//   } else if (e.key === "ArrowLeft" && colIdx > 0) {
//     if (e.currentTarget.selectionStart === 0) {
//       e.preventDefault();
//       focusCell(rowKey, visibleCols[colIdx - 1].key);
//     }
//   } else if (e.key === "Delete" && e.shiftKey) {
//     deleteGridRow(rowKey);
//   }
// }, [gridRows, colConfig, fillProductByCode, deleteGridRow, focusCell, serialNoList, setSerialNoPopup, toast]);
 
const handleGridKeyDown = useCallback((e, rowKey, colKey) => {
  const visibleCols = BASE_COLUMNS.filter((c) => {
    const cfg = colConfig.find((x) => x.key === c.key);
    return c.editable && (cfg ? cfg.visible : true);
  });

  const colIdx = visibleCols.findIndex((c) => c.key === colKey);
  const rowIdx = gridRows.findIndex((r) => r._key === rowKey);

  if (e.key === "Enter" || e.key === "Tab") {
    e.preventDefault();

    // ── ProductCode ─────────────────────────────────────────────
    if (colKey === "ProductCode") {
      const row = gridRows[rowIdx];
      const code = nullStr(row.ProductCode).trim();

      if (code === "") {
        setProductPopup({
          open: true,
          rowKey,
          list: [],
          query: "",
          autoLoad: true,
        });
        return;
      }

      fillProductByCode(code, rowKey);
      return;
    }

    // ── ItemQty ────────────────────────────────────────────────
    if (colKey === "ItemQty") {
      const row = gridRows[rowIdx];
      const mainSet = JSON.parse(
        localStorage.getItem("Mainsetting") || "[{}]"
      );

      const textileSerial =
        mainSet?.[0]?.TextilesSerialNowiseBilling ?? false;

      if (textileSerial && valNum(row.SerialNoStatus) === 1) {
        const existingSerials = serialNoList.filter(
          (s) => s.IndexRefId === row.TextRefId
        );

        setSerialNoPopup({
          open: true,
          rowKey,
          textRefId: row.TextRefId,
          list: existingSerials,
          returnColKey: "ItemQty",
        });

        return;
      }
    }

    // ── MfgDate ────────────────────────────────────────────────
    if (colKey === "MfgDate") {
      const row = gridRows[rowIdx];
      const mfgDate = row.MfgDate;
      const expDays = parseInt(row.Expirydays, 10) || 0;

      if (mfgDate && expDays > 0) {
        const expiry = new Date(mfgDate);
        expiry.setDate(expiry.getDate() + expDays);

        if (expiry <= new Date()) {
          toast("❌ Already This Product Was Expired !!!.", true);
          return;
        }

        const expDate = expiry.toISOString().split("T")[0];

        setGridRows((prev) =>
          prev.map((r) =>
            r._key === rowKey
              ? { ...r, ExpiryDate: expDate }
              : r
          )
        );
      }
    }

    // ── ExpiryDate ─────────────────────────────────────────────
    if (colKey === "ExpiryDate") {
      const row = gridRows[rowIdx];

      if (row.ExpiryDate) {
        const expDate = new Date(row.ExpiryDate);

        if (expDate <= new Date()) {
          toast("❌ Already This Product Was Expired !!!.", true);
          return;
        }
      }
    }

    // ── Move Next Cell ─────────────────────────────────────────
    // Read live focus config via ref — avoids stale closure on focusgridcolumns.
    const liveFocusCols = focusgridcolumnsRef.current;
    const focusEnabledCols = visibleCols.filter((c) => {
      const fc = liveFocusCols.find((f) => f.column === c.key);
      return fc ? fc.focus === 1 : true;
    });
    
    const focusColIdx = focusEnabledCols.findIndex((c) => c.key === colKey);
    const nextFocusCol = focusEnabledCols[focusColIdx + 1];
    const firstFocusCol = focusEnabledCols[0]?.key ?? visibleCols[0].key;
    
    if (nextFocusCol) {
      focusCell(rowKey, nextFocusCol.key);
    } else if (rowIdx < gridRows.length - 1) {
      focusCell(gridRows[rowIdx + 1]._key, firstFocusCol);
    } else {
      const emptyRow = makeGridRow();
      setGridRows((prev) => [...prev, emptyRow]);
      setTimeout(() => focusCell(emptyRow._key, firstFocusCol), 50);
    }
  }

  else if (e.key === "ArrowDown") {
    e.preventDefault();
    if (rowIdx < gridRows.length - 1) {
      focusCell(gridRows[rowIdx + 1]._key, colKey);
    }
  }

  else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (rowIdx > 0) {
      focusCell(gridRows[rowIdx - 1]._key, colKey);
    }
  }

  else if (
    e.key === "ArrowRight" &&
    colIdx < visibleCols.length - 1
  ) {
    if (
      e.currentTarget.selectionStart ===
      e.currentTarget.value?.length
    ) {
      e.preventDefault();
      focusCell(rowKey, visibleCols[colIdx + 1].key);
    }
  }

  else if (
    e.key === "ArrowLeft" &&
    colIdx > 0
  ) {
    if (e.currentTarget.selectionStart === 0) {
      e.preventDefault();
      focusCell(rowKey, visibleCols[colIdx - 1].key);
    }
  }

  else if (e.key === "Delete" && e.shiftKey) {
    deleteGridRow(rowKey);
  }

}, [
  gridRows,
  colConfig,
  fillProductByCode,
  deleteGridRow,
  focusCell,
  serialNoList,
  setSerialNoPopup,
  toast,
  // focusgridcolumnsRef is a ref — no need to list it; always current
]);

// ── handleClear ───────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    setEditId(0);
    setPurchaseDate(today());
    setDueDate(today());
    setInvoiceDate(today());
    setInvoiceNo("");
    setInvoiceAmt("0.00");
    setRemarks("");
    setPurchaseType("CREDIT");
    setIgstStatus("GST");
    setIgstChecked(false);
    setSupplierId("");
    setSupplierInfo({ address: "", city: "", phone: "", balance: "0.00" });
    setOtherPlus("0.00");
    setOtherSub("0.00");
    setTcsPercent("0.00");
    setTcsAmt("0.00");
    setLoadding("");
    setLorryNo("");
    setGridRows([makeGridRow()]);
    setGstSplit([]);
    setTotals({ ...EMPTY_TOTALS });
    loadMaxPurchaseNo();
    setUpdateIdEdit("");
    setSerialNoList([]);
  }, [loadMaxPurchaseNo]);

  // ── loadColConfig — fetch saved JSON and apply to colConfig ─────────────
  // ⚠️  jQuery F12Config inverts the Visible flag when reading from JSON:
  //       if (savedVis == false) setVis = true;  else setVis = false;
  //     So the stored value is the OPPOSITE of what should be shown.
  //     We replicate that same inversion here on load, and store the
  //     inverted value on save so the round-trip stays consistent.
  const loadColConfig = useCallback(async () => {
    try {
      const url = `/Content/Appdata/Visible/${sess.MComid}/Purchase.json?v=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) return; // file doesn't exist yet — use defaults
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return;
      // Merge saved prefs into colConfig.
      // jQuery inverts: savedVisible=false → column is SHOWN (visible=true)
      //                  savedVisible=true  → column is HIDDEN (visible=false)
      setColConfig((prev) =>
        prev.map((cfg) => {
          const saved = data.find((d) => d.column === cfg.key);
          if (!saved) return cfg;
          // Invert exactly as jQuery does
          const visible = saved.Visible === false ? true : false;
          return { ...cfg, visible, width: saved.Width };
        })
      );
    } catch {
      // ignore — file missing is normal on first use
    }
  }, [sess.MComid]);

  // ── loadFocusColumns — fetch PurchaseFocus.json and build draft ───────────
// ── loadFocusColumns — fetch PurchaseFocus.json and build draft ───────────
const loadFocusColumns = useCallback(async () => {
  // ── Mirror jQuery Ctrl+G logic (Purchase.js lines 2827-2843) ─────────────
  // jQuery: for each column in InVisibleColumns,
  //   if (gridpurchase.jqxGrid('iscolumnvisible', col) == true)  ← live grid check
  //     columnsnew.push({ column, Focus: true, ... })
  //
  // React equivalent: read colConfigRef.current (always up-to-date ref, never
  // a stale closure) so we get the same live visibility that jQuery reads from
  // the grid at the moment Ctrl+G is pressed.
  const liveColConfig = colConfigRef.current;

  const visibleBases = BASE_COLUMNS.filter((c) => {
    const cfg = liveColConfig.find((x) => x.key === c.key);
    return cfg ? cfg.visible : c.defaultVisible;
  });

  let draft = visibleBases.map((c, i) => ({
    filename: "PurchaseFocus",
    column:   c.key,
    label:    c.label,
    Index:    i,
    Focus:    true,   // default — enabled for all visible columns
    Comid:    sess.MComid,
  }));

  // Overlay saved focus settings from server JSON.
  // Only apply to columns that are currently visible (already filtered above).
  // jQuery: findcolumnindex(columnsnew, col, 'column') — skips columns not in
  // columnsnew, i.e. skips hidden columns automatically.
  try {
    const url = `/Content/Appdata/Visible/${sess.MComid}/PurchaseFocus.json?v=${Date.now()}`;
    const res = await fetch(url);
    if (res.ok) {
      const saved = await res.json();
      if (Array.isArray(saved) && saved.length > 0) {
        saved.forEach((s) => {
          const idx = draft.findIndex((d) => d.column === s.column);
          if (idx !== -1) {
            draft[idx].Focus = s.Focus === true || s.Focus === "true" || s.Focus === 1;
            draft[idx].Index = s.Index;
          }
          // If idx === -1, column is currently hidden by F12 → skip it,
          // exactly as jQuery does when findcolumnindex returns null.
        });

        // Sort by saved Index (mirrors jQuery columnsnew.sort(compare))
        draft.sort((a, b) => a.Index - b.Index);
      }
    }
  } catch {
    // file missing on first use — keep defaults
  }

  setFocusColDraft(draft);
  // colConfigRef is a ref, not state — safe to omit from deps without stale-closure risk
}, [sess.MComid]);
// ── handleFocusColOpen — build draft then open modal ─────────────────────
const handleFocusColOpen = useCallback(async () => {
  await loadFocusColumns();
  
  setFocusColOpen(true);
}, [loadFocusColumns]);



// Load column config + focus config once authorized
useEffect(() => {
  if (!isAuthorized) return;
  loadColConfig();
  loadFocusColumns();
}, [isAuthorized, loadColConfig, loadFocusColumns]);

  // ── handleFocusColSave — POST to /Login/FocusColumns (mirrors jQuery savefocus) ──
const handleFocusColSave = useCallback(async () => {
  // Payload exactly matches jQuery:
  // [{ filename:'PurchaseFocus', column, Index, Focus, Comid }]
  const payload = focusColDraft.map((d, i) => ({
    filename: "PurchaseFocus",
    column:   d.column,
    Index:    i,            // current order position
    Focus:    d.Focus,
    Comid:    sess.MComid,
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
    } else {
      toast(`❌ ${res?.message || "Save failed !!!."}`, true);
    }
  } catch {
    setLoading(false);
    toast("❌ Technical Fault. Contact Software Vendor !!!.", true);
  }
}, [focusColDraft, sess.MComid, redirectIfDualLogin, toast]);

// ── focusgridcolumns — runtime list consumed by Tab/Enter cell navigation ─
// Mirrors jQuery: focusgridcolumns = [{ column, focus }] built by reordercolumns()
// Derived from focusColDraft so it is always in saved order.
// Use this wherever the grid needs to know which columns are focus-enabled.
const focusgridcolumns = focusColDraft.map((d) => ({
  column: d.column,
  focus:  d.Focus ? 1 : 0,
}));

// ── focusgridcolumnsRef — always-current ref so stable useCallbacks
// (applyProductToRow, handleGridKeyDown) read live focus config without
// stale closures. Updated every render just like colConfigRef.
const focusgridcolumnsRef = useRef(focusgridcolumns);
focusgridcolumnsRef.current = focusgridcolumns;
// ── FocusColumns drag handlers (reorder inside modal) ─────────────────────
const handleFocusDragStart = useCallback((idx) => {
  setFocusColDragIdx(idx);
}, []);

const handleFocusDragOver = useCallback((e, idx) => {
  e.preventDefault();
  if (focusColDragIdx === null || focusColDragIdx === idx) return;
  setFocusColDraft((prev) => {
    const next = [...prev];
    const [moved] = next.splice(focusColDragIdx, 1);
    next.splice(idx, 0, moved);
    return next; // jQuery never updates Index during drag — only at save time
  });
  setFocusColDragIdx(idx);
}, [focusColDragIdx]);

const handleFocusDragEnd = useCallback(() => {
  setFocusColDragIdx(null);
}, []);

const handleFocusToggle = useCallback((idx, field, val) => {
  setFocusColDraft((prev) =>
    prev.map((d, i) => (i === idx ? { ...d, [field]: val } : d))
  );
}, []);



  // ── handleF12Open — open popup and initialise draft from current colConfig ─
  // Also saves the currently selected cell so focus can be restored on close.
  const f12PrevCellRef = useRef(null);
  const handleF12Open = useCallback(() => {
    // Snapshot the current selected cell BEFORE opening the popup
    f12PrevCellRef.current = { ...selectedCell };
    setF12Draft(colConfig.map((c) => ({ ...c })));
    setF12Open(true);
  }, [colConfig, selectedCell]);

  // ── handleF12Save — POST to /Login/VisibleColumns then reload ────────────
  // ⚠️  jQuery savewidth posts the Visible flag AS-IS from the grid (which holds
  //     the inverted value loaded earlier). So the JSON always stores the inverse
  //     of the display state. We must invert c.visible before posting so the
  //     server file stays in the same inverted format jQuery writes.
  const handleF12Save = useCallback(async () => {
    // Build payload matching backend VisibleColumnsModel:
    // { filename, column, Visible, Width, Comid }
    // Invert visible: c.visible=true(shown) → stored as false; c.visible=false(hidden) → stored as true
    const payload = f12Draft.map((c) => ({
      filename: "Purchase",
      column:   c.key,
      Visible:  !c.visible,   // invert to match jQuery storage convention
      Width:    Number(c.width),
      Comid:    sess.MComid,
    }));

    try {
      setLoading(true);
      const res = await fetch("/Login/VisibleColumns", {
        method:  "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      setLoading(false);
      if (data.ok) {
        // Apply changes immediately to live colConfig (no page reload needed for instant feedback)
        setColConfig(f12Draft.map((c) => ({ ...c })));
        setF12Open(false);
        // Restore focus to previously selected cell
        const prev = f12PrevCellRef.current;
        if (prev && prev.rowKey && prev.colKey) {
          setTimeout(() => {
            const el = document.getElementById(`cell_${prev.rowKey}_${prev.colKey}`);
            if (el) { el.focus(); el.select?.(); }
          }, 50);
        }
        toast("✅ Columns Visible & Width Updated Successfully.");
      } else {
        toast(`❌ ${data.message || "Save failed !!!."}`, true);
      }
    } catch {
      setLoading(false);
      toast("❌ Technical Fault. Contact Software Vendor !!!.", true);
    }
  }, [f12Draft, sess.MComid, toast]);

  // ── f12Draft helpers ──────────────────────────────────────────────────────
  const f12SetVisible = useCallback((key, val) => {
    setF12Draft((prev) =>
      prev.map((c) => (c.key === key ? { ...c, visible: val } : c))
    );
  }, []);

  const f12SetWidth = useCallback((key, val) => {
    setF12Draft((prev) =>
      prev.map((c) => (c.key === key ? { ...c, width: Number(val) || c.width } : c))
    );
  }, []);

  // ── sanitizeDetailRow — coerce all numeric string fields to numbers ──────────
  // C# model expects int/decimal, not strings. grid stores everything as strings.
  const sanitizeDetailRow = useCallback((r) => {
    const n = (v) => { const x = parseFloat(v); return isNaN(x) ? 0 : x; };
    const i = (v) => { const x = parseInt(v, 10); return isNaN(x) ? 0 : x; };
    return {
      PDId:            i(r.PDId),
      ProductRefId:    i(r.ProductRefId),
      ProductCode:     r.ProductCode   || "",
      ProductName:     r.ProductName   || "",
      HSNCode:         r.HSNCode       || "",
      UOM:             r.UOM           || "",
      UOMDecimal:      i(r.UOMDecimal),
      UOMRefid:        i(r.UOMRefid) || null,
      MRP:             n(r.MRP),
      OldMRP:          n(r.OldMRP),
      OldPurchaseRate: n(r.OldPurchaseRate),
      PurchaseRate:    n(r.PurchaseRate),
      cdpercent:       n(r.cdpercent),
      cdAmount:        n(r.cdAmount),
      DiscountPercent: n(r.DiscountPercent),
      DiscountAmt:     n(r.DiscountAmt),
      CESSPer:         n(r.CESSPer),
      CESSAmount:      n(r.CESSAmount),
      SPLCESS:         n(r.SPLCESS),
      SPLCESSAmount:   n(r.SPLCESSAmount),
      TaxPercent:      n(r.TaxPercent),
      TaxAmt:          n(r.TaxAmt),
      CTAmount:        n(r.CTAmount),
      STAmount:        n(r.STAmount),
      CTPer:           n(r.CTPer),
      STPer:           n(r.STPer),
      Noms:            i(r.Noms),
      NomQty:          i(r.NomQty),
      ItemQty:         n(r.ItemQty),
      FreeQty:         n(r.FreeQty),
      StockQty:        n(r.StockQty),
      StockQtyNew:     n(r.StockQtyNew),
      Nstock:          n(r.Nstock),
      RealQty:         n(r.RealQty),
      TotalPcs:        n(r.TotalPcs),
      Meter:           n(r.Meter),
      Pcs:             n(r.Pcs),
      ExpiryDate:      r.ExpiryDate   || "",
      MfgDate:         r.MfgDate      || "",
      Bat_No:          r.Bat_No       || "",
      BatchRefId:      i(r.BatchRefId) || 0,
      BatchStatus:     i(r.BatchStatus),
      Expirydays:      i(r.Expirydays),
      Salerate:        n(r.Salerate),
      WholeSalerate:   n(r.WholeSalerate),
      ProfitPer:       n(r.ProfitPer),
      ProfitAmt:       n(r.ProfitAmt),
      SaleDiscPer:     n(r.SaleDiscPer),
      SaleDiscAmt:     n(r.SaleDiscAmt),
      NetSaleRate:     n(r.NetSaleRate),
      SaleGST:         n(r.SaleGST),
      TransPer:        n(r.TransPer),
      TransAmt:        n(r.TransAmt),
      LandingCost:     n(r.LandingCost),
      IGSTAmt:         n(r.IGSTAmt),
      Amount:          n(r.Amount),
      ProductTotal:    n(r.ProductTotal),
      PoRefId:         i(r.PoRefId)   || 0,
      EditMode:        i(r.EditMode),
      SerialNoStatus:  i(r.SerialNoStatus),
      FreeQtyStatus:   i(r.FreeQtyStatus),
      MrpStatus:       i(r.MrpStatus),
      Narration:       r.Narration    || "",
      TextRefId:       r.TextRefId    || "",
      SizeId:          i(r.SizeId)    || 0,
      BrandId:         i(r.BrandId)   || 0,
      ModelId:         i(r.ModelId)   || 0,
      ColorId:         i(r.ColorId)   || 0,
      GengerId:        i(r.GengerId)  || 0,
      ToSizeId:        i(r.ToSizeId)  || 0,
    };
  }, []);



  // ── handleEdit ─────────────────────────────────────────────────────────────
  const handleEdit = useCallback(async (pid, pno) => {
    if (!perm.Edit) { toast("❌ Page Edit Permission Denied !!!.", true); return; }
    setLoading(true);
    const res = await CC.api(
      CC.EditPurchase,
      null,
      {},
      { Id: pid, PNo: pno, Comid: sess.Comid, BatchwiseSizeStock: 0 }
    );

    setLoading(false);

    if (redirectIfDualLogin(res)) return;
    if (res._netErr || res._http404) { toast(`❌ ${res.message || "Edit load failed !!!."}`, true); return; }

    if (res.ok && res.Data1 && res.Data1.length > 0) {
      const pm = res.Data1[0];
      const pd = pm.PurchaseDetails || [];

      setEditId(pm.Id);
      setUpdateIdEdit(pm.UpdateId || "");
      setPurchaseDate(jsonDate(pm.PurchaseDate));
      setDueDate(jsonDate(pm.DueDate));
      setInvoiceDate(jsonDate(pm.SupplierInvoiceDate));
      setPurchaseNo(pm.PurchaseNo || "");
      setInvoiceNo(pm.SupplierInvoiceNo || "");
      setInvoiceAmt(fmt2(pm.NetAmt));
      setOtherPlus(fmt2(pm.Others_A));
      setOtherSub(fmt2(pm.Others_D));
      setRemarks(pm.Remarks || "");
      setPurchaseType(pm.PurchaseType === "CA" ? "CASH" : "CREDIT");
      setSupplierId(String(pm.SupplierRefId));
      handleSupplierChange(String(pm.SupplierRefId));

      const igst = pm.IGSTBill;
      const isIgst = igst === "IGST" || igst === "1" || igst === "2";
      setIgstStatus(isIgst ? "IGST" : "GST");
      setIgstChecked(isIgst);

      // ── Restore SerialNoDetails (mirrors jQuery: SerialNodatalist = getdata[0].SerialNoDetails) ──
      const serialDetails = pm.SerialNoDetails || [];
      setSerialNoList(serialDetails);

      // const rows = pd.map((r) => calcRow({ ...makeGridRow(), ...r }));
      // rows.push(makeGridRow());

      const rows = pd.map((r) => calcRow({
        ...makeGridRow(),
        ...r,
        BrandId: r.BrandId  ? String(r.BrandId)  : "",
        ModelId: r.ModelId  ? String(r.ModelId)  : "",
        ColorId: r.ColorId  ? String(r.ColorId)  : "",
        SizeId:  r.SizeId   ? String(r.SizeId)   : "",
      }));
      rows.push(makeGridRow());
      setGridRows(rows);
    } else {
      toast(`❌ ${res.message || "Edit load failed !!!."}`, true);
    }
  }, [perm, sess, calcRow, handleSupplierChange, toast, redirectIfDualLogin]);

  // ── handleDelete ───────────────────────────────────────────────────────────
  // Mirrors jQuery F9 flow:
  //   Permission check → confirm → DELETE with correct headers
  //   Headers: Year, Comid, Id, MirrorTable, UpdateId, univercell

  const handleDelete = useCallback(async (overrideId, overridePno, overrideUpdateId) => {
    const targetId       = overrideId  || editId;
    const displayPno     = overridePno || purchaseNo;
    const targetUpdateId = overrideUpdateId !== undefined ? overrideUpdateId : updateIdEdit;
  
    if (!perm.Delete) { toast("❌ Page Delete Permission Denied !!!.", true); return; }
    if (!targetId)    { toast("❌ No Delete Id !!!.", true); return; }
  
    const str = `Do You Want To Delete Purchase Master. This is Purchase No ${displayPno}?`;
    const ok = await confirm(str);
    if (!ok) return;
  
    setLoading(true);
  
    const FYear = (new Date().getFullYear()).toString();
    const res = await CC.api(
      CC.DeletePurchase,
      [],
      {
        Year:        FYear,
        Comid:       String(sess.Comid),
        Id:          String(targetId),
        MirrorTable: String(sess.MirrorTable),
        Updateid:    targetUpdateId || "",
        LocalDB:     String(sess.LocalDB ?? "0"),
        univercell:  "false",
        DayClose:    "0",
        Date:        new Date().toLocaleDateString("en-GB"),
      },
      null
    );
  
    setLoading(false);
  
    if (redirectIfDualLogin(res)) return;
    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }
  
    if (res.ok) {
      toast("✅ " + (res.message || "Purchase deleted successfully!"));
      handleClear();
      if (listViewOpen) handleF5View({});
    } else {
      if (res.redis === false) {
        alert("Already Login Another User Please Login Again!!!");
        navigate("/");
        return;
      }
      toast(`❌ ${res.message || "Delete failed !!!."}`, true);
    }
  }, [
    perm, editId, purchaseNo, updateIdEdit, sess,
    confirm, toast, redirectIfDualLogin, handleClear,
    listViewOpen, handleF5View, navigate
  ]);

  // ── openEditPassword ────────────────────────────────────────────────────────
// Mirrors jQuery: EditPasswordWindow(type) + Presskey logic
// Call this before any edit/delete operation that requires a password gate.
//
// action: { type: "EDIT", id, pno } | { type: "DELETE", id }
const openEditPassword = useCallback((action) => {
  setPendingEditAction(action);
  setEditPwdValue("");
  setEditPwdError("");
  setEditPwdOpen(true);
}, []);

// ── handleEditPasswordSubmit ────────────────────────────────────────────────
// Mirrors jQuery: #txtEditpassword keydown Enter → POST /Login/EditPassword
//   type="EditPassword", on ok → close modal → fire pendingEditAction
const handleEditPasswordSubmit = useCallback(async () => {
  if (!editPwdValue.trim()) return;

  setEditPwdLoading(true);
  setEditPwdError("");

  const res = await CC.api(
    CC.EditPassword,
    null,
    {},
    { password: editPwdValue, type: "EditPassword", Comid: sess.Comid }
  );

  setEditPwdLoading(false);

  if (res?.ok === true || res?.data?.ok === true) {
    setEditPwdOpen(false);
    setEditPwdValue("");

    const action = pendingEditAction;
    setPendingEditAction(null);

    if (!action) return;

    if (action.type === "EDIT") {
      setListViewOpen(false);
      handleEdit(action.id, action.pno || 0);
    } else if (action.type === "DELETE") {
      setListViewOpen(false);
      setEditId(action.id);
      setUpdateIdEdit(action.updateId || "");
      // Pass all three overrides directly — avoids stale closure on updateIdEdit/purchaseNo
      handleDelete(action.id, action.pno || "", action.updateId || "");
    }
  } else {
    setEditPwdError("Invalid Password !!!.");
  }
}, [
  editPwdValue, sess.Comid, pendingEditAction,
  handleEdit, handleDelete
]);
  // ── handleSave ─────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!perm.Add) { toast("❌ Page Add Permission Denied !!!.", true); return; }
    if (!supplierId) {
      toast("❌ Select Valid Supplier !!!.", true);
      supplierRef.current?.focus();
      return;
    }
    if (!invoiceNo.trim()) {
      toast("❌ Enter Supplier Invoice Number !!!.", true);
      invoiceNoRef.current?.focus();
      return;
    }
    if (valNum(totals.netAmt) <= 0) {
      toast("❌ Net Total must not be Negative !!!.", true);
      return;
    }
    if (valNum(invoiceAmt) !== valNum(totals.netAmt)) {
      toast("❌ Invoice Amount Not Equal To Net Total Amount !!!.", true);
      invoiceAmtRef.current?.focus();
      return;
    }

    // ── BatchWiseStock validation (mirrors jQuery save validation) ──
    // If BatchStatus==1 (batch-tracked item) and Bat_No is empty, block save
    const mainSet = JSON.parse(localStorage.getItem("Mainsetting") || "[{}]");
    const batchWiseStock = mainSet?.[0]?.BatchWiseStock ?? false;
    const textileSerial = mainSet?.[0]?.TextilesSerialNowiseBilling ?? false;
    if (batchWiseStock || textileSerial) {
      const dataRows = gridRows.filter((r) => r.ProductCode !== "");
      for (let i = 0; i < dataRows.length; i++) {
        const r = dataRows[i];
        // if (valNum(r.BatchStatus) === 1 && !r.Bat_No?.trim()) {
        //   toast(`❌ Enter Batch No for item: ${r.ProductName || r.ProductCode} !!!.`, true);
        //   // Focus that row's Bat_No cell
        //   setTimeout(() => {
        //     const el = document.getElementById(`cell_${r._key}_Bat_No`);
        //     if (el) { el.focus(); el.select?.(); }
        //   }, 50);
        //   return;
        // }
      }
      // TextilesSerialNowiseBilling: validate serial count == item qty
      if (textileSerial) {
        for (let i = 0; i < dataRows.length; i++) {
          const r = dataRows[i];
          if (valNum(r.SerialNoStatus) === 1) {
            const serials = serialNoList.filter((s) => s.IndexRefId === r.TextRefId);
            if (serials.length === 0) {
              toast(`❌ Enter Serial Numbers for item: ${r.ProductName || r.ProductCode} !!!.`, true);
              return;
            }
            if (serials.length !== valNum(r.ItemQty)) {
              toast(`❌ Serial No count (${serials.length}) must equal Quantity (${r.ItemQty}) for ${r.ProductName || r.ProductCode} !!!.`, true);
              return;
            }
          }
        }
      }
    }

    const ok = await confirm("Wish to Save Purchase Details ?");
    if (!ok) return;

    setLoading(true);

    const supplier        = supplierList.find((s) => String(s.Id) === String(supplierId)) || {};
    const purchaseDetails = gridRows.filter((r) => r.ProductCode !== "").map(sanitizeDetailRow);
    const purtype         = purchaseType === "CASH" ? "CA" : "CR";

    const purchaseMaster = [{
      Id:                  editId,
      Modified_By:         parseInt(localStorage.getItem("userid") || "0", 10),
      SupplierRefId:       parseInt(supplierId, 10) || 0,
      PurchaseNo:          purchaseNo,
      CompanyRefId:        parseInt(sess.Comid, 10) || 0,
      PurchaseDate:        purchaseDate,
      PurchaseType:        purtype,
      IGSTBill:            igstStatus,
      taxamount:           valNum(totals.gstAmt),
      CTAmount:            valNum(totals.cgstAmt),
      STAmount:            valNum(totals.sgstAmt),
      SupplierInvoiceNo:   invoiceNo,
      SupplierInvoiceDate: invoiceDate,
      NetAmt:              valNum(totals.netAmt),
      discamount:          valNum(totals.discAmt),
      cdamount:            valNum(totals.cdAmt),
      Others_A:            valNum(otherPlus),
      Others_D:            valNum(otherSub),
      DueDate:             dueDate,
      DisplayAmount:       valNum(totals.displayAmt),
      FreightCharges:      valNum(totals.transAmt),
      CESSAmount:          valNum(totals.cessAmt),
      SPLCESSAmount:       0,
      Remarks:             remarks,
      // UpdateId:            "",
      UpdateId: updateIdEdit || "",
      Credit:              0,
      Debit:               valNum(totals.netAmt),
      IGSTAmount:          0,
      // SupplierName:        supplier.SupplierName || "",
      SupplierName: supplier.AccountName || "",
      Address1:            supplier.Address1     || "",
      Address2:            supplier.Address2     || "",
      City:                supplier.City         || "",
      Phone:               supplier.MobileNo     || "",
      Tin:                 supplier.GSTNo        || "",
      PurchaseDetails:     purchaseDetails,
      StockDetails:        [],
      SerialNoDetails: serialNoList,
    }];

    // const res = await CC.insertapi(
    //   CC.InsertPurchase,
    //   purchaseMaster,
    //   {
    //     Comid:       String(parseInt(sess.Comid)),
    //     MirrorTable: String(sess.MirrorTable),
    //     IdComList:   String(sess.IdComList),
    //   }
    // );
console.log(purchaseMaster);
    const res = await CC.insertapi(
      CC.InsertPurchase,
      purchaseMaster,
      {
        Comid: String(sess.Comid),
        MirrorTable: String(sess.MirrorTable),
        IdComList: String(sess.IdComList),
    
    

batchstockstatus: (() => {
  const ms = JSON.parse(localStorage.getItem("Mainsetting") || "[{}]");

  return (
    ms?.[0]?.BatchWiseStock === true ||
    ms?.[0]?.TextilesSerialNowiseBilling === true
  )
    ? "1"
    : "0";
})(),
        ItemMasterRateUpdate: String(sess.ItemMasterRateUpdate ?? false),
        ItemMasterEditRateUpdate: String(sess.ItemMasterRateUpdate ?? false),
        Commoncompany: String(sess.Commoncompany ?? false),
        CommoncompanyDiffStock: String(sess.CommoncompanyDiffStock ?? false),
        SupplierMulitipleAllow: String(sess.SupplierMulitipleAllow ?? false),
        MulipleMRP: String(sess.MulipleMRP ?? false),
        BatchPerfix: String(sess.BatchPerfix ?? ""),
        BatchDigit: String(parseInt(sess.BatchDigit, 10) || 0),
        LocalDB: String(parseInt(sess.LocalDB, 10) || 0),
        Patty: "0",
        DayClose: "0",
        BillFormatName: "",
        PrintA4Invoice: "0"
      }
    );

    setLoading(false);

    if (redirectIfDualLogin(res)) return;

    if (res.ok || res.IsSuccess) {
      toast("✅ " + (res.message || "Purchase saved successfully!"));
      handleClear();
      
    } else {
      toast(`❌ ${res.message || "Save failed !!!."}`, true);
    }
  // }, [
  //   perm, supplierId, invoiceNo, totals, invoiceAmt,
  //   gridRows, purchaseType, editId, purchaseNo, sess,
  //   purchaseDate, invoiceDate, dueDate, igstStatus,
  //   otherPlus, otherSub, remarks, supplierList,
  //   confirm, toast, redirectIfDualLogin, handleClear, sanitizeDetailRow,
  // ]);
}, [
  perm, supplierId, invoiceNo, totals, invoiceAmt,
  gridRows, purchaseType, editId, updateIdEdit,
  purchaseNo, sess,
  purchaseDate, invoiceDate, dueDate, igstStatus,
  otherPlus, otherSub, remarks, supplierList,
  serialNoList,   // ← add this
  confirm, toast, redirectIfDualLogin, handleClear, sanitizeDetailRow,
]);

  // ── handleSearch ───────────────────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    setLoading(true);

    const res = await CC.api(
      CC.PurchaseList,
      null,
      {},
      { Comid: sess.Comid, SearchNo: searchNo }
    );

    setLoading(false);

    if (redirectIfDualLogin(res)) return;
    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

    const list = Array.isArray(res) ? res : (res.data || res.Data1 || []);
    setViewList(list);
  }, [sess.Comid, searchNo, redirectIfDualLogin, toast]);


// ── Global keyboard shortcuts ──────────────────────────────────────────────
useEffect(() => {
  const onKey = (e) => {
    // Never fire shortcuts when any popup is already open
    if (productPopup.open || f12Open || listViewOpen || focusColOpen || serialNoPopup.open) return;

    if (e.keyCode === 112) { e.preventDefault(); handleSave();    }  // F1 → Save
    if (e.keyCode === 113) {                                          // F2 → Free Product Toggle
      e.preventDefault();
      handleF2FreeProduct();
    }
    if (e.keyCode === 114) {                                          // F3 → Product Search Popup
      e.preventDefault();
      // Open product popup on the last active/empty row (mirrors jQuery #productwindow)
      const targetRow = gridRows[gridRows.length - 1];
      setProductPopup({ open: true, rowKey: targetRow._key, list: [], query: "" });
    }
    if (e.keyCode === 115) {  e.preventDefault(); handleDelete(); }  // F4 → Delete
    if (e.keyCode === 116) { e.preventDefault(); handleF5View({}); }  // F5 → F5View

    if (e.keyCode === 120) {
      e.preventDefault();
      if (!perm.Delete) { toast("❌ Page Delete Permission Denied !!!.", true); return; }
      if (!editId) { toast("❌ No Delete Id !!!.", true); return; }
      openEditPassword({ type: "DELETE", id: editId, updateId: updateIdEdit });
    }
    if (e.keyCode === 121) { e.preventDefault(); handleClear();   }  // F10 → Clear
    if (e.keyCode === 123) { e.preventDefault(); handleF12Open(); }  // F12 → Columns
    // Ctrl+G → FocusColumns
    if (e.ctrlKey && e.keyCode === 71) { e.preventDefault(); handleFocusColOpen(); }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [
  handleSave, handleF2FreeProduct, handleF5View, handleDelete, handleClear, handleF12Open,
  handleFocusColOpen,
  productPopup.open, f12Open, listViewOpen, focusColOpen, serialNoPopup.open,
  gridRows,
]);
  // ── renderCell ─────────────────────────────────────────────────────────────
  const renderCell = useCallback((row, col) => {
    const isSelected = selectedCell.rowKey === row._key && selectedCell.colKey === col.key;
    const cellId     = `cell_${row._key}_${col.key}`;
  
    if (!col.editable) {
      return (
        <td
          key={col.key}
          className={`grid-cell readonly ${col.align === "right" ? "right" : ""}`}
          style={{ minWidth: col.width }}
        >
          {row[col.key] ?? ""}
        </td>
      );
    }
  
    const onFocus = (e) => {
      e.target.select?.();
      setSelectedCell({ rowKey: row._key, colKey: col.key });
    };

    // ── Bat_No: highlight red border when BatchStatus=1 and value is empty ─────
// Mirrors jQuery save validation: block save if Bat_No empty on batch items
if (col.key === "Bat_No") {
  const needsBatch = valNum(row.BatchStatus) === 1 && !row.Bat_No?.trim();
  return (
    <td
      key={col.key}
      className={`grid-cell editable ${isSelected ? "selected" : ""}`}
      style={{ minWidth: col.width }}
    >
      <input
        id={cellId}
        type="text"
        className="cell-input"
        value={row[col.key] ?? ""}
        onChange={(e) => handleCellChange(row._key, col.key, e.target.value)}
        onFocus={onFocus}
        onKeyDown={(e) => handleGridKeyDown(e, row._key, col.key)}
        tabIndex={0}
        style={needsBatch ? { borderBottom: "2px solid #ef4444", background: "#fff7f7" } : {}}
        title={needsBatch ? "Batch No required for this item" : ""}
      />
    </td>
  );
}
  
    // ── BatchWise dropdown columns ────────────────────────────────────────────
    // Mirrors jQuery columntype:'combobox' with source: brandlist/sizelist/etc.
    // Only rendered as <select> when BatchWise is ON and that column is visible.
    const batchDropdowns = {
      BrandId: { active: bStatus === 1, list: brandList, valueProp: "Id", labelProp: "BrandName" },
      ModelId: { active: mStatus === 1, list: modelList, valueProp: "Id", labelProp: "ModelName" },
      ColorId: { active: cStatus === 1, list: colorList, valueProp: "Id", labelProp: "ColorName" },
      SizeId:  { active: sStatus === 1, list: sizeList,  valueProp: "Id", labelProp: "SizeName"  },
    };
  
    const ddConfig = batchDropdowns[col.key];
    if (ddConfig?.active) {
      return (
        <td
          key={col.key}
          className={`grid-cell editable ${isSelected ? "selected" : ""}`}
          style={{ minWidth: col.width }}
        >
          <select
            id={cellId}
            className="cell-input"
            style={{ width: "100%" }}
            value={row[col.key] ?? ""}
            onFocus={() => setSelectedCell({ rowKey: row._key, colKey: col.key })}
            onChange={(e) => handleCellChange(row._key, col.key, e.target.value)}
            onKeyDown={(e) => handleGridKeyDown(e, row._key, col.key)}
            tabIndex={0}
          >
            <option value="">-- Select --</option>
            {ddConfig.list.map((item) => (
              <option key={item[ddConfig.valueProp]} value={item[ddConfig.valueProp]}>
                {item[ddConfig.labelProp]}
              </option>
            ))}
          </select>
        </td>
      );
    }
  
    // ── Default: text / date / number input ───────────────────────────────────
    return (
      <td
        key={col.key}
        className={`grid-cell editable ${isSelected ? "selected" : ""} ${col.align === "right" ? "right" : ""}`}
        style={{ minWidth: col.width }}
      >
        <input
          id={cellId}
          type={col.type === "date" ? "date" : "text"}
          className={`cell-input ${col.align === "right" ? "right" : ""}`}
          value={row[col.key] ?? ""}
          onChange={(e) => handleCellChange(row._key, col.key, e.target.value)}
          onFocus={onFocus}
          onKeyDown={(e) => handleGridKeyDown(e, row._key, col.key)}
          tabIndex={0}
        />
      </td>
    );
  }, [
    selectedCell, handleCellChange, handleGridKeyDown,
    bStatus, sStatus, cStatus, mStatus,
    brandList, modelList, colorList, sizeList,
  ]);

  // ── Block render until authorized ─────────────────────────────────────────
  if (!isAuthorized) return null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="pur-root">

      {ConfirmUI}

      <Topbar />

      {/* ── Product Lookup Popup ── */}
      {productPopup.open && (
        <ProductPopup
          productPopup={productPopup}
          setProductPopup={setProductPopup}
          applyProductToRow={applyProductToRow}
          sess={sess}
          setLoading={setLoading}
        />
      )}

      {/* ── MRP Selection Popup (Case 3: >1 result — same product code, multiple MRP/Batch variants) ── */}
      {/* Mirrors jQuery MRPWindow("#mrpwindow", gridmrp, objPlist) exactly.                           */}
      {/* User MUST select one variant; no auto-selection is performed.                                */}
      {mrpPopup.open && (
        <MRPSelectionPopup
          mrpPopup={mrpPopup}
          setMrpPopup={setMrpPopup}
          applyProductToRow={applyProductToRow}
        />
      )}

      {/* ── Serial Number Entry Popup (TextilesSerialNowiseBilling=true AND SerialNoStatus=1) ── */}
      {/* Mirrors jQuery SerialNoWindow("#serialnowindow", gridserialNo, datalist)               */}
      {serialNoPopup.open && (
        <SerialNoPopup
          serialNoPopup={serialNoPopup}
          setSerialNoPopup={setSerialNoPopup}
          serialNoList={serialNoList}
          setSerialNoList={setSerialNoList}
          setGridRows={setGridRows}
        />
      )}



      {/* ── F12 Column Config Popup ── */}
      {f12Open && (
        <div className="popup-overlay">
          <div className="popup-window f12-popup">
            <div className="popup-header">
              <span>Column Configuration (F12)</span>
              <button className="popup-close" onClick={() => {
                setF12Open(false);
                // Restore focus to the previously selected grid cell (jQuery behavior)
                const prev = f12PrevCellRef.current;
                if (prev && prev.rowKey && prev.colKey) {
                  setTimeout(() => {
                    const el = document.getElementById(`cell_${prev.rowKey}_${prev.colKey}`);
                    if (el) { el.focus(); el.select?.(); }
                  }, 50);
                }
              }}>✕</button>
            </div>
            <div className="popup-body">
              <table className="popup-table">
                <thead>
                  <tr>
                    <th style={{ width: 180 }}>Column</th>
                    <th style={{ width: 70, textAlign: "center" }}>Visible</th>
                    <th style={{ width: 70, textAlign: "right" }}>Width</th>
                  </tr>
                </thead>
                <tbody>
                  {f12Draft.map((cfg) => {
                    const base = BASE_COLUMNS.find((c) => c.key === cfg.key);
                    if (!base) return null;
                    return (
                      <tr key={cfg.key}>
                        <td>{base.label}</td>
                        <td className="center">
                          <input
                            type="checkbox"
                            checked={cfg.visible}
                            onChange={(e) => f12SetVisible(cfg.key, e.target.checked)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            style={{ width: 60 }}
                            value={cfg.width}
                            onChange={(e) => f12SetWidth(cfg.key, e.target.value)}
                          />
                        </td>
                      </tr>
                    );
                  })      
                }
                </tbody>
              </table>
            </div>
            <div className="popup-footer">
              <button className="btn btn-primary btn-sm"   onClick={handleF12Save} disabled={loading}>💾 Save</button>
              <button className="btn btn-secondary btn-sm" onClick={() => {
                setF12Open(false);
                // Restore focus to previously selected cell
                const prev = f12PrevCellRef.current;
                if (prev && prev.rowKey && prev.colKey) {
                  setTimeout(() => {
                    const el = document.getElementById(`cell_${prev.rowKey}_${prev.colKey}`);
                    if (el) { el.focus(); el.select?.(); }
                  }, 50);
                }
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {/* ── F5 List View Popup ── */}
{listViewOpen && (
        <div className="popup-overlay">
          <div
            className="popup-window f5-popup"
            style={{ width: 980, maxHeight: "85vh", display: "flex", flexDirection: "column" }}
          >
            {/* ── Header ── */}
            <div className="popup-header">
              <span>Purchase List View (F5)</span>
              <button
                className="popup-close"
                onClick={() => { setListViewOpen(false); setF5MasterList([]); setF5DetailList([]); setF5SupplierId(""); setFromDate(today()); setToDate(today()); }}
              >
                ✕
              </button>
            </div>
 
<div
  style={{
    padding: "12px",
    borderBottom: "1px solid #c5d8f8",
    background: "#f5f9ff",
  }}
>
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "90px 140px 80px 140px 180px",
      gap: "10px",
      alignItems: "center",
      marginBottom: "10px",
    }}
  >
    <label>From Date</label>
    <input
      type="date"
      className="form-ctrl"
      value={fromDate}
      onChange={(e) => setFromDate(e.target.value)}
    />

    <label>To Date</label>
    <input
      type="date"
      className="form-ctrl"
      value={toDate}
      onChange={(e) => setToDate(e.target.value)}
    />

    <select
      className="form-ctrl"
      value={f5SupplierId}
      onChange={(e) => setF5SupplierId(e.target.value)}
    >
      <option value="">Select Supplier Name</option>
      {supplierList.map((s) => (
        <option key={s.Id} value={s.Id}>
          {s.AccountName}
        </option>
      ))}
    </select>
  </div>

  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "10px",
    }}
  >
    <label style={{ width: "90px" }}>Search No</label>

    <input
      className="form-ctrl"
      style={{ width: "140px" }}
      value={searchNo}
      onChange={(e) => setSearchNo(e.target.value)}
    />

    <button
      className="tbtn tbtn-save"
      onClick={() =>
        handleF5View({
          fromdate: fromDate,
          todate: toDate,
          supplierid: f5SupplierId,
        })
      }
    >
      View
    </button>

    <div
      style={{
        marginLeft: "auto",
        color: "#16a34a",
        fontWeight: "bold",
        fontSize: "20px",
      }}
    >
      Total Amt : {f5TotalAmt}
    </div>
  </div>
</div>
 
            {/* ── Total amount bar (mirrors jQuery #lblviewamt) ── */}
            {f5MasterList.length > 0 && (
              <div
                style={{
                  padding: "4px 14px",
                    background: "#f5f9ff",
                    borderBottom: "1px solid #c5d8f8",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#16a34a",
                  textAlign: "right",
                }}
              >
                Total&nbsp;Net&nbsp;Amount :&nbsp;
                <span style={{ fontSize: 15, letterSpacing: "0.5px" }}>
                  {f5TotalAmt}
                </span>
              </div>
            )}
 
            {/* ── Master grid ── */}
            <div className="popup-body" style={{ overflowY: "auto", flex: 1, padding: 0 }}>
              <table className="view-grid" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ width: 32 }} />
                    <th>Purchase No</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Supplier</th>
                    <th className="right">Net Amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Empty state */}
                  {f5MasterList.length === 0 && (
                    <tr>
                      <td colSpan={7} className="no-data" style={{ textAlign: "center", padding: 18, color: "#94a3b8" }}>
                        No records found. Enter a search term and press Search.
                      </td>
                    </tr>
                  )}
 
                  {f5MasterList.map((m) => {
                    const isExpanded = f5ExpandedRow === m.Id;
                    const rowDetails = getDetailsForMaster(m.Id);
 
                    return (
                      <React.Fragment key={m.Id}>
                        {/* ── Master row ── */}
                        <tr
                          className="view-row"
                          style={{ cursor: "pointer", background: isExpanded ? "#deeafb" : undefined }}
                        >
                          {/* Expand / collapse toggle */}
                          <td
                            style={{ textAlign: "center", width: 32, userSelect: "none", fontSize: 12 }}
                            onClick={() => toggleF5Row(m.Id)}
                            title={isExpanded ? "Collapse products" : "Expand products"}
                          >
                            {isExpanded ? "▼" : "▶"}
                          </td>
 
                          <td>{m.PurchaseNo}</td>
                          <td>{jsonDate(m.PurchaseDate)}</td>
                          <td>
                            <span
                              className={`badge ${m.PurchaseType === "CA" ? "badge-cash" : "badge-credit"}`}
                            >
                              {m.PurchaseType === "CA" ? "Cash" : "Credit"}
                            </span>
                          </td>
                          <td>{m.SupplierName}</td>
                          <td className="right">{fmt2(m.NetAmt)}</td>
                          <td>
                            {/* Edit button: mirrors jQuery gridf5view rowdoubleclick → EditPasswordWindow(1) */}
<button
  className="tbtn-sm edit"
  onClick={() => {
    if (!perm.Edit) { toast("❌ Page Edit Permission Denied !!!.", true); return; }
    openEditPassword({ type: "EDIT", id: m.Id, pno: m.PurchaseNo });
  }}
>
  ✏ Edit
</button>

{/* Delete button: mirrors jQuery F9 → EditPasswordWindow(1) */}
<button
  className="tbtn-sm delete"
  onClick={() => {
    if (!perm.Delete) { toast("❌ Page Delete Permission Denied !!!.", true); return; }
    openEditPassword({
      type:     "DELETE",
      id:       m.Id,
      updateId: m.UpdateId || "",
      pno:      m.PurchaseNo,        // ← ADD: needed for confirm message
    });
  }}
>
  🗑 Del
</button>
                          </td>
                        </tr>
 
                        {/* ── Nested details row (mirrors jQuery initrowdetails grid) ── */}
                        {isExpanded && (
                          <tr key={`d_${m.Id}`}>
                            <td
                              colSpan={7}
                              style={{
                                padding: "6px 24px 10px 42px",
                                background: "#f8fafc",
                                borderBottom: "2px solid #bfdbfe",
                              }}
                            >
                              {rowDetails.length === 0 ? (
                                <span style={{ color: "#94a3b8", fontSize: 12 }}>
                                  No product details found.
                                </span>
                              ) : (
                                <table
                                  className="view-grid nested-grid"
                                  style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
                                >
                                  <thead>
                                  <tr style={{ background: "#2d4a9f", color: "#fff" }}>
                                      <th style={{ width: 100 }}>Code</th>
                                      <th style={{ width: 220 }}>Description</th>
                                      <th className="right" style={{ width: 80 }}>MRP</th>
                                      <th className="right" style={{ width: 90 }}>Pur. Rate</th>
                                      <th className="right" style={{ width: 70 }}>Qty</th>
                                      <th className="right" style={{ width: 70 }}>GST(%)</th>
                                      <th className="right" style={{ width: 80 }}>GST Amt</th>
                                      <th className="right" style={{ width: 70 }}>Disc(%)</th>
                                      <th className="right" style={{ width: 80 }}>Disc Amt</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {rowDetails.map((d, idx) => (
                                      <tr
                                        key={`${m.Id}_detail_${idx}`}
                                        className="view-row"
                                        style={{ background: idx % 2 === 0 ? "#fff" : "#f5f9ff" }}
                                      >
                                        <td>{d.ProductCode}</td>
                                        <td>{d.ProductName}</td>
                                        <td className="right">{fmt2(d.MRP)}</td>
                                        <td className="right">{fmt2(d.PurchaseRate)}</td>
                                        <td className="right">{fmt2(d.ItemQty)}</td>
                                        <td className="right">{fmt2(d.TaxPercent)}</td>
                                        <td className="right">{fmt2(d.TaxAmt)}</td>
                                        <td className="right">{fmt2(d.DiscountPercent)}</td>
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
 
            {/* ── Footer ── */}
            <div className="popup-footer">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setListViewOpen(false); setF5MasterList([]); setF5DetailList([]); setF5SupplierId(""); setFromDate(today()); setToDate(today()); }}
              >
                Close (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── END F5 List View Popup ── */}
      {/* ── Master form ── */}
      <div className="pur-master">

        {/* ── Toolbar ── */}
        {/* <div className="mp-toolbar">
          <button className="mp-btn sv" onClick={handleSave}   disabled={loading}>💾 F1 Save</button>
          <button className="mp-btn nw" onClick={handleSearch} disabled={loading}>🔍 F3 Search</button>
          <button className="mp-btn dl" onClick={handleDelete} disabled={loading}>🗑 F4 Delete</button>
          <button className="mp-btn"   onClick={handleClear}   disabled={loading}>🔄 F10 New</button>
          <button className="mp-btn"   onClick={handleF12Open} disabled={loading}>⚙ F12 Cols</button>
          <div className="mp-toolbar-title">Purchase Entry</div>
        </div> */}

        <div className="master-row">
          {/* ── column 1 ── */}
          <div className="field-group">
            <label>Purchase No</label>
            <input className="form-ctrl disabled" value={purchaseNo } readOnly />
          </div>
          <div className="field-group">
            <label>Purchase Date <span className="req">*</span></label>
            <input type="date" className="form-ctrl" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </div>
          <div className="field-group">
            <label>Due Date</label>
            <input type="date" className="form-ctrl" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="field-group">
            <label>Purchase Type</label>
            <select className="form-ctrl" value={purchaseType} onChange={(e) => setPurchaseType(e.target.value)}>
              <option value="CREDIT">CREDIT</option>
              <option value="CASH">CASH</option>
            </select>
          </div>

          {/* ── column 2 ── */}
          {/* <div className="field-group wide">
            <label>Supplier <span className="req">*</span></label>
            <select
              ref={supplierRef}
              className="form-ctrl"
              value={supplierId}
              onChange={(e) => handleSupplierChange(e.target.value)}
            >
              <option value="">-- Select Supplier --</option>
              {supplierList.map((s) => (
              //  <option key={s.Id} value={String(s.Id)}>{s.SupplierName || s.Name}</option>
              // ✅ Fix
<option key={s.Id} value={String(s.Id)}>{s.AccountName}</option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label>Invoice No <span className="req">*</span></label> */}
            {/* In the Master Row column 2 */}
{/* <input
  ref={invoiceNoRef}
  className="form-ctrl"
  value={invoiceNo || ""} 
  onChange={(e) => setInvoiceNo(e.target.value)}
  onKeyDown={(e) => { if (e.key === "Enter") invoiceAmtRef.current?.focus(); }}
/>
          </div>
          <div className="field-group">
            <label>Invoice Date</label>
            <input type="date" className="form-ctrl" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </div>
          <div className="field-group">
            <label>Invoice Amount</label>
            <input
              ref={invoiceAmtRef}
              className="form-ctrl right"
              value={invoiceAmt}
              onChange={(e) => setInvoiceAmt(e.target.value)}
              onFocus={(e) => e.target.select()}
            />
          </div>
        </div>  */}

         {/* ── column 2 ── */}
          {/* <div className="field-group wide">
            <label>Supplier <span className="req">*</span></label>
            <select
              ref={supplierRef}
              className="form-ctrl"
              value={supplierId}
              onChange={(e) => handleSupplierChange(e.target.value)}
            >
              <option value="">-- Select Supplier --</option>
              {supplierList.map((s) => (
              //  <option key={s.Id} value={String(s.Id)}>{s.SupplierName || s.Name}</option>
              // ✅ Fix
<option key={s.Id} value={String(s.Id)}>{s.AccountName}</option>
              ))}
            </select>
          </div> */}
          {/* ── Supplier autocomplete (mirrors jQuery cmbsupplier ComboBox) ── */}
<div className="field-group wide" ref={supplierContainerRef} style={{ position: "relative" }}>
  <label>Supplier <span className="req">*</span></label>
  <input
    ref={supplierRef}
    className="form-ctrl"
    value={supplierQuery}
    onChange={(e) => handleSupplierInputChange(e.target.value)}
    onFocus={() => {
      // Mode 1: show ALL suppliers on focus (mirrors jqxComboBox open-on-focus).
      // If user has already selected a valid supplier, still open full list so
      // they can browse and re-select, exactly like the jQuery ComboBox.
      openSupplierDropdown();
    }}
    onClick={() => {
      // Also open on click if dropdown is already closed (e.g. re-click after Escape)
      if (!supplierDDOpen) openSupplierDropdown();
    }}
    onKeyDown={supplierInputKeyDown}
    onBlur={() => {
      // Delay so onMouseDown on a dropdown row fires before blur closes it
      setTimeout(() => {
        setSupplierDDOpen(false);
        // If user blurred without selecting and typed text exactly matches one supplier, auto-confirm
        if (!supplierId && supplierQuery.trim()) {
          const exact = supplierList.find(
            (s) => (s.AccountName || "").toLowerCase() === supplierQuery.toLowerCase()
          );
          if (exact) confirmSupplierSelection(exact);
        }
      }, 180);
    }}
    placeholder="Type or click to browse suppliers…"
    autoComplete="off"
  />
  {supplierDDOpen && (
    <div
      style={{
        position: "absolute", zIndex: 9000, top: "100%", left: 0, right: 0,
        background: "#fff", border: "1px solid #cbd5e1", borderRadius: "0 0 6px 6px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.13)", maxHeight: 220, overflowY: "auto",
      }}
    >
      {supplierDropdown.map((s, i) => (
        <div
          key={s.Id}
          onMouseDown={() => confirmSupplierSelection(s)}
          style={{
            padding: "6px 10px", cursor: "pointer", fontSize: 13,
            background: i === supplierSelIdx ? "#deeafb" : "#fff",
            borderBottom: "1px solid #f1f5f9",
            fontWeight: i === supplierSelIdx ? 600 : 400,
          }}
        >
          {s.AccountName}
        </div>
      ))}
    </div>
  )}
</div>

          <div className="field-group">
            <label>Invoice No <span className="req">*</span></label>
            {/* In the Master Row column 2 */}
<input
  ref={invoiceNoRef}
  className="form-ctrl"
  value={invoiceNo || ""} 
  onChange={(e) => setInvoiceNo(e.target.value)}
  onKeyDown={(e) => { if (e.key === "Enter") invoiceAmtRef.current?.focus(); }}
/>
          </div>
          <div className="field-group">
            <label>Invoice Date</label>
            <input type="date" className="form-ctrl" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </div>
          <div className="field-group">
            <label>Invoice Amount <span className="req">*</span></label>
            <input
              ref={invoiceAmtRef}
              className="form-ctrl right"
              value={invoiceAmt}
              onChange={(e) => setInvoiceAmt(e.target.value)}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => { if (e.key === "Enter") supplierRef.current?.focus(); }}
            />
          </div>
          <div className="field-group">
            <label>Bill Amount</label>
            <div
              className={
                "bill-amt-display" +
                (valNum(totals.netAmt) > 0 && valNum(invoiceAmt) === valNum(totals.netAmt)
                  ? " bill-amt-match"
                  : valNum(totals.netAmt) > 0
                  ? " bill-amt-mismatch"
                  : "")
              }
            >
              ₹ {totals.netAmt}
            </div>
          </div>
        </div>

        {/* ── Supplier info strip ── */}
        <div className="supplier-strip">
          <span className="supplier-badge addr">{supplierInfo.address}</span>
          <span className="supplier-badge city">{supplierInfo.city}</span>
          <span className="supplier-badge phone">📞 {supplierInfo.phone}</span>
          <span className="supplier-badge bal">Balance: ₹{supplierInfo.balance}</span>
          <div className="tax-mode-group">
            <label className="radio-label">
              <input
                type="radio" name="taxmode" value="exclusive"
                checked={taxMode === "exclusive"}
                onChange={() => setTaxMode("exclusive")}
              /> Exclusive
            </label>
            <label className="radio-label">
              <input
                type="radio" name="taxmode" value="inclusive"
                checked={taxMode === "inclusive"}
                onChange={() => setTaxMode("inclusive")}
              /> Inclusive
            </label>
          </div>
          <label className="igst-label">
            <input
              type="checkbox"
              checked={igstChecked}
              onChange={(e) => {
                setIgstChecked(e.target.checked);
                setIgstStatus(e.target.checked ? "IGST" : "GST");
              }}
            /> IGST
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
                {BASE_COLUMNS
                  .filter((c) => { const cfg = colConfig.find((x) => x.key === c.key); return cfg ? cfg.visible : true; })
                  .map((c) => {
                    const cfg = colConfig.find((x) => x.key === c.key);
                    return (
                      <th
                        key={c.key}
                        style={{ minWidth: cfg ? cfg.width : c.defaultWidth }}
                        className={c.align === "right" ? "right" : ""}
                      >
                        {c.label}
                      </th>
                    );
                  })}
                <th className="del-col">Del</th>
              </tr>
            </thead>
            <tbody>
              {gridRows.map((row, idx) => (
                <tr
                  key={row._key}
                  className={`grid-row ${selectedCell.rowKey === row._key ? "row-active" : ""}`}
                >
                  <td className="sno-col center">{idx + 1}</td>
                  {BASE_COLUMNS
                    .filter((c) => { const cfg = colConfig.find((x) => x.key === c.key); return cfg ? cfg.visible : true; })
                    .map((c) => {
                      const cfg = colConfig.find((x) => x.key === c.key);
                      // Pass effective width via col override so renderCell can use it
                      return renderCell(row, { ...c, width: cfg ? cfg.width : c.defaultWidth });
                    })}
                  <td className="del-col center">
                    {row.ProductCode && (
                      <button
                        className="del-row-btn"
                        onClick={() => deleteGridRow(row._key)}
                        title="Delete Row (Shift+Del)"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Bottom panel ── */}
      <div className="pur-bottom">

        {/* left: GST split + additional charges + qty/remarks */}
        <div className="bottom-left">
          <div className="gst-split-panel">
            {/* <div className="panel-title">GST Summary</div> */}
            <table className="gst-table">
            <thead>
                <tr><th>GST%</th><th>GST Amt</th><th>CGST</th><th>SGST</th></tr>
              </thead>
              <tbody>
                {gstSplit.length === 0
                  ? <tr><td colSpan={4} className="no-data">No GST data</td></tr>
                  : gstSplit.map((g, i) => (
                    <tr key={g.TaxPercent ?? i}>
                      <td className="right">{g.TaxPercent}</td>
                      <td className="right">{fmt2(g.TaxAmt)}</td>
                      <td className="right">{fmt2(g.CTAmount)}</td>
                      <td className="right">{fmt2(g.STAmount)}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>

          {/* ── Additional Charges + Qty & Remarks side by side ── */}
          <div className="charges-qty-row">
            <div className="other-fields-panel">
              <div className="panel-title">Additional Charges</div>
              <div className="other-row">
                <label>Others (+)</label>
                <input className="form-ctrl right sm" value={otherPlus} onChange={(e) => setOtherPlus(e.target.value)} onFocus={(e) => e.target.select()} />
              </div>
              <div className="other-row">
                <label>Others (-)</label>
                <input className="form-ctrl right sm" value={otherSub} onChange={(e) => setOtherSub(e.target.value)} onFocus={(e) => e.target.select()} />
              </div>
            </div>

            {/* ── NEW: Total Item Qty & Remarks card (Req 2) ── */}
            <div className="qty-remarks-panel">
              <div className="panel-title">Qty &amp; Remarks</div>
              <div className="other-row">
                <label>Total Item Qty</label>
                <span className="qty-display">{totals.totalQty ?? "0.00"}</span>
              </div>
              <div className="other-row remarks-row">
                <label>Remarks</label>
                <input
                  ref={remarksRef}
                  className="form-ctrl sm"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter remarks…"
                />
              </div>
            </div>
          </div>
        </div>

        {/* right: bill totals — 2-row × 4-col table layout */}
        <div className="totals-panel">
          <div className="panel-title">Bill Summary</div>
          <table className="bill-summary-table">
            <tbody>
              <tr>
                <td className="bs-label">Product Total</td>
                <td className="bs-value">{totals.productTotal}</td>
                <td className="bs-label">C.D Amount</td>
                <td className="bs-value">{totals.cdAmt}</td>
                <td className="bs-label">GST Amount</td>
                <td className="bs-value">{totals.gstAmt}</td>
                <td className="bs-label">CGST Amount</td>
                <td className="bs-value">{totals.cgstAmt}</td>
              </tr>
              <tr>
                <td className="bs-label">Transport Amt</td>
                <td className="bs-value">{totals.transAmt}</td>
                <td className="bs-label">Discount Amt</td>
                <td className="bs-value">{totals.discAmt}</td>
                <td className="bs-label">CESS Amount</td>
                <td className="bs-value">{totals.cessAmt}</td>
                <td className="bs-label">SGST Amount</td>
                <td className="bs-value">{totals.sgstAmt}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>


{/* ── Ctrl+G FocusColumns Modal ── */}
{focusColOpen && (
  <div className="popup-overlay">
    <div
      className="popup-window f12-popup"
      style={{
        width: 520,
        maxHeight: "80vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div className="popup-header">
        <span>Columns Reorder &amp; Focus Enabled</span>
        <button
          className="popup-close"
          onClick={() => setFocusColOpen(false)}
        >
          ✕
        </button>
      </div>

      <div
        className="popup-body"
        style={{
          overflowY: "auto",
          flex: 1,
        }}
      >
        <table
          className="popup-table"
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
              <th style={{ width: 80, textAlign: "center" }}>
                Position
              </th>
              <th style={{ textAlign: "left" }}>
                Column Name
              </th>
              <th style={{ width: 90, textAlign: "center" }}>
                Visible
              </th>
            </tr>
          </thead>

          <tbody>
            {focusColDraft.map((d, idx) => {
              const base = BASE_COLUMNS.find(
                (c) => c.key === d.column
              );

              return (
         <tr
           key={d.column}
            draggable
            onDragStart={() => handleFocusDragStart(idx)}
            onDragOver={(e) => handleFocusDragOver(e, idx)}
            onDragEnd={handleFocusDragEnd}
  style={{background:focusColDragIdx === idx
        ? "#e0f2fe"
        : "transparent",
    cursor: "grab",
  }}
>
  <td
    style={{
      textAlign: "center",
      userSelect: "none",
      fontWeight: 600,
    }}
  >
    {idx + 1}
  </td>

  <td>
    {base?.label || d.column}
  </td>

  <td style={{ textAlign: "center" }}>
    <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, cursor: "pointer" }}>
      <input
        type="checkbox"
        checked={!!d.Focus} 
        onChange={() => {
          console.log("CLICKED", idx, d);
          handleFocusToggle(idx, "Focus", !d.Focus);
        }}
        style={{ width: 14, height: 14, accentColor: "#1f65de" }}
      />
 
    </label>
  </td>
</tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="popup-footer">
        <button
          className="btn btn-primary btn-sm"
          onClick={handleFocusColSave}
          disabled={loading}
        >
          💾 Save
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setFocusColOpen(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
      {/* ── Keyboard hint bar ── */}
      <div className="mp-hint">
  <kbd>F1</kbd> Save &nbsp;|&nbsp;
  <kbd>F3</kbd> Product Search &nbsp;|&nbsp;
  <kbd>F4</kbd> Delete &nbsp;|&nbsp;
  <kbd>F5</kbd> List View &nbsp;|&nbsp;
  <kbd>F10</kbd> Clear &nbsp;|&nbsp;
  <kbd>F12</kbd> Columns &nbsp;|&nbsp;
  <kbd>Enter / Tab</kbd> Next Cell &nbsp;|&nbsp;
  <kbd>↑↓</kbd> Navigate Rows &nbsp;|&nbsp;
  <kbd>Shift+Del</kbd> Delete Row
</div>

      {/* ── Loading overlay ── */}
      {loading && (
        <div className="mp-loader-ov">
          <div className="mp-ldr-box">
            <div className="mp-spin" />
            <div className="mp-ldr-msg">Processing…</div>
          </div>
        </div>
      )}

      {/* ── Toast notifications ── */}
      <MSG.ToastList toasts={toasts} />

      {/* ── Edit Password Modal ── */}
      {/* Mirrors jQuery: #LockEditWindow jqxWindow */}
      {editPwdOpen && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(10,20,40,0.45)",
            backdropFilter: "blur(2px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 10000,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: "22px 28px 18px",
              minWidth: 240,
              maxWidth: 300,
              boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
              border: "1px solid #c5d8f8",
              textAlign: "center",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: "#1e293b" }}>
              🔒 Edit Password
            </div>
            <input
              type="password"
              autoFocus
              style={{
                width: "100%", padding: "7px 10px",
                border: "1px solid #c5d8f8", borderRadius: 6,
                fontSize: 14, outline: "none", boxSizing: "border-box",
              }}
              value={editPwdValue}
              onChange={(e) => { setEditPwdValue(e.target.value); setEditPwdError(""); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleEditPasswordSubmit();
                if (e.key === "Escape") {
                  setEditPwdOpen(false);
                  setPendingEditAction(null);
                }
              }}
              placeholder="Enter password…"
              disabled={editPwdLoading}
            />
            {editPwdError && (
              <div style={{ color: "#dc2626", fontSize: 12, marginTop: 6 }}>
                {editPwdError}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "center" }}>
              <button
                style={{
                  padding: "7px 22px", borderRadius: 6, border: "none",
                  background: "linear-gradient(135deg,#3b82f6,#1d4ed8)",
                  color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer",
                }}
                onClick={handleEditPasswordSubmit}
                disabled={editPwdLoading || !editPwdValue.trim()}
              >
                {editPwdLoading ? "…" : "✔ OK"}
              </button>
              <button
                style={{
                  padding: "7px 22px", borderRadius: 6,
                  border: "1px solid #c5d8f8", background: "#f5f9ff",
                  color: "#6b7a99", fontWeight: 600, fontSize: 13, cursor: "pointer",
                }}
                onClick={() => { setEditPwdOpen(false); setPendingEditAction(null); }}
                disabled={editPwdLoading}
              >
                ✘ Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── ProductPopup — extracted to named component for clean separation ─────────
function ProductPopup({ productPopup, setProductPopup, applyProductToRow, sess, setLoading }) {
  const [localQuery, setLocalQuery] = useState(productPopup.query || "");
  const [localList,  setLocalList ] = useState(productPopup.list  || []);
  const [selIdx,     setSelIdx    ] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (productPopup.autoLoad) {
      doSearch("");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // const doSearch = useCallback(async (q) => {
  //   if (!q) { setLocalList([]); return; }
  //   setLoading(true);
  //   const res = await CC.api(
  //     CC.GetProductListV7,
  //     null,
  //     {},
  //     { code: q, Comid: sess.MComid, CComid: sess.Comid, Id: 0, Batchwise: 0 }
  //   );
  //   setLoading(false);
  //   const list = Array.isArray(res) ? res : (res.data || res.Data1 || []);
  //   setLocalList(list);
  //   setSelIdx(0);
  // }, [sess, setLoading]);
  const doSearch = useCallback(async (q) => {
    setLoading(true);
  
    try {
      const res = await CC.api(
        CC.GetProductListV7,
        null,
        {},
        {
          Comid: sess.MComid
        }
      );
  
      const allProducts =
        res?.Data1 ||
        res?.data?.Data1 ||
        res?.data ||
        [];
  
      if (!q?.trim()) {
        setLocalList(allProducts);
        return;
      }
  
      const search = q.toLowerCase();
  
      const filtered = allProducts.filter((p) =>
        (p.Prod_Code || p.PCode || "")
          .toLowerCase()
          .includes(search) ||
        (p.PName || "")
          .toLowerCase()
          .includes(search)
      );
  
      setLocalList(filtered);
      setSelIdx(0);
    } finally {
      setLoading(false);
    }
  }, [sess, setLoading]);


  const handleKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelIdx((i) => Math.min(i + 1, localList.length - 1)); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); setSelIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter")     { if (localList[selIdx]) applyProductToRow(productPopup.rowKey, localList[selIdx]); }
    else if (e.key === "Escape")    { setProductPopup({ open: false, rowKey: null, list: [], query: "" }); }
  };

  return (
    <div className="popup-overlay">
      <div className="popup-window product-popup">
        <div className="popup-header">
          <span>Product Lookup</span>
          <button
            className="popup-close"
            onClick={() => setProductPopup({ open: false, rowKey: null, list: [], query: "" })}
          >
            ✕
          </button>
        </div>
        <div className="popup-body">
          <input
            ref={inputRef}
            className="popup-search-input"
            placeholder="Search by code or name…"
            value={localQuery}
            onChange={(e) => { setLocalQuery(e.target.value); doSearch(e.target.value); }}
            onKeyDown={handleKey}
          />
          <div className="popup-list-wrap">
            <table className="popup-table">
              <thead>
                <tr>
                  <th>Code</th><th>Description</th><th>UOM</th>
                  <th>Pur.Rate</th><th>MRP</th><th>Stock</th>
                </tr>
              </thead>
              {/* <tbody>
                {localList.map((p, i) => (
                  <tr
                    key={p.Id}
                    className={i === selIdx ? "popup-row selected" : "popup-row"}
                    onClick={() => applyProductToRow(productPopup.rowKey, p)}
                  >
                    <td>{p.ProductCode}</td>
                    <td>{p.ProductName}</td>
                    <td>{p.UOM}</td>
                    <td className="right">{valNum(p.PurchaseRate).toFixed(2)}</td>
                    <td className="right">{valNum(p.MRP).toFixed(2)}</td>
                    <td className="right">{valNum(p.Stock).toFixed(2)}</td>
                  </tr>
                ))}
                {localList.length === 0 && (
                  <tr><td colSpan={6} className="no-data">No records found</td></tr>
                )}
              </tbody> */}
              <tbody>
  {localList.map((p, i) => (
    <tr
      key={p.Id}
      className={i === selIdx ? "popup-row selected" : "popup-row"}
      onClick={() => applyProductToRow(productPopup.rowKey, p)}
    >
      <td>{p.Prod_Code}</td>
      <td>{p.PName}</td>
      <td>{p.UOM}</td>
      <td className="right">
        {valNum(p.PurRate).toFixed(2)}
      </td>
      <td className="right">
        {valNum(p.MRP).toFixed(2)}
      </td>
      <td className="right">
        {valNum(p.Stock).toFixed(2)}
      </td>
    </tr>
  ))}
</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MRPSelectionPopup ────────────────────────────────────────────────────────
// Mirrors jQuery MRPWindow("#mrpwindow", gridmrp, objPlist).
//
// Triggered only when SelectItemMasterbyCodeId returns > 1 item for the same
// product code (i.e. same code, multiple MRP / Batch variants).
//
// Behavior rules (match jQuery exactly):
//  • Display ALL variants returned from the API — no filtering
//  • Keyboard: ArrowDown/Up to move selection, Enter to confirm, Escape to close
//  • Mouse: single click to confirm (mirrors jQuery gridmrp row click → FillItems)
//  • NO auto-selection — popup stays open until user explicitly picks one
//  • On selection: close popup, call applyProductToRow with selected item
// ─────────────────────────────────────────────────────────────────────────────
function MRPSelectionPopup({ mrpPopup, setMrpPopup, applyProductToRow }) {
  const [selIdx, setSelIdx] = React.useState(0);
  const tbodyRef = React.useRef(null);

  // Keep selected row scrolled into view
  React.useEffect(() => {
    const row = tbodyRef.current?.querySelectorAll("tr")[selIdx];
    row?.scrollIntoView({ block: "nearest" });
  }, [selIdx]);

  const close = () => setMrpPopup({ open: false, rowKey: null, list: [] });

  const confirmSelection = (item) => {
    applyProductToRow(mrpPopup.rowKey, item);
    close();
  };

  const handleKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelIdx((i) => Math.min(i + 1, mrpPopup.list.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = mrpPopup.list[selIdx];
      if (item) confirmSelection(item);
    } else if (e.key === "Escape") {
      close();
    }
  };

  return (
    <div className="popup-overlay" onKeyDown={handleKey} tabIndex={-1}
      style={{ outline: "none" }}
      ref={(el) => el?.focus()}
    >
      <div className="popup-window product-popup" style={{ maxWidth: 620 }}>
        <div className="popup-header">
          <span>Select MRP / Batch Variant</span>
          <button className="popup-close" onClick={close}>✕</button>
        </div>
        <div className="popup-body">
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "#64748b" }}>
            Multiple variants found for this product code. Select one to add to the grid.
          </p>
          <div className="popup-list-wrap">
            <table className="popup-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Description</th>
                  <th>MRP</th>
                  <th>Pur.Rate</th>
                  <th>UOM</th>
                  <th>Stock</th>
                  <th>Batch No</th>
                </tr>
              </thead>
              <tbody ref={tbodyRef}>
                {mrpPopup.list.map((p, i) => (
                  <tr
                    key={p.Id ?? i}
                    className={i === selIdx ? "popup-row selected" : "popup-row"}
                    onClick={() => confirmSelection(p)}
                    style={{ cursor: "pointer" }}
                  >
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
          <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8" }}>
            ↑↓ to navigate · Enter to select · Esc to cancel
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ItemCreatePopup ──────────────────────────────────────────────────────────
// Mirrors jQuery #somediv dialog (iframe /Itemmaster) that opens when
// SelectItemMasterbyCodeId returns 0 results and ProductCreate_Purchase = true.
//
// jQuery behavior (FillItemsCode lines 4941–4987):
//   1. confirm("Items Not Exists. Do You Want to Create New Items?")  ← done in fillProductByCode
//   2. sessionStorage.setItem("POPValue", Code.toUpperCase())
//   3. Open jQuery UI dialog with iframe /Itemmaster
//   4. On dialog close: call FillItems1("", POPValue, rowindex)
//      → FillItems1 calls SelectItemMasterbyCodeId with Id=savedId
//      → If 1 result → apply to grid; if >1 → MRPWindow; if 0 → show error
//
// React equivalent:
//   • Sets sessionStorage POPValue / POPStatus (so the embedded Itemmaster page
//     can read the pre-filled code — same as jQuery)
//   • Renders the /Itemmaster route in an <iframe> inside a modal overlay
//   • On close: calls SelectItemMasterbyCodeId with the code (Id=0) and runs
//     the same 3-case decision tree to load the newly created item
// ─────────────────────────────────────────────────────────────────────────────
function ItemCreatePopup({ itemCreatePopup, setItemCreatePopup, applyProductToRow, sess, setLoading }) {
  const { open, rowKey, code } = itemCreatePopup;

  React.useEffect(() => {
    if (open) {
      // Mirror jQuery: sessionStorage.setItem("POPValue", Code.toUpperCase())
      sessionStorage.setItem("POPValue", (code || "").toUpperCase());
      sessionStorage.setItem("POPStatus", "ON");
    }
  }, [open, code]);

  const handleClose = async () => {
    // Mirror jQuery dialog close handler (lines 4971–4983):
    //   POPValue = sessionStorage.getItem("POPValue")
    //   sessionStorage.setItem("POPStatus", "OFF")
    //   methods.FillItems1("", POPValue, rowindexC)
    const savedCode = sessionStorage.getItem("POPValue") || code || "";
    sessionStorage.setItem("POPValue", "");
    sessionStorage.setItem("POPStatus", "OFF");

    setItemCreatePopup({ open: false, rowKey: null, code: "" });

    if (!savedCode.trim()) return;

    // FillItems1: SelectItemMasterbyCodeId with the saved code, Id=0
    try {
      setLoading(true);
      const res = await CC.api(
        CC.ItemByCode,
        null,
        {},
        {
          code:    savedCode.trim(),
          Comid:   sess.MComid,
          CComid:  sess.Comid,
          Id:      0,
          Batchwise: 0,
        }
      );

      const objlist =
        Array.isArray(res)        ? res :
        Array.isArray(res?.Data1) ? res.Data1 :
        Array.isArray(res?.data)  ? res.data :
        [];

      if (objlist.length === 0) {
        // Item was not created / not found
        alert("Invalid Product Code !!!.");
        return;
      }
      if (objlist.length === 1) {
        applyProductToRow(rowKey, objlist[0]);
      }
      // >1 results after item creation is an edge case (shouldn't normally happen),
      // but applyProductToRow uses the first match (same as FillItems1 legacy)
      else {
        applyProductToRow(rowKey, objlist[0]);
      }
    } catch (err) {
      console.error("ItemCreatePopup close error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="popup-overlay" style={{ zIndex: 1100 }}>
      <div
        className="popup-window"
        style={{
          width:  "calc(100vw - 60px)",
          height: "calc(100vh - 80px)",
          maxWidth: "none",
          display: "flex",
          flexDirection: "column",
          padding: 0,
        }}
      >
        <div className="popup-header" style={{ flexShrink: 0 }}>
          <span>ItemMaster — Create New Item (Code: {code})</span>
          <button className="popup-close" onClick={handleClose}>✕</button>
        </div>
        {/* iframe mirrors jQuery: $("#thedialog").attr('src', "/Itemmaster") */}
        <iframe
          src="/Itemmaster"
          title="ItemMaster"
          style={{ flex: 1, border: "none", width: "100%" }}
        />
        <div
          style={{
            padding: "8px 16px",
            background: "#f8fafc",
            borderTop: "1px solid #e2e8f0",
            fontSize: 12,
            color: "#64748b",
            flexShrink: 0,
          }}
        >
          Create the new item in the form above, then close this window to auto-load it into the grid.
          <button
            style={{
              marginLeft: 16,
              padding: "4px 16px",
              borderRadius: 5,
              border: "none",
              background: "#3b82f6",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 12,
            }}
            onClick={handleClose}
          >
            ✔ Done — Close &amp; Load Item
          </button>
        </div>
      </div>
    </div>
  );
  
}
// ── Supplier dropdown item style (inside the .map) ─────────────────────────
const _supplierDropdownItemStyle = (i, supplierSelIdx) => ({
  padding: "6px 10px",
  cursor: "pointer",
  fontSize: 13,
  background: i === supplierSelIdx ? "#deeafb" : "#fff",   // SaleBill: deeafb hover
  borderBottom: "1px solid #f5f9ff",
  fontWeight: i === supplierSelIdx ? 600 : 400,
});
 
// ── Edit password modal overlay ────────────────────────────────────────────
const _editPwdOverlayStyle = {
  position: "fixed", inset: 0,
  background: "rgba(10,20,40,0.45)",     // SaleBill: 0.45
  backdropFilter: "blur(2px)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 10000,
};
 
// ── Edit password box ──────────────────────────────────────────────────────
const _editPwdBoxStyle = {
  background: "#fff",
  borderRadius: 10,
  padding: "22px 28px 18px",
  minWidth: 240, maxWidth: 300,
  boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
  border: "1px solid #c5d8f8",           // SaleBill mid-blue border
  textAlign: "center",
};
 
// ── Edit password input ────────────────────────────────────────────────────
const _editPwdInputStyle = {
  width: "100%", padding: "7px 10px",
  border: "1px solid #c5d8f8",           // SaleBill mid-blue
  borderRadius: 6,
  fontSize: 14, outline: "none", boxSizing: "border-box",
};
 
// ── Edit password OK button ────────────────────────────────────────────────
const _editPwdOkStyle = {
  padding: "7px 22px", borderRadius: 6, border: "none",
  background: "linear-gradient(135deg,#3b82f6,#1d4ed8)",
  color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer",
};
 
// ── Edit password Cancel button ────────────────────────────────────────────
const _editPwdCancelStyle = {
  padding: "7px 22px", borderRadius: 6,
  border: "1px solid #c5d8f8",           // SaleBill mid-blue
  background: "#f5f9ff",                  // SaleBill surface
  color: "#6b7a99",                       // SaleBill slate
  fontWeight: 600, fontSize: 13, cursor: "pointer",
};
 
// ── F5 total amount bar ────────────────────────────────────────────────────
const _f5TotalBarStyle = {
  padding: "4px 14px",
  background: "#f5f9ff",                  // SaleBill surface (was green tint)
  borderBottom: "1px solid #c5d8f8",      // SaleBill mid-blue (was green)
  fontSize: 13,
  fontWeight: 600,
  color: "#16a34a",                        // SaleBill green (was #166534)
  textAlign: "right",
};
 
// ── F5 filter section background ──────────────────────────────────────────
const _f5FilterSectionStyle = {
  padding: "12px",
  borderBottom: "1px solid #c5d8f8",      // SaleBill mid-blue
  background: "#f5f9ff",                   // SaleBill surface
};
 
// ── Nested detail grid header row ─────────────────────────────────────────
const _nestedHeaderRowStyle = {
  background: "#2d4a9f",                   // SaleBill: sb-pay-tbl th dark blue
  color: "#fff",
};

function BatchPopup({ batchPopup, setBatchPopup, onConfirm }) {
  const [rows, setRows] = useState([{ BatchNo: "" }]);

  const handleKeyDown = (e, idx) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Add new row if current row has value
      if (rows[idx].BatchNo.trim() !== "") {
        setRows([...rows, { BatchNo: "" }]);
      }
    }
  };

  return (
    <div className="popup-overlay">
      <div className="popup-window">
        <h3>Batch/Serial Numbers</h3>
        {rows.map((r, i) => (
          <input 
            key={i}
            value={r.BatchNo}
            onChange={(e) => {
              const newRows = [...rows];
              newRows[i].BatchNo = e.target.value;
              setRows(newRows);
            }}
            onKeyDown={(e) => handleKeyDown(e, i)}
          />
        ))}
        <button onClick={() => onConfirm(rows)}>Done</button>
      </div>
    </div>
  );
}
// ─── SerialNoPopup ────────────────────────────────────────────────────────────
// Mirrors jQuery SerialNoWindow("#serialnowindow", gridserialNo, datalist)
//
// Behavior rules (match jQuery exactly):
//  • Each row = one serial number (BatchNo field)
//  • Enter on a non-empty row → add a new row below (mirrors jQuery addrow)
//  • Enter on an empty row    → show "Enter the SerialNo !!!." error
//  • Duplicate check on every entry (mirrors jQuery CheckDuplicate)
//  • Delete key on a row      → remove that row from list
//  • F1 (or "Done" button)    → validate, push to SerialNodatalist, set ItemQty = count, close
//  • On close: ItemQty on the grid row = number of confirmed serials
//  • After close: focus returns to the triggering row (mirrors jQuery behavior)
// ─────────────────────────────────────────────────────────────────────────────
function SerialNoPopup({ serialNoPopup, setSerialNoPopup, serialNoList, setSerialNoList, setGridRows }) {
  // ── uid helper: CC.uid is not in scope outside Purchase component ──────────
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

  const { rowKey, textRefId, returnColKey } = serialNoPopup;

  const [rows, setRows] = useState(() =>
    serialNoPopup.list.length > 0
      ? serialNoPopup.list.map((s) => ({ id: uid(), value: s.BatchNo }))
      : [{ id: uid(), value: "" }]
  );
  const [error, setError] = useState("");
  const inputRefs = useRef({});

  useEffect(() => {
    const firstId = rows[0]?.id;
    if (firstId) setTimeout(() => inputRefs.current[firstId]?.focus(), 80);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Restore focus to grid cell after popup closes ─────────────────────────
  // Mirrors jQuery: after SerialNoWindow closes, focus returns to triggering row
  const restoreFocusToGrid = useCallback(() => {
    const col = returnColKey || "ItemQty";
    setTimeout(() => {
      const el = document.getElementById(`cell_${rowKey}_${col}`);
      if (el) { el.focus(); el.select?.(); }
    }, 60);
  }, [rowKey, returnColKey]);

  const close = useCallback(() => {
    setSerialNoPopup({ open: false, rowKey: null, textRefId: "", list: [], returnColKey: "ItemQty" });
    restoreFocusToGrid();
  }, [setSerialNoPopup, restoreFocusToGrid]);

  const handleDone = useCallback(() => {
    const cleaned = rows.filter((r, i) =>
      r.value.trim() !== "" || (i === 0 && rows.length === 1)
    );

    if (cleaned.length === 0 || (cleaned.length === 1 && cleaned[0].value.trim() === "")) {
      setError("Enter at least one Serial No !!!.");
      return;
    }

    const values = cleaned.map((r) => r.value.trim()).filter(Boolean);
    const uniqueValues = new Set(values);
    if (uniqueValues.size !== values.length) {
      setError("Duplicate Serial No found !!!.");
      return;
    }

    // Update serialNoList (mirrors jQuery SerialNodatalist)
    const filtered = serialNoList.filter((s) => s.IndexRefId !== textRefId);
    const updatedSerialList = [
      ...filtered,
      ...values.map((val) => ({
        BatchNo:      val,
        IndexRefId:   textRefId,
        RItemQty:     0,
        ItemQty:      1,
        Batchid:      0,
        ProductRefid: 0,
        MRP:          0,
        PurchaseRate: 0,
        LandingCost:  0,
        VAT:          0,
        SalesRate:    0,
      })),
    ];
    setSerialNoList(updatedSerialList);

    // Set ItemQty = serial count on the triggering row (mirrors jQuery line 3072)
    setGridRows((prev) => {
      const idx = prev.findIndex((r) => r._key === rowKey);
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], ItemQty: String(values.length) };
      return updated;
    });

    // Close popup and restore grid focus
    setSerialNoPopup({ open: false, rowKey: null, textRefId: "", list: [], returnColKey: "ItemQty" });
    restoreFocusToGrid();
  }, [rows, serialNoList, textRefId, rowKey, setSerialNoList, setGridRows, setSerialNoPopup, restoreFocusToGrid]);

  const handleKeyDown = useCallback((e, idx) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = rows[idx].value.trim();
      if (!val) { setError("Enter the SerialNo !!!."); return; }
      const isDup = rows.some((r, i) => i !== idx && r.value.trim() === val);
      if (isDup) { setError(`Duplicate SerialNo: ${val}`); return; }
      setError("");
      setRows((prev) => {
        const next = [...prev];
        if (idx === prev.length - 1) next.push({ id: uid(), value: "" });
        return next;
      });
      setTimeout(() => {
        const nextId = rows[idx + 1]?.id;
        if (nextId) {
          inputRefs.current[nextId]?.focus();
        } else {
          setRows((prev) => {
            const lastId = prev[prev.length - 1]?.id;
            if (lastId) setTimeout(() => inputRefs.current[lastId]?.focus(), 30);
            return prev;
          });
        }
      }, 20);
    } else if (e.key === "Delete" && e.shiftKey) {
      e.preventDefault();
      setRows((prev) => {
        const next = prev.filter((_, i) => i !== idx);
        return next.length === 0 ? [{ id: uid(), value: "" }] : next;
      });
    } else if (e.key === "F1") {
      e.preventDefault();
      handleDone();
    } else if (e.key === "Escape") {
      close();
    }
  }, [rows, handleDone, close]);

  const handleChange = (id, value) => {
    setError("");
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, value } : r));
  };

  return (
    <div className="popup-overlay" style={{ zIndex: 1200 }}>
      <div
        className="popup-window"
        style={{ width: 300, maxHeight: "80vh", display: "flex", flexDirection: "column" }}
      >
        <div className="popup-header">
          <span>Serial Numbers</span>
          <button className="popup-close" onClick={close}>✕</button>
        </div>

        <div className="popup-body" style={{ overflowY: "auto", flex: 1 }}>
          <table className="popup-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>S.No</th>
                <th>Serial No</th>
                <th style={{ width: 30 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td style={{ textAlign: "center", color: "#64748b" }}>{i + 1}</td>
                  <td>
                    <input
                      ref={(el) => { inputRefs.current[r.id] = el; }}
                      className="cell-input"
                      style={{ width: "100%" }}
                      value={r.value}
                      onChange={(e) => handleChange(r.id, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, i)}
                      autoComplete="off"
                    />
                  </td>
                  <td>
                    <button
                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13 }}
                      onClick={() => setRows((prev) => {
                        const next = prev.filter((_, j) => j !== i);
                        return next.length === 0 ? [{ id: uid(), value: "" }] : next;
                      })}
                      title="Remove row (Shift+Del)"
                    >✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {error && (
            <div style={{ color: "#dc2626", fontSize: 12, padding: "4px 8px" }}>{error}</div>
          )}
          <div style={{ fontSize: 11, color: "#94a3b8", padding: "4px 8px" }}>
            Enter → next row &nbsp;|&nbsp; F1 → Done &nbsp;|&nbsp; Shift+Del → remove row
          </div>
        </div>

        <div className="popup-footer">
          <button className="btn btn-primary btn-sm" onClick={handleDone}>
            ✔ F1 Done ({rows.filter(r => r.value.trim()).length} serials)
          </button>
          <button className="btn btn-secondary btn-sm" onClick={close}>Cancel</button>
        </div>
      </div>
    </div>
  );
}