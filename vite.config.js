
//       '/AccountsMaster': { target: 'http://13.200.71.164:9001', changeOrigin: true },


// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// const TARGET = 'http://13.200.71.164:9001'

// export default defineConfig({
//   plugins: [react()],
//   server: {
//     proxy: {
//       // ── Existing ──────────────────────────────────────────
//       '/Master': { target: TARGET, changeOrigin: true },


//       '/Brand':           { target: TARGET, changeOrigin: true },
//       '/Category':        { target: TARGET, changeOrigin: true },
//       '/Department':      { target: TARGET, changeOrigin: true },
//       '/Supplier':        { target: TARGET, changeOrigin: true },
//       '/UOM':             { target: TARGET, changeOrigin: true },
//       '/Location':        { target: TARGET, changeOrigin: true },
//       '/ItemMaster':      { target: TARGET, changeOrigin: true },
//       '/Login':           { target: TARGET, changeOrigin: true },
//       '/Content':         { target: TARGET, changeOrigin: true },
//       '/Cashier':         { target: TARGET, changeOrigin: true },
//       '/SizeMaster':      { target: TARGET, changeOrigin: true },
//       '/ColorMaster':     { target: TARGET, changeOrigin: true },
//       '/ModelMaster':     { target: TARGET, changeOrigin: true },
//       '/Group':           { target: TARGET, changeOrigin: true },
//       '/SalesManMaster':  { target: TARGET, changeOrigin: true },
//       '/Customer':        { target: TARGET, changeOrigin: true },
//       '/AccountsMaster':  { target: TARGET, changeOrigin: true },

//       // ── Newly Added ───────────────────────────────────────
//       '/Bank':              { target: TARGET, changeOrigin: true },
//       '/CardMaster':        { target: TARGET, changeOrigin: true },
//       '/Area':              { target: TARGET, changeOrigin: true },
//       '/SalesMan':          { target: TARGET, changeOrigin: true },
//       '/CustomerCardType':  { target: TARGET, changeOrigin: true },
//       '/StockTransfer':     { target: TARGET, changeOrigin: true },
//       '/Home':              { target: TARGET, changeOrigin: true },
//       '/CardType':          { target: TARGET, changeOrigin: true },
//       '/Tax':               { target: TARGET, changeOrigin: true },
//       '/Product':           { target: TARGET, changeOrigin: true },
//       '/Purchase':          { target: TARGET, changeOrigin: true },
//       '/Sale':              { target: TARGET, changeOrigin: true },
//       '/Report':            { target: TARGET, changeOrigin: true },
//       '/Accounts':          { target: TARGET, changeOrigin: true },
//       '/HSNMaster':         { target: TARGET, changeOrigin: true },
//       '/DiscountMaster':    { target: TARGET, changeOrigin: true },
//       '/PriceMaster':       { target: TARGET, changeOrigin: true },
//       '/OpeningStock':      { target: TARGET, changeOrigin: true },
//     }
//   }
// })



   import { defineConfig } from 'vite'
   import react from '@vitejs/plugin-react'

// // ─────────────────────────────────────────────────────────────────────────────
// // BACKEND PORT — change this if your Visual Studio backend runs on a different port
// //
// // How to find your port:
// //   1. Run the WebBillingV7 project in Visual Studio (F5)
// //   2. Check the browser URL it opens — e.g. http://localhost:64215
// //   3. Set that port number below
// //
// // Common ports: 64215, 44300, 5000, 5001, 7000, 8080
// // ─────────────────────────────────────────────────────────────────────────────

const TARGET = "https://billing.kassapos.co.in";
 
// // Rewrites /ShortName/Method → /api/ShortNameApp/Method
// // e.g. /Login/LoginSuccess → http://localhost:64215/api/loginApp/LoginSuccess





//const TARGET = 'http://13.200.71.164:9001'
const mkProxy = (strip, controller) => ({
  target:      TARGET,
  changeOrigin: true,
  secure:       false,
  rewrite: (path) =>
    path.replace(new RegExp(`^/${strip}(/|$)`), `/api/${controller}$1`),
})

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
//       // ── Auth ─────────────────────────────────────────────────────────────
//       // /Login/LoginSuccess → /api/loginApp/LoginSuccess
      '/Login':          mkProxy('Login',          'loginApp'),

//       // ── Dropdown masters ──────────────────────────────────────────────────
      '/Brand':          mkProxy('Brand',          'BrandApp'),
      '/Category':       mkProxy('Category',       'CategoryApp'),
      '/Department':     mkProxy('Department',     'DepartmentApp'),
      '/Supplier':       mkProxy('Supplier',       'SupplierApp'),
      '/UOM':            mkProxy('UOM',            'UOMApp'),
      '/Location':       mkProxy('Location',       'LocationApp'),

//       // ── Item Master ───────────────────────────────────────────────────────
      '/ItemMaster':     mkProxy('ItemMaster',     'ItemMasterApp'),

//       // ── Static files — no rewrite ─────────────────────────────────────────
       '/Content':        { target: TARGET, changeOrigin: true, secure: false },

//       // ── Other masters ─────────────────────────────────────────────────────
      '/Master':         mkProxy('Master',         'MasterApp'),
      '/Cashier':        mkProxy('Cashier',        'CashierApp'),
      '/SizeMaster':     mkProxy('SizeMaster',     'SizeMasterApp'),
      '/ColorMaster':    mkProxy('ColorMaster',    'ColorMasterApp'),
      '/ModelMaster':    mkProxy('ModelMaster',    'ModelMasterApp'),
      '/Group':          mkProxy('Group',          'GroupApp'),
      '/SalesManMaster': mkProxy('SalesManMaster', 'SalesManMasterApp'),
      '/Customer':       mkProxy('Customer',       'CustomerApp'),
      '/AccountsMaster': mkProxy('AccountsMaster', 'AccountsMasterApp'),
      '/Bank':           mkProxy('Bank',           'BankApp'),
      '/CardMaster':     mkProxy('CardMaster',     'CardMasterApp'),
      '/Area':           mkProxy('Area',           'AreaApp'),
      '/SalesMan': mkProxy('SalesMan', 'SalesManMasterApp'),
      '/CustomerCardType': mkProxy('CustomerCardType', 'CustomerCardTypeApp'),
      '/StockTransfer':  mkProxy('StockTransfer',  'StockTransferApp'),
      // '/Home':           mkProxy('Home',           'HomeApp'),
      '/CardType':       mkProxy('CardType',       'CardTypeApp'),
      '/Tax':            mkProxy('Tax',            'TaxApp'),
      '/Product':        mkProxy('Product',        'ProductApp'),
      '/Purchase':       mkProxy('Purchase',       'PurchaseApp'),
      '/Sale':           mkProxy('Sale',           'SaleApp'),
      '/Report':         mkProxy('Report',         'ReportApp'),
      '/Accounts':       mkProxy('Accounts',       'AccountsApp'),
      '/HSNMaster':      mkProxy('HSNMaster',      'HSNMasterApp'),
      '/DiscountMaster': mkProxy('DiscountMaster', 'DiscountMasterApp'),
      '/PriceMaster':    mkProxy('PriceMaster',    'PriceMasterApp'),
      '/OpeningStock':   mkProxy('OpeningStock',   'OpeningStockApp'),
    }
  }
})
