// ─────────────────────────────────────────────────────────────────────────────
//  SubCategory.jsx
//
//  Imports:
//   • CC.*  from Common.jsx   — API helpers, session, uid, applyUppercase, etc.
//   • MSG.* from Messages.jsx — useConfirm, useToast, ToastList
//
//  Features:
//   • Permission guard via useEffect + isAuthorized state (View=0 → redirect)
//   • EditMode per row (0 = view / 1 = edit)
//   • Edit ✏️ button — shows only on saved rows; click → enableEdit()
//   • dirtyIds ref — tracks rows actually typed in
//   • selectRow() — exits edit mode on other rows if not dirty
//   • Toggle component for Active column
//   • Department lookup popup (Enter/click on DepartmentName)
//   • Category combo for filtering sub-categories
//   • View, Add, Edit, Delete permission denied logic
//   • Dual-login guard — any 406 / res.redis===false → navigate("/Login/Index")
//
//  VISUAL REDESIGN NOTE:
//  Only the presentational layer (JSX structure, className usage, and the
//  purely-cosmetic inline color values on the Active toggle) was changed to
//  match the "bm-*" card/form design system used in BrandMaster.jsx (blue
//  card border + gradient header, rounded card, bm-btn style pill buttons,
//  bm-cell-input focus glow, lucide-react action icons, etc.). The "bm-*"
//  classes referenced below already live in MasterPage.css (reusable across
//  every screen — see BrandMaster.jsx). The Department lookup popup
//  (grp-overlay / grp-window / grp-list-item, etc.) is untouched — it isn't
//  part of BrandMaster's design system and is left exactly as-is.
//  All state, effects, handlers, API calls, validation, variable names and
//  control flow are 100% unchanged from the original SubCategory.jsx.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Save, Plus, XCircle, Pencil, Trash2 } from "lucide-react";
import "./MasterPage.css";

import Topbar from "../components/Topbar";
import * as CC  from "../components/Common";
import * as MSG from "../components/Messages";

