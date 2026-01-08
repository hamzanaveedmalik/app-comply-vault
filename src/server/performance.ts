/**
 * Performance optimization utilities
 * Implements caching, query optimization, and performance monitoring
 */

/**
 * Cache configuration
 */
export const CACHE_CONFIG = {
  // Cache TTL in seconds
  MEETING_LIST: 30, // 30 seconds for meeting lists
  MEETING_DETAIL: 60, // 1 minute for meeting details
  METRICS: 60, // 1 minute for dashboard metrics
  SEARCH: 10, // 10 seconds for search results
} as const;

/**
 * Query optimization helpers
 */
export const QueryOptimizations = {
  /**
   * Select only necessary fields for meeting list views
   */
  meetingListFields: {
    id: true,
    clientName: true,
    meetingType: true,
    meetingDate: true,
    status: true,
    createdAt: true,
    readyForCCO: true,
  },

  /**
   * Select only necessary fields for search results
   */
  searchResultFields: {
    id: true,
    clientName: true,
    meetingType: true,
    meetingDate: true,
    status: true,
    searchableText: true,
  },

  /**
   * Pagination defaults
   */
  pagination: {
    defaultPageSize: 50,
    maxPageSize: 100,
  },
} as const;

/**
 * Performance monitoring
 */
export function measurePerformance<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  return fn().then((result) => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`⚠️ Slow operation: ${label} took ${duration}ms`);
    } else {
      console.log(`✅ ${label} completed in ${duration}ms`);
    }
    return result;
  });
}

/**
 * Debounce helper for search queries
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

