import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function kstDateStr(date: Date): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.HEALTH_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { steps?: unknown; date?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const steps = Number(body.steps)
  if (!steps || isNaN(steps) || steps < 0) {
    return NextResponse.json({ error: 'steps must be a positive number' }, { status: 400 })
  }

  const targetDate = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
    ? body.date
    : kstDateStr(new Date())

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  // 해당 날짜의 health 이벤트 찾기
  const kstStart = `${targetDate}T00:00:00+09:00`
  const kstEnd = `${targetDate}T23:59:59+09:00`

  const { data: existing } = await supabase
    .from('events')
    .select('id')
    .eq('is_deleted', false)
    .contains('modules', ['health'])
    .or(`recorded_date.eq.${targetDate},and(recorded_date.is.null,created_at.gte.${kstStart},created_at.lte.${kstEnd})`)
    .order('created_at', { ascending: false })
    .limit(1)

  if (existing && existing.length > 0) {
    await supabase
      .from('events')
      .update({ steps, steps_source: 'ios_shortcut' })
      .eq('id', existing[0].id)

    return NextResponse.json({ ok: true, action: 'updated', steps, date: targetDate })
  }

  // 없으면 새로 생성
  const { data: created, error } = await supabase
    .from('events')
    .insert({
      raw_text: `걸음 ${steps}보`,
      summary: `걸음 ${steps.toLocaleString()}보`,
      modules: ['health'],
      content_type: 'log',
      steps,
      steps_source: 'ios_shortcut',
      recorded_date: targetDate,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, action: 'created', steps, date: targetDate, id: created.id })
}
