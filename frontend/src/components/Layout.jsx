import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { CopilotProvider, useCopilot } from '../context/copilotContext'
import TopHeader from './TopHeader'
import RightSideCopilot from './RightSideCopilot'

export default function Layout() {
  return (
    <CopilotProvider>
      <LayoutContent />
    </CopilotProvider>
  )
}

function LayoutContent() {
  const { isOpen } = useCopilot()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Header with horizontal navigation */}
      <TopHeader />

      {/* Main content area - two column split layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column - Main Content */}
        <div className={`flex flex-col flex-1 overflow-auto transition-all duration-300 ${isOpen ? 'lg:max-w-2xl xl:max-w-4xl' : 'w-full'}`}>
          <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full">
            <Outlet />
          </main>
        </div>

        {/* Right Column - Copilot (hidden on small screens) */}
        {isOpen && <RightSideCopilot />}
      </div>
    </div>
  )
}
