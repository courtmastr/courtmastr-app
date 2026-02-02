# Courtmaster Architecture Diagrams

This file contains all the Mermaid diagrams for the Courtmaster data model architecture.
You can render these diagrams using:
- VS Code with Mermaid extension
- GitHub (renders automatically in markdown)
- https://mermaid.live/ (online editor)

---

## 1. Current State - Data Flow Architecture

Shows the current broken state with data flow issues highlighted.

```mermaid
flowchart TB
    subgraph Client["CLIENT SIDE"]
        direction TB
        BG["useBracketGenerator.ts<br/>🔶 Uses NUMERIC IDs"]
        MS["useMatchScheduler.ts"]
        Store["matches.ts store"]
        Adapter["bracketMatchAdapter.ts"]
    end

    subgraph CloudFunctions["CLOUD FUNCTIONS"]
        direction TB
        GenBracket["generateBracket<br/>🔶 Uses STRING IDs"]
        GenSchedule["generateSchedule<br/>🔴 USES WRONG COLLECTION"]
        UpdateMatch["updateMatch"]
        AdvanceWinner["advanceWinner<br/>🔴 USES WRONG COLLECTION"]
    end

    subgraph Firestore["FIRESTORE: /tournaments/{id}/"]
        direction TB

        subgraph BracketsManager["Brackets-Manager Schema"]
            Stage["/stage"]
            Group["/group"]
            Round["/round"]
            Match["/match<br/>✅ PRIMARY"]
            MatchGame["/match_game"]
            Participant["/participant"]
        end

        subgraph Custom["Custom/Operational Schema"]
            MatchScores["/match_scores<br/>✅ KEEP"]
            Registrations["/registrations"]
            Categories["/categories"]
            Courts["/courts"]
            Players["/players"]
        end

        subgraph Legacy["LEGACY - TO BE REMOVED"]
            Matches["/matches<br/>🔴 REMOVE"]
        end
    end

    %% Client Bracket Generator
    BG -->|"WRITE (numeric IDs)"| Stage
    BG -->|"WRITE"| Group
    BG -->|"WRITE"| Round
    BG -->|"WRITE"| Match
    BG -->|"WRITE"| MatchGame
    BG -->|"WRITE"| Participant
    BG -->|"READ"| Registrations
    BG -->|"READ"| Categories

    %% Cloud Function Bracket Generator
    GenBracket -->|"WRITE (string IDs)"| Stage
    GenBracket -->|"WRITE"| Group
    GenBracket -->|"WRITE"| Round
    GenBracket -->|"WRITE"| Match
    GenBracket -->|"WRITE"| MatchGame
    GenBracket -->|"WRITE"| Participant

    %% Client Scheduler - CORRECT
    MS -->|"READ"| Match
    MS -->|"READ"| Courts
    MS -->|"WRITE"| MatchScores

    %% Cloud Function Scheduler - WRONG!
    GenSchedule -->|"READ ❌"| Matches
    GenSchedule -->|"WRITE ❌"| Matches

    %% Match Store
    Store -->|"READ"| Match
    Store -->|"READ"| MatchScores
    Store -->|"READ"| Registrations
    Store -->|"WRITE"| MatchScores
    Store -->|"WRITE"| Courts

    %% Update Match CF - CORRECT
    UpdateMatch -->|"READ"| Match
    UpdateMatch -->|"WRITE"| Match
    UpdateMatch -->|"WRITE"| MatchScores

    %% Advance Winner CF - WRONG!
    AdvanceWinner -->|"READ ❌"| Matches
    AdvanceWinner -->|"WRITE ❌"| Matches

    %% Adapter
    Adapter -->|"READ"| Match
    Adapter -->|"READ"| Registrations

    %% Styling
    style Matches fill:#ff6b6b,stroke:#c92a2a,color:#fff
    style GenSchedule fill:#ffa94d,stroke:#e67700,color:#000
    style AdvanceWinner fill:#ffa94d,stroke:#e67700,color:#000
    style BG fill:#ffe066,stroke:#fab005,color:#000
    style GenBracket fill:#ffe066,stroke:#fab005,color:#000
    style Match fill:#51cf66,stroke:#2f9e44,color:#000
    style MatchScores fill:#51cf66,stroke:#2f9e44,color:#000
```

---

## 2. Data Model Inconsistencies Map

Shows the specific conflicts between the three match collections.

