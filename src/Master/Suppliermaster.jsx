import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./Suppliermaster.css";
import Topbar from "../components/Topbar";
import * as CC from "../Master/Common"; 
import * as CC1 from "../components/Common"; // ← same Common.jsx

// ─── Column config ────────────────────────────────────────────────────────────
const ALL_COLUMNS = [
  { field:"AccountName",     label:"Supplier Name",   type:"string",  maxLen:500, width:180, hidden:false, required:true },
  { field:"Code",            label:"Code",            type:"string",  maxLen:50,  width:90,  hidden:true },
  { field:"SalesName",       label:"Sales Man",       type:"salesman",maxLen:200, width:130, hidden:false },
  { field:"Address1",        label:"Address 1",       type:"string",  maxLen:500, width:130, hidden:false },
  { field:"Address2",        label:"Address 2",       type:"string",  maxLen:500, width:130, hidden:true  },
  { field:"City",            label:"City",            type:"string",  maxLen:500, width:100, hidden:false },
  { field:"Pincode",         label:"Pincode",         type:"int",     maxLen:8,   width:80,  hidden:true  },
  { field:"MobileNo",        label:"Mobile No",       type:"string",  maxLen:50,  width:110, hidden:false },
  { field:"Phone",           label:"Phone",           type:"string",  maxLen:50,  width:90,  hidden:true  },
  { field:"GSTINNo",         label:"GSTIN No",        type:"string",  maxLen:50,  width:140, hidden:false },
  { field:"Email",           label:"Email",           type:"string",  maxLen:100, width:130, hidden:true  },
  { field:"CreditBillDays",  label:"Credit Days",     type:"int",     maxLen:8,   width:80,  hidden:true  },
  { field:"CreditBillLimit", label:"Credit Limit",    type:"float",   maxLen:18,  width:100, hidden:true  },
  { field:"OpeningBalance",  label:"Opening Bal",     type:"float",   maxLen:18,  width:100, hidden:true  },
  { field:"StateCode",       label:"State Code",      type:"string",  maxLen:50,  width:90,  hidden:true  },
  { field:"StateName",       label:"Place of Supply", type:"string",  maxLen:100, width:110, hidden:true  },
  { field:"IGSTBill",        label:"GST Type",        type:"select",  options:["GST","IGST"], width:90, hidden:false },
  { field:"Active",          label:"Active",          type:"active-select", width:70, hidden:false },
];

const vn = v => parseFloat(v) || 0;

// ─── makeNewRow ───────────────────────────────────────────────────────────────
const makeNewRow = (name = "") => ({
  _uid: CC.uid(), Id: null, AccountName: name, AccountType: "SUPPLIER",
  Code: "", SalesName: "", SalemanRefid: null,
  Address1: "", Address2: "", City: "", Pincode: "", MobileNo: "", Phone: "",
  GSTINNo: "", Email: "", OpeningBalance: "0.00", CreditBillDays: "0",
  CreditBillLimit: "0.00", StateName: "", StateCode: "",
  IGSTBill: "GST", Active: 1, EditMode: 1,
});

