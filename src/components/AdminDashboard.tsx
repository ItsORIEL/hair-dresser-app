// AdminDashboard.tsx
import React, { useState } from 'react';
import './AdminDashboard.css';

interface Reservation {
  name: string;
  phone: string;
  time: string;
}

interface AdminDashboardProps {
  reservations: Reservation[];
  goBack: () => void;
  onDeleteReservation: (index: number) => void; // Add this prop
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  reservations, 
  goBack, 
  onDeleteReservation 
}) => {
  const [selectedDay] = useState<string>('all');
  
  // Get today's date in a readable format
  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'short', 
    day: 'numeric' 
  });
  
  // Calculate statistics
  const totalReservations = reservations.length;
  const todayReservations = reservations.filter(res => {
    // In a real app, you would filter by today's date
    // For demo purposes, we'll just take a subset
    return res.time.includes('1:00');
  }).length;
  
  const upcomingReservations = reservations.filter(res => {
    // In a real app, you would compare with current time
    // For demo purposes, we'll just take a subset
    return res.time.includes('2:00') || res.time.includes('3:00');
  }).length;
  
  // Filter reservations based on selected day
  const filteredReservations = selectedDay === 'all' 
    ? reservations 
    : reservations.filter(res => {
        // In a real app, you would filter by the selected day
        // For demo, we'll just pretend
        return selectedDay === 'today' ? res.time.includes('1:00') : true;
      });

  // Function to handle cancellation confirmation
  const handleCancelClick = (index: number) => {
    if (window.confirm('Are you sure you want to cancel this appointment?')) {
      onDeleteReservation(index);
    }
  };

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
          <button className="add-button">
            <span className="add-icon">+</span> Add Appointment
          </button>
        </div>
        
        {reservations.length === 0 ? (
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
                <th>Time</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReservations.map((res, index) => (
                <tr key={index} className="reservation-row">
                  <td className="reservation-name">{res.name}</td>
                  <td className="reservation-phone">{res.phone}</td>
                  <td className="reservation-time">{res.time}</td>
                  <td className="actions-cell">
                    <button 
                      className="action-button-small delete"
                      onClick={() => handleCancelClick(index)}
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
          <h2 className="section-title">Today • {today}</h2>
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