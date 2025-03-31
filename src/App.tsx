import React, { useState } from 'react';
import { LoginPage } from './components/LoginPage';
import { ClientPage } from './components/ClientPage';
import { AdminDashboard } from './components/AdminDashboard';

interface Reservation {
  name: string;
  phone: string;
  time: string;
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

  // Login handler checks for admin credentials.
  const handleLogin = () => {
    if (name.toLowerCase() === 'oriel' && phone === '1234') {
      setPage('admin');
    } else {
      // Check if this user already has a reservation.
      const existingReservation = reservations.find(
        (res) => res.name === name && res.phone === phone
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
    if (userReservation) {
      alert('You already have an active reservation for today!');
      return;
    }
    const newReservation: Reservation = { name, phone, time };
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
        userReservation.time === deletedReservation.time) {
      setUserReservation(null);
    }
  };

  // "Go Back" resets the view back to the login page.
  const goBack = () => {
    // We don't clear the user's reservation here, so that if the same credentials are used,
    // the system will detect the existing reservation.
    setPage('login');
  };

  // Available times at 30-minute intervals.
  const availableTimes = [
    '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30',
    '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30'
  ];

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