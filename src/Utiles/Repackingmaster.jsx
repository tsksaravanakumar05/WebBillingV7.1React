// ─────────────────────────────────────────────────────────────────────────────
//  RepackingMaster.jsx
//  Converted from jQuery RepackingMaster.js → React
//  Follows the EXACT architecture of TransactionPassword.jsx + Common.jsx.
//
//  ✅ This file contains ONLY:
//    • CC.Repacking* endpoint name references (defined in Common.jsx)
//    • Payload preparation & business calculations
//    • CC.api / CC.insertapi / CC.deleteapi / CC.repackingEditPassword call sites
//    • UI state, grid logic, row/keyboard handling, validation flow
//
//  ❌ This file does NOT contain:
//    • fetch() direct calls
//    • Authorization / BASE_URL / token handling
//    • try/catch networking blocks
//    • Repeated toast/error handling logic
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Save, Plus, XCircle, Pencil, Trash2, ListFilter, Search, Lock } from "lucide-react";
import "../TransactionPassword.css";
import Topbar from "../components/Topbar";

import * as CC from "../components/Common";

// ── All endpoint constants live in Common.jsx — imported via CC.Repacking* / CC.ItemByCode ──
// ── Utility helpers ────────────────────────────────────────────────────────────
const valNum  = (v) => parseFloat(v) || 0;
const nullStr = (v) => (v == null ? "" : String(v));

const fmt2 = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? "0.00" : n.toFixed(2);
};

/** Format JS Date → "MM/dd/yyyy" for server */
const dateformat = (d) => {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return "";
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  const yy = dt.getFullYear();
  return `${mm}/${dd}/${yy}`;
};

