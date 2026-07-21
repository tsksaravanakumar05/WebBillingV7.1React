// ─────────────────────────────────────────────────────────────────────────────
//  SalesManMaster.jsx
//
//  Imports:
//   • CC.*  from Common.jsx   — API helpers, session, uid, applyUppercase, etc.
//   • MSG.* from Messages.jsx — useConfirm, useToast, ToastList
//
//  Features mirrored from DepartmentMaster:
//   • Permission guard via useEffect + isAuthorized state (View=0 → redirect)
//   • EditMode per row (0 = view / 1 = edit)
//   • Edit ✏️ button — shows only on saved rows; click → enableEdit()
//   • dirtyIds ref — tracks rows actually typed in (avoids flipping saved rows to
//     edit mode on a mere click)
//   • selectRow() — exits edit mode on other rows if not dirty
//   • Toggle component for Active column
//   • Group Commission popup (Enter/click on CommisionGroupName)
//   • View, Add, Edit, Delete permission denied logic from DepartmentMaster
//   • Dual-login guard — any 406 / res.redis===false → navigate("/Login/Index")
//
//  VISUAL REDESIGN NOTE:
//  Only the presentational layer (JSX structure, className usage, and the two
//  cosmetic hex colors on the Active toggle / editing indicator) was changed
//  to match the "bm-*" card design system used in BrandMaster.jsx (blue
//  #1a56db card border + gradient header, rounded card, bm-btn pill buttons,
//  bm-cell-input focus glow, fixed-height scrollable grid, dark-navy table
//  header, etc.). The bm-* classes live in MasterPage.css (already imported
//  below) — no local <style> block needed here, same as BrandMaster.jsx.
//  The Group Commission popup keeps its own existing "grp-*" styling from
//  Salesman.css exactly as before — it's a self-contained overlay, unrelated
//  to the bm-* card.
//  All state, effects, handlers, API calls, validation (including the
//  numeric Commission/Password input guards), variable names and control
//  flow — including the pre-existing dead-code branch for a
//  "CommisionGroupName" column that isn't listed in ALL_COLUMNS and
//  therefore never renders — are 100% unchanged from the original
//  SalesManMaster.jsx.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Save, Plus, XCircle, Pencil, Trash2 } from "lucide-react";
import "./MasterPage.css";
import "../MasterStyle/Salesman.css";

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
  { field: "Code",               label: "Code",          width: 100 },
  { field: "SalesManName",       label: "SalesMan Name", width: 200 },
  { field: "Commission",         label: "Commission",    width: 120 },
  { field: "Password",           label: "Password",      width: 120 },
  { field: "Active",             label: "Active",        width: 80  },
];

