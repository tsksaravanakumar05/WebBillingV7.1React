import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import Topbar from "../components/Topbar";
import '../Utilesstyle/Menumastersetting.css';
import { useToast, useConfirm, ToastList, SelectMenuMaster, UpdateMenuMaster, mkUrl, authHeaders } from "../components/Common";

// ── Constants ──────────────────────────────────────────────────────────────
const MENU_TYPES = [
  { id: "rbtAll",          label: "All",           value: "All",           visible: true  },
  { id: "rbtMaster",       label: "Master",        value: "Master",        visible: true  },
  { id: "rbtTransaction",  label: "Transaction",   value: "Transaction",   visible: true  },
  { id: "rbtCrystalReport",label: "Crystal Report",value: "Crystal Report",visible: true  },
  { id: "rbtReports",      label: "Reports",       value: "Reports",       visible: false },
  { id: "rbtGraphicCharts",label: "Graphic Charts",value: "Graphic Charts",visible: false },
  { id: "rbtUtils",        label: "Utils",         value: "Utils",         visible: true  },
];

// ── AlertModal ─────────────────────────────────────────────────────────────
function AlertModal({ open, message, onClose }) {
  if (!open) return null;
  return (
    <div className="mp-modal-ov">
      <div className="mp-modal">
        <h3>Notice</h3>
        <p>{message}</p>
        <div className="mp-modal-btns">
          <button className="mp-modal-btn yes" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
}

// ── PasswordModal ──────────────────────────────────────────────────────────
function PasswordModal({ open, onConfirm, onCancel, busy }) {
  const inputRef = useRef(null);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (open) {
      setPassword("");
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); onConfirm(password); }
    else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
  };

  return (
    <div className="mp-modal-ov">
      <div className="mp-pwd-modal">
        <h3>Password Verification</h3>
        <input
          ref={inputRef}
          type="password"
          className="mp-pwd-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter password"
          disabled={busy}
          autoComplete="off"
        />
        <div className="mp-modal-btns" style={{ marginTop: 14 }}>
          <button className="mp-modal-btn no"  onClick={onCancel}                disabled={busy}>Cancel</button>
          <button className="mp-modal-btn yes" onClick={() => onConfirm(password)} disabled={busy}>Verify</button>
        </div>
      </div>
    </div>
  );
}

// ── Loader ─────────────────────────────────────────────────────────────────
function Loader({ show, message = "Loading..." }) {
  if (!show) return null;
  return (
    <div className="mp-loader-ov">
      <div className="mp-ldr-box">
        <div className="mp-spin" />
        <div className="mp-ldr-msg">{message}</div>
      </div>
    </div>
  );
}

// ── ViewPopup ──────────────────────────────────────────────────────────────
function ViewPopup({ open, item, onClose }) {
  if (!open || !item) return null;
  return (
    <div className="mp-modal-ov">
      <div className="mp-modal">
        <h3>Menu Item Detail</h3>
        <p>
          <strong>Name:</strong> {item.label}<br />
          <strong>Id:</strong> {item.id}<br />
          <strong>Parent Id:</strong> {item.value ?? "-"}<br />
          <strong>Status:</strong> {item.checked ? "Visible" : "Hidden"}
        </p>
        <div className="mp-modal-btns">
          <button className="mp-modal-btn yes" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── ContextMenu ────────────────────────────────────────────────────────────
function ContextMenu({ open, x, y, onToggleVisible, onClose, currentlyVisible }) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <ul ref={menuRef} className="mp-context-menu" style={{ top: y, left: x }} role="menu">
      <li role="menuitem" onClick={onToggleVisible}>
        {currentlyVisible ? "Hide" : "Visible"}
      </li>
    </ul>
  );
}

