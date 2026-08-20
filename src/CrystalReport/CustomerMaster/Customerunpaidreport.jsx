import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Save, XCircle } from "lucide-react";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";
import DateFieldDDMMYYYY from "../../Commondatetime";
import "../Reportstyles.css";

const CustomerUnpaidReportUrl = "/api/SalesReportApp/CustomerUnpaidReport";
const CustomerListUrl = "/api/SupplierApp/SelectSupplierAll";
const CACHE_KEY_TYPE = "CustomerUnpaidReport";

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

const TYPE_OPTIONS = [
  { value: "0", label: "All" },
  { value: "1", label: "With Bill" },
  { value: "2", label: "Without Bill" },
];

const BALANCE_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: "SHORTAGE", label: "Shortage" },
  { value: "EXCESS", label: "Excess" },
];

const pageStyles = `
.cu-left { flex: 0 0 240px; display: flex; flex-direction: column; gap: 16px; }
.cu-right { flex: 1; display: flex; flex-direction: column; gap: 18px; max-width: 360px; }
.cu-group { display: flex; flex-direction: column; gap: 12px; }
.cu-group-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .8px;
  color: var(--clr-text-muted);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--clr-border-table);
}
.cu-toggle-stack { display: flex; flex-direction: column; gap: 12px; }
.cu-note {
  font-size: 12px;
  color: var(--clr-text-mid);
  line-height: 1.45;
  margin-top: 4px;
}
.cu-select-btn {
  min-height: 34px;
  width: 100%;
  border: 1px solid var(--clr-border-default);
  border-radius: 4px;
  background: var(--clr-bg-white);
  color: var(--clr-text-primary);
  padding: 0 10px;
  text-align: left;
  font-size: 13px;
  cursor: pointer;
}
.cu-select-btn:focus {
  outline: none;
  border-color: var(--clr-primary);
  box-shadow: 0 0 0 3px var(--clr-focus-ring-picker);
}
.cu-select-popup {
  z-index: 1000;
  background: var(--clr-bg-white);
  border: 1px solid var(--clr-border-default);
  border-radius: 8px;
  box-shadow: 0 12px 28px var(--clr-shadow-toast);
  padding: 8px;
}
.cu-select-search {
  width: 100%;
  height: 34px;
  border: 1px solid var(--clr-border-default);
  border-radius: 4px;
  padding: 0 10px;
  font-size: 13px;
  margin-bottom: 8px;
  box-sizing: border-box;
}
.cu-select-search:focus {
  outline: none;
  border-color: var(--clr-primary);
  box-shadow: 0 0 0 3px var(--clr-focus-ring-picker);
}
.cu-select-list {
  max-height: 240px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cu-select-item {
  border: none;
  background: transparent;
  text-align: left;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--clr-text-primary);
  cursor: pointer;
}
.cu-select-item:hover { background: var(--clr-bg-row-hover); }
.cu-select-empty {
  padding: 8px 10px;
  font-size: 13px;
  color: var(--clr-text-mid);
}
@media (max-width: 620px) {
  .cu-left, .cu-right { max-width: none; flex: none; }
}
`;

function ApiSelect({ url, payload, headers = {}, labelKey, valueKey, value, onChange, placeholder }) {
  const [list, setList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [popRect, setPopRect] = useState(null);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingList(true);
      try {
        const res = await CC.api(url, null, headers, payload);
        if (!active) return;
        const raw = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.Data1)
          ? res.Data1
          : Array.isArray(res)
          ? res
          : [];
        setList(raw.filter((o) => o?.[valueKey] != null && String(o[valueKey]).trim() !== ""));
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoadingList(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [url, JSON.stringify(payload), JSON.stringify(headers), valueKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((o) => String(o?.[labelKey] ?? "").toLowerCase().includes(q));
  }, [list, query, labelKey]);

  const updatePopRect = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPopRect({ top: r.bottom + 6, left: r.left, width: r.width });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    updatePopRect();
    const onDocMouseDown = (e) => {
      const inWrap = wrapRef.current?.contains(e.target);
      const inPop = popRef.current?.contains(e.target);
      if (!inWrap && !inPop) setOpen(false);
    };
    const onWinChange = () => updatePopRect();
    document.addEventListener("mousedown", onDocMouseDown);
    window.addEventListener("resize", onWinChange);
    window.addEventListener("scroll", onWinChange, true);
    setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      window.removeEventListener("resize", onWinChange);
      window.removeEventListener("scroll", onWinChange, true);
    };
  }, [open, updatePopRect]);

  const choose = (item) => {
    onChange({ value: item[valueKey], label: item[labelKey], raw: item });
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="so-field">
      <label className="so-label">{placeholder}</label>
      <div className="so-combo" style={{ width: "100%" }}>
        <button
          ref={btnRef}
          type="button"
          className="cu-select-btn"
          onClick={() => setOpen((s) => !s)}
        >
          {value?.label || `Select ${placeholder}`}
        </button>
        {open &&
          popRect &&
          createPortal(
            <div
              ref={popRef}
              className="cu-select-popup"
              style={{ position: "fixed", top: popRect.top, left: popRect.left, width: popRect.width }}
            >
              <input
                ref={searchRef}
                className="cu-select-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${placeholder}`}
              />
              <div className="cu-select-list">
                <button type="button" className="cu-select-item" onClick={() => { onChange(null); setOpen(false); setQuery(""); }}>
                  All {placeholder}
                </button>
                {loadingList ? (
                  <div className="cu-select-empty">Loading...</div>
                ) : filtered.length > 0 ? (
                  filtered.map((item) => (
                    <button
                      key={`${item[valueKey]}`}
                      type="button"
                      className="cu-select-item"
                      onClick={() => choose(item)}
                    >
                      {item[labelKey]}
                    </button>
                  ))
                ) : (
                  <div className="cu-select-empty">No results</div>
                )}
              </div>
            </div>,
            document.body
          )}
      </div>
    </div>
  );
}

