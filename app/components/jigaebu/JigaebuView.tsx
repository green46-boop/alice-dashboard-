'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { toKST, dateRangeKST, formatKSTTime } from '@/lib/utils'

interface CalendarEvent {
  id: string
  raw_title: string
  category: string
  category_label: string
  subcategory: string | null
  summary: string | null
  started_at: string
  ended_at: string
  duration_minutes: number
  location: string | null
  needs_review: boolean
}

const CATEGORY_STYLE: Record<string, { bg: string; text: string; bar: string }> = {
  sleep:         { bg: 'bg-indigo-50',  text: 'text-indigo-700',  bar: 'bg-indigo-400' },
  recharge:      { bg: 'bg-teal-50',    text: 'text-teal-700',    bar: 'bg-teal-400' },
  growth:        { bg: 'bg-amber-50',   text: 'text-amber-700',   bar: 'bg-amber-400' },
  side:          { bg: 'bg-purple-50',  text: 'text-purple-700',  bar: 'bg-purple-400' },
  work:          { bg: 'bg-blue-50',    text: 'text-blue-700',    bar: 'bg-blue-400' },
  life:          { bg: 'bg-gray-100',   text: 'text-gray-600',    bar: 'bg-gray-400' },
  exercise:      { bg: 'bg-green-50',   text: 'text-green-700',   bar: 'bg-green-400' },
  uncategorized: { bg: 'bg-red-50',     text: 'text-red-600',     bar: 'bg-red-300' },
}

const CATEGORY_ORDER = ['sleep', 'recharge', 'growth', 'side', 'work', 'life', 'exercise']
const CATEGORY_LABELS: Record<string, string> = {
  sleep: '수면', recharge: '충전', growth: '성장', side: '사이드',
  work: '업무', life: '일상', exercise: '운동',
}

const GROUPS = [
  { key: 'recovery',   label: '회복', cats: ['sleep', 'recharge'],          bg: 'bg-teal-50',   text: 'text-teal-700' },
  { key: 'investment', label: '투자', cats: ['growth', 'side', 'exercise'], bg: 'bg-purple-50', text: 'text-purple-700' },
  { key: 'obligation', label: '의무', cats: ['work', 'life'],               bg: 'bg-blue-50',   text: 'text-blue-700' },
]

function addDays(date: Date, n: number): Date {
  return new Date(date.getTime() + n * 24 * 60 * 60 * 1000)
}

function nowKST(): Date {
  return toKST(new Date())
}

function todayKSTDate(): Date {
  const k = nowKST()
  return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()))
}

