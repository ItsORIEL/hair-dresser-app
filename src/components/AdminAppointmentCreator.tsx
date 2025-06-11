// src/components/AdminAppointmentCreator.tsx
import React, { useState, useMemo } from 'react';
import { Reservation, BlockedTimeSlotsMap } from '../services/firebase-service';
import './AdminAppointmentCreator.css'; // Import the CSS file

interface AdminAppointmentCreatorProps {
  availableTimes: string[];
  blockedDays: Set<string>;
  blockedTimeSlots: BlockedTimeSlotsMap;
  reservations: Reservation[];
  onAdminCreateReservation: (
    name: string,
    phone: string,
    date: string,
    time: string
  ) => Promise<{ success: boolean; message: string }>;
}

const getTodayISO_AAC = () => new Date().toISOString().split('T')[0];

export const AdminAppointmentCreator: React.FC<AdminAppointmentCreatorProps> = ({
  availableTimes,
  blockedDays,
  blockedTimeSlots,
  reservations,
  onAdminCreateReservation,
}) => {
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState(availableTimes[0] || '');
  const [phoneError, setPhoneError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const todayISO = useMemo(() => getTodayISO_AAC(), []);

  const validatePhone = (phone: string): boolean => {
    const israeliPhoneRegex = /^(05\d{8}|5\d{8})$/;
    let cleanedPhone = phone.replace(/\D/g, '');
    if (cleanedPhone.startsWith('972')) {
      cleanedPhone = cleanedPhone.substring(3);
    }
    if (!israeliPhoneRegex.test(cleanedPhone)) {
      if (cleanedPhone.startsWith('5') && cleanedPhone.length === 9) { /* Allow normalization */ }
      else { setPhoneError('יש להזין מספר נייד ישראלי תקין (לדוגמה: 0501234567 או 501234567).'); return false; }
    }
    setPhoneError('');
    return true;
  };

  const normalizePhoneForDB = (phone: string): string => {
      let cleanedPhone = phone.replace(/\D/g, '');
      if (cleanedPhone.startsWith('972')) { cleanedPhone = cleanedPhone.substring(3); }
      return cleanedPhone.startsWith('5') && cleanedPhone.length === 9 ? '0' + cleanedPhone : cleanedPhone;
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!clientName.trim() || !selectedDate || !selectedTime) {
      setStatusMessage({ type: 'error', message: 'יש למלא את כל השדות: שם, תאריך ושעה.' });
      return;
    }
    if (!validatePhone(clientPhone)) {
        return;
    }

    const normalizedPhone = normalizePhoneForDB(clientPhone);
    if (!/^(05\d{8})$/.test(normalizedPhone)) {
        setStatusMessage({ type: 'error', message: 'פורמט מספר טלפון לא תקין לאחר נורמליזציה.' });
        return;
    }

    if (new Date(selectedDate + 'T' + selectedTime) <= new Date()) {
        setStatusMessage({ type: 'error', message: 'לא ניתן לקבוע תורים בזמן שכבר עבר.' });
        return;
    }
    if (blockedDays.has(selectedDate)) {
        setStatusMessage({ type: 'error', message: `היום ${selectedDate} חסום על ידי המנהל.` }); // Corrected typo
        return;
    }
    if (blockedTimeSlots.get(selectedDate)?.has(selectedTime)) {
        setStatusMessage({ type: 'error', message: `השעה ${selectedTime} בתאריך ${selectedDate} חסומה על ידי המנהל.` });
        return;
    }
    const isSlotTaken = reservations.some(r => r.date === selectedDate && r.time === selectedTime);
    if (isSlotTaken) {
        setStatusMessage({ type: 'error', message: `השעה ${selectedTime} בתאריך ${selectedDate} כבר תפוסה.` });
        return;
    }

    setIsLoading(true);
    try {
      const result = await onAdminCreateReservation(clientName.trim(), normalizedPhone, selectedDate, selectedTime);
      setStatusMessage({ type: result.success ? 'success' : 'error', message: result.message });
      if (result.success) {
        setClientName('');
        setClientPhone('');
        setSelectedDate('');
        // setSelectedTime(availableTimes[0] || ''); // Optionally reset time
      }
    } catch (error: any) {
      setStatusMessage({ type: 'error', message: error.message || 'שגיאה לא צפויה ביצירת התור.' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setStatusMessage(null), 7000);
    }
  };

  return (
    <div className="reservations-card admin-appointment-creator-card"> {/* Main card class */}
      <h3 className="section-title">יצירת תור חדש ללקוח</h3>
      <form onSubmit={handleSubmit} className="admin-creator-form">
        <div className="form-grid">
            <div className="form-group">
            <label htmlFor="clientNameAdmin">שם הלקוח:</label> {/* Changed ID for uniqueness */}
            <input
                type="text"
                id="clientNameAdmin"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
                className="admin-form-input"
            />
            </div>
            <div className="form-group">
            <label htmlFor="clientPhoneAdmin">טלפון הלקוח:</label> {/* Changed ID for uniqueness */}
            <input
                type="tel"
                id="clientPhoneAdmin"
                value={clientPhone}
                onChange={(e) => {
                    setClientPhone(e.target.value.replace(/\D/g, ''));
                    if (phoneError) setPhoneError('');
                }}
                placeholder="05X XXX XXXX"
                maxLength={10}
                required
                className="admin-form-input"
            />
            {phoneError && <p className="modal-error">{phoneError}</p>} {/* modal-error class for styling */}
            </div>
            <div className="form-group">
            <label htmlFor="appointmentDateAdmin">תאריך:</label> {/* Changed ID for uniqueness */}
            <input
                type="date"
                id="appointmentDateAdmin"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={todayISO}
                required
                className="admin-form-input"
            />
            </div>
            <div className="form-group">
            <label htmlFor="appointmentTimeAdmin">שעה:</label> {/* Changed ID for uniqueness */}
            <select
                id="appointmentTimeAdmin"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                required
                className="admin-form-select"
            >
                {availableTimes.map((time) => (
                <option key={time} value={time}>
                    {time}
                </option>
                ))}
            </select>
            </div>
        </div>
        <button type="submit" className="news-publisher-button" disabled={isLoading}> {/* Reused button class */}
          {isLoading ? 'יוצר תור...' : 'צור תור'}
        </button>
      </form>
      {statusMessage && (
        <p className={`news-publisher-status ${statusMessage.type}`} role="alert"> {/* Reused status class */}
          {statusMessage.message}
        </p>
      )}
    </div>
  );
};