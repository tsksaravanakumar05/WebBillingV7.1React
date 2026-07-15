// ─────────────────────────────────────────────────────────────────────────────
//  OpeningBalance.jsx  —  ItemMaster style: spreadsheet-row entry grid
//  Ported from frmitemmasteropenbal.cs (grdopening + Saveopeing / FormRefresh)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../Master/MasterPage.css";
import Topbar from "../components/Topbar";

import "../Itemmaster.css";
import * as CC from "../Master/Common";

const SelectItemByCodeUrl = "/api/ItemMasterApp/SelectItemMasterbyCodeId";
const ProductListUrl      = "/api/ItemMasterApp/GetProductListV7";

// ─── PRODUCT SEARCH POPUP ─────────────────────────────────────────────────────
function ProductSearchPopup({ products, onSelect, onClose, anchorPos }) {
  const [q, setQ]   = useState("");
  const [hi, setHi] = useState(0);
  const inputRef = useRef(null);
  const listRef  = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 30); }, []);
  const filtered = products.filter(p =>
    String(p.PName || p.ProductName || "").toLowerCase().includes(q.toLowerCase()) ||
    String(p.Prod_Code || p.ProductCode || "").toLowerCase().includes(q.toLowerCase())
  ).slice(0, 120);

  useEffect(() => { setHi(0); }, [q]);
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${hi}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [hi]);

  return (
    <div className="sb-prod-search" style={{ top: anchorPos?.top || 160, left: anchorPos?.left || 20, width: 820, height: "80vh" }}>
      <div className="sb-prod-search-hdr">
        <span className="sb-ps-title">🔍 Product Search</span>
        <span className="sb-ps-count">{filtered.length} items</span>
        <button className="sb-ps-close" onClick={onClose}>✕</button>
      </div>
      <div className="sb-ps-input-wrap">
        <span className="sb-ps-icon">⌕</span>
        <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
          placeholder="Type code or name…" className="sb-ps-input"
          onKeyDown={e => {
            if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); }
            if (e.key === "ArrowUp")   { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
            if (e.key === "Enter")     { e.preventDefault(); if (filtered[hi]) onSelect(filtered[hi]); }
            if (e.key === "Escape")    { e.preventDefault(); onClose(); }
          }}
        />
      </div>
      <div className="sb-ps-cols">
        <span style={{ width: 90 }}>Code</span>
        <span style={{ flex: 1 }}>Product Name</span>
        <span style={{ width: 72, textAlign: "right" }}>Sale Rate</span>
        <span style={{ width: 60, textAlign: "right" }}>Stock</span>
      </div>
      <div ref={listRef} className="sb-prod-list">
        {filtered.length === 0
          ? <div className="sb-ps-empty">No products found</div>
          : filtered.map((p, idx) => (
            <div key={p.Id} data-idx={idx}
              className={`sb-prod-item${idx === hi ? " hi" : ""}`}
              onClick={() => onSelect(p)} onMouseEnter={() => setHi(idx)}>
              <span className="sb-prod-code">{p.Prod_Code || p.ProductCode}</span>
              <span className="sb-prod-name">{p.PName || p.ProductName}</span>
              <span className="sb-prod-rate">₹{f2(vn(p.SaleRate || p.SalesRate)).toFixed(2)}</span>
              <span className="sb-prod-stock">{vn(p.Stock).toFixed(0)}</span>
            </div>
          ))
        }
      </div>
      <div className="sb-ps-footer">
        <span><kbd>↑↓</kbd> Navigate</span><span><kbd>Enter</kbd> Select</span><span><kbd>Esc</kbd> Close</span>
      </div>
    </div>
  );
}


