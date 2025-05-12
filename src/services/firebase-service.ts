// src/services/firebase-service.ts
import { getDatabase, ref, set, onValue, remove, push, get, DatabaseReference, query, orderByChild, equalTo, limitToLast, serverTimestamp } from "firebase/database";
import app, { authInstance } from "../firebase";

import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  User,
  onAuthStateChanged as firebaseOnAuthStateChanged, // Import directly
} from 'firebase/auth';

// Define Reservation type
export interface Reservation {
  name: string;
  phone: string;
  time: string;
  date: string; // Expect YYYY-MM-DD format
  id: string; // ID is now mandatory within the object
  userId: string; // User ID is mandatory
}

// Define User Profile type
export interface UserProfile {
  uid: string;
  displayName: string;
  email: string | null;
  phone?: string;
}

// BarberNews interface
export interface BarberNews {
  id?: string; // Keep ID optional here as it's added after push
  message: string;
  timestamp: number | object; // Firebase server timestamp resolves to number
}

const db = getDatabase(app);
// const ADMIN_UID = 'X6IZj1LMNKfZIZlwQud23U5mzhC3'; // This constant is managed in App.tsx

// --- Reservation Functions ---

/**
 * Creates a new reservation in the database.
 * Ensures the generated push ID is stored within the reservation object itself under the 'id' field.
 */
export const createReservation = async (reservationData: Omit<Reservation, 'id'>): Promise<string> => {
  const reservationsRef: DatabaseReference = ref(db, 'reservations');
  const newReservationRef = push(reservationsRef); // Generate unique ID
  const newReservationId = newReservationRef.key;

  if (!newReservationId) {
    throw new Error("Failed to generate a new reservation ID.");
  }

  // Prepare the full reservation object including the generated ID
  const reservationWithId: Reservation = {
    ...reservationData,
    id: newReservationId // Store the ID within the object
  };

  // Set the reservation data at the new reference
  await set(newReservationRef, reservationWithId);

  return newReservationId;
};

/**
 * Listens for real-time updates to all reservations.
 * @param callback Function to execute with the updated list of reservations.
 * @returns An unsubscribe function to detach the listener.
 */
export const getReservations = (callback: (reservations: Reservation[]) => void): () => void => {
  const reservationsRef: DatabaseReference = ref(db, 'reservations');
  // Optional: Order by date if needed for initial load, though client-side sort might be sufficient
  // const orderedQuery = query(reservationsRef, orderByChild('date'));
  const unsubscribe = onValue(reservationsRef, (snapshot) => {
    const data = snapshot.val();
    const reservationsList: Reservation[] = [];
    if (data) {
      Object.keys(data).forEach((key) => {
        const reservation = data[key];
        // Ensure the ID from the key is included, preferring the 'id' field if it exists
        reservationsList.push({ ...reservation, id: reservation.id || key });
      });
    }
    // Optional: Sort here if needed before callback
    // reservationsList.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    callback(reservationsList);
  });
  return unsubscribe;
};

/**
 * Deletes a reservation by its ID.
 */
export const deleteReservation = async (reservationId: string): Promise<void> => {
  if (!reservationId || typeof reservationId !== 'string') {
      console.error("Invalid reservationId provided for deletion:", reservationId);
      throw new Error("Invalid reservation ID.");
  }
  const reservationRef: DatabaseReference = ref(db, `reservations/${reservationId}`);
  try {
    await remove(reservationRef);
    console.log(`Reservation ${reservationId} deleted successfully.`);
  } catch (error) {
      console.error(`Error deleting reservation ${reservationId}:`, error);
      throw error; // Re-throw the error for the caller to handle
  }
};

/**
 * Checks if a specific time slot on a given date is booked by *any* user.
 * Does not consider past time, focuses purely on existing bookings.
 */
export const isTimeSlotBooked = async (date: string, time: string): Promise<boolean> => {
    const reservationsRef = ref(db, 'reservations');
    // Querying by date can improve performance if indexed in rules
    const dateQuery = query(reservationsRef, orderByChild('date'), equalTo(date));
    try {
        const snapshot = await get(dateQuery);
        if (!snapshot.exists()) return false; // No reservations for this date

        const data = snapshot.val();
        for (const key in data) {
            const reservation = data[key] as Reservation;
            if (reservation.time === time) {
                return true; // Found a booking for this date and time
            }
        }
        return false; // No booking found for this specific time
    } catch (error) {
        console.error(`Error checking if time slot ${date} ${time} is booked:`, error);
        // Depending on policy, either default to "booked" (safer) or "available"
        return true; // Assume booked on error to prevent double booking
    }
};

/**
 * Checks if a time slot is available for a specific user to book.
 * It considers if the slot is in the past, booked by others, or blocked.
 * Returns true if the user can potentially book it (e.g., it's free or it's their own existing slot).
 * NOTE: This function checks against the database state. UI should perform additional checks (like past time).
 */
