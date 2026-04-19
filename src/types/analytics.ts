export interface VisitorDataPoint {
  date: string
  visitors: number
}

export interface PageEntry {
  url: string
  count: number
}

export interface TrafficSource {
  source: string
  count: number
}

export interface PostHogData {
  uniqueVisitors7d: number
  pageviews7d: number
  inscriptions7d: number
  generations7d: number
  visitorsDaily: VisitorDataPoint[]
  topPages: PageEntry[]
  trafficSources: TrafficSource[]
  sessionsToday: number
  fetchedAt: string
}
