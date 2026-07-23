// ─────────────────────────────────────────────────────────────────────────────
//  Common.jsx  (CashierCommon)
//  Shared utilities, API helpers, hooks, and UI components
//  used across all Cashier/Master pages.
//
//  CHANGELOG:
//  • Added TransactionPassword API endpoint constants
//  • Added editPassword() centralised helper
//    → removes all try/catch + fetch boilerplate from TransactionPassword.jsx
//  • Added RateChange API endpoint constants
//    → RateChangeSelect, RateChangeUpdate, RateChangeItemSelect, RateChangeItemByCode
//  • MERGED: combined report-combo-loader hook (useReportCombos) with
//    Area master endpoints + production BASE_URL from the two source copies.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";

// ─── 1. LOCAL-STORAGE HELPERS ─────────────────────────────────────────────────
export const getStr   = (k) => localStorage.getItem(k) || "";
export const getLocal = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

// ─── 2. BASE URL ──────────────────────────────────────────────────────────────
export const BASE_URL = "https://billing.kassapos.co.in";
//export const BASE_URL = "http://localhost:64215";
//export const BASE_URL = "https://billing.kassapos.co.in";
// ─── 3. CASHIER API ENDPOINT CONSTANTS ───────────────────────────────────────
export const CashierSelect = "/api/CashierApp/SelectCashier";
export const CashierInsert = "/api/CashierApp/InsertCashier";
export const CashierDelete = "/api/CashierApp/DeleteCashier";
export const SelectCounter = "/api/CashierApp/SelectCounter_local";


// Add these to section 5 (or the relevant API section) in Common.jsx
export const ASelectCompanySetting = "/api/loginApp/SelectCompanySetting";
export const UpdateCompanySetting  = "/api/loginApp/UpdateCompanySetting";
export const ScriptUpdate          = "/api/loginApp/UpdateScript"; // Assuming this exists based on your code
// ─── 4. TRANSACTION PASSWORD API ENDPOINT CONSTANTS ──────────────────────────
export const TxnSelectPassword = "/api/LoginApp/SelectTransactionPassword";
export const TxnUpdatePassword = "/api/LoginApp/UpdateTransactionPassword";
export const TxnEditPassword   = "/api/LoginApp/EditPassword";

// ─── Department ───────────────────────────────────────────────────────────────
export const DepartmentSelect = "/api/DepartmentApp/SelectDepartment";
export const DepartmentInsert = "/api/DepartmentApp/InsertDepartment";
export const DepartmentDelete = "/api/DepartmentApp/DeleteDepartment";

// ─── 5. REPACKING MASTER API ENDPOINT CONSTANTS ───────────────────────────────
export const RepackingMaxNo      = "/api/RepackingMasterApp/MaxRepackingNo";
export const RepackingInsert     = "/api/RepackingMasterApp/InsertRepackingMaster";
export const RepackingDelete     = "/api/RepackingMasterApp/DeleteRepackingMaster";
export const RepackingEdit       = "/api/RepackingMasterApp/EditRepackingMaster";
export const RepackingSelect     = "/api/RepackingMasterApp/SelectRepackingMaster";
export const RepackingCombo      = "/api/RepackingMasterApp/RepackingItemMaster";
export const ItemByCode          = "/api/ItemMasterApp/SelectItemMasterbyCodeId";
export const RepackingEditPwd    = "/api/LoginApp/EditPassword";

// ─── Brand Master ─────────────────────────────────────────────────────────────
export const BrandSelect = "/api/BrandApp/SelectBrand";
export const BrandInsert = "/api/BrandApp/InsertBrand";
export const BrandDelete = "/api/BrandApp/DeleteBrand";


// ─────────────────────────────────────────────────────────────────────────────
//  ADD THESE CONSTANTS TO YOUR EXISTING Common.jsx
//  Place after the existing CashierDelete line
// ─────────────────────────────────────────────────────────────────────────────
export const CategorySelect = "/api/CategoryApp/SelectCategory";
export const ItemSelect = "/api/ItemMasterApp/SelectItemMaster";
// ─── SALE API CONSTANTS ───────────────────────────────────────────────────────
 // adjust to your actual endpoint

// ─── ITEM MASTER (for product search in grid) ────────────────────────────────
export const SelectItemMasterbyId = "/api/ItemMasterApp/SelectItemMasterbyCodeId";
export const SelectExpDate        = "/api/ItemMasterApp/SelectExpStock";

// ─── CUSTOMER / SUPPLIER ─────────────────────────────────────────────────────
export const GetSupplierAll       = "/api/SupplierApp/SelectSupplierAll";   // AccountType=CUSTOMER or SUPPLIER
export const GetSupplier          = "/api/SupplierApp/SelectSupplierAll_v7";
export const CurrentBalance       = "/api/SupplierApp/CurrentBalance";
export const SelectCustomerSaleRate = "/api/SupplierApp/InsertCustomerSaleRate"; // CustomerwiseSaleRate

// ─── SALESMAN ────────────────────────────────────────────────────────────────
export const SalesManSelectV7     = "/api/SalesManApp/SelectSalesMan_V7";

// ─── CARD MASTER (Payment Types) ─────────────────────────────────────────────

export const SelectSaleType       = "/api/SaleApp/SelectSaleType";  // alias


// ─── CRM ─────────────────────────────────────────────────────────────────────
export const CRMBalance           = "/api/SalesReportApp/CRMBalanceReport";

