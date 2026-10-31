const { buildSchema } = require("graphql");

/**
 * AuctionX Selective Administrative GraphQL Schema — Stage 7.42
 * Provides composite read queries for administrative dashboard overview,
 * real-data analytics, and unified audit trail exploration.
 */
const schema = buildSchema(`
  scalar DateTime
  scalar JSON

  enum ActorType {
    admin
    user
    seller
    system
    integration
  }

  enum AuditOutcome {
    SUCCESS
    FAILED
    DENIED
    PENDING
    ROLLED_BACK
    RECONCILIATION_REQUIRED
  }

  type UserMetrics {
    total: Int!
    regularUsers: Int!
    sellers: Int!
    verified: Int!
  }

  type AuctionMetrics {
    total: Int!
    active: Int!
    upcoming: Int!
    ended: Int!
  }

  type ModerationMetrics {
    pendingReports: Int!
    pendingSellerApprovals: Int!
    productModerationModelled: Boolean!
    notes: String
  }

  type OrderMetrics {
    total: Int!
    settled: Int!
  }

  type ActivityItem {
    id: ID!
    type: String!
    title: String!
    actor: String
    status: String
    timestamp: String
  }

  type DashboardOverview {
    users: UserMetrics!
    auctions: AuctionMetrics!
    moderation: ModerationMetrics!
    bids: Int!
    orders: OrderMetrics!
    recentActivity: [ActivityItem!]!
    generatedAt: String!
  }

  type RevenueTimeSeriesPoint {
    key: String!
    label: String!
    grossSales: Float!
    netSales: Float!
    platformFee: Float!
    orderCount: Int!
    refundedAmount: Float!
    refundCount: Int!
  }

  type RevenueTimeSeries {
    labels: [String!]!
    grossSales: [Float!]!
    netSales: [Float!]!
    platformFees: [Float!]!
    orderCounts: [Int!]!
    series: [RevenueTimeSeriesPoint!]!
  }

  type CategoryItem {
    category: String!
    itemCount: Int!
    avgStartingPrice: Float!
    totalBids: Int!
    totalRevenue: Float!
    orderCount: Int!
  }

  type CategoryBreakdown {
    labels: [String!]!
    counts: [Int!]!
    revenues: [Float!]!
    items: [CategoryItem!]!
  }

  type AuctionHealth {
    totalAuctions: Int!
    activeAuctions: Int!
    upcomingAuctions: Int!
    completedAuctions: Int!
    unsoldOrCancelled: Int!
    completionRate: Int!
    avgStartingPrice: Float!
    avgCurrentPrice: Float!
    totalBids: Int!
  }

  type UserGrowthPoint {
    key: String!
    label: String!
    users: Int!
    sellers: Int!
  }

  type UserGrowth {
    labels: [String!]!
    users: [Int!]!
    sellers: [Int!]!
    items: [UserGrowthPoint!]!
  }

  type DisputeReasonItem {
    type: String!
    label: String!
    count: Int!
  }

  type DisputeReasonBreakdown {
    labels: [String!]!
    counts: [Int!]!
    items: [DisputeReasonItem!]!
  }

  type FinancialFlows {
    deposits: Float!
    withdrawals: Float!
    netFlow: Float!
    depositCount: Int!
    withdrawalCount: Int!
  }

  type AnalyticsSummary {
    totalGrossRevenue: Float!
    totalPlatformCommission: Float!
    totalOrdersCompleted: Int!
    totalAuctions: Int!
    activeAuctions: Int!
    completionRate: Int!
    netFlow: Float!
  }

  type AnalyticsOverview {
    summary: AnalyticsSummary!
    revenueTimeSeries: RevenueTimeSeries!
    categoryDistribution: CategoryBreakdown!
    auctionHealth: AuctionHealth!
    userGrowth: UserGrowth!
    disputeReasons: DisputeReasonBreakdown!
    financialFlows: FinancialFlows!
    generatedAt: String!
  }

  type AuditLogItem {
    id: ID!
    actorType: String!
    actorId: String
    actorEmail: String
    actorName: String
    actorRole: String
    resourceType: String
    resourceId: String
    targetAccountEmail: String
    action: String!
    category: String!
    outcome: String!
    failureReason: String
    reason: String
    beforeStatus: String
    afterStatus: String
    beforeState: JSON
    afterState: JSON
    changedFields: [String!]
    correlationId: String
    ipAddress: String
    userAgent: String
    metadata: JSON
    createdAt: String!
    completedAt: String
  }

  type AuditLogConnection {
    events: [AuditLogItem!]!
    totalCount: Int!
    page: Int!
    totalPages: Int!
    hasNextPage: Boolean!
    hasPrevPage: Boolean!
  }

  type AuditSummary {
    totalEventsLast24h: Int!
    outcomes: JSON!
    recentFailures: [AuditLogItem!]!
  }

  input AuditLogFilterInput {
    actorType: String
    actorId: String
    actorEmail: String
    action: String
    category: String
    outcome: String
    resourceType: String
    resourceId: String
    correlationId: String
    search: String
    startDate: String
    endDate: String
    sortBy: String
    sortOrder: String
  }

  type Query {
    """
    Composite overview for admin dashboard cards, health status, and live feeds.
    """
    dashboardOverview: DashboardOverview!

    """
    Real-data analytics aggregating revenue, categories, auctions, and growth.
    """
    analyticsOverview(months: Int): AnalyticsOverview!

    """
    Paginated, multi-filter unified audit log search for administrators.
    """
    auditLogs(filter: AuditLogFilterInput, page: Int, limit: Int): AuditLogConnection!

    """
    Detailed audit log event lookup by identifier.
    """
    auditLog(id: ID!): AuditLogItem

    """
    Summary of recent audit events, status distributions, and failures.
    """
    auditSummary: AuditSummary!
  }
`);

module.exports = schema;
