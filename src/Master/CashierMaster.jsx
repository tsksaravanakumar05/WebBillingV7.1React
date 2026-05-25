import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./MasterPage.css";

// ─────────────────────────────────────────────────────────────────────────────
// uid counter outside component — collision-proof, never resets
// ─────────────────────────────────────────────────────────────────────────────
let _uidCounter = 0;
const nextUid = () => ++_uidCounter;

const BASE_URL = "";

const mkUrl = (path, params) => {
  const base = BASE_URL + (path.startsWith("/") ? path : "/" + path);
  if (!params || Object.keys(params).length === 0) return base;
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return `${base}?${qs}`;
};

const getStr   = (k) => localStorage.getItem(k) || "";
const getLocal = (k) => {
  try { return JSON.parse(localStorage.getItem(k)); }
  catch { return null; }
};

const api = async (path, { queryParams = {}, body = null, extraHeaders = {} } = {}) => {
  try {
    const url = mkUrl(path, queryParams);
    const headers = {
      Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
      Userid:        localStorage.getItem("Userid")     || "0",
      Profile:       localStorage.getItem("Profile")    || "",
      LoginCheck:    localStorage.getItem("LoginCheck") || "0",
      ...extraHeaders,
    };
    if (body !== null) headers["Content-Type"] = "application/json; charset=utf-8";

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: body !== null ? JSON.stringify(body) : undefined,
    });

    if (res.status === 406) {
      alert("Already Login Another User Please Login Again!!!");
      window.location.href = "/Login";
      return { ok: false, message: "Session expired" };
    }

    const text = await res.text();
    console.log(`[${path}] Status:`, res.status, "| Body:", text.substring(0, 300));
    if (!text.trim()) return { ok: false, message: "Empty response" };

    let json;
    try { json = JSON.parse(text); }
    catch { return { ok: false, message: text }; }

    const isSuccess  = json.IsSuccess  ?? json.isSuccess  ?? json.ok        ?? false;
    const data       = json.Data1      ?? json.data1      ?? json.data      ?? null;
    const message    = json.Message    ?? json.message    ?? "";
    const data2      = json.Data2      ?? json.data2      ?? null;
    const redis      = json.Redis      ?? json.redis      ?? true;
    const statusCode = json.StatusCode ?? json.statusCode ?? res.status;

    return { ok: isSuccess, data, message, data2, redis, statusCode, _raw: json };
  } catch (err) {
    return { ok: false, _netErr: true, message: err.message };
  }
};

// Column field-name constants
const grdcode         = "Code";
const grdCashierName  = "CashierName";
const grdPassword     = "Password";
const grdLogonStatus  = "LogonStatus";
const grdDiscount     = "DiscountPer";
const grdDeleteRow    = "DeleteRow";
const grdDeleteReason = "DeleteReason";
const grdActive       = "Active";
const grdId           = "Id";
const grdEditMode     = "EditMode";

const makeEmptyRow = () => ({
  [grdcode]:         "",
  [grdCashierName]:  "",
  [grdPassword]:     "",
  [grdLogonStatus]:  false,
  [grdDeleteRow]:    false,
  [grdDeleteReason]: false,
  [grdActive]:       true,
  [grdId]:           null,
  [grdEditMode]:     1,
  _uid: nextUid(),
});