// ─── LOGIN PASSWORD (for F6 Edit / F9 Delete password) ───────────────────────
export const LoginPasswordUrl     = "/api/LoginApp/EditPassword";

        //BankApp
        //public static string BankMaxNo = "/CashApp/MaxAdjustmentNo";
        export const BankDateSelect = "/api/BankApp/SelectBankDate";
        export const BankAllSelect = "/api/BankApp/SelectBankList";
        export const BankSelect = "/api/BankApp/SelectBank";
        export const BankInsert = "/api/BankApp/InsertBank";
        export const BankDelete = "/api/BankApp/DeleteBank";

        //CardMasterApp
        export const InsertCardMaster = "/api/CardMasterApp/InsertCardMaster";
        export const SelectCardMaster = "/api/CardMasterApp/SelectCardMaster";
        export const DeleteCardMaster = "/api/CardMasterApp/DeleteCardMaster";

        //AccountGroupApp
        export const SelectAccountGroup = "/api/AccountGroupApp/SelectAccountGroup";
        export const InsertAccountGroup = "/api/AccountGroupApp/InsertAccountGroup";
        export const DeleteAccountGroup = "/api/AccountGroupApp/DeleteAccountGroup";
        //UOM
        export const UOMSelect = "/api/UOMApp/SelectUOM";
        export const UOMInsert = "/api/UOMApp/InsertUOM";
        export const UOMDelete = "/api/UOMApp/DeleteUOM";


        //PattyMaster
          //PattyMaster
        export const PattySelect = "/api/PattyMasterApp/SelectPatty";
        export const PattyInsert = "/api/PattyMasterApp/InsertPatty";
        export const PattyDelete = "/api/PattyMasterApp/DeletePatty";
        export const selectArrival = "/api/PattyMasterApp/SelectArrival";
        export const SelectPattyPrint = "/api/PattyMasterApp/SelectPattyPrint";
        export const updatepattyprint = "/api/PattyMasterApp/updatepattyprint";
        export const OpeningBalanceUpdatePatty = "/api/PattyMasterApp/OpeningBalanceUpdatePatty";
        export const SelectCreditSale = "/api/SaleApp/SelectCreditSale";
        export const SelectLotNoDetails = "/api/SaleApp/SelectLotNoDetailsV7";


  //Salesman
  export const SalesManSelect = "/api/SalesManApp/SelectSalesMan"; 
  export const SalesManInsert = "/api/SalesManApp/InsertSalesMan";
  export const SalesManDelete = "/api/SalesManApp/DeleteSalesMan";
 

// ─── SALE API CONSTANTS ───────────────────────────────────────────────────────
export const SaleMaxNo           = "/api/SaleApp/MaxSaleNo";
export const SaleInsertUrl       = "/api/SaleApp/InsertSale";
export const SaleEditUrl         = "/api/SaleApp/EditSale";
export const SaleSelectUrl       = "/api/SaleApp/SelectSaleV7";
export const SaleDeleteUrl       = "/api/SaleApp/DeleteSale";
export const BillHoldSelectUrl   = "/api/SaleApp/BillHoldName";
export const BillHoldInsertUrl   = "/api/SaleApp/BillHold";
export const BillUnHoldUrl       = "/api/SaleApp/BillUnHold";
export const BillHoldDeleteUrl   = "/api/SaleApp/BillHoldDelete";
export const SelectCardMasterUrl = "/api/SaleApp/SelectSaleType";
export const A4PrintUrl          = "/Sale/A4Print";

export const SB_COLUMNS = [
  { key: "SalesManCode",    label: "SM Code",       width: 140, hidden: true,  type: "smcode" },
  { key: "ProductCode",     label: "Product Code",  width: 130, hidden: false },
  { key: "ProductName",     label: "Description",   width: 240, hidden: false, readOnly: true },
  { key: "MRP",             label: "MRP",           width: 90,  hidden: true,  readOnly: true, type: "float" },
  { key: "SaleRate",        label: "Sale Rate",     width: 100, hidden: false, type: "float" },
  { key: "ItemQty",         label: "Qty",           width: 80,  hidden: false, type: "float" },
  { key: "DiscountPercent", label: "Disc%",         width: 75,  hidden: false, type: "float" },
  { key: "CDPercent",       label: "CD%",           width: 75,  hidden: true,  type: "float" },
  { key: "TaxPercent",      label: "GST%",          width: 75,  hidden: false, type: "float" },
  { key: "CESSPer",         label: "CESS%",         width: 75,  hidden: true,  type: "float" },
  { key: "TaxAmt",          label: "GST Amt",       width: 90,  hidden: true,  type: "float" },
  { key: "CESSAmount",      label: "CESS Amt",      width: 90,  hidden: true,  type: "float" },
  { key: "SPLCESS",         label: "SPL CESS",      width: 80,  hidden: true,  type: "float" },
  { key: "SPLCESSAmount",   label: "SPL CESS Amt",  width: 100, hidden: true,  type: "float" },
  { key: "DiscountAmt",     label: "Disc Amt",      width: 90,  hidden: true,  type: "float" },
  { key: "CDAmount",        label: "CD Amt",        width: 90,  hidden: true,  type: "float" },
  { key: "LandingCost",     label: "Landing Cost",  width: 100, hidden: true,  type: "float" },
  { key: "UOM",             label: "UOM",           width: 70,  hidden: true,  readOnly: true },
  { key: "HSNCode",         label: "HSN Code",      width: 100, hidden: true,  readOnly: true },
  { key: "Bat_No",          label: "Batch No",      width: 100, hidden: true },
  { key: "FreeQty",         label: "Free Qty",      width: 80,  hidden: true,  type: "int" },
  { key: "Remarks",         label: "Remarks",       width: 130, hidden: true },
  { key: "Amount",          label: "Amount",        width: 100, hidden: false, readOnly: true, type: "float" },
];

export const SB_DEFAULT_COL_SETTINGS = SB_COLUMNS.map(c => ({
  key:     c.key,
  label:   c.label,
  width:   c.width,
  visible: !c.hidden,
}));

// ─── SALE ORDER API CONSTANTS ────────────────────────────────────────────────
export const SaleOrderMaxNo      = "/api/SaleOrderApp/MaxSaleOrderNo";
export const SaleOrderInsertUrl  = "/api/SaleOrderApp/InsertSaleOrder";
export const SaleOrderEditUrl    = "/api/SaleOrderApp/EditSaleOrder";
export const SaleOrderSelectUrl  = "/api/SaleOrderApp/SelectSaleOrder";
export const SaleOrderDeleteUrl  = "/api/SaleOrderApp/DeleteSaleOrder";
export const SO_SelectItemByCodeUrl = "/api/ItemMasterApp/SelectItemMasterbyCodeId";
export const SO_ProductListUrl      = "/api/ItemMasterApp/GetProductListV7";
export const SO_GetCustomerUrl      = "/api/SupplierApp/SelectSupplierAll";
export const SO_SalesManSelectUrl   = "/api/SalesManApp/SelectSalesMan_V7";
export const SO_LoginPasswordUrl    = "/api/loginApp/EditPassword";
export const SO_VisibleColumnsUrl   = "api/loginApp/VisibleColumns";
export const SO_FocusColumnsUrl     = "/api/loginApp/FocusColumns";
export const SO_CurrentStockUrl     = "/api/ItemMasterApp/Currentstock";
export const SO_CRMBalanceUrl       = "/api/SalesReportApp/CRMBalanceReport";
export const SO_CurrentBalanceUrl   = "/api/SupplierApp/CurrentBalance";

