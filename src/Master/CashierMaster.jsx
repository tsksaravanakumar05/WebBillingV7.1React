// ─────────────────────────────────────────────────────────────────────────────
//  CategoryMaster.jsx
//  Uses shared helpers from CashierCommon.jsx via wildcard import (CC.*)
//  Any new export added to CashierCommon is auto-available here as CC.xxx
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./CategoryMaster.css";

// ✅ Single wildcard import — all current & future CashierCommon exports
import * as CC from "./Common";

// ─── CategoryMaster ───────────────────────────────────────────────────────────
export default function CategoryMaster() {
  const navigate  = useNavigate();
  const inputRefs = useRef([]);

  // ── Shared hooks from CashierCommon ─────────────────────────────────────────
  const { confirm, ConfirmUI } = CC.useConfirm();
  const { toast,   toasts    } = CC.useToast();

  // ── Session / company variables ─────────────────────────────────────────────
  // CC.buildSession reads: Comid, MComid, IdComList, MirrorTable, menudata


  // Store permissions in state so the rest of your component can use them
  const [perm, setPerm] = useState({ View: 0, Add: 0, Edit: 0, Delete: 0 });
  const [isAuthorized, setIsAuthorized] = useState(false);

 

  // Permission guard — defaults to full access if no menu entry found


  // ── Component state ─────────────────────────────────────────────────────────
  const [grid,    setGrid]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [selIdx,  setSelIdx]  = useState(null);

  // ── focusRow ────────────────────────────────────────────────────────────────
 const focusRow = useCallback((idx, colIdx = 0) => {
  setTimeout(() => inputRefs.current[idx]?.[colIdx]?.focus(), 50);
}, []);

  const [sess] = useState(() => {
    try {
      const main0 = (CC.getLocal("Mainsetting")    || [{}])[0] || {};
      const com0  = (CC.getLocal("Companysetting") || [{}])[0] || {};
      const Comid = CC.getStr("Comid") || "1";
      const MComid= CC.getStr("MComid") || Comid;
      const IdComList = CC.getStr("IdComList") || Comid;
      const isCC  = !!main0.CommonCompany;
      const isAG  = com0.PCode_Auto===true||com0.PCode_Auto===1||com0.PCode_Auto==="1"||String(com0.PCode_Auto).toLowerCase()==="true";
      return {
        Comid: isCC ? MComid : Comid, MComid, IdComList,
        Tamil:!!main0.ProductNameTamil, CommonCompany:isCC,
        CommonCompanyDiffStock:!!main0.CommonCompanyDiffStock,
        SupplierMulitipleAllow:!!main0.SupplierMulitipleAllow,
        BranchSaleRate:!!main0.BranchWiseSaleRate,
        MulipleMRP:!!com0.MultiMRP, MirrorTable:0,
        LandingCostCompare:!!main0.LandingCostCompare,
        PurchaseProfitSaleRateChange:!!main0.PurchaseProfitSaleRateChange,
        univercell:!!main0.univercell, MultipleUOMBilling:!!main0.MultipleUOMBilling,
        GroupCommission:!!main0.GroupCommission,
        Ecotech:!!main0.Ecotech,
        Productcodeautogen:isAG,
        Productcodedigit:com0.PCode_Digits||0,
        Productcodeprefix:com0.PCode_Prefix||"",
        menudata:(CC.getLocal("menulist")||[]).filter(o=>o.PageName==="Item Master"),
      };
    } catch {
      return { Comid:"1",MComid:"1",IdComList:"1",MirrorTable:0,menudata:[],Productcodeautogen:false,Productcodedigit:0,Productcodeprefix:"" };
    }
  });
// ─── Column config (mirrors Cashier.js gridcolumns) ──────────────────────────
const ALL_COLUMNS = [
  { field: "Code",        label: "Code",         width: 100, hidden: false },
  { field: "CashierName", label: "Cashier Name",  width: 150, hidden: false },
  { field: "Password",    label: "Password",      width: 90,  hidden: false },
  { field: "LogonStatus", label: "Logon Status",  width: 100, hidden: false },
  { field: "Active",      label: "Active",        width: 100, hidden: false },
];
const COLS = ALL_COLUMNS.map(c => c.field);
 useEffect(() => {
    const menuStr = localStorage.getItem("menulist");

    // 1. Check if session/menu exists
    if (!menuStr) {
      alert("Session Close Please Login !!!."); // Replace with your MsgBox / Toast
      navigate("/Login/Index");
      return;
    }

    const menulist = JSON.parse(menuStr);
    const menudata = menulist.filter(obj => obj.PageName === "Cashier");

    // 2. Check if page exists in user's menu
    if (!menudata || menudata.length === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => { navigate("/Home"); }, 3000);
      return;
    }

    // 3. Check if View permission is 0
    if (menudata[0].View === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => { navigate("/Home"); }, 3000);
      return;
    }

    // 4. User is valid, set permissions and allow rendering
    setPerm({
      View: menudata[0].View,
      Add: menudata[0].Add,
      Edit: menudata[0].Edit,
      Delete: menudata[0].Delete
    });
    
    setIsAuthorized(true);

  }, [navigate]);

  // Prevent the page UI from flashing before the redirect happens