// ─────────────────────────────────────────────────────────────────────────────
export default function CashierMaster() {
  const navigate = useNavigate();

  // ── Permission state ──────────────────────────────────────────────────────
  const [permDenied,  setPermDenied]  = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const pageaddRef      = useRef(0);
  const pageeditRef     = useRef(0);
  const pagedeleteRef   = useRef(0);
  const gridRef         = useRef([]);
  const pwdValueRef     = useRef("");
  const PasswordTypeRef = useRef(1);
  const selIdxRef       = useRef(null);

  // ── Password modal state ──────────────────────────────────────────────────
  const [pwdModalOpen,  setPwdModalOpen]  = useState(false);
  const [pwdModalTitle, setPwdModalTitle] = useState("");
  const [pwdValue,      setPwdValue]      = useState("");
  const [pwdLoading,    setPwdLoading]    = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // ✅ THE KEY FIX:
  // isUnlocked = false  → ONLY password modal renders (grid is NOT in DOM)
  // isUnlocked = true   → password modal gone, full grid renders
  //
  // This mirrors jQuery exactly:
  //   jQuery: page HTML exists but grid is empty until loadcashier() runs
  //   React:  nothing renders at all until isUnlocked = true
  // ─────────────────────────────────────────────────────────────────────────
  const [isUnlocked, setIsUnlocked] = useState(false);

  // ── Grid / UI state ───────────────────────────────────────────────────────
  const [grid,    setGrid]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState(null);
  const [selIdx,  setSelIdx]  = useState(null);

  // ── Stable localStorage values ────────────────────────────────────────────
  const Comid       = getStr("Comid")       || "1";
  const MComid      = getStr("MComid")      || "1";
  const MirrorTable = getStr("MirrorTable") || "0";

  // ─────────────────────────────────────────────────────────────────────────
  // loadcashier — called ONLY after password success (mirrors jQuery exactly)
  // ─────────────────────────────────────────────────────────────────────────
  const loadcashier = useCallback(async () => {
    setLoading(true);
    const res = await api("/Cashier/SelectCashier", {
      queryParams: { Comid: parseInt(Comid) },
    });
    setLoading(false);

    if (res.ok) {
      let objlist = Array.isArray(res.data) ? res.data : [];
      objlist = objlist.map(obj => ({
        ...obj,
        [grdDiscount]: parseFloat(obj[grdDiscount] || 0).toFixed(2),
        [grdEditMode]: 0,
        _uid: nextUid(),
      }));

      const newRow   = makeEmptyRow();
      const fullGrid = [...objlist, newRow];

      gridRef.current   = fullGrid;
      selIdxRef.current = fullGrid.length - 1;
      setGrid(fullGrid);
      setSelIdx(fullGrid.length - 1);
    } else {
      const emptyGrid = [makeEmptyRow()];
      gridRef.current   = emptyGrid;
      selIdxRef.current = 0;
      setGrid(emptyGrid);
      setSelIdx(0);

      if (res.statusCode !== 404 && res.message) {
        alert(res.message || "Failed to load cashier data.");
      }
    }
  }, [Comid]);

  // ─────────────────────────────────────────────────────────────────────────
  // INIT — permission check → open password modal ONLY
  // Grid does NOT load here. Matches jQuery's methods.init() exactly.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const menulist = getLocal("menulist");
    if (menulist == null) {
      alert("Session Close Please Login !!!.");
      window.location.href = "/Login/Index";
      return;
    }

    const menudata = menulist.filter(obj => obj.PageName === "Cashier");
    if (menudata == null || menudata.length === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => { window.location.href = "/Home"; }, 3000);
      setPermDenied(true);
      return;
    }

    if (menudata[0].View === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => { window.location.href = "/Home"; }, 3000);
      setPermDenied(true);
      return;
    }

    // Set permission refs
    pageaddRef.current    = menudata[0].Add;
    pageeditRef.current   = menudata[0].Edit;
    pagedeleteRef.current = menudata[0].Delete;

    // ✅ Open ONLY the password modal — nothing else renders yet
    openEditPasswordWindow(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Focus password input after modal opens ────────────────────────────────
  useEffect(() => {
    if (!pwdModalOpen) return;
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById("txtEditpassword");
      if (el) el.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [pwdModalOpen]);

  // ── openEditPasswordWindow ────────────────────────────────────────────────
  function openEditPasswordWindow(type) {
    const titles = { 1: "Edit Pwd", 0: "Form Pwd", 2: "Admin Pwd" };
    PasswordTypeRef.current = type;
    setPwdModalTitle(titles[type] ?? "Edit Pwd");
    pwdValueRef.current = "";
    setPwdValue("");
    setPwdModalOpen(true);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // handlePwdSubmit — password Enter/OK
  //
  // ✅ EXACT jQuery flow:
  //   jQuery: ajax success → jqxWindow('Close') → 'close' event → loadcashier()
  //   React:  api success  → setIsUnlocked(true) → setPwdModalOpen(false) → loadcashier()
  //
  // setIsUnlocked(true) is the gate — it triggers the full UI to render.
  // loadcashier() then fills the grid with data.
  // ─────────────────────────────────────────────────────────────────────────
  const handlePwdSubmit = async () => {
    const currentPwd = pwdValueRef.current;
    if (!currentPwd) return;

    const typeMap = { 1: "EditPassword", 0: "FormConfig", 2: "AdminPower" };
    const type    = typeMap[PasswordTypeRef.current] ?? "EditPassword";

    setPwdLoading(true);
    const res = await api("/Login/EditPassword", {
      queryParams: { password: currentPwd, type, Comid },
    });
    setPwdLoading(false);

    if (res.ok) {
      // ✅ Step 1: unlock the page (renders the full grid UI)
      setIsUnlocked(true);
      // ✅ Step 2: close modal
      setPwdModalOpen(false);
      // ✅ Step 3: load data — exactly like jQuery's 'close' event handler
      loadcashier();
    } else {
      alert("Invaild Password !!!.");
      // Clear and refocus for retry
      pwdValueRef.current = "";
      setPwdValue("");
      requestAnimationFrame(() => {
        const el = document.getElementById("txtEditpassword");
        if (el) { el.value = ""; el.focus(); }
      });
    }
  };

  const handlePwdKeyDown = (event) => {
    const key = event.charCode || event.keyCode || 0;
    if (key === 13) handlePwdSubmit();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // gridemptycheck
  // ─────────────────────────────────────────────────────────────────────────
  const gridemptycheck = useCallback((currentGrid) => {
    let griddata   = [...currentGrid];
    const rowcount = griddata.length;

    if (
      rowcount > 0 &&
      (griddata[rowcount - 1][grdcode] === "" || griddata[rowcount - 1][grdcode] == null)
    ) {
      if (rowcount > 1) griddata = griddata.slice(0, rowcount - 1);
    }

    for (let i = 0; i < griddata.length; i++) {
      if (griddata[i][grdEditMode] === 1) {
        if (!griddata[i][grdcode]) {
          alert("Enter All Cashier Code in the Grid !!!.");
          selIdxRef.current = i; setSelIdx(i);
          return { result: false, grid: griddata };
        }
        if (!griddata[i][grdCashierName]) {
          alert("Enter All Cashier Name in the Grid !!!.");
          selIdxRef.current = i; setSelIdx(i);
          return { result: false, grid: griddata };
        }
        if (!griddata[i][grdPassword]) {
          alert("Enter All Password in the Grid !!!.");
          selIdxRef.current = i; setSelIdx(i);
          return { result: false, grid: griddata };
        }
      }
    }
    return { result: true, grid: griddata };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // CheckDuplicate
  // ─────────────────────────────────────────────────────────────────────────
  const CheckDuplicate = useCallback((griddata, field, fieldlabel) => {
    const seen = {};
    for (let i = 0; i < griddata.length; i++) {
      const val = griddata[i][field];
      if (val == null || val === "") continue;
      if (seen[val]) {
        alert(`Duplicate ${fieldlabel} Found !!!.`);
        selIdxRef.current = i; setSelIdx(i);
        return false;
      }
      seen[val] = true;
    }
    return true;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Addrowfunc
  // ─────────────────────────────────────────────────────────────────────────
  const Addrowfunc = useCallback(() => {
    const newRow = makeEmptyRow();
    setGrid(prev => {
      const updated     = [...prev, newRow];
      gridRef.current   = updated;
      selIdxRef.current = updated.length - 1;
      setSelIdx(updated.length - 1);
      return updated;
    });
  }, []);

  // ── updateCell ────────────────────────────────────────────────────────────
  const updateCell = useCallback((idx, field, value) => {
    setGrid(prev => {
      const updated   = prev.map((r, i) =>
        i === idx ? { ...r, [field]: value, [grdEditMode]: 1 } : r
      );
      gridRef.current = updated;
      return updated;
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // deleteRow
  // ─────────────────────────────────────────────────────────────────────────
  const deleteRow = useCallback(async (idx) => {
    const row = gridRef.current[idx];
    if (!row) return;
    const value = row[grdId];

    if (value != null && value !== 0) {
      if (pagedeleteRef.current === 1) {
        if (!window.confirm(`Wish to Delete the Record ${row[grdCashierName]}?`)) return;

        setLoading(true);
        const res = await api("/Cashier/DeleteCashier", {
          queryParams: {
            Id:          parseInt(value),
            Comid:       parseInt(Comid),
            MirrorTable: parseInt(MirrorTable),
          },
        });
        setLoading(false);

        if (res.ok) {
          setMsg({ text: res.message || "Deleted", err: false });
          setGrid(prev => {
            const updated     = prev.filter((_, i) => i !== idx);
            gridRef.current   = updated;
            const newSel      = Math.max(0, updated.length - 1);
            selIdxRef.current = newSel;
            setSelIdx(newSel);
            return updated;
          });
        } else {
          if (res.redis === false) {
            alert("Already Login Another User Please Login Again!!!");
            window.location.href = "/Login";
          } else {
            alert(res.message);
          }
        }
      } else {
        alert("Page Delete Permission Denied !!!.");
      }
    } else {
      setGrid(prev => {
        const updated     = prev.filter((_, i) => i !== idx);
        gridRef.current   = updated;
        const newSel      = Math.max(0, updated.length - 1);
        selIdxRef.current = newSel;
        setSelIdx(newSel);
        return updated;
      });
    }
  }, [Comid, MirrorTable]);

  // ─────────────────────────────────────────────────────────────────────────
  // handleSave
  // ─────────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    let flag              = 1;
    const currentGrid     = gridRef.current;
    const currentPageadd  = pageaddRef.current;
    const currentPageedit = pageeditRef.current;

    if (currentPageadd === 0 && currentPageedit === 0) {
      alert("Page Add & Update Permission Denied !!!.");
      Addrowfunc();
      return;
    }

    const emptyCheck = gridemptycheck(currentGrid);
    if (!emptyCheck.result) return;

    let griddata = emptyCheck.grid;
    let getdata;

    if (currentPageadd === 1 && currentPageedit === 1) {
      getdata = griddata.filter(obj => obj[grdEditMode] === 1);
      if (getdata.length === 0) {
        alert("No Data Modified,Cannot Update !!!.");
        flag = 0;
      }
    } else if (currentPageadd === 1 && currentPageedit === 0) {
      getdata = griddata.filter(obj => obj[grdEditMode] === 1 && obj[grdId] == null);
      if (getdata.length === 0) {
        const tmp = griddata.filter(obj => obj[grdEditMode] === 1);
        alert(tmp.length === 0 ? "No Data Modified,Cannot Update !!!." : "Page Edit Permission Denied !!!.");
        flag = 0;
      }
    } else if (currentPageedit === 1 && currentPageadd === 0) {
      getdata = griddata.filter(obj => obj[grdEditMode] === 1 && obj[grdId] != null);
      if (getdata.length === 0) {
        const tmp = griddata.filter(obj => obj[grdEditMode] === 1);
        alert(tmp.length === 0 ? "No Data Modified,Cannot Update !!!." : "Page Add Permission Denied !!!.");
        flag = 0;
      }
    }

    if (flag === 0) { Addrowfunc(); return; }

    const emptyCheck2 = gridemptycheck(griddata);
    if (!emptyCheck2.result) return;

    if (!CheckDuplicate(griddata, grdcode,        "Cashier Code")) return;
    if (!CheckDuplicate(griddata, grdCashierName, "Cashier Name")) return;

    if (!window.confirm("Do you Want to Save the Cashier Details?")) {
      Addrowfunc();
      return;
    }

    const cleanData = getdata.map(({ _uid, ...rest }) => ({
      ...rest,
      [grdId]: rest[grdId] || null,
    }));

    setLoading(true);
    const res = await api("/Cashier/InsertCashier", {
      body: cleanData,
      extraHeaders: {
        Comid:       String(Comid),
        MirrorTable: String(MirrorTable),
      },
    });
    setLoading(false);

    if (res.ok) {
      setMsg({ text: res.message || "Saved successfully!", err: false });
      await loadcashier();
    } else {
      if (res.redis === false) {
        alert("Already Login Another User Please Login Again!!!");
        window.location.href = "/Login";
      } else {
        alert(res.message || "Save failed.");
      }
    }
  }, [Addrowfunc, gridemptycheck, CheckDuplicate, loadcashier, Comid, MirrorTable]);

  // ── handleEsc ─────────────────────────────────────────────────────────────
  const handleEsc = useCallback(() => {
    // ✅ Only allow Esc to quit if password modal is NOT open
    // Mirrors jQuery: if ($("#LockEditWindow").jqxWindow('isOpen') == false)
    if (!pwdModalOpen) {
      if (window.confirm("Do You Want To Quit Page?")) {
        window.location.href = "/Home";
      }
    }
  }, [pwdModalOpen]);

  // ── Global keydown — only active after unlock ─────────────────────────────
  useEffect(() => {
    if (!isUnlocked) return; // ✅ Don't register F1/Esc until page is unlocked
    const onKey = (e) => {
      if (e.keyCode === 112) { e.preventDefault(); handleSave(); }
      if (e.keyCode === 113) { e.preventDefault(); }
      if (e.keyCode === 123) { e.preventDefault(); }
      if (e.keyCode === 27)  { e.preventDefault(); handleEsc(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isUnlocked, handleSave, handleEsc]);

  // ── Cell navigation ───────────────────────────────────────────────────────
  const visibleColumnOrder = [grdcode, grdCashierName, grdPassword, grdLogonStatus, grdActive];

  const moveToNextCell = useCallback((idx, columnname) => {
    const colIdx = visibleColumnOrder.indexOf(columnname);
    if (colIdx < visibleColumnOrder.length - 1) {
      selIdxRef.current = idx; setSelIdx(idx);
    } else {
      if (idx === gridRef.current.length - 1) {
        Addrowfunc();
      } else {
        selIdxRef.current = idx + 1; setSelIdx(idx + 1);
      }
    }
  }, [Addrowfunc]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCellKeyDown = useCallback((e, idx, columnname) => {
    const key = e.charCode || e.keyCode || 0;
    const row = gridRef.current[idx];
    if (!row) return;

    if (e.keyCode === 46 && e.ctrlKey) { deleteRow(idx); return; }

    if (e.key === "Enter" || key === 13) {
      const value = row[columnname];

      if (columnname === grdcode) {
        if (!value) { alert("Enter Cashier Code !!!."); return; }
        if (CheckDuplicate(gridRef.current, grdcode, "Cashier Code")) moveToNextCell(idx, columnname);
      } else if (columnname === grdCashierName) {
        if (!value) { alert("Enter Cashier Name !!!."); return; }
        if (CheckDuplicate(gridRef.current, grdCashierName, "Cashier Name")) moveToNextCell(idx, columnname);
      } else if (columnname === grdPassword) {
        if (!value) { alert("Enter Password !!!."); return; }
        moveToNextCell(idx, columnname);
      } else if (columnname === grdActive) {
        if (value == null || value === "") updateCell(idx, grdActive, true);
        moveToNextCell(idx, columnname);
      } else {
        moveToNextCell(idx, columnname);
      }
    }
  }, [CheckDuplicate, moveToNextCell, deleteRow, updateCell]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER LOGIC — mirrors jQuery's gate exactly
  //
  // State         | What renders
  // ──────────────|─────────────────────────────────────────────────────────
  // permDenied    | nothing (redirecting)
  // !isUnlocked   | ONLY the password modal (full screen, no grid behind it)
  // isUnlocked    | full grid UI (password modal is gone)
  // ─────────────────────────────────────────────────────────────────────────
  if (permDenied) return null;

  // ✅ PASSWORD GATE — only this renders until password is correct
  // The grid JSX below does NOT exist in the DOM at all during this phase
  if (!isUnlocked) {
    return (
      <div className="mp-loader-ov" style={{ zIndex: 9100 }}>
        <div className="mp-ldr-box" style={{ minWidth: 260, gap: 16 }}>

          {/* Lock icon + title */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 4 }}>🔒</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#1a2e4a" }}>
              {pwdModalTitle || "Edit Pwd"}
            </div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
              Enter password to access Cashier Master
            </div>
          </div>

          {/* Password input */}
          <input
            id="txtEditpassword"
            type="password"
            className="mp-cell-input"
            placeholder="Enter password..."
            style={{ width: 180, textAlign: "center" }}
            value={pwdValue}
            onChange={e => {
              pwdValueRef.current = e.target.value;
              setPwdValue(e.target.value);
            }}
            onKeyDown={handlePwdKeyDown}
            disabled={pwdLoading}
          />

          {/* Buttons */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button
              className="mp-btn sv"
              onClick={handlePwdSubmit}
              disabled={pwdLoading}
              style={{ minWidth: 80 }}
            >
              {pwdLoading ? "Checking..." : "✓ OK"}
            </button>
            <button
              className="mp-btn dl"
              onClick={() => { window.location.href = "/Home"; }}
              disabled={pwdLoading}
              style={{ minWidth: 80 }}
            >
              ✕ Cancel
            </button>
          </div>

        </div>
      </div>
    );
  }

  // ✅ FULL UI — only renders after password success
  return (
    <div className="mp-wrap">

      {/* ── HEADER ── */}
      <div className="mp-hdr">
        <div className="mp-hdr-left">
          <div className="mp-icon">C</div>
          <div>
            <div className="mp-title">Cashier Master</div>
            <div className="mp-sub">Manage cashier records</div>
          </div>
        </div>
        <button className="mp-back" onClick={handleEsc}>← Back to Home</button>
      </div>

      {/* ── BODY ── */}
      <div className="mp-body">

        {/* ── TOOLBAR ── */}
        <div className="mp-toolbar">
          <button className="mp-btn sv" onClick={handleSave} disabled={loading}>💾 F1 Save</button>
          <button className="mp-btn nw" onClick={Addrowfunc}>➕ Add Row</button>
          <button className="mp-btn dl" onClick={handleEsc}>✕ Esc Cancel</button>
          {msg && (
            <span className={`mp-msg${msg.err ? " err" : " ok"}`}>{msg.text}</span>
          )}
        </div>

        {/* ── GRID ── */}
        <div className="mp-grid-wrap">
          <table className="mp-tbl">
            <thead>
              <tr>
                <th style={{ width: 50  }}>S.No</th>
                <th style={{ width: 100 }}>Code</th>
                <th style={{ width: 160 }}>Cashier Name</th>
                <th style={{ width: 100 }}>Password</th>
                <th style={{ width: 110 }}>Logon Status</th>
                <th style={{ width: 100 }}>Active</th>
                <th style={{ width: 60  }}></th>
              </tr>
            </thead>
            <tbody>
              {loading && grid.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 20, color: "#888" }}>
                    Loading...
                  </td>
                </tr>
              ) : (
                grid.map((row, idx) => {
                  if (!row) return null;
                  return (
                    <tr
                      key={row._uid}
                      className={[
                        selIdx === idx                                    ? "sel"   : "",
                        row[grdActive] === 0 || row[grdActive] === false  ? "inact" : "",
                        row[grdEditMode] === 1                            ? "mod"   : "",
                      ].filter(Boolean).join(" ")}
                      onClick={() => { selIdxRef.current = idx; setSelIdx(idx); }}
                    >
                      <td className="sno">{idx + 1}</td>

                      <td>
                        <input
                          className="mp-cell-input"
                          value={row[grdcode] || ""}
                          maxLength={50}
                          autoFocus={idx === selIdx}
                          onChange={e => updateCell(idx, grdcode, e.target.value)}
                          onKeyDown={e => handleCellKeyDown(e, idx, grdcode)}
                        />
                      </td>

                      <td>
                        <input
                          className="mp-cell-input"
                          value={row[grdCashierName] || ""}
                          maxLength={50}
                          onChange={e => updateCell(idx, grdCashierName, e.target.value)}
                          onKeyDown={e => handleCellKeyDown(e, idx, grdCashierName)}
                        />
                      </td>

                      <td>
                        <input
                          className="mp-cell-input"
                          type="password"
                          value={row[grdPassword] || ""}
                          maxLength={50}
                          onChange={e => updateCell(idx, grdPassword, e.target.value)}
                          onKeyDown={e => handleCellKeyDown(e, idx, grdPassword)}
                        />
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={row[grdLogonStatus] === true || row[grdLogonStatus] === 1}
                          onChange={e => updateCell(idx, grdLogonStatus, e.target.checked)}
                        />
                      </td>

                      <td>
                        <select
                          className="mp-cell-select"
                          value={row[grdActive] === true || row[grdActive] === 1 ? "Yes" : "No"}
                          onChange={e => updateCell(idx, grdActive, e.target.value === "Yes")}
                          onKeyDown={e => handleCellKeyDown(e, idx, grdActive)}
                        >
                          <option>Yes</option>
                          <option>No</option>
                        </select>
                      </td>

                      <td>
                        <button
                          className="mp-del-btn"
                          onClick={() => deleteRow(idx)}
                          title="Delete row (Ctrl+Delete)"
                        >🗑</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mp-hint">
          Press <kbd>Enter</kbd> to move to next cell &nbsp;|&nbsp;
          <kbd>Ctrl+Delete</kbd> to delete row &nbsp;|&nbsp;
          <kbd>F1</kbd> to save &nbsp;|&nbsp;
          <kbd>Esc</kbd> to go back
        </div>
      </div>

      {/* Loading overlay — shown during API calls after unlock */}
      {loading && (
        <div className="mp-loader-ov">
          <div className="mp-ldr-box">
            <div className="mp-spin" />
            <div className="mp-ldr-msg">Processing...</div>
          </div>
        </div>
      )}

    </div>
  );
}
