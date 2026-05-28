import { useState, useEffect, useRef, useCallback } from "react";
import "./MasterPage.css";
import Topbar from "../components/Topbar";
/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS  (identical pattern to BrandMaster)
───────────────────────────────────────────────────────────────────────────── */
const mkUrl = (path) => (path.startsWith("/") ? path : "/" + path);

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  Userid:        localStorage.getItem("Userid") || localStorage.getItem("userid") || "0",
  Profile:       localStorage.getItem("Profile")    || "Admin",
  LoginCheck:    localStorage.getItem("LoginCheck") || "1",
});

/** Generic POST helper — mirrors BrandMaster api() exactly */
const api = async (path, body = null, extraHeaders = {}, queryParams = null) => {
  try {
    let fullUrl = mkUrl(path);
    if (queryParams && typeof queryParams === "object") {
      const qs = new URLSearchParams(
        Object.entries(queryParams)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => [k, String(v)])
      ).toString();
      if (qs) fullUrl += "?" + qs;
    }
    const res = await fetch(fullUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...authHeaders(),
        ...extraHeaders,
      },
      body: body !== null ? JSON.stringify(body) : null,
    });
    if (res.status === 406) {
      alert("Already Login Another User Please Login Again!!!");
      window.location.href = "/Login";
      return { ok: false };
    }
    if (res.status === 404) return { ok: false, _http404: true, message: `404: ${fullUrl}` };
    if (res.status === 500) {
      const t = await res.text();
      console.error(`500 on ${fullUrl}:`, t.slice(0, 500));
      return { ok: false, message: "Server error 500 — see console" };
    }
    const text = await res.text();
    if (!text.trim()) return { ok: false, message: "Empty response" };
    try {
      const j = JSON.parse(text);
      if (j.IsSuccess !== undefined && j.ok      === undefined) j.ok      = j.IsSuccess;
      if (j.Data1     !== undefined && j.data    === undefined) j.data    = j.Data1;
      if (j.Message   !== undefined && j.message === undefined) j.message = j.Message;
      return j;
    } catch {
      return { ok: false, message: text };
    }
  } catch (err) {
    return { ok: false, _netErr: true, message: err.message };
  }
};

const getLocal = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const getStr   = (k) => localStorage.getItem(k) || "";
const uid      = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36));
const valNum   = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

