// ─────────────────────────────────────────────────────────────────────────────
//  Reorder.jsx
//  React conversion of Reorder.js (jQuery) — "Reorder Level List" report
//  Uses API helpers from Common.jsx (CC.api / CC.getLocal / CC.getStr etc.)
//  Styling: same "so-*" class set used in BankBook.jsx — no inline color
//  values, no new theme colors.
//
//  NOTE ON PRESERVED SOURCE QUIRKS (kept exactly as legacy behaved, per the
//  "do not invent business logic" requirement):
//   1. Legacy never actually *requires* a radio group to be selected before
//      submitting — if no radio is checked, GroupBy/GroupByText stay "" and
//      the request is still sent. Preserved as-is (no added validation).
//   2. Each radio's validation block only fires if a combo item IS already
//      selected (`getSelectedItem() != null`) and then checks whether the
//      item's `.label` is null — which, given how selection is set, can
//      never actually be null. This is effectively dead code in the
//      original, but is preserved faithfully rather than "fixed".
//   3. `Todate` was declared in the legacy file but never assigned or sent —
//      dropped entirely here since it did nothing.
//   4. `methods.Clear()` (called unconditionally after the AJAX call
//      settles, success or failure) only clears the *item selections*, not
//      the checked radio, the date, or the checkbox — preserved as-is.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// API endpoint for the report data call. Legacy posted to the MVC action
// "/Stock/ReOrderLevel" directly — mapped here to the /api/StockReportApp/...
// convention used elsewhere in this app (see BankBook.jsx's equivalent
// note). Please confirm the real route with the backend.
const ReorderLevelUrl = "/api/StockReportApp/ReOrderLevel";

// ── Combo endpoints — attempt #2. The bare controller-name guess
// (/api/Brand/SelectBrand etc.) 404'd, meaning the route prefix itself is
// wrong, not the action name. BankBook.jsx's endpoints that DO work
// (/api/BankApp/SelectBankList, /api/StockReportApp/BankBookReport) both
// use a "...App" suffix on the controller name, so this attempt follows
// that same pattern. This is still an educated guess, not a confirmed
// route — see the verification steps below if this also 404s.
const BrandListUrl = "/api/BrandApp/SelectBrand";
const CategoryListUrl = "/api/CategoryApp/SelectCategory";
const DepartmentListUrl = "/api/DepartmentApp/SelectDepartment";
const SupplierListUrl = "/api/SupplierApp/GetSupplier";
const UomListUrl = "/api/UOMApp/SelectUOM";
const ProductListUrl = "/api/ItemMasterApp/GetProductList";

// GetSupplier(Comid, AccountType) needs a second param we don't send
// anywhere else in this file. "Supplier" is a placeholder — replace with
// whatever AccountType value your _supplierServices.GetSupplier expects
// (e.g. "S" / "SUPPLIER" / a specific ledger-group name) or the list will
// come back empty even though the call succeeds.
const SupplierAccountType = "Supplier";

// Defines the seven mutually-exclusive radio + combo groups from the legacy
// markup (rbtbrand/cmbbrand, rbtcategory/cmbcategory, ...). Order matches
// the legacy DOM order.
const GROUPS = [
  { key: "Brand", label: "Brand" },
  { key: "Category", label: "Category" },
  { key: "Department", label: "Department" },
  { key: "Supplier", label: "Supplier" },
  { key: "UOM", label: "UOM" },
  { key: "Description", label: "Item Description" },
  { key: "Code", label: "Item Code" },
];

const todayStr = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// const toMMDDYYYY = (isoDate) => {
//   if (!isoDate) return "";
//   const [y, m, d] = isoDate.split("-");
//   return `${m}/${d}/${y}`;
// };

// Backend's ReOrderLevel service parses TillDate with dd/MM/yyyy (India
// server locale) — every other ReportViewer.aspx.cs method uses
// Convert.ToDateTime(x).ToString("dd/MM/yyyy") consistently, confirming
// that's the expected format. Sending MM/DD/YYYY caused silent parse
// failures (IsSuccess=false) or wrong dates being parsed.
const toDDMMYYYY = (isoDate) => {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
};

