import { BrowserRouter, Routes, Route } from "react-router-dom";

// ── Existing pages ──
import Login from "./components/login";
import Dashboard from "./components/Dashboard";
import ItemMaster from "./components/Itemmaster";
// ── Master pages ──
import BrandMaster from "./Master/BrandMaster";
import CategoryMaster from "./Master/CategoryMaster";
import DepartmentMaster from "./Master/DepartmentMaster";
import SupplierMaster from "./Master/SupplierMaster";
import UomMaster from "./Master/UomMaster";
import LocationMaster from "./Master/LocationMaster";
import CompanyMaster from "./Master/CompanyMaster";

import SizeMaster from "./Master/SizeMaster";
import ColorMaster from "./Master/ColorMaster";
import ModelMaster from "./Master/ModelMaster";
import RateChange from "./Master/RateChange";
import CustomerMaster from "./Master/CustomerMaster";
import CustomerWiseSaleRate from "./Master/Customerwisesalerate";
import CardMaster from "./Master/CardMaster"; // ✅ ADD THIS
import GroupMaster from "./Master/GroupMaster";
import SalesManMaster from "./Master/SalesManMaster";
import CRMPointsMaster from "./Master/CRMPointsMaster";
import AccountsMaster from "./Master/AccountsMaster";
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── OLD WORKING ROUTES ── */}
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/itemmaster" element={<ItemMaster />} />

        {/* ── NEW MASTER ROUTES ── */}
        <Route path="/brand-master" element={<BrandMaster />} />
        <Route path="/category-master" element={<CategoryMaster />} />
        <Route path="/department-master" element={<DepartmentMaster />} />
        <Route path="/supplier-master" element={<SupplierMaster />} />
        <Route path="/uom-master" element={<UomMaster />} />
        <Route path="/location-master" element={<LocationMaster />} />
        <Route path="/company-master" element={<CompanyMaster />} />
      
        <Route path="/size-master" element={<SizeMaster />} />
        <Route path="/color-master" element={<ColorMaster />} />
        <Route path="/model-master" element={<ModelMaster />} />
        <Route path="/RateChange" element={<RateChange />} />
        <Route path="/customer-master" element={<CustomerMaster />} />
        <Route path="/customer-wise-sale-rate" element={<CustomerWiseSaleRate />} />
        <Route path="/card-master" element={<CardMaster />} /> {/* ✅ ADD THIS */}
        <Route path="/group-master" element={<GroupMaster />} />
        <Route path="/sales-man-master" element={<SalesManMaster />} />
        <Route path="/crm-points-master" element={<CRMPointsMaster />} />
        <Route path="/accounts-master" element={<AccountsMaster />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;