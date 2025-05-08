// src/components/ClientPage.tsx
import React, { useState, useEffect } from 'react';
import './ClientPage.css';

interface Reservation {
  name: string;
  phone: string;
  time: string;
  date: string;
  userId?: string;
}

interface ClientPageProps {
  availableTimes: string[];
  userReservation: Reservation | null;
  handleReservation: (time: string) => void;
  cancelReservation: () => void;
  goBack: () => void; // This will be signOut now
  isReservedByCurrentUser: (time: string) => boolean;
  isReservedByOthers: (time: string) => boolean;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  generateNextFiveDays: () => { day: string, date: string, fullDate: string }[];
  onUpdatePhoneNumber: () => void; // New prop
  userName: string; // New prop
}

export const ClientPage: React.FC<ClientPageProps> = ({
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
  userName
}) => {
  const [dates, setDates] = useState<{ day: string, date: string, fullDate: string }[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  useEffect(() => {
    const generatedDates = generateNextFiveDays();
    setDates(generatedDates);
    setSelectedTime(null); // Reset selected time when date changes or component mounts with new props
  }, [selectedDate, generateNextFiveDays]); // Re-run if selectedDate or generateNextFiveDays function identity changes

  const handleTimeSelection = (time: string) => {
    // This function is called when a user clicks an available, non-past, non-other-booked time slot.
    // It's not called if the slot is isReservedByCurrentUser.
    if (userReservation) { // If user already has a reservation on this selectedDate
      if (window.confirm(`Change your appointment from ${userReservation.time} to ${time}? Your previous booking on this date will be replaced.`)) {
        handleReservation(time); // This will delete the old one and create a new one
        setSelectedTime(null); // Reset selection after action
      }
    } else { // If user does not have a reservation on this selectedDate yet
      setSelectedTime(time); // Tentatively select this time
    }
  };

  const handleCancelClick = () => {
    if (userReservation && window.confirm('Are you sure you want to cancel your appointment?')) {
      cancelReservation();
      setSelectedTime(null); // Reset selection after action
    }
  };

  const handleConfirmClick = () => {
    if (selectedTime) {
      // This case is for when a user *without* an existing reservation on selectedDate confirms a *new* slot
      handleReservation(selectedTime);
      setSelectedTime(null); // Reset selection after action
    } else {
      alert('Please select a time first');
    }
  };

  const isTimeInPast = (time: string): boolean => {
    const today = new Date().toISOString().split('T')[0];
    if (selectedDate !== today) return false; // Only check for today's date

    const currentTime = new Date();
    const timeMatch = time.match(/(\d+):(\d+)\s*([AP]M)/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const ampm = timeMatch[3].toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0; // Midnight case
      const appointmentTime = new Date(selectedDate); // Use selectedDate for correct date context
      appointmentTime.setHours(hours, minutes, 0, 0);
      return appointmentTime <= currentTime;
    }
    return false; // Should not happen with valid time strings
  };

  return (
    <div className="appointment-container">
      <div className="header" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 className="page-title">Welcome, {userName}!</h1>
        <div>
            <button className="action-button-small"
                onClick={onUpdatePhoneNumber}
                style={{marginRight: '10px', borderColor: 'var(--secondary-color)', color: 'var(--secondary-color)', padding: '8px 16px'}}
            >
                Update Phone
            </button>
            <button className="back-button" onClick={goBack} style={{color: 'var(--primary-color)', fontSize: '1em', fontWeight: 500}}>
            Sign Out →
            </button>
        </div>
      </div>

      <div>
        <div className="appointment-card">
          {userReservation ? (
            <div className="card-header">
              <div>
                <h3 className="card-label">YOUR APPOINTMENT</h3>
                <p className="card-title">Haircut with Nicole</p>
                <p className="card-subtitle">On {new Date(userReservation.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {userReservation.time}</p>
              </div>
              <button className="close-button" onClick={handleCancelClick}>×</button>
            </div>
          ) : (
            <div>
              <h3 className="card-label">BOOK AN APPOINTMENT</h3>
              <p className="card-title">Haircut with Nicole</p>
              <p className="card-subtitle">Select a date and time below.</p>
            </div>
          )}
        </div>

        {/* Optional:
        <div className="nav-more">
           <div className="more-times">
            <span>View Calendar</span>
            <span className="more-times-arrow">→</span>
          </div>
        </div>
        */}

        <div className="date-selector">
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
            // A time is "selected" if it's the `selectedTime` state,
            // AND the user doesn't already have a reservation on this date,
            // AND this specific time slot isn't their current reservation.
            const isSelectedForNewBooking = selectedTime === time && !userReservation && !reservedByCurrent;

            let buttonClass = 'time-button';
            let buttonText = time;
            let isDisabled = false; // Corrected variable name

            if (pastTime) {
              buttonClass += ' booked'; // Using 'booked' style for past times too
              buttonText = "Past";
              isDisabled = true;
            } else if (reservedByCurrent) {
              buttonClass += ' your-reservation';
              buttonText = "Your Slot";
              isDisabled = true; // Disable clicking their own slot to "re-book" it via this button. Change flow is by selecting a *new* available slot.
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
                onClick={() => !isDisabled && handleTimeSelection(time)} // Will only call if not disabled
                disabled={isDisabled}
              >
                {buttonText}
              </button>
            );
          })}
        </div>

        {/* Show confirm button only if:
            1. User does NOT have an existing reservation on the selectedDate
            2. User HAS selected a `selectedTime` for a new booking
        */}
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

        {/* Show cancel button only if user HAS an existing reservation on the selectedDate */}
        {userReservation && (
          <div className="button-group">
            <button className="cancel-button" onClick={handleCancelClick}>
              Cancel My Appointment
            </button>
          </div>
        )}
      </div>
    </div>
  );
};