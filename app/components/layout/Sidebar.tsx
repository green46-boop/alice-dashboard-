'use client'

type View = 'home' | 'jigaebu' | 'jisik' | 'geongang' | 'sns'

const NAV_ITEMS: { id: View; label: string; icon: string }[] = [
  { id: 'home', label: '홈', icon: '🏠' },
  { id: 'jigaebu', label: '시계부', icon: '🕐' },
  { id: 'jisik', label: '지식', icon: '📚' },
  { id: 'geongang', label: '건강', icon: '💪' },
  { id: 'sns', label: 'SNS 성과', icon: '📱' },
]

interface Props {
  currentView: View
  onNavigate: (view: View) => void
}

export default function Sidebar({ currentView, onNavigate }: Props) {
  return (
    <aside className="w-52 shrink-0 bg-white border-r border-gray-100 flex flex-col">
      <div className="px-5 py-5">
        <h1 className="text-lg font-bold text-gray-900">Alice</h1>
      </div>
      <nav className="flex-1 px-2">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 ${
              currentView === item.id
                ? 'bg-gray-100 text-gray-900 font-medium'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}

export type { View }
