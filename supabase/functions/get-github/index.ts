import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'

const OWNER = 'naou95'
const REPO = 'memovia-ia-notes'

async function ghFetch(path: string, token: string) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${path}`)
  return res.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult

  const token = Deno.env.get('GITHUB_TOKEN')
  if (!token) return errorResponse('github_not_configured', 500)

  try {
    const [repo, commitsRaw, issuesRaw, prsRaw, runsRaw] = await Promise.all([
      ghFetch(`/repos/${OWNER}/${REPO}`, token),
      ghFetch(`/repos/${OWNER}/${REPO}/commits?per_page=15`, token),
      ghFetch(`/repos/${OWNER}/${REPO}/issues?state=open&per_page=30`, token),
      ghFetch(`/repos/${OWNER}/${REPO}/pulls?state=open&per_page=20`, token),
      ghFetch(`/repos/${OWNER}/${REPO}/actions/runs?per_page=10`, token),
    ])

    // Issues only (GitHub API includes PRs in /issues)
    const issuesOnly = (issuesRaw as any[]).filter((i) => !i.pull_request)

    const commits = (commitsRaw as any[]).map((c) => ({
      sha: c.sha.slice(0, 7),
      message: c.commit.message.split('\n')[0],
      author: c.commit.author.name,
      date: c.commit.author.date,
      url: c.html_url,
    }))

    const issues = issuesOnly.map((i) => ({
      number: i.number,
      title: i.title,
      author: i.user.login,
      labels: (i.labels as any[]).map((l) => ({ name: l.name, color: l.color })),
      createdAt: i.created_at,
      url: i.html_url,
    }))

    const pullRequests = (prsRaw as any[]).map((p) => ({
      number: p.number,
      title: p.title,
      author: p.user.login,
      draft: p.draft,
      createdAt: p.created_at,
      url: p.html_url,
    }))

    const workflowRuns = ((runsRaw as any).workflow_runs as any[]).map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      conclusion: r.conclusion,
      branch: r.head_branch,
      createdAt: r.created_at,
      url: r.html_url,
    }))

    return Response.json(
      {
        stats: {
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          openIssues: issuesOnly.length,
          openPRs: (prsRaw as any[]).length,
          defaultBranch: repo.default_branch,
          language: repo.language,
          description: repo.description,
        },
        commits,
        issues,
        pullRequests,
        workflowRuns,
        fetchedAt: new Date().toISOString(),
      },
      { headers: corsHeaders },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return errorResponse(message, 502)
  }
})
