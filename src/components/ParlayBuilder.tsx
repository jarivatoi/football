import React, { useState, useEffect } from 'react';
import { Trash2, Calculator, DollarSign, CheckCircle, AlertCircle, X } from 'lucide-react';

// Totelepep betting API integration
const placeTotelepepBet = async (selections: ParlaySelection[], stake: number) => {
  try {
    console.log('🔍 Analyzing selections for market data:', selections);
    console.log('💰 Stake amount:', stake);
    
    // Build the form data in Totelepep's exact format
    const formData = new URLSearchParams();
    
    console.log(`🎯 PLACING BET DEBUG INFO:`);
    console.log(`   Stake amount:`, stake);
    console.log(`   Number of selections:`, selections.length);
    
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
      console.log(`🔗 Multi-bet (Parlay) - Total Odds: ${totalOdds.toFixed(2)}, MultiStake: ${stake}`);
    } else {
      formData.append('data[MultiStake]', '');
    }
        
    // Add each selection as SingleBets array
    selections.forEach((selection, index) => {
      console.log(`📋 Processing selection ${index}:`, selection);
          
      // Specific debug for PSV Eindhoven vs ZFK Minsk or any match
      if (selection.homeTeam && selection.awayTeam) {
        console.log(`🎯 MATCH DEBUG: ${selection.homeTeam} vs ${selection.awayTeam}`);
        console.log(`   matchId:`, selection.matchId);
        console.log(`   marketBookNo:`, selection.marketBookNo);
        console.log(`   marketCode:`, selection.marketCode);
        console.log(`   competitionId:`, selection.competitionId);
      }
          
      // Map selection type to option details FIRST (needed for betRef)
      const optionDetails = getOptionDetails(selection);
      console.log(`📋 Option details for selection ${index}:`, optionDetails);
          
      // Generate betRef (format: marketId-optionNo) - Use marketId NOT marketBookNo!
      const marketIdToUse = selection.marketId || selection.marketBookNo || selection.matchId;
      const betRef = `${marketIdToUse}-${optionDetails.optionNo}`;
      console.log(`🔍 betRef result - marketIdToUse: ${marketIdToUse}, optionNo: ${optionDetails.optionNo}, betRef: ${betRef}`);
      
      // Extract real market data from the match
      const marketData = extractMarketData(selection);
      console.log(`📋 Market data for selection ${index}:`, marketData);
      
      // Additional validation for market data to ensure we don't send "null" or "undefined" strings
      let finalMarketBookNo = marketData.marketBookNo;
      let finalMarketCode = marketData.marketCode;
      
      console.log(`🔍 placeTotelepepBet validation - initial finalMarketBookNo:`, finalMarketBookNo);
      console.log(`🔍 placeTotelepepBet validation - initial finalMarketCode:`, finalMarketCode);
      
      // Use marketBookNo when available, with minimal validation
      // Only override if the value is truly invalid
      const hasUsableFinalMarketBookNo = finalMarketBookNo && 
        finalMarketBookNo !== 'undefined' && 
        finalMarketBookNo !== 'null' && 
        finalMarketBookNo.trim() !== '' && 
        finalMarketBookNo.trim() !== '0' &&
        !isNaN(Number(finalMarketBookNo));
      
      if (!hasUsableFinalMarketBookNo) {
        console.warn(`⚠️ Invalid marketBookNo for selection ${index}, using fallback`);
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
        console.warn(`⚠️ Invalid marketCode for selection ${index}, using fallback`);
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
        console.warn(`⚠️ marketBookNo is not a valid number for selection ${index}, using matchId fallback`);
        // Try to use the original selection's marketBookNo if it's valid
        if (selection.marketBookNo && !isNaN(Number(selection.marketBookNo)) && Number(selection.marketBookNo) > 0) {
          finalMarketBookNo = selection.marketBookNo;
        } else {
          finalMarketBookNo = selection.matchId || '76713';
        }
      }
      
      // Additional safety checks
      console.log(`🔍 placeTotelepepBet validation - finalMarketBookNo before safety:`, finalMarketBookNo);
      console.log(`🔍 placeTotelepepBet validation - finalMarketCode before safety:`, finalMarketCode);
      
      // Ensure we have valid string values
      // Only override if we don't have a valid marketBookNo from the selection
      if (!finalMarketBookNo || typeof finalMarketBookNo !== 'string' || finalMarketBookNo === 'null' || finalMarketBookNo === 'undefined' || finalMarketBookNo.trim() === '') {
        // Try to use the original selection's marketBookNo if it's valid
        if (selection.marketBookNo && selection.marketBookNo !== 'null' && selection.marketBookNo !== 'undefined' && selection.marketBookNo.trim() !== '' && !isNaN(Number(selection.marketBookNo)) && Number(selection.marketBookNo) > 0) {
          finalMarketBookNo = selection.marketBookNo;
          console.log(`🔍 placeTotelepepBet validation - finalMarketBookNo restored from selection:`, finalMarketBookNo);
        } else {
          finalMarketBookNo = selection.matchId || '76713';
          console.log(`🔍 placeTotelepepBet validation - finalMarketBookNo fallback to matchId:`, finalMarketBookNo);
        }
      }
      
      // Only override marketCode if it's truly invalid
      if (!finalMarketCode || typeof finalMarketCode !== 'string' || finalMarketCode === 'null' || finalMarketCode === 'undefined' || finalMarketCode.trim() === '') {
        // Try to use the original selection's marketCode if it's valid
        if (selection.marketCode && selection.marketCode !== 'null' && selection.marketCode !== 'undefined' && selection.marketCode.trim() !== '') {
          finalMarketCode = selection.marketCode;
          console.log(`🔍 placeTotelepepBet validation - finalMarketCode restored from selection:`, finalMarketCode);
        } else {
          finalMarketCode = 'CP';
          console.log(`🔍 placeTotelepepBet validation - finalMarketCode fallback to CP:`, finalMarketCode);
        }
      }
      
      console.log(`🔍 placeTotelepepBet validation - final finalMarketBookNo:`, finalMarketBookNo);
      console.log(`🔍 placeTotelepepBet validation - final finalMarketCode:`, finalMarketCode);
      
      // Log final form data values for debugging
      console.log(`📋 Final form data values for selection ${index}:`, {
        betRef: betRef,
        stake: stake.toString(),
        marketBookNo: finalMarketBookNo,
        marketCode: finalMarketCode,
        matchId: selection.matchId,
        competitionId: marketData.competitionId
      });
      
      // Additional debugging for marketId issues
      console.log(`🔍 FINAL MARKET DATA DEBUG for selection ${index}:`, {
        finalMarketBookNo: finalMarketBookNo,
        finalMarketBookNoType: typeof finalMarketBookNo,
        hasUsableFinalMarketBookNo: hasUsableFinalMarketBookNo
      });
      
      formData.append(`data[SingleBets][${index}][betRef]`, betRef);
      formData.append(`data[SingleBets][${index}][isRacing]`, 'false');
      formData.append(`data[SingleBets][${index}][legNo]`, (index + 1).toString()); // Increment legNo: 1, 2, 3...
      formData.append(`data[SingleBets][${index}][matchName]`, `${selection.homeTeam} v ${selection.awayTeam}`);
      formData.append(`data[SingleBets][${index}][matchStartTime]`, formatMatchTime(selection.kickoff));
      formData.append(`data[SingleBets][${index}][matchRunTime]`, '0');
      formData.append(`data[SingleBets][${index}][optionNo]`, optionDetails.optionNo);
      formData.append(`data[SingleBets][${index}][optionCode]`, optionDetails.optionCode);
      formData.append(`data[SingleBets][${index}][optionName]`, optionDetails.optionName);
      formData.append(`data[SingleBets][${index}][optionOdd]`, selection.odds.toString());
      formData.append(`data[SingleBets][${index}][optionPreviousOdd]`, selection.odds.toString());
      formData.append(`data[SingleBets][${index}][sportName]`, 'Soccer');
      formData.append(`data[SingleBets][${index}][sportIcon]`, 'soccer_icn');
      formData.append(`data[SingleBets][${index}][competitionName]`, marketData.competitionName);
      formData.append(`data[SingleBets][${index}][competitionId]`, marketData.competitionId);
      // Use selection.marketId if available (from GetMatch API), otherwise fall back to marketBookNo or matchId
      console.log(`🔍 marketId generation - selection:`, selection);
      
      const marketId = (selection.marketId && selection.marketId !== '0')
        ? selection.marketId
        : (selection.marketBookNo && selection.marketBookNo !== '0')
        ? selection.marketBookNo
        : (selection.matchId || '0');
      
      console.log(`🔍 marketId result - selection.marketId: ${selection.marketId}, selection.marketBookNo: ${selection.marketBookNo}, final marketId: ${marketId}`);
      
      console.log(`🔍 DETAILED MARKET ID DEBUGGING:`);
      console.log(`   selection.marketId:`, selection.marketId);
      console.log(`   selection.marketBookNo:`, selection.marketBookNo);
      console.log(`   selection.matchId:`, selection.matchId);
      console.log(`   Final marketId:`, marketId);
      console.log(`   Final marketId type:`, typeof marketId);
      
      // Special handling for the correct marketBookNo
      if (selection.marketBookNo === '5160495') {
        console.log(`🎯 FOUND EXACT MATCH MARKETBOOKNO for selection ${index}!`);
      }
      
      // Ensure we're not sending undefined or null values
      // Use the actual marketBookNo and marketCode values when available
      // Simplified logic to ensure we send the correct values
      // Enhanced validation to ensure we always send valid string values
      let safeMarketBookNo = '76713'; // Default fallback
      let safeMarketCode = 'CP'; // Default fallback
      
      // Priority 1: Use selection.marketBookNo if it's valid
      if (selection.marketBookNo && 
          typeof selection.marketBookNo === 'string' && 
          selection.marketBookNo !== 'null' && 
          selection.marketBookNo !== 'undefined' && 
          selection.marketBookNo.trim() !== '' && 
          selection.marketBookNo.trim() !== '0') {
        safeMarketBookNo = selection.marketBookNo;
        console.log(`   🎯 Using selection.marketBookNo: ${safeMarketBookNo}`);
      }
      // Priority 2: Use finalMarketBookNo if it's valid
      else if (finalMarketBookNo && 
               typeof finalMarketBookNo === 'string' && 
               finalMarketBookNo !== 'null' && 
               finalMarketBookNo !== 'undefined' && 
               finalMarketBookNo.trim() !== '' && 
               finalMarketBookNo.trim() !== '0') {
        safeMarketBookNo = finalMarketBookNo;
        console.log(`   🎯 Using finalMarketBookNo: ${safeMarketBookNo}`);
      }
      // Priority 3: Use selection.matchId as fallback
      else if (selection.matchId && 
               typeof selection.matchId === 'string' && 
               selection.matchId !== 'null' && 
               selection.matchId !== 'undefined' && 
               selection.matchId.trim() !== '' && 
               selection.matchId.trim() !== '0') {
        safeMarketBookNo = selection.matchId;
        console.log(`   🎯 Using selection.matchId as fallback: ${safeMarketBookNo}`);
      }
      
      // Same priority logic for marketCode
      if (selection.marketCode && 
          typeof selection.marketCode === 'string' && 
          selection.marketCode !== 'null' && 
          selection.marketCode !== 'undefined' && 
          selection.marketCode.trim() !== '') {
        safeMarketCode = selection.marketCode;
        console.log(`   🎯 Using selection.marketCode: ${safeMarketCode}`);
      }
      else if (finalMarketCode && 
               typeof finalMarketCode === 'string' && 
               finalMarketCode !== 'null' && 
               finalMarketCode !== 'undefined' && 
               finalMarketCode.trim() !== '') {
        safeMarketCode = finalMarketCode;
        console.log(`   🎯 Using finalMarketCode: ${safeMarketCode}`);
      }
      // Default fallback for marketCode
      else {
        safeMarketCode = 'CP';
        console.log(`   🎯 Using default marketCode: ${safeMarketCode}`);
      }
      
      // Debug the form data being added
      console.log(`📋 Adding form data for selection ${index}:`);
      console.log(`   marketId: ${marketId} (type: ${typeof marketId})`);
      console.log(`   marketBookNo: ${safeMarketBookNo} (type: ${typeof safeMarketBookNo})`);
      console.log(`   marketCode: ${safeMarketCode} (type: ${typeof safeMarketCode})`);
      
      // Additional validation for the safe values
      console.log(`🔍 DETAILED MARKETBOOKNO DEBUG for selection ${index}:`, {
        originalSelectionMarketBookNo: selection.marketBookNo,
        finalMarketBookNo: finalMarketBookNo,
        safeMarketBookNo: safeMarketBookNo,
        isFinalMarketBookNoValid: safeMarketBookNo && !isNaN(Number(safeMarketBookNo)) && Number(safeMarketBookNo) > 0
      });
      
      // Additional debugging for safe values
      console.log(`🔍 SAFE VALUES DEBUG for selection ${index}:`, {
        selectionMarketBookNo: selection.marketBookNo,
        finalMarketBookNo: finalMarketBookNo,
        selectionMarketCode: selection.marketCode,
        finalMarketCode: finalMarketCode,
        safeMarketBookNo: safeMarketBookNo,
        safeMarketCode: safeMarketCode
      });
      
      console.log(`   Safe marketBookNo: ${safeMarketBookNo} (type: ${typeof safeMarketBookNo})`);
      console.log(`   Safe marketCode: ${safeMarketCode} (type: ${typeof safeMarketCode})`);
      
      // Additional validation for the safe values
      console.log(`🔍 SAFE VALUES VALIDATION for selection ${index}:`, {
        safeMarketBookNoIsValid: safeMarketBookNo && safeMarketBookNo !== 'null' && safeMarketBookNo !== 'undefined' && safeMarketBookNo.trim() !== '',
        safeMarketCodeIsValid: safeMarketCode && safeMarketCode !== 'null' && safeMarketCode !== 'undefined' && safeMarketCode.trim() !== '',
        safeMarketBookNoValue: safeMarketBookNo,
        safeMarketCodeValue: safeMarketCode
      });
      
      // Debug the exact values being sent
      console.log(`🔍 FORM DATA VALUES for selection ${index}:`, {
        marketId: marketId,
        marketBookNo: safeMarketBookNo,
        marketCode: safeMarketCode
      });
      
      formData.append(`data[SingleBets][${index}][marketId]`, marketId);
      formData.append(`data[SingleBets][${index}][marketBookNo]`, safeMarketBookNo);
      // Use optionDetails.marketType (e.g., '1X2', 'OU', 'BTTS') instead of selection.marketCode
      formData.append(`data[SingleBets][${index}][marketCode]`, selection.marketCode || 'CP');  // Use CP for Win-Draw-Win
      formData.append(`data[SingleBets][${index}][marketLine]`, '');
      formData.append(`data[SingleBets][${index}][marketIsLive]`, '0');
      formData.append(`data[SingleBets][${index}][marketIsRacing]`, '0');
      formData.append(`data[SingleBets][${index}][marketPeriodCode]`, 'FT');
      // Update market display name based on market type
      const marketDisplayName = optionDetails.marketType === '1X2' ? '1 X 2' : optionDetails.marketType === 'OU' ? 'Over/Under 2.5' : 'Both Teams To Score';
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
      
      console.log(`📋 Selection ${index} market data:`, {
        matchId: selection.matchId,
        competitionName: marketData.competitionName,
        competitionId: marketData.competitionId,
        marketBookNo: finalMarketBookNo,
        marketCode: finalMarketCode,
        matchTime: formatMatchTime(selection.kickoff)
      });
    });
    
    // Proxy bet flag
    formData.append('data[ProxyBet]', '0');
    
    console.log('📡 Sending Totelepep bet request:', formData.toString());
    
    // Parse and log the form data for easier reading
    const formDataObj: Record<string, string> = {};
    formData.forEach((value, key) => {
      formDataObj[key] = value.toString();
    });
    console.log('📋 Form Data Object:', JSON.stringify(formDataObj, null, 2));
          
    // Additional debugging to check specific market fields
    console.log('🔍 Checking specific market fields in formData:');
    for (let [key, value] of formData.entries()) {
      if (key.includes('marketBookNo') || key.includes('marketCode') || key.includes('marketId')) {
        console.log(`   ${key}: ${value} (type: ${typeof value})`);
      }
    }
    
    // Additional specific check for marketBookNo and marketCode fields
    console.log('🔍 Detailed market field check:');
    Object.keys(formDataObj).forEach(key => {
      if (key.includes('marketBookNo') || key.includes('marketCode')) {
        console.log(`   ${key}: "${formDataObj[key]}" (length: ${formDataObj[key].length})`);
        // Check if the value is actually "null" or "undefined" as strings
        if (formDataObj[key] === 'null' || formDataObj[key] === 'undefined') {
          console.error(`   ❌ ERROR: Found string "${formDataObj[key]}" in ${key} field!`);
        }
      }
    });
    
    // Place bet on Totelepep API (with CORS proxy for GitHub Pages)
    const betUrl = 'https://corsproxy.io/?' + encodeURIComponent('https://www.totelepep.mu/webapi/placebet');
    
    console.log('📡 Sending bet request to Totelepep API (via CORS proxy)');
    console.log('📝 Form data:', formData.toString());
    
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
    console.log('📄 Totelepep response:', result);
    console.log('📄 FULL RESULT JSON:', JSON.stringify(result, null, 2));
    
    // Debug response details
    console.log('📊 Response Status:', response.status);
    console.log('📊 Response OK:', response.ok);
    console.log('📊 Response Headers:', [...response.headers.entries()]);
    
    // Log betList if it exists
    if (result.betList && result.betList.length > 0) {
      console.log('📋 BETLIST DETAILS:');
      console.log('  - ticketNo:', result.betList[0].ticketNo);
      console.log('  - bookingReference:', result.betList[0].bookingReference);
      console.log('  - betErrorCode:', result.betList[0].betErrorCode);
      console.log('  - betErrorMessage:', result.betList[0].betErrorMessage);
      console.log('  - Full betList[0]:', result.betList[0]);
    }
    
    // Extract ticket number from the response
    let ticketNo = result.ticketNo;
    
    // Enhanced ticket number extraction to handle various formats
    console.log('🔍 TICKET NUMBER EXTRACTION DEBUG:', {
      rawTicketNo: result.ticketNo,
      betList: result.betList,
      typeofTicketNo: typeof result.ticketNo,
      allResponseKeys: Object.keys(result),
      fullResponse: result
    });
    
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
          console.log(`🎯 Found ticket in field '${field}':`, ticketNo);
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
        console.log('🎯 Found ticketNo in betList:', ticketNo);
      }
      // Fallback to bookingReference
      else if (firstBet.bookingReference) {
        ticketNo = firstBet.bookingReference;
        console.log('🎯 Found bookingReference in betList:', ticketNo);
      }
    }
    
    // Also check top-level bookingReference
    if (!ticketNo && result.bookingReference) {
      ticketNo = result.bookingReference;
      console.log('🎯 Found bookingReference at top level:', ticketNo);
    }
    
    // If ticketNo is in the format "Booking Ref# 123456789", extract just the number
    if (ticketNo && typeof ticketNo === 'string' && ticketNo.includes('#')) {
      const match = ticketNo.match(/# (\d+)/);
      if (match && match[1]) {
        ticketNo = match[1];
        console.log('🎯 Extracted ticket number from Booking Ref format:', ticketNo);
      } else {
        // Try alternative patterns
        const altMatch = ticketNo.match(/#(\d+)/) || ticketNo.match(/(\d+)/);
        if (altMatch && altMatch[1]) {
          ticketNo = altMatch[1];
          console.log('🎯 Extracted ticket number from alternative format:', ticketNo);
        }
      }
    }
    
    // Debug the response before returning
    console.log('🎯 BET RESPONSE DEBUG:', {
      success: !result.errorMessage || result.ticketNo,
      ticketNo: ticketNo,
      hasTicketNo: !!result.ticketNo,
      errorMessage: result.errorMessage,
      hasErrorMessage: !!result.errorMessage,
      multiErrorMessage: result.multiErrorMessage,
      hasMultiErrorMessage: !!result.multiErrorMessage
    });
    
    // Enhanced success determination logic
    // Consider successful if we have a ticket, regardless of errorMessage
    // This handles cases where the API returns a ticket but also has warning messages
    const isSuccessful = !!ticketNo || (!result.errorMessage && !result.multiErrorMessage);
    
    console.log('🎯 ENHANCED SUCCESS DETERMINATION:', {
      hasTicketNo: !!ticketNo,
      hasErrorMessage: !!result.errorMessage,
      hasMultiErrorMessage: !!result.multiErrorMessage,
      finalSuccess: isSuccessful
    });
    
    return {
      success: isSuccessful,
      ticketNo: ticketNo,
      potentialPayout: result.betList && result.betList.length > 0 
        ? result.betList[0].potentialPayout  // Use potentialPayout from betList for single bets
        : result.potentialPayout,  // Use top-level potentialPayout for multi-bets
      errorMessage: result.errorMessage,
      multiErrorMessage: result.multiErrorMessage,
      balanceAmount: result.balanceAmount,
      betList: result.betList
    };
    
  } catch (error) {
    console.error('❌ Totelepep API error:', error);
    console.error('❌ Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Network error'
    };
  }
};

