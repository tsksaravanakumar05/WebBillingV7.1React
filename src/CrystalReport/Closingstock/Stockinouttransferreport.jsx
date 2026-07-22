// ─────────────────────────────────────────────────────────────────────────────
//  StockInOutTransferReport.jsx
//  React conversion of the legacy jQuery/jqxWidgets page — "Stock Inward/
//  Outward/Transfer-Report" — built on the exact same skeleton/design as
//  ClosingStock.jsx / InventoryQtyWise.jsx:
//    - CC.api / CC.getLocal / CC.getStr from Common.jsx
//    - same permission/session bootstrap pattern
//    - same openReportViewer(BASE_URL + /Reports/ReportViewer.aspx) pattern
//    - same nav-card panel + chip radio rows + "sio-" scoped styles
//  Styling: MasterPage.css tokens only — no new theme colors.
//
//  NOTE ON STRUCTURE: unlike ClosingStock/InventoryQtyWise, the "nav" here is
//  the transaction-type panel (Inward/Outward/Transfer/Received), not a
//  Group-By list — this mirrors the original jqxRadioButton groupName="Panel"
//  exactly (one active type at a time, each loading its own combo source).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle, X } from "lucide-react";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// ── API endpoints ───────────────────────────────────────────────────────────
// Default (non-EcoTech) report endpoint — mirrors the original
// "/Stock/StockInOutTransReport" $.ajax url, rewritten to the Web API layer
// following the same "/Stock/..." → "/api/StockReportApp/..." mapping used
// by ClosingStock.jsx and InventoryQtyWise.jsx.
const StockInOutTransReportUrl = "/api/StockReportApp/StockInOutTransReport";

// EcoTech-mode endpoints — mirror "/StockOutward/StockOutwardReport_EcoTech"
// and "/StockOutward/StockInwardReport_EcoTech", module-mapped to StockOutwardApp.
const StockOutwardReportEcoTechUrl = "/api/StockOutwardApp/StockOutwardReport_EcoTech";
const StockInwardReportEcoTechUrl = "/api/StockOutwardApp/StockInwardReport_EcoTech";

// Same Supplier/Customer combo endpoint used elsewhere in the app (Supplier
// vs. Customer is distinguished by AccountType, exactly like the legacy
// loadsuppliercombo / CustomerComboListSingle helpers).
const AccountListUrl = "/api/SupplierApp/SelectSupplier";
// Category combo — same endpoint ClosingStock.jsx uses for loadcategorycombo.
const CategoryListUrl = "/api/CategoryApp/SelectCategory";
// NOTE: the original jQuery file calls a local LoadBranchNot(...) helper for
// the Transfer/Received "To Branch" combo whose actual API URL was not
// provided. This is a best-guess endpoint name following the established
// naming convention — please replace with the real branch-list endpoint.
const BranchListUrl = "/api/BranchApp/SelectBranch";

// Cache-key bucket names sent alongside each report request (same Data15/
// CacheKey convention used by ClosingStockReport / InventoryQtyWiseReport),
// even though the legacy file predates this concept.
const CACHE_KEY_TYPE_DEFAULT = "StockInOutTransReport";
const CACHE_KEY_TYPE_OUTWARD_ECOTECH = "StockOutwardReport_EcoTech";
const CACHE_KEY_TYPE_INWARD_ECOTECH = "StockInwardReport_EcoTech";

// ── Panel identifiers (mirrors the 4 jqxRadioButtons, groupName="Panel") ───
const PANEL = {
  INWARD: "Inward",
  OUTWARD: "Outward",
  TRANSFER: "Transfer",
  RECEIVED: "Received",
};

// ── Report-itemwise identifiers (mirrors the 2 jqxRadioButtons, groupName="Pane2") ─
const REPORT_ITEMWISE = {
  ITEM: "Item",
  DETAIL: "Detail",
};

