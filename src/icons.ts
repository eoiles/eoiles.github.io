export const icons: Record<string, string> = {
  copy: '<rect x="7" y="7" width="11" height="13" rx="2"/><path d="M14 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0-2 2v10a1 1 0 0 0 1 1h3"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  spark:
    '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
  undo: '<path d="M8 5 3 10l5 5M3 10h10a6 6 0 0 1 0 12" transform="translate(1 -2)"/>',
  clear: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/>',
  dots: '<g fill="currentColor" stroke="none"><circle cx="7" cy="5" r="1.6"/><circle cx="7" cy="12" r="1.6"/><circle cx="7" cy="19" r="1.6"/><circle cx="17" cy="5" r="1.6"/><circle cx="17" cy="12" r="1.6"/><circle cx="17" cy="19" r="1.6"/></g>',
  tiles: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5"/>',
  alert: '<path d="m12 3 10 17H2ZM12 9v4m0 3v.5"/>',
  read: '<path d="M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3ZM12 6v15"/>',
  settings:
    '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="var(--bg)"/><circle cx="16" cy="12" r="2" fill="var(--bg)"/><circle cx="10" cy="18" r="2" fill="var(--bg)"/>',
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18"/>',
  play: '<path d="m7 4 13 8-13 8Z"/>',
  pause: '<path d="M8 4v16M16 4v16"/>',
};
export const icon = (name: string) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.copy}</svg>`;
