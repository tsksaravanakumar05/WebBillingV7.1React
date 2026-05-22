import { useState, useEffect, useRef, useCallback } from "react";
import "./MasterPage.css";

/* ─────────────────────────────────────────────
   § 1. HELPERS  (matches BrandMaster api / authHeaders pattern)
───────────────────────────────────────────── */
const mkUrl  = (path) => (path.startsWith("/") ? path : "/" + path);

const authHeaders = () => ({
  "Authorization": `Bearer ${localStorage.getItem("token")    || ""}`,
  "Userid":        localStorage.getItem("userid")             || "0",
  "Profile":       localStorage.getItem("Profile")            || "Admin",
  "LoginCheck":    localStorage.getItem("LoginCheck")         || "1",
});

/** Normalised POST helper — handles 406 redirect, 404, 500, empty body, field aliases */
const api = async (
  path,
  body = null,
  query = {},
  extraHeaders = {}
) => {
  try {
    // QUERY STRING BUILD
    const qs = new URLSearchParams();
    Object.entries(query || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        qs.append(k, v);
      }
    });

    const finalUrl =
      mkUrl(path) + (qs.toString() ? `?${qs.toString()}` : "");

    console.log("API URL =", finalUrl);

    const res = await fetch(finalUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...authHeaders(),
        ...extraHeaders,
      },
      body: body ? JSON.stringify(body) : null,
    });

    if (res.status === 404) {
      return {
        ok: false,
        _http404: true,
        message: `404 : ${finalUrl}`,
      };
    }

    const text = await res.text();

    if (!text.trim()) {
      return {
        ok: false,
        message: "Empty response",
      };
    }

    const j = JSON.parse(text);

    // Normalise field aliases so the rest of the code can use .ok / .data / .message
    if (j.IsSuccess !== undefined && j.ok === undefined) j.ok = j.IsSuccess;

    // FIX: Catch multiple common capitalization formats for data arrays
    if (j.data === undefined) {
      if (j.Data !== undefined) j.data = j.Data;
      else if (j.Data1 !== undefined) j.data = j.Data1;
      else if (j.data1 !== undefined) j.data = j.data1;
    }

    if (j.Message !== undefined && j.message === undefined) j.message = j.Message;

    return j;

  } catch (err) {
    return {
      ok: false,
      _netErr: true,
      message: err.message,
    };
  }
};

const getStr   = (k) => localStorage.getItem(k) || "";
const getLocal = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