```mermaid
flowchart TB
    subgraph ThreeCollections["THE THREE MATCH COLLECTIONS PROBLEM"]
        direction LR

        subgraph MatchCol["/match (brackets-manager)"]
            M1["status: NUMBER<br/>0=Locked, 1=Waiting<br/>2=Ready, 3=Running<br/>4=Completed"]
            M2["opponent1: {id, result}<br/>opponent2: {id, result}"]
            M3["stage_id, round_id, group_id"]
        end

        subgraph ScoresCol["/match_scores (custom)"]
            S1["status: STRING<br/>'scheduled', 'ready'<br/>'in_progress', 'completed'"]
            S2["scores: GameScore[]<br/>courtId, scheduledTime"]
            S3["winnerId (registration ID)"]
        end

        subgraph LegacyCol["/matches (LEGACY)"]
            L1["status: STRING<br/>(same as match_scores)"]
            L2["participant1Id, participant2Id<br/>nextMatchId, nextMatchSlot"]
            L3["courtId, scheduledTime"]
        end
    end

    subgraph Writers["WHO WRITES WHERE"]
        W1["useBracketGenerator"] -->|"WRITES"| MatchCol
        W2["generateBracket CF"] -->|"WRITES"| MatchCol
        W3["matches.ts store"] -->|"WRITES"| ScoresCol
        W4["useMatchScheduler"] -->|"WRITES"| ScoresCol
        W5["generateSchedule CF"] -->|"WRITES ❌"| LegacyCol
        W6["advanceWinner CF"] -->|"WRITES ❌"| LegacyCol
    end

    subgraph IDProblem["ID TYPE MISMATCH"]
        direction TB
        ClientAdapter["ClientFirestoreStorage<br/>IDs as NUMBERS<br/>id: 1, stage_id: 0"]
        ServerAdapter["FirestoreStorage<br/>IDs as STRINGS<br/>id: '1', stage_id: '0'"]

        ClientAdapter -.->|"CONFLICT!"| ServerAdapter
    end

    style LegacyCol fill:#ff6b6b,stroke:#c92a2a
    style W5 fill:#ff6b6b,stroke:#c92a2a,color:#fff
    style W6 fill:#ff6b6b,stroke:#c92a2a,color:#fff
    style ClientAdapter fill:#ffa94d,stroke:#e67700
    style ServerAdapter fill:#ffa94d,stroke:#e67700
```

---

## 3. Target State - Unified Architecture

Shows the clean target architecture after migration.

```mermaid
flowchart TB
    subgraph Services["UNIFIED SERVICES (Client + Cloud)"]
        direction TB
        BracketSvc["BracketService<br/>✅ Single implementation<br/>✅ STRING IDs everywhere"]
        ScheduleSvc["SchedulingService<br/>✅ Unified client/server"]
        ScoringSvc["ScoringService<br/>✅ Single source of truth"]
        RegSvc["RegistrationService"]
    end

    subgraph Firestore["FIRESTORE: /tournaments/{id}/"]
        direction TB

        subgraph BracketStructure["BRACKET STRUCTURE<br/>(Write Once, Read Many)"]
            Stage["/stage"]
            Group["/group"]
            Round["/round"]
            Match["/match<br/>Bracket positions &<br/>progression links"]
            MatchGame["/match_game"]
            Participant["/participant"]
        end

        subgraph Operational["OPERATIONAL DATA<br/>(Frequent Updates)"]
            MatchScores["/match_scores<br/>• scores[]<br/>• status (string)<br/>• courtId<br/>• scheduledTime<br/>• winnerId"]
            Registrations["/registrations"]
            Courts["/courts"]
            Categories["/categories"]
            Players["/players"]
        end
    end

    subgraph Removed["REMOVED"]
        Matches["/matches<br/>❌ DELETED"]
    end

    %% Bracket Service
    BracketSvc -->|"WRITE"| Stage & Group & Round & Match & MatchGame & Participant
    BracketSvc -->|"READ"| Registrations & Categories

    %% Scheduling Service
    ScheduleSvc -->|"READ"| Match
    ScheduleSvc -->|"READ"| Courts
    ScheduleSvc -->|"WRITE"| MatchScores

    %% Scoring Service
    ScoringSvc -->|"READ"| Match
    ScoringSvc -->|"READ"| MatchScores
    ScoringSvc -->|"WRITE"| MatchScores
    ScoringSvc -.->|"Triggers bracket<br/>progression"| BracketSvc

    %% Registration Service
    RegSvc -->|"READ/WRITE"| Registrations & Players

    %% Styling
    style Match fill:#51cf66,stroke:#2f9e44,color:#000
    style MatchScores fill:#51cf66,stroke:#2f9e44,color:#000
    style Matches fill:#868e96,stroke:#495057,color:#fff
    style BracketSvc fill:#339af0,stroke:#1c7ed6,color:#fff
    style ScheduleSvc fill:#339af0,stroke:#1c7ed6,color:#fff
    style ScoringSvc fill:#339af0,stroke:#1c7ed6,color:#fff
```

