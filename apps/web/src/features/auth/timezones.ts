/** A short, curated list; the detected zone is added on top when missing. */
export const COMMON_TIMEZONES = [
  'UTC',
  'Atlantic/Canary',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Warsaw',
  'Europe/Kyiv',
  'Africa/Casablanca',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
] as const;

/** The browser knows where the user is; asking them to pick is extra friction. */
export function detectTimezone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof zone === 'string' && zone.length > 0 ? zone : 'UTC';
  } catch {
    return 'UTC';
  }
}

export function timezoneOptions(detected: string): string[] {
  const zones = new Set<string>(COMMON_TIMEZONES);
  zones.add(detected);

  return [...zones].sort((a, b) => a.localeCompare(b, 'es'));
}
