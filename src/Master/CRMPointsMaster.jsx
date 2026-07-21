// ─────────────────────────────────────────────────────────────────────────────
//  CRMPointsMaster.jsx
//
//  Imports:
//   • CC.* from Common.jsx   — API helpers, session, uid, applyUppercase, etc.
//   • MSG.* from Messages.jsx — useConfirm, useToast, ToastList
//
//  Features mirrored from SalesManMaster:
//   • Permission guard via useEffect + isAuthorized state (View=0 → redirect)
//   • EditMode per row (0 = view / 1 = edit)
//   • Edit ✏️ button — shows only on saved rows; click → enableEdit()
//   • dirtyIds ref — tracks rows actually typed in (avoids flipping saved rows to
//     edit mode on a mere click)
//   • selectRow() — exits edit mode on other rows if not dirty
//   • Dual-login guard — any central 406 / res.redis===false → navigate("/")
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Save, Plus, XCircle, Pencil, Trash2 } from "lucide-react";
import "./MasterPage.css";
import Topbar from "../components/Topbar";

import * as CC from "../components/Common";
import * as MSG from "../components/Messages";

// ─── Column config ────────────────────────────────────────────────────────────
const ALL_COLUMNS = [
  { field: "CustomerCardTypeRefid", label: "CustomerCardType", width: 200 },
  { field: "BillAmount",            label: "Bill Amount",      width: 120 },
  { field: "Points",                label: "Points",           width: 120 },
  { field: "Value",                 label: "Value",            width: 120 },
  { field: "Active",                label: "Active",           width: 90  },
];

