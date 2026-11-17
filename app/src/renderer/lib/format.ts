export function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return 'never';
  const diff = Date.now() - timestamp;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function parentFolder(notePath: string): string {
  const parts = notePath.split('/');
  parts.pop();
  return parts.join('/');
}

export function displayName(notePath: string): string {
  return notePath.split('/').pop()?.replace(/\.md$/i, '') ?? notePath;
}

export function matchesFilter(notePath: string, filter: string): boolean {
  if (!filter.trim()) return true;
  return notePath.toLowerCase().includes(filter.trim().toLowerCase());
}
