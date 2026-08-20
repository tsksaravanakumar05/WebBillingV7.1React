import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../Master/MasterPage.css";
import "./TripMaster.css";
import Topbar from "../components/Topbar";
import DateFieldDDMMYYYY from "../Commondatetime";
import * as CC from "../components/Common";
import * as MSG from "../components/Messages";
import { ChevronDown, ChevronRight, Edit3, ListFilter, RefreshCw, Save, Trash2, X } from "lucide-react";

const n = (v) => {
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : 0;
};
const f2 = (v) => n(v).toFixed(2);
const f3 = (v) => n(v).toFixed(3);
const today = () => new Date().toISOString().slice(0, 10);
const blankRow = () => ({
  _key: CC.uid(),
  Id: 0,
  SaleMasterRefid: 0,
  CustomerRefid: "",
  CustomerName: "",
  OpeningBalance: "0.00",
  NoOfBox: "0",
  LoadWt: "0.000",
  ETWT: "0.000",
  NetWt: "0.000",
  SaleRate: "0.00",
  Amount: "0.00",
  Remarks1: "",
  MobileNo: "",
});

const dateOnly = (value) => {
  if (!value) return "";
  const raw = String(value).trim();
  const json = /\/Date\((\d+)\)\//.exec(raw);
  if (json) return new Date(Number(json[1])).toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const dm = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(raw);
  if (dm) {
    const a = dm[1].padStart(2, "0");
    const b = dm[2].padStart(2, "0");
    const y = dm[3];
    return Number(dm[1]) > 12 ? `${y}-${b}-${a}` : `${y}-${a}-${b}`;
  }
  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
};

const listFrom = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.Data1)) return res.Data1;
  if (Array.isArray(res?.Data)) return res.Data;
  return [];
};