export const isTimeSlotAvailable = async (date: string, time: string, currentUserId?: string): Promise<boolean> => {
    const reservationsRef = ref(db, 'reservations');
    // Index on 'date' in Firebase rules is recommended here
    const dateQuery = query(reservationsRef, orderByChild('date'), equalTo(date));

    try {
        const snapshot = await get(dateQuery);
        if (!snapshot.exists()) return true; // No reservations on this date, so slot is available

        const data = snapshot.val();
        for (const key in data) {
            const reservation = data[key] as Reservation;
            if (reservation.date === date && reservation.time === time) {
                // Slot is taken. Is it by the current user?
                if (currentUserId && reservation.userId === currentUserId) {
                    return true; // User is allowed to 'rebook' their own slot (caller handles delete+create)
                }
                return false; // Slot is booked by someone else
            }
        }
        return true; // Loop finished without finding a conflicting booking
    } catch (error) {
        console.error(`Error checking availability for slot ${date} ${time}:`, error);
        return false; // Assume unavailable on error to be safe
    }
};

/**
 * Retrieves the reservation for a specific user on a specific date, if one exists.
 */
export const getUserReservationForDate = async (userId: string, date: string): Promise<Reservation | null> => {
    const reservationsRef = ref(db, 'reservations');
    // Query requires index on ['userId', 'date'] for efficiency
    const userReservationsQuery = query(reservationsRef, orderByChild('userId'), equalTo(userId));

    try {
        const snapshot = await get(userReservationsQuery);
        if (!snapshot.exists()) return null;

        let foundReservation: Reservation | null = null;
        snapshot.forEach((childSnapshot) => {
            const reservation = childSnapshot.val() as Reservation;
            const reservationId = childSnapshot.key;
            if (reservation.date === date) {
                // Ensure ID is correctly assigned
                foundReservation = { ...reservation, id: reservation.id || reservationId! };
                return true; // Exit .forEach loop early (Firebase specific behavior)
            }
        });
        return foundReservation;
    } catch (error) {
        console.error(`Error fetching reservation for user ${userId} on date ${date}:`, error);
        return null; // Return null on error
    }
};


// --- User Profile (Phone Number) Functions ---

/**
 * Saves or updates the user's profile, including their phone number.
 */
export const saveUserPhoneNumber = async (userId: string, phoneNumber: string, displayName: string, email: string | null): Promise<void> => {
  const userProfileRef = ref(db, `userProfiles/${userId}`);
  const profileData: UserProfile = {
    uid: userId,
    displayName: displayName || "User", // Provide default display name
    email: email,
    phone: phoneNumber
  };
  try {
    await set(userProfileRef, profileData);
    console.log(`User profile for ${userId} saved successfully.`);
  } catch (error) {
      console.error(`Error saving user profile for ${userId}:`, error);
      throw error;
  }
};

/**
 * Retrieves the phone number for a given user ID.
 * Checks the primary `userProfiles` path.
 */
export const getUserPhoneNumber = async (userId: string): Promise<string | undefined> => {
  const userProfilePhoneRef = ref(db, `userProfiles/${userId}/phone`);
  try {
    const snapshot = await get(userProfilePhoneRef);
    if (snapshot.exists()) {
      return snapshot.val();
    }
    // Optional: Add fallback check to old 'users/' path if migration occurred
    // const oldPathRef = ref(db, `users/${userId}/phone`);
    // const oldSnapshot = await get(oldPathRef);
    // if (oldSnapshot.exists()) return oldSnapshot.val();

    return undefined; // Phone number not found
  } catch (error) {
      console.error(`Error fetching phone number for user ${userId}:`, error);
      return undefined; // Return undefined on error
  }
};


// --- Barber News Functions ---

/**
 * Posts a new message to the barber news feed.
 * Uses Firebase server timestamp.
 */
export const postBarberNews = async (message: string): Promise<string> => {
  const newsRef: DatabaseReference = ref(db, 'barberNews');
  const newNewsItemRef = push(newsRef); // Generate ID
  const newNewsId = newNewsItemRef.key;

  if (!newNewsId) {
    throw new Error("Failed to generate ID for new news item.");
  }

  const newsItem: Omit<BarberNews, 'id'> = {
    message: message,
    timestamp: serverTimestamp() // Use Firebase server timestamp
  };

  try {
    await set(newNewsItemRef, newsItem);
    console.log(`News item ${newNewsId} posted successfully.`);
    // No need to set ID separately here as rules don't require it in the object for news
    return newNewsId;
  } catch (error) {
      console.error(`Error posting news item ${newNewsId}:`, error);
      throw error;
  }
};

/**
 * Listens for the latest barber news item based on timestamp.
 * @param callback Function to execute with the latest news item (or null if none).
 * @returns An unsubscribe function.
 */
