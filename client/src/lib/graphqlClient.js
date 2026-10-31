import axiosWithAuth from "../redux/slices/axiosWithAuth";

/**
 * Lightweight, Operation-Specific Administrative GraphQL Client — Stage 7.42
 * Authenticated via session cookies and protected by CSRF validation.
 */
export async function executeGraphQL({ query, variables = {}, operationName = null }) {
  try {
    const response = await axiosWithAuth.post("/graphql", {
      query,
      variables,
      operationName,
    });

    if (response.data.errors && response.data.errors.length > 0) {
      const errorMsg = response.data.errors.map((e) => e.message).join("; ");
      throw new Error(errorMsg);
    }

    return response.data.data;
  } catch (error) {
    console.warn("GraphQL execution fallback:", error.response?.data?.message || error.message);
    throw error;
  }
}

/**
 * Pre-compiled composite queries for administrative workflows
 */
export const DASHBOARD_OVERVIEW_QUERY = `
  query GetDashboardOverview {
    dashboardOverview {
      users {
        total
        regularUsers
        sellers
        verified
      }
      auctions {
        total
        active
        upcoming
        ended
      }
      moderation {
        pendingReports
        pendingSellerApprovals
        productModerationModelled
        notes
      }
      bids
      orders {
        total
        settled
      }
      recentActivity {
        id
        type
        title
        actor
        status
        timestamp
      }
      generatedAt
    }
  }
`;

export const ANALYTICS_OVERVIEW_QUERY = `
  query GetAnalyticsOverview($months: Int) {
    analyticsOverview(months: $months) {
      summary {
        totalGrossRevenue
        totalPlatformCommission
        totalOrdersCompleted
        totalAuctions
        activeAuctions
        completionRate
        netFlow
      }
      revenueTimeSeries {
        labels
        grossSales
        netSales
        platformFees
        orderCounts
        series {
          key
          label
          grossSales
          netSales
          platformFee
          orderCount
        }
      }
      categoryDistribution {
        labels
        counts
        revenues
        items {
          category
          itemCount
          totalRevenue
        }
      }
      auctionHealth {
        totalAuctions
        activeAuctions
        upcomingAuctions
        completedAuctions
        unsoldOrCancelled
        completionRate
        avgStartingPrice
        avgCurrentPrice
        totalBids
      }
      userGrowth {
        labels
        users
        sellers
      }
      disputeReasons {
        labels
        counts
      }
      financialFlows {
        deposits
        withdrawals
        netFlow
      }
      generatedAt
    }
  }
`;

export const AUDIT_LOGS_QUERY = `
  query GetAuditLogs($filter: AuditLogFilterInput, $page: Int, $limit: Int) {
    auditLogs(filter: $filter, page: $page, limit: $limit) {
      totalCount
      page
      totalPages
      hasNextPage
      hasPrevPage
      events {
        id
        actorType
        actorId
        actorEmail
        actorRole
        resourceType
        resourceId
        action
        category
        outcome
        reason
        beforeStatus
        afterStatus
        ipAddress
        createdAt
      }
    }
  }
`;
