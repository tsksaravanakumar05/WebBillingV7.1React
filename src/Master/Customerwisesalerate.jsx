import { useState, useEffect, useRef, useCallback } from "react";

/* ─────────────────────────────────────────────
   Injected CSS
───────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;font-family:'Inter',sans-serif;}
html,body,#root{height:100%;margin:0;padding:0;}
.mp-wrap{min-height:100vh;display:flex;flex-direction:column;background:#eef1f7;font-size:12.5px;}
.mp-hdr{background:#1a2e4a;display:flex;align-items:center;justify-content:space-between;padding:0 18px;height:50px;flex-shrink:0;box-shadow:0 3px 10px rgba(0,0,0,.28);}
.mp-hdr-left{display:flex;align-items:center;gap:10px;}
.mp-icon{width:32px;height:32px;border-radius:6px;background:#e8a020;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:#fff;flex-shrink:0;}
.mp-title{font-size:14px;font-weight:700;color:#fff;}
.mp-sub{font-size:10px;color:rgba(255,255,255,.5);letter-spacing:1px;text-transform:uppercase;margin-top:1px;}
.mp-back{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#fff;padding:5px 14px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600;transition:all .15s;}
.mp-back:hover{background:#e8a020;border-color:#e8a020;}
.mp-body{flex:1;padding:16px 20px;display:flex;flex-direction:column;gap:10px;width:100%;margin:0 auto;}
.mp-toolbar{background:#fff;border:1px solid #d4dbe8;border-left:4px solid #e8a020;border-radius:6px;padding:8px 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.mp-btn{display:flex;align-items:center;gap:4px;border:1px solid transparent;border-radius:4px;padding:5px 12px;font-size:11.5px;font-weight:600;cursor:pointer;transition:all .12s;height:30px;}
.mp-btn.sv{background:#1a2e4a;color:#fff;border-color:#1a2e4a;}
.mp-btn.sv:hover{background:#e8a020;border-color:#e8a020;}
.mp-btn.sv:disabled{opacity:.45;cursor:not-allowed;}
.mp-btn.nw{background:#fff;color:#6f42c1;border-color:#6f42c1;}
.mp-btn.nw:hover{background:#6f42c1;color:#fff;}
.mp-btn.dl{background:#fff;color:#dc3545;border-color:#dc3545;}
.mp-btn.dl:hover{background:#dc3545;color:#fff;}
.mp-btn.cl{background:#fff;color:#6c757d;border-color:#6c757d;}
.mp-btn.cl:hover{background:#6c757d;color:#fff;}
.mp-btn.tr{background:#fff;color:#0d6efd;border-color:#0d6efd;}
.mp-btn.tr:hover{background:#0d6efd;color:#fff;}
.mp-msg{font-size:11px;font-weight:600;padding:4px 10px;border-radius:4px;margin-left:6px;}
.mp-msg.ok{background:#d1fae5;color:#065f46;border:1px solid #a7f3d0;}
.mp-msg.err{background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;}
.mp-filter-bar{background:#fff;border:1px solid #d4dbe8;border-radius:6px;padding:10px 14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.mp-filter-label{font-size:11.5px;font-weight:600;color:#1a2e4a;white-space:nowrap;}
.mp-combo{height:32px;border:1px solid #d4dbe8;border-radius:4px;padding:0 10px;font-size:12px;color:#1a2e4a;outline:none;background:#fff;min-width:280px;cursor:pointer;}
.mp-combo:focus{border-color:#e8a020;box-shadow:0 0 0 2px rgba(232,160,32,.15);}
.mp-grid-wrap{background:#fff;border:1px solid #d4dbe8;border-radius:6px;overflow:auto;flex:1;min-height:320px;}
.mp-tbl{border-collapse:collapse;width:100%;table-layout:fixed;}
.mp-tbl thead tr{position:sticky;top:0;z-index:2;}
.mp-tbl th{background:#1a2e4a;color:#fff;border:1px solid #253d5e;padding:7px 8px;font-size:11px;font-weight:600;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.mp-tbl th.r{text-align:right;}
.mp-tbl td{border:1px solid #eaecf4;padding:2px 4px;font-size:12px;color:#1a2e4a;}
.mp-tbl tbody tr{cursor:pointer;transition:background .07s;}
.mp-tbl tbody tr:nth-child(even){background:#f5f7fc;}
.mp-tbl tbody tr:hover{background:#fef3e0;}
.mp-tbl tbody tr.sel{background:#fddfa0 !important;}
.mp-tbl tbody tr.mod td:first-child{border-left:3px solid #e8a020;}
.mp-tbl td.sno{text-align:center;color:#8b99b5;font-size:11px;}
.mp-cell-input{border:1px solid #d4dbe8;border-radius:3px;padding:2px 6px;font-size:12px;width:100%;height:25px;outline:none;background:#fff;color:#1a2e4a;transition:border-color .12s;}
.mp-cell-input:focus{border-color:#e8a020;box-shadow:0 0 0 2px rgba(232,160,32,.15);}
.mp-cell-input.ro{background:#f5f7fc;color:#8b99b5;cursor:default;}
.mp-cell-input.r{text-align:right;}
.mp-del-btn{background:none;border:none;cursor:pointer;font-size:13px;padding:2px 5px;border-radius:3px;transition:background .1s;line-height:1;}
.mp-del-btn:hover{background:#fee2e2;}
.mp-hint{background:#f5f7fc;border:1px solid #e0e5f0;border-radius:4px;padding:6px 12px;font-size:10.5px;color:#8b99b5;flex-shrink:0;}
.mp-hint kbd{background:#1a2e4a;color:#fff;font-size:9.5px;font-weight:700;padding:1px 5px;border-radius:3px;font-family:'Inter',monospace;}
.mp-loader-ov{position:fixed;inset:0;background:rgba(10,20,40,.48);display:flex;align-items:center;justify-content:center;z-index:9000;}
.mp-ldr-box{background:#fff;border-radius:8px;padding:22px 32px;display:flex;flex-direction:column;align-items:center;gap:10px;box-shadow:0 16px 48px rgba(0,0,0,.25);min-width:150px;}
.mp-spin{width:32px;height:32px;border:4px solid #eee;border-top-color:#e8a020;border-radius:50%;animation:mp-spin .55s linear infinite;}
@keyframes mp-spin{to{transform:rotate(360deg);}}
.mp-ldr-msg{font-size:12px;color:#4a5568;font-weight:600;}
.mp-modal-ov{position:fixed;inset:0;background:rgba(10,20,40,.45);display:flex;align-items:center;justify-content:center;z-index:8000;}
.mp-modal{background:#fff;border-radius:8px;padding:22px 26px;min-width:300px;max-width:440px;box-shadow:0 16px 48px rgba(0,0,0,.22);}
.mp-modal h3{font-size:13px;font-weight:700;color:#1a2e4a;margin-bottom:10px;}
.mp-modal p{font-size:12px;color:#374151;margin-bottom:16px;line-height:1.55;}
.mp-modal-btns{display:flex;gap:8px;justify-content:flex-end;}
.mp-modal-btn{padding:5px 16px;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid transparent;transition:all .12s;}
.mp-modal-btn.yes{background:#1a2e4a;color:#fff;border-color:#1a2e4a;}
.mp-modal-btn.yes:hover{background:#e8a020;border-color:#e8a020;}
.mp-modal-btn.no{background:#fff;color:#374151;border-color:#d4dbe8;}
.mp-modal-btn.no:hover{background:#f3f4f6;}
/* Product picker */
.mp-picker-ov{position:fixed;inset:0;background:rgba(10,20,40,.42);display:flex;align-items:center;justify-content:center;z-index:8500;}
.mp-picker{background:#fff;border-radius:8px;box-shadow:0 16px 48px rgba(0,0,0,.24);display:flex;flex-direction:column;width:540px;max-height:460px;}
.mp-picker header{padding:10px 16px;background:#1a2e4a;color:#fff;border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:space-between;}
.mp-picker header h3{font-size:12px;font-weight:700;}
.mp-picker-close{background:none;border:none;color:#fff;cursor:pointer;font-size:17px;line-height:1;}
.mp-picker-search{padding:8px 12px;border-bottom:1px solid #e0e5f0;}
.mp-picker-search input{width:100%;height:30px;border:1px solid #d4dbe8;border-radius:4px;padding:0 10px;font-size:12px;outline:none;}
.mp-picker-search input:focus{border-color:#e8a020;}
.mp-picker-list{overflow-y:auto;flex:1;}
.mp-picker-tbl{border-collapse:collapse;width:100%;}
.mp-picker-tbl th{background:#253d5e;color:#fff;padding:5px 8px;font-size:11px;text-align:left;position:sticky;top:0;}
.mp-picker-tbl td{border-bottom:1px solid #f0f2f7;padding:5px 8px;font-size:12px;color:#1a2e4a;}
.mp-picker-tbl tbody tr:hover{background:#fef3e0;cursor:pointer;}
.mp-picker-tbl tbody tr.psel{background:#fddfa0;}
/* Trip window */
.mp-trip-ov{position:fixed;inset:0;background:rgba(10,20,40,.42);display:flex;align-items:center;justify-content:center;z-index:8200;}
.mp-trip{background:#fff;border-radius:8px;box-shadow:0 16px 48px rgba(0,0,0,.24);width:640px;display:flex;flex-direction:column;}
.mp-trip header{padding:10px 16px;background:#1a2e4a;color:#fff;border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:space-between;}
.mp-trip header h3{font-size:12px;font-weight:700;}
.mp-trip-body{padding:14px 16px;display:flex;flex-direction:column;gap:10px;}
.mp-trip-inputs{display:flex;gap:12px;align-items:center;}
.mp-trip-input-wrap{display:flex;flex-direction:column;gap:3px;}
.mp-trip-input-label{font-size:10.5px;color:#8b99b5;font-weight:600;}
.mp-trip-input{height:28px;border:1px solid #d4dbe8;border-radius:4px;padding:0 8px;font-size:12px;outline:none;width:140px;}
.mp-trip-input:focus{border-color:#e8a020;}
.mp-trip-grid-wrap{border:1px solid #d4dbe8;border-radius:4px;overflow:auto;max-height:220px;}
.mp-trip-tbl{border-collapse:collapse;width:100%;}
.mp-trip-tbl th{background:#1a2e4a;color:#fff;padding:6px 8px;font-size:11px;text-align:left;position:sticky;top:0;}
.mp-trip-tbl td{border-bottom:1px solid #eaecf4;padding:3px 5px;font-size:12px;}
.mp-trip-tbl tbody tr:nth-child(even){background:#f5f7fc;}
.mp-trip-tbl tbody tr:hover{background:#fef3e0;}
.mp-trip-tbl tbody tr.sel{background:#fddfa0;}
`;

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
}

function newBlankTripRow() {
  return {
    _uid: Math.random().toString(36).slice(2),
    Box: "",
    LW: "",
    EW: "",
    Id: null,
  };
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
      <div className="mp-picker">
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
                <th style={{ width: 110 }}>Code</th>
                <th>Name</th>
                <th style={{ width: 100 }}>Sale Rate</th>
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
                  <td>{p.Productcode}</td>
                  <td>{p.ProductName}</td>
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
          className="mp-cell-input"
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
          className="mp-cell-input ro"
          value={row.Description}
          readOnly
          tabIndex={-1}
        />
      </td>

      {/* Normal Rate (PaperRate) */}
      <td>
        <input
          className="mp-cell-input r"
          value={row.PaperRate}
          onChange={(e) => onChange("PaperRate", e.target.value)}
          onFocus={onFocus}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); onPaperRateEnter(); }
          }}
          onBlur={() => onChange("PaperRate", valNum(row.PaperRate).toFixed(2))}
        />
      </td>

      {/* Sale Rate (PlusRate) */}
      <td>
        <input
          className="mp-cell-input r"
          value={row.PlusRate}
          onChange={(e) => onChange("PlusRate", e.target.value)}
          onFocus={onFocus}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); onPlusRateEnter(); }
          }}
          onBlur={() => onChange("PlusRate", valNum(row.PlusRate).toFixed(2))}
        />
      </td>

      {/* Delete */}
      <td style={{ textAlign: "center" }}>
        <button
          className="mp-del-btn"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete row"
        >🗑</button>
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
    try {
      const res = await fetch("/Supplier/SelectSupplier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Comid: Comid.current, Startindex: -1, PageCount: 500, AccountType: "CUSTOMER", Keyword: "", Column: "" }),
      });
      const data = await res.json();
      if (data.ok) setCustomers(data.data || []);
    } catch {}
  }

  /* ─── load products ─── */
  async function loadProducts() {
    try {
      const res = await fetch("/ItemMaster/GetProductList", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Comid: Comid.current }),
      });
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : (data.data || []));
    } catch {}
  }

  /* ─── load customer sale rates on customer select ─── */
  async function loadCustomerRates(custId) {
    if (!custId || custId === "0") return;
    setLoading(true);
    try {
      const res = await fetch("/Supplier/SelectCustomerSaleRateALL", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Comid: Comid.current, Id: custId }),
      });
      const data = await res.json();
      const raw = data.data || [];
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
  function handleCustomerChange(e) {
    const val = e.target.value;
    setCustomerId(val);
    if (val && val !== "0") loadCustomerRates(val);
  }

  function handleComboKeyDown(e) {
    if (e.key === "Enter") {
      const selVal = e.target.value;
      if (selVal && selVal !== "0") loadCustomerRates(selVal);
    }
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
              Code: product.Productcode,
              Description: product.ProductName,
              PaperRate: valNum(product.SaleRate).toFixed(2),
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
          const res = await fetch("/Supplier/DeleteCustomerSaleRate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ Id: row.Id }),
          });
          const data = await res.json();
          if (data.ok) {
            showToast(data.message || "Deleted.");
            setRows((prev) => prev.filter((_, i) => i !== idx));
          } else msgBox(data.message);
        } catch { msgBox("Technical Fault !!!"); }
        finally { setLoading(false); }
      });
    } else {
      setRows((prev) => prev.length === 1 ? [newBlankRow()] : prev.filter((_, i) => i !== idx));
    }
  }

  /* ─── gridemptycheck ─── */
  function gridEmptyCheck() {
    let r = [...rows];
    const last = r[r.length - 1];
    if ((last.Code === "" || last.Code == null) && r.length > 1) {
      r = r.slice(0, -1);
      setRows(r);
    }
    return true;
  }

  /* ─── save (F1) ─── */
  function handleSave() {
    if (submitting.current) return;
    if (!gridEmptyCheck()) return;

    showConfirm("Do you Want to Save the Customer SaleRate Details?", async () => {
      setConfirm(null);
      submitting.current = true;
      setLoading(true);
      try {
        const res = await fetch("/Supplier/InsertCustomerSaleRate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Comid: Comid.current,
            Cusid: customerId,
          },
          body: JSON.stringify(rows),
        });
        const data = await res.json();
        if (data.ok) {
          showToast(data.message || "Saved successfully.");
          handleClear();
          setTimeout(() => comboRef.current?.focus(), 60);
        } else {
          msgBox(data.message);
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
    <div className="mp-wrap">
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

      {/* HEADER */}
      {/* <header className="mp-hdr">
        <div className="mp-hdr-left">
          <div className="mp-icon">📋</div>
          <div>
            <div className="mp-title">Customer Wise Sale Rate</div>
            <div className="mp-sub">Pricing Management</div>
          </div>
        </div>
        <button className="mp-back" onClick={() => (window.location.href = "/Home")}>← Back</button>
      </header> */}

      {/* BODY */}
      <main className="mp-body">
        {/* TOOLBAR */}
        <div className="mp-toolbar">
          <button className="mp-btn sv" disabled={loading || submitting.current} onClick={handleSave}>
            💾 Save (F1)
          </button>
          <button className="mp-btn tr" onClick={() => setShowTrip(true)}>
            🚛 Trip (F2)
          </button>
          <button className="mp-btn cl" onClick={() => showConfirm("Do You Want To Clear?", () => { setConfirm(null); handleClear(); })}>
            🗑 Clear (F10)
          </button>
          <button className="mp-btn nw" onClick={addNewRow}>＋ New Row</button>
          {toast && <span className="mp-msg ok">{toast}</span>}
          {toastErr && <span className="mp-msg err">{toastErr}</span>}


          <div className="mp-title">Customer Wise Sale Rate</div>
        </div>

        {/* CUSTOMER FILTER BAR */}
        <div className="mp-filter-bar">
          <span className="mp-filter-label">Customer :</span>
          <select
            ref={comboRef}
            className="mp-combo"
            value={customerId}
            onChange={handleCustomerChange}
            onKeyDown={handleComboKeyDown}
          >
            <option value="0">— Select Customer —</option>
            {customers.map((c) => (
              <option key={c.Id} value={c.Id}>{c.AccountName}</option>
            ))}
          </select>
        </div>

        {/* MAIN GRID */}
        <div className="mp-grid-wrap">
          <table className="mp-tbl">
            <thead>
              <tr>
                <th style={{ width: 46 }}>#</th>
                <th style={{ width: 130 }}>Code</th>
                <th style={{ width: 340 }}>Description</th>
                <th style={{ width: 130 }} className="r">Normal Rate</th>
                <th style={{ width: 130 }} className="r">Sale Rate</th>
                <th style={{ width: 42 }}></th>
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

        {/* HINT */}
        <div className="mp-hint">
          <kbd>F1</kbd> Save &nbsp;|&nbsp;
          <kbd>F2</kbd> Trip Window &nbsp;|&nbsp;
          <kbd>F10</kbd> Clear &nbsp;|&nbsp;
          <kbd>Esc</kbd> Quit &nbsp;|&nbsp;
          Press <kbd>Enter</kbd> on Code cell to browse products &nbsp;|&nbsp;
          <kbd>Del</kbd> button to delete a row
        </div>
      </main>
    </div>
  );
}