import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./MasterPage.css"; // same CSS as BrandMaster

// ─── Helpers (identical to BrandMaster) ──────────────────────────────────────
const mkUrl = (path) => (path.startsWith("/") ? path : "/" + path);

const authHeaders = () => ({
  "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
  "Userid":        localStorage.getItem("userid")     || "0",
  "Profile":       localStorage.getItem("Profile")    || "Admin",
  "LoginCheck":    localStorage.getItem("LoginCheck") || "1",
});

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
    } catch { return { ok: false, message: text }; }
  } catch (err) {
    return { ok: false, _netErr: true, message: err.message };
  }
};

const insertapi = async (path, body = null, extraHeaders = {}) => {
  try {
    const res = await fetch(mkUrl(path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...authHeaders(),
        ...extraHeaders,
      },
      body: body != null ? JSON.stringify(body) : null,
    });
    const text = await res.text();
    return JSON.parse(text);
  } catch (err) {
    return { ok: false, message: err.message };
  }
};

const getStr   = (k) => localStorage.getItem(k) || "";
const getLocal = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const uid = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36);

// ─── Uppercase helper ─────────────────────────────────────────────────────────
function applyUppercase(e, onChange) {
  const el    = e.target;
  const start = el.selectionStart;
  const end   = el.selectionEnd;
  const upper = el.value.toUpperCase();
  onChange(upper);
  requestAnimationFrame(() => {
    if (el && document.activeElement === el) {
      el.setSelectionRange(start, end);
    }
  });
}

// ─── Confirmation Modal (identical to BrandMaster) ───────────────────────────
function ConfirmModal({ message, onYes, onNo }) {
  const yesBtnRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => yesBtnRef.current?.focus(), 30);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onNo(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onNo]);

  return (
    <div style={styles.overlay}>
      <div style={styles.modal} role="dialog" aria-modal="true">
        <div style={styles.modalIcon}>?</div>
        <p style={styles.modalMsg}>{message}</p>
        <div style={styles.modalBtns}>
          <button
            ref={yesBtnRef}
            style={{ ...styles.modalBtn, ...styles.yesBtn }}
            onClick={onYes}
          >
            ✔ Yes
          </button>
          <button
            style={{ ...styles.modalBtn, ...styles.noBtn }}
            onClick={onNo}
          >
            ✘ No
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed", inset: 0,
    background: "rgba(10,20,40,0.55)",
    backdropFilter: "blur(2px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 9999,
  },
  modal: {
    background: "#fff",
    borderRadius: "10px",
    padding: "28px 32px 22px",
    minWidth: "280px",
    maxWidth: "360px",
    textAlign: "center",
    boxShadow: "0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)",
    border: "1px solid #e2e8f0",
    animation: "popIn 0.15s ease",
  },
  modalIcon: {
    width: "40px", height: "40px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    color: "#fff",
    fontSize: "20px", fontWeight: "700",
    lineHeight: "40px",
    margin: "0 auto 14px",
  },
  modalMsg: {
    fontSize: "14px",
    color: "#1e293b",
    fontWeight: "500",
    margin: "0 0 20px",
    lineHeight: "1.5",
  },
  modalBtns: {
    display: "flex", gap: "10px", justifyContent: "center",
  },
  modalBtn: {
    padding: "7px 26px",
    borderRadius: "6px",
    border: "none",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "opacity 0.15s",
    outline: "none",
  },
  yesBtn: {
    background: "linear-gradient(135deg, #22c55e, #16a34a)",
    color: "#fff",
    boxShadow: "0 2px 6px rgba(34,197,94,0.35)",
  },
  noBtn: {
    background: "#f1f5f9",
    color: "#475569",
    border: "1px solid #cbd5e1",
  },
};

