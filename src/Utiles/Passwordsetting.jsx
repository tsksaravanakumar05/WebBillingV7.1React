import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../Utilesstyle/TransactionPassword.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const mkUrl = (path) => (path.startsWith("/") ? path : "/" + path);

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  Userid:        localStorage.getItem("userid")     || "0",
  Profile:       localStorage.getItem("Profile")    || "Admin",
  LoginCheck:    localStorage.getItem("LoginCheck") || "1",
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
      
      // 1. Attempt to parse the response as JSON (even on 500 status)
      let j = {};
      try {
        j = JSON.parse(text);
      } catch {
        // If it's not valid JSON, fallback to generic error handling
        if (!res.ok) {
          return { ok: false, message: text || `Server error ${res.status}` };
        }
        return { ok: false, message: "Invalid JSON response" };
      }
  
      // 2. Normalize the parsed JSON so `handleSave` can easily read it
      if (j.IsSuccess !== undefined && j.ok === undefined) j.ok = j.IsSuccess;
      if (j.Data1 !== undefined && j.data === undefined) j.data = j.Data1;
      if (j.Message !== undefined && j.message === undefined) j.message = j.Message;
  
      // 3. If HTTP status is bad (like 500) but it has a valid backend JSON message
      if (!res.ok) {
        // Return false to prevent "success" actions, pass the custom message to the UI
        return { 
          ok: false, 
          message: j.message || `HTTP Error: ${res.status}` 
        };
      }
  
      return j;
    } catch (err) {
      return { ok: false, message: err.message };
    }
  };



const getStr   = (k) => localStorage.getItem(k) || "";
const getLocal = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36);

// ─── Inject keyframe + shared styles once ────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("psPopInStyle")) {
  const s = document.createElement("style");
  s.id = "psPopInStyle";
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

