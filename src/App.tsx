// src/App.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LoginPage } from './components/LoginPage';
import { ClientPage } from './components/ClientPage';
import { AdminDashboard } from './components/AdminDashboard';
import './App.css'; // Global styles
import { authInstance } from './firebase'; // Import authInstance
import {
  getReservations, createReservation, deleteReservation,
  getUserReservationForDate, isTimeSlotAvailable, Reservation,
  saveUserPhoneNumber, getUserPhoneNumber,
  getLatestBarberNews, BarberNews,
  signOut, onAuthStateChanged, // Named import is correct
  getBlockedDays,
  getBlockedTimeSlots, BlockedTimeSlotsMap
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
      if (cleanedPhone.startsWith('972')) { cleanedPhone = cleanedPhone.substring(3); }
      if (!israeliPhoneRegex.test(cleanedPhone)) {
        if (cleanedPhone.startsWith('5') && cleanedPhone.length === 9) { /* Allow normalization */ }
        else { setError('Please enter a valid Israeli mobile number (e.g., 501234567 or 0501234567).'); return; }
      }
      const normalizedPhoneForDB = cleanedPhone.startsWith('5') && cleanedPhone.length === 9 ? '0' + cleanedPhone : cleanedPhone;
      if (!/^(05\d{8})$/.test(normalizedPhoneForDB)) { setError('Invalid phone number format after normalization.'); return; }
      onSubmit(normalizedPhoneForDB); setError('');
    };
    return (
      <div className="modal-overlay">
        <div className="modal-content phone-input-modal-content">
          <h3>{isUpdating ? "Update Your Phone Number" : "Please Enter Your Phone Number"}</h3>
          <p className="modal-subtitle">This will be used for your reservations.</p>
          <div className="phone-input-container-modal"> <span className="phone-prefix-modal">+972</span> <input type="tel" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ''))} placeholder="5X XXX XXXX" className="phone-actual-input-modal" maxLength={10} aria-required="true" aria-label="Mobile phone number (5X XXX XXXX)" /> </div>
          {error && <p className="modal-error" role="alert">{error}</p>}
          <div className="modal-actions"> <button onClick={handleSubmit} className="modal-button primary"> {isUpdating ? "Update" : "Save Phone Number"} </button> {onCancel && ( <button onClick={onCancel} className="modal-button secondary"> Cancel </button> )} </div>
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
  const [blockedTimeSlots, setBlockedTimeSlots] = useState<BlockedTimeSlotsMap>(new Map());
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDate());
  const [loading, setLoading] = useState<boolean>(true);
  const [showPhoneUpdateModal, setShowPhoneUpdateModal] = useState(false);

  const handleSignOut = useCallback(async () => {
    setLoading(true);
    try { await signOut(); }
    catch (error) { console.error("App: Sign out failed:", error); alert("Sign out failed."); setLoading(false); }
  }, []);

  useEffect(() => {
    // --- Auth Listener ---
    // ***** Pass authInstance as the first argument *****
    const unsubscribeAuth = onAuthStateChanged(authInstance, async (userAuth) => {
      setCurrentUser(userAuth);
      let currentPage = page;
      if (userAuth) {
        try {
          const phone = await getUserPhoneNumber(userAuth.uid);
          setUserPhone(phone);
          if (userAuth.uid === ADMIN_UID) { currentPage = 'admin'; }
          else if (phone) { currentPage = 'client'; }
          else { currentPage = 'get_phone'; }
          setPage(currentPage);
        } catch (error) {
          console.error("App: Error during post-auth setup:", error);
          alert("Error setting up session.");
          await handleSignOut();
          currentPage = 'login';
          setPage(currentPage);
        }
      } else {
        setCurrentUser(null); setUserPhone(undefined); setReservations([]);
        currentPage = 'login'; setPage(currentPage);
      }
      setLoading(false);
    });

    // --- Data Listeners ---
    let unsubscribeReservations: (() => void) | null = null;
    if (currentUser) {
      unsubscribeReservations = getReservations(setReservations);
    }

    const unsubscribeBlockedDays = getBlockedDays(setBlockedDays);
    const unsubscribeNews = getLatestBarberNews(setLatestNews);
    const unsubscribeBlockedTimeSlots = getBlockedTimeSlots(setBlockedTimeSlots);

    // --- Cleanup Function ---
    return () => {
      unsubscribeAuth();
      unsubscribeBlockedDays();
      unsubscribeNews();
      unsubscribeBlockedTimeSlots();
      const cleanupReservations = unsubscribeReservations;
      if (typeof cleanupReservations === 'function') { cleanupReservations(); }
    };
  }, [currentUser, handleSignOut]); // Dependency on currentUser is correct here

  const handlePhoneSubmit = useCallback(async (phone: string) => {
    if (!currentUser) return;
    setLoading(true);
    try {
      await saveUserPhoneNumber(currentUser.uid, phone, currentUser.displayName || "User", currentUser.email);
      setUserPhone(phone);
      if (currentUser.uid !== ADMIN_UID) { setPage('client'); } else { setPage('admin'); }
      setShowPhoneUpdateModal(false);
    } catch (error) { console.error("App: Error saving phone number:", error); alert("Failed to save phone number.");
    } finally { setLoading(false); }
  }, [currentUser]);

  const generateNextFiveDays = useCallback(() => {
      const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const availableDates: { day: string, date: string, fullDate: string }[] = [];
      let count = 0; let offset = 0; const todayStr = getCurrentDate();
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
      if (availableDates.length > 0 && !isSelectedDateValid) { setSelectedDate(availableDates[0].fullDate); }
      else if (availableDates.length === 0 && selectedDate !== '') { console.warn("App: No available booking dates found."); }
      return availableDates;
   }, [blockedDays, selectedDate]);

  const handleReservation = useCallback(async (time: string) => {
       if (!currentUser || !userPhone) { alert("Please log in and ensure phone number is saved."); return; }
       if (blockedDays.has(selectedDate)) { alert("This date is currently unavailable."); return; }
       if (blockedTimeSlots.get(selectedDate)?.has(time)) { alert(`The time slot ${time} is currently blocked.`); return; }
       setLoading(true);
       try {
         const now = new Date(); const slotDateTime = new Date(`${selectedDate} ${time.replace(/(AM|PM)/, ' $1')}`);
         if (slotDateTime <= now) { alert('Cannot book appointments in the past.'); setLoading(false); return; }
         const isAvailable = await isTimeSlotAvailable(selectedDate, time, currentUser.uid);
         if (!isAvailable) { alert('This time slot has just been booked.'); setLoading(false); return; }
         const existing = await getUserReservationForDate(currentUser.uid, selectedDate);
         if (existing?.id) { await deleteReservation(existing.id); }
         const newData: Omit<Reservation, 'id'> = { name: currentUser.displayName || 'User', phone: userPhone, time, date: selectedDate, userId: currentUser.uid };
         await createReservation(newData);
         alert(`Reservation confirmed for ${selectedDate} at ${time}`);
       } catch (error: any) { console.error("App: Error making reservation:", error); alert(`Failed to make reservation. ${error.message || ''}`);
       } finally { setLoading(false); }
   }, [currentUser, userPhone, selectedDate, blockedDays, blockedTimeSlots]);

  const handleDeleteReservation = useCallback(async (id: string) => {
       if (!id) { alert('Cannot delete reservation: Invalid ID.'); return; }
       setLoading(true);
       try { await deleteReservation(id); }
       catch (error: any) { console.error("App: Error deleting reservation:", error); alert(`Failed to delete reservation. ${error.message || ''}`); }
       finally { setLoading(false); }
   }, []);

  const handleCancelUserReservation = useCallback(async () => {
       if (!currentUser) return;
       setLoading(true);
       try {
         const userRes = await getUserReservationForDate(currentUser.uid, selectedDate);
         if (userRes?.id) { await deleteReservation(userRes.id); alert('Appointment cancelled.'); }
         else { alert('No appointment found to cancel for this date.'); }
       } catch (error: any) { console.error("App: Error cancelling user reservation:", error); alert(`Failed to cancel reservation. ${error.message || ''}`); }
       finally { setLoading(false); }
   }, [currentUser, selectedDate]);

  const availableTimes = useMemo(() => [
      '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM',
      '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM',
      '5:00 PM', '5:30 PM'
  ], []);

  const getUserReservationForSelectedDate = useCallback(() => {
      if (!currentUser) return null; return reservations.find(res => res.userId === currentUser.uid && res.date === selectedDate) || null;
  }, [currentUser, reservations, selectedDate]);
  const isReservedByCurrentUser = useCallback((time: string): boolean => {
      const userRes = getUserReservationForSelectedDate(); return !!userRes && userRes.time === time;
   }, [getUserReservationForSelectedDate]);
  const isReservedByOthers = useCallback((time: string): boolean => {
      return reservations.some(res => res.date === selectedDate && res.time === time && res.userId !== currentUser?.uid );
  }, [reservations, selectedDate, currentUser]);

  if (loading && !currentUser && page === 'login') {
     return ( <div className="app-loading-spinner"> Loading Application... </div> );
  }

  return (
    <div id="app-container">
      {page === 'login' && ( <LoginPage setLoadingApp={setLoading} /> )}
      {page === 'get_phone' && currentUser && ( <PhoneInputModal onSubmit={handlePhoneSubmit} onCancel={handleSignOut} /> )}
      {showPhoneUpdateModal && currentUser && ( <PhoneInputModal onSubmit={handlePhoneSubmit} onCancel={() => setShowPhoneUpdateModal(false)} currentPhone={userPhone} isUpdating={true} /> )}
      {page === 'client' && currentUser && userPhone && (
        <ClientPage
          latestBarberNews={latestNews} userName={currentUser.displayName || "Client"}
          availableTimes={availableTimes} userReservation={getUserReservationForSelectedDate()}
          handleReservation={handleReservation} cancelReservation={handleCancelUserReservation}
          goBack={handleSignOut} isReservedByCurrentUser={isReservedByCurrentUser}
          isReservedByOthers={isReservedByOthers} selectedDate={selectedDate}
          setSelectedDate={setSelectedDate} generateNextFiveDays={generateNextFiveDays}
          onUpdatePhoneNumber={() => setShowPhoneUpdateModal(true)} blockedDays={blockedDays}
          blockedTimeSlots={blockedTimeSlots}
        />
      )}
      {page === 'admin' && currentUser && ( <AdminDashboard reservations={reservations} goBack={handleSignOut} onDeleteReservation={handleDeleteReservation} /> )}
      {loading && page !== 'login' && ( <div className="modal-overlay action-loading-overlay"> <div className="action-loading-content">Processing...</div> </div> )}
    </div>
  );
};

export default App;