// ─── SalesmanPicker ───────────────────────────────────────────────────────────
function SalesmanPicker({ salesmanList, initialSearch = "", onSelect, onClose }) {
  const [search, setSearch] = useState(initialSearch);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const searchRef = useRef(null);
  const listRef   = useRef(null);

  const filtered = salesmanList.filter(s =>
    !search.trim() || (s.SalesManName || s.salesmanname || "").toLowerCase().includes(search.trim().toLowerCase())
  );

  useEffect(() => { setTimeout(() => { searchRef.current?.focus(); searchRef.current?.select(); }, 60); }, []);
  useEffect(() => { setFocusedIdx(0); }, [search]);
  useEffect(() => {
    listRef.current?.querySelector(".sm-picker-item.focused")?.scrollIntoView({ block:"nearest" });
  }, [focusedIdx]);

  const commit = item => onSelect({
    SalesManName: item.SalesManName || item.salesmanname || "",
    Id: item.Id || item.id || null,
  });

  const onSearchKey = e => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); if (filtered.length) { listRef.current?.querySelector(".sm-picker-item")?.focus(); setFocusedIdx(0); } return; }
    if (e.key === "Enter") { e.preventDefault(); if (!search.trim()) { onClose(); return; } if (filtered.length) commit(filtered[0]); else onClose(); }
  };

  const onItemKey = (e, item, idx) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); if (idx === 0) { searchRef.current?.focus(); return; } setFocusedIdx(idx-1); listRef.current?.querySelectorAll(".sm-picker-item")[idx-1]?.focus(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); if (idx < filtered.length-1) { setFocusedIdx(idx+1); listRef.current?.querySelectorAll(".sm-picker-item")[idx+1]?.focus(); } return; }
    if (e.key === "Enter") { e.preventDefault(); commit(item); }
  };

  return (
    <div className="sm-picker-overlay" onClick={e => { if (e.target===e.currentTarget) onClose(); }}>
      <div className="sm-picker-box">
        <div className="sm-picker-hdr"><span>Select Sales Man</span><button onClick={onClose}>✕</button></div>
        <div className="sm-picker-search">
          <input ref={searchRef} type="text" placeholder="Search Sales Man"
            value={search} onChange={e => setSearch(e.target.value.toUpperCase())} onKeyDown={onSearchKey} />
        </div>
        <div className="sm-picker-list" ref={listRef}>
          {filtered.length === 0
            ? <div className="sm-picker-empty">No salesman found</div>
            : filtered.map((item, idx) => (
              <div key={item.Id ?? idx}
                className={`sm-picker-item${focusedIdx===idx?" focused":""}`}
                tabIndex={0}
                onClick={() => commit(item)}
                onKeyDown={e => onItemKey(e, item, idx)}
                onMouseEnter={() => setFocusedIdx(idx)}>
                {item.SalesManName || item.salesmanname || ""}
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

// ─── SupplierMaster ───────────────────────────────────────────────────────────
export default function SupplierMaster() {
  const navigate = useNavigate();
const [pageCountTotal, setPageCountTotal] = useState(0); // total record count (data.Count)
const [pageLen, setPageLen]               = useState(1); // total pages
const [curPage, setCurPage]               = useState(1); // current page (1-based)
const PAGE_SIZE = 20;
  // ── Shared hooks from Common.jsx ─────────────────────────────────────────
  const { confirm, ConfirmUI } = CC.useConfirm();
  const { toast,   toasts    } = CC.useToast();
const redirectIfDualLogin = useCallback((res) => {
  if (res?._dualLogin || res?.redis === false) {
    alert("Already Login Another User Please Login Again!!!");
    navigate("/"); // Redirect to your specific login path
    return true;
  }
  return false;
}, [navigate]);
  // ── Session — same pattern as CashierMaster ──────────────────────────────
  const [sess] = useState(() => {
    try {
      const main0 = (CC.getLocal("Mainsetting")    || [{}])[0] || {};
      const Comid = CC.getStr("Comid")  || "1";
      const MComid= CC.getStr("MComid") || Comid;
      const IdComList   = CC.getStr("IdComList") || Comid;
      const MirrorTable = CC.getStr("MirrorTableOnline") || "0";
      const useMain     = !!main0.CommonCompany || !!main0.SupplierCommonCompany || MirrorTable === "1";
      const SupplierMulitipleAllow = !!main0.SupplierMulitipleAllow;
      const menudata = (CC.getLocal("menulist") || []).filter(o => o.PageName === "Supplier");
      const perm     = menudata[0] || { View:1, Add:1, Edit:1, Delete:1 };
      return {
        Comid: useMain ? MComid : Comid,
        MComid, IdComList, MirrorTable,
        SupplierMulitipleAllow, perm,
      };
    } catch {
      return { Comid:"1", MComid:"1", IdComList:"1", MirrorTable:"0", SupplierMulitipleAllow:false, perm:{ View:1,Add:1,Edit:1,Delete:1 } };
    }
  });
  const { Comid, MComid, IdComList, MirrorTable, SupplierMulitipleAllow, perm } = sess;
// ── Add these at the top of SupplierMaster component ──
const dirtyIds = useRef(new Set());

// ── Replace updateCell ──
const updateCell = useCallback((idx, field, value) => {
  setGrid(prev => prev.map((r, i) => {
    if (i === idx) {
      if (r.Id) dirtyIds.current.add(r.Id);
      return { ...r, [field]: value, EditMode: 1 };
    }
    return r;
  }));
}, []);

// ── Add enableEdit ──
const enableEdit = useCallback((idx) => {
  setGrid(prev => prev.map((r, i) => {
    if (i === idx) return { ...r, EditMode: 1 };
    if (r.EditMode === 1 && r.Id && !dirtyIds.current.has(r.Id))
      return { ...r, EditMode: 0 };
    return r;
  }));
  setSelIdx(idx);
}, []);

// ── Replace selectRow logic in onClick ──
const selectRow = useCallback((idx) => {
  setGrid(prev => prev.map((r, i) => {
    if (i !== idx && r.EditMode === 1 && r.Id && !dirtyIds.current.has(r.Id))
      return { ...r, EditMode: 0 };
    return r;
  }));
  setSelIdx(idx);
}, []);
  // ── State ────────────────────────────────────────────────────────────────
  const [grid,          setGrid]         = useState([]);
  const [loading,       setLoading]      = useState(false);
  const [selIdx,        setSelIdx]       = useState(null);
  const [salesmanList,  setSalesmanList] = useState([]);
  const [salesmanLoading, setSalesmanLoading] = useState(false);
  const [pickerTarget,  setPickerTarget] = useState(null);
  const [colSettings,   setColSettings]  = useState(() => ALL_COLUMNS.map(c => ({ field:c.field, label:c.label, hidden:c.hidden, width:c.width })));
  const [f12Open,       setF12Open]      = useState(false);
  const [pw, setPw] = useState(null);
  const pwOkRef = useRef(null);
  const [filterSearch, setFilterSearch] = useState("");
const [filterColumn, setFilterColumn] = useState("AccountName");
const [activeFilter, setActiveFilter] = useState("all");

  // ── Refs ─────────────────────────────────────────────────────────────────
  const cellRefs       = useRef({});
  const salesmanRef    = useRef([]);   // ← holds latest salesman list for loadData
  const loadDataRef    = useRef(null); // ← holds latest loadData for handleSave
//test
  // ── Visible columns ──────────────────────────────────────────────────────
  const visibleColumns = ALL_COLUMNS.filter(c => {
    const cs = colSettings.find(s => s.field === c.field);
    return cs ? !cs.hidden : !c.hidden;
  }).map(c => {
    const cs = colSettings.find(s => s.field === c.field);
    return { ...c, width: cs?.width ?? c.width };
  });
const editableFields = visibleColumns.map(c => c.field).filter(f => f !== "Active"&&f!=="IGSTBill");

  // ── Focus helper ─────────────────────────────────────────────────────────
  const focusCell = useCallback((rowIdx, field) => {
    setTimeout(() => {
      const el = cellRefs.current[`${rowIdx}_${field}`];
      if (el) { el.focus(); if (el.select) el.select(); }
    }, 40);
  }, []);

  // ── Init — load salesman THEN suppliers (runs ONCE) ──────────────────────

  const displayGrid = grid.filter(row => {
  if (activeFilter === "active" && (row.Active === false || row.Active === 0)) return false;
  return true;
});// eslint-disable-line
// ── doExcelDownload (F4) ──────────────────────────────────────────────────────
const doExcelDownload = useCallback(async () => {
  setLoading(true);
  const res = await CC.api(
    CC.SupplierSelect, null, {},
    { Comid: Number(Comid), Startindex: -1, PageCount: 99999, AccountType: "SUPPLIER", Keyword: "", Column: "" }
  );
  setLoading(false);
if (redirectIfDualLogin(res)) return;
  const data = Array.isArray(res?.data)  ? res.data
             : Array.isArray(res?.Data1) ? res.Data1
             : grid.filter(r => r.Id);

  if (!data?.length) { toast("No records to export", true); return; }

  const exportCols = [
    { key: "Id",              label: "Id"              },
    { key: "AccountName",     label: "Supplier Name"   },
    { key: "Code",            label: "Code"            },
    { key: "SalesName",       label: "Sales Man"       },
    { key: "SalemanRefid",    label: "SalesManId"      },
    { key: "Address1",        label: "Address 1"       },
    { key: "Address2",        label: "Address 2"       },
    { key: "City",            label: "City"            },
    { key: "Pincode",         label: "Pincode"         },
    { key: "MobileNo",        label: "Mobile No"       },
    { key: "Phone",           label: "Phone"           },
    { key: "GSTINNo",         label: "GSTIN No"        },
    { key: "Email",           label: "Email"           },
    { key: "CreditBillDays",  label: "Credit Days"     },
    { key: "CreditBillLimit", label: "Credit Limit"    },
    { key: "OpeningBalance",  label: "Opening Bal"     },
    { key: "StateCode",       label: "State Code"      },
    { key: "StateName",       label: "Place of Supply" },
    { key: "IGSTBill",        label: "GST Type"        },
    { key: "Active",          label: "Active"          },
  ];

  const fmt = data.map(o => {
    const out = {};
    exportCols.forEach(c => { out[c.label] = o[c.key] ?? ""; });
    return out;
  });

  const hdr  = Object.keys(fmt[0]).join(",");
  const body = fmt.map(r =>
    Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
  ).join("\n");

  const blob = new Blob(["\uFEFF" + hdr + "\n" + body], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "suppliermaster.csv"; a.click();
  URL.revokeObjectURL(url);
  toast("✅ Excel downloaded");
}, [Comid, grid, toast]);

// ── doExcelUpload (F7) ────────────────────────────────────────────────────────
const doExcelUpload = useCallback(() => {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = ".csv,.xlsx";
  inp.onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text();

    const parseCSV = raw => {
      const lines = raw.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) return [];
      const firstLine = lines[0];
      const delimiter = firstLine.includes('\t') ? '\t' : ',';
      const splitLine = line => {
        if (delimiter === '\t') return line.split('\t').map(v => v.trim());
        const result = []; let cur = ""; let inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQ && line[i+1] === '"') { cur += '"'; i++; }
            else inQ = !inQ;
          } else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ""; }
          else cur += ch;
        }
        result.push(cur.trim()); return result;
      };
      const hdrs = splitLine(lines[0]);
      return lines.slice(1).map(line => {
        const vals = splitLine(line);
        const obj = {};
        hdrs.forEach((h, i) => { obj[h.trim()] = (vals[i] || "").trim(); });
        return obj;
      });
    };

    const labelToKey = {
      "Id":              "Id",
      "Supplier Name":   "AccountName",
      "Code":            "Code",
      "Sales Man":       "SalesName",
      "SalesManId":      "SalemanRefid",
      "Address 1":       "Address1",
      "Address 2":       "Address2",
      "City":            "City",
      "Pincode":         "Pincode",
      "Mobile No":       "MobileNo",
      "Phone":           "Phone",
      "GSTIN No":        "GSTINNo",
      "Email":           "Email",
      "Credit Days":     "CreditBillDays",
      "Credit Limit":    "CreditBillLimit",
      "Opening Bal":     "OpeningBalance",
      "State Code":      "StateCode",
      "Place of Supply": "StateName",
      "GST Type":        "IGSTBill",
      "Active":          "Active",
    };

    const records = parseCSV(text).filter(o => o["Supplier Name"] || o["AccountName"]);
    if (!records.length) { toast("❌ No valid rows found. Check file format.", true); return; }

    const ni = v => parseInt(v)   || 0;
    const nf = v => parseFloat(v) || 0;
    const bi = v => (v === "true" || v === "1" || v === true) ? 1 : 0;
    const s  = v => String(v == null ? "" : v);

    const toSave = records.map(row => {
      const mapped = {};
      Object.entries(row).forEach(([h, v]) => {
        const key = labelToKey[h] || h;
        mapped[key] = v;
      });
      return {
        Id:              ni(mapped.Id) || null,
        AccountType:     "SUPPLIER",
        AccountName:     s(mapped.AccountName).trim(),
        Code:            s(mapped.Code),
        SalesName:       s(mapped.SalesName),
        SalemanRefid:    ni(mapped.SalemanRefid) || null,
        Address1:        s(mapped.Address1),
        Address2:        s(mapped.Address2),
        City:            s(mapped.City),
        Pincode:         s(mapped.Pincode),
        MobileNo:        s(mapped.MobileNo),
        Phone:           s(mapped.Phone),
        GSTINNo:         s(mapped.GSTINNo),
        Email:           s(mapped.Email),
        CreditBillDays:  ni(mapped.CreditBillDays),
        CreditBillLimit: nf(mapped.CreditBillLimit),
        OpeningBalance:  nf(mapped.OpeningBalance),
        StateCode:       s(mapped.StateCode),
        StateName:       s(mapped.StateName),
        IGSTBill:        s(mapped.IGSTBill) || "GST",
        Active:          bi(mapped.Active),
      };
    });

    const newCount  = toSave.filter(r => !r.Id || r.Id === 0).length;
    const editCount = toSave.filter(r => r.Id  && r.Id > 0).length;

    const ok = window.confirm(
      `Upload ${toSave.length} suppliers?\n➕ New: ${newCount}\n✏️ Update: ${editCount}\n\nProceed?`
    );
    if (!ok) return;

    setLoading(true);
    const res = await CC.insertapi(CC.SupplierInsert, toSave, {
      "Comid":                  String(Comid),
      "SupplierMulitipleAllow": String(SupplierMulitipleAllow),
      "AccountTypeNew":         "SUPPLIER",
      "MirrorTable":            String(MirrorTable),
      "Tamil":                  "0",
      "IdComList":              String(IdComList),
      "ApiType":                "1",
    });
    setLoading(false);
if (redirectIfDualLogin(res)) return;
    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }
    if (res.ok ?? res.IsSuccess) {
      toast(`✅ ${res.message || `Uploaded — ${newCount} added, ${editCount} updated`}`);
      await loadDataRef.current?.();
    } else {
      toast(`❌ ${res.message || "Upload failed"}`, true);
    }
  };
  inp.click();
}, [Comid, SupplierMulitipleAllow, MirrorTable, IdComList, toast]);

  // ── doLoadData — plain async, no useCallback, no deps ────────────────────
