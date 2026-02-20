import React from 'react'
import { HiOutlineBanknotes, HiOutlineUsers, HiOutlineWallet, HiOutlineArrowTrendingUp } from 'react-icons/hi2'

export default function HeroSection({ stats, currency = 'USD' }) {
  const cards = [
    {
      title: 'COMPANY POOL (MASTER)',
      value: stats?.master_pool || 0,
      icon: HiOutlineBanknotes,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: 'Points available for you to distribute or delegate',
      utilization: 0,
    },
    {
      title: 'TOTAL DELEGATED',
      value: stats?.total_delegated || 0,
      icon: HiOutlineUsers,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      description: 'Budget currently in the hands of your Department Leads',
      utilization: 0,
    },
    {
      title: 'WALLET CIRCULATION',
      value: stats?.total_in_wallets || 0,
      icon: HiOutlineWallet,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      description: 'Points earned by employees and ready for redemption',
      utilization: 100,
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {cards.map((card) => (
        <div key={card.title} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-bold text-gray-500 tracking-wider mb-1 uppercase">{card.title}</p>
              <h3 className="text-3xl font-black text-gray-900">{card.value.toLocaleString()}</h3>
            </div>
            <div className={`p-3 rounded-xl ${card.bgColor}`}>
              <card.icon className={`w-6 h-6 ${card.color}`} />
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-6">{card.description}</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase">
              <span>Utilization</span>
              <span>{card.utilization}%</span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${card.color.replace('text', 'bg')}`} 
                style={{ width: `${card.utilization}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
