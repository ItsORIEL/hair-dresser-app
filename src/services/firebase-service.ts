// src/services/firebase-service.ts
import { getDatabase, ref, set, onValue, remove, push, get, DatabaseReference, query, orderByChild, equalTo, limitToLast, serverTimestamp } from "firebase/database";
import app, { authInstance } from "../firebase";
import { GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, User, onAuthStateChanged as firebaseOnAuthStateChanged } from 'firebase/auth';

export interface Reservation {
  name: string;
  phone: string;
  time: string; // EXPECTS HH:MM format
  date: string; // Expect YYYY-MM-DD format
  id: string; 
  userId: string; 
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string | null;
  phone?: string;
}

export interface BarberNews {
  id?: string; 
  message: string;
  timestamp: number | object; 
}

// BlockedTimeSlotsMap's Set<string> for times should now contain HH:MM
export type BlockedTimeSlotsMap = Map<string, Set<string>>;

const db = getDatabase(app);

// --- Reservation Functions ---
// createReservation will now receive reservationData.time as HH:MM
export const createReservation = async (reservationData: Omit<Reservation, 'id'>): Promise<string> => {
  // Optional: Add validation for HH:MM format before saving
  if (reservationData.time && !/^\d{2}:\d{2}$/.test(reservationData.time)) {
    // console.warn(`Invalid time format for reservation: ${reservationData.time}. Saving as is.`);
    // Or throw new Error("Invalid time format for reservation. Expected HH:MM.");
  }
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

// getReservations will return reservations with time as HH:MM (assuming data in DB is HH:MM)
// If data in DB is AM/PM, it needs migration or conversion here.
export const getReservations = (callback: (reservations: Reservation[]) => void): () => void => {
  const reservationsRef: DatabaseReference = ref(db, 'reservations');
  const unsubscribe = onValue(reservationsRef, (snapshot) => {
    const data = snapshot.val();
    const reservationsList: Reservation[] = [];
    if (data) {
      Object.keys(data).forEach((key) => {
        const reservation = data[key] as Reservation;
        // IMPORTANT: If your DB has old AM/PM times, you'd need to convert them here.
        // For now, we assume 'reservation.time' is already HH:MM or will be after migration.
        // Example (very basic) conversion if needed - adapt thoroughly:
        // if (reservation.time && reservation.time.includes("AM") || reservation.time.includes("PM")) {
        //   try {
        //     const [timePart, modifier] = reservation.time.split(' ');
        //     let [hours, minutes] = timePart.split(':').map(Number);
        //     if (modifier.toUpperCase() === 'PM' && hours < 12) hours += 12;
        //     if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0; // Midnight
        //     reservation.time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        //   } catch (e) { console.error("Error converting old time format:", reservation.time, e); }
        // }
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

// isTimeSlotBooked expects time as HH:MM
export const isTimeSlotBooked = async (date: string, time: string): Promise<boolean> => {
    // Optional: Validate time format if needed
    // if (!/^\d{2}:\d{2}$/.test(time)) { console.warn("isTimeSlotBooked called with invalid time format:", time); return true; }

    const reservationsRef = ref(db, 'reservations');
    const dateQuery = query(reservationsRef, orderByChild('date'), equalTo(date));
    try {
        const snapshot = await get(dateQuery);
        if (!snapshot.exists()) return false;
        const data = snapshot.val();
        for (const key in data) {
            const reservation = data[key] as Reservation;
            // Assuming reservation.time in DB is HH:MM after migration/conversion in getReservations
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

// isTimeSlotAvailable expects time as HH:MM
export const isTimeSlotAvailable = async (date: string, time: string, currentUserId?: string): Promise<boolean> => {
    // Optional: Validate time format
    // if (!/^\d{2}:\d{2}$/.test(time)) { console.warn("isTimeSlotAvailable called with invalid time format:", time); return false; }

    const reservationsRef = ref(db, 'reservations');
    const dateQuery = query(reservationsRef, orderByChild('date'), equalTo(date));
    try {
        const snapshot = await get(dateQuery);
        if (!snapshot.exists()) return true;
        const data = snapshot.val();
        for (const key in data) {
            const reservation = data[key] as Reservation;
            if (reservation.date === date && reservation.time === time) {
                // Assuming reservation.time in DB is HH:MM
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

// getUserReservationForDate returns reservation with time as HH:MM (assuming DB data is HH:MM)
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
                // Assuming reservation.time in DB is HH:MM
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

// --- User Profile Functions --- (No changes related to time format)
export const saveUserPhoneNumber = async (userId: string, phoneNumber: string, displayName: string, email: string | null): Promise<void> => {
  const userProfileRef = ref(db, `userProfiles/${userId}`);
  const profileData: UserProfile = { uid: userId, displayName: displayName || "User", email: email, phone: phoneNumber };
  try { await set(userProfileRef, profileData); } 
  catch (error) { console.error(`Error saving user profile for ${userId}:`, error); throw error; }
};
export const getUserPhoneNumber = async (userId: string): Promise<string | undefined> => {
  const userProfilePhoneRef = ref(db, `userProfiles/${userId}/phone`);
  try {
    const snapshot = await get(userProfilePhoneRef);
    return snapshot.exists() ? snapshot.val() : undefined;
  } catch (error) { console.error(`Error fetching phone number for user ${userId}:`, error); return undefined; }
};

// --- Barber News Functions --- (No changes related to time format for news message itself)
export const postBarberNews = async (message: string): Promise<string> => {
  const newsRef: DatabaseReference = ref(db, 'barberNews');
  const newNewsItemRef = push(newsRef);
  const newNewsId = newNewsItemRef.key;
  if (!newNewsId) throw new Error("Failed to generate ID for new news item.");
  const newsItem: Omit<BarberNews, 'id'> = { message: message, timestamp: serverTimestamp() };
  try { await set(newNewsItemRef, newsItem); return newNewsId; } 
  catch (error) { console.error(`Error posting news item ${newNewsId}:`, error); throw error; }
};
export const getLatestBarberNews = (callback: (news: BarberNews | null) => void): () => void => {
  const newsRef: DatabaseReference = ref(db, 'barberNews');
  const latestNewsQuery = query(newsRef, orderByChild('timestamp'), limitToLast(1));
  const unsubscribe = onValue(latestNewsQuery, (snapshot) => {
    let latestNews: BarberNews | null = null;
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => { latestNews = { ...childSnapshot.val(), id: childSnapshot.key } as BarberNews; });
    }
    callback(latestNews);
  }, (error) => { console.error("Error fetching latest barber news:", error); callback(null); });
  return unsubscribe;
};

// --- Blocked Days Functions --- (No changes related to time format)
export const getBlockedDays = (callback: (blockedDays: Set<string>) => void): () => void => {
  const blockedDaysRef = ref(db, 'blockedDays');
  const unsubscribe = onValue(blockedDaysRef, (snapshot) => {
    const data = snapshot.val(); const blockedSet = new Set<string>();
    if (data) { Object.keys(data).forEach((dateString) => { if (data[dateString] === true && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) blockedSet.add(dateString); }); }
    callback(blockedSet);
  }, (error) => { console.error("Error fetching blocked days:", error); callback(new Set<string>()); });
  return unsubscribe;
};
export const blockDay = async (dateString: string): Promise<void> => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) throw new Error("Invalid date format. Use YYYY-MM-DD.");
  const blockedDayRef = ref(db, `blockedDays/${dateString}`);
  try { await set(blockedDayRef, true); } 
  catch (error) { console.error(`Error blocking day ${dateString}:`, error); throw error; }
};
export const unblockDay = async (dateString: string): Promise<void> => {
   if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) throw new Error("Invalid date format. Use YYYY-MM-DD.");
  const blockedDayRef = ref(db, `blockedDays/${dateString}`);
  try { await remove(blockedDayRef); } 
  catch (error) { console.error(`Error unblocking day ${dateString}:`, error); throw error; }
};

// --- Blocked Time Slots Functions ---
// getBlockedTimeSlots should return time slots in HH:MM format in the Set<string>
// If data in DB is AM/PM, it needs migration or conversion here.
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
                                // Assuming timeString from DB is HH:MM or converted
                                // Add validation if necessary before adding to set
                                if (typeof timeString === 'string' && /^\d{2}:\d{2}$/.test(timeString)) {
                                    timeSet.add(timeString);
                                } else {
                                    // Handle old AM/PM format if necessary or log warning
                                    // console.warn(`Invalid or old time format found in blockedTimeSlots: ${timeString}`);
                                    // Example conversion (adapt thoroughly):
                                    // if (timeString.includes("AM") || timeString.includes("PM")) {
                                    //   try {
                                    //     const [timePart, modifier] = timeString.split(' ');
                                    //     let [hours, minutesValue] = timePart.split(':').map(Number);
                                    //     if (modifier.toUpperCase() === 'PM' && hours < 12) hours += 12;
                                    //     if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;
                                    //     timeSet.add(`${String(hours).padStart(2, '0')}:${String(minutesValue).padStart(2, '0')}`);
                                    //   } catch(e) { /* handle error */ }
                                    // }
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

// blockTimeSlot expects timeString as HH:MM
export const blockTimeSlot = async (dateString: string, timeString: string): Promise<void> => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        throw new Error("Invalid date format. Use YYYY-MM-DD.");
    }
    // MODIFIED: Validate HH:MM format
    if (!/^\d{2}:\d{2}$/.test(timeString)) {
         throw new Error('Invalid time format. Use "HH:MM".');
    }
    const blockedSlotRef = ref(db, `blockedTimeSlots/${dateString}/${timeString}`);
    try {
        await set(blockedSlotRef, true);
    } catch (error) {
        console.error(`Error blocking time slot ${dateString} ${timeString}:`, error);
        throw error;
    }
};

// unblockTimeSlot expects timeString as HH:MM
export const unblockTimeSlot = async (dateString: string, timeString: string): Promise<void> => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        throw new Error("Invalid date format. Use YYYY-MM-DD.");
    }
     // MODIFIED: Validate HH:MM format
    if (!/^\d{2}:\d{2}$/.test(timeString)) {
         throw new Error('Invalid time format. Use "HH:MM".');
    }
    const blockedSlotRef = ref(db, `blockedTimeSlots/${dateString}/${timeString}`);
    try {
        await remove(blockedSlotRef);
    } catch (error) {
        console.error(`Error unblocking time slot ${dateString} ${timeString}:`, error);
        throw error;
    }
};

// --- Firebase Authentication Functions --- (No changes related to time format)
const googleProvider = new GoogleAuthProvider();
export const signInWithGoogle = async (): Promise<User> => {
  try { const result = await signInWithPopup(authInstance, googleProvider); return result.user; } 
  catch (error: any) { console.error("Google Sign-In Error:", error); throw error; }
};
export const signOut = async (): Promise<void> => {
  try { await firebaseSignOut(authInstance); } 
  catch (error) { console.error("Sign Out Error:", error); throw error; }
};
export { firebaseOnAuthStateChanged as onAuthStateChanged };