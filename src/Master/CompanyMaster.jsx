import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./MasterPage.css"; // reuse existing CSS

// ── Helpers ────────────────────────────────────────────────────────────────────
const getStr   = (k) => localStorage.getItem(k) || "";
const getLocal = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

 const api = async (path, body, extraHeaders = {}) => {
  const url = path.startsWith("/") ? path : "/" + path;

  console.log("API URL:", url);
  console.log("API BODY:", body);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!text || !text.trim()) return { ok: false, message: "Empty response" };
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.IsSuccess !== "undefined" && typeof parsed.ok === "undefined") {
        parsed.ok = parsed.IsSuccess;
      }
      return parsed;
    } catch {
      return { ok: false, message: `Server error (${res.status})` };
    }
  } catch (err) {
    return { ok: false, message: err.message };
  }
};

// ── Dropdown option lists (mirrors jQuery source arrays exactly) ───────────────



const BILL_TYPE_OPTIONS = [
  "Continuous",
  "Daily Reset On Company",
  "Cashier Wise Reset Company Daily",
  "Counter Wise Reset Company Daily",
  "Cashier Wise Reset Company Continious",
];
const BILL_COLUMN_OPTIONS = ["Customized Bill", "A4-Half", "A4-Full"];
const POS_DEFAULT_QTY_OPTIONS = [0,1,2,3,4,5,6,7,8,9];
const POS_TAX_OPTIONS = ["Inclusive", "Inclusive Don't Show Tax", "Exclusive"];
const YES_NO_OPTIONS = ["Yes", "No"];

const BILL_SALE_A4_FORMATS = [
  "Default","Default-A4FULL-Format1","Default-A4FULL-Format2","Default-A4FULL-Format2B",
  "Default-A4FULL-Format3","Default-A4FULL-Format4","Default-A4FULL-Format5",
  "Default-A4FULL-Format7","Default-A4FULL-Format8","Default-A4FULL-Format21",
  "Default-A4FULL-Format-SerialNo1","Default-A4Half-Format1",
  "Default-A4HalfVertical-Format1","TVRSONS","MKJFOOD","JJBitumen",
  "AnnaiMobile","Thirupathi Traders","Friends Automobiles",
];
const BILL_FORMAT_OPTIONS = ["Default", "Friends Automobiles - Estimate"];
const SALE_ORDER_FORMATS  = ["Default", "JJBitumen", "Thirupathi Traders"];
const QUOT_FORMATS        = ["Default", "JJBitumen", "Default-A4FULL-Format1"];

const ROUNDOFF_OPTIONS = [
  { value: "1", label: "25 Paise" },
  { value: "2", label: "50 Paise" },
  { value: "3", label: "1 Rupee"  },
  { value: "4", label: "5 Rupee"  },
  { value: "5", label: "10 Rupee" },
  { value: "6", label: "None"     },
];

// ── Blank form state — maps every field jQuery reads/writes ───────────────────
const BLANK_FORM = {
  // Company Address
  Address1: "", Address2: "", City: "", Pincode: "", Phone: "",
  GSTNo: "", Email: "", State: "",
  // Year / Bills
  YearName: "", FYear: "", No_Of_Bills: "",
  BillType: "Continuous", BillColumn: "Customized Bill",
  // SMS
  SaleorderSMS: "", ReceiptSMS: "", Greetings1SMS: "", Greetings2SMS: "",
  // Other Configs
  POSQty: "0", POSTax: "Inclusive",
  NegativeStock: false, MultiMRP: false, PCode_Auto: false,
  BillPrefix: "", PCode_Prefix: "", PCode_Digits: "",
  FooterMsg1: "", FooterMsg2: "",
  CRMPointValue: "", NumberDigit: "", BillNoStart: "",
  RoundOff: "6",
  // Conditions of Sales
  POSLine1:"", POSLine2:"", POSLine3:"", POSLine4:"", POSLine5:"",
  // Conditions of Sales Return
  SRLine1:"", SRLine2:"", SRLine3:"", SRLine4:"",
  // Conditions of Purchase Order
  POLine1:"", POLine2:"", POLine3:"", POLine4:"",
  // Conditions of Purchase Return
  PRLine1:"", PRLine2:"", PRLine3:"", PRLine4:"",
  // Conditions of Sales Order
  SOLine1:"", SOLine2:"", SOLine3:"", SOLine4:"",
  // Estimate Details
  EstimateCompanyName:"", EstimateAddress1:"", EstimateAddress2:"",
  EstimateCity:"", EstimatePhoneNo:"",
  // Bank Details
  BankLine1:"", BankLine2:"", BankLine3:"", BankLine4:"", BankLine5:"",
  // Bill Formats
  SaleBillFormat:"Default", SaleReturnBillFormat:"Default",
  QuotationBillFormat:"Default", SaleOrderBillFormat:"Default",
  DCBillFormat:"Default", EstimateBillFormat:"Default",
  // Internal
  Id: null,
};