function valNum(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function nullStr(v) { return v == null ? "" : String(v); }

function newBlankRow() {
  return {
    _uid:        crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    EditMode:    0,
    Id:          null,
    ProductId:   null,
    Code:        "",
    Description: "",
    PaperRate:   "",
    PlusRate:    "",
    Wastage:     "",
    FixedRate:   "",
    Active:      true,
  };
}

function newBlankTripRow() {
  return {
    _uid: Math.random().toString(36).slice(2),
    Box: "", LW: "", EW: "", Id: null,
  };
}

/* ─────────────────────────────────────────────
   § 2. SHARED UI COMPONENTS
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

/** Promise-based confirm hook */
function useConfirm() {
  const [conf, setConf] = useState(null);

  const confirm = useCallback(
    (message) => new Promise((resolve) => setConf({ message, resolve })),
    []
  );

  const handleYes = useCallback(() => { conf?.resolve(true);  setConf(null); }, [conf]);
  const handleNo  = useCallback(() => { conf?.resolve(false); setConf(null); }, [conf]);

  const ConfirmUI = conf ? (
    <div className="mp-modal-ov">
      <div className="mp-modal">
        <h3>Confirm</h3>
        <p>{conf.message}</p>
        <div className="mp-modal-btns">
          <button className="mp-modal-btn no"  onClick={handleNo}>No</button>
          <button className="mp-modal-btn yes" onClick={handleYes} autoFocus>Yes</button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, ConfirmUI };
}

/* ─────────────────────────────────────────────
   § 3. PRODUCT PICKER MODAL
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
      <div className="mp-picker" style={{ width: 520, maxHeight: 480 }}>
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
                <th style={{ width: 120 }}>Code</th>
                <th>Name</th>
                <th style={{ width: 110, textAlign: "right" }}>Sale Rate</th>
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
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", color: "#aaa", padding: 16 }}>
                    No results
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

/* ─────────────────────────────────────────────
   § 4. TRIP MODAL
───────────────────────────────────────────── */
function TripModal({ onClose }) {
  const [tripRows,  setTripRows]  = useState([newBlankTripRow()]);
  const [selRow,    setSelRow]    = useState(0);
  const [mWeight,   setMWeight]   = useState("");
  const [mCount,    setMCount]    = useState("");
  const mWeightRef  = useRef(null);
  const mCountRef   = useRef(null);
  const firstCellRef = useRef(null);

  useEffect(() => { setTimeout(() => firstCellRef.current?.focus(), 100); }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [onClose]);

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
      document.getElementById(`trip-lw-${idx}`)?.focus();
    } else if (field === "LW") {
      updateTripCell(idx, "LW", valNum(row.LW).toFixed(2));
      document.getElementById(`trip-ew-${idx}`)?.focus();
    } else if (field === "EW") {
      updateTripCell(idx, "EW", valNum(row.EW).toFixed(2));
      const next = [...tripRows, newBlankTripRow()];
      setTripRows(next);
      setSelRow(next.length - 1);
      setTimeout(() => document.getElementById(`trip-box-${next.length - 1}`)?.focus(), 40);
    }
  }

  function deleteTripRow(idx) {
    setTripRows((prev) =>
      prev.length === 1 ? [newBlankTripRow()] : prev.filter((_, i) => i !== idx)
    );
  }

  return (
    <div className="mp-modal-ov" style={{ zIndex: 8700 }}>
      <div
        className="mp-modal"
        style={{ minWidth: 480, maxWidth: 560, padding: 0, overflow: "hidden" }}
      >
        <div
          style={{
            background: "#1f65de", color: "#fff", padding: "10px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 13 }}>🚛 Trip Details</span>
          <button className="mp-picker-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {[
              { label: "M.Weight", val: mWeight, set: setMWeight, ref: mWeightRef, next: () => mCountRef.current?.focus() },
              { label: "M.Count",  val: mCount,  set: setMCount,  ref: mCountRef,  next: null },
            ].map(({ label, val, set, ref, next }) => (
              <label key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: "#1a2e4a" }}>
                {label}
                <input
                  ref={ref}
                  className="mp-cell-input"
                  style={{ width: 110 }}
                  value={val}
                  onChange={(e) => set(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && next) next(); }}
                />
              </label>
            ))}
          </div>

          <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid #c5d8f8", borderRadius: 5 }}>
            <table className="mp-tbl" style={{ minWidth: "unset" }}>
              <thead>
                <tr>
                  <th style={{ width: 42 }}>#</th>
                  <th>Box</th>
                  <th>LW</th>
                  <th>EW</th>
                  <th style={{ width: 42 }}></th>
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
                    {(["Box", "LW", "EW"]).map((field) => (
                      <td key={field}>
                        <input
                          id={`trip-${field.toLowerCase()}-${idx}`}
                          ref={field === "Box" && idx === 0 ? firstCellRef : null}
                          className="mp-cell-input"
                          value={row[field]}
                          onChange={(e) => updateTripCell(idx, field, e.target.value)}
                          onKeyDown={(e) => handleTripKeyDown(e, idx, field)}
                          onFocus={() => setSelRow(idx)}
                        />
                      </td>
                    ))}
                    <td style={{ textAlign: "center" }}>
                      <button className="mp-del-btn" onClick={() => deleteTripRow(idx)}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="mp-btn dl" onClick={onClose}>✕ Close (Esc)</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   § 5. SALE RATE ROW
