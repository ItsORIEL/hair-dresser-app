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
  goBack: () => void;
  isReservedByCurrentUser: (time: string) => boolean;
  isReservedByOthers: (time: string) => boolean;
}

export const ClientPage: React.FC<ClientPageProps> = ({
  availableTimes,
  userReservation,
  handleReservation,
  goBack,
  isReservedByCurrentUser,
  isReservedByOthers
}) => {
  // State for dates and selected date
  const [dates, setDates] = useState<{ day: string, date: string }[]>([]);
  const [selectedDate, setSelectedDate] = useState<number>(0);

  // Function to generate next 5 days
  const generateNextFiveDays = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const generatedDates = [];
    
    for (let i = 0; i < 5; i++) {
      const currentDate = new Date();
      currentDate.setDate(currentDate.getDate() + i);
      
      generatedDates.push({
        day: days[currentDate.getDay()],
        date: currentDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        })
      });
    }
    
    return generatedDates;
  };

  // Generate dates on component mount
  useEffect(() => {
    const generatedDates = generateNextFiveDays();
    setDates(generatedDates);
  }, []);

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
              <button className="close-button">×</button>
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
              className={`date-option ${selectedDate === index ? 'selected' : ''}`}
              onClick={() => setSelectedDate(index)}
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
            
            return (
              <button
                key={index}
                className={`time-button ${yourReservation ? 'your-reservation' : ''} ${unavailable ? 'booked' : ''}`}
                onClick={() => !yourReservation && !unavailable && handleReservation(time)}
                disabled={yourReservation || unavailable}
              >
                {yourReservation ? "Reserved for you!" : unavailable ? "Unavailable" : time}
              </button>
            );
          })}
        </div>
        
        {!userReservation && (
          <button className="action-button" onClick={() => handleReservation(availableTimes[0])}>
            Confirm Selection
          </button>
        )}
      </div>
    </div>
  );
};
