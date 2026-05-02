'use client'

import { useEffect, useRef, useState } from 'react'
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
  og_image: string | null
  og_title: string | null
  tags: string[] | null
  color: string | null
}

interface Folder {
  id: string
  name: string
}

type TabTemplate = 'default' | 'jisik' | 'geongang' | 'jigaebu' | 'sns'

interface TemplateConfig {
  modules: string[]
  contentTypes: string[]
  placeholder: string
  showAdvanced: boolean
  showDuration: boolean
  showAmount: boolean
}

const TEMPLATES: Record<TabTemplate, TemplateConfig> = {
  default: {
    modules: [],
    contentTypes: ['link', 'pdf', 'book', 'note', 'exercise', 'meal', 'expense'],
    placeholder: 'URL이나 메모를 입력하세요...',
    showAdvanced: false,
    showDuration: false,
    showAmount: false,
  },
  jisik: {
    modules: ['knowledge'],
    contentTypes: ['link', 'pdf', 'book', 'note'],
    placeholder: 'URL, 책, 아티클, 메모...',
    showAdvanced: false,
    showDuration: false,
    showAmount: false,
  },
  geongang: {
    modules: ['health'],
    contentTypes: ['exercise', 'meal'],
    placeholder: '운동, 식사, 건강 기록...',
    showAdvanced: true,
    showDuration: true,
    showAmount: false,
  },
  jigaebu: {
    modules: ['time'],
    contentTypes: ['note'],
    placeholder: '일정이나 시간 기록...',
    showAdvanced: true,
    showDuration: true,
    showAmount: false,
  },
  sns: {
    modules: ['sns'],
    contentTypes: ['link', 'note'],
    placeholder: 'SNS 성과나 콘텐츠 기록...',
    showAdvanced: false,
    showDuration: false,
    showAmount: false,
  },
}

interface Props {
  event?: FullEvent | null
  template?: TabTemplate
  onClose: () => void
  onSaved: (event: FullEvent) => void
  onDeleted?: (id: string) => void
}

const ALL_MODULES = ['knowledge', 'health', 'time', 'finance', 'sns']
const CONTENT_TYPES = ['link', 'pdf', 'book', 'note', 'exercise', 'meal', 'expense']

const COLOR_OPTIONS = [
  { value: '',       bg: 'bg-white',       border: 'border-gray-300', label: '없음' },
  { value: 'red',    bg: 'bg-red-400',     border: 'border-red-400',  label: '빨강' },
  { value: 'orange', bg: 'bg-orange-400',  border: 'border-orange-400', label: '주황' },
  { value: 'yellow', bg: 'bg-yellow-400',  border: 'border-yellow-400', label: '노랑' },
  { value: 'green',  bg: 'bg-green-400',   border: 'border-green-400', label: '초록' },
  { value: 'blue',   bg: 'bg-blue-400',    border: 'border-blue-400',  label: '파랑' },
  { value: 'purple', bg: 'bg-purple-400',  border: 'border-purple-400', label: '보라' },
  { value: 'pink',   bg: 'bg-pink-400',    border: 'border-pink-400',  label: '분홍' },
]

const MODULE_COLORS: Record<string, string> = {
  knowledge: 'bg-blue-100 text-blue-700 border-blue-200',
  health: 'bg-green-100 text-green-700 border-green-200',
  time: 'bg-purple-100 text-purple-700 border-purple-200',
  finance: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  sns: 'bg-pink-100 text-pink-700 border-pink-200',
}

function isValidURL(text: string) {
  return /^https?:\/\/\S+/.test(text.trim())
}