// ─── Toggle component (Active column) ────────────────────────────────────────
//  NOTE: only the two hex color values below were changed (#16a34a -> #1e7e34,
//  #15803d -> #166534) to line up with BrandMaster's "save" green accent.
//  Behavior, props and logic are untouched.
function Toggle({ value, onChange, onKeyDown, inputRef, editMode, onFocus }) {
  return (
    <button
      ref={inputRef}
      onClick={() => editMode === 1 && onChange(!value)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      title={value ? "Active" : "Inactive"}
      style={{
        width: 32, height: 18, borderRadius: 9, border: "none",
        cursor:     editMode === 0 ? "default" : "pointer",
        background: value ? "#1e7e34" : "#cbd5e1",
        position: "relative", transition: "background 0.18s ease",
        outline: "none", display: "inline-flex", alignItems: "center",
        flexShrink: 0, padding: 0,
        boxShadow: value
          ? "inset 0 0 0 1px #166534"
          : "inset 0 0 0 1px #b0bec5",
        opacity:       editMode === 0 ? 0.5 : 1,
        pointerEvents: editMode === 0 ? "none" : "auto",
      }}
    >
      <span style={{
        position: "absolute", top: 3,
        left:     value ? 15 : 3,
        width: 12, height: 12, borderRadius: "50%",
        background: "#fff",
        transition: "left 0.18s ease",
        boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
        display: "block",
      }} />
    </button>
  );
}

// ─── Column config ────────────────────────────────────────────────────────────
const ALL_COLUMNS = [
  { field: "DepartmentName", label: "Department Name", width: 250 },
  { field: "Cat_GST",        label: "GST (%)",         width: 120 },
  { field: "Active",         label: "Active",          width: 80  },
];

// ─── SubCategoryMaster ────────────────────────────────────────────────────────
export default function SubCategoryMaster() {
  const navigate  = useNavigate();
  const inputRefs = useRef([]);
  const dirtyIds  = useRef(new Set());

  // ── MSG hooks ──────────────────────────────────────────────────────────────
  const { confirm, ConfirmUI } = MSG.useConfirm();
  const { toast,   toasts    } = MSG.useToast();

  // ── Permission / authorization state ──────────────────────────────────────
  const [perm,         setPerm        ] = useState({ View: 0, Add: 0, Edit: 0, Delete: 0 });
  const [isAuthorized, setIsAuthorized] = useState(false);

  // ── Dual-login guard helper ────────────────────────────────────────────────
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
    const menudata = menulist.filter(obj => obj.PageName === "Category");

    if (!menudata || menudata.length === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => { navigate("/Home"); }, 3000);
      return;
    }

    if (menudata[0].View === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => { navigate("/Home"); }, 3000);
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

  // ── Session ────────────────────────────────────────────────────────────────
  const [sess] = useState(() => {
    try {
      return CC.buildSession("Category");
    } catch {
      return { Comid: "1", MComid: "1", IdComList: "1", MirrorTable: "0", menudata: [] };
    }
  });

  // ── Category combo state ───────────────────────────────────────────────────
  const [categoryList,  setCategoryList ] = useState([]);
  const [selectedCatId, setSelectedCatId] = useState(0);

  // ── Component state ───────────────────────────────────────────────────────
  const [grid,    setGrid   ] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selIdx,  setSelIdx ] = useState(null);

  // ── Department popup state ─────────────────────────────────────────────────
  const [deptOpen,   setDeptOpen  ] = useState(false);
  const [deptRows,   setDeptRows  ] = useState([]);
  const [deptSearch, setDeptSearch] = useState("");
  const [deptSelIdx, setDeptSelIdx] = useState(null);
  const deptTarget    = useRef(null);
  const deptSearchRef = useRef(null);

  // ── focusRow ───────────────────────────────────────────────────────────────
  const focusRow = useCallback((idx, colIdx = 0) => {
    setTimeout(() => inputRefs.current[idx]?.[colIdx]?.focus(), 50);
  }, []);

  // ── selectRow ─────────────────────────────────────────────────────────────
  const selectRow = useCallback((newIdx) => {
    setGrid(prev => prev.map((r, i) => {
      if (i !== newIdx && r.EditMode === 1 && r.Id && !dirtyIds.current.has(r.Id)) {
        return { ...r, EditMode: 0 };
      }
      return r;
    }));
    setSelIdx(newIdx);
  }, []);

  // ── makeNewRow ─────────────────────────────────────────────────────────────
  const makeNewRow = (prefill = "") => ({
    Id:             null,
    DepartmentName: prefill,
    DepartmentId:   null,
    Cat_GST:        "0.00",
    Active:         true,
    EditMode:       1,
    _uid:           CC.uid(),
  });

  // ── rowValidator ──────────────────────────────────────────────────────────
  const rowValidator = useCallback((row) =>
    String(row.DepartmentName || "").trim().length > 0
  , []);

  // ── loadCategoryCombo ─────────────────────────────────────────────────────
  const loadCategoryCombo = useCallback(async () => {
    const res = await CC.api(
      "/api/CategoryApp/SelectCategory",
      null,
      {},
      { Comid: sess.Comid }
    );
    if (redirectIfDualLogin(res)) return;
    if (res.ok && Array.isArray(res.data) && res.data.length) {
      setCategoryList(res.data.map(c => ({ ...c, _uid: CC.uid() })));
    } else {
      setCategoryList([]);
    }
  }, [sess.Comid, redirectIfDualLogin]);

  // ── loadData ───────────────────────────────────────────────────────────────
  const loadData = useCallback((cid = selectedCatId) => { // eslint-disable-line
    const prefill = sessionStorage.getItem("masterPrefill") || "";
    const blank   = makeNewRow(prefill);
    setGrid([blank]);
    setSelIdx(0);
    focusRow(0);
    sessionStorage.removeItem("masterPrefill");
  }, [focusRow]); // eslint-disable-line

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthorized) return;
    loadCategoryCombo();
    loadData(0);
  }, [isAuthorized]); // eslint-disable-line

  // ── addRow ─────────────────────────────────────────────────────────────────
  const addRow = useCallback(() => {
    setGrid(prev => {
      const next = [...prev, makeNewRow()];
      const idx  = next.length - 1;
      setSelIdx(idx);
      focusRow(idx);
      return next;
    });
  }, [focusRow]); // eslint-disable-line

  // ── updateCell ─────────────────────────────────────────────────────────────
  const updateCell = useCallback((idx, field, value) => {
    setGrid(prev =>
      prev.map((r, i) => {
        if (i === idx) {
          if (r.Id) dirtyIds.current.add(r.Id);
          return { ...r, [field]: value, EditMode: 1 };
        }
        return r;
      })
    );
  }, []);

  // ── enableEdit ─────────────────────────────────────────────────────────────
  const enableEdit = useCallback((idx) => {
    setGrid(prev =>
      prev.map((r, i) => i === idx ? { ...r, EditMode: 1 } : r)
    );
    selectRow(idx);
    focusRow(idx, 0);
  }, [focusRow, selectRow]);

  // ── deleteRow ──────────────────────────────────────────────────────────────
  const deleteRow = useCallback(async (idx) => {
    if (!perm.Delete) { toast("❌ Page Delete Permission Denied !!!", true); return; }

    const row     = grid[idx];
    const isSaved = row.Id != null && row.Id !== 0;

    if (isSaved) {
      const ok = await confirm(`Do you want to delete "${row.DepartmentName}"?`);
      if (!ok) return;

      setLoading(true);
      const res = await CC.api(
        CC.SubCategoryDelete,
        null,
        { "IdComList": String(sess.IdComList) },
        { Id: Number(row.Id), Comid: Number(sess.Comid) }
      );
      setLoading(false);

      if (redirectIfDualLogin(res)) return;

      if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

      if (res.ok) {
        toast("✅ " + (res.message || "Deleted"));
        setGrid(prev => {
          const next = prev.filter((_, i) => i !== idx);
          const sel  = Math.max(0, next.length - 1);
          setSelIdx(sel);
          focusRow(sel);
          return next;
        });
      } else {
        toast(`❌ ${res.message || "Delete failed"}`, true);
      }
    } else {
      setGrid(prev => {
        const next = prev.filter((_, i) => i !== idx);
        const sel  = Math.max(0, next.length - 1);
        setSelIdx(sel);
        focusRow(sel);
        return next;
      });
    }
  }, [grid, sess, perm, focusRow, toast, confirm, redirectIfDualLogin]);

  // ── gridemptycheck ─────────────────────────────────────────────────────────
  const gridemptycheck = useCallback((g) => {
    let cleaned = [...g];

    if (cleaned.length > 1) {
      const last = cleaned[cleaned.length - 1];
      if (!String(last.DepartmentName || "").trim()) {
        cleaned = cleaned.slice(0, -1);
      }
    }

    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i].EditMode === 1) {
        if (!String(cleaned[i].DepartmentName || "").trim()) {
          toast("❌ Enter All Department Name in the Grid !!!", true);
          setSelIdx(i);
          focusRow(i, 0);
          return { ok: false, cleaned };
        }
      }
    }
    return { ok: true, cleaned };
  }, [focusRow, toast]);

  // ── hasDuplicate ───────────────────────────────────────────────────────────
  const hasDuplicate = useCallback((g, field) => {
    const vals = g
      .filter(r => String(r[field] || "").trim())
      .map(r => String(r[field]).trim().toLowerCase());
    return new Set(vals).size !== vals.length;
  }, []);

  // ── handleSave ─────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (selectedCatId === 0) {
      toast("❌ Select Category !!!", true);
      return;
    }

    const { ok, cleaned } = gridemptycheck(grid);
    if (!ok) return;
    setGrid(cleaned);

    let dirty = [];
    let flag  = 1;

    if (perm.Add === 0 && perm.Edit === 0) {
      toast("❌ Page Add & Update Permission Denied !!!", true);
      flag = 0;

    } else if (perm.Add === 1 && perm.Edit === 1) {
      dirty = cleaned.filter(r => r.EditMode === 1);
      if (!dirty.length) { toast("⚠️ No Data Modified, Cannot Update !!!", true); flag = 0; }

    } else if (perm.Add === 1 && perm.Edit === 0) {
      dirty = cleaned.filter(r => r.EditMode === 1 && r.Id == null);
      if (!dirty.length) {
        const any = cleaned.filter(r => r.EditMode === 1);
        toast(any.length ? "❌ Page Edit Permission Denied !!!" : "⚠️ No Data Modified, Cannot Update !!!", true);
        flag = 0;
      }

    } else if (perm.Edit === 1 && perm.Add === 0) {
      dirty = cleaned.filter(r => r.EditMode === 1 && r.Id != null);
      if (!dirty.length) {
        const any = cleaned.filter(r => r.EditMode === 1);
        toast(any.length ? "❌ Page Add Permission Denied !!!" : "⚠️ No Data Modified, Cannot Update !!!", true);
        flag = 0;
      }
    }

    if (flag === 0) { addRow(); return; }

    if (hasDuplicate(cleaned, "DepartmentName")) {
      toast("❌ Duplicate Department Name found !!!", true); return;
    }

    const hasNew      = dirty.some(r => r.Id == null || r.Id === 0);
    const hasExisting = dirty.some(r => r.Id != null && r.Id !== 0);
    let confirmMsg    = "Do you want to save the SubCategory details?";
    if (hasExisting && !hasNew) confirmMsg = "Do you want to update the SubCategory details?";
    if (hasExisting &&  hasNew) confirmMsg = "Do you want to save & update the SubCategory details?";

    const proceed = await confirm(confirmMsg);
    if (!proceed) { addRow(); return; }

    setLoading(true);

    const payload = dirty.map(r => ({
      Id:             Number(r.Id || 0),
      DepartmentName: String(r.DepartmentName || "").trim(),
      DepartmentId:   r.DepartmentId != null ? Number(r.DepartmentId) : null,
      Cat_GST:        Number(r.Cat_GST || 0),
      Active:         r.Active === true ? 1 : 0,
      EditMode:       r.EditMode,
    }));

    const res = await CC.insertapi(
      CC.SubCategoryInsert,
      payload,
      {
        Comid:       String(parseInt(sess.Comid)),
        cid:         String(selectedCatId),
        MirrorTable: String(sess.MirrorTable),
        IdComList:   String(sess.IdComList),
        ApiType:     "1",
      }
    );

    setLoading(false);

    if (redirectIfDualLogin(res)) return;

    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

    if (res.IsSuccess || res.ok) {
      dirtyIds.current.clear();
      toast("✅ " + (res.message || "Saved successfully!"));

      const retField = sessionStorage.getItem("masterReturnField");
      if (retField) {
        sessionStorage.setItem("masterReturnValue", String(res.Data2 ?? res.Id ?? ""));
        sessionStorage.setItem("masterReturnName",  dirty[0]?.DepartmentName || "");
        sessionStorage.removeItem("masterReturnField");
        setTimeout(() => navigate(-1), 800);
      } else {
        loadData(selectedCatId);
      }
    } else {
      toast(`❌ ${res.message || "Save failed"}`, true);
    }
  }, [grid, sess, perm, selectedCatId, navigate, loadData, gridemptycheck, hasDuplicate, addRow, toast, confirm, redirectIfDualLogin]);

  // ── handleEsc ──────────────────────────────────────────────────────────────
  const handleEsc = useCallback(() => {
    sessionStorage.removeItem("masterReturnField");
    sessionStorage.removeItem("masterPrefill");
    navigate(-1);
  }, [navigate]);

  // ── Global keyboard shortcuts ──────────────────────────────────────────────
  useEffect(() => {
    const onKey = e => {
      if (deptOpen) {
        if (e.keyCode === 27) { e.preventDefault(); setDeptOpen(false); }
        return;
      }
      if (e.keyCode === 112) { e.preventDefault(); handleSave(); }
      if (e.keyCode === 27)  { e.preventDefault(); handleEsc();  }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleEsc, deptOpen]);

  // ── Department popup ───────────────────────────────────────────────────────
  const loadDepartmentData = useCallback(async () => {
    setLoading(true);
    const res = await CC.api(
      CC.SelectDepartment,
      null,
      {},
      { Comid: Number(sess.Comid) }
    );
    setLoading(false);

    if (redirectIfDualLogin(res)) return;

    if (res.ok && Array.isArray(res.data) && res.data.length) {
      setDeptRows(res.data.map(d => ({ ...d, _uid: CC.uid() })));
    } else {
      setDeptRows([]);
    }
  }, [sess.Comid, redirectIfDualLogin]);

  const openDeptPopup = useCallback(async (idx) => {
    deptTarget.current = idx;
    const currentName = grid[idx]?.DepartmentName ?? "";
    setDeptSearch(currentName);
    setDeptSelIdx(null);
    await loadDepartmentData();
    setDeptOpen(true);
    setTimeout(() => deptSearchRef.current?.focus(), 200);
  }, [grid, loadDepartmentData]);

  const filteredDeptRows = deptRows.filter(d =>
    d.DepartmentName.toLowerCase().includes(deptSearch.toLowerCase())
  );

  const selectDeptItem = useCallback((deptRow) => {
    const idx = deptTarget.current;
    setGrid(prev =>
      prev.map((r, i) =>
        i === idx
          ? { ...r, DepartmentName: deptRow.DepartmentName, DepartmentId: deptRow.Id, EditMode: 1 }
          : r
      )
    );
    if (grid[idx]?.Id) dirtyIds.current.add(grid[idx].Id);
    setDeptOpen(false);
    setDeptSearch("");
    // Move to GST column (col index 1) after department selection
    setTimeout(() => focusRow(idx, 1), 80);
  }, [grid, focusRow]);

  const handleDeptSearchKeyDown = useCallback((e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filteredDeptRows.length > 0) {
        setDeptSelIdx(0);
        setTimeout(() => { document.querySelectorAll(".grp-list-item")[0]?.focus(); }, 30);
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const target = deptSelIdx != null ? filteredDeptRows[deptSelIdx] : filteredDeptRows[0];
      if (target) selectDeptItem(target);
    }
    if (e.key === "Escape") setDeptOpen(false);
  }, [filteredDeptRows, deptSelIdx, selectDeptItem]);

  const handleDeptListKeyDown = useCallback((e, deptRow, listIdx) => {
    if (e.key === "Enter") { e.preventDefault(); selectDeptItem(deptRow); }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (listIdx < filteredDeptRows.length - 1) {
        setDeptSelIdx(listIdx + 1);
        document.querySelectorAll(".grp-list-item")[listIdx + 1]?.focus();
      }
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (listIdx > 0) {
        setDeptSelIdx(listIdx - 1);
        document.querySelectorAll(".grp-list-item")[listIdx - 1]?.focus();
      } else {
        deptSearchRef.current?.focus();
      }
    }
    if (e.key === "Escape") setDeptOpen(false);
  }, [filteredDeptRows, selectDeptItem]);

  // ── Row-level keyboard navigation ─────────────────────────────────────────
  const onCellKeyDown = useCallback((e, idx, colIdx, field) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const row = grid[idx];

      if (field === "DepartmentName") {
        openDeptPopup(idx);
        return;
      }

      if (field === "Cat_GST") {
        const gstVal = parseFloat(row?.Cat_GST || 0).toFixed(2);
        updateCell(idx, "Cat_GST", gstVal);
      }

      if (field === "Active") {
        if (idx === grid.length - 1) addRow();
        else { setSelIdx(idx + 1); focusRow(idx + 1); }
        return;
      }

      CC.handleEnterNext(
        e, inputRefs, idx, colIdx,
        ALL_COLUMNS.length, grid.length,
        addRow, grid, rowValidator
      );
    }

    if (e.key === "Delete" && e.ctrlKey) {
      e.preventDefault(); deleteRow(idx);
    }
    if (e.key === "Delete" && !e.ctrlKey && !String(grid[idx]?.DepartmentName || "").trim()) {
      e.preventDefault(); deleteRow(idx);
    }
  }, [grid, addRow, focusRow, deleteRow, updateCell, openDeptPopup, rowValidator]);

  // ── validate numeric fields ────────────────────────────────────────────────
  const validateInput = (field, value) => {
    if (field === "Cat_GST") return /^-?\d{0,15}(\.\d{0,2})?$/.test(value);
    return true;
  };

  // ── Block render until authorized ─────────────────────────────────────────
  if (!isAuthorized) return null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="bm-shell">

      {ConfirmUI}

      <Topbar />

      {/* ── Department Lookup Popup (untouched — not part of BrandMaster's design) ── */}
      {deptOpen && (
        <div className="grp-overlay" onClick={() => setDeptOpen(false)}>
          <div className="grp-window" onClick={e => e.stopPropagation()}>
            <div className="grp-win-hdr">
              <span>Select Department</span>
              <button onClick={() => setDeptOpen(false)}>✕</button>
            </div>
            <div className="grp-win-body">
              <input
                ref={deptSearchRef}
                className="grp-search"
                placeholder="Search department…"
                value={deptSearch}
                onChange={e => CC.applyUppercase(e, val => setDeptSearch(val))}
                onKeyDown={handleDeptSearchKeyDown}
              />
              <div className="grp-list">
                {filteredDeptRows.length === 0 && (
                  <div className="grp-list-item" style={{ color: "#aaa", cursor: "default" }}>
                    No departments found
                  </div>
                )}
                {filteredDeptRows.map((d, listIdx) => (
                  <div
                    key={d._uid}
                    className={`grp-list-item${deptSelIdx === listIdx ? " sel" : ""}`}
                    tabIndex={0}
                    onClick={() => selectDeptItem(d)}
                    onKeyDown={e => handleDeptListKeyDown(e, d, listIdx)}
                    onFocus={() => setDeptSelIdx(listIdx)}
                  >
                    {d.DepartmentName}
                  </div>
                ))}
              </div>
              <div className="grp-hint">
                ↑↓ Navigate &nbsp;|&nbsp; Enter Select &nbsp;|&nbsp; Esc Close
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bm-layout">
        <div className="bm-card">
          <div className="bm-card-header">
            <div className="bm-card-header-title">Sub Category Master</div>
            <button type="button" className="bm-close-x" aria-label="Close" onClick={handleEsc}>✕</button>
          </div>

          <div className="bm-card-body">
            <div className="bm-report-title">Sub Category Master</div>

        {/* ── Category Filter ── */}
        <div style={{ padding: "0 0 4px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #e8ecf0" }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Category:</label>
          <select
            style={{
              height: 30, padding: "0 8px", borderRadius: 6, border: "1px solid #cbd5e1",
              fontSize: 13, minWidth: 220, background: "#fff", color: "#1e293b",
            }}
            value={selectedCatId}
            onChange={e => {
              const cid = Number(e.target.value);
              setSelectedCatId(cid);
              loadData(cid);
            }}
          >
            <option value={0}>-- Select Category --</option>
            {categoryList.map(c => (
              <option key={c._uid} value={c.Id}>{c.CategoryName ?? c.Name ?? c.CatName ?? c.Id}</option>
            ))}
          </select>
        </div>

        {/* ── Grid ── */}
        <div className="bm-grid-wrap">
          <table className="bm-tbl">
            <thead>
              <tr>
                <th style={{ width: 50 }}>S.No</th>
                {ALL_COLUMNS.map(c => (
                  <th
                    key={c.field}
                    style={{
                      width:    c.width,
                      minWidth: c.width,
                      textAlign: (c.field === "Active" || c.field === "Cat_GST")
                        ? "center" : undefined,
                    }}
                  >
                    {c.label}
                  </th>
                ))}
                <th style={{ width: 64 }}></th>
              </tr>
            </thead>
            <tbody>
              {grid.map((row, idx) => (
                <tr
                  key={row._uid}
                  className={[
                    selIdx === idx     ? "sel"   : "",
                    !row.Active        ? "inact" : "",
                    row.EditMode === 1 ? "mod"   : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => selectRow(idx)}
                >
                  <td className="sno">{idx + 1}</td>

                  {ALL_COLUMNS.map((col, colIdx) => (
                    <td
                      key={col.field}
                      style={{
                        textAlign: (col.field === "Active" || col.field === "Cat_GST")
                          ? "center" : undefined,
                      }}
                    >
                      {/* ── Active Toggle ── */}
                      {col.field === "Active" && (
                        <Toggle
                          value={!!row.Active}
                          editMode={row.EditMode}
                          inputRef={el => {
                            if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                            inputRefs.current[idx][colIdx] = el;
                          }}
                          onChange={val => row.EditMode === 1 && updateCell(idx, col.field, val)}
                          onFocus={() => selectRow(idx)}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              onCellKeyDown(e, idx, colIdx, col.field);
                            }
                          }}
                        />
                      )}

                      {/* ── DepartmentName — read-only popup trigger ── */}
                      {/* Always readOnly (opens the picker on click/Enter instead of typing),
                          so it keeps its own inline background/border to stay visually
                          distinct in edit vs view mode — the .bm-cell-input[readonly] CSS
                          rule alone can't tell "always readOnly" apart from "view mode". */}
                      {col.field === "DepartmentName" && (
                        <input
                          ref={el => {
                            if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                            inputRefs.current[idx][colIdx] = el;
                          }}
                          className="bm-cell-input"
                          value={row.DepartmentName || ""}
                          readOnly
                          placeholder="Click / Enter to select…"
                          onFocus={() => selectRow(idx)}
                          onClick={() => row.EditMode === 1 && openDeptPopup(idx)}
                          onKeyDown={e => row.EditMode === 1 && onCellKeyDown(e, idx, colIdx, col.field)}
                          style={{
                            background:   row.EditMode === 0 ? "transparent" : "#fff",
                            border:       row.EditMode === 0 ? "none" : "1px solid #c7cdd6",
                            cursor:       row.EditMode === 0 ? "default" : "pointer",
                            color:        row.EditMode === 0 ? "#000" : "#1e2d3d",
                            boxShadow:    "none",
                            borderRadius: row.EditMode === 1 ? "4px" : "0",
                            padding:      row.EditMode === 0 ? "0" : undefined,
                          }}
                        />
                      )}

                      {/* ── Cat_GST — numeric ── */}
                      {col.field === "Cat_GST" && (
                        <input
                          ref={el => {
                            if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                            inputRefs.current[idx][colIdx] = el;
                          }}
                          className="bm-cell-input"
                          value={row.Cat_GST ?? ""}
                          readOnly={row.EditMode === 0}
                          onChange={e => {
                            if (row.EditMode !== 1) return;
                            if (!validateInput("Cat_GST", e.target.value)) return;
                            updateCell(idx, "Cat_GST", e.target.value);
                          }}
                          onKeyDown={e => row.EditMode === 1 && onCellKeyDown(e, idx, colIdx, col.field)}
                          onFocus={() => selectRow(idx)}
                          style={{ textAlign: "right" }}
                        />
                      )}
                    </td>
                  ))}

                  {/* ── Edit + Delete buttons ── */}
                  <td style={{ whiteSpace: "nowrap", textAlign: "center" }}>
                    {row.Id && row.EditMode === 0 && (
                      <button
                        className="bm-icon-btn edit"
                        title="Edit row"
                        onClick={e => { e.stopPropagation(); enableEdit(idx); }}
                      >
                        <Pencil size={15} />
                      </button>
                    )}
                    {row.Id && row.EditMode === 1 && (
                      <button
                        className="bm-icon-btn edit active"
                        title="Editing…"
                      >
                        <Pencil size={15} />
                      </button>
                    )}
                    <button
                      className="bm-icon-btn del"
                      title="Delete row"
                      onClick={e => { e.stopPropagation(); deleteRow(idx); }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {grid.length === 0 && !loading && (
            <div className="bm-empty">No records. Press ➕ Add Row to add a sub category.</div>
          )}
        </div>

            {/* ── Toolbar ── */}
            <div className="bm-actions">
              <button className="bm-btn bm-btn-primary" onClick={handleSave} disabled={loading}>
                <Save size={16} />
                {loading ? "Loading…" : "F1 Save"}
              </button>
              <button className="bm-btn" onClick={addRow} disabled={loading}>
                <Plus size={16} />
                Add Row
              </button>
              <button className="bm-btn bm-btn-secondary" onClick={handleEsc} disabled={loading}>
                <XCircle size={16} />
                Esc Cancel
              </button>
            </div>
          </div>
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

      {/* ── Toast notifications ── */}
      <MSG.ToastList toasts={toasts} />
    </div>
  );
}