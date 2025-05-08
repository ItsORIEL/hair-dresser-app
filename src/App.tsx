// src/App.tsx
import React, { useState, useEffect } from 'react';
import { LoginPage } from './components/LoginPage';
import { ClientPage } from './components/ClientPage';
import { AdminDashboard } from './components/AdminDashboard';
import './App.css';
import {
  getReservations,
  createReservation,
  deleteReservation,
  getUserReservationForDate,
  isTimeSlotAvailable,
  Reservation,
  saveUserPhoneNumber,
  getUserPhoneNumber,
  signOut,
  onAuthStateChanged as firebaseOnAuthStateChanged, // Renamed to avoid conflict
} from './services/firebase-service';
import { User } from 'firebase/auth'; // Firebase User type

// Admin UID - replace with Admin actual UID after he signs in once
const ADMIN_UID = 'X6IZj1LMNKfZIZlwQud23U5mzhC3'; // IMPORTANT!

const getCurrentDate = (offset: number = 0) => {
  const today = new Date();
  today.setDate(today.getDate() + offset);
  return today.toISOString().split('T')[0];
};

// Component to ask for phone number
interface PhoneInputProps {
  onSubmit: (phone: string) => void;
  onCancel?: () => void; // Optional: if user can skip/cancel
  currentPhone?: string;
  isUpdating?: boolean;
}

