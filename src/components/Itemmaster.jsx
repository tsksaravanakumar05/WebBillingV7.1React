import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import "../Itemmaster.css";

const BASE_URL = "";

const mkUrl = (path) => {
  const p = path.startsWith("/") ? path : "/" + path;
  return BASE_URL + p;
};

const authHeaders = () => ({
  "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
  "Userid":        localStorage.getItem("userid")     || "0",
  "Profile":       localStorage.getItem("Profile")    || "Admin",
  "LoginCheck":    localStorage.getItem("LoginCheck") || "1",
});

const api = async (path, body = null, extraHeaders = {}, queryParams = null) => {
  try {
    let fullUrl = mkUrl(path);
    if (queryParams && typeof queryParams === "object") {
      const qs = new URLSearchParams(
        Object.entries(queryParams)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => [k, String(v)])
      ).toString();
      if (qs) fullUrl += "?" + qs;
    }
    const res = await fetch(fullUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", ...authHeaders(), ...extraHeaders },
      body: body !== null ? JSON.stringify(body) : undefined,
    });
    if (res.status === 500) {
      const errText = await res.text();
      console.error(`❌ 500 on ${fullUrl}:`, errText.slice(0, 500));
      return { ok: false, message: `Server error 500 — see console` };
    }
    if (res.status === 406) { alert("Already Login Another User Please Login Again!!!"); window.location.href = "/Login"; return { ok: false }; }
    if (res.status === 404) return { ok: false, _http404: true, message: `404 Not Found: ${fullUrl}` };
    const text = await res.text();
    if (!text.trim()) return { ok: false, message: `Empty response (HTTP ${res.status})` };
    try {
      const json = JSON.parse(text);
      if (json.IsSuccess !== undefined && json.ok === undefined) json.ok = json.IsSuccess;
      if (json.Data1    !== undefined && json.data === undefined) json.data = json.Data1;
      if (json.Message  !== undefined && json.message === undefined) json.message = json.Message;
      return json;
    } catch { return { ok: false, message: `Non-JSON (${res.status}): ${text.slice(0, 200)}` }; }
  } catch (err) { return { ok: false, _netErr: true, message: err.message || "Network error" }; }
};

const apiGet = async (path) => {
  try {
    const res = await fetch(mkUrl(path), { headers: authHeaders() });
    if (res.status === 404) return null;
    const text = await res.text();
    if (!text.trim()) return null;
    try { return JSON.parse(text); } catch { return null; }
  } catch { return null; }
};

const getLocal = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const getStr   = k => localStorage.getItem(k) || "";

// ─── COLUMNS definition ───────────────────────────────────────────────────────
const COLUMNS = [
  { key: "ProductCode",      label: "Product Code",    width: 150, pinned: true },
  { key: "SecondCode",       label: "Second Code",     width: 150, pinned: true, hidden: true },
  { key: "ProductName",      label: "Description",     width: 200, pinned: true },
  { key: "PrinterName",      label: "Printer Name",    width: 200, hidden: true },
  { key: "HSNCode",          label: "HSN Code",        width: 100, hidden: true },
  { key: "Brand",            label: "Brand",           width: 200, hidden: true,  isCombo: true, idField: "BrandId" },
  { key: "Category",         label: "Category",        width: 200,               isCombo: true, idField: "CategoryId" },
  { key: "Department",       label: "Department",      width: 200, hidden: true,  isCombo: true, idField: "DepartmentId" },
  { key: "Supplier",         label: "Supplier",        width: 200, hidden: true,  isCombo: true, idField: "SupplierId" },
  { key: "UOM",              label: "UOM",             width: 200,               isCombo: true, idField: "UOMId" },
  { key: "LocationMaster",   label: "Location",        width: 200, hidden: true,  isCombo: true, idField: "LocationMasterId" },
  { key: "NomsQty",          label: "Noms Qty",        width: 100, type: "int",   hidden: true },
  { key: "MRP",              label: "MRP",             width: 100, type: "f2" },
  { key: "DMPer",            label: "DM%",             width: 100, type: "f2",   hidden: true },
  { key: "DMAmt",            label: "DM Amt",          width: 100, type: "f2",   hidden: true },
  { key: "PurchaseRate",     label: "Purchase Rate",   width: 120, type: "f2" },
  { key: "GST",              label: "GST%",            width: 100, type: "f2" },
  { key: "GSTAmt",           label: "GST Amt",         width: 100, type: "f2",   hidden: true },
  { key: "TransPer",         label: "Transport%",      width: 110, type: "f2",   hidden: true },
  { key: "TransAmt",         label: "Transport Amt",   width: 120, type: "f2",   hidden: true },
  { key: "CESS",             label: "CESS%",           width: 100, type: "f2",   hidden: true },
  { key: "CESSAmt",          label: "CESS Amt",        width: 100, type: "f2",   hidden: true },
  { key: "SPLCESS",          label: "SPL CESS",        width: 100, type: "f2",   hidden: true },
  { key: "LandingCost",      label: "Landing Cost",    width: 120, type: "f2",   calc: true },
  { key: "ProfitPer",        label: "Profit%",         width: 100, type: "f2",   hidden: true },
  { key: "ProfitAmt",        label: "Profit Amt",      width: 100, type: "f2",   hidden: true },
  { key: "SalesRate",        label: "Sale Rate",       width: 100, type: "f2" },
  { key: "CardRate",         label: "Card Rate",       width: 100, type: "f2",   hidden: true },
  { key: "WholeSaleRate",    label: "Whole Sale Rate", width: 130, type: "f2",   hidden: true },
  { key: "NomsPCRate",       label: "Noms PC Rate",    width: 120, type: "f2",   hidden: true },
  { key: "SalesRateType",    label: "Fixed Rate",      width: 100, bool: true,   hidden: true },
  { key: "SaleDiscountPer",  label: "Sale Disc%",      width: 100, type: "f2",   hidden: true },
  { key: "SaleDiscountAmt",  label: "Sale Disc Amt",   width: 130, type: "f2",   hidden: true },
  { key: "ReorderLevelMin",  label: "Reorder Min",     width: 110, type: "f2",   hidden: true },
  { key: "ReorderLevelMax",  label: "Reorder Max",     width: 110, type: "f2",   hidden: true },
  { key: "MaxSaleQty",       label: "Max Sale Qty",    width: 110, type: "f2",   hidden: true },
  { key: "LessAmt",          label: "Less Amt",        width: 100, type: "f2",   hidden: true },
  { key: "StockNeed",        label: "Stock Need",      width: 100, bool: true,   hidden: true },
  { key: "ExpriyDate",       label: "Expiry Date",     width: 110, bool: true,   hidden: true },
  { key: "OnlineShow",       label: "Online Show",     width: 110, bool: true,   hidden: true },
  { key: "ExpriyDays",       label: "Expiry Days",     width: 110, type: "int",  hidden: true },
  { key: "ExpiryBeforeDays", label: "Exp Before Days", width: 130, type: "int",  hidden: true },
  { key: "ManufactureDate",  label: "Mfg Date",        width: 110, bool: true,   hidden: true },
  { key: "Repacking",        label: "Repacking",       width: 105, bool: true,   hidden: true },
  { key: "NetWeight",        label: "Net Weight",      width: 105, type: "f3",   hidden: true },
  { key: "BrandType",        label: "Brand Type",      width: 110, bool: true,   hidden: true },
  { key: "ModelType",        label: "Model Type",      width: 110, bool: true,   hidden: true },
  { key: "ColorType",        label: "Color Type",      width: 105, bool: true,   hidden: true },
  { key: "SizeType",         label: "Size Type",       width: 100, bool: true,   hidden: true },
  { key: "GenderType",       label: "Gender Type",     width: 110, bool: true,   hidden: true },
  { key: "SerialNoType",     label: "Serial No Type",  width: 125, bool: true,   hidden: true },
  { key: "CRMPoints",        label: "CRM Points",      width: 110, type: "f2",   hidden: true },
  { key: "NegativetStock",   label: "Neg Stock",       width: 110, bool: true,   hidden: true },
  { key: "BatchwiseStock",   label: "Batchwise",       width: 120, bool: true,   hidden: true },
  { key: "Remarks",          label: "Remarks",         width: 150, hidden: true },
  { key: "Active",           label: "Active",          width: 80,  bool: true },
];

const ROWS_PER_PAGE = 20;
const SNO_W = 50;
const DEL_W = 70;
const DEFAULT_COLS = COLUMNS.map(c => ({ key: c.key, label: c.label, width: c.width, visible: !c.hidden }));

let _rowIdCtr = 1000;
const genRowId = () => ++_rowIdCtr;

const mkEmpty = () => {
  const f = { _rid: genRowId(), _isNew: true, _dirty: false };
  COLUMNS.forEach(c => { f[c.key] = c.bool ? false : ""; });
  ["BrandId","CategoryId","DepartmentId","SupplierId","UOMId","LocationMasterId","ProductImage","Id"].forEach(k => { f[k] = ""; });
  f.Active = true; f.StockNeed = true; f.SalesRateType = true;
  return f;
};

const vn = v => parseFloat(v) || 0;
const ro = v => Math.round(v * 100) / 100;
const f2 = v => parseFloat(vn(v).toFixed(2));
// const f2 = v => vn(v).toFixed(2);
// const f3 = v => vn(v).toFixed(3);
const ns = v => (v == null ? "" : String(v));
const zp = (n, d) => String(n).padStart(d, "0");

const UPPERCASE_KEYS = new Set([
  "ProductCode","SecondCode","ProductName","PrinterName","HSNCode",
  "Brand","Category","Department","Supplier","UOM","LocationMaster",
  "SalesRateType","Remarks",
]);

function calcRow(row, sessFlags, changedKey) {
  const PR   = vn(row.PurchaseRate);
  const MRP  = vn(row.MRP);
  const PP   = vn(row.ProfitPer);

  let GST, GSTAmt;
  if (changedKey === "GSTAmt") {
    GSTAmt = vn(row.GSTAmt);
    GST    = PR > 0 ? ro(GSTAmt / PR * 100) : 0;
  } else {
    GST    = vn(row.GST);
    GSTAmt = ro(PR * GST / 100);
  }

  let CESS, CessAmt;
  if (changedKey === "CESSAmt") {
    CessAmt = vn(row.CESSAmt);
    CESS    = PR > 0 ? ro(CessAmt / PR * 100) : 0;
  } else {
    CESS    = vn(row.CESS);
    CessAmt = ro(PR * CESS / 100);
  }

  let TP, TrAmt;
  if (changedKey === "TransAmt") {
    TrAmt = vn(row.TransAmt);
    TP    = PR > 0 ? ro(TrAmt / PR * 100) : 0;
  } else {
    TP    = vn(row.TransPer);
    TrAmt = ro(PR * TP / 100);
  }

  const LC = ro(PR + GSTAmt + CessAmt + TrAmt);
  const DlrAmt = ro(MRP - LC);
  const DlrPer = MRP > 0 ? ro(DlrAmt / MRP * 100) : 0;
  const ProfitAmt = ro(LC * PP / 100);
  const isNew = !row.Id;

  let SR;
  if (sessFlags?.PurchaseProfitSaleRateChange) {
    if (ProfitAmt !== 0) SR = f2(LC + ProfitAmt);
    else SR = isNew ? f2(MRP) : (vn(row.SalesRate) || f2(MRP));
  } else {
    if (ProfitAmt !== 0) SR = f2(LC + ProfitAmt);
    else SR = isNew ? f2(MRP) : (vn(row.SalesRate) || f2(MRP));
  }

  return {
    GST: f2(GST), GSTAmt: f2(GSTAmt),
    CESS: f2(CESS), CESSAmt: f2(CessAmt),
    TransPer: f2(TP), TransAmt: f2(TrAmt),
    LandingCost: f2(LC),
    DMAmt: f2(DlrAmt), DMPer: f2(DlrPer),
    ProfitAmt: f2(ProfitAmt),
    SalesRate: SR,
    ...(sessFlags?.univercell ? { MRP: f2(ro(SR)) } : {}),
  };
}

const F2K = ["MRP","PurchaseRate","GST","GSTAmt","TransPer","TransAmt","CESS","CESSAmt","SPLCESS",
  "LandingCost","ProfitPer","ProfitAmt","SalesRate","WholeSaleRate","SaleDiscountPer",
  "SaleDiscountAmt","ReorderLevelMin","ReorderLevelMax","CRMPoints","DMPer","DMAmt",
  "CardRate","LessAmt","NomsPCRate"];
const F3K = ["NetWeight"];
const INK = ["ExpriyDays","ExpiryBeforeDays","NomsQty"];

