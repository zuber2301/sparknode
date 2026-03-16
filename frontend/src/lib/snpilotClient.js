/**
 * SNPilot Structured Intent Client
 * =================================
 * Maps user messages to /api/snpilot/... endpoints and formats responses
 * as readable chat text + structured payloads for rich card rendering.
 * Called by copilotContext before falling back to LLM.
 *
 * Each intent has:
 *   id       — slug used for usage-analytics logging
 *   patterns  — array of regex tested against the lowercased message
 *   fetch     — async fn that calls the snpilot endpoint
 *   format    — fn(data) → string shown alongside the card
 */

import { useAuthStore } from '../store/authStore'

const API_URL = import.meta.env.VITE_API_URL || ''

function authHeaders() {
  try {
    const state = useAuthStore.getState()
    const token = state.token
    const tenantId = state.getTenantId?.() || state.tenantContext?.tenant_id
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    if (tenantId && tenantId !== '00000000-0000-0000-0000-000000000000') {
      headers['X-Tenant-ID'] = tenantId
    }
    return headers
  } catch (err) {
    console.error('authHeaders error:', err)
    return { 'Content-Type': 'application/json' }
  }
}

async function snGet(path) {
  const res = await fetch(`${API_URL}/api${path}`, { headers: authHeaders() })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

async function snPost(path, body = {}) {
  const res = await fetch(`${API_URL}/api${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// ─── formatters ────────────────────────────────────────────────────────────

function fmtPts(n) {
  return Number(n).toLocaleString() + ' pts'
}

function fmtDate(iso) {
  if (!iso) return 'never'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatWalletExpiry(data) {
  const lines = [`💰 Your current balance: ${fmtPts(data.balance_points)}`]
  if (!data.expiring_blocks?.length) {
    lines.push('✅ No points scheduled to expire.')
  } else {
    lines.push('\n⏳ Upcoming expiries:')
    data.expiring_blocks.forEach(b => {
      lines.push(`  • ${fmtPts(b.points)} expire on ${b.expires_on}`)
    })
  }
  return lines.join('\n')
}

function formatCatalogOptions(data) {
  if (!data.items?.length) {
    return `😕 No catalog items found within ${data.points} pts. Try a higher amount.`
  }
  const lines = [`🛍 Items you can get with ${fmtPts(data.points)}:\n`]
  data.items.slice(0, 10).forEach(item => {
    lines.push(`• ${item.brand} — ${item.name} (${item.category}) from ${fmtPts(item.min_points)}`)
  })
  return lines.join('\n')
}

function formatRedemptions(data) {
  if (!Array.isArray(data) || !data.length) {
    return '🕓 No redemptions found in the last 6 months.'
  }
  const lines = [`🧾 Your last ${data.length} redemptions:\n`]
  data.forEach(r => {
    lines.push(`• ${fmtDate(r.redeemed_at)} — ${r.brand} · ${r.item} (${fmtPts(r.points_spent)}) · ${r.status}`)
  })
  return lines.join('\n')
}

function formatMyRecognitions(data) {
  const lines = []
  if (data.received?.length) {
    lines.push(`🏆 Recognitions received (last ${data.received.length}):\n`)
    data.received.forEach(r => {
      lines.push(`• From ${r.from} on ${fmtDate(r.created_at)} — ${fmtPts(r.points)}`)
      if (r.message) lines.push(`  "${r.message}"`)
    })
  } else {
    lines.push('😶 No recognitions received recently.')
  }
  if (data.given?.length) {
    lines.push(`\n🤝 Recognitions you gave (last ${data.given.length}):\n`)
    data.given.forEach(r => {
      lines.push(`• To ${r.to} on ${fmtDate(r.created_at)} — ${fmtPts(r.points)}`)
    })
  }
  return lines.join('\n')
}

function formatTopDepartments(data) {
  if (!data.departments?.length) return '📊 No department budget data available.'
  const lines = [`📊 Top ${data.count} departments by budget utilization (${data.period}):\n`]
  data.departments.forEach((d, i) => {
    const bar = '█'.repeat(Math.round(d.utilization_pct / 10)).padEnd(10, '░')
    lines.push(`${i + 1}. ${d.department}`)
    lines.push(`   ${bar} ${d.utilization_pct}% used — ${fmtPts(d.used_points)} of ${fmtPts(d.budget_points)}`)
  })
  return lines.join('\n')
}

function formatUnderutilized(data) {
  if (!data.departments?.length) {
    return `✅ All departments are using more than ${data.threshold_pct}% of their budget.`
  }
  const lines = [`⚠️ ${data.count} departments using less than ${data.threshold_pct}% of their budget (${data.period}):\n`]
  data.departments.forEach(d => {
    lines.push(`• ${d.department}: ${d.utilization_pct}% used — ${fmtPts(d.remaining_points)} remaining`)
  })
  return lines.join('\n')
}

function formatRecognitionGaps(data) {
  const lines = [
    `👤 ${data.count} of ${data.total_active_employees} employees haven't been recognised in the last ${data.days} days:\n`
  ]
  if (!data.employees?.length) return `✅ Everyone has been recognised in the last ${data.days} days!`
  data.employees.slice(0, 15).forEach(e => {
    const last = e.last_recognized_at ? `last: ${fmtDate(e.last_recognized_at)}` : 'never recognised'
    lines.push(`• ${e.name} (${e.department || '—'}) — ${last}`)
  })
  if (data.count > 15) lines.push(`  …and ${data.count - 15} more`)
  return lines.join('\n')
}

function formatTeamRecognition(data) {
  const lines = [
    `🎉 Team recognition summary (${data.period}):`,
    `  Given: ${data.given_count} | Received: ${data.received_count}\n`,
  ]
  if (data.by_member?.length) {
    lines.push('By member:')
    data.by_member.slice(0, 10).forEach(m => {
      lines.push(`  • ${m.name} — gave ${m.given}, received ${m.received}`)
    })
  }
  return lines.join('\n')
}

function formatTeamBudget(data) {
  return [
    `📋 Team budget (${data.period}):`,
    `  Total: ${fmtPts(data.total_points)}`,
    `  Used:  ${fmtPts(data.used_points)} (${data.utilization_pct}%)`,
    `  Left:  ${fmtPts(data.remaining_points)}`,
  ].join('\n')
}

function formatManagerGaps(data) {
  if (!data.gaps?.length) return `✅ Everyone on your team has been recognised in the last ${data.days} days!`
  const lines = [`👤 ${data.count} team member(s) without recognition in ${data.days} days:\n`]
  data.gaps.forEach(g => {
    const since = g.days_since_last != null ? `${g.days_since_last} days ago` : 'never'
    lines.push(`• ${g.name} — last recognised ${since}`)
  })
  return lines.join('\n')
}

function formatCatalogSummary(data) {
  const lines = [`🎁 ${data.enabled_items_count} reward items available.\n`]
  if (data.by_category?.length) {
    lines.push('By category:')
    data.by_category.forEach(c => lines.push(`  • ${c.category}: ${c.count} items`))
  }
  if (data.top_brands?.length) {
    lines.push(`\nTop brands: ${data.top_brands.join(', ')}`)
  }
  return lines.join('\n')
}
function formatSurveyCreated(data) {
  return [
    `✅ Pulse survey created: "${data.title}"`,
    data.target_department ? `Audience: ${data.target_department}` : 'Audience: Company-wide',
    `Closes: ${data.closes_at ? new Date(data.closes_at).toLocaleDateString('en-IN') : '—'}`,
    `${data.questions?.length || 0} question(s) sent to employees`,
  ].join('\n')
}

function formatSurveyResults(data) {
  if (!data.total_responses) {
    return `📊 No survey responses yet${data.title ? ` for "${data.title}"` : ''}.`
  }
  const lines = [`📊 Engagement results: "${data.title}"`, `${data.total_responses} response(s)`]
  if (data.engagement_score != null) {
    lines.push(`Engagement score: ${data.engagement_score.toFixed(1)} / 5`)
  }
  if (data.nps_score != null) {
    lines.push(`NPS: ${data.nps_score > 0 ? '+' : ''}${data.nps_score}`)
  }
  if (data.low_engagement_departments?.length) {
    lines.push(`\n⚠️ Low engagement (< 3.0):`)
    data.low_engagement_departments.slice(0, 3).forEach(d => {
      lines.push(`  • ${d.department}: ${d.engagement_score}/5`)
    })
  }
  return lines.join('\n')
}
// ─── intent map ────────────────────────────────────────────────────────────

const INTENTS = [
  // ── employee ─────────────────────────────────────────────────────────────
  {
    id: 'wallet-expiry',
    patterns: [
      /\bpoints?\s*balance\b/i,
      /\bhow\s+many\s+points\b/i,
      /\bmy\s+balance\b/i,
      /^what\s+is\s+my\s+points/i,
    ],
    fetch: () => snGet('/snpilot/me/wallet-expiry'),
    format: formatWalletExpiry,
  },
  {
    id: 'wallet-expiry',
    patterns: [
      /\bexpir/i,
      /\bwhen\s+are\s+my\s+points/i,
      /\bpoints.*expir/i,
    ],
    fetch: () => snGet('/snpilot/me/wallet-expiry'),
    format: formatWalletExpiry,
  },
  {
    id: 'catalog-options',
    patterns: [
      /\bbuy\s+with\s+(\d[\d,]*)\s*points?/i,
      /\bcan\s+i\s+buy\s+with/i,
      /\bcatalog.*(\d[\d,]*)\s*points?/i,
      /^what\s+can\s+i\s+(buy|get|redeem)/i,
    ],
    fetch: (msg) => {
      const m = msg.match(/(\d[\d,]+)/)
      const pts = m ? parseInt(m[1].replace(/,/g, ''), 10) : 500
      return snGet(`/snpilot/me/catalog-options?points=${pts}`)
    },
    format: formatCatalogOptions,
  },
  {
    id: 'redemptions',
    patterns: [
      /\bredemption(s)?\b/i,
      /\bwhat\s+.*redeem/i,
      /\bredeemed\b/i,
      /^show\s+my\s+(last|recent).*redemption/i,
    ],
    fetch: () => snGet('/snpilot/me/redemptions?months=6'),
    format: formatRedemptions,
  },
  {
    id: 'recognitions',
    patterns: [
      /\brecent\s+recogni/i,
      /^show\s+my\s+recent\s+recogni/i,
      /\bmy\s+(last|recent).*recogni/i,
    ],
    fetch: () => snGet('/snpilot/me/recognitions?limit=10'),
    format: formatMyRecognitions,
  },

  // ── manager ────────────────────────────────────────────────────────────────
  {
    id: 'team-budget',
    patterns: [
      /\bmy\s+team\s+budget\b/i,
      /\bteam\s+budget\b/i,
      /\bdepartment\s+budget\b/i,
      /\bhow\s+much\s+(budget|do\s+we\s+have)/i,
    ],
    fetch: (msg) => {
      const m = msg.match(/\b(month|quarter|year)\b/i)
      const period = m ? m[1].toLowerCase() : 'month'
      return snGet(`/snpilot/manager/team-budget?period=${period}`)
    },
    format: formatTeamBudget,
  },
  {
    id: 'manager-recognition-gaps',
    patterns: [
      /\bwho.*team.*recogni/i,
      /\bteam.*haven.t.*recogni/i,
      /\brecognition\s+gaps?\b.*team/i,
    ],
    fetch: (msg) => {
      const m = msg.match(/(\d+)\s*days?/i)
      const days = m ? parseInt(m[1], 10) : 30
      return snGet(`/snpilot/manager/recognition-gaps?days=${days}`)
    },
    format: formatManagerGaps,
  },

  // ── admin ─────────────────────────────────────────────────────────────────
  {
    id: 'top-departments',
    patterns: [
      /\btop\s+\d+\s+dep(artment)?/i,
      /\bdep(artment)?.*by\s+budget/i,
      /^top\s+\d+\s+dep/i,
    ],
    fetch: (msg) => {
      const m = msg.match(/\btop\s+(\d+)/i)
      const n = m ? parseInt(m[1], 10) : 5
      return snGet(`/snpilot/admin/budgets/top-departments?period=quarter&limit=${n}`)
    },
    format: formatTopDepartments,
  },
  {
    id: 'underutilized',
    patterns: [
      /\bunder.utiliz/i,
      /\bunused\s+budget/i,
      /\bbudget.*under.utiliz/i,
      /\blow\s+utiliz/i,
    ],
    fetch: () => snGet('/snpilot/admin/budgets/underutilized?period=quarter&threshold_pct=40'),
    format: formatUnderutilized,
  },
  {
    id: 'recognition-gaps',
    patterns: [
      /\bnot\s+been\s+recogni/i,
      /\bhaven.t\s+been\s+recogni/i,
      /\brecogni.*(\d+)\s*days?\b/i,
      /\brecognition\s+gaps?\b/i,
      /\bemployees.*recogni/i,
    ],
    fetch: (msg) => {
      const m = msg.match(/(\d+)\s*days?/i)
      const days = m ? parseInt(m[1], 10) : 60
      return snGet(`/snpilot/admin/recognition/gaps?days=${days}`)
    },
    format: formatRecognitionGaps,
  },
  {
    id: 'team-recognition',
    patterns: [
      /\bhow\s+many\s+recogni/i,
      /\brecogni.*last\s+\d+\s+days?/i,
      /\brecogni.*count/i,
      /\bteam\s+recogni/i,
    ],
    fetch: () => snGet('/snpilot/manager/team-recognition?period=month'),
    format: formatTeamRecognition,
  },
  {
    id: 'catalog-summary',
    patterns: [
      /\breward\s*(catalog|options|catalog).*compan/i,
      /\bwhat\s+rewards?\s+(are|do\s+we)/i,
      /\bcatalog.*enabled/i,
    ],
    fetch: () => snGet('/snpilot/admin/catalog/summary'),
    format: formatCatalogSummary,
  },

  // ── pulse surveys ────────────────────────────────────────────────────────
  {
    id: 'pulse-survey-create',
    patterns: [
      /run.*(?:engagement|pulse).*survey.*for\s+([\w][\w\s]*)/i,
      /create.*pulse.*survey/i,
      /send.*engagement.*survey/i,
      /launch.*(?:pulse|engagement).*survey/i,
    ],
    fetch: (msg) => {
      const m = msg.match(/for\s+([\w][\w\s]+?)(?:\s*$|\s*-|\s*with|\?)/i)
      const dept = m ? m[1].trim() : null
      return snPost('/surveys/create-pulse', {
        title: dept ? `${dept} Weekly Pulse` : 'Weekly Engagement Pulse',
        target_department: dept,
        nps_enabled: /nps/i.test(msg),
        closes_in_days: 7,
      })
    },
    format: formatSurveyCreated,
  },
  {
    id: 'pulse-survey-results',
    patterns: [
      /\bnps\b/i,
      /net.*promoter/i,
      /engagement.*score/i,
      /engagement.*result/i,
      /latest.*survey.*result/i,
      /survey.*result/i,
      /how.*engaged.*(?:team|company|employees)/i,
    ],
    fetch: () => snGet('/surveys/results'),
    format: formatSurveyResults,
  },
]

// ─── Intent catalog (used by IntentPanel in RightSideCopilot) ──────────────

/**
 * Structured intent catalog for the chip-based intent panel.
 * Each entry has the message template that `trySnpilotIntent` can match.
 */
export const INTENT_CATALOG = {
  employee: [
    {
      id: 'wallet-expiry',
      label: 'Points Balance & Expiry',
      emoji: '💰',
      msg: 'What is my points balance?',
    },
    {
      id: 'catalog-options',
      label: 'What Can I Buy?',
      emoji: '🛍',
      params: [{ key: 'points', label: 'My budget (pts)', type: 'number', default: 500, min: 50, step: 50 }],
      buildMsg: (p) => `What can I buy with ${p.points} points?`,
    },
    {
      id: 'redemptions',
      label: 'My Redemptions',
      emoji: '🧾',
      params: [
        { key: 'months', label: 'Last N months', type: 'select', options: ['3', '6', '12'], default: '6' },
      ],
      buildMsg: (p) => `Show my last redemptions from ${p.months} months`,
    },
    {
      id: 'recognitions',
      label: 'My Recognitions',
      emoji: '🏆',
      msg: 'Show my recent recognitions',
    },
  ],
  manager: [
    {
      id: 'team-budget',
      label: 'Team Budget',
      emoji: '📋',
      params: [
        { key: 'period', label: 'Period', type: 'select', options: ['month', 'quarter', 'year'], default: 'month' },
      ],
      buildMsg: (p) => `What is my team budget for ${p.period}?`,
    },
    {
      id: 'team-recognition',
      label: 'Team Recognition',
      emoji: '🎉',
      params: [
        { key: 'period', label: 'Period', type: 'select', options: ['month', 'quarter', 'year'], default: 'month' },
      ],
      buildMsg: (p) => `How many recognitions did my team give this ${p.period}?`,
    },
    {
      id: 'manager-recognition-gaps',
      label: 'Team Recognition Gaps',
      emoji: '👤',
      params: [
        { key: 'days', label: 'Days lookback', type: 'select', options: ['14', '30', '60', '90'], default: '30' },
      ],
      buildMsg: (p) => `Who on my team hasn't been recognised in ${p.days} days?`,
    },
  ],
  admin: [
    {
      id: 'top-departments',
      label: 'Top Departments',
      emoji: '📊',
      params: [
        { key: 'limit', label: 'Show top', type: 'select', options: ['3', '5', '10'], default: '5' },
        { key: 'period', label: 'Period', type: 'select', options: ['month', 'quarter', 'year'], default: 'quarter' },
      ],
      buildMsg: (p) => `Top ${p.limit} departments by budget utilization this ${p.period}`,
    },
    {
      id: 'underutilized',
      label: 'Underutilized Budgets',
      emoji: '⚠️',
      params: [
        { key: 'threshold', label: 'Below %', type: 'select', options: ['20', '40', '60'], default: '40' },
      ],
      buildMsg: (p) => `Which departments have under-utilised budgets below ${p.threshold}%?`,
    },
    {
      id: 'recognition-gaps',
      label: 'Recognition Gaps',
      emoji: '👥',
      params: [
        { key: 'days', label: 'Days lookback', type: 'select', options: ['30', '60', '90', '180'], default: '60' },
      ],
      buildMsg: (p) => `Which employees haven't been recognised in ${p.days} days?`,
    },
    {
      id: 'catalog-summary',
      label: 'Reward Catalog',
      emoji: '🎁',
      msg: 'What reward options are enabled in our company?',
    },
    {
      id: 'pulse-survey-create',
      label: 'Run Pulse Survey',
      emoji: '📋',
      params: [
        { key: 'department', label: 'Department (blank = all)', type: 'text', default: '' },
        { key: 'nps', label: 'Include NPS?', type: 'select', options: ['No', 'Yes'], default: 'No' },
      ],
      buildMsg: (p) =>
        `Run engagement survey for ${p.department?.trim() || 'all employees'}${p.nps === 'Yes' ? ' with NPS' : ''}`,
    },
    {
      id: 'pulse-survey-results',
      label: 'Engagement Results',
      emoji: '📊',
      msg: 'What are our latest engagement survey results?',
    },
  ],
}

// ─── fire-and-forget usage logging ─────────────────────────────────────────

export function logUsage(intentSlug, params = {}) {
  try {
    const { token, getTenantId, tenantContext } = useAuthStore.getState()
    const tenantId = getTenantId?.() || tenantContext?.tenant_id
    fetch(`${API_URL}/api/snpilot/usage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(tenantId && tenantId !== '00000000-0000-0000-0000-000000000000'
          ? { 'X-Tenant-ID': tenantId }
          : {}),
      },
      body: JSON.stringify({ intent_slug: intentSlug, params }),
    }).catch(() => {}) // intentionally silent — analytics must not disrupt UX
  } catch {
    // ignore
  }
}

// ─── public API ────────────────────────────────────────────────────────────

/**
 * Try to match `message` to a known snpilot intent.
 * Returns { text, payload, intentId } or null if no intent matched.
 */
export async function trySnpilotIntent(message) {
  const lower = message.toLowerCase()
  for (const intent of INTENTS) {
    if (intent.patterns.some(p => p.test(lower))) {
      try {
        const data = await intent.fetch(message)
        return {
          text: intent.format(data),
          payload: data,
          intentId: intent.id,
        }
      } catch (err) {
        if (err.message?.includes('403') || err.message?.toLowerCase().includes('required')) {
          return { text: `⛔ ${err.message}`, payload: null, intentId: intent.id }
        }
        throw err
      }
    }
  }
  return null // no intent matched — fall through to LLM
}

