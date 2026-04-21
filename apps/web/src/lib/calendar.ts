export function generateICS(
  title: string,
  start: Date,
  end: Date,
  location?: string,
  description?: string
): string {
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CareCompanion//EN',
    'BEGIN:VEVENT',
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${escapeICS(title)}`,
  ]

  if (location) lines.push(`LOCATION:${escapeICS(location)}`)
  if (description) lines.push(`DESCRIPTION:${escapeICS(description)}`)

  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

function escapeICS(text: string): string {
  return text.replace(/[\\;,\n]/g, (c) => {
    if (c === '\n') return '\\n'
    return '\\' + c
  })
}

function downloadICS(
  title: string,
  start: Date,
  location?: string,
  description?: string
) {
  const end = new Date(start.getTime() + 60 * 60 * 1000) // 1 hour default
  const ics = generateICS(title, start, end, location, description)
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/[^a-zA-Z0-9]/g, '-')}.ics`
  a.click()
  URL.revokeObjectURL(url)
}