// ── Tabs definition ────────────────────────────────────────────────────────────
const TABS = [
  "Company Address",
  "Bill Settings",
  "Other Configs",
  "Conditions of Sales",
  "Conditions of Sales Return",
  "Conditions of Purchase Order",
  "Conditions of Purchase Return",
  "Conditions of Sales Order",
  "Estimate Details",
  "Bank Details",
  "Bill Formats",
  "SMS",
];

// ─────────────────────────────────────────────────────────────────────────────
export default function CompanySettings() {
  const navigate  = useNavigate();
  const toastId   = useRef(0);
  const savingRef = useRef(false);

  // Session
  const Comid      = getStr("Comid") || "1";
  const MComid     = getStr("MComid") || Comid;
  const MirrorTable = getStr("MirrorTableOnline") || "0";

  // Permission
  const menudata = (getLocal("menulist") || []).filter(o => o.PageName === "Company");
  const perm     = menudata[0] || { View: 1, Add: 1, Edit: 1, Delete: 1 };

  const [form,     setForm]     = useState(BLANK_FORM);
  const [loading,  setLoading]  = useState(false);
  const [toasts,   setToasts]   = useState([]);
  const [activeTab, setActiveTab] = useState(0);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const toast = useCallback((m, err = false) => {
    const id = ++toastId.current;
    setToasts(p => [...p, { id, m, err }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  // ── Field updater ──────────────────────────────────────────────────────────
  const setField = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  // ── loadCompany — mirrors jQuery methods.loadCompany() exactly ─────────────
 
  const loadCompany = useCallback(async () => {
    setLoading(true);
  
    const res = await api(
      `/Login/SelectCompanySetting?Comid=${parseInt(Comid, 10)}`,
      {},
      "POST"
    );
  
    setLoading(false);
  
    console.log("API RESPONSE :", res);
  
    if (!res.IsSuccess) {
      toast(`❌ ${res.Message || "Failed to load company settings"}`, true);
      return;
    }
  
    const items = Array.isArray(res.Data1) ? res.Data1 : [];
  
    if (!items.length) {
      toast("⚠️ No company settings found", true);
      return;
    }
  
    const item = items[0];
  
    setForm({
      Address1: item.Address1 || "",
      Address2: item.Address2 || "",
      City: item.City || "",
      Pincode: item.Pincode || "",
      Phone: item.Phone || "",
      GSTNo: item.GSTNo || "",
      Email: item.Email || "",
      State: item.State || "",
      YearName: item.YearName || "",
      FYear: item.FYear || "",
      No_Of_Bills: String(item.No_Of_Bills ?? ""),
      BillType: item.BillType || "Continuous",
      BillColumn: item.BillColumn || "Customized Bill",
      SaleorderSMS: item.SaleorderSMS || "",
      ReceiptSMS: item.ReceiptSMS || "",
      Greetings1SMS: item.Greetings1SMS || "",
      Greetings2SMS: item.Greetings2SMS || "",
      POSQty: String(item.POSQty ?? "0"),
      POSTax: item.POSTax || "Inclusive",
  
      NegativeStock:
        item.NegativeStock === true ||
        item.NegativeStock === 1,
  
      MultiMRP:
        item.MultiMRP === true ||
        item.MultiMRP === 1,
  
      PCode_Auto:
        item.PCode_Auto === true ||
        item.PCode_Auto === 1,
  
      BillPrefix: item.BillPrefix || "",
      PCode_Prefix: item.PCode_Prefix || "",
      PCode_Digits: String(item.PCode_Digits ?? ""),
      FooterMsg1: item.FooterMsg1 || "",
      FooterMsg2: item.FooterMsg2 || "",
      CRMPointValue: String(item.CRMPointValue ?? ""),
      NumberDigit: String(item.NumberDigit ?? ""),
      BillNoStart: String(item.BillNoStart ?? ""),
      RoundOff: String(item.RoundOff ?? "6"),
  
      POSLine1: item.POSLine1 || "",
      POSLine2: item.POSLine2 || "",
      POSLine3: item.POSLine3 || "",
      POSLine4: item.POSLine4 || "",
      POSLine5: item.POSLine5 || "",
  
      SRLine1: item.SRLine1 || "",
      SRLine2: item.SRLine2 || "",
      SRLine3: item.SRLine3 || "",
      SRLine4: item.SRLine4 || "",
  
      POLine1: item.POLine1 || "",
      POLine2: item.POLine2 || "",
      POLine3: item.POLine3 || "",
      POLine4: item.POLine4 || "",
  
      PRLine1: item.PRLine1 || "",
      PRLine2: item.PRLine2 || "",
      PRLine3: item.PRLine3 || "",
      PRLine4: item.PRLine4 || "",
  
      SOLine1: item.SOLine1 || "",
      SOLine2: item.SOLine2 || "",
      SOLine3: item.SOLine3 || "",
      SOLine4: item.SOLine4 || "",
  
      EstimateCompanyName: item.EstimateCompanyName || "",
      EstimateAddress1: item.EstimateAddress1 || "",
      EstimateAddress2: item.EstimateAddress2 || "",
      EstimateCity: item.EstimateCity || "",
      EstimatePhoneNo: item.EstimatePhoneNo || "",
  
      BankLine1: item.BankLine1 || "",
      BankLine2: item.BankLine2 || "",
      BankLine3: item.BankLine3 || "",
      BankLine4: item.BankLine4 || "",
      BankLine5: item.BankLine5 || "",
  
      SaleBillFormat: item.SaleBillFormat || "Default",
      SaleReturnBillFormat: item.SaleReturnBillFormat || "Default",
      QuotationBillFormat: item.QuotationBillFormat || "Default",
      SaleOrderBillFormat: item.SaleOrderBillFormat || "Default",
      DCBillFormat: item.DCBillFormat || "Default",
      EstimateBillFormat: item.EstimateBillFormat || "Default",
  
      Id: item.Id ?? null,
    });
  
  }, [Comid, toast]);

  // Load once on mount (mirrors jQuery methods.init() → loadCompany())
  useEffect(() => { loadCompany(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── handleSave — mirrors jQuery F1 block exactly ───────────────────────────
  // Builds same companyupdate object, sends to /Login/UpdateCompanySetting
  // Header: MirrorTable
  const handleSave = useCallback(async () => {
    if (savingRef.current) return;
    if (!window.confirm("Do you Want to Save the Company Details?")) return;

    // jQuery: convert Yes/No dropdowns back to bool
    const payload = {
      CompanyRefId:         Comid,
      Companyname:          getStr("CompanyName"),
      NoOfBills:            form.No_Of_Bills,
      YearName:             form.YearName,
      FYear:                form.FYear,
      BillType:             form.BillType,
      BillColumn:           form.BillColumn,
      Address1:             form.Address1,
      Address2:             form.Address2,
      City:                 form.City,
      Pincode:              form.Pincode,
      Phone:                form.Phone,
      GSTNo:                form.GSTNo,
      Email:                form.Email,
      No_Of_Bills:          form.No_Of_Bills,
      State:                form.State,
      POSQty:               form.POSQty,
      POSTax:               form.POSTax,
      NegativeStock:        form.NegativeStock,   // bool
      MultiMRP:             form.MultiMRP,
      PCode_Auto:           form.PCode_Auto,
      PCode_Prefix:         form.PCode_Prefix,
      PCode_Digits:         form.PCode_Digits,
      FooterMsg1:           form.FooterMsg1,
      FooterMsg2:           form.FooterMsg2,
      POSLine1:             form.POSLine1, POSLine2: form.POSLine2,
      POSLine3:             form.POSLine3, POSLine4: form.POSLine4,
      POSLine5:             form.POSLine5,
      SaleorderSMS:         form.SaleorderSMS,
      ReceiptSMS:           form.ReceiptSMS,
      Greetings1SMS:        form.Greetings1SMS,
      Greetings2SMS:        form.Greetings2SMS,
      BankLine1:            form.BankLine1, BankLine2: form.BankLine2,
      BankLine3:            form.BankLine3, BankLine4: form.BankLine4,
      BankLine5:            form.BankLine5,
      PRLine1:              form.PRLine1, PRLine2: form.PRLine2,
      PRLine3:              form.PRLine3, PRLine4: form.PRLine4,
      POLine1:              form.POLine1, POLine2: form.POLine2,
      POLine3:              form.POLine3, POLine4: form.POLine4,
      SOLine1:              form.SOLine1, SOLine2: form.SOLine2,
      SOLine3:              form.SOLine3, SOLine4: form.SOLine4,
      SRLine1:              form.SRLine1, SRLine2: form.SRLine2,
      SRLine3:              form.SRLine3, SRLine4: form.SRLine4,
      RoundOff:             form.RoundOff,
      BillPrefix:           form.BillPrefix,
      NumberDigit:          form.NumberDigit,
      CRMPointValue:        form.CRMPointValue,
      SaleBillFormat:       form.SaleBillFormat,
      SaleReturnBillFormat: form.SaleReturnBillFormat,
      QuotationBillFormat:  form.QuotationBillFormat,
      SaleOrderBillFormat:  form.SaleOrderBillFormat,
      DCBillFormat:         form.DCBillFormat,
      EstimateBillFormat:   form.EstimateBillFormat,
      BillNoStart:          form.BillNoStart,
      EstimateCompanyName:  form.EstimateCompanyName,
      EstimateAddress1:     form.EstimateAddress1,
      EstimateAddress2:     form.EstimateAddress2,
      EstimateCity:         form.EstimateCity,
      EstimatePhoneNo:      form.EstimatePhoneNo,
    };

    savingRef.current = true;
    setLoading(true);

    const res = await api("/Login/UpdateCompanySetting", payload, {
      MirrorTable: String(MirrorTable),
    });

    setLoading(false);
    savingRef.current = false;

    if (res.ok) {
      // jQuery: localStorage.setItem("Companysetting", JSON.stringify(data.data))
      if (res.data) {
        localStorage.setItem("Companysetting", JSON.stringify(res.data));
        const neg = Array.isArray(res.data) ? res.data[0]?.NegativeStock : res.data?.NegativeStock;
        localStorage.setItem("AllowNegativeStock", neg == 1 ? "true" : "false");
      }

      // ── ItemMaster உடனே pick up செய்ய: PCode_Auto & MultiMRP ──────────────
      // jQuery login flow போல் Companysetting update ஆகிறது.
      // ஆனால் ItemMaster sess = useState (one-time init) என்பதால்,
      // page reload செய்தால் மட்டும் புதிய value கிடைக்கும் — அதுவே correct flow.
      // (Login → Companysetting → ItemMaster open → sess reads fresh value)
      // Extra key: "PCode_Auto_direct" → ItemMaster reload இல்லாமல் use செய்ய வேண்டும் என்றால் மட்டும்.
      const savedData = Array.isArray(res.data) ? res.data[0] : res.data;
      if (savedData) {
        // Companysetting already saved above — ItemMaster reload பண்ணும்போது
        // getLocal("Companysetting")[0].PCode_Auto தானாக வரும்.
        // MultiMRP-க்கும் same — Companysetting[0].MultiMRP.
        // No extra keys needed — standard flow works correctly.
        console.log("✅ Companysetting updated | PCode_Auto:", savedData.PCode_Auto, "| MultiMRP:", savedData.MultiMRP);
      }

      toast("✅ " + (res.message || "Company details saved successfully!"));
    } else {
      toast(`❌ ${res.message || "Save failed"}`, true);
    }
  }, [form, Comid, MirrorTable, toast]);

  // ── handleScriptUpdate — mirrors jQuery F2 block ───────────────────────────
  const handleScriptUpdate = useCallback(async () => {
    if (!window.confirm("Do you Want to Update Script?")) return;
  
    try {
      setLoading(true);
  
      const now = new Date();
      now.setDate(now.getDate() - 1);
  
      const pad = (n) => String(n).padStart(2, "0");
  
      const dateStr =
        `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} 00:00:00`;
  
      console.log("Sending Date:", dateStr);
  
      // send as query param
      const res = await api(
        `/Login/ScriptUpdate?Date=${encodeURIComponent(dateStr)}`,
        null,
        { MirrorTable: String(MirrorTable) }
      );
  
      console.log("API RESPONSE =>", res);
  
      if (res?.IsSuccess) {
        toast("✅ " + (res.Message || "Script updated"));
      } else {
        toast(`❌ ${res?.Message || "Script update failed"}`, true);
      }
    } catch (err) {
      console.error(err);
      toast("❌ Something went wrong", true);
    } finally {
      setLoading(false);
    }
  }, [MirrorTable, toast]);



  // ── Global keyboard — F1 / F2 / Esc ───────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "F1")     { e.preventDefault(); handleSave(); }
      if (e.key === "F2")     { e.preventDefault(); handleScriptUpdate(); }
      if (e.key === "Escape") {
        e.preventDefault();
        if (window.confirm("Do You Want To Quit Page?")) navigate("/Home");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleScriptUpdate, navigate]);

  // ── Shared input style ─────────────────────────────────────────────────────
  const inp = "mp-cell-input";
  const sel = "mp-cell-select";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mp-wrap">
      {/* Header */}
      <div className="mp-hdr">
        <div className="mp-hdr-left">
          <div className="mp-icon">C</div>
          <div>
            <div className="mp-title">Company Settings</div>
            <div className="mp-sub">Co: {Comid} &mdash; Configure company preferences</div>
          </div>
        </div>
        <button className="mp-back" onClick={() => {
          if (window.confirm("Do You Want To Quit Page?")) navigate("/Home");
        }}>← Back</button>
      </div>

      <div className="mp-body">
        {/* Toolbar */}
        <div className="mp-toolbar">
          <button className="mp-btn sv" onClick={handleSave} disabled={loading}>💾 F1 Save</button>
          <button className="mp-btn nw" onClick={handleScriptUpdate} disabled={loading}>🔄 F2 Script Update</button>
          <button className="mp-btn dl" onClick={() => { if (window.confirm("Do You Want To Quit Page?")) navigate("/Home"); }}>✕ Esc Back</button>
        </div>

        {/* Tab Bar */}
        <div style={tabBarStyle}>
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setActiveTab(i)}
              style={{ ...tabBtnStyle, ...(activeTab === i ? tabActivStyle : {}) }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab Panels */}
        <div className="mp-grid-wrap" style={{ padding: "14px 18px", overflowY: "auto" }}>

          {/* ── 0. Company Address ── */}
          {activeTab === 0 && (
            <Section title="Company Address">
              <Row label="Address 1">
                <input className={inp} value={form.Address1} onChange={e => setField("Address1", e.target.value)} />
              </Row>
              <Row label="Address 2">
                <input className={inp} value={form.Address2} onChange={e => setField("Address2", e.target.value)} />
              </Row>
              <Row label="City">
                <input className={inp} value={form.City} onChange={e => setField("City", e.target.value)} />
              </Row>
              <Row label="Pincode">
                <input className={inp} value={form.Pincode} onChange={e => setField("Pincode", e.target.value)} />
              </Row>
              <Row label="Phone">
                <input className={inp} value={form.Phone} onChange={e => setField("Phone", e.target.value)} />
              </Row>
              <Row label="GSTIN No">
                <input className={inp} value={form.GSTNo} onChange={e => setField("GSTNo", e.target.value.toUpperCase())} />
              </Row>
              <Row label="Email / CST">
                <input className={inp} value={form.Email} onChange={e => setField("Email", e.target.value)} />
              </Row>
              <Row label="State / Year Code">
                <input className={inp} value={form.State} onChange={e => setField("State", e.target.value)} />
              </Row>
            </Section>
          )}

          {/* ── 1. Bill Settings ── */}
          {activeTab === 1 && (
            <Section title="Bill Settings">
              <Row label="Year Name">
                <input className={inp} value={form.YearName} onChange={e => setField("YearName", e.target.value)} />
              </Row>
              <Row label="Financial Year">
                <input className={inp} value={form.FYear} onChange={e => setField("FYear", e.target.value)} />
              </Row>
              <Row label="No. of Bills">
                <input className={inp} type="number" value={form.No_Of_Bills} onChange={e => setField("No_Of_Bills", e.target.value)} />
              </Row>
              <Row label="Bill Type">
                <select className={sel} value={form.BillType} onChange={e => setField("BillType", e.target.value)}>
                  {BILL_TYPE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </Row>
              <Row label="Bill Column">
                <select className={sel} value={form.BillColumn} onChange={e => setField("BillColumn", e.target.value)}>
                  {BILL_COLUMN_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </Row>
            </Section>
          )}

          {/* ── 2. Other Configs ── */}
          {activeTab === 2 && (
            <Section title="Other Configurations">
              <Row label="POS Default Qty">
                <select className={sel} value={form.POSQty} onChange={e => setField("POSQty", e.target.value)}>
                  {POS_DEFAULT_QTY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Row>
              <Row label="POS Tax Calculation">
                <select className={sel} value={form.POSTax} onChange={e => setField("POSTax", e.target.value)}>
                  {POS_TAX_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </Row>
              <Row label="Allow Negative Stock">
                <select className={sel} value={form.NegativeStock ? "Yes" : "No"} onChange={e => setField("NegativeStock", e.target.value === "Yes")}>
                  {YES_NO_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </Row>
              <Row label="Multiple MRP">
                <select className={sel} value={form.MultiMRP ? "Yes" : "No"} onChange={e => setField("MultiMRP", e.target.value === "Yes")}>
                  {YES_NO_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </Row>
              <Row label="Bill Prefix">
                <input className={inp} value={form.BillPrefix} onChange={e => setField("BillPrefix", e.target.value)} />
              </Row>
              <Row label="Bill Digits">
                <input className={inp} type="number" value={form.NumberDigit} onChange={e => setField("NumberDigit", e.target.value)} />
              </Row>
              <Row label="Bill No. Start">
                <input className={inp} type="number" value={form.BillNoStart} onChange={e => setField("BillNoStart", e.target.value)} />
              </Row>
              <Row label="Product Code Auto Generate">
                <select className={sel} value={form.PCode_Auto ? "Yes" : "No"} onChange={e => setField("PCode_Auto", e.target.value === "Yes")}>
                  {YES_NO_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </Row>
              <Row label="Product Code Prefix">
                <input className={inp} value={form.PCode_Prefix} onChange={e => setField("PCode_Prefix", e.target.value)} />
              </Row>
              <Row label="Product Code Digits">
                <input className={inp} type="number" value={form.PCode_Digits} onChange={e => setField("PCode_Digits", e.target.value)} />
              </Row>
              <Row label="Footer Msg 1">
                <input className={inp} value={form.FooterMsg1} onChange={e => setField("FooterMsg1", e.target.value)} />
              </Row>
              <Row label="Footer Msg 2">
                <input className={inp} value={form.FooterMsg2} onChange={e => setField("FooterMsg2", e.target.value)} />
              </Row>
              <Row label="CRM Point Value">
                <input className={inp} value={form.CRMPointValue} onChange={e => setField("CRMPointValue", e.target.value)} />
              </Row>
              <Row label="Round Off">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                  {ROUNDOFF_OPTIONS.map(r => (
                    <label key={r.value} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 12 }}>
                      <input
                        type="radio"
                        name="RoundOff"
                        value={r.value}
                        checked={form.RoundOff === r.value}
                        onChange={() => setField("RoundOff", r.value)}
                        style={{ accentColor: "#e8a020" }}
                      />
                      {r.label}
                    </label>
                  ))}
                </div>
              </Row>
            </Section>
          )}

          {/* ── 3. Conditions of Sales ── */}
          {activeTab === 3 && (
            <Section title="Conditions of Sales">
              {["POSLine1","POSLine2","POSLine3","POSLine4","POSLine5"].map((f, i) => (
                <Row key={f} label={`Line ${i+1}`}>
                  <input className={inp} value={form[f]} onChange={e => setField(f, e.target.value)} />
                </Row>
              ))}
            </Section>
          )}

          {/* ── 4. Conditions of Sales Return ── */}
          {activeTab === 4 && (
            <Section title="Conditions of Sales Return">
              {["SRLine1","SRLine2","SRLine3","SRLine4"].map((f, i) => (
                <Row key={f} label={`Line ${i+1}`}>
                  <input className={inp} value={form[f]} onChange={e => setField(f, e.target.value)} />
                </Row>
              ))}
            </Section>
          )}

          {/* ── 5. Conditions of Purchase Order ── */}
          {activeTab === 5 && (
            <Section title="Conditions of Purchase Order">
              {["POLine1","POLine2","POLine3","POLine4"].map((f, i) => (
                <Row key={f} label={`Line ${i+1}`}>
                  <input className={inp} value={form[f]} onChange={e => setField(f, e.target.value)} />
                </Row>
              ))}
            </Section>
          )}

          {/* ── 6. Conditions of Purchase Return ── */}
          {activeTab === 6 && (
            <Section title="Conditions of Purchase Return">
              {["PRLine1","PRLine2","PRLine3","PRLine4"].map((f, i) => (
                <Row key={f} label={`Line ${i+1}`}>
                  <input className={inp} value={form[f]} onChange={e => setField(f, e.target.value)} />
                </Row>
              ))}
            </Section>
          )}

          {/* ── 7. Conditions of Sales Order ── */}
          {activeTab === 7 && (
            <Section title="Conditions of Sales Order">
              {["SOLine1","SOLine2","SOLine3","SOLine4"].map((f, i) => (
                <Row key={f} label={`Line ${i+1}`}>
                  <input className={inp} value={form[f]} onChange={e => setField(f, e.target.value)} />
                </Row>
              ))}
            </Section>
          )}

          {/* ── 8. Estimate Details ── */}
          {activeTab === 8 && (
            <Section title="Estimate / Delivery Challan Header Details">
              <Row label="Company Name">
                <input className={inp} value={form.EstimateCompanyName} onChange={e => setField("EstimateCompanyName", e.target.value)} />
              </Row>
              <Row label="Address 1">
                <input className={inp} value={form.EstimateAddress1} onChange={e => setField("EstimateAddress1", e.target.value)} />
              </Row>
              <Row label="Address 2">
                <input className={inp} value={form.EstimateAddress2} onChange={e => setField("EstimateAddress2", e.target.value)} />
              </Row>
              <Row label="City">
                <input className={inp} value={form.EstimateCity} onChange={e => setField("EstimateCity", e.target.value)} />
              </Row>
              <Row label="Phone">
                <input className={inp} value={form.EstimatePhoneNo} onChange={e => setField("EstimatePhoneNo", e.target.value)} />
              </Row>
            </Section>
          )}

          {/* ── 9. Bank Details ── */}
          {activeTab === 9 && (
            <Section title="Bank Details (Printed on Bill)">
              {["BankLine1","BankLine2","BankLine3","BankLine4","BankLine5"].map((f, i) => (
                <Row key={f} label={`Line ${i+1}`}>
                  <input className={inp} value={form[f]} onChange={e => setField(f, e.target.value)} />
                </Row>
              ))}
            </Section>
          )}

          {/* ── 10. Bill Formats ── */}
          {activeTab === 10 && (
            <Section title="Bill Formats">
              <Row label="Sale Bill Format">
                <select className={sel} value={form.SaleBillFormat} onChange={e => setField("SaleBillFormat", e.target.value)}>
                  {BILL_SALE_A4_FORMATS.map(o => <option key={o}>{o}</option>)}
                </select>
              </Row>
              <Row label="Sale Return Bill Format">
                <select className={sel} value={form.SaleReturnBillFormat} onChange={e => setField("SaleReturnBillFormat", e.target.value)}>
                  {BILL_FORMAT_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </Row>
              <Row label="Quotation Bill Format">
                <select className={sel} value={form.QuotationBillFormat} onChange={e => setField("QuotationBillFormat", e.target.value)}>
                  {QUOT_FORMATS.map(o => <option key={o}>{o}</option>)}
                </select>
              </Row>
              <Row label="Sale Order Bill Format">
                <select className={sel} value={form.SaleOrderBillFormat} onChange={e => setField("SaleOrderBillFormat", e.target.value)}>
                  {SALE_ORDER_FORMATS.map(o => <option key={o}>{o}</option>)}
                </select>
              </Row>
              <Row label="DC Bill Format">
                <select className={sel} value={form.DCBillFormat} onChange={e => setField("DCBillFormat", e.target.value)}>
                  {BILL_FORMAT_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </Row>
              <Row label="Estimate Bill Format">
                <select className={sel} value={form.EstimateBillFormat} onChange={e => setField("EstimateBillFormat", e.target.value)}>
                  {BILL_FORMAT_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </Row>
            </Section>
          )}

          {/* ── 11. SMS ── */}
          {activeTab === 11 && (
            <Section title="SMS Templates">
              <Row label="Sale Order SMS">
                <input className={inp} value={form.SaleorderSMS} onChange={e => setField("SaleorderSMS", e.target.value)} />
              </Row>
              <Row label="Receipt SMS">
                <input className={inp} value={form.ReceiptSMS} onChange={e => setField("ReceiptSMS", e.target.value)} />
              </Row>
              <Row label="Greetings SMS 1">
                <input className={inp} value={form.Greetings1SMS} onChange={e => setField("Greetings1SMS", e.target.value)} />
              </Row>
              <Row label="Greetings SMS 2">
                <input className={inp} value={form.Greetings2SMS} onChange={e => setField("Greetings2SMS", e.target.value)} />
              </Row>
            </Section>
          )}

        </div>{/* end mp-grid-wrap */}

        <div className="mp-hint">
          <kbd>F1</kbd> Save &nbsp;|&nbsp;
          <kbd>F2</kbd> Script Update &nbsp;|&nbsp;
          <kbd>Esc</kbd> Back to Home
        </div>
      </div>{/* end mp-body */}

      {/* Loader overlay */}
      {loading && (
        <div className="mp-loader-ov">
          <div className="mp-ldr-box">
            <div className="mp-spin" />
            <div className="mp-ldr-msg">Processing...</div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div style={{ position:"fixed", bottom:20, right:20, display:"flex", flexDirection:"column", gap:6, zIndex:9999 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding:"8px 14px", borderRadius:4, fontSize:13, maxWidth:340,
            boxShadow:"0 2px 8px rgba(0,0,0,.2)",
            background: t.err ? "#dc2626" : "#16a34a",
            color:"#fff",
          }}>
            {t.m}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Small layout helpers ───────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: 1, color: "#8b99b5", borderBottom: "2px solid #e0e5f0",
        paddingBottom: 4, marginBottom: 12,
      }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <label style={{
        width: 200, flexShrink: 0,
        fontSize: 12, color: "#4a5568", fontWeight: 500, textAlign: "right",
      }}>
        {label}:
      </label>
      <div style={{ flex: 1, maxWidth: 380 }}>{children}</div>
    </div>
  );
}

// ── Tab styles ─────────────────────────────────────────────────────────────────
const tabBarStyle = {
  display: "flex", flexWrap: "wrap", gap: 4,
  background: "#fff", border: "1px solid #d4dbe8",
  borderRadius: 6, padding: "6px 8px",
};
// const tabBtnStyle = {
//   padding: "5px 12px", borderRadius: 4, fontSize: 11, fontWeight: 600,
//   cursor: "pointer", border: "1px solid transparent",
//   background: "transparent", color: "#4a5568", transition: "all .12s",
// };
// const tabActivStyle = {
//   background: "#1a2e4a", color: "#fff", borderColor: "#1a2e4a",
// };

const tabBtnStyle = {
  padding: "5px 12px",
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid transparent",
  background: "transparent",
  color: "#4a5568",
  transition: "all .12s",
};

const tabActivStyle = {
  background: "#1a2e4a",
  color: "#fff",
  border: "1px solid #1a2e4a", // ✅ FIXED
};