export default function TripMaster() {
  const navigate = useNavigate();
  const { confirm, ConfirmUI } = MSG.useConfirm();
  const { toast, toasts } = MSG.useToast();
  const formRefs = useRef({});
  const gridRefs = useRef({});

  const session = useMemo(() => {
    const main = CC.getLocal("Mainsetting")?.[0] || {};
    return {
      Comid: Number(localStorage.getItem("Comid") || main.Comid || 0),
      MComid: Number(localStorage.getItem("MComid") || main.MComid || localStorage.getItem("Comid") || 0),
      CashierId: Number(localStorage.getItem("CashierId") || localStorage.getItem("CashierRefId") || 0),
      CompanyName: localStorage.getItem("CompanyName") || main.CompanyName || "",
      BillType: main.BillNoType || localStorage.getItem("BillNoType") || "",
      BillPrefix: main.BillNoPrefix || localStorage.getItem("BillNoPrefix") || "",
      BillDigit: main.BillNoNumberDigit || localStorage.getItem("BillNoNumberDigit") || 0,
      BillFormat: main.SalesA4FullName || "",
      WhatsApp: main.WhatsupBillSend ? "1" : "0",
      WhatsURL: main.WhatsAppURL || "",
      TripMasterLWEWDetails: !!main.TripMasterLWEWDetails,
    };
  }, []);

  const [perm, setPerm] = useState({ View: 1, Add: 1, Edit: 1, Delete: 1 });
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState("");
  const [tripNo, setTripNo] = useState("");
  const [tripDate, setTripDate] = useState(today());
  const [supplierId, setSupplierId] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [productCode, setProductCode] = useState("1");
  const [purchaseId, setPurchaseId] = useState(0);
  const [purchaseQty, setPurchaseQty] = useState("");
  const [purchaseRate, setPurchaseRate] = useState("");
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [wastageStock, setWastageStock] = useState("0.000");
  const [remainingStock, setRemainingStock] = useState("0.000");
  const [noOfBox, setNoOfBox] = useState("");
  const [noOfBirds, setNoOfBirds] = useState("");
  const [location, setLocation] = useState("");
  const [dieselRate, setDieselRate] = useState("");
  const [mileage, setMileage] = useState("0.00");
  const [remarks, setRemarks] = useState("");

  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [stKM, setStKM] = useState("");
  const [endKM, setEndKM] = useState("");
  const [returnKM, setReturnKM] = useState("");
  const [rateKM, setRateKM] = useState("");
  const [tripRent, setTripRent] = useState("0.00");
  const [loadingCharge, setLoadingCharge] = useState("");
  const [unloadingCharge, setUnloadingCharge] = useState("");
  const [tollgate, setTollgate] = useState("");
  const [pc, setPc] = useState("");
  const [rto, setRto] = useState("");
  const [checkpost, setCheckpost] = useState("");
  const [water, setWater] = useState("");
  const [travel, setTravel] = useState("");
  const [tea, setTea] = useState("");
  const [food, setFood] = useState("");
  const [driverBeta, setDriverBeta] = useState("");
  const [bus, setBus] = useState("");
  const [air, setAir] = useState("");
  const [sanal, setSanal] = useState("");
  const [grease, setGrease] = useState("");

  const [rows, setRows] = useState([blankRow()]);
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [listOpen, setListOpen] = useState(false);
  const [tripPopupOpen, setTripPopupOpen] = useState(false);
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());
  const [viewMaster, setViewMaster] = useState([]);
  const [viewDetails, setViewDetails] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  const saleQty = useMemo(() => rows.reduce((sum, r) => sum + n(r.NetWt), 0), [rows]);
  const saleAmount = useMemo(() => rows.reduce((sum, r) => sum + n(r.Amount), 0), [rows]);
  const totalKM = useMemo(() => n(endKM) - n(stKM) + n(returnKM), [endKM, stKM, returnKM]);
  const totalExpense = useMemo(() => (
    n(air) + n(loadingCharge) + n(unloadingCharge) + n(pc) + n(tollgate) + n(rto)
    + n(checkpost) + n(water) + n(travel) + n(tea) + n(food) + n(driverBeta)
  ), [air, checkpost, driverBeta, food, loadingCharge, pc, rto, tea, tollgate, travel, unloadingCharge, water]);
  const tripAmount = useMemo(() => n(tripRent) + totalExpense, [tripRent, totalExpense]);
  const grossProfit = useMemo(() => saleAmount - n(purchaseAmount), [purchaseAmount, saleAmount]);
  const netProfit = useMemo(() => grossProfit - tripAmount, [grossProfit, tripAmount]);

  const selectedSupplier = suppliers.find((s) => String(s.Id) === String(supplierId));

  const setFormRef = (name) => (el) => {
    if (el) formRefs.current[name] = el;
  };

  const focusControl = useCallback((el) => {
    if (!el) return;
    el.focus();
    if (typeof el.select === "function") el.select();
  }, []);

  const focusForm = useCallback((name) => {
    focusControl(formRefs.current[name] || document.getElementById(name));
  }, [focusControl]);

  const handleFormEnter = useCallback((nextName) => (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (nextName === "firstCustomer") {
      const first = rows[0];
      if (first) setTimeout(() => focusControl(gridRefs.current[`${first._key}_CustomerRefid`]), 0);
      return;
    }
    setTimeout(() => focusForm(nextName), 0);
  }, [focusControl, focusForm, rows]);

  const setGridRef = (key, field) => (el) => {
    if (el) gridRefs.current[`${key}_${field}`] = el;
  };

  const focusGrid = useCallback((key, field) => {
    focusControl(gridRefs.current[`${key}_${field}`]);
  }, [focusControl]);

  const handleGridEnter = useCallback((row, field) => (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const order = ["CustomerRefid", "OpeningBalance", "NoOfBox", "LoadWt", "ETWT", "SaleRate", "Remarks1"];
    const currentIndex = order.indexOf(field);
    const nextField = order[currentIndex + 1];
    if (nextField) {
      focusGrid(row._key, nextField);
      return;
    }
    const rowIndex = rows.findIndex((r) => r._key === row._key);
    const nextRow = rows[rowIndex + 1];
    if (nextRow) {
      setTimeout(() => focusGrid(nextRow._key, "CustomerRefid"), 0);
      return;
    }
    focusForm("stKM");
  }, [focusForm, focusGrid, rows]);

  const toggleTripPopup = useCallback(() => {
    setTripPopupOpen((open) => {
      const next = !open;
      if (next) setTimeout(() => focusForm("vehicle"), 0);
      return next;
    });
  }, [focusForm]);

  const calcRow = useCallback((row) => {
    const next = { ...row };
    next.NetWt = f3(n(next.LoadWt) - n(next.ETWT));
    next.Amount = f2(n(next.NetWt) * n(next.SaleRate));
    return next;
  }, []);

  const recalcStock = useCallback((qty, sale, wastage) => {
    setRemainingStock(f3(n(qty) - (n(sale) + n(wastage))));
  }, []);

  const loadMaxNo = useCallback(async () => {
    const res = await CC.api(CC.TripMaxNo, null, {}, { Comid: session.Comid });
    const data = listFrom(res);
    const val = res?.MaxNo ?? res?.No ?? res?.data ?? res?.Data1 ?? data?.[0]?.MaxNo ?? data?.[0]?.No ?? data?.[0]?.TripNo;
    setTripNo(String(val || ""));
  }, [session.Comid]);

  const clearForm = useCallback(async () => {
    setEditId("");
    setTripDate(today());
    setSupplierId("");
    setSupplierSearch("");
    setProductCode("1");
    setPurchaseId(0);
    setPurchaseQty("");
    setPurchaseRate("");
    setPurchaseAmount("");
    setWastageStock("0.000");
    setRemainingStock("0.000");
    setNoOfBox("");
    setNoOfBirds("");
    setLocation("");
    setDieselRate("");
    setMileage("0.00");
    setRemarks("");
    setDriverId("");
    setVehicleId("");
    setStKM("");
    setEndKM("");
    setReturnKM("");
    setRateKM("");
    setTripRent("0.00");
    setLoadingCharge("");
    setUnloadingCharge("");
    setTollgate("");
    setPc("");
    setRto("");
    setCheckpost("");
    setWater("");
    setTravel("");
    setTea("");
    setFood("");
    setDriverBeta("");
    setBus("");
    setAir("");
    setSanal("");
    setGrease("");
    setRows([blankRow()]);
    await loadMaxNo();
  }, [loadMaxNo]);

  const loadCombos = useCallback(async () => {
    setLoading(true);
    try {
      const [supRes, custRes, driverRes, vehicleRes] = await Promise.all([
        CC.api(CC.GetSupplierAll, null, {}, { Comid: session.MComid || session.Comid, AccountType: "SUPPLIER" }),
        CC.api(CC.GetSupplierAll, null, {}, { Comid: session.Comid, AccountType: "CUSTOMER" }),
        CC.api(CC.DriverSelect, null, {}, { Comid: session.Comid }),
        CC.api(CC.VehicleSelect, null, {}, { Comid: session.Comid }),
      ]);
      setSuppliers(listFrom(supRes));
      setCustomers(listFrom(custRes));
      setDrivers(listFrom(driverRes));
      setVehicles(listFrom(vehicleRes));
      await loadMaxNo();
    } catch (err) {
      toast(err.message || MSG.TRIP_MESSAGES.technicalFault, true);
    } finally {
      setLoading(false);
    }
  }, [loadMaxNo, session.Comid, session.MComid, toast]);

  useEffect(() => {
    const menu = CC.getLocal("menulist") || CC.getLocal("menudata") || [];
    const row = Array.isArray(menu)
      ? menu.find((m) => ["TRIP", "TRIP MASTER", "TRIPMASTER"].includes(String(m.PageName || m.MenuName || "").trim().toUpperCase()))
      : null;
    if (row) setPerm({ View: row.View ?? 1, Add: row.Add ?? 1, Edit: row.Edit ?? 1, Delete: row.Delete ?? 1 });
    loadCombos();
  }, [loadCombos]);

  useEffect(() => {
    setTripRent(f2(totalKM * n(rateKM)));
  }, [rateKM, totalKM]);

  useEffect(() => {
    recalcStock(purchaseQty, saleQty, wastageStock);
  }, [purchaseQty, recalcStock, saleQty, wastageStock]);

  useEffect(() => {
    setPurchaseAmount(purchaseQty || purchaseRate ? f2(n(purchaseQty) * n(purchaseRate)) : "");
  }, [purchaseQty, purchaseRate]);

  const updateRow = (key, field, value) => {
    setRows((prev) => {
      const next = prev.map((r) => r._key === key ? calcRow({ ...r, [field]: value }) : r);
      const last = next[next.length - 1];
      if (last.CustomerName || last.CustomerRefid || n(last.SaleRate) || n(last.LoadWt)) next.push(blankRow());
      return next;
    });
  };

  const pickCustomer = (key, value) => {
    const c = customers.find((x) => String(x.Id) === String(value));
    setRows((prev) => prev.map((r) => r._key === key ? {
      ...r,
      CustomerRefid: c?.Id || "",
      CustomerName: c?.AccountName || c?.CustomerName || "",
      OpeningBalance: f2(c?.CurrentBalance ?? c?.Balance ?? c?.OpeningBalance ?? 0),
      MobileNo: c?.MobileNo || "",
    } : r));
  };

  const deleteRow = (key) => {
    setRows((prev) => {
      const next = prev.filter((r) => r._key !== key);
      return next.length ? next : [blankRow()];
    });
  };

  const buildDetails = () => rows
    .filter((r) => r.CustomerRefid || r.CustomerName || n(r.SaleRate) || n(r.NetWt))
    .map((r) => ({
      Id: Number(r.Id || 0),
      ProdCode: productCode,
      CustomerName: r.CustomerName || "",
      MobileNo: r.MobileNo || "",
      SaleMasterRefid: Number(r.SaleMasterRefid || 0),
      CustomerRefid: Number(r.CustomerRefid || 0),
      RefDate: CC.toApiMDY(tripDate),
      NoOfBox: n(r.NoOfBox),
      LoadWt: n(r.LoadWt),
      ETWT: n(r.ETWT),
      OpeningBalance: n(r.OpeningBalance),
      NetWt: n(r.NetWt),
      Amount: n(r.Amount),
      SaleRate: n(r.SaleRate),
      Remarks1: r.Remarks1 || "",
      TCSPer: 0,
      TCSAmount: 0,
    }));

  const buildMaster = () => ({
    Id: Number(editId || 0),
    CompanyRefId: session.Comid,
    RefNo: n(tripNo),
    PId: Number(purchaseId || 0),
    SupplierRefid: Number(supplierId || 0),
    ProductCode: productCode,
    ProdCode: productCode,
    RefDate: CC.toApiMDY(tripDate),
    RemainingStock: n(remainingStock),
    WastageStock: n(wastageStock),
    StKM: n(stKM),
    EndKM: n(endKM),
    RtKM: n(returnKM),
    Loading: n(loadingCharge),
    UnLoading: n(unloadingCharge),
    RateKM: n(rateKM),
    TripAmount: n(tripRent),
    DieselRate: n(dieselRate),
    Water: n(water),
    Travel: n(travel),
    RTO: n(rto),
    DriverBeta: n(driverBeta),
    Food: n(food),
    Tea: n(tea),
    Checkpost: n(checkpost),
    Tollgate: n(tollgate),
    PC: n(pc),
    Bus: n(bus),
    Air: n(air),
    Sanal: n(sanal),
    Grease: n(grease),
    NoofBox1: n(noOfBox),
    NoOfBox: n(noOfBox),
    PurchaseQty: n(purchaseQty),
    OldPurchaseQty: n(purchaseQty),
    PurchaseRate: n(purchaseRate),
    PurchaseAmount: n(purchaseAmount),
    SaleQty: n(saleQty),
    SaleAmount: n(saleAmount),
    Remarks: remarks,
    Location: location,
    Mileage: n(mileage),
    NoofBirds: n(noOfBirds),
    DriverMasterRefId: Number(driverId || 0),
    VehicleMasterRefId: Number(vehicleId || 0),
    TripMasterLWEWDetails: session.TripMasterLWEWDetails,
    TripDetailsModel: buildDetails(),
  });

  const saveTrip = useCallback(async () => {
    if (!(editId ? perm.Edit : perm.Add)) {
      toast("Permission denied", true);
      return;
    }
    if (!supplierId) return toast(MSG.TRIP_MESSAGES.supplierRequired, true);
    if (!purchaseQty) return toast(MSG.TRIP_MESSAGES.purchaseQtyRequired, true);
    if (!purchaseRate) return toast(MSG.TRIP_MESSAGES.purchaseRateRequired, true);
    if (!purchaseAmount) return toast(MSG.TRIP_MESSAGES.purchaseAmountRequired, true);
    if (!tripNo) return toast(MSG.TRIP_MESSAGES.refNoRequired, true);
    const details = buildDetails();
    if (!details.length) return toast(MSG.TRIP_MESSAGES.salesRequired, true);
    if (!await confirm(MSG.TRIP_MESSAGES.saveConfirm)) return;

    setLoading(true);
    try {
      const [creditId, expenseId] = await Promise.all([
        CC.getSundryDebtorsAccountId(session.MComid || session.Comid),
        CC.getTripExpenseAccountId(session.MComid || session.Comid),
      ]);
      const payload = [{ ...buildMaster(), TripDetailsModel: details }];
      const res = await CC.insertTripMaster(payload, {
        Comid: String(session.Comid),
        MComid: String(session.MComid || session.Comid),
        CashierId: String(session.CashierId || 0),
        CreditId: String(creditId || 0),
        BillType: session.BillType,
        BillPerfix: session.BillPrefix,
        CompanyName: session.CompanyName,
        BillDigit: String(session.BillDigit || 0),
        ProductId: productCode,
        ExpenseId: String(expenseId || 0),
        BillFormat: session.BillFormat,
        WhatsApp: session.WhatsApp,
        WhatsURL: session.WhatsURL,
        MirrorTable: "0",
        LocalDB: "0",
      });
      if (!(res.ok ?? res.IsSuccess ?? true)) return toast(res.message || res.Message || MSG.TRIP_MESSAGES.technicalFault, true);
      toast(MSG.TRIP_MESSAGES.saveSuccess);
      await clearForm();
    } finally {
      setLoading(false);
    }
  }, [buildDetails, buildMaster, clearForm, confirm, editId, perm.Add, perm.Edit, productCode, purchaseAmount, purchaseQty, purchaseRate, session, supplierId, toast, tripNo]);

  const loadTripList = useCallback(async () => {
    if (!perm.View && !perm.Edit) return toast("View permission denied", true);
    setLoading(true);
    try {
      const res = await CC.selectTripList({ Comid: session.Comid, Fromdate: fromDate, Todate: toDate, Id: 0 });
      if (!(res.ok ?? res.IsSuccess ?? true)) return toast(res.message || MSG.TRIP_MESSAGES.loadFailed, true);
      const root = Array.isArray(res) ? res[0] : (res.Data1?.[0] || res.data?.[0] || res.Data?.[0] || {});
      const masters = root.tripmaster || root.TripMaster || root.tripMaster || listFrom(res);
      const details = root.tripDetails || root.TripDetails || root.tripdetails || [];
      setViewMaster(masters);
      setViewDetails(details);
      setExpandedId(null);
      setListOpen(true);
    } catch (err) {
      toast(err.message || MSG.TRIP_MESSAGES.loadFailed, true);
    } finally {
      setLoading(false);
    }
  }, [fromDate, perm.Edit, perm.View, session.Comid, toDate, toast]);

  const loadEdit = useCallback(async (id) => {
    if (!perm.Edit) return toast("Edit permission denied", true);
    setLoading(true);
    try {
      const res = await CC.editTripMaster({ Id: id, PNo: 0, Comid: session.Comid, TripMasterLWEWDetails: session.TripMasterLWEWDetails });
      if (!(res.ok ?? res.IsSuccess ?? true)) return toast(res.message || MSG.TRIP_MESSAGES.loadFailed, true);
      const list = listFrom(res);
      const m = list[0] || {};
      setEditId(String(m.Id || id));
      setTripNo(String(m.RefNo ?? m.TripNo ?? ""));
      setTripDate(dateOnly(m.RefDate || m.TripDate) || today());
      setPurchaseId(Number(m.PId || 0));
      setSupplierId(String(m.SupplierRefid || ""));
      setSupplierSearch(m.SupplierName || "");
      setProductCode(m.ProductCode || m.ProdCode || "1");
      setPurchaseQty(String(m.PurchaseQty ?? ""));
      setPurchaseRate(String(m.PurchaseRate ?? ""));
      setPurchaseAmount(String(m.PurchaseAmount ?? ""));
      setRemainingStock(String(m.RemainingStock ?? "0.000"));
      setWastageStock(String(m.WastageStock ?? "0.000"));
      setNoOfBox(String(m.NoofBox1 ?? m.NoOfBox ?? ""));
      setNoOfBirds(String(m.NoofBirds ?? ""));
      setLocation(m.Location || "");
      setDieselRate(String(m.DieselRate ?? ""));
      setMileage(String(m.Mileage ?? "0.00"));
      setRemarks(m.Remarks || "");
      setDriverId(String(m.DriverMasterRefId || ""));
      setVehicleId(String(m.VehicleMasterRefId || ""));
      setStKM(String(m.StKM ?? ""));
      setEndKM(String(m.EndKM ?? ""));
      setReturnKM(String(m.RtKM ?? ""));
      setRateKM(String(m.RateKM ?? ""));
      setTripRent(String(m.TripAmount ?? "0.00"));
      setLoadingCharge(String(m.Loading ?? ""));
      setUnloadingCharge(String(m.UnLoading ?? ""));
      setTollgate(String(m.Tollgate ?? ""));
      setPc(String(m.PC ?? ""));
      setRto(String(m.RTO ?? ""));
      setCheckpost(String(m.Checkpost ?? ""));
      setWater(String(m.Water ?? ""));
      setTravel(String(m.Travel ?? ""));
      setTea(String(m.Tea ?? ""));
      setFood(String(m.Food ?? ""));
      setDriverBeta(String(m.DriverBeta ?? ""));
      setBus(String(m.Bus ?? ""));
      setAir(String(m.Air ?? ""));
      setSanal(String(m.Sanal ?? ""));
      setGrease(String(m.Grease ?? ""));
      const detailRows = (m.TripDetailsModel || m.tripDetailsModel || []).map((d) => calcRow({
        ...blankRow(),
        Id: d.Id || 0,
        SaleMasterRefid: d.SaleMasterRefid || 0,
        CustomerRefid: d.CustomerRefid || "",
        CustomerName: d.CustomerName || "",
        OpeningBalance: String(d.OpeningBalance ?? "0.00"),
        NoOfBox: String(d.NoOfBox ?? "0"),
        LoadWt: String(d.LoadWt ?? "0.000"),
        ETWT: String(d.ETWT ?? "0.000"),
        NetWt: String(d.NetWt ?? "0.000"),
        SaleRate: String(d.SaleRate ?? "0.00"),
        Amount: String(d.Amount ?? "0.00"),
        Remarks1: d.Remarks1 || "",
        MobileNo: d.MobileNo || "",
      }));
      setRows([...detailRows, blankRow()]);
      setListOpen(false);
    } finally {
      setLoading(false);
    }
  }, [calcRow, perm.Edit, session.Comid, session.TripMasterLWEWDetails, toast]);

  const deleteTrip = useCallback(async (id = editId) => {
    if (!id) return toast("Select trip first", true);
    if (!perm.Delete) return toast("Delete permission denied", true);
    if (!await confirm(MSG.TRIP_MESSAGES.deleteConfirm)) return;
    setLoading(true);
    try {
      const payload = buildDetails();
      const res = await CC.deleteTripMaster(payload, {
        Comid: String(session.Comid),
        MirrorTable: "0",
        Updateid: "",
        ProductId: productCode,
        PId: String(purchaseId || 0),
        LocalDB: "0",
        DateNew: CC.toApiMDY(tripDate),
        PurchaseQty: String(purchaseQty || 0),
        OldPurchaseQty: String(purchaseQty || 0),
        Id: String(id),
      });
      if (!(res.ok ?? res.IsSuccess ?? true)) return toast(res.message || res.Message || MSG.TRIP_MESSAGES.technicalFault, true);
      toast(MSG.TRIP_MESSAGES.deleteSuccess);
      await clearForm();
      if (listOpen) await loadTripList();
    } finally {
      setLoading(false);
    }
  }, [buildDetails, clearForm, confirm, editId, listOpen, loadTripList, perm.Delete, productCode, purchaseId, purchaseQty, session.Comid, toast, tripDate]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "F1") { e.preventDefault(); saveTrip(); }
      if (e.key === "F5") { e.preventDefault(); loadTripList(); }
      if (e.key === "F6") { e.preventDefault(); toggleTripPopup(); }
      if (e.key === "F9") { e.preventDefault(); deleteTrip(); }
      if (e.key === "F10") { e.preventDefault(); clearForm(); }
      if (e.key === "Escape") {
        e.preventDefault();
        if (tripPopupOpen) setTripPopupOpen(false);
        else if (listOpen) setListOpen(false);
        else navigate(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearForm, deleteTrip, listOpen, loadTripList, navigate, saveTrip, toggleTripPopup, tripPopupOpen]);

  const saleDetailFor = (id) => viewDetails.filter((d) => String(d.Id || d.TripMasterRefid || d.TripMasterRefId) === String(id));

  return (
    <div className="trip-page">
      <Topbar />
      <div className="trip-shell">
        <div className="trip-toolbar">
          <button className="trip-btn primary" onClick={saveTrip}><Save size={15} /> F1 Save</button>
          <button className="trip-btn" onClick={loadTripList}><ListFilter size={15} /> F5 View</button>
          <button className="trip-btn danger" onClick={() => deleteTrip()}><Trash2 size={15} /> F9 Delete</button>
          <button className="trip-btn warn" onClick={clearForm}><RefreshCw size={15} /> F10 Clear</button>
        </div>

        <div className="trip-top">
          <fieldset className="trip-card trip-card-small">
            <legend>Trip Details</legend>
            <label>Trip No</label>
            <input ref={setFormRef("tripNo")} className="trip-input" value={tripNo} onChange={(e) => setTripNo(e.target.value)} onKeyDown={handleFormEnter("trip-date")} />
            <label>Trip Date</label>
            <DateFieldDDMMYYYY id="trip-date" value={tripDate} onChange={setTripDate} onEnter={() => focusForm("productCode")} />
            <label>Product Code</label>
            <input ref={setFormRef("productCode")} className="trip-input" value={productCode} onChange={(e) => setProductCode(e.target.value)} onKeyDown={handleFormEnter("supplier")} />
          </fieldset>

          <fieldset className="trip-card trip-card-wide">
            <legend>Supplier / Vehicle</legend>
            <div className="trip-grid-4">
              <label>Supplier</label>
              <select ref={setFormRef("supplier")} className="trip-input" value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setSupplierSearch(suppliers.find((s) => String(s.Id) === e.target.value)?.AccountName || ""); }} onKeyDown={handleFormEnter("noOfBox")}>
                <option value="">Select SupplierName</option>
                {suppliers.map((s) => <option key={s.Id} value={s.Id}>{s.AccountName || s.SupplierName}</option>)}
              </select>
              <label>Driver</label>
              <select ref={setFormRef("driver")} className="trip-input" value={driverId} onChange={(e) => setDriverId(e.target.value)} onKeyDown={handleFormEnter("vehicle")}>
                <option value="">Select Driver</option>
                {drivers.map((d) => <option key={d.Id} value={d.Id}>{d.DriverName}</option>)}
              </select>
              <label>Address</label>
              <input className="trip-input" value={selectedSupplier?.Address1 || selectedSupplier?.Address || ""} readOnly />
              <label>Vehicle</label>
              <select ref={setFormRef("vehicle")} className="trip-input" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} onKeyDown={handleFormEnter("purchaseQty")}>
                <option value="">Select Vehicle</option>
                {vehicles.map((v) => <option key={v.Id} value={v.Id}>{v.VehicleNo}</option>)}
              </select>
              <label>City</label>
              <input className="trip-input" value={selectedSupplier?.City || ""} readOnly />
              <label>Contact No</label>
              <input className="trip-input" value={selectedSupplier?.MobileNo || selectedSupplier?.PhoneNo || ""} readOnly />
            </div>
          </fieldset>

          <div className="trip-amount-card">
            <span>Trip Amount</span>
            <strong>Rs.{f2(tripAmount)}</strong>
            <small>Total KM : {f2(totalKM)}</small>
          </div>
        </div>

        <div className="trip-purchase-strip">
          <label>Purchase Qty</label><input ref={setFormRef("purchaseQty")} className="trip-input right" value={purchaseQty} onChange={(e) => setPurchaseQty(e.target.value)} onKeyDown={handleFormEnter("purchaseRate")} />
          <label>Purchase Rate</label><input ref={setFormRef("purchaseRate")} className="trip-input right" value={purchaseRate} onChange={(e) => setPurchaseRate(e.target.value)} onKeyDown={handleFormEnter("noOfBirds")} />
          <label>Purchase Amount</label><input ref={setFormRef("purchaseAmount")} className="trip-input right" value={purchaseAmount} onChange={(e) => setPurchaseAmount(e.target.value)} onKeyDown={handleFormEnter("wastageStock")} />
          <label>Wastage</label><input ref={setFormRef("wastageStock")} className="trip-input right" value={wastageStock} onChange={(e) => setWastageStock(e.target.value)} onKeyDown={handleFormEnter("noOfBox")} />
          <label>Remaining</label><input className="trip-input right" value={remainingStock} readOnly />
          <label>No.Box</label><input ref={setFormRef("noOfBox")} className="trip-input right" value={noOfBox} onChange={(e) => setNoOfBox(e.target.value)} onKeyDown={handleFormEnter("purchaseQty")} />
          <label>Birds</label><input ref={setFormRef("noOfBirds")} className="trip-input right" value={noOfBirds} onChange={(e) => setNoOfBirds(e.target.value)} onKeyDown={handleFormEnter("firstCustomer")} />
        </div>

        <div className="trip-grid-wrap">
          <table className="trip-table">
            <thead>
              <tr>
                <th>S.No</th><th>Customer</th><th>Cur.Bal</th><th>Box</th><th>Load WT</th><th>MT WT</th><th>Net WT</th><th>Sale Rate</th><th>Amount</th><th>Remarks</th><th>Del</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r._key}>
                  <td className="center">{idx + 1}</td>
                  <td>
                    <select ref={setGridRef(r._key, "CustomerRefid")} className="trip-cell" value={r.CustomerRefid} onChange={(e) => pickCustomer(r._key, e.target.value)} onKeyDown={handleGridEnter(r, "CustomerRefid")}>
                      <option value="">{r.CustomerName || "Select Customer"}</option>
                      {customers.map((c) => <option key={c.Id} value={c.Id}>{c.AccountName || c.CustomerName}</option>)}
                    </select>
                  </td>
                  <td><input ref={setGridRef(r._key, "OpeningBalance")} className="trip-cell right" value={r.OpeningBalance} onChange={(e) => updateRow(r._key, "OpeningBalance", e.target.value)} onKeyDown={handleGridEnter(r, "OpeningBalance")} /></td>
                  <td><input ref={setGridRef(r._key, "NoOfBox")} className="trip-cell right" value={r.NoOfBox} onChange={(e) => updateRow(r._key, "NoOfBox", e.target.value)} onKeyDown={handleGridEnter(r, "NoOfBox")} /></td>
                  <td><input ref={setGridRef(r._key, "LoadWt")} className="trip-cell right" value={r.LoadWt} onChange={(e) => updateRow(r._key, "LoadWt", e.target.value)} onKeyDown={handleGridEnter(r, "LoadWt")} /></td>
                  <td><input ref={setGridRef(r._key, "ETWT")} className="trip-cell right" value={r.ETWT} onChange={(e) => updateRow(r._key, "ETWT", e.target.value)} onKeyDown={handleGridEnter(r, "ETWT")} /></td>
                  <td><input className="trip-cell right" value={r.NetWt} readOnly tabIndex={-1} /></td>
                  <td><input ref={setGridRef(r._key, "SaleRate")} className="trip-cell right" value={r.SaleRate} onChange={(e) => updateRow(r._key, "SaleRate", e.target.value)} onKeyDown={handleGridEnter(r, "SaleRate")} /></td>
                  <td><input className="trip-cell right" value={r.Amount} readOnly tabIndex={-1} /></td>
                  <td><input ref={setGridRef(r._key, "Remarks1")} className="trip-cell" value={r.Remarks1} onChange={(e) => updateRow(r._key, "Remarks1", e.target.value)} onKeyDown={handleGridEnter(r, "Remarks1")} /></td>
                  <td className="center"><button className="trip-icon-btn" onClick={() => deleteRow(r._key)}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="trip-bottom">
          <fieldset className="trip-card">
            <legend>KM / Expenses</legend>
            <div className="trip-exp-grid">
              <label>Start KM</label><input ref={setFormRef("stKM")} className="trip-input right" value={stKM} onChange={(e) => setStKM(e.target.value)} onKeyDown={handleFormEnter("endKM")} />
              <label>End KM</label><input ref={setFormRef("endKM")} className="trip-input right" value={endKM} onChange={(e) => setEndKM(e.target.value)} onKeyDown={handleFormEnter("returnKM")} />
              <label>Return KM</label><input ref={setFormRef("returnKM")} className="trip-input right" value={returnKM} onChange={(e) => setReturnKM(e.target.value)} onKeyDown={handleFormEnter("rateKM")} />
              <label>Rate/KM</label><input ref={setFormRef("rateKM")} className="trip-input right" value={rateKM} onChange={(e) => setRateKM(e.target.value)} onKeyDown={handleFormEnter("tripRent")} />
              <label>Trip Rent</label><input ref={setFormRef("tripRent")} className="trip-input right" value={tripRent} onChange={(e) => setTripRent(e.target.value)} onKeyDown={handleFormEnter("loadingCharge")} />
              <label>Loading</label><input ref={setFormRef("loadingCharge")} className="trip-input right" value={loadingCharge} onChange={(e) => setLoadingCharge(e.target.value)} onKeyDown={handleFormEnter("unloadingCharge")} />
              <label>Unloading</label><input ref={setFormRef("unloadingCharge")} className="trip-input right" value={unloadingCharge} onChange={(e) => setUnloadingCharge(e.target.value)} onKeyDown={handleFormEnter("tollgate")} />
              <label>Tollgate</label><input ref={setFormRef("tollgate")} className="trip-input right" value={tollgate} onChange={(e) => setTollgate(e.target.value)} onKeyDown={handleFormEnter("pc")} />
              <label>PC</label><input ref={setFormRef("pc")} className="trip-input right" value={pc} onChange={(e) => setPc(e.target.value)} onKeyDown={handleFormEnter("rto")} />
              <label>RTO</label><input ref={setFormRef("rto")} className="trip-input right" value={rto} onChange={(e) => setRto(e.target.value)} onKeyDown={handleFormEnter("checkpost")} />
              <label>Checkpost</label><input ref={setFormRef("checkpost")} className="trip-input right" value={checkpost} onChange={(e) => setCheckpost(e.target.value)} onKeyDown={handleFormEnter("water")} />
              <label>Water</label><input ref={setFormRef("water")} className="trip-input right" value={water} onChange={(e) => setWater(e.target.value)} onKeyDown={handleFormEnter("travel")} />
              <label>Travel</label><input ref={setFormRef("travel")} className="trip-input right" value={travel} onChange={(e) => setTravel(e.target.value)} onKeyDown={handleFormEnter("tea")} />
              <label>Tea</label><input ref={setFormRef("tea")} className="trip-input right" value={tea} onChange={(e) => setTea(e.target.value)} onKeyDown={handleFormEnter("food")} />
              <label>Food</label><input ref={setFormRef("food")} className="trip-input right" value={food} onChange={(e) => setFood(e.target.value)} onKeyDown={handleFormEnter("driverBeta")} />
              <label>Driver Bata</label><input ref={setFormRef("driverBeta")} className="trip-input right" value={driverBeta} onChange={(e) => setDriverBeta(e.target.value)} onKeyDown={handleFormEnter("bus")} />
              <label>Bus</label><input ref={setFormRef("bus")} className="trip-input right" value={bus} onChange={(e) => setBus(e.target.value)} onKeyDown={handleFormEnter("air")} />
              <label>Air</label><input ref={setFormRef("air")} className="trip-input right" value={air} onChange={(e) => setAir(e.target.value)} onKeyDown={handleFormEnter("sanal")} />
              <label>Sanal</label><input ref={setFormRef("sanal")} className="trip-input right" value={sanal} onChange={(e) => setSanal(e.target.value)} onKeyDown={handleFormEnter("grease")} />
              <label>Grease</label><input ref={setFormRef("grease")} className="trip-input right" value={grease} onChange={(e) => setGrease(e.target.value)} onKeyDown={handleFormEnter("remarks")} />
            </div>
          </fieldset>
          <fieldset className="trip-card trip-summary">
            <legend>Summary</legend>
            <div><span>Sale Qty</span><strong>{f3(saleQty)}</strong></div>
            <div><span>Sale Amount</span><strong>{f2(saleAmount)}</strong></div>
            <div><span>Purchase Amount</span><strong>{f2(purchaseAmount)}</strong></div>
            <div><span>Total Expense</span><strong>{f2(totalExpense)}</strong></div>
            <div><span>Gross Profit</span><strong>{f2(grossProfit)}</strong></div>
            <div><span>Net Profit</span><strong className={netProfit < 0 ? "danger-text" : "success-text"}>{f2(netProfit)}</strong></div>
            <textarea ref={setFormRef("remarks")} className="trip-remarks" placeholder="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </fieldset>
        </div>
      </div>

      {tripPopupOpen && (
        <div className="trip-modal-ov">
          <div className="trip-modal trip-f6-modal">
            <div className="trip-modal-head">
              <span>Trip Details (F6)</span>
              <button onClick={() => setTripPopupOpen(false)}><X size={16} /></button>
            </div>
            <div className="trip-f6-body">
              <fieldset className="trip-card">
                <legend>Vehicle / Driver</legend>
                <div className="trip-f6-grid">
                  <label>Trip No</label>
                  <input className="trip-input" value={tripNo} readOnly tabIndex={-1} />
                  <label>Trip Date</label>
                  <DateFieldDDMMYYYY id="trip-date-f6" value={tripDate} onChange={setTripDate} onEnter={() => focusForm("vehicle")} />
                  <label>Vehicle</label>
                  <select ref={setFormRef("vehicle")} className="trip-input" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} onKeyDown={handleFormEnter("driver")}>
                    <option value="">Select Vehicle</option>
                    {vehicles.map((v) => <option key={v.Id} value={v.Id}>{v.VehicleNo}</option>)}
                  </select>
                  <label>Driver</label>
                  <select ref={setFormRef("driver")} className="trip-input" value={driverId} onChange={(e) => setDriverId(e.target.value)} onKeyDown={handleFormEnter("stKM")}>
                    <option value="">Select Driver</option>
                    {drivers.map((d) => <option key={d.Id} value={d.Id}>{d.DriverName}</option>)}
                  </select>
                  <label>Location</label>
                  <input ref={setFormRef("location")} className="trip-input" value={location} onChange={(e) => setLocation(e.target.value)} onKeyDown={handleFormEnter("dieselRate")} />
                  <label>Diesel Rate</label>
                  <input ref={setFormRef("dieselRate")} className="trip-input right" value={dieselRate} onChange={(e) => setDieselRate(e.target.value)} onKeyDown={handleFormEnter("mileage")} />
                  <label>Mileage</label>
                  <input ref={setFormRef("mileage")} className="trip-input right" value={mileage} onChange={(e) => setMileage(e.target.value)} onKeyDown={handleFormEnter("stKM")} />
                </div>
              </fieldset>

              <fieldset className="trip-card">
                <legend>KM / Expenses</legend>
                <div className="trip-exp-grid">
                  <label>Start KM</label><input ref={setFormRef("stKM")} className="trip-input right" value={stKM} onChange={(e) => setStKM(e.target.value)} onKeyDown={handleFormEnter("endKM")} />
                  <label>End KM</label><input ref={setFormRef("endKM")} className="trip-input right" value={endKM} onChange={(e) => setEndKM(e.target.value)} onKeyDown={handleFormEnter("returnKM")} />
                  <label>Return KM</label><input ref={setFormRef("returnKM")} className="trip-input right" value={returnKM} onChange={(e) => setReturnKM(e.target.value)} onKeyDown={handleFormEnter("rateKM")} />
                  <label>Rate/KM</label><input ref={setFormRef("rateKM")} className="trip-input right" value={rateKM} onChange={(e) => setRateKM(e.target.value)} onKeyDown={handleFormEnter("tripRent")} />
                  <label>Trip Rent</label><input ref={setFormRef("tripRent")} className="trip-input right" value={tripRent} onChange={(e) => setTripRent(e.target.value)} onKeyDown={handleFormEnter("loadingCharge")} />
                  <label>Loading</label><input ref={setFormRef("loadingCharge")} className="trip-input right" value={loadingCharge} onChange={(e) => setLoadingCharge(e.target.value)} onKeyDown={handleFormEnter("unloadingCharge")} />
                  <label>Unloading</label><input ref={setFormRef("unloadingCharge")} className="trip-input right" value={unloadingCharge} onChange={(e) => setUnloadingCharge(e.target.value)} onKeyDown={handleFormEnter("tollgate")} />
                  <label>Tollgate</label><input ref={setFormRef("tollgate")} className="trip-input right" value={tollgate} onChange={(e) => setTollgate(e.target.value)} onKeyDown={handleFormEnter("pc")} />
                  <label>PC</label><input ref={setFormRef("pc")} className="trip-input right" value={pc} onChange={(e) => setPc(e.target.value)} onKeyDown={handleFormEnter("rto")} />
                  <label>RTO</label><input ref={setFormRef("rto")} className="trip-input right" value={rto} onChange={(e) => setRto(e.target.value)} onKeyDown={handleFormEnter("checkpost")} />
                  <label>Checkpost</label><input ref={setFormRef("checkpost")} className="trip-input right" value={checkpost} onChange={(e) => setCheckpost(e.target.value)} onKeyDown={handleFormEnter("water")} />
                  <label>Water</label><input ref={setFormRef("water")} className="trip-input right" value={water} onChange={(e) => setWater(e.target.value)} onKeyDown={handleFormEnter("travel")} />
                  <label>Travel</label><input ref={setFormRef("travel")} className="trip-input right" value={travel} onChange={(e) => setTravel(e.target.value)} onKeyDown={handleFormEnter("tea")} />
                  <label>Tea</label><input ref={setFormRef("tea")} className="trip-input right" value={tea} onChange={(e) => setTea(e.target.value)} onKeyDown={handleFormEnter("food")} />
                  <label>Food</label><input ref={setFormRef("food")} className="trip-input right" value={food} onChange={(e) => setFood(e.target.value)} onKeyDown={handleFormEnter("driverBeta")} />
                  <label>Driver Bata</label><input ref={setFormRef("driverBeta")} className="trip-input right" value={driverBeta} onChange={(e) => setDriverBeta(e.target.value)} onKeyDown={handleFormEnter("bus")} />
                  <label>Bus</label><input ref={setFormRef("bus")} className="trip-input right" value={bus} onChange={(e) => setBus(e.target.value)} onKeyDown={handleFormEnter("air")} />
                  <label>Air</label><input ref={setFormRef("air")} className="trip-input right" value={air} onChange={(e) => setAir(e.target.value)} onKeyDown={handleFormEnter("sanal")} />
                  <label>Sanal</label><input ref={setFormRef("sanal")} className="trip-input right" value={sanal} onChange={(e) => setSanal(e.target.value)} onKeyDown={handleFormEnter("grease")} />
                  <label>Grease</label><input ref={setFormRef("grease")} className="trip-input right" value={grease} onChange={(e) => setGrease(e.target.value)} onKeyDown={handleFormEnter("remarks")} />
                </div>
              </fieldset>

              <fieldset className="trip-card trip-summary">
                <legend>Summary</legend>
                <div><span>Total KM</span><strong>{f2(totalKM)}</strong></div>
                <div><span>Trip Amount</span><strong>{f2(tripAmount)}</strong></div>
                <div><span>Total Expense</span><strong>{f2(totalExpense)}</strong></div>
                <div><span>Net Profit</span><strong className={netProfit < 0 ? "danger-text" : "success-text"}>{f2(netProfit)}</strong></div>
                <textarea ref={setFormRef("remarks")} className="trip-remarks" placeholder="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </fieldset>
            </div>
          </div>
        </div>
      )}

      {listOpen && (
        <div className="trip-modal-ov">
          <div className="trip-modal">
            <div className="trip-modal-head">
              <span>Trip List View (F5)</span>
              <button onClick={() => setListOpen(false)}><X size={16} /></button>
            </div>
            <div className="trip-modal-filter">
              <label>From</label><DateFieldDDMMYYYY id="trip-from" value={fromDate} onChange={setFromDate} />
              <label>To</label><DateFieldDDMMYYYY id="trip-to" value={toDate} onChange={setToDate} />
              <button className="trip-btn primary" onClick={loadTripList}>View</button>
            </div>
            <div className="trip-modal-body">
              <table className="trip-table">
                <thead><tr><th></th><th>Trip No</th><th>Date</th><th>Supplier</th><th>Amount</th><th>Actions</th></tr></thead>
                <tbody>
                  {!viewMaster.length && <tr><td colSpan={6} className="center">No records found</td></tr>}
                  {viewMaster.map((m) => {
                    const id = m.Id;
                    const open = expandedId === id;
                    const detail = saleDetailFor(id);
                    return (
                      <React.Fragment key={id}>
                        <tr>
                          <td className="center"><button className="trip-icon-btn" onClick={() => setExpandedId(open ? null : id)}>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button></td>
                          <td>{m.TripNo || m.RefNo}</td>
                          <td>{dateOnly(m.TripDate || m.RefDate)}</td>
                          <td>{m.SupplierName}</td>
                          <td className="right">{f2(m.Amount || m.TripAmount)}</td>
                          <td>
                            <button className="trip-mini edit" onClick={() => loadEdit(id)}><Edit3 size={13} /> Edit</button>
                            <button className="trip-mini del" onClick={() => deleteTrip(id)}><Trash2 size={13} /> Del</button>
                          </td>
                        </tr>
                        {open && (
                          <tr><td colSpan={6}>
                            <table className="trip-table nested">
                              <thead><tr><th>Code</th><th>Description</th><th>Rate</th><th>Qty</th></tr></thead>
                              <tbody>
                                {!detail.length && <tr><td colSpan={4} className="center">No detail</td></tr>}
                                {detail.map((d, i) => <tr key={i}><td>{d.Code}</td><td>{d.Description}</td><td className="right">{f2(d.PurchaseRate)}</td><td className="right">{f3(d.Qty)}</td></tr>)}
                              </tbody>
                            </table>
                          </td></tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="mp-loader-ov"><div className="mp-ldr-box"><div className="mp-spin" /><div className="mp-ldr-msg">Processing...</div></div></div>}
      {ConfirmUI}
      <MSG.ToastList toasts={toasts} />
    </div>
  );
}
