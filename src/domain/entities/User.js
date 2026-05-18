// domain/entities/User.js
// Core shape of user and login response — JSDoc for editor hints

/**
 * @typedef {Object} User
 * @property {string} userId
 * @property {string} username
 * @property {string} priv
 * @property {string} comId
 * @property {string} mComId
 * @property {string} companyName
 */

/**
 * @typedef {Object} CompanyData
 * @property {string} address1
 * @property {string} address2
 * @property {string} city
 * @property {string} phone
 * @property {number} negativeStock
 * @property {string} mirrorTableOnline
 * @property {string} commonCompany
 * @property {string} supplierCommonCompany
 * @property {string} productNameTamil
 */

/**
 * @typedef {Object} LoginResponse
 * @property {boolean} ok
 * @property {string} [message]
 * @property {User} user
 * @property {CompanyData} company
 * @property {string} cashierId
 * @property {string} cashId
 * @property {string} creditId
 * @property {string} customerCashId
 * @property {string} menuList
 * @property {any[]} menuData
 * @property {string} billPrintData
 * @property {string} customerReceiptPrintData
 * @property {any[]} comIdList
 * @property {any[]} mainData
 */