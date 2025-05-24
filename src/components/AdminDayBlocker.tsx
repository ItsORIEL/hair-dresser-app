// src/components/AdminDayBlocker.tsx
import React, { useState, useMemo } from 'react';

interface AdminDayBlockerProps {
  blockedDays: Set<string>; 
  onBlockDay: (date: string) => Promise<void>;
  onUnblockDay: (date: string) => Promise<void>;
}

// Using 'he-IL' for Hebrew locale, should give DD/MM/YYYY and Hebrew month names if used with month: 'long'
const formatDateToHebrew_AdminDayBlocker = (dateString: string): string => {
  const date = new Date(dateString + 'T00:00:00Z');
  return date.toLocaleDateString('he-IL', { // Hebrew locale
    day: '2-digit', month: '2-digit', year: 'numeric', weekday: 'short', timeZone: 'UTC',
  });
};

const getTodayISO = () => new Date().toISOString().split('T')[0];

export const AdminDayBlocker: React.FC<AdminDayBlockerProps> = ({
  blockedDays,
  onBlockDay,
  onUnblockDay,
}) => {
  const [selectedDateToBlock, setSelectedDateToBlock] = useState<string>('');
  const [isLoadingBlock, setIsLoadingBlock] = useState<boolean>(false);
  const [isUnblockingAll, setIsUnblockingAll] = useState<boolean>(false);
  const [isLoadingUnblockItem, setIsLoadingUnblockItem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const todayISO = useMemo(() => getTodayISO(), []);

  const handleBlockDateAction = async (date: string) => {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('אנא בחר תאריך תקין לחסימה.'); return;
    }
    const displayDate = formatDateToHebrew_AdminDayBlocker(date);
    if (blockedDays.has(date)) {
        setError(`התאריך ${displayDate} כבר חסום.`); return;
    }
    
    setIsLoadingBlock(true); setError(null); setSuccessMessage(null);
    try {
      await onBlockDay(date); 
      setSuccessMessage(`התאריך ${displayDate} נחסם בהצלחה.`);
      setSelectedDateToBlock(''); 
    } catch (err: any) {
      setError(`חסימת התאריך ${displayDate} נכשלה. ${err.message || 'אנא נסה שוב.'}`);
    } finally {
      setIsLoadingBlock(false); setTimeout(() => { setError(null); setSuccessMessage(null); }, 4000);
    }
  };

  const handleUnblockDateFromList = async (dateToUnblock: string) => {
    const displayDate = formatDateToHebrew_AdminDayBlocker(dateToUnblock);
    if (!blockedDays.has(dateToUnblock)) { 
        setError(`התאריך ${displayDate} אינו חסום כעת.`); return;
    }
    setIsLoadingUnblockItem(dateToUnblock); 
    setError(null); setSuccessMessage(null);
    try {
        await onUnblockDay(dateToUnblock); 
        setSuccessMessage(`התאריך ${displayDate} בוטלה חסימתו בהצלחה.`);
    } catch (err: any) {
        setError(`ביטול חסימת התאריך ${displayDate} נכשל. ${err.message || 'אנא נסה שוב.'}`);
    } finally {
        setIsLoadingUnblockItem(null);
        setTimeout(() => { setError(null); setSuccessMessage(null); }, 4000);
    }
  };

  const displayedBlockedDays = useMemo(() => 
    Array.from(blockedDays)
      .filter(dateStr => dateStr >= todayISO) 
      .sort(), 
  [blockedDays, todayISO]);

  const handleUnblockAllFutureDays = async () => {
    if (displayedBlockedDays.length === 0) {
        setSuccessMessage("אין ימים עתידיים שחסומים כעת.");
        setTimeout(() => setSuccessMessage(null), 3000);
        return;
    }
    if (window.confirm(`האם לבטל חסימה של כל ${displayedBlockedDays.length} הימים העתידיים החסומים הרשומים? לא ניתן לשחזר פעולה זו.`)) {
        setIsUnblockingAll(true);
        setError(null); setSuccessMessage(null);
        let unblockCount = 0; let failedCount = 0;
        try {
            for (const dateToUnblock of displayedBlockedDays) {
                try {
                    await onUnblockDay(dateToUnblock);
                    unblockCount++;
                } catch (individualError) {
                    console.error(`Failed to unblock day ${dateToUnblock}:`, individualError);
                    failedCount++;
                }
            }
            if (failedCount > 0) {
                setError(`בוטלה חסימה של ${unblockCount} ימים. ${failedCount} ימים לא בוטלו. בדוק את הקונסול לפרטים.`);
            } else {
                setSuccessMessage(`בוטלה חסימה של כל ${unblockCount} הימים העתידיים.`);
            }
        } catch (err: any) {
            setError(`אירעה שגיאה בביטול חסימת כל הימים. ${err.message || 'אנא נסה שוב.'}`);
        } finally {
            setIsUnblockingAll(false);
            setTimeout(() => { setError(null); setSuccessMessage(null); }, 6000);
        }
    }
  };

  return (
    <div className="day-blocker-card">
      <h3 className="section-title day-blocker-title">ניהול ימים חסומים / ימי חופש</h3>
      <p className="day-blocker-description">בחר תאריך כדי לחסום אותו. חסימות עבר מוסתרות מהרשימה למטה. בטל חסימת ימים מהרשימה או השתמש ב"בטל חסימת כל העתידיים".</p>
      <div className="day-blocker-controls">
        <input
          type="date" value={selectedDateToBlock}
          onChange={(e) => { setSelectedDateToBlock(e.target.value); setError(null); setSuccessMessage(null); }}
          className="day-blocker-date-input" min={todayISO} aria-label="בחר תאריך לחסימה" />
        <div className="day-blocker-buttons">
          <button onClick={() => handleBlockDateAction(selectedDateToBlock)}
            disabled={isLoadingBlock || isUnblockingAll || !selectedDateToBlock || blockedDays.has(selectedDateToBlock)}
            className="day-blocker-button block"
            title={selectedDateToBlock && blockedDays.has(selectedDateToBlock) ? `התאריך כבר חסום` : `חסום תאריך זה`}>
            {isLoadingBlock ? 'חוסם...' : 'חסום תאריך נבחר'}
          </button>
        </div>
      </div>
      {error && <p className="day-blocker-status error" role="alert">{error}</p>}
      {successMessage && <p className="day-blocker-status success" role="status">{successMessage}</p>}
      
      <div className="blocked-days-list">
        <div className="section-header" style={{ marginBottom: '10px', marginTop: '20px' }}>
            <h4 className="blocked-list-title" style={{ marginBottom: '0'}}>תאריכים חסומים (היום ועתידיים):</h4>
            {displayedBlockedDays.length > 0 && (
                <button 
                    onClick={handleUnblockAllFutureDays}
                    disabled={isUnblockingAll || isLoadingBlock || !!isLoadingUnblockItem}
                    className="action-button-small delete" 
                    style={{ marginLeft: 'auto', padding: '6px 12px' }} 
                    title="בטל חסימה של כל הימים העתידיים הרשומים"
                >
                    {isUnblockingAll ? 'מבטל חסימות...' : 'בטל חסימת כל העתידיים'}
                </button>
            )}
        </div>
        {displayedBlockedDays.length === 0 ? (
          <p className="blocked-list-empty">אין תאריכים חסומים כעת או בעתיד.</p>
        ) : (
          <ul aria-label="רשימת תאריכים חסומים כעת">
            {displayedBlockedDays.map((date) => (
              <li key={date} className="blocked-list-item">
                <span>{formatDateToHebrew_AdminDayBlocker(date)}</span>
                <button onClick={() => handleUnblockDateFromList(date)} 
                  disabled={isLoadingBlock || isUnblockingAll || isLoadingUnblockItem === date}
                  className="unblock-list-button" 
                  aria-label={`בטל חסימת התאריך ${formatDateToHebrew_AdminDayBlocker(date)}`}>
                  {isLoadingUnblockItem === date ? '...' : 'בטל חסימה'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};