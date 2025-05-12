// src/components/ClientPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import './ClientPage.css';
import { BarberNews, Reservation as ReservationType, BlockedTimeSlotsMap } from '../services/firebase-service';

interface ClientPageProps {
  latestBarberNews: BarberNews | null;
  userName: string;
  availableTimes: string[];
  userReservation: ReservationType | null;
  handleReservation: (time: string) => Promise<void>;
  cancelReservation: () => Promise<void>;
  goBack: () => void;
  isReservedByCurrentUser: (time: string) => boolean;
  isReservedByOthers: (time: string) => boolean;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  generateNextFiveDays: () => { day: string, date: string, fullDate: string }[];
  onUpdatePhoneNumber: () => void;
  blockedDays: Set<string>;
  blockedTimeSlots: BlockedTimeSlotsMap;
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
  blockedDays,
  blockedTimeSlots,
}) => {
  const [dates, setDates] = useState<{ day: string, date: string, fullDate: string }[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  useEffect(() => {
    const generatedDates = generateNextFiveDays();
    setDates(generatedDates);
    setSelectedTime(null);
    if (generatedDates.length > 0 && !generatedDates.some(d => d.fullDate === selectedDate)) {
        setSelectedDate(generatedDates[0].fullDate);
    } else if (generatedDates.length === 0 && selectedDate !== '') {
        // Handle no available dates
    }
  }, [generateNextFiveDays, selectedDate, setSelectedDate]);

  const handleDateSelection = useCallback((date: string) => {
    if (!blockedDays.has(date)) {
      setSelectedDate(date);
      setSelectedTime(null);
    }
  }, [blockedDays, setSelectedDate]);

  const handleTimeSelection = useCallback((time: string) => {
    if (userReservation) {
        if (userReservation.time === time) { return; }
        if (window.confirm(`Change appointment from ${userReservation.time} to ${time}?`)) {
            handleReservation(time);
            setSelectedTime(null);
        }
    } else { setSelectedTime(time); }
  }, [userReservation, handleReservation]);

  const handleCancelMainReservationClick = useCallback(() => {
    if (userReservation) {
      if (window.confirm(`Cancel appointment for ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${userReservation.time}?`)) {
        cancelReservation();
        setSelectedTime(null);
      }
    }
  }, [userReservation, cancelReservation, selectedDate]);

  const handleConfirmClick = useCallback(() => {
    if (selectedTime && !userReservation) {
      handleReservation(selectedTime);
      setSelectedTime(null);
    }
  }, [selectedTime, userReservation, handleReservation]);

  const isTimeInPast = useCallback((time: string): boolean => {
    const today = new Date().toISOString().split('T')[0];
    if (selectedDate !== today) return false;
    try {
        const now = new Date();
        const timeMatch = time.match(/(\d+):(\d+)\s*([AP]M)/i);
        if (!timeMatch) return false;
        let hours = parseInt(timeMatch[1]); const minutes = parseInt(timeMatch[2]);
        const ampm = timeMatch[3].toUpperCase();
        if (ampm === 'PM' && hours < 12) hours += 12; if (ampm === 'AM' && hours === 12) hours = 0;
        const appointmentTime = new Date(selectedDate); appointmentTime.setHours(hours, minutes, 0, 0);
        return appointmentTime <= now;
    } catch (e) { return true; }
  }, [selectedDate]);

  const isSelectedDateBlocked = blockedDays.has(selectedDate);

  return (
    <div className="appointment-container">
      <div className="client-page-header">
        <h1 className="page-title">Welcome, {userName}!</h1>
        <div className="client-header-actions">
            <button className="action-button-small client-update-phone-btn" onClick={onUpdatePhoneNumber} aria-label="Update phone number"> Update Phone </button>
            <button className="back-button client-signout-btn" onClick={goBack} aria-label="Sign out"> Sign Out → </button>
        </div>
      </div>
      <div className="appointment-card news-log-card" aria-live="polite">
        {latestBarberNews ? (
          <div>
            <h3 className="card-label news-label">LATEST NEWS FROM THE BARBER</h3>
            <p className="card-title news-message">{latestBarberNews.message}</p>
            <p className="card-subtitle news-timestamp"> Posted: {new Date(latestBarberNews.timestamp as number).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })} </p>
          </div>
        ) : (
          <div> <h3 className="card-label news-label">BARBER NEWS</h3> <p className="card-title news-message">No news updates at the moment.</p> </div>
        )}
      </div>
      <div className="appointment-card client-booking-card">
        <div className="date-selector client-date-selector" role="radiogroup" aria-label="Select appointment date">
          {dates.map((dateObj) => {
            const isBlocked = blockedDays.has(dateObj.fullDate);
            const isSelected = selectedDate === dateObj.fullDate;
            return (
              <div key={dateObj.fullDate} role="radio" aria-checked={isSelected} aria-disabled={isBlocked} className={`date-option ${isSelected ? 'selected' : ''} ${isBlocked ? 'blocked' : ''}`} onClick={() => !isBlocked && handleDateSelection(dateObj.fullDate)} tabIndex={isBlocked ? -1 : 0} onKeyDown={(e) => { if (!isBlocked && (e.key === 'Enter' || e.key === ' ')) handleDateSelection(dateObj.fullDate); }} title={isBlocked ? "Day unavailable" : `Select ${dateObj.day}, ${dateObj.date}`} >
                <div className="date-day">{dateObj.day}</div>
                <div className="date-number">{dateObj.date}</div>
                {isBlocked && <div className="blocked-indicator-client" aria-hidden="true">Off</div>}
              </div> ); })}
           {dates.length === 0 && ( <p className="no-dates-available">No available booking dates found in the near future.</p> )}
        </div>
        {selectedDate && !isSelectedDateBlocked && (
            <>
                <div className="time-zone" aria-hidden="true"> Times are shown in your local timezone. </div>
                <div className="time-grid" role="radiogroup" aria-label={`Select appointment time for ${selectedDate}`}>
                {availableTimes.map((time) => {
                    const isUsersSlot = isReservedByCurrentUser(time);
                    const isOthersSlot = isReservedByOthers(time);
                    const isPast = isTimeInPast(time);
                    // ***** NEW: Check if this specific time slot is admin-blocked *****
                    const isAdminBlockedSlot = blockedTimeSlots.get(selectedDate)?.has(time) ?? false;

                    const isSelectedForNew = selectedTime === time && !userReservation;
                    // ***** UPDATE: isDisabled check to include isAdminBlockedSlot *****
                    const isDisabled = isPast || isOthersSlot || isAdminBlockedSlot;

                    let buttonClass = 'time-button';
                    let buttonText = time;
                    let ariaLabel = `Select time ${time}`;
                    let title = `Book ${time}`;

                    if (isPast) {
                        buttonClass += ' booked'; // Keep 'booked' class for consistent styling
                        buttonText = "Past";
                        ariaLabel = `Time slot ${time} is in the past`;
                        title = ariaLabel;
                    // ***** NEW: Condition for admin-blocked slot *****
                    } else if (isAdminBlockedSlot) {
                         buttonClass += ' booked admin-blocked-slot'; // Add specific class for styling
                         buttonText = "Unavailable"; // Display "Unavailable"
                         ariaLabel = `Time slot ${time} is currently unavailable`;
                         title = ariaLabel;
                    } else if (isUsersSlot) {
                        buttonClass += ' your-reservation';
                        buttonText = "Your Slot";
                        ariaLabel = `Your current appointment is at ${time}. Select another available time to change.`;
                        title = ariaLabel;
                    } else if (isOthersSlot) {
                        buttonClass += ' booked';
                        buttonText = "Booked";
                        ariaLabel = `Time slot ${time} is already booked`;
                        title = ariaLabel;
                    } else if (isSelectedForNew) {
                        buttonClass += ' selected';
                        ariaLabel = `Time ${time} selected, click confirm below`;
                        title = ariaLabel;
                    }

                    return (
                        <button
                            key={time}
                            role="radio"
                            aria-checked={isSelectedForNew || isUsersSlot}
                            aria-disabled={isDisabled}
                            className={buttonClass}
                            onClick={() => !isDisabled && handleTimeSelection(time)}
                            disabled={isDisabled}
                            title={title}
                            aria-label={ariaLabel}
                        >
                            {buttonText}
                        </button>
                    );
                })}
                </div>
            </>
        )}
        {isSelectedDateBlocked && ( <div className="day-blocked-message" role="alert"> This day is currently unavailable for booking. Please select another date. </div> )}
        <div className="button-group">
            {!userReservation && selectedTime && !isSelectedDateBlocked && ( <button className="action-button" onClick={handleConfirmClick} aria-label={`Confirm booking for ${selectedTime} on ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`} > Confirm: {selectedTime} </button> )}
            {userReservation && !isSelectedDateBlocked && ( <button className="cancel-button" onClick={handleCancelMainReservationClick} aria-label={`Cancel your appointment on ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${userReservation.time}`} > Cancel My Appointment </button> )}
        </div>
      </div>
    </div>
  );
};