// src/App.tsx
import React, { useState, useEffect } from 'react';
import { LoginPage } from './components/LoginPage';
import { ClientPage } from './components/ClientPage';
import { AdminDashboard } from './components/AdminDashboard';
import './App.css'; // Global styles
import {
  getReservations,
  createReservation,
  deleteReservation,
  getUserReservationForDate,
  isTimeSlotAvailable,
  Reservation,
  saveUserPhoneNumber,
  getUserPhoneNumber,
  getLatestBarberNews,
  BarberNews,
  signOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
} from './services/firebase-service';
import { User } from 'firebase/auth';

const ADMIN_UID = 'X6IZj1LMNKfZIZlwQud23U5mzhC3'; // <<< IMPORTANT: SET THIS

const getCurrentDate = (offset: number = 0) => {
  const today = new Date();
  today.setDate(today.getDate() + offset);
  return today.toISOString().split('T')[0];
};

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
    if (cleanedPhone.startsWith('972') && cleanedPhone.length > 9) {
        cleanedPhone = cleanedPhone.substring(3);
    }

    if (!israeliPhoneRegex.test(cleanedPhone)) {
      setError('Please enter a valid Israeli mobile number (e.g., 501234567).');
      return;
    }
    const normalizedPhoneForDB = cleanedPhone.startsWith('5') && cleanedPhone.length === 9 ? '0' + cleanedPhone : cleanedPhone;
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
            type="tel"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ''))}
            placeholder="5X XXX XXXX"
            className="phone-actual-input-modal"
          />
        </div>
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-actions">
            <button onClick={handleSubmit} className="modal-button primary">
            {isUpdating ? "Update" : "Save Phone Number"}
            </button>
            {onCancel && (
            <button onClick={onCancel} className="modal-button secondary">
                Cancel
            </button>
            )}
        </div>
      </div>
    </div>
  );
};


