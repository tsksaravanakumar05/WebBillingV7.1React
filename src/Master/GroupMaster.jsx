import { useState, useEffect, useRef, useCallback } from "react";

// ─── Request Controller (mirrors original class) ───────────────────────────
class Request_Controller {
  constructor(key) {
    this.key = key;
    this._running = false;
  }
  Is_Request_Running() { return this._running; }
  Start_Request()      { this._running = true; }
  End_Request()        { this._running = false; }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function CheckDuplicateRows(rows, field, label, setMsg) {
  const vals = rows
    .filter(r => r[field] !== "" && r[field] != null)
    .map(r => String(r[field]).trim().toLowerCase());
  const dupes = vals.filter((v, i) => vals.indexOf(v) !== i);
  if (dupes.length > 0) {
    setMsg({ type: "err", text: `Duplicate ${label} found!` });
    return false;
  }
  return true;
}

// ─── Confirm / Alert helpers (using browser dialogs to replicate MsgBoxYesNo / MsgBox) ──
async function MsgBoxYesNo(str) {
  return new Promise((resolve) => {
    const confirmed = window.confirm(str);
    resolve({ isConfirmed: confirmed });
  });
}
function MsgBox(str) {
  window.alert(str);
}

// ─── Inline CSS (from provided stylesheet) ──────────────────────────────────
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
html, body, #root { height: 100%; margin: 0; padding: 0; }
.mp-wrap { min-height: 100vh; display: flex; flex-direction: column; background: #eef1f7; font-size: 12.5px; }
.mp-hdr { background: #1a2e4a; display: flex; align-items: center; justify-content: space-between; padding: 0 18px; height: 50px; flex-shrink: 0; box-shadow: 0 3px 10px rgba(0,0,0,.28); }
.mp-hdr-left { display: flex; align-items: center; gap: 10px; }
.mp-icon { width: 32px; height: 32px; border-radius: 6px; background: #e8a020; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 900; color: #fff; flex-shrink: 0; }
.mp-title { font-size: 14px; font-weight: 700; color: #fff; }
.mp-sub { font-size: 10px; color: rgba(255,255,255,.5); letter-spacing: 1px; text-transform: uppercase; margin-top: 1px; }
.mp-back { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.18); color: #fff; padding: 5px 14px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; transition: all .15s; }
.mp-back:hover { background: #e8a020; border-color: #e8a020; }
.mp-body { flex: 1; padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; max-width: 1100px; width: 100%; margin: 0 auto; }
.mp-toolbar { background: #fff; border: 1px solid #d4dbe8; border-left: 4px solid #e8a020; border-radius: 6px; padding: 8px 12px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.mp-btn { display: flex; align-items: center; gap: 4px; border: 1px solid transparent; border-radius: 4px; padding: 5px 12px; font-size: 11.5px; font-weight: 600; cursor: pointer; transition: all .12s; height: 30px; }
.mp-btn.sv { background: #1a2e4a; color: #fff; border-color: #1a2e4a; }
.mp-btn.sv:hover { background: #e8a020; border-color: #e8a020; }
.mp-btn.sv:disabled { opacity: .45; cursor: not-allowed; }
.mp-btn.nw { background: #fff; color: #6f42c1; border-color: #6f42c1; }
.mp-btn.nw:hover { background: #6f42c1; color: #fff; }
.mp-btn.dl { background: #fff; color: #dc3545; border-color: #dc3545; }
.mp-btn.dl:hover { background: #dc3545; color: #fff; }
.mp-msg { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 4px; margin-left: 6px; }
.mp-msg.ok { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
.mp-msg.err { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
.mp-grid-wrap { background: #fff; border: 1px solid #d4dbe8; border-radius: 6px; overflow: auto; flex: 1; }
.mp-tbl { border-collapse: collapse; width: 100%; min-width: 400px; table-layout: fixed; }
.mp-tbl thead tr { position: sticky; top: 0; z-index: 2; }
.mp-tbl th { background: #1a2e4a; color: #fff; border: 1px solid #253d5e; padding: 7px 10px; font-size: 11px; font-weight: 600; text-align: left; white-space: nowrap; }
.mp-tbl td { border: 1px solid #eaecf4; padding: 3px 5px; font-size: 12px; color: #1a2e4a; }
.mp-tbl tbody tr { cursor: pointer; transition: background .07s; }
.mp-tbl tbody tr:nth-child(even) { background: #f5f7fc; }
.mp-tbl tbody tr:hover { background: #fef3e0; }
.mp-tbl tbody tr.sel { background: #fddfa0 !important; }
.mp-tbl tbody tr.inact td { color: #bbb; }
.mp-tbl tbody tr.mod td:first-child { border-left: 3px solid #e8a020; }
.mp-tbl td.sno { text-align: center; color: #8b99b5; font-size: 11px; }
.mp-cell-input { border: 1px solid #d4dbe8; border-radius: 3px; padding: 3px 7px; font-size: 12px; width: 100%; height: 26px; outline: none; background: #fff; color: #1a2e4a; transition: border-color .12s; }
.mp-cell-input:focus { border-color: #e8a020; box-shadow: 0 0 0 2px rgba(232,160,32,.15); }
.mp-cell-select { border: 1px solid #d4dbe8; border-radius: 3px; padding: 2px 5px; font-size: 12px; width: 100%; height: 26px; outline: none; background: #fff; color: #1a2e4a; cursor: pointer; }
.mp-cell-select:focus { border-color: #e8a020; }
.mp-del-btn { background: none; border: none; cursor: pointer; font-size: 14px; padding: 2px 5px; border-radius: 3px; transition: background .1s; line-height: 1; }
.mp-del-btn:hover { background: #fee2e2; }
.mp-hint { background: #f5f7fc; border: 1px solid #e0e5f0; border-radius: 4px; padding: 6px 12px; font-size: 10.5px; color: #8b99b5; flex-shrink: 0; }
.mp-hint kbd { background: #1a2e4a; color: #fff; font-size: 9.5px; font-weight: 700; padding: 1px 5px; border-radius: 3px; font-family: 'Inter', monospace; }
.mp-loader-ov { position: fixed; inset: 0; background: rgba(10,20,40,.48); display: flex; align-items: center; justify-content: center; z-index: 9000; }
.mp-ldr-box { background: #fff; border-radius: 8px; padding: 22px 32px; display: flex; flex-direction: column; align-items: center; gap: 10px; box-shadow: 0 16px 48px rgba(0,0,0,.25); min-width: 150px; }
.mp-spin { width: 32px; height: 32px; border: 4px solid #eee; border-top-color: #e8a020; border-radius: 50%; animation: mp-spin .55s linear infinite; }
@keyframes mp-spin { to { transform: rotate(360deg); } }
.mp-ldr-msg { font-size: 12px; color: #4a5568; font-weight: 600; }
`;

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function GroupMaster() {
  // ── Permission flags ──
  const [pageview,   setPageview]   = useState(0);
  const [pageadd,    setPageadd]    = useState(0);
  const [pageedit,   setPageedit]   = useState(0);
  const [pagedelete, setPagedelete] = useState(0);
  const [permReady,  setPermReady]  = useState(false);

  // ── Session / company ──
  const [Comid,     setComid]     = useState(null);
  const [IdComList, setIdComList] = useState(null);
  const [MirrorTable] = useState(() => window.MirrorTable ?? 0); // global if set

  // ── Grid rows ──
  const [rows, setRows]           = useState([]);      // { uid, Id, GroupName, Active, EditMode }
  const [selectedUid, setSelectedUid] = useState(null);

  // ── UI state ──
  const [loading, setLoading]     = useState(false);
  const [msg, setMsg]             = useState(null);    // { type:'ok'|'err', text }

  // ── Refs ──
  const requestFlagRef = useRef(new Request_Controller("Group"));
  const uidCounter     = useRef(0);
  const inputRefs      = useRef({});  // uid → input element

  // ── Inject styles once ──
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = STYLES;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // 1. INIT — mirrors $(document).ready and methods.init()
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Session check
    const menulist = JSON.parse(localStorage.getItem("menulist"));
    if (!menulist) {
      MsgBox("Session Close Please Login !!!.");
      window.location.href = "/Login/Index";
      return;
    }

    const menudata = menulist.filter(obj => obj.PageName === "Item Master");
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

    setPageview(menudata[0].View);
    setPageadd(menudata[0].Add);
    setPageedit(menudata[0].Edit);
    setPagedelete(menudata[0].Delete);

    // Company resolution
    let comid = localStorage.getItem("Comid");
    const idComList = localStorage.getItem("IdComList");
    const MComid    = localStorage.getItem("MComid");
    const MainSet   = JSON.parse(localStorage.getItem("Mainsetting"));
    const CommonCompany = MainSet?.[0]?.CommonCompany;
    if (CommonCompany === true) comid = MComid;

    setComid(comid);
    setIdComList(idComList);
    setPermReady(true);
  }, []);

  // Load data once permissions are ready
  useEffect(() => {
    if (permReady && Comid !== null) {
      loadCounter(Comid, IdComList);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permReady, Comid]);

  // ─────────────────────────────────────────────────────────────────────────
  // 2. KEYBOARD SHORTCUTS — F1 Save, ESC Quit
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = async (e) => {
      // F1 → Save
      if (e.keyCode === 112) {
        e.preventDefault();
        await handleSave();
      }
      // F2 → (original does nothing)
      if (e.keyCode === 113) {
        e.preventDefault();
      }
      // ESC → Quit
      if (e.keyCode === 27) {
        e.preventDefault();
        const reply = await MsgBoxYesNo("Do You Want To Quit Page?");
        if (reply.isConfirmed) {
          if (sessionStorage.getItem("POPStatus") === "ON") {
            sessionStorage.setItem("POPValue", -1);
            sessionStorage.setItem("POPStatus", "OFF");
            window.parent?.document?.querySelector(".ui-dialog-content")?.closest("[role=dialog]")?.__jqxDialog?.close();
          } else {
            window.location.href = "/Home";
          }
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, pageadd, pageedit, pagedelete, Comid, IdComList]);

  // ─────────────────────────────────────────────────────────────────────────
  // 3. LOAD DATA — mirrors methods.loadCounter()
  // ─────────────────────────────────────────────────────────────────────────
  const loadCounter = useCallback(async (comid, idComList) => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/Group/SelectGroup", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ Comid: comid }),
      });
      const data = await res.json();
      if (data.ok === true) {
        const loaded = data.data.map(item => ({
          uid:       ++uidCounter.current,
          Id:        item.Id,
          GroupName: item.GroupName,
          Active:    item.Active,
          EditMode:  0,
        }));
        // Add blank new row at end (mirrors addrow())
        loaded.push(makeNewRow());
        setRows(loaded);

        // Focus last row GroupName
        setTimeout(() => focusRow(loaded[loaded.length - 1].uid), 80);

        // POPValue pre-fill
        const popVal = sessionStorage.getItem("POPValue");
        if (popVal && popVal !== "") {
          setRows(prev => {
            const next = [...prev];
            next[next.length - 1] = { ...next[next.length - 1], GroupName: popVal, EditMode: 1 };
            return next;
          });
        }
      } else {
        MsgBox(data.message);
      }
    } catch (xhr) {
      MsgBox("Network error loading groups.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // 4. HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  function makeNewRow() {
    return { uid: ++uidCounter.current, Id: null, GroupName: "", Active: true, EditMode: 0 };
  }

  function addRow(currentRows) {
    const next = [...currentRows, makeNewRow()];
    setRows(next);
    return next;
  }

  function focusRow(uid) {
    const el = inputRefs.current[uid];
    if (el) el.focus();
  }

  // mirrors gridemptycheck()
  function gridemptycheck(currentRows, setM) {
    let cleaned = [...currentRows];
    // Remove last row if empty and there's more than one row
    if (cleaned.length > 1) {
      const last = cleaned[cleaned.length - 1];
      if (!last.GroupName || last.GroupName.trim() === "") {
        cleaned = cleaned.slice(0, -1);
        setRows(cleaned);
      }
    }

    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i].EditMode === 1) {
        if (!cleaned[i].GroupName || cleaned[i].GroupName.trim() === "") {
          MsgBox("Enter All Group Name in the Grid !!!.");
          setTimeout(() => focusRow(cleaned[i].uid), 30);
          return { ok: false, rows: cleaned };
        }
      }
    }
    return { ok: true, rows: cleaned };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. SAVE — mirrors F1 handler
  // ─────────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    let flag = 1;
    const currentRows = rows;

    if (pageadd === 0 && pageedit === 0) {
      MsgBox("Page Add & Update Permission Denied !!!.");
      flag = 0;
    }

    const checkResult = gridemptycheck(currentRows, setMsg);
    if (!checkResult.ok) return;
    const cleanRows = checkResult.rows;

    let getdata = [];
    if (flag === 1) {
      if (pageadd === 1 && pageedit === 1) {
        getdata = cleanRows.filter(obj => obj.EditMode === 1);
        if (getdata.length === 0) {
          MsgBox("No Data Modified,Cannot Update !!!.");
          flag = 0;
        }
      } else if (pageadd === 1 && pageedit === 0) {
        getdata = cleanRows.filter(obj => obj.EditMode === 1 && obj.Id == null);
        if (getdata.length === 0) {
          const tempdata = cleanRows.filter(obj => obj.EditMode === 1);
          MsgBox(tempdata.length === 0
            ? "No Data Modified,Cannot Update !!!."
            : "Page Edit Permission Denied !!!.");
          flag = 0;
        }
      } else if (pageedit === 1 && pageadd === 0) {
        getdata = cleanRows.filter(obj => obj.EditMode === 1 && obj.Id != null);
        if (getdata.length === 0) {
          const tempdata = cleanRows.filter(obj => obj.EditMode === 1);
          MsgBox(tempdata.length === 0
            ? "No Data Modified,Cannot Update !!!."
            : "Page Add Permission Denied !!!.");
          flag = 0;
        }
      }
    }

    if (flag === 0) {
      // Addrowfunc equivalent
      setRows(prev => {
        const next = addRow(prev);
        setTimeout(() => focusRow(next[next.length - 1].uid), 30);
        return next;
      });
      return;
    }

    if (!CheckDuplicateRows(cleanRows, "GroupName", "Group Name", setMsg)) return;

    if (requestFlagRef.current.Is_Request_Running()) return;
    requestFlagRef.current.Start_Request();

    const reply = await MsgBoxYesNo("Do you Want to Save the Group Details?");
    if (reply.isConfirmed) {
      setLoading(true);
      try {
        const res = await fetch("/Group/InsertGroup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Comid": Comid,
            "MirrorTable": MirrorTable,
            "IdComList": IdComList,
          },
          body: JSON.stringify(getdata),
        });
        const data = await res.json();
        if (data.ok) {
          setMsg({ type: "ok", text: data.message });
          await loadCounter(Comid, IdComList);
          if (sessionStorage.getItem("POPStatus") === "ON") {
            sessionStorage.setItem("POPValue", data.Id);
            sessionStorage.setItem("POPName", data.Name);
            sessionStorage.setItem("POPStatus", "OFF");
            window.parent?.document?.querySelector(".ui-dialog-content")?.closest("[role=dialog]")?.__jqxDialog?.close();
          }
        } else {
          MsgBox(data.message);
        }
      } catch (err) {
        MsgBox("Network error saving groups.");
      } finally {
        setLoading(false);
        requestFlagRef.current.End_Request();
      }
    } else {
      // Addrowfunc on cancel
      setRows(prev => {
        const next = [...prev, makeNewRow()];
        setTimeout(() => focusRow(next[next.length - 1].uid), 30);
        return next;
      });
      requestFlagRef.current.End_Request();
    }
  }, [rows, pageadd, pageedit, Comid, IdComList, MirrorTable, loadCounter]);

  // ─────────────────────────────────────────────────────────────────────────
  // 6. DELETE ROW — mirrors keydown Delete (keyCode 46)
  // ─────────────────────────────────────────────────────────────────────────
  const handleDeleteRow = useCallback(async (uid) => {
    const row = rows.find(r => r.uid === uid);
    if (!row) return;

    if (row.Id != null && row.Id !== 0) {
      // Persisted row → confirm + AJAX delete
      if (pagedelete !== 1) {
        MsgBox("Page Delete Permission Denied !!!.");
        return;
      }
      const str = `Wish to Delete the Record ${row.GroupName}?`;
      const reply = await MsgBoxYesNo(str);
      if (reply.isConfirmed) {
        setLoading(true);
        try {
          const res = await fetch("/Group/DeleteGroup", {
            method: "POST",
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "IdComList": IdComList,
            },
            body: JSON.stringify({ Id: row.Id, Comid: Comid, MirrorTable: MirrorTable }),
          });
          const data = await res.json();
          if (data.ok) {
            setMsg({ type: "ok", text: data.message });
            setRows(prev => {
              const next = prev.filter(r => r.uid !== uid);
              // Focus last row after delete
              setTimeout(() => {
                if (next.length > 0) focusRow(next[next.length - 1].uid);
              }, 50);
              return next;
            });
          } else {
            MsgBox(data.message);
          }
        } catch {
          MsgBox("Network error deleting group.");
        } finally {
          setLoading(false);
        }
      }
    } else {
      // Unsaved row → just remove from state (mirrors DeleteRow with id=0)
      setRows(prev => {
        const next = prev.filter(r => r.uid !== uid);
        setTimeout(() => {
          if (next.length > 0) focusRow(next[next.length - 1].uid);
        }, 30);
        return next;
      });
    }
  }, [rows, pagedelete, Comid, IdComList, MirrorTable]);

  // ─────────────────────────────────────────────────────────────────────────
  // 7. CELL CHANGE HANDLERS
  // ─────────────────────────────────────────────────────────────────────────
  function handleGroupNameChange(uid, value) {
    // Mirrors keypress validation: max 200 chars, string type
    if (value.length > 200) return;
    setRows(prev =>
      prev.map(r => r.uid === uid ? { ...r, GroupName: value, EditMode: 1 } : r)
    );
  }

  function handleActiveChange(uid, checked) {
    setRows(prev =>
      prev.map(r => r.uid === uid ? { ...r, Active: checked, EditMode: 1 } : r)
    );
  }

  // ── Enter key navigation (mirrors keydown Enter in grid) ──
  function handleGroupNameKeyDown(e, uid, rowIndex) {
    if (e.key === "Enter") {
      e.preventDefault();
      const row = rows.find(r => r.uid === uid);
      const value = row?.GroupName;

      if (!value || value.trim() === "") {
        MsgBox("Enter Group Name!!!.");
        return;
      }

      if (!CheckDuplicateRows(rows, "GroupName", "Group Name", setMsg)) return;

      // Move to next row or add new row (GirdNextCell equivalent)
      if (rowIndex === rows.length - 1) {
        // last row → add new
        setRows(prev => {
          const next = [...prev, makeNewRow()];
          setTimeout(() => focusRow(next[next.length - 1].uid), 30);
          return next;
        });
      } else {
        const nextRow = rows[rowIndex + 1];
        focusRow(nextRow.uid);
      }
    }

    // Delete key (keyCode 46) on a cell — handled by row delete button
    if (e.key === "Delete" && e.shiftKey) {
      handleDeleteRow(uid);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. ADD ROW BUTTON — mirrors methods.Addrowfunc()
  // ─────────────────────────────────────────────────────────────────────────
  function handleAddRow() {
    setRows(prev => {
      const next = [...prev, makeNewRow()];
      setTimeout(() => focusRow(next[next.length - 1].uid), 30);
      return next;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 9. RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="mp-wrap">
      {/* Loader overlay */}
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
          <div className="mp-icon">G</div>
          <div>
            <div className="mp-toolbar-title">Group Master</div>
            <div className="mp-sub">Item Master</div>
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
            disabled={pageadd === 0 && pageedit === 0}
            title="F1 – Save"
          >
            💾 Save (F1)
          </button>
          <button className="mp-btn nw" onClick={handleAddRow} title="Add new row">
            ＋ New Row
          </button>
          {msg && (
            <span className={`mp-msg ${msg.type}`}>{msg.text}</span>
          )}


<div className="mp-toolbar-title">Group Master</div>
        </div>

        {/* Grid */}
        <div className="mp-grid-wrap">
          <table className="mp-tbl">
            <thead>
              <tr>
                <th style={{ width: 50 }}>S.No</th>
                <th style={{ width: 300 }}>Group Name</th>
                <th style={{ width: 80 }}>Active</th>
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

                  {/* Group Name */}
                  <td>
                    <input
                      ref={el => { if (el) inputRefs.current[row.uid] = el; }}
                      className="mp-cell-input"
                      type="text"
                      maxLength={200}
                      value={row.GroupName ?? ""}
                      onChange={e => handleGroupNameChange(row.uid, e.target.value)}
                      onKeyDown={e => handleGroupNameKeyDown(e, row.uid, idx)}
                      onFocus={() => setSelectedUid(row.uid)}
                    />
                  </td>

                  {/* Active checkbox */}
                  <td style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={row.Active === true || row.Active === 1}
                      onChange={e => handleActiveChange(row.uid, e.target.checked)}
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
          <kbd>Del</kbd> Delete Row (use 🗑 button) &nbsp;|&nbsp;
          <kbd>Esc</kbd> Quit
        </div>
      </div>
    </div>
  );
}
