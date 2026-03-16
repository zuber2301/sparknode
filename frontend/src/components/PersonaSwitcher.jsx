import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { HiChevronDown, HiLockClosed } from 'react-icons/hi'
import { useExperience } from '../context/ExperienceContext'
import { useAuthStore } from '../store/authStore'

/**
 * PersonaSwitcher — compact pill in the top header that lets tenant managers
 * toggle between the Engagement and Growth experiences.
 *
 * Renders nothing for non-tenant-manager roles or when only one experience is
 * available (single-experience tenants don't need a switcher).
 */
export default function PersonaSwitcher() {
  const { user } = useAuthStore()
  const {
    activeExperience,
    setExperience,
    availableExperiences,
    isProUser,
    experienceMeta,
  } = useExperience()

  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Only tenant managers see this control
  const isTenantManager = user?.org_role === 'tenant_manager'
  // Show if manager AND (multiple experiences OR we want to at least offer upgrade CTA)
  if (!isTenantManager) return null

  const current = experienceMeta[activeExperience]

  const handleSelect = (exp) => {
    setOpen(false)
    if (availableExperiences.includes(exp)) {
      setExperience(exp)
      navigate(experienceMeta[exp].href)
    } else {
      navigate('/pricing')
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
        title={`Current experience: ${current.label}`}
      >
        <span className="text-base leading-none">{current.icon}</span>
        <span className="hidden sm:inline">{current.shortLabel}</span>
        <HiChevronDown
          className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Switch Experience
            </p>
          </div>

          {Object.entries(experienceMeta).map(([key, meta]) => {
            const isActive = key === activeExperience
            const isLocked = !availableExperiences.includes(key)

            return (
              <button
                key={key}
                onClick={() => handleSelect(key)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${isActive ? 'bg-gray-50' : ''}`}
              >
                <span className="text-xl mt-0.5">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-sm font-medium ${isActive ? 'text-sparknode-purple' : 'text-gray-800'}`}
                    >
                      {meta.label}
                    </span>
                    {isActive && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-sparknode-purple/10 text-sparknode-purple">
                        Active
                      </span>
                    )}
                    {isLocked && (
                      <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">
                        <HiLockClosed className="w-2.5 h-2.5" />
                        Pro
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{meta.description}</p>
                  {isLocked && (
                    <p className="text-xs text-sparknode-purple mt-1 font-medium">
                      Upgrade to unlock →
                    </p>
                  )}
                </div>
              </button>
            )
          })}

          {!isProUser && (
            <div className="px-4 py-2 bg-gradient-to-r from-sparknode-purple/5 to-sparknode-blue/5 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Unlock Growth on a{' '}
                <button
                  onClick={() => { setOpen(false); navigate('/pricing') }}
                  className="text-sparknode-purple font-medium underline"
                >
                  Pro plan
                </button>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