---

## 4. Migration Path - Accelerated Timeline (No Data!)

**IMPORTANT: Since there's no production data, the timeline is ~1 week, not 6 weeks!**

```mermaid
flowchart TB
    subgraph Phase1["PHASE 1: CRITICAL FIXES - Days 1-3"]
        direction TB
        P1A["1.1: Unify ID Types<br/>2 hours"]
        P1B["1.2: Fix advanceWinner CF<br/>4 hours"]
        P1C["1.3: Fix generateSchedule CF<br/>4 hours"]
        P1D["1.4: Delete /matches rules<br/>30 min - NO DATA!"]

        P1A --> P1B --> P1C --> P1D
    end

    subgraph Phase2["PHASE 2: CODE CLEANUP - Days 4-5"]
        direction TB
        P2A["2.1: Remove /matches refs<br/>2 hours"]
        P2B["2.2: Standardize status<br/>2 hours"]
        P2C["2.3: Verify subscriptions<br/>1 hour"]
        P2D["2.4: Consolidate adapters<br/>2 hours"]

        P2A --> P2B --> P2C --> P2D
    end

    subgraph Phase3["PHASE 3: VERIFICATION - Day 6"]
        direction TB
        P3A["3.1: Integration testing<br/>2 hours"]
        P3B["3.2: Update documentation<br/>1 hour"]

        P3A --> P3B
    end

    Phase1 --> Phase2 --> Phase3

    style P1D fill:#51cf66,stroke:#2f9e44
    style P3A fill:#51cf66,stroke:#2f9e44
    style P3B fill:#51cf66,stroke:#2f9e44
```

---

## 5. Service-to-Collection Matrix (Visual)

```mermaid
flowchart LR
    subgraph Services["SERVICES"]
        S1["useBracketGenerator"]
        S2["generateBracket CF"]
        S3["useMatchScheduler"]
        S4["generateSchedule CF"]
        S5["matches.ts store"]
        S6["updateMatch CF"]
        S7["advanceWinner CF"]
        S8["bracketMatchAdapter"]
    end

    subgraph Collections["COLLECTIONS"]
        C1["/stage"]
        C2["/group"]
        C3["/round"]
        C4["/match"]
        C5["/match_game"]
        C6["/participant"]
        C7["/match_scores"]
        C8["/matches ❌"]
        C9["/registrations"]
        C10["/courts"]
    end

    S1 -->|W| C1 & C2 & C3 & C4 & C5 & C6
    S1 -->|R| C9

    S2 -->|W| C1 & C2 & C3 & C4 & C5 & C6
    S2 -->|R| C9

    S3 -->|R| C4 & C10
    S3 -->|W| C7

    S4 -->|R| C8
    S4 -->|W| C8

    S5 -->|R| C4 & C7 & C9
    S5 -->|W| C7 & C10

    S6 -->|R| C4
    S6 -->|W| C4 & C7

    S7 -->|R| C8
    S7 -->|W| C8

    S8 -->|R| C4 & C9

    style C8 fill:#ff6b6b,stroke:#c92a2a,color:#fff
    style S4 fill:#ffa94d,stroke:#e67700
    style S7 fill:#ffa94d,stroke:#e67700
```

---

## Rendering Instructions

### VS Code
1. Install "Markdown Preview Mermaid Support" extension
2. Open this file and press `Ctrl+Shift+V` (or `Cmd+Shift+V` on Mac)

### GitHub
Mermaid diagrams render automatically in GitHub markdown files.

### Online
1. Go to https://mermaid.live/
2. Copy any diagram code between the ```mermaid blocks
3. Paste into the editor

### Export as Image
1. Use https://mermaid.live/
2. Click "Export" > "PNG" or "SVG"
3. Save to `/docs/architecture/images/`
