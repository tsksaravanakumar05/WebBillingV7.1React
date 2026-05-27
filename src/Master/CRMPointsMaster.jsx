import { useState, useEffect, useRef, useCallback } from "react";
//import axios from "axios";
import "./MasterPage.css";

// ─── Request Controller (mirrors original class) ────────────────────────────
class Request_Controller {
  constructor(key) { this.key = key; this._running = false; }
  Is_Request_Running() { return this._running; }
  Start_Request()      { this._running = true; }
  End_Request()        { this._running = false; }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function MsgBoxYesNo(str) {
  return new Promise((resolve) => {
    resolve({ isConfirmed: window.confirm(str) });
  });
}
function MsgBox(str) { window.alert(str); }

function ValNum(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function NullToString(v) { return v == null ? "" : String(v); }

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function CRMPointsMaster() {

  // ── Permissions ──
  const [pageadd,    setPageadd]    = useState(0);
  const [pageedit,   setPageedit]   = useState(0);
  const [pagedelete, setPagedelete] = useState(0);
  const [permReady,  setPermReady]  = useState(false);

  // ── Session ──
  const [Comid,     setComid]     = useState(null);
  const [IdComList, setIdComList] = useState(null);
  const MirrorTable = useRef(window.MirrorTable ?? 0);

  // ── Grid rows ──
  const [rows,        setRows]        = useState([]);
  const [selectedUid, setSelectedUid] = useState(null);

  // ── CustomerCardType combo list — mirrors customercardtypelist ──
  const [cardTypeList, setCardTypeList] = useState([]);

  // ── ComboBox dropdown open state — mirrors CustomerCardTypeEditor.jqxComboBox('open') ──
  const [openComboUid, setOpenComboUid] = useState(null);

  // ── UI ──
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState(null); // { type, text }

  // ── Refs ──
  const requestFlagRef = useRef(new Request_Controller("CRMPoints"));
  const uidCounter     = useRef(0);
  const inputRefs      = useRef({}); // `${uid}_${field}` → element

  // ─────────────────────────────────────────────────────────────────────────
  // Inject inline styles (matches provided CSS file — kept for self-contained demo)
  // In production this file uses: import "src/master/MasterPage.css";
  // ─────────────────────────────────────────────────────────────────────────
  // (CSS is imported via the import statement above — no inline injection needed)

  // ─────────────────────────────────────────────────────────────────────────
  // 1. INIT — mirrors $(document).ready + methods.init()
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Session check
    const menulist = JSON.parse(localStorage.getItem("menulist"));
    if (!menulist) {
      MsgBox("Session Close Please Login !!!.");
      window.location.href = "/Login/Index";
      return;
    }

    // Permission check — mirrors filter obj.PageName == "Customer"
    const menudata = menulist.filter(obj => obj.PageName === "Customer");
    if (!menudata || menudata.length === 0) {
      MsgBox("Page Access Permission Denied !!!.");
      setTimeout(() => { window.location.href = "/Home"; }, 3000);
      return;
    }
    if (menudata[0].View === 0) {
      MsgBox("Page Access Permission Denied !!!.");
      setTimeout(() => { window.location.href = "/Home"; }, 3000);
      return;
    }

    setPageadd(menudata[0].Add);
    setPageedit(menudata[0].Edit);
    setPagedelete(menudata[0].Delete);

    // Company resolution — mirrors CommonCompany logic
    let comid       = localStorage.getItem("Comid");
    const idComList = localStorage.getItem("IdComList");
    const MComid    = localStorage.getItem("MComid");
    const MainSet   = JSON.parse(localStorage.getItem("Mainsetting"));
    const CommonCompany = MainSet?.[0]?.CommonCompany;
    if (CommonCompany === true) comid = MComid;

    setComid(comid);
    setIdComList(idComList);

    // mirrors: sessionStorage.setItem("POPStatus", "OFF");
    sessionStorage.setItem("POPStatus", "OFF");

    setPermReady(true);
  }, []);

