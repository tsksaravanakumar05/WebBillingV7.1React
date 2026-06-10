// ─────────────────────────────────────────────────────────────────────────────
//  ModelMaster.jsx
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
//   • CRUD: loadData / addRow / updateCell / enableEdit / deleteRow / handleSave
//   • Keyboard shortcuts: F1 = Save | Esc = Back | Enter = next row | Ctrl+Del = delete
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./MasterPage.css";

import Topbar from "../components/Topbar";
import * as CC  from "../components/Common";
import * as MSG from "../components/Messages";

// ─── Toggle component (Active column) ────────────────────────────────────────
//  Identical to DepartmentMaster's Toggle — disabled in view mode (EditMode 0).
function Toggle({ value, onChange, onKeyDown, inputRef, idx, editMode, onFocus }) {
  return (
    <button
      ref={inputRef}
      onClick={() => editMode === 1 && onChange(!value)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      title={value ? "Active" : "Inactive"}
      style={{
        width:32, height:18, borderRadius:9, border:"none",
        cursor: editMode === 0 ? "default" : "pointer",
        background: value ? "#16a34a" : "#cbd5e1",
        position:"relative", transition:"background 0.18s ease",
        outline:"none", display:"inline-flex", alignItems:"center",
        flexShrink:0, padding:0,
        boxShadow: value
          ? "inset 0 0 0 1px #15803d"
          : "inset 0 0 0 1px #b0bec5",
        opacity:       editMode === 0 ? 0.5 : 1,
        pointerEvents: editMode === 0 ? "none" : "auto",
      }}
    >
      <span style={{
        position:"absolute", top:3,
        left: value ? 15 : 3,
        width:12, height:12, borderRadius:"50%",
        background:"#fff",
        transition:"left 0.18s ease",
        boxShadow:"0 1px 2px rgba(0,0,0,0.18)",
        display:"block",
      }} />
    </button>
  );
}

// ─── Column config ────────────────────────────────────────────────────────────
//  ModelMaster has two visible columns: ModelName + Active
const ALL_COLUMNS = [
  { field: "ModelName", label: "Model Name", width: 300 },
  { field: "Active",    label: "Active",     width: 90  },
];

// ─── ModelMaster ──────────────────────────────────────────────────────────────
export default function ModelMaster() {
  const navigate  = useNavigate();
  const inputRefs = useRef([]);          // inputRefs[rowIdx][colIdx]
  const dirtyIds  = useRef(new Set());   // tracks saved rows where user actually typed

  // ── MSG hooks ──────────────────────────────────────────────────────────────
  const { confirm, ConfirmUI } = MSG.useConfirm();
  const { toast,   toasts    } = MSG.useToast();

  // ── Permission / authorization state (mirrors DepartmentMaster) ────────────
  const [perm,         setPerm        ] = useState({ View:0, Add:0, Edit:0, Delete:0 });
  const [isAuthorized, setIsAuthorized] = useState(false);

  // ── Permission guard — same useEffect pattern as DepartmentMaster ──────────
  useEffect(() => {
    const menuStr = localStorage.getItem("menulist");

    if (!menuStr) {
      alert("Session Close Please Login !!!.");
      navigate("/Login/Index");
      return;
    }

    const menulist = JSON.parse(menuStr);
    const menudata = menulist.filter(obj => obj.PageName === "ModelMaster");

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

  // ── Session (same pattern as DepartmentMaster) ─────────────────────────────
  const [sess] = useState(() => {
    try {
      const main0     = (CC.getLocal("Mainsetting") || [{}])[0] || {};
      const Comid     = CC.getStr("Comid")    || "1";
      const MComid    = CC.getStr("MComid")   || Comid;
      const IdComList = "";
      const isCC      = !!main0.CommonCompany;
      return {
        Comid:       isCC ? MComid : Comid,
        MComid,
        IdComList,
        MirrorTable: Number(localStorage.getItem("MirrorTableOnline") || "0"),
        menudata:    (CC.getLocal("menulist") || []).filter(o => o.PageName === "ModelMaster"),
      };
    } catch {
      return { Comid:"1", MComid:"1", IdComList:"1", MirrorTable:0, menudata:[] };
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

  // ── selectRow — exits edit mode on non-dirty saved rows (mirrors Department) ─
  const selectRow = useCallback((newIdx) => {
    setGrid(prev => prev.map((r, i) => {
      if (i !== newIdx && r.EditMode === 1 && r.Id && !dirtyIds.current.has(r.Id)) {
        return { ...r, EditMode:0 };
      }
      return r;
    }));
    setSelIdx(newIdx);
  }, []);

  // ── makeNewRow ─────────────────────────────────────────────────────────────
  const makeNewRow = (prefill = "") => ({
    Id:        null,
    ModelName: prefill,
    Active:    true,
    EditMode:  1,
    _uid:      CC.uid(),
  });

  // ── rowValidator — used by handleEnterNext ─────────────────────────────────
  const rowValidator = useCallback((row) =>
    String(row.ModelName || "").trim().length > 0
  , []);

  // ── loadData ───────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const prefill = sessionStorage.getItem("masterPrefill") || "";
    setLoading(true);
    const res = await CC.api(
      CC.SelectModel,
      null,
      {},
      { Comid: sess.Comid }
    );
    setLoading(false);

if (redirectIfDualLogin(res)) return;
    if (res._http404) { toast(`❌ 404 — ${CC.SelectModel} not found`, true); }
    if (res._netErr)  { toast(`❌ Network: ${res.message}`, true); }

    const rawList = Array.isArray(res.data)  ? res.data
                  : Array.isArray(res.Data1) ? res.Data1
                  : [];

    const existing = rawList.map(r => ({
      ...r,
      Active:   r.Active === true || r.Active === 1,
      Id:       Number(r.Id ?? 0),
      EditMode: 0,
      _uid:     CC.uid(),
    }));

    const blank = makeNewRow(prefill);
    setGrid([...existing, blank]);
    setSelIdx(existing.length);
    focusRow(existing.length);
    sessionStorage.removeItem("masterPrefill");
  }, [sess.Comid, toast, focusRow]); // eslint-disable-line

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

  // ── updateCell — marks row as dirty if it has an Id ───────────────────────
  const updateCell = useCallback((idx, field, value) => {
    setGrid(prev =>
      prev.map((r, i) => {
        if (i === idx) {
          if (r.Id) dirtyIds.current.add(r.Id); // user actually typed → mark dirty
          return { ...r, [field]:value, EditMode:1 };
        }
        return r;
      })
    );
  }, []);

  // ── enableEdit — pencil button click (mirrors DepartmentMaster) ───────────
  const enableEdit = useCallback((idx) => {
    setGrid(prev =>
      prev.map((r, i) => i === idx ? { ...r, EditMode:1 } : r)
    );
    selectRow(idx);
    focusRow(idx, 0); // col 0 = ModelName
  }, [focusRow, selectRow]);

  // ── deleteRow ──────────────────────────────────────────────────────────────
  const deleteRow = useCallback(async (idx) => {
    if (!perm.Delete) { toast("❌ Page Delete Permission Denied !!!", true); return; }

    const row     = grid[idx];
    const isSaved = row.Id != null && row.Id !== 0;

    if (isSaved) {
      const ok = await confirm(`Do you want to delete "${row.ModelName}"?`);
      if (!ok) return;

      setLoading(true);
      const res = await CC.api(
        CC.DeleteModel,
        null,
        {},
        { Id:Number(row.Id), Comid:Number(sess.Comid), MirrorTable:Number(sess.MirrorTable) }
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
      // Unsaved row — remove from grid directly
      setGrid(prev => {
        const next = prev.filter((_, i) => i !== idx);
        const sel  = Math.max(0, next.length - 1);
        setSelIdx(sel);
        focusRow(sel);
        return next;
      });
    }
  }, [grid, sess, perm, focusRow, toast, confirm]);

  // ── gridemptycheck ─────────────────────────────────────────────────────────
  const gridemptycheck = useCallback((g) => {
    let cleaned = [...g];

    // Remove trailing blank row
    if (cleaned.length > 1 && !String(cleaned[cleaned.length - 1].ModelName || "").trim())
      cleaned = cleaned.slice(0, -1);

    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i].EditMode === 1 && !String(cleaned[i].ModelName || "").trim()) {
        toast("❌ Enter All Model Name in the Grid !!!", true);
        setSelIdx(i);
        focusRow(i);
        return { ok:false, cleaned };
      }
    }
    return { ok:true, cleaned };
  }, [focusRow, toast]);
const redirectIfDualLogin = useCallback((res) => {
  if (res?._dualLogin || res?.redis === false) {
    alert("Already Login Another User Please Login Again!!!");
    navigate("/"); // Redirect to your specific login path
    return true;
  }
  return false;
}, [navigate]);
  // ── hasDuplicate ───────────────────────────────────────────────────────────
  const hasDuplicate = useCallback((g) => {
    const names = g
      .filter(r => String(r.ModelName || "").trim())
      .map(r => String(r.ModelName).trim().toLowerCase());
    return new Set(names).size !== names.length;
  }, []);

  // ── handleSave (mirrors DepartmentMaster permission logic exactly) ─────────
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
    if (hasDuplicate(cleaned)) { toast("❌ Duplicate Model Name found !!!", true); return; }

    // Smart confirm message
    const hasNew      = dirty.some(r => r.Id == null || r.Id === 0);
    const hasExisting = dirty.some(r => r.Id != null && r.Id !== 0);
    let confirmMsg    = "Do you want to save the Model details?";
    if (hasExisting && !hasNew) confirmMsg = "Do you want to update the Model details?";
    if (hasExisting &&  hasNew) confirmMsg = "Do you want to save & update the Model details?";

    const proceed = await confirm(confirmMsg);
    if (!proceed) { addRow(); return; }

    setLoading(true);

    const payload = dirty.map(r => ({
      Id:        Number(r.Id || 0),
      ModelName: String(r.ModelName || "").trim(),
      Active:    r.Active === true ? 1 : 0,
      EditMode:  r.EditMode,
    }));

    const res = await CC.insertapi(
      CC.InsertModel,
      payload,
      {
        Comid:       String(parseInt(sess.Comid)),
        MirrorTable: String(sess.MirrorTable),
        IdComList:   String(sess.IdComList),
        ApiType:     "0",
      }
    );

    setLoading(false);

if (redirectIfDualLogin(res)) return;
    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

    if (redirectIfDualLogin(res)) return;
    if (res.IsSuccess) {
      dirtyIds.current.clear();
      toast("✅ " + (res.message || "Saved successfully!"));

      const retField = sessionStorage.getItem("masterReturnField");
      if (retField) {
        sessionStorage.setItem("masterReturnValue", String(res.Data2 ?? res.Id ?? ""));
        sessionStorage.setItem("masterReturnName",  dirty[0]?.ModelName || "");
        sessionStorage.removeItem("masterReturnField");
        setTimeout(() => navigate(-1), 800);
      } else {
        await loadData();
      }
    } else {
      toast(`❌ ${res.message || "Save failed"}`, true);
    }
  }, [grid, sess, perm, navigate, loadData, gridemptycheck, hasDuplicate, addRow, toast, confirm]);

  // ── handleEsc ──────────────────────────────────────────────────────────────
  const handleEsc = useCallback(() => {
    sessionStorage.removeItem("masterReturnField");
    sessionStorage.removeItem("masterPrefill");
    navigate(-1);
  }, [navigate]);

  // ── Global keyboard shortcuts: F1 = Save | Esc = Back ────────────────────
  useEffect(() => {
    const onKey = e => {
      if (e.keyCode === 112) { e.preventDefault(); handleSave(); }
      if (e.keyCode === 27)  { e.preventDefault(); handleEsc();  }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleEsc]);

  // ── Row-level keyboard navigation ──────────────────────────────────────────
  const onCellKeyDown = useCallback((e, idx) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!String(grid[idx]?.ModelName || "").trim()) {
        toast("❌ Enter Model Name !!!", true); return;
      }
      if (hasDuplicate(grid)) { toast("❌ Duplicate Model Name !!!", true); return; }
      if (idx === grid.length - 1) addRow();
      else { setSelIdx(idx + 1); focusRow(idx + 1); }
    }
    if (e.key === "Delete" && e.ctrlKey) {
      e.preventDefault(); deleteRow(idx);
    }
    if (e.key === "Delete" && !e.ctrlKey && !String(grid[idx]?.ModelName || "").trim()) {
      e.preventDefault(); deleteRow(idx);
    }
  }, [grid, hasDuplicate, addRow, focusRow, deleteRow, toast]);

  // ── Block render until authorized (mirrors DepartmentMaster) ──────────────
  if (!isAuthorized) return null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mp-wrap">

      {/* Confirm Dialog */}
      {ConfirmUI}

      <Topbar />

      <div className="mp-body">

        {/* ── Toolbar ── */}
        <div className="mp-toolbar">
          <button className="mp-btn sv" onClick={handleSave} disabled={loading}>💾 F1 Save</button>
          <button className="mp-btn nw" onClick={addRow}     disabled={loading}>➕ Add Row</button>
          <button className="mp-btn dl" onClick={handleEsc}>✕ Esc Cancel</button>
          <div className="mp-toolbar-title">Model Master</div>
        </div>

        {/* ── Grid ── */}
        <div className="mp-grid-wrap">
          <table className="mp-tbl">
            <thead>
              <tr>
                <th style={{ width:50 }}>S.No</th>
                {ALL_COLUMNS.map(c => (
                  <th
                    key={c.field}
                    style={{
                      width: c.width,
                      minWidth: c.width,
                      textAlign: c.field === "Active" ? "center" : undefined,
                    }}
                  >
                    {c.label}
                  </th>
                ))}
                {/* Edit + Delete column */}
                <th style={{ width:60 }}></th>
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
                      style={{ textAlign: col.field === "Active" ? "center" : undefined }}
                    >
                      {/* ── Active Toggle ── */}
                      {col.field === "Active" && (
                        <Toggle
                          value={!!row.Active}
                          idx={idx}
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
                              CC.handleEnterNext(
                                e, inputRefs, idx, colIdx,
                                ALL_COLUMNS.length, grid.length,
                                addRow, grid, rowValidator
                              );
                            }
                          }}
                        />
                      )}

                      {/* ── ModelName Input ── */}
                      {col.field !== "Active" && (
                        <input
                          ref={el => {
                            if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                            inputRefs.current[idx][colIdx] = el;
                          }}
                          className="mp-cell-input"
                          value={row[col.field] || ""}
                          maxLength={50}
                          readOnly={row.EditMode === 0}
                          onChange={e =>
                            row.EditMode === 1 &&
                            CC.applyUppercase(e, val => updateCell(idx, col.field, val))
                          }
                          onKeyDown={e =>
                            row.EditMode === 1 && onCellKeyDown(e, idx)
                          }
                          onFocus={() => selectRow(idx)}
                          style={{
                            background:   row.EditMode === 0 ? "transparent" : "#fff",
                            border:       row.EditMode === 0 ? "none" : "1px solid #93c5fd",
                            cursor:       row.EditMode === 0 ? "default" : "text",
                            color:        row.EditMode === 0 ? "var(--color-text-secondary)" : "#1e293b",
                            boxShadow:    row.EditMode === 0 ? "none" : "0 0 0 2px rgba(59,130,246,0.15)",
                            borderRadius: row.EditMode === 1 ? "4px" : "0",
                            padding:      row.EditMode === 0 ? "0" : undefined,
                          }}
                        />
                      )}
                    </td>
                  ))}

                  {/* ── Edit + Delete buttons (mirrors DepartmentMaster) ── */}
                  <td style={{ whiteSpace:"nowrap" }}>
                    {/* Edit button: show only when row is saved and in view mode */}
                    {row.Id && row.EditMode === 0 && (
                      <button
                        className="mp-edit-btn"
                        title="Edit row"
                        onClick={e => { e.stopPropagation(); enableEdit(idx); }}
                      >
                        ✏️
                      </button>
                    )}
                    {/* Editing indicator: saved row currently being edited */}
                    {row.Id && row.EditMode === 1 && (
                      <button
                        className="mp-edit-btn active"
                        title="Editing…"
                        style={{ color:"#16a34a", cursor:"default" }}
                      >
                        ✏️
                      </button>
                    )}
                    <button
                      className="mp-del-btn"
                      onClick={e => { e.stopPropagation(); deleteRow(idx); }}
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {grid.length === 0 && !loading && (
            <div className="mp-empty">No records. Press ➕ to add a model.</div>
          )}
        </div>

        {/* ── Keyboard hint bar ── */}
        <div className="mp-hint">
          <kbd>Enter</kbd> next row &nbsp;|&nbsp;
          <kbd>Ctrl+Delete</kbd> delete row &nbsp;|&nbsp;
          <kbd>F1</kbd> save &nbsp;|&nbsp;
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

      {/* ── Toast notifications ── */}
      <MSG.ToastList toasts={toasts} />
    </div>
  );
}