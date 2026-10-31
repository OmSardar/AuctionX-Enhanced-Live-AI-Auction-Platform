import { useState } from "react";
import Sidebar from "../partials/Sidebar";
import Header from "../partials/Header";
import DashboardCard10 from "../partials/dashboard/SubscriptionPage";
import ChatQnA from "../../Common/ChatQnA/ChatQnA";

const Subscriptions = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* Content area */}
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        {/*  Site header */}
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="grow">
          <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
            {/* Page Header */}
            <div className="mb-6">
              <h1 className="text-2xl md:text-3xl font-bold font-display text-foreground">
                Seller Membership & Subscriptions
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your active storefront tier, auction listing quotas, and payment history.
              </p>
            </div>

            {/* Cards */}
            <DashboardCard10 />
                            <ChatQnA />

          </div>
        </main>
      </div>
    </div>
  );
};

export default Subscriptions;
