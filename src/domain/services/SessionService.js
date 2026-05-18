// domain/services/SessionService.js
// All the localStorage.setItem() logic from Login.js — centralized here

export const SessionService = {
  /**
   * Persists login session to localStorage.
   * Mirrors the original Login.js success block exactly.
   * @param {import('../entities/User').LoginResponse} response
   * @param {string} username
   */
  persist(response, username) {
    const { user, company } = response;

    localStorage.setItem("popupalert", "1");
    sessionStorage.setItem("home", "1");
    localStorage.setItem("LoginCount", "0");
    localStorage.setItem("userid", user.userId);
    localStorage.setItem("username", username);
    localStorage.setItem("priv", user.priv);
    localStorage.setItem("Comid", user.comId);
    localStorage.setItem("MComid", user.mComId);
    localStorage.setItem("CompanyName", user.companyName);

    // HO company flag — same logic as original
    localStorage.setItem("HoCompany", user.comId === user.mComId ? "1" : "0");

    // Only set when user changes (matches original olduserid check)
    const oldUserId = localStorage.getItem("userid");
    if (!oldUserId || oldUserId !== user.userId) {
      localStorage.setItem("Address", `${company.address1} ${company.address2} ${company.city}`);
      localStorage.setItem("Phone", `Phone No :${company.phone}`);
      localStorage.setItem("CashierRefid", response.cashierId);
      localStorage.setItem("parentcashid", response.cashId);
      localStorage.setItem("CreditId", response.creditId);
      localStorage.setItem("CustomerCashid", response.customerCashId);
      localStorage.setItem("menulistload", response.menuList);
      localStorage.setItem("BillPrintData", response.billPrintData);
      localStorage.setItem("CustomerReceiptPrintData", response.customerReceiptPrintData);
      localStorage.setItem("menulist", JSON.stringify(response.menuData));
      localStorage.setItem("Companysetting", JSON.stringify([company]));
      localStorage.setItem("IdComList", JSON.stringify(response.comIdList));
      localStorage.setItem("Mainsetting", JSON.stringify(response.mainData));
      localStorage.setItem("MirrorTableOnline", company.mirrorTableOnline);
      localStorage.setItem("CommonCompany", company.commonCompany);
      localStorage.setItem("SupplierCommon", company.supplierCommonCompany);
      localStorage.setItem("Tamil", company.productNameTamil);
      localStorage.setItem("AllowNegativeStock", company.negativeStock === 1 ? "true" : "false");
    }
  },

  getOldUserId() {
    return localStorage.getItem("userid") ?? "";
  },

  clear() {
    localStorage.clear();
    sessionStorage.clear();
  },
};