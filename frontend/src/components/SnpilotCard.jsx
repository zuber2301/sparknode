/**
 * SnpilotCard — rich structured renderer for SNPilot intent payloads.
 * Rendered inside the chat panel when message.payload is present.
 * Accepts intentId + data passed from copilotContext.
 */

function fmtPts(n) {
  return Number(n || 0).toLocaleString() + ' pts'
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function UtilBar({ pct, color = 'bg-indigo-500' }) {
  const w = Math.min(Math.max(Number(pct) || 0, 0), 100)
  return (
    <div className="w-full rounded-full bg-gray-800 h-2 overflow-hidden">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${w}%` }} />
    </div>
  )
}

function StatBadge({ label, value, sub }) {
  return (
    <div className="flex flex-col items-center bg-gray-800 rounded-lg px-3 py-2 min-w-[72px]">
      <span className="text-lg font-bold text-white leading-tight">{value}</span>
      <span className="text-[10px] text-gray-400 text-center leading-tight">{label}</span>
      {sub && <span className="text-[10px] text-indigo-400 leading-tight">{sub}</span>}
    </div>
  )
}

// ─── intent-specific renderers ─────────────────────────────────────────────

function WalletExpiryCard({ data }) {
  return (
    <div className="space-y-2 mt-1">
      <div className="flex items-center justify-between bg-indigo-900/40 rounded-lg px-3 py-2">
        <span className="text-xs text-gray-400">Current balance</span>
        <span className="text-base font-bold text-indigo-300">{fmtPts(data.balance_points)}</span>
      </div>
      {data.expiring_blocks?.length > 0 ? (
        <div>
          <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide mb-1">Upcoming expiries</p>
          <div className="space-y-1">
            {data.expiring_blocks.map((b, i) => (
              <div key={i} className="flex justify-between bg-amber-900/20 rounded px-2 py-1 text-xs">
                <span className="text-amber-300 font-medium">{fmtPts(b.points)}</span>
                <span className="text-gray-400">expires {b.expires_on}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-green-400">✓ No points expiring soon</p>
      )}
    </div>
  )
}

function CatalogOptionsCard({ data }) {
  if (!data.items?.length) return null
  return (
    <div className="mt-1 space-y-1 max-h-48 overflow-y-auto pr-1">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
        Items within {fmtPts(data.points)}
      </p>
      {data.items.map((item, i) => (
        <div key={i} className="flex items-center justify-between bg-gray-800 rounded px-2 py-1.5 text-xs gap-2">
          <div className="min-w-0">
            <p className="font-medium text-white truncate">{item.name}</p>
            <p className="text-gray-400">{item.brand}</p>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span className="text-indigo-300 font-semibold">{fmtPts(item.min_points)}</span>
            <span className="text-[10px] text-gray-500">{item.category}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function RedemptionsCard({ data }) {
  if (!Array.isArray(data) || !data.length) return null
  const statusColor = (s) => {
    if (!s) return 'text-gray-400'
    const sl = s.toLowerCase()
    if (sl === 'fulfilled' || sl === 'completed') return 'text-green-400'
    if (sl === 'pending') return 'text-amber-400'
    if (sl === 'failed' || sl === 'cancelled') return 'text-red-400'
    return 'text-gray-400'
  }
  return (
    <div className="mt-1 space-y-1 max-h-48 overflow-y-auto pr-1">
      {data.slice(0, 15).map((r, i) => (
        <div key={i} className="flex items-center justify-between bg-gray-800 rounded px-2 py-1.5 text-xs gap-2">
          <div className="min-w-0">
            <p className="font-medium text-white truncate">{r.brand} — {r.item}</p>
            <p className="text-gray-400">{fmtDate(r.redeemed_at)}</p>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span className="text-indigo-300 font-semibold">{fmtPts(r.points_spent)}</span>
            <span className={`text-[10px] ${statusColor(r.status)}`}>{r.status}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function RecognitionsCard({ data }) {
  return (
    <div className="mt-1 space-y-2">
      {data.received?.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wide mb-1">Received</p>
          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
            {data.received.map((r, i) => (
              <div key={i} className="bg-gray-800 rounded px-2 py-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-white font-medium">From {r.from}</span>
                  <span className="text-indigo-300">{fmtPts(r.points)}</span>
                </div>
                {r.message && <p className="text-gray-400 italic mt-0.5 truncate">"{r.message}"</p>}
                <p className="text-gray-500 text-[10px]">{fmtDate(r.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.given?.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide mb-1">Given</p>
          <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
            {data.given.map((r, i) => (
              <div key={i} className="flex justify-between bg-gray-800 rounded px-2 py-1.5 text-xs">
                <span className="text-white">To {r.to}</span>
                <span className="text-emerald-300">{fmtPts(r.points)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TopDepartmentsCard({ data }) {
  if (!data.departments?.length) return null
  return (
    <div className="mt-1 space-y-2">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
        Top {data.count} · {data.period}
      </p>
      {data.departments.map((d, i) => (
        <div key={i} className="space-y-0.5">
          <div className="flex justify-between text-xs">
            <span className="text-white font-medium truncate mr-2">{i + 1}. {d.department}</span>
            <span className="text-indigo-300 shrink-0">{d.utilization_pct}%</span>
          </div>
          <UtilBar pct={d.utilization_pct} color={d.utilization_pct >= 80 ? 'bg-green-500' : d.utilization_pct >= 40 ? 'bg-indigo-500' : 'bg-amber-500'} />
          <p className="text-[10px] text-gray-500">{fmtPts(d.used_points)} / {fmtPts(d.budget_points)}</p>
        </div>
      ))}
    </div>
  )
}

function UnderutilizedCard({ data }) {
  if (!data.departments?.length) return (
    <p className="text-xs text-green-400 mt-1">✓ All departments above {data.threshold_pct}% utilization</p>
  )
  return (
    <div className="mt-1 space-y-2">
      <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide">
        Below {data.threshold_pct}% · {data.period}
      </p>
      {data.departments.map((d, i) => (
        <div key={i} className="space-y-0.5">
          <div className="flex justify-between text-xs">
            <span className="text-white truncate mr-2">{d.department}</span>
            <span className="text-amber-300 shrink-0">{d.utilization_pct}%</span>
          </div>
          <UtilBar pct={d.utilization_pct} color="bg-amber-500" />
          <p className="text-[10px] text-gray-500">{fmtPts(d.remaining_points)} remaining</p>
        </div>
      ))}
    </div>
  )
}

function RecognitionGapsCard({ data }) {
  if (!data.employees?.length) return (
    <p className="text-xs text-green-400 mt-1">✓ Everyone recognised in the last {data.days} days</p>
  )
  return (
    <div className="mt-1 space-y-1">
      <div className="flex justify-between text-[10px] text-gray-400 mb-1">
        <span className="uppercase tracking-wide font-semibold">
          {data.count} of {data.total_active_employees} employees · {data.days} days
        </span>
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
        {data.employees.slice(0, 20).map((e, i) => {
          const lastSeen = e.last_recognized_at
            ? fmtDate(e.last_recognized_at)
            : 'never'
          return (
            <div key={i} className="flex items-center justify-between bg-gray-800 rounded px-2 py-1.5 text-xs gap-2">
              <div className="min-w-0">
                <p className="font-medium text-white truncate">{e.name}</p>
                <p className="text-gray-400 text-[10px]">{e.department || '—'}</p>
              </div>
              <span className={`text-[10px] shrink-0 ${e.last_recognized_at ? 'text-amber-300' : 'text-red-400'}`}>
                {lastSeen}
              </span>
            </div>
          )
        })}
        {data.count > 20 && (
          <p className="text-[10px] text-gray-500 text-center">+{data.count - 20} more</p>
        )}
      </div>
    </div>
  )
}

function TeamRecognitionCard({ data }) {
  return (
    <div className="mt-1 space-y-2">
      <div className="flex gap-2">
        <StatBadge label="Given" value={data.given_count ?? 0} />
        <StatBadge label="Received" value={data.received_count ?? 0} />
        <StatBadge label="Period" value={data.period ?? '—'} />
      </div>
      {data.by_member?.length > 0 && (
        <div className="max-h-40 overflow-y-auto pr-1 space-y-1 mt-1">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">By member</p>
          {data.by_member.slice(0, 10).map((m, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-800 rounded px-2 py-1.5 text-xs gap-2">
              <span className="text-white font-medium truncate">{m.name}</span>
              <span className="text-gray-400 shrink-0">↑ {m.given} ↓ {m.received}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TeamBudgetCard({ data }) {
  const pct = Number(data.utilization_pct) || 0
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#6366f1' : '#f59e0b'
  return (
    <div className="mt-1 space-y-2">
      <div className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
        <div>
          <p className="text-[10px] text-gray-400">Utilization</p>
          <p className="text-2xl font-bold" style={{ color }}>{pct}%</p>
        </div>
        <div className="text-right space-y-0.5">
          <p className="text-xs text-gray-400">Total: <span className="text-white">{fmtPts(data.total_points)}</span></p>
          <p className="text-xs text-gray-400">Used: <span className="text-indigo-300">{fmtPts(data.used_points)}</span></p>
          <p className="text-xs text-gray-400">Left: <span className="text-green-400">{fmtPts(data.remaining_points)}</span></p>
        </div>
      </div>
      <UtilBar pct={pct} color={pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-indigo-500' : 'bg-amber-500'} />
    </div>
  )
}

function ManagerGapsCard({ data }) {
  if (!data.gaps?.length) return (
    <p className="text-xs text-green-400 mt-1">✓ All team members recognised in the last {data.days} days</p>
  )
  return (
    <div className="mt-1 space-y-1">
      <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide mb-1">
        {data.count} member(s) · {data.days} days
      </p>
      {data.gaps.slice(0, 10).map((g, i) => (
        <div key={i} className="flex items-center justify-between bg-gray-800 rounded px-2 py-1.5 text-xs gap-2">
          <span className="text-white font-medium truncate">{g.name}</span>
          <span className={`shrink-0 text-[10px] ${g.days_since_last != null ? 'text-amber-300' : 'text-red-400'}`}>
            {g.days_since_last != null ? `${g.days_since_last}d ago` : 'never'}
          </span>
        </div>
      ))}
    </div>
  )
}

function CatalogSummaryCard({ data }) {
  return (
    <div className="mt-1 space-y-1">
      <div className="flex items-center justify-between bg-indigo-900/40 rounded-lg px-3 py-2">
        <span className="text-xs text-gray-400">Total active rewards</span>
        <span className="text-base font-bold text-indigo-300">{data.enabled_items_count ?? 0}</span>
      </div>
      {data.by_category?.length > 0 && (
        <div className="space-y-1 pt-1">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">By category</p>
          {data.by_category.map((c, i) => (
            <div key={i} className="flex justify-between bg-gray-800 rounded px-2 py-1 text-xs">
              <span className="text-white">{c.category}</span>
              <span className="text-indigo-300">{c.count}</span>
            </div>
          ))}
        </div>
      )}
      {data.top_brands?.length > 0 && (
        <p className="text-[10px] text-gray-400 pt-1">
          Top brands: {data.top_brands.join(', ')}
        </p>
      )}
    </div>
  )
}

function PulseSurveyCreatedCard({ data }) {
  return (
    <div className="mt-1 space-y-1.5">
      <div className="flex items-center justify-between bg-green-900/30 rounded-lg px-3 py-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white truncate">{data.title}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {data.target_department ? `Audience: ${data.target_department}` : 'Company-wide'}
          </p>
        </div>
        <span className="text-[10px] bg-green-600 text-white rounded px-1.5 py-0.5 shrink-0 ml-2">Active</span>
      </div>
      {data.closes_at && (
        <p className="text-[10px] text-gray-400">
          Closes: {new Date(data.closes_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}
      {data.questions?.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Questions</p>
          {data.questions.map((q, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs">
              <span className="text-gray-500 mt-0.5 shrink-0">{i + 1}.</span>
              <span className="text-gray-300">{q.text}</span>
              <span className="text-[10px] text-indigo-400 shrink-0 mt-0.5">{q.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PulseSurveyResultsCard({ data }) {
  if (!data.total_responses) {
    return <p className="text-xs text-gray-400 mt-1">No responses yet for this survey.</p>
  }
  const engColor = (s) => {
    if (!s) return 'text-gray-400'
    if (s >= 4) return 'text-green-400'
    if (s >= 3) return 'text-amber-400'
    return 'text-red-400'
  }
  const npsColor = (n) => {
    if (n == null) return 'text-gray-400'
    if (n >= 50) return 'text-green-400'
    if (n >= 0) return 'text-amber-400'
    return 'text-red-400'
  }
  return (
    <div className="mt-1 space-y-2">
      {/* Headline stats */}
      <div className="flex gap-2">
        <StatBadge label="Responses" value={data.total_responses} />
        {data.engagement_score != null && (
          <div className="flex flex-col items-center bg-gray-800 rounded-lg px-3 py-2 min-w-[72px]">
            <span className={`text-lg font-bold leading-tight ${engColor(data.engagement_score)}`}>
              {data.engagement_score.toFixed(1)}/5
            </span>
            <span className="text-[10px] text-gray-400 text-center">Engagement</span>
          </div>
        )}
        {data.nps_score != null && (
          <div className="flex flex-col items-center bg-gray-800 rounded-lg px-3 py-2 min-w-[72px]">
            <span className={`text-lg font-bold leading-tight ${npsColor(data.nps_score)}`}>
              {data.nps_score > 0 ? '+' : ''}{data.nps_score}
            </span>
            <span className="text-[10px] text-gray-400 text-center">NPS</span>
          </div>
        )}
      </div>

      {/* Department breakdown */}
      {data.by_department?.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">By department</p>
          <div className="space-y-1">
            {data.by_department.slice(0, 6).map((d, i) => (
              <div key={i} className="space-y-0.5">
                <div className="flex justify-between text-xs">
                  <span className="text-white truncate mr-2">{d.department}</span>
                  <span className={`shrink-0 ${engColor(d.engagement_score)}`}>
                    {d.engagement_score?.toFixed(1) ?? '—'}/5
                  </span>
                </div>
                <UtilBar
                  pct={(d.engagement_score || 0) * 20}
                  color={
                    d.engagement_score >= 4 ? 'bg-green-500' :
                    d.engagement_score >= 3 ? 'bg-amber-500' : 'bg-red-500'
                  }
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Low engagement alert */}
      {data.low_engagement_departments?.length > 0 && (
        <div className="bg-red-900/20 rounded border border-red-800/40 px-2 py-1.5">
          <p className="text-[10px] font-semibold text-red-400 mb-0.5">⚠️ Low engagement teams</p>
          {data.low_engagement_departments.map((d, i) => (
            <p key={i} className="text-[10px] text-gray-300">
              {d.department}: {d.engagement_score?.toFixed(1)}/5 ({d.respondents} resp.)
            </p>
          ))}
        </div>
      )}

      {/* Sample comments */}
      {data.recent_comments?.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Sample comments</p>
          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
            {data.recent_comments.slice(0, 5).map((c, i) => (
              <p key={i} className="text-[10px] text-gray-300 italic bg-gray-800 rounded px-2 py-1">
                "{c}"
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── router ────────────────────────────────────────────────────────────────

const RENDERERS = {
  'wallet-expiry': WalletExpiryCard,
  'catalog-options': CatalogOptionsCard,
  'redemptions': RedemptionsCard,
  'recognitions': RecognitionsCard,
  'top-departments': TopDepartmentsCard,
  'underutilized': UnderutilizedCard,
  'recognition-gaps': RecognitionGapsCard,
  'team-recognition': TeamRecognitionCard,
  'team-budget': TeamBudgetCard,
  'manager-recognition-gaps': ManagerGapsCard,
  'catalog-summary': CatalogSummaryCard,
  'pulse-survey-create': PulseSurveyCreatedCard,
  'pulse-survey-results': PulseSurveyResultsCard,
}

export default function SnpilotCard({ intentId, data }) {
  if (!intentId || !data) return null
  const Renderer = RENDERERS[intentId]
  if (!Renderer) return null
  return (
    <div className="mt-1.5 rounded-lg border border-gray-700 bg-gray-900/60 p-2 text-xs">
      <Renderer data={data} />
    </div>
  )
}
