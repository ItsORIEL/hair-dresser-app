// src/components/AdminDashboard.tsx
import React, { useState, useEffect } from 'react';
import './AdminDashboard.css';
import { Reservation, getBlockedDays, blockDay, unblockDay } from '../services/firebase-service'; // Import blocking functions
import { AdminNewsPublisher } from './AdminNewsPublisher';
import { AdminDayBlocker } from './AdminDayBlocker'; // Import the new component

interface AdminDashboardProps {
  reservations: Reservation[]; // Receive reservations as prop
  goBack: () => void;
  onDeleteReservation: (id: string) => void;
}

// Helper function to parse time string (HH:MM AM/PM) into minutes from midnight
const getTimeValue = (timeStr: string): number => {
    const timeMatch = timeStr?.match(/(\d+):(\d+)\s*([AP]M)/i);
    if (!timeMatch) return 0; // Default for invalid format
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const modifier = timeMatch[3].toUpperCase();
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0; // Midnight case
    return hours * 60 + minutes;
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  reservations,
  goBack,
  onDeleteReservation
}) => {
  const [blockedDays, setBlockedDays] = useState<Set<string>>(new Set());
  const [loadingBlockedDays, setLoadingBlockedDays] = useState(true);

  // Fetch and listen for blocked days within the admin dashboard
  useEffect(() => {
    setLoadingBlockedDays(true);
    console.log("AdminDashboard: Subscribing to blocked days...");
    const unsubscribe = getBlockedDays((days) => {
      console.log("AdminDashboard: Received blocked days update:", days);
      setBlockedDays(days);
      setLoadingBlockedDays(false);
    });
    // Cleanup subscription on component unmount
    return () => {
        console.log("AdminDashboard: Unsubscribing from blocked days.");
        unsubscribe();
    }
  }, []); // Empty dependency array ensures this runs only on mount/unmount

  const today = new Date().toISOString().split('T')[0];
  const todayReadable = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric'
  });

  // --- Stats Calculation ---
  // Note: These stats count *all* booked reservations, regardless of whether the day is blocked.
  // Adjust filtering if you only want stats for 'active' days.
  const totalReservationsCount = reservations.length;
  const todayReservations = reservations.filter(res => res.date === today);
  const todayReservationsCount = todayReservations.length;
  const upcomingReservationsCount = reservations.filter(res => res.date > today).length;

  // --- Delete Confirmation ---
  const handleCancelClick = (reservation: Reservation) => {
     // Check if the day is blocked - provide extra warning
     const isDayBlocked = blockedDays.has(reservation.date);
     const confirmationMessage = `Are you sure you want to cancel the appointment for ${reservation.name} on ${reservation.date} at ${reservation.time}?` +
        (isDayBlocked ? "\n\n(Note: This day is currently blocked for new bookings.)" : "");

    if (window.confirm(confirmationMessage)) {
      // Ensure reservation ID exists before calling delete
      if (reservation.id) {
          onDeleteReservation(reservation.id);
      } else {
          console.error("Cannot delete reservation: ID is missing.", reservation);
          alert("Error: Cannot delete reservation because its ID is missing.");
      }
    }
  };

  // --- Sorting Reservations ---
  // Sort primarily by date (ascending), then by time (ascending)
  const sortedReservations = [...reservations].sort((a, b) => {
    const dateComparison = a.date.localeCompare(b.date);
    if (dateComparison !== 0) {
      return dateComparison;
    }
    // If dates are the same, compare by time
    return getTimeValue(a.time) - getTimeValue(b.time);
  });

  // --- Phone Number Formatting ---
  const formatPhoneNumberForTelLink = (phoneNumber: string | undefined): string => {
    if (!phoneNumber) return ''; // Handle undefined case
    let cleaned = phoneNumber.replace(/\D/g, '');
    // Assume Israeli numbers if starting with 05 or 5 (normalize to +972)
    if (cleaned.startsWith('05') && cleaned.length === 10) {
        return `+972${cleaned.substring(1)}`; // 05... -> +9725...
    }
    if (cleaned.startsWith('5') && cleaned.length === 9) {
         return `+972${cleaned}`; // 5... -> +9725...
    }
    // Handle numbers already in international format
    if (cleaned.startsWith('972') && cleaned.length >= 12) {
        return `+${cleaned}`; // 972... -> +972...
    }
    if (cleaned.startsWith('+')) {
        return cleaned; // Already has + prefix
    }
    // Fallback for other formats (might not be dialable correctly)
    return cleaned; // Return cleaned number as is
  };


  return (
    <div className="admin-container">
      {/* Header */}
      <div className="admin-header">
        <h1 className="admin-title">Admin Dashboard</h1>
        <button className="back-link admin-signout-button" onClick={goBack} aria-label="Sign out">
          Sign Out →
        </button>
      </div>

      {/* Statistics Section */}
      <div className="stats-container">
        <div className="stat-card">
          <div className="stat-value">{totalReservationsCount}</div>
          <div className="stat-label">Total Booked</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{todayReservationsCount}</div>
          <div className="stat-label">Booked Today</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{upcomingReservationsCount}</div>
          <div className="stat-label">Booked Upcoming</div>
        </div>
      </div>

      {/* News Publisher Component */}
      <AdminNewsPublisher />

      {/* Day Blocker Component */}
      {loadingBlockedDays ? (
          <div className="day-blocker-card">Loading Day Management...</div>
      ) : (
          <AdminDayBlocker
              blockedDays={blockedDays}
              onBlockDay={blockDay}     // Pass direct service function
              onUnblockDay={unblockDay}   // Pass direct service function
          />
      )}

      {/* Appointments Table Section */}
      <div className="reservations-card admin-appointments-table-card">
        <div className="section-header">
          <h2 className="section-title">All Appointments</h2>
          {/* Optional: Add filter controls here later */}
        </div>
        {sortedReservations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <p>No appointments have been booked yet.</p>
          </div>
        ) : (
          <table className="reservation-table" aria-label="Appointments List">
            <thead>
              <tr>
                <th>Client Details</th>
                <th>Appointment Date & Time</th>
                <th>Status</th> {/* Added Status Column */}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedReservations.map((res) => {
                const isDayBlocked = blockedDays.has(res.date);
                return (
                    <tr key={res.id} className={`reservation-row ${isDayBlocked ? 'blocked-day-row' : ''}`}>
                    <td className="client-details-cell">
                        <div className="reservation-name">{res.name || 'Unknown Name'}</div>
                        <div className="reservation-phone-subline">
                        {res.phone ? (
                            <a href={`tel:${formatPhoneNumberForTelLink(res.phone)}`} className="phone-link">
                            {res.phone}
                            </a>
                        ) : (
                            'No phone'
                        )}
                        </div>
                    </td>
                    <td className="datetime-cell">
                        {/* Ensure date string is parsed correctly */}
                        <div>{new Date(res.date + 'T00:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' })}</div>
                        <div className="reservation-time-subline">{res.time}</div>
                    </td>
                    <td className="status-cell"> {/* Display Status */}
                        {isDayBlocked ? (
                        <span className="status-indicator blocked" title="Bookings disabled for this day">Day Blocked</span>
                        ) : (
                        <span className="status-indicator active">Active</span>
                        )}
                    </td>
                    <td className="actions-cell">
                        <button
                        className="action-button-small delete"
                        onClick={() => handleCancelClick(res)} // Pass the full reservation object
                        disabled={!res.id} // Disable if ID is missing
                        aria-label={`Cancel appointment for ${res.name} on ${res.date}`}
                        >
                        Cancel
                        </button>
                    </td>
                    </tr>
                );
               })}
            </tbody>
          </table>
        )}
      </div>

      {/* Today's Summary Section */}
      <div className="reservations-card admin-today-summary-card">
        <div className="section-header">
          <h2 className="section-title">Today • {todayReadable}</h2>
           {blockedDays.has(today) && <span className="status-indicator blocked">(Day Blocked)</span>}
        </div>
         {blockedDays.has(today) ? (
             <p>This day is blocked. New bookings are disabled. Appointments already booked for today are shown above.</p>
         ) : (
             <p>
                {todayReservationsCount === 0
                    ? "There are no appointments scheduled for today."
                    : `There ${todayReservationsCount === 1 ? 'is' : 'are'} ${todayReservationsCount} appointment${todayReservationsCount !== 1 ? 's' : ''} scheduled for today.`}
            </p>
         )}
      </div>

    </div>
  );
};