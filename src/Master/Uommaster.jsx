// ─────────────────────────────────────────────────────────────────────────────
//  UomMaster.jsx
//
//  Imports:
//   • CC.*  from Common.jsx   — API helpers, session, uid, applyUppercase, etc.
//   • MSG.* from Messages.jsx — useConfirm, useToast, ToastList
//
//  Features mirrored from SalesManMaster / DepartmentMaster:
//   • Permission guard via useEffect + isAuthorized state (View=0 → redirect)
//   • EditMode per row (0 = view / 1 = edit)
//   • Edit ✏️ button — shows only on saved rows; click → enableEdit()
//   • dirtyIds ref — tracks rows actually typed in (avoids flipping saved rows
//     to edit mode on a mere click)
//   • selectRow() — exits edit mode on other rows if not dirty
//   • Toggle component for Active column
//   • View, Add, Edit, Delete permission denied logic
//   • Dual-login guard — any 406 / res.redis===false → navigate("/")
//
//  VISUAL REDESIGN NOTE:
//  Only the presentational layer (JSX structure, className usage, and the two
//  cosmetic hex colors on the Active toggle) was changed to match the "bm-*"
//  card design system used in BrandMaster.jsx (blue #1a56db card border +
//  gradient header, rounded card, bm-btn pill buttons, bm-cell-input focus
//  glow, fixed-height scrollable grid, dark-navy table header, etc.). The
//  bm-* classes live in MasterPage.css (already imported below) — no local
//  <style> block needed here, same as BrandMaster.jsx.
//  All state, effects, handlers, API calls, validation (including the
//  DecimalValue 0/2/3-only guard), variable names and control flow are 100%
//  unchanged from the original UomMaster.jsx.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Save, Plus, XCircle, Pencil, Trash2 } from "lucide-react";
import "./MasterPage.css";

import Topbar from "../components/Topbar";
import * as CC  from "../components/Common";
import * as CCC  from "../components/Common";
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
  { field: "UOMName",      label: "UOM Name",      width: 220 },
  { field: "DecimalValue", label: "Decimal Value", width: 140 },
  { field: "Active",       label: "Active",        width: 100 },
];

