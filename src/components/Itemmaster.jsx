// ─────────────────────────────────────────────────────────────────────────────
//  ItemMaster.jsx  —  design matches CashierMaster (mp-* classes throughout)
//  All shared utilities via CC.*  |  Enter nav via CC.handleEnterNext
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
 import "../Master/MasterPage.css"   ;
import "../Itemmaster.css";       // ← single shared CSS
import * as CC from "../Master/Common";

// ─── COLUMNS ─────────────────────────────────────────────────────────────────
const COLUMNS = [
  { key:"ProductCode",      label:"Product Code",    width:150 },
  { key:"SecondCode",       label:"Second Code",     width:150, hidden:true },
  { key:"ProductName",      label:"Description",     width:200 },
  { key:"PrinterName",      label:"Printer Name",    width:180, hidden:true },
  { key:"HSNCode",          label:"HSN Code",        width:100, hidden:true },
  { key:"Brand",            label:"Brand",           width:180, hidden:true,  isCombo:true, idField:"BrandId"          },
  { key:"Category",         label:"Category",        width:180,               isCombo:true, idField:"CategoryId"       },
  { key:"Department",       label:"Department",      width:180, hidden:true,  isCombo:true, idField:"DepartmentId"     },
  { key:"Supplier",         label:"Supplier",        width:180, hidden:true,  isCombo:true, idField:"SupplierId"       },
  { key:"UOM",              label:"UOM",             width:150,               isCombo:true, idField:"UOMId"            },
  { key:"LocationMaster",   label:"Location",        width:180, hidden:true,  isCombo:true, idField:"LocationMasterId" },
  { key:"NomsQty",          label:"Noms Qty",        width:90,  type:"int",   hidden:true },
  { key:"MRP",              label:"MRP",             width:90,  type:"f2" },
  { key:"DMPer",            label:"DM%",             width:80,  type:"f2",   hidden:true },
  { key:"DMAmt",            label:"DM Amt",          width:90,  type:"f2",   hidden:true },
  { key:"PurchaseRate",     label:"Purchase Rate",   width:110, type:"f2" },
  { key:"GST",              label:"GST%",            width:80,  type:"f2" },
  { key:"GSTAmt",           label:"GST Amt",         width:90,  type:"f2",   hidden:true },
  { key:"TransPer",         label:"Transport%",      width:100, type:"f2",   hidden:true },
  { key:"TransAmt",         label:"Transport Amt",   width:110, type:"f2",   hidden:true },
  { key:"CESS",             label:"CESS%",           width:80,  type:"f2",   hidden:true },
  { key:"CESSAmt",          label:"CESS Amt",        width:90,  type:"f2",   hidden:true },
  { key:"SPLCESS",          label:"SPL CESS",        width:90,  type:"f2",   hidden:true },
  { key:"LandingCost",      label:"Landing Cost",    width:110, type:"f2",   calc:true },
  { key:"ProfitPer",        label:"Profit%",         width:80,  type:"f2",   hidden:true },
  { key:"ProfitAmt",        label:"Profit Amt",      width:90,  type:"f2",   hidden:true },
  { key:"SalesRate",        label:"Sale Rate",       width:90,  type:"f2" },
  { key:"CardRate",         label:"Card Rate",       width:90,  type:"f2",   hidden:true },
  { key:"WholeSaleRate",    label:"Whole Sale",      width:100, type:"f2",   hidden:true },
  { key:"NomsPCRate",       label:"Noms PC Rate",    width:110, type:"f2",   hidden:true },
  { key:"SalesRateType",    label:"Fixed Rate",      width:90,  bool:true,   hidden:true },
  { key:"SaleDiscountPer",  label:"Sale Disc%",      width:90,  type:"f2",   hidden:true },
  { key:"SaleDiscountAmt",  label:"Sale Disc Amt",   width:110, type:"f2",   hidden:true },
  { key:"ReorderLevelMin",  label:"Reorder Min",     width:100, type:"f2",   hidden:true },
  { key:"ReorderLevelMax",  label:"Reorder Max",     width:100, type:"f2",   hidden:true },
  { key:"MaxSaleQty",       label:"Max Sale Qty",    width:100, type:"f2",   hidden:true },
  { key:"LessAmt",          label:"Less Amt",        width:90,  type:"f2",   hidden:true },
  { key:"StockNeed",        label:"Stock Need",      width:90,  bool:true,   hidden:true },
  { key:"ExpriyDate",       label:"Expiry Date",     width:100, bool:true,   hidden:true },
  { key:"OnlineShow",       label:"Online Show",     width:100, bool:true,   hidden:true },
  { key:"ExpriyDays",       label:"Expiry Days",     width:100, type:"int",  hidden:true },
  { key:"ExpiryBeforeDays", label:"Exp Before Days", width:120, type:"int",  hidden:true },
  { key:"ManufactureDate",  label:"Mfg Date",        width:100, bool:true,   hidden:true },
  { key:"Repacking",        label:"Repacking",       width:90,  bool:true,   hidden:true },
  { key:"NetWeight",        label:"Net Weight",      width:90,  type:"f3",   hidden:true },
  { key:"BrandType",        label:"Brand Type",      width:90,  bool:true,   hidden:true },
  { key:"ModelType",        label:"Model Type",      width:90,  bool:true,   hidden:true },
  { key:"ColorType",        label:"Color Type",      width:90,  bool:true,   hidden:true },
  { key:"SizeType",         label:"Size Type",       width:90,  bool:true,   hidden:true },
  { key:"GenderType",       label:"Gender Type",     width:90,  bool:true,   hidden:true },
  { key:"SerialNoType",     label:"Serial No Type",  width:110, bool:true,   hidden:true },
  { key:"CRMPoints",        label:"CRM Points",      width:100, type:"f2",   hidden:true },
  { key:"NegativetStock",   label:"Neg Stock",       width:90,  bool:true,   hidden:true },
  { key:"BatchwiseStock",   label:"Batchwise",       width:100, bool:true,   hidden:true },
  { key:"Remarks",          label:"Remarks",         width:150, hidden:true },
  { key:"Active",           label:"Active",          width:70,  bool:true },
];

const ROWS_PER_PAGE   = 20;
const SNO_W           = 44;
const DEL_W           = 44;
const DEFAULT_COLS    = COLUMNS.map(c => ({ key:c.key, label:c.label, width:c.width, visible:!c.hidden }));
const ITEM_DRAFT_KEY  = "itemmaster_draft";
const ITEM_CURSOR_KEY = "itemmaster_cursor";
const CALC_KEYS       = new Set(["PurchaseRate","GST","CESS","TransPer","MRP","ProfitPer","GSTAmt","CESSAmt","TransAmt"]);
const UPPER_KEYS      = new Set(["ProductCode","SecondCode","ProductName","PrinterName","HSNCode","Brand","Category","Department","Supplier","UOM","LocationMaster","Remarks"]);
const FILTER_KEYS     = new Set(["ProductCode","SecondCode","ProductName","PrinterName","HSNCode","Brand","Category","Department","Supplier","UOM","LocationMaster","Remarks"]);
const COMBO_NAV       = { Brand:"/brand-master", Category:"/category-master", Department:"/department-master", Supplier:"/supplier-master", UOM:"/uom-master", LocationMaster:"/location-master" };

let _rid = 1000;
const genRid = () => ++_rid;
const vn  = v => parseFloat(v) || 0;
const ro  = v => Math.round(v * 100) / 100;
const f2  = v => parseFloat(vn(v).toFixed(2));
const ns  = v => (v == null ? "" : String(v));
const F2K = ["MRP","PurchaseRate","GST","GSTAmt","TransPer","TransAmt","CESS","CESSAmt","SPLCESS","LandingCost","ProfitPer","ProfitAmt","SalesRate","WholeSaleRate","SaleDiscountPer","SaleDiscountAmt","ReorderLevelMin","ReorderLevelMax","CRMPoints","DMPer","DMAmt","CardRate","LessAmt","NomsPCRate"];
const F3K = ["NetWeight"];
const INK = ["ExpriyDays","ExpiryBeforeDays","NomsQty"];

const mkEmpty = () => {
  const r = { _rid:genRid(), _isNew:true, _dirty:false };
  COLUMNS.forEach(c => { r[c.key] = c.bool ? false : ""; });
  ["BrandId","CategoryId","DepartmentId","SupplierId","UOMId","LocationMasterId","ProductImage","Id"].forEach(k => { r[k]=""; });
  r.Active=true; r.StockNeed=true; r.SalesRateType=true;
  return r;
};

const fmtRow = obj => {
  const r = { ...obj, _rid:obj._rid||genRid(), _isNew:false, _dirty:false };
  F2K.forEach(k => { if (r[k]!==undefined) r[k]=parseFloat(vn(r[k]).toFixed(2)); });
  F3K.forEach(k => { if (r[k]!==undefined) r[k]=parseFloat(vn(r[k]).toFixed(3)); });
  INK.forEach(k => { if (r[k]!==undefined) r[k]=parseInt(vn(r[k]))||0; });
  return r;
};

