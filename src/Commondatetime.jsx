import { Save, XCircle, Calendar as CalendarIcon } from "lucide-react";
import { useState, useRef, useEffect, useLayoutEffect } from "react";

export default function DateFieldDDMMYYYY({ id, value, onChange, disabled, onEnter }) {
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

  // Holds a caret position to restore after the next render of a given
  // segment. We always restore to the END of the filtered digits rather
  // than trying to track the browser's reported selectionStart — see
  // handleDayChange/handleMonthChange/handleYearChange for why.
  const pendingCaret = useRef({ day: null, month: null, year: null });

  // Stay in sync when the value changes from outside this component —
  // e.g. the native calendar-picker icon, or a programmatic reset.
  useEffect(() => {
    const p = parseIsoDate(value);
    setDay(p.d);
    setMonth(p.m);
    setYear(p.y);
  }, [value]);

  useLayoutEffect(() => {
    const pos = pendingCaret.current.day;
    if (pos !== null) {
      dayRef.current?.setSelectionRange(pos, pos);
      pendingCaret.current.day = null;
    }
  }, [day]);

  useLayoutEffect(() => {
    const pos = pendingCaret.current.month;
    if (pos !== null) {
      monthRef.current?.setSelectionRange(pos, pos);
      pendingCaret.current.month = null;
    }
  }, [month]);

  useLayoutEffect(() => {
    const pos = pendingCaret.current.year;
    if (pos !== null) {
      yearRef.current?.setSelectionRange(pos, pos);
      pendingCaret.current.year = null;
    }
  }, [year]);

  const isValidDMY = (d, m, y) => {
    if (!d || !m || y.length !== 4) return false;
    const dd = parseInt(d, 10);
    const mm = parseInt(m, 10);
    const yy = parseInt(y, 10);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false;
    const dt = new Date(yy, mm - 1, dd);
    return dt.getFullYear() === yy && dt.getMonth() === mm - 1 && dt.getDate() === dd;
  };

  const commitIfValid = (d, m, y) => {
    if (isValidDMY(d, m, y)) {
      onChange(`${y}-${pad2(parseInt(m, 10))}-${pad2(parseInt(d, 10))}`);
    }
  };

  // Focus a field and place the caret at the start or end (used for
  // arrow-key navigation and segment auto-advance), without selecting.
  const focusAt = (ref, position) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const pos = position === "end" ? el.value.length : 0;
    try {
      el.setSelectionRange(pos, pos);
    } catch {
      // ignore inputs that don't support selection ranges
    }
  };

  // Tab-focus into a segment selects its entire contents (like the
  // native <input type="date"> UX), so the user can just start typing
  // to overwrite it directly — no manual clearing.
  const selectSegment = (e) => {
    e.target.select();
  };

  // Mouse clicks need special handling. Calling .select() from onFocus/
  // onClick can be silently overridden by the browser's OWN default
  // click behavior — placing an unselected caret at the click point —
  // which runs as part of that same click. On a single click (the one
  // that also focuses a previously-unfocused field) that default action
  // was winning, so the segment ended up NOT selected: the first digit
  // typed inserted at the click position instead of replacing the
  // segment, and the caret math for the following digit landed in the
  // wrong spot — "10" rendered as "01". A double click "worked" only by
  // accident, because selection got reapplied a second time after the
  // browser's default action had already settled.
  //
  // The fix is to prevent that default action before it happens (on
  // mousedown) and select the text ourselves — this makes single and
  // double click behave identically and removes the race entirely.
  const handleSegmentMouseDown = (e) => {
    const el = e.currentTarget;
    e.preventDefault();
    el.focus();
    el.select();
  };

  // Strip everything down to digits and cap at maxLen. Deliberately does
  // NOT try to compute/preserve a caret position from e.target.selectionStart:
  // that value can be unreliable immediately after a select()-all (from
  // focus/click), which was causing the cursor to snap back to the start
  // of the segment after the first digit — so the second digit landed
  // *before* the first one (typing "10" rendered as "01"). Since these
  // are short, left-to-right numeric segments, placing the caret at the
  // end of the filtered digits after every change is both simpler and
  // correct for the overwhelming majority of interactions (typing,
  // select-all-and-overwrite).
  const digitsOnly = (raw, maxLen) => raw.replace(/\D/g, "").slice(0, maxLen);

  const handleDayChange = (e) => {
    const filtered = digitsOnly(e.target.value, 2);
    setDay(filtered);
    pendingCaret.current.day = filtered.length;

    if (filtered.length === 2) {
      // Full 2 digits typed — safe to commit now and auto-advance.
      commitIfValid(filtered, month, year);
      monthRef.current?.focus();
      monthRef.current?.select();
    }
    // Else: mid-typing (0 or 1 digit). Do NOT commit yet — a lone digit
    // like "1" can already form a "valid" date (day 01) if month/year
    // are filled, which would fire onChange, round-trip through the
    // parent, and get resynced back as "01" before the user finishes
    // typing the second digit. Wait for either the 2nd digit or a blur
    // (see handleSegmentBlur) instead.
  };

  const handleMonthChange = (e) => {
    const filtered = digitsOnly(e.target.value, 2);
    setMonth(filtered);
    pendingCaret.current.month = filtered.length;

    if (filtered.length === 2) {
      commitIfValid(day, filtered, year);
      yearRef.current?.focus();
      yearRef.current?.select();
    }
    // Same reasoning as handleDayChange — avoid a premature commit on a
    // single valid digit while the user may still be typing.
  };

  const handleYearChange = (e) => {
    const filtered = digitsOnly(e.target.value, 4);
    setYear(filtered);
    pendingCaret.current.year = filtered.length;
    // No premature-commit risk here — isValidDMY already requires the
    // year to be exactly 4 digits, so partial years never commit.
    commitIfValid(day, month, filtered);
  };

  // Finalizes a partially-typed single-digit day/month when the user
  // leaves the field (Tab, click elsewhere) without typing a 2nd digit —
  // e.g. typing just "5" for day and tabbing out should commit as day 05.
  const handleSegmentBlur = () => {
    commitIfValid(day, month, year);
  };

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  const adjustDay = (delta) => {
    const base = parseInt(day, 10);
    const current = Number.isNaN(base) ? (delta > 0 ? 0 : 1) : base;
    const next = clamp(current + delta, 1, 31);
    const padded = pad2(next);
    setDay(padded);
    commitIfValid(padded, month, year);
  };

  const adjustMonth = (delta) => {
    const base = parseInt(month, 10);
    const current = Number.isNaN(base) ? (delta > 0 ? 0 : 1) : base;
    const next = clamp(current + delta, 1, 12);
    const padded = pad2(next);
    setMonth(padded);
    commitIfValid(day, padded, year);
  };

  const adjustYear = (delta) => {
    const base = parseInt(year, 10);
    const current = Number.isNaN(base) ? new Date().getFullYear() - delta : base;
    const next = clamp(current + delta, 0, 9999);
    const padded = String(next).padStart(4, "0");
    setYear(padded);
    commitIfValid(day, month, padded);
  };

  const handleSegmentKeyDown = (segment) => (e) => {
    const el = e.target;
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
    const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;

    if (e.key === "Enter") {
      e.preventDefault();
      if (typeof onEnter === "function") onEnter();
      return;
    }

    if (e.key === "Backspace" && atStart) {
      if (segment === "month") focusAt(dayRef, "end");
      if (segment === "year") focusAt(monthRef, "end");
      return;
    }

    if (e.key === "ArrowLeft") {
      if (atStart) {
        e.preventDefault();
        if (segment === "month") focusAt(dayRef, "end");
        if (segment === "year") focusAt(monthRef, "end");
      }
      return;
    }

    if (e.key === "ArrowRight") {
      if (atEnd) {
        e.preventDefault();
        if (segment === "day") focusAt(monthRef, "start");
        if (segment === "month") focusAt(yearRef, "start");
      }
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (segment === "day") adjustDay(1);
      if (segment === "month") adjustMonth(1);
      if (segment === "year") adjustYear(1);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (segment === "day") adjustDay(-1);
      if (segment === "month") adjustMonth(-1);
      if (segment === "year") adjustYear(-1);
      return;
    }
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
      {/* Blue selection highlight for the DD/MM/YYYY segments, so a single
          click (or tab-focus) into a segment shows it selected in blue,
          matching the app's #1a56db accent — ready to be typed over. */}
      <style>{`
        .so-date-seg::selection { background: #1a56db; color: #fff; }
        .so-date-seg::-moz-selection { background: #1a56db; color: #fff; }
      `}</style>

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
          onFocus={selectSegment}
          onMouseDown={handleSegmentMouseDown}
          onBlur={handleSegmentBlur}
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
          onFocus={selectSegment}
          onMouseDown={handleSegmentMouseDown}
          onBlur={handleSegmentBlur}
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
          onFocus={selectSegment}
          onMouseDown={handleSegmentMouseDown}
          onBlur={handleSegmentBlur}
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