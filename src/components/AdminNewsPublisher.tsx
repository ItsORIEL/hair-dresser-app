// src/components/AdminNewsPublisher.tsx
import React, { useState } from 'react';
import { postBarberNews } from '../services/firebase-service';
// We'll add styles to AdminDashboard.css or a new AdminNewsPublisher.css
// For this exercise, let's assume they go into AdminDashboard.css for simplicity of providing one CSS file.

export const AdminNewsPublisher: React.FC = () => {
  const [newsMessage, setNewsMessage] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [postStatus, setPostStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSubmitNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsMessage.trim()) {
      setPostStatus({ type: 'error', message: 'News message cannot be empty.' });
      return;
    }

    setIsPosting(true);
    setPostStatus(null);
    try {
      await postBarberNews(newsMessage);
      setPostStatus({ type: 'success', message: 'News posted successfully!' });
      setNewsMessage('');
    } catch (error) {
      console.error("Error posting news:", error);
      setPostStatus({ type: 'error', message: 'Failed to post news. Please try again.' });
    } finally {
      setIsPosting(false);
      setTimeout(() => setPostStatus(null), 5000);
    }
  };

  return (
    <div className="news-publisher-card">
      <h3 className="news-publisher-title section-title">Post News Update</h3>
      <form onSubmit={handleSubmitNews}>
        <textarea
          value={newsMessage}
          onChange={(e) => setNewsMessage(e.target.value)}
          placeholder="Enter your news or message for clients here..."
          rows={4}
          className="news-publisher-textarea"
          disabled={isPosting}
        />
        <button
          type="submit"
          disabled={isPosting}
          className={`news-publisher-button ${isPosting ? 'posting' : ''}`}
        >
          {isPosting ? 'Posting...' : 'Post News'}
        </button>
      </form>
      {postStatus && (
        <p className={`news-publisher-status ${postStatus.type}`}>
          {postStatus.message}
        </p>
      )}
    </div>
  );
};