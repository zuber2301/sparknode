import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { HiOutlineSparkles, HiOutlineGift, HiOutlineUsers, HiOutlineStar, HiOutlineChartBar, HiOutlineHeart } from 'react-icons/hi'

export default function LandingPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const features = [
    {
      icon: HiOutlineSparkles,
      title: 'Recognize Excellence',
      description: 'Give instant recognition to your colleagues for their outstanding work and contributions.',
      action: 'Recognize Someone',
      path: '/recognize'
    },
    {
      icon: HiOutlineGift,
      title: 'Redeem Rewards',
      description: 'Exchange your earned points for amazing rewards from our extensive catalog.',
      action: 'Browse Rewards',
      path: '/redeem'
    },
    {
      icon: HiOutlineUsers,
      title: 'Team Collaboration',
      description: 'Build stronger teams through peer-to-peer recognition and group awards.',
      action: 'View Team Hub',
      path: '/feed'
    },
    {
      icon: HiOutlineChartBar,
      title: 'Track Progress',
      description: 'Monitor your recognition stats, points balance, and redemption history.',
      action: 'View Analytics',
      path: '/wallet'
    }
  ]

  const stats = [
    { label: 'Active Users', value: '10,000+', icon: HiOutlineUsers },
    { label: 'Recognitions Given', value: '50,000+', icon: HiOutlineHeart },
    { label: 'Rewards Redeemed', value: '25,000+', icon: HiOutlineGift },
    { label: 'Happy Companies', value: '500+', icon: HiOutlineStar }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mb-8 shadow-lg">
              <HiOutlineSparkles className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">SparkNode</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Transform your workplace culture with our comprehensive rewards and recognition platform.
              Celebrate achievements, boost morale, and create a more engaged workforce.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate('/recognize')}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:shadow-lg transition-all transform hover:scale-105"
              >
                Start Recognizing
              </button>
              <button
                onClick={() => navigate('/feed')}
                className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-xl font-semibold text-lg hover:border-blue-600 hover:text-blue-600 transition-all"
              >
                Explore Feed
              </button>
            </div>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-200 to-purple-200 rounded-full opacity-20"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-purple-200 to-pink-200 rounded-full opacity-20"></div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-100 to-purple-100 rounded-xl mb-4">
                  <stat.icon className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-2">{stat.value}</div>
                <div className="text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Everything You Need</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Discover the powerful features that make SparkNode the ultimate rewards and recognition platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-all transform hover:scale-105">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-100 to-purple-100 rounded-xl flex items-center justify-center mb-6">
                  <feature.icon className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 mb-6">{feature.description}</p>
                <button
                  onClick={() => navigate(feature.path)}
                  className="text-blue-600 font-semibold hover:text-blue-700 transition-colors"
                >
                  {feature.action} →
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-24 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Transform Your Workplace?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of companies already using SparkNode to create a culture of appreciation and recognition.
          </p>
          <button
            onClick={() => navigate('/recognize')}
            className="bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold text-lg hover:shadow-lg transition-all transform hover:scale-105"
          >
            Get Started Today
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="py-12 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <HiOutlineSparkles className="w-8 h-8 mr-2" />
            <span className="text-2xl font-bold">SparkNode</span>
          </div>
          <p className="text-gray-400">
            © 2024 SparkNode. Building better workplaces through recognition and rewards.
          </p>
        </div>
      </div>
    </div>
  )
}