const doLoadData = async (smList, keyword = "", column = "", page = 1) => {
  const prefill = sessionStorage.getItem("masterPrefill") || "";
 let startIndex;
  if (page === 1 && !keyword) {
    startIndex = 0;           // ← first load, latest records
  } else {
    startIndex = (page - 1) * PAGE_SIZE;  // page1=0, page2=20, page3=40
  }// legacy: Startindex=-1 first load, else (page*20)
  setLoading(true);
  const res = await CC.api(CC.SupplierSelect, null, {}, {
    Comid: Number(Comid),
    Startindex: startIndex,
    PageCount: PAGE_SIZE,
    AccountType: "SUPPLIER", Keyword: keyword, Column: column,
  });
  setLoading(false);
  if (redirectIfDualLogin(res)) return;
  if (res._http404) { toast("❌ 404 — SelectSupplier not found", true); return; }
  if (res._netErr)  { toast(`❌ ${res.message}`, true); return; }

  const rawList = Array.isArray(res.data) ? res.data : Array.isArray(res.Data1) ? res.Data1 : [];
  const currentSM = smList ?? salesmanRef.current ?? [];

  const existing = rawList.map(r => {
    const smId  = r.SalemanRefid ?? r.SalesmanRefid ?? r.SalesManRefid ?? null;
    const smObj = currentSM.find(s => Number(s.Id ?? s.id) === Number(smId));
    return {
      ...r, _uid: CC.uid(), AccountType: r.AccountType || "SUPPLIER",
      SalesName:       r.SalesName || r.SaleName || smObj?.SalesManName || smObj?.salesmanname || "",
      SalemanRefid:    smId,
      OpeningBalance:  parseFloat(vn(r.OpeningBalance)).toFixed(2),
      CreditBillLimit: parseFloat(vn(r.CreditBillLimit)).toFixed(2),
      CreditBillDays:  String(parseInt(vn(r.CreditBillDays)) || 0),
      Active:   r.Active === 1 || r.Active === true ? 1 : 0,
      EditMode: 0,
    };
  });

  // ── Page-no-wise count tracking, same as legacy loadCounter ──
  const count = Number(res.Data4 ?? res.Data4 ?? existing.length) || 0;
  if (!keyword) {
    const total = count === 0 ? 1 : count;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    setPageCountTotal(total);
    setPageLen(totalPages);
    setCurPage(page);
  } else {
    setPageCountTotal(count || 1);
    setPageLen(1);
    setCurPage(1);
  }

  const blank = makeNewRow(prefill);
  setGrid([...existing, blank]);
  setSelIdx(existing.length);
  focusCell(existing.length, "AccountName");
  sessionStorage.setItem("masterPrefill", "");
};
  useEffect(() => {
    const init = async () => {
      // ── Salesman ──
      setSalesmanLoading(true);
      const smList = await CC.loadSalesmanData(MComid); // ← from Common.jsx
      setSalesmanList(smList);
      salesmanRef.current = smList;
      setSalesmanLoading(false);

      // ── Suppliers ──
      await doLoadData(smList, "", "", 1);
    };
    init();
  }, []); 
