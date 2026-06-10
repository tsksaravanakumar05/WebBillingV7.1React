// ─────────────────────────────────────────────────────────────────────────────
//  CustomerMaster.jsx
//
//  Imports:
//   • CC.*  from Common.jsx   — API helpers, session, uid, applyUppercase, etc.
//   • MSG.* from Messages.jsx — useConfirm, useToast, ToastList
//
//  Design / logic mirrors SupplierMaster exactly:
//   • Permission guard via useEffect + isAuthorized state
//   • EditMode per row (0=view / 1=edit)
//   • Edit ✏️ button — shows only on saved rows; click → enableEdit()
//   • dirtyIds ref — tracks rows actually typed in
//   • selectRow() — exits edit mode on non-dirty saved rows
//   • Popup pickers for Area, SalesMan, CustomerCard, Branch (same pattern)
//   • Tamil Name popup (F6)
//   • Pagination mirrors jQuery render() + loadCounter
//   • Uses MSG.useConfirm / MSG.useToast / MSG.ToastList
//   • 100% page width via supplier-page className
//   • Dual-login guard: _dualLogin → navigate("/")
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./MasterPage.css";
import "./SupplierMaster.css";   // reuse supplier CSS (100% width layout)

import Topbar from "../components/Topbar";
import * as CC from "../Master/Common";
import * as MSG from "../components/Messages";

// ─── Column field-name constants ──────────────────────────────────────────────
const grdId                   = "Id";
const grdSupplierName         = "AccountName";
const grdCustomerNameTamil    = "CustomerNameTamil";
const grdCode                 = "Code";
const grdArea                 = "AreaName";
const grdAreaId               = "AreaMasterRefId";
const grdSalesMan             = "SalesName";
const grdSalesManId           = "SalemanRefid";
const grdBranchName           = "BranchName";
const grdBranchCompanyRefid   = "BranchCompanyRefid";
const grdGroupName            = "GroupName";
const grdGroupMasterRefid     = "GroupMasterRefid";
const grdAddress1             = "Address1";
const grdAddress2             = "Address2";
const grdCity                 = "City";
const grdPincode              = "Pincode";
const grdMobileNo             = "MobileNo";
const grdPhone                = "Phone";
const grdGSTINNo              = "GSTINNo";
const grdEmail                = "Email";
const grdCreditBillDays       = "CreditBillDays";
const grdCreditBillLimit      = "CreditBillLimit";
const grdOpeningBalance       = "OpeningBalance";
const grdPANNo                = "StateCode";
const grdPANNo1               = "PANNo";
const grdPlaceofSupply        = "StateName";
const grdIGSTBill             = "IGSTBill";
const grdCRMNo                = "CRMNO";
const grdCRMPoint             = "OpeningPoints";
const grdCRMValue             = "OpeningValue";
const grdcustomercardtype     = "CustomerCardType";
const grdcustomercardtypeId   = "customercardtypeRefId";
const grdActive               = "Active";
const grdEditMode             = "EditMode";
const grdContactPersonName    = "ContactPersonName";
const grdDesignation          = "Designation";


// ─── Column config (mirrors SupplierMaster pattern) ───────────────────────────
const ALL_COLUMNS = [
  { field: grdSupplierName,       label: "Customer Name",    type: "string",  maxLen: 500, width: 180, hidden: false, required: true },
  { field: grdCustomerNameTamil,  label: "Tamil Name",       type: "string",  maxLen: 200, width: 140, hidden: true  },
  { field: grdCode,               label: "Code",             type: "string",  maxLen: 50,  width: 80,  hidden: true  },
  { field: grdArea,               label: "Area",             type: "popup",   maxLen: 200, width: 120, hidden: false },
  { field: grdSalesMan,           label: "Sales Man",        type: "popup",   maxLen: 200, width: 120, hidden: false },
  { field: grdBranchName,         label: "Branch",           type: "popup",   maxLen: 200, width: 130, hidden: true  },
  { field: grdGroupName,          label: "Group",            type: "string",  maxLen: 200, width: 120, hidden: true  },
  { field: grdAddress1,           label: "Address 1",        type: "string",  maxLen: 500, width: 140, hidden: false },
  { field: grdAddress2,           label: "Address 2",        type: "string",  maxLen: 500, width: 130, hidden: true  },
  { field: grdCity,               label: "City",             type: "string",  maxLen: 500, width: 90,  hidden: false },
  { field: grdPincode,            label: "Pincode",          type: "int",     maxLen: 8,   width: 80,  hidden: true  },
  { field: grdMobileNo,           label: "Mobile No",        type: "string",  maxLen: 50,  width: 110, hidden: false },
  { field: grdPhone,              label: "Phone",            type: "string",  maxLen: 50,  width: 90,  hidden: true  },
  { field: grdGSTINNo,            label: "GSTIN No",         type: "string",  maxLen: 50,  width: 140, hidden: false },
  { field: grdEmail,              label: "Email",            type: "string",  maxLen: 100, width: 130, hidden: true  },
  { field: grdCreditBillDays,     label: "Credit Days",      type: "int",     maxLen: 8,   width: 70,  hidden: false },
  { field: grdCreditBillLimit,    label: "Credit Limit",     type: "float",   maxLen: 18,  width: 100, hidden: true  },
  { field: grdOpeningBalance,     label: "Opening Bal",      type: "float",   maxLen: 18,  width: 100, hidden: true  },
  { field: grdCRMNo,              label: "CRM No",           type: "string",  maxLen: 50,  width: 90,  hidden: true  },
  { field: grdCRMPoint,           label: "CRM Point",        type: "float",   maxLen: 18,  width: 90,  hidden: true  },
  { field: grdCRMValue,           label: "CRM Value",        type: "float",   maxLen: 18,  width: 90,  hidden: true  },
  { field: grdcustomercardtype,   label: "Card Type",        type: "popup",   maxLen: 150, width: 120, hidden: false },
  { field: grdPANNo,              label: "State Code",       type: "string",  maxLen: 50,  width: 90,  hidden: true  },
  { field: grdPANNo1,             label: "PAN No",           type: "string",  maxLen: 50,  width: 90,  hidden: true  },
  { field: grdPlaceofSupply,      label: "Place of Supply",  type: "string",  maxLen: 100, width: 110, hidden: true  },
  { field: grdIGSTBill,           label: "GST Type",         type: "select",  options: ["GST", "IGST"], width: 80, hidden: true },
  { field: grdContactPersonName,  label: "Contact Person",   type: "string",  maxLen: 100, width: 130, hidden: true  },
  { field: grdDesignation,        label: "Designation",      type: "string",  maxLen: 100, width: 110, hidden: true  },
  { field: grdActive,             label: "Active",           type: "active-select", width: 60, hidden: false },
];
// ─── makeNewRow ───────────────────────────────────────────────────────────────
const makeNewRow = (prefillName = "", prefillMobile = "") => ({
  [grdId]:                null,
  [grdSupplierName]:      prefillName,
  [grdCustomerNameTamil]: "",
  [grdCode]:              "",
  [grdArea]:              "",
  [grdAreaId]:            null,
  [grdSalesMan]:          "",
  [grdSalesManId]:        null,
  [grdBranchName]:        "",
  [grdBranchCompanyRefid]:null,
  [grdGroupName]:         "",
  [grdGroupMasterRefid]:  null,
  [grdAddress1]:          "",
  [grdAddress2]:          "",
  [grdCity]:              "",
  [grdPincode]:           "",
  [grdMobileNo]:          prefillMobile,
  [grdPhone]:             "",
  [grdGSTINNo]:           "",
  [grdEmail]:             "",
  [grdCreditBillDays]:    "0",
  [grdCreditBillLimit]:   "0.00",
  [grdOpeningBalance]:    "0.00",
  [grdPANNo]:             "",
  [grdPANNo1]:            "",
  [grdPlaceofSupply]:     "",
  [grdIGSTBill]:          "GST",
  [grdCRMNo]:             "",
  [grdCRMPoint]:          "0.00",
  [grdCRMValue]:          "0.00",
  [grdcustomercardtype]:  "",
  [grdcustomercardtypeId]:null,
  [grdContactPersonName]: "",
  [grdDesignation]:       "",
  [grdActive]:            true,
  [grdEditMode]:          1,
  _uid: CC.uid(),
});

