/** Deterministic force layout for the note graph. Pure math, unit tested. */

export interface GraphNode {
  id: string;
  label: string;
  degree: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  pinned?: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
}

export interface GraphInputNote {
  path: string;
  title: string;
}

const MAX_NODES = 400;

export function buildGraph(
  notes: GraphInputNote[],
  outgoing: Record<string, string[]>,
  options: { width?: number; height?: number } = {},
): GraphModel {
  const width = options.width ?? 900;
  const height = options.height ?? 640;
  const sorted = [...notes].sort((a, b) => a.path.localeCompare(b.path)).slice(0, MAX_NODES);
  const known = new Set(sorted.map((note) => note.path));
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.34;

  const nodes: GraphNode[] = sorted.map((note, index) => {
    const angle = (index / Math.max(1, sorted.length)) * Math.PI * 2 - Math.PI / 2;
    return {
      id: note.path,
      label: note.title,
      degree: 0,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
    };
  });

  const seen = new Set<string>();
  const edges: GraphEdge[] = [];
  for (const [source, targets] of Object.entries(outgoing)) {
    if (!known.has(source)) continue;
    for (const target of targets) {
      if (!known.has(target) || target === source) continue;
      const key = `${source}->${target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source, target });
    }
  }

  const degree = new Map<string, number>();
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }
  for (const node of nodes) node.degree = degree.get(node.id) ?? 0;

  return { nodes, edges, width, height };
}

export interface StepOptions {
  repulsion?: number;
  springLength?: number;
  springStrength?: number;
  gravity?: number;
  damping?: number;
}

/** Advances the simulation one tick. Mutates node positions. */
export function stepGraph(model: GraphModel, options: StepOptions = {}): void {
  const repulsion = options.repulsion ?? 5200;
  const springLength = options.springLength ?? 118;
  const springStrength = options.springStrength ?? 0.016;
  const gravity = options.gravity ?? 0.0045;
  const damping = options.damping ?? 0.9;
  const centerX = model.width / 2;
  const centerY = model.height / 2;
  const byId = new Map(model.nodes.map((node) => [node.id, node]));

  for (let i = 0; i < model.nodes.length; i += 1) {
    const a = model.nodes[i]!;
    for (let j = i + 1; j < model.nodes.length; j += 1) {
      const b = model.nodes[j]!;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let distanceSq = dx * dx + dy * dy;
      if (distanceSq < 1) {
        // Deterministic separation for coincident nodes.
        dx = (i + 1) * 0.1;
        dy = (j + 1) * 0.1;
        distanceSq = dx * dx + dy * dy;
      }
      const distance = Math.sqrt(distanceSq);
      const force = repulsion / Math.max(distanceSq, 40);
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;
      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;
    }
  }

  for (const edge of model.edges) {
    const a = byId.get(edge.source);
    const b = byId.get(edge.target);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const force = (distance - springLength) * springStrength;
    const fx = (dx / distance) * force;
    const fy = (dy / distance) * force;
    a.vx += fx;
    a.vy += fy;
    b.vx -= fx;
    b.vy -= fy;
  }

  const padding = 28;
  for (const node of model.nodes) {
    node.vx += (centerX - node.x) * gravity;
    node.vy += (centerY - node.y) * gravity;
    if (node.pinned) {
      node.vx = 0;
      node.vy = 0;
      continue;
    }
    node.vx *= damping;
    node.vy *= damping;
    node.x = Math.min(model.width - padding, Math.max(padding, node.x + node.vx));
    node.y = Math.min(model.height - padding, Math.max(padding, node.y + node.vy));
  }
}

/**
 * Rescales settled positions to use the canvas, keeping the layout's shape.
 * Small graphs would otherwise sit in a small cluster in the middle.
 */
export function fitGraph(model: GraphModel, padding = 90): void {
  if (model.nodes.length === 0) return;
  const xs = model.nodes.map((node) => node.x);
  const ys = model.nodes.map((node) => node.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const availableWidth = Math.max(1, model.width - padding * 2);
  const availableHeight = Math.max(1, model.height - padding * 2);
  const scale = Math.min(availableWidth / spanX, availableHeight / spanY, 3);
  const offsetX = model.width / 2 - ((minX + maxX) / 2) * scale;
  const offsetY = model.height / 2 - ((minY + maxY) / 2) * scale;
  for (const node of model.nodes) {
    node.x = node.x * scale + offsetX;
    node.y = node.y * scale + offsetY;
    node.vx = 0;
    node.vy = 0;
  }
}

export function graphStats(model: GraphModel): { notes: number; links: number; isolated: number } {
  return {
    notes: model.nodes.length,
    links: model.edges.length,
    isolated: model.nodes.filter((node) => node.degree === 0).length,
  };
}

/** Radius used to draw a node, scaled by its link count. */
export function nodeRadius(node: GraphNode): number {
  return Math.min(17, 5.5 + Math.sqrt(node.degree) * 3.2);
}
