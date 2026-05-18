import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { PurchaseApi } from '../../infrastructure/api/PurchaseApi.js';
import { AmountSummary } from '../components/purchase/AmountSummary.jsx';
import { GstSummary } from '../components/purchase/GstSummary.jsx';
import { InvoiceInfo } from '../components/purchase/InvoiceInfo.jsx';
import { ProductGrid } from '../components/purchase/ProductGrid.jsx';
import { PurchaseInfo } from '../components/purchase/PurchaseInfo.jsx';
import { SupplierInfo } from '../components/purchase/SupplierInfo.jsx';

export function usePurchaseViewModel() {
  // State
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseNo, setPurchaseNo] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [purchaseType, setPurchaseType] = useState('CREDIT');
  const [supplierId, setSupplierId] = useState(0);
  const [supInfo, setSupInfo] = useState({});
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [invoiceAmt, setInvoiceAmt] = useState('');
  const [igst, setIgst] = useState(false);
  const [taxMode, setTaxMode] = useState('exclusive');
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState([]);
  const [overrides, setOverrides] = useState({ transAmt: '', otherPlus: '', otherSub: '', tcsPer: '0' });
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(0);
  const [loading, setLoading] = useState(false);
// Full implementation here
const r2  = v => Math.round((parseFloat(v) || 0) * 100) / 100;
const f2  = v => (parseFloat(v) || 0).toFixed(2);
function calcItem(item, igstBill = false) { /* from MasterPage */ }
function calcTotals(items, overrides, igstBill) { /* from MasterPage */ }
function newRow() { /* from MasterPage */ }
 // all state, handlers, effects

return {
  purchaseNo, setPurchaseNo,
  // all
};

}

