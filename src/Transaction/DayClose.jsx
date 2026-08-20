import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LockKeyhole, RefreshCw, Save, Trash2, X } from "lucide-react";
import Topbar from "../components/Topbar";
import * as CC from "../components/Common";
import * as MSG from "../components/Messages";
import "../Master/MasterPage.css";
import "./DayClose.css";

const numberValue = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

const fmt2 = (value) => numberValue(value).toFixed(2);

const emptyDayClose = {
  Id: 0,
  OpeningBalance: 0,
  ClosingBalance: 0,
  RetailCash: 0,
  ReceiptCard: 0,
  CustCashCollection: 0,
  CashReceipt: 0,
  Withdraw: 0,
  WholeSaleCredit: 0,
  PurchaseCredit: 0,
  SupplierPayment: 0,
  ExpensePaymentC: 0,
  ExpensePaymentB: 0,
  SaleReturnAmt: 0,
  Deposit: 0,
  DifferAmount: 0,
  ManualCash: 0,
  TotalAmount1: 0,
  TotalAmount2: 0,
  DayDate: CC.today(),
};

const readSession = () => {
  const main = (() => {
    try { return JSON.parse(localStorage.getItem("Mainsetting") || "[{}]")?.[0] || {}; }
    catch { return {}; }
  })();

  return {
    Comid: Number(localStorage.getItem("Comid") || main.Comid || 1),
    MComid: Number(localStorage.getItem("MComid") || main.MComid || localStorage.getItem("Comid") || 1),
  };
};

function PasswordModal({ value, error, loading, onChange, onSubmit, onClose }) {
  const inputRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 40);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="dc-modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="dc-password-modal">
        <div className="dc-modal-head">
          <LockKeyhole size={16} />
          <span>Admin Password</span>
          <button type="button" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>
        <input
          ref={inputRef}
          type="password"
          className="form-ctrl dc-password-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSubmit();
            if (event.key === "Escape") onClose();
          }}
        />
        {error && <div className="dc-password-error">{error}</div>}
        <div className="dc-modal-actions">
          <button className="bm-btn bm-btn-primary" type="button" disabled={loading || !value.trim()} onClick={onSubmit}>OK</button>
          <button className="bm-btn" type="button" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function AmountRow({ label, value, strong, tone }) {
  return (
    <div className={`dc-amount-row ${strong ? "strong" : ""} ${tone || ""}`}>
      <span>{label}</span>
      <b>{fmt2(value)}</b>
    </div>
  );
}

