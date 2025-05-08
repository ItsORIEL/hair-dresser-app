// src/components/AdminDashboard.tsx
import React from 'react';
import './AdminDashboard.css';
import { Reservation } from '../services/firebase-service';

interface AdminDashboardProps {
  reservations: Reservation[];
  goBack: () => void;
  onDeleteReservation: (id: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  reservations,
  goBack,
  onDeleteReservation
}) => {
  const today = new Date().toISOString().split('T')[0];
  const todayReadable = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  const totalReservations = reservations.length;
  const todayReservationsCount = reservations.filter(res => res.date === today).length;

  const upcomingReservationsCount = reservations.filter(res => {
    const resDate = new Date(res.date);
    resDate.setHours(0,0,0,0);
    const currentDate = new Date(today);
    currentDate.setHours(0,0,0,0);
    return resDate > currentDate;
  }).length;

  const handleCancelClick = (id: string) => {
    if (window.confirm('Are you sure you want to cancel this appointment?')) {
      onDeleteReservation(id);
    }
  };

  const sortedReservations = [...reservations].sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    const getTimeValue = (timeStr: string) => {
      const hourMatch = timeStr.match(/(\d+):(\d+)\s*([AP]M)/i);
      if (!hourMatch) return 0;
      let hour = parseInt(hourMatch[1]);
      const minute = parseInt(hourMatch[2]);
      const ampm = hourMatch[3].toUpperCase();
      if (ampm === 'PM' && hour < 12) hour += 12;
      if (ampm === 'AM' && hour === 12) hour = 0;
      return hour * 60 + minute;
    };
    return getTimeValue(a.time) - getTimeValue(b.time);
  });

  // Helper function to format phone for 'tel:' URI (basic version)
  // Assumes phone is stored like '0501234567' or '+972501234567'
  const formatPhoneNumberForTelLink = (phoneNumber: string) => {
    let cleaned = phoneNumber.replace(/\D/g, ''); // Remove non-digits
    if (cleaned.startsWith('0') && cleaned.length === 10) { // Common Israeli format like 05...
      return `+972${cleaned.substring(1)}`;
    }
    if (cleaned.startsWith('972') && cleaned.length > 9) { // Already has country code but no +
        return `+${cleaned}`
    }
    // If it's already in E.164 format like +972...
    if (cleaned.startsWith('+')) {
        return cleaned;
    }
    // Fallback for other formats, might need more robust parsing
    return cleaned;
  };


  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1 className="admin-title">Admin Dashboard</h1>
        <button className="back-link" onClick={goBack} style={{color: 'var(--primary-color)'}}>
          Sign Out →
        </button>
      </div>

      <div className="stats-container">
        <div className="stat-card">
          <div className="stat-value">{totalReservations}</div>
          <div className="stat-label">Total Appointments</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{todayReservationsCount}</div>
          <div className="stat-label">Today's Appointments</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{upcomingReservationsCount}</div>
          <div className="stat-label">Upcoming (After Today)</div>
        </div>
      </div>

      <div className="reservations-card">
        <div className="section-header">
          <h2 className="section-title">All Appointments</h2>
        </div>
        {sortedReservations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <p>No appointments have been made yet.</p>
          </div>
        ) : (
          <table className="reservation-table">
            <thead>
              <tr>
                <th>Client Details</th>
                <th>Appointment Date & Time</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedReservations.map((res) => (
                <tr key={res.id} className="reservation-row">
                  <td className="client-details-cell">
                    <div className="reservation-name">{res.name}</div>
                    {/* MODIFIED: Make phone number clickable */}
                    <div className="reservation-phone-subline">
                      <a href={`tel:${formatPhoneNumberForTelLink(res.phone)}`} className="phone-link">
                        {res.phone} {/* Display the original phone format for readability */}
                      </a>
                    </div>
                  </td>
                  <td className="datetime-cell">
                    <div>{new Date(res.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
                    <div className="reservation-time-subline">{res.time}</div>
                  </td>
                  <td className="actions-cell">
                    <button
                      className="action-button-small delete"
                      onClick={() => res.id && handleCancelClick(res.id)}
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="reservations-card" style={{marginTop: '30px'}}>
        <div className="section-header">
          <h2 className="section-title">Today • {todayReadable}</h2>
        </div>
        <p>
          {todayReservationsCount === 0
            ? "You have no appointments scheduled for today."
            : `You have ${todayReservationsCount} appointment${todayReservationsCount > 1 ? 's' : ''} scheduled for today.`}
        </p>
      </div>
    </div>
  );
};