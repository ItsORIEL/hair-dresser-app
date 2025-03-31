import React, { useState } from 'react';
import './ClientPage.css'; // Import the CSS file

interface Reservation {
  name: string;
  phone: string;
  time: string;
}

interface ClientPageProps {
  availableTimes: string[];
  userReservation: Reservation | null;
  handleReservation: (time: string) => void;
  goBack: () => void;
}

export const ClientPage: React.FC<ClientPageProps> = ({
  userReservation,
  handleReservation,
  goBack,
}) => {
  const [selectedDate, setSelectedDate] = useState<number>(2); // Default to Monday (index 2)

  // Mock dates for the calendar - in a real app, you would generate these dynamically
  const dates = [
    { day: "Wed", date: "Apr 12" },
    { day: "Thu", date: "Apr 13" },
    { day: "Mon", date: "Apr 17" },
    { day: "Tue", date: "Apr 18" },
    { day: "Wed", date: "Apr 19" }
  ];

  // Group times by hour for the interface
  const timeGroups = [
    ["12:00 PM", "1:00 PM", "11:00 AM", "1:00 PM", "12:00 PM"],
    ["12:30 PM", "1:30 PM", "11:30 AM", "1:30 PM", "12:30 PM"],
    ["1:00 PM", "2:00 PM", "12:00 PM", "2:00 PM", "1:00 PM"],
    ["1:30 PM", "2:30 PM", "12:30 PM", "2:30 PM", "1:30 PM"],
    ["2:00 PM", "3:00 PM", "1:00 PM", "3:00 PM", "2:00 PM"],
    ["2:30 PM", "3:30 PM", "1:30 PM", "3:30 PM", "2:30 PM"]
  ];

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
                <p className="card-title">Haircut with {userReservation.name}</p>
                <p className="card-subtitle">60 minutes • Classic service</p>
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
          {timeGroups.map((row, rowIndex) => (
            row.map((time, colIndex) => (
              <button
                key={`${rowIndex}-${colIndex}`}
                className="time-button"
                onClick={() => handleReservation(time)}
              >
                {time}
              </button>
            ))
          ))}
        </div>
        
        {!userReservation && (
          <button className="action-button" onClick={() => handleReservation(timeGroups[0][selectedDate])}>
            Confirm Selection
          </button>
        )}
      </div>
    </div>
  );
};