// ─── COLUMNS ─────────────────────────────────────────────────────────────────
// Mirrors grdopening columns: code, description, qty, rate(Lrate), value.
// ExpDate / MFDate are carried in row state (needed by the save payload) but
// stay hidden — the reference screen doesn't expose them either.
const COLUMNS = [
  { key: "ProductCode", label: "Product Code", width: 150 },
  { key: "ProductName", label: "Description", width: 300 },
  { key: "Qty", label: "Qty", width: 110, type: "f2" },
  { key: "LandingCost", label: "LandingCost", width: 130, type: "f2" },
  { key: "Value", label: "Value", width: 130, type: "f2", calc: true },
];

const SNO_W = 44;
const DEL_W = 44;
const UPPER_KEYS = new Set(["ProductCode"]);

let _rid = 1000;
const genRid = () => ++_rid;
const vn = v => parseFloat(v) || 0;
const ni = v => parseInt(v) || 0;
const f2 = v => parseFloat(vn(v).toFixed(2));
const ns = v => (v == null ? "" : String(v));
const s = v => String(v == null ? "" : v);

const mkEmptyRow = () => ({
  _rid: genRid(),
  Id: 0,
  ProductId: 0,
  ProductCode: "",
  ProductName: "",
  Qty: "",
  LandingCost: "",
  Value: "",
  ExpDate: "",
  MFDate: "",
  RealQty: 0,   // ✅ புது row → save ஆன original qty இல்லை, அதனால 0
  _dirty: false,
  _isNew: true,
});

// Row coming back from OpeningStockSelect → internal shape.
// API field spellings follow the OpeningStockModel used by Saveopeing()
// (LaningCost / Productcode / Expdate / MFdate — kept exactly as-is).
const fmtRow = o => ({
  _rid: genRid(),
  Id: o.Id || 0,
  ProductId: o.ProductId || 0,
  ProductCode: o.Productcode || o.ProductCode || "",
  ProductName: o.ProductName || "",
  Qty: o.Qty === undefined || o.Qty === null ? "" : f2(o.Qty),
  LandingCost: o.LaningCost === undefined || o.LaningCost === null ? "" : f2(o.LaningCost),
  Value: o.Amount === undefined || o.Amount === null ? "" : f2(o.Amount),
  ExpDate: o.Expdate ? String(o.Expdate) : "",
  MFDate: o.MFdate ? String(o.MFdate) : "",
  RealQty: o.Qty === undefined || o.Qty === null ? 0 : f2(o.Qty), // ✅ original saved qty — snapshot at load time only
  _dirty: false,
  _isNew: false,
});

// Value = Qty * LandingCost (Noms/multiplier omitted — not part of this screen)
const calcValue = row => f2(vn(row.Qty) * vn(row.LandingCost));

