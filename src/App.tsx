import React, { useState } from 'react';
import { LoginPage } from './components/LoginPage';
import { ClientPage } from './components/ClientPage';
import { AdminDashboard } from './components/AdminDashboard';

// Utility function to get current date in format YYYY-MM-DD
const getCurrentDate = (offset: number = 0) => {
  const today = new Date();
  today.setDate(today.getDate() + offset);
  return today.toISOString().split('T')[0];
};

interface Reservation {
  name: string;
  phone: string;
  time: string;
  date: string;
  id: string; // Unique identifier
}

const App: React.FC = () => {
  const [page, setPage] = useState<'login' | 'client' | 'admin'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDate());

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

  const handleReservation = (time: string) => {
    // Generate a unique ID for the reservation
    const reservationId = `${name}-${phone}-${selectedDate}-${time}`;

    // Check if the time slot is booked by another user
    const isTimeBooked = reservations.some(
      res => res.time === time && 
             res.date === selectedDate && 
             (res.name !== name || res.phone !== phone)
    );

    if (isTimeBooked) {
      alert('This time slot is already booked by another user.');
      return;
    }

    // Remove any existing reservation for this specific user on this date
    const updatedReservations = reservations.filter(
      res => !(res.name === name && 
               res.phone === phone && 
               res.date === selectedDate)
    );

    // Create new reservation
    const newReservation: Reservation = {
      name,
      phone,
      time,
      date: selectedDate,
      id: reservationId
    };

    // Update reservations
    setReservations([...updatedReservations, newReservation]);
    alert(`Reservation confirmed for ${selectedDate} at ${time}`);
  };

  const handleDeleteReservation = (index: number) => {
    const updatedReservations = [...reservations];
    updatedReservations.splice(index, 1);
    setReservations(updatedReservations);
  };

  const handleCancelUserReservation = () => {
    // Find and remove the user's reservation for the current date
    const updatedReservations = reservations.filter(
      res => !(res.name === name && 
               res.phone === phone && 
               res.date === selectedDate)
    );
    
    setReservations(updatedReservations);
    alert('Your appointment has been cancelled.');
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

  const getUserReservationForDate = () => {
    return reservations.find(
      res => res.name === name && 
             res.phone === phone && 
             res.date === selectedDate
    ) || null; // Explicitly return null if no reservation found
  };

  const isReservedByCurrentUser = (time: string) => {
    const userReservation = getUserReservationForDate();
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
          userReservation={getUserReservationForDate()}
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
