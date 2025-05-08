// src/services/firebase-service.ts
import { getDatabase, ref, set, onValue, remove, push, get, DatabaseReference, query, orderByChild, equalTo } from "firebase/database";
import app, { authInstance } from "../firebase";

import {
  GoogleAuthProvider,
  // OAuthProvider, // REMOVED for Apple
  signInWithPopup,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';

// Define Reservation type
export interface Reservation {
  name: string;
  phone: string;
  time: string;
  date: string;
  id?: string;
  userId?: string;
}

// Define User Profile type
export interface UserProfile {
  uid: string;
  displayName: string;
  email: string | null;
  phone?: string;
}

const db = getDatabase(app);

// --- Reservation Functions ---
export const createReservation = async (reservation: Omit<Reservation, 'id'>): Promise<string> => {
  const reservationsRef: DatabaseReference = ref(db, 'reservations');
  const newReservationRef = push(reservationsRef);
  const newReservationId = newReservationRef.key || '';
  const reservationWithId: Reservation = { ...reservation, id: newReservationId };
  await set(newReservationRef, reservationWithId);
  return newReservationId;
};

export const getReservations = (callback: (reservations: Reservation[]) => void): () => void => {
  const reservationsRef: DatabaseReference = ref(db, 'reservations');
  const unsubscribe = onValue(reservationsRef, (snapshot) => {
    const data = snapshot.val();
    const reservationsList: Reservation[] = [];
    if (data) {
      Object.keys(data).forEach((key) => {
        reservationsList.push({ ...data[key], id: key });
      });
    }
    callback(reservationsList);
  });
  return unsubscribe;
};

export const deleteReservation = async (reservationId: string): Promise<void> => {
  const reservationRef: DatabaseReference = ref(db, `reservations/${reservationId}`);
  await remove(reservationRef);
};

export const isTimeSlotAvailable = async (date: string, time: string, currentUserId?: string): Promise<boolean> => {
  const reservationsRef = ref(db, 'reservations');
  const snapshot = await get(reservationsRef);

  const currentDate = new Date().toISOString().split('T')[0];
  if (date === currentDate) {
    const currentTime = new Date();
    const timeStr = time.match(/(\d+):(\d+)\s*([AP]M)/i);
    if (timeStr) {
      let hours = parseInt(timeStr[1]);
      const minutes = parseInt(timeStr[2]);
      const ampm = timeStr[3].toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      const appointmentTime = new Date(date);
      appointmentTime.setHours(hours, minutes, 0, 0);
      if (appointmentTime <= currentTime) return false;
    }
  }

  if (!snapshot.exists()) return true;

  const data = snapshot.val();
  for (const key in data) {
    const reservation = data[key] as Reservation;
    if (reservation.date === date && reservation.time === time) {
      if (currentUserId && reservation.userId === currentUserId) {
        continue;
      }
      return false;
    }
  }
  return true;
};

export const getUserReservationForDate = async (userId: string, date: string): Promise<Reservation | null> => {
  const reservationsRef = ref(db, 'reservations');
  const userReservationsQuery = query(reservationsRef, orderByChild('userId'), equalTo(userId));
  const snapshot = await get(userReservationsQuery);

  if (!snapshot.exists()) return null;

  let foundReservation: Reservation | null = null;
  snapshot.forEach((childSnapshot) => {
    const reservation = childSnapshot.val() as Reservation;
    if (reservation.date === date) {
      foundReservation = { ...reservation, id: childSnapshot.key };
      return true;
    }
  });
  return foundReservation;
};

// --- User Profile (Phone Number) Functions ---
export const saveUserPhoneNumber = async (userId: string, phoneNumber: string, displayName: string, email: string | null): Promise<void> => {
  const userProfileRef = ref(db, `userProfiles/${userId}`);
  const profileData: UserProfile = {
    uid: userId,
    displayName: displayName,
    email: email,
    phone: phoneNumber
  };
  await set(userProfileRef, profileData);
};

export const getUserPhoneNumber = async (userId: string): Promise<string | undefined> => {
  const userProfileRef = ref(db, `userProfiles/${userId}/phone`);
  const snapshot = await get(userProfileRef);
  if (snapshot.exists()) {
    return snapshot.val();
  }
  return undefined;
};

// --- Firebase Authentication Functions ---
const googleProvider = new GoogleAuthProvider();
// REMOVED: const appleProvider = new OAuthProvider('apple.com');

export const signInWithGoogle = async (): Promise<User> => {
  try {
    const result = await signInWithPopup(authInstance, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    throw error;
  }
};

// REMOVED: signInWithApple function

export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(authInstance);
  } catch (error) {
    console.error("Sign Out Error:", error);
    throw error;
  }
};

export const onAuthStateChanged = (callback: (user: User | null) => void) => {
  return authInstance.onAuthStateChanged(callback);
};