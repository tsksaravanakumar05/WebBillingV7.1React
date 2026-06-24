// ─────────────────────────────────────────────────────────────────────────────
//  GroupMaster.jsx
//  Uses shared helpers from Common.jsx via wildcard import (CC.*)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./MasterPage.css";

import Topbar from "../components/Topbar";
import * as CC from "./Common";

export default function GroupMaster() {
  const navigate  = useNavigate();
  const inputRefs = useRef([]);
  const dirtyIds  = useRef(new Set());

  // ── Shared hooks from Common ─────────────────────────────────────────────
  const { confirm, ConfirmUI } = CC.useConfirm();
  const { toast,   toasts    } = CC.useToast();

  // ── Session / company variables ─────────────────────────────────────────────
  const [sess] = useState(() => CC.buildSession("Item Master"));

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

  useEffect(() => {
    const menuStr = localStorage.getItem("menulist");
    if (!menuStr) {
      alert("Session Close Please Login !!!.");
      navigate("/");
      return;
    }

    const menulist = JSON.parse(menuStr);
    const menudata = menulist.filter(obj => obj.PageName === "Item Master");

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

  // ── Component state ─────────────────────────────────────────────────────────
  const [grid,    setGrid]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [selIdx,  setSelIdx]  = useState(null);

  const ALL_COLUMNS = [
    { field: "GroupName", label: "Group Name", width: 300, hidden: false },
    { field: "Active",    label: "Active",     width: 100, hidden: false },
  ];

  const [colSettings, setColSettings] = useState(() =>
    ALL_COLUMNS.map(c => ({ field: c.field, label: c.label, hidden: c.hidden, width: c.width }))
  );

  useEffect(() => {
    const loadColSettings = async () => {
      try {
        const url = `/Content/Appdata/Visible/${sess.MComid}/Group.json?t=${Date.now()}`;
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
      } catch { }
    };
    loadColSettings();
  }, [sess.MComid]); // eslint-disable-line

  const visibleColumns = ALL_COLUMNS.filter(c => {
    const cs = colSettings.find(s => s.field === c.field);
    return cs ? !cs.hidden : !c.hidden;
  }).map(c => {
    const cs = colSettings.find(s => s.field === c.field);
    return { ...c, width: cs?.width ?? c.width };
  });

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
        opacity: editMode === 0 ? 0.5 : 1,
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

  const focusRow = useCallback((idx, colIdx = 0) => {
    setTimeout(() => inputRefs.current[idx]?.[colIdx]?.focus(), 50);
  }, []);

  const selectRow = useCallback((newIdx) => {
    setGrid(prev => prev.map((r, i) => {
      if (i !== newIdx && r.EditMode === 1 && r.Id && !dirtyIds.current.has(r.Id)) {
        return { ...r, EditMode: 0 };
      }
      return r;
    }));
    setSelIdx(newIdx);
  }, []);

  const makeNewRow = (prefill = "") => ({
    Id:        null,
    GroupName: prefill,
    Active:    true,
    EditMode:  1,
    _uid:      CC.uid(),
  });

  const rowValidator = useCallback((row) => {
    return String(row.GroupName || "").trim().length > 0;
  }, []);

  const loadData = useCallback(async () => {
    const prefill = sessionStorage.getItem("masterPrefill") || sessionStorage.getItem("POPValue") || "";
    setLoading(true);

    const res = await CC.api(
      "/Group/SelectGroup",
      { Comid: sess.Comid }
    );

    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res._http404) { toast(`❌ 404 — /Group/SelectGroup not found`, true); }
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
    sessionStorage.removeItem("POPValue");
  }, [sess.Comid, toast, focusRow, redirectIfDualLogin]);

  useEffect(() => { loadData(); }, [loadData]);

  const addRow = useCallback(() => {
    setGrid(prev => {
      const next = [...prev, makeNewRow()];
      const idx  = next.length - 1;
      setSelIdx(idx);
      focusRow(idx);
      return next;
    });
  }, [focusRow]);

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

  const enableEdit = useCallback((idx) => {
    setGrid(prev =>
      prev.map((r, i) => i === idx ? { ...r, EditMode: 1 } : r)
    );
    selectRow(idx);
    focusRow(idx, 0);
  }, [focusRow, selectRow]);

  const deleteRow = useCallback(async (idx) => {
    if (!perm.Delete) { toast("❌ Page Delete Permission Denied !!!", true); return; }

    const row     = grid[idx];
    const isSaved = row.Id != null && row.Id !== 0;

    if (isSaved) {
      const ok = await confirm(`Do you want to delete "${row.GroupName}"?`);
      if (!ok) return;

      setLoading(true);

      const res = await CC.api(
        "/Group/DeleteGroup",
        { Id: Number(row.Id), Comid: Number(sess.Comid), MirrorTable: Number(sess.MirrorTable) },
        { IdComList: String(sess.IdComList) }
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
  }, [grid, sess, perm, focusRow, toast, confirm, redirectIfDualLogin]);

  const gridemptycheck = useCallback((g) => {
    let cleaned = [...g];

    if (cleaned.length > 1 && !String(cleaned[cleaned.length - 1].GroupName || "").trim())
      cleaned = cleaned.slice(0, -1);

    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i].EditMode === 1 && !String(cleaned[i].GroupName || "").trim()) {
        toast("❌ Enter All Group Name in the Grid !!!", true);
        setSelIdx(i);
        focusRow(i);
        return { ok: false, cleaned };
      }
    }
    return { ok: true, cleaned };
  }, [focusRow, toast]);

  const hasDuplicate = useCallback((g) => {
    const names = g
      .filter(r => String(r.GroupName || "").trim())
      .map(r => String(r.GroupName).trim().toLowerCase());
    return new Set(names).size !== names.length;
  }, []);

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
    if (hasDuplicate(cleaned)) { toast("❌ Duplicate Group Name found !!!", true); return; }

    const hasNew      = dirty.some(r => r.Id == null || r.Id === 0);
    const hasExisting = dirty.some(r => r.Id != null && r.Id !== 0);
    let confirmMsg    = "Do you want to save the Group details?";
    if (hasExisting && !hasNew) confirmMsg = "Do you want to update the Group details?";
    if (hasExisting &&  hasNew) confirmMsg = "Do you want to save & update the Group details?";

    const proceed = await confirm(confirmMsg);
    if (!proceed) { addRow(); return; }

    setLoading(true);

    const payload = dirty.map(r => ({
      Id:        (r.Id && r.Id !== 0) ? r.Id : null,
      GroupName: String(r.GroupName || "").trim(),
      Active:    r.Active === true ? 1 : 0,
    }));

    const res = await CC.insertapi(
      "/Group/InsertGroup",
      payload,
      {
        Comid:       String(sess.Comid),
        MirrorTable: String(sess.MirrorTable),
        IdComList:   String(sess.IdComList),
      }
    );

    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

    if (res.ok || res.IsSuccess) {
      dirtyIds.current.clear();
      toast("✅ " + (res.message || "Saved successfully!"));

      const retField = sessionStorage.getItem("masterReturnField");
      if (retField) {
        sessionStorage.setItem("masterReturnValue", String(res.Data2 ?? res.Id ?? ""));
        sessionStorage.setItem("masterReturnName",  dirty[0]?.GroupName || "");
        sessionStorage.removeItem("masterReturnField");
        setTimeout(() => navigate(-1), 800);
      } else if (sessionStorage.getItem("POPStatus") === "ON") {
        sessionStorage.setItem("POPValue", res.Id || res.Data2 || "");
        sessionStorage.setItem("POPName", res.Name || dirty[0]?.GroupName || "");
        sessionStorage.setItem("POPStatus", "OFF");
        window.parent?.document?.querySelector(".ui-dialog-content")?.closest("[role=dialog]")?.__jqxDialog?.close();
      } else {
        await loadData();
      }
    } else {
      toast(`❌ ${res.message || "Save failed"}`, true);
    }
  }, [grid, sess, perm, navigate, loadData, gridemptycheck, hasDuplicate, addRow, toast, confirm, redirectIfDualLogin]);

  const handleEsc = useCallback(async () => {
    const proceed = await confirm("Do You Want To Quit Page?");
    if (!proceed) return;

    if (sessionStorage.getItem("POPStatus") === "ON") {
      sessionStorage.setItem("POPValue", -1);
      sessionStorage.setItem("POPStatus", "OFF");
      window.parent?.document?.querySelector(".ui-dialog-content")?.closest("[role=dialog]")?.__jqxDialog?.close();
    } else {
      sessionStorage.removeItem("masterReturnField");
      sessionStorage.removeItem("masterPrefill");
      navigate("/Home");
    }
  }, [navigate, confirm]);

  useEffect(() => {
    const onKey = e => {
      if (e.keyCode === 112) { e.preventDefault(); handleSave(); }
      if (e.keyCode === 27)  { e.preventDefault(); handleEsc();  }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleEsc]);

  const onCellKeyDown = useCallback((e, idx) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!String(grid[idx]?.GroupName || "").trim()) { toast("❌ Enter Group Name !!!", true); return; }
      if (hasDuplicate(grid))                         { toast("❌ Duplicate Group Name !!!", true); return; }
      if (idx === grid.length - 1) addRow();
      else { setSelIdx(idx + 1); focusRow(idx + 1); }
    }
    if (e.key === "Delete" && e.ctrlKey) {
      e.preventDefault();
      deleteRow(idx);
    }
    if (e.key === "Delete" && !e.ctrlKey && !String(grid[idx]?.GroupName || "").trim()) {
      e.preventDefault();
      deleteRow(idx);
    }
  }, [grid, hasDuplicate, addRow, focusRow, deleteRow, toast]);

  if (!isAuthorized) return null;

  return (
    <div className="mp-wrap">
      {ConfirmUI}
      <Topbar />

      <div className="mp-body">
        <div className="mp-grid-wrap">
          <table className="mp-tbl">
            <thead>
              <tr>
                <th style={{ width: 50 }}>S.No</th>
                {visibleColumns.map(c => (
                  <th key={c.field} style={{
                    width: c.width, minWidth: c.width,
                    textAlign: c.field === "Active" ? "center" : undefined,
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
                    <td key={col.field} style={{ textAlign: col.field === "Active" ? "center" : undefined }}>
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

                      {col.field !== "Active" && (
                        <input
                          ref={el => {
                            if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                            inputRefs.current[idx][colIdx] = el;
                          }}
                          className="mp-cell-input"
                          value={row[col.field] || ""}
                          maxLength={200}
                          readOnly={row.EditMode === 0}
                          onChange={e => row.EditMode === 1 && CC.applyUppercase(e, val => updateCell(idx, col.field, val))}
                          onKeyDown={e => row.EditMode === 1 && CC.handleEnterNext(e, inputRefs, idx, colIdx, visibleColumns.length, grid.length, addRow, grid, rowValidator)}
                          onFocus={() => setSelIdx(idx)}
                          style={{
                            background:   row.EditMode === 0 ? "transparent"               : "#fff",
                            border:       row.EditMode === 0 ? "none"                      : "1px solid #93c5fd",
                            cursor:       row.EditMode === 0 ? "default"                   : "text",
                            color:        row.EditMode === 0 ? "var(--color-text-secondary)" : "#1e293b",
                            boxShadow:    row.EditMode === 0 ? "none"                      : "0 0 0 2px rgba(59,130,246,0.15)",
                            borderRadius: row.EditMode === 1 ? "4px"                       : "0",
                            padding:      row.EditMode === 0 ? "0"                         : undefined,
                          }}
                        />
                      )}
                    </td>
                  ))}

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
            <div className="mp-empty">No records. Press ➕ to add a group.</div>
          )}
        </div>

        <div className="mp-toolbar">
          <button className="mp-btn sv" onClick={handleSave} disabled={loading}>💾 F1 Save</button>
          <button className="mp-btn nw" onClick={addRow}     disabled={loading}>➕ Add Row</button>
          <button className="mp-btn dl" onClick={handleEsc}>✕ Esc Cancel</button>
        </div>
      </div>

      {loading && (
        <div className="mp-loader-ov">
          <div className="mp-ldr-box">
            <div className="mp-spin" />
            <div className="mp-ldr-msg">Processing…</div>
          </div>
        </div>
      )}

      <CC.ToastList toasts={toasts} />
    </div>
  );
}
