// ─────────────────────────────────────────────────────────────────────────────
//  CategoryMaster.jsx
//  Uses shared helpers from CashierCommon.jsx via wildcard import (CC.*)
//  Any new export added to CashierCommon is auto-available here as CC.xxx
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./MasterPage.css";

import Topbar from "../components/Topbar";

// ✅ Single wildcard import — all current & future CashierCommon exports
import * as CC from "./Common";


// ─── Toggle component (same as CashierMaster) ────────────────────────────────
const Toggle = ({ value, onChange, onKeyDown, inputRef, idx, editMode, onFocus }) => (
  <button
    ref={inputRef}
    onClick={() => onChange(!value)}
    onKeyDown={onKeyDown}
    onFocus={onFocus}
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


// ─── CategoryMaster ───────────────────────────────────────────────────────────
export default function CategoryMaster() {
  const navigate  = useNavigate();
  const inputRefs = useRef([]);
  const dirtyIds  = useRef(new Set());

  // ── Shared hooks from CashierCommon ─────────────────────────────────────────
  const { confirm, ConfirmUI } = CC.useConfirm();
  const { toast,   toasts    } = CC.useToast();

  // ── Permission / authorization state ────────────────────────────────────────
  const [perm, setPerm]             = useState({ View: 0, Add: 0, Edit: 0, Delete: 0 });
  const [isAuthorized, setIsAuthorized] = useState(false);

  // ── Component state ─────────────────────────────────────────────────────────
  const [grid,    setGrid]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [selIdx,  setSelIdx]  = useState(null);

  // ── Session / company variables ─────────────────────────────────────────────
  const [sess] = useState(() => {
    try {
      const main0     = (CC.getLocal("Mainsetting")    || [{}])[0] || {};
      const Comid     = CC.getStr("Comid")    || "1";
      const MComid    = CC.getStr("MComid")   || Comid;
      const IdComList = CC.getStr("IdComList") || Comid;
      const isCC      = !!main0.CommonCompany;
      return {
        Comid:        isCC ? MComid : Comid,
        MComid,
        IdComList,
        MirrorTable:  Number(CC.getStr("MirrorTableOnline") || "0"),
        CommonCompany: isCC,
        menudata:     (CC.getLocal("menulist") || []).filter(o => o.PageName === "Category"),
      };
    } catch {
      return { Comid: "1", MComid: "1", IdComList: "1", MirrorTable: 0, menudata: [] };
    }
  });

  // ─── Column config ────────────────────────────────────────────────────────
  const ALL_COLUMNS = [
    { field: "Cat_Name", label: "Category Name", width: 300, hidden: false },
    { field: "Active",   label: "Active",         width: 80,  hidden: false },
  ];
 
const redirectIfDualLogin = useCallback((res) => {
  if (res?._dualLogin || res?.redis === false) {
    alert("Already Login Another User Please Login Again!!!");
    navigate("/"); // Redirect to your specific login path
    return true;
  }
  return false;
}, [navigate]);
  // ── Column settings state (F12) ─────────────────────────────────────────────
  const [colSettings, setColSettings] = useState(() =>
    ALL_COLUMNS.map(c => ({ field: c.field, label: c.label, hidden: c.hidden, width: c.width }))
  );
  const [f12Open, setF12Open] = useState(false);

  // ── Derived visible columns ──────────────────────────────────────────────────
  const visibleColumns = ALL_COLUMNS.filter(c => {
    const cs = colSettings.find(s => s.field === c.field);
    return cs ? !cs.hidden : !c.hidden;
  }).map(c => {
    const cs = colSettings.find(s => s.field === c.field);
    return { ...c, width: cs?.width ?? c.width };
  });

  // ── rowValidator ─────────────────────────────────────────────────────────────
  const rowValidator = useCallback((row) => {
    return String(row.Cat_Name || "").trim().length > 0;
  }, []);

  // ── focusRow ─────────────────────────────────────────────────────────────────
  const focusRow = useCallback((idx, colIdx = 0) => {
    setTimeout(() => inputRefs.current[idx]?.[colIdx]?.focus(), 50);
  }, []);

  // ── selectRow — exits edit mode for unchanged saved rows ────────────────────
  const selectRow = useCallback((newIdx) => {
    setGrid(prev => prev.map((r, i) => {
      if (i !== newIdx && r.EditMode === 1 && r.Id && !dirtyIds.current.has(r.Id)) {
        return { ...r, EditMode: 0 };
      }
      return r;
    }));
    setSelIdx(newIdx);
  }, []);

  // ── enableEdit ───────────────────────────────────────────────────────────────
  const enableEdit = useCallback((idx) => {
    setGrid(prev =>
      prev.map((r, i) => i === idx ? { ...r, EditMode: 1 } : r)
    );
    selectRow(idx);
    focusRow(idx, 0);
  }, [focusRow, selectRow]);

  // ── makeNewRow ───────────────────────────────────────────────────────────────
  const makeNewRow = (prefill = "") => ({
    Id:       null,
    Cat_Name: prefill,
    Cat_GST:  "0.00",
    Active:   true,
    EditMode: 1,
    _uid:     CC.uid(),
  });

  // ── Permission guard — same logic as CashierMaster ──────────────────────────
  useEffect(() => {
    const menuStr = localStorage.getItem("menulist");

    if (!menuStr) {
      alert("Session Close Please Login !!!.");
      navigate("/Login/Index");
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

  // ── Save column settings to server ──────────────────────────────────────────
  const saveColSettings = useCallback(async (localSettings) => {
    setF12Open(false);
    setLoading(true);
    const payload = localSettings.map(s => ({
      filename: "Category",
      column:   s.field,
      Visible:  !s.hidden,
      Width:    s.width,
      Comid:    Number(sess.MComid),
    }));
    try {
      const res = await fetch(CC.VisibleColumnsUrl, {
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
  }, [sess.MComid, toast]);

  // ── Load column settings from server on startup ──────────────────────────────
  useEffect(() => {
    const loadColSettings = async () => {
      try {
        const url = `/Content/Appdata/Visible/${sess.MComid}/Category.json?t=${Date.now()}`;
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

  // ── F12 Column Settings Popup ────────────────────────────────────────────────
  function F12Popup() {
    const [local, setLocal] = useState(colSettings.map(s => ({ ...s })));

    return (
      <div style={{ position:"fixed", inset:0, background:"rgba(10,20,40,.5)",
                    zIndex:9000, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ background:"#fff", borderRadius:8, width:420,
                      maxHeight:"80vh", display:"flex", flexDirection:"column",
                      boxShadow:"0 16px 48px rgba(0,0,0,.3)", overflow:"hidden" }}>
          <div style={{ background:"#1a2e4a", color:"#fff", padding:"10px 16px",
                        fontSize:13, fontWeight:700, display:"flex",
                        alignItems:"center", justifyContent:"space-between" }}>
            <span>⚙ Column Settings (F12)</span>
            <button style={{ background:"none", border:"none", color:"#fff",
                             fontSize:17, cursor:"pointer" }}
                    onClick={() => setF12Open(false)}>✕</button>
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:12 }}>
            <table style={{ borderCollapse:"collapse", width:"100%" }}>
              <thead>
                <tr>
                  {["Column","Visible","Width (px)"].map(h => (
                    <th key={h} style={{ background:"#1a2e4a", color:"#fff",
                                         padding:"6px 10px", fontSize:11,
                                         fontWeight:600, textAlign:"left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {local.map(s => (
                  <tr key={s.field}>
                    <td style={{ padding:"5px 10px", fontSize:12, borderBottom:"1px solid #eaecf4" }}>
                      {s.label}
                    </td>
                    <td style={{ padding:"5px 10px", textAlign:"center", borderBottom:"1px solid #eaecf4" }}>
                      <input type="checkbox" checked={!s.hidden}
                        onChange={() => setLocal(p => p.map(x =>
                          x.field === s.field ? { ...x, hidden: !x.hidden } : x))}
                      />
                    </td>
                    <td style={{ padding:"5px 10px", borderBottom:"1px solid #eaecf4" }}>
                      <input type="number" min="40" max="500" value={s.width}
                        style={{ width:70, border:"1px solid #d4dbe8", borderRadius:3,
                                 padding:"2px 6px", fontSize:12, textAlign:"right" }}
                        onChange={e => setLocal(p => p.map(x =>
                          x.field === s.field ? { ...x, width: parseInt(e.target.value)||x.width } : x))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding:"10px 14px", display:"flex", gap:8,
                        justifyContent:"flex-end", borderTop:"1px solid #e5e7eb" }}>
            <button onClick={() => saveColSettings(local)}
                    style={{ background:"#1a2e4a", color:"#fff", border:"none",
                              borderRadius:4, padding:"6px 18px", fontSize:12,
                              fontWeight:700, cursor:"pointer" }}>💾 Save</button>
            <button onClick={() => setF12Open(false)}
                    style={{ background:"#fff", color:"#6b7280",
                              border:"1px solid #d1d5db", borderRadius:4,
                              padding:"6px 14px", fontSize:12, cursor:"pointer" }}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  // ── loadData ──────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const prefill = sessionStorage.getItem("masterPrefill") || "";
    setLoading(true);
    const res = await CC.api(
      CC.CategorySelect,
      null,
      {},
      { Comid: sess.Comid }
    );
    setLoading(false);
if (redirectIfDualLogin(res)) return;
    if (res._http404) { toast(`❌ 404 — ${CC.CategorySelect} not found`, true); }
    if (res._netErr)  { toast(`❌ Network: ${res.message}`, true); }

    const rawList = Array.isArray(res.data)  ? res.data
                  : Array.isArray(res.Data1) ? res.Data1
                  : [];

    const existing = rawList.map(r => ({
      ...r,
      Cat_GST:  parseFloat(r.Cat_GST ?? 0).toFixed(2),
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

  // ── addRow ────────────────────────────────────────────────────────────────────
  const addRow = useCallback(() => {
    setGrid(prev => {
      const next = [...prev, makeNewRow()];
      const idx  = next.length - 1;
      setSelIdx(idx);
      focusRow(idx);
      return next;
    });
  }, [focusRow]); // eslint-disable-line

  // ── updateCell ────────────────────────────────────────────────────────────────
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

  // ── deleteRow ─────────────────────────────────────────────────────────────────
  const deleteRow = useCallback(async (idx) => {
    if (!perm.Delete) { toast("❌ Page Delete Permission Denied !!!", true); return; }

    const row     = grid[idx];
    const isSaved = row.Id != null && row.Id !== 0;

    if (isSaved) {
      const ok = await confirm(`Do you want to delete "${row.Cat_Name}"?`);
      if (!ok) return;

      setLoading(true);
      const res = await CC.api(
        CC.CategoryDelete,
        null,
        {},
        { Id: Number(row.Id), Comid: Number(sess.Comid), MirrorTable: Number(sess.MirrorTable) }
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
  }, [grid, sess, perm, focusRow, toast, confirm]);

  // ── gridemptycheck ────────────────────────────────────────────────────────────
  const gridemptycheck = useCallback((g) => {
    let cleaned = [...g];
    if (cleaned.length > 1 && !String(cleaned[cleaned.length - 1].Cat_Name || "").trim())
      cleaned = cleaned.slice(0, -1);

    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i].EditMode === 1 && !String(cleaned[i].Cat_Name || "").trim()) {
        toast("❌ Enter All Category in the Grid !!!", true);
        setSelIdx(i);
        focusRow(i);
        return { ok: false, cleaned };
      }
    }
    return { ok: true, cleaned };
  }, [focusRow, toast]);

  // ── hasDuplicate ──────────────────────────────────────────────────────────────
  const hasDuplicate = useCallback((g) => {
    const names = g
      .filter(r => String(r.Cat_Name || "").trim())
      .map(r => String(r.Cat_Name).trim().toLowerCase());
    return new Set(names).size !== names.length;
  }, []);

  // ── handleSave ────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const { ok, cleaned } = gridemptycheck(grid);
    if (!ok) return;
    setGrid(cleaned);

    let dirty = [];
    let flag  = 1;

    // ── Permission checks (mirrors CashierMaster exactly) ──────────────────
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
    if (hasDuplicate(cleaned)) { toast("❌ Duplicate Category Name found !!!", true); return; }

    // ── Confirm message (smart: save / update / save & update) ────────────
    const hasNew      = dirty.some(r => r.Id == null || r.Id === 0);
    const hasExisting = dirty.some(r => r.Id != null && r.Id !== 0);
    let confirmMsg    = "Do you want to save the Category details?";
    if (hasExisting && !hasNew) confirmMsg = "Do you want to update the Category details?";
    if (hasExisting &&  hasNew) confirmMsg = "Do you want to save & update the Category details?";

    const proceed = await confirm(confirmMsg);
    if (!proceed) { addRow(); return; }

    setLoading(true);

    // ── Build API payload ──────────────────────────────────────────────────
    const payload = cleaned
      .filter(r => r.EditMode === 1)
      .map(r => ({
        Id:           Number(r.Id           || 0),
        Cat_Name:     r.Cat_Name            || "",
        Cat_GST:      parseFloat(r.Cat_GST      || 0),
        HSNCode:      r.HSNCode             || "",
        Cat_Discount: parseFloat(r.Cat_Discount || 0),
        CRMPoint:     parseFloat(r.CRMPoint     || 0),
        TouchShow:    Number(r.TouchShow    || 0),
        OnlineShow:   Number(r.OnlineShow   || 0),
        NStock:       Number(r.NStock       || 0),
        Active:       Number(r.Active       || 1),
        Bannerimg1:   r.Bannerimg1          || "",
        Bannerimg2:   r.Bannerimg2          || "",
        Bannerimg3:   r.Bannerimg3          || "",
        Bannerimg4:   r.Bannerimg4          || "",
      }));

    const res = await CC.insertapi(
      CC.CategoryInsert,
      payload,
      {
        Comid:       String(parseInt(sess.Comid)),
        MirrorTable: String(sess.MirrorTable),
        IdComList:   "",
        ApiType:     0,
      }
    );

    setLoading(false);
if (redirectIfDualLogin(res)) return;
    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

    if (res.IsSuccess) {
      dirtyIds.current.clear();
      toast("✅ " + (res.message || "Saved successfully!"));

      const retField = sessionStorage.getItem("masterReturnField");
      if (retField) {
        sessionStorage.setItem("masterReturnValue", String(res.Data2 ?? res.Id ?? ""));
        sessionStorage.setItem("masterReturnName",  dirty[0]?.Cat_Name || "");
        sessionStorage.removeItem("masterReturnField");
        setTimeout(() => navigate(-1), 800);
      } else {
        await loadData();
      }
    } else {
      toast(`❌ ${res.message || "Save failed"}`, true);
    }
  }, [grid, sess, perm, navigate, loadData, gridemptycheck, hasDuplicate, addRow, toast, confirm]);

  // ── handleEsc ─────────────────────────────────────────────────────────────────
  const handleEsc = useCallback(() => {
    sessionStorage.removeItem("masterReturnField");
    sessionStorage.removeItem("masterPrefill");
    navigate(-1);
  }, [navigate]);

  // ── Global keyboard shortcuts: F1 = Save | Esc = Back | F12 = Columns ───────
  useEffect(() => {
    const onKey = e => {
      if (e.keyCode === 112) { e.preventDefault(); handleSave(); }
      if (e.keyCode === 27)  { e.preventDefault(); handleEsc();  }
      if (e.keyCode === 123) { e.preventDefault(); setF12Open(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleEsc]);

  // ── Row-level keyboard navigation ─────────────────────────────────────────────
  const onCellKeyDown = useCallback((e, idx) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!String(grid[idx]?.Cat_Name || "").trim()) { toast("❌ Enter Category Name !!!", true); return; }
      if (hasDuplicate(grid))                        { toast("❌ Duplicate Category Name !!!", true); return; }
      if (idx === grid.length - 1) addRow();
      else { setSelIdx(idx + 1); focusRow(idx + 1); }
    }
    if (e.key === "Delete" && e.ctrlKey) {
      e.preventDefault();
      deleteRow(idx);
    }
    if (e.key === "Delete" && !e.ctrlKey && !String(grid[idx]?.Cat_Name || "").trim()) {
      e.preventDefault();
      deleteRow(idx);
    }
  }, [grid, hasDuplicate, addRow, focusRow, deleteRow, toast]);

  // ── Guard: don't render until authorized ────────────────────────────────────
  if (!isAuthorized) return null;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="mp-wrap">

      {/* Confirm Dialog — rendered by CC.useConfirm() */}
      {ConfirmUI}
      {f12Open && <F12Popup />}
      <Topbar />

      {/* ── Header ── */}
      <div className="mp-hdr">
        <div className="mp-hdr-left">
          <div className="mp-icon">C</div>
          <div>
            <div className="mp-title">Category Master</div>
            <div className="mp-sub">Co: {sess.Comid} — Manage category records</div>
          </div>
        </div>
        <button className="mp-back" onClick={handleEsc}>← Back</button>
      </div>

      <div className="mp-body">

        {/* ── Grid ── */}
        <div className="mp-grid-wrap">
          <table className="mp-tbl">
            <thead>
              <tr>
                <th style={{ width: 50 }}>S.No</th>
                {visibleColumns.map(c => (
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
                          onFocus={() => selectRow(idx)}
                          onChange={val => row.EditMode === 1 && updateCell(idx, col.field, val)}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              CC.handleEnterNext(
                                e, inputRefs, idx, colIdx,
                                visibleColumns.length, grid.length,
                                addRow, grid, rowValidator
                              );
                            }
                          }}
                        />
                      )}

                      {/* ── Text input for all other fields ── */}
                      {col.field !== "Active" && (
                        <input
                          ref={el => {
                            if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                            inputRefs.current[idx][colIdx] = el;
                          }}
                          className="mp-cell-input"
                          value={row[col.field] || ""}
                          maxLength={col.maxLen || 100}
                          readOnly={row.EditMode === 0}
                          onChange={e =>
                            row.EditMode === 1 &&
                            CC.applyUppercase(e, val => updateCell(idx, col.field, val))
                          }
                          onKeyDown={e => {
                            if (row.EditMode === 1) {
                              // Use custom Enter handler for single-col grid
                              onCellKeyDown(e, idx);
                            }
                          }}
                          onFocus={() => selectRow(idx)}
                          style={{
                            background:   row.EditMode === 0 ? "transparent" : "#fff",
                            border:       row.EditMode === 0 ? "none"        : "1px solid #93c5fd",
                            cursor:       row.EditMode === 0 ? "default"     : "text",
                            color:        row.EditMode === 0 ? "var(--color-text-secondary)" : "#1e293b",
                            boxShadow:    row.EditMode === 0 ? "none"        : "0 0 0 2px rgba(59,130,246,0.15)",
                            borderRadius: row.EditMode === 1 ? "4px"         : "0",
                            padding:      row.EditMode === 0 ? "0"           : undefined,
                          }}
                        />
                      )}
                    </td>
                  ))}

                  {/* ── Action buttons: Edit + Delete ── */}
                  <td style={{ whiteSpace: "nowrap" }}>
                    {/* Edit button — only show when row is saved and in view mode */}
                    {row.Id && row.EditMode === 0 && (
                      <button
                        className="mp-edit-btn"
                        title="Edit row"
                        onClick={e => { e.stopPropagation(); enableEdit(idx); }}
                      >
                        ✏️
                      </button>
                    )}
                    {/* Editing indicator */}
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
                    >🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {grid.length === 0 && !loading && (
            <div className="mp-empty">No records. Press ➕ to add a category.</div>
          )}
        </div>

        {/* ── Toolbar ── */}
        <div className="mp-toolbar">
          <button className="mp-btn sv" onClick={handleSave} disabled={loading}>💾 F1 Save</button>
          <button className="mp-btn nw" onClick={addRow}     disabled={loading}>➕ Add Row</button>
          <button className="mp-btn"    onClick={() => setF12Open(true)} title="Column Settings">⚙ F12 Columns</button>
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
