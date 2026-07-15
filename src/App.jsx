import { HashRouter, Routes, Route } from "react-router-dom";

// COMPONENTS
import Login from "./components/login";
import Dashboard from "./components/Dashboard";
import ItemMaster from "./components/Itemmaster";
import Companycreation from "./components/Companycreation";
// MASTER

import BrandMaster from "./Master/Brandmaster";
// import Area from "./Master/AreaMaster";
// import CustomerCardTypeMaster from "./Master/CustomerCardTypeMaster";

import CategoryMaster from "./Master/Categorymaster";
import DepartmentMaster from "./Master/DepartmentMaster";
import SupplierMaster from "./Master/SupplierMaster";
import UomMaster from "./Master/UomMaster";
import LocationMaster from "./Master/LocationMaster";
import CompanyMaster from "./Master/CompanyMaster";
import CashierMaster from "./Master/CashierMaster";
import SizeMaster from "./Master/SizeMaster";
import ColorMaster from "./Master/ColorMaster";
import ModelMaster from "./Master/ModelMaster";
import RateChange from "./Master/RateChange";
import CustomerMaster from "./Master/CustomerMaster";
import CustomerWiseSaleRate from "./Master/Customerwisesalerate";
import CardMaster from "./Master/CardMaster";
import GroupMaster from "./Master/GroupMaster";
import SalesManMaster from "./Master/SalesManMaster";
import CRMPointsMaster from "./Master/CRMPointsMaster";
import AccountsMaster from "./Master/AccountsMaster";
import SubCategoryMaster from "./Master/SubCategory";
import PurchaseMasterPage from "./presentation/pages/PurchaseMasterPage";

// TRANSACTIONS

import Estimate from "./Transaction/EstimateBill";
import SaleReturn from "./Transaction/SaleReturn";
import SaleOrder from "./Transaction/Saleorder";
import PurchasesMaster from "./Purchases/PurchasesMaster";
import CustomerReceipt from "./Transaction/Customerreceipt";
import PurchaseReturn from "./Transaction/Purchasereturn";
import Supplierpayment from "./Transaction/Supplierpayment";
import StockInward from "./Transaction/Stockinward";





import PhysicalStock from "./Transaction/PhysicalStock";
import Cashvoucher from "./Transaction/Cashvoucher";
import Bankvoucher from "./Transaction/Bankvoucher";
import Qutation from "./Transaction/Qutation";
import Purchaseorder from "./Transaction/Purchaseorder";
import Sales from "./Transaction/SaleBill";
import StockAdjustment from "./Transaction/StockAdjustment";
// UTILS
import PasswordSetting from "./Utiles/Passwordsetting";
import TransactionPassword from "./Utiles/TransactionPassword";
import Repackingmaster from "./Utiles/Repackingmaster";
import Menumastersetting from "./Utiles/Menumastersetting";
import Menucontrol from "./Utiles/Menucontrol";
import Menucontrolreport from "./Utiles/Menucontrolreport";
import Mainsetting from "./Utiles/Mainsetting";



// Reports
//import ReportSaleOrder from "./CrystalReport/SaleReport/SaleOrderReport";
//import SalesReportPart1 from "./CrystalReport/SaleReport/SalesReportPart1";
// import Quotation from "./CrystalReport/SaleReport/Quotation";
import SaleReturn1 from "./CrystalReport/SaleReport/SaleReturn";
// import EstimateReport from "./CrystalReport/SaleReport/EstimateReport";
// import DC from "./CrystalReport/SaleReport/DC";
import BranchWise from "./CrystalReport/SaleReport/BranchWise";


import CashVoucher from "./CrystalReport/Accounts Master/CashVoucher";
import BankVoucherReport from "./CrystalReport/Accounts Master/Bankvoucherreport";
import Cashbook from "./CrystalReport/Accounts Master/Cashbook";
import BankBook from "./CrystalReport/Accounts Master/BankBook";
import LedgerStatement from "./CrystalReport/Accounts Master/Ledgerstatement";
import GSTReportExcel from "./CrystalReport/Accounts Master/GSTReportExcel";

//src/CrystalReport/Purchase Order Master
import PurchaseOrderConsolidated from "./CrystalReport/Purchase Order Master/PurchaseOrderConsolidated";
import PurchaseOrderDetail from "./CrystalReport/Purchase Order Master/PurchaseOrderDetail";
import PurOrderItemwise from "./CrystalReport/Purchase Order Master/PurOrderItemwise";
//Purchase Master
import PurConsolidated from "./CrystalReport/Purchase Master/PurConsolidated";
import PurchaseDet from "./CrystalReport/Purchase Master/PurchaseDet";
import PurItemwise from "./CrystalReport/Purchase Master/PurItemwise";
//Iteam Master
import Itemlist from "./CrystalReport/ItemMaster/Itemlist";
import Reorder from "./CrystalReport/ItemMaster/Reorder";





// Reports
import ReportSaleOrder from "./CrystalReport/SaleReport/SaleOrderReport";
import SalesReportPart1 from "./CrystalReport/SaleReport/SalesReportPart1";
import ClosingStock from "./CrystalReport/Closingstock/Closingstock";



