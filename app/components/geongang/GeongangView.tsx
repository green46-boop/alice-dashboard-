'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { toKST, formatKSTDate } from '@/lib/utils'
import EventViewModal from '../shared/EventViewModal'
import { type FullEvent } from '../shared/EventModal'

interface HealthEvent {
  id: string
  created_at: string
  recorded_date: string | null
  raw_text: string
  summary: string | null
  modules: string[] | null
  content_type: string | null
  status: string | null
  duration_minutes: number | null
  is_favorite: boolean
  og_image: string | null
  og_title: string | null
  tags: string[] | null
  color: string | null
  weight_kg: number | null
  waist_cm: number | null
  sleep_score: number | null
  sleep_hours: number | null
  condition_score: number | null
  exercise_done: boolean | null
  exercise_intensity: number | null
  exercise_type: string | null
  steps: number | null
}

const SELECT = [
  'id', 'created_at', 'recorded_date', 'raw_text', 'summary', 'modules',
  'content_type', 'status', 'duration_minutes', 'is_favorite',
  'og_image', 'og_title', 'tags', 'color',
  'weight_kg', 'waist_cm', 'sleep_score', 'sleep_hours', 'condition_score',
  'exercise_done', 'exercise_intensity', 'exercise_type', 'steps',
].join(', ')

