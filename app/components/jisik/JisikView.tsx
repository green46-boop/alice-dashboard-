'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { MODULE_COLORS } from '@/lib/constants'
import { formatKSTDate } from '@/lib/utils'
import FolderView from './FolderView'
import type { Folder } from './FolderPicker'

interface Event {
  id: string
  created_at: string
  raw_text: string
  summary: string | null
  modules: string[] | null
}

interface FolderWithCount extends Folder {
  count: number
}

export default function JisikView() {
  const [reminders, setReminders] = useState<Event[]>([])
  const [folders, setFolders] = useState<FolderWithCount[]>([])
  const [unclassifiedCount, setUnclassifiedCount] = useState(0)
  const [favoriteCount, setFavoriteCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [openFolder, setOpenFolder] = useState<{ key: string; label: string } | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewInput, setShowNewInput] = useState(false)
  const newInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const loadData = async () => {
    const [reminderRes, folderRes, assignedRes, allKnowledgeRes, favoriteRes] = await Promise.all([
      supabase
        .from('events')
        .select('id, created_at, raw_text, summary, modules')
        .eq('is_deleted', false)
        .contains('modules', ['knowledge'])
        .order('created_at', { ascending: true })
        .limit(100),
      supabase.from('folders').select('id, name').order('created_at'),
      supabase.from('event_folders').select('event_id, folder_id'),
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('is_deleted', false).contains('modules', ['knowledge']),
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('is_deleted', false).eq('is_favorite', true),
    ])

    // 리마인드: knowledge 이벤트 중 2개 랜덤
    const pool = reminderRes.data || []
    setReminders([...pool].sort(() => Math.random() - 0.5).slice(0, 2))

    // 폴더별 카운트 계산
    const assigned = assignedRes.data || []
    const assignedEventIds = new Set(assigned.map(r => r.event_id))
    const totalKnowledge = allKnowledgeRes.count || 0
    setUnclassifiedCount(totalKnowledge - assignedEventIds.size)

    const folderList = folderRes.data || []
    const folderCounts: FolderWithCount[] = folderList.map(f => ({
      ...f,
      count: assigned.filter(r => r.folder_id === f.id).length,
    }))
    setFolders(folderCounts)
    setFavoriteCount(favoriteRes.count || 0)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (showNewInput) newInputRef.current?.focus()
  }, [showNewInput])

  const createFolder = async () => {
    const name = newFolderName.trim()
    if (!name) return
    const { error } = await supabase.from('folders').insert({ name })
    if (error) {
      alert(`폴더 생성 실패: ${error.message}`)
      return
    }
    setNewFolderName('')
    setShowNewInput(false)
    loadData()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') createFolder()
    if (e.key === 'Escape') { setShowNewInput(false); setNewFolderName('') }
  }

  const handleFolderUpdated = () => { loadData() }

  if (openFolder) {
    return (
      <FolderView
        folderKey={openFolder.key}
        folderLabel={openFolder.label}
        allFolders={folders}
        onBack={() => { setOpenFolder(null); loadData() }}
        onFolderRenamed={handleFolderUpdated}
      />
    )
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">불러오는 중...</div>

  return (
    <div className="p-6 max-w-2xl space-y-6">
      {/* 리마인드 위젯 */}
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
            <p className="text-xs font-semibold text-gray-400 mb-2">💡 리마인드</p>
            {reminders[i] ? (
              <div>
                <p className="text-xs text-gray-800 leading-relaxed line-clamp-3">
                  {reminders[i].summary || reminders[i].raw_text}
                </p>
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {(reminders[i].modules || []).slice(0, 2).map(m => (
                    <span key={m} className={`text-xs px-1.5 rounded-full font-medium ${MODULE_COLORS[m] || 'bg-gray-100 text-gray-600'}`}>{m}</span>
                  ))}
                  <span className="text-xs text-gray-400">{formatKSTDate(reminders[i].created_at)}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400">없음</p>
            )}
          </div>
        ))}
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
          {/* 즐겨찾기 */}
          <FolderRow
            icon="⭐"
            label="즐겨찾기"
            count={favoriteCount}
            onClick={() => setOpenFolder({ key: 'favorite', label: '⭐ 즐겨찾기' })}
          />

          {/* 미분류 */}
          <FolderRow
            icon="📥"
            label="미분류"
            count={unclassifiedCount}
            onClick={() => setOpenFolder({ key: 'unclassified', label: '📥 미분류' })}
            highlight
          />

          {/* 사용자 폴더 */}
          {folders.map(f => (
            <FolderRow
              key={f.id}
              icon="📁"
              label={f.name}
              count={f.count}
              onClick={() => setOpenFolder({ key: f.id, label: f.name })}
            />
          ))}

          {/* 새 폴더 입력 */}
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
              <button onClick={createFolder} className="text-xs text-blue-500 hover:text-blue-700 shrink-0">저장</button>
              <button onClick={() => { setShowNewInput(false); setNewFolderName('') }} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">취소</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FolderRow({ icon, label, count, onClick, highlight }: {
  icon: string
  label: string
  count: number
  onClick: () => void
  highlight?: boolean
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