// Returns the first non-empty value found in `obj` across `keys`, in order.
// Used below so each combo checks the field names that domain's model
// actually tends to use, instead of one generic guess-list for everything
// — that generic guess-list is exactly what caused labels to render blank
// (the field names it checked for didn't exist on Brand/Category/etc.
// records, so `.label` stayed "" and the row rendered with invisible text).
const pick = (obj, keys) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return "";
};

// Each normalizer below is domain-specific: it checks the field names that
// model actually tends to expose (e.g. BrandName/BrandId for Brand,
// AccountName/AccountId for Supplier — suppliers are ledger accounts in
// this app, same as the bank list in BankBook.jsx) plus a few generic
// fallbacks, so a mismatch on one domain doesn't silently blank out others.
// >>> If a list still shows blank names after this fix, open devtools →
// Network → find the SelectBrand/SelectCategory/etc. response → check the
// actual field names inside `Data` and add them to the matching keys list
// below. <<<
const normalizeBrand = (raw) =>
  (Array.isArray(raw) ? raw : []).map((r) => ({
    label: pick(r, ["BrandName", "Brandname", "Name", "label", "Label", "Text"]),
    value: pick(r, ["BrandId", "Brandid", "BrandID", "Id", "value", "Value"]),
  }));

const normalizeCategory = (raw) =>
  (Array.isArray(raw) ? raw : []).map((r) => ({
    label: pick(r, ["CategoryName", "Cat_Name" ,"label", "Label", "Name", "Text"]),
    value: pick(r, ["value", "Value", "CategoryId", "Id"]),
  }));

const normalizeDepartment = (raw) =>
  (Array.isArray(raw) ? raw : []).map((r) => ({
    label: pick(r, ["DepartmentName", "Departmentname", "Name", "label", "Label", "Text"]),
    value: pick(r, ["DepartmentId", "Departmentid", "DepartmentID", "Id", "value", "Value"]),
  }));

const normalizeSupplier = (raw) =>
  (Array.isArray(raw) ? raw : []).map((r) => ({
    label: pick(r, ["AccountName", "SupplierName", "Suppliername", "Name", "label", "Label", "Text"]),
    value: pick(r, ["AccountId", "SupplierId", "Supplierid", "Id", "value", "Value"]),
  }));

const normalizeUom = (raw) =>
  (Array.isArray(raw) ? raw : []).map((r) => ({
    label: pick(r, ["UOMName", "UomName", "UOM", "Uom", "Name", "label", "Label", "Text"]),
    value: pick(r, ["UOMId", "UomId", "UOMID", "Id", "value", "Value"]),
  }));

