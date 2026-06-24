import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../Utilesstyle/TransactionPassword.css";
import Topbar from "../components/Topbar";
import * as CC from "../Master/Common";


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
    <div className="mp-ov" style={{ zIndex: 99999 }}>
      <div className="mp-modal-box" style={{ width: 280, padding: "20px 24px" }} role="dialog" aria-modal="true">
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "#1f65de", textAlign: "left" }}>🔐 {title}</div>
        <input
          ref={inputRef}
          type="password"
          value={pwd}
          onChange={e => setPwd(e.target.value)}
          onKeyDown={(e) => {
            handleKey(e);
            if (e.key === "Escape") onClose();
          }}
          placeholder="Enter password…"
          autoComplete="off"
          style={{ width: "100%", padding: "6px 10px", border: "1px solid #c5d8f8", borderRadius: 4, fontSize: 13, marginBottom: 14, outline: "none" }}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="mp-btn" onClick={onClose}>Cancel</button>
          <button className="mp-btn sv" onClick={() => pwd.trim() && onSubmit(pwd.trim())}>OK</button>
        </div>
      </div>
    </div>
  );
}

// Removed local useConfirm in favor of CC.useConfirm

// ─── PasswordSetting ─────────────────────────────────────────────────────────
export default function PasswordSetting() {
  const navigate = useNavigate();
  const inputRefs = useRef([]);    // refs for UserName inputs
  const pwdRefs   = useRef([]);    // refs for Password inputs

  const { confirm, ConfirmUI } = CC.useConfirm();
  const { toast, toasts }      = CC.useToast();

  // ── Session / permissions ──────────────────────────────────────────────────
  const [sess] = useState(() => {
    try {
      const menulist = CC.getLocal("menulist") || [];
      const menudata = menulist.filter(o => o.PageName === "Login Password");

      if (!menulist.length) {
        alert("Session Close Please Login !!!.");
        window.location.href = "/Login/Index";
        return null;
      }
      if (!menudata.length) {
        alert("Page Access Permission Denied !!!.");
      }

      const main0       = (CC.getLocal("Mainsetting") || [{}])[0] || {};
      const Comid       = CC.getStr("Comid")  || "1";
      const MComid      = CC.getStr("MComid") || Comid;
      const MirrorTable = CC.getStr("MirrorTableOnline") || "0";

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
  const [selIdx,  setSelIdx]  = useState(null);

  // ── Password-window state (mirrors jQuery LockEditWindow / PasswordType) ───
  const [pwdModal, setPwdModal] = useState(null); // null | { type: 0|1|2 }

  const focusRow = useCallback((idx, field = "user") => {
    setTimeout(() => {
      if (field === "user") inputRefs.current[idx]?.focus();
      else                  pwdRefs.current[idx]?.focus();
    }, 50);
  }, []);

  const makeNewRow = () => ({
    Id: null, UserName: "", Password: "", Priv: false, Active: true,
    EditMode: 1, _uid: CC.uid(),
  });

  // ── loadData — mirrors jQuery loadTransactionpassword ─────────────────────
  const loadData = useCallback(async () => {
    if (!sess) return;
  
    setLoading(true);
  
    const res = await CC.api("/api/loginApp/SelectPassword?Comid=" + Number(sess.Comid), {
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
      _uid: CC.uid(),
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
        `/api/loginApp/EditPassword` +
        `?password=${encodeURIComponent(password)}` +
        `&type=${encodeURIComponent(typeMap[pwdModal.type])}` +
        `&Comid=${Number(sess?.Comid || 0)}`;
  
      // ✅ GET request because backend expects params directly
      const res = await CC.api(url);
  
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
      const res = await CC.api(
        `/api/loginApp/DeletePassword?Id=${row.Id}&Comid=${sess.Comid}&MirrorTable=${sess.MirrorTable}`
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
    const res = await CC.api(
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
const today = new Date().toISOString().slice(0, 10) + "T00:00:00";

const payload = dirty.map(r => ({
    Id: r.Id || 0,
    UserId: String(r.UserName || "").trim(),
    Password: String(r.Password || "").trim(),
    Priv: r.Priv ? 1 : 0,
    Active: r.Active ? 1 : 0,
    Todate: today,
    Trial: r.Trial || 0,
}));

    const res = await CC.insertapi(
      "/api/loginApp/InsertPassword",
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

      {pwdModal && (
        <PasswordModal
          title={pwdTitle(pwdModal.type)}
          onSubmit={handlePwdSubmit}
          onClose={handlePwdClose}
        />
      )}

      {/* Header */}
      <Topbar />
      {/* Body */}
      <div className="mp-body">

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
                      readOnly={row.EditMode === 0}
                      onChange={e => row.EditMode === 1 && updateCell(idx, "UserName", e.target.value)}
                      onKeyDown={e => row.EditMode === 1 && onCellKeyDown(e, idx, "UserName")}
                      onFocus={() => setSelIdx(idx)}
                      style={{
                        background:   row.EditMode === 0 ? "transparent"               : "#fff",
                        border:       row.EditMode === 0 ? "none"                      : "1px solid #93c5fd",
                        cursor:       row.EditMode === 0 ? "default"                   : "text",
                        color:        row.EditMode === 0 ? "var(--color-text-secondary)" : "#1e293b",
                        boxShadow:    row.EditMode === 0 ? "none"                      : "0 0 0 2px rgba(59,130,246,0.15)",
                        borderRadius: row.EditMode === 1 ? "4px"                       : "0",
                        padding:      row.EditMode === 0 ? "0"                         : undefined,
                      }}
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
                      readOnly={row.EditMode === 0}
                      onChange={e => row.EditMode === 1 && updateCell(idx, "Password", e.target.value)}
                      onKeyDown={e => row.EditMode === 1 && onCellKeyDown(e, idx, "Password")}
                      onFocus={() => setSelIdx(idx)}
                      style={{
                        background:   row.EditMode === 0 ? "transparent"               : "#fff",
                        border:       row.EditMode === 0 ? "none"                      : "1px solid #93c5fd",
                        cursor:       row.EditMode === 0 ? "default"                   : "text",
                        color:        row.EditMode === 0 ? "var(--color-text-secondary)" : "#1e293b",
                        boxShadow:    row.EditMode === 0 ? "none"                      : "0 0 0 2px rgba(59,130,246,0.15)",
                        borderRadius: row.EditMode === 1 ? "4px"                       : "0",
                        padding:      row.EditMode === 0 ? "0"                         : undefined,
                      }}
                    />
                  </td>

                  {/* Priv (Admin Status) — toggle */}
                  <td style={{ textAlign: "center" }}>
                    <button
                      onClick={() => row.EditMode === 1 && handlePrivChange(idx, !row.Priv)}
                      onFocus={() => setSelIdx(idx)}
                      title={row.Priv ? "Admin" : "Not Admin"}
                      style={{
                        width: 32, height: 18, borderRadius: 9, border: "none", cursor: row.EditMode === 0 ? "default" : "pointer",
                        background: row.Priv ? "#16a34a" : "#cbd5e1",
                        position: "relative", transition: "background 0.18s ease", outline: "none",
                        display: "inline-flex", alignItems: "center", flexShrink: 0, padding: 0,
                        boxShadow: row.Priv ? "inset 0 0 0 1px #15803d" : "inset 0 0 0 1px #b0bec5",
                        opacity: row.EditMode === 0 ? 0.5 : 1,
                        pointerEvents: row.EditMode === 0 ? "none" : "auto",
                      }}
                    >
                      <span style={{
                        position: "absolute", top: 3, left: row.Priv ? 15 : 3,
                        width: 12, height: 12, borderRadius: "50%", background: "#fff",
                        transition: "left 0.18s ease",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
                        display: "block",
                      }} />
                    </button>
                  </td>

                  {/* Active — toggle */}
                  <td style={{ textAlign: "center" }}>
                    <button
                      onClick={() => row.EditMode === 1 && handleActiveChange(idx, !row.Active)}
                      onFocus={() => setSelIdx(idx)}
                      title={row.Active ? "Active" : "Inactive"}
                      style={{
                        width: 32, height: 18, borderRadius: 9, border: "none", cursor: row.EditMode === 0 ? "default" : "pointer",
                        background: row.Active ? "#16a34a" : "#cbd5e1",
                        position: "relative", transition: "background 0.18s ease", outline: "none",
                        display: "inline-flex", alignItems: "center", flexShrink: 0, padding: 0,
                        boxShadow: row.Active ? "inset 0 0 0 1px #15803d" : "inset 0 0 0 1px #b0bec5",
                        opacity: row.EditMode === 0 ? 0.5 : 1,
                        pointerEvents: row.EditMode === 0 ? "none" : "auto",
                      }}
                    >
                      <span style={{
                        position: "absolute", top: 3, left: row.Active ? 15 : 3,
                        width: 12, height: 12, borderRadius: "50%", background: "#fff",
                        transition: "left 0.18s ease",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
                        display: "block",
                      }} />
                    </button>
                  </td>

                  {/* Delete */}
                  <td style={{ whiteSpace: "nowrap" }}>
                    {row.Id && row.EditMode === 0 && (
                      <button
                        className="mp-edit-btn"
                        title="Edit row"
                        onClick={e => { e.stopPropagation(); updateCell(idx, "EditMode", 1); focusRow(idx, "user"); }}
                      >
                        ✏️
                      </button>
                    )}
                    {row.Id && row.EditMode === 1 && (
                      <button
                        className="mp-edit-btn active"
                        title="Editing…"
                        style={{ color: "#16a34a", cursor: "default" }}
                      >
                        ✏️
                      </button>
                    )}
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

        {/* Toolbar */}
        <div className="mp-toolbar">
          <button className="mp-btn sv" onClick={handleSave} disabled={loading}>💾 F1 Save</button>
          <button className="mp-btn nw" onClick={addRow}     disabled={loading}>➕ Add Row</button>
          <button className="mp-btn info" onClick={menuReset} disabled={loading} title="F3 — Menu Reset for selected row">🔄 F3 Menu Reset</button>
          <button className="mp-btn dl" onClick={handleEsc}>✕ Esc Cancel</button>
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
      <CC.ToastList toasts={toasts} />
    </div>
  );
}