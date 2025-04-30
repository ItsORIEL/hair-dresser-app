import React, { useState, useEffect } from 'react';
import { LoginPage } from './components/LoginPage';
import { ClientPage } from './components/ClientPage';
import { AdminDashboard } from './components/AdminDashboard';
import './App.css';

// Import Firebase service
import { 
  getReservations, 
  createReservation, 
  deleteReservation, 
  getUserReservationForDate,
  isTimeSlotAvailable,
  Reservation
} from './services/firebase-service';

// Utility function to get current date in format YYYY-MM-DD
const getCurrentDate = (offset: number = 0) => {
  const today = new Date();
  today.setDate(today.getDate() + offset);
  return today.toISOString().split('T')[0];
};

const App: React.FC = () => {
  const [page, setPage] = useState<'login' | 'client' | 'admin'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDate());
  const [loading, setLoading] = useState<boolean>(false);

  // Subscribe to reservations from Firebase
  useEffect(() => {
    const unsubscribe = getReservations((fetchedReservations) => {
      setReservations(fetchedReservations);
    });

    // Clean up the listener when component unmounts
    return () => unsubscribe();
  }, []);

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

  const handleLogin = () => {
    if (!name.trim() || !phone.trim()) {
      alert('Please enter both name and phone number');
      return;
    }

    if (name.toLowerCase() === 'oriel' && phone === '1234') {
      setPage('admin');
    } else {
      setPage('client');
    }
  };

  const handleReservation = async (time: string) => {
    setLoading(true);
    try {
      // Check if this time slot is available
      const isAvailable = await isTimeSlotAvailable(
        selectedDate, 
        time, 
        { name, phone } // Exclude the current user's existing reservation
      );

      if (!isAvailable) {
        alert('This time slot has just been booked by someone else. Please select another time.');
        return;
      }

      // Check if user already has a reservation for this date
      const existingReservation = await getUserReservationForDate(name, phone, selectedDate);
      
      if (existingReservation) {
        // Delete the old reservation
        await deleteReservation(existingReservation.id!);
      }
      
      // Create new reservation
      const newReservation: Reservation = {
        name,
        phone,
        time,
        date: selectedDate
      };
      
      await createReservation(newReservation);
      alert(`Reservation confirmed for ${selectedDate} at ${time}`);
    } catch (error) {
      console.error("Error making reservation:", error);
      alert('Failed to make reservation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReservation = async (id: string) => {
    try {
      await deleteReservation(id);
    } catch (error) {
      console.error("Error deleting reservation:", error);
      alert('Failed to delete reservation.');
    }
  };

  const handleCancelUserReservation = async () => {
    setLoading(true);
    try {
      // Find user's reservation for the current date
      const userReservation = await getUserReservationForDate(name, phone, selectedDate);
      
      if (userReservation && userReservation.id) {
        await deleteReservation(userReservation.id);
        alert('Your appointment has been cancelled.');
      } else {
        alert('No appointment found to cancel.');
      }
    } catch (error) {
      console.error("Error cancelling reservation:", error);
      alert('Failed to cancel reservation.');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setPage('login');
  };

  const availableTimes = [
    '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
    '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', 
    '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM',
    '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', 
    '5:00 PM', '5:30 PM'
  ];

  const getUserReservationForSelectedDate = () => {
    return reservations.find(
      res => res.name === name && 
             res.phone === phone && 
             res.date === selectedDate
    ) || null;
  };

  const isReservedByCurrentUser = (time: string) => {
    const userReservation = getUserReservationForSelectedDate();
    return userReservation?.time === time;
  };

  const isReservedByOthers = (time: string) => {
    return reservations.some(
      res => res.time === time && 
             res.date === selectedDate && 
             (res.name !== name || res.phone !== phone)
    );
  };

  return (
    <div>
      {loading && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{ 
            padding: '20px', 
            backgroundColor: 'white', 
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
          }}>
            Loading...
          </div>
        </div>
      )}

      {page === 'login' && (
        <LoginPage
          name={name}
          phone={phone}
          setName={setName}
          setPhone={setPhone}
          handleLogin={handleLogin}
        />
      )}
      {page === 'client' && (
        <ClientPage
          availableTimes={availableTimes}
          userReservation={getUserReservationForSelectedDate()}
          handleReservation={handleReservation}
          cancelReservation={handleCancelUserReservation}
          goBack={goBack}
          isReservedByCurrentUser={isReservedByCurrentUser}
          isReservedByOthers={isReservedByOthers}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          generateNextFiveDays={generateNextFiveDays}
        />
      )}
      {page === 'admin' && (
        <AdminDashboard 
          reservations={reservations} 
          goBack={goBack} 
          onDeleteReservation={handleDeleteReservation}
        />
      )}
    </div>
  );
};

export default App;