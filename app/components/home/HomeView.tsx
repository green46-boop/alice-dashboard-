'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { MODULE_COLORS } from '@/lib/constants'
import { formatKSTDate, formatKSTTime } from '@/lib/utils'
import EventModal, { type FullEvent } from '../shared/EventModal'

interface Event {
  id: string
  created_at: string
  raw_text: string
  summary: string | null
  modules: string[] | null
  content_type: string | null
  status: string | null
  duration_minutes: number | null
  amount: number | null
  is_favorite: boolean
}

export default function HomeView() {
  const [reminder, setReminder] = useState<Event | null>(null)
  const [recent, setRecent] = useState<Event[]>([])
  const [pool, setPool] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [editEvent, setEditEvent] = useState<Event | null>(null)
  const supabase = createClient()

  const loadData = useCallback(async () => {
    const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

    const [reminderRes, recentRes] = await Promise.all([
      supabase
        .from('events')
        .select('id, created_at, raw_text, summary, modules, content_type, status, duration_minutes, amount, is_favorite')
        .eq('is_deleted', false)
        .contains('modules', ['knowledge'])
        .gte('created_at', since90)
        .order('created_at', { ascending: true })
        .limit(200),
      supabase
        .from('events')
        .select('id, created_at, raw_text, summary, modules, content_type, status, duration_minutes, amount, is_favorite')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    const poolData = reminderRes.data || []
    setPool(poolData)
    if (poolData.length > 0) {
      setReminder(poolData[Math.floor(Math.random() * poolData.length)])
    }
    setRecent(recentRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const shuffleReminder = () => {
    if (pool.length > 0) setReminder(pool[Math.floor(Math.random() * pool.length)])
  }

  const handleSaved = (updated: FullEvent) => {
    setRecent(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e))
    if (reminder?.id === updated.id) setReminder({ ...reminder, ...updated })
  }

  const handleDeleted = (id: string) => {
    setRecent(prev => prev.filter(e => e.id !== id))
    if (reminder?.id === id) {
      const next = pool.filter(e => e.id !== id)
      setPool(next)
      setReminder(next.length > 0 ? next[Math.floor(Math.random() * next.length)] : null)
    }
  }

  if (loading) return <div className="p-6 text-gray-400 text-sm">불러오는 중...</div>

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 랜덤 리마인드 위젯 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">랜덤 리마인드</h2>
            <button onClick={shuffleReminder} className="text-gray-400 hover:text-gray-600 text-base" title="다른 거 보기">🔄</button>
          </div>
          {reminder ? (
            <div>
              <p className="text-sm text-gray-800 leading-relaxed">{reminder.summary || reminder.raw_text}</p>
              <div className="flex items-center gap-1.5 mt-2.5">
                <span className="text-xs text-gray-400">{formatKSTDate(reminder.created_at)}</span>
                {(reminder.modules || []).map(m => (
                  <span key={m} className={`text-xs px-2 py-0.5 rounded-full font-medium ${MODULE_COLORS[m] || 'bg-gray-100 text-gray-600'}`}>{m}</span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">저장된 기록이 없습니다</p>
          )}
        </div>

        {/* 최근 저장 위젯 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">최근 저장</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-gray-400">기록이 없습니다</p>
          ) : (
            <div className="space-y-2.5">
              {recent.map(e => (
                <div key={e.id} className="flex items-start gap-2 group">
                  <span className="text-xs text-gray-400 shrink-0 mt-0.5 w-10">{formatKSTTime(e.created_at)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 truncate">{e.summary || e.raw_text}</p>
                    <div className="flex gap-1 mt-0.5">
                      {(e.modules || []).slice(0, 2).map(m => (
                        <span key={m} className={`text-xs px-1.5 py-0 rounded-full font-medium ${MODULE_COLORS[m] || 'bg-gray-100 text-gray-600'}`}>{m}</span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => setEditEvent(e)}
                    className="text-gray-300 hover:text-gray-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  >
                    ✏️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editEvent && (
        <EventModal
          event={editEvent as FullEvent}
          onClose={() => setEditEvent(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
