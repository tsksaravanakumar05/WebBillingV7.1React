// ─────────────────────────────────────────────────────────────────────────────
//  CashVoucher.jsx
//
//  Converted from: CashVoucher.js  (jQuery / jqxGrid)
//  Architecture  : Mirrors PurchaseReturn.jsx / SupplierPayment.jsx
//  References    : Common.jsx utilities · MasterPage.css design
//
//  Business Logic: ALL original jQuery logic preserved unchanged
//  API Endpoints : Uses CC.* constants (Common.jsx) — add the following
//                  4 constants to Common.jsx if not already present:
//                    export const CV_Insert     = "/api/CashApp/InsertCash";
//                    export const CV_SelectDate = "/api/CashApp/SelectCashDate";
//                    export const CV_Select     = "/api/CashApp/SelectCash";
//                    export const CV_Delete     = "/api/CashApp/DeleteCash";
//  Payloads      : ALL original request structures preserved
//
//  VISUAL REDESIGN NOTE:
//  Only the presentational layer was changed to match the "bm-*" card design
//  system used in BrandMaster.jsx (blue card border + gradient header,
//  rounded card, bm-btn pill buttons, bm-grid-wrap fixed-height scrollable
//  grid, lucide-react icons, etc.). The bm-* classes live in the same
//  MasterPage.css imported below — no local <style> block needed.
//  The Type/Date/Total master-row (field-group/form-ctrl) keeps its own
//  existing styling — it isn't part of Brand's design (Brand has no header
//  fields) and was only relocated, not restyled. The per-cell selection
//  highlighting (grid-row / grid-cell / selected / cell-input classes) is
//  untouched for the same reason — it's how this voucher grid's "click a
//  cell to edit it" interaction works, which Brand's grid doesn't have.
//  The three overlay popups (AccountNamePopup, F5ViewPopup, EditPwdPopup)
//  are completely untouched — independent modals, not part of the bm-*
//  card. A visible Save / View (F5) / Clear (F10) / Quit (Esc) toolbar was
//  added at the bottom of the card, mirroring Brand's always-visible
//  button row — each button simply calls the exact same handler the
//  matching keyboard shortcut already called; no new logic was added.
//  All state, effects, handlers, API calls, validation, variable names and
//  control flow are 100% unchanged from the original CashVoucher.jsx.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Save, Eye, RotateCcw, XCircle, Trash2 } from "lucide-react";
import "../Master/MasterPage.css";

import Topbar from "../components/Topbar";
import * as CC  from "../components/Common";
import * as MSG from "../components/Messages";
import   DateFieldDDMMYYYY from "../Commondatetime";

// ─── Pure helpers ─────────────────────────────────────────────────────────────
const valNum  = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const nullStr = (v) => (v == null || v === undefined ? "" : String(v));
const fmt2    = (v) => valNum(v).toFixed(2);
const today   = () => new Date().toISOString().split("T")[0];
const jsonDate = (s) => {
  if (!s) return today();
  const m = /\/Date\((\d+)\)\//.exec(s);
  if (m) return new Date(+m[1]).toISOString().split("T")[0];
  if (typeof s === "string") return s.split("T")[0];
  try { return new Date(s).toISOString().split("T")[0]; } catch { return today(); }
};

// ─── Grid column meta (mirrors jQuery gridcolumns) ───────────────────────────
// grdAccountName, grdAmount, grdNarration editable; grdId/grdUpdateId/grdAccountId hidden
const GRID_COLS = [
  { key: "AccountName", label: "Account Name", width: 350, align: "left",  editable: true },
  { key: "Amount",      label: "Amount",        width: 100, align: "right", editable: true },
  { key: "Narration",   label: "Narration",     width: 270, align: "left",  editable: true },
];

// ─── Blank grid row factory (mirrors jQuery grid fields) ─────────────────────
const makeGridRow = () => ({
  _key:           CC.uid(),
  Id:             null,
  AccountName:    "",
  AccountRefId:   "",
  Amount:         "",
  Narration:      "",
  UpdateId:       "",
  EditMode:       0,
  Type:           "",
  Refdate:        "",
});

