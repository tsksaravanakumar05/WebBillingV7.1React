import { useEffect, useMemo, useRef, useState } from "react";
import { BellRing, Keyboard } from "lucide-react";

import "./AlertChequeStatusPopup.css";
import * as CC from "./Common";

const STATUS_OPTIONS = ["No", "Yes", "Return"];

const toBool = (value) => value === true || value === 1 || value === "1" || value === "true";
const toNumber = (value) => {
  const amount = Number.parseFloat(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};
const formatAmount = (value) => toNumber(value).toFixed(2);
const ensureUpdateId = (value) => value || (crypto.randomUUID ? crypto.randomUUID() : CC.uid());

const formatDate = (value) => {
  if (!value) return "";
  const parsed = parseDateValue(value);
  if (!parsed) return String(value);
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
};

function parseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const msMatch = /Date\((\d+)\)/i.exec(trimmed);
    if (msMatch) {
      const fromMs = new Date(Number(msMatch[1]));
      return Number.isNaN(fromMs.getTime()) ? null : fromMs;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split("-").map(Number);
      return new Date(year, month - 1, day);
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.split("/").map(Number);
      return new Date(year, month - 1, day);
    }

    if (/^\d{2}\/\d{2}\/\d{4}\s/.test(trimmed)) {
      const [datePart] = trimmed.split(" ");
      const [day, month, year] = datePart.split("/").map(Number);
      return new Date(year, month - 1, day);
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const toMDY = (value) => {
  const parsed = parseDateValue(value);
  if (!parsed) return "";
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${month}/${day}/${year}`;
};

const toSqlDateTime = (value) => {
  const parsed = parseDateValue(value);
  if (!parsed) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}T00:00:00`;
};

const normalizeStatus = (value) => {
  const text = String(value ?? "").trim().toUpperCase();
  if (text === "YES" || text === "Y" || text === "TRUE" || text === "1") return "Yes";
  if (text === "RETURN" || text === "R") return "Return";
  return "No";
};

const extractRows = (res) => {
  if (Array.isArray(res?.Data1)) return res.Data1;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res)) return res;
  return [];
};

const inferVoucherKind = (row) => {
  const source = String(
    row?.VoucherSource ??
    row?.SourceTable ??
    row?.ModuleName ??
    row?.VoucherName ??
    row?.EntryType ??
    row?.TypeName ??
    row?.FormType ??
    row?.SourceType ??
    ""
  ).toUpperCase();
  const accountType = String(row?.AccountType ?? "").toUpperCase();
  const transactionType = String(row?.Type ?? row?.VoucherType ?? "").toUpperCase();
  const hasBankRef = row?.BankRefid != null || row?.BankRefId != null;
  const hasAccountRef = row?.AccountRefId != null;
  const hasChequeFields = row?.ChequeNo != null || row?.ChequeNumber != null || row?.ChequeDate != null;
  const hasBankName = !!String(row?.Bank ?? row?.BankName ?? "").trim();

  if (source.includes("SUPPLIER")) return "supplier";
  if (source.includes("CUSTOMER") || source.includes("RECEIPT")) return "customer";
  if (source.includes("BANK")) return "bank";
  if (source.includes("CASH")) return "cash";

  if (accountType === "SUPPLIER") return "supplier";
  if (accountType === "CUSTOMER") return "customer";

  if (hasBankRef || (hasAccountRef && (hasBankName || hasChequeFields))) return "bank";
  if (transactionType === "RECEIPT" || transactionType === "PAYMENT") {
    return row?.Bank || row?.BankName ? "bank" : "cash";
  }

  return "";
};

const inferTransactionType = (row, normalizedRow = null) => {
  const rawType = String(row?.Type ?? row?.VoucherType ?? row?.EntryType ?? normalizedRow?.raw?.Type ?? "").trim();
  if (rawType) return rawType;

  const payment = toNumber(row?.Payment ?? normalizedRow?.payment);
  const receipt = toNumber(row?.Recepit ?? row?.Receipt ?? normalizedRow?.receipt);

  if (payment > 0 && receipt <= 0) return "Payment";
  if (receipt > 0 && payment <= 0) return "Receipt";

  return "";
};

