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

    // For admin login check, we need to compare without the prefix
    if (name.toLowerCase() === 'oriel' && phone === '1234') {
      setPage('admin');
    } else {
      setPage('client');
    }
  };
  
  // Helper function to format the phone with prefix for Firebase
  const formatPhoneWithPrefix = (phoneNumber: string) => {
    // Remove any non-digit characters
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    
    // If it already starts with the country code, don't add it again
    if (digitsOnly.startsWith('972')) {
      return `+${digitsOnly}`;
    }
    
    // Otherwise, add the country code
    return `+972${digitsOnly}`;
  };

  const handleReservation = async (time: string) => {
    setLoading(true);
    try {
      // Format phone number with country code
      const formattedPhone = formatPhoneWithPrefix(phone);
      
      // Check if this is a past time slot on the current date
      const today = new Date().toISOString().split('T')[0];
      
      if (selectedDate === today) {
        const currentTime = new Date();
        const timeMatch = time.match(/(\d+):(\d+)\s*([AP]M)/i);
        
        if (timeMatch) {
          let hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          const ampm = timeMatch[3].toUpperCase();
          
          // Convert to 24-hour format
          if (ampm === 'PM' && hours < 12) hours += 12;
          if (ampm === 'AM' && hours === 12) hours = 0;
          
          // Create a Date object for the appointment time
          const appointmentTime = new Date();
          appointmentTime.setHours(hours, minutes, 0, 0);
          
          // If appointment time is in the past, prevent booking
          if (appointmentTime <= currentTime) {
            alert('Cannot book appointments in the past. Please select a future time slot.');
            return;
          }
        }
      }

      // Check if this time slot is available
      const isAvailable = await isTimeSlotAvailable(
        selectedDate, 
        time, 
        { name, phone: formattedPhone } // Exclude the current user's existing reservation
      );

      if (!isAvailable) {
        alert('This time slot has just been booked by someone else. Please select another time.');
        return;
      }

      // Check if user already has a reservation for this date
      const existingReservation = await getUserReservationForDate(name, formattedPhone, selectedDate);
      
      if (existingReservation) {
        // Delete the old reservation
        await deleteReservation(existingReservation.id!);
      }
      
      // Create new reservation
      const newReservation: Reservation = {
        name,
        phone: formattedPhone, // Use the formatted phone number
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
      // Format phone number with country code
      const formattedPhone = formatPhoneWithPrefix(phone);
      
      // Find user's reservation for the current date
      const userReservation = await getUserReservationForDate(name, formattedPhone, selectedDate);
      
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
    const formattedPhone = formatPhoneWithPrefix(phone);
    return reservations.find(
      res => res.name === name && 
             res.phone === formattedPhone && 
             res.date === selectedDate
    ) || null;
  };

  const isReservedByCurrentUser = (time: string) => {
    const userReservation = getUserReservationForSelectedDate();
    return userReservation?.time === time;
  };

  const isReservedByOthers = (time: string) => {
    const formattedPhone = formatPhoneWithPrefix(phone);
    return reservations.some(
      res => res.time === time && 
             res.date === selectedDate && 
             (res.name !== name || res.phone !== formattedPhone)
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