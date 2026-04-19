export interface VisitorDataPoint {
  date: string
  visitors: number
}

export interface DayCount {
  date: string
  count: number
}

export interface PageEntry {
  url: string
  count: number
}

export interface TrafficSource {
  source: string
  count: number
}

// Response from get-posthog?host=app.memovia.io
export interface PostHogAppData {
  uniqueVisitors7d: number
  pageviews7d: number
  inscriptions7d: number  // always 0 (comes from Supabase now)
  generations7d: number   // always 0 (comes from Supabase now)
  visitorsDaily: VisitorDataPoint[]
  topPages: PageEntry[]
  trafficSources: TrafficSource[]
  sessionsToday: number
  fetchedAt: string
}

// Response from get-posthog?host=memovia.io
export interface PostHogWebData {
  uniqueVisitors7d: number
  pageviews7d: number
  visitorsDaily: VisitorDataPoint[]
  topPages: PageEntry[]
  trafficSources: TrafficSource[]
  events: {
    demo_demandee: number
    tarifs_vus: number
    article_lu: number
  }
  fetchedAt: string
}

// Response from get-analytics-supabase
export interface SupabaseAnalyticsData {
  inscriptions: {
    total7d: number
    byDay: DayCount[]
  }
  generations: {
    total7d: number
    byDay: DayCount[]
  }
  fetchedAt: string
}