export const F5SelectUrl         = "/api/SaleApp/SelectSale";
export const FocusColumnsUrl     = "/Login/FocusColumns";
export const GetFocusColumnsUrl     ="/api/loginApp/GetFocusColumns";
export const SelectExpiryByIdUrl = "/api/ItemMasterApp/SelectExpStock"; 

          // ─── Supplier Master API Links ────────────────────────────────────────────────
export const SupplierMasterSelect = "/api/SupplierApp/SelectSupplier";
export const SupplierMasterInsert = "/api/SupplierApp/InsertSupplier";
export const SupplierMasterDelete = "/api/SupplierApp/DeleteSupplier";


// export const SupplierMasterSelect = "/api/Login/SelectMainSetting";
// export const SupplierMasterInsert = "/api/Login/UpdateMainSetting;
// export const SupplierMasterDelete = "/api/SupplierApp/DeleteSupplier";

  //SizeMaster

  export const SizeSelect = "/api/SizeMasterApp/SelectSizeMaster";
  export const SizeInsert = "/api/SizeMasterApp/InsertSizeMaster";
  export const SizeDelete = "/api/SizeMasterApp/DeleteSizeMaster";
 
  //ColorMaster
  export const SelectColor = "/api/ColorMasterApp/SelectColorMaster";
  export const InsertColor = "/api/ColorMasterApp/InsertColorMaster";
  export const DeleteColor = "/api/ColorMasterApp/DeleteColorMaster";
 
// ─── Model Master ─────────────────────────────────────────────────────────────
export const SelectModel = "/api/ModelMasterApp/SelectModelMaster";
export const InsertModel = "/api/ModelMasterApp/InsertModelMaster";
export const DeleteModel = "/api/ModelMasterApp/DeleteModelMaster";

// ─── Cash Voucher API endpoints ──────────────────────────────────────────────
export const CV_Insert     = "/api/CashApp/InsertCash";
export const CV_SelectDate = "/api/CashApp/SelectCashDate";
export const CV_Select     = "/api/CashApp/SelectCash";
export const CV_Delete     = "/api/CashApp/DeleteCash";

   //CustomerCardType
        export const CustomerCardTypeSelect = "/api/CustomerCardTypeApp/SelectCustomerCardType";
        export const CustomerCardTypeInsert = "/api/CustomerCardTypeApp/InsertCustomerCardType";
        export const CustomerCardTypeDelete = "/api/CustomerCardTypeApp/DeleteCustomerCardType";
 //CRMPointsApp
        export const CRMPointsSelect = "/api/CRMPointsApp/SelectCRMPoints";
        export const CRMPointsInsert = "/api/CRMPointsApp/InsertCRMPoints";
        export const CRMPointsDelete = "/api/CRMPointsApp/DeleteCRMPoints";
  //purchases

  export const MaxPurchaseNo = "/api/PurchaseApp/MaxPurchaseNo";
  export const SupplierList = "/api/SupplierApp/SelectSupplierAll";
  export const SupplierById = "/api/SupplierApp/SupplierById";
  export const GetProductListV7 = "/api/ItemMasterApp/GetProductListV7";
  export const InsertPurchase = "/api/PurchaseApp/InsertPurchase";
  export const EditPurchase = "/api/PurchaseApp/EditPurchase";
  export const EditPassword = "/api/loginApp/EditPassword";
  export const DeletePurchase = "/api/PurchaseApp/DeletePurchase";
  export const PurchaseList = "/api/PurchaseApp/PurchaseList";
  export const SelectPurchase = "/api/PurchaseApp/SelectPurchaseV7";
  export const FocusColumns = "/api/loginApp/FocusColumns";
export const VisibleColumnsUrl = "/api/loginApp/VisibleColumns";

// ─── PurchaseReturn API endpoints ────────────────────────────────────────────
export const PR_MaxNo        = "/api/PurchaseReturnApp/MaxPurchaseReturnNo";
export const PR_Insert       = "/api/PurchaseReturnApp/InsertPurchaseReturn";
export const PR_Edit         = "/api/PurchaseReturnApp/EditPurchaseReturn";
export const PR_Delete       = "/api/PurchaseReturnApp/DeletePurchaseReturn";
export const PR_LoadPM       = "/api/PurchaseReturnApp/PurchaseReturnLoadPM";
export const PR_LoadPD       = "/api/PurchaseReturnApp/PurchaseReturnLoadPD";
export const PR_F5View       = "/api/PurchaseReturnApp/SelectPurchaseReturnV7";
export const PR_PrintView    = "/api/PurchaseReturnApp/PrintView";
export const PR_EditPassword = "/api/loginApp/EditPassword";
export const PR_VisibleCols  = "/api/loginApp/VisibleColumns";
export const PR_FocusCols    = "/api/loginApp/FocusColumns";
export const PR_SupplierAll  = "/api/SupplierApp/SelectSupplierAll";
export const PR_CurBalance   = "/api/SupplierApp/CurrentBalance";
export const PR_ItemByCode   = "/api/ItemMasterApp/SelectItemMasterbyCodeId";
export const PR_ProductList  = "/api/ItemMasterApp/GetProductListV7";


// ─── Supplier Payment API endpoints ──────────────────────────────────────────
export const SelectSupplierPaymentDate = "/api/SupplierPaymentApp/SelectSupplierPaymentDate";
export const InsertSupplierPayment     = "/api/SupplierPaymentApp/InsertSupplierPayment";
export const DeleteSupplierPayment     = "/api/SupplierPaymentApp/DeleteSupplierPayment";
export const SelectSupplierPaymentF5   = "/api/SupplierPaymentApp/SelectSupplierPayment";
export const SupplierPendingReport     = "/api/PurchaseReportApp/SupplierPendingReport";
 
// ─────────────────────────────────────────────────────────────────────────────
//  Quotation API Constants
//  All endpoints used by Qutation.jsx, replacing the original jQuery $.ajax URLs
// ─────────────────────────────────────────────────────────────────────────────

export const QuotationMaxNo        = "/Quotation/MaxQuotationNo";
export const QuotationInsertUrl    = "/Quotation/InsertQuotation";
export const QuotationEditUrl      = "/Quotation/EditQuotation";
export const QuotationSelectUrl    = "/Quotation/SelectQuotation";
export const QuotationDeleteUrl    = "/Quotation/DeleteQuotation";

export const QA_SelectItemByCodeUrl   = "/ItemMaster/SelectItemMasterbyCodeId";
export const SelectItemByIdSaleUrl = "/ItemMaster/SelectItemMasterbyIdSale";
export const CurrentStockUrl       = "/ItemMaster/Currentstock";
export const QA_ProductListUrl        = "/ItemMaster/GetProductListV7";

