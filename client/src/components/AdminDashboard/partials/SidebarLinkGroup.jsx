import React, { useState, useEffect } from 'react';

function SidebarLinkGroup({
  children,
  activecondition,
}) {

  const [open, setOpen] = useState(activecondition);

  useEffect(() => {
    if (activecondition) {
      setOpen(true);
    }
  }, [activecondition]);

  const handleClick = () => {
    setOpen(!open);
  }

  return (
    <li className={`pl-4 pr-3 py-2 rounded-lg mb-0.5 last:mb-0 bg-linear-to-r ${activecondition ? 'from-[#C65D3A]/15 dark:from-[#C65D3A]/25 to-[#C65D3A]/5' : ''}`}>
      {children(handleClick, open)}
    </li>
  );
}

export default SidebarLinkGroup;