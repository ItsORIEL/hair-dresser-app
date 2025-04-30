// AdminDashboard.tsx
import React, { useState } from 'react';
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
  const [selectedDay] = useState<string>('all');
  
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  
  // Get today's date in a readable format
  const todayReadable = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'short', 
    day: 'numeric' 
  });
  
  // Calculate statistics
  const totalReservations = reservations.length;
  
  const todayReservations = reservations.filter(res => 
    res.date === today
  ).length;
  
  const upcomingReservations = reservations.filter(res => {
    const resDate = new Date(res.date);
    const currentDate = new Date();
    return resDate > currentDate && res.date !== today;
  }).length;
  
  // Filter reservations based on selected day
  const filteredReservations = selectedDay === 'all' 
    ? reservations 
    : reservations.filter(res => {
        return selectedDay === 'today' ? res.date === today : true;
      });

  // Function to handle cancellation confirmation
  const handleCancelClick = (id: string) => {
    if (window.confirm('Are you sure you want to cancel this appointment?')) {
      onDeleteReservation(id);
    }
  };

  // Sort reservations by date and time
  const sortedReservations = [...filteredReservations].sort((a, b) => {
    // First compare by date
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    
    // If dates are the same, compare by time
    // Extract hour and convert to 24-hour format for proper sorting
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

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1 className="admin-title">Admin Dashboard</h1>
        <button className="back-link" onClick={goBack}>
          ← Back to login
        </button>
      </div>
      
      {/* Statistics Cards */}
      <div className="stats-container">
        <div className="stat-card">
          <div className="stat-value">{totalReservations}</div>
          <div className="stat-label">Total Appointments</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{todayReservations}</div>
          <div className="stat-label">Today's Appointments</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{upcomingReservations}</div>
          <div className="stat-label">Upcoming</div>
        </div>
      </div>
      
      {/* Reservations Section */}
      <div className="reservations-card">
        <div className="section-header">
          <h2 className="section-title">Appointments</h2>
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
                <th>Client</th>
                <th>Phone</th>
                <th>Date</th>
                <th>Time</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedReservations.map((res) => (
                <tr key={res.id} className="reservation-row">
                  <td className="reservation-name">{res.name}</td>
                  <td className="reservation-phone">{res.phone}</td>
                  <td>{new Date(res.date).toLocaleDateString()}</td>
                  <td className="reservation-time">{res.time}</td>
                  <td className="actions-cell">
                    <button 
                      className="action-button-small delete"
                      onClick={() => handleCancelClick(res.id!)}
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
      
      {/* Additional info section */}
      <div className="reservations-card">
        <div className="section-header">
          <h2 className="section-title">Today • {todayReadable}</h2>
        </div>
        
        <p>
          {todayReservations === 0 ? 
            "You have no appointments scheduled for today." : 
            `You have ${todayReservations} appointment${todayReservations > 1 ? 's' : ''} scheduled for today.`}
        </p>
      </div>
    </div>
  );
};