  useEffect(() => {
    if (permReady && Comid !== null) {
      loadModel(Comid, IdComList);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permReady, Comid]);

  // ─────────────────────────────────────────────────────────────────────────
  // 2. KEYBOARD SHORTCUTS — F1 Save, ESC Quit, F2 no-op
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = async (e) => {
      // F1
      if (e.keyCode === 112) {
        e.preventDefault();
        await handleSave();
      }
      // F2
      if (e.keyCode === 113) {
        e.preventDefault();
        // original does nothing
      }
      // ESC
      if (e.keyCode === 27) {
        e.preventDefault();
        const reply = await MsgBoxYesNo("Do You Want To Quit Page?");
        if (reply.isConfirmed) {
          window.location.href = "/Home";
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, pageadd, pageedit, pagedelete, Comid, IdComList]);

  // Close combobox dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (openComboUid !== null) {
        setOpenComboUid(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openComboUid]);

  // ─────────────────────────────────────────────────────────────────────────
  // 3. LOAD CustomerCardType — mirrors loadCustomerCardType(false)
  // ─────────────────────────────────────────────────────────────────────────
  const loadCustomerCardType = useCallback(async () => {
    try {
      const res = await axios.post(
        "/CustomerCardType/SelectCustomerCardType",
        {},
        { headers: { "Content-Type": "application/json; charset=utf-8" } }
      );
      if (res.data?.ok) {
        return res.data.data ?? [];
      }
    } catch {
      // non-fatal — return empty list
    }
    return [];
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // 4. LOAD DATA — mirrors methods.loadModel()
  // ─────────────────────────────────────────────────────────────────────────
  const loadModel = useCallback(async (comid, idComList) => {
    setLoading(true);
    setMsg(null);
    try {
      // mirrors: customercardtypelist = loadCustomerCardType(false);
      const cardTypes = await loadCustomerCardType();
      setCardTypeList(cardTypes);

      const res  = await axios.post(
        "/CRMPoints/SelectCRMPoints",
        { Comid: comid },
        { headers: { "Content-Type": "application/json; charset=utf-8" } }
      );
      const data = res.data;

      if (data.ok === true) {
        const objlist = data.data;

        // mirrors forEach: parseFloat toFixed(2) for Value, Points, BillAmount
        const loaded = objlist.map(obj => ({
          uid:                   ++uidCounter.current,
          Id:                    obj.Id,
          CustomerCardTypeRefid: obj.CustomerCardTypeRefid ?? null,
          TypeName:              obj.TypeName ?? "",
          BillAmount:            parseFloat(obj.BillAmount ?? 0).toFixed(2),
          Points:                parseFloat(obj.Points    ?? 0).toFixed(2),
          Value:                 parseFloat(obj.Value     ?? 0).toFixed(2),
          Active:                obj.Active,
          EditMode:              0,
        }));

        // addrow — blank new row at end
        const newRow = makeNewRow();
        const all = [...loaded, newRow];
        setRows(all);

        // POPValue prefill — mirrors setcellvalue for CustomerCardTypeRefid
        const popVal = sessionStorage.getItem("POPValue");
        if (popVal && popVal !== "") {
          setRows(prev => {
            const next = [...prev];
            // mirrors: rowscount.length - 1 (original bug preserved: rowscount is a number not array,
            // so rowscount.length is undefined → index -1 → no-op; we mirror with last row index)
            const lastIdx = next.length - 1;
            if (lastIdx >= 0) {
              next[lastIdx] = { ...next[lastIdx], CustomerCardTypeRefid: Number(popVal), EditMode: 1 };
            }
            return next;
          });
        }

        setTimeout(() => focusField(newRow.uid, "CustomerCardTypeRefid"), 80);
      } else {
        MsgBox(data.message);
      }
    } catch (err) {
      MsgBox("Network error loading CRM points.");
    } finally {
      setLoading(false);
    }
  }, [loadCustomerCardType]);

  // ─────────────────────────────────────────────────────────────────────────
  // 5. HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  function makeNewRow() {
    return {
      uid:                   ++uidCounter.current,
      Id:                    null,
      CustomerCardTypeRefid: null,
      TypeName:              "",
      BillAmount:            "0.00",
      Points:                "0.00",
      Value:                 "0.00",
      Active:                true,
      EditMode:              0,
    };
  }

  function focusField(uid, field) {
    const el = inputRefs.current[`${uid}_${field}`];
    if (el) { el.focus(); el.select?.(); }
  }

  // mirrors gridemptycheck()
  function gridemptycheck(currentRows) {
    let cleaned = [...currentRows];

    // Remove last empty row if more than one
    if (cleaned.length > 1) {
      const last = cleaned[cleaned.length - 1];
      if (last.CustomerCardTypeRefid == null || last.CustomerCardTypeRefid === "") {
        cleaned = cleaned.slice(0, -1);
        setRows(cleaned);
      }
    }

    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i].EditMode === 1) {
        if (cleaned[i].CustomerCardTypeRefid == null || cleaned[i].CustomerCardTypeRefid === "") {
          MsgBox("Enter All Cardtype in the Grid !!!.");
          setTimeout(() => focusField(cleaned[i].uid, "CustomerCardTypeRefid"), 30);
          return { ok: false, rows: cleaned };
        }
      }
    }
    return { ok: true, rows: cleaned };
  }

  // mirrors Addrowfunc()
  function addRowFunc(currentRows) {
    const newRow = makeNewRow();
    const next = [...currentRows, newRow];
    setRows(next);
    setTimeout(() => focusField(newRow.uid, "CustomerCardTypeRefid"), 30);
    return next;
  }

  // Column order for GirdNextCell navigation — mirrors Widthdatacolumns (pinned: false, hidden: false)
  const colOrder = [
    "CustomerCardTypeRefid",
    "BillAmount",
    "Points",
    "Value",
    "Active",
  ];

  function moveToNextCell(uid, field, currentRows) {
    const idx    = colOrder.indexOf(field);
    const rowIdx = currentRows.findIndex(r => r.uid === uid);

    if (idx !== -1 && idx < colOrder.length - 1) {
      focusField(uid, colOrder[idx + 1]);
    } else {
      // last col → next row or add new row
      if (rowIdx < currentRows.length - 1) {
        focusField(currentRows[rowIdx + 1].uid, "CustomerCardTypeRefid");
      } else {
        addRowFunc(currentRows);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. SAVE — mirrors F1 / InsertCRMPoints flow
  // ─────────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    // mirrors: gridemptycheck()
    const checkResult = gridemptycheck(rows);
    if (!checkResult.ok) return;
    const cleanRows = checkResult.rows;

    // mirrors: filter obj.EditMode == 1  (no pageadd/pageedit split in original CRMPoints)
    const getdata = cleanRows.filter(obj => obj.EditMode === 1);
    if (getdata.length === 0) {
      MsgBox("No Data Modified,Cannot Update !!!.");
      return;
    }

    // mirrors: CheckDuplicate commented out in original — not called

    if (requestFlagRef.current.Is_Request_Running()) return;
    requestFlagRef.current.Start_Request();

    const reply = await MsgBoxYesNo("Do you Want to Save the CRM point Details?");
    if (reply.isConfirmed) {
      setLoading(true);
      try {
        const res  = await axios.post(
          "/CRMPoints/InsertCRMPoints",
          getdata,
          {
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Comid":        Comid,
              "MirrorTable":  MirrorTable.current,
              "IdComList":    IdComList,
            },
          }
        );
        const data = res.data;
        if (data.ok) {
          setMsg({ type: "ok", text: data.message });
          // mirrors: methods.loadModel()
          await loadModel(Comid, IdComList);
          // POP block is commented out in original — preserved as no-op
        } else {
          MsgBox(data.message);
        }
      } catch (err) {
        MsgBox("Network error saving CRM points.");
      } finally {
        setLoading(false);
        requestFlagRef.current.End_Request();
      }
    } else {
      // Cancel → Addrowfunc
      addRowFunc(rows);
      requestFlagRef.current.End_Request();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, Comid, IdComList, loadModel]);

  // ─────────────────────────────────────────────────────────────────────────
  // 7. DELETE ROW — mirrors keydown Delete (keyCode 46)
  // ─────────────────────────────────────────────────────────────────────────
  const handleDeleteRow = useCallback(async (uid) => {
    const row = rows.find(r => r.uid === uid);
    if (!row) return;

    if (row.Id != null && row.Id !== 0) {
      // Persisted row — mirrors: pagedelete check NOT present in original CRMPoints delete block
      const cardLabel = row.TypeName || NullToString(row.CustomerCardTypeRefid);
      const str   = `Wish to Delete the Record ${cardLabel}?`;
      const reply = await MsgBoxYesNo(str);
      if (reply.isConfirmed) {
        setLoading(true);
        try {
          const res  = await axios.post(
            "/CRMPoints/DeleteCRMPoints",
            { Id: row.Id, Comid: Comid, MirrorTable: MirrorTable.current },
            {
              headers: {
                "Content-Type": "application/json; charset=utf-8",
                "IdComList":    IdComList,
              },
            }
          );
          const data = res.data;
          if (data.ok) {
            setMsg({ type: "ok", text: data.message });
            setRows(prev => {
              const next = prev.filter(r => r.uid !== uid);
              setTimeout(() => {
                if (next.length > 0) focusField(next[next.length - 1].uid, "CustomerCardTypeRefid");
              }, 50);
              return next;
            });
          } else {
            MsgBox(data.message);
          }
        } catch {
          MsgBox("Network error deleting CRM point.");
        } finally {
          setLoading(false);
        }
      }
    } else {
      // Unsaved row — mirrors: DeleteRow(..., 1) — remove from state only
      setRows(prev => {
        const next = prev.filter(r => r.uid !== uid);
        setTimeout(() => {
          if (next.length > 0) focusField(next[next.length - 1].uid, "CustomerCardTypeRefid");
        }, 30);
        return next;
      });
    }
  }, [rows, Comid, IdComList]);

  // ─────────────────────────────────────────────────────────────────────────
  // 8. CELL CHANGE HANDLERS
  // ─────────────────────────────────────────────────────────────────────────
  function updateRow(uid, field, value) {
    setRows(prev =>
      prev.map(r => r.uid === uid ? { ...r, [field]: value, EditMode: 1 } : r)
    );
  }

  // mirrors keypress GridKeyPressValidation for float columns
  function validateFloat(value) {
    // max 18 chars, float with up to 2 decimal places
    return /^-?\d{0,15}(\.\d{0,2})?$/.test(value) && value.length <= 18;
  }

  function handleNumericChange(uid, field, value) {
    if (value !== "" && !validateFloat(value)) return;
    updateRow(uid, field, value);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 9. COMBOBOX (CustomerCardType) — mirrors createeditor + cellbeginedit
  // ─────────────────────────────────────────────────────────────────────────
  function handleCardTypeSelect(uid, cardType) {
    setRows(prev =>
      prev.map(r =>
        r.uid === uid
          ? { ...r, CustomerCardTypeRefid: cardType.Id, TypeName: cardType.TypeName, EditMode: 1 }
          : r
      )
    );
    setOpenComboUid(null);
    // mirrors: GirdNextCell after CustomerCardTypeRefid selection
    setTimeout(() => {
      const current = rows.map(r =>
        r.uid === uid
          ? { ...r, CustomerCardTypeRefid: cardType.Id, TypeName: cardType.TypeName, EditMode: 1 }
          : r
      );
      moveToNextCell(uid, "CustomerCardTypeRefid", current);
    }, 30);
  }

  // mirrors cellbeginedit → setTimeout CustomerCardTypeEditor.jqxComboBox('open'), 250
  function openCombo(uid) {
    setTimeout(() => setOpenComboUid(uid), 250);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 10. ENTER KEY NAVIGATION — mirrors gridCRMpoint keydown Enter
  // ─────────────────────────────────────────────────────────────────────────
  function handleKeyDown(e, uid, field) {
    // Backspace triggers keypress — onChange naturally handles validation
    if (e.key === "Enter") {
      e.preventDefault();
      const row   = rows.find(r => r.uid === uid);
      const value = row?.[field];

      if (field === "CustomerCardTypeRefid") {
        if (value == null || value === "") {
          // mirrors: setTimeout CustomerCardTypeEditor.jqxComboBox('open'), 250
          openCombo(uid);
          return;
        }
        moveToNextCell(uid, field, rows);
      } else if (
        field === "BillAmount" ||
        field === "Points"     ||
        field === "Value"
      ) {
        // mirrors: setcellvalue with ValNum(...).toFixed(2)
        const fixed = ValNum(value).toFixed(2);
        updateRow(uid, field, fixed);
        moveToNextCell(uid, field, rows);
      } else {
        moveToNextCell(uid, field, rows);
      }
    }

    // Shift+Delete → delete row
    if (e.key === "Delete" && e.shiftKey) {
      handleDeleteRow(uid);
    }
  }

  // Combobox editor keydown — mirrors editor.bind('keydown') Enter handler
  function handleComboKeyDown(e, uid) {
    if (e.key === "Enter") {
      e.preventDefault();
      const row = rows.find(r => r.uid === uid);
      // If nothing selected and value is non-empty → no-op (mirrors index == -1 && value != "")
      if (!row?.CustomerCardTypeRefid) {
        return;
      }
      setOpenComboUid(null);
      moveToNextCell(uid, "CustomerCardTypeRefid", rows);
    }
    if (e.key === "Escape") {
      setOpenComboUid(null);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 11. ADD ROW BUTTON — mirrors Addrowfunc()
  // ─────────────────────────────────────────────────────────────────────────
  function handleAddRow() {
    addRowFunc(rows);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 12. RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="mp-wrap">

      {/* Loader — mirrors #jqxLoader */}
      {loading && (
        <div className="mp-loader-ov">
          <div className="mp-ldr-box">
            <div className="mp-spin" />
            <div className="mp-ldr-msg">Loading...</div>
          </div>
        </div>
      )}

      {/* Header */}
      {/* <div className="mp-hdr">
        <div className="mp-hdr-left">
          <div className="mp-icon">C</div>
          <div>
            <div className="mp-title">CRM Points Master</div>
            <div className="mp-sub">Customer</div>
          </div>
        </div>
        <button className="mp-back" onClick={() => { window.location.href = "/Home"; }}>
          ← Home
        </button>
      </div> */}

      {/* Body */}
      <div className="mp-body">

        {/* Toolbar */}
        <div className="mp-toolbar">
          <button
            className="mp-btn sv"
            onClick={handleSave}
            title="F1 – Save"
          >
            💾 Save (F1)
          </button>
          <button className="mp-btn nw" onClick={handleAddRow} title="Add new row">
            ＋ New Row
          </button>
          {msg && <span className={`mp-msg ${msg.type}`}>{msg.text}</span>}


          <div className="mp-title">CRM Points Master</div>
        </div>

        {/* Grid */}
        <div className="mp-grid-wrap">
          <table className="mp-tbl">
            <thead>
              <tr>
                <th style={{ width: 50 }}>S.No</th>
                <th style={{ width: 200 }}>CustomerCardType</th>
                <th style={{ width: 120 }}>Bill Amount</th>
                <th style={{ width: 120 }}>Points</th>
                <th style={{ width: 120 }}>Value</th>
                <th style={{ width: 90 }}>Active</th>
                <th style={{ width: 50 }}>Del</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={row.uid}
                  className={[
                    selectedUid === row.uid ? "sel" : "",
                    row.Active === false || row.Active === 0 ? "inact" : "",
                    row.EditMode === 1 ? "mod" : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => setSelectedUid(row.uid)}
                >
                  {/* S.No */}
                  <td className="sno">{idx + 1}</td>

                  {/* CustomerCardType — combobox column */}
                  <td style={{ position: "relative", overflow: "visible" }}>
                    {/* mirrors: columntype: 'combobox' with displayfield TypeName */}
                    <input
                      ref={el => { if (el) inputRefs.current[`${row.uid}_CustomerCardTypeRefid`] = el; }}
                      className="mp-cell-input"
                      type="text"
                      readOnly
                      value={row.TypeName ?? ""}
                      placeholder="Select type..."
                      onFocus={() => {
                        setSelectedUid(row.uid);
                        // mirrors cellbeginedit → open combo after 250ms
                        openCombo(row.uid);
                      }}
                      onKeyDown={e => {
                        handleComboKeyDown(e, row.uid);
                        handleKeyDown(e, row.uid, "CustomerCardTypeRefid");
                      }}
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedUid(row.uid);
                        openCombo(row.uid);
                      }}
                      style={{ cursor: "pointer" }}
                    />
                    {/* Dropdown — mirrors jqxComboBox source */}
                    {openComboUid === row.uid && (
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
                        {cardTypeList.length === 0 && (
                          <div style={{ padding: "6px 10px", fontSize: 11, color: "#aaa" }}>
                            No card types found
                          </div>
                        )}
                        {cardTypeList.map(ct => (
                          <div
                            key={ct.Id}
                            style={{
                              padding:    "5px 10px",
                              fontSize:   12,
                              cursor:     "pointer",
                              background: row.CustomerCardTypeRefid === ct.Id ? "#fddfa0" : "transparent",
                              color:      "#1a2e4a",
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "#fef3e0"}
                            onMouseLeave={e => e.currentTarget.style.background =
                              row.CustomerCardTypeRefid === ct.Id ? "#fddfa0" : "transparent"}
                            onMouseDown={() => handleCardTypeSelect(row.uid, ct)}
                          >
                            {ct.TypeName}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Bill Amount */}
                  <td>
                    <input
                      ref={el => { if (el) inputRefs.current[`${row.uid}_BillAmount`] = el; }}
                      className="mp-cell-input"
                      type="text"
                      value={row.BillAmount ?? ""}
                      onChange={e => handleNumericChange(row.uid, "BillAmount", e.target.value)}
                      onKeyDown={e => handleKeyDown(e, row.uid, "BillAmount")}
                      onFocus={() => setSelectedUid(row.uid)}
                      style={{ textAlign: "right" }}
                    />
                  </td>

                  {/* Points */}
                  <td>
                    <input
                      ref={el => { if (el) inputRefs.current[`${row.uid}_Points`] = el; }}
                      className="mp-cell-input"
                      type="text"
                      value={row.Points ?? ""}
                      onChange={e => handleNumericChange(row.uid, "Points", e.target.value)}
                      onKeyDown={e => handleKeyDown(e, row.uid, "Points")}
                      onFocus={() => setSelectedUid(row.uid)}
                      style={{ textAlign: "right" }}
                    />
                  </td>

                  {/* Value */}
                  <td>
                    <input
                      ref={el => { if (el) inputRefs.current[`${row.uid}_Value`] = el; }}
                      className="mp-cell-input"
                      type="text"
                      value={row.Value ?? ""}
                      onChange={e => handleNumericChange(row.uid, "Value", e.target.value)}
                      onKeyDown={e => handleKeyDown(e, row.uid, "Value")}
                      onFocus={() => setSelectedUid(row.uid)}
                      style={{ textAlign: "right" }}
                    />
                  </td>

                  {/* Active — mirrors columntype: 'checkbox' */}
                  <td style={{ textAlign: "center" }}>
                    <input
                      ref={el => { if (el) inputRefs.current[`${row.uid}_Active`] = el; }}
                      type="checkbox"
                      checked={row.Active === true || row.Active === 1}
                      onChange={e => updateRow(row.uid, "Active", e.target.checked)}
                      onFocus={() => setSelectedUid(row.uid)}
                      style={{ width: 16, height: 16, cursor: "pointer" }}
                    />
                  </td>

                  {/* Delete */}
                  <td style={{ textAlign: "center" }}>
                    <button
                      className="mp-del-btn"
                      title="Delete row"
                      onClick={e => { e.stopPropagation(); handleDeleteRow(row.uid); }}
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Hint bar */}
        <div className="mp-hint">
          <kbd>F1</kbd> Save &nbsp;|&nbsp;
          <kbd>Enter</kbd> Next Cell &nbsp;|&nbsp;
          <kbd>Esc</kbd> Quit &nbsp;|&nbsp;
          Click <strong>CustomerCardType</strong> cell to open combo
        </div>

      </div>
    </div>
  );
}
