// src/components/ClientPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import './ClientPage.css';
import { Reservation as ReservationType, BlockedTimeSlotsMap, BarberNews } from '../services/firebase-service';

interface ClientPageProps {
  latestBarberNews: BarberNews | null;
  userName: string;
  availableTimes: string[];
  userReservation: ReservationType | null;
  handleReservation: (time: string) => Promise<void>;
  goBack: () => void;
  isReservedByCurrentUser: (time: string) => boolean;
  isReservedByOthers: (time: string) => boolean;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  // This is the line to change:
  generateNextFiveDays: () => { day: string, date: string, fullDate: string }[]; // CORRECTED TYPE
  onUpdatePhoneNumber: () => void;
  blockedDays: Set<string>;
  blockedTimeSlots: BlockedTimeSlotsMap;
}

const formatDateToHebrew_Client = (dateInput: string | Date | number, options?: Intl.DateTimeFormatOptions): string => {
  let date: Date;
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    date = new Date(dateInput + 'T00:00:00Z');
  } else {
    date = new Date(dateInput);
  }
  if (isNaN(date.getTime())) return 'תאריך לא תקין';

  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) ? 'UTC' : undefined
  };

  const finalOptions: Intl.DateTimeFormatOptions = { ...defaultOptions, ...options };
  if (finalOptions.hour) {
      finalOptions.hour12 = false;
      if (!finalOptions.minute) finalOptions.minute = '2-digit';
  }

  return date.toLocaleDateString('he-IL', finalOptions);
};

const getHebrewDayName = (dayIndex: number): string => {
    const hebrewDays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    return hebrewDays[dayIndex] || '';
};

