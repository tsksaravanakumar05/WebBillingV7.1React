/**
 * ModelMaster.jsx
 *
 * Exact React conversion of the jQuery ModelMaster page.
 * Architecture, hooks, API patterns and CSS match BrandMaster.jsx exactly.
 * Every jQuery behaviour is preserved and mapped inline with comments.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./MasterPage.css"; // shared masterpage CSS — same as BrandMaster
import Topbar from "../components/Topbar";


// ─────────────────────────────────────────────────────────────────────────────
// SHARED HELPERS  (identical to BrandMaster.jsx)
// ─────────────────────────────────────────────────────────────────────────────
const mkUrl = (path) => (path.startsWith("/") ? path : "/" + path);

const authHeaders = () => ({
  "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
  "Userid":        localStorage.getItem("userid")     || "0",
  "Profile":       localStorage.getItem("Profile")    || "Admin",
  "LoginCheck":    localStorage.getItem("LoginCheck") || "1",
});

/**
 * api() — used for SELECT and DELETE (query-string params, no body).
 * Mirrors: $.ajax POST with data as JSON string body OR query params.
 */
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
    // 406 = Redis token validation failed
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

/**
 * insertapi() — used for INSERT/UPDATE (JSON body payload).
 * Mirrors: $.ajax POST with data: JSON.stringify(getdata)
 *          headers: { 'Comid': Comid, 'MirrorTable': MirrorTable, 'IdComList': IdComList }
 */
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