function fmtRow(obj) {
  const r = { ...obj, _rid: obj._rid || genRowId(), _isNew: false, _dirty: false };
  F2K.forEach(k => { if (r[k] !== undefined) r[k] = parseFloat(vn(r[k]).toFixed(2)); });
  F3K.forEach(k => { if (r[k] !== undefined) r[k] = parseFloat(vn(r[k]).toFixed(3)); });
  INK.forEach(k => { if (r[k] !== undefined) r[k] = parseInt(vn(r[k])) || 0; });
  return r;
}

const COMBO_NAV_MAP = {
  Brand: "/brand-master", Category: "/category-master", Department: "/department-master",
  Supplier: "/supplier-master", UOM: "/uom-master", LocationMaster: "/location-master",
};

const ITEM_DRAFT_KEY  = "itemmaster_draft";
const ITEM_CURSOR_KEY = "itemmaster_cursor";

const CALC_TRIGGER_KEYS = new Set([
  "PurchaseRate","GST","CESS","TransPer","MRP","ProfitPer",
  "GSTAmt","CESSAmt","TransAmt",
]);

const FILTERABLE_COL_KEYS = new Set([
  "ProductCode","SecondCode","ProductName","PrinterName","HSNCode",
  "Brand","Category","Department","Supplier","UOM","LocationMaster","Remarks",
]);


// ─── ENTRY ROW INPUT — renders a single input for the sticky entry row ────────
function EntryRowCell({ col, entryRow, setEntryRow, sess, onKeyDown, entryRefs, openComboEntry }) {
  const cd = COLUMNS.find(c => c.key === col.key);
  if (!cd) return null;
  const val = entryRow[cd.key];

  const handleChange = (colKey, value) => {
    let finalValue = value;
    if (UPPERCASE_KEYS.has(colKey) && typeof value === "string") finalValue = value.toUpperCase();

    setEntryRow(prev => {
      let updated = { ...prev, [colKey]: finalValue, _dirty: true };
      if (CALC_TRIGGER_KEYS.has(colKey)) {
        const calced = calcRow(updated, sess, colKey);
        updated = { ...updated, ...calced };
      }
      if (colKey === "SalesRate") {
        const LC = vn(updated.LandingCost), SR = vn(finalValue);
        const diff = SR - LC;
        updated.ProfitPer = LC > 0 && diff > 0 ? f2(ro(diff / LC * 100)) : 0;
        const calced = calcRow(updated, sess, "SalesRate");
        updated = { ...updated, ...calced, SalesRate: f2(vn(finalValue)) };
      }
      if (colKey === "ProfitAmt") {
        const LC = vn(updated.LandingCost), PA = vn(finalValue);
        updated.ProfitPer = LC > 0 ? f2(PA / LC * 100) : 0;
        const calced = calcRow(updated, sess, "ProfitAmt");
        updated = { ...updated, ...calced };
      }
      if (colKey === "DMAmt") {
        const MRP = vn(updated.MRP), DA = vn(finalValue);
        updated.DMPer = MRP > 0 ? f2(ro(DA / MRP * 100)) : 0;
      }
      if (colKey === "DMPer") {
        const MRP = vn(updated.MRP), DP = vn(finalValue);
        updated.DMAmt = f2(ro(MRP * DP / 100));
      }
      return updated;
    });
  };

  const registerRef = (el) => {
    if (entryRefs.current) entryRefs.current[cd.key] = el;
  };

  if (cd.calc) {
    const isLC = cd.key === "LandingCost";
    return (
      <span className={isLC ? "lc-value entry-lc" : "calc-val"} style={{ display:"block", padding:"0 4px" }}>
        {cd.type === "f2" ? vn(val).toFixed(2)
         : cd.type === "f3" ? vn(val).toFixed(3)
         : String(val ?? "")}
      </span>
    );
  }

  if (cd.bool) {
    return (
      <select
        ref={registerRef}
        value={val ? "1" : "0"}
        className="er-input"
        onChange={e => handleChange(cd.key, e.target.value === "1")}
        onKeyDown={e => onKeyDown(e, cd.key)}
        style={{ cursor:"pointer", appearance:"none", textAlign:"center" }}
      >
        <option value="0">✗</option>
        <option value="1">✓</option>
      </select>
    );
  }

  if (cd.isCombo) {
    // 🟢 பழைய Combo Logic-ஐ மீண்டும் கொண்டு வந்துள்ளோம்!
    return (
      <input
        ref={registerRef}
        type="text"
        value={ns(val)}
        readOnly
        className="er-input er-combo"
        placeholder={"▼ " + cd.label}
        onClick={() => openComboEntry(cd.key)}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === "F4") { e.preventDefault(); openComboEntry(cd.key); }
          else onKeyDown(e, cd.key);
        }}
      />
    );
  }

  if (cd.type === "f2" || cd.type === "f3") {
    return (
      <input
        ref={registerRef}
        type="number"
        step={cd.type === "f3" ? "0.001" : "0.01"}
        value={val === "" || val === undefined ? "" : val}
        className="er-input er-num"
        onChange={e => handleChange(cd.key, e.target.value)}
        onKeyDown={e => onKeyDown(e, cd.key)}
        placeholder="0.00"
      />
    );
  }

  // if (cd.type === "f2" || cd.type === "f3") {
  //   return (
  //     <input
  //       ref={registerRef}
  //       type="number"
  //       step={cd.type === "f3" ? "0.001" : "0.01"}
  //       value={val === "" || val === undefined ? "" : val}
  //       className="er-input er-num"
  //       onChange={e => handleChange(cd.key, e.target.value)}
  //       onKeyDown={e => onKeyDown(e, cd.key)}
  //       onBlur={e => {
  //         // Type பண்ணி முடிச்சதும் (cell-ஐ விட்டு வெளியே வரும்போது) .00 add ஆகும்
  //         if (e.target.value !== "") {
  //           const decimals = cd.type === "f3" ? 3 : 2;
  //           handleChange(cd.key, parseFloat(e.target.value).toFixed(decimals));
  //         }
  //       }}
  //       placeholder="0.00"
  //     />
  //   );
  // }

  if (cd.type === "int") {
    return (
      <input
        ref={registerRef}
        type="number"
        step="1"
        value={val === "" || val === undefined ? "" : val}
        className="er-input er-num"
        onChange={e => handleChange(cd.key, e.target.value)}
        onKeyDown={e => onKeyDown(e, cd.key)}
        placeholder="0"
      />
    );
  }

  // 🟢 கடைசியாக உள்ள Return (சாதாரண Text Box) - ProductCode இங்கு தான் வரும்!
// 🟢 மாற்றம் 1: கடைசியாக உள்ள Return-ல் disabled-க்கு பதிலாக readOnly
const isProductCodeAutoGen = cd.key === "ProductCode" && sess.Productcodeautogen;

return (
  <input
    ref={registerRef}
    type="text"
    value={ns(val)}
    className={isProductCodeAutoGen ? "er-input disabled-input" : "er-input"}
    onChange={e => handleChange(cd.key, e.target.value)}
    onKeyDown={e => onKeyDown(e, cd.key)}
    placeholder={isProductCodeAutoGen ? "Auto Generated" : cd.label}
    // disabled={isProductCodeAutoGen} என்பதற்கு பதிலாக கீழே உள்ளதை போடவும்
    readOnly={isProductCodeAutoGen} 
  />
);
}

