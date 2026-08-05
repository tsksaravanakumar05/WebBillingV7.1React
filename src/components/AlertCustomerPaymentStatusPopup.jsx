import { useEffect, useMemo, useRef, useState } from "react";
import { BellRing } from "lucide-react";

import "./AlertCustomerPaymentStatusPopup.css";
import * as CC from "./Common";

const toBool = (value) => value === true || value === 1 || value === "1" || value === "true";

const toMDY = (value) => {
  const date = value ? new Date(value) : new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatAmount = (value) => {
  const amount = Number.parseFloat(value ?? 0);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
};

const diffDays = (dueDate) => {
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return 0;
  const now = new Date();
  return Math.max(0, Math.floor((now - due) / (1000 * 60 * 60 * 24)));
};

const normalizeRows = (rows) => {
  if (!Array.isArray(rows)) return [];

  return rows.map((row, index) => ({
    id: row?.Id ?? index + 1,
    billNo: row?.PurchaseNo ?? row?.PurNo ?? "",
    billDate: row?.PurchaseDate ?? row?.PurDate ?? "",
    customer: row?.Supplier ?? "",
    dueAmount: row?.NetAmt ?? row?.Amount ?? 0,
    dueDate: row?.DueDate ?? "",
    days: row?.Days ?? diffDays(row?.DueDate),
    company: row?.Comp ?? row?.Company ?? "",
  })).filter((row) => row.billNo || row.customer || row.dueAmount);
};

export default function AlertCustomerPaymentStatusPopup() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const cardRef = useRef(null);
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
  });

  useEffect(() => {
    let cancelled = false;

    const mainSetting = (CC.getLocal("Mainsetting") || [{}])[0] || {};
    const shouldShow = toBool(mainSetting.CustomerDuePaymentPopUP);
    const popupAlert = localStorage.getItem("popupalert") || "0";
    const Comid = CC.getStr("Comid") || "1";
    const MComid = CC.getStr("MComid") || Comid;

    if (!shouldShow || popupAlert !== "1") {
      return undefined;
    }

    const loadAlert = async () => {
      setLoading(true);
      try {
        const res = await CC.api(
          CC.CustomerDuePaymentReport,
          null,
          {},
          {
            Fromdate: toMDY(new Date()),
            GroupBy: "",
            Comid,
            MComid,
          }
        );

        if (cancelled) return;

        const rawRows = Array.isArray(res?.Data1)
          ? res.Data1
          : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res)
              ? res
              : [];

        const normalized = normalizeRows(rawRows);
        setRows(normalized);
        setOpen(normalized.length > 0);
      } catch (error) {
        if (!cancelled) {
          console.error("Customer due payment popup load failed:", error);
          setRows([]);
          setOpen(false);
        }
      } finally {
        if (!cancelled) {
          localStorage.setItem("popupalert", "0");
          setLoading(false);
        }
      }
    };

    loadAlert();

    return () => {
      cancelled = true;
    };
  }, []);

  const totalDue = useMemo(
    () => rows.reduce((sum, row) => sum + Number.parseFloat(row.dueAmount || 0), 0),
    [rows]
  );

  const handleClose = () => {
    setOpen(false);
  };

  const handleDragStart = (event) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    dragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: rect.left,
      offsetY: rect.top,
    };

    cardRef.current.classList.add("acp-card-dragging");
    event.preventDefault();
  };

  useEffect(() => {
    const handleDragMove = (event) => {
      if (!dragRef.current.active || !cardRef.current) return;

      const nextLeft = dragRef.current.offsetX + (event.clientX - dragRef.current.startX);
      const nextTop = dragRef.current.offsetY + (event.clientY - dragRef.current.startY);

      cardRef.current.style.left = `${Math.max(8, nextLeft)}px`;
      cardRef.current.style.top = `${Math.max(8, nextTop)}px`;
      cardRef.current.style.bottom = "auto";
      cardRef.current.style.transform = "none";
    };

    const handleDragEnd = () => {
      if (!dragRef.current.active || !cardRef.current) return;
      dragRef.current.active = false;
      cardRef.current.classList.remove("acp-card-dragging");
    };

    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleDragEnd);

    return () => {
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
    };
  }, []);

  if (!open && !loading) return null;

  return (
    <div className="acp-overlay" role="dialog" aria-modal="true" aria-labelledby="acp-title">
      <div className="acp-shell">
        <div ref={cardRef} className="bm-card acp-card">
          <div className="bm-card-header acp-drag-handle" onMouseDown={handleDragStart}>
            <div className="bm-card-header-title" id="acp-title">
              Customer Due Payment Status
            </div>
            <button type="button" className="bm-close-x" aria-label="Close" onMouseDown={(event) => event.stopPropagation()} onClick={handleClose}>
              X
            </button>
          </div>

          <div className="bm-card-body">
            <div className="acp-summary">
              <div className="acp-badge">
                <BellRing size={16} />
                Pending Customers: <strong>{rows.length}</strong>
              </div>
              <div className="acp-badge">
                Total Due: <strong>{formatAmount(totalDue)}</strong>
              </div>
            </div>

            {loading ? (
              <div className="acp-loader">Loading customer due payment details...</div>
            ) : (
              <div className="bm-grid-wrap acp-grid-wrap">
                <table className="bm-tbl">
                  <colgroup>
                    <col className="acp-col-bill" />
                    <col className="acp-col-date" />
                    <col className="acp-col-customer" />
                    <col className="acp-col-amount" />
                    <col className="acp-col-date" />
                    <col className="acp-col-days" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="acp-th-center">Bill No</th>
                      <th>Bill Date</th>
                      <th>Customer</th>
                      <th className="acp-th-center">Due Amount</th>
                      <th>Due Date</th>
                      <th className="acp-th-center">Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={`${row.id}-${row.billNo}`}>
                        <td className="acp-td-center">{row.billNo}</td>
                        <td>{formatDate(row.billDate)}</td>
                        <td>{row.customer}</td>
                        <td className="acp-td-amount">{formatAmount(row.dueAmount)}</td>
                        <td>{formatDate(row.dueDate)}</td>
                        <td className="acp-td-center">{row.days}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!rows.length && (
                  <div className="acp-empty-state">No customer due payment data available.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
