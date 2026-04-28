'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export interface FullEvent {
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

interface Props {
  event?: FullEvent | null  // null = 새 기록 모드
  onClose: () => void
  onSaved: (event: FullEvent) => void
  onDeleted?: (id: string) => void
}

const ALL_MODULES = ['knowledge', 'health', 'time', 'finance', 'sns']
const CONTENT_TYPES = ['', 'link', 'pdf', 'book', 'note', 'exercise', 'meal', 'expense']
const STATUSES = ['unread', 'in_progress', 'done']

export default function EventModal({ event, onClose, onSaved, onDeleted }: Props) {
  const isNew = !event
  const [rawText, setRawText] = useState(event?.raw_text ?? '')
  const [summary, setSummary] = useState(event?.summary ?? '')
  const [modules, setModules] = useState<string[]>(event?.modules ?? [])
  const [contentType, setContentType] = useState(event?.content_type ?? '')
  const [status, setStatus] = useState(event?.status ?? 'done')
  const [durationMins, setDurationMins] = useState(String(event?.duration_minutes ?? ''))
  const [amount, setAmount] = useState(String(event?.amount ?? ''))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()

  // ESC로 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const toggleModule = (m: string) => {
    setModules(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  const handleSave = async () => {
    if (!rawText.trim()) return
    setSaving(true)

    const payload = {
      raw_text: rawText.trim(),
      summary: summary.trim() || null,
      modules: modules.length > 0 ? modules : null,
      content_type: contentType || null,
      status,
      duration_minutes: durationMins ? Number(durationMins) : null,
      amount: amount ? Number(amount) : null,
      is_manually_edited: true,
    }

    if (isNew) {
      const { data, error } = await supabase.from('events').insert(payload).select().single()
      if (error) { alert(`저장 실패: ${error.message}`); setSaving(false); return }
      if (data) onSaved(data as FullEvent)
    } else {
      const { data, error } = await supabase
        .from('events').update(payload).eq('id', event!.id).select().single()
      if (error) { alert(`저장 실패: ${error.message}`); setSaving(false); return }
      if (data) onSaved(data as FullEvent)
    }
    setSaving(false)
    onClose()
  }

  const handleDelete = async () => {
    if (!event || !confirm('삭제하시겠습니까?')) return
    setDeleting(true)
    const { error } = await supabase.from('events').update({ is_deleted: true }).eq('id', event.id)
    if (error) { alert(`삭제 실패: ${error.message}`); setDeleting(false); return }
    onDeleted?.(event.id)
    setDeleting(false)
    onClose()
  }

  const MODULE_COLORS: Record<string, string> = {
    knowledge: 'bg-blue-100 text-blue-700 border-blue-200',
    health: 'bg-green-100 text-green-700 border-green-200',
    time: 'bg-purple-100 text-purple-700 border-purple-200',
    finance: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    sns: 'bg-pink-100 text-pink-700 border-pink-200',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">
            {isNew ? '새 기록 추가' : '기록 수정'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        {/* 폼 */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* 내용 */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">내용 *</label>
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              rows={3}
              placeholder="기록 내용을 입력하세요"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
            />
          </div>

          {/* 요약 */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">요약 (선택)</label>
            <input
              type="text"
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="짧은 요약"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {/* 모듈 */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">모듈</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_MODULES.map(m => (
                <button
                  key={m}
                  onClick={() => toggleModule(m)}
                  className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                    modules.includes(m)
                      ? MODULE_COLORS[m]
                      : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* 두 열: 유형 + 상태 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">유형</label>
              <select
                value={contentType}
                onChange={e => setContentType(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
              >
                <option value="">없음</option>
                {CONTENT_TYPES.filter(Boolean).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">상태</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
              >
                {STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 두 열: 운동 시간 + 금액 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">운동 시간 (분)</label>
              <input
                type="number"
                value={durationMins}
                onChange={e => setDurationMins(e.target.value)}
                placeholder="0"
                min={0}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">금액 (원)</label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                min={0}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>

          {!isNew && event && (
            <p className="text-xs text-gray-400">
              저장일: {new Date(event.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
            </p>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
          {!isNew ? (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
            >
              {deleting ? '삭제 중...' : '삭제'}
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !rawText.trim()}
              className="px-4 py-2 text-sm bg-gray-900 text-white rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
