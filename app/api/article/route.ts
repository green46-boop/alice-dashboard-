import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'

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

  // 페이지 fetch
  let html: string
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
    if (!res.ok) return NextResponse.json({ ok: false, reason: `fetch ${res.status}` })
    html = await res.text()
  } catch {
    return NextResponse.json({ ok: false, reason: 'fetch failed' })
  }

  // Readability로 본문 추출
  let articleText: string | null = null
  try {
    const dom = new JSDOM(html, { url })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()
    if (article?.textContent) {
      // 공백 정리
      articleText = article.textContent
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, 20000) // 최대 20,000자
    }
  } catch {
    return NextResponse.json({ ok: false, reason: 'parse failed' })
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