export default function DayClose() {
  const navigate = useNavigate();
  const { confirm, ConfirmUI } = MSG.useConfirm();
  const { toast, toasts } = MSG.useToast();

  const [session] = useState(readSession);
  const [perm, setPerm] = useState({ View: 0, Add: 0, Delete: 0 });
  const [authorized, setAuthorized] = useState(false);
  const [dayDate, setDayDate] = useState(CC.today());
  const [details, setDetails] = useState(emptyDayClose);
  const [manualCash, setManualCash] = useState("");
  const [loading, setLoading] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdValue, setPwdValue] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);

  const difference = useMemo(() => {
    if (String(manualCash).trim() === "") return numberValue(details.DifferAmount);
    return Math.abs(numberValue(manualCash) - numberValue(details.ClosingBalance));
  }, [manualCash, details.DifferAmount, details.ClosingBalance]);

  const differenceTone = numberValue(manualCash) >= numberValue(details.ClosingBalance) ? "positive" : "negative";

  const redirectIfDualLogin = useCallback((res) => {
    if (res?._dualLogin || res?.redis === false) {
      alert("Already Login Another User Please Login Again!!!");
      navigate("/");
      return true;
    }
    return false;
  }, [navigate]);

  useEffect(() => {
    document.title = "DayClose-Kassapos";
  }, []);

  useEffect(() => {
    const menuStr = localStorage.getItem("menulist");
    if (!menuStr) {
      alert("Session Close Please Login !!!.");
      navigate("/");
      return;
    }

    let menulist = [];
    try { menulist = JSON.parse(menuStr) || []; } catch { menulist = []; }
    const row = menulist.find((item) => ["Day Close", "DayClose", "Day Book Close"].includes(item.PageName));
    if (!row || row.View === 0) {
      alert("Page Access Permission Denied !!!.");
      navigate("/dashboard");
      return;
    }

    setPerm({ View: row.View, Add: row.Add, Delete: row.Delete });
    setAuthorized(true);
  }, [navigate]);

  const loadDayClose = useCallback(async (dateValue = dayDate) => {
    if (!dateValue) return;
    setLoading(true);
    const res = await CC.selectDayCloseDetails({
      Date: dateValue,
      Comid: session.Comid,
    });
    setLoading(false);

    if (redirectIfDualLogin(res)) return;
    if (!(res.ok ?? res.IsSuccess)) {
      setDetails({ ...emptyDayClose, DayDate: dateValue });
      setManualCash("");
      toast(res.message || res.Message || "No Record!!", true);
      return;
    }

    const list = CC.normalizeApiList(res);
    const row = list[0] || {};
    const next = { ...emptyDayClose, ...row, DayDate: dateValue };
    setDetails(next);
    setManualCash(numberValue(next.ManualCash) ? fmt2(next.ManualCash) : "");
  }, [dayDate, redirectIfDualLogin, session.Comid, toast]);

  useEffect(() => {
    if (authorized) loadDayClose(dayDate);
  }, [authorized, dayDate, loadDayClose]);

  const buildPayload = useCallback(() => ([{
    Id: Number(details.Id || 0),
    ClosingBalance: numberValue(details.ClosingBalance),
    OpeningBalance: numberValue(details.OpeningBalance),
    Withdraw: numberValue(details.Withdraw),
    SaleReturnAmt: numberValue(details.SaleReturnAmt),
    TotalAmount1: numberValue(details.TotalAmount1),
    TotalAmount2: numberValue(details.TotalAmount2),
    ExpensePaymentC: numberValue(details.ExpensePaymentC),
    CashReceipt: numberValue(details.CashReceipt),
    CustCashCollection: numberValue(details.CustCashCollection),
    ManualCash: numberValue(manualCash),
    ExpensePaymentB: numberValue(details.ExpensePaymentB),
    PurchaseCredit: numberValue(details.PurchaseCredit),
    SupplierPayment: numberValue(details.SupplierPayment),
    RetailCash: numberValue(details.RetailCash),
    WholeSaleCredit: numberValue(details.WholeSaleCredit),
    Deposit: numberValue(details.Deposit),
    DifferAmount: numberValue(difference),
    DayDate: dayDate,
  }]), [details, difference, dayDate, manualCash]);

  const handleSave = useCallback(async () => {
    if (!perm.Add) {
      toast("Page Add Permission Denied !!!.", true);
      return;
    }

    const first = await confirm("Are You Sure Want To Save Day Close Details First Time ?");
    if (!first) return;
    const second = await confirm("Are You Sure Want To Save Day Close Details Second time ?");
    if (!second) return;
    const third = await confirm("Are You Sure Want To Save Day Close Details Third time ?");
    if (!third) return;

    setLoading(true);
    const res = await CC.insertDayCloseDetails(buildPayload(), session.Comid);
    setLoading(false);

    if (redirectIfDualLogin(res)) return;
    if (res.ok ?? res.IsSuccess) {
      toast("Day Close Details Update Successfully !!!.");
      await loadDayClose(dayDate);
    } else {
      toast(res.message || res.Message || "Day Close save failed !!!.", true);
    }
  }, [buildPayload, confirm, dayDate, loadDayClose, perm.Add, redirectIfDualLogin, session.Comid, toast]);

  const handleDelete = useCallback(async () => {
    if (!perm.Delete) {
      toast("Page Delete Permission Denied !!!.", true);
      return;
    }
    setPwdOpen(true);
    setPwdValue("");
    setPwdError("");
  }, [perm.Delete, toast]);

  const submitDeletePassword = useCallback(async () => {
    if (!pwdValue.trim()) return;
    setPwdLoading(true);
    const pwdRes = await CC.api(CC.EditPassword, null, {}, {
      password: pwdValue,
      type: "AdminPower",
      Comid: session.Comid,
    });
    setPwdLoading(false);

    if (redirectIfDualLogin(pwdRes)) return;
    if (!(pwdRes.ok ?? pwdRes.IsSuccess)) {
      setPwdError("Invalid Password !!!.");
      return;
    }

    setPwdOpen(false);
    const ok = await confirm("Are You Sure Do You Want Cancel the Day Close ?");
    if (!ok) return;

    setLoading(true);
    const res = await CC.deleteDayCloseDetails({ Date: dayDate, Comid: session.Comid });
    setLoading(false);

    if (redirectIfDualLogin(res)) return;
    if (res.ok ?? res.IsSuccess) {
      toast("Delete Successfully !!!.");
      await loadDayClose(dayDate);
    } else {
      toast(res.message || res.Message || "Day Close delete failed !!!.", true);
    }
  }, [confirm, dayDate, loadDayClose, pwdValue, redirectIfDualLogin, session.Comid, toast]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "F1") {
        event.preventDefault();
        handleSave();
      }
      if (event.key === "F2") {
        event.preventDefault();
        handleDelete();
      }
      if (event.key === "F10") {
        event.preventDefault();
        loadDayClose(dayDate);
      }
      if (event.key === "Escape" && !pwdOpen) {
        event.preventDefault();
        confirm("Do You Want To Quit?").then((ok) => ok && navigate(-1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirm, dayDate, handleDelete, handleSave, loadDayClose, navigate, pwdOpen]);

  if (!authorized) return null;

  return (
    <div className="dc-page">
      <Topbar />
      <main className="dc-shell">
        <section className="dc-card">
          <div className="dc-header">
            <div>
              <h1>Day Close</h1>
              <span>Daily cash, receipt and payment closing</span>
            </div>
            <div className="dc-date-box">
              <label>Day Close Date</label>
              <input
                className="form-ctrl"
                type="date"
                value={dayDate}
                onChange={(event) => setDayDate(event.target.value)}
              />
            </div>
          </div>

          <div className="dc-content">
            <section className="dc-panel">
              <h2>Cash In</h2>
              <AmountRow label="Opening Balance" value={details.OpeningBalance} strong />
              <AmountRow label="Retail Cash" value={details.RetailCash} />
              <AmountRow label="Customer Cash Collection" value={details.CustCashCollection} />
              <AmountRow label="Cash Receipt" value={details.CashReceipt} />
              <AmountRow label="Deposit" value={details.Deposit} />
              <AmountRow label="Card Receipt" value={details.ReceiptCard} />
              <AmountRow label="Total Amount 1" value={details.TotalAmount1} strong tone="positive" />
            </section>

            <section className="dc-panel">
              <h2>Cash Out</h2>
              <AmountRow label="Withdraw" value={details.Withdraw} />
              <AmountRow label="Sale Return" value={details.SaleReturnAmt} />
              <AmountRow label="Supplier Payment" value={details.SupplierPayment} />
              <AmountRow label="Expense Payment Cash" value={details.ExpensePaymentC} />
              <AmountRow label="Expense Payment Bank" value={details.ExpensePaymentB} />
              <AmountRow label="Purchase Credit" value={details.PurchaseCredit} />
              <AmountRow label="Whole Sale Credit" value={details.WholeSaleCredit} />
              <AmountRow label="Total Amount 2" value={details.TotalAmount2} strong tone="negative" />
            </section>

            <section className="dc-panel dc-close-panel">
              <h2>Closing</h2>
              <AmountRow label="System Closing Balance" value={details.ClosingBalance} strong />
              <label className="dc-manual-label">
                Manual Cash
                <input
                  className="form-ctrl dc-manual-input"
                  value={manualCash}
                  inputMode="decimal"
                  onChange={(event) => setManualCash(event.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={(event) => event.target.select()}
                />
              </label>
              <AmountRow label="Difference Amount" value={difference} strong tone={differenceTone} />
            </section>
          </div>

          <div className="dc-footer">
            <button className="bm-btn bm-btn-primary" type="button" onClick={handleSave} disabled={loading}>
              <Save size={16} /> F1 Save
            </button>
            <button className="bm-btn bm-btn-secondary" type="button" onClick={handleDelete} disabled={loading}>
              <Trash2 size={16} /> F2 Cancel Day Close
            </button>
            <button className="bm-btn" type="button" onClick={() => loadDayClose(dayDate)} disabled={loading}>
              <RefreshCw size={16} /> F10 Refresh
            </button>
            <button className="bm-btn" type="button" onClick={() => navigate(-1)}>
              <X size={16} /> Esc Exit
            </button>
          </div>
        </section>
      </main>

      {pwdOpen && (
        <PasswordModal
          value={pwdValue}
          error={pwdError}
          loading={pwdLoading}
          onChange={setPwdValue}
          onSubmit={submitDeletePassword}
          onClose={() => setPwdOpen(false)}
        />
      )}
      {ConfirmUI}
      <MSG.ToastList toasts={toasts} />
    </div>
  );
}
