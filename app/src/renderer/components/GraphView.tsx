import { useEffect, useMemo } from 'react';
import { buildGraph, fitGraph, graphStats, nodeRadius, stepGraph } from '@shared/graph';
import { useApp } from '../state/store';
import { closeGraph, openNote } from '../state/actions';
import { Icon } from './Icons';

const WIDTH = 960;
const HEIGHT = 620;

/** Force-directed view of the vault. Click a note to open it. */
export function GraphView() {
  const open = useApp((state) => state.graphOpen);
  const notes = useApp((state) => state.notes);
  const links = useApp((state) => state.links);
  const activePath = useApp((state) => state.activePath);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeGraph();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const model = useMemo(() => {
    if (!open) return null;
    const graph = buildGraph(notes, links.outgoing, { width: WIDTH, height: HEIGHT });
    for (let tick = 0; tick < 240; tick += 1) stepGraph(graph);
    fitGraph(graph);
    return graph;
  }, [open, notes, links]);

  if (!open || !model) return null;
  const stats = graphStats(model);

  return (
    <div className="graph-overlay" role="dialog" aria-modal="true" aria-label="Note graph">
      <div className="graph-panel">
        <header className="graph-header">
          <div>
            <h2>Graph view</h2>
            <p>
              {stats.notes} notes · {stats.links} links · {stats.isolated} unlinked
            </p>
          </div>
          <div className="graph-legend">
            <span>
              <i className="legend-dot is-active" /> current
            </span>
            <span>
              <i className="legend-dot" /> note
            </span>
            <button type="button" className="icon-button" onClick={closeGraph} aria-label="Close graph">
              <Icon name="close" size={15} />
            </button>
          </div>
        </header>

        <div className="graph-canvas">
          {model.nodes.length === 0 ? (
            <p className="graph-empty">No notes yet. Create a note and link it with [[brackets]].</p>
          ) : (
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Force layout of note links">
              <g className="graph-edges">
                {model.edges.map((edge) => {
                  const source = model.nodes.find((node) => node.id === edge.source);
                  const target = model.nodes.find((node) => node.id === edge.target);
                  if (!source || !target) return null;
                  return (
                    <line
                      key={`${edge.source}->${edge.target}`}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                    />
                  );
                })}
              </g>
              <g className="graph-nodes">
                {model.nodes.map((node) => (
                  <g
                    key={node.id}
                    className={`graph-node${node.id === activePath ? ' is-active' : ''}`}
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={() => {
                      void openNote(node.id);
                      closeGraph();
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={node.label}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void openNote(node.id);
                        closeGraph();
                      }
                    }}
                  >
                    <circle r={nodeRadius(node)} />
                    <circle r={nodeRadius(node) + 6} className="graph-hit" />
                    {node.degree >= 2 || node.id === activePath ? (
                      <text y={-nodeRadius(node) - 6} textAnchor="middle">
                        {node.label.length > 26 ? `${node.label.slice(0, 24)}…` : node.label}
                      </text>
                    ) : null}
                  </g>
                ))}
              </g>
            </svg>
          )}
        </div>

        <footer className="graph-footer">
          <span>Links come from [[wiki links]] in note bodies.</span>
          <button type="button" className="button button-secondary button-small" onClick={closeGraph}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
