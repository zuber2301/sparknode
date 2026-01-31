import { useState } from 'react'
import { HiOutlineSparkles, HiOutlineCog, HiOutlineChartBar, HiOutlineCheck, HiOutlineX } from 'react-icons/hi'

export default function AISettings() {
  const [systemPrompt, setSystemPrompt] = useState('You are Sparky, SparkNode\'s AI assistant. Help employees understand their benefits, redemption options, and earn recognition through the platform. Be friendly, helpful, and professional.')
  const [toolPermissions, setToolPermissions] = useState([
    { id: 1, name: 'View User Profiles', enabled: true, description: 'Access user information for personalization' },
    { id: 2, name: 'Check Wallet Balance', enabled: true, description: 'Retrieve user point balances' },
    { id: 3, name: 'Get Redemption Options', enabled: true, description: 'Show available rewards' },
    { id: 4, name: 'Send Notifications', enabled: false, description: 'Push messages to users' },
    { id: 5, name: 'Create Recognition', enabled: false, description: 'Generate automatic recognition events' },
    { id: 6, name: 'Modify User Data', enabled: false, description: 'Change user settings and preferences' },
  ])
  const [promptSaved, setPromptSaved] = useState(false)

  const togglePermission = (permissionId) => {
    setToolPermissions(toolPermissions.map(p => 
      p.id === permissionId ? { ...p, enabled: !p.enabled } : p
    ))
  }

  const handleSavePrompt = () => {
    setPromptSaved(true)
    setTimeout(() => setPromptSaved(false), 2000)
  }

  const topQuestions = [
    { query: 'How do I redeem my points?', count: 324, percentage: 28 },
    { query: 'What rewards are available?', count: 287, percentage: 25 },
    { query: 'How do I check my balance?', count: 156, percentage: 14 },
    { query: 'How can I earn more points?', count: 142, percentage: 12 },
    { query: 'How do I recognize a colleague?', count: 121, percentage: 10 },
    { query: 'Tell me about company benefits', count: 89, percentage: 8 },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <HiOutlineSparkles className="w-8 h-8 text-sparknode-purple" />
          AI Settings & Command Center
        </h1>
        <p className="text-gray-600 mt-1">Configure Sparky's behavior, permissions, and monitor AI usage analytics</p>
      </div>

      {/* System Prompt Configuration */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">System Prompt Configuration</h2>
          <p className="text-sm text-gray-600 mt-1">Define how Sparky responds to user queries</p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Sparky's Core Instructions</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full h-32 p-4 rounded-lg border border-gray-200 focus:border-sparknode-purple focus:ring-2 focus:ring-sparknode-purple/20 resize-none"
              placeholder="Enter system prompt..."
            />
            <p className="text-xs text-gray-500 mt-2">{systemPrompt.length} characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Temperature (Creativity Level)</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                defaultValue="70"
                className="flex-1"
              />
              <span className="text-sm font-medium text-gray-900">0.7</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Lower = More predictable, Higher = More creative</p>
          </div>

          <button
            onClick={handleSavePrompt}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              promptSaved
                ? 'bg-green-500 text-white'
                : 'bg-sparknode-purple text-white hover:bg-opacity-90'
            }`}
          >
            {promptSaved ? '✓ Saved' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {/* Tool Permissions */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Tool Permissions</h2>
          <p className="text-sm text-gray-600 mt-1">Control which capabilities Sparky can use</p>
        </div>

        <div className="divide-y divide-gray-200">
          {toolPermissions.map((permission) => (
            <div key={permission.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">{permission.name}</h3>
                <p className="text-sm text-gray-600 mt-0.5">{permission.description}</p>
              </div>

              <button
                onClick={() => togglePermission(permission.id)}
                className="flex-shrink-0 ml-4 transition-colors"
              >
                {permission.enabled ? (
                  <HiOutlineCheck className="w-6 h-6 text-green-600" />
                ) : (
                  <HiOutlineX className="w-6 h-6 text-gray-400" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Questions */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <HiOutlineChartBar className="w-5 h-5" />
              Top User Queries
            </h2>
          </div>

          <div className="p-6 space-y-4">
            {topQuestions.map((question, idx) => (
              <div key={idx}>
                <div className="flex items-start justify-between mb-1">
                  <p className="text-sm font-medium text-gray-900 flex-1">{question.query}</p>
                  <span className="text-xs font-semibold text-gray-500 ml-2">{question.count}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-sparknode-purple to-sparknode-blue h-2 rounded-full transition-all"
                    style={{ width: `${question.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{question.percentage}% of queries</p>
              </div>
            ))}
          </div>
        </div>

        {/* Analytics Summary */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Conversations</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">2,847</p>
                <p className="text-xs text-gray-500 mt-2">Last 30 days</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <HiOutlineChartBar className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg. Satisfaction</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">4.7/5</p>
                <p className="text-xs text-gray-500 mt-2">Based on 324 ratings</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
                <HiOutlineSparkles className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Resolution Rate</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">92%</p>
                <p className="text-xs text-gray-500 mt-2">Questions fully answered</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <HiOutlineCog className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
