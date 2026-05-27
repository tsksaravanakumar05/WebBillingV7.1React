// ─────────────────────────────────────────────────────────────────────────────
//  TransactionPassword.jsx
//  Transaction Password Master — clean component.
//
//  ALL networking logic lives in Common.jsx:
//    BASE_URL, mkUrl, authHeaders, api(), insertapi(), editPassword()
//
//  This file contains ONLY:
//    • Endpoint name references  (CC.TxnSelectPassword etc.)
//    • Payload preparation
//    • CC.api / CC.insertapi / CC.editPassword call sites
//    • UI state, handlers, and render
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../Utilesstyle/TransactionPassword.css";

import * as CC from "../components/Common";
// Endpoint constants are now centralised in Common.jsx:
//   CC.TxnSelectPassword  →  /api/LoginApp/SelectTransactionPassword
//   CC.TxnUpdatePassword  →  /api/LoginApp/UpdateTransactionPassword
//   CC.TxnEditPassword    →  /api/LoginApp/EditPassword   (used inside CC.editPassword)

// ─── TransactionMaster ────────────────────────────────────────────────────────
export default function TransactionMaster() {
  const navigate  = useNavigate();
  const inputRefs = useRef([]);

  // ── Shared hooks ─────────────────────────────────────────────────────────────
  const { confirm, ConfirmUI } = CC.useConfirm();
  const { toast,   toasts    } = CC.useToast();

  // ── Session / company variables ──────────────────────────────────────────────
  const [sess] = useState(() => CC.buildSession("Transaction Password"));

  // Permission guard
  const perm = sess.menudata[0] || { View: 1, Add: 1, Edit: 1, Delete: 1 };

  // ── Component state ──────────────────────────────────────────────────────────
  const [grid,         setGrid]         = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [selIdx,       setSelIdx]       = useState(null);

  // ── Password verification modal state ────────────────────────────────────────
  // PasswordType: 1 = EditPassword | 0 = FormConfig | 2 = AdminPower
  const [pwdModal,     setPwdModal]     = useState(false);
  const [pwdType,      setPwdType]      = useState(1);
  const [pwdValue,     setPwdValue]     = useState("");
  const [pwdError,     setPwdError]     = useState("");
  const [pageUnlocked, setPageUnlocked] = useState(false);

  const pwdInputRef = useRef(null);

  // ── focusRow ─────────────────────────────────────────────────────────────────
  const focusRow = useCallback((idx) => {
    setTimeout(() => inputRefs.current[idx]?.[0]?.focus(), 50);
  }, []);

  // ── loadData ──────────────────────────────────────────────────────────────────
  // CC.api handles: mkUrl (BASE_URL), authHeaders, JSON.stringify, HTTP errors.
  // This function only prepares the payload and processes the response.
  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await CC.api(
      CC.TxnSelectPassword,
      null,
      {},
      { Comid: Number(sess.Comid) }
    );
    setLoading(false);

    if (!res.ok) {
      toast(`❌ ${res.message || "Failed to load transaction passwords"}`, true);
      return;
    }

    const rawList = Array.isArray(res.data)  ? res.data
                  : Array.isArray(res.Data1) ? res.Data1
                  : [];

    const existing = rawList.map(r => ({
      ...r,
      Id:       r.Id       ?? null,
      UserName: r.UserName || "",
      Password: r.Password || "",
      EditMode: 0,
      _uid:     CC.uid(),
    }));

    setGrid(existing);

    // Focus first Password cell — mirrors jQuery selectcell(0, grdPassword)
    if (existing.length > 0) {
      setSelIdx(0);
      setTimeout(() => inputRefs.current[0]?.[0]?.focus(), 80);
    }
  }, [sess.Comid, toast]);

  // ── updateCell ────────────────────────────────────────────────────────────────
  const updateCell = useCallback((idx, field, value) => {
    setGrid(prev =>
      prev.map((r, i) => i === idx ? { ...r, [field]: value, EditMode: 1 } : r)
    );
  }, []);

  // ── gridemptycheck ────────────────────────────────────────────────────────────
  // All EditMode==1 rows must have a Password value before saving.
  const gridemptycheck = useCallback((g) => {
    for (let i = 0; i < g.length; i++) {
      if (g[i].EditMode === 1 && !String(g[i].Password || "").trim()) {
        toast("❌ Enter All Password in the Grid !!!", true);
        setSelIdx(i);
        setTimeout(() => inputRefs.current[i]?.[0]?.focus(), 50);
        return false;
      }
    }
    return true;
  }, [toast]);

  // ── handleSave ────────────────────────────────────────────────────────────────
  // CC.insertapi handles: mkUrl, authHeaders, JSON.stringify, network errors.
  // This function only prepares the payload and handles the business response.
  const handleSave = useCallback(async () => {
    if (!gridemptycheck(grid)) return;

    // ── Permission check ──────────────────────────────────────────────────────
    let flag = 1;
    const dirty = grid.filter(r => r.EditMode === 1);

    if (perm.Add === 0 && perm.Edit === 0) {
      toast("❌ Page Add & Update Permission Denied !!!", true);
      flag = 0;
    } else if (perm.Add === 1 && perm.Edit === 1) {
      if (!dirty.length) { toast("⚠️ No Data Modified, Cannot Update !!!", true); flag = 0; }
    } else if (perm.Add === 1 && perm.Edit === 0) {
      const newDirty = dirty.filter(r => !r.Id);
      if (!newDirty.length) {
        toast(dirty.length ? "❌ Page Edit Permission Denied !!!" : "⚠️ No Data Modified, Cannot Update !!!", true);
        flag = 0;
      }
    } else if (perm.Edit === 1 && perm.Add === 0) {
      const editDirty = dirty.filter(r => r.Id != null);
      if (!editDirty.length) {
        toast(dirty.length ? "❌ Page Add Permission Denied !!!" : "⚠️ No Data Modified, Cannot Update !!!", true);
        flag = 0;
      }
    }

    if (flag === 0) return;

    // ── Confirm save ──────────────────────────────────────────────────────────
    const proceed = await confirm("Do you Want to Save the Transaction Password Details?");
    if (!proceed) return;

    setLoading(true);

    // Strip React-only fields (_uid, EditMode) — server needs only data fields.
    const payload = grid.map(({ _uid, EditMode, ...serverFields }) => serverFields); // eslint-disable-line no-unused-vars

    // CC.insertapi handles all networking. Extra headers match original jQuery:
    //   headers: { 'Comid': Comid, 'MirrorTable': MirrorTable }
    const res = await CC.insertapi(
      CC.TxnUpdatePassword,            // endpoint constant from Common.jsx
      payload,
      {
        Comid:       String(sess.Comid),
        MirrorTable: String(sess.MirrorTable),
      }
    );

    setLoading(false);

    if (res.ok || res.IsSuccess) {
      toast("✅ " + (res.Message || res.message || "Transaction passwords saved!"));
      await loadData();
    } else {
      toast(`❌ ${res.Message || res.message || "Save failed"}`, true);
    }
  }, [grid, sess, perm, gridemptycheck, confirm, toast, loadData]);

  // ── handleEsc ─────────────────────────────────────────────────────────────────
  const handleEsc = useCallback(async () => {
    const ok = await confirm("Do You Want To Quit Page?");
    if (ok) navigate("/Home");
  }, [confirm, navigate]);

  // ── openPwdModal ──────────────────────────────────────────────────────────────
  // Mirrors jQuery EditPasswordWindow(type)
  const openPwdModal = useCallback((type = 1) => {
    setPwdType(type);
    setPwdValue("");
    setPwdError("");
    setPwdModal(true);
    setTimeout(() => pwdInputRef.current?.focus(), 250);
  }, []);

  // ── submitPwd ─────────────────────────────────────────────────────────────────
  // CC.editPassword() (defined in Common.jsx) handles:
  //   mkUrl, authHeaders, fetch, JSON.stringify, network error catch.
  // This function ONLY: maps pwdType → typeStr, calls CC.editPassword, handles response.
  // ❌ No direct fetch()  ❌ No try/catch  ❌ No BASE_URL  ❌ No Authorization header
  const submitPwd = useCallback(async () => {
    if (!pwdValue.trim()) return;

    const typeMap = { 1: "EditPassword", 0: "FormConfig", 2: "AdminPower" };
    const typeStr = typeMap[pwdType] ?? "EditPassword";

    setLoading(true);

    // CC.editPassword wraps CC.insertapi(CC.TxnEditPassword, payload)
    // — all networking is centralised in Common.jsx
    const res = await CC.editPassword({
      password: pwdValue,
      type:     typeStr,
      Comid:    sess.Comid,
    });

    setLoading(false);

    if (res.ok || res.IsSuccess) {
      setPwdModal(false);
      setPageUnlocked(true);
      // Mirrors jQuery: $('#LockEditWindow').on('close') → methods.loadTransactionpassword()
      await loadData();
    } else {
      setPwdError("Invalid Password !!!.");
      setPwdValue("");
      setTimeout(() => pwdInputRef.current?.focus(), 50);
    }
  }, [pwdValue, pwdType, sess.Comid, loadData]);

  // ── onPwdKeyDown ──────────────────────────────────────────────────────────────
  const onPwdKeyDown = useCallback((e) => {
    if (e.key === "Enter") { e.preventDefault(); submitPwd(); }
  }, [submitPwd]);

  // ── Init on mount ─────────────────────────────────────────────────────────────
  // Mirrors jQuery $(document).ready → methods.init() → EditPasswordWindow(1)
  useEffect(() => {
    if (!sess.menudata.length) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => navigate("/Home"), 3000);
      return;
    }
    if (perm.View === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => navigate("/Home"), 3000);
      return;
    }
    openPwdModal(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Global keyboard shortcuts: F1 = Save | Esc = Quit ────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (pwdModal) {
        if (e.keyCode === 27) e.preventDefault(); // block Esc while password modal open
        return;
      }
      if (e.keyCode === 112) { e.preventDefault(); handleSave(); } // F1
      if (e.keyCode === 27)  { e.preventDefault(); handleEsc();  } // Esc
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pwdModal, handleSave, handleEsc]);

  // ── Row Enter-key navigation ──────────────────────────────────────────────────
  // Mirrors jQuery gridTransactionpw keydown Enter → selectcell(rowindex + 1, grdPassword)
  const onCellKeyDown = useCallback((e, idx) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nextIdx = idx + 1;
      if (nextIdx < grid.length) {
        setSelIdx(nextIdx);
        setTimeout(() => inputRefs.current[nextIdx]?.[0]?.focus(), 30);
      }
    }
  }, [grid.length]);

  // ── Password modal title ──────────────────────────────────────────────────────
  const pwdModalTitle = pwdType === 1 ? "Edit Pwd"
                      : pwdType === 0 ? "Form Pwd"
                      : "Admin Pwd";

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="mp-wrap">

      {/* Confirm Dialog */}
      {ConfirmUI}

      {/* ── Password Lock Modal (mirrors #LockEditWindow jqxWindow) ── */}
      {pwdModal && (
        <div className="mp-modal-ov">
          <div className="mp-pwd-modal" role="dialog" aria-modal="true"
               style={{ minWidth: 200 }}>
            <h3>{pwdModalTitle}</h3>
            {pwdError && (
              <div style={{
                fontSize: 11, color: "#991b1b", background: "#fee2e2",
                border: "1px solid #fca5a5", borderRadius: 4,
                padding: "4px 8px", marginBottom: 8
              }}>
                {pwdError}
              </div>
            )}
            <input
              ref={pwdInputRef}
              type="password"
              className="mp-pwd-input"
              value={pwdValue}
              onChange={e => { setPwdValue(e.target.value); setPwdError(""); }}
              onKeyDown={onPwdKeyDown}
              maxLength={50}
              placeholder="Enter password…"
              style={{ marginBottom: 12, letterSpacing: "3px" }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
              <button
                className="mp-modal-btn yes"
                onClick={submitPwd}
                disabled={loading}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="mp-hdr">
        <div className="mp-hdr-left">
          <div className="mp-icon">T</div>
          <div>
            <div className="mp-title">Transaction Password</div>
            <div className="mp-sub">Co: {sess.Comid} — Manage transaction passwords</div>
          </div>
        </div>
        <button className="mp-back" onClick={handleEsc}>← Back</button>
      </div>

      <div className="mp-body">

        {/* ── Toolbar ── */}
        <div className="mp-toolbar">
          <button
            className="mp-btn sv"
            onClick={handleSave}
            disabled={loading || !pageUnlocked}
          >
            💾 F1 Save
          </button>
          <button className="mp-btn dl" onClick={handleEsc}>✕ Esc Cancel</button>
        </div>

        {/* ── Grid ── */}
        <div className="mp-grid-wrap">
          <table className="mp-tbl">
            <thead>
              <tr>
                <th style={{ width: 50 }}>S.No</th>
                <th style={{ width: 150 }}>Transaction Name</th>
                <th style={{ width: 100 }}>Password</th>
              </tr>
            </thead>
            <tbody>
              {grid.map((row, idx) => (
                <tr
                  key={row._uid}
                  className={[
                    selIdx === idx     ? "sel" : "",
                    row.EditMode === 1 ? "mod" : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => {
                    setSelIdx(idx);
                    setTimeout(() => inputRefs.current[idx]?.[0]?.focus(), 30);
                  }}
                >
                  <td className="sno">{idx + 1}</td>

                  {/* Transaction Name — read-only (mirrors editable: false) */}
                  <td>
                    <input
                      className="mp-cell-input"
                      value={row.UserName || ""}
                      readOnly
                      tabIndex={-1}
                      style={{ background: "#f5f9ff", cursor: "default", color: "#4a5568" }}
                    />
                  </td>

                  {/* Password — editable */}
                  <td>
                    <input
                      ref={el => {
                        if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                        inputRefs.current[idx][0] = el;
                      }}
                      className="mp-cell-input"
                      type="text"
                      value={row.Password || ""}
                      maxLength={50}
                      onChange={e =>
                        CC.applyUppercase(e, val => updateCell(idx, "Password", val))
                      }
                      onKeyDown={e => onCellKeyDown(e, idx)}
                      onFocus={() => setSelIdx(idx)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {grid.length === 0 && !loading && pageUnlocked && (
            <div style={{ padding: "24px", textAlign: "center", color: "#8b99b5", fontSize: 12 }}>
              No transaction password records found.
            </div>
          )}

          {!pageUnlocked && !pwdModal && (
            <div style={{ padding: "24px", textAlign: "center", color: "#8b99b5", fontSize: 12 }}>
              Please verify your password to access this page.
            </div>
          )}
        </div>

        {/* ── Keyboard hint bar ── */}
        <div className="mp-hint">
          <kbd>Enter</kbd> next row &nbsp;|&nbsp;
          <kbd>F1</kbd> save &nbsp;|&nbsp;
          <kbd>Esc</kbd> quit page
        </div>
      </div>

      {/* ── Loading overlay ── */}
      {loading && (
        <div className="mp-loader-ov">
          <div className="mp-ldr-box">
            <div className="mp-spin" />
            <div className="mp-ldr-msg">Processing…</div>
          </div>
        </div>
      )}

      {/* ── Toast notifications ── */}
      <CC.ToastList toasts={toasts} />

    </div>
  );
}