// ─── Column settings state (F12) ─────────────────────────────────────────────
const [colSettings, setColSettings] = useState(() =>
  ALL_COLUMNS.map(c => ({ field: c.field, label: c.label, hidden: c.hidden, width: c.width }))
);
const [f12Open, setF12Open] = useState(false);
// ─── Save column settings to server (mirrors jQuery savewidth click) ──────────
const saveColSettings = useCallback(async (localSettings) => {
  setF12Open(false);
  setLoading(true);
  const payload = localSettings.map(s => ({
    filename: "Cashier",
    column:   s.field,
    Visible:  !s.hidden,
    Width:    s.width,
    Comid:    Number(sess.MComid),
  }));
  try {
    const res = await fetch("/Login/VisibleColumns", {
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
// ── Load column settings from server on startup (mirrors SupplierMaster) ──
useEffect(() => {
  const loadColSettings = async () => {
    try {
      const url = `/Content/Appdata/Visible/${sess.MComid}/Cashier.json?t=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) return; // No file yet — use defaults

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
}, [sess.MComid]);
const visibleColumns = ALL_COLUMNS.filter(c => {
  const cs = colSettings.find(s => s.field === c.field);
  return cs ? !cs.hidden : !c.hidden;
}).map(c => {
  const cs = colSettings.find(s => s.field === c.field);
  return { ...c, width: cs?.width ?? c.width };
});
function F12Popup() {
  const [local, setLocal] = useState(colSettings.map(s => ({ ...s })));

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(10,20,40,.5)",
                  zIndex:9000, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:8, width:450,
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


  // ── makeNewRow ──────────────────────────────────────────────────────────────
  // CC.uid() generates a unique key for each row
  // const makeNewRow = (prefill = "") => ({
  //   Id:       null,
  //   Cat_Name: prefill,
  //   Cat_GST:  "0.00",
  //   Active:   true,
  //   EditMode: 1,
  //   _uid:     CC.uid(),
  // });
   const makeNewRow = (prefillName = "") => ({
  Id:             null,
  Code:           "",
  CashierName:    prefillName, // The prefill text goes here
  Password:       "",
  LogonStatus:    false,       // Assuming it's a checkbox/toggle
  DiscountPer:    "0.00",
  Discount:       false,       // Assuming it's a checkbox/toggle
  BillNoStart:    "1",
  BillNoPerfix:   "",
  BillDigit:      "0",
  DeleteRow:      false,
  DeleteReason:   false,
  Active:         true,        // Active by default
  EditMode:       1,           // 1 means "New/Edit mode"
  _uid:           CC.uid(),    // Unique ID for React lists
});

  // ── loadData ─────────────────────────────────────────────────────────────────
  // CC.api() → general POST with query params + HTTP error normalisation
  const loadData = useCallback(async () => {
    const prefill = sessionStorage.getItem("masterPrefill") || "";
    setLoading(true);
    const res = await CC.api(
      CC.CashierSelect,
      null,
      {},
      { Comid: sess.Comid }
    );
    setLoading(false);

    if (res._http404) { toast(`❌ 404 — ${CC.CashierSelect} not found`, true); }
    if (res._netErr)  { toast(`❌ Network: ${res.message}`, true); }

    const rawList = Array.isArray(res.data)  ? res.data
                  : Array.isArray(res.Data1) ? res.Data1
                  : [];

   const existing = rawList.map(r => ({
    ...r,
    // Cashier.js: obj.DiscountPer = parseFloat(obj.DiscountPer).toFixed(2)
    DiscountPer:  parseFloat(r.DiscountPer  ?? 0).toFixed(2),

    // bool fields — Cashier.js datafields: type:'bool'
    LogonStatus:  r.LogonStatus  === true || r.LogonStatus  === 1,
    DeleteRow:    r.DeleteRow    === true || r.DeleteRow    === 1,
    DeleteReason: r.DeleteReason === true || r.DeleteReason === 1,
    Active:       r.Active       === true || r.Active       === 1,

    // number field
    Id:           Number(r.Id ?? 0),

    EditMode: 0,
    _uid:     CC.uid(),
  }));

  const blank = makeNewRow(prefill);
  setGrid([...existing, blank]);
  setSelIdx(existing.length);
  focusRow(existing.length);
  sessionStorage.removeItem("masterPrefill")
   }, [sess.Comid, toast, focusRow]);// eslint-disable-line

  useEffect(() => { loadData(); }, [loadData]);

  // ── addRow ──────────────────────────────────────────────────────────────────
  const addRow = useCallback(() => {
    setGrid(prev => {
      const next = [...prev, makeNewRow()];
      const idx  = next.length - 1;
      setSelIdx(idx);
      focusRow(idx);
      return next;
    });
  }, [focusRow]); // eslint-disable-line

  // ── updateCell ──────────────────────────────────────────────────────────────
  const updateCell = useCallback((idx, field, value) => {
    setGrid(prev =>
      prev.map((r, i) => i === idx ? { ...r, [field]: value, EditMode: 1 } : r)
    );
  }, []);

  // ── deleteRow ───────────────────────────────────────────────────────────────
  // CC.api() used for DELETE call with IdComList header
  const deleteRow = useCallback(async (idx) => {
    if (!perm.Delete) { toast("❌ Page Delete Permission Denied !!!", true); return; }

    const row     = grid[idx];
    const isSaved = row.Id != null && row.Id !== 0;

    if (isSaved) {
      const ok = await confirm(`Do you want to delete "${row.CashierName}"?`);
      if (!ok) return;

      setLoading(true);
      const url =
      CC.CashierDelete;

      const res = await CC.api(url, null, {},{ Id: Number(row.Id),Comid:Number(sess.Comid),MirrorTable:Number(sess.MirrorTable) });
      setLoading(false);

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
      // Unsaved row — just remove from grid
      setGrid(prev => {
        const next = prev.filter((_, i) => i !== idx);
        const sel  = Math.max(0, next.length - 1);
        setSelIdx(sel);
        focusRow(sel);
        return next;
      });
    }
  }, [grid, sess, perm, focusRow, toast, confirm]);

  // ── gridemptycheck ──────────────────────────────────────────────────────────
  // Strips trailing blank row; validates all edited rows have a name
  const gridemptycheck = useCallback((g) => {
    let cleaned = [...g];

    // Remove trailing empty blank row
    if (cleaned.length > 1 && !String(cleaned[cleaned.length - 1].CashierName || "").trim())
      cleaned = cleaned.slice(0, -1);

    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i].EditMode === 1 && !String(cleaned[i].CashierName || "").trim()) {
        toast("❌ Enter All Cashier in the Grid !!!", true);
        setSelIdx(i);
        focusRow(i);
        return { ok: false, cleaned };
      }
    }
    return { ok: true, cleaned };
  }, [focusRow, toast]);
const rowValidator = useCallback((row) => {
  return String(row.CashierName || "").trim().length > 0; // ✅ must have a name
}, []);
  // ── hasDuplicate ────────────────────────────────────────────────────────────
  const hasDuplicate = useCallback((g) => {
    const names = g
      .filter(r => String(r.CashierName || "").trim())
      .map(r => String(r.CashierName).trim().toLowerCase());
    return new Set(names).size !== names.length;
  }, []);

  // ── handleSave ──────────────────────────────────────────────────────────────
  // CC.insertapi() → Insert/Update POST (raw JSON response)
  const handleSave = useCallback(async () => {
    const { ok, cleaned } = gridemptycheck(grid);
    if (!ok) return;
    setGrid(cleaned);

    let dirty = [];
    let flag  = 1;

    // ── Permission checks ──────────────────────────────────────────────────
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
    let confirmMsg    = "Do you want to save the Cashier details?";
    if (hasExisting && !hasNew) confirmMsg = "Do you want to update the Cashier details?";
    if (hasExisting &&  hasNew) confirmMsg = "Do you want to save & update the Cashier details?";

    const proceed = await confirm(confirmMsg);
    if (!proceed) { addRow(); return; }

    setLoading(true);

    // ── Build API payload ─────────────────────────────────────────────────
    // const payload = cleaned
    //   .filter(r => r.EditMode === 1)
    //   .map(r => ({
    //     Id:           Number(r.Id           || 0),
    //     Cat_Name:     r.Cat_Name            || "",
    //     Cat_GST:      parseFloat(r.Cat_GST      || 0),
    //     HSNCode:      r.HSNCode             || "",
    //     Cat_Discount: parseFloat(r.Cat_Discount || 0),
    //     CRMPoint:     parseFloat(r.CRMPoint     || 0),
    //     TouchShow:    Number(r.TouchShow    || 0),
    //     OnlineShow:   Number(r.OnlineShow   || 0),
    //     NStock:       Number(r.NStock       || 0),
    //     Active:       Number(r.Active       || 1),
    //     Bannerimg1:   r.Bannerimg1          || "",
    //     Bannerimg2:   r.Bannerimg2          || "",
    //     Bannerimg3:   r.Bannerimg3          || "",
    //     Bannerimg4:   r.Bannerimg4          || "",
    //   }));
const payload = cleaned
  .filter(r => r.EditMode === 1)
  .map(r => {
    
    // C# Logic: If BillDigit is 1, 2, or 3, change it to 4.
    let currentBillDigit = Number(r.BillDigit || 0);
    if (currentBillDigit === 1 || currentBillDigit === 2 || currentBillDigit === 3) {
        currentBillDigit = 4;
    }

    return {
      Id:           Number(r.Id || 0),
      Code:         r.Code || "",
      CashierName:  r.CashierName || "",
      Password:     r.Password || "",
      
      // C#: Equals("1") ? true : false
      // In JS, we check if the value is "1" or already a boolean true
      LogonStatus:  String(r.LogonStatus) === "1" || r.LogonStatus === true,
      
      BillDigit:    currentBillDigit,
      
      // C#: Cash.Active = 1
      Active:       Number(r.Active || 1),
      
      // C#: Equals("") ? 1 : int.Parse(...)
      BillNoStart:  Number(r.BillNoStart || 1),
      
      // C#: Equals("1") ? true : false
      DeleteRow:    String(r.DeleteRow) === "1" || r.DeleteRow === true,
      DeleteReason: String(r.DeleteReason) === "1" || r.DeleteReason === true,
    };
  });
    // CC.insertapi() — Insert/Update POST with company + mirror headers
    const res = await CC.insertapi(
      CC.CashierInsert,
      payload,
      {
        Comid:       String(parseInt(sess.Comid)),
        MirrorTable: String(sess.MirrorTable),
        IdComList:   String(sess.IdComList),
        ApiType:     0,
      }
    );

    setLoading(false);

    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

    if (res.IsSuccess) {
      toast("✅ " + (res.message || "Saved successfully!"));

      // If opened from another page expecting a return value
      const retField = sessionStorage.getItem("masterReturnField");
      if (retField) {
        sessionStorage.setItem("masterReturnValue", String(res.Data2 ?? res.Id ?? ""));
        sessionStorage.setItem("masterReturnName",  dirty[0]?.CashierName || "");
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

  // ── Global keyboard shortcuts: F1 = Save  |  Esc = Back ──────────────────
  useEffect(() => {
    const onKey = e => {
      if (e.keyCode === 112) { e.preventDefault(); handleSave(); }
      if (e.keyCode === 27)  { e.preventDefault(); handleEsc();  }
      if (e.keyCode === 123) { e.preventDefault(); setF12Open(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleEsc]);

  // ── Row-level keyboard navigation ──────────────────────────────────────────
  // Enter → next row | Ctrl+Delete → delete | Delete on empty → delete
  const onCellKeyDown = useCallback((e, idx) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!String(grid[idx]?.CashierName || "").trim()) { toast("❌ Enter CashierName !!!", true); return; }
      if (hasDuplicate(grid))                         { toast("❌ Duplicate Cashier Name !!!", true); return; }
      if (idx === grid.length - 1) addRow();
      else { setSelIdx(idx + 1); focusRow(idx + 1); }
    }
    if (e.key === "Delete" && e.ctrlKey) {
      e.preventDefault();
      deleteRow(idx);
    }
    if (e.key === "Delete" && !e.ctrlKey && !String(grid[idx]?.CashierName || "").trim()) {
      e.preventDefault();
      deleteRow(idx);
    }
  }, [grid, hasDuplicate, addRow, focusRow, deleteRow, toast]);
  if (!isAuthorized) {
    return null; // Or return a <Loader /> component
  }
  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mp-wrap">

      {/* Confirm Dialog — rendered by CC.useConfirm() */}
      {ConfirmUI}
{f12Open && <F12Popup />}
      {/* ── Header ── */}
      {/* <div className="mp-hdr">
        <div className="mp-hdr-left">
          <div className="mp-icon">C</div>
          <div>
            <div className="mp-title">Cashier Master</div>
            <div className="mp-sub">Co: {sess.Comid} — Manage category records</div>
          </div>
        </div>
        <button className="mp-back" onClick={handleEsc}>← Back</button>
      </div> */}

      <div className="mp-body">

        {/* ── Toolbar ── */}
        <div className="mp-toolbar">
          <button className="mp-btn sv" onClick={handleSave} disabled={loading}>💾 F1 Save</button>
          <button className="mp-btn nw" onClick={addRow}     disabled={loading}>➕ Add Row</button>
          <button className="mp-btn" onClick={() => setF12Open(true)} title="Column Settings">⚙ F12 Columns</button>
          <button className="mp-btn dl" onClick={handleEsc}>✕ Esc Cancel</button>


          <div className="mp-title">Cashier Master</div>
        </div>
{/* ── Grid ── */}
<div className="mp-grid-wrap">
  <table className="mp-tbl">
    <thead>
      <tr>
        <th style={{ width: 50 }}>S.No</th>
        {visibleColumns.map(c => (
          <th key={c.field} style={{ width: c.width, minWidth: c.width, textAlign: c.field === "Active" || c.field === "LogonStatus" ? "center" : undefined }}>
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
          onClick={() => { setSelIdx(idx);  }}
        >
          <td className="sno">{idx + 1}</td>

          {visibleColumns.map((col, colIdx) => (
            <td key={col.field} style={{ textAlign: col.field === "Active" || col.field === "LogonStatus" ? "center" : undefined }}>
              {/* Active select */}
              {col.field === "Active" && (
                <select
                  ref={el => {
                    if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                    inputRefs.current[idx][colIdx] = el;
                  }}
                  className="cm-active-sel"
                  value={row.Active ? "1" : "0"}
                  onChange={e => updateCell(idx, "Active", e.target.value === "1")}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      CC.handleEnterNext(e, inputRefs, idx, colIdx, visibleColumns.length, grid.length, addRow, grid, rowValidator);
                    }
                  }}
                  onFocus={() => setSelIdx(idx)}
                  title={row.Active ? "Active" : "Inactive"}
                >
                  <option value="1">✓</option>
                  <option value="0">✗</option>
                </select>
              )}

              {/* LogonStatus select */}
              {col.field === "LogonStatus" && (
                <select
                  ref={el => {
                    if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                    inputRefs.current[idx][colIdx] = el;
                  }}
                  className="cm-active-sel"
                  value={row.LogonStatus ? "1" : "0"}
                  onChange={e => updateCell(idx, "LogonStatus", e.target.value === "1")}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      CC.handleEnterNext(e, inputRefs, idx, colIdx, visibleColumns.length, grid.length, addRow, grid, rowValidator);
                    }
                  }}
                  onFocus={() => setSelIdx(idx)}
                >
                  <option value="1">✓</option>
                  <option value="0">✗</option>
                </select>
              )}

              {/* All other text inputs */}
              {col.field !== "Active" && col.field !== "LogonStatus" && (
                <input
                  ref={el => {
                    if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                    inputRefs.current[idx][colIdx] = el;
                  }}
                  className="mp-cell-input"
                  value={row[col.field] || ""}
                  maxLength={col.maxLen || 50}
                  onChange={e => CC.applyUppercase(e, val => updateCell(idx, col.field, val))}
                  onKeyDown={e => CC.handleEnterNext(e, inputRefs, idx, colIdx, visibleColumns.length, grid.length, addRow, grid, rowValidator)}
                  onFocus={() => setSelIdx(idx)}
                />
              )}
            </td>
          ))}

          <td>
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
    <div className="mp-empty">No records. Press ➕ to add a cashier.</div>
  )}
</div>

        {/* ── Keyboard hint bar ── */}
        <div className="mp-hint">
          <kbd>Enter</kbd> next row &nbsp;|&nbsp;
          <kbd>Ctrl+Delete</kbd> delete row &nbsp;|&nbsp;
          <kbd>F1</kbd> save &nbsp;|&nbsp;
          <kbd>Esc</kbd> back
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

      {/* ── Toast notifications — CC.useToast + CC.ToastList ── */}
      <CC.ToastList toasts={toasts} />

    </div>
  );
}
