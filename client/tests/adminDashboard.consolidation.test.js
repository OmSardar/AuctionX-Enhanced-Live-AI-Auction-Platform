import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, "..");
const adminPagesDir = path.resolve(clientRoot, "src/components/AdminDashboard/pages");
const partialsDir = path.resolve(clientRoot, "src/components/AdminDashboard/partials/dashboard");

test("Stage 7.42 — Unified Audit Explorer & Canonical Route Registration", () => {
  const explorerPath = path.resolve(adminPagesDir, "AdminAuditExplorer.jsx");
  assert.ok(fs.existsSync(explorerPath), "AdminAuditExplorer.jsx must exist");
  const content = fs.readFileSync(explorerPath, "utf-8");

  assert.ok(content.includes("AdminDashboardShell"), "AdminAuditExplorer must adopt AdminDashboardShell");
  assert.ok(content.includes("/admin/audit-logs"), "AdminAuditExplorer must fetch from /admin/audit-logs");
  assert.ok(content.includes('data-lenis-prevent="true"'), "AdminAuditExplorer must declare data-lenis-prevent='true'");
  assert.ok(content.includes("overscroll-contain"), "AdminAuditExplorer modal must declare overscroll-contain");

  const appPath = path.resolve(clientRoot, "src/App.jsx");
  const appContent = fs.readFileSync(appPath, "utf-8");
  assert.ok(appContent.includes('path="/admin/audit-logs"'), "App.jsx must register /admin/audit-logs route");
  assert.ok(appContent.includes("AdminAuditExplorer"), "App.jsx must mount AdminAuditExplorer");
});

test("Stage 7.42 — Sidebar Consolidated Navigation & Audit Explorer Link", () => {
  const sidebarPath = path.resolve(clientRoot, "src/components/AdminDashboard/partials/Sidebar.jsx");
  assert.ok(fs.existsSync(sidebarPath), "Sidebar.jsx must exist");
  const content = fs.readFileSync(sidebarPath, "utf-8");

  assert.ok(content.includes('to="/admin/audit-logs"'), "Sidebar must contain NavLink to /admin/audit-logs");
  assert.ok(content.includes("Audit Explorer"), "Sidebar must display Audit Explorer label");
  assert.ok(content.includes("bg-surface"), "Sidebar must use bg-surface theme token");
  assert.ok(content.includes("border-border-subtle"), "Sidebar must use border-border-subtle theme token");
});

test("Stage 7.42 — Real Database Analytics Telemetry in AdminAnalytics & AdminSales", () => {
  const analyticsPath = path.resolve(adminPagesDir, "AdminAnalytics.jsx");
  const analyticsContent = fs.readFileSync(analyticsPath, "utf-8");

  assert.ok(
    analyticsContent.includes("/admin/analytics/overview") ||
      analyticsContent.includes("ANALYTICS_OVERVIEW_QUERY"),
    "AdminAnalytics must query real analytics telemetry"
  );
  assert.ok(
    analyticsContent.includes("metrics={data?.revenueTimeSeries}") ||
      analyticsContent.includes("metrics={data?.categoryDistribution}"),
    "AdminAnalytics must pass dynamic real metrics to chart components"
  );

  const salesPath = path.resolve(adminPagesDir, "AdminSales.jsx");
  const salesContent = fs.readFileSync(salesPath, "utf-8");
  assert.ok(
    salesContent.includes("/admin/analytics/overview") ||
      salesContent.includes("ANALYTICS_OVERVIEW_QUERY"),
    "AdminSales must query real analytics telemetry"
  );
  assert.ok(
    salesContent.includes("metrics={data?.revenueTimeSeries}") ||
      salesContent.includes("metrics={data?.disputeReasons}"),
    "AdminSales must pass dynamic real metrics to sales charts"
  );
});

test("Stage 7.42 — Removal of Dummy Placeholder Labels in Chart Cards", () => {
  const card1 = fs.readFileSync(path.resolve(partialsDir, "GraphWide1.jsx"), "utf-8");
  assert.strictEqual(card1.includes("Acme Plus"), false, "GraphWide1 must not contain dummy 'Acme Plus' label");
  assert.ok(card1.includes("Gross Platform Sales"), "GraphWide1 must display Gross Platform Sales");

  const card2 = fs.readFileSync(path.resolve(partialsDir, "GraphWide2.jsx"), "utf-8");
  assert.strictEqual(card2.includes("Acme Advanced"), false, "GraphWide2 must not contain dummy 'Acme Advanced' label");
  assert.ok(card2.includes("Platform Commission"), "GraphWide2 must display Platform Commission");

  const card3 = fs.readFileSync(path.resolve(partialsDir, "GraphWide3.jsx"), "utf-8");
  assert.strictEqual(card3.includes("Acme Professional"), false, "GraphWide3 must not contain dummy 'Acme Professional'");
  assert.ok(card3.includes("Completed Orders"), "GraphWide3 must display Completed Orders");

  const pie = fs.readFileSync(path.resolve(partialsDir, "GraphWidePieChart.jsx"), "utf-8");
  assert.strictEqual(
    pie.includes('"United States", "Italy"'),
    false,
    "GraphWidePieChart must not contain hardcoded dummy countries"
  );
  assert.ok(pie.includes("Top Auction Categories"), "GraphWidePieChart must display Top Auction Categories");
});

test("Stage 7.42 — Client GraphQL Client & Operation Documents", () => {
  const gqlPath = path.resolve(clientRoot, "src/lib/graphqlClient.js");
  assert.ok(fs.existsSync(gqlPath), "graphqlClient.js must exist");
  const content = fs.readFileSync(gqlPath, "utf-8");

  assert.ok(content.includes("executeGraphQL"), "graphqlClient must export executeGraphQL function");
  assert.ok(content.includes("DASHBOARD_OVERVIEW_QUERY"), "graphqlClient must export DASHBOARD_OVERVIEW_QUERY");
  assert.ok(content.includes("ANALYTICS_OVERVIEW_QUERY"), "graphqlClient must export ANALYTICS_OVERVIEW_QUERY");
  assert.ok(content.includes("AUDIT_LOGS_QUERY"), "graphqlClient must export AUDIT_LOGS_QUERY");
});