export const QA_GetCustomerUrl        = "/Customer/SelectCustomerAll";
export const QA_SalesManSelectUrl     = "/SalesMan/SelectSalesMan_V7";

export const QA_LoginPasswordUrl      = "/Login/EditPassword";
export const QA_VisibleColumnsUrl     = "/Login/VisibleColumns";
export const QA_FocusColumnsUrl       = "/Login/FocusColumns";

export const VisibleColumnsCfgUrl  = (mcomid) =>
  `/Content/Appdata/Visible/${mcomid}/Quotation.json`;
export const FocusColumnsCfgUrl    = (mcomid) =>
  `/Content/Appdata/Visible/${mcomid}/QuotationFocus.json`;
export const FormFocusCfgUrl       = (mcomid) =>
  `/Content/Appdata/Visible/${mcomid}/QuotationFormFocus.json`;

export const SelectMenuMaster = "/api/loginApp/SelectMenuMaster";
// NOTE: the two source copies disagreed here — one had "UpdateMenuMaster_BM",
// the other plain "UpdateMenuMaster". Kept the plain (newer-looking) version;
// confirm against your backend route before relying on this.
export const UpdateMenuMaster = "/api/loginApp/UpdateMenuMaster";


export const SelectUserMenuDetails = "/api/loginApp/SelectUserMenuDetails"; 
export const SelectUserPassword= "/api/loginApp/SelectUserPassword"; 
export const SelectUserMenuHeading= "/api/loginApp/SelectUserMenuHeading";
export const UpdateMenuList = "/api/loginApp/UpdateMenuList";
export const UpdateMenuReport = "/api/loginApp/UpdateMenuReport";
// ─── Report viewer base path (add once if not already present) ───────────────
//  Used by openVoucherPrint() in SupplierPayment.jsx and CustomerReceipt.jsx
export const ReportViewerBase = "../Reports/ReportViewer.aspx";
 
// ─── PrintView URL (add once if not already present) ─────────────────────────
//  Used by doPrintView() in SupplierPayment.jsx and CustomerReceipt.jsx
export const PrintViewUrl = "/api/PaymentApp/PrintView";
// ─── 6. AUTH HEADERS (token + user identity) ──────────────────────────────────
export const authHeaders = () => ({
  "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
  "Userid":        localStorage.getItem("userid")     || "0",
  "Profile":       localStorage.getItem("Profile")    || "Admin",
  "LoginCheck":    localStorage.getItem("LoginCheck") || "1",
});
export const loadSalesmanData = async (MComid) => {
  try {
    const res = await fetch(
      mkUrl(SalesManSelect) + `?Comid=${Number(MComid)}`,
      { method: "POST", headers: authHeaders() }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data)       ? data
         : Array.isArray(data.data)  ? data.data
         : Array.isArray(data.Data1) ? data.Data1
         : [];
  } catch (e) {
    console.error("loadSalesmanData error:", e);
    return [];
  }
};
export const ValNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
export const NullToString = (v) => (v == null ? "" : String(v));

// ─── 6. URL BUILDER ───────────────────────────────────────────────────────────
//  All fetch calls must go through mkUrl so BASE_URL is always prepended.
//  No component should concatenate BASE_URL itself.
export const mkUrl = (path) => BASE_URL + path;

// ─── 7. SESSION / COMPANY VARIABLES ──────────────────────────────────────────
/**
 * Call once per page (inside useState initialiser).
 * @param {string} pageName  - must match the PageName stored in "menulist"
 * @returns {{ Comid, MComid, IdComList, MirrorTable, menudata }}
 */
// ─── 8. API HELPERS ───────────────────────────────────────────────────────────
export const buildSession = (pageName) => {
  try {
    const main0       = (getLocal("Mainsetting") || [{}])[0] || {};
        const com0  = (getLocal("Companysetting") || [{}])[0] || {};
    const Comid       = getStr("Comid")    || "1";
    const MComid      = getStr("MComid")   || Comid;
    const IdComList   = getStr("IdComList") || Comid;
    const MirrorTable = getStr("MirrorTableOnline") || "0";
    return {
      Comid:    main0.CommonCompany ? MComid : Comid,
      MComid,
      IdComList,
      MirrorTable,
      menudata: (getLocal("menulist") || []).filter(o => o.PageName === pageName),

      // ── Purchase-specific settings from Mainsetting ──
      BatchWiseStock:            String(main0.BatchWiseStock            ?? 0),
      
      TextilesSerialNowiseBilling: String(main0.TextilesSerialNowiseBilling ?? false),
      PurchaseItemmasterSave:        String(main0.PurchaseItemmasterSave        ?? false),
      ItemMasterRateUpdate:        String(main0.ItemMasterRateUpdate        ?? false),
      Commoncompany:                String(main0.CommonCompany              ?? false),
      CommoncompanyDiffStock:       String(main0.CommonCompanyDiffStock      ?? false),
      SupplierMulitipleAllow:       String(main0.SupplierMulitipleAllow      ?? false),
      MulipleMRP:                   String(com0.MultiMRP                 ?? false),
      CMBTPatty:                      String(main0.CMBTPatty                  ?? false),
      MultipleUOMBilling       : String(main0.MultipleUOMBilling          ?? false),
      BatchPerfix:                  String(main0.BatchPerfix                ?? ""),
      BatchDigit:                   String(main0.BatchNoDigit               ?? 0),
      LocalDB:                      String(main0.LocalDB                    ?? 0),
    };
  } catch {
    return { Comid: "1", MComid: "1", IdComList: "1", MirrorTable: "0", menudata: [],
             batchstockstatus: "0", TextilesSerialNowiseBilling: "false",
             ItemMasterRateUpdate: "false",
             Commoncompany: "false", CommoncompanyDiffStock: "false",
             SupplierMulitipleAllow: "false", MulipleMRP: "false",
             BatchPerfix: "", BatchDigit: "0", LocalDB: "0" };
  }
};
/**
 * api()
 * General-purpose POST (with optional query-string params).
 * Normalises IsSuccess → ok, Data1 → data, Message → message.
 * Handles 406 / 404 / 500 / empty-response / JSON-parse errors centrally.
 *
 * Usage: await CC.api(path, bodyObject, extraHeaders?, queryParams?)
 */
