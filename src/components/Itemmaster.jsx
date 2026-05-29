// ─────────────────────────────────────────────────────────────────────────────
//  ItemMaster.jsx  —  CashierMaster style: edit-mode per row, toggle, border-none view
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../Master/MasterPage.css";
import "../Itemmaster.css";
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
const EDIT_W          = 44;   // ← NEW: edit icon column width
const DEL_W           = 44;
const DEFAULT_COLS    = COLUMNS.map(c => ({ key:c.key, label:c.label, width:c.width, visible:!c.hidden }));
const ITEM_DRAFT_KEY  = "itemmaster_draft";
const ITEM_CURSOR_KEY = "itemmaster_cursor";
const CALC_KEYS = new Set(["PurchaseRate","GST","CESS","TransPer","MRP","GSTAmt","CESSAmt","TransAmt"]);
const UPPER_KEYS      = new Set(["ProductCode","SecondCode","ProductName","PrinterName","HSNCode","Brand","Category","Department","Supplier","UOM","LocationMaster","Remarks"]);
const FILTER_KEYS     = new Set(["ProductCode","SecondCode","ProductName","PrinterName","HSNCode","Brand","Category","Department","Supplier","UOM","LocationMaster","Remarks"]);
const COMBO_NAV       = { Brand:"/brand-master", Category:"/category-master", Department:"/department-master", Supplier:"/supplier-master", UOM:"/uom-master", LocationMaster:"/location-master" };
// ── State — add these near your other state declarations ──────────────────

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
  const r = { _rid:genRid(), _isNew:true, _dirty:false, _editMode:1 };
  COLUMNS.forEach(c => { r[c.key] = c.bool ? false : ""; });
  ["BrandId","CategoryId","DepartmentId","SupplierId","UOMId","LocationMasterId","ProductImage","Id"].forEach(k => { r[k]=""; });
  r.Active=true; r.StockNeed=true; r.SalesRateType=true;
  return r;
};

const fmtRow = obj => {
  const r = { ...obj, _rid:obj._rid||genRid(), _isNew:false, _dirty:false, _editMode:0 };
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

  // ── PurchaseProfitSaleRateChange logic (same as JS) ──
  let SR;
  if(sess?.PurchaseProfitSaleRateChange){
    // if ProfitAmt is 0 → keep MRP for new rows, keep existing SalesRate for saved rows
    if(PA === 0){
      SR = !row.Id ? f2(MRP) : (vn(row.SalesRate) || f2(MRP));
    } else {
      SR = f2(LC + PA);  // LC + ProfitAmt
    }
  } else {
    // original logic
    SR = PA!==0 ? f2(LC+PA) : (!row.Id ? f2(MRP) : (vn(row.SalesRate)||f2(MRP)));
  }

  return {
    GST:f2(GST), GSTAmt:f2(GSTAmt), CESS:f2(CESS), CESSAmt:f2(CessAmt),
    TransPer:f2(TP), TransAmt:f2(TrAmt), LandingCost:f2(LC),
    DMAmt:f2(ro(MRP-LC)), DMPer:MRP>0?f2(ro((MRP-LC)/MRP*100)):0,
    ProfitAmt:f2(PA), SalesRate:SR,
    ...(sess?.univercell?{MRP:f2(ro(SR))}:{})
  };
}

// ── Toggle component (same as CashierMaster) ─────────────────────────────────
// CHANGE 1: Added Toggle component — same design as CashierMaster
// மாற்றம் 1: CashierMaster-போல் Toggle component சேர்க்கப்பட்டது
function Toggle({ value, onChange, onKeyDown, inputRef, editMode }) {
  return (
    <button
      ref={inputRef}
      onClick={() => editMode === 1 && onChange(!value)}
      onKeyDown={onKeyDown}
      title={value ? "Active" : "Inactive"}
      style={{
        width:32, height:18, borderRadius:9, border:"none",
        cursor: editMode === 0 ? "default" : "pointer",
        background: value ? "#16a34a" : "#cbd5e1",
        position:"relative", transition:"background 0.18s ease", outline:"none",
        display:"inline-flex", alignItems:"center", flexShrink:0, padding:0,
        boxShadow: value ? "inset 0 0 0 1px #15803d" : "inset 0 0 0 1px #b0bec5",
        opacity: editMode === 0 ? 0.5 : 1,
        pointerEvents: editMode === 0 ? "none" : "auto",
      }}
    >
      <span style={{
        position:"absolute", top:3, left: value ? 15 : 3,
        width:12, height:12, borderRadius:"50%", background:"#fff",
        transition:"left 0.18s ease",
        boxShadow:"0 1px 2px rgba(0,0,0,0.18)", display:"block",
      }} />
    </button>
  );
}


const applyChange = (prev, colKey, value) => {
  let fv = UPPER_KEYS.has(colKey) && typeof value === "string" ? value.toUpperCase() : value;
  let u = { ...prev, [colKey]: fv, _dirty: true };

  // ── Standard calc keys (ProfitPer excluded — handled separately) ──
  const STD_CALC = new Set(["PurchaseRate","GST","CESS","TransPer","MRP","GSTAmt","CESSAmt","TransAmt"]);
  if (STD_CALC.has(colKey)) {
    u = { ...u, ...calcRow(u, sess, colKey) };
  }

  // ── SalesRate → back-calculate ProfitPer (always allowed) ──
  if (colKey === "SalesRate") {
    const LC = vn(u.LandingCost), SR = vn(fv), d = SR - LC;
    u.ProfitPer = LC > 0 && d > 0 ? f2(ro(d / LC * 100)) : 0;
    u = { ...u, ...calcRow(u, sess, "SalesRate"), SalesRate: f2(vn(fv)) };
  }

  // ── ProfitAmt → update ProfitPer, but protect SalesRate if setting OFF ──
  if (colKey === "ProfitAmt") {
    const LC = vn(u.LandingCost), PA = vn(fv);
    u.ProfitPer = LC > 0 ? f2(PA / LC * 100) : 0;
    const prevSR = u.SalesRate;
    u = { ...u, ...calcRow(u, sess, "ProfitAmt") };
    if (!sess.PurchaseProfitSaleRateChange) u.SalesRate = prevSR;
  }

  // ── ProfitPer → recalc but protect SalesRate if setting OFF ──
  if (colKey === "ProfitPer") {
    const prevSR = u.SalesRate;
    u = { ...u, ...calcRow(u, sess, "ProfitPer") };
    if (!sess.PurchaseProfitSaleRateChange) u.SalesRate = prevSR;
  }

  // ── DMAmt / DMPer ──
  if (colKey === "DMAmt") { const M = vn(u.MRP), DA = vn(fv); u.DMPer = M > 0 ? f2(ro(DA / M * 100)) : 0; }
  if (colKey === "DMPer") { const M = vn(u.MRP), DP = vn(fv); u.DMAmt = f2(ro(M * DP / 100)); }

  return u;
};
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

  const { confirm, ConfirmUI } = CC.useConfirm();
  const { toast, toasts }      = CC.useToast();
  const { showAlert, AlertUI } = CC.useAlert(); 