export default function Reorder() {
  const navigate = useNavigate();

  // ── Session / permission state ─────────────────────────────────────────
  const [pageAccess, setPageAccess] = useState({
    ready: false,
    allowed: false,
    pageview: 0,
  });

  // ── Company / session state (loaded once from localStorage, same pattern
  //    as BankBook.jsx). Reorder.js never referenced CommonCompany, so it's
  //    omitted here — only Comid/MComid/CName/CAddress/CPhone are used
  //    (MComid/CName/CAddress/CPhone are read from the same globals BankBook
  //    treats as externally-set, since Reorder.js referenced them without
  //    defining them locally either). ──
  const [session, setSession] = useState({
    Comid: "",
    MComid: "",
    CName: "",
    CAddress: "",
    CPhone: "",
  });

  // ── Form state (controlled inputs replacing jqx widgets) ────────────────
  // Till Date — matches the legacy reference file's #dtpfromdate exactly
  // (same field, sent to the API as TillDate). "To Date" (`Todate` in the
  // legacy file) was never assigned or sent to the API there either, so it
  // has been removed entirely rather than kept as an inert UI field.
  const [fromDate, setFromDate] = useState(todayStr()); // #dtpfromdate (Till Date)
  const [maxChecked, setMaxChecked] = useState(false); // #chkmax

  // Which radio group is active — "" means none checked, matching the
  // legacy state where no radio is required to be selected.
  const [groupBy, setGroupBy] = useState("");

  // Only one combo can be interactive at a time (mirrors the legacy
  // enable-one/disable-rest radio behavior), so a single selection/search
  // pair is enough — switching groups always clears the prior selection,
  // same as the legacy radio 'change' handlers did.
  const [selectedItem, setSelectedItem] = useState(null); // { label, value } | null
  const [searchText, setSearchText] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const comboAreaRef = useRef(null);

  // ── Combo source lists ───────────────────────────────────────────────────
  const [lists, setLists] = useState({
    Brand: [],
    Category: [],
    Department: [],
    Supplier: [],
    UOM: [],
    Description: [],
    Code: [],
  });

  // ── UI feedback state ───────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { text, isErr }

  // Options for whichever group is currently active, filtered by the typed
  // search text — matches on label, same as BankBook's combo pattern.
  const filteredOptions = useMemo(() => {
    if (!groupBy) return [];
    const source = lists[groupBy] || [];
    const q = (searchText || "").trim().toLowerCase();
    if (!q) return source;
    return source.filter((o) => String(o.label ?? "").toLowerCase().includes(q));
  }, [groupBy, lists, searchText]);

  // Keep the visible text in sync with the confirmed selection.
  useEffect(() => {
    setSearchText(selectedItem?.label ?? "");
  }, [selectedItem]);

  // Close the active combo's dropdown when clicking outside the combo area.
  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (comboAreaRef.current && !comboAreaRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  // ── Session / menu-permission bootstrap ─────────────────────────────────
  useEffect(() => {
    const menulist = CC.getLocal("menulist");
    if (menulist == null) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/Login/Index");
      return;
    }

    const menudata = menulist.filter((obj) => obj.PageName === "Reorder Level List");
    if (!menudata || menudata.length === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      // Legacy redirects to "/Home" (not "/Login/Home") for this screen.
      setTimeout(() => navigate("/Home"), 3000);
      return;
    }

    if (menudata[0].View === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      setTimeout(() => navigate("/Home"), 3000);
      return;
    }

    const Comid = CC.getStr("Comid");
    const MComid = CC.getStr("MComid");
    const ComSet = CC.getLocal("Companysetting") || [{}];

    setSession({
      Comid,
      MComid,
      CName: ComSet[0]?.CName || "",
      CAddress: ComSet[0]?.CAddress || "",
      CPhone: ComSet[0]?.CPhone || "",
    });

    setPageAccess({
      ready: true,
      allowed: true,
      pageview: menudata[0].View,
      pageadd: menudata[0].Add,
      pageedit: menudata[0].Edit,
      pagedelete: menudata[0].Delete,
    });
  }, [navigate]);

  // Loads all seven combo sources once page access is granted — replaces
  // the legacy methods.load() calls to loadbrandcombo/loadcategorycombo/
  // loaddepartmentcombo/loadsuppliercombo/loaduomcombo/loadproductcombo.
  useEffect(() => {
    if (!pageAccess.ready || !pageAccess.allowed) return;
    if (!session.Comid) return;

    let cancelled = false;
    (async () => {
      try {
        const [brandRes, categoryRes, departmentRes, supplierRes, uomRes, productRes] =
          await Promise.all([
            CC.api(BrandListUrl, null, {}, { Comid: session.Comid }),
            CC.api(CategoryListUrl, null, {}, { Comid: session.Comid }),
            CC.api(DepartmentListUrl, null, {}, { Comid: session.Comid }),
            // GetSupplier requires AccountType — see SupplierAccountType note above.
            CC.api(SupplierListUrl, null, {}, { Comid: session.Comid, AccountType: SupplierAccountType }),
            CC.api(UomListUrl, null, {}, { Comid: session.Comid }),
            CC.api(ProductListUrl, null, {}, { Comid: session.Comid }),
          ]);

        if (cancelled) return;

        const rawProducts = productRes?.Data || productRes?.data || [];
        // The Description and Code combos share the same product source in
        // the legacy loader — derive two independently-labeled lists from
        // the same raw records rather than two separate API shapes. Widened
        // to check ItemName/ItemCode/ProductName/ProductCode too, same
        // reasoning as the other normalizers above.
        const descriptionList = (Array.isArray(rawProducts) ? rawProducts : []).map((p) => ({
          label: pick(p, ["Description", "ItemName", "ProductName", "Name", "label"]),
          value: pick(p, ["Id", "ItemId", "ProductId", "value"]) || pick(p, ["Description", "ItemName", "ProductName"]),
        }));
        const codeList = (Array.isArray(rawProducts) ? rawProducts : []).map((p) => ({
          label: pick(p, ["Code", "ItemCode", "Productcode", "value"]),
          value: pick(p, ["Id", "ItemId", "ProductId", "value"]) || pick(p, ["Code", "ItemCode", "ProductCode"]),
        }));

        setLists({
          Brand: normalizeBrand(brandRes?.Data || brandRes?.data),
          Category: normalizeCategory(categoryRes?.Data || categoryRes?.data),
          Department: normalizeDepartment(departmentRes?.Data || departmentRes?.data),
          Supplier: normalizeSupplier(supplierRes?.Data || supplierRes?.data),
          UOM: normalizeUom(uomRes?.Data || uomRes?.data),
          Description: descriptionList,
          Code: codeList,
        });
      } catch (err) {
        if (!cancelled) setMsg({ text: err.message || "Unable to load filter lists.", isErr: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pageAccess.ready, pageAccess.allowed, session.Comid]);

  // Esc-to-quit is not present in Reorder.js itself, but is the same shared
  // app-chrome behavior BankBook.jsx uses (not report-specific business
  // logic), so it's carried over here — pointed at "/Home" to match this
  // screen's own permission-denied target rather than BankBook's "/Login/Home".
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.keyCode === 27) {
        e.preventDefault();
        if (window.confirm("Do You Want To Quit Page?")) {
          navigate("/Home");
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  // Selecting a radio enables its combo and disables/clears the rest —
  // replicated here by simply swapping which group is "active"; the old
  // selection is discarded the same way the legacy 'change'-on-uncheck
  // handlers cleared the previously-active combo.
  const handleGroupSelect = useCallback((key) => {
    setGroupBy(key);
    setSelectedItem(null);
    setSearchText("");
    setDropdownOpen(false);
  }, []);

  // Matches the legacy #btnrefresh handler exactly: clears the combo
  // selection, disables all combos, and unchecks all radios. It does NOT
  // reset the date or the checkbox — the date picker was only re-initialised
  // with the same format string, not given a new value.
  const handleRefresh = useCallback(() => {
    setGroupBy("");
    setSelectedItem(null);
    setSearchText("");
    setDropdownOpen(false);
  }, []);

  const openReportViewer = useCallback((params) => {
    const qs = new URLSearchParams(params).toString();
    const url = `${CC.BASE_URL}/Reports/ReportViewer.aspx?${qs}`;

    const w = window.open(
      url,
      "_blank",
      `directories=0,titlebar=0,toolbar=0,location=0,status=0,` +
        `menubar=0,scrollbars=yes,resizable=no,` +
        `width=${screen.width},height=${screen.height - 100}`
    );
    if (w) {
      w.addEventListener("load", () => { w.document.title = "ReOrder-Report"; }, false);
    }
  }, []);

  const handleView = useCallback(async () => {
    // Preserved quirk #1: no radio needs to be checked — GroupBy/GroupByText
    // simply stay "" if none is, and the request still goes out.
    const activeGroupLabel = GROUPS.find((g) => g.key === groupBy)?.label || "";
    let GroupByText = "";

    if (groupBy) {
      // Preserved quirk #2: the validation only runs when an item IS
      // selected, and then checks a condition (label == null) that can
      // never actually be true given how selection is set — effectively
      // dead code in the original, kept as-is rather than "fixed".
      if (selectedItem != null) {
        GroupByText = selectedItem.label;
        if (GroupByText == null) {
          setMsg({ text: `Please Select Valid ${activeGroupLabel} Name !!!.`, isErr: true });
          setSelectedItem(null);
          return;
        }
      }
    }

    // const Fromdate = toMMDDYYYY(fromDate);
    const Fromdate = toDDMMYYYY(fromDate);
    const batch = maxChecked ? 0 : 1; // #chkmax: checked → batch 0, else 1

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(ReorderLevelUrl, null, {React:1}, {
        GroupBy: groupBy,
        GroupByName: GroupByText,
        TillDate: Fromdate,
        MinLeval: batch,
        Comid: session.Comid,
        MComid: session.MComid,
      });

      if (res?.ok === true || res?.IsSuccess === true) {
        const cacheKey =
        res.data15 ??
        res.Data15 ??
        res.data?.Data15 ??
        res.data?.data15 ??
        "";
        openReportViewer({
          ReportName: "ReOrderLevel1",
          CacheKey: cacheKey,
          GroupBy: groupBy,
          Fromdate,
          stocklevel: batch,
          CName: session.CName,
          CAddress: session.CAddress,
          CPhone: session.CPhone,
        });
      } else {
        setMsg({ text: "No Record !!!.", isErr: true });
      }
    } catch (err) {
      setMsg({ text: err.message || "Something went wrong.", isErr: true });
    } finally {
      setLoading(false);
      // Preserved quirk #4: methods.Clear() runs unconditionally after the
      // (legacy synchronous) AJAX call settles, win or lose, and only
      // clears the item selection — the checked radio stays checked.
      setSelectedItem(null);
      setSearchText("");
    }
  }, [groupBy, selectedItem, fromDate, maxChecked, session, openReportViewer]);

  const styles = `
    .so-shell { min-height: 100vh; background: #f2f4f7; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }
    .so-topbar { background: var(--clr-primary, #1a56db); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 52px; box-shadow: 0 2px 8px rgba(0,0,0,.18); flex-shrink: 0; }
    .so-topbar-title { font-size: 15px; font-weight: 600; letter-spacing: .3px; }
    .so-close-btn { background: rgba(255,255,255,.15); border: none; color: #fff; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background .15s; }
    .so-close-btn:hover { background: rgba(255,255,255,.28); }

    .so-page { flex: 1; padding: 24px; display: flex; justify-content: center; box-sizing: border-box; }
    .so-card { background: #fff; border-radius: 16px; box-shadow: 0 2px 20px rgba(16,24,40,.06); padding: 36px 44px 40px; max-width: 1150px; width: 100%; box-sizing: border-box; }

    .so-card-header { border-bottom: 1px solid #edf0f3; padding-bottom: 20px; margin-bottom: 32px; }
    .so-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: var(--clr-primary, #1a56db); margin-bottom: 6px; }
    .so-title { font-size: 22px; font-weight: 700; color: #1a2233; line-height: 1.2; }

    .so-columns { display: flex; align-items: stretch; }
    .so-col-left { flex: 1.35; padding-right: 40px; }
    .so-col-divider { width: 1px; background: #edf0f3; flex-shrink: 0; }
    .so-col-right { flex: 1; padding-left: 40px; display: flex; flex-direction: column; }

    .so-section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: #98a2b3; margin-bottom: 22px; }

    .so-group-list { display: flex; flex-direction: column; gap: 18px; }
    .so-radio-row { display: grid; grid-template-columns: 130px 1fr; align-items: center; gap: 16px; }
    .so-radio-label { display: flex; align-items: center; gap: 10px; font-size: 13.5px; font-weight: 600; color: #344054; cursor: pointer; }
    .so-radio { width: 16px; height: 16px; accent-color: var(--clr-primary, #1a56db); cursor: pointer; }

    .so-input { height: 44px; border: 1px solid #e8ecf0; border-radius: 8px; padding: 0 14px; font-size: 13.5px; color: #344054; background: #f5f6f8; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s, background .15s; outline: none; }
    .so-input::placeholder { color: #98a2b3; }
    .so-input:focus { border-color: var(--clr-primary, #1a56db); background: #fff; box-shadow: 0 0 0 3px rgba(26,86,219,.1); }
    .so-input:disabled { background: #f5f6f8; color: #98a2b3; cursor: not-allowed; }
    .so-combo { position: relative; }
    .so-combo-list { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 20; margin: 0; padding: 4px; list-style: none; max-height: 220px; overflow-y: auto; background: #fff; border: 1.5px solid #d1d9e6; border-radius: 8px; box-shadow: 0 6px 20px rgba(0,0,0,.12); }
    .so-combo-item { padding: 8px 10px; font-size: 13px; color: #1e2d3d; border-radius: 6px; cursor: pointer; }
    .so-combo-item:hover { background: #f0f2f5; }
    .so-combo-empty { padding: 8px 10px; font-size: 13px; color: #4a5568; }

    .so-filter-row { display: grid; grid-template-columns: 100px 1fr; align-items: center; gap: 16px; margin-bottom: 20px; }
    .so-filter-label { font-size: 13.5px; font-weight: 600; color: #1a2233; }
    .so-date-input { height: 44px; border: 1.5px solid #e2e5ea; border-radius: 8px; padding: 0 12px; font-size: 13.5px; color: #344054; background: #fff; width: 100%; max-width: 260px; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .so-date-input:focus { border-color: var(--clr-primary, #1a56db); box-shadow: 0 0 0 3px rgba(26,86,219,.1); }
    .so-checkbox-inline { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: #344054; cursor: pointer; }
    .so-checkbox { width: 16px; height: 16px; accent-color: var(--clr-primary, #1a56db); cursor: pointer; }

    .so-filter-divider { height: 1px; background: #edf0f3; margin: 8px 0 24px; }

    .so-filter-actions { display: flex; gap: 12px; }
    .so-btn { height: 44px; padding: 0 26px; border-radius: 8px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity .15s, box-shadow .15s; display: flex; align-items: center; gap: 8px; }
    .so-btn:disabled { opacity: .5; cursor: not-allowed; }
    .so-btn-primary { background: var(--clr-primary, #1a56db); color: #fff; box-shadow: 0 2px 8px rgba(26,86,219,.3); }
    .so-btn-primary:not(:disabled):hover { opacity: .9; box-shadow: 0 4px 14px rgba(26,86,219,.4); }
    .so-btn-secondary { background: #f0f2f5; color: #4a5568; border: 1.5px solid #d1d9e6; }
    .so-btn-secondary:not(:disabled):hover { background: #e8ecf0; }

    .so-msg { margin-top: 20px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; }
    .so-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .so-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }

    @media (max-width: 800px) {
      .so-page { padding: 16px; }
      .so-card { padding: 24px 20px 28px; }
      .so-columns { flex-direction: column; }
      .so-col-left { padding-right: 0; padding-bottom: 28px; }
      .so-col-divider { width: auto; height: 1px; margin-bottom: 28px; }
      .so-col-right { padding-left: 0; }
      .so-radio-row, .so-filter-row { grid-template-columns: 110px 1fr; }
    }
  `;

  if (!pageAccess.ready) {
    return (
      <div className="mp-wrap">
        <div className="mp-body">
          {msg && <div className={`mp-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
        </div>
      </div>
    );
  }

  if (!pageAccess.allowed) {
    return (
      <div className="mp-wrap">
        <div className="mp-body">
          <div className="mp-msg err">Page Access Permission Denied !!!.</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div className="so-shell">
        <Topbar />
        <div className="so-page">
          <div className="so-card">
            <div className="so-card-header">
              <div className="so-eyebrow">Stock</div>
              <div className="so-title">Reorder Level List</div>
            </div>

            <div className="so-columns">
              {/* ── Left column: GROUP BY — same 7 radio+combo filter rows
                  and logic as before, restyled to match the reference. ── */}
              <div className="so-col-left">
                <div className="so-section-label">Group By</div>
                <div className="so-group-list" ref={comboAreaRef}>
                  {GROUPS.map((g) => {
                    const isActive = groupBy === g.key;
                    return (
                      <div className="so-radio-row" key={g.key}>
                        <label className="so-radio-label" htmlFor={`ro-radio-${g.key}`}>
                          <input
                            id={`ro-radio-${g.key}`}
                            type="radio"
                            name="reorder-groupby"
                            className="so-radio"
                            checked={isActive}
                            onChange={() => handleGroupSelect(g.key)}
                          />
                          {g.label}
                        </label>

                        <div className="so-combo">
                          <input
                            id={`ro-combo-${g.key}`}
                            type="text"
                            className="so-input"
                            autoComplete="off"
                            disabled={!isActive}
                            placeholder={isActive ? `Type to search ${g.label.toLowerCase()}…` : ""}
                            value={isActive ? searchText : ""}
                            onFocus={() => isActive && setDropdownOpen(true)}
                            onChange={(e) => {
                              if (!isActive) return;
                              setSearchText(e.target.value);
                              setDropdownOpen(true);
                              if (selectedItem) setSelectedItem(null);
                            }}
                            onKeyDown={(e) => {
                              if (!isActive) return;
                              if (e.key === "Escape") {
                                setDropdownOpen(false);
                              } else if (e.key === "Enter" && filteredOptions.length === 1) {
                                e.preventDefault();
                                const only = filteredOptions[0];
                                setSelectedItem({ label: only.label, value: only.value });
                                setDropdownOpen(false);
                              }
                            }}
                          />
                          {isActive && dropdownOpen && (
                            <ul className="so-combo-list">
                              {filteredOptions.length === 0 ? (
                                <li className="so-combo-empty">No matching {g.label.toLowerCase()}</li>
                              ) : (
                                filteredOptions.map((o, idx) => (
                                  <li
                                    key={o.value ?? `${g.key}-${idx}`}
                                    className="so-combo-item"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      setSelectedItem({ label: o.label, value: o.value });
                                      setDropdownOpen(false);
                                    }}
                                  >
                                    {o.label}
                                  </li>
                                ))
                              )}
                            </ul>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="so-col-divider" />

              {/* ── Right column: FILTERS — Till Date, Maximum Level, then
                  View/Refresh below a divider, left-aligned. Matches the
                  reference JS file's single #dtpfromdate (Till Date) field
                  exactly; no other business logic or API calls changed. ── */}
              <div className="so-col-right">
                <div className="so-section-label">Filters</div>

                <div className="so-filter-row">
                  <label className="so-filter-label" htmlFor="ro-from-date">Till Date</label>
                  <input
                    id="ro-from-date"
                    type="date"
                    className="so-date-input"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </div>

                <div className="so-filter-row">
                  <span className="so-filter-label">Max</span>
                  {/* Exact checkbox wording wasn't present in the source
                      markup — "Maximum Level" reflects what #chkmax controls
                      (batch/MinLeval flips from 1 to 0 when checked); adjust
                      the label text if the real UI says something different. */}
                  <label className="so-checkbox-inline" htmlFor="ro-chkmax">
                    <input
                      id="ro-chkmax"
                      type="checkbox"
                      className="so-checkbox"
                      checked={maxChecked}
                      onChange={(e) => setMaxChecked(e.target.checked)}
                    />
                    Maximum Level
                  </label>
                </div>

                <div className="so-filter-divider" />

                <div className="so-filter-actions">
                  <button
                    type="button"
                    className="so-btn so-btn-primary"
                    disabled={loading || pageAccess.pageview === 0}
                    onClick={handleView}
                  >
                    {loading ? "Loading…" : "▶ View"}
                  </button>
                  <button
                    type="button"
                    className="so-btn so-btn-secondary"
                    onClick={handleRefresh}
                    disabled={loading}
                  >
                    ↺ Refresh
                  </button>
                </div>

                {msg && <div className={`so-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
              </div>
            </div>
          </div>
        </div>

        {loading && (
          <div className="mp-loader-ov">
            <div className="mp-ldr-box">
              <div className="mp-spin" />
              <div className="mp-ldr-msg">Loading...</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}