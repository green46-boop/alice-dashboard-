'use client'

import { useEffect, useState, useRef } from 'react'
import JSZip from 'jszip'
import { createClient } from '@/lib/supabase'
import { MODULE_COLORS } from '@/lib/constants'
import { formatKSTDate, isURL } from '@/lib/utils'
import EventModal, { type FullEvent } from '../shared/EventModal'
import EventViewModal from '../shared/EventViewModal'
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
  og_image: string | null
  og_title: string | null
  tags: string[] | null
  color: string | null
}

interface Props {
  folderKey: string
  folderLabel: string
  allFolders: Folder[]
  onBack: () => void
  onFolderRenamed?: () => void
}

const CONTENT_TYPE_FILTERS = [
  { value: '', label: '전체' },
  { value: 'link', label: '🔗 링크' },
  { value: 'note', label: '📝 노트' },
  { value: 'book', label: '📚 책' },
  { value: 'pdf', label: '📄 PDF' },
  { value: 'exercise', label: '🏃 운동' },
  { value: 'meal', label: '🍽 식사' },
  { value: 'expense', label: '💰 지출' },
]

function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#/, '').toLowerCase()
}

function makeSafeFilename(event: Event): string {
  const title = event.summary || event.og_title || event.id
  const safe = title
    .replace(/[/\\:*?"<>|#%]/g, '')
    .trim()
    .slice(0, 60)
  return `${safe}.md`
}

function generateMarkdown(event: Event, today: string): string {
  const url = isURL(event.raw_text) ? event.raw_text : null
  const title = event.summary || event.og_title || event.raw_text.slice(0, 50)
  const body = (url && event.raw_text === url) ? null
    : (!event.raw_text.startsWith('http') ? event.raw_text : null)
  const tags = event.tags ?? []

  const fm = tags.length > 0
    ? `---\ntags: [${tags.join(', ')}]\n---`
    : ''

  const parts: string[] = fm ? [fm, '', `# ${title}`, ''] : [`# ${title}`, '']

  if (url) {
    let domain = url
    try { domain = new URL(url).hostname.replace('www.', '') } catch {}
    parts.push('> [!info] 출처', `> [${domain}](${url})`, '')
  }

  if (body) {
    const mdBody = body.replace(/\n/g, '\n\n')
    parts.push('## 내용', '', mdBody, '')
  }

  if (tags.length > 0) {
    parts.push('---', '', tags.map(t => `#${t}`).join(' '), '')
  }

  const meta = [
    `> alice_id: ${event.id}`,
    `> source: alice`,
    `> content_type: ${event.content_type || 'note'}`,
    `> created_at: ${event.created_at.slice(0, 10)}`,
    `> updated_at: ${today}`,
    url ? `> url: ${url}` : null,
  ].filter(Boolean).join('\n')
  parts.push('> [!note]- Alice 메타데이터', meta)

  return parts.join('\n')
}

export default function FolderView({ folderKey, folderLabel, allFolders, onBack, onFolderRenamed }: Props) {
  const [events, setEvents] = useState<Event[]>([])
  const [assignmentMap, setAssignmentMap] = useState<Map<string, Set<string>>>(new Map())
  const [loading, setLoading] = useState(true)
  const [editEvent, setEditEvent] = useState<Event | null>(null)
  const [typeFilter, setTypeFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title'>('newest')
  const [renaming, setRenaming] = useState(false)
  const [folderName, setFolderName] = useState(
    allFolders.find(f => f.id === folderKey)?.name ?? folderLabel
  )
  const [tagInputOpen, setTagInputOpen] = useState<Record<string, boolean>>({})
  const [tagInputValue, setTagInputValue] = useState<Record<string, string>>({})
  const [exporting, setExporting] = useState(false)
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
        .select('id, created_at, raw_text, summary, modules, content_type, status, duration_minutes, amount, is_favorite, og_image, og_title, tags, color')
        .eq('is_deleted', false)
        .eq('is_favorite', true)
        .order('created_at', { ascending: false })
      loadedEvents = data || []
    } else if (isUnclassified) {
      const [knowledgeRes, assignedRes] = await Promise.all([
        supabase
          .from('events')
          .select('id, created_at, raw_text, summary, modules, content_type, status, duration_minutes, amount, is_favorite, og_image, og_title, tags, color')
          .eq('is_deleted', false)
          .contains('modules', ['knowledge'])
          .order('created_at', { ascending: false }),
        supabase.from('event_folders').select('event_id'),
      ])
      const assignedSet = new Set((assignedRes.data || []).map(r => r.event_id))
      loadedEvents = (knowledgeRes.data || []).filter(e => !assignedSet.has(e.id))
    } else {
      const { data: efData } = await supabase
        .from('event_folders')
        .select('event_id')
        .eq('folder_id', folderKey)
      eventIds = (efData || []).map(r => r.event_id)
      if (eventIds.length > 0) {
        const { data } = await supabase
          .from('events')
          .select('id, created_at, raw_text, summary, modules, content_type, status, duration_minutes, amount, is_favorite, og_image, og_title, tags, color')
          .eq('is_deleted', false)
          .in('id', eventIds)
          .order('created_at', { ascending: false })
        loadedEvents = data || []
      }
    }

    setEvents(loadedEvents)

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
      if (isUnclassified) {
        setEvents(prev => prev.filter(e => e.id !== eventId))
      }
    }
  }

  const handleAddTag = async (eventId: string) => {
    const raw = tagInputValue[eventId] || ''
    const tag = normalizeTag(raw)
    if (!tag) { setTagInputOpen(p => ({ ...p, [eventId]: false })); return }

    const event = events.find(e => e.id === eventId)
    if (!event) return
    const existing = event.tags ?? []
    if (existing.includes(tag)) {
      setTagInputOpen(p => ({ ...p, [eventId]: false }))
      setTagInputValue(p => ({ ...p, [eventId]: '' }))
      return
    }
    const newTags = [...existing, tag]
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, tags: newTags } : e))
    setTagInputOpen(p => ({ ...p, [eventId]: false }))
    setTagInputValue(p => ({ ...p, [eventId]: '' }))
    await supabase.from('events').update({ tags: newTags }).eq('id', eventId)
  }

  const handleRemoveTag = async (eventId: string, tag: string) => {
    const event = events.find(e => e.id === eventId)
    if (!event) return
    const newTags = (event.tags ?? []).filter(t => t !== tag)
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, tags: newTags } : e))
    await supabase.from('events').update({ tags: newTags }).eq('id', eventId)
  }

  const handleExportZip = async () => {
    setExporting(true)
    const today = new Date().toISOString().slice(0, 10)
    const zip = new JSZip()
    const folder = zip.folder('Alice_knowledge_export')!
    for (const event of events) {
      folder.file(makeSafeFilename(event), generateMarkdown(event, today))
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${folderLabel}_export.zip`
    a.click()
    URL.revokeObjectURL(a.href)
    setExporting(false)
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

        <div className="ml-auto flex items-center gap-2">
          {events.length > 0 && (
            <button
              onClick={handleExportZip}
              disabled={exporting}
              className="text-xs text-purple-500 hover:text-purple-700 disabled:opacity-50"
              title="Obsidian으로 내보내기"
            >
              {exporting ? '내보내는 중...' : '⟁ 내보내기'}
            </button>
          )}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as 'newest' | 'oldest' | 'title')}
            className="text-xs text-gray-400 bg-transparent focus:outline-none cursor-pointer hover:text-gray-600"
          >
            <option value="newest">최신순</option>
            <option value="oldest">오래된순</option>
            <option value="title">제목순</option>
          </select>
          {isUserFolder && (
            <button onClick={handleDeleteFolder} className="text-xs text-red-400 hover:text-red-600">
              폴더 삭제
            </button>
          )}
        </div>
      </div>

      {/* 타입 필터 바 */}
      {!loading && events.length > 0 && (() => {
        const allTags = Array.from(new Set(events.flatMap(e => e.tags ?? [])))
        return (
          <div className="mb-4 space-y-2">
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {CONTENT_TYPE_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setTypeFilter(f.value)}
                  className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    typeFilter === f.value
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {allTags.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setTagFilter(prev => prev === tag ? '' : tag)}
                    className={`shrink-0 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      tagFilter === tag
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {loading && <p className="text-sm text-gray-400">불러오는 중...</p>}
      {!loading && events.length === 0 && (
        <p className="text-sm text-gray-400 py-8 text-center">항목이 없습니다</p>
      )}

      <div className="columns-2 gap-3 space-y-0">
        {events
          .filter(e => !typeFilter || e.content_type === typeFilter)
          .filter(e => !tagFilter || (e.tags ?? []).includes(tagFilter))
          .sort((a, b) => {
            if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            if (sortBy === 'title') return (a.summary || a.raw_text).localeCompare(b.summary || b.raw_text, 'ko')
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          })
          .map(e => {
          const text = e.summary || e.raw_text
          const url = isURL(e.raw_text) ? e.raw_text : null
          const domain = url ? (() => { try { return new URL(url).hostname.replace('www.', '') } catch { return url } })() : null
          const assignedIds = assignmentMap.get(e.id) ?? new Set<string>()
          const userFolders = allFolders.filter(f => f.id !== folderKey)
          const isLink = !!url
          const accentColor: Record<string, string> = {
            red: '#f87171', orange: '#fb923c', yellow: '#facc15',
            green: '#4ade80', blue: '#60a5fa', purple: '#c084fc', pink: '#f472b6',
          }
          const borderColor = e.color ? accentColor[e.color] : undefined

          return (
            <div
              key={e.id}
              style={borderColor ? { borderLeftColor: borderColor, borderLeftWidth: 4 } : undefined}
              className={`break-inside-avoid mb-3 rounded-2xl border shadow-sm group cursor-pointer relative transition-shadow hover:shadow-md ${
                isLink
                  ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100'
                  : 'bg-white border-gray-100'
              }`}
              onClick={() => setEditEvent(e)}
            >
              {/* OG 썸네일 */}
              {e.og_image && (
                <div className="w-full h-32 overflow-hidden rounded-t-2xl">
                  <img
                    src={e.og_image}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={ev => { (ev.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
              )}

              {/* 링크 타입 상단 도메인 + 새창 버튼 */}
              {isLink && (
                <div className="px-3 pt-2.5 pb-0 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide">{domain}</span>
                  <a
                    href={url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={ev => ev.stopPropagation()}
                    className="text-[10px] text-blue-300 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    ↗
                  </a>
                </div>
              )}

              {/* 본문 */}
              <div className="px-3 pt-2 pb-2.5">
                <p className={`text-sm leading-snug ${isLink ? 'text-gray-700' : 'text-gray-800'} line-clamp-6`}>
                  {text}
                </p>
              </div>

              {/* 태그 + 빠른 태그 추가 */}
              <div
                className="px-3 pb-1.5 flex flex-wrap gap-1 items-center"
                onClick={ev => ev.stopPropagation()}
              >
                {(e.tags ?? []).map(tag => (
                  <span
                    key={tag}
                    className="group/tag flex items-center gap-0.5 text-[10px] text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full"
                  >
                    #{tag}
                    <button
                      onClick={() => handleRemoveTag(e.id, tag)}
                      className="opacity-0 group-hover/tag:opacity-100 text-indigo-300 hover:text-red-400 leading-none ml-0.5 transition-opacity"
                    >
                      ×
                    </button>
                  </span>
                ))}

                {tagInputOpen[e.id] ? (
                  <input
                    autoFocus
                    value={tagInputValue[e.id] || ''}
                    onChange={ev => setTagInputValue(p => ({ ...p, [e.id]: ev.target.value }))}
                    onKeyDown={ev => {
                      if (ev.key === 'Enter') handleAddTag(e.id)
                      if (ev.key === 'Escape') {
                        setTagInputOpen(p => ({ ...p, [e.id]: false }))
                        setTagInputValue(p => ({ ...p, [e.id]: '' }))
                      }
                    }}
                    onBlur={() => handleAddTag(e.id)}
                    placeholder="태그..."
                    className="text-[10px] w-16 px-1.5 py-0.5 rounded-full border border-indigo-300 bg-white text-indigo-600 focus:outline-none"
                  />
                ) : (
                  <button
                    onClick={() => setTagInputOpen(p => ({ ...p, [e.id]: true }))}
                    className="text-[10px] text-gray-300 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity px-1"
                  >
                    + 태그
                  </button>
                )}
              </div>

              {/* 하단 메타 + 액션 */}
              <div className="px-3 pb-2.5 flex items-center justify-between gap-1">
                <span className="text-[10px] text-gray-400">{formatKSTDate(e.created_at)}</span>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={ev => ev.stopPropagation()}>
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
                    onClick={() => toggleFavorite(e.id, e.is_favorite)}
                    className="text-sm leading-none"
                  >
                    {e.is_favorite ? '⭐' : '☆'}
                  </button>
                </div>
              </div>

              {/* 즐겨찾기 고정 뱃지 */}
              {e.is_favorite && (
                <span className="absolute top-2 right-2 text-xs">⭐</span>
              )}
            </div>
          )
        })}
      </div>

      {editEvent && (
        <EventViewModal
          event={editEvent as FullEvent}
          onClose={() => setEditEvent(null)}
          onSaved={(saved) => { handleSaved(saved); setEditEvent(null) }}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
