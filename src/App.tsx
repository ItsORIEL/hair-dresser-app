// src/App.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LoginPage } from './components/LoginPage';
import { ClientPage } from './components/ClientPage';
import { AdminDashboard } from './components/AdminDashboard';
import './App.css'; // Global styles
import {
  getReservations, createReservation, deleteReservation,
  getUserReservationForDate, isTimeSlotAvailable, Reservation,
  saveUserPhoneNumber, getUserPhoneNumber,
  getLatestBarberNews, BarberNews,
  signOut, onAuthStateChanged,
  getBlockedDays,
} from './services/firebase-service';
import { User } from 'firebase/auth';

const ADMIN_UID = 'X6IZj1LMNKfZIZlwQud23U5mzhC3';

const getCurrentDate = (offset: number = 0): string => {
  const today = new Date();
  today.setDate(today.getDate() + offset);
  return today.toISOString().split('T')[0];
};

// --- Phone Input Modal Component ---
interface PhoneInputProps {
  onSubmit: (phone: string) => void;
  onCancel?: () => void;
  currentPhone?: string;
  isUpdating?: boolean;
}
const PhoneInputModal: React.FC<PhoneInputProps> = ({ onSubmit, onCancel, currentPhone, isUpdating }) => {
    const [phoneInput, setPhoneInput] = useState(currentPhone?.startsWith('0') ? currentPhone.substring(1) : currentPhone || '');
    const [error, setError] = useState('');

    const handleSubmit = () => {
      const israeliPhoneRegex = /^(05\d{8}|5\d{8})$/;
      let cleanedPhone = phoneInput.replace(/\D/g, '');
      if (cleanedPhone.startsWith('972')) {
          cleanedPhone = cleanedPhone.substring(3);
      }

      if (!israeliPhoneRegex.test(cleanedPhone)) {
        if (cleanedPhone.startsWith('5') && cleanedPhone.length === 9) {
           // Normalization happens below
        } else {
            setError('Please enter a valid Israeli mobile number (e.g., 501234567 or 0501234567).');
            return;
        }
      }
      const normalizedPhoneForDB = cleanedPhone.startsWith('5') && cleanedPhone.length === 9 ? '0' + cleanedPhone : cleanedPhone;
      if (!/^(05\d{8})$/.test(normalizedPhoneForDB)) {
          setError('Invalid phone number format after normalization.');
          return;
      }
      onSubmit(normalizedPhoneForDB);
      setError('');
    };

    return (
      <div className="modal-overlay">
        <div className="modal-content phone-input-modal-content">
          <h3>{isUpdating ? "Update Your Phone Number" : "Please Enter Your Phone Number"}</h3>
          <p className="modal-subtitle">This will be used for your reservations.</p>
          <div className="phone-input-container-modal">
            <span className="phone-prefix-modal">+972</span>
            <input
              type="tel" value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ''))}
              placeholder="5X XXX XXXX" className="phone-actual-input-modal"
              maxLength={10} aria-required="true" aria-label="Mobile phone number (5X XXX XXXX)"
            />
          </div>
          {error && <p className="modal-error" role="alert">{error}</p>}
          <div className="modal-actions">
              <button onClick={handleSubmit} className="modal-button primary">
              {isUpdating ? "Update" : "Save Phone Number"}
              </button>
              {onCancel && ( <button onClick={onCancel} className="modal-button secondary"> Cancel </button> )}
          </div>
        </div>
      </div>
    );
};
// --- End Phone Input Modal ---


