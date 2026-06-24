// ─────────────────────────────────────────────────────────────────────────────
//  MainSetting.jsx
//
//  React conversion of MainSetting.js (jQuery).
//  Architecture mirrors CompanyMaster.jsx:
//   • Permission guard via useEffect + isAuthorized state (View=0 → redirect)
//   • Dual-login guard helper → navigate("/")
//   • Session built once via CC.buildSession("Company")
//   • MSG hooks: useConfirm + useToast
//   • loadCompany() — mirrors jQuery methods.loadCompany() exactly
//   • handleSave()  — mirrors jQuery F1 keydown block exactly
//   • Global keyboard: F1 Save / Esc Back
//   • UI/layout/tabs/design 100% consistent with CompanyMaster
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../Master/MasterPage.css"; // reuse existing CSS

import Topbar from "../components/Topbar";
import * as CC  from "../components/Common";
import * as MSG from "../components/Messages";

// ─── Endpoint constants (exact URLs used by the original jQuery file) ────────
const SelectMainSettingUrl = "/api/loginApp/SelectMainSetting";
const UpdateMainSettingUrl = "/api/loginApp/UpdateMainSetting";

// ─── Dropdown option lists ────────────────────────────────────────────────────
const BILL_SCREEN_OPTIONS = ["Agency", "Retail", "Common"];
const WHATSAPP_OPTIONS    = ["None", "PDF-API", "PDF-Share"];

// ─── Blank form state — maps every field jQuery reads/writes ─────────────────
const BLANK_FORM = {
  // Setting 1
  ReorderPOPUP: true,
  LandingCostCompare: true,
  SameProductSameLine: true,
  SaleBillyesNo: true,
  CashierLogin: true,
  WholeSaleRate: true,
  ExpDatePOPUP: true,
  ExpDateBeforeDays: "",
  WhatsAppURL: "",
  // Setting 2
  ReceiptBill: true,
  PaymentBill: true,
  // Setting 3
  ChequePOPUP: true,
  ChequePOPDays: "",
  SaveDialogSale: true,
  // Setting 4
  BillPrintClosingBalance: true,
  SmallPrintPrintName: true,
  CustomerwiseSaleRate: true,
  TruckStockReport: true,
  GroupCommission: true,
  BranchWiseSaleRate: true,
  StockApprovalStatus: true,
  SmallPrintMRP: true,
  MirrorTableOnline: false,
  ItemwiseCRMPoint: false,
  SmallBillPrint: false,
  A4BillPrint: false,
  SaleSubMaster: false,
  Ecotech: false,
  ProductNameTamil: false,
  CustomerNameTamil: false,
  DayWiseSingleBill: false,
  PurchaseItemmasterSave: true,
  PurchaseEditItemmasterupdate: true,
  SaleDiscountAfterTax: true,
  // Setting 5
  SupplierPaymentViewDialog: true,
  CustomerReceiptViewDialog: true,
  CashSaveViewDialog: true,
  BankSaveViewDialog: true,
  SaveDislogPurchase: true,
  SaveDislogPurchasereturn: true,
  Product_Purchase: true,
  SaveDislogPurchaseOrder: true,
  // Setting 6
  StockTransferShowSaveDialog: true,
  // Setting 8
  CommonCompany: true,
  CommonCompanyDiffStock: true,
  CustomerCommonCompany: true,
  SupplierCommonCompany: true,
  CustomerCommonCompanyCommonBalance: true,
  SupplierCommonCompanyCommonBalance: true,
  BatchWiseStock: true,
  EstimateBilling: true,
  MultipleUOMBilling: true,
  TextilesSerialNowiseBilling: true,
  AlwaysBatchCreatedAllItem: true,
  SilverMart: true,
  BatchNoPerfix: "",
  BatchNoDigit: "",
  SilverRate: "",
  MainWallet: "",
  tcsper: "",
  // Setting 10
  NomsQtyName: "",
  BatchNoName: "",
  // Input Details
  PONo: true,
  PODate: true,
  DCNo: true,
  DCDate: true,
  LRNo: true,
  LRDate: true,
  VehicleNo: true,
  TransportName: true,
  Through: true,
  CourierName: true,
  CourierNo: true,
  DriverName: true,
  BillSaleType: true,
  WorkingDate: true,
  // Profit / Misc
  PurchaseProfitSaleRateChange: true,
  ProfitRoundoff: true,
  ProfitMarkDown: true,
  ProductNameKeyPress: true,
  univercell: true,
  BillingStockNoNeed: true,
  ManualBillNo: true,
  // Mobile App
  MobilePrint3Inch: true,
  MobilePrint2Inch: true,
  MobilePrint_CompanyBold: true,
  MobilePrint_MRP: true,
  MobilePrint_DescriptionDoubleLine: true,
  MobilePrint_TotalQty: true,
  MobilePrint_CashTender: true,
  MobilePrint_ClosingBalance: true,
  MobilePrint_GSTDetails: true,
  MobilePrint_CashierName: true,
  MobilePrint_TotalBold: true,
  MobilePrint_YesNo: true,
  MobileBillingScreen: "Agency",
  Mobile_SendWhatsapp: "None",
  // Setting 12
  CustomerMulitipleAllow: true,
  SupplierMulitipleAllow: true,
  // Internal
  Id: null,
};

// ─── Tabs definition (grouped exactly like the original Setting1..Setting12 / InputDetails) ──
const TABS = [
  "Setting 1",
  "Setting 2 & 3",
  "Setting 4",
  "Setting 5 & 6",
  "Setting 8 (Common / Batch)",
  "Setting 10",
  "Input Details",
  "Profit / Misc",
  "Mobile App",
  "Setting 12",
];

