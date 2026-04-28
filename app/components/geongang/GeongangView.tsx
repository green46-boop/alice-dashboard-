'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatKSTDate } from '@/lib/utils'
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

export default function GeongangView() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [editEvent, setEditEvent] = useState<Event | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('events')
      .select('id, created_at, raw_text, summary, modules, content_type, status, duration_minutes, amount, is_favorite')
      .eq('is_deleted', false)
      .contains('modules', ['health'])
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setEvents(data || [])
        setLoading(false)
      })
  }, [])

  const thisMonth = new Date()
  thisMonth.setDate(1)
  thisMonth.setHours(0, 0, 0, 0)

  const monthEvents = events.filter(e => new Date(e.created_at) >= thisMonth)
  const totalMins = monthEvents.reduce((s, e) => s + (e.duration_minutes || 0), 0)
  const avgMins = monthEvents.length > 0 ? Math.round(totalMins / monthEvents.length) : 0
  const maxMins = Math.max(...events.slice(0, 20).map(e => e.duration_minutes || 0), 1)

  const handleSaved = (updated: FullEvent) => {
    setEvents(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e))
  }

  const handleDeleted = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">불러오는 중...</div>

  return (
    <div className="p-6 max-w-2xl space-y-6">
      {/* 이번 달 요약 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">이번 달</h2>
        <div className="flex gap-6 text-sm">
          <div>
            <div className="text-2xl font-bold text-gray-800">{monthEvents.length}</div>
            <div className="text-xs text-gray-400 mt-0.5">운동 횟수</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{totalMins}</div>
            <div className="text-xs text-gray-400 mt-0.5">총 분</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-500">{avgMins}</div>
            <div className="text-xs text-gray-400 mt-0.5">평균 분/회</div>
          </div>
        </div>
      </div>

      {/* 기록 목록 */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">전체 기록</h2>
        {events.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">건강 기록이 없습니다</p>
        ) : (
          <div className="space-y-2">
            {events.map(e => {
              const barWidth = e.duration_minutes
                ? `${Math.round((e.duration_minutes / maxMins) * 100)}%`
                : '0%'
              return (
                <div key={e.id} className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100 group">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm text-gray-800 flex-1 min-w-0 truncate">{e.summary || e.raw_text}</p>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {e.duration_minutes && (
                        <span className="text-sm font-medium text-green-600">{e.duration_minutes}분</span>
                      )}
                      <span className="text-xs text-gray-400">{formatKSTDate(e.created_at)}</span>
                      <button
                        onClick={() => setEditEvent(e)}
                        className="text-gray-300 hover:text-gray-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ✏️
                      </button>
                    </div>
                  </div>
                  {e.duration_minutes && (
                    <div className="h-1 bg-gray-100 rounded-full">
                      <div className="h-1 bg-green-400 rounded-full transition-all" style={{ width: barWidth }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
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
