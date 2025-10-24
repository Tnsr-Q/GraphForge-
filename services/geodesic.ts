import * as THREE from 'three';

/**
 * A simple, non-optimized priority queue for Dijkstra's algorithm.
 * For larger meshes, a binary heap would be more performant.
 */
class PriorityQueue {
    private elements: { item: number, priority: number }[] = [];

    enqueue(item: number, priority: number): void {
        this.elements.push({ item, priority });
        this.elements.sort((a, b) => a.priority - b.priority);
    }

    dequeue(): number | undefined {
        return this.elements.shift()?.item;
    }

    isEmpty(): boolean {
        return this.elements.length === 0;
    }
}

/**
 * Calculates the shortest path (geodesic) between two points on the surface of a mesh
 * using Dijkstra's algorithm on the mesh's vertices and edges.
 * @param startPoint - The starting point in world coordinates.
 * @param endPoint - The ending point in world coordinates.
 * @param geometry - The BufferGeometry of the mesh.
 * @returns An object containing the path (an array of Vector3) and the total distance.
 */
export function calculateGeodesicPath(
    startPoint: THREE.Vector3,
    endPoint: THREE.Vector3,
    geometry: THREE.BufferGeometry
): { path: THREE.Vector3[], distance: number } {
    if (!geometry.index) {
        console.warn("Geodesic calculation requires indexed geometry.");
        return { path: [startPoint, endPoint], distance: startPoint.distanceTo(endPoint) };
    }

    const positions = geometry.attributes.position.array;
    const indices = geometry.index.array;
    const vertices: THREE.Vector3[] = [];
    for (let i = 0; i < positions.length; i += 3) {
        vertices.push(new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]));
    }

    // 1. Build adjacency list representation of the mesh graph
    const graph = new Map<number, { neighbor: number, weight: number }[]>();
    for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i];
        const b = indices[i + 1];
        const c = indices[i + 2];
        const edges = [[a, b], [b, c], [c, a]];
        edges.forEach(([u, v]) => {
            if (!graph.has(u)) graph.set(u, []);
            if (!graph.has(v)) graph.set(v, []);
            const weight = vertices[u].distanceTo(vertices[v]);
            graph.get(u)!.push({ neighbor: v, weight });
            graph.get(v)!.push({ neighbor: u, weight });
        });
    }

    // 2. Find the closest mesh vertices to the start and end points
    const findClosestVertex = (point: THREE.Vector3) => {
        let closestIndex = -1;
        let minDistance = Infinity;
        vertices.forEach((vertex, index) => {
            const dist = point.distanceTo(vertex);
            if (dist < minDistance) {
                minDistance = dist;
                closestIndex = index;
            }
        });
        return closestIndex;
    };
    const startVertexIndex = findClosestVertex(startPoint);
    const endVertexIndex = findClosestVertex(endPoint);

    if (startVertexIndex === -1 || endVertexIndex === -1) {
        return { path: [], distance: 0 };
    }

    // 3. Run Dijkstra's algorithm
    const distances = new Array(vertices.length).fill(Infinity);
    const previous = new Array<number | null>(vertices.length).fill(null);
    const pq = new PriorityQueue();

    distances[startVertexIndex] = 0;
    pq.enqueue(startVertexIndex, 0);

    while (!pq.isEmpty()) {
        const u = pq.dequeue()!;
        if (u === endVertexIndex) break; // Found the shortest path

        const neighbors = graph.get(u) || [];
        for (const { neighbor, weight } of neighbors) {
            const newDist = distances[u] + weight;
            if (newDist < distances[neighbor]) {
                distances[neighbor] = newDist;
                previous[neighbor] = u;
                pq.enqueue(neighbor, newDist);
            }
        }
    }

    // 4. Reconstruct the path from the 'previous' array
    const path: THREE.Vector3[] = [];
    let current = endVertexIndex;
    while (current !== null) {
        path.unshift(vertices[current]);
        current = previous[current]!;
    }
    
    // Add the precise start/end points for accuracy
    if (path.length > 0) {
        path[0] = startPoint;
        path[path.length - 1] = endPoint;
    } else {
        // Handle case where start/end are the same vertex
        path.push(startPoint, endPoint);
    }

    const finalDistance = startPoint.distanceTo(vertices[startVertexIndex]) + distances[endVertexIndex] + endPoint.distanceTo(vertices[endVertexIndex]);

    return { path, distance: finalDistance };
}