const [bcOpen,  setBcOpen]  = useState(false);
const [bcRows,  setBcRows]  = useState([]);   // { barcode:"", Id:0, _new:true }
const [bcItemId, setBcItemId] = useState(null);
const [perm, setPerm] = useState({ View:0, Add:0, Edit:0, Delete:0 });
const [isAuthorized, setIsAuthorized] = useState(false);
  // ── dirtyIds ref — tracks rows actually typed in (same as CashierMaster) ──
  // CHANGE 2: dirtyIds added to track truly modified rows so selectRow won't revert them
  // மாற்றம் 2: உண்மையிலேயே திருத்திய rows-ஐ track பண்ண dirtyIds சேர்க்கப்பட்டது
  const dirtyIds = useRef(new Set());
  const pwOkRef = useRef(null);
  const [sess] = useState(() => {
    try {
      const main0 = (CC.getLocal("Mainsetting")    || [{}])[0] || {};
      const com0  = (CC.getLocal("Companysetting") || [{}])[0] || {};
      const Comid = CC.getStr("Comid") || "1";
      const MComid= CC.getStr("MComid") || Comid;
      const IdComList = CC.getStr("IdComList") || Comid;
      const isCC  = !!main0.CommonCompany;
      const isAG = com0.PCode_Auto === true || com0.PCode_Auto === 1 || com0.PCode_Auto === "1";
    
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
    const focusEntry = useCallback(colKey => {
    setTimeout(() => { const el=entryRefs.current[colKey]; if(el){el.focus();el.select?.();} }, 0);
  }, []);
  const handleMultiMRP = useCallback(async (colKey, value) => {
  if (!sess.MulipleMRP) return false;
  if (colKey !== "ProductCode") return false;
  const code = String(value || "").trim();
  if (!code) return false;

  // Only trigger for NEW entry row (no Id)
  if (entryRowRef.current?.Id) return false;

  const res = await CC.api(CC.ItemSelect, null, { "Download": "0" }, {
    Comid: sess.Comid, Startindex: 0, PageCount: 20,
    Keyword: code, Column: "MRP", webtype: 1
  });
  const arr = Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : [];
  if (!arr.length) return false;

  const ok = await confirm(`Do You Want To Add MultipleMRP Product?`);
  if (!ok) return false;

  const src = arr[0];
  setEntryRow(prev => ({
    ...prev,
    ProductName:      src.ProductName      || prev.ProductName,
    SecondCode:       src.SecondCode       || prev.SecondCode,
    PrinterName:      src.PrinterName      || prev.PrinterName,
    HSNCode:          src.HSNCode          || prev.HSNCode,
    Brand:            src.Brand            || prev.Brand,
    BrandId:          src.BrandId          || prev.BrandId,
    Category:         src.Category         || prev.Category,
    CategoryId:       src.CategoryId       || prev.CategoryId,
    Department:       src.Department       || prev.Department,
    DepartmentId:     src.DepartmentId     || prev.DepartmentId,
    Supplier:         src.Supplier         || prev.Supplier,
    SupplierId:       src.SupplierId       || prev.SupplierId,
    UOM:              src.UOM              || prev.UOM,
    UOMId:            src.UOMId            || prev.UOMId,
    LocationMaster:   src.LocationMaster   || prev.LocationMaster,
    LocationMasterId: src.LocationMasterId || prev.LocationMasterId,
    MRP:              f2(vn(src.MRP)),
    PurchaseRate:     f2(vn(src.PurchaseRate)),
    GST:              f2(vn(src.GST)),
    GSTAmt:           f2(vn(src.GSTAmt)),
    CESS:             f2(vn(src.CESS)),
    CESSAmt:          f2(vn(src.CESSAmt)),
    SPLCESS:          f2(vn(src.SPLCESS)),
    TransPer:         f2(vn(src.TransPer)),
    TransAmt:         f2(vn(src.TransAmt)),
    LandingCost:      f2(vn(src.LandingCost)),
    ProfitPer:        f2(vn(src.ProfitPer)),
    ProfitAmt:        f2(vn(src.ProfitAmt)),
    SalesRate:        f2(vn(src.SalesRate)),
    WholeSaleRate:    f2(vn(src.WholeSaleRate)),
    SaleDiscountPer:  f2(vn(src.SaleDiscountPer)),
    ReorderLevelMin:  f2(vn(src.ReorderLevelMin)),
    ReorderLevelMax:  f2(vn(src.ReorderLevelMax)),
    NomsQty:          parseInt(src.NomsQty) || 0,
    ExpriyDate:       !!src.ExpriyDate,
    ExpriyDays:       parseInt(src.ExpriyDays) || 0,
    ExpiryBeforeDays: parseInt(src.ExpiryBeforeDays) || 0,
    ManufactureDate:  !!src.ManufactureDate,
    Repacking:        !!src.Repacking,
    BrandType:        !!src.BrandType,
    ModelType:        !!src.ModelType,
    ColorType:        !!src.ColorType,
    SizeType:         !!src.SizeType,
    GenderType:       !!src.GenderType,
    SerialNoType:     !!src.SerialNoType,
    CRMPoints:        f2(vn(src.CRMPoints)),
    NegativetStock:   !!src.NegativetStock,
    BatchwiseStock:   !!src.BatchwiseStock,
    Active:           src.Active !== undefined ? !!src.Active : true,
    StockNeed:        !!src.StockNeed,
    SalesRateType:    !!src.SalesRateType,
    Remarks:          src.Remarks || prev.Remarks,
    _dirty: true,
  }));

  // Focus MRP after prefill, same as JS
  setTimeout(() => focusEntry("MRP"), 50);
  return true; // handled
// eslint-disable-next-line
}, [sess, confirm, focusEntry]);
const loadBarcodes = useCallback(async (itemId) => {
  const res = await CC.api(CC.ItemBarcodeSelect, null, {}, { Id: itemId });
  const arr = Array.isArray(res.data) ? res.data
            : Array.isArray(res)      ? res
            : [];
  // Each row: { Barcode, Id }
  setBcRows(arr.map(r => ({ barcode: r.Barcode || "", Id: r.Id || 0, _new: false })));
  setBcItemId(itemId);
  setBcOpen(true);
}, []);
useEffect(() => {
  const menuStr = localStorage.getItem("menulist");

  if (!menuStr) {
    alert("Session Close Please Login !!!.");
    navigate("/Login/Index");
    return;
  }

  const menulist = JSON.parse(menuStr);
  const menudata = menulist.filter(obj => obj.PageName === "Item Master"); // ← fixed from "Cashier"

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
// ── Save barcodes ─────────────────────────────────────────────────────────
const saveBarcodes = useCallback(async () => {
  if (!bcItemId) return;
  // Validate — no empty barcodes
  if (bcRows.some(r => !r.barcode.trim())) {
    toast("❌ Enter all barcode values.", true);
    return;
  }
  // Check duplicates
  const vals = bcRows.map(r => r.barcode.trim().toUpperCase());
  if (new Set(vals).size !== vals.length) {
    toast("❌ Duplicate barcodes found.", true);
    return;
  }
  setLoading(true); setLdMsg("Saving barcodes...");
  const payload = bcRows.map(r => ({ Barcode: r.barcode.trim().toUpperCase(), Id: r.Id || 0 }));
  const res = await CC.insertapi(CC.ItemBarcodeInsert, payload, {
    "ItemId":    String(bcItemId),
    "MComid":    String(sess.MComid),
    "MirrorTable": String(sess.MirrorTable),
    "IdComList": String(sess.IdComList),
  });
  setLoading(false);
  if (res.ok ?? res.IsSuccess) { toast("✅ Barcodes saved"); setBcOpen(false); }
  else toast(`❌ ${res.message || "Save failed"}`, true);
}, [bcItemId, bcRows, sess, toast]);
 useEffect(() => {
    const menuStr = localStorage.getItem("menulist");

    // 1. Check if session/menu exists
    if (!menuStr) {
      alert("Session Close Please Login !!!."); // Replace with your MsgBox / Toast
      navigate("/Login/Index");
      return;
    }

    const menulist = JSON.parse(menuStr);
    const menudata = menulist.filter(obj => obj.PageName === "Cashier");

    // 2. Check if page exists in user's menu
    if (!menudata || menudata.length === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => { navigate("/Home"); }, 3000);
      return;
    }

    // 3. Check if View permission is 0
    if (menudata[0].View === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => { navigate("/Home"); }, 3000);
      return;
    }

    // 4. User is valid, set permissions and allow rendering
    setPerm({
      View: menudata[0].View,
      Add: menudata[0].Add,
      Edit: menudata[0].Edit,
      Delete: menudata[0].Delete
    });
    
    setIsAuthorized(true);

  }, [navigate]);

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

  const [brandL,setBrandL]=useState([]);const[catL,setCatL]=useState([]);const[deptL,setDeptL]=useState([]);
  const[deptAll,setDeptAll]=useState([]);const[supL,setSupL]=useState([]);const[uomL,setUomL]=useState([]);const[locL,setLocL]=useState([]);

  const [ddPop,setDdPop]=useState(null);const[ddQ,setDdQ]=useState("");const[ddCtx,setDdCtx]=useState(null);const[ddHilite,setDdHilite]=useState(0);
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
  const rowRefs   = useRef([]);
  const draftOk   = useRef(false);

  useEffect(() => {
    if (!adminOpen) return;
    const h = e => { if (adminRef.current && !adminRef.current.contains(e.target)) setAdminOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [adminOpen]);
  useEffect(() => { rowsRef.current = rows; },      [rows]);
  useEffect(() => { entryRowRef.current = entryRow; }, [entryRow]);

  const visCols = cols.filter(c => c.visible);

  const editableKeys = visCols
    .map(vc => COLUMNS.find(c => c.key===vc.key))
    .filter(cd => cd && !cd.calc)
    .map(cd => cd.key);

  const rowValidator = useCallback(row =>
    String(row.ProductCode||"").trim().length > 0
  , []);



  const focusCell = useCallback((rid, colKey) => {
    setTimeout(() => { const el=cellRefs.current[rid]?.[colKey]; if(el){el.focus();el.select?.();} }, 0);
  }, []);

  const regRef = useCallback((rid, colKey, el) => {
    if (!cellRefs.current[rid]) cellRefs.current[rid] = {};
    if (el) cellRefs.current[rid][colKey] = el; else delete cellRefs.current[rid]?.[colKey];
  }, []);

  // CHANGE 3: enableEdit — single setRows call, no double-state conflict (same fix as CashierMaster)
  // மாற்றம் 3: enableEdit — ஒரே setRows call, double-state conflict இல்ல
  const enableEdit = useCallback((rid) => {
    setRows(prev => prev.map(r => {
      if (r._rid === rid) return { ...r, _editMode:1 };
      if (r._editMode === 1 && r.Id && !dirtyIds.current.has(r.Id)) return { ...r, _editMode:0 };
      return r;
    }));
    setSelRid(rid);
  }, []);

  // CHANGE 4: selectRow — only reverts OTHER rows, never the clicked row; no onFocus on tr
  // மாற்றம் 4: selectRow — வேற rows மட்டும் revert ஆகும், clicked row ஆகாது
  const selectRow = useCallback((rid) => {
    setRows(prev => prev.map(r => {
      if (r._rid !== rid && r._editMode === 1 && r.Id && !dirtyIds.current.has(r.Id))
        return { ...r, _editMode:0 };
      return r;
    }));
    setSelRid(rid);
  }, []);

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

  useEffect(() => {
    if (!draftOk.current) return;
    try { if(entryRow._dirty) sessionStorage.setItem(ITEM_DRAFT_KEY, JSON.stringify({entryRow,rows})); } catch {}
  }, [entryRow, rows]);

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

  const loadDropdowns = useCallback(async () => {
    const [br,ca,de,su,uo,lo] = await Promise.all([
      CC.api(CC.BrandSelect,       null,{},{Comid:sess.Comid}),
      CC.api(CC.CategorySelect,    null,{},{Comid:sess.Comid}),
      CC.api(CC.DepartmentSelect,  null,{},{Comid:sess.Comid}),
      CC.api(CC.GetSupplier,       null,{},{Comid:sess.Comid,AccountType:"SUPPLIER"}),
      CC.api(CC.UOMSelect,         null,{},{Comid:sess.Comid}),
      CC.api(CC.LocationSelect,    null,{},{Comid:sess.Comid}),
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
// ── Auto edit-mode when filter results in exactly 1 row ──────────────

  const loadItems = useCallback(async (kw="",col="",isInit=false) => {
    setLoading(true); setLdMsg("Loading Item Master...");
    const res = await CC.api(CC.ItemSelect, null, {"Download":"0"}, { Comid:sess.Comid,Startindex:0,PageCount:99999,Keyword:kw,Column:col,webtype:1 });
    setLoading(false);
    if(res._http404){toast(`❌ 404: ${res.message}`,true);return;}
    if(res._netErr) {toast(`❌ ${res.message}`,true);return;}
    const arr = Array.isArray(res.data)?res.data:Array.isArray(res)?res:[];
    if(isInit) setTotCnt(res.Count||arr.length);
  // In loadItems — keep it simple, no _editMode change here:
const fmt = arr.map(fmtRow);
setRows(fmt);
// remove the setSelRid for single row here too
setPage(Math.max(1, Math.ceil(fmt.length / ROWS_PER_PAGE)));
  }, [sess.Comid, toast]);

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

  // CHANGE 5: handleCellChange marks dirtyIds so selectRow won't revert it
  // மாற்றம் 5: handleCellChange-ல் dirtyIds mark ஆகுது — selectRow revert பண்ணாது
  const handleCellChange = useCallback((rid, colKey, value) => {
    setRows(prev => prev.map(r => {
      if (r._rid !== rid) return r;
      if (r.Id) dirtyIds.current.add(r.Id);
      return applyChange(r, colKey, value);
    }));
    setVErr("");
  // eslint-disable-next-line
  }, [sess]);

const validateRow = useCallback(async row => {
  if(!String(row.ProductCode||"").trim()){setVErr("❌ Product Code required.");return false;}
  if(!String(row.ProductName||"").trim()){setVErr("❌ Description required.");return false;}

  if(sess.LandingCostCompare){
    if(vn(row.SalesRate)&&vn(row.LandingCost)>vn(row.SalesRate)){setVErr("❌ Sale Rate < Landing Cost.");return false;}
    if(vn(row.MRP)&&vn(row.SalesRate)&&vn(row.MRP)<vn(row.SalesRate)){setVErr("❌ Sale Rate > MRP.");return false;}
  }

  if(vn(row.LandingCost)&&vn(row.MRP)&&vn(row.LandingCost)>vn(row.MRP)){
    await showAlert(
      `Landing Cost (${vn(row.LandingCost).toFixed(2)}) is greater than MRP (${vn(row.MRP).toFixed(2)}) for "${row.ProductCode}".`
    );
    return false;
  }

  if(vn(row.MRP)&&vn(row.PurchaseRate)&&vn(row.MRP)<vn(row.PurchaseRate)){setVErr("❌ Purchase Rate > MRP.");return false;}

  setVErr(""); return true;
}, [sess, showAlert]); // ← add showAlert here
  const buildPayload = useCallback(row => {
    const n=v=>parseFloat(v)||0,ni=v=>parseInt(v)||0,bi=v=>(v===true||v==="true"||v===1||v==="1")?1:0,b=v=>v===true||v==="true"||v===1||v==="1",s=v=>String(v==null?"":v);
    return { Id:ni(row.Id),ProductCode:s(row.ProductCode).trim(),SecondCode:s(row.SecondCode),ProductName:s(row.ProductName).trim(),PrinterName:s(row.PrinterName),HSNCode:s(row.HSNCode),Brand:s(row.Brand),BrandId:ni(row.BrandId),Category:s(row.Category),CategoryId:ni(row.CategoryId),Department:s(row.Department),DepartmentId:ni(row.DepartmentId),Supplier:s(row.Supplier),SupplierId:ni(row.SupplierId),UOM:s(row.UOM),UOMId:ni(row.UOMId),LocationMaster:s(row.LocationMaster),LocationMasterId:ni(row.LocationMasterId),NomsQty:ni(row.NomsQty),MRP:n(row.MRP),DMPer:n(row.DMPer),DMAmt:n(row.DMAmt),PurchaseRate:n(row.PurchaseRate),GST:n(row.GST),GSTAmt:n(row.GSTAmt),TransPer:n(row.TransPer),TransAmt:n(row.TransAmt),CESS:n(row.CESS),CESSAmt:n(row.CESSAmt),SPLCESS:n(row.SPLCESS),LandingCost:n(row.LandingCost),ProfitPer:n(row.ProfitPer),ProfitAmt:n(row.ProfitAmt),SalesRate:n(row.SalesRate),CardRate:n(row.CardRate),WholeSaleRate:n(row.WholeSaleRate),NomsPCRate:n(row.NomsPCRate),SalesRateType:b(row.SalesRateType),SaleDiscountPer:n(row.SaleDiscountPer),SaleDiscountAmt:n(row.SaleDiscountAmt),ReorderLevelMin:n(row.ReorderLevelMin),ReorderLevelMax:n(row.ReorderLevelMax),MaxSaleQty:n(row.MaxSaleQty),LessAmt:n(row.LessAmt),StockNeed:bi(row.StockNeed),ExpriyDate:bi(row.ExpriyDate),OnlineShow:bi(row.OnlineShow),BrandType:bi(row.BrandType),ModelType:bi(row.ModelType),ColorType:bi(row.ColorType),SizeType:bi(row.SizeType),SerialNoType:bi(row.SerialNoType),BatchwiseStock:bi(row.BatchwiseStock),Active:bi(row.Active),NegativetStock:b(row.NegativetStock),Repacking:b(row.Repacking),ExpriyDays:ni(row.ExpriyDays),ExpiryBeforeDays:ni(row.ExpiryBeforeDays),NetWeight:n(row.NetWeight),CRMPoints:n(row.CRMPoints),Remarks:s(row.Remarks),ProductImage:s(row.ProductImage) };
  }, []);

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
    if (!perm.Add && !perm.Edit) { toast("❌ Page Add & Update Permission Denied !!!", true); return; }
    const latestRows  = rowsRef.current;
    const latestEntry = entryRowRef.current;
    const eHas = String(latestEntry?.ProductCode || "").trim() || String(latestEntry?.ProductName  || "").trim();
    const dirtyRows = latestRows.filter(r => r._dirty && (String(r.ProductCode || "").trim() || String(r.ProductName || "").trim()));
    const entryComplete = String(latestEntry?.ProductCode || "").trim() && String(latestEntry?.ProductName || "").trim();
    const toSave = [];
    if (latestEntry?._dirty && entryComplete) toSave.push(latestEntry);
    toSave.push(...dirtyRows);
    if (!toSave.length) { toast("⚠️ No modified data to save.", true); return; }
   for (const row of toSave) { if (!(await validateRow(row))) return; }
    const ok = await confirm("Do you want to Save Item Master Details?");
    if (!ok) return;
    setLoading(true); setLdMsg("Saving...");
    const hdrs = { "Comid":String(sess.Comid),"Commoncompany":String(sess.CommonCompany),"CommoncompanyDiffStock":String(sess.CommonCompanyDiffStock),"SupplierMulitipleAllow":String(sess.SupplierMulitipleAllow),"MulipleMRP":String(sess.MulipleMRP),"MirrorTable":String(sess.MirrorTable),"Tamil":String(sess.Tamil),"IdComList":String(sess.IdComList),"ApiType":"0" };
    const payload = toSave.map(buildPayload);
    const res = await CC.insertapi(CC.ItemInsert, payload, hdrs);
    setLoading(false);
    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }
    if (res.ok ?? res.IsSuccess) {
      dirtyIds.current.clear();
      toast("✅ " + (res.message || "Saved successfully"));
      try { sessionStorage.removeItem(ITEM_DRAFT_KEY); } catch {}
      if (entryComplete && latestEntry?._dirty) {
        const saved = { ...latestEntry, _dirty:false, _isNew:false, _editMode:0, Id:res.Id||latestEntry.Id||latestEntry._rid };
        setRows(prev => [...prev.map(r => r._dirty ? { ...r, _dirty:false, _editMode:0 } : r), saved]);
        resetEntry();
      } else {
        setRows(prev => prev.map(r => r._dirty ? { ...r, _dirty:false, _editMode:0 } : r));
      }
    } else { toast(`❌ ${res.message || "Save failed"}`, true); }
  }, [perm, validateRow, confirm, buildPayload, toast, sess, resetEntry]);

  const entryRowIndex = rows.length;
  const doExcelUpload = useCallback(() => {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = ".csv,.xlsx";
  inp.onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text();

    // Parse CSV — handle quoted fields
    const parseCSV = raw => {
      const lines = raw.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) return [];
      const splitLine = line => {
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

    const records = parseCSV(text).filter(o => o["Product Code"] || o["ProductCode"]);
    if (!records.length) { toast("❌ No valid rows found. Check file format.", true); return; }

    // Map CSV columns → payload fields
    const labelToKey = {};
    COLUMNS.forEach(c => { labelToKey[c.label] = c.key; });
    labelToKey["Id"] = "Id";
    labelToKey["Product Code"] = "ProductCode";

    const toSave = records.map(row => {
      const mapped = {};
      Object.entries(row).forEach(([h, v]) => {
        const key = labelToKey[h] || h;
        mapped[key] = v;
      });
      // Build proper payload
      const n  = v => parseFloat(v)  || 0;
      const ni = v => parseInt(v)    || 0;
      const bi = v => (v === "true" || v === "1" || v === true) ? 1 : 0;
      const b  = v => v === "true" || v === "1" || v === true;
      const s  = v => String(v == null ? "" : v);
      return {
        Id:              ni(mapped.Id),   // 0 = insert, >0 = update
        ProductCode:     s(mapped.ProductCode).trim(),
        SecondCode:      s(mapped.SecondCode),
        ProductName:     s(mapped.ProductName).trim(),
        PrinterName:     s(mapped.PrinterName),
        HSNCode:         s(mapped.HSNCode),
        Brand:           s(mapped.Brand),           BrandId:          ni(mapped.BrandId),
        Category:        s(mapped.Category),        CategoryId:       ni(mapped.CategoryId),
        Department:      s(mapped.Department),      DepartmentId:     ni(mapped.DepartmentId),
        Supplier:        s(mapped.Supplier),        SupplierId:       ni(mapped.SupplierId),
        UOM:             s(mapped.UOM),             UOMId:            ni(mapped.UOMId),
        LocationMaster:  s(mapped.LocationMaster),  LocationMasterId: ni(mapped.LocationMasterId),
        NomsQty:         ni(mapped.NomsQty),
        MRP:             n(mapped.MRP),             DMPer:            n(mapped.DMPer),
        DMAmt:           n(mapped.DMAmt),           PurchaseRate:     n(mapped.PurchaseRate),
        GST:             n(mapped.GST),             GSTAmt:           n(mapped.GSTAmt),
        TransPer:        n(mapped.TransPer),        TransAmt:         n(mapped.TransAmt),
        CESS:            n(mapped.CESS),            CESSAmt:          n(mapped.CESSAmt),
        SPLCESS:         n(mapped.SPLCESS),         LandingCost:      n(mapped.LandingCost),
        ProfitPer:       n(mapped.ProfitPer),       ProfitAmt:        n(mapped.ProfitAmt),
        SalesRate:       n(mapped.SalesRate),       CardRate:         n(mapped.CardRate),
        WholeSaleRate:   n(mapped.WholeSaleRate),   NomsPCRate:       n(mapped.NomsPCRate),
        SalesRateType:   b(mapped.SalesRateType),
        SaleDiscountPer: n(mapped.SaleDiscountPer), SaleDiscountAmt:  n(mapped.SaleDiscountAmt),
        ReorderLevelMin: n(mapped.ReorderLevelMin), ReorderLevelMax:  n(mapped.ReorderLevelMax),
        MaxSaleQty:      n(mapped.MaxSaleQty),      LessAmt:          n(mapped.LessAmt),
        StockNeed:       bi(mapped.StockNeed),      ExpriyDate:       bi(mapped.ExpriyDate),
        OnlineShow:      bi(mapped.OnlineShow),     BrandType:        bi(mapped.BrandType),
        ModelType:       bi(mapped.ModelType),      ColorType:        bi(mapped.ColorType),
        SizeType:        bi(mapped.SizeType),       SerialNoType:     bi(mapped.SerialNoType),
        BatchwiseStock:  bi(mapped.BatchwiseStock), Active:           bi(mapped.Active),
        NegativetStock:  b(mapped.NegativetStock),  Repacking:        b(mapped.Repacking),
        ExpriyDays:      ni(mapped.ExpriyDays),     ExpiryBeforeDays: ni(mapped.ExpiryBeforeDays),
        NetWeight:       n(mapped.NetWeight),       CRMPoints:        n(mapped.CRMPoints),
        Remarks:         s(mapped.Remarks),         ProductImage:     s(mapped.ProductImage),
        GenderType:      bi(mapped.GenderType),
      };
    });

    const newCount  = toSave.filter(r => !r.Id || r.Id === 0).length;
    const editCount = toSave.filter(r => r.Id  && r.Id > 0).length;

    const ok = window.confirm(
      `Upload ${toSave.length} rows?\n➕ New: ${newCount}\n✏️ Edit: ${editCount}\n\nProceed?`
    );
    if (!ok) return;

    setLoading(true); setLdMsg(`Uploading ${toSave.length} rows...`);
    const hdrs = {
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
    const res = await CC.insertapi(CC.ItemInsert, toSave, hdrs);
    setLoading(false);
    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }
    if (res.ok ?? res.IsSuccess) {
      toast(`✅ ${res.message || `Uploaded — ${newCount} added, ${editCount} updated`}`);
      await loadItems("", "", true);
    } else {
      toast(`❌ ${res.message || "Upload failed"}`, true);
    }
  };
  inp.click();
}, [sess, toast, loadItems]);
const doExcelDownload = useCallback(async () => {
  setLoading(true); setLdMsg("Preparing Excel...");
  const res = await CC.api(
    CC.ItemSelect, null,
    { "Download": "1" },
    { Comid: sess.Comid, Startindex: 0, PageCount: 99999, Keyword: "", Column: "" }
  );
  setLoading(false);
  const data1 = (res.data || res.Data1 || rows.filter(r => r.Id));
  if (!data1?.length) { toast("No records to export", true); return; }

  // Columns to export — Id first, then all COLUMNS
  const exportCols = [
    { key: "Id",          label: "Id" },
    { key: "ProductCode", label: "Product Code" },
    ...COLUMNS.filter(c => c.key !== "ProductCode").map(c => ({ key: c.key, label: c.label })),
  ];

const fmt = data1.map((o) => {
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
  a.href = url; a.download = "itemmaster.csv"; a.click();
  URL.revokeObjectURL(url);
  toast("✅ Excel downloaded");
}, [sess.Comid, rows, toast]);
const handleEntryKeyDown = useCallback((e, colKey) => {
  if (e.key === "Enter") {
    // ── MultiMRP check ──────────────────────────────────────
    if (colKey === "ProductCode" && sess.MulipleMRP) {
      e.preventDefault();
      handleMultiMRP(colKey, entryRowRef.current?.ProductCode).then(handled => {
        if (!handled) {
          // normal Enter navigation
          const colIdx = editableKeys.indexOf(colKey);
          const proxyRefs = { current: [] };
          proxyRefs.current[0] = {};
          editableKeys.forEach((k, i) => { proxyRefs.current[0][i] = entryRefs.current[k]; });
          CC.handleEnterNext(e, proxyRefs, 0, colIdx, editableKeys.length, 1, doSave, [entryRowRef.current], rowValidator);
        }
      });
      return;
    }
    // ── normal Enter ─────────────────────────────────────────
    const colIdx = editableKeys.indexOf(colKey);
    const proxyRefs = { current: [] };
    proxyRefs.current[0] = {};
    editableKeys.forEach((k, i) => { proxyRefs.current[0][i] = entryRefs.current[k]; });
    CC.handleEnterNext(e, proxyRefs, 0, colIdx, editableKeys.length, 1, doSave, [entryRow], rowValidator);
    return;
  }
  // ... rest of Tab/Arrow handlers unchanged
// eslint-disable-next-line
}, [editableKeys, focusEntry, focusCell, entryRow, rowValidator, doSave, entryRowIndex, sess, handleMultiMRP]);

  const filteredRows = rows.filter(r => {
    for(const[k,v]of Object.entries(colFilters)){if(!v?.trim())continue;if(!String(r[k]??"").toLowerCase().includes(v.trim().toLowerCase()))return false;}
    return true;
  });
  useEffect(() => {
  if (filteredRows.length !== 1) return;
  const r = filteredRows[0];
  if (!r?.Id) return;
  if (r._editMode === 1) return; // already in edit mode
  setRows(prev => prev.map(x =>
    x._rid === r._rid ? { ...x, _editMode: 1 } : x
  ));
  setSelRid(r._rid);
}, [filteredRows.length, filteredRows[0]?._rid]);
  const totPages  = Math.max(1,Math.ceil(filteredRows.length/ROWS_PER_PAGE));
  const pagedRows = filteredRows.slice((page-1)*ROWS_PER_PAGE,page*ROWS_PER_PAGE);
  const pageNums  = (() => {
    if(totPages<=10) return Array.from({length:totPages},(_,i)=>i+1);
    const s=new Set([1,totPages]); for(let i=Math.max(1,page-3);i<=Math.min(totPages,page+3);i++)s.add(i); return Array.from(s).sort((a,b)=>a-b);
  })();

  const handleCellKeyDown = useCallback((e, rid, colKey) => {
    if (e.key === "Enter") {
      const rowIdx = pagedRows.findIndex(r => r._rid === rid);
      const colIdx = editableKeys.indexOf(colKey);
      CC.handleEnterNext(e, { current:rowRefs.current }, rowIdx, colIdx, editableKeys.length, pagedRows.length, () => { focusEntry(editableKeys[0]); }, pagedRows, rowValidator);
      return;
    }
    if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); const i=editableKeys.indexOf(colKey); if(i<editableKeys.length-1) focusCell(rid,editableKeys[i+1]); return; }
    if (e.key === "Tab" && e.shiftKey)  { e.preventDefault(); const i=editableKeys.indexOf(colKey); if(i>0) focusCell(rid,editableKeys[i-1]); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); const ri=pagedRows.findIndex(r=>r._rid===rid); if(ri<pagedRows.length-1) focusCell(pagedRows[ri+1]._rid,colKey); return; }
    if (e.key === "ArrowUp")   { e.preventDefault(); const ri=pagedRows.findIndex(r=>r._rid===rid); if(ri>0) focusCell(pagedRows[ri-1]._rid,colKey); else focusEntry(colKey); return; }
  // eslint-disable-next-line
  }, [editableKeys,focusCell,focusEntry,pagedRows,rowValidator]);

  const anyOpen = f12Open||ddPop||bsrOpen||gcOpen||tnOpen||pw||adminOpen;
  useEffect(() => {
    const onKey = e => {
      if (anyOpen) return;
      if (e.key==="F1")     { e.preventDefault(); doSave(); }
       if (e.key === "F4")     { e.preventDefault(); pwOkRef.current = doExcelDownload; setPw({title:"F4 Password"}); }
    if (e.key === "F7")     { e.preventDefault(); pwOkRef.current = doExcelUpload;   setPw({title:"F7 Password"}); }
    if (e.key === "F9") {
  e.preventDefault();
  const r = rowsRef.current.find(x => x._rid === selRid);
  if (!r?.Id) { toast("Select a saved item first", true); return; }
  loadBarcodes(r.Id);
}
      if (e.key==="F12")    { e.preventDefault(); setF12Open(true); }
      if (e.key==="Delete"&&selRid) { e.preventDefault(); doDeleteRow(selRid); }
      if (e.key==="Escape") { e.preventDefault(); navigate(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line
  }, [anyOpen, doSave, doExcelDownload, doExcelUpload, selRid, doDeleteRow]);

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

  const onMD=e=>{const el=gRef.current;drag.current={on:true,x:e.pageX-el.offsetLeft,y:e.pageY-el.offsetTop,sl:el.scrollLeft,st:el.scrollTop};};
  const onML=()=>{drag.current.on=false;};
  const onMU=()=>{drag.current.on=false;};
  const onMM=e=>{if(!drag.current.on)return;e.preventDefault();const el=gRef.current;el.scrollLeft=drag.current.sl-((e.pageX-el.offsetLeft)-drag.current.x)*1.4;el.scrollTop=drag.current.st-((e.pageY-el.offsetTop)-drag.current.y)*1.4;};

  // ── Cell input style helper (border-none in view mode, blue border in edit mode) ──
  // CHANGE 6: View mode → border none, transparent bg. Edit mode → blue border, white bg
  // மாற்றம் 6: View mode-ல் border none; Edit mode-ல் blue border, white bg
  const cellInputStyle = (editMode) => ({
    background:   editMode === 0 ? "transparent" : "#fff",
    border:       editMode === 0 ? "none"        : "1px solid #93c5fd",
    cursor:       editMode === 0 ? "default"     : "text",
    color:        editMode === 0 ? "inherit"     : "#1e293b",
    boxShadow:    editMode === 0 ? "none"        : "0 0 0 2px rgba(59,130,246,0.15)",
    borderRadius: editMode === 1 ? "4px"         : "0",
    padding:      editMode === 0 ? "2px 4px"     : undefined,
  });

  // CHANGE 7: Decimal display helper — 55 → "55.00", used in view mode for f2/f3
  // மாற்றம் 7: Decimal display helper — view mode-ல் 55 → "55.00"
  const fmtDisplay = (val, type) => {
    if (val === "" || val === undefined || val === null) return "";
    if (type === "f3") return parseFloat(vn(val)).toFixed(3);
    if (type === "f2") return parseFloat(vn(val)).toFixed(2);
    return String(val);
  };

  // ── renderCell ────────────────────────────────────────────────────────────
  const renderCell = useCallback((row, col, rowIdx) => {
    const cd=COLUMNS.find(c=>c.key===col.key); if(!cd) return null;
    const rid=row._rid, val=row[cd.key];
    const colIdx=editableKeys.indexOf(cd.key);
    const onFocus=()=>setSelRid(rid);
    const editMode = row._editMode ?? 0;

    const regRowRef = el => {
      if(!rowRefs.current[rowIdx]) rowRefs.current[rowIdx]=[];
      if(colIdx>=0){ if(el) rowRefs.current[rowIdx][colIdx]=el; }
      regRef(rid,cd.key,el);
    };

    // Calc columns — always show formatted decimal
    if(cd.calc) return (
      <span className={cd.key==="LandingCost"?"lc-value":"calc-val"}>
        {cd.type==="f2" ? vn(val).toFixed(2) : cd.type==="f3" ? vn(val).toFixed(3) : String(val??"")}
      </span>
    );

    // CHANGE 8: bool → Toggle component (same as CashierMaster), not select
    // மாற்றம் 8: bool columns → Toggle component, select இல்ல
    if(cd.bool) return (
      <div style={{ display:"flex", justifyContent:"center" }}>
        <Toggle
          ref={regRowRef}
          inputRef={regRowRef}
          value={!!val}
          editMode={editMode}
          onChange={v => handleCellChange(rid, cd.key, v)}
          onKeyDown={e => handleCellKeyDown(e, rid, cd.key)}
        />
      </div>
    );

    if(cd.isCombo) return (
      <input ref={regRowRef} type="text" value={ns(val)}
        readOnly
        className="mp-cell-input"
        style={{ ...cellInputStyle(editMode), cursor: editMode === 0 ? "default" : "pointer", caretColor:"transparent" }}
        placeholder={editMode === 1 ? "▼ "+cd.label : ""}
        onFocus={onFocus}
        onClick={() => editMode === 1 && openCombo(rid, cd.key)}
        onKeyDown={e=>{if((e.key==="Enter"||e.key==="F4")&&editMode===1){e.preventDefault();openCombo(rid,cd.key);}else handleCellKeyDown(e,rid,cd.key);}}
      />
    );

    // CHANGE 9: f2/f3 — view mode shows formatted decimal (55 → 55.00), edit mode shows raw value
    // மாற்றம் 9: f2/f3 — view mode-ல் "55.00" காட்டும், edit mode-ல் raw value
    if(cd.type==="f2"||cd.type==="f3") return (
      <input ref={regRowRef} type={editMode === 1 ? "number" : "text"}
        step={cd.type==="f3"?"0.001":"0.01"}
        value={editMode === 0 ? fmtDisplay(val, cd.type) : (val===""||val===undefined?"":val)}
        className="mp-cell-input"
        style={cellInputStyle(editMode)}
        readOnly={editMode === 0}
        onChange={e => editMode === 1 && handleCellChange(rid, cd.key, e.target.value)}
        onKeyDown={e => editMode === 1 && handleCellKeyDown(e, rid, cd.key)}
        onFocus={onFocus}
        placeholder={editMode === 1 ? "0.00" : ""}
      />
    );

    if(cd.type==="int") return (
      <input ref={regRowRef} type={editMode === 1 ? "number" : "text"} step="1"
        value={editMode === 0 ? (val||"0") : (val===""||val===undefined?"":val)}
        className="mp-cell-input"
        style={cellInputStyle(editMode)}
        readOnly={editMode === 0}
        onChange={e => editMode === 1 && handleCellChange(rid, cd.key, e.target.value)}
        onKeyDown={e => editMode === 1 && handleCellKeyDown(e, rid, cd.key)}
        onFocus={onFocus}
        placeholder={editMode === 1 ? "0" : ""}
      />
    );

    return (
      <input ref={regRowRef} type="text" value={ns(val)}
        className="mp-cell-input"
        style={cellInputStyle(editMode)}
        readOnly={editMode === 0}
        onChange={e => editMode === 1 && handleCellChange(rid, cd.key, e.target.value)}
        onKeyDown={e => editMode === 1 && handleCellKeyDown(e, rid, cd.key)}
        onFocus={onFocus}
        placeholder={editMode === 1 ? cd.label : ""}
      />
    );
  }, [handleCellChange,handleCellKeyDown,regRef,openCombo,editableKeys,cellInputStyle,fmtDisplay]);

  const renderEntryCell = useCallback(col => {
    const cd=COLUMNS.find(c=>c.key===col.key); if(!cd) return null;
    const val=entryRow[cd.key];
    const reg=el=>{if(entryRefs.current) entryRefs.current[cd.key]=el;};

    if(cd.calc) return <span className={cd.key==="LandingCost"?"lc-value":"calc-val"} style={{display:"block",padding:"2px 6px"}}>{cd.type==="f2"?vn(val).toFixed(2):cd.type==="f3"?vn(val).toFixed(3):String(val??"")}</span>;

    // CHANGE 10: Entry row bool → Toggle too (always editMode=1)
    // மாற்றம் 10: Entry row-ல் bool → Toggle (எப்போதும் editMode=1)
    if(cd.bool) return (
      <div style={{ display:"flex", justifyContent:"center" }}>
        <Toggle
          inputRef={reg}
          value={!!val}
          editMode={1}
          onChange={v => handleEntryChange(cd.key, v)}
          onKeyDown={e => handleEntryKeyDown(e, cd.key)}
        />
      </div>
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

  const totW = SNO_W + EDIT_W + DEL_W + visCols.reduce((s,c)=>s+c.width,0);
  const eHas = String(entryRow.ProductCode||"").trim()||String(entryRow.ProductName||"").trim();
if (!isAuthorized) {
    return null; // Or return a <Loader /> component
  }
  // At the top of your return, before everything else:
if (!isAuthorized) return null;
  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="mp-wrap">
      {ConfirmUI}
      {AlertUI}
      {f12Open && <F12Popup colSettings={cols} onSave={saveColCfg} onClose={()=>setF12Open(false)} />}
{bcOpen && (
  <div className="mp-ov" onClick={e => { if (e.target === e.currentTarget) setBcOpen(false); }}>
    <div className="mp-modal-box" style={{ width: 460, maxHeight: "65vh" }}>
      <div className="mp-modal-hdr">
        <span>🔖 Barcode List</span>
        <button onClick={() => setBcOpen(false)}>✕</button>
      </div>

      <div className="mp-modal-body">
        <table className="mp-utbl" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th style={{ width: 36 }}>S.No</th>
              <th>Barcode</th>
              <th style={{ width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {bcRows.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign:"center", color:"#94a3b8", padding:14, fontSize:11 }}>
                  No barcodes. Click ➕ to add.
                </td>
              </tr>
            ) : (
              bcRows.map((r, i) => (
                <tr key={i}>
                  <td style={{ textAlign:"center", fontSize:11, color:"#64748b" }}>{i + 1}</td>
                  <td>
                    <input
                      type="text"
                      value={r.barcode}
                      autoFocus={i === bcRows.length - 1 && r._new}
                      style={{ width:"100%", padding:"3px 6px", border:"1px solid #c5d8f8", borderRadius:3, fontSize:12 }}
                      onChange={e => {
                        const v = e.target.value.toUpperCase();
                        setBcRows(p => p.map((x, j) => j === i ? { ...x, barcode: v } : x));
                      }}
                      onKeyDown={e => {
                        // Enter → add new row if last
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (i === bcRows.length - 1) {
                            setBcRows(p => [...p, { barcode:"", Id:0, _new:true }]);
                          }
                        }
                        // Delete key on empty → remove row
                        if (e.key === "Delete" && !r.barcode) {
                          setBcRows(p => p.filter((_, j) => j !== i));
                        }
                      }}
                    />
                  </td>
                  <td style={{ textAlign:"center" }}>
                    <button
                      onClick={() => setBcRows(p => p.filter((_, j) => j !== i))}
                      style={{ background:"none", border:"none", cursor:"pointer", color:"#dc2626", fontSize:14 }}
                      title="Delete barcode"
                    >🗑</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Add row button */}
        <button
          className="mp-btn nw"
          style={{ marginTop: 8 }}
          onClick={() => setBcRows(p => [...p, { barcode:"", Id:0, _new:true }])}
        >
          ➕ Add Barcode
        </button>
      </div>

      <div className="mp-modal-ftr">
        <button className="mp-btn" onClick={() => setBcOpen(false)}>Cancel</button>
        <button className="mp-btn sv" onClick={saveBarcodes} disabled={loading}>💾 Save</button>
      </div>
    </div>
  </div>
)}
      {/* Header */}
      <div className="mp-hdr">
        <div className="mp-hdr-left">
          <div className="mp-icon">I</div>
          <div>
            <div className="mp-title">Item Master</div>
            <div className="mp-sub">Co: {sess.Comid} — Manage items</div>
          </div>
        </div>
        <div className="mp-hdr-center">⬛ KASSA BM</div>
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

        {/* ── TOP Toolbar ── */}
       

        {/* Pagination + status */}
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

        {/* Grid */}
        <div className="mp-grid-wrap">
          <div className="mp-gscroll" ref={gRef}
            onMouseDown={onMD} onMouseLeave={onML} onMouseUp={onMU} onMouseMove={onMM}>
            <table className="mp-tbl" style={{width:totW,minWidth:totW}}>
         <thead>
  {/* Single header row with filter inputs INSIDE each th */}
  <tr className="mp-col-row">
    <th style={{width:SNO_W, position:"sticky", top:0, zIndex:5}}>
      S.No
    </th>
    <th style={{width:EDIT_W, position:"sticky", top:0, zIndex:5}}></th>
    {visCols.map(c => {
      const cd = COLUMNS.find(x => x.key === c.key);
      return (
        <th key={c.key} style={{
          width:c.width, minWidth:c.width,
          textAlign: cd?.bool ? "center" : undefined,
          position:"sticky", top:0, zIndex:5,
          paddingBottom: FILTER_KEYS.has(c.key) ? "2px" : undefined,
        }}>
          <div style={{marginBottom: FILTER_KEYS.has(c.key) ? 3 : 0}}>
            {c.label}{cd?.calc && <span style={{color:"#a8c8f5",fontSize:9,marginLeft:2}}></span>}
          </div>
          {FILTER_KEYS.has(c.key) && (
            <input
              className="mp-col-filter"
              value={colFilters[c.key]||""}
              onChange={e=>{setColFilters(p=>({...p,[c.key]:e.target.value}));setPage(1);}}
              placeholder={`🔍`}
              style={{
                width:"100%", height:18, fontSize:10,
                background:"rgba(255,255,255,0.15)",
                border:"1px solid rgba(255,255,255,0.3)",
                borderRadius:3, padding:"1px 4px",
                color:"#000", outline:"none",fontWeight:600,
              }}
              onClick={e => e.stopPropagation()}
            />
          )}
        </th>
      );
    })}
    <th style={{width:DEL_W, position:"sticky", top:0, zIndex:5}}></th>
  </tr>
</thead>

              <tbody>
                {pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={visCols.length + 3} className="mp-empty">
                      No records. Press ➕ to add an item.
                    </td>
                  </tr>
                ) : (
                  pagedRows.map((row, idx) => {
                    const editMode = row._editMode ?? 0;
                    return (
                      <tr
                        key={row._rid}
                        className={[
                          selRid === row._rid                      ? "sel"   : "",
                          row.Active===false||row.Active===0       ? "inact" : "",
                           row._editMode === 1       ? "editing" : "",  
                          row._dirty                               ? "mod"   : "",
                        ].filter(Boolean).join(" ")}
                        // CHANGE 12: onClick only, NO onFocus on tr (fixes toggle bug)
                        // மாற்றம் 12: tr-ல் onClick மட்டும், onFocus இல்ல (toggle bug fix)
                        onClick={() => selectRow(row._rid)}
                      >
                        <td className="sno">{(page-1)*ROWS_PER_PAGE+idx+1}</td>

                        {/* CHANGE 13: Edit icon cell — ✏️ when view, green ✏️ when editing */}
                        {/* மாற்றம் 13: Edit icon cell — view-ல் ✏️, edit-ல் பச்சை ✏️ */}
                        <td style={{ textAlign:"center", whiteSpace:"nowrap" }}>
                          {row.Id && editMode === 0 && (
                            <button
                              className="mp-edit-btn"
                              title="Edit row"
                              onClick={e => { e.stopPropagation(); enableEdit(row._rid); }}
                            >✏️</button>
                          )}
                          {row.Id && editMode === 1 && (
                            <button
                              className="mp-edit-btn active"
                              title="Editing…"
                              style={{ color:"#16a34a", cursor:"default" }}
                            >✏️</button>
                          )}
                        </td>

                        {visCols.map(col => (
                          <td
                            key={col.key}
                            style={{ textAlign: COLUMNS.find(x=>x.key===col.key)?.bool ? "center" : undefined }}
                            onClick={e => {
                              e.stopPropagation();
                              selectRow(row._rid);
                              if (editMode === 1) {
                                setTimeout(() => {
                                  const el = cellRefs.current[row._rid]?.[col.key];
                                  if (el) { el.focus(); el.select?.(); }
                                }, 20);
                              }
                            }}
                          >
                            {renderCell(row, col, idx)}
                          </td>
                        ))}

                        <td style={{ textAlign:"center" }}>
                          <button
                            className="mp-del-btn"
                            onClick={e => { e.stopPropagation(); doDeleteRow(row._rid); }}
                          >🗑</button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Entry row in tfoot */}
              <tfoot>
                <tr>
                  <td className="mp-entry-sno">★ New</td>
                  <td></td>
                  {visCols.map(col=>(
                    <td key={col.key} style={{ textAlign: COLUMNS.find(x=>x.key===col.key)?.bool ? "center" : undefined }}>
                      {renderEntryCell(col)}
                    </td>
                  ))}
                  <td className="mp-entry-actions">
                    {eHas
                      ? <div style={{display:"flex",gap:3,justifyContent:"center"}}>
                          <button className="mp-entry-save"  onClick={doSave}    title="Save (F1)">💾</button>
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

        {/* CHANGE 14: Bottom toolbar — F1 Save + Add Row (same as CashierMaster) */}
        {/* மாற்றம் 14: Bottom toolbar — F1 Save + Add Row (CashierMaster போல்) */}
        <div className="mp-toolbar">
          <button className="mp-btn sv" onClick={doSave}    disabled={loading}>💾 F1 Save</button>
          <button className="mp-btn nw" onClick={resetEntry} disabled={loading}>➕ New Entry</button>
                    <button className="mp-btn"    onClick={()=>setF12Open(true)}>⚙ F12 Columns</button>
          <button className="mp-btn"    onClick={async () => { await loadItems("","",true); resetEntry(); }} disabled={loading}>🔄 Reload</button>
   
<button className="mp-btn ex" onClick={() => { pwOkRef.current = doExcelDownload; setPw({title:"F4 Password"}); }}>
  📥 F4 Excel↓
</button>
<button className="mp-btn ex" onClick={() => { pwOkRef.current = doExcelUpload; setPw({title:"F7 Password"}); }}>
  📤 F7 Excel↑
</button>

<button className="mp-btn" onClick={() => {
  const r = rows.find(x => x._rid === selRid);
  if (!r?.Id) { toast("Select a saved item first", true); return; }
  loadBarcodes(r.Id);
}} disabled={!selRid}>🔖 F9 Barcode</button>
{pw && (
  <PwModal
    title={pw.title}
    comid={sess.Comid}
    onOk={() => { pwOkRef.current?.(); }}
    onClose={() => setPw(null)}
  />
)}
          {sess.GroupCommission && <button className="mp-btn" onClick={async()=>{const r=rows.find(x=>x._rid===selRid);if(!r?.Id){toast("Select a saved row first",true);return;}const res=await CC.api(CC.ItemGroupCommission,null,{},{Id:r.Id,Comid:sess.Comid});setGcRows(!res._netErr&&(res.data||res.Data1)?res.data||res.Data1:[]);setGcOpen(true);}} disabled={!selRid}>💰 Group Commission</button>}
          <button className="mp-btn"    onClick={()=>{const r=rows.find(x=>x._rid===selRid);setTnVal(r?ns(r.PrinterName):"");setTnOpen(true);}} disabled={!selRid}>🌐 F6 Tamil Name</button>
          <button className="mp-btn dl" onClick={()=>selRid?doDeleteRow(selRid):toast("Select a row to delete",true)} disabled={!selRid||loading}>🗑 Delete</button>
          <button className="mp-btn dl" onClick={()=>navigate(-1)}>✕ Esc Cancel</button>
        </div>

        {/* Hint bar */}
       
      </div>

      {/* Loading overlay */}
      {loading&&(
        <div className="mp-loader-ov">
          <div className="mp-ldr-box">
            <div className="mp-spin"/>
            <div className="mp-ldr-msg">{ldMsg}</div>
          </div>
        </div>
      )}

      <CC.ToastList toasts={toasts}/>

      {ddPop&&<ComboPopup ddPop={ddPop} ddQ={ddQ} setDdQ={setDdQ} ddFilt={ddFilt} ddHilite={ddHilite} setDdHilite={setDdHilite} ddHiliteC={ddHiliteC} selectDd={selectDd} handleDdConfirm={handleDdConfirm} isNewValue={isNewVal} onClose={closeDd}/>}
      {pw&&<PwModal title={pw.title} comid={sess.Comid} onOk={pw.onOk} onClose={()=>setPw(null)}/>}

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
