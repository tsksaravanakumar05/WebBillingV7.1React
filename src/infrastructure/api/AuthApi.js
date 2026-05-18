// infrastructure/api/AuthApi.js

import { BASE_URL, API_ENDPOINTS } from "../../shared/constants/apiEndpoints.js";

export class AuthApi {
  /**
   * @param {{ userId: string, password: string, oldUserId: string }} credentials
   */
  async login(credentials) {
    // Query params — matches: ?Userid=...&Pwd=...&olduserid=...
    const params = new URLSearchParams({
      Userid: credentials.userId,
      Pwd: credentials.password,
      olduserid: credentials.oldUserId,
    });

    const url = `${BASE_URL}${API_ENDPOINTS.LOGIN}?${params.toString()}`;

    const res = await fetch(url, {
      method: "POST",
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const raw = await res.json();
    return this.mapResponse(raw);
  }

  mapResponse(raw) {
    // API Response (Data1, Data4, Data5) ku yetha madhiri mapping
    const gedata = raw.Data1?.[0] ?? {};       // User and Basic Company Info
    const comdata = raw.Data4?.[0] ?? {};      // Company Address, Print formats etc.
    const maindata = raw.Data5?.[0] ?? {};     // Main Settings (NegativeStock, CommonCompany etc.)

    return {
      // 'IsSuccess' and 'Message' matches backend
      ok: raw.IsSuccess,
      message: raw.Message,
      
      user: {
        userId: gedata.UserId,
        username: gedata.UserId,
        priv: gedata.Priv,
        comId: gedata.Comid,
        mComId: gedata.MComid,
        companyName: gedata.CompanyName,
      },
      
      company: {
        address1: comdata.Address1 ?? "",
        address2: comdata.Address2 ?? "",
        city: comdata.City ?? "",
        phone: comdata.Phone ?? "",
        negativeStock: Number(comdata.NegativeStock ?? 0),
        mirrorTableOnline: maindata.MirrorTableOnline ?? "",
        commonCompany: maindata.CommonCompany ?? "",
        supplierCommonCompany: maindata.SupplierCommonCompany ?? "",
        productNameTamil: maindata.ProductNameTamil ?? "",
      },
      
      // Other IDs usually come sequentially in Data6, Data7 etc.
      cashierId: raw.Data6 ?? "",
      cashId: raw.Data7 ?? "",
      creditId: raw.Data8 ?? "",
      customerCashId: raw.Data9 ?? "",
      
      // Menu list is coming in Data3
      menuList: JSON.stringify(raw.Data3 ?? []), // LocalStorage save aagum bodhu stringify aaganum
      menuData: raw.Data3 ?? [],
      
      // Dropdowns / ComId list usually in Data11
      comIdList: raw.Data11 ?? [],
      
      // Entire main setting array if needed later
      mainData: raw.Data5 ?? [],
    };
  }
}