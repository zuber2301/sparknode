import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { salesAPI, tenantsAPI } from '../lib/api'
import SalesLeaderboard from '../components/SalesLeaderboard'
import Countdown from '../components/Countdown'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'

export default function SalesEvents() {
  const { tenantContext, user: current_user } = useAuthStore()
  const qc = useQueryClient()

  // ALL hooks must come before any early returns (Rules of Hooks)
  const isPlatformUser = current_user?.org_role === 'platform_admin'

  // Fetch fresh tenant to get up-to-date feature flags
  const { data: currentTenantResponse } = useQuery({
    queryKey: ['currentTenant'],
    queryFn: () => tenantsAPI.getCurrent(),
    enabled: !isPlatformUser,
    staleTime: 30 * 1000,
  })

  const { data: eventsResponse, isLoading } = useQuery({
    queryKey: ['salesEvents'],
    queryFn: () => salesAPI.list().then(r => r.data),
  })

  const [showCreate, setShowCreate] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [wizardData, setWizardData] = useState({})

  const createMutation = useMutation({
    mutationFn: (payload) => salesAPI.create(payload).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salesEvents'] }); setShowCreate(false); toast.success('Sales event created') },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to create event'),
  })

  // Use fresh API data; fall back to persisted tenantContext
  const featureFlags = currentTenantResponse?.data?.feature_flags || tenantContext?.feature_flags || {}
  const salesEnabled = !!(featureFlags.sales_marketing || featureFlags.sales_marketing_enabled || featureFlags.sales_marketting_enabled)

  if (!salesEnabled && !isLoading) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-yellow-800">Feature Not Available</h3>
          <p className="text-yellow-700">Sales & Marketing module is not enabled for your organization.</p>
        </div>
      </div>
    )
  }

  const handleWizardNext = (stepData) => {
    setWizardData({ ...wizardData, ...stepData })
    setWizardStep(wizardStep + 1)
  }

  const handleWizardPrev = () => {
    setWizardStep(wizardStep - 1)
  }

  const finalizeCreate = () => {
    // collect invites from DOM if present
    const invites = []
    const invUsers = document.querySelectorAll('select[name="invited_user_ids"] option:checked')
    const invDepts = document.querySelectorAll('select[name="invited_dept_ids"] option:checked')
    const users = Array.from(invUsers).map(o => o.value)
    const depts = Array.from(invDepts).map(o => o.value)
    const payload = { ...wizardData }
    if (users.length) payload.invited_user_ids = users
    if (depts.length) payload.invited_dept_ids = depts
    createMutation.mutate(payload)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Sales Events</h2>
        <div>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>Create Sales Event</button>
        </div>
      </div>

      <div className="bg-white rounded-md shadow p-4">
        {/* campaign manager stats display */}
        {(current_user?.org_role === 'tenant_manager' || current_user?.org_role === 'dept_lead' || eventsResponse?.[0]?.marketing_owner_id === current_user?.id) &&
         eventsResponse && eventsResponse.length > 0 && eventsResponse[0].total_budget_cap && (
          <div className="mb-4 p-4 bg-green-50 rounded">
            <p className="font-medium">Campaign burn rate for: {eventsResponse[0].name}</p>
            {(() => {
              const ev = eventsResponse[0]
              const totalTime = new Date(ev.end_at) - new Date(ev.start_at)
              const elapsed = new Date() - new Date(ev.start_at)
              const timePct = Math.min(100, Math.max(0, elapsed / totalTime * 100))
              const budgetPct = (ev.distributed_so_far || 0) / ev.total_budget_cap * 100
              const burnRate = timePct ? (budgetPct / timePct * 100).toFixed(1) : '0'
              return (
                <>
                  <p className="text-sm">Budget used: {budgetPct.toFixed(1)}%</p>
                  <p className="text-sm">Time elapsed: {timePct.toFixed(1)}%</p>
                  <p className="text-sm font-semibold">Burn rate: {burnRate}% per elapsed %</p>
                </>
              )
            })()}
          </div>
        )}
        {/* live contest preview for first active event */}
        {eventsResponse && eventsResponse.length > 0 && eventsResponse[0].status === 'active' && (
          <div className="mb-4 p-4 bg-indigo-50 rounded">
            <p className="font-medium">Live contest: {eventsResponse[0].name}</p>
            {/* countdown timer */}
            <Countdown end={eventsResponse[0].end_at} />
            <p className="text-sm text-gray-600">{eventsResponse[0].goal_metric}: {eventsResponse[0].distributed_so_far}/{eventsResponse[0].goal_value}</p>
            <div className="relative h-3 bg-gray-200 rounded mt-2 mb-2">
              <div
                className="absolute top-0 left-0 h-3 bg-sparknode-purple rounded"
                style={{ width: `${((eventsResponse[0].distributed_so_far||0) / (eventsResponse[0].goal_value||1))*100}%` }}
              />
            </div>
            <SalesLeaderboard eventId={eventsResponse[0].id} />
          </div>
        )}
        {isLoading ? <div>Loading...</div> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th>Name</th>
                <th>Type</th>
                <th>Start</th>
                <th>Eligible</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(eventsResponse || []).map((ev) => (
                <tr key={ev.id} className="border-t">
                  <td className="py-2">{ev.name}</td>
                  <td>{ev.event_type}</td>
                  <td>{new Date(ev.start_at).toLocaleString('en-IN')}</td>
                  <td>{ev.eligible_dept_ids && ev.eligible_dept_ids.length > 0 ? ev.eligible_dept_ids.length : 'all'}</td>
                  <td>{ev.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-md w-[720px] max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold mb-4">Create Sales Event</h3>

            {wizardStep === 1 && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault();
                  const fd = new FormData(e.target);
                  handleWizardNext({
                    name: fd.get('name'),
                    description: fd.get('description'),
                    event_type: fd.get('event_type'),
                    start_at: fd.get('start_at'),
                    end_at: fd.get('end_at'),
                    location: fd.get('location'),
                  });
                }}>
                <div>
                  <label className="label">Name</label>
                  <input name="name" className="input" required />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea name="description" className="input" />
                </div>
                <div>
                  <label className="label">Type</label>
                  <input name="event_type" className="input" defaultValue="sales" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Start At</label>
                    <input name="start_at" type="datetime-local" className="input" required />
                  </div>
                  <div>
                    <label className="label">End At</label>
                    <input name="end_at" type="datetime-local" className="input" />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Next</button>
                </div>
              </form>
            )}

            {wizardStep === 2 && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault();
                  const fd = new FormData(e.target);
                  handleWizardNext({
                    goal_metric: fd.get('goal_metric'),
                    goal_value: Number(fd.get('goal_value')),
                    reward_points: Number(fd.get('reward_points')),
                  });
                }}>
                <div>
                  <label className="label">Metric</label>
                  <select name="goal_metric" className="input" required>
                    <option value="deals_closed">Deals Closed</option>
                    <option value="revenue_inr">Revenue (INR)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Target Value</label>
                  <input name="goal_value" type="number" className="input" required />
                </div>
                <div>
                  <label className="label">Reward Points (per goal)</label>
                  <input name="reward_points" type="number" className="input" required />
                </div>
                <div className="flex justify-between">
                  <button type="button" className="btn-secondary" onClick={handleWizardPrev}>Back</button>
                  <button type="submit" className="btn-primary">Next</button>
                </div>
              </form>
            )}

            {wizardStep === 3 && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault();
                  const fd = new FormData(e.target);
                  // gather multiple selected departments
                  const eligible = [];
                  const opts = e.target.elements['eligible_dept_ids'];
                  if (opts) {
                    for (let i = 0; i < opts.options.length; i++) {
                      if (opts.options[i].selected) eligible.push(opts.options[i].value);
                    }
                  }
                  const regionStr = fd.get('eligible_region_ids') || '';
                  const regions = regionStr.split(',').map(s=>s.trim()).filter(Boolean);
                  handleWizardNext({
                    dept_id: fd.get('dept_id'),
                    eligible_dept_ids: eligible,
                    eligible_region_ids: regions,
                    total_budget_cap: Number(fd.get('total_budget_cap')),
                  });
                }}>
                <div>
                  <label className="label">Funding Department</label>
                  <select name="dept_id" className="input" required>
                    {tenantContext?.departments?.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Eligibility (departments)</label>
                  <select name="eligible_dept_ids" className="input" multiple size={3}>
                    {tenantContext?.departments?.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500">(hold Ctrl/Cmd to select multiple)</p>
                </div>
                <div>
                  <label className="label">Eligibility (regions)</label>
                  <input name="eligible_region_ids" className="input" placeholder="comma-separated regions" />
                  <p className="text-xs text-gray-500">e.g. north-india,south</p>
                </div>
                <div>
                  <label className="label">Total Event Cap (points)</label>
                  <input name="total_budget_cap" type="number" className="input" required />
                </div>
                <div className="flex justify-between">
                  <button type="button" className="btn-secondary" onClick={handleWizardPrev}>Back</button>
                  <button type="submit" className="btn-primary">Next</button>
                </div>
              </form>
            )}

            {wizardStep === 4 && (
              <div className="space-y-4">
                <p className="text-gray-700">Invite participants</p>
                <div>
                  <label className="label">Users</label>
                  <select name="invited_user_ids" className="input" multiple size={5}>
                    {/* load user list via API? for demo use tenantContext.users if available */}
                    {(tenantContext?.users || []).map(u => (
                      <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.corporate_email})</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500">Ctrl/Cmd+click to select multiple</p>
                </div>
                <div>
                  <label className="label">Departments</label>
                  <select name="invited_dept_ids" className="input" multiple size={3}>
                    {tenantContext?.departments?.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-between">
                  <button type="button" className="btn-secondary" onClick={handleWizardPrev}>Back</button>
                  <button type="button" className="btn-primary" onClick={finalizeCreate}>Create Event</button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}
