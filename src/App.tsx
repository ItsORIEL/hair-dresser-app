import React, { useState } from 'react';
import { LoginPage } from './components/LoginPage';
import { ClientPage } from './components/ClientPage';
import { AdminDashboard } from './components/AdminDashboard';

interface Reservation {
  name: string;
  phone: string;
  time: string;
  date: string;
}

const App: React.FC = () => {
  // Determine which view to show: login, client, or admin.
  const [page, setPage] = useState<'login' | 'client' | 'admin'>('login');
  // Login details.
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  // All reservations made (for admin view).
  const [reservations, setReservations] = useState<Reservation[]>([]);
  // The current user's reservation (to enforce one reservation per day).
  const [userReservation, setUserReservation] = useState<Reservation | null>(null);

  // Utility function to get current date in format YYYY-MM-DD
  const getCurrentDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Login handler checks for admin credentials.
  const handleLogin = () => {
    // Basic validation
    if (!name.trim() || !phone.trim()) {
      alert('Please enter both name and phone number');
      return;
    }

    if (name.toLowerCase() === 'oriel' && phone === '1234') {
      setPage('admin');
    } else {
      // Check if this user already has a reservation for today
      const currentDate = getCurrentDate();
      const existingReservation = reservations.find(
        (res) => res.name === name && 
                 res.phone === phone && 
                 res.date === currentDate
      );
      
      if (existingReservation) {
        setUserReservation(existingReservation);
      } else {
        setUserReservation(null);
      }
      setPage('client');
    }
  };

  // Reservation handler ensuring one reservation per day.
  const handleReservation = (time: string) => {
    const currentDate = getCurrentDate();

    // Check if user already has a reservation for today
    const existingUserReservation = reservations.find(
      res => res.name === name && 
             res.phone === phone && 
             res.date === currentDate
    );

    if (existingUserReservation) {
      alert('You already have an active reservation for today!');
      return;
    }

    // Check if time is already booked by anyone
    const isTimeBooked = reservations.some(
      res => res.time === time && res.date === currentDate
    );

    if (isTimeBooked) {
      alert('This time slot is no longer available.');
      return;
    }

    const newReservation: Reservation = { 
      name, 
      phone, 
      time, 
      date: currentDate 
    };

    setUserReservation(newReservation);
    setReservations((prev) => [...prev, newReservation]);
    alert(`Reservation confirmed for ${time}`);
  };

  // Delete reservation handler for admin dashboard
  const handleDeleteReservation = (index: number) => {
    // Create a copy of the reservations array
    const updatedReservations = [...reservations];
    
    // Get the reservation that's being deleted
    const deletedReservation = updatedReservations[index];
    
    // Remove the reservation at the specified index
    updatedReservations.splice(index, 1);
    
    // Update the reservations state
    setReservations(updatedReservations);
    
    // If this was the user's reservation, clear it
    if (userReservation && 
        userReservation.name === deletedReservation.name && 
        userReservation.phone === deletedReservation.phone &&
        userReservation.time === deletedReservation.time &&
        userReservation.date === deletedReservation.date) {
      setUserReservation(null);
    }
  };

  // "Go Back" resets the view back to the login page.
  const goBack = () => {
    setPage('login');
  };

  // Available times at 30-minute intervals.
  const availableTimes = [
    '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
    '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', 
    '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM',
    '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', 
    '5:00 PM', '5:30 PM'
  ];

  // Check if a time slot is reserved by the current user
  const isReservedByCurrentUser = (time: string) => {
    const currentDate = getCurrentDate();
    return userReservation?.time === time && userReservation?.date === currentDate;
  };

  // Check if a time slot is booked by someone else
  const isReservedByOthers = (time: string) => {
    const currentDate = getCurrentDate();
    return reservations.some(res => 
      res.time === time && 
      res.date === currentDate && 
      (res.name !== name || res.phone !== phone)
    );
  };

  return (
    <div>
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
          userReservation={userReservation}
          handleReservation={handleReservation}
          goBack={goBack}
          isReservedByCurrentUser={isReservedByCurrentUser}
          isReservedByOthers={isReservedByOthers}
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
