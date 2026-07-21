// ─────────────────────────────────────────────────────────────────────────────
//  CardMaster.jsx  (revised)
//
//  Changes from original:
//   1. EditMode per row (0 = view / 1 = edit) — mirrors DepartmentMaster
//   2. Edit ✏️ button — same pattern as DepartmentMaster (saved rows only)
//   3. dirtyIds ref — tracks rows the user actually typed in
//   4. inputRefs 2-D array (row × col) + CC.handleEnterNext for Enter-key nav
//   5. Save payload mapped correctly:
//        Active → 0 / 1 integer
//        Scharge → parseFloat, trimmed
//        All string fields trimmed
//   6. Row-level readOnly / disabled in view mode
//   7. Table rows use sel / mod / inact CSS classes (MasterPage.css)
//
//  VISUAL REDESIGN NOTE:
//  Only the presentational layer (JSX structure, className usage, and the two
//  cosmetic hex colors on the Active toggle / editing indicator) was changed
//  to match the "bm-*" card design system used in BrandMaster.jsx (blue
//  #1a56db card border + gradient header, rounded card, bm-btn pill buttons,
//  bm-cell-input focus glow — reused for both <input> and <select> cells,
//  fixed-height scrollable grid, dark-navy table header, etc.). The bm-*
//  classes live in MasterPage.css (already imported below) — no local
//  <style> block needed here, same as BrandMaster.jsx.
//  All state, effects, handlers, API calls, validation (including the
//  inline Card Name duplicate-check-on-Enter), variable names and control
//  flow are 100% unchanged from the original CardMaster.jsx.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Save, Plus, XCircle, Pencil, Trash2 } from "lucide-react";
import "./MasterPage.css";

import Topbar from "../components/Topbar";
import * as CC  from "../components/Common";
import * as MSG from "../components/Messages";

// ─── Constants ────────────────────────────────────────────────────────────────
const CARD_TYPE_LIST = [
  { value: "CARD",      label: "CARD"      },
  { value: "UPI",       label: "UPI"       },
  { value: "CRMPOINTS", label: "CRMPOINTS" },
];

// Column order used by CC.handleEnterNext — must match render order
const ALL_COLUMNS = [
  { field: "CardName",  label: "Card Name",  width: 160 },
  { field: "CardType",  label: "Card Type",  width: 140 },
  { field: "Scharge",   label: "Scharge",    width: 110 },
  { field: "Bankrefid", label: "Bank Name",  width: 180 },
  { field: "Active",    label: "Active",     width: 80  },
];

const TOTAL_COLS = ALL_COLUMNS.length;