function kstDateLabel(kstDate: Date): string {
  const y = kstDate.getUTCFullYear()
  const m = String(kstDate.getUTCMonth() + 1).padStart(2, '0')
  const d = String(kstDate.getUTCDate()).padStart(2, '0')
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${y}.${m}.${d} (${days[kstDate.getUTCDay()]})`
}

function weekRangeKST(): { start: string; end: string; label: string } {
  const today = todayKSTDate()
  const dow = today.getUTCDay()
  const monday = addDays(today, dow === 0 ? -6 : 1 - dow)
  const sunday = addDays(monday, 6)

  // UTC boundary: KST Monday 00:00 = UTC Sunday 15:00
  const start = new Date(monday.getTime() - 9 * 60 * 60 * 1000)
  // Up to end of today KST
  const { end } = dateRangeKST(today)

  const ml = `${monday.getUTCMonth() + 1}/${monday.getUTCDate()}`
  const sl = `${sunday.getUTCMonth() + 1}/${sunday.getUTCDate()}`
  return { start: start.toISOString(), end, label: `${ml} – ${sl}` }
}

function formatMins(mins: number): string {
  if (mins <= 0) return '-'
  if (mins < 60) return `${mins}분`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}

export default function JigaebuView() {
  const today = todayKSTDate()
  const yesterday = addDays(today, -1)

  const [weekMode, setWeekMode] = useState(false)
  const [selectedKST, setSelectedKST] = useState<Date>(yesterday)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    setLoading(true)
    let start: string, end: string
    if (weekMode) {
      const wr = weekRangeKST()
      start = wr.start
      end = wr.end
    } else {
      const dr = dateRangeKST(selectedKST)
      start = dr.start
      end = dr.end
    }

    supabase
      .from('calendar_events')
      .select('id, raw_title, category, category_label, subcategory, summary, started_at, ended_at, duration_minutes, location, needs_review')
      .gte('started_at', start)
      .lt('started_at', end)
      .order('started_at', { ascending: true })
      .then(({ data }) => {
        setEvents((data as CalendarEvent[]) || [])
        setLoading(false)
      })
  }, [selectedKST, weekMode])

  const catMins = CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = events.filter(e => e.category === cat).reduce((s, e) => s + e.duration_minutes, 0)
    return acc
  }, {} as Record<string, number>)

  const maxMins = Math.max(...Object.values(catMins), 1)
  const needsReviewCount = events.filter(e => e.needs_review).length
  const isYesterday = selectedKST.getTime() === yesterday.getTime()
  const isTodayOrFuture = selectedKST.getTime() >= today.getTime()
  const wr = weekRangeKST()

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1">
          {!weekMode && (
            <>
              <button
                onClick={() => setSelectedKST(d => addDays(d, -1))}
                className="text-gray-400 hover:text-gray-600 text-xl px-1.5"
              >‹</button>
              <span className="text-sm font-medium text-gray-700 min-w-40 text-center">
                {kstDateLabel(selectedKST)}
                {isYesterday && <span className="text-xs text-gray-400 ml-1.5">어제</span>}
              </span>
              <button
                onClick={() => setSelectedKST(d => addDays(d, 1))}
                disabled={isTodayOrFuture}
                className="text-gray-400 hover:text-gray-600 text-xl px-1.5 disabled:opacity-30"
              >›</button>
            </>
          )}
          {weekMode && (
            <span className="text-sm font-medium text-gray-700">{wr.label} 이번 주</span>
          )}
        </div>
        <button
          onClick={() => setWeekMode(v => !v)}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
            weekMode ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          이번 주
        </button>
      </div>

      {loading && <p className="text-sm text-gray-400">불러오는 중...</p>}

      {!loading && events.length === 0 && (
        <div className="text-center py-16">
          <p className="text-sm text-gray-400">캘린더 데이터가 없습니다</p>
          <p className="text-xs text-gray-300 mt-1">Google Apps Script를 실행해 동기화하세요</p>
        </div>
      )}

      {!loading && events.length > 0 && (
        <div className="space-y-5">
          {/* 회복 / 투자 / 의무 */}
          <div className="grid grid-cols-3 gap-2">
            {GROUPS.map(g => {
              const mins = g.cats.reduce((s, c) => s + (catMins[c] || 0), 0)
              return (
                <div key={g.key} className={`${g.bg} rounded-2xl px-3 py-3 text-center`}>
                  <p className={`text-xs font-semibold ${g.text} mb-0.5`}>{g.label}</p>
                  <p className="text-sm font-bold text-gray-800">{formatMins(mins)}</p>
                </div>
              )
            })}
          </div>

          {/* 카테고리별 막대 */}
          <div className="space-y-2.5">
            {CATEGORY_ORDER.filter(cat => catMins[cat] > 0).map(cat => {
              const style = CATEGORY_STYLE[cat]
              const pct = Math.round((catMins[cat] / maxMins) * 100)
              return (
                <div key={cat} className="flex items-center gap-2.5">
                  <span className="text-xs text-gray-500 w-10 shrink-0 text-right">{CATEGORY_LABELS[cat]}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className={`${style.bar} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-16 shrink-0">{formatMins(catMins[cat])}</span>
                </div>
              )
            })}
          </div>

          {/* 타임라인 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">타임라인</p>
            <div className="relative">
              <div className="absolute left-14 top-0 bottom-0 w-px bg-gray-100" />
              <div className="space-y-2.5">
                {events.map(e => {
                  const style = CATEGORY_STYLE[e.category] || CATEGORY_STYLE.uncategorized
                  const label = e.category_label
                  return (
                    <div key={e.id} className="flex items-start gap-3">
                      <span className="text-xs text-gray-400 w-12 shrink-0 pt-1.5 text-right">
                        {formatKSTTime(e.started_at)}
                      </span>
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${style.bar} ring-2 ring-white`} />
                      <div className="flex-1 min-w-0 pb-0.5">
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                            {label}
                          </span>
                          {e.subcategory && (
                            <span className="text-xs text-gray-500">{e.subcategory}</span>
                          )}
                          {e.summary && (
                            <span className="text-sm text-gray-800">{e.summary}</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 mt-0.5 block">{formatMins(e.duration_minutes)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 미분류 경고 */}
          {needsReviewCount > 0 && (
            <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
              <p className="text-sm text-orange-700 font-medium">⚠ 미분류 항목 {needsReviewCount}개</p>
              <p className="text-xs text-orange-500 mt-0.5">캘린더에서 [대분류] 형식으로 수정하고 재동기화하세요</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
