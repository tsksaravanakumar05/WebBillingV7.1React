import React, { useEffect } from 'react';
import { fmtINR } from '../../../shared/helpers/index.js';

// Editable Input Component
function AmtInput({ label, value, placeholder, onChange }) {
  const displayVal = (value === '' || value === undefined) ? placeholder : value;

  return (
    <div className="amt-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', padding: '0 5px' }}>
      <span className="label" style={{ fontSize: '11px', color: '#333', flex: '1', fontWeight: '500' }}>{label}</span>
      <input
        type="number"
        className="form-control text-right"
        style={{ 
          width: '80px', height: '22px', fontSize: '12px', padding: '2px 5px', 
          textAlign: 'right', border: '1px solid #cbd5e1', borderRadius: '3px', outline: 'none' 
        }}
        value={displayVal}
        onChange={e => onChange(e.target.value)}
        onFocus={e => e.target.select()}
      />
    </div>
  );
}

export function AmountSummary({ totals, overrides, onOverrideChange }) {
  
  // PurchaseCalculator.js already gives us exactly the correct computed totals (mixing grid math + overrides)
  // So we only need to pass 'totals' as placeholders, and 'overrides' as the actual input state.
  const getFmt = (val) => (parseFloat(val) || 0).toFixed(2);

  return (
    <div className="amount-summary-container" style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: '4px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '6px 0' }}> 
        
        {/* Column 1 */}
        <div style={{ borderRight: '1px solid #e2e8f0' }}>
          <AmtInput label="Gross Amt" value={overrides.grossAmt} placeholder={getFmt(totals.grossAmt)} onChange={v => onOverrideChange('grossAmt', v)} />
          <AmtInput label="Trans Amt" value={overrides.transAmt} placeholder={getFmt(totals.transAmt)} onChange={v => onOverrideChange('transAmt', v)} />
          <AmtInput label="Display Amt" value={overrides.displayAmt} placeholder={getFmt(totals.displayAmt)} onChange={v => onOverrideChange('displayAmt', v)} />
        </div>

        {/* Column 2 */}
        <div style={{ borderRight: '1px solid #e2e8f0' }}>
          <AmtInput label="CD Amt" value={overrides.cdAmt} placeholder={getFmt(totals.cdAmt)} onChange={v => onOverrideChange('cdAmt', v)} />
          <AmtInput label="Disc Amt" value={overrides.discAmt} placeholder={getFmt(totals.discAmt)} onChange={v => onOverrideChange('discAmt', v)} />
          <AmtInput label="CESS Amt" value={overrides.cessAmt} placeholder={getFmt(totals.cessAmt)} onChange={v => onOverrideChange('cessAmt', v)} />
        </div>

        {/* Column 3 */}
        <div style={{ borderRight: '1px solid #e2e8f0' }}>
          <AmtInput label="CGST Amt" value={overrides.cgstAmt} placeholder={getFmt(totals.cgstAmt)} onChange={v => onOverrideChange('cgstAmt', v)} />
          <AmtInput label="SGST Amt" value={overrides.sgstAmt} placeholder={getFmt(totals.sgstAmt)} onChange={v => onOverrideChange('sgstAmt', v)} />
          <AmtInput label="GST Amt" value={overrides.gstAmt} placeholder={getFmt(totals.gstAmt)} onChange={v => onOverrideChange('gstAmt', v)} />
        </div>

        {/* Column 4 */}
        <div>
          <AmtInput label="Others (+)" value={overrides.otherPlus} placeholder={getFmt(totals.otherPlus)} onChange={v => onOverrideChange('otherPlus', v)} />
          <AmtInput label="Others (-)" value={overrides.otherSub} placeholder={getFmt(totals.otherSub)} onChange={v => onOverrideChange('otherSub', v)} />
          <AmtInput label="Net Total" value={overrides.netAmt} placeholder={getFmt(totals.netAmt)} onChange={v => onOverrideChange('netAmt', v)} /> 
        </div>

      </div>
      
      {/* Final Net Total Display */}
      <div style={{ textAlign: 'right', padding: '6px 15px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '0 0 4px 4px' }}>
        <span style={{ fontWeight: '600', marginRight: '10px', color: '#333' }}>Final Net Total:</span>
        <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#16a34a' }}>₹ {fmtINR(totals.netAmt)}</span>
      </div>
    </div>
  );
}