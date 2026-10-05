export interface IconDef {
  viewBox: string
  mode: 'stroke' | 'fill'
  strokeWidth: number
  path: string
}

export const ICONS = {
  'calendar': { viewBox: '0 0 24 24', mode: 'stroke', strokeWidth: 2, path: '<path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>' },
  'chevL': { viewBox: '0 0 24 24', mode: 'stroke', strokeWidth: 2, path: '<path d="M15 19l-7-7 7-7"/>' },
  'chevR': { viewBox: '0 0 24 24', mode: 'stroke', strokeWidth: 2, path: '<path d="M9 5l7 7-7 7"/>' },
  'chevDown': { viewBox: '0 0 24 24', mode: 'stroke', strokeWidth: 2, path: '<path d="M19 9l-7 7-7-7"/>' },
  'refresh': { viewBox: '0 0 24 24', mode: 'stroke', strokeWidth: 2, path: '<path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>' },
  'gear': { viewBox: '0 0 24 24', mode: 'stroke', strokeWidth: 2, path: '<path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>' },
  'bolt': { viewBox: '0 0 24 24', mode: 'stroke', strokeWidth: 2, path: '<path d="M13 10V3L4 14h7v7l9-11h-7z"/>' },
  'pin': { viewBox: '0 0 24 24', mode: 'stroke', strokeWidth: 2, path: '<path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>' },
  'x': { viewBox: '0 0 24 24', mode: 'stroke', strokeWidth: 2, path: '<path d="M6 18L18 6M6 6l12 12"/>' },
  'check': { viewBox: '0 0 24 24', mode: 'stroke', strokeWidth: 2.5, path: '<path d="M5 13l4 4L19 7"/>' },
  'pencil': { viewBox: '0 0 24 24', mode: 'stroke', strokeWidth: 2, path: '<path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>' },
  'plus': { viewBox: '0 0 24 24', mode: 'stroke', strokeWidth: 2, path: '<path d="M12 4v16m8-8H4"/>' },
  'ext': { viewBox: '0 0 24 24', mode: 'stroke', strokeWidth: 2, path: '<path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>' },
  'kebab': { viewBox: '0 0 24 24', mode: 'stroke', strokeWidth: 2, path: '<path d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>' },
  'updown': { viewBox: '0 0 24 24', mode: 'stroke', strokeWidth: 2, path: '<path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/>' },
  'sun': { viewBox: '0 0 24 24', mode: 'stroke', strokeWidth: 2, path: '<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>' },
  'moon': { viewBox: '0 0 20 20', mode: 'fill', strokeWidth: 0, path: '<path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>' },
  'star': { viewBox: '0 0 20 20', mode: 'fill', strokeWidth: 0, path: '<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>' },
  'cloud': { viewBox: '0 0 20 20', mode: 'fill', strokeWidth: 0, path: '<path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z"/>' },
  'trash': { viewBox: '0 0 24 24', mode: 'stroke', strokeWidth: 2, path: '<path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>' },
  'grip': { viewBox: '0 0 24 24', mode: 'fill', strokeWidth: 0, path: '<circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>' },
} as const satisfies Record<string, IconDef>

export type IconName = keyof typeof ICONS
