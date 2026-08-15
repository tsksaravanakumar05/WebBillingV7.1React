// ─────────────────────────────────────────────────────────────────────────────
//  Company.jsx
//
//  Converted from: Company.js  (jQuery / jqxGrid)
//  Architecture  : Mirrors CashVoucher.jsx (bm-* card design system)
//  References    : Common.jsx utilities · MasterPage.css design
//
//  Business Logic: ALL original jQuery logic preserved unchanged
//  API Endpoints : Uses CC.* constants (Common.jsx) — add the following
//                  6 constants to Common.jsx if not already present:
//                    export const Company_Select          = "/Company/SelectCompany";
//                    export const Company_Update           = "/Company/UpdateCompany";
//                    export const Company_SelectedCompany  = "/Company/SelectedCompany";
//                    export const Company_SendMirrorTable  = "/Company/SendMirrorTable";
//                    export const Company_SendCompanyKey   = "/Company/SendCompanyKey";
//                    export const Company_Delete           = "/Company/DeleteCompany";
//  Payloads      : ALL original request structures preserved
//
//  VISUAL DESIGN NOTE:
//  Presentational layer matches the "bm-*" card design system used in
//  CashVoucher.jsx / BrandMaster.jsx (blue card border + gradient header,
//  rounded card, bm-btn pill buttons, bm-grid-wrap fixed-height scrollable
//  grid, lucide-react icons, etc.). The bm-* classes live in the same
//  MasterPage.css imported below — no local <style> block needed.
//  The per-cell selection highlighting (grid-row / grid-cell / selected /
//  cell-input classes) is the same "click a cell to edit it" interaction
//  used by CashVoucher's grid. A visible toolbar (F1 Save / F3 Send All /
//  F4 Download / F5 Send Items / F6 Send Customer / Ctrl+D Delete / Esc
//  Quit) was added at the bottom of the card, mirroring CashVoucher's
//  always-visible button row — each button simply calls the exact same
//  handler the matching keyboard shortcut already calls; no new logic
//  was added.
//  Unlike CashVoucher, Company.js has no F5-list-popup, no account-lookup
//  popup, and no password-protected delete — Ctrl+D deletes directly after
//  a Yes/No confirm, exactly as in the original jQuery. Those popups were
//  therefore intentionally NOT reproduced here.
//  All state, effects, handlers, API calls, validation, variable names and
//  control flow are carried over 1:1 from the original Company.js.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Save, Send, Download, Users, Trash2, XCircle,Pencil  } from "lucide-react";
import "../Master/MasterPage.css";

import Topbar from "../components/Topbar";
import * as CC  from "../components/Common";
import * as MSG from "../components/Messages";

// ─── Pure helpers ─────────────────────────────────────────────────────────────
const nullStr = (v) => (v == null || v === undefined ? "" : String(v));

// ─── Grid column meta (mirrors jQuery gridcolumns) ───────────────────────────
// grdCCode, grdCName, grdBranchName, grdComputerName editable;
// grdAliseName / grdId hidden (mirrors jQuery hidden:true columns);
// grdCStatus is the visible "Active" checkbox column.
const GRID_COLS = [
  { key: "CCode",        label: "Code",           width: 70,  type: "int",    maxLen: 10  },
  { key: "CName",        label: "Company Name",   width: 250, type: "string", maxLen: 200 },
  { key: "BranchName",   label: "Branch Name",    width: 150, type: "string", maxLen: 200 },
//   { key: "ComputerName", label: "Computer Name",  width: 150, type: "string", maxLen: 200 },
];
// Enter-key navigation order for editable text columns (mirrors GirdNextCell flow)
const COL_ORDER = ["CCode", "CName", "BranchName", "ComputerName"];

