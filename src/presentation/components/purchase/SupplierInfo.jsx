import React, { useState, useRef, useEffect } from 'react';
import { fmtINR } from '../../../shared/helpers/index.js';
import { forwardRef, useImperativeHandle } from "react";

export const SupplierInfo = forwardRef(
({ header, suppliers, onSupplierSelect,onHeaderChange, onEnter }, ref) => {
  const isNeg = header.supplierBalance < 0;
  const isPos = header.supplierBalance > 0;
  const inputRef = useRef(null);
  const [inputVal, setInputVal] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef(null);
const isTypingRef = useRef(false);
  const listRef = useRef(null);

  // Supplier select but input-ல name show பண்ணு
  useEffect(() => {
    if (isTypingRef.current) return;
    if (header.supplierId) {
      const found = suppliers.find(s => s.Id === header.supplierId);
      if (found) setInputVal(found.AccountName);
    } else {
      setInputVal('');
    }
  }, [header.supplierId, suppliers]);

  // Outside click → dropdown close
  useEffect(() => {
    const handleOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
        isTypingRef.current = false;
        // Valid selection இல்லன்னா reset
        const current = suppliers.find(s => s.Id === header.supplierId);
        setInputVal(current ? current.AccountName : '');
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [header.supplierId, suppliers]);

  // Simple reliable scrollIntoView (handles all positioning/offset issues)
  useEffect(() => {
    if (!isOpen || highlightIndex < 0) return;
    const list = listRef.current;
    if (!list) return;
    const item = list.children[highlightIndex];
    if (!item) return;
    item.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, isOpen]);
    useImperativeHandle(ref, () => ({
      focusSupplier() {
        setIsOpen(true);
        setTimeout(() => {
          inputRef.current?.focus();
        }, 40);
      }
}));
  // Filter logic
  const filtered = inputVal && isTypingRef.current
    ? suppliers.filter(s =>
        s.AccountName.toLowerCase().includes(inputVal.toLowerCase())
      )
    : suppliers;

  const handleInput = (e) => {
    isTypingRef.current = true;
    setInputVal(e.target.value);
    setIsOpen(true);
    setHighlightIndex(-1);
  };

  const handleSelect = (supplier) => {
    isTypingRef.current = false;
    setInputVal(supplier.AccountName);
    setIsOpen(false);
    onSupplierSelect(supplier.Id);
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    console.log('SupplierInfo keydown:', e.key, 'isOpen:', isOpen);
    if (!isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
        setHighlightIndex(0);
      }
      return;
    }

    // Prevent default only for navigation keys
    if (['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) {
      e.preventDefault();
    }
    
    switch (e.key) {
      case 'ArrowDown':
        setHighlightIndex(i =>
          i < 0 ? 0 : Math.min(i + 1, filtered.length - 1)
        );
        break;
      case 'ArrowUp':
        setHighlightIndex(i =>
          i <= 0 ? 0 : i - 1
        );
        break;
      case 'Enter':
        if (highlightIndex >= 0 && filtered[highlightIndex]) {
          handleSelect(filtered[highlightIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        isTypingRef.current = false;
        const current = suppliers.find(s => s.Id === header.supplierId);
        setInputVal(current ? current.AccountName : '');
        break;
    }
  };

  return (
    <div className="card">
      <div className="card-header"><span>🏭</span> Supplier Info</div>
      <div className="card-body">
        <div className="form-grid form-grid-2">
          <div
            className="form-group"
            style={{ gridColumn: '1 / -1', position: 'relative' }}
            ref={wrapperRef}
          >
            <label className="form-label">Supplier Name</label>

            {/* Input box */}
          <input
              ref={inputRef}
              type="text"
              className="form-control"
              style={{ height: 30, fontSize: 13 }}
              value={inputVal}
              onChange={handleInput}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder="Select SupplierName"
              autoComplete="off"
            />

            {/* Dropdown arrow */}
            <span
              style={{
                position: 'absolute', right: 8, top: '60%',
                transform: 'translateY(-50%)',
                cursor: 'pointer', color: '#718096', fontSize: 12,
                userSelect: 'none'
              }}
              onMouseDown={e => {
                e.preventDefault();
                setIsOpen(o => !o);
              }}
            >▼</span>

            {/* Dropdown list - always mounted, toggle with display */}
            <ul 
              ref={listRef}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0, right: 0,
                backgroundColor: 'white',
                border: '1px solid #cbd5e0',
                borderRadius: 4,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                maxHeight: 200,
                overflowY: 'auto',
                zIndex: 999,
                margin: 0,
                padding: 0,
                listStyle: 'none',
                display: isOpen ? 'block' : 'none',
              }}>
              {filtered.length === 0 ? (
                <li style={{ padding: '6px 12px', color: '#a0aec0', fontSize: 13 }}>
                  No suppliers found
                </li>
              ) : (
                filtered.map((s, i) => (
                  <li
                    key={s.Id}
                    onMouseDown={() => handleSelect(s)}
                    style={{
                      padding: '6px 12px',
                      fontSize: 13,
                      cursor: 'pointer',
                      backgroundColor:
                        s.Id === header.supplierId
                          ? '#e2e8f0'
                          : i === highlightIndex
                          ? '#edf2f7'
                          : 'white',
                      color: '#2d3748',
                    }}
                  >
                    {s.AccountName}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        {header.supplierId > 0 && (
          <div className="supplier-info-row">
            <div className="sup-badge">
              <span>📍</span>
              <span className="val">{header.supplierCity || header.supplierAddress || '—'}</span>
            </div>
            <div className="sup-badge">
              <span>📞</span>
              <span className="val">{header.supplierContact || '—'}</span>
            </div>
            <div className="sup-badge">
              <span>💰 Balance:</span>
              <span className={`val ${isNeg ? 'balance-neg' : isPos ? 'balance-pos' : ''}`}>
                {isNeg ? '-' : ''}₹{fmtINR(Math.abs(header.supplierBalance))}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});