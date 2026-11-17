import type { SVGProps } from 'react';

export type IconName =
  | 'logo'
  | 'note'
  | 'folder'
  | 'folder-open'
  | 'folder-search'
  | 'chevron-right'
  | 'chevron-down'
  | 'search'
  | 'command'
  | 'settings'
  | 'assistant'
  | 'link'
  | 'outline'
  | 'tag'
  | 'help'
  | 'sun'
  | 'moon'
  | 'plus'
  | 'trash'
  | 'pencil'
  | 'save'
  | 'close'
  | 'panel-left'
  | 'panel-right'
  | 'external'
  | 'check'
  | 'stop'
  | 'copy'
  | 'insert'
  | 'refresh'
  | 'vault'
  | 'arrow-left'
  | 'arrow-right'
  | 'more'
  | 'edit'
  | 'eye'
  | 'columns'
  | 'github'
  | 'warning'
  | 'graph'
  | 'calendar'
  | 'template'
  | 'download'
  | 'focus'
  | 'filter'
  | 'clock';

/* A single consistent 24px stroke set. */
const PATHS: Record<IconName, string> = {
  logo: 'M15.6 8.2 21 11.3v5.9l-9 5.2-9-5.2V8.6l8-4.6',
  note: 'M6.5 3.5h7l4 4v13h-11z M13.5 3.5v4h4',
  folder: 'M3.5 6.8A1.3 1.3 0 0 1 4.8 5.5h3.9l2 2h6.5a1.3 1.3 0 0 1 1.3 1.3v8.4a1.3 1.3 0 0 1-1.3 1.3H4.8a1.3 1.3 0 0 1-1.3-1.3z',
  'folder-open': 'M3.5 8V6.8a1.3 1.3 0 0 1 1.3-1.3h3.9l2 2h6.5A1.3 1.3 0 0 1 20.5 8.8v1 M3.8 9.5h16.9l-2 8.8a1.2 1.2 0 0 1-1.2.9H5.1a1.2 1.2 0 0 1-1.2-.9z',
  'folder-search': 'M3.5 6.8A1.3 1.3 0 0 1 4.8 5.5h3.9l2 2h6.5a1.3 1.3 0 0 1 1.3 1.3v8.4a1.3 1.3 0 0 1-1.3 1.3H4.8a1.3 1.3 0 0 1-1.3-1.3z M10 10.6a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4Z M12.1 15.4 14 17.2',
  'chevron-right': 'm9.5 6.5 5.5 5.5-5.5 5.5',
  'chevron-down': 'm6.5 9.5 5.5 5.5 5.5-5.5',
  search: 'M11 17.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z M15.8 15.8 20 20',
  command: 'M9 6.2a2.2 2.2 0 1 0-2.2 2.2h10.4a2.2 2.2 0 1 0-2.2-2.2v10.4a2.2 2.2 0 1 0 2.2-2.2H6.8a2.2 2.2 0 1 0 2.2 2.2z',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.2 13.4a7.4 7.4 0 0 0 0-2.8l1.8-1.2-1.8-3.1-2 .9a7.4 7.4 0 0 0-2.4-1.4L14.5 3h-3.6l-.3 2.2a7.4 7.4 0 0 0-2.4 1.4l-2-.9L4.4 8.8l1.8 1.2a7.4 7.4 0 0 0 0 2.8l-1.8 1.2 1.8 3.1 2-.9a7.4 7.4 0 0 0 2.4 1.4l.3 2.2h3.6l.3-2.2a7.4 7.4 0 0 0 2.4-1.4l2 .9 1.8-3.1z',
  assistant: 'M4.5 5.5h15v9.2h-8.1L6.9 18.4v-3.7H4.5z M8 9.2h8 M8 12h5.2',
  link: 'M10.6 13.4a3.4 3.4 0 0 0 4.8 0l2.6-2.6a3.4 3.4 0 0 0-4.8-4.8l-1.3 1.3 M13.4 10.6a3.4 3.4 0 0 0-4.8 0l-2.6 2.6a3.4 3.4 0 0 0 4.8 4.8l1.3-1.3',
  outline: 'M4 6.5h2.2 M9.5 6.5h10.5 M4 12h2.2 M9.5 12h10.5 M4 17.5h2.2 M9.5 17.5h7',
  tag: 'M4 4h7l9 9-7 7-9-9z M8.2 8.2h.01',
  help: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17Z M9.7 9.4a2.4 2.4 0 1 1 3.5 2.2c-.8.4-1.2 1-1.2 2 M12 16.6h.01',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z M12 3v1.8 M12 19.2V21 M4.6 4.6l1.3 1.3 M18.1 18.1l1.3 1.3 M3 12h1.8 M19.2 12H21 M4.6 19.4l1.3-1.3 M18.1 5.9l1.3-1.3',
  moon: 'M19.5 14.6A8 8 0 1 1 9.4 4.5a6.5 6.5 0 0 0 10.1 10.1Z',
  plus: 'M12 5.5v13 M5.5 12h13',
  trash: 'M4.5 7h15 M9.5 7V4.8h5V7 M6.6 7l.8 12a1.1 1.1 0 0 0 1.1 1h7a1.1 1.1 0 0 0 1.1-1l.8-12 M10 11v5.5 M14 11v5.5',
  pencil: 'M4.5 19.5h4L20 8l-4-4L4.5 15.5z M14.5 5.5 18.5 9.5',
  save: 'M5 4.5h10.5L19 8v11.5H5z M8.5 4.5V9h6.5V4.5 M8.5 19.5V14h7v5.5',
  close: 'M6.5 6.5l11 11 M17.5 6.5l-11 11',
  'panel-left': 'M4.5 4.5h15v15h-15z M9.6 4.5v15',
  'panel-right': 'M4.5 4.5h15v15h-15z M14.4 4.5v15',
  external: 'M14.5 4.5H20V10 M20 4.5 11 13.5 M18 14.5V19H5V6h4.5',
  check: 'm5 12.5 4.5 4.5L19 6.5',
  stop: 'M7.5 7.5h9v9h-9z',
  copy: 'M9.5 9.5h10v10h-10z M14.5 5.5h-10v10',
  insert: 'M12 4.5v10.5 M8 11l4 4 4-4 M5 19.5h14',
  refresh: 'M19.5 11.5a7.5 7.5 0 1 0-2.5 5.6 M19.5 5.5v6h-6',
  vault: 'M4 7.6 12 3l8 4.6v8.8L12 21l-8-4.6z M4 7.6 12 12l8-4.4 M12 12v9',
  'arrow-left': 'M19 12H5 M11 6 5 12l6 6',
  'arrow-right': 'M5 12h14 M13 6l6 6-6 6',
  more: 'M6 12h.01 M12 12h.01 M18 12h.01',
  edit: 'M4.5 19.5h15 M6 16l9.5-9.5L18 9l-9.5 9.5H6z',
  eye: 'M2.8 12S6.4 5.8 12 5.8 21.2 12 21.2 12 17.6 18.2 12 18.2 2.8 12 2.8 12Z M12 14.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z',
  columns: 'M4.5 4.5h15v15h-15z M12 4.5v15',
  github:
    'M9 19.5c-4 1.2-4-2.1-5.6-2.6 M15 21v-3.4a3 3 0 0 0-.9-2.4c2.9-.3 5-1.5 5-5.4a4.2 4.2 0 0 0-1.2-2.9 3.9 3.9 0 0 0-.1-2.9s-1-.3-3.1 1.2a10.5 10.5 0 0 0-5.5 0C7 3.7 6 4 6 4a3.9 3.9 0 0 0-.1 2.9A4.2 4.2 0 0 0 4.7 9.8c0 3.9 2.1 5.1 5 5.4a3 3 0 0 0-.9 2.3V21',
  warning: 'M12 4.2 2.9 20h18.2z M12 10v4.2 M12 17.2h.01',
  graph: 'M6.5 8.2a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6Z M17.5 12.5a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6Z M8 20.5a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6Z M8.4 8.1l7.2 2 M7.2 10.3l.6 5.8 M11.6 18.2l4.2-4.6',
  calendar: 'M4.5 6.5h15v13h-15z M4.5 10.5h15 M8.5 4v4 M15.5 4v4',
  template: 'M5 3.5h9l4 4v13H5z M14 3.5v4h4 M8 12h8 M8 15.5h5',
  download: 'M12 4v10 M8 10.2l4 4 4-4 M5 19.5h14',
  focus: 'M4.5 9V5h4 M19.5 9V5h-4 M4.5 15v4h4 M19.5 15v4h-4',
  filter: 'M4 5.5h16l-6.2 7.4v5.6l-3.6 1.8v-7.4z',
  clock: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17Z M12 7.5V12l3 1.8',
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

const RING_PATH =
  'M 29.456 9.650 L 39.155 15.250 L 39.155 32.750 L 24.000 41.500 L 8.845 32.750 L 8.845 15.250 L 24.000 6.500 L 33.699 12.100';

/** The Carbon mark: a hexagonal ring with a single peach bond bead. */
export function LogoMark({ size = 32, tile = false }: { size?: number; tile?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Carbon"
      className={tile ? 'logo-tile' : 'logo-mark'}
    >
      {tile ? <rect x="2" y="2" width="44" height="44" rx="10" fill="#7A1F33" /> : null}
      <path
        d={RING_PATH}
        fill="none"
        stroke={tile ? '#F4A58A' : 'currentColor'}
        strokeWidth={4.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="31.578" cy="10.875" r={3.05} fill={tile ? '#FFF7F3' : 'var(--accent-2)'} />
    </svg>
  );
}

/** Mark plus the Carbon wordmark, for the startup screen and landing page. */
export function LogoWordmark({ size = 26 }: { size?: number }) {
  return (
    <span className="logo-wordmark">
      <LogoMark size={size} />
      <span className="logo-word">Carbon</span>
    </span>
  );
}
