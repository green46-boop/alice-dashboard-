'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { formatKSTDate, isURL } from '@/lib/utils'
import { type FullEvent } from '../shared/EventModal'
import EventViewModal from '../shared/EventViewModal'

interface Event {
  id: string
  created_at: string
  raw_text: string
  summary: string | null
  modules: string[] | null
  content_type: string | null
  og_image: string | null
  tags: string[] | null
  color: string | null
  is_favorite: boolean
  status: string | null
  duration_minutes: number | null
  amount: number | null
  og_title: string | null
}

const ACCENT: Record<string, string> = {
  red: '#f87171', orange: '#fb923c', yellow: '#facc15',
  green: '#4ade80', blue: '#60a5fa', purple: '#c084fc', pink: '#f472b6',
}

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Event[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editEvent, setEditEvent] = useState<Event | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setResults([])
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      // cmd+k or ctrl+k로 검색창 열기
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [close])

  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults([]); return }

    const timer = setTimeout(async () => {
      setLoading(true)

      const tag = q.startsWith('#') ? q.slice(1).toLowerCase() : q.toLowerCase()
      const SELECT = 'id, created_at, raw_text, summary, modules, content_type, og_image, og_title, tags, color, is_favorite, status, duration_minutes, amount'

      if (q.startsWith('#')) {
        // #태그명: 태그 정확 검색만
        const { data } = await supabase
          .from('events')
          .select(SELECT)
          .eq('is_deleted', false)
          .contains('tags', [tag])
          .order('created_at', { ascending: false })
          .limit(50)
        setResults(data || [])
      } else {
        // 일반 검색: 텍스트 + 태그 동시 검색 후 병합
        const [textRes, tagRes] = await Promise.all([
          supabase
            .from('events')
            .select(SELECT)
            .eq('is_deleted', false)
            .or(`summary.ilike.%${q}%,raw_text.ilike.%${q}%`)
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('events')
            .select(SELECT)
            .eq('is_deleted', false)
            .contains('tags', [tag])
            .order('created_at', { ascending: false })
            .limit(50),
        ])
        // 중복 제거 후 최신순 정렬
        const seen = new Set<string>()
        const merged = [...(textRes.data || []), ...(tagRes.data || [])]
          .filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true })
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        setResults(merged)
      }

      setLoading(false)
    }, 250)

    return () => clearTimeout(timer)
  }, [query])

  const handleFocus = () => {
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <>
      {/* 헤더 안 검색창 — 클릭하면 오버레이 열림 */}
      <div
        className="relative w-full max-w-xl mx-auto cursor-pointer"
        onClick={handleFocus}
      >
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <div className="w-full h-8 pl-8 pr-4 text-sm bg-gray-100 rounded-lg flex items-center text-gray-400 select-none">
          검색...
        </div>
      </div>

      {/* 전체 화면 검색 오버레이 */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white/95 backdrop-blur-sm">
          {/* 검색 헤더 */}
          <div className="flex items-center gap-3 px-4 md:px-8 py-3 border-b border-gray-100 shrink-0">
            <span className="text-gray-400">🔍</span>
            <input
              ref={inputRef}
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="검색어 또는 #태그..."
              className="flex-1 text-base text-gray-800 placeholder:text-gray-400 bg-transparent focus:outline-none"
            />
            {loading && <span className="text-xs text-gray-400 shrink-0">검색 중...</span>}
            <button
              onClick={close}
              className="text-sm text-gray-400 hover:text-gray-600 shrink-0 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              ESC
            </button>
          </div>

          {/* 결과 영역 */}
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4">
            {/* 빈 상태 */}
            {!query && (
              <p className="text-sm text-gray-400 text-center mt-16">
                검색어를 입력하세요<br />
                <span className="text-xs">#태그명으로 태그 검색 가능</span>
              </p>
            )}

            {/* 결과 없음 */}
            {query && !loading && results.length === 0 && (
              <p className="text-sm text-gray-400 text-center mt-16">결과가 없습니다</p>
            )}

            {/* 결과 수 */}
            {results.length > 0 && (
              <p className="text-xs text-gray-400 mb-3">{results.length}개</p>
            )}

            {/* 카드 그리드 */}
            {results.length > 0 && (
              <div className="columns-2 md:columns-3 gap-3">
                {results.map(e => {
                  const text = e.summary || e.raw_text
                  const url = isURL(e.raw_text) ? e.raw_text : null
                  const domain = url ? (() => { try { return new URL(url).hostname.replace('www.', '') } catch { return url } })() : null
                  const isLink = !!url
                  const borderColor = e.color ? ACCENT[e.color] : undefined

                  return (
                    <div
                      key={e.id}
                      style={borderColor ? { borderLeftColor: borderColor, borderLeftWidth: 4 } : undefined}
                      className={`break-inside-avoid mb-3 rounded-2xl border shadow-sm cursor-pointer relative transition-shadow hover:shadow-md ${
                        isLink
                          ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100'
                          : 'bg-white border-gray-100'
                      }`}
                      onClick={() => setEditEvent(e)}
                    >
                      {/* OG 썸네일 */}
                      {e.og_image && (
                        <div className="w-full h-28 overflow-hidden rounded-t-2xl">
                          <img
                            src={e.og_image}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={ev => { (ev.target as HTMLImageElement).style.display = 'none' }}
                          />
                        </div>
                      )}

                      {/* 도메인 */}
                      {isLink && (
                        <div className="px-3 pt-2.5 pb-0 flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide">{domain}</span>
                          <a
                            href={url!}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={ev => ev.stopPropagation()}
                            className="text-[10px] text-blue-300 hover:text-blue-500"
                          >↗</a>
                        </div>
                      )}

                      {/* 본문 */}
                      <div className="px-3 pt-2 pb-2">
                        <p className="text-sm text-gray-800 leading-snug line-clamp-5">{text}</p>
                      </div>

                      {/* 태그 */}
                      {(e.tags ?? []).length > 0 && (
                        <div className="px-3 pb-1.5 flex flex-wrap gap-1">
                          {(e.tags ?? []).map(tag => (
                            <span key={tag} className="text-[10px] text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="px-3 pb-2.5">
                        <span className="text-[10px] text-gray-400">{formatKSTDate(e.created_at)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 뷰 모달 */}
      {editEvent && (
        <EventViewModal
          event={editEvent as FullEvent}
          onClose={() => setEditEvent(null)}
          onSaved={() => setEditEvent(null)}
        />
      )}
    </>
  )
}
