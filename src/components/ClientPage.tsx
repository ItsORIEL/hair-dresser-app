// src/components/ClientPage.tsx
import React, { useState, useEffect, useCallback } from 'react'; // Import useCallback
import './ClientPage.css';
import { BarberNews, Reservation as ReservationType } from '../services/firebase-service';

interface ClientPageProps {
  latestBarberNews: BarberNews | null;
  userName: string;
  availableTimes: string[];
  userReservation: ReservationType | null; // The user's reservation for the selectedDate (or null)
  handleReservation: (time: string) => Promise<void>; // Function to book/modify reservation
  cancelReservation: () => Promise<void>; // Function to cancel reservation for selectedDate
  goBack: () => void; // Function to sign out/go back
  isReservedByCurrentUser: (time: string) => boolean; // Checks if current user has THIS time slot
  isReservedByOthers: (time: string) => boolean; // Checks if ANOTHER user has THIS time slot
  selectedDate: string; // Current selected date (YYYY-MM-DD)
  setSelectedDate: (date: string) => void; // Function to update selected date
  generateNextFiveDays: () => { day: string, date: string, fullDate: string }[]; // Function to get valid dates
  onUpdatePhoneNumber: () => void; // Function to open phone update modal
  blockedDays: Set<string>; // Set of blocked date strings (YYYY-MM-DD)
}

