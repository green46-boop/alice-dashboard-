'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { MODULE_COLORS, MODULE_BG } from '@/lib/constants'
import { toKST, dateRangeKST, extractEventTime } from '@/lib/utils'
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

function addDays(date: Date, n: number): Date {
  return new Date(date.getTime() + n * 24 * 60 * 60 * 1000)
}

function kstDateLabel(kstDate: Date): string {
  const y = kstDate.getUTCFullYear()
  const m = String(kstDate.getUTCMonth() + 1).padStart(2, '0')
  const d = String(kstDate.getUTCDate()).padStart(2, '0')
  return `${y}.${m}.${d}`
}

function todayKST(): Date {
  const now = new Date()
  const kstNow = toKST(now)
  return new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()))
}

export default function JigaebuView() {
  const [selectedKST, setSelectedKST] = useState<Date>(todayKST)
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [editEvent, setEditEvent] = useState<Event | null>(null)
  const supabase = createClient()

  useEffect(() => {
    setLoading(true)
    const { start, end } = dateRangeKST(selectedKST)
    supabase
      .from('events')
      .select('id, created_at, raw_text, summary, modules, content_type, status, duration_minutes, amount, is_favorite')
      .eq('is_deleted', false)
      .contains('modules', ['time'])
      .gte('created_at', start)
      .lt('created_at', end)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setEvents(data || [])
        setLoading(false)
      })
  }, [selectedKST])

  const exerciseMins = events
    .filter(e => e.modules?.includes('health') && e.duration_minutes)
    .reduce((s, e) => s + (e.duration_minutes || 0), 0)

  const totalSpend = events
    .filter(e => e.amount && e.amount > 0)
    .reduce((s, e) => s + (e.amount || 0), 0)

  const isToday = selectedKST.getTime() === todayKST().getTime()

  const handleSaved = (updated: FullEvent) => {
    setEvents(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e))
  }
  const handleDeleted = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  return (
    <div className="p-6 max-w-2xl">
      {/* 날짜 네비게이터 */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setSelectedKST(d => addDays(d, -1))} className="text-gray-400 hover:text-gray-600 text-xl px-1">‹</button>
        <span className="text-sm font-medium text-gray-700 min-w-28 text-center">
          {kstDateLabel(selectedKST)}
          {isToday && <span className="text-blue-500 text-xs ml-1.5">오늘</span>}
        </span>
        <button onClick={() => setSelectedKST(d => addDays(d, 1))} disabled={isToday} className="text-gray-400 hover:text-gray-600 text-xl px-1 disabled:opacity-30">›</button>
      </div>

      {/* 요약 바 */}
      <div className="flex gap-4 mb-5 text-sm text-gray-500">
        <span><strong className="text-gray-800">{events.length}</strong> 기록</span>
        {exerciseMins > 0 && <span>💪 <strong className="text-green-600">{exerciseMins}</strong>분</span>}
        {totalSpend > 0 && <span>💰 <strong className="text-yellow-600">{totalSpend.toLocaleString()}</strong>원</span>}
      </div>

      {loading && <p className="text-sm text-gray-400">불러오는 중...</p>}
      {!loading && events.length === 0 && (
        <p className="text-sm text-gray-400 py-8 text-center">이 날 기록이 없습니다</p>
      )}

      {/* 리스트 타임라인 */}
      {!loading && events.length > 0 && (
        <div className="relative">
          {/* 세로 선 */}
          <div className="absolute left-14 top-0 bottom-0 w-px bg-gray-100" />

          <div className="space-y-3">
            {events.map(e => {
              const kst = toKST(extractEventTime(e.raw_text, e.created_at))
              const timeStr = `${String(kst.getUTCHours()).padStart(2, '0')}:${String(kst.getUTCMinutes()).padStart(2, '0')}`
              const primaryModule = e.modules?.[0]
              const dotColor = primaryModule ? MODULE_BG[primaryModule] || 'bg-gray-300' : 'bg-gray-300'

              return (
                <div key={e.id} className="flex items-start gap-3 group">
                  {/* 시간 */}
                  <span className="text-xs text-gray-400 w-12 shrink-0 pt-1 text-right">{timeStr}</span>

                  {/* 점 */}
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${dotColor} ring-2 ring-white`} />

                  {/* 카드 */}
                  <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-2 group">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-gray-800 leading-snug">{e.summary || e.raw_text}</p>
                      <button
                        onClick={() => setEditEvent(e)}
                        className="text-gray-300 hover:text-gray-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                      >
                        ✏️
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(e.modules || []).map(m => (
                        <span key={m} className={`text-xs px-1.5 py-0 rounded-full font-medium ${MODULE_COLORS[m] || 'bg-gray-100 text-gray-600'}`}>{m}</span>
                      ))}
                      {e.duration_minutes && (
                        <span className="text-xs text-gray-400">{e.duration_minutes}분</span>
                      )}
                      {e.amount && e.amount > 0 && (
                        <span className="text-xs text-yellow-600">{e.amount.toLocaleString()}원</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