// ─── Reusable PopupWindow ─────────────────────────────────────────────────────
function PopupWindow({ title, children, onClose, width = 280 }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(10,20,40,0.45)",zIndex:8500,display:"flex",alignItems:"center",justifyContent:"center" }}
      onClick={onClose}>
      <div style={{ background:"#fff",borderRadius:8,boxShadow:"0 8px 32px rgba(0,0,0,0.22)",width,maxHeight:460,display:"flex",flexDirection:"column",overflow:"hidden" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding:"9px 14px",background:"#1f65de",color:"#fff",fontWeight:700,fontSize:13,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0 }}>
          <span>{title}</span>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#fff",cursor:"pointer",fontSize:17,lineHeight:1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── SearchableList inside popup ──────────────────────────────────────────────
function SearchableList({ items, labelField, prefill, onChange, onClose, onEnterEmpty, searchPlaceholder }) {
  const [search, setSearch]   = useState(prefill || "");
  const [focIdx, setFocIdx]   = useState(-1);
  const inputRef  = useRef(null);
  const listRef   = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 60); }, []);

  const filtered = items.filter(item =>
    String(item[labelField] || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(focIdx + 1, filtered.length - 1);
      setFocIdx(next);
      listRef.current?.children[next]?.focus();
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (search.trim() === "") { onEnterEmpty?.(); return; }
      const target = focIdx >= 0 ? filtered[focIdx] : filtered[0];
      if (target) onChange(target); else onEnterEmpty?.();
    }
    if (e.key === "Escape") onClose();
  };

  const handleItemKeyDown = (e, item, i) => {
    if (e.key === "Enter") { e.preventDefault(); onChange(item); }
    if (e.key === "ArrowDown") { e.preventDefault(); const next = Math.min(i+1, filtered.length-1); setFocIdx(next); listRef.current?.children[next]?.focus(); }
    if (e.key === "ArrowUp")   { e.preventDefault(); if (i > 0) { setFocIdx(i-1); listRef.current?.children[i-1]?.focus(); } else { setFocIdx(-1); inputRef.current?.focus(); } }
    if (e.key === "Escape") onClose();
  };

  return (
    <>
      <div style={{ padding:"6px 8px",borderBottom:"1px solid #e2e8f0",flexShrink:0 }}>
        <input
          ref={inputRef}
          className="mp-cell-input"
          placeholder={searchPlaceholder}
          value={search}
          onChange={e => { setSearch(e.target.value); setFocIdx(-1); }}
          onKeyDown={handleKeyDown}
          style={{ height:28 }}
        />
      </div>
      <div ref={listRef} style={{ overflowY:"auto",flex:1 }}>
        {filtered.length === 0 && (
          <div style={{ padding:12,color:"#94a3b8",fontSize:12,textAlign:"center" }}>No results</div>
        )}
        {filtered.map((item, i) => (
          <div
            key={i}
            tabIndex={0}
            className={`sm-picker-item${focIdx === i ? " focused" : ""}`}
            onClick={() => onChange(item)}
            onKeyDown={e => handleItemKeyDown(e, item, i)}
            onFocus={() => setFocIdx(i)}
          >
            {item[labelField]}
          </div>
        ))}
      </div>
      <div style={{ padding:"4px 10px",fontSize:10,color:"#94a3b8",borderTop:"1px solid #f1f5f9",flexShrink:0 }}>
        ↑↓ Navigate &nbsp;|&nbsp; Enter Select &nbsp;|&nbsp; Esc Close
      </div>
    </>
  );
}

// ─── CustomerMaster ───────────────────────────────────────────────────────────
export default function CustomerMaster() {
  const navigate  = useNavigate();
  const inputRefs = useRef({});    // keyed `${rowIdx}-${colField}`
  const dirtyIds  = useRef(new Set());
  const gridRef   = useRef([]);
  const [pw,setPw]=useState(null);
    const pwOkRef = useRef(null);
  // ── MSG hooks ──────────────────────────────────────────────────────────────
  const { confirm, ConfirmUI } = MSG.useConfirm();
  const { toast,   toasts    } = MSG.useToast();

  // ── Permission / authorization state ──────────────────────────────────────
  const [perm,         setPerm        ] = useState({ View:0, Add:0, Edit:0, Delete:0 });
  const [isAuthorized, setIsAuthorized] = useState(false);

  // ── Dual-login guard ───────────────────────────────────────────────────────
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
    const menudata = menulist.filter(obj => obj.PageName === "Customer");
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
    try {
      const main0     = (CC.getLocal("Mainsetting")    || [{}])[0] || {};
      const comSet    = (CC.getLocal("Companysetting") || [{}])[0] || {};
      const Comid     = CC.getStr("Comid")    || "1";
      const MComid    = CC.getStr("MComid")   || Comid;
      const IdComList = "";
      const MirrorTable = CC.getStr("MirrorTableOnline") || "0";
      const SupplierMulitipleAllow = main0.CustomerMulitipleAllow  ?? false;
      const SupplierCommon         = main0.CustomerCommonCompany   ?? false;
      const CustomerNameTamil      = main0.CustomerNameTamil       ?? false;
      const effectiveComid         = SupplierCommon ? MComid : Comid;
      const ComCustomer            = SupplierCommon ? 1 : 0;
      const BillFormatName         = comSet.SaleBillFormat || "";
      const pagecount              = BillFormatName === "JJBitumen" ? 500 : 20;
      return {
        Comid: effectiveComid, MComid, IdComList, MirrorTable,
        SupplierMulitipleAllow, CustomerNameTamil, ComCustomer, pagecount,
      };
    } catch {
      return { Comid:"1", MComid:"1", IdComList:"1", MirrorTable:"0", SupplierMulitipleAllow:false, CustomerNameTamil:false, ComCustomer:0, pagecount:20 };
    }
  });

  // ── Component state ───────────────────────────────────────────────────────
  const [grid,         setGrid        ] = useState([]);
  const [loading,      setLoading     ] = useState(false);
  const [selIdx,       setSelIdx      ] = useState(null);
  const [pagecountnew, setPagecountnew] = useState(0);
  const [curPage,      setCurPage     ] = useState(1);
  const [pageLen,      setPageLen     ] = useState(1);
  const [filterSearch, setFilterSearch] = useState("");
  const [filterColumn, setFilterColumn] = useState(grdSupplierName);
  const [activeFilter, setActiveFilter] = useState("all");

  // ── Popup states ──────────────────────────────────────────────────────────
  const [areaPopup,    setAreaPopup   ] = useState({ open:false, items:[], rowIdx:null, prefill:"" });
  const [salesmanPopup,setSalesmanPopup]= useState({ open:false, items:[], rowIdx:null, prefill:"" });
  const [cardPopup,    setCardPopup   ] = useState({ open:false, items:[], rowIdx:null, prefill:"" });
  const [branchPopup,  setBranchPopup ] = useState({ open:false, items:[], rowIdx:null, prefill:"" });
  const [tamilPopup,   setTamilPopup  ] = useState({ open:false, rowIdx:null, value:"" });
  const tamilInputRef = useRef(null);

  // ── focusCell ──────────────────────────────────────────────────────────────
  const focusCell = useCallback((rowIdx, colField) => {
    setTimeout(() => inputRefs.current[`${rowIdx}-${colField}`]?.focus(), 50);
  }, []);
  const loadCounter = useCallback(async (Startindex, PageCount, Keyword = "", Column = "", loadstatus) => {
    setLoading(true);
    const res = await CC.api(CC.SupplierSelect, null, {}, {
         Comid: Number(sess.Comid), Startindex:-1, PageCount:20,
         AccountType:"CUSTOMER", Keyword:Keyword, Column:Column,
       });
    setLoading(false);

    if (redirectIfDualLogin(res)) return;
    if (res._http404) { toast(`❌ 404 — SelectSupplier not found`, true); return; }
    if (res._netErr)  { toast(`❌ Network: ${res.message}`, true); return; }

    if (loadstatus === 1) {
      const count = Number(res?.Count || res?.count || 0);
      const pc    = count === 0 ? 1 : count;
      setPagecountnew(pc);
      if ((Keyword || "") === "") {
        const newPageLen = Math.ceil(pc / Number(sess.pagecount || 1));
        setPageLen(newPageLen);
        setCurPage(newPageLen);
      } else {
        setPageLen(1); setCurPage(1);
      }
    }

    const rawList = Array.isArray(res?.data)  ? res.data
                  : Array.isArray(res?.Data1) ? res.Data1
                  : [];

    const existing = rawList.map(obj => ({
      ...obj,
      [grdCreditBillDays]:  String(isNaN(parseFloat(obj[grdCreditBillDays])) ? 0 : parseFloat(obj[grdCreditBillDays])),
      [grdCreditBillLimit]: Number(obj[grdCreditBillLimit] || 0).toFixed(2),
      [grdOpeningBalance]:  Number(obj[grdOpeningBalance]  || 0).toFixed(2),
      [grdCRMPoint]:        Number(obj[grdCRMPoint]        || 0).toFixed(2),
      [grdCRMValue]:        Number(obj[grdCRMValue]        || 0).toFixed(2),
      [grdEditMode]:        0,
      [grdActive]:          obj[grdActive] === true || obj[grdActive] === 1,
      _uid: CC.uid(),
    }));

    const prefillName   = sessionStorage.getItem("POPValue")  || "";
    const prefillMobile = sessionStorage.getItem("POPValue1") || "";
    const blank         = makeNewRow(prefillName, prefillMobile);
    const full          = [...existing, blank];

    gridRef.current = full;
    setGrid(full);
    setSelIdx(full.length - 1);
    setTimeout(() => focusCell(full.length - 1, grdSupplierName), 100);
  }, [sess, toast, focusCell, redirectIfDualLogin]);
  // ── doExcelUpload (F7) ────────────────────────────────────────────────────────
