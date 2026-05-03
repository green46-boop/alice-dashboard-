'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatKSTDate, isURL } from '@/lib/utils'
import EventModal, { type FullEvent } from '../shared/EventModal'

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
  is_manually_edited: boolean
  is_favorite: boolean
  og_image: string | null
  og_title: string | null
  tags: string[] | null
  color: string | null
  article_body: string | null
}

export default function SnsView() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [editEvent, setEditEvent] = useState<Event | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('events')
      .select('id, created_at, raw_text, summary, modules, content_type, status, duration_minutes, amount, is_manually_edited, is_favorite, og_image, og_title, tags, color, article_body')
      .eq('is_deleted', false)
      .contains('modules', ['sns'])
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setEvents(data || [])
        setLoading(false)
      })
  }, [])

  const togglePaid = async (id: string, current: boolean) => {
    await supabase.from('events').update({ is_manually_edited: !current }).eq('id', id)
    setEvents(prev => prev.map(e => e.id === id ? { ...e, is_manually_edited: !current } : e))
  }

  const handleSaved = (updated: FullEvent) => {
    setEvents(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e))
  }

  const handleDeleted = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">불러오는 중...</div>

  return (
    <div className="p-6 max-w-2xl space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">SNS 성과</h2>
        <span className="text-xs text-gray-400">{events.length}개</span>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">SNS 기록이 없습니다</p>
      ) : (
        <div className="space-y-2">
          {events.map(e => {
            const text = e.summary || e.raw_text
            const url = isURL(e.raw_text) ? e.raw_text : null

            return (
              <div key={e.id} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 group">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 leading-snug">{text}</p>
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline truncate block mt-0.5"
                      >
                        {url}
                      </a>
                    )}
                    <span className="text-xs text-gray-400 mt-1 block">{formatKSTDate(e.created_at)}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <button
                      onClick={() => togglePaid(e.id, e.is_manually_edited)}
                      className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                        e.is_manually_edited
                          ? 'bg-yellow-50 text-yellow-600 border-yellow-200'
                          : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {e.is_manually_edited ? '💰 지급' : '미지급'}
                    </button>
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
      )}

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