export default function CRMPointsMaster() {
  const navigate = useNavigate();
  const inputRefs = useRef([]);
  const dirtyIds = useRef(new Set());

  // ── MSG hooks ──────────────────────────────────────────────────────────────
  const { confirm, ConfirmUI } = MSG.useConfirm();
  const { toast,   toasts    } = MSG.useToast();

  // ── Permission / authorization state ──────────────────────────────────────
  const [perm,         setPerm        ] = useState({ View: 0, Add: 0, Edit: 0, Delete: 0 });
  const [isAuthorized, setIsAuthorized] = useState(false);

  // ── Component state ───────────────────────────────────────────────────────
  const [grid,         setGrid        ] = useState([]);
  const [cardTypeList, setCardTypeList] = useState([]);
  const [openComboIdx, setOpenComboIdx] = useState(null);
  const [loading,      setLoading     ] = useState(false);
  const [selIdx,       setSelIdx      ] = useState(null);

  // ── Session ────────────────────────────────────────────────────────────────
  const [sess] = useState(() => {
    try {
      return CC.buildSession("Customer");
    } catch {
      return { Comid: "1", MComid: "1", IdComList: "1", MirrorTable: "0", menudata: [] };
    }
  });

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
    const menudata = menulist.filter(obj => obj.PageName === "Customer");

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

    sessionStorage.setItem("POPStatus", "OFF");
    setIsAuthorized(true);
  }, [navigate]);

  // Close combobox dropdown on outside click
  useEffect(() => {
    const handler = () => {
      if (openComboIdx !== null) setOpenComboIdx(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openComboIdx]);

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
  const makeNewRow = () => ({
    Id:                    null,
    CustomerCardTypeRefid: null,
    TypeName:              "",
    BillAmount:            "0.00",
    Points:                "0.00",
    Value:                 "0.00",
    Active:                true,
    EditMode:              1,
    _uid:                  CC.uid(),
  });

  // ── rowValidator ──────────────────────────────────────────────────────────
  const rowValidator = useCallback((row) =>
    row.CustomerCardTypeRefid != null && row.CustomerCardTypeRefid !== ""
  , []);

  // ── loadData ───────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);

    const cardTypesRes = await CC.api(CC.CustomerCardTypeSelect, null, {}, { Comid: sess.Comid });
    const cardTypes = cardTypesRes.IsSuccess || cardTypesRes.ok ? (cardTypesRes.Data1 ?? cardTypesRes.data ?? []) : [];
    setCardTypeList(cardTypes);

    const res = await CC.api(
      CC.CRMPointsSelect,
      null,
      {},
      { Comid: sess.Comid }
    );
    setLoading(false);

    if (redirectIfDualLogin(res)) return;

    if (res._http404) { toast(`❌ 404 — ${CC.CRMPointsSelect} not found`, true); }
    if (res._netErr)  { toast(`❌ Network: ${res.message}`, true); }

    if (res.ok === true || res.IsSuccess === true) {
      const objlist = Array.isArray(res.data) ? res.data : Array.isArray(res.Data1) ? res.Data1 : [];

      const loaded = objlist.map(obj => ({
        Id:                    obj.Id,
        CustomerCardTypeRefid: obj.CustomerCardTypeRefid ?? null,
        TypeName:              obj.TypeName ?? "",
        BillAmount:            parseFloat(obj.BillAmount ?? 0).toFixed(2),
        Points:                parseFloat(obj.Points    ?? 0).toFixed(2),
        Value:                 parseFloat(obj.Value     ?? 0).toFixed(2),
        Active:                obj.Active === true || obj.Active === 1,
        EditMode:              0,
        _uid:                  CC.uid(),
      }));

      const blank = makeNewRow();
      
      const popVal = sessionStorage.getItem("POPValue");
      if (popVal && popVal !== "") {
        blank.CustomerCardTypeRefid = Number(popVal);
        const foundCard = cardTypes.find(c => Number(c.Id) === Number(popVal));
        if (foundCard) blank.TypeName = foundCard.TypeName;
        sessionStorage.removeItem("POPValue");
      }

      setGrid([...loaded, blank]);
      setSelIdx(loaded.length);
      focusRow(loaded.length, 0);
    } else {
      toast(`❌ ${res.message || "Failed to load CRM Points"}`, true);
    }
  }, [sess.Comid, toast, focusRow, redirectIfDualLogin]);

  useEffect(() => {
    if (isAuthorized) loadData();
  }, [isAuthorized, loadData]);

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
      const cardLabel = row.TypeName || CC.NullToString(row.CustomerCardTypeRefid);
      const ok = await confirm(`Wish to Delete the Record ${cardLabel}?`);
      if (!ok) return;

      setLoading(true);
      const url =
        `${CC.CRMPointsDelete}` +
        `?Id=${row.Id}` +
        `&Comid=${Number(sess.Comid)}` +
        `&MirrorTable=${Number(sess.MirrorTable)}`;
      
      const res = await CC.deleteapi(url, null, { IdComList: "" });
      setLoading(false);

      if (redirectIfDualLogin(res)) return;

      if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

      if (res.ok || res.IsSuccess) {
        toast("✅ " + (res.message || "Deleted"));
        setGrid(prev => {
          const next = prev.filter((_, i) => i !== idx);
          const sel  = Math.max(0, next.length - 1);
          setSelIdx(sel);
          setTimeout(() => {
            if (next.length > 0) focusRow(sel, 0);
          }, 50);
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
        setTimeout(() => {
          if (next.length > 0) focusRow(sel, 0);
        }, 30);
        return next;
      });
    }
  }, [grid, sess, perm, focusRow, toast, confirm, redirectIfDualLogin]);

  // ── gridemptycheck ─────────────────────────────────────────────────────────
  const gridemptycheck = useCallback((g) => {
    let cleaned = [...g];

    if (cleaned.length > 1) {
      const last = cleaned[cleaned.length - 1];
      if (last.CustomerCardTypeRefid == null || last.CustomerCardTypeRefid === "") {
        cleaned = cleaned.slice(0, -1);
      }
    }

    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i].EditMode === 1) {
        if (cleaned[i].CustomerCardTypeRefid == null || cleaned[i].CustomerCardTypeRefid === "") {
          toast("❌ Enter All Cardtype in the Grid !!.", true);
          setSelIdx(i);
          focusRow(i, 0);
          return { ok: false, cleaned };
        }
      }
    }
    return { ok: true, cleaned };
  }, [focusRow, toast]);

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

    const hasNew      = dirty.some(r => r.Id == null || r.Id === 0);
    const hasExisting = dirty.some(r => r.Id != null && r.Id !== 0);
    let confirmMsg    = "Do you Want to Save the CRM point Details?";

    const proceed = await confirm(confirmMsg);
    if (!proceed) { addRow(); return; }

    setLoading(true);

    const payload = dirty.map(r => ({
      Id:                    Number(r.Id || 0),
      CustomerCardTypeRefid: Number(r.CustomerCardTypeRefid),
      TypeName:              String(r.TypeName || ""),
      BillAmount:            Number(r.BillAmount || 0),
      Points:                Number(r.Points || 0),
      Value:                 Number(r.Value || 0),
      Active:                r.Active === true ? 1 : 0,
      EditMode:              r.EditMode,
    }));

    const res = await CC.insertapi(
      CC.CRMPointsInsert,
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
      await loadData();
    } else {
      toast(`❌ ${res.message || "Save failed"}`, true);
    }
  }, [grid, sess, perm, loadData, gridemptycheck, addRow, toast, confirm, redirectIfDualLogin]);

  // ── handleEsc ──────────────────────────────────────────────────────────────
  const handleEsc = useCallback(async () => {
    const ok = await confirm("Do You Want To Quit Page?");
    if (ok) navigate("/Home");
  }, [confirm, navigate]);

  // ── Global keyboard shortcuts ──────────────────────────────────────────────
  useEffect(() => {
    const onKey = e => {
      if (e.keyCode === 112) { e.preventDefault(); handleSave(); }
      if (e.keyCode === 27)  { e.preventDefault(); handleEsc();  }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleEsc]);

  // ── Custom Dropdown Handlers ────────────────────────────────────────────────
  const handleCardTypeSelect = useCallback((idx, cardType) => {
    setGrid(prev =>
      prev.map((r, i) =>
        i === idx
          ? { ...r, CustomerCardTypeRefid: cardType.Id, TypeName: cardType.TypeName, EditMode: 1 }
          : r
    ));
    if (grid[idx]?.Id) dirtyIds.current.add(grid[idx].Id);
    setOpenComboIdx(null);
    
    setTimeout(() => focusRow(idx, 1), 50);
  }, [grid, focusRow]);

  // ── Row-level keyboard navigation ─────────────────────────────────────────
  const onCellKeyDown = useCallback((e, idx, colIdx, field) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const row   = grid[idx];
      const value = row?.[field];

      if (field === "CustomerCardTypeRefid") {
        if (value == null || value === "") {
          setTimeout(() => setOpenComboIdx(idx), 250);
          return;
        }
      } else if (field === "BillAmount" || field === "Points" || field === "Value") {
        const fixed = CC.ValNum(value).toFixed(2);
        updateCell(idx, field, fixed);
      }

      if (field === "Active") {
        if (idx === grid.length - 1) addRow();
        else { setSelIdx(idx + 1); focusRow(idx + 1, 0); }
        return;
      }

      CC.handleEnterNext(
        e, inputRefs, idx, colIdx,
        ALL_COLUMNS.length, grid.length,
        addRow, grid, rowValidator
      );
    }

    if ((e.key === "Delete" && e.shiftKey) || (e.key === "Delete" && e.ctrlKey)) {
      e.preventDefault(); deleteRow(idx);
    }
  }, [grid, addRow, focusRow, deleteRow, updateCell, rowValidator]);

  // ── Validate Input Bounds ──
  const validateInput = (field, value) => {
    if (field === "BillAmount" || field === "Points" || field === "Value") {
      return /^-?\d{0,15}(\.\d{0,2})?$/.test(value) && value.length <= 18;
    }
    return true;
  };

  // ── Toggle component (Active column) — matches BrandMaster's Active toggle ──
  //   Presentation only: still calls the existing updateCell() handler, so the
  //   underlying logic/state transitions are identical to before.
  const Toggle = ({ value, onChange, onKeyDown, inputRef, idx, editMode }) => (
    <button
      ref={inputRef}
      onClick={() => onChange(!value)}
      onKeyDown={onKeyDown}
      onFocus={() => selectRow(idx)}
      title={value ? "Active" : "Inactive"}
      style={{
        width: 32, height: 18, borderRadius: 9, border: "none", cursor: "pointer",
        background: value ? "#1e7e34" : "#cbd5e1",
        position: "relative", transition: "background 0.18s ease", outline: "none",
        display: "inline-flex", alignItems: "center", flexShrink: 0, padding: 0,
        boxShadow: value ? "inset 0 0 0 1px #166534" : "inset 0 0 0 1px #b0bec5",
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

  if (!isAuthorized) return null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="bm-shell">

      {/* Confirm Dialog */}
      {ConfirmUI}

      <Topbar />

      <div className="bm-layout">
        <div className="bm-card">
          <div className="bm-card-header">
            <div className="bm-card-header-title">CRM Points Master</div>
            <button type="button" className="bm-close-x" aria-label="Close" onClick={handleEsc}>✕</button>
          </div>

          <div className="bm-card-body">
            <div className="bm-report-title">CRM Points Master</div>

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
                      textAlign: (c.field === "Active" || c.field === "BillAmount" || c.field === "Points" || c.field === "Value")
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

                  {/* CustomerCardType — Combo Column */}
                  <td style={{ position: "relative", overflow: "visible" }}>
                    <input
                      ref={el => {
                        if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                        inputRefs.current[idx][0] = el;
                      }}
                      className="bm-cell-input"
                      type="text"
                      readOnly
                      value={row.TypeName ?? ""}
                      placeholder="Select type..."
                      onFocus={() => selectRow(idx)}
                      onKeyDown={e => onCellKeyDown(e, idx, 0, "CustomerCardTypeRefid")}
                      onClick={e => {
                        e.stopPropagation();
                        selectRow(idx);
                        if (row.EditMode === 1) setTimeout(() => setOpenComboIdx(idx), 250);
                      }}
                      style={{ cursor: row.EditMode === 0 ? "default" : "pointer" }}
                    />
                    
                    {openComboIdx === idx && row.EditMode === 1 && (
                      <div
                        onMouseDown={e => e.stopPropagation()}
                        style={{
                          position:   "absolute",
                          top:        "100%",
                          left:       0,
                          zIndex:     500,
                          background: "#fff",
                          border:     "1px solid #d4dbe8",
                          borderRadius: 4,
                          minWidth:   200,
                          maxHeight:  180,
                          overflowY:  "auto",
                          boxShadow:  "0 4px 12px rgba(0,0,0,.15)",
                        }}
                      >
                        {cardTypeList.length === 0 && (
                          <div style={{ padding: "6px 10px", fontSize: 11, color: "#aaa" }}>
                            No card types found
                          </div>
                        )}
                        {cardTypeList.map(ct => (
                          <div
                            key={ct.Id}
                            style={{
                              padding:    "5px 10px",
                              fontSize:   12,
                              cursor:     "pointer",
                              background: row.CustomerCardTypeRefid === ct.Id ? "#fddfa0" : "transparent",
                              color:      "#1a2e4a",
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "#fef3e0"}
                            onMouseLeave={e => e.currentTarget.style.background =
                              row.CustomerCardTypeRefid === ct.Id ? "#fddfa0" : "transparent"}
                            onMouseDown={() => handleCardTypeSelect(idx, ct)}
                          >
                            {ct.TypeName}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Bill Amount */}
                  <td>
                    <input
                      ref={el => {
                        if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                        inputRefs.current[idx][1] = el;
                      }}
                      className="bm-cell-input"
                      type="text"
                      readOnly={row.EditMode === 0}
                      value={row.BillAmount ?? ""}
                      onChange={e => {
                        if (row.EditMode !== 1) return;
                        if (!validateInput("BillAmount", e.target.value)) return;
                        updateCell(idx, "BillAmount", e.target.value);
                      }}
                      onKeyDown={e => onCellKeyDown(e, idx, 1, "BillAmount")}
                      onFocus={() => selectRow(idx)}
                      style={{ textAlign: "right" }}
                    />
                  </td>

                  {/* Points */}
                  <td>
                    <input
                      ref={el => {
                        if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                        inputRefs.current[idx][2] = el;
                      }}
                      className="bm-cell-input"
                      type="text"
                      readOnly={row.EditMode === 0}
                      value={row.Points ?? ""}
                      onChange={e => {
                        if (row.EditMode !== 1) return;
                        if (!validateInput("Points", e.target.value)) return;
                        updateCell(idx, "Points", e.target.value);
                      }}
                      onKeyDown={e => onCellKeyDown(e, idx, 2, "Points")}
                      onFocus={() => selectRow(idx)}
                      style={{ textAlign: "right" }}
                    />
                  </td>

                  {/* Value */}
                  <td>
                    <input
                      ref={el => {
                        if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                        inputRefs.current[idx][3] = el;
                      }}
                      className="bm-cell-input"
                      type="text"
                      readOnly={row.EditMode === 0}
                      value={row.Value ?? ""}
                      onChange={e => {
                        if (row.EditMode !== 1) return;
                        if (!validateInput("Value", e.target.value)) return;
                        updateCell(idx, "Value", e.target.value);
                      }}
                      onKeyDown={e => onCellKeyDown(e, idx, 3, "Value")}
                      onFocus={() => selectRow(idx)}
                      style={{ textAlign: "right" }}
                    />
                  </td>

                  {/* Active Toggle */}
                  <td style={{ textAlign: "center" }}>
                    <Toggle
                      value={row.Active === true || row.Active === 1}
                      idx={idx}
                      editMode={row.EditMode}
                      inputRef={el => {
                        if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                        inputRefs.current[idx][4] = el;
                      }}
                      onChange={val => row.EditMode === 1 && updateCell(idx, "Active", val)}
                      onFocus={() => selectRow(idx)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          onCellKeyDown(e, idx, 4, "Active");
                        }
                      }}
                    />
                  </td>

                  {/* Edit + Delete action column */}
                  <td style={{ whiteSpace: "nowrap", textAlign: "center" }}>

                    {/* Edit button — only for saved rows in view mode */}
                    {row.Id && row.EditMode === 0 && (
                      <button
                        className="bm-icon-btn edit"
                        title="Edit row"
                        onClick={e => { e.stopPropagation(); enableEdit(idx); }}
                      >
                        <Pencil size={15} />
                      </button>
                    )}

                    {/* Editing indicator — saved row currently in edit mode */}
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
                <div className="bm-empty">No records. Press ➕ Add Row to add a CRM point configuration.</div>
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