export const getLatestBarberNews = (callback: (news: BarberNews | null) => void): () => void => {
  const newsRef: DatabaseReference = ref(db, 'barberNews');
  // Query requires index on 'timestamp' in Firebase rules
  const latestNewsQuery = query(newsRef, orderByChild('timestamp'), limitToLast(1));

  const unsubscribe = onValue(latestNewsQuery, (snapshot) => {
    let latestNews: BarberNews | null = null;
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        // Extract data and include the ID
        latestNews = { ...childSnapshot.val(), id: childSnapshot.key } as BarberNews;
      });
    }
    callback(latestNews);
  }, (error) => {
      // Handle potential read errors (e.g., permission denied if rules change)
      console.error("Error fetching latest barber news:", error);
      callback(null); // Pass null on error
  });

  return unsubscribe;
};


// --- Blocked Days Functions (NEW) ---

/**
 * Listens for changes to the blocked days list.
 * @param callback Function to call with the set of blocked date strings (YYYY-MM-DD).
 * @returns Unsubscribe function.
 */
export const getBlockedDays = (callback: (blockedDays: Set<string>) => void): () => void => {
  const blockedDaysRef = ref(db, 'blockedDays');
  const unsubscribe = onValue(blockedDaysRef, (snapshot) => {
    const data = snapshot.val();
    const blockedSet = new Set<string>();
    if (data) {
      Object.keys(data).forEach((dateString) => {
        // Validate format and ensure value is true (as per rules)
        if (data[dateString] === true && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            blockedSet.add(dateString);
        } else if (data[dateString] !== true) {
            // Data exists but isn't 'true', log warning/ignore (shouldn't happen with rules)
             console.warn(`Blocked day entry for ${dateString} is not 'true', ignoring.`);
        } else {
             console.warn(`Invalid date format key found in blockedDays: ${dateString}, ignoring.`);
        }
      });
    }
    callback(blockedSet);
  }, (error) => {
      console.error("Error fetching blocked days:", error);
      callback(new Set<string>()); // Return empty set on error
  });
  return unsubscribe;
};

/**
 * Blocks a specific day by adding its YYYY-MM-DD string as a key with value `true`.
 * @param dateString Date in YYYY-MM-DD format.
 */
export const blockDay = async (dateString: string): Promise<void> => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      console.error("Invalid date format provided to blockDay:", dateString);
      throw new Error("Invalid date format. Use YYYY-MM-DD.");
  }
  const blockedDayRef = ref(db, `blockedDays/${dateString}`);
  try {
    await set(blockedDayRef, true); // Store 'true' to indicate blocked
    console.log(`Date ${dateString} blocked successfully.`);
  } catch (error) {
      console.error(`Error blocking day ${dateString}:`, error);
      throw error;
  }
};

/**
 * Unblocks a specific day by removing its key from the `blockedDays` path.
 * @param dateString Date in YYYY-MM-DD format.
 */
export const unblockDay = async (dateString: string): Promise<void> => {
   if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      console.error("Invalid date format provided to unblockDay:", dateString);
      throw new Error("Invalid date format. Use YYYY-MM-DD.");
  }
  const blockedDayRef = ref(db, `blockedDays/${dateString}`);
  try {
    await remove(blockedDayRef);
    console.log(`Date ${dateString} unblocked successfully.`);
  } catch (error) {
      console.error(`Error unblocking day ${dateString}:`, error);
      throw error;
  }
};


// --- Firebase Authentication Functions ---
const googleProvider = new GoogleAuthProvider();

/**
 * Initiates the Google Sign-In popup flow.
 */
export const signInWithGoogle = async (): Promise<User> => {
  try {
    const result = await signInWithPopup(authInstance, googleProvider);
    console.log("Google Sign-In successful for user:", result.user.uid);
    // Optional: Update basic user info here if needed, but phone requires separate flow
    // await saveUserPhoneNumber(result.user.uid, '', result.user.displayName || 'User', result.user.email); // Don't save empty phone
    return result.user;
  } catch (error: any) {
    // Handle specific auth errors if needed (e.g., popup closed, network error)
    console.error("Google Sign-In Error:", error);
    // You might want to map error codes to user-friendly messages here
    // Example: if (error.code === 'auth/popup-closed-by-user') { ... }
    throw error; // Re-throw for the caller (LoginPage) to handle UI feedback
  }
};

/**
 * Signs the current user out.
 */
export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(authInstance);
    console.log("User signed out successfully.");
  } catch (error) {
    console.error("Sign Out Error:", error);
    throw error;
  }
};

/**
 * Wrapper around Firebase's onAuthStateChanged to listen for authentication state changes.
 * @param callback Function to execute when the auth state changes, receiving the User object or null.
 * @returns Firebase unsubscribe function.
 */
export const onAuthStateChanged = (callback: (user: User | null) => void): (() => void) => {
  // Pass the callback directly to Firebase's listener
  return firebaseOnAuthStateChanged(authInstance, callback);
};