const resolveVoucherKind = (row) => {
  const directKind = row?.voucherKind || inferVoucherKind(row?.raw || row);
  if (directKind) return directKind;

  const raw = row?.raw || row || {};
  const hasBankRef = raw?.BankRefid != null || raw?.BankRefId != null;
  const hasBankName = !!String(raw?.Bank ?? raw?.BankName ?? row?.bankName ?? "").trim();
  const hasAccountRef = raw?.AccountRefId != null;
  const hasChequeData =
    raw?.ChequeDate != null ||
    raw?.ChequeNo != null ||
    raw?.ChequeNumber != null ||
    toNumber(raw?.RTGSAmt) > 0 ||
    !!String(raw?.RTGSNo ?? "").trim();

  if (hasBankRef || hasBankName || (hasAccountRef && hasChequeData)) return "bank";
  if (hasAccountRef) return "cash";
  return "";
};

const resolveBankId = async (row, session) => {
  const directBankId = row?.raw?.BankRefid ?? row?.raw?.BankRefId;
  if (directBankId != null && directBankId !== "") return directBankId;

  const bankName = String(row?.raw?.Bank ?? row?.raw?.BankName ?? row?.bankName ?? "").trim();
  if (!bankName) return null;

  const res = await CC.api(CC.BankAllSelect, null, {}, { Comid: Number(session.Comid || 1) });
  const banks = extractRows(res);
  const matched = banks.find(
    (item) => String(item?.AccountName ?? item?.BankName ?? "").trim().toUpperCase() === bankName.toUpperCase()
  );

  return matched?.Id ?? null;
};

const normalizeRows = (rows) => {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row, index) => {
      const accountType = String(row?.AccountType ?? "").toUpperCase();
      const chequeAmount = toNumber(row?.ChequeAmount ?? row?.Payment ?? row?.Recepit ?? 0);
      const normalizedStatus = normalizeStatus(row?.ChequeStatus ?? row?.ClearedStatus ?? row?.ChequeStataus);

      return {
        key: row?.Id ?? row?.TypeId ?? `${index + 1}`,
        id: row?.Id ?? row?.TypeId ?? index + 1,
        accountType,
        voucherKind: inferVoucherKind(row),
        accountName: row?.AccountName ?? "",
        bankName: row?.Bank ?? row?.BankName ?? "",
        payment: accountType === "CUSTOMER" ? 0 : chequeAmount,
        receipt: accountType === "CUSTOMER" ? chequeAmount : 0,
        chequeDate: row?.ChequeDate ?? "",
        receiptDate: row?.ReceiptDate ?? row?.PaymentDate ?? row?.Refdate ?? "",
        status: normalizedStatus,
        originalStatus: normalizedStatus,
        saving: false,
        raw: row,
      };
    })
    .filter((row) => row.accountName || row.bankName || row.payment || row.receipt);
};

const buildLookupDate = (row, fallbackValue) => {
  return toMDY(row.receiptDate || row.raw?.ReceiptDate || row.raw?.PaymentDate || row.raw?.Refdate || fallbackValue);
};

const findMatchingRecord = (records, targetRow) => {
  const targetUpdateId = String(targetRow?.raw?.UpdateId ?? targetRow?.UpdateId ?? "").trim();
  if (targetUpdateId) {
    const byUpdateId = records.find(
      (item) => String(item?.UpdateId ?? "").trim().toLowerCase() === targetUpdateId.toLowerCase()
    );
    if (byUpdateId) return byUpdateId;
  }

  const idNum = Number(targetRow?.id ?? targetRow?.raw?.Id ?? 0);
  return records.find((item) => Number(item?.Id) === idNum) || null;
};

