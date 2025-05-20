// src/components/AdminDashboard.tsx
import React, { useState, useEffect, useMemo } from 'react';
import './AdminDashboard.css';
import { Reservation, getBlockedDays, blockDay, unblockDay } from '../services/firebase-service';
import { AdminNewsPublisher } from './AdminNewsPublisher';
import { AdminDayBlocker } from './AdminDayBlocker';
import { AdminTimeSlotBlocker } from './AdminTimeSlotBlocker';

interface AdminDashboardProps {
  reservations: Reservation[];
  goBack: () => void;
  onDeleteReservation: (id: string) => void;
}

const getTimeValue = (timeStr: string): number => {
    const timeMatch = timeStr?.match(/(\d+):(\d+)\s*([AP]M)/i);
    if (!timeMatch) return 0;
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const modifier = timeMatch[3].toUpperCase();
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
};

const formatDateToDDMMYYYY = (dateString: string): string => {
  const date = new Date(dateString + 'T00:00:00Z');
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC', 
  });
};


export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  reservations,
  goBack,
  onDeleteReservation
}) => {
  const [blockedDays, setBlockedDays] = useState<Set<string>>(new Set());
  const [loadingBlockedDays, setLoadingBlockedDays] = useState(true);

  useEffect(() => {
    setLoadingBlockedDays(true);
    const unsubscribe = getBlockedDays((days) => {
      setBlockedDays(days);
      setLoadingBlockedDays(false);
    });
    return () => unsubscribe();
  }, []);

  const todayISO = useMemo(() => new Date().toISOString().split('T')[0], []);

  const todayReadable = useMemo(() => {
    const todayDate = new Date();
    return todayDate.toLocaleDateString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  }, []);


  const yesterdayISO = useMemo(() => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return y.toISOString().split('T')[0];
  }, []);

  // REMOVED: totalReservationsCount
  // const totalReservationsCount = reservations.length; 

  const todayReservationsCount = useMemo(() => reservations.filter(res => res.date === todayISO).length, [reservations, todayISO]);
  const upcomingReservationsCount = useMemo(() => reservations.filter(res => res.date > todayISO).length, [reservations, todayISO]);

  const handleCancelClick = (reservation: Reservation) => {
     const isDayBlocked = blockedDays.has(reservation.date);
     const displayDate = formatDateToDDMMYYYY(reservation.date);
     const confirmationMessage = `Are you sure you want to cancel the appointment for ${reservation.name} on ${displayDate} at ${reservation.time}?` +
        (isDayBlocked ? "\n\n(Note: This day is currently blocked for new bookings.)" : "");
    if (window.confirm(confirmationMessage)) {
      if (reservation.id) {
          onDeleteReservation(reservation.id);
      } else {
          console.error("Cannot delete reservation: ID is missing.", reservation);
          alert("Error: Cannot delete reservation because its ID is missing.");
      }
    }
  };

  const sortedReservations = useMemo(() => {
    return reservations
      .filter(res => res.date >= yesterdayISO) 
      .sort((a, b) => {
        const dateComparison = a.date.localeCompare(b.date);
        if (dateComparison !== 0) {
          return dateComparison;
        }
        return getTimeValue(a.time) - getTimeValue(b.time);
      });
  }, [reservations, yesterdayISO]); 

  const formatPhoneNumberForTelLink = (phoneNumber: string | undefined): string => {
    if (!phoneNumber) return '';
    let cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.startsWith('05') && cleaned.length === 10) { return `+972${cleaned.substring(1)}`; }
    if (cleaned.startsWith('5') && cleaned.length === 9) { return `+972${cleaned}`; }
    if (cleaned.startsWith('972') && cleaned.length >= 12) { return `+${cleaned}`; }
    if (cleaned.startsWith('+')) { return cleaned; }
    return cleaned;
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1 className="admin-title">Admin Dashboard</h1>
        <button className="back-link admin-signout-button" onClick={goBack} aria-label="Sign out">
          Sign Out →
        </button>
      </div>
      <div className="stats-container">
        {/* REMOVED: "Total Booked (All Time)" stat card */}
        {/* 
        <div className="stat-card">
          <div className="stat-value">{totalReservationsCount}</div>
          <div className="stat-label">Total Booked (All Time)</div>
        </div> 
        */}
        <div className="stat-card">
          <div className="stat-value">{todayReservationsCount}</div>
          <div className="stat-label">Booked Today</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{upcomingReservationsCount}</div>
          <div className="stat-label">Booked Upcoming</div>
        </div>
      </div>
      <AdminNewsPublisher />
      {loadingBlockedDays ? (
          <div className="day-blocker-card">Loading Day Management...</div>
      ) : (
          <AdminDayBlocker
              blockedDays={blockedDays}
              onBlockDay={blockDay}
              onUnblockDay={unblockDay}
          />
      )}
      <AdminTimeSlotBlocker />
      <div className="reservations-card admin-appointments-table-card">
        <div className="section-header">
          <h2 className="section-title">Appointments (Yesterday, Today & Upcoming)</h2>
        </div>
        {sortedReservations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <p>No relevant appointments (yesterday, today, or upcoming) found.</p>
          </div>
        ) : (
          <table className="reservation-table" aria-label="Appointments List">
            <thead>
              <tr>
                <th>Client Details</th>
                <th>Appointment Date & Time</th>
                <th>Status</th>
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
                        ) : ( 'No phone' )}
                        </div>
                    </td>
                    <td className="datetime-cell">
                        <div>{formatDateToDDMMYYYY(res.date)}</div>
                        <div className="reservation-time-subline">{res.time}</div>
                    </td>
                    <td className="status-cell">
                        {isDayBlocked ? (
                        <span className="status-indicator blocked" title="Bookings disabled for this day">Day Blocked</span>
                        ) : (
                        <span className="status-indicator active">Active</span>
                        )}
                    </td>
                    <td className="actions-cell">
                        <button
                        className="action-button-small delete"
                        onClick={() => handleCancelClick(res)}
                        disabled={!res.id}
                        aria-label={`Cancel appointment for ${res.name} on ${formatDateToDDMMYYYY(res.date)}`}
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
      <div className="reservations-card admin-today-summary-card">
        <div className="section-header">
          <h2 className="section-title">Today • {todayReadable}</h2>
           {blockedDays.has(todayISO) && <span className="status-indicator blocked">(Day Blocked)</span>}
        </div>
         {blockedDays.has(todayISO) ? (
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