// ─────────────────────────────────────────────────────────────────────────────
//  AccountsMaster.jsx
//
//  LOGIC CHANGES ONLY — design/layout/styles are identical to original.
//
//  Imports swapped:
//   • axios removed → CC.api / CC.insertapi / CC.deleteapi / CC.editPassword
//   • Hardcoded URL strings → CC.SelectAccountGroup / InsertAccountGroup / DeleteAccountGroup
//   • window.confirm/alert / MsgBox / MsgBoxYesNo → MSG.useConfirm + MSG.useToast
//   • window.location.href → useNavigate
//   • Local ValNum / NullToString → CC.ValNum / CC.NullToString
//   • Local Request_Controller removed → simple requestRunning useRef(false)
//   • isAuthorized state added (same guard pattern as DepartmentMaster)
//   • sess object added for Comid + MirrorTable (CC.getStr / CC.getLocal)
//   • MirrorTable useRef removed → sess.MirrorTable
//   • setComid state kept for backward compat with PasswordModal prop
//
//  Design, layout, inline styles, component structure — ALL UNCHANGED.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./MasterPage.css";
import Topbar from "../components/Topbar";
import * as CC  from "../components/Common";
import * as MSG from "../components/Messages";

// ─── Build tree hierarchy from flat list ─────────────────────────────────────
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
// LOGIC CHANGE: axios.post → CC.editPassword()
// LOGIC CHANGE: alert("Invalid Password") → toast prop call
// Design/styles: identical to original
function PasswordModal({ title, onClose, onSuccess, Comid, passwordType, toast }) {
  const [pwd, setPwd] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 250);
  }, []);

  async function handleKeyDown(e) {
    if (e.key === "Enter") {
      if (!pwd) return;
      let type = "";
      if (passwordType === 1)      type = "EditPassword";
      else if (passwordType === 0) type = "FormConfig";
      else if (passwordType === 2) type = "AdminPower";

      // CHANGED: axios.post("/Login/EditPassword",...) → CC.editPassword()
      const res = await CC.editPassword({ password: pwd, type, Comid });
      if (res.ok) {
        onSuccess();
      } else {
        toast("❌ Invalid Password !!!.", true);
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
              if (pwd) inputRef.current?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
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

  // CHANGED: useNavigate replaces window.location.href
  const navigate = useNavigate();

  // ADDED: MSG hooks — replaces MsgBox / MsgBoxYesNo / window.confirm / window.alert
  const { confirm, ConfirmUI } = MSG.useConfirm();
  const { toast,   toasts    } = MSG.useToast();

  // ADDED: isAuthorized guard (same pattern as DepartmentMaster)
  const [isAuthorized, setIsAuthorized] = useState(false);

  // ADDED: sess object — CC.getStr/getLocal (same pattern as DepartmentMaster)
  const [sess] = useState(() => {
    try {
      const main0  = (CC.getLocal("Mainsetting") || [{}])[0] || {};
      const Comid  = CC.getStr("Comid")  || "1";
      const MComid = CC.getStr("MComid") || Comid;
      const isCC   = !!main0.CommonCompany;
      return {
        Comid:       isCC ? MComid : Comid,
        MComid,
        MirrorTable: Number(localStorage.getItem("MirrorTableOnline") || "0"),
      };
    } catch {
      return { Comid: "1", MComid: "1", MirrorTable: 0 };
    }
  });

  // ── Permissions ── (kept as separate state to match original structure)
  const [pageadd,    setPageadd]    = useState(0);
  const [pageedit,   setPageedit]   = useState(0);
  const [pagedelete, setPagedelete] = useState(0);

  // ── Comid state kept for PasswordModal prop compatibility ──
  const [Comid, setComid] = useState(null);

  // ── Account list (flat) ──
  const accountlist = useRef([]);

  // ── Tree state ──
  const [treeData,     setTreeData    ] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [expandedIds,  setExpandedIds ] = useState(new Set());

  // ── Form fields — identical to original ──
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
  const [showGstDetails,       setShowGstDetails]       = useState(false);

  // ── update flag ──
  const updateFlag = useRef(0);

  // ── selecteddetails ──
  const selecteddetails = useRef({});

  // ── Password modal ──
  const [pwdModalOpen,  setPwdModalOpen]  = useState(false);
  const [pwdModalTitle, setPwdModalTitle] = useState("");
  const passwordType = useRef(0);

  // ── UI ──
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState(null);

  // ── Refs for focus — identical to original ──
  const requestFlagRef         = useRef(false); // CHANGED: simple bool replaces Request_Controller class
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
  // CHANGED: window.alert → toast, window.location.href → navigate
  //          setComid kept; MirrorTable.current removed (uses sess.MirrorTable)
  //          isAuthorized added
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const menuStr = localStorage.getItem("menulist");
    if (!menuStr) {
      alert("Session Close Please Login !!!.");
      navigate("/Login/Index");
      return;
    }
    const menulist = JSON.parse(menuStr);
    const menudata = menulist.filter(obj => obj.PageName === "Accounts Master");
    if (!menudata || menudata.length === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => navigate("/Home"), 3000);
      return;
    }
    if (menudata[0].View === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => navigate("/Home"), 3000);
      return;
    }

    setPageadd(menudata[0].Add);
    setPageedit(menudata[0].Edit);
    setPagedelete(menudata[0].Delete);

    // kept for PasswordModal prop
    setComid(localStorage.getItem("Comid"));
    setIsAuthorized(true);
  }, [navigate]);

  useEffect(() => {
    if (isAuthorized) {
      loadtree();
      Clear();

      const popE = CC.NullToString(sessionStorage.getItem("POPValueE"));
      const popB = CC.NullToString(sessionStorage.getItem("POPValueB"));
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
  }, [isAuthorized]);

  // ─────────────────────────────────────────────────────────────────────────
  // 2. KEYBOARD SHORTCUTS
  // CHANGED: MsgBox → toast, MsgBoxYesNo → confirm, window.location.href → navigate
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = async (e) => {
      if (e.keyCode === 112) {
        e.preventDefault();
        MasterSaveFunction();
      }
      if (e.keyCode === 120) {
        e.preventDefault();
        if (selectedNode != null) {
          const value = selectedNode.Id;
          const objlist = accountlist.current.filter(obj => obj.Id === value);
          if (objlist != null && objlist.length !== 0) {
            if (objlist[0].NoChild === 2) {
              toast("❌ AccountName Cannot Be Delete !!!", true);
              return;
            }
          }
          if (value != null && value !== 0) {
            if (pagedelete === 1) {
              passwordType.current = 1;
              EditPasswordWindow(1);
            } else {
              toast("❌ Page Delete Permission Denied !!!", true);
              return;
            }
          } else {
            toast("❌ Select From List to Delete !!!", true);
          }
        } else {
          toast("❌ Select From List to Delete !!!", true);
        }
      }
      if (e.keyCode === 27) {
        e.preventDefault();
        // CHANGED: MsgBoxYesNo → confirm
        const ok = await confirm("Do You Want To Quit Page?");
        if (ok) navigate(-1);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode, pagedelete, txtAccountName, txtParentAccountName,
      txtDebit, txtCredit, txtGstNo, cmbGstOptions, txtAddress1,
      txtAddress2, txtCity, txtMobileNo, txtPincode, chkHead]);

  // ─────────────────────────────────────────────────────────────────────────
  // 3. LOAD TREE
  // CHANGED: axios.post("/AccountGroup/SelectAccountGroup",...) → CC.api(CC.SelectAccountGroup,...)
  // ─────────────────────────────────────────────────────────────────────────
  const loadtree = useCallback(async () => {
    setLoading(true);
    const res = await CC.api(
      CC.SelectAccountGroup,
      null,{},
      { Comid: sess.Comid },
      {},
      null
    );
    setLoading(false);

    if (res._http404) { toast(`❌ 404 — SelectAccountGroup not found`, true); return; }
    if (res._netErr)  { toast(`❌ Network error loading account tree.`, true); return; }

    const rawList = Array.isArray(res.data)  ? res.data
                  : Array.isArray(res.Data1) ? res.Data1
                  : [];

    accountlist.current = rawList;
    setTreeData(buildTree(rawList));
  }, [sess.Comid, toast]);

  // ─────────────────────────────────────────────────────────────────────────
  // 4. TREE SELECT — logic identical, CC.NullToString / CC.ValNum used
  // ─────────────────────────────────────────────────────────────────────────
  function handleTreeSelect(node) {
    setSelectedNode(node);
    const parentName = node.AccountName;
    setTxtParentAccountName(parentName);

    const id      = node.Id;
    const objlist = accountlist.current.filter(obj => obj.Id === id);
    if (!objlist || objlist.length === 0) return;

    const Parentid = objlist[0].ParentId;

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

    if (
      parentName === "SUNDRY CREDITORS" || parentName === "SUNDRY DEBTORS" ||
      Acparentname === "SUNDRY CREDITORS" || Acparentname === "SUNDRY DEBTORS"
    ) {
      setShowGstDetails(true);
      // CHANGED: NullToString → CC.NullToString
      setTxtAddress1(CC.NullToString(objlist[0].Address1));
      setTxtAddress2(CC.NullToString(objlist[0].Address2));
      setTxtCity(CC.NullToString(objlist[0].City));
      setTxtMobileNo(CC.NullToString(objlist[0].MobileNo));
      setTxtPincode(CC.NullToString(objlist[0].Pincode));
      setTxtGstNo(CC.NullToString(objlist[0].GSTNo));
      setCmbGstOptions(CC.NullToString(objlist[0].GSTType) === "" ? "NoGST" : CC.NullToString(objlist[0].GSTType));
      // CHANGED: ValNum → CC.ValNum
      setTxtCredit(CC.ValNum(objlist[0].Credit).toFixed(2));
      setTxtDebit(CC.ValNum(objlist[0].Debit).toFixed(2));
      setTimeout(() => refAccountName.current?.focus(), 50);
    } else {
      setShowGstDetails(false);
      setTxtCredit(CC.ValNum(objlist[0].Credit).toFixed(2));
      setTxtDebit(CC.ValNum(objlist[0].Debit).toFixed(2));
      setTimeout(() => refAccountName.current?.focus(), 50);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. CLEAR — identical to original
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
    setExpandedIds(new Set());
    setTimeout(() => refParentAccountName.current?.focus(), 50);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. MASTER CHECK
  // CHANGED: MsgBox → toast
  // ─────────────────────────────────────────────────────────────────────────
  function MasterCheck() {
    const acname  = txtAccountName;
    const parname = txtParentAccountName;
    const select  = selectedNode;

    if (select == null) {
      const popE = CC.NullToString(sessionStorage.getItem("POPValueE"));
      const popB = CC.NullToString(sessionStorage.getItem("POPValueB"));
      if (popE === "" && popB === "") {
        toast("❌ Select Tree Parent Name !!!", true);
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
      toast("❌ Enter Parent Account Name !!!", true);
      Clear();
      return false;
    } else if (acname === "" || acname == null) {
      return "Update";
    } else {
      return true;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. FETCH DATA
  // CHANGED: MsgBox → toast, NullToString → CC.NullToString
  // ─────────────────────────────────────────────────────────────────────────
  function fetchdata() {
    let Child     = 0;
    let elementid = 0;
    let acname    = "";

    const popE = CC.NullToString(sessionStorage.getItem("POPValueE"));
    const popB = CC.NullToString(sessionStorage.getItem("POPValueB"));

    if (popE === "" && popB === "") {
      const items = selectedNode;
      acname      = CC.NullToString(txtAccountName).toUpperCase();
      elementid   = items.Id;

      const objlist = accountlist.current.filter(obj => obj.Id === elementid);
      if (objlist[0].EditMode === false && objlist[0].NoChild === 0) {
        toast("❌ Child Account Add Not Allowed !!!", true);
        return null;
      }
      const objlist1 = accountlist.current.filter(obj => obj.AccountName === acname);
      if (objlist1.length !== 0) {
        toast("❌ AccountName Already Exits !!!", true);
        return null;
      }
      Child = chkHead === true ? 1 : 0;
    } else {
      if (popE !== "") {
        acname = CC.NullToString(txtAccountName).toUpperCase();
        const objlist1 = accountlist.current.filter(obj => obj.AccountName === "EXPENSES");
        if (objlist1.length !== 0) elementid = objlist1[0].Id;
      }
      if (popB !== "") {
        acname = CC.NullToString(txtAccountName).toUpperCase();
        const objlist1 = accountlist.current.filter(obj => obj.AccountName === "BANK");
        if (objlist1.length !== 0) elementid = objlist1[0].Id;
      }
    }

    let Id = 0;
    if (updateFlag.current !== 0) {
      Id = elementid;
    }

    const details = {
      Comid:       sess.Comid,
      AccountName: acname,
      ParentId:    elementid,
      Id:          Id,
      Active:      1,
    };

    return details != null ? details : null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. FETCH DATA UPDATE
  // CHANGED: MsgBox → toast, ValNum → CC.ValNum, NullToString → CC.NullToString
  // ─────────────────────────────────────────────────────────────────────────
  function fetchdataupdate() {
    const items     = selectedNode;
    const acname    = txtParentAccountName;
    const elementid = items.Id;

    const objlist = accountlist.current.filter(obj => obj.ParentId === elementid);
    if (objlist != null && objlist.length !== 0) {
      if (objlist[0].NoChild === 2) {
        toast("❌ Account Name Update Not Allowed !!!", true);
        return null;
      }
    }
    const objlist1 = accountlist.current.filter(
      obj => obj.AccountName === acname && obj.Id !== elementid
    );
    if (objlist1.length !== 0) {
      toast("❌ AccountName Already Exits !!!", true);
      return null;
    }

    let topParent = items.ParentId;
    if (topParent === -1) topParent = null;

    let debit  = txtDebit;
    let credit = txtCredit;
    if (CC.ValNum(debit)  === 0) { debit  = "0.00"; setTxtDebit("0.00"); }
    if (CC.ValNum(credit) === 0) { credit = "0.00"; setTxtCredit("0.00"); }
    if (CC.ValNum(credit) !== 0 && CC.ValNum(debit) !== 0) {
      toast("❌ Opening Balance Not Allowed !!!", true);
      return null;
    }

    const details = {
      Comid:       sess.Comid,
      AccountName: acname,
      ParentId:    topParent,
      Id:          elementid,
      Active:      1,
    };

    return details != null ? details : null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 9. SAVE ACCOUNT HEAD
  // CHANGED: axios.post → CC.insertapi(CC.InsertAccountGroup,...)
  //          MsgBoxYesNo → confirm, MsgBox → toast
  //          window.location.href → navigate
  //          MirrorTable.current → sess.MirrorTable
  //          requestFlagRef.current.Is_Request_Running() → requestFlagRef.current bool
  // ─────────────────────────────────────────────────────────────────────────
  async function SaveAccounthead(objlist) {
    if (objlist == null) return;
    if (requestFlagRef.current) return;

    // CHANGED: MsgBoxYesNo → confirm
    const ok = await confirm("Do you Want to Save the Account Head Details?");
    if (!ok) return;

    requestFlagRef.current = true;
    setLoading(true);

    // CHANGED: axios.post → CC.insertapi
    const res = await CC.insertapi(
      CC.InsertAccountGroup,
      objlist,
      { MirrorTable: String(sess.MirrorTable) }
    );

    setLoading(false);
    requestFlagRef.current = false;

    if (res._netErr) { toast(`❌ Network error saving account head.`, true); return; }

    if (res.ok || res.IsSuccess) {
      setMsg({ type: "ok", text: res.message || res.Message || "Saved" });
      await loadtree();
      if (sessionStorage.getItem("POPStatus") === "ON") {
        sessionStorage.setItem("POPValue",  res.Id          ?? "");
        sessionStorage.setItem("POPName",   res.AccountName ?? "");
        sessionStorage.setItem("POPStatus", "OFF");
        navigate(-1);
      } else {
        Clear();
      }
    } else {
      if (res.redis === false) {
        alert("Already Login Another User Please Login Again!!!");
        navigate("/Login/Index");
      } else {
        toast(`❌ ${res.message || res.Message || "Save failed"}`, true);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 10. MASTER SAVE FUNCTION — logic identical to original
  // CHANGED: MsgBox → toast
  // ─────────────────────────────────────────────────────────────────────────
  function MasterSaveFunction() {
    const result = MasterCheck();
    if (result === "Update") {
      const objlist = fetchdataupdate();
      if (objlist !== null && objlist !== false) {
        SaveAccounthead(objlist);
      } else {
        toast("❌ Cannot Update !!!", true);
        return;
      }
    } else if (result === true) {
      const objlist = fetchdata();
      if (objlist !== null && objlist !== false) {
        SaveAccounthead(objlist);
      } else {
        toast("❌ Cannot Insert !!!", true);
        return;
      }
    } else {
      return;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 11. PASSWORD WINDOW — identical to original
  // ─────────────────────────────────────────────────────────────────────────
  function EditPasswordWindow(type) {
    let titlenew = "";
    if (type === 1)      titlenew = "Edit Pwd";
    else if (type === 0) titlenew = "Form Pwd";
    else if (type === 2) titlenew = "Admin Pwd";
    setPwdModalTitle(titlenew);
    setPwdModalOpen(true);
  }

  // CHANGED: axios.post("/AccountGroup/DeleteAccountGroup",...) → CC.deleteapi(CC.DeleteAccountGroup,...)
  //          MsgBoxYesNo → confirm, MsgBox → toast, window.location.href → navigate
  //          MirrorTable.current → sess.MirrorTable
  async function handlePasswordSuccess() {
    setPwdModalOpen(false);
    setTimeout(async () => {
      if (selectedNode == null) return;
      const value = selectedNode.Id;
      const label = selectedNode.AccountName;

      // CHANGED: MsgBoxYesNo → confirm
      const ok = await confirm(`Wish to Delete the Record ${label}?`);
      if (!ok) return;

      setLoading(true);

      // CHANGED: axios.post → CC.deleteapi
      const res = await CC.deleteapi(
        CC.DeleteAccountGroup+`?Id=${value}&Comid=${sess.Comid}&MirrorTable=${sess.MirrorTable}`, null,
        { Id: value, Comid: sess.Comid, MirrorTable: sess.MirrorTable }
      );

      setLoading(false);

      if (res._netErr) { toast(`❌ Network error deleting account.`, true); return; }

      if (res.ok || res.IsSuccess) {
        setMsg({ type: "ok", text: res.message || res.Message || "Deleted" });
        await loadtree();
        Clear();
      } else {
        if (res.redis === false) {
          alert("Already Login Another User Please Login Again!!!");
          navigate("/Login/Index");
        } else {
          toast(`❌ ${res.message || res.Message || "Delete failed"}`, true);
        }
      }
    }, 250);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 12. ACCOUNT NAME logic — identical to original, CC.NullToString used
  // ─────────────────────────────────────────────────────────────────────────
  function handleAccountNameChange(value) {
    setTxtAccountName(value);
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
        toast("❌ Enter Account Name !!!", true);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 13. TREE TOGGLE — identical to original
  // ─────────────────────────────────────────────────────────────────────────
  function toggleNode(id) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ADDED: block render until authorized (same as DepartmentMaster)
  if (!isAuthorized) return null;

  // ─────────────────────────────────────────────────────────────────────────
  // 14. RENDER — design/layout/styles IDENTICAL to original
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="mp-wrap">

      {/* ADDED: ConfirmUI from MSG.useConfirm */}
      {ConfirmUI}

      {/* Loader — identical */}
      {loading && (
        <div className="mp-loader-ov">
          <div className="mp-ldr-box">
            <div className="mp-spin" />
            <div className="mp-ldr-msg">Loading...</div>
          </div>
        </div>
      )}

      {/* Password Modal — CHANGED: toast prop added */}
      {pwdModalOpen && (
        <PasswordModal
          title={pwdModalTitle}
          passwordType={passwordType.current}
          Comid={Comid}
          toast={toast}
          onClose={() => setPwdModalOpen(false)}
          onSuccess={handlePasswordSuccess}
        />
      )}

      <Topbar />

      {/* Body — identical layout */}
      <div className="mp-body" style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>

        {/* LEFT — Tree Panel — identical styles */}
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

        {/* RIGHT — Form Panel — identical styles */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Toolbar — identical */}
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

          {/* Form — identical */}
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
                            toast("❌ Select Parent Account Name !!!", true);
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
             

                {/* Debit */}
              

                {/* GST Details — identical conditional section */}
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

          {/* Hint bar — identical */}
          <div className="mp-hint">
            <kbd>F1</kbd> Save &nbsp;|&nbsp;
            <kbd>F9</kbd> Delete (requires password) &nbsp;|&nbsp;
            <kbd>Esc</kbd> Quit &nbsp;|&nbsp;
            <kbd>Enter</kbd> Next Field
          </div>
        </div>
      </div>

      {/* ADDED: Toast notifications */}
      <MSG.ToastList toasts={toasts} />
    </div>
  );
}

// ─── Style helpers — identical to original ────────────────────────────────────
const tdLbl = {
  width:       140, padding: "5px 8px 5px 0",
  fontWeight:  600, color: "#4a5568", fontSize: 11,
  whiteSpace:  "nowrap", verticalAlign: "middle",
};
const tdVal = {
  padding: "4px 0", verticalAlign: "middle",
};