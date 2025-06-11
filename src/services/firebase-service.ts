// src/services/firebase-service.ts
import { getDatabase, ref, set, onValue, remove, push, get, DatabaseReference, query, orderByChild, equalTo, limitToLast, serverTimestamp } from "firebase/database";
import app, { authInstance } from "../firebase";
import { GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, User, onAuthStateChanged as firebaseOnAuthStateChanged } from 'firebase/auth';

export interface Reservation {
  name: string;
  phone: string;
  time: string; // EXPECTS HH:MM format (e.g., "09:00", "14:30")
  date: string;
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
  timestamp: number | object; // Firebase server timestamp resolves to number
}

export type BlockedTimeSlotsMap = Map<string, Set<string>>;
const db = getDatabase(app);

const convertAMPMToHHMM = (timeAMPM: string | undefined | null): string => {
    if (!timeAMPM) return '';
    if (/^\d{2}:\d{2}$/.test(timeAMPM)) return timeAMPM;

    const timeMatch = timeAMPM.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!timeMatch) {
        console.warn(`convertAMPMToHHMM: Could not parse time: ${timeAMPM}. Returning as is.`);
        return timeAMPM;
    }
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const modifier = timeMatch[3].toUpperCase();

    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const createReservation = async (reservationData: Omit<Reservation, 'id'>): Promise<string> => {
  if (reservationData.time && !/^\d{2}:\d{2}$/.test(reservationData.time)) {
    console.warn(`createReservation received non-HH:MM time: ${reservationData.time}. Attempting conversion.`);
    reservationData.time = convertAMPMToHHMM(reservationData.time);
    if (!/^\d{2}:\d{2}$/.test(reservationData.time)) {
        throw new Error(`Invalid time format after attempted conversion: ${reservationData.time}. Expected HH:MM.`);
    }
  } else if (!reservationData.time) {
      throw new Error("Reservation time is missing.");
  }

  const reservationsRef: DatabaseReference = ref(db, 'reservations');
  const newReservationRef = push(reservationsRef);
  const newReservationId = newReservationRef.key;
  if (!newReservationId) throw new Error("Failed to generate reservation ID.");

  const reservationToSave: Reservation = { ...reservationData, id: newReservationId };
  await set(newReservationRef, reservationToSave);
  return newReservationId;
};

export const getReservations = (callback: (reservations: Reservation[]) => void): () => void => {
  const reservationsRef: DatabaseReference = ref(db, 'reservations');
  const unsubscribe = onValue(reservationsRef, (snapshot) => {
    const data = snapshot.val();
    const reservationsList: Reservation[] = [];
    if (data) {
      Object.keys(data).forEach((key) => {
        const reservation = data[key] as any;
        if (reservation.time) {
            reservation.time = convertAMPMToHHMM(reservation.time);
        } else {
            reservation.time = "00:00";
            console.warn(`Reservation ${key} has no time field or is invalid.`);
        }
        reservationsList.push({ ...reservation, id: key } as Reservation); // Key is the ID
      });
    }
    // <<< --- ADDED THIS LOG --- >>>
    console.log("Firebase Service: getReservations listener fired. Count:", reservationsList.length, "Data received:", data ? JSON.stringify(Object.values(data).map((r:any) => ({id: r.id, date: r.date, time: r.time, name: r.name})), null, 2) : "No data");
    callback(reservationsList);
  });
  return unsubscribe;
};

export const deleteReservation = async (reservationId: string): Promise<void> => {
  if (!reservationId) throw new Error("Invalid reservation ID.");
  const reservationRef = ref(db, `reservations/${reservationId}`);
  await remove(reservationRef);
};

export const isTimeSlotBooked = async (date: string, time: string): Promise<boolean> => {
    if (!/^\d{2}:\d{2}$/.test(time)) { console.warn("isTimeSlotBooked invalid time:", time); return true; }
    const reservationsRef = ref(db, 'reservations');
    const dateQuery = query(reservationsRef, orderByChild('date'), equalTo(date));
    const snapshot = await get(dateQuery);
    if (!snapshot.exists()) return false;
    const data = snapshot.val();
    for (const key in data) {
        let reservationTimeInDB = data[key].time;
        if (reservationTimeInDB) reservationTimeInDB = convertAMPMToHHMM(reservationTimeInDB);
        if (reservationTimeInDB === time) return true;
    }
    return false;
};