export default function OpeningBalance() {
  const navigate = useNavigate();
  const { confirm, ConfirmUI } = CC.useConfirm();
  const { toast, toasts } = CC.useToast();
  const { showAlert, AlertUI } = CC.useAlert();

  const [perm, setPerm] = useState({ View: 0, Add: 0, Edit: 0, Delete: 0 });
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [sess] = useState(() => {
    try {
      const Comid = CC.getStr("Comid") || "1";
      const MComid = CC.getStr("MComid") || Comid;
      const IdComList = CC.getStr("IdComList") || Comid;
      return { Comid, MComid, IdComList };
    } catch {
      return { Comid: "1", MComid: "1", IdComList: "1" };
    }
  });

  const [rows, setRows] = useState([mkEmptyRow()]);
  const [loading, setLoading] = useState(false);
  const [ldMsg, setLdMsg] = useState("Loading...");
  const [selRid, setSelRid] = useState(null);
  const [vErr, setVErr] = useState("");

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [prodPopup, setProdPopup] = useState(null);
  const [prodList, setProdList] = useState([]);

  const rowsRef = useRef(rows);
  const cellRefs = useRef({});
  const searchRef = useRef(null);

  useEffect(() => { rowsRef.current = rows; }, [rows]);

  // ── Auth / permission check (same pattern as ItemMaster) ─────────────────
  useEffect(() => {
    const menuStr = localStorage.getItem("menulist");
    // if (!menuStr) {
    //   alert("Session Close Please Login !!!.");
    //   navigate("/Login/Index");
    //   return;
    // }
    // const menulist = JSON.parse(menuStr);
    // const menudata = menulist.filter(o => o.PageName === "Opening Balance");
    // if (!menudata || menudata.length === 0) {
    //   alert("Page Access Permission Denied !!!.");
    //   setTimeout(() => navigate("/"), 3000);
    //   return;
    // }
    // if (menudata[0].View === 0) {
    //   alert("Page Access Permission Denied !!!.");
    //   setTimeout(() => navigate("/"), 3000);
    //   return;
    // }
    //setPerm({ View: menudata[0].View, Add: menudata[0].Add, Edit: menudata[0].Edit, Delete: menudata[0].Delete });
    setPerm({ View: 1, Add: 1, Edit: 1, Delete: 1 });
    setIsAuthorized(true);
  }, [navigate]);

  const regRef = useCallback((rid, colKey, el) => {
    if (!cellRefs.current[rid]) cellRefs.current[rid] = {};
    if (el) cellRefs.current[rid][colKey] = el; else delete cellRefs.current[rid]?.[colKey];
  }, []);

  const focusCell = useCallback((rid, colKey) => {
    setTimeout(() => {
      const el = cellRefs.current[rid]?.[colKey];
      if (el) {
        el.focus();
        try { if (el.setSelectionRange) { const len = el.value.length; el.setSelectionRange(len, len); } } catch {}
      }
    }, 0);
  }, []);

  // ── Load opening stock (FormRefresh → SelectOpeningStock) ────────────────
  const loadOpeningStock = useCallback(async () => {
    setLoading(true); setLdMsg("Loading Opening Balance...");
    const res = await CC.api(CC.SelectOpeningStock, null, {}, { Comid: sess.Comid, BatchwiseSizeStock: 0 });
    setLoading(false);
    if (res._netErr) { toast(`❌ ${res.message}`, true); setRows([mkEmptyRow()]); return; }
    const arr = Array.isArray(res.data) ? res.data : Array.isArray(res.Data1) ? res.Data1 : Array.isArray(res) ? res : [];
    const fmt = arr.map(fmtRow);
    setRows([...fmt, mkEmptyRow()]);
    setTimeout(() => focusCell(fmt.length ? fmt[fmt.length - 1]._rid : rowsRef.current[0]?._rid, "ProductCode"), 60);
  }, [sess.Comid, toast, focusCell]);

  useEffect(() => { if (isAuthorized) loadOpeningStock(); }, [isAuthorized]); // eslint-disable-line

  // ── Ensure exactly one trailing blank row exists ──────────────────────────
  const ensureTrailingBlank = useCallback(list => {
    const last = list[list.length - 1];
    if (!last || String(last.ProductCode || "").trim()) return [...list, mkEmptyRow()];
    return list;
  }, []);

  const redirectIfDualLogin = useCallback(res => {
    if (res?._dualLogin || res?.redis === false) { alert("Already Login Another User Please Login Again!!!"); navigate("/"); return true; }
    return false;
  }, [navigate]);

  const fillItemIntoRow = useCallback((rid, item) => {
    setRows(prev => {
      const next = prev.map(r => {
        if (r._rid !== rid) return r;
        const landingCost = f2(vn(item.LandingCost || item.Landingcost));
        return {
          ...r,
          ProductCode: item.ProductCode || item.Prod_Code || "",
          ProductName: item.ProductName || item.PName || "",
          ProductId: item.Id,
          LandingCost: landingCost,
          Value: calcValue({ Qty: r.Qty, LandingCost: landingCost }),
          _dirty: true,
        };
      });
      return ensureTrailingBlank(next);
    });
    setProdPopup(null);
    focusCell(rid, "Qty");
  }, [ensureTrailingBlank, focusCell]);

  const fetchProductByCode = useCallback(async (rid, code) => {
    if (!code.trim()) return;
    const res = await CC.api(SelectItemByCodeUrl, null, {}, {
      code: code.trim().toUpperCase(),
      Comid: sess.MComid, CComid: sess.Comid,
      Id: 0, Batchwise: 0,
    });
    if (redirectIfDualLogin(res)) return;
    const arr = Array.isArray(res.data) ? res.data : Array.isArray(res.Data1) ? res.Data1 : [];
    if (arr.length === 0) { toast("❌ Invalid Product Code !!!", true); return; }
    if (arr.length === 1) fillItemIntoRow(rid, arr[0]);
    else {
      setProdList(arr);
      setProdPopup({ rid, pos: { top: 200, left: 80 } });
    }
  }, [sess, fillItemIntoRow, redirectIfDualLogin, toast]);

  const loadProductsForPopup = useCallback(async (rid) => {
    if (prodList.length > 0) { setProdPopup({ rid, pos: { top: 160, left: 80 } }); return; }
    setLoading(true); setLdMsg("Loading products...");
    const res = await CC.api(ProductListUrl, null, {}, { Comid: sess.Comid });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    const arr = Array.isArray(res.data) ? res.data : Array.isArray(res.Data1) ? res.Data1 : [];
    setProdList(arr);
    setProdPopup({ rid, pos: { top: 160, left: 80 } });
  }, [sess, prodList, redirectIfDualLogin]);

  // ── Cell change handlers ──────────────────────────────────────────────────
 const handleCellChange = useCallback((rid, colKey, value) => {
  setRows(prev => prev.map(r => {
    if (r._rid !== rid) return r;
    let fv = UPPER_KEYS.has(colKey) && typeof value === "string" ? value.toUpperCase() : value;
    let u = { ...r, [colKey]: fv, _dirty: true };
    if (colKey === "Qty" || colKey === "LandingCost") {
      u.Value = calcValue(u);
    }
    // RealQty is intentionally NOT recalculated here — it must stay as the
    // original loaded qty (mirrors grdRealQty in the WinForms grid, which
    // only gets set in FormRefresh and never on qty edits).
    return u;
  }));
  setVErr("");
}, []);
  const handleCellKeyDown = useCallback((e, rid, colKey) => {
    const editableKeys = ["ProductCode", "Qty", "LandingCost"];
    const idx = rows.findIndex(r => r._rid === rid);
    const colIdx = editableKeys.indexOf(colKey);

    if (e.key === "Enter") {
      e.preventDefault();
      if (colKey === "ProductCode") {
        const row = rows.find(r => r._rid === rid);
        if (row?.ProductCode?.trim()) fetchProductByCode(rid, row.ProductCode);
        else loadProductsForPopup(rid);
        return;
      }
      if (colIdx < editableKeys.length - 1) {
        focusCell(rid, editableKeys[colIdx + 1]);
      } else if (idx < rows.length - 1) {
        focusCell(rows[idx + 1]._rid, "ProductCode");
      }
    } else if (e.key === "ArrowDown" && idx < rows.length - 1) {
      e.preventDefault();
      focusCell(rows[idx + 1]._rid, colKey);
    } else if (e.key === "ArrowUp" && idx > 0) {
      e.preventDefault();
      focusCell(rows[idx - 1]._rid, colKey);
    } else if (e.key === "ArrowRight") {
      let atEnd = false;
      try { atEnd = e.target.selectionStart === e.target.value.length; } catch {}
      if (atEnd && colIdx < editableKeys.length - 1) { e.preventDefault(); focusCell(rid, editableKeys[colIdx + 1]); }
    } else if (e.key === "ArrowLeft") {
      let atStart = false;
      try { atStart = e.target.selectionStart === 0; } catch {}
      if (atStart && colIdx > 0) { e.preventDefault(); focusCell(rid, editableKeys[colIdx - 1]); }
    } else if (e.key === " " && colKey === "ProductCode") {
      e.preventDefault();
      loadProductsForPopup(rid);
    }
  }, [rows, focusCell, fetchProductByCode, loadProductsForPopup]);

  const doDeleteRow = useCallback(async rid => {
    const row = rows.find(r => r._rid === rid);
    if (!row) return;
    if (rows.length === 1) { setRows([mkEmptyRow()]); return; }
    const ok = await confirm(`Remove "${row.ProductName || row.ProductCode || "this row"}" from the grid?`);
    if (!ok) return;
    setRows(prev => {
      const next = prev.filter(r => r._rid !== rid);
      return ensureTrailingBlank(next);
    });
    if (selRid === rid) setSelRid(null);
  }, [rows, confirm, selRid, ensureTrailingBlank]);

  // ── GridEmptyCheck equivalent ──────────────────────────────────────────────
  const validateGrid = useCallback(async list => {
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (!String(r.ProductCode || "").trim()) { await showAlert("Enter All Product Code in the Grid !!!."); focusCell(r._rid, "ProductCode"); return false; }
      if (!String(r.ProductName || "").trim()) { await showAlert("Enter All Description in the Grid !!!."); focusCell(r._rid, "ProductCode"); return false; }
      if (String(r.Qty || "").trim() === "") { await showAlert("Enter All Quantity in the Grid !!!."); focusCell(r._rid, "Qty"); return false; }
      if (String(r.LandingCost || "").trim() === "") { await showAlert("Enter All Rates in the Grid !!!."); focusCell(r._rid, "LandingCost"); return false; }
    }
    return true;
  }, [showAlert, focusCell]);

  // ── Saveopeing() ────────────────────────────────────────────────────────────
  const doSave = useCallback(async () => {
    if (!perm.Add && !perm.Edit) { await showAlert("Page Add & Update Permission Denied !!!"); return; }
    const latest = rowsRef.current.filter(r => String(r.ProductCode || "").trim());
    if (!latest.length) { await showAlert("No Update"); return; }
    if (!(await validateGrid(latest))) return;

    const ok = await confirm("Wish to Save Product Opening Balance Details ?");
    if (!ok) return;

    // OpeningStockModel[] payload (matches Saveopeing's objCategoryModel)
// OpeningStockModel[] payload (matches Saveopeing's objCategoryModel)
const payload = latest.map(r => ({
  Id: ni(r.Id),
  ProductId: ni(r.ProductId),
  ProductName: s(r.ProductName).trim(),
  Productcode: s(r.ProductCode).trim(),
  LaningCost: vn(r.LandingCost),
  Expdate: r.ExpDate || null,
  MFdate: r.MFDate || null,
  RealQty: vn(r.RealQty),   // ✅ FIX — original/saved qty, NOT current qty
  Qty: ni(r.Qty),           // current edited qty
}));

// OpeningStockdetails[] (matches ObjOpeningStockdetails / "StockDetails" header)
const stockDetails = latest.map(r => ({
  ProductRefid: ni(r.ProductId),
  SerialNoStatus: 0,
  AdjustType: 0,
  Batchid: 0,
  Expdate: r.ExpDate || null,
  MFdate: r.MFDate || null,
  RealQty: vn(r.RealQty),   // ✅ FIX — original/saved qty, NOT current qty
  Qty: ni(r.Qty),
}));
console.log(stockDetails);
    setLoading(true); setLdMsg("Saving...");
    const hdrs = { "Comid": String(sess.MComid), "StockDetails": JSON.stringify(stockDetails) };
    try {
      const res = await CC.insertapi(CC.InsertOpeingStock, payload, hdrs);
      setLoading(false);
      if (res._netErr) { await showAlert(res.message || "Unable to save. Please try again."); return; }
      if (res.ok ?? res.IsSuccess) {
        toast("✅ " + (res.message || "Update Successfully !!!."));
        await loadOpeningStock();
      } else {
        await showAlert(res.Message || res.message || "Unable to save the item. Please try again.");
      }
    } catch (err) {
      setLoading(false);
      await showAlert("Save Failed\n\n" + (err?.message || "Unable to save the item. Please try again."));
    }
  }, [perm, validateGrid, confirm, sess, toast, showAlert, loadOpeningStock]);

  // ── F9 Search (Txt_Search jump-to-row) ─────────────────────────────────────
  const doSearch = useCallback(() => {
    const q = searchQ.trim().toUpperCase();
    if (!q) { setSearchOpen(false); return; }
    const match = rows.find(r =>
      String(r.ProductCode || "").toUpperCase().includes(q) ||
      String(r.ProductName || "").toUpperCase().includes(q)
    );
    if (!match) { showAlert("Product not Found !!!."); return; }
    setSelRid(match._rid);
    setSearchOpen(false);
    setSearchQ("");
    focusCell(match._rid, "ProductCode");
  }, [rows, searchQ, showAlert, focusCell]);

  useEffect(() => { if (searchOpen) setTimeout(() => searchRef.current?.focus(), 30); }, [searchOpen]);

  // ── Global shortcuts: F1 Save, F9 Search, Esc Exit ─────────────────────────
  useEffect(() => {
    const onKey = async e => {
      if (searchOpen) {
        if (e.key === "Enter") { e.preventDefault(); doSearch(); }
        if (e.key === "Escape") { e.preventDefault(); setSearchOpen(false); }
        return;
      }
      if (e.key === "F1") { e.preventDefault(); doSave(); }
      if (e.key === "F9") { e.preventDefault(); setSearchOpen(true); }
      if (e.key === "Escape") {
        e.preventDefault();
        const ok = await confirm("Do You Want To Quit?");
        if (ok) navigate(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen, doSearch, doSave, navigate, confirm]);

  const totW = SNO_W + DEL_W + COLUMNS.reduce((sum, c) => sum + c.width, 0);
  const dirtyCount = rows.filter(r => r._dirty && String(r.ProductCode || "").trim()).length;

  if (!isAuthorized) return null;

  // ── renderCell ────────────────────────────────────────────────────────────
  const renderCell = (row, col) => {
    const rid = row._rid;
    const val = row[col.key];
    const reg = el => regRef(rid, col.key, el);

    if (col.calc) {
      return <span className="lc-value">{val === "" || val === undefined ? "" : vn(val).toFixed(2)}</span>;
    }

    if (col.key === "ProductCode") {
      return (
        <input ref={reg} type="text" value={ns(val)}
          className="mp-cell-input"
          style={{ border: "1px solid #93c5fd", background: "#fff" }}
          onChange={e => CC.applyUppercase(e, v => handleCellChange(rid, col.key, v))}
          onKeyDown={e => handleCellKeyDown(e, rid, col.key)}
          onFocus={() => setSelRid(rid)}
          placeholder="Product Code"
        />
      );
    }

    if (col.key === "ProductName") {
      return (
        <input type="text" value={ns(val)} readOnly
          className="mp-cell-input"
          style={{ border: "none", background: "transparent", cursor: "default" }}
          tabIndex={-1}
        />
      );
    }

    // Qty / LandingCost — editable numeric
    return (
      <input ref={reg} type="text" inputMode="decimal" step="0.01"
        value={val === "" || val === undefined ? "" : val}
        className="mp-cell-input"
        style={{ border: "1px solid #93c5fd", background: "#fff" }}
        onChange={e => handleCellChange(rid, col.key, e.target.value)}
        onKeyDown={e => handleCellKeyDown(e, rid, col.key)}
        onFocus={e => { setSelRid(rid); e.target.select(); }}
        placeholder="0.00"
      />
    );
  };

  return (
    <div className="mp-wrap">
      {ConfirmUI}
      {AlertUI}
      <Topbar />

      <div className="mp-body mp-ibody">
        <div className="mp-toolbar" style={{ justifyContent: "space-between" }}>
          <div className="mp-title" style={{ fontSize: 15 }}>Product Opening Balance</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="mp-badge">Rows: {rows.filter(r => String(r.ProductCode || "").trim()).length}</span>
            {dirtyCount > 0 && <span className="mp-badge-warn">✏️ {dirtyCount} unsaved</span>}
            {vErr && <span className="mp-verr">{vErr}</span>}
          </div>
        </div>

        <div className="mp-grid-wrap">
          <div className="mp-gscroll">
            <table className="mp-tbl" style={{ width: totW, minWidth: totW }}>
              <thead>
                <tr className="mp-col-row">
                  <th style={{ width: SNO_W, position: "sticky", top: 0, zIndex: 5 }}>SNo</th>
                  {COLUMNS.map(c => (
                    <th key={c.key} style={{ width: c.width, minWidth: c.width, position: "sticky", top: 0, zIndex: 5 }}>
                      {c.label}
                    </th>
                  ))}
                  <th style={{ width: DEL_W, position: "sticky", top: 0, zIndex: 5 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={row._rid}
                    className={[
                      selRid === row._rid ? "sel" : "",
                      row._dirty ? "mod" : "",
                    ].filter(Boolean).join(" ")}
                    onClick={() => setSelRid(row._rid)}
                  >
                    <td className="sno">{idx + 1}</td>
                    {COLUMNS.map(col => (
                      <td key={col.key} onClick={e => e.stopPropagation()}>
                        {renderCell(row, col)}
                      </td>
                    ))}
                    <td style={{ textAlign: "center" }}>
                      <button className="mp-del-btn" onClick={e => { e.stopPropagation(); doDeleteRow(row._rid); }}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom toolbar — matches F1-Save / F9-Search / Esc-Exit footer */}
        <div className="mp-toolbar">
          <button className="mp-btn sv" onClick={doSave} disabled={loading}>💾 F1 Save</button>
          <button className="mp-btn" onClick={() => setSearchOpen(true)} disabled={loading}>🔍 F9 Search</button>
          <button className="mp-btn" onClick={async () => { await loadOpeningStock(); }} disabled={loading}>🔄 Refresh</button>
          <button className="mp-btn dl" onClick={async () => { const ok = await confirm("Do You Want To Quit?"); if (ok) navigate(-1); }}>✕ Esc Exit</button>
        </div>
      </div>

      {/* F9 Search popup */}
      {searchOpen && (
        <div className="mp-ov" onClick={e => { if (e.target === e.currentTarget) setSearchOpen(false); }}>
          <div className="mp-modal-box" style={{ width: 360, padding: "20px 24px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "#1f65de" }}>🔍 Search Product</div>
            <input ref={searchRef} type="text" value={searchQ}
              onChange={e => setSearchQ(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); doSearch(); } if (e.key === "Escape") setSearchOpen(false); }}
              placeholder="Product Code or Description..."
              style={{ width: "100%", padding: "7px 10px", border: "1px solid #c5d8f8", borderRadius: 4, fontSize: 13, marginBottom: 14, outline: "none", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="mp-btn" onClick={() => setSearchOpen(false)}>Cancel</button>
              <button className="mp-btn sv" onClick={doSearch}>Find</button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="mp-loader-ov">
          <div className="mp-ldr-box">
            <div className="mp-spin" />
            <div className="mp-ldr-msg">{ldMsg}</div>
          </div>
        </div>
      )}

      {prodPopup && (
        <ProductSearchPopup
          products={prodList}
          anchorPos={prodPopup.pos}
          onClose={() => setProdPopup(null)}
          onSelect={p => fillItemIntoRow(prodPopup.rid, p)}
        />
      )}

      <CC.ToastList toasts={toasts} />
    </div>
  );
}