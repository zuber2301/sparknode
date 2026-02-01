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
      <div className="flex flex-1 overflow-hidden px-1 sm:px-2 lg:px-3 py-2 gap-2 sm:gap-3 h-full">
        {/* Left Column - Copilot (always visible, independent scroll) */}
        <div className="flex flex-col flex-shrink-0">
          <RightSideCopilot />
        </div>
        {/* Visual Divider */}
        <div className="w-px bg-gray-200 flex-shrink-0" />

        {/* Right Column - Main Content (independent scroll) */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <main className="flex-1 w-full bg-white rounded-xl shadow-sm p-2 sm:p-4 lg:p-5 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
