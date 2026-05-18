import React from 'react';
import { fmt2 } from '../../../shared/helpers/index.js';

export function GstSummary({ gstRows, igst }) {
  const totalGst  = gstRows.reduce((s, r) => s + r.gstAmt, 0);
  const totalCgst = gstRows.reduce((s, r) => s + r.cgst, 0);
  const totalSgst = gstRows.reduce((s, r) => s + r.sgst, 0);
  const totalCess = gstRows.reduce((s, r) => s + (r.cessAmt || 0), 0);

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header"><span>📊</span> GST Summary</div>
      <div className="card-body" style={{ padding: 0 }}>
        <table className="gst-table">
          <thead>
            <tr>
              <th>GST%</th>
              <th>GST Amt</th>
              {igst ? (
                <th>IGST</th>
              ) : (
                <>
                  <th>CGST</th>
                  <th>SGST</th>
                </>
              )}
              <th>CESS</th>
            </tr>
          </thead>
          <tbody>
            {gstRows.length === 0 && (
              <tr>
                <td colSpan={igst ? 4 : 5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 12 }}>
                  No items
                </td>
              </tr>
            )}
            {gstRows.map(row => (
              <tr key={row.gstPer}>
                <td style={{ textAlign: 'center', fontWeight: 600 }}>{row.gstPer}%</td>
                <td>{fmt2(row.gstAmt)}</td>
                {igst ? (
                  <td>{fmt2(row.gstAmt)}</td>
                ) : (
                  <>
                    <td>{fmt2(row.cgst)}</td>
                    <td>{fmt2(row.sgst)}</td>
                  </>
                )}
                <td>{fmt2(row.cessAmt)}</td>
              </tr>
            ))}
          </tbody>
          {gstRows.length > 0 && (
            <tfoot>
              <tr>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>Total</td>
                <td>{fmt2(totalGst)}</td>
                {igst ? (
                  <td>{fmt2(totalGst)}</td>
                ) : (
                  <>
                    <td>{fmt2(totalCgst)}</td>
                    <td>{fmt2(totalSgst)}</td>
                  </>
                )}
                <td>{fmt2(totalCess)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