// ─────────────────────────────────────────────────────────────────────────────
export default function MainSetting() {
  const navigate  = useNavigate();
  const savingRef = useRef(false);

  // ── MSG hooks ────────────────────────────────────────────────────────────
  const { confirm, ConfirmUI } = MSG.useConfirm();
  const { toast,   toasts    } = MSG.useToast();

  // ── Permission / authorization state ────────────────────────────────────
  const [perm,         setPerm        ] = useState({ View: 0, Add: 0, Edit: 0, Delete: 0 });
  const [isAuthorized, setIsAuthorized] = useState(false);

  // ── Dual-login guard helper ───────────────────────────────────────────────
  const redirectIfDualLogin = useCallback((res) => {
    if (res?._dualLogin || res?.redis === false) {
      alert("Already Login Another User Please Login Again!!!");
      navigate("/");
      return true;
    }
    return false;
  }, [navigate]);

  // ── Permission guard — mirrors jQuery $(document).ready() top block exactly ──
  useEffect(() => {
    const menuStr = localStorage.getItem("menulist");

    if (!menuStr) {
      alert("Session Close Please Login !!!.");
      navigate("/Login/Index");
      return;
    }

    const menulist = JSON.parse(menuStr);
    const menudata = menulist.filter(obj => obj.PageName === "Company");

    if (!menudata || menudata.length === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => { navigate("/Home"); }, 3000);
      return;
    }

    if (menudata[0].View === 0) {
      alert("Page Access Permission Denied !!!.");
      setTimeout(() => { navigate("/Home"); }, 3000);
      return;
    }

    setPerm({
      View:   menudata[0].View,
      Add:    menudata[0].Add,
      Edit:   menudata[0].Edit,
      Delete: menudata[0].Delete,
    });
    setIsAuthorized(true);
  }, [navigate]);

  // ── Session — built once via CC.buildSession ──────────────────────────────
  const [sess] = useState(() => {
    try {
      return CC.buildSession("Company");
    } catch {
      return { Comid: "1", MComid: "1", IdComList: "1", MirrorTable: "0", menudata: [] };
    }
  });

  // ── Component state ────────────────────────────────────────────────────────
  const [form,      setForm     ] = useState(BLANK_FORM);
  const [loading,   setLoading  ] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // ── Field updater ──────────────────────────────────────────────────────────
  const setField = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  // helper for boolean fields stored as 0/1 (.val() in jQuery switch buttons)
  const toBool = (v) => v === true || v === 1 || v === "1";

  // ── loadCompany — mirrors jQuery methods.loadCompany() exactly ────────────
  const loadCompany = useCallback(async () => {
    setLoading(true);

    const res = await CC.api(
      SelectMainSettingUrl,
      null,
      {},
      { Comid: parseInt(sess.Comid, 10) }
    );

    setLoading(false);

    // ── dual-login check ──
    if (redirectIfDualLogin(res)) return;

    if (res._http404) { toast(`❌ 404 — ${SelectMainSettingUrl} not found`, true); return; }
    if (res._netErr)  { toast(`❌ Network: ${res.message}`, true); return; }

    if (res.ok === false) {
      toast(`❌ ${res.message || "Failed to load main settings"}`, true);
      return;
    }

    const items = Array.isArray(res.data) ? res.data
                : Array.isArray(res.Data1) ? res.Data1
                : [];

    if (!items.length) {
      toast("⚠️ No main settings found", true);
      return;
    }

    const item = items[0];

    let billScreen = "Agency";
    if (item.MobileBillingScreen === 1) billScreen = "Agency";
    else if (item.MobileBillingScreen === 0) billScreen = "Retail";
    else if (item.MobileBillingScreen === 2) billScreen = "Common";

    let whatsApp = "None";
    if (item.Mobile_SendWhatsapp === 0) whatsApp = "None";
    else if (item.Mobile_SendWhatsapp === 1) whatsApp = "PDF-API";
    else if (item.Mobile_SendWhatsapp === 2) whatsApp = "PDF-Share";

    setForm({
      ReorderPOPUP: toBool(item.ReorderPOPUP),
      LandingCostCompare: toBool(item.LandingCostCompare),
      SameProductSameLine: toBool(item.SameProductSameLine),
      SilverMart: toBool(item.SilverMart),
      SaleBillyesNo: toBool(item.SaleBillyesNo),
      CashierLogin: toBool(item.CashierLogin),
      WholeSaleRate: toBool(item.WholeSaleRate),
      ExpDatePOPUP: toBool(item.ExpDatePOPUP),
      ExpDateBeforeDays: String(item.ExpDateBeforeDays ?? ""),
      WhatsAppURL: item.WhatsAppURL || "",
      ReceiptBill: toBool(item.ReceiptBill),
      PaymentBill: toBool(item.PaymentBill),
      SaveDialogSale: toBool(item.SaveDialogSale),
      MultipleUOMBilling: toBool(item.MultipleUOMBilling),
      ChequePOPUP: toBool(item.ChequePOPUP),
      ChequePOPDays: String(item.ChequePOPDays ?? ""),
      BillPrintClosingBalance: toBool(item.BillPrintClosingBalance),
      SmallPrintPrintName: toBool(item.SmallPrintPrintName),
      CustomerwiseSaleRate: toBool(item.CustomerwiseSaleRate),
      TruckStockReport: toBool(item.TruckStockReport),
      GroupCommission: toBool(item.GroupCommission),
      BranchWiseSaleRate: toBool(item.BranchWiseSaleRate),
      StockApprovalStatus: toBool(item.StockApprovalStatus),
      SmallPrintMRP: toBool(item.SmallPrintMRP),
      MirrorTableOnline: toBool(item.MirrorTableOnline),
      ItemwiseCRMPoint: toBool(item.ItemwiseCRMPoint),
      SmallBillPrint: toBool(item.SmallBillPrint),
      A4BillPrint: toBool(item.A4BillPrint),
      SaleSubMaster: toBool(item.SaleSubMaster),
      Ecotech: toBool(item.Ecotech),
      ProductNameTamil: toBool(item.ProductNameTamil),
      CustomerNameTamil: toBool(item.CustomerNameTamil),
      DayWiseSingleBill: toBool(item.DayWiseSingleBill),
      PurchaseItemmasterSave: toBool(item.PurchaseItemmasterSave),
      PurchaseEditItemmasterupdate: toBool(item.PurchaseEditItemmasterupdate),
      SaleDiscountAfterTax: toBool(item.SaleDiscountAfterTax),
      SupplierPaymentViewDialog: toBool(item.SupplierPaymentViewDialog),
      CustomerReceiptViewDialog: toBool(item.CustomerReceiptViewDialog),
      CashSaveViewDialog: toBool(item.CashSaveViewDialog),
      BankSaveViewDialog: toBool(item.BankSaveViewDialog),
      SaveDislogPurchase: toBool(item.SaveDislogPurchase),
      SaveDislogPurchasereturn: toBool(item.SaveDislogPurchasereturn),
      Product_Purchase: toBool(item.Product_Purchase),
      SaveDislogPurchaseOrder: toBool(item.SaveDislogPurchaseOrder),
      StockTransferShowSaveDialog: toBool(item.StockTransferShowSaveDialog),
      CommonCompany: toBool(item.CommonCompany),
      CommonCompanyDiffStock: toBool(item.CommonCompanyDiffStock),
      CustomerCommonCompany: toBool(item.CustomerCommonCompany),
      SupplierCommonCompany: toBool(item.SupplierCommonCompany),
      CustomerCommonCompanyCommonBalance: toBool(item.CustomerCommonCompanyCommonBalance),
      SupplierCommonCompanyCommonBalance: toBool(item.SupplierCommonCompanyCommonBalance),
      BatchWiseStock: toBool(item.BatchWiseStock),
      EstimateBilling: toBool(item.EstimateBilling),
      TextilesSerialNowiseBilling: toBool(item.TextilesSerialNowiseBilling),
      AlwaysBatchCreatedAllItem: toBool(item.AlwaysBatchCreatedAllItem),
      BatchNoPerfix: item.BatchNoPerfix || "",
      BatchNoDigit: String(item.BatchNoDigit ?? ""),
      tcsper: String(item.tcsper ?? ""),
      MainWallet: String(item.MainWallet ?? ""),
      SilverRate: String(item.SilverRate ?? ""),
      NomsQtyName: item.NomsQtyName || "",
      BatchNoName: item.BatchNoName || "",
      PONo: toBool(item.PONo),
      PODate: toBool(item.PODate),
      DCNo: toBool(item.DCNo),
      DCDate: toBool(item.DCDate),
      LRNo: toBool(item.LRNo),
      LRDate: toBool(item.LRDate),
      VehicleNo: toBool(item.VehicleNo),
      TransportName: toBool(item.TransportName),
      Through: toBool(item.Through),
      CourierName: toBool(item.CourierName),
      CourierNo: toBool(item.CourierNo),
      DriverName: toBool(item.DriverName),
      BillSaleType: toBool(item.BillSaleType),
      WorkingDate: toBool(item.WorkingDate),
      MobilePrint3Inch: toBool(item.MobilePrint3Inch),
      MobilePrint2Inch: toBool(item.MobilePrint2Inch),
      MobilePrint_CompanyBold: toBool(item.MobilePrint_CompanyBold),
      MobilePrint_MRP: toBool(item.MobilePrint_MRP),
      MobilePrint_DescriptionDoubleLine: toBool(item.MobilePrint_DescriptionDoubleLine),
      MobilePrint_TotalQty: toBool(item.MobilePrint_TotalQty),
      MobilePrint_CashTender: toBool(item.MobilePrint_CashTender),
      MobilePrint_ClosingBalance: toBool(item.MobilePrint_ClosingBalance),
      MobilePrint_GSTDetails: toBool(item.MobilePrint_GSTDetails),
      MobilePrint_CashierName: toBool(item.MobilePrint_CashierName),
      MobilePrint_TotalBold: toBool(item.MobilePrint_TotalBold),
      MobilePrint_YesNo: toBool(item.MobilePrint_YesNo),
      PurchaseProfitSaleRateChange: toBool(item.PurchaseProfitSaleRateChange),
      ProfitRoundoff: toBool(item.ProfitRoundoff),
      ProfitMarkDown: toBool(item.ProfitMarkDown),
      ProductNameKeyPress: toBool(item.ProductNameKeyPress),
      univercell: toBool(item.univercell),
      BillingStockNoNeed: toBool(item.BillingStockNoNeed),
      ManualBillNo: toBool(item.ManualBillNo),
      MobileBillingScreen: billScreen,
      Mobile_SendWhatsapp: whatsApp,
      CustomerMulitipleAllow: toBool(item.CustomerMulitipleAllow),
      SupplierMulitipleAllow: toBool(item.SupplierMulitipleAllow),
      Id: item.Id ?? null,
    });
  }, [sess.Comid, toast, redirectIfDualLogin]);

  // Load once on mount — mirrors jQuery methods.init() → loadCompany()
  useEffect(() => {
    if (isAuthorized) loadCompany();
  }, [isAuthorized]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── handleSave — mirrors jQuery F1 keydown block exactly ──────────────────
  const handleSave = useCallback(async () => {
    if (savingRef.current) return;

    let billScreenNum = 1;
    if (form.MobileBillingScreen === "Retail") billScreenNum = 0;
    else if (form.MobileBillingScreen === "Agency") billScreenNum = 1;
    else if (form.MobileBillingScreen === "Common") billScreenNum = 2;

    let whatsAppNum = 1;
    if (form.Mobile_SendWhatsapp === "None") whatsAppNum = 0;
    else if (form.Mobile_SendWhatsapp === "PDF-API") whatsAppNum = 1;
    else if (form.Mobile_SendWhatsapp === "PDF-Share") whatsAppNum = 2;

    // ── numeric coercion — model fields are int/float server-side; an empty
    //    string ("") sent for these breaks JSON.NET deserialization and makes
    //    `obj` arrive as null in the controller, causing a NullReferenceException.
    const toInt   = (v, fallback = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : fallback; };

    const payload = {
      CompanyRefId: toInt(sess.Comid, 1),
      ReorderPOPUP: form.ReorderPOPUP,
      LandingCostCompare: form.LandingCostCompare,
      SameProductSameLine: form.SameProductSameLine,
      SilverMart: form.SilverMart,
      SilverRate: toInt(form.SilverRate),
      MainWallet: toInt(form.MainWallet),
      SaleBillyesNo: form.SaleBillyesNo,
      CashierLogin: form.CashierLogin,
      WholeSaleRate: form.WholeSaleRate,
      ExpDatePOPUP: form.ExpDatePOPUP,
      MultipleUOMBilling: form.MultipleUOMBilling,
      ExpDateBeforeDays: toInt(form.ExpDateBeforeDays),
      WhatsAppURL: form.WhatsAppURL,
      ReceiptBill: form.ReceiptBill,
      PaymentBill: form.PaymentBill,
      SaveDialogSale: form.SaveDialogSale,
      ChequePOPUP: form.ChequePOPUP,
      ChequePOPDays: toInt(form.ChequePOPDays),
      BillPrintClosingBalance: form.BillPrintClosingBalance,
      SmallPrintMRP: form.SmallPrintMRP,
      SmallPrintPrintName: form.SmallPrintPrintName,
      CustomerwiseSaleRate: form.CustomerwiseSaleRate,
      TruckStockReport: form.TruckStockReport,
      GroupCommission: form.GroupCommission,
      BranchWiseSaleRate: form.BranchWiseSaleRate,
      StockApprovalStatus: form.StockApprovalStatus,
      // model field is `int`, not bool — sending a raw boolean here breaks
      // JSON.NET model binding and makes the whole `obj` arrive null server-side
      MirrorTableOnline: form.MirrorTableOnline ? 1 : 0,
      ItemwiseCRMPoint: form.ItemwiseCRMPoint,
      SaleSubMaster: form.SaleSubMaster,
      Ecotech: form.Ecotech,
      SmallBillPrint: form.SmallBillPrint,
      ProductNameTamil: form.ProductNameTamil,
      CustomerNameTamil: form.CustomerNameTamil,
      DayWiseSingleBill: form.DayWiseSingleBill,
      A4BillPrint: form.A4BillPrint,
      PurchaseItemmasterSave: form.PurchaseItemmasterSave,
      PurchaseEditItemmasterupdate: form.PurchaseEditItemmasterupdate,
      SaleDiscountAfterTax: form.SaleDiscountAfterTax,
      SupplierPaymentViewDialog: form.SupplierPaymentViewDialog,
      CustomerReceiptViewDialog: form.CustomerReceiptViewDialog,
      CashSaveViewDialog: form.CashSaveViewDialog,
      BankSaveViewDialog: form.BankSaveViewDialog,
      SaveDislogPurchase: form.SaveDislogPurchase,
      SaveDislogPurchasereturn: form.SaveDislogPurchasereturn,
      Product_Purchase: form.Product_Purchase,
      SaveDislogPurchaseOrder: form.SaveDislogPurchaseOrder,
      StockTransferShowSaveDialog: form.StockTransferShowSaveDialog,
      CommonCompany: form.CommonCompany,
      CommonCompanyDiffStock: form.CommonCompanyDiffStock,
      CustomerCommonCompany: form.CustomerCommonCompany,
      SupplierCommonCompany: form.SupplierCommonCompany,
      CustomerCommonCompanyCommonBalance: form.CustomerCommonCompanyCommonBalance,
      SupplierCommonCompanyCommonBalance: form.SupplierCommonCompanyCommonBalance,
      BatchWiseStock: form.BatchWiseStock,
      EstimateBilling: form.EstimateBilling,
      TextilesSerialNowiseBilling: form.TextilesSerialNowiseBilling,
      AlwaysBatchCreatedAllItem: form.AlwaysBatchCreatedAllItem,
      BatchNoPerfix: form.BatchNoPerfix,
      BatchNoDigit: toInt(form.BatchNoDigit),
      tcsper: toInt(form.tcsper),
      NomsQtyName: form.NomsQtyName,
      BatchNoName: form.BatchNoName,
      PONo: form.PONo,
      PODate: form.PODate,
      DCNo: form.DCNo,
      DCDate: form.DCDate,
      LRNo: form.LRNo,
      LRDate: form.LRDate,
      VehicleNo: form.VehicleNo,
      TransportName: form.TransportName,
      Through: form.Through,
      CourierName: form.CourierName,
      CourierNo: form.CourierNo,
      DriverName: form.DriverName,
      BillSaleType: form.BillSaleType,
      WorkingDate: form.WorkingDate,
      MobilePrint3Inch: form.MobilePrint3Inch,
      MobilePrint2Inch: form.MobilePrint2Inch,
      MobilePrint_CompanyBold: form.MobilePrint_CompanyBold,
      MobilePrint_MRP: form.MobilePrint_MRP,
      MobilePrint_DescriptionDoubleLine: form.MobilePrint_DescriptionDoubleLine,
      MobilePrint_TotalQty: form.MobilePrint_TotalQty,
      MobilePrint_CashTender: form.MobilePrint_CashTender,
      MobilePrint_ClosingBalance: form.MobilePrint_ClosingBalance,
      MobilePrint_GSTDetails: form.MobilePrint_GSTDetails,
      MobilePrint_CashierName: form.MobilePrint_CashierName,
      MobilePrint_TotalBold: form.MobilePrint_TotalBold,
      MobilePrint_YesNo: form.MobilePrint_YesNo,
      PurchaseProfitSaleRateChange: form.PurchaseProfitSaleRateChange,
      ProfitRoundoff: form.ProfitRoundoff,
      ProfitMarkDown: form.ProfitMarkDown,
      univercell: form.univercell,
      ProductNameKeyPress: form.ProductNameKeyPress,
      BillingStockNoNeed: form.BillingStockNoNeed,
      ManualBillNo: form.ManualBillNo,
      MobileBillingScreen: billScreenNum,
      Mobile_SendWhatsapp: whatsAppNum,
      CustomerMulitipleAllow: form.CustomerMulitipleAllow,
      SupplierMulitipleAllow: form.SupplierMulitipleAllow,
    };

    const proceed = await confirm("Do you Want to Save the Main Setting Details?");
    if (!proceed) return;

    savingRef.current = true;
    setLoading(true);

    const res = await CC.insertapi(
      UpdateMainSettingUrl,
      payload,
      { MirrorTable: String(sess.MirrorTable), MComid: String(sess.MComid) }
    );

    setLoading(false);
    savingRef.current = false;

    // ── dual-login check ──
    if (redirectIfDualLogin(res)) return;

    if (res._netErr) { toast(`❌ ${res.message}`, true); return; }

    if (res.ok) {
      const saved = res.data || res.Data1;
      if (saved) {
        localStorage.setItem("Mainsetting", JSON.stringify(saved));
        const savedItem = Array.isArray(saved) ? saved[0] : saved;
        if (savedItem) {
          localStorage.setItem("CommonCompany", savedItem.CommonCompany);
          localStorage.setItem("SupplierCommon", savedItem.SupplierCommonCompany);
          localStorage.setItem("Tamil", savedItem.ProductNameTamil);
          localStorage.setItem("MirrorTableOnline", savedItem.MirrorTableOnline);
        }
      }
      toast("✅ " + (res.message || res.Message || "Main setting saved successfully!"));
    } else {
      toast(`❌ ${res.message || res.Message || "Save failed"}`, true);
    }
  }, [form, sess, toast, confirm, redirectIfDualLogin]);

  // ── handleEsc ───────────────────────────────────────────────────────────────
  const handleEsc = useCallback(async () => {
    const proceed = await confirm("Do You Want To Quit Page?");
    if (proceed) navigate("/Home");
  }, [confirm, navigate]);

  // ── Global keyboard — F1 / Esc (mirrors jQuery $(document).on('keydown')) ──
  useEffect(() => {
    const onKey = (e) => {
      if (e.keyCode === 112) { e.preventDefault(); handleSave(); }  // F1
      if (e.keyCode === 27)  { e.preventDefault(); handleEsc();  }  // Esc
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleEsc]);

  // ── Shared input/select CSS class names ────────────────────────────────────
  const inp = "mp-cell-input";
  const sel = "mp-cell-select";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="mp-wrap">
      <Topbar/>

      <div className="mp-body">
        {/* Toolbar */}
        <div className="mp-toolbar">
          <button className="mp-btn sv" onClick={handleSave} disabled={loading}>💾 F1 Save</button>
          <button className="mp-btn dl" onClick={handleEsc}>✕ Esc Back</button>
          <div className="mp-toolbar-title">Main Settings</div>
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

          {/* ── 0. Setting 1 ── */}
          {activeTab === 0 && (
            <Section title="Setting 1">
              <ToggleRow label="Reorder Popup"            value={form.ReorderPOPUP}        onChange={v => setField("ReorderPOPUP", v)} />
              <ToggleRow label="Landing Cost Compare"     value={form.LandingCostCompare}  onChange={v => setField("LandingCostCompare", v)} />
              <ToggleRow label="Same Product Same Line"   value={form.SameProductSameLine} onChange={v => setField("SameProductSameLine", v)} />
              <ToggleRow label="Sale Bill Print Yes/No"   value={form.SaleBillyesNo}       onChange={v => setField("SaleBillyesNo", v)} />
              <ToggleRow label="Cashier Login"            value={form.CashierLogin}        onChange={v => setField("CashierLogin", v)} />
              <ToggleRow label="Whole Sale Rate"          value={form.WholeSaleRate}       onChange={v => setField("WholeSaleRate", v)} />
              <ToggleRow label="Expiry Date Popup"        value={form.ExpDatePOPUP}        onChange={v => setField("ExpDatePOPUP", v)} />
              <Row label="Expiry Before Days">
                <input className={inp} value={form.ExpDateBeforeDays} onChange={e => setField("ExpDateBeforeDays", e.target.value)} />
              </Row>
              <Row label="WhatsApp URL">
                <input className={inp} value={form.WhatsAppURL} onChange={e => setField("WhatsAppURL", e.target.value)} />
              </Row>
            </Section>
          )}

          {/* ── 1. Setting 2 & 3 ── */}
          {activeTab === 1 && (
            <Section title="Setting 2 & 3">
              <ToggleRow label="Receipt Bill Wise"      value={form.ReceiptBill}      onChange={v => setField("ReceiptBill", v)} />
              <ToggleRow label="Payment Bill Wise"      value={form.PaymentBill}      onChange={v => setField("PaymentBill", v)} />
              <ToggleRow label="Cheque Popup"           value={form.ChequePOPUP}      onChange={v => setField("ChequePOPUP", v)} />
              <Row label="Cheque POP Days">
                <input className={inp} value={form.ChequePOPDays} onChange={e => setField("ChequePOPDays", e.target.value)} />
              </Row>
              <ToggleRow label="A4 Bill Preview (Save Dialog Sale)" value={form.SaveDialogSale} onChange={v => setField("SaveDialogSale", v)} />
            </Section>
          )}

          {/* ── 2. Setting 4 ── */}
          {activeTab === 2 && (
            <Section title="Setting 4">
              <ToggleRow label="Bill Print Closing Balance"     value={form.BillPrintClosingBalance}     onChange={v => setField("BillPrintClosingBalance", v)} />
              <ToggleRow label="Small Print - Print Name"        value={form.SmallPrintPrintName}         onChange={v => setField("SmallPrintPrintName", v)} />
              <ToggleRow label="Customer-wise Sale Rate"         value={form.CustomerwiseSaleRate}        onChange={v => setField("CustomerwiseSaleRate", v)} />
              <ToggleRow label="Truck Stock Report"              value={form.TruckStockReport}            onChange={v => setField("TruckStockReport", v)} />
              <ToggleRow label="Group Commission"                value={form.GroupCommission}             onChange={v => setField("GroupCommission", v)} />
              <ToggleRow label="Branch-wise Sale Rate"           value={form.BranchWiseSaleRate}          onChange={v => setField("BranchWiseSaleRate", v)} />
              <ToggleRow label="Stock Approval Status"           value={form.StockApprovalStatus}         onChange={v => setField("StockApprovalStatus", v)} />
              <ToggleRow label="Small Print MRP"                 value={form.SmallPrintMRP}               onChange={v => setField("SmallPrintMRP", v)} />
              <ToggleRow label="Mirror Table Online"             value={form.MirrorTableOnline}           onChange={v => setField("MirrorTableOnline", v)} />
              <ToggleRow label="Item-wise CRM Point"             value={form.ItemwiseCRMPoint}            onChange={v => setField("ItemwiseCRMPoint", v)} />
              <ToggleRow label="Small Bill Print"                value={form.SmallBillPrint}              onChange={v => setField("SmallBillPrint", v)} />
              <ToggleRow label="A4 Bill Print"                   value={form.A4BillPrint}                 onChange={v => setField("A4BillPrint", v)} />
              <ToggleRow label="Sale Sub Master"                 value={form.SaleSubMaster}               onChange={v => setField("SaleSubMaster", v)} />
              <ToggleRow label="Eco Tech"                        value={form.Ecotech}                     onChange={v => setField("Ecotech", v)} />
              <ToggleRow label="Product Name Tamil"              value={form.ProductNameTamil}            onChange={v => setField("ProductNameTamil", v)} />
              <ToggleRow label="Customer Name Tamil"             value={form.CustomerNameTamil}           onChange={v => setField("CustomerNameTamil", v)} />
              <ToggleRow label="Day-wise Single Bill"            value={form.DayWiseSingleBill}           onChange={v => setField("DayWiseSingleBill", v)} />
              <ToggleRow label="Purchase Item Master Save"       value={form.PurchaseItemmasterSave}      onChange={v => setField("PurchaseItemmasterSave", v)} />
              <ToggleRow label="Purchase Item Master Edit"       value={form.PurchaseEditItemmasterupdate} onChange={v => setField("PurchaseEditItemmasterupdate", v)} />
              <ToggleRow label="Sale Discount After Tax"         value={form.SaleDiscountAfterTax}        onChange={v => setField("SaleDiscountAfterTax", v)} />
            </Section>
          )}

          {/* ── 3. Setting 5 & 6 ── */}
          {activeTab === 3 && (
            <Section title="Setting 5 & 6">
              <ToggleRow label="Supplier Payment View Dialog"   value={form.SupplierPaymentViewDialog}   onChange={v => setField("SupplierPaymentViewDialog", v)} />
              <ToggleRow label="Customer Receipt View Dialog"   value={form.CustomerReceiptViewDialog}   onChange={v => setField("CustomerReceiptViewDialog", v)} />
              <ToggleRow label="Cash Save View Dialog"          value={form.CashSaveViewDialog}          onChange={v => setField("CashSaveViewDialog", v)} />
              <ToggleRow label="Bank Save View Dialog"          value={form.BankSaveViewDialog}          onChange={v => setField("BankSaveViewDialog", v)} />
              <ToggleRow label="Save Dialog Purchase"           value={form.SaveDislogPurchase}          onChange={v => setField("SaveDislogPurchase", v)} />
              <ToggleRow label="Save Dialog Purchase Return"    value={form.SaveDislogPurchasereturn}    onChange={v => setField("SaveDislogPurchasereturn", v)} />
              <ToggleRow label="Product Add (Sale/Purchase Form)" value={form.Product_Purchase}          onChange={v => setField("Product_Purchase", v)} />
              <ToggleRow label="Save Dialog Purchase Order"     value={form.SaveDislogPurchaseOrder}     onChange={v => setField("SaveDislogPurchaseOrder", v)} />
              <ToggleRow label="Stock Transfer A4 Printout"     value={form.StockTransferShowSaveDialog} onChange={v => setField("StockTransferShowSaveDialog", v)} />
            </Section>
          )}

          {/* ── 4. Setting 8 ── */}
          {activeTab === 4 && (
            <Section title="Setting 8 (Common Company / Batch)">
              <ToggleRow label="Common Company"                          value={form.CommonCompany}              onChange={v => setField("CommonCompany", v)} />
              <ToggleRow label="Common Company Diff Stock"               value={form.CommonCompanyDiffStock}     onChange={v => setField("CommonCompanyDiffStock", v)} />
              <ToggleRow label="Customer Common"                         value={form.CustomerCommonCompany}      onChange={v => setField("CustomerCommonCompany", v)} />
              <ToggleRow label="Supplier Common"                         value={form.SupplierCommonCompany}      onChange={v => setField("SupplierCommonCompany", v)} />
              <ToggleRow label="Customer Common Balance"                 value={form.CustomerCommonCompanyCommonBalance} onChange={v => setField("CustomerCommonCompanyCommonBalance", v)} />
              <ToggleRow label="Supplier Common Balance"                 value={form.SupplierCommonCompanyCommonBalance} onChange={v => setField("SupplierCommonCompanyCommonBalance", v)} />
              <ToggleRow label="Batch-wise Purchase / Sales"             value={form.BatchWiseStock}             onChange={v => setField("BatchWiseStock", v)} />
              <ToggleRow label="Estimate Billing"                        value={form.EstimateBilling}            onChange={v => setField("EstimateBilling", v)} />
              <ToggleRow label="Rice UOM / Multiple UOM Billing"         value={form.MultipleUOMBilling}         onChange={v => setField("MultipleUOMBilling", v)} />
              <ToggleRow label="Textiles Serial No-wise Billing"        value={form.TextilesSerialNowiseBilling} onChange={v => setField("TextilesSerialNowiseBilling", v)} />
              <ToggleRow label="Always Batch Created All Item"          value={form.AlwaysBatchCreatedAllItem}  onChange={v => setField("AlwaysBatchCreatedAllItem", v)} />
              <ToggleRow label="Silver Mart"                             value={form.SilverMart}                 onChange={v => setField("SilverMart", v)} />
              <Row label="Batch No Prefix">
                <input className={inp} value={form.BatchNoPerfix} onChange={e => setField("BatchNoPerfix", e.target.value)} />
              </Row>
              <Row label="Batch No Digit">
                <input className={inp} value={form.BatchNoDigit} onChange={e => setField("BatchNoDigit", e.target.value)} />
              </Row>
              <Row label="Silver Rate">
                <input className={inp} value={form.SilverRate} onChange={e => setField("SilverRate", e.target.value)} />
              </Row>
              <Row label="Main Wallet">
                <input className={inp} value={form.MainWallet} onChange={e => setField("MainWallet", e.target.value)} />
              </Row>
              <Row label="TCS %">
                <input className={inp} value={form.tcsper} onChange={e => setField("tcsper", e.target.value)} />
              </Row>
            </Section>
          )}

          {/* ── 5. Setting 10 ── */}
          {activeTab === 5 && (
            <Section title="Setting 10">
              <Row label="UOM Qty Name (NomsQtyName)">
                <input className={inp} value={form.NomsQtyName} onChange={e => setField("NomsQtyName", e.target.value)} />
              </Row>
              <Row label="Batch No Name">
                <input className={inp} value={form.BatchNoName} onChange={e => setField("BatchNoName", e.target.value)} />
              </Row>
            </Section>
          )}

          {/* ── 6. Input Details ── */}
          {activeTab === 6 && (
            <Section title="Input Details">
              <ToggleRow label="PO No"          value={form.PONo}           onChange={v => setField("PONo", v)} />
              <ToggleRow label="PO Date"        value={form.PODate}         onChange={v => setField("PODate", v)} />
              <ToggleRow label="DC No"          value={form.DCNo}           onChange={v => setField("DCNo", v)} />
              <ToggleRow label="DC Date"        value={form.DCDate}         onChange={v => setField("DCDate", v)} />
              <ToggleRow label="LR No"          value={form.LRNo}           onChange={v => setField("LRNo", v)} />
              <ToggleRow label="LR Date"        value={form.LRDate}         onChange={v => setField("LRDate", v)} />
              <ToggleRow label="Vehicle No"     value={form.VehicleNo}      onChange={v => setField("VehicleNo", v)} />
              <ToggleRow label="Transport Name" value={form.TransportName}  onChange={v => setField("TransportName", v)} />
              <ToggleRow label="Through"        value={form.Through}        onChange={v => setField("Through", v)} />
              <ToggleRow label="Courier Name"   value={form.CourierName}    onChange={v => setField("CourierName", v)} />
              <ToggleRow label="Courier No"     value={form.CourierNo}      onChange={v => setField("CourierNo", v)} />
              <ToggleRow label="Driver Name"    value={form.DriverName}     onChange={v => setField("DriverName", v)} />
              <ToggleRow label="Bill Sale Type" value={form.BillSaleType}   onChange={v => setField("BillSaleType", v)} />
              <ToggleRow label="Working Date"   value={form.WorkingDate}    onChange={v => setField("WorkingDate", v)} />
            </Section>
          )}

          {/* ── 7. Profit / Misc ── */}
          {activeTab === 7 && (
            <Section title="Profit / Miscellaneous">
              <ToggleRow label="Purchase Profit Sale Rate Change" value={form.PurchaseProfitSaleRateChange} onChange={v => setField("PurchaseProfitSaleRateChange", v)} />
              <ToggleRow label="Profit Roundoff"                  value={form.ProfitRoundoff}                onChange={v => setField("ProfitRoundoff", v)} />
              <ToggleRow label="Profit Markdown"                  value={form.ProfitMarkDown}                onChange={v => setField("ProfitMarkDown", v)} />
              <ToggleRow label="Product Name Keypress"            value={form.ProductNameKeyPress}           onChange={v => setField("ProductNameKeyPress", v)} />
              <ToggleRow label="Univercell"                       value={form.univercell}                    onChange={v => setField("univercell", v)} />
              <ToggleRow label="Billing Stock No Need"            value={form.BillingStockNoNeed}            onChange={v => setField("BillingStockNoNeed", v)} />
              <ToggleRow label="Manual Bill No"                   value={form.ManualBillNo}                  onChange={v => setField("ManualBillNo", v)} />
            </Section>
          )}

          {/* ── 8. Mobile App ── */}
          {activeTab === 8 && (
            <Section title="Mobile App">
              <Row label="Billing Screen">
                <select className={sel} value={form.MobileBillingScreen} onChange={e => setField("MobileBillingScreen", e.target.value)}>
                  {BILL_SCREEN_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </Row>
              <Row label="Send WhatsApp">
                <select className={sel} value={form.Mobile_SendWhatsapp} onChange={e => setField("Mobile_SendWhatsapp", e.target.value)}>
                  {WHATSAPP_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </Row>
              <ToggleRow label="Bill Print Yes/No"        value={form.MobilePrint_YesNo}                   onChange={v => setField("MobilePrint_YesNo", v)} />
              <ToggleRow label="Bill Amount Bold"         value={form.MobilePrint_TotalBold}               onChange={v => setField("MobilePrint_TotalBold", v)} />
              <ToggleRow label="Cashier Name"             value={form.MobilePrint_CashierName}             onChange={v => setField("MobilePrint_CashierName", v)} />
              <ToggleRow label="GST Details"              value={form.MobilePrint_GSTDetails}              onChange={v => setField("MobilePrint_GSTDetails", v)} />
              <ToggleRow label="Closing Balance"          value={form.MobilePrint_ClosingBalance}          onChange={v => setField("MobilePrint_ClosingBalance", v)} />
              <ToggleRow label="Cash Tender"              value={form.MobilePrint_CashTender}              onChange={v => setField("MobilePrint_CashTender", v)} />
              <ToggleRow label="Total Qty"                value={form.MobilePrint_TotalQty}                onChange={v => setField("MobilePrint_TotalQty", v)} />
              <ToggleRow label="Description Double Line"  value={form.MobilePrint_DescriptionDoubleLine}   onChange={v => setField("MobilePrint_DescriptionDoubleLine", v)} />
              <ToggleRow label="MRP Print"                value={form.MobilePrint_MRP}                     onChange={v => setField("MobilePrint_MRP", v)} />
              <ToggleRow label="Company Bold"             value={form.MobilePrint_CompanyBold}             onChange={v => setField("MobilePrint_CompanyBold", v)} />
              <ToggleRow label="Print - 2 Inch"           value={form.MobilePrint2Inch}                    onChange={v => setField("MobilePrint2Inch", v)} />
              <ToggleRow label="Print - 3 Inch"           value={form.MobilePrint3Inch}                    onChange={v => setField("MobilePrint3Inch", v)} />
            </Section>
          )}

          {/* ── 9. Setting 12 ── */}
          {activeTab === 9 && (
            <Section title="Setting 12">
              <ToggleRow label="Customer Multiple Allow" value={form.CustomerMulitipleAllow} onChange={v => setField("CustomerMulitipleAllow", v)} />
              <ToggleRow label="Supplier Multiple Allow" value={form.SupplierMulitipleAllow} onChange={v => setField("SupplierMulitipleAllow", v)} />
            </Section>
          )}

        </div>{/* end mp-grid-wrap */}

        <div className="mp-hint">
          <kbd>F1</kbd> Save &nbsp;|&nbsp;
          <kbd>Esc</kbd> Back to Home
        </div>
      </div>{/* end mp-body */}

      {/* ── Loading overlay ── */}
      {loading && (
        <div className="mp-loader-ov">
          <div className="mp-ldr-box">
            <div className="mp-spin" />
            <div className="mp-ldr-msg">Processing...</div>
          </div>
        </div>
      )}

      {/* ── Confirm modal (MSG hook) ── */}
      {ConfirmUI}

      {/* ── Toast notifications (MSG hook) ── */}
      <MSG.ToastList toasts={toasts} />
    </div>
  );
}

// ── Small layout helpers ────────────────────────────────────────────────────
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
        width: 240, flexShrink: 0,
        fontSize: 12, color: "#4a5568", fontWeight: 500, textAlign: "right",
      }}>
        {label}:
      </label>
      <div style={{ flex: 1, maxWidth: 380 }}>{children}</div>
    </div>
  );
}

