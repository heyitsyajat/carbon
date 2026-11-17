import { useApp } from '../state/store';
import { closeExport, exportCurrentNote } from '../state/actions';
import { Modal } from './Modal';
import { Icon } from './Icons';

const OPTIONS = [
  {
    format: 'markdown' as const,
    title: 'Markdown',
    detail: 'The note as written — frontmatter and all. Best for backups and other editors.',
    icon: 'note' as const,
  },
  {
    format: 'html' as const,
    title: 'HTML',
    detail: 'A single self-contained page with readable typography. Opens in any browser.',
    icon: 'download' as const,
  },
  {
    format: 'pdf' as const,
    title: 'PDF',
    detail: 'Typeset A4 pages with the note’s formatting preserved.',
    icon: 'template' as const,
  },
];

export function ExportDialog() {
  const open = useApp((state) => state.exportOpen);
  const tab = useApp((state) => state.tabs.find((entry) => entry.path === state.activePath) ?? null);
  if (!open) return null;

  return (
    <Modal
      title="Export note"
      subtitle={tab ? tab.path : 'Open a note to export it'}
      onClose={closeExport}
      size="small"
    >
      <div className="export-options">
        {OPTIONS.map((option) => (
          <button
            key={option.format}
            type="button"
            className="export-option"
            onClick={() => {
              closeExport();
              void exportCurrentNote(option.format);
            }}
          >
            <span className="export-icon">
              <Icon name={option.icon} size={16} />
            </span>
            <span className="export-text">
              <strong>{option.title}</strong>
              <span>{option.detail}</span>
            </span>
            <Icon name="chevron-right" size={13} />
          </button>
        ))}
      </div>
      <p className="field-hint">Carbon asks where to save, then shows the file in Explorer.</p>
    </Modal>
  );
}
