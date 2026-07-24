import { Save, XCircle, Calendar as CalendarIcon } from "lucide-react";
import { useState,useRef,useEffect,useCallback } from "react";

export default function DateFieldDDMMYYYY({ id, value, onChange, disabled }) {

    const pad2 = (n) => String(n).padStart(2, "0");

    const parseIsoDate = (iso) => {
        if (!iso) return { d: "", m: "", y: "" };
        const [y, m, d] = iso.split("-");
        return { d: d || "", m: m || "", y: y || "" };
      };


    const initial = parseIsoDate(value);
    const [day, setDay] = useState(initial.d);
    const [month, setMonth] = useState(initial.m);
    const [year, setYear] = useState(initial.y);
  
    const dayRef = useRef(null);
    const monthRef = useRef(null);
    const yearRef = useRef(null);
    const nativeRef = useRef(null);
  
    // Stay in sync when the value changes from outside this component —
    // e.g. the native calendar-picker icon, or a programmatic reset.
    useEffect(() => {
      const p = parseIsoDate(value);
      setDay(p.d);
      setMonth(p.m);
      setYear(p.y);
    }, [value]);
  
    const commitIfValid = useCallback(
      (d, m, y) => {
        if (isValidDMY(d, m, y)) {
          onChange(`${y}-${pad2(parseInt(m, 10))}-${pad2(parseInt(d, 10))}`);
        }
      },
      [onChange]
    );
    
  
    const handleDayChange = (e) => {
      const v = e.target.value.replace(/\D/g, "").slice(0, 2);
      setDay(v);
      // Auto-advance to Month once 2 digits are entered, or immediately if a
      // single digit can only be a one-digit day (4-9, since 40-99 is invalid).
      if (v.length === 2 || (v.length === 1 && parseInt(v, 10) > 3)) {
        const padded = v.padStart(2, "0");
        setDay(padded);
        commitIfValid(padded, month, year);
        monthRef.current?.focus();
        monthRef.current?.select();
      } else {
        commitIfValid(v, month, year);
      }
    };
  
    const handleMonthChange = (e) => {
      const v = e.target.value.replace(/\D/g, "").slice(0, 2);
      setMonth(v);
      if (v.length === 2 || (v.length === 1 && parseInt(v, 10) > 1)) {
        const padded = v.padStart(2, "0");
        setMonth(padded);
        commitIfValid(day, padded, year);
        yearRef.current?.focus();
        yearRef.current?.select();
      } else {
        commitIfValid(day, v, year);
      }
    };
  
    const handleYearChange = (e) => {
      const v = e.target.value.replace(/\D/g, "").slice(0, 4);
      setYear(v);
      commitIfValid(day, month, v);
    };
  
    const handleSegmentKeyDown = (segment) => (e) => {
      const el = e.target;
      const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
      const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
  
      if (e.key === "Backspace" && atStart) {
        if (segment === "month") { dayRef.current?.focus(); dayRef.current?.select(); }
        if (segment === "year") { monthRef.current?.focus(); monthRef.current?.select(); }
      } else if (e.key === "ArrowLeft" && atStart) {
        if (segment === "month") dayRef.current?.focus();
        if (segment === "year") monthRef.current?.focus();
      } else if (e.key === "ArrowRight" && atEnd) {
        if (segment === "day") monthRef.current?.focus();
        if (segment === "month") yearRef.current?.focus();
      }
    };
    const isValidDMY = (d, m, y) => {
        if (!d || !m || y.length !== 4) return false;
        const dd = parseInt(d, 10);
        const mm = parseInt(m, 10);
        const yy = parseInt(y, 10);
        if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false;
        const dt = new Date(yy, mm - 1, dd);
        return dt.getFullYear() === yy && dt.getMonth() === mm - 1 && dt.getDate() === dd;
      };
  
    // Picker selection (native <input type="date">) updates all three
    // segments and commits the value exactly like typing does.
    const handleNativePickerChange = (e) => {
      const iso = e.target.value;
      if (!iso) return;
      const p = parseIsoDate(iso);
      setDay(p.d);
      setMonth(p.m);
      setYear(p.y);
      onChange(iso);
    };
  
    const openPicker = () => {
      const el = nativeRef.current;
      if (!el || disabled) return;
      if (typeof el.showPicker === "function") {
        try {
          el.showPicker();
          return;
        } catch {
          // fall through to focus-based fallback below
        }
      }
      el.focus();
    };
  
    return (
      <div className={`so-date-wrap${disabled ? " so-date-wrap-disabled" : ""}`}>
        <div className="so-date-segments">
          <input
            id={id}
            ref={dayRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="DD"
            maxLength={2}
            className="so-date-seg so-date-seg-dd"
            value={day}
            disabled={disabled}
            onChange={handleDayChange}
            onKeyDown={handleSegmentKeyDown("day")}
            onFocus={(e) => e.target.select()}
          />
          <span className="so-date-sep">-</span>
          <input
            ref={monthRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="MM"
            maxLength={2}
            className="so-date-seg so-date-seg-mm"
            value={month}
            disabled={disabled}
            onChange={handleMonthChange}
            onKeyDown={handleSegmentKeyDown("month")}
            onFocus={(e) => e.target.select()}
          />
          <span className="so-date-sep">-</span>
          <input
            ref={yearRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="YYYY"
            maxLength={4}
            className="so-date-seg so-date-seg-yyyy"
            value={year}
            disabled={disabled}
            onChange={handleYearChange}
            onKeyDown={handleSegmentKeyDown("year")}
            onFocus={(e) => e.target.select()}
          />
        </div>
  
        <button
          type="button"
          className="so-date-icon-btn"
          onClick={openPicker}
          disabled={disabled}
          tabIndex={-1}
          aria-label="Open calendar picker"
        >
          <CalendarIcon size={15} />
        </button>
  
        {/* Native date input kept only for the calendar picker UI — visually
            hidden, never used for typing, always mirrors the ISO value above. */}
        <input
          ref={nativeRef}
          type="date"
          className="so-date-native-hidden"
          value={value || ""}
          onChange={handleNativePickerChange}
          tabIndex={-1}
          aria-hidden="true"
          disabled={disabled}
        />
      </div>
    );
  }

