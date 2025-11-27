/**
 * State management for MCP server snapshots
 */

import type { Snapshot, MCPServerState, CompareResult } from '../types/schemas.js';

class StateManager {
  private state: MCPServerState = {};
  private snapshots: Map<string, Snapshot> = new Map();
  private idCounter: number = 0;

  /**
   * Generate a unique snapshot ID
   */
  generateSnapshotId(): string {
    // Use timestamp + counter to ensure uniqueness even when called rapidly
    const timestamp = Date.now();
    const counter = this.idCounter++;
    return `snap_${timestamp}_${counter}`;
  }

  /**
   * Store a new snapshot
   */
  setSnapshot(snapshot: Snapshot): void {
    this.snapshots.set(snapshot.id, snapshot);
    this.state.currentSnapshot = snapshot;
  }

  /**
   * Get a snapshot by ID
   */
  getSnapshot(id: string): Snapshot | undefined {
    return this.snapshots.get(id);
  }

  /**
   * Get the current (most recent) snapshot
   */
  getCurrentSnapshot(): Snapshot | undefined {
    return this.state.currentSnapshot;
  }

  /**
   * Get all snapshots
   */
  getAllSnapshots(): Snapshot[] {
    return Array.from(this.snapshots.values());
  }

  /**
   * Store the last compare result
   */
  setLastCompareResult(result: CompareResult): void {
    this.state.lastCompareResult = result;
  }

  /**
   * Get the last compare result
   */
  getLastCompareResult(): CompareResult | undefined {
    return this.state.lastCompareResult;
  }

  /**
   * Clear old snapshots (cleanup)
   * @param maxAge - Maximum age in milliseconds (default: 1 hour)
   */
  cleanupOldSnapshots(maxAge: number = 60 * 60 * 1000): void {
    const now = Date.now();
    for (const [id, snapshot] of this.snapshots.entries()) {
      const age = now - new Date(snapshot.createdAt).getTime();
      if (age > maxAge) {
        this.snapshots.delete(id);
      }
    }
  }

  /**
   * Clear all state
   */
  reset(): void {
    this.snapshots.clear();
    this.state = {};
  }
}

// Singleton instance
export const stateManager = new StateManager();
