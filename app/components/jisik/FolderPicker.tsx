'use client'

import { useEffect, useRef, useState } from 'react'

export interface Folder {
  id: string
  name: string
}

interface Props {
  eventId: string
  folders: Folder[]
  assignedIds: Set<string>
  onToggle: (folderId: string, assigned: boolean) => void
}

export default function FolderPicker({ folders, assignedIds, onToggle }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (folders.length === 0) return null

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs text-gray-400 hover:text-blue-500 transition-colors px-1"
        title="폴더에 추가"
      >
        📁
      </button>

      {open && (
        <div className="absolute right-0 top-6 z-30 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-36">
          {folders.map(f => {
            const checked = assignedIds.has(f.id)
            return (
              <button
                key={f.id}
                onClick={() => onToggle(f.id, checked)}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left"
              >
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                  {checked && <span className="text-white text-xs leading-none">✓</span>}
                </span>
                <span className="text-xs text-gray-700 truncate">{f.name}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
