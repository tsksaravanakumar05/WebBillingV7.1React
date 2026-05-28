import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./MasterPage.css";
import Topbar from "../components/Topbar";

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
      if (Array.isArray(j)) return { ok: true, data: j };
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
    console.log("RAW RESPONSE:", text);
    try { return JSON.parse(text); }
    catch { return { ok: false, message: text || `HTTP ${res.status}` }; }
  } catch (err) {
    return { ok: false, _netErr: true, message: err.message };
  }
};

const getStr   = (k) => localStorage.getItem(k) || "";
const getLocal = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const uid      = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
const ValNum   = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const NullToString = (v) => (v == null ? "" : String(v));

// ─── Uppercase helper (identical to BrandMaster) ──────────────────────────────
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

// ─── ConfirmModal (identical to BrandMaster) ─────────────────────────────────
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

// Inject keyframe + active-select style once (identical to BrandMaster)
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

// ─── GroupCommission flag ─────────────────────────────────────────────────────
const GROUP_COMMISSION = false;
const MOBILE_NO_LABEL  = GROUP_COMMISSION ? "MobileNo" : "Password";

// ─── Column nav order ─────────────────────────────────────────────────────────
const COL_ORDER = ["Code", "SalesManName", "Commission", "Password", "Active"];

// ─── Request dedup guard ──────────────────────────────────────────────────────
class RequestController {
  constructor() { this._running = false; }
  isRunning()  { return this._running; }
  start()      { this._running = true; }
  end()        { this._running = false; }
}

