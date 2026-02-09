import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HiOutlineCurrencyRupee, HiOutlineExclamationCircle, HiOutlineTrendingUp, HiOutlineLightBulb } from 'react-icons/hi'
import { tenantsAPI, usersApi, recognitionAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'

/**
 * Morning Briefing Component
 * 
 * Displays a personalized morning briefing for Tenant Managers including:
 * - Master Pool budget overview
 * - Team lead budget status alerts
 * - Recognition stats (week-over-week comparison)
 * - Quick action tips
 */
export default function MorningBriefing() {
  const { user } = useAuthStore()

  // Fetch tenant data
  const { data: tenantData } = useQuery({
    queryKey: ['tenant', user?.tenant_id],
    queryFn: () => tenantsAPI.getCurrent(),
    enabled: !!user?.tenant_id,
  })

  // Fetch team leads
  const { data: teamLeadsData } = useQuery({
    queryKey: ['directReports', user?.id],
    queryFn: () => usersApi.getDirectReports(user?.id),
    enabled: !!user?.id,
  })

  // Fetch recognition stats
  const { data: recognitionStatsData } = useQuery({
    queryKey: ['recognitionStats', user?.tenant_id],
    queryFn: () => recognitionAPI.getTenantStats(user?.tenant_id),
    enabled: !!user?.tenant_id,
  })

  // Process team lead budget alerts
  const teamLeadAlerts = useMemo(() => {
    if (!teamLeadsData?.data) return []
    
    return teamLeadsData.data
      .filter(lead => lead.org_role === 'dept_lead' || lead.org_role === 'dept_lead')
      .map(lead => {
        const budgetUsagePercent = lead.wallet_data?.lifetime_spent 
          ? Math.round((Number(lead.wallet_data.lifetime_spent) / (Number(lead.wallet_data.lifetime_spent) + Number(lead.wallet_data.balance))) * 100)
          : 0
        
        return {
          id: lead.id,
          name: lead.first_name || lead.name,
          budgetUsagePercent,
          balance: Number(lead.wallet_data?.balance || 0),
          earned: Number(lead.wallet_data?.lifetime_earned || 0),
          needsTopUp: budgetUsagePercent >= 80
        }
      })
      .sort((a, b) => b.budgetUsagePercent - a.budgetUsagePercent)
  }, [teamLeadsData])

  // Calculate recognition stats change
  const recognitionChange = useMemo(() => {
    if (!recognitionStatsData?.data) return 0
    const thisWeek = recognitionStatsData.data.this_week_count || 0
    const lastWeek = recognitionStatsData.data.last_week_count || 1
    return Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
  }, [recognitionStatsData])

  const tenant = tenantData?.data
  const masterPoolBudget = tenant?.budget_allocation_balance || 0
  const thisWeekRecognitions = recognitionStatsData?.data?.this_week_count || 0

  return (
    <div className="space-y-4">
      {/* Main Briefing Card */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1">
              Good morning, {user?.first_name || 'Manager'}! 👋
            </h2>
            <p className="text-sm sm:text-base text-gray-700 mb-4">
              Here's your snapshot for today:
            </p>

            {/* Master Pool Budget */}
            <div className="bg-white rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-500 font-medium">Master Pool</p>
                  <p className="text-2xl sm:text-3xl font-bold text-blue-600 mt-1">
                    ₹{masterPoolBudget?.toLocaleString('en-IN') || '0'}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <HiOutlineCurrencyRupee className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-2">
                Available for distribution to your team
              </p>
            </div>

            {/* Team Lead Alerts */}
            {teamLeadAlerts.length > 0 && (
              <div className="mb-3 sm:mb-4">
                <p className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Team Lead Status:</p>
                <div className="space-y-2">
                  {teamLeadAlerts.slice(0, 3).map(lead => (
                    <div 
                      key={lead.id} 
                      className={`flex items-center justify-between p-2 sm:p-3 rounded-lg ${
                        lead.needsTopUp 
                          ? 'bg-orange-50 border border-orange-200' 
                          : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {lead.needsTopUp && (
                          <HiOutlineExclamationCircle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                            {lead.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {lead.budgetUsagePercent}% used {lead.needsTopUp ? '— Top-up recommended' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <p className="text-xs sm:text-sm font-semibold text-gray-900">
                          ₹{lead.balance?.toLocaleString('en-IN') || '0'}
                        </p>
                        <p className="text-xs text-gray-500">remaining</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recognition Stats */}
            <div className="bg-white rounded-lg p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-500 font-medium">Recognition This Week</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                      {thisWeekRecognitions}
                    </p>
                    <span className={`text-xs sm:text-sm font-semibold ${recognitionChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {recognitionChange >= 0 ? '+' : ''}{recognitionChange}%
                    </span>
                  </div>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <HiOutlineTrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-2">
                vs. last week — Great engagement!
              </p>
            </div>
          </div>

          {/* Sparkle Icon */}
          <div className="hidden sm:flex w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-yellow-300 to-orange-300 rounded-full items-center justify-center flex-shrink-0 shadow-md">
            <HiOutlineLightBulb className="w-6 h-6 lg:w-8 lg:h-8 text-yellow-700" />
          </div>
        </div>
      </div>

      {/* Quick Actions Tip */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 flex gap-3">
        <div className="w-6 h-6 sm:w-7 sm:h-7 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-xs sm:text-sm font-bold text-blue-600">💡</span>
        </div>
        <div className="flex-1">
          <p className="text-xs sm:text-sm text-blue-900 font-medium">Quick Tip:</p>
          <p className="text-xs sm:text-sm text-blue-800 mt-1">
            Consider distributing budget to leads with high usage to keep the momentum going!
          </p>
        </div>
      </div>
    </div>
  )
}