const buildReceiptPayload = (sourceRow, row, status) => {
  const chequeAmount = toNumber(sourceRow?.ChequeAmount);
  const paymentDate = toSqlDateTime(sourceRow?.PaymentDate || row.receiptDate);
  const chequeDate = chequeAmount > 0 ? toSqlDateTime(sourceRow?.ChequeDate || row.chequeDate) : "";
  const existingUpdateId = String(sourceRow?.UpdateId ?? "").trim();

  if (!existingUpdateId) {
    throw new Error("Saved customer receipt UpdateId missing. Old row cannot be updated.");
  }

  return {
    Id: Number(sourceRow?.Id ?? row.id ?? 0),
    SupplierRefId: Number(sourceRow?.SupplierRefId ?? 0),
    ClearedStatus: status === "Yes",
    RefNo: Number(sourceRow?.RefNo ?? 0),
    Type: sourceRow?.Type ?? null,
    ChequeNumber: sourceRow?.ChequeNumber ?? "",
    ChequeDate: chequeDate,
    BankRefId: sourceRow?.BankRefId ?? sourceRow?.BankRefid ?? null,
    SaleManRefId: sourceRow?.SaleManRefId ?? null,
    CashierRefid: sourceRow?.CashierRefid ?? null,
    SupplierName: sourceRow?.SupplierName ?? row.accountName ?? "",
    SupName: sourceRow?.SupName ?? null,
    CurrentBalance: toNumber(sourceRow?.CurrentBalance),
    PaymentDate: paymentDate,
    Date: toSqlDateTime(sourceRow?.Date) || "0001-01-01T00:00:00",
    MobileNo: sourceRow?.MobileNo ?? null,
    DiscountAmount: toNumber(sourceRow?.DiscountAmount),
    CashAmount: toNumber(sourceRow?.CashAmount),
    Amount: toNumber(sourceRow?.Amount),
    Balance: toNumber(sourceRow?.Balance),
    RTGSNo: sourceRow?.RTGSNo ?? "",
    Narration: sourceRow?.Narration ?? "",
    BankName: sourceRow?.BankName ?? row.bankName ?? "",
    RTGSAmt: toNumber(sourceRow?.RTGSAmt),
    UpdateId: existingUpdateId,
    SalesName: sourceRow?.SalesName ?? "",
    ChequeAmount: chequeAmount,
    ShiftCode: Number(sourceRow?.ShiftCode ?? 0),
    Remarks: sourceRow?.Remarks ?? null,
    SubAdvance: toNumber(sourceRow?.SubAdvance),
  };
};

const updateSupplierVoucher = async (row, status, session) => {
  const Fromdate = buildLookupDate(row, row.chequeDate);
  if (!Fromdate) throw new Error("Supplier payment date not found.");

  const listRes = await CC.api(CC.SelectSupplierPaymentDate, null, {}, {
    Fromdate,
    Comid: Number(session.Comid || 1),
  });

  const sourceRow = findMatchingRecord(extractRows(listRes), row) || row.raw;
  if (!sourceRow) throw new Error("Supplier payment record not found.");

  const existingUpdateId = String(sourceRow?.UpdateId ?? row.raw?.UpdateId ?? "").trim();
  if (!existingUpdateId) {
    throw new Error("Saved supplier payment UpdateId missing. Old row cannot be updated.");
  }

  const chequeAmount = toNumber(sourceRow.ChequeAmount);
  const payload = [{
    ...sourceRow,
    PaymentDate: toMDY(sourceRow.PaymentDate || row.receiptDate || Fromdate),
    ChequeAmount: chequeAmount,
    ChequeDate: chequeAmount > 0 ? toMDY(sourceRow.ChequeDate || row.chequeDate) : "",
    ClearedStatus: status === "Yes",
    UpdateId: existingUpdateId,
    EditMode: 1,
  }];

  return CC.insertapi(CC.InsertSupplierPayment, payload, {
    Paymentdetails: "[]",
    Comid: String(session.Comid || 1),
    MirrorTable: String(session.MirrorTable || 0),
    LocalDB: "1",
  });
};

const updateCustomerVoucher = async (row, status, session) => {
  const Fromdate = buildLookupDate(row, row.chequeDate);
  if (!Fromdate) throw new Error("Customer receipt date not found.");

  const listRes = await CC.api(CC.SelectCustomerReceiptDate, null, {}, {
    Fromdate,
    Comid: Number(session.Comid || 1),
    Sid: 0,
  });

  const sourceRow = findMatchingRecord(extractRows(listRes), row) || row.raw;
  if (!sourceRow) throw new Error("Customer receipt record not found.");

  const updateId = String(sourceRow?.UpdateId ?? row.raw?.UpdateId ?? "").trim();
  if (!updateId) {
    throw new Error("Customer receipt UpdateId not found.");
  }

  const payload = [buildReceiptPayload({ ...row.raw, ...sourceRow, UpdateId: updateId }, row, status)];

  return CC.insertapi(CC.InsertCustomerReceipt, payload, {
    Paymentdetails: "[]",
    ReceiptSMS: String(session.ReceiptSMS || 0),
    Comid: String(session.Comid || 1),
    MirrorTable: String(session.MirrorTable || 0),
    LocalDB: "1",
  });
};

