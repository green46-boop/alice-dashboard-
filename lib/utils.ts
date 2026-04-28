const KST_OFFSET = 9 * 60

export function toKST(date: Date): Date {
  return new Date(date.getTime() + KST_OFFSET * 60000)
}

export function todayRangeKST(): { start: string; end: string } {
  const now = new Date()
  const kstNow = toKST(now)
  const y = kstNow.getUTCFullYear()
  const m = kstNow.getUTCMonth()
  const d = kstNow.getUTCDate()
  const start = new Date(Date.UTC(y, m, d) - KST_OFFSET * 60000)
  const end = new Date(Date.UTC(y, m, d + 1) - KST_OFFSET * 60000)
  return { start: start.toISOString(), end: end.toISOString() }
}

export function dateRangeKST(kstDate: Date): { start: string; end: string } {
  const y = kstDate.getUTCFullYear()
  const m = kstDate.getUTCMonth()
  const d = kstDate.getUTCDate()
  const start = new Date(Date.UTC(y, m, d) - KST_OFFSET * 60000)
  const end = new Date(Date.UTC(y, m, d + 1) - KST_OFFSET * 60000)
  return { start: start.toISOString(), end: end.toISOString() }
}

export function formatKSTTime(isoStr: string): string {
  const kst = toKST(new Date(isoStr))
  return `${String(kst.getUTCHours()).padStart(2, '0')}:${String(kst.getUTCMinutes()).padStart(2, '0')}`
}

export function formatKSTDate(isoStr: string): string {
  const kst = toKST(new Date(isoStr))
  return `${kst.getUTCMonth() + 1}/${kst.getUTCDate()}`
}

export function isURL(text: string): boolean {
  return /^https?:\/\//.test(text.trim())
}

// 텍스트 앞에 "HH:MM" 형식이 있으면 그 시간을 KST로 해석해 반환, 없으면 created_at 그대로
export function extractEventTime(rawText: string, createdAt: string): Date {
  const fallback = new Date(createdAt)
  const match = rawText.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return fallback

  const hours = parseInt(match[1])
  const minutes = parseInt(match[2])
  if (hours > 23 || minutes > 59) return fallback

  // created_at 기준 KST 날짜를 구하고, 텍스트의 HH:MM(KST)으로 시간만 교체
  const kstDate = toKST(fallback)
  const y = kstDate.getUTCFullYear()
  const m = kstDate.getUTCMonth()
  const d = kstDate.getUTCDate()
  // KST → UTC: -9h
  return new Date(Date.UTC(y, m, d, hours - 9, minutes))
}