const goToPage = useCallback((page) => {
  if (page < 1 || page > pageLen || page === curPage) return;
  doLoadData(salesmanRef.current, "", "", page);
}, [pageLen, curPage]);
  // Store doLoadData in ref so handleSave can call it without being a dep
loadDataRef.current = () => doLoadData(salesmanRef.current, "", "", curPage);

  // ── addRow ────────────────────────────────────────────────────────────────
  const addRow = useCallback(() => {
    setGrid(prev => {
      const next = [...prev, makeNewRow()];
      const ni = next.length - 1;
      setSelIdx(ni);
      focusCell(ni, "AccountName");
      return next;
    });
  }, [focusCell]);

  // ── updateCell ────────────────────────────────────────────────────────────
  // const updateCell = useCallback((idx, field, value) => {
  //   setGrid(prev => prev.map((r, i) => i===idx ? { ...r, [field]:value, EditMode:1 } : r));
  // }, []);

  // ── Salesman picker ───────────────────────────────────────────────────────
  const openSalesmanPicker = useCallback((rowIdx) => {
    setPickerTarget({ rowIdx, currentName: grid[rowIdx]?.SalesName || "" });
  }, [grid]);

// ── onSalesmanSelect — popup-ல் item select பண்ணினா next cell ──
const onSalesmanSelect = useCallback(({ SalesManName, Id }) => {
  if (!pickerTarget) return;
  const { rowIdx } = pickerTarget;

  setGrid(prev => prev.map((r, i) =>
    i === rowIdx
      ? { ...r, SalesName: SalesManName || "", SalemanRefid: Id ?? null, EditMode: 1 }
      : r
  ));
  setPickerTarget(null);

  // SalesName next column-க்கு focus
  setTimeout(() => {
    const colIdx = editableFields.indexOf("SalesName");
    if (colIdx >= 0 && colIdx < editableFields.length - 1) {
      focusCell(rowIdx, editableFields[colIdx + 1]);
    }
  }, 60);
}, [pickerTarget, editableFields, focusCell]);

// ── onSalesmanClose — popup cancel/escape → same SalesName cell-க்கே திரும்பு ──
const onSalesmanClose = useCallback(() => {
  const rowIdx = pickerTarget?.rowIdx;
  setPickerTarget(null);

  // Cancel பண்ணினா SalesName-லயே இரு, next போகாதே
  if (rowIdx != null) {
    setTimeout(() => focusCell(rowIdx, "Address1"), 60);
  }
}, [pickerTarget, focusCell]);

  // ── moveNext ──────────────────────────────────────────────────────────────
  const moveNext = useCallback((rowIdx, field, currentGrid) => {
    const colIdx   = editableFields.indexOf(field);
    const rowCount = currentGrid.length;
    if (colIdx < editableFields.length-1) {
      focusCell(rowIdx, editableFields[colIdx+1]);
    } else if (rowIdx < rowCount-1) {
      setSelIdx(rowIdx+1); focusCell(rowIdx+1, editableFields[0]);
    } else {
      const nr = makeNewRow();
      setGrid(prev => { const next=[...prev,nr]; const ni=next.length-1; setSelIdx(ni); focusCell(ni,editableFields[0]); return next; });
    }
  }, [editableFields, focusCell]);

  // ── Cell keydown ──────────────────────────────────────────────────────────
  // ── onCellKeyDown — replace existing ──────────────────────────────────────────
