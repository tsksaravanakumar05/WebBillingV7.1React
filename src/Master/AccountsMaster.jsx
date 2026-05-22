import { useState, useEffect, useRef, useCallback } from "react";
import "./MasterPage.css";

// ─── Centralized API helper (mirrors BranchMaster pattern) ───────────────────
const mkUrl = (path) => (path.startsWith("/") ? path : "/" + path);

const authHeaders = () => ({
  "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
  "Userid":        localStorage.getItem("userid")     || "0",
  "Profile":       localStorage.getItem("Profile")    || "Admin",
  "LoginCheck":    localStorage.getItem("LoginCheck") || "1",
});

const api = async (path, body = null, extraHeaders = {}) => {
  try {
    const res = await fetch(mkUrl(path), {
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
    if (res.status === 404) return { ok: false, _http404: true, message: `404: ${path}` };
    if (res.status === 500) {
      const t = await res.text();
      console.error(`500 on ${path}:`, t.slice(0, 500));
      return { ok: false, message: "Server error 500 — see console" };
    }
    const text = await res.text();
    if (!text.trim()) return { ok: false, message: "Empty response" };
    try {
      const j = JSON.parse(text);
      // Normalise varied response shapes
      if (j.IsSuccess !== undefined && j.ok      === undefined) j.ok      = j.IsSuccess;
      if (j.Data1     !== undefined && j.data    === undefined) j.data    = j.Data1;
      if (j.Message   !== undefined && j.message === undefined) j.message = j.Message;
      return j;
    } catch { return { ok: false, message: text }; }
  } catch (err) {
    return { ok: false, _netErr: true, message: err.message };
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getStr   = (k) => localStorage.getItem(k) || "";
const getLocal = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
function ValNum(v)       { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function NullToString(v) { return v == null ? "" : String(v); }

// ─── Request-duplicate guard ──────────────────────────────────────────────────
class Request_Controller {
  constructor(key) { this.key = key; this._running = false; }
  Is_Request_Running() { return this._running; }
  Start_Request()      { this._running = true; }
  End_Request()        { this._running = false; }
}

// ─── Build tree hierarchy from flat list ──────────────────────────────────────
function buildTree(flatList) {
  const map   = {};
  const roots = [];
  flatList.forEach(item => { map[item.Id] = { ...item, items: [] }; });
  flatList.forEach(item => {
    if (item.ParentId === 0 || item.ParentId === null) {
      roots.push(map[item.Id]);
    } else if (map[item.ParentId]) {
      map[item.ParentId].items.push(map[item.Id]);
    }
  });
  return roots;
}

// ─── Tree Node ────────────────────────────────────────────────────────────────
function TreeNode({ node, selectedId, onSelect, expandedIds, onToggle }) {
  const hasChildren = node.items && node.items.length > 0;
  const isExpanded  = expandedIds.has(node.Id);
  const isSelected  = selectedId === node.Id;

  return (
    <div style={{ userSelect: "none" }}>
      <div
        style={{
          display: "flex", alignItems: "center",
          padding: "3px 6px", cursor: "pointer",
          background:   isSelected ? "#a8c8f5" : "transparent",
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

// ─── Confirm Modal (mirrors BranchMaster useConfirm pattern) ─────────────────
function ConfirmModal({ message, onYes, onNo }) {
  const yesBtnRef = useRef(null);
  useEffect(() => {
    const t = setTimeout(() => yesBtnRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") { e.preventDefault(); onNo(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onNo]);
  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(10,20,40,.55)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999,
    }}>
      <div style={{
        background: "#fff", borderRadius: 10, padding: "28px 32px 22px",
        minWidth: 280, maxWidth: 360, textAlign: "center",
        boxShadow: "0 8px 32px rgba(0,0,0,.22)", border: "1px solid #e2e8f0",
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: "linear-gradient(135deg,#3b82f6,#1d4ed8)",
          color: "#fff", fontSize: 20, fontWeight: 700, lineHeight: "40px",
          margin: "0 auto 14px",
        }}>?</div>
        <p style={{ fontSize: 14, color: "#1e293b", fontWeight: 500, margin: "0 0 20px", lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button ref={yesBtnRef}
            style={{ padding: "7px 26px", borderRadius: 6, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff" }}
            onClick={onYes}
          >✔ Yes</button>
          <button
            style={{ padding: "7px 26px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 600, cursor: "pointer", background: "#f1f5f9", color: "#475569" }}
            onClick={onNo}
          >✘ No</button>
        </div>
      </div>
    </div>
  );
}

function useConfirm() {
  const [conf, setConf] = useState(null);
  const confirm = useCallback((message) =>
    new Promise((resolve) => setConf({ message, resolve })), []);
  const handleYes = useCallback(() => { conf?.resolve(true);  setConf(null); }, [conf]);
  const handleNo  = useCallback(() => { conf?.resolve(false); setConf(null); }, [conf]);
  const ConfirmUI = conf
    ? <ConfirmModal message={conf.message} onYes={handleYes} onNo={handleNo} />
    : null;
  return { confirm, ConfirmUI };
}

// ─── Password Modal ───────────────────────────────────────────────────────────
function PasswordModal({ title, onClose, onSuccess, Comid, MirrorTable, passwordType }) {
  const [pwd, setPwd] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  async function submit() {
    if (!pwd) return;
  
    let type = "";
  
    if (passwordType === 1)
      type = "EditPassword";
    else if (passwordType === 0)
      type = "FormConfig";
    else if (passwordType === 2)
      type = "AdminPower";
  
    const res = await api(
      `/Login/EditPassword?password=${encodeURIComponent(pwd)}&type=${encodeURIComponent(type)}&Comid=${Comid}&web=1`,
      null,
      {}
    );
  
    if (res?.IsSuccess === true) {
      onSuccess();
    } else {
      alert("Invalid Password !!!");
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") submit();
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(10,20,40,.55)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9500,
    }}>
      <div style={{ background: "#fff", borderRadius: 8, padding: "18px 22px", minWidth: 170, boxShadow: "0 8px 32px rgba(0,0,0,.25)" }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: "#1f65de", marginBottom: 10 }}>{title}</div>
        <input
          ref={inputRef}
          type="password"
          value={pwd}
          onChange={e => setPwd(e.target.value)}
          onKeyDown={handleKeyDown}
          className="mp-pwd-input"
          placeholder="Password"
        />
        <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
          <button className="mp-btn sv" style={{ flex: 1 }} onClick={submit}>OK</button>
          <button className="mp-btn dl" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function AccountsMaster() {

  // ── Session (one-time read, mirrors jQuery's localStorage reads at top) ──
  const [sess] = useState(() => {
    try {
      const Comid       = getStr("Comid") || "1";
      const MirrorTable = getStr("MirrorTableOnline") || "0";
      const menudata    = (getLocal("menulist") || []).filter(o => o.PageName === "Accounts Master");
      return { Comid, MirrorTable, menudata };
    } catch {
      return { Comid: "1", MirrorTable: "0", menudata: [] };
    }
  });

  // ── Permissions ──
  const perm = sess.menudata[0] || { View: 1, Add: 1, Edit: 1, Delete: 1 };

  // ── Confirm modal (BranchMaster pattern — no stale closures) ──
  const { confirm, ConfirmUI } = useConfirm();

  // ── Toast notifications ──
  const toastId = useRef(0);
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((msg, isErr = false) => {
    const id = ++toastId.current;
    setToasts(p => [...p, { id, msg, isErr }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  // ── Account list (flat) ──
  const accountlistRef = useRef([]);

  // ── Tree state ──
  const [treeData,     setTreeData]     = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [expandedIds,  setExpandedIds]  = useState(new Set());

  // ── Form fields ──
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

  // ── Refs for stale-closure-free access in keyboard handler ──
  const selectedNodeRef     = useRef(null);
  const txtAccountNameRef   = useRef("");
  const txtParentNameRef    = useRef("");
  const chkHeadRef          = useRef(true);

  // Keep refs in sync with state
  useEffect(() => { selectedNodeRef.current   = selectedNode; },        [selectedNode]);
  useEffect(() => { txtAccountNameRef.current  = txtAccountName; },     [txtAccountName]);
  useEffect(() => { txtParentNameRef.current   = txtParentAccountName; },[txtParentAccountName]);
  useEffect(() => { chkHeadRef.current         = chkHead; },            [chkHead]);

  // ── Password modal ──
  const [pwdModalOpen,  setPwdModalOpen]  = useState(false);
  const [pwdModalTitle, setPwdModalTitle] = useState("");
  const passwordType = useRef(0);

  // ── Loading ──
  const [loading, setLoading] = useState(false);

  // ── Request flag ──
  const requestFlagRef = useRef(new Request_Controller("AccountHead"));

  // ── Focus refs ──
  const refParentAccountName = useRef(null);
  const refAccountName       = useRef(null);
  const refSave              = useRef(null);
  const refDebit             = useRef(null);
  const refCredit            = useRef(null);
  const refGstNo             = useRef(null);
  const refGstOptions        = useRef(null);
  const refAddress1          = useRef(null);
  const refAddress2          = useRef(null);
  const refCity              = useRef(null);
  const refMobileNo          = useRef(null);
  const refPincode           = useRef(null);

  // ─────────────────────────────────────────────────────────────────────────
  // INIT — mirrors methods.init()
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sess.menudata || sess.menudata.length === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => { window.location.href = "/Home"; }, 3000);
      return;
    }
    if (perm.View === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => { window.location.href = "/Home"; }, 3000);
      return;
    }
    loadtree();
    Clear();

    // POPValue pre-fill
    const popE = NullToString(sessionStorage.getItem("POPValueE"));
    const popB = NullToString(sessionStorage.getItem("POPValueB"));
    if (popE !== "") { setTxtParentAccountName("Expense"); setTxtAccountName(popE); }
    if (popB !== "") { setTxtParentAccountName("BANK");    setTxtAccountName(popB); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // LOAD TREE — mirrors methods.loadtree()
  // ─────────────────────────────────────────────────────────────────────────
  const loadtree = useCallback(async () => {
    try {
      setLoading(true);
  
      const res = await api(
        "/AccountGroup/SelectAccountGroup?Comid=" + sess.Comid,
        {},
        {
          method: "POST",
        }
      );
  
      console.log("SelectAccountGroup Response =", res);
  
      if (res?._netErr || res?._http404) {
        toast(res?.message || "API Error", true);
        return;
      }
  
      const response = res?.data || res;
  
      const flat = Array.isArray(response)
        ? response
        : Array.isArray(response?.Data1)
        ? response.Data1
        : [];
  
      accountlistRef.current = flat;
  
      setTreeData(buildTree(flat));
    } catch (err) {
      console.error("SelectAccountGroup Error:", err);
  
      toast(err?.message || "Something went wrong", true);
    } finally {
      setLoading(false);
    }
  }, [sess.Comid, toast]);

  // ─────────────────────────────────────────────────────────────────────────
  // TREE SELECT — mirrors TreeAccounthead.on('select', ...)
  // ─────────────────────────────────────────────────────────────────────────
  function handleTreeSelect(node) {
    setSelectedNode(node);
    const parentName = node.AccountName;
    setTxtParentAccountName(parentName);
    setTxtAccountName(""); // clear child name field on new parent selection

    const id      = node.Id;
    const objlist = accountlistRef.current.filter(obj => obj.Id === id);
    if (!objlist || objlist.length === 0) return;

    const Parentid = objlist[0].ParentId;

    // mirrors: chkhead enable/disable logic
    if (Parentid === 0 || Parentid === null) {
      setChkHeadDisabled(false);
      setChkHead(true);
    } else {
      const objlist1 = accountlistRef.current.filter(obj => obj.Id === Parentid);
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

    const Acparentname = objlist[0].ParentName;

    // mirrors: show/hide gstdetails
    const isSundry =
      parentName    === "SUNDRY CREDITORS" || parentName    === "SUNDRY DEBTORS" ||
      Acparentname  === "SUNDRY CREDITORS" || Acparentname  === "SUNDRY DEBTORS";

    if (isSundry) {
      setShowGstDetails(true);
      setTxtAddress1(NullToString(objlist[0].Address1));
      setTxtAddress2(NullToString(objlist[0].Address2));
      setTxtCity(NullToString(objlist[0].City));
      setTxtMobileNo(NullToString(objlist[0].MobileNo));
      setTxtPincode(NullToString(objlist[0].Pincode));
      setTxtGstNo(NullToString(objlist[0].GSTNo));
      setCmbGstOptions(NullToString(objlist[0].GSTType) || "NoGST");
    } else {
      setShowGstDetails(false);
    }
    setTxtCredit(ValNum(objlist[0].Credit).toFixed(2));
    setTxtDebit(ValNum(objlist[0].Debit).toFixed(2));
    setTimeout(() => refAccountName.current?.focus(), 50);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CLEAR — mirrors methods.Clear()
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
    setChkHead(true);
    setChkHeadDisabled(false);
    setSelectedNode(null);
    setExpandedIds(new Set());
    setTimeout(() => refParentAccountName.current?.focus(), 50);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MASTER CHECK — mirrors methods.MasterCheck()
  // Returns: true (insert) | "Update" | false (error)
  // ─────────────────────────────────────────────────────────────────────────
  function MasterCheck(currentNode, currentAccountName, currentParentName) {
    const select  = currentNode;
    const acname  = currentAccountName;
    const parname = currentParentName;

    if (select == null) {
      const popE = NullToString(sessionStorage.getItem("POPValueE"));
      const popB = NullToString(sessionStorage.getItem("POPValueB"));
      if (popE === "" && popB === "") {
        alert("Select Tree Parent Name");
        if (sessionStorage.getItem("POPValue") != null) {
          setTxtParentAccountName("");
        } else {
          Clear();
        }
        return false;
      }
      return true;
    }
    if (!parname) {
      alert("Enter Parent Account Name");
      Clear();
      return false;
    }
    // If account name is empty → update the parent node itself
    if (!acname) {
      return "Update";
    }
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH DATA (INSERT) — mirrors methods.fetchdata()
  // ─────────────────────────────────────────────────────────────────────────
  function fetchdata(currentNode, currentAccountName) {
    const popE = NullToString(sessionStorage.getItem("POPValueE"));
    const popB = NullToString(sessionStorage.getItem("POPValueB"));

    let elementid = 0;
    let acname    = "";

    if (popE === "" && popB === "") {
      const items   = currentNode;
      acname        = NullToString(currentAccountName).toUpperCase();
      elementid     = items.Id;

      const objlist = accountlistRef.current.filter(obj => obj.Id === elementid);
      if (objlist.length === 0) { alert("Cannot Insert!!!"); return null; }

      if (objlist[0].EditMode === false && objlist[0].NoChild === 0) {
        alert("Child Account Add Not Allowed !!!.");
        return null;
      }
      const duplicate = accountlistRef.current.filter(obj => obj.AccountName === acname);
      if (duplicate.length !== 0) {
        alert("AccountName Already Exits !!!.");
        return null;
      }
    } else {
      if (popE !== "") {
        acname = NullToString(currentAccountName).toUpperCase();
        const match = accountlistRef.current.filter(obj => obj.AccountName === "EXPENSES");
        if (match.length !== 0) elementid = match[0].Id;
      }
      if (popB !== "") {
        acname = NullToString(currentAccountName).toUpperCase();
        const match = accountlistRef.current.filter(obj => obj.AccountName === "BANK");
        if (match.length !== 0) elementid = match[0].Id;
      }
    }

    return {
      Comid:       sess.Comid,
      AccountName: acname,
      ParentId:    elementid,
      Id:          0,           // 0 = new insert (mirrors jQuery fetchdata: Id=0 always for insert)
      Active:      1,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH DATA UPDATE — mirrors methods.fetchdataupdate()
  // Updates the selected node's AccountName to txtParentAccountName value
  // (jQuery: acname = frmtxtParentaccountname.val(), elementid = selected node)
  // ─────────────────────────────────────────────────────────────────────────
  function fetchdataupdate(currentNode, currentParentName, currentDebit, currentCredit) {
    const items     = currentNode;
    const elementid = items.Id;
    const acname    = currentParentName; // renames the currently selected node

    // Check if it's a protected root
    const children = accountlistRef.current.filter(obj => obj.ParentId === elementid);
    if (children.length !== 0 && children[0].NoChild === 2) {
      alert("Account Name Update Not Allowed !!!.");
      return null;
    }

    // Duplicate check (exclude self)
    const dup = accountlistRef.current.filter(obj => obj.AccountName === acname && obj.Id !== elementid);
    if (dup.length !== 0) {
      alert("AccountName Already Exits !!!.");
      return null;
    }

    // Opening balance validation
    let debit  = currentDebit;
    let credit = currentCredit;
    if (ValNum(debit)  === 0) debit  = "0.00";
    if (ValNum(credit) === 0) credit = "0.00";
    if (ValNum(credit) !== 0 && ValNum(debit) !== 0) {
      alert("Opening Balance Not Allowed !!!.");
      return null;
    }

    return {
      Comid:       sess.Comid,
      AccountName: acname,
      ParentId:    items.ParentId ?? null,
      Id:          elementid,
      Active:      1,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SAVE ACCOUNT HEAD — mirrors methods.SaveAccounthead()
  // ─────────────────────────────────────────────────────────────────────────
  const SaveAccounthead = useCallback(async (payload) => {
    if (!payload) return;
    if (requestFlagRef.current.Is_Request_Running()) return;
    requestFlagRef.current.Start_Request();

    const proceed = await confirm("Do you Want to Save the Account Head Details?");
    if (!proceed) {
      requestFlagRef.current.End_Request();
      return;
    }

    setLoading(true);
    const res = await api(
      "/AccountGroup/InsertAccountGroup",
      payload,
      { "MirrorTable": String(sess.MirrorTable) },
    );
    setLoading(false);
    requestFlagRef.current.End_Request();

    if (res._netErr) {
      toast(`❌ Network error saving account head: ${res.message}`, true);
      return;
    }

    if (res.ok) {
      toast("✅ " + (res.message || "Saved successfully!"));
      await loadtree();

      if (sessionStorage.getItem("POPStatus") === "ON") {
        sessionStorage.setItem("POPValue",  String(res.Id || ""));
        sessionStorage.setItem("POPName",   String(res.AccountName || ""));
        sessionStorage.setItem("POPStatus", "OFF");
        // Close parent dialog if embedded
        try {
          window.parent?.document?.querySelector(".ui-dialog-content:visible")
            ?.closest("[role=dialog]")?.dispatchEvent(new Event("close"));
        } catch { /* ignore */ }
      } else {
        Clear();
      }
    } else {
      if (res.redis === false) {
        alert("Already Login Another User Please Login Again!!!");
        window.location.href = "/Login";
      } else {
        alert(res.message || "Save failed");
      }
    }
  }, [confirm, loadtree, toast, sess.MirrorTable]); // eslint-disable-line

  // ─────────────────────────────────────────────────────────────────────────
  // MASTER SAVE — mirrors methods.MasterSaveFunction()
  // Uses refs so it's always fresh (no stale closure in keyboard handler)
  // ─────────────────────────────────────────────────────────────────────────
  const MasterSaveFunction = useCallback(() => {
    const curNode       = selectedNodeRef.current;
    const curAccName    = txtAccountNameRef.current;
    const curParName    = txtParentNameRef.current;

    // These state values are only needed in fetchdataupdate; read from DOM refs
    const curDebit  = refDebit.current?.value  || "0.00";
    const curCredit = refCredit.current?.value  || "0.00";

    const result = MasterCheck(curNode, curAccName, curParName);

    if (result === "Update") {
      const payload = fetchdataupdate(curNode, curParName, curDebit, curCredit);
      if (payload) {
        SaveAccounthead(payload);
      } else {
        // fetchdataupdate already alerted
      }
    } else if (result === true) {
      const payload = fetchdata(curNode, curAccName);
      if (payload) {
        SaveAccounthead(payload);
      } else {
        // fetchdata already alerted
      }
    }
    // result === false → MasterCheck already showed alert
  }, [SaveAccounthead]); // eslint-disable-line

  // ─────────────────────────────────────────────────────────────────────────
  // PASSWORD WINDOW — mirrors EditPasswordWindow()
  // ─────────────────────────────────────────────────────────────────────────
  function EditPasswordWindow(type) {
    const titles = { 0: "Form Pwd", 1: "Edit Pwd", 2: "Admin Pwd" };
    passwordType.current = type;
    setPwdModalTitle(titles[type] || "Password");
    setPwdModalOpen(true);
  }

  // mirrors: '#LockEditWindow'.on('close') — delete flow after password verified
  const handlePasswordSuccess = useCallback(async () => {
    setPwdModalOpen(false);
    setTimeout(async () => {
      const node = selectedNodeRef.current;
      if (!node) return;
      const proceed = await confirm(`Wish to Delete the Record ${node.AccountName}?`);
      if (!proceed) return;

      setLoading(true);
      const res = await api(
        `/AccountGroup/DeleteAccountGroup?Id=${node.Id}&Comid=${sess.Comid}&MirrorTable=${sess.MirrorTable}`,
        null,
        {}
      );
      setLoading(false);

      if (res.ok) {
        toast("✅ " + (res.message || "Deleted successfully"));
        await loadtree();
        Clear();
      } else {
        if (res.redis === false) {
          alert("Already Login Another User Please Login Again!!!");
          window.location.href = "/Login";
        } else {
          alert(res.message || "Delete failed");
        }
      }
    }, 250);
  }, [confirm, loadtree, toast, sess]); // eslint-disable-line

  // ─────────────────────────────────────────────────────────────────────────
  // KEYBOARD SHORTCUTS — F1, F9, ESC (stale-closure-free via refs)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = async (e) => {
      // F1 — Save
      if (e.keyCode === 112) {
        e.preventDefault();
        MasterSaveFunction();
      }
      // F9 — Delete (with password)
      if (e.keyCode === 120) {
        e.preventDefault();
        const node = selectedNodeRef.current;
        if (!node) { alert("Select From List to Delete!!!"); return; }

        const objlist = accountlistRef.current.filter(obj => obj.Id === node.Id);
        if (objlist.length !== 0 && objlist[0].NoChild === 2) {
          alert("AccountName Cannot Be Delete !!!.");
          return;
        }
        if (node.Id != null && node.Id !== 0) {
          if (perm.Delete === 1) {
            EditPasswordWindow(1);
          } else {
            alert("Page Delete Permission Denied !!!.");
          }
        } else {
          alert("Select From List to Delete!!!");
        }
      }
      // ESC — Quit
      if (e.keyCode === 27) {
        e.preventDefault();
        const go = await confirm("Do You Want To Quit Page?");
        if (go) window.location.href = "/Home";
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [MasterSaveFunction, perm.Delete, confirm]);

  // ─────────────────────────────────────────────────────────────────────────
  // TREE TOGGLE
  // ─────────────────────────────────────────────────────────────────────────
  function toggleNode(id) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ACCOUNT NAME change — mirrors chkhead logic in frmtxtAccountname keypress
  // ─────────────────────────────────────────────────────────────────────────
  function handleAccountNameChange(value) {
    setTxtAccountName(value);
    // Re-evaluate chkHead state on input (mirrors jQuery keypress on AccountName)
    if (chkHeadRef.current === true && selectedNodeRef.current != null) {
      const id      = selectedNodeRef.current.Id;
      const objlist = accountlistRef.current.filter(obj => obj.Id === id);
      if (objlist.length > 0) {
        const Parentid = objlist[0].ParentId;
        if (Parentid === 0 || Parentid === null) {
          setChkHeadDisabled(false);
        } else {
          if (objlist[0].NoChild !== 0) {
            if (objlist[0].NoChild === 2) {
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

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="mp-wrap">

      {/* Confirm Modal */}
      {ConfirmUI}

      {/* Password Modal */}
      {pwdModalOpen && (
        <PasswordModal
          title={pwdModalTitle}
          passwordType={passwordType.current}
          Comid={sess.Comid}
          MirrorTable={sess.MirrorTable}
          onClose={() => setPwdModalOpen(false)}
          onSuccess={handlePasswordSuccess}
        />
      )}

      {/* Loader */}
      {loading && (
        <div className="mp-loader-ov">
          <div className="mp-ldr-box">
            <div className="mp-spin" />
            <div className="mp-ldr-msg">Loading...</div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mp-hdr">
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
      </div>

      {/* Body */}
      <div className="mp-body" style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>

        {/* LEFT — Tree Panel */}
        <div style={{
          width: 280, flexShrink: 0, background: "#fff",
          border: "1px solid #c5d8f8", borderRadius: 6,
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
            {treeData.length === 0 && !loading && (
              <div className="mp-empty">No accounts loaded.</div>
            )}
          </div>
        </div>

        {/* RIGHT — Form Panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Toolbar */}
          <div className="mp-toolbar">
            <button
              ref={refSave}
              className="mp-btn sv"
              onClick={() => MasterSaveFunction()}
              title="F1 – Save / Update"
              disabled={loading}
            >
              💾 Save (F1)
            </button>
            <button
              className="mp-btn nw"
              onClick={() => {
                // Force update mode: blank out AccountName so MasterCheck returns "Update"
                setTxtAccountName("");
              }}
              title="Clear Account Name to trigger update mode"
            >
              ✏ Update Mode
            </button>
            <button className="mp-btn dl" onClick={Clear} title="Clear form">
              ✕ Clear
            </button>
          </div>

          {/* Form */}
          <div style={{
            background: "#fff", border: "1px solid #c5d8f8",
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
                          const node = selectedNodeRef.current;
                          if (txtParentNameRef.current && node) {
                            if (
                              txtParentNameRef.current === "SUNDRY CREDITORS" ||
                              txtParentNameRef.current === "SUNDRY DEBTORS"
                            ) {
                              refAddress1.current?.select();
                              refAddress1.current?.focus();
                            } else {
                              refSave.current?.focus();
                            }
                          } else {
                            alert("Select Parent Account Name !!!");
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
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const prodname = txtAccountNameRef.current;
                          const node     = selectedNodeRef.current;
                          if (prodname && node) {
                            if (
                              txtParentNameRef.current === "SUNDRY CREDITORS" ||
                              txtParentNameRef.current === "SUNDRY DEBTORS"
                            ) {
                              refGstNo.current?.select();
                              refGstNo.current?.focus();
                            } else {
                              refDebit.current?.select();
                              refDebit.current?.focus();
                            }
                          } else {
                            alert("Enter Account Name!!!");
                          }
                        }
                      }}
                    />
                  </td>
                </tr>

                {/* Is Head */}
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

                {/* Opening Debit */}
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

                {/* Opening Credit */}
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

                {/* GST Details — conditional */}
                {showGstDetails && (
                  <>
                    <tr>
                      <td colSpan={2} style={{
                        background: "#1a2e4a", color: "#fff", fontWeight: 700,
                        fontSize: 11, padding: "5px 8px", borderRadius: 3,
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
            <kbd>F1</kbd> Save / Update &nbsp;|&nbsp;
            <kbd>F9</kbd> Delete (requires password) &nbsp;|&nbsp;
            <kbd>Esc</kbd> Quit &nbsp;|&nbsp;
            <kbd>Enter</kbd> Next Field
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      <div className="toasts">
        {toasts.map(t => (
          <div key={t.id} className={`toast${t.isErr ? " err" : ""}`}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}

// ─── Style helpers ────────────────────────────────────────────────────────────
const tdLbl = {
  width: 150, padding: "5px 8px 5px 0",
  fontWeight: 600, color: "#4a5568", fontSize: 11,
  whiteSpace: "nowrap", verticalAlign: "middle",
};
const tdVal = {
  padding: "4px 0", verticalAlign: "middle",
};