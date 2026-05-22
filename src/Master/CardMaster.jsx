import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./MasterPage.css";

// ─── Helpers (identical to BrandMaster pattern) ───────────────────────────────
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

// insertapi — used for InsertCardMaster (matches original jQuery headers pattern)
// const insertapi = async (path, body = null, extraHeaders = {}) => {
//   try {

//     console.log("BODY:", body);

//     const res = await fetch(mkUrl(path), {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         ...authHeaders(),
//         ...extraHeaders,
//       },
//       body: body != null ? JSON.stringify(body) : null,
//     });

//     const text = await res.text();

//     console.log("RAW RESPONSE:", text);

//     try {
//       return JSON.parse(text);
//     } catch {
//       return {
//         ok: false,
//         message: text || "Invalid response",
//       };
//     }

//   } catch (err) {
//     return {
//       ok: false,
//       message: err.message,
//     };
//   }
// };

const insertapi = async (path, body = null, extraHeaders = {}) => {

  try {

    console.log("BODY:", body);

    const res = await fetch(mkUrl(path), {

      method: "POST",

      headers: {

        "Content-Type": "application/json; charset=utf-8",
        "Accept": "application/json, text/plain, */*",

        ...authHeaders(),
        ...extraHeaders,
      },

      // IMPORTANT
      body: JSON.stringify(body || []),

    });

    const text = await res.text();

    console.log("RAW RESPONSE:", text);

    try {

      return JSON.parse(text);

    } catch {

      return {
        ok: false,
        message: text || "Invalid response"
      };
    }

  } catch (err) {

    return {
      ok: false,
      message: err.message
    };
  }
};

const getStr   = (k) => localStorage.getItem(k) || "";
const getLocal = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const uid      = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36));

// ─── Preserved from original jQuery: cardtypelist ────────────────────────────
const CARD_TYPE_LIST = [
  { value: "CARD",      label: "CARD" },
  { value: "UPI",       label: "UPI" },
  { value: "CRMPOINTS", label: "CRMPOINTS" },
];

// ─── Preserved from original jQuery: column name constants ───────────────────
const grdCardName  = "CardName";
const grdCardType  = "CardType";        // combo display field
const grdScharge   = "Scharge";
const grdActive    = "Active";
const grdId        = "Id";
const grdBankRefid = "Bankrefid";
const grdBankName  = "BankName";
const grdEditMode  = "EditMode";

// ─── Field focus order (mirrors GirdNextCell column order) ───────────────────
const FIELD_ORDER = [grdCardName, grdCardType, grdScharge, grdBankRefid, grdActive];

// ─── Empty row factory (mirrors addrow(gridCard) + source.addrow defaults) ───
const makeNewRow = (prefill = "") => ({
  _uid:      uid(),
  [grdId]:       0,
  [grdCardName]: prefill,
  [grdCardType]: "",
  [grdScharge]:  "0.00",
  [grdBankName]: "",
  [grdBankRefid]: 0,
  [grdActive]:   true,
  [grdEditMode]: 0,
});

// ─── Preserve valNum from original (ValNum helper) ───────────────────────────
const valNum = (v) => parseFloat(v) || 0;

// ─── Uppercase helper (used for CardName, matching BrandMaster pattern) ───────
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

// ─── Confirmation Modal (same as BrandMaster) ─────────────────────────────────
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