// Extract market data based on match and league
const extractMarketData = (selection: ParlaySelection) => {
  console.log('🔍 Extracting market data for selection:', selection);
  
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
  console.log(`🔍 extractMarketData - marketBookNo before null/undefined check:`, marketBookNo);
  console.log(`🔍 extractMarketData - marketCode before null/undefined check:`, marketCode);
  
  if (marketBookNo === 'null' || marketBookNo === 'undefined') {
    marketBookNo = selection.matchId || '76713';
  }
  
  if (marketCode === 'null' || marketCode === 'undefined') {
    marketCode = 'CP';
  }
  
  // Additional safety checks
  console.log(`🔍 extractMarketData - marketBookNo after null/undefined check:`, marketBookNo);
  console.log(`🔍 extractMarketData - marketCode after null/undefined check:`, marketCode);
  
  // Ensure we have valid string values
  if (!marketBookNo || typeof marketBookNo !== 'string') {
    marketBookNo = selection.matchId || '76713';
    console.log(`🔍 extractMarketData - marketBookNo fallback to matchId:`, marketBookNo);
  }
  
  if (!marketCode || typeof marketCode !== 'string') {
    marketCode = 'CP';
    console.log(`🔍 extractMarketData - marketCode fallback to CP:`, marketCode);
  }
  
  const marketData = {
    competitionName: league,
    competitionId,
    marketBookNo,
    marketCode
  };
  
  console.log('📊 Extracted market data:', marketData);
  console.log('🔍 Market Data Details:', {
    originalMarketBookNo: selection.marketBookNo,
    finalMarketBookNo: marketBookNo,
    hasUsableMarketBookNo: hasUsableMarketBookNo,
    marketBookNoType: typeof marketBookNo,
    marketBookNoLength: marketBookNo ? marketBookNo.toString().length : 0
  });
  
  // Additional validation logging
  console.log('🔍 Market data validation:', {
    originalMarketBookNo: selection.marketBookNo,
    originalMarketCode: selection.marketCode,
    finalMarketBookNo: marketBookNo,
    finalMarketCode: marketCode,
    hasValidMarketBookNo: !(!marketBookNo || marketBookNo === 'undefined' || marketBookNo === 'null' || marketBookNo.trim() === ''),
    hasValidMarketCode: !(!marketCode || marketCode === 'undefined' || marketCode === 'null' || marketCode.trim() === '')
  });
  
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

// Calculate Totelepep bonus based on the provided rules
const calculateTotelepepBonus = (selections: ParlaySelection[], potentialPayout: number, stake: number): number => {
  if (selections.length === 0) return 0;
  
  // Get all odds values
  const oddsValues = selections.map(selection => 
    typeof selection.odds === 'string' ? parseFloat(selection.odds) : selection.odds
  );
  
  // Check if at least one leg has odds below 1.20
  const hasLowOdds = oddsValues.some(odds => odds < 1.20);
  
  // Check if all legs have odds 1.20 or above
  const allHighOdds = oddsValues.every(odds => odds >= 1.20);
  
  let bonusPercentage = 0;
  
  if (hasLowOdds) {
    // Bonuses For Multiple Bets if at least One leg Odd is Below 1.20
    if (selections.length === 1) {
      bonusPercentage = 10; // Single Bet 10%
    } else if (selections.length >= 2 && selections.length <= 10) {
      bonusPercentage = 14; // 2-10 Legs 14%
    } else if (selections.length >= 11 && selections.length <= 15) {
      bonusPercentage = 15; // 11-15 Legs 15%
    } else if (selections.length >= 16 && selections.length <= 25) {
      bonusPercentage = 35; // 16-25 Legs 35%
    }
  } else if (allHighOdds) {
    // Exclusive Bonuses For Odds 1.20 Or Above For All Legs
    if (selections.length >= 3 && selections.length <= 5) {
      bonusPercentage = 15; // 3-5 Legs 15%
    } else if (selections.length === 6) {
      bonusPercentage = 20; // 6 Legs 20%
    } else if (selections.length === 7) {
      bonusPercentage = 25; // 7 Legs 25%
    } else if (selections.length === 8) {
      bonusPercentage = 30; // 8 Legs 30%
    } else if (selections.length === 9) {
      bonusPercentage = 35; // 9 Legs 35%
    } else if (selections.length === 10) {
      bonusPercentage = 40; // 10 Legs 40%
    } else if (selections.length === 11) {
      bonusPercentage = 45; // 11 Legs 45%
    } else if (selections.length === 12) {
      bonusPercentage = 50; // 12 Legs 50%
    } else if (selections.length === 13) {
      bonusPercentage = 55; // 13 Legs 55%
    } else if (selections.length === 14) {
      bonusPercentage = 60; // 14 Legs 60%
    } else if (selections.length === 15) {
      bonusPercentage = 65; // 15 Legs 65%
    } else if (selections.length >= 16 && selections.length <= 25) {
      bonusPercentage = 70; // 16-25 Legs 70%
    }
  }
  
  // Calculate bonus amount based on potential payout
  // Totelepep rounds to whole number first, then to 2 decimal places
  const bonusAmount = Math.round((potentialPayout * bonusPercentage) / 100);
  return bonusAmount;
};

export interface ParlaySelection {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  priceType: string;
  odds: number | string;
  league?: string;
  kickoff?: string;
  marketBookNo?: string;
  marketCode?: string;
  marketId?: string;  // Actual market ID from GetMatch API
  competitionId?: string;
  hasError?: boolean;  // Track if this selection has an error
}

interface ParlayBuilderProps {
  selections: ParlaySelection[];
  onRemoveSelection: (matchId: string) => void;
  onClearAll: () => void;
  onClose?: () => void;  // Optional close button handler
}

const ParlayBuilder: React.FC<ParlayBuilderProps> = ({
  selections,
  onRemoveSelection,
  onClearAll,
  onClose,
}) => {
  const [betAmount, setBetAmount] = useState<number>(50);
  const [isPlacing, setIsPlacing] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    message: string;
    ticketNo?: string;
    potentialPayout?: string;
    fullResponse?: any;
  } | null>(null);
  const [showNewBetButton, setShowNewBetButton] = useState(false);

  // Effect to show the "Place New Bet" button after a successful booking
  useEffect(() => {
    if (lastResult && lastResult.success) {
      // Small delay to ensure the success message is visible before showing the button
      const timer = setTimeout(() => {
        setShowNewBetButton(true);
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setShowNewBetButton(false);
    }
  }, [lastResult]);

  const totalOdds = selections.reduce((acc, selection) => {
    const odds = typeof selection.odds === 'string' ? 1 : selection.odds;
    return acc * odds;
  }, 1);
  
  // Use Totelepep's potential payout when available (from last result), otherwise use our calculation
  // Simulate Totelepep's tax and bonus system
  const potentialPayout = lastResult && lastResult.potentialPayout 
    ? parseFloat(lastResult.potentialPayout) 
    : (() => {
        // Calculate potential payout with tax applied to stake, not to payout
        // Use actual tax rate from Totelepep response: 6.14 tax for 50 stake = 12.28% tax rate
        const taxRate = 0.1228; // 12.28% tax rate based on actual Totelepep data
        const taxAmount = betAmount * taxRate;
        const netStake = betAmount - taxAmount;
        const netPayout = netStake * totalOdds;
        // Totelepep rounds to whole number first
        // Ensure proper rounding to match Totelepep's calculation
        return Math.round(netPayout);
      })();
      
  // Calculate bonus amount (for display only, not sent to API)
  const bonusAmount = calculateTotelepepBonus(selections, potentialPayout, betAmount);
  
  // Calculate final payout including bonus (for display only)
  const finalPayout = potentialPayout + bonusAmount;

  const handlePlaceBet = async () => {
    console.log('🎯 Place bet button clicked');
    console.log('📊 Current selections:', selections);
    console.log('💰 Bet amount:', betAmount);
    console.log('📈 Total odds:', totalOdds);
    
    // Clear previous errors before placing new bet
    selections.forEach(s => s.hasError = false);
    
    // Debug specific match data
    selections.forEach((selection, index) => {
      console.log(`🔍 Selection ${index} DEBUG DATA:`);
      console.log(`   Match: ${selection.homeTeam} vs ${selection.awayTeam}`);
      console.log(`   matchId:`, selection.matchId);
      console.log(`   marketBookNo:`, selection.marketBookNo);
      console.log(`   marketCode:`, selection.marketCode);
      console.log(`   competitionId:`, selection.competitionId);
      console.log(`   priceType:`, selection.priceType);
      console.log(`   odds:`, selection.odds);
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

    if (betAmount < 50) {
      setLastResult({
        success: false,
        message: 'Minimum stake is MUR 50'
      });
      return;
    }

    setIsPlacing(true);

    try {
      console.log('🚀 Attempting to place bet...');
      
      // Use real Totelepep booking API
      const bookingResult = await placeTotelepepBet(selections, betAmount);
      
      console.log('📄 Full Totelepep response:', bookingResult);
      console.log('📄 betList details:', JSON.stringify(bookingResult.betList, null, 2));
      console.log(' potentialPayout:', bookingResult.potentialPayout);
      
      // Enhanced success checking to handle cases where ticket is generated but errors are present
      const hasTicket = bookingResult.ticketNo && bookingResult.ticketNo.trim() !== '';
      const hasErrors = (bookingResult.errorMessage && bookingResult.errorMessage.trim() !== '' && bookingResult.errorMessage !== 'None') || 
                        (bookingResult.multiErrorMessage && bookingResult.multiErrorMessage.trim() !== '' && bookingResult.multiErrorMessage !== 'None');
            
      // Check betList for error codes
      const hasBetErrors = bookingResult.betList && bookingResult.betList.length > 0 && 
                           bookingResult.betList.some((bet: any) => bet.betErrorCode && bet.betErrorCode !== 0);
            
      console.log(' FRONTEND SUCCESS DETERMINATION:', {
        hasTicket: hasTicket,
        hasErrors: hasErrors,
        hasBetErrors: hasBetErrors,
        ticketNo: bookingResult.ticketNo,
        errorMessage: bookingResult.errorMessage,
        multiErrorMessage: bookingResult.multiErrorMessage,
        betListErrors: bookingResult.betList?.map((bet: any) => ({ betErrorCode: bet.betErrorCode, betErrorMessage: bet.betErrorMessage }))
      });
      
      // Consider successful ONLY if we have a ticket AND no bet errors
      if (hasTicket && !hasBetErrors && !hasErrors) {
        console.log('✅ Totelepep booking successful (has ticket, no errors):', bookingResult);
        
        setLastResult({
          success: true,
          message: 'Booking successful!',
          ticketNo: bookingResult.ticketNo,
          potentialPayout: bookingResult.potentialPayout,
          fullResponse: bookingResult
        });
        
        // Don't clear selections immediately - let user decide when to clear
        // Only reset the bet amount to default
        setBetAmount(50);
        setIsPlacing(false);
      } else if (bookingResult.success && !hasErrors) {
        console.log('✅ Totelepep booking successful (API reported success):', bookingResult);
        
        setLastResult({
          success: true,
          message: 'Booking successful!',
          ticketNo: bookingResult.ticketNo,
          potentialPayout: bookingResult.potentialPayout,
          fullResponse: bookingResult
        });
        
        // Don't clear selections immediately - let user decide when to clear
        // Only reset the bet amount to default
        setBetAmount(50);
        setIsPlacing(false);
      } else {
        console.error('❌ Totelepep booking failed:', bookingResult);
        const errorMessage = bookingResult.errorMessage || bookingResult.multiErrorMessage || 'Please try again';
        setLastResult({
          success: false,
          message: `Booking failed: ${errorMessage}`,
          fullResponse: bookingResult
        });
        
        // Mark all selections with errors if bet failed
        if (bookingResult.betList && bookingResult.betList.length > 0) {
          selections.forEach((selection, index) => {
            const bet = bookingResult.betList[index];
            if (bet && bet.betErrorCode && bet.betErrorCode !== 0) {
              selection.hasError = true;
            }
          });
        }
        
        setIsPlacing(false);
      }
      
    } catch (error) {
      console.error('❌ Error placing Totelepep bet:', error);
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
    <div className="bg-white rounded-lg shadow-md h-full flex flex-col">
      {/* Header - Sticky */}
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-800">Parlay Builder</h2>
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
              {selections.length} selection{selections.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClearAll}
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

      {/* Selections - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {selections.map((selection) => (
            <div
              key={selection.matchId}
              className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                selection.hasError 
                  ? 'bg-red-50 border-2 border-red-500' 
                  : 'bg-gray-50 border-2 border-transparent'
              }`}
          >
            <div className="flex-1">
              <div className="font-medium text-gray-800">
               <div className="text-sm text-gray-600">
                 {selection.priceType === 'home' ? selection.homeTeam : 
                 selection.priceType === 'draw' ? 'Draw' : 
                 selection.priceType === 'away' ? selection.awayTeam :
                 selection.priceType === 'over' ? 'Over 2.5' :
                 selection.priceType === 'under' ? 'Under 2.5' :
                 selection.priceType === 'btts_yes' ? 'Both Teams to Score - Yes' :
                 selection.priceType === 'btts_no' ? 'Both Teams to Score - No' :
                 selection.priceType}
               </div>
               <div className="text-xs text-gray-500">
                 {selection.league} • {selection.kickoff}
               </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-blue-600">
                {typeof selection.odds === 'string' ? selection.odds : selection.odds.toFixed(2)}
              </span>
              <button
                onClick={() => onRemoveSelection(selection.matchId)}
                className="text-red-500 hover:text-red-700 p-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-4">
        {/* Prominent Stake Input */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <label className="block text-lg font-bold text-gray-800 mb-3">
            💰 Enter Your Stake Amount
          </label>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600 font-medium">
                  MUR
                </span>
                <input
                  type="number"
                  min="50"
                  step="10"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Math.max(50, parseInt(e.target.value) || 50))}
                  className="w-full pl-16 pr-4 py-3 text-xl font-bold border-2 border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  placeholder="50"
                />
              </div>
              <p className="text-sm text-yellow-700 mt-2">Minimum stake: MUR 50</p>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-1">Total Odds</div>
              <div className="text-2xl font-bold text-blue-600 bg-white px-4 py-2 rounded-lg border">
                {totalOdds.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg mb-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-700">Potential Payout:</span>
            <span className="text-2xl font-bold text-blue-600">
              MUR {finalPayout.toFixed(2)}
            </span>
          </div>
          <div className="text-sm text-gray-600 mt-1">
            Stake: MUR {betAmount.toFixed(2)} × Odds: {totalOdds.toFixed(2)}
          </div>
          {/* Show tax and bonus information when using simulated calculation */}
          {!lastResult?.potentialPayout && (
            <div className="text-xs text-gray-500 mt-2">
              {(() => {
                const taxRate = 0.1228; // 12.28% tax rate based on actual Totelepep data
                const taxAmount = betAmount * taxRate;
                const netStake = betAmount - taxAmount;
                return (
                  <>
                    <div>Gross Stake: MUR {betAmount.toFixed(2)}</div>
                    <div>Tax (12.28%): -MUR {taxAmount.toFixed(2)}</div>
                    <div>Net Stake: MUR {netStake.toFixed(2)}</div>
                    <div>Net Payout: MUR {potentialPayout.toFixed(2)}</div>
                    {bonusAmount > 0 && (
                      <div className="mt-1">
                        <div className="text-green-600 font-medium">
                          Bonus ({bonusAmount > 0 ? (bonusAmount / potentialPayout * 100).toFixed(0) : '0'}%): +MUR {bonusAmount.toFixed(2)}
                        </div>
                        <div className="font-bold">
                          Final Payout: MUR {finalPayout.toFixed(2)}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
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

        {/* Booking Result Display - Betslip Style */}
        {lastResult && lastResult.success && lastResult.fullResponse && lastResult.fullResponse.betList && (
          <div className="mb-4 border-2 border-green-500 rounded-lg overflow-hidden bg-white">
            {/* Bet Selections */}
            <div className="max-h-60 overflow-y-auto">
              {lastResult.fullResponse.betList.map((bet: any, index: number) => {
                const selection = selections[index];
                return (
                  <div key={index} className="p-3 border-b border-gray-200 bg-yellow-50 last:border-b-0">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold">
                          {bet.optionOdd || selection?.odds}
                        </div>
                        <div className="text-sm font-semibold text-gray-800">
                          {selection?.homeTeam} vs {selection?.awayTeam}
                        </div>
                      </div>
                      <Trash2 className="w-4 h-4 text-gray-500 cursor-pointer hover:text-red-600" />
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      <div>{selection?.kickoff || 'Today'} {selection?.priceType === 'home' ? '1 X 2' : selection?.priceType === 'draw' ? '1 X 2' : selection?.priceType === 'away' ? '1 X 2' : selection?.priceType}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Booking Reference */}
            <div className="p-3 bg-green-500 text-white text-center">
              <div className="text-sm font-semibold">
                Booking Ref# {lastResult.ticketNo}
              </div>
            </div>

            {/* SMS Option */}
            <div className="p-3 bg-yellow-400 text-center border-t border-yellow-500">
              <div className="flex items-center justify-center gap-2 text-sm font-semibold text-gray-800">
                <span>📱</span>
                <span>SMS BET{lastResult.ticketNo}</span>
              </div>
            </div>

            {/* Stake and Potential Win */}
            <div className="flex border-t border-gray-200">
              <div className="flex-1 p-3 text-center border-r border-gray-200">
                <div className="text-xs text-gray-600">Win</div>
                <div className="text-lg font-bold text-gray-800">
                  {(() => {
                    // Get win amount from betList in API response
                    if (lastResult?.fullResponse?.betList && lastResult.fullResponse.betList.length > 0) {
                      const firstBet = lastResult.fullResponse.betList[0];
                      // Use potentialPayout from betList (this is the correct value from totelepep API)
                      if (firstBet.potentialPayout) {
                        return firstBet.potentialPayout;
                      }
                    }
                    // Fallback to potentialPayout from top-level API response
                    if (lastResult?.fullResponse?.potentialPayout) {
                      return lastResult.fullResponse.potentialPayout;
                    }
                    // Last fallback to calculated value
                    return potentialPayout.toFixed(2);
                  })()}
                </div>
              </div>
              <div className="flex-1 p-3 text-center bg-gray-50">
                <div className="text-xs text-gray-600">Stake</div>
                <div className="text-lg font-bold text-gray-800">{parseInt(String(betAmount))}</div>
              </div>
            </div>

            {/* Place New Bet Button */}
            {showNewBetButton && (
              <div className="p-3 border-t border-gray-200">
                <button
                  onClick={onClearAll}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                >
                  Place New Bet
                </button>
              </div>
            )}
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
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          {isPlacing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              Placing Bet...
            </>
          ) : (
            <>
              <DollarSign className="w-5 h-5" />
              Place Parlay Bet
            </>
          )}
        </button>
        </div>
      </div>
    </div>
  );
};

export default ParlayBuilder;