/**
 * INFRASTRUCTURE: ItemMasterApi
 * Follows the EXACT same pattern as PurchaseApi.js:
 *  - BASE_URL hardcoded (no Vite proxy)
 *  - postQuery  → POST + query string params  (mirrors PurchaseApi pattern)
 *  - post       → POST + JSON body
 *  - get        → GET  (for static JSON config files)
 *  - parseList  → handles Data1 / data / Data / array responses
 */

const BASE_URL = 'http://13.200.71.164:9001/api';

// ── Token helpers (identical to PurchaseApi) ─────────────────────────────────
const DEFAULT_TOKEN =
  'eyJhbGciOiJodHRwOi8vd3d3LnczLm9yZy8yMDAxLzA0L3htbGRzaWctbW9yZSNobWFjLXNoYTI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJlbWFpbCI6InNhcmF2YW5hMUBnbWFpbC5jb20iLCJ1c2VySWQiOiIxIiwicm9sZSI6IkFkbWluIiwic3ViIjoiMSIs' +
  'Im5iZiI6MTc3MzkyMjc4NCwiaWF0IjoxNzczOTIyNzg0LCJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjQ0MzAwLyIsImF1Z' +
  'CI6InNlY3VyZWFwaXVzZXIiLCJleHAiOjE3NzQwMDkxODR9.EGKRlGGedits3n7ALfm175mDQvj61_QbVhJp4tuxz4s';

const getToken = () =>
  localStorage.getItem('token')       ||
  localStorage.getItem('Token')       ||
  localStorage.getItem('bearerToken') ||
  localStorage.getItem('jwt')         ||
  DEFAULT_TOKEN;

// ── Comid helpers (identical to PurchaseApi) ─────────────────────────────────
const getComid  = () => localStorage.getItem('Comid')  || '34';
const getMComid = () =>
  localStorage.getItem('MComid') || localStorage.getItem('Comid') || '34';
const getIdComList = () => localStorage.getItem('IdComList') || getComid();

// ── Session flag helpers ──────────────────────────────────────────────────────
const getMainSetting = () => {
  try { return (JSON.parse(localStorage.getItem('Mainsetting')) || [{}])[0] || {}; }
  catch { return {}; }
};
const getComSetting = () => {
  try { return (JSON.parse(localStorage.getItem('Companysetting')) || [{}])[0] || {}; }
  catch { return {}; }
};

// ── POST with query-string params (mirrors PurchaseApi.postQuery) ─────────────
async function postQuery(url, params = {}) {
  const query   = new URLSearchParams(params).toString();
  const fullUrl = BASE_URL + url + (query ? '?' + query : '');
  const res = await fetch(fullUrl, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json; charset=utf-8',
      'Authorization': `Bearer ${getToken()}`,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${fullUrl}`);
  return res.json();
}

// ── POST with JSON body (mirrors PurchaseApi.post) ───────────────────────────
async function post(url, body = {}, extraHeaders = {}) {
  const fullUrl = BASE_URL + url;
  const res = await fetch(fullUrl, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json; charset=utf-8',
      'Authorization': `Bearer ${getToken()}`,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${fullUrl}`);
  return res.json();
}

