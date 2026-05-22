import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./MasterPage.css";

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
const uid = () => String(++_uidCounter);
let _uidCounter = 0;

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
    <div style={modalStyles.overlay}>
      <div style={modalStyles.modal} role="dialog" aria-modal="true">
        <div style={modalStyles.modalIcon}>?</div>
        <p style={modalStyles.modalMsg}>{message}</p>
        <div style={modalStyles.modalBtns}>
          <button
            ref={yesBtnRef}
            style={{ ...modalStyles.modalBtn, ...modalStyles.yesBtn }}
            onClick={onYes}
          >
            ✔ Yes
          </button>
          <button
            style={{ ...modalStyles.modalBtn, ...modalStyles.noBtn }}
            onClick={onNo}
          >
            ✘ No
          </button>
        </div>
      </div>
    </div>
  );
}

const modalStyles = {
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
  modalBtns: { display: "flex", gap: "10px", justifyContent: "center" },
  modalBtn: {
    padding: "7px 26px",
    borderRadius: "6px",
    border: "none",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
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

// ─── useConfirm hook (identical to BrandMaster) ───────────────────────────────
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

// ─── ValNum helper (mirrors jQuery ValNum) ────────────────────────────────────
function ValNum(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

// ─── NullToString helper ──────────────────────────────────────────────────────
function NullToString(v) { return v == null ? "" : String(v); }

// ─── Column order for Enter-key navigation ───────────────────────────────────
// mirrors: Widthdatacolumns (pinned: false, hidden: false) column sequence
const COL_ORDER = [
  "CustomerCardTypeRefid",
  "BillAmount",
  "Points",
  "Value",
  "Active",
];

// ─── CRMPointsMaster ─────────────────────────────────────────────────────────
export default function CRMPointsMaster() {
  const navigate = useNavigate();
  const { confirm, ConfirmUI } = useConfirm();

  // ── Session — mirrors CommonCompany / Comid resolution ──────────────────
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
        menudata:     (getLocal("menulist") || []).filter(o => o.PageName === "Customer"),
      };
    } catch {
      return { Comid: "1", IdComList: "1", MirrorTable: "0", menudata: [] };
    }
  });

  // ── Permissions ──────────────────────────────────────────────────────────
  const perm = sess.menudata[0] || { View: 1, Add: 1, Edit: 1, Delete: 1 };

  // ── State ────────────────────────────────────────────────────────────────
  const [rows,        setRows]        = useState([]);
  const [cardTypeList, setCardTypeList] = useState([]);
  const [selectedUid, setSelectedUid] = useState(null);
  const [openComboUid, setOpenComboUid] = useState(null);
  const [loading,     setLoading]     = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const inputRefs = useRef({});  // `${uid}_${field}` → DOM element
  const toastId   = useRef(0);
  const [toasts, setToasts] = useState([]);

  // ── Toast (mirrors NotificationSuccess / MsgBox inline) ─────────────────
  const toast = useCallback((msg, isErr = false) => {
    const id = ++toastId.current;
    setToasts(p => [...p, { id, msg, isErr }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Permission / session guard — mirrors $(document).ready checks
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!getLocal("menulist")) {
      alert("Session Close Please Login !!!.");
      window.location.href = "/Login/Index";
      return;
    }
    if (!perm || perm.View === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => navigate("/Home"), 3000);
      return;
    }
    // mirrors: sessionStorage.setItem("POPStatus", "OFF")
    sessionStorage.setItem("POPStatus", "OFF");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────
  // makeNewRow — mirrors addrow callback (Active default true)
  // ─────────────────────────────────────────────────────────────────────────
  const makeNewRow = useCallback(() => ({
    _uid:                  uid(),
    Id:                    null,
    CustomerCardTypeRefid: null,
    TypeName:              "",
    BillAmount:            "0.00",
    Points:                "0.00",
    Value:                 "0.00",
    Active:                true,
    EditMode:              0,
  }), []);

  // ─────────────────────────────────────────────────────────────────────────
  // focusField — mirrors gridCRMpoint.jqxGrid('selectcell') + focus
  // ─────────────────────────────────────────────────────────────────────────
  const focusField = useCallback((rowUid, field) => {
    setTimeout(() => {
      const el = inputRefs.current[`${rowUid}_${field}`];
      if (el) { el.focus(); el.select?.(); }
    }, 50);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // loadCustomerCardType — mirrors loadCustomerCardType(false)
  // ─────────────────────────────────────────────────────────────────────────
  const loadCustomerCardType = useCallback(async () => {
    const res = await api(
      "/CustomerCardType/SelectCustomerCardType",
      {},
      {},
      { Comid: sess.Comid }
    );
    if (res.ok && Array.isArray(res.data)) return res.data;
    if (res.ok && Array.isArray(res.Data1)) return res.Data1;
    return [];
  }, [sess.Comid]);

  // ─────────────────────────────────────────────────────────────────────────
  // loadData — mirrors methods.loadModel()
  // ─────────────────────────────────────────────────────────────────────────
  // const loadData = useCallback(async () => {
  //   setLoading(true);

  //   // mirrors: customercardtypelist = loadCustomerCardType(false)
  //   const cardTypes = await loadCustomerCardType();
  //   setCardTypeList(cardTypes);

  //   const res = await api(
  //     `/CRMPoints/SelectCRMPoints?Comid=${sess.Comid}`,
  //     null,
  //     {}
  //   );

  //   setLoading(false);

  //   if (res._http404) { toast("❌ 404 — /CRMPoints/SelectCRMPoints not found", true); return; }
  //   if (res._netErr)  { toast(`❌ Network: ${res.message}`, true); return; }

  //   if (res.ok === true) {
  //     const rawList = Array.isArray(res.data)  ? res.data
  //                   : Array.isArray(res.Data1) ? res.Data1
  //                   : [];

  //     // mirrors forEach parseFloat toFixed(2) for Value, Points, BillAmount
  //     const loaded = rawList.map(obj => ({
  //       _uid:                  uid(),
  //       Id:                    obj.Id,
  //       CustomerCardTypeRefid: obj.CustomerCardTypeRefid ?? null,
  //       TypeName:              obj.TypeName ?? "",
  //       BillAmount:            parseFloat(obj.BillAmount ?? 0).toFixed(2),
  //       Points:                parseFloat(obj.Points    ?? 0).toFixed(2),
  //       Value:                 parseFloat(obj.Value     ?? 0).toFixed(2),
  //       Active:                obj.Active === true || obj.Active === 1,
  //       EditMode:              0,
  //     }));

  //     // mirrors: addrow — blank new row appended
  //     const blankRow = makeNewRow();
  //     const all = [...loaded, blankRow];
  //     setRows(all);
  //     setSelectedUid(blankRow._uid);

  //     // mirrors: gridCRMpoint.jqxGrid('selectcell', rowscount - 1, grdCustomerCardTypeId)
  //     focusField(blankRow._uid, "CustomerCardTypeRefid");

  //     // mirrors: POPValue prefill
  //     const popVal = sessionStorage.getItem("POPValue");
  //     if (popVal && popVal !== "") {
  //       setRows(prev => {
  //         const next = [...prev];
  //         const lastIdx = next.length - 1;
  //         if (lastIdx >= 0) {
  //           next[lastIdx] = {
  //             ...next[lastIdx],
  //             CustomerCardTypeRefid: Number(popVal),
  //             EditMode: 1,
  //           };
  //         }
  //         return next;
  //       });
  //     }
  //   } else {
  //     toast(`❌ ${res.message || "Load failed"}`, true);
  //   }
  // }, [sess.Comid, loadCustomerCardType, makeNewRow, focusField, toast]);
  const loadData = useCallback(async () => {
    setLoading(true);
  
    try {
      // Load customer card types
      const cardTypes = await loadCustomerCardType();
      setCardTypeList(cardTypes);
  
      // IMPORTANT FIX
      // Send Comid in query string
      const res = await api(
        `/CRMPoints/SelectCRMPoints?Comid=${sess.Comid}`,
        null,
        {}
      );
  
      setLoading(false);
  
      if (res._http404) {
        toast("❌ /CRMPoints/SelectCRMPoints not found", true);
        return;
      }
  
      if (res._netErr) {
        toast(`❌ Network Error: ${res.message}`, true);
        return;
      }
  
      // Backend returns ResponseViewModel
      if (res.IsSuccess === true || res.ok === true) {
  
        const rawList =
          Array.isArray(res.Data1) ? res.Data1 :
          Array.isArray(res.data)  ? res.data  :
          [];
  
        const loaded = rawList.map((obj) => ({
          _uid: uid(),
  
          Id: obj.Id,
  
          CustomerCardTypeRefid:
            obj.CustomerCardTypeRefid ?? null,
  
          TypeName:
            obj.TypeName ?? "",
  
          BillAmount:
            Number(obj.BillAmount ?? 0).toFixed(2),
  
          Points:
            Number(obj.Points ?? 0).toFixed(2),
  
          Value:
            Number(obj.Value ?? 0).toFixed(2),
  
          Active:
            obj.Active === true ||
            obj.Active === 1,
  
          EditMode: 0,
        }));
  
        // Add blank row
        const blankRow = makeNewRow();
  
        const allRows = [...loaded, blankRow];
  
        setRows(allRows);
  
        setSelectedUid(blankRow._uid);
  
        // Focus first field
        focusField(blankRow._uid, "CustomerCardTypeRefid");
  
        // POPValue prefill
        const popVal = sessionStorage.getItem("POPValue");
  
        if (popVal && popVal !== "") {
  
          setRows((prev) => {
            const next = [...prev];
  
            const lastIdx = next.length - 1;
  
            if (lastIdx >= 0) {
              next[lastIdx] = {
                ...next[lastIdx],
                CustomerCardTypeRefid: Number(popVal),
                EditMode: 1,
              };
            }
  
            return next;
          });
        }
  
      } else {
        toast(`❌ ${res.Message || res.message || "Load failed"}`, true);
      }
  
    } catch (err) {
  
      setLoading(false);
  
      console.error(err);
  
      toast("❌ Unexpected error while loading CRM Points", true);
    }
  
  }, [
    sess.Comid,
    loadCustomerCardType,
    makeNewRow,
    focusField,
    toast,
  ]);
  useEffect(() => { loadData(); }, [loadData]);

  // ─────────────────────────────────────────────────────────────────────────
  // updateCell — mirrors updaterow: newdata.EditMode = 1
  // ─────────────────────────────────────────────────────────────────────────
  const updateCell = useCallback((rowUid, field, value) => {
    setRows(prev =>
      prev.map(r => r._uid === rowUid ? { ...r, [field]: value, EditMode: 1 } : r)
    );
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // addRow — mirrors Addrowfunc()
  // ─────────────────────────────────────────────────────────────────────────
  const addRow = useCallback(() => {
    const newRow = makeNewRow();
    setRows(prev => [...prev, newRow]);
    setSelectedUid(newRow._uid);
    focusField(newRow._uid, "CustomerCardTypeRefid");
  }, [makeNewRow, focusField]);

  // ─────────────────────────────────────────────────────────────────────────
  // gridemptycheck — mirrors methods.gridemptycheck()
  // ─────────────────────────────────────────────────────────────────────────
  const gridemptycheck = useCallback((currentRows) => {
    let cleaned = [...currentRows];

    // Remove last row if empty and more than one row
    if (cleaned.length > 1) {
      const last = cleaned[cleaned.length - 1];
      if (last.CustomerCardTypeRefid == null || last.CustomerCardTypeRefid === "") {
        cleaned = cleaned.slice(0, -1);
      }
    }

    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i].EditMode === 1) {
        if (cleaned[i].CustomerCardTypeRefid == null || cleaned[i].CustomerCardTypeRefid === "") {
          toast("❌ Enter All Cardtype in the Grid !!!.", true);
          setSelectedUid(cleaned[i]._uid);
          focusField(cleaned[i]._uid, "CustomerCardTypeRefid");
          return { ok: false, cleaned };
        }
      }
    }
    return { ok: true, cleaned };
  }, [toast, focusField]);

  // ─────────────────────────────────────────────────────────────────────────
  // moveToNextCell — mirrors GirdNextCell
  // ─────────────────────────────────────────────────────────────────────────
  const moveToNextCell = useCallback((rowUid, field, currentRows) => {
    const colIdx = COL_ORDER.indexOf(field);
    const rowIdx = currentRows.findIndex(r => r._uid === rowUid);

    if (colIdx !== -1 && colIdx < COL_ORDER.length - 1) {
      // next column in same row
      focusField(rowUid, COL_ORDER[colIdx + 1]);
    } else {
      // last column — go to next row or add new row
      if (rowIdx >= 0 && rowIdx < currentRows.length - 1) {
        focusField(currentRows[rowIdx + 1]._uid, "CustomerCardTypeRefid");
      } else {
        const newRow = makeNewRow();
        setRows(prev => [...prev, newRow]);
        setSelectedUid(newRow._uid);
        focusField(newRow._uid, "CustomerCardTypeRefid");
      }
    }
  }, [focusField, makeNewRow]);

  // ─────────────────────────────────────────────────────────────────────────
  // handleSave — mirrors F1 / InsertCRMPoints flow
  // ─────────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const { ok, cleaned } = gridemptycheck(rows);
    if (!ok) return;
    setRows(cleaned);

    // mirrors: filter obj.EditMode == 1
    const getdata = cleaned.filter(obj => obj.EditMode === 1);
    if (getdata.length === 0) {
      toast("⚠️ No Data Modified, Cannot Update !!!", true);
      return;
    }

    const proceed = await confirm("Do you Want to Save the CRM point Details?");
    if (!proceed) {
      addRow();
      return;
    }

    setLoading(true);

    // Build payload — preserve exact API parameter names
    const payload = getdata.map(r => ({
      Id:                    r.Id ?? null,
      CustomerCardTypeRefid: r.CustomerCardTypeRefid,
      BillAmount:            r.BillAmount,
      Points:                r.Points,
      Value:                 r.Value,
      Active:                r.Active === true ? 1 : 0,
      EditMode:              r.EditMode,
    }));

    const res = await insertapi(
      "/CRMPoints/InsertCRMPoints",
      payload,
      {
        "Comid":       String(sess.Comid),
        "MirrorTable": String(sess.MirrorTable),
        "IdComList":   String(sess.IdComList),
      }
    );

    setLoading(false);

    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

    if (res.ok || res.IsSuccess) {
      toast("✅ " + (res.message || res.Message || "Saved successfully!"));
      await loadData();
    } else {
      toast(`❌ ${res.message || res.Message || "Save failed"}`, true);
    }
  }, [rows, sess, gridemptycheck, confirm, addRow, loadData, toast]);

  // ─────────────────────────────────────────────────────────────────────────
  // deleteRow — mirrors keydown Delete (keyCode 46) flow
  // ─────────────────────────────────────────────────────────────────────────
  const deleteRow = useCallback(async (rowUid) => {
    const row = rows.find(r => r._uid === rowUid);
    if (!row) return;

    if (row.Id != null && row.Id !== 0) {
      // Persisted row — confirm + API delete
      const cardLabel = row.TypeName || NullToString(row.CustomerCardTypeRefid);
      const ok = await confirm(`Wish to Delete the Record ${cardLabel}?`);
      if (!ok) return;

      setLoading(true);

      const res = await api(
        `/CRMPoints/DeleteCRMPoints?Id=${row.Id}&Comid=${sess.Comid}&MirrorTable=${sess.MirrorTable}`,
        null,
        { "IdComList": String(sess.IdComList) }
      );

      setLoading(false);

      if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

      if (res.ok) {
        toast("✅ " + (res.message || "Deleted"));
        setRows(prev => {
          const next = prev.filter(r => r._uid !== rowUid);
          // mirrors: selectcell rowscount - 1, focus
          const lastRow = next[next.length - 1];
          if (lastRow) focusField(lastRow._uid, "CustomerCardTypeRefid");
          return next;
        });
      } else {
        toast(`❌ ${res.message || "Delete failed"}`, true);
      }
    } else {
      // Unsaved row — mirrors DeleteRow(..., 1): remove from state only
      setRows(prev => {
        const next = prev.filter(r => r._uid !== rowUid);
        const lastRow = next[next.length - 1];
        if (lastRow) focusField(lastRow._uid, "CustomerCardTypeRefid");
        return next;
      });
    }
  }, [rows, sess, confirm, focusField, toast]);

  // ─────────────────────────────────────────────────────────────────────────
  // Numeric input validation — mirrors GridKeyPressValidation float, 2 decimals
  // ─────────────────────────────────────────────────────────────────────────
  const validateFloat = (value) =>
    value === "" || (/^-?\d{0,15}(\.\d{0,2})?$/.test(value) && value.length <= 18);

  const handleNumericChange = useCallback((rowUid, field, value) => {
    if (!validateFloat(value)) return;
    updateCell(rowUid, field, value);
  }, [updateCell]);

  // ─────────────────────────────────────────────────────────────────────────
  // ComboBox open/select — mirrors cellbeginedit setTimeout open + Enter select
  // ─────────────────────────────────────────────────────────────────────────
  const openCombo = useCallback((rowUid) => {
    // mirrors: setTimeout CustomerCardTypeEditor.jqxComboBox('open'), 250
    setTimeout(() => setOpenComboUid(rowUid), 250);
  }, []);

  const handleCardTypeSelect = useCallback((rowUid, cardType) => {
    // Update the row
    setRows(prev =>
      prev.map(r =>
        r._uid === rowUid
          ? { ...r, CustomerCardTypeRefid: cardType.Id, TypeName: cardType.TypeName, EditMode: 1 }
          : r
      )
    );
    setOpenComboUid(null);
    // mirrors GirdNextCell after combo selection — use setTimeout for updated rows
    setTimeout(() => {
      setRows(current => {
        moveToNextCell(rowUid, "CustomerCardTypeRefid", current);
        return current;
      });
    }, 30);
  }, [moveToNextCell]);

  // Close combo on outside click
  useEffect(() => {
    const handler = () => setOpenComboUid(null);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // handleKeyDown — mirrors gridCRMpoint keydown Enter + Delete
  // ─────────────────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e, rowUid, field) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const row   = rows.find(r => r._uid === rowUid);
      const value = row?.[field];

      if (field === "CustomerCardTypeRefid") {
        if (value == null || value === "") {
          // mirrors: setTimeout CustomerCardTypeEditor.jqxComboBox('open'), 250
          openCombo(rowUid);
          return;
        }
        moveToNextCell(rowUid, field, rows);
      } else if (field === "BillAmount" || field === "Points" || field === "Value") {
        // mirrors: setcellvalue ValNum(...).toFixed(2)
        const fixed = ValNum(value).toFixed(2);
        updateCell(rowUid, field, fixed);
        // Use timeout so updated value is in place before move
        setTimeout(() => moveToNextCell(rowUid, field, rows), 0);
      } else {
        moveToNextCell(rowUid, field, rows);
      }
    }

    // Ctrl+Delete or Shift+Delete → delete row
    if (e.key === "Delete" && (e.ctrlKey || e.shiftKey)) {
      e.preventDefault();
      deleteRow(rowUid);
    }
  }, [rows, openCombo, moveToNextCell, updateCell, deleteRow]);

  // Combo input keydown — mirrors editor.bind('keydown')
  const handleComboKeyDown = useCallback((e, rowUid) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const row = rows.find(r => r._uid === rowUid);
      if (!row?.CustomerCardTypeRefid) return; // mirrors: index == -1 → no-op
      setOpenComboUid(null);
      moveToNextCell(rowUid, "CustomerCardTypeRefid", rows);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpenComboUid(null);
    }
  }, [rows, moveToNextCell]);

  // ─────────────────────────────────────────────────────────────────────────
  // ESC — mirrors $(document).on('keydown') Esc handler
  // ─────────────────────────────────────────────────────────────────────────
  const handleEsc = useCallback(async () => {
    const ok = await confirm("Do You Want To Quit Page?");
    if (ok) navigate(-1);
  }, [confirm, navigate]);

  // ─────────────────────────────────────────────────────────────────────────
  // Global keyboard shortcuts — F1 Save, Esc Quit, F2 no-op
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = async (e) => {
      if (e.keyCode === 112) { e.preventDefault(); await handleSave(); } // F1
      if (e.keyCode === 113) { e.preventDefault(); }                      // F2 — no-op
      if (e.keyCode === 27)  { e.preventDefault(); await handleEsc(); }  // Esc
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleEsc]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="mp-wrap">
      {/* Confirm modal */}
      {ConfirmUI}

      {/* Loader overlay */}
      {loading && (
        <div className="mp-loader-ov">
          <div className="mp-ldr-box">
            <div className="mp-spin" />
            <div className="mp-ldr-msg">Processing…</div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mp-hdr">
        <div className="mp-hdr-left">
          <div className="mp-icon">C</div>
          <div>
            <div className="mp-title">CRM Points Master</div>
            <div className="mp-sub">Co: {sess.Comid} — Manage CRM point records</div>
          </div>
        </div>
        <button className="mp-back" onClick={handleEsc}>← Back</button>
      </div>

      {/* Body */}
      <div className="mp-body">

        {/* Toolbar */}
        <div className="mp-toolbar">
          <button className="mp-btn sv" onClick={handleSave} disabled={loading}>
            💾 F1 Save
          </button>
          <button className="mp-btn nw" onClick={addRow} disabled={loading}>
            ➕ Add Row
          </button>
          <button className="mp-btn dl" onClick={handleEsc}>
            ✕ Esc Cancel
          </button>
        </div>

        {/* Grid */}
        <div className="mp-grid-wrap">
          <table className="mp-tbl">
            <thead>
              <tr>
                <th style={{ width: 50 }}>S.No</th>
                <th style={{ width: 200 }}>CustomerCardType</th>
                <th style={{ width: 120, textAlign: "right" }}>Bill Amount</th>
                <th style={{ width: 120, textAlign: "right" }}>Points</th>
                <th style={{ width: 120, textAlign: "right" }}>Value</th>
                <th style={{ width: 90,  textAlign: "center" }}>Active</th>
                <th style={{ width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={row._uid}
                  className={[
                    selectedUid === row._uid ? "sel"  : "",
                    !row.Active              ? "inact": "",
                    row.EditMode === 1       ? "mod"  : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => { setSelectedUid(row._uid); }}
                >
                  {/* S.No */}
                  <td className="sno">{idx + 1}</td>

                  {/* CustomerCardType — combobox column */}
                  <td style={{ position: "relative", overflow: "visible" }}>
                    <input
                      ref={el => { if (el) inputRefs.current[`${row._uid}_CustomerCardTypeRefid`] = el; }}
                      className="mp-cell-input"
                      type="text"
                      readOnly
                      value={row.TypeName ?? ""}
                      placeholder="Select type…"
                      onFocus={() => {
                        setSelectedUid(row._uid);
                        // mirrors cellbeginedit → open combo after 250 ms
                        openCombo(row._uid);
                      }}
                      onKeyDown={e => {
                        handleComboKeyDown(e, row._uid);
                        handleKeyDown(e, row._uid, "CustomerCardTypeRefid");
                      }}
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedUid(row._uid);
                        openCombo(row._uid);
                      }}
                      style={{ cursor: "pointer" }}
                    />
                    {/* Dropdown — mirrors jqxComboBox source */}
                    {openComboUid === row._uid && (
                      <div
                        onMouseDown={e => e.stopPropagation()}
                        style={{
                          position:   "absolute",
                          top:        "100%",
                          left:       0,
                          zIndex:     500,
                          background: "#fff",
                          border:     "1px solid #d4dbe8",
                          borderRadius: 4,
                          minWidth:   200,
                          maxHeight:  180,
                          overflowY:  "auto",
                          boxShadow:  "0 4px 12px rgba(0,0,0,.15)",
                        }}
                      >
                        {cardTypeList.length === 0 ? (
                          <div style={{ padding: "6px 10px", fontSize: 11, color: "#aaa" }}>
                            No card types found
                          </div>
                        ) : (
                          cardTypeList.map(ct => (
                            <div
                              key={ct.Id}
                              style={{
                                padding:    "5px 10px",
                                fontSize:   12,
                                cursor:     "pointer",
                                background: row.CustomerCardTypeRefid === ct.Id
                                  ? "#fddfa0"
                                  : "transparent",
                                color: "#1a2e4a",
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = "#fef3e0"}
                              onMouseLeave={e => e.currentTarget.style.background =
                                row.CustomerCardTypeRefid === ct.Id ? "#fddfa0" : "transparent"}
                              onMouseDown={() => handleCardTypeSelect(row._uid, ct)}
                            >
                              {ct.TypeName}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </td>

                  {/* Bill Amount */}
                  <td>
                    <input
                      ref={el => { if (el) inputRefs.current[`${row._uid}_BillAmount`] = el; }}
                      className="mp-cell-input"
                      type="text"
                      value={row.BillAmount ?? ""}
                      onChange={e => handleNumericChange(row._uid, "BillAmount", e.target.value)}
                      onKeyDown={e => handleKeyDown(e, row._uid, "BillAmount")}
                      onFocus={() => setSelectedUid(row._uid)}
                      style={{ textAlign: "right" }}
                    />
                  </td>

                  {/* Points */}
                  <td>
                    <input
                      ref={el => { if (el) inputRefs.current[`${row._uid}_Points`] = el; }}
                      className="mp-cell-input"
                      type="text"
                      value={row.Points ?? ""}
                      onChange={e => handleNumericChange(row._uid, "Points", e.target.value)}
                      onKeyDown={e => handleKeyDown(e, row._uid, "Points")}
                      onFocus={() => setSelectedUid(row._uid)}
                      style={{ textAlign: "right" }}
                    />
                  </td>

                  {/* Value */}
                  <td>
                    <input
                      ref={el => { if (el) inputRefs.current[`${row._uid}_Value`] = el; }}
                      className="mp-cell-input"
                      type="text"
                      value={row.Value ?? ""}
                      onChange={e => handleNumericChange(row._uid, "Value", e.target.value)}
                      onKeyDown={e => handleKeyDown(e, row._uid, "Value")}
                      onFocus={() => setSelectedUid(row._uid)}
                      style={{ textAlign: "right" }}
                    />
                  </td>

                  {/* Active — mirrors columntype: 'checkbox' */}
                  <td style={{ textAlign: "center" }}>
                    <select
                      ref={el => { if (el) inputRefs.current[`${row._uid}_Active`] = el; }}
                      className="mp-active-sel"
                      value={row.Active ? "1" : "0"}
                      onChange={e => updateCell(row._uid, "Active", e.target.value === "1")}
                      onFocus={() => setSelectedUid(row._uid)}
                      onKeyDown={e => handleKeyDown(e, row._uid, "Active")}
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
                      onClick={e => { e.stopPropagation(); deleteRow(row._uid); }}
                      title="Delete row"
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {rows.length === 0 && !loading && (
            <div className="mp-empty">No records. Press ➕ to add a CRM point.</div>
          )}
        </div>

        {/* Hint bar */}
        <div className="mp-hint">
          <kbd>Enter</kbd> next cell &nbsp;|&nbsp;
          <kbd>Ctrl+Delete</kbd> delete row &nbsp;|&nbsp;
          <kbd>F1</kbd> save &nbsp;|&nbsp;
          <kbd>Esc</kbd> back
        </div>
      </div>

      {/* Toast notifications */}
      <div className="toasts">
        {toasts.map(t => (
          <div key={t.id} className={`toast${t.isErr ? " err" : ""}`}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}