const onCellKeyDown = useCallback((e, rowIdx, field) => {
  if (e.key !== "Enter") return;
  e.preventDefault();

  // SalesName → open picker, don't advance yet
  if (field === "SalesName") {
    openSalesmanPicker(rowIdx);
    return;
  }

  const row   = grid[rowIdx];
  const value = row?.[field];

  // Validate AccountName
  if (field === "AccountName") {
    if (!String(value || "").trim()) {
      toast("❌ Enter Supplier Name !!!", true);
      return;
    }
    if (!SupplierMulitipleAllow) {
      const names = grid
        .filter((_, i) => i !== rowIdx && String(grid[i].AccountName || "").trim())
        .map(r => String(r.AccountName).trim().toLowerCase());
      if (names.includes(String(value).trim().toLowerCase())) {
        toast("❌ Duplicate Supplier Name !!!", true);
        return;
      }
    }
  }

  // Format on Enter
  const colDef = ALL_COLUMNS.find(c => c.field === field);
  if (colDef?.type === "float") updateCell(rowIdx, field, parseFloat(vn(value)).toFixed(2));
  if (colDef?.type === "int")   updateCell(rowIdx, field, String(parseInt(vn(value)) || 0));

  // ── handleEnterNext style navigation ──
  const colIdx   = editableFields.indexOf(field);
  const rowCount = grid.length;

  if (colIdx < editableFields.length - 1) {
    // next column in same row
    focusCell(rowIdx, editableFields[colIdx + 1]);
  } else if (rowIdx < rowCount - 1) {
    // first column of next row
    setSelIdx(rowIdx + 1);
    focusCell(rowIdx + 1, editableFields[0]);
  } else {
    // last cell of last row → add new row
    const nr = makeNewRow();
    setGrid(prev => {
      const next = [...prev, nr];
      const ni   = next.length - 1;
      setSelIdx(ni);
      focusCell(ni, editableFields[0]);
      return next;
    });
  }
}, [grid, SupplierMulitipleAllow, editableFields, focusCell, updateCell, toast, openSalesmanPicker]);

  // ── gridemptycheck ────────────────────────────────────────────────────────
  const gridemptycheck = useCallback((g) => {
    let cleaned = [...g];
    if (cleaned.length>1 && !String(cleaned[cleaned.length-1].AccountName||"").trim()) cleaned=cleaned.slice(0,-1);
    for (let i=0;i<cleaned.length;i++) {
      if (cleaned[i].EditMode===1 && !String(cleaned[i].AccountName||"").trim()) {
        toast("❌ Enter All Supplier Name in the Grid !!!", true);
        setSelIdx(i); focusCell(i,"AccountName");
        return { ok:false, cleanedGrid:cleaned };
      }
    }
    return { ok:true, cleanedGrid:cleaned };
  }, [focusCell, toast]);

  // ── deleteRow ─────────────────────────────────────────────────────────────
  const deleteRow = useCallback(async (idx) => {
    if (!perm.Delete) { toast("❌ Page Delete Permission Denied !!!", true); return; }
    const row = grid[idx];
    if (row.Id != null && row.Id !== 0) {
      const ok = await confirm(`Do you want to delete "${row.AccountName||""}"?`);
      if (!ok) return;
      setLoading(true);
      const res = await CC.api(
        `${CC.SupplierDelete}?Id=${Number(row.Id)}&AccountType=SUPPLIER&Comid=${Number(IdComList)}&MirrorTable=${Number(MirrorTable)}`,
        null, { "IdComList": "" }
      );
      setLoading(false);
      if (redirectIfDualLogin(res)) return;
      if (res.ok) {
        toast("✅ " + (res.message || "Deleted"));
        setGrid(prev => { const next=prev.filter((_,i)=>i!==idx); const ns=Math.max(0,next.length-1); setSelIdx(ns); focusCell(ns,"AccountName"); return next; });
      } else toast(`❌ ${res.message||"Delete failed"}`, true);
    } else {
      setGrid(prev => { const next=prev.filter((_,i)=>i!==idx); const ns=Math.max(0,next.length-1); setSelIdx(ns); focusCell(ns,"AccountName"); return next; });
    }
  }, [grid, Comid, MirrorTable, IdComList, perm, focusCell, toast, confirm]);

  // ── handleSave ────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const { ok:emptyOk, cleanedGrid } = gridemptycheck(grid);
    if (!emptyOk) return;
    setGrid(cleanedGrid);

    let dirty=[], flag=1;
    if (perm.Add===0&&perm.Edit===0) { toast("❌ Page Add & Update Permission Denied !!!", true); flag=0; }
    else if (perm.Add===1&&perm.Edit===1) { dirty=cleanedGrid.filter(r=>r.EditMode===1); if (!dirty.length) { toast("⚠️ No Data Modified !!!", true); flag=0; } }
    else if (perm.Add===1&&perm.Edit===0) { dirty=cleanedGrid.filter(r=>r.EditMode===1&&r.Id==null); if (!dirty.length) { toast("❌ Page Edit Permission Denied !!!", true); flag=0; } }
    else if (perm.Edit===1&&perm.Add===0) { dirty=cleanedGrid.filter(r=>r.EditMode===1&&r.Id!=null); if (!dirty.length) { toast("❌ Page Add Permission Denied !!!", true); flag=0; } }
    if (flag===0) { addRow(); return; }

    if (!SupplierMulitipleAllow) {
      const names=cleanedGrid.filter(r=>String(r.AccountName||"").trim()).map(r=>String(r.AccountName).trim().toLowerCase());
      if (new Set(names).size!==names.length) { toast("❌ Duplicate Supplier Name found !!!", true); return; }
    }

    const hasNew=dirty.some(r=>!r.Id||r.Id===0), hasExisting=dirty.some(r=>r.Id&&r.Id!==0);
    let msg="Do you want to save the Supplier details?";
    if (hasExisting&&!hasNew) msg="Do you want to update the Supplier details?";
    if (hasExisting&&hasNew)  msg="Do you want to save & update the Supplier details?";
    const proceed = await confirm(msg);
    if (!proceed) { addRow(); return; }

    const payload = dirty.map(({ _uid, ...rest }) => ({
      ...rest, Id:rest.Id??null, AccountType:rest.AccountType||"SUPPLIER",
      Active:          rest.Active===true||rest.Active===1?1:0,
      OpeningBalance:  parseFloat(vn(rest.OpeningBalance))||0,
      CreditBillLimit: parseFloat(vn(rest.CreditBillLimit))||0,
      CreditBillDays:  parseInt(vn(rest.CreditBillDays))||0,
      SalemanRefid:    rest.SalemanRefid||null,
    }));

    setLoading(true);
    const res = await CC.insertapi(CC.SupplierInsert, payload, {
      "Comid":String(Comid), "SupplierMulitipleAllow":String(SupplierMulitipleAllow),
      "AccountTypeNew":"SUPPLIER", "MirrorTable":String(MirrorTable),
      "Tamil":"0", "IdComList":String(IdComList), "ApiType":"1",
    });
    setLoading(false);
