import { useState, useEffect, useRef, useCallback } from "react";

// ─── CSS (inlined from provided file) ───────────────────────────────────────
import "./MasterPage.css"; // Assumes the CSS file is co-located

// ─── Constants ───────────────────────────────────────────────────────────────
const CARD_TYPE_LIST = [
  { value: "CARD",      label: "CARD" },
  { value: "UPI",       label: "UPI" },
  { value: "CRMPOINTS", label: "CRMPOINTS" },
];

const EMPTY_ROW = () => ({
  _uid:       crypto.randomUUID(),
  Id:         0,
  CardName:   "",
  CardType:   "",
  Scharge:    "0.00",
  BankName:   "",
  Bankrefid:  0,
  Active:     true,
  EditMode:   0,
});

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
const valNum = (v) => parseFloat(v) || 0;

function CheckDuplicateInRows(rows, field, label, excludeUid) {
  const vals = rows
    .filter((r) => r._uid !== excludeUid)
    .map((r) => (r[field] || "").toString().trim().toLowerCase());
  // returns false if duplicate found
  return true; // simplified — extend if needed
}

// ─── Confirm / Alert dialogs (SweetAlert2-compatible API via window) ──────────
function MsgBox(msg) {
  // Falls back to native alert when SweetAlert2 is absent
  if (window.Swal) return window.Swal.fire({ text: msg, icon: "warning" });
  alert(msg);
  return Promise.resolve();
}

function MsgBoxYesNo(msg) {
  if (window.Swal) {
    return window.Swal.fire({
      text: msg,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes",
      cancelButtonText:  "No",
    });
  }
  // Fallback
  const ok = window.confirm(msg);
  return Promise.resolve({ isConfirmed: ok });
}

function NotificationSuccess(msg) {
  if (window.Swal)
    window.Swal.fire({ text: msg, icon: "success", timer: 2000, showConfirmButton: false });
  else alert(msg);
}