function calcRow(row, sess, changedKey) {
  const PR=vn(row.PurchaseRate), MRP=vn(row.MRP), PP=vn(row.ProfitPer);
  let GST,GSTAmt; if(changedKey==="GSTAmt"){GSTAmt=vn(row.GSTAmt);GST=PR>0?ro(GSTAmt/PR*100):0;}else{GST=vn(row.GST);GSTAmt=ro(PR*GST/100);}
  let CESS,CessAmt; if(changedKey==="CESSAmt"){CessAmt=vn(row.CESSAmt);CESS=PR>0?ro(CessAmt/PR*100):0;}else{CESS=vn(row.CESS);CessAmt=ro(PR*CESS/100);}
  let TP,TrAmt; if(changedKey==="TransAmt"){TrAmt=vn(row.TransAmt);TP=PR>0?ro(TrAmt/PR*100):0;}else{TP=vn(row.TransPer);TrAmt=ro(PR*TP/100);}
  const LC=ro(PR+GSTAmt+CessAmt+TrAmt), PA=ro(LC*PP/100);
  const SR=PA!==0?f2(LC+PA):(!row.Id?f2(MRP):(vn(row.SalesRate)||f2(MRP)));
  return { GST:f2(GST),GSTAmt:f2(GSTAmt),CESS:f2(CESS),CESSAmt:f2(CessAmt),TransPer:f2(TP),TransAmt:f2(TrAmt),LandingCost:f2(LC),DMAmt:f2(ro(MRP-LC)),DMPer:MRP>0?f2(ro((MRP-LC)/MRP*100)):0,ProfitAmt:f2(PA),SalesRate:SR,...(sess?.univercell?{MRP:f2(ro(SR))}:{}) };
}