const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userPhone, setUserPhone] = useState<string | undefined>(undefined);
  const [page, setPage] = useState<'login' | 'client' | 'admin' | 'get_phone'>('login');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [latestNews, setLatestNews] = useState<BarberNews | null>(null);
  const [blockedDays, setBlockedDays] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDate());
  const [loading, setLoading] = useState<boolean>(true); // Start loading true for initial check
  const [showPhoneUpdateModal, setShowPhoneUpdateModal] = useState(false);

  // Make handleSignOut stable with useCallback
  const handleSignOut = useCallback(async () => {
    setLoading(true); // Show loading during sign out
    try {
      await signOut();
    } catch (error) {
      console.error("App: Sign out failed:", error);
      alert("Sign out failed. Please try again.");
      setLoading(false); // Ensure loading stops on error
    }
    // Listener handles state changes and setting loading false
  }, []); // Empty dependency array - function is stable


  // --- Effects for Listeners ---
  useEffect(() => {
    // --- Auth Listener ---
    const unsubscribeAuth = onAuthStateChanged(async (userAuth) => {
      setCurrentUser(userAuth); // Always update user state first
      let currentPage = page; // Temporary variable

      if (userAuth) {
        try {
          const phone = await getUserPhoneNumber(userAuth.uid);
          setUserPhone(phone); // Update phone state

          // Determine the target page
          if (userAuth.uid === ADMIN_UID) {
            currentPage = 'admin';
          } else if (phone) {
            currentPage = 'client';
          } else {
            currentPage = 'get_phone';
          }
          setPage(currentPage); // Update the actual page state

        } catch (error) {
          console.error("App: Error during post-auth setup:", error);
          alert("An error occurred while setting up your session. Please try logging in again.");
          await handleSignOut(); // Attempt to sign out cleanly on error
          currentPage = 'login'; // Ensure page is reset
          setPage(currentPage); // Update page state again after sign out attempt
        }
      } else {
        // User is logged out
        setCurrentUser(null);
        setUserPhone(undefined);
        setReservations([]); // Clear user-specific data
        currentPage = 'login';
        setPage(currentPage); // Update page state
      }
      // Set loading false AFTER all processing for this auth event is done
      setLoading(false);
    });

    // --- Data Listeners ---
    let unsubscribeReservations: (() => void) | null = null;
    // Subscribe to reservations only if user is logged in
    if (currentUser) {
      unsubscribeReservations = getReservations((fetchedReservations) => {
        setReservations(fetchedReservations);
      });
    }

    // Blocked Days Listener (Always on)
    const unsubscribeBlockedDays = getBlockedDays((days) => {
      setBlockedDays(days);
    });

    // News Listener (Always on)
    const unsubscribeNews = getLatestBarberNews((news) => {
      setLatestNews(news);
    });

    // --- Cleanup Function ---
    return () => {
      unsubscribeAuth();
      unsubscribeBlockedDays(); // Cleanup always-on listeners
      unsubscribeNews(); // Cleanup always-on listeners

      // Explicitly capture and check the reservation unsubscribe function
      const cleanupReservations = unsubscribeReservations;
      if (typeof cleanupReservations === 'function') { // Use typeof check as a strong type guard
        cleanupReservations();
      }
    };
  }, [currentUser, handleSignOut]); // Add stable handleSignOut to dependencies


  // --- Phone Number Management ---
  const handlePhoneSubmit = useCallback(async (phone: string) => {
    if (!currentUser) return;
    setLoading(true);
    try {
      await saveUserPhoneNumber(currentUser.uid, phone, currentUser.displayName || "User", currentUser.email);
      setUserPhone(phone);
      if (currentUser.uid !== ADMIN_UID) {
        setPage('client');
      } else {
        setPage('admin');
      }
      setShowPhoneUpdateModal(false);
    } catch (error) {
      console.error("App: Error saving phone number:", error);
      alert("Failed to save phone number. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);


  // --- Date Generation ---
  const generateNextFiveDays = useCallback(() => {
      const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const availableDates: { day: string, date: string, fullDate: string }[] = [];
      let count = 0; let offset = 0;
      const todayStr = getCurrentDate();
      while (count < 5 && offset < 30) {
        const date = new Date(); date.setDate(date.getDate() + offset);
        const dayIndex = date.getDay(); const fullDateStr = date.toISOString().split('T')[0];
        const isPast = fullDateStr < todayStr; const isSunday = dayIndex === 0;
        const isBlocked = blockedDays.has(fullDateStr);
        if (!isPast && !isSunday && !isBlocked) {
            availableDates.push({ day: daysOfWeek[dayIndex], date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), fullDate: fullDateStr });
            count++;
        } offset++;
      }
      const isSelectedDateValid = availableDates.some(d => d.fullDate === selectedDate);
      if (availableDates.length > 0 && !isSelectedDateValid) {
          setSelectedDate(availableDates[0].fullDate);
      } else if (availableDates.length === 0 && selectedDate !== '') {
           console.warn("App: No available booking dates found.");
           // Optionally clear selectedDate: setSelectedDate('');
      }
      return availableDates;
   }, [blockedDays, selectedDate]);


  // --- Reservation Management ---
  const handleReservation = useCallback(async (time: string) => {
       if (!currentUser || !userPhone) { alert("Please log in and ensure your phone number is saved."); return; }
       if (blockedDays.has(selectedDate)) { alert("This date is currently unavailable for booking."); return; }
       setLoading(true);
       try {
         const now = new Date(); const slotDateTime = new Date(`${selectedDate} ${time.replace(/(AM|PM)/, ' $1')}`);
         if (slotDateTime <= now) { alert('Cannot book appointments in the past.'); setLoading(false); return; }
         const isAvailable = await isTimeSlotAvailable(selectedDate, time, currentUser.uid);
         if (!isAvailable) { alert('This time slot has just been booked by another user. Please select another.'); setLoading(false); return; }
         const existingReservationOnDate = await getUserReservationForDate(currentUser.uid, selectedDate);
         if (existingReservationOnDate?.id) {
           await deleteReservation(existingReservationOnDate.id);
         }
         const newReservationData: Omit<Reservation, 'id'> = { name: currentUser.displayName || 'User', phone: userPhone, time: time, date: selectedDate, userId: currentUser.uid };
         await createReservation(newReservationData);
         alert(`Reservation confirmed for ${selectedDate} at ${time}`);
       } catch (error: any) { console.error("App: Error making reservation:", error); alert(`Failed to make reservation. ${error.message || 'Please try again.'}`);
       } finally { setLoading(false); }
   }, [currentUser, userPhone, selectedDate, blockedDays]); // Dependencies for handleReservation

  const handleDeleteReservation = useCallback(async (id: string) => {
       if (!id) { console.error("App: handleDeleteReservation invalid ID:", id); alert('Cannot delete reservation: Invalid ID.'); return; }
       setLoading(true);
       try { await deleteReservation(id); }
       catch (error: any) { console.error("App: Error deleting reservation:", error); alert(`Failed to delete reservation. ${error.message || ''}`); }
       finally { setLoading(false); }
   }, []); // Empty dependency - function is stable

  const handleCancelUserReservation = useCallback(async () => {
       if (!currentUser) return;
       setLoading(true);
       try {
         const userReservation = await getUserReservationForDate(currentUser.uid, selectedDate);
         if (userReservation?.id) { await deleteReservation(userReservation.id); alert('Your appointment for this date has been cancelled.'); }
         else { alert('No appointment found to cancel for the selected date.'); }
       } catch (error: any) { console.error("App: Error cancelling user reservation:", error); alert(`Failed to cancel reservation. ${error.message || ''}`); }
       finally { setLoading(false); }
   }, [currentUser, selectedDate]); // Dependencies


  // --- Available Times ---
  const availableTimes = useMemo(() => [
      '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM',
      '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM',
      '5:00 PM', '5:30 PM'
  ], []);

  // --- ClientPage Prop Helpers ---
  const getUserReservationForSelectedDate = useCallback(() => {
      if (!currentUser) return null; return reservations.find(res => res.userId === currentUser.uid && res.date === selectedDate) || null;
  }, [currentUser, reservations, selectedDate]);
  const isReservedByCurrentUser = useCallback((time: string): boolean => {
      const userReservation = getUserReservationForSelectedDate(); return !!userReservation && userReservation.time === time;
   }, [getUserReservationForSelectedDate]);
  const isReservedByOthers = useCallback((time: string): boolean => {
      return reservations.some(res => res.date === selectedDate && res.time === time && res.userId !== currentUser?.uid );
  }, [reservations, selectedDate, currentUser]);


  // --- Render Logic ---

  // Initial loading spinner
  if (loading && !currentUser && page === 'login') {
     return (
       <div className="app-loading-spinner">
         Loading Application...
       </div>
     );
  }

  return (
    <div id="app-container">
      {/* Page Rendering */}
      {page === 'login' && (
        <LoginPage setLoadingApp={setLoading} /> // Removed onAuthSuccess prop
      )}

      {page === 'get_phone' && currentUser && (
        <PhoneInputModal onSubmit={handlePhoneSubmit} onCancel={handleSignOut} />
      )}

      {showPhoneUpdateModal && currentUser && (
          <PhoneInputModal onSubmit={handlePhoneSubmit} onCancel={() => setShowPhoneUpdateModal(false)} currentPhone={userPhone} isUpdating={true} />
      )}

      {page === 'client' && currentUser && userPhone && (
        <ClientPage
          latestBarberNews={latestNews} userName={currentUser.displayName || "Client"}
          availableTimes={availableTimes} userReservation={getUserReservationForSelectedDate()}
          handleReservation={handleReservation} cancelReservation={handleCancelUserReservation}
          goBack={handleSignOut} isReservedByCurrentUser={isReservedByCurrentUser}
          isReservedByOthers={isReservedByOthers} selectedDate={selectedDate}
          setSelectedDate={setSelectedDate} generateNextFiveDays={generateNextFiveDays}
          onUpdatePhoneNumber={() => setShowPhoneUpdateModal(true)} blockedDays={blockedDays}
        />
      )}

      {page === 'admin' && currentUser && (
        <AdminDashboard reservations={reservations} goBack={handleSignOut} onDeleteReservation={handleDeleteReservation} />
      )}

      {/* Action Loading Overlay */}
      {loading && page !== 'login' && (
         <div className="modal-overlay action-loading-overlay">
            <div className="action-loading-content">Processing...</div>
         </div>
       )}
    </div>
  );
};

export default App;