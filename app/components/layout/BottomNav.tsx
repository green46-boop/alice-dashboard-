'use client'

import type { View } from './Sidebar'

const NAV_ITEMS: { id: View; label: string; icon: string }[] = [
  { id: 'home', label: '홈', icon: '🏠' },
  { id: 'jigaebu', label: '시계부', icon: '🕐' },
  { id: 'jisik', label: '지식', icon: '📚' },
  { id: 'geongang', label: '건강', icon: '💪' },
  { id: 'sns', label: 'SNS', icon: '📱' },
]

interface Props {
  currentView: View
  onNavigate: (view: View) => void
}

export default function BottomNav({ currentView, onNavigate }: Props) {
  return (
    <nav className="flex md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-20">
      {NAV_ITEMS.map(item => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
            currentView === item.id
              ? 'text-gray-900'
              : 'text-gray-400'
          }`}
        >
          <span className="text-lg leading-none">{item.icon}</span>
          <span className={`text-xs ${currentView === item.id ? 'font-medium' : ''}`}>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