// ─── SalesManMaster ───────────────────────────────────────────────────────────
export default function SalesManMaster() {
  const navigate   = useNavigate();
  const toastId    = useRef(0);
  const inputRefs  = useRef({});
  const reqFlag    = useRef(new RequestController());
  const grpTarget  = useRef(null);
  const grpSearchRef = useRef(null);

  const { confirm, ConfirmUI } = useConfirm();

  // ── Session ───────────────────────────────────────────────────────────────
  const [sess] = useState(() => {
    try {
      const main0       = (getLocal("Mainsetting") || [{}])[0] || {};
      const Comid       = getStr("Comid")    || "1";
      const MComid      = getStr("MComid")   || Comid;
      const IdComList   = getStr("IdComList") || Comid;
      const MirrorTable = getStr("MirrorTableOnline") || "0";
      return {
        Comid:        main0.CommonCompany ? MComid : Comid,
        MComid,
        IdComList,
        MirrorTable,
        menudata: (getLocal("menulist") || []).filter(o => o.PageName === "Sales Man"),
      };
    } catch {
      return { Comid: "1", MComid: "1", IdComList: "1", MirrorTable: "0", menudata: [] };
    }
  });

  const perm = sess.menudata[0] || { View: 1, Add: 1, Edit: 1, Delete: 1 };

  // ── State ─────────────────────────────────────────────────────────────────
  const [grid,    setGrid]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [toasts,  setToasts]  = useState([]);
  const [selUid,  setSelUid]  = useState(null);

  // Group popup
  const [grpOpen,   setGrpOpen]   = useState(false);
  const [grpRows,   setGrpRows]   = useState([]);
  const [grpSearch, setGrpSearch] = useState("");
  const [grpSelUid, setGrpSelUid] = useState(null);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const toast = useCallback((msg, isErr = false) => {
    const id = ++toastId.current;
    setToasts(p => [...p, { id, msg, isErr }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  // ── Permission guard ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!getLocal("menulist")) {
      alert("Session Close Please Login !!!.");
      window.location.href = "/Login/Index";
      return;
    }
    if (!perm || perm.View === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => { window.location.href = "/Home"; }, 3000);
    }
  }, []); // eslint-disable-line

  // ── Row factory ───────────────────────────────────────────────────────────
  const makeNewRow = useCallback((prefill = "") => ({
    _uid:                       uid(),
    Id:                         null,
    Code:                       "",
    SalesManName:               prefill,
    Commission:                 "0.00",
    Password:                   "1",
    Active:                     true,
    CommisionGroupName:         "",
    CommissionGroupMasterRefid: null,
    EditMode:                   0,
  }), []);

  // ── Focus helper ──────────────────────────────────────────────────────────
  const focusField = useCallback((rowUid, field) => {
    setTimeout(() => {
      const el = inputRefs.current[`${rowUid}_${field}`];
      if (el) { el.focus(); el.select?.(); }
    }, 50);
  }, []);

  // ── loadData ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const prefill = sessionStorage.getItem("masterPrefill") || "";
    setLoading(true);

    const res = await api(
      "/SalesMan/SelectSalesMan",
      null,
      {},
      { Comid: Number(sess.Comid) }
    );
    setLoading(false);

    if (res._http404) { toast("❌ 404 — /SalesMan/SelectSalesMan not found", true); }
    if (res._netErr)  { toast(`❌ Network: ${res.message}`, true); }
    if (!res.ok)      { toast(`❌ ${res.message || "Load failed"}`, true); return; }

    const rawList = Array.isArray(res.data)  ? res.data
                  : Array.isArray(res.Data1) ? res.Data1
                  : [];

    const existing = rawList.map(obj => ({
      _uid:                       uid(),
      Id:                         obj.Id   ?? null,
      Code:                       obj.Code ?? "",
      SalesManName:               obj.SalesManName ?? "",
      Commission:                 parseFloat(obj.Commission ?? 0).toFixed(2),
      Password:                   ValNum(obj.Password).toFixed(0),
      Active:                     obj.Active === true || obj.Active === 1,
      CommisionGroupName:         obj.CommisionGroupName         ?? "",
      CommissionGroupMasterRefid: obj.CommissionGroupMasterRefid ?? null,
      EditMode:                   0,
    }));

    const blank = makeNewRow(prefill);
    const all   = [...existing, blank];
    setGrid(all);
    setSelUid(blank._uid);

    const popVal = sessionStorage.getItem("POPValue");
    if (popVal && popVal !== "") {
      setGrid(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        next[next.length - 1] = { ...last, SalesManName: popVal.toUpperCase(), Code: "", EditMode: 1 };
        return next;
      });
    }

    focusField(blank._uid, "Code");
    sessionStorage.removeItem("masterPrefill");
  }, [sess.Comid, makeNewRow, focusField, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── addRow ────────────────────────────────────────────────────────────────
  const addRow = useCallback(() => {
    setGrid(prev => {
      const blank = makeNewRow();
      const next  = [...prev, blank];
      setSelUid(blank._uid);
      focusField(blank._uid, "Code");
      return next;
    });
  }, [makeNewRow, focusField]);

  // ── updateCell ────────────────────────────────────────────────────────────
  const updateCell = useCallback((rowUid, field, value) => {
    setGrid(prev => prev.map(r =>
      r._uid === rowUid ? { ...r, [field]: value, EditMode: 1 } : r
    ));
  }, []);

  // ── Validation ────────────────────────────────────────────────────────────
  const validateInput = (field, value) => {
    if (field === "Commission") return /^-?\d{0,15}(\.\d{0,2})?$/.test(value);
    if (field === "Password")   return /^\d{0,18}$/.test(value);
    return true;
  };

  // ── Duplicate check ───────────────────────────────────────────────────────
  const hasDuplicate = useCallback((g, field) => {
    const vals = g
      .filter(r => String(r[field] || "").trim() !== "")
      .map(r => String(r[field]).trim().toLowerCase());
    return new Set(vals).size !== vals.length;
  }, []);

  // ── gridemptycheck ────────────────────────────────────────────────────────
  const gridemptycheck = useCallback((currentGrid) => {
    let cleaned = [...currentGrid];
    if (cleaned.length > 1) {
      const last = cleaned[cleaned.length - 1];
      if (!String(last.Code || "").trim()) {
        cleaned = cleaned.slice(0, -1);
        setGrid(cleaned);
      }
    }
    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i].EditMode === 1) {
        if (!String(cleaned[i].Code || "").trim()) {
          toast("❌ Enter All Code in the Grid !!!", true);
          setSelUid(cleaned[i]._uid);
          focusField(cleaned[i]._uid, "Code");
          return { ok: false, cleaned };
        }
        if (!String(cleaned[i].SalesManName || "").trim()) {
          toast("❌ Enter All Sales Man Name in the Grid !!!", true);
          setSelUid(cleaned[i]._uid);
          focusField(cleaned[i]._uid, "SalesManName");
          return { ok: false, cleaned };
        }
      }
    }
    return { ok: true, cleaned };
  }, [focusField, toast]);

  // ── moveToNextCell ────────────────────────────────────────────────────────
  const moveToNextCell = useCallback((rowUid, field, currentGrid) => {
    const idx    = COL_ORDER.indexOf(field);
    const rowIdx = currentGrid.findIndex(r => r._uid === rowUid);

    if (idx !== -1 && idx < COL_ORDER.length - 1) {
      focusField(rowUid, COL_ORDER[idx + 1]);
    } else {
      if (rowIdx < currentGrid.length - 1) {
        focusField(currentGrid[rowIdx + 1]._uid, "Code");
        setSelUid(currentGrid[rowIdx + 1]._uid);
      } else {
        setGrid(prev => {
          const blank = makeNewRow();
          const next  = [...prev, blank];
          setSelUid(blank._uid);
          focusField(blank._uid, "Code");
          return next;
        });
      }
    }
  }, [focusField, makeNewRow]);

  // ── handleSave ────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (reqFlag.current.isRunning()) return;

    if (perm.Add === 0 && perm.Edit === 0) {
      toast("❌ Page Add & Update Permission Denied !!!", true);
      addRow();
      return;
    }

    const { ok, cleaned } = gridemptycheck(grid);
    if (!ok) return;

    let dirty = [];
    let flag  = 1;

    if (perm.Add === 1 && perm.Edit === 1) {
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

    if (hasDuplicate(cleaned, "Code")) {
      toast("❌ Duplicate Code found !!!", true);
      return;
    }

    // Build confirm message matching BrandMaster pattern exactly
    const hasNew      = dirty.some(r => r.Id == null || r.Id === 0);
    const hasExisting = dirty.some(r => r.Id != null && r.Id !== 0);

    let confirmMsg = "Do you want to save the Sales Man details?";
    if (hasExisting && !hasNew) confirmMsg = "Do you want to update the Sales Man details?";
    if (hasExisting && hasNew)  confirmMsg = "Do you want to save & update the Sales Man details?";

    const proceed = await confirm(confirmMsg);
    if (!proceed) { addRow(); return; }

    reqFlag.current.start();
    setLoading(true);

    const payload = dirty.map(r => ({
      Id:                         Number(r.Id || 0),
      SalesManName:               String(r.SalesManName || "").trim(),
      Code:                       String(r.Code || "").trim(),
      Password:                   String(r.Password || "1"),
      CommissionGroupMasterRefid: r.CommissionGroupMasterRefid != null
                                    ? Number(r.CommissionGroupMasterRefid)
                                    : null,
      CommisionGroupName:         String(r.CommisionGroupName || ""),
      Commission:                 Number(r.Commission || 0),
      Active:                     r.Active ? 1 : 0,
    }));

    const res = await insertapi(
      "/SalesMan/InsertSalesMan",
      payload,
      {
        "Comid":       String(sess.Comid),
        "ApiType":     "1",
        "MirrorTable": String(sess.MirrorTable),
        "IdComList":   String(sess.IdComList),
      }
    );

    setLoading(false);
    reqFlag.current.end();

    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

    if (res.ok || res.IsSuccess) {
      toast("✅ " + (res.message || "Saved successfully!"));
      if (sessionStorage.getItem("POPStatus") === "ON") {
        sessionStorage.setItem("POPValue",  String(res.Id   ?? ""));
        sessionStorage.setItem("POPName",   String(res.Name ?? ""));
        sessionStorage.setItem("POPStatus", "OFF");
        setTimeout(() => navigate(-1), 800);
      } else {
        await loadData();
      }
    } else {
      if (res.redis === false) {
        alert("Already Login Another User Please Login Again!!!");
        window.location.href = "/Login";
      } else {
        toast(`❌ ${res.message || "Save failed"}`, true);
      }
    }
  }, [grid, sess, perm, navigate, loadData, gridemptycheck, hasDuplicate, addRow, toast, confirm]);

  // ── deleteRow ─────────────────────────────────────────────────────────────
  const deleteRow = useCallback(async (rowUid) => {
    const row     = grid.find(r => r._uid === rowUid);
    if (!row) return;

    const isSaved = row.Id != null && row.Id !== 0;

    if (isSaved) {
      if (!perm.Delete) { toast("❌ Page Delete Permission Denied !!!", true); return; }

      const ok = await confirm(`Do you want to delete "${row.Code}"?`);
      if (!ok) return;

      setLoading(true);

      const res = await api(
        "/SalesMan/DeleteSalesMan",
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
          const next    = prev.filter(r => r._uid !== rowUid);
          const lastUid = next[next.length - 1]?._uid;
          if (lastUid) { setSelUid(lastUid); focusField(lastUid, "Code"); }
          return next;
        });
      } else {
        if (res.redis === false) {
          alert("Already Login Another User Please Login Again!!!");
          window.location.href = "/Login";
        } else {
          toast(`❌ ${res.message || "Delete failed"}`, true);
        }
      }
    } else {
      // Unsaved row — remove locally without confirm
      setGrid(prev => {
        const next    = prev.filter(r => r._uid !== rowUid);
        const lastUid = next[next.length - 1]?._uid;
        if (lastUid) { setSelUid(lastUid); focusField(lastUid, "Code"); }
        return next;
      });
    }
  }, [grid, sess, perm, focusField, toast, confirm]);

  // ── Group popup ───────────────────────────────────────────────────────────
  const loadGroupData = useCallback(async () => {
    setLoading(true);
    const res = await api("/Group/SelectGroup", { Comid: Number(sess.MComid) });
    setLoading(false);
    if (res.ok && Array.isArray(res.data) && res.data.length) {
      setGrpRows(res.data.map(g => ({ _uid: uid(), GroupName: g.GroupName, Id: g.Id })));
    } else {
      setGrpRows([]);
    }
  }, [sess.MComid]);

  const openGroupPopup = useCallback(async (rowUid, currentGroupName) => {
    grpTarget.current = rowUid;
    setGrpSearch(NullToString(currentGroupName));
    setGrpSelUid(null);
    await loadGroupData();
    setGrpOpen(true);
    setTimeout(() => grpSearchRef.current?.focus(), 200);
  }, [loadGroupData]);

  const filteredGrpRows = grpRows.filter(g =>
    g.GroupName.toLowerCase().includes(grpSearch.toLowerCase())
  );

  const selectGroupItem = useCallback((grpRow) => {
    const rowUid = grpTarget.current;
    setGrid(prev => {
      const next = prev.map(r =>
        r._uid === rowUid
          ? { ...r, CommisionGroupName: grpRow.GroupName, CommissionGroupMasterRefid: grpRow.Id, EditMode: 1 }
          : r
      );
      setTimeout(() => moveToNextCell(rowUid, "CommisionGroupName", next), 30);
      return next;
    });
    setGrpOpen(false);
    setGrpSearch("");
  }, [moveToNextCell]);

  const handleGrpSearchKeyDown = useCallback((e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filteredGrpRows.length > 0) {
        setGrpSelUid(filteredGrpRows[0]._uid);
        setTimeout(() => { document.querySelector(".grp-list-item")?.focus(); }, 30);
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (filteredGrpRows.length > 0) {
        const target = grpSelUid
          ? filteredGrpRows.find(g => g._uid === grpSelUid) ?? filteredGrpRows[0]
          : filteredGrpRows[0];
        selectGroupItem(target);
      }
    }
    if (e.key === "Escape") setGrpOpen(false);
  }, [filteredGrpRows, grpSelUid, selectGroupItem]);

  const handleGrpListKeyDown = useCallback((e, grpRow) => {
    if (e.key === "Enter") { e.preventDefault(); selectGroupItem(grpRow); }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const idx = filteredGrpRows.findIndex(g => g._uid === grpRow._uid);
      if (idx < filteredGrpRows.length - 1) setGrpSelUid(filteredGrpRows[idx + 1]._uid);
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const idx = filteredGrpRows.findIndex(g => g._uid === grpRow._uid);
      if (idx > 0) setGrpSelUid(filteredGrpRows[idx - 1]._uid);
      else grpSearchRef.current?.focus();
    }
    if (e.key === "Escape") setGrpOpen(false);
  }, [filteredGrpRows, selectGroupItem]);

  // ── Cell keyboard ─────────────────────────────────────────────────────────
  const handleKeyDown = useCallback(async (e, rowUid, field) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const row   = grid.find(r => r._uid === rowUid);
      const value = row?.[field];

      if (field === "Code") {
        if (!value || String(value).trim() === "") { toast("❌ Enter Code !!!", true); return; }
        if (hasDuplicate(grid, "Code")) { toast("❌ Duplicate Code found !!!", true); return; }
        moveToNextCell(rowUid, field, grid);
      } else if (field === "SalesManName") {
        if (!value || String(value).trim() === "") { toast("❌ Enter Sales Man Name !!!", true); return; }
        if (hasDuplicate(grid, "SalesManName")) { toast("❌ Duplicate SalesMan Name found !!!", true); return; }
        moveToNextCell(rowUid, field, grid);
      } else if (field === "Commission") {
        if (value == null || value === "") updateCell(rowUid, "Commission", "0.00");
        moveToNextCell(rowUid, field, grid);
      } else if (field === "Password") {
        if (value == null || value === "") updateCell(rowUid, "Password", "1");
        moveToNextCell(rowUid, field, grid);
      } else if (field === "CommisionGroupName") {
        await openGroupPopup(rowUid, row?.CommisionGroupName ?? "");
      } else if (field === "Active") {
        if (value == null || value === "") { updateCell(rowUid, "Active", true); return; }
        addRow();
      } else {
        moveToNextCell(rowUid, field, grid);
      }
    }

    if (e.key === "Delete" && e.shiftKey) {
      e.preventDefault();
      await deleteRow(rowUid);
    }
  }, [grid, toast, hasDuplicate, moveToNextCell, updateCell, openGroupPopup, addRow, deleteRow]);

  // ── ESC / F1 global hotkeys ───────────────────────────────────────────────
  const handleEsc = useCallback(async () => {
    if (sessionStorage.getItem("POPStatus") === "ON") {
      sessionStorage.setItem("POPValue",  "-1");
      sessionStorage.setItem("POPStatus", "OFF");
      navigate(-1);
    } else {
      window.location.href = "/Home";
    }
  }, [navigate]);

  useEffect(() => {
    const onKey = async (e) => {
      if (grpOpen) {
        if (e.keyCode === 27) { e.preventDefault(); setGrpOpen(false); }
        return;
      }
      if (e.keyCode === 112) { e.preventDefault(); handleSave(); }
      if (e.keyCode === 27)  { e.preventDefault(); handleEsc();  }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [grpOpen, handleSave, handleEsc]);

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="mp-wrap">
      {ConfirmUI}
      <Topbar />

      {/* Loader */}
      {loading && (
        <div className="mp-loader-ov">
          <div className="mp-ldr-box">
            <div className="mp-spin" />
            <div className="mp-ldr-msg">Processing…</div>
          </div>
        </div>
      )}

      {/* Group Commission Popup */}
      {grpOpen && (
        <div className="grp-overlay" onClick={() => setGrpOpen(false)}>
          <div className="grp-window" onClick={e => e.stopPropagation()}>
            <div className="grp-win-hdr">
              <span>Group Commission</span>
              <button onClick={() => setGrpOpen(false)}>✕</button>
            </div>
            <div className="grp-win-body">
              <input
                ref={grpSearchRef}
                className="grp-search"
                placeholder="Search"
                value={grpSearch}
                onChange={e => applyUppercase(e, (val) => setGrpSearch(val))}
                onKeyDown={handleGrpSearchKeyDown}
              />
              <div className="grp-list">
                {filteredGrpRows.length === 0 && (
                  <div className="grp-list-item" style={{ color: "#aaa", cursor: "default" }}>
                    No groups found
                  </div>
                )}
                {filteredGrpRows.map(g => (
                  <div
                    key={g._uid}
                    className={`grp-list-item${grpSelUid === g._uid ? " sel" : ""}`}
                    tabIndex={0}
                    onClick={() => selectGroupItem(g)}
                    onKeyDown={e => handleGrpListKeyDown(e, g)}
                    onFocus={() => setGrpSelUid(g._uid)}
                  >
                    {g.GroupName}
                  </div>
                ))}
              </div>
              <div className="grp-hint">
                ↑↓ Navigate &nbsp;|&nbsp; Enter Select &nbsp;|&nbsp; Esc Close
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      {/* <div className="mp-hdr">
        <div className="mp-hdr-left">
          <div className="mp-icon">S</div>
          <div>
            <div className="mp-toolbar-title">Sales Man Master</div>
            <div className="mp-sub">Co: {sess.Comid} — Manage sales man records</div>
          </div>
        </div>
        <button className="mp-back" onClick={handleEsc}>← Back</button>
      </div> */}

      {/* Body */}
      <div className="mp-body">
        <div className="mp-toolbar">
          <button className="mp-btn sv" onClick={handleSave} disabled={loading} title="F1 – Save">
            💾 F1 Save
          </button>
          <button className="mp-btn nw" onClick={addRow} disabled={loading}>
            ➕ Add Row
          </button>
          <button className="mp-btn dl" onClick={handleEsc}>
            ✕ Esc Cancel
          </button>

          <div className="mp-toolbar-title">Sales Man Master</div>
        </div>

        <div className="mp-grid-wrap">
          <table className="mp-tbl">
            <thead>
              <tr>
                <th style={{ width: 50  }}>S.No</th>
                <th style={{ width: 120 }}>Code</th>
                <th style={{ width: 180 }}>SalesMan Name</th>
                <th style={{ width: 120 }}>Commission</th>
                <th style={{ width: 120 }}>{MOBILE_NO_LABEL}</th>
                <th style={{ width: 170 }}>Group Name</th>
                <th style={{ width: 72, textAlign: "center" }}>Active</th>
                <th style={{ width: 50  }}></th>
              </tr>
            </thead>
            <tbody>
              {grid.map((row, idx) => (
                <tr
                  key={row._uid}
                  className={[
                    selUid === row._uid  ? "sel"   : "",
                    !row.Active          ? "inact" : "",
                    row.EditMode === 1   ? "mod"   : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => setSelUid(row._uid)}
                >
                  <td className="sno">{idx + 1}</td>

                  {/* Code — uppercase */}
                  <td>
                    <input
                      ref={el => { if (el) inputRefs.current[`${row._uid}_Code`] = el; }}
                      className="mp-cell-input"
                      type="text"
                      maxLength={50}
                      value={row.Code ?? ""}
                      onChange={e => {
                        if (!validateInput("Code", e.target.value)) return;
                        applyUppercase(e, (val) => updateCell(row._uid, "Code", val));
                      }}
                      onKeyDown={e => handleKeyDown(e, row._uid, "Code")}
                      onFocus={() => setSelUid(row._uid)}
                    />
                  </td>

                  {/* SalesMan Name — uppercase */}
                  <td>
                    <input
                      ref={el => { if (el) inputRefs.current[`${row._uid}_SalesManName`] = el; }}
                      className="mp-cell-input"
                      type="text"
                      maxLength={50}
                      value={row.SalesManName ?? ""}
                      onChange={e => {
                        if (!validateInput("SalesManName", e.target.value)) return;
                        applyUppercase(e, (val) => updateCell(row._uid, "SalesManName", val));
                      }}
                      onKeyDown={e => handleKeyDown(e, row._uid, "SalesManName")}
                      onFocus={() => setSelUid(row._uid)}
                    />
                  </td>

                  {/* Commission — numeric, no uppercase */}
                  <td>
                    <input
                      ref={el => { if (el) inputRefs.current[`${row._uid}_Commission`] = el; }}
                      className="mp-cell-input"
                      type="text"
                      value={row.Commission ?? ""}
                      onChange={e => {
                        if (!validateInput("Commission", e.target.value)) return;
                        updateCell(row._uid, "Commission", e.target.value);
                      }}
                      onKeyDown={e => handleKeyDown(e, row._uid, "Commission")}
                      onFocus={() => setSelUid(row._uid)}
                      style={{ textAlign: "right" }}
                    />
                  </td>

                  {/* Password / MobileNo — numeric, no uppercase */}
                  <td>
                    <input
                      ref={el => { if (el) inputRefs.current[`${row._uid}_Password`] = el; }}
                      className="mp-cell-input"
                      type="text"
                      maxLength={18}
                      value={row.Password ?? ""}
                      onChange={e => {
                        if (!validateInput("Password", e.target.value)) return;
                        updateCell(row._uid, "Password", e.target.value);
                      }}
                      onKeyDown={e => handleKeyDown(e, row._uid, "Password")}
                      onFocus={() => setSelUid(row._uid)}
                      style={{ textAlign: "right" }}
                    />
                  </td>

                  {/* Group Name — read-only popup */}
                  <td>
                    <input
                      ref={el => { if (el) inputRefs.current[`${row._uid}_CommisionGroupName`] = el; }}
                      className="mp-cell-input"
                      type="text"
                      readOnly
                      value={row.CommisionGroupName ?? ""}
                      onKeyDown={e => handleKeyDown(e, row._uid, "CommisionGroupName")}
                      onFocus={() => setSelUid(row._uid)}
                      onClick={async () => {
                        setSelUid(row._uid);
                        await openGroupPopup(row._uid, row.CommisionGroupName);
                      }}
                      style={{ cursor: "pointer" }}
                      placeholder="Click / Enter to select…"
                    />
                  </td>

                  {/* Active — ✓ / ✗ */}
                  <td style={{ textAlign: "center" }}>
                    <select
                      ref={el => { if (el) inputRefs.current[`${row._uid}_Active`] = el; }}
                      className="mp-active-sel"
                      value={row.Active ? "1" : "0"}
                      onChange={e => updateCell(row._uid, "Active", e.target.value === "1")}
                      onKeyDown={e => handleKeyDown(e, row._uid, "Active")}
                      onFocus={() => setSelUid(row._uid)}
                      title={row.Active ? "Active" : "Inactive"}
                    >
                      <option value="1">✓</option>
                      <option value="0">✗</option>
                    </select>
                  </td>

                  {/* Delete */}
                  <td style={{ textAlign: "center" }}>
                    <button
                      className="mp-del-btn"
                      title="Delete row (Shift+Delete)"
                      onClick={e => { e.stopPropagation(); deleteRow(row._uid); }}
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {grid.length === 0 && !loading && (
            <div className="mp-empty">No records. Press ➕ to add a sales man.</div>
          )}
        </div>

        <div className="mp-hint">
          <kbd>Enter</kbd> next cell &nbsp;|&nbsp;
          <kbd>F1</kbd> save &nbsp;|&nbsp;
          <kbd>Esc</kbd> back &nbsp;|&nbsp;
          <kbd>Shift+Delete</kbd> delete row &nbsp;|&nbsp;
          Click <strong>Group Name</strong> to pick group
        </div>
      </div>

      {/* Toasts */}
      <div className="toasts">
        {toasts.map(t => (
          <div key={t.id} className={`toast${t.isErr ? " err" : ""}`}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}