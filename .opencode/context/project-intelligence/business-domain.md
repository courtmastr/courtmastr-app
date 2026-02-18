<!-- Context: project-intelligence/business | Priority: high | Version: 1.1 | Updated: 2026-02-17 -->

# Business Domain

> CourtMaster v2: Modern tournament management for badminton competitions

## Quick Reference

- **Purpose**: Enable efficient badminton tournament organization with real-time scoring
- **Problem**: Manual tournament management is error-prone, time-consuming, and lacks real-time visibility
- **Solution**: Web-based platform with mobile scoring, automated brackets, and live updates
- **Update**: New features, user feedback, business direction changes

## Project Identity

```
Project Name: CourtMaster v2
Tagline: A modern tournament management system for badminton tournaments
Problem Statement: Tournament organizers struggle with manual bracket management, paper score sheets, delayed results, and poor visibility for players and spectators
Solution: Complete web-based platform providing automated bracket generation, mobile-optimized scoring, real-time updates, and public live brackets
```

## Target Users

| User Segment | Who They Are | What They Need | Pain Points |
|--------------|--------------|----------------|-------------|
| **Admins** | Tournament organizers with full access | Create tournaments, manage registrations, generate brackets, assign courts | Manual bracket creation takes hours; tracking registrations across spreadsheets; no real-time updates |
| **Scorekeepers** | Designated match scorers | Quick, mobile-friendly scoring interface; see assigned matches; track scores accurately | Paper score sheets get lost; mental math errors; no visibility into match queue |
| **Players** | Tournament participants | Easy registration, view brackets/schedules, check results, know when/where to play | Don't know match times; can't see draw until posted; results delayed hours |
| **Viewers** | Spectators, coaches, parents | Follow tournament progress, see live scores, view brackets without login | No way to follow remotely; brackets only visible on-site; results outdated |
| **Organizers** | Tournament staff | Assist with operations, view tournament status, manage day-of logistics | Limited visibility into tournament state; communication gaps between staff |

## Value Proposition

**For Tournament Organizers:**
- **Time Savings**: Automated bracket generation saves hours of manual work
- **Reduced Errors**: Digital scoring eliminates transcription mistakes
- **Real-Time Visibility**: Instant updates visible to all stakeholders
- **Professional Experience**: Modern interface impresses players and sponsors
- **Multi-Court Management**: Efficiently coordinate simultaneous matches

**For Players:**
- **Self-Service Registration**: Register online without paperwork
- **Live Brackets**: See draw immediately upon generation
- **Real-Time Results**: Know winners as matches complete
- **Mobile Access**: Check schedules and results from phone
- **Clear Communication**: Know exactly when and where to play

**For Scorekeepers:**
- **Mobile-Optimized UI**: Large touch-friendly buttons work on tablets/phones
- **Automatic Scoring Rules**: System enforces badminton rules (21-point games, win by 2, max 30)
- **Queue Visibility**: See upcoming matches and court assignments
- **No Math Errors**: System tracks games and match completion automatically

**For Viewers:**
- **Public Brackets**: Shareable URLs for remote viewing
- **Live Score Feed**: Follow matches in real-time without being there
- **Tournament Progress**: See which rounds are complete, what's next

## Success Metrics

| Metric | Definition | Target | Current |
|--------|------------|--------|---------|
| **Bracket Generation Time** | Time from registration close to published brackets | < 5 minutes | Manual: 2-4 hours |
| **Score Update Latency** | Time from point scored to visible update | < 2 seconds | Paper: 5-15 min |
| **Registration Completion** | % of started registrations successfully completed | > 85% | N/A |
| **User Satisfaction** | Post-tournament organizer rating (1-5) | > 4.0 | N/A |
| **System Uptime** | % of tournament time system available | > 99.5% | N/A |

## Business Model

```
Revenue Model: SaaS subscription + per-tournament fees (future consideration)
Current Model: Open source / Free to use
Pricing Strategy: 
  - Core features free (tournament creation, brackets, scoring)
  - Premium features TBD (advanced analytics, custom branding, priority support)
Target Market: Badminton clubs, tournament organizers, sports facilities
Market Position: Modern, mobile-first alternative to legacy tournament software
```

## Key Stakeholders

| Role | Name | Responsibility | Contact |
|------|------|----------------|---------|
| Product Owner | [To be assigned] | Feature prioritization, user feedback, roadmap | - |
| Tech Lead | [To be assigned] | Architecture decisions, technical standards | - |
| Tournament Advisor | [To be assigned] | Domain expertise, badminton rules validation | - |

## Roadmap Context

**Current Focus**: Core tournament lifecycle (create → register → bracket → score → complete)

**Implemented ✅**:
- Tournament and category management
- Player registration and approval
- Single/double elimination bracket generation
- Mobile-optimized scoring interface
- Real-time bracket updates
- Court management and assignment

**Next Milestone** (High Priority):
- Player check-in system with QR codes
- Score correction with audit trail
- User management dashboard
- Reporting and analytics

**Long-term Vision**:
- Multi-sport support (beyond badminton)
- Payment integration
- Live streaming integration
- Mobile native apps
- AI-powered match scheduling optimization

## Business Constraints

- **Offline Requirement**: Venues may have poor connectivity → PWA offline support critical
- **Real-Time Expectations**: Users expect instant updates → Firestore real-time sync
- **Mobile-First**: Scorekeepers use tablets/phones → Touch-optimized UI required
- **Badminton-Specific**: Must support specific rules (21-point games, win by 2, max 30)
- **Multi-Device**: Admin on desktop, scorekeeper on tablet, player on phone → Responsive design

## Onboarding Checklist

- [ ] Understand CourtMaster solves tournament organization inefficiencies
- [ ] Know the 5 user types and their distinct needs
- [ ] Understand value proposition for organizers (time savings, reduced errors)
- [ ] Know key success metrics (bracket generation time, score latency)
- [ ] Understand current business model (open source) and future considerations
- [ ] Know roadmap priorities (check-in, score correction, analytics)
- [ ] Understand constraints (offline, real-time, mobile-first)

## 📂 Codebase References

**Documentation**:
- `docs/PRD.md` - Full product requirements
- `docs/TDD.md` - Technical design document
- `docs/features/` - Feature specifications (check-in, analytics, etc.)

**Related Files**:
- `technical-domain.md` - How business needs map to Vue 3 + Firebase implementation
- `business-tech-bridge.md` - Feature-by-feature business→technical mapping
- `decisions-log.md` - Architectural decisions affecting business capabilities
