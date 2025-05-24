// src/components/AdminNewsPublisher.tsx
import React, { useState } from 'react';
import { postBarberNews } from '../services/firebase-service';
// Assuming styles are in AdminDashboard.css

export const AdminNewsPublisher: React.FC = () => {
  const [newsMessage, setNewsMessage] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [postStatus, setPostStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSubmitNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsMessage.trim()) {
      setPostStatus({ type: 'error', message: 'הודעת החדשות לא יכולה להיות ריקה.' });
      return;
    }

    setIsPosting(true);
    setPostStatus(null);
    try {
      await postBarberNews(newsMessage);
      setPostStatus({ type: 'success', message: 'החדשות פורסמו בהצלחה!' });
      setNewsMessage(''); // Clear message on success
    } catch (error) {
      console.error("Error posting news:", error);
      setPostStatus({ type: 'error', message: 'פרסום החדשות נכשל. אנא נסה שוב.' });
    } finally {
      setIsPosting(false);
      // Clear status message after a delay
      setTimeout(() => setPostStatus(null), 5000);
    }
  };

  return (
    <div className="news-publisher-card">
      <h3 className="news-publisher-title section-title">פרסום עדכון חדשות</h3>
      <form onSubmit={handleSubmitNews}>
        <textarea
          value={newsMessage}
          onChange={(e) => setNewsMessage(e.target.value)}
          placeholder="הקלד כאן את החדשות או ההודעה ללקוחות..."
          rows={4}
          className="news-publisher-textarea"
          disabled={isPosting}
          aria-label="תוכן הודעת החדשות"
        />
        <button
          type="submit"
          disabled={isPosting || !newsMessage.trim()} // Also disable if message is empty
          className={`news-publisher-button ${isPosting ? 'posting' : ''}`}
        >
          {isPosting ? 'מפרסם...' : 'פרסם הודעה'}
        </button>
      </form>
      {postStatus && (
        <p className={`news-publisher-status ${postStatus.type}`} role="alert">
          {postStatus.message}
        </p>
      )}
    </div>
  );
};