const updateBankVoucher = async (row, status, session) => {
  const voucherType = inferTransactionType(row.raw, row);
  const bankId = await resolveBankId(row, session);
  const Fromdate = buildLookupDate(row, row.chequeDate);

  if (!voucherType) throw new Error("Bank voucher type not found.");
  if (bankId == null || bankId === "") throw new Error("Bank voucher bank id not found.");
  if (!Fromdate) throw new Error("Bank voucher date not found.");

  const listRes = await CC.api(CC.BankDateSelect, null, {}, {
    Fromdate,
    type: voucherType,
    Bid: String(bankId),
    Comid: String(session.Comid || 1),
  });

  const sourceRow = findMatchingRecord(extractRows(listRes), row);
  if (!sourceRow) throw new Error("Bank voucher record not found.");
  const existingUpdateId = String(sourceRow?.UpdateId ?? row.raw?.UpdateId ?? "").trim();
  const bankRowId = Number(sourceRow?.Id ?? row.raw?.Id ?? row.id ?? 0);
  const shouldUseLocalDbUpdate = existingUpdateId ? "1" : "0";

  if (!existingUpdateId && bankRowId <= 0) {
    throw new Error("Bank voucher UpdateId not found.");
  }

  const payload = [{
    ...sourceRow,
    Type: sourceRow.Type ?? voucherType,
    Refdate: toMDY(sourceRow.Refdate || row.receiptDate || Fromdate),
    AccountRefId: sourceRow.AccountRefId ?? row.raw?.AccountRefId ?? null,
    BankRefid: sourceRow.BankRefid ?? sourceRow.BankRefId ?? bankId,
    Amount: toNumber(sourceRow.Amount),
    RTGSAmt: toNumber(sourceRow.RTGSAmt),
    RTGSNo: sourceRow.RTGSNo ?? "",
    ChequeNo: Number(sourceRow.ChequeNo ?? row.raw?.ChequeNo ?? 0),
    ChequeDate: sourceRow.ChequeDate || row.raw?.ChequeDate || row.chequeDate || null,
    ChequeStataus: status === "Yes",
    UpdateId: existingUpdateId || ensureUpdateId(row.raw?.UpdateId),
    EditMode: 1,
  }];

  return CC.insertapi(CC.BankInsert, payload, {
    Comid: String(session.Comid || 1),
    MirrorTable: String(session.MirrorTable || 0),
    LocalDB: shouldUseLocalDbUpdate,
  });
};

const updateCashVoucher = async (row, status, session) => {
  const voucherType = row.raw?.Type ?? row.raw?.VoucherType ?? row.raw?.EntryType;
  const Fromdate = buildLookupDate(row, row.chequeDate);

  if (!voucherType) throw new Error("Cash voucher type not found.");
  if (!Fromdate) throw new Error("Cash voucher date not found.");

  const listRes = await CC.api(CC.CV_SelectDate, null, {}, {
    Fromdate,
    type: voucherType,
    Comid: Number(session.Comid || 1),
  });

  const sourceRow = findMatchingRecord(extractRows(listRes), row);
  if (!sourceRow) throw new Error("Cash voucher record not found.");

  const payload = [{
    ...sourceRow,
    Type: sourceRow.Type ?? voucherType,
    Refdate: toMDY(sourceRow.Refdate || row.receiptDate || Fromdate),
    EditMode: 1,
    ChequeStatus: status,
    ClearedStatus: status === "Yes",
  }];

  return CC.insertapi(CC.CV_Insert, payload, {
    Comid: String(session.Comid || 1),
    MirrorTable: String(session.MirrorTable || 0),
    LocalDB: String(session.LocalDB || 0),
    DayClose: String(session.DayClose || 0),
  });
};

const saveByVoucherKind = async (row, status, session) => {
  switch (resolveVoucherKind(row)) {
    case "supplier":
      return updateSupplierVoucher(row, status, session);
    case "customer":
      return updateCustomerVoucher(row, status, session);
    case "bank":
      return updateBankVoucher(row, status, session);
    case "cash":
      return updateCashVoucher(row, status, session);
    default:
      throw new Error("Voucher type not identified for this cheque row.");
  }
};

