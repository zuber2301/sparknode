import { useQuery } from '@tanstack/react-query'
import { salesAPI } from '../lib/api'

export default function SalesLeaderboard({ eventId }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['salesEventLeaderboard', eventId],
    queryFn: () => salesAPI.leaderboard(eventId).then(r => r.data),
    enabled: !!eventId,
  })

  if (isLoading) return <div>Loading leaderboard…</div>
  if (data.length === 0) return <div>No progress yet</div>

  return (
    <div className="space-y-2">
      {data.map((row, idx) => (
        <div key={idx} className="flex items-center gap-3 p-2 bg-white rounded shadow-sm">
          {/* avatar */}
          <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
            {row.avatar_url ? <img src={row.avatar_url} alt="avatar" className="w-full h-full object-cover" /> : <span className="text-xs text-gray-500 flex items-center justify-center">?</span>}
          </div>
          {/* name and progress */}
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900">{row.user_name || row.user_id}</div>
            <div className="relative h-2 bg-gray-200 rounded">
              <div className="absolute top-0 left-0 h-2 bg-sparknode-purple rounded" style={{ width: `${row.progress_pct || 0}%` }} />
            </div>
          </div>
          {/* value and reward */}
          <div className="text-right text-sm flex flex-col items-end">
            <div>{row.current_value}</div>
            <div>{row.is_rewarded ? '🎉' : ''}</div>
            {idx < 3 && (
              <div className="text-xs text-yellow-500">🔥</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
