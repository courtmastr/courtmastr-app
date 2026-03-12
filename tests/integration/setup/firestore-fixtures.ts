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

export const seedDocument = async (documentPath: string, data: DocumentData): Promise<void> => {
  const { db } = getEmulatorApp();
  await setDoc(doc(db, documentPath), data);
};

export const mergeDocument = async (documentPath: string, data: DocumentData): Promise<void> => {
  const { db } = getEmulatorApp();
  await setDoc(doc(db, documentPath), data, { merge: true });
};

export const readDocument = async <T = DocumentData>(documentPath: string): Promise<T | null> => {
  const { db } = getEmulatorApp();
  const snapshot = await getDoc(doc(db, documentPath));
  if (!snapshot.exists()) return null;
  return snapshot.data() as T;
};

export const clearCollection = async (collectionPath: string): Promise<void> => {
  const { db } = getEmulatorApp();
  const snapshots = await getDocs(collection(db, collectionPath));
  if (snapshots.empty) return;

  const batch = writeBatch(db);
  snapshots.docs.forEach((snapshot) => {
    batch.delete(snapshot.ref);
  });
  await batch.commit();
};

export const deleteDocument = async (documentPath: string): Promise<void> => {
  const { db } = getEmulatorApp();
  await deleteDoc(doc(db, documentPath));
};