// ─── UomMaster ────────────────────────────────────────────────────────────────
export default function UomMaster() {
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
  //  Triggers on: HTTP 406 (CC.api → ok:false, _dualLogin:true)
  //  OR res.redis === false (insertapi path).
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
    const menudata = menulist.filter(obj => obj.PageName === "UOM Master");

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
      return CC.buildSession("UOM Master");
    } catch {
      return { Comid: "1", MComid: "1", IdComList: "1", MirrorTable: "0", menudata: [] };
    }
  });

  // ── Component state ────────────────────────────────────────────────────────
  const [grid,    setGrid   ] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selIdx,  setSelIdx ] = useState(null);

  // ── focusRow ───────────────────────────────────────────────────────────────
  const focusRow = useCallback((idx, colIdx = 0) => {
    setTimeout(() => inputRefs.current[idx]?.[colIdx]?.focus(), 50);
  }, []);

  // ── selectRow ─────────────────────────────────────────────────────────────
  //  When clicking a different row, exit edit mode on any previously-edited
  //  saved row that the user never actually typed in (not dirty).
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
    Id:           null,
    UOMName:      prefill,
    DecimalValue: 0,
    Active:       true,
    EditMode:     1,
    _uid:         CC.uid(),
  });

  // ── rowValidator ──────────────────────────────────────────────────────────
  const rowValidator = useCallback((row) =>
    String(row.UOMName || "").trim().length > 0
  , []);

  // ── loadData ───────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const prefill = sessionStorage.getItem("masterPrefill") || "";
    setLoading(true);

    const res = await CC.api(
      "/api/UOMApp/SelectUOM",
      null,
      {},
      { Comid: sess.Comid }
    );
    setLoading(false);

    // ── dual-login check ──
    if (redirectIfDualLogin(res)) return;

    if (res._http404) { toast(`❌ 404 — ${CC.SelectUOM} not found`, true); }
    if (res._netErr)  { toast(`❌ Network: ${res.message}`, true); }

    const rawList = Array.isArray(res.data)  ? res.data
                  : Array.isArray(res.Data1) ? res.Data1
                  : Array.isArray(res)       ? res
                  : [];

    const existing = rawList.map(r => ({
      ...r,
      Id:           Number(r.Id ?? 0),
      UOMName:      String(r.UOMName ?? ""),
      DecimalValue: parseInt(r.DecimalValue, 10) || 0,
      Active:       r.Active === true || r.Active === 1,
      EditMode:     0,
      _uid:         CC.uid(),
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
      const ok = await confirm(`Do you want to delete "${row.UOMName}"?`);
      if (!ok) return;

      setLoading(true);
      const res = await CC.api(
        CC.UOMDelete,
        null,
        { "IdComList": ""},
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

    // Strip trailing blank row before validation
    if (cleaned.length > 1) {
      const last = cleaned[cleaned.length - 1];
      if (!String(last.UOMName || "").trim()) {
        cleaned = cleaned.slice(0, -1);
      }
    }

    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i].EditMode === 1) {
        if (!String(cleaned[i].UOMName || "").trim()) {
          toast("❌ Enter All UOM Name in the Grid !!!", true);
          setSelIdx(i);
          focusRow(i, 0);
          return { ok: false, cleaned };
        }
      }
    }
    return { ok: true, cleaned };
  }, [focusRow, toast]);

  // ── hasDuplicate ───────────────────────────────────────────────────────────
  const hasDuplicate = useCallback((g) => {
    const vals = g
      .filter(r => String(r.UOMName || "").trim())
      .map(r => String(r.UOMName).trim().toLowerCase());
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

    if (hasDuplicate(cleaned)) {
      toast("❌ Duplicate UOM Name found !!!", true); return;
    }

    // ── Decimal value guard ────────────────────────────────────────────────
    const badDec = dirty.find(r => {
      const d = parseInt(r.DecimalValue, 10);
      return d === 1 || d > 3;
    });
    if (badDec) { toast("❌ Decimal Value must be 0, 2 or 3.", true); return; }

    // ── Determine save / update confirm message ────────────────────────────
    const hasNew      = dirty.some(r => r.Id == null || r.Id === 0);
    const hasExisting = dirty.some(r => r.Id != null && r.Id !== 0);
    let confirmMsg    = "Do you want to save the UOM details?";
    if (hasExisting && !hasNew) confirmMsg = "Do you want to update the UOM details?";
    if (hasExisting &&  hasNew) confirmMsg = "Do you want to save & update the UOM details?";

    const proceed = await confirm(confirmMsg);
    if (!proceed) { addRow(); return; }

    setLoading(true);

    const payload = dirty.map(r => ({
      Id:           Number(r.Id || 0),
      UOMName:      String(r.UOMName || "").trim(),
      DecimalValue: parseInt(r.DecimalValue, 10) || 0,
      Active:       r.Active === true ? 1 : 0,
      EditMode:     r.EditMode,
    }));

    const res = await CC.insertapi(
      CC.UOMInsert,
      payload,
      {
        Comid:       String(parseInt(sess.Comid)),
        MirrorTable: String(sess.MirrorTable),
        IdComList:   "",
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
        sessionStorage.setItem("masterReturnName",  dirty[0]?.UOMName || "");
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
      if (e.keyCode === 112) { e.preventDefault(); handleSave(); }
      if (e.keyCode === 27)  { e.preventDefault(); handleEsc();  }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleEsc]);

  // ── Row-level keyboard navigation ─────────────────────────────────────────
  const onCellKeyDown = useCallback((e, idx, colIdx, field) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const row = grid[idx];

      if (field === "UOMName") {
        if (!String(row?.UOMName || "").trim()) { toast("❌ Enter UOM Name !!!", true); return; }
        if (hasDuplicate(grid))                 { toast("❌ Duplicate UOM Name found !!!", true); return; }
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
    if (e.key === "Delete" && !e.ctrlKey && !String(grid[idx]?.UOMName || "").trim()) {
      e.preventDefault(); deleteRow(idx);
    }
  }, [grid, hasDuplicate, addRow, focusRow, deleteRow, toast, rowValidator]);

  // ── Block render until authorized ─────────────────────────────────────────
  if (!isAuthorized) return null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="bm-shell">

      {ConfirmUI}

      <Topbar />

      <div className="bm-layout">
        <div className="bm-card">
          <div className="bm-card-header">
            <div className="bm-card-header-title">UOM Master</div>
            <button type="button" className="bm-close-x" aria-label="Close" onClick={handleEsc}>✕</button>
          </div>

          <div className="bm-card-body">
            <div className="bm-report-title">UOM Master</div>

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
                          textAlign: c.field === "Active" ? "center" : undefined,
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
                            textAlign: col.field === "Active" ? "center" : undefined,
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

                          {/* ── Decimal Value — typed input (0, 2, 3 only) ── */}
                          {col.field === "DecimalValue" && (
                            <input
                              ref={el => {
                                if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                                inputRefs.current[idx][colIdx] = el;
                              }}
                              className="bm-cell-input"
                              value={row.DecimalValue ?? 0}
                              maxLength={1}
                              readOnly={row.EditMode === 0}
                              onChange={e => {
                                if (row.EditMode !== 1) return;
                                const val = e.target.value;
                                // Allow only 0, 2, 3 — reject everything else silently
                                if (val === "" || val === "0" || val === "2" || val === "3") {
                                  updateCell(idx, "DecimalValue", val === "" ? "" : parseInt(val, 10));
                                }
                              }}
                              onBlur={e => {
                                // On leave: if empty or invalid, default back to 0
                                const val = parseInt(e.target.value, 10);
                                if (isNaN(val) || (val !== 0 && val !== 2 && val !== 3)) {
                                  updateCell(idx, "DecimalValue", 0);
                                }
                              }}
                              onKeyDown={e => row.EditMode === 1 && onCellKeyDown(e, idx, colIdx, col.field)}
                              onFocus={() => selectRow(idx)}
                              style={{ textAlign: "center" }}
                            />
                          )}

                          {/* ── UOM Name — uppercase text ── */}
                          {col.field === "UOMName" && (
                            <input
                              ref={el => {
                                if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                                inputRefs.current[idx][colIdx] = el;
                              }}
                              className="bm-cell-input"
                              value={row.UOMName || ""}
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
                <div className="bm-empty">No records. Press ➕ Add Row to add a UOM.</div>
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