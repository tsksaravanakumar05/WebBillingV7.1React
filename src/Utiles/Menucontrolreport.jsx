// ─────────────────────────────────────────────────────────────────────────────
//  Menucontrolreport.jsx
//  React conversion of Menucontrolreport.js — same business logic / API calls /
//  validations, rebuilt with the Menucontrol.jsx layout & MasterPage.css look.
//  No jQuery / direct DOM manipulation — React Hooks only.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import "../Master/MasterPage.css";
import "../Menucontrolreport.css";
import * as CC from "../components/Common";
import Topbar from "../components/Topbar";

// ─── API endpoints — reused from Common.jsx (no more local duplicates) ───────
const API_SELECT_USER_PASSWORD = CC.SelectUserPassword;
const API_UPDATE_MENU_REPORT = CC.UpdateMenuReport;
const API_SELECT_MENU_MASTER = CC.SelectMenuMaster;

// ─── Build hierarchical tree from flat list — mirrors getRecordsHierarchy ─────
// Input rows: { Id, ParentId, AccountName, Status }
function buildTree(rows) {
  const byId = new Map();
  rows.forEach((r) => {
    byId.set(r.Id, {
      id: r.Id,
      parentId: r.ParentId,
      label: r.AccountName,
      checked: r.Status === true || r.Status === 1,
      children: [],
    });
  });

  const roots = [];
  byId.forEach((node) => {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

// ─── Recursively update a single node's checked flag (immutable) ──────────────
function updateNodeChecked(nodes, targetId, checked) {
  return nodes.map((node) => {
    if (node.id === targetId) {
      return { ...node, checked };
    }
    if (node.children && node.children.length) {
      return { ...node, children: updateNodeChecked(node.children, targetId, checked) };
    }
    return node;
  });
}

// ─── TreeNode — recursive renderer, no DOM manipulation, pure React ───────────
function TreeNode({ node, expandedMap, onToggleExpand, onContextMenu, depth }) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = !!expandedMap[node.id];

  return (
    <li className="mctr-node">
      <div
        className="mctr-node-row"
        style={{ paddingLeft: depth * 18 }}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        {hasChildren ? (
          <button
            type="button"
            className="mctr-toggle"
            onClick={() => onToggleExpand(node.id)}
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : (
          <span className="mctr-toggle mctr-toggle-leaf" />
        )}

        <span className={`mctr-label ${node.checked ? "mctr-visible" : "mctr-hidden"}`}>
          {node.label}
        </span>
      </div>

      {hasChildren && isExpanded && (
        <ul className="mctr-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              expandedMap={expandedMap}
              onToggleExpand={onToggleExpand}
              onContextMenu={onContextMenu}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ─── Menucontrolreport ─────────────────────────────────────────────────────────
export default function Menucontrolreport() {
  const navigate = useNavigate();

  const { confirm, ConfirmUI } = CC.useConfirm();
  const { toast, toasts } = CC.useToast();

  // ── Session / company variables ─────────────────────────────────────────
  const [comid] = useState(() => CC.getStr("Comid"));
  const [perm, setPerm] = useState({ View: 0, Add: 0, Edit: 0, Delete: 0 });
  const [isAuthorized, setIsAuthorized] = useState(false);

  // ── Permission guard — identical flow to the jQuery $(document).ready() ──
  useEffect(() => {
    const menuStr = localStorage.getItem("menulist");

    if (!menuStr) {
      alert("Session Close Please Login !!!.");
      navigate("/Login/Index");
      return;
    }

    const menulist = JSON.parse(menuStr);
    const menudata = menulist.filter((obj) => obj.PageName === "Master");

    if (!menudata || menudata.length === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => { navigate("/Home"); }, 3000);
      return;
    }

    if (menudata[0].View === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => { navigate("/Home"); }, 3000);
      return;
    }

    setPerm({
      View: menudata[0].View,
      Add: menudata[0].Add,
      Edit: menudata[0].Edit,
      Delete: menudata[0].Delete,
    });

    setIsAuthorized(true);
  }, [navigate]);

  // ── Component state ──────────────────────────────────────────────────────
  const [userList, setUserList] = useState([]); // cmbUserName source
  const [selUserId, setSelUserId] = useState(""); // selected username id (also used as Comid for tree fetch — same as original)
  const [reportType, setReportType] = useState(""); // "All" | "Crystal Report" | "Reports"

  const [treeItems, setTreeItems] = useState([]); // hierarchical tree
  const [expandedMap, setExpandedMap] = useState({}); // collapsed by default — mirrors collapseAll()
  const [loading, setLoading] = useState(false);

  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, node: null });

  const userRef = useRef(null);
  const treeWrapRef = useRef(null);

  // ── loadUserList — same endpoint/payload as loadSelectUserList() in JS ───
  const loadUserList = useCallback(async () => {
    const res = await CC.api(API_SELECT_USER_PASSWORD, null, {}, { Comid: Number(comid) });
    if (res._netErr) {
      toast(`❌ ${res.message}`, true);
      return;
    }
    setUserList(Array.isArray(res.data) ? res.data : []);
  }, [comid, toast]);

  useEffect(() => {
    loadUserList();
  }, [loadUserList]);

  // ── indexcheck — mirrors methods.indexcheck() ─────────────────────────────
  const indexcheck = useCallback(() => {
    if (selUserId === "" || selUserId == null) return false;
    return selUserId;
  }, [selUserId]);

  // ── loadtree — mirrors methods.loadtree(objlist) ──────────────────────────
  const loadTree = useCallback(
    async (userId, type) => {
      setLoading(true);
      const res = await CC.api(API_SELECT_MENU_MASTER, null, {}, {
        Type: type,
        Comid: Number(userId),
      });
      setLoading(false);

      if (res._netErr) {
        toast(`❌ ${res.message}`, true);
        return;
      }

      const rows = Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : [];
      const tree = buildTree(rows);
      setTreeItems(tree);
      setExpandedMap({}); // collapseAll — same as original
    },
    [toast]
  );

  // ── Radio change handlers — mirror frmrbtAll/Crystalreport/Reports 'checked' ──
  const selectReportType = useCallback(
    (type) => {
      const value = indexcheck();
      if (value === false) {
        toast("❌ Select Options", true);
        return;
      }
      setReportType(type);
      loadTree(value, type);
    },
    [indexcheck, loadTree, toast]
  );

  // ── Username Enter-key handler — mirrors frmcmbUsername.keypress() ───────
  const handleUserKeyDown = useCallback(
    (e) => {
      if (e.key !== "Enter" && e.keyCode !== 13) return;
      const value = indexcheck();
      if (value !== null && value !== false) {
        selectReportType("All");
      } else {
        toast("❌ Select UserName!!!", true);
      }
    },
    [indexcheck, selectReportType, toast]
  );

  const handleUserChange = (e) => {
    setSelUserId(e.target.value);
    setReportType("");
    setTreeItems([]);
    setExpandedMap({});
  };

  // ── UpdateFileControl — mirrors methods.UpdateFileControl(id, status) ────
  const updateFileControl = useCallback(
    async (id, status) => {
      if (id == null || (status !== 1 && status !== 0)) {
        toast("❌ Select and Update!!!", true);
        return;
      }

      setLoading(true);
      const res = await CC.api(API_UPDATE_MENU_REPORT, null, {}, { id, status });
      setLoading(false);

      if (res._netErr) {
        toast(`❌ ${res.message}`, true);
        return;
      }

      if (res.ok) {
        toast(`✅ ${res.message}`);
        // Update the tree node locally — same end result as updateItem/render/refresh
        setTreeItems((prev) => updateNodeChecked(prev, id, status === 1));
      } else {
        toast(`❌ ${res.message}`, true);
      }
    },
    [toast]
  );

  // ── Tree expand/collapse — replaces jqxTree expand state ─────────────────
  const toggleExpand = useCallback((nodeId) => {
    setExpandedMap((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  }, []);

  // ── Right-click context menu — replaces jqxMenu popup + isRightClick() ───
  const handleNodeContextMenu = useCallback((e, node) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX + 5, y: e.clientY + 5, node });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0, node: null });
  }, []);

  // Close context menu on any outside click — replaces default jqxMenu auto-close
  useEffect(() => {
    if (!contextMenu.visible) return;
    const handler = () => closeContextMenu();
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [contextMenu.visible, closeContextMenu]);

  // Disable native browser context menu over the tree — mirrors $(document).on('contextmenu', ...)
  useEffect(() => {
    const handler = (e) => {
      if (treeWrapRef.current && treeWrapRef.current.contains(e.target)) {
        e.preventDefault();
      }
    };
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, []);

  // ── Context menu item click — mirrors $("#jqxMenu").on('itemclick', ...) ─
  const handleContextItemClick = useCallback(
    (item) => {
      const node = contextMenu.node;
      closeContextMenu();
      if (!node) return;

      if (item === "Visible") {
        updateFileControl(node.id, 1);
      } else {
        updateFileControl(node.id, 0);
      }
    },
    [contextMenu.node, closeContextMenu, updateFileControl]
  );

  // ── Esc — quit page, mirrors keydown Esc handler ───────────────────────────
  const handleEsc = useCallback(async () => {
    const proceed = await confirm("Do You Want To Quit Page?");
    if (proceed === "Yes") navigate("/Home");
  }, [confirm, navigate]);

  // ── Global keyboard shortcut: Esc = Quit ──────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.keyCode === 27) {
        e.preventDefault();
        handleEsc();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleEsc]);

  // Prevent the page UI from flashing before the redirect happens
  if (!isAuthorized) return null;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="bm-shell">
      {/* Confirm Dialog */}
      {ConfirmUI}

      <Topbar />

      <div className="bm-layout">
        <div className="bm-card">
          <div className="bm-card-header">
            <div className="bm-card-header-title">Menu Control Report</div>
            <button type="button" className="bm-close-x" aria-label="Close" onClick={handleEsc}>✕</button>
          </div>

          <div className="bm-card-body">
            <div className="bm-report-title">Menu Control Report</div>

            {/* ── Filter bar: UserName combobox + report type radio buttons ── */}
            <div style={{
              background: "#fff", border: "1px solid #c7cdd6", borderRadius: 8,
              padding: "10px 14px", display: "flex", gap: 14,
              alignItems: "center", flexWrap: "wrap",
            }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#1a2e4a", whiteSpace: "nowrap" }}>
                User Name
              </label>
              <select
                ref={userRef}
                className="bm-cell-input"
                style={{ width: 220, height: 30 }}
                value={selUserId}
                onChange={handleUserChange}
                onKeyDown={handleUserKeyDown}
              >
                <option value="">-- Select User --</option>
                {userList.map((u) => (
                  <option key={u.Id} value={u.Id}>
                    {u.UserName}
                  </option>
                ))}
              </select>

              <div className="mctr-radio-group">
                <label className="mctr-radio">
                  <input
                    type="radio"
                    name="reportType"
                    checked={reportType === "All"}
                    onChange={() => selectReportType("All")}
                  />
                  All
                </label>
                <label className="mctr-radio">
                  <input
                    type="radio"
                    name="reportType"
                    checked={reportType === "Crystal Report"}
                    onChange={() => selectReportType("Crystal Report1")}
                  />
                  Crystal Report
                </label>
                <label className="mctr-radio">
                  <input
                    type="radio"
                    name="reportType"
                    checked={reportType === "Reports"}
                    onChange={() => selectReportType("Reports")}
                  />
                  Reports
                </label>
                {/* Graphic Charts option intentionally disabled — same as the commented-out block in the original */}
              </div>
            </div>

            {/* ── Tree ── */}
            <div className="bm-grid-wrap mctr-tree-wrap" ref={treeWrapRef}>
              {treeItems.length > 0 ? (
                <ul className="mctr-tree">
                  {treeItems.map((node) => (
                    <TreeNode
                      key={node.id}
                      node={node}
                      expandedMap={expandedMap}
                      onToggleExpand={toggleExpand}
                      onContextMenu={handleNodeContextMenu}
                      depth={0}
                    />
                  ))}
                </ul>
              ) : (
                !loading && (
                  <div className="bm-empty">
                    Select a User Name and a Report Type to view the menu tree.
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right-click context menu ── */}
      {contextMenu.visible && (
        <ul
          className="mctr-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <li onClick={() => handleContextItemClick("Visible")}>Visible</li>
          <li onClick={() => handleContextItemClick("Hidden")}>Hidden</li>
        </ul>
      )}

      {/* ── Loading overlay ── */}
      {loading && (
        <div className="mp-loader-ov">
          <div className="mp-ldr-box">
            <div className="mp-spin" />
            <div className="mp-ldr-msg">Processing…</div>
          </div>
        </div>
      )}

      {/* ── Toast notifications ── */}
      <CC.ToastList toasts={toasts} />
    </div>
  );
}