// Per-panel combo source config — which endpoint/labelKey the "category"
// combo (cmbcategory) loads, mirroring loadsuppliercombo / CustomerComboListSingle
// / LoadBranchNot being swapped in on each radio's click handler.
const panelComboConfig = (panel, comid) => {
  switch (panel) {
    case PANEL.INWARD:
      return {
        url: AccountListUrl,
        payload: { Comid: Number(comid), Startindex: -1, PageCount: 99999, AccountType: "SUPPLIER", Keyword: "", Column: "" },
        labelKey: "AccountName",
        valueKey: "Id",
        label: "Supplier",
        placeholder: "Select Supplier",
      };
    case PANEL.OUTWARD:
      return {
        url: AccountListUrl,
        payload: { Comid: Number(comid), Startindex: -1, PageCount: 99999, AccountType: "CUSTOMER", Keyword: "", Column: "" },
        labelKey: "AccountName",
        valueKey: "Id",
        label: "Customer",
        placeholder: "Select Customer",
      };
    case PANEL.TRANSFER:
    case PANEL.RECEIVED:
      return {
        url: BranchListUrl,
        payload: { Comid: Number(comid) },
        labelKey: "BranchName",
        valueKey: "Id",
        label: "To Branch",
        placeholder: "Select Branch",
      };
    default:
      return null;
  }
};

const todayStr = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const toMMDDYYYY = (isoDate) => {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  return `${m}/${d}/${y}`;
};