// ─── SalesManMaster ───────────────────────────────────────────────────────────
export default function SalesManMaster() {
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
  //  Call after every api/insertapi response.
  //  Triggers on: HTTP 406 (already handled inside CC.api → ok:false, no flag)
  //  OR res.redis === false (insertapi path from original SalesManMaster).
  //  We check res._dualLogin (set by CC.api on 406) OR res.redis === false.
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
    const menudata = menulist.filter(obj => obj.PageName === "Sales Man");

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
      return CC.buildSession("Sales Man");
    } catch {
      return { Comid: "1", MComid: "1", IdComList: "1", MirrorTable: "0", menudata: [] };
    }
  });

  // ── Component state ───────────────────────────────────────────────────────
  const [grid,    setGrid   ] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selIdx,  setSelIdx ] = useState(null);

  // ── Group popup state ─────────────────────────────────────────────────────
  const [grpOpen,   setGrpOpen  ] = useState(false);
  const [grpRows,   setGrpRows  ] = useState([]);
  const [grpSearch, setGrpSearch] = useState("");
  const [grpSelIdx, setGrpSelIdx] = useState(null);
  const grpTarget    = useRef(null);
  const grpSearchRef = useRef(null);

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
    Id:                         null,
    Code:                       "",
    SalesManName:               prefill,
    Commission:                 "0.00",
    Password:                   "1",
    CommisionGroupName:         "",
    CommissionGroupMasterRefid: null,
    Active:                     true,
    EditMode:                   1,
    _uid:                       CC.uid(),
  });

  // ── rowValidator ──────────────────────────────────────────────────────────
  const rowValidator = useCallback((row) =>
    String(row.Code || "").trim().length > 0 &&
    String(row.SalesManName || "").trim().length > 0
  , []);

  // ── loadData ───────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const prefill = sessionStorage.getItem("masterPrefill") || "";
    setLoading(true);

    const res = await CC.api(
      CC.SalesManSelect,
      null,
      {},
      { Comid: sess.Comid }
    );
    setLoading(false);

    // ── dual-login check ──
    if (redirectIfDualLogin(res)) return;

    if (res._http404) { toast(`❌ 404 — ${CC.SalesManSelect} not found`, true); }
    if (res._netErr)  { toast(`❌ Network: ${res.message}`, true); }

    const rawList = Array.isArray(res.data)  ? res.data
                  : Array.isArray(res.Data1) ? res.Data1
                  : Array.isArray(res)       ? res
                  : [];

    const existing = rawList.map(r => ({
      ...r,
      Active:                     r.Active === true || r.Active === 1,
      Id:                         Number(r.Id ?? 0),
      Commission:                 parseFloat(r.Commission ?? 0).toFixed(2),
      Password:                   String(r.Password ?? "1"),
      CommisionGroupName:         r.CommisionGroupName         ?? "",
      CommissionGroupMasterRefid: r.CommissionGroupMasterRefid ?? null,
      EditMode:                   0,
      _uid:                       CC.uid(),
    }));

    const blank = makeNewRow(prefill);
    setGrid([...existing, blank]);
    setSelIdx(existing.length);
    focusRow(existing.length);
    sessionStorage.removeItem("masterPrefill");
  }, [sess.Comid, toast, focusRow, redirectIfDualLogin]); // eslint-disable-line

  useEffect(() => { loadData(); }, [loadData]);

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
      const ok = await confirm(`Do you want to delete "${row.Code}"?`);
      if (!ok) return;

      setLoading(true);
      const res = await CC.api(
        CC.SalesManDelete,
        null,
        { "IdComList": String(sess.IdComList) },
        { Id: Number(row.Id), Comid: Number(sess.Comid), MirrorTable: Number(sess.MirrorTable) }
      );
      setLoading(false);

      // ── dual-login check ──
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
      if (!String(last.Code || "").trim() && !String(last.SalesManName || "").trim()) {
        cleaned = cleaned.slice(0, -1);
      }
    }

    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i].EditMode === 1) {
        if (!String(cleaned[i].Code || "").trim()) {
          toast("❌ Enter All Code in the Grid !!!", true);
          setSelIdx(i);
          focusRow(i);
          return { ok: false, cleaned };
        }
        if (!String(cleaned[i].SalesManName || "").trim()) {
          toast("❌ Enter All Sales Man Name in the Grid !!!", true);
          setSelIdx(i);
          focusRow(i, 1);
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

    if (hasDuplicate(cleaned, "Code")) {
      toast("❌ Duplicate Code found !!!", true); return;
    }

    const hasNew      = dirty.some(r => r.Id == null || r.Id === 0);
    const hasExisting = dirty.some(r => r.Id != null && r.Id !== 0);
    let confirmMsg    = "Do you want to save the Sales Man details?";
    if (hasExisting && !hasNew) confirmMsg = "Do you want to update the Sales Man details?";
    if (hasExisting &&  hasNew) confirmMsg = "Do you want to save & update the Sales Man details?";

    const proceed = await confirm(confirmMsg);
    if (!proceed) { addRow(); return; }

    setLoading(true);

    const payload = dirty.map(r => ({
      Id:                         Number(r.Id || 0),
      Code:                       String(r.Code || "").trim(),
      SalesManName:               String(r.SalesManName || "").trim(),
      Commission:                 Number(r.Commission || 0),
      Password:                   String(r.Password || "1"),
      CommissionGroupMasterRefid: r.CommissionGroupMasterRefid != null
                                    ? Number(r.CommissionGroupMasterRefid)
                                    : null,
      CommisionGroupName:         String(r.CommisionGroupName || ""),
      Active:                     r.Active === true ? 1 : 0,
      EditMode:                   r.EditMode,
    }));

    const res = await CC.insertapi(
      CC.SalesManInsert,
      payload,
      {
        Comid:       String(parseInt(sess.Comid)),
        MirrorTable: String(sess.MirrorTable),
        IdComList:   String(sess.IdComList),
        ApiType:     "1",
      }
    );

    setLoading(false);

    // ── dual-login check (insertapi returns res.redis===false on 406) ──
    if (redirectIfDualLogin(res)) return;

    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

    if (res.IsSuccess || res.ok) {
      dirtyIds.current.clear();
      toast("✅ " + (res.message || "Saved successfully!"));

      const retField = sessionStorage.getItem("masterReturnField");
      if (retField) {
        sessionStorage.setItem("masterReturnValue", String(res.Data2 ?? res.Id ?? ""));
        sessionStorage.setItem("masterReturnName",  dirty[0]?.SalesManName || "");
        sessionStorage.removeItem("masterReturnField");
        setTimeout(() => navigate(-1), 800);
      } else {
        await loadData();
      }
    } else {
      toast(`❌ ${res.message || "Save failed"}`, true);
    }
  }, [grid, sess, perm, navigate, loadData, gridemptycheck, hasDuplicate, addRow, toast, confirm, redirectIfDualLogin]);

  // ── handleEsc ──────────────────────────────────────────────────────────────
  const handleEsc = useCallback(() => {
    sessionStorage.removeItem("masterReturnField");
    sessionStorage.removeItem("masterPrefill");
    navigate(-1);
  }, [navigate]);

  // ── Global keyboard shortcuts ──────────────────────────────────────────────
  useEffect(() => {
    const onKey = e => {
      if (grpOpen) {
        if (e.keyCode === 27) { e.preventDefault(); setGrpOpen(false); }
        return;
      }
      if (e.keyCode === 112) { e.preventDefault(); handleSave(); }
      if (e.keyCode === 27)  { e.preventDefault(); handleEsc();  }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleEsc, grpOpen]);

  // ── Group popup ────────────────────────────────────────────────────────────
  const loadGroupData = useCallback(async () => {
    setLoading(true);
    const res = await CC.api(
      "/api/Group/SelectGroup",
      null,
      {},
      { Comid: Number(sess.MComid) }
    );
    setLoading(false);

    // ── dual-login check ──
    if (redirectIfDualLogin(res)) return;

    if (res.ok && Array.isArray(res.data) && res.data.length) {
      setGrpRows(res.data.map(g => ({ ...g, _uid: CC.uid() })));
    } else {
      setGrpRows([]);
    }
  }, [sess.MComid, redirectIfDualLogin]);

  const openGroupPopup = useCallback(async (idx) => {
    grpTarget.current = idx;
    const currentName = grid[idx]?.CommisionGroupName ?? "";
    setGrpSearch(currentName);
    setGrpSelIdx(null);
    await loadGroupData();
    setGrpOpen(true);
    setTimeout(() => grpSearchRef.current?.focus(), 200);
  }, [grid, loadGroupData]);

  const filteredGrpRows = grpRows.filter(g =>
    g.GroupName.toLowerCase().includes(grpSearch.toLowerCase())
  );

  const selectGroupItem = useCallback((grpRow) => {
    const idx = grpTarget.current;
    setGrid(prev =>
      prev.map((r, i) =>
        i === idx
          ? { ...r, CommisionGroupName: grpRow.GroupName, CommissionGroupMasterRefid: grpRow.Id, EditMode: 1 }
          : r
      )
    );
    if (grid[idx]?.Id) dirtyIds.current.add(grid[idx].Id);
    setGrpOpen(false);
    setGrpSearch("");
    // Move to Active column (col index 4) after group selection
    setTimeout(() => focusRow(idx, 4), 80);
  }, [grid, focusRow]);

  const handleGrpSearchKeyDown = useCallback((e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filteredGrpRows.length > 0) {
        setGrpSelIdx(0);
        setTimeout(() => { document.querySelectorAll(".grp-list-item")[0]?.focus(); }, 30);
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const target = grpSelIdx != null ? filteredGrpRows[grpSelIdx] : filteredGrpRows[0];
      if (target) selectGroupItem(target);
    }
    if (e.key === "Escape") setGrpOpen(false);
  }, [filteredGrpRows, grpSelIdx, selectGroupItem]);

  const handleGrpListKeyDown = useCallback((e, grpRow, listIdx) => {
    if (e.key === "Enter") { e.preventDefault(); selectGroupItem(grpRow); }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (listIdx < filteredGrpRows.length - 1) {
        setGrpSelIdx(listIdx + 1);
        document.querySelectorAll(".grp-list-item")[listIdx + 1]?.focus();
      }
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (listIdx > 0) {
        setGrpSelIdx(listIdx - 1);
        document.querySelectorAll(".grp-list-item")[listIdx - 1]?.focus();
      } else {
        grpSearchRef.current?.focus();
      }
    }
    if (e.key === "Escape") setGrpOpen(false);
  }, [filteredGrpRows, selectGroupItem]);

  // ── Row-level keyboard navigation ─────────────────────────────────────────
  const onCellKeyDown = useCallback((e, idx, colIdx, field) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const row = grid[idx];

      if (field === "Code") {
        if (!String(row?.Code || "").trim()) { toast("❌ Enter Code !!!", true); return; }
        if (hasDuplicate(grid, "Code"))      { toast("❌ Duplicate Code found !!!", true); return; }
      }
      if (field === "SalesManName") {
        if (!String(row?.SalesManName || "").trim()) { toast("❌ Enter Sales Man Name !!!", true); return; }
      }
      if (field === "Commission" && (!row?.Commission || row.Commission === "")) {
        updateCell(idx, "Commission", "0.00");
      }
      if (field === "Password" && (!row?.Password || row.Password === "")) {
        updateCell(idx, "Password", "1");
      }

      if (field === "CommisionGroupName") {
        openGroupPopup(idx);
        return;
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
    if (e.key === "Delete" && !e.ctrlKey && !String(grid[idx]?.Code || "").trim()) {
      e.preventDefault(); deleteRow(idx);
    }
  }, [grid, hasDuplicate, addRow, focusRow, deleteRow, toast, updateCell, openGroupPopup, rowValidator]);

  // ── validate numeric fields ────────────────────────────────────────────────
  const validateInput = (field, value) => {
    if (field === "Commission") return /^-?\d{0,15}(\.\d{0,2})?$/.test(value);
    if (field === "Password")   return /^\d{0,18}$/.test(value);
    return true;
  };

  // ── Block render until authorized ─────────────────────────────────────────
  if (!isAuthorized) return null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="bm-shell">

      {ConfirmUI}

      <Topbar />

      {/* ── Group Commission Popup ── */}
      {grpOpen && (
        <div className="grp-overlay" onClick={() => setGrpOpen(false)}>
          <div className="grp-window" onClick={e => e.stopPropagation()}>
            <div className="grp-win-hdr">
              <span>Group Commission</span>
              <button onClick={() => setGrpOpen(false)}>✕</button>
            </div>
            <div className="grp-win-body">
              <input
                ref={grpSearchRef}
                className="grp-search"
                placeholder="Search group…"
                value={grpSearch}
                onChange={e => CC.applyUppercase(e, val => setGrpSearch(val))}
                onKeyDown={handleGrpSearchKeyDown}
              />
              <div className="grp-list">
                {filteredGrpRows.length === 0 && (
                  <div className="grp-list-item" style={{ color: "#aaa", cursor: "default" }}>
                    No groups found
                  </div>
                )}
                {filteredGrpRows.map((g, listIdx) => (
                  <div
                    key={g._uid}
                    className={`grp-list-item${grpSelIdx === listIdx ? " sel" : ""}`}
                    tabIndex={0}
                    onClick={() => selectGroupItem(g)}
                    onKeyDown={e => handleGrpListKeyDown(e, g, listIdx)}
                    onFocus={() => setGrpSelIdx(listIdx)}
                  >
                    {g.GroupName}
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
            <div className="bm-card-header-title">Sales Man Master</div>
            <button type="button" className="bm-close-x" aria-label="Close" onClick={handleEsc}>✕</button>
          </div>

          <div className="bm-card-body">
            <div className="bm-report-title">Sales Man Master</div>

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
                          textAlign: (c.field === "Active" || c.field === "Commission" || c.field === "Password")
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
                            textAlign: (col.field === "Active" || col.field === "Commission" || col.field === "Password")
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

                          {/* ── CommisionGroupName — read-only popup ── */}
                          {col.field === "CommisionGroupName" && (
                            <input
                              ref={el => {
                                if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                                inputRefs.current[idx][colIdx] = el;
                              }}
                              className="bm-cell-input"
                              value={row.CommisionGroupName || ""}
                              readOnly
                              placeholder="Click / Enter to select…"
                              onFocus={() => selectRow(idx)}
                              onClick={() => row.EditMode === 1 && openGroupPopup(idx)}
                              onKeyDown={e => row.EditMode === 1 && onCellKeyDown(e, idx, colIdx, col.field)}
                              style={{ cursor: row.EditMode === 1 ? "pointer" : "default" }}
                            />
                          )}

                          {/* ── Commission / Password — numeric ── */}
                          {(col.field === "Commission" || col.field === "Password") && (
                            <input
                              ref={el => {
                                if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                                inputRefs.current[idx][colIdx] = el;
                              }}
                              className="bm-cell-input"
                              value={row[col.field] ?? ""}
                              maxLength={col.field === "Password" ? 18 : undefined}
                              readOnly={row.EditMode === 0}
                              onChange={e => {
                                if (row.EditMode !== 1) return;
                                if (!validateInput(col.field, e.target.value)) return;
                                updateCell(idx, col.field, e.target.value);
                              }}
                              onKeyDown={e => row.EditMode === 1 && onCellKeyDown(e, idx, colIdx, col.field)}
                              onFocus={() => selectRow(idx)}
                              style={{ textAlign: "right" }}
                            />
                          )}

                          {/* ── Code / SalesManName — uppercase text ── */}
                          {(col.field === "Code" || col.field === "SalesManName") && (
                            <input
                              ref={el => {
                                if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                                inputRefs.current[idx][colIdx] = el;
                              }}
                              className="bm-cell-input"
                              value={row[col.field] || ""}
                              maxLength={50}
                              readOnly={row.EditMode === 0}
                              onChange={e =>
                                row.EditMode === 1 &&
                                CC.applyUppercase(e, val => updateCell(idx, col.field, val))
                              }
                              onKeyDown={e =>
                                row.EditMode === 1 && onCellKeyDown(e, idx, colIdx, col.field)
                              }
                              onFocus={() => selectRow(idx)}
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
                <div className="bm-empty">No records. Press ➕ Add Row to add a sales man.</div>
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