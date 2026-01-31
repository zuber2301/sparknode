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
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Header with horizontal navigation */}
      <TopHeader />

      {/* Main content area - two column split layout */}
      <div className="flex flex-1 overflow-hidden px-2 sm:px-3 lg:px-4 py-2 sm:py-3 gap-2 sm:gap-3 h-full">
        {/* Left Column - Copilot (always visible, independent scroll) */}
        <div className="flex flex-col flex-shrink-0">
          <RightSideCopilot />
        </div>
        {/* Visual Divider */}
        <div className="w-px bg-gradient-to-b from-transparent via-gray-300 to-transparent flex-shrink-0" />

        {/* Right Column - Main Content (independent scroll) */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <main className="flex-1 w-full bg-white rounded-xl shadow-sm p-4 sm:p-5 lg:p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