if (redirectIfDualLogin(res)) return;
    if (res.ok || res.IsSuccess) {
      toast("✅ " + (res.message||"Saved successfully!"));
      const retField = sessionStorage.getItem("masterReturnField");
      if (retField) {
        sessionStorage.setItem("masterReturnValue", String(res.Data2??res.Id??""));
        sessionStorage.setItem("masterReturnName", dirty[0]?.AccountName||"");
        sessionStorage.removeItem("masterReturnField");
        setTimeout(() => navigate(-1), 800);
      } else {
        await loadDataRef.current?.(); // ← ref call — no dep needed
      }
    } else toast(`❌ ${res.message||"Save failed"}`, true);
  }, [grid, Comid, MirrorTable, IdComList, SupplierMulitipleAllow, perm, navigate, gridemptycheck, addRow, toast, confirm]);

  // ── handleEsc ─────────────────────────────────────────────────────────────
  const handleEsc = useCallback(() => {
    if (!window.confirm("Do You Want To Quit Page?")) return;
    navigate("/Home");
  }, [navigate]);
const handleFilterSearch = useCallback((e) => {
  if (e.key === "Enter" && filterSearch.trim()) {
    doLoadData(salesmanRef.current, filterSearch, filterColumn, 1);
  }
}, [filterSearch, filterColumn]);

  // ── Global keyboard shortcuts ─────────────────────────────────────────────
  useEffect(() => {
    const onKey = e => {
      if (pickerTarget||f12Open) return;
      if (e.keyCode===112) { e.preventDefault(); handleSave(); }
      if (e.keyCode===27)  { e.preventDefault(); handleEsc(); }
      if (e.keyCode===123) { e.preventDefault(); setF12Open(true); }
      if (e.keyCode === 115) { // F4
  e.preventDefault();
  pwOkRef.current = doExcelDownload;
  setPw({ title: "F4 Password" });
}
if (e.keyCode === 118) { // F7
  e.preventDefault();
  pwOkRef.current = doExcelUpload;
  setPw({ title: "F7 Password" });
}
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleEsc, f12Open, pickerTarget]);

  // ── F12 column settings ───────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("supplier_colSettings")||"null");
      if (saved && Array.isArray(saved)) setColSettings(saved);
    } catch {}
  }, []);
const saveColSettings = useCallback(async (localSettings) => {
  setF12Open(false);
  setLoading(true);
  const payload = (localSettings ?? colSettings).map(s => ({
    filename: "Supplier",           // ← "Supplier" not "Cashier"
    column:   s.field,
    Visible:  !s.hidden,
    Width:    s.width,
    Comid:    Number(MComid),
  }));
  try {
    const res  = await fetch("/Login/VisibleColumns", {
      method:  "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.ok) {
      toast("✅ Column settings saved");
      if (localSettings) setColSettings(localSettings);
    } else {
      toast(`❌ ${data.message || "Failed to save"}`, true);
    }
  } catch {
    toast("❌ Error saving column settings", true);
  } finally {
    setLoading(false);
  }
}, [colSettings, MComid, toast]);

useEffect(() => {
  const loadColSettings = async () => {
    try {
      const url =  CC.BASE_URL + `${CC1.GetFocusColumnsUrl}?comid=${sess.Comid}&filename=Supplier`;
      const res = await fetch(url,{
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...CC.authHeaders(),   // ← same headers your other API calls use
              },
            });
      if (!res.ok) return;               // no file yet — use defaults

      const serverData = await res.json();
      if (!Array.isArray(serverData) || !serverData.length) return;

      const merged = ALL_COLUMNS.map(c => {
        const s = serverData.find(d => d.column === c.field);
        return {
          field:  c.field,
          label:  c.label,
          hidden: s ? !s.Visible : c.hidden,
          width:  s ?  s.Width   : c.width,
        };
      });
      setColSettings(merged);
    } catch {
      // file doesn't exist yet — silently use defaults
    }
  };
  loadColSettings();
}, [MComid]);
  // ── Cell renderer ─────────────────────────────────────────────────────────
