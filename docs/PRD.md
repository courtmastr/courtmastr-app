# CourtMastr v2 - Product Requirements Document

## Overview

CourtMastr v2 is a modern web-based tournament management system designed specifically for badminton tournaments. It provides a complete platform for organizing, running, and scoring competitive tournaments with real-time bracket visualization and mobile-optimized scoring interfaces.

The system enables tournament organizers to manage the full lifecycle of a tournament - from creation and player registration through bracket generation, live scoring, and results tracking - all with real-time updates visible to participants and spectators.

## Target Users

### User Roles

| Role | Description | Primary Use Cases |
|------|-------------|-------------------|
| **Admin** | Tournament organizers with full system access | Create tournaments, manage settings, approve registrations, assign courts, generate brackets |
| **Organizer** | Staff with tournament management permissions | View tournament details, assist with operations |
| **Scorekeeper** | Designated scorers for matches | Score matches in real-time using mobile interface |
| **Player** | Tournament participants | Register for tournaments, view brackets and schedules, check results |
| **Viewer** | Public spectators | View live brackets, scores, and tournament progress |

## Core Features

### 1. Tournament Management

Tournament organizers can create and configure badminton tournaments with flexible settings.

**Capabilities:**
- Create tournaments with name, description, dates, and location
- Configure tournament format (Single Elimination, Double Elimination, Round Robin)
- Set tournament status workflow: Draft -> Registration -> Active -> Completed
- Define scoring rules and rest time constraints between matches
- Manage multiple courts for simultaneous matches

**Tournament Settings:**
- Match duration estimates
- Rest time between matches for players
- Scoring configuration (points per game, games per match)
- Registration open/close dates

### 2. Categories

Tournaments support multiple categories to organize competition by skill level, age, and gender.

**Category Types:**
- Men's Singles / Women's Singles
- Men's Doubles / Women's Doubles
- Mixed Doubles

**Age Groups:**
- Open (no age restriction)
- Junior: U10, U12, U14, U16, U18, U21
- Senior: 35+, 45+, 55+

**Category Configuration:**
- Tournament format per category
- Maximum participants
- Seeding method
- Independent bracket generation

### 3. Player Registration

Self-service registration system for players with admin oversight.

**Player Features:**
- Browse open tournaments
- Register for one or more categories
- Register as singles player or doubles pair
- View registration status and payment requirements

**Admin Features:**
- Approve/reject registrations
- Bulk import players
- Track payment status (Unpaid, Paid, Partial, Refunded)
- Manage check-in on tournament day
- Assign seeding to players

**Registration Workflow:**
1. Player submits registration
2. Admin reviews and approves
3. Player completes payment (tracked externally)
4. Admin marks as paid
5. Player checks in on tournament day

### 4. Bracket Generation

Automated bracket creation using professional-grade tournament algorithms.

**Supported Formats:**
- **Single Elimination**: Standard knockout format
- **Double Elimination**: Includes losers bracket for second chances
- **Round Robin**: All participants play each other in group stage

**Bracket Features:**
- Smart seeding algorithm respecting seed positions
- Automatic bye assignment for incomplete brackets
- Winner advancement handled automatically
- Visual bracket display with real-time updates

### 5. Real-Time Scoring

Mobile-optimized scoring interface for live match updates.

**Scorekeeper Interface:**
- Large touch-friendly score buttons
- Game-by-game score tracking
- Automatic rule enforcement (badminton scoring rules)
- Match completion detection

**Badminton Scoring Rules:**
- Games played to 21 points
- Must win by 2 points
- Maximum 30 points (at 29-29, first to 30 wins)
- Best of 3 games per match

**Match Status Flow:**
1. Scheduled - Match created in bracket
2. Ready - Players and court assigned
3. In Progress - Scoring active
4. Completed - Winner determined, bracket updated

### 6. Court Management

Manage physical courts for match assignments.

**Features:**
- Define available courts with names/numbers
- Track court status: Available, In Use, Maintenance
- Assign matches to specific courts
- View court utilization

### 7. Public Views

Read-only interfaces for spectators and participants.

**Live Bracket View:**
- Real-time bracket visualization
- Shows match results as they complete
- No authentication required
- Accessible via shareable tournament URL

**Live Scores Feed:**
- Current match scores updating in real-time
- Recent completed matches
- Upcoming scheduled matches

**Public Scoring Interface:**
- Allows volunteers to submit scores
- Simplified interface for quick entry

## Key User Flows

### Tournament Organizer Flow

1. **Create Tournament**
   - Navigate to tournament creation
   - Enter tournament details and dates
   - Configure settings and rules
   - Save as draft

2. **Set Up Categories**
   - Add competition categories
   - Configure format and limits for each
   - Open registration

3. **Manage Registration**
   - Review incoming registrations
   - Approve qualified players
   - Track payments
   - Handle check-in

4. **Run Tournament**
   - Generate brackets when registration closes
   - Assign courts to matches
   - Monitor progress via dashboard
   - Handle any issues

### Scorekeeper Flow

1. **Access Tournament**
   - Log in with scorekeeper credentials
   - Navigate to assigned tournament
   - View match list

2. **Score a Match**
   - Select match to score
   - Tap to add points for each player/team
   - System tracks games automatically
   - Match auto-completes when winner determined

3. **Between Matches**
   - View next assigned match
   - Wait for court assignment
   - Continue scoring

### Player Flow

1. **Find Tournament**
   - Browse available tournaments
   - View tournament details and categories

2. **Register**
   - Select category to enter
   - For doubles: add partner information
   - Submit registration
   - Complete payment (external)

3. **Tournament Day**
   - Check in at venue
   - View bracket for match times
   - Monitor live scores
   - Check results

### Spectator Flow

1. **Access Tournament**
   - Open public tournament URL
   - No login required

2. **Follow Progress**
   - View live bracket
   - Watch scores update in real-time
   - Check upcoming matches

## Constraints and Dependencies

### Technical Requirements
- Modern web browser with JavaScript enabled
- Internet connection for real-time updates
- Mobile device recommended for scoring interface

### Business Rules
- One tournament can have multiple categories
- Players can register for multiple categories in same tournament
- Matches cannot start until bracket is generated
- Bracket cannot be regenerated once matches have started
- Scorekeepers can only score matches in tournaments they have access to

### External Dependencies
- Firebase services (database, authentication, hosting)
- brackets-manager library for bracket algorithms

## Success Metrics

- Tournament setup time under 15 minutes
- Score entry under 5 seconds per point
- Real-time updates visible within 1 second
- Public bracket accessible without authentication
- Mobile scoring interface usable on phones
