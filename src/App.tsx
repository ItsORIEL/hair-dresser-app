// src/App.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LoginPage } from './components/LoginPage';
import { ClientPage } from './components/ClientPage';
import { AdminDashboard } from './components/AdminDashboard';
import './App.css'; // Global styles
import { authInstance } from './firebase'; 
import {
  getReservations, createReservation, deleteReservation,
  getUserReservationForDate, isTimeSlotAvailable, Reservation,
  saveUserPhoneNumber, getUserPhoneNumber,
  getLatestBarberNews, BarberNews,
  signOut, onAuthStateChanged, 
  getBlockedDays,
  getBlockedTimeSlots, BlockedTimeSlotsMap
} from './services/firebase-service';
import { User } from 'firebase/auth';

const ADMIN_UID = 'B5X5Iqw9HGbMXm7qEdu7pDdxWP23'; 

const SHOW_FRIDAYS_BY_DEFAULT = true; 
const SHOW_SATURDAYS_BY_DEFAULT = false; 

const getCurrentDateISO = (offset: number = 0): string => { 
  const today = new Date();
  today.setDate(today.getDate() + offset);
  return today.toISOString().split('T')[0];
};

interface PhoneInputProps {
  onSubmit: (phone: string) => void;
  onCancel?: () => void;
  currentPhone?: string;
  isUpdating?: boolean;
}
const PhoneInputModal: React.FC<PhoneInputProps> = ({ onSubmit, onCancel, currentPhone, isUpdating }) => {
    const [phoneInput, setPhoneInput] = useState(currentPhone?.startsWith('0') ? currentPhone.substring(1) : currentPhone || '');
    const [error, setError] = useState('');
    const handleSubmit = () => {
      const israeliPhoneRegex = /^(05\d{8}|5\d{8})$/;
      let cleanedPhone = phoneInput.replace(/\D/g, '');
      if (cleanedPhone.startsWith('972')) { cleanedPhone = cleanedPhone.substring(3); }
      if (!israeliPhoneRegex.test(cleanedPhone)) {
        if (cleanedPhone.startsWith('5') && cleanedPhone.length === 9) { /* Allow normalization */ }
        else { setError('יש להזין מספר נייד ישראלי תקין (לדוגמה: 0501234567 או 501234567).'); return; }
      }
      const normalizedPhoneForDB = cleanedPhone.startsWith('5') && cleanedPhone.length === 9 ? '0' + cleanedPhone : cleanedPhone;
      if (!/^(05\d{8})$/.test(normalizedPhoneForDB)) { setError('פורמט מספר טלפון לא תקין לאחר נורמליזציה.'); return; }
      onSubmit(normalizedPhoneForDB); setError('');
    };
    return (
      <div className="modal-overlay">
        <div className="modal-content phone-input-modal-content">
          <h3>{isUpdating ? "עדכן את מספר הטלפון שלך" : "אנא הזן את מספר הטלפון שלך"}</h3>
          <p className="modal-subtitle">הוא ישמש עבור ההזמנות שלך.</p>
          <div className="phone-input-container-modal"> <span className="phone-prefix-modal">+972</span> <input type="tel" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ''))} placeholder="5X XXX XXXX" className="phone-actual-input-modal" maxLength={10} aria-required="true" aria-label="מספר טלפון נייד (לדוגמה 501234567)" /> </div>
          {error && <p className="modal-error" role="alert">{error}</p>}
          <div className="modal-actions"> <button onClick={handleSubmit} className="modal-button primary"> {isUpdating ? "עדכן" : "שמור מספר טלפון"} </button> {onCancel && ( <button onClick={onCancel} className="modal-button secondary"> ביטול </button> )} </div>
        </div>
      </div>
    );
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userPhone, setUserPhone] = useState<string | undefined>(undefined);
  const [page, setPage] = useState<'login' | 'client' | 'admin' | 'get_phone'>('login');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [latestNews, setLatestNews] = useState<BarberNews | null>(null);
  const [blockedDays, setBlockedDays] = useState<Set<string>>(new Set());
  const [blockedTimeSlots, setBlockedTimeSlots] = useState<BlockedTimeSlotsMap>(new Map());
  const [selectedDate, setSelectedDate] = useState<string>(() => getCurrentDateISO()); 
  const [loading, setLoading] = useState<boolean>(true);
  const [showPhoneUpdateModal, setShowPhoneUpdateModal] = useState(false);

  const todayISOString = useMemo(() => getCurrentDateISO(), []);

  const handleSignOut = useCallback(async () => {
    setLoading(true);
    try { await signOut(); }
    catch (error) { console.error("App: Sign out failed:", error); alert("ההתנתקות נכשלה."); setLoading(false); }
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(authInstance, async (userAuth) => {
      setCurrentUser(userAuth);
      if (userAuth) {
        try {
          const phone = await getUserPhoneNumber(userAuth.uid);
          setUserPhone(phone);
          if (userAuth.uid === ADMIN_UID) setPage('admin');
          else if (phone) setPage('client');
          else setPage('get_phone');
        } catch (error) {
          console.error("App: Error post-auth setup:", error); alert("שגיאה בהגדרת החיבור.");
          await handleSignOut(); setPage('login');
        }
      } else {
        setCurrentUser(null); setUserPhone(undefined); setReservations([]); setPage('login');
      }
      setLoading(false);
    });

    let unsubscribeReservations: (() => void) | null = null;
    if (currentUser) { unsubscribeReservations = getReservations(setReservations); }
    const unsubscribeBlockedDays = getBlockedDays(setBlockedDays);
    const unsubscribeNews = getLatestBarberNews(setLatestNews);
    const unsubscribeBlockedTimeSlots = getBlockedTimeSlots(setBlockedTimeSlots);

    return () => {
      unsubscribeAuth(); unsubscribeBlockedDays(); unsubscribeNews(); unsubscribeBlockedTimeSlots();
      if (unsubscribeReservations) unsubscribeReservations();
    };
  }, [currentUser, handleSignOut]);

  const handlePhoneSubmit = useCallback(async (phone: string) => {
    if (!currentUser) return; setLoading(true);
    try {
      await saveUserPhoneNumber(currentUser.uid, phone, currentUser.displayName || "משתמש", currentUser.email);
      setUserPhone(phone);
      if (currentUser.uid !== ADMIN_UID) setPage('client'); else setPage('admin');
      setShowPhoneUpdateModal(false);
    } catch (error) { console.error("App: Error saving phone:", error); alert("שמירת מספר הטלפון נכשלה.");
    } finally { setLoading(false); }
  }, [currentUser]);

  const rawGenerateNextFiveDays = useCallback(() => {
      // console.log(`%cApp.tsx: rawGenerateNextFiveDays. Today: ${todayISOString}. Fri Default: ${SHOW_FRIDAYS_BY_DEFAULT}, Sat Default: ${SHOW_SATURDAYS_BY_DEFAULT}`, "color: blue; font-weight: bold;");
      // console.log("Current blockedDays:", blockedDays);
      const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // English for logic, Hebrew display handled in ClientPage
      const newAvailableDates: { day: string, date: string, fullDate: string }[] = [];
      let count = 0; let offset = 0;

      while (count < 5 && offset < 30) {
        const dateCandidate = new Date(); 
        dateCandidate.setDate(dateCandidate.getDate() + offset); 
        const dayIndex = dateCandidate.getDay(); 
        const fullDateStr = dateCandidate.toISOString().split('T')[0];
        
        const isPast = fullDateStr < todayISOString;
        const isAdminBlocked = blockedDays.has(fullDateStr);
        
        let skipDay = false;
        // let skipReason = ''; // For detailed logging if needed

        if (isPast) { skipDay = true; /* skipReason += 'Past '; */ }
        if (dayIndex === 5 && !SHOW_FRIDAYS_BY_DEFAULT) { skipDay = true; /* skipReason += 'Friday (Default Off) '; */ }
        if (dayIndex === 6 && !SHOW_SATURDAYS_BY_DEFAULT) { skipDay = true; /* skipReason += 'Saturday (Default Off) '; */ }
        if (isAdminBlocked) { skipDay = true; /* skipReason += 'AdminBlocked '; */ }

        // console.log(`  Checking candidate: ${fullDateStr} (Day: ${daysOfWeek[dayIndex]}) -> Skip: ${skipDay}, Reason: ${skipReason.trim()}`);

        if (!skipDay) {
            newAvailableDates.push({
                day: daysOfWeek[dayIndex], // Keep 'Mon', 'Tue' for potential logic if needed elsewhere, ClientPage will translate
                // ***** THIS IS THE MODIFIED LINE *****
                date: dateCandidate.toLocaleDateString('he-IL', { month: 'long', day: 'numeric' }), // Hebrew month and day
                fullDate: fullDateStr
            });
            count++;
            // console.log(`    %cAdded: ${fullDateStr}. Count is now: ${count}`, "color: green;");
        } else {
            // console.log(`    %cSkipped: ${fullDateStr}. Reason: ${skipReason.trim()}`, "color: orange;");
        }
        offset++;
      }
      // console.log(`%cApp.tsx: rawGenerateNextFiveDays produced: [${newAvailableDates.map(d => d.fullDate).join(', ')}]`, "color: blue; font-weight: bold;");
      return newAvailableDates;
  }, [blockedDays, todayISOString]); 

  const [generatedAvailableDates, setGeneratedAvailableDates] = useState<{ day: string, date: string, fullDate: string }[]>([]);

  useEffect(() => {
    setGeneratedAvailableDates(rawGenerateNextFiveDays());
  }, [rawGenerateNextFiveDays]);

  useEffect(() => {
    if (generatedAvailableDates.length > 0) {
        const isSelectedDateStillValid = generatedAvailableDates.some(d => d.fullDate === selectedDate);
        if (!selectedDate || !isSelectedDateStillValid) { 
            setSelectedDate(generatedAvailableDates[0].fullDate);
        }
    } else if (selectedDate !== '') { 
        // console.warn("App: No available dates generated, but selectedDate is set.");
    }
  }, [generatedAvailableDates, selectedDate]); 


  const handleReservation = useCallback(async (time: string) => {
       if (!currentUser || !userPhone) { alert("יש להתחבר ולהזין מספר טלפון."); return; }
       if (blockedDays.has(selectedDate) || (blockedTimeSlots.get(selectedDate)?.has(time))) { alert("תאריך/שעה לא פנויים."); return; }
       setLoading(true);
       try {
         const now = new Date(); const [h, m] = time.split(':').map(Number);
         const slotDT = new Date(selectedDate); slotDT.setHours(h, m, 0, 0);
         if (slotDT <= now) { alert('לא ניתן לקבוע תורים בעבר.'); setLoading(false); return; }
         if (!await isTimeSlotAvailable(selectedDate, time, currentUser.uid)) { alert('חלון זמן זה נתפס כרגע.'); setLoading(false); return; }
         const existing = await getUserReservationForDate(currentUser.uid, selectedDate);
         if (existing?.id) await deleteReservation(existing.id);
         await createReservation({ name: currentUser.displayName || 'משתמש', phone: userPhone, time, date: selectedDate, userId: currentUser.uid });
         alert(`התור אושר לתאריך ${selectedDate} בשעה ${time}`);
       } catch (e:any) { console.error("App Res Err:", e); alert(`קביעת התור נכשלה: ${e.message||''}`);
       } finally { setLoading(false); }
   }, [currentUser, userPhone, selectedDate, blockedDays, blockedTimeSlots]);

  const handleDeleteReservation = useCallback(async (id: string) => {
       if (!id) { alert('מזהה לא תקין.'); return; } setLoading(true);
       try { await deleteReservation(id); }
       catch (e:any) { console.error("App Del Err:", e); alert(`מחיקה נכשלה: ${e.message||''}`); }
       finally { setLoading(false); }
   }, []);

  const handleCancelUserReservation = useCallback(async () => {
       if (!currentUser) return; setLoading(true);
       try {
         const userRes = await getUserReservationForDate(currentUser.uid, selectedDate);
         if (userRes?.id) { await deleteReservation(userRes.id); alert('התור בוטל.'); }
         else alert('לא נמצא תור לביטול בתאריך זה.');
       } catch (e:any) { console.error("App Cancel Err:", e); alert(`ביטול נכשל: ${e.message||''}`); }
       finally { setLoading(false); }
   }, [currentUser, selectedDate]);

  const availableTimes = useMemo(() => [ 
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', 
      '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', 
      '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
      '18:00', '18:30', '19:00'
  ], []);

  const getUserReservationForSelectedDate = useCallback(() => 
    currentUser ? (reservations.find(r => r.userId === currentUser.uid && r.date === selectedDate) || null) : null
  , [currentUser, reservations, selectedDate]);

  const isReservedByCurrentUser = useCallback((time: string) => {
      const userRes = getUserReservationForSelectedDate(); return !!userRes && userRes.time === time;
   }, [getUserReservationForSelectedDate]);

  const isReservedByOthers = useCallback((time: string) => 
    reservations.some(r => r.date === selectedDate && r.time === time && r.userId !== currentUser?.uid )
  , [reservations, selectedDate, currentUser]);

  if (loading && !currentUser && page === 'login') {
     return ( <div className="app-loading-spinner"> טוען את האפליקציה... </div> );
  }

  return (
    <div id="app-container">
      {page === 'login' && <LoginPage setLoadingApp={setLoading} />}
      {page === 'get_phone' && currentUser && <PhoneInputModal onSubmit={handlePhoneSubmit} onCancel={handleSignOut}/>}
      {showPhoneUpdateModal && currentUser && <PhoneInputModal onSubmit={handlePhoneSubmit} onCancel={() => setShowPhoneUpdateModal(false)} currentPhone={userPhone} isUpdating={true}/>}
      
      {page === 'client' && currentUser && userPhone && (
        <ClientPage
          latestBarberNews={latestNews} userName={currentUser.displayName || "לקוח"}
          availableTimes={availableTimes} userReservation={getUserReservationForSelectedDate()}
          handleReservation={handleReservation} cancelReservation={handleCancelUserReservation}
          goBack={handleSignOut} isReservedByCurrentUser={isReservedByCurrentUser}
          isReservedByOthers={isReservedByOthers} selectedDate={selectedDate}
          setSelectedDate={setSelectedDate} 
          generateNextFiveDays={() => generatedAvailableDates} 
          onUpdatePhoneNumber={() => setShowPhoneUpdateModal(true)} 
          blockedDays={blockedDays}
          blockedTimeSlots={blockedTimeSlots}
        />
      )}

      {page === 'admin' && currentUser && (
        <AdminDashboard 
          reservations={reservations} goBack={handleSignOut} onDeleteReservation={handleDeleteReservation} 
        /> 
      )}

      {loading && page !== 'login' && (
        <div className="modal-overlay action-loading-overlay"><div className="action-loading-content">מעבד...</div></div>
      )}
    </div>
  );
};

export default App;