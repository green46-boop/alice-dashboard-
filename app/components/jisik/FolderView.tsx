'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { MODULE_COLORS } from '@/lib/constants'
import { formatKSTDate, isURL } from '@/lib/utils'
import EventModal, { type FullEvent } from '../shared/EventModal'
import FolderPicker, { type Folder } from './FolderPicker'

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

interface Props {
  folderKey: string
  folderLabel: string
  allFolders: Folder[]
  onBack: () => void
  onFolderRenamed?: () => void
}

export default function FolderView({ folderKey, folderLabel, allFolders, onBack, onFolderRenamed }: Props) {
  const [events, setEvents] = useState<Event[]>([])
  const [assignmentMap, setAssignmentMap] = useState<Map<string, Set<string>>>(new Map())
  const [loading, setLoading] = useState(true)
  const [editEvent, setEditEvent] = useState<Event | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [folderName, setFolderName] = useState(
    allFolders.find(f => f.id === folderKey)?.name ?? folderLabel
  )
  const renameInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const isFavorite = folderKey === 'favorite'
  const isUnclassified = folderKey === 'unclassified'
  const isUserFolder = !isFavorite && !isUnclassified

  const loadEvents = async () => {
    setLoading(true)

    let eventIds: string[] = []
    let loadedEvents: Event[] = []

    if (isFavorite) {
      const { data } = await supabase
        .from('events')
        .select('id, created_at, raw_text, summary, modules, content_type, status, duration_minutes, amount, is_favorite')
        .eq('is_deleted', false)
        .eq('is_favorite', true)
        .order('created_at', { ascending: false })
      loadedEvents = data || []
    } else if (isUnclassified) {
      // knowledge 이벤트 중 어떤 폴더에도 속하지 않은 것
      const [knowledgeRes, assignedRes] = await Promise.all([
        supabase
          .from('events')
          .select('id, created_at, raw_text, summary, modules, content_type, status, duration_minutes, amount, is_favorite')
          .eq('is_deleted', false)
          .contains('modules', ['knowledge'])
          .order('created_at', { ascending: false }),
        supabase.from('event_folders').select('event_id'),
      ])
      const assignedSet = new Set((assignedRes.data || []).map(r => r.event_id))
      loadedEvents = (knowledgeRes.data || []).filter(e => !assignedSet.has(e.id))
    } else {
      // 사용자 폴더: event_folders에서 이 폴더에 속한 이벤트 가져오기
      const { data: efData } = await supabase
        .from('event_folders')
        .select('event_id')
        .eq('folder_id', folderKey)
      eventIds = (efData || []).map(r => r.event_id)
      if (eventIds.length > 0) {
        const { data } = await supabase
          .from('events')
          .select('id, created_at, raw_text, summary, modules, content_type, status, duration_minutes, amount, is_favorite')
          .eq('is_deleted', false)
          .in('id', eventIds)
          .order('created_at', { ascending: false })
        loadedEvents = data || []
      }
    }

    setEvents(loadedEvents)

    // 각 이벤트의 폴더 배정 로드 (picker에서 사용)
    if (loadedEvents.length > 0) {
      const ids = loadedEvents.map(e => e.id)
      const { data: efAll } = await supabase
        .from('event_folders')
        .select('event_id, folder_id')
        .in('event_id', ids)
      const map = new Map<string, Set<string>>()
      for (const e of loadedEvents) map.set(e.id, new Set())
      for (const row of efAll || []) {
        map.get(row.event_id)?.add(row.folder_id)
      }
      setAssignmentMap(map)
    }

    setLoading(false)
  }

  useEffect(() => { loadEvents() }, [folderKey])

  useEffect(() => {
    if (renaming) renameInputRef.current?.focus()
  }, [renaming])

  const toggleFavorite = async (id: string, current: boolean) => {
    await supabase.from('events').update({ is_favorite: !current }).eq('id', id)
    setEvents(prev => prev.map(e => e.id === id ? { ...e, is_favorite: !current } : e))
  }

  const handleFolderToggle = async (eventId: string, folderId: string, currentlyAssigned: boolean) => {
    if (currentlyAssigned) {
      await supabase.from('event_folders').delete().eq('event_id', eventId).eq('folder_id', folderId)
      setAssignmentMap(prev => {
        const next = new Map(prev)
        next.get(eventId)?.delete(folderId)
        return next
      })
      // 현재 폴더에서 제거되면 목록에서도 제거
      if (folderId === folderKey) {
        setEvents(prev => prev.filter(e => e.id !== eventId))
      }
    } else {
      await supabase.from('event_folders').insert({ event_id: eventId, folder_id: folderId })
      setAssignmentMap(prev => {
        const next = new Map(prev)
        next.get(eventId)?.add(folderId)
        return next
      })
      // 미분류에서 폴더로 이동하면 미분류 목록에서 제거
      if (isUnclassified) {
        setEvents(prev => prev.filter(e => e.id !== eventId))
      }
    }
  }

  const handleSaved = (updated: FullEvent) => {
    setEvents(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e))
  }

  const handleDeleted = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  const handleRename = async () => {
    const name = folderName.trim()
    if (!name || !isUserFolder) return
    await supabase.from('folders').update({ name }).eq('id', folderKey)
    setRenaming(false)
    onFolderRenamed?.()
  }

  const handleDeleteFolder = async () => {
    if (!isUserFolder || !confirm(`"${folderName}" 폴더를 삭제하시겠습니까? (항목은 삭제되지 않습니다)`)) return
    await supabase.from('folders').delete().eq('id', folderKey)
    onBack()
  }

  return (
    <div className="p-6 max-w-2xl">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-5">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 text-sm">← 뒤로</button>

        {renaming ? (
          <input
            ref={renameInputRef}
            value={folderName}
            onChange={e => setFolderName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false) }}
            className="text-base font-semibold text-gray-800 focus:outline-none border-b border-blue-400"
          />
        ) : (
          <h2
            className={`text-base font-semibold text-gray-800 ${isUserFolder ? 'cursor-pointer hover:text-blue-600' : ''}`}
            onClick={() => isUserFolder && setRenaming(true)}
            title={isUserFolder ? '클릭해서 이름 변경' : undefined}
          >
            {folderLabel}
          </h2>
        )}

        <span className="text-xs text-gray-400">{events.length}개</span>

        {isUserFolder && (
          <button onClick={handleDeleteFolder} className="ml-auto text-xs text-red-400 hover:text-red-600">
            폴더 삭제
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-gray-400">불러오는 중...</p>}
      {!loading && events.length === 0 && (
        <p className="text-sm text-gray-400 py-8 text-center">항목이 없습니다</p>
      )}

      <div className="space-y-2">
        {events.map(e => {
          const text = e.summary || e.raw_text
          const url = isURL(e.raw_text) ? e.raw_text : null
          const assignedIds = assignmentMap.get(e.id) ?? new Set<string>()
          const userFolders = allFolders.filter(f => f.id !== folderKey)

          return (
            <div key={e.id} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 group">
              <div className="flex items-start gap-2">
                {/* 즐겨찾기 토글 */}
                <button
                  onClick={() => toggleFavorite(e.id, e.is_favorite)}
                  className="text-sm shrink-0 mt-0.5"
                >
                  {e.is_favorite ? '⭐' : '☆'}
                </button>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 leading-snug">{text}</p>
                  {url && url !== text && (
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline truncate block mt-0.5">
                      {url}
                    </a>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1.5 items-center">
                    <span className="text-xs text-gray-400">{formatKSTDate(e.created_at)}</span>
                    {(e.modules || []).map(m => (
                      <span key={m} className={`text-xs px-1.5 py-0 rounded-full font-medium ${MODULE_COLORS[m] || 'bg-gray-100 text-gray-600'}`}>{m}</span>
                    ))}
                    {e.status && <span className="text-xs text-gray-400">{e.status}</span>}
                  </div>
                </div>

                {/* 액션 버튼들 */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* 폴더 배정 피커 (사용자 폴더가 있을 때만) */}
                  {userFolders.length > 0 && (
                    <FolderPicker
                      eventId={e.id}
                      folders={userFolders}
                      assignedIds={assignedIds}
                      onToggle={(folderId, currentlyAssigned) =>
                        handleFolderToggle(e.id, folderId, currentlyAssigned)
                      }
                    />
                  )}
                  <button
                    onClick={() => setEditEvent(e)}
                    className="text-gray-300 hover:text-gray-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ✏️
                  </button>
                </div>
              </div>
            </div>
          )
        })}
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