// ─── Toggle component (Active column — same as DepartmentMaster) ──────────────
//  NOTE: only the two hex color values below were changed (#16a34a -> #1e7e34,
//  #15803d -> #166534) to line up with BrandMaster's "save" green accent.
//  Behavior, props and logic are untouched.
function Toggle({ value, onChange, inputRef, editMode, onFocus, onKeyDown }) {
  return (
    <button
      ref={inputRef}
      onClick={() => editMode === 1 && onChange(!value)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      title={value ? "Active" : "Inactive"}
      style={{
        width: 32, height: 18, borderRadius: 9, border: "none",
        cursor:       editMode === 0 ? "default"  : "pointer",
        background:   value          ? "#1e7e34"  : "#cbd5e1",
        position: "relative", transition: "background 0.18s ease",
        outline: "none", display: "inline-flex", alignItems: "center",
        flexShrink: 0, padding: 0,
        boxShadow: value
          ? "inset 0 0 0 1px #166534"
          : "inset 0 0 0 1px #b0bec5",
        opacity:       editMode === 0 ? 0.5  : 1,
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

// ─── Empty row factory ────────────────────────────────────────────────────────
const makeNewRow = (prefill = "") => ({
  _uid:      CC.uid(),
  Id:        null,
  CardName:  prefill,
  CardType:  "",
  Scharge:   "0.00",
  BankName:  "",
  Bankrefid: "",
  Active:    true,
  EditMode:  1,          // new rows start in edit mode
});

// ─── Request-duplicate guard ──────────────────────────────────────────────────
class RequestController {
  constructor() { this._running = false; }
  isRunning() { return this._running; }
  start()     { this._running = true;  }
  end()       { this._running = false; }
}

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function CardMaster() {
  const navigate  = useNavigate();
  // inputRefs[rowIdx][colIdx] — matches ALL_COLUMNS order
  const inputRefs = useRef([]);
  const dirtyIds  = useRef(new Set());
  const reqCtrl   = useRef(new RequestController());

  // ── MSG hooks ──────────────────────────────────────────────────────────────
  const { confirm, ConfirmUI } = MSG.useConfirm();
  const { toast,   toasts    } = MSG.useToast();

  // ── Permission / authorization state ──────────────────────────────────────
  const [perm,         setPerm        ] = useState({ View: 0, Add: 0, Edit: 0, Delete: 0 });
  const [isAuthorized, setIsAuthorized] = useState(false);

  // ── Session ────────────────────────────────────────────────────────────────
  const [sess] = useState(() => {
    try {
      const main0  = (CC.getLocal("Mainsetting") || [{}])[0] || {};
      const Comid  = CC.getStr("Comid")  || "1";
      const MComid = CC.getStr("MComid") || Comid;
      const isCC   = !!main0.CommonCompany;
      return {
        Comid:       isCC ? MComid : Comid,
        MComid,
        IdComList:   "",
        MirrorTable: Number(localStorage.getItem("MirrorTableOnline") || "0"),
      };
    } catch {
      return { Comid: "1", MComid: "1", IdComList: "", MirrorTable: 0 };
    }
  });

  // ── Component state ────────────────────────────────────────────────────────
  const [grid,     setGrid    ] = useState([]);
  const [bankList, setBankList] = useState([]);
  const [loading,  setLoading ] = useState(false);
  const [selIdx,   setSelIdx  ] = useState(null);

  // ── Permission guard ────────────────────────────────────────────────────────
  useEffect(() => {
    const menuStr = localStorage.getItem("menulist");
    if (!menuStr) {
      alert("Session Close Please Login !!!.");
      navigate("/Login/Index");
      return;
    }
    const menulist = JSON.parse(menuStr);
    const menudata = menulist.filter(o => o.PageName === "Card Master");
    if (!menudata.length || menudata[0].View === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => navigate("/Home"), 3000);
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

  // ── focusRow ───────────────────────────────────────────────────────────────
  const focusRow = useCallback((idx, colIdx = 0) => {
    setTimeout(() => inputRefs.current[idx]?.[colIdx]?.focus(), 50);
  }, []);

  // ── selectRow — same pattern as DepartmentMaster ───────────────────────────
  const selectRow = useCallback((newIdx) => {
    setGrid(prev => prev.map((r, i) => {
      if (i !== newIdx && r.EditMode === 1 && r.Id && !dirtyIds.current.has(r.Id)) {
        return { ...r, EditMode: 0 };
      }
      return r;
    }));
    setSelIdx(newIdx);
  }, []);

  // ── rowValidator (required by CC.handleEnterNext) ─────────────────────────
  const rowValidator = useCallback((row) =>
    String(row.CardName || "").trim().length > 0 && String(row.CardType || "").trim().length > 0
  , []);

  // ── loadBanks ──────────────────────────────────────────────────────────────
  const loadBanks = useCallback(async () => {
    try {
      const res = await CC.api(CC.BankAllSelect, null, {}, { Comid: sess.Comid });
      if (redirectIfDualLogin(res)) return;
      const list = Array.isArray(res.data)  ? res.data
                 : Array.isArray(res.Data1) ? res.Data1
                 : [];
      setBankList(list);
    } catch (err) {
      console.error("loadBanks:", err);
    }
  }, [sess.Comid]);

  // ── loadData ───────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await CC.api(CC.SelectCardMaster, null, {}, { Comid: sess.Comid });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    if (res._http404) { toast(`❌ 404 — SelectCardMaster not found`, true); return; }
    if (res._netErr)  { toast(`❌ Network: ${res.message}`, true); return; }

    const rawList = Array.isArray(res.data)  ? res.data
                  : Array.isArray(res.Data1) ? res.Data1
                  : [];

    const existing = rawList.map(r => ({
      _uid:      CC.uid(),
      Id:        r.Id        ?? null,
      CardName:  r.CardName  ?? "",
      CardType:  r.CardType  ?? "",
      Scharge:   parseFloat(r.Scharge  || 0).toFixed(2),
      BankName:  r.BankName  ?? "",
      Bankrefid: r.Bankrefid != null ? String(r.Bankrefid) : "",
      Active:    r.Active === true || r.Active === 1,
      EditMode:  0,          // saved rows start in view mode
    }));

    const prefill = sessionStorage.getItem("masterPrefill") || "";
    const blank   = makeNewRow(prefill);
    sessionStorage.removeItem("masterPrefill");

    setGrid([...existing, blank]);
    const newIdx = existing.length;
    setSelIdx(newIdx);
    focusRow(newIdx);
  }, [sess.Comid, toast, focusRow]);

  // ── Boot ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isAuthorized) {
      loadBanks();
      loadData();
    }
  }, [isAuthorized, loadBanks, loadData]);
 
const redirectIfDualLogin = useCallback((res) => {
  if (res?._dualLogin || res?.redis === false) {
    alert("Already Login Another User Please Login Again!!!");
    navigate("/"); // Redirect to your specific login path
    return true;
  }
  return false;
}, [navigate]);
  // ── addRow ─────────────────────────────────────────────────────────────────
  const addRow = useCallback(() => {
    setGrid(prev => {
      const next = [...prev, makeNewRow()];
      const idx  = next.length - 1;
      setSelIdx(idx);
      focusRow(idx, 0);
      return next;
    });
  }, [focusRow]);

  // ── updateCell — marks row dirty if it has a saved Id ─────────────────────
  const updateCell = useCallback((idx, field, value) => {
    setGrid(prev =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        if (r.Id) dirtyIds.current.add(r.Id);
        return { ...r, [field]: value, EditMode: 1 };
      })
    );
  }, []);

  // ── enableEdit — pencil button, mirrors DepartmentMaster ──────────────────
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
    const isSaved = row.Id != null;

    if (isSaved) {
      const ok = await confirm(`Do you want to delete "${row.CardName}"?`);
      if (!ok) return;

      setLoading(true);
      const res = await CC.deleteapi(
        `${CC.DeleteCardMaster}?Id=${row.Id}&Comid=${sess.Comid}&MirrorTable=${sess.MirrorTable}`,
        null,
        { Id: row.Id, Comid: sess.Comid, MirrorTable: sess.MirrorTable }
      );
      setLoading(false);
if (redirectIfDualLogin(res)) return;
      if (res.IsSuccess || res.ok) {
        toast("✅ " + (res.Message || res.message || "Deleted"));
        setGrid(prev => {
          const next = prev.filter((_, i) => i !== idx);
          const sel  = Math.max(0, next.length - 1);
          setSelIdx(sel);
          focusRow(sel);
          return next.length ? next : [makeNewRow()];
        });
      } else {
        toast(`❌ ${res.Message || res.message || "Delete failed"}`, true);
      }
    } else {
      setGrid(prev => {
        const next = prev.filter((_, i) => i !== idx);
        const sel  = Math.max(0, next.length - 1);
        setSelIdx(sel);
        focusRow(sel);
        return next.length ? next : [makeNewRow()];
      });
    }
  }, [grid, sess, perm, focusRow, toast, confirm]);

  // ── gridemptycheck ─────────────────────────────────────────────────────────
  const gridemptycheck = useCallback((g) => {
    let cleaned = [...g];

    // Remove trailing blank new row
    const last = cleaned[cleaned.length - 1];
    if (
      cleaned.length > 1 &&
      !String(last.CardName || "").trim() &&
      !last.Id
    ) {
      cleaned = cleaned.slice(0, -1);
    }

    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i].EditMode !== 1) continue;
      if (!String(cleaned[i].CardName || "").trim()) {
        toast("❌ Enter All CardName in the Grid !!!", true);
        setSelIdx(i);
        focusRow(i, 0);
        return { ok: false, cleaned };
      }
      if (!String(cleaned[i].CardType || "").trim()) {
        toast("❌ Select All CardType in the Grid !!!", true);
        setSelIdx(i);
        focusRow(i, 1); // colIdx 1 = CardType
        return { ok: false, cleaned };
      }
    }
    return { ok: true, cleaned };
  }, [focusRow, toast]);

  // ── hasDuplicate ───────────────────────────────────────────────────────────
  const hasDuplicate = useCallback((g) => {
    const names = g
      .filter(r => String(r.CardName || "").trim())
      .map(r => String(r.CardName).trim().toLowerCase());
    return new Set(names).size !== names.length;
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
    if (hasDuplicate(cleaned)) { toast("❌ Duplicate Card Name found !!!", true); return; }
    if (reqCtrl.current.isRunning()) return;

    // Smart confirm message
    const hasNew      = dirty.some(r => r.Id == null || r.Id === 0);
    const hasExisting = dirty.some(r => r.Id != null && r.Id !== 0);
    let confirmMsg    = "Do you want to save the Card details?";
    if (hasExisting && !hasNew) confirmMsg = "Do you want to update the Card details?";
    if (hasExisting &&  hasNew) confirmMsg = "Do you want to save & update the Card details?";

    const proceed = await confirm(confirmMsg);
    if (!proceed) { addRow(); return; }

    reqCtrl.current.start();
    setLoading(true);

    // ── Map to correct payload shape ──────────────────────────────────────────
    const payload = dirty.map(r => ({
      Id:        Number(r.Id || 0),
      CardName:  String(r.CardName  || "").trim(),
      CardType:  String(r.CardType  || "").trim(),
      Scharge:   parseFloat(r.Scharge || "0") || 0,
      BankName:  String(r.BankName  || "").trim(),
      Bankrefid: Number(r.Bankrefid || 0),
      Active:    r.Active === true ? 1 : 0,
      EditMode:  r.EditMode,
    }));

    const res = await CC.insertapi(
      CC.InsertCardMaster,
      payload,
      {
        Comid:       String(parseInt(sess.Comid)),
        MirrorTable: String(sess.MirrorTable),
        IdComList:   String(sess.IdComList || ""),
        ApiType:"1",
      }
    );

    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    reqCtrl.current.end();

    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

    if (res.IsSuccess || res.ok) {
      dirtyIds.current.clear();
      toast("✅ " + (res.Message || res.message || "Saved successfully!"));
      await loadData();
    } else {
      toast(`❌ ${res.Message || res.message || "Save failed"}`, true);
    }
  }, [grid, sess, perm, loadData, gridemptycheck, hasDuplicate, addRow, toast, confirm]);

  // ── handleEsc ──────────────────────────────────────────────────────────────
  const handleEsc = useCallback(() => {
    sessionStorage.removeItem("masterReturnField");
    sessionStorage.removeItem("masterPrefill");
    navigate(-1);
  }, [navigate]);

  // ── Global keyboard shortcuts: F1 = Save | Esc = Back ─────────────────────
  useEffect(() => {
    const onKey = e => {
      if (e.keyCode === 112) { e.preventDefault(); handleSave(); }
      if (e.keyCode === 27)  { e.preventDefault(); handleEsc();  }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleEsc]);

  // ── Block render until authorized ─────────────────────────────────────────
  if (!isAuthorized) return null;

  // ─────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="bm-shell">

      {ConfirmUI}
      <Topbar />

      <div className="bm-layout">
        <div className="bm-card">
          <div className="bm-card-header">
            <div className="bm-card-header-title">Card Master</div>
            <button type="button" className="bm-close-x" aria-label="Close" onClick={handleEsc}>✕</button>
          </div>

          <div className="bm-card-body">
            <div className="bm-report-title">Card Master</div>

            {/* ── Grid ── */}
            <div className="bm-grid-wrap">
              <table className="bm-tbl">
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>S.No</th>
                    <th style={{ width: 160 }}>Card Name</th>
                    <th style={{ width: 140 }}>Card Type</th>
                    <th style={{ width: 110, textAlign: "right" }}>Scharge</th>
                    <th style={{ width: 180 }}>Bank Name</th>
                    <th style={{ width: 80,  textAlign: "center" }}>Active</th>
                    {/* Edit + Delete column */}
                    <th style={{ width: 64 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {grid.map((row, idx) => (
                    <tr
                      key={row._uid}
                      className={[
                        selIdx === idx     ? "sel"  : "",
                        !row.Active        ? "inact" : "",
                        row.EditMode === 1 ? "mod"   : "",
                      ].filter(Boolean).join(" ")}
                      onClick={() => selectRow(idx)}
                    >
                      {/* S.No */}
                      <td className="sno">{idx + 1}</td>

                      {/* ── Card Name ── */}
                      <td>
                        <input
                          ref={el => {
                            if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                            inputRefs.current[idx][0] = el;
                          }}
                          className="bm-cell-input"
                          value={row.CardName}
                          maxLength={100}
                          readOnly={row.EditMode === 0}
                          onChange={e =>
                            row.EditMode === 1 &&
                            CC.applyUppercase(e, val => updateCell(idx, "CardName", val))
                          }
                          onKeyDown={e => {
                            if (row.EditMode === 0) return;
                            // Duplicate check before advancing
                            if (e.key === "Enter") {
                              if (!String(row.CardName || "").trim()) {
                                e.preventDefault();
                                toast("❌ Enter Card Name !!!", true);
                                return;
                              }
                              const dup = grid.some(
                                (r, i) =>
                                  i !== idx &&
                                  r.CardName?.trim().toLowerCase() ===
                                    row.CardName.trim().toLowerCase()
                              );
                              if (dup) {
                                e.preventDefault();
                                toast("❌ Duplicate Card Name !!!", true);
                                return;
                              }
                            }
                            CC.handleEnterNext(
                              e, inputRefs, idx, 0,
                              TOTAL_COLS, grid.length,
                              addRow, grid, rowValidator
                            );
                          }}
                          onFocus={() => selectRow(idx)}
                        />
                      </td>

                      {/* ── Card Type ── */}
                      <td>
                        <select
                          ref={el => {
                            if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                            inputRefs.current[idx][1] = el;
                          }}
                          className="bm-cell-input"
                          value={row.CardType}
                          disabled={row.EditMode === 0}
                          onChange={e => updateCell(idx, "CardType", e.target.value)}
                          onKeyDown={e =>
                            row.EditMode === 1 &&
                            CC.handleEnterNext(
                              e, inputRefs, idx, 1,
                              TOTAL_COLS, grid.length,
                              addRow, grid, rowValidator
                            )
                          }
                          onFocus={() => selectRow(idx)}
                        >
                          <option value="">— Select —</option>
                          {CARD_TYPE_LIST.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </td>

                      {/* ── Scharge ── */}
                      <td>
                        <input
                          ref={el => {
                            if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                            inputRefs.current[idx][2] = el;
                          }}
                          className="bm-cell-input"
                          value={row.Scharge}
                          readOnly={row.EditMode === 0}
                          onChange={e =>
                            row.EditMode === 1 &&
                            updateCell(idx, "Scharge", e.target.value)
                          }
                          onBlur={() => {
                            if (row.EditMode === 1)
                              updateCell(idx, "Scharge", (parseFloat(row.Scharge) || 0).toFixed(2));
                          }}
                          onKeyDown={e =>
                            row.EditMode === 1 &&
                            CC.handleEnterNext(
                              e, inputRefs, idx, 2,
                              TOTAL_COLS, grid.length,
                              addRow, grid, rowValidator
                            )
                          }
                          onFocus={() => selectRow(idx)}
                          style={{ textAlign: "right" }}
                        />
                      </td>

                      {/* ── Bank Name (combo) ── */}
                      <td>
                        <select
                          ref={el => {
                            if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                            inputRefs.current[idx][3] = el;
                          }}
                          className="bm-cell-input"
                          value={row.Bankrefid}
                          disabled={row.EditMode === 0}
                          onChange={e => {
                            const val   = e.target.value;
                            const found = bankList.find(o => String(o.Id) === val);
                            updateCell(idx, "Bankrefid", val);
                            if (found) updateCell(idx, "BankName", found.AccountName);
                          }}
                          onKeyDown={e =>
                            row.EditMode === 1 &&
                            CC.handleEnterNext(
                              e, inputRefs, idx, 3,
                              TOTAL_COLS, grid.length,
                              addRow, grid, rowValidator
                            )
                          }
                          onFocus={() => selectRow(idx)}
                        >
                          <option value="">— Select —</option>
                          {bankList.map(o => (
                            <option key={o.Id} value={String(o.Id)}>{o.AccountName}</option>
                          ))}
                        </select>
                      </td>

                      {/* ── Active Toggle ── */}
                      <td style={{ textAlign: "center" }}>
                        <Toggle
                          value={!!row.Active}
                          editMode={row.EditMode}
                          inputRef={el => {
                            if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                            inputRefs.current[idx][4] = el;
                          }}
                          onChange={val => row.EditMode === 1 && updateCell(idx, "Active", val)}
                          onFocus={() => selectRow(idx)}
                          onKeyDown={e =>
                            row.EditMode === 1 &&
                            CC.handleEnterNext(
                              e, inputRefs, idx, 4,
                              TOTAL_COLS, grid.length,
                              addRow, grid, rowValidator
                            )
                          }
                        />
                      </td>

                      {/* ── Edit + Delete buttons ── */}
                      <td style={{ whiteSpace: "nowrap", textAlign: "center" }}>
                        {/* Edit button: only on saved rows in view mode */}
                        {row.Id && row.EditMode === 0 && (
                          <button
                            className="bm-icon-btn edit"
                            title="Edit row"
                            onClick={e => { e.stopPropagation(); enableEdit(idx); }}
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                        {/* Editing indicator: saved row currently in edit mode */}
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
                <div className="bm-empty">No records. Press ➕ Add Row to add a card.</div>
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

      <MSG.ToastList toasts={toasts} />
    </div>
  );
}