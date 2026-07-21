// ─────────────────────────────────────────────────────────────────────────────
//  CustomerWiseSaleRate.jsx
//
//  VISUAL REDESIGN NOTE:
//  Only the presentational layer was changed to match the "bm-*" card design
//  system used in BrandMaster.jsx (blue #1a56db card border + gradient
//  header, rounded card, bm-btn pill buttons, bm-cell-input focus glow,
//  fixed-height scrollable grid, dark-navy table header, etc.). The bm-*
//  classes live in MasterPage.css (already imported below) — no local
//  <style> block needed here, same as BrandMaster.jsx.
//  The self-contained overlay modals (Loader, AlertModal, ConfirmModal,
//  ProductPickerModal, TripModal) and the searchable ComboBox keep their
//  own existing mp-* styling exactly as before — they are independent
//  overlays, not part of the bm-* card.
//  All state, effects, handlers, API calls, validation, endpoint URLs,
//  variable names and control flow (including the pre-existing duplicate
//  function declarations and the undefined `CSS` reference) are 100%
//  unchanged from the original Customerwisesalerate.jsx.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import Topbar from "../components/Topbar";
import * as CC from "../components/Common";
import { Save, Plus, Truck, RotateCcw, Trash2 } from "lucide-react";
import "./MasterPage.css"; 

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
function valNum(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function nullStr(v) { return v == null ? "" : String(v); }

function newBlankRow() {
  return {
    _uid: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    EditMode: 0,
    Id: null,
    ProductId: null,
    Code: "",
    Description: "",
    PaperRate: "",
    PlusRate: "",
    Wastage: "",
    FixedRate: "",
    Active: true,
  };
}  const InsertcustomerSaleRate ="/api/SupplierApp/InsertCustomerSaleRate"
   const ProductListUrl         = "/api/ItemMasterApp/GetProductListV7";
   const GetCustomerUrl         = "/api/SupplierApp/SelectSupplierAll";
      const DeleteCustomerSaleRate  = "/api/SupplierApp/DeleteCustomerSaleRate";
   const SelectCustomerSaleRateALL  = "/api/SupplierApp/SelectCustomerSaleRateALL";
function newBlankTripRow() {
  return {
    _uid: Math.random().toString(36).slice(2),
    Box: "",
    LW: "",
    EW: "",
    Id: null,
  };
}

// ─── COMBOBOX ─────────────────────────────────────────────────────────────────
function ComboBox({ options, value, onChange, onEnterKey, placeholder, style, inputRef: extRef, disabled }) {
  const [q, setQ]           = useState("");
  const [open, setOpen]     = useState(false);
  const [hilite, setHilite] = useState(0);
  const wrapRef = useRef(null);
  const inpRef  = useRef(null);
  const listRef = useRef(null);
  const ref = extRef || inpRef;

  const selectedLabel = options.find(o => String(o.value) === String(value))?.label || "";
  const filtered = options.filter(o =>
    o.label.toUpperCase().includes(q.toUpperCase())
  ).slice(0, 150);

  useEffect(() => { setHilite(0); }, [q]);
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${hilite}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [hilite]);
  useEffect(() => {
    const handler = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false); setQ(selectedLabel);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selectedLabel]);

  const selectOption = opt => {
    onChange(String(opt.value));
    setQ(opt.label.toUpperCase());
    setOpen(false);
  };

  const handleKeyDown = e => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHilite(h => Math.min(h + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setHilite(h => Math.max(h - 1, 0)); }
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && filtered[hilite]) selectOption(filtered[hilite]);
      onEnterKey?.();
    }
    if (e.key === "Escape") { setOpen(false); setQ(selectedLabel); }
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", flex: 1, minWidth: 0, ...style }}>
      <input
        ref={ref}
        className="mp-combo"
        value={open ? q : selectedLabel.toUpperCase()}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        onFocus={() => { setQ(selectedLabel); setOpen(true); setHilite(0); }}
        onChange={e => { setQ(e.target.value.toUpperCase()); setOpen(true); }}
        onKeyDown={handleKeyDown}
        style={{ width: "100%", cursor: disabled ? "not-allowed" : "text" }}
      />
      {open && !disabled && filtered.length > 0 && (
        <div ref={listRef} style={{
          position: "absolute", top: "100%", left: 0, right: 0,
          background: "#fff", border: "1px solid #c5d8f8",
          borderRadius: 4, zIndex: 9999,
          maxHeight: 220, overflowY: "auto",
          boxShadow: "0 8px 24px rgba(31,101,222,.15)",
        }}>
          {filtered.map((opt, idx) => (
            <div key={opt.value} data-idx={idx}
              onMouseDown={() => selectOption(opt)}
              onMouseEnter={() => setHilite(idx)}
              style={{
                padding: "5px 10px", fontSize: 12, cursor: "pointer",
                background: idx === hilite ? "#deeafb" : idx % 2 === 0 ? "#fff" : "#fafbff",
                borderLeft: idx === hilite ? "3px solid #1f65de" : "3px solid transparent",
                color: "#1a2e4a", fontWeight: idx === hilite ? 600 : 400,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}
            >{opt.label}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Shared Modal Components
───────────────────────────────────────────── */
function Loader({ msg = "Loading…" }) {
  return (
    <div className="mp-loader-ov">
      <div className="mp-ldr-box">
        <div className="mp-spin" />
        <div className="mp-ldr-msg">{msg}</div>
      </div>
    </div>
  );
}

function AlertModal({ msg, onClose }) {
  return (
    <div className="mp-modal-ov">
      <div className="mp-modal">
        <h3>Notice</h3>
        <p>{msg}</p>
        <div className="mp-modal-btns">
          <button className="mp-modal-btn yes" onClick={onClose} autoFocus>OK</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ msg, onYes, onNo }) {
  return (
    <div className="mp-modal-ov">
      <div className="mp-modal">
        <h3>Confirm</h3>
        <p>{msg}</p>
        <div className="mp-modal-btns">
          <button className="mp-modal-btn no" onClick={onNo}>No</button>
          <button className="mp-modal-btn yes" onClick={onYes} autoFocus>Yes</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Product Picker Modal
───────────────────────────────────────────── */
function ProductPickerModal({ products, onSelect, onClose }) {
  const [search, setSearch] = useState("");
  const [selIdx, setSelIdx] = useState(0);
  const searchRef = useRef(null);

  useEffect(() => { setTimeout(() => searchRef.current?.focus(), 80); }, []);

  const filtered = search.trim()
    ? products.filter(
        (p) =>
          nullStr(p.ProductName).toLowerCase().includes(search.toLowerCase()) ||
          nullStr(p.Productcode).toLowerCase().includes(search.toLowerCase())
      )
    : products;

  function handleKeyDown(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && filtered[selIdx]) onSelect(filtered[selIdx]);
    if (e.key === "Escape") onClose();
  }

  return (
    <div className="mp-picker-ov" onKeyDown={handleKeyDown}>
        <div
    className="mp-picker"
    style={{
      width: 400,
      minWidth: 400,
      maxWidth: "90vw",
      boxSizing: "border-box",
    }}
  >
        <header>
          <h3>Select Product</h3>
          <button className="mp-picker-close" onClick={onClose}>✕</button>
        </header>
        <div className="mp-picker-search">
          <input
            ref={searchRef}
            placeholder="Search by name or code…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelIdx(0); }}
          />
        </div>
        <div className="mp-picker-list">
          <table className="mp-picker-tbl">
            <thead>
              <tr>
                <th style={{ width: 50 }}>Code</th>
                <th>Name</th>
                <th style={{ width: 50 }}>Sale Rate</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr
                  key={p.Id || i}
                  className={i === selIdx ? "psel" : ""}
                  onClick={() => onSelect(p)}
                  onMouseEnter={() => setSelIdx(i)}
                >
                  <td>{p.Prod_Code}</td>
                  <td>{p.PName}</td>
                  <td style={{ textAlign: "right" }}>{valNum(p.SaleRate).toFixed(2)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={3} style={{ textAlign: "center", color: "#aaa", padding: 16 }}>No results</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Trip Window Modal
───────────────────────────────────────────── */
function TripModal({ onClose }) {
  const [tripRows, setTripRows] = useState([newBlankTripRow()]);
  const [selRow, setSelRow] = useState(0);
  const [mWeight, setMWeight] = useState("");
  const [mCount, setMCount] = useState("");
  const mWeightRef = useRef(null);
  const mCountRef = useRef(null);
  const firstCellRef = useRef(null);

  useEffect(() => { setTimeout(() => firstCellRef.current?.focus(), 100); }, []);

  function updateTripCell(idx, field, val) {
    setTripRows((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  }

  function handleTripKeyDown(e, idx, field) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const row = tripRows[idx];

    if (field === "Box") {
      if (!row.Box) { mWeightRef.current?.focus(); return; }
      updateTripCell(idx, "Box", valNum(row.Box).toFixed(2));
      // move to LW same row
      document.getElementById(`trip-lw-${idx}`)?.focus();
    } else if (field === "LW") {
      updateTripCell(idx, "LW", valNum(row.LW).toFixed(2));
      document.getElementById(`trip-ew-${idx}`)?.focus();
    } else if (field === "EW") {
      updateTripCell(idx, "EW", valNum(row.EW).toFixed(2));
      if (idx === tripRows.length - 1) {
        // add new row
        const next = [...tripRows, newBlankTripRow()];
        setTripRows(next);
        setSelRow(next.length - 1);
        setTimeout(() => document.getElementById(`trip-box-${next.length - 1}`)?.focus(), 40);
      } else {
        document.getElementById(`trip-box-${tripRows.length - 1}`)?.focus();
      }
    }
  }

  function deleteTripRow(idx) {
    setTripRows((prev) => prev.length === 1 ? [newBlankTripRow()] : prev.filter((_, i) => i !== idx));
  }

  return (
    <div className="mp-trip-ov">
      <div className="mp-trip">
        <header>
          <h3>Trip Details</h3>
          <button className="mp-picker-close" onClick={onClose}>✕</button>
        </header>
        <div className="mp-trip-body">
          {/* MWeight / MCount inputs */}
          <div className="mp-trip-inputs">
            <div className="mp-trip-input-wrap">
              <span className="mp-trip-input-label">M.Weight</span>
              <input
                ref={mWeightRef}
                className="mp-trip-input"
                value={mWeight}
                onChange={(e) => setMWeight(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") mCountRef.current?.focus(); }}
              />
            </div>
            <div className="mp-trip-input-wrap">
              <span className="mp-trip-input-label">M.Count</span>
              <input
                ref={mCountRef}
                className="mp-trip-input"
                value={mCount}
                onChange={(e) => setMCount(e.target.value)}
              />
            </div>
          </div>

          {/* Trip grid */}
          <div className="mp-trip-grid-wrap">
            <table className="mp-trip-tbl">
              <thead>
                <tr>
                  <th style={{ width: 42 }}>#</th>
                  <th>Box</th>
                  <th>LW</th>
                  <th>EW</th>
                  <th style={{ width: 38 }}></th>
                </tr>
              </thead>
              <tbody>
                {tripRows.map((row, idx) => (
                  <tr
                    key={row._uid}
                    className={selRow === idx ? "sel" : ""}
                    onClick={() => setSelRow(idx)}
                  >
                    <td className="sno">{idx + 1}</td>
                    <td>
                      <input
                        id={`trip-box-${idx}`}
                        ref={idx === 0 ? firstCellRef : null}
                        className="mp-cell-input"
                        value={row.Box}
                        onChange={(e) => updateTripCell(idx, "Box", e.target.value)}
                        onKeyDown={(e) => handleTripKeyDown(e, idx, "Box")}
                        onFocus={() => setSelRow(idx)}
                      />
                    </td>
                    <td>
                      <input
                        id={`trip-lw-${idx}`}
                        className="mp-cell-input"
                        value={row.LW}
                        onChange={(e) => updateTripCell(idx, "LW", e.target.value)}
                        onKeyDown={(e) => handleTripKeyDown(e, idx, "LW")}
                        onFocus={() => setSelRow(idx)}
                      />
                    </td>
                    <td>
                      <input
                        id={`trip-ew-${idx}`}
                        className="mp-cell-input"
                        value={row.EW}
                        onChange={(e) => updateTripCell(idx, "EW", e.target.value)}
                        onKeyDown={(e) => handleTripKeyDown(e, idx, "EW")}
                        onFocus={() => setSelRow(idx)}
                      />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button className="mp-del-btn" onClick={() => deleteTripRow(idx)}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="mp-btn cl" onClick={onClose}>Close (Esc)</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Sale Rate Row
   NOTE: only className/style values were touched below (mp-cell-input →
   bm-cell-input, right-align via inline style instead of the "r" modifier
   class, and the delete glyph became a Trash2 icon inside bm-icon-btn).
   Every prop, handler and piece of logic is identical to the original —
   including the fact that no `id` attributes are set on these inputs
   (pre-existing in the original file; the `document.getElementById(
   'plus-rate-...')` / `'code-...'` calls elsewhere therefore never match
   anything, exactly as before).
───────────────────────────────────────────── */
function SaleRateRow({ row, idx, selected, products, onChange, onDelete, onOpenPicker, onCodeEnter, onPaperRateEnter, onPlusRateEnter, onFocus }) {
  return (
    <tr
      className={[selected ? "sel" : "", row.EditMode ? "mod" : ""].filter(Boolean).join(" ")}
      onClick={onFocus}
    >
      <td className="sno">{idx + 1}</td>

      {/* Code — click or Enter opens product picker */}
      <td>
        <input
          className="bm-cell-input"
          value={row.Code}
          onChange={(e) => onChange("Code", e.target.value)}
          onFocus={onFocus}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); onCodeEnter(); }
          }}
          placeholder="Code / Enter"
        />
      </td>

      {/* Description — read-only, filled from product picker */}
      <td>
        <input
          className="bm-cell-input"
          value={row.Description}
          readOnly
          tabIndex={-1}
        />
      </td>

      {/* Normal Rate (PaperRate) */}
      <td>
        <input
          className="bm-cell-input"
          value={row.PaperRate}
          onChange={(e) => onChange("PaperRate", e.target.value)}
          onFocus={onFocus}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); onPaperRateEnter(); }
          }}
          onBlur={() => onChange("PaperRate", valNum(row.PaperRate).toFixed(2))}
          style={{ textAlign: "right" }}
        />
      </td>

      {/* Sale Rate (PlusRate) */}
      <td>
        <input
          className="bm-cell-input"
          value={row.PlusRate}
          onChange={(e) => onChange("PlusRate", e.target.value)}
          onFocus={onFocus}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); onPlusRateEnter(); }
          }}
          onBlur={() => onChange("PlusRate", valNum(row.PlusRate).toFixed(2))}
          style={{ textAlign: "right" }}
        />
      </td>

      {/* Delete */}
      <td style={{ textAlign: "center" }}>
        <button
          className="bm-icon-btn del"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete row"
        >
          <Trash2 size={15} />
        </button>
      </td>
    </tr>
  );
}

/* ─────────────────────────────────────────────
   Main Component
───────────────────────────────────────────── */
export default function CustomerWiseSaleRate() {
  /* ── session ── */
  const Comid = useRef(localStorage.getItem("Comid") || "0");

  /* ── customers combo ── */
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("0");
  const [customerSearch, setCustomerSearch] = useState("");
  const comboRef = useRef(null);

  /* ── products (for picker) ── */
  const [products, setProducts] = useState([]);

  /* ── main grid rows ── */
  const [rows, setRows] = useState([newBlankRow()]);
  const [selectedRow, setSelectedRow] = useState(0);

  /* ── UI state ── */
  const [loading, setLoading] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState("");
  const [toastErr, setToastErr] = useState("");

  /* ── modals ── */
  const [showPicker, setShowPicker] = useState(false);
  const [pickerRowIdx, setPickerRowIdx] = useState(null);
  const [showTrip, setShowTrip] = useState(false);

  /* ── submission lock ── */
  const submitting = useRef(false);

  /* ── inject CSS ── */
  useEffect(() => {
    if (!document.getElementById("__csr_style")) {
      const s = document.createElement("style");
      s.id = "__csr_style";
      s.textContent = CSS;
      document.head.appendChild(s);
    }
  }, []);

  /* ── init ── */
  useEffect(() => {
    loadCustomerCombo();
    loadProducts();
    setTimeout(() => comboRef.current?.focus(), 100);
  }, []);

  /* ── global keyboard ── */
  useEffect(() => {
    function onKeyDown(e) {
      if (e.keyCode === 112) { e.preventDefault(); handleSave(); }         // F1
      if (e.keyCode === 113) { e.preventDefault(); setShowTrip(true); }    // F2
      if (e.keyCode === 121) { e.preventDefault(); handleClear(); }        // F10
      if (e.keyCode === 27)  {                                              // Esc
        e.preventDefault();
        if (showTrip) { setShowTrip(false); return; }
        if (showPicker) { setShowPicker(false); return; }
        showConfirm("Do You Want To Quit Page?", () => { window.location.href = "/Home"; });
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  /* ─── helpers ─── */
  function msgBox(msg) { setAlertMsg(msg); }
  function showConfirm(msg, onYes, onNo) { setConfirm({ msg, onYes, onNo: onNo || (() => {}) }); }
  function showToast(msg, err = false) {
    if (err) { setToastErr(msg); setTimeout(() => setToastErr(""), 3500); }
    else { setToast(msg); setTimeout(() => setToast(""), 3500); }
  }

  /* ─── load customer combo ─── */
async function loadCustomerCombo() {
  console.log("loadCustomerCombo started");
  try {
    const res = await CC.api(
      GetCustomerUrl,
      null,
      {},
      {
        Comid: Comid.current,
        AccountType: "CUSTOMER",
      }
    );

    

    const customerList = res?.data || res?.Data1 || [];

 

    setCustomers(customerList);

    console.log("After setCustomers");
  } catch (err) {
    console.log("CATCH BLOCK HIT");
    console.error(err);
  }
}

  /* ─── load products ─── */
  async function loadProducts() {
    try {
     const ProductListUrl = "/api/ItemMasterApp/GetProductListV7";
    setLoading(true); 
    const res = await CC.api(ProductListUrl, null, {}, { Comid:Comid.current });
    setLoading(false);
   
    const arr = Array.isArray(res.data) ? res.data : Array.isArray(res.Data1) ? res.Data1 : [];
    setProducts(arr);
    } catch {}
  }

  /* ─── load customer sale rates on customer select ─── */
  async function loadCustomerRates(custId) {
   if (!custId || custId === "0") return;
  setLoading(true);
  try {
    const res = await CC.api(
      SelectCustomerSaleRateALL,
      null,
      {},
      { Comid: Comid.current, Id: custId }
    );
    const raw = res?.data || res?.Data1 || [];
      if (raw.length) {
        const normalised = raw.map((obj) => ({
          ...obj,
          _uid: Math.random().toString(36).slice(2),
          EditMode: 0,
          PlusRate: parseFloat(obj.PlusRate || 0).toFixed(2),
          Wastage: parseFloat(obj.Wastage || 0).toFixed(3),
          FixedRate: parseFloat(obj.FixedRate || 0).toFixed(2),
          PaperRate: parseFloat(obj.PaperRate || 0).toFixed(2),
        }));
        setRows([...normalised, newBlankRow()]);
        setSelectedRow(normalised.length);
      } else {
        setRows([newBlankRow()]);
        setSelectedRow(0);
      }
    } catch { msgBox("Technical Fault. Contact Software Vendor !!!"); }
    finally { setLoading(false); }
  }

  /* ─── combo change ─── */
  function handleCustomerChange(val) {
    setCustomerId(val);
    if (val && val !== "0" && val !== "") loadCustomerRates(val);
  }

  function handleComboKeyDown() {
    if (customerId && customerId !== "0" && customerId !== "") loadCustomerRates(customerId);
  }

  /* ─── row operations ─── */
  function updateCell(idx, field, value) {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value, EditMode: 1 } : r));
  }

  function addNewRow() {
    setRows((prev) => {
      const trimmed = prev.filter((r, i) => i < prev.length - 1 || r.Code !== "");
      const next = [...trimmed, newBlankRow()];
      setSelectedRow(next.length - 1);
      return next;
    });
  }

  /* ─── product picker select ─── */
  function onProductSelect(product) {


  const idx = pickerRowIdx;
  setShowPicker(false);
  setRows((prev) =>
    prev.map((r, i) =>
      i === idx
        ? {
            ...r,
            EditMode: 1,
            Code: product.Prod_Code,
            Description: product.PName,
            ProductId: product.Id,
          }
        : r
    )
  );
    setSelectedRow(idx);
    // focus PlusRate cell after short delay
    setTimeout(() => {
      document.getElementById(`plus-rate-${idx}`)?.focus();
    }, 60);
  }

  /* ─── Enter key navigation in main grid ─── */
  function onCodeEnter(idx) {
    setPickerRowIdx(idx);
    setShowPicker(true);
  }

  function onPaperRateEnter(idx) {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, PaperRate: valNum(r.PaperRate).toFixed(2) } : r));
    setTimeout(() => document.getElementById(`plus-rate-${idx}`)?.focus(), 30);
  }

  function onPlusRateEnter(idx) {
    setRows((prev) => {
      const next = prev.map((r, i) => i === idx ? { ...r, PlusRate: valNum(r.PlusRate).toFixed(2) } : r);
      // if last row → add new row; else jump to last row Code
      if (idx === prev.length - 1) {
        const withNew = [...next, newBlankRow()];
        setSelectedRow(withNew.length - 1);
        setTimeout(() => document.getElementById(`code-${withNew.length - 1}`)?.focus(), 40);
        return withNew;
      } else {
        setSelectedRow(prev.length - 1);
        setTimeout(() => document.getElementById(`code-${prev.length - 1}`)?.focus(), 30);
        return next;
      }
    });
  }

  /* ─── delete row ─── */
  async function deleteRow(idx) {
    const row = rows[idx];
    if (row.Id) {
      showConfirm(`Wish to Delete the Record "${row.Code}"?`, async () => {
        setConfirm(null);
        setLoading(true);
        try {
         const res = await CC.api(
  DeleteCustomerSaleRate,
  {},
  {},
   { Comid:Comid.current,Id: row.Id,}
);
if (res.ok ?? res.IsSuccess) {
  showToast(res.message || "Deleted.");
  setRows((prev) => prev.filter((_, i) => i !== idx));
} else msgBox(res.message);
        } catch { msgBox("Technical Fault !!!"); }
        finally { setLoading(false); }
      });
    } else {
      setRows((prev) => prev.length === 1 ? [newBlankRow()] : prev.filter((_, i) => i !== idx));
    }
  }

  /* ─── gridemptycheck ─── */
// AFTER
function gridEmptyCheck() {
  const filtered = rows.filter(r => r.Code !== "" && r.Code != null);
  
  if (filtered.length === 0) {
    setRows([newBlankRow()]);
    return false; // nothing to save
  }
  setRows(filtered);
  return true;
}

  /* ─── save (F1) ─── */

function gridEmptyCheck() {
  const filtered = rows.filter(r => r.Code !== "" && r.Code != null);
  if (filtered.length === 0) {
    setRows([newBlankRow()]);
    return null; // null = nothing to save
  }
  setRows(filtered);
  return filtered; // return the clean array directly
}

// and in handleSave — use the returned filtered array, not rows:
function handleSave() {
  if (submitting.current) return;

  if (!customerId || customerId === "0" || customerId === "") {
    msgBox("Please Select a Customer Before Saving !!!");
    comboRef.current?.focus();
    return;
  }

  const cleanRows = gridEmptyCheck(); // ← get filtered rows synchronously
  if (!cleanRows) {
    msgBox("No data to save.");
    return;
  }

  showConfirm("Do you Want to Save the Customer SaleRate Details?", async () => {
    setConfirm(null);
    submitting.current = true;
    setLoading(true);
    try {
      const res = await CC.insertapi(InsertcustomerSaleRate, cleanRows, { // ← cleanRows here
        "Content-Type": "application/json",
        Comid: Comid.current,
        Cusid: customerId,
      });
      if (res.ok ?? res.IsSuccess) {
        showToast(res.message || "Saved successfully.");
        handleClear();
        setTimeout(() => comboRef.current?.focus(), 60);
      } else {
        msgBox(res.message);
        addNewRow();
      }
    } catch { msgBox("Technical Fault. Contact Software Vendor !!!"); }
    finally { setLoading(false); submitting.current = false; }
  }, () => { setConfirm(null); addNewRow(); });
}

// and in handleSave — use the returned filtered array, not rows:
function handleSave() {
  if (submitting.current) return;

  if (!customerId || customerId === "0" || customerId === "") {
    msgBox("Please Select a Customer Before Saving !!!");
    comboRef.current?.focus();
    return;
  }

  const cleanRows = gridEmptyCheck(); // ← get filtered rows synchronously
  if (!cleanRows) {
    msgBox("No data to save.");
    return;
  }

  showConfirm("Do you Want to Save the Customer SaleRate Details?", async () => {
    setConfirm(null);
    submitting.current = true;
    setLoading(true);
    try {
      const res = await CC.insertapi(InsertcustomerSaleRate, cleanRows, { // ← cleanRows here
        "Content-Type": "application/json",
        Comid: Comid.current,
        Cusid: customerId,
      });
      if (res.ok ?? res.IsSuccess) {
        showToast(res.message || "Saved successfully.");
        handleClear();
        setTimeout(() => comboRef.current?.focus(), 60);
      } else {
        msgBox(res.message);
        addNewRow();
      }
    } catch { msgBox("Technical Fault. Contact Software Vendor !!!"); }
    finally { setLoading(false); submitting.current = false; }
  }, () => { setConfirm(null); addNewRow(); });
}

  /* ─── clear ─── */
  function handleClear() {
    setRows([newBlankRow()]);
    setSelectedRow(0);
    setCustomerId("0");
    setTimeout(() => comboRef.current?.focus(), 60);
  }

  /* ── filtered customers for combo ── */
  const filteredCustomers = customerSearch
    ? customers.filter((c) => nullStr(c.AccountName).toLowerCase().includes(customerSearch.toLowerCase()))
    : customers;

  /* ─── render ─── */
  return (
    <div className="bm-shell">
      
      {loading && <Loader msg="Please wait…" />}
      {alertMsg && <AlertModal msg={alertMsg} onClose={() => setAlertMsg("")} />}
      {confirm && (
        <ConfirmModal
          msg={confirm.msg}
          onYes={confirm.onYes}
          onNo={() => { confirm.onNo(); setConfirm(null); }}
        />

        
      )}
      {showPicker && (
        <ProductPickerModal
          products={products}
          onSelect={onProductSelect}
          onClose={() => setShowPicker(false)}
        />
      )}
      
      {showTrip && <TripModal onClose={() => setShowTrip(false)} />}
      <Topbar />

      <div className="bm-layout">
        <div className="bm-card">
          <div className="bm-card-header">
            <div className="bm-card-header-title">Customer Wise Sale Rate</div>
            <button
              type="button"
              className="bm-close-x"
              aria-label="Close"
              onClick={() => showConfirm("Do You Want To Quit Page?", () => { window.location.href = "/Home"; })}
            >
              ✕
            </button>
          </div>

          <div className="bm-card-body">
            <div className="bm-report-title">Customer Wise Sale Rate</div>

            {/* CUSTOMER FILTER BAR */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              paddingBottom: 14, borderBottom: "1px solid #e8ecf0",
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1a3fd6", whiteSpace: "nowrap" }}>
                Customer :
              </span>
              <ComboBox
                inputRef={comboRef}
                options={[{ value: "0", label: "" }, ...customers.map(c => ({ value: String(c.Id), label: c.AccountName }))]}
                value={customerId}
                onChange={handleCustomerChange}
                onEnterKey={handleComboKeyDown}
                placeholder="— Select Customer —"
                style={{ minWidth: 280, maxWidth: 420 }}
              />
              {toast && <span className="mp-msg ok">{toast}</span>}
              {toastErr && <span className="mp-msg err">{toastErr}</span>}
            </div>

            {/* MAIN GRID */}
            <div className="bm-grid-wrap">
              <table className="bm-tbl">
                <thead>
                  <tr>
                    <th style={{ width: 46 }}>#</th>
                    <th style={{ width: 130 }}>Code</th>
                    <th style={{ width: 100 }}>Description</th>
                    <th style={{ width: 100, textAlign: "right" }}>Normal Rate</th>
                    <th style={{ width: 100, textAlign: "right" }}>Sale Rate</th>
                    <th style={{ width: 50 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <SaleRateRow
                      key={row._uid}
                      row={row}
                      idx={idx}
                      selected={selectedRow === idx}
                      products={products}
                      onChange={(field, val) => updateCell(idx, field, val)}
                      onDelete={() => deleteRow(idx)}
                      onOpenPicker={() => { setPickerRowIdx(idx); setShowPicker(true); }}
                      onCodeEnter={() => onCodeEnter(idx)}
                      onPaperRateEnter={() => onPaperRateEnter(idx)}
                      onPlusRateEnter={() => onPlusRateEnter(idx)}
                      onFocus={() => setSelectedRow(idx)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Toolbar ── */}
            <div className="bm-actions">
              <button className="bm-btn bm-btn-primary" disabled={loading || submitting.current} onClick={handleSave}>
                <Save size={16} />
                Save (F1)
              </button>
              <button className="bm-btn" onClick={() => setShowTrip(true)}>
                <Truck size={16} />
                Trip (F2)
              </button>
              <button
                className="bm-btn bm-btn-secondary"
                onClick={() => showConfirm("Do You Want To Clear?", () => { setConfirm(null); handleClear(); })}
              >
                <RotateCcw size={16} />
                Clear (F10)
              </button>
              <button className="bm-btn" onClick={addNewRow}>
                <Plus size={16} />
                New Row
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}