import { Link } from 'react-router-dom'
import { HiLockClosed, HiArrowRight } from 'react-icons/hi'
import { useExperience } from '../context/ExperienceContext'

/**
 * ProGate — wraps any Growth-experience page.
 *
 * If the tenant is not on a Pro/Enterprise tier (and has no sales_marketing
 * feature flag), renders a soft upgrade prompt instead of the page content.
 * Pass `feature` to customise the lock screen copy.
 */
export default function ProGate({ children, feature = 'Growth Features' }) {
  const { isProUser } = useExperience()

  if (!isProUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-sparknode-purple/10 flex items-center justify-center">
            <HiLockClosed className="w-8 h-8 text-sparknode-purple" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Upgrade to unlock {feature}
          </h2>
          <p className="text-gray-500 mb-6">
            {feature} is part of the Sparknode Growth experience — available on
            Pro and Enterprise plans.
          </p>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-sparknode-purple text-white font-medium hover:bg-sparknode-purple/90 transition-colors"
          >
            View Plans <HiArrowRight className="w-4 h-4" />
          </Link>
          <p className="mt-4 text-sm text-gray-400">
            Already on a paid plan?{' '}
            <a
              href="mailto:support@sparknode.io"
              className="text-sparknode-purple underline"
            >
              Contact support
            </a>
          </p>
        </div>
      </div>
    )
  }

  return children
}