export const ClientPage: React.FC<ClientPageProps> = ({
  latestBarberNews, userName, availableTimes, userReservation,
  handleReservation, goBack, isReservedByCurrentUser,
  isReservedByOthers, selectedDate, setSelectedDate, generateNextFiveDays: propGenerateNextFiveDays,
  onUpdatePhoneNumber, blockedDays, blockedTimeSlots,
}) => {
  const [datesToDisplay, setDatesToDisplay] = useState<{ day: string, date: string, fullDate: string, hebrewDayName: string }[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const stableGenerateNextFiveDays = useCallback(() => {
    const generatedRawDates = propGenerateNextFiveDays(); // Now correctly expects raw dates
    return generatedRawDates.map(d => {
        const dateObj = new Date(d.fullDate + 'T00:00:00Z');
        return {
            ...d,
            hebrewDayName: getHebrewDayName(dateObj.getDay())
        };
    });
  }, [propGenerateNextFiveDays]);

  useEffect(() => {
    const newDatesToDisplay = stableGenerateNextFiveDays();
    setDatesToDisplay(newDatesToDisplay);
    setSelectedTime(null);
    if (newDatesToDisplay.length > 0 && !newDatesToDisplay.some(d => d.fullDate === selectedDate)) {
        setSelectedDate(newDatesToDisplay[0].fullDate);
    } else if (newDatesToDisplay.length === 0 && selectedDate !== '') {
        // console.warn("ClientPage: No available dates after generation.");
    }
  }, [stableGenerateNextFiveDays, selectedDate, setSelectedDate]);

  const handleDateSelection = useCallback((date: string) => {
    if (!blockedDays.has(date)) { setSelectedDate(date); setSelectedTime(null); }
  }, [blockedDays, setSelectedDate]);

  const handleTimeSelection = useCallback((time: string) => {
    if (userReservation) {
        if (userReservation.time === time) return;
        if (window.confirm(`האם לשנות את התור מהשעה ${userReservation.time} לשעה ${time}?`)) {
            handleReservation(time);
            setSelectedTime(null);
        }
    } else {
        setSelectedTime(time);
    }
  }, [userReservation, handleReservation]);

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
        const match = time.match(/(\d{2}):(\d{2})/);
        if (!match) return true;
        const hours = parseInt(match[1],10); const minutes = parseInt(match[2],10);
        const apptDate = new Date(selectedDate + 'T00:00:00');
        apptDate.setHours(hours, minutes, 0, 0);
        return apptDate <= now;
    } catch (e) { return true; }
  }, [selectedDate]);

  const isSelectedDateBlockedByAdmin = blockedDays.has(selectedDate);

  return (
    <div className="appointment-container">
      <div className="client-page-header">
        <h1 className="page-title">ברוך הבא, {userName}!</h1>
        <div className="client-header-actions">
          <button className="action-button-small client-update-phone-btn" onClick={onUpdatePhoneNumber} aria-label="עדכן מספר טלפון">עדכן טלפון</button>
          <button className="back-button client-signout-btn" onClick={goBack} aria-label="התנתקות">התנתק ←</button>
        </div>
      </div>
      <div className="appointment-card news-log-card" aria-live="polite">
        {latestBarberNews ? (
          <div><h3 className="card-label news-label">חדשות אחרונות מהספר</h3>
            <p className="card-title news-message">{latestBarberNews.message}</p>
            <p className="card-subtitle news-timestamp">פורסם: {formatDateToHebrew_Client(latestBarberNews.timestamp as number, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        ) : (<div><h3 className="card-label news-label">חדשות מהספר</h3><p className="card-title news-message">אין עדכוני חדשות כרגע.</p></div>)}
      </div>
      <div className="appointment-card client-booking-card">
        <div className="date-selector client-date-selector" role="radiogroup" aria-label="בחר תאריך לתור">
          {datesToDisplay.map((dateObj) => {
            const isDayOptionBlockedByAdmin = blockedDays.has(dateObj.fullDate);
            const isSelected = selectedDate === dateObj.fullDate;
            return (
              <div key={dateObj.fullDate} role="radio" aria-checked={isSelected} aria-disabled={isDayOptionBlockedByAdmin}
                className={`date-option ${isSelected ? 'selected':''} ${isDayOptionBlockedByAdmin ? 'blocked':''}`}
                onClick={()=>!isDayOptionBlockedByAdmin && handleDateSelection(dateObj.fullDate)} tabIndex={isDayOptionBlockedByAdmin ? -1:0}
                onKeyDown={(e) => {if(!isDayOptionBlockedByAdmin && (e.key==='Enter'||e.key===' ')) handleDateSelection(dateObj.fullDate);}}
                title={isDayOptionBlockedByAdmin ? "יום לא זמין" : `בחר ${dateObj.hebrewDayName}, ${dateObj.date} (${formatDateToHebrew_Client(dateObj.fullDate)})`}>
                <div className="date-day">{dateObj.hebrewDayName}</div>
                <div className="date-number">{dateObj.date}</div>
                {isDayOptionBlockedByAdmin && <div className="blocked-indicator-client" aria-hidden="true">לא זמין</div>}
              </div>);
          })}
          {datesToDisplay.length === 0 && (<p className="no-dates-available">לא נמצאו תאריכים פנויים בקרוב.</p>)}
        </div>
        {selectedDate && !isSelectedDateBlockedByAdmin && (<>
          <div className="time-zone" aria-hidden="true">השעות מוצגות לפי אזור הזמן המקומי שלך.</div>
          <div className="time-grid" role="radiogroup" aria-label={`בחר שעת תור לתאריך ${formatDateToHebrew_Client(selectedDate)}`}>
            {availableTimes.map((t) => {
                const uSlot = isReservedByCurrentUser(t); const oSlot = isReservedByOthers(t);
                const pst = isTimeInPast(t); const admBlk = blockedTimeSlots.get(selectedDate)?.has(t) ?? false;
                const selNew = selectedTime === t && !userReservation;
                const dis = pst || oSlot || admBlk || (!!userReservation && uSlot);
                let cls='time-button'; let stat='';
                const fDate = formatDateToHebrew_Client(selectedDate);
                let ar=`בחר שעה ${t} בתאריך ${fDate}`; let tl=`הזמן ${t} בתאריך ${fDate}`;

                if(pst){cls+=' booked'; stat='(עבר)'; ar=`חלון זמן ${t} בתאריך ${fDate} עבר ואינו זמין.`; tl=ar;}
                else if(admBlk){cls+=' booked admin-blocked-slot'; stat='(לא זמין)'; ar=`חלון זמן ${t} בתאריך ${fDate} אינו זמין כעת.`; tl=ar;}
                else if(uSlot){cls+=' your-reservation'; stat='(התור שלך)'; ar=`התור הנוכחי שלך בתאריך ${fDate} הוא בשעה ${t}. בחר שעה פנויה אחרת לשינוי.`; tl=ar;}
                else if(oSlot){cls+=' booked'; stat='(תפוס)'; ar=`חלון זמן ${t} בתאריך ${fDate} כבר תפוס.`; tl=ar;}
                else if(selNew){cls+=' selected'; stat='(נבחר)'; ar=`שעה ${t} בתאריך ${fDate} נבחרה, לחץ אישור למטה.`; tl=ar;}
                else if(userReservation && !uSlot && !oSlot && !pst && !admBlk) {stat='(שנה תור)'; ar=`שנה תור לשעה ${t} בתאריך ${fDate}`; tl=ar;}

                return (<button key={t} role="radio" aria-checked={selNew||uSlot} aria-disabled={dis}
                  className={cls} onClick={()=>!dis && handleTimeSelection(t)} disabled={dis} title={tl} aria-label={ar}>
                  <span className="time-button-time-display">{t}</span>
                  <span className="time-button-status-display">{stat}</span>
                </button>);
            })}
          </div>
        </>)}
        {isSelectedDateBlockedByAdmin && (<div className="day-blocked-message" role="alert">יום זה אינו זמין כעת להזמנות. אנא בחר תאריך אחר.</div>)}
        <div className="button-group">
          {!userReservation && selectedTime && !isSelectedDateBlockedByAdmin &&
            (<button className="action-button" onClick={handleConfirmClick}
            aria-label={`אשר הזמנה לשעה ${selectedTime} בתאריך ${formatDateToHebrew_Client(selectedDate)}`}>אשר: {selectedTime}</button>)}
        </div>
      </div>
    </div>
  );
};