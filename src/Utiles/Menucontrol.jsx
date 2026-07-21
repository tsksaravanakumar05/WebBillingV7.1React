// ─────────────────────────────────────────────────────────────────────────────
//  Menucontrol.jsx
//  React conversion of Menucontrol.js — same business logic / API calls /
//  validations, rebuilt with the BrandMaster.jsx layout & MasterPage.css look.
//  Uses shared helpers from Common.jsx via wildcard import (CC.*)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle, Check } from "lucide-react";
import "../Master/MasterPage.css";
import "../Utilesstyle/Menucontrolreport.css";

import Topbar from "../components/Topbar";

// ✅ Single wildcard import — all current & future Common exports
import * as CC from "../components/Common";

// ─── Menucontrol ──────────────────────────────────────────────────────────────
export default function Menucontrol() {
  const navigate = useNavigate();

  // ── Shared hooks from Common ─────────────────────────────────────────────
  const { confirm, ConfirmUI } = CC.useConfirm();
  const { toast, toasts } = CC.useToast();

  // ── Session / company variables ──────────────────────────────────────────
  const [sess] = useState(() => CC.buildSession("Master"));

  // Store permissions in state — same as: pageview/pageadd/pageedit/pagedelete
  const [perm, setPerm] = useState({ View: 0, Add: 0, Edit: 0, Delete: 0 });
  const [isAuthorized, setIsAuthorized] = useState(false);

  const redirectIfDualLogin = useCallback((res) => {
    if (res?._dualLogin || res?.redis === false) {
      alert("Already Login Another User Please Login Again!!!");
      navigate("/");
      return true;
    }
    return false;
  }, [navigate]);

  // ── Permission guard — identical flow to the jQuery $(document).ready() ──
  useEffect(() => {
    const menuStr = localStorage.getItem("menulist");

    if (!menuStr) {
      alert("Session Close Please Login !!!.");
      navigate("/Login/Index");
      return;
    }

    const menulist = JSON.parse(menuStr);
    const menudata = menulist.filter((obj) => obj.PageName === "Master");

    if (!menudata || menudata.length === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => { navigate("/Home"); }, 3000);
      return;
    }

    if (menudata[0].View === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => { navigate("/Home"); }, 3000);
      return;
    }

    setPerm({
      View: menudata[0].View,
      Add: menudata[0].Add,
      Edit: menudata[0].Edit,
      Delete: menudata[0].Delete,
    });

    setIsAuthorized(true);
  }, [navigate]);

  // ── Column / field names — mirrors grdFormName, grdAdd, grdEdit, ... ────
  const grdFormName = "FormText";
  const grdAdd = "Addd";
  const grdEdit = "Edit";
  const grdDelete = "Deletee";
  const grdView = "Vieww";
  const grdActive = "Active";
  const grdId = "Id";
  const grdPId = "PId";

  // ── Component state ──────────────────────────────────────────────────────
  const [userList, setUserList] = useState([]);     // cmbUserName source
  const [headingList, setHeadingList] = useState([]); // cmbHeading source
  const [selUserId, setSelUserId] = useState("");
  const [selHeadingId, setSelHeadingId] = useState("");

  const [grid, setGrid] = useState([]);              // grid rows (menu permissions)
  const [loading, setLoading] = useState(false);
  const [selIdx, setSelIdx] = useState(null);

  const headingRef = useRef(null);
  const userRef = useRef(null);
  const gridWrapRef = useRef(null);

  // ── loadUserList — same endpoint/payload as loadUserList() in JS ─────────
  const loadUserList = useCallback(async () => {
    const res = await CC.api(
      CC.SelectUserPassword,
      null,
      {},
      { Comid: Number(sess.Comid) }
    );
    if (redirectIfDualLogin(res)) return;
    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

    const list = Array.isArray(res.data) ? res.data : [];
    setUserList(list);
  }, [sess.Comid, toast, redirectIfDualLogin]);

  useEffect(() => { loadUserList(); }, [loadUserList]);

  // ── loadHeadingList — same endpoint/payload as loadHeadingList() in JS ───
  const loadHeadingList = useCallback(async (id) => {
    const res = await CC.api(
      CC.SelectUserMenuHeading,
      null,
      {MobileApp:0},
      { Id: Number(id) }
    );
    if (redirectIfDualLogin(res)) return [];
    if (res._netErr) { toast(`❌ ${res.message}`, true); return []; }

    return Array.isArray(res.data) ? res.data : [];
  }, [toast, redirectIfDualLogin]);

  // ── loadgrid — sets the grid source, mirrors methods.loadgrid() ──────────
  const loadgrid = useCallback((data) => {
    const rows = (data || []).map((r) => ({ ...r, _uid: CC.uid() }));
    setGrid(rows);
    setSelIdx(rows.length ? 0 : null);
  }, []);

  // ── Clear — mirrors methods.Clear() ───────────────────────────────────────
  const Clear = useCallback(() => {
    setSelHeadingId("");
    setHeadingList([]);
    loadgrid([]);
    setTimeout(() => userRef.current?.focus(), 50);
  }, [loadgrid]);

  useEffect(() => { Clear(); }, []); // eslint-disable-line

  // ── FetchData — mirrors methods.FetchData(userid, username, formname) ────
  const FetchData = useCallback(async (username, formname) => {
    setLoading(true);
    const res = await CC.api(
      CC.SelectUserMenuDetails,
      null,
      {},
      { Id: Number(username), pid: Number(formname) }
    );
    setLoading(false);

    if (redirectIfDualLogin(res)) return;
    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

    const data = res.data;
    if (data && data !== 0) {
      loadgrid(data);
      setTimeout(() => gridWrapRef.current?.focus(), 50);
    } else {
      loadgrid([]);
    }
  }, [loadgrid, toast, redirectIfDualLogin]);

  // ── UserNameEvent — mirrors methods.UserNameEvent() ───────────────────────
  const UserNameEvent = useCallback(async (userId) => {
    if (userId === "" || userId == null) {
      toast("❌ Select UserName!!!", true);
      return;
    }
    setSelUserId(userId);
    setSelHeadingId("");
    const list = await loadHeadingList(userId);
    setHeadingList(list);
    setTimeout(() => headingRef.current?.focus(), 50);
  }, [loadHeadingList, toast]);

  // ── HeadingEvent — mirrors methods.HeadingEvent() ─────────────────────────
  const HeadingEvent = useCallback((headingId) => {
    if (headingId === "" || headingId == null) {
      toast("❌ Select Form Name", true);
      return;
    }
    if (selUserId === "" || selUserId == null) {
      toast("❌ Select UserName", true);
      setTimeout(() => userRef.current?.focus(), 50);
      return;
    }
    FetchData(selUserId, headingId);
  }, [selUserId, FetchData, toast]);

  // ── onUserChange / onHeadingChange — wired to <select> elements ──────────
  const onUserChange = (e) => { UserNameEvent(e.target.value); };
  const onHeadingChange = (e) => {
    setSelHeadingId(e.target.value);
    HeadingEvent(e.target.value);
  };

  // ── Cell value update with 3-state checkbox semantics ─────────────────────
  // Values mirror jqxGrid threestatecheckbox: 1 = checked, null = unchecked,
  // 2 = disabled/locked (cannot be toggled — same as the cellbeginedit1..5 guards)
  const toggleCell = useCallback((idx, field, lockField) => {
    setGrid((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        if (r[lockField] === 2) return r; // locked — identical to cellbeginedit guards
        const current = r[field];
        const next = current === 1 ? null : 1;
        return { ...r, [field]: next };
      })
    );
  }, []);

  // ── F1 Save — mirrors keydown F1 handler + /Login/UpdateMenuList call ────
  const handleSave = useCallback(async () => {
    if (!grid.length) { toast("⚠️ No Data To Update !!!", true); return; }

    let pid = null;
    if (selHeadingId !== "" && selHeadingId != null) {
      pid = selHeadingId;
    }
    if (pid == null) {
      toast("❌ Select Vaild UserName !!!.", true);
      return;
    }

    const proceed = await confirm("Do you Want to Update the Menu Control Details?");
    if (!proceed) return;

    // griddata[0].PId = Pid  — same mutation as the original jQuery code
    const griddata = grid.map((r, i) => (i === 0 ? { ...r, [grdPId]: pid } : r));

    setLoading(true);
    const res = await CC.api(
      CC.UpdateMenuList,
      griddata,
      { Comid: sess.Comid }
    );
    setLoading(false);

    if (redirectIfDualLogin(res)) return;
    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

    if (res.ok) {
      toast("✅ " + (res.message || "Updated"));
      Clear();
    } else {
      toast(`❌ ${res.message || "Update failed"}`, true);
    }
  }, [grid, selHeadingId, sess.Comid, confirm, toast, Clear]);

  // ── Esc — quit page, mirrors keydown Esc handler ──────────────────────────
  const handleEsc = useCallback(async () => {
    const proceed = await confirm("Do You Want To Quit Page?");
    if (proceed) navigate("/Home");
  }, [confirm, navigate]);

  // ── Global keyboard shortcuts: F1 = Save | Esc = Quit ─────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.keyCode === 112) { e.preventDefault(); handleSave(); }
      if (e.keyCode === 27) { e.preventDefault(); handleEsc(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleEsc]);

  // Prevent the page UI from flashing before the redirect happens
  if (!isAuthorized) return null;

  // ── 3-state checkbox renderer ──────────────────────────────────────────────
  const Checkbox3 = ({ value, locked, onToggle }) => (
    <button
      type="button"
      className="mp-3state-chk"
      disabled={locked}
      onClick={onToggle}
      title={locked ? "Locked" : value === 1 ? "Checked" : "Unchecked"}
      style={{
        width: 18, height: 18, borderRadius: 3, cursor: locked ? "not-allowed" : "pointer",
        border: locked ? "1px solid #c7cdd6" : "1px solid #1a56db",
        background: locked ? "#f0f2f5" : value === 1 ? "#1a56db" : "#fff",
        color: "#fff",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 700, opacity: locked ? 0.5 : 1,
        margin: "0 auto",
      }}
    >
      {value === 1 ? <Check size={13} strokeWidth={3} /> : ""}
    </button>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="bm-shell">

      {/* Confirm Dialog — rendered by CC.useConfirm() */}
      {ConfirmUI}

      <Topbar />

      <div className="bm-layout">
        <div className="bm-card">
          <div className="bm-card-header">
            <div className="bm-card-header-title">Menu Control</div>
            <button type="button" className="bm-close-x" aria-label="Close" onClick={handleEsc}>✕</button>
          </div>

          <div className="bm-card-body">
            <div className="bm-report-title">Menu Control</div>

            {/* ── Filter bar: UserName + Heading dropdowns ── */}
            <div style={{
              background: "#fff", border: "1px solid #c7cdd6", borderRadius: 8,
              padding: "10px 14px", display: "flex", gap: 10,
              alignItems: "center", flexWrap: "wrap",
            }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#1a2e4a", whiteSpace: "nowrap" }}>
                User Name
              </label>
              <select
                ref={userRef}
                className="bm-cell-input"
                style={{ width: 220, height: 30 }}
                value={selUserId}
                onChange={onUserChange}
              >
                <option value="">-- Select User --</option>
                {userList.map((u) => (
                  <option key={u.Id} value={u.Id}>{u.UserName}</option>
                ))}
              </select>

              <label style={{ fontSize: 12, fontWeight: 600, color: "#1a2e4a", whiteSpace: "nowrap", marginLeft: 10 }}>
                Form Name
              </label>
              <select
                ref={headingRef}
                className="bm-cell-input"
                style={{ width: 250, height: 30 }}
                value={selHeadingId}
                onChange={onHeadingChange}
              >
                <option value="">-- Select Form --</option>
                {headingList.map((h) => (
                  <option key={h.Id} value={h.Id}>{h.FormText}</option>
                ))}
              </select>
            </div>

            {/* ── Grid ── */}
            <div className="bm-grid-wrap" ref={gridWrapRef} tabIndex={-1}>
              <table className="bm-tbl">
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>S.No</th>
                    <th style={{ width: 250 }}>FormName</th>
                    <th style={{ width: 100, textAlign: "center" }}>Add</th>
                    <th style={{ width: 100, textAlign: "center" }}>Edit</th>
                    <th style={{ width: 100, textAlign: "center" }}>Delete</th>
                    <th style={{ width: 100, textAlign: "center" }}>View/Hide</th>
                    <th style={{ width: 100, textAlign: "center" }}>Active</th>
                  </tr>
                </thead>

                <tbody>
                  {grid.map((row, idx) => (
                    <tr
                      key={row._uid}
                      className={selIdx === idx ? "sel" : ""}
                      onClick={() => setSelIdx(idx)}
                    >
                      <td className="sno">{idx + 1}</td>
                      <td>{row[grdFormName]}</td>

                      <td style={{ textAlign: "center" }}>
                        <Checkbox3
                          value={row[grdAdd]}
                          locked={row[grdAdd] === 2}
                          onToggle={() => toggleCell(idx, grdAdd, grdAdd)}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <Checkbox3
                          value={row[grdEdit]}
                          locked={row[grdEdit] === 2}
                          onToggle={() => toggleCell(idx, grdEdit, grdEdit)}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <Checkbox3
                          value={row[grdDelete]}
                          locked={row[grdDelete] === 2}
                          onToggle={() => toggleCell(idx, grdDelete, grdDelete)}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <Checkbox3
                          value={row[grdView]}
                          locked={row[grdView] === 2}
                          onToggle={() => toggleCell(idx, grdView, grdView)}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <Checkbox3
                          value={row[grdActive]}
                          locked={row[grdActive] === 2}
                          onToggle={() => toggleCell(idx, grdActive, grdActive)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {grid.length === 0 && !loading && (
                <div className="bm-empty">Select a User and Form Name to view menu permissions.</div>
              )}
            </div>

            {/* ── Toolbar ── */}
            <div className="bm-actions">
              <button className="bm-btn bm-btn-primary" onClick={handleSave} disabled={loading}>
                <Save size={16} /> F1 Save
              </button>
              <button className="bm-btn bm-btn-secondary" onClick={handleEsc}>
                <XCircle size={16} /> Esc Quit
              </button>
            </div>

          </div>
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

      {/* ── Toast notifications — CC.useToast + CC.ToastList ── */}
      <CC.ToastList toasts={toasts} />

    </div>
  );
}