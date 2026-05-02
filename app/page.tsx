'use client'

import { useState } from 'react'
import Sidebar, { type View } from './components/layout/Sidebar'
import BottomNav from './components/layout/BottomNav'
import SearchBar from './components/layout/SearchBar'
import HomeView from './components/home/HomeView'
import JigaebuView from './components/jigaebu/JigaebuView'
import JisikView from './components/jisik/JisikView'
import GeongangView from './components/geongang/GeongangView'
import SnsView from './components/sns/SnsView'
import EventModal, { type FullEvent } from './components/shared/EventModal'

export default function Home() {
  const [view, setView] = useState<View>('home')
  const [addModal, setAddModal] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleSaved = (_event: FullEvent) => {
    setRefreshKey(k => k + 1)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 상단 검색바 */}
      <header className="h-12 bg-white border-b border-gray-100 flex items-center px-4 gap-3 shrink-0 z-20">
        <button
          onClick={() => setView('home')}
          className="md:hidden text-sm font-bold text-gray-900 hover:text-gray-600 transition-colors shrink-0"
        >
          Alice
        </button>
        <SearchBar />
        <button
          onClick={() => setAddModal(true)}
          className="shrink-0 w-8 h-8 flex items-center justify-center bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors text-lg font-light"
          title="새 기록 추가"
        >
          +
        </button>
      </header>

      {/* 사이드바 + 메인 */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentView={view} onNavigate={setView} />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {view === 'home' && <HomeView key={refreshKey} />}
          {view === 'jigaebu' && <JigaebuView key={refreshKey} />}
          {view === 'jisik' && <JisikView key={refreshKey} />}
          {view === 'geongang' && <GeongangView key={refreshKey} />}
          {view === 'sns' && <SnsView key={refreshKey} />}
        </main>
      </div>

      {/* 모바일 하단 탭 바 */}
      <BottomNav currentView={view} onNavigate={setView} />

      {/* 새 기록 추가 모달 */}
      {addModal && (
        <EventModal
          event={null}
          template={view === 'home' ? 'default' : view as 'jisik' | 'geongang' | 'jigaebu' | 'sns'}
          onClose={() => setAddModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
