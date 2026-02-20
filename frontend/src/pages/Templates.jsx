import { useState } from 'react'
import { HiOutlineViewGrid, HiOutlineGift, HiOutlineClock, HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi'

export default function Templates() {
  const [templates, setTemplates] = useState([
    { id: 1, name: 'Classic E-Card', category: 'ecard', pointValue: 100, image: '🎁', active: true },
    { id: 2, name: 'Diwali Special', category: 'seasonal', pointValue: 150, image: '🪔', active: true },
    { id: 3, name: 'Christmas Wishes', category: 'seasonal', pointValue: 150, image: '🎄', active: true },
    { id: 4, name: 'New Year Celebration', category: 'seasonal', pointValue: 125, image: '🎉', active: false },
    { id: 5, name: 'Achievement Badge', category: 'ecard', pointValue: 80, image: '⭐', active: true },
  ])

  const [selectedTab, setSelectedTab] = useState('all')
  const [tiers, setTiers] = useState([
    { name: 'Bronze', minPoints: 0, maxPoints: 499, color: '#CD7F32' },
    { name: 'Silver', minPoints: 500, maxPoints: 999, color: '#C0C0C0' },
    { name: 'Gold', minPoints: 1000, maxPoints: 4999, color: '#FFD700' },
    { name: 'Platinum', minPoints: 5000, maxPoints: Infinity, color: '#E5E4E2' },
  ])

  const deleteTemplate = (id) => {
    setTemplates(templates.filter(t => t.id !== id))
  }

  const toggleActive = (id) => {
    setTemplates(templates.map(t => 
      t.id === id ? { ...t, active: !t.active } : t
    ))
  }

  const filteredTemplates = selectedTab === 'all' 
    ? templates 
    : templates.filter(t => t.category === selectedTab)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <HiOutlineViewGrid className="w-8 h-8 text-sparknode-purple" />
          Reward Templates & Assets
        </h1>
        <p className="text-gray-600 mt-1">Manage E-card designs, point values, and seasonal themes globally</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { id: 'all', label: 'All Templates' },
          { id: 'ecard', label: 'E-Cards' },
          { id: 'seasonal', label: 'Seasonal Themes' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setSelectedTab(tab.id)}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              selectedTab === tab.id
                ? 'border-sparknode-purple text-sparknode-purple'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Templates</h2>
          <button className="flex items-center gap-2 px-4 py-2 bg-sparknode-purple text-white rounded-lg font-medium hover:bg-opacity-90 transition-colors">
            <HiOutlinePlus className="w-4 h-4" />
            Upload New Template
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <div key={template.id} className={`bg-white rounded-xl border-2 overflow-hidden transition-all hover:shadow-lg ${template.active ? 'border-gray-200' : 'border-gray-100 opacity-75'}`}>
              {/* Preview */}
              <div className="w-full h-40 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center border-b border-gray-200">
                <span className="text-6xl">{template.image}</span>
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{template.name}</h3>
                  <p className="text-xs text-gray-500 capitalize mt-1">{template.category.replace('_', ' ')}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <div>
                    <p className="text-xs text-gray-500">Point Value</p>
                    <p className="text-lg font-bold text-sparknode-purple">{template.pointValue}</p>
                  </div>
                  <button
                    onClick={() => toggleActive(template.id)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      template.active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {template.active ? 'Active' : 'Inactive'}
                  </button>
                </div>

                <div className="flex gap-2 pt-2">
                  <button className="flex-1 px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-900 hover:bg-gray-200 transition-colors">
                    Edit
                  </button>
                  <button
                    onClick={() => deleteTemplate(template.id)}
                    className="px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <HiOutlineTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reward Tiers */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <HiOutlineGift className="w-5 h-5" />
            Reward Tiers
          </h2>
          <p className="text-sm text-gray-600 mt-1">Define which templates are available at each tier level</p>
        </div>

        <div className="divide-y divide-gray-200">
          {tiers.map((tier, idx) => (
            <div key={idx} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-4">
                <div
                  className="w-8 h-8 rounded-lg border-2"
                  style={{ borderColor: tier.color, backgroundColor: tier.color + '20' }}
                />
                <div>
                  <h3 className="font-semibold text-gray-900">{tier.name}</h3>
                  <p className="text-sm text-gray-600">
                    {tier.minPoints.toLocaleString('en-IN')} - {tier.maxPoints === Infinity ? '∞' : tier.maxPoints.toLocaleString('en-IN')} points
                  </p>
                </div>
              </div>
              <button className="text-sparknode-purple hover:text-sparknode-purple font-medium text-sm">
                Configure
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Seasonal Themes Management */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <HiOutlineClock className="w-5 h-5" />
            Seasonal Theme Calendar
          </h2>
          <p className="text-sm text-gray-600 mt-1">Schedule automated seasonal template rollouts to all tenants</p>
        </div>

        <div className="p-6 space-y-3">
          {[
            { name: 'Diwali 2026', date: 'Oct 29 - Nov 1, 2026', active: true },
            { name: 'Christmas 2026', date: 'Dec 1 - Dec 31, 2026', active: true },
            { name: 'New Year 2027', date: 'Jan 1 - Jan 15, 2027', active: false },
            { name: 'Easter 2027', date: 'Apr 4 - Apr 11, 2027', active: false },
          ].map((season, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <div>
                <h3 className="font-medium text-gray-900">{season.name}</h3>
                <p className="text-sm text-gray-600">{season.date}</p>
              </div>
              <button className={`px-4 py-1 rounded-lg text-sm font-medium transition-colors ${
                season.active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {season.active ? 'Active' : 'Scheduled'}
              </button>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <button className="flex items-center gap-2 px-4 py-2 bg-sparknode-purple text-white rounded-lg font-medium hover:bg-opacity-90 transition-colors">
            <HiOutlinePlus className="w-4 h-4" />
            Add Seasonal Theme
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Templates</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{templates.filter(t => t.active).length}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
              <HiOutlineViewGrid className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Templates</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{templates.length}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <HiOutlineGift className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg. Point Value</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{Math.round(templates.reduce((sum, t) => sum + t.pointValue, 0) / templates.length)}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
              <HiOutlineGift className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