export const api = async (path, body = null, extraHeaders = {}, queryParams = null) => {
  try {
    let fullUrl = mkUrl(path);

    if (queryParams && typeof queryParams === "object") {
      const qs = new URLSearchParams(
        Object.entries(queryParams)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => [k, String(v)])
      ).toString();
      if (qs) fullUrl += "?" + qs;
    }

    const res = await fetch(fullUrl, {
     
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...authHeaders(),
        ...extraHeaders,
      },
      body: body !== null ? JSON.stringify(body) : undefined,
    });

    if (res.status === 406) {
      return { ok: false, _dualLogin: true };
    }
    if (res.status === 404) return { ok: false, _http404: true, message: `404: ${fullUrl}` };
    if (res.status === 500) {
      const t = await res.text();
      console.error(`500 on ${fullUrl}:`, t.slice(0, 500));
      return { ok: false, message: "Server error 500 — see console" };
    }

    const text = await res.text();
    if (!text.trim()) return { ok: false, message: "Empty response" };

    try {
      const j = JSON.parse(text);
      if (j.IsSuccess !== undefined && j.ok      === undefined) j.ok      = j.IsSuccess;
      if (j.Data1     !== undefined && j.data    === undefined) j.data    = j.Data1;
      if (j.Message   !== undefined && j.message === undefined) j.message = j.Message;
      return j;
    } catch { return { ok: false, message: text }; }

  } catch (err) {
    return { ok: false, _netErr: true, message: err.message };
  }
};

/**
 * insertapi()
 * Insert / update POST — returns raw parsed JSON (IsSuccess / Data2 conventions).
 * All auth headers, BASE_URL, JSON stringify, and network errors handled here.
 *
 * Usage: await CC.insertapi(path, bodyObject, extraHeaders?)
 */
export const insertapi = async (path, body = null, extraHeaders = {}) => {
  try {
    var b =JSON.stringify(body);
    const res = await fetch(mkUrl(path), {
   
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...authHeaders(),
        ...extraHeaders,
      },
      body: body != null ? JSON.stringify(body) : null,
    });

    if (res.status === 406) return { ok: false, _dualLogin: true };
    if (res.status === 500) {
      const t = await res.text();
      // Server returned HTML error page — extract meaningful message
      const match = t.match(/<i>(.*?)<\/i>/);
      const msg = match ? match[1] : (t.slice(0, 300));
      console.error("500 InsertAPI:", msg);
      return { ok: false, IsSuccess: false, Message: msg, message: msg };
    }

    const text = await res.text();
    if (!text.trim()) return { ok: false, IsSuccess: false, Message: "Empty response", message: "Empty response" };

    try {
      const j = JSON.parse(text);
      if (j.IsSuccess !== undefined && j.ok      === undefined) j.ok      = j.IsSuccess;
      if (j.Message   !== undefined && j.message === undefined) j.message = j.Message;
      return j;
    } catch {
      return { ok: false, IsSuccess: false, message: text.slice(0, 300) };
    }
  } catch (err) {
    return { ok: false, _netErr: true, message: err.message };
  }
};

/**
 * deleteapi()
 * Delete POST — identical contract to insertapi() but semantically labelled.
 * Returns raw parsed JSON; all auth headers and BASE_URL handled here.
 *
 * Usage: await CC.deleteapi(path, bodyObject, extraHeaders?)
 */
export const deleteapi = async (path, body = null, extraHeaders = {}) => {
  try {
    const res = await fetch(mkUrl(path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...authHeaders(),
        ...extraHeaders,
      },
      body: body != null ? JSON.stringify(body) : null,
    });
    const text = await res.text();
    return JSON.parse(text);
  } catch (err) {
    return { ok: false, message: err.message };
  }
};

/**
 * editPassword()
 * Dedicated helper for the Transaction Password verification modal.
 */
export const editPassword = async ({ password, type, Comid }) => {
  try {
    const qs = new URLSearchParams({
      password: String(password),
      type:     String(type),
      Comid:    String(Comid),
    }).toString();

    const res = await fetch(mkUrl(`${TxnEditPassword}?${qs}`), {
      method: "POST",
      headers: { ...authHeaders() },
    });

    if (res.status === 406) {
      alert("Already Login Another User Please Login Again!!!");
      return { ok: false, _dualLogin: true };
    }
    if (res.status === 404) return { ok: false, message: "API Not Found" };

    const text = await res.text();
    if (!text.trim()) return { ok: false, message: "Empty response" };

    try {
      const j = JSON.parse(text);
      if (j.IsSuccess !== undefined && j.ok      === undefined) j.ok      = j.IsSuccess;
      if (j.Message   !== undefined && j.message === undefined) j.message = j.Message;
      return j;
    } catch {
      return { ok: false, message: text };
    }
  } catch (err) {
    return { ok: false, message: err.message };
  }
};

/**
 * repackingEditPassword()
 * Centralised password-verification helper for RepackingMaster.
 */
export const repackingEditPassword = ({ password, type, Comid }) =>
  api(TxnEditPassword, null, {}, { password, type, Comid });

// ─── 8b. REPORT COMBO LOADER (shared across all Sales/Purchase Report pages) ──
/**
 * extractComboList() / toComboOption()
 * Normalises a CC.api() response into a flat array and then into
 * { value, label } options for <select>/combo components.
 */
export const extractComboList = (data) =>
  Array.isArray(data)          ? data
  : Array.isArray(data?.data)  ? data.data
  : Array.isArray(data?.Data1) ? data.Data1
  : [];

export const toComboOption = (row) => ({
  value: row.value ?? row.Code ?? row.Id ?? row.code ?? row.id ?? "",
  label: row.label ?? row.Name ?? row.name ?? row.Description ?? String(row.value ?? row.Code ?? row.Id ?? ""),
});

/**
 * useReportCombos()
 * Centralised Customer / Salesman / Cashier / Counter / SaleType combo loader.
 * Used by every *Report.jsx page instead of each page re-implementing its own
 * Promise.allSettled + extractList/toOption block.
 *
 * IMPORTANT: every request goes through CC.api(), so it always carries the
 * SAME auth headers (Authorization / Userid / Profile / LoginCheck) built by
 * authHeaders(). If the backend still answers 406, it means TokenVaildate()
 * rejected the session (stale/invalid token, or the same user logged in
 * elsewhere) — not a per-page header bug. This hook now detects that case
 * (_dualLogin) and redirects to Login instead of silently leaving the combos
 * empty, which is what was happening before.
 *
 * Usage:
 *   const { customerList, salesmanList, cashierList, counterList, saleTypeList } =
 *     CC.useReportCombos(pageAccess.ready && pageAccess.allowed, session.MComid, navigate);
 */
