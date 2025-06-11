// src/components/AdminDashboard.tsx
import React, { useMemo } from 'react'; // Removed useState, useEffect as they are not used locally for blockedDays
import './AdminDashboard.css';
import { Reservation, blockDay, unblockDay, BlockedTimeSlotsMap } from '../services/firebase-service';
import { AdminNewsPublisher } from './AdminNewsPublisher';
import { AdminDayBlocker } from './AdminDayBlocker';
import { AdminTimeSlotBlocker } from './AdminTimeSlotBlocker';
import { AdminAppointmentCreator } from './AdminAppointmentCreator';

interface AdminDashboardProps {
  reservations: Reservation[];
  goBack: () => void;
  onDeleteReservation: (id: string) => void;
  blockedDaysApp: Set<string>;
  blockedTimeSlotsApp: BlockedTimeSlotsMap;
  availableTimesApp: string[];
  onAdminCreateReservationApp: (name: string, phone: string, date: string, time: string) => Promise<{ success: boolean; message: string }>;
}

const formatDateToHebrew = (dateString: string): string => {
  const date = new Date(dateString + 'T00:00:00Z');
  return date.toLocaleDateString('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
  });
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  reservations, goBack, onDeleteReservation,
  blockedDaysApp, blockedTimeSlotsApp, availableTimesApp, onAdminCreateReservationApp
}) => {

  // <<< --- ADDED THIS LOG --- >>>
  console.log("AdminDashboard: Component rendered/updated. Received reservations prop. Count:", reservations.length);
   if (reservations.length > 0) {
        console.log("AdminDashboard: Current reservations prop list:", JSON.stringify(reservations.map(r => ({id: r.id, date: r.date, time: r.time, name: r.name})), null, 2));
    }

  const todayISO = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayReadableHebrew = useMemo(() => {
    const todayDate = new Date();
    return todayDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }, []);
  const yesterdayISO = useMemo(() => { const y = new Date(); y.setDate(y.getDate() - 1); return y.toISOString().split('T')[0]; }, []);

  const todayResCount = useMemo(() => reservations.filter(r => r.date === todayISO).length, [reservations, todayISO]);
  const upcomingResCount = useMemo(() => reservations.filter(r => r.date > todayISO).length, [reservations, todayISO]);

  const handleCancelClick = (reservation: Reservation) => {
     const dayBlocked = blockedDaysApp.has(reservation.date);
     const dispDate = formatDateToHebrew(reservation.date);
     const clientName = reservation.name || 'לקוח';
     let confirmationMessage = `האם לבטל את התור של ${clientName} בתאריך ${dispDate} בשעה ${reservation.time}?`;
     if (dayBlocked) {
        confirmationMessage += "\n\n(שים לב: יום זה חסום כעת להזמנות חדשות.)";
     }
    if (window.confirm(confirmationMessage)) {
      if (reservation.id) onDeleteReservation(reservation.id);
      else { console.error("ID missing", reservation); alert("שגיאה: חסר מזהה ייחודי."); }
    }
  };

  const sortedReservations = useMemo(() => {
    // <<< --- ADDED THIS LOG INSIDE useMemo --- >>>
    console.log("AdminDashboard: Recalculating sortedReservations. Input reservations count:", reservations.length);
    return reservations.filter(r => r.date >= yesterdayISO)
      .sort((a,b) => (a.date.localeCompare(b.date) || a.time.localeCompare(b.time)));
  }, [reservations, yesterdayISO]);

  const formatTelLink = (phone?: string): string => {
    if (!phone) return ''; let cl = phone.replace(/\D/g,'');
    if (cl.startsWith('05')&&cl.length===10) return `+972${cl.substring(1)}`; if (cl.startsWith('5')&&cl.length===9) return `+972${cl}`;
    if (cl.startsWith('972')&&cl.length>=12) return `+${cl}`; if (cl.startsWith('+')) return cl; return cl;
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1 className="admin-title">לוח בקרה - מנהל</h1>
        <button className="back-link admin-signout-button" onClick={goBack} aria-label="התנתקות">
          התנתקות ←
        </button>
      </div>
      <div className="stats-container">
        <div className="stat-card"><div className="stat-value">{todayResCount}</div><div className="stat-label">תורים להיום</div></div>
        <div className="stat-card"><div className="stat-value">{upcomingResCount}</div><div className="stat-label">תורים עתידיים</div></div>
      </div>

      <AdminAppointmentCreator
        availableTimes={availableTimesApp}
        blockedDays={blockedDaysApp}
        blockedTimeSlots={blockedTimeSlotsApp}
        reservations={reservations}
        onAdminCreateReservation={onAdminCreateReservationApp}
      />

      <AdminNewsPublisher />
      <AdminDayBlocker blockedDays={blockedDaysApp} onBlockDay={blockDay} onUnblockDay={unblockDay} />
      <AdminTimeSlotBlocker />

      <div className="reservations-card admin-appointments-table-card">
        <div className="section-header"><h2 className="section-title">תורים (אתמול, היום ועתידיים)</h2></div>
        {sortedReservations.length === 0 ? (<div className="empty-state"><div className="empty-icon">📅</div><p>אין תורים רלוונטיים.</p></div>)
         : (<table className="reservation-table" aria-label="רשימת תורים">
            <thead><tr><th>פרטי לקוח</th><th>תאריך ושעת התור</th><th>סטטוס</th><th>פעולות</th></tr></thead><tbody>
            {sortedReservations.map((res) => {
              const isBlk = blockedDaysApp.has(res.date);
              const clientName = res.name || 'לא ידוע';
              return (<tr key={res.id} className={`reservation-row ${isBlk?'blocked-day-row':''}`}>
                <td className="client-details-cell"><div>{clientName}</div><div className="reservation-phone-subline">{res.phone?<a href={`tel:${formatTelLink(res.phone)}`} className="phone-link">{res.phone}</a>:'אין טלפון'}</div></td>
                <td className="datetime-cell"><div>{formatDateToHebrew(res.date)}</div><div className="reservation-time-subline">{res.time}</div></td>
                <td className="status-cell">{isBlk?<span className="status-indicator blocked" title="הזמנות חסומות ליום זה">יום חסום</span>:<span className="status-indicator active">פעיל</span>}</td>
                <td className="actions-cell"><button className="action-button-small delete" onClick={()=>handleCancelClick(res)} disabled={!res.id} aria-label={`ביטול התור של ${clientName} בתאריך ${formatDateToHebrew(res.date)}`}>ביטול</button></td>
              </tr>);
            })}</tbody></table>)}
      </div>
      <div className="reservations-card admin-today-summary-card">
        <div className="section-header">
          <h2 className="section-title">היום • {todayReadableHebrew}</h2>
          {blockedDaysApp.has(todayISO) && <span className="status-indicator blocked">(יום חסום)</span>}
        </div>
        {blockedDaysApp.has(todayISO)?(<p>יום זה חסום. הזמנות חדשות אינן אפשריות. תורים שכבר נקבעו להיום מוצגים למעלה.</p>)
         :(<p>{todayResCount === 0 ? "אין תורים מתוכננים להיום." :
              todayResCount === 1 ? `יש תור אחד מתוכנן להיום.` : `יש ${todayResCount} תורים מתוכננים להיום.`
            }</p>)}
      </div>
    </div>
  );
};