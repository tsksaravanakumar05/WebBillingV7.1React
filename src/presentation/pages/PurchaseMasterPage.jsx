import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { PurchaseApi } from '../../infrastructure/api/PurchaseApi.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const r2  = v => Math.round((parseFloat(v) || 0) * 100) / 100;
const f2  = v => (parseFloat(v) || 0).toFixed(2);
const f0  = v => (parseFloat(v) || 0).toFixed(0);
const today = () => new Date().toISOString().split('T')[0];

const fmtDate = d => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
};
const addDays = (d, n) => {
  const dt = new Date(d || new Date());
  dt.setDate(dt.getDate() + (parseInt(n) || 0));
  return dt.toISOString().split('T')[0];
};

function showToast(msg, type = 'success') {
  window.dispatchEvent(new CustomEvent('pm-toast', { detail: { msg, type } }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Calculation logic
// ─────────────────────────────────────────────────────────────────────────────
function calcItem(item, igstBill = false) {
  const rate    = parseFloat(item.PurchaseRate)    || 0;
  const qty     = parseFloat(item.ItemQty)         || 0;
  const noms    = parseFloat(item.Noms)            || 0;
  const totalQty= qty + noms;
  const cdPer   = parseFloat(item.CDPercent)       || 0;
  const discPer = parseFloat(item.DiscountPercent) || 0;
  const gstPer  = parseFloat(item.TaxPercent)      || 0;
  const cessPer = parseFloat(item.CESSPer)         || 0;
  const transPer= parseFloat(item.TransPer)        || 0;

  const purAmt   = r2(rate * totalQty);
  const cdAmt    = r2(purAmt * cdPer / 100);
  const disAmt   = r2((purAmt - cdAmt) * discPer / 100);
  const C1       = totalQty ? r2(cdAmt  / totalQty) : 0;
  const D1       = totalQty ? r2(disAmt / totalQty) : 0;
  const netRate  = r2(rate - C1 - D1);
  const transAmt = totalQty ? r2(netRate * totalQty * transPer / 100) : 0;
  const cessAmt  = r2(netRate * totalQty * cessPer  / 100);
  const ctAmt    = r2(netRate * totalQty * (gstPer / 2) / 100);
  const stAmt    = (igstBill) ? 0 : ctAmt;
  const gstAmt   = r2(ctAmt + stAmt);
  const landingCost = totalQty ? r2(netRate + (gstAmt + cessAmt) / totalQty) : 0;
  const amount   = r2(purAmt - cdAmt - disAmt + gstAmt + cessAmt + transAmt);
  const productTotal = purAmt;

  // StockQty calculation
  const nomsQty = parseFloat(item.NomsQty) || 1;
  const stockQty = (nomsQty * totalQty) + (parseFloat(item.FreeQty) || 0);

  return {
    ...item,
    CDAmount:      f2(cdAmt),
    DiscountAmt:   f2(disAmt),
    TaxAmt:        f2(gstAmt),
    CESSAmount:    f2(cessAmt),
    TransAmt:      f2(transAmt),
    CTAmount:      f2(ctAmt),
    STAmount:      f2(stAmt),
    LandingCost:   f2(landingCost),
    Amount:        f2(amount),
    ProductTotal:  f2(productTotal),
    StockQty:      f2(stockQty),
  };
}

// function calcTotals(items, overrides, igstBill) {
//   const valid = items.filter(i => i.Productcode);

//   const producttotal = r2(valid.reduce((s, i) => s + (parseFloat(i.ProductTotal) || 0), 0));
//   const Tgstamt      = r2(valid.reduce((s, i) => s + (parseFloat(i.TaxAmt)       || 0), 0));
//   const Tcess        = r2(valid.reduce((s, i) => s + (parseFloat(i.CESSAmount)   || 0), 0));
//   const Ttransamt    = r2(valid.reduce((s, i) => s + (parseFloat(i.TransAmt)     || 0), 0));
//   const Tcddiscamt   = r2(valid.reduce((s, i) => s + (parseFloat(i.CDAmount)     || 0), 0));
//   const Tdiscamt     = r2(valid.reduce((s, i) => s + (parseFloat(i.DiscountAmt)  || 0), 0));
//   const Tctamt       = r2(valid.reduce((s, i) => s + (parseFloat(i.CTAmount)     || 0), 0));
//   const Tstamt       = r2(valid.reduce((s, i) => s + (parseFloat(i.STAmount)     || 0), 0));
//   const totalQty     = r2(valid.reduce((s, i) => s + (parseFloat(i.ItemQty)      || 0), 0));

//   const otherplus   = parseFloat(overrides.otherPlus)  || 0;
//   const othersub    = parseFloat(overrides.otherSub)   || 0;
//   const Tcsamount   = parseFloat(overrides.tcsPer)     || 0;
//   const transManual = parseFloat(overrides.transAmt)   || 0; // manual freight — separate

//   // Exact same formula as original JS line 5144
//   const GrossTotal = r2(
//     producttotal + Tgstamt + Tcess + Ttransamt + otherplus
//     - Tcddiscamt - Tdiscamt - othersub
//   );

//   const Tcsamt1 = r2(GrossTotal * (Tcsamount / 100));

//   // Original JS line 5146 — transManual (freight charges) added separately
//   const nettotal = r2(GrossTotal + Tcsamt1 + transManual);

//   return {
//     grossAmt:   f2(producttotal),   // Gross Amt = product total only
//     gstAmt:     f2(Tgstamt),
//     cessAmt:    f2(Tcess),
//     transAmt:   f2(Ttransamt),      // items-level trans (auto)
//     cdAmt:      f2(Tcddiscamt),
//     discAmt:    f2(Tdiscamt),
//     cgstAmt:    f2(igstBill ? 0 : Tctamt),
//     sgstAmt:    f2(igstBill ? 0 : Tstamt),
//     tcsAmt:     f2(Tcsamt1),
//     netAmt:     f2(nettotal),
//     displayAmt: f2(GrossTotal),     // Display Amt = gross total before TCS+freight
//     totalQty:   f2(totalQty),
//   };
// }
// ─────────────────────────────────────────────────────────────────────────────
// Calculation logic (Blackbox AI Base vs Effective Logic)
// ─────────────────────────────────────────────────────────────────────────────
function calcTotals(items, overrides, igstBill) {
  const valid = items.filter(i => i.Productcode);

  // 1. BASE (Auto-calculated from Grid)
  const base = {
    grossAmt: r2(valid.reduce((s, i) => s + (parseFloat(i.ProductTotal) || 0), 0)),
    gstAmt:   r2(valid.reduce((s, i) => s + (parseFloat(i.TaxAmt)       || 0), 0)),
    cessAmt:  r2(valid.reduce((s, i) => s + (parseFloat(i.CESSAmount)   || 0), 0)),
    transAmt: r2(valid.reduce((s, i) => s + (parseFloat(i.TransAmt)     || 0), 0)),
    cdAmt:    r2(valid.reduce((s, i) => s + (parseFloat(i.CDAmount)     || 0), 0)),
    discAmt:  r2(valid.reduce((s, i) => s + (parseFloat(i.DiscountAmt)  || 0), 0)),
    cgstAmt:  igstBill ? 0 : r2(valid.reduce((s, i) => s + (parseFloat(i.CTAmount) || 0), 0)),
    sgstAmt:  igstBill ? 0 : r2(valid.reduce((s, i) => s + (parseFloat(i.STAmount) || 0), 0)),
    totalQty: r2(valid.reduce((s, i) => s + (parseFloat(i.ItemQty)      || 0), 0)),
    otherPlus: 0,
    otherSub: 0
  };

  // 2. EFFECTIVE (Use manual override if not empty, otherwise fallback to base)
  const getEff = (key) => {
    if (overrides[key] !== '' && overrides[key] !== undefined) {
      const val = parseFloat(overrides[key]);
      return isNaN(val) ? 0 : val;
    }
    return base[key] || 0;
  };

  const effective = {
    grossAmt:  getEff('grossAmt'),
    transAmt:  getEff('transAmt'),
    cdAmt:     getEff('cdAmt'),
    discAmt:   getEff('discAmt'),
    gstAmt:    getEff('gstAmt'),
    cessAmt:   getEff('cessAmt'),
    cgstAmt:   getEff('cgstAmt'),
    sgstAmt:   getEff('sgstAmt'),
    otherPlus: getEff('otherPlus'),
    otherSub:  getEff('otherSub'),
  };

  // 3. DYNAMIC NET TOTAL
  const calculatedNetTotal = r2(
    (effective.grossAmt + effective.gstAmt + effective.cessAmt + effective.transAmt + effective.otherPlus) - 
    (effective.cdAmt + effective.discAmt + effective.otherSub)
  );

  effective.netAmt = (overrides.netAmt !== '' && overrides.netAmt !== undefined) 
    ? parseFloat(overrides.netAmt) 
    : calculatedNetTotal;

  effective.displayAmt = (overrides.displayAmt !== '' && overrides.displayAmt !== undefined)
    ? parseFloat(overrides.displayAmt)
    : effective.grossAmt;

  // Render format
  return {
    base: {
      grossAmt: f2(base.grossAmt), transAmt: f2(base.transAmt), cdAmt: f2(base.cdAmt), discAmt: f2(base.discAmt),
      cessAmt: f2(base.cessAmt), cgstAmt: f2(base.cgstAmt), sgstAmt: f2(base.sgstAmt), gstAmt: f2(base.gstAmt),
      otherPlus: '0.00', otherSub: '0.00', netAmt: f2(calculatedNetTotal), displayAmt: f2(base.grossAmt), totalQty: f2(base.totalQty)
    },
    effective: {
      grossAmt: f2(effective.grossAmt), transAmt: f2(effective.transAmt), cdAmt: f2(effective.cdAmt), discAmt: f2(effective.discAmt),
      cessAmt: f2(effective.cessAmt), cgstAmt: f2(effective.cgstAmt), sgstAmt: f2(effective.sgstAmt), gstAmt: f2(effective.gstAmt),
      otherPlus: f2(effective.otherPlus), otherSub: f2(effective.otherSub), netAmt: f2(effective.netAmt), displayAmt: f2(effective.displayAmt),
      totalQty: f2(base.totalQty)
    }
  };
}
function buildGstRows(items, igstBill) {
  const map = {};
  items.filter(i => i.Productcode).forEach(i => {
    const k = parseFloat(i.TaxPercent) || 0;
    if (!map[k]) map[k] = { gstPer: k, gstAmt: 0, cgst: 0, sgst: 0, cessAmt: 0 };
    map[k].gstAmt  = r2(map[k].gstAmt  + (parseFloat(i.TaxAmt)    || 0));
    map[k].cgst    = r2(map[k].cgst    + (parseFloat(i.CTAmount)   || 0));
    map[k].sgst    = r2(map[k].sgst    + (igstBill ? 0 : (parseFloat(i.STAmount) || 0)));
    map[k].cessAmt = r2(map[k].cessAmt + (parseFloat(i.CESSAmount) || 0));
  });
  return Object.values(map).sort((a, b) => a.gstPer - b.gstPer);
}

// ─────────────────────────────────────────────────────────────────────────────
// New empty row factory
// ─────────────────────────────────────────────────────────────────────────────
let rowCounter = 0;
function newRow() {
  return {
    _id: `row_${++rowCounter}`,
    Productcode: '', ProductName: '', ProductRefId: 0,
    HSNCode: '', UOM: '', UOMDecimal: 2,
    MRP: '0.00', PurchaseRate: '0.00', StockQty: '0.000',
    ItemQty: '0', FreeQty: '0', Noms: '0',
    CDPercent: '0', CDAmount: '0.00',
    DiscountPercent: '0', DiscountAmt: '0.00',
    TaxPercent: '0', TaxAmt: '0.00',
    CESSPer: '0', CESSAmount: '0.00',
    TransPer: '0', TransAmt: '0.00',
    LandingCost: '0.00', Amount: '0.00',
    SalesRate: '0.00', WholeSaleRate: '0.00',
    ProfitPer: '0', ProfitAmt: '0.00',
    SaleDiscountPer: '0', CTAmount: '0.00', STAmount: '0.00',
    ProductTotal: '0.00', BatchNo: '', EditMode: 0,
    FreeQtyStatus: 0, OldPurchaseRate: '0.00',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid columns
// ─────────────────────────────────────────────────────────────────────────────
const COLS = [
  { key: 'Productcode',      label: 'Product Code',  w: 90,  align: 'left',  editable: true,  type: 'code' },
  { key: 'ProductName',      label: 'Description',   w: 200, align: 'left',  editable: true,  type: 'name' },
  { key: 'MRP',              label: 'MRP',           w: 80,  align: 'right', editable: true,  type: 'num'  },
  { key: 'PurchaseRate',     label: 'Pur.Rate',      w: 80,  align: 'right', editable: true,  type: 'num'  },
  { key: 'StockQty',         label: 'StockQty',      w: 72,  align: 'right', editable: false, type: 'num'  },
  { key: 'ItemQty',          label: 'Quantity',      w: 72,  align: 'right', editable: true,  type: 'num'  },
  { key: 'DiscountPercent',  label: 'Disc(%)',        w: 60,  align: 'right', editable: true,  type: 'num'  },
  { key: 'DiscountAmt',      label: 'Disc Amt',      w: 72,  align: 'right', editable: false, type: 'num'  },
  { key: 'TaxPercent',       label: 'GST(%)',         w: 60,  align: 'right', editable: true,  type: 'num'  },
  { key: 'LandingCost',      label: 'Landing Cost',  w: 88,  align: 'right', editable: false, type: 'num'  },
  { key: 'Amount',           label: 'Amount',        w: 90,  align: 'right', editable: false, type: 'num'  },
  { key: 'SalesRate',        label: 'SaleRate',       w: 78,  align: 'right', editable: true,  type: 'num'  },
];

const FOCUS_KEYS = ['Productcode', 'MRP', 'PurchaseRate', 'ItemQty', 'DiscountPercent', 'TaxPercent', 'SalesRate'];

// ─────────────────────────────────────────────────────────────────────────────
// Focus Config Constants
// ─────────────────────────────────────────────────────────────────────────────
const FORM_COLUMNS = [
  { key: 'purchaseDate',  label: 'Purchase Date' },
  { key: 'purchaseType',  label: 'Purchase Type' },
  { key: 'dueDate',       label: 'Due Date' },
  { key: 'supplier',      label: 'Supplier' },
  { key: 'invoiceNo',     label: 'Invoice No' },
  { key: 'invoiceDate',   label: 'Invoice Date' },
  { key: 'invoiceAmt',    label: 'Invoice Amount' },
  { key: 'gridPurchase',  label: 'Grid Purchase' },
  { key: 'otherPlus',     label: 'Others (+)' },
  { key: 'otherSub',      label: 'Others (-)' },
  { key: 'remarks',       label: 'Remarks' },
];

const GRID_COLUMNS_CONFIG = [
  { key: 'Productcode',     label: 'Product Code' },
  { key: 'MRP',             label: 'MRP' },
  { key: 'PurchaseRate',    label: 'Pur.Rate' },
  { key: 'ItemQty',         label: 'Quantity' },
  { key: 'DiscountPercent', label: 'Disc(%)' },
  { key: 'TaxPercent',      label: 'GST(%)' },
  { key: 'SalesRate',       label: 'Sale Rate' },
  { key: 'CDPercent',       label: 'C.D(%)' },
  { key: 'CESSPer',         label: 'CESS(%)' },
  { key: 'TransPer',        label: 'Trans(%)' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Form field Enter-nav index map:
//   0 → purchaseDate    1 → purchaseType    2 → dueDate
//   3 → supplier (custom — handled via SupplierDropdown onEnter prop)
//   4 → invoiceNo       5 → invoiceDate     6 → invoiceAmt
//   idx 6 → special: jumps to grid row 0 Productcode
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Product Search Modal
// ─────────────────────────────────────────────────────────────────────────────
function ProductSearchModal({ open, rowIdx, initialQuery, onClose, onSelect }) {
  const [query,   setQuery]   = useState('');
  const [list,    setList]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [selIdx,  setSelIdx]  = useState(0);
  const inputRef = useRef(null);
  const listRef  = useRef(null);
  const itemRefs = useRef([]);

  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery || '');
    setSelIdx(0);
    setTimeout(() => inputRef.current?.focus(), 60);
  }, [open, initialQuery]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    PurchaseApi.searchProducts('').then(r => {
      setList(r.data || []);
      setSelIdx(0);
      setLoading(false);
    }).catch(() => {
      setList([]);
      setLoading(false);
    });
  }, [open]);

  useEffect(() => {
    itemRefs.current[selIdx]?.scrollIntoView({ block: 'nearest' });
  }, [selIdx]);

  const filtered = list.filter(p => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      p.ProductName?.toLowerCase().includes(q) ||
      p.Productcode?.toLowerCase().includes(q)
    );
  });

  const handleKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelIdx(s => Math.min(s + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelIdx(s => Math.max(s - 1, 0)); }
    if (e.key === 'Enter')     { e.preventDefault(); if (filtered[selIdx]) onSelect(filtered[selIdx], rowIdx); }
    if (e.key === 'Escape')    { e.preventDefault(); onClose(); }
  };

  if (!open) return null;
  return (
    <div style={MS.backdrop} onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...MS.box, width: 760, top: 55, position: 'fixed', left: '50%', transform: 'translateX(-50%)', maxHeight: '80vh' }}>
        <div style={MS.hdr}>
          🔍 Product Search
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'white', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: '7px 10px', borderBottom: '1px solid #dde5f5' }}>
          <input
            ref={inputRef}
            style={{ width: '100%', height: 28, padding: '0 8px', border: '1px solid #2563eb', borderRadius: 4, fontSize: 13, outline: 'none' }}
            placeholder="Product name / code enter pannunga..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelIdx(0); }}
            onKeyDown={handleKey}
          />
        </div>
        <div style={{ display: 'flex', background: '#f8fafc', color: '#334155', fontSize: 11, borderBottom: '1px solid #e2e8f0', fontWeight: 600, padding: '4px 0' }}>
          {[['Code',80],['Description',280],['Pur.Rate',80],['MRP',70],['Stock',70],['UOM',55],['GST%',55]].map(([h,w]) => (
            <span key={h} style={{ width: w, padding: '0 6px', textAlign: h==='Description'?'left':'right', flexShrink:0 }}>{h}</span>
          ))}
        </div>
        <div style={{ overflowY: 'auto', maxHeight: 320 }} ref={listRef}>
          {loading && <div style={{ padding: 16, textAlign: 'center', color: '#888', fontSize: 12 }}>Loading...</div>}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: '#888', fontSize: 12 }}>
              {query ? 'No products found' : 'Type to search...'}
            </div>
          )}
          {!loading && filtered.map((p, i) => (
            <div
              key={p.Id || i}
              ref={el => itemRefs.current[i] = el}
              onClick={() => onSelect(p, rowIdx)}
              style={{
                display: 'flex', alignItems: 'center', padding: '4px 0',
                background: i === selIdx ? '#e8f0fd' : 'white',
                borderBottom: '1px solid #f0f4ff', cursor: 'pointer', fontSize: 12,
              }}
            >
              <span style={{ width:80,  padding:'0 6px', color:'#4a6080', fontFamily:'monospace', flexShrink:0 }}>{p.Productcode}</span>
              <span style={{ width:280, padding:'0 6px', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flexShrink:0 }}>{p.ProductName}</span>
              <span style={{ width:80,  padding:'0 6px', textAlign:'right', fontFamily:'monospace', color:'#1a2b4a', flexShrink:0 }}>{f2(p.PurRate)}</span>
              <span style={{ width:70,  padding:'0 6px', textAlign:'right', fontFamily:'monospace', color:'#2563eb', flexShrink:0 }}>₹{f2(p.MRP)}</span>
              <span style={{ width:70,  padding:'0 6px', textAlign:'right', fontFamily:'monospace', flexShrink:0 }}>{f2(p.Stock)}</span>
              <span style={{ width:55,  padding:'0 6px', textAlign:'center', color:'#888', flexShrink:0 }}>{p.UOM}</span>
              <span style={{ width:55,  padding:'0 6px', textAlign:'right', color:'#888', flexShrink:0 }}>{p.GST}%</span>
            </div>
          ))}
        </div>
        <div style={{ padding: '4px 10px', background: '#f5f5f5', fontSize: 11, color: '#888', borderTop: '1px solid #ddd', display:'flex', gap:12 }}>
          <span>↑↓ Navigate</span><span>Enter — Select</span><span>Esc — Close</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// F5 View Modal