export default function StockInOutTransferReport() {
  const navigate = useNavigate();

  // ── Session / permission state ─────────────────────────────────────────
  const [pageAccess, setPageAccess] = useState({
    ready: false,
    allowed: false,
    pageview: 0,
  });

  // ── Company / settings state (loaded once from localStorage) ────────────
  const [session, setSession] = useState({
    Comid: "",
    MComid: "",
    CName: "",
    CAddress: "",
    CPhone: "",
    Ecotech: false,
    univercell: false,
  });

  // ── Panel selection (radio "Panel" behaviour: Inward checked by default) ─
  const [panel, setPanel] = useState(PANEL.INWARD);

  // ── Report-itemwise selection (radio "Pane2": Item checked by default) ──
  const [reportItemwise, setReportItemwise] = useState(REPORT_ITEMWISE.ITEM);

  // Combo selections { value, label }
  const [categorySel, setCategorySel] = useState(null); // cmbcategory
  const [category1Sel, setCategory1Sel] = useState(null); // cmbcategory1 (Transfer + univercell only)

  // ── Daily checkbox — kept in state for payload parity, but never rendered:
  // the legacy init() hides #rdodaliy in both the EcoTech and non-EcoTech
  // branches, so it is never actually interactive in the original page. ──
  const [daily, setDaily] = useState(false);

  // ── Date range ────────────────────────────────────────────────────────
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());

  // ── EcoTech-only text inputs ─────────────────────────────────────────────
  const [stockNo, setStockNo] = useState("");
  const [checklist, setChecklist] = useState("");

  // ── UI feedback state ───────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { text, isErr }

  // ── Bootstrap: permission + session, mirrors top of $(document).ready ──
  useEffect(() => {
    const menulist = CC.getLocal("menulist");
    if (menulist == null) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/Login/Index");
      return;
    }

    const menudata = menulist.filter((obj) => obj.PageName === "Stock Inward/Outward/Transfer-Report");
    if (!menudata || menudata.length === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      setTimeout(() => navigate("/Home"), 3000);
      return;
    }

    if (menudata[0].View === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      setTimeout(() => navigate("/Home"), 3000);
      return;
    }

    const Comid = CC.getStr("Comid");
    const MComid = CC.getStr("MComid");
    const MainSet = CC.getLocal("Mainsetting") || [{}];
    const ComSet = CC.getLocal("Companysetting") || [{}];

    setSession({
      Comid,
      MComid,
      CName: ComSet[0]?.CName || "",
      CAddress: ComSet[0]?.CAddress || "",
      CPhone: ComSet[0]?.CPhone || "",
      Ecotech: !!MainSet[0]?.Ecotech,
      univercell: !!MainSet[0]?.univercell,
    });

    setPageAccess({
      ready: true,
      allowed: true,
      pageview: menudata[0].View,
      pageadd: menudata[0].Add,
      pageedit: menudata[0].Edit,
      pagedelete: menudata[0].Delete,
    });
  }, [navigate]);

  // ── Esc key — "Do you want to quit page?" (same as ClosingStock.jsx) ────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.keyCode === 27) {
        e.preventDefault();
        if (window.confirm("Do You Want To Quit Page?")) {
          navigate("/Login/Home");
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  // ── Panel selection (radio "Panel" behaviour) — each click reloads the
  // category combo from a different source and resets Daily, mirroring the
  // four separate $('#rdbStock...').on('click', ...) handlers. ──
  const selectPanel = useCallback((value) => {
    setPanel(value);
    setCategorySel(null);
    setCategory1Sel(null);
    setDaily(false);
  }, []);

  // ── Refresh button — mirrors #btnrefresh click handler exactly: resets
  // dates, clears both combos, unchecks Daily. Panel/Pane2/StockNo/Checklist
  // are left untouched, matching the original (which never resets them). ──
  const handleRefresh = useCallback(() => {
    setFromDate(todayStr());
    setToDate(todayStr());
    setCategorySel(null);
    setCategory1Sel(null);
    setDaily(false);
    setMsg(null);
  }, []);

  // ── Report viewer opener — same pattern as ClosingStock.jsx ─────────────
  const openReportViewer = useCallback((params) => {
    const qs = new URLSearchParams(params).toString();
    const url = `${CC.BASE_URL}/Reports/ReportViewer.aspx?${qs}`;

    const w = window.open(
      url,
      "_blank",
      `directories=0,titlebar=0,toolbar=0,location=0,status=0,` +
        `menubar=0,scrollbars=yes,resizable=no,` +
        `width=${screen.width},height=${screen.height - 100}`
    );
    return w;
  }, []);

  // ── View button — replicates the legacy $('#btnview').on('click', ...) logic ──
  const handleView = useCallback(async () => {
    const Fromdate = toMMDDYYYY(fromDate);
    const Todate = toMMDDYYYY(toDate);

    // Date validation — mirrors:
    // if (Ecotech == false && !$("#rdbStockOutward").jqxRadioButton('val')) { ... }
    if (!session.Ecotech && panel !== PANEL.OUTWARD) {
      const startdate = new Date(Fromdate);
      const enddate = new Date(Todate);
      if (startdate > enddate) {
        setMsg({ text: "From Date Is Greater Than To Date!!", isErr: true });
        return;
      }
    }

    const ReportTypenew = daily ? "D" : "";
    const Reportitemwise = reportItemwise === REPORT_ITEMWISE.ITEM ? "Item" : "Detail";

    let GroupBy = "";
    let GroupByText = "";
    let Category = "";
    let ReportTitle = "";

    if (panel === PANEL.INWARD) {
      GroupBy = "Inward";
      ReportTitle = reportItemwise === REPORT_ITEMWISE.ITEM ? "StockInwards Itemwise Report" : "StockInwards Details Report";
      if (categorySel) {
        GroupByText = categorySel.label;
        if (!GroupByText) {
          setMsg({ text: "Please Select Valid Supplier Name !!!.", isErr: true });
          return;
        }
      }
    }
    if (panel === PANEL.OUTWARD) {
      GroupBy = "Outward";
      ReportTitle = reportItemwise === REPORT_ITEMWISE.ITEM ? "StockOutward Itemwise Report" : "StockOutward Details Report";
      if (categorySel) {
        GroupByText = categorySel.label;
        if (!GroupByText) {
          setMsg({ text: "Please Select Valid Customer Name !!!.", isErr: true });
          return;
        }
      }
    }
    if (panel === PANEL.TRANSFER) {
      GroupBy = "Transfer";
      ReportTitle = reportItemwise === REPORT_ITEMWISE.ITEM ? "StockTransfer Itemwise Report" : "StockTransfer Details Report";
      if (categorySel) {
        GroupByText = categorySel.label;
        if (!GroupByText) {
          setMsg({ text: "Please Select Valid Branch Name !!!.", isErr: true });
          return;
        }
      }
      if (category1Sel) {
        Category = category1Sel.label;
        if (!Category) {
          setMsg({ text: "Please Select Valid Category Name !!!.", isErr: true });
          return;
        }
      }
    }
    if (panel === PANEL.RECEIVED) {
      GroupBy = "Received";
      ReportTitle = reportItemwise === REPORT_ITEMWISE.ITEM ? "StockReceived Itemwise Report" : "StockReceived Details Report";
      if (categorySel) {
        GroupByText = categorySel.label;
        if (!GroupByText) {
          setMsg({ text: "Please Select Valid Branch Name !!!.", isErr: true });
          return;
        }
      }
    }

    setLoading(true);
    setMsg(null);

    const Comid = parseInt(session.Comid, 10) || 0;
    const MComid = parseInt(session.MComid, 10) || 0;

    try {
      if (session.Ecotech && panel === PANEL.OUTWARD) {
        // ── EcoTech Stock Outward branch ──
        const res = await CC.api(
          StockOutwardReportEcoTechUrl,
          null,
          { CacheKeyType: CACHE_KEY_TYPE_OUTWARD_ECOTECH, React: 1 },
          {
            Id: 0,
            PNo: parseInt(stockNo, 10) || 0,
            Comid,
            CusId: GroupByText || 0,
            FromDate: Fromdate,
            ToDate: Todate,
            ChkList: checklist || "",
          }
        );
        if (res?.redis === false) {
          setMsg({ text: "Already Login Another User Please Login Again!!!", isErr: true });
          navigate("/");
          return;
        }
        if (res?.ok === true) {
          openReportViewer({
            ReportName: "StockOutETPrint",
            A4Print: 0,
            ReportTitle: "Stock Outward",
            Rep: 1,
          });
        } else {
          setMsg({ text: res?.message || "No Record !!!.", isErr: true });
        }
      } else if (session.Ecotech && panel === PANEL.INWARD) {
        // ── EcoTech Stock Inward branch ──
        const res = await CC.api(
          StockInwardReportEcoTechUrl,
          null,
          { CacheKeyType: CACHE_KEY_TYPE_INWARD_ECOTECH, React: 1 },
          {
            Id: 0,
            PNo: parseInt(stockNo, 10) || 0,
            Comid,
            CusId: GroupByText || 0,
            FromDate: Fromdate,
            ToDate: Todate,
            ChkList: checklist || "",
          }
        );
        if (res?.redis === false) {
          setMsg({ text: "Already Login Another User Please Login Again!!!", isErr: true });
          navigate("/Login");
          return;
        }
        if (res?.ok === true) {
          openReportViewer({
            ReportName: "StockIn",
            A4Print: 0,
            ReportTitle: "Stock Outward",
            Rep: 1,
          });
        } else {
          setMsg({ text: res?.message || "No Record !!!.", isErr: true });
        }
      } else {
        // ── Default branch — covers non-EcoTech (any panel) and EcoTech
        // Transfer/Received, exactly matching the legacy else-block. ──
        const res = await CC.api(
          StockInOutTransReportUrl,
          null,
          { CacheKeyType: CACHE_KEY_TYPE_DEFAULT, React: 1 },
          {
            Daily: daily || "",
            GroupBy: GroupBy || "",
            GroupByText: GroupByText || "",
            Category: Category || "",
            Reportitemwise: Reportitemwise || "",
            Fromdate: Fromdate || "",
            Todate: Todate || "",
            Comid,
            MComid,
            univercell: session.univercell || "",
          }
        );

        if (res?.ok === true) {
           if(res.Data1==null){
           setMsg({ text: "No Record !!!.", isErr: true });
           return;
           } 
          const cacheKey = res.Data15 || res.CacheKey || "";
          openReportViewer({
            ReportName: "StockInOutTransReport",
            CacheKey: cacheKey,
            Reportitemwise,
            Daily: daily,
            GroupBy,
            Fromdate: Fromdate,
            Todate: Todate,
            ReportType: ReportTypenew,
            ReportTitle,
            CName: session.CName,
            CAddress: session.CAddress,
            CPhone: session.CPhone,
          });
        } else {
          setMsg({ text: "No Record !!!.", isErr: true });
        }
      }
    } catch (err) {
      setMsg({ text: err.message || "Something went wrong.", isErr: true });
    } finally {
      setLoading(false);
    }
  }, [
    fromDate,
    toDate,
    session,
    panel,
    reportItemwise,
    categorySel,
    category1Sel,
    daily,
    stockNo,
    checklist,
    openReportViewer,
    navigate,
  ]);

  // ── Panel nav items ──────────────────────────────────────────────────────
  const panelItems = useMemo(
    () => [
      { value: PANEL.INWARD, label: "Stock Inward", icon: "📥" },
      { value: PANEL.OUTWARD, label: "Stock Outward", icon: "📤" },
      { value: PANEL.TRANSFER, label: "Stock Transfer", icon: "🔁" },
      { value: PANEL.RECEIVED, label: "Stock Received", icon: "📦" },
    ],
    []
  );

  const comboConfig = panelComboConfig(panel, session.Comid);

  // Row visibility, mirroring the original show()/hide() calls exactly:
  // - rowstockno: shown only in EcoTech mode (set once in init(), never
  //   toggled by panel clicks).
  const showStockNo = session.Ecotech;
  // - rowchecklist: shown only when Stock Outward is the active panel
  //   (independent of EcoTech — the click handler shows it regardless).
  const showChecklist = panel === PANEL.OUTWARD;
  // - cmbcategory1/rbtcategory1: shown only for Transfer when univercell is on.
  const showCategory1 = panel === PANEL.TRANSFER && session.univercell;
  // - rdbitemwise/rdbdetails (Pane2): hidden entirely in EcoTech mode.
  const showReportItemwise = !session.Ecotech;

  // Re-usable API-backed searchable combo — same data-loading pattern as the
  // original ApiSelect (identical to ClosingStock.jsx's), but the plain
  // <select> is replaced with a text-filterable dropdown popup so any combo
  // built on this (Supplier, Customer, To Branch, Category, ...) gets
  // instant search for free. onChange contract is unchanged: fires
  // {value, label} or null, exactly as before.
  const ApiSelect = ({ url, payload, headers = {}, labelKey, valueKey, value, onChange, placeholder }) => {
    const [list, setList] = useState([]);
    const [loadingList, setLoadingList] = useState(false);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const wrapRef = useRef(null);
    const searchRef = useRef(null);

    useEffect(() => {
      let active = true;
      (async () => {
        setLoadingList(true);
        try {
          const res = await CC.api(url, null, headers, payload);
          if (!active) return;
          const raw = Array.isArray(res?.data) ? res.data : Array.isArray(res?.Data1) ? res.Data1 : Array.isArray(res) ? res : [];
          setList(raw);
        } catch (err) {
          console.error(err);
        } finally {
          if (active) setLoadingList(false);
        }
      })();
      return () => { active = false; };
    }, [url, JSON.stringify(payload), JSON.stringify(headers)]);

    // Close popup on outside click, and reset the search box each time.
    useEffect(() => {
      const handleClickOutside = (e) => {
        if (wrapRef.current && !wrapRef.current.contains(e.target)) {
          setOpen(false);
          setSearch("");
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Autofocus the search box the moment the popup opens.
    useEffect(() => {
      if (open && searchRef.current) searchRef.current.focus();
    }, [open]);

    // Instant client-side filter — case-insensitive substring match on the label.
    const filteredList = useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return list;
      return list.filter((o) => String(o[labelKey] ?? "").toLowerCase().includes(q));
    }, [list, search, labelKey]);

    const handleSelect = (opt) => {
      onChange({ value: String(opt[valueKey]), label: opt[labelKey] });
      setOpen(false);
      setSearch("");
    };

    const handleClear = (e) => {
      e.stopPropagation();
      onChange(null);
    };

    const handleToggle = () => {
      if (loadingList) return;
      setOpen((o) => !o);
    };

    const handleKeyDown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleToggle();
      } else if (e.key === "Escape") {
        setOpen(false);
        setSearch("");
      }
    };

    return (
      <div className="sio-field" ref={wrapRef}>
        <label className="sio-label">{placeholder.replace("Select ", "")}</label>
        <div className="sio-select-wrap">
          <div
            className={`sio-input sio-select-trigger${open ? " open" : ""}`}
            role="button"
            tabIndex={0}
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={handleToggle}
            onKeyDown={handleKeyDown}
          >
            <span className={`sio-select-value${!value ? " placeholder" : ""}`}>
              {loadingList ? "Loading..." : value ? value.label : placeholder}
            </span>
            {value && !loadingList && (
              <span
                className="sio-select-clear"
                role="button"
                tabIndex={0}
                aria-label="Clear selection"
                onClick={handleClear}
                onKeyDown={(e) => e.key === "Enter" && handleClear(e)}
              >
                ×
              </span>
            )}
            <span className="sio-select-caret" aria-hidden="true">▾</span>
          </div>

          {open && !loadingList && (
            <div className="sio-select-popup" role="listbox">
              <input
                ref={searchRef}
                type="text"
                className="sio-select-search"
                placeholder="Type to search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setOpen(false);
                    setSearch("");
                  }
                }}
              />
              <div className="sio-select-list">
                {filteredList.length === 0 && (
                  <div className="sio-select-empty">No matches found</div>
                )}
                {filteredList.map((o) => (
                  <div
                    key={o[valueKey]}
                    role="option"
                    aria-selected={value?.value === String(o[valueKey])}
                    className={`sio-select-option${value?.value === String(o[valueKey]) ? " selected" : ""}`}
                    onClick={() => handleSelect(o)}
                  >
                    {o[labelKey]}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Scoped styles injected once (same tokens as ClosingStock.jsx/
  // InventoryQtyWise.jsx, "sio-" prefix) ──
  const styles = `
    .sio-shell { min-height: 100vh; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }
    .sio-layout { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 24px; box-sizing: border-box; }
    .sio-card { width: 100%; max-width: 1000px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }
    .sio-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .sio-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .sio-card-close-btn { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 6px; border: none; background: rgba(255,255,255,.16); color: #fff; cursor: pointer; padding: 0; transition: background .15s; }
    .sio-card-close-btn:hover { background: rgba(255,255,255,.3); }
    .sio-card-body { padding: 24px 32px 30px; }
    .sio-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .sio-content { display: flex; gap: 28px; }

    .sio-nav { flex: 0 0 220px; display: flex; flex-direction: column; gap: 8px; }
    .sio-nav-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #8a94a6; padding: 0 4px; margin-bottom: 2px; }
    .sio-nav-card { background: #fff; border: 1.5px solid #d1d9e6; border-radius: 8px; padding: 10px 12px; cursor: pointer; transition: border-color .15s, box-shadow .15s, background .15s; display: flex; align-items: center; gap: 10px; }
    .sio-nav-card:hover { border-color: #1a56db; box-shadow: 0 3px 12px rgba(26,86,219,.12); }
    .sio-nav-card.active { background: #eef3ff; border-color: #1a56db; box-shadow: 0 3px 12px rgba(26,86,219,.15); }
    .sio-nav-icon { width: 28px; height: 28px; border-radius: 8px; background: #e8edfc; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
    .sio-nav-card.active .sio-nav-icon { background: #1a56db; }
    .sio-nav-card-name { font-size: 13px; font-weight: 600; color: #1e2d3d; line-height: 1.3; }
    .sio-nav-card.active .sio-nav-card-name { color: #1a56db; }

    .sio-panel { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .sio-panel-header { border-bottom: 1px solid #e8ecf0; padding-bottom: 14px; margin-bottom: 20px; }
    .sio-panel-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #1a56db; margin-bottom: 6px; }
    .sio-panel-title { font-size: 16px; font-weight: 700; color: #1e2d3d; line-height: 1.2; }

    .sio-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: #8a94a6; margin: 20px 0 10px; }
    .sio-section-title:first-of-type { margin-top: 0; }

    .sio-radio-row { display: flex; flex-wrap: wrap; gap: 8px; }
    .sio-chip { display: flex; align-items: center; gap: 6px; height: 32px; padding: 0 14px; border-radius: 20px; border: 1px solid #c7cdd6; background: #fff; font-size: 12.5px; font-weight: 600; color: #1e293b; cursor: pointer; user-select: none; transition: border-color .15s, background .15s, color .15s; }
    .sio-chip:hover { border-color: #1a56db; }
    .sio-chip.active { background: #eef3ff; border-color: #1a56db; color: #1a56db; }

    .sio-form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px 16px; align-items: start; max-width: 100%; margin-top: 6px; margin-bottom: 20px; }
    .sio-field { display: flex; flex-direction: column; gap: 6px; }
    .sio-label { font-size: 13px; font-weight: 600; color: #1e293b; }
    .sio-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .sio-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    select.sio-input { appearance: auto; cursor: pointer; }
    .sio-input:disabled { background: #f5f6f8; cursor: not-allowed; }

    .sio-select-wrap { position: relative; }
    .sio-select-trigger { display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
    .sio-select-trigger.open { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    .sio-select-value { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sio-select-value.placeholder { color: #8a94a6; }
    .sio-select-clear { flex-shrink: 0; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #8a94a6; font-size: 14px; line-height: 1; cursor: pointer; transition: background .15s, color .15s; }
    .sio-select-clear:hover { background: #eef1f5; color: #dc3545; }
    .sio-select-caret { flex-shrink: 0; font-size: 10px; color: #8a94a6; }

    .sio-select-popup { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 20; background: #fff; border: 1px solid #c7cdd6; border-radius: 6px; box-shadow: 0 8px 24px rgba(30,45,61,.14); overflow: hidden; }
    .sio-select-search { width: 100%; height: 32px; border: none; border-bottom: 1px solid #e8ecf0; padding: 0 10px; font-size: 13px; color: #1e2d3d; outline: none; box-sizing: border-box; }
    .sio-select-search:focus { background: #f7f9fc; }
    .sio-select-list { max-height: 220px; overflow-y: auto; }
    .sio-select-option { padding: 8px 12px; font-size: 13px; color: #1e2d3d; cursor: pointer; transition: background .12s; }
    .sio-select-option:hover { background: #eef3ff; }
    .sio-select-option.selected { background: #eef3ff; color: #1a56db; font-weight: 600; }
    .sio-select-empty { padding: 10px 12px; font-size: 12.5px; color: #8a94a6; text-align: center; }

    .sio-actions { display: flex; gap: 12px; margin-top: 28px; padding-top: 22px; border-top: 1px solid #e8ecf0; }
    .sio-btn { height: 38px; padding: 0 30px; border-radius: 6px; border: 1px solid #1a56db; font-size: 14px; font-weight: 700; cursor: pointer; transition: opacity .15s, box-shadow .15s, background .15s; display: flex; align-items: center; gap: 8px; background: #fff; color: #1a56db; }
    .sio-btn:disabled { opacity: .5; cursor: not-allowed; }
    .sio-btn:not(:disabled):hover { background: #eef3ff; }
    .sio-btn-primary { border-color: #1e7e34; color: #1e7e34; }
    .sio-btn-primary .sio-icon-save { color: #1e7e34; }
    .sio-btn-secondary { border-color: #dc3545; color: #dc3545; }
    .sio-btn-secondary .sio-icon-cancel { color: #dc3545; }

    .sio-msg { margin-top: 18px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; }
    .sio-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .sio-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }

    @media (max-width: 760px) {
      .sio-card-body { padding: 20px; }
      .sio-content { flex-direction: column; gap: 22px; }
      .sio-nav { flex: none; width: 100%; flex-direction: row; flex-wrap: wrap; }
      .sio-nav-card { flex: 1 1 calc(33% - 7px); }
      .sio-form-grid { grid-template-columns: 1fr; }
    }
  `;

  if (!pageAccess.ready) {
    return (
      <div className="mp-wrap">
        <div className="mp-body">
          {msg && <div className={`mp-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
        </div>
      </div>
    );
  }

  if (!pageAccess.allowed) {
    return (
      <div className="mp-wrap">
        <div className="mp-body">
          <div className="mp-msg err">Page Access Permission Denied !!!.</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div className="sio-shell">
        <Topbar />

        <div className="sio-layout">
          <div className="sio-card">
            <div className="sio-card-header">
              <div className="sio-card-header-title">Stock Inward/Outward/Transfer Report</div>
              <button
                type="button"
                className="sio-card-close-btn"
                onClick={() => navigate(-1)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="sio-card-body">
              <div className="sio-report-title">Stock In/Out/Transfer - Report</div>

              <div className="sio-content">
              {/* ── LEFT: Transaction-type navigation panel ── */}
              <nav className="sio-nav" aria-label="Stock Report Type">
                <div className="sio-nav-label">Report Type</div>
                {panelItems.map((item) => (
                  <div
                    key={item.value}
                    className={`sio-nav-card${panel === item.value ? " active" : ""}`}
                    onClick={() => selectPanel(item.value)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && selectPanel(item.value)}
                    aria-pressed={panel === item.value}
                  >
                    <div className="sio-nav-icon">{item.icon}</div>
                    <div className="sio-nav-card-name">{item.label}</div>
                  </div>
                ))}
              </nav>

              {/* ── RIGHT: Filter panel ── */}
              <main className="sio-panel">
            <div className="sio-form-grid">
              {comboConfig && (
                <ApiSelect
                  url={comboConfig.url}
                  payload={comboConfig.payload}
                  labelKey={comboConfig.labelKey}
                  valueKey={comboConfig.valueKey}
                  value={categorySel}
                  onChange={setCategorySel}
                  placeholder={comboConfig.placeholder}
                />
              )}
              {showCategory1 && (
                <ApiSelect
                  url={CategoryListUrl}
                  payload={{ Comid: session.Comid }}
                  labelKey="Cat_Name"
                  valueKey="Id"
                  value={category1Sel}
                  onChange={setCategory1Sel}
                  placeholder="Select Category"
                />
              )}

              {showStockNo && (
                <div className="sio-field">
                  <label className="sio-label" htmlFor="sio-stockno">Stock No</label>
                  <input
                    id="sio-stockno"
                    type="text"
                    className="sio-input"
                    placeholder="Enter Stock No..."
                    value={stockNo}
                    onChange={(e) => setStockNo(e.target.value)}
                  />
                </div>
              )}
              {showChecklist && (
                <div className="sio-field">
                  <label className="sio-label" htmlFor="sio-checklist">Checklist</label>
                  <input
                    id="sio-checklist"
                    type="text"
                    className="sio-input"
                    placeholder="Enter Checklist..."
                    value={checklist}
                    onChange={(e) => setChecklist(e.target.value)}
                  />
                </div>
              )}

              <div className="sio-field">
                <label className="sio-label" htmlFor="sio-from-date">From Date</label>
                <input
                  id="sio-from-date"
                  type="date"
                  className="sio-input"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="sio-field">
                <label className="sio-label" htmlFor="sio-to-date">To Date</label>
                <input
                  id="sio-to-date"
                  type="date"
                  className="sio-input"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>

            {showReportItemwise && (
              <>
                <div className="sio-section-title">Report Format</div>
                <div className="sio-radio-row">
                  {[
                    { value: REPORT_ITEMWISE.ITEM, label: "Itemwise" },
                    { value: REPORT_ITEMWISE.DETAIL, label: "Details" },
                  ].map((o) => (
                    <div
                      key={o.value}
                      className={`sio-chip${reportItemwise === o.value ? " active" : ""}`}
                      onClick={() => setReportItemwise(o.value)}
                      role="button"
                      tabIndex={0}
                    >
                      {o.label}
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="sio-actions">
              <button
                type="button"
                className="sio-btn sio-btn-primary"
                disabled={loading || pageAccess.pageview === 0}
                onClick={handleView}
              >
                <Save size={16} className="sio-icon-save" />
                {loading ? "Loading…" : "View"}
              </button>
              <button
                type="button"
                className="sio-btn sio-btn-secondary"
                onClick={handleRefresh}
                disabled={loading}
              >
                <XCircle size={16} className="sio-icon-cancel" />
                Refresh
              </button>
            </div>

            {msg && <div className={`sio-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
              </main>
              </div>
            </div>
          </div>
        </div>

        {loading && (
          <div className="mp-loader-ov">
            <div className="mp-ldr-box">
              <div className="mp-spin" />
              <div className="mp-ldr-msg">Loading...</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}