export default function CustomerUnpaidReport() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "CustomerUnpaidReport-Kassapos";
  }, []);
  const [pageAccess, setPageAccess] = useState({ ready: false, allowed: false, pageview: 0 });
  const [session, setSession] = useState({ Comid: "", MComid: "", CName: "", CAddress: "", CPhone: "", lookupComid: "" });
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [customerSel, setCustomerSel] = useState(null);
  const [billType, setBillType] = useState("0");
  const [balanceType, setBalanceType] = useState("ALL");
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [nrnOnly, setNrnOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    const menulist = CC.getLocal("menulist");
    if (menulist == null) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/Login/Index");
      return;
    }

    const menudata = menulist.filter((obj) =>
      ["Customer Daily-Statement", "Customer Unpaid Report", "Customer Statement"].includes(obj.PageName)
    );
    if (!menudata || menudata.length === 0 || menudata[0].View === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      setTimeout(() => navigate("/dashboard"), 3000);
      return;
    }

    const Comid = CC.getStr("Comid");
    const MComid = CC.getStr("MComid");
    const ComSet = CC.getLocal("Companysetting") || [{}];
    const MainSet = CC.getLocal("Mainsetting") || [{}];
    const main0 = MainSet[0] || {};
    const useCommonCompany =
      main0.SupplierCommonCompany === true ||
      main0.SupplierCommonCompany === 1 ||
      main0.SupplierCommonCompany === "1" ||
      localStorage.getItem("SupplierCommon") === "true" ||
      localStorage.getItem("SupplierCommon") === "1";

    setSession({
      Comid,
      MComid,
      lookupComid: Comid || MComid || "0",
      CName: ComSet[0]?.CName || "",
      CAddress: ComSet[0]?.CAddress || "",
      CPhone: ComSet[0]?.CPhone || "",
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.keyCode === 27) {
        e.preventDefault();
        navigate("/dashboard");
      }
      if (e.ctrlKey && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        document.getElementById("cu-view-btn")?.click();
      }
      if (e.ctrlKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        document.getElementById("cu-refresh-btn")?.click();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  const handleRefresh = useCallback(() => {
    setFromDate(todayStr());
    setToDate(todayStr());
    setCustomerSel(null);
    setBillType("0");
    setBalanceType("ALL");
    setUnpaidOnly(false);
    setNrnOnly(false);
    setMsg(null);
  }, []);

  const openReportViewer = useCallback((params) => {
    const qs = new URLSearchParams(params).toString();
    const url = `${CC.BASE_URL}/Reports/ReportViewer.aspx?${qs}`;
    const w = window.open(
      url,
      "_blank",
      `directories=0,titlebar=0,toolbar=0,location=0,status=0,menubar=0,scrollbars=yes,resizable=no,width=${screen.width},height=${screen.height - 100}`
    );
    if (w) {
      w.addEventListener("load", () => {
        w.document.title = "Customer Daily-Statement-Report";
      }, false);
    }
    return w;
  }, []);

  const handleView = useCallback(async () => {
    const startdate = new Date(fromDate);
    const enddate = new Date(toDate);
    if (startdate > enddate) {
      setMsg({ text: "From Date Is Greater Than To Date!!", isErr: true });
      return;
    }

    const GroupBy = customerSel?.value ? String(customerSel.value) : "";
    const Fromdate = toMMDDYYYY(fromDate);
    const Todate = toMMDDYYYY(toDate);
    const shortage = balanceType === "SHORTAGE" ? 1 : 0;
    const excess = balanceType === "EXCESS" ? 1 : 0;

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(
        CustomerUnpaidReportUrl,
        null,
        {
          CacheKeyType: CACHE_KEY_TYPE,
          React: 1,
          Unpaid: unpaidOnly ? 1 : 0,
          Shortage: shortage,
          Excess: excess,
          NRN: nrnOnly ? 1 : 0,
        },
        {
          Fromdate,
          Todate,
          Comid: session.Comid,
          MComid: session.MComid,
          GroupBy,
          Cashid: 0,
          Type: billType,
          Unpaid: unpaidOnly ? 1 : 0,
          Shortage: shortage,
          Excess: excess,
          NRN: nrnOnly ? 1 : 0,
        }
      );

      if (res?.ok || res?.IsSuccess) {
        const cacheKey = res.Data15 || res.CacheKey || res.data?.Data15 || "";
        openReportViewer({
          ReportName: "CustomerDailyStatement",
          CacheKey: cacheKey,
          Fromdate,
          Todate,
          GroupBy,
          Type: billType,
          Unpaid: unpaidOnly ? 1 : 0,
          Shortage: shortage,
          Excess: excess,
          NRN: nrnOnly ? 1 : 0,
          ReportTitle: "Customer Daily-Statement",
          CName: session?.CName || localStorage.getItem("CompanyName") || "",
          CAddress: session?.CAddress || localStorage.getItem("Address") || "",
          CPhone: session?.CPhone || localStorage.getItem("Phone") || "",
        });
      } else {
        setMsg({ text: res?.Message || res?.message || "No Record !!!.", isErr: true });
      }
    } catch (err) {
      setMsg({ text: err.message || "Something went wrong.", isErr: true });
    } finally {
      setLoading(false);
      setCustomerSel(null);
    }
  }, [balanceType, billType, customerSel, fromDate, openReportViewer, nrnOnly, session, toDate, unpaidOnly]);

  if (!pageAccess.ready) {
    return (
      <div className="so-shell">
        <Topbar />
        <div className="so-wrap">
          <div className="so-card">
            <div className="so-card-body">
              <div className="so-msg ok">Loading...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!pageAccess.allowed) {
    return (
      <div className="so-shell">
        <Topbar />
        <div className="so-wrap">
          <div className="so-card">
            <div className="so-card-body">
              <div className="so-msg err">Page Access Permission Denied !!!.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{pageStyles}</style>
      <div className="so-shell">
        <Topbar />
        <div className="so-layout">
          <div className="so-card">
            <div className="so-card-header">
              <div className="so-card-header-title">Customer Daily-Statement</div>
              <button type="button" className="so-close-x" onClick={() => navigate("/dashboard")}>X</button>
            </div>

            <div className="so-card-body">
              <h1 className="so-report-title">Customer Daily-Statement</h1>

              <div className="so-content">
                <div className="cu-left">
                  <div className="cu-group">
                    <div className="cu-group-title">Bill Filter</div>
                    {TYPE_OPTIONS.map((item) => (
                      <label key={item.value} className="so-radio-row">
                        <input
                          type="radio"
                          name="cu-bill-type"
                          checked={billType === item.value}
                          onChange={() => setBillType(item.value)}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>

                  <div className="cu-group">
                    <div className="cu-group-title">Balance Filter</div>
                    {BALANCE_OPTIONS.map((item) => (
                      <label key={item.value} className="so-radio-row">
                        <input
                          type="radio"
                          name="cu-balance-type"
                          checked={balanceType === item.value}
                          onChange={() => setBalanceType(item.value)}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>

                  <div className="cu-group">
                    <div className="cu-group-title">Extra Options</div>
                    <div className="cu-toggle-stack">
                      <label className="so-checkbox">
                        <input type="checkbox" checked={unpaidOnly} onChange={(e) => setUnpaidOnly(e.target.checked)} />
                        <span className="so-checkbox-box">
                          <svg viewBox="0 0 16 16" fill="none">
                            <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        <span>Unpaid Report</span>
                      </label>

                      <label className="so-checkbox">
                        <input type="checkbox" checked={nrnOnly} onChange={(e) => setNrnOnly(e.target.checked)} />
                        <span className="so-checkbox-box">
                          <svg viewBox="0 0 16 16" fill="none">
                            <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        <span>Only Open Balance / Sale</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="cu-right">
                  <ApiSelect
                    url={CustomerListUrl}
                    payload={{
                      Comid: session.lookupComid || session.Comid,
                      AccountType: "CUSTOMER",
                      Startindex: -1,
                      PageCount: 99999,
                      Keyword: "",
                      Column: "",
                    }}
                    labelKey="AccountName"
                    valueKey="Id"
                    value={customerSel}
                    onChange={setCustomerSel}
                    placeholder="Customer Name"
                  />

                  <div className="so-field">
                    <label className="so-label">From Date</label>
                    <DateFieldDDMMYYYY value={fromDate} onChange={setFromDate} />
                  </div>

                  <div className="so-field">
                    <label className="so-label">To Date</label>
                    <DateFieldDDMMYYYY value={toDate} onChange={setToDate} />
                  </div>

                  <div className="cu-note">
                    Customer selection is optional. Leave it empty to run for all customers.
                  </div>
                </div>
              </div>

              <div className="so-actions">
                <button
                  id="cu-view-btn"
                  type="button"
                  className="mp-btn nw"
                  disabled={loading || pageAccess.pageview === 0}
                  onClick={handleView}
                >
                  <Save size={16} className="so-icon-save" />
                  {loading ? "Loading..." : "View"}
                </button>
                <button
                  id="cu-refresh-btn"
                  type="button"
                  className="mp-btn dl"
                  disabled={loading}
                  onClick={handleRefresh}
                >
                  <XCircle size={16} className="so-icon-cancel" />
                  Refresh
                </button>
              </div>

              {msg && <div className={`so-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
