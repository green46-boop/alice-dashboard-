import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: 'invalid url' }, { status: 400 })
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(8000),
    })
    const html = await res.text()
    const base = new URL(url).origin

    const getMeta = (prop: string) => {
      const patterns = [
        new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, 'i'),
        new RegExp(`<meta[^>]+name=["']twitter:${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:${prop}["']`, 'i'),
      ]
      for (const p of patterns) {
        const m = html.match(p)
        if (m?.[1]) return m[1]
      }
      return null
    }

    const getTitle = () => {
      const og = getMeta('title')
      if (og) return og
      const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      return m?.[1]?.trim() ?? null
    }

    const resolveImage = (src: string | null) => {
      if (!src) return null
      if (/^https?:\/\//.test(src)) return src
      if (src.startsWith('//')) return 'https:' + src
      if (src.startsWith('/')) return base + src
      return null
    }

    return NextResponse.json({
      title: getTitle(),
      image: resolveImage(getMeta('image')),
      description: getMeta('description'),
    })
  } catch {
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 })
  }
}
