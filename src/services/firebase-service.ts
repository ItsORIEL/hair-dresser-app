// src/services/firebase-service.ts
import { getDatabase, ref, set, onValue, remove, push, get, DatabaseReference, query, orderByChild, equalTo, limitToLast, serverTimestamp } from "firebase/database";
import app, { authInstance } from "../firebase";
import { GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, User, onAuthStateChanged as firebaseOnAuthStateChanged } from 'firebase/auth';

// --- Interfaces ---
export interface Reservation {
  name: string;
  phone: string;
  time: string;
  date: string; // Expect YYYY-MM-DD format
  id: string; // ID is now mandatory within the object
  userId: string; // User ID is mandatory
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string | null;
  phone?: string;
}

export interface BarberNews {
  id?: string; // Keep ID optional here as it's added after push
  message: string;
  timestamp: number | object; // Firebase server timestamp resolves to number
}

export type BlockedTimeSlotsMap = Map<string, Set<string>>;

const db = getDatabase(app);

// --- Reservation Functions ---
export const createReservation = async (reservationData: Omit<Reservation, 'id'>): Promise<string> => {
  const reservationsRef: DatabaseReference = ref(db, 'reservations');
  const newReservationRef = push(reservationsRef);
  const newReservationId = newReservationRef.key;
  if (!newReservationId) {
    throw new Error("Failed to generate a new reservation ID.");
  }
  const reservationWithId: Reservation = { ...reservationData, id: newReservationId };
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
        const reservation = data[key];
        reservationsList.push({ ...reservation, id: reservation.id || key });
      });
    }
    callback(reservationsList);
  });
  return unsubscribe;
};

export const deleteReservation = async (reservationId: string): Promise<void> => {
  if (!reservationId || typeof reservationId !== 'string') {
      console.error("Invalid reservationId provided for deletion:", reservationId);
      throw new Error("Invalid reservation ID.");
  }
  const reservationRef: DatabaseReference = ref(db, `reservations/${reservationId}`);
  try {
    await remove(reservationRef);
  } catch (error) {
      console.error(`Error deleting reservation ${reservationId}:`, error);
      throw error;
  }
};

export const isTimeSlotBooked = async (date: string, time: string): Promise<boolean> => {
    const reservationsRef = ref(db, 'reservations');
    const dateQuery = query(reservationsRef, orderByChild('date'), equalTo(date));
    try {
        const snapshot = await get(dateQuery);
        if (!snapshot.exists()) return false;
        const data = snapshot.val();
        for (const key in data) {
            const reservation = data[key] as Reservation;
            if (reservation.time === time) {
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error(`Error checking if time slot ${date} ${time} is booked:`, error);
        return true; // Assume booked on error
    }
};

export const isTimeSlotAvailable = async (date: string, time: string, currentUserId?: string): Promise<boolean> => {
    const reservationsRef = ref(db, 'reservations');
    const dateQuery = query(reservationsRef, orderByChild('date'), equalTo(date));
    try {
        const snapshot = await get(dateQuery);
        if (!snapshot.exists()) return true;
        const data = snapshot.val();
        for (const key in data) {
            const reservation = data[key] as Reservation;
            if (reservation.date === date && reservation.time === time) {
                if (currentUserId && reservation.userId === currentUserId) {
                    return true; // User's own slot
                }
                return false; // Booked by someone else
            }
        }
        return true;
    } catch (error) {
        console.error(`Error checking availability for slot ${date} ${time}:`, error);
        return false; // Assume unavailable on error
    }
};

export const getUserReservationForDate = async (userId: string, date: string): Promise<Reservation | null> => {
    const reservationsRef = ref(db, 'reservations');
    const userReservationsQuery = query(reservationsRef, orderByChild('userId'), equalTo(userId));
    try {
        const snapshot = await get(userReservationsQuery);
        if (!snapshot.exists()) return null;
        let foundReservation: Reservation | null = null;
        snapshot.forEach((childSnapshot) => {
            const reservation = childSnapshot.val() as Reservation;
            const reservationId = childSnapshot.key;
            if (reservation.date === date) {
                foundReservation = { ...reservation, id: reservation.id || reservationId! };
                return true; // Exit .forEach
            }
        });
        return foundReservation;
    } catch (error) {
        console.error(`Error fetching reservation for user ${userId} on date ${date}:`, error);
        return null;
    }
};

// --- User Profile Functions ---
export const saveUserPhoneNumber = async (userId: string, phoneNumber: string, displayName: string, email: string | null): Promise<void> => {
  const userProfileRef = ref(db, `userProfiles/${userId}`);
  const profileData: UserProfile = {
    uid: userId,
    displayName: displayName || "User",
    email: email,
    phone: phoneNumber
  };
  try {
    await set(userProfileRef, profileData);
  } catch (error) {
      console.error(`Error saving user profile for ${userId}:`, error);
      throw error;
  }
};

export const getUserPhoneNumber = async (userId: string): Promise<string | undefined> => {
  const userProfilePhoneRef = ref(db, `userProfiles/${userId}/phone`);
  try {
    const snapshot = await get(userProfilePhoneRef);
    if (snapshot.exists()) {
      return snapshot.val();
    }
    return undefined;
  } catch (error) {
      console.error(`Error fetching phone number for user ${userId}:`, error);
      return undefined;
  }
};

// --- Barber News Functions ---
export const postBarberNews = async (message: string): Promise<string> => {
  const newsRef: DatabaseReference = ref(db, 'barberNews');
  const newNewsItemRef = push(newsRef);
  const newNewsId = newNewsItemRef.key;
  if (!newNewsId) {
    throw new Error("Failed to generate ID for new news item.");
  }
  const newsItem: Omit<BarberNews, 'id'> = {
    message: message,
    timestamp: serverTimestamp()
  };
  try {
    await set(newNewsItemRef, newsItem);
    return newNewsId;
  } catch (error) {
      console.error(`Error posting news item ${newNewsId}:`, error);
      throw error;
  }
};

export const getLatestBarberNews = (callback: (news: BarberNews | null) => void): () => void => {
  const newsRef: DatabaseReference = ref(db, 'barberNews');
  const latestNewsQuery = query(newsRef, orderByChild('timestamp'), limitToLast(1));
  const unsubscribe = onValue(latestNewsQuery, (snapshot) => {
    let latestNews: BarberNews | null = null;
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        latestNews = { ...childSnapshot.val(), id: childSnapshot.key } as BarberNews;
      });
    }
    callback(latestNews);
  }, (error) => {
      console.error("Error fetching latest barber news:", error);
      callback(null);
  });
  return unsubscribe;
};