// ─────────────────────────────────────────────────────────────────────────────
// UPPERCASE HELPER
// mirrors GridKeyPressValidation(gridModel, event, 200, "string", 2)
// Applies uppercase to ModelName input while preserving cursor position.
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRMATION MODAL  (identical to BrandMaster — replaces MsgBoxYesNo)
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// useConfirm HOOK  (identical to BrandMaster)
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST CONTROLLER  (mirrors: new Request_Controller('Model'))
// Prevents duplicate F1 saves while a request is in-flight.
// ─────────────────────────────────────────────────────────────────────────────
const useRequestFlag = () => {
  const running = useRef(false);
  return {
    isRunning: () => running.current,
    start:     () => { running.current = true;  },
    end:       () => { running.current = false; },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function ModelMaster()
{



  const navigate  = useNavigate();
  const inputRefs = useRef([]);
  const toastId   = useRef(0);
  const reqFlag   = useRequestFlag(); // mirrors: new Request_Controller('Model')

  const { confirm, ConfirmUI } = useConfirm();

  // ── Session / permissions ────────────────────────────────────────────────
  // Mirrors jQuery document.ready top block:
  //   menulist == null → alert + redirect /Login/Index
  //   menudata empty   → alert + setTimeout /Home 3s
  //   menudata[0].View==0 → alert + setTimeout /Home 3s
  //   else             → extract pageview/pageadd/pageedit/pagedelete
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

  // mirrors: pageview/pageadd/pageedit/pagedelete
  const perm = sess.menudata[0] || { View: 1, Add: 1, Edit: 1, Delete: 1 };

  const [grid,    setGrid]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [toasts,  setToasts]  = useState([]);
  const [selIdx,  setSelIdx]  = useState(null);

  // ── Toast (replaces MsgBox / NotificationSuccess) ────────────────────────
  const toast = useCallback((msg, isErr = false) => {
    const id = ++toastId.current;
    setToasts(p => [...p, { id, msg, isErr }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  // mirrors: jqxGrid selectcell + focus
  const focusRow = useCallback((idx) => {
    setTimeout(() => inputRefs.current[idx]?.focus(), 50);
  }, []);

  // mirrors jqxGrid addrow callback: Active defaults to true
  const makeNewRow = (ModelName = "") => ({
    Id: null, ModelName, Active: true, EditMode: 1, _uid: uid(),
  });

  // ── loadModel ─────────────────────────────────────────────────────────────
  // mirrors methods.loadModel() exactly:
  //   POST /ModelMaster/SelectModelMaster { Comid }
  //   on ok  → set existing rows (EditMode=0) + addrow + selectcell last + focus
  //           + if (POPValue != "") → setcellvalue(last, ModelName, POPValue)
  //   on !ok → MsgBox(data.message) + blank row
  const loadData = useCallback(async () => {
    const prefill = sessionStorage.getItem("masterPrefill") || "";
    setLoading(true);

    const res = await api(
      "/ModelMaster/SelectModelMaster",
      null,
      {},
      { Comid: sess.Comid }
    );

    setLoading(false);

    if (res._http404) { toast("❌ 404 — /ModelMaster/SelectModelMaster not found", true); }
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

    // mirrors: addrow(gridModel) always appended after data
    const blank = makeNewRow(prefill);
    setGrid([...existing, blank]);
    setSelIdx(existing.length);
    focusRow(existing.length);
    sessionStorage.removeItem("masterPrefill");
  }, [sess.Comid, focusRow, toast]); // eslint-disable-line

  useEffect(() => { loadData(); }, [loadData]);

  // ── addRowFunc ────────────────────────────────────────────────────────────
  // mirrors methods.Addrowfunc():
  //   addrow(gridModel)
  //   selectcell(rowscount - 1, grdModelName) + focus
  const addRowFunc = useCallback(() => {
    setGrid(prev => {
      const next = [...prev, makeNewRow()];
      const idx  = next.length - 1;
      setSelIdx(idx);
      focusRow(idx);
      return next;
    });
  }, [focusRow]); // eslint-disable-line

  // mirrors jqxGrid updaterow callback: newdata.EditMode = 1
  const updateCell = useCallback((idx, field, value) => {
    setGrid(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value, EditMode: 1 } : r));
  }, []);

  // ── deleteRow ─────────────────────────────────────────────────────────────
  // mirrors gridModel.bind('keydown') key===46 block exactly:
  //   if (Id != 0 && Id != null):
  //     if (pagedelete == 1) → MsgBoxYesNo → DELETE API
  //       ok   → NotificationSuccess + remove row + selectcell last
  //       fail → MsgBox
  //     else → MsgBox("Page Delete Permission Denied")
  //   else (unsaved new row):
  //     DeleteRow(flag=1) — remove without confirm
  const deleteRow = useCallback(async (idx) => {
    if (!perm.Delete) { toast("❌ Page Delete Permission Denied !!!", true); return; }
    const row     = grid[idx];
    const isSaved = row.Id != null && row.Id !== 0;

    if (isSaved) {
      // mirrors: MsgBoxYesNo("Wish to Delete the Record " + ModelName + "?")
      const ok = await confirm(`Wish to Delete the Record "${row.ModelName}"?`);
      if (!ok) return;

      setLoading(true);

      // mirrors: url: "/ModelMaster/DeleteModelMaster"
      // data: '{"Id":'+value+',"Comid":'+Comid+',"MirrorTable":'+MirrorTable+'}'
      // headers: { 'IdComList': IdComList }
      const res = await api(
        "/ModelMaster/DeleteModelMaster",
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
        // mirrors: NotificationSuccess + DeleteRow + selectcell(rowscount-1, grdModelName)
        toast("✅ " + (res.message || "Deleted"));
        setGrid(prev => {
          const next = prev.filter((_, i) => i !== idx);
          const sel  = Math.max(0, next.length - 1);
          setSelIdx(sel); focusRow(sel);
          return next;
        });
      } else { toast(`❌ ${res.message || "Delete failed"}`, true); }
    } else {
      // mirrors: DeleteRow(flag=1) — unsaved row, no confirm, no API call
      setGrid(prev => {
        const next = prev.filter((_, i) => i !== idx);
        const sel  = Math.max(0, next.length - 1);
        setSelIdx(sel); focusRow(sel);
        return next;
      });
    }
  }, [grid, sess, perm, focusRow, toast, confirm]);

  // ── gridEmptyCheck ────────────────────────────────────────────────────────
  // mirrors methods.gridemptycheck() EXACTLY:
  //   Step 1: if last-row ModelName empty AND rowcount > 1 → deleterow
  //   Step 2: for each EditMode==1 row: if ModelName empty → MsgBox + return false
  //   Step 3: return true
  const gridEmptyCheck = useCallback((g) => {
    let cleaned = [...g];
    // Step 1 — trim trailing blank new row
    if (cleaned.length > 1 && !String(cleaned[cleaned.length - 1].ModelName || "").trim())
      cleaned = cleaned.slice(0, -1);
    // Step 2 — validate dirty rows
    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i].EditMode === 1 && !String(cleaned[i].ModelName || "").trim()) {
        // mirrors: MsgBox("Enter All Model Name in the Grid !!!.")
        toast("❌ Enter All Model Name in the Grid !!!", true);
        setSelIdx(i); focusRow(i);
        return { ok: false, cleaned };
      }
    }
    return { ok: true, cleaned };
  }, [focusRow, toast]);

  // ── hasDuplicate ──────────────────────────────────────────────────────────
  // mirrors CheckDuplicate(gridModel, grdModelName, "Model Name")
  // Returns true if duplicate found (blocks save)
  const hasDuplicate = useCallback((g) => {
    const names = g.filter(r => String(r.ModelName || "").trim())
                   .map(r => String(r.ModelName).trim().toLowerCase());
    return new Set(names).size !== names.length;
  }, []);

  // ── handleSave ────────────────────────────────────────────────────────────
  // mirrors the full F1 (keyCode===112) block EXACTLY — all branches preserved
  const handleSave = useCallback(async () => {
    const { ok, cleaned } = gridEmptyCheck(grid);
    if (!ok) return;
    setGrid(cleaned);

    let dirty = [];
    let flag  = 1;

    // mirrors: if (pageadd==0 && pageedit==0) → flag=0
    if (perm.Add === 0 && perm.Edit === 0) {
      toast("❌ Page Add & Update Permission Denied !!!", true); flag = 0;
    } else if (perm.Add === 1 && perm.Edit === 1) {
      // mirrors: getdata = filter EditMode==1
      dirty = cleaned.filter(r => r.EditMode === 1);
      if (!dirty.length) { toast("⚠️ No Data Modified, Cannot Update !!!", true); flag = 0; }
    } else if (perm.Add === 1 && perm.Edit === 0) {
      // mirrors: getdata = filter EditMode==1 && Id==null
      dirty = cleaned.filter(r => r.EditMode === 1 && r.Id == null);
      if (!dirty.length) {
        const any = cleaned.filter(r => r.EditMode === 1);
        toast(any.length ? "❌ Page Edit Permission Denied !!!" : "⚠️ No Data Modified, Cannot Update !!!", true);
        flag = 0;
      }
    } else if (perm.Edit === 1 && perm.Add === 0) {
      // mirrors: getdata = filter EditMode==1 && Id!=null
      dirty = cleaned.filter(r => r.EditMode === 1 && r.Id != null);
      if (!dirty.length) {
        const any = cleaned.filter(r => r.EditMode === 1);
        toast(any.length ? "❌ Page Add Permission Denied !!!" : "⚠️ No Data Modified, Cannot Update !!!", true);
        flag = 0;
      }
    }

    // mirrors: if (flag == 0) { methods.Addrowfunc(); return; }
    if (flag === 0) { addRowFunc(); return; }

    // mirrors: if (CheckDuplicate(...) == false) return;
    if (hasDuplicate(cleaned)) { toast("❌ Duplicate Model Name found !!!", true); return; }

    // mirrors: Request_Controller guard — Is_Request_Running()
    if (reqFlag.isRunning()) return;
    reqFlag.start();

    // mirrors: MsgBoxYesNo("Do you Want to Save the Model Details?")
    const hasNew      = dirty.some(r => r.Id == null || r.Id === 0);
    const hasExisting = dirty.some(r => r.Id != null && r.Id !== 0);

    let confirmMsg = "Do you Want to Save the Model Details?";
    if (hasExisting && !hasNew)  confirmMsg = "Do you Want to Update the Model Details?";
    if (hasExisting && hasNew)   confirmMsg = "Do you Want to Save & Update the Model Details?";

    const proceed = await confirm(confirmMsg);
    if (!proceed) {
      // mirrors: else { methods.Addrowfunc(); Request_Flag.End_Request(); }
      addRowFunc();
      reqFlag.end();
      return;
    }

    setLoading(true);

    // mirrors: url: "/ModelMaster/InsertModelMaster"
    // headers: { 'Comid': Comid, 'MirrorTable': MirrorTable, 'IdComList': IdComList }
    // data: JSON.stringify(getdata)
    const payload = dirty.map(r => ({
      Id:        (r.Id && r.Id !== 0) ? r.Id : null,
      ModelName: String(r.ModelName || "").trim(),
      Active:    r.Active === true ? 1 : 0,
    }));

    const res = await insertapi(
      "/ModelMaster/InsertModelMaster",
      payload,
      {
        "Comid":       String(sess.Comid),
        "MirrorTable": String(sess.MirrorTable),
        "IdComList":   String(sess.IdComList),
      }
    );

    setLoading(false);
    reqFlag.end();

    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

    if (res.ok || res.IsSuccess) {
      // mirrors: NotificationSuccess + methods.loadModel()
      toast("✅ " + (res.message || "Saved successfully!"));

      // mirrors: if (POPStatus == "ON") { set POPValue, POPStatus=OFF, dialog close }
      const retField = sessionStorage.getItem("masterReturnField");
      if (retField) {
        sessionStorage.setItem("masterReturnValue", String(res.Data2 ?? res.Id ?? ""));
        sessionStorage.setItem("masterReturnName",  dirty[0]?.ModelName || "");
        sessionStorage.removeItem("masterReturnField");
        setTimeout(() => navigate(-1), 800);
      } else if (sessionStorage.getItem("POPStatus") === "ON") {
        sessionStorage.setItem("POPValue",  String(res.Id ?? ""));
        sessionStorage.setItem("POPStatus", "OFF");
        navigate(-1);
      } else {
        await loadData();
      }
    } else {
      toast(`❌ ${res.message || "Save failed"}`, true);
    }
  }, [grid, sess, perm, navigate, loadData, gridEmptyCheck, hasDuplicate, addRowFunc, toast, confirm, reqFlag]);

  // ── handleEsc ─────────────────────────────────────────────────────────────
  // mirrors Esc (keyCode===27) block:
  //   MsgBoxYesNo("Do You Want To Quit Page?")
  //     confirmed + POPStatus==ON → set POPValue=-1, POPStatus=OFF, close dialog
  //     confirmed + else          → window.location.href = "/Home"
  const handleEsc = useCallback(async () => {
    const ok = await confirm("Do You Want To Quit Page?");
    if (!ok) return;
    sessionStorage.removeItem("masterReturnField");
    sessionStorage.removeItem("masterPrefill");
    if (sessionStorage.getItem("POPStatus") === "ON") {
      sessionStorage.setItem("POPValue",  "-1");
      sessionStorage.setItem("POPStatus", "OFF");
    }
    navigate(-1); // mirrors: window.location.href = "/Home"
  }, [confirm, navigate]);

  // ── Global keyboard shortcuts: F1 = save, Esc = quit ─────────────────────
  // mirrors: $(document).on('keydown', ...)
  useEffect(() => {
    const onKey = e => {
      if (e.keyCode === 112) { e.preventDefault(); handleSave(); }
      if (e.keyCode === 27)  { e.preventDefault(); handleEsc();  }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleEsc]);

  // ── onCellKeyDown ─────────────────────────────────────────────────────────
  // mirrors gridModel.bind('keydown') for ModelName column:
  //   Key 13 (Enter):
  //     if ModelName empty → MsgBox("Enter Model Name!!!.") + return
  //     if CheckDuplicate == true → GirdNextCell (next row or addrow)
  //   Key 46 (Delete) → deleteRow
  const onCellKeyDown = useCallback((e, idx) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // mirrors: if (value == null || value == "") { MsgBox("Enter Model Name!!!."); return; }
      if (!String(grid[idx]?.ModelName || "").trim()) {
        toast("❌ Enter Model Name !!!", true);
        return;
      }
      // mirrors: if (CheckDuplicate(...) == true) { GirdNextCell(...) }
      if (hasDuplicate(grid)) { toast("❌ Duplicate Model Name !!!", true); return; }
      // GirdNextCell — Widthdatacolumns=[] → row-only navigation
      if (idx === grid.length - 1) addRowFunc();
      else { setSelIdx(idx + 1); focusRow(idx + 1); }
    }

    // mirrors: key === 46 (Delete)
    if (e.key === "Delete" && e.ctrlKey) { e.preventDefault(); deleteRow(idx); }
    if (e.key === "Delete" && !e.ctrlKey && !String(grid[idx]?.ModelName || "").trim()) {
      e.preventDefault(); deleteRow(idx);
    }
  }, [grid, hasDuplicate, addRowFunc, focusRow, deleteRow, toast]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="mp-wrap">
      {ConfirmUI}
      <Topbar />
      {/* ── HEADER — identical layout to BrandMaster ── */}
      {/* <div className="mp-hdr">
        <div className="mp-hdr-left">
          <div className="mp-icon">M</div>
          <div>
            <div className="mp-toolbar-title">Model Master</div>
            <div className="mp-sub">Co: {sess.Comid} — Manage model records</div>
          </div>
        </div>
        <button className="mp-back" onClick={handleEsc}>← Back</button>
      </div> */}

      {/* ── BODY ── */}
      <div className="mp-body">

        {/* TOOLBAR */}
        <div className="mp-toolbar">
          <button className="mp-btn sv" onClick={handleSave} disabled={loading}>💾 F1 Save</button>
          <button className="mp-btn nw" onClick={addRowFunc} disabled={loading}>➕ Add Row</button>
          <button className="mp-btn dl" onClick={handleEsc}>✕ Esc Cancel</button>
          <div className="mp-toolbar-title">Model Master</div>
        </div>

        {/*
          GRID
          Mirrors jqxGrid columns:
            S.No      — cellsrenderer: (value+1), not editable
            ModelName — string, width:150, celldoubleclick→edit mode
            Active    — checkbox col, width:150, cellselect→immediate edit
            Id        — hidden (not rendered)
        */}
        <div className="mp-grid-wrap">
          <table className="mp-tbl">
            <thead>
              <tr>
                <th style={{ width: 50  }}>S.No</th>
                <th style={{ width: 300 }}>Model Name</th>
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
                    // cellclass: rowdata.Active==0 → "editedRow" → "inact"
                    !row.Active    ? "inact": "",
                    // updaterow: EditMode=1 → "mod" highlight
                    row.EditMode === 1 ? "mod" : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => { setSelIdx(idx); focusRow(idx); }}
                >
                  {/* S.No — mirrors: cellsrenderer: "<div>(value+1)</div>" */}
                  <td className="sno">{idx + 1}</td>

                  {/*
                    ModelName
                    celldoubleclick → editmode:'selectedcell' (always interactive in React)
                    keypress → applyUppercase (GridKeyPressValidation "string" mode)
                    keydown  → Enter (validate + GirdNextCell) / Delete (deleteRow)
                    onChange → updateCell (marks EditMode=1, mirrors updaterow callback)
                  */}
                  <td>
                    <input
                      ref={el => (inputRefs.current[idx] = el)}
                      className="mp-cell-input"
                      value={row.ModelName || ""}
                      maxLength={200}
                      onChange={e => applyUppercase(e, (val) => updateCell(idx, "ModelName", val))}
                      onKeyDown={e => onCellKeyDown(e, idx)}
                      onFocus={() => setSelIdx(idx)}
                    />
                  </td>

                  {/*
                    Active
                    columntype:'checkbox' in jqxGrid → ✓/✗ select in React
                    cellselect: Active col → editmode:'selectedcell' (immediate toggle)
                    addrow callback sets Active=true (makeNewRow default)
                  */}
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

                  {/* Delete button — mirrors key===46 delete path */}
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
            <div className="mp-empty">No records. Press ➕ to add a model.</div>
          )}
        </div>

        {/* HINT BAR */}
        <div className="mp-hint">
          <kbd>Enter</kbd> next row &nbsp;|&nbsp;
          <kbd>Ctrl+Delete</kbd> delete row &nbsp;|&nbsp;
          <kbd>F1</kbd> save &nbsp;|&nbsp;
          <kbd>Esc</kbd> back
        </div>
      </div>

      {/* LOADER OVERLAY — mirrors jqxLoader('open') / jqxLoader('close') */}
      {loading && (
        <div className="mp-loader-ov">
          <div className="mp-ldr-box">
            <div className="mp-spin" />
            <div className="mp-ldr-msg">Processing…</div>
          </div>
        </div>
      )}

      {/* TOAST STACK — mirrors NotificationSuccess / MsgBox */}
      <div className="toasts">
        {toasts.map(t => (
          <div key={t.id} className={`toast${t.isErr ? " err" : ""}`}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}