// export function useReportCombos(ready, MComid, navigate) {
//   const [customerList, setCustomerList] = useState([]);
//   const [salesmanList, setSalesmanList] = useState([]);
//   const [cashierList,  setCashierList]  = useState([]);
//   const [counterList,  setCounterList]  = useState([]);
//   const [saleTypeList, setSaleTypeList] = useState([]);

//   useEffect(() => {
//     if (!ready || !MComid) return;

//     (async () => {
//       const results = await Promise.allSettled([
//         api(GetSupplierAll,   null, {}, { AccountType: "CUSTOMER", Comid: MComid }),
//         api(SalesManSelectV7, null, {}, { Comid: MComid }),
//         api(CashierSelect,    null, {}, { Comid: MComid }),
//         api(SelectCounter,    null, {}, { Comid: MComid }),
//         api(SelectSaleType,   null, {}, { Comid: MComid }),
//       ]);

//       // api() never throws, so every promise resolves "fulfilled" even on 406/500 —
//       // check .value.ok / ._dualLogin explicitly instead of relying on status alone.
//       const dualLogin = results.some(r => r.status === "fulfilled" && r.value?._dualLogin);
//       if (dualLogin) {
//         alert("Already Login Another User Please Login Again!!!");
//         if (navigate) navigate("/Login/Index");
//         else window.location.href = "/Login/Index";
//         return;
//       }

//       const [customerRes, salesmanRes, cashierRes, counterRes, saleTypeRes] = results;

//       if (customerRes.status === "fulfilled" && customerRes.value.ok !== false) {
//         setCustomerList(extractComboList(customerRes.value).map(toComboOption));
//       }
//       if (salesmanRes.status === "fulfilled" && salesmanRes.value.ok !== false) {
//         setSalesmanList(extractComboList(salesmanRes.value).map(toComboOption));
//       }
//       if (cashierRes.status === "fulfilled" && cashierRes.value.ok !== false) {
//         setCashierList(extractComboList(cashierRes.value).map(toComboOption));
//       }
//       if (counterRes.status === "fulfilled" && counterRes.value.ok !== false) {
//         setCounterList(extractComboList(counterRes.value).map(toComboOption));
//       }
//       if (saleTypeRes.status === "fulfilled" && saleTypeRes.value.ok !== false) {
//         setSaleTypeList(extractComboList(saleTypeRes.value).map(toComboOption));
//       }
//     })();
//   }, [ready, MComid, navigate]);

//   return { customerList, salesmanList, cashierList, counterList, saleTypeList };
// }

// ─── 8b. REPORT COMBO LOADER (shared across all Sales/Purchase Report pages) ──
/**
 * extractComboList() / toComboOption()
 * Normalises a CC.api() response into a flat array and then into
 * { value, label } options for <select>/combo components.
 */
// export const extractComboList = (data) =>
//   Array.isArray(data)          ? data
//   : Array.isArray(data?.data)  ? data.data
//   : Array.isArray(data?.Data1) ? data.Data1
//   : [];

// export const toComboOption = (row) => ({
//   value: row.value ?? row.Code ?? row.Id ?? row.code ?? row.id ?? "",
//   label: row.label ?? row.Name ?? row.name ?? row.Description ?? String(row.value ?? row.Code ?? row.Id ?? ""),
// });

/**
 * useReportCombos()
 * Centralised Customer / Salesman / Cashier / Counter / SaleType combo loader.
 * Used by every *Report.jsx page instead of each page re-implementing its own
 * Promise.allSettled + extractList/toOption block.
 *
 * IMPORTANT: every request goes through CC.api(), so it always carries the
 * SAME auth headers (Authorization / Userid / Profile / LoginCheck) built by
 * authHeaders(). If the backend still answers 406, it means TokenVaildate()
 * rejected the session (stale/invalid token, or the same user logged in
 * elsewhere) — not a per-page header bug. This hook now detects that case
 * (_dualLogin) and redirects to Login instead of silently leaving the combos
 * empty, which is what was happening before.
 *
 * Usage:
 *   const { customerList, salesmanList, cashierList, counterList, saleTypeList } =
 *     CC.useReportCombos(pageAccess.ready && pageAccess.allowed, session.MComid, navigate);
 */
// export function useReportCombos(ready, MComid, navigate) {
//   const [customerList, setCustomerList] = useState([]);
//   const [salesmanList, setSalesmanList] = useState([]);
//   const [cashierList,  setCashierList]  = useState([]);
//   const [counterList,  setCounterList]  = useState([]);
//   const [saleTypeList, setSaleTypeList] = useState([]);

//   useEffect(() => {
//     if (!ready || !MComid) return;

//     (async () => {
//       const results = await Promise.allSettled([
//         api(GetSupplierAll,   null, {}, { AccountType: "CUSTOMER", Comid: MComid }),
//         api(SalesManSelectV7, null, {}, { Comid: MComid }),
//         api(CashierSelect,    null, {}, { Comid: MComid }),
//         api(SelectCounter,    null, {}, { Comid: MComid }),
//         api(SelectSaleType,   null, {}, { Comid: MComid }),
//       ]);

//       // api() never throws, so every promise resolves "fulfilled" even on 406/500 —
//       // check .value.ok / ._dualLogin explicitly instead of relying on status alone.
//       const dualLogin = results.some(r => r.status === "fulfilled" && r.value?._dualLogin);
//       if (dualLogin) {
//         alert("Already Login Another User Please Login Again!!!");
//         if (navigate) navigate("/Login/Index");
//         else window.location.href = "/Login/Index";
//         return;
//       }

//       const [customerRes, salesmanRes, cashierRes, counterRes, saleTypeRes] = results;

//       if (customerRes.status === "fulfilled" && customerRes.value.ok !== false) {
//         setCustomerList(extractComboList(customerRes.value).map(toComboOption));
//       }
//       if (salesmanRes.status === "fulfilled" && salesmanRes.value.ok !== false) {
//         setSalesmanList(extractComboList(salesmanRes.value).map(toComboOption));
//       }
//       if (cashierRes.status === "fulfilled" && cashierRes.value.ok !== false) {
//         setCashierList(extractComboList(cashierRes.value).map(toComboOption));
//       }
//       if (counterRes.status === "fulfilled" && counterRes.value.ok !== false) {
//         setCounterList(extractComboList(counterRes.value).map(toComboOption));
//       }
//       if (saleTypeRes.status === "fulfilled" && saleTypeRes.value.ok !== false) {
//         setSaleTypeList(extractComboList(saleTypeRes.value).map(toComboOption));
//       }
//     })();
//   }, [ready, MComid, navigate]);

