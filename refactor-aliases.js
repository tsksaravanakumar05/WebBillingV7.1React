const fs = require('fs');
const file = 'e:/KodeeWorkSpaceNew/WebBillingV7.1React/src/Transaction/Saleorder.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove the alias definitions
const aliasRegex = /const\s+(SaleOrderMaxNo|SaleOrderInsertUrl|SaleOrderEditUrl|SaleOrderSelectUrl|SaleOrderDeleteUrl|SelectItemByCodeUrl|ProductListUrl|GetCustomerUrl|SalesManSelectUrl|LoginPasswordUrl|VisibleColumnsUrl|FocusColumnsUrl|CurrentStockUrl|CRMBalanceUrl|CurrentBalanceUrl|ORDER_TYPES|SO_COLUMNS|DEFAULT_COL_SETTINGS|vn|roVal|f2|f3|ns|today|genRid|newGuid)\s*=\s*CC\.[A-Za-z0-9_]+;\r?\n/g;
content = content.replace(aliasRegex, '');

// 2. Replace usages in code
// API and constants
content = content.replace(/\bSaleOrderMaxNo\b/g, 'CC.SaleOrderMaxNo');
content = content.replace(/\bSaleOrderInsertUrl\b/g, 'CC.SaleOrderInsertUrl');
content = content.replace(/\bSaleOrderEditUrl\b/g, 'CC.SaleOrderEditUrl');
content = content.replace(/\bSaleOrderSelectUrl\b/g, 'CC.SaleOrderSelectUrl');
content = content.replace(/\bSaleOrderDeleteUrl\b/g, 'CC.SaleOrderDeleteUrl');

content = content.replace(/\bSelectItemByCodeUrl\b/g, 'CC.SO_SelectItemByCodeUrl');
content = content.replace(/\bProductListUrl\b/g, 'CC.SO_ProductListUrl');
content = content.replace(/\bGetCustomerUrl\b/g, 'CC.SO_GetCustomerUrl');
content = content.replace(/\bSalesManSelectUrl\b/g, 'CC.SO_SalesManSelectUrl');
content = content.replace(/\bLoginPasswordUrl\b/g, 'CC.SO_LoginPasswordUrl');
content = content.replace(/\bVisibleColumnsUrl\b/g, 'CC.SO_VisibleColumnsUrl');
content = content.replace(/\bFocusColumnsUrl\b/g, 'CC.SO_FocusColumnsUrl');
content = content.replace(/\bCurrentStockUrl\b/g, 'CC.SO_CurrentStockUrl');
content = content.replace(/\bCRMBalanceUrl\b/g, 'CC.SO_CRMBalanceUrl');
content = content.replace(/\bCurrentBalanceUrl\b/g, 'CC.SO_CurrentBalanceUrl');

content = content.replace(/\bORDER_TYPES\b/g, 'CC.ORDER_TYPES');
content = content.replace(/\bSO_COLUMNS\b/g, 'CC.SO_COLUMNS');
content = content.replace(/\bDEFAULT_COL_SETTINGS\b/g, 'CC.DEFAULT_COL_SETTINGS');

// Helper functions (only matching when invoked or passed, preventing double replacement if CC.vn is already there)
// We'll use a negative lookbehind to avoid matching CC.vn etc, but Node.js supports lookbehind.
content = content.replace(/(?<!CC\.)\bvn\b/g, 'CC.vn');
content = content.replace(/(?<!CC\.)\broVal\b/g, 'CC.roVal');
content = content.replace(/(?<!CC\.)\bf2\b/g, 'CC.f2');
content = content.replace(/(?<!CC\.)\bf3\b/g, 'CC.f3');
content = content.replace(/(?<!CC\.)\bns\b/g, 'CC.ns');
content = content.replace(/(?<!CC\.)\btoday\b/g, 'CC.today');
content = content.replace(/(?<!CC\.)\bgenRid\b/g, 'CC.genRid');
content = content.replace(/(?<!CC\.)\bnewGuid\b/g, 'CC.newGuid');

// Fix any CC.CC. caused by the negative lookbehind bug if it fails on word boundaries, but lookbehind works fine.
content = content.replace(/CC\.CC\./g, 'CC.');

// Also clean up empty comments for the definitions block if needed
content = content.replace(/\/\/ ─── API ENDPOINTS \(SaleOrder specific\) ──────────────────────────────────────\r?\n\/\/ ─── EXTRACTED GLOBALS FROM Common\.jsx ───────────────────────────────────────\r?\n/g, '');

fs.writeFileSync(file, content);
console.log('Aliases removed and usages replaced successfully.');
