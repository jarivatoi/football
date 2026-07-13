/**
 * SMS Pariaz Service
 * Service wrapper for SMS Pariaz extractor, matching the TotelepepService interface
 */

import { smspariazExtractor, SmspariazMatch } from './smspariazExtractor';

class SmspariazService {
  async getMatches(targetDate?: string): Promise<SmspariazMatch[]> {
    if (targetDate) {
      return await smspariazExtractor.extractMatches(targetDate);
    }
    
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return await smspariazExtractor.extractMatches(todayStr);
  }

  async getAvailableDatesWithCounts(): Promise<Array<{ date: string; matchCount: number; displayName: string }>> {
    return await smspariazExtractor.getAvailableDates();
  }

  async placeBet(params: {
    selections: Array<{ selectionId: string; odds: number }>;
    stake: number;
    betType?: 's' | 'a' | 'c';
  }) {
    return await smspariazExtractor.placeBet(params);
  }

  clearCache(): void {
    smspariazExtractor.clearCache();
  }
}

export const smspariazService = new SmspariazService();