// ── Toggle switch (replaces jqxSwitchButton) ────────────────────────────────
function ToggleRow({ label, value, onChange }) {
  return (
    <Row label={label}>
      <button
        type="button"
        onClick={() => onChange(!value)}
        style={{
          width: 90, height: 27, borderRadius: 14, border: "1px solid #d4dbe8",
          background: value ? "#1a2e4a" : "#e6e9ef",
          position: "relative", cursor: "pointer", transition: "background .15s",
          padding: 0,
        }}
        aria-pressed={value}
      >
        <span style={{
          position: "absolute", top: 2, left: value ? 64 : 2,
          width: 23, height: 21, borderRadius: "50%", background: "#fff",
          boxShadow: "0 1px 2px rgba(0,0,0,.3)", transition: "left .15s",
        }} />
        <span style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          display: "flex", alignItems: "center",
          justifyContent: value ? "flex-start" : "flex-end",
          padding: "0 8px", fontSize: 10, fontWeight: 700,
          color: value ? "#fff" : "#4a5568",
        }}>
          {value ? "Yes" : "No"}
        </span>
      </button>
    </Row>
  );
}

// ── Tab styles ───────────────────────────────────────────────────────────────
const tabBarStyle = {
  display: "flex", flexWrap: "wrap", gap: 4,
  background: "#fff", border: "1px solid #d4dbe8",
  borderRadius: 6, padding: "6px 8px",
};

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
  border: "1px solid #1a2e4a",
};