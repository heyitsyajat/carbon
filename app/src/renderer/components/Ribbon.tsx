import { useApp } from '../state/store';
import {
  createNote,
  openAIPanel,
  openDailyNote,
  openGraph,
  openPalette,
  openSearch,
  openSettings,
  toggleFocusMode,
  toggleLeftSidebar,
  updateSettings,
} from '../state/actions';
import { Icon, type IconName } from './Icons';

interface RibbonButtonProps {
  icon: IconName;
  label: string;
  onClick: () => void;
  active?: boolean;
}

function RibbonButton({ icon, label, onClick, active }: RibbonButtonProps) {
  return (
    <button
      type="button"
      className={`ribbon-button${active ? ' is-active' : ''}`}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      data-tooltip={label}
    >
      <Icon name={icon} size={18} />
    </button>
  );
}

export function Ribbon() {
  const explorerOpen = useApp((state) => state.explorerOpen);
  const hasVault = useApp((state) => Boolean(state.vault));
  const aiOpen = useApp((state) => state.ai.open);
  const aiEnabled = useApp((state) => state.settings.ai.enabled);
  const theme = useApp((state) => state.settings.theme);
  const focusMode = useApp((state) => state.focusMode);

  const cycleTheme = () => {
    const order: Array<'system' | 'light' | 'dark'> = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(theme) + 1) % order.length] ?? 'system';
    void updateSettings({ theme: next });
  };

  return (
    <nav className="ribbon" aria-label="Primary actions">
      <div className="ribbon-group">
        <RibbonButton
          icon="panel-left"
          label={explorerOpen ? 'Hide files (Ctrl+B)' : 'Show files (Ctrl+B)'}
          onClick={toggleLeftSidebar}
          active={explorerOpen}
        />
        {hasVault ? (
          <>
            <RibbonButton icon="search" label="Search vault (Ctrl+Shift+F)" onClick={() => openSearch()} />
            <RibbonButton icon="note" label="New note (Ctrl+N)" onClick={() => createNote()} />
            <RibbonButton icon="calendar" label="Today’s note (Ctrl+D)" onClick={() => void openDailyNote()} />
            <RibbonButton icon="graph" label="Graph view (Ctrl+G)" onClick={openGraph} />
            <RibbonButton
              icon="assistant"
              label={aiEnabled ? 'Writing assistant (Ctrl+K)' : 'Writing assistant — AI is optional'}
              onClick={() => openAIPanel()}
              active={aiOpen}
            />
          </>
        ) : null}
      </div>

      <div className="ribbon-group ribbon-bottom">
        <RibbonButton
          icon="command"
          label="Commands (Ctrl+P)"
          onClick={() => openPalette('commands')}
        />
        <RibbonButton
          icon="focus"
          label={focusMode ? 'Leave focus mode (Esc)' : 'Focus mode (Ctrl+Alt+F)'}
          onClick={toggleFocusMode}
          active={focusMode}
        />
        <RibbonButton icon={theme === 'dark' ? 'moon' : 'sun'} label={`Theme: ${theme}`} onClick={cycleTheme} />
        <RibbonButton icon="settings" label="Settings (Ctrl+,)" onClick={() => openSettings()} />
      </div>
    </nav>
  );
}
