import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { getEmulatorApp } from './emulator';

const splitPath = (path: string): string[] => path.split('/').filter(Boolean);

export const seedDocument = async (documentPath: string, data: DocumentData): Promise<void> => {
  const { db } = getEmulatorApp();
  await setDoc(doc(db, ...splitPath(documentPath)), data);
};

export const mergeDocument = async (documentPath: string, data: DocumentData): Promise<void> => {
  const { db } = getEmulatorApp();
  await setDoc(doc(db, ...splitPath(documentPath)), data, { merge: true });
};

export const readDocument = async <T = DocumentData>(documentPath: string): Promise<T | null> => {
  const { db } = getEmulatorApp();
  const snapshot = await getDoc(doc(db, ...splitPath(documentPath)));
  if (!snapshot.exists()) return null;
  return snapshot.data() as T;
};

export const clearCollection = async (collectionPath: string): Promise<void> => {
  const { db } = getEmulatorApp();
  const snapshots = await getDocs(collection(db, ...splitPath(collectionPath)));
  if (snapshots.empty) return;

  const batch = writeBatch(db);
  snapshots.docs.forEach((snapshot) => {
    batch.delete(snapshot.ref);
  });
  await batch.commit();
};

export const deleteDocument = async (documentPath: string): Promise<void> => {
  const { db } = getEmulatorApp();
  await deleteDoc(doc(db, ...splitPath(documentPath)));
};
