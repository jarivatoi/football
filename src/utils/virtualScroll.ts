/**
 * Virtual Scroll Manager for Match List
 * Only loads/updates matches that are visible in viewport
 * Dramatically reduces memory usage and API calls
 */

interface VirtualScrollConfig {
  itemHeight: number;        // Height of each match card (px)
  viewportHeight: number;    // Height of visible area (px)
  bufferSize: number;        // Number of items to preload above/below viewport
}

interface ScrollState {
  startIndex: number;        // First visible item index
  endIndex: number;          // Last visible item index
  totalItems: number;        // Total items in list
  scrollTop: number;         // Current scroll position
}

export class VirtualScrollManager {
  private config: VirtualScrollConfig;
  private state: ScrollState;
  private visibleCache: Map<string, boolean> = new Map(); // Track which matches are loaded

  constructor(config: VirtualScrollConfig) {
    this.config = config;
    this.state = {
      startIndex: 0,
      endIndex: Math.ceil(config.viewportHeight / config.itemHeight) + (config.bufferSize * 2),
      totalItems: 0,
      scrollTop: 0
    };
  }

  // Update total item count
  setTotalItems(total: number): void {
    this.state.totalItems = total;
    this.state.endIndex = Math.min(
      this.state.startIndex + Math.ceil(this.config.viewportHeight / this.config.itemHeight) + (this.config.bufferSize * 2),
      total
    );
  }

  // Handle scroll event
  handleScroll(scrollTop: number): ScrollState {
    this.state.scrollTop = scrollTop;
    
    const viewportItemIndex = Math.floor(scrollTop / this.config.itemHeight);
    
    this.state.startIndex = Math.max(0, viewportItemIndex - this.config.bufferSize);
    this.state.endIndex = Math.min(
      viewportItemIndex + Math.ceil(this.config.viewportHeight / this.config.itemHeight) + this.config.bufferSize,
      this.state.totalItems
    );

    return this.state;
  }

  // Get visible item indices
  getVisibleRange(): { start: number; end: number } {
    return {
      start: this.state.startIndex,
      end: this.state.endIndex
    };
  }

  // Check if a match at index is visible
  isIndexVisible(index: number): boolean {
    return index >= this.state.startIndex && index <= this.state.endIndex;
  }

  // Get total scroll height
  getTotalHeight(): number {
    return this.state.totalItems * this.config.itemHeight;
  }

  // Get offset for a specific index
  getOffsetForIndex(index: number): number {
    return index * this.config.itemHeight;
  }

  // Check if match markets need loading
  shouldLoadMarkets(matchId: string, index: number): boolean {
    // Only load if visible and not already loaded
    return this.isIndexVisible(index) && !this.visibleCache.has(matchId);
  }

  // Mark match as loaded
  markAsLoaded(matchId: string): void {
    this.visibleCache.set(matchId, true);
  }

  // Clear cache for a range of indices (useful when data changes)
  clearCacheRange(startIndex: number, endIndex: number): void {
    // Note: In real implementation, you'd track index->matchId mapping
    // For now, we clear everything (can be optimized)
    this.visibleCache.clear();
  }

  // Get current state
  getState(): ScrollState {
    return { ...this.state };
  }

  // Reset scroll state
  reset(): void {
    this.state.startIndex = 0;
    this.state.endIndex = Math.ceil(this.config.viewportHeight / this.config.itemHeight) + (this.config.bufferSize * 2);
    this.state.scrollTop = 0;
    this.visibleCache.clear();
  }
}

// Helper to estimate how many matches fit in viewport
export const calculateVisibleCount = (viewportHeight: number, itemHeight: number): number => {
  return Math.ceil(viewportHeight / itemHeight);
};