export const ClientPage: React.FC<ClientPageProps> = ({
  latestBarberNews,
  userName,
  availableTimes,
  userReservation, // User's reservation for the *selected* date
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
}) => {
  // State for the list of displayable dates
  const [dates, setDates] = useState<{ day: string, date: string, fullDate: string }[]>([]);
  // State for the time slot currently selected by the user (before confirming)
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Update the list of dates whenever the generation function or selected date changes
  useEffect(() => {
    console.log("ClientPage: Generating next available dates...");
    const generatedDates = generateNextFiveDays();
    setDates(generatedDates);
    setSelectedTime(null); // Reset time selection when available dates change

    // Ensure selectedDate is still valid within the generated list
    // (App.tsx also does this, but this is a defensive check)
    if (generatedDates.length > 0 && !generatedDates.some(d => d.fullDate === selectedDate)) {
        console.log(`ClientPage: Selected date ${selectedDate} no longer in generated list, resetting.`);
        setSelectedDate(generatedDates[0].fullDate);
    } else if (generatedDates.length === 0 && selectedDate !== '') {
        console.log("ClientPage: No available dates found, clearing selected date.");
        // setSelectedDate(''); // Or handle this state in App.tsx
    }
  }, [generateNextFiveDays, selectedDate, setSelectedDate]); // Rerun if generator or selected date changes


  // Handle clicking on a date option
  const handleDateSelection = useCallback((date: string) => {
    if (!blockedDays.has(date)) {
      setSelectedDate(date);
      setSelectedTime(null); // Reset time selection
    } else {
        console.warn("ClientPage: Attempted to select a blocked date:", date);
    }
  }, [blockedDays, setSelectedDate]);


  // Handle clicking on a time button
  const handleTimeSelection = useCallback((time: string) => {
    // Case 1: User already has a reservation on this date
    if (userReservation) {
        if (userReservation.time === time) {
            // Clicked their own existing slot - do nothing or show message?
            console.log("ClientPage: Clicked own existing slot.");
            return;
        }
        // Clicked a *different* available slot - ask to confirm change
        if (window.confirm(`Change your appointment from ${userReservation.time} to ${time}? Your previous booking on this date will be replaced.`)) {
            handleReservation(time); // Let App.tsx handle delete + create
            setSelectedTime(null); // Reset intermediate selection state
        }
    }
    // Case 2: User has no reservation on this date - select the time slot
    else {
      setSelectedTime(time);
    }
  }, [userReservation, handleReservation]);


  // Handle clicking the main "Cancel My Appointment" button
  const handleCancelMainReservationClick = useCallback(() => {
    if (userReservation) {
      if (window.confirm(`Are you sure you want to cancel your appointment for ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${userReservation.time}?`)) {
        cancelReservation(); // Let App.tsx handle the cancellation for this date
        setSelectedTime(null);
      }
    } else {
        // Should not happen if button is only shown when userReservation exists
        console.warn("ClientPage: Cancel button clicked but no reservation found for selected date.");
    }
  }, [userReservation, cancelReservation, selectedDate]);

  // Handle clicking the "Confirm" button (for new bookings)
  const handleConfirmClick = useCallback(() => {
    if (selectedTime && !userReservation) {
      handleReservation(selectedTime); // Let App.tsx handle creation
      setSelectedTime(null);
    } else {
        // Should not happen if button is shown correctly
       console.warn("ClientPage: Confirm clicked without valid selected time or with existing reservation.");
    }
  }, [selectedTime, userReservation, handleReservation]);

  // Check if a time slot is in the past relative to now
  const isTimeInPast = useCallback((time: string): boolean => {
    const today = new Date().toISOString().split('T')[0];
    if (selectedDate !== today) return false; // Only relevant for today

    try {
        const now = new Date();
        const timeMatch = time.match(/(\d+):(\d+)\s*([AP]M)/i);
        if (!timeMatch) return false; // Invalid format

        let hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const ampm = timeMatch[3].toUpperCase();
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;

        const appointmentTime = new Date(selectedDate); // YYYY-MM-DD
        appointmentTime.setHours(hours, minutes, 0, 0);

        return appointmentTime <= now;
    } catch (e) {
        console.error("Error parsing time in isTimeInPast:", e);
        return true; // Default to past on error to be safe
    }
  }, [selectedDate]);

  // Check if the *entire* selected day is blocked
  const isSelectedDateBlocked = blockedDays.has(selectedDate);

  return (
    <div className="appointment-container">
      {/* Header Section */}
      <div className="client-page-header">
        <h1 className="page-title">Welcome, {userName}!</h1>
        <div className="client-header-actions">
            <button className="action-button-small client-update-phone-btn" onClick={onUpdatePhoneNumber} aria-label="Update phone number">
                Update Phone
            </button>
            <button className="back-button client-signout-btn" onClick={goBack} aria-label="Sign out">
            Sign Out →
            </button>
        </div>
      </div>

      {/* News Card Section */}
      <div className="appointment-card news-log-card" aria-live="polite">
        {latestBarberNews ? (
          <div>
            <h3 className="card-label news-label">LATEST NEWS FROM THE BARBER</h3>
            <p className="card-title news-message">{latestBarberNews.message}</p>
            <p className="card-subtitle news-timestamp">
              Posted: {new Date(latestBarberNews.timestamp as number).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
            </p>
          </div>
        ) : (
          <div>
            <h3 className="card-label news-label">BARBER NEWS</h3>
            <p className="card-title news-message">No news updates at the moment.</p>
          </div>
        )}
      </div>

      {/* Booking Card Section */}
      <div className="appointment-card client-booking-card">
        {/* Date Selector */}
        <div className="date-selector client-date-selector" role="radiogroup" aria-label="Select appointment date">
          {dates.map((dateObj) => {
            const isBlocked = blockedDays.has(dateObj.fullDate);
            const isSelected = selectedDate === dateObj.fullDate;
            return (
              <div
                key={dateObj.fullDate}
                role="radio"
                aria-checked={isSelected}
                aria-disabled={isBlocked}
                className={`date-option ${isSelected ? 'selected' : ''} ${isBlocked ? 'blocked' : ''}`}
                onClick={() => !isBlocked && handleDateSelection(dateObj.fullDate)}
                tabIndex={isBlocked ? -1 : 0} // Make selectable dates focusable
                onKeyDown={(e) => { if (!isBlocked && (e.key === 'Enter' || e.key === ' ')) handleDateSelection(dateObj.fullDate); }}
                 title={isBlocked ? "Day unavailable" : `Select ${dateObj.day}, ${dateObj.date}`}
              >
                <div className="date-day">{dateObj.day}</div>
                <div className="date-number">{dateObj.date}</div>
                {isBlocked && <div className="blocked-indicator-client" aria-hidden="true">Off</div>}
              </div>
            );
           })}
           {/* Message if no dates are available */}
           {dates.length === 0 && (
                <p className="no-dates-available">No available booking dates found in the near future.</p>
           )}
        </div>

        {/* Time Grid (only shown if date selected and not blocked) */}
        {selectedDate && !isSelectedDateBlocked && (
            <>
                <div className="time-zone" aria-hidden="true">
                    Times are shown in your local timezone.
                </div>

                <div className="time-grid" role="radiogroup" aria-label={`Select appointment time for ${selectedDate}`}>
                {availableTimes.map((time) => {
                    // Determine button state
                    const isUsersSlot = isReservedByCurrentUser(time);
                    const isOthersSlot = isReservedByOthers(time);
                    const isPast = isTimeInPast(time);
                    const isSelectedForNew = selectedTime === time && !userReservation; // Highlighted for confirmation
                    const isDisabled = isPast || isOthersSlot; // Can still click own slot to initiate change

                    let buttonClass = 'time-button';
                    let buttonText = time;
                    let ariaLabel = `Select time ${time}`;
                    let title = `Book ${time}`;

                    if (isPast) {
                        buttonClass += ' booked'; // Style as booked/unavailable
                        buttonText = "Past";
                        ariaLabel = `Time slot ${time} is in the past`;
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
                        buttonClass += ' selected'; // Highlight before confirmation
                        ariaLabel = `Time ${time} selected, click confirm below`;
                        title = ariaLabel;
                    }

                    return (
                        <button
                            key={time}
                            role="radio"
                            aria-checked={isSelectedForNew || isUsersSlot} // Indicate selection/current booking
                            aria-disabled={isDisabled}
                            className={buttonClass}
                            onClick={() => !isDisabled && handleTimeSelection(time)}
                            disabled={isDisabled} // HTML disabled attribute
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

        {/* Message if selected date is blocked */}
        {isSelectedDateBlocked && (
             <div className="day-blocked-message" role="alert">
                This day is currently unavailable for booking. Please select another date.
             </div>
        )}


        {/* Action Buttons */}
        <div className="button-group">
            {/* Confirm Button: Show only if a time is selected for a *new* booking */}
            {!userReservation && selectedTime && !isSelectedDateBlocked && (
                <button
                className="action-button"
                onClick={handleConfirmClick}
                aria-label={`Confirm booking for ${selectedTime} on ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                >
                Confirm: {selectedTime}
                </button>
            )}

            {/* Cancel Button: Show only if user *has* a reservation on the selected date */}
            {userReservation && !isSelectedDateBlocked && (
                <button
                    className="cancel-button"
                    onClick={handleCancelMainReservationClick}
                    aria-label={`Cancel your appointment on ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${userReservation.time}`}
                >
                Cancel My Appointment {/* Text already indicates date/time implicitly */}
                </button>
            )}
        </div>
      </div> {/* End Booking Card */}
    </div> /* End Container */
  );
};