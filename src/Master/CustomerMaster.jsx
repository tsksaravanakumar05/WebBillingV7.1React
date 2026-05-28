import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./MasterPage.css";
import Topbar from "../components/Topbar";

// ─────────────────────────────────────────────────────────────────────────────
// Column field-name constants (mirrors jQuery grd* vars)
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — same pattern as BrandMaster
// ─────────────────────────────────────────────────────────────────────────────
const mkUrl = (path) => (path.startsWith("/") ? path : "/" + path);

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
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...authHeaders(),
        ...extraHeaders,
      },
      body: body !== null ? (typeof body === "string" ? body : JSON.stringify(body)) : null,
    });
    if (res.status === 406) {
      alert("Already Login Another User Please Login Again!!!");
      window.location.href = "/Login";
      return { ok: false };
    }
    if (res.status === 404) return { ok: false, _http404: true, message: `404: ${fullUrl}` };
    if (res.status === 500) {
      const t = await res.text();
      console.error(`500 on ${fullUrl}:`, t.slice(0, 500));
      return { ok: false, message: "Server error 500 — see console" };
    }
    const text = await res.text();
    if (!text.trim()) return { ok: false, message: "Empty response" };
    try {
      const j = JSON.parse(text);
      if (j.IsSuccess !== undefined && j.ok      === undefined) j.ok      = j.IsSuccess;
      if (j.Data1     !== undefined && j.data    === undefined) j.data    = j.Data1;
      if (j.Message   !== undefined && j.message === undefined) j.message = j.Message;
      return j;
    } catch { return { ok: false, message: text }; }
  } catch (err) {
    return { ok: false, _netErr: true, message: err.message };
  }
};

const insertapi = async (path, body = null, extraHeaders = {}) => {
  try {
    const res = await fetch(mkUrl(path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...authHeaders(),
        ...extraHeaders,
      },
      body: body != null ? JSON.stringify(body) : null,
    });
    const text = await res.text();
    return JSON.parse(text);
  } catch (err) {
    return { ok: false, message: err.message };
  }
};

const getStr   = (k) => localStorage.getItem(k) || "";
const getLocal = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const uid      = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36);
const ValNum   = (v) => isNaN(parseFloat(v)) ? 0 : parseFloat(v);
const NullToString = (v) => (v == null || v === undefined) ? "" : String(v);

// ─────────────────────────────────────────────────────────────────────────────
// makeNewRow — mirrors addrow(gridSupplier) → sets Active=true
// ─────────────────────────────────────────────────────────────────────────────
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
  _uid: uid(),
});