/** Display date "dd/MM/yyyy" */
const displayDate = (d) => {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return "";
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dd}/${mm}/${dt.getFullYear()}`;
};

/** Parse "/Date(ms)/" or ISO string from server → JS Date */
const parseServerDate = (v) => {
  if (!v) return new Date();
  const m = String(v).match(/\/Date\((-?\d+)\)\//);
  if (m) return new Date(parseInt(m[1], 10));
  const d = new Date(v);
  return isNaN(d) ? new Date() : d;
};

/** Today as yyyy-MM-dd for <input type="date"> */
const todayISO = () => new Date().toISOString().slice(0, 10);

/** Convert Date → yyyy-MM-dd */
const toISO = (d) => {
  if (!d) return todayISO();
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return todayISO();
  return dt.toISOString().slice(0, 10);
};

/** Make a blank grid row */
const makeRow = () => ({
  _uid:               CC.uid(),
  EditMode:           1,
  Id:                 0,
  RepackingMasterRefId: 0,
  ItemsMasterRefId:   0,
  ProductCode:        "",
  ProductName:        "",
  StockQty:           "",
  NetWeight:          "",
  Qty:                "",
  RealQty:            0,
});

// ─────────────────────────────────────────────────────────────────────────────
export default function RepackingMaster() {
  const navigate = useNavigate();

  // ── Common hooks ─────────────────────────────────────────────────────────────
  const { confirm, ConfirmUI } = CC.useConfirm();
  const { toast,   toasts    } = CC.useToast();

  // ── Session / permissions ────────────────────────────────────────────────────
  const [sess] = useState(() => CC.buildSession("Company"));
  const perm   = sess.menudata[0] || { View: 1, Add: 1, Edit: 1, Delete: 1 };

  // ── Master state ─────────────────────────────────────────────────────────────
  const [refNo,       setRefNo]       = useState("");
  const [refDate,     setRefDate]     = useState(todayISO());
  const [masterItem,  setMasterItem]  = useState("");   // selected combo value (ProductMasterRefId)
  const [masterItemLabel, setMasterItemLabel] = useState("");
  const [totalWeight, setTotalWeight] = useState("0.00");
  const [totalQty,    setTotalQty]    = useState("0.00");

  // ── Grid state ───────────────────────────────────────────────────────────────
  const [grid,    setGrid]    = useState([makeRow()]);
  const [selIdx,  setSelIdx]  = useState(0);
  const [selCol,  setSelCol]  = useState(0);  // 0=ProductCode,1=Qty

  // ── Edit mode ────────────────────────────────────────────────────────────────
  const [editId,      setEditId]      = useState(0);
  const [realMWeight, setRealMWeight] = useState(0);
  const [realStockList, setRealStockList] = useState([]);

  // ── Combo list for master item ────────────────────────────────────────────────  // Combos
  const [comboList, setComboList]   = useState([]);
  const [gridComboList, setGridComboList] = useState([]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);

  // ── Password modal ───────────────────────────────────────────────────────────
  const [pwdOpen,   setPwdOpen]   = useState(false);
  const [pwdTitle,  setPwdTitle]  = useState("Edit Pwd");
  const [pwdValue,  setPwdValue]  = useState("");
  const [pressKey,  setPressKey]  = useState("");   // "F3" | "F5" | "F9" | "ESC"
  const pwdInputRef = useRef(null);

  // ── F5 view modal ────────────────────────────────────────────────────────────
  const [f5Open,        setF5Open]       = useState(false);
  const [f5FromDate,    setF5FromDate]   = useState(todayISO());
  const [f5ToDate,      setF5ToDate]     = useState(todayISO());
  const [f5List,        setF5List]       = useState([]);
  const [f5SelIdx,      setF5SelIdx]     = useState(null);
  const [f5ExpandedId,  setF5ExpandedId] = useState(null);
  const f5EditId = useRef(null);

  // ── Product picker popup ──────────────────────────────────────────────────────
  const [pickerOpen,    setPickerOpen]   = useState(false);
  const [pickerSearch,  setPickerSearch] = useState("");
  const [pickerList,    setPickerList]   = useState([]);
  const [pickerRowIdx,  setPickerRowIdx] = useState(0);
  const [pickerSelIdx,  setPickerSelIdx] = useState(0);
  const pickerSearchRef = useRef(null);

  // ── Refs ──────────────────────────────────────────────────────────────────────
  const dateRef      = useRef(null);
  const comboRef     = useRef(null);
  const codeRefs     = useRef([]);   // codeRefs.current[idx] = input
  const qtyRefs      = useRef([]);   // qtyRefs.current[idx]  = input

  // ─────────────────────────────────────────────────────────────────────────────
  // Initialise
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Permission check (mirrors jQuery menulist check)
    if (!sess.menudata || sess.menudata.length === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => navigate("/Home"), 3000);
      return;
    }
    if (perm.View === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => navigate("/Home"), 3000);
      return;
    }

    loadCombo();
    fetchMaxNo();
    // eslint-disable-next-line
  }, []);

  // Focus date on mount
  useEffect(() => { setTimeout(() => dateRef.current?.focus(), 200); }, []);


// ─────────────────────────────────────────────────────────────────────────────
// Combo loader  (mirrors loadRepackingMaster / RepackingItemComboList)
// ─────────────────────────────────────────────────────────────────────────────
// const loadCombo = useCallback(async () => {
//     // Comid-ஐ query param ஆக அனுப்புறோம்
//     const res = await CC.api(
//       CC.RepackingCombo,
//       null,
//       {},
//       { Comid: Number(sess.Comid) }
//     );
  
//     if (res && Array.isArray(res)) {
//       setComboList(res);
//     } else if (res && res.ok !== false && res.Data) {
//       setComboList(res.Data);
//     }
//   }, [sess.Comid]);

const loadCombo = useCallback(async () => {
  // Sending Comid as a query param
  const res = await CC.api(
    CC.RepackingCombo,
    null,
    {},
    { Comid: Number(sess.Comid) }
  );

  if (res && Array.isArray(res)) {
    setComboList(res);
  } else if (res && res.ok !== false) {
    const items = res.Data1 || res.data || [];
    setComboList(items);
    const gridItems = res.Data2 || res.data1 || [];
    setGridComboList(gridItems);
  }
}, [sess.Comid]);

// ─────────────────────────────────────────────────────────────────────────────
// Fetch max ref no
// ─────────────────────────────────────────────────────────────────────────────
const fetchMaxNo = useCallback(async () => {
    // Comid-ஐ query param ஆக அனுப்புறோம்
    const res = await CC.api(
      CC.RepackingMaxNo,
      null,
      {},
      { Comid: Number(sess.Comid) }
    );
  
    console.log("MaxNo Response:", res);
  
    if (res?.IsSuccess === true) {
      setRefNo(res.Data1 || "");
    }
  }, [sess.Comid]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Calculation (mirrors methods.calculation)
  // ─────────────────────────────────────────────────────────────────────────────
  const calculation = useCallback((rows) => {
    let weight = 0, qty = 0;
    (rows || grid).forEach(r => {
      weight += valNum(r.NetWeight) * valNum(r.Qty);
      qty    += valNum(r.Qty);
    });
    setTotalWeight(weight.toFixed(2));
    setTotalQty(qty.toFixed(2));
  }, [grid]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Clear / new (mirrors methods.Clear)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleClear = useCallback(async () => {
    setEditId(0);
    setTotalQty("0.00");
    setTotalWeight("0.00");
    setRealMWeight(0);
    setRealStockList([]);
    setMasterItem("");
    setMasterItemLabel("");
    setGrid([makeRow()]);
    setSelIdx(0);
    await fetchMaxNo();
    setRefDate(todayISO());
    setTimeout(() => dateRef.current?.focus(), 100);
  }, [fetchMaxNo]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Add row (mirrors addrow)
  // ─────────────────────────────────────────────────────────────────────────────
  const addRow = useCallback(() => {
    setGrid(prev => {
      const next = [...prev, makeRow()];
      setTimeout(() => {
        const idx = next.length - 1;
        setSelIdx(idx);
        codeRefs.current[idx]?.focus();
      }, 50);
      return next;
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Delete row (mirrors Delete key logic)
  // ─────────────────────────────────────────────────────────────────────────────
  const deleteRow = useCallback(async (idx) => {
    if (grid.length === 1) {
      // keep at least one row, just clear it
      setGrid([makeRow()]);
      calculation([makeRow()]);
      return;
    }
    const ok = await confirm("Do you Want to Delete Row?");
    if (!ok) return;
    setGrid(prev => {
      const next = prev.filter((_, i) => i !== idx);
      calculation(next);
      const newIdx = Math.min(idx, next.length - 1);
      setSelIdx(newIdx);
      setTimeout(() => codeRefs.current[newIdx]?.focus(), 50);
      return next;
    });
  }, [grid, confirm, calculation]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Update single cell value
  // ─────────────────────────────────────────────────────────────────────────────
  const updateCell = useCallback((idx, field, value) => {
    setGrid(prev => {
      const next = prev.map((r, i) =>
        i === idx ? { ...r, [field]: value, EditMode: 1 } : r
      );
      if (field === "Qty" || field === "NetWeight") calculation(next);
      return next;
    });
  }, [calculation]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Validation (mirrors gridemptycheck + masteremptycheck)
  // ─────────────────────────────────────────────────────────────────────────────
  const gridemptycheck = useCallback(() => {
    const rows = [...grid];
    // Remove last row if empty
    const last = rows[rows.length - 1];
    let working = rows;
    if (!last?.ProductCode && rows.length > 1) {
      working = rows.slice(0, -1);
      setGrid(working);
    }

    for (let i = 0; i < working.length; i++) {
      const r = working[i];
      if (r.EditMode !== 1) continue;
      if (!nullStr(r.ProductCode)) {
        toast("❌ Enter All code in the Grid !!!", true);
        setTimeout(() => codeRefs.current[i]?.focus(), 50);
        return false;
      }
      if (!nullStr(r.ProductName)) {
        toast("❌ Enter All ProductName in the Grid !!!", true);
        setTimeout(() => codeRefs.current[i]?.focus(), 50);
        return false;
      }
    }
    return working;
  }, [grid, toast]);

  const masteremptycheck = useCallback(() => {
    if (!refDate) { toast("❌ Select Date", true); return false; }
    if (!masterItem) { toast("❌ Select Master Product", true); return false; }
    if (valNum(totalWeight) < 0) { toast("❌ Total Weight invalid", true); return false; }
    return true;
  }, [refDate, masterItem, totalWeight, toast]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Save (F1 — mirrors keyCode 112 handler)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (perm.Add === 0) { toast("❌ Page Add Permission Denied !!!", true); return; }

    const validRows = gridemptycheck();
    if (!validRows) return;
    if (!masteremptycheck()) return;

    if (validRows.length === 0) {
      toast("❌ No Data Modified, Cannot Update !!!", true); return;
    }

    const objmaster = {
      Id:                  editId,
      ProductMasterRefId:  Number(masterItem),
      RefDate:             dateformat(new Date(refDate)),
      TotalMasterWeight:   valNum(totalWeight),
      TotalMasterWeightOld: valNum(realMWeight),
      TotalDetailsQty:     valNum(totalQty),
      LandingCost:         0,
      Active:              true,
      Comid:               Number(sess.Comid),
    };

    // Strip React-internal fields before posting
    const objdetails = validRows.map(({ _uid, EditMode, ...r }) => r);

    const ok = await confirm("Do you Want to Save the Repacking Details?");
    if (!ok) { addRow(); return; }

    setLoading(true);
    try {
      const res = await CC.insertapi(
        CC.RepackingInsert,
        objdetails,
        {
          objmaster:       JSON.stringify(objmaster),
          objstockdetails: JSON.stringify(realStockList || []),
        }
      );
// ✅ FIX: Check both React-style 'ok' and C#-style 'IsSuccess'
const isSuccess = res?.IsSuccess === true || res?.ok === true;
      
// ✅ FIX: Safely extract the message regardless of uppercase/lowercase
let responseMsg = res?.Message || res?.message || "Save failed";

if (isSuccess) {
  toast("✅ " + (responseMsg !== "Save failed" ? responseMsg : "Saved successfully"));
  await handleClear();
} else {
  // If there's a deep C# error object returned from your catch block
  if (res?.error && res.error.Message) responseMsg = res.error.Message;
  toast("❌ " + responseMsg, true);
}

} finally {
setLoading(false);
}
  }, [
    perm, gridemptycheck, masteremptycheck, editId, masterItem,
    refDate, totalWeight, realMWeight, totalQty, sess, realStockList,
    confirm, addRow, handleClear, toast,
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  // F5 View (mirrors methods.F5View)
  // ─────────────────────────────────────────────────────────────────────────────
  const loadF5View = useCallback(async (fromDate, toDate) => {
    if (!fromDate || !toDate) return;

    if (fromDate > toDate) {
      toast("❌ From Date is greater than To Date", true);
      return;
    }

    setLoading(true);
    try {
      const params = {
        Comid: Number(sess.Comid),
        Fromdate: dateformat(new Date(fromDate)),
        Todate: dateformat(new Date(toDate)),
        Id: 0,
      };

      // Change this to pass parameters in the 4th argument
      const res = await CC.api(
        CC.RepackingSelect,
        null,    // body
        {},      // headers
        params   // query params
      );

      console.log("Repacking F5 Response:", res);

      if (!res) {
        toast("❌ No response from server", true);
        return;
      }

      if (res.ok === false || res.IsSuccess === false) {
        toast(`❌ ${res.message || res.Message || "Failed"}`, true);
        return;
      }

      const baseData =
        res.Data1 ||
        res.Data ||
        res.data ||
        [];

      if (!Array.isArray(baseData) || baseData.length === 0) {
        setF5List([]);
        setF5Open(true);
        return;
      }

      const masterList = baseData[0]?.purchasemaster || [];
      const detailsList = baseData[0]?.purchasedetails || [];

      const rows = masterList.map(m => ({
        ...m,
        purchasedetails: detailsList.filter(
          d => Number(d.PurchaseRefId) === Number(m.Id)
        ),
      }));

      setF5List(rows);
      setF5Open(true);

    } catch (err) {
      console.error(err);
      toast(`❌ ${err.message}`, true);
    } finally {
      setLoading(false);
    }
  }, [sess.Comid, toast]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Delete (F9 — mirrors keyCode 120 handler after password)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (override) => {
    // ✅ FIX: when called right after fillRepackingDetails() (F5 list Del
    // button), use the freshly returned record instead of editId/masterItem/
    // totalWeight/realStockList state — those won't reflect the just-issued
    // setX() calls until after the next render, so reading them here would
    // still be stale and send wrong/empty values to the delete API.
    const delId          = override?.Id ?? editId;
    const delRefNo        = override?.RefNo ?? refNo;
    const delMasterItem   = override?.ProductMasterRefId ?? masterItem;
    const delTotalWeight  = override ? override.TotalMasterWeight : totalWeight;
    const delStockList    = override?.StockDetails ?? realStockList;

    if (!delId || delId === 0) { toast("❌ No Delete Id !!!", true); return; }

    const str = `Do You Want TO Delete Repacking Master. This is Repacking No ${delRefNo}?`;
    const ok  = await confirm(str);
    if (!ok) return;

    setLoading(true);
    try {
      const res = await CC.insertapi(
        CC.RepackingDelete,
        delStockList || [],
        {
          Comid:              String(sess.Comid),
          Id:                 String(delId),
          OldMasterProductId: String(delMasterItem),
          OldNetWeight:       String(valNum(delTotalWeight)),
        }
      );
      if (res && res.ok) {
        toast("✅ " + (res.message || "Deleted"));
        await handleClear();
        // ✅ FIX: Refresh F5 grid after successful deletion so the deleted
        // record no longer appears in the list if it's reopened.
        await loadF5View(f5FromDate, f5ToDate);
      } else {
        toast("❌ " + (res?.message || "Delete failed"), true);
      }
    } finally {
      setLoading(false);
    }
  }, [
    editId, refNo, masterItem, totalWeight, realStockList,
    sess, confirm, handleClear, toast, loadF5View, f5FromDate, f5ToDate,
  ]);
// ─────────────────────────────────────────────────────────────────────────────
// Edit / load existing record (F3/F5 — mirrors FillRepackingdetails)
// ─────────────────────────────────────────────────────────────────────────────
const fillRepackingDetails = useCallback(async (Pid, PNo) => {
    setLoading(true);

    try {

      // FIX: Parameters-ஐ 4th argument-ல query param ஆக அனுப்புறோம்
      const url =
      `${CC.RepackingEdit}?Id=${Pid}&PNo=${PNo}&Comid=${Number(sess.Comid)}`;

    const res = await CC.api(url);

    // 🔍 Verify the raw API response shape (matches Repacking.js "data" callback)
    console.log("RepackingEdit Raw Response:", res);

      // ✅ FIX: Repacking.js checks `data.ok == true` — the legacy backend does NOT
      // always send `IsSuccess`. Accept BOTH conventions so a real success response
      // (ok:true) is never misclassified as a failure (this was why the detail
      // grid stayed empty even though the password step succeeded).
      const isSuccess = res?.ok === true || res?.IsSuccess === true;

      if (isSuccess) {

        // ✅ FIX: accept Data / Data1 / data casing, same defensive pattern already
        // used by loadF5View / loadCombo elsewhere in this file.
        const getdata = res.Data || res.Data1 || res.data || [];

        console.log("RepackingEdit getdata:", getdata);

        if (getdata.length > 0) {

          const master  = getdata[0];

          // ✅ FIX: accept objdetails in either casing returned by the server
          const details =
            master.objdetails || master.ObjDetails || master.Objdetails || [];

          console.log("RepackingEdit master:", master);
          console.log("RepackingEdit details (grid rows source):", details);

          const stockList = master.StockDetails || master.stockDetails || [];

          setRealStockList(stockList);
          setRefNo(master.RefNo || "");
          setRefDate(toISO(parseServerDate(master.RefDate)));

          setMasterItem(String(master.ProductMasterRefId || ""));
          setMasterItemLabel(master.ProductName || "");

          setRealMWeight(master.TotalMasterWeight || 0);

          setTotalWeight((master.TotalMasterWeight || 0).toFixed(2));

          setTotalQty((master.TotalDetailsQty || 0).toFixed(0));

          setEditId(master.Id);

          // ✅ FIX: build grid rows from `details` regardless of array length,
          // and log the mapped rows so any future field-mapping issue is visible
          // immediately in the console instead of silently rendering an empty grid.
          const rows = details.length > 0
            ? details.map(d => ({
                _uid:                 CC.uid(),
                EditMode:             0,
                Id:                   d.Id || 0,
                RepackingMasterRefId: d.RepackingMasterRefId || 0,
                ItemsMasterRefId:     d.ItemsMasterRefId || 0,
                ProductCode:          d.ProductCode || "",
                ProductName:          d.ProductName || "",
                StockQty:             parseFloat(d.StockQty || 0).toFixed(0),
                NetWeight:            parseFloat(d.NetWeight || 0).toFixed(3),
                Qty:                  parseFloat(d.Qty || 0).toFixed(0),
                RealQty:              d.RealQty || 0,
              }))
            : [makeRow()];

          console.log("RepackingEdit mapped grid rows:", rows);

          setGrid(rows);
          setSelIdx(0);

          calculation(rows);

          // ✅ FIX: return the freshly loaded record so callers that need to
          // act immediately (e.g. delete-right-after-load) can use these
          // values directly, instead of reading state/closures that won't
          // reflect the setX() calls above until after the next render.
          return {
            Id:                 master.Id,
            RefNo:              master.RefNo || "",
            ProductMasterRefId: master.ProductMasterRefId,
            TotalMasterWeight:  master.TotalMasterWeight || 0,
            StockDetails:       stockList,
          };
        } else {
          // Success response but no master record found for this number/id
          toast("❌ No Repacking record found !!!", true);
          return null;
        }

      } else {

        toast("❌ " + (res?.message || res?.Message || "Load failed"), true);
        return null;

      }

    } finally {

      setLoading(false);

    }

  }, [sess.Comid, calculation, toast]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Product picker — search & fill (mirrors FillItemsCode / productwindow)
  // ─────────────────────────────────────────────────────────────────────────────
  const openProductPicker = useCallback((rowIdx) => {
    setPickerRowIdx(rowIdx);
    setPickerSearch("");
    setPickerSelIdx(0);
    setPickerList(gridComboList);
    setPickerOpen(true);
    setTimeout(() => pickerSearchRef.current?.focus(), 100);
  }, [gridComboList]);

  const fillItemsFromObject = useCallback((obj, rowIdx) => {
    setGrid(prev => {
      const next = prev.map((r, i) =>
        i === rowIdx
          ? {
              ...r,
              EditMode:         1,
              ItemsMasterRefId: obj.Id || obj.ItemsMasterRefId || obj.ProductMasterRefId || obj.Itemid || 0,
              ProductCode:      obj.ProductCode || obj.Productcode || "",
              ProductName:      obj.ProductName || obj.Productname || "",
              StockQty:         parseFloat(obj.Stock || obj.StockQty || obj.stock || 0).toFixed(0),
              NetWeight:        parseFloat(obj.NetWeight || obj.netweight || obj.Netweight || 0).toFixed(3),
            }
          : r
      );
      calculation(next);
      return next;
    });
    setTimeout(() => qtyRefs.current[rowIdx]?.focus(), 60);
  }, [calculation]);

  const handlePickerSelect = useCallback((code, rowIdx) => {
    setPickerOpen(false);
    if (!code) return;
    
    const selectedItem = gridComboList.find(p => 
      String(p.ProductCode || p.Productcode || "").toUpperCase() === String(code).toUpperCase()
    );
    
    if (selectedItem) {
      fillItemsFromObject(selectedItem, rowIdx);
    } else {
      toast("❌ Invalid Product Code !!!", true);
      setTimeout(() => codeRefs.current[rowIdx]?.focus(), 50);
    }
  }, [gridComboList, fillItemsFromObject, toast]);

  const handleCodeEnter = useCallback((rowIdx, codeVal) => {
    if (!codeVal.trim()) {
      openProductPicker(rowIdx);
      return;
    }
    
    const list = gridComboList.filter(p => 
      String(p.ProductCode || p.Productcode || "").toUpperCase() === codeVal.trim().toUpperCase()
    );

    if (!list.length) {
      toast("❌ Invalid Product Code !!!", true);
      setTimeout(() => codeRefs.current[rowIdx]?.focus(), 50);
      return;
    }
    if (list.length === 1) {
      fillItemsFromObject(list[0], rowIdx);
    } else {
      // Multiple matches → open picker with results
      setPickerList(list);
      setPickerRowIdx(rowIdx);
      setPickerSearch(codeVal);
      setPickerOpen(true);
      setTimeout(() => pickerSearchRef.current?.focus(), 100);
    }
  }, [gridComboList, fillItemsFromObject, openProductPicker, toast]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Password modal helpers (mirrors EditPasswordWindow)
  // ─────────────────────────────────────────────────────────────────────────────
  const openPwdModal = useCallback((type) => {
    const titles = { 1: "Edit Pwd", 0: "Form Pwd", 2: "Admin Pwd" };
    setPwdTitle(titles[type] || "Edit Pwd");
    setPwdValue("");
    setPwdOpen(true);
    setTimeout(() => pwdInputRef.current?.focus(), 200);
  }, []);

  // handlePwdConfirm — password modal confirm
  // ❌ No fetch()  ❌ No BASE_URL  ❌ No Authorization header
  // CC.repackingEditPassword() (defined in Common.jsx) handles all networking.
  const handlePwdConfirm = useCallback(async () => {
    if (!pwdValue) return;
    const typeMap = { 1: "EditPassword", 0: "FormConfig", 2: "AdminPower" };
    const typeStr = typeMap[1]; // always type=1 in original

    // ── Delegates all networking to Common.jsx ────────────────────────────────
    const res = await CC.repackingEditPassword({
      password: pwdValue,
      type:     typeStr,
      Comid:    sess.Comid,
    });

    if (res && res.ok === true) {
      setPwdOpen(false);
      // Now act on pressKey
      if (pressKey === "F3") {
        const value = prompt("Enter the Purchase Number", "");
        const num   = parseInt(value, 10);
        if (!isNaN(num) && num !== 0) {
          fillRepackingDetails(0, num);
        } else {
          toast("❌ Enter Valid Purchase Number !!!", true);
        }
      } else if (pressKey === "F5") {
        if (f5EditId.current != null) {
          setF5Open(false);
          fillRepackingDetails(f5EditId.current, 0);
          f5EditId.current = null;
        }
      } else if (pressKey === "F9") {
        // ✅ FIX: If delete was triggered from the F5 list's Del button, the
        // f5EditId ref holds the record Id but masterItem/totalWeight/
        // realStockList have NOT been populated yet (the F5 summary row
        // doesn't reliably carry StockDetails/ProductMasterRefId/
        // TotalMasterWeight). Load the full record first — exactly like the
        // F5 Edit button does — then pass the loaded record straight into
        // handleDelete() rather than relying on state, since setX() calls
        // inside fillRepackingDetails won't be reflected in this closure's
        // state variables until after the next render.
        if (f5EditId.current != null) {
          const loaded = await fillRepackingDetails(f5EditId.current, 0);
          f5EditId.current = null;
          if (loaded) await handleDelete(loaded);
        } else {
          // Keyboard-shortcut path (F9 while already editing a loaded record)
          // — state is already correct, so no override needed.
          await handleDelete();
        }
      }
    } else {
      alert("Invalid Password !!!.");
    }
  }, [pwdValue, pressKey, sess, fillRepackingDetails, handleDelete, toast]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Global keyboard shortcuts
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = async (e) => {
      // F1 — Save
      if (e.keyCode === 112) {
        e.preventDefault();
        await handleSave();
        return;
      }
      // F3 — Edit by ref no (password protected)
      if (e.keyCode === 114) {
        e.preventDefault();
        if (perm.Edit === 0) { toast("❌ Page Edit Permission Denied !!!", true); return; }
        setPressKey("F3");
        openPwdModal(1);
        return;
      }
      // F5 — View list
      if (e.keyCode === 116) {
        e.preventDefault();
        setF5FromDate(todayISO());
        setF5ToDate(todayISO());
        await loadF5View(todayISO(), todayISO());
        return;
      }
      // F9 — Delete (password protected)
      if (e.keyCode === 120) {
        e.preventDefault();
        if (perm.Delete === 0) { toast("❌ Page Delete Permission Denied !!!", true); return; }
        if (editId === 0) { toast("❌ No Delete Id !!!", true); return; }
        setPressKey("F9");
        openPwdModal(1);
        return;
      }
      // F10 — Clear
      if (e.keyCode === 121) {
        e.preventDefault();
        const ok = await confirm("Do You Want To Clear?");
        if (ok) await handleClear();
        return;
      }
      // Esc
      if (e.keyCode === 27) {
        e.preventDefault();
        if (pwdOpen) { setPwdOpen(false); return; }
        if (pickerOpen) { setPickerOpen(false); return; }
        if (f5Open) { setF5Open(false); return; }
        const ok = await confirm("Do You Want To Quit?");
        if (ok) navigate("/Home");
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    handleSave, handleClear, handleDelete, loadF5View,
    perm, editId, pwdOpen, pickerOpen, f5Open,
    openPwdModal, confirm, navigate, toast,
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Filtered picker list
  // ─────────────────────────────────────────────────────────────────────────────
  const filteredPicker = pickerList.filter(p => {
    const s = pickerSearch.toLowerCase();
    return !s
      || (p.ProductCode || "").toLowerCase().includes(s)
      || (p.ProductName || "").toLowerCase().includes(s);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Combo label lookup helper
  // ─────────────────────────────────────────────────────────────────────────────
  const getComboLabel = (val) => {
    const found = comboList.find(c =>
      String(c.Id || c.value || c.ProductMasterRefId) === String(val)
    );
    return found ? (found.ProductName || found.label || "") : "";
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="bm-shell">

      {/* ── Confirm Dialog ── */}
      {ConfirmUI}

      {/* ── Password Modal (mirrors LockEditWindow) ── */}
      {pwdOpen && (
        <div className="mp-modal-ov">
          <div className="mp-pwd-modal">
            <h3 style={{ marginBottom: 10, color: "#1a56db", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
              <Lock size={14} /> {pwdTitle}
            </h3>
            <input
              ref={pwdInputRef}
              type="password"
              className="mp-pwd-input"
              value={pwdValue}
              onChange={e => setPwdValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") { e.preventDefault(); handlePwdConfirm(); }
                if (e.key === "Escape") { e.preventDefault(); setPwdOpen(false); }
              }}
              placeholder="Password"
              autoComplete="off"
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
              <button className="bm-btn bm-btn-primary" onClick={handlePwdConfirm}>OK</button>
              <button className="bm-btn bm-btn-secondary" onClick={() => setPwdOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Product Picker (mirrors productwindow) ── */}
      {pickerOpen && (
        <div className="mp-picker-ov">
          <div className="mp-picker" style={{ width: 480, maxHeight: 500 }}>
            <header>
              <h3 style={{ display: "flex", alignItems: "center", gap: 6 }}><Search size={15} /> Product Search</h3>
              <button className="mp-picker-close" onClick={() => setPickerOpen(false)}>✕</button>
            </header>
            <div className="mp-picker-search">
              <input
                ref={pickerSearchRef}
                value={pickerSearch}
                onChange={e => {
                  setPickerSearch(e.target.value);
                  setPickerSelIdx(0);
                }}
                placeholder="Search code or name…"
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (filteredPicker.length > pickerSelIdx) {
                      const p = filteredPicker[pickerSelIdx];
                      handlePickerSelect(p.ProductCode || p.Productcode, pickerRowIdx);
                    }
                  }
                  if (e.key === "Escape") { setPickerOpen(false); }
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setPickerSelIdx(prev => {
                      const next = Math.min(prev + 1, Math.max(0, filteredPicker.length - 1));
                      setTimeout(() => document.getElementById("picker-row-" + next)?.scrollIntoView({ block: "nearest" }), 10);
                      return next;
                    });
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setPickerSelIdx(prev => {
                      const next = Math.max(prev - 1, 0);
                      setTimeout(() => document.getElementById("picker-row-" + next)?.scrollIntoView({ block: "nearest" }), 10);
                      return next;
                    });
                  }
                }}
              />
            </div>
            <div className="mp-picker-list">
              <table className="mp-picker-tbl">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>Code</th>
                    <th>Product Name</th>
                    <th style={{ width: 80, textAlign: "right" }}>Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPicker.map((p, i) => (
                    <tr
                      key={i}
                      id={`picker-row-${i}`}
                      className={pickerSelIdx === i ? "psel" : ""}
                      onDoubleClick={() =>
                        handlePickerSelect(p.ProductCode || p.Productcode, pickerRowIdx)
                      }
                      onClick={() => handlePickerSelect(p.ProductCode || p.Productcode, pickerRowIdx)}
                      style={{ cursor: "pointer" }}
                      onKeyDown={e => {
                        if (e.key === "Enter")
                          handlePickerSelect(p.ProductCode || p.Productcode, pickerRowIdx);
                      }}
                    >
                      <td>{p.ProductCode || p.Productcode}</td>
                      <td>{p.ProductName}</td>
                      <td style={{ textAlign: "right" }}>{parseFloat(p.Stock || 0).toFixed(0)}</td>
                    </tr>
                  ))}
                  {filteredPicker.length === 0 && (
                    <tr><td colSpan={3} style={{ textAlign: "center", color: "#aaa", padding: 12 }}>No results</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── F5 View Window (mirrors F5Viewwindow) ── */}

      {f5Open && (
  <div className="mp-modal-ov" style={{ alignItems: "flex-start", paddingTop: 60 }}>
    <div style={{
      background: "#fff",
      border: "2px solid #1a56db",
      borderRadius: 10,
      width: 820,
      maxHeight: "88vh",
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 4px 16px rgba(26,86,219,.18)"
    }}>

      {/* HEADER */}
      <div style={{
        background: "linear-gradient(135deg, #3b6fe0, #1a4fd1)",
        color: "#fff",
        padding: "12px 16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderRadius: "8px 8px 0 0"
      }}>
        <span style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <ListFilter size={15} /> Repacking List
        </span>
        <button
          onClick={() => setF5Open(false)}
          className="bm-close-x"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* FILTER BAR */}
      <div style={{
        padding: "10px 14px",
        borderBottom: "1px solid #deeafb",
        display: "flex",
        gap: 10,
        alignItems: "center",
        flexWrap: "wrap"
      }}>
        <label style={{ fontSize: 12 }}>From</label>
        <input type="date" value={f5FromDate} onChange={e => setF5FromDate(e.target.value)}
          style={{ height: 28, border: "1px solid #c5d8f8", borderRadius: 4 }} />

        <label style={{ fontSize: 12 }}>To</label>
        <input type="date" value={f5ToDate} onChange={e => setF5ToDate(e.target.value)}
          style={{ height: 28, border: "1px solid #c5d8f8", borderRadius: 4 }} />

        <button
          className="bm-btn bm-btn-primary"
          style={{ height: 28, padding: "0 14px" }}
          onClick={() => loadF5View(f5FromDate, f5ToDate)}
        >
          <Search size={13} /> View
        </button>
      </div>

      {/* TABLE */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <table className="bm-tbl" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th style={{ width: 60 }}>#</th>
              <th style={{ width: 120 }}>Ref No</th>
              <th style={{ width: 120 }}>Date</th>
              <th>Product</th>
              <th style={{ width: 120, textAlign: "center" }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {f5List.map((row, i) => (
              <React.Fragment key={row.Id || i}>

                {/* MAIN ROW */}
                <tr
                  onClick={() => setF5SelIdx(i)}
                  onDoubleClick={() => {
                    if (perm.Edit === 0) return toast("❌ No Permission", true);
                    f5EditId.current = row.Id;
                    setPressKey("F5");
                    setF5Open(false);
                    openPwdModal(1);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <td>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setF5ExpandedId(f5ExpandedId === row.Id ? null : row.Id);
                      }}
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        fontSize: 14,
                        marginRight: 6
                      }}
                    >
                      {f5ExpandedId === row.Id ? "▾" : "▸"}
                    </button>
                    {i + 1}
                  </td>

                  <td>{row.PurchaseNo || row.RefNo}</td>
                  <td>{displayDate(parseServerDate(row.PurchaseDate || row.RefDate))}</td>
                  <td>{row.SupplierName || row.ProductName}</td>

                  {/* ACTION BUTTONS FIXED */}
                  <td style={{ textAlign: "center", display: "flex", gap: 6, justifyContent: "center" }}>

                    <button
                      className="bm-icon-btn edit"
                      style={{ border: "1px solid #bfd4ff" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (perm.Edit === 0) { toast("❌ Page Edit Permission Denied !!!", true); return; }
                        f5EditId.current = row.Id;
                        setPressKey("F5");
                        setF5Open(false);
                        openPwdModal(1);
                      }}
                    >
                      <Pencil size={14} />
                    </button>

                    <button
                      className="bm-icon-btn del"
                      style={{ border: "1px solid #fecaca" }}
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (perm.Delete === 0) { toast("❌ Page Delete Permission Denied !!!", true); return; }
                        // ✅ FIX: don't guess masterItem/totalWeight/realStockList
                        // off the F5 summary row (those fields aren't reliably
                        // present there). Just record which Id to delete —
                        // handlePwdConfirm will load the full record via
                        // fillRepackingDetails before calling handleDelete().
                        f5EditId.current = row.Id;
                        setPressKey("F9");
                        setF5Open(false);
                        openPwdModal(1);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>

                  </td>
                </tr>

                {/* EXPAND ROW */}
                {f5ExpandedId === row.Id && (
                  <tr>
                    <td colSpan={5} style={{ background: "#f8fafc", padding: 0 }}>
                      <table style={{ width: "100%", fontSize: 11 }}>
                        <thead>
                          <tr style={{ background: "#e5edff" }}>
                            <th>Code</th>
                            <th>Description</th>
                            <th style={{ textAlign: "right" }}>Qty</th>
                            <th style={{ textAlign: "right" }}>Rate</th>
                          </tr>
                        </thead>

                        <tbody>
                          {(row.purchasedetails || []).map((d, di) => (
                            <tr key={di}>
                              <td>{d.ProductCode}</td>
                              <td>{d.ProductName}</td>
                              <td style={{ textAlign: "right" }}>{fmt2(d.ItemQty)}</td>
                              <td style={{ textAlign: "right" }}>{fmt2(d.PurchaseRate)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}

              </React.Fragment>
            ))}

            {f5List.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 16, color: "#999" }}>
                  No records found
                </td>
              </tr>
            )}

          </tbody>
        </table>
      </div>

      {/* FOOTER */}
      <div style={{
        padding: "8px 14px",
        borderTop: "1px solid #e5e7eb",
        display: "flex",
        justifyContent: "flex-end"
      }}>
        <button className="bm-btn bm-btn-secondary" onClick={() => setF5Open(false)}>
          <XCircle size={14} /> Close
        </button>
      </div>

    </div>
  </div>
)}
      {/* ── Header ── */}
      <Topbar />

      <div className="bm-layout">
        <div className="bm-card">
          <div className="bm-card-header">
            <div className="bm-card-header-title">Repacking Master</div>
            <button
              type="button"
              className="bm-close-x"
              aria-label="Close"
              onClick={async () => {
                const ok = await confirm("Do You Want To Quit?");
                if (ok) navigate("/Home");
              }}
            >✕</button>
          </div>

          <div className="bm-card-body">
            <div className="bm-report-title">Repacking Master</div>

        {/* ── Toolbar ── */}
        <div className="bm-actions" style={{ borderTop: "none", paddingTop: 0, marginTop: 0, justifyContent: "flex-start" }}>
          <button className="bm-btn bm-btn-primary" onClick={handleSave} disabled={loading}>
            <Save size={16} /> F1 Save
          </button>
          <button className="bm-btn" onClick={() => { loadF5View(todayISO(), todayISO()); }} disabled={loading}>
            <ListFilter size={16} /> F5 View
          </button>
          {editId !== 0 && (
            <button className="bm-btn bm-btn-secondary" onClick={() => { setPressKey("F9"); openPwdModal(1); }} disabled={loading}>
              <Trash2 size={16} /> F9 Delete
            </button>
          )}
          <button className="bm-btn" onClick={async () => {
            const ok = await confirm("Do You Want To Clear?");
            if (ok) handleClear();
          }} disabled={loading}>
            <XCircle size={16} /> F10 Clear
          </button>
          <button className="bm-btn" onClick={() => { setPressKey("F3"); openPwdModal(1); }} disabled={loading}>
            <Pencil size={16} /> F3 Edit
          </button>
          {editId !== 0 && (
            <span className="mp-msg ok">Editing #{refNo}</span>
          )}
        </div>

        {/* ── Master Form ── */}
        <div style={{
          background: "#fff", border: "1px solid #c7cdd6", borderRadius: 8,
          padding: "10px 14px", display: "flex", gap: 16,
          alignItems: "center", flexWrap: "wrap",
        }}>
          {/* Ref No */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#1a2e4a", whiteSpace: "nowrap" }}>
              Ref.No:
            </label>
            <input
              value={refNo}
              readOnly
              style={{
                height: 30, border: "1px solid #c7cdd6", borderRadius: 4,
                padding: "0 8px", fontSize: 12.5, width: 80, background: "transparent", color: "#000",
              }}
            />
          </div>

          {/* Date */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#1a2e4a" }}>Date:</label>
            <input
              ref={dateRef}
              type="date"
              value={refDate}
              onChange={e => setRefDate(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") { e.preventDefault(); comboRef.current?.focus(); }
              }}
              style={{
                height: 30, border: "1px solid #c7cdd6", borderRadius: 4,
                padding: "0 6px", fontSize: 12.5,
              }}
            />
          </div>

          {/* Master Item Combo */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 220 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#1a2e4a", whiteSpace: "nowrap" }}>
              Product:
            </label>
            <select
              ref={comboRef}
              value={masterItem}
              onChange={e => setMasterItem(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  // Focus first grid row code cell
                  if (grid.length > 0) codeRefs.current[0]?.focus();
                }
              }}
              style={{
                height: 30, border: "1px solid #c7cdd6", borderRadius: 4,
                padding: "0 6px", fontSize: 12.5, flex: 1, maxWidth: 260,
              }}
            >
              <option value="">-- Select Product --</option>
              {comboList.map((c, i) => (
                <option
                  key={i}
                  value={String(c.Id || c.value || c.ProductMasterRefId || "")}
                >
                  {c.ProductName || c.label || ""}
                </option>
              ))}
            </select>
          </div>

          {/* Totals */}
          <div style={{ display: "flex", gap: 20, marginLeft: "auto" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "#8b99b5", fontWeight: 600 }}>TOTAL WEIGHT</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1a56db" }}>{totalWeight}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "#8b99b5", fontWeight: 600 }}>TOTAL QTY</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1a2e4a" }}>{totalQty}</div>
            </div>
          </div>
        </div>

        {/* ── Grid ── */}
        <div className="bm-grid-wrap">
          <table className="bm-tbl">
            <thead>
              <tr>
                <th style={{ width: 50 }}>S.No</th>
                <th style={{ width: 120 }}>Product Code</th>
                <th style={{ minWidth: 280 }}>Description</th>
                <th style={{ width: 90, textAlign: "right" }}>Stock Qty</th>
                <th style={{ width: 90, textAlign: "right" }}>Weight</th>
                <th style={{ width: 100, textAlign: "right" }}>Quantity</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {grid.map((row, idx) => (
                <tr
                  key={row._uid}
                  className={[
                    selIdx === idx     ? "sel" : "",
                    row.EditMode === 1 ? "mod" : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => setSelIdx(idx)}
                >
                  <td className="sno">{idx + 1}</td>

                  {/* Product Code */}
                  <td>
                    <input
                      ref={el => { codeRefs.current[idx] = el; }}
                      className="bm-cell-input"
                      value={row.ProductCode}
                      onChange={e => updateCell(idx, "ProductCode", e.target.value.toUpperCase())}
                      onFocus={() => setSelIdx(idx)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCodeEnter(idx, row.ProductCode);
                        }
                        // Delete key — delete row
                        if (e.key === "Delete" && !row.ProductCode) {
                          e.preventDefault();
                          deleteRow(idx);
                        }
                      }}
                      placeholder="Code / F2"
                      maxLength={20}
                    />
                  </td>

                  {/* Product Name (read-only display) */}
                  <td>
                    <input
                      className="bm-cell-input"
                      value={row.ProductName}
                      readOnly
                      tabIndex={-1}
                    />
                  </td>

                  {/* Stock Qty */}
                  <td>
                    <input
                      className="bm-cell-input"
                      value={row.StockQty}
                      readOnly
                      tabIndex={-1}
                      style={{ textAlign: "right" }}
                    />
                  </td>

                  {/* Net Weight */}
                  <td>
                    <input
                      className="bm-cell-input"
                      value={row.NetWeight}
                      readOnly
                      tabIndex={-1}
                      style={{ textAlign: "right" }}
                    />
                  </td>

                  {/* Quantity */}
                  <td>
                    <input
                      ref={el => { qtyRefs.current[idx] = el; }}
                      className="bm-cell-input"
                      value={row.Qty}
                      type="number"
                      min="0"
                      onChange={e => updateCell(idx, "Qty", e.target.value)}
                      onFocus={() => setSelIdx(idx)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          // Move to next row code cell (mirrors GirdNextCell)
                          if (idx === grid.length - 1) {
                            addRow();
                          } else {
                            setSelIdx(idx + 1);
                            setTimeout(() => codeRefs.current[idx + 1]?.focus(), 40);
                          }
                          calculation(grid);
                        }
                        // Delete on empty qty
                        if (e.key === "Delete" && !String(row.Qty || "").trim()) {
                          e.preventDefault();
                          deleteRow(idx);
                        }
                      }}
                      style={{ textAlign: "right" }}
                    />
                  </td>

                  {/* Delete button */}
                  <td style={{ textAlign: "center" }}>
                    <button
                      className="bm-icon-btn del"
                      tabIndex={-1}
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
            <div className="bm-empty">No rows. Press Enter on Product Code to add.</div>
          )}
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
      <CC.ToastList toasts={toasts} />

    </div>
  );
}