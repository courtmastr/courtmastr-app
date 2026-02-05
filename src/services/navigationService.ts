/**
 * Service for managing navigation state and logic
 */

import { ref } from 'vue';
import type { Ref } from 'vue';

interface NavigationHistoryItem {
  path: string;
  title: string;
  timestamp: Date;
}

class NavigationService {
  private history: Ref<NavigationHistoryItem[]> = ref([]);
  private maxHistoryLength = 20;

  /**
   * Add a path to navigation history
   */
  addToHistory(path: string, title: string): void {
    const newItem: NavigationHistoryItem = {
      path,
      title,
      timestamp: new Date(),
    };

    // Add to history
    this.history.value.unshift(newItem);

    // Trim history if it exceeds max length
    if (this.history.value.length > this.maxHistoryLength) {
      this.history.value = this.history.value.slice(0, this.maxHistoryLength);
    }
  }

  /**
   * Get navigation history
   */
  getHistory(): NavigationHistoryItem[] {
    return this.history.value;
  }

  /**
   * Clear navigation history
   */
  clearHistory(): void {
    this.history.value = [];
  }

  /**
   * Get recent navigation items
   */
  getRecentItems(count: number = 5): NavigationHistoryItem[] {
    return this.history.value.slice(0, Math.min(count, this.history.value.length));
  }

  /**
   * Get previous page in history
   */
  getPreviousPage(): NavigationHistoryItem | null {
    if (this.history.value.length < 2) {
      return null;
    }
    // Return the previous item (index 1, since current is at index 0)
    return this.history.value[1];
  }

  /**
   * Check if a path exists in history
   */
  isInHistory(path: string): boolean {
    return this.history.value.some(item => item.path === path);
  }

  /**
   * Get breadcrumbs for a given path
   */
  getBreadcrumbsForPath(path: string): NavigationHistoryItem[] {
    // Find the position of the current path
    const currentIndex = this.history.value.findIndex(item => item.path === path);
    
    if (currentIndex === -1) {
      // If path is not in history, return empty array
      return [];
    }
    
    // Return all items up to the current index
    return this.history.value.slice(0, currentIndex + 1);
  }

  /**
   * Get commonly accessed pages
   */
  getCommonPages(): NavigationHistoryItem[] {
    const pathCounts = new Map<string, number>();
    
    // Count occurrences of each path
    this.history.value.forEach(item => {
      const count = pathCounts.get(item.path) || 0;
      pathCounts.set(item.path, count + 1);
    });
    
    // Sort by frequency and return top 5
    return Array.from(pathCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([path, _count]) => {
        // Find the title for the most recent occurrence of this path
        const item = this.history.value.find(h => h.path === path);
        return {
          path,
          title: item?.title || path,
          timestamp: new Date(),
        };
      });
  }
}

// Create a singleton instance
const navigationService = new NavigationService();

export { NavigationService, navigationService };