function kstDateStr(d: Date): string {
  const k = toKST(d)
  return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, '0')}-${String(k.getUTCDate()).padStart(2, '0')}`
}

function getEventDate(e: HealthEvent): string {
  return e.recorded_date ?? kstDateStr(new Date(e.created_at))
}

function avg(arr: number[]): number | null {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
}

function r1(n: number | null, unit = ''): string {
  return n === null ? '-' : n.toFixed(1) + unit
}

function SparkLine({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const W = 200, H = 40, P = 3
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => [
    P + (i / (data.length - 1)) * (W - P * 2),
    P + (1 - (v - min) / range) * (H - P * 2),
  ])
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const [lx, ly] = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: H }}>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="3" fill={color} />
    </svg>
  )
}

function StatCard({ label, value, change, changeDown, sub }: {
  label: string; value: string; change?: string | null; changeDown?: boolean; sub?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
      <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <p className="text-lg font-semibold text-gray-800 leading-tight">{value}</p>
        {change && (
          <span className={`text-xs font-medium ${changeDown ? 'text-green-500' : 'text-red-400'}`}>
            {change}
          </span>
        )}
      </div>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function ChartCard({ label, unit, data, color, latest }: {
  label: string; unit: string; data: number[]; color: string; latest: number
}) {
  const displayLatest = unit === 'kg' || unit === 'h'
    ? latest.toFixed(1)
    : Math.round(latest).toLocaleString()
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-gray-400">{label}</span>
        <span className="text-sm font-semibold text-gray-800">{displayLatest}{unit}</span>
      </div>
      <SparkLine data={data} color={color} />
    </div>
  )
}

function HealthRow({ event, onClick }: { event: HealthEvent; onClick: () => void }) {
  const parts: string[] = []
  if (event.weight_kg !== null) parts.push(`${event.weight_kg}kg`)
  if (event.waist_cm !== null) parts.push(`허리 ${event.waist_cm}cm`)
  if (event.sleep_score !== null) parts.push(`수면 ${event.sleep_score}점`)
  else if (event.sleep_hours !== null) parts.push(`수면 ${event.sleep_hours}h`)
  if (event.condition_score !== null) parts.push(`컨디션 ${event.condition_score}/5`)
  if (event.exercise_done === true) {
    const exStr = `운동${event.duration_minutes ? ` ${event.duration_minutes}분` : ''}${event.exercise_type ? ` (${event.exercise_type})` : ''}`
    parts.push(exStr)
  } else if (event.exercise_done === false) {
    parts.push('운동 안함')
  }
  if (event.steps !== null) parts.push(`${event.steps.toLocaleString()}보`)

  const displayText = parts.length > 0 ? parts.join(' · ') : (event.summary || event.raw_text)
  const dateStr = getEventDate(event)

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 text-left hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-gray-700 leading-snug">{displayText}</p>
        <span className="text-[10px] text-gray-400 shrink-0 pt-0.5">{dateStr.slice(5).replace('-', '/')}</span>
      </div>
    </button>
  )
}

export default function GeongangView() {
  const [events, setEvents] = useState<HealthEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [viewEvent, setViewEvent] = useState<HealthEvent | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    supabase
      .from('events')
      .select(SELECT)
      .eq('is_deleted', false)
      .contains('modules', ['health'])
      .gte('created_at', thirtyAgo)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setEvents(data || [])
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="p-6 text-sm text-gray-400">불러오는 중...</div>

  if (events.length === 0) {
    return (
      <div className="p-6 text-sm text-gray-400 text-center py-16">
        건강 데이터가 없습니다<br />
        <span className="text-xs mt-1 block">텔레그램에서 "체중 65.8 수면 78 컨디션 3"을 입력해보세요</span>
      </div>
    )
  }

  const sevenDaysAgo = kstDateStr(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000))
  const last7 = events.filter(e => getEventDate(e) >= sevenDaysAgo)
  const chron = [...events].sort((a, b) => getEventDate(a).localeCompare(getEventDate(b)))

  // 7일 통계
  const wEntries = last7.filter(e => e.weight_kg !== null)
    .sort((a, b) => getEventDate(a).localeCompare(getEventDate(b)))
  const avgWeight = avg(wEntries.map(e => e.weight_kg!))
  const weightChange = wEntries.length >= 2
    ? wEntries[wEntries.length - 1].weight_kg! - wEntries[0].weight_kg!
    : null

  const avgWaist = avg(last7.filter(e => e.waist_cm !== null).map(e => e.waist_cm!))
  const avgSleepScore = avg(last7.filter(e => e.sleep_score !== null).map(e => e.sleep_score!))
  const avgSleepHours = avg(last7.filter(e => e.sleep_hours !== null).map(e => e.sleep_hours!))
  const avgCondition = avg(last7.filter(e => e.condition_score !== null).map(e => e.condition_score!))
  const exerciseDays7 = last7.filter(e => e.exercise_done === true)
  const avgExMins = avg(exerciseDays7.filter(e => e.duration_minutes !== null).map(e => e.duration_minutes!))
  const avgSteps = avg(last7.filter(e => e.steps !== null).map(e => e.steps!))

  // 30일 차트 데이터
  const weightData = chron.filter(e => e.weight_kg !== null).map(e => e.weight_kg!)
  const sleepScoreData = chron.filter(e => e.sleep_score !== null).map(e => e.sleep_score!)
  const sleepHoursData = chron.filter(e => e.sleep_hours !== null).map(e => e.sleep_hours!)
  const conditionData = chron.filter(e => e.condition_score !== null).map(e => e.condition_score!)
  const stepsData = chron.filter(e => e.steps !== null).map(e => e.steps!)

  // 주간 운동 횟수 (최근 4주, 오래된 순)
  const weeklyExercise = Array.from({ length: 4 }, (_, w) => {
    const endMs = Date.now() - w * 7 * 24 * 60 * 60 * 1000
    const startMs = endMs - 7 * 24 * 60 * 60 * 1000
    const endStr = kstDateStr(new Date(endMs))
    const startStr = kstDateStr(new Date(startMs))
    return events.filter(e => {
      const d = getEventDate(e)
      return d > startStr && d <= endStr && e.exercise_done === true
    }).length
  }).reverse()

  // 팩트 인사이트
  const insights: string[] = []
  const exOnDays = events.filter(e => e.exercise_done === true)
  const exOffDays = events.filter(e => e.exercise_done === false)
  const condOn = avg(exOnDays.filter(e => e.condition_score !== null).map(e => e.condition_score!))
  const condOff = avg(exOffDays.filter(e => e.condition_score !== null).map(e => e.condition_score!))
  if (condOn !== null && condOff !== null && exOnDays.length >= 2 && exOffDays.length >= 2) {
    insights.push(`운동한 날 평균 컨디션 ${condOn.toFixed(1)} · 안 한 날 ${condOff.toFixed(1)}`)
  }
  if (avgSteps !== null) {
    insights.push(`최근 3일 평균 걸음수 ${Math.round(avgSteps).toLocaleString()}보`)
  }
  const lowSleep = last7.filter(e => e.sleep_score !== null && e.sleep_score < 70).length
  if (lowSleep > 0) {
    insights.push(`최근 3일 수면 점수 70 미만 ${lowSleep}일`)
  }

  const useSleepScore = sleepScoreData.length >= sleepHoursData.length
  const sleepData = useSleepScore ? sleepScoreData : sleepHoursData
  const sleepUnit = useSleepScore ? '점' : 'h'
  const hasCharts = weightData.length >= 2 || sleepData.length >= 2 || conditionData.length >= 2 || stepsData.length >= 2

  return (
    <div className="p-6 max-w-2xl space-y-6">

      {/* 7일 요약 */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">📊 최근 3일</h2>
        <div className="grid grid-cols-2 gap-2">
          {avgWeight !== null && (
            <StatCard
              label="체중"
              value={r1(avgWeight, 'kg')}
              change={weightChange !== null ? `${weightChange > 0 ? '+' : ''}${r1(weightChange)}` : null}
              changeDown={weightChange !== null && weightChange <= 0}
            />
          )}
          {avgWaist !== null && (
            <StatCard label="허리" value={r1(avgWaist, 'cm')} />
          )}
          {(avgSleepScore !== null || avgSleepHours !== null) && (
            <StatCard
              label="수면"
              value={avgSleepScore !== null ? `${Math.round(avgSleepScore)}점` : r1(avgSleepHours, 'h')}
            />
          )}
          {avgCondition !== null && (
            <StatCard label="컨디션" value={r1(avgCondition, '/5')} />
          )}
          {exerciseDays7.length > 0 && (
            <StatCard
              label="운동"
              value={`${exerciseDays7.length}회`}
              sub={avgExMins !== null ? `평균 ${Math.round(avgExMins)}분` : undefined}
            />
          )}
          {avgSteps !== null && (
            <StatCard label="걸음수" value={`${Math.round(avgSteps).toLocaleString()}보`} />
          )}
        </div>
      </div>

      {/* 30일 추세 */}
      {hasCharts && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">📈 30일 추세</h2>
          <div className="grid grid-cols-2 gap-2">
            {weightData.length >= 2 && (
              <ChartCard label="체중" unit="kg" data={weightData} color="#16a34a" latest={weightData[weightData.length - 1]} />
            )}
            {sleepData.length >= 2 && (
              <ChartCard label="수면" unit={sleepUnit} data={sleepData} color="#3b82f6" latest={sleepData[sleepData.length - 1]} />
            )}
            {conditionData.length >= 2 && (
              <ChartCard label="컨디션" unit="/5" data={conditionData} color="#a855f7" latest={conditionData[conditionData.length - 1]} />
            )}
            {stepsData.length >= 2 && (
              <ChartCard label="걸음수" unit="보" data={stepsData} color="#f97316" latest={stepsData[stepsData.length - 1]} />
            )}
          </div>

          <div className="mt-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">주간 운동</span>
              <span className="text-[10px] text-gray-400">최근 4주</span>
            </div>
            <div className="flex items-end gap-2 h-12">
              {weeklyExercise.map((count, i) => {
                const maxCount = Math.max(...weeklyExercise, 1)
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                    <div
                      className="w-full rounded-t-sm bg-teal-300"
                      style={{ height: `${count > 0 ? Math.max((count / maxCount) * 36, 4) : 0}px` }}
                    />
                    <span className="text-[9px] text-gray-400">{count > 0 ? `${count}회` : '-'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 팩트 인사이트 */}
      {insights.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">💡 인사이트</h2>
          <div className="space-y-1.5">
            {insights.map((text, i) => (
              <div key={i} className="bg-gray-50 rounded-xl px-3 py-2 text-xs text-gray-600">{text}</div>
            ))}
          </div>
        </div>
      )}

      {/* 기록 리스트 */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">기록</h2>
        <div className="space-y-2">
          {events.map(e => (
            <HealthRow key={e.id} event={e} onClick={() => setViewEvent(e)} />
          ))}
        </div>
      </div>

      {viewEvent && (
        <EventViewModal
          event={viewEvent as unknown as FullEvent}
          onClose={() => setViewEvent(null)}
          onSaved={() => setViewEvent(null)}
        />
      )}
    </div>
  )
}
