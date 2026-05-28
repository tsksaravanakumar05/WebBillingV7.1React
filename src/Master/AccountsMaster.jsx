import { useState, useEffect, useRef, useCallback } from "react";
//import axios from "axios";
import "./MasterPage.css";
import Topbar from "../components/Topbar";

// ─── Request Controller ───────────────────────────────────────────────────────
class Request_Controller {
  constructor(key) { this.key = key; this._running = false; }
  Is_Request_Running() { return this._running; }
  Start_Request()      { this._running = true; }
  End_Request()        { this._running = false; }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function MsgBoxYesNo(str) {
  return new Promise(resolve => resolve({ isConfirmed: window.confirm(str) }));
}
function MsgBox(str) { window.alert(str); }
function ValNum(v)   { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function NullToString(v) { return v == null ? "" : String(v); }

// ─── Build tree hierarchy from flat list ─────────────────────────────────────
// mirrors: dataAdapter.getRecordsHierarchy('Id','ParentId','items',[...])
function buildTree(flatList) {
  const map = {};
  const roots = [];
  flatList.forEach(item => {
    map[item.Id] = { ...item, items: [] };
  });
  flatList.forEach(item => {
    if (item.ParentId === 0 || item.ParentId === null) {
      roots.push(map[item.Id]);
    } else if (map[item.ParentId]) {
      map[item.ParentId].items.push(map[item.Id]);
    }
  });
  return roots;
}

// ─── Tree Node Component ──────────────────────────────────────────────────────
function TreeNode({ node, selectedId, onSelect, expandedIds, onToggle }) {
  const hasChildren = node.items && node.items.length > 0;
  const isExpanded  = expandedIds.has(node.Id);
  const isSelected  = selectedId === node.Id;

  return (
    <div style={{ userSelect: "none" }}>
      <div
        style={{
          display:      "flex",
          alignItems:   "center",
          padding:      "3px 6px",
          cursor:       "pointer",
          background:   isSelected ? "#fddfa0" : "transparent",
          borderRadius: 3,
          fontSize:     12,
          color:        "#1a2e4a",
          fontWeight:   isSelected ? 700 : 400,
        }}
        onClick={() => onSelect(node)}
      >
        {/* Expand/collapse toggle */}
        <span
          style={{ width: 16, display: "inline-block", flexShrink: 0 }}
          onClick={e => { e.stopPropagation(); if (hasChildren) onToggle(node.Id); }}
        >
          {hasChildren ? (isExpanded ? "▾" : "▸") : ""}
        </span>
        <span style={{ marginLeft: 2 }}>{node.AccountName}</span>
      </div>
      {hasChildren && isExpanded && (
        <div style={{ paddingLeft: 18 }}>
          {node.items.map(child => (
            <TreeNode
              key={child.Id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedIds={expandedIds}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Password Modal ───────────────────────────────────────────────────────────
function PasswordModal({ title, onClose, onSuccess, Comid, passwordType }) {
  const [pwd, setPwd] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    // mirrors: setTimeout 250ms then focus
    setTimeout(() => inputRef.current?.focus(), 250);
  }, []);

  async function handleKeyDown(e) {
    if (e.key === "Enter") {
      if (!pwd) return;
      let type = "";
      if (passwordType === 1)      type = "EditPassword";
      else if (passwordType === 0) type = "FormConfig";
      else if (passwordType === 2) type = "AdminPower";

      try {
        const res = await axios.post(
          "/Login/EditPassword",
          { password: pwd, type, Comid },
          { headers: { "Content-Type": "application/json; charset=utf-8" } }
        );
        if (res.data?.ok === true) {
          onSuccess(); // mirrors: '#LockEditWindow' close → triggers delete flow
        } else {
          alert("Invaild Password !!!.");
        }
      } catch {
        MsgBox("Technical Fault Contact Software Vendor  !!!.");
      }
    }
  }

  return (
    <div
      style={{
        position:        "fixed", inset: 0,
        background:      "rgba(10,20,40,.55)",
        display:         "flex", alignItems: "center", justifyContent: "center",
        zIndex:          9500,
      }}
    >
      <div style={{
        background: "#fff", borderRadius: 8, padding: "18px 22px",
        minWidth: 160, boxShadow: "0 8px 32px rgba(0,0,0,.25)",
      }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: "#1a2e4a", marginBottom: 10 }}>
          {title}
        </div>
        <input
          ref={inputRef}
          type="password"
          value={pwd}
          onChange={e => setPwd(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            border: "1px solid #d4dbe8", borderRadius: 3, padding: "3px 7px",
            fontSize: 12, width: "100%", height: 26, outline: "none",
          }}
          placeholder="Password"
        />
        <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
          <button
            className="mp-btn sv"
            style={{ flex: 1 }}
            onClick={() => {
              if (pwd) inputRef.current?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
            }}
          >
            OK
          </button>
          <button className="mp-btn dl" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function AccountsMaster() {

  // ── Permissions ──
  const [pageadd,    setPageadd]    = useState(0);
  const [pageedit,   setPageedit]   = useState(0);
  const [pagedelete, setPagedelete] = useState(0);
  const [permReady,  setPermReady]  = useState(false);

  // ── Session ──
  const [Comid,      setComid]      = useState(null);
  const MirrorTable  = useRef(null);

  // ── Account list (flat) — mirrors: var accountlist = [] ──
  const accountlist = useRef([]);

  // ── Tree state ──
  const [treeData,    setTreeData]    = useState([]);
  const [selectedNode, setSelectedNode] = useState(null); // mirrors: TreeAccounthead.jqxTree('getSelectedItem')
  const [expandedIds, setExpandedIds]  = useState(new Set());

  // ── Form fields — mirrors all jQuery val() fields ──
  const [txtParentAccountName, setTxtParentAccountName] = useState("");
  const [txtAccountName,       setTxtAccountName]       = useState("");
  const [txtDebit,             setTxtDebit]             = useState("0.00");
  const [txtCredit,            setTxtCredit]            = useState("0.00");
  const [txtGstNo,             setTxtGstNo]             = useState("");
  const [cmbGstOptions,        setCmbGstOptions]        = useState("NoGST");
  const [txtAddress1,          setTxtAddress1]          = useState("");
  const [txtAddress2,          setTxtAddress2]          = useState("");
  const [txtCity,              setTxtCity]              = useState("");
  const [txtMobileNo,          setTxtMobileNo]          = useState("");
  const [txtPincode,           setTxtPincode]           = useState("");
  const [chkHead,              setChkHead]              = useState(true);
  const [chkHeadDisabled,      setChkHeadDisabled]      = useState(false);

  // ── gstdetails visibility — mirrors: gstdetails.show() / .hide() ──
  const [showGstDetails, setShowGstDetails] = useState(false);

  // ── update flag — mirrors: var update = 0 ──
  const updateFlag = useRef(0);

  // ── selecteddetails — mirrors: var selecteddetails = [] ──
  const selecteddetails = useRef({});

  // ── Password modal ──
  const [pwdModalOpen,  setPwdModalOpen]  = useState(false);
  const [pwdModalTitle, setPwdModalTitle] = useState("");
  const passwordType = useRef(0); // mirrors: var PasswordType = 0

  // ── UI ──
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState(null);

  // ── Refs for focus ──
  const requestFlagRef         = useRef(new Request_Controller("AccountHead"));
  const refParentAccountName   = useRef(null);
  const refAccountName         = useRef(null);
  const refSave                = useRef(null);
  const refDebit               = useRef(null);
  const refCredit              = useRef(null);
  const refGstNo               = useRef(null);
  const refGstOptions          = useRef(null);
  const refAddress1            = useRef(null);
  const refAddress2            = useRef(null);
  const refCity                = useRef(null);
  const refMobileNo            = useRef(null);
  const refPincode             = useRef(null);

  // ─────────────────────────────────────────────────────────────────────────
  // 1. INIT
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const menulist = JSON.parse(localStorage.getItem("menulist"));
    if (!menulist) {
      MsgBox("Session Close Please Login !!!.");
      window.location.href = "/Index";
      return;
    }
    const menudata = menulist.filter(obj => obj.PageName === "Accounts Master");
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

    const comid = localStorage.getItem("Comid");
    MirrorTable.current = localStorage.getItem("MirrorTableOnline");
    setComid(comid);
    setPermReady(true);
  }, []);

  useEffect(() => {
    if (permReady && Comid !== null) {
      // mirrors: methods.init() → methods.loadtree(); methods.Clear();
      loadtree(Comid);
      Clear();

      // mirrors: POPValueE / POPValueB prefill
      const popE = NullToString(sessionStorage.getItem("POPValueE"));
      const popB = NullToString(sessionStorage.getItem("POPValueB"));
      if (popE !== "") {
        setTxtParentAccountName("Expense");
        setTxtAccountName(popE);
      }
      if (popB !== "") {
        setTxtParentAccountName("BANK");
        setTxtAccountName(popB);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permReady, Comid]);

  // ─────────────────────────────────────────────────────────────────────────
  // 2. KEYBOARD SHORTCUTS — F1 Save, F9 Delete, ESC Quit
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = async (e) => {
      // F1
      if (e.keyCode === 112) {
        e.preventDefault();
        MasterSaveFunction();
      }
      // F9 — mirrors delete with password
      if (e.keyCode === 120) {
        e.preventDefault();
        if (selectedNode != null) {
          const value = selectedNode.Id;
          const objlist = accountlist.current.filter(obj => obj.Id === value);
          if (objlist != null && objlist.length !== 0) {
            if (objlist[0].NoChild === 2) {
              MsgBox("AccountName Cannot Be Delete !!!.");
              return;
            }
          }
          if (value != null && value !== 0) {
            if (pagedelete === 1) {
              passwordType.current = 1;
              EditPasswordWindow(1);
            } else {
              MsgBox("Page Delete Permission Denied !!!.");
              return;
            }
          } else {
            MsgBox("Select From List to Delete!!!");
          }
        } else {
          MsgBox("Select From List to Delete!!!");
        }
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
  }, [selectedNode, pagedelete, txtAccountName, txtParentAccountName,
      txtDebit, txtCredit, txtGstNo, cmbGstOptions, txtAddress1,
      txtAddress2, txtCity, txtMobileNo, txtPincode, chkHead, Comid]);

  // ─────────────────────────────────────────────────────────────────────────
  // 3. LOAD TREE — mirrors methods.loadtree()
  // ─────────────────────────────────────────────────────────────────────────
  const loadtree = useCallback(async (comid) => {
    setLoading(true);
    try {
      const res  = await axios.post(
        "/AccountGroup/SelectAccountGroup",
        { Comid: comid },
        { headers: { "Content-Type": "application/json; charset=utf-8" } }
      );
      const data = res.data;
      accountlist.current = data.data ?? [];
      const tree = buildTree(accountlist.current);
      setTreeData(tree);
    } catch (err) {
      MsgBox("Network error loading account tree.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // 4. TREE SELECT — mirrors TreeAccounthead.on('select', ...)
  // ─────────────────────────────────────────────────────────────────────────
  function handleTreeSelect(node) {
    setSelectedNode(node);
    const parentName = node.AccountName;
    setTxtParentAccountName(parentName);

    const id      = node.Id;
    const objlist = accountlist.current.filter(obj => obj.Id === id);
    if (!objlist || objlist.length === 0) return;

    const Parentid = objlist[0].ParentId;

    // mirrors chkhead enable/disable logic
    if (Parentid === 0 || Parentid === null) {
      setChkHeadDisabled(false);
      setChkHead(true);
    } else {
      const objlist1 = accountlist.current.filter(obj => obj.Id === Parentid);
      if (objlist != null) {
        if (objlist[0].NoChild !== 0) {
          setChkHeadDisabled(false);
          setChkHead(true);
        } else {
          if (objlist1.length > 0 && (objlist1[0].NoChild === 1 || objlist1[0].NoChild === 0)) {
            setChkHeadDisabled(true);
          }
          setChkHead(false);
        }
      }
    }

    const Acparentname = objlist[0].ParentName;

    // mirrors: show/hide gstdetails based on SUNDRY CREDITORS / SUNDRY DEBTORS
    if (
      parentName === "SUNDRY CREDITORS" || parentName === "SUNDRY DEBTORS" ||
      Acparentname === "SUNDRY CREDITORS" || Acparentname === "SUNDRY DEBTORS"
    ) {
      setShowGstDetails(true);
      setTxtAddress1(NullToString(objlist[0].Address1));
      setTxtAddress2(NullToString(objlist[0].Address2));
      setTxtCity(NullToString(objlist[0].City));
      setTxtMobileNo(NullToString(objlist[0].MobileNo));
      setTxtPincode(NullToString(objlist[0].Pincode));
      setTxtGstNo(NullToString(objlist[0].GSTNo));
      setCmbGstOptions(NullToString(objlist[0].GSTType) === "" ? "NoGST" : NullToString(objlist[0].GSTType));
      setTxtCredit(ValNum(objlist[0].Credit).toFixed(2));
      setTxtDebit(ValNum(objlist[0].Debit).toFixed(2));
      // mirrors: frmtxtAccountname.jqxInput('focus')
      setTimeout(() => refAccountName.current?.focus(), 50);
    } else {
      setShowGstDetails(false);
      setTxtCredit(ValNum(objlist[0].Credit).toFixed(2));
      setTxtDebit(ValNum(objlist[0].Debit).toFixed(2));
      setTimeout(() => refAccountName.current?.focus(), 50);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. CLEAR — mirrors methods.Clear()
  // ─────────────────────────────────────────────────────────────────────────
  function Clear() {
    setTxtParentAccountName("");
    setTxtAccountName("");
    setCmbGstOptions("NoGST");
    setTxtAddress1("");
    setTxtAddress2("");
    setTxtCity("");
    setTxtGstNo("");
    setTxtMobileNo("");
    setTxtPincode("");
    setShowGstDetails(false);
    setTxtCredit("0.00");
    setTxtDebit("0.00");
    setSelectedNode(null);
    // mirrors: jqxTree uncheckAll + collapseAll
    setExpandedIds(new Set());
    setTimeout(() => refParentAccountName.current?.focus(), 50);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. MASTER CHECK — mirrors methods.MasterCheck()
  // ─────────────────────────────────────────────────────────────────────────
  function MasterCheck() {
    const acname  = txtAccountName;
    const parname = txtParentAccountName;
    const select  = selectedNode;

    if (select == null) {
      const popE = NullToString(sessionStorage.getItem("POPValueE"));
      const popB = NullToString(sessionStorage.getItem("POPValueB"));
      if (popE === "" && popB === "") {
        MsgBox("Select Tree Parent Name");
        const popV = sessionStorage.getItem("POPValue");
        if (popV !== "") {
          setTxtParentAccountName("");
        } else {
          Clear();
        }
        return false;
      } else {
        return true;
      }
    } else if (parname === "" || parname == null) {
      MsgBox("Enter Parent Account Name");
      Clear();
      return false;
    } else if (acname === "" || acname == null) {
      return "Update";
    } else {
      return true;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. FETCH DATA — mirrors methods.fetchdata()
  // ─────────────────────────────────────────────────────────────────────────
  function fetchdata() {
    let Child     = 0;
    let elementid = 0;
    let acname    = "";

    const popE = NullToString(sessionStorage.getItem("POPValueE"));
    const popB = NullToString(sessionStorage.getItem("POPValueB"));

    if (popE === "" && popB === "") {
      const items      = selectedNode;
      const TopParentId = items.ParentId; // mirrors items.value
      acname    = NullToString(txtAccountName).toUpperCase();
      elementid = items.Id;

      const objlist = accountlist.current.filter(obj => obj.Id === elementid);
      if (objlist[0].EditMode === false && objlist[0].NoChild === 0) {
        MsgBox("Child Account Add Not Allowed !!!.");
        return null;
      }
      const objlist1 = accountlist.current.filter(obj => obj.AccountName === acname);
      if (objlist1.length !== 0) {
        MsgBox("AccountName Already Exits !!!.");
        return null;
      }
      if (chkHead === true) {
        Child = 1;
      } else {
        Child = 0;
      }
    } else {
      if (popE !== "") {
        acname = NullToString(txtAccountName).toUpperCase();
        const objlist1 = accountlist.current.filter(obj => obj.AccountName === "EXPENSES");
        if (objlist1.length !== 0) elementid = objlist1[0].Id;
      }
      if (popB !== "") {
        acname = NullToString(txtAccountName).toUpperCase();
        const objlist1 = accountlist.current.filter(obj => obj.AccountName === "BANK");
        if (objlist1.length !== 0) elementid = objlist1[0].Id;
      }
    }

    let Id = 0;
    if (updateFlag.current !== 0) {
      Id = elementid;
    }

    const details = {
      Comid:       Comid,
      AccountName: acname,
      ParentId:    elementid,
      Id:          Id,
      Active:      1,
    };

    return details != null ? details : null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. FETCH DATA UPDATE — mirrors methods.fetchdataupdate()
  // ─────────────────────────────────────────────────────────────────────────
  function fetchdataupdate() {
    const items       = selectedNode;
    const TopParentId = items.ParentId; // mirrors items.value
    const acname      = txtParentAccountName;
    const elementid   = items.Id;

    const objlist = accountlist.current.filter(obj => obj.ParentId === elementid);
    if (objlist != null && objlist.length !== 0) {
      if (objlist[0].NoChild === 2) {
        MsgBox("Account Name Update Not Allowed !!!.");
        return null;
      }
    }
    const objlist1 = accountlist.current.filter(obj => obj.AccountName === acname && obj.Id !== elementid);
    if (objlist1.length !== 0) {
      MsgBox("AccountName Already Exits !!!.");
      return null;
    }

    let topParent = TopParentId;
    if (topParent === -1) topParent = null;

    // mirrors ValNum checks
    let debit  = txtDebit;
    let credit = txtCredit;
    if (ValNum(debit)  === 0) { debit  = "0.00"; setTxtDebit("0.00"); }
    if (ValNum(credit) === 0) { credit = "0.00"; setTxtCredit("0.00"); }
    if (ValNum(credit) !== 0 && ValNum(debit) !== 0) {
      MsgBox("Opening Balance Not Allowed !!!.");
      return null;
    }

    const details = {
      Comid:       Comid,
      AccountName: acname,
      ParentId:    topParent,
      Id:          elementid,
      Active:      1,
    };

    return details != null ? details : null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 9. SAVE ACCOUNT HEAD — mirrors methods.SaveAccounthead()
  // ─────────────────────────────────────────────────────────────────────────
  async function SaveAccounthead(objlist) {
    if (objlist == null) return;

    if (requestFlagRef.current.Is_Request_Running()) return;
    requestFlagRef.current.Start_Request();

    const reply = await MsgBoxYesNo("Do you Want to Save the Account Head Details?");
    if (reply.isConfirmed) {
      setLoading(true);
      try {
        const res  = await axios.post(
          "/AccountGroup/InsertAccountGroup",
          objlist,
          {
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "MirrorTable":  MirrorTable.current,
            },
          }
        );
        const data = res.data;
        if (data.ok) {
          requestFlagRef.current.End_Request();
          setMsg({ type: "ok", text: data.message });
          await loadtree(Comid);
          if (sessionStorage.getItem("POPStatus") === "ON") {
            sessionStorage.setItem("POPValue",   data.Id);
            sessionStorage.setItem("POPName",    data.AccountName);
            sessionStorage.setItem("POPStatus",  "OFF");
            window.parent?.document?.querySelector(".ui-dialog-content")?.closest("[role=dialog]")?.__jqxDialog?.close();
          } else {
            Clear();
          }
        } else {
          if (data.redis === false) {
            alert("Already Login Another User Please Login Again!!!");
            window.location.href = "/Login";
          } else {
            MsgBox(data.message);
          }
        }
      } catch {
        MsgBox("Network error saving account head.");
      } finally {
        setLoading(false);
        requestFlagRef.current.End_Request();
      }
    } else {
      requestFlagRef.current.End_Request();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 10. MASTER SAVE FUNCTION — mirrors methods.MasterSaveFunction()
  // ─────────────────────────────────────────────────────────────────────────
  function MasterSaveFunction() {
    const result = MasterCheck();
    if (result === "Update") {
      const objlist = fetchdataupdate();
      if (objlist !== null && objlist !== false) {
        SaveAccounthead(objlist);
      } else {
        MsgBox("Cannot Update!!!");
        return;
      }
    } else if (result === true) {
      const objlist = fetchdata();
      if (objlist !== null && objlist !== false) {
        SaveAccounthead(objlist);
      } else {
        MsgBox("Cannot Insert!!!");
        return;
      }
    } else {
      return;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 11. PASSWORD WINDOW — mirrors EditPasswordWindow()
  // ─────────────────────────────────────────────────────────────────────────
  function EditPasswordWindow(type) {
    let titlenew = "";
    if (type === 1)      titlenew = "Edit Pwd";
    else if (type === 0) titlenew = "Form Pwd";
    else if (type === 2) titlenew = "Admin Pwd";
    setPwdModalTitle(titlenew);
    setPwdModalOpen(true);
  }

  // mirrors: '#LockEditWindow'.on('close', ...) — triggers delete after password verified
  async function handlePasswordSuccess() {
    setPwdModalOpen(false);
    // mirrors: setTimeout 250ms then delete flow
    setTimeout(async () => {
      if (selectedNode == null) return;
      const value = selectedNode.Id;
      const label = selectedNode.AccountName;
      const str   = `Wish to Delete the Record ${label}?`;
      const reply = await MsgBoxYesNo(str);
      if (reply.isConfirmed) {
        setLoading(true);
        try {
          const res  = await axios.post(
            "/AccountGroup/DeleteAccountGroup",
            { Id: value, Comid: Comid, MirrorTable: MirrorTable.current },
            { headers: { "Content-Type": "application/json; charset=utf-8" } }
          );
          const data = res.data;
          if (data.ok) {
            setMsg({ type: "ok", text: data.message });
            await loadtree(Comid);
            Clear();
          } else {
            if (data.redis === false) {
              alert("Already Login Another User Please Login Again!!!");
              window.location.href = "/Login";
            } else {
              MsgBox(data.message);
            }
          }
        } catch {
          MsgBox("Network error deleting account.");
        } finally {
          setLoading(false);
        }
      }
    }, 250);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 12. ACCOUNT NAME keypress logic — mirrors frmtxtAccountname.keypress
  //     chkhead enable/disable + Enter navigation
  // ─────────────────────────────────────────────────────────────────────────
  function handleAccountNameChange(value) {
    setTxtAccountName(value);
    // mirrors: chkhead logic inside frmtxtAccountname keypress (fires on every char)
    if (chkHead === true && selectedNode != null) {
      const id      = selectedNode.Id;
      const objlist = accountlist.current.filter(obj => obj.Id === id);
      if (objlist && objlist.length > 0) {
        const Parentid = objlist[0].ParentId;
        if (Parentid === 0 || Parentid === null) {
          setChkHeadDisabled(false);
        } else {
          const objlist1 = accountlist.current.filter(obj => obj.Id === id);
          if (objlist1 != null && objlist1.length > 0) {
            if (objlist1[0].NoChild !== 0) {
              if (objlist1[0].NoChild === 2) {
                setChkHeadDisabled(false);
                setChkHead(false);
              } else {
                setChkHeadDisabled(true);
                setChkHead(false);
              }
            }
          }
        }
      }
    }
  }

  function handleAccountNameKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      const prodname = txtAccountName;
      const select   = selectedNode;
      if ((prodname !== "" && prodname != null) && select != null) {
        if (txtParentAccountName === "SUNDRY CREDITORS" || txtParentAccountName === "SUNDRY DEBTORS") {
          refGstNo.current?.select();
          refGstNo.current?.focus();
        } else {
          refDebit.current?.select();
          refDebit.current?.focus();
        }
      } else {
        MsgBox("Enter Account Name!!!");
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 13. TREE TOGGLE ─────────────────────────────────────────────────────────
  function toggleNode(id) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 14. RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="mp-wrap">

      {/* Loader */}
      {loading && (
        <div className="mp-loader-ov">
          <div className="mp-ldr-box">
            <div className="mp-spin" />
            <div className="mp-ldr-msg">Loading...</div>
          </div>
        </div>
      )}

      {/* Password Modal — mirrors #LockEditWindow */}
      {pwdModalOpen && (
        <PasswordModal
          title={pwdModalTitle}
          passwordType={passwordType.current}
          Comid={Comid}
          onClose={() => setPwdModalOpen(false)}
          onSuccess={handlePasswordSuccess}
        />
      )}
      <Topbar />

      {/* Header */}
      {/* <div className="mp-hdr">
        <div className="mp-hdr-left">
          <div className="mp-icon">A</div>
          <div>
            <div className="mp-title">Accounts Master</div>
            <div className="mp-sub">Accounts Master</div>
          </div>
        </div>
        <button className="mp-back" onClick={() => { window.location.href = "/Home"; }}>
          ← Home
        </button>
      </div> */}

      {/* Body */}
      <div className="mp-body" style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>

        {/* LEFT — Tree Panel */}
        <div style={{
          width: 280, flexShrink: 0, background: "#fff",
          border: "1px solid #d4dbe8", borderRadius: 6,
          overflow: "auto", minHeight: 500, maxHeight: "calc(100vh - 120px)",
          padding: 6,
        }}>
          <div style={{
            fontWeight: 700, fontSize: 11, color: "#fff",
            background: "#1a2e4a", padding: "6px 10px",
            borderRadius: "4px 4px 0 0", marginBottom: 4,
          }}>
            Account Tree
          </div>
          <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 200px)" }}>
            {treeData.map(node => (
              <TreeNode
                key={node.Id}
                node={node}
                selectedId={selectedNode?.Id}
                onSelect={handleTreeSelect}
                expandedIds={expandedIds}
                onToggle={toggleNode}
              />
            ))}
          </div>
        </div>

        {/* RIGHT — Form Panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Toolbar */}
          <div className="mp-toolbar">
            <button
              className="mp-btn sv"
              ref={refSave}
              onClick={() => { updateFlag.current = 0; MasterSaveFunction(); }}
              title="F1 – Save"
            >
              💾 Save (F1)
            </button>
            <button
              className="mp-btn nw"
              onClick={() => { updateFlag.current = 1; MasterSaveFunction(); }}
              title="Update selected"
            >
              ✏ Update
            </button>
            <button className="mp-btn dl" onClick={Clear} title="Clear form">
              ✕ Clear
            </button>
            {msg && <span className={`mp-msg ${msg.type}`}>{msg.text}</span>}
          </div>

          {/* Form */}
          <div style={{
            background: "#fff", border: "1px solid #d4dbe8",
            borderRadius: 6, padding: "14px 16px",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <tbody>

                {/* Parent Account Name */}
                <tr>
                  <td style={tdLbl}>Parent Account Name</td>
                  <td style={tdVal}>
                    <input
                      ref={refParentAccountName}
                      className="mp-cell-input"
                      type="text"
                      value={txtParentAccountName}
                      onChange={e => setTxtParentAccountName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const select = selectedNode;
                          if ((txtParentAccountName !== "" && txtParentAccountName != null) && select != null) {
                            if (txtParentAccountName === "SUNDRY CREDITORS" || txtParentAccountName === "SUNDRY DEBTORS") {
                              refAddress1.current?.select();
                              refAddress1.current?.focus();
                            } else {
                              refSave.current?.focus();
                            }
                          } else {
                            MsgBox("Select Parent Account Name !!!");
                          }
                        }
                      }}
                    />
                  </td>
                </tr>

                {/* Account Name */}
                <tr>
                  <td style={tdLbl}>Account Name</td>
                  <td style={tdVal}>
                    <input
                      ref={refAccountName}
                      className="mp-cell-input"
                      type="text"
                      value={txtAccountName}
                      onChange={e => handleAccountNameChange(e.target.value)}
                      onKeyDown={handleAccountNameKeyDown}
                    />
                  </td>
                </tr>

                {/* Is Head checkbox */}
                <tr>
                  <td style={tdLbl}>Is Head</td>
                  <td style={tdVal}>
                    <input
                      type="checkbox"
                      checked={chkHead}
                      disabled={chkHeadDisabled}
                      onChange={e => setChkHead(e.target.checked)}
                      style={{ width: 16, height: 16, cursor: chkHeadDisabled ? "not-allowed" : "pointer" }}
                    />
                  </td>
                </tr>

                {/* Debit */}
                <tr>
                  <td style={tdLbl}>Opening Debit</td>
                  <td style={tdVal}>
                    <input
                      ref={refDebit}
                      className="mp-cell-input"
                      type="text"
                      value={txtDebit}
                      onChange={e => setTxtDebit(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          refCredit.current?.select();
                          refCredit.current?.focus();
                        }
                      }}
                      style={{ textAlign: "right" }}
                    />
                  </td>
                </tr>

                {/* Credit */}
                <tr>
                  <td style={tdLbl}>Opening Credit</td>
                  <td style={tdVal}>
                    <input
                      ref={refCredit}
                      className="mp-cell-input"
                      type="text"
                      value={txtCredit}
                      onChange={e => setTxtCredit(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          refSave.current?.focus();
                        }
                      }}
                      style={{ textAlign: "right" }}
                    />
                  </td>
                </tr>

                {/* GST Details — mirrors: gstdetails.show() / .hide() */}
                {showGstDetails && (
                  <>
                    <tr>
                      <td colSpan={2} style={{
                        background: "#1a2e4a", color: "#fff", fontWeight: 700,
                        fontSize: 11, padding: "5px 8px", borderRadius: 3, marginTop: 4,
                      }}>
                        GST Details
                      </td>
                    </tr>
                    <tr>
                      <td style={tdLbl}>GST No</td>
                      <td style={tdVal}>
                        <input
                          ref={refGstNo}
                          className="mp-cell-input"
                          type="text"
                          value={txtGstNo}
                          onChange={e => setTxtGstNo(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              refGstOptions.current?.focus();
                            }
                          }}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td style={tdLbl}>GST Type</td>
                      <td style={tdVal}>
                        <select
                          ref={refGstOptions}
                          className="mp-cell-select"
                          value={cmbGstOptions}
                          onChange={e => setCmbGstOptions(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              refAddress1.current?.select();
                              refAddress1.current?.focus();
                            }
                          }}
                        >
                          <option value="NoGST">No GST</option>
                          <option value="Registered">Registered</option>
                          <option value="Unregistered">Unregistered</option>
                          <option value="Composition">Composition</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td style={tdLbl}>Address 1</td>
                      <td style={tdVal}>
                        <input
                          ref={refAddress1}
                          className="mp-cell-input"
                          type="text"
                          value={txtAddress1}
                          onChange={e => setTxtAddress1(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              refAddress2.current?.select();
                              refAddress2.current?.focus();
                            }
                          }}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td style={tdLbl}>Address 2</td>
                      <td style={tdVal}>
                        <input
                          ref={refAddress2}
                          className="mp-cell-input"
                          type="text"
                          value={txtAddress2}
                          onChange={e => setTxtAddress2(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              refCity.current?.select();
                              refCity.current?.focus();
                            }
                          }}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td style={tdLbl}>City</td>
                      <td style={tdVal}>
                        <input
                          ref={refCity}
                          className="mp-cell-input"
                          type="text"
                          value={txtCity}
                          onChange={e => setTxtCity(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              refPincode.current?.select();
                              refPincode.current?.focus();
                            }
                          }}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td style={tdLbl}>Pincode</td>
                      <td style={tdVal}>
                        <input
                          ref={refPincode}
                          className="mp-cell-input"
                          type="text"
                          value={txtPincode}
                          onChange={e => setTxtPincode(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              refMobileNo.current?.select();
                              refMobileNo.current?.focus();
                            }
                          }}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td style={tdLbl}>Mobile No</td>
                      <td style={tdVal}>
                        <input
                          ref={refMobileNo}
                          className="mp-cell-input"
                          type="text"
                          value={txtMobileNo}
                          onChange={e => setTxtMobileNo(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              refDebit.current?.select();
                              refDebit.current?.focus();
                            }
                          }}
                        />
                      </td>
                    </tr>
                  </>
                )}

              </tbody>
            </table>
          </div>

          {/* Hint bar */}
          <div className="mp-hint">
            <kbd>F1</kbd> Save &nbsp;|&nbsp;
            <kbd>F9</kbd> Delete (requires password) &nbsp;|&nbsp;
            <kbd>Esc</kbd> Quit &nbsp;|&nbsp;
            <kbd>Enter</kbd> Next Field
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Style helpers ────────────────────────────────────────────────────────────
const tdLbl = {
  width:       140, padding: "5px 8px 5px 0",
  fontWeight:  600, color: "#4a5568", fontSize: 11,
  whiteSpace:  "nowrap", verticalAlign: "middle",
};
const tdVal = {
  padding: "4px 0", verticalAlign: "middle",
};
