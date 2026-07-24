// ─────────────────────────────────────────────────────────────────────────────
//  BranchWise.jsx
//  React conversion of BranchWise.js (jQuery) — "Branch Wise Report"
//  Uses API helpers from Common.jsx (CC.api / CC.mkUrl / CC.authHeaders etc.)
//  Styling: recolored to match CompanyCreation.jsx palette
//    - Border / header / heading -> blue (#1a56db)
//    - Save-style accents -> green (#1e7e34)
//    - Cancel / link accents -> red (#dc3545)
//
//  IMPORTANT — quirks preserved exactly from BranchWise.js (do not "fix"):
//  1) The permission/menulist check block is commented out in the source, so
//     this screen has NO page-access gate (pageAccess is always allowed here).
//  2) "Qty" sent to the report AJAX body is HARD-CODED to "1" regardless of
//     the Qty/Amount radio selection — only the ReportViewer query string
//     "Qty" param reflects the actual radio value. Preserved as-is.
//  3) The selected Product (cmbDescription) is validated but NEVER actually
//     sent in the AJAX request body — only Bid/Fromdate/Todate/Reportype/
//     Qty/MComid are sent. Preserved as-is.
//  4) `Consdetail == "QTY"` in the source is a comparison, not an assignment
//     — so Consdetail is only ever "" or "Amount", never "QTY". This means
//     the ProductWise/StockWise ReportTitle ALWAYS resolves to the
//     "...Sale Amount - Report" text, even when the Qty radio is selected.
//     Preserved as-is (bug and all) since the task requires 100% identical
//     business logic.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle } from "lucide-react";
import * as CC from "../../components/Common"
import Topbar from "../../components/Topbar";
import   DateFieldDDMMYYYY from "../../Commondatetime";

// Report-type identifiers (mirrors the 5 jqxRadioButtons in "Panel1")
const REPORT_TYPES = {
  ITEMWISE: "ITEMWISE",
  DATEWISE: "DATEWISE",
  PRODUCTWISE: "PRODUCTWISE",
  STOCKWISE: "STOCKWISE",
  STOCKTRANSFER: "StockTransfer",
};

// Basis identifiers (mirrors the 2 jqxRadioButtons in "Panel2")
const BASIS = {
  QTY: "QTY",
  AMOUNT: "AMOUNT",
};

const BASE_URL = "http://localhost:64215";

// API endpoint used by this screen
const BranchWiseReportUrl = "/api/SalesReportApp/BranchWiseReport";

// Product / Branch combo data sources — reusing existing Common.jsx constants
// (ASSUMPTION: these map to the original loadproductcombo()/LoadBranchAll()
// calls; adjust the field names in loadLists() below if the response shape differs)
const ProductListUrl = "/api/ItemMasterApp/GetProductListV7"; // "/api/ItemMasterApp/GetProductListV7"
const BranchListUrl  = "/api/CompanyApp/SelectCompany";    // "/api/CompanyApp/SelectCompany"


//StockReportApp/SelectBranchAll
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

