const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const SYNODIC_DAYS = 29.530588853
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14)

export type PersonaWeather = 'sun' | 'cloud' | 'rain' | 'fog'

/**
 * Clock and calendar shown in the P3/P4 header. Local time only; the weather glyph is a mood picked
 * from the hour (no forecast is fetched), and the moon phase is computed from the date.
 */
export function personaClock(now: Date) {
  const hour = now.getHours()
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const phase = (((now.getTime() - NEW_MOON_EPOCH) / 86400000 / SYNODIC_DAYS) % 1 + 1) % 1
  const period = hour === 0 ? 'DARK HOUR' : hour < 5 ? 'LATE NIGHT' : hour < 8 ? 'EARLY MORNING' : hour < 12 ? 'MORNING'
    : hour < 14 ? 'LUNCHTIME' : hour < 16 ? 'AFTERNOON' : hour < 18 ? 'AFTER SCHOOL' : hour < 23 ? 'EVENING' : 'LATE NIGHT'
  const weather: PersonaWeather = hour >= 6 && hour < 16 ? 'sun' : hour >= 16 && hour < 19 ? 'cloud' : hour >= 19 && hour < 23 ? 'rain' : 'fog'
  return {
    time: `${hour}:${minutes}`,
    period,
    darkHour: hour === 0,
    date: `${now.getMonth() + 1}/${now.getDate()}`,
    day: WEEKDAYS[now.getDay()],
    weekend: now.getDay() === 0 ? 'sun' : now.getDay() === 6 ? 'sat' : '',
    weather,
    moon: Math.round(phase * 100) / 100,
    /** Shadow-disc offset in disc widths: 0 covers (new moon), ±1 clears it (full); waxing slides it left. */
    moonShift: Math.round((phase < .5 ? -phase * 2 : (1 - phase) * 2) * 100) / 100,
  }
}

/** The P3 chip banner: WEEKDAY, WEEKEND, or DARK HOUR from 0:00 to 0:59 local time. */
export function personaBanner(now: Date): string {
  if (now.getHours() === 0) return 'DARK HOUR'
  return now.getDay() === 0 || now.getDay() === 6 ? 'WEEKEND' : 'WEEKDAY'
}

/** Days around today for the P4 calendar strip (dates only; weather is shown for today alone). */
export function personaDays(now: Date, span = 3) {
  return Array.from({ length: span * 2 + 1 }, (_, index) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + index - span)
    return {
      date: `${day.getMonth() + 1}/${day.getDate()}`,
      day: WEEKDAYS[day.getDay()],
      weekend: day.getDay() === 0 ? 'sun' : day.getDay() === 6 ? 'sat' : '',
      today: index === span,
    }
  })
}