// ── F12 Column Settings Popup ─────────────────────────────────────────────────
function F12Popup({ colSettings, onSave, onClose }) {
  const [local, setLocal] = useState(colSettings.map(s => ({ ...s })));
  return (
    <div className="mp-ov">
      <div className="mp-modal-box" style={{ width:450, maxHeight:"80vh" }}>
        <div className="mp-modal-hdr">
          <span>⚙ Column Settings (F12)</span>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="mp-modal-body">
          <table style={{ borderCollapse:"collapse", width:"100%" }}>
            <thead>
              <tr>{["Column","Visible","Width (px)"].map(h => (
                <th key={h} style={{ background:"#1a2e4a", color:"#fff", padding:"6px 10px", fontSize:11, fontWeight:600, textAlign:"left" }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {local.map(s => (
                <tr key={s.key}>
                  <td style={{ padding:"5px 10px", fontSize:12, borderBottom:"1px solid #eaecf4" }}>{s.label}</td>
                  <td style={{ padding:"5px 10px", textAlign:"center", borderBottom:"1px solid #eaecf4" }}>
                    <input type="checkbox" checked={s.visible} onChange={() => setLocal(p => p.map(x => x.key===s.key ? { ...x, visible:!x.visible } : x))} />
                  </td>
                  <td style={{ padding:"5px 10px", borderBottom:"1px solid #eaecf4" }}>
                    <input type="number" min="40" max="600" value={s.width}
                      style={{ width:70, border:"1px solid #d4dbe8", borderRadius:3, padding:"2px 6px", fontSize:12, textAlign:"right" }}
                      onChange={e => setLocal(p => p.map(x => x.key===s.key ? { ...x, width:parseInt(e.target.value)||x.width } : x))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mp-modal-ftr">
          <button className="mp-btn sv" onClick={() => onSave(local)}>💾 Save</button>
          <button className="mp-btn"    onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Combo Dropdown Popup ──────────────────────────────────────────────────────
function ComboPopup({ ddPop, ddQ, setDdQ, ddFilt, ddHilite, setDdHilite, ddHiliteC, selectDd, handleDdConfirm, isNewValue, onClose }) {
  const srchRef = useRef(null);
  const listRef = useRef(null);
  const hilRef  = useRef(ddHilite);
  useEffect(() => { hilRef.current = ddHilite; }, [ddHilite]);
  useEffect(() => { setTimeout(() => srchRef.current?.focus(), 30); }, []);
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${ddHilite}"]`);
    if (el) el.scrollIntoView({ block:"nearest" });
  }, [ddHilite]);
  return (
    <div className="mp-ov" onClick={e => { if (e.target===e.currentTarget) onClose(); }}>
      <div className="mp-modal-box" style={{ width:340, maxHeight:"65vh" }}>
        <div className="mp-modal-hdr">
          <span>🔽 {ddPop.title}</span>
          <button onClick={onClose}>✕</button>
        </div>
        <input ref={srchRef} value={ddQ}
          onChange={e => { setDdQ(e.target.value); setDdHilite(0); }}
          onKeyDown={e => {
            if (e.key==="ArrowDown")  { e.preventDefault(); setDdHilite(h=>Math.min(h+1,ddFilt.length-1)); }
            if (e.key==="ArrowUp")    { e.preventDefault(); setDdHilite(h=>Math.max(h-1,0)); }
            if (e.key==="Enter")      { e.preventDefault(); if(ddFilt.length>0) selectDd(ddFilt[hilRef.current]??ddFilt[0]); else if(isNewValue) handleDdConfirm(); }
            if (e.key==="Escape")     { e.preventDefault(); onClose(); }
          }}
          placeholder={`Search ${ddPop.title}...`}
          style={{ margin:"7px 8px", width:"calc(100% - 16px)", padding:"5px 8px", border:"1px solid #c5d8f8", borderRadius:4, fontSize:12, outline:"none", boxSizing:"border-box" }}
        />
        <div ref={listRef} style={{ flex:1, overflowY:"auto" }}>
          {ddFilt.length===0
            ? <div className="mp-dd-empty">No results for "{ddQ}"</div>
            : ddFilt.map((item,idx) => (
              <div key={item[ddPop.idKey]} data-idx={idx}
                className={`mp-dd-item${idx===ddHiliteC?" hi":""}`}
                onClick={() => selectDd(item)}
                onMouseEnter={() => setDdHilite(idx)}>
                {item[ddPop.nameKey]}
              </div>
            ))
          }
        </div>
        {isNewValue && COMBO_NAV[ddPop.field] && (
          <div className="mp-dd-create" onClick={handleDdConfirm}>
            ➕ Create new {ddPop.title}: <strong>"{ddQ.trim()}"</strong>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Password Modal ────────────────────────────────────────────────────────────
function PwModal({ title, comid, onOk, onClose }) {
  const [val, setVal] = useState("");
  const verify = async () => {
    if (!val) return;
    const res = await CC.api(CC.LoginPasswordUrl, null, {}, { password:val, type:"EditPassword", Comid:comid });
    if (res.ok??res.IsSuccess??false) { onOk(); onClose(); }
    else window.alert("Invalid Password !!!");
  };
  return (
    <div className="mp-ov">
      <div className="mp-modal-box" style={{ width:280, padding:"20px 24px" }}>
        <div style={{ fontSize:14, fontWeight:700, marginBottom:12, color:"#1f65de" }}>🔐 {title}</div>
        <input type="password" autoFocus value={val}
          onChange={e=>setVal(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter") verify(); if(e.key==="Escape") onClose(); }}
          style={{ width:"100%", padding:"6px 10px", border:"1px solid #c5d8f8", borderRadius:4, fontSize:13, marginBottom:14, outline:"none" }}
          placeholder="Enter password…" />
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button className="mp-btn"    onClick={onClose}>Cancel</button>
          <button className="mp-btn sv" onClick={verify}>OK</button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function ItemMaster() {
  const navigate = useNavigate();

  // ── CC hooks ──────────────────────────────────────────────────────────────
  const { confirm, ConfirmUI } = CC.useConfirm();
  const { toast, toasts }      = CC.useToast();

  // ── Session ───────────────────────────────────────────────────────────────
  const [sess] = useState(() => {
    try {
      const main0 = (CC.getLocal("Mainsetting")    || [{}])[0] || {};
      const com0  = (CC.getLocal("Companysetting") || [{}])[0] || {};
      const Comid = CC.getStr("Comid") || "1";
      const MComid= CC.getStr("MComid") || Comid;
      const IdComList = CC.getStr("IdComList") || Comid;
      const isCC  = !!main0.CommonCompany;
      const isAG  = com0.PCode_Auto===true||com0.PCode_Auto===1||com0.PCode_Auto==="1"||String(com0.PCode_Auto).toLowerCase()==="true";
      return {
        Comid: isCC ? MComid : Comid, MComid, IdComList,
        Tamil:!!main0.ProductNameTamil, CommonCompany:isCC,
        CommonCompanyDiffStock:!!main0.CommonCompanyDiffStock,
        SupplierMulitipleAllow:!!main0.SupplierMulitipleAllow,
        BranchSaleRate:!!main0.BranchWiseSaleRate,
        MulipleMRP:!!com0.MultiMRP, MirrorTable:0,
        LandingCostCompare:!!main0.LandingCostCompare,
        PurchaseProfitSaleRateChange:!!main0.PurchaseProfitSaleRateChange,
        univercell:!!main0.univercell, MultipleUOMBilling:!!main0.MultipleUOMBilling,
        GroupCommission:!!main0.GroupCommission,
        Ecotech:!!main0.Ecotech,
        Productcodeautogen:isAG,
        Productcodedigit:com0.PCode_Digits||0,
        Productcodeprefix:com0.PCode_Prefix||"",
        menudata:(CC.getLocal("menulist")||[]).filter(o=>o.PageName==="Item Master"),
      };
    } catch {
      return { Comid:"1",MComid:"1",IdComList:"1",MirrorTable:0,menudata:[],Productcodeautogen:false,Productcodedigit:0,Productcodeprefix:"" };
    }
  });
  const perm = sess.menudata[0] || { View:1,Add:1,Edit:1,Delete:1 };

  // ── State ─────────────────────────────────────────────────────────────────
  const [cols,       setCols]      = useState(DEFAULT_COLS);
  const [f12Open,    setF12Open]   = useState(false);
  const [rows,       setRows]      = useState([]);
  const [selRid,     setSelRid]    = useState(null);
  const [page,       setPage]      = useState(1);
  const [totCnt,     setTotCnt]    = useState(0);
  const [entryRow,   setEntryRow]  = useState(() => mkEmpty());
  const [colFilters, setColFilters]= useState({});
  const [vErr,       setVErr]      = useState("");
  const [loading,    setLoading]   = useState(false);
  const [ldMsg,      setLdMsg]     = useState("Loading...");

  // dropdowns
  const [brandL,setBrandL]=useState([]);const[catL,setCatL]=useState([]);const[deptL,setDeptL]=useState([]);
  const[deptAll,setDeptAll]=useState([]);const[supL,setSupL]=useState([]);const[uomL,setUomL]=useState([]);const[locL,setLocL]=useState([]);

  // combo popup
  const [ddPop,setDdPop]=useState(null);const[ddQ,setDdQ]=useState("");const[ddCtx,setDdCtx]=useState(null);const[ddHilite,setDdHilite]=useState(0);

  // modals
  const [pw,setPw]=useState(null);
  const [bsrOpen,setBsrOpen]=useState(false);const[bsrRows,setBsrRows]=useState([]);
  const [gcOpen,setGcOpen]=useState(false);const[gcRows,setGcRows]=useState([]);
  const [tnOpen,setTnOpen]=useState(false);const[tnVal,setTnVal]=useState("");
  const [adminOpen,setAdminOpen]=useState(false);const adminRef=useRef(null);

  const gRef      = useRef(null);
  const drag      = useRef({ on:false,x:0,y:0,sl:0,st:0 });
  const rowsRef      = useRef(rows);
const entryRowRef  = useRef(entryRow);
  const entryRefs = useRef({});
  const cellRefs  = useRef({});
  const rowRefs   = useRef([]);      // ← for CC.handleEnterNext (2-D array like CashierMaster)
  const draftOk   = useRef(false);

  // ── Admin dropdown close on outside click ────────────────────────────────
  useEffect(() => {
    if (!adminOpen) return;
    const h = e => { if (adminRef.current && !adminRef.current.contains(e.target)) setAdminOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [adminOpen]);
useEffect(() => { rowsRef.current = rows; },      [rows]);
useEffect(() => { entryRowRef.current = entryRow; }, [entryRow]);
  // ── Derived visible columns ───────────────────────────────────────────────
  const visCols = cols.filter(c => c.visible);

  // All editable keys in visible order (no calc columns)
  const editableKeys = visCols
    .map(vc => COLUMNS.find(c => c.key===vc.key))
    .filter(cd => cd && !cd.calc)
    .map(cd => cd.key);

  // ── rowValidator for CC.handleEnterNext ───────────────────────────────────
  // ItemMaster: a row is "valid enough to advance" when ProductCode is filled
  const rowValidator = useCallback(row =>
    String(row.ProductCode||"").trim().length > 0
  , []);

  // ── Focus helpers ─────────────────────────────────────────────────────────
  const focusEntry = useCallback(colKey => {
    setTimeout(() => { const el=entryRefs.current[colKey]; if(el){el.focus();el.select?.();} }, 0);
  }, []);

  const focusCell = useCallback((rid, colKey) => {
    setTimeout(() => { const el=cellRefs.current[rid]?.[colKey]; if(el){el.focus();el.select?.();} }, 0);
  }, []);

  const regRef = useCallback((rid, colKey, el) => {
    if (!cellRefs.current[rid]) cellRefs.current[rid] = {};
    if (el) cellRefs.current[rid][colKey] = el; else delete cellRefs.current[rid]?.[colKey];
  }, []);

  // ── Auto-gen product code ─────────────────────────────────────────────────
  const autoGenCode = useCallback(async r => {
    if (!sess.Productcodeautogen) return r;
    try {
      const res = await CC.api(CC.ItemMaxCode, null, {}, { Comid:parseInt(sess.Comid)||1 });
      let raw = res?.data?.Data1??res?.Data1??res?.data??res;
      if (Array.isArray(raw)) raw=raw[0];
      if (raw!==null && typeof raw==="object") { const v=Object.values(raw); if(v.length) raw=v[0]; }
      let mc=parseInt(raw,10); if(isNaN(mc)||mc<1) mc=1;
      const d=parseInt(sess.Productcodedigit)||0, p=sess.Productcodeprefix||"";
      const code = d!==0 ? p+String(mc).padStart(d,"0") : (p===""?String(mc):p+String(mc));
      return { ...r, ProductCode:code, _dirty:true };
    } catch { return r; }
  }, [sess]);

  const resetEntry = useCallback(async () => {
    let r=mkEmpty(); r=await autoGenCode(r);
    setEntryRow(r); setVErr("");
    setTimeout(() => focusEntry(editableKeys[0]), 50);
  }, [autoGenCode, focusEntry, editableKeys]);

  // ── Draft ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!draftOk.current) return;
    try { if(entryRow._dirty) sessionStorage.setItem(ITEM_DRAFT_KEY, JSON.stringify({entryRow,rows})); } catch {}
  }, [entryRow, rows]);

  // ── Column config ─────────────────────────────────────────────────────────
  const loadColCfg = useCallback(async () => {
    try {
     const res = await fetch(`/Content/Appdata/Visible/${sess.Comid}/Itemmaster.json?v=${Date.now()}`, { headers:CC.authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;
      setCols(prev => prev.map(col => {
        const s=data.find(x=>x.column===col.key);
        return s ? { ...col, visible:s.Visible===true, width:Number(s.Width)||col.width } : col;
      }));
    } catch {}
  }, [sess.Comid]);

  const saveColCfg = useCallback(async newCols => {
    setF12Open(false); setLoading(true);
    const payload = newCols.map(c => ({ Comid:parseInt(sess.Comid), filename:"Itemmaster", column:c.key, Visible:c.visible===true, Width:parseInt(c.width||120) }));
    try {
      const res = await fetch(CC.VisibleColumnsUrl, { method:"POST", headers:{"Content-Type":"application/json; charset=utf-8",...CC.authHeaders()}, body:JSON.stringify(payload) });
      const data = await res.json();
      if (data.ok) { toast("✅ Column settings saved."); setCols(newCols); await loadColCfg(); }
      else toast(`❌ ${data.message||"Failed"}`, true);
    } catch { toast("❌ Error saving columns", true); }
    finally { setLoading(false); }
  }, [sess.Comid, toast, loadColCfg]);

  // ── Dropdowns ─────────────────────────────────────────────────────────────
  const loadDropdowns = useCallback(async () => {
    const [br,ca,de,su,uo,lo] = await Promise.all([
      CC.api(CC.BrandSelect,           null,{},{Comid:sess.Comid}),
      CC.api(CC.CategorySelect,     null,{},{Comid:sess.Comid}),
      CC.api(CC.DepartmentSelect, null,{},{Comid:sess.Comid}),
      CC.api(CC.GetSupplier,        null,{},{Comid:sess.Comid,AccountType:"SUPPLIER"}),
      CC.api(CC.UOMSelect,               null,{},{Comid:sess.Comid}),
      CC.api(CC.LocationSelect,     null,{},{Comid:sess.Comid}),
    ]);
    const pick = r => r.data||r.Data1||[];
    const nBL=!br._netErr?pick(br):brandL, nCL=!ca._netErr?pick(ca):catL, nDL=!de._netErr?pick(de):deptL;
    const nSL=!su._netErr?pick(su):supL,   nUL=!uo._netErr?pick(uo):uomL, nLL=!lo._netErr?pick(lo):locL;
    if(!br._netErr)setBrandL(nBL); if(!ca._netErr)setCatL(nCL);
    if(!de._netErr){setDeptL(nDL);setDeptAll(nDL);} if(!su._netErr)setSupL(nSL);
    if(!uo._netErr)setUomL(nUL); if(!lo._netErr)setLocL(nLL);
    return {
      Brand:{list:nBL,idKey:"Id",nameKey:"BrandName",fId:"BrandId",fName:"Brand"},
      Category:{list:nCL,idKey:"Id",nameKey:"Cat_Name",fId:"CategoryId",fName:"Category"},
      Department:{list:nDL,idKey:"Id",nameKey:"DepartmentName",fId:"DepartmentId",fName:"Department"},
      Supplier:{list:nSL,idKey:"Id",nameKey:"AccountName",fId:"SupplierId",fName:"Supplier"},
      UOM:{list:nUL,idKey:"Id",nameKey:"UOMName",fId:"UOMId",fName:"UOM"},
      LocationMaster:{list:nLL,idKey:"Id",nameKey:"LocationName",fId:"LocationMasterId",fName:"LocationMaster"},
    };
  // eslint-disable-next-line
  },[sess.Comid]);

  // ── Load items ────────────────────────────────────────────────────────────
  const loadItems = useCallback(async (kw="",col="",isInit=false) => {
    setLoading(true); setLdMsg("Loading Item Master...");
    const res = await CC.api(CC.ItemSelect, null, {"Download":"0"}, { Comid:sess.Comid,Startindex:0,PageCount:99999,Keyword:kw,Column:col,webtype:1 });
    setLoading(false);
    if(res._http404){toast(`❌ 404: ${res.message}`,true);return;}
    if(res._netErr) {toast(`❌ ${res.message}`,true);return;}
    const arr = Array.isArray(res.data)?res.data:Array.isArray(res)?res:[];
    if(isInit) setTotCnt(res.Count||arr.length);
    const fmt = arr.map(fmtRow);
    setRows(fmt);
    setPage(Math.max(1,Math.ceil(fmt.length/ROWS_PER_PAGE)));
  }, [sess.Comid, toast]);

  // ── Combo helpers ─────────────────────────────────────────────────────────
  const comboCfg = {
    Brand:{list:brandL,title:"Brand",idKey:"Id",nameKey:"BrandName",fId:"BrandId",fName:"Brand"},
    Category:{list:catL,title:"Category",idKey:"Id",nameKey:"Cat_Name",fId:"CategoryId",fName:"Category"},
    Department:{list:deptL,title:"Department",idKey:"Id",nameKey:"DepartmentName",fId:"DepartmentId",fName:"Department"},
    Supplier:{list:supL,title:"Supplier",idKey:"Id",nameKey:"AccountName",fId:"SupplierId",fName:"Supplier"},
    UOM:{list:uomL,title:"UOM",idKey:"Id",nameKey:"UOMName",fId:"UOMId",fName:"UOM"},
    LocationMaster:{list:locL,title:"Location",idKey:"Id",nameKey:"LocationName",fId:"LocationMasterId",fName:"LocationMaster"},
  };

  const openComboEntry = useCallback(colKey => {
    const cfg=comboCfg[colKey]; if(!cfg) return;
    let list=cfg.list;
    if(colKey==="Department"&&entryRow?.CategoryId){const sub=deptAll.filter(d=>String(d.CategoryRefId)===String(entryRow.CategoryId));if(sub.length)list=sub;}
    setDdPop({...cfg,list,field:colKey}); setDdCtx({rid:entryRow._rid,colKey,isEntry:true}); setDdQ(ns(entryRow?.[cfg.fName])); setDdHilite(0);
  }, [comboCfg,entryRow,deptAll]);

  const openCombo = useCallback((rid,colKey) => {
    const cfg=comboCfg[colKey]; if(!cfg) return;
    let list=cfg.list;
    if(colKey==="Department"){const row=rows.find(r=>r._rid===rid);if(row?.CategoryId){const sub=deptAll.filter(d=>String(d.CategoryRefId)===String(row.CategoryId));if(sub.length)list=sub;}}
    const row=rows.find(r=>r._rid===rid);
    try{sessionStorage.setItem(ITEM_CURSOR_KEY,JSON.stringify({rid,colKey}));}catch{}
    setDdPop({...cfg,list,field:colKey}); setDdCtx({rid,colKey,isEntry:false}); setDdQ(ns(row?.[cfg.fName])); setDdHilite(0);
  }, [comboCfg,rows,deptAll]);

  const ddFilt    = ddPop ? ddPop.list.filter(x=>String(x[ddPop.nameKey]||"").toLowerCase().includes(ddQ.toLowerCase())) : [];
  const isNewVal  = ddPop && ddQ.trim() && !ddPop.list.some(i=>String(i[ddPop.nameKey]||"").toLowerCase()===ddQ.trim().toLowerCase());
  const ddHiliteC = Math.min(ddHilite, Math.max(0,ddFilt.length-1));

  const selectDd = useCallback(item => {
    if(!ddCtx||!ddPop) return;
    const {rid,colKey,isEntry}=ddCtx;
    if(isEntry){
      setEntryRow(prev=>({...prev,[ddPop.fName]:item[ddPop.nameKey],[ddPop.fId]:item[ddPop.idKey],_dirty:true}));
      setDdPop(null);setDdQ("");setDdCtx(null);setDdHilite(0);
      setTimeout(()=>{const i=editableKeys.indexOf(colKey);focusEntry(i>=0&&i<editableKeys.length-1?editableKeys[i+1]:colKey);},30);
    } else {
      setRows(prev=>prev.map(r=>r._rid!==rid?r:{...r,[ddPop.fName]:item[ddPop.nameKey],[ddPop.fId]:item[ddPop.idKey],_dirty:true}));
      setDdPop(null);setDdQ("");setDdCtx(null);setDdHilite(0);
      setTimeout(()=>{const i=editableKeys.indexOf(colKey);focusCell(rid,i>=0&&i<editableKeys.length-1?editableKeys[i+1]:colKey);},30);
    }
  },[ddCtx,ddPop,editableKeys,focusEntry,focusCell]);

  const handleDdConfirm = useCallback(()=>{
    if(!ddPop||!ddCtx)return;
    const typed=ddQ.trim().toLowerCase(); if(!typed){setDdPop(null);setDdQ("");setDdCtx(null);return;}
    const match=ddPop.list.find(i=>String(i[ddPop.nameKey]||"").toLowerCase()===typed);
    if(match){selectDd(match);return;}
    const nav=COMBO_NAV[ddPop.field];
    if(nav){sessionStorage.setItem("masterPrefill",ddQ.trim());try{sessionStorage.setItem(ITEM_DRAFT_KEY,JSON.stringify({entryRow,rows}));sessionStorage.setItem(ITEM_CURSOR_KEY,JSON.stringify({rid:ddCtx.rid,colKey:ddCtx.colKey,isEntry:ddCtx.isEntry}));}catch{}setDdPop(null);setDdQ("");setDdCtx(null);setDdHilite(0);navigate(nav);}
  },[ddPop,ddCtx,ddQ,selectDd,navigate,entryRow,rows]);

  const closeDd = () => { setDdPop(null);setDdQ("");setDdCtx(null);setDdHilite(0); };

  // ── Cell change (shared logic) ────────────────────────────────────────────
  const applyChange = (prev, colKey, value) => {
    let fv = UPPER_KEYS.has(colKey)&&typeof value==="string" ? value.toUpperCase() : value;
    let u = { ...prev, [colKey]:fv, _dirty:true };
    if(CALC_KEYS.has(colKey)) u={...u,...calcRow(u,sess,colKey)};
    if(colKey==="SalesRate"){const LC=vn(u.LandingCost),SR=vn(fv),d=SR-LC;u.ProfitPer=LC>0&&d>0?f2(ro(d/LC*100)):0;u={...u,...calcRow(u,sess,"SalesRate"),SalesRate:f2(vn(fv))};}
    if(colKey==="ProfitAmt"){const LC=vn(u.LandingCost),PA=vn(fv);u.ProfitPer=LC>0?f2(PA/LC*100):0;u={...u,...calcRow(u,sess,"ProfitAmt")};}
    if(colKey==="DMAmt"){const M=vn(u.MRP),DA=vn(fv);u.DMPer=M>0?f2(ro(DA/M*100)):0;}
    if(colKey==="DMPer"){const M=vn(u.MRP),DP=vn(fv);u.DMAmt=f2(ro(M*DP/100));}
    return u;
  };

  const handleEntryChange = useCallback((colKey, value) => {
    setEntryRow(prev => applyChange(prev, colKey, value));
    setVErr("");
  // eslint-disable-next-line
  }, [sess]);

  const handleCellChange = useCallback((rid, colKey, value) => {
    setRows(prev => prev.map(r => r._rid!==rid ? r : applyChange(r, colKey, value)));
    setVErr("");
  // eslint-disable-next-line
  }, [sess]);

  // ── Validation ────────────────────────────────────────────────────────────
  const validateRow = useCallback(row => {
    if(!String(row.ProductCode||"").trim()){setVErr("❌ Product Code required.");return false;}
    if(!String(row.ProductName||"").trim()){setVErr("❌ Description required.");return false;}
      console.log("[validateRow] ProductName:", JSON.stringify(row.ProductName), 
              "| All keys:", Object.keys(row).filter(k => row[k] !== "" && row[k] !== false && row[k] !== 0));
    if(sess.LandingCostCompare){
      if(vn(row.SalesRate)&&vn(row.LandingCost)>vn(row.SalesRate)){setVErr("❌ Sale Rate < Landing Cost.");return false;}
      if(vn(row.MRP)&&vn(row.SalesRate)&&vn(row.MRP)<vn(row.SalesRate)){setVErr("❌ Sale Rate > MRP.");return false;}
    }
    if(vn(row.MRP)&&vn(row.PurchaseRate)&&vn(row.MRP)<vn(row.PurchaseRate)){setVErr("❌ Purchase Rate > MRP.");return false;}
    setVErr(""); return true;
  }, [sess]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const saveHdrs = {
    "Comid":String(sess.Comid),"Commoncompany":String(sess.CommonCompany),
    "CommoncompanyDiffStock":String(sess.CommonCompanyDiffStock),
    "SupplierMulitipleAllow":String(sess.SupplierMulitipleAllow),
    "MulipleMRP":String(sess.MulipleMRP),"MirrorTable":String(sess.MirrorTable),
    "Tamil":String(sess.Tamil),"IdComList":String(sess.IdComList),"ApiType":"0",
  };

  const buildPayload = useCallback(row => {
    const n=v=>parseFloat(v)||0,ni=v=>parseInt(v)||0,bi=v=>(v===true||v==="true"||v===1||v==="1")?1:0,b=v=>v===true||v==="true"||v===1||v==="1",s=v=>String(v==null?"":v);
    return { Id:ni(row.Id),ProductCode:s(row.ProductCode).trim(),SecondCode:s(row.SecondCode),ProductName:s(row.ProductName).trim(),PrinterName:s(row.PrinterName),HSNCode:s(row.HSNCode),Brand:s(row.Brand),BrandId:ni(row.BrandId),Category:s(row.Category),CategoryId:ni(row.CategoryId),Department:s(row.Department),DepartmentId:ni(row.DepartmentId),Supplier:s(row.Supplier),SupplierId:ni(row.SupplierId),UOM:s(row.UOM),UOMId:ni(row.UOMId),LocationMaster:s(row.LocationMaster),LocationMasterId:ni(row.LocationMasterId),NomsQty:ni(row.NomsQty),MRP:n(row.MRP),DMPer:n(row.DMPer),DMAmt:n(row.DMAmt),PurchaseRate:n(row.PurchaseRate),GST:n(row.GST),GSTAmt:n(row.GSTAmt),TransPer:n(row.TransPer),TransAmt:n(row.TransAmt),CESS:n(row.CESS),CESSAmt:n(row.CESSAmt),SPLCESS:n(row.SPLCESS),LandingCost:n(row.LandingCost),ProfitPer:n(row.ProfitPer),ProfitAmt:n(row.ProfitAmt),SalesRate:n(row.SalesRate),CardRate:n(row.CardRate),WholeSaleRate:n(row.WholeSaleRate),NomsPCRate:n(row.NomsPCRate),SalesRateType:b(row.SalesRateType),SaleDiscountPer:n(row.SaleDiscountPer),SaleDiscountAmt:n(row.SaleDiscountAmt),ReorderLevelMin:n(row.ReorderLevelMin),ReorderLevelMax:n(row.ReorderLevelMax),MaxSaleQty:n(row.MaxSaleQty),LessAmt:n(row.LessAmt),StockNeed:bi(row.StockNeed),ExpriyDate:bi(row.ExpriyDate),OnlineShow:bi(row.OnlineShow),BrandType:bi(row.BrandType),ModelType:bi(row.ModelType),ColorType:bi(row.ColorType),SizeType:bi(row.SizeType),SerialNoType:bi(row.SerialNoType),BatchwiseStock:bi(row.BatchwiseStock),Active:bi(row.Active),NegativetStock:b(row.NegativetStock),Repacking:b(row.Repacking),ExpriyDays:ni(row.ExpriyDays),ExpiryBeforeDays:ni(row.ExpiryBeforeDays),NetWeight:n(row.NetWeight),CRMPoints:n(row.CRMPoints),Remarks:s(row.Remarks),ProductImage:s(row.ProductImage) };
  }, []);

  // const doSave = useCallback(async () => {
  //   if(!perm.Add&&!perm.Edit){toast("❌ Page Add & Update Permission Denied !!!", true);return;}
  //   const eHas=String(entryRow.ProductCode||"").trim()||String(entryRow.ProductName||"").trim();
  //   const toSave=[];
  //   if(entryRow._dirty&&eHas) toSave.push(entryRow);
  //   toSave.push(...rows.filter(r=>r._dirty&&(String(r.ProductCode||"").trim()||String(r.ProductName||"").trim())));
  //   if(!toSave.length){toast("⚠️ No modified data to save.",true);return;}
  //   for(const row of toSave){if(!validateRow(row))return;}
  //   const ok=await confirm("Do you want to Save Item Master Details?");
  //   if(!ok)return;
  //   setLoading(true);setLdMsg("Saving...");
  //   const payload=toSave.map(buildPayload);
  //   const res=await CC.insertapi(CC.ItemInsert,payload,saveHdrs);
  //   setLoading(false);
  //   if(res._netErr){toast(`❌ ${res.message}`,true);return;}
  //   if(res.ok??res.IsSuccess){
  //     toast("✅ "+(res.message||"Saved successfully"));
  //     try{sessionStorage.removeItem(ITEM_DRAFT_KEY);}catch{}
  //     if(eHas&&entryRow._dirty){
  //       const saved={...entryRow,_dirty:false,_isNew:false,Id:res.Id||entryRow.Id||entryRow._rid};
  //       setRows(prev=>[...prev.map(r=>r._dirty?{...r,_dirty:false}:r),saved]);
  //       resetEntry();
  //     } else { setRows(prev=>prev.map(r=>r._dirty?{...r,_dirty:false}:r)); }
  //   } else { toast(`❌ ${res.message||"Save failed"}`,true); }
  // }, [entryRow,rows,perm,confirm,validateRow,buildPayload,toast,saveHdrs,resetEntry]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const doDeleteRow = useCallback(async rid => {
    const row=rows.find(r=>r._rid===rid); if(!row)return;
    if(!perm.Delete){toast("❌ Delete Permission Denied",true);return;}
    const ok=await confirm(`Delete "${row.ProductName||"this row"}"?`); if(!ok)return;
    setLoading(true);setLdMsg("Deleting...");
    const res=await CC.api(CC.ItemDelete,null,{"IdComList":String(sess.IdComList)},{Id:row.Id,Comid:sess.Comid,MirrorTable:sess.MirrorTable});
    setLoading(false);
    if(res._netErr){toast(`❌ ${res.message}`,true);return;}
    if(res.ok){toast("✅ "+(res.message||"Deleted"));setRows(prev=>prev.filter(r=>r._rid!==rid));if(selRid===rid)setSelRid(null);}
    else toast(`❌ ${res.message||"Delete failed"}`,true);
  }, [rows,perm,confirm,toast,sess,selRid]);
const doSave = useCallback(async () => {
  if (!perm.Add && !perm.Edit) {
    toast("❌ Page Add & Update Permission Denied !!!", true);
    return;
  }

  const latestRows  = rowsRef.current;
  const latestEntry = entryRowRef.current;

  const eHas = String(latestEntry?.ProductCode || "").trim() ||
               String(latestEntry?.ProductName  || "").trim();

  const dirtyRows = latestRows.filter(r =>
    r._dirty &&
    (String(r.ProductCode || "").trim() || String(r.ProductName || "").trim())
  );

const entryComplete =
  String(latestEntry?.ProductCode || "").trim() &&
  String(latestEntry?.ProductName || "").trim();

const toSave = [];
if (latestEntry?._dirty && entryComplete) toSave.push(latestEntry);
toSave.push(...dirtyRows);

  // ── DEBUG: remove after confirming fix ──
  console.log("[doSave] latestRows:", latestRows.length,
    "| dirty:", dirtyRows.length,
    "| entryDirty:", latestEntry?._dirty,
    "| eHas:", eHas,
    "| toSave:", toSave.length);

  if (!toSave.length) {
    toast("⚠️ No modified data to save.", true);
    return;
  }

  for (const row of toSave) {
    if (!validateRow(row)) {
      console.log("[doSave] validation failed for:", row.ProductCode, row.ProductName);
      return;
    }
  }

  const ok = await confirm("Do you want to Save Item Master Details?");
  if (!ok) return;

  setLoading(true);
  setLdMsg("Saving...");

  const hdrs = {
    "Comid":                  String(sess.Comid),
    "Commoncompany":          String(sess.CommonCompany),
    "CommoncompanyDiffStock": String(sess.CommonCompanyDiffStock),
    "SupplierMulitipleAllow": String(sess.SupplierMulitipleAllow),
    "MulipleMRP":             String(sess.MulipleMRP),
    "MirrorTable":            String(sess.MirrorTable),
    "Tamil":                  String(sess.Tamil),
    "IdComList":              String(sess.IdComList),
    "ApiType":                "0",
  };

  const payload = toSave.map(buildPayload);
  const res = await CC.insertapi(CC.ItemInsert, payload, hdrs);
  setLoading(false);

  if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

  if (res.ok ?? res.IsSuccess) {
    toast("✅ " + (res.message || "Saved successfully"));
    try { sessionStorage.removeItem(ITEM_DRAFT_KEY); } catch {}

if (entryComplete && latestEntry?._dirty) {
      const saved = {
        ...latestEntry,
        _dirty: false,
        _isNew: false,
        Id: res.Id || latestEntry.Id || latestEntry._rid,
      };
      setRows(prev => [
        ...prev.map(r => r._dirty ? { ...r, _dirty: false } : r),
        saved,
      ]);
      resetEntry();
    } else {
      setRows(prev => prev.map(r => r._dirty ? { ...r, _dirty: false } : r));
    }
  } else {
    toast(`❌ ${res.message || "Save failed"}`, true);
  }

}, [perm, validateRow, confirm, buildPayload, toast, sess, resetEntry]);
// Note: rowsRef/entryRowRef are refs — they don't need to be in deps
  // ── Keyboard: Entry row ───────────────────────────────────────────────────
  // Uses CC.handleEnterNext exactly like CashierMaster does.
  // We convert entryRefs (keyed by colKey) into the 2-D array format CC expects
  // by building a single-row proxy on the fly.
  const entryRowIndex = rows.length;   // virtual index = after all data rows

  const handleEntryKeyDown = useCallback((e, colKey) => {
    if (e.key === "Enter") {
      // Build a 1-row proxy so CC.handleEnterNext can work
      const colIdx = editableKeys.indexOf(colKey);
      // Convert entryRefs (object) into the row-array format
    const proxyRefs = { current: [] };
proxyRefs.current[0] = {};
editableKeys.forEach((k, i) => { proxyRefs.current[0][i] = entryRefs.current[k]; });

     CC.handleEnterNext(
  e, proxyRefs,
  0,                          // ← always row 0 in the proxy
  colIdx,
  editableKeys.length,
  1,                          // ← totalRows = 1 (only the entry row)
  doSave,
  [entryRow],
  rowValidator
);
      return;
    }
    if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); const i=editableKeys.indexOf(colKey); if(i<editableKeys.length-1) focusEntry(editableKeys[i+1]); return; }
    if (e.key === "Tab" && e.shiftKey)  { e.preventDefault(); const i=editableKeys.indexOf(colKey); if(i>0) focusEntry(editableKeys[i-1]); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); if(pagedRows.length>0) focusCell(pagedRows[0]._rid,colKey); return; }
  // eslint-disable-next-line
  }, [editableKeys, focusEntry, focusCell, entryRow, rowValidator, doSave, entryRowIndex]);

  // ── Pagination ────────────────────────────────────────────────────────────
  const filteredRows = rows.filter(r => {
    for(const[k,v]of Object.entries(colFilters)){if(!v?.trim())continue;if(!String(r[k]??"").toLowerCase().includes(v.trim().toLowerCase()))return false;}
    return true;
  });
  const totPages  = Math.max(1,Math.ceil(filteredRows.length/ROWS_PER_PAGE));
  const pagedRows = filteredRows.slice((page-1)*ROWS_PER_PAGE,page*ROWS_PER_PAGE);
  const pageNums  = (() => {
    if(totPages<=10) return Array.from({length:totPages},(_,i)=>i+1);
    const s=new Set([1,totPages]); for(let i=Math.max(1,page-3);i<=Math.min(totPages,page+3);i++)s.add(i); return Array.from(s).sort((a,b)=>a-b);
  })();

  // ── Keyboard: Grid rows — uses CC.handleEnterNext directly ───────────────
  // rowRefs is a 2-D array: rowRefs.current[rowIndex][colIndex]
  const handleCellKeyDown = useCallback((e, rid, colKey) => {
    if (e.key === "Enter") {
      const rowIdx = pagedRows.findIndex(r => r._rid === rid);
      const colIdx = editableKeys.indexOf(colKey);

      // Build proxy refs mapping pagedRows to rowRefs indices
      const proxyRefs = { current: rowRefs.current };

      CC.handleEnterNext(
        e, proxyRefs,
        rowIdx, colIdx,
        editableKeys.length,
        pagedRows.length,
        () => {
          // Last cell of last row → focus entry row first col
          focusEntry(editableKeys[0]);
        },
        pagedRows,
        rowValidator
      );
      return;
    }
    if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); const i=editableKeys.indexOf(colKey); if(i<editableKeys.length-1) focusCell(rid,editableKeys[i+1]); return; }
    if (e.key === "Tab" && e.shiftKey)  { e.preventDefault(); const i=editableKeys.indexOf(colKey); if(i>0) focusCell(rid,editableKeys[i-1]); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); const ri=pagedRows.findIndex(r=>r._rid===rid); if(ri<pagedRows.length-1) focusCell(pagedRows[ri+1]._rid,colKey); return; }
    if (e.key === "ArrowUp")   { e.preventDefault(); const ri=pagedRows.findIndex(r=>r._rid===rid); if(ri>0) focusCell(pagedRows[ri-1]._rid,colKey); else focusEntry(colKey); return; }
  // eslint-disable-next-line
  }, [editableKeys,focusCell,focusEntry,pagedRows,rowValidator]);

  // ── Global keyboard shortcuts ─────────────────────────────────────────────
  const anyOpen = f12Open||ddPop||bsrOpen||gcOpen||tnOpen||pw||adminOpen;
  useEffect(() => {
    const onKey = e => {
      if (anyOpen) return;
      if (e.key==="F1")     { e.preventDefault(); doSave(); }
      if (e.key==="F12")    { e.preventDefault(); setF12Open(true); }
      if (e.key==="Delete"&&selRid) { e.preventDefault(); doDeleteRow(selRid); }
      if (e.key==="Escape") { e.preventDefault(); navigate(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line
  }, [anyOpen, doSave, selRid, doDeleteRow]);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(()=>{
    (async()=>{
      await loadColCfg();
      await loadDropdowns();
      let draftRestored=false;
      try{
        const saved=sessionStorage.getItem(ITEM_DRAFT_KEY);
        if(saved){
          const parsed=JSON.parse(saved);
          if(parsed?.entryRow){
            const rr=(Array.isArray(parsed.rows)?parsed.rows:[]).map(r=>({...r,_rid:r._rid||genRid()}));
            setRows(rr); setEntryRow({...parsed.entryRow,_rid:parsed.entryRow._rid||genRid()});
            setPage(Math.max(1,Math.ceil(rr.length/ROWS_PER_PAGE)));
            draftRestored=true; toast("📋 Draft restored.");
          }
        }
      }catch{}
      if(!draftRestored){
        await loadItems("","",true);
        if(sess.Productcodeautogen){const r=await autoGenCode(mkEmpty());setEntryRow(r);}
      }
      draftOk.current=true;
      setTimeout(()=>focusEntry(editableKeys[0]),500);
    })();
  // eslint-disable-next-line
  },[]);

  useEffect(()=>{
    setCols(prev=>prev.map(col=>(col.key==="DMPer"||col.key==="DMAmt")?{...col,visible:sess.MulipleMRP}:col));
  // eslint-disable-next-line
  },[]);

  // ── Drag scroll ───────────────────────────────────────────────────────────
  const onMD=e=>{const el=gRef.current;drag.current={on:true,x:e.pageX-el.offsetLeft,y:e.pageY-el.offsetTop,sl:el.scrollLeft,st:el.scrollTop};};
  const onML=()=>{drag.current.on=false;};
  const onMU=()=>{drag.current.on=false;};
  const onMM=e=>{if(!drag.current.on)return;e.preventDefault();const el=gRef.current;el.scrollLeft=drag.current.sl-((e.pageX-el.offsetLeft)-drag.current.x)*1.4;el.scrollTop=drag.current.st-((e.pageY-el.offsetTop)-drag.current.y)*1.4;};

  // ── Render a single cell (grid row) ───────────────────────────────────────
  const renderCell = useCallback((row, col, rowIdx) => {
    const cd=COLUMNS.find(c=>c.key===col.key); if(!cd) return null;
    const rid=row._rid, val=row[cd.key];
    const colIdx=editableKeys.indexOf(cd.key);
    const onFocus=()=>setSelRid(rid);

    const regRowRef = el => {
      if(!rowRefs.current[rowIdx]) rowRefs.current[rowIdx]=[];
      if(colIdx>=0){ if(el) rowRefs.current[rowIdx][colIdx]=el; }
      regRef(rid,cd.key,el);
    };

    if(cd.calc) return <span className={cd.key==="LandingCost"?"lc-value":"calc-val"}>{cd.type==="f2"?vn(val).toFixed(2):cd.type==="f3"?vn(val).toFixed(3):String(val??"")}</span>;

    if(cd.bool) return (
      <select ref={regRowRef} value={val?"1":"0"} className="cm-active-sel"
        style={{cursor:"pointer",appearance:"none",textAlign:"center"}}
        onChange={e=>handleCellChange(rid,cd.key,e.target.value==="1")}
        onKeyDown={e=>handleCellKeyDown(e,rid,cd.key)}
        onFocus={onFocus}>
        <option value="0">✗</option><option value="1">✓</option>
      </select>
    );

    if(cd.isCombo) return (
      <input ref={regRowRef} type="text" value={ns(val)} readOnly className="mp-cell-input"
        style={{cursor:"pointer",caretColor:"transparent"}}
        placeholder={"▼ "+cd.label} onFocus={onFocus}
        onClick={()=>openCombo(rid,cd.key)}
        onKeyDown={e=>{if(e.key==="Enter"||e.key==="F4"){e.preventDefault();openCombo(rid,cd.key);}else handleCellKeyDown(e,rid,cd.key);}} />
    );

    if(cd.type==="f2"||cd.type==="f3") return (
      <input ref={regRowRef} type="number" step={cd.type==="f3"?"0.001":"0.01"}
        value={val===""||val===undefined?"":val} className="mp-cell-input"
        onChange={e=>handleCellChange(rid,cd.key,e.target.value)}
        onKeyDown={e=>handleCellKeyDown(e,rid,cd.key)}
        onFocus={onFocus} placeholder="0.00" />
    );

    if(cd.type==="int") return (
      <input ref={regRowRef} type="number" step="1"
        value={val===""||val===undefined?"":val} className="mp-cell-input"
        onChange={e=>handleCellChange(rid,cd.key,e.target.value)}
        onKeyDown={e=>handleCellKeyDown(e,rid,cd.key)}
        onFocus={onFocus} placeholder="0" />
    );

    return (
      <input ref={regRowRef} type="text" value={ns(val)} className="mp-cell-input"
        onChange={e=>handleCellChange(rid,cd.key,e.target.value)}
        onKeyDown={e=>handleCellKeyDown(e,rid,cd.key)}
        onFocus={onFocus} placeholder={cd.label} />
    );
  }, [handleCellChange,handleCellKeyDown,regRef,openCombo,editableKeys]);

  // ── Render a single entry-row cell ────────────────────────────────────────
  const renderEntryCell = useCallback(col => {
    const cd=COLUMNS.find(c=>c.key===col.key); if(!cd) return null;
    const val=entryRow[cd.key];
    const reg=el=>{if(entryRefs.current) entryRefs.current[cd.key]=el;};

    if(cd.calc) return <span className={cd.key==="LandingCost"?"lc-value":"calc-val"} style={{display:"block",padding:"2px 6px"}}>{cd.type==="f2"?vn(val).toFixed(2):cd.type==="f3"?vn(val).toFixed(3):String(val??"")}</span>;

    if(cd.bool) return (
      <select ref={reg} value={val?"1":"0"} className="cm-active-sel"
        onChange={e=>handleEntryChange(cd.key,e.target.value==="1")}
        onKeyDown={e=>handleEntryKeyDown(e,cd.key)}
        style={{cursor:"pointer",appearance:"none",textAlign:"center"}}>
        <option value="0">✗</option><option value="1">✓</option>
      </select>
    );

    if(cd.isCombo) return (
      <input ref={reg} type="text" value={ns(val)} readOnly className="mp-cell-input"
        placeholder={"▼ "+cd.label} onClick={()=>openComboEntry(cd.key)}
        onKeyDown={e=>{if(e.key==="Enter"||e.key==="F4"){e.preventDefault();openComboEntry(cd.key);}else handleEntryKeyDown(e,cd.key);}} />
    );

    if(cd.type==="f2"||cd.type==="f3") return (
      <input ref={reg} type="number" step={cd.type==="f3"?"0.001":"0.01"}
        value={val===""||val===undefined?"":val} className="mp-cell-input"
        onChange={e=>handleEntryChange(cd.key,e.target.value)}
        onKeyDown={e=>handleEntryKeyDown(e,cd.key)} placeholder="0.00" />
    );

    if(cd.type==="int") return (
      <input ref={reg} type="number" step="1"
        value={val===""||val===undefined?"":val} className="mp-cell-input"
        onChange={e=>handleEntryChange(cd.key,e.target.value)}
        onKeyDown={e=>handleEntryKeyDown(e,cd.key)} placeholder="0" />
    );

    const isAG=cd.key==="ProductCode"&&sess.Productcodeautogen;
    return (
      <input ref={reg} type="text" value={ns(val)} className="mp-cell-input"
        onChange={e=>handleEntryChange(cd.key,e.target.value)}
        onKeyDown={e=>handleEntryKeyDown(e,cd.key)}
        placeholder={isAG?"Auto Generated":cd.label}
        readOnly={isAG} />
    );
  }, [entryRow,handleEntryChange,handleEntryKeyDown,openComboEntry,sess]);

  const totW = SNO_W + DEL_W + visCols.reduce((s,c)=>s+c.width,0);
  const eHas = String(entryRow.ProductCode||"").trim()||String(entryRow.ProductName||"").trim();


  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="mp-wrap">
      {ConfirmUI}
      {f12Open && <F12Popup colSettings={cols} onSave={saveColCfg} onClose={()=>setF12Open(false)} />}

      {/* ── Header (same style as CashierMaster) ── */}
      <div className="mp-hdr">
        <div className="mp-hdr-left">
          <div className="mp-icon">I</div>
          <div>
            <div className="mp-title">Item Master</div>
            <div className="mp-sub">Co: {sess.Comid} — Manage items</div>
          </div>
        </div>
        <div className="mp-hdr-center">⬛ KASSA BM</div>
        {/* Admin dropdown — same as original */}
        <div className="mp-hdr-right adm-wrap" ref={adminRef} onClick={()=>setAdminOpen(o=>!o)} style={{cursor:"pointer"}}>
          <div style={{width:30,height:30,borderRadius:7,background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:"#1f65de",flexShrink:0}}>👤</div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:"#fff"}}>Co: {sess.Comid}</div>
            <div style={{fontSize:9,fontWeight:600,color:"rgba(255,255,255,.6)",letterSpacing:1,textTransform:"uppercase",marginTop:1}}>Administrator</div>
          </div>
          {adminOpen && (
            <div className="adm-dropdown">
              <button className="adm-item" onClick={e=>{e.stopPropagation();setAdminOpen(false);navigate("/company-master");}}>👤 My Profile</button>
              <button className="adm-item" onClick={e=>{e.stopPropagation();setAdminOpen(false);navigate("/");localStorage.clear();sessionStorage.clear();}}>🚪 Logout</button>
            </div>
          )}
        </div>
        <button className="mp-back" onClick={()=>navigate(-1)}>← Back</button>
      </div>

      <div className="mp-body mp-ibody">

        {/* ── Toolbar ── */}
        <div className="mp-toolbar">
          <button className="mp-btn sv" onClick={doSave}               disabled={loading}>💾 F1 Save</button>
          <button className="mp-btn nw" onClick={resetEntry}           disabled={loading}>➕ New Entry</button>
          <button className="mp-btn"    onClick={()=>setF12Open(true)}>⚙ F12 Columns</button>
          <button className="mp-btn"    onClick={()=>loadItems("","",true)} disabled={loading}>🔄 Reload</button>
          <button className="mp-btn ex" onClick={()=>setPw({title:"F4 Password",onOk:()=>{/*excel download*/}})}>📥 F4 Excel↓</button>
          <button className="mp-btn ex" onClick={()=>setPw({title:"F7 Password",onOk:()=>{/*excel upload*/}})}>📤 F7 Excel↑</button>
          {sess.GroupCommission && <button className="mp-btn" onClick={async()=>{const r=rows.find(x=>x._rid===selRid);if(!r?.Id){toast("Select a saved row first",true);return;}const res=await CC.api(CC.ItemGroupCommission,null,{},{Id:r.Id,Comid:sess.Comid});setGcRows(!res._netErr&&(res.data||res.Data1)?res.data||res.Data1:[]);setGcOpen(true);}} disabled={!selRid}>💰 Group Commission</button>}
          <button className="mp-btn"    onClick={()=>{const r=rows.find(x=>x._rid===selRid);setTnVal(r?ns(r.PrinterName):"");setTnOpen(true);}} disabled={!selRid}>🌐 F6 Tamil Name</button>
          <button className="mp-btn dl" onClick={()=>selRid?doDeleteRow(selRid):toast("Select a row to delete",true)} disabled={!selRid||loading}>🗑 Delete</button>
        </div>

        {/* ── Pagination + status bar ── */}
        <div className="mp-toolbar" style={{justifyContent:"space-between"}}>
          <div style={{display:"flex",gap:3,alignItems:"center",flexWrap:"wrap"}}>
            {pageNums.map((n,idx)=>{
              const prev=pageNums[idx-1];
              return (
                <span key={n} style={{display:"flex",alignItems:"center",gap:2}}>
                  {prev&&n-prev>1&&<span style={{color:"#94a3b8",fontSize:11}}>…</span>}
                  <button className={`mp-pgbtn${page===n?" on":""}`} onClick={()=>setPage(n)}>{n}</button>
                </span>
              );
            })}
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <span className="mp-badge">Rows: {rows.length}{totCnt>rows.length?` / ${totCnt}`:""}</span>
            {(entryRow._dirty||rows.some(r=>r._dirty))&&<span className="mp-badge-warn">✏️ {rows.filter(r=>r._dirty).length+(entryRow._dirty?1:0)} unsaved</span>}
            {vErr&&<span className="mp-verr">{vErr}</span>}
            {Object.values(colFilters).some(v=>v?.trim())&&<button className="mp-btn dl" style={{height:22,padding:"0 8px",fontSize:10}} onClick={()=>setColFilters({})}>✕ Clear Filters</button>}
          </div>
        </div>

        {/* ── Grid ── */}
        <div className="mp-grid-wrap">
          <div className="mp-gscroll" ref={gRef}
            onMouseDown={onMD} onMouseLeave={onML} onMouseUp={onMU} onMouseMove={onMM}>
            <table className="mp-tbl" style={{width:totW,minWidth:totW}}>
              <thead>
                {/* Filter row */}
                <tr className="mp-filter-row">
                  <th style={{width:SNO_W}}></th>
                  {visCols.map(col=>(
                    <th key={col.key} style={{width:col.width,minWidth:col.width}}>
                      {FILTER_KEYS.has(col.key)&&(
                        <input className="mp-col-filter" value={colFilters[col.key]||""} onChange={e=>{setColFilters(p=>({...p,[col.key]:e.target.value}));setPage(1);}} placeholder={`🔍 ${col.label}`} />
                      )}
                    </th>
                  ))}
                  <th style={{width:DEL_W}}></th>
                </tr>
                {/* Column header row */}
                <tr className="mp-col-row">
                  <th style={{width:SNO_W}}>S.No</th>
                  {visCols.map(c=>(
                    <th key={c.key} style={{width:c.width,minWidth:c.width}}>
                      {c.label}{COLUMNS.find(x=>x.key===c.key)?.calc&&<span style={{color:"#a8c8f5",fontSize:9,marginLeft:2}}>🔒</span>}
                    </th>
                  ))}
                  <th style={{width:DEL_W}}></th>
                </tr>
              </thead>

              {/* <tbody>
                {pagedRows.length===0
                  ? <tr><td colSpan={visCols.length+2} className="mp-empty">No records. Press ➕ to add an item.</td></tr>
                  : pagedRows.map((row,idx)=>(
                    <tr key={row._rid}
                      className={[selRid===row._rid?"sel":"",row.Active===false||row.Active===0?"inact":"",row._dirty?"mod":""].filter(Boolean).join(" ")}
                      onClick={()=>setSelRid(row._rid)}>
                      <td className="sno">{(page-1)*ROWS_PER_PAGE+idx+1}</td>
                      {visCols.map(col=>(
                        <td key={col.key}>{renderCell(row,col,idx)}</td>
                      ))}
                      <td style={{textAlign:"center"}}>
                        <button className="mp-del-btn" onClick={e=>{e.stopPropagation();doDeleteRow(row._rid);}}>🗑</button>
                      </td>
                    </tr>
                  ))
                }
              </tbody> */}
              <tbody>
  {pagedRows.length === 0 ? (
    <tr>
      <td colSpan={visCols.length + 2} className="mp-empty">
        No records. Press ➕ to add an item.
      </td>
    </tr>
  ) : (
    pagedRows.map((row, idx) => (
      <tr
        key={row._rid}
        className={[
          selRid === row._rid                          ? "sel"   : "",
          row.Active === false || row.Active === 0     ? "inact" : "",
          row._dirty                                   ? "mod"   : "",
        ].filter(Boolean).join(" ")}
        onClick={() => setSelRid(row._rid)}
      >
        {/* S.No */}
        <td className="sno">
          {(page - 1) * ROWS_PER_PAGE + idx + 1}
        </td>

        {/* Data cells — click focuses the exact cell clicked */}
        {visCols.map(col => (
          <td
            key={col.key}
            onClick={e => {
              e.stopPropagation();           // stop tr onClick firing twice
              setSelRid(row._rid);
              setTimeout(() => {
                const el = cellRefs.current[row._rid]?.[col.key];
                if (el) { el.focus(); el.select?.(); }
              }, 20);
            }}
          >
            {renderCell(row, col, idx)}
          </td>
        ))}

        {/* Delete button */}
        <td style={{ textAlign: "center" }}>
          <button
            className="mp-del-btn"
            onClick={e => { e.stopPropagation(); doDeleteRow(row._rid); }}
          >
            🗑
          </button>
        </td>
      </tr>
    ))
  )}
</tbody>

              {/* ── Entry row in tfoot (identical pattern to CashierMaster) ── */}
              <tfoot>
                <tr>
                  <td className="mp-entry-sno">★ New</td>
                  {visCols.map(col=>(
                    <td key={col.key}>{renderEntryCell(col)}</td>
                  ))}
                  <td className="mp-entry-actions">
                    {eHas
                      ? <div style={{display:"flex",gap:3,justifyContent:"center"}}>
                          <button className="mp-entry-save"  onClick={doSave}   title="Save (F1)">💾</button>
                          <button className="mp-entry-clear" onClick={resetEntry} title="Clear">✕</button>
                        </div>
                      : <span className="mp-entry-hint">F1</span>
                    }
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── Hint bar ── */}
        <div className="mp-hint">
          <kbd>Enter</kbd> next cell &nbsp;|&nbsp;
          <kbd>Tab</kbd> next cell &nbsp;|&nbsp;
          <kbd>↑↓</kbd> navigate rows &nbsp;|&nbsp;
          <kbd>F1</kbd> save &nbsp;|&nbsp;
          <kbd>F12</kbd> columns &nbsp;|&nbsp;
          <kbd>Del</kbd> delete selected &nbsp;|&nbsp;
          <kbd>Esc</kbd> back
        </div>
      </div>

      {/* ── Loading overlay ── */}
      {loading&&(
        <div className="mp-loader-ov">
          <div className="mp-ldr-box">
            <div className="mp-spin"/>
            <div className="mp-ldr-msg">{ldMsg}</div>
          </div>
        </div>
      )}

      {/* ── Toasts ── */}
      <CC.ToastList toasts={toasts}/>

      {/* ── Combo dropdown ── */}
      {ddPop&&<ComboPopup ddPop={ddPop} ddQ={ddQ} setDdQ={setDdQ} ddFilt={ddFilt} ddHilite={ddHilite} setDdHilite={setDdHilite} ddHiliteC={ddHiliteC} selectDd={selectDd} handleDdConfirm={handleDdConfirm} isNewValue={isNewVal} onClose={closeDd}/>}

      {/* ── Password modal ── */}
      {pw&&<PwModal title={pw.title} comid={sess.Comid} onOk={pw.onOk} onClose={()=>setPw(null)}/>}

      {/* ── Branch Sale Rate modal ── */}
      {bsrOpen&&(
        <div className="mp-ov" onClick={e=>{if(e.target===e.currentTarget)setBsrOpen(false);}}>
          <div className="mp-modal-box" style={{width:440,maxHeight:"65vh"}}>
            <div className="mp-modal-hdr"><span>🏪 Branch Sale Rate</span><button onClick={()=>setBsrOpen(false)}>✕</button></div>
            <div className="mp-modal-body">
              <table className="mp-utbl">
                <thead><tr><th>Branch</th><th>Sale Rate</th></tr></thead>
                <tbody>
                  {bsrRows.length===0
                    ? <tr><td colSpan={2} style={{textAlign:"center",color:"#94a3b8",padding:14,fontSize:11}}>No branches</td></tr>
                    : bsrRows.map((r,i)=>(
                      <tr key={i}>
                        <td><input value={r.BranchName||""} readOnly style={{background:"#f8fafc"}}/></td>
                        <td><input type="number" step="0.01" value={r.SaleRate||""} onChange={e=>setBsrRows(p=>p.map((x,j)=>j===i?{...x,SaleRate:e.target.value}:x))}/></td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
            <div className="mp-modal-ftr">
              <button className="mp-btn" onClick={()=>setBsrOpen(false)}>Cancel</button>
              <button className="mp-btn sv" onClick={async()=>{const r=rows.find(x=>x._rid===selRid);setLoading(true);const res=await CC.api(CC.ItemBranchRateUpdate,bsrRows,{},{ItemId:r.Id});setLoading(false);if(res.ok){toast("✅ Saved");setBsrOpen(false);}else toast(`❌ ${res.message||"Failed"}`,true);}} disabled={loading}>💾 Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Group Commission modal ── */}
      {gcOpen&&(
        <div className="mp-ov" onClick={e=>{if(e.target===e.currentTarget)setGcOpen(false);}}>
          <div className="mp-modal-box" style={{width:500,maxHeight:"65vh"}}>
            <div className="mp-modal-hdr"><span>💰 Group Commission</span><button onClick={()=>setGcOpen(false)}>✕</button></div>
            <div className="mp-modal-body">
              <table className="mp-utbl">
                <thead><tr><th>Group Name</th><th>Commission %</th><th>Active</th><th style={{width:32}}></th></tr></thead>
                <tbody>
                  {gcRows.length===0
                    ? <tr><td colSpan={4} style={{textAlign:"center",color:"#94a3b8",padding:14,fontSize:11}}>No group commissions</td></tr>
                    : gcRows.map((r,i)=>(
                      <tr key={i}>
                        <td><input value={r.GroupName||""} onChange={e=>setGcRows(p=>p.map((x,j)=>j===i?{...x,GroupName:e.target.value}:x))}/></td>
                        <td><input type="number" step="0.01" value={r.Commisssion||""} onChange={e=>setGcRows(p=>p.map((x,j)=>j===i?{...x,Commisssion:e.target.value}:x))}/></td>
                        <td><select value={r.GrpActive||"0"} onChange={e=>setGcRows(p=>p.map((x,j)=>j===i?{...x,GrpActive:e.target.value}:x))} className="cm-active-sel"><option value="0">✗</option><option value="1">✓</option></select></td>
                        <td><button onClick={()=>setGcRows(p=>p.filter((_,j)=>j!==i))} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:"#dc2626"}}>🗑</button></td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
              <button className="mp-btn nw" style={{marginTop:8}} onClick={()=>setGcRows(p=>[...p,{GroupName:"",Commisssion:"",GrpActive:"1"}])}>+ Add Row</button>
            </div>
            <div className="mp-modal-ftr">
              <button className="mp-btn" onClick={()=>setGcOpen(false)}>Cancel</button>
              <button className="mp-btn sv" onClick={async()=>{const r=rows.find(x=>x._rid===selRid);setLoading(true);const res=await CC.insertapi(CC.ItemGroupCommissionInsert,gcRows,{"ItemId":String(r.Id),...CC.authHeaders()});setLoading(false);if(res.ok??res.IsSuccess){toast("✅ Saved");setGcOpen(false);}else toast(`❌ ${res.message||"Failed"}`,true);}} disabled={loading}>💾 Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tamil Name modal ── */}
      {tnOpen&&(
        <div className="mp-ov" onClick={e=>{if(e.target===e.currentTarget)setTnOpen(false);}}>
          <div className="mp-modal-box" style={{width:380,padding:"20px 24px"}}>
            <div style={{fontSize:14,fontWeight:700,marginBottom:12,color:"#1f65de"}}>🌐 Tamil / Printer Name</div>
            <input autoFocus value={tnVal} onChange={e=>setTnVal(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"){if(selRid)setRows(p=>p.map(r=>r._rid===selRid?{...r,PrinterName:tnVal,_dirty:true}:r));setTnOpen(false);toast("✅ Tamil name updated");}if(e.key==="Escape")setTnOpen(false);}}
              placeholder="Enter Tamil name..."
              style={{width:"100%",padding:"7px 10px",border:"1px solid #c5d8f8",borderRadius:4,fontSize:13,marginBottom:14,outline:"none",boxSizing:"border-box"}}/>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button className="mp-btn" onClick={()=>setTnOpen(false)}>Cancel</button>
              <button className="mp-btn sv" onClick={()=>{if(selRid)setRows(p=>p.map(r=>r._rid===selRid?{...r,PrinterName:tnVal,_dirty:true}:r));setTnOpen(false);toast("✅ Tamil name updated");}}>✅ Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}