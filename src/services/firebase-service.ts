import { getDatabase, ref, set, onValue, remove, push, get, child } from "firebase/database";
import app from "../firebase";

// Define Reservation type
export interface Reservation {
  name: string;
  phone: string;
  time: string;
  date: string;
  id?: string;
}

// Get reference to the database
const database = getDatabase(app);

// Create a reservation
export const createReservation = async (reservation: Reservation): Promise<string> => {
  // Generate a unique ID if one isn't provided
  const reservationsRef = ref(database, 'reservations');
  const newReservationRef = push(reservationsRef);
  const newReservationId = newReservationRef.key || '';
  
  // Add the ID to the reservation object
  const reservationWithId = { ...reservation, id: newReservationId };
  
  // Save to Firebase
  await set(newReservationRef, reservationWithId);
  return newReservationId;
};

// Get all reservations
export const getReservations = (callback: (reservations: Reservation[]) => void): () => void => {
  const reservationsRef = ref(database, 'reservations');
  
  // Listen for changes
  const unsubscribe = onValue(reservationsRef, (snapshot) => {
    const data = snapshot.val();
    const reservationsList: Reservation[] = [];
    
    if (data) {
      Object.keys(data).forEach((key) => {
        reservationsList.push({
          ...data[key],
          id: key
        });
      });
    }
    
    callback(reservationsList);
  });
  
  // Return unsubscribe function
  return unsubscribe;
};

// Delete a reservation
export const deleteReservation = async (reservationId: string): Promise<void> => {
  const reservationRef = ref(database, `reservations/${reservationId}`);
  await remove(reservationRef);
};

// Check if time slot is available
export const isTimeSlotAvailable = async (date: string, time: string, excludeUser?: { name: string, phone: string }): Promise<boolean> => {
  const reservationsRef = ref(database, 'reservations');
  const snapshot = await get(reservationsRef);
  
  if (!snapshot.exists()) {
    return true;
  }
  
  const data = snapshot.val();
  
  // Check if this timeslot is already booked
  for (const key in data) {
    const reservation = data[key];
    if (reservation.date === date && reservation.time === time) {
      // If we're checking for a specific user's existing reservation, exclude it
      if (excludeUser && 
          reservation.name === excludeUser.name && 
          reservation.phone === excludeUser.phone) {
        continue;
      }
      return false; // Time slot is already booked
    }
  }
  
  return true; // Time slot is available
};

// Update existing reservation
export const updateReservation = async (reservationId: string, updatedData: Partial<Reservation>): Promise<void> => {
  const reservationRef = ref(database, `reservations/${reservationId}`);
  
  // Get current data first
  const snapshot = await get(reservationRef);
  if (!snapshot.exists()) {
    throw new Error("Reservation not found");
  }
  
  const currentData = snapshot.val();
  const newData = { ...currentData, ...updatedData };
  
  // Update in Firebase
  await set(reservationRef, newData);
};

// Get user reservation for a specific date
export const getUserReservationForDate = async (name: string, phone: string, date: string): Promise<Reservation | null> => {
  const reservationsRef = ref(database, 'reservations');
  const snapshot = await get(reservationsRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  const data = snapshot.val();
  
  for (const key in data) {
    const reservation = data[key];
    if (reservation.name === name && 
        reservation.phone === phone && 
        reservation.date === date) {
      return { ...reservation, id: key };
    }
  }
  
  return null;
};