const doExcelUpload = useCallback(() => {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = ".csv,.xlsx";
  inp.onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text();

    // Parse CSV
 // Replace this inside doExcelUpload in CustomerMaster.jsx

const parseCSV = raw => {
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  // ── Auto-detect delimiter (tab vs comma) ──
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';

  const splitLine = line => {
    // For tab-separated, just split directly (no quoted field complexity)
    if (delimiter === '\t') return line.split('\t').map(v => v.trim());

    // For comma-separated, handle quoted fields
    const result = []; let cur = ""; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i+1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    result.push(cur.trim()); return result;
  };

  const hdrs = splitLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = splitLine(line);
    const obj = {};
    hdrs.forEach((h, i) => { obj[h.trim()] = (vals[i] || "").trim(); });
    return obj;
  });
};

    // Label → field key map  (matches download headers exactly)
    const labelToKey = {
      "Id":               grdId,
      "Customer Name":    grdSupplierName,
      "Tamil Name":       grdCustomerNameTamil,
      "Code":             grdCode,
      "Area":             grdArea,
      "AreaId":           grdAreaId,
      "Sales Man":        grdSalesMan,
      "SalesManId":       grdSalesManId,
      "Branch":           grdBranchName,
      "BranchId":         grdBranchCompanyRefid,
      "Address 1":        grdAddress1,
      "Address 2":        grdAddress2,
      "City":             grdCity,
      "Pincode":          grdPincode,
      "Mobile No":        grdMobileNo,
      "Phone":            grdPhone,
      "GSTIN No":         grdGSTINNo,
      "Email":            grdEmail,
      "Credit Days":      grdCreditBillDays,
      "Credit Limit":     grdCreditBillLimit,
      "Opening Bal":      grdOpeningBalance,
      "CRM No":           grdCRMNo,
      "CRM Point":        grdCRMPoint,
      "CRM Value":        grdCRMValue,
      "Card Type":        grdcustomercardtype,
      "CardTypeId":       grdcustomercardtypeId,
      "State Code":       grdPANNo,
      "PAN No":           grdPANNo1,
      "Place of Supply":  grdPlaceofSupply,
      "GST Type":         grdIGSTBill,
      "Contact Person":   grdContactPersonName,
      "Designation":      grdDesignation,
      "Active":           grdActive,
    };

    const records = parseCSV(text).filter(o => o["Customer Name"] || o[grdSupplierName]);
    if (!records.length) { toast("❌ No valid rows found. Check file format.", true); return; }

    const ni = v => parseInt(v)    || 0;
    const nf = v => parseFloat(v)  || 0;
    const bi = v => (v === "true" || v === "1" || v === true) ? 1 : 0;
    const s  = v => String(v == null ? "" : v);

    const toSave = records.map(row => {
      // map CSV label headers → field keys
      const mapped = {};
      Object.entries(row).forEach(([h, v]) => {
        const key = labelToKey[h] || h;
        mapped[key] = v;
      });
      return {
        Id:                   ni(mapped[grdId]) || null,
        AccountType:          "CUSTOMER",
        [grdSupplierName]:    s(mapped[grdSupplierName]).trim(),
        [grdCustomerNameTamil]: s(mapped[grdCustomerNameTamil]),
        [grdCode]:            s(mapped[grdCode]),
        [grdArea]:            s(mapped[grdArea]),
        [grdAreaId]:          ni(mapped[grdAreaId]) || null,
        [grdSalesMan]:        s(mapped[grdSalesMan]),
        [grdSalesManId]:      ni(mapped[grdSalesManId]) || null,
        [grdBranchName]:      s(mapped[grdBranchName]),
        [grdBranchCompanyRefid]: ni(mapped[grdBranchCompanyRefid]) || null,
        [grdAddress1]:        s(mapped[grdAddress1]),
        [grdAddress2]:        s(mapped[grdAddress2]),
        [grdCity]:            s(mapped[grdCity]),
        [grdPincode]:         s(mapped[grdPincode]),
        [grdMobileNo]:        s(mapped[grdMobileNo]),
        [grdPhone]:           s(mapped[grdPhone]),
        [grdGSTINNo]:         s(mapped[grdGSTINNo]),
        [grdEmail]:           s(mapped[grdEmail]),
        [grdCreditBillDays]:  ni(mapped[grdCreditBillDays]),
        [grdCreditBillLimit]: nf(mapped[grdCreditBillLimit]),
        [grdOpeningBalance]:  nf(mapped[grdOpeningBalance]),
        [grdCRMNo]:           s(mapped[grdCRMNo]),
        [grdCRMPoint]:        nf(mapped[grdCRMPoint]),
        [grdCRMValue]:        nf(mapped[grdCRMValue]),
        [grdcustomercardtype]:   s(mapped[grdcustomercardtype]),
        [grdcustomercardtypeId]: ni(mapped[grdcustomercardtypeId]) || null,
        [grdPANNo]:           s(mapped[grdPANNo]),
        [grdPANNo1]:          s(mapped[grdPANNo1]),
        [grdPlaceofSupply]:   s(mapped[grdPlaceofSupply]),
        [grdIGSTBill]:        s(mapped[grdIGSTBill]) || "GST",
        [grdContactPersonName]: s(mapped[grdContactPersonName]),
        [grdDesignation]:     s(mapped[grdDesignation]),
        Active:               bi(mapped[grdActive]),
        SalemanRefid:         ni(mapped[grdSalesManId]) || null,
      };
    });

    const newCount  = toSave.filter(r => !r.Id || r.Id === 0).length;
    const editCount = toSave.filter(r => r.Id  && r.Id > 0).length;

    const ok = window.confirm(
      `Upload ${toSave.length} customers?\n➕ New: ${newCount}\n✏️ Update: ${editCount}\n\nProceed?`
    );
    if (!ok) return;

    setLoading(true);
    const res = await CC.insertapi(CC.SupplierInsert, toSave, {
      "Comid":                    String(sess.Comid),
      "SupplierMulitipleAllow":   String(sess.SupplierMulitipleAllow),
      "AccountTypeNew":           "CUSTOMER",
      "MirrorTable":              String(sess.MirrorTable),
      "Tamil":                    "0",
      "IdComList":                String(sess.IdComList),
      "ApiType":                  "1",
    });
    setLoading(false);

    if (redirectIfDualLogin(res)) return;
    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }
    if (res.ok ?? res.IsSuccess) {
      toast(`✅ ${res.message || `Uploaded — ${newCount} added, ${editCount} updated`}`);
      await loadCounter(-1, sess.pagecount, "", "", 1);
    } else {
      toast(`❌ ${res.message || "Upload failed"}`, true);
    }
  };
  inp.click();
}, [sess, toast, loadCounter]);
// ── doExcelDownload (F4) ──────────────────────────────────────────────────────
const doExcelDownload = useCallback(async () => {
  setLoading(true);
  const res = await CC.api(
    CC.SupplierSelect, null, {},
    {
      Comid: Number(sess.Comid), Startindex: -1, PageCount: 99999,
      AccountType: "CUSTOMER", Keyword: "", Column: "",
    }
  );
  setLoading(false);

  const data = Array.isArray(res?.data)  ? res.data
             : Array.isArray(res?.Data1) ? res.Data1
             : grid.filter(r => r[grdId]);

  if (!data?.length) { toast("No records to export", true); return; }

  // Columns to export
  const exportCols = [
    { key: grdId,                 label: "Id"              },
    { key: grdSupplierName,       label: "Customer Name"   },
    { key: grdCustomerNameTamil,  label: "Tamil Name"      },
    { key: grdCode,               label: "Code"            },
    { key: grdArea,               label: "Area"            },
    { key: grdAreaId,             label: "AreaId"          },
    { key: grdSalesMan,           label: "Sales Man"       },
    { key: grdSalesManId,         label: "SalesManId"      },
    { key: grdBranchName,         label: "Branch"          },
    { key: grdBranchCompanyRefid, label: "BranchId"        },
    { key: grdAddress1,           label: "Address 1"       },
    { key: grdAddress2,           label: "Address 2"       },
    { key: grdCity,               label: "City"            },
    { key: grdPincode,            label: "Pincode"         },
    { key: grdMobileNo,           label: "Mobile No"       },
    { key: grdPhone,              label: "Phone"           },
    { key: grdGSTINNo,            label: "GSTIN No"        },
    { key: grdEmail,              label: "Email"           },
    { key: grdCreditBillDays,     label: "Credit Days"     },
    { key: grdCreditBillLimit,    label: "Credit Limit"    },
    { key: grdOpeningBalance,     label: "Opening Bal"     },
    { key: grdCRMNo,              label: "CRM No"          },
    { key: grdCRMPoint,           label: "CRM Point"       },
    { key: grdCRMValue,           label: "CRM Value"       },
    { key: grdcustomercardtype,   label: "Card Type"       },
    { key: grdcustomercardtypeId, label: "CardTypeId"      },
    { key: grdPANNo,              label: "State Code"      },
    { key: grdPANNo1,             label: "PAN No"          },
    { key: grdPlaceofSupply,      label: "Place of Supply" },
    { key: grdIGSTBill,           label: "GST Type"        },
    { key: grdContactPersonName,  label: "Contact Person"  },
    { key: grdDesignation,        label: "Designation"     },
    { key: grdActive,             label: "Active"          },
  ];

  const fmt = data.map(o => {
    const out = {};
    exportCols.forEach(c => { out[c.label] = o[c.key] ?? ""; });
    return out;
  });

  const hdr  = Object.keys(fmt[0]).join(",");
  const body = fmt.map(r =>
    Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
  ).join("\n");

  const blob = new Blob(["\uFEFF" + hdr + "\n" + body], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "customermaster.csv"; a.click();
  URL.revokeObjectURL(url);
  toast("✅ Excel downloaded");
}, [sess.Comid, grid, toast]);
  // ── selectRow ─────────────────────────────────────────────────────────────
  const selectRow = useCallback((newIdx) => {
    setGrid(prev => prev.map((r, i) => {
      if (i !== newIdx && r[grdEditMode] === 1 && r[grdId] && !dirtyIds.current.has(r[grdId])) {
        return { ...r, [grdEditMode]: 0 };
      }
      return r;
    }));
    setSelIdx(newIdx);
  }, []);
const [colSettings, setColSettings] = useState(() => {
  try {
    const saved = JSON.parse(localStorage.getItem("customer_colSettings") || "null");
    if (saved && Array.isArray(saved)) return saved;
  } catch {}
  return ALL_COLUMNS.map(c => ({ field: c.field, label: c.label, hidden: c.hidden, width: c.width }));
});
const [f12Open, setF12Open] = useState(false);

const visibleColumns = ALL_COLUMNS.filter(c => {
  if (c.field === grdCustomerNameTamil && !sess.CustomerNameTamil) return false;
  const cs = colSettings.find(s => s.field === c.field);
  return cs ? !cs.hidden : !c.hidden;
}).map(c => {
  const cs = colSettings.find(s => s.field === c.field);
  return { ...c, width: cs?.width ?? c.width };
});
const saveColSettings = useCallback((localSettings) => {
  try { localStorage.setItem("customer_colSettings", JSON.stringify(localSettings)); } catch {}
  setColSettings(localSettings);
  setF12Open(false);
  toast("✅ Column settings saved");
}, [toast]);
  // ── loadCounter ───────────────────────────────────────────────────────────
  

  useEffect(() => { loadCounter(-1, sess.pagecount, "", "", 1); }, []); // eslint-disable-line

  // ── addRow ─────────────────────────────────────────────────────────────────
  const addRow = useCallback(() => {
    const blank = makeNewRow();
    setGrid(prev => {
      const next = [...prev, blank];
      gridRef.current = next;
      const idx = next.length - 1;
      setSelIdx(idx);
      focusCell(idx, grdSupplierName);
      return next;
    });
  }, [focusCell]);

  // ── updateCell ─────────────────────────────────────────────────────────────
  const updateCell = useCallback((idx, field, value) => {
    setGrid(prev => {
      const updated = prev.map((r, i) => {
        if (i !== idx) return r;
        if (r[grdId]) dirtyIds.current.add(r[grdId]);
        return { ...r, [field]: value, [grdEditMode]: 1 };
      });
      gridRef.current = updated;
      return updated;
    });
  }, []);

  const updateCells = useCallback((idx, fields) => {
    setGrid(prev => {
      const updated = prev.map((r, i) => {
        if (i !== idx) return r;
        if (r[grdId]) dirtyIds.current.add(r[grdId]);
        return { ...r, ...fields, [grdEditMode]: 1 };
      });
      gridRef.current = updated;
      return updated;
    });
  }, []);

  // ── enableEdit ─────────────────────────────────────────────────────────────
  const enableEdit = useCallback((idx) => {
    setGrid(prev => {
      const updated = prev.map((r, i) => i === idx ? { ...r, [grdEditMode]: 1 } : r);
      gridRef.current = updated;
      return updated;
    });
    selectRow(idx);
    focusCell(idx, grdSupplierName);
  }, [selectRow, focusCell]);

  // ── deleteRow ──────────────────────────────────────────────────────────────
  const deleteRow = useCallback(async (idx) => {
    const row = gridRef.current[idx];
    if (!row) return;
    const id = row[grdId];

    if (id != null && id !== 0) {
      if (!perm.Delete) { toast("❌ Page Delete Permission Denied !!!", true); return; }
      const ok = await confirm(`Do you want to delete "${row[grdSupplierName]}"?`);
      if (!ok) return;

      setLoading(true);
      const res = await CC.api(
        CC.SupplierDelete,
        null,
        { IdComList: String(sess.IdComList), ComCustomer: String(sess.ComCustomer) },
        { Id: Number(id), AccountType:"CUSTOMER", Comid: Number(sess.Comid), MirrorTable: Number(sess.MirrorTable) }
      );
      setLoading(false);

      if (redirectIfDualLogin(res)) return;
      if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

      if (res.ok) {
        toast("✅ " + (res.message || "Deleted"));
        dirtyIds.current.delete(id);
        setGrid(prev => {
          const next = prev.filter((_, i) => i !== idx);
          gridRef.current = next;
          const sel = Math.max(0, next.length - 1);
          setSelIdx(sel);
          focusCell(sel, grdSupplierName);
          return next;
        });
      } else {
        toast(`❌ ${res.message || "Delete failed"}`, true);
      }
    } else {
      setGrid(prev => {
        const next = prev.filter((_, i) => i !== idx);
        gridRef.current = next;
        const sel = Math.max(0, next.length - 1);
        setSelIdx(sel);
        focusCell(sel, grdSupplierName);
        return next;
      });
    }
  }, [perm, sess, confirm, toast, focusCell, redirectIfDualLogin]);

  // ── gridemptycheck ─────────────────────────────────────────────────────────
  const gridemptycheck = useCallback((g) => {
    let cleaned = [...g];
    const last = cleaned[cleaned.length - 1];
    if (cleaned.length > 1 && (!last[grdSupplierName] || last[grdSupplierName] === "")) {
      cleaned = cleaned.slice(0, -1);
    }
    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i][grdEditMode] === 1) {
        if (!cleaned[i][grdSupplierName] || cleaned[i][grdSupplierName] === "") {
          toast("❌ Enter All Customer Name in the Grid !!!", true);
          setSelIdx(i); focusCell(i, grdSupplierName);
          return { ok: false, cleaned };
        }
      }
    }
    return { ok: true, cleaned };
  }, [toast, focusCell]);

  // ── checkDuplicate ─────────────────────────────────────────────────────────
  const checkDuplicate = useCallback((g, field, label) => {
    const seen = {};
    for (let i = 0; i < g.length; i++) {
      const val = String(g[i][field] || "").trim().toLowerCase();
      if (!val) continue;
      if (seen[val]) {
        toast(`❌ Duplicate ${label} Found !!!`, true);
        setSelIdx(i); focusCell(i, field);
        return false;
      }
      seen[val] = true;
    }
    return true;
  }, [toast, focusCell]);
