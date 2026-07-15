const fs = require('fs');
const path = "e:/KodeeWorkSpaceNew/WebBillingV7.1React/src/components/Itemmaster.jsx";
let content = fs.readFileSync(path, 'utf8');

const startStr = 'const F2K = ["MRP","PurchaseRate","GST","GSTAmt","TransPer","TransAmt","CESS","CESSAmt","SPLCESS","LandingCost","ProfitPer","ProfitAmt","SalesRate","WholeSaleRate","SaleDiscountPer","SaleDiscountAmt","ReorderLevelMin","ReorderLevelMax","CRMPoints","DMPer","DMAmt","CardRate","LessAmt","NomsPCRate"];';
const endStr = "// ── F12 Column Settings Popup ─────────────────────────────────────────────────";

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `const F2K = ["MRP","PurchaseRate","GST","GSTAmt","TransPer","TransAmt","CESS","CESSAmt","SPLCESS","LandingCost","ProfitPer","ProfitAmt","SalesRate","WholeSaleRate","SaleDiscountPer","SaleDiscountAmt","ReorderLevelMin","ReorderLevelMax","CRMPoints","DMPer","DMAmt","CardRate","LessAmt","NomsPCRate"];
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
  let GST,GSTAmt;
  if(changedKey==="GSTAmt"){
    GSTAmt=row.GSTAmt===""?"":vn(row.GSTAmt);
    GST=PR>0?ro(vn(GSTAmt)/PR*100):(row.GST===""?"":0);
  }else{
    GST=row.GST===""?"":vn(row.GST);
    GSTAmt=ro(PR*vn(GST)/100);
  }
  let CESS,CessAmt; if(changedKey==="CESSAmt"){CessAmt=vn(row.CESSAmt);CESS=PR>0?ro(CessAmt/PR*100):0;}else{CESS=vn(row.CESS);CessAmt=ro(PR*CESS/100);}
  let TP,TrAmt; if(changedKey==="TransAmt"){TrAmt=vn(row.TransAmt);TP=PR>0?ro(TrAmt/PR*100):0;}else{TP=vn(row.TransPer);TrAmt=ro(PR*TP/100);}
  const LC=ro(PR+GSTAmt+CessAmt+TrAmt), PA=ro(LC*PP/100);

  let SR;
  if (changedKey === "SalesRate") {
    SR = row.SalesRate === "" ? "" : row.SalesRate;
  } else {
    const defaultSR = row.SalesRate === "" ? "" : (vn(row.SalesRate) || (vn(MRP) === 0 ? "" : f2(MRP)));
    const newRowSR = vn(MRP) === 0 ? (row.SalesRate === "" ? "" : 0) : f2(MRP);

    if(sess?.PurchaseProfitSaleRateChange){
      if(PA === 0) SR = !row.Id ? newRowSR : defaultSR;
      else SR = f2(LC + PA);
    } else {
      SR = PA !== 0 ? f2(LC+PA) : (!row.Id ? newRowSR : defaultSR);
    }
  }

  return {
    GST: GST === "" ? "" : f2(GST), GSTAmt:f2(GSTAmt), CESS:f2(CESS), CESSAmt:f2(CessAmt),
    TransPer:f2(TP), TransAmt:f2(TrAmt), LandingCost:f2(LC),
    DMAmt:f2(ro(MRP-LC)), DMPer:MRP>0?f2(ro((MRP-LC)/MRP*100)):0,
    ProfitAmt:f2(PA), SalesRate: SR === "" ? "" : f2(SR),
    ...(sess?.univercell?{MRP:f2(ro(SR))}:{})
  };
}

// ── Toggle component (same as CashierMaster) ─────────────────────────────────
// CHANGE 1: Added Toggle component — same design as CashierMaster
// மாற்றம் 1: CashierMaster-போல் Toggle component சேர்க்கப்பட்டது
function Toggle({ value, onChange, onKeyDown, inputRef, editMode }) {
  const [focused, setFocused] = useState(false);

  const insetShadow = value
    ? "inset 0 0 0 1px #15803d"
    : "inset 0 0 0 1px #b0bec5";

  const focusRing = "0 0 0 3px rgba(59, 130, 246, 0.45)";

  return (
    <button
      ref={inputRef}
      onClick={() => editMode === 1 && onChange(!value)}
      onKeyDown={onKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      title={value ? "Active" : "Inactive"}
      style={{
        width: 32, height: 18, borderRadius: 9, border: "none",
        cursor: editMode === 0 ? "default" : "pointer",
        background: value ? "#16a34a" : "#cbd5e1",
        position: "relative", transition: "background 0.18s ease",
        outline: "none",
        display: "inline-flex", alignItems: "center", flexShrink: 0, padding: 0,
        boxShadow: focused
          ? \`\${insetShadow}, \${focusRing}\`
          : insetShadow,
        opacity: editMode === 0 ? 0.5 : 1,
        pointerEvents: editMode === 0 ? "none" : "auto",
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: value ? 15 : 3,
        width: 12, height: 12, borderRadius: "50%", background: "#fff",
        transition: "left 0.18s ease",
        boxShadow: "0 1px 2px rgba(0,0,0,0.18)", display: "block",
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
    u = { ...u, ...calcRow(u, sess, "SalesRate"), SalesRate: fv === "" ? "" : f2(vn(fv)) };
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
`;

  const newContent = content.substring(0, startIndex) + replacement + endStr + content.substring(endIndex + endStr.length);
  fs.writeFileSync(path, newContent, 'utf8');
  console.log("Success! File successfully repaired.");
} else {
  console.log("Could not find start or end bounds. startIndex:", startIndex, "endIndex:", endIndex);
}
