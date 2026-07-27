import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RotateCcw, Save, XCircle } from "lucide-react";
import Topbar from "../../components/Topbar";
import * as CC from "../../components/Common";
import DateFieldDDMMYYYY from "../../Commondatetime";
import "../Reportstyles.css";

const MODES = {
  SALE_AMOUNT: "sale_amount",
  SALE_BILL_WISE: "sale_bill_wise",
  SALE_ITEM_WISE: "sale_item_wise",
  SALE_CUSTOMER_WISE: "sale_customer_wise",
  CUSTOMER_TRIAL_BALANCE: "customer_trial_balance",
};

const BILL_TYPES = {
  ALL: "ALL",
  CASH: "CASH",
  CREDIT: "CREDIT",
};

const MENU_NAMES = [
  "All Sale Report",
  "Purchase Sale Lot Details",
  "Purchase Sale Lot No",
  "Purchase Sale Lot Report",
];

const SaleAmountReportUrl = "/api/SalesReportApp/SalesAmountReport";
const CustomerLotDetailReportUrl = "/api/SalesReportApp/CustomerLotDetailReport";
const SaleBillConsolidateReportUrl = "/api/SalesReportApp/SaleBillConsolidateReport";
const CustomerBalanceReportUrl = "/api/SalesReportApp/CustomerBalanceReport";
const CustomerLotReportUrl = "/api/SalesReportApp/CustomerLotReport";

