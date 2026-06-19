// ─────────────────────────────────────────────────────────────────────────────
//  PurchaseReturn.jsx
//
//  Converted from: PurchaseReturn.js  (jQuery / jqxGrid)
//  Architecture  : Mirrors PurchasesMaster.jsx exactly
//  References    : Common.jsx utilities · PurchaseReturn.css design
//
//  Business Logic: ALL original jQuery logic preserved unchanged
//  API Endpoints : ALL original endpoints preserved
//  Payloads      : ALL original request structures preserved
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../TransactionStyle/Purchasereturn.css";
import Topbar from "../components/Topbar";
import * as CC  from "../components/Common";
import * as MSG from "../components/Messages";

// ─── Pure helpers ─────────────────────────────────────────────────────────────
const valNum   = (v)  => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const nullStr  = (v)  => (v == null || v === undefined ? "" : String(v));
const roundOff = (v)  => Math.round(valNum(v) * 100) / 100;
const fmt2     = (v)  => valNum(v).toFixed(2);
const fmt3     = (v)  => valNum(v).toFixed(3);
const fmt0     = (v)  => valNum(v).toFixed(0);
const today    = ()   => new Date().toISOString().split("T")[0];
const jsonDate = (s)  => {
  if (!s) return today();
  const m = /\/Date\((\d+)\)\//.exec(s);
  if (m) return new Date(+m[1]).toISOString().split("T")[0];
  if (typeof s === "string") return s.split("T")[0];
  try { return new Date(s).toISOString().split("T")[0]; } catch { return today(); }
};


// ─── Blank grid-row factory (mirrors jQuery grid fields) ─────────────────────
const makeGridRow = () => ({
  _key:           CC.uid(),
  PDId:           "",
  ProductRefId:   "",
  ProductCode:    "",
  ProductName:    "",
  HSNCode:        "",
  UOM:            "",
  UOMDecimal:     3,
  UOMRefid:       "",
  MRP:            "0.00",
  OldMRP:         "0.00",
  OldPurchaseRate:"0.00",
  PurchaseRate:   "0.00",
  cdpercent:      "0.00",
  cdAmount:       "0.00",
  DiscountPercent:"0.00",
  DiscountAmt:    "0.00",
  CESSPer:        "0.00",
  CESSAmount:     "0.00",
  SPLCESS:        "0.00",
  SPLCESSAmount:  "0.00",
  TaxPercent:     "0.00",
  TaxAmt:         "0.00",
  CTAmount:       "0.00",
  STAmount:       "0.00",
  CTPer:          "0.00",
  STPer:          "0.00",
  Noms:           "0",
  NomQty:         "0",
  ItemQty:        "0",
  FreeQty:        "0.00",
  StockQty:       "0.00",
  StockQtyNew:    "0.00",
  Nstock:         "0.00",
  RealQty:        "0.00",
  TotalPcs:       "0.00",
  Meter:          "0.00",
  Pcs:            "0.00",
  ExpiryDate:     "",
  MfgDate:        "",
  Bat_No:         "",
  BatchRefId:     "",
  BatchStatus:    0,
  Expirydays:     "0",
  Salerate:       "0.00",
  LandingCost:    "0.00",
  Amount:         "0.00",
  ProductTotal:   "0.00",
  FreeQtyStatus:  0,
  SerialNoStatus: 0,
  EditMode:       0,
  TextRefId:      "",
  IndexidS:       "",
  PDidNew:        "",
  PDRefid:        "",
  BrandId:        "",
  ModelId:        "",
  ColorId:        "",
  SizeId:         "",
  BrandCombo:     "",
  ModelCombo:     "",
  ColorCombo:     "",
  SizeCombo:      "",
});

// ─── Blank totals ─────────────────────────────────────────────────────────────
const EMPTY_TOTALS = {
  productTotal: "0.00",
  cdAmt:        "0.00",
  discAmt:      "0.00",
  gstAmt:       "0.00",
  cessAmt:      "0.00",
  cgstAmt:      "0.00",
  sgstAmt:      "0.00",
  netAmt:       "0.00",
  totalQty:     "0.000",
};

// ─── BASE_COLUMNS mirrors jQuery InVisibleColumns ────────────────────────────
const BASE_COLUMNS = [
  { key: "ProductCode",     label: "Product Code",  defaultWidth: 110, align: "left",  editable: true,  defaultVisible: true  },
  { key: "ProductName",     label: "Description",   defaultWidth: 200, align: "left",  editable: true,  defaultVisible: true  },
  { key: "MRP",             label: "MRP",           defaultWidth: 80,  align: "right", editable: true,  defaultVisible: true  },
  { key: "PurchaseRate",    label: "Pur.Rate",      defaultWidth: 85,  align: "right", editable: true,  defaultVisible: true  },
  { key: "NomQty",          label: "NomsQty",       defaultWidth: 70,  align: "right", editable: true,  defaultVisible: true  },
  { key: "UOM",             label: "UOM",           defaultWidth: 60,  align: "left",  editable: false, defaultVisible: true  },
  { key: "StockQty",        label: "Stock",         defaultWidth: 70,  align: "right", editable: false, defaultVisible: true  },
  { key: "ItemQty",         label: "Quantity",      defaultWidth: 80,  align: "right", editable: true,  defaultVisible: true  },
  { key: "FreeQty",         label: "Free Qty",      defaultWidth: 75,  align: "right", editable: true,  defaultVisible: true  },
  { key: "cdpercent",       label: "C.D(%)",        defaultWidth: 70,  align: "right", editable: true,  defaultVisible: true  },
  { key: "cdAmount",        label: "C.D Amt",       defaultWidth: 75,  align: "right", editable: false, defaultVisible: true  },
  { key: "DiscountPercent", label: "Disc(%)",       defaultWidth: 65,  align: "right", editable: true,  defaultVisible: true  },
  { key: "DiscountAmt",     label: "Disc Amt",      defaultWidth: 75,  align: "right", editable: false, defaultVisible: true  },
  { key: "TaxPercent",      label: "GST(%)",        defaultWidth: 65,  align: "right", editable: true,  defaultVisible: true  },
  { key: "TaxAmt",          label: "GST Amt",       defaultWidth: 75,  align: "right", editable: false, defaultVisible: true  },
  { key: "CESSPer",         label: "CESS(%)",       defaultWidth: 65,  align: "right", editable: true,  defaultVisible: false },
  { key: "CESSAmount",      label: "CESS Amt",      defaultWidth: 75,  align: "right", editable: false, defaultVisible: false },
  { key: "SPLCESS",         label: "SPLCESS(%)",    defaultWidth: 65,  align: "right", editable: true,  defaultVisible: false },
  { key: "SPLCESSAmount",   label: "SPLCESS Amt",   defaultWidth: 75,  align: "right", editable: false, defaultVisible: false },
  { key: "LandingCost",     label: "Landing Cost",  defaultWidth: 100, align: "right", editable: false, defaultVisible: true  },
  { key: "MfgDate",         label: "MF Date",       defaultWidth: 95,  align: "left",  editable: true,  defaultVisible: false },
  { key: "ExpiryDate",      label: "Exp.Date",      defaultWidth: 95,  align: "left",  editable: true,  defaultVisible: false },
  { key: "Bat_No",          label: "BatchNo",       defaultWidth: 90,  align: "left",  editable: true,  defaultVisible: false },
  { key: "Salerate",        label: "SaleRate",      defaultWidth: 85,  align: "right", editable: true,  defaultVisible: false },
  { key: "Amount",          label: "Amount",        defaultWidth: 100, align: "right", editable: false, defaultVisible: true  },
];

const makeDefaultColConfig = () =>
  BASE_COLUMNS.map((c) => ({ key: c.key, visible: c.defaultVisible, width: c.defaultWidth }));

// ─── calcRow: mirrors jQuery Calculation() per-row logic exactly ──────────────
// jQuery lines 3519-3574: Qty, puramt, cdamt, disamt, gstamt, ctamt, stamt, landingcost, Amt
const calcRow = (row, igstStatus = "GST") => {
  const Qty     = valNum(row.ItemQty) + valNum(row.Noms);
  if (!nullStr(row.ProductCode)) return row;

  const puramt  = roundOff(valNum(row.PurchaseRate) * Qty);
  const cdamt   = roundOff(puramt * (valNum(row.cdpercent) / 100));
  const disamt  = roundOff((puramt - cdamt) * (valNum(row.DiscountPercent) / 100));

  let gstamt = 0, ctamt = 0, stamt = 0, cessamt = 0, splcessamt = 0, landingcost = 0, Amt = 0;
  let C1 = 0, D1 = 0;

  if (Qty !== 0) {
    C1 = valNum(cdamt) / Qty;
    D1 = valNum(disamt) / Qty;
  }

  const netpurrate = roundOff(valNum(row.PurchaseRate) - (C1 + D1));

  if (netpurrate !== 0 && Qty !== 0) {
    cessamt    = roundOff((netpurrate * Qty) * (valNum(row.CESSPer) / 100));
    splcessamt = roundOff(Qty * valNum(row.SPLCESS));
    ctamt      = roundOff((netpurrate * Qty) * ((valNum(row.TaxPercent) / 2) / 100));
    stamt      = ctamt;
    gstamt     = roundOff(ctamt + stamt);

    if (igstStatus === "IGST" || igstStatus === "UGST") {
      stamt = 0;
      ctamt = gstamt;
    }

    landingcost = roundOff(netpurrate + (gstamt + cessamt + splcessamt) / Qty);
    Amt = roundOff(puramt - (cdamt + disamt) + (gstamt + cessamt + splcessamt));
  }

  // StockQtyNew calculation (mirrors jQuery lines 3543-3544)
  let nomqty = 1;
  if (valNum(row.NomQty) !== 0) nomqty = valNum(row.NomQty);
  const stockQtyNew = (nomqty * Qty) + valNum(row.FreeQty);

  return {
    ...row,
    cdAmount:      fmt2(cdamt),
    DiscountAmt:   fmt2(disamt),
    TaxAmt:        fmt2(gstamt),
    CTAmount:      fmt2(ctamt),
    STAmount:      fmt2(stamt),
    CESSAmount:    fmt2(cessamt),
    SPLCESSAmount: fmt2(splcessamt),
    LandingCost:   fmt2(landingcost),
    Amount:        fmt2(Amt),
    ProductTotal:  fmt2(puramt),
    StockQtyNew:   fmt2(stockQtyNew),
  };
};

// ─── calcTotals: mirrors jQuery Calculation() summary section ─────────────────
const calcTotals = (rows, otherPlus, otherSub) => {
  let producttotal = 0, totalqty = 0, Tgstamt = 0, Tdiscamt = 0;
  let Tctamt = 0, Tstamt = 0, Tcess = 0, Tcddiscamt = 0;

  rows.forEach((r) => {
    if (!nullStr(r.ProductCode)) return;
    producttotal += valNum(r.ProductTotal);
    totalqty     += valNum(r.ItemQty);
    Tgstamt      += valNum(r.TaxAmt);
    Tdiscamt     += valNum(r.DiscountAmt);
    Tctamt       += valNum(r.CTAmount);
    Tstamt       += valNum(r.STAmount);
    Tcess        += valNum(r.CESSAmount);
    Tcddiscamt   += valNum(r.cdAmount);
  });

  const nettotal = (producttotal + Tgstamt + Tcess + valNum(otherPlus))
                 - (Tcddiscamt + Tdiscamt + valNum(otherSub));

  return {
    productTotal: fmt2(producttotal),
    cdAmt:        fmt2(Tcddiscamt),
    discAmt:      fmt2(Tdiscamt),
    gstAmt:       fmt2(Tgstamt),
    cessAmt:      fmt2(Tcess),
    cgstAmt:      fmt2(Tctamt),
    sgstAmt:      fmt2(Tstamt),
    netAmt:       fmt2(nettotal),
    totalQty:     fmt3(totalqty),
  };
};

// ─── gstsplitdetails: mirrors jQuery gstsplitdetails() ───────────────────────
const buildGstSplit = (rows) => {
  const map = {};
  rows.forEach((r) => {
    if (!nullStr(r.ProductCode)) return;
    const pct = nullStr(r.TaxPercent);
    if (!map[pct]) map[pct] = { TaxPercent: pct, TaxAmt: 0, CTAmount: 0, STAmount: 0 };
    map[pct].TaxAmt   += valNum(r.TaxAmt);
    map[pct].CTAmount += valNum(r.CTAmount);
    map[pct].STAmount += valNum(r.STAmount);
  });
  return Object.values(map).filter((g) => valNum(g.TaxAmt) !== 0);
};