export default function BranchWise() {
  const navigate = useNavigate();

  // ── Session state (Comid/MComid/company info) ──────────────────────────
  const [session, setSession] = useState({
    Comid: "",
    MComid: "",
    CName: "",
    CAddress: "",
    CPhone: "",
  });

  // ── Form state (controlled inputs replacing jqx widgets) ───────────────
  const [reportType, setReportType] = useState(REPORT_TYPES.ITEMWISE);
  const [basis, setBasis] = useState(BASIS.QTY);
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [selectedProduct, setSelectedProduct] = useState(""); // cmbDescription
  const [selectedBranch, setSelectedBranch] = useState("");   // cmbBranch

  // ── Combo data ───────────────────────────────────────────────────────────
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);

  // ── UI feedback state ───────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { text, isErr }

  // Bootstrap: session + combo lists.
  // NOTE: the original BranchWise.js has its menulist/permission-check block
  // fully commented out, so there is intentionally no page-access gate here.
  useEffect(() => {
    const Comid = CC.getStr("Comid");
    const MComid = CC.getStr("MComid");
    const ComSet = CC.getLocal("Companysetting") || [{}];

    setSession({
      Comid,
      MComid,
      CName: ComSet[0]?.CName || "",
      CAddress: ComSet[0]?.CAddress || "",
      CPhone: ComSet[0]?.CPhone || "",
    });

    const loadLists = async () => {
      try {
        const [prodRes, branchRes] = await Promise.all([
          CC.api(ProductListUrl, null, {}, { Comid: Comid }),
          CC.api(BranchListUrl, null, {}, { Comid: Comid }),
        ]);

        const prodList = prodRes?.data || prodRes?.Data1 || [];
        const branchList = branchRes?.data || branchRes?.Data1 || [];

        setProducts(Array.isArray(prodList) ? prodList : []);
        setBranches(Array.isArray(branchList) ? branchList : []);
      } catch (err) {
        // Combo load failure shouldn't block the page — same as jQuery,
        // where loadproductcombo()/LoadBranchAll() failures just leave
        // the comboboxes empty.
        console.error("BranchWise combo load error:", err);
      }
    };
    loadLists();
  }, []);

  const handleReportTypeChange = useCallback((type) => {
    setReportType(type);
  }, []);

  const handleRefresh = useCallback(() => {
    setSelectedProduct("");
    setSelectedBranch("");
    setFromDate(todayStr());
    setToDate(todayStr());
    setBasis(BASIS.QTY);
    setReportType(REPORT_TYPES.ITEMWISE);
  }, []);

  const openReportViewer = useCallback((params) => {
    const qs = new URLSearchParams(params).toString();
    const url = `${CC.BASE_URL}/Reports/ReportViewer.aspx?${qs}`;

    window.open(
      url,
      "_blank",
      `directories=0,titlebar=0,toolbar=0,location=0,status=0,` +
      `menubar=0,scrollbars=yes,resizable=no,` +
      `width=${screen.width},height=${screen.height - 100}`
    );
  }, []);

  const handleView = useCallback(async () => {
    // ── Product validation (selection is validated but never sent — as in source) ──
    let GroupByText = "";
    if (selectedProduct !== "") {
      GroupByText = selectedProduct;
      if (GroupByText == null || GroupByText === "") {
        setMsg({ text: "Please Select Valid Product Name !!!.", isErr: true });
        return;
      }
    }

    // ── Branch validation ────────────────────────────────────────────────
    let BranchGroupByText = "0";
    if (selectedBranch !== "") {
      BranchGroupByText = selectedBranch;
      if (BranchGroupByText == null || BranchGroupByText === "") {
        setMsg({ text: "Please Select Valid Branch Name !!!.", isErr: true });
        return;
      }
    }

    if (!fromDate || !toDate) {
      setMsg({ text: "Please select From Date and To Date.", isErr: true });
      return;
    }

    const Fromdate = toMMDDYYYY(fromDate);
    const Todate = toMMDDYYYY(toDate);

    if (new Date(Fromdate) > new Date(Todate)) {
      setMsg({ text: "From Date Is Greater Than To Date!!", isErr: true });
      return;
    }

    // ── Qty / Consdetail (bug-for-bug identical to BranchWise.js) ─────────
    let Qty = "0";
    let Consdetail = "";
    if (basis === BASIS.QTY) {
      Qty = "1";
      // Original source: `Consdetail == "QTY";` — a comparison, not an
      // assignment, so Consdetail is NOT actually set here. Preserved.
    } else {
      Consdetail = "Amount";
    }

    // ── Report type / title (identical branching to BranchWise.js) ────────
    let Reportype = "";
    let ReportTitle = "";
    if (reportType === REPORT_TYPES.ITEMWISE) {
      Reportype = "ITEMWISE";
      ReportTitle = "Branch Itemwise Sale Amount - Report";
    } else if (reportType === REPORT_TYPES.DATEWISE) {
      Reportype = "DATEWISE";
      ReportTitle = "Branch Sale Amount - Report";
    } else if (reportType === REPORT_TYPES.PRODUCTWISE) {
      Reportype = "PRODUCTWISE";
      if (Consdetail === "QTY") {
        ReportTitle = "Branch Product Wise Sale Qty - Report";
      } else {
        ReportTitle = "Branch Product Wise Sale Amount - Report";
      }
    } else if (reportType === REPORT_TYPES.STOCKTRANSFER) {
      Reportype = "StockTransfer";
      ReportTitle = "Branch Product Wise Stock Transfer Qty - Report";
    } else {
      // STOCKWISE (default/else branch in the source)
      Reportype = "STOCKWISE";
      if (Consdetail === "QTY") {
        ReportTitle = "Branch Product Wise Sale Qty - Report";
      } else {
        ReportTitle = "Branch Product Wise Sale Amount - Report";
      }
    }

    setLoading(true);
    setMsg(null);

    try {
      const MComid = session.MComid;

      // NOTE: matches source exactly — GroupByText (product) is validated
      // above but intentionally NOT included in this request body.
      const res = await CC.api(BranchWiseReportUrl, null, {React:1}, {
        Bid: BranchGroupByText,
        Fromdate,
        Todate,
        Reportype,
        Qty: "1", // hard-coded in source regardless of basis selection
        MComid,
      });

      if (res.ok || res.IsSuccess) {
        const cacheKey = res.Data15 || "";
        openReportViewer({
          ReportName: "BranchWiseReport",
          CacheKey: cacheKey,
          Qty, // the ReportViewer query string uses the real computed Qty
          Fromdate,
          Todate,
          Reportype,
          CName: session?.CName || localStorage.getItem("CompanyName") || "",
          CAddress: session?.CAddress || localStorage.getItem("Address") || "",
          CPhone: session?.CPhone || localStorage.getItem("Phone") || "",

        });
      } else {
        setMsg({ text: "No Record !!!.", isErr: true });
      }
    } catch (err) {
      setMsg({ text: err.message || "Something went wrong.", isErr: true });
    } finally {
      setLoading(false);
      // Source clears both comboboxes after every View click
      setSelectedProduct("");
      setSelectedBranch("");
    }
  }, [reportType, basis, fromDate, toDate, selectedProduct, selectedBranch, session, openReportViewer]);

  // ── Recolored to match CompanyCreation.jsx palette ────────────────────────
  //   Border / header / heading : blue  #1a56db
  //   Save accent                : green #1e7e34
  //   Cancel / link accent       : red   #dc3545
  const styles = `
    .so-shell { min-height: 100vh; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }
    .so-topbar { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 52px; box-shadow: 0 2px 8px rgba(0,0,0,.18); flex-shrink: 0; }
    .so-topbar-title { font-size: 15px; font-weight: 600; letter-spacing: .3px; }
    .so-close-btn { background: rgba(255,255,255,.15); border: none; color: #fff; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background .15s; }
    .so-close-btn:hover { background: rgba(255,255,255,.28); }

    .so-layout { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 24px; box-sizing: border-box; }
    .so-card { width: 100%; max-width: 740px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }

    .so-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .so-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .so-close-x { background: rgba(255,255,255,.15); border: none; font-size: 14px; color: #fff; cursor: pointer; line-height: 1; padding: 6px 8px; border-radius: 6px; transition: background .15s; }
    .so-close-x:hover { background: rgba(255,255,255,.28); }

    .so-card-body { padding: 24px 32px 30px; }
    .so-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .so-content { display: flex; gap: 32px; }

    .so-left { flex: 0 0 190px; display: flex; flex-direction: column; gap: 14px; }
    .so-right { flex: 1; display: flex; flex-direction: column; gap: 16px; max-width: 320px; }

    .so-radio-row { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font-size: 13px; color: #2b2b2b; font-weight: 500; }
    .so-radio-row input[type="radio"] { width: 16px; height: 16px; accent-color: #1a56db; cursor: pointer; flex-shrink: 0; }

    .so-basis-row { display: flex; gap: 22px; margin-top: 4px; padding-top: 10px; border-top: 1px solid #ececec; }

    .so-field { display: flex; align-items: center; gap: 14px; }
    .so-label { font-size: 13px; font-weight: 600; color: #1e293b; width: 96px; flex-shrink: 0; }
    .so-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .so-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    select.so-input { appearance: auto; cursor: pointer; }

    .so-actions { display: flex; gap: 12px; justify-content: center; margin-top: 32px; padding-top: 22px; border-top: 1px solid #e8ecf0; }
    .so-btn { height: 38px; padding: 0 30px; border-radius: 6px; border: 1px solid #1a56db; font-size: 14px; font-weight: 700; cursor: pointer; transition: opacity .15s, box-shadow .15s, background .15s; display: flex; align-items: center; gap: 8px; background: #fff; color: #1a56db; }
    .so-btn:disabled { opacity: .5; cursor: not-allowed; }
    .so-btn:not(:disabled):hover { background: #eef3ff; }
    .so-btn-primary { border-color: #1e7e34; color: #1e7e34; }
    .so-btn-primary .so-icon-save { color: #1e7e34; }
    .so-btn-secondary { border-color: #dc3545; color: #dc3545; }
    .so-btn-secondary .so-icon-cancel { color: #dc3545; }

    .so-msg { margin-top: 18px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; text-align: center; }
    .so-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .so-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }

    @media (max-width: 620px) {
      .so-card-body { padding: 20px; }
      .so-content { flex-direction: column; gap: 22px; }
      .so-left { flex: none; }
      .so-right { max-width: none; }
    }
  `;

  const navItems = [
    { value: REPORT_TYPES.ITEMWISE,      label: "ItemWise" },
    { value: REPORT_TYPES.DATEWISE,      label: "DateWise" },
    { value: REPORT_TYPES.PRODUCTWISE,   label: "Product Wise" },
    { value: REPORT_TYPES.STOCKWISE,     label: "Closing Stock" },
    { value: REPORT_TYPES.STOCKTRANSFER, label: "Stock Transfer" },
  ];

  return (
    <>
      <style>{styles}</style>
      <div className="so-shell">
        <Topbar/>
        <div className="so-layout">
          <div className="so-card">
            <div className="so-card-header">
              <div className="so-card-header-title">Branch Wise Report</div>
              <button type="button" className="so-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="so-card-body">
              <div className="so-report-title">Branch Wise - Report</div>

              <div className="so-content">
                {/* ── Left: report type + basis (design only, same reportType/basis state) ── */}
                <div className="so-left">
                  {navItems.map((item) => (
                    <label key={item.value} className="so-radio-row">
                      <input
                        type="radio"
                        name="so-report-type"
                        checked={reportType === item.value}
                        onChange={() => handleReportTypeChange(item.value)}
                      />
                      {item.label}
                    </label>
                  ))}

                  <div className="so-basis-row">
                    <label className="so-radio-row">
                      <input type="radio" name="so-basis" checked={basis === BASIS.QTY} onChange={() => setBasis(BASIS.QTY)} />
                      Qty
                    </label>
                    <label className="so-radio-row">
                      <input type="radio" name="so-basis" checked={basis === BASIS.AMOUNT} onChange={() => setBasis(BASIS.AMOUNT)} />
                      Amount
                    </label>
                  </div>
                </div>

                {/* ── Right: branch + dates only ── */}
                <div className="so-right">
                  <div className="so-field">
                    <label className="so-label" htmlFor="so-branch">Select Branch</label>
                    <select
                      id="so-branch"
                      className="so-input"
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                    >
                      <option value="">-- Select Branch --</option>
                      {branches.map((b, idx) => (
                        <option key={b.Comid ?? b.Id ?? idx} value={b.Comid ?? b.Id ?? b.value ?? ""}>
                          {b.CompanyName ?? b.CName ?? b.label ?? b.Comid}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="so-field">
                    <label className="so-label" htmlFor="so-from-date">From Date</label>
                    <DateFieldDDMMYYYY id="pri-from-date" value={fromDate} onChange={setFromDate} />
                  </div>

                  <div className="so-field">
                    <label className="so-label" htmlFor="so-to-date">To Date</label>
                    <DateFieldDDMMYYYY id="pri-to-date" value={toDate} onChange={setToDate} />
                  </div>
                </div>
              </div>

              <div className="so-actions">
                <button type="button" className="so-btn so-btn-primary" disabled={loading} onClick={handleView}>
                  <Save size={16} className="so-icon-save" />
                  {loading ? "Loading…" : "View"}
                </button>
                <button type="button" className="so-btn so-btn-secondary" onClick={handleRefresh} disabled={loading}>
                  <XCircle size={16} className="so-icon-cancel" />
                  Refresh
                </button>
              </div>

              {msg && <div className={`so-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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