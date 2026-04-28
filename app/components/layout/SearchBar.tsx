'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { MODULE_COLORS } from '@/lib/constants'
import { formatKSTDate } from '@/lib/utils'

interface Event {
  id: string
  created_at: string
  raw_text: string
  summary: string | null
  modules: string[] | null
}

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Event[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setOpen(false)
      return
    }
    const timer = setTimeout(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('events')
        .select('id, created_at, raw_text, summary, modules')
        .eq('is_deleted', false)
        .or(`summary.ilike.%${query}%,raw_text.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(10)
      setResults(data || [])
      setOpen(true)
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={containerRef} className="relative w-full max-w-xl mx-auto">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="검색..."
          className="w-full h-8 pl-8 pr-4 text-sm bg-gray-100 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:bg-white transition-colors"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">검색 중</span>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-10 left-0 right-0 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden">
          {results.map(e => (
            <button
              key={e.id}
              onClick={() => { setOpen(false); setQuery('') }}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0"
            >
              <p className="text-sm text-gray-800 truncate">{e.summary || e.raw_text}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-gray-400">{formatKSTDate(e.created_at)}</span>
                {(e.modules || []).slice(0, 2).map(m => (
                  <span key={m} className={`text-xs px-1.5 py-0 rounded-full font-medium ${MODULE_COLORS[m] || 'bg-gray-100 text-gray-600'}`}>
                    {m}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}

      {open && query && results.length === 0 && !loading && (
        <div className="absolute top-10 left-0 right-0 bg-white rounded-xl shadow-lg border border-gray-100 z-50 px-4 py-3">
          <p className="text-sm text-gray-400">결과 없음</p>
        </div>
      )}
    </div>
  )
}
