# Advanced Search Filters Guide

This guide covers all advanced search filter syntax and how to use them effectively in the football betting app.

## Table of Contents
- [Basic Search](#basic-search)
- [Comparison Operators](#comparison-operators)
- [Range Filters](#range-filters)
- [Market Type Filters](#market-type-filters)
- [Period Filters](#period-filters)
- [Combined Filters](#combined-filters)
- [Examples](#examples)

---

## Basic Search

### Team Names
Search for matches by team name:
```
Arsenal
Manchester United
Barcelona
```

### Competition Names
Search by league or competition:
```
Premier League
Champions League
Veikkausliiga
```

---

## Comparison Operators

### Equal To (`=`)
Find exact matches for odds values:

**Syntax:** `=value`

**Examples:**
```
=1.50        → Find odds exactly equal to 1.50
=2.0         → Find odds exactly equal to 2.0
```

### Greater Than (`>`)
Find odds higher than specified value:

**Syntax:** `>value`

**Examples:**
```
>1.80        → Find odds greater than 1.80
>2.5         → Find odds greater than 2.5
```

### Less Than (`<`)
Find odds lower than specified value:

**Syntax:** `<value`

**Examples:**
```
<1.50        → Find odds less than 1.50
<3.0         → Find odds less than 3.0
```

### Greater Than or Equal (`>=`)
**Syntax:** `>=value`

**Examples:**
```
>=2.0        → Find odds 2.0 or higher
```

### Less Than or Equal (`<=`)
**Syntax:** `<=value`

**Examples:**
```
<=1.75       → Find odds 1.75 or lower
```

---

## Range Filters

### "In Between" Range
Find odds within a specific range:

**Syntax:** `min-max` or `min to max`

**Examples:**
```
1.50-2.00    → Find odds between 1.50 and 2.00
1.8-2.5      → Find odds between 1.8 and 2.5
2 to 3       → Find odds between 2 and 3
```

**Important Notes:**
- The range is **inclusive** (includes both min and max values)
- Use a hyphen `-` or the word `to` to separate values
- Both numbers must be valid decimal odds (typically 1.01+)

---

## Market Type Filters

### Supported Market Types

The app supports intelligent parsing of various market types:

| Market Code | Market Name | Description |
|------------|-------------|-------------|
| `1X2` | 1 X 2 | Match Result (Home/Draw/Away) |
| `H2H` | Head to Head | Same as 1X2 |
| `BTTS` | Both Teams To Score | Yes/No |
| `FTTS` | Full Time To Score | Both teams score in full time |
| `LTTS` | Half Time To Score | Both teams score in first half |
| `OU` | Over/Under | Total goals over/under line |
| `AH` | Asian Handicap | Handicap betting |
| `HTFT` | Half Time/Full Time | Double result |
| `HSH` | Half Score Home | Half time home score |

### Filter by Market Type

**Syntax:** Type the market name or code

**Examples:**
```
1X2          → Show only 1X2 markets
BTTS         → Show only Both Teams To Score markets
Over Under   → Show Over/Under markets
Asian Handicap → Show Asian Handicap markets
```

### Market Position Detection

For 1X2 markets, you can filter by position:
- **Home (1)**: Left position
- **Draw (X)**: Middle position  
- **Away (2)**: Right position

---

## Period Filters

### Supported Periods

| Period Code | Description |
|------------|-------------|
| `FT` | Full Time (default) |
| `H1` | First Half |
| `2H` | Second Half |
| `HT` | Half Time (same as H1) |

### Filter by Period

**Syntax:** Add period code to your search

**Examples:**
```
FT           → Full Time markets
H1           → First Half markets
2H           → Second Half markets
```

### Period with Market Type

Combine period with market type:
```
FT 1X2       → Full Time 1X2 markets
H1 BTTS      → First Half BTTS markets
2H Over Under → Second Half Over/Under markets
```

---

## Combined Filters

You can combine multiple filters in a single search query:

### Odds + Market Type
```
>1.80 1X2              → 1X2 markets with odds > 1.80
1.50-2.50 BTTS         → BTTS markets with odds between 1.50-2.50
<2.0 Over Under        → Over/Under markets with odds < 2.0
```

### Market Type + Period
```
1X2 H1                 → First Half 1X2 markets
BTTS FT                → Full Time BTTS markets
Over Under 2H          → Second Half Over/Under markets
```

### All Combined
```
>1.90 1X2 FT           → Full Time 1X2 with odds > 1.90
1.50-2.00 BTTS H1      → First Half BTTS with odds 1.50-2.00
<2.5 Over Under 2H     → Second Half O/U with odds < 2.5
```

---

## Examples

### Example 1: Find High Odds for Home Teams
```
>2.0 1X2
```
**Result:** Shows all 1X2 markets where odds are greater than 2.0

### Example 2: Find Safe Bets (Low Odds)
```
<1.50
```
**Result:** Shows all markets with odds less than 1.50

### Example 3: Find Medium Risk Bets
```
1.80-2.20
```
**Result:** Shows all markets with odds between 1.80 and 2.20

### Example 4: First Half Goals
```
H1 BTTS
```
**Result:** Shows only First Half Both Teams To Score markets

### Example 5: Second Half Over/Under
```
2H Over Under >1.90
```
**Result:** Shows Second Half Over/Under markets with odds greater than 1.90

### Example 6: Exact Odds
```
=2.00 1X2 FT
```
**Result:** Shows Full Time 1X2 markets with exactly 2.00 odds

---

## Advanced Features

### Auto-Expand Markets

When you use filters, matching markets will automatically expand to show the filtered options. This helps you quickly find the bets you're looking for.

### Highlighting

Filtered matches are highlighted in the UI:
- **Orange background**: Matching odds/buttons
- **Expanded view**: Shows all relevant markets
- **Count badge**: Shows number of matching selections

### Search Mode Detection

The app automatically detects your search intent:
- **Text search**: Team names, competitions, market types
- **Numeric search**: Odds values and ranges
- **Mixed search**: Combination of text and numbers

### Period Tab Switching

When you switch between period tabs (FT, H1, 2H):
- Filters remain active
- Markets auto-expand based on your search
- Results update in real-time

---

## Tips & Best Practices

### 1. Be Specific
```
Good:  >1.80 1X2 FT
Better: >1.80 1X2 FT Arsenal
```

### 2. Use Ranges for Flexibility
```
Instead of: =2.00
Use: 1.90-2.10
```

### 3. Combine Filters Effectively
```
Team + Market + Odds: Arsenal 1X2 >1.80
Period + Market + Range: H1 BTTS 1.50-2.00
```

### 4. Clear Filters
To clear all filters and show all markets:
- Delete the search text
- Or click the clear button (X)

### 5. Use Market Codes for Speed
```
1X2    → Faster than "1 X 2"
BTTS   → Faster than "Both Teams To Score"
OU     → Faster than "Over Under"
```

---

## Troubleshooting

### No Results Found?
- Check your filter syntax
- Ensure odds values are valid (typically 1.01+)
- Try broadening your range
- Verify the market type exists for selected matches

### Filter Not Working?
- Make sure there's a space between different filter types
- Use decimal points (not commas): `1.50` not `1,50`
- Check that the period code is correct (FT, H1, 2H)

### Markets Not Expanding?
- Ensure your filter matches actual market data
- Check if the market type exists for the match
- Try refreshing the data

---

## Quick Reference Card

| Filter | Syntax | Example |
|--------|--------|---------|
| Equal | `=value` | `=2.00` |
| Greater Than | `>value` | `>1.80` |
| Less Than | `<value` | `<2.50` |
| Range | `min-max` | `1.50-2.00` |
| Market Type | `name` | `1X2`, `BTTS` |
| Period | `code` | `FT`, `H1`, `2H` |
| Combined | `mix` | `>1.80 1X2 FT` |

---

## Support

For more help or to report issues with the search functionality, please check the app's documentation or contact support.
