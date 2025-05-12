// src/components/AdminDayBlocker.tsx
import React, { useState, useMemo } from 'react';

interface AdminDayBlockerProps {
  blockedDays: Set<string>;
  onBlockDay: (date: string) => Promise<void>;
  onUnblockDay: (date: string) => Promise<void>;
}

export const AdminDayBlocker: React.FC<AdminDayBlockerProps> = ({
  blockedDays,
  onBlockDay,
  onUnblockDay,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const handleAction = async (action: 'block' | 'unblock', date: string) => {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Please select a valid date first.');
      return;
    }
    if (action === 'block' && blockedDays.has(date)) {
        setError(`Date ${date} is already blocked.`);
        return;
    }
     if (action === 'unblock' && !blockedDays.has(date)) {
        setError(`Date ${date} is not currently blocked.`);
        return;
    }
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      if (action === 'block') {
        await onBlockDay(date);
        setSuccessMessage(`Date ${date} blocked successfully.`);
      } else {
        await onUnblockDay(date);
        setSuccessMessage(`Date ${date} unblocked successfully.`);
      }
      setSelectedDate(''); // Clear input after successful action
    } catch (err: any) {
      console.error(`Error ${action}ing day ${date}:`, err);
      setError(`Failed to ${action} date ${date}. ${err.message || 'Please try again.'}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        setError(null);
        setSuccessMessage(null);
      }, 4000);
    }
  };

  const sortedBlockedDays = useMemo(() => Array.from(blockedDays).sort(), [blockedDays]);

  return (
    <div className="day-blocker-card">
      <h3 className="section-title day-blocker-title">Manage Blocked Days / Days Off</h3>
      <p className="day-blocker-description">Select a date and choose to block or unblock it for client bookings.</p>
      <div className="day-blocker-controls">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => {
              setSelectedDate(e.target.value);
              setError(null);
              setSuccessMessage(null);
          }}
          className="day-blocker-date-input"
          min={today}
          aria-label="Select date to manage"
        />
        <div className="day-blocker-buttons">
          <button
            onClick={() => handleAction('block', selectedDate)}
            disabled={isLoading || !selectedDate || blockedDays.has(selectedDate)}
            className="day-blocker-button block"
            title={blockedDays.has(selectedDate) ? 'Date is already blocked' : 'Block this date'}
          >
            {isLoading ? 'Blocking...' : 'Block Selected Date'}
          </button>
          <button
            onClick={() => handleAction('unblock', selectedDate)}
            disabled={isLoading || !selectedDate || !blockedDays.has(selectedDate)}
            className="day-blocker-button unblock"
             title={!blockedDays.has(selectedDate) ? 'Date is not blocked' : 'Unblock this date'}
          >
            {isLoading ? 'Unblocking...' : 'Unblock Selected Date'}
          </button>
        </div>
      </div>
      {error && <p className="day-blocker-status error" role="alert">{error}</p>}
      {successMessage && <p className="day-blocker-status success" role="status">{successMessage}</p>}
      <div className="blocked-days-list">
        <h4 className="blocked-list-title">Currently Blocked Dates:</h4>
        {sortedBlockedDays.length === 0 ? (
          <p className="blocked-list-empty">No dates are currently blocked.</p>
        ) : (
          <ul aria-label="List of currently blocked dates">
            {sortedBlockedDays.map((date) => (
              <li key={date} className="blocked-list-item">
                <span>
                  {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
                <button
                  onClick={() => handleAction('unblock', date)}
                  disabled={isLoading}
                  className="unblock-list-button"
                  aria-label={`Unblock date ${date}`}
                >
                  {isLoading ? '...' : 'Unblock'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};