import Itemwisestockdetails from "./CrystalReport/Closingstock/Itemwisestockdetails";
import Inventoryqtywise from "./CrystalReport/Closingstock/Inventoryqtywise";
import Stockinouttransferreport from "./CrystalReport/Closingstock/Stockinouttransferreport";
import StockAdjustmentItemwise from "./CrystalReport/Closingstock/Stockadjustmentitemwise";
import Stockadjustment from "./CrystalReport/Closingstock/Stockadjustment";
import Physicalstockapplyreport from "./CrystalReport/Closingstock/Physicalstockapplyreport";
import DCBBranchReport from "./CrystalReport/Closingstock/Dcbbranchstockreport";
import Supplierlist from "./CrystalReport/SupplierMaster/Supplierlist";
import Supplierbalance from "./CrystalReport/SupplierMaster/Supplierbalance";
import SupplierDuePayment from "./CrystalReport/SupplierMaster/SupplierDuePayment";
import Supplierpayments from "./CrystalReport/SupplierMaster/Supplierpayments";
import Supplierpendingbillreport from "./CrystalReport/SupplierMaster/Supplierpendingbillreport";
import Supplierstatement from "./CrystalReport/SupplierMaster/Supplierstatement.jsx";
import SupplierAging from "./CrystalReport/SupplierMaster/Supplieragingreport.jsx";
import CustomerList from "./CrystalReport/CustomerMaster/CustomerList.jsx";
import CustomerPendingBill from "./CrystalReport/CustomerMaster/Customerpendingbillsreport.jsx";
import CustomerBalance from "./CrystalReport/CustomerMaster/Customerbalance.jsx";
import CustomerDue from "./CrystalReport/CustomerMaster/Customerduereport.jsx";
import CustomerStatement from "./CrystalReport/CustomerMaster/Customerstatement.jsx";
import CustomerAging from "./CrystalReport/CustomerMaster/Customeragingreport.jsx";
import CRMCustomer from "./CrystalReport/CustomerMaster/Crmcustomer.jsx";
//import Purchaseconsolidated from "./CrystalReport/PurchaseMaster/Purchaseconsolidated.jsx";


//import TruckStock from "./CrystalReport/Stock/TruckStock";