───────────────────────────────────────────── */
function SaleRateRow({
  row, idx, selected,
  onChange, onDelete,
  onCodeEnter, onPaperRateEnter, onPlusRateEnter,
  onFocus,
}) {
  return (
    <tr
      className={[selected ? "sel" : "", row.EditMode ? "mod" : ""].filter(Boolean).join(" ")}
      onClick={onFocus}
    >
      <td className="sno">{idx + 1}</td>
      <td>
        <input
          id={`code-${idx}`}
          className="mp-cell-input"
          value={row.Code}
          onChange={(e) => onChange("Code", e.target.value)}
          onFocus={onFocus}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onCodeEnter(); } }}
          placeholder="Enter / pick"
        />
      </td>
      <td>
        <input
          className="mp-cell-input"
          style={{ background: "#f5f9ff", color: "#8b99b5", cursor: "default" }}
          value={row.Description}
          readOnly
          tabIndex={-1}
        />
      </td>
      <td>
        <input
          id={`paper-rate-${idx}`}
          className="mp-cell-input"
          style={{ textAlign: "right" }}
          value={row.PaperRate}
          onChange={(e) => onChange("PaperRate", e.target.value)}
          onFocus={onFocus}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onPaperRateEnter(); } }}
          onBlur={() => onChange("PaperRate", valNum(row.PaperRate).toFixed(2))}
        />
      </td>
      <td>
        <input
          id={`plus-rate-${idx}`}
          className="mp-cell-input"
          style={{ textAlign: "right" }}
          value={row.PlusRate}
          onChange={(e) => onChange("PlusRate", e.target.value)}
          onFocus={onFocus}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onPlusRateEnter(); } }}
          onBlur={() => onChange("PlusRate", valNum(row.PlusRate).toFixed(2))}
        />
      </td>
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
   § 6. MAIN COMPONENT