// --- Blocked Days Functions ---
export const getBlockedDays = (callback: (blockedDays: Set<string>) => void): () => void => {
  const blockedDaysRef = ref(db, 'blockedDays');
  const unsubscribe = onValue(blockedDaysRef, (snapshot) => {
    const data = snapshot.val();
    const blockedSet = new Set<string>();
    if (data) {
      Object.keys(data).forEach((dateString) => {
        if (data[dateString] === true && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            blockedSet.add(dateString);
        }
      });
    }
    callback(blockedSet);
  }, (error) => {
      console.error("Error fetching blocked days:", error);
      callback(new Set<string>());
  });
  return unsubscribe;
};

export const blockDay = async (dateString: string): Promise<void> => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      throw new Error("Invalid date format. Use YYYY-MM-DD.");
  }
  const blockedDayRef = ref(db, `blockedDays/${dateString}`);
  try {
    await set(blockedDayRef, true);
  } catch (error) {
      console.error(`Error blocking day ${dateString}:`, error);
      throw error;
  }
};

export const unblockDay = async (dateString: string): Promise<void> => {
   if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      throw new Error("Invalid date format. Use YYYY-MM-DD.");
  }
  const blockedDayRef = ref(db, `blockedDays/${dateString}`);
  try {
    await remove(blockedDayRef);
  } catch (error) {
      console.error(`Error unblocking day ${dateString}:`, error);
      throw error;
  }
};

// --- Blocked Time Slots Functions ---
export const getBlockedTimeSlots = (callback: (slots: BlockedTimeSlotsMap) => void): () => void => {
    const blockedSlotsRef = ref(db, 'blockedTimeSlots');
    const unsubscribe = onValue(blockedSlotsRef, (snapshot) => {
        const data = snapshot.val();
        const slotsMap: BlockedTimeSlotsMap = new Map();
        if (data) {
            Object.keys(data).forEach((dateString) => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
                    const times = data[dateString];
                    if (typeof times === 'object' && times !== null) {
                        const timeSet = new Set<string>();
                        Object.keys(times).forEach((timeString) => {
                            if (times[timeString] === true) {
                                if (typeof timeString === 'string' && /^\d{1,2}:\d{2}\s(AM|PM)$/i.test(timeString)) {
                                    timeSet.add(timeString);
                                }
                            }
                        });
                        if (timeSet.size > 0) {
                            slotsMap.set(dateString, timeSet);
                        }
                    }
                }
            });
        }
        callback(slotsMap);
    }, (error) => {
        console.error("Error fetching blocked time slots:", error);
        callback(new Map());
    });
    return unsubscribe;
};

export const blockTimeSlot = async (dateString: string, timeString: string): Promise<void> => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        throw new Error("Invalid date format. Use YYYY-MM-DD.");
    }
    if (!/^\d{1,2}:\d{2}\s(AM|PM)$/i.test(timeString)) {
         throw new Error('Invalid time format. Use "H:MM AM/PM".');
    }
    const blockedSlotRef = ref(db, `blockedTimeSlots/${dateString}/${timeString}`);
    try {
        await set(blockedSlotRef, true);
    } catch (error) {
        console.error(`Error blocking time slot ${dateString} ${timeString}:`, error);
        throw error;
    }
};

export const unblockTimeSlot = async (dateString: string, timeString: string): Promise<void> => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        throw new Error("Invalid date format. Use YYYY-MM-DD.");
    }
     if (!/^\d{1,2}:\d{2}\s(AM|PM)$/i.test(timeString)) {
         throw new Error('Invalid time format. Use "H:MM AM/PM".');
    }
    const blockedSlotRef = ref(db, `blockedTimeSlots/${dateString}/${timeString}`);
    try {
        await remove(blockedSlotRef);
    } catch (error) {
        console.error(`Error unblocking time slot ${dateString} ${timeString}:`, error);
        throw error;
    }
};

// --- Firebase Authentication Functions ---
const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async (): Promise<User> => {
  try {
    const result = await signInWithPopup(authInstance, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Google Sign-In Error:", error);
    throw error;
  }
};

export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(authInstance);
  } catch (error) {
    console.error("Sign Out Error:", error);
    throw error;
  }
};

export { firebaseOnAuthStateChanged as onAuthStateChanged };