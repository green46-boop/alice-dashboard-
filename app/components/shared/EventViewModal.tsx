'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatKSTDate, isURL } from '@/lib/utils'
import { MODULE_COLORS } from '@/lib/constants'
import EventModal, { type FullEvent } from './EventModal'

interface Props {
  event: FullEvent
  onClose: () => void
  onSaved: (event: FullEvent) => void
  onDeleted?: (id: string) => void
}

const ACCENT: Record<string, string> = {
  red: '#f87171', orange: '#fb923c', yellow: '#facc15',
  green: '#4ade80', blue: '#60a5fa', purple: '#c084fc', pink: '#f472b6',
}

function safeTitle(event: FullEvent): string {
  return event.summary || event.og_title || event.raw_text.slice(0, 50)
}

function generateMarkdown(event: FullEvent): string {
  const url = isURL(event.raw_text) ? event.raw_text : null
  const title = safeTitle(event)
  const body = (url && event.raw_text === url) ? null
    : (!event.raw_text.startsWith('http') ? event.raw_text : null)
  const tags = event.tags ?? []
  const today = new Date().toISOString().slice(0, 10)

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

  // 메타데이터는 하단에 접힌 callout으로
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

function sendToObsidian(event: FullEvent) {
  let vaultName = localStorage.getItem('obsidian_vault_name')
  if (!vaultName) {
    vaultName = prompt('Obsidian Vault 이름을 입력하세요:')
    if (!vaultName) return
    localStorage.setItem('obsidian_vault_name', vaultName)
  }

  const title = safeTitle(event)
  const safe = title.replace(/[/\\:*?"<>|#%]/g, '').trim().slice(0, 60)
  const filePath = `Alice/knowledge/${safe}`
  const content = generateMarkdown(event)

  const uri = `obsidian://new?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(filePath)}&content=${encodeURIComponent(content)}&paneType=tab`
  window.open(uri, '_blank')
}

export default function EventViewModal({ event, onClose, onSaved, onDeleted }: Props) {
  const [editing, setEditing] = useState(false)
  const [isFavorite, setIsFavorite] = useState(event.is_favorite)
  const [copied, setCopied] = useState(false)
  const supabase = createClient()

  const url = isURL(event.raw_text) ? event.raw_text : null
  const domain = url ? (() => { try { return new URL(url).hostname.replace('www.', '') } catch { return url } })() : null
  const title = event.summary || event.og_title || null
  const body = (!event.raw_text.startsWith('http') && event.raw_text !== title) ? event.raw_text : null
  const borderColor = event.color ? ACCENT[event.color] : undefined

  const toggleFavorite = async () => {
    const next = !isFavorite
    setIsFavorite(next)
    await supabase.from('events').update({ is_favorite: next }).eq('id', event.id)
  }

  const copyUrl = async () => {
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // 표시용 단축 URL
  const shortUrl = url ? (() => {
    try {
      const u = new URL(url)
      const path = u.pathname + u.search
      return u.hostname.replace('www.', '') + (path.length > 40 ? path.slice(0, 40) + '…' : path)
    } catch { return url.slice(0, 60) }
  })() : null

  if (editing) {
    return (
      <EventModal
        event={{ ...event, is_favorite: isFavorite }}
        onClose={() => setEditing(false)}
        onSaved={(saved) => { setEditing(false); onSaved(saved) }}
        onDeleted={onDeleted ? (id) => { onDeleted(id); onClose() } : undefined}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      {/* 배경 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* 모달 */}
      <div
        className="relative w-full md:max-w-lg bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={borderColor ? { borderTop: `4px solid ${borderColor}` } : undefined}
      >
        {/* 상단 액션 바 */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
          <button
            onClick={toggleFavorite}
            className="text-xl transition-transform active:scale-90"
            title={isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
          >
            {isFavorite ? '⭐' : '☆'}
          </button>
          <div className="flex items-center gap-2">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full font-medium hover:bg-blue-100 transition-colors"
              >
                ↗ 열기
              </a>
            )}
            <button
              onClick={() => sendToObsidian(event)}
              className="text-xs px-3 py-1.5 bg-purple-50 text-purple-600 rounded-full font-medium hover:bg-purple-100 transition-colors"
              title="Obsidian으로 보내기"
            >
              ⟁ Obsidian
            </button>
            <button
              onClick={() => setEditing(true)}
              className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full font-medium hover:bg-gray-200 transition-colors"
            >
              ✏️ 편집
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors text-sm"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 스크롤 영역 */}
        <div className="overflow-y-auto flex-1">
          {/* OG 이미지 */}
          {event.og_image && (
            <div className="w-full h-48 overflow-hidden">
              <img
                src={event.og_image}
                alt=""
                className="w-full h-full object-cover"
                onError={ev => { (ev.target as HTMLImageElement).parentElement!.style.display = 'none' }}
              />
            </div>
          )}

          <div className="px-5 py-4 space-y-3">
            {/* 도메인 */}
            {domain && (
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">{domain}</p>
            )}

            {/* 제목 */}
            {title && (
              <h2 className="text-lg font-bold text-gray-900 leading-snug">{title}</h2>
            )}

            {/* 본문 */}
            {body && (
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{body}</p>
            )}

            {/* URL만 있을 때 */}
            {!title && !body && url && (
              <p className="text-sm text-gray-400 break-all">{url}</p>
            )}

            {/* 구분선 */}
            <div className="border-t border-gray-100 pt-3 space-y-2">
              {/* 태그 */}
              {(event.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(event.tags ?? []).map(tag => (
                    <span key={tag} className="text-xs text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* 모듈 + 날짜 */}
              <div className="flex flex-wrap items-center gap-1.5">
                {(event.modules ?? []).map(m => (
                  <span key={m} className={`text-xs px-2 py-0.5 rounded-full font-medium ${MODULE_COLORS[m] || 'bg-gray-100 text-gray-600'}`}>
                    {m}
                  </span>
                ))}
                {event.content_type && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{event.content_type}</span>
                )}
                <span className="text-xs text-gray-400 ml-auto">{formatKSTDate(event.created_at)}</span>
              </div>

              {/* URL 출처 + 복사 */}
              {url && shortUrl && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-gray-400 truncate flex-1">{shortUrl}</span>
                  <button
                    onClick={copyUrl}
                    className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full border transition-all ${
                      copied
                        ? 'border-green-300 text-green-600 bg-green-50'
                        : 'border-gray-200 text-gray-500 hover:border-gray-400'
                    }`}
                  >
                    {copied ? '복사됨 ✓' : '복사'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