───────────────────────────────────────────── */
export default function CustomerWiseSaleRate() {
  const [sess] = useState(() => {
    try {
      const main0     = (getLocal("Mainsetting") || [{}])[0] || {};
      const Comid     = getStr("Comid")    || "1";
      const MComid    = getStr("MComid")   || Comid;
      const IdComList = getStr("IdComList") || Comid;
      return {
        Comid:      main0.CommonCompany ? MComid : Comid,
        IdComList,
      };
    } catch {
      return { Comid: "1", IdComList: "1" };
    }
  });

  const [customers,   setCustomers]   = useState([]);
  const [customerId,  setCustomerId]  = useState("0");
  const comboRef = useRef(null);

  const [products, setProducts] = useState([]);
  const [rows,         setRows]        = useState([newBlankRow()]);
  const [selectedRow, setSelectedRow] = useState(0);

  const [loading,  setLoading]  = useState(false);
  const [alertMsg, setAlertMsg] = useState("");
  const [toasts,   setToasts]   = useState([]);

  const [showPicker,   setShowPicker]   = useState(false);
  const [pickerRowIdx, setPickerRowIdx] = useState(null);
  const [showTrip,     setShowTrip]     = useState(false);

  const { confirm, ConfirmUI } = useConfirm();
  const submitting = useRef(false);

  const toastId = useRef(0);
  const toast = useCallback((msg, isErr = false) => {
    const id = ++toastId.current;
    setToasts((p) => [...p, { id, msg, isErr }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);

  useEffect(() => {
    loadCustomerCombo();
    loadProducts();
    setTimeout(() => comboRef.current?.focus(), 120);
  }, []); // eslint-disable-line

  const loadCustomerCombo = async () => {
    try {
      const res = await api(
        "Supplier/SelectSupplier",
        null,
        {
          Comid: Number(sess.Comid),
          Startindex: -1,
          PageCount: 500,
          AccountType: "CUSTOMER",
          Keyword: "",
          Column: "All",
        }
      );

      console.log("CUSTOMER RESPONSE =", res);

      if (res?._netErr || res?._http404) {
        toast("❌ Network Error / API Not Found", true);
        return;
      }

      // FIX: Robust check to extract data whether it is directly an Array or nested inside properties
      const list = Array.isArray(res) ? res : (res?.data || []);
      console.log("CUSTOMER LIST =", list);

      setCustomers(list);
    } catch (err) {
      console.error("LOAD CUSTOMER ERROR =", err);
      toast(err?.message || "Failed to load customers", true);
    }
  };

  async function loadProducts() {
    const res = await api(
      "/ItemMaster/GetProductList",
      null,
      { Comid: Number(sess.Comid) }
    );

    console.log("PRODUCT RESPONSE =", res);

    if (res?._netErr || res?._http404) {
      toast(`❌ Could not load products: ${res.message}`, true);
      return;
    }

    // FIX: Robust data check
    const list = Array.isArray(res) ? res : (res?.data || []);
    console.log("PRODUCTS =", list);

    setProducts(list);
  }

  const loadCustomerRates = useCallback(async (custId) => {
    if (!custId || custId === "0") return;
    setLoading(true);

    // FIX: Moving the payload to the third parameter (query string) to match your other successful GET requests
    const res = await api(
      "/Supplier/SelectCustomerSaleRateALL",
      null,
      { Comid: sess.Comid, Id: custId }
    );
    setLoading(false);

    if (res._netErr)  { toast(`❌ Network error: ${res.message}`, true); return; }
    if (res._http404) { toast("❌ Endpoint not found (404)", true); return; }
    
    // FIX: Robust array extraction
    const raw = Array.isArray(res) ? res : (res.data || []);
    
    if (raw.length) {
      const normalised = raw.map((obj) => ({
        ...obj,
        _uid:      Math.random().toString(36).slice(2),
        EditMode:  0,
        PlusRate:  parseFloat(obj.PlusRate  || 0).toFixed(2),
        Wastage:   parseFloat(obj.Wastage   || 0).toFixed(3),
        FixedRate: parseFloat(obj.FixedRate || 0).toFixed(2),
        PaperRate: parseFloat(obj.PaperRate || 0).toFixed(2),
      }));
      setRows([...normalised, newBlankRow()]);
      setSelectedRow(normalised.length);
    } else {
      setRows([newBlankRow()]);
      setSelectedRow(0);
    }
  }, [sess.Comid, toast]);

  function handleCustomerChange(e) {
    const val = e.target.value;
    setCustomerId(val);
    loadCustomerRates(val);
  }

  function updateCell(idx, field, value) {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value, EditMode: 1 } : r));
  }

  const addNewRow = useCallback(() => {
    setRows((prev) => {
      const trimmed = prev.filter((r, i) => i < prev.length - 1 || r.Code !== "");
      const next    = [...trimmed, newBlankRow()];
      setSelectedRow(next.length - 1);
      setTimeout(() => document.getElementById(`code-${next.length - 1}`)?.focus(), 40);
      return next;
    });
  }, []);

  function onProductSelect(product) {
    const idx = pickerRowIdx;
    setShowPicker(false);
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx
          ? {
              ...r,
              EditMode:    1,
              Code:        product.Productcode,
              Description: product.ProductName,
              PaperRate:   valNum(product.SaleRate).toFixed(2),
              ProductId:   product.Id,
            }
          : r
      )
    );
    setSelectedRow(idx);
    setTimeout(() => document.getElementById(`plus-rate-${idx}`)?.focus(), 60);
  }

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
      const next = prev.map((r, i) =>
        i === idx ? { ...r, PlusRate: valNum(r.PlusRate).toFixed(2) } : r
      );
      if (idx === prev.length - 1) {
        const withNew = [...next, newBlankRow()];
        setSelectedRow(withNew.length - 1);
        setTimeout(() => document.getElementById(`code-${withNew.length - 1}`)?.focus(), 40);
        return withNew;
      }
      setSelectedRow(prev.length - 1);
      setTimeout(() => document.getElementById(`code-${prev.length - 1}`)?.focus(), 30);
      return next;
    });
  }

  const deleteRow = useCallback(async (idx) => {
    const row = rows[idx];
    if (row.Id) {
      const ok = await confirm(`Delete the record for "${row.Code}"?`);
      if (!ok) return;
      setLoading(true);

      // FIX: Pass Id as a Query parameter (3rd argument)
      // Pass Comid as a Header (4th argument)
      const res = await api(
        "/Supplier/DeleteCustomerSaleRate", 
        null,             // Empty Body
        { Id: row.Id },   // Query String
        { Comid: sess.Comid.toString() } // Headers
      );
      
      setLoading(false);
      if (res.ok || res.IsSuccess) {
        toast("✅ " + (res.message || "Deleted."));
        setRows((prev) => prev.filter((_, i) => i !== idx));
      } else {
        toast(`❌ ${res.message || "Delete failed"}`, true);
      }
    } else {
      setRows((prev) => prev.length === 1 ? [newBlankRow()] : prev.filter((_, i) => i !== idx));
    }
  }, [rows, confirm, toast, sess.Comid]); // Make sure sess.Comid is in the dependency array

  function gridEmptyCheck(grid) {
    let r = [...grid];
    const last = r[r.length - 1];
    if ((last.Code === "" || last.Code == null) && r.length > 1) r = r.slice(0, -1);
    return r;
  }

  const handleSave = useCallback(async () => {
    if (submitting.current) return;
    if (customerId === "0") { toast("❌ Please select a customer first.", true); return; }

    const cleaned = gridEmptyCheck(rows);
    setRows(cleaned);

    const dirty = cleaned.filter((r) => r.EditMode === 1);
    if (!dirty.length) { toast("⚠️ No data modified — nothing to save.", true); return; }

    const ok = await confirm("Save Customer Sale Rate details?");
    if (!ok) { addNewRow(); return; }

    submitting.current = true;
    setLoading(true);

    // FIX: Pass Comid and Cusid as Headers (4th parameter), 
    // and leave the Query parameter (3rd parameter) empty.
    const res = await api(
      "/Supplier/InsertCustomerSaleRate",
      cleaned, // Body
      {},      // Empty Query String
      {        // Headers
        Comid: sess.Comid.toString(), 
        Cusid: customerId.toString() 
      } 
    );

    setLoading(false);
    submitting.current = false;

    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

    if (res.ok || res.IsSuccess) {
      toast("✅ " + (res.message || "Saved successfully."));
      handleClear();
      setTimeout(() => comboRef.current?.focus(), 60);
    } else {
      toast(`❌ ${res.message || "Save failed"}`, true);
      addNewRow();
    }
  }, [rows, customerId, sess, confirm, addNewRow, toast]); // eslint-disable-line
  const handleClear = useCallback(() => {
    setRows([newBlankRow()]);
    setSelectedRow(0);
    setCustomerId("0");
    setTimeout(() => comboRef.current?.focus(), 60);
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (showPicker || showTrip) return;

      if (e.keyCode === 112) { e.preventDefault(); handleSave(); }       // F1 Save
      if (e.keyCode === 113) { e.preventDefault(); setShowTrip(true); }  // F2 Trip
      if (e.keyCode === 121) { e.preventDefault(); handleClear(); }      // F10 Clear
      if (e.keyCode === 27) {
        e.preventDefault();
        confirm("Do you want to quit this page?").then(
          (ok) => { if (ok) window.location.href = "/Home"; }
        );
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showPicker, showTrip, handleSave, handleClear, confirm]);

  /* ─────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────── */
  return (
    <div className="mp-wrap">
      {loading && <Loader msg="Please wait…" />}
      {alertMsg && <AlertModal msg={alertMsg} onClose={() => setAlertMsg("")} />}
      {ConfirmUI}

      {showPicker && (
        <ProductPickerModal
          products={products}
          onSelect={onProductSelect}
          onClose={() => setShowPicker(false)}
        />
      )}
      {showTrip && <TripModal onClose={() => setShowTrip(false)} />}

      <header className="mp-hdr">
        <div className="mp-hdr-left">
          <div className="mp-icon" style={{ fontSize: 18 }}>📋</div>
          <div>
            <div className="mp-title">Customer Wise Sale Rate</div>
            <div className="mp-sub">Pricing Management — Co: {sess.Comid}</div>
          </div>
        </div>
        <button className="mp-back" onClick={() => (window.location.href = "/Home")}>← Back</button>
      </header>

      <main className="mp-body">
        <div className="mp-toolbar">
          <button
            className="mp-btn sv"
            disabled={loading || submitting.current}
            onClick={handleSave}
          >
            💾 Save (F1)
          </button>
          <button className="mp-btn nw" onClick={() => setShowTrip(true)}>
            🚛 Trip (F2)
          </button>
          <button
            className="mp-btn dl"
            onClick={async () => {
              const ok = await confirm("Clear all data?");
              if (ok) handleClear();
            }}
          >
            🗑 Clear (F10)
          </button>
          <button className="mp-btn info" onClick={addNewRow}>＋ New Row</button>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #c5d8f8",
            borderLeft: "4px solid #1f65de",
            borderRadius: 6,
            padding: "8px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: "#1a2e4a", whiteSpace: "nowrap" }}>
            Customer :
          </span>
          <select
            ref={comboRef}
            style={{
              height: 30, minWidth: 280, maxWidth: 480,
              border: "1px solid #c5d8f8", borderRadius: 4,
              padding: "0 8px", fontSize: 12, color: "#1a2e4a",
              outline: "none", cursor: "pointer",
            }}
            value={customerId}
            onChange={handleCustomerChange}
          >
            <option value="0">— Select Customer —</option>
            {customers.map((c) => (
              <option key={c.Id} value={c.Id}>{c.AccountName}</option>
            ))}
          </select>
          {customerId !== "0" && (
            <span style={{ fontSize: 11, color: "#6b7a99" }}>
              {rows.filter((r) => r.Id).length} rate(s) loaded
            </span>
          )}
        </div>

        <div className="mp-grid-wrap">
          <table className="mp-tbl">
            <thead>
              <tr>
                <th style={{ width: 46 }}>#</th>
                <th style={{ width: 130 }}>Code</th>
                <th>Description</th>
                <th style={{ width: 130, textAlign: "right" }}>Normal Rate</th>
                <th style={{ width: 130, textAlign: "right" }}>Sale Rate</th>
                <th style={{ width: 46 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <SaleRateRow
                  key={row._uid}
                  row={row}
                  idx={idx}
                  selected={selectedRow === idx}
                  onChange={(field, val) => updateCell(idx, field, val)}
                  onDelete={() => deleteRow(idx)}
                  onCodeEnter={() => onCodeEnter(idx)}
                  onPaperRateEnter={() => onPaperRateEnter(idx)}
                  onPlusRateEnter={() => onPlusRateEnter(idx)}
                  onFocus={() => setSelectedRow(idx)}
                />
              ))}
            </tbody>
          </table>
          {rows.length === 0 && !loading && (
            <div className="mp-empty">No rates yet — select a customer or press ＋ New Row.</div>
          )}
        </div>

        <div className="mp-hint">
          <kbd>F1</kbd> Save &nbsp;|&nbsp;
          <kbd>F2</kbd> Trip Window &nbsp;|&nbsp;
          <kbd>F10</kbd> Clear &nbsp;|&nbsp;
          <kbd>Esc</kbd> Quit &nbsp;|&nbsp;
          <kbd>Enter</kbd> on Code → product picker &nbsp;|&nbsp;
          <kbd>🗑</kbd> delete row
        </div>
      </main>

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.isErr ? " err" : ""}`}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}