export default function EventModal({ event, template = 'default', onClose, onSaved, onDeleted }: Props) {
  const isNew = !event
  const tmpl = TEMPLATES[template]

  const [body, setBody] = useState(event?.raw_text ?? '')
  const [title, setTitle] = useState(event?.summary ?? '')
  const [modules, setModules] = useState<string[]>(event?.modules ?? (isNew ? tmpl.modules : []))
  const [contentType, setContentType] = useState(event?.content_type ?? '')
  const [status] = useState(event?.status ?? 'done')
  const [tags, setTags] = useState<string[]>(event?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [durationMins, setDurationMins] = useState(String(event?.duration_minutes ?? ''))
  const [amount, setAmount] = useState(String(event?.amount ?? ''))
  const [showAdvanced, setShowAdvanced] = useState(
    isNew ? tmpl.showAdvanced : !!(event?.modules?.length || event?.content_type || event?.duration_minutes || event?.amount)
  )
  const [color, setColor] = useState(event?.color ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // OG 미리보기
  const [ogPreview, setOgPreview] = useState<{ image: string | null; title: string | null } | null>(
    event?.og_image || event?.og_title
      ? { image: event.og_image, title: event.og_title }
      : null
  )
  const [ogLoading, setOgLoading] = useState(false)
  const ogFetchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 폴더
  const [folders, setFolders] = useState<Folder[]>([])
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set())

  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()

  // 폴더 목록 + 기존 배정 로드
  useEffect(() => {
    const load = async () => {
      const { data: folderData } = await supabase.from('folders').select('id, name').order('created_at')
      setFolders(folderData || [])

      if (event?.id) {
        const { data: efData } = await supabase
          .from('event_folders')
          .select('folder_id')
          .eq('event_id', event.id)
        setSelectedFolders(new Set((efData || []).map(r => r.folder_id)))
      }
    }
    load()
  }, [])

  useEffect(() => {
    bodyRef.current?.focus()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // URL 감지 → OG 실시간 fetch
  useEffect(() => {
    if (!isNew) return
    if (ogFetchRef.current) clearTimeout(ogFetchRef.current)

    const trimmed = body.trim()
    if (!isValidURL(trimmed)) {
      setOgPreview(null)
      return
    }

    ogFetchRef.current = setTimeout(async () => {
      setOgLoading(true)
      try {
        const res = await fetch(`/api/og?url=${encodeURIComponent(trimmed)}`)
        if (res.ok) {
          const data = await res.json()
          const preview = { image: data.image ?? null, title: data.title ?? null }
          setOgPreview(preview)
          if (!title && data.title) setTitle(data.title)
          if (!contentType) setContentType('link')
          if (!modules.includes('knowledge')) setModules(prev => [...prev, 'knowledge'])
        }
      } catch { /* 조용히 */ }
      setOgLoading(false)
    }, 600)

    return () => { if (ogFetchRef.current) clearTimeout(ogFetchRef.current) }
  }, [body])

  const toggleModule = (m: string) =>
    setModules(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])

  const toggleFolder = (id: string) =>
    setSelectedFolders(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const handleSave = async () => {
    const rawTextVal = body.trim() || title.trim()
    if (!rawTextVal) return
    setSaving(true)

    const urlDetected = isValidURL(rawTextVal)
    let ogImage = event?.og_image ?? ogPreview?.image ?? null
    let ogTitle = event?.og_title ?? ogPreview?.title ?? null

    if (isNew && urlDetected && !ogPreview) {
      try {
        const res = await fetch(`/api/og?url=${encodeURIComponent(rawTextVal)}`)
        if (res.ok) {
          const data = await res.json()
          ogImage = data.image ?? null
          ogTitle = data.title ?? null
        }
      } catch { /* */ }
    } else if (ogPreview) {
      ogImage = ogPreview.image
      ogTitle = ogPreview.title
    }

    const payload = {
      raw_text: rawTextVal,
      summary: title.trim() || ogTitle || null,
      modules: modules.length > 0 ? modules : null,
      content_type: contentType || (urlDetected ? 'link' : null),
      status,
      duration_minutes: durationMins ? Number(durationMins) : null,
      amount: amount ? Number(amount) : null,
      is_manually_edited: true,
      og_image: ogImage,
      og_title: ogTitle,
      tags: tags.length > 0 ? tags : null,
      color: color || null,
    }

    let savedEvent: FullEvent | null = null

    if (isNew) {
      const { data, error } = await supabase.from('events').insert(payload).select().single()
      if (error) { alert(`저장 실패: ${error.message}`); setSaving(false); return }
      savedEvent = data as FullEvent
    } else {
      const { data, error } = await supabase
        .from('events').update(payload).eq('id', event!.id).select().single()
      if (error) { alert(`저장 실패: ${error.message}`); setSaving(false); return }
      savedEvent = data as FullEvent
    }

    // 폴더 배정 저장
    if (savedEvent) {
      const eventId = savedEvent.id
      if (isNew) {
        if (selectedFolders.size > 0) {
          await supabase.from('event_folders').insert(
            [...selectedFolders].map(folderId => ({ event_id: eventId, folder_id: folderId }))
          )
        }
      } else {
        // 기존 배정과 diff
        const { data: existing } = await supabase
          .from('event_folders').select('folder_id').eq('event_id', eventId)
        const existingSet = new Set((existing || []).map(r => r.folder_id))
        const toAdd = [...selectedFolders].filter(id => !existingSet.has(id))
        const toRemove = [...existingSet].filter(id => !selectedFolders.has(id))
        if (toAdd.length > 0)
          await supabase.from('event_folders').insert(toAdd.map(folderId => ({ event_id: eventId, folder_id: folderId })))
        if (toRemove.length > 0)
          await supabase.from('event_folders').delete().eq('event_id', eventId).in('folder_id', toRemove)
      }
      onSaved(savedEvent)
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

  const canSave = (body.trim() || title.trim()) && !saving

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[92vh]">
        {/* 드래그 핸들 */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* 본문 영역 */}
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-2">

          {/* 메인 입력 — URL 또는 메모 */}
          <textarea
            ref={bodyRef}
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={tmpl.placeholder}
            rows={isValidURL(body.trim()) ? 2 : 4}
            className="w-full text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none resize-none leading-relaxed"
          />

          {/* URL 미리보기 */}
          {(ogLoading || ogPreview) && (
            <div className="mt-2 mb-3 rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
              {ogLoading && (
                <div className="px-3 py-2.5 text-xs text-gray-400">미리보기 불러오는 중...</div>
              )}
              {!ogLoading && ogPreview && (
                <>
                  {ogPreview.image && (
                    <img
                      src={ogPreview.image}
                      alt=""
                      className="w-full h-32 object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  )}
                  {ogPreview.title && (
                    <p className="px-3 py-2 text-xs font-medium text-gray-700 line-clamp-2">{ogPreview.title}</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* 색상 레이블 */}
          <div className="h-px bg-gray-100 mb-2" />
          <div className="flex items-center gap-1.5 mb-3">
            {COLOR_OPTIONS.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => setColor(c.value)}
                title={c.label}
                className={`w-5 h-5 rounded-full border-2 transition-transform ${c.bg} ${
                  color === c.value ? 'border-gray-600 scale-125' : 'border-transparent hover:scale-110'
                } ${c.value === '' ? 'border-gray-300' : ''}`}
              />
            ))}
          </div>

          {/* 제목 */}
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="제목 (선택)"
            className="w-full text-base font-semibold text-gray-900 placeholder:text-gray-300 focus:outline-none mb-3"
          />

          {/* 태그 */}
          <div className="mb-3">
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  #{tag}
                  <button type="button" onClick={() => setTags(prev => prev.filter(t => t !== tag))}
                    className="text-gray-400 hover:text-gray-700 leading-none">×</button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.nativeEvent.isComposing) return
                if ((e.key === 'Enter' || e.key === ' ' || e.key === ',') && tagInput.trim()) {
                  e.preventDefault()
                  const tag = tagInput.trim().replace(/^#/, '').toLowerCase()
                  if (tag && !tags.includes(tag)) setTags(prev => [...prev, tag])
                  setTagInput('')
                }
                if (e.key === 'Backspace' && !tagInput && tags.length > 0)
                  setTags(prev => prev.slice(0, -1))
              }}
              placeholder={tags.length === 0 ? '#태그 입력 후 Space' : '#태그 추가...'}
              className="w-full text-xs text-gray-500 placeholder:text-gray-300 focus:outline-none"
            />
          </div>

          {/* 폴더 선택 */}
          {folders.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-1.5">폴더</p>
              <div className="flex flex-wrap gap-1.5">
                {folders.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggleFolder(f.id)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      selectedFolders.has(f.id)
                        ? 'bg-gray-800 text-white border-gray-800'
                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    📁 {f.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 고급 옵션 토글 */}
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-2"
          >
            <span>{showAdvanced ? '▾' : '▸'}</span>
            <span>고급 옵션</span>
          </button>

          {showAdvanced && (
            <div className="space-y-3 pb-1">
              {/* 모듈 */}
              <div className="flex flex-wrap gap-1.5">
                {ALL_MODULES.map(m => (
                  <button key={m} onClick={() => toggleModule(m)}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                      modules.includes(m) ? MODULE_COLORS[m] : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300'
                    }`}>
                    {m}
                  </button>
                ))}
              </div>

              {/* 유형 — 템플릿에 따라 필터링 */}
              <div className="flex flex-wrap gap-1.5">
                {tmpl.contentTypes.map(t => (
                  <button key={t} onClick={() => setContentType(prev => prev === t ? '' : t)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      contentType === t ? 'bg-gray-800 text-white border-gray-800' : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300'
                    }`}>
                    {t}
                  </button>
                ))}
              </div>

              {/* 시간·금액 — 템플릿에 따라 표시 */}
              {(tmpl.showDuration || tmpl.showAmount) && (
                <div className="grid grid-cols-2 gap-3">
                  {tmpl.showDuration && (
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">시간 (분)</label>
                      <input type="number" value={durationMins} onChange={e => setDurationMins(e.target.value)}
                        placeholder="0" min={0}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100" />
                    </div>
                  )}
                  {tmpl.showAmount && (
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">금액 (원)</label>
                      <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                        placeholder="0" min={0}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!isNew && event && (
            <p className="text-xs text-gray-300 mt-2">
              {new Date(event.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
            </p>
          )}
        </div>

        {/* 하단 저장/삭제 */}
        <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between">
          {!isNew ? (
            <button onClick={handleDelete} disabled={deleting}
              className="text-sm text-red-400 hover:text-red-600 disabled:opacity-50">
              {deleting ? '삭제 중...' : '삭제'}
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5">취소</button>
            <button onClick={handleSave} disabled={!canSave}
              className="text-sm bg-gray-900 text-white px-4 py-1.5 rounded-xl hover:bg-gray-700 disabled:opacity-40 transition-colors">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