// ── TreeNode (recursive) ───────────────────────────────────────────────────
function TreeNode({ node, depth, selectedId, expandedIds, onSelect, onToggleExpand, onContextMenu }) {
  const hasChildren = node.items && node.items.length > 0;
  const isExpanded  = expandedIds.has(node.id);
  const isSelected  = selectedId === node.id;

  return (
    <li className="mp-tree-li">
      <div
        className={`mp-tree-row ${isSelected ? "sel" : ""} ${node.checked ? "visible-item" : ""}`}
        style={{ paddingLeft: 14 + depth * 18 }}
        onClick={() => onSelect(node)}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        {hasChildren ? (
          <span className="mp-tree-toggle" onClick={(e) => { e.stopPropagation(); onToggleExpand(node.id); }}>
            {isExpanded ? "▾" : "▸"}
          </span>
        ) : (
          <span className="mp-tree-toggle-spacer" />
        )}
        <span className="mp-tree-label">{node.label}</span>
      </div>
      {hasChildren && isExpanded && (
        <ul className="mp-tree-ul">
          {node.items.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              onContextMenu={onContextMenu}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function buildHierarchy(flatData) {
  if (!Array.isArray(flatData)) return [];

  const byId = new Map();
  flatData.forEach((row) => {
    byId.set(row.Id, {
      id:      row.Id,
      label:   row.AccountName,
      value:   row.ParentId,
      checked: !!row.Status,
      items:   [],
    });
  });

  const roots = [];
  byId.forEach((node) => {
    const parentId = node.value;
    if (parentId && byId.has(parentId) && parentId !== node.id) {
      byId.get(parentId).items.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function flattenTree(nodes, acc = []) {
  nodes.forEach((n) => {
    acc.push(n);
    if (n.items && n.items.length) flattenTree(n.items, acc);
  });
  return acc;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function Menumastersetting() {
  // eslint-disable-next-line no-unused-vars
  const [comid]  = useState(() => localStorage.getItem("Comid"));
  const [userid] = useState(() => localStorage.getItem("userid"));

  const [selectedType, setSelectedType] = useState("All");
  const [treeData,     setTreeData]     = useState([]);
  const [expandedIds,  setExpandedIds]  = useState(new Set());
  const [selectedNode, setSelectedNode] = useState(null);

  const [loading,       setLoading]       = useState(false);
  const [loaderMessage, setLoaderMessage] = useState("Loading...");

  const { toast: pushToastRaw, toasts } = useToast();
  const pushToast = useCallback(
    (msg, type) => pushToastRaw(msg, type === "err"),
    [pushToastRaw]
  );

  const { confirm: showConfirmCommon, ConfirmUI } = useConfirm();
  const showConfirm = useCallback(
    (message) => showConfirmCommon(message).then((ok) => (ok ? "Yes" : "No")),
    [showConfirmCommon]
  );

  const [alertState, setAlertState] = useState({ open: false, message: "" });
  const showAlert = useCallback((message) => setAlertState({ open: true, message }), []);

  const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0, node: null });

  const [pwdModal, setPwdModal] = useState({ open: false, pendingNode: null, pendingStatus: null });
  const [pwdBusy,  setPwdBusy]  = useState(false);

  const [viewPopup, setViewPopup] = useState({ open: false, item: null });
  const [searchTerm, setSearchTerm] = useState("");

  const gridHeightRef = useRef(null);
  const [gridHeight,  setGridHeight] = useState(420);

  useEffect(() => {
    const recalc = () => setGridHeight(Math.max((window.innerHeight || 600) - 275, 220));
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, []);

  // ── loadTree ──────────────────────────────────────────────────────────
  // FIX: Use query string (?Type=All&Comid=65) instead of JSON body.
  // ASP.NET Web API binds primitive params (string, Int32) from the query
  // string — NOT from a JSON body — unless [FromBody] is on the parameter.
  const loadTree = useCallback(
    async (type) => {
      if (!type) {
        showAlert("Select Option!!!");
        return;
      }

      setLoading(true);
      setLoaderMessage("Loading menu tree...");

      try {
        // ✅ FIX: Build query string — matches C# signature:
        //    SelectMenuMaster(string Type, Int32 Comid)
        const params = new URLSearchParams({
          Type:  type,
          Comid: String(Number(comid)),   // ensure numeric string, e.g. "65"
        });

        const url = `${mkUrl(SelectMenuMaster)}?${params}`;
        console.log("URL =", url);

        const response = await fetch(url, {
          method:  "POST",
          headers: { ...authHeaders() },
          // ✅ No Content-Type, no body — primitives come from query string
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        console.log("FULL RESPONSE =", result);
        console.log("DATA1 =", result.Data1);

        if (result.IsSuccess) {
          setTreeData(buildHierarchy(result.Data1 || []));
          setExpandedIds(new Set());
          setSelectedNode(null);
        } else {
          showAlert(result.Message || "No Data Found");
        }
      } catch (err) {
        console.error(err);
        showAlert(`Error\n${err?.message ?? "Unable to load menu tree."}`);
      } finally {
        setLoading(false);
      }
    },
    [comid, showAlert]   // ✅ FIX: added comid (was missing), removed unused userid
  );

  // ── updateMenuSetting ─────────────────────────────────────────────────
  const updateMenuSetting = useCallback(
    async (row) => {
  
      const payload = [
        {
          Id: row.Id,
          PageAdd: row.PageAdd,
          PageEdit: row.PageEdit,
          PageDelete: row.PageDelete,
          PageView: row.PageView,
          CompanyRefid: row.CompanyRefid || 0,
          ParentId: row.ParentId || 0,
          FormText: row.FormText || ""
        }
      ];
  
      setLoading(true);
  
      try {
        const response = await fetch(mkUrl(UpdateMenuMaster), {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json; charset=utf-8"
          },
          body: JSON.stringify(payload)
        });
  
        if (!response.ok)
          throw new Error(`HTTP ${response.status}`);
  
        const data = await response.json();
  
        if (data.IsSuccess || data.isSuccess) {
          pushToast(data.Message || data.message, "ok");
          return true;
        }
  
        showAlert(data.Message || data.message);
        return false;
  
      } catch (err) {
        showAlert(`Error\n${err?.message ?? "Update failed."}`);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [pushToast, showAlert]
  );

  // ── applyVisibilityToggle ─────────────────────────────────────────────
  const applyVisibilityToggle = useCallback((nodeId, makeVisible) => {
    setTreeData((prev) => {
      const clone = (nodes) =>
        nodes.map((n) => ({
          ...n,
          items:   n.items ? clone(n.items) : [],
          checked: n.id === nodeId ? makeVisible : n.checked,
        }));
      return clone(prev);
    });
  }, []);

  // ── Context menu handlers ─────────────────────────────────────────────
  const handleContextMenuToggle = useCallback(() => {
    const node = contextMenu.node;
    setContextMenu((s) => ({ ...s, open: false }));
    if (!node) return;
    setPwdModal({ open: true, pendingNode: node, pendingStatus: node.checked ? 0 : 1 });
  }, [contextMenu.node]);

  const handlePasswordConfirm = useCallback(
    async (password) => {
      if (!password) { showAlert("Password is required!!!"); return; }
      setPwdBusy(true);
      try {
        const { pendingNode, pendingStatus } = pwdModal;
        const success = await updateMenuSetting(pendingNode.id, pendingStatus);
        if (success) {
          applyVisibilityToggle(pendingNode.id, pendingStatus === 1);
          setSelectedNode((prev) =>
            prev?.id === pendingNode.id ? { ...prev, checked: pendingStatus === 1 } : prev
          );
        }
        setPwdModal({ open: false, pendingNode: null, pendingStatus: null });
      } finally {
        setPwdBusy(false);
      }
    },
    [pwdModal, updateMenuSetting, applyVisibilityToggle, showAlert]
  );

  const handlePasswordCancel = useCallback(
    () => setPwdModal({ open: false, pendingNode: null, pendingStatus: null }),
    []
  );

  // ── Tree interaction handlers ─────────────────────────────────────────
  const handleSelectNode = useCallback((node) => setSelectedNode(node), []);

  const handleToggleExpand = useCallback((nodeId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId);
      return next;
    });
  }, []);

  const handleTreeContextMenu = useCallback((e, node) => {
    e.preventDefault();
    setSelectedNode(node);
    setContextMenu({ open: true, x: e.clientX + 5, y: e.clientY + 5, node });
  }, []);

  const closeContextMenu = useCallback(
    () => setContextMenu((s) => ({ ...s, open: false })),
    []
  );

  const handleTypeChange = useCallback(
    (value) => { setSelectedType(value); loadTree(value); },
    [loadTree]
  );

  const refreshPage  = useCallback(() => loadTree(selectedType), [loadTree, selectedType]);
  const navigateHome = useCallback(() => window.open("/Home", "_self"), []);

  // ── Suppress browser context menu inside the tree ─────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.target.closest?.(".mp-tree-wrap")) e.preventDefault();
    };
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = async (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        const reply = await showConfirm("Do You Want To Quit Page?");
        if (reply === "Yes") window.location.href = "/Home";
      } else if (e.key === "F5") {
        e.preventDefault();
        if (selectedNode) setViewPopup({ open: true, item: selectedNode });
        else showAlert("Select an item to view!!!");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showConfirm, selectedNode, showAlert]);

  // ── Initial load ──────────────────────────────────────────────────────
  useEffect(() => {
    loadTree("All");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Client-side search / filter ───────────────────────────────────────
  const visibleTree = useMemo(() => {
    if (!searchTerm.trim()) return treeData;
    const term = searchTerm.toLowerCase();
    const filterNodes = (nodes) =>
      nodes.reduce((acc, n) => {
        const childMatches = n.items ? filterNodes(n.items) : [];
        if (n.label.toLowerCase().includes(term) || childMatches.length) {
          acc.push({ ...n, items: childMatches });
        }
        return acc;
      }, []);
    return filterNodes(treeData);
  }, [treeData, searchTerm]);

  // Auto-expand all matched nodes while searching
  useEffect(() => {
    if (!searchTerm.trim()) return;
    setExpandedIds(new Set(flattenTree(visibleTree).map((n) => n.id)));
  }, [searchTerm, visibleTree]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="mp-wrap">
      {/* Header */}
      <Topbar />

      {/* Body */}
      <div className="mp-body">
        {/* Toolbar */}
        <div className="mp-toolbar">
          <div className="mp-radio-group">
            {MENU_TYPES.filter((t) => t.visible).map((t) => (
              <label key={t.id} className="mp-radio-item">
                <input
                  type="radio"
                  name="options"
                  checked={selectedType === t.value}
                  onChange={() => handleTypeChange(t.value)}
                />
                <span>{t.label}</span>
              </label>
            ))}
          </div>

          <span style={{ flex: 1 }} />

          <input
            type="text"
            className="mp-search-input"
            placeholder="Search menu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <button
            className="mp-btn info"
            onClick={() =>
              selectedNode
                ? setViewPopup({ open: true, item: selectedNode })
                : showAlert("Select an item to view!!!")
            }
          >
            View
          </button>
          <button className="mp-btn nw" onClick={refreshPage}>Refresh</button>
          <button
            className="mp-btn nw"
            onClick={() => { setSearchTerm(""); setSelectedNode(null); setExpandedIds(new Set()); }}
          >
            Clear
          </button>
        </div>

        {/* Hint bar */}
        {/* <div className="mp-hint">
          Press <kbd>Esc</kbd> to quit this page &nbsp;|&nbsp;
          Press <kbd>F5</kbd> to view selected item &nbsp;|&nbsp;
          Right-click a row to toggle visibility
        </div> */}

        {/* Tree */}
        <div className="mp-grid-wrap mp-tree-wrap">
          {visibleTree.length === 0 && !loading ? (
            <div className="mp-empty-state">No menu items found.</div>
          ) : (
            <ul
              className="mp-tree-ul mp-tree-root"
              style={{ maxHeight: gridHeight, overflowY: "auto" }}
              ref={gridHeightRef}
            >
              {visibleTree.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedId={selectedNode?.id}
                  expandedIds={expandedIds}
                  onSelect={handleSelectNode}
                  onToggleExpand={handleToggleExpand}
                  onContextMenu={handleTreeContextMenu}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Overlays */}
      <Loader show={loading} message={loaderMessage} />
      <ToastList toasts={toasts} />
      <AlertModal
        open={alertState.open}
        message={alertState.message}
        onClose={() => setAlertState({ open: false, message: "" })}
      />
      {ConfirmUI}
      <ContextMenu
        open={contextMenu.open}
        x={contextMenu.x}
        y={contextMenu.y}
        currentlyVisible={!!contextMenu.node?.checked}
        onToggleVisible={handleContextMenuToggle}
        onClose={closeContextMenu}
      />
      <PasswordModal
        open={pwdModal.open}
        busy={pwdBusy}
        onConfirm={handlePasswordConfirm}
        onCancel={handlePasswordCancel}
      />
      <ViewPopup
        open={viewPopup.open}
        item={viewPopup.item}
        onClose={() => setViewPopup({ open: false, item: null })}
      />
    </div>
  );
}