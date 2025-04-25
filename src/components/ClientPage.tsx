import React, { useState, useEffect } from 'react';
import './ClientPage.css';

interface Reservation {
  name: string;
  phone: string;
  time: string;
  date: string;
}

interface ClientPageProps {
  availableTimes: string[];
  userReservation: Reservation | null;
  handleReservation: (time: string) => void;
  cancelReservation: () => void;
  goBack: () => void;
  isReservedByCurrentUser: (time: string) => boolean;
  isReservedByOthers: (time: string) => boolean;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  generateNextFiveDays: () => { day: string, date: string, fullDate: string }[];
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
  generateNextFiveDays
}) => {
  // State for dates
  const [dates, setDates] = useState<{ day: string, date: string, fullDate: string }[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Generate dates on component mount
  useEffect(() => {
    const generatedDates = generateNextFiveDays();
    setDates(generatedDates);
  }, []);

  // When user selects a time
  const handleTimeSelection = (time: string) => {
    if (userReservation) {
      // If already has reservation, ask to change
      if (window.confirm(`Change your appointment to ${time}?`)) {
        handleReservation(time);
      }
    } else {
      // If no reservation yet, just select the time
      setSelectedTime(time);
    }
  };

  // Handle cancel button click
  const handleCancelClick = () => {
    if (window.confirm('Are you sure you want to cancel your appointment?')) {
      cancelReservation();
    }
  };

  // Handle confirm button click
  const handleConfirmClick = () => {
    if (selectedTime) {
      handleReservation(selectedTime);
      setSelectedTime(null);
    } else {
      alert('Please select a time first');
    }
  };

  return (
    <div className="appointment-container">
      <div className="header">
        <button className="back-button" onClick={goBack}>
          ← Back
        </button>
        <h1 className="page-title">Book Appointment</h1>
      </div>

      <div>
        <div className="appointment-card">
          {userReservation ? (
            <div className="card-header">
              <div>
                <h3 className="card-label">YOUR APPOINTMENT</h3>
                <p className="card-title">Haircut with Nicole</p>
                <p className="card-subtitle">60 minutes • {userReservation.time} • Classic service</p>
              </div>
              <button className="close-button" onClick={handleCancelClick}>×</button>
            </div>
          ) : (
            <div>
              <h3 className="card-label">APPOINTMENT DETAILS</h3>
              <p className="card-title">Haircut with Nicole</p>
              <p className="card-subtitle">60 minutes • Classic service</p>
            </div>
          )}
        </div>

        <div className="nav-more">
          <div className="more-times">
            <span>View Calendar</span>
            <span className="more-times-arrow">→</span>
          </div>
        </div>

        {/* Date Selection */}
        <div className="date-selector">
          {dates.map((dateObj, index) => (
            <div 
              key={index}
              className={`date-option ${selectedDate === dateObj.fullDate ? 'selected' : ''}`}
              onClick={() => setSelectedDate(dateObj.fullDate)}
            >
              <div className="date-day">{dateObj.day}</div>
              <div className="date-number">{dateObj.date}</div>
            </div>
          ))}
        </div>

        {/* Time Zone */}
        <div className="time-zone">
          EASTERN TIME (GMT-04:00)
        </div>

        {/* Time Selection Grid */}
        <div className="time-grid">
          {availableTimes.map((time, index) => {
            const yourReservation = isReservedByCurrentUser(time);
            const unavailable = isReservedByOthers(time);
            const isSelected = selectedTime === time && !userReservation;
            
            return (
              <button
                key={index}
                className={`time-button ${yourReservation ? 'your-reservation' : ''} ${unavailable ? 'booked' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => !unavailable && handleTimeSelection(time)}
                disabled={unavailable}
              >
                {yourReservation ? "Your Appointment" : unavailable ? "Unavailable" : time}
              </button>
            );
          })}
        </div>
        
        {!userReservation && (
          <div className="button-group">
            <button 
              className="action-button" 
              onClick={handleConfirmClick}
              disabled={!selectedTime}
            >
              Confirm Selection
            </button>
          </div>
        )}

        {userReservation && (
          <div className="button-group">
            <button className="cancel-button" onClick={handleCancelClick}>
              Cancel Appointment
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
