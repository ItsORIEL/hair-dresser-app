// src/components/AdminTimeSlotBlocker.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { BlockedTimeSlotsMap, getBlockedTimeSlots, blockTimeSlot, unblockTimeSlot } from '../services/firebase-service';

const availableTimes = [
    '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
    '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM',
    '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM'
];

const timeToMinutes = (timeStr: string): number => {
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return -1;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const modifier = match[3].toUpperCase();
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
};

export const AdminTimeSlotBlocker: React.FC = () => {
  const [blockedSlots, setBlockedSlots] = useState<BlockedTimeSlotsMap>(new Map());
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>(availableTimes[0]);
  const [endTime, setEndTime] = useState<string>(availableTimes[availableTimes.length -1]);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    setLoadingSlots(true);
    const unsubscribe = getBlockedTimeSlots((slotsMap) => {
      setBlockedSlots(slotsMap);
      setLoadingSlots(false);
    });
    return () => unsubscribe();
  }, []);

  const handleBlockRange = async () => {
    if (!selectedDate) {
      setError('Please select a date.');
      return;
    }
    if (!startTime || !endTime) {
        setError('Please select a start and end time for the range.');
        return;
    }

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);

    if (startMinutes === -1 || endMinutes === -1) {
        setError('Invalid start or end time format selected.');
        return;
    }
    // ***** CORRECTED CONDITION *****
    // Allow start time to be equal to end time (for single slot block)
    // but not greater.
    if (startMinutes > endMinutes) {
        setError('Start time must be before or the same as end time.');
        return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccessMessage(null);

    const slotsToBlock: string[] = [];
    availableTimes.forEach(slot => {
        const slotMinutes = timeToMinutes(slot);
        // Inclusive of start time, and inclusive of the slot matching end time
        if (slotMinutes >= startMinutes && slotMinutes <= endMinutes) {
            if (!(blockedSlots.get(selectedDate)?.has(slot))) {
                slotsToBlock.push(slot);
            }
        }
    });

    if (slotsToBlock.length === 0) {
        setSuccessMessage('No new slots to block in the selected range (they might be already blocked or range is empty).');
        setIsProcessing(false);
        setTimeout(() => { setSuccessMessage(null); }, 5000);
        return;
    }

    try {
      const promises = slotsToBlock.map(slot => blockTimeSlot(selectedDate, slot));
      await Promise.all(promises);
      setSuccessMessage(`Blocked ${slotsToBlock.length} slot(s) from ${startTime} to ${endTime} on ${selectedDate}.`);
    } catch (err: any) {
      console.error('Error blocking time slot range:', err);
      setError(`Failed to block range. ${err.message || 'Please try again.'}`);
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setError(null);
        setSuccessMessage(null);
      }, 5000);
    }
  };

  const handleDirectUnblock = async (date: string, time: string) => {
      setIsProcessing(true);
      setError(null);
      setSuccessMessage(null);
      try {
          await unblockTimeSlot(date, time);
          setSuccessMessage(`Slot ${time} on ${date} unblocked.`);
      } catch (err: any) {
          setError(`Failed to unblock ${time} on ${date}: ${err.message}`);
      } finally {
          setIsProcessing(false);
          setTimeout(() => {
            setError(null);
            setSuccessMessage(null);
          }, 4000);
      }
  };

  const sortedBlockedSlotsList = useMemo(() => {
    const list: { date: string; time: string }[] = [];
    const sortedDates = Array.from(blockedSlots.keys()).sort();
    sortedDates.forEach(date => {
        const times = Array.from(blockedSlots.get(date) || []).sort((a, b) => {
             const timeA = timeToMinutes(a);
             const timeB = timeToMinutes(b);
             return timeA - timeB;
        });
        times.forEach(time => list.push({ date, time }));
    });
    return list;
  }, [blockedSlots]);

  const filteredEndTimes = useMemo(() => {
    const startMin = timeToMinutes(startTime);
    return availableTimes.filter(time => timeToMinutes(time) >= startMin);
  }, [startTime]);

  useEffect(() => {
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    if (startMin > endMin) {
      const firstValidEndTime = filteredEndTimes.length > 0 ? filteredEndTimes[0] : availableTimes[availableTimes.length - 1];
      setEndTime(firstValidEndTime);
    }
  }, [startTime, endTime, filteredEndTimes]);


  return (
    <div className="timeslot-blocker-card">
      <h3 className="section-title timeslot-blocker-title">Manage Blocked Time Slots</h3>
       <p className="timeslot-blocker-description">Block a range of time slots on a selected date.</p>
      <div className="timeslot-blocker-controls">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => {
              setSelectedDate(e.target.value);
              setError(null); setSuccessMessage(null);
          }}
          className="timeslot-blocker-date-input"
          min={today}
          aria-label="Select date for time slot management"
        />
        <label htmlFor="start-time-select" className="sr-only">Start Time</label>
        <select
          id="start-time-select"
          value={startTime}
          onChange={(e) => {
              setStartTime(e.target.value);
              setError(null); setSuccessMessage(null);
          }}
          className="timeslot-blocker-time-select"
          aria-label="Select start time for range"
        >
          {availableTimes.map(time => (
            <option key={`start-${time}`} value={time}>{time}</option>
          ))}
        </select>
        <span className="time-range-separator">to</span>
        <label htmlFor="end-time-select" className="sr-only">End Time</label>
        <select
          id="end-time-select"
          value={endTime}
          onChange={(e) => {
              setEndTime(e.target.value);
              setError(null); setSuccessMessage(null);
          }}
          className="timeslot-blocker-time-select"
          aria-label="Select end time for range"
        >
          {filteredEndTimes.map(time => (
            <option key={`end-${time}`} value={time}>{time}</option>
          ))}
        </select>
        <div className="timeslot-blocker-buttons">
          <button
            onClick={handleBlockRange}
            disabled={isProcessing || !selectedDate || !startTime || !endTime}
            className="timeslot-blocker-button block"
            title={'Block selected time range'}
          >
            {isProcessing ? 'Blocking Range...' : 'Block Range'}
          </button>
        </div>
      </div>
      {error && <p className="timeslot-blocker-status error" role="alert">{error}</p>}
      {successMessage && <p className="timeslot-blocker-status success" role="status">{successMessage}</p>}
      <div className="blocked-timeslots-list">
        <h4 className="blocked-slots-list-title">Currently Blocked Time Slots:</h4>
        {loadingSlots ? (
           <p className="blocked-slots-list-empty">Loading blocked slots...</p>
        ) : sortedBlockedSlotsList.length === 0 ? (
          <p className="blocked-slots-list-empty">No specific time slots are currently blocked.</p>
        ) : (
          <ul aria-label="List of currently blocked time slots">
            {sortedBlockedSlotsList.map(({ date, time }) => (
              <li key={`${date}-${time}`} className="blocked-slot-list-item">
                <span>
                  {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  <span className="slot-time">{time}</span>
                </span>
                <button
                  onClick={() => handleDirectUnblock(date, time)}
                  disabled={isProcessing}
                  className="unblock-slot-list-button"
                  aria-label={`Unblock time slot ${time} on ${date}`}
                >
                  {isProcessing ? '...' : 'Unblock'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};