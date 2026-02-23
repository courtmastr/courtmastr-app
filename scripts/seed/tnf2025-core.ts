/**
 * TNF 2025 Tournament Seed - Core Logic
 *
 * Shared seeding logic for the 2025_Tnf tournament with Excel data import.
 * Both local (emulator) and production entry points import from here.
 */

import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
  type Firestore,
} from "firebase/firestore";
import { tnf2025Data } from './tnf2025-data';

// Data Mapping from Excel columns
const COL = {
  MS: { name: 1, email: 2, phone: 3, city: 4, level: 5 },
  MD: {
    n1: 6,
    e1: 7,
    p1: 8,
    c1: 9,
    l1: 10,
    n2: 11,
    e2: 12,
    p2: 13,
    c2: 14,
    l2: 15,
  },
  WD: {
    n1: 16,
    e1: 17,
    p1: 18,
    c1: 19,
    l1: 20,
    n2: 21,
    e2: 22,
    p2: 23,
    c2: 24,
    l2: 25,
  },
  MXD: {
    n1: 26,
    e1: 27,
    p1: 28,
    c1: 29,
    l1: 30,
    n2: 31,
    e2: 32,
    p2: 33,
    c2: 34,
    l2: 35,
  },
  SPEC: {
    n1: 36,
    e1: 37,
    p1: 38,
    c1: 39,
    l1: 40,
    n2: 41,
    e2: 42,
    p2: 43,
    c2: 44,
    l2: 45,
  },
};

interface CategoryInfo {
  id: string;
  name: string;
  type: "singles" | "doubles" | "mixed_doubles";
  gender: "men" | "women" | "mixed" | "open";
}

// Excel parsing helper - passed from caller since xlsx is Node-only
export interface ExcelData {
  row: number;
  data: any[];
}

export interface TNF2025SeedConfig {
  db: Firestore;
  adminId: string;
  tournamentName?: string;
  startDateOffset?: number; // Days from now
}

