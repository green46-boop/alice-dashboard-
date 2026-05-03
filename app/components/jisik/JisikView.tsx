'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { MODULE_COLORS } from '@/lib/constants'
import { formatKSTDate } from '@/lib/utils'
import FolderView from './FolderView'
import type { Folder } from './FolderPicker'
import { type FullEvent } from '../shared/EventModal'
import EventViewModal from '../shared/EventViewModal'

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
  og_image: string | null
  og_title: string | null
  tags: string[] | null
  color: string | null
  article_body: string | null
  last_reminded_at: string | null
}

interface FolderWithCount extends Folder {
  count: number
}

function pickReminders(pool: Event[]): Event[] {
  // null 먼저, 그다음 오래된 순 정렬
  const sorted = [...pool].sort((a, b) => {
    if (!a.last_reminded_at && !b.last_reminded_at) return 0
    if (!a.last_reminded_at) return -1
    if (!b.last_reminded_at) return 1
    return new Date(a.last_reminded_at).getTime() - new Date(b.last_reminded_at).getTime()
  })
  // 상위 20개 풀에서 2개 랜덤 선택
  const topPool = sorted.slice(0, 20)
  const shuffled = [...topPool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 2)
}

export default function JisikView() {
  const [reminders, setReminders] = useState<Event[]>([])
  const [folders, setFolders] = useState<FolderWithCount[]>([])
  const [unclassifiedCount, setUnclassifiedCount] = useState(0)
  const [favoriteCount, setFavoriteCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [openFolder, setOpenFolder] = useState<{ key: string; label: string } | null>(null)
  const [editEvent, setEditEvent] = useState<Event | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewInput, setShowNewInput] = useState(false)
  const [creating, setCreating] = useState(false)
  const [reminderPool, setReminderPool] = useState<Event[]>([])
  const newInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const markAsReminded = async (items: Event[]) => {
    if (items.length === 0) return
    const now = new Date().toISOString()
    await supabase
      .from('events')
      .update({ last_reminded_at: now })
      .in('id', items.map(e => e.id))
    // 로컬 상태도 업데이트
    setReminderPool(prev =>
      prev.map(e => items.find(r => r.id === e.id) ? { ...e, last_reminded_at: now } : e)
    )
  }

  const loadData = async () => {
    const [reminderRes, folderRes, assignedRes, allKnowledgeRes, favoriteRes] = await Promise.all([
      supabase
        .from('events')
        .select('id, created_at, raw_text, summary, modules, content_type, status, duration_minutes, amount, is_favorite, og_image, og_title, tags, color, article_body, last_reminded_at')
        .eq('is_deleted', false)
        .contains('modules', ['knowledge'])
        .order('last_reminded_at', { ascending: true, nullsFirst: true })
        .limit(200),
      supabase.from('folders').select('id, name').order('created_at'),
      supabase.from('event_folders').select('event_id, folder_id'),
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('is_deleted', false).contains('modules', ['knowledge']),
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('is_deleted', false).eq('is_favorite', true),
    ])

    const pool = reminderRes.data || []
    setReminderPool(pool)
    const picked = pickReminders(pool)
    setReminders(picked)
    markAsReminded(picked)

    const assigned = assignedRes.data || []
    const assignedEventIds = new Set(assigned.map(r => r.event_id))
    const totalKnowledge = allKnowledgeRes.count || 0
    setUnclassifiedCount(totalKnowledge - assignedEventIds.size)

    const folderList = folderRes.data || []
    setFolders(folderList.map(f => ({
      ...f,
      count: assigned.filter(r => r.folder_id === f.id).length,
    })))
    setFavoriteCount(favoriteRes.count || 0)
    setLoading(false)
  }

  const refreshReminders = () => {
    const picked = pickReminders(reminderPool)
    setReminders(picked)
    markAsReminded(picked)
  }

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (showNewInput) newInputRef.current?.focus()
  }, [showNewInput])

  const createFolder = async () => {
    if (creating) return
    const name = newFolderName.trim()
    if (!name) return
    setCreating(true)
    const { error } = await supabase.from('folders').insert({ name })
    setCreating(false)
    if (error) {
      alert(`폴더 생성 실패: ${error.message}`)
      return
    }
    setNewFolderName('')
    setShowNewInput(false)
    loadData()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); createFolder() }
    if (e.key === 'Escape') { setShowNewInput(false); setNewFolderName('') }
  }

  if (openFolder) {
    return (
      <FolderView
        folderKey={openFolder.key}
        folderLabel={openFolder.label}
        allFolders={folders}
        onBack={() => { setOpenFolder(null); loadData() }}
        onFolderRenamed={loadData}
      />
    )
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">불러오는 중...</div>

  return (
    <>
    {editEvent && (
      <EventViewModal
        event={editEvent as FullEvent}
        onClose={() => setEditEvent(null)}
        onSaved={() => { setEditEvent(null); loadData() }}
      />
    )}
    <div className="p-6 max-w-2xl space-y-6">
      {/* 리마인드 위젯 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">💡 리마인드</h2>
          <button
            onClick={refreshReminders}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            다른 거 보기 ↺
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map(i => {
            const r = reminders[i]
            const title = r?.summary || null
            const body = r?.raw_text || ''
            const showBody = !title || (title && body && !body.startsWith('http') && body !== title)
            return (
              <div
                key={i}
                onClick={() => r && setEditEvent(r)}
                className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[100px] ${r ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
              >
                {r ? (
                  <>
                    {r.og_image && (
                      <div className="w-full h-24 overflow-hidden">
                        <img src={r.og_image} alt="" className="w-full h-full object-cover"
                          onError={ev => { (ev.target as HTMLImageElement).style.display = 'none' }} />
                      </div>
                    )}
                    <div className="p-3">
                      {title && (
                        <p className="text-xs font-semibold text-gray-800 leading-snug line-clamp-2 mb-1">{title}</p>
                      )}
                      {showBody && (
                        <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">{body}</p>
                      )}
                      <div className="flex gap-1 mt-2 flex-wrap items-center">
                        {(r.modules || []).slice(0, 2).map(m => (
                          <span key={m} className={`text-[10px] px-1.5 rounded-full font-medium ${MODULE_COLORS[m] || 'bg-gray-100 text-gray-600'}`}>{m}</span>
                        ))}
                        <span className="text-[10px] text-gray-300">{formatKSTDate(r.created_at)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-3 flex items-center justify-center h-full">
                    <p className="text-xs text-gray-300">없음</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 폴더 섹션 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">폴더</h2>
          <button
            onClick={() => setShowNewInput(true)}
            className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
          >
            + 폴더 만들기
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <FolderRow icon="⭐" label="즐겨찾기" count={favoriteCount}
            onClick={() => setOpenFolder({ key: 'favorite', label: '⭐ 즐겨찾기' })} />
          <FolderRow icon="📥" label="미분류" count={unclassifiedCount} highlight
            onClick={() => setOpenFolder({ key: 'unclassified', label: '📥 미분류' })} />
          {folders.map(f => (
            <FolderRow key={f.id} icon="📁" label={f.name} count={f.count}
              onClick={() => setOpenFolder({ key: f.id, label: f.name })} />
          ))}

          {showNewInput && (
            <div className="flex items-center gap-2 px-4 py-2.5 border-t border-gray-50">
              <span className="text-sm">📁</span>
              <input
                ref={newInputRef}
                type="text"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="폴더 이름..."
                className="flex-1 text-sm text-gray-700 focus:outline-none"
              />
              <button type="button" onClick={createFolder} className="text-xs text-blue-500 hover:text-blue-700 shrink-0">저장</button>
              <button type="button" onClick={() => { setShowNewInput(false); setNewFolderName('') }} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">취소</button>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  )
}

function FolderRow({ icon, label, count, onClick, highlight }: {
  icon: string; label: string; count: number; onClick: () => void; highlight?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0"
    >
      <div className="flex items-center gap-2.5">
        <span className="text-sm">{icon}</span>
        <span className={`text-sm ${highlight ? 'text-blue-600 font-medium' : 'text-gray-700'}`}>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">{count}</span>
        <span className="text-gray-300 text-sm">›</span>
      </div>
    </button>
  )
}