function App() {

  return (

    <HashRouter>



      <Routes>

     
      <Route path="/Companycreation" element={<Companycreation />} />
        {/* LOGIN */}
        <Route path="/" element={<Login />} />

        {/* DASHBOARD */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* ITEM */}
        <Route path="/Itemmaster" element={<ItemMaster />} />
        
        {/* MASTER */}
        <Route path="/Brand" element={<BrandMaster />} />
         {/* <Route path="/Area" element={<Area />} /> */}
        <Route path="/Category" element={<CategoryMaster />} />
        <Route path="/Department" element={<DepartmentMaster />} />
        <Route path="/Supplier" element={<SupplierMaster />} />
        <Route path="/UOM" element={<UomMaster />} />
        <Route path="/Location" element={<LocationMaster />} />
        <Route path="/CompanySetting" element={<CompanyMaster />} />
        <Route path="/Cashier" element={<CashierMaster />} />
        <Route path="/SizeMaster" element={<SizeMaster />} />
        <Route path="/ColorMaster" element={<ColorMaster />} />
        
         {/* <Route path="/CustomerCardTypeMaster" element={<CustomerCardTypeMaster />} /> */}
        <Route path="/ModelMaster" element={<ModelMaster />} />
        <Route path="/RateChange" element={<RateChange />} />
        <Route path="/Customer" element={<CustomerMaster />} />        
        <Route path="/Customer/CustomerWiseSalerate" element={<CustomerWiseSaleRate />}/>
        <Route path="/CardMaster" element={<CardMaster />} />
        <Route path="/GroupMaster" element={<GroupMaster />} />
        <Route path="/SalesMan" element={<SalesManMaster />} />
        <Route path="/CRMPoints" element={<CRMPointsMaster />} />
        <Route path="/AccountGroup" element={<AccountsMaster />} />
        <Route path="/Category/SubCategory" element={<SubCategoryMaster />} />
        <Route path="/PurchaseMasterPage" element={<PurchaseMasterPage />} />
       

        {/* UTILS */}
        <Route path="/PasswordSetting" element={<PasswordSetting />} />
        <Route path="/TransactionPassword" element={<TransactionPassword />} />
        <Route path="/repackingmaster" element={<Repackingmaster />} />
        <Route path="/UserRightsMenuMaster" element={<Menumastersetting />} />
        <Route path="/UserRightsMaster" element={<Menucontrol />} />
          {/* <Route path="/Mainsetting" element={<Mainsetting/>} /> */}
        <Route path="/UserRightsReport" element={<Menucontrolreport/>} />
        <Route path="/Mainsetting" element={<Mainsetting/>} />
        
        {/* Transaction */}
        <Route path="/Sale" element={<Sales />} />
        <Route path="/EstimateBill" element={<Estimate />} />
        <Route path="/purchase" element={<PurchasesMaster />} />
        <Route path="/SaleReturn" element={<SaleReturn />} />
        <Route path="/CustomerReceipt" element={<CustomerReceipt />} />
        <Route path="/Purchase" element={<PurchasesMaster />} />
        <Route path="/PurchaseReturn" element={<PurchaseReturn />} />
        <Route path="/Supplierpayment" element={<Supplierpayment />} />
        <Route path="/StockInward" element={<StockInward />} />
        <Route path="/Cash" element={<Cashvoucher />} />
        <Route path="/Bank" element={<Bankvoucher />} />
        <Route path="/Quotation" element={<Qutation />} />
        <Route path="/SaleOrder" element={<SaleOrder />} />
        
        <Route path="/Purchaseorder" element={<Purchaseorder />} />
        <Route path="/StockAdjustment" element={<StockAdjustment />} />
        {/* Reports */}
        <Route path="/Report/SaleOrder" element={<ReportSaleOrder />} />
        <Route path="/Report/SaleReportPart1" element={<SalesReportPart1 />} />
        {/* <Route path="/Report/Quotation" element={<Quotation />} /> */}

        {/* <Route path="/Report/Quotation" element={<EstimateReport />} /> */}
        {/* <Route path="/Report/Quotation" element={<DC />} /> */}
        <Route path="/Report/Quotation" element={<BranchWise />} />



        
        <Route path="/Report/SaleReturn" element={<SaleReturn1 />} /> 

        <Route path="/Report/CashVoucher" element={<CashVoucher />} />
        <Route path="/Report/BankVoucher" element={<BankVoucherReport />} />
        <Route path="/Report/Cashbook" element={<Cashbook />} />
        <Route path="/Report/BankBook" element={<BankBook />} />
        <Route path="/Report/LedgerStatement" element={<LedgerStatement />} />
        <Route path="/Report/GSTReportExcel" element={<GSTReportExcel />} />
        <Route path="/Report/PurchaseOrderConsolidated" element={<PurchaseOrderConsolidated />} />
        <Route path="/Report/PurchaseOrderDetail" element={<PurchaseOrderDetail />} />
        <Route
  path="/Report/PurOrderItemwise"
  element={<PurOrderItemwise />}
/>

{/* Purchase Master */}
<Route path="/Report/PurConsolidated" element={<PurConsolidated />} />
<Route path="/Report/PurDetails" element={<PurchaseDet />} />
<Route path="/Report/PurItemwise" element={<PurItemwise />} />
{/* Itemmaster     */}
<Route path="/Report/Itemlist" element={<Itemlist />} />
{/* <Route path="/Report/Reorder" element={<Reorder />} /> */}

<Route path="/Report/Reorder" element={<Reorder />} />
      

<Route path="/Report/SaleOrder" element={<ReportSaleOrder />} />
       
       <Route path="/Report/SaleReportPart1" element={<SalesReportPart1 />} />
       {/* <Route path="/Report/ClosingStock" element={<ClosingStock />} /> */}
       
       
       <Route path="/Report/ClosingStock" element={<ClosingStock />} />
      
       <Route path="/Report/Itemwisestockdetails" element={<Itemwisestockdetails />} />
       <Route path="/Report/Inventoryqtywise" element={<Inventoryqtywise />} />
       <Route path="/Report/StockInOutTrans" element={<Stockinouttransferreport />} />
       
       <Route path="/Report/StockAdjustment" element={<Stockadjustment />} />
       <Route path="/Report/StockAdjustmentItemwise" element={<StockAdjustmentItemwise />} />
       <Route path="/Report/PhysicalStockEntry" element={<Physicalstockapplyreport />} />
       <Route path="/Report/DCBBranchReport" element={<DCBBranchReport />} />
       <Route path="/Report/Supplierlist" element={<Supplierlist />} />
      <Route path="/Report/Supplierbalance" element={<Supplierbalance />} />
      <Route path="/Report/SupplierPayment" element={<Supplierpayments />} />
      <Route path="/Report/SupplierDuePayment" element={<SupplierDuePayment />} />
      <Route path="/Report/SupplierPending" element={<Supplierpendingbillreport />} />
      <Route path="/Report/SupplierStatement" element={<Supplierstatement />} />
       <Route path="/Report/SupplierAging" element={<SupplierAging />}  />
       <Route path="/Report/CustomerList" element={<CustomerList />} />
        <Route path="/Report/CustomerPendingBill" element={<CustomerPendingBill />} />
             <Route path="/Report/CustomerBalance" element={<CustomerBalance />} />
              <Route path="/Report/CustomerDue" element={<CustomerDue />} />
        <Route path="/Report/CustomerStatement" element={<CustomerStatement />} />
        <Route path="/Report/CustomerAging" element={<CustomerAging />}  />
        <Route path="/Report/CrmReport" element={<CRMCustomer />} />

{/* StockMaster */}

        {/* <Route path="/TruckStock" element={<TruckStock />} /> */}
 
      </Routes>

      </HashRouter>




  );
}

export default App;