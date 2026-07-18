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

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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

  // Re-usable API-backed <select> — identical pattern to ClosingStock.jsx's
  // ApiSelect, so it hits the same style of dropdown endpoints.
  const ApiSelect = ({ url, payload, headers = {}, labelKey, valueKey, value, onChange, placeholder }) => {
    const [list, setList] = useState([]);
    const [loadingList, setLoadingList] = useState(false);

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

    return (
      <div className="sio-field">
        <label className="sio-label">{placeholder.replace("Select ", "")}</label>
        <select
          className="sio-input"
          value={value?.value ?? ""}
          disabled={loadingList}
          onChange={(e) => {
            const selectedVal = e.target.value;
            const opt = list.find((o) => String(o[valueKey]) === selectedVal);
            if (opt) {
              onChange({ value: String(opt[valueKey]), label: opt[labelKey] });
            } else {
              onChange(null);
            }
          }}
        >
          <option value="">{loadingList ? "Loading..." : placeholder}</option>
          {list.map((o) => (
            <option key={o[valueKey]} value={o[valueKey]}>
              {o[labelKey]}
            </option>
          ))}
        </select>
      </div>
    );
  };

  // ── Scoped styles injected once (same tokens as ClosingStock.jsx/
  // InventoryQtyWise.jsx, "sio-" prefix) ──
  const styles = `
    .sio-shell {
      min-height: 100vh;
      background: #f0f2f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    }
    .sio-layout {
      display: flex;
      flex: 1;
      gap: 20px;
      padding: 24px;
      max-width: 1200px;
      width: 100%;
      margin: 0 auto;
      box-sizing: border-box;
    }
    .sio-nav {
      width: 220px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .sio-nav-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: #8a94a6;
      padding: 0 4px;
      margin-bottom: 2px;
    }
    .sio-nav-card {
      background: #fff;
      border: 2px solid transparent;
      border-radius: 10px;
      padding: 12px 14px;
      cursor: pointer;
      transition: border-color .15s, box-shadow .15s, background .15s;
      box-shadow: 0 1px 4px rgba(0,0,0,.07);
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .sio-nav-card:hover {
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 3px 12px rgba(26,86,219,.12);
    }
    .sio-nav-card.active {
      background: #eef3fd;
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 3px 12px rgba(26,86,219,.15);
    }
    .sio-nav-icon {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      background: #e8edfc;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      flex-shrink: 0;
    }
    .sio-nav-card.active .sio-nav-icon {
      background: var(--clr-primary, #1a56db);
    }
    .sio-nav-card-name {
      font-size: 13px;
      font-weight: 600;
      color: #1e2d3d;
      line-height: 1.3;
    }
    .sio-nav-card.active .sio-nav-card-name {
      color: var(--clr-primary, #1a56db);
    }
    .sio-panel {
      flex: 1;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,.08);
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
    }
    .sio-panel-header {
      border-bottom: 1px solid #e8ecf0;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .sio-panel-eyebrow {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: var(--clr-primary, #1a56db);
      margin-bottom: 6px;
    }
    .sio-panel-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e2d3d;
      line-height: 1.2;
    }
    .sio-section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .6px;
      color: #8a94a6;
      margin: 20px 0 10px;
    }
    .sio-section-title:first-of-type { margin-top: 0; }
    .sio-radio-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .sio-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 36px;
      padding: 0 14px;
      border-radius: 20px;
      border: 1.5px solid #d1d9e6;
      background: #f7f9fc;
      font-size: 13px;
      font-weight: 500;
      color: #4a5568;
      cursor: pointer;
      user-select: none;
      transition: border-color .15s, background .15s, color .15s;
    }
    .sio-chip:hover { border-color: var(--clr-primary, #1a56db); }
    .sio-chip.active {
      background: var(--clr-primary, #1a56db);
      border-color: var(--clr-primary, #1a56db);
      color: #fff;
    }
    .sio-form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 16px 20px;
      align-items: start;
      max-width: 100%;
      margin-top: 10px;
      margin-bottom: 24px;
    }
    .sio-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .sio-label {
      font-size: 13px;
      font-weight: 600;
      color: #4a5568;
    }
    .sio-input {
      height: 36px;
      border: 1.5px solid #d1d9e6;
      border-radius: 8px;
      padding: 0 12px;
      font-size: 13px;
      color: #1e2d3d;
      background: #fff;
      width: 100%;
      box-sizing: border-box;
      transition: border-color .15s, box-shadow .15s;
      outline: none;
    }
    .sio-input:focus {
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 0 0 3px rgba(26,86,219,.1);
    }
    .sio-actions {
      display: flex;
      gap: 12px;
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid #e8ecf0;
    }
    .sio-btn {
      height: 40px;
      padding: 0 28px;
      border-radius: 8px;
      border: none;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity .15s, box-shadow .15s;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .sio-btn:disabled { opacity: .5; cursor: not-allowed; }
    .sio-btn-primary {
      background: var(--clr-primary, #1a56db);
      color: #fff;
      box-shadow: 0 2px 8px rgba(26,86,219,.3);
    }
    .sio-btn-primary:not(:disabled):hover {
      opacity: .9;
      box-shadow: 0 4px 14px rgba(26,86,219,.4);
    }
    .sio-btn-secondary {
      background: #f0f2f5;
      color: #4a5568;
      border: 1.5px solid #d1d9e6;
    }
    .sio-btn-secondary:not(:disabled):hover {
      background: #e8ecf0;
    }
    .sio-msg {
      margin-top: 18px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }
    .sio-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .sio-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    @media (max-width: 760px) {
      .sio-layout { flex-direction: column; padding: 16px; }
      .sio-nav { width: 100%; flex-direction: row; flex-wrap: wrap; }
      .sio-nav-card { flex: 1 1 calc(33% - 7px); }
      .sio-panel { padding: 20px 16px; }
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
            <div className="sio-panel-header">
              <div className="sio-panel-eyebrow">Stock</div>
              <div className="sio-panel-title">Stock Inward/Outward/Transfer Report</div>
            </div>

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
                {loading ? "Loading…" : "▶ View"}
              </button>
              <button
                type="button"
                className="sio-btn sio-btn-secondary"
                onClick={handleRefresh}
                disabled={loading}
              >
                ↺ Refresh
              </button>
            </div>

            {msg && <div className={`sio-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
          </main>
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