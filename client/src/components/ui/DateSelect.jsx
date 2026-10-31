import React, { useState, useRef, useEffect } from 'react';
import Transition from './Transition';

const defaultOptions = [
  { id: 0, period: 'Today' },
  { id: 1, period: 'Last 7 Days' },
  { id: 2, period: 'Last Month' },
  { id: 3, period: 'Last 12 Months' },
  { id: 4, period: 'All Time' },
];

export function DateSelect({ options = defaultOptions, onSelect, defaultSelected = 2 }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selected, setSelected] = useState(defaultSelected);

  const trigger = useRef(null);
  const dropdown = useRef(null);

  // Close on click outside
  useEffect(() => {
    const clickHandler = ({ target }) => {
      if (!dropdown.current) return;
      if (!dropdownOpen || dropdown.current.contains(target) || trigger.current?.contains(target)) return;
      setDropdownOpen(false);
    };

    if (dropdownOpen) {
      document.addEventListener('click', clickHandler);
    }
    return () => document.removeEventListener('click', clickHandler);
  }, [dropdownOpen]);

  // Close if the esc key is pressed
  useEffect(() => {
    const keyHandler = ({ keyCode }) => {
      if (!dropdownOpen || keyCode !== 27) return;
      setDropdownOpen(false);
    };

    if (dropdownOpen) {
      document.addEventListener('keydown', keyHandler);
    }
    return () => document.removeEventListener('keydown', keyHandler);
  }, [dropdownOpen]);

  const handleSelect = (id) => {
    setSelected(id);
    setDropdownOpen(false);
    if (onSelect) onSelect(options[id]);
  };

  return (
    <div className="relative">
      <button
        ref={trigger}
        className="btn justify-between min-w-44 bg-surface border border-border-default hover:border-border-strong text-foreground-secondary hover:text-foreground"
        aria-label="Select date range"
        aria-haspopup="true"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        aria-expanded={dropdownOpen}
      >
        <span className="flex items-center">
          <svg className="fill-current text-foreground-muted shrink-0 mr-2" width="16" height="16" viewBox="0 0 16 16">
            <path d="M5 4a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2H5Z" />
            <path d="M4 0a4 4 0 0 0-4 4v8a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4V4a4 4 0 0 0-4-4H4ZM2 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Z" />
          </svg>
          <span>{options[selected]?.period || 'Select Date'}</span>
        </span>
        <svg className="shrink-0 ml-1 fill-current text-foreground-muted" width="11" height="7" viewBox="0 0 11 7">
          <path d="M5.4 6.8L0 1.4 1.4 0l4 4 4-4 1.4 1.4z" />
        </svg>
      </button>
      <Transition
        show={dropdownOpen}
        tag="div"
        className="z-10 absolute top-full right-0 w-full bg-surface-raised border border-border-subtle py-1.5 rounded-lg shadow-lg overflow-hidden mt-1"
        enter="transition ease-out duration-100 transform"
        enterStart="opacity-0 -translate-y-2"
        enterEnd="opacity-100 translate-y-0"
        leave="transition ease-out duration-100"
        leaveStart="opacity-100"
        leaveEnd="opacity-0"
      >
        <div
          ref={dropdown}
          className="font-medium text-sm text-foreground"
          onFocus={() => setDropdownOpen(true)}
          onBlur={() => setDropdownOpen(false)}
        >
          {options.map((option) => (
            <button
              key={option.id}
              tabIndex="0"
              className={`flex items-center w-full hover:bg-surface-subtle py-1 px-3 cursor-pointer ${option.id === selected ? 'text-dashboard-accent font-semibold' : 'text-foreground-secondary'}`}
              onClick={() => handleSelect(option.id)}
            >
              <svg className={`shrink-0 mr-2 fill-current text-dashboard-accent ${option.id !== selected ? 'invisible' : ''}`} width="12" height="9" viewBox="0 0 12 9">
                <path d="M10.28.28L3.989 6.575 1.695 4.28A1 1 0 00.28 5.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28.28z" />
              </svg>
              <span>{option.period}</span>
            </button>
          ))}
        </div>
      </Transition>
    </div>
  );
}

export default DateSelect;
