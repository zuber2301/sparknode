/**
 * SNPilot Structured Intent Client
 * =================================
 * Maps user messages to /api/snpilot/... endpoints and formats responses
 * as readable chat text. Called by copilotContext before falling back to LLM.
 *
 * Each intent has:
 *   patterns  — array of regex tested against the lowercased message
 *   fetch     — async fn that calls the snpilot endpoint
 *   format    — fn(data) → string shown in the chat bubble
 */

const API_URL = import.meta.env.VITE_API_URL || ''

function authHeaders() {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

// ─── intent map ────────────────────────────────────────────────────────────

const INTENTS = [
  // ── employee ─────────────────────────────────────────────────────────────
  {
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
    patterns: [
      /\bexpir/i,
      /\bwhen\s+are\s+my\s+points/i,
      /\bpoints.*expir/i,
    ],
    fetch: () => snGet('/snpilot/me/wallet-expiry'),
    format: formatWalletExpiry,
  },
  {
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
    patterns: [
      /\brecent\s+recogni/i,
      /^show\s+my\s+recent\s+recogni/i,
      /\bmy\s+(last|recent).*recogni/i,
    ],
    fetch: () => snGet('/snpilot/me/recognitions?limit=10'),
    format: formatMyRecognitions,
  },

  // ── manager / admin ───────────────────────────────────────────────────────
  {
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
    patterns: [
      /\bhow\s+many\s+recogni/i,
      /\brecogni.*last\s+\d+\s+days?/i,
      /\brecogni.*count/i,
      /\bteam\s+recogni/i,
    ],
    fetch: () => snGet('/snpilot/manager/team-recognition?period=month'),
    format: formatTeamRecognition,
  },
]

// ─── public API ────────────────────────────────────────────────────────────

/**
 * Try to match `message` to a known snpilot intent.
 * Returns a formatted string response, or null if no intent matched.
 */
export async function trySnpilotIntent(message) {
  const lower = message.toLowerCase()
  for (const intent of INTENTS) {
    if (intent.patterns.some(p => p.test(lower))) {
      try {
        const data = await intent.fetch(message)
        return intent.format(data)
      } catch (err) {
        // If the endpoint returns 403 (role guard), surface a helpful message
        if (err.message?.includes('403') || err.message?.toLowerCase().includes('required')) {
          return `⛔ ${err.message}`
        }
        throw err
      }
    }
  }
  return null // no intent matched — fall through to LLM
}