// ── GET (for static config JSON files like Itemmaster.json) ──────────────────
async function get(url) {
  const fullUrl = BASE_URL + url;
  const res = await fetch(fullUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${fullUrl}`);
  const text = await res.text();
  if (!text.trim()) return null;
  try { return JSON.parse(text); } catch { return null; }
}

// ── Response parser (mirrors PurchaseApi.parseList) ──────────────────────────
function parseList(data) {
  return data?.Data1 || data?.data || data?.Data || (Array.isArray(data) ? data : []);
}

// ═════════════════════════════════════════════════════════════════════════════
//  ItemMasterApi — public surface
// ═════════════════════════════════════════════════════════════════════════════
export const ItemMasterApi = {

  // ── DROPDOWNS ─────────────────────────────────────────────────────────────
  // All use POST with JSON body { Comid } — mirrors original jQuery calls

  /** POST /BrandApp/SelectBrand  { Comid } */
  async getBrands() {
    const data = await post('/BrandApp/SelectBrand', { Comid: getComid() });
    return { ok: true, data: parseList(data) };
  },

  /** POST /CategoryApp/SelectCategory  { Comid } */
  async getCategories() {
    const data = await post('/CategoryApp/SelectCategory', { Comid: getComid() });
    return { ok: true, data: parseList(data) };
  },

  /** POST /DepartmentApp/SelectDepartment  { Comid } */
  async getDepartments() {
    const data = await post('/DepartmentApp/SelectDepartment', { Comid: getComid() });
    return { ok: true, data: parseList(data) };
  },

  /** POST /SupplierApp/GetSupplier  { Comid, AccountType } */
  async getSuppliers() {
    const data = await post('/SupplierApp/GetSupplier', {
      Comid:       getComid(),
      AccountType: 'SUPPLIER',
    });
    return { ok: true, data: parseList(data) };
  },

  /** POST /UOMApp/SelectUOM  { Comid } */
  async getUOMs() {
    const data = await post('/UOMApp/SelectUOM', { Comid: getComid() });
    return { ok: true, data: parseList(data) };
  },

  /** POST /LocationApp/SelectLocation  { Comid } */
  async getLocations() {
    const data = await post('/LocationApp/SelectLocation', { Comid: getComid() });
    return { ok: true, data: parseList(data) };
  },

  // ── LOAD ALL DROPDOWNS IN ONE CALL ────────────────────────────────────────
  /** Fires all 6 dropdown requests in parallel — mirrors jQuery's parallel ajax calls */
  async loadDropdowns() {
    const [brRes, caRes, deRes, suRes, uoRes, loRes] = await Promise.allSettled([
      ItemMasterApi.getBrands(),
      ItemMasterApi.getCategories(),
      ItemMasterApi.getDepartments(),
      ItemMasterApi.getSuppliers(),
      ItemMasterApi.getUOMs(),
      ItemMasterApi.getLocations(),
    ]);

    const safe = (r) => r.status === 'fulfilled' ? r.value : { ok: false, data: [] };

    return {
      brands:      safe(brRes).data,
      categories:  safe(caRes).data,
      departments: safe(deRes).data,
      suppliers:   safe(suRes).data,
      uoms:        safe(uoRes).data,
      locations:   safe(loRes).data,
    };
  },

  // ── ITEM MASTER LIST ──────────────────────────────────────────────────────
  /**
   * POST /ItemMasterApp/SelectItemMaster
   * Body:    { Comid, Startindex, PageCount, Keyword, Column }
   * Headers: { Download: "0" }  (pass "1" for Excel export)
   */
  async getItemList({ startIndex = 0, pageCount = 20, keyword = '', column = '', download = '0' } = {}) {
    const data = await post(
      '/ItemMasterApp/SelectItemMaster',
      {
        Comid:      getComid(),
        Startindex: startIndex,
        PageCount:  pageCount,
        Keyword:    keyword,
        Column:     column,
      },
      { Download: download },
    );
    // mirrors jQuery: data.Count for pagination total, data.data for rows
    return {
      ok:    true,
      data:  parseList(data),
      count: data?.Count || data?.count || 0,
      raw:   data,
    };
  },

  // ── COLUMN CONFIG ─────────────────────────────────────────────────────────
  /**
   * GET /ContentApp/Appdata/Visible/{Comid}/Itemmaster.json
   * Returns column visibility/width settings saved on server.
   */
  async getColumnConfig() {
    const data = await get(`/ContentApp/Appdata/Visible/${getComid()}/Itemmaster.json`);
    return data || [];
  },

  /**
   * POST /Login/VisibleColumns
   * Body: [{ filename, column, Visible, Width, Comid }]
   * Saves column config to server.
   */
  async saveColumnConfig(cols) {
    const payload = cols.map(c => ({
      filename: 'Itemmaster',
      column:   c.key,
      Visible:  c.visible,
      Width:    c.width,
      Comid:    getComid(),
    }));
    const data = await post('/Login/VisibleColumns', payload);
    return { ok: data?.ok ?? true, message: data?.message || 'Column settings saved.' };
  },

  // ── SAVE / INSERT ─────────────────────────────────────────────────────────
  /**
   * POST /ItemMaster/InsertItemMaster
   * Body:    [{ ...formFields, EditMode: 1 }]
   * Headers: session flags (mirrors jQuery SaveItemMaster headers exactly)
   */
  async saveItem(formData) {
    const ms  = getMainSetting();
    const com = getComSetting();
    const Comid = (() => {
      const cc = !!ms.CommonCompany;
      return cc ? getMComid() : getComid();
    })();

    const saveHeaders = {
      'Comid':                  String(Comid),
      'BranchSaleRate':         String(!!ms.BranchWiseSaleRate),
      'CommonCompany':          String(!!ms.CommonCompany),
      'CommonCompanyDiffStock': String(!!ms.CommonCompanyDiffStock),
      'SupplierMulitipleAllow': String(!!ms.SupplierMulitipleAllow),
      'MulipleMRP':             String(!!com.MultiMRP),
      'MirrorTable':            String(ms.MirrorTable || 0),
      'Tamil':                  String(!!ms.ProductNameTamil),
      'IdComList':              String(getIdComList()),
      'ApiType':                '0',
    };

    const data = await post('/ItemMaster/InsertItemMaster', [{ ...formData, EditMode: 1 }], saveHeaders);
    return data;
  },

  // ── DELETE ────────────────────────────────────────────────────────────────
  /**
   * POST /ItemMaster/DeleteItemMaster?Id={id}&Comid={Comid}&MirrorTable={MirrorTable}
   * Headers: { IdComList }
   * C# reads Id/Comid/MirrorTable from query string, IdComList from header.
   */
  async deleteItem(id) {
    const ms     = getMainSetting();
    const Comid  = getComid();
    const mirror = ms.MirrorTable || 0;
    const qs     = `?Id=${id}&Comid=${Comid}&MirrorTable=${mirror}`;
    const data   = await post(`/ItemMaster/DeleteItemMaster${qs}`, {}, {
      'IdComList': String(getIdComList()),
    });
    return data;
  },

  // ── EXCEL DOWNLOAD ────────────────────────────────────────────────────────
  /**
   * Same endpoint as getItemList but with Download: "1" and Keyword: "Excel".
   */
  async downloadExcel() {
    return ItemMasterApi.getItemList({
      startIndex: 0,
      pageCount:  20,
      keyword:    'Excel',
      column:     'Excel',
      download:   '1',
    });
  },

  // ── EXCEL UPLOAD ─────────────────────────────────────────────────────────
  /**
   * POST /ItemMaster/InsertItemMaster
   * Body:    array of item records from parsed CSV/XLSX
   * Same headers as saveItem — jQuery also adds ApiType: "0"
   */
  async uploadExcel(records) {
    const ms  = getMainSetting();
    const com = getComSetting();
    const Comid = (() => {
      const cc = !!ms.CommonCompany;
      return cc ? getMComid() : getComid();
    })();

    const uploadHeaders = {
      'Comid':                  String(Comid),
      'BranchSaleRate':         String(!!ms.BranchWiseSaleRate),
      'CommonCompany':          String(!!ms.CommonCompany),
      'CommonCompanyDiffStock': String(!!ms.CommonCompanyDiffStock),
      'SupplierMulitipleAllow': String(!!ms.SupplierMulitipleAllow),
      'MulipleMRP':             String(!!com.MultiMRP),
      'MirrorTable':            String(ms.MirrorTable || 0),
      'Tamil':                  String(!!ms.ProductNameTamil),
      'IdComList':              String(getIdComList()),
      'ApiType':                '0',                          // required for Excel upload path
    };

    const data = await post('/ItemMaster/InsertItemMaster', records, uploadHeaders);
    return data;
  },

  // ── BARCODES ──────────────────────────────────────────────────────────────
  /** POST /ItemMaster/SelectItemBarcode  { Id, Comid } */
  async getBarcodes(itemId) {
    const data = await post('/ItemMaster/SelectItemBarcode', {
      Id:    itemId,
      Comid: getComid(),
    });
    return { ok: true, data: parseList(data) };
  },

  /** POST /ItemMaster/InsertItemBarcode */
  async saveBarcode(payload) {
    return post('/ItemMaster/InsertItemBarcode', payload);
  },

  /** POST /ItemMaster/DeleteItemBarcode */
  async deleteBarcode(id) {
    return post('/ItemMaster/DeleteItemBarcode', { Id: id, Comid: getComid() });
  },

  // ── MULTIPLE UOM ──────────────────────────────────────────────────────────
  /** POST /ItemMaster/SelectItemUnit  { Id, Comid } */
  async getItemUnits(itemId) {
    const data = await post('/ItemMaster/SelectItemUnit', {
      Id:    itemId,
      Comid: getComid(),
    });
    return { ok: true, data: parseList(data) };
  },

  /** POST /ItemMaster/InsertItemUnit */
  async saveItemUnit(payload) {
    return post('/ItemMaster/InsertItemUnit', payload);
  },

  /** POST /ItemMaster/DeleteItemUnit */
  async deleteItemUnit(id) {
    return post('/ItemMaster/DeleteItemUnit', { Id: id, Comid: getComid() });
  },

  // ── BRANCH SALE RATE ──────────────────────────────────────────────────────
  /** POST /ItemMaster/SelectBranchSaleRate  { Id, Comid } */
  async getBranchSaleRates(itemId) {
    const data = await post('/ItemMaster/SelectBranchSaleRate', {
      Id:    itemId,
      Comid: getComid(),
    });
    return { ok: true, data: parseList(data) };
  },

  /** POST /ItemMaster/InsertBranchSaleRate */
  async saveBranchSaleRate(payload) {
    return post('/ItemMaster/InsertBranchSaleRate', payload);
  },

  // ── PRODUCT IMAGE ─────────────────────────────────────────────────────────
  /** POST /ItemMaster/UpdateProductImage  { Id, Comid, ProductImage } */
  async saveProductImage(itemId, imageFilename) {
    return post('/ItemMaster/UpdateProductImage', {
      Id:           itemId,
      Comid:        getComid(),
      ProductImage: imageFilename,
    });
  },

  /** POST file upload for product image */
  async uploadProductImage(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE_URL}/Upload/UploadFile`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body: formData,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} on image upload`);
    return res.json();
  },

  // ── TAMIL NAME ────────────────────────────────────────────────────────────
  /** POST /ItemMaster/UpdatePrinterName  { Id, Comid, PrinterName } */
  async saveTamilName(itemId, printerName) {
    return post('/ItemMaster/UpdatePrinterName', {
      Id:          itemId,
      Comid:       getComid(),
      PrinterName: printerName,
    });
  },

  // ── GROUP COMMISSION ──────────────────────────────────────────────────────
  /** POST /ItemMaster/SelectGroupCommission  { Id, Comid } */
  async getGroupCommissions(itemId) {
    const data = await post('/ItemMaster/SelectGroupCommission', {
      Id:    itemId,
      Comid: getComid(),
    });
    return { ok: true, data: parseList(data) };
  },

  /** POST /ItemMaster/InsertGroupCommission */
  async saveGroupCommission(payload) {
    return post('/ItemMaster/InsertGroupCommission', payload);
  },

  // ── AUTO PRODUCT CODE ─────────────────────────────────────────────────────
  /** POST /ItemMaster/MaxProductCode  { Comid } */
  async getMaxProductCode() {
    const data = await post('/ItemMaster/MaxProductCode', { Comid: getComid() });
    // C# MaxProductCode: .Data1 holds the max code integer
    const maxCode = Number(data?.Data1 ?? data) || 0;
    return { ok: true, maxCode };
  },

  // ── PASSWORD CHECK ────────────────────────────────────────────────────────
  /** POST /Login/EditPassword  { password, type, Comid } */
  async checkPassword(password) {
    return post('/Login/EditPassword', {
      password,
      type:  'EditPassword',
      Comid: getComid(),
    });
  },
};