// Inject keyframe once (same as BrandMaster)
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
    .mp-cell-select {
      width: 100%;
      font-size: 13px;
      padding: 2px 4px;
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      background: #f8fafc;
      cursor: pointer;
    }
    .mp-cell-select:focus { outline: 2px solid #3b82f6; }
  `;
  document.head.appendChild(s);
}

// ─── useConfirm hook (identical to BrandMaster) ──────────────────────────────
function useConfirm() {
  const [conf, setConf] = useState(null);

  const confirm = useCallback(
    (message) => new Promise((resolve) => setConf({ message, resolve })),
    []
  );

  const handleYes = useCallback(() => { conf?.resolve(true);  setConf(null); }, [conf]);
  const handleNo  = useCallback(() => { conf?.resolve(false); setConf(null); }, [conf]);

  const ConfirmUI = conf ? (
    <ConfirmModal message={conf.message} onYes={handleYes} onNo={handleNo} />
  ) : null;

  return { confirm, ConfirmUI };
}

// ═════════════════════════════════════════════════════════════════════════════
// CardMaster — React component following BrandMaster architecture exactly
// ═════════════════════════════════════════════════════════════════════════════
export default function CardMaster() {
  const navigate  = useNavigate();
  const inputRefs = useRef({});   // keyed by uid+field for direct focus
  const toastId   = useRef(0);
  const reqRunning = useRef(false); // mirrors Request_Controller.Is_Request_Running()

  const { confirm, ConfirmUI } = useConfirm();

  // ── Session (mirrors jQuery: Comid, MComid, MirrorTable, menudata) ─────────
  const [sess] = useState(() => {
    try {
      const main0       = (getLocal("Mainsetting") || [{}])[0] || {};
      const Comid       = getStr("Comid")    || "1";
      const MComid      = getStr("MComid")   || Comid;
      const MirrorTable = getStr("MirrorTable") || "0";
      return {
        Comid:       main0.CommonCompany ? MComid : Comid,
        MirrorTable,
        menudata:    (getLocal("menulist") || []).filter(o => o.PageName === "Card Master"),
      };
    } catch {
      return { Comid: "1", MirrorTable: "0", menudata: [] };
    }
  });

  // ── Permission check (mirrors jQuery: menudata checks + redirect) ──────────
  useEffect(() => {
    const menulist = getLocal("menulist");
    if (!menulist) {
      alert("Session Close Please Login !!!.");
      window.location.href = "/Login/Index";
      return;
    }
    const menudata = menulist.filter(o => o.PageName === "Card Master");
    if (!menudata || menudata.length === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => { window.location.href = "/Home"; }, 3000);
      return;
    }
    if (menudata[0].View === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => { window.location.href = "/Home"; }, 3000);
    }
  }, []); // eslint-disable-line

  // perm object (mirrors jQuery: pageview, pageadd, pageedit, pagedelete)
  const perm = sess.menudata[0] || { View: 1, Add: 1, Edit: 1, Delete: 1 };

  // ── State ──────────────────────────────────────────────────────────────────
  const [grid,     setGrid]     = useState([]);
  const [bankList, setBankList] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [toasts,   setToasts]   = useState([]);
  const [selIdx,   setSelIdx]   = useState(null);

  // ── Toast (matches BrandMaster pattern) ───────────────────────────────────
  const toast = useCallback((msg, isErr = false) => {
    const id = ++toastId.current;
    setToasts(p => [...p, { id, msg, isErr }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  // ── Focus helper (mirrors gridCard.jqxGrid('selectcell', ...) + focus) ────
  const focusCell = useCallback((idx, field) => {
    setTimeout(() => {
      const key = `${idx}-${field}`;
      inputRefs.current[key]?.focus();
    }, 50);
  }, []);

  // ── loadBanks (mirrors jQuery AJAX to /Bank/SelectBankList) ───────────────
  // Original: $.ajax url "/Bank/SelectBankList", POST, data '{"Comid":' + Comid + '}'
  // success: banklist = data.data
// ── loadBanks (mirrors jQuery AJAX to /Bank/SelectBankList) ───────────────
const loadBanks = useCallback(async () => {
  try {
    // Pass Comid as the 4th argument (queryParams) so it appends to the URL
    // matching the C# expectation for primitive (Int32) parameters.
    const res = await api(
      "/Bank/SelectBankList",
      null, // No JSON body needed
      {},   // No extra headers
      { Comid: Number(sess.Comid) } // queryParams
    );

    console.log("BANK RESPONSE =", res);

    // Use the 'ok' and 'data' properties that your api helper normalizes
    if (res?.ok && res?.data) {
      setBankList(res.data);
    } else {
      setBankList([]);
    }

  } catch (err) {
    console.error("loadBanks error:", err);
    setBankList([]);
  }
}, [sess.Comid]);
  // ── loadData (mirrors methods.loadModel — /CardMaster/SelectCardMaster) ────
  // Original: ajax POST data '{"Comid":' + Comid + '}', on success:
  //   - Scharge = parseFloat(obj.Scharge).toFixed(2)
  //   - Build jqxGrid dataAdapter with source
  //   - addrow(gridCard) appends blank row at bottom
  //   - selectcell last row grdCardName, focus
  //   - if sessionStorage.POPValue != "" set it in last row CardName
  const loadData = useCallback(async () => {
    const prefill = sessionStorage.getItem("masterPrefill") || "";
    setLoading(true);

    const res = await api(
      "/CardMaster/SelectCardMaster",
      null,
      {},
      { Comid: sess.Comid }
    );

    setLoading(false);

    if (res._http404) { toast("❌ 404 — /CardMaster/SelectCardMaster not found", true); }
    if (res._netErr)  { toast(`❌ Network: ${res.message}`, true); }

    if (!res.ok && !res._http404 && !res._netErr) {
      toast(`❌ ${res.message || "Load failed"}`, true);
      return;
    }

    const rawList = Array.isArray(res.data)  ? res.data
                  : Array.isArray(res.Data1) ? res.Data1
                  : [];

    // Mirrors: objlist.forEach obj.Scharge = parseFloat(obj.Scharge).toFixed(2)
    const existing = rawList.map(r => ({
      _uid:          uid(),
      [grdId]:       r.Id        ?? 0,
      [grdCardName]: r.CardName  ?? "",
      [grdCardType]: r.CardType  ?? "",
      [grdScharge]:  parseFloat(r.Scharge  || 0).toFixed(2),
      [grdBankName]: r.BankName  ?? "",
      [grdBankRefid]: r.Bankrefid ?? 0,
      [grdActive]:   r.Active === true || r.Active === 1,
      [grdEditMode]: 0,
    }));

    // Mirrors: addrow(gridCard) — always append one blank new row
    const blankRow = makeNewRow(prefill);
    const nextGrid = [...existing, blankRow];
    setGrid(nextGrid);

    const lastIdx = nextGrid.length - 1;
    setSelIdx(lastIdx);
    focusCell(lastIdx, grdCardName);

    // Mirrors: if (sessionStorage.getItem("POPValue") != "") set CardName of last row
    const popVal = sessionStorage.getItem("POPValue");
    if (popVal) {
      setGrid(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { ...copy[copy.length - 1], [grdCardName]: popVal, [grdEditMode]: 1 };
        return copy;
      });
    }

    sessionStorage.removeItem("masterPrefill");
  }, [sess.Comid, focusCell, toast]);

  // On mount: loadBanks first (async, not awaited in original), then loadModel
  // Mirrors original init: methods.loadModel() + separate AJAX for banks
  useEffect(() => {
    loadBanks();
    loadData();
  }, []); // eslint-disable-line

  // ── addRow (mirrors methods.Addrowfunc) ───────────────────────────────────
  // Original: addrow(gridCard), selectcell rowscount-1 grdCardName, focus
  const addRow = useCallback(() => {
    setGrid(prev => {
      const next  = [...prev, makeNewRow()];
      const idx   = next.length - 1;
      setSelIdx(idx);
      focusCell(idx, grdCardName);
      return next;
    });
  }, [focusCell]);

  // ── updateCell (mirrors source.updaterow: newdata.EditMode = 1, commit) ───
  const updateCell = useCallback((idx, field, value) => {
    setGrid(prev => prev.map((r, i) =>
      i === idx ? { ...r, [field]: value, [grdEditMode]: 1 } : r
    ));
  }, []);

  // ── gridemptycheck (mirrors methods.gridemptycheck exactly) ───────────────
  // Original:
  //   1. if last row CardName == "" and rowcount > 1: delete last row
  //   2. for each row: if EditMode==1 and CardName=="" → MsgBox + selectcell + return false
  //   3.               if EditMode==1 and CardType=="" → MsgBox + selectcell + return false
  const gridemptycheck = useCallback((g) => {
    let cleaned = [...g];

    // Step 1: remove last empty row if rowcount > 1
    if (cleaned.length > 1 && !String(cleaned[cleaned.length - 1][grdCardName] || "").trim()) {
      cleaned = cleaned.slice(0, -1);
    }

    // Step 2: validate each dirty row
    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i][grdEditMode] !== 1) continue;
      if (!cleaned[i][grdCardName] || !String(cleaned[i][grdCardName]).trim()) {
        toast("❌ Enter All CardName in the Grid !!!.", true);
        setSelIdx(i);
        focusCell(i, grdCardName);
        return { ok: false, cleaned };
      }
      if (!cleaned[i][grdCardType] || !String(cleaned[i][grdCardType]).trim()) {
        toast("❌ Select All CardType in the Grid !!!.", true);
        setSelIdx(i);
        focusCell(i, grdCardType);
        return { ok: false, cleaned };
      }
    }

    return { ok: true, cleaned };
  }, [focusCell, toast]);

  // ── CheckDuplicate for CardName (mirrors CheckDuplicate(gridCard, grdCardName, "Card Name")) ──
  const hasDuplicateCardName = useCallback((g) => {
    const names = g
      .filter(r => String(r[grdCardName] || "").trim())
      .map(r => String(r[grdCardName]).trim().toLowerCase());
    return new Set(names).size !== names.length;
  }, []);

  // ── deleteRow (mirrors Delete key handler in gridCard.bind('keydown')) ─────
  // Original:
  //   if Id != 0 && != null: MsgBoxYesNo → AJAX /CardMaster/DeleteCardMaster
  //     POST JSON {Id, Comid, MirrorTable}
  //     success ok: NotificationSuccess → DeleteRow → selectcell last row
  //   else: DeleteRow locally → selectcell last row
  const deleteRow = useCallback(async (idx) => {
    const row = grid[idx];
    const isSaved = row[grdId] != null && row[grdId] !== 0;
  
    if (isSaved) {
  
      const str = `Wish to Delete the Record ${row[grdCardName]}?`;
      const ok = await confirm(str);
  
      if (!ok) return;
  
      setLoading(true);
  
      const res = await api(
        `/CardMaster/DeleteCardMaster?Id=${Number(row[grdId])}&Comid=${Number(sess.Comid)}&MirrorTable=${Number(sess.MirrorTable)}`,
        null,
        {
          IdComList: String(sess.IdComList || ""),
        }
      );
  
      setLoading(false);
  
      if (res._netErr) {
        toast(`❌ ${res.message}`, true);
        return;
      }
  
      if (res.ok) {
  
        toast("✅ " + (res.message || "Deleted"));
  
        setGrid(prev => {
  
          const next = prev.filter((_, i) => i !== idx);
  
          const final = next.length
            ? next
            : [makeNewRow()];
  
          const sel = Math.max(0, final.length - 1);
  
          setSelIdx(sel);
  
          focusCell(sel, grdCardName);
  
          return final;
        });
  
      } else {
  
        toast(`❌ ${res.message || "Delete failed"}`, true);
  
      }
  
    } else {
  
      // local unsaved row delete
  
      setGrid(prev => {
  
        const next = prev.filter((_, i) => i !== idx);
  
        const final = next.length
          ? next
          : [makeNewRow()];
  
        const sel = Math.max(0, final.length - 1);
  
        setSelIdx(sel);
  
        focusCell(sel, grdCardName);
  
        return final;
      });
    }
  
  }, [grid, sess, confirm, focusCell, toast]);

  // ── handleSave (mirrors F1 keydown handler) ───────────────────────────────
  // Original flow:
  //   1. gridemptycheck → return if false
  //   2. filter EditMode==1 → if none: MsgBox("No Data Modified") return
  //   3. Request_Controller check (prevent double submit)
  //   4. MsgBoxYesNo "Do you Want to Save the Card Details?"
  //      - No:  methods.Addrowfunc(); Request_Flag.End()
  //      - Yes: AJAX POST /CardMaster/InsertCardMaster
  //             headers: Comid, MirrorTable
  //             body: JSON.stringify(getdata)   ← sends full row objects
  //             success ok: NotificationSuccess + loadModel()
  //             error: MsgBox
  const handleSave = useCallback(async () => {

    const { ok, cleaned } = gridemptycheck(grid);
  
    if (!ok) return;
  
    setGrid(cleaned);
  
    const dirty = cleaned.filter(r => r[grdEditMode] === 1);
  
    if (!dirty.length) {
      toast("⚠️ No Data Modified, Cannot Update !!!", true);
      return;
    }
  
    if (reqRunning.current) return;
  
    reqRunning.current = true;
  
    const proceed = await confirm("Do you Want to Save the Card Details?");
  
    if (!proceed) {
      addRow();
      reqRunning.current = false;
      return;
    }
  
    setLoading(true);
  
    try {
  
      // FINAL PAYLOAD
      const payload = [...dirty.map(r => ({
        Id: Number(r.Id || 0),
      
        CardName: String(r.CardName || "").trim(),
      
        CardType: String(r.CardType || ""),
      
        SCharge: Number(r.Scharge || 0),
      
        BankName: String(r.BankName || ""),
      
        Bankrefid: Number(r.Bankrefid || 0),
      
        Active:
          r.Active === true? 1:0,
      
        EditMode: 1
      }))];
    
    // IMPORTANT CHECK
    if (!payload.length) {
    

    
      toast("❌ Card Name is Empty", true);
    
      return;
    }
  
      console.log("FINAL PAYLOAD:", JSON.stringify(payload));
  
      // API CALL
      const data = await insertapi(
        "/CardMaster/InsertCardMaster",
        payload,
        {
          Id:0,
          Comid: String(sess.Comid),
          ApiType: "1",
          MirrorTable: String(sess.MirrorTable || 0),
          IdComList: String(sess.IdComList || "")
        }
      );
  
      console.log("API RESPONSE:", data);
  
      setLoading(false);
  
      reqRunning.current = false;
  
      if (data?.IsSuccess || data?.ok) {
  
        toast(
          "✅ " +
          (data.Message || data.message || "Saved successfully!")
        );
  
        await loadData();
  
      } else {
  
        toast(
          `❌ ${data.Message || data.message || "Save failed"}`,
          true
        );
      }
  
    } catch (err) {
  
      console.error("SAVE ERROR:", err);
  
      setLoading(false);
  
      reqRunning.current = false;
  
      toast(`❌ ${err.message}`, true);
    }
  
  }, [
    grid,
    sess,
    confirm,
    addRow,
    gridemptycheck,
    loadData,
    toast
  ]);
  // ── Esc handler (mirrors original: MsgBoxYesNo "Do You Want To Quit Page?" → /Home) ──
  const handleEsc = useCallback(async () => {
    const ok = await confirm("Do You Want To Quit Page?");
    if (ok) window.location.href = "/Home";
  }, [confirm]);

  // ── Global keydown: F1 = save, Esc = quit (mirrors $(document).on('keydown')) ──
  useEffect(() => {
    const onKey = (e) => {
      if (e.keyCode === 112) { e.preventDefault(); handleSave(); }
      if (e.keyCode === 27)  { e.preventDefault(); handleEsc();  }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleEsc]);

  // ── Scharge blur format (mirrors: setcellvalue rowindex grdScharge ValNum(...).toFixed(2)) ──
  const handleSchargeBlur = useCallback((idx, value) => {
    setGrid(prev => prev.map((r, i) =>
      i === idx ? { ...r, [grdScharge]: valNum(value).toFixed(2), [grdEditMode]: 1 } : r
    ));
  }, []);

  // ── advanceFocus (mirrors GirdNextCell logic — move to next column, then next row) ──
  const advanceFocus = useCallback((idx, currentField) => {
    const fi      = FIELD_ORDER.indexOf(currentField);
    const nextFld = FIELD_ORDER[fi + 1];
    if (nextFld) {
      focusCell(idx, nextFld);
    } else {
      // Last column: move to next row CardName (or add row)
      if (idx === grid.length - 1) {
        addRow();
      } else {
        setSelIdx(idx + 1);
        focusCell(idx + 1, grdCardName);
      }
    }
  }, [grid.length, addRow, focusCell]);

  // ── onCellKeyDown for CardName (mirrors gridCard.bind('keydown') Enter on grdCardName) ──
  // Original:
  //   if value == null || ""  → MsgBox "Enter Card Name!!!."
  //   if CheckDuplicate == true → GirdNextCell
  const onCardNameKeyDown = useCallback((e, idx) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const row = grid[idx];
      if (!String(row?.[grdCardName] || "").trim()) {
        toast("❌ Enter Card Name!!!.", true);
        return;
      }
      if (hasDuplicateCardName(grid)) {
        toast("❌ Duplicate Card Name found !!!", true);
        return;
      }
      advanceFocus(idx, grdCardName);
    }
    // Delete key on grid cell (mirrors keydown key 46)
    if (e.key === "Delete" && !e.ctrlKey) {
      if (!String(grid[idx]?.[grdCardName] || "").trim()) {
        e.preventDefault();
        deleteRow(idx);
      }
    }
    if (e.key === "Delete" && e.ctrlKey) {
      e.preventDefault();
      deleteRow(idx);
    }
  }, [grid, hasDuplicateCardName, advanceFocus, deleteRow, toast]);

  // ── onSchargeKeyDown (mirrors: Enter on grdScharge → ValNum.toFixed(2) + GirdNextCell) ──
  const onSchargeKeyDown = useCallback((e, idx) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const row = grid[idx];
      setGrid(prev => prev.map((r, i) =>
        i === idx ? { ...r, [grdScharge]: valNum(r[grdScharge]).toFixed(2), [grdEditMode]: 1 } : r
      ));
      advanceFocus(idx, grdScharge);
    }
    if (e.key === "Delete" && e.ctrlKey) { e.preventDefault(); deleteRow(idx); }
  }, [grid, advanceFocus, deleteRow]);

  // ── onSelectKeyDown (mirrors: Enter on combo columns → GirdNextCell) ──────
  const onSelectKeyDown = useCallback((e, idx, field) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const row = grid[idx];
      // Mirror: if CardType value == "" on Enter: return (original commented "MsgBox" but kept return)
      if (field === grdCardType && !String(row?.[grdCardType] || "").trim()) {
        return;
      }
      advanceFocus(idx, field);
    }
    if (e.key === "Delete" && e.ctrlKey) { e.preventDefault(); deleteRow(idx); }
  }, [grid, advanceFocus, deleteRow]);

  // ── onActiveKeyDown ───────────────────────────────────────────────────────
  const onActiveKeyDown = useCallback((e, idx) => {
    if (e.key === "Enter") {
      e.preventDefault();
      advanceFocus(idx, grdActive);
    }
    if (e.key === "Delete" && e.ctrlKey) { e.preventDefault(); deleteRow(idx); }
  }, [advanceFocus, deleteRow]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="mp-wrap">
      {ConfirmUI}

      {/* ── HEADER (follows BrandMaster mp-hdr pattern) ── */}
      <div className="mp-hdr">
        <div className="mp-hdr-left">
          <div className="mp-icon">C</div>
          <div>
            <div className="mp-title">Card Master</div>
            <div className="mp-sub">Co: {sess.Comid} — Payment Card Configuration</div>
          </div>
        </div>
        <button className="mp-back" onClick={handleEsc}>← Back</button>
      </div>

      {/* ── BODY ── */}
      <div className="mp-body">

        {/* ── TOOLBAR ── */}
        <div className="mp-toolbar">
          <button className="mp-btn sv" onClick={handleSave} disabled={loading}>💾 F1 Save</button>
          <button className="mp-btn nw" onClick={addRow}     disabled={loading}>➕ Add Row</button>
          <button className="mp-btn dl" onClick={handleEsc}>✕ Esc Quit</button>
        </div>

        {/* ── GRID ── */}
        <div className="mp-grid-wrap">
          <table className="mp-tbl">
            <thead>
              <tr>
                <th style={{ width: 50  }}>S.No</th>
                <th style={{ width: 160 }}>Card Name</th>
                <th style={{ width: 150 }}>Card Type</th>
                <th style={{ width: 100, textAlign: "right" }}>Scharge</th>
                <th style={{ width: 180 }}>Bank Name</th>
                <th style={{ width: 72,  textAlign: "center" }}>Active</th>
                <th style={{ width: 50  }}></th>
              </tr>
            </thead>
            <tbody>
              {grid.map((row, idx) => (
                <tr
                  key={row._uid}
                  className={[
                    selIdx === idx          ? "sel"  : "",
                    !row[grdActive]         ? "inact": "",
                    row[grdEditMode] === 1  ? "mod"  : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => { setSelIdx(idx); focusCell(idx, grdCardName); }}
                >
                  {/* S.No — mirrors cellsrenderer: (value + 1) */}
                  <td className="sno">{idx + 1}</td>

                  {/* CardName — text input, uppercase, maxLen 50
                      mirrors: GridKeyPressValidation(gridCard, event, 50, "string", 2) */}
                  <td>
                    <input
                      ref={el => (inputRefs.current[`${idx}-${grdCardName}`] = el)}
                      className="mp-cell-input"
                      value={row[grdCardName] || ""}
                      maxLength={50}
                      onChange={e => applyUppercase(e, (val) => updateCell(idx, grdCardName, val))}
                      onKeyDown={e => onCardNameKeyDown(e, idx)}
                      onFocus={() => setSelIdx(idx)}
                    />
                  </td>

                  {/* CardType — combo (mirrors createeditor jqxComboBox cardtypelist) */}
                  <td>
                    <select
                      ref={el => (inputRefs.current[`${idx}-${grdCardType}`] = el)}
                      className="mp-cell-select"
                      value={row[grdCardType] || ""}
                      onChange={e => updateCell(idx, grdCardType, e.target.value)}
                      onKeyDown={e => onSelectKeyDown(e, idx, grdCardType)}
                      onFocus={() => setSelIdx(idx)}
                    >
                      <option value="">— Select —</option>
                      {CARD_TYPE_LIST.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>

                  {/* Scharge — float, right-aligned
                      mirrors: GridKeyPressValidation(gridCard, event, 18, "float", 2)
                               setcellvalue rowindex grdScharge ValNum(...).toFixed(2) */}
                  <td>
                    <input
                      ref={el => (inputRefs.current[`${idx}-${grdScharge}`] = el)}
                      className="mp-cell-input"
                      style={{ textAlign: "right" }}
                      value={row[grdScharge] || "0.00"}
                      maxLength={18}
                      onChange={e => updateCell(idx, grdScharge, e.target.value)}
                      onKeyDown={e => onSchargeKeyDown(e, idx)}
                      onBlur={() => handleSchargeBlur(idx, row[grdScharge])}
                      onFocus={() => setSelIdx(idx)}
                    />
                  </td>

                  {/* BankName — combo (mirrors createeditor jqxComboBox banklist,
                      displayMember:'AccountName', valueMember:'Id') */}
                  <td>
                    <select
                      ref={el => (inputRefs.current[`${idx}-${grdBankRefid}`] = el)}
                      className="mp-cell-select"
                      value={String(row[grdBankRefid] || "0")}
                      onChange={e => {
                        const selectedId = e.target.value;
                        const found = bankList.find(o => String(o.Id) === selectedId);
                        updateCell(idx, grdBankRefid, selectedId);
                        if (found) {
                          setGrid(prev => prev.map((r, i) =>
                            i === idx
                              ? { ...r, [grdBankRefid]: selectedId, [grdBankName]: found.AccountName, [grdEditMode]: 1 }
                              : r
                          ));
                        }
                      }}
                      onKeyDown={e => onSelectKeyDown(e, idx, grdBankRefid)}
                      onFocus={() => setSelIdx(idx)}
                    >
                      <option value="0">— Select Bank —</option>
                      {bankList.map(o => (
                        <option key={o.Id} value={String(o.Id)}>{o.AccountName}</option>
                      ))}
                    </select>
                  </td>

                  {/* Active — checkbox (mirrors columntype: 'checkbox') */}
                  <td style={{ textAlign: "center" }}>
                    <select
                      ref={el => (inputRefs.current[`${idx}-${grdActive}`] = el)}
                      className="mp-active-sel"
                      value={row[grdActive] ? "1" : "0"}
                      onChange={e => updateCell(idx, grdActive, e.target.value === "1")}
                      onKeyDown={e => onActiveKeyDown(e, idx)}
                      onFocus={() => setSelIdx(idx)}
                      title={row[grdActive] ? "Active" : "Inactive"}
                    >
                      <option value="1">✓</option>
                      <option value="0">✗</option>
                    </select>
                  </td>

                  {/* Delete button */}
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
            <div className="mp-empty">No records. Press ➕ to add a card.</div>
          )}
        </div>

        {/* ── HINT BAR ── */}
        <div className="mp-hint">
          <kbd>Enter</kbd> next cell &nbsp;|&nbsp;
          <kbd>Ctrl+Delete</kbd> delete row &nbsp;|&nbsp;
          <kbd>F1</kbd> save &nbsp;|&nbsp;
          <kbd>Esc</kbd> quit
        </div>
      </div>

      {/* ── LOADER overlay (mirrors jqxLoader open/close) ── */}
      {loading && (
        <div className="mp-loader-ov">
          <div className="mp-ldr-box">
            <div className="mp-spin" />
            <div className="mp-ldr-msg">Processing…</div>
          </div>
        </div>
      )}

      {/* ── TOASTS (mirrors NotificationSuccess / MsgBox pattern) ── */}
      <div className="toasts">
        {toasts.map(t => (
          <div key={t.id} className={`toast${t.isErr ? " err" : ""}`}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}