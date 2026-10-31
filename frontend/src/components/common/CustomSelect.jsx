import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, CheckIcon } from '@heroicons/react/24/outline';

const CustomSelect = ({
  value,
  onChange,
  options = [],
  placeholder = 'Select option...',
  className = '',
  dropdownClassName = '',
  searchable = false,
  searchPlaceholder = 'Search...',
  color = 'blue', // 'blue' or 'red'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  const isRed = color === 'red';

  const toggleOpen = () => {
    if (!isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpwards(spaceBelow < 220);
    }
    setIsOpen((prev) => !prev);
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format options: support string[] or { value, label }[]
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'object' && opt !== null) {
      return { value: opt.value, label: opt.label ?? String(opt.value) };
    }
    return { value: opt, label: String(opt) };
  });

  const selectedOption = normalizedOptions.find(
    (opt) => String(opt.value) === String(value)
  );

  const filteredOptions = searchable && searchTerm.trim()
    ? normalizedOptions.filter((opt) =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : normalizedOptions;

  const activeTriggerClass = isRed
    ? 'border-red-500 bg-white dark:bg-slate-900 ring-2 ring-red-500/20 text-red-600 dark:text-red-400'
    : 'border-blue-600 bg-white dark:bg-slate-900 ring-2 ring-blue-500/20 text-blue-600 dark:text-blue-400';

  const hoverTriggerClass = isRed
    ? 'hover:border-red-400 dark:hover:border-red-500'
    : 'hover:border-blue-400 dark:hover:border-blue-500';

  const activeChevronClass = isRed
    ? 'text-red-600 dark:text-red-400'
    : 'text-blue-600 dark:text-blue-400';

  const searchFocusClass = isRed
    ? 'focus:border-red-500 focus:ring-1 focus:ring-red-500'
    : 'focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

  const selectedItemClass = isRed
    ? 'bg-red-600 text-white shadow-xs'
    : 'bg-blue-600 text-white shadow-xs';

  const hoverItemClass = isRed
    ? 'text-slate-700 dark:text-slate-200 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-600 dark:hover:text-red-400'
    : 'text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-600 dark:hover:text-blue-400';

  return (
    <div className={`relative inline-block w-full text-left ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={toggleOpen}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all duration-150 cursor-pointer shadow-2xs select-none ${
          isOpen
            ? activeTriggerClass
            : `bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 ${hoverTriggerClass} text-slate-800 dark:text-slate-100 hover:bg-slate-50/50 dark:hover:bg-slate-800/40`
        }`}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDownIcon
          className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0 ${
            isOpen ? `rotate-180 ${activeChevronClass}` : ''
          }`}
        />
      </button>

      {/* Floating Menu */}
      {isOpen && (
        <div
          className={`agy-dropdown-panel absolute left-0 ${openUpwards ? 'bottom-full mb-1.5' : 'mt-1.5'} w-full min-w-[90px] z-50 p-1.5 space-y-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl dark:shadow-2xl ${dropdownClassName}`}
        >
          {searchable && (
            <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 mb-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                autoFocus
                className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none ${searchFocusClass}`}
              />
            </div>
          )}

          <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-slate-400 text-center italic">
                No options found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                      isSelected
                        ? selectedItemClass
                        : hoverItemClass
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && (
                      <CheckIcon className="w-4 h-4 text-white shrink-0 stroke-[2.5]" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