//   return { customerList, salesmanList, cashierList, counterList, saleTypeList };
// }

// ─── 9. MISC HELPERS ──────────────────────────────────────────────────────────

/** Generates a unique row key */
export const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36);

/**
 * applyUppercase()
 * Converts an input value to UPPERCASE while preserving the cursor position.
 * Usage: onChange={e => CC.applyUppercase(e, val => updateCell(idx, "Field", val))}
 */
export function applyUppercase(e, onChange) {
  const el    = e.target;
  const start = el.selectionStart;
  const end   = el.selectionEnd;
  onChange(el.value.toUpperCase());
  requestAnimationFrame(() => {
    if (el && document.activeElement === el) {
      el.setSelectionRange(start, end);
    }
  });
}

/**
 * handleEnterNext()
 * Moves focus to the next visible, enabled input/select/textarea in the grid.
 * Usage: onKeyDown={e => CC.handleEnterNext(e, inputRefs, idx, colIdx, totalCols, totalRows, addRow, grid, rowValidator)}
 */
export function handleEnterNext(e, inputRefs, curRow, curCol, totalCols, totalRows, onLastCell, grid, rowValidator) {
  if (e.key !== "Enter") return;
  e.preventDefault();

  let nextRow = curRow;
  let nextCol = curCol + 1;

  if (nextCol >= totalCols) {
    const currentRow = grid[curRow];
    const isFilled   = rowValidator(currentRow);

    if (!isFilled) {
      for (let c = 0; c < totalCols; c++) {
        const el = inputRefs.current[curRow]?.[c];
        if (el && !el.value?.trim()) {
          setTimeout(() => el.focus(), 30);
          return;
        }
      }
      return;
    }

    nextCol = 0;
    nextRow = curRow + 1;
  }

  if (nextRow >= totalRows) {
    onLastCell?.();
    setTimeout(() => { inputRefs.current[nextRow]?.[0]?.focus(); }, 100);
    return;
  }

  setTimeout(() => { inputRefs.current[nextRow]?.[nextCol]?.focus(); }, 30);
}

// ─── 10. SHARED INLINE STYLES ─────────────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("cmActiveSelStyle")) {
  const s = document.createElement("style");
  s.id = "cmActiveSelStyle";
  s.textContent = `
    @keyframes cmPopIn {
      from { transform: scale(0.88); opacity: 0; }
      to   { transform: scale(1);    opacity: 1; }
    }
    .cm-active-sel {
      text-align: center;
      font-size: 16px;
      padding: 2px 4px;
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      background: #f8fafc;
      cursor: pointer;
      width: 62px;
    }
    .cm-active-sel:focus { outline: 2px solid #3b82f6; }
  `;
  document.head.appendChild(s);
}

export const modalStyles = {
  overlay: { position:"fixed", inset:0, background:"rgba(10,20,40,0.55)", backdropFilter:"blur(2px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 },
  modal:   { background:"#fff", borderRadius:"10px", padding:"28px 32px 22px", minWidth:"280px", maxWidth:"360px", textAlign:"center", boxShadow:"0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)", border:"1px solid #e2e8f0", animation:"cmPopIn 0.15s ease" },
  icon:    { width:"40px", height:"40px", borderRadius:"50%", background:"linear-gradient(135deg,#3b82f6,#1d4ed8)", color:"#fff", fontSize:"20px", fontWeight:"700", lineHeight:"40px", margin:"0 auto 14px" },
  msg:     { fontSize:"14px", color:"#1e293b", fontWeight:"500", margin:"0 0 20px", lineHeight:"1.5" },
  btns:    { display:"flex", gap:"10px", justifyContent:"center" },
  btn:     { padding:"7px 26px", borderRadius:"6px", border:"none", fontSize:"13px", fontWeight:"600", cursor:"pointer", outline:"none" },
  yes:     { background:"linear-gradient(135deg,#22c55e,#16a34a)", color:"#fff", boxShadow:"0 2px 6px rgba(34,197,94,0.35)" },
  no:      { background:"#f1f5f9", color:"#475569", border:"1px solid #cbd5e1" },
};

// ─── 11. CONFIRM MODAL COMPONENT ──────────────────────────────────────────────
export function ConfirmModal({ message, onYes, onNo }) {
  const yesBtnRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => yesBtnRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") { e.preventDefault(); onNo(); } };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onNo]);

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.modal} role="dialog" aria-modal="true">
        <div style={modalStyles.icon}>?</div>
        <p style={modalStyles.msg}>{message}</p>
        <div style={modalStyles.btns}>
          <button ref={yesBtnRef} style={{ ...modalStyles.btn, ...modalStyles.yes }} onClick={onYes}>✔ Yes</button>
          <button style={{ ...modalStyles.btn, ...modalStyles.no }} onClick={onNo}>✘ No</button>
        </div>
      </div>
    </div>
  );
}

// ─── 12. useConfirm HOOK ──────────────────────────────────────────────────────
/**
 * Returns { confirm, ConfirmUI }.
 * Usage:
 *   const { confirm, ConfirmUI } = useConfirm();
 *   const ok = await confirm("Are you sure?");
 */
export function useConfirm() {
  const [conf, setConf] = useState(null);
  const confirm   = useCallback((message) => new Promise((resolve) => setConf({ message, resolve })), []);
  const handleYes = useCallback(() => { conf?.resolve(true);  setConf(null); }, [conf]);
  const handleNo  = useCallback(() => { conf?.resolve(false); setConf(null); }, [conf]);
  const ConfirmUI = conf
    ? <ConfirmModal message={conf.message} onYes={handleYes} onNo={handleNo} />
    : null;
  return { confirm, ConfirmUI };
}

// ─── 13. useToast HOOK ────────────────────────────────────────────────────────
/**
 * Returns { toast, toasts }.
 * Render <ToastList toasts={toasts} /> at the bottom of your component.
 */
export function useToast(durationMs = 3500) {
  const toastId = useRef(0);
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg, isErr = false) => {
    const id = ++toastId.current;
    setToasts(p => [...p, { id, msg, isErr }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), durationMs);
  }, [durationMs]);

  return { toast, toasts };
}

/** Companion render component for useToast */
export function ToastList({ toasts }) {
  return (
    <div className="toasts">
      {toasts.map(t => (
        <div key={t.id} className={`toast${t.isErr ? " err" : ""}`}>{t.msg}</div>
      ))}
    </div>
  );
}