// ─── Modal styles ─────────────────────────────────────────────────────────────
const mStyles = {
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
  modalBtns:  { display: "flex", gap: "10px", justifyContent: "center" },
  modalBtn:   { padding: "7px 26px", borderRadius: "6px", border: "none", fontSize: "13px", fontWeight: "600", cursor: "pointer", transition: "opacity 0.15s", outline: "none" },
  yesBtn:     { background: "linear-gradient(135deg, #22c55e, #16a34a)", color: "#fff", boxShadow: "0 2px 6px rgba(34,197,94,0.35)" },
  noBtn:      { background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1" },
};

// ─── ConfirmModal ─────────────────────────────────────────────────────────────
function ConfirmModal({ message, onYes, onNo }) {
  const yesBtnRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => yesBtnRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") { e.preventDefault(); onNo(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onNo]);

  return (
    <div style={mStyles.overlay}>
      <div style={mStyles.modal} role="dialog" aria-modal="true">
        <div style={mStyles.modalIcon}>?</div>
        <p style={mStyles.modalMsg}>{message}</p>
        <div style={mStyles.modalBtns}>
          <button ref={yesBtnRef} style={{ ...mStyles.modalBtn, ...mStyles.yesBtn }} onClick={onYes}>✔ Yes</button>
          <button style={{ ...mStyles.modalBtn, ...mStyles.noBtn }} onClick={onNo}>✘ No</button>
        </div>
      </div>
    </div>
  );
}

// ─── PasswordModal — mirrors jQuery LockEditWindow ────────────────────────────
function PasswordModal({ title, onSubmit, onClose }) {
  const [pwd, setPwd] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  const handleKey = (e) => {
    if (e.key === "Enter" && pwd.trim()) {
      onSubmit(pwd.trim());
    }
  };

  return (
    <div style={mStyles.overlay}>
      <div style={{ ...mStyles.modal, minWidth: "200px", maxWidth: "260px" }} role="dialog" aria-modal="true">
        <div className="mp-pwd-modal" style={{ padding: 0, boxShadow: "none" }}>
          <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#1f65de", marginBottom: "12px" }}>{title}</h3>
          <input
            ref={inputRef}
            type="password"
            className="mp-pwd-input"
            value={pwd}
            onChange={e => setPwd(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Enter password"
            autoComplete="off"
          />
          <div style={{ marginTop: "12px", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button
              style={{ ...mStyles.modalBtn, ...mStyles.yesBtn, padding: "5px 16px", fontSize: "12px" }}
              onClick={() => pwd.trim() && onSubmit(pwd.trim())}
            >
              OK
            </button>
            <button
              style={{ ...mStyles.modalBtn, ...mStyles.noBtn, padding: "5px 16px", fontSize: "12px" }}
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── useConfirm hook ──────────────────────────────────────────────────────────
function useConfirm() {
  const [conf, setConf] = useState(null);

  const confirm = useCallback(
    (message) => new Promise((resolve) => setConf({ message, resolve })),
    []
  );
  const handleYes = useCallback(() => { conf?.resolve(true);  setConf(null); }, [conf]);
  const handleNo  = useCallback(() => { conf?.resolve(false); setConf(null); }, [conf]);

  const ConfirmUI = conf
    ? <ConfirmModal message={conf.message} onYes={handleYes} onNo={handleNo} />
    : null;

  return { confirm, ConfirmUI };
}

// ─── PasswordSetting ─────────────────────────────────────────────────────────
export default function PasswordSetting() {
  const navigate = useNavigate();
  const inputRefs = useRef([]);    // refs for UserName inputs
  const pwdRefs   = useRef([]);    // refs for Password inputs
  const toastId   = useRef(0);

  const { confirm, ConfirmUI } = useConfirm();

  // ── Session / permissions ──────────────────────────────────────────────────
  const [sess] = useState(() => {
    try {
      const menulist = getLocal("menulist") || [];
      const menudata = menulist.filter(o => o.PageName === "Login Password");

      if (!menulist.length) {
        alert("Session Close Please Login !!!.");
        window.location.href = "/Login/Index";
        return null;
      }
      if (!menudata.length) {
        alert("Page Access Permission Denied !!!.");
      }

      const main0       = (getLocal("Mainsetting") || [{}])[0] || {};
      const Comid       = getStr("Comid")  || "1";
      const MComid      = getStr("MComid") || Comid;
      const MirrorTable = getStr("MirrorTableOnline") || "0";

      return {
        Comid:        main0.CommonCompany ? MComid : Comid,
        MirrorTable,
        menudata,
      };
    } catch {
      return { Comid: "1", MirrorTable: "0", menudata: [] };
    }
  });

  const perm = sess?.menudata?.[0] || { View: 1, Add: 1, Edit: 1, Delete: 1 };

  // ── Grid state ─────────────────────────────────────────────────────────────
  const [grid,    setGrid]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [toasts,  setToasts]  = useState([]);
  const [selIdx,  setSelIdx]  = useState(null);

  // ── Password-window state (mirrors jQuery LockEditWindow / PasswordType) ───
  const [pwdModal, setPwdModal] = useState(null); // null | { type: 0|1|2 }

  // ── Toast helper ───────────────────────────────────────────────────────────
  const toast = useCallback((msg, isErr = false) => {
    const id = ++toastId.current;
    setToasts(p => [...p, { id, msg, isErr }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  const focusRow = useCallback((idx, field = "user") => {
    setTimeout(() => {
      if (field === "user") inputRefs.current[idx]?.focus();
      else                  pwdRefs.current[idx]?.focus();
    }, 50);
  }, []);

  const makeNewRow = () => ({
    Id: null, UserName: "", Password: "", Priv: false, Active: true,
    EditMode: 1, _uid: uid(),
  });

  // ── loadData — mirrors jQuery loadTransactionpassword ─────────────────────
  const loadData = useCallback(async () => {
    if (!sess) return;
  
    setLoading(true);
  
    const res = await api("/Login/SelectPassword?Comid=" + Number(sess.Comid), {
      method: "POST",
    });
  
    setLoading(false);
  
    if (res._http404) {
      toast("❌ 404 — /Login/SelectPassword not found", true);
    }
  
    if (res._netErr) {
      toast(`❌ Network: ${res.message}`, true);
    }
  
    if (res.ok === false && !res._http404 && !res._netErr) {
      toast(`❌ ${res.message}`, true);
      return;
    }
  
    const rawList = Array.isArray(res.data)
      ? res.data
      : Array.isArray(res.Data1)
      ? res.Data1
      : [];
  
    const existing = rawList.map((r) => ({
      ...r,
      Priv: r.Priv === true || r.Priv === 1,
      Active: r.Active === true || r.Active === 1,
      EditMode: 0,
      _uid: uid(),
    }));
  
    const blank = makeNewRow();
  
    setGrid([...existing, blank]);
    setSelIdx(existing.length);
  
    focusRow(existing.length, "user");
  }, [sess, focusRow, toast]); // eslint-disable-line

  // ── Init — mirrors jQuery methods.init → EditPasswordWindow(1) ────────────
  useEffect(() => {
    // jQuery page load → EditPassword popup open
    setPwdModal({ type: 1 });
  }, []);
  
  
  // ─────────────────────────────────────────────────────────────
  // Password Submit
  // Mirrors:
  // $("#txtEditpassword").keydown(function (e) { if (e.keyCode == 13) })
  // ─────────────────────────────────────────────────────────────
  const handlePwdSubmit = useCallback(async (password) => {
    try {
  
      if (!pwdModal) return;
  
      const typeMap = {
        1: "EditPassword",
        0: "FormConfig",
        2: "AdminPower",
      };
  
      setLoading(true);
  
      // ✅ query string format for ASP.NET WebAPI
      const url =
        `Login/EditPassword` +
        `?password=${encodeURIComponent(password)}` +
        `&type=${encodeURIComponent(typeMap[pwdModal.type])}` +
        `&Comid=${Number(sess?.Comid || 0)}`;
  
      // ✅ GET request because backend expects params directly
      const res = await api(url);
  
      setLoading(false);
  
      const data = res?.data || res;
  
      if (data?.IsSuccess === true) {
  
        setPwdModal(null);
  
        await loadData();
  
      } else {
  
        alert(data?.Message || "Invalid Password !!!.");
  
      }
  
    } catch (err) {
  
      setLoading(false);
  
      console.error(err);
  
      alert("Something went wrong !!!.");
  
    }
  
  }, [pwdModal, sess, loadData]);
  // ─────────────────────────────────────────────────────────────
  // Password Modal Close
  // ─────────────────────────────────────────────────────────────
  const handlePwdClose = useCallback(() => {
  
    setPwdModal(null);
  
    loadData();
  
  }, [loadData]);

  // ── addRow ─────────────────────────────────────────────────────────────────
  const addRow = useCallback(() => {
    setGrid(prev => {
      const next = [...prev, makeNewRow()];
      const idx  = next.length - 1;
      setSelIdx(idx);
      focusRow(idx, "user");
      return next;
    });
  }, [focusRow]); // eslint-disable-line

  const updateCell = useCallback((idx, field, value) => {
    setGrid(prev =>
      prev.map((r, i) =>
        i === idx ? { ...r, [field]: value, EditMode: 1 } : r
      )
    );
  }, []);

  // ── Check duplicate UserName — mirrors jQuery CheckDuplicate ───────────────
  const hasDuplicateUser = useCallback((g) => {
    const names = g
      .filter(r => String(r.UserName || "").trim())
      .map(r => String(r.UserName).trim().toLowerCase());
    return new Set(names).size !== names.length;
  }, []);

  // ── adminCondition — mirrors jQuery methods.admincondition ────────────────
  // Returns false if this is the last active admin (cannot remove)
  const adminCondition = useCallback((g, id) => {
    if (id == null || id === "") return "empty";
    const row = g.find(r => r.Id === id);
    if (!row) return true;
    if (row.Priv === true) {
      const count = g.filter(r => r.Priv === true && r.Active === true).length;
      return count > 1;
    }
    return true;
  }, []);

  // ── activeCheck — mirrors jQuery methods.activecheck ─────────────────────
  const activeCheck = useCallback((g, id, activestatus) => {
    if (id == null || id === "") return "empty";
    const row = g.find(r => r.Id === id);
    if (!row) return true;
    if (row.Priv === true) {
      if (activestatus === true) {
        const count = g.filter(r => r.Active === true && r.Priv === true).length;
        return count > 1;
      }
      return true;
    }
    return true;
  }, []);

  // ── gridemptycheck — mirrors jQuery methods.gridemptycheck ────────────────
  const gridemptycheck = useCallback((g) => {
    let cleaned = [...g];
    const last = cleaned[cleaned.length - 1];
    if (cleaned.length > 1 && !String(last?.UserName || "").trim()) {
      cleaned = cleaned.slice(0, -1);
    }
    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i].EditMode === 1) {
        if (!String(cleaned[i].Password || "").trim()) {
          toast("❌ Enter All Password in the Grid !!!", true);
          setSelIdx(i); focusRow(i, "pwd");
          return { ok: false, cleaned };
        }
        if (!String(cleaned[i].UserName || "").trim()) {
          toast("❌ Enter All Username in the Grid !!!", true);
          setSelIdx(i); focusRow(i, "user");
          return { ok: false, cleaned };
        }
      }
    }
    return { ok: true, cleaned };
  }, [focusRow, toast]);

  // ── deleteRow — mirrors jQuery Delete key (key===46) logic ────────────────
  const deleteRow = useCallback(async (idx) => {
    const row = grid[idx];
    if (!perm.Delete && row.Id != null && row.Id !== 0) {
      toast("❌ Page Delete Permission Denied !!!", true); return;
    }

    if (row.Id != null && row.Id !== 0) {
      // Check at least 1 active admin remains — mirrors jQuery check
      const otherAdmins = grid.filter(
        (r, i) => i !== idx && r.Active === true && r.Priv === true
      );
      if (otherAdmins.length === 0) {
        toast("❌ One Admin Login Details Needed Cannot Delete Details", true);
        return;
      }

      const ok = await confirm(
        `Wish to Delete the Record ${row.UserName}?`
      );
      if (!ok) return;

      setLoading(true);
      const res = await api(
        `/Login/DeletePassword?Id=${row.Id}&Comid=${sess.Comid}&MirrorTable=${sess.MirrorTable}`
      );
      setLoading(false);

      if (res.ok) {
        toast("✅ " + (res.message || "Deleted"));
        setGrid(prev => {
          const next = prev.filter((_, i) => i !== idx);
          const sel  = Math.max(0, next.length - 1);
          setSelIdx(sel); focusRow(sel, "user");
          return next;
        });
      } else {
        toast(`❌ ${res.message || "Delete failed"}`, true);
      }
    } else {
      // Unsaved row — just remove
      setGrid(prev => {
        const next = prev.filter((_, i) => i !== idx);
        const sel  = Math.max(0, next.length - 1);
        setSelIdx(sel); focusRow(sel, "user");
        return next;
      });
    }
  }, [grid, sess, perm, focusRow, toast, confirm]);

  // ── MenuReset — mirrors jQuery F3 handler ─────────────────────────────────
  const menuReset = useCallback(async () => {
    if (selIdx == null) return;
    const row = grid[selIdx];
    if (!row || row.Id == null || row.Id === 0) return;

    const priv = row.Priv === true ? 1 : 0;
    const ok = await confirm("Do you Want to Menu Reset?");
    if (!ok) return;

    setLoading(true);
    const res = await api(
      "/Login/MenuReset",
      { Userid: String(row.Id), Comid: String(sess.Comid), Per: String(priv) }
    );
    setLoading(false);

    if (res.ok) {
      toast("✅ " + (res.message || "Menu Reset Done"));
      await loadData();
    } else {
      toast(`❌ ${res.message || "Menu Reset failed"}`, true);
    }
  }, [selIdx, grid, sess, loadData, toast, confirm]);

  // ── handleSave — mirrors jQuery methods.savefunction ─────────────────────
  const handleSave = useCallback(async () => {
    // Check at least 1 active admin
    const adminRows = grid.filter(r => r.Active === true && r.Priv === true);
    if (adminRows.length === 0) {
      toast("❌ One Admin Login Details Needed Cannot Update Details", true);
      return;
    }

    const { ok, cleaned } = gridemptycheck(grid);
    if (!ok) return;
    setGrid(cleaned);

    let dirty = [];
    let flag  = 1;

    if (perm.Add === 0 && perm.Edit === 0) {
      toast("❌ Page Add & Update Permission Denied !!!", true); flag = 0;
    } else if (perm.Add === 1 && perm.Edit === 1) {
      dirty = cleaned.filter(r => r.EditMode === 1);
    } else if (perm.Add === 1 && perm.Edit === 0) {
      dirty = cleaned.filter(r => r.EditMode === 1 && r.Id == null);
      if (!dirty.length) {
        const any = cleaned.filter(r => r.EditMode === 1);
        if (any.length) { toast("❌ Page Edit Permission Denied !!!", true); flag = 0; }
      }
    } else if (perm.Edit === 1 && perm.Add === 0) {
      dirty = cleaned.filter(r => r.EditMode === 1 && r.Id != null);
      if (!dirty.length) {
        const any = cleaned.filter(r => r.EditMode === 1);
        if (any.length) { toast("❌ Page Add Permission Denied !!!", true); flag = 0; }
      }
    }

    if (flag === 0) { addRow(); return; }

    if (hasDuplicateUser(cleaned)) {
      toast("❌ Duplicate User Name found !!!", true); return;
    }

    if (!dirty.length) return;

    const ok2 = await confirm("Do you Want to Save the Password Setting Details?");
    if (!ok2) { addRow(); return; }

    setLoading(true);
    const payload = dirty.map(r => ({
        Id: r.Id || 0,
      
        UserId: String(r.UserName || "").trim(),
      
        Password: String(r.Password || "").trim(),
      
        Priv: r.Priv ? 1 : 0,
      
        Active: r.Active ? 1 : 0,



      }));

    const res = await insertapi(
      "/Login/InsertPassword",
      payload,
      {
        Comid:       String(sess.Comid),
        MirrorTable: String(sess.MirrorTable),
      }
    );
    setLoading(false);

    if (res.ok || res.IsSuccess) {
      toast("✅ " + (res.message || res.Message || "Saved successfully!"));
      await loadData();
    } else {
      toast(`❌ ${res.message || res.Message || "Save failed"}`, true);
    }
  }, [grid, sess, perm, loadData, gridemptycheck, hasDuplicateUser, addRow, toast, confirm]);

  // ── Keyboard events — mirrors jQuery $(document).on('keydown') ────────────
  const handleEsc = useCallback(async () => {
    const ok = await confirm("Do You Want To Quit Page?");
    if (ok) navigate(-1);
  }, [confirm, navigate]);

  useEffect(() => {
    const onKey = async (e) => {
      // F1 — Save
      if (e.keyCode === 112) { e.preventDefault(); handleSave(); }
      // F3 — Menu Reset
      if (e.keyCode === 114) { e.preventDefault(); menuReset(); }
      // Esc
      if (e.keyCode === 27)  { e.preventDefault(); if (!pwdModal) handleEsc(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleEsc, menuReset, pwdModal]);

  // ── Cell keydown — mirrors jQuery gridPasswordSetting.bind('keydown') ─────
  const onCellKeyDown = useCallback((e, idx, field) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const row = grid[idx];

      if (field === "UserName") {
        if (!String(row?.UserName || "").trim()) {
          toast("❌ Enter UserName !!!", true); return;
        }
        if (hasDuplicateUser(grid)) {
          toast("❌ Duplicate User Name !!!", true); return;
        }
        // Move to Password field
        focusRow(idx, "pwd");
        return;
      }

      // from Password or other fields — move to next row's UserName
      if (idx === grid.length - 1) {
        addRow();
      } else {
        setSelIdx(idx + 1);
        focusRow(idx + 1, "user");
      }
    }

    if (e.key === "Delete" && !String(grid[idx]?.[field] || "").trim()) {
      e.preventDefault(); deleteRow(idx);
    }
  }, [grid, hasDuplicateUser, addRow, focusRow, deleteRow, toast]);

  // ── Checkbox change guards (admin / active) ───────────────────────────────
  const handlePrivChange = useCallback((idx, val) => {
    const row = grid[idx];
    if (!val && row.Id != null) {
      // Removing admin — check if at least 1 admin remains
      const result = adminCondition(grid, row.Id);
      if (result === false) {
        toast("❌ One Admin Login Details Needed Cannot Update Details", true);
        return;
      }
    }
    updateCell(idx, "Priv", val);
  }, [grid, adminCondition, updateCell, toast]);

  const handleActiveChange = useCallback((idx, val) => {
    const row = grid[idx];
    if (!val && row.Id != null) {
      const result = activeCheck(grid, row.Id, val);
      if (result === false) {
        toast("❌ One Admin Login Details Needed Cannot Deactivate", true);
        return;
      }
    }
    updateCell(idx, "Active", val);
  }, [grid, activeCheck, updateCell, toast]);

  // ── Password window title helper ──────────────────────────────────────────
  const pwdTitle = (type) => {
    if (type === 1) return "Edit Pwd";
    if (type === 0) return "Form Pwd";
    if (type === 2) return "Admin Pwd";
    return "Password";
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mp-wrap">
      {ConfirmUI}

      {/* Password Window — mirrors jQuery LockEditWindow */}
      {pwdModal && (
        <PasswordModal
          title={pwdTitle(pwdModal.type)}
          onSubmit={handlePwdSubmit}
          onClose={handlePwdClose}
        />
      )}

      {/* Header */}
      <div className="mp-hdr">
        <div className="mp-hdr-left">
          <div className="mp-icon">P</div>
          <div>
            <div className="mp-title">Password Setting</div>
            <div className="mp-sub">Co: {sess?.Comid} — Manage login credentials</div>
          </div>
        </div>
        <button className="mp-back" onClick={handleEsc}>← Back</button>
      </div>

      {/* Body */}
      <div className="mp-body">

        {/* Toolbar */}
        <div className="mp-toolbar">
          <button className="mp-btn sv" onClick={handleSave} disabled={loading}>💾 F1 Save</button>
          <button className="mp-btn nw" onClick={addRow}     disabled={loading}>➕ Add Row</button>
          <button className="mp-btn info" onClick={menuReset} disabled={loading} title="F3 — Menu Reset for selected row">🔄 F3 Menu Reset</button>
          <button className="mp-btn dl" onClick={handleEsc}>✕ Esc Cancel</button>
        </div>

        {/* Grid */}
        <div className="mp-grid-wrap">
          <table className="mp-tbl">
            <thead>
              <tr>
                <th style={{ width: 50 }}>S.No</th>
                <th style={{ width: 300 }}>Email Id</th>
                <th style={{ width: 140 }}>Password</th>
                <th style={{ width: 120, textAlign: "center" }}>Admin Status</th>
                <th style={{ width: 90,  textAlign: "center" }}>Active</th>
                <th style={{ width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {grid.map((row, idx) => (
                <tr
                  key={row._uid}
                  className={[
                    selIdx === idx    ? "sel"  : "",
                    !row.Active       ? "inact": "",
                    row.EditMode === 1? "mod"  : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => { setSelIdx(idx); focusRow(idx, "user"); }}
                >
                  {/* S.No */}
                  <td className="sno">{idx + 1}</td>

                  {/* UserName (EmailId) */}
                  <td>
                    <input
                      ref={el => (inputRefs.current[idx] = el)}
                      className="mp-cell-input"
                      value={row.UserName || ""}
                      maxLength={200}
                      onChange={e => updateCell(idx, "UserName", e.target.value)}
                      onKeyDown={e => onCellKeyDown(e, idx, "UserName")}
                      onFocus={() => setSelIdx(idx)}
                    />
                  </td>

                  {/* Password */}
                  <td>
                    <input
                      ref={el => (pwdRefs.current[idx] = el)}
                      className="mp-cell-input"
                      type="text"
                      value={row.Password || ""}
                      maxLength={100}
                      onChange={e => updateCell(idx, "Password", e.target.value)}
                      onKeyDown={e => onCellKeyDown(e, idx, "Password")}
                      onFocus={() => setSelIdx(idx)}
                    />
                  </td>

                  {/* Priv (Admin Status) — checkbox */}
                  <td style={{ textAlign: "center" }}>
                    <select
                      className="mp-active-sel"
                      value={row.Priv ? "1" : "0"}
                      onChange={e => handlePrivChange(idx, e.target.value === "1")}
                      onFocus={() => setSelIdx(idx)}
                      title={row.Priv ? "Admin" : "Not Admin"}
                    >
                      <option value="1">✓</option>
                      <option value="0">✗</option>
                    </select>
                  </td>

                  {/* Active — checkbox */}
                  <td style={{ textAlign: "center" }}>
                    <select
                      className="mp-active-sel"
                      value={row.Active ? "1" : "0"}
                      onChange={e => handleActiveChange(idx, e.target.value === "1")}
                      onFocus={() => setSelIdx(idx)}
                      title={row.Active ? "Active" : "Inactive"}
                    >
                      <option value="1">✓</option>
                      <option value="0">✗</option>
                    </select>
                  </td>

                  {/* Delete */}
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
            <div className="mp-empty" style={{ padding: "20px", textAlign: "center", color: "#8b99b5", fontSize: "12px" }}>
              No records. Press ➕ to add a user.
            </div>
          )}
        </div>

        {/* Hint bar */}
        <div className="mp-hint">
          <kbd>Enter</kbd> next field &nbsp;|&nbsp;
          <kbd>F1</kbd> save &nbsp;|&nbsp;
          <kbd>F3</kbd> menu reset &nbsp;|&nbsp;
          <kbd>Delete</kbd> delete row &nbsp;|&nbsp;
          <kbd>Esc</kbd> back
        </div>
      </div>

      {/* Loader overlay */}
      {loading && (
        <div className="mp-loader-ov">
          <div className="mp-ldr-box">
            <div className="mp-spin" />
            <div className="mp-ldr-msg">Processing…</div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      <div className="toasts">
        {toasts.map(t => (
          <div key={t.id} className={`toast${t.isErr ? " err" : ""}`}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}