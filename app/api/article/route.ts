import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SNS_DOMAINS = ['instagram.com', 'youtube.com', 'youtu.be', 'tiktok.com',
  'twitter.com', 'x.com', 'threads.net', 'facebook.com']

export async function POST(req: NextRequest) {
  let body: { event_id?: unknown; url?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, reason: 'Invalid JSON' }, { status: 400 })
  }

  const { event_id, url } = body
  if (typeof event_id !== 'string' || typeof url !== 'string') {
    return NextResponse.json({ ok: false, reason: 'event_id and url required' }, { status: 400 })
  }

  // SNS 도메인은 본문 추출 불가 — 조용히 스킵
  try {
    const hostname = new URL(url).hostname.replace('www.', '')
    if (SNS_DOMAINS.some(d => hostname.includes(d))) {
      return NextResponse.json({ ok: false, reason: 'sns' })
    }
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid url' }, { status: 400 })
  }

  // Jina AI Reader로 본문 추출 (headless Chrome 기반, 한국 사이트 지원)
  let articleText: string | null = null
  try {
    const jinaUrl = `https://r.jina.ai/${url}`
    const res = await fetch(jinaUrl, {
      signal: AbortSignal.timeout(30000),
      headers: {
        'Accept': 'text/plain',
        'X-Return-Format': 'markdown',
      },
    })
    if (res.ok) {
      const text = await res.text()
      // Jina 응답 앞부분 메타 헤더 제거 (Title:, URL:, --- 등)
      const cleaned = text
        .replace(/^Title:.*$/m, '')
        .replace(/^URL:.*$/m, '')
        .replace(/^---+$/m, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
      if (cleaned.length > 100) {
        articleText = cleaned.slice(0, 20000)
      }
    }
  } catch {
    return NextResponse.json({ ok: false, reason: 'fetch failed' })
  }

  if (!articleText) {
    return NextResponse.json({ ok: false, reason: 'no content' })
  }

  // Supabase 업데이트
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const { error } = await supabase
    .from('events')
    .update({ article_body: articleText })
    .eq('id', event_id)

  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