// ─── GENERIC HELPERS (Moved from SaleOrder.jsx) ──────────────────────────────
export const vn    = v => parseFloat(v) || 0;
export const roVal = v => Math.round(v * 100) / 100;
export const f2    = v => parseFloat(vn(v).toFixed(2));
export const f3    = v => parseFloat(vn(v).toFixed(3));
export const ns    = v => (v == null ? "" : String(v));
export const today = () => new Date().toISOString().slice(0, 10);

let _rid = 4000;
export const genRid  = () => ++_rid;
export const newGuid = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0;
  return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
});

// ─── SALE ORDER CONSTANTS (Moved from SaleOrder.jsx) ──────────────────────────
export const ORDER_TYPES = [
  { value: "CASH",   label: "CASH" },
  { value: "CREDIT", label: "CREDIT" },
];

export const SO_COLUMNS = [
  { key: "ProductCode",     label: "Product Code", width: 140, hidden: false },
  { key: "ProductName",     label: "Description",  width: 280, hidden: false, readOnly: true },
  { key: "HSNcode",         label: "HSN Code",     width: 100, hidden: true },
  { key: "MRP",             label: "MRP",          width: 90,  hidden: true,  type: "float" },
  { key: "SaleRate",        label: "Sale Rate",    width: 100, hidden: false, type: "float" },
  { key: "Pcs",             label: "Pcs",          width: 80,  hidden: true,  type: "int" },
  { key: "Meter",           label: "Meter",        width: 80,  hidden: true,  type: "float" },
  { key: "TotalPcs",        label: "Total Pcs",    width: 85,  hidden: true,  type: "float" },
  { key: "NOMS",            label: "Noms",         width: 80,  hidden: true,  type: "int" },
  { key: "ItemQty",         label: "Quantity",     width: 90,  hidden: false, type: "float" },
  { key: "cdpercent",       label: "CD(%)",        width: 75,  hidden: true,  type: "float" },
  { key: "cdAmount",        label: "CD Amt",       width: 85,  hidden: true,  type: "float" },
  { key: "DiscountPercent", label: "Disc%",        width: 75,  hidden: true,  type: "float" },
  { key: "DiscountAmt",     label: "Disc Amt",     width: 85,  hidden: true,  type: "float" },
  { key: "TaxPercent",      label: "GST%",         width: 75,  hidden: true,  type: "float" },
  { key: "TaxAmt",          label: "GST Amt",      width: 85,  hidden: true,  type: "float" },
  { key: "CESSPer",         label: "CESS%",        width: 75,  hidden: true,  type: "float" },
  { key: "UOM",             label: "UOM",          width: 70,  hidden: true,  readOnly: true },
  { key: "SMCode",          label: "SM Code",      width: 80,  hidden: true },
  { key: "BillNo",          label: "Bill No",      width: 90,  hidden: true },
  { key: "remarks",         label: "Remarks",      width: 120, hidden: true },
  { key: "Amount",          label: "Amount",       width: 100, hidden: false, readOnly: true, type: "float" },
];

export const DEFAULT_COL_SETTINGS = SO_COLUMNS.map(c => ({
  key: c.key, label: c.label, width: c.width, visible: !c.hidden,
}));

// ─── API CONSTANTS (Moved from StockInward.jsx) ───────────────────────────────
// Inward
export const SI_MaxNo          = "/api/StockInwardApp/MaxStockInward";
export const SI_Insert         = "/api/StockInwardApp/InsertStockInward";
export const SI_Edit           = "/api/StockInwardApp/EditStockInward";
export const SI_Delete         = "/api/StockInwardApp/DeleteStockInward";
export const SI_Select         = "/api/StockInwardApp/SelectStockInward";
export const SI_TransferInward = "/api/StockInwardApp/StockTransferInwardEdit";

// Outward
export const SO_MaxNo    = "/api/StockOutwardApp/MaxStockOutward";
export const SO_Insert   = "/api/StockOutwardApp/InsertStockOutward";
export const SO_Edit     = "/api/StockOutwardApp/EditStockOutward";
export const SO_Delete   = "/api/StockOutwardApp/DeleteStockOutward";
export const SO_Select   = "/api/StockOutwardApp/SelectStockOutward";

// Transfer
export const ST_MaxNo      = "/api/StockTransferApp/MaxStockTransfer";
export const ST_Insert     = "/api/StockTransferApp/InsertStockTransfer";
export const ST_Edit       = "/api/StockTransferApp/EditStockTransfer";
export const ST_Delete     = "/api/StockTransferApp/DeleteStockTransfer";
export const ST_Select     = "/api/StockTransferApp/SelectStockTransfer";
export const ST_PrintView  = "/api/StockTransferApp/PrintView";

// Item Master
export const IM_ByCode      = "/api/ItemMasterApp/SelectItemMasterbyCodeId";
export const IM_ProductList = "/api/ItemMasterApp/GetProductListV7";
export const IM_TransferList= "/api/ItemMasterApp/SelectStockTrasferList";

// Area
export const AreaSelect = "/api/AreaApp/SelectArea_V7";
export const AreaInsert = "/api/AreaApp/InsertArea";
export const AreaDelete = "/api/AreaApp/DeleteArea";

// Supplier / Branch / Customer
export const SUP_All    = "/api/SupplierApp/SelectSupplierAll";
export const BRANCH_List= "/api/CompanyApp/SelectCompany";

export const SelectBranchAll= "/api/StockReportApp/SelectBranchAll";

// BatchWise master lists /api/BrandApp/SelectBrand
export const BW_Brand  = "/api/BrandApp/SelectBrand";
export const BW_Model  = "/api/ModelApp/SelectModelAll";
export const BW_Color  = "/api/ColorApp/SelectColorAll";
export const BW_Size   = "/api/SizeApp/SelectSizeAll";
export const BW_Gender = "/api/GenderApp/SelectGenderAll";

// Purchase / PO
export const PO_Edit     = "/api/PurchaseOrderApp/EditPurchaseOrder";
export const PO_NoCombo  = "/api/PurchaseOrderApp/PoNoComboList";

// Login / Config
export const CFG_EditPwd   = "/api/LoginApp/EditPassword";
export const CFG_VisibleCols= "/api/LoginApp/VisibleColumns";
export const CFG_FocusCols = "/api/LoginApp/FocusColumns";

// User
export const USR_UserCombo = "/api/LoginApp/UserComboList";