export default function AlertChequeStatusPopup() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");
  const cardRef = useRef(null);
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
  });
  const sessionRef = useRef({
    Comid: CC.getStr("Comid") || "1",
    MirrorTable: CC.getStr("MirrorTableOnline") || "0",
    LocalDB: CC.getStr("LocalDB") || "0",
    DayClose: CC.getStr("DayClose") || "0",
    ReceiptSMS: ((CC.getLocal("Companysetting") || [{}])[0] || {}).ReceiptSMS ?? 0,
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
      setMessage("");
      try {
        const res = await CC.api(CC.ChequePopUp, null, {}, { Comid });
        if (cancelled) return;

        const normalized = normalizeRows(extractRows(res));
        setRows(normalized);
        setOpen(normalized.length > 0);
      } catch (error) {
        if (!cancelled) {
          console.error("Cheque status popup load failed:", error);
          setRows([]);
          setOpen(false);
          setMessage("Cheque popup load failed.");
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
    () => rows.reduce((sum, row) => sum + toNumber(row.payment) + toNumber(row.receipt), 0),
    [rows]
  );

  const dirtyRows = useMemo(
    () => rows.filter((row) => row.status !== row.originalStatus),
    [rows]
  );

  const handleClose = () => {
    if (saving) return;
    setOpen(false);
  };

  const handleStatusChange = (key, nextStatus) => {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, status: normalizeStatus(nextStatus) } : row))
    );
    setMessage("");
  };

  const handleSave = async () => {
    if (saving) return;
    if (!dirtyRows.length) {
      setMessage("No Status change.");
      return;
    }

    const ok = window.confirm(`Changed cheque status ${dirtyRows.length} row update?`);
    if (!ok) return;

    setSaving(true);
    setMessage("");

    const failed = [];
    const updatedKeys = [];

    for (const row of dirtyRows) {
      setRows((prev) => prev.map((item) => (item.key === row.key ? { ...item, saving: true } : item)));

      try {
        const res = await saveByVoucherKind(row, row.status, sessionRef.current);
        if (!(res?.ok || res?.IsSuccess)) {
          throw new Error(res?.message || res?.Message || "Update failed.");
        }
        updatedKeys.push(row.key);
      } catch (error) {
        console.error("Cheque popup update failed:", row, error);
        failed.push(`${row.accountName}: ${error.message || "Update failed"}`);
      } finally {
        setRows((prev) => prev.map((item) => (item.key === row.key ? { ...item, saving: false } : item)));
      }
    }

    setRows((prev) =>
      prev.map((row) =>
        updatedKeys.includes(row.key)
          ? { ...row, originalStatus: row.status, raw: { ...row.raw, ChequeStatus: row.status } }
          : row
      )
    );

    if (failed.length) {
      setMessage(`Updated ${updatedKeys.length}. Failed ${failed.length}. ${failed[0]}`);
    } else {
      setMessage(`Updated ${updatedKeys.length} cheque status successfully.`);
    }

    setSaving(false);
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

    const handleShortcut = (event) => {
      if (!open) return;
      if (event.key === "F1") {
        event.preventDefault();
        handleSave();
      }
    };

    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleDragEnd);
    window.addEventListener("keydown", handleShortcut);

    return () => {
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("keydown", handleShortcut);
    };
  }, [open, handleSave]);

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
              <button
                type="button"
                className="ach-save-chip"
                onClick={handleSave}
                disabled={saving || loading}
                title="F1"
              >
                <Keyboard size={16} />
                F1 Update
              </button>
            </div>

            {message && <div className="ach-message">{message}</div>}

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
                      <tr key={`${row.key}-${row.accountName}`} className={row.saving ? "ach-row-saving" : ""}>
                        <td>{row.accountName}</td>
                        <td>{row.bankName}</td>
                        <td className="ach-td-amount">{formatAmount(row.payment)}</td>
                        <td className="ach-td-amount">{formatAmount(row.receipt)}</td>
                        <td>{formatDate(row.chequeDate)}</td>
                        <td className="ach-td-center">
                          <select
                            className={`ach-status-select${row.status !== row.originalStatus ? " is-dirty" : ""}`}
                            value={row.status}
                            onChange={(event) => handleStatusChange(row.key, event.target.value)}
                            disabled={saving || row.saving}
                          >
                            {STATUS_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </td>
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
