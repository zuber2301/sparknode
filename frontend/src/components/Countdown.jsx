import { useState, useEffect } from 'react'

// Simple countdown timer that shows time remaining until given ISO timestamp
export default function Countdown({ end }) {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    if (!end) return
    const target = new Date(end).getTime()
    const tick = () => {
      const now = Date.now()
      const diff = target - now
      if (diff <= 0) {
        setRemaining('ended')
        return clearInterval(timer)
      }
      const hours = Math.floor(diff / 3600000)
      const mins = Math.floor((diff % 3600000) / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setRemaining(`${hours}h ${mins}m ${secs}s`)
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [end])

  if (!end) return null
  return <p className="text-sm text-gray-500">Ends in: {remaining}</p>
}
