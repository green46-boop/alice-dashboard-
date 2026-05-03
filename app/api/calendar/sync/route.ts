import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CATEGORY_MAP: Record<string, string> = {
  수면: 'sleep',
  충전: 'recharge',
  성장: 'growth',
  사이드: 'side',
  업무: 'work',
  일상: 'life',
  운동: 'exercise',
}

interface ParsedEvent {
  category: string
  category_label: string
  subcategory: string | null
  summary: string | null
  needs_review: boolean
}

function parseTitle(raw: string): ParsedEvent {
  const title = raw.replace(/^\[실행\]\s*/i, '').trim()
  const catMatch = title.match(/^\[([^\]]+)\]/)

  if (!catMatch) {
    return {
      category: 'uncategorized',
      category_label: '미분류',
      subcategory: null,
      summary: title || null,
      needs_review: true,
    }
  }

  const catKr = catMatch[1]
  const rest = title.slice(catMatch[0].length).trim()
  const colonIdx = rest.indexOf(':')
  const subcategory = colonIdx > 0 ? rest.slice(0, colonIdx).trim() || null : null
  const summary = colonIdx > 0 ? rest.slice(colonIdx + 1).trim() || null : rest || null

  return {
    category: CATEGORY_MAP[catKr] ?? 'uncategorized',
    category_label: catKr,
    subcategory,
    summary,
    needs_review: !CATEGORY_MAP[catKr],
  }
}

interface RawEvent {
  id: string
  raw_title: string
  start: string
  end: string
  location?: string | null
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.CALENDAR_SYNC_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { events?: unknown; range_start?: unknown; range_end?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!Array.isArray(body.events)) {
    return NextResponse.json({ error: 'events must be an array' }, { status: 400 })
  }
  if (typeof body.range_start !== 'string' || typeof body.range_end !== 'string') {
    return NextResponse.json({ error: 'range_start and range_end required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  // 해당 범위 기존 데이터 삭제 (캘린더에서 삭제된 이벤트 반영)
  const { error: deleteError } = await supabase
    .from('calendar_events')
    .delete()
    .gte('started_at', body.range_start)
    .lt('started_at', body.range_end)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  const rows = (body.events as RawEvent[]).map(e => {
    const parsed = parseTitle(e.raw_title)
    const startedAt = new Date(e.start)
    const endedAt = new Date(e.end)
    const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000)

    return {
      id: e.id,
      raw_title: e.raw_title,
      category: parsed.category,
      category_label: parsed.category_label,
      subcategory: parsed.subcategory,
      summary: parsed.summary,
      started_at: e.start,
      ended_at: e.end,
      duration_minutes: durationMinutes,
      location: e.location ?? null,
      needs_review: parsed.needs_review,
    }
  })

  if (rows.length === 0) {
    return NextResponse.json({ synced: 0 })
  }

  const { error: insertError } = await supabase
    .from('calendar_events')
    .insert(rows)

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ synced: rows.length })
}
