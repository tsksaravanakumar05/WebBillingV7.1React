import { useEffect, useMemo, useRef, useState } from "react";
import { BellRing } from "lucide-react";

import "./AlertChequeStatusPopup.css";
import * as CC from "./Common";

const toBool = (value) => value === true || value === 1 || value === "1" || value === "true";

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

const normalizeRows = (rows) => {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row, index) => {
      const accountType = String(row?.AccountType ?? "").toUpperCase();
      const chequeAmount = Number.parseFloat(row?.ChequeAmount ?? row?.Payment ?? row?.Recepit ?? 0) || 0;

      return {
        id: row?.Id ?? row?.TypeId ?? index + 1,
        accountName: row?.AccountName ?? "",
        bankName: row?.Bank ?? row?.BankName ?? "",
        payment: accountType === "CUSTOMER" ? 0 : chequeAmount,
        receipt: accountType === "CUSTOMER" ? chequeAmount : 0,
        chequeDate: row?.ChequeDate ?? "",
        chequeStatus: row?.ChequeStatus ?? "No",
      };
    })
    .filter((row) => row.accountName || row.bankName || row.payment || row.receipt);
};

export default function AlertChequeStatusPopup() {
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
    const shouldShow = toBool(mainSetting.ChequePOPUP);
    const popupAlert = localStorage.getItem("popupalert") || "0";
    const Comid = CC.getStr("Comid") || "1";

    if (!shouldShow || popupAlert !== "1") {
      return undefined;
    }

    const loadAlert = async () => {
      setLoading(true);
      try {
        const res = await CC.api(CC.ChequePopUp, null, {}, { Comid });

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
          console.error("Cheque status popup load failed:", error);
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

  const totalAmount = useMemo(
    () => rows.reduce((sum, row) => sum + Number.parseFloat(row.payment || 0) + Number.parseFloat(row.receipt || 0), 0),
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

    cardRef.current.classList.add("ach-card-dragging");
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
      cardRef.current.classList.remove("ach-card-dragging");
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
    <div className="ach-overlay" role="dialog" aria-modal="true" aria-labelledby="ach-title">
      <div className="ach-shell">
        <div ref={cardRef} className="bm-card ach-card">
          <div className="bm-card-header ach-drag-handle" onMouseDown={handleDragStart}>
            <div className="bm-card-header-title" id="ach-title">
              Today Cheque Status
            </div>
            <button
              type="button"
              className="bm-close-x"
              aria-label="Close"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={handleClose}
            >
              X
            </button>
          </div>

          <div className="bm-card-body">
            <div className="ach-summary">
              <div className="ach-badge">
                <BellRing size={16} />
                Pending Cheques: <strong>{rows.length}</strong>
              </div>
              <div className="ach-badge">
                Total Amount: <strong>{formatAmount(totalAmount)}</strong>
              </div>
            </div>

            {loading ? (
              <div className="ach-loader">Loading cheque status details...</div>
            ) : (
              <div className="bm-grid-wrap ach-grid-wrap">
                <table className="bm-tbl">
                  <colgroup>
                    <col className="ach-col-account" />
                    <col className="ach-col-bank" />
                    <col className="ach-col-amount" />
                    <col className="ach-col-amount" />
                    <col className="ach-col-date" />
                    <col className="ach-col-status" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Account Name</th>
                      <th>Bank Name</th>
                      <th className="ach-th-center">Payment</th>
                      <th className="ach-th-center">Receipt</th>
                      <th>Cheque Date</th>
                      <th className="ach-th-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={`${row.id}-${row.accountName}`}>
                        <td>{row.accountName}</td>
                        <td>{row.bankName}</td>
                        <td className="ach-td-amount">{formatAmount(row.payment)}</td>
                        <td className="ach-td-amount">{formatAmount(row.receipt)}</td>
                        <td>{formatDate(row.chequeDate)}</td>
                        <td className="ach-td-center">{row.chequeStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!rows.length && (
                  <div className="ach-empty-state">No cheque status data available.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
