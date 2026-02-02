# Bracket Fixes Notepad

## Debug Notes

### Bracket Viewer Issue
Looking at BracketsManagerViewer.vue lines 246-248:
```javascript
const winnersMatches = matches.value.filter(m => m.bracket === 'winners')
const losersMatches = matches.value.filter(m => m.bracket === 'losers')  
const grandFinalsMatches = matches.value.filter(m => m.bracket === 'finals')
```

But brackets-viewer.js expects:
- `group_id` to identify bracket (winners=0, losers=1, finals=2)
- `round_id` to identify round

Our optimized schema has:
- `bracket: 'winners' | 'losers' | 'finals'`
- `round: number`

Need to map these back for the library.

### ID System
- brackets-manager uses sequential IDs (1,2,3...) for participants
- We store these in `opponent.id`
- We store actual registration IDs in `opponent.registrationId`
- Winner advancement uses `opponent.id` (sequential)

### Cloud Function
File: `functions/src/updateMatch.ts`
- Called when match is completed
- Should update next match with winner's ID
- Need to check if it's using correct ID field