// Inject keyframe once
if (typeof document !== "undefined" && !document.getElementById("popInStyle")) {
  const s = document.createElement("style");
  s.id = "popInStyle";
  s.textContent = `
    @keyframes popIn {
      from { transform: scale(0.88); opacity: 0; }
      to   { transform: scale(1);    opacity: 1; }
    }
    .mp-active-sel {
      text-align: center;
      font-size: 16px;
      padding: 2px 4px;
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      background: #f8fafc;
      cursor: pointer;
      width: 62px;
    }
    .mp-active-sel:focus { outline: 2px solid #3b82f6; }
  `;
  document.head.appendChild(s);
}

// ─── useConfirm hook (identical to BrandMaster) ───────────────────────────────
function useConfirm() {
  const [conf, setConf] = useState(null);

  const confirm = useCallback((message) =>
    new Promise((resolve) => setConf({ message, resolve })),
  []);

  const handleYes = useCallback(() => {
    conf?.resolve(true);
    setConf(null);
  }, [conf]);

  const handleNo = useCallback(() => {
    conf?.resolve(false);
    setConf(null);
  }, [conf]);

  const ConfirmUI = conf ? (
    <ConfirmModal message={conf.message} onYes={handleYes} onNo={handleNo} />
  ) : null;

  return { confirm, ConfirmUI };
}

