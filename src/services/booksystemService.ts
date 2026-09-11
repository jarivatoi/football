/**
 * Booksystem Service
 * Service wrapper for Booksystem extractor, matching the TotelepepService interface
 */

import { booksystemExtractor, BooksystemMatch } from './booksystemExtractor';

class BooksystemService {
  async getMatches(targetDate?: string): Promise<BooksystemMatch[]> {
    if (targetDate) {
      return await booksystemExtractor.extractMatches(targetDate);
    }
    
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return await booksystemExtractor.extractMatches(todayStr);
  }

  async getAvailableDatesWithCounts(): Promise<Array<{ date: string; matchCount: number; displayName: string }>> {
    return await booksystemExtractor.getAvailableDates();
  }

  clearCache(): void {
    booksystemExtractor.clearCache();
  }
}

export const booksystemService = new BooksystemService();