export const isTimeSlotAvailable = async (date: string, time: string, currentUserId?: string): Promise<boolean> => {
    if (!/^\d{2}:\d{2}$/.test(time)) { console.warn("isTimeSlotAvailable invalid time:", time); return false; }
    const reservationsRef = ref(db, 'reservations');
    const dateQuery = query(reservationsRef, orderByChild('date'), equalTo(date));
    const snapshot = await get(dateQuery);
    if (!snapshot.exists()) return true;
    const data = snapshot.val();
    for (const key in data) {
        const reservationFromDB = data[key];
        let reservationTimeInDB = reservationFromDB.time;
        if (reservationTimeInDB) reservationTimeInDB = convertAMPMToHHMM(reservationTimeInDB);

        if (reservationFromDB.date === date && reservationTimeInDB === time) {
            if (currentUserId && reservationFromDB.userId === currentUserId) return true;
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
        const reservation = childSnapshot.val() as any;
        if (reservation.date === date) {
            if (reservation.time) reservation.time = convertAMPMToHHMM(reservation.time);
            else reservation.time = "00:00"; // Should not happen with good data
            foundReservation = { ...reservation, id: childSnapshot.key! } as Reservation;
            return true;
        }
    });
    return foundReservation;
};

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

export const getBlockedTimeSlots = (callback: (slots: BlockedTimeSlotsMap) => void): () => void => {
    const blockedSlotsRef = ref(db, 'blockedTimeSlots');
    const unsubscribe = onValue(blockedSlotsRef, (snapshot) => {
        const data = snapshot.val();
        const slotsMap: BlockedTimeSlotsMap = new Map();
        if (data) {
            Object.keys(data).forEach((dateString) => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
                    const timesFromDB = data[dateString];
                    if (typeof timesFromDB === 'object' && timesFromDB !== null) {
                        const timeSet = new Set<string>();
                        Object.keys(timesFromDB).forEach((timeKey) => {
                            if (timesFromDB[timeKey] === true) {
                                const processedTimeKey = convertAMPMToHHMM(timeKey);
                                if (/^\d{2}:\d{2}$/.test(processedTimeKey)) {
                                    timeSet.add(processedTimeKey);
                                } else {
                                    console.warn(`Invalid time format '${timeKey}' (processed to '${processedTimeKey}') in blockedTimeSlots for date ${dateString}. Skipping.`);
                                }
                            }
                        });
                        if (timeSet.size > 0) slotsMap.set(dateString, timeSet);
                    }
                }
            });
        }
        callback(slotsMap);
    }, (error) => { console.error("Error fetching blocked time slots:", error); callback(new Map()); });
    return unsubscribe;
};

export const blockTimeSlot = async (dateString: string, timeString: string): Promise<void> => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) throw new Error("Invalid date format.");
    if (!/^\d{2}:\d{2}$/.test(timeString)) throw new Error(`Invalid time format to block: ${timeString}. Use "HH:MM".`);
    const blockedSlotRef = ref(db, `blockedTimeSlots/${dateString}/${timeString}`);
    await set(blockedSlotRef, true);
};

export const unblockTimeSlot = async (dateString: string, timeString: string): Promise<void> => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) throw new Error("Invalid date format.");
    if (!/^\d{2}:\d{2}$/.test(timeString)) throw new Error(`Invalid time format to unblock: ${timeString}. Use "HH:MM".`);
    const blockedSlotRef = ref(db, `blockedTimeSlots/${dateString}/${timeString}`);
    await remove(blockedSlotRef);
};

const googleProvider = new GoogleAuthProvider();
export const signInWithGoogle = async (): Promise<User> => { try {const r = await signInWithPopup(authInstance,googleProvider); return r.user}catch(e:any){console.error(e);throw e}};
export const signOut = async (): Promise<void> => { try {await firebaseSignOut(authInstance)}catch(e){console.error(e);throw e}};
export { firebaseOnAuthStateChanged as onAuthStateChanged };