export default function ItemMaster() {
  const navigate = useNavigate();

  // ── Administration dropdown state ──────────────────────────────────────────
  const [adminOpen, setAdminOpen] = useState(false);
  const adminRef = useRef(null);

  useEffect(() => {
    if (!adminOpen) return;
    const handler = (e) => {
      if (adminRef.current && !adminRef.current.contains(e.target)) {
        setAdminOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [adminOpen]);
  // ──────────────────────────────────────────────────────────────────────────

  const [sess] = useState(() => {
    try {
      const menulist = getLocal("menulist") || [];
      const main0    = (getLocal("Mainsetting")    || [{}])[0] || {};
      const com0     = (getLocal("Companysetting") || [{}])[0] || {};
      const Comid    = getStr("Comid")  || "1";
      const MComid   = getStr("MComid") || Comid;
      const IdComList = getStr("IdComList") || Comid;
      const CC = !!main0.CommonCompany;

      // Data எப்படி வந்தாலும் சரியாக Yes/No கண்டுபிடிக்கும் Logic
      const isAutoGen = com0.PCode_Auto === true || 
                        com0.PCode_Auto === 1 || 
                        com0.PCode_Auto === "1" || 
                        String(com0.PCode_Auto).toLowerCase() === "true";
      return {
        Comid: CC ? MComid : Comid, MComid, IdComList,
        Tamil: !!main0.ProductNameTamil, CommonCompany: CC,
        CommonCompanyDiffStock: !!main0.CommonCompanyDiffStock,
        SupplierMulitipleAllow: !!main0.SupplierMulitipleAllow,
        BranchSaleRate: !!main0.BranchWiseSaleRate,
        MulipleMRP: !!com0.MultiMRP, MirrorTable: 0,
        LandingCostCompare: !!main0.LandingCostCompare,
        PurchaseProfitSaleRateChange: !!main0.PurchaseProfitSaleRateChange,
        univercell: !!main0.univercell, MultipleUOMBilling: !!main0.MultipleUOMBilling,
        GroupCommission: !!main0.GroupCommission, subwebcategory: !!main0.MobilePrint3Inch,
        Ecotech: !!main0.Ecotech,
        //Productcodeautogen: !!com0.PCode_Auto,
        Productcodeautogen:isAutoGen,
        Productcodedigit: com0.PCode_Digits || 0, Productcodeprefix: com0.PCode_Prefix || "",
        menudata: menulist.filter(o => o.PageName === "Item Master"),
      };
    } catch {
      return {
        Comid:"1",MComid:"1",IdComList:"1",Tamil:false,CommonCompany:false,
        CommonCompanyDiffStock:false,SupplierMulitipleAllow:false,BranchSaleRate:false,
        MulipleMRP:false,MirrorTable:0,LandingCostCompare:false,
        PurchaseProfitSaleRateChange:false,Ecotech:false,
        univercell:false,MultipleUOMBilling:false,GroupCommission:false,subwebcategory:false,
        Productcodeautogen:false,Productcodedigit:0,Productcodeprefix:"",menudata:[]
      };
    }
  });

  const perm = sess.menudata[0] || { View:1, Add:1, Edit:1, Delete:1 };

  const [cols, setCols] = useState(DEFAULT_COLS);
  const [showCS,  setShowCS]  = useState(false);
  const [draft,   setDraft]   = useState([]);
  const [csSrch,  setCsSrch]  = useState("");

  const [rows,    setRows]    = useState([]);
  const [selRid,  setSelRid]  = useState(null);
  const [page,    setPage]    = useState(1);
  const [totCnt,  setTotCnt]  = useState(0);

  const [entryRow, setEntryRow] = useState(() => mkEmpty());
  const [editingRid, setEditingRid] = useState(null);

  const [colFilters, setColFilters] = useState({});

  const [vErr,    setVErr]    = useState("");
  const [loading, setLoading] = useState(false);
  const [ldMsg,   setLdMsg]   = useState("Loading...");
  const [toasts,  setToasts]  = useState([]);

  const [brandL, setBrandL]   = useState([]);
  const [catL,   setCatL]     = useState([]);
  const [deptL,  setDeptL]    = useState([]);
  const [deptAll,setDeptAll]  = useState([]);
  const [supL,   setSupL]     = useState([]);
  const [uomL,   setUomL]     = useState([]);
  const [locL,   setLocL]     = useState([]);

  const [ddPop,   setDdPop]   = useState(null);
  const [ddQ,     setDdQ]     = useState("");
  const [ddCtx,   setDdCtx]   = useState(null);
  const [ddHilite, setDdHilite] = useState(0);
  const ddListRef = useRef(null);
  const ddSrchRef = useRef(null);

  const [msgState,setMsgState]= useState(null);
  const [pw,      setPw]      = useState(null);
  const [pwVal,   setPwVal]   = useState("");
  const [bsrOpen, setBsrOpen] = useState(false);
  const [bsrRows, setBsrRows] = useState([]);
  const [gcOpen,  setGcOpen]  = useState(false);
  const [gcRows,  setGcRows]  = useState([]);
  const [tnOpen,  setTnOpen]  = useState(false);
  const [tnVal,   setTnVal]   = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const gRef    = useRef(null);
  const sync    = useRef(false);
  const drag    = useRef({ on:false, x:0, y:0, sl:0, st:0 });
  const toastId = useRef(0);

  // ── [CHANGE 1] Ref for Confirm/Alert modal box — used for keyboard UX ─────
  const msgBoxRef = useRef(null);

  const entryRefs   = useRef({});
  const cellRefs    = useRef({});
  const draftBootstrapped = useRef(false);


// // Page ஓபன் ஆனவுடன் முதல் Entry-க்கு Auto Generate செய்ய
// useEffect(() => {
//   if (sess.Productcodeautogen && entryRow._isNew && !entryRow.ProductCode) {
//     const fetchInitialCode = async () => {
//       const rowWithCode = await autoGenProductCode(entryRow);
//       setEntryRow(rowWithCode);
//     };
//     fetchInitialCode();
//   }
// // eslint-disable-next-line react-hooks/exhaustive-deps
// }, [sess.Productcodeautogen]);


  useEffect(() => {
    if (ddPop && ddSrchRef.current) {
      const t = setTimeout(() => { ddSrchRef.current?.focus(); }, 30);
      return () => clearTimeout(t);
    }
  }, [ddPop]);

  useEffect(() => {
    if (!ddPop || !ddListRef.current) return;
    const el = ddListRef.current.querySelector(`[data-idx="${ddHilite}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [ddHilite, ddPop]);

  // ── [CHANGE 2] Auto-focus primary button when Confirm/Alert modal opens ───
  // Focuses the YES button (confirm) or OK button (alert) immediately.
  // Uses a short timeout so the DOM is painted before focus is set.
  useEffect(() => {
    if (msgState && msgBoxRef.current) {
      const t = setTimeout(() => {
        // For YES/NO modal focus YES; for alert focus OK
        const primary = msgBoxRef.current.querySelector(".msg-yes, .msg-ok");
        if (primary) primary.focus();
      }, 30);
      return () => clearTimeout(t);
    }
  }, [msgState]);

  useEffect(() => {
    if (!draftBootstrapped.current) return;
    try {
      if (entryRow._dirty) {
        sessionStorage.setItem(ITEM_DRAFT_KEY, JSON.stringify({ entryRow, rows }));
      }
    } catch { /* quota */ }
  }, [entryRow, rows]);

  const toast = useCallback((m, err=false) => {
    const id = ++toastId.current;
    setToasts(p => [...p, { id, m, err }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  const doConfirm = useCallback((text, onYes, onNo) => {
    setMsgState({ text, yesNo:true,
      onYes:() => { setMsgState(null); onYes(); },
      onNo: () => { setMsgState(null); if (onNo) onNo(); }
    });
  }, []);

  const doAlert = useCallback((text) => {
    setMsgState({ text, yesNo:false, onYes:() => setMsgState(null) });
  }, []);

  const askPw = useCallback((title, onOk) => {
    setPw({ title, onOk }); setPwVal("");
  }, []);

  const submitPw = async () => {
    if (!pwVal) return;
    const res = await api("/Login/EditPassword", null, {}, { password: pwVal, type: "EditPassword", Comid: sess.Comid });
    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }
    if (res.ok ?? res.IsSuccess ?? false) { const cb = pw.onOk; setPw(null); setPwVal(""); cb(); }
    else window.alert("Invalid Password !!!.");
  };

  const visCols = cols.filter(c => c.visible);

// 🟢 மாற்றம் 2: எந்த Condition-உம் இல்லாமல் பழையபடியே மாற்றுங்கள்
const entryEditableKeys = visCols
.map(vc => COLUMNS.find(c => c.key === vc.key))
.filter(cd => cd && !cd.calc)
.map(cd => cd.key);



  const focusEntryCell = useCallback((colKey) => {
    setTimeout(() => {
      const el = entryRefs.current[colKey];
      if (el) { el.focus(); el.select?.(); }
    }, 0);
  }, []);

  // ✅ இப்போழுது இங்கே சேர்த்தால் Error வராது
  // const autoGenProductCode = useCallback(async (currentEntryRow) => {
  //   if (!sess.Productcodeautogen) return currentEntryRow;
  
  //   try {
     
  //     const res = await api("/ItemMaster/MaxProductCode", null, {}, { Comid: parseInt(sess.Comid) || 1 });
  //     //const res = await api("/ItemMaster/MaxProductCode", { Comid: parseInt(sess.Comid) || 1 });
  //     let maxCode = 1; 
  //     let rawData = res?.data ?? res?.Data1 ?? res;

      
  
  //     if (Array.isArray(rawData)) rawData = rawData[0];
  //     if (rawData !== null && typeof rawData === "object") {
  //         const values = Object.values(rawData);
  //         if (values.length > 0) rawData = values[0];
  //     }
  
  //     const parsedCode = parseInt(rawData, 10);
  //     if (!isNaN(parsedCode) && parsedCode > 0) {
  //         maxCode = parsedCode;
  //     }
  
  //     const digits = parseInt(sess.Productcodedigit) || 0;
  //     const prefix = sess.Productcodeprefix || "";
  //     let newCode = "";
  
  //     // உங்களது jQuery-ல் உள்ள அதே Logic இங்கே அப்படியே உள்ளது:
  //     if (digits !== 0) {
  //       newCode = prefix + String(maxCode).padStart(digits, "0");
  //     } else {
  //       if (prefix === "") {
  //         newCode = String(maxCode);
  //       } else {
  //         newCode = prefix + String(maxCode);
  //       }
  //     }
  
  //     return { ...currentEntryRow, ProductCode: newCode, _dirty: true };
  //   } catch (err) {
  //     console.error("Auto Gen Code Error:", err);
  //     return currentEntryRow;
  //   }
  // }, [sess]);


  const autoGenProductCode = useCallback(async (currentEntryRow) => {

    if (!sess.Productcodeautogen) return currentEntryRow;
  
    try {
  
      const res = await api("/ItemMaster/MaxProductCode", null, {}, { Comid: parseInt(sess.Comid) || 1 })
      
  
      let maxCode = 1;
  
      let rawData =
        res?.data?.Data1 ??
        res?.Data1 ??
        res?.data ??
        res;
  
      if (Array.isArray(rawData)) {
        rawData = rawData[0];
      }
  
      if (rawData !== null && typeof rawData === "object") {
        const values = Object.values(rawData);
  
        if (values.length > 0) {
          rawData = values[0];
        }
      }
  
      const parsedCode = parseInt(rawData, 10);
  
      if (!isNaN(parsedCode) && parsedCode > 0) {
        maxCode = parsedCode;
      }
  
      const digits = parseInt(sess.Productcodedigit) || 0;
  
      const prefix = sess.Productcodeprefix || "";
  
      let newCode = "";
  
      // Existing jQuery Logic Same
      if (digits !== 0) {
  
        newCode =
          prefix +
          String(maxCode).padStart(digits, "0");
  
      } else {
  
        if (prefix === "") {
          newCode = String(maxCode);
        } else {
          newCode = prefix + String(maxCode);
        }
      }
  
      return {
        ...currentEntryRow,
        ProductCode: newCode,
        _dirty: true
      };
  
    } catch (err) {
  
      console.error("Auto Gen Code Error:", err);
  
      return currentEntryRow;
    }
  
  }, [sess]);
// 🟢 மாற்றம் 2: Clear அல்லது New Entry கொடுக்கும்போது சரியாக Focus வைப்பது
// 🟢 மாற்றம் 3: எப்போதுமே index [0]-ல் Focus வைப்பது
const resetEntryRowWithAutoGen = useCallback(async () => {
  let newRow = mkEmpty();
  newRow = await autoGenProductCode(newRow); 
  setEntryRow(newRow);
  setVErr("");
  
  setTimeout(() => {
    // எப்போதுமே முதல் கட்டத்தில் (Product Code) Cursor நிற்கும்
    focusEntryCell(entryEditableKeys[0]);
  }, 50); 
}, [autoGenProductCode, focusEntryCell, entryEditableKeys]);

  const editableColKeys = visCols
    .map(vc => COLUMNS.find(c => c.key === vc.key))
    .filter(cd => cd && !cd.calc)
    .map(cd => cd.key);

  const focusCell = useCallback((rid, colKey) => {
    setTimeout(() => {
      const el = cellRefs.current[rid]?.[colKey];
      if (el) { el.focus(); el.select?.(); }
    }, 0);
  }, []);

  const comboCfg = {
    Brand:          { list:brandL, title:"Brand",      idKey:"Id", nameKey:"BrandName",     fId:"BrandId",          fName:"Brand"          },
    Category:       { list:catL,   title:"Category",   idKey:"Id", nameKey:"Cat_Name",       fId:"CategoryId",       fName:"Category"       },
    Department:     { list:deptL,  title:"Department", idKey:"Id", nameKey:"DepartmentName", fId:"DepartmentId",     fName:"Department"     },
    Supplier:       { list:supL,   title:"Supplier",   idKey:"Id", nameKey:"AccountName",    fId:"SupplierId",       fName:"Supplier"       },
    UOM:            { list:uomL,   title:"UOM",        idKey:"Id", nameKey:"UOMName",        fId:"UOMId",            fName:"UOM"            },
    LocationMaster: { list:locL,   title:"Location",   idKey:"Id", nameKey:"LocationName",   fId:"LocationMasterId", fName:"LocationMaster" },
  };

  const openComboEntry = useCallback((colKey) => {
    const cfg = comboCfg[colKey]; if (!cfg) return;
    let list = cfg.list;
    if (colKey === "Department" && entryRow?.CategoryId) {
      const sub = deptAll.filter(d => String(d.CategoryRefId) === String(entryRow.CategoryId));
      if (sub.length) list = sub;
    }
    setDdPop({ ...cfg, list, field: colKey });
    setDdCtx({ rid: entryRow._rid, colKey, isEntry: true });
    setDdQ(ns(entryRow?.[cfg.fName]));
    setDdHilite(0);
  }, [comboCfg, entryRow, deptAll]);

  const openCombo = useCallback((rid, colKey) => {
    const cfg = comboCfg[colKey]; if (!cfg) return;
    let list = cfg.list;
    if (colKey === "Department") {
      const row = rows.find(r => r._rid === rid);
      if (row?.CategoryId) {
        const sub = deptAll.filter(d => String(d.CategoryRefId) === String(row.CategoryId));
        if (sub.length) list = sub;
      }
    }
    const row = rows.find(r => r._rid === rid);
    try { sessionStorage.setItem(ITEM_CURSOR_KEY, JSON.stringify({ rid, colKey })); } catch {}
    setDdPop({ ...cfg, list, field: colKey });
    setDdCtx({ rid, colKey, isEntry: false });
    setDdQ(ns(row?.[cfg.fName]));
    setDdHilite(0);
  }, [comboCfg, rows, deptAll]);

  const selectDd = useCallback(item => {
    if (!ddCtx || !ddPop) return;
    const { rid, colKey, isEntry } = ddCtx;

    if (isEntry) {
      setEntryRow(prev => ({
        ...prev,
        [ddPop.fName]: item[ddPop.nameKey],
        [ddPop.fId]:   item[ddPop.idKey],
        _dirty: true,
      }));
      setDdPop(null); setDdQ(""); setDdCtx(null); setDdHilite(0);
      setTimeout(() => {
        const colIdx = entryEditableKeys.indexOf(colKey);
        const nextKey = colIdx >= 0 && colIdx < entryEditableKeys.length - 1
          ? entryEditableKeys[colIdx + 1] : colKey;
        focusEntryCell(nextKey);
      }, 30);
    } else {
      setRows(prev => prev.map(r => r._rid !== rid ? r : {
        ...r,
        [ddPop.fName]: item[ddPop.nameKey],
        [ddPop.fId]:   item[ddPop.idKey],
        _dirty: true,
      }));
      setDdPop(null); setDdQ(""); setDdCtx(null); setDdHilite(0);
      setTimeout(() => {
        const colIdx = editableColKeys.indexOf(colKey);
        const nextKey = colIdx >= 0 && colIdx < editableColKeys.length - 1
          ? editableColKeys[colIdx + 1] : colKey;
        focusCell(rid, nextKey);
      }, 30);
    }
  }, [ddCtx, ddPop, entryEditableKeys, editableColKeys, focusEntryCell, focusCell]);

  const handleDdConfirm = useCallback(() => {
    if (!ddPop || !ddCtx) return;
    const typed = ddQ.trim().toLowerCase();
    if (!typed) { setDdPop(null); setDdQ(""); setDdCtx(null); return; }
    const match = ddPop.list.find(item => String(item[ddPop.nameKey] || "").toLowerCase() === typed);
    if (match) { selectDd(match); return; }
    const navPath = COMBO_NAV_MAP[ddPop.field];
    if (navPath) {
      sessionStorage.setItem("masterPrefill", ddQ.trim());
      try {
        sessionStorage.setItem(ITEM_DRAFT_KEY, JSON.stringify({ entryRow, rows }));
        sessionStorage.setItem(ITEM_CURSOR_KEY, JSON.stringify({ rid: ddCtx.rid, colKey: ddCtx.colKey, isEntry: ddCtx.isEntry }));
      } catch {}
      setDdPop(null); setDdQ(""); setDdCtx(null); setDdHilite(0);
      navigate(navPath);
    }
  }, [ddPop, ddCtx, ddQ, selectDd, navigate, entryRow, rows]);

  const restoreCursorAfterReturn = useCallback((freshDropdowns) => {
    try {
      const cursorRaw = sessionStorage.getItem(ITEM_CURSOR_KEY);
      if (!cursorRaw) return;
      const { rid, colKey, isEntry } = JSON.parse(cursorRaw);
      sessionStorage.removeItem(ITEM_CURSOR_KEY);
      const prefill = (sessionStorage.getItem("masterPrefill") || "").toUpperCase();
      sessionStorage.removeItem("masterPrefill");
      if (prefill && colKey && freshDropdowns) {
        const cfg = freshDropdowns[colKey];
        if (cfg) {
          const match = cfg.list.find(item => String(item[cfg.nameKey] || "").toUpperCase() === prefill);
          if (match) {
            if (isEntry !== false) {
              setEntryRow(prev => ({
                ...prev,
                [cfg.fName]: match[cfg.nameKey],
                [cfg.fId]:   match[cfg.idKey],
                _dirty: true,
              }));
              setTimeout(() => {
                const colIdx = entryEditableKeys.indexOf(colKey);
                const nextKey = colIdx >= 0 && colIdx < entryEditableKeys.length - 1
                  ? entryEditableKeys[colIdx + 1] : colKey;
                focusEntryCell(nextKey);
              }, 120);
            } else {
              setRows(prev => prev.map(r => r._rid !== rid ? r : {
                ...r, [cfg.fName]: match[cfg.nameKey], [cfg.fId]: match[cfg.idKey], _dirty: true,
              }));
              setSelRid(rid);
              setTimeout(() => {
                const colIdx = editableColKeys.indexOf(colKey);
                const nextKey = colIdx >= 0 && colIdx < editableColKeys.length - 1
                  ? editableColKeys[colIdx + 1] : colKey;
                focusCell(rid, nextKey);
              }, 120);
            }
            return;
          }
        }
      }
      if (isEntry !== false) focusEntryCell(colKey);
      else { setSelRid(rid); setTimeout(() => focusCell(rid, colKey), 80); }
    } catch {}
  }, [focusEntryCell, focusCell, entryEditableKeys, editableColKeys]);

  const validateEntryRow = useCallback((row) => {
    if (!String(row.ProductCode||"").trim()) { setVErr("❌ Product Code required."); return false; }
    if (!String(row.ProductName||"").trim()) { setVErr("❌ Description required.");  return false; }
    if (sess.LandingCostCompare) {
      if (vn(row.SalesRate) && vn(row.LandingCost) > vn(row.SalesRate)) { setVErr("❌ Sale Rate < Landing Cost."); return false; }
      if (vn(row.MRP) && vn(row.SalesRate) && vn(row.MRP) < vn(row.SalesRate)) { setVErr("❌ Sale Rate > MRP."); return false; }
    }
    if (vn(row.MRP) && vn(row.PurchaseRate) && vn(row.MRP) < vn(row.PurchaseRate)) { setVErr("❌ Purchase Rate > MRP."); return false; }
    setVErr(""); return true;
  }, [sess]);

  const validateRow = useCallback((row) => {
    if (!String(row.ProductCode||"").trim()) { setVErr("❌ Product Code required."); return false; }
    if (!String(row.ProductName||"").trim()) { setVErr("❌ Description required.");  return false; }
    if (sess.LandingCostCompare) {
      if (vn(row.SalesRate) && vn(row.LandingCost) > vn(row.SalesRate)) { setVErr("❌ Sale Rate < Landing Cost."); return false; }
      if (vn(row.MRP) && vn(row.SalesRate) && vn(row.MRP) < vn(row.SalesRate)) { setVErr("❌ Sale Rate > MRP."); return false; }
    }
    if (vn(row.MRP) && vn(row.PurchaseRate) && vn(row.MRP) < vn(row.PurchaseRate)) { setVErr("❌ Purchase Rate > MRP."); return false; }
    setVErr(""); return true;
  }, [sess]);

  const saveHdrs = {
    "Comid": String(sess.Comid),
    "Commoncompany": String(sess.CommonCompany),
    "CommoncompanyDiffStock": String(sess.CommonCompanyDiffStock),
    "SupplierMulitipleAllow": String(sess.SupplierMulitipleAllow),
    "MulipleMRP": String(sess.MulipleMRP),
    "MirrorTable": String(sess.MirrorTable),
    "Tamil": String(sess.Tamil),
    "IdComList": String(sess.IdComList),
    "ApiType": "0",
  };

  const buildPayload = useCallback((row) => {
    const n  = v => parseFloat(v)  || 0;
    const ni = v => parseInt(v)    || 0;
    const bi = v => (v === true || v === "true" || v === 1 || v === "1") ? 1 : 0;
    const b  = v => v === true || v === "true" || v === 1 || v === "1";
    const s  = v => String(v == null ? "" : v);
    return {
      Id: ni(row.Id),
      ProductCode: s(row.ProductCode).trim(), SecondCode: s(row.SecondCode),
      ProductName: s(row.ProductName).trim(), PrinterName: s(row.PrinterName),
      HSNCode: s(row.HSNCode), Brand: s(row.Brand), BrandId: ni(row.BrandId),
      Category: s(row.Category), CategoryId: ni(row.CategoryId),
      Department: s(row.Department), DepartmentId: ni(row.DepartmentId),
      Supplier: s(row.Supplier), SupplierId: ni(row.SupplierId),
      UOM: s(row.UOM), UOMId: ni(row.UOMId),
      LocationMaster: s(row.LocationMaster), LocationMasterId: ni(row.LocationMasterId),
      NomsQty: ni(row.NomsQty), MRP: n(row.MRP), DMPer: n(row.DMPer), DMAmt: n(row.DMAmt),
      PurchaseRate: n(row.PurchaseRate), GST: n(row.GST), GSTAmt: n(row.GSTAmt),
      TransPer: n(row.TransPer), TransAmt: n(row.TransAmt), CESS: n(row.CESS),
      CESSAmt: n(row.CESSAmt), SPLCESS: n(row.SPLCESS), LandingCost: n(row.LandingCost),
      ProfitPer: n(row.ProfitPer), ProfitAmt: n(row.ProfitAmt), SalesRate: n(row.SalesRate),
      CardRate: n(row.CardRate), WholeSaleRate: n(row.WholeSaleRate), NomsPCRate: n(row.NomsPCRate),
      SalesRateType: b(row.SalesRateType), SaleDiscountPer: n(row.SaleDiscountPer),
      SaleDiscountAmt: n(row.SaleDiscountAmt), ReorderLevelMin: n(row.ReorderLevelMin),
      ReorderLevelMax: n(row.ReorderLevelMax), MaxSaleQty: n(row.MaxSaleQty), LessAmt: n(row.LessAmt),
      StockNeed: bi(row.StockNeed), ExpriyDate: bi(row.ExpriyDate), OnlineShow: bi(row.OnlineShow),
      BrandType: bi(row.BrandType), ModelType: bi(row.ModelType), ColorType: bi(row.ColorType),
      SizeType: bi(row.SizeType), SerialNoType: bi(row.SerialNoType), BatchwiseStock: bi(row.BatchwiseStock),
      Active: bi(row.Active), NegativetStock: b(row.NegativetStock), Repacking: b(row.Repacking),
      ExpriyDays: ni(row.ExpriyDays), ExpiryBeforeDays: ni(row.ExpiryBeforeDays),
      NetWeight: n(row.NetWeight), CRMPoints: n(row.CRMPoints), Remarks: s(row.Remarks),
      ProductImage: s(row.ProductImage),
    };
  }, []);

  const doSave = useCallback(() => {
    if (!perm.Add && !perm.Edit) { doAlert("Page Add & Update Permission Denied !!!."); return; }

    const toSave = [];
    const entryHasData = String(entryRow.ProductCode||"").trim() || String(entryRow.ProductName||"").trim();
    if (entryRow._dirty && entryHasData) toSave.push(entryRow);
    const dirtyRows = rows.filter(r => r._dirty && (String(r.ProductCode||"").trim() || String(r.ProductName||"").trim()));
    toSave.push(...dirtyRows);

    if (!toSave.length) { toast("No modified data to save.", true); return; }
    for (const row of toSave) { if (!validateRow(row)) return; }

    doConfirm("Do you want to Save Item Master Details?", async () => {
      setLoading(true); setLdMsg("Saving...");
      const payload = toSave.map(buildPayload);
      const res = await api("/ItemMaster/InsertItemMaster", payload, saveHdrs);
      setLoading(false);
      if (res._netErr) { toast(`❌ ${res.message}`, true); return; }
      if (res.ok) {
        toast("✅ " + (res.message || "Saved successfully"));
        try { sessionStorage.removeItem(ITEM_DRAFT_KEY); } catch {}

        if (entryHasData && entryRow._dirty) {
          const savedEntry = { ...entryRow, _dirty: false, _isNew: false, Id: res.Id || entryRow.Id || entryRow._rid };
          setRows(prev => {
            const updatedPrev = prev.map(r => r._dirty ? { ...r, _dirty: false } : r);
            return [...updatedPrev, savedEntry];
          });
          //setEntryRow(mkEmpty());
         // setTimeout(() => focusEntryCell(entryEditableKeys[0]), 50);
         resetEntryRowWithAutoGen();
        } else {
          setRows(prev => prev.map(r => r._dirty ? { ...r, _dirty: false } : r));
        }

        if (sessionStorage.getItem("POPStatus") === "ON") {
          sessionStorage.setItem("POPValue", res.Data2 || res.Id || "");
          sessionStorage.setItem("POPStatus","OFF");
          try { window.parent.$('.ui-dialog-content:visible').dialog('close'); } catch {}
        }
      } else {
        if (res.redis === false) { window.alert("Session expired"); window.location.href = "/Login"; }
        else toast(`❌ ${res.message || "Save failed"}`, true);
      }
    });
  }, [entryRow, rows, perm, doAlert, doConfirm, validateRow, buildPayload, toast, saveHdrs, focusEntryCell, entryEditableKeys]);

  const doDeleteRow = useCallback((rid) => {
    const row = rows.find(r => r._rid === rid);
    if (!row) return;
    if (!perm.Delete) { toast("Delete Permission Denied", true); return; }
    doConfirm(`Delete "${row.ProductName || "this row"}"?`, async () => {
      setLoading(true); setLdMsg("Deleting...");
      const res = await api(
        "/ItemMaster/DeleteItemMaster", null,
        { "IdComList": String(sess.IdComList) },
        { Id: row.Id, Comid: sess.Comid, MirrorTable: sess.MirrorTable }
      );
      setLoading(false);
      if (res._netErr) { toast(`❌ ${res.message}`, true); return; }
      if (res.ok) {
        toast("✅ " + (res.message || "Deleted"));
        setRows(prev => prev.filter(r => r._rid !== rid));
        if (selRid === rid) setSelRid(null);
        if (editingRid === rid) setEditingRid(null);
      } else {
        if (res.redis === false) { window.alert("Session expired"); window.location.href = "/Login"; }
        else toast(`❌ ${res.message || "Delete failed"}`, true);
      }
    });
  }, [rows, perm, doConfirm, toast, sess, selRid, editingRid]);

  const doDelete = useCallback(() => {
    if (!selRid) { toast("Select a row to delete", true); return; }
    doDeleteRow(selRid);
  }, [selRid, doDeleteRow, toast]);

  const loadColCfg = useCallback(async () => {
    try {
      const url = mkUrl(`/Content/Appdata/Visible/${sess.Comid}/Itemmaster.json?v=${Date.now()}`);
      const res = await fetch(url, { headers: authHeaders() });
      if (res.status === 404) return;
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;
      setCols(prev => {
        return prev.map(col => {
          const saved = data.find(x => x.column === col.key);
          if (!saved) return col;
          return { ...col, visible: saved.Visible === true, width: Number(saved.Width) || col.width };
        });
      });
    } catch (err) {
      console.error("loadColCfg error", err);
    }
  }, [sess.Comid]);

  useEffect(() => {
    loadColCfg();
  }, [loadColCfg]);

  // ── MulipleMRP Column Visibility ─────────────────────────────────────────────
  // jQuery Reference: if (MulipleMRP == true) → DMPer, DMAmt columns visible
  // Company Settings -> Save MultiMRP = Yes/No -> DB -> Login -> Companysetting updated
  // -> ItemMaster open -> sess.MulipleMRP read -> columns auto show/hide
  useEffect(() => {
    setCols(prev => prev.map(col => {
      if (col.key === 'DMPer' || col.key === 'DMAmt') {
        return { ...col, visible: sess.MulipleMRP };
      }
      return col;
    }));
  // sess is stable (useState one-time init) — run once on mount only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveColCfg = useCallback(async (currentCols) => {
    try {
      const payload = currentCols.map(c => ({
        Comid: parseInt(sess.Comid),
        filename: "Itemmaster",
        column: c.key,
        Visible: c.visible === true,
        Width: parseInt(c.width || 120)
      }));
      const res = await api("/Login/VisibleColumns", payload);
      if (res?.ok) { await loadColCfg(); }
    } catch (err) {
      console.error(err);
    }
  }, [sess.Comid, loadColCfg]);

  const loadDropdowns = useCallback(async () => {
    const userid = localStorage.getItem("userid");
    if (!userid || userid === "" || userid === "0") { toast("❌ Not logged in", true); window.location.href = "/"; return; }
    const [br,ca,de,su,uo,lo] = await Promise.all([
      api("/Brand/SelectBrand",           null, {}, { Comid: sess.Comid }),
      api("/Category/SelectCategory",     null, {}, { Comid: sess.Comid }),
      api("/Department/SelectDepartment", null, {}, { Comid: sess.Comid }),
      api("/Supplier/GetSupplier",        null, {}, { Comid: sess.Comid, AccountType: "SUPPLIER" }),
      api("/UOM/SelectUOM",               null, {}, { Comid: sess.Comid }),
      api("/Location/SelectLocation",     null, {}, { Comid: sess.Comid }),
    ]);
    const pick = r => r.data || r.Data1 || [];
    const newBrandL = !br._netErr ? pick(br) : brandL;
    const newCatL   = !ca._netErr ? pick(ca) : catL;
    const newDeptL  = !de._netErr ? pick(de) : deptL;
    const newSupL   = !su._netErr ? pick(su) : supL;
    const newUomL   = !uo._netErr ? pick(uo) : uomL;
    const newLocL   = !lo._netErr ? pick(lo) : locL;
    if (!br._netErr) setBrandL(newBrandL);
    if (!ca._netErr) setCatL(newCatL);
    if (!de._netErr) { setDeptL(newDeptL); setDeptAll(newDeptL); }
    if (!su._netErr) setSupL(newSupL);
    if (!uo._netErr) setUomL(newUomL);
    if (!lo._netErr) setLocL(newLocL);
    return {
      Brand:          { list: newBrandL, idKey:"Id", nameKey:"BrandName",     fId:"BrandId",          fName:"Brand"          },
      Category:       { list: newCatL,   idKey:"Id", nameKey:"Cat_Name",       fId:"CategoryId",       fName:"Category"       },
      Department:     { list: newDeptL,  idKey:"Id", nameKey:"DepartmentName", fId:"DepartmentId",     fName:"Department"     },
      Supplier:       { list: newSupL,   idKey:"Id", nameKey:"AccountName",    fId:"SupplierId",       fName:"Supplier"       },
      UOM:            { list: newUomL,   idKey:"Id", nameKey:"UOMName",        fId:"UOMId",            fName:"UOM"            },
      LocationMaster: { list: newLocL,   idKey:"Id", nameKey:"LocationName",   fId:"LocationMasterId", fName:"LocationMaster" },
    };
  // eslint-disable-next-line
  }, [sess.Comid, toast]);

  const loadItems = useCallback(async (keyword="", column="", isInit=false) => {
    setLoading(true); setLdMsg("Loading Item Master...");
    const userid = localStorage.getItem("userid");
    if (!userid || userid === "" || userid === "0") { setLoading(false); return; }
    const res = await api(
      "/ItemMaster/SelectItemMaster", null,
      { "Download": "0" },
      { Comid: sess.Comid, Startindex: 0, PageCount: 99999, Keyword: keyword, Column: column ,webtype :1 }
    );
    setLoading(false);
    if (res._http404) { toast(`❌ 404: ${res.message}`, true); return; }
    if (res._netErr)  { toast(`❌ Cannot reach server: ${res.message}`, true); return; }
    if (res.redis === false) { window.alert("Already Login Another User Please Login Again!!!"); window.location.href="/Login"; return; }
    const arr = Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : [];
    if (isInit) setTotCnt(res.Count || arr.length);
  //   setRows(arr.map(fmtRow));
  //   setPage(1);
  // }, [sess.Comid, toast]);

    // Format rows
    const formattedRows = arr.map(fmtRow);

    // Set rows
    setRows(formattedRows);
  
    // Auto open LAST page
    const lastPage = Math.max(
      1,
      Math.ceil(formattedRows.length / ROWS_PER_PAGE)
    );
  
    setPage(lastPage);
  
  }, [sess.Comid, toast, ROWS_PER_PAGE]);

  const doExcelDownload = async () => {
    setLoading(true); setLdMsg("Preparing Excel...");
    const res = await api("/ItemMaster/SelectItemMaster", null, { "Download": "1" }, { Comid: sess.Comid, Startindex: 0, PageCount: 20, Keyword: "Excel", Column: "Excel" });
    setLoading(false);
    const data1 = res.data || rows.filter(r => r.Id);
    if (!data1?.length) { toast("No records to export", true); return; }
    const fmt = data1.map((o,i) => { const r = fmtRow(o); const out = { SNo:i+1 }; COLUMNS.forEach(c => { out[c.label] = r[c.key] ?? ""; }); return out; });
    const hdr  = Object.keys(fmt[0]).join(",");
    const body = fmt.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([hdr+"\n"+body], { type:"text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href=url; a.download="itemmaster.csv"; a.click();
    URL.revokeObjectURL(url); toast("✅ Excel downloaded");
  };

  const doExcelUpload = () => {
    const inp = document.createElement("input"); inp.type="file"; inp.accept=".xlsx,.csv";
    inp.onchange = async e => {
      const file = e.target.files[0]; if (!file) return;
      const text = await file.text();
      const lines = text.split("\n").filter(Boolean);
      if (lines.length<2) { toast("Empty file", true); return; }
      const hdrs = lines[0].split(",").map(h => h.replace(/^"|"$/g,"").trim());
      const records = lines.slice(1).map(line => { const vals=line.split(",").map(v=>v.replace(/^"|"$/g,"").trim()); const o={}; hdrs.forEach((h,i)=>{ o[h]=vals[i]||""; }); return o; }).filter(o => o.ProductName);
      if (!records.length) { toast("No valid ProductName rows", true); return; }
      doConfirm(`Import ${records.length} records?`, async () => {
        setLoading(true); setLdMsg("Uploading...");
        const res = await api("/ItemMaster/InsertItemMaster", records, { ...saveHdrs, "ApiType":"0" });
        setLoading(false);
        if (res._netErr) { toast(`❌ ${res.message}`, true); return; }
        if (res.ok) { toast("✅ " + (res.message||"Upload successful")); await loadItems("","",true); }
        else toast(`❌ ${res.message||"Upload failed"}`, true);
      });
    };
    inp.click();
  };

  const handleGcOpen = async () => {
    const row = rows.find(r => r._rid === selRid);
    if (!row?.Id) { toast("Select a saved row first", true); return; }
    const res = await api("/ItemMaster/SelectGroupCommission", null, {}, { Id: row.Id, Comid: sess.Comid });
    setGcRows(!res._netErr && (res.data||res.Data1) ? (res.data||res.Data1) : []); setGcOpen(true);
  };
  const saveGc = async () => {
    const row = rows.find(r => r._rid === selRid);
    setLoading(true); setLdMsg("Saving Group Commission...");
    const res = await api("/ItemMaster/InsertGroupCommission", gcRows, { "ItemId": String(row.Id) }, { Comid: sess.MComid, MirrorTable: sess.MirrorTable });
    setLoading(false);
    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }
    if (res.ok) { toast("✅ " + (res.message||"Saved")); setGcOpen(false); }
    else toast(`❌ ${res.message||"Failed"}`, true);
  };

  const handleBsrOpen = async () => {
    const row = rows.find(r => r._rid === selRid);
    if (!row?.Id) { toast("Select a saved row first", true); return; }
    const res = await api("/ItemMaster/SelectBranchSaleRate", null, {}, { Id: row.Id });
    setBsrRows(!res._netErr && (res.data||res.Data1) ? (res.data||res.Data1) : []); setBsrOpen(true);
  };
  const saveBsr = async () => {
    const row = rows.find(r => r._rid === selRid);
    setLoading(true); setLdMsg("Saving Branch Sale Rate...");
    const res = await api("/ItemMaster/UpdateBranchSaleRate", bsrRows, {}, { ItemId: row.Id });
    setLoading(false);
    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }
    if (res.ok) { toast("✅ " + (res.message||"Saved")); setBsrOpen(false); }
    else toast(`❌ ${res.message||"Failed"}`, true);
  };

  const handleTnOpen = () => {
    const row = rows.find(r => r._rid === selRid);
    setTnVal(row ? ns(row.PrinterName) : ""); setTnOpen(true);
  };
  const saveTn = () => {
    if (selRid) setRows(p => p.map(r => r._rid === selRid ? { ...r, PrinterName: tnVal, _dirty: true } : r));
    setTnOpen(false); toast("✅ Tamil/Printer name updated");
  };

  // ── Init ──────────────────────────────────────────────────────────────────
  // useEffect(() => {
  //   (async () => {
  //     await loadColCfg();
  //     const freshDropdowns = await loadDropdowns();

  //     let draftRestored = false;
  //     try {
  //       const savedDraft = sessionStorage.getItem(ITEM_DRAFT_KEY);
  //       if (savedDraft) {
  //         const parsed = JSON.parse(savedDraft);
  //         if (parsed && parsed.entryRow) {
  //           if (Array.isArray(parsed.rows)) setRows(parsed.rows.map(r => ({ ...r, _rid: r._rid || genRowId() })));
  //           setEntryRow({ ...parsed.entryRow, _rid: parsed.entryRow._rid || genRowId() });
  //           draftRestored = true;
  //           toast("📋 Draft restored — unsaved changes recovered.");
  //           restoreCursorAfterReturn(freshDropdowns);
  //         } else if (Array.isArray(parsed) && parsed.length > 0) {
  //           const newR = parsed.filter(r => r._isNew && !r.Id);
  //           const savedR = parsed.filter(r => !r._isNew && r.Id);
  //           setRows(savedR.map(r => ({ ...r, _rid: r._rid || genRowId() })));
  //           if (newR.length > 0) setEntryRow({ ...newR[0], _rid: newR[0]._rid || genRowId() });
  //           draftRestored = true;
  //           toast("📋 Draft restored — unsaved changes recovered.");
  //           restoreCursorAfterReturn(freshDropdowns);
  //         }
  //       }
  //     } catch {}

  //     if (!draftRestored) {
  //       await loadItems("", "", true);
  //     }

  //     draftBootstrapped.current = true;
  //   })();
  // // eslint-disable-next-line
  // }, []);
//------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      await loadColCfg();
      const freshDropdowns = await loadDropdowns();
      let draftRestored = false;

      try {
        const savedDraft = sessionStorage.getItem(ITEM_DRAFT_KEY);

        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);

          if (parsed && parsed.entryRow) {
            const restoredRows = Array.isArray(parsed.rows)
              ? parsed.rows.map(r => ({
                  ...r,
                  _rid: r._rid || genRowId()
                }))
              : [];

            setRows(restoredRows);

            setEntryRow({
              ...parsed.entryRow,
              _rid: parsed.entryRow._rid || genRowId()
            });

            // AUTO OPEN LAST PAGE
            const lastPage = Math.max(
              1,
              Math.ceil(restoredRows.length / ROWS_PER_PAGE)
            );

            setPage(lastPage);
            draftRestored = true;
            toast("📋 Draft restored — unsaved changes recovered.");
            restoreCursorAfterReturn(freshDropdowns);

          } else if (Array.isArray(parsed) && parsed.length > 0) {
            const newR = parsed.filter(r => r._isNew && !r.Id);
            const savedR = parsed.filter(r => !r._isNew && r.Id);

            const restoredRows = savedR.map(r => ({
              ...r,
              _rid: r._rid || genRowId()
            }));

            setRows(restoredRows);

            if (newR.length > 0) {
              setEntryRow({
                ...newR[0],
                _rid: newR[0]._rid || genRowId()
              });
            }

            // AUTO OPEN LAST PAGE
            const lastPage = Math.max(
              1,
              Math.ceil(restoredRows.length / ROWS_PER_PAGE)
            );

            setPage(lastPage);
            draftRestored = true;
            toast("📋 Draft restored — unsaved changes recovered.");
            restoreCursorAfterReturn(freshDropdowns);
          }
        }
      } catch {}

      // NORMAL LOAD
      if (!draftRestored) {
        await loadItems("", "", true);
        // loadItems already handles:
        // setPage(lastPage)

        // ── PCode_Auto: Page first open-ல் EntryRow-ஐ auto generate செய்வது ──
        // jQuery Reference: ProductAutoGen() → page load-ல் new row-க்கு auto code
        // Company Settings → PCode_Auto = Yes → DB → Login → Companysetting updated
        // → ItemMaster open → sess.Productcodeautogen true → auto generate
        if (sess.Productcodeautogen) {
          const emptyRow = mkEmpty();
          const rowWithCode = await autoGenProductCode(emptyRow);
          setEntryRow(rowWithCode);
        }
      }

      draftBootstrapped.current = true;

      // 🟢 மாற்றம் 4: Page Load ஆனவுடன் முதல் கட்டத்தில் (Product Code-ல்) Cursor-ஐ Focus செய்வது
      setTimeout(() => {
        const firstKey = visCols
          .map(vc => COLUMNS.find(c => c.key === vc.key))
          .filter(cd => cd && !cd.calc)
          .map(cd => cd.key)[0];
          
        if (firstKey) focusEntryCell(firstKey);
      }, 500);

    })();
  // eslint-disable-next-line
  }, []);
  //------------------------------------------------------------------

  // 🟢 மாற்றம்: முழுமையான Initial Load & Focus Setup


  const anyOpen = msgState || pw || ddPop || bsrOpen || gcOpen || tnOpen || showCS;
  useEffect(() => {
    const onKey = e => {
      if (anyOpen) return;
      if (e.key === "F1")  { e.preventDefault(); doSave(); }
      // if (e.key === "F3")  { e.preventDefault(); askPw("F3 Password", () => { window.location.href="/ItemMaster/Productopening"; }); }
      if (e.key === "F4")  { e.preventDefault(); askPw("F4 Password", doExcelDownload); }
      // if (e.key === "F5")  { e.preventDefault(); sess.Ecotech ? (window.location.href="Customer/GroupItems") : handleBsrOpen(); }
      if (e.key === "F6")  { e.preventDefault(); handleTnOpen(); }
      if (e.key === "F7")  { e.preventDefault(); askPw("F7 Password", doExcelUpload); }
      if (e.key === "F12") { e.preventDefault(); openCS(); }
      if (e.key === "Delete") { doDelete(); }
      if (e.key === "Escape") {
        doConfirm("Do You Want To Quit Page?", () => { window.location.href = "/Login/Home"; });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line
  }, [anyOpen, doSave, doDelete, selRid]);

  const handleEntryKeyDown = useCallback((e, colKey) => {
    if (e.key === "ArrowRight" || (e.key === "Tab" && !e.shiftKey)) {
      if (e.key === "ArrowRight") {
        const el = e.target;
        if (el.tagName === "INPUT" && el.type === "text" && el.selectionStart !== el.value.length) return;
      }
      e.preventDefault();
      const colIdx = entryEditableKeys.indexOf(colKey);
      if (colIdx < entryEditableKeys.length - 1) focusEntryCell(entryEditableKeys[colIdx + 1]);
      return;
    }
    if (e.key === "ArrowLeft" || (e.key === "Tab" && e.shiftKey)) {
      if (e.key === "ArrowLeft") {
        const el = e.target;
        if (el.tagName === "INPUT" && el.type === "text" && el.selectionStart !== 0) return;
      }
      e.preventDefault();
      const colIdx = entryEditableKeys.indexOf(colKey);
      if (colIdx > 0) focusEntryCell(entryEditableKeys[colIdx - 1]);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rows.length > 0) focusCell(rows[0]._rid, colKey);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const colIdx = entryEditableKeys.indexOf(colKey);
      if (colIdx < entryEditableKeys.length - 1) {
        focusEntryCell(entryEditableKeys[colIdx + 1]);
      } else {
        doSave();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (!anyOpen) doConfirm("Do You Want To Quit Page?", () => { window.location.href = "/Login/Home"; });
    }
  }, [entryEditableKeys, focusEntryCell, focusCell, rows, doSave, anyOpen, doConfirm]);

  const handleCellKeyDown = useCallback((e, rid, colKey) => {
    if (e.key === "ArrowRight" || (e.key === "Tab" && !e.shiftKey)) {
      if (e.key === "ArrowRight") {
        const el = e.target;
        if (el.tagName === "INPUT" && el.type === "text" && el.selectionStart !== el.value.length) return;
      }
      e.preventDefault();
      const colIdx = editableColKeys.indexOf(colKey);
      if (colIdx < editableColKeys.length - 1) focusCell(rid, editableColKeys[colIdx + 1]);
      return;
    }
    if (e.key === "ArrowLeft" || (e.key === "Tab" && e.shiftKey)) {
      if (e.key === "ArrowLeft") {
        const el = e.target;
        if (el.tagName === "INPUT" && el.type === "text" && el.selectionStart !== 0) return;
      }
      e.preventDefault();
      const colIdx = editableColKeys.indexOf(colKey);
      if (colIdx > 0) focusCell(rid, editableColKeys[colIdx - 1]);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const rowIdx = pagedRows.findIndex(r => r._rid === rid);
      if (rowIdx < pagedRows.length - 1) focusCell(pagedRows[rowIdx + 1]._rid, colKey);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const rowIdx = pagedRows.findIndex(r => r._rid === rid);
      if (rowIdx > 0) focusCell(pagedRows[rowIdx - 1]._rid, colKey);
      else focusEntryCell(colKey);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const colIdx = editableColKeys.indexOf(colKey);
      if (colIdx < editableColKeys.length - 1) focusCell(rid, editableColKeys[colIdx + 1]);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (!anyOpen) doConfirm("Do You Want To Quit Page?", () => { window.location.href = "/Login/Home"; });
    }
  }, [editableColKeys, focusCell, focusEntryCell, anyOpen, doConfirm]);

  const handleCellChange = useCallback((rid, colKey, value) => {
    setRows(prev => prev.map(row => {
      if (row._rid !== rid) return row;
      let finalValue = value;
      if (UPPERCASE_KEYS.has(colKey) && typeof value === "string") finalValue = value.toUpperCase();
      let updated = { ...row, [colKey]: finalValue, _dirty: true };
      if (CALC_TRIGGER_KEYS.has(colKey)) {
        const calced = calcRow(updated, sess, colKey);
        updated = { ...updated, ...calced };
      }
      if (colKey === "SalesRate") {
        const LC = vn(updated.LandingCost), SR = vn(finalValue);
        const diff = SR - LC;
        updated.ProfitPer = LC > 0 && diff > 0 ? f2(ro(diff / LC * 100)) : 0;
        const calced = calcRow(updated, sess, "SalesRate");
        updated = { ...updated, ...calced, SalesRate: f2(vn(finalValue)) };
      }
      if (colKey === "ProfitAmt") {
        const LC = vn(updated.LandingCost), PA = vn(finalValue);
        updated.ProfitPer = LC > 0 ? f2(PA / LC * 100) : 0;
        const calced = calcRow(updated, sess, "ProfitAmt");
        updated = { ...updated, ...calced };
      }
      if (colKey === "DMAmt") {
        const MRP = vn(updated.MRP), DA = vn(finalValue);
        updated.DMPer = MRP > 0 ? f2(ro(DA / MRP * 100)) : 0;
      }
      if (colKey === "DMPer") {
        const MRP = vn(updated.MRP), DP = vn(finalValue);
        updated.DMAmt = f2(ro(MRP * DP / 100));
      }
      return updated;
    }));
    setVErr("");
  }, [sess]);

  const registerRef = useCallback((rid, colKey, el) => {
    if (!cellRefs.current[rid]) cellRefs.current[rid] = {};
    if (el) cellRefs.current[rid][colKey] = el;
    else delete cellRefs.current[rid]?.[colKey];
  }, []);

  const openCS  = () => { setDraft(cols.map(c=>({...c}))); setCsSrch(""); setShowCS(true); };
  const saveCS = async () => {
    const next = draft.map(c => ({ ...c }));
    setCols(next);
    setShowCS(false);
    await saveColCfg(next);
  };
  const csToggle = i => { const u=[...draft]; u[i]={...u[i],visible:!u[i].visible}; setDraft(u); };
  const csW      = (i,v) => { const u=[...draft]; u[i]={...u[i],width:Number(v)||u[i].width}; setDraft(u); };
  const csFilt   = draft.filter(c => c.label.toLowerCase().includes(csSrch.toLowerCase()) || c.key.toLowerCase().includes(csSrch.toLowerCase()));
  const visCount = draft.filter(c=>c.visible).length;

  const updateColFilter = useCallback((colKey, val) => {
    setColFilters(prev => ({ ...prev, [colKey]: val }));
    setPage(1);
  }, []);

  const clearAllFilters = useCallback(() => {
    setColFilters({});
    setPage(1);
  }, []);

  const hasActiveFilters = Object.values(colFilters).some(v => v && v.trim());

  const filtered = rows.filter(r => {
    for (const [colKey, val] of Object.entries(colFilters)) {
      if (!val || !val.trim()) continue;
      const cellVal = String(r[colKey] ?? "").toLowerCase();
      if (!cellVal.includes(val.trim().toLowerCase())) return false;
    }
    return true;
  });

  const totPages   = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const pagedRows  = filtered.slice((page-1)*ROWS_PER_PAGE, page*ROWS_PER_PAGE);

  const pageNums = (() => {
    if (totPages <= 10) return Array.from({ length: totPages }, (_, i) => i + 1);
    const nums = new Set([1, totPages]);
    for (let i = Math.max(1, page - 3); i <= Math.min(totPages, page + 3); i++) nums.add(i);
    return Array.from(nums).sort((a, b) => a - b);
  })();

  const totW = SNO_W + DEL_W + visCols.reduce((s,c) => s + c.width, 0);

  const onMD = e => { const el=gRef.current; drag.current={on:true,x:e.pageX-el.offsetLeft,y:e.pageY-el.offsetTop,sl:el.scrollLeft,st:el.scrollTop}; };
  const onML = () => { drag.current.on=false; };
  const onMU = () => { drag.current.on=false; };
  const onMM = e => {
    if (!drag.current.on) return; e.preventDefault();
    const el=gRef.current;
    el.scrollLeft=drag.current.sl-((e.pageX-el.offsetLeft)-drag.current.x)*1.4;
    el.scrollTop =drag.current.st-((e.pageY-el.offsetTop) -drag.current.y)*1.4;
  };

  const renderSavedCell = useCallback((row, col) => {
    const cd = COLUMNS.find(c => c.key === col.key);
    if (!cd) return null;
    const rid = row._rid;
    const val = row[cd.key];
    const onFocus = () => setSelRid(rid);

    if (cd.calc) {
      const isLC = cd.key === "LandingCost";
      return (
        <span className={isLC ? "lc-value" : "calc-val"}>
          {cd.type === "f2" ? vn(val).toFixed(2) : cd.type === "f3" ? vn(val).toFixed(3) : String(val ?? "")}
        </span>
      );
    }
    if (cd.bool) {
      return (
        <select
          ref={el => registerRef(rid, cd.key, el)}
          value={val ? "1" : "0"}
          className="im-grid-input"
          style={{ cursor:"pointer", appearance:"none", textAlign:"center" }}
          onChange={e => handleCellChange(rid, cd.key, e.target.value === "1")}
          onKeyDown={e => handleCellKeyDown(e, rid, cd.key)}
          onFocus={onFocus}
        >
          <option value="0">✗</option>
          <option value="1">✓</option>
        </select>
      );
    }
    if (cd.isCombo) {
      return (
        <input
          ref={el => registerRef(rid, cd.key, el)}
          type="text" value={ns(val)} readOnly
          className="im-grid-input"
          style={{ cursor:"pointer", caretColor:"transparent" }}
          placeholder={"▼ " + cd.label}
          onFocus={onFocus}
          onClick={() => openCombo(rid, cd.key)}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === "F4") { e.preventDefault(); openCombo(rid, cd.key); }
            else handleCellKeyDown(e, rid, cd.key);
          }}
        />
      );
    }
    if (cd.type === "f2" || cd.type === "f3") {
      return (
        <input
          ref={el => registerRef(rid, cd.key, el)}
          type="number" step={cd.type === "f3" ? "0.001" : "0.01"}
          value={val === "" || val === undefined ? "" : val}
          className="im-grid-input" style={{ textAlign:"right" }}
          onChange={e => handleCellChange(rid, cd.key, e.target.value)}
          onKeyDown={e => handleCellKeyDown(e, rid, cd.key)}
          onFocus={onFocus} placeholder="0.00"
        />
      );
    }
    // if (cd.type === "f2" || cd.type === "f3") {
    //   return (
    //     <input
    //       ref={el => registerRef(rid, cd.key, el)}
    //       type="number" step={cd.type === "f3" ? "0.001" : "0.01"}
    //       value={val === "" || val === undefined ? "" : val}
    //       className="im-grid-input" style={{ textAlign:"right" }}
    //       onChange={e => handleCellChange(rid, cd.key, e.target.value)}
    //       onKeyDown={e => handleCellKeyDown(e, rid, cd.key)}
    //       onBlur={e => {
    //         // Edit பண்ணி முடிச்சதும் .00 update ஆகும்
    //         if (e.target.value !== "") {
    //           const decimals = cd.type === "f3" ? 3 : 2;
    //           handleCellChange(rid, cd.key, parseFloat(e.target.value).toFixed(decimals));
    //         }
    //       }}
    //       onFocus={onFocus} placeholder="0.00"
    //     />
    //   );
    // }
    if (cd.type === "int") {
      return (
        <input
          ref={el => registerRef(rid, cd.key, el)}
          type="number" step="1"
          value={val === "" || val === undefined ? "" : val}
          className="im-grid-input" style={{ textAlign:"right" }}
          onChange={e => handleCellChange(rid, cd.key, e.target.value)}
          onKeyDown={e => handleCellKeyDown(e, rid, cd.key)}
          onFocus={onFocus} placeholder="0"
        />
      );
    }
    return (
      <input
        ref={el => registerRef(rid, cd.key, el)}
        type="text" value={ns(val)}
        className="im-grid-input"
        onChange={e => handleCellChange(rid, cd.key, e.target.value)}
        onKeyDown={e => handleCellKeyDown(e, rid, cd.key)}
        onFocus={onFocus} placeholder={cd.label}
      />
    );
  }, [handleCellChange, handleCellKeyDown, registerRef, openCombo]);

  const ddFilt     = ddPop ? ddPop.list.filter(x => String(x[ddPop.nameKey]||"").toLowerCase().includes(ddQ.toLowerCase())) : [];
  const isNewValue = ddPop && ddQ.trim() && !ddPop.list.some(item => String(item[ddPop.nameKey]||"").toLowerCase() === ddQ.trim().toLowerCase());
  const ddHiliteC  = Math.min(ddHilite, Math.max(0, ddFilt.length - 1));
  const ddHiliteRef = useRef(0);
  useEffect(() => { ddHiliteRef.current = ddHiliteC; }, [ddHiliteC]);

  const entryHasData = String(entryRow.ProductCode||"").trim() || String(entryRow.ProductName||"").trim();

  // ── [CHANGE 3] Keyboard handler for Confirm/Alert modal ───────────────────
  // YES/NO modal: Enter = Yes, ArrowLeft/Right or Tab = toggle focus, ESC = No
  // Alert modal:  Enter = OK, ESC = OK
  const handleMsgKeyDown = useCallback((e) => {
    if (!msgState) return;
    if (msgState.yesNo) {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        // Trigger whichever button is currently focused; default to Yes
        const focused = document.activeElement;
        if (focused && focused.classList.contains("msg-no")) {
          msgState.onNo();
        } else {
          msgState.onYes();
        }
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        const focused = document.activeElement;
        const box = msgBoxRef.current;
        if (!box) return;
        const yes = box.querySelector(".msg-yes");
        const no  = box.querySelector(".msg-no");
        if (focused === yes) no?.focus();
        else yes?.focus();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        msgState.onNo();
        return;
      }
    } else {
      // Alert modal — Enter or Escape = OK
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        msgState.onYes();
        return;
      }
    }
  }, [msgState]);

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="im">
        {/* Header */}
        <div className="hdr">
          <div className="hdr-brand">
            <div className="hdr-icon">K</div>
            <div><div className="hdr-name">Kassa POS</div><div className="hdr-sub">Billing</div></div>
          </div>
          <div className="hdr-title">⬛ KASSA BM </div>
          {/* ── hdr-user: existing display + dropdown attached ── */}
          <div className="hdr-user adm-wrap" ref={adminRef}
            onClick={() => setAdminOpen(o => !o)}
            style={{ cursor: "pointer" }}
          >
            <div className="hdr-avatar">👤</div>
            <div>
              <div className="hdr-uname">Co: {sess.Comid}</div>
              <div className="hdr-urole">Administrator</div>
            </div>
            {adminOpen && (
              <div className="adm-dropdown">
                <button
                  className="adm-item"
                  onClick={e => { e.stopPropagation(); setAdminOpen(false); navigate("/company-master"); }}
                >
                  👤 My Profile
                </button>
                <button
                  className="adm-item"
                  onClick={e => { e.stopPropagation(); setAdminOpen(false); navigate("/") ; localStorage.clear();
                    sessionStorage.clear(); }}
                >
                  🚪 Logout
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="body">
          {/* Toolbar */}
          <div className="tbar">
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span className="tbar-txt">📋 Item Master </span>
              <button className="fb ex" style={{ height:23, padding:"0 9px", fontSize:10 }}
                onClick={()=>loadItems("","",true)}>🔄 Reload</button>
              {/* <button className="fb" style={{ height:23, padding:"0 9px", fontSize:10 }}
                onClick={()=>{ setEntryRow(mkEmpty()); setTimeout(()=>focusEntryCell(entryEditableKeys[0]),50); }}>
                ➕ New Entry
              </button> */}
              <button className="fb" style={{ height:23, padding:"0 9px", fontSize:10 }}
  onClick={resetEntryRowWithAutoGen}>
  ➕ New Entry
</button>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
                {pageNums.map((n, idx) => {
                  const prev = pageNums[idx - 1];
                  const showDot = prev && n - prev > 1;
                  return (
                    <span key={n} style={{ display:"flex", alignItems:"center", gap:3 }}>
                      {showDot && <span style={{ color:"#8b99b5", fontSize:11, padding:"0 2px" }}>…</span>}
                      <button className={`pgbtn${page===n?" on":""}`} onClick={()=>setPage(n)}>{n}</button>
                    </span>
                  );
                })}
              </div>
              <span className="badge">Rows: {rows.length}{totCnt>rows.length?` / ${totCnt}`:""}</span>
              {(entryRow._dirty || rows.filter(r=>r._dirty).length > 0) &&
                <span className="badge-w">✏️ {rows.filter(r=>r._dirty).length + (entryRow._dirty ? 1 : 0)} unsaved</span>}
              {vErr && <span className="verr">{vErr}</span>}
            </div>
          </div>

          {/* ── MAIN GRID ───────────────────────────────────────────────────── */}
          <div className="grid-wrap">
            <div className="gscroll" ref={gRef}
              onMouseDown={onMD} onMouseLeave={onML} onMouseUp={onMU} onMouseMove={onMM}>
              <table className="gtbl" style={{ width: totW }}>
                <thead>
                  {/* Row 1: Column filter inputs */}
                  <tr className="grid-filter-row">
                    <th style={{ width:SNO_W, minWidth:SNO_W, background:"#eef3fb", borderBottom:"2px solid #1f65de" }}></th>
                    {visCols.map(col => {
                      const isFilterable = FILTERABLE_COL_KEYS.has(col.key);
                      return (
                        <th key={col.key} style={{ width:col.width, minWidth:col.width, background:"#eef3fb", borderBottom:"2px solid #1f65de", padding:"2px 3px" }}>
                          {isFilterable ? (
                            <input
                              className="grid-col-filter"
                              value={colFilters[col.key] || ""}
                              onChange={e => updateColFilter(col.key, e.target.value)}
                              placeholder={`🔍 ${col.label}`}
                            />
                          ) : null}
                        </th>
                      );
                    })}
                    <th style={{ width:DEL_W, minWidth:DEL_W, background:"#eef3fb", borderBottom:"2px solid #1f65de" }}></th>
                  </tr>

                  {/* Row 2: Column headings */}
                  <tr>
                    <th className="sno" style={{ width:SNO_W, minWidth:SNO_W }}>S.No</th>
                    {visCols.map(c => (
                      <th key={c.key} style={{ width:c.width, minWidth:c.width }}>
                        {c.label}
                        {COLUMNS.find(x=>x.key===c.key)?.calc && <span style={{color:"#7bb3e0",fontSize:9,marginLeft:2}}>🔒</span>}
                      </th>
                    ))}
                    <th className="del-col-hdr" style={{ width:DEL_W, minWidth:DEL_W }}>Del</th>
                  </tr>

                  
                </thead>

                {/* ── SAVED DATA ROWS ────────────────────────────────────── */}
                <tbody>
                  {pagedRows.length === 0 ? (
                    <tr>
                      <td colSpan={visCols.length+2} className="empty-td">
                        📭 No saved records yet — fill the entry row above and press F1 to save
                      </td>
                    </tr>
                  ) : pagedRows.map((row, idx) => {
                    const isDirty = row._dirty;
                    const isSel   = selRid === row._rid;
                    const rowClass = [
                      isSel ? "sel" : "",
                      row.Active === false || row.Active === 0 ? "inact" : "",
                      isDirty ? "mod" : "",
                    ].filter(Boolean).join(" ");

                    return (
                      <tr key={row._rid} className={rowClass}
                        onClick={() => setSelRid(row._rid)}>
                        <td className="sno" style={{ userSelect:"none" }}>
                          {(page-1)*ROWS_PER_PAGE + idx + 1}
                        </td>
                        {visCols.map(col => {
                          const cd = COLUMNS.find(x => x.key === col.key) || {};
                          const isNum = (cd.type === "f2" || cd.type === "f3" || cd.type === "int") && !cd.bool;
                          return (
                            <td key={col.key}
                              className={[
                                "im-grid-cell",
                                isNum ? "im-grid-cell--num" : "",
                                isSel ? "im-grid-cell--sel" : "",
                              ].filter(Boolean).join(" ")}
                              style={{ width: col.width }}
                            >
                              {renderSavedCell(row, col)}
                            </td>
                          );
                        })}
                        <td className="del-col-td" style={{ width:DEL_W, textAlign:"center" }}>
                          <button
                            className="im-delete-btn row-del-btn"
                            title="Delete record"
                            onClick={e => { e.stopPropagation(); doDeleteRow(row._rid); }}
                          >🗑</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                {/* Row 3: STICKY ENTRY ROW */}
                <tr className="entry-row">
                    <td className="entry-row__sno" style={{ width:SNO_W, minWidth:SNO_W }}>
                      <div className="entry-row__sno-inner">
                        <span className="entry-row__star">★</span>
                        <span className="entry-row__label">New</span>
                      </div>
                    </td>

                    {visCols.map(col => {
                      const cd = COLUMNS.find(x => x.key === col.key) || {};
                      const isNum = (cd.type === "f2" || cd.type === "f3" || cd.type === "int") && !cd.bool;
                      return (
                        <td key={col.key}
                          className={["entry-row__cell", isNum ? "entry-row__cell--num" : ""].filter(Boolean).join(" ")}
                          style={{ width: col.width, minWidth: col.width }}
                        >
                          <EntryRowCell
                            col={col}
                            entryRow={entryRow}
                            setEntryRow={setEntryRow}
                            sess={sess}
                            onKeyDown={handleEntryKeyDown}
                            entryRefs={entryRefs}
                            openComboEntry={openComboEntry}
                          />
                        </td>
                      );
                    })}

                    <td className="entry-row__actions" style={{ width:DEL_W, minWidth:DEL_W }}>
                      {entryHasData ? (
                        <div className="entry-row__action-btns">
                          <button
                            className="entry-row__save-btn"
                            title="Save this entry (F1)"
                            onClick={doSave}
                          >💾</button>
                          {/* <button
                            className="entry-row__clear-btn"
                            title="Clear entry row"
                            onClick={() => { setEntryRow(mkEmpty()); setVErr(""); }}
                          >✕</button> */}

<button
  className="entry-row__clear-btn"
  title="Clear entry row"
  onClick={resetEntryRowWithAutoGen}
>✕</button>
                        </div>
                      ) : (
                        <span className="entry-row__hint">F1</span>
                      )}
                    </td>
                  </tr>
                  </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Footer buttons */}
        <div className="ftr">
          <button className="fb sv" onClick={doSave} disabled={loading}>💾 F1-Save</button>
          <span className="fsep">|</span>
          {/* <button className="fb" onClick={()=>askPw("F3 Password",()=>window.location.href="/ItemMaster/Productopening")}>📦 F3-Opening</button>
          <span className="fsep">|</span> */}
          <button className="fb ex" onClick={()=>askPw("F4 Password",doExcelDownload)} disabled={loading}>📥 F4-Excel↓</button>
          <span className="fsep">|</span>
          {/* <button className="fb" onClick={sess.Ecotech?()=>window.location.href="Customer/GroupItems":handleBsrOpen} disabled={!selRid&&!sess.Ecotech}>
            🏪 F5-{sess.Ecotech?"GroupItems":"BranchRate"}
          </button> */}
          <span className="fsep">|</span>
          {sess.GroupCommission && <><button className="fb" onClick={handleGcOpen} disabled={!selRid}>💰 GrpCommission</button><span className="fsep">|</span></>}
          <button className="fb" onClick={handleTnOpen} disabled={!selRid}>🌐 F6-TamilName</button>
          <span className="fsep">|</span>
          <button className="fb ex" onClick={()=>askPw("F7 Password",doExcelUpload)} disabled={loading}>📤 F7-Excel↑</button>
          <span className="fsep">|</span>
          <button className="fb dl" onClick={doDelete} disabled={!selRid||loading}>🗑️ Del</button>
          <span className="fsep">|</span>
          <button className="fb cf" onClick={openCS}>⚙️ F12</button>
        </div>

        {/* ── All modals below — UNCHANGED except msgState ─────────────────── */}

        {/* Combo dropdown modal */}
        {ddPop && (
          <div className="ov" onClick={e=>{ if(e.target===e.currentTarget){setDdPop(null);setDdQ("");setDdCtx(null);setDdHilite(0);} }}>
            <div className="im-popup dd-modal">
              <div className="dd-hdr">🔽 {ddPop.title}
                <button onClick={()=>{setDdPop(null);setDdQ("");setDdCtx(null);setDdHilite(0);}}>✕</button></div>
              <input
                ref={ddSrchRef}
                className="im-popup-search dd-srch"
                value={ddQ}
                onChange={e=>{ setDdQ(e.target.value); setDdHilite(0); }}
                onKeyDown={e=>{
                  if (e.key === "ArrowDown") { e.preventDefault(); setDdHilite(h => Math.min(h + 1, ddFilt.length - 1)); return; }
                  if (e.key === "ArrowUp")   { e.preventDefault(); setDdHilite(h => Math.max(h - 1, 0)); return; }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const idx = ddHiliteRef.current;
                    if (ddFilt.length > 0) selectDd(ddFilt[idx] ?? ddFilt[0]);
                    else if (isNewValue) handleDdConfirm();
                    return;
                  }
                  if (e.key === "Escape") { e.preventDefault(); setDdPop(null); setDdQ(""); setDdCtx(null); setDdHilite(0); }
                }}
                placeholder={`Search ${ddPop.title}...`}
              />
              <div className="im-popup-list dd-list" ref={ddListRef}>
                {ddFilt.length === 0
                  ? <div className="dd-empty">No results for "{ddQ}"</div>
                  : ddFilt.map((item, idx) => (
                    <div key={item[ddPop.idKey]} data-idx={idx}
                      className={`im-popup-row dd-item${idx === ddHiliteC ? " hi" : ""}`}
                      onClick={() => selectDd(item)}
                      onMouseEnter={() => setDdHilite(idx)}>
                      {item[ddPop.nameKey]}
                    </div>
                  ))}
              </div>
              {isNewValue && COMBO_NAV_MAP[ddPop.field] && (
                <div className="dd-create-new" onClick={handleDdConfirm}>
                  ➕ Create new {ddPop.title}: <strong>"{ddQ.trim()}"</strong>
                </div>
              )}
              {!isNewValue && <div className="dd-create">+ Create new {ddPop.title}</div>}
            </div>
          </div>
        )}

        {/* Branch Sale Rate modal */}
        {bsrOpen && (
          <div className="ov" onClick={e=>{ if(e.target===e.currentTarget) setBsrOpen(false); }}>
            <div className="bsr-modal">
              <div className="dd-hdr">🏪 Branch Sale Rate<button onClick={()=>setBsrOpen(false)}>✕</button></div>
              <div className="unit-body">
                <table className="utbl">
                  <thead><tr><th>Branch</th><th>Sale Rate</th></tr></thead>
                  <tbody>
                    {bsrRows.length===0
                      ? <tr><td colSpan={2} style={{ textAlign:"center", color:"#b0bbd4", padding:14, fontSize:11 }}>No branches</td></tr>
                      : bsrRows.map((r,i) => (
                        <tr key={i}>
                          <td><input value={r.BranchName||""} readOnly style={{ background:"#f8f9fb" }} /></td>
                          <td><input type="number" step="0.01" value={r.SaleRate||""} onChange={e=>setBsrRows(p=>p.map((x,j)=>j===i?{...x,SaleRate:e.target.value}:x))} /></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div className="mftr">
                <button className="mbtn-cancel" onClick={()=>setBsrOpen(false)}>Cancel</button>
                <button className="mbtn-save" onClick={saveBsr} disabled={loading}>💾 Save</button>
              </div>
            </div>
          </div>
        )}

        {/* Group Commission modal */}
        {gcOpen && sess.GroupCommission && (
          <div className="ov" onClick={e=>{ if(e.target===e.currentTarget) setGcOpen(false); }}>
            <div className="bsr-modal">
              <div className="dd-hdr">💰 Group Commission<button onClick={()=>setGcOpen(false)}>✕</button></div>
              <div className="unit-body">
                <table className="utbl">
                  <thead><tr><th>Group Name</th><th>Commission %</th><th>Active</th><th style={{ width:32 }}></th></tr></thead>
                  <tbody>
                    {gcRows.length===0
                      ? <tr><td colSpan={4} style={{ textAlign:"center", color:"#b0bbd4", padding:14, fontSize:11 }}>No group commissions</td></tr>
                      : gcRows.map((r,i)=>(
                        <tr key={i}>
                          <td><input value={r.GroupName||""} onChange={e=>setGcRows(p=>p.map((x,j)=>j===i?{...x,GroupName:e.target.value}:x))} /></td>
                          <td><input type="number" step="0.01" value={r.Commisssion||""} onChange={e=>setGcRows(p=>p.map((x,j)=>j===i?{...x,Commisssion:e.target.value}:x))} /></td>
                          <td><select value={r.GrpActive||"0"} onChange={e=>setGcRows(p=>p.map((x,j)=>j===i?{...x,GrpActive:e.target.value}:x))}>
                            <option value="0">No</option><option value="1">Yes</option></select></td>
                          <td><button className="bc-del" onClick={()=>setGcRows(p=>p.filter((_,j)=>j!==i))}>🗑</button></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <button className="bc-add" style={{ marginTop:7 }}
                  onClick={()=>setGcRows(p=>[...p,{GroupName:"",Commisssion:"",GrpActive:"1"}])}>+ Add Row</button>
              </div>
              <div className="mftr">
                <button className="mbtn-cancel" onClick={()=>setGcOpen(false)}>Cancel</button>
                <button className="mbtn-save" onClick={saveGc} disabled={loading}>💾 Save</button>
              </div>
            </div>
          </div>
        )}

        {/* Tamil Name modal */}
        {tnOpen && (
          <div className="ov" onClick={e=>{ if(e.target===e.currentTarget) setTnOpen(false); }}>
            <div className="tname-modal">
              <div className="dd-hdr">🌐 Tamil / Printer Name<button onClick={()=>setTnOpen(false)}>✕</button></div>
              <div className="modal-body">
                <label style={{ fontSize:11, color:"#6b7a99", fontWeight:600 }}>Tamil / Printer Name:</label>
                <input className="tname-inp" autoFocus value={tnVal}
                  onChange={e=>setTnVal(e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Enter") saveTn(); if(e.key==="Escape") setTnOpen(false); }}
                  placeholder="Enter Tamil name..." />
              </div>
              <div className="mftr">
                <button className="mbtn-cancel" onClick={()=>setTnOpen(false)}>Cancel</button>
                <button className="mbtn-save" onClick={saveTn}>✅ Apply</button>
              </div>
            </div>
          </div>
        )}

        {/* Column Settings modal */}
        {showCS && (
          <div className="ov" onClick={e=>{ if(e.target===e.currentTarget) setShowCS(false); }}>
            <div className="cs-modal">
              <div className="cs-hdr">
                <div className="cs-hdr-l">
                  <div className="cs-hdr-icon">⚙️</div>
                  <div><div className="cs-htitle">Column Settings</div>
                    <div className="cs-hsub">Toggle visibility · Adjust width · Saved to server + browser</div></div>
                </div>
                <button className="cs-close" onClick={()=>setShowCS(false)}>✕</button>
              </div>
              <div className="cs-bar">
                <input className="cs-srch" placeholder="🔍 Search columns…" value={csSrch} onChange={e=>setCsSrch(e.target.value)} />
                <button className="cs-tbtn" onClick={()=>setDraft(draft.map(c=>({...c,visible:true})))}>✅ All</button>
                <button className="cs-tbtn" onClick={()=>setDraft(draft.map(c=>({...c,visible:false})))}>🚫 None</button>
                <button className="cs-tbtn" onClick={()=>setDraft(DEFAULT_COLS.map(c=>({...c})))}>↩ Default</button>
                <span className="cs-badge">{visCount}/{draft.length}</span>
              </div>
              <div className="cs-lhdr">
                <span>#</span><span>Column</span>
                <span style={{ textAlign:"center" }}>Visible</span>
                <span style={{ textAlign:"right" }}>Width</span>
              </div>
              <div className="cs-list">
                {csFilt.map(col => {
                  const ri = draft.findIndex(c=>c.key===col.key);
                  return (
                    <div key={col.key} className={`cs-row${!col.visible?" off":""}`}>
                      <div className="cs-rnum">{ri+1}</div>
                      <div className="cs-rlbl">{col.label}</div>
                      <div style={{ display:"flex", justifyContent:"center" }}>
                        <label className="toggle">
                          <input type="checkbox" checked={col.visible} onChange={()=>csToggle(ri)} />
                          <div className="toggle-track" />
                        </label>
                      </div>
                      <div><input type="number" className="cs-winp" value={col.width} min={40} max={600}
                        onChange={e=>csW(ri,e.target.value)} /></div>
                    </div>
                  );
                })}
              </div>
              <div className="cs-ftr">
                <span className="cs-finfo">Saves to <strong>server</strong> + localStorage</span>
                <button className="cs-cancel" onClick={()=>setShowCS(false)}>Cancel</button>
                <button className="cs-reset" onClick={()=>setDraft(DEFAULT_COLS.map(c=>({...c})))}>↩ Reset</button>
                <button className="cs-save" onClick={saveCS} disabled={loading}>💾 Save</button>
              </div>
            </div>
          </div>
        )}

        {/* Password modal */}
        {pw && (
          <div className="ov z25">
            <div className="pw-modal">
              <div className="pw-title">🔐 {pw.title}</div>
              <input className="pw-inp" type="password" autoFocus value={pwVal}
                onChange={e=>setPwVal(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter") submitPw(); if(e.key==="Escape"){setPw(null);setPwVal("");} }}
                placeholder="Enter password…" />
              <div className="pw-btns">
                <button className="pw-cancel" onClick={()=>{setPw(null);setPwVal("");}}>Cancel</button>
                <button className="pw-ok" onClick={submitPw}>OK</button>
              </div>
            </div>
          </div>
        )}

        {/* ── [CHANGE 3] Confirm / Alert modal — keyboard-aware ────────────────
            • ref={msgBoxRef} → useEffect auto-focuses primary button on open
            • onKeyDown={handleMsgKeyDown} → Enter/Tab/Arrows/ESC all work
            • tabIndex={0} on the box ensures it can receive key events
            • Overlay click still cancels (onNo for confirm, onYes for alert)
            ──────────────────────────────────────────────────────────────── */}
        {msgState && (
          <div className="ov z30"
            onClick={e => {
              if (e.target === e.currentTarget) {
                // Clicking overlay: dismiss (No for confirm, OK for alert)
                msgState.yesNo ? msgState.onNo() : msgState.onYes();
              }
            }}
          >
            <div
              className="msg-box"
              ref={msgBoxRef}
              onKeyDown={handleMsgKeyDown}
              tabIndex={-1}
            >
              <div className="msg-title">
                {msgState.yesNo ? "⚠️ Confirm" : "ℹ️ Info"}
              </div>
              <div className="msg-text">{msgState.text}</div>
              <div className="msg-btns">
                {msgState.yesNo ? (
                  <>
                    {/* NO first in DOM, YES is primary and gets auto-focus */}
                    <button className="msg-no"  onClick={msgState.onNo}>No</button>
                    <button className="msg-yes" onClick={msgState.onYes}>Yes</button>
                  </>
                ) : (
                  <button className="msg-ok" onClick={msgState.onYes}>OK</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {loading && (
          <div className="ldr-ov">
            <div className="ldr-box">
              <div className="ldr-spin" />
              <div className="ldr-msg">{ldMsg}</div>
            </div>
          </div>
        )}

        {/* Toasts */}
        <div className="toasts">
          {toasts.map(t=><div key={t.id} className={`toast${t.err?" err":""}`}>{t.m}</div>)}
        </div>
      </div>
    </>
  );
}