// ─── Blank grid row factory (mirrors jQuery grid fields + addrow default) ────
const makeGridRow = () => ({
  _key:          CC.uid(),
  Id:            null,
  CCode:         "",
  CName:         "",
  AliseName:     "",   // hidden (grdAliseName) — auto-filled from CName
  BranchName:    "",
  ComputerName:  "",
  CStatus:       false,
  Active:        true, // hidden internal flag — jQuery addrow always sets this true
  EditMode:      0,
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Company — main component
// ═══════════════════════════════════════════════════════════════════════════════
export default function Company() {
  const navigate = useNavigate();
  useEffect(() => {
    document.title = "Company-Kassapos";
  }, []);
  // ── MSG hooks ────────────────────────────────────────────────────────────────
  const { confirm, ConfirmUI } = MSG.useConfirm();
  const { toast, toasts }      = MSG.useToast();

  // ── Permissions ──────────────────────────────────────────────────────────────
  const [perm,         setPerm        ] = useState({ View: 0, Add: 0, Edit: 0, Delete: 0 });
  const [isAuthorized, setIsAuthorized] = useState(false);

  // ── Dual-login guard (mirrors jQuery loginwindow / redis check) ───────────────
  const redirectIfDualLogin = useCallback((res) => {
    if (res?._dualLogin || res?.redis === false) {
      alert("Already Login Another User Please Login Again!!!");
      navigate("/Login");
      return true;
    }
    return false;
  }, [navigate]);

  // ── Permission guard (mirrors jQuery menudata check, PageName "Company") ─────
  useEffect(() => {
    const menuStr = localStorage.getItem("menulist");
    if (!menuStr) {
      alert("Session Close Please Login !!!.");
      navigate("/Login/Index");
      return;
    }
    const menulist = JSON.parse(menuStr);
    const menudata = menulist.filter((o) => o.PageName === "Company");
    if (!menudata || menudata.length === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => navigate("/Home"), 3000);
      return;
    }
    if (menudata[0].View === 0) {
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

  // ── Session (mirrors jQuery Comid / MComid / CommonCompany) ──────────────────
  const [sess] = useState(() => {
    let CoreSess = { MirrorTable: "0" };
    try { CoreSess = CC.buildSession("Company"); } catch { /* keep default */ }

    let Comid  = localStorage.getItem("Comid");
    const MComid = localStorage.getItem("MComid");
    const CommonCompany = localStorage.getItem("CommonCompany");
    if (CommonCompany === "true") Comid = MComid;

    return { ...CoreSess, Comid, MComid };
  });

  // ── MainSetting (mirrors jQuery MainSet / SupplierCommon / CustomerCommon) ───
  const [mainSet] = useState(() => {
    try { return (JSON.parse(localStorage.getItem("Mainsetting")) || [{}])[0] || {}; }
    catch { return {}; }
  });
  const SupplierCommon = mainSet.CustomerCommonCompany;
  const CustomerCommon = SupplierCommon === true ? 1 : 0;

  // ── Grid state ────────────────────────────────────────────────────────────────
  const [gridRows,     setGridRows    ] = useState([makeGridRow()]);
  const [selectedCell, setSelectedCell] = useState({ rowKey: null, colKey: null });

  // ── Loading ───────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);

  // ── Misc flags (mirrors jQuery createstatus) ─────────────────────────────────
  const createStatusRef = useRef(0);

  // ── DOM refs ──────────────────────────────────────────────────────────────────
  const rowindexRef = useRef(null); // last selected grid row key (Ctrl+D / F3 / F4 / F5 / F6 target)

  // ─────────────────────────────────────────────────────────────────────────────
  //  focusCell: generic cell-focus helper (mirrors jqxGrid selectcell+focus)
  // ─────────────────────────────────────────────────────────────────────────────
  const focusCell = useCallback((rowKey, colKey) => {
    setTimeout(() => {
      const el = document.getElementById(`cell_${rowKey}_${colKey}`);
      if (el) { el.focus(); el.select?.(); }
    }, 30);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  //  ADD ROW (mirrors jQuery addrow + Addrowfunc — new row Active always true)
  // ─────────────────────────────────────────────────────────────────────────────
  const addRowFunc = useCallback(() => {
    const newRow = makeGridRow();
    setGridRows((prev) => [...prev, newRow]);
    setTimeout(() => focusCell(newRow._key, "CCode"), 50);
    return newRow;
  }, [focusCell]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  GRID EMPTY CHECK (mirrors jQuery methods.gridemptycheck)
  // ─────────────────────────────────────────────────────────────────────────────
  const gridEmptyCheck = useCallback(() => {
    let rows = gridRows;
    const last = rows[rows.length - 1];
    // Remove trailing empty row if more than one row exists
    if ((nullStr(last.CCode) === "") && rows.length > 1) {
      rows = rows.slice(0, -1);
      setGridRows(rows);
    }
    for (let i = 0; i < rows.length; i++) {
      if (nullStr(rows[i].CCode) === "") {
        toast("❌ Enter All Company Code in the Grid !!!.", true);
        focusCell(rows[i]._key, "CCode");
        return false;
      }
      if (nullStr(rows[i].CName) === "") {
        toast("❌ Enter All Company Name in the Grid !!!.", true);
        focusCell(rows[i]._key, "CName");
        return false;
      }
    }
    return true;
  }, [gridRows, toast, focusCell]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  CHECK DUPLICATE (mirrors jQuery CheckDuplicate(grid, field, label))
  // ─────────────────────────────────────────────────────────────────────────────
  const checkDuplicate = useCallback((field, label) => {
    const rows = gridRows;
    const seen = new Map(); // value -> first rowKey
    for (let i = 0; i < rows.length; i++) {
      const val = nullStr(rows[i][field]);
      if (val === "") continue;
      if (seen.has(val)) {
        toast(`❌ ${label} Already Exists !!!.`, true);
        focusCell(rows[i]._key, field);
        return false;
      }
      seen.set(val, rows[i]._key);
    }
    return true;
  }, [gridRows, toast, focusCell]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  GRID NEXT CELL (mirrors jQuery GirdNextCell — move to next column / new row)
  // ─────────────────────────────────────────────────────────────────────────────
  const gridNextCell = useCallback((rowKey, colKey) => {
    const rowIdx = gridRows.findIndex((r) => r._key === rowKey);
    const colIdx = COL_ORDER.indexOf(colKey);
    if (colIdx > -1 && colIdx < COL_ORDER.length - 1) {
      focusCell(rowKey, COL_ORDER[colIdx + 1]);
      return;
    }
    // last column in row — go to next row's first column, or add new row
    if (rowIdx < gridRows.length - 1) {
      focusCell(gridRows[rowIdx + 1]._key, "CCode");
    } else {
      const newRow = addRowFunc();
      setTimeout(() => focusCell(newRow._key, "CCode"), 60);
    }
  }, [gridRows, focusCell, addRowFunc]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  CELL CHANGE (mirrors jQuery cellendedit / GridKeyPressValidation)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleCellChange = useCallback((rowKey, colKey, rawValue, colMeta) => {
    let value = rawValue;
    if (colMeta?.type === "int") {
      value = value.replace(/[^0-9]/g, "");
    }
    // Auto-uppercase all typed input while editing (data-entry convenience only —
    // does not affect the int-filter or maxLen truncation above/below).
    value = value.toUpperCase();
    if (colMeta?.maxLen && value.length > colMeta.maxLen) {
      value = value.slice(0, colMeta.maxLen);
    }
    setGridRows((prev) => prev.map((r) =>
      r._key === rowKey ? { ...r, [colKey]: value, EditMode: 1 } : r
    ));
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  //  SELECTED COMPANY SWITCH (mirrors jQuery CName-enter AJAX → /Company/SelectedCompany)
  //  Triggered when Enter is pressed on the Company Name cell of an existing
  //  (already-saved) row — switches the active company context and reloads Home.
  // ─────────────────────────────────────────────────────────────────────────────
  const switchToSelectedCompany = useCallback(async (rowId) => {
    setLoading(true);
    const res = await CC.api(CC.Company_SelectedCompany, null, {}, {
      Id:     Number(rowId),
      MComid: Number(sess.MComid),
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
  
    // guard: bail out if the expected data isn't there
    if (!res?.IsSuccess || !res.Data4?.length || !res.Data5?.length) {
      console.error("Unexpected response shape:", res);
      return;
    }
  
    const company = res.Data4[0];
    const settings = res.Data5[0];
  
    sessionStorage.setItem("home", "1");
    localStorage.setItem("Comid", rowId);
    CC.setCompanyRefId(rowId);
    localStorage.setItem("MComid", sess.MComid);
    localStorage.setItem("CompanyName", company.Companyname);
    localStorage.setItem("Address", `${company.Address1} ${company.Address2} ${company.City}`);
    localStorage.setItem("Phone", "Phone No :" + company.Phone);
    localStorage.setItem("CashierRefid", res.Data6);
    localStorage.setItem("parentcashid", res.Data7);
    localStorage.setItem("CustomerCashid", res.Data8);
    localStorage.setItem("Companysetting", JSON.stringify(res.Data4));
    localStorage.setItem("Mainsetting", JSON.stringify(res.Data5));
    localStorage.setItem("CommonCompany", settings.CommonCompany);
    localStorage.setItem("SupplierCommon", settings.SupplierCommonCompany);
  
    navigate("/dashboard");
  }, [sess.MComid, redirectIfDualLogin, navigate]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  RELOAD GRID (mirrors jQuery methods.loadCounter → /Company/SelectCompany)
  // ─────────────────────────────────────────────────────────────────────────────
  const reloadGrid = useCallback(async () => {
    setLoading(true);
    const res = await CC.api(CC.Company_Select, null, {}, {
      Comid: Number(sess.MComid),
    });



    setLoading(false);
    if (redirectIfDualLogin(res)) return;

    const data = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
    let rows;
    if (data.length > 0) {
      rows = data.map((obj) => ({
        ...makeGridRow(),
        _key:          CC.uid(),
        Id:            obj.Id ?? null,
        CCode:         nullStr(obj.CCode),
        CName:         nullStr(obj.CName),
        AliseName:     nullStr(obj.AliseName),
        BranchName:    nullStr(obj.BranchName),
        ComputerName:  nullStr(obj.ComputerName),
        CStatus:       !!obj.CStatus,
        Active:        obj.Active ?? true,
        EditMode:      0,
      }));
      rows.push(makeGridRow());
    } else {
      rows = [makeGridRow()];
    }
    setGridRows(rows);

    // Highlight the currently active company (mirrors jQuery CStatus==true loop)
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].CStatus === true) {
        setTimeout(() => focusCell(rows[i]._key, "CName"), 60);
        break;
      }
    }
  }, [sess.MComid, redirectIfDualLogin, focusCell]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  INIT (mirrors jQuery methods.init)
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthorized) return;
    reloadGrid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  GRID KEYBOARD NAVIGATION (mirrors jQuery gridCompany keydown — Enter / Delete)
  // ─────────────────────────────────────────────────────────────────────────────
  // const handleGridKeyDown = useCallback((e, rowKey, colKey) => {
  //   rowindexRef.current = rowKey;

  //   if (e.key === "Enter") {
  //     e.preventDefault();
  //     const row = gridRows.find((r) => r._key === rowKey);
  //     if (!row) return;

  //     if (colKey === "CCode") {
  //       const value = nullStr(row.CCode);
  //       if (value === "") {
  //         toast("❌ Enter Code!!!.", true);
  //         return;
  //       }
  //       if (checkDuplicate("CCode", "Code")) {
  //         gridNextCell(rowKey, "CCode");
  //       }
  //       return;
  //     }

  //     if (colKey === "CName") {
  //       const value = nullStr(row.CName);
  //       if (value === "") {
  //         toast("❌ Enter Company Name!!!.", true);
  //         return;
  //       }
  //       if (nullStr(row.Id) !== "") {
  //         switchToSelectedCompany(row.Id);
  //       }
  //       if (checkDuplicate("CName", "Company Name")) {
  //         gridNextCell(rowKey, "CName");
  //       }
  //       if (nullStr(row.AliseName) === "") {
  //         setGridRows((prev) => prev.map((r) =>
  //           r._key === rowKey ? { ...r, AliseName: r.CName } : r
  //         ));
  //       }
  //       return;
  //     }

  //     if (colKey === "CStatus") {
  //       // mirrors jQuery grdCStatus / grdActive Enter no-op
  //       return;
  //     }

  //     // BranchName / ComputerName (or any other editable column) → next cell / new row
  //     gridNextCell(rowKey, colKey);
  //     return;
  //   }

  //   // Delete key (46) — mirrors jQuery key===46 handling
  //   if (e.key === "Delete") {
  //     e.preventDefault();
  //     const row = gridRows.find((r) => r._key === rowKey);
  //     const value = row?.Id;
  //     if (value != null && value !== 0 && value !== "") {
  //       // Existing saved row — Delete key is a no-op (mirrors empty jQuery block);
  //       // deletion of saved rows is only via Ctrl+D.
  //       return;
  //     }
  //     // Unsaved row — delete directly (mirrors DeleteRow)
  //     setGridRows((prev) => {
  //       let next = prev.filter((r) => r._key !== rowKey);
  //       if (next.length === 0) next = [makeGridRow()];
  //       return next;
  //     });
  //     setTimeout(() => {
  //       setGridRows((cur) => {
  //         focusCell(cur[cur.length - 1]._key, "CCode");
  //         return cur;
  //       });
  //     }, 50);
  //     return;
  //   }
  // }, [gridRows, toast, checkDuplicate, gridNextCell, switchToSelectedCompany, focusCell]);
  const handleGridKeyDown = useCallback((e, rowKey, colKey) => {
    rowindexRef.current = rowKey;
  
    // ── Arrow key navigation (moves actual DOM focus + selectedCell) ──
    if (
      e.key === "ArrowUp" ||
      e.key === "ArrowDown" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight"
    ) {
      e.preventDefault();
  
      const rowIdx = gridRows.findIndex((r) => r._key === rowKey);
      const colIdx = GRID_COLS.findIndex((c) => c.key === colKey);
      if (rowIdx === -1 || colIdx === -1) return;
  
      let nextRowIdx = rowIdx;
      let nextColIdx = colIdx;
  
      if (e.key === "ArrowRight") nextColIdx = Math.min(colIdx + 1, GRID_COLS.length - 1);
      if (e.key === "ArrowLeft")  nextColIdx = Math.max(colIdx - 1, 0);
      if (e.key === "ArrowDown")  nextRowIdx = Math.min(rowIdx + 1, gridRows.length - 1);
      if (e.key === "ArrowUp")    nextRowIdx = Math.max(rowIdx - 1, 0);
  
      const nextRow = gridRows[nextRowIdx];
      const nextCol = GRID_COLS[nextColIdx];
      if (nextRow && nextCol) {
        setSelectedCell({ rowKey: nextRow._key, colKey: nextCol.key });
        rowindexRef.current = nextRow._key;
        focusCell(nextRow._key, nextCol.key);   // 👈 actual DOM focus move pannுthu
      }
      return;
    }
  
    if (e.key === "Enter") {
      e.preventDefault();
      const row = gridRows.find((r) => r._key === rowKey);
      if (!row) return;
  
      if (colKey === "CCode") {
        const value = nullStr(row.CCode);
        if (value === "") {
          toast("❌ Enter Code!!!.", true);
          return;
        }
        if (checkDuplicate("CCode", "Code")) {
          gridNextCell(rowKey, "CCode");
        }
        return;
      }
  
      if (colKey === "CName") {
        const value = nullStr(row.CName);
        if (value === "") {
          toast("❌ Enter Company Name!!!.", true);
          return;
        }
        if (nullStr(row.Id) !== "") {
          switchToSelectedCompany(row.Id);   // ✅ already handles page-open logic
        }
        if (checkDuplicate("CName", "Company Name")) {
          gridNextCell(rowKey, "CName");
        }
        if (nullStr(row.AliseName) === "") {
          setGridRows((prev) => prev.map((r) =>
            r._key === rowKey ? { ...r, AliseName: r.CName } : r
          ));
        }
        return;
      }
  
      if (colKey === "CStatus") {
        return;
      }
  
      gridNextCell(rowKey, colKey);
      return;
    }
  
    if (e.key === "Delete") {
      e.preventDefault();
      const row = gridRows.find((r) => r._key === rowKey);
      const value = row?.Id;
      if (value != null && value !== 0 && value !== "") {
        return;
      }
      setGridRows((prev) => {
        let next = prev.filter((r) => r._key !== rowKey);
        if (next.length === 0) next = [makeGridRow()];
        return next;
      });
      setTimeout(() => {
        setGridRows((cur) => {
          focusCell(cur[cur.length - 1]._key, "CCode");
          return cur;
        });
      }, 50);
      return;
    }
  }, [gridRows, toast, checkDuplicate, gridNextCell, switchToSelectedCompany, focusCell]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  F1 — SAVE (mirrors jQuery F1 keydown handler → /Company/UpdateCompany)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!gridEmptyCheck()) return;
    if (!checkDuplicate("CCode", "Code")) return;

    const ok = await confirm("Do you Want to Save the Company Details?");
    if (!ok) return;

    createStatusRef.current = 0;

    // NOTE: new/unsaved rows have Id === null. Backend's CompanyModel.Id is a
    // non-nullable Int32, so sending "Id": null makes the whole array fail to
    // deserialize (objBrand comes through as null on the server → NullReferenceException).
    // Coerce null Id to 0 before sending.
    // const griddata = gridRows.map(({ _key, ...rest }) => ({
    //   ...rest,
    //   Id: rest.Id == null ? 0 : rest.Id,
    // }));
    const griddata = gridRows.map((r) => ({
        Id:           r.Id != null && r.Id !== 0 ? Number(r.Id) : 0,   // Brand-ல null, இங்க 0
        CCode:        String(r.CCode || "").trim(),
        CName:        String(r.CName || "").trim(),
        AliseName:    String(r.AliseName || r.CName || "").trim(),
        BranchName:   String(r.BranchName || "").trim(),
        ComputerName: String(r.ComputerName || "").trim(),
        CStatus:      r.CStatus === true,
        Active:       r.Active === true || r.Active === 1 ? 1 : 0,
      }));

    setLoading(true);
    // NOTE: griddata is an array, so it must go through insertapi (which sends
    // the array as the JSON body and the second object as headers/params) —
    // NOT api(), which would flatten an array 4th-arg into query params
    // (?0=...&1=...) and cause the backend's `objBrand` model-bind to be null.
    const res = await CC.insertapicompany(CC.Company_Update, griddata, { MirrorTable: sess.MirrorTable });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;

    if (res?.ok) {
      toast(`✔ ${res.message || "Saved Successfully."}`);
      reloadGrid();
    } else {
      toast(`❌ ${res?.message || "Save Failed."}`, true);
    }
  }, [gridEmptyCheck, checkDuplicate, confirm, gridRows, sess.MirrorTable, redirectIfDualLogin, toast, reloadGrid]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  Helper: currently selected row's Id (mirrors jQuery getselectedcell → grdId)
  // ─────────────────────────────────────────────────────────────────────────────
  const getSelectedRow = useCallback(() => {
    const rowKey = selectedCell.rowKey ?? rowindexRef.current;
    return gridRows.find((r) => r._key === rowKey) || null;
  }, [selectedCell.rowKey, gridRows]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  F3 — SEND ALL MIRRORTABLE DATA (mirrors jQuery F3 → /Company/SendMirrorTable, items:0)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleF3SendAll = useCallback(async () => {
    if (!gridEmptyCheck()) return;
    const row = getSelectedRow();

    const ok = await confirm("Do you Want to Send All MirrorTable Data?");
    if (!ok) return;

    createStatusRef.current = 0;
    setLoading(true);
    const res = await CC.api(CC.Company_SendMirrorTable, null, {}, {
      Comid: row?.Id ?? null,
      MComid: Number(sess.MComid),
      items: 0,
      CustomerCommon,
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;

    if (res?.ok) {
      toast(`✔ ${res.message || "Sent Successfully."}`);
    } else {
      toast(`❌ ${res?.message || "Send Failed."}`, true);
    }
  }, [gridEmptyCheck, getSelectedRow, confirm, sess.MComid, CustomerCommon, redirectIfDualLogin, toast]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  F4 — DOWNLOAD COMPANY DETAILS (mirrors jQuery F4 → /Company/SendCompanyKey)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleF4Download = useCallback(async () => {
    if (!gridEmptyCheck()) return;
    const row = getSelectedRow();

    const ok = await confirm("Do you Want to Download CompanyDetails ?");
    if (!ok) return;

    createStatusRef.current = 0;
    setLoading(true);
    const res = await CC.api(CC.Company_SendCompanyKey, null, {}, {
      Comid: row?.Id ?? null,
      MComid: Number(sess.MComid),
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;

    if (res?.ok) {
      window.location.href = res.data;
    } else {
      toast(`❌ ${res?.message || "Download Failed."}`, true);
    }
  }, [gridEmptyCheck, getSelectedRow, confirm, sess.MComid, redirectIfDualLogin, toast]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  F5 — SEND ITEM DETAILS MIRRORTABLE (mirrors jQuery F5 → /Company/SendMirrorTable, items:1)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleF5SendItems = useCallback(async () => {
    if (!gridEmptyCheck()) return;
    const row = getSelectedRow();

    const ok = await confirm("Do you Want to Send Item Details MirrorTable Data?");
    if (!ok) return;

    createStatusRef.current = 0;
    setLoading(true);
    const res = await CC.api(CC.Company_SendMirrorTableA, null, {}, {
      Comid: row?.Id ?? null,
      MComid: Number(sess.MComid),
      items: 1,
      CustomerCommon,
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;

    if (res?.ok) {
      toast(`✔ ${res.message || "Sent Successfully."}`);
    } else {
      toast(`❌ ${res?.message || "Send Failed."}`, true);
    }
  }, [gridEmptyCheck, getSelectedRow, confirm, sess.MComid, CustomerCommon, redirectIfDualLogin, toast]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  F6 — SEND CUSTOMER DETAILS MIRRORTABLE (mirrors jQuery F6 → /Company/SendMirrorTable, items:2)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleF6SendCustomer = useCallback(async () => {
    if (!gridEmptyCheck()) return;
    const row = getSelectedRow();

    const ok = await confirm("Do you Want to Send Customer Details MirrorTable Data?");
    if (!ok) return;

    createStatusRef.current = 0;
    setLoading(true);
    const res = await CC.api(CC.Company_SendMirrorTable, null, {}, {
      Comid: row?.Id ?? null,
      MComid: Number(sess.MComid),
      items: 2,
      CustomerCommon,
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;

    if (res?.ok) {
      toast(`✔ ${res.message || "Sent Successfully."}`);
    } else {
      toast(`❌ ${res?.message || "Send Failed."}`, true);
    }
  }, [gridEmptyCheck, getSelectedRow, confirm, sess.MComid, CustomerCommon, redirectIfDualLogin, toast]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  Ctrl+D — DELETE COMPANY (mirrors jQuery Ctrl+D → /Company/DeleteCompany)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleDeleteCompany = useCallback(async (rowKeyArg) => {
    const rowKey = rowKeyArg ?? selectedCell.rowKey ?? rowindexRef.current;
    const row = gridRows.find((r) => r._key === rowKey);
    if (!row) return;

    const value = row.Id;
    if (value == null || value === 0 || value === "") return; // mirrors jQuery guard

    if (nullStr(row.CCode) === "0") {
      toast("❌ Main Company Cannot be Deleted !!!.", true);
      return;
    }

    const str = `Wish to Delete the Company  ${row.CName}?`;
    const ok = await confirm(str);
    if (!ok) return;

    setLoading(true);
    const res = await CC.api(CC.Company_Delete, null, {}, {
      Id: Number(value),
      MirrorTable: sess.MirrorTable,
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;

    if (res?.ok) {
      toast(`✔ ${res.message || "Deleted Successfully."}`);
      setGridRows((prev) => {
        let next = prev.filter((r) => r._key !== rowKey);
        if (next.length === 0) next = [makeGridRow()];
        setTimeout(() => focusCell(next[next.length - 1]._key, "CCode"), 50);
        return next;
      });
    } else {
      toast(`❌ ${res?.message || "Delete Failed."}`, true);
    }
  }, [selectedCell.rowKey, gridRows, confirm, sess.MirrorTable, redirectIfDualLogin, toast, focusCell]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  GLOBAL KEYBOARD SHORTCUTS (mirrors jQuery $(document).on('keydown'))
  //  F1=Save F3=SendAll F4=Download F5=SendItems F6=SendCustomer
  //  Ctrl+M=flag  Ctrl+D=Delete  Esc=Quit
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthorized) return;

    const handler = (e) => {
      if (e.key === "F1") {
        e.preventDefault();
        handleSave();
        return;
      }
      if (e.key === "F3") {
        e.preventDefault();
        handleF3SendAll();
        return;
      }
      if (e.key === "F4") {
        e.preventDefault();
        handleF4Download();
        return;
      }
      if (e.key === "F5") {
        e.preventDefault();
        handleF5SendItems();
        return;
      }
      if (e.key === "F6") {
        e.preventDefault();
        handleF6SendCustomer();
        return;
      }
      if (e.ctrlKey && (e.key === "m" || e.key === "M")) {
        e.preventDefault();
        createStatusRef.current = 1;
        return;
      }
      if (e.ctrlKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        handleDeleteCompany();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        confirm("Do You Want To Quit Page?").then((ok) => { if (ok) navigate("/Home"); });
        return;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [
    isAuthorized, handleSave, handleF3SendAll, handleF4Download, handleF5SendItems,
    handleF6SendCustomer, handleDeleteCompany, confirm, navigate,
  ]);
  

  // ─────────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  if (!isAuthorized) {
    return (
      <div className="bm-shell" style={{ alignItems: "center", justifyContent: "center" }}>
        <div className="mp-ldr-box"><div className="mp-spin" /><span>Loading…</span></div>
      </div>
    );
  }

  return (
    <div className="bm-shell">
      {/* Topbar */}
      <Topbar />

      <div className="bm-layout">
        <div className="bm-card">
          <div className="bm-card-header">
            <div className="bm-card-header-title">Company</div>
            <button
              type="button"
              className="bm-close-x"
              aria-label="Close"
              onClick={() => confirm("Do You Want To Quit Page?").then((ok) => { if (ok) navigate("/Home"); })}
            >
              ✕
            </button>
          </div>
          

          <div className="bm-card-body">
            <div className="bm-report-title">Company</div>

            {/* ── GRID ──────────────────────────────────────────────────────────── */}
            <div className="bm-grid-wrap">
              <table className="bm-tbl">
                <thead>
                  <tr>
                    <th className="sno-col" style={{ width: 50 }}>S.No</th>
                    {GRID_COLS.map((c) => (
                      <th key={c.key} style={{ minWidth: c.width }}>{c.label}</th>
                    ))}
                    <th style={{ width: 70 }}>Active</th>
                    <th className="del-col" style={{ width: 44 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {gridRows.map((row, rowIdx) => {
                    // Row is "locked" (display-only) until the Edit pencil is clicked.
                    // Brand-new blank rows (no CCode yet, Id null) are exempt so adding
                    // a new company still works exactly as before — there is no pencil
                    // icon for them anyway. Once the Edit icon sets EditMode=1, the row
                    // unlocks. This only gates typing + the visual highlight below;
                    // selectedCell/rowindexRef state updates (used by F3/F4/F5/F6/Ctrl+D)
                    // are left completely unchanged so that business logic is untouched.
                    const isRowLocked = nullStr(row.CCode) !== "" && row.EditMode !== 1;
                    return (
                    // <tr
                    //   key={row._key}
                    //   className={`grid-row${selectedCell.rowKey === row._key && !isRowLocked ? " row-active" : ""}`}
                    //   onClick={() => { setSelectedCell({ rowKey: row._key, colKey: selectedCell.colKey }); rowindexRef.current = row._key; }}
                    // >
                    <tr
  key={row._key}
  className={`grid-row${selectedCell.rowKey === row._key && !isRowLocked ? " row-active" : ""}`}
  onClick={() => { setSelectedCell({ rowKey: row._key, colKey: selectedCell.colKey }); rowindexRef.current = row._key; }}
  onDoubleClick={() => {
    // mirrors the CName-Enter behaviour: only switch for an already-saved row
    if (row.Id != null && row.Id !== 0 && row.Id !== "") {
      switchToSelectedCompany(row.Id);
    }
  }}
>
  
                      <td className="grid-cell sno-col">{rowIdx + 1}</td>
                      {GRID_COLS.map((col) => {
                          const isSelected = selectedCell.rowKey === row._key && selectedCell.colKey === col.key && !isRowLocked;
                          const val = row[col.key] ?? "";
                          return (
                            <td
                              key={col.key}
                              className={`grid-cell${isSelected ? " selected" : ""}`}
                              style={{ minWidth: col.width }}
                              onClick={() => {                                    // NEW
                                setSelectedCell({ rowKey: row._key, colKey: col.key });
                                rowindexRef.current = row._key;
                              }}
                            >

<input
  id={`cell_${row._key}_${col.key}`}
  className="cell-input"
  value={val}
  maxLength={col.maxLen}
  inputMode={col.type === "int" ? "numeric" : "text"}
  readOnly={isRowLocked}
  tabIndex={isRowLocked ? -1 : 0}
  onMouseDown={(e) => { if (isRowLocked) e.preventDefault(); }}
  onChange={(e) => handleCellChange(row._key, col.key, e.target.value, col)}
  onDoubleClick={() => {
    if (col.key === "CName" && row.Id != null && row.Id !== 0 && row.Id !== "") {
      switchToSelectedCompany(row.Id);
    }
  }}
  onFocus={(e) => { /* unchanged */ }}
  onKeyDown={(e) => handleGridKeyDown(e, row._key, col.key)}
  autoComplete="off"
/>
      </td>
                        );
                      })}
                      <td className={`grid-cell${selectedCell.rowKey === row._key && selectedCell.colKey === "CStatus" && !isRowLocked ? " selected" : ""}`} style={{ textAlign: "center" }}>
                        <input
                          id={`cell_${row._key}_CStatus`}
                          type="checkbox"
                          checked={!!row.CStatus}
                          disabled={isRowLocked}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setGridRows((prev) => prev.map((r) =>
                              r._key === row._key ? { ...r, CStatus: checked, EditMode: 1 } : r
                            ));
                          }}
                          onFocus={() => { setSelectedCell({ rowKey: row._key, colKey: "CStatus" }); rowindexRef.current = row._key; }}
                          onKeyDown={(e) => handleGridKeyDown(e, row._key, "CStatus")}
                        />
                      </td>
                      {/* <td className="grid-cell del-col">
                        {nullStr(row.CCode) !== "" && (
                          <button
                            className="bm-icon-btn del"
                            title="Delete"
                            onClick={() => {
                              if (row.Id != null && row.Id !== 0 && row.Id !== "") {
                                handleDeleteCompany(row._key);
                              } else {
                                setGridRows((prev) => {
                                  let next = prev.filter((r) => r._key !== row._key);
                                  if (next.length === 0) next = [makeGridRow()];
                                  return next;
                                });
                              }
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td> */}
                      <td className="grid-cell del-col">
  {nullStr(row.CCode) !== "" && (
    <button
      className="bm-icon-btn edit"
      title="Edit"
      onClick={() => {
        setGridRows((prev) => prev.map((r) =>
          r._key === row._key ? { ...r, EditMode: 1 } : r
        ));
        setSelectedCell({ rowKey: row._key, colKey: GRID_COLS[0].key });
        rowindexRef.current = row._key;
        setTimeout(() => focusCell(row._key, GRID_COLS[0].key), 50);
      }}
    >
      <Pencil size={15} />
    </button>
  )}
</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Toolbar ── */}
            <div className="bm-actions">
              <button className="mp-btn sv" onClick={handleSave} disabled={loading}>
                <Save size={16} />
                F1 Save
              </button>
              <button className="mp-btn ob" onClick={handleF3SendAll} disabled={loading}>
                <Send size={16} />
                F3 Send All
              </button>
              <button className="mp-btn exup" onClick={handleF4Download} disabled={loading}>
                <Download size={16} />
                F4 Download
              </button>
              <button className="mp-btn rf" onClick={handleF5SendItems} disabled={loading}>
                <Send size={16} />
                F5 Send Items
              </button>
              <button className="mp-btn sb" onClick={handleF6SendCustomer} disabled={loading}>
                <Users size={16} />
                F6 Send Customer
              </button>
              {/* <button className="mp-btn sb" onClick={() => handleDeleteCompany()} disabled={loading}>
                <Trash2 size={16} />
                Ctrl+D Delete
              </button> */}
              <button
                className="mp-btn cn"
                onClick={() => confirm("Do You Want To Quit Page?").then((ok) => { if (ok) navigate("/Home"); })}
                disabled={loading}
              >
                <XCircle size={16} />
                Esc Quit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Loading overlay ───────────────────────────────────────────────────── */}
      {loading && (
        <div className="mp-loader-ov">
          <div className="mp-ldr-box">
            <div className="mp-spin" />
            <span className="mp-ldr-msg">Processing…</span>
          </div>
        </div>
      )}

      {/* Toast list */}
      <MSG.ToastList toasts={toasts} />

      {/* Confirm UI */}
      {ConfirmUI}
    </div>
  );
}
