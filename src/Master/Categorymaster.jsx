import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./CategoryMaster.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
      body: body !== null ? JSON.stringify(body) : undefined,
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

// ─── Uppercase helper: convert value to uppercase, restore cursor position ────
function applyUppercase(e, onChange) {
  const el    = e.target;
  const start = el.selectionStart;
  const end   = el.selectionEnd;
  const upper = el.value.toUpperCase();
  onChange(upper);
  // Restore cursor after React re-render
  requestAnimationFrame(() => {
    if (el && document.activeElement === el) {
      el.setSelectionRange(start, end);
    }
  });
}

// ─── Shared style injection (once per page load) ──────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("cmActiveSelStyle")) {
  const s = document.createElement("style");
  s.id = "cmActiveSelStyle";
  s.textContent = `
    @keyframes cmPopIn {
      from { transform: scale(0.88); opacity: 0; }
      to   { transform: scale(1);    opacity: 1; }
    }
    .cm-active-sel {
      text-align: center;
      font-size: 16px;
      padding: 2px 4px;
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      background: #f8fafc;
      cursor: pointer;
      width: 62px;
    }
    .cm-active-sel:focus { outline: 2px solid #3b82f6; }
  `;
  document.head.appendChild(s);
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────
function ConfirmModal({ message, onYes, onNo }) {
  const yesBtnRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => yesBtnRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") { e.preventDefault(); onNo(); } };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onNo]);

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.modal} role="dialog" aria-modal="true">
        <div style={modalStyles.icon}>?</div>
        <p style={modalStyles.msg}>{message}</p>
        <div style={modalStyles.btns}>
          <button ref={yesBtnRef} style={{ ...modalStyles.btn, ...modalStyles.yes }} onClick={onYes}>✔ Yes</button>
          <button style={{ ...modalStyles.btn, ...modalStyles.no }}  onClick={onNo}>✘ No</button>
        </div>
      </div>
    </div>
  );
}

