// ─────────────────────────────────────────────────────────────────────────────
//  RateChange.jsx
//  Item Master · Price Update
//
//  Architecture follows SupplierMaster.jsx exactly:
//   • Session / perm  → CC.buildSession()
//   • Confirm dialog  → CC.useConfirm()
//   • Toast           → CC.useToast() + CC.ToastList
//   • API calls       → CC.api() / CC.insertapi() with CC.RateChange* endpoints
//   • Grid pattern    → EditMode 0/1 toggle, dirtyIds ref, enableEdit()
//   • F12 column vis  → colSettings stored in localStorage
//   • Product picker  → inline ProductPickerModal (mirrors SalesmanPicker style)
//   • Keyboard        → F1 Save · F2 Add Row · Esc Quit · F12 Columns
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./MasterPage.css";
import Topbar from "../components/Topbar";
import * as CC from "../components/Common";

// ─── Column config ────────────────────────────────────────────────────────────
// "hidden" controls default visibility (user can toggle via F12).
// Read-only OLD columns are never togglable — they are always rendered inline
// next to their editable NEW counterpart (see renderCell).
const ALL_COLUMNS = [
  { field: "ProductCode",   label: "Product Code",   type: "string",  maxLen: 100, width: 130, hidden: false, required: true },
  { field: "ProductName",   label: "Description",    type: "ro",      width: 200, hidden: false },
  { field: "OldMRP",        label: "MRP (Old)",      type: "ro-num",  width: 90,  hidden: false },
  { field: "MRP",           label: "MRP (New)",      type: "float",   maxLen: 18, width: 90,  hidden: false },
  { field: "oldpurRate",    label: "Old Pur.Rate",   type: "ro-num",  width: 105, hidden: false },
  { field: "PurchaseRate",  label: "New Pur.Rate",   type: "float",   maxLen: 18, width: 105, hidden: false },
  { field: "oldSaleRate",   label: "Old Sale Rate",  type: "ro-num",  width: 105, hidden: false },
  { field: "SalesRate",     label: "New Sale Rate",  type: "float",   maxLen: 18, width: 105, hidden: false },
  { field: "oldWholeSaleRate", label: "Old W.S Rate", type: "ro-num", width: 105, hidden: false },
  { field: "WholeSaleRate", label: "New W.S Rate",   type: "float",   maxLen: 18, width: 105, hidden: false },
];

const vn = (v) => parseFloat(v) || 0;

// ─── makeNewRow ───────────────────────────────────────────────────────────────
const makeNewRow = () => ({
  _uid:             CC.uid(),
  EditMode:         1,          // new rows always start editable
  Id:               null,
  SchemeRefId:      null,
  ProductCode:      "",
  ProductName:      "",
  OldMRP:           "",
  oldpurRate:       "",
  oldSaleRate:      "",
  oldWholeSaleRate: "",
  MRP:              "",
  PurchaseRate:     "",
  SalesRate:        "",
  WholeSaleRate:    "",
});