export async function runTNF2025Seed(config: TNF2025SeedConfig): Promise<string> {
  const { db, adminId } = config;
  const tournamentName = config.tournamentName ?? "2025_Tnf";
  const startDateOffset = config.startDateOffset ?? 14;

  console.log("\n[1] Creating Tournament...");
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + startDateOffset);
  startDate.setHours(9, 0, 0, 0);

  const tRef = await addDoc(collection(db, "tournaments"), {
    name: tournamentName,
    description: "Central Illinois Badminton Tournament",
    sport: "badminton",
    format: "single_elimination",
    status: "active",
    state: "LIVE",
    location: "Central Illinois",
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(
      new Date(startDate.getTime() + 8 * 60 * 60 * 1000),
    ),
    registrationDeadline: Timestamp.fromDate(new Date()),
    maxParticipants: 200,
    settings: {
      minRestTimeMinutes: 15,
      matchDurationMinutes: 20,
      allowSelfRegistration: false,
      requireApproval: false,
      gamesPerMatch: 3,
      pointsToWin: 21,
      mustWinBy: 2,
      maxPoints: 30,
    },
    createdBy: adminId,
    organizerIds: [adminId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const tournamentId = tRef.id;
  console.log(`  Created tournament: ${tournamentId}`);

  console.log("\n[2] Creating Categories...");
  const categoryConfigs: any[] = [
    { key: "MS", name: "Men's Singles", type: "singles", gender: "men" },
    { key: "MD", name: "Men's Doubles", type: "doubles", gender: "men" },
    { key: "WD", name: "Women's Doubles", type: "doubles", gender: "women" },
    {
      key: "MXD",
      name: "Mixed Doubles",
      type: "mixed_doubles",
      gender: "mixed",
    },
    { key: "SPEC", name: "Special Category", type: "doubles", gender: "mixed" },
  ];

  const categories: Record<string, CategoryInfo> = {};
  for (const catConfig of categoryConfigs) {
    const cRef = await addDoc(
      collection(db, "tournaments", tournamentId, "categories"),
      {
        tournamentId,
        name: catConfig.name,
        type: catConfig.type,
        gender: catConfig.gender,
        ageGroup: "open",
        format: "single_elimination",
        status: "setup",
        seedingEnabled: true,
        maxParticipants: 64,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    );
    categories[catConfig.key] = {
      id: cRef.id,
      name: catConfig.name,
      type: catConfig.type,
      gender: catConfig.gender,
    };
    console.log(`  Created category: ${catConfig.name} (${cRef.id})`);
  }

  console.log("\n[3] Creating Courts...");
  for (let i = 1; i <= 5; i += 1) {
    await addDoc(collection(db, "tournaments", tournamentId, "courts"), {
      tournamentId,
      name: `Court ${i}`,
      number: i,
      status: "available",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  console.log("  Created 5 courts");

  // Manual seeding overrides for MD category
  // Format: "Team Name": new seed number
  // (Old seed → New seed) per user request:
  //   Kavin KK / Pritesh Pitti:                    1 → 2
  //   Tejas Mayavanshi / Divaspathi Bhat:           2 → 3
  //   RamC Venkatasamy / Kishore Subarao:          15 → 4
  //   Kumaran Thiru / Sriram Balakrishnan:          4 → 5
  //   Ram Vaithilingam / Sakthinesan Somanathan:    5 → 6
  //   Karthik Kalairajan / Manoj Edward:            6 → 7
  //   Sudhan Sekar / Drumil Trivedi:                7 → 8
  //   Dhrumil Trivedi / Sudhan Sekar:               8 → 9
  //   Christuraj Arockiasamy / Abhiram Madugula:    9 → 10
  //   Arun Jay / Rajkumar Murugan:                 10 → 11
  //   Eshwar Palayam / Gowtham Kandasamy:          11 → 12
  //   Rajini thalaiva / Vijay Thalapathy:          12 → 13
  //   Hanuman Veera / Hitesh Reddivari:            13 → 14
  //   Ankur Upadhyay / Rahul Krishnan:              3 → 15
  //   Vinothkumar Nagarajan / Karthikeyan Subramanian: 15 → 16
  const MD_SEED_OVERRIDES: Record<string, number> = {
    "Kavin KK / Pritesh Pitti": 2,
    "Tejas Mayavanshi / Divaspathi Bhat": 3,
    "RamC Venkatasamy / Kishore Subarao": 4,
    "Kumaran Thiru / Sriram Balakrishnan": 5,
    "Ram Vaithilingam / Sakthinesan Somanathan": 6,
    "Karthik Kalairajan / Manoj Edward": 7,
    "Sudhan Sekar / Drumil Trivedi": 8,
    "Dhrumil Trivedi / Sudhan Sekar": 9,
    "Christuraj Arockiasamy / Abhiram Madugula": 10,
    "Arun Jay / Rajkumar Murugan": 11,
    "Eshwar Palayam / Gowtham Kandasamy": 12,
    "Rajini thalaiva / Vijay Thalapathy": 13,
    "Hanuman Veera / Hitesh Reddivari": 14,
    "Ankur Upadhyay / Rahul Krishnan": 15,
    "Vinothkumar Nagarajan / Karthikeyan Subramanian": 16,
  };

  console.log("\n[4] Creating Players and Registrations...");

  // We cache players by email or by name to avoid duplicates
  const playerIdCache = new Map<string, string>();

  const getOrCreatePlayer = async (
    name: string,
    email: string,
    phone: string,
    levelStr: string,
  ) => {
    name = name ? name.trim() : "";
    if (!name) return null;
    email = email
      ? email.trim()
      : `${name.replace(/\s+/g, ".").toLowerCase()}@placeholder.com`;
    const cacheKey = email.toLowerCase();

    if (playerIdCache.has(cacheKey)) {
      return playerIdCache.get(cacheKey)!;
    }

    // Attempt to guess first/last and skill
    const parts = name.split(" ");
    const first = parts.shift() || name;
    const last = parts.join(" ") || "-";
    let level = 1;
    if (levelStr && typeof levelStr === "string") {
      if (levelStr.toLowerCase().includes("intermediate")) level = 5;
      else if (levelStr.toLowerCase().includes("advanced")) level = 8;
    }

    const pRef = await addDoc(
      collection(db, "tournaments", tournamentId, "players"),
      {
        firstName: first,
        lastName: last,
        email: email,
        phone: phone ? String(phone) : "555-0000",
        gender: "male", // default, update if needed
        skillLevel: level,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    );
    playerIdCache.set(cacheKey, pRef.id);
    return pRef.id;
  };

  let totalRegistrations = 0;

  for (let i = 2; i < tnf2025Data.length; i++) {
    const row = tnf2025Data[i];
    if (!row || row.length === 0) continue;

    // Men's Singles
    if (row[COL.MS.name]) {
      const pId = await getOrCreatePlayer(
        row[COL.MS.name],
        row[COL.MS.email],
        row[COL.MS.phone],
        row[COL.MS.level],
      );
      if (pId) {
        await addDoc(
          collection(db, "tournaments", tournamentId, "registrations"),
          {
            tournamentId,
            categoryId: categories["MS"].id,
            participantType: "player",
            playerId: pId,
            status: "approved",
            seed: totalRegistrations + 1,
            isCheckedIn: true, // Auto checkin for MS to fulfill requirement
            registeredBy: adminId,
            registeredAt: serverTimestamp(),
            approvedAt: serverTimestamp(),
            approvedBy: adminId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        );
        totalRegistrations++;
      }
    }

    // Helper for doubles
    const registerDoubles = async (key: string) => {
      const colMap = COL[key as keyof typeof COL] as any;
      if (row[colMap.n1]) {
        const p1Id = await getOrCreatePlayer(
          row[colMap.n1],
          row[colMap.e1],
          row[colMap.p1],
          row[colMap.l1],
        );
        const p2Id = await getOrCreatePlayer(
          row[colMap.n2],
          row[colMap.e2],
          row[colMap.p2],
          row[colMap.l2],
        );
        if (p1Id && p2Id) {
          const teamName = `${row[colMap.n1]} / ${row[colMap.n2]}`;
          await addDoc(
            collection(db, "tournaments", tournamentId, "registrations"),
            {
              tournamentId,
              categoryId: categories[key].id,
              participantType: "team",
              playerId: p1Id,
              partnerPlayerId: p2Id,
              teamName: teamName,
              status: "approved",
              seed: key === "MD" && MD_SEED_OVERRIDES[teamName] ? MD_SEED_OVERRIDES[teamName] : (totalRegistrations + 1),
              isCheckedIn: false,
              registeredBy: adminId,
              registeredAt: serverTimestamp(),
              approvedAt: serverTimestamp(),
              approvedBy: adminId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
          );
          totalRegistrations++;
        }
      }
    };

    await registerDoubles("MD");
    await registerDoubles("WD");
    await registerDoubles("MXD");
    await registerDoubles("SPEC");
  }

  console.log(
    `\n  Done! Created ${playerIdCache.size} unique players and ${totalRegistrations} registrations.`,
  );
  console.log(`  Men's Singles category has auto check-in applied.`);

  return tournamentId;
}
