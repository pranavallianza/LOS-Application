'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import Calendar from 'react-calendar';

const leadDatePickerStyles = `
.lead-calendar-picker{position:relative;width:100%;min-width:0}
.lead-calendar-picker .lead-date-picker-trigger{height:39px;min-height:39px;padding:0 10px;border:1px solid #cbd9d6;border-radius:5px;background:#fff;color:#263f41;font-size:12px}
.lead-calendar-picker .lead-date-picker-trigger:disabled{background:#f1f5f4;color:#839291;cursor:not-allowed;opacity:1}
.lead-date-picker-clear{width:100%;margin-top:8px;padding:7px;border:1px solid #d4e8e2;border-radius:5px;background:#fff;color:#176e67;font:inherit;font-size:12px;cursor:pointer}
.lead-date-picker-clear:hover{background:#e5f3ef}
`;

const toCalendarDate = (value) => {
  if (!value) return null;
  const dateParts = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateParts) return null;

  const [, yearText, monthText, dayText] = dateParts;
  const year = Number(yearText);
  const month = Number(monthText) - 1;
  const day = Number(dayText);
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
    ? date
    : null;
};

const formatDate = (value, emptyLabel) => {
  const date = toCalendarDate(value);
  return date
    ? date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    : emptyLabel;
};

const toInputDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function LeadDatePicker({
  id,
  name,
  label,
  value,
  onChange,
  min,
  max,
  calendarStartDate,
  disabled = false,
  required = false,
  className = '',
  invalid = false,
  emptyLabel = 'Select date',
  triggerStyle,
  popupPlacement = 'below',
}) {
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [popupPosition, setPopupPosition] = useState(null);
  const selectedDate = toCalendarDate(value);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleOutsidePointerDown = (event) => {
      if (
        !containerRef.current?.contains(event.target)
        && !popoverRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || popupPlacement !== 'side') {
      setPopupPosition(null);
      return undefined;
    }

    const updatePopupPosition = () => {
      const trigger = triggerRef.current;
      const popover = popoverRef.current;
      if (!trigger || !popover) return;

      const triggerRect = trigger.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();
      const margin = 12;
      const gap = 8;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const rightFits = triggerRect.right + gap + popoverRect.width <= viewportWidth - margin;
      const leftFits = triggerRect.left - gap - popoverRect.width >= margin;

      let left;
      let top;
      if (rightFits) {
        left = triggerRect.right + gap;
        top = Math.min(
          Math.max(triggerRect.top, margin),
          Math.max(margin, viewportHeight - popoverRect.height - margin),
        );
      } else if (leftFits) {
        left = triggerRect.left - gap - popoverRect.width;
        top = Math.min(
          Math.max(triggerRect.top, margin),
          Math.max(margin, viewportHeight - popoverRect.height - margin),
        );
      } else {
        const belowFits = triggerRect.bottom + gap + popoverRect.height <= viewportHeight - margin;
        left = Math.min(
          Math.max(triggerRect.left, margin),
          Math.max(margin, viewportWidth - popoverRect.width - margin),
        );
        if (belowFits) {
          top = triggerRect.bottom + gap;
        } else if (triggerRect.top - gap - popoverRect.height >= margin) {
          top = triggerRect.top - gap - popoverRect.height;
        } else {
          top = Math.min(
            Math.max(triggerRect.bottom + gap, margin),
            Math.max(margin, viewportHeight - popoverRect.height - margin),
          );
        }
      }

      setPopupPosition({ top, left });
    };

    const frame = window.requestAnimationFrame(updatePopupPosition);
    window.addEventListener('resize', updatePopupPosition);
    window.addEventListener('scroll', updatePopupPosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePopupPosition);
      window.removeEventListener('scroll', updatePopupPosition, true);
    };
  }, [isOpen, popupPlacement]);

  const handleDateChange = (date) => {
    if (!(date instanceof Date)) return;
    onChange(toInputDate(date));
    setIsOpen(false);
  };

  const popover = isOpen ? (
    <div
      ref={popoverRef}
      className={`dob-calendar-popover ${popupPlacement === 'side' ? 'dob-calendar-popover-side' : ''}`.trim()}
      role="dialog"
      aria-label={`Choose ${label}`}
      style={popupPlacement === 'side' ? {
        position: 'fixed',
        top: popupPosition?.top ?? 0,
        left: popupPosition?.left ?? 0,
        zIndex: 1000,
        visibility: popupPosition ? 'visible' : 'hidden',
      } : undefined}
    >
      <Calendar
        className="loan-birth-calendar"
        value={selectedDate}
        minDate={toCalendarDate(min) || undefined}
        maxDate={toCalendarDate(max) || undefined}
        defaultActiveStartDate={selectedDate || toCalendarDate(calendarStartDate) || toCalendarDate(min) || toCalendarDate(max) || new Date()}
        onChange={handleDateChange}
        locale="en-IN"
      />
      {value && !required ? (
        <button type="button" className="lead-date-picker-clear" onClick={() => {
          onChange('');
          setIsOpen(false);
        }}>Clear date</button>
      ) : null}
    </div>
  ) : null;

  return (
    <>
      <style>{leadDatePickerStyles}</style>
      <div ref={containerRef} className={`lead-calendar-picker ${className}`.trim()}>
        <input type="hidden" name={name} value={value || ''} disabled={disabled} />
        <button
          id={id}
          type="button"
          className={`dob-picker-trigger lead-date-picker-trigger ${invalid ? 'has-error' : ''}`.trim()}
          aria-label={`Choose ${label}`}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-required={required}
          aria-invalid={invalid || undefined}
          data-date-picker-trigger={name}
          disabled={disabled}
          ref={triggerRef}
          style={triggerStyle}
          onClick={() => setIsOpen((open) => !open)}
        >
          <span className={value ? '' : 'dob-picker-placeholder'}>{formatDate(value, emptyLabel)}</span>
          <CalendarDays size={16} aria-hidden="true" />
        </button>
        {popupPlacement === 'side' && popover && typeof document !== 'undefined'
          ? createPortal(popover, document.body)
          : popover}
      </div>
    </>
  );
}