/* ─────────────────────────────────────────────────────────────────────────────
   ROW FACTORY
───────────────────────────────────────────────────────────────────────────── */
function makeBlankRow() {
  return {
    _uid:             uid(),
    EditMode:         0,
    Id:               null,
    SchemeRefId:      null,
    ProductCode:      "",
    ProductName:      "",
    // Old / read-only (filled from API — mirrors jQuery FillItems)
    OldMRP:           "",
    oldpurRate:       "",
    oldSaleRate:      "",
    oldWholeSaleRate: "",
    // New / editable (left blank intentionally — user must enter)
    MRP:          "",
    PurchaseRate: "",
    SalesRate:    "",
    WholeSaleRate:"",
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────────────────────────────────────── */

function Loader({ msg = "Please wait…" }) {
  return (
    <div className="mp-loader-ov">
      <div className="mp-ldr-box">
        <div className="mp-spin" />
        <div className="mp-ldr-msg">{msg}</div>
      </div>
    </div>
  );
}

/** Product Picker — mirrors jQuery ProductListP + ItemDescriptionWindow */
function ProductPickerModal({ onSelect, onClose }) {
  const [all,    setAll]    = useState([]);
  const [search, setSearch] = useState("");
  const [selIdx, setSelIdx] = useState(0);
  const [err,    setErr]    = useState("");
  const inputRef = useRef(null);



  useEffect(() => {
    let mounted = true;
  
    (async () => {
      try {
        setErr("");
  
        const res = await api(
          "/ItemMaster/SelectItemMaster",
          null,
          {},
          {
            Comid: Number(localStorage.getItem("Comid")) || 1,
            Startindex: 0,
            PageCount: 500,
            Keyword: "",
            Column: ""
          }
        );
  
        console.log(
          "SelectItemMaster Response =>",
          res
        );
  
        if (res?._netErr || res?._http404) {
          setErr(
            res?.message ||
            "Failed to load products"
          );
          return;
        }
  
        const arr =
          Array.isArray(res?.Data1)
            ? res.Data1
            : Array.isArray(res?.data?.Data1)
            ? res.data.Data1
            : Array.isArray(res?.data)
            ? res.data
            : [];
  
        if (mounted) {
          setAll(arr);
        }
      } catch (ex) {
        console.error(ex);
  
        setErr(
          ex?.message ||
          "Unexpected error"
        );
      }
    })();
  
    const t = setTimeout(() => {
      inputRef.current?.focus();
    }, 80);
  
    return () => {
      mounted = false;
      clearTimeout(t);
    };
  }, []);
  
  const keyword = search.trim().toLowerCase();
  
  const filtered = keyword
    ? all.filter((p) => {
        const name = String(
          p.ProductName ||
          p.PName ||
          ""
        ).toLowerCase();
  
        const code = String(
          p.ProductCode ||
          p.Productcode ||
          p.PCode ||
          ""
        ).toLowerCase();
  
        return (
          name.includes(keyword) ||
          code.includes(keyword)
        );
      })
    : all;
  
  // keep selected row safe after filtering
  useEffect(() => {
    if (filtered.length === 0) {
      setSelIdx(0);
      return;
    }
  
    if (selIdx >= filtered.length) {
      setSelIdx(filtered.length - 1);
    }
  }, [filtered, selIdx]);
  
  function selectRow(row) {
    if (!row) return;
  
    onSelect(
      row.ProductCode ||
      row.Productcode ||
      row.PCode ||
      ""
    );
  }
  
  function onSearchKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
  
      setSelIdx((i) =>
        Math.min(
          i + 1,
          Math.max(filtered.length - 1, 0)
        )
      );
  
      return;
    }
  
    if (e.key === "ArrowUp") {
      e.preventDefault();
  
      setSelIdx((i) =>
        Math.max(i - 1, 0)
      );
  
      return;
    }
  
    if (e.key === "Enter") {
      e.preventDefault();
  
      selectRow(filtered[selIdx]);
  
      return;
    }
  
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }
  
  function onListKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
  
      setSelIdx((i) =>
        Math.min(
          i + 1,
          Math.max(filtered.length - 1, 0)
        )
      );
  
      return;
    }
  
    if (e.key === "ArrowUp") {
      e.preventDefault();
  
      setSelIdx((i) =>
        Math.max(i - 1, 0)
      );
  
      return;
    }
  
    if (e.key === "Enter") {
      e.preventDefault();
  
      selectRow(filtered[selIdx]);
  
      return;
    }
  
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div className="mp-picker-ov">
      <div
        className="mp-picker"
        style={{ width: 700, maxHeight: 500 }}
        onKeyDown={onListKeyDown}
      >
        <header>
          <h3>Select Product</h3>
          <button className="mp-picker-close" onClick={onClose}>✕</button>
        </header>
        {err && (
          <div style={{ padding: "6px 12px", fontSize: 11, color: "#dc2626" }}>
            Load error: {err}
          </div>
        )}
        <div className="mp-picker-search">
          <input
            ref={inputRef}
            placeholder="Search by name or code…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelIdx(0); }}
            onKeyDown={onSearchKeyDown}
          />
        </div>
        <div className="mp-picker-list">
          <table className="mp-picker-tbl">
            <thead>
              <tr>
                <th style={{ width: 120 }}>Code</th>
                <th>Name</th>
                <th style={{ width: 120 }}>Landing Cost</th>
                <th style={{ width: 120 }}>Opening Stock</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr
                  key={p.Id || i}
                  className={i === selIdx ? "psel" : ""}
                  onMouseEnter={() => setSelIdx(i)}
                  onClick={() => onSelect(p.ProductCode || p.Productcode)}
                >
                  <td>{p.ProductCode || p.Productcode}</td>
                  <td>{p.ProductName}</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{p.LandingCost}</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{p.OpeningStock}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "#aaa", padding: 18 }}>
                    {err ? "Failed to load products" : "No results"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   GRID ROW  — tab-order mirrors jQuery GirdNextCell exactly:
   ProductCode → MRP(new) → PurchaseRate → SalesRate → WholeSaleRate → next row
───────────────────────────────────────────────────────────────────────────── */
function GridRow({
  row, idx, selected, inputRefs,
  onChange, onProductCodeEnter, onOpenPicker,
  onRateKeyDown, onRateBlur, onDelete, onClick,
}) {
  const ref = (field) => (el) => {
    if (inputRefs) inputRefs.current[`${idx}_${field}`] = el;
  };

  const RO = { className: "mp-cell-input", style: { background: "#f5f7fb", color: "#6b7a99", cursor: "default", textAlign: "right", fontFamily: "monospace" }, readOnly: true, tabIndex: -1 };
  const ED = { className: "mp-cell-input", style: { textAlign: "right", fontFamily: "monospace" } };

  return (
    <tr
      className={[selected ? "sel" : "", row.EditMode ? "mod" : ""].filter(Boolean).join(" ")}
      onClick={onClick}
    >
      {/* S.No */}
      <td className="sno">{idx + 1}</td>

      {/* Product Code */}
      <td>
        <input
          ref={ref("ProductCode")}
          className="mp-cell-input"
          value={row.ProductCode}
          placeholder="Code / F9"
          autoComplete="off"
          onChange={(e) => onChange(idx, "ProductCode", e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); onProductCodeEnter(idx); }
            if (e.key === "F9" || (e.key === " " && !row.ProductCode.trim())) {
              e.preventDefault();
              onOpenPicker(idx);
            }
          }}
        />
      </td>

      {/* Description — read-only */}
      <td>
        <input {...RO} value={row.ProductName} />
      </td>

      {/* MRP Old — read-only */}
      <td>
        <input {...RO} value={row.OldMRP} />
      </td>

      {/* MRP New — editable */}
      <td>
        <input
          ref={ref("MRP")}
          {...ED}
          value={row.MRP}
          placeholder="0.00"
          onChange={(e) => onChange(idx, "MRP", e.target.value)}
          onBlur={() => onRateBlur(idx, "MRP")}
          onKeyDown={(e) => onRateKeyDown(e, idx, "MRP")}
        />
      </td>

      {/* Old Purchase Rate — read-only */}
      <td>
        <input {...RO} value={row.oldpurRate} />
      </td>

      {/* New Purchase Rate — editable */}
      <td>
        <input
          ref={ref("PurchaseRate")}
          {...ED}
          value={row.PurchaseRate}
          placeholder="0.00"
          onChange={(e) => onChange(idx, "PurchaseRate", e.target.value)}
          onBlur={() => onRateBlur(idx, "PurchaseRate")}
          onKeyDown={(e) => onRateKeyDown(e, idx, "PurchaseRate")}
        />
      </td>

      {/* Old Sale Rate — read-only */}
      <td>
        <input {...RO} value={row.oldSaleRate} />
      </td>

      {/* New Sale Rate — editable */}
      <td>
        <input
          ref={ref("SalesRate")}
          {...ED}
          value={row.SalesRate}
          placeholder="0.00"
          onChange={(e) => onChange(idx, "SalesRate", e.target.value)}
          onBlur={() => onRateBlur(idx, "SalesRate")}
          onKeyDown={(e) => onRateKeyDown(e, idx, "SalesRate")}
        />
      </td>

      {/* Old Wholesale Rate — read-only */}
      <td>
        <input {...RO} value={row.oldWholeSaleRate} />
      </td>

      {/* New Wholesale Rate — editable */}
      <td>
        <input
          ref={ref("WholeSaleRate")}
          {...ED}
          value={row.WholeSaleRate}
          placeholder="0.00"
          onChange={(e) => onChange(idx, "WholeSaleRate", e.target.value)}
          onBlur={() => onRateBlur(idx, "WholeSaleRate")}
          onKeyDown={(e) => onRateKeyDown(e, idx, "WholeSaleRate")}
        />
      </td>

      {/* Delete */}
      <td style={{ textAlign: "center" }}>
        <button
          className="mp-del-btn"
          title="Delete row"
          onClick={(e) => { e.stopPropagation(); onDelete(idx); }}
        >
          🗑
        </button>
      </td>
    </tr>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN  — RateChange
───────────────────────────────────────────────────────────────────────────── */
export default function RateChange() {

  /* ── Session (mirrors jQuery document.ready exactly) ── */
  const [sess] = useState(() => {
    try {
      const main0      = (getLocal("Mainsetting") || [{}])[0] || {};
      const Comid      = getStr("Comid")    || "1";
      const MComid     = getStr("MComid")   || Comid;
      const IdComList  = getStr("IdComList") || Comid;
      const mt         = main0.MirrorTableOnline;
      const MirrorTable = (mt === true || mt === 1 || mt === "1") ? "1" : "0";
      const CommonCompany = main0.CommonCompany === true || main0.CommonCompany === "true";
      return {
        Comid:       CommonCompany ? MComid : Comid,
        MComid,
        IdComList,
        MirrorTable,
        menudata:    (getLocal("menulist") || []).filter((o) => o.PageName === "Billing-POS"),
      };
    } catch {
      return { Comid: "1", MComid: "1", IdComList: "1", MirrorTable: "0", menudata: [] };
    }
  });

  const perm = sess.menudata[0] || { View: 1, Add: 1, Edit: 1, Delete: 1 };

  /* ── State ── */
  const [rows,       setRows]       = useState([makeBlankRow()]);
  const [selIdx,     setSelIdx]     = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [toasts,     setToasts]     = useState([]);
  const [permDenied, setPermDenied] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [pickerRow,  setPickerRow]  = useState(null);

  /* ── Refs ── */
  const inputRefs  = useRef({});
  const rowsRef    = useRef(rows);
  const selIdxRef  = useRef(selIdx);
  const toastId    = useRef(0);
  const submitting = useRef(false);

  useEffect(() => { rowsRef.current  = rows;   }, [rows]);
  useEffect(() => { selIdxRef.current = selIdx; }, [selIdx]);

  /* ── Toast helper (mirrors BrandMaster) ── */
  const toast = useCallback((msg, isErr = false) => {
    const id = ++toastId.current;
    setToasts((p) => [...p, { id, msg, isErr }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4500);
  }, []);

  /* ── Focus helper ── */
  const focusCell = useCallback((rowIdx, field) => {
    setTimeout(() => {
      const el = inputRefs.current[`${rowIdx}_${field}`];
      if (el) { el.focus(); el.select(); }
    }, 30);
  }, []);

  /* ── Permission / session guard (mirrors jQuery document.ready) ── */
  useEffect(() => {
    const menulist = getLocal("menulist");
    if (!menulist) {
      alert("Session Close Please Login !!!");
      window.location.href = "/Login/Index";
      return;
    }
    const menudata = menulist.filter((o) => o.PageName === "Billing-POS");
    if (!menudata.length || menudata[0].View === 0) {
      setPermDenied("Page Access Permission Denied !!!");
      setTimeout(() => { window.location.href = "/Home"; }, 3000);
      return;
    }
    // Focus first row on mount
    setTimeout(() => focusCell(0, "ProductCode"), 200);
  }, [focusCell]);

  /* ──────────────────────────────────────────────────────────────────────────
     addRow  — mirrors jQuery Addrowfunc + addrow
  ────────────────────────────────────────────────────────────────────────── */
  const addRow = useCallback(() => {
    setRows((prev) => {
      // Trim trailing blank row if >1 row (mirrors jQuery gridemptycheck during addrow)
      const last    = prev[prev.length - 1];
      const cleaned = (prev.length > 1 && !last.ProductCode.trim())
        ? prev.slice(0, -1)
        : prev;
      const next = [...cleaned, makeBlankRow()];
      const newIdx = next.length - 1;
      setTimeout(() => {
        setSelIdx(newIdx);
        focusCell(newIdx, "ProductCode");
      }, 30);
      return next;
    });
  }, [focusCell]);

  /* ── deleteRow ── */
  const deleteRow = useCallback((idx) => {
    if (!perm.Delete) { toast("❌ Page Delete Permission Denied !!!", true); return; }
    setRows((prev) => {
      if (prev.length === 1) return [makeBlankRow()];
      const next   = prev.filter((_, i) => i !== idx);
      const newIdx = Math.min(idx, next.length - 1);
      setTimeout(() => { setSelIdx(newIdx); focusCell(newIdx, "ProductCode"); }, 30);
      return next;
    });
  }, [perm.Delete, focusCell, toast]);

  /* ── updateCell ── */
  const updateCell = useCallback((idx, field, value) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value, EditMode: 1 } : r))
    );
  }, []);

  /* ──────────────────────────────────────────────────────────────────────────
     fillItemByCode  — mirrors jQuery FillItemCode exactly
     POST /ItemMaster/SelectItemMasterbyCodeId
     body: {"code":"X","Comid":<MComid>,"CComid":<Comid>,"Id":0,"Batchwise":0}
  ────────────────────────────────────────────────────────────────────────── */
  const fillItemByCode = useCallback(
    async (code, rowIdx) => {
  
      if (!code || !code.trim()) {
        setPickerRow(rowIdx);
        setShowPicker(true);
        return;
      }
  
      setLoading(true);
  
      try {
  
        const query = {
          code: code.trim(),
          Comid: parseInt(sess.MComid, 10) || 0,
          CComid: parseInt(sess.Comid, 10) || 0,
          Id: 0,
          Batchwise: 0,
        };
  
        const res = await api(
          "/ItemMaster/SelectItemMasterbyCodeId",
          null,
          {},
          query
        );
  
        console.log(
          "SelectItemMasterbyCodeId =>",
          res
        );
  
        if (
          res?._netErr ||
          res?._http404
        ) {
          toast(
            `❌ ${res?.message || "API Error"}`,
            true
          );
  
          focusCell(rowIdx, "ProductCode");
          return;
        }
  
        const arr =
          Array.isArray(res?.Data1)
            ? res.Data1
            : Array.isArray(res?.data?.Data1)
            ? res.data.Data1
            : Array.isArray(res?.data)
            ? res.data
            : [];
  
        if (arr.length === 0) {
  
          toast(
            "❌ Invalid Product Code !!!",
            true
          );
  
          setRows((prev) =>
            prev.map((r, i) =>
              i === rowIdx
                ? {
                    ...r,
                    ProductCode: "",
                  }
                : r
            )
          );
  
          focusCell(
            rowIdx,
            "ProductCode"
          );
  
          return;
        }
  
        if (arr.length === 1) {
  
          fillItems(arr, rowIdx);
  
        } else {
  
          setPickerRow(rowIdx);
          setShowPicker(true);
        }
  
      } catch (err) {
  
        console.error(
          "[fillItemByCode]",
          err
        );
  
        toast(
          "❌ Technical Fault. Contact Software Vendor !!!",
          true
        );
  
        focusCell(
          rowIdx,
          "ProductCode"
        );
  
      } finally {
  
        setLoading(false);
      }
    },
    [
      sess,
      focusCell,
      toast,
      fillItems
    ]
  );

  /* ──────────────────────────────────────────────────────────────────────────
     fillItems  — mirrors jQuery FillItems exactly
     Sets OLD rate fields from API; leaves NEW rate fields blank.
     After fill: moves focus to MRP (new) column.
  ────────────────────────────────────────────────────────────────────────── */
  function fillItems(arr, rowIdx) {
    if (!arr || arr.length === 0) {
      toast("❌ Invalid Product Code !!!", true);
      focusCell(rowIdx, "ProductCode");
      return;
    }
    const item = arr[0];
    setRows((prev) =>
      prev.map((r, i) =>
        i === rowIdx
          ? {
              ...r,
              EditMode:         1,
              Id:               item.Id           ?? null,
              ProductCode:      item.ProductCode  || item.Productcode || "",
              ProductName:      item.ProductName  || "",
              // OLD rates — read-only display
              OldMRP:           parseFloat(item.MRP          || 0).toFixed(2),
              oldpurRate:       parseFloat(item.PurchaseRate  || 0).toFixed(2),
              oldSaleRate:      parseFloat(item.SalesRate     || 0).toFixed(2),
              oldWholeSaleRate: parseFloat(item.WholeSaleRate || 0).toFixed(2),
              // NEW rates — intentionally blank (user must type)
              MRP:          "",
              PurchaseRate: "",
              SalesRate:    "",
              WholeSaleRate:"",
            }
          : r
      )
    );
    // jQuery: gridRatechange.jqxGrid('selectcell', rowindex, grdMRP)
    setTimeout(() => {
      setSelIdx(rowIdx);
      focusCell(rowIdx, "MRP");
    }, 30);
  }

  /* ── Picker select handler ── */
  async function onPickerSelect(code) {
    setShowPicker(false);
    const idx = pickerRow;
    setPickerRow(null);
    if (idx !== null && code) await fillItemByCode(code, idx);
  }

  /* ── onProductCodeEnter ── */
  const onProductCodeEnter = useCallback((idx) => {
    const code = rowsRef.current[idx]?.ProductCode?.trim();
    if (!code) { setPickerRow(idx); setShowPicker(true); }
    else        { fillItemByCode(code, idx); }
  }, [fillItemByCode]);

  /* ──────────────────────────────────────────────────────────────────────────
     onRateBlur  — mirrors jQuery cellendedit + toFixed(2) setcellvalue
  ────────────────────────────────────────────────────────────────────────── */
  const onRateBlur = useCallback((idx, field) => {
    const raw = rowsRef.current[idx]?.[field] ?? "";
    const v   = valNum(raw).toFixed(2);
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: v } : r)));

    // jQuery validation: if PurchaseRate > MRP → MsgBox
    if (field === "PurchaseRate" || field === "MRP") {
      const row = { ...rowsRef.current[idx], [field]: v };
      const pur = valNum(row.PurchaseRate);
      const mrp = valNum(row.MRP);
      if (mrp > 0 && pur > 0 && pur > mrp) {
        toast("❌ Purchase Rate is Higher than MRP", true);
        setTimeout(() => focusCell(idx, "PurchaseRate"), 50);
      }
    }
  }, [focusCell, toast]);

  /* ──────────────────────────────────────────────────────────────────────────
     onRateKeyDown  — mirrors jQuery GirdNextCell exactly:
       MRP          → skip OldPurchaseRate → PurchaseRate
       PurchaseRate → skip OldSaleRate    → SalesRate
       SalesRate    → skip OldWholeSale   → WholeSaleRate
       WholeSaleRate → next row ProductCode (or addRow if last)
  ────────────────────────────────────────────────────────────────────────── */
  const onRateKeyDown = useCallback((e, rowIdx, field) => {
    if (e.key !== "Enter") return;
    e.preventDefault();

    // Commit toFixed first (mirrors jQuery setcellvalue before GirdNextCell)
    const raw = rowsRef.current[rowIdx]?.[field] ?? "";
    const v   = valNum(raw).toFixed(2);
    setRows((prev) => prev.map((r, i) => (i === rowIdx ? { ...r, [field]: v } : r)));

    // Run validation (mirrors jQuery methods.validation())
    const row  = { ...rowsRef.current[rowIdx], [field]: v };
    const pur  = valNum(row.PurchaseRate);
    const mrp  = valNum(row.MRP);
    if (field !== "WholeSaleRate" && mrp > 0 && pur > 0 && pur > mrp) {
      toast("❌ Purchase Rate is Higher than MRP", true);
      focusCell(rowIdx, "PurchaseRate");
      return;
    }

    const nextFieldMap = {
      MRP:          "PurchaseRate",
      PurchaseRate: "SalesRate",
      SalesRate:    "WholeSaleRate",
      WholeSaleRate: null,
    };
    const nextField = nextFieldMap[field];

    if (nextField) {
      focusCell(rowIdx, nextField);
    } else {
      // WholeSaleRate Enter → next row ProductCode
      const currentRows = rowsRef.current;
      if (rowIdx < currentRows.length - 1) {
        setSelIdx(rowIdx + 1);
        focusCell(rowIdx + 1, "ProductCode");
      } else {
        addRow();
      }
    }
  }, [focusCell, addRow, toast]);

  /* ──────────────────────────────────────────────────────────────────────────
     gridemptycheck  — mirrors jQuery methods.gridemptycheck()
  ────────────────────────────────────────────────────────────────────────── */
  const gridemptycheck = useCallback((data) => {
    // Remove trailing blank row if >1
    let cleaned = [...data];
    if (cleaned.length > 1 && !String(cleaned[cleaned.length - 1].ProductCode || "").trim()) {
      cleaned = cleaned.slice(0, -1);
    }
    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i].EditMode === 1 && !String(cleaned[i].ProductCode || "").trim()) {
        toast("❌ Enter All code in the Grid !!!", true);
        setSelIdx(i);
        focusCell(i, "ProductCode");
        return { ok: false, cleaned };
      }
    }
    return { ok: true, cleaned };
  }, [focusCell, toast]);

  const hasDuplicateCodes = (data) => {
    const codes = data.map((r) => (r.ProductCode || "").trim().toUpperCase()).filter(Boolean);
    return codes.length !== new Set(codes).size;
  };
  const hasDuplicateIds = (data) => {
    const ids = data.filter((r) => r.Id != null).map((r) => r.Id);
    return ids.length !== new Set(ids).size;
  };

  /* ──────────────────────────────────────────────────────────────────────────
     handleSave  — mirrors jQuery F1 handler exactly
     Headers: Comid, MirrorTable, IdComList
  ────────────────────────────────────────────────────────────────────────── */
  const handleSave = useCallback(async () => {
    if (submitting.current) return;

    const { Add: pageadd, Edit: pageedit } = perm;

    // jQuery: if (pageadd == 0 && pageedit == 0) → deny
    if (!pageadd && !pageedit) {
      toast("❌ Page Add & Update Permission Denied !!!", true);
      return;
    }

    const { ok, cleaned } = gridemptycheck(rowsRef.current);
    if (!ok) return;
    setRows(cleaned);

    let getdata = [];
    let flag    = 1;

    if (pageadd === 1 && pageedit === 1) {
      getdata = cleaned.filter((r) => r.EditMode === 1);
      if (!getdata.length) { toast("❌ No Data Modified, Cannot Update !!!", true); flag = 0; }
    } else if (pageadd === 1 && pageedit === 0) {
      getdata = cleaned.filter((r) => r.EditMode === 1 && r.Id == null);
      if (!getdata.length) {
        const any = cleaned.filter((r) => r.EditMode === 1);
        toast(any.length ? "❌ Page Edit Permission Denied !!!" : "❌ No Data Modified, Cannot Update !!!", true);
        flag = 0;
      }
    } else if (pageedit === 1 && pageadd === 0) {
      getdata = cleaned.filter((r) => r.EditMode === 1 && r.Id != null);
      if (!getdata.length) {
        const any = cleaned.filter((r) => r.EditMode === 1);
        toast(any.length ? "❌ Page Add Permission Denied !!!" : "❌ No Data Modified, Cannot Update !!!", true);
        flag = 0;
      }
    }

    if (flag === 0) { addRow(); return; }

    // jQuery: CheckDuplicate
    if (hasDuplicateCodes(cleaned)) { toast("❌ Duplicate Product Codes found !!!", true); return; }
    if (hasDuplicateIds(cleaned))   { toast("❌ Duplicate Product IDs found !!!", true);   return; }

    if (getdata.length === 0) { toast("❌ No Update Data !!!", true); return; }

    // jQuery: MsgBoxYesNo('Do you Want to Update RateChange Details?')
    if (!window.confirm("Do you Want to Update RateChange Details?")) {
      addRow();
      return;
    }

    submitting.current = true;
    setLoading(true);

    try {
      // Strip React-internal _uid; keep all other fields for backend
      const payload = getdata.map(({ _uid, ...rest }) => rest);

      console.group("[RateChange] UpdateRateChange");
      console.log("URL:", "/ItemMaster/UpdateRateChange");
      console.log("Headers:", { Comid: sess.Comid, MirrorTable: sess.MirrorTable, IdComList: sess.IdComList });
      console.log("Payload:", payload);
      console.groupEnd();

      const res = await api(
        "/ItemMaster/UpdateRateChange",
        payload,
        {
          Comid:       String(sess.Comid),
          MirrorTable: String(sess.MirrorTable),
          IdComList:   String(sess.IdComList),
        }
      );

      if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

      if (res.ok) {
        // jQuery: NotificationSuccess(data.message); methods.loadRateChangeDetails();
        toast("✅ " + (res.message || "Rate Change Updated Successfully."));
        // Reset grid — mirrors jQuery methods.loadRateChangeDetails() (clears and adds blank row)
        setRows([makeBlankRow()]);
        setSelIdx(0);
        setTimeout(() => focusCell(0, "ProductCode"), 80);
      } else {
        console.error("[RateChange] Save failed:", res);
        toast(`❌ ${res.message || "Update failed. See console for details."}`, true);
      }
    } catch (err) {
      console.error("[RateChange] Exception:", err);
      toast("❌ Technical Fault. Contact Software Vendor !!!", true);
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  }, [perm, sess, gridemptycheck, addRow, focusCell, toast]);

  /* ──────────────────────────────────────────────────────────────────────────
     Global keyboard handler — F1 / F2 / Del / Escape
     Mirrors jQuery $(document).on('keydown', ...)
  ────────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.keyCode === 112) { // F1 → Save
        e.preventDefault();
        handleSave();
      }
      if (e.keyCode === 113) { // F2 → New Row
        e.preventDefault();
        addRow();
      }
      if (e.keyCode === 46) { // Del — mirrors jQuery key === 46
        const tag = document.activeElement?.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
          deleteRow(selIdxRef.current);
        }
      }
      if (e.keyCode === 27) { // Escape → Confirm quit
        e.preventDefault();
        const str = "Do You Want To Quit Page?";
        if (window.confirm(str)) {
          window.location.href = "/Login/Home";
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave, addRow, deleteRow]);

  /* ─────────────────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────────────────── */
  if (permDenied) {
    return (
      <div className="mp-wrap" style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ margin: "auto", fontSize: 14, color: "#991b1b", background: "#fee2e2", padding: "12px 24px", borderRadius: 6 }}>
          {permDenied}
        </div>
      </div>
    );
  }

  return (
    <div className="mp-wrap">
      {/* ── Overlays ── */}
      {loading && <Loader />}
      {showPicker && (
        <ProductPickerModal
          onSelect={onPickerSelect}
          onClose={() => { setShowPicker(false); setPickerRow(null); }}
        />
      )}
      <Topbar />

      {/* ── Header ── */}
      {/* <div className="mp-hdr">
        <div className="mp-hdr-left">
          <div className="mp-icon">₹</div>
          <div>
            <div className="mp-title">Rate Change</div>
            <div className="mp-sub">Item Master · Price Update</div>
          </div>
        </div>
        <button className="mp-back" onClick={() => (window.location.href = "/Home")}>
          ← Back
        </button>
      </div> */}

      {/* ── Body ── */}
      <div className="mp-body" style={{ maxWidth: "100%" }}>

        {/* ── Toolbar ── */}
        <div className="mp-toolbar">
          <button
            className="mp-btn sv"
            disabled={loading || submitting.current}
            onClick={handleSave}
          >
            💾 F1 Save
          </button>
          <button className="mp-btn nw" onClick={addRow} disabled={loading}>
            ➕ F2 New Row
          </button>
          <button className="mp-btn dl" onClick={() => {
            if (window.confirm("Do You Want To Quit Page?")) {
              window.location.href = "/Login/Home";
            }
          }}>
            ✕ Esc Quit
          </button>

          <div className="mp-toolbar-title">Rate Change</div>
        </div>

        {/* ── Grid ── */}
        <div className="mp-grid-wrap" style={{ overflowX: "auto" }}>
          <table className="mp-tbl" style={{ minWidth: 1160, tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th style={{ width: 46 }}>#</th>
                <th style={{ width: 130 }}>Product Code</th>
                <th style={{ width: 200 }}>Description</th>
                <th style={{ width: 90,  textAlign: "right" }}>MRP (Old)</th>
                <th style={{ width: 90,  textAlign: "right" }}>MRP (New)</th>
                <th style={{ width: 105, textAlign: "right" }}>Old Pur.Rate</th>
                <th style={{ width: 105, textAlign: "right" }}>New Pur.Rate</th>
                <th style={{ width: 105, textAlign: "right" }}>Old Sale Rate</th>
                <th style={{ width: 105, textAlign: "right" }}>New Sale Rate</th>
                <th style={{ width: 105, textAlign: "right" }}>Old W.S Rate</th>
                <th style={{ width: 105, textAlign: "right" }}>New W.S Rate</th>
                <th style={{ width: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <GridRow
                  key={row._uid}
                  row={row}
                  idx={idx}
                  selected={selIdx === idx}
                  inputRefs={inputRefs}
                  onClick={() => { setSelIdx(idx); focusCell(idx, "ProductCode"); }}
                  onChange={updateCell}
                  onProductCodeEnter={onProductCodeEnter}
                  onOpenPicker={(i) => { setPickerRow(i); setShowPicker(true); }}
                  onRateKeyDown={onRateKeyDown}
                  onRateBlur={onRateBlur}
                  onDelete={deleteRow}
                />
              ))}
            </tbody>
          </table>
          {rows.length === 0 && !loading && (
            <div className="mp-empty" style={{ padding: 20, textAlign: "center", color: "#8b99b5" }}>
              No rows. Press ➕ to add.
            </div>
          )}
        </div>

        {/* ── Hint bar ── */}
        <div className="mp-hint">
          <kbd>F1</kbd> Save &nbsp;|&nbsp;
          <kbd>F2</kbd> New Row &nbsp;|&nbsp;
          <kbd>Esc</kbd> Quit &nbsp;|&nbsp;
          <kbd>Enter</kbd> Next field &nbsp;|&nbsp;
          <kbd>F9</kbd> / <kbd>Space</kbd> Browse Products
        </div>
      </div>

      {/* ── Toasts ── */}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.isErr ? " err" : ""}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}