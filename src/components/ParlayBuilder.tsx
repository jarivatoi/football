import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Trash2, Calculator, DollarSign, CheckCircle, AlertCircle, X, Save, History } from 'lucide-react';
import { ApiSource } from './Header';
import { SavedBooking, saveBookingToDB, getAllBookingsFromDB, deleteBookingFromDB, clearAllBookingsFromDB } from '../utils/bookingStorage';
import html2canvas from 'html2canvas';

// Helper function to format currency - remove .00 for whole numbers
const formatCurrency = (amount: number): string => {
  if (Number.isInteger(amount)) {
    return amount.toString();
  }
  return amount.toFixed(2);
};

// Totelepep betting API integration
const placeTotelepepBet = async (selections: ParlaySelection[], stake: number, selectedSource?: ApiSource) => {
  try {
    // Build the form data in Totelepep's exact format
    const formData = new URLSearchParams();
    // Multi-bet data (populate when multiple selections for parlay)
    if (selections.length > 1) {
      // Calculate total odds for multi-bet
      const totalOdds = selections.reduce((acc, sel) => {
        const odds = typeof sel.odds === 'string' ? parseFloat(sel.odds) : sel.odds;
        return acc * odds;
      }, 1);
          
      // Set MultiStake for parlay bets
      formData.append('data[MultiStake]', stake.toString());
      formData.append('data[MultiReturn]', (stake * totalOdds).toFixed(2));
    } else {
      formData.append('data[MultiStake]', '');
    }
        
    // Add each selection as SingleBets array
    selections.forEach((selection, index) => {
      // Specific debug for PSV Eindhoven vs ZFK Minsk or any match
      if (selection.homeTeam && selection.awayTeam) {
      }
          
      // Map selection type to option details FIRST (needed for betRef)
      const optionDetails = getOptionDetails(selection);
      // Generate betRef (format: marketId-optionNo) - Use ACTUAL marketId from GetMatch API
      // DO NOT use marketBookNo which is only for 1X2!
      const marketIdToUse = (selection.marketId && selection.marketId !== '0' && selection.marketId !== 'undefined' && selection.marketId !== 'null')
        ? selection.marketId
        : (selection.matchId || '0');
      const betRef = `${marketIdToUse}-${optionDetails.optionNo}`;
      // Extract real market data from the match
      const marketData = extractMarketData(selection);
      // Additional validation for market data to ensure we don't send "null" or "undefined" strings
      let finalMarketBookNo = marketData.marketBookNo;
      let finalMarketCode = marketData.marketCode;
      // Use marketBookNo when available, with minimal validation
      // Only override if the value is truly invalid
      const hasUsableFinalMarketBookNo = finalMarketBookNo && 
        finalMarketBookNo !== 'undefined' && 
        finalMarketBookNo !== 'null' && 
        finalMarketBookNo.trim() !== '' && 
        finalMarketBookNo.trim() !== '0' &&
        !isNaN(Number(finalMarketBookNo));
      
      if (!hasUsableFinalMarketBookNo) {
        // Only use fallback if we don't already have a valid marketBookNo from the selection
        if (!selection.marketBookNo || selection.marketBookNo === 'undefined' || selection.marketBookNo === 'null' || selection.marketBookNo.trim() === '' || selection.marketBookNo.trim() === '0' || isNaN(Number(selection.marketBookNo))) {
          finalMarketBookNo = selection.matchId || '76713';
        } else {
          finalMarketBookNo = selection.marketBookNo;
        }
      }
      
      // Ensure finalMarketBookNo is always a string
      if (!finalMarketBookNo) {
        // Check if selection has a valid marketBookNo first
        if (selection.marketBookNo && selection.marketBookNo !== 'undefined' && selection.marketBookNo !== 'null' && selection.marketBookNo.trim() !== '' && selection.marketBookNo.trim() !== '0' && !isNaN(Number(selection.marketBookNo))) {
          finalMarketBookNo = selection.marketBookNo;
        } else {
          finalMarketBookNo = selection.matchId || '76713';
        }
      }
      
      // Only override marketCode if it's truly invalid
      if (!finalMarketCode || finalMarketCode === 'undefined' || finalMarketCode === 'null' || finalMarketCode.trim() === '') {
        // Check if selection has a valid marketCode first
        if (selection.marketCode && selection.marketCode !== 'undefined' && selection.marketCode !== 'null' && selection.marketCode.trim() !== '') {
          finalMarketCode = selection.marketCode;
        } else {
          finalMarketCode = 'CP';
        }
      }
      
      // Ensure marketBookNo is a valid number
      // Only apply this check if we're not using the original selection's marketBookNo
      if (finalMarketBookNo !== selection.marketBookNo && isNaN(Number(finalMarketBookNo))) {
        // Try to use the original selection's marketBookNo if it's valid
        if (selection.marketBookNo && !isNaN(Number(selection.marketBookNo)) && Number(selection.marketBookNo) > 0) {
          finalMarketBookNo = selection.marketBookNo;
        } else {
          finalMarketBookNo = selection.matchId || '76713';
        }
      }
      
      // Additional safety checks
      // Ensure we have valid string values
      // Only override if we don't have a valid marketBookNo from the selection
      if (!finalMarketBookNo || typeof finalMarketBookNo !== 'string' || finalMarketBookNo === 'null' || finalMarketBookNo === 'undefined' || finalMarketBookNo.trim() === '') {
        // Try to use the original selection's marketBookNo if it's valid
        if (selection.marketBookNo && selection.marketBookNo !== 'null' && selection.marketBookNo !== 'undefined' && selection.marketBookNo.trim() !== '' && !isNaN(Number(selection.marketBookNo)) && Number(selection.marketBookNo) > 0) {
          finalMarketBookNo = selection.marketBookNo;
        } else {
          finalMarketBookNo = selection.matchId || '76713';
        }
      }
      
      // Only override marketCode if it's truly invalid
      if (!finalMarketCode || typeof finalMarketCode !== 'string' || finalMarketCode === 'null' || finalMarketCode === 'undefined' || finalMarketCode.trim() === '') {
        // Try to use the original selection's marketCode if it's valid
        if (selection.marketCode && selection.marketCode !== 'null' && selection.marketCode !== 'undefined' && selection.marketCode.trim() !== '') {
          finalMarketCode = selection.marketCode;
        } else {
          finalMarketCode = 'CP';
        }
      }

      formData.append(`data[SingleBets][${index}][betRef]`, betRef);
      formData.append(`data[SingleBets][${index}][isRacing]`, 'false');
      formData.append(`data[SingleBets][${index}][legNo]`, (index + 1).toString()); // Increment legNo: 1, 2, 3...
      formData.append(`data[SingleBets][${index}][matchName]`, `${selection.homeTeam} v ${selection.awayTeam}`);
      formData.append(`data[SingleBets][${index}][matchStartTime]`, formatMatchTime(selection.kickoff));
      formData.append(`data[SingleBets][${index}][matchRunTime]`, '0');
      
      // CRITICAL: Use API values if available, otherwise fall back to getOptionDetails() mapping
      // IMPORTANT: selection.optionNo must be numeric (1, 2, 3), not a letter (X, H, D, A)
      const apiOptionNo = (selection.optionNo && /^[0-9]+$/.test(selection.optionNo)) ? selection.optionNo : optionDetails.optionNo;
      // IMPORTANT: selection.optionCode must be valid (H, D, A, O, U, etc.), not market codes like 'X'
      const apiOptionCode = (selection.optionCode && /^[HDAOU12YNC]+$/.test(selection.optionCode)) ? selection.optionCode : optionDetails.optionCode;
      const apiOptionName = optionDetails.optionName;  // Always use getOptionDetails for optionName
      
      formData.append(`data[SingleBets][${index}][optionNo]`, apiOptionNo);
      formData.append(`data[SingleBets][${index}][optionCode]`, apiOptionCode);
      formData.append(`data[SingleBets][${index}][optionName]`, apiOptionName);
      formData.append(`data[SingleBets][${index}][optionOdd]`, selection.odds.toString());
      formData.append(`data[SingleBets][${index}][optionPreviousOdd]`, selection.odds.toString());
      formData.append(`data[SingleBets][${index}][sportName]`, 'Soccer');
      formData.append(`data[SingleBets][${index}][sportIcon]`, 'soccer_icn');
      formData.append(`data[SingleBets][${index}][competitionName]`, marketData.competitionName);
      formData.append(`data[SingleBets][${index}][competitionId]`, marketData.competitionId);
      
      // CRITICAL: Use selection.marketId (actual market ID from GetMatch API like 96909 for Highest Scoring Half)
      // DO NOT fall back to marketBookNo which is only for 1X2!
      const marketId = (selection.marketId && selection.marketId !== '0' && selection.marketId !== 'undefined' && selection.marketId !== 'null')
        ? selection.marketId
        : (selection.matchId || '0');
      // Special handling for the correct marketBookNo
      if (selection.marketBookNo === '5160495') {
      }
      
      // Ensure we're not sending undefined or null values
      // Use the actual marketBookNo and marketCode values when available
      // Simplified logic to ensure we send the correct values
      // Enhanced validation to ensure we always send valid string values
      let safeMarketBookNo = '76713'; // Default fallback
      let safeMarketCode = 'CP'; // Default fallback
      
      console.log(`[Bet Placement] Selection ${index + 1}:`, {
        matchId: selection.matchId,
        homeTeam: selection.homeTeam,
        awayTeam: selection.awayTeam,
        priceType: selection.priceType,
        marketBookNo: selection.marketBookNo,
        marketCode: selection.marketCode,
        marketId: selection.marketId
      });
      
      // Priority 1: Use selection.marketBookNo if it's valid
      if (selection.marketBookNo && 
          typeof selection.marketBookNo === 'string' && 
          selection.marketBookNo !== 'null' && 
          selection.marketBookNo !== 'undefined' && 
          selection.marketBookNo.trim() !== '' && 
          selection.marketBookNo.trim() !== '0') {
        safeMarketBookNo = selection.marketBookNo;
      }
      // Priority 2: Use finalMarketBookNo if it's valid
      else if (finalMarketBookNo && 
               typeof finalMarketBookNo === 'string' && 
               finalMarketBookNo !== 'null' && 
               finalMarketBookNo !== 'undefined' && 
               finalMarketBookNo.trim() !== '' && 
               finalMarketBookNo.trim() !== '0') {
        safeMarketBookNo = finalMarketBookNo;
      }
      // Priority 3: Use selection.matchId as fallback
      else if (selection.matchId && 
               typeof selection.matchId === 'string' && 
               selection.matchId !== 'null' && 
               selection.matchId !== 'undefined' && 
               selection.matchId.trim() !== '' && 
               selection.matchId.trim() !== '0') {
        safeMarketBookNo = selection.matchId;
      }
      
      // Same priority logic for marketCode
      if (selection.marketCode && 
          typeof selection.marketCode === 'string' && 
          selection.marketCode !== 'null' && 
          selection.marketCode !== 'undefined' && 
          selection.marketCode.trim() !== '') {
        safeMarketCode = selection.marketCode;
      }
      else if (finalMarketCode && 
               typeof finalMarketCode === 'string' && 
               finalMarketCode !== 'null' && 
               finalMarketCode !== 'undefined' && 
               finalMarketCode.trim() !== '') {
        safeMarketCode = finalMarketCode;
      }
      // Default fallback for marketCode
      else {
        safeMarketCode = 'CP';
      }
      
      // Debug the form data being added

      formData.append(`data[SingleBets][${index}][marketId]`, marketId);
      formData.append(`data[SingleBets][${index}][marketBookNo]`, safeMarketBookNo);
      // Use optionDetails.marketType (e.g., '1X2', 'OU', 'BTTS') instead of selection.marketCode
      formData.append(`data[SingleBets][${index}][marketCode]`, selection.marketCode || 'CP');  // Use CP for Win-Draw-Win
      formData.append(`data[SingleBets][${index}][marketLine]`, selection.marketLine || '');  // Use market line from selection
      formData.append(`data[SingleBets][${index}][marketIsLive]`, '0');
      formData.append(`data[SingleBets][${index}][marketIsRacing]`, '0');
      formData.append(`data[SingleBets][${index}][marketPeriodCode]`, selection.periodCode || 'FT');  // Use period code from selection
      
      // Determine market display name - use API value if available
      let marketDisplayName = selection.marketDisplayName || '1 X 2'; // Default
      
      // For All Markets selections without marketDisplayName, build it from components
      if (!selection.marketDisplayName && selection.priceType.includes('-') && !['home', 'draw', 'away', 'over', 'under', 'btts_yes', 'btts_no'].includes(selection.priceType)) {
        // Use marketCode, marketLine, and periodCode to build display name
        const code = selection.marketCode?.toUpperCase() || '';
        const line = selection.marketLine || '';
        const period = selection.periodCode || 'FT';
        
        // Build period suffix
        const periodSuffix = period === 'FT' ? '' : (period === 'H1' ? ' - Half Time' : period === '2H' ? ' - 2nd Half' : ` - ${period}`);
        
        if (code === 'HSH') {
          marketDisplayName = 'Highest Scoring Half';
        } else if (code === 'CP') {
          marketDisplayName = '1 X 2';
        } else if (code === 'DC' || code === 'DOUBLECHANCE') {
          marketDisplayName = 'Double Chance';
        } else if (code === 'OU' || code === 'UO') {
          marketDisplayName = line ? `Under Over ${line}${periodSuffix}` : `Over/Under${periodSuffix}`;
        } else if (code === 'BTTS') {
          marketDisplayName = 'Both Teams To Score';
        } else if (code === 'AH' || code === 'HC') {
          marketDisplayName = line ? `Asian Handicap ${line}${periodSuffix}` : `Asian Handicap${periodSuffix}`;
        } else {
          // Fallback: use the marketCode with line and period
          marketDisplayName = selection.marketCode ? `${selection.marketCode}${line ? ` ${line}` : ''}${periodSuffix}` : '1 X 2';
        }
      } else {
        // Standard quick selections
        marketDisplayName = optionDetails.marketType === '1X2' ? '1 X 2' : 
                           optionDetails.marketType === 'OU' ? 'Over/Under 2.5' : 
                           optionDetails.marketType === 'BTTS' ? 'Both Teams To Score' : '1 X 2';
      }
      
      formData.append(`data[SingleBets][${index}][marketDisplayName]`, marketDisplayName);
      // For multi-bets, stake should be empty (stake is in MultiStake)
      // For single bets, stake should be the amount
      formData.append(`data[SingleBets][${index}][stake]`, selections.length > 1 ? '' : stake.toString());
      formData.append(`data[SingleBets][${index}][returnAmount]`, selections.length > 1 ? '0.00' : (Number(stake) * Number(selection.odds)).toFixed(2));
      formData.append(`data[SingleBets][${index}][potentialPayout]`, '');
      formData.append(`data[SingleBets][${index}][ticketNo]`, '');
      formData.append(`data[SingleBets][${index}][taxAmount]`, '');
      formData.append(`data[SingleBets][${index}][rebatePercentage]`, '0');
      formData.append(`data[SingleBets][${index}][rebateAmount]`, '');
      formData.append(`data[SingleBets][${index}][bonusPercentage]`, '0');
      formData.append(`data[SingleBets][${index}][bonusAmount]`, '');
      formData.append(`data[SingleBets][${index}][betErrorCode]`, '0');
      formData.append(`data[SingleBets][${index}][betErrorMessage]`, 'null');
      formData.append(`data[SingleBets][${index}][legErrorCode]`, '0');
      formData.append(`data[SingleBets][${index}][legErrorMessage]`, 'None');
      formData.append(`data[SingleBets][${index}][meetingId]`, '0');
      formData.append(`data[SingleBets][${index}][raceId]`, '0');
      formData.append(`data[SingleBets][${index}][raceNo]`, '');
      formData.append(`data[SingleBets][${index}][runnerNo]`, '');
      formData.append(`data[SingleBets][${index}][runnerName]`, '');
      formData.append(`data[SingleBets][${index}][barrierNo]`, '0');
      formData.append(`data[SingleBets][${index}][racingName]`, '');
      formData.append(`data[SingleBets][${index}][priceTag]`, '');
      formData.append(`data[SingleBets][${index}][market]`, '');
    });
    
    // Proxy bet flag
    formData.append('data[ProxyBet]', '0');
    // Parse and log the form data for easier reading
    const formDataObj: Record<string, string> = {};
    formData.forEach((value, key) => {
      formDataObj[key] = value.toString();
    });
    // Additional debugging to check specific market fields
    for (let [key, value] of formData.entries()) {
      if (key.includes('marketBookNo') || key.includes('marketCode') || key.includes('marketId')) {
      }
    }
    
    // Additional specific check for marketBookNo and marketCode fields
    Object.keys(formDataObj).forEach(key => {
      if (key.includes('marketBookNo') || key.includes('marketCode')) {
        // Check if the value is actually "null" or "undefined" as strings
        if (formDataObj[key] === 'null' || formDataObj[key] === 'undefined') {
        }
      }
    });
    
    // Place bet on API (with CORS proxy for GitHub Pages)
    // Use selected source or default to Totelepep
    const baseUrl = selectedSource?.baseUrl.replace('/webapi/GetSport', '') || 'https://www.totelepep.mu';
    const betUrl = 'https://zaleugflzamrkrfkrcsa.supabase.co/functions/v1/cors-proxy?url=' + encodeURIComponent(`${baseUrl}/webapi/placebet`);
    
    console.log('[Bet Placement] API Info:', {
      selectedSourceId: selectedSource?.id,
      selectedSourceBaseUrl: selectedSource?.baseUrl,
      extractedBaseUrl: baseUrl,
      betUrl: betUrl
    });
    
    // Log the complete form data being sent

    const response = await fetch(betUrl, {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    // Debug response details
    // Log betList if it exists
    if (result.betList && result.betList.length > 0) {
    }
    
    // Extract ticket number from the response
    let ticketNo = result.ticketNo;

    // Try multiple possible field names for ticket number
    if (!ticketNo) {
      const possibleFields = [
        'ticketNo', 'ticket', 'bookingRef', 'bookingRefNo', 'bookingNo',
        'refNo', 'referenceNo', 'reference', 'ticketId', 'betSlipNo',
        'slipNo', 'receiptNo', 'receiptNumber'
      ];
      
      for (const field of possibleFields) {
        if (result[field]) {
          ticketNo = result[field];
          break;
        }
      }
    }
    
    // Check if ticketNo is in the betList
    if (!ticketNo && result.betList && Array.isArray(result.betList) && result.betList.length > 0) {
      const firstBet = result.betList[0];
      // Try ticketNo first
      if (firstBet.ticketNo) {
        ticketNo = firstBet.ticketNo;
      }
      // Fallback to bookingReference
      else if (firstBet.bookingReference) {
        ticketNo = firstBet.bookingReference;
      }
    }
    
    // Also check top-level bookingReference
    if (!ticketNo && result.bookingReference) {
      ticketNo = result.bookingReference;
    }
    
    // If ticketNo is in the format "Booking Ref# 123456789", extract just the number
    if (ticketNo && typeof ticketNo === 'string' && ticketNo.includes('#')) {
      const match = ticketNo.match(/# (\d+)/);
      if (match && match[1]) {
        ticketNo = match[1];
      } else {
        // Try alternative patterns
        const altMatch = ticketNo.match(/#(\d+)/) || ticketNo.match(/(\d+)/);
        if (altMatch && altMatch[1]) {
          ticketNo = altMatch[1];
        }
      }
    }

    // Enhanced success determination logic
    // Consider successful if we have a ticket, regardless of errorMessage
    // This handles cases where the API returns a ticket but also has warning messages
    const isSuccessful = !!ticketNo || (!result.errorMessage && !result.multiErrorMessage);
    
    return {
      success: isSuccessful,
      ticketNo: ticketNo,
      potentialPayout: result.betList && result.betList.length > 0 
        ? result.betList[0].potentialPayout  // Use potentialPayout from betList for single bets
        : result.potentialPayout,  // Use top-level potentialPayout for multi-bets
      errorMessage: result.errorMessage,
      multiErrorMessage: result.multiErrorMessage,
      balanceAmount: result.balanceAmount,
      betList: result.betList,
      // Include multi-bet fields for breakdown calculation
      multiStake: result.multiStake,
      multiPrice: result.multiPrice,
      taxAmount: result.taxAmount,
      bonusAmount: result.bonusAmount,
      rebateAmount: result.rebateAmount,
      bookingReference: result.bookingReference
    };
    
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Network error'
    };
  }
};

// Extract market data based on match and league
const extractMarketData = (selection: ParlaySelection) => {
  // Use the actual competitionId from the match data
  const competitionId = selection.competitionId || '52'; // Default to Japan Emperor Cup
  const league = selection.league || 'Football League';
  
  // Use the actual marketBookNo and marketCode from the match data, with proper fallbacks
  // Try marketBookNo first, then matchId as fallback, then default
  // Use marketBookNo when available, with minimal validation
  const hasUsableMarketBookNo = selection.marketBookNo && 
    selection.marketBookNo !== 'undefined' && 
    selection.marketBookNo !== 'null' && 
    selection.marketBookNo.trim() !== '' && 
    selection.marketBookNo.trim() !== '0';
    
  let marketBookNo = hasUsableMarketBookNo
    ? selection.marketBookNo 
    : (selection.matchId || '76713');
    
  let marketCode = (selection.marketCode && selection.marketCode !== 'undefined' && selection.marketCode !== 'null' && selection.marketCode.trim() !== '') 
    ? selection.marketCode
    : 'CP';
  
  // Additional validation to ensure we don't send "null" or "undefined" strings
  if (marketBookNo === 'null' || marketBookNo === 'undefined') {
    marketBookNo = selection.matchId || '76713';
  }
  
  if (marketCode === 'null' || marketCode === 'undefined') {
    marketCode = 'CP';
  }
  
  // Additional safety checks
  // Ensure we have valid string values
  if (!marketBookNo || typeof marketBookNo !== 'string') {
    marketBookNo = selection.matchId || '76713';
  }
  
  if (!marketCode || typeof marketCode !== 'string') {
    marketCode = 'CP';
  }
  
  const marketData = {
    competitionName: league,
    competitionId,
    marketBookNo,
    marketCode
  };

  return marketData;
};

// Format match time to match Totelepep's expected format
const formatMatchTime = (kickoff?: string): string => {
  if (!kickoff) return '15:00';
  
  // If it's already in HH:MM format, return as is
  if (/^\d{1,2}:\d{2}$/.test(kickoff)) {
    return kickoff;
  }
  
  // If it contains date info, extract just the time
  const timeMatch = kickoff.match(/(\d{1,2}:\d{2})/);
  if (timeMatch) {
    return timeMatch[1];
  }
  
  return '15:00'; // Default fallback
};

// Map selection types to Totelepep option format
const getOptionDetails = (selection: ParlaySelection) => {
  // For All Markets selections, priceType will be in format: "marketBookNo-selectionName"
  // e.g., "96887-2nd", "96909-1st", "424-Home", etc.
  if (selection.priceType.includes('-') && !['home', 'draw', 'away', 'over', 'under', 'btts_yes', 'btts_no'].includes(selection.priceType)) {
    const parts = selection.priceType.split('-');
    const selectionName = parts.slice(1).join('-'); // Everything after the first dash
    // Map selection names to option details
    // "2nd" -> 2nd Half, "1st" -> 1st Half, "Home" -> Home, etc.
    let optionNo = '1';
    let optionCode = selectionName.toUpperCase().substring(0, 2);
    let optionName = selectionName;
    let marketType = selection.marketCode || 'OTHER';
    
    // Special mappings for common selections
    if (selectionName === '1st' || selectionName === '1') {
      optionNo = '1';
      optionCode = 'H1';
      optionName = '1st';
    } else if (selectionName === '2nd' || selectionName === '2') {
      optionNo = '2';
      optionCode = 'H2';
      optionName = '2nd';
    } else if (selectionName === '0') {
      // For HSH (Highest Scoring Half): index 0 = 1st half
      if (selection.marketCode === 'HSH') {
        optionNo = '1';
        optionCode = 'H1';
        optionName = '1st';
      } else {
        // For other markets, use index + 1
        optionNo = '1';
        optionCode = String(optionNo);
        optionName = String(optionNo);
      }
    } else if (selectionName === '1' || selectionName === '2' || selectionName === '3') {
      // Numeric selections (1-based)
      optionNo = selectionName;
      optionCode = selectionName;
      optionName = selectionName;
    } else if (selectionName.toLowerCase() === 'home' || selectionName === selection.homeTeam) {
      optionNo = '1';
      optionCode = 'H';
      optionName = selection.homeTeam;
      marketType = 'CP';
    } else if (selectionName.toLowerCase() === 'draw') {
      optionNo = '2';
      optionCode = 'D';
      optionName = 'Draw';
      marketType = 'CP';
    } else if (selectionName.toLowerCase() === 'away' || selectionName === selection.awayTeam) {
      optionNo = '3';
      optionCode = 'A';
      optionName = selection.awayTeam;
      marketType = 'CP';
    } else if (selectionName.toLowerCase() === 'yes' || selectionName.toLowerCase() === 'y') {
      optionNo = '1';
      optionCode = 'Y';
      optionName = 'Yes';
      marketType = 'BTTS';
    } else if (selectionName.toLowerCase() === 'no' || selectionName.toLowerCase() === 'n') {
      optionNo = '2';
      optionCode = 'N';
      optionName = 'No';
      marketType = 'BTTS';
    } else if (selectionName.toLowerCase() === 'over' || selectionName.toLowerCase() === 'o') {
      optionNo = '1';
      optionCode = 'O';
      optionName = 'Over';
      marketType = 'OU';
    } else if (selectionName.toLowerCase() === 'under' || selectionName.toLowerCase() === 'u') {
      optionNo = '2';
      optionCode = 'U';
      optionName = 'Under';
      marketType = 'OU';
    } else if (selection.marketCode === 'DC' || selection.marketCode === 'DOUBLECHANCE') {
      // Double Chance market
      marketType = 'DC';
      if (selectionName.toLowerCase().includes('home') && selectionName.toLowerCase().includes('draw')) {
        optionNo = '1';
        optionCode = 'HD';
        optionName = `${selection.homeTeam} - Draw`;
      } else if (selectionName.toLowerCase().includes('home') && selectionName.toLowerCase().includes('away')) {
        optionNo = '2';
        optionCode = 'HA';
        optionName = `${selection.homeTeam} - ${selection.awayTeam}`;
      } else if (selectionName.toLowerCase().includes('draw') && selectionName.toLowerCase().includes('away')) {
        optionNo = '3';
        optionCode = 'DA';
        optionName = `Draw - ${selection.awayTeam}`;
      } else if (selectionName === '1X' || selectionName === '1x') {
        optionNo = '1';
        optionCode = 'HD';
        optionName = `${selection.homeTeam} - Draw`;
      } else if (selectionName === '12') {
        optionNo = '2';
        optionCode = 'HA';
        optionName = `${selection.homeTeam} - ${selection.awayTeam}`;
      } else if (selectionName === 'X2' || selectionName === 'x2') {
        optionNo = '3';
        optionCode = 'DA';
        optionName = `Draw - ${selection.awayTeam}`;
      }
    }
    return {
      optionNo,
      optionCode,
      optionName,
      marketType
    };
  }
  
  // Standard quick 1X2/OU/BTTS selections
  switch (selection.priceType) {
    case 'home':
    case 'draw':
    case 'away':
      return {
        optionNo: selection.priceType === 'home' ? '1' : selection.priceType === 'draw' ? '2' : '3',
        optionCode: selection.priceType === 'home' ? 'H' : selection.priceType === 'draw' ? 'D' : 'A',
        optionName: selection.priceType === 'home' ? selection.homeTeam : selection.priceType === 'draw' ? 'Draw' : selection.awayTeam,
        marketType: '1X2' // Win-Draw-Win market
      };
    case 'over':
      return {
        optionNo: '1',
        optionCode: 'O',
        optionName: 'Over',
        marketType: 'OU' // Over/Under market
      };
    case 'under':
      return {
        optionNo: '2',
        optionCode: 'U',
        optionName: 'Under',
        marketType: 'OU' // Over/Under market
      };
    case 'btts_yes':
      return {
        optionNo: '1',
        optionCode: 'Y',
        optionName: 'Yes',
        marketType: 'BTTS' // Both Teams To Score
      };
    case 'btts_no':
      return {
        optionNo: '2',
        optionCode: 'N',
        optionName: 'No',
        marketType: 'BTTS' // Both Teams To Score
      };
    default:
      return {
        optionNo: '1',
        optionCode: 'H',
        optionName: selection.homeTeam,
        marketType: '1X2'
      };
  }
};

export interface ParlaySelection {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  priceType: string;
  odds: number | string;
  league?: string;
  kickoff?: string;
  matchDate?: string; // Match date (e.g., "Sun 14 Jun 2026")
  marketBookNo?: string;
  marketCode?: string;
  marketId?: string;  // Actual market ID from GetMatch API
  marketLine?: string;  // Market line for handicap/over-under (e.g., "+1.5", "2.5")
  periodCode?: string;  // Period code (FT, H1, 2H, etc.)
  marketDisplayName?: string;  // Full market display name from API
  optionCode?: string;  // Option code from API (e.g., HD, HA, DA, H, D, A)
  optionNo?: string;  // Option number from API
  optionName?: string;  // Option display name from API (e.g., "1-4 - Zhejiang FC")
  competitionName?: string;  // Competition name (e.g., "China - Chinese Super League")
  competitionId?: string;
  hasError?: boolean;  // Track if this selection has an error
}

interface ParlayBuilderProps {
  selections: ParlaySelection[];
  onRemoveSelection: (matchId: string, priceType?: string) => void;
  onClearAll: () => void;
  onClose?: () => void;  // Optional close button handler
  selectedSource?: ApiSource;  // API source to use for placing bets
  showHistoryModal?: boolean;  // Trigger to show booking history
  onHideHistoryModal?: () => void;  // Callback to hide history modal
  onBookingsCountChange?: (count: number) => void;  // Notify parent of booking count changes
  onInitiateBetRefund?: (matchId: string, priceType: string, odds: number, marketBookNo?: string, marketCode?: string, marketId?: string, marketLine?: string, periodCode?: string, marketDisplayName?: string, optionCode?: string, optionNo?: string) => void;  // Long-press handler
  onSetSelections?: (selections: ParlaySelection[]) => void;  // Set selections directly
  betRefundMode?: boolean;  // Bet Refund Mode active
  mainBetSelection?: ParlaySelection | null;  // Main bet for refund mode
  refundSelections?: ParlaySelection[];  // Available refund options
  onExitBetRefundMode?: () => void;  // Exit bet refund mode
}

const ParlayBuilder: React.FC<ParlayBuilderProps> = ({
  selections,
  onRemoveSelection,
  onClearAll,
  onClose,
  selectedSource,
  showHistoryModal = false,
  onHideHistoryModal,
  onBookingsCountChange,
  onInitiateBetRefund,
  onSetSelections,
  betRefundMode = false,
  mainBetSelection = null,
  refundSelections = [],
  onExitBetRefundMode
}) => {
  const [betAmount, setBetAmount] = useState<number>(50);
  const bookingResultRef = React.useRef<HTMLDivElement>(null);
  const [isPlacing, setIsPlacing] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    message: string;
    ticketNo?: string;
    potentialPayout?: string;
    fullResponse?: any;
  } | null>(null);
  const [showNewBetButton, setShowNewBetButton] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [smsPressTimer, setSmsPressTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Booking history states
  const [savedBookings, setSavedBookings] = useState<SavedBooking[]>([]);
  const [showBookingHistory, setShowBookingHistory] = useState(false);
  const parlayBuilderRef = useRef<HTMLDivElement>(null);
  const bookingRefRef = useRef<HTMLDivElement>(null); // Ref for booking reference section
  const [selectedBooking, setSelectedBooking] = useState<SavedBooking | null>(null); // View full booking details
  
  // Bet Refund Mode states - now from props, only keep UI state locally
  const [selectedRefundIndex, setSelectedRefundIndex] = useState<number>(0);
  const [mainBetIndex, setMainBetIndex] = useState<number>(0); // Track which selection is the main bet
  const [refundModeType, setRefundModeType] = useState<'budget' | 'profit'>('budget');
  const [budgetAmount, setBudgetAmount] = useState<number>(2000);
  const [targetProfit, setTargetProfit] = useState<number>(500);
  
  // Reset indices when Bet Refund Mode is activated with new selections
  useEffect(() => {
    if (betRefundMode && mainBetSelection && refundSelections.length > 0) {
      setMainBetIndex(0); // Reset to first option
      setSelectedRefundIndex(0); // Reset to first refund option (which is already filtered to exclude main bet)
    }
  }, [betRefundMode, mainBetSelection, refundSelections]);
  
  // Ref for Bet Refund Mode section
  const betRefundModeRef = useRef<HTMLDivElement>(null);
  
  // All outcomes from the long-pressed market (main bet + refund options)
  const allOutcomes = useMemo(() => {
    if (mainBetSelection && refundSelections.length > 0) {
      return [mainBetSelection, ...refundSelections];
    }
    return selections;
  }, [mainBetSelection, refundSelections, selections]);
  
  // Background bonus detection state
  const [isDetectingBonus, setIsDetectingBonus] = useState(false);
  const [detectedBonusPercentage, setDetectedBonusPercentage] = useState<number>(0);

  // Effect to show the "Place New Bet" button after a successful booking
  useEffect(() => {
    if (lastResult && lastResult.success) {
      setShowNewBetButton(true);
    } else {
      setShowNewBetButton(false);
    }
  }, [lastResult]);

  // Load saved bookings from IndexedDB on mount
  useEffect(() => {
    const loadBookings = async () => {
      try {
        const bookings = await getAllBookingsFromDB();
        setSavedBookings(bookings);
        if (onBookingsCountChange) {
          onBookingsCountChange(bookings.length);
        }
      } catch (error) {
      }
    };
    
    loadBookings();
  }, [onBookingsCountChange]);

  // Show history modal when triggered from parent
  useEffect(() => {
    if (showHistoryModal) {
      setShowBookingHistory(true);
      if (onHideHistoryModal) {
        onHideHistoryModal();
      }
    }
  }, [showHistoryModal, onHideHistoryModal]);

  // Background bonus detection when Bet Refund Mode activates (runs only once)
  const hasAttemptedDetection = useRef(false);
  
  // Auto-scroll to Bet Refund Mode section when activated
  useEffect(() => {
    if (betRefundMode && betRefundModeRef.current) {
      setTimeout(() => {
        betRefundModeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [betRefundMode]);
  
  useEffect(() => {
    // Only run once per Bet Refund Mode activation
    if (!betRefundMode || !mainBetSelection || isDetectingBonus || hasAttemptedDetection.current) {
      return;
    }

    hasAttemptedDetection.current = true;

    // If we already have apiBreakdown with bonus data from a recent successful bet, use it
    if (apiBreakdown && apiBreakdown.bonus > 0) {
      const basePayoutWithoutBonus = apiBreakdown.netPayout - apiBreakdown.bonus;
      const rawPercentage = basePayoutWithoutBonus > 0 ? (apiBreakdown.bonus / basePayoutWithoutBonus) * 100 : 0;
      const bonusPercentage = Math.round(rawPercentage);
      setDetectedBonusPercentage(bonusPercentage);

      return;
    }

    // If apiBreakdown exists but has no bonus, use 0%
    if (apiBreakdown && apiBreakdown.bonus === 0) {
      setDetectedBonusPercentage(0);

      return;
    }

    // Place background reference bet to detect bonus (only once)
    const detectBonus = async () => {
      setIsDetectingBonus(true);

      try {
        // Place a Rs 50 reference bet
        const referenceStake = 50;
        const result: any = await placeTotelepepBet([mainBetSelection], referenceStake, selectedSource);

        // Check if reference bet was successful
        if (!result.success) {

          // Show error and exit bet refund mode
          setToast(`⚠️ Betting mode failed: ${result.errorMessage || 'Unable to place bet'}`);
          setTimeout(() => setToast(null), 5000);
          
          // Exit bet refund mode after showing error
          setTimeout(() => {
            if (onExitBetRefundMode) onExitBetRefundMode();
            if (onSetSelections) onSetSelections([]);
          }, 1500);
          
          setDetectedBonusPercentage(0);
          return;
        }

        // Extract bonus from successful response
        const betList = result.betList;
        const isMultiBet = !betList || betList.length === 0;

        let bonusAmount = 0;
        let netPayout = 0;

        if (isMultiBet) {
          bonusAmount = parseFloat((result.bonusAmount || '0').replace(/,/g, '')) || 0;
          netPayout = parseFloat((result.potentialPayout || '0').replace(/,/g, '')) || 0;
        } else if (betList && betList.length > 0) {
          bonusAmount = parseFloat((betList[0].bonusAmount || '0').replace(/,/g, '')) || 0;
          netPayout = parseFloat((betList[0].potentialPayout || '0').replace(/,/g, '')) || 0;
        }

        // Calculate bonus percentage
        if (bonusAmount > 0 && netPayout > 0) {
          const basePayoutWithoutBonus = netPayout - bonusAmount;
          const rawPercentage = basePayoutWithoutBonus > 0 ? (bonusAmount / basePayoutWithoutBonus) * 100 : 0;
          const bonusPercentage = Math.round(rawPercentage);
          setDetectedBonusPercentage(bonusPercentage);

        } else {
          setDetectedBonusPercentage(0);

        }

        // DON'T save to ParlayBuilder history - bet exists in user's account but not shown in UI
        // Don't update lastResult or UI state
      } catch (error) {

        // Show error and exit
        setToast('⚠️ Betting mode failed: Network error');
        setTimeout(() => setToast(null), 5000);
        
        setTimeout(() => {
          if (onExitBetRefundMode) onExitBetRefundMode();
          if (onSetSelections) onSetSelections([]);
        }, 1500);
        
        setDetectedBonusPercentage(0);
      } finally {
        setIsDetectingBonus(false);
      }
    };

    detectBonus();
  }, [betRefundMode, mainBetSelection, selectedSource]);

  // SMS Bet functionality with long press
  const handleSmsPressStart = () => {
    const timer = setTimeout(() => {
      // Open SMS app
      const ticketNo = lastResult?.ticketNo || '';
      const message = `BET${ticketNo}`;
      
      // Determine phone number based on selected source
      let phoneNumber = '+23058638683'; // Default Totelepep
      if (selectedSource?.id === 'valueplus') {
        phoneNumber = '+23055098899';
      } else if (selectedSource?.id === 'superscore') {
        phoneNumber = '+23052502599';
      } else if (selectedSource?.id === 'stevenhills') {
        phoneNumber = '+23059590182';
      }
      
      // iOS uses &body=, Android uses ?body=
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const separator = isIOS ? '&' : '?';
      
      window.location.href = `sms:${phoneNumber}${separator}body=${encodeURIComponent(message)}`;
    }, 3500); // 3.5 seconds long press
    
    setSmsPressTimer(timer);
  };

  const handleSmsPressEnd = () => {
    if (smsPressTimer) {
      clearTimeout(smsPressTimer);
      setSmsPressTimer(null);
    }
  };

  // Format timestamp to readable date/time
  const formatBookingDateTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const day = days[date.getDay()];
    const dateNum = date.getDate().toString().padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${day} ${dateNum}-${month}-${year} @ ${hours}:${minutes}`;
  };

  // Save current booking to IndexedDB
  const saveBooking = useCallback(async (bookingData?: {
    ticketNo: string; 
    selections: any[]; 
    stake: number; 
    potentialWin: number; 
    tax?: number; 
    bonus?: number; 
    netPayout?: number;
    betRefundMode?: boolean;
    betRefundType?: 'main' | 'refund';
    betRefundGroupId?: string;
    betRefundPairRef?: string;
    betRefundOtherStake?: number;
    betRefundOtherWin?: number;
    // Individual bet financial data for Bet Refund Mode
    betRefundMainStake?: number;
    betRefundMainTax?: number;
    betRefundMainBonus?: number;
    betRefundMainNetPayout?: number;
    betRefundRefundStake?: number;
    betRefundRefundTax?: number;
    betRefundRefundBonus?: number;
    betRefundRefundNetPayout?: number;
  }) => {
    // If bookingData is provided, use it (for auto-save after bet)
    // Otherwise, use state (for manual save from history)
    const ticketNo = bookingData?.ticketNo || lastResult?.ticketNo;
    const selectionsToSave = bookingData?.selections || selections;
    const stakeToSave = bookingData?.stake || betAmount;
    const potentialWinToSave = bookingData?.potentialWin || betAmount * selections.reduce((acc, selection) => {
      const odds = typeof selection.odds === 'string' ? parseFloat(selection.odds) : selection.odds;
      return acc * odds;
    }, 1);
    const taxToSave = bookingData?.tax ?? apiBreakdown?.tax ?? 0;
    const bonusToSave = bookingData?.bonus ?? apiBreakdown?.bonus ?? 0;
    const netPayoutToSave = bookingData?.netPayout ?? apiBreakdown?.netPayout ?? potentialWinToSave;
    
    if (!ticketNo) {
      return;
    }
    
    // Create booking object
    const newBooking: SavedBooking = {
      id: Date.now().toString(),
      bookingRef: ticketNo,
      selections: [...selectionsToSave],
      stake: stakeToSave,
      potentialWin: potentialWinToSave,
      tax: taxToSave,
      bonus: bonusToSave,
      netPayout: netPayoutToSave,
      timestamp: Date.now(),
      formattedDateTime: formatBookingDateTime(Date.now()),
      apiSource: selectedSource?.id,  // Save source ID (e.g., 'totelepep') not displayName
      // Bet Refund Mode fields
      betRefundMode: bookingData?.betRefundMode,
      betRefundType: bookingData?.betRefundType,
      betRefundGroupId: bookingData?.betRefundGroupId,
      betRefundPairRef: bookingData?.betRefundPairRef,
      betRefundOtherStake: bookingData?.betRefundOtherStake,
      betRefundOtherWin: bookingData?.betRefundOtherWin,
      // Individual bet financial data for Bet Refund Mode
      betRefundMainStake: bookingData?.betRefundMainStake,
      betRefundMainTax: bookingData?.betRefundMainTax,
      betRefundMainBonus: bookingData?.betRefundMainBonus,
      betRefundMainNetPayout: bookingData?.betRefundMainNetPayout,
      betRefundRefundStake: bookingData?.betRefundRefundStake,
      betRefundRefundTax: bookingData?.betRefundRefundTax,
      betRefundRefundBonus: bookingData?.betRefundRefundBonus,
      betRefundRefundNetPayout: bookingData?.betRefundRefundNetPayout
    };
    
    try {
      await saveBookingToDB(newBooking);
      const updatedBookings = [newBooking, ...savedBookings];
      setSavedBookings(updatedBookings);
      if (onBookingsCountChange) {
        onBookingsCountChange(updatedBookings.length);
      }
      setToast('Booking saved successfully!');
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      setToast('Failed to save booking');
      setTimeout(() => setToast(null), 3000);
    }
  }, [lastResult, selections, betAmount, selectedSource]);

  // Delete a specific booking
  const deleteBooking = useCallback(async (bookingId: string) => {
    try {
      await deleteBookingFromDB(bookingId);
      const updatedBookings = savedBookings.filter(b => b.id !== bookingId);
      setSavedBookings(updatedBookings);
      if (onBookingsCountChange) {
        onBookingsCountChange(updatedBookings.length);
      }
    } catch (error) {
    }
  }, [savedBookings, onBookingsCountChange]);

  // Clear all bookings
  const clearAllBookings = useCallback(async () => {
    try {
      await clearAllBookingsFromDB();
      setSavedBookings([]);
      if (onBookingsCountChange) {
        onBookingsCountChange(0);
      }
      setToast('All bookings cleared');
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
    }
  }, [onBookingsCountChange]);

  // Save booking as image
  const saveBookingAsImage = useCallback(async () => {
    if (!bookingRefRef.current) {
      setToast('No booking to save');
      setTimeout(() => setToast(null), 3000);
      return;
    }

    try {
      setToast('Generating image...');
      
      // Capture the booking reference section
      const canvas = await html2canvas(bookingRefRef.current, {
        scale: 2, // Higher quality
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (!blob) {
          setToast('Failed to generate image');
          setTimeout(() => setToast(null), 3000);
          return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `booking-${lastResult?.ticketNo || 'parlay'}-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setToast('Image saved successfully!');
        setTimeout(() => setToast(null), 3000);
      }, 'image/png');
    } catch (error) {
      setToast('Failed to save image');
      setTimeout(() => setToast(null), 3000);
    }
  }, [lastResult]);

  const totalOdds = selections.reduce((acc, selection) => {
    const odds = typeof selection.odds === 'string' ? parseFloat(selection.odds) : selection.odds;
    return acc * odds;
  }, 1);
  
  // Simple calculation BEFORE bet: Total Odds × Stake
  const potentialReturn = betAmount * totalOdds;
  
  // After successful bet, extract detailed breakdown from API response
  const apiBreakdown = useMemo(() => {
    if (!lastResult || !lastResult.success || !lastResult.fullResponse) {
      return null;
    }
    
    const fullResponse = lastResult.fullResponse;
    const betList = fullResponse.betList;
    // For multi-bets, betList is empty - use top-level fields
    const isMultiBet = !betList || betList.length === 0;
    
    let stake: number;
    let apiPotentialPayout: number;
    let taxAmount: number;
    let bonusAmount: number;
    
    if (isMultiBet) {
      
      // Remove commas before parsing (API returns "2,546" not "2546")
      stake = parseFloat((fullResponse.multiStake || betAmount.toString()).replace(/,/g, ''));
      apiPotentialPayout = parseFloat((fullResponse.potentialPayout || lastResult.potentialPayout || '0').replace(/,/g, ''));
      taxAmount = parseFloat((fullResponse.taxAmount || '0').replace(/,/g, '')) || 0;
      bonusAmount = parseFloat((fullResponse.bonusAmount || '0').replace(/,/g, '')) || 0;
    } else {
      const firstBet = betList[0];
      // Remove commas before parsing
      stake = parseFloat((firstBet.stake || betAmount.toString()).replace(/,/g, ''));
      apiPotentialPayout = parseFloat((firstBet.potentialPayout || lastResult.potentialPayout || '0').replace(/,/g, ''));
      taxAmount = parseFloat((firstBet.taxAmount || '0').replace(/,/g, '')) || 0;
      bonusAmount = parseFloat((firstBet.bonusAmount || '0').replace(/,/g, '')) || 0;
    }
    return {
      stake: stake,
      tax: taxAmount,
      bonus: bonusAmount,
      potentialPayout: apiPotentialPayout,
      netPayout: apiPotentialPayout,
      finalPayout: apiPotentialPayout + bonusAmount
    };
  }, [lastResult, betAmount]);

  // BET REFUND MODE: Place two separate single bets (main bet + refund bet)
  const handlePlaceBetRefundMode = async () => {
    setIsPlacing(true);
    setLastResult(null);
    
    try {
      // Get the calculated stakes
      const apiHasBonus = apiBreakdown && apiBreakdown.bonus > 0;
      const apiBonusPercentage = apiHasBonus ? (apiBreakdown.bonus / (apiBreakdown.netPayout - apiBreakdown.bonus)) * 100 : 0;
      const hasBonus = detectedBonusPercentage > 0 || apiHasBonus;
      const bonusPercentage = detectedBonusPercentage > 0 ? detectedBonusPercentage : apiBonusPercentage;
      const BONUS_MULTIPLIER = hasBonus ? (1 + bonusPercentage / 100) : 1;
      
      let mainStake = 0, refundStake = 0;
      const refundOdds = parseFloat(String(refundSelections[selectedRefundIndex]?.odds)) || 3.0;
      const mainOdds = parseFloat(String(mainBetSelection?.odds)) || 2.5;
      
      if (refundModeType === 'budget') {
        const rawRefundStake = budgetAmount * (114 / 100) / (refundOdds * BONUS_MULTIPLIER);
        refundStake = Math.round(rawRefundStake);
        mainStake = budgetAmount - refundStake;
      } else {
        const refundMultiplier = refundOdds * BONUS_MULTIPLIER * (100 / 114);
        const mainMultiplier = mainOdds * BONUS_MULTIPLIER * (100 / 114);
        const rawRefundStake = targetProfit / ((refundMultiplier - 1) * mainMultiplier - refundMultiplier);
        refundStake = Math.round(rawRefundStake);
        mainStake = Math.round(refundStake * (refundMultiplier - 1));
      }
      
      // Place main bet
      const mainBetSelections: ParlaySelection[] = [{
        ...mainBetSelection!,
        hasError: false
      }];
      
      // Validate stakes before placing bets
      if (!mainStake || mainStake <= 0) {
        setLastResult({
          success: false,
          message: 'Invalid main bet stake. Please enter a valid amount.',
        });
        setIsPlacing(false);
        return;
      }
      
      if (!refundStake || refundStake <= 0) {
        setLastResult({
          success: false,
          message: 'Invalid refund bet stake. Please increase your budget/target profit.',
        });
        setIsPlacing(false);
        return;
      }

      const mainBetResult = await placeTotelepepBet(mainBetSelections, mainStake, selectedSource);
      
      // Place refund bet
      const refundBetSelections: ParlaySelection[] = [{
        ...refundSelections[selectedRefundIndex],
        hasError: false
      }];



      let refundBetResult: any = { ticketNo: null, potentialPayout: null };

      // Validate refund stake and place bet if valid
      if (refundStake && refundStake > 0) {
        refundBetResult = await placeTotelepepBet(refundBetSelections, refundStake, selectedSource);
        
        // Check if refund bet succeeded
        if (!refundBetResult.ticketNo || refundBetResult.ticketNo.trim() === '') {

        }
      } else {

      }
      
      // Check if both bets succeeded
      const mainSuccess = mainBetResult.ticketNo && mainBetResult.ticketNo.trim() !== '' && !mainBetResult.ticketNo.includes('Booking Ref# ');
      const refundSuccess = refundBetResult.ticketNo && refundBetResult.ticketNo.trim() !== '' && !refundBetResult.ticketNo.includes('Booking Ref# ') && refundBetResult.ticketNo.trim() !== 'Booking Ref#';




      if (mainSuccess && refundSuccess) {
        setLastResult({
          success: true,
          message: `Bet Refund Mode: Both bets placed successfully!`,
          ticketNo: `${mainBetResult.ticketNo} + ${refundBetResult.ticketNo}`,
          potentialPayout: `${mainBetResult.potentialPayout} / ${refundBetResult.potentialPayout}`,
          fullResponse: {
            mainBet: mainBetResult,
            refundBet: refundBetResult,
            mainStake,
            refundStake
          }
        });
        
        // Save ONE combined booking with both refs and their individual financial data
        const mainTax = parseFloat(String(mainBetResult.betList?.[0]?.taxAmount || '0').replace(/,/g, ''));
        const mainBonus = parseFloat(String(mainBetResult.betList?.[0]?.bonusAmount || '0').replace(/,/g, ''));
        const mainNetPayout = parseFloat(String(mainBetResult.betList?.[0]?.payout || mainBetResult.potentialPayout || '0').replace(/,/g, ''));
        const refundTax = parseFloat(String(refundBetResult.betList?.[0]?.taxAmount || '0').replace(/,/g, ''));
        const refundBonus = parseFloat(String(refundBetResult.betList?.[0]?.bonusAmount || '0').replace(/,/g, ''));
        const refundNetPayout = parseFloat(String(refundBetResult.betList?.[0]?.payout || refundBetResult.potentialPayout || '0').replace(/,/g, ''));
        
        saveBooking({
          ticketNo: `${mainBetResult.ticketNo} - ${refundBetResult.ticketNo}`,
          selections: [...mainBetSelections, ...refundBetSelections],
          stake: mainStake + refundStake,
          potentialWin: mainNetPayout + refundNetPayout,
          tax: mainTax + refundTax,
          bonus: mainBonus + refundBonus,
          netPayout: mainNetPayout + refundNetPayout,
          betRefundMode: true,
          betRefundType: 'main',  // Mark as main bet for Repeat Bet detection
          // Store individual bet financial data for proper breakdown display
          betRefundMainStake: mainStake,
          betRefundMainTax: mainTax,
          betRefundMainBonus: mainBonus,
          betRefundMainNetPayout: mainNetPayout,
          betRefundRefundStake: refundStake,
          betRefundRefundTax: refundTax,
          betRefundRefundBonus: refundBonus,
          betRefundRefundNetPayout: refundNetPayout
        });
        
        console.log('[BetRefund Booking] Saved with individual financial data:', {
          mainStake, mainTax, mainBonus, mainNetPayout,
          refundStake, refundTax, refundBonus, refundNetPayout
        });
        
        // Clear sessionStorage after successful Bet Refund Mode bet placement
        sessionStorage.removeItem('betRefundMode');
        sessionStorage.removeItem('betRefundMainSelection');
        sessionStorage.removeItem('betRefundOptions');

        // Auto-scroll to results
        setTimeout(() => {
          if (betRefundMode && betRefundModeRef.current) {
            // For Bet Refund Mode, scroll the container to the bottom
            const container = betRefundModeRef.current;
            container.scrollTop = container.scrollHeight;

          } else if (!betRefundMode) {
            // For normal bets, auto-scroll booking result to bottom
            setTimeout(() => {
              if (bookingRefRef.current) {
                bookingRefRef.current.scrollTop = bookingRefRef.current.scrollHeight;
              }
            }, 500);
          }
        }, 500);
      } else {
        const mainSuccess = mainBetResult.ticketNo && mainBetResult.ticketNo.trim() !== '';
        const refundSuccess = refundBetResult.ticketNo && refundBetResult.ticketNo.trim() !== '';
        
        let errorMsg = 'Bet placement failed: ';
        if (mainSuccess && !refundSuccess) {
          errorMsg += 'Main bet placed successfully, but refund bet failed. ';
          if (refundBetResult.errorMessage) errorMsg += `Error: ${refundBetResult.errorMessage}. `;
        } else if (!mainSuccess && refundSuccess) {
          errorMsg += 'Refund bet placed successfully, but main bet failed. ';
          if (mainBetResult.errorMessage) errorMsg += `Error: ${mainBetResult.errorMessage}. `;
        } else {
          errorMsg += 'Both bets failed.';
        }
        
        setLastResult({
          success: false,
          message: errorMsg,
          fullResponse: { mainBet: mainBetResult, refundBet: refundBetResult }
        });
      }
    } catch (error) {
      setLastResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setIsPlacing(false);
    }
  };

  const handlePlaceBet = async () => {
    // BET REFUND MODE: Place two separate single bets
    if (betRefundMode && mainBetSelection && selectedRefundIndex >= 0) {
      return await handlePlaceBetRefundMode();
    }
    
    // NORMAL MODE: Place parlay bet
    // Clear previous errors before placing new bet
    selections.forEach(s => s.hasError = false);
    
    // Debug specific match data
    selections.forEach((selection, index) => {
    });

    // Clear previous result
    setLastResult(null);
    if (selections.length === 0) {
      setLastResult({
        success: false,
        message: 'Please add at least one selection to your parlay'
      });
      return;
    }

    // REMOVED: Hardcoded minimum stake validation
    // Let the API handle stake validation and return source-specific errors
    // Each API source has different min/max stake and payout limits
    // We'll show the actual API error message instead of generic frontend validation
    
    // if (betAmount < minStake) {
    //   const toastMsg = isSingleBet && isSuperScore
    //     ? 'Minimum stake for single bet is Rs 25'
    //     : `Minimum stake for multi bet is Rs ${minStake}`;
    //   
    //   setToast(toastMsg);
    //   setTimeout(() => setToast(null), 3000);
    //   return;
    // }

    setIsPlacing(true);

    try {
      // Use real booking API with selected source
      const bookingResult = await placeTotelepepBet(selections, betAmount, selectedSource);
      // Enhanced success checking to handle cases where ticket is generated but errors are present
      const hasTicket = bookingResult.ticketNo && bookingResult.ticketNo.trim() !== '';
      const hasErrors = (bookingResult.errorMessage && bookingResult.errorMessage.trim() !== '' && bookingResult.errorMessage !== 'None') || 
                        (bookingResult.multiErrorMessage && bookingResult.multiErrorMessage.trim() !== '' && bookingResult.multiErrorMessage !== 'None');
            
      // Check betList for error codes
      const hasBetErrors = bookingResult.betList && bookingResult.betList.length > 0 && 
                           bookingResult.betList.some((bet: any) => bet.betErrorCode && bet.betErrorCode !== 0);
      
      // Consider successful ONLY if we have a ticket AND no bet errors
      if (hasTicket && !hasBetErrors && !hasErrors) {


        setLastResult({
          success: true,
          message: 'Booking successful!',
          ticketNo: bookingResult.ticketNo,
          potentialPayout: bookingResult.potentialPayout,
          fullResponse: bookingResult
        });

        // Auto-save booking to IndexedDB with API response data
        // Extract tax and bonus from bookingResult (same logic as apiBreakdown)
        const betList = bookingResult.betList;
        const isMultiBet = !betList || betList.length === 0;
        let taxToSave = 0;
        let bonusToSave = 0;
        let netPayoutToSave = parseFloat((bookingResult.potentialPayout || '0').replace(/,/g, '')) || 0;

        if (isMultiBet) {
          // Multi-bet: use top-level fields
          taxToSave = parseFloat((bookingResult.taxAmount || '0').replace(/,/g, '')) || 0;
          bonusToSave = parseFloat((bookingResult.bonusAmount || '0').replace(/,/g, '')) || 0;
        } else {
          // Single bet or parlay: sum from betList
          taxToSave = betList.reduce((sum: number, bet: any) => sum + (parseFloat((bet.taxAmount || '0').replace(/,/g, '')) || 0), 0);
          bonusToSave = betList.reduce((sum: number, bet: any) => sum + (parseFloat((bet.bonusAmount || '0').replace(/,/g, '')) || 0), 0);
        }

        saveBooking({
          ticketNo: bookingResult.ticketNo || '',
          selections: [...selections],
          stake: betAmount,
          potentialWin: bookingResult.potentialPayout,
          tax: taxToSave,
          bonus: bonusToSave,
          netPayout: netPayoutToSave
        });

        // Auto-scroll booking result to bottom
        setTimeout(() => {
          if (bookingRefRef.current) {
            bookingRefRef.current.scrollTop = bookingRefRef.current.scrollHeight;
          }
        }, 500);
        
        // Don't clear selections or reset bet amount - let user decide
        setIsPlacing(false);
      } else if (bookingResult.success && !hasErrors) {
        setLastResult({
          success: true,
          message: 'Booking successful!',
          ticketNo: bookingResult.ticketNo,
          potentialPayout: bookingResult.potentialPayout,
          fullResponse: bookingResult
        });
        
        // Auto-save booking to IndexedDB with API response data
        // Extract tax and bonus from bookingResult (same logic as apiBreakdown)
        const betList = bookingResult.betList;
        const isMultiBet = !betList || betList.length === 0;
        let taxToSave = 0;
        let bonusToSave = 0;
        let netPayoutToSave = parseFloat((bookingResult.potentialPayout || '0').replace(/,/g, '')) || 0;
        
        if (isMultiBet) {
          // Multi-bet: use top-level fields
          taxToSave = parseFloat((bookingResult.taxAmount || '0').replace(/,/g, '')) || 0;
          bonusToSave = parseFloat((bookingResult.bonusAmount || '0').replace(/,/g, '')) || 0;
        } else {
          // Single bet or parlay: sum from betList
          taxToSave = betList.reduce((sum: number, bet: any) => sum + (parseFloat((bet.taxAmount || '0').replace(/,/g, '')) || 0), 0);
          bonusToSave = betList.reduce((sum: number, bet: any) => sum + (parseFloat((bet.bonusAmount || '0').replace(/,/g, '')) || 0), 0);
        }
        
        saveBooking({
          ticketNo: bookingResult.ticketNo || '',
          selections: [...selections],
          stake: betAmount,
          potentialWin: bookingResult.potentialPayout,
          tax: taxToSave,
          bonus: bonusToSave,
          netPayout: netPayoutToSave
        });

        saveBooking({
          ticketNo: bookingResult.ticketNo || '',
          selections: [...selections],
          stake: betAmount,
          potentialWin: bookingResult.potentialPayout,
          tax: taxToSave,
          bonus: bonusToSave,
          netPayout: netPayoutToSave
        });

        // Auto-scroll to booking result after successful bet
        setTimeout(() => {

          // Try to find the booking result directly
          const bookingResult = document.querySelector('.border-green-500.rounded-lg');

          if (bookingResult) {

            bookingResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {

          }
        }, 300);
        
        // Don't clear selections or reset bet amount - let user decide
        setIsPlacing(false);
      } else {
        // Extract actual API error message from betList
        let apiErrorMessage = '';
        
        if (bookingResult.betList && bookingResult.betList.length > 0) {
          // Find first bet with an error
          const errorBet = bookingResult.betList.find((bet: any) => 
            bet.betErrorCode && bet.betErrorCode !== 0
          );
          
          if (errorBet) {
            // Use betErrorMessage if available
            apiErrorMessage = errorBet.betErrorMessage || errorBet.legErrorMessage || '';
            
            // Clean up error message
            if (apiErrorMessage && apiErrorMessage !== 'None' && apiErrorMessage !== 'null') {
            } else {
              apiErrorMessage = '';
            }
          }
        }
        
        // Fallback to general error messages if no betList error
        const errorMessage = apiErrorMessage || 
                            bookingResult.errorMessage || 
                            bookingResult.multiErrorMessage || 
                            'Please try again';
        
        setLastResult({
          success: false,
          message: `Booking failed: ${errorMessage}`,
          fullResponse: bookingResult
        });
        
        // Show error toast with actual API message
        setToast(errorMessage);
        setTimeout(() => setToast(null), 5000); // Show for 5 seconds
        
        // Mark selections with errors ONLY if the error is about the match/selection
        // NOT for stake/payout validation errors
        if (bookingResult.betList && bookingResult.betList.length > 0) {
          
          selections.forEach((selection, index) => {
            const bet = bookingResult.betList[index];
            
            if (bet && bet.betErrorCode && bet.betErrorCode !== 0) {
              const errorMsg = (bet.betErrorMessage || bet.legErrorMessage || '').toLowerCase();
              
              // Check for stake/payout/account errors FIRST (higher priority)
              const isStakeError = 
                errorMsg.includes('minimum stake') ||
                errorMsg.includes('maximum stake') ||
                errorMsg.includes('minimum bet') ||
                errorMsg.includes('maximum bet') ||
                errorMsg.includes('invalid stake') || // "Invalid Stake" matches here!
                errorMsg.includes('stake amount') ||
                errorMsg.includes('payout') ||
                errorMsg.includes('balance') ||
                errorMsg.includes('insufficient');
              
              // Then check for match/selection errors
              const isMatchError = !isStakeError && (  // Only if NOT a stake error
                errorMsg.includes('suspended') ||
                errorMsg.includes('unavailable') ||
                errorMsg.includes('not found') ||
                errorMsg.includes('odds changed') ||
                errorMsg.includes('market closed') ||
                errorMsg.includes('match started') ||
                errorMsg.includes('invalid selection') ||  // More specific: "invalid selection" not just "invalid"
                errorMsg.includes('invalid market') ||
                errorMsg.includes('invalid odds')
              );
              
              // Only mark if it's a match error, not a stake error
              if (isMatchError && !isStakeError) {
                selection.hasError = true;
              } else if (isStakeError) {
              } else {
              }
            }
          });
        }
        
        setIsPlacing(false);
      }
      
    } catch (error) {
      setLastResult({
        success: false,
        message: `Failed to connect to Totelepep: ${error instanceof Error ? error.message : 'Please try again'}`,
        fullResponse: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    } finally {
      setIsPlacing(false);
    }
  };

  if (selections.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-800">Parlay Builder</h2>
        </div>
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calculator className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 mb-2">No selections yet</p>
          <p className="text-sm text-gray-400">Click on odds to add them to your parlay</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={parlayBuilderRef}
      className="bg-white rounded-lg shadow-md h-full flex flex-col overflow-hidden"
    >
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 text-white px-6 py-3 rounded-lg shadow-lg animate-slide-down ${
          toast.includes('saved successfully') || toast.includes('cleared') ? 'bg-green-600' : 'bg-red-600'
        }`}>
          <div className="flex items-center gap-2">
            {toast.includes('saved successfully') || toast.includes('cleared') ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="font-medium">{toast}</span>
          </div>
        </div>
      )}
      
      {/* Header - Sticky */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10 relative">
        {/* Centered Title */}
        <div className="flex items-center justify-center py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-800">Parlay Builder</h2>
          </div>
        </div>
        {/* Source, Badge, and Buttons */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {selectedSource && (
              <span className="text-sm text-gray-600">{selectedSource.displayName}</span>
            )}
            <span className="relative">
              <span className="bg-red-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {selections.length}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={() => {
                onClearAll();
                // Exit bet refund mode when clearing all selections
                if (betRefundMode) {
                  if (onExitBetRefundMode) onExitBetRefundMode();
                  if (onSetSelections) onSetSelections([]);
                }
              }}
              className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Selections - Scrollable (hidden in Bet Refund Mode and after placing bet) */}
      {!betRefundMode && !lastResult && (
        <div ref={bookingResultRef} className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {selections.map((selection, index) => (
            <div
              key={`${selection.matchId}-${selection.priceType}-${index}`}
              className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                selection.hasError 
                  ? 'bg-red-50 border-2 border-red-500' 
                  : 'bg-gray-50 border-2 border-transparent'
              }`}
          >
            <div className="flex-1">
              <div className="font-medium text-gray-800">
               <div className="text-sm font-semibold">
                 {(() => {
                   // Determine selection name
                   let selectionName = '';
                   if (selection.priceType === 'home') selectionName = selection.homeTeam;
                   else if (selection.priceType === 'draw') selectionName = 'Draw';
                   else if (selection.priceType === 'away') selectionName = selection.awayTeam;
                   else if (selection.priceType === 'over') selectionName = 'Over';
                   else if (selection.priceType === 'under') selectionName = 'Under';
                   else if (selection.priceType === 'btts_yes') selectionName = 'Yes';
                   else if (selection.priceType === 'btts_no') selectionName = 'No';
                   else {
                     // For All Markets selections, extract from priceType
                     const parts = selection.priceType.split('-');
                     selectionName = parts.length > 1 ? parts.slice(1).join('-') : selection.priceType;
                   }
                   
                   // Display: SelectionName @ Odds
                   return `${selectionName} @ ${typeof selection.odds === 'string' ? selection.odds : selection.odds.toFixed(2)}`;
                 })()}
               </div>
               <div className="text-xs text-gray-600 font-medium">
                 {selection.homeTeam} v {selection.awayTeam}
               </div>
               {selection.matchDate && (
                 <div className="text-xs text-gray-500 font-medium">
                   {(() => {
                     // Format date from YYYY-MM-DD to "Sun 14 Jun 2026"
                     try {
                       const date = new Date(selection.matchDate);
                       const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                       const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                       const day = days[date.getDay()];
                       const dateNum = date.getDate();
                       const month = months[date.getMonth()];
                       const year = date.getFullYear();
                       return `${day} ${dateNum} ${month} ${year}`;
                     } catch {
                       return selection.matchDate;
                     }
                   })()}
                 </div>
               )}
               <div className="text-xs text-gray-500">
                 {(() => {
                   // Use marketDisplayName from API if available, otherwise build it
                   if (selection.marketDisplayName) {
                     return `${selection.kickoff}     ${selection.marketDisplayName}`;
                   }
                   
                   // Fallback: build market name from components
                   const line = selection.marketLine || '';
                   const period = selection.periodCode || 'FT';
                   const code = selection.marketCode?.toUpperCase() || '';
                   
                   // Format market name
                   let marketName = '1 X 2';
                   if (code === 'HSH') marketName = 'Highest Scoring Half';
                   else if (code === 'OU' || code === 'UO') marketName = line ? `Under Over ${line}` : 'Over/Under';
                   else if (code === 'BTTS') marketName = 'Both Teams To Score';
                   else if (code === 'AH' || code === 'HC') marketName = line ? `Asian Handicap ${line}` : 'Asian Handicap';
                   else if (code === 'CP') marketName = '1 X 2';
                   else marketName = selection.marketCode || '1 X 2';
                   
                   // Add period suffix
                   if (period === 'H1') marketName += ' - Half Time';
                   else if (period === '2H') marketName += ' - 2nd Half';
                   else if (period === 'FT') marketName += ' - Full Time';
                   
                   return `${selection.kickoff}     ${marketName}`;
                 })()}
               </div>
               {selection.hasError && (
                 <div className="text-xs text-red-600 font-semibold mt-1">
                   ⚠️ Invalid selection
                 </div>
               )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-blue-600">
                {typeof selection.odds === 'string' ? selection.odds : selection.odds.toFixed(2)}
              </span>
              <button
                onClick={() => onRemoveSelection(selection.matchId, selection.priceType)}
                className="text-red-500 hover:text-red-700 p-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
          </div>
        </div>
      )}

      {/* Bet Refund Mode UI */}
      {betRefundMode && mainBetSelection && selections.length >= 1 && (
        <div ref={betRefundModeRef} className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg p-4 mb-4 overflow-y-auto max-h-[calc(100vh-200px)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-purple-800">🎯 Bet Refund Mode</h3>
            <button
              onClick={() => {
                if (onExitBetRefundMode) onExitBetRefundMode();
                if (onSetSelections) onSetSelections([]);
                if (onClose) onClose(); // Hide the parlay builder
              }}
              className="text-purple-600 hover:text-purple-800 text-sm font-medium"
            >
              Exit Mode
            </button>
          </div>

          {/* Mode Toggle */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setRefundModeType('budget')}
              className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-all ${
                refundModeType === 'budget'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-purple-600 border border-purple-300'
              }`}
            >
              💵 Budget Mode
            </button>
            <button
              onClick={() => setRefundModeType('profit')}
              className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-all ${
                refundModeType === 'profit'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-purple-600 border border-purple-300'
              }`}
            >
              🎯 Target Profit
            </button>
          </div>

          {/* Match Info */}
          {mainBetSelection && (
            <div className="bg-white rounded-lg p-3 mb-3 border border-purple-200">
              {mainBetSelection.competitionName && (
                <div className="text-xs text-purple-600 font-semibold mb-1">
                  {mainBetSelection.competitionName}
                </div>
              )}
              <div className="text-sm font-semibold text-gray-800">
                {mainBetSelection.homeTeam} v {mainBetSelection.awayTeam}
              </div>
              {mainBetSelection.matchDate && (
                <div className="text-xs text-gray-500 mt-1">
                  {(() => {
                    try {
                      const date = new Date(mainBetSelection.matchDate);
                      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      const day = days[date.getDay()];
                      const dateNum = date.getDate();
                      const month = months[date.getMonth()];
                      return `${day} ${dateNum} ${month}`;
                    } catch {
                      return mainBetSelection.matchDate;
                    }
                  })()}
                </div>
              )}
              <div className="text-xs text-gray-500">
                {mainBetSelection.kickoff}
              </div>
            </div>
          )}

          {/* Main Bet Dropdown - Shows all outcomes */}
          <div className="bg-white rounded-lg p-3 mb-3 border border-purple-200">
            <div className="text-xs text-purple-600 font-semibold mb-1">MAIN BET</div>
            <select
              value={mainBetIndex}
              onChange={(e) => {
                const idx = parseInt(e.target.value);
                setMainBetIndex(idx);
                // If refund bet is now same as main bet, reset it
                if (selectedRefundIndex === idx) {
                  // Find first available option that's not the main bet
                  const nextIdx = allOutcomes.findIndex((_, i) => i !== idx);
                  if (nextIdx >= 0) {
                    setSelectedRefundIndex(nextIdx);
                    if (onSetSelections) onSetSelections([allOutcomes[idx], allOutcomes[nextIdx]]);
                  }
                } else {
                  // Update selections with new main bet and current refund bet
                  if (allOutcomes[selectedRefundIndex] && allOutcomes[idx]) {
                    if (onSetSelections) onSetSelections([allOutcomes[idx], allOutcomes[selectedRefundIndex]]);
                  }
                }
              }}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {allOutcomes.map((sel, idx) => (
                <option key={idx} value={idx}>
                  {(() => {
                    // Show period - selection name @ odds
                    const periodCode = sel.periodCode || 'FT';
                    
                    let selectionName = '';
                    
                    // ALWAYS use optionName if available (contains the text shown above odds in expanded market)
                    if (sel.optionName) {
                      selectionName = sel.optionName;
                    }
                    // For 1X2 markets without optionName, use team names
                    else if (sel.marketDisplayName && sel.marketDisplayName.toLowerCase().includes('1 x 2')) {
                      if (sel.priceType === 'home' || sel.priceType === '1') selectionName = sel.homeTeam;
                      else if (sel.priceType === 'draw' || sel.priceType === 'X') selectionName = 'Draw';
                      else if (sel.priceType === 'away' || sel.priceType === '2') selectionName = sel.awayTeam;
                      else selectionName = sel.marketDisplayName;
                    }
                    else if (sel.priceType === 'home') selectionName = sel.homeTeam;
                    else if (sel.priceType === 'draw') selectionName = 'Draw';
                    else if (sel.priceType === 'away') selectionName = sel.awayTeam;
                    else if (sel.priceType === 'over') selectionName = 'Over';
                    else if (sel.priceType === 'under') selectionName = 'Under';
                    else if (sel.priceType === 'btts_yes') selectionName = 'Yes';
                    else if (sel.priceType === 'btts_no') selectionName = 'No';
                    else if (sel.marketDisplayName) {
                      // For Double Chance markets, use marketDisplayName directly (it already contains team info)
                      if (sel.marketDisplayName.toLowerCase().includes('double chance')) {
                        // If marketDisplayName is just "Double Chance", construct it with teams
                        if (sel.marketDisplayName === 'Double Chance' || sel.marketDisplayName === 'Double chance') {
                          // Try to determine from priceType
                          if (sel.priceType.includes('1X') || sel.priceType.toLowerCase().includes('home') && sel.priceType.toLowerCase().includes('draw')) {
                            selectionName = `Double Chance ${sel.homeTeam} or Draw`;
                          } else if (sel.priceType.includes('12') || (sel.priceType.toLowerCase().includes('home') && sel.priceType.toLowerCase().includes('away'))) {
                            selectionName = `Double Chance ${sel.homeTeam} or ${sel.awayTeam}`;
                          } else if (sel.priceType.includes('X2') || sel.priceType.toLowerCase().includes('draw') && sel.priceType.toLowerCase().includes('away')) {
                            selectionName = `Double Chance Draw or ${sel.awayTeam}`;
                          } else {
                            selectionName = sel.marketDisplayName;
                          }
                        } else {
                          // marketDisplayName already has team info
                          selectionName = sel.marketDisplayName;
                        }
                      }
                      else {
                        // Use marketDisplayName for other markets
                        selectionName = sel.marketDisplayName;
                      }
                    }
                    else selectionName = sel.priceType.replace(/-/g, ' ');
                    
                    return `${periodCode} - ${selectionName} @ ${typeof sel.odds === 'string' ? sel.odds : sel.odds.toFixed(2)}`;
                  })()}
                </option>
              ))}
            </select>
          </div>

          {/* Refund Bet Dropdown - Excludes main bet selection */}
          <div className="bg-white rounded-lg p-3 mb-3 border border-purple-200">
            <div className="text-xs text-purple-600 font-semibold mb-1">REFUND BET</div>
            <select
              value={selectedRefundIndex}
              onChange={(e) => {
                const filteredIdx = parseInt(e.target.value);
                // Convert filtered index back to actual index in allOutcomes
                const actualIdx = filteredIdx >= mainBetIndex ? filteredIdx + 1 : filteredIdx;
                setSelectedRefundIndex(filteredIdx);
                // Update selections with main bet and selected refund bet
                if (allOutcomes[actualIdx] && allOutcomes[mainBetIndex]) {
                  if (onSetSelections) onSetSelections([allOutcomes[mainBetIndex], allOutcomes[actualIdx]]);
                }
              }}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {allOutcomes.filter((_, idx) => idx !== mainBetIndex).map((sel, idx) => {
                // Get the actual index in allOutcomes
                const actualIdx = idx >= mainBetIndex ? idx + 1 : idx;
                return (
                  <option key={actualIdx} value={idx}>
                    {(() => {
                      // Show period - selection name @ odds
                      const periodCode = sel.periodCode || 'FT';
                      
                      let selectionName = '';
                      
                      // ALWAYS use optionName if available (contains the text shown above odds in expanded market)
                      if (sel.optionName) {
                        selectionName = sel.optionName;
                      }
                      // For 1X2 markets without optionName, use team names
                      else if (sel.marketDisplayName && sel.marketDisplayName.toLowerCase().includes('1 x 2')) {
                        if (sel.priceType === 'home' || sel.priceType === '1') selectionName = sel.homeTeam;
                        else if (sel.priceType === 'draw' || sel.priceType === 'X') selectionName = 'Draw';
                        else if (sel.priceType === 'away' || sel.priceType === '2') selectionName = sel.awayTeam;
                        else selectionName = sel.marketDisplayName;
                      }
                      else if (sel.priceType === 'home') selectionName = sel.homeTeam;
                      else if (sel.priceType === 'draw') selectionName = 'Draw';
                      else if (sel.priceType === 'away') selectionName = sel.awayTeam;
                      else if (sel.priceType === 'over') selectionName = 'Over';
                      else if (sel.priceType === 'under') selectionName = 'Under';
                      else if (sel.priceType === 'btts_yes') selectionName = 'Yes';
                      else if (sel.priceType === 'btts_no') selectionName = 'No';
                      else if (sel.marketDisplayName) {
                        // For Double Chance markets, use marketDisplayName directly
                        if (sel.marketDisplayName.toLowerCase().includes('double chance')) {
                          // If marketDisplayName is just "Double Chance", construct it with teams
                          if (sel.marketDisplayName === 'Double Chance' || sel.marketDisplayName === 'Double chance') {
                            // Try to determine from priceType
                            if (sel.priceType.includes('1X') || sel.priceType.toLowerCase().includes('home') && sel.priceType.toLowerCase().includes('draw')) {
                              selectionName = `Double Chance ${sel.homeTeam} or Draw`;
                            } else if (sel.priceType.includes('12') || (sel.priceType.toLowerCase().includes('home') && sel.priceType.toLowerCase().includes('away'))) {
                              selectionName = `Double Chance ${sel.homeTeam} or ${sel.awayTeam}`;
                            } else if (sel.priceType.includes('X2') || sel.priceType.toLowerCase().includes('draw') && sel.priceType.toLowerCase().includes('away')) {
                              selectionName = `Double Chance Draw or ${sel.awayTeam}`;
                            } else {
                              selectionName = sel.marketDisplayName;
                            }
                          } else {
                            // marketDisplayName already has team info
                            selectionName = sel.marketDisplayName;
                          }
                        }
                        else {
                          // Use marketDisplayName for other markets
                          selectionName = sel.marketDisplayName;
                        }
                      }
                      else selectionName = sel.priceType.replace(/-/g, ' ');
                      
                      return `${periodCode} - ${selectionName} @ ${typeof sel.odds === 'string' ? sel.odds : sel.odds.toFixed(2)}`;
                    })()}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Input Field */}
          <div className="bg-white rounded-lg p-3 mb-3 border border-purple-200">
            <label className="text-xs text-gray-600 font-semibold block mb-2">
              {refundModeType === 'budget' ? 'Total Budget (Rs)' : 'Target Profit (Rs)'}
            </label>
            <input
              type="number"
              value={refundModeType === 'budget' ? (budgetAmount === 0 ? '' : budgetAmount) : (targetProfit === 0 ? '' : targetProfit)}
              onChange={(e) => {
                const val = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                if (refundModeType === 'budget') {
                  setBudgetAmount(val);
                } else {
                  setTargetProfit(val);
                }
              }}
              className="w-full p-3 text-2xl font-bold border-2 border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-center"
              placeholder="0"
            />
          </div>

          {/* Calculation Results */}
          {(() => {
            const mainOdds = typeof mainBetSelection.odds === 'string' ? parseFloat(mainBetSelection.odds) : mainBetSelection.odds;
            const refundOdds = typeof selections[1]?.odds === 'string' ? parseFloat(selections[1].odds) : selections[1]?.odds || 0;
            const TAX_RATE = 0.8772; // After 14% tax
            
            // Check for bonus: use detected bonus from background test bet, or fallback to apiBreakdown
            const apiHasBonus = apiBreakdown && apiBreakdown.bonus > 0;
            const apiBonusPercentage = apiHasBonus ? (apiBreakdown.bonus / (apiBreakdown.netPayout - apiBreakdown.bonus)) * 100 : 0;
            
            // Priority: 1. Detected bonus from background test bet, 2. apiBreakdown from previous user bet, 3. No bonus
            const hasBonus = detectedBonusPercentage > 0 || apiHasBonus;
            const bonusPercentage = detectedBonusPercentage > 0 ? detectedBonusPercentage : apiBonusPercentage;
            const BONUS_MULTIPLIER = hasBonus ? (1 + bonusPercentage / 100) : 1;
            
            let mainStake = 0, refundStake = 0, totalPaid = 0, profit = 0;
            let mainPayout = 0, refundPayout = 0, totalStakeAfterTax = 0;
            
            if (refundModeType === 'budget') {
              // Budget mode: mainStake + refundStake = budgetAmount (exact)
              // 
              // Equation 1 (refund wins): refundStake / 114 * 100 * refundOdds * BONUS = budgetAmount
              // => refundStake = budgetAmount * 114 / 100 / (refundOdds * BONUS_MULTIPLIER)
              // 
              // Equation 2 (main wins): mainStake / 114 * 100 * mainOdds * BONUS - refundStake = profit
              // => profit = mainStake / 114 * 100 * mainOdds * BONUS_MULTIPLIER - refundStake
              // 
              // Constraint: mainStake = budgetAmount - refundStake
              
              // Step 1: Calculate refund stake from equation 1
              const rawRefundStake = budgetAmount * (114 / 100) / (refundOdds * BONUS_MULTIPLIER);
              refundStake = Math.round(rawRefundStake);
              
              // Step 2: Calculate main stake from constraint
              mainStake = budgetAmount - refundStake; // Ensure exact sum
              
              // Step 3: Calculate payouts
              mainPayout = (mainStake / 114) * 100 * mainOdds * BONUS_MULTIPLIER;
              refundPayout = (refundStake / 114) * 100 * refundOdds * BONUS_MULTIPLIER;
              
              // Step 4: Calculate profit
              // When main wins: profit = mainPayout - budgetAmount (total amount paid)
              profit = mainPayout - budgetAmount;
            } else {
              // Target Profit mode: Calculate stakes for EXACT target profit
              // 
              // Equation 1 (refund wins): refundStake / 114 * 100 * refundOdds * BONUS = mainStake + refundStake
              // => mainStake = refundStake * (refundOdds * BONUS_MULTIPLIER * 100 / 114 - 1)
              // 
              // Equation 2 (main wins): mainStake / 114 * 100 * mainOdds * BONUS - (mainStake + refundStake) = targetProfit
              // 
              // Substitute mainStake from Eq1 into Eq2 and solve for refundStake
              
              const refundMultiplier = refundOdds * BONUS_MULTIPLIER * (100 / 114);
              const mainMultiplier = mainOdds * BONUS_MULTIPLIER * (100 / 114);
              
              // From Eq1: mainStake = refundStake * (refundMultiplier - 1)
              // Total = mainStake + refundStake = refundStake * refundMultiplier
              // From Eq2: mainStake * mainMultiplier - refundStake * refundMultiplier = targetProfit
              // => refundStake * (refundMultiplier - 1) * mainMultiplier - refundStake * refundMultiplier = targetProfit
              // => refundStake * [(refundMultiplier - 1) * mainMultiplier - refundMultiplier] = targetProfit
              // => refundStake = targetProfit / [(refundMultiplier - 1) * mainMultiplier - refundMultiplier]
              
              // Solve for refundStake
              const rawRefundStake = targetProfit / ((refundMultiplier - 1) * mainMultiplier - refundMultiplier);
              refundStake = Math.round(rawRefundStake);
              
              // Calculate mainStake from equation 1
              mainStake = Math.round(refundStake * (refundMultiplier - 1));
              
              // Calculate payouts
              mainPayout = (mainStake / 114) * 100 * mainOdds * BONUS_MULTIPLIER;
              refundPayout = (refundStake / 114) * 100 * refundOdds * BONUS_MULTIPLIER;
              
              // Verify profit: mainPayout - total stake paid
              profit = mainPayout - (mainStake + refundStake);







              if (!apiBreakdown && detectedBonusPercentage === 0) {

              }








            }

            return (
              <div className="bg-white rounded-lg p-3 border-2 border-purple-300">
                <div className="text-xs text-purple-600 font-semibold mb-2">💰 STAKES & OUTCOMES</div>
                
                {/* Validation: Check if profit is negative */}
                {Math.round(profit) < 0 ? (
                  <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3 mb-3">
                    <div className="flex items-center gap-2 text-red-700">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-bold text-sm">Invalid Bet</span>
                    </div>
                    <div className="text-xs text-red-600 mt-1">
                      Profit cannot be negative. Please adjust your budget/profit target or select different odds.
                    </div>
                  </div>
                ) : (
                  <>
                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Main Bet Stake:</span>
                    <span className="font-bold text-gray-800">Rs {mainStake.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Refund Bet Stake:</span>
                    <span className="font-bold text-gray-800">Rs {refundStake.toFixed(0)}</span>
                  </div>
                  <div className="border-t border-purple-200 pt-2 flex justify-between text-sm">
                    <span className="text-gray-600">Total Bet:</span>
                    <span className="font-bold text-purple-800">Rs {(mainStake + refundStake).toFixed(0)}</span>
                  </div>
                </div>

                <div className="bg-green-50 rounded-lg p-2 border border-green-200">
                  <div className="text-xs text-green-600 font-semibold mb-1">🎯 OUTCOMES</div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">If Main Wins:</span>
                    <span className="font-bold text-green-700">+Rs {Math.round(profit)} profit</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">If Refund Wins:</span>
                    <span className="font-bold text-blue-700">Rs {refundModeType === 'budget' ? budgetAmount.toFixed(0) : (mainStake + refundStake).toFixed(0)} (Full Refund)</span>
                  </div>
                  {hasBonus ? (
                    <div className="mt-2 pt-2 border-t border-green-300 text-xs text-green-600">
                      ✅ Includes {bonusPercentage.toFixed(0)}% bonus
                    </div>
                  ) : isDetectingBonus ? (
                    <div className="mt-2 pt-2 border-t border-yellow-200 text-xs text-yellow-600">
                      🔍 Detecting bonus structure...
                    </div>
                  ) : (
                    <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                      ℹ️ No bonus for this API source
                    </div>
                  )}
                </div>
                </>
                )}
              </div>
            );
          })()}
        </div>
      )}

      <div className="border-t pt-4 flex flex-col">
        {/* Prominent Stake Input - Hidden in Bet Refund Mode and after placing bet */}
        {!betRefundMode && !lastResult && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 order-2">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-lg font-bold text-gray-800">
                💰 Enter Your Stake
              </label>
              <div className="text-sm text-gray-600">Total Odds</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600 font-medium text-2xl font-bold">
                    Rs
                  </span>
                  <input
                    type="number"
                    min="25"
                    step="10"
                    value={betAmount || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Allow clearing the input completely
                      if (value === '') {
                        setBetAmount(0);
                      } else {
                        setBetAmount(parseInt(value) || 0);
                      }
                    }}
                    className="w-full pl-20 pr-4 py-3 text-2xl font-bold border-2 border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    placeholder={selections.length === 1 && selectedSource?.id === 'superscore' ? "25" : "50"}
                  />
                </div>
              </div>
              <div className="text-2xl font-bold text-blue-600 bg-white px-4 py-3 rounded-lg border">
                {totalOdds.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Potential Return Section - Hidden in Bet Refund Mode and after placing bet */}
        {!betRefundMode && !lastResult && (
          <div className="bg-blue-50 p-4 rounded-lg mb-4 order-2">
          {/* Show Potential Return when stake has been edited (betAmount differs from apiBreakdown.stake) */}
          {lastResult && apiBreakdown && betAmount !== apiBreakdown.stake ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-700">Potential Return (new stake):</span>
                <span className="text-2xl font-bold text-blue-600">
                  Rs {formatCurrency(betAmount * totalOdds)}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                Stake: Rs {formatCurrency(betAmount)} × Odds: {totalOdds.toFixed(2)}
              </div>
              {/* Show previous bet breakdown */}
              <div className="mt-3 pt-3 border-t border-blue-200">
                <div className="text-xs text-gray-500 mb-2">Previous Bet:</div>
                <div className="text-xs text-gray-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Stake:</span>
                    <span className="font-medium">Rs {Math.round(apiBreakdown.stake)}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Tax:</span>
                    <span className="font-medium">-Rs {apiBreakdown.tax.toFixed(2)}</span>
                  </div>
                  {apiBreakdown.bonus > 0 && (() => {
                    // Calculate bonus percentage from API response
                    // Formula: bonus% = (bonus / (netPayout - bonus)) × 100 (rounded to integer)
                    const basePayoutWithoutBonus = apiBreakdown.netPayout - apiBreakdown.bonus;
                    const rawPercentage = basePayoutWithoutBonus > 0 ? (apiBreakdown.bonus / basePayoutWithoutBonus) * 100 : 0;
                    // Round the final percentage to nearest integer
                    const bonusPercentage = Math.round(rawPercentage);
                    return (
                      <div className="flex justify-between text-green-600">
                        <span>Bonus ({bonusPercentage}%):</span>
                        <span className="font-medium">+Rs {formatCurrency(apiBreakdown.bonus)}</span>
                      </div>
                    );
                  })()}
                  <div className="flex justify-between border-t border-blue-200 pt-1 font-bold text-lg">
                    <span className="text-gray-700">Net Payout:</span>
                    <span className="text-green-600">Rs {formatCurrency(apiBreakdown.netPayout)}</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* BEFORE bet: Show simple calculation */
            (!apiBreakdown ? (
            <>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-700">Potential Return:</span>
                <span className="text-2xl font-bold text-blue-600">
                  Rs {formatCurrency(potentialReturn)}
                </span>
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Stake: Rs {formatCurrency(betAmount)} × Odds: {totalOdds.toFixed(2)}
              </div>
            </>
          ) : (
            /* AFTER bet: Show detailed API breakdown */
            <>
              <div className="text-xs text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Stake:</span>
                  <span className="font-medium">Rs {Math.round(apiBreakdown.stake)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Tax:</span>
                  <span className="font-medium">-Rs {apiBreakdown.tax.toFixed(2)}</span>
                </div>
                {apiBreakdown.bonus > 0 && (() => {
                  // Calculate bonus percentage from API response
                  // Formula: bonus% = (bonus / (netPayout - bonus)) × 100 (rounded to integer)
                  const basePayoutWithoutBonus = apiBreakdown.netPayout - apiBreakdown.bonus;
                  const rawPercentage = basePayoutWithoutBonus > 0 ? (apiBreakdown.bonus / basePayoutWithoutBonus) * 100 : 0;
                  // Round the final percentage to nearest integer
                  const bonusPercentage = Math.round(rawPercentage);
                  
                  console.log('[Bonus Calculation Debug]:', {
                    stake: apiBreakdown.stake,
                    tax: apiBreakdown.tax,
                    totalOdds,
                    netPayout: apiBreakdown.netPayout,
                    bonus: apiBreakdown.bonus,
                    basePayoutWithoutBonus,
                    rawPercentage,
                    bonusPercentage
                  });
                  
                  return (
                    <div className="flex justify-between text-green-600">
                      <span>Bonus ({bonusPercentage}%):</span>
                      <span className="font-medium">+Rs {formatCurrency(apiBreakdown.bonus)}</span>
                    </div>
                  );
                })()}
                <div className="flex justify-between border-t border-blue-200 pt-1 font-bold text-xl mt-2">
                  <span className="text-gray-700">Net Payout:</span>
                  <span className="text-green-600">Rs {formatCurrency(apiBreakdown.netPayout)}</span>
                </div>
              </div>
            </>
          ))
          )}
          {/* Show rebate information when available from Totelepep */}
          {lastResult && lastResult.fullResponse && lastResult.fullResponse.betList && lastResult.fullResponse.betList.length > 0 && (
            <div className="text-xs text-gray-500 mt-2">
              {(() => {
                const firstBet = lastResult.fullResponse.betList[0];
                const rebateAmount = firstBet.rebateAmount || 0;
                
                return (
                  <>
                    {rebateAmount > 0 && <div>Rebate: MUR {parseFloat(rebateAmount).toFixed(2)}</div>}
                  </>
                );
              })()}
            </div>
          )}
        </div>
        )}

        {/* REMOVED: Match list with delete buttons after placing bet */}

        {/* Booking Result Display - Match list + booking ref, SMS, and stake info */}
        {!betRefundMode && lastResult && lastResult.success && lastResult.fullResponse && selections.length > 0 && (
          <div className="mb-4 border-2 border-green-500 rounded-lg overflow-hidden bg-white order-1">
            <div ref={bookingRefRef} className="bg-white max-h-[60vh] overflow-y-auto">
              {/* Match List - Same as refund mode, not scrollable */}
              {selections.map((selection, index) => {
                  const bet = lastResult.fullResponse.betList?.[index] || {};
                  return (
                    <div key={index} className="p-3 border-b border-gray-200 bg-yellow-50 last:border-b-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {/* Selection name @ odds */}
                          <div className="text-sm font-semibold text-gray-800">
                            {(() => {
                              let selectionName = '';
                              if (bet.optionName) {
                                selectionName = bet.optionName;
                              } else if (selection) {
                                if (selection.priceType === 'home') selectionName = selection.homeTeam;
                                else if (selection.priceType === 'draw') selectionName = 'Draw';
                                else if (selection.priceType === 'away') selectionName = selection.awayTeam;
                                else selectionName = selection.priceType;
                              }
                              const odds = bet.optionOdd || (typeof selection?.odds === 'string' ? selection.odds : selection?.odds?.toFixed(2));
                              return `${selectionName} @ ${odds}`;
                            })()}
                          </div>
                          {/* Match name */}
                          <div className="text-xs text-gray-600 font-medium mt-1">
                            {selection?.homeTeam} v {selection?.awayTeam}
                          </div>
                          {/* Competition */}
                          {(selection?.league || bet.competitionName) && (
                            <div className="text-xs text-gray-500 font-medium mt-1">
                              ⚽ {bet.competitionName || selection?.league}
                            </div>
                          )}
                          {/* Date */}
                          {selection?.matchDate && (
                            <div className="text-xs text-gray-500 font-medium">
                              {(() => {
                                try {
                                  const date = new Date(selection.matchDate);
                                  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                  const day = days[date.getDay()];
                                  const dateNum = date.getDate();
                                  const month = months[date.getMonth()];
                                  const year = date.getFullYear();
                                  return `${day} ${dateNum} ${month} ${year}`;
                                } catch {
                                  return selection.matchDate;
                                }
                              })()}
                            </div>
                          )}
                          {/* Time and market */}
                          <div className="text-xs text-gray-500 mt-1">
                            {(() => {
                              const kickoff = selection?.kickoff || 'Today';
                              const marketDisplayName = bet.marketDisplayName || selection?.marketDisplayName || '1 X 2';
                              const periodCode = selection?.periodCode || 'FT';
                              const periodSuffix = periodCode === 'FT' ? ' - Full Time' : 
                                                  periodCode === 'H1' ? ' - Half Time' : 
                                                  periodCode === '2H' ? ' - 2nd Half' : 
                                                  ` - ${periodCode}`;
                              const marketName = marketDisplayName.includes(' - ') ? marketDisplayName : `${marketDisplayName}${periodSuffix}`;
                              return `${kickoff} ${marketName}`;
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
              })}

              {/* Stake and Win Breakdown - Above booking ref */}
              <div className="border-t border-gray-200">
                {/* Simple Win/Stake display */}
                <div className="flex">
                  <div className="flex-1 p-3 text-center border-r border-gray-200">
                    <div className="text-xs text-gray-600">Win</div>
                    <div className="text-lg font-bold text-gray-800">
                      {(() => {
                        if (apiBreakdown) {
                          return formatCurrency(apiBreakdown.netPayout);
                        }
                        return formatCurrency(potentialReturn);
                      })()}
                    </div>
                  </div>
                  <div className="flex-1 p-3 text-center bg-gray-50">
                    <div className="text-xs text-gray-600">Stake</div>
                    <div className="text-lg font-bold text-gray-800">{parseInt(String(betAmount))}</div>
                  </div>
                </div>
                
                {/* Detailed breakdown with bonus - only show when apiBreakdown exists with bonus */}
                {apiBreakdown && apiBreakdown.bonus > 0 && (
                  <div className="p-3 bg-blue-50 border-t border-blue-200">
                    <div className="text-xs text-gray-600 space-y-1">
                      <div className="flex justify-between">
                        <span>Base Stake:</span>
                        <span className="font-medium">Rs {Math.round(apiBreakdown.stake)}</span>
                      </div>
                      <div className="flex justify-between text-red-600">
                        <span>Tax:</span>
                        <span className="font-medium">-Rs {apiBreakdown.tax.toFixed(2)}</span>
                      </div>
                      {apiBreakdown.bonus > 0 && (() => {
                        // Calculate bonus percentage from API response
                        const basePayoutWithoutBonus = apiBreakdown.netPayout - apiBreakdown.bonus;
                        const rawPercentage = basePayoutWithoutBonus > 0 ? (apiBreakdown.bonus / basePayoutWithoutBonus) * 100 : 0;
                        const bonusPercentage = Math.round(rawPercentage);
                        return (
                          <div className="flex justify-between text-green-600">
                            <span>Bonus ({bonusPercentage}%):</span>
                            <span className="font-medium">+Rs {formatCurrency(apiBreakdown.bonus)}</span>
                          </div>
                        );
                      })()}
                      <div className="flex justify-between border-t border-blue-200 pt-1 font-bold text-sm">
                        <span className="text-gray-700">Net Payout:</span>
                        <span className="text-green-600">Rs {formatCurrency(apiBreakdown.netPayout)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Booking Reference */}
              <div className="p-3 bg-green-500 text-white text-center">
                <div className="text-2xl font-bold">
                  Booking Ref# {lastResult.ticketNo}
                </div>
              </div>

              {/* SMS Option */}
              <div 
                className="p-3 bg-yellow-400 text-center border-t border-yellow-500 cursor-pointer select-none active:bg-yellow-500 transition-colors"
                onMouseDown={handleSmsPressStart}
                onMouseUp={handleSmsPressEnd}
                onMouseLeave={handleSmsPressEnd}
                onTouchStart={handleSmsPressStart}
                onTouchEnd={handleSmsPressEnd}
              >
                <div className="flex items-center justify-center gap-2 text-xl font-bold text-gray-800">
                  <span>📱</span>
                  <span>SMS BET{lastResult.ticketNo}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bet Refund Mode - Dual Booking Result Display */}
        {betRefundMode && lastResult && lastResult.success && lastResult.fullResponse?.mainBet && lastResult.fullResponse?.refundBet && (
          <div className="mb-4 border-2 border-green-500 rounded-lg overflow-y-auto max-h-[60vh] bg-white order-1">
            <div className="p-3 bg-green-100 border-b border-green-200">
              <div className="text-center font-bold text-green-800">🎯 Bet Refund Mode - Both Bets Placed</div>
            </div>
            
            {/* Main Bet */}
            <div className="border-b-2 border-green-200">
              <div className="p-2 bg-green-50 text-center">
                <div className="text-sm font-bold text-green-700">MAIN BET</div>
              </div>
              <div className="p-3 border-b border-gray-200 bg-yellow-50">
                <div className="text-sm font-semibold text-gray-800 mb-2">
                  {mainBetSelection?.homeTeam} v {mainBetSelection?.awayTeam}
                </div>
                <div className="text-xs text-gray-600 mb-2">
                  {mainBetSelection?.periodCode || 'FT'} - {mainBetSelection?.priceType} @ {mainBetSelection?.odds}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Stake:</span>
                  <span className="font-bold">Rs {lastResult.fullResponse.mainStake}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Potential Win:</span>
                  <span className="font-bold text-green-700">Rs {lastResult.fullResponse.mainBet.potentialPayout}</span>
                </div>
              </div>
              <div ref={bookingRefRef} className="bg-white">
                {selectedSource && (
                  <div className="p-2 bg-blue-50 text-center border-b border-blue-200">
                    <div className="text-xl font-bold text-blue-700">{selectedSource.displayName}</div>
                  </div>
                )}
                <div className="p-3 bg-green-500 text-white text-center">
                  <div className="text-2xl font-bold">Booking Ref# {lastResult.fullResponse.mainBet.ticketNo}</div>
                </div>
                <div
                  className="p-3 bg-yellow-400 text-center border-t border-yellow-500 cursor-pointer"
                  onMouseDown={handleSmsPressStart}
                  onMouseUp={handleSmsPressEnd}
                  onMouseLeave={handleSmsPressEnd}
                  onTouchStart={handleSmsPressStart}
                  onTouchEnd={handleSmsPressEnd}
                >
                  <div className="flex items-center justify-center gap-2 text-xl font-bold text-gray-800">
                    <span>📱</span>
                    <span>SMS BET{lastResult.fullResponse.mainBet.ticketNo}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Refund Bet */}
            <div>
              <div className="p-2 bg-green-50 text-center">
                <div className="text-sm font-bold text-green-700">REFUND BET</div>
              </div>
              <div className="p-3 border-b border-gray-200 bg-yellow-50">
                <div className="text-sm font-semibold text-gray-800 mb-2">
                  {refundSelections[selectedRefundIndex]?.homeTeam} v {refundSelections[selectedRefundIndex]?.awayTeam}
                </div>
                <div className="text-xs text-gray-600 mb-2">
                  {refundSelections[selectedRefundIndex]?.periodCode || 'FT'} - {refundSelections[selectedRefundIndex]?.priceType} @ {refundSelections[selectedRefundIndex]?.odds}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Stake:</span>
                  <span className="font-bold">Rs {lastResult.fullResponse.refundStake}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Potential Win:</span>
                  <span className="font-bold text-green-700">Rs {lastResult.fullResponse.refundBet.potentialPayout}</span>
                </div>
              </div>
              <div className="bg-white">
                <div className="p-2 bg-blue-50 text-center border-b border-blue-200">
                  <div className="text-xl font-bold text-blue-700">{selectedSource?.displayName}</div>
                </div>
                {lastResult.fullResponse.refundBet.ticketNo && (
                  <>
                    <div className="p-3 bg-green-500 text-white text-center">
                      <div className="text-2xl font-bold">Booking Ref# {lastResult.fullResponse.refundBet.ticketNo}</div>
                    </div>
                    <div
                      className="p-3 bg-yellow-400 text-center border-t border-yellow-500 cursor-pointer"
                      onMouseDown={handleSmsPressStart}
                      onMouseUp={handleSmsPressEnd}
                      onMouseLeave={handleSmsPressEnd}
                      onTouchStart={handleSmsPressStart}
                      onTouchEnd={handleSmsPressEnd}
                    >
                      <div className="flex items-center justify-center gap-2 text-xl font-bold text-gray-800">
                        <span>📱</span>
                        <span>SMS BET{lastResult.fullResponse.refundBet.ticketNo}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {lastResult && !lastResult.success && (
          <div className="p-4 rounded-lg mb-4 bg-red-50 border border-red-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="font-medium text-red-800">
                {lastResult.message}
              </span>
            </div>
          </div>
        )}

        <button
          onClick={handlePlaceBet}
          disabled={isPlacing || selections.length === 0}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors order-3"
        >
          {isPlacing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              Placing Bet...
            </>
          ) : (
            <>
              Place Parlay Bet
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ParlayBuilder;