const REPORT_META = {
  [MODES.SALE_AMOUNT]: {
    title: "Sale Amount Report",
    reportName: "LotSalesAmountReport",
    cacheKeyType: "SaleAmountReport",
  },
  [MODES.SALE_BILL_WISE]: {
    title: "Sale Bill Wise",
    reportName: "SaleBillWise",
    cacheKeyType: "SaleBillConsolidateReport",
  },
  [MODES.SALE_ITEM_WISE]: {
    title: "Sale Item Wise",
    reportName: "PurchaseSaleLotDetails",
    cacheKeyType: "CustomerLotDetailReport",
  },
  [MODES.SALE_CUSTOMER_WISE]: {
    title: "Sale Customer Wise",
    reportName: "CustomerLotDetails",
    cacheKeyType: "CustomerLotReport",
  },
  [MODES.CUSTOMER_TRIAL_BALANCE]: {
    title: "Customer Trial Balance",
    reportName: "CustomerBalanceReport",
    cacheKeyType: "CustomerBalanceReport",
  },
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

const normalizeOptions = (rawList, labelKeys, valueKeys) =>
  (Array.isArray(rawList) ? rawList : []).map((item) => {
    let label = "";
    let value = "";

    for (const key of labelKeys) {
      if (item[key] != null && item[key] !== "") {
        label = item[key];
        break;
      }
    }

    for (const key of valueKeys) {
      if (item[key] != null && item[key] !== "") {
        value = item[key];
        break;
      }
    }

    return { label: String(label), value: String(value), raw: item };
  });

function SearchCombo({ id, list, selected, onSelect, placeholder, disabled }) {
  const [search, setSearch] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const filtered = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return list || [];
    return (list || []).filter((o) => String(o.label || "").toLowerCase().includes(q));
  }, [list, search]);

  return (
    <div className="so-combo" ref={wrapRef}>
      <input
        id={id}
        type="text"
        className="so-input"
        value={search}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => !disabled && setOpen(true)}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
          if (selected) onSelect(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
          } else if (e.key === "Enter" && filtered.length === 1) {
            e.preventDefault();
            onSelect(filtered[0]);
            setOpen(false);
          }
        }}
      />

      {open && !disabled && (
        <ul className="so-combo-list">
          {filtered.length === 0 ? (
            <li className="so-combo-empty">No matching records</li>
          ) : (
            filtered.map((item, idx) => (
              <li
                key={`${item.value}-${idx}`}
                className="so-combo-item"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(item);
                  setOpen(false);
                }}
              >
                {item.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default function PurchaseSaleLotDetails() {
  const navigate = useNavigate();

  const [session, setSession] = useState({
    Comid: "",
    MComid: "",
    comboComid: "",
    CName: "",
    CAddress: "",
    CPhone: "",
  });

  const [mode, setMode] = useState(MODES.SALE_AMOUNT);
  const [billType, setBillType] = useState(BILL_TYPES.ALL);
  const [daily, setDaily] = useState(false);
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());

  const [customerList, setCustomerList] = useState([]);
  const [supplierList, setSupplierList] = useState([]);
  const [itemList, setItemList] = useState([]);
  const [saleTypeList, setSaleTypeList] = useState([]);

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const modeConfig = useMemo(() => {
    switch (mode) {
      case MODES.SALE_BILL_WISE:
        return {
          customerEnabled: true,
          supplierEnabled: false,
          itemEnabled: false,
          toDateEnabled: true,
          showBillType: true,
          showDaily: true,
        };
      case MODES.SALE_ITEM_WISE:
        return {
          customerEnabled: false,
          supplierEnabled: true,
          itemEnabled: true,
          toDateEnabled: true,
          showBillType: false,
          showDaily: false,
        };
      case MODES.SALE_CUSTOMER_WISE:
        return {
          customerEnabled: true,
          supplierEnabled: false,
          itemEnabled: true,
          toDateEnabled: true,
          showBillType: false,
          showDaily: false,
        };
      case MODES.CUSTOMER_TRIAL_BALANCE:
        return {
          customerEnabled: true,
          supplierEnabled: false,
          itemEnabled: false,
          toDateEnabled: false,
          showBillType: false,
          showDaily: false,
        };
      case MODES.SALE_AMOUNT:
      default:
        return {
          customerEnabled: false,
          supplierEnabled: false,
          itemEnabled: false,
          toDateEnabled: true,
          showBillType: false,
          showDaily: false,
        };
    }
  }, [mode]);

  useEffect(() => {
    const hasSession = !!CC.getLocal("menulist");
    if (!hasSession) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/Login/Index");
      return;
    }

    let Comid = CC.getStr("Comid");
    let MComid = CC.getStr("MComid") || Comid;
    const MainSet = CC.getLocal("Mainsetting") || [{}];
    const ComSet = CC.getLocal("Companysetting") || [{}];
    const useCommonCompany = !!MainSet[0]?.SupplierCommonCompany;
    const comboComid = useCommonCompany ? MComid : Comid;

    setSession({
      Comid,
      MComid,
      comboComid,
      CName: ComSet[0]?.CName || localStorage.getItem("CompanyName") || "",
      CAddress: ComSet[0]?.CAddress || localStorage.getItem("Address") || "",
      CPhone: ComSet[0]?.CPhone || localStorage.getItem("Phone") || "",
    });
  }, [navigate]);

  useEffect(() => {
    if (!session.Comid) return;

    let cancelled = false;
    (async () => {
      try {
        const [customerRes, supplierRes, itemRes, saleTypeRes] = await Promise.all([
          CC.api(CC.GetSupplierAll, null, {}, { Comid: session.comboComid, AccountType: "CUSTOMER" }),
          CC.api(CC.GetSupplierAll, null, {}, { Comid: session.comboComid, AccountType: "SUPPLIER" }),
          CC.api(CC.GetProductListV7, null, {}, { Comid: session.MComid || session.Comid }),
          CC.api(CC.SelectSaleType, null, {}, { Comid: session.Comid }),
        ]);

        if (cancelled) return;

        setCustomerList(
          normalizeOptions(
            customerRes?.Data || customerRes?.data || customerRes?.Data1 || [],
            ["AccountName", "CustomerName", "Name", "Text"],
            ["Id", "CustomerId", "value", "Value"]
          )
        );

        setSupplierList(
          normalizeOptions(
            supplierRes?.Data || supplierRes?.data || supplierRes?.Data1 || [],
            ["AccountName", "SupplierName", "Name", "Text"],
            ["Id", "SupplierId", "value", "Value"]
          )
        );

        setItemList(
          normalizeOptions(
            itemRes?.Data || itemRes?.data || itemRes?.Data1 || [],
            ["PName", "PrintName", "Description", "Name", "Text"],
            ["Id", "ProductId", "value", "Value"]
          )
        );

        setSaleTypeList(saleTypeRes?.Data || saleTypeRes?.data || saleTypeRes?.Data1 || []);
      } catch (err) {
        if (!cancelled) {
          setMsg({ text: err.message || "Failed to load filter data.", isErr: true });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session.Comid, session.MComid, session.comboComid]);

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

  const openReportViewer = useCallback((reportName, params, title) => {
    const qs = new URLSearchParams({ ReportName: reportName, ...params }).toString();
    const url = `${CC.BASE_URL}/Reports/ReportViewer.aspx?${qs}`;
    const w = window.open(
      url,
      "_blank",
      `directories=0,titlebar=0,toolbar=0,location=0,status=0,` +
        `menubar=0,scrollbars=yes,resizable=no,` +
        `width=${screen.width},height=${screen.height - 100}`
    );
    if (w && title) {
      w.addEventListener("load", () => {
        w.document.title = title;
      }, false);
    }
  }, []);

  const resolveSaleTypeGroupByText = useCallback((targetType) => {
    const found = saleTypeList.find((item) => {
      const name = String(item.Saletype ?? item.SaleType ?? item.Name ?? "").toUpperCase();
      return name === targetType;
    });
    return String(found?.CardAccountRefId ?? found?.Id ?? targetType);
  }, [saleTypeList]);

  const handleRefresh = useCallback(() => {
    setMode(MODES.SALE_AMOUNT);
    setBillType(BILL_TYPES.ALL);
    setDaily(false);
    setFromDate(todayStr());
    setToDate(todayStr());
    setSelectedCustomer(null);
    setSelectedSupplier(null);
    setSelectedItem(null);
    setMsg(null);
  }, []);

  const handleView = useCallback(async () => {
    const from = toMMDDYYYY(fromDate);
    const to = toMMDDYYYY(modeConfig.toDateEnabled ? toDate : fromDate);

    if (new Date(from) > new Date(to)) {
      setMsg({ text: "From Date Is Greater Than To Date", isErr: true });
      return;
    }

    const meta = REPORT_META[mode];
    const customerId = Number(selectedCustomer?.value || 0);
    const supplierId = Number(selectedSupplier?.value || 0);
    const productId = Number(selectedItem?.value || 0);

    setLoading(true);
    setMsg(null);

    try {
      let res;
      let reportParams = {
        Fromdate: from,
        Todate: to,
        CName: session.CName,
        CAddress: session.CAddress,
        CPhone: session.CPhone,
      };

      if (mode === MODES.SALE_AMOUNT) {
        res = await CC.api(
          SaleAmountReportUrl,
          null,
          { CacheKeyType: meta.cacheKeyType, React: 1 },
          { Daily: "", GroupBy: "", GroupByText: "", Fromdate: from, Todate: to, Comid: session.Comid }
        );
      } else if (mode === MODES.SALE_BILL_WISE) {
        let groupBy = "";
        let groupByText = "";
        if (billType === BILL_TYPES.CASH) {
          groupBy = "SaleType";
          groupByText = resolveSaleTypeGroupByText("CASH");
        } else if (billType === BILL_TYPES.CREDIT) {
          groupBy = "SaleType";
          groupByText = resolveSaleTypeGroupByText("CREDIT");
        }

        const reportType = daily ? "D" : "";
        res = await CC.api(
          SaleBillConsolidateReportUrl,
          null,
          { CacheKeyType: meta.cacheKeyType, React: 1 },
          {
            GroupByName: "",
            GroupBy: groupBy,
            GroupByText: groupByText,
            Fromdate: from,
            Todate: to,
            Comid: session.Comid,
            ReportType: reportType,
            txtBillnoFrm: "",
            txtBillnoTo: "",
          }
        );
        reportParams = { ...reportParams, GroupBy: groupBy, GroupByText: groupByText, ReportType: reportType };
      } else if (mode === MODES.SALE_ITEM_WISE) {
        res = await CC.api(
          CustomerLotDetailReportUrl,
          null,
          { CacheKeyType: meta.cacheKeyType, React: 1 },
          {
            Cid: 0,
            Pid: productId,
            Sid: 0,
            Fromdate: from,
            Todate: to,
            Comid: session.Comid,
          }
        );
        reportParams = { ...reportParams, Cid: 0, Pid: productId, Sid: 0, SupplierId: supplierId };
      } else if (mode === MODES.SALE_CUSTOMER_WISE) {
        res = await CC.api(
          CustomerLotReportUrl,
          null,
          { CacheKeyType: meta.cacheKeyType, React: 1 },
          {
            Cid: customerId,
            Pid: productId,
            Fromdate: from,
            Todate: to,
            Comid: session.Comid,
          }
        );
        reportParams = { ...reportParams, Cid: customerId, Pid: productId };
      } else {
        res = await CC.api(
          CustomerBalanceReportUrl,
          null,
          { TrialBalance: 1, CacheKeyType: meta.cacheKeyType, React: 1 },
          {
            Fromdate: from,
            GroupByNew: "",
            GroupBy: customerId ? String(customerId) : "",
            Comid: session.Comid,
            MComid: session.MComid || session.Comid,
          }
        );
        reportParams = { ...reportParams, GroupBy: customerId ? String(customerId) : "" };
      }

      if (res?.ok || res?.IsSuccess) {
        const cacheKey = res.Data15 || res.data15 || res.data?.Data15 || res.CacheKey || "";
        openReportViewer(meta.reportName, { ...reportParams, CacheKey: cacheKey }, `${meta.title}-Report`);
      } else {
        setMsg({ text: res?.message || res?.Message || "No Record !!!.", isErr: true });
      }
    } catch (err) {
      setMsg({ text: err.message || "Something went wrong.", isErr: true });
    } finally {
      setLoading(false);
      setSelectedCustomer(null);
      setSelectedItem(null);
    }
  }, [
    billType,
    fromDate,
    mode,
    modeConfig.toDateEnabled,
    openReportViewer,
    resolveSaleTypeGroupByText,
    selectedCustomer,
    selectedItem,
    selectedSupplier,
    session.CAddress,
    session.CName,
    session.CPhone,
    session.Comid,
    session.MComid,
    toDate,
    daily,
  ]);

  if (!session.Comid) {
    return <div className="mp-wrap"><div className="mp-body">{msg && <div className={`mp-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}</div></div>;
  }

  return (
    <>
      <style>{`
        .psld-basis-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          align-items: flex-start;
        }
        .psld-basis-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-weight: 700;
          color: #1f2937;
          line-height: 1.35;
          width: 100%;
        }
        .psld-basis-item input[type="radio"] {
          margin-top: 3px;
          flex: 0 0 auto;
        }
        .psld-basis-item span {
          display: block;
        }
      `}</style>
      <div className="so-shell">
        <Topbar />
        <div className="so-layout">
          <div className="so-card">
            <div className="so-card-header">
              <div className="so-card-header-title">Purchase / Sale Lot Details</div>
              <button type="button" className="so-close-x" onClick={() => navigate(-1)} aria-label="Close">x</button>
            </div>

            <div className="so-card-body">
              <div className="so-report-title">Purchase / Sale Lot Details - Report</div>

              <div className="so-content">
                <div className="so-left">
                  <div className="so-basis-row">
                    <div className="so-basis-title">Type Of Report</div>
                  </div>
                  <div className="psld-basis-list">
                      {Object.entries(REPORT_META).map(([value, meta]) => (
                        <label key={value} className="psld-basis-item">
                          <input
                            type="radio"
                            name="report_mode"
                            checked={mode === value}
                            onChange={() => setMode(value)}
                          />
                          <span>{meta.title}</span>
                        </label>
                      ))}
                  </div>

                  {modeConfig.showBillType && (
                    <>
                      <div className="so-basis-row" style={{ marginTop: 14 }}>
                        <div className="so-basis-title">Bill Type</div>
                      </div>
                      <div className="psld-basis-list">
                        {Object.values(BILL_TYPES).map((value) => (
                          <label key={value} className="psld-basis-item">
                            <input
                              type="radio"
                              name="bill_type"
                              checked={billType === value}
                              onChange={() => setBillType(value)}
                            />
                            <span>{value}</span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}

                  <div className="so-basis-row" style={{ marginTop: 14 }}>
                    <label className="so-checkbox">
                      <input
                        type="checkbox"
                        checked={daily}
                        disabled={!modeConfig.showDaily}
                        onChange={(e) => setDaily(e.target.checked)}
                      />
                      <span className="so-checkbox-box">
                        <svg viewBox="0 0 24 24" fill="none" stroke="var(--clr-text-white)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                      Daily
                    </label>
                  </div>
                </div>

                <div className="so-right">
                  <div className="so-field">
                    <label className="so-label" htmlFor="psl-customer">Customer Name</label>
                    <SearchCombo
                      key={`customer-${selectedCustomer?.value ?? "none"}`}
                      id="psl-customer"
                      list={customerList}
                      selected={selectedCustomer}
                      onSelect={setSelectedCustomer}
                      placeholder="Type to search customer..."
                      disabled={!modeConfig.customerEnabled}
                    />
                  </div>

                  <div className="so-field">
                    <label className="so-label" htmlFor="psl-supplier">Supplier Name</label>
                    <SearchCombo
                      key={`supplier-${selectedSupplier?.value ?? "none"}`}
                      id="psl-supplier"
                      list={supplierList}
                      selected={selectedSupplier}
                      onSelect={setSelectedSupplier}
                      placeholder="Type to search supplier..."
                      disabled={!modeConfig.supplierEnabled}
                    />
                  </div>

                  <div className="so-field">
                    <label className="so-label" htmlFor="psl-item">Item Name</label>
                    <SearchCombo
                      key={`item-${selectedItem?.value ?? "none"}`}
                      id="psl-item"
                      list={itemList}
                      selected={selectedItem}
                      onSelect={setSelectedItem}
                      placeholder="Type to search item..."
                      disabled={!modeConfig.itemEnabled}
                    />
                  </div>

                  <div className="so-field">
                    <label className="so-label" htmlFor="psl-from-date">From Date</label>
                    <DateFieldDDMMYYYY id="psl-from-date" value={fromDate} onChange={setFromDate} disabled={false} />
                  </div>

                  <div className="so-field">
                    <label className="so-label" htmlFor="psl-to-date">To Date</label>
                    <DateFieldDDMMYYYY
                      id="psl-to-date"
                      value={modeConfig.toDateEnabled ? toDate : fromDate}
                      onChange={modeConfig.toDateEnabled ? setToDate : setFromDate}
                      disabled={!modeConfig.toDateEnabled}
                    />
                  </div>
                </div>
              </div>

              <div className="so-actions">
                <button
                  type="button"
                  className="so-btn so-btn-primary"
                  onClick={handleView}
                  disabled={loading}
                >
                  <Save size={16} className="so-icon-save" />
                  {loading ? "Loading..." : "View"}
                </button>
                <button type="button" className="so-btn so-btn-secondary" onClick={handleRefresh} disabled={loading}>
                  <RotateCcw size={16} className="so-icon-cancel" />
                  Refresh
                </button>
                <button type="button" className="so-btn so-btn-secondary" onClick={() => navigate(-1)} disabled={loading}>
                  <XCircle size={16} className="so-icon-cancel" />
                  Close
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
