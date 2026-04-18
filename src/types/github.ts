export interface GitHubLabel {
  name: string
  color: string
}

export interface GitHubCommit {
  sha: string
  message: string
  author: string
  date: string
  url: string
}

export interface GitHubIssue {
  number: number
  title: string
  author: string
  labels: GitHubLabel[]
  createdAt: string
  url: string
}

export interface GitHubPR {
  number: number
  title: string
  author: string
  draft: boolean
  createdAt: string
  url: string
}

export interface GitHubWorkflowRun {
  id: number
  name: string
  status: 'completed' | 'in_progress' | 'queued' | 'waiting'
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null
  branch: string
  createdAt: string
  url: string
}

export interface GitHubStats {
  stars: number
  forks: number
  openIssues: number
  openPRs: number
  defaultBranch: string
  language: string | null
  description: string | null
}

export interface GitHubData {
  stats: GitHubStats
  commits: GitHubCommit[]
  issues: GitHubIssue[]
  pullRequests: GitHubPR[]
  workflowRuns: GitHubWorkflowRun[]
  fetchedAt: string
}
