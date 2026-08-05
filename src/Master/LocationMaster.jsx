import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Save, Plus, XCircle, Pencil, Trash2 } from "lucide-react";

import "./LocationMaster.css";
import Topbar from "../components/Topbar";
import * as CC from "../components/Common";
import * as MSG from "../components/Messages";

function Toggle({ value, onChange, onKeyDown, inputRef, editMode, onFocus }) {
  return (
    <button
      ref={inputRef}
      type="button"
      onClick={() => editMode === 1 && onChange(!value)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      title={value ? "Active" : "Inactive"}
      className={[
        "lm-toggle",
        value ? "on" : "off",
        editMode === 0 ? "is-readonly" : "",
      ].filter(Boolean).join(" ")}
    >
      <span className="lm-toggle-thumb" />
    </button>
  );
}

const ALL_COLUMNS = [
  { field: "LocationName", label: "Location Name" },
  { field: "Active", label: "Active" },
];

export default function LocationMaster() {
  const navigate = useNavigate();
  const inputRefs = useRef([]);
  const dirtyIds = useRef(new Set());

  const { confirm, ConfirmUI } = MSG.useConfirm();
  const { toast, toasts } = MSG.useToast();

  const [perm, setPerm] = useState({ View: 1, Add: 1, Edit: 1, Delete: 1 });
  const [isAuthorized, setIsAuthorized] = useState(true);

  useEffect(() => {
    const menuStr = localStorage.getItem("menulist");

    if (!menuStr) {
      alert("Session Close Please Login !!!.");
      navigate("/Login/Index");
      return;
    }

    setPerm({ View: 1, Add: 1, Edit: 1, Delete: 1 });
    setIsAuthorized(true);
  }, [navigate]);

  const [sess] = useState(() => {
    try {
      const main0 = (CC.getLocal("Mainsetting") || [{}])[0] || {};
      const Comid = CC.getStr("Comid") || "1";
      const MComid = CC.getStr("MComid") || Comid;
      const IdComList = CC.getStr("IdComList") || Comid;
      const isCC = !!main0.CommonCompany;
      return {
        Comid: isCC ? MComid : Comid,
        MComid,
        IdComList,
        MirrorTable: Number(localStorage.getItem("MirrorTableOnline") || "0"),
        menudata: (CC.getLocal("menulist") || []).filter((o) => o.PageName === "Location"),
      };
    } catch {
      return { Comid: "1", MComid: "1", IdComList: "1", MirrorTable: 0, menudata: [] };
    }
  });

  const [grid, setGrid] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selIdx, setSelIdx] = useState(null);

  const focusRow = useCallback((idx, colIdx = 0) => {
    setTimeout(() => inputRefs.current[idx]?.[colIdx]?.focus(), 50);
  }, []);

  const selectRow = useCallback((newIdx) => {
    setGrid((prev) => prev.map((r, i) => {
      if (i !== newIdx && r.EditMode === 1 && r.Id && !dirtyIds.current.has(r.Id)) {
        return { ...r, EditMode: 0 };
      }
      return r;
    }));
    setSelIdx(newIdx);
  }, []);

  const makeNewRow = (prefill = "") => ({
    Id: null,
    LocationName: prefill,
    Active: true,
    EditMode: 1,
    _uid: CC.uid(),
  });

  const rowValidator = useCallback(
    (row) => String(row.LocationName || "").trim().length > 0,
    []
  );

  const loadData = useCallback(async () => {
    const prefill = sessionStorage.getItem("masterPrefill") || "";
    setLoading(true);

    const res = await CC.api(
      CC.LocationSelect,
      null,
      {},
      { Comid: sess.Comid }
    );

    setLoading(false);

    if (res._http404) toast(`404 - ${CC.LocationSelect} not found`, true);
    if (res._netErr) toast(`Network: ${res.message}`, true);

    const rawList = Array.isArray(res.data)
      ? res.data
      : Array.isArray(res.Data1)
        ? res.Data1
        : [];

    const existing = rawList.map((r) => ({
      ...r,
      Active: r.Active === true || r.Active === 1,
      Id: Number(r.Id ?? 0),
      EditMode: 0,
      _uid: CC.uid(),
    }));

    const blank = makeNewRow(prefill);
    setGrid([...existing, blank]);
    setSelIdx(existing.length);
    focusRow(existing.length);
    sessionStorage.removeItem("masterPrefill");
  }, [sess.Comid, toast, focusRow]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addRow = useCallback(() => {
    setGrid((prev) => {
      const next = [...prev, makeNewRow()];
      const idx = next.length - 1;
      setSelIdx(idx);
      focusRow(idx);
      return next;
    });
  }, [focusRow]);

  const updateCell = useCallback((idx, field, value) => {
    setGrid((prev) =>
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
    setGrid((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, EditMode: 1 } : r))
    );
    selectRow(idx);
    focusRow(idx, 0);
  }, [focusRow, selectRow]);

  const deleteRow = useCallback(async (idx) => {
    if (!perm.Delete) {
      toast("Page Delete Permission Denied !!!", true);
      return;
    }

    const row = grid[idx];
    const isSaved = row.Id != null && row.Id !== 0;

    if (isSaved) {
      const ok = await confirm(`Do you want to delete "${row.LocationName}"?`);
      if (!ok) return;

      setLoading(true);
      const res = await CC.api(
        CC.LocationDelete,
        null,
        {},
        { Id: Number(row.Id), Comid: Number(sess.Comid), MirrorTable: Number(sess.MirrorTable) }
      );
      setLoading(false);

      if (res._netErr) {
        toast(`${res.message}`, true);
        return;
      }

      if (res.ok) {
        toast(res.message || "Deleted");
        setGrid((prev) => {
          const next = prev.filter((_, i) => i !== idx);
          const sel = Math.max(0, next.length - 1);
          setSelIdx(sel);
          focusRow(sel);
          return next;
        });
      } else {
        toast(res.message || "Delete failed", true);
      }
    } else {
      setGrid((prev) => {
        const next = prev.filter((_, i) => i !== idx);
        const sel = Math.max(0, next.length - 1);
        setSelIdx(sel);
        focusRow(sel);
        return next;
      });
    }
  }, [grid, sess, perm, focusRow, toast, confirm]);

  const gridemptycheck = useCallback((g) => {
    let cleaned = [...g];

    if (cleaned.length > 1 && !String(cleaned[cleaned.length - 1].LocationName || "").trim()) {
      cleaned = cleaned.slice(0, -1);
    }

    for (let i = 0; i < cleaned.length; i += 1) {
      if (cleaned[i].EditMode === 1 && !String(cleaned[i].LocationName || "").trim()) {
        toast("Enter All Location Name in the Grid !!!", true);
        setSelIdx(i);
        focusRow(i);
        return { ok: false, cleaned };
      }
    }

    return { ok: true, cleaned };
  }, [focusRow, toast]);

  const hasDuplicate = useCallback((g) => {
    const names = g
      .filter((r) => String(r.LocationName || "").trim())
      .map((r) => String(r.LocationName).trim().toLowerCase());
    return new Set(names).size !== names.length;
  }, []);

  const handleSave = useCallback(async () => {
    const { ok, cleaned } = gridemptycheck(grid);
    if (!ok) return;
    setGrid(cleaned);

    let dirty = [];
    let flag = 1;

    if (perm.Add === 0 && perm.Edit === 0) {
      toast("Page Add & Update Permission Denied !!!", true);
      flag = 0;
    } else if (perm.Add === 1 && perm.Edit === 1) {
      dirty = cleaned.filter((r) => r.EditMode === 1);
      if (!dirty.length) {
        toast("No Data Modified, Cannot Update !!!", true);
        flag = 0;
      }
    } else if (perm.Add === 1 && perm.Edit === 0) {
      dirty = cleaned.filter((r) => r.EditMode === 1 && r.Id == null);
      if (!dirty.length) {
        const any = cleaned.filter((r) => r.EditMode === 1);
        toast(any.length ? "Page Edit Permission Denied !!!" : "No Data Modified, Cannot Update !!!", true);
        flag = 0;
      }
    } else if (perm.Edit === 1 && perm.Add === 0) {
      dirty = cleaned.filter((r) => r.EditMode === 1 && r.Id != null);
      if (!dirty.length) {
        const any = cleaned.filter((r) => r.EditMode === 1);
        toast(any.length ? "Page Add Permission Denied !!!" : "No Data Modified, Cannot Update !!!", true);
        flag = 0;
      }
    }

    if (flag === 0) {
      addRow();
      return;
    }
    if (hasDuplicate(cleaned)) {
      toast("Duplicate Location Name found !!!", true);
      return;
    }

    const hasNew = dirty.some((r) => r.Id == null || r.Id === 0);
    const hasExisting = dirty.some((r) => r.Id != null && r.Id !== 0);
    let confirmMsg = "Do you want to save the Location details?";
    if (hasExisting && !hasNew) confirmMsg = "Do you want to update the Location details?";
    if (hasExisting && hasNew) confirmMsg = "Do you want to save & update the Location details?";

    const proceed = await confirm(confirmMsg);
    if (!proceed) {
      addRow();
      return;
    }

    setLoading(true);

    const payload = dirty.map((r) => ({
      Id: Number(r.Id || 0),
      LocationName: String(r.LocationName || "").trim(),
      Active: r.Active === true ? 1 : 0,
      EditMode: r.EditMode,
    }));

    const res = await CC.insertapi(
      CC.LocationInsert,
      payload,
      {
        Comid: String(parseInt(sess.Comid, 10)),
        MirrorTable: String(sess.MirrorTable),
        IdComList: String(sess.IdComList),
        ApiType: "0",
      }
    );

    setLoading(false);

    if (res._netErr) {
      toast(`${res.message}`, true);
      return;
    }

    if (res.IsSuccess) {
      dirtyIds.current.clear();
      toast(res.message || "Saved successfully!");

      const retField = sessionStorage.getItem("masterReturnField");
      if (retField) {
        sessionStorage.setItem("masterReturnValue", String(res.Data2 ?? res.Id ?? ""));
        sessionStorage.setItem("masterReturnName", dirty[0]?.LocationName || "");
        sessionStorage.removeItem("masterReturnField");
        setTimeout(() => navigate(-1), 800);
      } else {
        await loadData();
      }
    } else {
      toast(res.message || "Save failed", true);
    }
  }, [grid, sess, perm, navigate, loadData, gridemptycheck, hasDuplicate, addRow, toast, confirm]);

  const handleEsc = useCallback(() => {
    sessionStorage.removeItem("masterReturnField");
    sessionStorage.removeItem("masterPrefill");
    navigate(-1);
  }, [navigate]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.keyCode === 112) {
        e.preventDefault();
        handleSave();
      }
      if (e.keyCode === 27) {
        e.preventDefault();
        handleEsc();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleEsc]);

  const onCellKeyDown = useCallback((e, idx) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!String(grid[idx]?.LocationName || "").trim()) {
        toast("Enter Location Name !!!", true);
        return;
      }
      if (hasDuplicate(grid)) {
        toast("Duplicate Location Name !!!", true);
        return;
      }
      if (idx === grid.length - 1) addRow();
      else {
        setSelIdx(idx + 1);
        focusRow(idx + 1);
      }
    }
    if (e.key === "Delete" && e.ctrlKey) {
      e.preventDefault();
      deleteRow(idx);
    }
    if (e.key === "Delete" && !e.ctrlKey && !String(grid[idx]?.LocationName || "").trim()) {
      e.preventDefault();
      deleteRow(idx);
    }
  }, [grid, hasDuplicate, addRow, focusRow, deleteRow, toast]);

  if (!isAuthorized) return null;

  return (
    <div className="bm-shell">
      {ConfirmUI}

      <Topbar />

      <div className="bm-layout">
        <div className="bm-card">
          <div className="bm-card-header">
            <div className="bm-card-header-title">Location Master</div>
            <button type="button" className="bm-close-x" aria-label="Close" onClick={handleEsc}>X</button>
          </div>

          <div className="bm-card-body">
            <div className="bm-report-title">Location Master</div>

            <div className="bm-grid-wrap">
              <table className="bm-tbl">
                <colgroup>
                  <col className="lm-col-sno" />
                  <col className="lm-col-name" />
                  <col className="lm-col-active" />
                  <col className="lm-col-actions" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="lm-col-sno">S.No</th>
                    <th className="lm-col-name">Location Name</th>
                    <th className="lm-col-active lm-th-center">Active</th>
                    <th className="lm-col-actions"></th>
                  </tr>
                </thead>
                <tbody>
                  {grid.map((row, idx) => (
                    <tr
                      key={row._uid}
                      className={[
                        selIdx === idx ? "sel" : "",
                        !row.Active ? "inact" : "",
                        row.EditMode === 1 ? "mod" : "",
                      ].filter(Boolean).join(" ")}
                      onClick={() => selectRow(idx)}
                    >
                      <td className="sno">{idx + 1}</td>

                      {ALL_COLUMNS.map((col, colIdx) => (
                        <td key={col.field} className={col.field === "Active" ? "lm-td-center" : ""}>
                          {col.field === "Active" && (
                            <Toggle
                              value={!!row.Active}
                              editMode={row.EditMode}
                              inputRef={(el) => {
                                if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                                inputRefs.current[idx][colIdx] = el;
                              }}
                              onChange={(val) => row.EditMode === 1 && updateCell(idx, col.field, val)}
                              onFocus={() => selectRow(idx)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  CC.handleEnterNext(
                                    e,
                                    inputRefs,
                                    idx,
                                    colIdx,
                                    ALL_COLUMNS.length,
                                    grid.length,
                                    addRow,
                                    grid,
                                    rowValidator
                                  );
                                }
                              }}
                            />
                          )}

                          {col.field !== "Active" && (
                            <input
                              ref={(el) => {
                                if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                                inputRefs.current[idx][colIdx] = el;
                              }}
                              className="bm-cell-input"
                              value={row[col.field] || ""}
                              maxLength={100}
                              readOnly={row.EditMode === 0}
                              onChange={(e) =>
                                row.EditMode === 1 &&
                                CC.applyUppercase(e, (val) => updateCell(idx, col.field, val))
                              }
                              onKeyDown={(e) => row.EditMode === 1 && onCellKeyDown(e, idx)}
                              onFocus={() => selectRow(idx)}
                            />
                          )}
                        </td>
                      ))}

                      <td className="lm-actions-cell">
                        {row.Id && row.EditMode === 0 && (
                          <button
                            type="button"
                            className="bm-icon-btn edit"
                            title="Edit row"
                            onClick={(e) => {
                              e.stopPropagation();
                              enableEdit(idx);
                            }}
                          >
                            <Pencil size={15} />
                          </button>
                        )}

                        {row.Id && row.EditMode === 1 && (
                          <button
                            type="button"
                            className="bm-icon-btn edit active"
                            title="Editing..."
                          >
                            <Pencil size={15} />
                          </button>
                        )}

                        <button
                          type="button"
                          className="bm-icon-btn del"
                          title="Delete row"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteRow(idx);
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {grid.length === 0 && !loading && (
                <div className="bm-empty">No records. Press Add Row to add a location.</div>
              )}
            </div>

            <div className="bm-actions">
              <button className="mp-btn sv" onClick={handleSave} disabled={loading}>
                <Save size={16} />
                {loading ? "Loading..." : "F1 Save"}
              </button>
              <button className="mp-btn nw" onClick={addRow} disabled={loading}>
                <Plus size={16} />
                Add Row
              </button>
              <button className="mp-btn dl" onClick={handleEsc} disabled={loading}>
                <XCircle size={16} />
                Esc Cancel
              </button>
            </div>

            <div className="lm-hint">
              <kbd>Enter</kbd>
              <span>next row</span>
              <kbd>Ctrl+Delete</kbd>
              <span>delete row</span>
              <kbd>F1</kbd>
              <span>save</span>
              <kbd>Esc</kbd>
              <span>back</span>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="mp-loader-ov">
          <div className="mp-ldr-box">
            <div className="mp-spin" />
            <div className="mp-ldr-msg">Processing...</div>
          </div>
        </div>
      )}

      <MSG.ToastList toasts={toasts} />
    </div>
  );
}
