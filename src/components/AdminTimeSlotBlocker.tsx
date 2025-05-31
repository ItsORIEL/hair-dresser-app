// src/components/AdminTimeSlotBlocker.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { BlockedTimeSlotsMap, getBlockedTimeSlots, blockTimeSlot, unblockTimeSlot } from '../services/firebase-service';

// MODIFIED: Added new times
const availableTimes: string[] = [ 
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
    '18:00', '18:30', '19:00' // New times added
];

const timeToMinutes = (timeStr: string): number => { 
    const match = timeStr.match(/(\d{2}):(\d{2})/);
    if (!match) return -1;
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
};

const formatDateToDDMMYYYY_AdminTimeBlocker = (dateString: string): string => {
  const date = new Date(dateString + 'T00:00:00Z');
  return date.toLocaleDateString('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric', weekday: 'short', timeZone: 'UTC',
  });
};

const getTodayISO_TSB = () => new Date().toISOString().split('T')[0];

export const AdminTimeSlotBlocker: React.FC = () => {
  const [blockedSlots, setBlockedSlots] = useState<BlockedTimeSlotsMap>(new Map());
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');
  // Ensure default endTime is updated if the array length changes significantly
  const [startTime, setStartTime] = useState<string>(availableTimes[0]);
  const [endTime, setEndTime] = useState<string>(availableTimes[availableTimes.length - 1]); 
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isUnblockingAllSlots, setIsUnblockingAllSlots] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const todayISO = useMemo(() => getTodayISO_TSB(), []);

  useEffect(() => {
    setLoadingSlots(true);
    const unsubscribe = getBlockedTimeSlots((slotsMap) => {
      setBlockedSlots(slotsMap); setLoadingSlots(false);
    });
    return () => unsubscribe();
  }, []);

  const handleBlockRange = async () => {
    if (!selectedDate) { setError('אנא בחר תאריך.'); return; }
    if (!startTime || !endTime) { setError('אנא בחר שעת התחלה ושעת סיום.'); return; }
    const startM = timeToMinutes(startTime); const endM = timeToMinutes(endTime);
    if (startM === -1 || endM === -1) { setError('פורמט שעה לא תקין. צפוי HH:MM.'); return; }
    if (startM > endM) { setError('שעת ההתחלה חייבת להיות לפני או זהה לשעת הסיום.'); return; }

    setIsProcessing(true); setError(null); setSuccessMessage(null);
    const slotsToBlock: string[] = [];
    // The availableTimes array used here now includes the new times
    availableTimes.forEach(slot => { 
        const slotM = timeToMinutes(slot);
        if (slotM >= startM && slotM <= endM && !(blockedSlots.get(selectedDate)?.has(slot))) {
            slotsToBlock.push(slot);
        }
    });

    if (slotsToBlock.length === 0) {
        setSuccessMessage('אין חלונות זמן חדשים לחסימה בטווח שנבחר (ייתכן שכבר חסומים או שהטווח ריק).');
        setIsProcessing(false); setTimeout(() => setSuccessMessage(null), 5000); return;
    }
    try {
      await Promise.all(slotsToBlock.map(slot => blockTimeSlot(selectedDate, slot)));
      setSuccessMessage(`נחסמו ${slotsToBlock.length} חלונות זמן מ-${startTime} עד ${endTime} בתאריך ${formatDateToDDMMYYYY_AdminTimeBlocker(selectedDate)}.`);
    } catch (err: any) { setError(`חסימת טווח הזמנים נכשלה: ${err.message || 'אנא נסה שוב.'}`);
    } finally { setIsProcessing(false); setTimeout(() => { setError(null); setSuccessMessage(null); }, 5000); }
  };

  const handleDirectUnblock = async (date: string, time: string) => { 
      setIsProcessing(true); setError(null); setSuccessMessage(null);
      try {
          await unblockTimeSlot(date, time); 
          setSuccessMessage(`חסימת חלון הזמן ${time} בתאריך ${formatDateToDDMMYYYY_AdminTimeBlocker(date)} בוטלה.`);
      } catch (err: any) { setError(`ביטול חסימת ${time} בתאריך ${formatDateToDDMMYYYY_AdminTimeBlocker(date)} נכשל: ${err.message}`);
      } finally { setIsProcessing(false); setTimeout(() => { setError(null); setSuccessMessage(null); }, 4000); }
  };

  const displayedBlockedSlotsList = useMemo(() => {
    const list: { date: string; time: string }[] = [];
    const sortedDates = Array.from(blockedSlots.keys())
                          .filter(dateStr => dateStr >= todayISO) 
                          .sort();
    sortedDates.forEach(date => {
        const times = Array.from(blockedSlots.get(date) || [])
                        .sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
        times.forEach(time => list.push({ date, time }));
    });
    return list;
  }, [blockedSlots, todayISO]);

  const handleUnblockAllFutureSlots = async () => {
    if (displayedBlockedSlotsList.length === 0) {
        setSuccessMessage("אין חלונות זמן עתידיים שחסומים כעת.");
        setTimeout(() => setSuccessMessage(null), 3000);
        return;
    }
    if (window.confirm(`האם לבטל חסימה של כל ${displayedBlockedSlotsList.length} חלונות הזמן העתידיים החסומים הרשומים? לא ניתן לשחזר פעולה זו.`)) {
        setIsUnblockingAllSlots(true);
        setError(null); setSuccessMessage(null);
        let unblockCount = 0; let failedCount = 0;
        try {
            const unblockPromises = displayedBlockedSlotsList.map(slot => 
                unblockTimeSlot(slot.date, slot.time)
                    .then(() => unblockCount++)
                    .catch(individualError => {
                        console.error(`Failed to unblock slot ${slot.time} on ${slot.date}:`, individualError);
                        failedCount++;
                    })
            );
            await Promise.all(unblockPromises); 
            if (failedCount > 0) {
                setError(`בוטלה חסימה של ${unblockCount} חלונות זמן. ${failedCount} חלונות זמן לא בוטלו. בדוק קונסול.`);
            } else {
                setSuccessMessage(`בוטלה חסימה של כל ${unblockCount} חלונות הזמן העתידיים.`);
            }
        } catch (err: any) { 
            setError(`אירעה שגיאה בביטול חסימת כל חלונות הזמן. ${err.message || 'אנא נסה שוב.'}`);
        } finally {
            setIsUnblockingAllSlots(false);
            setTimeout(() => { setError(null); setSuccessMessage(null); }, 6000);
        }
    }
  };

  const filteredEndTimes = useMemo(() => {
    const startM = timeToMinutes(startTime);
    // The availableTimes array used here now includes the new times
    return availableTimes.filter(t => timeToMinutes(t) >= startM);
  }, [startTime]);

  useEffect(() => {
    // Ensure endTime is valid if startTime changes
    const startM = timeToMinutes(startTime);
    const endM = timeToMinutes(endTime);
    if (startM > endM || !availableTimes.slice(availableTimes.indexOf(startTime)).includes(endTime)) {
        const validEndTimes = availableTimes.filter(t => timeToMinutes(t) >= startM);
        setEndTime(validEndTimes.length > 0 ? validEndTimes[0] : availableTimes[availableTimes.length - 1]);
    }
  }, [startTime, endTime]); // Removed availableTimes from here as it's constant within component

  return (
    <div className="timeslot-blocker-card">
      <h3 className="section-title timeslot-blocker-title">ניהול חלונות זמן חסומים</h3>
       <p className="timeslot-blocker-description">חסום טווח של חלונות זמן בתאריך נבחר. חסימות עבר מוסתרות מהרשימה.</p>
      <div className="timeslot-blocker-controls">
        <input type="date" value={selectedDate} onChange={(e)=>{setSelectedDate(e.target.value);setError(null);setSuccessMessage(null);}}
          className="timeslot-blocker-date-input" min={todayISO} aria-label="בחר תאריך לניהול חלונות זמן"/>
        <label htmlFor="start-time-select-admin" className="sr-only">שעת התחלה</label>
        {/* The select dropdowns will automatically include the new times */}
        <select id="start-time-select-admin" value={startTime} onChange={(e)=>{setStartTime(e.target.value);setError(null);setSuccessMessage(null);}} className="timeslot-blocker-time-select" aria-label="בחר שעת התחלה לטווח">{availableTimes.map(t=>(<option key={`start-${t}`} value={t}>{t}</option>))}</select>
        <span className="time-range-separator">עד</span>
        <label htmlFor="end-time-select-admin" className="sr-only">שעת סיום</label>
        <select id="end-time-select-admin" value={endTime} onChange={(e)=>{setEndTime(e.target.value);setError(null);setSuccessMessage(null);}} className="timeslot-blocker-time-select" aria-label="בחר שעת סיום לטווח">{filteredEndTimes.map(t=>(<option key={`end-${t}`} value={t}>{t}</option>))}</select>
        <div className="timeslot-blocker-buttons">
            <button onClick={handleBlockRange} disabled={isProcessing || isUnblockingAllSlots ||!selectedDate||!startTime||!endTime} 
                className="timeslot-blocker-button block" 
                title={selectedDate?`חסום טווח זמן נבחר בתאריך ${formatDateToDDMMYYYY_AdminTimeBlocker(selectedDate)}`:'חסום טווח זמן נבחר'}>
                {isProcessing?'חוסם טווח...':'חסום טווח'}
            </button>
        </div>
      </div>
      {error && <p className="timeslot-blocker-status error" role="alert">{error}</p>}
      {successMessage && <p className="timeslot-blocker-status success" role="status">{successMessage}</p>}
      
      <div className="blocked-timeslots-list">
        <div className="section-header" style={{ marginBottom: '10px', marginTop: '20px' }}>
            <h4 className="blocked-slots-list-title" style={{ marginBottom: '0'}}>חלונות זמן חסומים (היום ועתידיים):</h4>
            {displayedBlockedSlotsList.length > 0 && (
                 <button 
                    onClick={handleUnblockAllFutureSlots}
                    disabled={isUnblockingAllSlots || isProcessing}
                    className="action-button-small delete" 
                    style={{ marginLeft: 'auto', padding: '6px 12px' }}
                    title="בטל חסימה של כל חלונות הזמן העתידיים הרשומים"
                >
                    {isUnblockingAllSlots ? 'מבטל חסימות...' : 'בטל חסימת כל העתידיים'}
                </button>
            )}
        </div>
        {loadingSlots?(<p>טוען חלונות זמן חסומים...</p>)
         : displayedBlockedSlotsList.length===0?(<p className="blocked-slots-list-empty">אין חלונות זמן חסומים כעת או בעתיד.</p>)
         : (<ul aria-label="רשימת חלונות זמן חסומים כעת">
          {displayedBlockedSlotsList.map(({date,time})=>(<li key={`${date}-${time}`} className="blocked-slot-list-item">
            <span>{formatDateToDDMMYYYY_AdminTimeBlocker(date)}<span className="slot-time">{time}</span></span>
            <button onClick={()=>handleDirectUnblock(date,time)} disabled={isProcessing || isUnblockingAllSlots} className="unblock-slot-list-button" aria-label={`בטל חסימת חלון זמן ${time} בתאריך ${formatDateToDDMMYYYY_AdminTimeBlocker(date)}`}>{isProcessing || isUnblockingAllSlots ?'...':'בטל חסימה'}</button>
          </li>))}</ul>)}
      </div>
    </div>
  );
};