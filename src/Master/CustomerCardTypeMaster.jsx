// ─────────────────────────────────────────────────────────────────────────────
//  CustomerCardTypeMaster.jsx
//  Uses shared helpers from Common.jsx via wildcard import (CC.*)
//  Any new export added to Common is auto-available here as CC.xxx
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./MasterPage.css";

import Topbar from "../components/Topbar";

// ✅ Single wildcard import — all current & future Common exports
import * as CC from "./Common";
import * as CC1 from "../components/Common";


// ─── CustomerCardTypeMaster ───────────────────────────────────────────────────
export default function CustomerCardTypeMaster() {
  const navigate  = useNavigate();
  const inputRefs = useRef([]);
  const dirtyIds  = useRef(new Set());

  // ── Shared hooks from Common ─────────────────────────────────────────────
  const { confirm, ConfirmUI } = CC.useConfirm();
  const { toast,   toasts    } = CC.useToast();

  // ── Session / company variables ──────────────────────────────────────────────
  const [sess] = useState(() => CC.buildSession("CustomerCardType"));

  // Store permissions in state
  const [perm,         setPerm        ] = useState({ View: 0, Add: 0, Edit: 0, Delete: 0 });
  const [isAuthorized, setIsAuthorized] = useState(false);

  const redirectIfDualLogin = useCallback((res) => {
    if (res?._dualLogin || res?.redis === false) {
      alert("Already Login Another User Please Login Again!!!");
      navigate("/");
      return true;
    }
    return false;
  }, [navigate]);

  // ── Permission guard ─────────────────────────────────────────────────────────
  useEffect(() => {
    const menuStr = localStorage.getItem("menulist");

    if (!menuStr) {
      alert("Session Close Please Login !!!.");
      navigate("/");
      return;
    }

    const menulist = JSON.parse(menuStr);
    const menudata = menulist.filter(obj => obj.PageName === "Customer"); // matches original JS

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

  // ── Component state ──────────────────────────────────────────────────────────
  const [grid,    setGrid]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [selIdx,  setSelIdx]  = useState(null);

  // ── Column config ────────────────────────────────────────────────────────────
  // Matches jQuery original: TypeName (string), Discount (float), Active (bool)
  const ALL_COLUMNS = [
    { field: "TypeName", label: "Type Name", width: 200, hidden: false, type: "string", maxLen: 50  },
    { field: "Discount", label: "Discount",  width: 120, hidden: false, type: "float",  maxLen: 18, align: "right" },
    { field: "Active",   label: "Active",    width: 100, hidden: false, type: "bool"   },
  ];

  // ── Column settings state ────────────────────────────────────────────────────
  const [colSettings, setColSettings] = useState(() =>
    ALL_COLUMNS.map(c => ({ field: c.field, label: c.label, hidden: c.hidden, width: c.width }))
  );

  // ── Load column settings from server ────────────────────────────────────────
  useEffect(() => {
    const loadColSettings = async () => {
      try {
        const url = `/Content/Appdata/Visible/${sess.MComid}/CustomerCardType.json?t=${Date.now()}`;
        const res = await fetch(url);
        if (!res.ok) return;

        const serverData = await res.json();
        if (!Array.isArray(serverData) || serverData.length === 0) return;

        const merged = ALL_COLUMNS.map(c => {
          const s = serverData.find(d => d.column === c.field);
          return {
            field:  c.field,
            label:  c.label,
            hidden: s ? !s.Visible : c.hidden,
            width:  s ? s.Width    : c.width,
          };
        });
        setColSettings(merged);
      } catch {
        // File doesn't exist yet — silently use defaults
      }
    };
    loadColSettings();
  }, [sess.MComid]); // eslint-disable-line

  // ── Visible columns derived from settings ────────────────────────────────────
  const visibleColumns = ALL_COLUMNS.filter(c => {
    const cs = colSettings.find(s => s.field === c.field);
    return cs ? !cs.hidden : !c.hidden;
  }).map(c => {
    const cs = colSettings.find(s => s.field === c.field);
    return { ...c, width: cs?.width ?? c.width };
  });

  // ── Save column settings to server ──────────────────────────────────────────
  const saveColSettings = useCallback(async (localSettings) => {
    setLoading(true);
    const payload = localSettings.map(s => ({
      filename: "CustomerCardType",
      column:   s.field,
      Visible:  !s.hidden,
      Width:    s.width,
      Comid:    Number(sess.MComid),
    }));
    try {
      const res = await fetch("/Login/VisibleColumns", {
        method:  "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body:    JSON.stringify(payload),
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
  }, [sess.MComid, toast]);

  // ── Toggle component (Active column) ─────────────────────────────────────────
  const Toggle = ({ value, onChange, onKeyDown, inputRef, idx, editMode }) => (
    <button
      ref={inputRef}
      onClick={() => onChange(!value)}
      onKeyDown={onKeyDown}
      onFocus={() => setSelIdx(idx)}
      title={value ? "Active" : "Inactive"}
      style={{
        width: 32, height: 18, borderRadius: 9, border: "none", cursor: "pointer",
        background: value ? "#16a34a" : "#cbd5e1",
        position: "relative", transition: "background 0.18s ease", outline: "none",
        display: "inline-flex", alignItems: "center", flexShrink: 0, padding: 0,
        boxShadow: value ? "inset 0 0 0 1px #15803d" : "inset 0 0 0 1px #b0bec5",
        opacity:       editMode === 0 ? 0.5   : 1,
        pointerEvents: editMode === 0 ? "none" : "auto",
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: value ? 15 : 3,
        width: 12, height: 12, borderRadius: "50%", background: "#fff",
        transition: "left 0.18s ease",
        boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
        display: "block",
      }} />
    </button>
  );

  // ── focusRow ─────────────────────────────────────────────────────────────────
  const focusRow = useCallback((idx, colIdx = 0) => {
    setTimeout(() => inputRefs.current[idx]?.[colIdx]?.focus(), 50);
  }, []);

  // ── selectRow ────────────────────────────────────────────────────────────────
  const selectRow = useCallback((newIdx) => {
    setGrid(prev => prev.map((r, i) => {
      if (i !== newIdx && r.EditMode === 1 && r.Id && !dirtyIds.current.has(r.Id)) {
        return { ...r, EditMode: 0 };
      }
      return r;
    }));
    setSelIdx(newIdx);
  }, []);

  // ── makeNewRow ───────────────────────────────────────────────────────────────
  const makeNewRow = (prefill = "") => ({
    Id:       null,
    TypeName: prefill,
    Discount: "0.00",   // float stored as formatted string (matches jQuery toFixed(2))
    Active:   true,
    EditMode: 1,
    _uid:     CC.uid(),
  });

  // ── rowValidator ─────────────────────────────────────────────────────────────
  const rowValidator = useCallback((row) => {
    return String(row.TypeName || "").trim().length > 0;
  }, []);

  // ── loadData ─────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const prefill = sessionStorage.getItem("masterPrefill") || "";
    setLoading(true);

    const res = await CC.api(
      CC1.CustomerCardTypeSelect,
      null,
      {},
      { Comid: sess.Comid }
    );

    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res._http404) { toast(`❌ 404 — ${CC.CustomerCardTypeSelect} not found`, true); }
    if (res._netErr)  { toast(`❌ Network: ${res.message}`, true); }

    const rawList = Array.isArray(res.data)  ? res.data
                  : Array.isArray(res.Data1) ? res.Data1
                  : [];

    const existing = rawList.map(r => ({
      ...r,
      Active:   r.Active === true || r.Active === 1,
      Id:       Number(r.Id ?? 0),
      // Discount: format to 2 decimal places — matches jQuery toFixed(2)
      Discount: parseFloat(r.Discount || 0).toFixed(2),
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

  // ── addRow ───────────────────────────────────────────────────────────────────
  const addRow = useCallback(() => {
    setGrid(prev => {
      const next = [...prev, makeNewRow()];
      const idx  = next.length - 1;
      setSelIdx(idx);
      focusRow(idx);
      return next;
    });
  }, [focusRow]); // eslint-disable-line

  // ── updateCell ───────────────────────────────────────────────────────────────
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

  // ── blurDiscount — format to 2dp on blur ─────────────────────────────────────
  const blurDiscount = useCallback((idx) => {
    setGrid(prev =>
      prev.map((r, i) =>
        i === idx
          ? { ...r, Discount: parseFloat(r.Discount || 0).toFixed(2) }
          : r
      )
    );
  }, []);

  // ── enableEdit ───────────────────────────────────────────────────────────────
  const enableEdit = useCallback((idx) => {
    setGrid(prev =>
      prev.map((r, i) => i === idx ? { ...r, EditMode: 1 } : r)
    );
    selectRow(idx);
    focusRow(idx, 0);
  }, [focusRow, selectRow]);

  // ── deleteRow ────────────────────────────────────────────────────────────────
  const deleteRow = useCallback(async (idx) => {
    if (!perm.Delete) { toast("❌ Page Delete Permission Denied !!!", true); return; }

    const row     = grid[idx];
    const isSaved = row.Id != null && row.Id !== 0;

    if (isSaved) {
      const ok = await confirm(`Do you want to delete "${row.TypeName}"?`);
      if (!ok) return;

      setLoading(true);

      const res = await CC.api(
        CC1.CustomerCardTypeDelete,
        null,
        { "IdComList": "" },
        { Id: Number(row.Id), Comid: Number(sess.Comid), MirrorTable: Number(sess.MirrorTable) }
      );

      setLoading(false);
      if (redirectIfDualLogin(res)) return;
      if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

      if (res.ok || res.IsSuccess) {
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
  }, [grid, sess, perm, focusRow, toast, confirm]);

  // ── gridemptycheck ───────────────────────────────────────────────────────────
  const gridemptycheck = useCallback((g) => {
    let cleaned = [...g];

    // Remove trailing empty blank row
    if (cleaned.length > 1 && !String(cleaned[cleaned.length - 1].TypeName || "").trim())
      cleaned = cleaned.slice(0, -1);

    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i].EditMode === 1 && !String(cleaned[i].TypeName || "").trim()) {
        toast("❌ Enter All Customer Card Type Name in the Grid !!!", true);
        setSelIdx(i);
        focusRow(i);
        return { ok: false, cleaned };
      }
    }
    return { ok: true, cleaned };
  }, [focusRow, toast]);

  // ── hasDuplicate ─────────────────────────────────────────────────────────────
  const hasDuplicate = useCallback((g) => {
    const names = g
      .filter(r => String(r.TypeName || "").trim())
      .map(r => String(r.TypeName).trim().toLowerCase());
    return new Set(names).size !== names.length;
  }, []);

  // ── handleSave ───────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const { ok, cleaned } = gridemptycheck(grid);
    if (!ok) return;
    setGrid(cleaned);

    let dirty = [];
    let flag  = 1;

    // ── Permission checks ────────────────────────────────────────────────────
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
    if (hasDuplicate(cleaned)) { toast("❌ Duplicate Type Name found !!!", true); return; }

    // ── Smart confirm message ────────────────────────────────────────────────
    const hasNew      = dirty.some(r => r.Id == null || r.Id === 0);
    const hasExisting = dirty.some(r => r.Id != null && r.Id !== 0);
    let confirmMsg    = "Do you want to save the CustomerCardType details?";
    if (hasExisting && !hasNew) confirmMsg = "Do you want to update the CustomerCardType details?";
    if (hasExisting &&  hasNew) confirmMsg = "Do you want to save & update the CustomerCardType details?";

    const proceed = await confirm(confirmMsg);
    if (!proceed) { addRow(); return; }

    setLoading(true);

    // ── Build API payload ────────────────────────────────────────────────────
    const payload = dirty.map(r => ({
      Id:       (r.Id && r.Id !== 0) ? r.Id : null,
      TypeName: String(r.TypeName || "").trim(),
      Discount: parseFloat(r.Discount || 0),   // send as number to API
      Active:   r.Active === true ? 1 : 0,
    }));

    const res = await CC.insertapi(
      CC1.CustomerCardTypeInsert,
      payload,
      {
        Comid:       String(sess.Comid),
        MirrorTable: String(sess.MirrorTable),
        IdComList:   "",
      }
    );

    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

    if (res.IsSuccess || res.ok) {
      dirtyIds.current.clear();
      toast("✅ " + (res.message || "Saved successfully!"));

      // If opened from another page expecting a return value
      const retField = sessionStorage.getItem("masterReturnField");
      if (retField) {
        sessionStorage.setItem("masterReturnValue", String(res.Data2 ?? res.Id ?? ""));
        sessionStorage.setItem("masterReturnName",  dirty[0]?.TypeName || "");
        sessionStorage.removeItem("masterReturnField");
        setTimeout(() => navigate(-1), 800);
      } else {
        await loadData();
      }
    } else {
      toast(`❌ ${res.message || "Save failed"}`, true);
    }
  }, [grid, sess, perm, navigate, loadData, gridemptycheck, hasDuplicate, addRow, toast, confirm]);

  // ── handleEsc ────────────────────────────────────────────────────────────────
  const handleEsc = useCallback(() => {
    sessionStorage.removeItem("masterReturnField");
    sessionStorage.removeItem("masterPrefill");
    navigate(-1);
  }, [navigate]);

  // ── Global keyboard shortcuts: F1 = Save | Esc = Back ────────────────────────
  useEffect(() => {
    const onKey = e => {
      if (e.keyCode === 112) { e.preventDefault(); handleSave(); }
      if (e.keyCode === 27)  { e.preventDefault(); handleEsc();  }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleEsc]);

  // ── Row-level keyboard navigation ─────────────────────────────────────────────
  const onCellKeyDown = useCallback((e, idx, colIdx) => {
    const col = visibleColumns[colIdx];

    if (e.key === "Enter") {
      e.preventDefault();

      // TypeName column — validate before moving
      if (col?.field === "TypeName") {
        if (!String(grid[idx]?.TypeName || "").trim()) { toast("❌ Enter CardType Name !!!", true); return; }
        if (hasDuplicate(grid))                        { toast("❌ Duplicate Type Name !!!", true); return; }
      }

      // Discount column — format on Enter
      if (col?.field === "Discount") {
        blurDiscount(idx);
      }

      CC.handleEnterNext(e, inputRefs, idx, colIdx, visibleColumns.length, grid.length, addRow, grid, rowValidator);
    }

    if (e.key === "Delete" && e.ctrlKey) {
      e.preventDefault();
      deleteRow(idx);
    }
    if (e.key === "Delete" && !e.ctrlKey && !String(grid[idx]?.TypeName || "").trim()) {
      e.preventDefault();
      deleteRow(idx);
    }
  }, [grid, visibleColumns, hasDuplicate, addRow, focusRow, deleteRow, blurDiscount, toast, rowValidator]);

  // Prevent the page UI from flashing before the redirect happens
  if (!isAuthorized) return null;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="mp-wrap">

      {/* Confirm Dialog */}
      {ConfirmUI}

      <Topbar />

      <div className="mp-body">

        {/* ── Grid ── */}
        <div className="mp-grid-wrap">
          <table className="mp-tbl">
            <thead>
              <tr>
                <th style={{ width: 50 }}>S.No</th>
                {visibleColumns.map(c => (
                  <th key={c.field} style={{
                    width: c.width, minWidth: c.width,
                    textAlign: (c.field === "Active" || c.align === "right") ? (c.align || "center") : undefined,
                  }}>
                    {c.label}
                  </th>
                ))}
                <th style={{ width: 44 }}></th>
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

                  {visibleColumns.map((col, colIdx) => (
                    <td key={col.field} style={{
                      textAlign: col.field === "Active" ? "center"
                               : col.align             ? col.align
                               : undefined,
                    }}>

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
                              CC.handleEnterNext(e, inputRefs, idx, colIdx, visibleColumns.length, grid.length, addRow, grid, rowValidator);
                            }
                          }}
                        />
                      )}

                      {/* ── Discount — numeric input, right-aligned ── */}
                      {col.field === "Discount" && (
                        <input
                          ref={el => {
                            if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                            inputRefs.current[idx][colIdx] = el;
                          }}
                          className="mp-cell-input"
                          value={row.Discount ?? "0.00"}
                          maxLength={col.maxLen || 18}
                          readOnly={row.EditMode === 0}
                          // Only allow digits and one decimal point (mirrors GridKeyPressValidation float)
                          onKeyPress={e => {
                            if (!/[\d.]/.test(e.key)) e.preventDefault();
                            // Prevent second decimal point
                            if (e.key === "." && String(row.Discount || "").includes(".")) e.preventDefault();
                          }}
                          onChange={e => row.EditMode === 1 && updateCell(idx, col.field, e.target.value)}
                          onBlur={() => row.EditMode === 1 && blurDiscount(idx)}
                          onKeyDown={e => row.EditMode === 1 && onCellKeyDown(e, idx, colIdx)}
                          onFocus={e => { setSelIdx(idx); e.target.select(); }}
                          style={{
                            background:   row.EditMode === 0 ? "transparent"                  : "#fff",
                            border:       row.EditMode === 0 ? "none"                         : "1px solid #93c5fd",
                            cursor:       row.EditMode === 0 ? "default"                      : "text",
                            color:        row.EditMode === 0 ? "var(--color-text-secondary)"  : "#1e293b",
                            boxShadow:    row.EditMode === 0 ? "none"                         : "0 0 0 2px rgba(59,130,246,0.15)",
                            borderRadius: row.EditMode === 1 ? "4px"                          : "0",
                            padding:      row.EditMode === 0 ? "0"                            : undefined,
                            textAlign:    "right",
                          }}
                        />
                      )}

                      {/* ── All other text inputs (TypeName etc.) ── */}
                      {col.field !== "Active" && col.field !== "Discount" && (
                        <input
                          ref={el => {
                            if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                            inputRefs.current[idx][colIdx] = el;
                          }}
                          className="mp-cell-input"
                          value={row[col.field] || ""}
                          maxLength={col.maxLen || 200}
                          readOnly={row.EditMode === 0}
                          onChange={e => row.EditMode === 1 && CC.applyUppercase(e, val => updateCell(idx, col.field, val))}
                          onKeyDown={e => row.EditMode === 1 && onCellKeyDown(e, idx, colIdx)}
                          onFocus={() => setSelIdx(idx)}
                          style={{
                            background:   row.EditMode === 0 ? "transparent"                  : "#fff",
                            border:       row.EditMode === 0 ? "none"                         : "1px solid #93c5fd",
                            cursor:       row.EditMode === 0 ? "default"                      : "text",
                            color:        row.EditMode === 0 ? "var(--color-text-secondary)"  : "#1e293b",
                            boxShadow:    row.EditMode === 0 ? "none"                         : "0 0 0 2px rgba(59,130,246,0.15)",
                            borderRadius: row.EditMode === 1 ? "4px"                          : "0",
                            padding:      row.EditMode === 0 ? "0"                            : undefined,
                          }}
                        />
                      )}

                    </td>
                  ))}

                  {/* ── Edit + Delete action column ── */}
                  <td style={{ whiteSpace: "nowrap" }}>

                    {row.Id && row.EditMode === 0 && (
                      <button
                        className="mp-edit-btn"
                        title="Edit row"
                        onClick={e => { e.stopPropagation(); enableEdit(idx); }}
                      >
                        ✏️
                      </button>
                    )}

                    {row.Id && row.EditMode === 1 && (
                      <button
                        className="mp-edit-btn active"
                        title="Editing…"
                        style={{ color: "#16a34a", cursor: "default" }}
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
            <div className="mp-empty">No records. Press ➕ to add a card type.</div>
          )}
        </div>

        {/* ── Toolbar ── */}
        <div className="mp-toolbar">
          <button className="mp-btn sv" onClick={handleSave} disabled={loading}>💾 F1 Save</button>
          <button className="mp-btn nw" onClick={addRow}     disabled={loading}>➕ Add Row</button>
          <button className="mp-btn dl" onClick={handleEsc}>✕ Esc Cancel</button>
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
      <CC.ToastList toasts={toasts} />

    </div>
  );
}