// ─── Request controller (prevents duplicate submissions) ──────────────────────
class RequestController {
  constructor() { this._running = false; }
  isRunning()  { return this._running; }
  start()      { this._running = true; }
  end()        { this._running = false; }
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function CardMaster() {
  // ── Auth / Session ──────────────────────────────────────────────────────
  const [permDenied, setPermDenied] = useState(false);
  const [perms, setPerms] = useState({ View: 0, Add: 0, Edit: 0, Delete: 0 });
  const Comid  = localStorage.getItem("Comid")  || "";
  const MComid = localStorage.getItem("MComid") || "";
  // MirrorTable is a global in the original; keep it from window or localStorage
  const MirrorTable = window.MirrorTable ?? localStorage.getItem("MirrorTable") ?? 0;

  // ── Data ────────────────────────────────────────────────────────────────
  const [rows,     setRows]     = useState([EMPTY_ROW()]);
  const [bankList, setBankList] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [flash,    setFlash]    = useState(null); // { type: 'ok'|'err', msg }

  // ── Selection / editing ─────────────────────────────────────────────────
  const [selectedUid, setSelectedUid] = useState(null);
  const [editingCell, setEditingCell] = useState(null); // { uid, field }

  // ── Refs ─────────────────────────────────────────────────────────────────
  const reqCtrl  = useRef(new RequestController());
  const tableRef = useRef(null);

  // ─── Permission check on mount ─────────────────────────────────────────
  useEffect(() => {
    const menulist = JSON.parse(localStorage.getItem("menulist") || "null");
    if (!menulist) {
      MsgBox("Session Close Please Login !!!.").then(() => {
        window.location.href = "/Login/Index";
      });
      return;
    }
    const menudata = menulist.filter((o) => o.PageName === "Card Master");
    if (!menudata.length) {
      MsgBox("Page Access Permission Denied !!!");
      setTimeout(() => { window.location.href = "/Home"; }, 3000);
      setPermDenied(true);
      return;
    }
    if (menudata[0].View === 0) {
      MsgBox("Page Access Permission Denied !!!");
      setTimeout(() => { window.location.href = "/Home"; }, 3000);
      setPermDenied(true);
      return;
    }
    setPerms({
      View:   menudata[0].View,
      Add:    menudata[0].Add,
      Edit:   menudata[0].Edit,
      Delete: menudata[0].Delete,
    });

    loadBanks();
    loadModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Keyboard shortcuts (F1 = save, Esc = quit) ─────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.keyCode === 112) { // F1
        e.preventDefault();
        handleSave();
      }
      if (e.keyCode === 27) { // Esc
        e.preventDefault();
        MsgBoxYesNo("Do You Want To Quit Page?").then((r) => {
          if (r.isConfirmed) window.location.href = "/Home";
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  // ─── Flash auto-clear ────────────────────────────────────────────────────
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3500);
    return () => clearTimeout(t);
  }, [flash]);

  // ═══════════════════════════════════════════════════════════════════════
  // API helpers
  // ═══════════════════════════════════════════════════════════════════════
  async function loadBanks() {
    try {
      const res  = await fetch("/Bank/SelectBankList", {
        method:  "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body:    JSON.stringify({ Comid }),
      });
      const data = await res.json();
      if (data?.data) setBankList(data.data);
    } catch (err) {
      console.error("loadBanks:", err);
    }
  }

  async function loadModel() {
    setLoading(true);
    try {
      const res  = await fetch("/CardMaster/SelectCardMaster", {
        method:  "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body:    JSON.stringify({ Comid }),
      });
      const data = await res.json();
      if (!data.ok) { MsgBox(data.message); return; }

      const loaded = (data.data || []).map((obj) => ({
        _uid:      crypto.randomUUID(),
        Id:        obj.Id        ?? 0,
        CardName:  obj.CardName  ?? "",
        CardType:  obj.CardType  ?? "",
        Scharge:   parseFloat(obj.Scharge || 0).toFixed(2),
        BankName:  obj.BankName  ?? "",
        Bankrefid: obj.Bankrefid ?? 0,
        Active:    obj.Active    ?? true,
        EditMode:  0,
      }));
      loaded.push(EMPTY_ROW()); // blank new row at bottom
      setRows(loaded);
      setSelectedUid(loaded[loaded.length - 1]._uid);

      // Restore pop value if any
      const popVal = sessionStorage.getItem("POPValue");
      if (popVal) {
        setRows((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { ...copy[copy.length - 1], CardName: popVal };
          return copy;
        });
      }
    } catch (err) {
      MsgBox("Error loading Card Master data.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CRUD operations
  // ═══════════════════════════════════════════════════════════════════════
  async function handleSave() {
    if (!gridEmptyCheck()) return;

    const modified = rows.filter((r) => r.EditMode === 1);
    if (!modified.length) { MsgBox("No Data Modified, Cannot Update !!!."); return; }

    if (reqCtrl.current.isRunning()) return;
    reqCtrl.current.start();

    const confirm = await MsgBoxYesNo("Do you Want to Save the Card Details?");
    if (!confirm.isConfirmed) {
      addNewRow();
      reqCtrl.current.end();
      return;
    }

    setLoading(true);
    try {
      const res  = await fetch("/CardMaster/InsertCardMaster", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Comid,
          MirrorTable,
        },
        body: JSON.stringify(modified),
      });
      const data = await res.json();
      if (data.ok) {
        NotificationSuccess(data.message);
        await loadModel();
      } else {
        MsgBox(data.message);
      }
    } catch (err) {
      MsgBox("Error saving Card Master data.");
      console.error(err);
    } finally {
      setLoading(false);
      reqCtrl.current.end();
    }
  }

  async function handleDelete(row) {
    const rowIndex = rows.findIndex((r) => r._uid === row._uid);

    if (row.Id && row.Id !== 0) {
      const confirm = await MsgBoxYesNo(`Wish to Delete the Record ${row.CardName}?`);
      if (!confirm.isConfirmed) return;

      setLoading(true);
      try {
        const res  = await fetch("/CardMaster/DeleteCardMaster", {
          method:  "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body:    JSON.stringify({ Id: row.Id, Comid, MirrorTable }),
        });
        const data = await res.json();
        if (data.ok) {
          NotificationSuccess(data.message);
          setRows((prev) => {
            const next = prev.filter((r) => r._uid !== row._uid);
            return next.length ? next : [EMPTY_ROW()];
          });
        } else {
          MsgBox(data.message);
        }
      } catch (err) {
        MsgBox("Error deleting record.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    } else {
      // Unsaved row — just remove locally
      setRows((prev) => {
        const next = prev.filter((r) => r._uid !== row._uid);
        return next.length ? next : [EMPTY_ROW()];
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Validation helpers
  // ═══════════════════════════════════════════════════════════════════════
  function gridEmptyCheck() {
    // Remove last empty row if truly blank
    let current = [...rows];
    const last  = current[current.length - 1];
    if ((!last.CardName || last.CardName === "") && current.length > 1) {
      current = current.slice(0, -1);
      setRows(current);
    }

    for (let i = 0; i < current.length; i++) {
      const r = current[i];
      if (r.EditMode !== 1) continue;
      if (!r.CardName) {
        MsgBox("Enter All CardName in the Grid !!!.");
        setSelectedUid(r._uid);
        setEditingCell({ uid: r._uid, field: "CardName" });
        return false;
      }
      if (!r.CardType) {
        MsgBox("Select All CardType in the Grid !!!.");
        setSelectedUid(r._uid);
        setEditingCell({ uid: r._uid, field: "CardType" });
        return false;
      }
    }
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Row mutations
  // ═══════════════════════════════════════════════════════════════════════
  function updateCell(uid, field, value) {
    setRows((prev) =>
      prev.map((r) =>
        r._uid === uid
          ? { ...r, [field]: value, EditMode: 1 }
          : r
      )
    );
  }

  function addNewRow() {
    const nr = EMPTY_ROW();
    setRows((prev) => [...prev, nr]);
    setSelectedUid(nr._uid);
    setEditingCell({ uid: nr._uid, field: "CardName" });
  }

  // ─── On blur of Scharge — format to 2 dp ────────────────────────────────
  function handleSchargeBlur(uid, value) {
    updateCell(uid, "Scharge", valNum(value).toFixed(2));
  }

  // ─── CardName validation on Enter / Tab ──────────────────────────────────
  function handleCardNameKeyDown(e, uid) {
    if (e.key !== "Enter") return;
    const row = rows.find((r) => r._uid === uid);
    if (!row?.CardName?.trim()) { MsgBox("Enter Card Name!!!."); return; }
    // Duplicate check
    const dup = rows.some(
      (r) => r._uid !== uid && r.CardName?.trim().toLowerCase() === row.CardName.trim().toLowerCase()
    );
    if (dup) { MsgBox("Card Name already exists!!!."); return; }
    advanceFocus(uid, "CardName");
  }

  function advanceFocus(uid, currentField) {
    const fieldOrder = ["CardName", "CardType", "Scharge", "Bankrefid", "Active"];
    const idx = fieldOrder.indexOf(currentField);
    const nextField = fieldOrder[idx + 1];
    if (nextField) {
      setEditingCell({ uid, field: nextField });
    } else {
      // Move to next row's CardName
      const rowIdx = rows.findIndex((r) => r._uid === uid);
      if (rowIdx === rows.length - 1) {
        addNewRow();
      } else {
        const next = rows[rowIdx + 1];
        setSelectedUid(next._uid);
        setEditingCell({ uid: next._uid, field: "CardName" });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Render helpers
  // ═══════════════════════════════════════════════════════════════════════
  function isEditing(uid, field) {
    return editingCell?.uid === uid && editingCell?.field === field;
  }

  function CellText({ uid, field, align = "left", placeholder = "" }) {
    const row   = rows.find((r) => r._uid === uid);
    const value = row?.[field] ?? "";

    return isEditing(uid, field) ? (
      <input
        autoFocus
        className="mp-cell-input"
        style={{ textAlign: align }}
        value={value}
        placeholder={placeholder}
        onChange={(e) => updateCell(uid, field, e.target.value)}
        onBlur={() => {
          if (field === "Scharge") handleSchargeBlur(uid, value);
          setEditingCell(null);
        }}
        onKeyDown={(e) => {
          if (field === "CardName") handleCardNameKeyDown(e, uid);
          if (e.key === "Enter") {
            if (field === "Scharge") handleSchargeBlur(uid, value);
            advanceFocus(uid, field);
          }
          if (e.key === "Tab") { e.preventDefault(); advanceFocus(uid, field); }
        }}
      />
    ) : (
      <span
        style={{ display: "block", textAlign: align, minHeight: 20 }}
        onDoubleClick={() => setEditingCell({ uid, field })}
      >
        {value || <span style={{ color: "#bbb" }}>{placeholder}</span>}
      </span>
    );
  }

  function CellSelect({ uid, field, options, valueMember, displayMember }) {
    const row   = rows.find((r) => r._uid === uid);
    const value = row?.[field] ?? "";

    return (
      <select
        className="mp-cell-select"
        value={value}
        onChange={(e) => {
          updateCell(uid, field, e.target.value);
          // Also update display name for bank
          if (field === "Bankrefid") {
            const found = options.find((o) => String(o[valueMember]) === e.target.value);
            if (found) updateCell(uid, "BankName", found[displayMember]);
          }
          advanceFocus(uid, field);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") advanceFocus(uid, field);
        }}
      >
        <option value="">— Select —</option>
        {options.map((o) => (
          <option key={o[valueMember]} value={String(o[valueMember])}>
            {o[displayMember]}
          </option>
        ))}
      </select>
    );
  }

  function CellCheckbox({ uid, field }) {
    const row   = rows.find((r) => r._uid === uid);
    const value = row?.[field] ?? false;
    return (
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => updateCell(uid, field, e.target.checked)}
        style={{ cursor: "pointer", width: 15, height: 15 }}
      />
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  if (permDenied) return null;

  return (
    <div className="mp-wrap">
      {/* ── LOADER ── */}
      {loading && (
        <div className="mp-loader-ov">
          <div className="mp-ldr-box">
            <div className="mp-spin" />
            <div className="mp-ldr-msg">Please wait…</div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <header className="mp-hdr">
        <div className="mp-hdr-left">
          <div className="mp-icon">C</div>
          <div>
            <div className="mp-title">Card Master</div>
            <div className="mp-sub">Payment Card Configuration</div>
          </div>
        </div>
        <button className="mp-back" onClick={() => { window.location.href = "/Home"; }}>
          ← Back
        </button>
      </header>

      {/* ── BODY ── */}
      <main className="mp-body">
        {/* ── TOOLBAR ── */}
        <div className="mp-toolbar">
          <button
            className="mp-btn sv"
            onClick={handleSave}
            disabled={loading}
            title="F1 – Save"
          >
            💾 Save (F1)
          </button>
          <button
            className="mp-btn nw"
            onClick={addNewRow}
            title="Add new row"
          >
            ＋ New Row
          </button>

          {flash && (
            <span className={`mp-msg ${flash.type}`}>{flash.msg}</span>
          )}
        </div>

        {/* ── GRID ── */}
        <div className="mp-grid-wrap" ref={tableRef}>
          <table className="mp-tbl">
            <thead>
              <tr>
                <th style={{ width: 50  }}>S.No</th>
                <th style={{ width: 160 }}>Card Name</th>
                <th style={{ width: 160 }}>Card Type</th>
                <th style={{ width: 110 }}>Scharge</th>
                <th style={{ width: 180 }}>Bank Name</th>
                <th style={{ width: 80  }}>Active</th>
                <th style={{ width: 60  }}>Del</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const isSel  = row._uid === selectedUid;
                const isMod  = row.EditMode === 1;
                const isInact = !row.Active;
                return (
                  <tr
                    key={row._uid}
                    className={[
                      isSel   ? "sel"   : "",
                      isInact ? "inact" : "",
                      isMod   ? "mod"   : "",
                    ].join(" ")}
                    onClick={() => setSelectedUid(row._uid)}
                  >
                    {/* S.No */}
                    <td className="sno">{idx + 1}</td>

                    {/* Card Name */}
                    <td
                      onDoubleClick={() => setEditingCell({ uid: row._uid, field: "CardName" })}
                      onClick={() => {
                        setSelectedUid(row._uid);
                        if (!editingCell) setEditingCell({ uid: row._uid, field: "CardName" });
                      }}
                    >
                      <CellText uid={row._uid} field="CardName" placeholder="Card name…" />
                    </td>

                    {/* Card Type */}
                    <td>
                      <CellSelect
                        uid={row._uid}
                        field="CardType"
                        options={CARD_TYPE_LIST}
                        valueMember="value"
                        displayMember="label"
                      />
                    </td>

                    {/* Scharge */}
                    <td
                      onDoubleClick={() => setEditingCell({ uid: row._uid, field: "Scharge" })}
                      onClick={() => setSelectedUid(row._uid)}
                    >
                      <CellText uid={row._uid} field="Scharge" align="right" placeholder="0.00" />
                    </td>

                    {/* Bank Name (combo) */}
                    <td>
                      <CellSelect
                        uid={row._uid}
                        field="Bankrefid"
                        options={bankList}
                        valueMember="Id"
                        displayMember="AccountName"
                      />
                    </td>

                    {/* Active checkbox */}
                    <td style={{ textAlign: "center" }}>
                      <CellCheckbox uid={row._uid} field="Active" />
                    </td>

                    {/* Delete */}
                    <td style={{ textAlign: "center" }}>
                      <button
                        className="mp-del-btn"
                        title="Delete row (Del)"
                        onClick={(e) => { e.stopPropagation(); handleDelete(row); }}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── HINT BAR ── */}
        <div className="mp-hint">
          <kbd>F1</kbd> Save &nbsp;|&nbsp;
          <kbd>Esc</kbd> Quit &nbsp;|&nbsp;
          <kbd>Enter</kbd> Next cell &nbsp;|&nbsp;
          <kbd>Del</kbd> Delete row &nbsp;|&nbsp;
          Double-click a text cell to edit
        </div>
      </main>
    </div>
  );
}
