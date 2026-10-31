import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}-${m}-${y}`;
};

const getTodayStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const CustomDatePicker = ({
  value = '',
  onChange,
  placeholder = 'Select date...',
  className = '',
  required = false,
  color = 'blue', // 'blue', 'red', 'emerald', 'amber'
  min,
  max,
  align = 'auto', // 'left', 'right', or 'auto'
  triggerClassName = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: null, bottom: null, left: 0 });
  const containerRef = useRef(null);
  const popoverRef = useRef(null);

  // Parse current value or fallback to today for view
  const initialDate = value ? new Date(value) : new Date();
  const [viewYear, setViewYear] = useState(
    isNaN(initialDate.getTime()) ? new Date().getFullYear() : initialDate.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState(
    isNaN(initialDate.getTime()) ? new Date().getMonth() : initialDate.getMonth()
  );

  // Update view when value changes externally
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value]);

  const updateCoords = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setIsOpen(false);
      return;
    }

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    // Popover is ~340px high
    const openUp = spaceBelow < 340 && spaceAbove > spaceBelow;

    const popoverWidth = 264;
    const spaceRight = window.innerWidth - rect.left;
    const isRight = align === 'right' || (align === 'auto' && spaceRight < 275);

    let leftPos = isRight ? (rect.right - popoverWidth) : rect.left;
    leftPos = Math.max(8, Math.min(window.innerWidth - popoverWidth - 8, leftPos));

    setCoords({
      top: openUp ? null : Math.round(rect.bottom + 6),
      bottom: openUp ? Math.round(window.innerHeight - rect.top + 6) : null,
      left: Math.round(leftPos),
    });
  }, [align]);

  const toggleOpen = () => {
    if (!isOpen) {
      updateCoords();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  // Keep popover pinned to trigger when scrolling or resizing
  useEffect(() => {
    if (!isOpen) return;

    updateCoords();

    const handleScrollOrResize = () => {
      updateCoords();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updateCoords]);

  // Click outside to close (checks both trigger and portal popover)
  useEffect(() => {
    if (!isOpen) return;

    const handleOutside = (e) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target) &&
        popoverRef.current && !popoverRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  const prevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day) => {
    const formattedMonth = String(viewMonth + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const dateStr = `${viewYear}-${formattedMonth}-${formattedDay}`;
    if (min && dateStr < min) return;
    if (max && dateStr > max) return;
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleSelectToday = (e) => {
    e.stopPropagation();
    const todayStr = getTodayStr();
    if (min && todayStr < min) return;
    if (max && todayStr > max) return;
    onChange(todayStr);
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  // Calendar math
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
  const todayStr = getTodayStr();

  // Dynamic theme colors
  const themes = {
    red: {
      activeTrigger: 'border-red-500 bg-white dark:bg-slate-900 ring-2 ring-red-500/20 text-red-600 dark:text-red-400',
      hoverTrigger: 'hover:border-red-400 dark:hover:border-red-500',
      activeIcon: 'text-red-600 dark:text-red-400',
      year: 'text-red-600 dark:text-red-400',
      navBtn: 'hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/60 dark:hover:text-red-400',
      selectedDay: 'bg-red-600 text-white font-extrabold shadow-xs',
      todayDay: 'border border-red-500 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40',
      normalDayHover: 'hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-600 dark:hover:text-red-400',
      todayBtn: 'text-red-600 dark:text-red-400 hover:underline',
    },
    emerald: {
      activeTrigger: 'border-emerald-600 bg-white dark:bg-slate-900 ring-2 ring-emerald-500/20 text-emerald-600 dark:text-emerald-400',
      hoverTrigger: 'hover:border-emerald-400 dark:hover:border-emerald-500',
      activeIcon: 'text-emerald-600 dark:text-emerald-400',
      year: 'text-emerald-600 dark:text-emerald-400',
      navBtn: 'hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-400',
      selectedDay: 'bg-emerald-600 text-white font-extrabold shadow-xs',
      todayDay: 'border border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40',
      normalDayHover: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-600 dark:hover:text-emerald-400',
      todayBtn: 'text-emerald-600 dark:text-emerald-400 hover:underline',
    },
    amber: {
      activeTrigger: 'border-amber-500 bg-white dark:bg-slate-900 ring-2 ring-amber-500/20 text-amber-600 dark:text-amber-400',
      hoverTrigger: 'hover:border-amber-400 dark:hover:border-amber-500',
      activeIcon: 'text-amber-600 dark:text-amber-400',
      year: 'text-amber-600 dark:text-amber-400',
      navBtn: 'hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/60 dark:hover:text-amber-400',
      selectedDay: 'bg-amber-600 text-white font-extrabold shadow-xs',
      todayDay: 'border border-amber-500 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40',
      normalDayHover: 'hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:text-amber-600 dark:hover:text-amber-400',
      todayBtn: 'text-amber-600 dark:text-amber-400 hover:underline',
    },
    blue: {
      activeTrigger: 'border-blue-600 bg-white dark:bg-slate-900 ring-2 ring-blue-500/20 text-blue-600 dark:text-blue-400',
      hoverTrigger: 'hover:border-blue-400 dark:hover:border-blue-500',
      activeIcon: 'text-blue-600 dark:text-blue-400',
      year: 'text-blue-600 dark:text-blue-400',
      navBtn: 'hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 dark:hover:text-blue-400',
      selectedDay: 'bg-blue-600 text-white font-extrabold shadow-xs',
      todayDay: 'border border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40',
      normalDayHover: 'hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-600 dark:hover:text-blue-400',
      todayBtn: 'text-blue-600 dark:text-blue-400 hover:underline',
    },
  };

  const selectedTheme = themes[color] || (color === 'green' ? themes.emerald : themes.blue);

  const popoverContent = isOpen && typeof document !== 'undefined' ? (
    createPortal(
      <div
        ref={popoverRef}
        style={{
          position: 'fixed',
          left: `${coords.left}px`,
          ...(coords.bottom !== null ? { bottom: `${coords.bottom}px` } : { top: `${coords.top}px` }),
          zIndex: 99999,
        }}
        className="agy-dropdown-panel p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-64 select-none max-h-[360px] overflow-y-auto custom-scrollbar"
      >
        {/* Header with Month / Year and navigation */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <button
            type="button"
            onClick={prevMonth}
            className={`p-1 rounded-lg text-slate-500 ${selectedTheme.navBtn} transition-colors cursor-pointer`}
            title="Previous Month"
          >
            <ChevronLeftIcon className="w-4 h-4 stroke-[2.5]" />
          </button>
          <div className="font-extrabold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1">
            <span>{MONTH_NAMES[viewMonth]}</span>
            <span className={`font-mono ${selectedTheme.year}`}>{viewYear}</span>
          </div>
          <button
            type="button"
            onClick={nextMonth}
            className={`p-1 rounded-lg text-slate-500 ${selectedTheme.navBtn} transition-colors cursor-pointer`}
            title="Next Month"
          >
            <ChevronRightIcon className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Weekday Labels */}
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-slate-400 dark:text-slate-500 mb-1">
          {DAY_NAMES.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {/* Blank leading days */}
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`blank-${i}`} className="w-7 h-7" />
          ))}

          {/* Days of the current month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const formattedMonth = String(viewMonth + 1).padStart(2, '0');
            const formattedDay = String(day).padStart(2, '0');
            const dayDateStr = `${viewYear}-${formattedMonth}-${formattedDay}`;

            const isSelected = value === dayDateStr;
            const isToday = todayStr === dayDateStr;
            const isDisabled = (min && dayDateStr < min) || (max && dayDateStr > max);

            return (
              <button
                key={day}
                type="button"
                disabled={isDisabled}
                onClick={() => handleSelectDay(day)}
                className={`w-7 h-7 flex items-center justify-center text-xs rounded-lg transition-all font-bold ${
                  isDisabled
                    ? 'opacity-30 cursor-not-allowed text-slate-400'
                    : isSelected
                    ? `${selectedTheme.selectedDay} cursor-pointer`
                    : isToday
                    ? `${selectedTheme.todayDay} cursor-pointer`
                    : `text-slate-700 dark:text-slate-200 ${selectedTheme.normalDayHover} cursor-pointer`
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* Footer with Today & Clear */}
        <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] font-bold sticky bottom-0 bg-white dark:bg-slate-900 z-10">
          {!required && (
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={handleSelectToday}
            className={`ml-auto ${selectedTheme.todayBtn} cursor-pointer`}
          >
            Today
          </button>
        </div>
      </div>,
      document.body
    )
  ) : null;

  return (
    <div className={`relative inline-block w-full text-left ${className}`} ref={containerRef}>
      {/* Trigger Input Button */}
      <button
        type="button"
        onClick={toggleOpen}
        className={
          triggerClassName
            ? `${triggerClassName} ${isOpen ? 'ring-2 ring-white/50 dark:ring-emerald-500/40' : ''}`
            : `w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-bold rounded-xl border transition-all duration-150 cursor-pointer shadow-2xs select-none ${
                isOpen
                  ? selectedTheme.activeTrigger
                  : `bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 ${selectedTheme.hoverTrigger} text-slate-800 dark:text-slate-100 hover:bg-slate-50/50 dark:hover:bg-slate-800/40`
              }`
        }
      >
        <span className="font-mono text-xs">
          {value ? formatDisplayDate(value) : <span className={triggerClassName ? "opacity-75 font-sans font-normal" : "text-slate-400 font-sans font-normal"}>{placeholder}</span>}
        </span>
        <CalendarDaysIcon
          className={`w-4 h-4 transition-colors shrink-0 ${
            triggerClassName ? 'opacity-85' : isOpen ? selectedTheme.activeIcon : 'text-slate-400 dark:text-slate-500'
          }`}
        />
      </button>

      {/* Floating Calendar Popover via Portal */}
      {popoverContent}
    </div>
  );
};

export default CustomDatePicker;
