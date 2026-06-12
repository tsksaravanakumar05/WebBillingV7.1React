import { HashRouter, Routes, Route } from "react-router-dom";

// COMPONENTS
import Login from "./components/login";
import Dashboard from "./components/Dashboard";
import ItemMaster from "./components/Itemmaster";

// MASTER
import BrandMaster from "./Master/Brandmaster";
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
import PurchasesMaster from "./Purchases/PurchasesMaster";
import CustomerReceipt from "./Transaction/Customerreceipt";
import PurchaseReturn from "./Transaction/Purchasereturn";
import Supplierpayment from "./Transaction/Supplierpayment";

// UTILS
import PasswordSetting from "./Utiles/Passwordsetting";
import TransactionPassword from "./Utiles/TransactionPassword";
import Repackingmaster from "./Utiles/Repackingmaster";

import Sales from "./Transaction/SaleBill";




function App() {

  return (

    <HashRouter>

      <Routes>

        {/* LOGIN */}
        <Route path="/" element={<Login />} />

        {/* DASHBOARD */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* ITEM */}
        <Route path="/Itemmaster" element={<ItemMaster />} />

        {/* MASTER */}
        <Route path="/Brand" element={<BrandMaster />} />
        <Route path="/Category" element={<CategoryMaster />} />
        <Route path="/Department" element={<DepartmentMaster />} />
        <Route path="/Supplier" element={<SupplierMaster />} />
        <Route path="/UOM" element={<UomMaster />} />
        <Route path="/Location" element={<LocationMaster />} />
        <Route path="/CompanySetting" element={<CompanyMaster />} />
        <Route path="/Cashier" element={<CashierMaster />} />
        <Route path="/SizeMaster" element={<SizeMaster />} />
        <Route path="/ColorMaster" element={<ColorMaster />} />
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

        {/* Transaction */}
        <Route path="/Sale" element={<Sales />} />
        <Route path="/EstimateBill" element={<Estimate />} />
        <Route path="/purchase" element={<PurchasesMaster />} />
        <Route path="/SaleReturn" element={<SaleReturn />} />
        <Route path="/CustomerReceipt" element={<CustomerReceipt />} />
        <Route path="/Purchase" element={<PurchasesMaster />} />
        <Route path="/PurchaseReturn" element={<PurchaseReturn />} />
        <Route path="/Supplierpayment" element={<Supplierpayment />} />

      </Routes>

      </HashRouter>

  );
}

export default App;