// ─── TotalRow sub-component ───────────────────────────────────────────────────
function TotalRow({ label, value, net }) {
  return (
    <div className={`total-row${net ? " net" : ""}`}>
      <span className="total-label">{label}</span>
      <span className="total-value">{value}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PurchaseReturn — main component
// ═══════════════════════════════════════════════════════════════════════════════
export default function PurchaseReturn() {
  const navigate = useNavigate();

  // ── MSG hooks ────────────────────────────────────────────────────────────────
  const { confirm, ConfirmUI } = MSG.useConfirm();
  const { toast, toasts }     = MSG.useToast();

  // ── Permissions ──────────────────────────────────────────────────────────────
  const [perm,         setPerm        ] = useState({ View: 0, Add: 0, Edit: 0, Delete: 0 });
  const [isAuthorized, setIsAuthorized] = useState(false);

  // ── Dual-login guard (mirrors jQuery loginwindow / redis check) ───────────────
  const redirectIfDualLogin = useCallback((res) => {
    if (res?._dualLogin || res?.redis === false) {
      alert("Already Login Another User Please Login Again!!!");
      navigate("/");
      return true;
    }
    return false;
  }, [navigate]);

  // ── Permission guard (mirrors jQuery menudata check) ─────────────────────────
  useEffect(() => {
    const menuStr = localStorage.getItem("menulist");
    if (!menuStr) {
      alert("Session Close Please Login !!!.");
      navigate("/");
      return;
    }
    const menulist = JSON.parse(menuStr);
    const menudata = menulist.filter((o) => o.PageName === "Purchase Return");
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
    setPerm({
      View:   menudata[0].View,
      Add:    menudata[0].Add,
      Edit:   menudata[0].Edit,
      Delete: menudata[0].Delete,
    });
    setIsAuthorized(true);
  }, [navigate]);

  // ── Session (mirrors jQuery Comid, MComid, FYear, MainSet) ───────────────────
  const [sess] = useState(() => {
    try {
      return CC.buildSession("Purchase Return");
    } catch {
      return { Comid: "1", MComid: "1", IdComList: "1", MirrorTable: "0" };
    }
  });

  // ── MainSet flags (mirrors jQuery var declarations) ───────────────────────────
  const [mainSet] = useState(() => {
    try { return (JSON.parse(localStorage.getItem("Mainsetting")) || [{}])[0] || {}; }
    catch { return {}; }
  });
  const [comSet] = useState(() => {
    try { return (JSON.parse(localStorage.getItem("Companysetting")) || [{}])[0] || {}; }
    catch { return {}; }
  });

  const MultipleUOMBilling           = mainSet.MultipleUOMBilling || false;
  const PaymentBill                  = mainSet.PaymentBill || false;
  const SaveDislogPurchasereturn     = mainSet.SaveDislogPurchasereturn || false;
  const TextilesSerialNowiseBilling  = mainSet.TextilesSerialNowiseBilling || false;
  const BatchWisePurchaseSale        = mainSet.BatchWiseStock || false;
  const AlwaysBatchCreatedAllItem    = mainSet.AlwaysBatchCreatedAllItem || false;
  const PrintA4Bill                  = SaveDislogPurchasereturn ? 1 : 0;
  const FYear                        = comSet.FYear || "";

  // ── Master-form state (mirrors jQuery form fields) ────────────────────────────
  const [purchaseNo,    setPurchaseNo   ] = useState("");
  const [purchaseDate,  setPurchaseDate ] = useState(today());
  const [purchaseType,  setPurchaseType ] = useState("CREDIT");
  const [igstStatus,    setIgstStatus   ] = useState("GST");   // IGSTBillStatus
  const [remarks,       setRemarks      ] = useState("");
  const [otherPlus,     setOtherPlus    ] = useState("0.00");
  const [otherSub,      setOtherSub     ] = useState("0.00");
  const [editId,        setEditId       ] = useState(0);         // EditId
  const [updateIdEdit,  setUpdateIdEdit ] = useState("");        // UpdateIdEdit
  const [creditDays,    setCreditDays   ] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState(false);     // PaymentStatus
  const [paymentFlag,   setPaymentFlag  ] = useState(false);     // paymentflag
  const [realStockList, setRealStockList] = useState([]);        // RealStockList

  // ── Supplier state ────────────────────────────────────────────────────────────
  const [supplierList,   setSupplierList  ] = useState([]);        // objSlist
  const [supplierId,     setSupplierId    ] = useState("");
  const [supplierInfo,   setSupplierInfo  ] = useState({ address: "", city: "", phone: "", balance: "0.00" });
  const [supplierQuery,  setSupplierQuery ] = useState("");
  const [supplierDD,     setSupplierDD    ] = useState([]);
  const [supplierDDOpen, setSupplierDDOpen] = useState(false);
  const [supplierSelIdx, setSupplierSelIdx] = useState(0);
  const [stockDisplay,   setStockDisplay  ] = useState("0.00");   // lblstock

  // ── Grid state ────────────────────────────────────────────────────────────────
  const [gridRows,     setGridRows    ] = useState([makeGridRow()]);
  const [selectedCell, setSelectedCell] = useState({ rowKey: null, colKey: null });
  const [colConfig,    setColConfig   ] = useState(() => makeDefaultColConfig());
  const colConfigRef = useRef(makeDefaultColConfig());
  useEffect(() => { colConfigRef.current = colConfig; }, [colConfig]);

  // ── Totals + GST split ────────────────────────────────────────────────────────
  const [totals,   setTotals  ] = useState(EMPTY_TOTALS);
  const [gstSplit, setGstSplit] = useState([]);

  // ── Focus columns (Ctrl+G, mirrors jQuery focusgridcolumns) ──────────────────
  const [focusgridcolumns, setFocusgridcolumns] = useState([]);
  const focusgridcolumnsRef = useRef([]);
  useEffect(() => { focusgridcolumnsRef.current = focusgridcolumns; }, [focusgridcolumns]);

  // ── Loading state ─────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);

  // ── Edit state flags ──────────────────────────────────────────────────────────
  const [editStatus, setEditStatus] = useState(0); // EditStatus (0=new, 1=editing)

  // ── Popups ────────────────────────────────────────────────────────────────────
  // Product Lookup Popup
  const [productPopup, setProductPopup] = useState({ open: false, rowKey: null, list: [], query: "" });
  // MRP Selection Popup
  const [mrpPopup, setMrpPopup] = useState({ open: false, rowKey: null, list: [] });
  // F5 List View Popup
  const [f5Open,      setF5Open     ] = useState(false);
  const [f5List,      setF5List     ] = useState([]);
  const [f5Details,   setF5Details  ] = useState([]);
  const [f5FromDate,  setF5FromDate ] = useState(today());
  const [f5ToDate,    setF5ToDate   ] = useState(today());
  const [f5SuppId,    setF5SuppId   ] = useState("0");
  const [f5ExpandRow, setF5ExpandRow] = useState(null);
  const [f5SuppDD,    setF5SuppDD   ] = useState([]);
  const [f5SuppQuery, setF5SuppQuery] = useState("");
  // F12 Column Config Popup
  const [f12Open,     setF12Open    ] = useState(false);
  const [f12Cols,     setF12Cols    ] = useState([]);
  // Ctrl+G Focus Columns Popup (mirrors jQuery focuswindow + jqxListBox)
  const [ctrlGOpen,      setCtrlGOpen     ] = useState(false);
  const [ctrlGCols,      setCtrlGCols     ] = useState([]);
  const [ctrlGSaving,    setCtrlGSaving   ] = useState(false);
  // LoadPM Popup (Purchase bills of supplier)
  const [loadPmOpen,  setLoadPmOpen ] = useState(false);
  const [loadPmList,  setLoadPmList ] = useState([]);
  const [loadPmSelIdx, setLoadPmSelIdx] = useState(0);
  // LoadPD Popup (Purchase details to return)
  const [loadPdOpen,  setLoadPdOpen ] = useState(false);
  const [loadPdList,  setLoadPdList ] = useState([]);
  // Payment Popup
  const [payPopupOpen, setPayPopupOpen] = useState(false);
  const [paymentList,  setPaymentList  ] = useState([]);
  // Edit Password Modal (mirrors jQuery EditPasswordWindow)
  const [editPwdOpen,    setEditPwdOpen   ] = useState(false);
  const [editPwdTitle,   setEditPwdTitle  ] = useState("");
  const [editPwdValue,   setEditPwdValue  ] = useState("");
  const [editPwdError,   setEditPwdError  ] = useState("");
  const [editPwdLoading, setEditPwdLoading] = useState(false);
  const [passwordType,   setPasswordType  ] = useState(0);   // PasswordType
  const [pressKey,       setPressKey      ] = useState("");   // Presskey
  // pendingEditAction: used when Edit/Delete is triggered from F5 list
  // { type: "EDIT", id } | { type: "DELETE", id, pno, updateId }
  const [pendingEditAction, setPendingEditAction] = useState(null);

  // ── DOM refs ──────────────────────────────────────────────────────────────────
  const supplierInputRef = useRef(null);
  const remarksRef       = useRef(null);
  const otherPlusRef     = useRef(null);
  const otherSubRef      = useRef(null);
  const purchaseDateRef  = useRef(null);
  const purchaseTypeRef  = useRef(null);
  const focusCellRef     = useRef(null);   // set below via useCallback
  const handleClearRef   = useRef(null);   // stable ref to handleClear — breaks forward dependency
  const openF5ViewRef    = useRef(null);   // stable ref to openF5View — breaks circular dep with handleDelete

  // ─────────────────────────────────────────────────────────────────────────────
  //  INIT (mirrors jQuery methods.init)
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthorized) return;
    loadSupplierList();
    loadFocusColumns();
    loadVisibleColumns();
    fetchMaxNo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  SUPPLIER LIST (mirrors jQuery SupplierDetailsLoad init + objSlist)
  // ─────────────────────────────────────────────────────────────────────────────
  const loadSupplierList = useCallback(async () => {
    const res = await CC.api(CC.PR_SupplierAll, null, {}, { Comid: sess.MComid, AccountType: "SUPPLIER" });
    if (redirectIfDualLogin(res)) return;
    const list = Array.isArray(res?.data) ? res.data
               : Array.isArray(res?.Data1) ? res.Data1
               : Array.isArray(res) ? res : [];
    setSupplierList(list);
    setF5SuppDD(list);
  }, [sess.MComid, redirectIfDualLogin]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  FETCH MAX PURCHASE RETURN NUMBER (mirrors jQuery MaxPurchaseReturnNo)
  // ─────────────────────────────────────────────────────────────────────────────
  const fetchMaxNo = useCallback(async () => {
    const res = await CC.api(CC.PR_MaxNo, null, {}, { Comid: sess.Comid });
    if (redirectIfDualLogin(res)) return;
    if (res?.ok) setPurchaseNo(res.No ?? res.data ?? "");
  }, [sess.Comid, redirectIfDualLogin]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  LOAD VISIBLE COLUMNS (mirrors jQuery VisibleColumn("PurchaseReturn", ...))
  // ─────────────────────────────────────────────────────────────────────────────
  const loadVisibleColumns = useCallback(async () => {
    try {
        const url =  CC.BASE_URL + `${CC1.GetFocusColumnsUrl}?comid=${sess.Comid}&filename=PurchaseReturn`;
      // Use relative URL + cache-buster (mirrors PurchasesMaster — static file, no auth headers)
      const res = await fetch(
       url
      );
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return;
      
      // ⚠️ jQuery stores the INVERTED visible flag:
      //   savedVisible=false → column is SHOWN (visible=true)
      //   savedVisible=true  → column is HIDDEN (visible=false)
      setColConfig((prev) =>
        prev.map((cfg) => {
          const saved = data.find((d) => d.column === cfg.key);
          if (!saved) return cfg;
          const visible = saved.Visible === false ? true : false;
          return { ...cfg, visible, width: saved.Width || cfg.width };
        })
      );
    } catch { /* silently ignore */ }
  }, [sess.MComid]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  LOAD FOCUS COLUMNS (mirrors jQuery focusgridcolumns)
  // ─────────────────────────────────────────────────────────────────────────────
  const loadFocusColumns = useCallback(async () => {
    // ── Mirror PurchasesMaster loadFocusColumns exactly ──────────────────────
    // Step 1: Build draft from VISIBLE columns only (reads colConfigRef for live F12 state)
    const liveColConfig = colConfigRef.current;
    const visibleBases = BASE_COLUMNS.filter((c) => {
      const cfg = liveColConfig.find((x) => x.key === c.key);
      return cfg ? cfg.visible : c.defaultVisible;
    });
    let draft = visibleBases.map((c, i) => ({
      column: c.key,
      label:  c.label,
      Index:  i,
      Focus:  true,   // default enabled for all visible columns
    }));

    // Step 2: Overlay saved focus settings (relative URL, no auth headers — static file)
    try {
        const url =  CC.BASE_URL + `${CC1.GetFocusColumnsUrl}?comid=${sess.Comid}&filename=PurchaseReturnFocus`;
      const res = await fetch(
       url
      );
      if (res.ok) {
        const saved = await res.json();
        if (Array.isArray(saved) && saved.length > 0) {
          saved.forEach((s) => {
            const idx = draft.findIndex((d) => d.column === s.column);
            if (idx !== -1) {
              // Columns hidden by F12 are not in draft → skip (idx === -1), same as PurchasesMaster
              draft[idx].Focus = s.Focus === true || s.Focus === "true" || s.Focus === 1;
              draft[idx].Index = s.Index ?? draft[idx].Index;
            }
          });
          // Sort by saved Index (mirrors jQuery columnsnew.sort(compare))
          draft.sort((a, b) => a.Index - b.Index);
        }
      }
    } catch { /* file missing on first use — keep defaults */ }

    // Step 3: Apply to runtime focusgridcolumns (used by getEditableFocusCols / navigation)
    setFocusgridcolumns(draft.map((d) => ({ column: d.column, focus: d.Focus ? 1 : 0 })));
  }, [sess.MComid]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  focusCell: generic cell-focus helper (mirrors jqxGrid selectcell+focus)
  // ─────────────────────────────────────────────────────────────────────────────
  const focusCell = useCallback((rowKey, colKey) => {
    setTimeout(() => {
      const el = document.getElementById(`cell_${rowKey}_${colKey}`);
      if (el) { el.focus(); el.select?.(); }
    }, 30);
  }, []);

  useEffect(() => { focusCellRef.current = focusCell; }, [focusCell]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  VISIBLE + EDITABLE COLUMNS (with focus columns filter)
  // ─────────────────────────────────────────────────────────────────────────────
  const getVisibleCols = useCallback(() => {
    return BASE_COLUMNS.filter((c) => {
      const cfg = colConfigRef.current.find((x) => x.key === c.key);
      return cfg ? cfg.visible : c.defaultVisible;
    });
  }, []);

  const getEditableFocusCols = useCallback(() => {
    const visible = BASE_COLUMNS.filter((c) => {
      const cfg = colConfigRef.current.find((x) => x.key === c.key);
      return c.editable && (cfg ? cfg.visible : c.defaultVisible);
    });
    const live = focusgridcolumnsRef.current;
    if (live.length === 0) return visible;
    return visible.filter((c) => {
      const fc = live.find((f) => f.column === c.key);
      return fc ? fc.focus === 1 : true;
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  //  SUPPLIER SELECTION (mirrors jQuery SupplierDetailsLoad + cmbsupplier)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleSupplierSelect = useCallback(async (sup) => {
    setSupplierId(String(sup.Id));
    setSupplierQuery(sup.AccountName || "");
    setSupplierDDOpen(false);
    setSupplierDD([]);
    setCreditDays(parseInt(sup.CreditBillDays ?? 0, 10) || 0);
    setIgstStatus(sup.IGSTBill || "GST");

    // Populate address/city/phone
    setSupplierInfo({
      address: `${sup.Address1 || ""} ${sup.Address2 || ""}`.trim(),
      city:    sup.City     || "",
      phone:   sup.MobileNo || "",
      balance: "0.00",
    });

    // Fetch current balance (mirrors jQuery CurrentBalance AJAX)
    const balRes = await CC.api(CC.PR_CurBalance, null, {}, {
      Id:          Number(sup.Id),
      Comid:       Number(sess.Comid),
      MComid:      Number(sess.MComid),
      TillDate:    purchaseDate || today(),
      AccountType: "SUPPLIER",
    });
    if (redirectIfDualLogin(balRes)) return;
    const balance = balRes?.ok ? fmt2(valNum(balRes.data)) : "0.00";
    setSupplierInfo((p) => ({ ...p, balance }));

    // Auto open LoadPM (mirrors jQuery cmbsupplier keydown Enter → LoadPM)
    openLoadPM(String(sup.Id));

    // Move focus (mirrors jQuery NextFocus('cmbsupplier'))
    setTimeout(() => purchaseDateRef.current?.focus(), 100);
  }, [sess.Comid, sess.MComid, purchaseDate, redirectIfDualLogin]);

  const openSupplierDD = useCallback(() => {
    if (!supplierList.length) return;
    setSupplierDD(supplierList);
    setSupplierSelIdx(0);
    setSupplierDDOpen(true);
  }, [supplierList]);

  const handleSupplierInput = useCallback((val) => {
    setSupplierQuery(val);
    setSupplierId("");
    if (!val.trim()) {
      setSupplierDD(supplierList);
      setSupplierSelIdx(0);
      setSupplierDDOpen(supplierList.length > 0);
      return;
    }
    const q = val.toLowerCase();
    const filtered = supplierList.filter((s) => (s.AccountName || "").toLowerCase().includes(q));
    setSupplierDD(filtered);
    setSupplierSelIdx(0);
    setSupplierDDOpen(filtered.length > 0);
  }, [supplierList]);

  const supplierKeyDown = useCallback((e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!supplierDDOpen) openSupplierDD();
      else setSupplierSelIdx((i) => Math.min(i + 1, supplierDD.length - 1));
      return;
    }
    if (e.key === "ArrowUp") { e.preventDefault(); setSupplierSelIdx((i) => Math.max(i - 1, 0)); return; }
    if (e.key === "Escape")  { setSupplierDDOpen(false); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      if (supplierDDOpen) {
        const chosen = supplierDD[supplierSelIdx];
        if (chosen) handleSupplierSelect(chosen);
        else toast("❌ Select Valid Supplier !!!.", true);
        return;
      }
      if (supplierId) { purchaseDateRef.current?.focus(); return; }
      if (supplierQuery.trim()) {
        const exact = supplierList.find((s) =>
          (s.AccountName || "").toLowerCase() === supplierQuery.toLowerCase()
        );
        if (exact) { handleSupplierSelect(exact); return; }
      }
      toast("❌ Select Vaild Supplier !!!.", true);
    }
  }, [supplierDDOpen, supplierDD, supplierSelIdx, supplierId, supplierQuery, supplierList, openSupplierDD, handleSupplierSelect, toast]);

  // Sync supplier text when id changes externally (e.g., edit load)
  useEffect(() => {
    if (!supplierId) return;
    const found = supplierList.find((s) => String(s.Id) === String(supplierId));
    if (found) setSupplierQuery(found.AccountName || "");
  }, [supplierId, supplierList]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  RECALCULATE ALL ROWS + TOTALS
  //  Mirrors jQuery Calculation(rowindex, status)
  //  status=0 → recalc nothing (just totals); status=1 → rowindex only; status=2 → all
  // ─────────────────────────────────────────────────────────────────────────────
  const recalcAll = useCallback((rows, op, oth) => {
    const updated = rows.map((r) => nullStr(r.ProductCode) ? calcRow(r, igstStatus) : r);
    const t = calcTotals(updated, op, oth);
    const gst = buildGstSplit(updated);
    setGridRows(updated);
    setTotals(t);
    setGstSplit(gst);
    return updated;
  }, [igstStatus]);

  const recalcTotalsOnly = useCallback((rows, op, oth) => {
    const t = calcTotals(rows, op, oth);
    const gst = buildGstSplit(rows);
    setTotals(t);
    setGstSplit(gst);
  }, []);

  const recalcSingleRow = useCallback((rowKey) => {
    setGridRows((prev) => {
      const idx = prev.findIndex((r) => r._key === rowKey);
      if (idx === -1) return prev;
      const updated = [...prev];
      if (nullStr(prev[idx].ProductCode)) updated[idx] = calcRow(prev[idx], igstStatus);
      const t = calcTotals(updated, otherPlus, otherSub);
      const gst = buildGstSplit(updated);
      setTotals(t);
      setGstSplit(gst);
      return updated;
    });
  }, [igstStatus, otherPlus, otherSub]);

  // Recalc when igstStatus or other fields change
  useEffect(() => {
    if (gridRows.some((r) => nullStr(r.ProductCode))) {
      recalcAll(gridRows, otherPlus, otherSub);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [igstStatus]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  GRID CELL CHANGE
  // ─────────────────────────────────────────────────────────────────────────────
  const CALC_KEYS = new Set([
    "PurchaseRate","cdpercent","DiscountPercent","CESSPer","SPLCESS",
    "TaxPercent","ItemQty","NomQty","FreeQty","Salerate",
  ]);

  const handleCellChange = useCallback((rowKey, colKey, value) => {
    setGridRows((prev) => {
      const idx = prev.findIndex((r) => r._key === rowKey);
      if (idx === -1) return prev;
      const row = { ...prev[idx], [colKey]: value };
      const updated = [...prev];
      if (CALC_KEYS.has(colKey) && nullStr(row.ProductCode)) {
        updated[idx] = calcRow(row, igstStatus);
      } else {
        updated[idx] = row;
      }
      const t = calcTotals(updated, otherPlus, otherSub);
      const gst = buildGstSplit(updated);
      setTotals(t);
      setGstSplit(gst);
      return updated;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [igstStatus, otherPlus, otherSub]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  FILL PRODUCT BY CODE (mirrors jQuery FillItemsCode / FillItems)
  // ─────────────────────────────────────────────────────────────────────────────
  const fillProductByCode = useCallback(async (code, rowKey) => {
    if (!code?.trim()) return;
    try {
      setLoading(true);
      const res = await CC.api(CC.PR_ItemByCode, null, {}, {
        code:    code.trim(),
        Comid:   sess.MComid,
        CComid:  sess.Comid,
        Id:      0,
        Batchwise: 0,
      });
      if (redirectIfDualLogin(res)) return;
      if (res?._netErr) { toast("❌ Technical Fault. Contact Software Vendor !!!.", true); return; }

      const list = Array.isArray(res) ? res
                 : Array.isArray(res?.Data1) ? res.Data1
                 : Array.isArray(res?.data) ? res.data : [];

      if (list.length === 0) {
        toast("❌ Invalid Product Code !!!.", true);
        return;
      }
      if (list.length === 1) {
        applyProductToRow(rowKey, list[0]);
        return;
      }
      // > 1 results → show MRP selection popup (mirrors jQuery MRPWindow)
      setMrpPopup({ open: true, rowKey, list });
    } finally {
      setLoading(false);
    }
  }, [sess.MComid, sess.Comid, redirectIfDualLogin, toast]);

  const applyProductToRow = useCallback((rowKey, p) => {
    setGridRows((prev) => {
      const idx = prev.findIndex((r) => r._key === rowKey);
      if (idx === -1) return prev;
      let row = {
        ...prev[idx],
        ProductRefId:    p.Id,
        ProductCode:     p.ProductCode || p.Prod_Code || "",
        ProductName:     p.ProductName || p.PName || "",
        HSNCode:         p.HSNCode     || "",
        UOM:             p.UOM         || "",
        UOMDecimal:      p.UOMDecimal  ?? 3,
        UOMRefid:        p.UomRefid    || p.UOMRefId || "",
        MRP:             fmt2(p.MRP          || 0),
        OldMRP:          fmt2(p.MRP          || 0),
        PurchaseRate:    fmt2(p.PurchaseRate  || 0),
        OldPurchaseRate: fmt2(p.PurchaseRate  || 0),
        TaxPercent:      fmt2(p.GST           || 0),
        LandingCost:     fmt2(p.LandingCost   || 0),
        Salerate:        fmt2(p.SalesRate     || 0),
        CESSPer:         fmt2(p.CESS          || 0),
        SPLCESS:         fmt2(p.SPLCESS       || 0),
        Expirydays:      fmt0(p.ExpriyDays    || 0),
        StockQty:        fmt2(p.Stock         || 0),
        Nstock:          fmt2(p.Nstock        || 0),
        NomQty:          p.NomsQty || "0",
        BatchStatus:     AlwaysBatchCreatedAllItem ? 1 : (p.BatchwiseStock || 0),
        SerialNoStatus:  p.SerialNoType || 0,
      };
      row = calcRow(row, igstStatus);
      const updated = [...prev];
      updated[idx] = row;
      // Auto-add new empty row if at end
      const last = updated[updated.length - 1];
      if (last._key === rowKey || last.ProductCode !== "") updated.push(makeGridRow());

      // Update stock display
      setStockDisplay(fmt2(p.Stock || 0));

      const t = calcTotals(updated, otherPlus, otherSub);
      const gst = buildGstSplit(updated);
      setTotals(t);
      setGstSplit(gst);
      return updated;
    });
    setProductPopup({ open: false, rowKey: null, list: [], query: "" });

    // Focus next editable column after ProductCode
    setTimeout(() => {
      const focusCols = getEditableFocusCols();
      const pcIdx = focusCols.findIndex((c) => c.key === "ProductCode");
      const nextCol = focusCols[pcIdx + 1] ?? null;
      if (nextCol) focusCellRef.current(rowKey, nextCol.key);
    }, 80);
  }, [igstStatus, otherPlus, otherSub, AlwaysBatchCreatedAllItem, getEditableFocusCols]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  DELETE GRID ROW (mirrors jQuery Delete key handling)
  //  Mirrors jQuery Shift+Del → DeleteRow()
  // ─────────────────────────────────────────────────────────────────────────────
  const deleteGridRow = useCallback(async (rowKey) => {
    const row = gridRows.find((r) => r._key === rowKey);
    if (!row) return;
    const ok = await confirm("Do you Want to Delete Row?");
    if (!ok) return;
    setGridRows((prev) => {
      const next = prev.filter((r) => r._key !== rowKey);
      const result = next.length === 0 ? [makeGridRow()] : next;
      // Ensure trailing empty row
      if (result[result.length - 1].ProductCode !== "") result.push(makeGridRow());
      const t = calcTotals(result, otherPlus, otherSub);
      const gst = buildGstSplit(result);
      setTotals(t);
      setGstSplit(gst);
      return result;
    });
  }, [gridRows, confirm, otherPlus, otherSub]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  GRID KEYBOARD NAVIGATION (mirrors jQuery gridpurchase keydown)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleGridKeyDown = useCallback((e, rowKey, colKey) => {
    const focusCols = getEditableFocusCols();
    const allVisible = getVisibleCols();
    const colIdx  = focusCols.findIndex((c) => c.key === colKey);
    const rowIdx  = gridRows.findIndex((r) => r._key === rowKey);

    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();

      // ── ProductCode → fill product ──────────────────────────────────────────
      if (colKey === "ProductCode") {
        const row  = gridRows[rowIdx];
        const code = nullStr(row.ProductCode).trim();
        if (code === "") {
          setProductPopup({ open: true, rowKey, list: [], query: "", autoLoad: true });
          return;
        }
        fillProductByCode(code, rowKey);
        return;
      }

      // ── PurchaseRate → validate not zero (mirrors jQuery lines 1250-1267) ──
      if (colKey === "PurchaseRate") {
        const row = gridRows[rowIdx];
        const rateVal = valNum(row.PurchaseRate);
        setGridRows((prev) => prev.map((r) => r._key === rowKey
          ? { ...r, PurchaseRate: fmt2(r.PurchaseRate) } : r));
        if (rateVal === 0) {
          toast("❌ Enter the PurchaseRate !!!.", true);
          return;
        }
        // Move to next cell after validation
        const nextColIdx = colIdx + 1;
        if (nextColIdx < focusCols.length) {
          focusCell(rowKey, focusCols[nextColIdx].key);
        }
        return;
      }

      // ── ItemQty → auto-set to 1 if 0 (mirrors jQuery lines 1273-1296) ─────
      if (colKey === "ItemQty") {
        setGridRows((prev) => {
          const idx2 = prev.findIndex((r) => r._key === rowKey);
          if (idx2 === -1) return prev;
          const row2 = prev[idx2];
          let qty = valNum(row2.ItemQty);
          const noms = valNum(row2.Noms);
          if (qty + noms === 0) {
            qty = 1;
          }
          const dec = row2.UOMDecimal ?? 3;
          const fmtQty = dec === 0 ? fmt0(qty) : dec === 2 ? fmt2(qty) : fmt3(qty);
          const updated = [...prev];
          updated[idx2] = calcRow({ ...row2, ItemQty: fmtQty }, igstStatus);
          const t = calcTotals(updated, otherPlus, otherSub);
          const gst = buildGstSplit(updated);
          setTotals(t);
          setGstSplit(gst);
          return updated;
        });
        const nextColIdx = colIdx + 1;
        if (nextColIdx < focusCols.length) {
          focusCell(rowKey, focusCols[nextColIdx].key);
        } else if (rowIdx < gridRows.length - 1) {
          focusCell(gridRows[rowIdx + 1]._key, focusCols[0]?.key ?? allVisible[0]?.key);
        } else {
          const newRow = makeGridRow();
          setGridRows((prev) => [...prev, newRow]);
          setTimeout(() => focusCell(newRow._key, focusCols[0]?.key ?? "ProductCode"), 50);
        }
        return;
      }

      // ── MfgDate → auto-calculate ExpiryDate ────────────────────────────────
      if (colKey === "MfgDate") {
        const row    = gridRows[rowIdx];
        const expDays = parseInt(row.Expirydays, 10) || 0;
        if (row.MfgDate && expDays > 0) {
          const expiry = new Date(row.MfgDate);
          expiry.setDate(expiry.getDate() + expDays);
          if (expiry <= new Date()) {
            toast("❌ Already This Product Was Expired !!!.", true); return;
          }
          const expDate = expiry.toISOString().split("T")[0];
          setGridRows((prev) => prev.map((r) => r._key === rowKey ? { ...r, ExpiryDate: expDate } : r));
        }
      }

      // ── ExpiryDate → validate not expired ──────────────────────────────────
      if (colKey === "ExpiryDate") {
        const row = gridRows[rowIdx];
        if (row.ExpiryDate && new Date(row.ExpiryDate) <= new Date()) {
          toast("❌ Already This Product Was Expired !!!.", true); return;
        }
      }

      // ── Navigate to next cell ───────────────────────────────────────────────
      const nextColIdx = colIdx + 1;
      if (nextColIdx < focusCols.length) {
        focusCell(rowKey, focusCols[nextColIdx].key);
      } else if (rowIdx < gridRows.length - 1) {
        focusCell(gridRows[rowIdx + 1]._key, focusCols[0]?.key ?? allVisible[0]?.key);
      } else {
        const newRow = makeGridRow();
        setGridRows((prev) => {
          const next = [...prev, newRow];
          return next;
        });
        setTimeout(() => focusCell(newRow._key, focusCols[0]?.key ?? "ProductCode"), 50);
      }

    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIdx < gridRows.length - 1) focusCell(gridRows[rowIdx + 1]._key, colKey);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIdx > 0) focusCell(gridRows[rowIdx - 1]._key, colKey);
    } else if (e.key === "Delete" && e.shiftKey) {
      e.preventDefault();
      deleteGridRow(rowKey);
    }
  }, [gridRows, getEditableFocusCols, getVisibleCols, focusCell, fillProductByCode, deleteGridRow, toast, igstStatus, otherPlus, otherSub]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  LOAD PM POPUP (mirrors jQuery LoadPM function)
  //  Fetches purchase bills for selected supplier
  // ─────────────────────────────────────────────────────────────────────────────
  const openLoadPM = useCallback(async (sid) => {
    if (!sid) return;
    setLoading(true);
    // const res = await CC.api(CC.PR_LoadPM, { Sid: Number(sid), Comid: Number(sess.Comid) });
    const res = await CC.api(
      `${CC.PR_LoadPM}?Sid=${Number(sid)}&Comid=${Number(sess.Comid)}`
     );
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (!res?.ok) return;
    const data = Array.isArray(res.data) ? res.data : [];
    if (data.length === 0) return; // No bills; mirrors jQuery skip if empty
    setLoadPmList(data);
    setLoadPmSelIdx(0);
    setLoadPmOpen(true);
  }, [sess.Comid, redirectIfDualLogin]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  LOAD PD POPUP (mirrors jQuery gridloadpm keydown Enter → PurchaseReturnLoadPD)
  //  Fetches purchase details for selected bill
  // ─────────────────────────────────────────────────────────────────────────────
  const openLoadPD = useCallback(async (pmId) => {
    setLoadPmOpen(false);
    setLoading(true);
    // const res = await CC.api(CC.PR_LoadPD, {
    //   PMid:      Number(pmId),
    //   Batchwise: BatchWisePurchaseSale ? 1 : 0,
    //   Serialno:  TextilesSerialNowiseBilling ? 1 : 0,
    // });
    const url =
 `${CC.PR_LoadPD}?PMid=${Number(pmId)}&Batchwise=${BatchWisePurchaseSale ? 1 : 0}&Serialno=${TextilesSerialNowiseBilling ? 1 : 0}`;

const res = await CC.api(url);
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (!res?.ok) return;
    let data = Array.isArray(res.data) ? res.data : [];

    // Format ItemQty per UOMDecimal (mirrors jQuery getdata.forEach)
    data = data.map((obj) => {
      const dec = obj.UOMDecimal ?? 3;
      return {
        ...obj,
        ItemQty:     dec === 0 ? fmt0(obj.ItemQty) : dec === 2 ? fmt2(obj.ItemQty) : fmt3(obj.ItemQty),
        AvaiableQty: fmt2(obj.AvaiableQty),
        ReturnQty:   "",
      };
    });

    setLoadPdList(data);
    setLoadPdOpen(true);
  }, [BatchWisePurchaseSale, TextilesSerialNowiseBilling, redirectIfDualLogin]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  LOAD PD ENTER KEY (mirrors jQuery gridloadpd keydown Enter)
  //  Transfers selected row to main purchase grid
  // ─────────────────────────────────────────────────────────────────────────────
  const handleLoadPdEnter = useCallback((pdRow) => {
    const returnQty = valNum(pdRow.ReturnQty);
    const available = valNum(pdRow.AvaiableQty);

    if (returnQty === 0) {
      // Zero qty: remove from grid if exists, move to next
      setGridRows((prev) => {
        const idx = prev.findIndex((r) => r.IndexidS === pdRow.Indexid1);
        if (idx === -1) return prev;
        const next = prev.filter((_, i) => i !== idx);
        if (next.length === 0 || next[next.length - 1].ProductCode !== "") next.push(makeGridRow());
        const t = calcTotals(next, otherPlus, otherSub);
        const gst = buildGstSplit(next);
        setTotals(t);
        setGstSplit(gst);
        return next;
      });
      return true; // proceed to next row
    }

    if (returnQty > available) {
      toast("❌ Check Return Qty", true);
      return false;
    }

    // Format qty per UOMDecimal
    const dec = pdRow.UOMDecimal ?? 3;
    const fmtQty = dec === 0 ? fmt0(returnQty) : dec === 2 ? fmt2(returnQty) : fmt3(returnQty);

    setGridRows((prev) => {
      // Remove existing row with same IndexidS
      let updated = prev.filter((r) => r.IndexidS !== pdRow.Indexid1);
      // Ensure trailing empty row
      if (updated.length === 0 || updated[updated.length - 1].ProductCode !== "") {
        updated.push(makeGridRow());
      }
      const targetIdx = updated.length - 1;
      const newRow = calcRow({
        ...updated[targetIdx],
        ProductRefId:    pdRow.ProductId,
        ProductCode:     pdRow.Productcode || pdRow.ProductCode || "",
        ProductName:     pdRow.ProductName || "",
        PurchaseRate:    fmt2(pdRow.PurRate || 0),
        TaxPercent:      fmt2(pdRow.TaxPer  || 0),
        MRP:             fmt2(pdRow.MRP     || 0),
        UOMDecimal:      pdRow.UOMDecimal ?? 3,
        UOM:             pdRow.UOM || "",
        ItemQty:         fmtQty,
        DiscountPercent: fmt2(pdRow.DiscountPer || 0),
        cdpercent:       fmt2(pdRow.CDPer        || 0),
        BatchRefId:      pdRow.BatchRefid || "",
        ExpiryDate:      pdRow.ExpDate ? jsonDate(pdRow.ExpDate) : "",
        MfgDate:         pdRow.MFDate  ? jsonDate(pdRow.MFDate)  : "",
        IndexidS:        pdRow.Indexid1 || "",
        PDidNew:         pdRow.Id || "",
        PDRefid:         pdRow.Id || "",
        BrandId:         pdRow.BrandId || "",
        ColorId:         pdRow.ColorId || "",
        ModelId:         pdRow.ModelId || "",
        SizeId:          pdRow.SizeId  || "",
        BrandCombo:      pdRow.BrandCombo || "",
        ColorCombo:      pdRow.ColorCombo || "",
        ModelCombo:      pdRow.ModelCombo || "",
        SizeCombo:       pdRow.SizeCombo  || "",
      }, igstStatus);

      updated[targetIdx] = newRow;
      // Always ensure empty trailing row
      updated.push(makeGridRow());

      const t = calcTotals(updated, otherPlus, otherSub);
      const gst = buildGstSplit(updated);
      setTotals(t);
      setGstSplit(gst);
      return updated;
    });

    return true; // proceed to next
  }, [igstStatus, otherPlus, otherSub, toast]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  GRID EMPTY CHECK (mirrors jQuery gridemptycheck)
  // ─────────────────────────────────────────────────────────────────────────────
  const gridEmptyCheck = useCallback(() => {
    const hasData = gridRows.some((r) => nullStr(r.ProductCode) && valNum(r.ItemQty) !== 0);
    if (!hasData) {
      toast("❌ No Product Details !!!.", true);
      return false;
    }
    return true;
  }, [gridRows, toast]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  SAVE (mirrors jQuery methods.PurchaseSave)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (perm.Add === 0) { toast("❌ Page Add Permission Denied !!!.", true); return; }
    if (!gridEmptyCheck()) return;

    if (!supplierId) {
      toast("❌ Select Vaild Supplier !!!.", true);
      supplierInputRef.current?.focus();
      return;
    }

    if (valNum(totals.netAmt) <= 0) {
      toast("❌ Net Total must not be Negative !!!.", true);
      return;
    }

    // Payment window (mirrors jQuery PaymentBill logic)
    if (PaymentBill && !paymentStatus) {
      await openPaymentWindow();
      return;
    }

    const ok = await confirm("Wish to Save Purchase Return Details ?");
    if (!ok) return;

    // Build payload (mirrors jQuery purchasemaster object exactly)
    const sup = supplierList.find((s) => String(s.Id) === String(supplierId)) || {};
    const purchaseDetails = gridRows.filter((r) => nullStr(r.ProductCode));

    const purchaseMaster = [{
      Id:                  editId,
      SupplierRefId:       Number(supplierId),
      PurchaseNo:          purchaseNo,
      CompanyRefId:        Number(sess.Comid),
      PurchaseDate:        purchaseDate,
      PurchaseType:        purchaseType,
      IGSTBill:            igstStatus,
      taxamount:           valNum(totals.gstAmt),
      CTAmount:            valNum(totals.cgstAmt),
      STAmount:            valNum(totals.sgstAmt),
      SupplierName:        sup.AccountName || "",
      SupplierInvoiceNo:   "",
      SupplierInvoiceDate: purchaseDate,
      NetAmt:              valNum(totals.netAmt),
      discamount:          valNum(totals.discAmt),
      cdamount:            valNum(totals.cdAmt),
      Others_A:            valNum(otherPlus),
      Others_D:            valNum(otherSub),
      DueDate:             purchaseDate,
      DisplayAmount:       0,
      FreightCharges:      0,
      CESSAmount:          0,
      SPLCESSAmount:       0,
      Remarks:             remarks,
      UpdateId:            "",
      Credit:              0,
      Address1:            sup.Address1 || "",
      Address2:            sup.Address2 || "",
      City:                sup.City     || "",
      Phone:               sup.MobileNo || "",
      Debit:               valNum(totals.netAmt),
      IGSTAmount:          0,
      PaymentRefId:        null,
      Modified_By:         localStorage.getItem("username") || "",
      PurchaseDetails:     purchaseDetails,
      StockDetails:        realStockList,
      SerialNoDetails:     "",
      PurchaseAmountDetails: paymentList.filter((p) => p.EnterAmt && valNum(p.EnterAmt) !== 0),
    }];

    setLoading(true);
    // const res = await CC.insertapi(CC.PR_Insert, purchaseMaster, {
    //   MirrorTable:    sess.MirrorTable,
    //   PrintA4Invoice: String(PrintA4Bill),
    // });

    console.log("PrintA4Bill =", PrintA4Bill);
console.log("sess.PrintA4 =", sess.PrintA4);

const headers = {
  MirrorTable: sess.MirrorTable,
  LocalDB: 0,
  PrintA4Invoice: String(PrintA4Bill),
};

console.log("PurchaseReturn Headers =", headers);

const res = await CC.insertapi(
  CC.PR_Insert,
  purchaseMaster,
  headers
);
    setLoading(false);

    if (redirectIfDualLogin(res)) return;
    if (res?.ok) {
      if (PrintA4Bill === 1) {
        // mirrors jQuery MsgBoxViewPrint("Do you to Print Purchase Return or View Purchase Return ?")
        const action = window.confirm(
          `${res.message || "Saved Successfully."}\n\nClick OK to View Purchase Return Invoice, Cancel to skip.`
        );
        if (action) {
          const compSet = comSet || {};
          const params = [
            `ReportName=PurchaseReturnInvoice`,
            `Copy=Original`,
            `A4Print=0`,
            `MailSendStatus=0`,
            `CompanyName=${encodeURIComponent(compSet.Companyname || "")}`,
            `Address1=${encodeURIComponent(compSet.Address1 || "")}`,
            `Address2=${encodeURIComponent(compSet.Address2 || "")}`,
            `City=${encodeURIComponent(compSet.City || "")}`,
            `Pincode=${encodeURIComponent(compSet.Pincode || "")}`,
            `MobileNo=${encodeURIComponent(compSet.Phone || "")}`,
            `GSTNO=${encodeURIComponent(compSet.GSTNo || "")}`,
            `Email=${encodeURIComponent(compSet.Email || "")}`,
            `StateCode=${encodeURIComponent(compSet.State || "")}`,
          ].join("&");
          window.open(`../Reports/ReportViewer.aspx?${params}`, "_blank",
            `directories=0,titlebar=0,toolbar=0,location=0,status=0,menubar=0,scrollbars=yes,resizable=no,width=${window.screen.width},height=${window.screen.height - 100}`
          );
        }
        toast(`✔ ${res.message || "Purchase Return Saved Successfully."}`);
      } else {
        toast(`✔ ${res.message || "Purchase Return Saved Successfully."}`);
      }
      handleClearRef.current?.();
    } else {
      toast(`❌ ${res?.message || "Save Failed."}`, true);
    }
  }, [ //openPaymentWindow, 
    perm, gridEmptyCheck, supplierId, totals, PaymentBill, paymentStatus,
    confirm, supplierList, gridRows, editId, purchaseNo, sess, purchaseDate,
    purchaseType, igstStatus, otherPlus, otherSub, remarks, realStockList,
    paymentList, redirectIfDualLogin, toast, PrintA4Bill, comSet,
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  CLEAR (mirrors jQuery methods.clear)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    setEditId(0);
    setUpdateIdEdit("");
    setPurchaseNo("");
    setPurchaseDate(today());
    setPurchaseType("CREDIT");
    setIgstStatus("GST");
    setRemarks("");
    setOtherPlus("0.00");
    setOtherSub("0.00");
    setSupplierId("");
    setSupplierQuery("");
    setSupplierInfo({ address: "", city: "", phone: "", balance: "0.00" });
    setStockDisplay("0.00");
    setCreditDays(0);
    setPaymentStatus(false);
    setPaymentFlag(false);
    setRealStockList([]);
    setGridRows([makeGridRow()]);
    setTotals(EMPTY_TOTALS);
    setGstSplit([]);
    setPaymentList([]);

    if (editStatus === 0) fetchMaxNo();
    // Set focus to first form field (mirrors jQuery methods.OnFocus(focusformcolumns[0].column))
    setTimeout(() => purchaseDateRef.current?.focus(), 100);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editStatus, fetchMaxNo]);

  // Keep ref in sync so handleSave / handleDelete can call handleClear without circular dep
  useEffect(() => { handleClearRef.current = handleClear; }, [handleClear]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  EDIT (mirrors jQuery methods.PurchaseEdit)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleEdit = useCallback(async (pid, pNo = 0) => {
    if (perm.Edit === 0) { toast("❌ Page Edit Permission Denied !!!.", true); return; }
    setLoading(true);
    // ✅ FIXED: use PR_Edit (EditPurchaseReturn), not PR_EditPassword
    const res = await CC.api(
      CC.PR_Edit,
      null,
      {},
      {
        Id: Number(pid),
        PNo: Number(pNo),
        Comid: Number(sess.Comid)
      }
    );
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (!res?.ok) { toast(`❌ ${res?.message || "Load Failed."}`, true); return; }

    // ✅ FIXED: jQuery returns data.Data (array), handle both data.Data and data.data
    const data = res.Data ?? res.data ?? [];
    if (!Array.isArray(data) || data.length === 0) return;

    const pm = data[0];
    const pdetails = pm.PurchaseDetails || [];
    setRealStockList(pm.StockDetails || []);

    setEditStatus(1);
    handleClearRef.current?.();

    setEditId(pm.Id || 0);
    setUpdateIdEdit(pm.UpdateId || "");
    setPurchaseNo(pm.PurchaseNo || "");
    setPurchaseDate(jsonDate(pm.PurchaseDate));
    setPurchaseType(pm.PurchaseType || "CREDIT");
    setIgstStatus(pm.IGSTBill || "GST");
    setOtherPlus(fmt2(pm.Others_A || 0));
    setOtherSub(fmt2(pm.Others_D || 0));
    setRemarks(pm.Remarks || "");
    setSupplierId(String(pm.SupplierRefId || ""));
    setCreditDays(pm.creditdays || 0);

    // Format detail rows (mirrors jQuery purchaseeditloaddetails)
    const formattedRows = pdetails.map((obj) => {
      const dec = obj.UOMDecimal ?? 3;
      return {
        ...makeGridRow(),
        ...obj,
        _key:           CC.uid(),
        MRP:            fmt2(obj.MRP            || 0),
        LandingCost:    fmt2(obj.LandingCost    || 0),
        PurchaseRate:   fmt2(obj.PurchaseRate   || 0),
        cdpercent:      fmt2(obj.cdpercent      || 0),
        cdAmount:       fmt2(obj.cdAmount       || 0),
        DiscountPercent:fmt2(obj.DiscountPercent|| 0),
        DiscountAmt:    fmt2(obj.DiscountAmt    || 0),
        CESSPer:        fmt2(obj.CESSPer        || 0),
        CESSAmount:     fmt2(obj.CESSAmount     || 0),
        SPLCESS:        fmt2(obj.SPLCESS        || 0),
        SPLCESSAmount:  fmt2(obj.SPLCESSAmount  || 0),
        TaxPercent:     fmt2(obj.TaxPercent     || 0),
        TaxAmt:         fmt2(obj.TaxAmt         || 0),
        Noms:           fmt0(obj.Noms           || 0),
        NomQty:         fmt0(obj.NomQty         || 0),
        FreeQty:        fmt2(obj.FreeQty        || 0),
        TotalPcs:       fmt2(obj.TotalPcs       || 0),
        CTAmount:       fmt2(obj.CTAmount       || 0),
        STAmount:       fmt2(obj.STAmount       || 0),
        CTPer:          fmt2(obj.CTPer          || 0),
        STPer:          fmt2(obj.STPer          || 0),
        Meter:          fmt2(obj.Meter          || 0),
        Salerate:       fmt2(obj.Salerate       || 0),
        ExpiryDate:     obj.ExpiryDate ? jsonDate(obj.ExpiryDate) : "",
        MfgDate:        obj.MfgDate    ? jsonDate(obj.MfgDate)    : "",
        ItemQty:        dec === 0 ? fmt0(obj.ItemQty) : dec === 2 ? fmt2(obj.ItemQty) : fmt3(obj.ItemQty),
      };
    });

    const rows = [...formattedRows, makeGridRow()];
    const t = calcTotals(rows, fmt2(pm.Others_A || 0), fmt2(pm.Others_D || 0));
    const gst = buildGstSplit(rows);
    setGridRows(rows);
    setTotals(t);
    setGstSplit(gst);
    setEditStatus(0);
    setF5Open(false);
  }, [perm.Edit, sess.Comid, redirectIfDualLogin, toast, handleClear]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  DELETE (mirrors jQuery F9 → EditPasswordWindow → DeletePurchaseReturn)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (overrideId, overridePno, overrideUpdateId) => {
    const targetId       = overrideId       !== undefined ? overrideId       : editId;
    const displayPno     = overridePno      !== undefined ? overridePno      : purchaseNo;
    const targetUpdateId = overrideUpdateId !== undefined ? overrideUpdateId : updateIdEdit;

    if (perm.Delete === 0) { toast("❌ Page Delete Permission Denied !!!.", true); return; }
    if (!targetId) { toast("❌ No Delete Id !!!.", true); return; }

    const str = `Do You Want TO Delete Purchase Return.This is Return No ${displayPno}?`;
    const ok = await confirm(str);
    if (!ok) return;

    setLoading(true);

    // const res = await CC.deleteapi(
    //   CC.PR_Delete,
    //   realStockList || [],
    //   {
    //     Comid: String(sess.Comid),
    //     Id: String(targetId),
    //     MirrorTable: String(sess.MirrorTable || 0),
    //     Updateid: String(targetUpdateId || ""),
    //     LocalDB: String(sess.LocalDB || 0),
    //     Year: String(FYear || ""),
    //   }
    // );

    const res = await CC.deleteapi(
      CC.PR_Delete,
      realStockList ?? [],
      {
        Comid: String(sess.Comid),
        Id: String(targetId),
        MirrorTable: String(sess.MirrorTable ?? 0),
        Updateid: String(targetUpdateId ?? ""),
        LocalDB: String(sess.LocalDB ?? 0),
        Year: String(FYear ?? ""),
        BillMaster: String(sess.BillMaster ?? 0),
      }
    );
    
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res?.IsSuccess) {
      toast(`✔ ${res.Message || "Deleted Successfully."}`);
      handleClear();
    
      if (f5Open) {
        setTimeout(() => openF5ViewRef.current?.(), 300);
      }
    } else {
      toast(`❌ ${res?.Message || "Delete Failed."}`, true);
    }
  }, [perm.Delete, editId, purchaseNo, updateIdEdit, confirm, realStockList, FYear, sess, redirectIfDualLogin, toast, handleClear, f5Open]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  F5 VIEW (mirrors jQuery methods.F5View)
  // ─────────────────────────────────────────────────────────────────────────────
  const openF5View = useCallback(async () => {
    setLoading(true);
    const res = await CC.api(CC.PR_F5View, null, {}, {   // ← null body, params in 4th arg
      Fromdate: f5FromDate,
      Todate:   f5ToDate,
      Id:       Number(f5SuppId) || 0,
      Comid:    Number(sess.Comid),
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;

    // ── Handle BOTH API response shapes ──────────────────────────────────────
    // Shape A (jQuery original):  res.Data[0].purchasemaster / purchasedetails
    // Shape B (V7 flat):          res.data (master)  + res.data2 / res.Data2 (details)
    let rawMaster  = [];
    let rawDetails = [];

    const dataArr = res?.Data ?? res?.data ?? [];
    if (Array.isArray(dataArr) && dataArr.length > 0 && dataArr[0]?.purchasemaster) {
      // Shape A — nested under Data[0]
      rawMaster  = Array.isArray(dataArr[0].purchasemaster)  ? dataArr[0].purchasemaster  : [];
      rawDetails = Array.isArray(dataArr[0].purchasedetails) ? dataArr[0].purchasedetails : [];
    } else {
      // Shape B — flat
      rawMaster  = Array.isArray(res?.data)  ? res.data
                 : Array.isArray(res?.Data1) ? res.Data1
                 : Array.isArray(dataArr)    ? dataArr : [];
      rawDetails = Array.isArray(res?.data2) ? res.data2
                 : Array.isArray(res?.Data2) ? res.Data2 : [];
    }

    // Normalize master rows — handle both PascalCase and camelCase API responses
    // const master = rawMaster.map((r) => ({
    //   Id:           r.Id           ?? r.id           ?? "",
    //   PurchaseNo:   r.PurchaseNo   ?? r.purchaseNo   ?? "",
    //   PurchaseDate: r.PurchaseDate ?? r.purchaseDate ?? "",
    //   PurchaseType: r.PurchaseType ?? r.purchaseType ?? "",
    //   SupplierName: r.SupplierName ?? r.supplierName ?? "",
    //   InvoiceNo:    r.SupplierInvoiceNo ?? r.supplierInvoiceNo ?? r.InvoiceNo ?? "",
    //   NetAmt:       r.NetAmt       ?? r.netAmt       ?? 0,
    //   Remarks:      r.Remarks      ?? r.remarks      ?? "",
    //   Created_By:   r.Created_By   ?? r.created_By   ?? r.Modified_By ?? "",
    //   UpdateId:     r.UpdateId     ?? r.updateId     ?? "",
    // }));

    const master = rawMaster.map((r) => ({
      Id: r.Id ?? r.id ?? "",
    
      // Backend -> ReturnNo
      PurchaseNo:
        r.PurchaseNo ??
        r.purchaseNo ??
        r.ReturnNo ??
        r.returnNo ??
        "",
    
      // Backend -> Date
      PurchaseDate:
        r.PurchaseDate ??
        r.purchaseDate ??
        r.Date ??
        r.date ??
        "",
    
      // Backend -> Type
      PurchaseType:
        r.PurchaseType ??
        r.purchaseType ??
        r.Type ??
        r.type ??
        "",
    
      // Backend -> SupName
      SupplierName:
        r.SupplierName ??
        r.supplierName ??
        r.SupName ??
        r.supName ??
        "",
    
      NetAmt:
        r.NetAmt ??
        r.netAmt ??
        0,
    
      InvoiceNo:
        r.SupplierInvoiceNo ??
        r.supplierInvoiceNo ??
        r.InvoiceNo ??
        "",
    
      Remarks:
        r.Remarks ??
        r.remarks ??
        "",
    
      Created_By:
        r.Created_By ??
        r.created_By ??
        r.Modified_By ??
        "",
    
      UpdateId:
        r.UpdateId ??
        r.updateId ??
        "",
    }));
    // Normalize detail rows — handle both casings + coerce join key to number
    // const details = rawDetails.map((d) => ({
    //   PurchaseRefId:   Number(d.PurchaseRefId  ?? d.purchaseRefId  ?? 0),
    //   ProductCode:     d.ProductCode     ?? d.productCode     ?? "",
    //   ProductName:     d.ProductName     ?? d.productName     ?? "",
    //   MRP:             d.MRP             ?? d.mrp             ?? 0,
    //   PurchaseRate:    d.PurchaseRate    ?? d.purchaseRate    ?? 0,
    //   ItemQty:         d.ItemQty         ?? d.itemQty         ?? 0,
    //   TaxPercent:      d.TaxPercent      ?? d.taxPercent      ?? 0,
    //   TaxAmt:          d.TaxAmt          ?? d.taxAmt          ?? 0,
    //   DiscountPercent: d.DiscountPercent ?? d.discountPercent ?? 0,
    //   DiscountAmt:     d.DiscountAmt     ?? d.discountAmt     ?? 0,
    //   Amount:          d.Amount          ?? d.amount          ?? 0,
    // }));
    const details = rawDetails.map((d) => ({
      PurchaseRefId: Number(
        d.PurchaseRefId ??
        d.purchaseRefId ??
        d.PurchaseReturnRefId ??
        d.purchaseReturnRefId ??
        0
      ),
    
      ProductCode:
        d.ProductCode ??
        d.productCode ??
        "",
    
      ProductName:
        d.ProductName ??
        d.productName ??
        "",
    
      MRP:
        d.MRP ??
        d.mrp ??
        0,
    
      PurchaseRate:
        d.PurchaseRate ??
        d.purchaseRate ??
        d.ReturnRate ??
        d.returnRate ??
        0,
    
      ItemQty:
        d.ItemQty ??
        d.itemQty ??
        0,
    
      TaxPercent:
        d.TaxPercent ??
        d.taxPercent ??
        0,
    
      TaxAmt:
        d.TaxAmt ??
        d.taxAmt ??
        0,
    
      DiscountPercent:
        d.DiscountPercent ??
        d.discountPercent ??
        0,
    
      DiscountAmt:
        d.DiscountAmt ??
        d.discountAmt ??
        0,
    }));

    setF5List(master);
    setF5Details(details);
    setF5Open(true);
    setF5ExpandRow(null);
  }, [f5FromDate, f5ToDate, f5SuppId, sess.Comid, redirectIfDualLogin]);

  // Keep ref in sync (used by handleDelete to avoid circular dep)
  useEffect(() => { openF5ViewRef.current = openF5View; }, [openF5View]);




// ─────────────────────────────────────────────────────────────────────────────
  //  CTRL+G — GRID FOCUS COLUMNS (mirrors jQuery Ctrl+G → focuswindow)
  //  Lets user check which columns receive tab-focus during Enter navigation
  // ─────────────────────────────────────────────────────────────────────────────
  const openCtrlG = useCallback(async () => {
    // ── Mirror PurchasesMaster handleFocusColOpen → loadFocusColumns exactly ──
    // Step 1: Only include currently VISIBLE columns (jQuery reads iscolumnvisible)
    const liveColConfig = colConfigRef.current;
    const visibleBases = BASE_COLUMNS.filter((c) => {
      const cfg = liveColConfig.find((x) => x.key === c.key);
      return cfg ? cfg.visible : c.defaultVisible;
    });
    let draft = visibleBases.map((c, i) => ({
      key:    c.key,
      label:  c.label,
      Index:  i,
      Focus:  true,   // default enabled for all visible columns
    }));

    // Step 2: Overlay saved focus settings (relative URL, no auth headers — static file)
    try {
                const url =  CC.BASE_URL + `${CC1.GetFocusColumnsUrl}?comid=${sess.Comid}&filename=PurchaseReturnFocus`;
      const res = await fetch(
       url
      );
      if (res.ok) {
        const saved = await res.json();
        if (Array.isArray(saved) && saved.length > 0) {
          saved.forEach((s) => {
            const idx = draft.findIndex((d) => d.key === s.column);
            if (idx !== -1) {
              // Columns hidden by F12 won't be in draft → idx === -1 → skip (same as PurchasesMaster)
              draft[idx].Focus = s.Focus === true || s.Focus === "true" || s.Focus === 1;
              draft[idx].Index = s.Index ?? draft[idx].Index;
            }
          });
          // Sort by saved Index (mirrors jQuery columnsnew.sort(compare))
          draft.sort((a, b) => a.Index - b.Index);
        }
      }
    } catch { /* file missing on first use — keep defaults */ }

    setCtrlGCols(draft);
    setCtrlGOpen(true);
  }, [sess.MComid]);

  const saveCtrlGCols = useCallback(async () => {
    const payload = ctrlGCols.map((c, i) => ({
      filename: "PurchaseReturnFocus",
      column:   c.key,
      Index:    i,
      Focus:    c.Focus,
      Comid:    Number(sess.MComid),
    }));
    setCtrlGSaving(true);
    const res = await CC.api(CC.PR_FocusCols, payload);
    setCtrlGSaving(false);
    if (res?.ok) {
      // Apply saved order immediately to runtime focusgridcolumns
      // Include ALL columns from draft (not just Focus=true) so navigation can check each one's focus state
      setFocusgridcolumns(ctrlGCols.map((c) => ({ column: c.key, focus: c.Focus ? 1 : 0 })));
      toast("✔ Focus Columns Updated. Refreshing…");
      setTimeout(() => window.location.reload(true), 1000);
    } else {
      toast(`❌ ${res?.message || "Save Failed."}`, true);
    }
    setCtrlGOpen(false);
  }, [ctrlGCols, sess.MComid, toast]);


  const openF12 = useCallback(() => {
    const cols = BASE_COLUMNS
      .filter((c) => !c.key.endsWith("combo"))
      .map((c) => {
        const cfg = colConfigRef.current.find((x) => x.key === c.key) || {};
        return { key: c.key, label: c.label, visible: cfg.visible ?? c.defaultVisible, width: cfg.width ?? c.defaultWidth };
      });
    setF12Cols(cols);
    setF12Open(true);
  }, []);

  const saveF12Cols = useCallback(async () => {
    const payload = f12Cols.map((c) => ({
      filename: "PurchaseReturn",
      column:   c.key,
      Visible:  !c.visible,   // ⚠️ invert — jQuery stores opposite of display state (mirrors PurchasesMaster)
      Width:    c.width,
      Comid:    Number(sess.MComid),
    }));
    const res = await CC.api(CC.PR_VisibleCols, payload);
    if (res?.ok) {
      setColConfig(f12Cols.map((c) => ({ key: c.key, visible: c.visible, width: c.width })));
      toast("✔ Columns Updated. Refreshing…");
      setTimeout(() => window.location.reload(true), 1000);
    } else toast(`❌ ${res?.message || "Save Failed."}`, true);
    setF12Open(false);
  }, [f12Cols, sess.MComid, toast]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  EDIT PASSWORD WINDOW (mirrors jQuery EditPasswordWindow)
  // ─────────────────────────────────────────────────────────────────────────────
  // openEditPassword(type, key)            — keyboard shortcut path (F3/F9)
  // openEditPassword(type, key, action)    — F5 list path; action = { type, id, pno, updateId }
  const openEditPassword = useCallback((type, key, action) => {
    const titles = { 1: "Edit Pwd", 0: "Form Pwd", 2: "Admin Pwd" };
    setPasswordType(type);
    setPressKey(key);
    setPendingEditAction(action || null);
    setEditPwdTitle(titles[type] || "");
    setEditPwdValue("");
    setEditPwdError("");
    setEditPwdOpen(true);
  }, []);

  const handleEditPwdSubmit = useCallback(async () => {
    if (!editPwdValue) return;
    const typeStr = passwordType === 1 ? "EditPassword" : passwordType === 0 ? "FormConfig" : "AdminPower";
    setEditPwdLoading(true);
    // ✅ FIXED: send as POST body JSON (matches jQuery original), not query params
    // const res = await CC.api(CC.PR_EditPassword, {
    //   password: editPwdValue,
    //   type:     typeStr,
    //   Comid:    Number(sess.Comid),
    // });

    const res = await CC.api(
      CC.PR_EditPassword,
      null,
      {},
      {
        password: editPwdValue,
        type: typeStr,
        Comid: Number(sess.Comid),
      }
    );
    setEditPwdLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res?.ok) {
      setEditPwdOpen(false);
      setEditPwdValue("");

      // ── F5 list EDIT / DELETE actions (mirrors PurchasesMaster pendingEditAction) ──
      if (pendingEditAction) {
        const action = pendingEditAction;
        setPendingEditAction(null);
        setF5Open(false);
        if (action.type === "EDIT") {
          handleEdit(action.id, 0);
        } else if (action.type === "DELETE") {
          setEditId(action.id);
          setUpdateIdEdit(action.updateId || "");
          handleDelete(action.id, action.pno || "", action.updateId || "");
        }
        return;
      }

      // ── Keyboard shortcut actions (F3 search, F9 delete) ──
      setTimeout(() => {
        if (pressKey === "F3") {
          const value = prompt("Enter the Purchase Return Number", "");
          if (valNum(value) !== 0) handleEdit(0, value);
          else toast("❌ Enter Valid Purchase Number !!!.", true);
        } else if (pressKey === "F9") {
          handleDelete();
        }
      }, 250);
    } else {
      setEditPwdError("Invalid Password !!!.");
    }
  }, [editPwdValue, passwordType, sess.Comid, redirectIfDualLogin, pendingEditAction, pressKey, handleEdit, handleDelete, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────────
  //  PAYMENT WINDOW (mirrors jQuery PaymentWindow)
  // ─────────────────────────────────────────────────────────────────────────────
  const openPaymentWindow = useCallback(async () => {
    if (!supplierId) return;
    setLoading(true);
    const res = await CC.api("/api/PurchaseReportApp/SupplierPendingReport", null, {}, {
      GroupBy: Number(supplierId),
      Comid:   Number(sess.Comid),
      MComid:  Number(sess.MComid),
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    const data = (Array.isArray(res?.data) ? res.data : []).map((o) => ({ ...o, EnterAmt: "" }));
    if (data.length === 0) { setPaymentFlag(false); return; }
    setPaymentList(data);
    setPayPopupOpen(true);
  }, [supplierId, sess.Comid, sess.MComid, redirectIfDualLogin]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  GLOBAL KEYBOARD SHORTCUTS (mirrors jQuery $(document).on('keydown'))
  //  F1=Save  F3=Search(pwd)  F5=View  F9=Delete(pwd)  F10=Clear  F12=Columns
  //  Ctrl+G=GridFocus  Esc=Close/Quit
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthorized) return;

    const handler = (e) => {
      // Skip if any popup input is focused
      const tag = document.activeElement?.tagName?.toLowerCase();

      // F1 — Save
      if (e.key === "F1" && !e.ctrlKey) {
        e.preventDefault();
        handleSave();
        return;
      }

      // F3 — Search via password
      if (e.key === "F3") {
        e.preventDefault();
        openEditPassword(1, "F3");
        return;
      }

      // F5 — List View
      if (e.key === "F5") {
        e.preventDefault();
        openF5View();
        return;
      }

      // F9 — Delete via password
      if (e.key === "F9") {
        e.preventDefault();
        if (perm.Delete === 0) { toast("❌ Page Delete Permission Denied !!!.", true); return; }
        if (!editId) { toast("❌ No Delete Id !!!.", true); return; }
        openEditPassword(1, "F9");
        return;
      }

      // F10 — Clear
      if (e.key === "F10") {
        e.preventDefault();
        confirm("Do You Want To Clear?").then((ok) => { if (ok) handleClear(); });
        return;
      }

      // F12 — Column Config
      if (e.key === "F12") {
        e.preventDefault();
        openF12();
        return;
      }

      // Ctrl+G — Grid Focus Columns (mirrors jQuery Ctrl+G → focuswindow)
      if (e.ctrlKey && (e.key === "g" || e.key === "G")) {
        e.preventDefault();
        openCtrlG();
        return;
      }

      // Escape — close popups / confirm quit
      if (e.key === "Escape") {
        e.preventDefault();
        if (f5Open)      { setF5Open(false);      return; }
        if (loadPmOpen)  { setLoadPmOpen(false);   return; }
        if (loadPdOpen)  { setLoadPdOpen(false);   return; }
        if (mrpPopup.open){ setMrpPopup({ open: false, rowKey: null, list: [] }); return; }
        if (productPopup.open){ setProductPopup({ open: false, rowKey: null, list: [], query: "" }); return; }
        if (payPopupOpen){ setPayPopupOpen(false); return; }
        if (f12Open)     { setF12Open(false);      return; }
        if (ctrlGOpen)   { setCtrlGOpen(false);    return; }
        if (editPwdOpen) { setEditPwdOpen(false);  return; }
        confirm("Do You Want To Quit?").then((ok) => { if (ok) navigate("/Home"); });
        return;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [
    isAuthorized, editId, perm.Delete, f5Open, loadPmOpen, loadPdOpen,
    mrpPopup.open, productPopup.open, payPopupOpen, f12Open, ctrlGOpen, editPwdOpen,
    handleSave, handleClear, handleDelete, openF5View, openF12, openCtrlG,
    openEditPassword, confirm, navigate, toast,
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  PRODUCT POPUP SEARCH (mirrors jQuery gridproduct / productwindow)
  // ─────────────────────────────────────────────────────────────────────────────
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [productSearchList,  setProductSearchList  ] = useState([]);
  const [productSearchIdx,   setProductSearchIdx   ] = useState(0);

  useEffect(() => {
    if (!productPopup.open) return;
    // Auto-load all products on open (mirrors jQuery productwindow autoload)
    (async () => {
      setLoading(true);
      const res = await CC.api(CC.PR_ProductList, null, {}, {
        Comid:  sess.MComid,
        CComid: sess.Comid,
        search: "",
      });
      setLoading(false);
      if (redirectIfDualLogin(res)) return;
      const list = Array.isArray(res?.data) ? res.data
                 : Array.isArray(res?.Data1) ? res.Data1 : [];
      setProductSearchList(list);
      setProductSearchIdx(0);
    })();
  }, [productPopup.open]);

  const searchProducts = useCallback(async (q) => {
    setProductSearchQuery(q);
    if (!q.trim()) {
      setProductSearchList([]);
      setProductSearchIdx(0);
      return;
    }
    const res = await CC.api(CC.PR_ProductList, null, {}, {
      Comid:  sess.MComid,
      CComid: sess.Comid,
      search: q,
    });
    const list = Array.isArray(res?.data) ? res.data
               : Array.isArray(res?.Data1) ? res.Data1 : [];
    setProductSearchList(list);
    setProductSearchIdx(0);
  }, [sess.MComid, sess.Comid]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  if (!isAuthorized) {
    return (
      <div className="pr-root" style={{ alignItems: "center", justifyContent: "center" }}>
        <div className="mp-ldr-box"><div className="mp-spin" /><span>Loading…</span></div>
      </div>
    );
  }

  const visibleCols = getVisibleCols();

  return (
    <div className="pr-root">
      {/* Topbar */}
      <Topbar />


      {/* ── MASTER FORM ──────────────────────────────────────────────────────── */}
      <div className="pr-master">
        <div className="master-row">
          {/* Return No */}
          <div className="field-group">
            <label>Return No</label>
            <input className="form-ctrl disabled" value={purchaseNo} readOnly style={{ minWidth: 100 }} />
          </div>
          {/* Return Date */}
          <div className="field-group">
            <label>Return Date<span className="req">*</span></label>
            <input
              ref={purchaseDateRef}
              type="date"
              className="form-ctrl"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") purchaseTypeRef.current?.focus(); }}
              style={{ minWidth: 130 }}
            />
          </div>
          {/* Return Type */}
          <div className="field-group">
            <label>Return Type</label>
            <select
              ref={purchaseTypeRef}
              className="form-ctrl"
              value={purchaseType}
              onChange={(e) => setPurchaseType(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") supplierInputRef.current?.focus(); }}
              style={{ minWidth: 100 }}
            >
              <option value="CREDIT">CREDIT</option>
              <option value="CASH">CASH</option>
            </select>
          </div>
          {/* Supplier */}
          <div className="field-group wide" style={{ position: "relative" }}>
            <label>Supplier<span className="req">*</span></label>
            <input
              ref={supplierInputRef}
              className="form-ctrl"
              value={supplierQuery}
              placeholder="Search supplier…"
              onChange={(e) => handleSupplierInput(e.target.value)}
              onFocus={openSupplierDD}
              onBlur={() => setTimeout(() => setSupplierDDOpen(false), 180)}
              onKeyDown={supplierKeyDown}
              autoComplete="off"
            />
            {supplierDDOpen && supplierDD.length > 0 && (
              <div className="supplier-dd">
                {supplierDD.map((s, i) => (
                  <div
                    key={s.Id}
                    className={`supplier-dd-item${i === supplierSelIdx ? " hi" : ""}`}
                    onMouseDown={() => handleSupplierSelect(s)}
                  >
                    {s.AccountName}
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* IGST Toggle */}
          <div className="field-group" style={{ justifyContent: "flex-end", marginLeft: "auto" }}>
            <label>GST Type</label>
            <select className="form-ctrl sm" value={igstStatus} onChange={(e) => setIgstStatus(e.target.value)} style={{ minWidth: 80 }}>
              <option value="GST">GST</option>
              <option value="IGST">IGST</option>
              <option value="UGST">UGST</option>
            </select>
          </div>
        </div>

        {/* Supplier info strip */}
        {supplierId && (
          <div className="supplier-strip">
            {supplierInfo.address && <span className="supplier-badge">📍 {supplierInfo.address}, {supplierInfo.city}</span>}
            {supplierInfo.phone   && <span className="supplier-badge">📞 {supplierInfo.phone}</span>}
            <span className="supplier-badge">📦 Stock: {stockDisplay}</span>
            <span className="supplier-badge bal">⚖ Balance: ₹{supplierInfo.balance}</span>
          </div>
        )}
      </div>

      {/* ── GRID ──────────────────────────────────────────────────────────────── */}
      <div className="grid-wrap">
        {/* <div className="grid-header"></div> */}
        <div className="grid-scroll">
          <table className="pur-grid">
            <thead>
              <tr>
                <th className="sno-col">S.No</th>
                {visibleCols.map((c) => (
                  <th
                    key={c.key}
                    className={c.align === "right" ? "right" : ""}
                    style={{ minWidth: (colConfig.find((x) => x.key === c.key)?.width ?? c.defaultWidth) }}
                  >
                    {c.label}
                  </th>
                ))}
                <th className="del-col">✕</th>
              </tr>
            </thead>
            <tbody>
              {gridRows.map((row, rowIdx) => (
                <tr
                  key={row._key}
                  className={`grid-row${selectedCell.rowKey === row._key ? " row-active" : ""}`}
                  onClick={() => setSelectedCell({ rowKey: row._key, colKey: selectedCell.colKey })}
                >
                  <td className="grid-cell sno-col">{rowIdx + 1}</td>
                  {visibleCols.map((col) => {
                    const isSelected = selectedCell.rowKey === row._key && selectedCell.colKey === col.key;
                    const colWidth   = colConfig.find((x) => x.key === col.key)?.width ?? col.defaultWidth;
                    const isEditable = col.editable;
                    const val        = row[col.key] ?? "";
                    const isRight    = col.align === "right";

                    return (
                      <td
                        key={col.key}
                        className={`grid-cell${isRight ? " right" : ""}${!isEditable ? " readonly" : ""}${isSelected ? " selected" : ""}`}
                        style={{ minWidth: colWidth }}
                      >
                        {!isEditable ? (
                          <span>{val}</span>
                        ) : col.key === "ExpiryDate" || col.key === "MfgDate" ? (
                          <input
                            id={`cell_${row._key}_${col.key}`}
                            type="date"
                            className="cell-input"
                            value={val}
                            onChange={(e) => handleCellChange(row._key, col.key, e.target.value)}
                            onFocus={() => setSelectedCell({ rowKey: row._key, colKey: col.key })}
                            onKeyDown={(e) => handleGridKeyDown(e, row._key, col.key)}
                          />
                        ) : (
                          <input
                            id={`cell_${row._key}_${col.key}`}
                            className={`cell-input${isRight ? " right" : ""}`}
                            value={val}
                            onChange={(e) => handleCellChange(row._key, col.key, e.target.value)}
                            onFocus={(e) => {
                              setSelectedCell({ rowKey: row._key, colKey: col.key });
                              // Show stock when product row focused
                              if (col.key === "ItemQty" && row.ProductCode) {
                                setStockDisplay(fmt2(row.StockQty || 0));
                              }
                              e.target.select?.();
                            }}
                            onKeyDown={(e) => handleGridKeyDown(e, row._key, col.key)}
                            autoComplete="off"
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="grid-cell del-col">
                    {row.ProductCode && (
                      <button className="del-row-btn" onClick={() => deleteGridRow(row._key)} title="Shift+Del">✕</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── BOTTOM PANEL ─────────────────────────────────────────────────────── */}
      <div className="pr-bottom">
        <div className="bottom-left">
          {/* GST Split */}
          <div className="gst-split-panel">
            <table className="gst-table">
              <thead>
                <tr>
                  <th>GST %</th>
                  <th>GST Amt</th>
                  <th>CGST Amt</th>
                  <th>SGST Amt</th>
                </tr>
              </thead>
              <tbody>
                {gstSplit.length === 0
                  ? <tr><td colSpan={4} className="no-data">—</td></tr>
                  : gstSplit.map((g, i) => (
                    <tr key={i}>
                      <td>{g.TaxPercent}%</td>
                      <td>{fmt2(g.TaxAmt)}</td>
                      <td>{fmt2(g.CTAmount)}</td>
                      <td>{fmt2(g.STAmount)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Other charges + remarks */}
          <div className="other-fields-panel">
            <div className="panel-title">Other Charges</div>
            <div className="other-row">
              <label>Others(+)</label>
              <input
                ref={otherPlusRef}
                className="form-ctrl right sm"
                value={otherPlus}
                onChange={(e) => setOtherPlus(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    recalcTotalsOnly(gridRows, e.target.value, otherSub);
                    otherSubRef.current?.focus();
                  }
                }}
                onBlur={(e) => recalcTotalsOnly(gridRows, e.target.value, otherSub)}
              />
            </div>
            <div className="other-row">
              <label>Others(-)</label>
              <input
                ref={otherSubRef}
                className="form-ctrl right sm"
                value={otherSub}
                onChange={(e) => setOtherSub(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    recalcTotalsOnly(gridRows, otherPlus, e.target.value);
                    remarksRef.current?.focus();
                  }
                }}
                onBlur={(e) => recalcTotalsOnly(gridRows, otherPlus, e.target.value)}
              />
            </div>
            <div className="other-row">
              <label>Remarks</label>
              <input
                ref={remarksRef}
                className="form-ctrl sm"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                style={{ flex: 1 }}
              />
            </div>
            <div className="other-row">
              <label>Total Qty</label>
              <span className="qty-display">{totals.totalQty}</span>
            </div>
          </div>
        </div>

        {/* Totals panel */}
        <div className="totals-panel">
          <div className="panel-title">Bill Summary</div>
          <TotalRow label="Product Total" value={`₹ ${totals.productTotal}`} />
          <TotalRow label="C.D Amount"    value={`₹ ${totals.cdAmt}`} />
          <TotalRow label="Disc Amount"   value={`₹ ${totals.discAmt}`} />
          <TotalRow label="GST Amount"    value={`₹ ${totals.gstAmt}`} />
          <TotalRow label="CESS Amount"   value={`₹ ${totals.cessAmt}`} />
          <TotalRow label="Other(+)"      value={`₹ ${otherPlus}`} />
          <TotalRow label="Other(-)"      value={`₹ ${otherSub}`} />
          <TotalRow label="Net Amount"    value={`₹ ${totals.netAmt}`} net />
        </div>
      </div>

      {/* ── SHORTCUT BAR ─────────────────────────────────────────────────────── */}
      <div className="mp-hint">
        <span><kbd>F1</kbd> Save</span>
        <span><kbd>F3</kbd> Search</span>
        <span><kbd>F5</kbd> View</span>
        <span><kbd>F9</kbd> Delete</span>
        <span><kbd>F10</kbd> Clear</span>
        <span><kbd>F12</kbd> Columns</span>
        <span><kbd>Ctrl+G</kbd> Focus</span>
        <span><kbd>Enter</kbd> Next Cell</span>
        <span><kbd>Shift+Del</kbd> Remove Row</span>
        <span><kbd>Esc</kbd> Close/Quit</span>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          POPUPS
          ════════════════════════════════════════════════════════════════════════ */}

      {/* ── Product Lookup Popup ──────────────────────────────────────────────── */}
      {productPopup.open && (
        <ProductPopup
          list={productSearchList}
          query={productSearchQuery}
          selIdx={productSearchIdx}
          onQueryChange={searchProducts}
          onSelectIdx={setProductSearchIdx}
          onSelect={(p) => { applyProductToRow(productPopup.rowKey, p); }}
          onClose={() => setProductPopup({ open: false, rowKey: null, list: [], query: "" })}
        />
      )}

      {/* ── MRP Selection Popup ───────────────────────────────────────────────── */}
      {mrpPopup.open && (
        <MrpPopup
          list={mrpPopup.list}
          onSelect={(p) => { applyProductToRow(mrpPopup.rowKey, p); setMrpPopup({ open: false, rowKey: null, list: [] }); }}
          onClose={() => setMrpPopup({ open: false, rowKey: null, list: [] })}
        />
      )}

      {/* ── F5 List View Popup ────────────────────────────────────────────────── */}
      {f5Open && (
        <F5ViewPopup
          masterList={f5List}
          detailList={f5Details}
          fromDate={f5FromDate}
          toDate={f5ToDate}
          suppId={f5SuppId}
          suppList={supplierList}
          suppQuery={f5SuppQuery}
          expandRow={f5ExpandRow}
          onFromDate={setF5FromDate}
          onToDate={setF5ToDate}
          onSuppId={setF5SuppId}
          onSuppQuery={setF5SuppQuery}
          onExpand={(id) => setF5ExpandRow(f5ExpandRow === id ? null : id)}
          onSearch={openF5View}
          onEdit={(r) => {
            if (!perm.Edit) { toast("❌ Page Edit Permission Denied !!!.", true); return; }
            openEditPassword(1, "", { type: "EDIT", id: r.Id });
          }}
          onDelete={(r) => {
            if (!perm.Delete) { toast("❌ Page Delete Permission Denied !!!.", true); return; }
            openEditPassword(1, "", { type: "DELETE", id: r.Id, pno: r.PurchaseNo, updateId: r.UpdateId || "" });
          }}
          onClose={() => setF5Open(false)}
        />
      )}

      {/* ── LoadPM Popup (Select Purchase Bill) ──────────────────────────────── */}
      {loadPmOpen && (
        <LoadPmPopup
          list={loadPmList}
          selIdx={loadPmSelIdx}
          onSelIdx={setLoadPmSelIdx}
          onSelect={(row) => openLoadPD(row.Id)}
          onClose={() => setLoadPmOpen(false)}
        />
      )}

      {/* ── LoadPD Popup (Purchase Details to Return) ────────────────────────── */}
      {loadPdOpen && (
        <LoadPdPopup
          list={loadPdList}
          onListChange={setLoadPdList}
          onEnter={handleLoadPdEnter}
          onClose={() => {
            setLoadPdOpen(false);
            recalcTotalsOnly(gridRows, otherPlus, otherSub);
          }}
        />
      )}

      {/* ── F12 Column Config Popup ───────────────────────────────────────────── */}
      {f12Open && (
        <F12Popup
          cols={f12Cols}
          onColsChange={setF12Cols}
          onSave={saveF12Cols}
          onClose={() => setF12Open(false)}
          loading={loading}
        />
      )}

      {/* ── Ctrl+G Focus Columns Popup ────────────────────────────────────────── */}
      {ctrlGOpen && (
        <CtrlGPopup
          cols={ctrlGCols}
          onColsChange={setCtrlGCols}
          onSave={saveCtrlGCols}
          saving={ctrlGSaving}
          onClose={() => setCtrlGOpen(false)}
        />
      )}

      {/* ── Edit Password Popup ───────────────────────────────────────────────── */}
      {editPwdOpen && (
        <EditPwdPopup
          title={editPwdTitle}
          value={editPwdValue}
          error={editPwdError}
          loading={editPwdLoading}
          onChange={setEditPwdValue}
          onSubmit={handleEditPwdSubmit}
          onClose={() => setEditPwdOpen(false)}
        />
      )}

      {/* ── Payment Popup ─────────────────────────────────────────────────────── */}
      {payPopupOpen && (
        <PaymentPopup
          list={paymentList}
          netAmt={totals.netAmt}
          onListChange={setPaymentList}
          onClose={() => setPayPopupOpen(false)}
          onSave={() => {
            setPayPopupOpen(false);
            setPaymentStatus(true);
            setPaymentFlag(false);
            handleSave();
          }}
        />
      )}

      {/* ── Loading overlay ───────────────────────────────────────────────────── */}
      {loading && (
        <div className="mp-loader-ov">
          <div className="mp-ldr-box">
            <div className="mp-spin" />
            <span className="mp-ldr-msg">Processing…</span>
          </div>
        </div>
      )}

      {/* Toast list */}
      <MSG.ToastList toasts={toasts} />

      {/* Confirm UI */}
      {ConfirmUI}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ── ProductPopup (mirrors jQuery productwindow + gridproduct) ─────────────────
function ProductPopup({ list, query, selIdx, onQueryChange, onSelectIdx, onSelect, onClose }) {
  const searchRef = useRef(null);
  useEffect(() => { setTimeout(() => searchRef.current?.focus(), 80); }, []);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); onSelectIdx((i) => Math.min(i + 1, list.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); onSelectIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (list[selIdx]) onSelect(list[selIdx]); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  return (
    <div className="popup-overlay" style={{ zIndex: 1100 }}>
      <div className="popup-window product-popup">
        <div className="popup-header">
          <span>Product Lookup</span>
          <button className="popup-close" onClick={onClose}>✕</button>
        </div>
        <div className="popup-body">
          <input
            ref={searchRef}
            className="popup-search-input"
            placeholder="Type to search…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />
          <div className="popup-list-wrap">
            <table className="popup-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Description</th>
                  <th>MRP</th>
                  <th>Purchase Rate</th>
                  <th>GST%</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0
                  ? <tr><td colSpan={6} className="no-data">No products found</td></tr>
                  : list.map((p, i) => (
                    <tr
                      key={p.Id}
                      className={`popup-row${i === selIdx ? " selected" : ""}`}
                      onMouseDown={() => onSelect(p)}
                    >
                      <td>{p.ProductCode || p.Prod_Code}</td>
                      <td>{p.ProductName || p.PName}</td>
                      <td className="right">{fmt2(p.MRP)}</td>
                      <td className="right">{fmt2(p.PurchaseRate)}</td>
                      <td className="right">{fmt2(p.GST)}</td>
                      <td className="right">{fmt2(p.Stock)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="popup-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel (Esc)</button>
        </div>
      </div>
    </div>
  );
}

// ── MrpPopup (mirrors jQuery MRPWindow + gridmrp) ────────────────────────────
function MrpPopup({ list, onSelect, onClose }) {
  const [selIdx, setSelIdx] = useState(0);
  const tbodyRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelIdx((i) => Math.min(i + 1, list.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (list[selIdx]) onSelect(list[selIdx]); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  useEffect(() => {
    setTimeout(() => tbodyRef.current?.querySelector("tr")?.focus(), 80);
  }, []);

  return (
    <div className="popup-overlay" style={{ zIndex: 1150 }}>
      <div className="popup-window" style={{ width: 520 }}>
        <div className="popup-header">
          <span>Select MRP / Batch</span>
          <button className="popup-close" onClick={onClose}>✕</button>
        </div>
        <div className="popup-body" onKeyDown={handleKeyDown} tabIndex={0}
             style={{ outline: "none" }} ref={tbodyRef}>
          <table className="popup-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Code</th><th>Description</th><th>MRP</th><th>PurRate</th><th>GST%</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p, i) => (
                <tr key={p.Id} className={`popup-row${i === selIdx ? " selected" : ""}`}
                    onMouseDown={() => onSelect(p)} onClick={() => setSelIdx(i)}>
                  <td>{p.ProductCode || p.Prod_Code}</td>
                  <td>{p.ProductName || p.PName}</td>
                  <td className="right">{fmt2(p.MRP)}</td>
                  <td className="right">{fmt2(p.PurchaseRate)}</td>
                  <td className="right">{fmt2(p.GST)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="popup-footer">
          <button className="btn btn-primary btn-sm" onClick={() => { if (list[selIdx]) onSelect(list[selIdx]); }}>
            ✔ Select (Enter)
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── F5ViewPopup (mirrors jQuery F5Viewwindow + gridf5view) ────────────────────
function F5ViewPopup({ masterList, detailList, fromDate, toDate, suppId, suppList,
                       suppQuery, expandRow, onFromDate, onToDate, onSuppId, onSuppQuery,
                       onExpand, onSearch, onEdit, onDelete, onClose }) {
  const [selIdx, setSelIdx] = useState(null);
  const selectedRow = selIdx !== null ? masterList[selIdx] : null;


  return (
    <div className="popup-overlay" style={{ zIndex: 1100 }}>
      <div className="popup-window f5-popup" style={{ maxHeight: "85vh" }}>
        <div className="popup-header">
          <span>Purchase Return — List View (F5)</span>
          <button className="popup-close" onClick={onClose}>✕</button>
        </div>
        <div className="popup-body">
          {/* Filter row */}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="field-group">
              <label>From Date</label>
              <input type="date" className="form-ctrl sm" value={fromDate} onChange={(e) => onFromDate(e.target.value)} />
            </div>
            <div className="field-group">
              <label>To Date</label>
              <input type="date" className="form-ctrl sm" value={toDate} onChange={(e) => onToDate(e.target.value)} />
            </div>
            <div className="field-group" style={{ minWidth: 180 }}>
              <label>Supplier</label>
              <select className="form-ctrl sm" value={suppId} onChange={(e) => onSuppId(e.target.value)}>
                <option value="0">All Suppliers</option>
                {suppList.map((s) => <option key={s.Id} value={s.Id}>{s.AccountName}</option>)}
              </select>
            </div>
            <button className="tbtn tbtn-save" onClick={onSearch}>🔍 View</button>
          </div>

        {/* Master grid */}
          <div className="view-grid-wrap" style={{ maxHeight: "50vh" }}>
            <table className="view-grid">
              <thead>
                <tr>
                  <th style={{ width: 30 }}></th>
                  <th>Return No</th>
                  <th>Return Date</th>
                  <th>Type</th>
                  <th>Supplier</th>
                  <th>Invoice No</th>
                  <th>Remarks</th>
                  <th>Created By</th>
                  <th className="right">Amount</th>
                  <th style={{ width: 160 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {masterList.length === 0
                  ? <tr><td colSpan={10} className="no-data">No records found</td></tr>
                  : masterList.map((r, i) => (
                    <React.Fragment key={r.Id}>
                      <tr
                        className={`view-row${selIdx === i ? " row-active" : ""}`}
                        onClick={() => setSelIdx(i)}
                      >
                        <td>
                          <button className="expand-btn" onClick={(e) => { e.stopPropagation(); onExpand(r.Id); }}>
                            {expandRow === r.Id ? "▲" : "▼"}
                          </button>
                        </td>
                        <td>{r.PurchaseNo}</td>
                        <td>{r.PurchaseDate ? jsonDate(r.PurchaseDate) : ""}</td>
                        <td>
                          <span className={`badge badge-${(r.PurchaseType || "").toLowerCase() === "cash" ? "cash" : "credit"}`}>
                            {r.PurchaseType}
                          </span>
                        </td>
                        <td>{r.SupplierName}</td>
                        <td>{r.InvoiceNo}</td>
                        <td>{r.Remarks}</td>
                        <td>{r.Created_By}</td>
                        <td className="right">{fmt2(r.NetAmt)}</td>
                        <td>
                          <button className="tbtn-sm edit"   onMouseDown={(e) => { e.stopPropagation(); onEdit(r);   }}>✏ Edit</button>
                          <button className="tbtn-sm delete" onMouseDown={(e) => { e.stopPropagation(); onDelete(r); }}>🗑 Del</button>
                        </td>
                      </tr>
                      {expandRow === r.Id && (
                        <tr className="nested-detail-row">
                          <td colSpan={10}>
                            <div className="nested-grid-inner">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Code</th><th>Description</th>
                                    <th className="right">MRP</th><th className="right">PurRate</th>
                                    <th className="right">Qty</th><th className="right">GST%</th>
                                    <th className="right">GSTAmt</th><th className="right">Disc%</th>
                                    <th className="right">DiscAmt</th><th className="right">Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {detailList.filter((d) => Number(d.PurchaseRefId) === Number(r.Id)).map((d, di) => (
                                    <tr key={di}>
                                      <td>{d.ProductCode}</td><td>{d.ProductName}</td>
                                      <td className="right">{fmt2(d.MRP)}</td>
                                      <td className="right">{fmt2(d.PurchaseRate)}</td>
                                      <td className="right">{fmt2(d.ItemQty)}</td>
                                      <td className="right">{fmt2(d.TaxPercent)}</td>
                                      <td className="right">{fmt2(d.TaxAmt)}</td>
                                      <td className="right">{fmt2(d.DiscountPercent)}</td>
                                      <td className="right">{fmt2(d.DiscountAmt)}</td>
                                      <td className="right">{fmt2(d.Amount)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="popup-footer">
          <span style={{ flex: 1, fontSize: 13, color: "#555" }}>
            <b>Records:</b> {masterList.length} &nbsp;|&nbsp;
            <b>Total: ₹</b>{fmt2(masterList.reduce((s, r) => s + valNum(r.NetAmt), 0))}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Close (Esc)</button>
        </div>
      </div>
    </div>
  );
}

// ── LoadPmPopup (mirrors jQuery LoadPM + gridloadpm) ──────────────────────────
function LoadPmPopup({ list, selIdx, onSelIdx, onSelect, onClose }) {
  const tbodyRef = useRef(null);
  useEffect(() => {
    setTimeout(() => tbodyRef.current?.querySelector("tr.popup-row")?.focus(), 80);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); onSelIdx((i) => Math.min(i + 1, list.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); onSelIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (list[selIdx]) onSelect(list[selIdx]); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  return (
    <div className="popup-overlay" style={{ zIndex: 1200 }}>
      <div className="popup-window loadpm-popup">
        <div className="popup-header">
          <span>Select Purchase Bill</span>
          <button className="popup-close" onClick={onClose}>✕</button>
        </div>
        <div className="popup-body" onKeyDown={handleKeyDown} tabIndex={0}
             style={{ outline: "none" }} ref={tbodyRef}>
          <table className="popup-table">
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Invoice Date</th>
                <th className="right">Bill Amount</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0
                ? <tr><td colSpan={3} className="no-data">No bills found</td></tr>
                : list.map((r, i) => (
                  <tr
                    key={r.Id}
                    className={`popup-row${i === selIdx ? " selected" : ""}`}
                    onMouseDown={() => onSelect(r)}
                    onClick={() => onSelIdx(i)}
                  >
                    <td>{r.SupplierInvoiceNo}</td>
                    <td>{r.SupplierInvoiceDate ? jsonDate(r.SupplierInvoiceDate) : ""}</td>
                    <td className="right">{fmt2(r.NetAmt)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="popup-footer">
          <button className="btn btn-primary btn-sm"
                  onClick={() => { if (list[selIdx]) onSelect(list[selIdx]); }}>
            ✔ Select (Enter)
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel (Esc)</button>
        </div>
      </div>
    </div>
  );
}

// ── LoadPdPopup (mirrors jQuery LoadPD + gridloadpd) ──────────────────────────
// User enters ReturnQty per detail row; Enter transfers to main grid
function LoadPdPopup({ list, onListChange, onEnter, onClose }) {
  const [selIdx, setSelIdx] = useState(0);
  const inputRefs = useRef({});

  useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 80);
  }, []);

  const handleChange = (idx, val) => {
    onListChange((prev) => prev.map((r, i) => i === idx ? { ...r, ReturnQty: val } : r));
  };

  const handleKeyDown = (e, idx) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const row = list[idx];
      const proceed = onEnter(row);
      if (proceed === false) return;
      if (idx < list.length - 1) {
        setSelIdx(idx + 1);
        setTimeout(() => inputRefs.current[idx + 1]?.focus(), 30);
      } else {
        onClose(); // Last row: close popup
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (idx < list.length - 1) { setSelIdx(idx + 1); setTimeout(() => inputRefs.current[idx + 1]?.focus(), 20); }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (idx > 0) { setSelIdx(idx - 1); setTimeout(() => inputRefs.current[idx - 1]?.focus(), 20); }
    } else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  // Determine which extra columns to show (mirrors jQuery dynamic column show)
  const showBatch  = list.some((r) => r.BatchRefid);
  const showExp    = list.some((r) => r.ExpDate);
  const showMfg    = list.some((r) => r.MFDate);
  const showBrand  = list.some((r) => r.BrandId);
  const showColor  = list.some((r) => r.ColorId);
  const showModel  = list.some((r) => r.ModelId);
  const showSize   = list.some((r) => r.SizeId);

  return (
    <div className="popup-overlay" style={{ zIndex: 1200 }}>
      <div className="popup-window loadpd-popup">
        <div className="popup-header">
          <span>Purchase Details — Enter Return Qty</span>
          <button className="popup-close" onClick={onClose}>✕</button>
        </div>
        <div className="popup-body" style={{ overflowX: "auto" }}>
          <table className="loadpd-table">
            <thead>
              <tr>
                <th>Product Code</th>
                <th>Description</th>
                <th className="right">Pur.Rate</th>
                <th className="right">Pur.Qty</th>
                <th className="right">Available Qty</th>
                {showBatch && <th>Batch No</th>}
                {showExp   && <th>Exp Date</th>}
                {showMfg   && <th>Mfg Date</th>}
                {showBrand && <th>Brand</th>}
                {showColor && <th>Color</th>}
                {showModel && <th>Model</th>}
                {showSize  && <th>Size</th>}
                <th className="right" style={{ width: 90 }}>Return Qty</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={i} className={i === selIdx ? "active-pd" : ""} onClick={() => setSelIdx(i)}>
                  <td>{r.Productcode || r.ProductCode}</td>
                  <td>{r.ProductName}</td>
                  <td className="right">{fmt2(r.PurRate)}</td>
                  <td className="right">{r.ItemQty}</td>
                  <td className="right">{fmt2(r.AvaiableQty)}</td>
                  {showBatch && <td>{r.BatchNo}</td>}
                  {showExp   && <td>{r.ExpDate ? jsonDate(r.ExpDate) : ""}</td>}
                  {showMfg   && <td>{r.MFDate  ? jsonDate(r.MFDate)  : ""}</td>}
                  {showBrand && <td>{r.BrandCombo}</td>}
                  {showColor && <td>{r.ColorCombo}</td>}
                  {showModel && <td>{r.ModelCombo}</td>}
                  {showSize  && <td>{r.SizeCombo}</td>}
                  <td>
                    <input
                      ref={(el) => { inputRefs.current[i] = el; }}
                      className="cell-input right"
                      value={r.ReturnQty}
                      onChange={(e) => handleChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, i)}
                      onFocus={(e) => { setSelIdx(i); e.target.select?.(); }}
                      autoComplete="off"
                      style={{ width: 80, textAlign: "right" }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="popup-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Close (Esc)</button>
        </div>
      </div>
    </div>
  );
}

// ── F12Popup (mirrors PurchasesMaster F12 popup exactly) ─────────────────────
function F12Popup({ cols, onColsChange, onSave, onClose, loading }) {
  const toggle = (key) => onColsChange((prev) => prev.map((c) => c.key === key ? { ...c, visible: !c.visible } : c));
  const setW   = (key, w) => onColsChange((prev) => prev.map((c) => c.key === key ? { ...c, width: Number(w) || c.width } : c));

  return (
    <div className="popup-overlay" style={{ zIndex: 1100 }}>
      <div className="popup-window f12-popup">
        <div className="popup-header">
          <span>Column Configuration (F12)</span>
          <button className="popup-close" onClick={onClose}>✕</button>
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
              {cols.map((c) => {
                const base = BASE_COLUMNS.find((b) => b.key === c.key);
                if (!base) return null;
                return (
                  <tr key={c.key}>
                    <td>{base.label}</td>
                    <td className="center">
                      <input
                        type="checkbox"
                        checked={!!c.visible}
                        onChange={() => toggle(c.key)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        style={{ width: 60 }}
                        value={c.width}
                        onChange={(e) => setW(c.key, e.target.value)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="popup-footer">
          <button className="btn btn-primary btn-sm" onClick={onSave} disabled={loading}>💾 Save</button>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── CtrlGPopup (mirrors PurchasesMaster Ctrl+G → focusColOpen modal exactly) ──
function CtrlGPopup({ cols, onColsChange, onSave, saving, onClose }) {
  const [dragIdx, setDragIdx] = useState(null);

  const handleDragStart = (i) => setDragIdx(i);
  const handleDragOver  = (e, i) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) return;
    onColsChange((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(i, 0, moved);
      return next;
    });
    setDragIdx(i);
  };
  const handleDragEnd = () => setDragIdx(null);

  return (
    <div className="popup-overlay" style={{ zIndex: 1200 }}>
      <div
        className="popup-window f12-popup"
        style={{ width: 520, maxHeight: "80vh", display: "flex", flexDirection: "column" }}
      >
        <div className="popup-header">
          <span>Columns Reorder &amp; Focus Enabled</span>
          <button className="popup-close" onClick={onClose}>✕</button>
        </div>

        <div className="popup-body" style={{ overflowY: "auto", flex: 1 }}>
          <table className="popup-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ width: 80,  textAlign: "center" }}>Position</th>
                <th style={{ textAlign: "left" }}>Column Name</th>
                <th style={{ width: 90,  textAlign: "center" }}>Visible</th>
              </tr>
            </thead>
            <tbody>
              {cols.map((c, idx) => (
                <tr
                  key={c.key}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  style={{ background: dragIdx === idx ? "#e0f2fe" : "transparent", cursor: "grab" }}
                >
                  <td style={{ textAlign: "center", userSelect: "none", fontWeight: 600 }}>
                    {idx + 1}
                  </td>
                  <td>{c.label || c.key}</td>
                  <td style={{ textAlign: "center" }}>
                    <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={!!c.Focus}
                        onChange={() => onColsChange((prev) => prev.map((col) => col.key === c.key ? { ...col, Focus: !col.Focus } : col))}
                        style={{ width: 14, height: 14, accentColor: "#1f65de" }}
                      />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="popup-footer">
          <button className="btn btn-primary btn-sm" onClick={onSave} disabled={saving}>
            💾 Save
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
function EditPwdPopup({ title, value, error, loading, onChange, onSubmit, onClose }) {
  const inputRef = useRef(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  return (
    <div className="popup-overlay" style={{ zIndex: 1300 }}>
      <div className="popup-window editpwd-popup">
        <div className="popup-header">
          <span>{title}</span>
          <button className="popup-close" onClick={onClose}>✕</button>
        </div>
        <div className="popup-body">
          <div className="pwd-input-wrap">
            <label>Password</label>
            <input
              ref={inputRef}
              type="password"
              className="pwd-input"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); if (e.key === "Escape") onClose(); }}
              autoComplete="new-password"
            />
            {error && <span className="pwd-error">{error}</span>}
          </div>
        </div>
        <div className="popup-footer">
          <button className="btn btn-primary btn-sm" onClick={onSubmit} disabled={loading}>
            {loading ? "Verifying…" : "✔ OK (Enter)"}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── PaymentPopup (mirrors jQuery paymentwindow + gridpendingbills) ────────────
function PaymentPopup({ list, netAmt, onListChange, onClose, onSave }) {
  const inputRefs = useRef({});
  const [selIdx, setSelIdx] = useState(0);

  useEffect(() => { setTimeout(() => inputRefs.current[0]?.focus(), 80); }, []);

  const getEnterAmtSum = () => list.reduce((s, r) => s + valNum(r.EnterAmt || 0), 0);
  const getBalanceSum  = () => list.reduce((s, r) => s + valNum(r.Balance  || 0), 0);

  const handleChange = (idx, val) => {
    onListChange((prev) => prev.map((r, i) => i === idx ? { ...r, EnterAmt: val } : r));
  };

  const handleKeyDown = (e, idx) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const netAmtNum = valNum(netAmt);
      const sumSoFar  = getEnterAmtSum();
      const final     = netAmtNum - sumSoFar;
      const row       = list[idx];

      // Auto-fill logic (mirrors jQuery gridpendingbills keydown Enter)
      if (valNum(row.EnterAmt) === 0) {
        if (valNum(row.Balance) < final) {
          onListChange((prev) => prev.map((r, i) => i === idx ? { ...r, EnterAmt: fmt2(r.Balance) } : r));
        } else if (final > 0) {
          onListChange((prev) => prev.map((r, i) => i === idx ? { ...r, EnterAmt: fmt2(final) } : r));
        }
      }

      if (idx === list.length - 1) {
        const newSum  = getEnterAmtSum();
        const balSum  = getBalanceSum();
        if (valNum(newSum) === valNum(netAmt) || valNum(balSum) === valNum(newSum)) {
          onSave();
        } else {
          alert("Supplier Excess Payment Amount Not Allowed !!!.");
        }
      } else {
        setSelIdx(idx + 1);
        setTimeout(() => inputRefs.current[idx + 1]?.focus(), 20);
      }
    } else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  return (
    <div className="popup-overlay" style={{ zIndex: 1200 }}>
      <div className="popup-window payment-popup">
        <div className="popup-header">
          <span>Payment Adjustment — Net: ₹{netAmt}</span>
          <button className="popup-close" onClick={onClose}>✕</button>
        </div>
        <div className="popup-body" style={{ padding: 0 }}>
          <table className="popup-table">
            <thead>
              <tr>
                <th>Bill No</th>
                <th>Bill Date</th>
                <th className="right">Amount</th>
                <th className="right">Balance</th>
                <th style={{ width: 110 }}>Enter Amt</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={i} className={`popup-row${i === selIdx ? " selected" : ""}`}
                    onClick={() => setSelIdx(i)}>
                  <td>{r.BillNo}</td>
                  <td>{r.Date ? jsonDate(r.Date) : ""}</td>
                  <td className="right">{fmt2(r.TotAmt)}</td>
                  <td className="right">{fmt2(r.Balance)}</td>
                  <td>
                    <input
                      ref={(el) => { inputRefs.current[i] = el; }}
                      className="cell-input right"
                      value={r.EnterAmt}
                      onChange={(e) => handleChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, i)}
                      onFocus={(e) => { setSelIdx(i); e.target.select?.(); }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="popup-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel (Esc)</button>
        </div>
      </div>
    </div>
  );
}