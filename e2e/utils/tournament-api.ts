import type { Page } from '@playwright/test';

export interface TournamentData {
  name: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  format: 'single_elimination' | 'double_elimination' | 'round_robin';
  sport: string;
  status: 'draft' | 'registration' | 'active' | 'completed';
  settings: {
    gamesPerMatch: number;
    pointsToWin: number;
    mustWinBy: number;
    maxPoints: number;
    minRestTimeMinutes: number;
    matchDurationMinutes: number;
    allowSelfRegistration: boolean;
    requireApproval: boolean;
  };
}

export interface CategoryData {
  name: string;
  type: 'singles' | 'doubles' | 'mixed_doubles';
  gender: 'men' | 'women' | 'mixed' | 'open';
  ageGroup: string;
  format: string;
  seedingEnabled: boolean;
  status: string;
}

export interface CourtData {
  name: string;
  number: number;
  status: 'available' | 'in_use' | 'maintenance';
}

export interface PlayerData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export class TournamentAPI {
  private page: Page;
  private baseUrl: string;

  constructor(page: Page, baseUrl: string = 'http://localhost:3000') {
    this.page = page;
    this.baseUrl = baseUrl;
  }

  async createTournament(data: Partial<TournamentData> = {}): Promise<{ id: string }> {
    const timestamp = Date.now();
    const tournamentData: TournamentData = {
      name: `E2E Test Tournament ${timestamp}`,
      description: 'Test tournament for E2E testing',
      location: 'Test Location',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      format: 'single_elimination',
      sport: 'badminton',
      status: 'draft',
      settings: {
        gamesPerMatch: 3,
        pointsToWin: 21,
        mustWinBy: 2,
        maxPoints: 30,
        minRestTimeMinutes: 15,
        matchDurationMinutes: 30,
        allowSelfRegistration: true,
        requireApproval: true,
      },
      ...data,
    };

    const response = await this.page.evaluate(async (data) => {
      const { getFirestore, collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      const { getAuth } = await import('firebase/auth');
      
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const db = getFirestore();
      const docRef = await addDoc(collection(db, 'tournaments'), {
        ...data,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      return { id: docRef.id };
    }, tournamentData);

    return response;
  }

  async addCategory(tournamentId: string, data: Partial<CategoryData> = {}): Promise<{ id: string }> {
    const categoryData: CategoryData = {
      name: "Men's Singles",
      type: 'singles',
      gender: 'men',
      ageGroup: 'open',
      format: 'single_elimination',
      seedingEnabled: true,
      status: 'setup',
      ...data,
    };

    const response = await this.page.evaluate(async ({ tournamentId, data }) => {
      const { getFirestore, collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      
      const db = getFirestore();
      const docRef = await addDoc(collection(db, `tournaments/${tournamentId}/categories`), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      return { id: docRef.id };
    }, { tournamentId, data: categoryData });

    return response;
  }

  async addCourt(tournamentId: string, data: Partial<CourtData> = {}): Promise<{ id: string }> {
    const courtData: CourtData = {
      name: 'Court 1',
      number: 1,
      status: 'available',
      ...data,
    };

    const response = await this.page.evaluate(async ({ tournamentId, data }) => {
      const { getFirestore, collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      
      const db = getFirestore();
      const docRef = await addDoc(collection(db, `tournaments/${tournamentId}/courts`), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      return { id: docRef.id };
    }, { tournamentId, data: courtData });

    return response;
  }

  async addPlayer(tournamentId: string, data: Partial<PlayerData> = {}): Promise<{ id: string }> {
    const timestamp = Date.now();
    const playerData: PlayerData = {
      firstName: 'Test',
      lastName: `Player ${timestamp}`,
      email: `test${timestamp}@example.com`,
      phone: '555-0000',
      ...data,
    };

    const response = await this.page.evaluate(async ({ tournamentId, data }) => {
      const { getFirestore, collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      
      const db = getFirestore();
      const docRef = await addDoc(collection(db, `tournaments/${tournamentId}/players`), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      return { id: docRef.id };
    }, { tournamentId, data: playerData });

    return response;
  }

  async deleteTournament(tournamentId: string): Promise<void> {
    await this.page.evaluate(async (tournamentId) => {
      const { getFirestore, doc, deleteDoc } = await import('firebase/firestore');
      
      const db = getFirestore();
      await deleteDoc(doc(db, 'tournaments', tournamentId));
    }, tournamentId);
  }
}

export async function createTournamentAPI(page: Page): Promise<TournamentAPI> {
  return new TournamentAPI(page);
}
