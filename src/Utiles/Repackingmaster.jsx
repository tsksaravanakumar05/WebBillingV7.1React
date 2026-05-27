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

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../Utilesstyle/TransactionPassword.css";


import * as CC from "../components/Common";

// ── All endpoint constants live in Common.jsx — imported via CC.Repacking* / CC.ItemByCode ──
// ── Utility helpers ────────────────────────────────────────────────────────────
const valNum  = (v) => parseFloat(v) || 0;
const nullStr = (v) => (v == null ? "" : String(v));

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

  // ── Combo list for master item ────────────────────────────────────────────────
  const [comboList, setComboList]   = useState([]);

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
    // ✅ FIX: Use Data1 (or the lowercase 'data' mapped by CC.api)
    const items = res.Data1 || res.data || [];
    setComboList(items);
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
      
    //   // FIX: Handle both the C# ResponseViewModel (IsSuccess, Message) 
    //   // AND the C# anonymous error object (ok, message, error)
    //   const isSuccess = res?.IsSuccess === true || res?.ok === true;
      
    //   // Safely extract the message regardless of how the C# backend formatted it
    //   let responseMsg = "Save failed";
    //   if (res?.Message) responseMsg = res.Message;
    //   else if (res?.message) responseMsg = res.message;
    //   else if (res?.error && res?.error?.Message) responseMsg = res.error.Message;
    //   else if (res?.error && typeof res.error === 'string') responseMsg = res.error;

    //   if (isSuccess) {
    //     toast("✅ " + (responseMsg !== "Save failed" ? responseMsg : "Saved successfully"));
    //     await handleClear();
    //   } else {
    //     toast("❌ " + responseMsg, true);
    //   }

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
  // Delete (F9 — mirrors keyCode 120 handler after password)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (editId === 0) { toast("❌ No Delete Id !!!", true); return; }

    const str = `Do You Want TO Delete Repacking Master. This is Repacking No ${refNo}?`;
    const ok  = await confirm(str);
    if (!ok) return;

    setLoading(true);
    try {
      const res = await CC.insertapi(
        CC.RepackingDelete,
        realStockList || [],
        {
          Comid:              String(sess.Comid),
          Id:                 String(editId),
          OldMasterProductId: String(masterItem),
          OldNetWeight:       String(valNum(totalWeight)),
        }
      );
      if (res && res.ok) {
        toast("✅ " + (res.message || "Deleted"));
        await handleClear();
      } else {
        toast("❌ " + (res?.message || "Delete failed"), true);
      }
    } finally {
      setLoading(false);
    }
  }, [
    editId, refNo, masterItem, totalWeight, realStockList,
    sess, confirm, handleClear, toast,
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Edit / load existing record (F3/F5 — mirrors FillRepackingdetails)
  // ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Edit / load existing record (F3/F5 — mirrors FillRepackingdetails)
// ─────────────────────────────────────────────────────────────────────────────
const fillRepackingDetails = useCallback(async (Pid, PNo) => {
    setLoading(true);
  
    try {
  
      // FIX: Parameters-ஐ 4th argument-ல query param ஆக அனுப்புறோம்
      const res = await CC.api(
        CC.RepackingEdit,
        null,
        {},
        {
          Id: Pid,
          PNo: PNo,
          Comid: Number(sess.Comid)
        }
      );
  
      if (res?.IsSuccess === true) {
  
        const getdata = res.Data || [];
  
        if (getdata.length > 0) {
  
          const master  = getdata[0];
          const details = master.objdetails || [];
  
          setRealStockList(master.StockDetails || []);
          setRefNo(master.RefNo || "");
          setRefDate(toISO(parseServerDate(master.RefDate)));
  
          setMasterItem(String(master.ProductMasterRefId || ""));
  
          setRealMWeight(master.TotalMasterWeight || 0);
  
          setTotalWeight((master.TotalMasterWeight || 0).toFixed(2));
  
          setTotalQty((master.TotalDetailsQty || 0).toFixed(0));
  
          setEditId(master.Id);
  
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
  
          setGrid(rows);
  
          calculation(rows);
        }
  
      } else {
  
        toast("❌ " + (res?.message || "Load failed"), true);
  
      }
  
    } finally {
  
      setLoading(false);
  
    }
  
  }, [sess.Comid, calculation, toast]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Product picker — search & fill (mirrors FillItemsCode / productwindow)
  // ─────────────────────────────────────────────────────────────────────────────
  const openProductPicker = useCallback(async (rowIdx) => {
    setPickerRowIdx(rowIdx);
    setPickerSearch("");
    setPickerList([]);
    setPickerOpen(true);
    
    // Fix: body is null, empty headers {}, params go in 4th slot
    const res = await CC.api(
      CC.ItemByCode,
      null, 
      {}, 
      { code: "", Comid: Number(sess.MComid), CComid: Number(sess.Comid), Id: 0, Batchwise: 0 }
    );
    
    if (res && Array.isArray(res)) {
      setPickerList(res);
    } else if (res) {
        setPickerList(res.Data || res.Data1 || res.data || []);
      }
    setTimeout(() => pickerSearchRef.current?.focus(), 100);
  }, [sess]);

  const fillItemsFromObject = useCallback((obj, rowIdx) => {
    setGrid(prev => {
      const next = prev.map((r, i) =>
        i === rowIdx
          ? {
              ...r,
              EditMode:         1,
              ItemsMasterRefId: obj.Id,
              ProductCode:      obj.ProductCode || "",
              ProductName:      obj.ProductName || "",
              StockQty:         parseFloat(obj.Stock || 0).toFixed(0),
              NetWeight:        parseFloat(obj.NetWeight || 0).toFixed(3),
            }
          : r
      );
      calculation(next);
      return next;
    });
    setTimeout(() => qtyRefs.current[rowIdx]?.focus(), 60);
  }, [calculation]);

  const handlePickerSelect = useCallback(async (code, rowIdx) => {
    setPickerOpen(false);
    if (!code) return;
    setLoading(true);
    try {
      // Fix: body is null, empty headers {}, params go in 4th slot
      const res = await CC.api(
        CC.ItemByCode,
        null, 
        {}, 
        { code, Comid: Number(sess.MComid), CComid: Number(sess.Comid), Id: 0, Batchwise: 0 }
      );
      
      const list =
  Array.isArray(res)
    ? res
    : (res?.Data || res?.Data1 || res?.data || []);
      if (!list.length) {
        toast("❌ Invalid Product Code !!!", true);
        setTimeout(() => codeRefs.current[rowIdx]?.focus(), 50);
        return;
      }
      fillItemsFromObject(list[0], rowIdx);
    } finally {
      setLoading(false);
    }
  }, [sess, fillItemsFromObject, toast]);

  const handleCodeEnter = useCallback(async (rowIdx, codeVal) => {
    if (!codeVal.trim()) {
      openProductPicker(rowIdx);
      return;
    }
    setLoading(true);
    try {
      // Fix: body is null, empty headers {}, params go in 4th slot
      const res = await CC.api(
        CC.ItemByCode,
        null, 
        {}, 
        { code: codeVal.trim(), Comid: Number(sess.MComid), CComid: Number(sess.Comid), Id: 0, Batchwise: 0 }
      );
      
      const list =
  Array.isArray(res)
    ? res
    : (res?.Data || res?.Data1 || res?.data || []);
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
    } finally {
      setLoading(false);
    }
  }, [sess, fillItemsFromObject, openProductPicker, toast]);

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
  
      // ✅ Send as POST BODY like jQuery
      const payload = {
        Comid: Number(sess.Comid),
        Fromdate: dateformat(new Date(fromDate)),
        Todate: dateformat(new Date(toDate)),
        Id: 0,
      };
  
      const res = await CC.api(
        CC.RepackingSelect,
        payload
      );
  
      if (res?.ok === false) {
        toast("❌ " + (res.message || "Failed"), true);
        return;
      }
  
      // ✅ Handle Data / Data1 / data safely
      const baseData =
        res?.Data ||
        res?.Data1 ||
        res?.data ||
        [];
  
      if (baseData.length > 0) {
  
        const masterList =
          baseData[0]?.purchasemaster || [];
  
        const detailsList =
          baseData[0]?.purchasedetails || [];
  
        // ✅ Attach details into master rows
        const enrichedMaster = masterList.map(masterRow => ({
          ...masterRow,
          purchasedetails: detailsList.filter(
            d => d.PurchaseRefId === masterRow.Id
          )
        }));
  
        setF5List(enrichedMaster);
  
      } else {
        setF5List([]);
      }
  
      setF5Open(true);
  
    } finally {
      setLoading(false);
    }
  
  }, [sess.Comid, toast]);

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
        await handleDelete();
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
    <div className="mp-wrap">

      {/* ── Confirm Dialog ── */}
      {ConfirmUI}

      {/* ── Password Modal (mirrors LockEditWindow) ── */}
      {pwdOpen && (
        <div className="mp-modal-ov">
          <div className="mp-pwd-modal">
            <h3 style={{ marginBottom: 10, color: "#1f65de", fontSize: 13 }}>🔒 {pwdTitle}</h3>
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
              <button className="mp-modal-btn yes" onClick={handlePwdConfirm}>OK</button>
              <button className="mp-modal-btn no"  onClick={() => setPwdOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Product Picker (mirrors productwindow) ── */}
      {pickerOpen && (
        <div className="mp-picker-ov">
          <div className="mp-picker" style={{ width: 480, maxHeight: 500 }}>
            <header>
              <h3>🔍 Product Search</h3>
              <button className="mp-picker-close" onClick={() => setPickerOpen(false)}>✕</button>
            </header>
            <div className="mp-picker-search">
              <input
                ref={pickerSearchRef}
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
                placeholder="Search code or name…"
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (filteredPicker.length > 0) {
                      handlePickerSelect(filteredPicker[0].ProductCode || filteredPicker[0].Productcode, pickerRowIdx);
                    }
                  }
                  if (e.key === "Escape") { setPickerOpen(false); }
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    // handled by table row keyboard in picker
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
                      onDoubleClick={() =>
                        handlePickerSelect(p.ProductCode || p.Productcode, pickerRowIdx)
                      }
                      onClick={() => {}}
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
            background: "#fff", borderRadius: 8, width: 720, maxHeight: "80vh",
            display: "flex", flexDirection: "column",
            boxShadow: "0 16px 48px rgba(0,0,0,.25)",
          }}>
            {/* F5 header */}
            <div style={{
              background: "#1f65de", color: "#fff", padding: "10px 16px",
              borderRadius: "8px 8px 0 0", display: "flex",
              alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>📋 Repacking List</span>
              <button
                style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 17 }}
                onClick={() => setF5Open(false)}
              >✕</button>
            </div>

            {/* Date filter bar */}
            <div style={{
              padding: "10px 14px", borderBottom: "1px solid #deeafb",
              display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
            }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#1a2e4a" }}>From:</label>
              <input
                type="date"
                value={f5FromDate}
                onChange={e => setF5FromDate(e.target.value)}
                style={{ height: 28, border: "1px solid #c5d8f8", borderRadius: 4, padding: "0 6px", fontSize: 12 }}
              />
              <label style={{ fontSize: 12, fontWeight: 600, color: "#1a2e4a" }}>To:</label>
              <input
                type="date"
                value={f5ToDate}
                onChange={e => setF5ToDate(e.target.value)}
                style={{ height: 28, border: "1px solid #c5d8f8", borderRadius: 4, padding: "0 6px", fontSize: 12 }}
              />
              <button
                className="mp-btn sv"
                style={{ height: 28 }}
                onClick={() => loadF5View(f5FromDate, f5ToDate)}
              >View</button>
            </div>

            {/* F5 grid */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              <table className="mp-tbl" style={{ minWidth: "unset" }}>
                <thead>
                  <tr>
                    <th style={{ width: 70 }}>Ref.No</th>
                    <th style={{ width: 110 }}>Ref Date</th>
                    <th>Repacking Product</th>
                    <th style={{ width: 80 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {f5List.map((row, i) => (
                    <>
                      <tr
                        key={row.Id || i}
                        className={f5SelIdx === i ? "sel" : ""}
                        onClick={() => setF5SelIdx(i)}
                        onDoubleClick={() => {
                          if (perm.Edit === 0) { toast("❌ Page Edit Permission Denied !!!", true); return; }
                          f5EditId.current = row.Id;
                          setPressKey("F5");
                          setF5Open(false);
                          openPwdModal(1);
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        <td>{row.PurchaseNo || row.RefNo}</td>
                        <td>{displayDate(parseServerDate(row.PurchaseDate || row.RefDate))}</td>
                        <td>{row.SupplierName || row.ProductName || ""}</td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            className="mp-btn nw"
                            style={{ height: 24, padding: "2px 10px", fontSize: 11 }}
                            onClick={e => {
                              e.stopPropagation();
                              setF5ExpandedId(f5ExpandedId === row.Id ? null : row.Id);
                            }}
                          >{f5ExpandedId === row.Id ? "▲" : "▼"}</button>
                        </td>
                      </tr>
                      {f5ExpandedId === row.Id && (
                        <tr key={`exp-${row.Id}`}>
                          <td colSpan={4} style={{ padding: 0, background: "#f5f9ff" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                              <thead>
                                <tr style={{ background: "#deeafb" }}>
                                  <th style={{ padding: "4px 8px", textAlign: "left" }}>Code</th>
                                  <th style={{ padding: "4px 8px", textAlign: "left" }}>Description</th>
                                  <th style={{ padding: "4px 8px", textAlign: "right" }}>Net Weight</th>
                                  <th style={{ padding: "4px 8px", textAlign: "right" }}>Qty</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(row.purchasedetails || row.details || []).map((d, di) => (
                                  <tr key={di} style={{ borderBottom: "1px solid #eaecf4" }}>
                                    <td style={{ padding: "3px 8px" }}>{d.ProductCode}</td>
                                    <td style={{ padding: "3px 8px" }}>{d.ProductName}</td>
                                    <td style={{ padding: "3px 8px", textAlign: "right" }}>{parseFloat(d.PurchaseRate || d.NetWeight || 0).toFixed(3)}</td>
                                    <td style={{ padding: "3px 8px", textAlign: "right" }}>{parseFloat(d.ItemQty || d.Qty || 0).toFixed(0)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                  {f5List.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: "center", color: "#aaa", padding: 16 }}>No records found</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ padding: "8px 14px", borderTop: "1px solid #deeafb", display: "flex", justifyContent: "flex-end" }}>
              <button className="mp-btn dl" style={{ height: 28 }} onClick={() => setF5Open(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="mp-hdr">
        <div className="mp-hdr-left">
          <div className="mp-icon">R</div>
          <div>
            <div className="mp-title">Repacking Master</div>
            <div className="mp-sub">Co: {sess.Comid} — Manage repacking records</div>
          </div>
        </div>
        <button className="mp-back" onClick={async () => {
          const ok = await confirm("Do You Want To Quit?");
          if (ok) navigate("/Home");
        }}>← Back</button>
      </div>

      <div className="mp-body">

        {/* ── Toolbar ── */}
        <div className="mp-toolbar">
          <button className="mp-btn sv" onClick={handleSave} disabled={loading}>💾 F1 Save</button>
          <button className="mp-btn nw" onClick={() => { loadF5View(todayISO(), todayISO()); }} disabled={loading}>📋 F5 View</button>
          {editId !== 0 && (
            <button className="mp-btn dl" onClick={() => { setPressKey("F9"); openPwdModal(1); }} disabled={loading}>🗑 F9 Delete</button>
          )}
          <button className="mp-btn nw" onClick={async () => {
            const ok = await confirm("Do You Want To Clear?");
            if (ok) handleClear();
          }} disabled={loading}>✕ F10 Clear</button>
          <button className="mp-btn info" onClick={() => { setPressKey("F3"); openPwdModal(1); }} disabled={loading}>✏ F3 Edit</button>
          {editId !== 0 && (
            <span className="mp-msg ok">Editing #{refNo}</span>
          )}
        </div>

        {/* ── Master Form ── */}
        <div style={{
          background: "#fff", border: "1px solid #c5d8f8", borderRadius: 6,
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
                height: 26, border: "1px solid #c5d8f8", borderRadius: 4,
                padding: "0 8px", fontSize: 12, width: 80, background: "#f5f9ff",
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
                height: 26, border: "1px solid #c5d8f8", borderRadius: 4,
                padding: "0 6px", fontSize: 12,
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
                height: 26, border: "1px solid #c5d8f8", borderRadius: 4,
                padding: "0 6px", fontSize: 12, flex: 1, maxWidth: 260,
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
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1f65de" }}>{totalWeight}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "#8b99b5", fontWeight: 600 }}>TOTAL QTY</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1a2e4a" }}>{totalQty}</div>
            </div>
          </div>
        </div>

        {/* ── Grid ── */}
        <div className="mp-grid-wrap">
          <table className="mp-tbl">
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
                      className="mp-cell-input"
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
                      className="mp-cell-input"
                      value={row.ProductName}
                      readOnly
                      tabIndex={-1}
                      style={{ background: "#f5f9ff", cursor: "default" }}
                    />
                  </td>

                  {/* Stock Qty */}
                  <td>
                    <input
                      className="mp-cell-input"
                      value={row.StockQty}
                      readOnly
                      tabIndex={-1}
                      style={{ textAlign: "right", background: "#f5f9ff", cursor: "default" }}
                    />
                  </td>

                  {/* Net Weight */}
                  <td>
                    <input
                      className="mp-cell-input"
                      value={row.NetWeight}
                      readOnly
                      tabIndex={-1}
                      style={{ textAlign: "right", background: "#f5f9ff", cursor: "default" }}
                    />
                  </td>

                  {/* Quantity */}
                  <td>
                    <input
                      ref={el => { qtyRefs.current[idx] = el; }}
                      className="mp-cell-input"
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
                  <td>
                    <button
                      className="mp-del-btn"
                      tabIndex={-1}
                      onClick={e => { e.stopPropagation(); deleteRow(idx); }}
                    >🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {grid.length === 0 && !loading && (
            <div style={{ padding: 24, textAlign: "center", color: "#aaa", fontSize: 12 }}>
              No rows. Press <kbd>Enter</kbd> on Product Code to add.
            </div>
          )}
        </div>

        {/* ── Keyboard hint bar ── */}
        <div className="mp-hint">
          <kbd>F1</kbd> Save &nbsp;|&nbsp;
          <kbd>F3</kbd> Edit by No &nbsp;|&nbsp;
          <kbd>F5</kbd> View List &nbsp;|&nbsp;
          <kbd>F9</kbd> Delete &nbsp;|&nbsp;
          <kbd>F10</kbd> Clear &nbsp;|&nbsp;
          <kbd>Enter</kbd> Next Row &nbsp;|&nbsp;
          <kbd>Delete</kbd> Delete Row &nbsp;|&nbsp;
          <kbd>Esc</kbd> Quit
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