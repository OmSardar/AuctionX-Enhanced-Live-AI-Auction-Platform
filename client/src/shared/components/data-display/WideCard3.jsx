import React from 'react';

function DashboardCard13() {
  return (
    <div className="col-span-full xl:col-span-6 bg-surface border border-border-subtle shadow-card rounded-xl">
      <header className="px-5 py-4 border-b border-border-subtle">
        <h2 className="font-semibold text-foreground">Income/Expenses</h2>
      </header>
      <div className="p-3">

        {/* Card content */}
        {/* "Today" group */}
        <div>
          <header className="text-xs uppercase text-foreground-muted bg-surface-subtle border border-border-subtle rounded-sm font-semibold p-2">Today</header>
          <ul className="my-1">
            {/* Item */}
            <li className="flex px-2">
              <div className="w-9 h-9 rounded-full shrink-0 bg-red-500 my-2 mr-3">
                <svg className="w-9 h-9 fill-current text-white" viewBox="0 0 36 36">
                  <path d="M17.7 24.7l1.4-1.4-4.3-4.3H25v-2H14.8l4.3-4.3-1.4-1.4L11 18z" />
                </svg>
              </div>
              <div className="grow flex items-center border-b border-border-subtle text-sm py-2">
                <div className="grow flex justify-between">
                  <div className="self-center"><a className="font-medium text-foreground hover:text-accent-dashboard transition-colors" href="#0">Qonto</a> billing</div>
                  <div className="shrink-0 self-start ml-2">
                    <span className="font-medium font-numeric text-foreground">-₹49.88</span>
                  </div>
                </div>
              </div>
            </li>
            {/* Item */}
            <li className="flex px-2">
              <div className="w-9 h-9 rounded-full shrink-0 bg-green-500 my-2 mr-3">
                <svg className="w-9 h-9 fill-current text-white" viewBox="0 0 36 36">
                  <path d="M18.3 11.3l-1.4 1.4 4.3 4.3H11v2h10.2l-4.3 4.3 1.4 1.4L25 18z" />
                </svg>
              </div>
              <div className="grow flex items-center border-b border-border-subtle text-sm py-2">
                <div className="grow flex justify-between">
                  <div className="self-center"><a className="font-medium text-foreground hover:text-accent-dashboard transition-colors" href="#0">Cruip.com</a> Market Ltd 70 Wilson St London</div>
                  <div className="shrink-0 self-start ml-2">
                    <span className="font-medium font-numeric text-status-success">+₹249.88</span>
                  </div>
                </div>
              </div>
            </li>
            {/* Item */}
            <li className="flex px-2">
              <div className="w-9 h-9 rounded-full shrink-0 bg-green-500 my-2 mr-3">
                <svg className="w-9 h-9 fill-current text-white" viewBox="0 0 36 36">
                  <path d="M18.3 11.3l-1.4 1.4 4.3 4.3H11v2h10.2l-4.3 4.3 1.4 1.4L25 18z" />
                </svg>
              </div>
              <div className="grow flex items-center border-b border-border-subtle text-sm py-2">
                <div className="grow flex justify-between">
                  <div className="self-center"><a className="font-medium text-foreground hover:text-accent-dashboard transition-colors" href="#0">Notion Labs Inc</a></div>
                  <div className="shrink-0 self-start ml-2">
                    <span className="font-medium font-numeric text-status-success">+₹99.99</span>
                  </div>
                </div>
              </div>
            </li>
            {/* Item */}
            <li className="flex px-2">
              <div className="w-9 h-9 rounded-full shrink-0 bg-green-500 my-2 mr-3">
                <svg className="w-9 h-9 fill-current text-white" viewBox="0 0 36 36">
                  <path d="M18.3 11.3l-1.4 1.4 4.3 4.3H11v2h10.2l-4.3 4.3 1.4 1.4L25 18z" />
                </svg>
              </div>
              <div className="grow flex items-center border-b border-border-subtle text-sm py-2">
                <div className="grow flex justify-between">
                  <div className="self-center"><a className="font-medium text-foreground hover:text-accent-dashboard transition-colors" href="#0">Market Cap Ltd</a></div>
                  <div className="shrink-0 self-start ml-2">
                    <span className="font-medium font-numeric text-status-success">+₹1,200.88</span>
                  </div>
                </div>
              </div>
            </li>
            {/* Item */}
            <li className="flex px-2">
              <div className="w-9 h-9 rounded-full shrink-0 bg-surface-subtle border border-border-subtle my-2 mr-3">
                <svg className="w-9 h-9 fill-current text-foreground-muted" viewBox="0 0 36 36">
                  <path d="M21.477 22.89l-8.368-8.367a6 6 0 008.367 8.367zm1.414-1.413a6 6 0 00-8.367-8.367l8.367 8.367zM18 26a8 8 0 110-16 8 8 0 010 16z" />
                </svg>
              </div>
              <div className="grow flex items-center border-b border-border-subtle text-sm py-2">
                <div className="grow flex justify-between">
                  <div className="self-center"><a className="font-medium text-foreground hover:text-accent-dashboard transition-colors" href="#0">App.com</a> Market Ltd 70 Wilson St London</div>
                  <div className="shrink-0 self-start ml-2">
                    <span className="font-medium font-numeric text-foreground-muted line-through">+₹99.99</span>
                  </div>
                </div>
              </div>
            </li>
            {/* Item */}
            <li className="flex px-2">
              <div className="w-9 h-9 rounded-full shrink-0 bg-red-500 my-2 mr-3">
                <svg className="w-9 h-9 fill-current text-white" viewBox="0 0 36 36">
                  <path d="M17.7 24.7l1.4-1.4-4.3-4.3H25v-2H14.8l4.3-4.3-1.4-1.4L11 18z" />
                </svg>
              </div>
              <div className="grow flex items-center text-sm py-2">
                <div className="grow flex justify-between">
                  <div className="self-center"><a className="font-medium text-foreground hover:text-accent-dashboard transition-colors" href="#0">App.com</a> Market Ltd 70 Wilson St London</div>
                  <div className="shrink-0 self-start ml-2">
                    <span className="font-medium font-numeric text-foreground">-₹49.88</span>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </div>

      </div>
    </div>
  );
}

export default DashboardCard13;
