interface ParsedLabValue {
  displayValue: string
  numericValue: number | null
  referenceMax: number | null
  referenceMin: number | null
  isNumeric: boolean
  progressPercent: number | null
}

export function parseLabValue(value: string | null | undefined, referenceRange: string | null | undefined): ParsedLabValue {
  if (!value) return { displayValue: '—', numericValue: null, referenceMax: null, referenceMin: null, isNumeric: false, progressPercent: null }
  const refRange = referenceRange || ''
  const result: ParsedLabValue = {
    displayValue: value,
    numericValue: null,
    referenceMax: null,
    referenceMin: null,
    isNumeric: false,
    progressPercent: null,
  }

  // Parse value — handle BP format "142/88" (use systolic)
  if (value.includes('/')) {
    const systolic = parseFloat(value.split('/')[0])
    if (!isNaN(systolic)) {
      result.numericValue = systolic
      result.isNumeric = true
    }
  } else {
    const num = parseFloat(value)
    if (!isNaN(num)) {
      result.numericValue = num
      result.isNumeric = true
    }
  }

  // Parse reference range
  const ltBpMatch = refRange.match(/^<\s*([\d.]+)\/([\d.]+)/)
  const ltMatch = refRange.match(/^<\s*([\d.]+)/)
  const rangeMatch = refRange.match(/^([\d.]+)\s*-\s*([\d.]+)/)

  if (ltBpMatch) {
    result.referenceMax = parseFloat(ltBpMatch[1])
  } else if (ltMatch) {
    result.referenceMax = parseFloat(ltMatch[1])
  } else if (rangeMatch) {
    result.referenceMin = parseFloat(rangeMatch[1])
    result.referenceMax = parseFloat(rangeMatch[2])
  }

  // Calculate progress
  if (result.isNumeric && result.numericValue !== null && result.referenceMax !== null) {
    result.progressPercent = Math.min((result.numericValue / result.referenceMax) * 100, 150)
  }

  return result
}
