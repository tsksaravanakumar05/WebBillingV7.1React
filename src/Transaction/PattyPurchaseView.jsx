import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar";
import * as CC from "../components/Common";
import "../Master/MasterPage.css";
import "../TransactionStyle/PattyPurchaseView.css";

const today = () => new Date().toISOString().split("T")[0];
const asDate = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value.split("T")[0];
  try { return new Date(value).toISOString().split("T")[0]; } catch { return ""; }
};

export default function PattyPurchaseView() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [customerId, setCustomerId] = useState("0");
  const [salesmanId, setSalesmanId] = useState("0");
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());
  const [pendingAll, setPendingAll] = useState(false);
  const [pattyBill, setPattyBill] = useState(false);
  const [salesPatty, setSalesPatty] = useState(false);
  const [selectedIds, setSelectedIds] = useState({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [highlightId, setHighlightId] = useState(null);
  const gridWrapRef = useRef(null);

  const [sess] = useState(() => {
    const main0 = (CC.getLocal("Mainsetting") || [{}])[0] || {};
    const com0 = (CC.getLocal("Companysetting") || [{}])[0] || {};
    const Comid = CC.getStr("Comid") || "1";
    const MComid = CC.getStr("MComid") || Comid;
    return {
      Comid,
      MComid,
      Tamil: !!main0.ProductNameTamil,
      CompanyName: com0.Companyname || "",
    };
  });

  const allSelected = rows.length > 0 && rows.every(r => selectedIds[String(r.Id)] === true);

  const mode = useMemo(() => {
    if (salesPatty) return "SALESPATTY";
    if (pattyBill) return "PATTY";
    return "ARRIVAL";
  }, [pattyBill, salesPatty]);

  const loadDropdowns = useCallback(async () => {
    const [custRes, smRes] = await Promise.all([
      CC.api(CC.SO_GetCustomerUrl, null, {}, { Comid: sess.MComid, AccountType: "CUSTOMER" }),
      CC.api(CC.SO_SalesManSelectUrl, null, {}, { Comid: sess.MComid }),
    ]);

    const pick = (res) => res?.data || res?.Data1 || [];
    setCustomers(Array.isArray(pick(custRes)) ? pick(custRes) : []);
    setSalesmen(Array.isArray(pick(smRes)) ? pick(smRes) : []);
  }, [sess]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const pattyStatus = salesPatty || pattyBill ? 2 : 1;
      const response = await CC.api(CC.selectArrival, null, {}, {
        Comid: sess.Comid,
        pending: pendingAll ? 1 : 0,
        Fromdate: fromDate,
        Todate: toDate,
        PattyStatus: pattyStatus,
        salesPatty: salesPatty ? 1 : 0,
        Id: Number(customerId || 0),
        smid: Number(salesmanId || 0),
      });

      const nextRows = Array.isArray(response?.data) ? response.data : Array.isArray(response?.Data1) ? response.Data1 : [];
      setRows(nextRows);
      setSelectedIds(prev => {
        const next = {};
        nextRows.forEach(row => { next[String(row.Id)] = prev[String(row.Id)] ?? false; });
        return next;
      });
      if (nextRows.length > 0) setHighlightId(String(nextRows[nextRows.length - 1].Id));
    } catch (error) {
      console.error(error);
      setErr("Unable to load patty purchase data.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [sess, pendingAll, fromDate, toDate, salesPatty, pattyBill, customerId, salesmanId]);

  useEffect(() => { loadDropdowns(); }, [loadDropdowns]);
  useEffect(() => { loadRows(); }, [loadRows]);

  const toggleSelectAll = useCallback((checked) => {
    const next = {};
    rows.forEach(row => { next[String(row.Id)] = checked; });
    setSelectedIds(next);
  }, [rows]);

  const toggleSelected = useCallback((id) => {
    setSelectedIds(prev => ({ ...prev, [String(id)]: !prev[String(id)] }));
  }, []);

  const openRow = useCallback((row) => {
    if (!row?.Id) return;
    navigate("/Purchase", {
      state: {
        pattyPurchaseOpen: {
          id: Number(row.Id),
          pno: Number(row.ArrivalNo || 0),
          mode,
          requestKey: `${row.Id}_${mode}_${Date.now()}`,
        },
      },
    });
  }, [navigate, mode]);

  const handleGridKeyDown = useCallback((e) => {
    if (rows.length === 0) return;
    const idx = rows.findIndex(r => String(r.Id) === String(highlightId));
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = rows[Math.min(idx + 1, rows.length - 1)] || rows[0];
      setHighlightId(String(next.Id));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = rows[Math.max(idx - 1, 0)] || rows[0];
      setHighlightId(String(next.Id));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const current = rows[idx >= 0 ? idx : 0];
      openRow(current);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      navigate(-1);
    }
  }, [rows, highlightId, openRow, navigate]);

  return (
    <div className="bm-shell">
      <Topbar />

      <div className="bm-layout">
        <div className="bm-card ppv-card">
          <div className="bm-card-header">
            <div className="bm-card-header-title">Patty Purchase View</div>
            <button type="button" className="bm-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
          </div>

          <div className="bm-card-body">
            <div className="bm-report-title">Patty Purchase View</div>

            <div className="ppv-subtitle">{sess.CompanyName || "Transaction"}</div>

            <div className="ppv-filter-grid">
              <div className="ppv-field">
                <label>From Date</label>
                <input type="date" className="bm-cell-input" value={fromDate} onChange={e => setFromDate(e.target.value)} disabled={pendingAll} />
              </div>

              <div className="ppv-field">
                <label>To Date</label>
                <input type="date" className="bm-cell-input" value={toDate} onChange={e => setToDate(e.target.value)} disabled={pendingAll} />
              </div>

              <div className="ppv-field ppv-field-wide">
                <label>Customer Name</label>
                <select className="bm-cell-input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                  <option value="0">All Customers</option>
                  {customers.map(c => (
                    <option key={c.Id} value={String(c.Id)}>{c.AccountName || c.SupplierName || c.CustomerName}</option>
                  ))}
                </select>
              </div>

              <div className="ppv-field ppv-field-wide">
                <label>SalesMan</label>
                <select className="bm-cell-input" value={salesmanId} onChange={e => setSalesmanId(e.target.value)}>
                  <option value="0">All SalesMan</option>
                  {salesmen.map(s => (
                    <option key={s.Id} value={String(s.Id)}>{s.SalesManName || s.Name || s.SupplierName}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="ppv-check-row">
              <label className="ppv-check"><input type="checkbox" checked={salesPatty} onChange={e => setSalesPatty(e.target.checked)} /> Sales Patty</label>
              <label className="ppv-check"><input type="checkbox" checked={pattyBill} onChange={e => setPattyBill(e.target.checked)} /> Patty Bill</label>
              <label className="ppv-check"><input type="checkbox" checked={pendingAll} onChange={e => setPendingAll(e.target.checked)} /> Pending All</label>
              <label className="ppv-check"><input type="checkbox" checked={allSelected} onChange={e => toggleSelectAll(e.target.checked)} /> Select All</label>
            </div>

            <div className="ppv-hints">
              <span>Enter open selected row</span>
              <span>Arrow Up/Down move row</span>
              <span>Esc close</span>
            </div>

            {err && <div className="ppv-error">{err}</div>}

            <div
              ref={gridWrapRef}
              className="bm-grid-wrap ppv-grid-wrap"
              tabIndex={0}
              onKeyDown={handleGridKeyDown}
            >
              <table className="bm-tbl ppv-grid">
                <thead>
                  <tr>
                    {(pattyBill || salesPatty) && <th style={{ width: 56 }}>Select</th>}
                    <th>{pattyBill ? "Patty No" : "Arrival No"}</th>
                    <th>{pattyBill ? "Patty Date" : "Arrival Date"}</th>
                    <th>Supplier Name</th>
                    <th style={{ width: 120, textAlign: "right" }}>Amount</th>
                    <th style={{ width: 110, textAlign: "center" }}>Open</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={(pattyBill || salesPatty) ? 6 : 5} className="bm-empty">Loading...</td></tr>
                  )}
                  {!loading && rows.length === 0 && (
                    <tr><td colSpan={(pattyBill || salesPatty) ? 6 : 5} className="bm-empty">No records found.</td></tr>
                  )}
                  {!loading && rows.map((row, index) => {
                    const active = String(row.Id) === String(highlightId);
                    return (
                      <tr
                        key={row.Id || index}
                        className={active ? "sel" : ""}
                        onClick={() => setHighlightId(String(row.Id))}
                        onDoubleClick={() => openRow(row)}
                      >
                        {(pattyBill || salesPatty) && (
                          <td className="ppv-center">
                            <input
                              type="checkbox"
                              checked={!!selectedIds[String(row.Id)]}
                              onChange={() => toggleSelected(row.Id)}
                            />
                          </td>
                        )}
                        <td>{row.ArrivalNo}</td>
                        <td>{asDate(row.ArrivalDate)}</td>
                        <td>{row.SupplierName}</td>
                        <td className="ppv-right">{CC.f2(CC.vn(row.Amount)).toFixed(2)}</td>
                        <td className="ppv-center">
                          <button className="bm-btn ppv-open-btn" type="button" onClick={() => openRow(row)}>Open</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bm-actions">
              <button className="bm-btn bm-btn-primary" type="button" onClick={loadRows} disabled={loading}>View</button>
              <button className="bm-btn bm-btn-secondary" type="button" onClick={() => navigate(-1)}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