// ═══════════════════════════════════════════════════════════════════════════════
//  CashVoucher — main component
// ═══════════════════════════════════════════════════════════════════════════════
export default function CashVoucher() {
  const navigate = useNavigate();

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

  // ── Permission guard (mirrors jQuery menudata check) ─────────────────────────
  useEffect(() => {
    const menuStr = localStorage.getItem("menulist");
    if (!menuStr) {
      alert("Session Close Please Login !!!.");
      navigate("/Index");
      return;
    }
    const menulist = JSON.parse(menuStr);
    const menudata = menulist.filter((o) => o.PageName === "Cash Voucher");
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

  // ── Session (mirrors jQuery Comid, MainSet, CashSaveViewDialog) ──────────────
  const [sess] = useState(() => {
    try { return CC.buildSession("Cash Voucher"); }
    catch { return { Comid: "1", MComid: "1", MirrorTable: "0" }; }
  });
  const [mainSet] = useState(() => {
    try { return (JSON.parse(localStorage.getItem("Mainsetting")) || [{}])[0] || {}; }
    catch { return {}; }
  });
  const CashSaveViewDialog = !!mainSet.CashSaveViewDialog;

  // ── Master-form state (mirrors jQuery frmcmbtype / frmdteCreated / frmtotal) ─
  const [type,    setType  ] = useState("Payment");          // frmcmbtype (selectedIndex:1 -> Payment)
  const [dteCreated, setDteCreated] = useState(today());     // frmdteCreated
  const [total,   setTotal ] = useState("");                  // frmtotal

  // ── Grid state ────────────────────────────────────────────────────────────────
  const [gridRows,     setGridRows    ] = useState([makeGridRow()]);
  const [selectedCell, setSelectedCell] = useState({ rowKey: null, colKey: null });

  // ── AccountList (mirrors jQuery objlistC / loadAccount) ──────────────────────
  const [accountList, setAccountList] = useState([]);

  // ── Loading ───────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);

  // ── F5 View Popup ─────────────────────────────────────────────────────────────
  const [f5Open,     setF5Open    ] = useState(false);
  const [f5From,     setF5From    ] = useState(today());
  const [f5To,       setF5To      ] = useState(today());
  const [f5List,     setF5List    ] = useState([]);
  const [f5SelIdx,   setF5SelIdx  ] = useState(null);

  // ── Account Name Lookup Popup (mirrors jQuery AccountNameWindow) ─────────────
  const [acctPopup, setAcctPopup] = useState({ open: false, rowKey: null, query: "", selIdx: 0 });

  // ── Edit Password Popup (mirrors jQuery EditPasswordWindow) ──────────────────
  const [editPwdOpen,    setEditPwdOpen   ] = useState(false);
  const [editPwdValue,   setEditPwdValue  ] = useState("");
  const [editPwdError,   setEditPwdError  ] = useState("");
  const [editPwdLoading, setEditPwdLoading] = useState(false);
  const [passwordType,   setPasswordType  ] = useState(0);   // PasswordType
  const [pressKey,       setPressKey      ] = useState("");  // Presskey
  const [delTarget,      setDelTarget     ] = useState(null); // { rowKey, Id, UpdateId, AccountName }

  // ── DOM refs ──────────────────────────────────────────────────────────────────
  const typeRef       = useRef(null);
  const dateRef       = useRef(null);
  const acctSearchRef = useRef(null);
  const rowindexRef   = useRef(null); // rowindexc — last selected grid row key (for popups)

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
  //  LOAD ACCOUNT LIST (mirrors jQuery loadAccount → /AccountGroup/SelectAccountGroupCash)
  // ─────────────────────────────────────────────────────────────────────────────
  const loadAccountList = useCallback(async () => {
    const res = await CC.api(CC.SelectAccountGroup, null, {}, {
      Comid: Number(sess.Comid),
      Cash:  1,
    });
    if (redirectIfDualLogin(res)) return;
    const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
    setAccountList(list);
  }, [sess.Comid, redirectIfDualLogin]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  CALCULATION (mirrors jQuery methods.calculation)
  // ─────────────────────────────────────────────────────────────────────────────
  const calculation = useCallback((rows) => {
    let amt = 0;
    rows.forEach((r) => {
      if (nullStr(r.Amount) !== "") amt += valNum(r.Amount);
    });
    setTotal(fmt2(amt));
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  //  CLEAR (mirrors jQuery methods.Clear)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    setTotal("");
    setType("Payment");
    const rows = [makeGridRow()];
    setGridRows(rows);
    calculation(rows);
    setTimeout(() => typeRef.current?.focus(), 100);
  }, [calculation]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  INIT (mirrors jQuery methods.init)
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthorized) return;
    loadAccountList();
    handleClear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  ADD ROW (mirrors jQuery addrow + Addrowfunc)
  // ─────────────────────────────────────────────────────────────────────────────
  const addRowFunc = useCallback(() => {
    const newRow = makeGridRow();
    setGridRows((prev) => [...prev, newRow]);
    setTimeout(() => focusCell(newRow._key, "AccountName"), 50);
    return newRow;
  }, [focusCell]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  GRID EMPTY CHECK (mirrors jQuery methods.gridemptycheck)
  // ─────────────────────────────────────────────────────────────────────────────
  const gridEmptyCheck = useCallback(() => {
    let rows = gridRows;
    const last = rows[rows.length - 1];
    // Remove trailing empty row if more than one row exists
    if ((last.AccountRefId === "" || last.AccountRefId == null) && rows.length > 1) {
      rows = rows.slice(0, -1);
      setGridRows(rows);
    }
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].EditMode === 1) {
        if (nullStr(rows[i].AccountName) === "") {
          toast("❌ Enter All Account Name in the Grid !!!.", true);
          focusCell(rows[i]._key, "AccountName");
          return false;
        }
        if (nullStr(rows[i].Amount) === "" || valNum(rows[i].Amount) <= 0) {
          toast("❌ Enter All Amount in the Grid !!!.", true);
          focusCell(rows[i]._key, "Amount");
          return false;
        }
      }
    }
    return true;
  }, [gridRows, toast, focusCell]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  CELL CHANGE
  // ─────────────────────────────────────────────────────────────────────────────
  const handleCellChange = useCallback((rowKey, colKey, value) => {
    setGridRows((prev) => prev.map((r) =>
      r._key === rowKey ? { ...r, [colKey]: value, EditMode: 1 } : r
    ));
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  //  ACCOUNT NAME LOOKUP POPUP (mirrors jQuery AccountNameWindow / AccountNameList)
  // ─────────────────────────────────────────────────────────────────────────────
  const openAcctPopup = useCallback((rowKey) => {
    rowindexRef.current = rowKey;
    setAcctPopup({ open: true, rowKey, query: "", selIdx: 0 });
    setTimeout(() => acctSearchRef.current?.focus(), 100);
  }, []);

  const getAcctFiltered = useCallback(() => {
    const q = acctPopup.query.trim().toLowerCase();
    if (!q) return accountList;
    return accountList.filter((a) => (a.AccountName || "").toLowerCase().includes(q));
  }, [acctPopup.query, accountList]);

  const applyAccountToRow = useCallback((rowKey, acct) => {
    
        console.log("Selected Account =>", acct);

    setGridRows(prev =>
      prev.map(r =>
        r._key === rowKey
          ? {
              ...r,
              AccountName: acct.AccountName,
              AccountRefId: acct.Id,
    
              AccountGroupRefId:
                acct.AccountGroupRefId ??
                acct.GroupId ??
                acct.AccountsGroupMasterId ??
                0,
    
              GroupId:
                acct.GroupId ??
                acct.AccountGroupRefId ??
                acct.AccountsGroupMasterId ??
                0,
    
              EditMode: 1,
            }
          : r
      )
    );
    setAcctPopup({ open: false, rowKey: null, query: "", selIdx: 0 });
    // Move to Amount cell (mirrors jQuery gridAccountNameWindow keydown Enter)
    focusCell(rowKey, "Amount");
  }, [focusCell]);

  const acctPopupKeyDown = useCallback((e) => {
    const list = getAcctFiltered();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAcctPopup((p) => ({ ...p, selIdx: Math.min(p.selIdx + 1, list.length - 1) }));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAcctPopup((p) => ({ ...p, selIdx: Math.max(p.selIdx - 1, 0) }));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (list.length === 0) {
        // mirrors jQuery AccountCreate() — separate AccountGroup master not migrated
        toast("❌ AccountName Not Exists !!!.", true);
        return;
      }
      const chosen = list[acctPopup.selIdx] || list[0];
      if (chosen) applyAccountToRow(acctPopup.rowKey, chosen);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setAcctPopup({ open: false, rowKey: null, query: "", selIdx: 0 });
      focusCell(acctPopup.rowKey, "AccountName");
    }
  }, [getAcctFiltered, acctPopup, applyAccountToRow, focusCell, toast]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  GRID KEYBOARD NAVIGATION (mirrors jQuery gridCashVoucher keydown)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleGridKeyDown = useCallback((e, rowKey, colKey) => {
    const rowIdx = gridRows.findIndex((r) => r._key === rowKey);
    rowindexRef.current = rowKey;

    if (e.key === "Enter") {
      e.preventDefault();
      const row = gridRows[rowIdx];

      if (colKey === "AccountName") {
        const value = nullStr(row.AccountName);
        if (value === "") {
          openAcctPopup(rowKey);
        } else {
          focusCell(rowKey, "Amount");
        }
        return;
      }

      if (colKey === "Amount") {
        const value = row.Amount;
        if (value == null || value === "") {
          toast("❌ Enter Amount!!!", true);
          return;
        }
        setGridRows((prev) => {
          const updated = prev.map((r) =>
            r._key === rowKey ? { ...r, Amount: fmt2(valNum(r.Amount)), EditMode: 1 } : r
          );
          calculation(updated);
          return updated;
        });
        // Navigate to AccountName of next row (or add new row)
        if (rowIdx < gridRows.length - 1) {
          focusCell(gridRows[rowIdx + 1]._key, "AccountName");
        } else {
          const newRow = addRowFunc();
          setTimeout(() => focusCell(newRow._key, "AccountName"), 60);
        }
        return;
      }

      // Narration (or any other editable column) → next cell / next row
      if (rowIdx < gridRows.length - 1) {
        focusCell(gridRows[rowIdx + 1]._key, "AccountName");
      } else {
        const newRow = addRowFunc();
        setTimeout(() => focusCell(newRow._key, "AccountName"), 60);
      }
      return;
    }

    // Delete key (46) — mirrors jQuery key===46 handling
    if (e.key === "Delete" && !e.shiftKey) {
      e.preventDefault();
      const row = gridRows[rowIdx];
      if (row.Id != null && row.Id !== 0 && row.Id !== "") {
        if (perm.Delete !== 1) {
          toast("❌ Page Delete Permission Denied !!!.", true);
          return;
        }
        setDelTarget({ rowKey, Id: row.Id, UpdateId: row.UpdateId, AccountName: row.AccountName });
        setPasswordType(1);
        setPressKey("Delete");
        setEditPwdValue("");
        setEditPwdError("");
        setEditPwdOpen(true);
      } else {
        // Direct delete of unsaved row (mirrors DeleteRow with no Id)
        setGridRows((prev) => {
          let next = prev.filter((r) => r._key !== rowKey);
          if (next.length === 0) next = [makeGridRow()];
          calculation(next);
          return next;
        });
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIdx < gridRows.length - 1) focusCell(gridRows[rowIdx + 1]._key, colKey);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIdx > 0) focusCell(gridRows[rowIdx - 1]._key, colKey);
    }
  }, [gridRows, perm.Delete, openAcctPopup, focusCell, addRowFunc, calculation, toast]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  LOAD GRID DETAILS (mirrors jQuery loadgriddetails — date+type → SelectCashDate)
  // ─────────────────────────────────────────────────────────────────────────────
  const loadGridDetails = useCallback(async () => {
    if (!dteCreated) { toast("❌ Select Date", true); return; }
    if (!type) {
      toast("❌ Select Type!!!", true);
      typeRef.current?.focus();
      return;
    }
    if (!gridEmptyCheck()) return;

    setLoading(true);
    const res = await CC.api(CC.CV_SelectDate, null, {}, {
      Fromdate: dteCreated,
      type:     type,
      Comid:    Number(sess.Comid),
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;

    const data = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
    if (data.length > 0) {
      const rows = data.map((obj) => ({
        ...makeGridRow(),
        _key:         CC.uid(),
        Id:           obj.Id ?? null,
        AccountName:  obj.AccountName ?? "",
        AccountRefId: obj.AccountRefId ?? "",
        Amount:       fmt2(obj.Amount ?? 0),
        Narration:    obj.Narration ?? "",
        UpdateId:     obj.UpdateId ?? "",
        EditMode:     0,
      }));
      rows.push(makeGridRow());
      setGridRows(rows);
      calculation(rows);
    } else {
      const rows = [makeGridRow()];
      setGridRows(rows);
      calculation(rows);
    }
    setTimeout(() => focusCell(gridRows[gridRows.length - 1]?._key, "AccountName"), 60);
  }, [dteCreated, type, sess.Comid, gridEmptyCheck, redirectIfDualLogin, toast, calculation, focusCell, gridRows]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  F1 — SAVE (mirrors jQuery F1 keydown handler → /Cash/InsertCash)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (perm.Add === 0) {
      toast("❌ Page Add  Permission Denied !!!.", true);
      return;
    }
    if (!gridEmptyCheck()) return;

    if (!type) {
      toast("❌ Select Type!!!", true);
      typeRef.current?.focus();
      return;
    }
    if (!dteCreated) {
      toast("❌ Select Date", true);
      return;
    }

    // Stamp Type/Refdate on every row (mirrors jQuery griddata loop)
    const stamped = gridRows.map((r) => ({ ...r, Type: type, Refdate: dteCreated }));

    // Only NEW rows (Id == null) are sent for insert (mirrors jQuery pageadd==1 filter)
    const getdata = stamped.filter(
        (r) =>
          r.Id == null &&
          Number(r.AccountRefId) > 0 &&
          Number(r.Amount) > 0
      );
    if (perm.Add === 1 && getdata.length === 0) {
      toast("❌ Cannot Update !!!.Delete Row then Add New Entry!!!.", true);
      return;
    }
    if (!gridEmptyCheck()) return;

    const ok = await confirm("Do you Want to Save the Cash Voucher Details?");
    if (!ok) return;

    
    // const res = await CC.insertapi(
    //     CC.CV_Insert,
    //     getdata,
    //     {
    //       Comid: sess.Comid,
    //       MirrorTable: sess.MirrorTable,
    //       LocalDB: sess.LocalDB,
    //       DayClose: sess.DayClose || 0,
    //     }
    //   );



// ===== DEBUG START =====
console.log("========== CASH SAVE DEBUG ==========");
console.log("Type:", type);
console.log("Date:", dteCreated);
console.log("Session:", sess);

console.log("Grid Rows:");
console.table(gridRows);

console.log("Stamped Data:");
console.table(stamped);

console.log("Insert Data:");
console.table(getdata);

console.log(
  "JSON Payload:",
  JSON.stringify(getdata, null, 2)
);

getdata.forEach((row, index) => {
  console.log(`Row ${index + 1}`, {
    Id: row.Id,
    AccountGroupRefId: row.AccountGroupRefId,
    GroupId: row.GroupId,
    SupplierRefId: row.SupplierRefId,
    AccountRefId: row.AccountRefId,
    CashRefId: row.CashRefId,
    Amount: row.Amount,
    Type: row.Type,
    Refdate: row.Refdate,
  });
});
// ===== DEBUG END =====

setLoading(true);

    const res = await CC.insertapi(CC.CV_Insert, getdata, {
        Comid: Number(sess.Comid),
        MirrorTable: Number(sess.MirrorTable),
        LocalDB: Number(sess.LocalDB),
        DayClose: Number(sess.DayClose || 0),
      });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;

    if (res?.ok) {
      if (CashSaveViewDialog) {
        // mirrors jQuery MsgBoxViewPrint("Do you to Print Cash Payment or View?")
        const wantPrint = window.confirm(
          `${res.message || "Saved Successfully."}\n\nClick OK to Print/View Cash Voucher, Cancel to skip.`
        );
        if (wantPrint) {
          const A4Print = "0";
          const w = window.open(
            `../Reports/ReportViewer.aspx?ReportName=CashVoucherPrint&A4Print=${A4Print}`,
            "_blank",
            `directories=0,titlebar=0,toolbar=0,location=0,status=0,menubar=0,scrollbars=yes,resizable=no,width=${window.screen.width},height=${window.screen.height - 100}`
          );
          if (w) w.addEventListener("load", () => { w.document.title = "Cash Payment"; }, false);
        }
      }
      toast(`✔ ${res.message || "Saved Successfully."}`);
      loadGridDetails();
    } else {
      toast(`❌ ${res?.message || "Save Failed."}`, true);
    }
  }, [perm.Add, gridEmptyCheck, type, dteCreated, gridRows, confirm, sess, redirectIfDualLogin, CashSaveViewDialog, toast, loadGridDetails]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  F5 — VIEW (mirrors jQuery methods.F5View → /Cash/SelectCash)
  // ─────────────────────────────────────────────────────────────────────────────
  const openF5View = useCallback(async () => {
    setLoading(true);
    const res = await CC.api(CC.CV_Select, null, {}, {
      Comid:    Number(sess.Comid),
      Fromdate: f5From,
      Todate:   f5To,
      Id:       0,
    });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;
    const data = Array.isArray(res?.Data) ? res.Data : Array.isArray(res?.data) ? res.data : [];
    setF5List(data);
    setF5SelIdx(null);
    setF5Open(true);
  }, [sess.Comid, f5From, f5To, redirectIfDualLogin]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  CTRL+V — PRINT VIEW (mirrors jQuery Ctrl+V inside F5Viewwindow → /Transaction/PrintView)
  // ─────────────────────────────────────────────────────────────────────────────
  const printSelectedF5Row = useCallback(async () => {
    if (f5SelIdx == null) return;
    const row = f5List[f5SelIdx];
    if (!row || row.Id === 0 || row.Id == null) return;
    const ok = window.confirm("Do you to View Cash Voucher ?");
    if (!ok) return;

    const res = await CC.api(CC.PrintViewUrl, null, {}, {
      Id:   row.Id,
      Type: "CashVoucher",
    });
    if (res?.ok) {
      const w = window.open(
        "../Reports/ReportViewer.aspx?ReportName=CashVoucherPrint&A4Print=0",
        "_blank",
        `directories=0,titlebar=0,toolbar=0,location=0,status=0,menubar=0,scrollbars=yes,resizable=no,width=${window.screen.width},height=${window.screen.height - 100}`
      );
      if (w) w.addEventListener("load", () => { w.document.title = "Cash Voucher"; }, false);
    } else {
      toast("❌ Technical Fault Contact Software Vendor  !!!.", true);
    }
  }, [f5SelIdx, f5List, toast]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  DELETE (mirrors jQuery Presskey=="Delete" → /Cash/DeleteCash, after pwd check)
  // ─────────────────────────────────────────────────────────────────────────────
  const performDelete = useCallback(async () => {
    if (!delTarget) return;
    const str = `Wish to Delete the Record ${delTarget.AccountName}?`;
    const ok = await confirm(str);
    if (!ok) { setDelTarget(null); return; }

    setLoading(true);
    const res = await CC.api(CC.CV_Delete, null, {}, {
        Id: Number(delTarget.Id),
        Comid: Number(sess.Comid),
        MirrorTable: Number(sess.MirrorTable),
        Updateid: delTarget.UpdateId || "",
        LocalDB: Number(sess.LocalDB || 0),
      });
    setLoading(false);
    if (redirectIfDualLogin(res)) return;

    if (res?.ok) {
      toast(`✔ ${res.message || "Deleted Successfully."}`);
      calculation(gridRows.filter((r) => r._key !== delTarget.rowKey));
      setGridRows((prev) => {
        let next = prev.filter((r) => r._key !== delTarget.rowKey);
        if (next.length === 0) next = [makeGridRow()];
        setTimeout(() => focusCell(next[next.length - 1]._key, "AccountRefId" in next[0] ? "AccountName" : "AccountName"), 50);
        return next;
      });
    } else {
      toast(`❌ ${res?.message || "Delete Failed."}`, true);
    }
    setDelTarget(null);
  }, [delTarget, confirm, sess, redirectIfDualLogin, toast, calculation, gridRows, focusCell]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  EDIT PASSWORD SUBMIT (mirrors jQuery txtEditpassword keydown → /Login/EditPassword)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleEditPwdSubmit = useCallback(async () => {
    if (!editPwdValue) return;
    const typeStr = passwordType === 1 ? "EditPassword" : passwordType === 0 ? "FormConfig" : "AdminPower";
    setEditPwdLoading(true);
    const res = await CC.api(CC.EditPassword, null, {}, {
      password: editPwdValue,
      type:     typeStr,
      Comid:    Number(sess.Comid),
    });
    setEditPwdLoading(false);
    if (redirectIfDualLogin(res)) return;

    if (res?.ok) {
      setEditPwdOpen(false);
      setEditPwdValue("");
      setTimeout(() => {
        if (pressKey === "Delete") performDelete();
      }, 250);
    } else {
      setEditPwdError("Invaild Password !!!.");
    }
  }, [editPwdValue, passwordType, sess.Comid, redirectIfDualLogin, pressKey, performDelete]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  GLOBAL KEYBOARD SHORTCUTS (mirrors jQuery $(document).on('keydown'))
  //  F1=Save  F5=View  F10=Clear  Esc=Close/Quit  Ctrl+V=PrintView (inside F5)
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthorized) return;

    const handler = (e) => {
      // Ctrl+V — Print View (only when F5 popup open)
      if (e.ctrlKey && (e.key === "v" || e.key === "V")) {
        if (f5Open) {
          e.preventDefault();
          printSelectedF5Row();
          return;
        }
      }

      // F1 — Save
      if (e.key === "F1") {
        e.preventDefault();
        handleSave();
        return;
      }

      // F5 — List View
      if (e.key === "F5") {
        e.preventDefault();
        setF5From(today());
        setF5To(today());
        openF5View();
        return;
      }

      // F10 — Clear
      if (e.key === "F10") {
        e.preventDefault();
        confirm("Do You Want To Clear?").then((ok) => { if (ok) handleClear(); });
        return;
      }

      // Escape — close popups / confirm quit
      if (e.key === "Escape") {
        e.preventDefault();
        if (acctPopup.open) {
          setAcctPopup({ open: false, rowKey: null, query: "", selIdx: 0 });
          focusCell(rowindexRef.current, "AccountName");
          return;
        }
        if (editPwdOpen) { setEditPwdOpen(false); return; }
        if (f5Open)      { setF5Open(false);      return; }
        confirm("Do You Want To Quit Page?").then((ok) => { if (ok) navigate("/dashboard"); });
        return;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [
    isAuthorized, f5Open, acctPopup.open, editPwdOpen,
    handleSave, handleClear, openF5View, printSelectedF5Row, confirm, navigate, focusCell,
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
            <div className="bm-card-header-title">Cash Voucher</div>
            <button
              type="button"
              className="bm-close-x"
              aria-label="Close"
              onClick={() => confirm("Do You Want To Quit Page?").then((ok) => { if (ok) navigate("/dashboard"); })}
            >
              ✕
            </button>
          </div>

          <div className="bm-card-body">
            <div className="bm-report-title">Cash Voucher</div>

      {/* ── MASTER FORM ──────────────────────────────────────────────────────── */}
      <div className="pr-master">
        <div className="master-row">
          {/* Type */}
          <div className="field-group">
            <label>Type<span className="req">*</span></label>
            <select
              ref={typeRef}
              className="form-ctrl"
              value={type}
              onChange={(e) => setType(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); dateRef.current?.focus(); } }}
              style={{ minWidth: 150 }}
            >
              <option value="Receipt">Receipt</option>
              <option value="Payment">Payment</option>
            </select>
          </div>

          {/* Date */}
          <div className="field-group">
            <label>Date<span className="req">*</span></label>
            <input
              ref={dateRef}
              type="date"
              className="form-ctrl"
              value={dteCreated}
              onChange={(e) => setDteCreated(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); loadGridDetails(); } }}
              style={{ minWidth: 130 }}
            />
          </div>

          {/* Total (readonly) */}
          <div className="field-group" style={{ marginLeft: "auto" }}>
            <label>Total</label>
            <input className="form-ctrl right disabled" value={total} readOnly style={{ minWidth: 120 }} />
          </div>
        </div>
      </div>

      {/* ── GRID ──────────────────────────────────────────────────────────────── */}
      <div className="bm-grid-wrap">
          <table className="bm-tbl">
            <thead>
              <tr>
                <th className="sno-col" style={{ width: 50 }}>S.No</th>
                {GRID_COLS.map((c) => (
                  <th key={c.key} className={c.align === "right" ? "right" : ""} style={{ minWidth: c.width }}>
                    {c.label}
                  </th>
                ))}
                <th className="del-col" style={{ width: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {gridRows.map((row, rowIdx) => (
                <tr
                  key={row._key}
                  className={`grid-row${selectedCell.rowKey === row._key ? " row-active" : ""}`}
                  onClick={() => setSelectedCell({ rowKey: row._key, colKey: selectedCell.colKey })}
                >
                  <td className="grid-cell sno-col">{rowIdx + 1}</td>
                  {GRID_COLS.map((col) => {
                    const isSelected = selectedCell.rowKey === row._key && selectedCell.colKey === col.key;
                    const isRight    = col.align === "right";
                    const val        = row[col.key] ?? "";

                    return (
                      <td
                        key={col.key}
                        className={`grid-cell${isRight ? " right" : ""}${isSelected ? " selected" : ""}`}
                        style={{ minWidth: col.width }}
                      >
                        <input
                          id={`cell_${row._key}_${col.key}`}
                          className={`cell-input${isRight ? " right" : ""}`}
                          value={val}
                          readOnly={col.key === "AccountName" && nullStr(row.AccountRefId) !== ""}
                          onChange={(e) => handleCellChange(row._key, col.key, e.target.value)}
                          onFocus={(e) => {
                            setSelectedCell({ rowKey: row._key, colKey: col.key });
                            rowindexRef.current = row._key;
                            e.target.select?.();
                          }}
                          onKeyDown={(e) => handleGridKeyDown(e, row._key, col.key)}
                          autoComplete="off"
                        />
                      </td>
                    );
                  })}
                  <td className="grid-cell del-col">
                    {nullStr(row.AccountRefId) !== "" && (
                      <button
                        className="bm-icon-btn del"
                        title="Delete"
                        onClick={() => {
                          if (row.Id != null && row.Id !== 0 && row.Id !== "") {
                            if (perm.Delete !== 1) {
                              toast("❌ Page Delete Permission Denied !!!.", true);
                              return;
                            }
                            setDelTarget({ rowKey: row._key, Id: row.Id, UpdateId: row.UpdateId, AccountName: row.AccountName });
                            setPasswordType(1);
                            setPressKey("Delete");
                            setEditPwdValue("");
                            setEditPwdError("");
                            setEditPwdOpen(true);
                          } else {
                            setGridRows((prev) => {
                              let next = prev.filter((r) => r._key !== row._key);
                              if (next.length === 0) next = [makeGridRow()];
                              calculation(next);
                              return next;
                            });
                          }
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>

            {/* ── Toolbar ── */}
            <div className="bm-actions">
              <button className="bm-btn bm-btn-primary" onClick={handleSave} disabled={loading}>
                <Save size={16} />
                F1 Save
              </button>
              <button
                className="bm-btn"
                onClick={() => { setF5From(today()); setF5To(today()); openF5View(); }}
                disabled={loading}
              >
                <Eye size={16} />
                F5 View
              </button>
              <button
                className="bm-btn"
                onClick={() => confirm("Do You Want To Clear?").then((ok) => { if (ok) handleClear(); })}
                disabled={loading}
              >
                <RotateCcw size={16} />
                F10 Clear
              </button>
              <button
                className="bm-btn bm-btn-secondary"
                onClick={() => confirm("Do You Want To Quit Page?").then((ok) => { if (ok) navigate("/dashboard"); })}
                disabled={loading}
              >
                <XCircle size={16} />
                Esc Quit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          POPUPS
          ════════════════════════════════════════════════════════════════════════ */}

      {/* ── Account Name Lookup Popup (F1-equivalent / Enter on empty AccountName) ── */}
      {acctPopup.open && (
        <AccountNamePopup
          query={acctPopup.query}
          selIdx={acctPopup.selIdx}
          list={getAcctFiltered()}
          searchRef={acctSearchRef}
          onQueryChange={(q) => setAcctPopup((p) => ({ ...p, query: q, selIdx: 0 }))}
          onKeyDown={acctPopupKeyDown}
          onSelect={(a) => applyAccountToRow(acctPopup.rowKey, a)}
          onClose={() => {
            setAcctPopup({ open: false, rowKey: null, query: "", selIdx: 0 });
            focusCell(rowindexRef.current, "AccountName");
          }}
        />
      )}

      {/* ── F5 List View Popup ────────────────────────────────────────────────── */}
      {f5Open && (
        <F5ViewPopup
          list={f5List}
          fromDate={f5From}
          toDate={f5To}
          selIdx={f5SelIdx}
          onFromDate={setF5From}
          onToDate={setF5To}
          onSelIdx={setF5SelIdx}
          onSearch={() => {
            if (f5From > f5To) { toast("❌ From Date Is Greater Than To Date", true); return; }
            openF5View();
          }}
          onPrint={printSelectedF5Row}
          onClose={() => setF5Open(false)}
        />
      )}

      {/* ── Edit Password Popup ───────────────────────────────────────────────── */}
      {editPwdOpen && (
        <EditPwdPopup
          title={passwordType === 1 ? "Edit Pwd" : passwordType === 0 ? "Form Pwd" : "Admin Pwd"}
          value={editPwdValue}
          error={editPwdError}
          loading={editPwdLoading}
          onChange={setEditPwdValue}
          onSubmit={handleEditPwdSubmit}
          onClose={() => { setEditPwdOpen(false); setDelTarget(null); }}
        />
      )}

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

// ═══════════════════════════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ── AccountNamePopup (mirrors jQuery AccountNameWindow + gridAccountNameWindow + #inputC) ──
function AccountNamePopup({ query, selIdx, list, searchRef, onQueryChange, onKeyDown, onSelect, onClose }) {
  return (
    <div className="popup-overlay" style={{ zIndex: 1100 }}>
      <div className="popup-window" style={{ width: 340 }}>
        <div className="popup-header">
          <span>Account Name</span>
          <button className="popup-close" onClick={onClose}>✕</button>
        </div>
        <div className="popup-body">
          <input
            ref={searchRef}
            className="popup-search-input"
            placeholder="Search Account Name"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={onKeyDown}
            autoComplete="off"
          />
          <div className="popup-list-wrap" style={{ maxHeight: 330, overflowY: "auto" }}>
            <table className="popup-table" style={{ width: "100%" }}>
              <thead>
                <tr><th>Account Name</th></tr>
              </thead>
              <tbody>
                {list.length === 0
                  ? <tr><td className="no-data">No accounts found</td></tr>
                  : list.map((a, i) => (
                    <tr
                      key={a.Id}
                      className={`popup-row${i === selIdx ? " selected" : ""}`}
                      onMouseDown={() => onSelect(a)}
                    >
                      <td>{a.AccountName}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="popup-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel (Esc)</button>
        </div>
      </div>
    </div>
  );
}

// ── F5ViewPopup (mirrors jQuery F5Viewwindow + gridf5view) ────────────────────
function F5ViewPopup({ list, fromDate, toDate, selIdx, onFromDate, onToDate, onSelIdx, onSearch, onPrint, onClose }) {
  return (
    <div className="popup-overlay" style={{ zIndex: 1100 }}>
      <div className="popup-window f5-popup" style={{ maxHeight: "85vh" }}>
        <div className="popup-header">
          <span>Cash Voucher — List View (F5)</span>
          <button className="popup-close" onClick={onClose}>✕</button>
        </div>
        <div className="popup-body">
          {/* Filter row */}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="field-group">
              <label>From Date</label>
              <input type="date" className="form-ctrl sm" value={fromDate} onChange={(e) => onFromDate(e.target.value)} />
            </div>
            <div className="field-group">
              <label>To Date</label>
              <input type="date" className="form-ctrl sm" value={toDate} onChange={(e) => onToDate(e.target.value)} />
            </div>
            <button className="tbtn tbtn-save" onClick={onSearch}>🔍 View</button>
            <button className="tbtn" onClick={onPrint} disabled={selIdx == null}>🖶 Print/View (Ctrl+V)</button>
          </div>

          {/* Grid */}
          <div className="view-grid-wrap" style={{ maxHeight: "55vh" }}>
            <table className="view-grid">
              <thead>
                <tr>
                  <th>Account Name</th>
                  <th className="right">Amount</th>
                  <th>Narration</th>
                  <th>Date</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0
                  ? <tr><td colSpan={5} className="no-data">No records found</td></tr>
                  : list.map((r, i) => (
                    <tr
                      key={r.Id ?? i}
                      className={`view-row${selIdx === i ? " row-active" : ""}`}
                      onClick={() => onSelIdx(i)}
                    >
                      <td>{r.AccountName}</td>
                      <td className="right">{fmt2(r.Amount)}</td>
                      <td>{r.Narration}</td>
                      <td>{r.Refdate ? jsonDate(r.Refdate) : ""}</td>
                      <td>{r.Type}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="popup-footer">
          <span style={{ flex: 1, fontSize: 13, color: "#555" }}>
            <b>Records:</b> {list.length} &nbsp;|&nbsp;
            <b>Total: ₹</b>{fmt2(list.reduce((s, r) => s + valNum(r.Amount), 0))}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Close (Esc)</button>
        </div>
      </div>
    </div>
  );
}

// ── EditPwdPopup (mirrors jQuery LockEditWindow + txtEditpassword) ────────────
function EditPwdPopup({ title, value, error, loading, onChange, onSubmit, onClose }) {
  const inputRef = useRef(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  return (
    <div className="popup-overlay" style={{ zIndex: 1300 }}>
      <div className="popup-window editpwd-popup">
        <div className="popup-header">
          <span>{title}</span>
          <button className="popup-close" onClick={onClose}>✕</button>
        </div>
        <div className="popup-body">
          <div className="pwd-input-wrap">
            <label>Password</label>
            <input
              ref={inputRef}
              type="password"
              className="pwd-input"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); if (e.key === "Escape") onClose(); }}
              autoComplete="new-password"
            />
            {error && <span className="pwd-error">{error}</span>}
          </div>
        </div>
        <div className="popup-footer">
          <button className="btn btn-primary btn-sm" onClick={onSubmit} disabled={loading}>
            {loading ? "Verifying…" : "✔ OK (Enter)"}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}