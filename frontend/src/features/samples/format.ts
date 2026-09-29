import type { ScreeningCall } from '../../types/sample'

export const callLabel = (call: ScreeningCall) => (call === 'positive' ? 'Positive' : 'Negative')

/** 0.942 → "94.2%". */
export const formatConfidence = (confidence: number) => `${(confidence * 100).toFixed(1)}%`

export const formatField = (field: number) => `Field ${String(field).padStart(2, '0')}`

const NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve']
/** 4 → "Four fields", 1 → "One field". */
export const describeFieldCount = (count: number) => `${NUMBER_WORDS[count] ?? count} ${count === 1 ? 'field' : 'fields'}`

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