const PhoneInputModal: React.FC<PhoneInputProps> = ({ onSubmit, onCancel, currentPhone, isUpdating }) => {
  const [phoneInput, setPhoneInput] = useState(currentPhone || '');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    // Basic validation (you can make this more robust)
    const israeliPhoneRegex = /^(05\d{8}|5\d{8})$/; // e.g., 0501234567 or 501234567
    const cleanedPhone = phoneInput.replace(/\D/g, ''); // Remove non-digits

    if (!israeliPhoneRegex.test(cleanedPhone)) {
      setError('Please enter a valid Israeli mobile number (e.g., 0501234567 or 501234567).');
      return;
    }
    // Normalize to start with '05' if it starts with '5'
    const normalizedPhone = cleanedPhone.startsWith('5') && cleanedPhone.length === 9 ? '0' + cleanedPhone : cleanedPhone;
    onSubmit(normalizedPhone);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
      justifyContent: 'center', alignItems: 'center', zIndex: 2000
    }}>
      <div style={{ padding: '30px', backgroundColor: 'white', borderRadius: '10px', textAlign: 'center', boxShadow: '0 5px 15px rgba(0,0,0,0.3)' }}>
        <h3>{isUpdating ? "Update Your Phone Number" : "Please Enter Your Phone Number"}</h3>
        <p style={{fontSize: '0.9em', color: '#666', marginBottom: '15px'}}>This will be used for your reservations.</p>
        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #ccc', borderRadius: '5px', paddingLeft: '10px', marginBottom: '10px' }}>
          <span style={{ color: '#888' }}>+972</span>
          <input
            type="tel"
            value={phoneInput.startsWith('0') ? phoneInput.substring(1) : phoneInput} // Display without leading 0 if present
            onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ''))}
            placeholder="5X XXX XXXX"
            style={{ border: 'none', padding: '10px', fontSize: '1em', outline: 'none', flexGrow: 1}}
          />
        </div>
        {error && <p style={{ color: 'red', fontSize: '0.8em', marginBottom: '10px' }}>{error}</p>}
        <button onClick={handleSubmit} style={{ padding: '10px 20px', backgroundColor: '#4a90e2', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', marginRight: '10px' }}>
          {isUpdating ? "Update" : "Save Phone Number"}
        </button>
        {onCancel && (
          <button onClick={onCancel} style={{ padding: '10px 20px', backgroundColor: '#ccc', color: 'black', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};


const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userPhone, setUserPhone] = useState<string | undefined>(undefined);
  const [page, setPage] = useState<'login' | 'client' | 'admin' | 'get_phone'>('login');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDate());
  const [loading, setLoading] = useState<boolean>(true); // Start true for auth check
  const [showPhoneUpdateModal, setShowPhoneUpdateModal] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubscribeAuth = firebaseOnAuthStateChanged(async (user) => {
      if (user) {
        setCurrentUser(user);
        const phone = await getUserPhoneNumber(user.uid);
        setUserPhone(phone);
        if (phone) {
          setPage(user.uid === ADMIN_UID ? 'admin' : 'client');
        } else {
          setPage('get_phone'); // New user, needs to provide phone
        }
      } else {
        setCurrentUser(null);
        setUserPhone(undefined);
        setPage('login');
      }
      setLoading(false);
    });

    // Only subscribe to reservations if a user is logged in (or for admin)
    let unsubscribeReservations: (() => void) | null = null;
    if (currentUser || page === 'admin') { // Simplified: always get all reservations if admin potentially
        unsubscribeReservations = getReservations((fetchedReservations) => {
        setReservations(fetchedReservations);
      });
    }


    return () => {
      unsubscribeAuth();
      if (unsubscribeReservations) unsubscribeReservations();
    };
  }, [currentUser]); // Re-run when currentUser changes

  const handleAuthSuccess = async (user: User) => {
    setLoading(true);
    setCurrentUser(user);
    const phone = await getUserPhoneNumber(user.uid);
    setUserPhone(phone);
    if (phone) {
      setPage(user.uid === ADMIN_UID ? 'admin' : 'client');
    } else {
      setPage('get_phone');
    }
    setLoading(false);
  };

  const handlePhoneSubmit = async (phone: string) => {
    if (currentUser) {
      setLoading(true);
      await saveUserPhoneNumber(currentUser.uid, phone, currentUser.displayName || "User", currentUser.email);
      setUserPhone(phone);
      setPage(currentUser.uid === ADMIN_UID ? 'admin' : 'client');
      setShowPhoneUpdateModal(false); // Close modal if it was open for update
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    await signOut();
    setCurrentUser(null);
    setUserPhone(undefined);
    setPage('login');
    setReservations([]); // Clear reservations on sign out
    setLoading(false);
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
            setLoading(false);
            return;
          }
        }
      }

      const isAvailable = await isTimeSlotAvailable(selectedDate, time, currentUser.uid);
      if (!isAvailable) {
         const userExistingReservationOnSlot = reservations.find(
            res => res.date === selectedDate &&
                   res.time === time &&
                   res.userId === currentUser.uid
        );
        if (!userExistingReservationOnSlot) {
            alert('This time slot is booked. Please select another.');
            setLoading(false);
            return;
        }
      }

      const existingReservation = await getUserReservationForDate(currentUser.uid, selectedDate);
      if (existingReservation && existingReservation.id) {
        await deleteReservation(existingReservation.id);
      }

      const newReservationData: Omit<Reservation, 'id'> = {
        name: currentUser.displayName || 'User',
        phone: userPhone,
        time,
        date: selectedDate,
        userId: currentUser.uid
      };
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
    try {
      await deleteReservation(id);
    } catch (error) {
      console.error("Error deleting reservation:", error);
      alert('Failed to delete reservation.');
    } finally {
      setLoading(false);
    }
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
    } catch (error) {
      console.error("Error cancelling reservation:", error);
      alert('Failed to cancel reservation.');
    } finally {
      setLoading(false);
    }
  };

  const availableTimes = [
    '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
    '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM',
    '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM',
    '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM',
    '5:00 PM', '5:30 PM'
  ];

  const getUserReservationForSelectedDate = () => {
    if (!currentUser) return null;
    return reservations.find(
      res => res.userId === currentUser.uid && res.date === selectedDate
    ) || null;
  };

  const isReservedByCurrentUser = (time: string) => {
    const userReservation = getUserReservationForSelectedDate();
    return userReservation?.time === time;
  };

  const isReservedByOthers = (time: string) => {
    if (!currentUser) { // If no user, consider all bookings by others
        return reservations.some(res => res.time === time && res.date === selectedDate);
    }
    return reservations.some(
      res => res.time === time && res.date === selectedDate && res.userId !== currentUser.uid
    );
  };


  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '1.5em' }}>
        Loading Application...
      </div>
    );
  }

  return (
    <div>
      {page === 'login' && (
        <LoginPage
          onAuthSuccess={handleAuthSuccess}
          setLoadingApp={setLoading}
        />
      )}
      {page === 'get_phone' && currentUser && (
        <PhoneInputModal onSubmit={handlePhoneSubmit} />
      )}
      {showPhoneUpdateModal && currentUser && (
          <PhoneInputModal
            onSubmit={handlePhoneSubmit}
            onCancel={() => setShowPhoneUpdateModal(false)}
            currentPhone={userPhone}
            isUpdating={true}
          />
      )}
      {page === 'client' && currentUser && userPhone && (
        <ClientPage
          availableTimes={availableTimes}
          userReservation={getUserReservationForSelectedDate()}
          handleReservation={handleReservation}
          cancelReservation={handleCancelUserReservation}
          goBack={handleSignOut} // "Back" from client page now means sign out
          isReservedByCurrentUser={isReservedByCurrentUser}
          isReservedByOthers={isReservedByOthers}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          generateNextFiveDays={generateNextFiveDays}
          onUpdatePhoneNumber={() => setShowPhoneUpdateModal(true)} // New prop
          userName={currentUser.displayName || "Client"}
        />
      )}
      {page === 'admin' && currentUser && ( // Admin also needs to be authenticated
        <AdminDashboard
          reservations={reservations}
          goBack={handleSignOut} // "Back" from admin page now means sign out
          onDeleteReservation={handleDeleteReservation}
        />
      )}
    </div>
  );
};

export default App;