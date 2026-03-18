# Project: CourtMastr v2

## Mission
"Run Every Rally."
Provide a professional, real-time, and resilient tournament management system specifically for badminton, enabling organizers to generate brackets in seconds and provide live scores to spectators worldwide on any device.

## Success Criteria
- [ ] Bracket generation takes < 30 seconds for any tournament size.
- [ ] Live score updates reflect across all public views in < 2 seconds.
- [ ] System remains fully operational for scoring even during temporary internet outages.
- [ ] High positive feedback from tournament organizers on ease of use.
- [ ] 100% test coverage for critical scoring and bracket generation logic.

## Stakeholders
- **Tournament Organizers**: Primary users managing the event lifecycle.
- **Scorekeepers/Volunteers**: On-court users recording match data.
- **Players & Spectators**: Consumers of real-time brackets and scores.
- **Marvy Technologies**: The development team/brand owner.

## Tech Strategy
- **Offline-First PWA**: Use Firestore persistent cache and Service Workers to ensure venue resilience.
- **Real-Time Core**: Leverage Firestore listeners for instant updates without manual refreshes.
- **Modular Features**: Scale the app by isolating domain logic into feature folders.
- **Agent-First Design**: Maintain high-quality documentation and patterns for AI collaboration.