const modalStyles = {
  overlay: { position:"fixed", inset:0, background:"rgba(10,20,40,0.55)", backdropFilter:"blur(2px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 },
  modal:   { background:"#fff", borderRadius:"10px", padding:"28px 32px 22px", minWidth:"280px", maxWidth:"360px", textAlign:"center", boxShadow:"0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)", border:"1px solid #e2e8f0", animation:"cmPopIn 0.15s ease" },
  icon:    { width:"40px", height:"40px", borderRadius:"50%", background:"linear-gradient(135deg,#3b82f6,#1d4ed8)", color:"#fff", fontSize:"20px", fontWeight:"700", lineHeight:"40px", margin:"0 auto 14px" },
  msg:     { fontSize:"14px", color:"#1e293b", fontWeight:"500", margin:"0 0 20px", lineHeight:"1.5" },
  btns:    { display:"flex", gap:"10px", justifyContent:"center" },
  btn:     { padding:"7px 26px", borderRadius:"6px", border:"none", fontSize:"13px", fontWeight:"600", cursor:"pointer", outline:"none" },
  yes:     { background:"linear-gradient(135deg,#22c55e,#16a34a)", color:"#fff", boxShadow:"0 2px 6px rgba(34,197,94,0.35)" },
  no:      { background:"#f1f5f9", color:"#475569", border:"1px solid #cbd5e1" },
};

// ─── useConfirm hook ──────────────────────────────────────────────────────────
function useConfirm() {
  const [conf, setConf] = useState(null);
  const confirm = useCallback((message) => new Promise((resolve) => setConf({ message, resolve })), []);
  const handleYes = useCallback(() => { conf?.resolve(true);  setConf(null); }, [conf]);
  const handleNo  = useCallback(() => { conf?.resolve(false); setConf(null); }, [conf]);
  const ConfirmUI = conf ? <ConfirmModal message={conf.message} onYes={handleYes} onNo={handleNo} /> : null;
  return { confirm, ConfirmUI };
}

// ─── CategoryMaster ───────────────────────────────────────────────────────────
export default function CategoryMaster() {
  const navigate  = useNavigate();
  const inputRefs = useRef([]);
  const toastId   = useRef(0);

  const { confirm, ConfirmUI } = useConfirm();

  const [sess] = useState(() => {
    try {
      const main0       = (getLocal("Mainsetting") || [{}])[0] || {};
      const Comid       = getStr("Comid")    || "1";
      const MComid      = getStr("MComid")   || Comid;
      const IdComList   = getStr("IdComList") || Comid;
      const MirrorTable = getStr("MirrorTableOnline") || "0";
      return {
        Comid:    main0.CommonCompany ? MComid : Comid,
        IdComList,
        MirrorTable,
        menudata: (getLocal("menulist") || []).filter(o => o.PageName === "Category"),
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

  const toast = useCallback((msg, isErr = false) => {
    const id = ++toastId.current;
    setToasts(p => [...p, { id, msg, isErr }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  const focusRow = useCallback((idx) => {
    setTimeout(() => inputRefs.current[idx]?.focus(), 50);
  }, []);

  const makeNewRow = (prefill = "") => ({
    Id: null, Cat_Name: prefill, Cat_GST: "0.00", Active: true, EditMode: 1, _uid: uid(),
  });

  // ── loadData ───────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const prefill = sessionStorage.getItem("masterPrefill") || "";
    setLoading(true);
    const res = await api("/Category/SelectCategory", null, {}, { Comid: sess.Comid });
    setLoading(false);

    if (res._http404) { toast("❌ 404 — /Category/SelectCategory not found", true); }
    if (res._netErr)  { toast(`❌ Network: ${res.message}`, true); }

    const rawList = Array.isArray(res.data)  ? res.data
                  : Array.isArray(res.Data1) ? res.Data1
                  : [];

    const existing = rawList.map(r => ({
      ...r,
      Cat_GST:  parseFloat(r.Cat_GST ?? 0).toFixed(2),
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

  const addRow = useCallback(() => {
    setGrid(prev => {
      const next = [...prev, makeNewRow()];
      const idx  = next.length - 1;
      setSelIdx(idx); focusRow(idx);
      return next;
    });
  }, [focusRow]); // eslint-disable-line

  const updateCell = useCallback((idx, field, value) => {
    setGrid(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value, EditMode: 1 } : r));
  }, []);

  // ── deleteRow ──────────────────────────────────────────────────────────────
  const deleteRow = useCallback(async (idx) => {
    if (!perm.Delete) { toast("❌ Page Delete Permission Denied !!!", true); return; }
    const row     = grid[idx];
    const isSaved = row.Id != null && row.Id !== 0;

    if (isSaved) {
      const ok = await confirm(`Do you want to delete "${row.Cat_Name}"?`);
      if (!ok) return;

      setLoading(true);
      const url =
        `/Category/DeleteCategory?Id=${Number(row.Id)}` +
        `&Comid=${Number(sess.Comid)}` +
        `&MirrorTable=${Number(sess.MirrorTable)}`;
      console.log("CATEGORY DELETE URL =", url);
      const res = await api(url, null, { "IdComList": String(sess.IdComList) });
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
      setGrid(prev => {
        const next = prev.filter((_, i) => i !== idx);
        const sel  = Math.max(0, next.length - 1);
        setSelIdx(sel); focusRow(sel);
        return next;
      });
    }
  }, [grid, sess, perm, focusRow, toast, confirm]);

  // ── gridemptycheck ─────────────────────────────────────────────────────────
  const gridemptycheck = useCallback((g) => {
    let cleaned = [...g];
    if (cleaned.length > 1 && !String(cleaned[cleaned.length - 1].Cat_Name || "").trim())
      cleaned = cleaned.slice(0, -1);
    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i].EditMode === 1 && !String(cleaned[i].Cat_Name || "").trim()) {
        toast("❌ Enter All Category in the Grid !!!", true);
        setSelIdx(i); focusRow(i);
        return { ok: false, cleaned };
      }
    }
    return { ok: true, cleaned };
  }, [focusRow, toast]);

  const hasDuplicate = useCallback((g) => {
    const names = g.filter(r => String(r.Cat_Name || "").trim())
                   .map(r => String(r.Cat_Name).trim().toLowerCase());
    return new Set(names).size !== names.length;
  }, []);

  // ── handleSave ─────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const { ok, cleaned } = gridemptycheck(grid);
    if (!ok) return;
    setGrid(cleaned);

    let dirty = [];
    let flag  = 1;

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

    if (flag === 0) { addRow(); return; }
    if (hasDuplicate(cleaned)) { toast("❌ Duplicate Category Name found !!!", true); return; }

    const hasNew      = dirty.some(r => r.Id == null || r.Id === 0);
    const hasExisting = dirty.some(r => r.Id != null && r.Id !== 0);
    let confirmMsg    = "Do you want to save the Category details?";
    if (hasExisting && !hasNew)  confirmMsg = "Do you want to update the Category details?";
    if (hasExisting && hasNew)   confirmMsg = "Do you want to save & update the Category details?";

    const proceed = await confirm(confirmMsg);
    if (!proceed) { addRow(); return; }

    setLoading(true);

    const payload = cleaned
      .filter((r) => r.EditMode === 1)
      .map((r) => ({
        Id:           Number(r.Id || 0),
        Cat_Name:     r.Cat_Name || "",
        Cat_GST:      parseFloat(r.Cat_GST || 0),
        HSNCode:      r.HSNCode || "",
        Cat_Discount: parseFloat(r.Cat_Discount || 0),
        CRMPoint:     parseFloat(r.CRMPoint || 0),
        TouchShow:    Number(r.TouchShow || 0),
        OnlineShow:   Number(r.OnlineShow || 0),
        NStock:       Number(r.NStock || 0),
        Active:       Number(r.Active || 1),
        Bannerimg1:   r.Bannerimg1 || "",
        Bannerimg2:   r.Bannerimg2 || "",
        Bannerimg3:   r.Bannerimg3 || "",
        Bannerimg4:   r.Bannerimg4 || "",
      }));

    console.log("CATEGORY PAYLOAD => ", payload);

    const res = await insertapi(
      "/Category/InsertCategory",
      payload,
      {
        Comid:       String(parseInt(sess.Comid)),
        MirrorTable: String(sess.MirrorTable),
        IdComList:   String(sess.IdComList),
        ApiType:     0,
      }
    );

    console.log("CATEGORY RESPONSE => ", res);

    setLoading(false);
    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

    if (res.IsSuccess) {
      toast("✅ " + (res.message || "Saved successfully!"));
      const retField = sessionStorage.getItem("masterReturnField");
      if (retField) {
        sessionStorage.setItem("masterReturnValue", String(res.Data2 ?? res.Id ?? ""));
        sessionStorage.setItem("masterReturnName",  dirty[0]?.Cat_Name || "");
        sessionStorage.removeItem("masterReturnField");
        setTimeout(() => navigate(-1), 800);
      } else {
        await loadData();
      }
    } else {
      toast(`❌ ${res.message || "Save failed"}`, true);
    }
  }, [grid, sess, perm, navigate, loadData, gridemptycheck, hasDuplicate, addRow, toast, confirm]);

  const handleEsc = useCallback(() => {
    sessionStorage.removeItem("masterReturnField");
    sessionStorage.removeItem("masterPrefill");
    navigate(-1);
  }, [navigate]);

  useEffect(() => {
    const onKey = e => {
      if (e.keyCode === 112) { e.preventDefault(); handleSave(); }
      if (e.keyCode === 27)  { e.preventDefault(); handleEsc();  }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleEsc]);

  const onCellKeyDown = useCallback((e, idx) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!String(grid[idx]?.Cat_Name || "").trim()) { toast("❌ Enter Category Name !!!", true); return; }
      if (hasDuplicate(grid)) { toast("❌ Duplicate Category Name !!!", true); return; }
      if (idx === grid.length - 1) addRow(); else { setSelIdx(idx + 1); focusRow(idx + 1); }
    }
    if (e.key === "Delete" && e.ctrlKey) { e.preventDefault(); deleteRow(idx); }
    if (e.key === "Delete" && !e.ctrlKey && !String(grid[idx]?.Cat_Name || "").trim()) {
      e.preventDefault(); deleteRow(idx);
    }
  }, [grid, hasDuplicate, addRow, focusRow, deleteRow, toast]);

  return (
    <div className="mp-wrap">
      {ConfirmUI}

      <div className="mp-hdr">
        <div className="mp-hdr-left">
          <div className="mp-icon">C</div>
          <div>
            <div className="mp-title">Category Master</div>
            <div className="mp-sub">Co: {sess.Comid} — Manage category records</div>
          </div>
        </div>
        <button className="mp-back" onClick={handleEsc}>← Back</button>
      </div>

      <div className="mp-body">
        <div className="mp-toolbar">
          <button className="mp-btn sv" onClick={handleSave} disabled={loading}>💾 F1 Save</button>
          <button className="mp-btn nw" onClick={addRow}     disabled={loading}>➕ Add Row</button>
          <button className="mp-btn dl" onClick={handleEsc}>✕ Esc Cancel</button>
        </div>

        <div className="mp-grid-wrap">
          <table className="mp-tbl">
            <thead>
              <tr>
                <th style={{ width: 50  }}>S.No</th>
                <th style={{ width: 300 }}>Category Name</th>
                <th style={{ width: 72, textAlign: "center" }}>Active</th>
                <th style={{ width: 50  }}></th>
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
                  onClick={() => { setSelIdx(idx); focusRow(idx); }}
                >
                  <td className="sno">{idx + 1}</td>
                  <td>
                    <input
                      ref={el => (inputRefs.current[idx] = el)}
                      className="mp-cell-input"
                      value={row.Cat_Name || ""}
                      maxLength={100}
                      onChange={e => applyUppercase(e, (val) => updateCell(idx, "Cat_Name", val))}
                      onKeyDown={e => onCellKeyDown(e, idx)}
                      onFocus={() => setSelIdx(idx)}
                    />
                  </td>

                  <td style={{ textAlign: "center" }}>
                    <select
                      className="cm-active-sel"
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
                    <button className="mp-del-btn" onClick={e => { e.stopPropagation(); deleteRow(idx); }}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {grid.length === 0 && !loading && (
            <div className="mp-empty">No records. Press ➕ to add a category.</div>
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