import type { Node, Edge, Skeleton, Point } from '../../types';

export class SkeletonEditor {
  private skeleton: Skeleton;

  constructor(name: string = 'New Skeleton') {
    this.skeleton = {
      id: this.generateId(),
      name,
      nodes: [],
      edges: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11);
  }

  private updateTimestamp(): void {
    this.skeleton.updatedAt = new Date();
  }

  addNode(position: Point, mass: number = 1, isFixed: boolean = false, maxStress: number = 100): Node {
    const node: Node = {
      id: this.generateId(),
      position: { ...position },
      velocity: { x: 0, y: 0, z: 0 },
      acceleration: { x: 0, y: 0, z: 0 },
      mass,
      isFixed,
      stress: 0,
      maxStress,
    };
    this.skeleton.nodes.push(node);
    this.updateTimestamp();
    return node;
  }

  removeNode(nodeId: string): boolean {
    const index = this.skeleton.nodes.findIndex(n => n.id === nodeId);
    if (index === -1) return false;

    this.skeleton.edges = this.skeleton.edges.filter(
      e => e.startNodeId !== nodeId && e.endNodeId !== nodeId
    );
    this.skeleton.nodes.splice(index, 1);
    this.updateTimestamp();
    return true;
  }

  getNode(nodeId: string): Node | undefined {
    return this.skeleton.nodes.find(n => n.id === nodeId);
  }

  updateNodePosition(nodeId: string, newPosition: Point): boolean {
    const node = this.getNode(nodeId);
    if (!node) return false;
    node.position = { ...newPosition };
    this.updateTimestamp();
    return true;
  }

  setNodeFixed(nodeId: string, isFixed: boolean): boolean {
    const node = this.getNode(nodeId);
    if (!node) return false;
    node.isFixed = isFixed;
    this.updateTimestamp();
    return true;
  }

  addEdge(startNodeId: string, endNodeId: string, stiffness: number = 100, damping: number = 0.1, maxForce: number = 500): Edge | null {
    const startNode = this.getNode(startNodeId);
    const endNode = this.getNode(endNodeId);
    if (!startNode || !endNode) return null;

    const dx = endNode.position.x - startNode.position.x;
    const dy = endNode.position.y - startNode.position.y;
    const dz = endNode.position.z - startNode.position.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const edge: Edge = {
      id: this.generateId(),
      startNodeId,
      endNodeId,
      length,
      stiffness,
      damping,
      currentForce: 0,
      maxForce,
    };
    this.skeleton.edges.push(edge);
    this.updateTimestamp();
    return edge;
  }

  removeEdge(edgeId: string): boolean {
    const index = this.skeleton.edges.findIndex(e => e.id === edgeId);
    if (index === -1) return false;
    this.skeleton.edges.splice(index, 1);
    this.updateTimestamp();
    return true;
  }

  getEdge(edgeId: string): Edge | undefined {
    return this.skeleton.edges.find(e => e.id === edgeId);
  }

  getSkeleton(): Skeleton {
    return JSON.parse(JSON.stringify(this.skeleton));
  }

  loadSkeleton(skeleton: Skeleton): void {
    this.skeleton = JSON.parse(JSON.stringify(skeleton));
    this.updateTimestamp();
  }

  renameSkeleton(name: string): void {
    this.skeleton.name = name;
    this.updateTimestamp();
  }

  getNodeCount(): number {
    return this.skeleton.nodes.length;
  }

  getEdgeCount(): number {
    return this.skeleton.edges.length;
  }

  getConnectedEdges(nodeId: string): Edge[] {
    return this.skeleton.edges.filter(
      e => e.startNodeId === nodeId || e.endNodeId === nodeId
    );
  }

  getNeighborNodes(nodeId: string): Node[] {
    const edges = this.getConnectedEdges(nodeId);
    const neighborIds = new Set<string>();
    edges.forEach(e => {
      if (e.startNodeId === nodeId) neighborIds.add(e.endNodeId);
      if (e.endNodeId === nodeId) neighborIds.add(e.startNodeId);
    });
    return this.skeleton.nodes.filter(n => neighborIds.has(n.id));
  }

  clear(): void {
    this.skeleton.nodes = [];
    this.skeleton.edges = [];
    this.updateTimestamp();
  }

  createRegularPolygon(center: Point, radius: number, sides: number, height: number = 0): Node[] {
    const nodes: Node[] = [];
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2;
      const position = {
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
        z: center.z + height,
      };
      nodes.push(this.addNode(position));
    }
    for (let i = 0; i < sides; i++) {
      this.addEdge(nodes[i].id, nodes[(i + 1) % sides].id);
    }
    return nodes;
  }

  createLanternFrame(center: Point, radius: number, height: number): Skeleton {
    this.clear();
    const topNodes = this.createRegularPolygon(center, radius, 8, height / 2);
    const bottomNodes = this.createRegularPolygon(center, radius, 8, -height / 2);
    for (let i = 0; i < 8; i++) {
      this.addEdge(topNodes[i].id, bottomNodes[i].id);
    }
    const topCenter = this.addNode({ ...center, z: center.z + height / 2 }, 1, true);
    const bottomCenter = this.addNode({ ...center, z: center.z - height / 2 }, 1, true);
    for (let i = 0; i < 8; i++) {
      this.addEdge(topCenter.id, topNodes[i].id);
      this.addEdge(bottomCenter.id, bottomNodes[i].id);
    }
    return this.getSkeleton();
  }
}
