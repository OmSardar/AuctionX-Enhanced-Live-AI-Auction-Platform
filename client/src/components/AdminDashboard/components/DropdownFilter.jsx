import React, { useState, useRef, useEffect } from "react";
import Transition from "../utils/Transition";
import { FaFilter } from "react-icons/fa";

function DropdownFilter({ align = "right" }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const trigger = useRef(null);
  const dropdown = useRef(null);

  const Checkrefs = {
    DirectorIndirect: useRef(null),
    RealTimeValue: useRef(null),
    Topcahnnels: useRef(null),
    SalesRefunds: useRef(null),
    LastOrder: useRef(null),
    TotalSpent: useRef(null),
  };

  const handleFilters = () => {
    Object.keys(Checkrefs).forEach((key) => {
      if (Checkrefs[key].current) {
        Checkrefs[key].current.checked = false;
      }
    });
  };

  // close on click outside
  useEffect(() => {
    const clickHandler = ({ target }) => {
      if (!dropdown.current) return;
      if (
        !dropdownOpen ||
        dropdown.current.contains(target) ||
        trigger.current.contains(target)
      )
        return;
      setDropdownOpen(false);
    };
    document.addEventListener("click", clickHandler);
    return () => document.removeEventListener("click", clickHandler);
  }, [dropdownOpen]);

  // close if the esc key is pressed
  useEffect(() => {
    const keyHandler = ({ keyCode }) => {
      if (!dropdownOpen || keyCode !== 27) return;
      setDropdownOpen(false);
    };
    document.addEventListener("keydown", keyHandler);
    return () => document.removeEventListener("keydown", keyHandler);
  }, [dropdownOpen]);

  return (
    <div className="relative inline-flex">
      <button
        ref={trigger}
        type="button"
        className="inline-flex items-center justify-center p-2.5 rounded-xl border border-border-default/70 bg-surface/90 hover:bg-surface-subtle text-foreground shadow-xs transition hover:border-action-primary/50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring-focus group"
        aria-haspopup="true"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        aria-expanded={dropdownOpen}
        title="Filter"
      >
        <span className="sr-only">Filter</span>
        <FaFilter className="w-3.5 h-3.5 text-action-primary group-hover:scale-110 transition-transform" />
      </button>

      <Transition
        show={dropdownOpen}
        tag="div"
        className={`origin-top-right z-50 absolute top-full min-w-60 bg-surface border border-border-default p-3 rounded-2xl shadow-xl overflow-hidden mt-1.5 backdrop-blur-xl text-foreground ${
          align === "right"
            ? "right-0"
            : "left-0"
        }`}
        enter="transition ease-out duration-200 transform"
        enterStart="opacity-0 -translate-y-2 scale-95"
        enterEnd="opacity-100 translate-y-0 scale-100"
        leave="transition ease-out duration-150"
        leaveStart="opacity-100 scale-100"
        leaveEnd="opacity-0 scale-95"
      >
        <div ref={dropdown}>
          <div className="text-[11px] font-bold text-foreground-muted uppercase tracking-wider px-1 pb-2 border-b border-border-subtle">
            Filter Channels
          </div>
          <ul className="py-2 space-y-1.5">
            <li className="px-1">
              <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer hover:text-action-primary transition-colors">
                <input
                  ref={Checkrefs.DirectorIndirect}
                  type="checkbox"
                  className="rounded border-border-default text-action-primary focus:ring-ring-focus"
                />
                <span className="font-medium">Direct vs Indirect</span>
              </label>
            </li>
            <li className="px-1">
              <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer hover:text-action-primary transition-colors">
                <input
                  ref={Checkrefs.RealTimeValue}
                  type="checkbox"
                  className="rounded border-border-default text-action-primary focus:ring-ring-focus"
                />
                <span className="font-medium">Real-Time Value</span>
              </label>
            </li>
            <li className="px-1">
              <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer hover:text-action-primary transition-colors">
                <input
                  ref={Checkrefs.Topcahnnels}
                  type="checkbox"
                  className="rounded border-border-default text-action-primary focus:ring-ring-focus"
                />
                <span className="font-medium">Top Channels</span>
              </label>
            </li>
            <li className="px-1">
              <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer hover:text-action-primary transition-colors">
                <input
                  ref={Checkrefs.SalesRefunds}
                  type="checkbox"
                  className="rounded border-border-default text-action-primary focus:ring-ring-focus"
                />
                <span className="font-medium">Sales & Refunds</span>
              </label>
            </li>
            <li className="px-1">
              <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer hover:text-action-primary transition-colors">
                <input
                  ref={Checkrefs.LastOrder}
                  type="checkbox"
                  className="rounded border-border-default text-action-primary focus:ring-ring-focus"
                />
                <span className="font-medium">Last Order</span>
              </label>
            </li>
            <li className="px-1">
              <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer hover:text-action-primary transition-colors">
                <input
                  ref={Checkrefs.TotalSpent}
                  type="checkbox"
                  className="rounded border-border-default text-action-primary focus:ring-ring-focus"
                />
                <span className="font-medium">Total Spent</span>
              </label>
            </li>
          </ul>
          <div className="pt-2.5 border-t border-border-subtle flex items-center justify-between">
            <button
              type="button"
              onClick={handleFilters}
              className="text-xs font-semibold text-foreground-muted hover:text-status-error transition-colors cursor-pointer px-2 py-1 rounded-lg"
            >
              Clear
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-action-primary text-white hover:bg-action-primary-hover shadow-xs transition-colors cursor-pointer"
              onClick={() => setDropdownOpen(false)}
            >
              Apply
            </button>
          </div>
        </div>
      </Transition>
    </div>
  );
}

export default DropdownFilter;
