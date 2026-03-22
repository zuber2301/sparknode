import { useNavigate } from 'react-router-dom'
import { useExperience } from '../context/ExperienceContext'

/**
 * PersonaSwitcher — "Switch Module" pill shown in the top header.
 *
 * When the tenant has both SparkNode and IgniteNode enabled, this pill
 * lets the user navigate back to the Launchpad (/gateway) to switch
 * between the two platforms at any time.
 *
 * Single-module tenants: renders nothing (no switching needed).
 */
export default function PersonaSwitcher() {
  const { hasBothModules, activeExperience } = useExperience()
  const navigate = useNavigate()

  if (!hasBothModules) return null

  const isIgnite = activeExperience === 'growth'

  return (
    <button
      onClick={() => navigate('/gateway')}
      title="Switch between SparkNode and IgniteNode"
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
        isIgnite
          ? 'border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100'
          : 'border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100'
      }`}
    >
      <span className="text-sm leading-none">{isIgnite ? '🔥' : '🎯'}</span>
      <span className="hidden sm:inline">{isIgnite ? 'IgniteNode' : 'SparkNode'}</span>
      <span className="text-gray-400 hidden sm:inline">⇄</span>
    </button>
  )
}
