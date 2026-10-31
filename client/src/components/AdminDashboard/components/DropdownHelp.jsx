import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import Transition from "../utils/Transition";
import { FaQuestionCircle, FaBook, FaHeadset } from "react-icons/fa";

function DropdownHelp({ align = "right" }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const trigger = useRef(null);
  const dropdown = useRef(null);

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
        className={`w-9 h-9 flex items-center justify-center rounded-xl border border-border-default/60 hover:border-action-primary/50 bg-surface/80 hover:bg-surface-subtle text-foreground-muted hover:text-action-primary shadow-xs transition-all cursor-pointer ${
          dropdownOpen ? "bg-surface-raised border-action-primary text-action-primary" : ""
        }`}
        aria-haspopup="true"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        aria-expanded={dropdownOpen}
        title="Admin Help & Docs"
      >
        <span className="sr-only">Need help?</span>
        <FaQuestionCircle className="w-4 h-4" />
      </button>

      <Transition
        className={`origin-top-right z-50 absolute top-full min-w-48 bg-surface border border-border-default p-2 rounded-2xl shadow-xl overflow-hidden mt-1.5 backdrop-blur-xl text-foreground ${
          align === "right" ? "right-0" : "left-0"
        }`}
        show={dropdownOpen}
        enter="transition ease-out duration-200 transform"
        enterStart="opacity-0 -translate-y-2 scale-95"
        enterEnd="opacity-100 translate-y-0 scale-100"
        leave="transition ease-out duration-150"
        leaveStart="opacity-100 scale-100"
        leaveEnd="opacity-0 scale-95"
      >
        <div
          ref={dropdown}
          onFocus={() => setDropdownOpen(true)}
          onBlur={() => setDropdownOpen(false)}
        >
          <div className="text-[11px] font-bold text-foreground-muted uppercase tracking-wider px-2.5 pt-1 pb-2 border-b border-border-subtle">
            Need Help?
          </div>
          <ul className="py-1 space-y-1 text-xs">
            <li>
              <Link
                className="font-medium text-foreground hover:text-action-primary hover:bg-surface-subtle flex items-center gap-2.5 py-2 px-2.5 rounded-xl transition-all"
                to="/admin/dashboard/Documentation"
                onClick={() => setDropdownOpen(false)}
              >
                <FaBook className="w-3.5 h-3.5 text-action-primary" />
                <span>Admin Documentation</span>
              </Link>
            </li>
            <li>
              <Link
                className="font-medium text-foreground hover:text-action-primary hover:bg-surface-subtle flex items-center gap-2.5 py-2 px-2.5 rounded-xl transition-all"
                to="/support"
                onClick={() => setDropdownOpen(false)}
              >
                <FaHeadset className="w-3.5 h-3.5 text-brand-gold" />
                <span>Platform Support</span>
              </Link>
            </li>
          </ul>
        </div>
      </Transition>
    </div>
  );
}

export default DropdownHelp;