// ─── ProductPickerModal ────────────────────────────────────────────────────────
// Mirrors SalesmanPicker style / keyboard pattern from SupplierMaster exactly.
function ProductPickerModal({ Comid, onSelect, onClose }) {
  const [all,        setAll]       = useState([]);
  const [search,     setSearch]    = useState("");
  const [focusedIdx, setFocusedIdx] = useState(0);
  const [err,        setErr]       = useState("");
  const searchRef = useRef(null);
  const listRef   = useRef(null);

  // Load product list on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await CC.api(CC.RateChangeItemSelect, null, {}, {
        Comid:      Number(Comid) || 1,
        Startindex: 0,
        PageCount:  500,
        Keyword:    "",
        Column:     "",
      });
      if (!mounted) return;
      if (res._netErr || res._http404) { setErr(res.message || "Failed to load products"); return; }
      const arr = Array.isArray(res.Data1)      ? res.Data1
                : Array.isArray(res.data?.Data1) ? res.data.Data1
                : Array.isArray(res.data)         ? res.data
                : [];
      setAll(arr);
    })();
    const t = setTimeout(() => { searchRef.current?.focus(); }, 80);
    return () => { mounted = false; clearTimeout(t); };
  }, [Comid]);

  // Reset focused index when search changes
  useEffect(() => { setFocusedIdx(0); }, [search]);

  // Scroll focused item into view
  useEffect(() => {
    listRef.current?.querySelectorAll(".rc-picker-item")[focusedIdx]?.scrollIntoView({ block: "nearest" });
  }, [focusedIdx]);

  const keyword  = search.trim().toLowerCase();
  const filtered = keyword
    ? all.filter(p => {
        const name = String(p.ProductName || "").toLowerCase();
        const code = String(p.ProductCode || p.Productcode || p.PCode || "").toLowerCase();
        return name.includes(keyword) || code.includes(keyword);
      })
    : all;

  const commit = (item) =>
    onSelect(item.ProductCode || item.Productcode || item.PCode || "");

  const onSearchKey = (e) => {
    if (e.key === "Escape")    { e.preventDefault(); onClose(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filtered.length) {
        listRef.current?.querySelectorAll(".rc-picker-item")[0]?.focus();
        setFocusedIdx(0);
      }
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (!search.trim()) { onClose(); return; }
      if (filtered.length) commit(filtered[0]); else onClose();
    }
  };

  const onItemKey = (e, item, idx) => {
    if (e.key === "Escape")    { e.preventDefault(); onClose(); return; }
    if (e.key === "ArrowUp")   {
      e.preventDefault();
      if (idx === 0) { searchRef.current?.focus(); return; }
      setFocusedIdx(idx - 1);
      listRef.current?.querySelectorAll(".rc-picker-item")[idx - 1]?.focus();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (idx < filtered.length - 1) {
        setFocusedIdx(idx + 1);
        listRef.current?.querySelectorAll(".rc-picker-item")[idx + 1]?.focus();
      }
      return;
    }
    if (e.key === "Enter") { e.preventDefault(); commit(item); }
  };

  return (
    <div className="sm-picker-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sm-picker-box" style={{ width: 680, maxWidth: "96vw" }}>
        <div className="sm-picker-hdr">
          <span>Select Product</span>
          <button onClick={onClose}>✕</button>
        </div>
        {err && (
          <div style={{ padding: "6px 14px", fontSize: 11, color: "#dc2626" }}>
            Load error: {err}
          </div>
        )}
        <div className="sm-picker-search">
          <input
            ref={searchRef}
            type="text"
            placeholder="Search by name or code…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={onSearchKey}
          />
        </div>
        {/* Table list — matches SupplierMaster list style but with columns */}
        <div style={{ overflowY: "auto", maxHeight: 340 }} ref={listRef}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#1a2e4a", color: "#fff" }}>
                <th style={{ padding: "6px 10px", textAlign: "left",  width: 120 }}>Code</th>
                <th style={{ padding: "6px 10px", textAlign: "left" }}>Name</th>
                <th style={{ padding: "6px 10px", textAlign: "right", width: 110 }}>Landing Cost</th>
                <th style={{ padding: "6px 10px", textAlign: "right", width: 110 }}>Opening Stock</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, idx) => (
                <tr
                  key={p.Id ?? idx}
                  className={`rc-picker-item${focusedIdx === idx ? " focused" : ""}`}
                  tabIndex={0}
                  style={{
                    background:   focusedIdx === idx ? "#e0e7ff" : idx % 2 ? "#f8fafc" : "#fff",
                    cursor:       "pointer",
                    borderBottom: "1px solid #eaecf4",
                  }}
                  onClick={() => commit(p)}
                  onMouseEnter={() => setFocusedIdx(idx)}
                  onKeyDown={e => onItemKey(e, p, idx)}
                >
                  <td style={{ padding: "5px 10px" }}>{p.ProductCode || p.Productcode}</td>
                  <td style={{ padding: "5px 10px" }}>{p.ProductName}</td>
                  <td style={{ padding: "5px 10px", textAlign: "right", fontFamily: "monospace" }}>{p.LandingCost}</td>
                  <td style={{ padding: "5px 10px", textAlign: "right", fontFamily: "monospace" }}>{p.OpeningStock}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "#aaa", padding: 18 }}>
                    {err ? "Failed to load products" : "No results"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── RateChange ───────────────────────────────────────────────────────────────
export default function RateChange() {
  const navigate = useNavigate();

  // ── Shared hooks from Common.jsx (identical to SupplierMaster) ────────────
  const { confirm, ConfirmUI } = CC.useConfirm();
  const { toast,   toasts    } = CC.useToast();

  // ── Session — same pattern as SupplierMaster ──────────────────────────────
  const [sess] = useState(() => {
    try {
      const main0       = (CC.getLocal("Mainsetting") || [{}])[0] || {};
      const Comid       = CC.getStr("Comid")    || "1";
      const MComid      = CC.getStr("MComid")   || Comid;
      const IdComList   = CC.getStr("IdComList") || Comid;
      const MirrorTable = CC.getStr("MirrorTableOnline") || "0";
      const useMain     = !!main0.CommonCompany || MirrorTable === "1";
      const menudata    = (CC.getLocal("menulist") || []).filter(o => o.PageName === "Billing-POS");
      const perm        = menudata[0] || { View: 1, Add: 1, Edit: 1, Delete: 1 };
      return {
        Comid:      useMain ? MComid : Comid,
        MComid,
        IdComList,
        MirrorTable,
        perm,
      };
    } catch {
      return { Comid: "1", MComid: "1", IdComList: "1", MirrorTable: "0", perm: { View: 1, Add: 1, Edit: 1, Delete: 1 } };
    }
  });
  const { Comid, MComid, IdComList, MirrorTable, perm } = sess;

  // ── dirtyIds ref — tracks which existing rows the user has actually modified ──
  const dirtyIds = useRef(new Set());

  // ── State ─────────────────────────────────────────────────────────────────
  const [grid,        setGrid]       = useState([makeNewRow()]);
  const [loading,     setLoading]    = useState(false);
  const [selIdx,      setSelIdx]     = useState(0);
  const [pickerTarget, setPickerTarget] = useState(null); // rowIdx or null
  const [colSettings, setColSettings] = useState(() =>
    ALL_COLUMNS.map(c => ({ field: c.field, label: c.label, hidden: c.hidden ?? false, width: c.width }))
  );
  const [f12Open,     setF12Open]    = useState(false);
  const [permDenied,  setPermDenied] = useState("");

  // ── Refs ──────────────────────────────────────────────────────────────────
  const cellRefs   = useRef({});
  const submitting = useRef(false);

  // ── Visible columns ───────────────────────────────────────────────────────
  const visibleColumns = ALL_COLUMNS.filter(c => {
    const cs = colSettings.find(s => s.field === c.field);
    return cs ? !cs.hidden : !(c.hidden ?? false);
  }).map(c => {
    const cs = colSettings.find(s => s.field === c.field);
    return { ...c, width: cs?.width ?? c.width };
  });

  // Editable fields only (for moveNext tab order — skip read-only columns)
  const editableFields = visibleColumns
    .filter(c => c.type !== "ro" && c.type !== "ro-num")
    .map(c => c.field);

  // ── Focus helper ──────────────────────────────────────────────────────────
  const focusCell = useCallback((rowIdx, field) => {
    setTimeout(() => {
      const el = cellRefs.current[`${rowIdx}_${field}`];
      if (el) { el.focus(); if (el.select) el.select(); }
    }, 40);
  }, []);

  // ── Permission / session guard (mirrors jQuery document.ready) ────────────
  useEffect(() => {
    const menulist = CC.getLocal("menulist");
    if (!menulist) {
      alert("Session Close Please Login !!!");
      window.location.href = "/Login/Index";
      return;
    }
    const menudata = menulist.filter(o => o.PageName === "Billing-POS");
    if (!menudata.length || menudata[0].View === 0) {
      setPermDenied("Page Access Permission Denied !!!");
      setTimeout(() => { window.location.href = "/Home"; }, 3000);
      return;
    }
    setTimeout(() => focusCell(0, "ProductCode"), 200);
  }, [focusCell]);

  // ── F12 column settings — load from server on startup (mirrors CashierMaster) ──
  useEffect(() => {
    const loadColSettings = async () => {
      try {
        const url = `/Content/Appdata/Visible/${MComid}/RateChange.json?t=${Date.now()}`;
        const res = await fetch(url);
        if (!res.ok) return; // No file yet — use defaults

        const serverData = await res.json();
        if (!Array.isArray(serverData) || serverData.length === 0) return;

        const merged = ALL_COLUMNS.map(c => {
          const s = serverData.find(d => d.column === c.field);
          return {
            field:  c.field,
            label:  c.label,
            hidden: s ? !s.Visible : c.hidden ?? false,
            width:  s ? s.Width    : c.width,
          };
        });
        setColSettings(merged);
      } catch {
        // File doesn't exist yet — silently use defaults
      }
    };
    loadColSettings();
  }, [MComid]);

  // ── Save column settings to server (mirrors CashierMaster saveColSettings) ──
  const saveColSettings = useCallback(async (localSettings) => {
    setF12Open(false);
    setLoading(true);
    const payload = localSettings.map(s => ({
      filename: "RateChange",
      column:   s.field,
      Visible:  !s.hidden,
      Width:    s.width,
      Comid:    Number(MComid),
    }));
    try {
      const res = await fetch("/Login/VisibleColumns", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        toast("✅ Column settings saved. Reload to see changes.");
        setColSettings(localSettings);
      } else {
        toast(`❌ ${data.message || "Failed to save"}`, true);
      }
    } catch {
      toast("❌ Error saving column settings", true);
    } finally {
      setLoading(false);
    }
  }, [MComid, toast]);

  // ── updateCell — marks row dirty (mirrors SupplierMaster exactly) ─────────
  const updateCell = useCallback((idx, field, value) => {
    setGrid(prev => prev.map((r, i) => {
      if (i === idx) {
        if (r.Id) dirtyIds.current.add(r.Id);
        return { ...r, [field]: value, EditMode: 1 };
      }
      return r;
    }));
  }, []);

  // ── enableEdit — pencil icon click (mirrors SupplierMaster) ──────────────
  const enableEdit = useCallback((idx) => {
    setGrid(prev => prev.map((r, i) => {
      if (i === idx) return { ...r, EditMode: 1 };
      if (r.EditMode === 1 && r.Id && !dirtyIds.current.has(r.Id))
        return { ...r, EditMode: 0 };
      return r;
    }));
    setSelIdx(idx);
    setTimeout(() => focusCell(idx, "ProductCode"), 40);
  }, [focusCell]);

  // ── selectRow — mirrors SupplierMaster selectRow ──────────────────────────
  const selectRow = useCallback((idx) => {
    setGrid(prev => prev.map((r, i) => {
      if (i !== idx && r.EditMode === 1 && r.Id && !dirtyIds.current.has(r.Id))
        return { ...r, EditMode: 0 };
      return r;
    }));
    setSelIdx(idx);
  }, []);

  // ── addRow ────────────────────────────────────────────────────────────────
  const addRow = useCallback(() => {
    setGrid(prev => {
      const next = [...prev, makeNewRow()];
      const ni   = next.length - 1;
      setSelIdx(ni);
      focusCell(ni, "ProductCode");
      return next;
    });
  }, [focusCell]);

  // ── deleteRow — same as SupplierMaster (confirm for saved rows) ───────────
  const deleteRow = useCallback(async (idx) => {
    if (!perm.Delete) { toast("❌ Page Delete Permission Denied !!!", true); return; }
    const row = grid[idx];
    if (row.Id != null && row.Id !== 0) {
      const ok = await confirm(`Do you want to delete "${row.ProductName || row.ProductCode || ""}"?`);
      if (!ok) return;
      // RateChange has no dedicated delete endpoint — only remove from local grid
      // (jQuery RateChange also had no server-side delete; it was grid-only)
      toast("✅ Row removed");
    }
    setGrid(prev => {
      const next = prev.filter((_, i) => i !== idx);
      const ns   = Math.max(0, Math.min(idx, next.length - 1));
      setSelIdx(ns);
      focusCell(ns, "ProductCode");
      return next.length ? next : [makeNewRow()];
    });
  }, [grid, perm, focusCell, toast, confirm]);

  // ──────────────────────────────────────────────────────────────────────────
  //  fillItemByCode  — mirrors jQuery FillItemCode
  //  POST /api/ItemMasterApp/SelectItemMasterbyCodeId
  // ──────────────────────────────────────────────────────────────────────────
  const fillItemByCode = useCallback(async (code, rowIdx) => {
    if (!code || !code.trim()) {
      setPickerTarget(rowIdx);
      return;
    }
    setLoading(true);
    try {
      const res = await CC.api(CC.RateChangeItemByCode, null, {}, {
        code:     code.trim(),
        Comid:    parseInt(MComid, 10) || 0,
        CComid:   parseInt(Comid, 10)  || 0,
        Id:       0,
        Batchwise: 0,
      });

      if (res._netErr || res._http404) {
        toast(`❌ ${res.message || "API Error"}`, true);
        focusCell(rowIdx, "ProductCode");
        return;
      }

      const arr = Array.isArray(res.Data1)       ? res.Data1
                : Array.isArray(res.data?.Data1)  ? res.data.Data1
                : Array.isArray(res.data)          ? res.data
                : [];

      if (arr.length === 0) {
        toast("❌ Invalid Product Code !!!", true);
        updateCell(rowIdx, "ProductCode", "");
        focusCell(rowIdx, "ProductCode");
        return;
      }

      if (arr.length === 1) {
        fillItems(arr, rowIdx);
      } else {
        // Multiple matches → open picker
        setPickerTarget(rowIdx);
      }
    } catch (err) {
      console.error("[fillItemByCode]", err);
      toast("❌ Technical Fault. Contact Software Vendor !!!", true);
      focusCell(rowIdx, "ProductCode");
    } finally {
      setLoading(false);
    }
  }, [Comid, MComid, focusCell, toast, updateCell]);

  // ──────────────────────────────────────────────────────────────────────────
  //  fillItems  — mirrors jQuery FillItems
  //  Fills OLD rates from API; leaves NEW rate fields blank for user entry.
  //  After fill: focus moves to MRP (new).
  // ──────────────────────────────────────────────────────────────────────────
  const fillItems = useCallback((arr, rowIdx) => {
    if (!arr || arr.length === 0) {
      toast("❌ Invalid Product Code !!!", true);
      focusCell(rowIdx, "ProductCode");
      return;
    }
    const item = arr[0];
    setGrid(prev => prev.map((r, i) =>
      i === rowIdx
        ? {
            ...r,
            EditMode:         1,
            Id:               item.Id           ?? null,
            ProductCode:      item.ProductCode  || item.Productcode || "",
            ProductName:      item.ProductName  || "",
            OldMRP:           parseFloat(item.MRP          || 0).toFixed(2),
            oldpurRate:       parseFloat(item.PurchaseRate  || 0).toFixed(2),
            oldSaleRate:      parseFloat(item.SalesRate     || 0).toFixed(2),
            oldWholeSaleRate: parseFloat(item.WholeSaleRate || 0).toFixed(2),
            // NEW rates — intentionally blank; user must type
            MRP:          "",
            PurchaseRate: "",
            SalesRate:    "",
            WholeSaleRate:"",
          }
        : r
    ));
    setTimeout(() => { setSelIdx(rowIdx); focusCell(rowIdx, "MRP"); }, 30);
  }, [focusCell, toast]);

  // ── Picker select handler ─────────────────────────────────────────────────
  const onPickerSelect = useCallback(async (code) => {
    const idx = pickerTarget;
    setPickerTarget(null);
    if (idx !== null && code) await fillItemByCode(code, idx);
  }, [pickerTarget, fillItemByCode]);

  const onPickerClose = useCallback(() => {
    const idx = pickerTarget;
    setPickerTarget(null);
    if (idx != null) focusCell(idx, "ProductCode");
  }, [pickerTarget, focusCell]);

  // ── moveNext — mirrors SupplierMaster moveNext (editable fields only) ──────
  const moveNext = useCallback((rowIdx, field, currentGrid) => {
    const colIdx   = editableFields.indexOf(field);
    const rowCount = currentGrid.length;
    if (colIdx < editableFields.length - 1) {
      focusCell(rowIdx, editableFields[colIdx + 1]);
    } else if (rowIdx < rowCount - 1) {
      setSelIdx(rowIdx + 1);
      focusCell(rowIdx + 1, "ProductCode");
    } else {
      const nr = makeNewRow();
      setGrid(prev => {
        const next = [...prev, nr];
        const ni   = next.length - 1;
        setSelIdx(ni);
        focusCell(ni, "ProductCode");
        return next;
      });
    }
  }, [editableFields, focusCell]);

  // ── onCellKeyDown — mirrors SupplierMaster onCellKeyDown ──────────────────
  const onCellKeyDown = useCallback((e, rowIdx, field) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const row   = grid[rowIdx];
      const value = row?.[field];

      // ProductCode Enter → look up item
      if (field === "ProductCode") {
        const code = String(value || "").trim();
        if (!code) { setPickerTarget(rowIdx); return; }
        fillItemByCode(code, rowIdx);
        return;
      }

      // Float fields → toFixed + PurchaseRate > MRP validation
      if (field === "MRP" || field === "PurchaseRate" || field === "SalesRate" || field === "WholeSaleRate") {
        const fixed = parseFloat(vn(value)).toFixed(2);
        updateCell(rowIdx, field, fixed);

        if (field === "PurchaseRate" || field === "MRP") {
          const pur = vn(field === "PurchaseRate" ? fixed : row.PurchaseRate);
          const mrp = vn(field === "MRP"          ? fixed : row.MRP);
          if (mrp > 0 && pur > 0 && pur > mrp) {
            toast("❌ Purchase Rate is Higher than MRP", true);
            setTimeout(() => focusCell(rowIdx, "PurchaseRate"), 50);
            return;
          }
        }
      }

      // F9 / Space on ProductCode → open picker (also handled below)
      moveNext(rowIdx, field, grid);
    }

    // F9 → open picker from ProductCode cell
    if (e.key === "F9" && field === "ProductCode") {
      e.preventDefault();
      setPickerTarget(rowIdx);
    }

    // Ctrl+Del → delete row
    if (e.key === "Delete" && e.ctrlKey) { e.preventDefault(); deleteRow(rowIdx); }
  }, [grid, fillItemByCode, updateCell, moveNext, toast, focusCell, deleteRow]);

  // ── onRateBlur — mirrors RateChange original onRateBlur ───────────────────
  const onRateBlur = useCallback((idx, field) => {
    const raw = grid[idx]?.[field] ?? "";
    if (!String(raw).trim()) return;
    const v = vn(raw).toFixed(2);
    updateCell(idx, field, v);
    if (field === "PurchaseRate" || field === "MRP") {
      const row = grid[idx];
      const pur = vn(field === "PurchaseRate" ? v : row.PurchaseRate);
      const mrp = vn(field === "MRP"          ? v : row.MRP);
      if (mrp > 0 && pur > 0 && pur > mrp) {
        toast("❌ Purchase Rate is Higher than MRP", true);
        setTimeout(() => focusCell(idx, "PurchaseRate"), 50);
      }
    }
  }, [grid, updateCell, toast, focusCell]);

  // ── gridemptycheck — mirrors SupplierMaster gridemptycheck ────────────────
  const gridemptycheck = useCallback((g) => {
    let cleaned = [...g];
    // Remove trailing blank row if >1 (mirrors jQuery gridemptycheck)
    if (cleaned.length > 1 && !String(cleaned[cleaned.length - 1].ProductCode || "").trim())
      cleaned = cleaned.slice(0, -1);
    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i].EditMode === 1 && !String(cleaned[i].ProductCode || "").trim()) {
        toast("❌ Enter All Product Code in the Grid !!!", true);
        setSelIdx(i);
        focusCell(i, "ProductCode");
        return { ok: false, cleanedGrid: cleaned };
      }
    }
    return { ok: true, cleanedGrid: cleaned };
  }, [focusCell, toast]);

  const hasDuplicateCodes = (data) => {
    const codes = data.map(r => String(r.ProductCode || "").trim().toUpperCase()).filter(Boolean);
    return codes.length !== new Set(codes).size;
  };

  // ── handleSave — mirrors SupplierMaster handleSave pattern exactly ─────────
  const handleSave = useCallback(async () => {
    if (submitting.current) return;

    const { ok: emptyOk, cleanedGrid } = gridemptycheck(grid);
    if (!emptyOk) return;
    setGrid(cleanedGrid);

    let dirty = [], flag = 1;

    if (perm.Add === 0 && perm.Edit === 0) {
      toast("❌ Page Add & Update Permission Denied !!!", true); flag = 0;
    } else if (perm.Add === 1 && perm.Edit === 1) {
      dirty = cleanedGrid.filter(r => r.EditMode === 1);
      if (!dirty.length) { toast("⚠️ No Data Modified !!!", true); flag = 0; }
    } else if (perm.Add === 1 && perm.Edit === 0) {
      dirty = cleanedGrid.filter(r => r.EditMode === 1 && r.Id == null);
      if (!dirty.length) {
        const any = cleanedGrid.filter(r => r.EditMode === 1);
        toast(any.length ? "❌ Page Edit Permission Denied !!!" : "⚠️ No Data Modified !!!", true);
        flag = 0;
      }
    } else if (perm.Edit === 1 && perm.Add === 0) {
      dirty = cleanedGrid.filter(r => r.EditMode === 1 && r.Id != null);
      if (!dirty.length) {
        const any = cleanedGrid.filter(r => r.EditMode === 1);
        toast(any.length ? "❌ Page Add Permission Denied !!!" : "⚠️ No Data Modified !!!", true);
        flag = 0;
      }
    }

    if (flag === 0) { addRow(); return; }

    if (hasDuplicateCodes(cleanedGrid)) { toast("❌ Duplicate Product Codes found !!!", true); return; }
    if (!dirty.length) { toast("❌ No Update Data !!!", true); return; }

    const hasNew      = dirty.some(r => !r.Id || r.Id === 0);
    const hasExisting = dirty.some(r => r.Id && r.Id !== 0);
    let msg = "Do you want to update the Rate Change details?";
    if (hasNew && !hasExisting) msg = "Do you want to save the Rate Change details?";
    if (hasNew && hasExisting)  msg = "Do you want to save & update the Rate Change details?";

    const proceed = await confirm(msg);
    if (!proceed) { addRow(); return; }

    // Strip React-internal _uid; keep all other fields for backend
    const payload = dirty.map(({ _uid, ...rest }) => rest);

    submitting.current = true;
    setLoading(true);

    try {
      const res = await CC.api(
        CC.RateChangeUpdate,
        payload,
        {
          Comid:       String(Comid),
          MirrorTable: String(MirrorTable),
          IdComList:   String(IdComList),
        }
      );

      if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

      if (res.ok || res.IsSuccess) {
        toast("✅ " + (res.message || "Rate Change Updated Successfully."));
        dirtyIds.current.clear();
        // Reset grid — mirrors jQuery methods.loadRateChangeDetails()
        setGrid([makeNewRow()]);
        setSelIdx(0);
        setTimeout(() => focusCell(0, "ProductCode"), 80);
      } else {
        console.error("[RateChange] Save failed:", res);
        toast(`❌ ${res.message || "Update failed. See console for details."}`, true);
      }
    } catch (err) {
      console.error("[RateChange] Exception:", err);
      toast("❌ Technical Fault. Contact Software Vendor !!!", true);
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  }, [grid, Comid, MirrorTable, IdComList, perm, gridemptycheck, addRow, focusCell, toast, confirm]);

  // ── handleEsc — mirrors SupplierMaster handleEsc ──────────────────────────
  const handleEsc = useCallback(async () => {
    const ok = await confirm("Do You Want To Quit Page?");
    if (ok) navigate("/Home");
  }, [confirm, navigate]);

  // ── Global keyboard shortcuts (mirrors SupplierMaster pattern) ────────────
  useEffect(() => {
    const onKey = e => {
      if (pickerTarget != null || f12Open) return;
      if (e.keyCode === 112) { e.preventDefault(); handleSave(); }   // F1
      if (e.keyCode === 113) { e.preventDefault(); addRow(); }        // F2
      if (e.keyCode === 123) { e.preventDefault(); setF12Open(true); }// F12
      if (e.keyCode === 27)  { e.preventDefault(); handleEsc(); }     // Esc
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, addRow, handleEsc, f12Open, pickerTarget]);

  // ── Cell renderer — mirrors SupplierMaster renderCell pattern ─────────────
  function renderCell(row, rowIdx, colDef) {
    const { field, type, maxLen } = colDef;
    const value    = row[field] ?? "";
    const refKey   = `${rowIdx}_${field}`;
    const editMode = row.EditMode ?? 0;

    // Read-only text column (ProductName)
    if (type === "ro") return (
      <input
        className="mp-cell-input"
        readOnly
        tabIndex={-1}
        value={String(value)}
        style={{ background: "#f5f7fb", color: "#6b7a99", cursor: "default" }}
      />
    );

    // Read-only numeric column (old rates)
    if (type === "ro-num") return (
      <input
        className="mp-cell-input"
        readOnly
        tabIndex={-1}
        value={String(value)}
        style={{
          background: "#f5f7fb", color: "#6b7a99",
          cursor: "default", textAlign: "right", fontFamily: "monospace",
        }}
      />
    );

    // Shared cell style matching SupplierMaster editMode pattern
    const cellStyle = {
      background:   editMode === 0 ? "transparent" : "#fff",
      border:       editMode === 0 ? "none"        : "1px solid #93c5fd",
      cursor:       editMode === 0 ? "default"     : "text",
      color:        editMode === 0 ? "inherit"     : "#1e293b",
      boxShadow:    editMode === 0 ? "none"        : "0 0 0 2px rgba(59,130,246,0.15)",
      borderRadius: editMode === 1 ? "4px"         : "0",
      padding:      editMode === 0 ? "2px 4px"     : undefined,
    };

    const common = {
      ref:     el => { if (el) cellRefs.current[refKey] = el; else delete cellRefs.current[refKey]; },
      onFocus: () => setSelIdx(rowIdx),
      onKeyDown: e => editMode === 1 && onCellKeyDown(e, rowIdx, field),
    };

    // Float / numeric editable
    if (type === "float") return (
      <input
        {...common}
        className="mp-cell-input"
        type="text"
        maxLength={maxLen || 18}
        value={String(value)}
        readOnly={editMode === 0}
        style={{ ...cellStyle, textAlign: "right", fontFamily: "monospace" }}
        placeholder={editMode === 1 ? "0.00" : ""}
        onChange={e => editMode === 1 && updateCell(rowIdx, field, e.target.value)}
        onBlur={() => editMode === 1 && onRateBlur(rowIdx, field)}
      />
    );

    // ProductCode — string, uppercase, F9/Space opens picker
    return (
      <input
        {...common}
        className="mp-cell-input"
        type="text"
        maxLength={maxLen || 100}
        value={String(value)}
        readOnly={editMode === 0}
        placeholder={editMode === 1 ? "Code / F9" : ""}
        autoComplete="off"
        style={cellStyle}
        onChange={e => editMode === 1 && CC.applyUppercase(e, val => updateCell(rowIdx, field, val))}
        onKeyDown={e => {
          if (editMode === 0) return;
          // Space on empty ProductCode → open picker
          if (e.key === " " && !String(value).trim()) { e.preventDefault(); setPickerTarget(rowIdx); return; }
          onCellKeyDown(e, rowIdx, field);
        }}
      />
    );
  }

  // ── F12 Popup — identical to SupplierMaster F12Popup ─────────────────────
  function F12Popup() {
    const [local, setLocal] = useState(colSettings.map(s => ({ ...s })));
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(10,20,40,.5)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: 8, width: 450, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 16px 48px rgba(0,0,0,.3)", overflow: "hidden" }}>
          <div style={{ background: "#1a2e4a", color: "#fff", padding: "10px 16px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>⚙ Column Settings (F12)</span>
            <button style={{ background: "none", border: "none", color: "#fff", fontSize: 17, cursor: "pointer" }} onClick={() => setF12Open(false)}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>{["Column", "Visible", "Width (px)"].map(h =>
                  <th key={h} style={{ background: "#1a2e4a", color: "#fff", padding: "6px 10px", fontSize: 11, fontWeight: 600, textAlign: "left" }}>{h}</th>
                )}</tr>
              </thead>
              <tbody>
                {local.map(s => (
                  <tr key={s.field}>
                    <td style={{ padding: "5px 10px", fontSize: 12, borderBottom: "1px solid #eaecf4" }}>{s.label}</td>
                    <td style={{ padding: "5px 10px", textAlign: "center", borderBottom: "1px solid #eaecf4" }}>
                      <input type="checkbox" checked={!s.hidden}
                        onChange={() => setLocal(p => p.map(x => x.field === s.field ? { ...x, hidden: !x.hidden } : x))} />
                    </td>
                    <td style={{ padding: "5px 10px", borderBottom: "1px solid #eaecf4" }}>
                      <input type="number" min="40" max="500" value={s.width}
                        style={{ width: 70, border: "1px solid #d4dbe8", borderRadius: 3, padding: "2px 6px", fontSize: 12, textAlign: "right" }}
                        onChange={e => setLocal(p => p.map(x => x.field === s.field ? { ...x, width: parseInt(e.target.value) || x.width } : x))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "10px 14px", display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid #e5e7eb" }}>
            <button onClick={() => saveColSettings(local)}
              style={{ background: "#1a2e4a", color: "#fff", border: "none", borderRadius: 4, padding: "6px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              💾 Save
            </button>
            <button onClick={() => setF12Open(false)}
              style={{ background: "#fff", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 4, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Permission denied screen ───────────────────────────────────────────────
  if (permDenied) {
    return (
      <div className="mp-wrap" style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ margin: "auto", fontSize: 14, color: "#991b1b", background: "#fee2e2", padding: "12px 24px", borderRadius: 6 }}>
          {permDenied}
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mp-wrap supplier-page">
      {ConfirmUI}
      <Topbar />

      {/* Loader overlay */}
      {loading && (
        <div className="mp-loader-ov">
          <div className="mp-ldr-box">
            <div className="mp-spin" />
            <div className="mp-ldr-msg">Processing…</div>
          </div>
        </div>
      )}

      {/* F12 Column settings */}
      {f12Open && <F12Popup />}

      {/* Product picker modal */}
      {pickerTarget != null && (
        <ProductPickerModal
          Comid={Comid}
          onSelect={onPickerSelect}
          onClose={onPickerClose}
        />
      )}

      <div className="mp-body">

        {/* ── Toolbar — mirrors SupplierMaster toolbar ── */}
        <div className="mp-toolbar">
          <button className="mp-btn sv" onClick={handleSave} disabled={loading || submitting.current}>
            💾 F1 Save
          </button>
          <button className="mp-btn nw" onClick={addRow} disabled={loading}>
            ➕ F2 Add Row
          </button>
          <button className="mp-btn dl" onClick={handleEsc}>
            ✕ Esc
          </button>
          <div className="mp-toolbar-title">Rate Change</div>
          <button
            className="mp-btn"
            style={{ background: "#fff", color: "#374151", border: "1px solid #9ca3af", marginLeft: "auto" }}
            onClick={() => setF12Open(true)}
          >
            ⚙ F12 Columns
          </button>
        </div>

        {/* ── Grid — mirrors SupplierMaster grid pattern exactly ── */}
        <div className="mp-grid-wrap" style={{ overflowX: "auto", width: "100%" }}>
          <table
            className="mp-tbl"
            style={{
              width: "100%",
              tableLayout: "fixed",
              minWidth: visibleColumns.reduce((a, c) => a + c.width, 150) + "px",
            }}
          >
            <thead>
              <tr>
                <th style={{ width: 45 }}>S.No</th>
                <th style={{ width: 44 }}></th>{/* edit icon column */}
                {visibleColumns.map(c => (
                  <th
                    key={c.field}
                    style={{
                      width: c.width,
                      minWidth: c.width,
                      textAlign: (c.type === "float" || c.type === "ro-num") ? "right" : undefined,
                    }}
                  >
                    {c.label}
                  </th>
                ))}
                <th style={{ width: 44 }}></th>{/* delete button */}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, rowIdx) => {
                const editMode = row.EditMode ?? 0;
                return (
                  <tr
                    key={row._uid}
                    className={[
                      selIdx === rowIdx ? "sel" : "",
                      editMode === 1    ? "mod" : "",
                    ].filter(Boolean).join(" ")}
                    onClick={() => selectRow(rowIdx)}
                  >
                    <td className="sno">{rowIdx + 1}</td>

                    {/* ── Edit icon cell — mirrors SupplierMaster ── */}
                    <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                      {row.Id && editMode === 0 && (
                        <button
                          className="mp-edit-btn"
                          title="Edit row"
                          onClick={e => { e.stopPropagation(); enableEdit(rowIdx); }}
                        >
                          ✏️
                        </button>
                      )}
                      {row.Id && editMode === 1 && (
                        <button
                          className="mp-edit-btn active"
                          title="Editing…"
                          style={{ color: "#16a34a", cursor: "default" }}
                        >
                          ✏️
                        </button>
                      )}
                    </td>

                    {visibleColumns.map(colDef => (
                      <td
                        key={colDef.field}
                        style={{
                          padding: "2px 4px",
                          textAlign: (colDef.type === "float" || colDef.type === "ro-num") ? "right" : undefined,
                        }}
                        onClick={e => {
                          e.stopPropagation();
                          selectRow(rowIdx);
                          if (editMode === 1) {
                            setTimeout(() => {
                              const el = cellRefs.current[`${rowIdx}_${colDef.field}`];
                              if (el) { el.focus(); el.select?.(); }
                            }, 20);
                          }
                        }}
                      >
                        {renderCell(row, rowIdx, colDef)}
                      </td>
                    ))}

                    <td style={{ textAlign: "center", padding: "2px 4px" }}>
                      <button
                        className="mp-del-btn"
                        onClick={e => { e.stopPropagation(); deleteRow(rowIdx); }}
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {grid.length === 0 && !loading && (
            <div className="mp-empty">No records. Press ➕ to add a row.</div>
          )}
        </div>

        {/* ── Hint bar ── */}
        <div className="mp-hint">
          <kbd>Enter</kbd> next cell &nbsp;|&nbsp;
          <kbd>F9</kbd> / <kbd>Space</kbd> browse products &nbsp;|&nbsp;
          <kbd>Ctrl+Del</kbd> delete &nbsp;|&nbsp;
          <kbd>F1</kbd> save &nbsp;|&nbsp;
          <kbd>F2</kbd> add row &nbsp;|&nbsp;
          <kbd>F12</kbd> columns &nbsp;|&nbsp;
          <kbd>Esc</kbd> quit
        </div>
      </div>

      <CC.ToastList toasts={toasts} />
    </div>
  );
}