// ─────────────────────────────────────────────────────────────────────────────
function F5ViewModal({ suppliers, onClose, onEditLoad }) {
  const [from,    setFrom]    = useState(today());
  const [to,      setTo]      = useState(today());
  const [sid,     setSid]     = useState(0);
  const [list,    setList]    = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await PurchaseApi.getPurchaseList(from, to, parseInt(sid) || 0);
      setList(r.data || r.Data || []);
    } catch { setList([]); }
    setLoading(false);
  }, [from, to, sid]);

  useEffect(() => { load(); }, []);

  return (
    <div style={MS.backdrop} onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...MS.box, width: 900, maxHeight: '88vh' }}>
        <div style={MS.hdr}>
          📋 Purchase Details View — F5
          <button onClick={onClose} style={{ marginLeft:'auto', background:'none', border:'none', color:'white', fontSize:18, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ padding:'10px 12px', display:'flex', gap:8, alignItems:'flex-end', borderBottom:'1px solid #dde5f5', flexWrap:'wrap' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            <label style={FS.label}>From Date</label>
            <input type="date" style={{ ...FS.input, width:140 }} value={from} onChange={e=>setFrom(e.target.value)} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            <label style={FS.label}>To Date</label>
            <input type="date" style={{ ...FS.input, width:140 }} value={to} onChange={e=>setTo(e.target.value)} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            <label style={FS.label}>Supplier</label>
            <select style={{ ...FS.select, width:220 }} value={sid} onChange={e=>setSid(e.target.value)}>
              <option value={0}>All Suppliers</option>
              {suppliers.map(s => <option key={s.Id} value={s.Id}>{s.AccountName}</option>)}
            </select>
          </div>
          <button style={{ ...FS.btnP, height:28 }} onClick={load}>🔍 View</button>
        </div>
        <div style={{ overflowY:'auto', maxHeight:480 }}>
          {loading && <div style={{ padding:20, textAlign:'center', color:'#888' }}>Loading...</div>}
          {!loading && (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr>
                  {['S.No','Pur.No','Date','Type','Supplier','Invoice No','Net Amt','Action'].map(h => (
                    <th key={h} style={{ background:'#f8fafc', color:'#334155', padding:'5px 8px',
                      textAlign:h==='Net Amt'?'right':'left', position:'sticky', top:0 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.length===0 && <tr><td colSpan={8} style={{ padding:16, textAlign:'center', color:'#888' }}>No records found</td></tr>}
                {list.map((row, i) => (
                  <tr key={row.Id||i} style={{ borderBottom:'1px solid #dde5f5', background: i%2===0?'white':'#fafcff' }}>
                    <td style={{ padding:'4px 8px' }}>{i+1}</td>
                    <td style={{ padding:'4px 8px', fontWeight:600, color:'#2563eb' }}>{row.PurchaseNo}</td>
                    <td style={{ padding:'4px 8px' }}>{fmtDate(row.PurchaseDate)}</td>
                    <td style={{ padding:'4px 8px' }}>{row.PurchaseType==='CA'?'CASH':'CREDIT'}</td>
                    <td style={{ padding:'4px 8px' }}>{row.SupplierName}</td>
                    <td style={{ padding:'4px 8px' }}>{row.SupplierInvoiceNo}</td>
                    <td style={{ padding:'4px 8px', textAlign:'right', fontFamily:'monospace', fontWeight:600 }}>{f2(row.NetAmt)}</td>
                    <td style={{ padding:'4px 8px' }}>
                      <button
                        style={{ background:'#eff6ff', border:'1px solid #2563eb', color:'#2563eb', borderRadius:3, padding:'2px 8px', fontSize:11, cursor:'pointer', fontWeight:600 }}
                        onClick={() => { onEditLoad(row.Id); onClose(); }}>
                        ✏️ Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirm Dialog
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmDialog({ msg, onYes, onNo }) {
  return (
    <div style={MS.backdrop}>
      <div style={{ ...MS.box, width: 380 }}>
        <div style={MS.hdr}>⚠️ Confirm</div>
        <div style={{ padding:'16px 14px', fontSize:13, color:'#1a2b4a' }}>{msg}</div>
        <div style={{ padding:'10px 14px', display:'flex', justifyContent:'flex-end', gap:8, borderTop:'1px solid #dde5f5' }}>
          <button style={{ ...FS.btnDanger, height:30, padding:'0 14px' }} onClick={onYes}>Yes, Proceed</button>
          <button style={{ ...FS.btnSec,    height:30, padding:'0 14px' }} onClick={onNo}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast Host
// ─────────────────────────────────────────────────────────────────────────────
function ToastHost() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    const h = e => {
      const id = Date.now() + Math.random();
      setToasts(t => [...t, { id, ...e.detail }]);
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
    };
    window.addEventListener('pm-toast', h);
    return () => window.removeEventListener('pm-toast', h);
  }, []);
  const colors = { success:'#16a34a', error:'#dc2626', warn:'#d97706', info:'#2563eb' };
  const icons  = { success:'✅', error:'❌', warn:'⚠️', info:'ℹ️' };
  return (
    <div style={{ position:'fixed', top:50, right:12, zIndex:9999, display:'flex', flexDirection:'column', gap:5 }}>
      {toasts.map(t => (
        <div key={t.id} style={{ minWidth:260, padding:'9px 14px', borderRadius:6, background:'white',
          borderLeft:`4px solid ${colors[t.type]||colors.info}`,
          boxShadow:'0 4px 16px rgba(0,0,0,0.14)', fontSize:13, fontWeight:500, display:'flex', gap:7, alignItems:'center' }}>
          {icons[t.type]||icons.info} {t.msg}
        </div>
      ))}
    </div>
  );
}

const MS = {
  backdrop: { position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', zIndex:8000, display:'flex', alignItems:'flex-start', justifyContent:'center' },
  box:      { background:'#ffffff', borderRadius:8, boxShadow:'0 8px 32px rgba(0,0,0,0.18)', overflow:'hidden', maxWidth:'96vw' },
  hdr:      { background:'#ffffff', color:'#2563eb', padding:'10px 14px', borderBottom:'1px solid #e2e8f0', borderLeft:'3px solid #2563eb', fontWeight:600, fontSize:14, display:'flex', alignItems:'center', gap:8 },
};
const FS = {
  label:    { fontSize:10, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:2 },
  input:    { height:26, padding:'0 7px', border:'1px solid #cbd5e1', borderRadius:4, fontSize:12, fontFamily:'inherit', color:'#0f172a', outline:'none', background:'#ffffff' },
  inputRO:  { height:26, padding:'0 7px', border:'1px solid #e2e8f0', borderRadius:4, fontSize:12, fontFamily:'inherit', color:'#64748b', outline:'none', background:'#f8fafc', cursor:'not-allowed' },
  select:   { height:26, padding:'0 6px', border:'1px solid #cbd5e1', borderRadius:4, fontSize:12, fontFamily:'inherit', color:'#0f172a', background:'#ffffff', cursor:'pointer', outline:'none' },
  btnP:     { background:'#2563eb', color:'white', border:'none', borderRadius:4, fontWeight:600, fontSize:12, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:4, fontFamily:'inherit', height:30, padding:'0 14px' },
  btnSec:   { background:'#ffffff', color:'#334155', border:'1px solid #cbd5e1', borderRadius:4, fontWeight:600, fontSize:12, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:4, fontFamily:'inherit', height:30, padding:'0 14px' },
  btnDanger:{ background:'#ffffff', color:'#dc2626', border:'1px solid #dc2626', borderRadius:4, fontWeight:600, fontSize:12, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:4, fontFamily:'inherit', height:30, padding:'0 14px' },
};

const SupplierDropdown = React.forwardRef(
({ suppliers, supplierId, onSelect, onEnter }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);
useImperativeHandle(ref, () => ({
  focus: () => {
    setIsOpen(true);

    setTimeout(() => {
      searchRef.current?.focus();
    }, 0);
  }
}));
  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus();
      setSearchVal('');
      setHighlightIndex(-1);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);
useImperativeHandle(ref, () => ({
  focusSupplier() {
    setIsOpen(true);

    setTimeout(() => {
      searchRef.current?.focus();
    }, 40);
  }
}));
  const selectedSupplier = suppliers.find(s => s.Id === supplierId);
  const filtered = searchVal
    ? suppliers.filter(s => s.AccountName.toLowerCase().includes(searchVal.toLowerCase()))
    : suppliers;

  const handleSelect = (supplier) => {
    setIsOpen(false);
    setSearchVal('');
    onSelect(supplier.Id);
  };

  // Keyboard navigation + scroll
  const handleSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(i => i < 0 ? 0 : Math.min(i + 1, filtered.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(i => i <= 0 ? 0 : i - 1);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex >= 0 && filtered[highlightIndex]) {
        handleSelect(filtered[highlightIndex]);
        setTimeout(() => onEnter?.(), 50);
      } else if (filtered.length > 0) {
        handleSelect(filtered[0]);
        setTimeout(() => onEnter?.(), 50);
      } else {
        setIsOpen(false);
        onEnter?.();
      }
      return;
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }
  };

  // Auto-scroll highlighted item
  useEffect(() => {
    if (!isOpen || highlightIndex < 0 || !listRef.current) return;
    const item = listRef.current.children[highlightIndex];
    if (item) item.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, isOpen]);

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div
        onClick={() => setIsOpen(o => !o)}
        style={{
          height: 26, fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4,
          backgroundColor: '#ffffff', padding: '0 24px 0 7px', display: 'flex',
          alignItems: 'center', cursor: 'pointer',
          color: selectedSupplier ? '#0f172a' : '#94a3b8',
          position: 'relative', userSelect: 'none', width: '100%', boxSizing: 'border-box',
        }}
      >
        {selectedSupplier ? selectedSupplier.AccountName : 'Select SupplierName'}
        <span style={{ position: 'absolute', right: 7, color: '#64748b', fontSize: 10 }}>▼</span>
      </div>
      <div style={{
        position: 'absolute', top: '100%', left: 0, right: 0,
        backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: 4,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 9999,
        display: isOpen ? 'block' : 'none',  // Always mounted, toggle display
      }}>
        <div style={{ padding: '5px 6px', borderBottom: '1px solid #e2e8f0' }}>
          <input
            ref={searchRef}
            type="text"
            value={searchVal}
            onChange={e => {
              setSearchVal(e.target.value);
              setHighlightIndex(-1);
            }}
            placeholder="🔍 Search supplier..."
            autoComplete="off"
            onKeyDown={handleSearchKeyDown}
            style={{
              width: '100%', height: 24, fontSize: 12, border: '1px solid #cbd5e1',
              borderRadius: 3, padding: '0 7px', outline: 'none',
              boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
        </div>
        <ul ref={listRef} style={{ maxHeight: 180, overflowY: 'auto', margin: 0, padding: 0, listStyle: 'none' }}>
          {filtered.length === 0 ? (
            <li style={{ padding: '6px 10px', color: '#94a3b8', fontSize: 12 }}>No suppliers found</li>
          ) : (
            filtered.map((s, i) => (
              <li
                key={s.Id}
                onMouseDown={() => handleSelect(s)}
                style={{
                  padding: '5px 10px', fontSize: 12, cursor: 'pointer',
                  backgroundColor: s.Id === supplierId ? '#e2e8f0' : i === highlightIndex ? '#f1f5f9' : 'white',
                  color: '#0f172a',
                }}
                onMouseEnter={() => setHighlightIndex(i)}
              >
                {s.AccountName}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Focus Config Modal (Ctrl+F = form, Ctrl+G = grid)
// ─────────────────────────────────────────────────────────────────────────────
function FocusConfigModal({ type, onClose, onSave }) {
  const defaultCols = type === 'form' ? FORM_COLUMNS : GRID_COLUMNS_CONFIG;
  const storageKey  = type === 'form' ? 'PurchaseFormFocus' : 'PurchaseGridFocus';

  const [cols, setCols] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (saved.length) {
        const merged = saved
          .map(s => ({ ...defaultCols.find(d => d.key === s.key), focus: s.focus }))
          .filter(Boolean);
        defaultCols.forEach(d => {
          if (!merged.find(m => m.key === d.key)) merged.push({ ...d, focus: true });
        });
        return merged;
      }
    } catch {}
    return defaultCols.map(c => ({ ...c, focus: true }));
  });

  const [dragIdx, setDragIdx] = useState(null);

  const toggleFocus = (idx) => {
    setCols(prev => prev.map((c, i) => i === idx ? { ...c, focus: !c.focus } : c));
  };

  const handleDrop = (idx) => {
    if (dragIdx === null || dragIdx === idx) return;
    setCols(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setDragIdx(null);
  };

  const handleSave = () => {
    const toSave = cols.map((c, i) => ({ key: c.key, focus: c.focus, index: i }));
    localStorage.setItem(storageKey, JSON.stringify(toSave));
    onSave(toSave);
    onClose();
    showToast(`${type === 'form' ? 'Form' : 'Grid'} focus order saved!`, 'success');
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ background: 'white', borderRadius: 6, width: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        <div style={{
          background: '#2563eb', color: 'white', padding: '8px 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 13, fontWeight: 600
        }}>
          {type === 'form' ? '⌨️ Form Focus Order (Ctrl+F)' : '⌨️ Grid Focus Order (Ctrl+G)'}
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: '6px 12px', fontSize: 11, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
          Drag to reorder • Checkbox to enable/disable focus
        </div>
        <div style={{ maxHeight: 380, overflowY: 'auto', padding: '4px 0' }}>
          {cols.map((col, idx) => (
            <div
              key={col.key}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(idx)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 12px', cursor: 'grab',
                background: dragIdx === idx ? '#eff6ff' : 'white',
                borderBottom: '1px solid #f1f5f9', fontSize: 12,
              }}
            >
              <span style={{ color: '#94a3b8', fontSize: 11 }}>⠿</span>
              <input type="checkbox" checked={col.focus} onChange={() => toggleFocus(idx)} style={{ cursor: 'pointer' }} />
              <span style={{ color: col.focus ? '#0f172a' : '#94a3b8' }}>
                {idx + 1}. {col.label}
              </span>
            </div>
          ))}
        </div>
        <div style={{ padding: '8px 12px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ ...FS.btnSec, height: 28, fontSize: 11, padding: '0 12px' }}>Cancel</button>
          <button onClick={handleSave} style={{ ...FS.btnP, height: 28, fontSize: 11, padding: '0 12px' }}>💾 Save</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────────────────────
export function PurchaseMasterPage() {
  // ── Master data
  const [suppliers, setSuppliers] = useState([]);

  // ── Header fields
  const [purchaseNo,   setPurchaseNo]   = useState('');
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [dueDate,      setDueDate]      = useState(today());
  const [purchaseType, setPurchaseType] = useState('CREDIT');
  const [supplierId,   setSupplierId]   = useState(0);
  const [supInfo, setSupInfo] = useState({
    Address:'', City:'', ContactNo:'', Balance:0,
    CurrentStock:0, IGSTBill:'GST', CreditDays:0,
  });
  const [invoiceNo,   setInvoiceNo]   = useState('');
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [invoiceAmt,  setInvoiceAmt]  = useState('');
  const [igst,        setIgst]        = useState(false);
  const [taxMode,     setTaxMode]     = useState('exclusive');
  const [remarks,     setRemarks]     = useState('');
  const supplierRef = useRef(null);
  const handleDueDateEnter = () => {
  supplierRef.current?.focus();
};
  // ── Grid items
  const [items, setItems] = useState([newRow()]);
const [formFocusOrder, setFormFocusOrder] = useState([]);
  const [gridFocusOrder, setGridFocusOrder] = useState(FOCUS_KEYS);
  // ── Override fields
  const [overrides, setOverrides] = useState({
    grossAmt: '', transAmt: '', displayAmt: '', cdAmt: '', discAmt: '', 
    cessAmt: '', cgstAmt: '', sgstAmt: '', gstAmt: '', otherPlus: '', otherSub: '', netAmt: ''
  });

  // ── Edit state
  const [editMode, setEditMode] = useState(false);
  const [editId,   setEditId]   = useState(0);

  // ── UI state
  const [loading,         setLoading]         = useState(false);
  const [confirmDlg,      setConfirmDlg]      = useState(null);
  const [prodModal,       setProdModal]       = useState({ open:false, rowIdx:0, query:'' });
  const [showF5,          setShowF5]          = useState(false);
  const [showFocusConfig, setShowFocusConfig] = useState(null);

  // ── Grid cell refs
  const cellRefs = useRef({});
  const setRef   = (row, col) => el => { if (el) cellRefs.current[`${row}_${col}`] = el; };
  const focusCell = useCallback((row, col) => {
    setTimeout(() => {
      const el = cellRefs.current[`${row}_${col}`];
      if (el) { el.focus(); el.select?.(); }
    }, 40);
  }, []);

  const formRefs    = useRef([]);
  const setFormRef  = idx => el => { if (el) formRefs.current[idx] = el; };
const handleFormEnter = useCallback((e, idx) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  e.stopPropagation();

  const activeField = formRefs.current[idx]?.dataset.field;
  if (!activeField) return;

// Build enabled refs array from current config
  console.log('=== ENTER DIAGNOSIS ===');
  console.log('formFocusOrder:', formFocusOrder);
  console.log('formRefs length:', formRefs.current?.length);
  console.log('formRefs keys:', formRefs.current?.map((r,i) => ({i, key:r?.dataset?.field})));
  const enabledRefs = formFocusOrder
    .map(key => formRefs.current.find(ref => ref?.dataset?.field === key))
    .filter(Boolean);
  console.log('enabledRefs:', enabledRefs.map(r => r?.dataset?.field));
  console.log('activeField:', activeField, 'idx:', idx);

  const currentPos = enabledRefs.findIndex(ref => ref?.contains(document.activeElement) || ref === formRefs.current[idx]);
  if (currentPos === -1) return;
  console.log('currentPos:', currentPos, 'enabled length:', enabledRefs.length);

  const nextPos = (currentPos + 1) % enabledRefs.length;
  const nextRef = enabledRefs[nextPos];
  console.log('nextPos:', nextPos, 'nextRef field:', nextRef?.dataset?.field);

  // Special routing
  if (activeField === 'dueDate') {
    setTimeout(() => supplierRef.current?.focusSupplier?.(), 0);
    return;
  }
  if (activeField === 'invoiceAmt') {
    setTimeout(() => focusCell(0, 'Productcode'), 0);
    return;
  }
if (activeField === 'supplier') {
    setTimeout(() => {
      const el = formRefs.current[4];
      if (el) { el.focus(); el.select?.(); }
    }, 60);
    return;
  }

  // Normal next focus
  console.log('FOCUSING nextRef:', nextRef);
  setTimeout(() => {
    nextRef?.focus();
    const inp = nextRef?.querySelector('input, select');
    console.log('Found input:', inp);
    inp?.select?.();
  }, 50);
}, [formFocusOrder, focusCell]);
  // const handleFormEnter = useCallback((e, idx) => {
  //   if (e.key !== 'Enter') return;
  //   e.preventDefault();


  //     if (idx === 2) {
  //   supplierRef.current?.focusSupplier();
  //   return;
  // }
  // // Invoice amount → grid
  // if (idx === 6) {
  //   focusCell(0, 'Productcode');
  //   return;
  // }

  //   const next = formRefs.current[idx + 1];
  //   if (next) {
  //     next.focus();
  //     next.select?.();
  //   }
  // }, [focusCell]);

  // Supplier Enter → focus Invoice No (formRefs[4])
  const handleSupplierEnter = useCallback(() => {
    setTimeout(() => {
      const el = formRefs.current[4];
      if (el) { el.focus(); el.select?.(); }
    }, 60);
  }, []);

  // ── Computed totals (Destructuring base for placeholders, effective as totals)
  const { base, effective: totals } = useMemo(() => calcTotals(items, overrides, igst), [items, overrides, igst]);
  const gstRows = useMemo(() => buildGstRows(items, igst),          [items, igst]);
useEffect(() => {
  // Load form config
  const savedForm = JSON.parse(localStorage.getItem("PurchaseFormFocus") || "[]");
  if (savedForm.length) {
    const enabledForm = savedForm.filter(s => s.focus).sort((a, b) => a.index - b.index).map(s => s.key);
    setFormFocusOrder(enabledForm);
  }

  // Load grid config  
  const savedGrid = JSON.parse(localStorage.getItem("PurchaseGridFocus") || "[]");
  if (savedGrid.length) {
    const enabledGrid = savedGrid.filter(s => s.focus).sort((a, b) => a.index - b.index).map(s => s.key);
    setGridFocusOrder(enabledGrid);
  }
}, []);


  // ─── Init: load suppliers + purchase no ─────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const sRes = await PurchaseApi.getSuppliers();
        console.log('Supplier response:', sRes);
        if (sRes.ok) setSuppliers(sRes.data);
        else showToast('Supplier load failed', 'error');
      } catch (e) {
        showToast('Supplier error: ' + e.message, 'error');
      }
      try {
        const noRes = await PurchaseApi.getNextPurchaseNo();
        if (noRes.ok) setPurchaseNo(noRes.purchaseNo);
      } catch (e) {
        console.error('PurchaseNo error:', e);
      }
      setLoading(false);
    })();
  }, []);

  // ─── Supplier select ─────────────────────────────────────────────────────
  const handleSupplierChange = async sid => {
    const id = parseInt(sid);
    setSupplierId(id);
    if (!id) {
      setSupInfo({ Address:'', City:'', ContactNo:'', Balance:0, CurrentStock:0, IGSTBill:'GST', CreditDays:0 });
      return;
    }
    const s = suppliers.find(x => x.Id === id);
    if (!s) return;
    const info = {
      Address:    [s.Address1, s.Address2].filter(Boolean).join(', '),
      City:       s.City         || '',
      ContactNo:  s.MobileNo     || '',
      Balance:    0, CurrentStock: 0,
      IGSTBill:   s.IGSTBill     || 'GST',
      CreditDays: s.CreditBillDays || 0,
    };
    setSupInfo(info);
    setDueDate(addDays(purchaseDate, info.CreditDays));
    setIgst(info.IGSTBill === 'IGST' || info.IGSTBill === 'UGST');
    try {
      const br = await PurchaseApi.getSupplierBalance(id, purchaseDate);
      if (br.ok) setSupInfo(p => ({ ...p, Balance: parseFloat(br.data) || 0 }));
    } catch {}
  };

  // ─── Item field change → recalculate ────────────────────────────────────
  const handleItemChange = useCallback((idx, field, val) => {
    setItems(prev => {
      const next = [...prev];
      const row  = { ...next[idx], [field]: val };
      next[idx]  = calcItem(row, igst);
      next[idx].EditMode = 1;
      return next;
    });
  }, [igst]);

  // ─── Apply selected product to a row ────────────────────────────────────
  const applyProduct = useCallback((p, rowIdx) => {
    setItems(prev => {
      const next = [...prev];
      const base = {
        ...next[rowIdx],
        Productcode:     p.Productcode     || p.code || '',
        ProductName:     p.ProductName     || p.name || '',
        ProductRefId:    p.Id              || p.id   || 0,
        HSNCode:         p.HSNCode         || p.hsnCode || '',
        UOM:             p.UOM             || p.uom || '',
        UOMDecimal:      p.UOMDecimal      || 2,
        MRP:             f2(p.MRP          || p.mrp || 0),
        PurchaseRate:    f2(p.PurRate || p.PurchaseRate || p.purchaseRate || 0),
        OldPurchaseRate: f2(p.PurRate || p.PurchaseRate || p.purchaseRate || 0),
        StockQty:        f2(p.Stock        || p.stock || 0),
        ItemQty:         '1',
        TaxPercent:      f2(p.GST          || p.TaxPercent || p.taxPercent || 0),
        CESSPer:         f2(p.CESS         || p.CESSPer || p.cessPercent || 0),
        SalesRate:       f2(p.SalesRate    || p.saleRate || 0),
        LandingCost:     f2(p.LandingCost  || 0),
        ProfitPer:       f2(p.ProfitPer    || 0),
        ProfitAmt:       f2(p.ProfitAmt    || 0),
        WholeSaleRate:   f2(p.WholeSaleRate|| 0),
        SaleDiscountPer: f2(p.SaleDiscountPer || 0),
        CDPercent: '0', CDAmount: '0.00',
        DiscountPercent: '0', DiscountAmt: '0.00',
        TransPer: '0', TransAmt: '0.00',
        FreeQtyStatus: 0,
        EditMode: 1,
      };
      next[rowIdx] = calcItem(base, igst);
      if (rowIdx === next.length - 1) next.push(newRow());
      return next;
    });
    setProdModal({ open:false, rowIdx:0, query:'' });
    focusCell(rowIdx, 'ItemQty');
  }, [igst, focusCell]);

  // ─── Productcode Enter ───────────────────────────────────────────────────
  const handleProductcodeEnter = useCallback(async (idx, code) => {
    const trimmed = code.trim();
    if (!trimmed) { setProdModal({ open:true, rowIdx:idx, query:'' }); return; }
    setLoading(true);
    try {
      const r = await PurchaseApi.getProductByCode(trimmed);
      const data = r.data || [];
      if (data.length === 1) { applyProduct(data[0], idx); }
      else { setProdModal({ open:true, rowIdx:idx, query: trimmed }); }
    } catch { setProdModal({ open:true, rowIdx:idx, query: trimmed }); }
    setLoading(false);
  }, [applyProduct]);

  // ─── Grid cell keyboard handler ──────────────────────────────────────────
const handleCellKey = useCallback((e, rowIdx, colKey) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    e.stopPropagation();
    console.log('Grid ENTER:', colKey, 'row:', rowIdx);
    
    if (colKey === 'Productcode') {
      const code = items[rowIdx].Productcode?.trim();
      if (!code) {
        setProdModal({ open: true, rowIdx, query: '' });
      } else {
        handleProductcodeEnter(rowIdx, code);
      }
      return;
    }
    
    if (colKey === 'ProductName') {
      setProdModal({ open: true, rowIdx, query: items[rowIdx].ProductName || '' });
      return;
    }
    
    // Configured column nav
    const colPos = gridFocusOrder.indexOf(colKey);
    console.log('Grid ENTER - colKey:', colKey, 'colPos:', colPos, 'order:', gridFocusOrder);
    
    if (colPos !== -1 && colPos < gridFocusOrder.length - 1) {
      const nextCol = gridFocusOrder[colPos + 1];
      focusCell(rowIdx, nextCol);
    } else {
      // End of config → next row first config OR Productcode
      const nextRow = rowIdx + 1;
      if (nextRow >= items.length) {
        setItems(p => [...p, newRow()]);
      }
      const firstCol = gridFocusOrder[0] || 'Productcode';
      focusCell(nextRow, firstCol);
    }
    return;
  }, [items.length, gridFocusOrder, handleProductcodeEnter, focusCell]);

  // ─── Delete row ──────────────────────────────────────────────────────────
  const deleteRow = useCallback(idx => {
    setItems(prev => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length === 0 ? [newRow()] : next;
    });
  }, []);

  // ─── Save ────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!supplierId) { showToast('Supplier select pannunga!', 'error'); return; }
    if (!invoiceNo.trim()) { showToast('Invoice No enter pannunga!', 'error'); return; }
    const validItems = items.filter(i => i.Productcode);
    if (!validItems.length) { showToast('Minimum one product add pannunga!', 'error'); return; }
    if (parseFloat(invoiceAmt) > 0 && parseFloat(invoiceAmt) !== parseFloat(totals.netAmt)) {
      showToast('Invoice Amount ≠ Net Total — confirm pannunga!', 'warn');
    }
    const sup     = suppliers.find(s => s.Id === supplierId) || {};
    const purType = purchaseType === 'CASH' ? 'CA' : 'CR';
    const payload = [{
      Id:                  editMode ? editId : 0,
      SupplierRefId:       supplierId,
      PurchaseNo:          purchaseNo,
      CompanyRefId:        parseInt(localStorage.getItem('Comid') || '1'),
      PurchaseDate:        purchaseDate,
      PurchaseType:        purType,
      IGSTBill:            igst ? 'IGST' : 'GST',
      taxamount:           parseFloat(totals.gstAmt)  || 0,
      CTAmount:            parseFloat(totals.cgstAmt) || 0,
      STAmount:            parseFloat(totals.sgstAmt) || 0,
      SupplierName:        sup.AccountName            || '',
      SupplierInvoiceNo:   invoiceNo,
      SupplierInvoiceDate: invoiceDate,
      NetAmt:              parseFloat(totals.netAmt)  || 0,
      discamount:          parseFloat(totals.discAmt) || 0,
      cdamount:            parseFloat(totals.cdAmt)   || 0,
      Others_A:            parseFloat(overrides.otherPlus) || 0,
      Others_D:            parseFloat(overrides.otherSub)  || 0,
      DueDate:             dueDate,
      DisplayAmount:       parseFloat(totals.displayAmt)   || 0,
      FreightCharges:      parseFloat(overrides.transAmt)  || 0,
      CESSAmount:          parseFloat(totals.cessAmt) || 0,
      SPLCESSAmount:       0,
      Remarks:             remarks,
      UpdateId:            '',
      Credit:              0,
      Debit:               parseFloat(totals.netAmt)  || 0,
      IGSTAmount:          igst ? parseFloat(totals.gstAmt) || 0 : 0,
      PaymentRefId:        null,
      PoRefId:             null,
      Address1:            sup.Address1  || '',
      Address2:            sup.Address2  || '',
      City:                sup.City      || '',
      Phone:               sup.MobileNo  || '',
      Tin:                 sup.GSTNo     || '',
      Email:               sup.Email     || '',
      Modified_By:         localStorage.getItem('username') || 'sa',
      MultiPurchaseOrderMasterRefid: 0,
      PurchaseDetails: validItems.map(i => ({
        PDId:              i.id || 0,
        ProductRefId:      i.ProductRefId,
        Productcode:       i.Productcode,
        ProductName:       i.ProductName,
        HSNCode:           i.HSNCode,
        UOM:               i.UOM,
        UOMRefid:          i.UOMRefid || 0,
        MRP:               parseFloat(i.MRP)             || 0,
        PurchaseRate:      parseFloat(i.PurchaseRate)    || 0,
        LandingCost:       parseFloat(i.LandingCost)     || 0,
        OldPurchaseRate:   parseFloat(i.PurchaseRate)    || 0,
        ItemQty:           parseFloat(i.ItemQty)         || 0,
        FreeQty:           parseFloat(i.FreeQty)         || 0,
        CDPercent:         parseFloat(i.CDPercent)       || 0,
        CDAmount:          parseFloat(i.CDAmount)        || 0,
        DiscountPercent:   parseFloat(i.DiscountPercent) || 0,
        DiscountAmt:       parseFloat(i.DiscountAmt)     || 0,
        TaxPercent:        parseFloat(i.TaxPercent)      || 0,
        TaxAmt:            parseFloat(i.TaxAmt)          || 0,
        CTAmount:          parseFloat(i.CTAmount)        || 0,
        STAmount:          parseFloat(i.STAmount)        || 0,
        CESSPer:           parseFloat(i.CESSPer)         || 0,
        CESSAmount:        parseFloat(i.CESSAmount)      || 0,
        TransPer:          parseFloat(i.TransPer)        || 0,
        TransAmt:          parseFloat(i.TransAmt)        || 0,
        Salerate:          parseFloat(i.SalesRate)       || 0,
        SalesRate:         parseFloat(i.SalesRate)       || 0,
        WholeSaleRate:     parseFloat(i.WholeSaleRate)   || 0,
        ProfitPer:         parseFloat(i.ProfitPer)       || 0,
        ProfitAmt:         parseFloat(i.ProfitAmt)       || 0,
        SaleDiscountPer:   parseFloat(i.SaleDiscountPer) || 0,
        Amount:            parseFloat(i.Amount)          || 0,
        ProductTotal:      parseFloat(i.ProductTotal)    || 0,
        BatchNo:           i.BatchNo || '',
        EditMode:          i.EditMode || 0,
        StockQty:          parseFloat(i.StockQty) || 0,
        SerialNoType:      0,
      })),
      StockDetails:   [],
      SerialNoDetails:[],
    }];
    setLoading(true);
    try {
      const r = await PurchaseApi.savePurchase(payload);
      if (r.redis === false) { showToast('Session expired — please login again', 'error'); return; }
      if (r.ok) { showToast(r.message || 'Purchase saved successfully!', 'success'); handleClear(); }
      else      { showToast(r.message || 'Save failed', 'error'); }
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
    setLoading(false);
  }, [supplierId, invoiceNo, items, totals, overrides, igst, editMode, editId,
      purchaseNo, purchaseDate, dueDate, purchaseType, invoiceDate, invoiceAmt,
      remarks, suppliers]);

  // ─── Delete ──────────────────────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    if (!editMode || !editId) { showToast('Edit mode la irundhu delete pannunga!', 'warn'); return; }
    setConfirmDlg({
      msg: `Purchase No: ${purchaseNo} — delete pannanuma?`,
      onYes: async () => {
        setConfirmDlg(null);
        setLoading(true);
        try {
          const r = await PurchaseApi.deletePurchase(editId);
          if (r.ok) { showToast(r.message || 'Deleted!', 'success'); handleClear(); }
          else      { showToast(r.message || 'Delete failed', 'error'); }
        } catch (e) { showToast(e.message, 'error'); }
        setLoading(false);
      },
    });
  }, [editMode, editId, purchaseNo]);

  // ─── Edit load ───────────────────────────────────────────────────────────
  const handleEditLoad = useCallback(async id => {
    setLoading(true);
    try {
      const r = await PurchaseApi.getPurchaseById(id);
      const d = r.Data?.[0] || r.data?.[0] || r;
      if (!d?.PurchaseNo) { showToast('Record not found', 'error'); setLoading(false); return; }
      setPurchaseNo(d.PurchaseNo);
      setPurchaseDate(d.PurchaseDate?.split('T')[0] || today());
      setDueDate(d.DueDate?.split('T')[0] || today());
      setPurchaseType(d.PurchaseType === 'CA' ? 'CASH' : 'CREDIT');
      setSupplierId(d.SupplierRefId || 0);
      setInvoiceNo(d.SupplierInvoiceNo || '');
      setInvoiceDate(d.SupplierInvoiceDate?.split('T')[0] || today());
      setInvoiceAmt(f2(d.NetAmt));
      const isIgst = d.IGSTBill === 'IGST' || d.IGSTBill === 'UGST';
      setIgst(isIgst);
      setRemarks(d.Remarks || '');
      setOverrides({
        grossAmt: '', transAmt: f2(d.FreightCharges || 0), displayAmt: '', cdAmt: '', discAmt: '', 
        cessAmt: '', cgstAmt: '', sgstAmt: '', gstAmt: '', 
        otherPlus: f2(d.Others_A || 0), otherSub: f2(d.Others_D || 0), netAmt: ''
      });
      const rows = (d.PurchaseDetails || []).map(p => {
        const base = {
          _id: `row_${++rowCounter}`,
          id: p.PDId || 0,
          Productcode:     p.Productcode    || '',
          ProductName:     p.ProductName    || '',
          ProductRefId:    p.ProductRefId   || 0,
          HSNCode:         p.HSNCode        || '',
          UOM:             p.UOM            || '',
          UOMDecimal:      p.UOMDecimal     || 2,
          MRP:             f2(p.MRP         || 0),
          PurchaseRate:    f2(p.PurchaseRate|| 0),
          OldPurchaseRate: f2(p.PurchaseRate|| 0),
          StockQty:        f2(p.StockQty    || 0),
          ItemQty:         f2(p.ItemQty     || 0),
          FreeQty:         f2(p.FreeQty     || 0),
          Noms:            '0',
          CDPercent:       f2(p.CDPercent   || 0),
          CDAmount:        f2(p.CDAmount    || 0),
          DiscountPercent: f2(p.DiscountPercent||0),
          DiscountAmt:     f2(p.DiscountAmt || 0),
          TaxPercent:      f2(p.TaxPercent  || 0),
          TaxAmt:          f2(p.TaxAmt      || 0),
          CESSPer:         f2(p.CESSPer     || 0),
          CESSAmount:      f2(p.CESSAmount  || 0),
          TransPer:        '0', TransAmt: '0.00',
          LandingCost:     f2(p.LandingCost || 0),
          Amount:          f2(p.Amount      || 0),
          SalesRate:       f2(p.SalesRate   || p.Salerate || 0),
          WholeSaleRate:   f2(p.WholeSaleRate||0),
          ProfitPer:       f2(p.ProfitPer   || 0),
          ProfitAmt:       f2(p.ProfitAmt   || 0),
          SaleDiscountPer: f2(p.SaleDiscountPer||0),
          CTAmount:        f2(p.CTAmount    || 0),
          STAmount:        f2(p.STAmount    || 0),
          ProductTotal:    f2(p.ProductTotal|| p.Amount || 0),
          BatchNo:         p.BatchNo        || '',
          FreeQtyStatus:   0,
          EditMode:        0,
        };
        return calcItem(base, isIgst);
      });
      setItems([...rows, newRow()]);
      setEditMode(true);
      setEditId(id);
    } catch (e) { showToast('Load error: ' + e.message, 'error'); }
    setLoading(false);
  }, []);

  // ─── Clear / New ─────────────────────────────────────────────────────────
  const handleClear = useCallback(async () => {
    setEditMode(false); setEditId(0);
    setSupplierId(0);
    setSupInfo({ Address:'', City:'', ContactNo:'', Balance:0, CurrentStock:0, IGSTBill:'GST', CreditDays:0 });
    setInvoiceNo(''); setInvoiceAmt(''); setInvoiceDate(today());
    setPurchaseDate(today()); setDueDate(today());
    setPurchaseType('CREDIT'); setIgst(false); setRemarks('');
    setOverrides({ 
      grossAmt: '', transAmt: '', displayAmt: '', cdAmt: '', discAmt: '', 
      cessAmt: '', cgstAmt: '', sgstAmt: '', gstAmt: '', otherPlus: '', otherSub: '', netAmt: '' 
    });
    setItems([newRow()]);
    try {
      const r = await PurchaseApi.getNextPurchaseNo();
      if (r.ok) setPurchaseNo(r.purchaseNo);
    } catch {}
  }, []);

  // ─── Keyboard Shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      const anyModalOpen = prodModal.open || showF5 || showFocusConfig || confirmDlg;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (prodModal.open)   { setProdModal({ open:false, rowIdx:0, query:'' }); return; }
        if (showFocusConfig)  { setShowFocusConfig(null); return; }
        if (showF5)           { setShowF5(false); return; }
        if (confirmDlg)       { setConfirmDlg(null); return; }
        setConfirmDlg({
          msg: 'Do you want to quit?',
          onYes: () => { window.location.href = '/Home'; },
        });
        return;
      }

      if (anyModalOpen) return;

      if (e.key === 'F1') { e.preventDefault(); handleSave(); return; }

      if (e.key === 'F2') {
        e.preventDefault();
        setItems(prev => {
          if (!prev.length) return prev;
          const reversedIdx = [...prev].reverse().findIndex(r => r.Productcode);
          if (reversedIdx === -1) { showToast('Select a product row!', 'warn'); return prev; }
          const idx = prev.length - 1 - reversedIdx;
          const next = [...prev];
          const row = { ...next[idx] };
          if (!row.ProductRefId) { showToast('Invalid row!', 'warn'); return prev; }
          const isFree = row.FreeQtyStatus === 1;
          if (isFree) {
            row.FreeQtyStatus = 0;
            row.PurchaseRate = row.OldPurchaseRate || row.PurchaseRate;
          } else {
            row.FreeQtyStatus = 1;
            row.OldPurchaseRate = row.PurchaseRate;
            row.PurchaseRate = '0.00';
            row.CDPercent = '0'; row.CDAmount = '0.00';
            row.DiscountPercent = '0'; row.DiscountAmt = '0.00';
            row.CESSPer = '0'; row.CESSAmount = '0.00';
            row.Amount = '0.00';
          }
          next[idx] = calcItem(row, igst);
          return next;
        });
        return;
      }

      if (e.key === 'F5') { e.preventDefault(); setShowF5(true); return; }
      if (e.key === 'F9') { e.preventDefault(); handleDelete(); return; }
      if (e.ctrlKey && e.key === 'f') { e.preventDefault(); setShowFocusConfig('form'); return; }
      if (e.ctrlKey && e.key === 'g') { e.preventDefault(); setShowFocusConfig('grid'); return; }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [prodModal, showF5, showFocusConfig, confirmDlg, handleSave, handleDelete, igst]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  const balColor = supInfo.Balance < 0 ? '#dc2626' : supInfo.Balance > 0 ? '#16a34a' : '#888';

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', fontFamily:"'DM Sans',sans-serif", fontSize:12, background:'#f8fafc', overflow:'hidden' }}>

      {/* ═══ TOP BAR ═══════════════════════════════════════════════════════ */}
      <div style={{ background:'#ffffff', color:'#1a1a1a', height:44, borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', padding:'0 14px', gap:12, flexShrink:0, boxShadow:'0 2px 6px rgba(31,101,222,0.35)', zIndex:100 }}>
        <span style={{ fontWeight:700, fontSize:15, color:'#2563eb' }}>KassaPOS</span>
        <span style={{ fontSize:12.5, color:'#64748b' }}>{localStorage.getItem('CompanyName') || 'KASSAPOS SOFTWARE SOLUTIONS'}</span>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:12, color:'#64748b' }}>Bill Amount:</span>
          <span style={{ fontWeight:700, fontSize:14, fontFamily:'monospace', color:'#16a34a' }}>Rs.{totals.netAmt}</span>
          {editMode && (
            <span style={{ background:'#fef9c3', border:'1px solid #fde047', padding:'2px 9px', borderRadius:4, fontSize:11.5, color:'#854d0e', fontWeight:600 }}>
              ✏️ EDIT MODE
            </span>
          )}
        </div>
      </div>

      {/* ═══ SCROLLABLE PAGE ════════════════════════════════════════════════ */}
      <div style={{ flex:1, overflow:'auto', padding:'10px 12px', display:'flex', flexDirection:'column', gap:8 }}>

        {/* ── ROW 1: Purchase Info | Supplier Info | Invoice Info ── */}
        <div style={{ display:'flex', gap:6 }}>

          {/* Purchase Info */}
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:6, flex:'0 0 310px' }}>
            <div style={{ background:'#ffffff', color:'#2563eb', padding:'6px 10px', fontWeight:600, fontSize:11.5, borderRadius:'6px 6px 0 0', borderBottom:'1px solid #e2e8f0', borderLeft:'3px solid #2563eb' }}>📋 Purchase Info</div>
            <div style={{ padding:'10px 12px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px 8px' }}>
              <LF label="Purchase No">
                <input style={FS.inputRO} value={purchaseNo} readOnly />
              </LF>

              {/* ✅ FIX idx=0: Purchase Date → Enter → Purchase Type */}
              <LF label="Purchase Date">
                <input
ref={setFormRef(0)} data-field="purchaseDate"
                  type="date"
                  style={FS.input}
                  value={purchaseDate}
                  onChange={e => { setPurchaseDate(e.target.value); setDueDate(addDays(e.target.value, supInfo.CreditDays)); }}
                  onKeyDown={e => handleFormEnter(e, 0)}
                />
              </LF>

              {/* ✅ FIX idx=1: Purchase Type → Enter → Due Date */}
              <LF label="Purchase Type">
                <select
ref={setFormRef(1)} data-field="purchaseType"
                  style={FS.select}
                  value={purchaseType}
                  onChange={e => setPurchaseType(e.target.value)}
                  onKeyDown={e => handleFormEnter(e, 1)}
                >
                  <option value="CREDIT">CREDIT</option>
                  <option value="CASH">CASH</option>
                  <option value="IMPORT">IMPORT</option>
                </select>
              </LF>

              {/* ✅ FIX idx=2: Due Date → Enter → Supplier dropdown opens */}
              <LF label="Due Date">
                <input
ref={setFormRef(2)} data-field="dueDate"
                  type="date"
                  style={FS.input}
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  onKeyDown={e => handleFormEnter(e, 2)}
                />
              </LF>
            </div>
          </div>

          {/* Supplier Info */}
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:6, flex:1 }}>
            <div style={{ background:'#ffffff', color:'#2563eb', padding:'6px 10px', fontWeight:600, fontSize:11.5, borderRadius:'6px 6px 0 0', borderBottom:'1px solid #e2e8f0', borderLeft:'3px solid #2563eb' }}>🏭 Supplier Info</div>
            <div style={{ padding:'10px 12px' }}>
<LF label="Supplier Name">
                <div ref={setFormRef(3)} data-field="supplier" style={{position:'relative'}}>
                  {/* ✅ FIX: onEnter → handleSupplierEnter → focuses Invoice No (formRefs[4]) */}
                  <SupplierDropdown
                    ref={supplierRef}
                    suppliers={suppliers}
                    supplierId={supplierId}
                    onSelect={handleSupplierChange}
                    onEnter={handleSupplierEnter}
                  />
                </div>
              </LF>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 8px', marginTop:4 }}>
                <LF label="Address">
                  <input style={FS.inputRO} value={supInfo.Address} readOnly />
                </LF>
                <LF label="City">
                  <input style={FS.inputRO} value={supInfo.City} readOnly />
                </LF>
                <LF label="ContactNo">
                  <input style={FS.inputRO} value={supInfo.ContactNo} readOnly />
                </LF>
                <LF label="Current Balance">
                  <input style={{ ...FS.inputRO, color: balColor, fontWeight:700, fontFamily:'monospace' }}
                    value={f2(supInfo.Balance)} readOnly />
                </LF>
              </div>
            </div>
          </div>

          {/* Invoice Info */}
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:6, flex:'0 0 270px' }}>
            <div style={{ background:'#ffffff', color:'#2563eb', padding:'6px 10px', fontWeight:600, fontSize:11.5, borderRadius:'6px 6px 0 0', borderBottom:'1px solid #e2e8f0', borderLeft:'3px solid #2563eb' }}>🧾 Invoice Info</div>
            <div style={{ padding:'10px 12px', display:'flex', flexDirection:'column', gap:5 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#e8f0fd', borderRadius:4, padding:'4px 8px', marginBottom:2 }}>
                <span style={{ fontSize:11.5, color:'#1750b8', fontWeight:600 }}>Bill Amount</span>
                <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:14, color:'#16a34a' }}>Rs.{totals.netAmt}</span>
              </div>

              {/* ✅ FIX idx=4: Invoice No → Enter → Invoice Date */}
              <LF label="Invoice No">
                <input