// ─────────────────────────────────────────────────────────────────────────────
// ConfirmModal — same pattern as BrandMaster
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmModal({ message, onYes, onNo }) {
  const yesBtnRef = useRef(null);
  useEffect(() => { const t = setTimeout(() => yesBtnRef.current?.focus(), 30); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") { e.preventDefault(); onNo(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onNo]);
  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.box} role="dialog" aria-modal="true">
        <div style={modalStyles.icon}>?</div>
        <p style={modalStyles.msg}>{message}</p>
        <div style={modalStyles.btns}>
          <button ref={yesBtnRef} style={{ ...modalStyles.btn, ...modalStyles.yes }} onClick={onYes}>✔ Yes</button>
          <button style={{ ...modalStyles.btn, ...modalStyles.no }} onClick={onNo}>✘ No</button>
        </div>
      </div>
    </div>
  );
}
const modalStyles = {
  overlay: { position:"fixed",inset:0,background:"rgba(10,20,40,0.55)",backdropFilter:"blur(2px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999 },
  box:     { background:"#fff",borderRadius:"10px",padding:"28px 32px 22px",minWidth:"280px",maxWidth:"380px",textAlign:"center",boxShadow:"0 8px 32px rgba(0,0,0,0.22)",border:"1px solid #e2e8f0" },
  icon:    { width:"40px",height:"40px",borderRadius:"50%",background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",color:"#fff",fontSize:"20px",fontWeight:"700",lineHeight:"40px",margin:"0 auto 14px" },
  msg:     { fontSize:"14px",color:"#1e293b",fontWeight:"500",margin:"0 0 20px",lineHeight:"1.5" },
  btns:    { display:"flex",gap:"10px",justifyContent:"center" },
  btn:     { padding:"7px 26px",borderRadius:"6px",border:"none",fontSize:"13px",fontWeight:"600",cursor:"pointer" },
  yes:     { background:"linear-gradient(135deg,#22c55e,#16a34a)",color:"#fff" },
  no:      { background:"#f1f5f9",color:"#475569",border:"1px solid #cbd5e1" },
};

function useConfirm() {
  const [conf, setConf] = useState(null);
  const confirm  = useCallback((msg) => new Promise(resolve => setConf({ msg, resolve })), []);
  const handleYes = useCallback(() => { conf?.resolve(true); setConf(null); }, [conf]);
  const handleNo  = useCallback(() => { conf?.resolve(false); setConf(null); }, [conf]);
  const ConfirmUI = conf ? <ConfirmModal message={conf.msg} onYes={handleYes} onNo={handleNo} /> : null;
  return { confirm, ConfirmUI };
}

// ─────────────────────────────────────────────────────────────────────────────
// Popup Windows — Area, SalesMan, CustomerCard, Branch, TamilName
// Each mirrors its jQuery jqxWindow popup with search input + list
// ─────────────────────────────────────────────────────────────────────────────
function PopupWindow({ title, children, onClose, width = 260 }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.3)",zIndex:5000,display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ background:"#fff",borderRadius:8,boxShadow:"0 8px 32px rgba(0,0,0,0.2)",width,maxHeight:460,display:"flex",flexDirection:"column",overflow:"hidden" }}>
        <div style={{ padding:"8px 12px",background:"#1e40af",color:"#fff",fontWeight:700,fontSize:13,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          {title}
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#fff",cursor:"pointer",fontSize:16 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SearchableList({ items, labelField, value, onChange, onClose, onEnterEmpty, searchPlaceholder, inputRef, listRef }) {
  const [search, setSearch] = useState(value || "");
  const filtered = items.filter(item =>
    String(item[labelField] || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleInputKeyDown = (e) => {
    const key = e.keyCode;
    if (key === 40) { // Arrow Down → focus list
      e.preventDefault();
      if (filtered.length > 0) listRef?.current?.focus();
    }
    if (key === 13) {
      if (search.trim() === "") { onEnterEmpty && onEnterEmpty(); return; }
      if (filtered.length > 0) { onChange(filtered[0]); }
    }
    if (key === 27) { onClose(); }
  };

  const handleListKeyDown = (e, item) => {
    if (e.keyCode === 13) { onChange(item); }
    if (e.keyCode === 27) { onClose(); }
  };

  return (
    <>
      <div style={{ padding:"6px 8px",borderBottom:"1px solid #e2e8f0" }}>
        <input
          ref={inputRef}
          style={{ width:"100%",padding:"4px 8px",fontSize:13,border:"1px solid #cbd5e1",borderRadius:4,boxSizing:"border-box" }}
          placeholder={searchPlaceholder}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={handleInputKeyDown}
          autoFocus
        />
      </div>
      <div ref={listRef} style={{ overflowY:"auto",flex:1,outline:"none" }} tabIndex={-1}>
        {filtered.map((item, i) => (
          <div
            key={i}
            style={{ padding:"5px 10px",cursor:"pointer",fontSize:13,borderBottom:"1px solid #f1f5f9" }}
            onMouseEnter={e => e.currentTarget.style.background="#eff6ff"}
            onMouseLeave={e => e.currentTarget.style.background=""}
            onClick={() => onChange(item)}
            onKeyDown={e => handleListKeyDown(e, item)}
            tabIndex={0}
          >
            {item[labelField]}
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding:10,color:"#94a3b8",fontSize:13,textAlign:"center" }}>No results</div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CustomerMaster — main component
// ─────────────────────────────────────────────────────────────────────────────
export default function CustomerMaster() {
  const navigate  = useNavigate();
  const toastId   = useRef(0);
  const inputRefs = useRef({});   // keyed by `${rowIdx}-${colField}`

  const { confirm, ConfirmUI } = useConfirm();

  // ── Session / permissions ─────────────────────────────────────────────────
  const [sess] = useState(() => {
    const menulist  = getLocal("menulist") || [];
    const menudata  = menulist.filter(o => o.PageName === "Customer");
    const MainSet   = (getLocal("Mainsetting") || [{}])[0] || {};
    const ComSet    = (getLocal("Companysetting") || [{}])[0] || {};
    const Comid     = getStr("Comid")  || "1";
    const MComid    = getStr("MComid") || Comid;
    const IdComList = getStr("IdComList") || Comid;
    const MirrorTable = getStr("MirrorTableOnline") || "0";
    const SupplierMulitipleAllow = MainSet.CustomerMulitipleAllow ?? false;
    const SupplierCommon         = MainSet.CustomerCommonCompany  ?? false;
    const CustomerNameTamil      = MainSet.CustomerNameTamil      ?? false;
    const effectiveComid         = SupplierCommon ? MComid : Comid;
    const ComCustomer            = SupplierCommon ? 1 : 0;
    const BillFormatName         = ComSet.SaleBillFormat || "";
    const pagecount              = BillFormatName === "JJBitumen" ? 500 : 20;
    return {
      Comid: effectiveComid, MComid, IdComList, MirrorTable,
      SupplierMulitipleAllow, CustomerNameTamil, ComCustomer, pagecount,
      menudata,
      perm: menudata[0] || { View: 1, Add: 1, Edit: 1, Delete: 1 },
    };
  });

  // ── Grid state ─────────────────────────────────────────────────────────────
  const [grid,    setGrid]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [toasts,  setToasts]  = useState([]);
  const [selIdx,  setSelIdx]  = useState(null);
  const [selCol,  setSelCol]  = useState(grdSupplierName);
  const gridRef   = useRef([]);

  // ── Pagination state (mirrors jQuery curPage, pageLen, pagecountnew) ───────
  const [pagecountnew, setPagecountnew] = useState(0);
  const [curPage,      setCurPage]      = useState(1);
  const [pageLen,      setPageLen]      = useState(1);

  // ── Popup states ──────────────────────────────────────────────────────────
  const [areaPopup,       setAreaPopup]       = useState({ open:false, items:[], rowIdx:null });
  const [salesmanPopup,   setSalesmanPopup]   = useState({ open:false, items:[], rowIdx:null });
  const [cardPopup,       setCardPopup]       = useState({ open:false, items:[], rowIdx:null });
  const [branchPopup,     setBranchPopup]     = useState({ open:false, items:[], rowIdx:null });
  const [tamilPopup,      setTamilPopup]      = useState({ open:false, rowIdx:null, value:"" });
  const [filterSearch,    setFilterSearch]    = useState("");
  const [filterColumn,    setFilterColumn]    = useState(grdSupplierName);
  const [activeFilter,    setActiveFilter]    = useState("all"); // "all" | "active"

  const popupInputRef = useRef(null);
  const popupListRef  = useRef(null);
  const tamilInputRef = useRef(null);

  // ── Toast helper ──────────────────────────────────────────────────────────
  const toast = useCallback((msg, isErr = false) => {
    const id = ++toastId.current;
    setToasts(p => [...p, { id, msg, isErr }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  // ── Focus helper ──────────────────────────────────────────────────────────
  const focusCell = useCallback((rowIdx, colField) => {
    setTimeout(() => {
      const key = `${rowIdx}-${colField}`;
      inputRefs.current[key]?.focus();
    }, 50);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Permission check — mirrors jQuery menudata check + View==0 check
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const menulist = getLocal("menulist");
    if (!menulist) {
      alert("Session Close Please Login !!!.");
      window.location.href = "/Login/Index";
      return;
    }
    const menudata = menulist.filter(o => o.PageName === "Customer");
    if (!menudata || menudata.length === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => {
        navigate("/dashboard");
      }, 3000);
      return;
    }
    if (menudata[0].View === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => {
        navigate("/dashboard");
      }, 3000);
      return;
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // loadCounter — mirrors methods.loadCounter(Startindex, PageCount, Keyword, Column, loadstatus)
  // URL: /Supplier/SelectSupplier
  // AccountType: "CUSTOMER"
  // ─────────────────────────────────────────────────────────────────────────
  // const loadCounter = useCallback(async (Startindex, PageCount, Keyword, Column, loadstatus) => {
  //   setLoading(true);
  //   const { Comid, pagecount } = sess;

  //   const res = await api("/Supplier/SelectSupplier", {
  //     Comid:      parseInt(Comid),
  //     Startindex,
  //     PageCount,
  //     AccountType:"CUSTOMER",
  //     Keyword:    Keyword || "",
  //     Column:     Column  || "",
  //   });

  //   setLoading(false);

  //   if (!res.ok) { toast(`❌ ${res.message || "Load failed"}`, true); return; }

  //   // mirrors: if (loadstatus == 1) { pagination calc }
  //   if (loadstatus === 1) {
  //     const count = res.Count || 0;
  //     const pc    = count === 0 ? 1 : count;
  //     setPagecountnew(pc);
  //     if (Keyword === "") {
  //       const newPageLen = Math.ceil((pc + pagecount - 1) / pagecount);
  //       setPageLen(newPageLen);
  //       setCurPage(newPageLen);
  //     } else {
  //       setPageLen(1);
  //       setCurPage(1);
  //     }
  //   }

  //   // mirrors: data.data.forEach — format decimal fields
  //   const rawList = Array.isArray(res.data) ? res.data : [];
  //   const formatted = rawList.map(obj => ({
  //     ...obj,
  //     [grdCreditBillDays]:  String(ValNum(obj[grdCreditBillDays])),
  //     [grdCreditBillLimit]: parseFloat(obj[grdCreditBillLimit] || 0).toFixed(2),
  //     [grdOpeningBalance]:  parseFloat(obj[grdOpeningBalance]  || 0).toFixed(2),
  //     [grdCRMPoint]:        parseFloat(obj[grdCRMPoint]        || 0).toFixed(2),
  //     [grdCRMValue]:        parseFloat(obj[grdCRMValue]        || 0).toFixed(2),
  //     [grdEditMode]:        0,
  //     [grdActive]:          obj[grdActive] === true || obj[grdActive] === 1,
  //     _uid: uid(),
  //   }));

  //   // mirrors: addrow(gridSupplier) → blank row at bottom
  //   // also mirrors: sessionStorage POPValue / POPValue1 prefill
  //   const prefillName   = sessionStorage.getItem("POPValue")  || "";
  //   const prefillMobile = sessionStorage.getItem("POPValue1") || "";
  //   const newRow        = makeNewRow(prefillName, prefillMobile);
  //   const fullGrid      = [...formatted, newRow];

  //   gridRef.current = fullGrid;
  //   setGrid(fullGrid);
  //   setSelIdx(fullGrid.length - 1);
  //   setSelCol(grdSupplierName);
  //   focusCell(fullGrid.length - 1, grdSupplierName);
  // }, [sess, toast, focusCell]);

  const loadCounter = useCallback(async (
    Startindex,
    PageCount,
    Keyword = "",
    Column = "",
    loadstatus
  ) => {
    try {
      setLoading(true);
  
      const { Comid, pagecount } = sess;
  
      const payload = {
        Comid: Number(Comid),
        Startindex: Number(Startindex),
        PageCount: Number(PageCount),
        AccountType: "CUSTOMER",
        Keyword: Keyword || "",
        Column: Column || "",
      };
  
      // IMPORTANT:
      // Your backend SelectSupplier is normal API params style,
      // so pass payload as 4th argument (query params)
      const res = await api(
        "/Supplier/SelectSupplier",
        null,
        {},
        payload
      );
  
      if (!res?.ok) {
        toast(`❌ ${res?.message || "Load failed"}`, true);
        return;
      }
  
      // pagination
      if (loadstatus === 1) {
        const count = Number(res?.Count || res?.count || 0);
        const pc = count === 0 ? 1 : count;
  
        setPagecountnew(pc);
  
        if ((Keyword || "") === "") {
          const newPageLen = Math.ceil(pc / Number(pagecount || 1));
          setPageLen(newPageLen);
          setCurPage(newPageLen);
        } else {
          setPageLen(1);
          setCurPage(1);
        }
      }
  
      // backend returns Data1
      const rawList = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.Data1)
        ? res.Data1
        : [];
  
      const formatted = rawList.map((obj) => ({
        ...obj,
  
        [grdCreditBillDays]: String(
          ValNum(obj?.[grdCreditBillDays] || 0)
        ),
  
        [grdCreditBillLimit]: Number(
          obj?.[grdCreditBillLimit] || 0
        ).toFixed(2),
  
        [grdOpeningBalance]: Number(
          obj?.[grdOpeningBalance] || 0
        ).toFixed(2),
  
        [grdCRMPoint]: Number(
          obj?.[grdCRMPoint] || 0
        ).toFixed(2),
  
        [grdCRMValue]: Number(
          obj?.[grdCRMValue] || 0
        ).toFixed(2),
  
        [grdEditMode]: 0,
  
        [grdActive]:
          obj?.[grdActive] === true ||
          obj?.[grdActive] === 1,
  
        _uid: uid(),
      }));
  
      // popup prefill
      const prefillName =
        sessionStorage.getItem("POPValue") || "";
  
      const prefillMobile =
        sessionStorage.getItem("POPValue1") || "";
  
      const newRow = makeNewRow(
        prefillName,
        prefillMobile
      );
  
      const fullGrid = [...formatted, newRow];
  
      gridRef.current = fullGrid;
  
      setGrid(fullGrid);
  
      setSelIdx(fullGrid.length - 1);
  
      setSelCol(grdSupplierName);
  
      setTimeout(() => {
        focusCell(fullGrid.length - 1, grdSupplierName);
      }, 100);
  
    } catch (err) {
      console.error("loadCounter Error :", err);
  
      toast(
        `❌ ${err?.message || "Something went wrong"}`,
        true
      );
    } finally {
      setLoading(false);
    }
  }, [sess, toast, focusCell]);

  // ── Init — mirrors methods.init()
  useEffect(() => { loadCounter(-1, sess.pagecount, "", "", 1); }, []); // eslint-disable-line

  // ─────────────────────────────────────────────────────────────────────────
  // updateCell — mirrors updaterow handler: newdata.EditMode = 1
  // ─────────────────────────────────────────────────────────────────────────
  const updateCell = useCallback((idx, field, value) => {
    setGrid(prev => {
      const updated = prev.map((r, i) => i === idx ? { ...r, [field]: value, [grdEditMode]: 1 } : r);
      gridRef.current = updated;
      return updated;
    });
  }, []);

  const updateCells = useCallback((idx, fields) => {
    setGrid(prev => {
      const updated = prev.map((r, i) => i === idx ? { ...r, ...fields, [grdEditMode]: 1 } : r);
      gridRef.current = updated;
      return updated;
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Addrowfunc — mirrors methods.Addrowfunc()
  // ─────────────────────────────────────────────────────────────────────────
  const addRow = useCallback(() => {
    const newRow = makeNewRow();
    setGrid(prev => {
      const next = [...prev, newRow];
      gridRef.current = next;
      const idx = next.length - 1;
      setSelIdx(idx);
      setSelCol(grdSupplierName);
      focusCell(idx, grdSupplierName);
      return next;
    });
  }, [focusCell]);

  // ─────────────────────────────────────────────────────────────────────────
  // gridemptycheck — mirrors methods.gridemptycheck()
  // ─────────────────────────────────────────────────────────────────────────
  const gridemptycheck = useCallback((g) => {
    let cleaned = [...g];
    // mirrors: if last row AccountName is empty and rowcount > 1 → delete it
    const last = cleaned[cleaned.length - 1];
    if (cleaned.length > 1 && (!last[grdSupplierName] || last[grdSupplierName] === "")) {
      cleaned = cleaned.slice(0, -1);
    }
    // mirrors: for loop — check EditMode==1 rows for empty name
    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i][grdEditMode] === 1) {
        if (!cleaned[i][grdSupplierName] || cleaned[i][grdSupplierName] === "") {
          toast("❌ Enter All Supplier Name in the Grid !!!", true);
          setSelIdx(i); setSelCol(grdSupplierName);
          focusCell(i, grdSupplierName);
          return { ok: false, cleaned };
        }
      }
    }
    return { ok: true, cleaned };
  }, [toast, focusCell]);

  // ─────────────────────────────────────────────────────────────────────────
  // CheckDuplicate — mirrors CheckDuplicate(gridSupplier, grdSupplierName, "Customer Name")
  // ─────────────────────────────────────────────────────────────────────────
  const checkDuplicate = useCallback((g, field, label) => {
    const seen = {};
    for (let i = 0; i < g.length; i++) {
      const val = String(g[i][field] || "").trim().toLowerCase();
      if (!val) continue;
      if (seen[val]) {
        toast(`❌ Duplicate ${label} Found !!!.`, true);
        setSelIdx(i); setSelCol(field);
        focusCell(i, field);
        return false;
      }
      seen[val] = true;
    }
    return true;
  }, [toast, focusCell]);

  // ─────────────────────────────────────────────────────────────────────────
  // deleteRow — mirrors keyCode===46 handler in gridSupplier keydown
  // ─────────────────────────────────────────────────────────────────────────
  const deleteRow = useCallback(async (idx) => {
    const row   = gridRef.current[idx];
    if (!row) return;
    const value = row[grdId];

    if (value != null && value !== 0) {
      // mirrors: if (pagedelete == 1)
      if (sess.perm.Delete !== 1 && sess.perm.Delete !== true) {
        toast("❌ Page Delete Permission Denied !!!.", true);
        return;
      }
      const name = row[grdSupplierName];
      const ok   = await confirm(`Wish to Delete the Record ${name}?`);
      if (!ok) return;

      setLoading(true);
      const res = await api("/Supplier/DeleteSupplier", {
        Id:          parseInt(value),
        AccountType: "CUSTOMER",
        Comid:       parseInt(sess.Comid),
        MirrorTable: parseInt(sess.MirrorTable),
      }, {
        IdComList:   String(sess.IdComList),
        ComCustomer: String(sess.ComCustomer),
      });
      setLoading(false);

      if (res.ok) {
        toast("✅ " + (res.message || "Deleted"));
        setGrid(prev => {
          const next = prev.filter((_, i) => i !== idx);
          gridRef.current = next;
          const sel = Math.max(0, next.length - 1);
          setSelIdx(sel);
          setSelCol(grdSupplierName);
          focusCell(sel, grdSupplierName);
          return next;
        });
      } else {
        toast(`❌ ${res.message || "Delete failed"}`, true);
      }
    } else {
      // mirrors: DeleteRow with id=0 → just remove from grid
      setGrid(prev => {
        const next = prev.filter((_, i) => i !== idx);
        gridRef.current = next;
        const sel = Math.max(0, next.length - 1);
        setSelIdx(sel);
        setSelCol(grdSupplierName);
        focusCell(sel, grdSupplierName);
        return next;
      });
    }
  }, [sess, confirm, toast, focusCell]);

  // ─────────────────────────────────────────────────────────────────────────
  // handleSave — mirrors F1 keydown handler
  // URL: /Supplier/InsertSupplier
  // headers: Comid, SupplierMulitipleAllow, AccountTypeNew, MirrorTable, Tamil, IdComList
  // ─────────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    let flag = 1;
    const { perm, Comid, MirrorTable, IdComList, SupplierMulitipleAllow, CustomerNameTamil, ComCustomer } = sess;

    if (perm.Add === 0 && perm.Edit === 0) {
      toast("❌ Page Add & Update Permission Denied !!!.", true);
      flag = 0;
    }

    const { ok, cleaned } = gridemptycheck(gridRef.current);
    if (!ok) return;
    if (flag === 0) { setGrid(cleaned); gridRef.current = cleaned; addRow(); return; }

    let getdata = [];
    if (perm.Add === 1 && perm.Edit === 1) {
      getdata = cleaned.filter(r => r[grdEditMode] === 1);
      if (!getdata.length) { toast("⚠️ No Data Modified,Cannot Update !!!.", true); flag = 0; }
    } else if (perm.Add === 1 && perm.Edit === 0) {
      getdata = cleaned.filter(r => r[grdEditMode] === 1 && r[grdId] == null);
      if (!getdata.length) {
        const tmp = cleaned.filter(r => r[grdEditMode] === 1);
        toast(tmp.length ? "❌ Page Edit Permission Denied !!!." : "⚠️ No Data Modified,Cannot Update !!!.", true);
        flag = 0;
      }
    } else if (perm.Edit === 1 && perm.Add === 0) {
      getdata = cleaned.filter(r => r[grdEditMode] === 1 && r[grdId] != null);
      if (!getdata.length) {
        const tmp = cleaned.filter(r => r[grdEditMode] === 1);
        toast(tmp.length ? "❌ Page Add Permission Denied !!!." : "⚠️ No Data Modified,Cannot Update !!!.", true);
        flag = 0;
      }
    }

    if (flag === 0) { setGrid(cleaned); gridRef.current = cleaned; addRow(); return; }

    // mirrors: gridemptycheck again after filtering
    const check2 = gridemptycheck(cleaned);
    if (!check2.ok) return;

    // mirrors: SupplierMulitipleAllow == false → CheckDuplicate
    if (!SupplierMulitipleAllow) {
      if (!checkDuplicate(cleaned, grdSupplierName, "Customer Name")) return;
    }

    const proceed = await confirm("Do you Want to Save the Customer Details?");
    if (!proceed) { addRow(); return; }

    // strip _uid before sending
    const cleanData = getdata.map(({ _uid, ...rest }) => rest);

    setLoading(true);
    const res = await insertapi("/Supplier/InsertSupplier", cleanData, {
      Comid:                  String(Comid),
      SupplierMulitipleAllow: String(SupplierMulitipleAllow),
      AccountTypeNew:         "CUSTOMER",
      MirrorTable:            String(MirrorTable),
      Tamil:                  String(CustomerNameTamil),
      IdComList:              String(IdComList),
    });
    setLoading(false);

    if (res.ok || res.IsSuccess) {
      toast("✅ " + (res.message || "Saved successfully!"));
      // mirrors: if POPStatus == "ON" → set POPValue/POPName, close dialog
      if (sessionStorage.getItem("POPStatus") === "ON") {
        sessionStorage.setItem("POPValue", String(res.Id || ""));
        sessionStorage.setItem("POPName",  res.Name || "");
        sessionStorage.setItem("POPStatus", "OFF");
        // mirrors: window.parent.$('.ui-dialog-content:visible').dialog('close')
        try { window.parent.postMessage({ action: "closeDialog" }, "*"); } catch {}
      }
      loadCounter(0, sess.pagecount, "", "", 1);
    } else {
      toast(`❌ ${res.message || "Save failed"}`, true);
    }
  }, [sess, gridemptycheck, checkDuplicate, addRow, loadCounter, confirm, toast]);

  // ─────────────────────────────────────────────────────────────────────────
  // handleEsc — mirrors Esc keyCode 27
  // ─────────────────────────────────────────────────────────────────────────
  const handleEsc = useCallback(async () => {
    // mirrors: if TamilNameWindow open → close it
    if (tamilPopup.open) { setTamilPopup({ open:false, rowIdx:null, value:"" }); return; }
    const ok = await confirm("Do You Want To Quit Page?");
    if (ok) {
      if (sessionStorage.getItem("POPStatus") === "ON") {
        sessionStorage.setItem("POPValue",  "-1");
        sessionStorage.setItem("POPStatus", "OFF");
        try { window.parent.postMessage({ action: "closeDialog" }, "*"); } catch {}
      } else {
        window.location.href = "/Home";
      }
    }
  }, [tamilPopup.open, confirm]);

  // ─────────────────────────────────────────────────────────────────────────
  // Popup loaders — mirrors AreaList, SalesManList, etc.
  // ─────────────────────────────────────────────────────────────────────────
  const openAreaPopup = useCallback(async (rowIdx) => {
    const res = await api("/Area/SelectArea", { Comid: parseInt(sess.MComid) });
    const items = Array.isArray(res.data) ? res.data : [];
    const curVal = NullToString(gridRef.current[rowIdx]?.[grdArea]);
    setAreaPopup({ open:true, items, rowIdx, prefill: curVal });
  }, [sess.MComid]);

  const openSalesManPopup = useCallback(async (rowIdx) => {
    const res = await api("/SalesMan/SelectSalesMan", { Comid: parseInt(sess.MComid) });
    const items = Array.isArray(res.data) ? res.data : [];
    const curVal = NullToString(gridRef.current[rowIdx]?.[grdSalesMan]);
    setSalesmanPopup({ open:true, items, rowIdx, prefill: curVal });
  }, [sess.MComid]);

  const openCardPopup = useCallback(async (rowIdx) => {
    const res = await api("/CustomerCardType/SelectCustomerCardType", { Comid: parseInt(sess.MComid) });
    const items = Array.isArray(res.data) ? res.data : [];
    const curVal = NullToString(gridRef.current[rowIdx]?.[grdcustomercardtype]);
    setCardPopup({ open:true, items, rowIdx, prefill: curVal });
  }, [sess.MComid]);

  const openBranchPopup = useCallback(async (rowIdx) => {
    const res = await api("/StockTransfer/SelectCompany", {
      Comid: parseInt(sess.Comid), MComid: parseInt(sess.MComid),
    });
    const items = Array.isArray(res.data) ? res.data : [];
    const curVal = NullToString(gridRef.current[rowIdx]?.[grdBranchName]);
    setBranchPopup({ open:true, items, rowIdx, prefill: curVal });
  }, [sess.Comid, sess.MComid]);

  const openTamilPopup = useCallback((rowIdx) => {
    const curVal = NullToString(gridRef.current[rowIdx]?.[grdCustomerNameTamil]);
    setTamilPopup({ open:true, rowIdx, value: curVal });
    setTimeout(() => tamilInputRef.current?.focus(), 100);
  }, []);

  // ── Area selected ─────────────────────────────────────────────────────────
  const onAreaSelect = useCallback((item) => {
    const idx = areaPopup.rowIdx;
    updateCells(idx, { [grdArea]: item.AreaName, [grdAreaId]: item.Id });
    setAreaPopup({ open:false, items:[], rowIdx:null });
    // mirrors: GirdNextCell → move to SalesMan
    setSelCol(grdSalesMan);
    focusCell(idx, grdSalesMan);
  }, [areaPopup.rowIdx, updateCells, focusCell]);

  const onAreaEnterEmpty = useCallback(() => {
    const idx = areaPopup.rowIdx;
    setAreaPopup({ open:false, items:[], rowIdx:null });
    setSelIdx(idx); setSelCol(grdSalesMan);
    focusCell(idx, grdSalesMan);
  }, [areaPopup.rowIdx, focusCell]);

  // ── SalesMan selected ─────────────────────────────────────────────────────
  const onSalesManSelect = useCallback((item) => {
    const idx = salesmanPopup.rowIdx;
    updateCells(idx, { [grdSalesMan]: item.SalesManName, [grdSalesManId]: item.Id });
    setSalesmanPopup({ open:false, items:[], rowIdx:null });
    // mirrors: GirdNextCell → move to Address1
    setSelCol(grdAddress1);
    focusCell(idx, grdAddress1);
  }, [salesmanPopup.rowIdx, updateCells, focusCell]);

  const onSalesManEnterEmpty = useCallback(() => {
    const idx = salesmanPopup.rowIdx;
    setSalesmanPopup({ open:false, items:[], rowIdx:null });
    setSelIdx(idx); setSelCol(grdAddress1);
    focusCell(idx, grdAddress1);
  }, [salesmanPopup.rowIdx, focusCell]);

  // ── CustomerCard selected ─────────────────────────────────────────────────
  const onCardSelect = useCallback((item) => {
    const idx = cardPopup.rowIdx;
    updateCells(idx, { [grdcustomercardtype]: item.TypeName, [grdcustomercardtypeId]: item.Id });
    setCardPopup({ open:false, items:[], rowIdx:null });
    // mirrors: GirdNextCell → move to Active
    setSelCol(grdActive);
    focusCell(idx, grdActive);
  }, [cardPopup.rowIdx, updateCells, focusCell]);

  const onCardEnterEmpty = useCallback(() => {
    const idx = cardPopup.rowIdx;
    setCardPopup({ open:false, items:[], rowIdx:null });
    setSelIdx(idx); setSelCol(grdActive);
    focusCell(idx, grdActive);
  }, [cardPopup.rowIdx, focusCell]);

  // ── Branch selected ───────────────────────────────────────────────────────
  const onBranchSelect = useCallback((item) => {
    const idx = branchPopup.rowIdx;
    updateCells(idx, { [grdBranchName]: item.BranchName, [grdBranchCompanyRefid]: item.Id });
    setBranchPopup({ open:false, items:[], rowIdx:null });
    // mirrors: GirdNextCell
    setSelCol(grdAddress1);
    focusCell(idx, grdAddress1);
  }, [branchPopup.rowIdx, updateCells, focusCell]);

  const onBranchEnterEmpty = useCallback(() => {
    const idx = branchPopup.rowIdx;
    setBranchPopup({ open:false, items:[], rowIdx:null });
    setSelIdx(idx); setSelCol(grdAddress1);
    focusCell(idx, grdAddress1);
  }, [branchPopup.rowIdx, focusCell]);

  // ── Tamil name confirmed ──────────────────────────────────────────────────
  const onTamilConfirm = useCallback(() => {
    const { rowIdx, value } = tamilPopup;
    updateCells(rowIdx, { [grdCustomerNameTamil]: value });
    setTamilPopup({ open:false, rowIdx:null, value:"" });
    focusCell(rowIdx, grdSupplierName);
  }, [tamilPopup, updateCells, focusCell]);

  // ─────────────────────────────────────────────────────────────────────────
  // Visible columns for navigation order — mirrors Widthdatacolumns (pinned==false, hidden==false)
  // ─────────────────────────────────────────────────────────────────────────
  const columnNavOrder = [
    grdSupplierName, grdArea, grdSalesMan,
    grdAddress1, grdAddress2, grdCity,
    grdMobileNo, grdGSTINNo,
    grdCreditBillDays, grdCreditBillLimit, grdOpeningBalance,
    grdcustomercardtype, grdActive,
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // GirdNextCell equivalent — moves to next visible column or next row
  // ─────────────────────────────────────────────────────────────────────────
  const moveNext = useCallback((rowIdx, columnname) => {
    const colIdx = columnNavOrder.indexOf(columnname);
    if (colIdx < columnNavOrder.length - 1) {
      const nextCol = columnNavOrder[colIdx + 1];
      setSelCol(nextCol);
      focusCell(rowIdx, nextCol);
    } else {
      // last column → move to next row or add row
      if (rowIdx >= gridRef.current.length - 1) {
        addRow();
      } else {
        const nextIdx = rowIdx + 1;
        setSelIdx(nextIdx);
        setSelCol(columnNavOrder[0]);
        focusCell(nextIdx, columnNavOrder[0]);
      }
    }
  }, [columnNavOrder, addRow, focusCell]);

  // ─────────────────────────────────────────────────────────────────────────
  // handleCellKeyDown — mirrors gridSupplier.bind('keydown') Enter handler
  // ─────────────────────────────────────────────────────────────────────────
  const handleCellKeyDown = useCallback((e, idx, columnname) => {
    const key = e.charCode ? e.charCode : e.keyCode ? e.keyCode : 0;

    // mirrors: key == 8 → trigger keypress (handled by onChange)
    // mirrors: key === 46 (Delete) → deleteRow
    if (e.keyCode === 46 && e.ctrlKey) { e.preventDefault(); deleteRow(idx); return; }

    if (e.key !== "Enter" && key !== 13) return;
    e.preventDefault();

    const row   = gridRef.current[idx];
    if (!row) return;
    const value = row[columnname];

    // mirrors: if (rowindex == -1) → filter search
    // handled separately in filter row

    if (columnname === grdSupplierName) {
      // mirrors: if (value == null || value == "") → MsgBox
      if (!value || value === "") { toast("❌ Enter Customer Name!!!.", true); return; }
      // mirrors: SupplierMulitipleAllow == false → CheckDuplicate
      if (!sess.SupplierMulitipleAllow) {
        if (!checkDuplicate(gridRef.current, grdSupplierName, "Customer Name")) return;
      }
      moveNext(idx, columnname);
    } else if (columnname === grdArea) {
      // mirrors: AreaList + AreaWindow open
      openAreaPopup(idx);
    } else if (columnname === grdSalesMan) {
      // mirrors: SalesManList + SaleManWindow open
      openSalesManPopup(idx);
    } else if (columnname === grdcustomercardtype) {
      // mirrors: CustomerCardrList + CustomerCardWindow open
      openCardPopup(idx);
    } else if (columnname === grdBranchName) {
      // mirrors: GirdNextCell (branch name is read-only navigation)
      moveNext(idx, columnname);
    } else if (columnname === grdGroupName) {
      moveNext(idx, columnname);
    } else if (columnname === grdOpeningBalance || columnname === grdCreditBillLimit) {
      // mirrors: setcellvalue to toFixed(2) then GirdNextCell
      updateCell(idx, columnname, parseFloat(value || 0).toFixed(2));
      moveNext(idx, columnname);
    } else {
      moveNext(idx, columnname);
    }
  }, [sess, toast, checkDuplicate, moveNext, openAreaPopup, openSalesManPopup, openCardPopup, deleteRow, updateCell]);

  // ─────────────────────────────────────────────────────────────────────────
  // Filter logic — mirrors jQuery filter row + loadCounter keyword search
  // ─────────────────────────────────────────────────────────────────────────
  const handleFilterSearch = useCallback((e) => {
    if (e.key === "Enter") {
      if (filterSearch.trim() !== "") {
        loadCounter(0, 0, filterSearch, filterColumn, 1);
      }
    }
  }, [filterSearch, filterColumn, loadCounter]);

  // mirrors: F2 → loadCounter(-1, pagecount, "Active", "Active", 1)
  const handleF2 = useCallback(() => {
    loadCounter(-1, sess.pagecount, "Active", "Active", 1);
  }, [sess.pagecount, loadCounter]);

  // mirrors: F5 → BranchWindow open
  const handleF5 = useCallback(() => {
    const idx = selIdx ?? (gridRef.current.length - 1);
    openBranchPopup(idx);
  }, [selIdx, openBranchPopup]);

  // mirrors: F6 → TamilWindow open
  const handleF6 = useCallback(() => {
    const idx = selIdx ?? (gridRef.current.length - 1);
    openTamilPopup(idx);
  }, [selIdx, openTamilPopup]);

  // ── Global keydown — mirrors $(document).on('keydown') ───────────────────
  useEffect(() => {
    const onKey = (e) => {
      const anyPopupOpen = areaPopup.open || salesmanPopup.open || cardPopup.open || branchPopup.open;
      if (anyPopupOpen) return; // popups handle their own keys

      if (e.keyCode === 112) { e.preventDefault(); handleSave(); }   // F1
      if (e.keyCode === 113) { e.preventDefault(); handleF2(); }     // F2
      if (e.keyCode === 116) { e.preventDefault(); handleF5(); }     // F5
      if (e.keyCode === 117) { e.preventDefault(); handleF6(); }     // F6
      if (e.keyCode === 27)  { e.preventDefault(); handleEsc(); }    // Esc
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleF2, handleF5, handleF6, handleEsc, areaPopup.open, salesmanPopup.open, cardPopup.open, branchPopup.open]);

  // ─────────────────────────────────────────────────────────────────────────
  // Filtered grid for display — mirrors jQuery filterable grid
  // ─────────────────────────────────────────────────────────────────────────
  const displayGrid = grid.filter(row => {
    if (activeFilter === "active" && row[grdActive] === false) return false;
    return true;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Pagination — mirrors render(curPage, item) + holder click
  // ─────────────────────────────────────────────────────────────────────────
  const pageNumbers = Array.from({ length: pageLen }, (_, i) => i + 1);

  const handlePageClick = useCallback((page) => {
    setCurPage(page);
    const startIndex = (page - 1) * sess.pagecount;
    loadCounter(startIndex, sess.pagecount, "", "", 0);
  }, [sess.pagecount, loadCounter]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  const anyPopupOpen = areaPopup.open || salesmanPopup.open || cardPopup.open || branchPopup.open || tamilPopup.open;

  return (
    <div className="mp-wrap">
      {ConfirmUI}
      <Topbar />
      {/* ── Area Popup ── */}
      {areaPopup.open && (
        <PopupWindow title="Area" onClose={() => { setAreaPopup({ open:false, items:[], rowIdx:null }); }}>
          <SearchableList
            items={areaPopup.items}
            labelField="AreaName"
            value={areaPopup.prefill || ""}
            onChange={onAreaSelect}
            onClose={() => setAreaPopup({ open:false, items:[], rowIdx:null })}
            onEnterEmpty={onAreaEnterEmpty}
            searchPlaceholder="Search Area"
            inputRef={popupInputRef}
            listRef={popupListRef}
          />
        </PopupWindow>
      )}

      {/* ── SalesMan Popup ── */}
      {salesmanPopup.open && (
        <PopupWindow title="Sales Man" onClose={() => setSalesmanPopup({ open:false, items:[], rowIdx:null })}>
          <SearchableList
            items={salesmanPopup.items}
            labelField="SalesManName"
            value={salesmanPopup.prefill || ""}
            onChange={onSalesManSelect}
            onClose={() => setSalesmanPopup({ open:false, items:[], rowIdx:null })}
            onEnterEmpty={onSalesManEnterEmpty}
            searchPlaceholder="Search Sales Man"
            inputRef={popupInputRef}
            listRef={popupListRef}
          />
        </PopupWindow>
      )}

      {/* ── Customer Card Popup ── */}
      {cardPopup.open && (
        <PopupWindow title="Customer Card Type" onClose={() => setCardPopup({ open:false, items:[], rowIdx:null })}>
          <SearchableList
            items={cardPopup.items}
            labelField="TypeName"
            value={cardPopup.prefill || ""}
            onChange={onCardSelect}
            onClose={() => setCardPopup({ open:false, items:[], rowIdx:null })}
            onEnterEmpty={onCardEnterEmpty}
            searchPlaceholder="Search Customer Card"
            inputRef={popupInputRef}
            listRef={popupListRef}
          />
        </PopupWindow>
      )}

      {/* ── Branch Popup ── */}
      {branchPopup.open && (
        <PopupWindow title="Branch" onClose={() => setBranchPopup({ open:false, items:[], rowIdx:null })}>
          <SearchableList
            items={branchPopup.items}
            labelField="BranchName"
            value={branchPopup.prefill || ""}
            onChange={onBranchSelect}
            onClose={() => setBranchPopup({ open:false, items:[], rowIdx:null })}
            onEnterEmpty={onBranchEnterEmpty}
            searchPlaceholder="Search Branch"
            inputRef={popupInputRef}
            listRef={popupListRef}
          />
        </PopupWindow>
      )}

      {/* ── Tamil Name Popup (F6) ── */}
      {tamilPopup.open && (
        <PopupWindow title="Tamil Name" width={440} onClose={() => setTamilPopup({ open:false, rowIdx:null, value:"" })}>
          <div style={{ padding:12, display:"flex", gap:8 }}>
            <input
              ref={tamilInputRef}
              style={{ flex:1, padding:"4px 8px", fontSize:13, border:"1px solid #cbd5e1", borderRadius:4 }}
              placeholder="TamilName"
              value={tamilPopup.value}
              onChange={e => setTamilPopup(p => ({ ...p, value: e.target.value }))}
              onKeyDown={e => {
                if (e.key === "Enter") onTamilConfirm();
                if (e.key === "Escape") setTamilPopup({ open:false, rowIdx:null, value:"" });
              }}
              autoFocus
            />
            <button style={{ padding:"4px 12px", background:"#1e40af", color:"#fff", border:"none", borderRadius:4, cursor:"pointer" }} onClick={onTamilConfirm}>✓</button>
          </div>
        </PopupWindow>
      )}

      {/* ── Header ── */}
      {/* <div className="mp-hdr">
        <div className="mp-hdr-left">
          <div className="mp-icon">C</div>
          <div>
            <div className="mp-title">Customer Master</div>
            <div className="mp-sub">Co: {sess.Comid} — Manage customer records • {pagecountnew} records</div>
          </div>
        </div>
        <button className="mp-back" onClick={handleEsc}>← Back</button>
      </div> */}

      <div className="mp-body">
        {/* ── Toolbar ── */}
        <div className="mp-toolbar" style={{ flexWrap:"wrap", gap:6 }}>
          <button className="mp-btn sv" onClick={handleSave} disabled={loading}>💾 F1 Save</button>
          <button className="mp-btn nw" onClick={addRow}     disabled={loading}>➕ Add Row</button>
          <button className="mp-btn"    onClick={handleF2}   disabled={loading} style={{ background:"#0891b2", color:"#fff" }}>🔍 F2 Active</button>
          <button className="mp-btn"    onClick={handleF5}   disabled={loading} style={{ background:"#7c3aed", color:"#fff" }}>🏢 F5 Branch</button>
          <button className="mp-btn"    onClick={handleF6}   disabled={loading} style={{ background:"#be185d", color:"#fff" }}>🔤 F6 Tamil</button>
          <button className="mp-btn"    onClick={() => loadCounter(-1, sess.pagecount, "", "", 1)} disabled={loading} style={{ background:"#059669", color:"#fff" }}>🔄 Refresh</button>
          <button className="mp-btn dl" onClick={handleEsc}>✕ Esc Cancel</button>

          <div className="mpmp-toolbar-title">Customer Master</div>

          {/* Filter row — mirrors jQuery showfilterrow */}
          <div style={{ display:"flex", gap:4, alignItems:"center", marginLeft:"auto" }}>
            <select
              style={{ padding:"4px 6px", fontSize:12, border:"1px solid #cbd5e1", borderRadius:4 }}
              value={filterColumn}
              onChange={e => setFilterColumn(e.target.value)}
            >
              <option value={grdSupplierName}>Customer Name</option>
              <option value={grdMobileNo}>Mobile No</option>
              <option value={grdGSTINNo}>GSTIN No</option>
              <option value={grdArea}>Area</option>
              <option value={grdCity}>City</option>
              <option value={grdCode}>Code</option>
            </select>
            <input
              style={{ padding:"4px 8px", fontSize:12, border:"1px solid #cbd5e1", borderRadius:4, width:160 }}
              placeholder="Search… (Enter)"
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              onKeyDown={handleFilterSearch}
            />
            <select
              style={{ padding:"4px 6px", fontSize:12, border:"1px solid #cbd5e1", borderRadius:4 }}
              value={activeFilter}
              onChange={e => setActiveFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="active">Active Only</option>
            </select>
          </div>
        </div>

        {/* ── Grid ── */}
        <div className="mp-grid-wrap" style={{ overflowX:"auto" }}>
          <table className="mp-tbl" style={{ minWidth:1400 }}>
            <thead>
              <tr>
                <th style={{ width:45 }}>S.No</th>
                <th style={{ width:180 }}>Customer Name*</th>
                {sess.CustomerNameTamil && <th style={{ width:150 }}>Tamil Name</th>}
                <th style={{ width:90 }}>Code</th>
                <th style={{ width:130 }}>Area</th>
                <th style={{ width:130 }}>Sales Man</th>
                <th style={{ width:150 }}>Address 1</th>
                <th style={{ width:120 }}>Address 2</th>
                <th style={{ width:100 }}>City</th>
                <th style={{ width:90 }}>Mobile No</th>
                <th style={{ width:140 }}>GSTIN No</th>
                <th style={{ width:80 }}>Cr.Days</th>
                <th style={{ width:95 }}>Cr.Limit</th>
                <th style={{ width:95 }}>Opening Bal</th>
                <th style={{ width:130 }}>Card Type</th>
                <th style={{ width:90 }}>IGST Bill</th>
                <th style={{ width:60, textAlign:"center" }}>Active</th>
                <th style={{ width:50 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading && displayGrid.length === 0 ? (
                <tr>
                  <td colSpan={18} style={{ textAlign:"center", padding:20, color:"#888" }}>Loading...</td>
                </tr>
              ) : displayGrid.map((row, idx) => {
                // find real index in full grid
                const realIdx = grid.indexOf(row);
                if (!row) return null;
                const isInactive = row[grdActive] === false || row[grdActive] === 0;
                const isModified = row[grdEditMode] === 1;
                const isSel      = selIdx === realIdx;
                return (
                  <tr
                    key={row._uid}
                    className={[isSel ? "sel" : "", isInactive ? "inact" : "", isModified ? "mod" : ""].filter(Boolean).join(" ")}
                    onClick={() => { setSelIdx(realIdx); }}
                  >
                    <td className="sno">{idx + 1}</td>

                    {/* Customer Name */}
                    <td>
                      <input
                        ref={el => (inputRefs.current[`${realIdx}-${grdSupplierName}`] = el)}
                        className="mp-cell-input"
                        value={row[grdSupplierName] || ""}
                        maxLength={500}
                        onChange={e => updateCell(realIdx, grdSupplierName, e.target.value.toUpperCase())}
                        onKeyDown={e => handleCellKeyDown(e, realIdx, grdSupplierName)}
                        onFocus={() => { setSelIdx(realIdx); setSelCol(grdSupplierName); }}
                      />
                    </td>

                    {/* Tamil Name (conditional) */}
                    {sess.CustomerNameTamil && (
                      <td>
                        <input
                          ref={el => (inputRefs.current[`${realIdx}-${grdCustomerNameTamil}`] = el)}
                          className="mp-cell-input"
                          value={row[grdCustomerNameTamil] || ""}
                          maxLength={500}
                          readOnly
                          onClick={() => openTamilPopup(realIdx)}
                          onFocus={() => { setSelIdx(realIdx); setSelCol(grdCustomerNameTamil); }}
                          style={{ cursor:"pointer", background:"#f8fafc" }}
                          title="Press F6 to enter Tamil Name"
                        />
                      </td>
                    )}

                    {/* Code */}
                    <td>
                      <input
                        ref={el => (inputRefs.current[`${realIdx}-${grdCode}`] = el)}
                        className="mp-cell-input"
                        value={row[grdCode] || ""}
                        maxLength={50}
                        onChange={e => updateCell(realIdx, grdCode, e.target.value.toUpperCase())}
                        onKeyDown={e => handleCellKeyDown(e, realIdx, grdCode)}
                        onFocus={() => { setSelIdx(realIdx); setSelCol(grdCode); }}
                      />
                    </td>

                    {/* Area — mirrors grdArea combo → popup */}
                    <td>
                      <input
                        ref={el => (inputRefs.current[`${realIdx}-${grdArea}`] = el)}
                        className="mp-cell-input"
                        value={row[grdArea] || ""}
                        readOnly
                        onClick={() => openAreaPopup(realIdx)}
                        onKeyDown={e => handleCellKeyDown(e, realIdx, grdArea)}
                        onFocus={() => { setSelIdx(realIdx); setSelCol(grdArea); }}
                        style={{ cursor:"pointer", background:"#f8fafc" }}
                        title="Press Enter to select Area"
                      />
                    </td>

                    {/* Sales Man — mirrors grdSalesMan combo → popup */}
                    <td>
                      <input
                        ref={el => (inputRefs.current[`${realIdx}-${grdSalesMan}`] = el)}
                        className="mp-cell-input"
                        value={row[grdSalesMan] || ""}
                        readOnly
                        onClick={() => openSalesManPopup(realIdx)}
                        onKeyDown={e => handleCellKeyDown(e, realIdx, grdSalesMan)}
                        onFocus={() => { setSelIdx(realIdx); setSelCol(grdSalesMan); }}
                        style={{ cursor:"pointer", background:"#f8fafc" }}
                        title="Press Enter to select Sales Man"
                      />
                    </td>

                    {/* Address1 */}
                    <td>
                      <input
                        ref={el => (inputRefs.current[`${realIdx}-${grdAddress1}`] = el)}
                        className="mp-cell-input"
                        value={row[grdAddress1] || ""}
                        maxLength={500}
                        onChange={e => updateCell(realIdx, grdAddress1, e.target.value)}
                        onKeyDown={e => handleCellKeyDown(e, realIdx, grdAddress1)}
                        onFocus={() => { setSelIdx(realIdx); setSelCol(grdAddress1); }}
                      />
                    </td>

                    {/* Address2 */}
                    <td>
                      <input
                        ref={el => (inputRefs.current[`${realIdx}-${grdAddress2}`] = el)}
                        className="mp-cell-input"
                        value={row[grdAddress2] || ""}
                        maxLength={500}
                        onChange={e => updateCell(realIdx, grdAddress2, e.target.value)}
                        onKeyDown={e => handleCellKeyDown(e, realIdx, grdAddress2)}
                        onFocus={() => { setSelIdx(realIdx); setSelCol(grdAddress2); }}
                      />
                    </td>

                    {/* City */}
                    <td>
                      <input
                        ref={el => (inputRefs.current[`${realIdx}-${grdCity}`] = el)}
                        className="mp-cell-input"
                        value={row[grdCity] || ""}
                        maxLength={500}
                        onChange={e => updateCell(realIdx, grdCity, e.target.value)}
                        onKeyDown={e => handleCellKeyDown(e, realIdx, grdCity)}
                        onFocus={() => { setSelIdx(realIdx); setSelCol(grdCity); }}
                      />
                    </td>

                    {/* Mobile No */}
                    <td>
                      <input
                        ref={el => (inputRefs.current[`${realIdx}-${grdMobileNo}`] = el)}
                        className="mp-cell-input"
                        value={row[grdMobileNo] || ""}
                        maxLength={50}
                        onChange={e => updateCell(realIdx, grdMobileNo, e.target.value.replace(/\D/g, ""))}
                        onKeyDown={e => handleCellKeyDown(e, realIdx, grdMobileNo)}
                        onFocus={() => { setSelIdx(realIdx); setSelCol(grdMobileNo); }}
                      />
                    </td>

                    {/* GSTIN No */}
                    <td>
                      <input
                        ref={el => (inputRefs.current[`${realIdx}-${grdGSTINNo}`] = el)}
                        className="mp-cell-input"
                        value={row[grdGSTINNo] || ""}
                        maxLength={50}
                        onChange={e => updateCell(realIdx, grdGSTINNo, e.target.value.toUpperCase())}
                        onKeyDown={e => handleCellKeyDown(e, realIdx, grdGSTINNo)}
                        onFocus={() => { setSelIdx(realIdx); setSelCol(grdGSTINNo); }}
                      />
                    </td>

                    {/* Credit Bill Days */}
                    <td>
                      <input
                        ref={el => (inputRefs.current[`${realIdx}-${grdCreditBillDays}`] = el)}
                        className="mp-cell-input"
                        value={row[grdCreditBillDays] || "0"}
                        maxLength={8}
                        style={{ textAlign:"right" }}
                        onChange={e => updateCell(realIdx, grdCreditBillDays, e.target.value.replace(/\D/g, ""))}
                        onKeyDown={e => handleCellKeyDown(e, realIdx, grdCreditBillDays)}
                        onFocus={() => { setSelIdx(realIdx); setSelCol(grdCreditBillDays); }}
                      />
                    </td>

                    {/* Credit Bill Limit */}
                    <td>
                      <input
                        ref={el => (inputRefs.current[`${realIdx}-${grdCreditBillLimit}`] = el)}
                        className="mp-cell-input"
                        value={row[grdCreditBillLimit] || "0.00"}
                        maxLength={18}
                        style={{ textAlign:"right" }}
                        onChange={e => updateCell(realIdx, grdCreditBillLimit, e.target.value)}
                        onKeyDown={e => handleCellKeyDown(e, realIdx, grdCreditBillLimit)}
                        onBlur={e => updateCell(realIdx, grdCreditBillLimit, parseFloat(e.target.value || 0).toFixed(2))}
                        onFocus={() => { setSelIdx(realIdx); setSelCol(grdCreditBillLimit); }}
                      />
                    </td>

                    {/* Opening Balance */}
                    <td>
                      <input
                        ref={el => (inputRefs.current[`${realIdx}-${grdOpeningBalance}`] = el)}
                        className="mp-cell-input"
                        value={row[grdOpeningBalance] || "0.00"}
                        maxLength={18}
                        style={{ textAlign:"right" }}
                        onChange={e => updateCell(realIdx, grdOpeningBalance, e.target.value)}
                        onKeyDown={e => handleCellKeyDown(e, realIdx, grdOpeningBalance)}
                        onBlur={e => updateCell(realIdx, grdOpeningBalance, parseFloat(e.target.value || 0).toFixed(2))}
                        onFocus={() => { setSelIdx(realIdx); setSelCol(grdOpeningBalance); }}
                      />
                    </td>

                    {/* Customer Card Type — mirrors grdcustomercardtype combo → popup */}
                    <td>
                      <input
                        ref={el => (inputRefs.current[`${realIdx}-${grdcustomercardtype}`] = el)}
                        className="mp-cell-input"
                        value={row[grdcustomercardtype] || ""}
                        readOnly
                        onClick={() => openCardPopup(realIdx)}
                        onKeyDown={e => handleCellKeyDown(e, realIdx, grdcustomercardtype)}
                        onFocus={() => { setSelIdx(realIdx); setSelCol(grdcustomercardtype); }}
                        style={{ cursor:"pointer", background:"#f8fafc" }}
                      />
                    </td>

                    {/* IGST Bill — mirrors grdIGSTBill combobox (GST/IGST) */}
                    <td>
                      <select
                        ref={el => (inputRefs.current[`${realIdx}-${grdIGSTBill}`] = el)}
                        className="mp-cell-select"
                        value={row[grdIGSTBill] || "GST"}
                        onChange={e => updateCell(realIdx, grdIGSTBill, e.target.value)}
                        onFocus={() => { setSelIdx(realIdx); setSelCol(grdIGSTBill); }}
                      >
                        <option value="GST">GST</option>
                        <option value="IGST">IGST</option>
                      </select>
                    </td>

                    {/* Active — mirrors grdActive checkbox */}
                    <td style={{ textAlign:"center" }}>
                      <select
                        ref={el => (inputRefs.current[`${realIdx}-${grdActive}`] = el)}
                        className="mp-active-sel"
                        value={row[grdActive] === true || row[grdActive] === 1 ? "1" : "0"}
                        onChange={e => updateCell(realIdx, grdActive, e.target.value === "1")}
                        onKeyDown={e => handleCellKeyDown(e, realIdx, grdActive)}
                        onFocus={() => { setSelIdx(realIdx); setSelCol(grdActive); }}
                        title={row[grdActive] ? "Active" : "Inactive"}
                      >
                        <option value="1">✓</option>
                        <option value="0">✗</option>
                      </select>
                    </td>

                    {/* Delete button */}
                    <td>
                      <button
                        className="mp-del-btn"
                        onClick={e => { e.stopPropagation(); deleteRow(realIdx); }}
                        title="Delete (Ctrl+Delete)"
                      >🗑</button>
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

        {/* ── Pagination — mirrors jQuery render() pagination ── */}
        {pageLen > 1 && (
          <div id="holder" style={{ display:"flex", flexWrap:"wrap", gap:4, padding:"8px 0", alignItems:"center" }}>
            {pageNumbers.map(page => (
              <button
                key={page}
                onClick={() => handlePageClick(page)}
                style={{
                  padding:"3px 10px", borderRadius:4, border:"1px solid #cbd5e1",
                  background: curPage === page ? "#1e40af" : "#f8fafc",
                  color:      curPage === page ? "#fff"    : "#374151",
                  fontWeight: curPage === page ? 700 : 400,
                  cursor:"pointer", fontSize:12,
                }}
              >
                {page}
              </button>
            ))}
            <span style={{ color:"navy", fontSize:14, fontWeight:"bold", marginLeft:8 }}>
              Record {pagecountnew}
            </span>
          </div>
        )}

        {/* ── Hint bar ── */}
        <div className="mp-hint">
          <kbd>Enter</kbd> next cell &nbsp;|&nbsp;
          <kbd>Ctrl+Delete</kbd> delete row &nbsp;|&nbsp;
          <kbd>F1</kbd> save &nbsp;|&nbsp;
          <kbd>F2</kbd> active only &nbsp;|&nbsp;
          <kbd>F5</kbd> branch &nbsp;|&nbsp;
          <kbd>F6</kbd> tamil name &nbsp;|&nbsp;
          <kbd>Esc</kbd> back
        </div>
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

      {/* ── Toasts ── */}
      <div className="toasts">
        {toasts.map(t => (
          <div key={t.id} className={`toast${t.isErr ? " err" : ""}`}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}