// ─── ColorMaster ──────────────────────────────────────────────────────────────
export default function ColorMaster() {
  const navigate  = useNavigate();
  const inputRefs = useRef([]);
  const toastId   = useRef(0);

  const { confirm, ConfirmUI } = useConfirm();

  // ── Session / permissions (PageName = "Item Master" — same as jQuery) ────────
  const [sess] = useState(() => {
    try {
      const main0       = (getLocal("Mainsetting") || [{}])[0] || {};
      const Comid       = getStr("Comid")    || "1";
      const MComid      = getStr("MComid")   || Comid;
      const IdComList   = getStr("IdComList") || Comid;
      const MirrorTable = getStr("MirrorTableOnline") || "0";
      return {
        Comid:        main0.CommonCompany ? MComid : Comid,
        IdComList,
        MirrorTable,
        // jQuery: menulist.filter(obj => obj.PageName == "Item Master")
        menudata:     (getLocal("menulist") || []).filter(o => o.PageName === "Item Master"),
      };
    } catch {
      return { Comid: "1", IdComList: "1", MirrorTable: "0", menudata: [] };
    }
  });

  const perm = sess.menudata[0] || { View: 1, Add: 1, Edit: 1, Delete: 1 };

  const [grid,    setGrid]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [toasts,  setToasts]  = useState([]);
  const [selIdx,  setSelIdx]  = useState(null);

  // ── Toast (identical to BrandMaster) ──────────────────────────────────────
  const toast = useCallback((msg, isErr = false) => {
    const id = ++toastId.current;
    setToasts(p => [...p, { id, msg, isErr }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  const focusRow = useCallback((idx) => {
    setTimeout(() => inputRefs.current[idx]?.focus(), 50);
  }, []);

  // ColorMaster-specific: field is ColorName
  const makeNewRow = (prefill = "") => ({
    Id: null, ColorName: prefill, Active: true, EditMode: 1, _uid: uid(),
  });

  // ── loadData ────────────────────────────────────────────────────────────────
  // jQuery: url: "/ColorMaster/SelectColorMaster", data: '{"Comid":' + Comid + '}'
  const loadData = useCallback(async () => {
    const prefill = sessionStorage.getItem("masterPrefill") || "";
    setLoading(true);

    const res = await api(
      "/ColorMaster/SelectColorMaster",
      null,
      {},
      { Comid: sess.Comid }
    );

    setLoading(false);

    if (res._http404) { toast("❌ 404 — /ColorMaster/SelectColorMaster not found", true); }
    if (res._netErr)  { toast(`❌ Network: ${res.message}`, true); }

    const rawList = Array.isArray(res.data)  ? res.data
                  : Array.isArray(res.Data1) ? res.Data1
                  : [];

    const existing = rawList.map(r => ({
      ...r,
      Active:   r.Active === true || r.Active === 1,
      EditMode: 0,
      _uid:     uid(),
    }));

    const blank = makeNewRow(prefill);
    setGrid([...existing, blank]);
    setSelIdx(existing.length);
    focusRow(existing.length);
    sessionStorage.removeItem("masterPrefill");
  }, [sess.Comid, focusRow, toast]); // eslint-disable-line

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

  const updateCell = useCallback((idx, field, value) => {
    setGrid(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value, EditMode: 1 } : r));
  }, []);

  // ── deleteRow ────────────────────────────────────────────────────────────────
  // jQuery: Delete key (key === 46) handler with pagedelete permission check
  const deleteRow = useCallback(async (idx) => {
    if (!perm.Delete) { toast("❌ Page Delete Permission Denied !!!", true); return; }
    const row     = grid[idx];
    const isSaved = row.Id != null && row.Id !== 0;

    if (isSaved) {
      // jQuery: MsgBoxYesNo("Wish to Delete the Record " + ColorName + "?")
      const ok = await confirm(`Wish to Delete the Record "${row.ColorName}"?`);
      if (!ok) return;

      setLoading(true);

      // jQuery: url: "/ColorMaster/DeleteColorMaster"
      // data: '{"Id":' + value + ',"Comid":' + Comid + ',"MirrorTable":' + MirrorTable + '}'
      // headers: { 'IdComList': IdComList }
      const res = await api(
        "/ColorMaster/DeleteColorMaster",
        null,
        { "IdComList": String(sess.IdComList) },
        {
          Id:          Number(row.Id),
          Comid:       Number(sess.Comid),
          MirrorTable: Number(sess.MirrorTable),
        }
      );

      setLoading(false);
      if (res._netErr) { toast(`❌ ${res.message}`, true); return; }
      if (res.ok) {
        toast("✅ " + (res.message || "Deleted"));
        setGrid(prev => {
          const next = prev.filter((_, i) => i !== idx);
          const sel  = Math.max(0, next.length - 1);
          setSelIdx(sel); focusRow(sel);
          return next;
        });
      } else { toast(`❌ ${res.message || "Delete failed"}`, true); }
    } else {
      // jQuery: unsaved row — DeleteRow(..., 1) just removes from grid
      setGrid(prev => {
        const next = prev.filter((_, i) => i !== idx);
        const sel  = Math.max(0, next.length - 1);
        setSelIdx(sel); focusRow(sel);
        return next;
      });
    }
  }, [grid, sess, perm, focusRow, toast, confirm]);

  // ── gridemptycheck ───────────────────────────────────────────────────────────
  // jQuery: removes last empty row if rowcount > 1, then validates all EditMode==1 rows
  const gridemptycheck = useCallback((g) => {
    let cleaned = [...g];
    if (cleaned.length > 1 && !String(cleaned[cleaned.length - 1].ColorName || "").trim())
      cleaned = cleaned.slice(0, -1);
    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i].EditMode === 1 && !String(cleaned[i].ColorName || "").trim()) {
        // jQuery: MsgBox("Enter All Color Name in the Grid !!!.")
        toast("❌ Enter All Color Name in the Grid !!!", true);
        setSelIdx(i); focusRow(i);
        return { ok: false, cleaned };
      }
    }
    return { ok: true, cleaned };
  }, [focusRow, toast]);

  // ── hasDuplicate (mirrors jQuery CheckDuplicate on grdColorName) ─────────────
  const hasDuplicate = useCallback((g) => {
    const names = g.filter(r => String(r.ColorName || "").trim())
                   .map(r => String(r.ColorName).trim().toLowerCase());
    return new Set(names).size !== names.length;
  }, []);

  // ── handleSave ───────────────────────────────────────────────────────────────
  // Mirrors jQuery F1 handler exactly — all permission branches preserved
  const handleSave = useCallback(async () => {
    const { ok, cleaned } = gridemptycheck(grid);
    if (!ok) return;
    setGrid(cleaned);

    let dirty = [];
    let flag  = 1;

    // jQuery: permission branching — all four cases
    if (perm.Add === 0 && perm.Edit === 0) {
      toast("❌ Page Add & Update Permission Denied !!!", true); flag = 0;
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

    // jQuery: if flag==0 → Addrowfunc() then return
    if (flag === 0) { addRow(); return; }

    // jQuery: CheckDuplicate(gridColor, grdColorName, "Color Name") == false → return
    if (hasDuplicate(cleaned)) { toast("❌ Duplicate Color Name found !!!", true); return; }

    // jQuery: var str = 'Do you Want to Save the Color Details?'
    const hasNew      = dirty.some(r => r.Id == null || r.Id === 0);
    const hasExisting = dirty.some(r => r.Id != null && r.Id !== 0);

    let confirmMsg = "Do you Want to Save the Color Details?";
    if (hasExisting && !hasNew)  confirmMsg = "Do you Want to Update the Color Details?";
    if (hasExisting && hasNew)   confirmMsg = "Do you Want to Save & Update the Color Details?";

    const proceed = await confirm(confirmMsg);
    if (!proceed) { addRow(); return; }

    setLoading(true);

    // jQuery: url: "/ColorMaster/InsertColorMaster"
    // headers: { 'Comid': Comid, 'MirrorTable': MirrorTable, 'IdComList': IdComList }
    // data: JSON.stringify(getdata)
    const payload = dirty.map(r => ({
      Id:        (r.Id && r.Id !== 0) ? r.Id : null,
      ColorName: String(r.ColorName || "").trim(),
      Active:    r.Active === true ? 1 : 0,
    }));

    const res = await insertapi(
      "/ColorMaster/InsertColorMaster",
      payload,
      {
        "Comid":       String(sess.Comid),
        "MirrorTable": String(sess.MirrorTable),
        "IdComList":   String(sess.IdComList),
      }
    );

    setLoading(false);
    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

    // jQuery: if data.ok → NotificationSuccess + loadModel; else MsgBox
    if (res.ok || res.IsSuccess) {
      toast("✅ " + (res.message || "Saved successfully!"));

      // jQuery: POPStatus == "ON" → set POPValue, close dialog
      const retField = sessionStorage.getItem("masterReturnField");
      if (retField) {
        sessionStorage.setItem("masterReturnValue", String(res.Data2 ?? res.Id ?? ""));
        sessionStorage.setItem("masterReturnName",  dirty[0]?.ColorName || "");
        sessionStorage.removeItem("masterReturnField");
        setTimeout(() => navigate(-1), 800);
      } else {
        await loadData();
      }
    } else {
      toast(`❌ ${res.message || "Save failed"}`, true);
    }
  }, [grid, sess, perm, navigate, loadData, gridemptycheck, hasDuplicate, addRow, toast, confirm]);

  // ── handleEsc (jQuery Esc — "Do You Want To Quit Page?") ───────────────────
  const handleEsc = useCallback(async () => {
    const ok = await confirm("Do You Want To Quit Page?");
    if (!ok) return;
    sessionStorage.removeItem("masterReturnField");
    sessionStorage.removeItem("masterPrefill");
    navigate(-1);
  }, [confirm, navigate]);

  // ── Global keyboard shortcuts: F1 = save, Esc = quit ───────────────────────
  useEffect(() => {
    const onKey = e => {
      if (e.keyCode === 112) { e.preventDefault(); handleSave(); }
      if (e.keyCode === 27)  { e.preventDefault(); handleEsc();  }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleEsc]);

  // ── Per-cell keyboard (Enter = next/add row, Delete = delete row) ────────────
  // Mirrors jQuery gridColor.bind('keydown') for grdColorName column
  const onCellKeyDown = useCallback((e, idx) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // jQuery: if value == null || value == "" → MsgBox("Enter Color Name!!!.")
      if (!String(grid[idx]?.ColorName || "").trim()) {
        toast("❌ Enter Color Name !!!", true);
        return;
      }
      // jQuery: CheckDuplicate then GirdNextCell
      if (hasDuplicate(grid)) { toast("❌ Duplicate Color Name !!!", true); return; }
      if (idx === grid.length - 1) addRow();
      else { setSelIdx(idx + 1); focusRow(idx + 1); }
    }

    // jQuery: key === 46 (Delete) for row deletion
    if (e.key === "Delete" && e.ctrlKey) { e.preventDefault(); deleteRow(idx); }
    if (e.key === "Delete" && !e.ctrlKey && !String(grid[idx]?.ColorName || "").trim()) {
      e.preventDefault(); deleteRow(idx);
    }
  }, [grid, hasDuplicate, addRow, focusRow, deleteRow, toast]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mp-wrap">
      {ConfirmUI}

      {/* <div className="mp-hdr">
        <div className="mp-hdr-left">
          <div className="mp-icon">C</div>
          <div>
            <div className="mp-title">Color Master</div>
            <div className="mp-sub">Co: {sess.Comid} — Manage color records</div>
          </div>
        </div>
        <button className="mp-back" onClick={handleEsc}>← Back</button>
      </div> */}

      <div className="mp-body">
        <div className="mp-toolbar">
          <button className="mp-btn sv" onClick={handleSave} disabled={loading}>💾 F1 Save</button>
          <button className="mp-btn nw" onClick={addRow}     disabled={loading}>➕ Add Row</button>
          <button className="mp-btn dl" onClick={handleEsc}>✕ Esc Cancel</button>

          <div className="mp-title">Color Master</div>
        </div>

        <div className="mp-grid-wrap">
          <table className="mp-tbl">
            <thead>
              <tr>
                <th style={{ width: 50  }}>S.No</th>
                <th style={{ width: 300 }}>Color Name</th>
                <th style={{ width: 72, textAlign: "center" }}>Active</th>
                <th style={{ width: 50  }}></th>
              </tr>
            </thead>
            <tbody>
              {grid.map((row, idx) => (
                <tr
                  key={row._uid}
                  className={[
                    selIdx === idx ? "sel"  : "",
                    !row.Active    ? "inact": "",
                    row.EditMode === 1 ? "mod" : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => { setSelIdx(idx); focusRow(idx); }}
                >
                  <td className="sno">{idx + 1}</td>

                  {/* ColorName column — mirrors jQuery grdColorName, maxLength 50 */}
                  <td>
                    <input
                      ref={el => (inputRefs.current[idx] = el)}
                      className="mp-cell-input"
                      value={row.ColorName || ""}
                      maxLength={50}
                      onChange={e => applyUppercase(e, (val) => updateCell(idx, "ColorName", val))}
                      onKeyDown={e => onCellKeyDown(e, idx)}
                      onFocus={() => setSelIdx(idx)}
                    />
                  </td>

                  {/* Active column — mirrors jQuery checkbox column (grdActive) */}
                  <td style={{ textAlign: "center" }}>
                    <select
                      className="mp-active-sel"
                      value={row.Active ? "1" : "0"}
                      onChange={e => updateCell(idx, "Active", e.target.value === "1")}
                      onFocus={() => setSelIdx(idx)}
                      title={row.Active ? "Active" : "Inactive"}
                    >
                      <option value="1">✓</option>
                      <option value="0">✗</option>
                    </select>
                  </td>

                  <td>
                    <button
                      className="mp-del-btn"
                      onClick={e => { e.stopPropagation(); deleteRow(idx); }}
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {grid.length === 0 && !loading && (
            <div className="mp-empty">No records. Press ➕ to add a color.</div>
          )}
        </div>

        <div className="mp-hint">
          <kbd>Enter</kbd> next row &nbsp;|&nbsp;
          <kbd>Ctrl+Delete</kbd> delete row &nbsp;|&nbsp;
          <kbd>F1</kbd> save &nbsp;|&nbsp;
          <kbd>Esc</kbd> back
        </div>
      </div>

      {loading && (
        <div className="mp-loader-ov">
          <div className="mp-ldr-box">
            <div className="mp-spin" />
            <div className="mp-ldr-msg">Processing…</div>
          </div>
        </div>
      )}

      <div className="toasts">
        {toasts.map(t => (
          <div key={t.id} className={`toast${t.isErr ? " err" : ""}`}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}