ref={setFormRef(4)} data-field="invoiceNo"
                  style={FS.input}
                  value={invoiceNo}
                  onChange={e => setInvoiceNo(e.target.value)}
                  onKeyDown={e => handleFormEnter(e, 4)}
                  placeholder="Supplier Invoice No"
                />
              </LF>

              {/* ✅ FIX idx=5: Invoice Date → Enter → Invoice Amount */}
              <LF label="Invoice Date">
                <input
ref={setFormRef(5)} data-field="invoiceDate"
                  type="date"
                  style={FS.input}
                  value={invoiceDate}
                  onChange={e => setInvoiceDate(e.target.value)}
                  onKeyDown={e => handleFormEnter(e, 5)}
                />
              </LF>

              {/* ✅ FIX idx=6: Invoice Amount → Enter → Grid row 0 Productcode */}
              <LF label="Invoice Amount">
                <input
ref={setFormRef(6)} data-field="invoiceAmt"
                  style={{ ...FS.input, textAlign:'right', fontFamily:'monospace' }}
                  value={invoiceAmt}
                  onChange={e => setInvoiceAmt(e.target.value)}
                  onKeyDown={e => handleFormEnter(e, 6)}
                  placeholder="0.00"
                />
              </LF>
            </div>
          </div>
        </div>

        {/* ── PRODUCT GRID ── */}
        <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:6 }}>
          <div style={{ background:'#ffffff', color:'#2563eb', padding:'6px 10px', fontWeight:600, fontSize:11.5, borderRadius:'6px 6px 0 0', borderBottom:'1px solid #e2e8f0', borderLeft:'3px solid #2563eb', display:'flex', alignItems:'center', gap:10 }}>
            📦 Products
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10 }}>
              {['exclusive','inclusive'].map(m => (
                <label key={m} style={{ display:'flex', alignItems:'center', gap:3, cursor:'pointer', fontSize:11.5, color: taxMode===m ? 'white' : 'rgba(255,255,255,0.6)' }}>
                  <input type="radio" name="taxMode" value={m} checked={taxMode===m} onChange={() => setTaxMode(m)} style={{ accentColor:'white' }} />
                  {m.charAt(0).toUpperCase()+m.slice(1)}
                </label>
              ))}
              <label style={{ display:'flex', alignItems:'center', gap:3, cursor:'pointer', color:'white', fontSize:11.5 }}>
                <input type="checkbox" checked={igst} onChange={e => setIgst(e.target.checked)} style={{ accentColor:'white' }} />
                IGST
              </label>
              <span style={{ background:'rgba(255,255,255,0.2)', borderRadius:10, padding:'2px 9px', fontSize:11, color:'white', fontWeight:600 }}>
                Total Item Qty : {totals.totalQty}
              </span>
            </div>
          </div>
          <div style={{ overflow:'auto', maxHeight:255 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed' }}>
              <colgroup>
                <col style={{ width:42 }} />
                {COLS.map(c => <col key={c.key} style={{ width:c.w }} />)}
                <col style={{ width:34 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={TH}>S.No</th>
                  {COLS.map(c => <th key={c.key} style={{ ...TH, textAlign:c.align }}>{c.label}</th>)}
                  <th style={TH}>Del</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item._id} style={{ background:item.FreeQtyStatus===1?'#fef9c3':item.EditMode?'#f0fdf4':'#ffffff', borderBottom:'1px solid #f0f4ff' }}>
                    <td style={{ ...TD, textAlign:'center', color:'#8099be', fontSize:11 }}>{idx+1}</td>
                    {COLS.map(col => (
                      <td key={col.key} style={{ ...TD, padding:'1px 3px' }}>
                        {col.editable ? (
                          <input
                            ref={setRef(idx, col.key)}
                            style={{ width:'100%', height:22, padding:'0 3px',
                              border:'1px solid #aaaaaa', borderRadius:2, fontSize:11.5, outline:'none',
                              textAlign: col.align, fontFamily: col.align==='left' ? 'inherit' : 'monospace',
                              background:'white', color:'#1a2b4a' }}
                            value={item[col.key] ?? ''}
                            onFocus={e => { e.target.select(); e.target.style.borderColor='#2563eb'; e.target.style.boxShadow='0 0 0 2px rgba(37,99,235,0.15)'; }}
                            onBlur={e => { e.target.style.borderColor='#dde5f5'; e.target.style.boxShadow='none'; if (col.type === 'num') handleItemChange(idx, col.key, e.target.value); }}
                            onChange={e => handleItemChange(idx, col.key, e.target.value)}
                            onKeyDown={e => handleCellKey(e, idx, col.key)}
                          />
                        ) : (
                          <span style={{ display:'block', textAlign:col.align, fontFamily:'monospace', fontSize:11.5, padding:'2px 4px', color:'#4a6080' }}>
                            {item[col.key]}
                          </span>
                        )}
                      </td>
                    ))}
                    <td style={{ ...TD, textAlign:'center' }}>
                      <button onClick={() => deleteRow(idx)}
                        style={{ background:'none', border:'none', color:'#dc2626', cursor:'pointer', fontSize:13, lineHeight:1, opacity:0.7, padding:'1px 4px' }}
                        title="Delete row">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding:'5px 8px', display:'flex', alignItems:'center', gap:8, borderTop:'1px solid #e2e8f0', background:'#f8fafc' }}>
            <button
              style={{ background:'#eff6ff', border:'1px dashed #2563eb', color:'#2563eb', borderRadius:3, padding:'3px 10px', fontSize:11.5, cursor:'pointer', fontWeight:600 }}
              onClick={() => setItems(p => [...p, newRow()])}>
              ＋ Add Row
            </button>
            <button
              style={{ background:'none', border:'none', color:'#8099be', fontSize:11, cursor:'pointer' }}
              onClick={() => setProdModal({ open:true, rowIdx: items.length-1, query:'' })}>
              🔍 Search Product
            </button>
            <span style={{ marginLeft:'auto', fontSize:11, color:'#8099be' }}>
              {items.filter(i=>i.Productcode).length} item(s)
            </span>
          </div>
        </div>

        {/* ── BOTTOM: GST Summary | Amount Summary ── */}
        <div style={{ display:'flex', gap:6, alignItems:'flex-start' }}>
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:6, flex:'0 0 330px' }}>
            <div style={{ background:'#ffffff', color:'#2563eb', padding:'6px 10px', fontWeight:600, fontSize:11.5, borderRadius:'6px 6px 0 0', borderBottom:'1px solid #e2e8f0', borderLeft:'3px solid #2563eb' }}>📊 GST Summary</div>
            <div style={{ padding:'6px 8px' }}>
              <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6 }}>
                <label style={{ display:'flex', alignItems:'center', gap:3, fontSize:12, cursor:'pointer' }}>
                  <input type="radio" name="taxMode2" value="exclusive" checked={taxMode==='exclusive'} onChange={()=>setTaxMode('exclusive')} style={{ accentColor:'#2563eb' }} />
                  Exclusive
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:3, fontSize:12, cursor:'pointer' }}>
                  <input type="radio" name="taxMode2" value="inclusive" checked={taxMode==='inclusive'} onChange={()=>setTaxMode('inclusive')} style={{ accentColor:'#2563eb' }} />
                  Inclusive
                </label>
              </div>
              <input style={{ ...FS.input, width:'100%', textTransform:'uppercase', marginBottom:6 }}
                placeholder="Remarks..." value={remarks} onChange={e=>setRemarks(e.target.value.toUpperCase())} />
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11.5 }}>
                <thead>
                  <tr style={{ background:'#f8fafc', color:'#334155' }}>
                    <th style={{ padding:'4px 6px', textAlign:'center', fontWeight:500 }}>GST %</th>
                    <th style={{ padding:'4px 6px', textAlign:'right', fontWeight:500 }}>GST Amt</th>
                    <th style={{ padding:'4px 6px', textAlign:'right', fontWeight:500 }}>CGST Amt</th>
                    <th style={{ padding:'4px 6px', textAlign:'right', fontWeight:500 }}>SGST Amt</th>
                  </tr>
                </thead>
                <tbody>
                  {gstRows.length === 0 && (
                    <tr><td colSpan={4} style={{ padding:10, textAlign:'center', color:'#aaa', fontSize:11 }}>No data to display</td></tr>
                  )}
                  {gstRows.map(r => (
                    <tr key={r.gstPer} style={{ borderBottom:'1px solid #dde5f5' }}>
                      <td style={{ padding:'3px 6px', textAlign:'center', fontWeight:600 }}>{r.gstPer}%</td>
                      <td style={{ padding:'3px 6px', textAlign:'right', fontFamily:'monospace' }}>{f2(r.gstAmt)}</td>
                      <td style={{ padding:'3px 6px', textAlign:'right', fontFamily:'monospace' }}>{f2(r.cgst)}</td>
                      <td style={{ padding:'3px 6px', textAlign:'right', fontFamily:'monospace' }}>{f2(r.sgst)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:6, flex:1 }}>
            <div style={{ background:'#ffffff', color:'#2563eb', padding:'6px 10px', fontWeight:600, fontSize:11.5, borderRadius:'6px 6px 0 0', borderBottom:'1px solid #e2e8f0', borderLeft:'3px solid #2563eb' }}>💵 Amount Summary</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', borderTop:'1px solid #dde5f5' }}>
              
              {/* Column 1 */}
              <div style={{ borderRight:'1px solid #dde5f5' }}>
                <AR label="Gross Amt" value={overrides.grossAmt} placeholder={base.grossAmt} editable onChange={v => setOverrides(p=>({...p, grossAmt:v}))} />
                <div ref={setFormRef(7)} data-field="transAmt" tabIndex={0} onKeyDown={e => handleFormEnter(e, 7)}>
                  <AR label="Trans Amt" value={overrides.transAmt} placeholder={base.transAmt} editable onChange={v => setOverrides(p=>({...p, transAmt:v}))} />
                </div>
                <AR label="Display Amt" value={overrides.displayAmt} placeholder={base.displayAmt} editable onChange={v => setOverrides(p=>({...p, displayAmt:v}))} />
              </div>
              
              {/* Column 2 */}
              <div style={{ borderRight:'1px solid #dde5f5' }}>
                <AR label="CD Amt" value={overrides.cdAmt} placeholder={base.cdAmt} editable onChange={v => setOverrides(p=>({...p, cdAmt:v}))} />
                <AR label="Disc Amt" value={overrides.discAmt} placeholder={base.discAmt} editable onChange={v => setOverrides(p=>({...p, discAmt:v}))} />
                <AR label="CESS Amt" value={overrides.cessAmt} placeholder={base.cessAmt} editable onChange={v => setOverrides(p=>({...p, cessAmt:v}))} />
              </div>
              
              {/* Column 3 */}
              <div style={{ borderRight:'1px solid #dde5f5' }}>
                <AR label="CGST Amt" value={overrides.cgstAmt} placeholder={base.cgstAmt} editable onChange={v => setOverrides(p=>({...p, cgstAmt:v}))} />
                <AR label="SGST Amt" value={overrides.sgstAmt} placeholder={base.sgstAmt} editable onChange={v => setOverrides(p=>({...p, sgstAmt:v}))} />
                <AR label="GST Amt" value={overrides.gstAmt} placeholder={base.gstAmt} editable onChange={v => setOverrides(p=>({...p, gstAmt:v}))} />
              </div>
              
              {/* Column 4 */}
              <div>
                <div ref={setFormRef(8)} data-field="otherPlus" tabIndex={0} onKeyDown={e => handleFormEnter(e, 8)}>
                  <AR label="Others (+)" value={overrides.otherPlus} placeholder={base.otherPlus} editable onChange={v => setOverrides(p=>({...p, otherPlus:v}))} />
                </div>
                <div ref={setFormRef(9)} data-field="otherSub" tabIndex={0} onKeyDown={e => handleFormEnter(e, 9)}>
                  <AR label="Others (-)" value={overrides.otherSub} placeholder={base.otherSub} editable onChange={v => setOverrides(p=>({...p, otherSub:v}))} />
                </div>
                <AR label="Net Total" value={overrides.netAmt} placeholder={base.netAmt} editable onChange={v => setOverrides(p=>({...p, netAmt:v}))} highlight />
              </div>

            </div>
          </div>
        </div>

      </div>{/* end scrollable page */}

      {/* ═══ SHORTCUTS BAR ══════════════════════════════════════════════════ */}
      <div style={{ background:'#f8fafc', borderTop:'1px solid #e2e8f0', padding:'3px 10px', display:'flex', flexShrink:0, alignItems:'center', gap:10, flexWrap:'wrap' }}>
        {[
          ['F1','Save'],['F2','Free Prod'],['F3','Edit'],
          ['F5','View'],['F9','Delete'],['DEL','Del Row'],
          ['ESC','Exit'],['Ctrl+F','Form Focus'],['Ctrl+G','Grid Focus'],
        ].map(([k,l]) => (
          <span key={k} style={{ display:'flex', alignItems:'center', gap:3, fontSize:11, color:'#555' }}>
            <span style={{ background:'#eff6ff', border:'1px solid #bfdbfe', color:'#1d4ed8', fontFamily:'monospace', fontWeight:700, fontSize:10, padding:'1px 5px', borderRadius:3 }}>{k}</span>
            {l} &nbsp;|
          </span>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
          <button style={{ ...FS.btnP, height:26, padding:'0 12px', fontSize:11 }} onClick={handleSave}>
            💾 {editMode?'Update':'Save'}
          </button>
          <button style={{ ...FS.btnSec, height:26, padding:'0 10px', fontSize:11 }} onClick={() => setShowF5(true)}>
            📋 View
          </button>
          <button style={{ ...FS.btnDanger, height:26, padding:'0 10px', fontSize:11, opacity:editMode?1:0.4, cursor:editMode?'pointer':'not-allowed' }}
            onClick={handleDelete} disabled={!editMode}>
            🗑 Delete
          </button>
          <button style={{ ...FS.btnSec, height:26, padding:'0 10px', fontSize:11 }} onClick={handleClear}>
            🔄 New
          </button>
        </div>
      </div>

      {/* ═══ MODALS ════════════════════════════════════════════════════════ */}
      <ProductSearchModal
        open={prodModal.open}
        rowIdx={prodModal.rowIdx}
        initialQuery={prodModal.query}
        onClose={() => setProdModal({ open:false, rowIdx:0, query:'' })}
        onSelect={applyProduct}
      />

      {showF5 && (
        <F5ViewModal
          suppliers={suppliers}
          onClose={() => setShowF5(false)}
          onEditLoad={handleEditLoad}
        />
      )}

      {confirmDlg && (
        <ConfirmDialog
          msg={confirmDlg.msg}
          onYes={confirmDlg.onYes}
          onNo={() => setConfirmDlg(null)}
        />
      )}

      {showFocusConfig && (
        <FocusConfigModal
          type={showFocusConfig}
          onClose={() => setShowFocusConfig(null)}
onSave={(config) => {
            const enabled = config.filter(c => c.focus).sort((a,b)=>a.index-b.index).map(c=>c.key);
            if(showFocusConfig==='form') setFormFocusOrder(enabled);
            else setGridFocusOrder(enabled);
            localStorage.setItem(showFocusConfig==='form'?'PurchaseFormFocus':'PurchaseGridFocus', JSON.stringify(config));
          }}
        />
      )}

      {/* Spinner */}
      {loading && (
        <div style={{ position:'fixed', inset:0, background:'rgba(31,101,222,0.06)', zIndex:9000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(1px)' }}>
          <div style={{ width:38, height:38, border:'3px solid #bfdbfe', borderTopColor:'#2563eb', borderRadius:'50%', animation:'spin 0.6s linear infinite' }} />
        </div>
      )}

      <ToastHost />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type=text]:focus,input[type=number]:focus,input[type=date]:focus,select:focus {
          border-color: #2563eb !important; box-shadow: 0 0 0 2px rgba(37,99,235,0.15) !important;
          outline: none;
        }
        input[type=radio], input[type=checkbox] { cursor: pointer; }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-thumb { background: #bfdbfe; border-radius: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini helper components
// ─────────────────────────────────────────────────────────────────────────────
function LF({ label, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
      <label style={FS.label}>{label}</label>
      {children}
    </div>
  );
}

function AR({ label, value, placeholder, editable, onChange, highlight }) {
  const displayValue = (value === '' || value === undefined) ? placeholder : value;
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'3px 7px', borderBottom:'1px solid #f0f4ff', fontSize:12,
      background: highlight ? '#eff6ff' : 'white' }}>
      <span style={{ color: highlight?'#2563eb':'#64748b', fontWeight: highlight?700:'normal' }}>{label}</span>
      {editable ? (
        <input
          type="number"
          style={{ width:90, height:20, padding:'0 4px', border:'1px solid #aaaaaa', borderRadius:2,
            fontSize:11.5, fontFamily:'monospace', textAlign:'right', background:'white', outline:'none' }}
          value={displayValue}
          onChange={e => onChange(e.target.value)}
          onFocus={e => e.target.select()}
        />
      ) : (
        <span style={{ fontFamily:'monospace', fontWeight:highlight?700:600,
          color:highlight?'#16a34a':'#0f172a', fontSize:highlight?13:12 }}>
          {displayValue}
        </span>
      )}
    </div>
  );
}

const TH = {
  background:'#f8fafc', color:'#334155', padding:'5px 6px', fontWeight:500, fontSize:11,
  textAlign:'center', position:'sticky', top:0, zIndex:2, whiteSpace:'nowrap',
  borderRight:'1px solid rgba(255,255,255,0.12)',
};
const TD = {
  padding:'2px 4px', borderBottom:'1px solid #f0f4ff', borderRight:'1px solid #f0f4ff',
};