const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userPhone, setUserPhone] = useState<string | undefined>(undefined);
  const [page, setPage] = useState<'login' | 'client' | 'admin' | 'get_phone'>('login');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [latestNews, setLatestNews] = useState<BarberNews | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDate());
  const [loading, setLoading] = useState<boolean>(true);
  const [showPhoneUpdateModal, setShowPhoneUpdateModal] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubscribeAuth = firebaseOnAuthStateChanged(async (userAuth) => { // Renamed param to userAuth to avoid conflict
      if (userAuth) {
        setCurrentUser(userAuth); // This sets the state, triggering dependent logic
        const phone = await getUserPhoneNumber(userAuth.uid);
        setUserPhone(phone);
        if (userAuth.uid === ADMIN_UID) {
            setPage('admin');
        } else if (phone) {
            setPage('client');
        } else {
            setPage('get_phone');
        }
      } else {
        setCurrentUser(null);
        setUserPhone(undefined);
        setPage('login');
        setReservations([]);
        setLatestNews(null);
      }
      setLoading(false);
    });

    let unsubscribeReservations: (() => void) | null = null;
    if (currentUser) {
      unsubscribeReservations = getReservations((fetchedReservations) => {
        setReservations(fetchedReservations);
      });
    }

    const unsubscribeNews = getLatestBarberNews((news) => {
      setLatestNews(news);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeReservations) unsubscribeReservations();
      unsubscribeNews();
    };
  }, [currentUser]); // useEffect depends on currentUser

  // Corrected: 'user' param is passed to setCurrentUser which triggers useEffect
  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    // The useEffect listening to `currentUser` will handle fetching phone,
    // setting page, and managing loading state.
  };

  const handlePhoneSubmit = async (phone: string) => {
    if (currentUser) {
      setLoading(true);
      await saveUserPhoneNumber(currentUser.uid, phone, currentUser.displayName || "User", currentUser.email);
      setUserPhone(phone);
      if (currentUser.uid === ADMIN_UID) {
          setPage('admin');
      } else {
          setPage('client');
      }
      setShowPhoneUpdateModal(false);
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true); // Indicate an action is happening
    await signOut();
    // The onAuthStateChanged listener in useEffect will handle state cleanup (currentUser, page, etc.)
    // and setting loading to false.
  };

  const generateNextFiveDays = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return Array.from({ length: 5 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + i);
      return {
        day: days[date.getDay()],
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: date.toISOString().split('T')[0]
      };
    });
  };

  const handleReservation = async (time: string) => {
    if (!currentUser || !userPhone) {
      alert("Please make sure you are logged in and have provided a phone number.");
      return;
    }
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      if (selectedDate === today) {
        const currentTime = new Date();
        const timeMatch = time.match(/(\d+):(\d+)\s*([AP]M)/i);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          const ampm = timeMatch[3].toUpperCase();
          if (ampm === 'PM' && hours < 12) hours += 12;
          if (ampm === 'AM' && hours === 12) hours = 0;
          const appointmentTime = new Date(selectedDate);
          appointmentTime.setHours(hours, minutes, 0, 0);
          if (appointmentTime <= currentTime) {
            alert('Cannot book appointments in the past.');
            setLoading(false); return;
          }
        }
      }
      const isAvailable = await isTimeSlotAvailable(selectedDate, time, currentUser.uid);
      if (!isAvailable) {
         const userExistingReservationOnSlot = reservations.find(
            res => res.date === selectedDate && res.time === time && res.userId === currentUser.uid);
        if (!userExistingReservationOnSlot) {
            alert('This time slot is booked. Please select another.');
            setLoading(false); return;
        }
      }
      const existingReservation = await getUserReservationForDate(currentUser.uid, selectedDate);
      if (existingReservation && existingReservation.id) {
        await deleteReservation(existingReservation.id);
      }
      const newReservationData: Omit<Reservation, 'id'> = {
        name: currentUser.displayName || 'User',
        phone: userPhone, time, date: selectedDate, userId: currentUser.uid };
      await createReservation(newReservationData);
      alert(`Reservation confirmed for ${selectedDate} at ${time}`);
    } catch (error) {
      console.error("Error making reservation:", error);
      alert('Failed to make reservation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReservation = async (id: string) => {
    setLoading(true);
    try { await deleteReservation(id); }
    catch (error) { console.error("Error deleting reservation:", error); alert('Failed to delete reservation.');}
    finally { setLoading(false); }
  };

  const handleCancelUserReservation = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const userReservation = await getUserReservationForDate(currentUser.uid, selectedDate);
      if (userReservation && userReservation.id) {
        await deleteReservation(userReservation.id);
        alert('Your appointment has been cancelled.');
      } else {
        alert('No appointment found to cancel for the selected date.');
      }
    } catch (error) { console.error("Error cancelling reservation:", error); alert('Failed to cancel reservation.');}
    finally { setLoading(false); }
  };

  const availableTimes = [
    '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM',
    '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM',
    '5:00 PM', '5:30 PM' ];

  const getUserReservationForSelectedDate = () => {
    if (!currentUser) return null;
    return reservations.find(res => res.userId === currentUser.uid && res.date === selectedDate) || null;
  };
  const isReservedByCurrentUser = (time: string) => {
    const userReservation = getUserReservationForSelectedDate();
    return userReservation?.time === time;
  };
  const isReservedByOthers = (time: string) => {
    if (!currentUser) { return reservations.some(res => res.time === time && res.date === selectedDate); }
    return reservations.some(res => res.time === time && res.date === selectedDate && res.userId !== currentUser.uid);
  };

  if (loading) {
    return (
      <div className="app-loading-spinner">
        Loading Application...
      </div>
    );
  }

  return (
    <div>
      {page === 'login' && ( <LoginPage onAuthSuccess={handleAuthSuccess} setLoadingApp={setLoading} /> )}
      {page === 'get_phone' && currentUser && ( <PhoneInputModal onSubmit={handlePhoneSubmit} /> )}
      {showPhoneUpdateModal && currentUser && (
          <PhoneInputModal onSubmit={handlePhoneSubmit} onCancel={() => setShowPhoneUpdateModal(false)} currentPhone={userPhone} isUpdating={true} /> )}
      {page === 'client' && currentUser && userPhone && (
        <ClientPage
          latestBarberNews={latestNews}
          userName={currentUser.displayName || "Client"}
          availableTimes={availableTimes}
          userReservation={getUserReservationForSelectedDate()}
          handleReservation={handleReservation}
          cancelReservation={handleCancelUserReservation}
          goBack={handleSignOut}
          isReservedByCurrentUser={isReservedByCurrentUser}
          isReservedByOthers={isReservedByOthers}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          generateNextFiveDays={generateNextFiveDays}
          onUpdatePhoneNumber={() => setShowPhoneUpdateModal(true)}
        />
      )}
      {page === 'admin' && currentUser && ( // Admin also needs to be authenticated to reach here
        <AdminDashboard reservations={reservations} goBack={handleSignOut} onDeleteReservation={handleDeleteReservation} /> )}
    </div>
  );
};

export default App;