const vn = v => parseFloat(v) || 0;
  // ── handleSave ─────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const { ok, cleaned } = gridemptycheck(gridRef.current);
    if (!ok) return;
    setGrid(cleaned); gridRef.current = cleaned;

    let dirty = [];
    let flag  = 1;

    if (perm.Add === 0 && perm.Edit === 0) {
      toast("❌ Page Add & Update Permission Denied !!!", true); flag = 0;

    } else if (perm.Add === 1 && perm.Edit === 1) {
      dirty = cleaned.filter(r => r[grdEditMode] === 1);
      if (!dirty.length) { toast("⚠️ No Data Modified, Cannot Update !!!", true); flag = 0; }

    } else if (perm.Add === 1 && perm.Edit === 0) {
      dirty = cleaned.filter(r => r[grdEditMode] === 1 && r[grdId] == null);
      if (!dirty.length) {
        const any = cleaned.filter(r => r[grdEditMode] === 1);
        toast(any.length ? "❌ Page Edit Permission Denied !!!" : "⚠️ No Data Modified, Cannot Update !!!", true);
        flag = 0;
      }
    } else if (perm.Edit === 1 && perm.Add === 0) {
      dirty = cleaned.filter(r => r[grdEditMode] === 1 && r[grdId] != null);
      if (!dirty.length) {
        const any = cleaned.filter(r => r[grdEditMode] === 1);
        toast(any.length ? "❌ Page Add Permission Denied !!!" : "⚠️ No Data Modified, Cannot Update !!!", true);
        flag = 0;
      }
    }

    if (flag === 0) { addRow(); return; }

    if (!sess.SupplierMulitipleAllow) {
      if (!checkDuplicate(cleaned, grdSupplierName, "Customer Name")) return;
    }

    const hasNew      = dirty.some(r => r[grdId] == null || r[grdId] === 0);
    const hasExisting = dirty.some(r => r[grdId] != null && r[grdId] !== 0);
    let confirmMsg    = "Do you want to save the Customer details?";
    if (hasExisting && !hasNew) confirmMsg = "Do you want to update the Customer details?";
    if (hasExisting &&  hasNew) confirmMsg = "Do you want to save & update the Customer details?";

    const proceed = await confirm(confirmMsg);
    if (!proceed) { addRow(); return; }

     const payload = dirty.map(({ _uid, ...rest }) => ({
      ...rest, Id:rest.Id??null, AccountType:rest.AccountType||"CUSTOMER",
      Active:          rest.Active===true||rest.Active===1?1:0,
      OpeningBalance:  parseFloat(vn(rest.OpeningBalance))||0,
      CreditBillLimit: parseFloat(vn(rest.CreditBillLimit))||0,
      CreditBillDays:  parseInt(vn(rest.CreditBillDays))||0,
      SalemanRefid:    rest.SalemanRefid||null,
    }));

    setLoading(true);

 setLoading(true);
    const res = await CC.insertapi(CC.SupplierInsert, payload, {
      "Comid":String(sess.Comid), "SupplierMulitipleAllow":String(sess.SupplierMulitipleAllow),
      "AccountTypeNew":"CUSTOMER", "MirrorTable":String(sess.MirrorTable),
      "Tamil":"0", "IdComList":String(sess.IdComList), "ApiType":"1",
    });
    setLoading(false);

    if (redirectIfDualLogin(res)) return;
    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

    if (res.ok || res.IsSuccess) {
      dirtyIds.current.clear();
      toast("✅ " + (res.message || "Saved successfully!"));
      if (sessionStorage.getItem("POPStatus") === "ON") {
        sessionStorage.setItem("POPValue",  String(res.Id || ""));
        sessionStorage.setItem("POPName",   res.Name || "");
        sessionStorage.setItem("POPStatus", "OFF");
        try { window.parent.postMessage({ action:"closeDialog" }, "*"); } catch {}
      }
      await loadCounter(0, sess.pagecount, "", "", 1);
    } else {
      toast(`❌ ${res.message || "Save failed"}`, true);
    }
  }, [perm, sess, gridemptycheck, checkDuplicate, addRow, loadCounter, confirm, toast, redirectIfDualLogin]);

  // ── handleEsc ──────────────────────────────────────────────────────────────
  const handleEsc = useCallback(async () => {
    if (tamilPopup.open) { setTamilPopup({ open:false, rowIdx:null, value:"" }); return; }
    const ok = await confirm("Do you want to quit this page?");
    if (!ok) return;
    if (sessionStorage.getItem("POPStatus") === "ON") {
      sessionStorage.setItem("POPValue",  "-1");
      sessionStorage.setItem("POPStatus", "OFF");
      try { window.parent.postMessage({ action:"closeDialog" }, "*"); } catch {}
    } else {
      navigate(-1);
    }
  }, [tamilPopup.open, confirm, navigate]);

  // ── Popup loaders ──────────────────────────────────────────────────────────
  const openAreaPopup = useCallback(async (rowIdx) => {
    const res   = await CC.api(CC.AreaSelect, { Comid: Number(sess.MComid) });
    if (redirectIfDualLogin(res)) return;
    const items = Array.isArray(res.data) ? res.data : Array.isArray(res.Data1) ? res.Data1 : [];
    setAreaPopup({ open:true, items, rowIdx, prefill: gridRef.current[rowIdx]?.[grdArea] || "" });
  }, [sess.MComid, redirectIfDualLogin]);

  const openSalesManPopup = useCallback(async (rowIdx) => {
    const res   = await CC.api(CC.SalesManSelect, { Comid: Number(sess.MComid) });
    if (redirectIfDualLogin(res)) return;
    const items = Array.isArray(res.data) ? res.data : Array.isArray(res.Data1) ? res.Data1 : [];
    setSalesmanPopup({ open:true, items, rowIdx, prefill: gridRef.current[rowIdx]?.[grdSalesMan] || "" });
  }, [sess.MComid, redirectIfDualLogin]);

  const openCardPopup = useCallback(async (rowIdx) => {
    const res   = await CC.api(CC.CustomerCardSelect, { Comid: Number(sess.MComid) });
    if (redirectIfDualLogin(res)) return;
    const items = Array.isArray(res.data) ? res.data : Array.isArray(res.Data1) ? res.Data1 : [];
    setCardPopup({ open:true, items, rowIdx, prefill: gridRef.current[rowIdx]?.[grdcustomercardtype] || "" });
  }, [sess.MComid, redirectIfDualLogin]);

  const openBranchPopup = useCallback(async (rowIdx) => {
    const res   = await CC.api(CC.BranchSelect, { Comid: Number(sess.Comid), MComid: Number(sess.MComid) });
    if (redirectIfDualLogin(res)) return;
    const items = Array.isArray(res.data) ? res.data : Array.isArray(res.Data1) ? res.Data1 : [];
    setBranchPopup({ open:true, items, rowIdx, prefill: gridRef.current[rowIdx]?.[grdBranchName] || "" });
  }, [sess.Comid, sess.MComid, redirectIfDualLogin]);

  const openTamilPopup = useCallback((rowIdx) => {
    const val = gridRef.current[rowIdx]?.[grdCustomerNameTamil] || "";
    setTamilPopup({ open:true, rowIdx, value: val });
    setTimeout(() => tamilInputRef.current?.focus(), 80);
  }, []);

  // ── Popup selection handlers ───────────────────────────────────────────────
  const onAreaSelect = useCallback((item) => {
    const idx = areaPopup.rowIdx;
    updateCells(idx, { [grdArea]: item.AreaName, [grdAreaId]: item.Id });
    setAreaPopup({ open:false, items:[], rowIdx:null, prefill:"" });
    focusCell(idx, grdSalesMan);
  }, [areaPopup.rowIdx, updateCells, focusCell]);

  const onSalesManSelect = useCallback((item) => {
    const idx = salesmanPopup.rowIdx;
    updateCells(idx, { [grdSalesMan]: item.SalesManName, [grdSalesManId]: item.Id });
    setSalesmanPopup({ open:false, items:[], rowIdx:null, prefill:"" });
    focusCell(idx, grdAddress1);
  }, [salesmanPopup.rowIdx, updateCells, focusCell]);

  const onCardSelect = useCallback((item) => {
    const idx = cardPopup.rowIdx;
    updateCells(idx, { [grdcustomercardtype]: item.TypeName, [grdcustomercardtypeId]: item.Id });
    setCardPopup({ open:false, items:[], rowIdx:null, prefill:"" });
    focusCell(idx, grdActive);
  }, [cardPopup.rowIdx, updateCells, focusCell]);

  const onBranchSelect = useCallback((item) => {
    const idx = branchPopup.rowIdx;
    updateCells(idx, { [grdBranchName]: item.BranchName, [grdBranchCompanyRefid]: item.Id });
    setBranchPopup({ open:false, items:[], rowIdx:null, prefill:"" });
    focusCell(idx, grdAddress1);
  }, [branchPopup.rowIdx, updateCells, focusCell]);

  const onTamilConfirm = useCallback(() => {
    updateCells(tamilPopup.rowIdx, { [grdCustomerNameTamil]: tamilPopup.value });
    setTamilPopup({ open:false, rowIdx:null, value:"" });
    focusCell(tamilPopup.rowIdx, grdSupplierName);
  }, [tamilPopup, updateCells, focusCell]);

  // ── Column navigation order ────────────────────────────────────────────────
  const columnNavOrder = [
    grdSupplierName, grdArea, grdSalesMan,
    grdAddress1, grdAddress2, grdCity,
    grdMobileNo, grdGSTINNo,
    grdCreditBillDays, grdCreditBillLimit, grdOpeningBalance,
    grdcustomercardtype, grdActive,
  ];

  const moveNext = useCallback((rowIdx, columnname) => {
    const colIdx = columnNavOrder.indexOf(columnname);
    if (colIdx < columnNavOrder.length - 1) {
      focusCell(rowIdx, columnNavOrder[colIdx + 1]);
    } else {
      if (rowIdx >= gridRef.current.length - 1) addRow();
      else { setSelIdx(rowIdx + 1); focusCell(rowIdx + 1, columnNavOrder[0]); }
    }
  }, [columnNavOrder, addRow, focusCell]);

  // ── handleCellKeyDown ──────────────────────────────────────────────────────
  const handleCellKeyDown = useCallback((e, idx, columnname) => {
    if (e.keyCode === 46 && e.ctrlKey) { e.preventDefault(); deleteRow(idx); return; }
    if (e.key !== "Enter") return;
    e.preventDefault();

    const row   = gridRef.current[idx];
    if (!row) return;
    const value = row[columnname];

    if (columnname === grdSupplierName) {
      if (!value || value === "") { toast("❌ Enter Customer Name !!!", true); return; }
      if (!sess.SupplierMulitipleAllow && !checkDuplicate(gridRef.current, grdSupplierName, "Customer Name")) return;
      moveNext(idx, columnname);
    } else if (columnname === grdArea) {
      openAreaPopup(idx);
    } else if (columnname === grdSalesMan) {
      openSalesManPopup(idx);
    } else if (columnname === grdcustomercardtype) {
      openCardPopup(idx);
    } else if (columnname === grdOpeningBalance || columnname === grdCreditBillLimit) {
      updateCell(idx, columnname, parseFloat(value || 0).toFixed(2));
      moveNext(idx, columnname);
    } else {
      moveNext(idx, columnname);
    }
  }, [sess, toast, checkDuplicate, moveNext, openAreaPopup, openSalesManPopup, openCardPopup, deleteRow, updateCell]);

  // ── Filter ─────────────────────────────────────────────────────────────────
  const handleFilterSearch = useCallback((e) => {
    if (e.key === "Enter" && filterSearch.trim()) {
      loadCounter(0, 0, filterSearch, filterColumn, 1);
    }
  }, [filterSearch, filterColumn, loadCounter]);
 function renderCell(row, realIdx, colDef, inViewMode) {
  const { field, type, maxLen, options } = colDef;
  const value = row[field] ?? "";

  const cellStyle = {
    background:   inViewMode ? "transparent" : "#fff",
    border:       inViewMode ? "none"        : "1px solid #93c5fd",
    cursor:       inViewMode ? "default"     : "text",
    color:        inViewMode ? "inherit"     : "#1e293b",
    boxShadow:    inViewMode ? "none"        : "0 0 0 2px rgba(59,130,246,0.15)",
    borderRadius: inViewMode ? 0             : "4px",
    padding:      inViewMode ? "2px 4px"     : undefined,
  };
  const popupStyle = { ...cellStyle, cursor: inViewMode ? "default" : "pointer", background: inViewMode ? "transparent" : "#f8fafc" };

  const ref = el => { if (el) inputRefs.current[`${realIdx}-${field}`] = el; else delete inputRefs.current[`${realIdx}-${field}`]; };

  if (type === "active-select") return (
    <div style={{ display:"flex", justifyContent:"center", alignItems:"center" }}>
      <div onClick={() => !inViewMode && updateCell(realIdx, field, (value === 1 || value === true) ? 0 : 1)}
        style={{ width:34, height:18, borderRadius:9,
          background: (value === 1 || value === true) ? "#16a34a" : "#d1d5db",
          position:"relative", cursor: inViewMode ? "not-allowed" : "pointer",
          transition:"background .2s", opacity: inViewMode ? 0.6 : 1 }}>
        <div style={{ position:"absolute", top:2, left:(value === 1 || value === true) ? 16 : 2,
          width:14, height:14, borderRadius:"50%", background:"#fff",
          boxShadow:"0 1px 3px rgba(0,0,0,.25)", transition:"left .2s" }} />
      </div>
    </div>
  );

  if (type === "select") return (
    <select ref={ref} className="mp-cell-select" value={value}
      disabled={!!inViewMode}
      style={{ opacity: inViewMode ? 0.6 : 1 }}
      onChange={e => !inViewMode && updateCell(realIdx, field, e.target.value)}
      onFocus={() => selectRow(realIdx)}>
      {(options || []).map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  if (type === "popup") {
    const openMap = {
      [grdArea]:            () => openAreaPopup(realIdx),
      [grdSalesMan]:        () => openSalesManPopup(realIdx),
      [grdcustomercardtype]:() => openCardPopup(realIdx),
      [grdBranchName]:      () => openBranchPopup(realIdx),
    };
    return (
      <input ref={ref} className="mp-cell-input" type="text" readOnly
        value={String(value)}
        style={popupStyle}
        placeholder={inViewMode ? "" : "Enter to select…"}
        onFocus={() => selectRow(realIdx)}
        onClick={() => !inViewMode && openMap[field]?.()}
        onKeyDown={e => !inViewMode && handleCellKeyDown(e, realIdx, field)} />
    );
  }

  const isNum = type === "int" || type === "float";
  return (
    <input ref={ref} className="mp-cell-input" type="text"
      maxLength={maxLen || 200}
      value={String(value)}
      readOnly={!!inViewMode}
      style={{ ...cellStyle, ...(isNum ? { textAlign:"right" } : {}) }}
      onFocus={() => selectRow(realIdx)}
      onKeyDown={e => !inViewMode && handleCellKeyDown(e, realIdx, field)}
      onChange={e => {
        if (inViewMode) return;
        if (isNum) updateCell(realIdx, field, e.target.value);
        else CC.applyUppercase(e, v => updateCell(realIdx, field, v));
      }}
      onBlur={e => {
        if (inViewMode) return;
        if (type === "float") updateCell(realIdx, field, parseFloat(parseFloat(e.target.value) || 0).toFixed(2));
        if (type === "int")   updateCell(realIdx, field, String(parseInt(e.target.value) || 0));
      }} />
  );
}
  // ── Global keyboard shortcuts ──────────────────────────────────────────────
  useEffect(() => {
    const anyPopup = () => areaPopup.open || salesmanPopup.open || cardPopup.open || branchPopup.open || tamilPopup.open;
    const onKey = (e) => {
      if (anyPopup()) return;
      if (e.keyCode === 112) { e.preventDefault(); handleSave(); }   // F1
      if (e.keyCode === 115) { // F4
  e.preventDefault();
  pwOkRef.current = doExcelDownload;
  setPw({ title: "F4 Password" });
}
if (e.keyCode === 118) { // F7
  e.preventDefault();
  pwOkRef.current = doExcelUpload;
  setPw({ title: "F7 Password" });
}
      // inside the onKey handler, add:
      if (e.keyCode === 123) { e.preventDefault(); setF12Open(true); }  // F12
      if (e.keyCode === 113) { e.preventDefault(); loadCounter(-1, sess.pagecount, "Active", "Active", 1); } // F2
      if (e.keyCode === 116) { e.preventDefault(); const idx = selIdx ?? (gridRef.current.length - 1); openBranchPopup(idx); } // F5
      if (e.keyCode === 117) { e.preventDefault(); const idx = selIdx ?? (gridRef.current.length - 1); openTamilPopup(idx); }   // F6
      if (e.keyCode === 27)  { e.preventDefault(); handleEsc(); }    // Esc
    };
   
 
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleEsc, loadCounter, openBranchPopup, openTamilPopup, sess.pagecount, selIdx,
      areaPopup.open, salesmanPopup.open, cardPopup.open, branchPopup.open, tamilPopup.open]);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const handlePageClick = useCallback((page) => {
    setCurPage(page);
    loadCounter((page - 1) * sess.pagecount, sess.pagecount, "", "", 0);
  }, [sess.pagecount, loadCounter]);

  // ── Display grid (active filter) ───────────────────────────────────────────
  const displayGrid = grid.filter(row => {
    if (activeFilter === "active" && row[grdActive] === false) return false;
    return true;
  });
  function PwModal({ title, comid, onOk, onClose }) {
  const [val, setVal] = useState("");
  const verify = async () => {
    if (!val) return;
    const res = await CC.api(CC.LoginPasswordUrl, null, {}, { password:val, type:"EditPassword", Comid:comid });
    if (res.ok ?? res.IsSuccess ?? false) { onOk(); onClose(); }
    else window.alert("Invalid Password !!!");
  };
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(10,20,40,0.45)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ background:"#fff",borderRadius:8,width:280,padding:"20px 24px",boxShadow:"0 8px 32px rgba(0,0,0,0.22)" }}>
        <div style={{ fontSize:14,fontWeight:700,marginBottom:12,color:"#1f65de" }}>🔐 {title}</div>
        <input type="password" autoFocus value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if(e.key==="Enter") verify(); if(e.key==="Escape") onClose(); }}
          style={{ width:"100%",padding:"6px 10px",border:"1px solid #c5d8f8",borderRadius:4,fontSize:13,marginBottom:14,outline:"none" }}
          placeholder="Enter password…" />
        <div style={{ display:"flex",gap:8,justifyContent:"flex-end" }}>
          <button className="mp-btn" onClick={onClose}>Cancel</button>
          <button className="mp-btn sv" onClick={verify}>OK</button>
        </div>
      </div>
    </div>
  );
}
   function F12Popup() {
  const [local, setLocal] = useState(colSettings.map(s => ({ ...s })));
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(10,20,40,.5)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ background:"#fff",borderRadius:8,width:450,maxHeight:"80vh",display:"flex",flexDirection:"column",boxShadow:"0 16px 48px rgba(0,0,0,.3)",overflow:"hidden" }}>
        <div style={{ background:"#1a2e4a",color:"#fff",padding:"10px 16px",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <span>⚙ Column Settings (F12)</span>
          <button style={{ background:"none",border:"none",color:"#fff",fontSize:17,cursor:"pointer" }} onClick={() => setF12Open(false)}>✕</button>
        </div>
        <div style={{ flex:1,overflowY:"auto",padding:12 }}>
          <table style={{ borderCollapse:"collapse",width:"100%" }}>
            <thead>
              <tr>
                {["Column","Visible","Width (px)"].map(h => (
                  <th key={h} style={{ background:"#1a2e4a",color:"#fff",padding:"6px 10px",fontSize:11,fontWeight:600,textAlign:"left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {local.map(s => (
                <tr key={s.field}>
                  <td style={{ padding:"5px 10px",fontSize:12,borderBottom:"1px solid #eaecf4" }}>{s.label}</td>
                  <td style={{ padding:"5px 10px",textAlign:"center",borderBottom:"1px solid #eaecf4" }}>
                    <input type="checkbox" checked={!s.hidden}
                      onChange={() => setLocal(p => p.map(x => x.field === s.field ? { ...x, hidden: !x.hidden } : x))} />
                  </td>
                  <td style={{ padding:"5px 10px",borderBottom:"1px solid #eaecf4" }}>
                    <input type="number" min="40" max="500" value={s.width}
                      style={{ width:70,border:"1px solid #d4dbe8",borderRadius:3,padding:"2px 6px",fontSize:12,textAlign:"right" }}
                      onChange={e => setLocal(p => p.map(x => x.field === s.field ? { ...x, width: parseInt(e.target.value) || x.width } : x))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding:"10px 14px",display:"flex",gap:8,justifyContent:"flex-end",borderTop:"1px solid #e5e7eb" }}>
          <button onClick={() => saveColSettings(local)}
            style={{ background:"#1a2e4a",color:"#fff",border:"none",borderRadius:4,padding:"6px 18px",fontSize:12,fontWeight:700,cursor:"pointer" }}>
            💾 Save
          </button>
          <button onClick={() => setF12Open(false)}
            style={{ background:"#fff",color:"#6b7280",border:"1px solid #d1d5db",borderRadius:4,padding:"6px 14px",fontSize:12,cursor:"pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
  // ── Block render until authorized ──────────────────────────────────────────
  if (!isAuthorized) return null;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="mp-wrap supplier-page">
      {ConfirmUI}
      {pw && (
  <PwModal
    title={pw.title}
    comid={sess.Comid}
    onOk={() => { pwOkRef.current?.(); }}
    onClose={() => setPw(null)}
  />
)}
      {f12Open && <F12Popup />}
      <Topbar />

      {/* ── Area Popup ── */}
      {areaPopup.open && (
        <PopupWindow title="Select Area" onClose={() => setAreaPopup(p => ({ ...p, open:false }))}>
          <SearchableList items={areaPopup.items} labelField="AreaName" prefill={areaPopup.prefill}
            onChange={onAreaSelect} onClose={() => setAreaPopup(p => ({ ...p, open:false }))}
            onEnterEmpty={() => { setAreaPopup(p => ({ ...p, open:false })); focusCell(areaPopup.rowIdx, grdSalesMan); }}
            searchPlaceholder="Search Area…" />
        </PopupWindow>
      )}

      {/* ── SalesMan Popup ── */}
      {salesmanPopup.open && (
        <PopupWindow title="Select Sales Man" onClose={() => setSalesmanPopup(p => ({ ...p, open:false }))}>
          <SearchableList items={salesmanPopup.items} labelField="SalesManName" prefill={salesmanPopup.prefill}
            onChange={onSalesManSelect} onClose={() => setSalesmanPopup(p => ({ ...p, open:false }))}
            onEnterEmpty={() => { setSalesmanPopup(p => ({ ...p, open:false })); focusCell(salesmanPopup.rowIdx, grdAddress1); }}
            searchPlaceholder="Search Sales Man…" />
        </PopupWindow>
      )}

      {/* ── Customer Card Popup ── */}
      {cardPopup.open && (
        <PopupWindow title="Select Card Type" onClose={() => setCardPopup(p => ({ ...p, open:false }))}>
          <SearchableList items={cardPopup.items} labelField="TypeName" prefill={cardPopup.prefill}
            onChange={onCardSelect} onClose={() => setCardPopup(p => ({ ...p, open:false }))}
            onEnterEmpty={() => { setCardPopup(p => ({ ...p, open:false })); focusCell(cardPopup.rowIdx, grdActive); }}
            searchPlaceholder="Search Card Type…" />
        </PopupWindow>
      )}

      {/* ── Branch Popup ── */}
      {branchPopup.open && (
        <PopupWindow title="Select Branch" onClose={() => setBranchPopup(p => ({ ...p, open:false }))}>
          <SearchableList items={branchPopup.items} labelField="BranchName" prefill={branchPopup.prefill}
            onChange={onBranchSelect} onClose={() => setBranchPopup(p => ({ ...p, open:false }))}
            onEnterEmpty={() => { setBranchPopup(p => ({ ...p, open:false })); focusCell(branchPopup.rowIdx, grdAddress1); }}
            searchPlaceholder="Search Branch…" />
        </PopupWindow>
      )}

      {/* ── Tamil Name Popup ── */}
      {tamilPopup.open && (
        <PopupWindow title="Tamil Name (F6)" width={420} onClose={() => setTamilPopup({ open:false, rowIdx:null, value:"" })}>
          <div style={{ padding:14, display:"flex", gap:8 }}>
            <input
              ref={tamilInputRef}
              className="mp-cell-input"
              placeholder="Enter Tamil name…"
              value={tamilPopup.value}
              onChange={e => setTamilPopup(p => ({ ...p, value: e.target.value }))}
              onKeyDown={e => {
                if (e.key === "Enter") onTamilConfirm();
                if (e.key === "Escape") setTamilPopup({ open:false, rowIdx:null, value:"" });
              }}
              style={{ flex:1 }}
            />
            <button
              className="mp-btn sv"
              onClick={onTamilConfirm}
              style={{ flexShrink:0 }}
            >✓ OK</button>
          </div>
        </PopupWindow>
      )}

      <div className="mp-body">
        {/* ── Toolbar ── */}
        {/* ── TOP TOOLBAR: Save + F12 + Title + Filter ── */}
<div className="mp-toolbar" style={{
 
  display: "flex", alignItems: "center",
  gap: 6, padding: "6px 10px", flexWrap: "wrap",
}}>


  <div style={{ width: 1, height: 22, background: "#d1d5db", margin: "0 4px" }} />

  <div className="mp-toolbar-title">Customer Master</div>

  {/* Search filter — pushed to the right */}
  <div style={{ display: "flex", gap: 4, alignItems: "center", marginLeft: "auto" }}>
    <select className="mp-cell-select" style={{ width: 140, height: 28 }}
      value={filterColumn} onChange={e => setFilterColumn(e.target.value)}>
      <option value={grdSupplierName}>Customer Name</option>
      <option value={grdMobileNo}>Mobile No</option>
      <option value={grdGSTINNo}>GSTIN No</option>
      <option value={grdArea}>Area</option>
      <option value={grdCity}>City</option>
      <option value={grdCode}>Code</option>
    </select>
    <input className="mp-cell-input" style={{ width: 160, height: 28 }}
      placeholder="Search… (Enter)"
      value={filterSearch}
      onChange={e => setFilterSearch(e.target.value)}
      onKeyDown={handleFilterSearch}
    />
    <select className="mp-cell-select" style={{ width: 100, height: 28 }}
      value={activeFilter} onChange={e => setActiveFilter(e.target.value)}>
      <option value="all">All</option>
      <option value="active">Active Only</option>
    </select>
  </div>
</div>

        {/* ── Grid ── */}
       <div className="mp-grid-wrap" style={{ overflowX:"auto", overflowY:"auto" }}>
  <table className="mp-tbl" style={{
    minWidth: visibleColumns.reduce((a, c) => a + c.width, 150) + "px",
    tableLayout: "fixed", width: "100%"
  }}>
    <thead>
      <tr>
        <th style={{ width:45 }}>S.No</th>
        <th style={{ width:44 }}></th>
        {visibleColumns.map(c => (
          <th key={c.field} style={{ width:c.width, minWidth:c.width,
            textAlign: c.field === grdActive ? "center" : undefined }}>
            {c.label}{c.required ? " *" : ""}
          </th>
        ))}
        <th style={{ width:70, textAlign:"center" }}></th>
      </tr>
    </thead>
    <tbody>
      {displayGrid.map((row, idx) => {
        const realIdx = grid.indexOf(row);
        const isInact = row[grdActive] === false || row[grdActive] === 0;
        const isMod   = row[grdEditMode] === 1;
        const isSel   = selIdx === realIdx;
        const inViewMode = row[grdEditMode] === 0 && row[grdId];

        return (
          <tr key={row._uid}
            className={[isSel?"sel":"", isInact?"inact":"", isMod?"mod":""].filter(Boolean).join(" ")}
            onClick={() => selectRow(realIdx)}>

            <td className="sno">{idx + 1}</td>

            {/* Edit icon */}
            <td style={{ textAlign:"center", whiteSpace:"nowrap" }}>
              {row[grdId] && row[grdEditMode] === 0 && (
                <button className="mp-edit-btn" title="Edit row"
                  onClick={e => { e.stopPropagation(); enableEdit(realIdx); }}>✏️</button>
              )}
              {row[grdId] && row[grdEditMode] === 1 && (
                <button className="mp-edit-btn active" title="Editing…"
                  style={{ color:"#16a34a", cursor:"default" }}>✏️</button>
              )}
            </td>

            {visibleColumns.map(colDef => (
              <td key={colDef.field}
                style={{ padding:"2px 4px",
                  textAlign: colDef.field === grdActive ? "center" : undefined }}
                onClick={e => {
                  e.stopPropagation();
                  selectRow(realIdx);
                  if (!inViewMode) {
                    setTimeout(() => {
                      const el = inputRefs.current[`${realIdx}-${colDef.field}`];
                      if (el) { el.focus(); el.select?.(); }
                    }, 20);
                  }
                }}>
                {renderCell(row, realIdx, colDef, inViewMode)}
              </td>
            ))}

            <td style={{ textAlign:"center", padding:"2px 4px", whiteSpace:"nowrap" }}>
              {row[grdId] && row[grdEditMode] === 0 && (
                <button className="mp-edit-btn" title="Edit row"
                  onClick={e => { e.stopPropagation(); enableEdit(realIdx); }}>✏️</button>
              )}
              {row[grdId] && row[grdEditMode] === 1 && (
                <button className="mp-edit-btn active" style={{ color:"#16a34a",cursor:"default" }}>✏️</button>
              )}
              <button className="mp-del-btn"
                onClick={e => { e.stopPropagation(); deleteRow(realIdx); }}>🗑</button>
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
  {displayGrid.length === 0 && !loading && (
    <div className="mp-empty">No records. Press ➕ to add a customer.</div>
  )}
</div>
{/* ── BOTTOM TOOLBAR: Action buttons ── */}
<div className="mp-toolbar" style={{
 
  display: "flex", alignItems: "center",
  gap: 6, padding: "6px 10px", flexWrap: "wrap",
}}>
  <button className="mp-btn nw" onClick={addRow} disabled={loading}>➕ Add Row</button>
    <button className="mp-btn sv" onClick={handleSave} disabled={loading}>💾 F1 Save</button>
    <button className="mp-btn ex"
  onClick={() => { pwOkRef.current = doExcelDownload; setPw({ title:"F4 Password" }); }}>
  📥 F4 Excel↓
</button>

<button className="mp-btn ex"
  onClick={() => { pwOkRef.current = doExcelUpload; setPw({ title:"F7 Password" }); }}>
  📤 F7 Excel↑
</button>
  <button className="mp-btn"
    style={{ background: "var(--color-background-secondary)", color: "var(--color-text-primary)", border: "1px solid #9ca3af" }}
    onClick={() => setF12Open(true)}>
    ⚙ F12 Columns
  </button>
  <button className="mp-btn"
    onClick={() => loadCounter(-1, sess.pagecount, "Active", "Active", 1)}
    disabled={loading}
    style={{ background: "#0891b2", color: "#fff", borderColor: "#0891b2" }}>
    🔍 F2 Active
  </button>
  <button className="mp-btn"
    onClick={() => { const i = selIdx ?? (gridRef.current.length - 1); openBranchPopup(i); }}
    disabled={loading}
    style={{ background: "#7c3aed", color: "#fff", borderColor: "#7c3aed" }}>
    🏢 F5 Branch
  </button>
  {sess.CustomerNameTamil && (
    <button className="mp-btn"
      onClick={() => { const i = selIdx ?? (gridRef.current.length - 1); openTamilPopup(i); }}
      disabled={loading}
      style={{ background: "#be185d", color: "#fff", borderColor: "#be185d" }}>
      🔤 F6 Tamil
    </button>
  )}
  <button className="mp-btn"
    onClick={() => loadCounter(-1, sess.pagecount, "", "", 1)}
    disabled={loading}
    style={{ background: "#059669", color: "#fff", borderColor: "#059669" }}>
    🔄 Refresh
  </button>

  <button className="mp-btn dl" onClick={handleEsc} style={{ marginLeft: "auto" }}>
    ✕ Esc Cancel
  </button>
</div>
        {/* ── Pagination ── */}
        {pageLen > 1 && (
          <div style={{ display:"flex", flexWrap:"wrap", gap:4, alignItems:"center" }}>
            {Array.from({ length: pageLen }, (_, i) => i + 1).map(page => (
              <button key={page} onClick={() => handlePageClick(page)}
                className={`mp-page-btn${curPage === page ? " active" : ""}`}>
                {page}
              </button>
            ))}
            <span className="mp-rec-count">Records: {pagecountnew}</span>
          </div>
        )}

    
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

      {/* ── Toast notifications — from MSG.ToastList ── */}
      <MSG.ToastList toasts={toasts} />
    </div>
  );
}