function renderCell(row, rowIdx, colDef) {
  const { field, type, maxLen, options } = colDef;
  const value   = row[field] ?? "";
  const refKey  = `${rowIdx}_${field}`;
  const editMode = row.EditMode ?? 0;

  const cellStyle = {
    background:   editMode === 0 ? "transparent" : "#fff",
    border:       editMode === 0 ? "none"        : "1px solid #93c5fd",
    cursor:       editMode === 0 ? "default"     : "text",
    color:        editMode === 0 ? "inherit"     : "#1e293b",
    boxShadow:    editMode === 0 ? "none"        : "0 0 0 2px rgba(59,130,246,0.15)",
    borderRadius: editMode === 1 ? "4px"         : "0",
    padding:      editMode === 0 ? "2px 4px"     : undefined,
  };

  const common = {
    ref:       el => { if (el) cellRefs.current[refKey]=el; else delete cellRefs.current[refKey]; },
    onFocus:   () => setSelIdx(rowIdx),
    onKeyDown: e  => editMode === 1 && onCellKeyDown(e, rowIdx, field),
  };
if (type === "active-select") return (
  <div style={{ display:"flex", justifyContent:"center", alignItems:"center" }}>
    <div
      onClick={() => editMode === 1 && updateCell(rowIdx, field, value === 1 || value === true ? 0 : 1)}
      style={{
        width: 34, height: 18,
        borderRadius: 9,
        background: (value === 1 || value === true) ? "#16a34a" : "#d1d5db",
        position: "relative",
        cursor: editMode === 1 ? "pointer" : "not-allowed",
        transition: "background .2s",
        opacity: editMode === 0 ? 0.6 : 1,
        flexShrink: 0,
      }}>
      <div style={{
        position: "absolute",
        top: 2,
        left: (value === 1 || value === true) ? 16 : 2,
        width: 14, height: 14,
        borderRadius: "50%",
        background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,.25)",
        transition: "left .2s",
      }} />
    </div>
  </div>
);
  if (type === "select") return (
    <select {...common} className="mp-cell-select"
      value={value ?? ""}
      disabled={editMode === 0}
      style={{ opacity: editMode === 0 ? 0.6 : 1 }}
      onChange={e => editMode === 1 && updateCell(rowIdx, field, e.target.value)}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  if (type === "salesman") return (
    <input {...common} className="mp-cell-input" type="text"
      readOnly
      value={String(value)}
      style={{ ...cellStyle,
        cursor: editMode === 0 ? "default" : "pointer",
        background: editMode === 0 ? "transparent" : "#f8fafc" }}
      onDoubleClick={() => editMode === 1 && openSalesmanPicker(rowIdx)} />
  );

  const isNum = type === "int" || type === "float";
  return (
    <input {...common} className="mp-cell-input"
      type="text"
      maxLength={maxLen || 200}
      value={String(value)}
      readOnly={editMode === 0}
      style={{ ...cellStyle, ...(isNum ? { textAlign:"right" } : {}) }}
      onChange={e => {
        if (editMode === 0) return;
        isNum
          ? updateCell(rowIdx, field, e.target.value)
          : CC.applyUppercase(e, val => updateCell(rowIdx, field, val));
      }}
      onBlur={e => {
        if (editMode === 0) return;
        if (type === "float") updateCell(rowIdx, field, parseFloat(parseFloat(e.target.value)||0).toFixed(2));
        if (type === "int")   updateCell(rowIdx, field, String(parseInt(e.target.value)||0));
      }} />
  );
}
function PwModal({ title, comid, onOk, onClose }) {
  const [val, setVal] = useState("");
  const verify = async () => {
    if (!val) return;
    const res = await CC.api(CC.LoginPasswordUrl, null, {}, { password: val, type: "EditPassword", Comid: comid });
    if (redirectIfDualLogin(res)) return;
    if (res.ok ?? res.IsSuccess ?? false) { onOk(); onClose(); }
    else window.alert("Invalid Password !!!");
  };
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(10,20,40,0.45)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ background:"#fff",borderRadius:8,width:280,padding:"20px 24px",boxShadow:"0 8px 32px rgba(0,0,0,0.22)" }}>
        <div style={{ fontSize:14,fontWeight:700,marginBottom:12,color:"#1f65de" }}>🔐 {title}</div>
        <input type="password" autoFocus value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key==="Enter") verify(); if (e.key==="Escape") onClose(); }}
          style={{ width:"100%",padding:"6px 10px",border:"1px solid #c5d8f8",borderRadius:4,fontSize:13,marginBottom:14,outline:"none" }}
          placeholder="Enter password…" />
        <div style={{ display:"flex",gap:8,justifyContent:"flex-end" }}>
          <button className="mp-btn" onClick={onClose}>Cancel</button>
          <button className="mp-btn sv" onClick={verify}>OK</button>
        </div>
      </div>
    </div>
  );
}
  // ── F12 Popup — same style as CashierMaster ───────────────────────────────
  function F12Popup() {
    const [local, setLocal] = useState(colSettings.map(s=>({...s})));
    return (
      <div style={{ position:"fixed",inset:0,background:"rgba(10,20,40,.5)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center" }}>
        <div style={{ background:"#fff",borderRadius:8,width:450,maxHeight:"80vh",display:"flex",flexDirection:"column",boxShadow:"0 16px 48px rgba(0,0,0,.3)",overflow:"hidden" }}>
          <div style={{ background:"#1a2e4a",color:"#fff",padding:"10px 16px",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <span>⚙ Column Settings (F12)</span>
            <button style={{ background:"none",border:"none",color:"#fff",fontSize:17,cursor:"pointer" }} onClick={()=>setF12Open(false)}>✕</button>
          </div>
          <div style={{ flex:1,overflowY:"auto",padding:12 }}>
            <table style={{ borderCollapse:"collapse",width:"100%" }}>
              <thead><tr>{["Column","Visible","Width (px)"].map(h=><th key={h} style={{ background:"#1a2e4a",color:"#fff",padding:"6px 10px",fontSize:11,fontWeight:600,textAlign:"left" }}>{h}</th>)}</tr></thead>
              <tbody>{local.map(s=>(
                <tr key={s.field}>
                  <td style={{ padding:"5px 10px",fontSize:12,borderBottom:"1px solid #eaecf4" }}>{s.label}</td>
                  <td style={{ padding:"5px 10px",textAlign:"center",borderBottom:"1px solid #eaecf4" }}>
                    <input type="checkbox" checked={!s.hidden} onChange={()=>setLocal(p=>p.map(x=>x.field===s.field?{...x,hidden:!x.hidden}:x))} />
                  </td>
                  <td style={{ padding:"5px 10px",borderBottom:"1px solid #eaecf4" }}>
                    <input type="number" min="40" max="500" value={s.width}
                      style={{ width:70,border:"1px solid #d4dbe8",borderRadius:3,padding:"2px 6px",fontSize:12,textAlign:"right" }}
                      onChange={e=>setLocal(p=>p.map(x=>x.field===s.field?{...x,width:parseInt(e.target.value)||x.width}:x))} />
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div style={{ padding:"10px 14px",display:"flex",gap:8,justifyContent:"flex-end",borderTop:"1px solid #e5e7eb" }}>
            <button onClick={() => { setColSettings(local); saveColSettings(local); }} style={{ background:"#1a2e4a",color:"#fff",border:"none",borderRadius:4,padding:"6px 18px",fontSize:12,fontWeight:700,cursor:"pointer" }}>💾 Save</button>
            <button onClick={()=>setF12Open(false)} style={{ background:"#fff",color:"#6b7280",border:"1px solid #d1d5db",borderRadius:4,padding:"6px 14px",fontSize:12,cursor:"pointer" }}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mp-wrap supplier-page">
      {ConfirmUI}
      {pw && (
  <PwModal
    title={pw.title}
    comid={Comid}
    onOk={() => { pwOkRef.current?.(); }}
    onClose={() => setPw(null)}
  />
)}
      <Topbar />
      {loading && <div className="mp-loader-ov"><div className="mp-ldr-box"><div className="mp-spin"/><div className="mp-ldr-msg">Processing…</div></div></div>}
      {f12Open && <F12Popup />}
      {pickerTarget && <SalesmanPicker salesmanList={salesmanList} initialSearch={pickerTarget.currentName} onSelect={onSalesmanSelect} onClose={onSalesmanClose} />}
<div className="mp-body">

  {/* ── TOP TOOLBAR: Title + Filter ── */}
  <div className="mp-toolbar" style={{
    display: "flex", alignItems: "center",
    gap: 6, padding: "6px 10px", flexWrap: "wrap",
  }}>
    <div style={{ width:1, height:22, background:"#d1d5db", margin:"0 4px" }} />
    <div className="mp-toolbar-title">Supplier Master</div>

    {/* Search filter — pushed to the right */}
    <div style={{ display:"flex", gap:4, alignItems:"center", marginLeft:"auto" }}>
      <select className="mp-cell-select" style={{ width:160, height:28 }}
        value={filterColumn} onChange={e => setFilterColumn(e.target.value)}>
        <option value="AccountName">Supplier Name</option>
        <option value="MobileNo">Mobile No</option>
        <option value="GSTINNo">GSTIN No</option>
        <option value="City">City</option>
        <option value="Code">Code</option>
      </select>
      <input className="mp-cell-input" style={{ width:160, height:28 }}
        placeholder="Search… (Enter)"
        value={filterSearch}
        onChange={e => setFilterSearch(e.target.value)}
        onKeyDown={handleFilterSearch}
      />
      <select className="mp-cell-select" style={{ width:110, height:28 }}
        value={activeFilter} onChange={e => setActiveFilter(e.target.value)}>
        <option value="all">All</option>
        <option value="active">Active Only</option>
      </select>
    </div>
  </div>

  {/* ── Grid ── */}
    <div className="mp-grid-wrap" style={{ overflowX:"auto", width:"100%" }}>
  <table className="mp-tbl" style={{ width:"100%", tableLayout:"fixed", minWidth:visibleColumns.reduce((a,c)=>a+c.width,150)+"px" }}>
        <thead>
  <tr>
    <th style={{ width:45 }}>S.No</th>
    <th style={{ width:44 }}></th>  {/* ← edit icon column */}
    {visibleColumns.map(c => (
      <th key={c.field} style={{ width:c.width, minWidth:c.width,
        textAlign: c.field==="Active" ? "center" : undefined }}>
        {c.label}
      </th>
    ))}
    <th style={{ width:44 }}></th>
  </tr>
</thead>
<tbody>
  {displayGrid.map((row, idx) => {
      const rowIdx = grid.indexOf(row);
    const editMode = row.EditMode ?? 0;
    return (
      <tr key={row._uid}
        className={[
          selIdx === rowIdx ? "sel" : "",
          row.Active === 0 || row.Active === false ? "inact" : "",
          editMode === 1 ? "mod" : "",
        ].filter(Boolean).join(" ")}
        onClick={() => selectRow(rowIdx)}>

        <td className="sno">{rowIdx + 1}</td>

        {/* ── Edit icon cell ── */}
        <td style={{ textAlign:"center", whiteSpace:"nowrap" }}>
          {row.Id && editMode === 0 && (
            <button className="mp-edit-btn" title="Edit row"
              onClick={e => { e.stopPropagation(); enableEdit(rowIdx); }}>
              ✏️
            </button>
          )}
          {row.Id && editMode === 1 && (
            <button className="mp-edit-btn active" title="Editing…"
              style={{ color:"#16a34a", cursor:"default" }}>
              ✏️
            </button>
          )}
        </td>

        {visibleColumns.map(colDef => (
          <td key={colDef.field}
            style={{ padding:"2px 4px",
              textAlign: colDef.field==="Active" ? "center" : undefined }}
            onClick={e => {
              e.stopPropagation();
              selectRow(rowIdx);
              if (editMode === 1) {
                setTimeout(() => {
                  const el = cellRefs.current[`${rowIdx}_${colDef.field}`];
                  if (el) { el.focus(); el.select?.(); }
                }, 20);
              }
            }}>
            {renderCell(row, rowIdx, colDef)}
          </td>
        ))}

        <td style={{ textAlign:"center", padding:"2px 4px" }}>
          <button className="mp-del-btn"
            onClick={e => { e.stopPropagation(); deleteRow(rowIdx); }}>
            🗑
          </button>
        </td>
      </tr>
    );
  })}
</tbody>
          </table>
          {grid.length===0 && !loading && <div className="mp-empty">No records. Press ➕ to add a supplier.</div>}
        </div>

  {/* ── BOTTOM TOOLBAR: All action buttons ── */}
  <div className="mp-toolbar" style={{
    display: "flex", alignItems: "center",
    gap: 6, padding: "6px 10px", flexWrap: "wrap",
  }}>
    <button className="mp-btn nw" onClick={addRow} disabled={loading}>➕ Add Row</button>
    <button className="mp-btn sv" onClick={handleSave} disabled={loading}>💾 F1 Save</button>
    <button className="mp-btn ex"
      onClick={() => { pwOkRef.current = doExcelDownload; setPw({ title:"F4 Password" }); }}>
      📥 F4 Excel↓
    </button>
    <button className="mp-btn ex"
      onClick={() => { pwOkRef.current = doExcelUpload; setPw({ title:"F7 Password" }); }}>
      📤 F7 Excel↑
    </button>
    <button className="mp-btn"
      style={{ background:"var(--color-background-secondary)", color:"var(--color-text-primary)", border:"1px solid #9ca3af" }}
      onClick={() => setF12Open(true)}>
      ⚙ F12 Columns
    </button>
    <button className="mp-btn"
     onClick={() => doLoadData(salesmanRef.current, "", "", curPage)}
      disabled={loading}
      style={{ background:"#059669", color:"#fff", borderColor:"#059669" }}>
      🔄 Refresh
    </button>
     <div style={{ display:"flex", alignItems:"center", gap:4, marginLeft:8 }}>
  {Array.from({ length: pageLen }, (_, i) => i + 1).map(p => (
    <button key={p}
      onClick={() => goToPage(p)}
      className="mp-btn"
      style={{
        padding:"3px 9px", fontSize:12, minWidth:28,
        background: p === curPage ? "#1a2e4a" : "#fff",
        color:      p === curPage ? "#fff"    : "#1a2e4a",
        border: "1px solid #1a2e4a",
      }}>
      {p}
    </button>
  ))}
  <span style={{ fontSize:11, color:"#64748b", marginLeft:6, fontWeight:600 }}>
    Record {pageCountTotal}
  </span>
</div>
    {salesmanLoading && (
      <span style={{ fontSize:11, color:"#94a3b8", marginLeft:8 }}>Loading salesman…</span>
    )}
    <button className="mp-btn dl" onClick={handleEsc} style={{ marginLeft:"auto" }}>
      ✕ Esc Cancel
    </button>
   
  </div>

</div>

      <CC.ToastList toasts={toasts} />
    </div>
  );
}