# CourtMaster Documentation

## Overview
This directory contains design documents, technical specifications, and other documentation for the CourtMaster tournament management system.

## Documentation Index

### UI/UX Design Documents
- [Comprehensive UI Improvements](./ui-improvements-comprehensive.md) - Complete overview of all UI/UX improvements for the application
- [Navigation & Information Architecture](./navigation-information-architecture-improvements.md) - Detailed design for navigation and information architecture improvements
- [Match Control UI Improvements](./match-control-ui-improvements.md) - Detailed design document for Match Control interface enhancements
- [Apple-Inspired UI Redesign Plan](./apple-inspired-ui-redesign-plan.md) - Comprehensive plan for transforming the UI with Apple-inspired design principles

### Technical Specifications
- [Data Model Migration Rules](./migration/DATA_MODEL_MIGRATION_RULES.md) - Rules for data model transitions
- [Debug Knowledge Base](./debug-kb/index.yml) - Error resolution and troubleshooting

### Feature Specifications
- [User Management Dashboard](./features/USER_MANAGEMENT_DASHBOARD.md) - Complete specification for user administration interface (CRITICAL - Not Implemented)
- [Reporting & Analytics](./features/REPORTING_ANALYTICS.md) - Comprehensive reporting system with dashboards, charts, and exports (HIGH PRIORITY - Not Implemented)
- [Player Check-in](./features/PLAYER_CHECK_IN.md) - Tournament day check-in system with self-service and QR codes (HIGH PRIORITY - Partially Implemented)
- [Score Correction](./features/SCORE_CORRECTION.md) - Post-match score editing with audit trail (HIGH PRIORITY - Partially Implemented)

### System Architecture
- [Feature Modules Guide](../src/features/AGENTS.md) - Architecture documentation for feature-based organization
- [Project Contract](../AGENTS.md) - System-wide rules and conventions

## Creating New Documentation
When adding new documentation:
1. Place UI/UX design documents in the root docs/ directory
2. Add technical specifications in appropriate subdirectories
3. Update this README to include new documents
4. Follow the established markdown format for consistency