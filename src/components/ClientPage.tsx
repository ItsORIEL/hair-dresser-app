// src/components/ClientPage.tsx
import React, { useState, useEffect } from 'react';
import './ClientPage.css';
import { BarberNews, Reservation as ReservationType } from '../services/firebase-service';

interface ClientPageProps {
  latestBarberNews: BarberNews | null;
  userName: string;
  availableTimes: string[];
  userReservation: ReservationType | null;
  handleReservation: (time: string) => void;
  cancelReservation: () => void;
  goBack: () => void;
  isReservedByCurrentUser: (time: string) => boolean;
  isReservedByOthers: (time: string) => boolean;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  generateNextFiveDays: () => { day: string, date: string, fullDate: string }[];
  onUpdatePhoneNumber: () => void;
}

export const ClientPage: React.FC<ClientPageProps> = ({
  latestBarberNews,
  userName,
  availableTimes,
  userReservation,
  handleReservation,
  cancelReservation,
  goBack,
  isReservedByCurrentUser,
  isReservedByOthers,
  selectedDate,
  setSelectedDate,
  generateNextFiveDays,
  onUpdatePhoneNumber,
}) => {
  const [dates, setDates] = useState<{ day: string, date: string, fullDate: string }[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  useEffect(() => {
    const generatedDates = generateNextFiveDays();
    setDates(generatedDates);
    setSelectedTime(null);
  }, [selectedDate, generateNextFiveDays]);


  const handleTimeSelection = (time: string) => {
    if (userReservation) {
      if (window.confirm(`Change your appointment from ${userReservation.time} to ${time}? Your previous booking on this date will be replaced.`)) {
        handleReservation(time);
        setSelectedTime(null);
      }
    } else {
      setSelectedTime(time);
    }
  };

  const handleCancelMainReservationClick = () => {
    if (userReservation && window.confirm('Are you sure you want to cancel your appointment?')) {
      cancelReservation();
      setSelectedTime(null);
    }
  };

  const handleConfirmClick = () => {
    if (selectedTime) {
      handleReservation(selectedTime);
      setSelectedTime(null);
    } else {
      alert('Please select a time first');
    }
  };

  const isTimeInPast = (time: string): boolean => {
    const today = new Date().toISOString().split('T')[0];
    if (selectedDate !== today) return false;

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
      return appointmentTime <= currentTime;
    }
    return false;
  };


  return (
    <div className="appointment-container">
      <div className="client-page-header">
        <h1 className="page-title">Welcome, {userName}!</h1>
        <div className="client-header-actions">
            <button className="action-button-small client-update-phone-btn" onClick={onUpdatePhoneNumber} >
                Update Phone
            </button>
            <button className="back-button client-signout-btn" onClick={goBack}>
            Sign Out →
            </button>
        </div>
      </div>

      <div className="appointment-card news-log-card">
        {latestBarberNews ? (
          <div>
            <h3 className="card-label news-label">LATEST NEWS FROM THE BARBER</h3>
            <p className="card-title news-message">{latestBarberNews.message}</p>
            <p className="card-subtitle news-timestamp">
              Posted: {new Date(latestBarberNews.timestamp as number).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        ) : (
          <div>
            <h3 className="card-label news-label">BARBER NEWS</h3>
            <p className="card-title news-message">No news updates at the moment.</p>
          </div>
        )}
      </div>

      <div className="appointment-card client-booking-card">
        <div className="date-selector client-date-selector">
          {dates.map((dateObj) => (
            <div
              key={dateObj.fullDate}
              className={`date-option ${selectedDate === dateObj.fullDate ? 'selected' : ''}`}
              onClick={() => setSelectedDate(dateObj.fullDate)}
            >
              <div className="date-day">{dateObj.day}</div>
              <div className="date-number">{dateObj.date}</div>
            </div>
          ))}
        </div>

        <div className="time-zone">
          Times are shown in your local timezone.
        </div>

        <div className="time-grid">
          {availableTimes.map((time) => {
            const reservedByCurrent = isReservedByCurrentUser(time);
            const reservedByOther = isReservedByOthers(time);
            const pastTime = isTimeInPast(time);
            const isSelectedForNewBooking = selectedTime === time && !userReservation && !reservedByCurrent;

            let buttonClass = 'time-button';
            let buttonText = time;
            let isDisabled = false;

            if (pastTime) {
              buttonClass += ' booked';
              buttonText = "Past";
              isDisabled = true;
            } else if (reservedByCurrent) {
              buttonClass += ' your-reservation';
              buttonText = "Your Slot";
              isDisabled = true;
            } else if (reservedByOther) {
              buttonClass += ' booked';
              buttonText = "Booked";
              isDisabled = true;
            } else if (isSelectedForNewBooking) {
              buttonClass += ' selected';
            }

            return (
              <button
                key={time}
                className={buttonClass}
                onClick={() => !isDisabled && handleTimeSelection(time)}
                disabled={isDisabled}
              >
                {buttonText}
              </button>
            );
          })}
        </div>

        {!userReservation && selectedTime && (
          <div className="button-group">
            <button
              className="action-button"
              onClick={handleConfirmClick}
            >
              Confirm: {selectedTime} on {new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </button>
          </div>
        )}

        {userReservation && (
          <div className="button-group">
            <button className="cancel-button" onClick={handleCancelMainReservationClick}>
              Cancel My Appointment
            </button>
          </div>
        )}
      </div>
    </div>
  );
};