// src/components/OpenInExternalBrowserPage.tsx
import React from 'react';
// Make ABSOLUTELY SURE this path is correct relative to THIS FILE.
// If OpenInExternalBrowserPage.tsx is in src/components/
// and your image is in src/assets/
// then '../assets/instagram-buttons.jpeg' is correct.
import instagramButtonsImage from '../assets/instagram-buttons.jpeg';

interface OpenInExternalBrowserPageProps {
  currentUrl: string;
}

// --- Styles to mimic LoginPage and previous design ---

const containerStyles: React.CSSProperties = {
  position: 'relative', // For bg circles
  minHeight: '100vh',
  padding: '20px',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#f7f7f7', // LoginPage background
  fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  color: '#333',
  overflow: 'hidden', // For bg circles
};

const bgCircle1Styles: React.CSSProperties = {
  position: 'absolute',
  background: '#ffd6e1', // Light pink from LoginPage
  borderRadius: '50%',
  zIndex: 0,
  width: '200px',
  height: '200px',
  top: '-50px',
  left: '-50px',
  opacity: 0.7,
};

const bgCircle2Styles: React.CSSProperties = {
  position: 'absolute',
  background: '#ffd6e1', // Light pink from LoginPage
  borderRadius: '50%',
  zIndex: 0,
  width: '300px',
  height: '300px',
  bottom: '-100px',
  right: '-100px',
  opacity: 0.7,
};

const cardStyles: React.CSSProperties = {
  position: 'relative', // To be above bg circles
  zIndex: 1,
  backgroundColor: '#ffffff',
  padding: '30px 30px',
  borderRadius: '16px',     // LoginPage card border-radius
  boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)', // LoginPage card shadow
  maxWidth: '550px',
  width: '100%',
  textAlign: 'center',
  boxSizing: 'border-box',
};

const titleStyles: React.CSSProperties = {
  fontSize: '1.8em',
  color: '#2c3e50',
  marginBottom: '15px',
};

const generalTextStyles: React.CSSProperties = {
  fontSize: '1em',
  lineHeight: '1.6',
  color: '#555',
  marginBottom: '20px',
};

const imageInstructionSectionStyles: React.CSSProperties = {
  marginBottom: '25px',
  padding: '15px',
  backgroundColor: '#e9f5ff', // Light blue background for this section
  borderRadius: '8px',
  border: '1px solid #bce0fd',
};

const imageStyles: React.CSSProperties = {
  maxWidth: '100%',
  maxHeight: '250px',
  borderRadius: '8px',
  marginBottom: '10px',
  border: '1px solid #ddd', // Added a subtle border to the image
};

const imageCaptionStyles: React.CSSProperties = {
  fontSize: '0.95em',
  color: '#333',
  lineHeight: '1.5',
};

const highlightTextStyles: React.CSSProperties = {
  fontWeight: 'bold',
  color: '#007bff',
};

const buttonWrapperStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '15px',
    marginTop: '20px',
};

const copyButtonStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '12px 25px',
  fontSize: '1.1em',
  fontWeight: 600,
  color: 'white',
  backgroundColor: '#007bff',
  border: 'none',
  borderRadius: '8px', // Match LoginPage button radius
  cursor: 'pointer',
  textDecoration: 'none',
  transition: 'background-color 0.2s ease, transform 0.1s ease',
  width: '100%',
  maxWidth: '300px',
  boxSizing: 'border-box',
};

const attemptLinkStyles: React.CSSProperties = {
  display: 'inline-block',
  padding: '12px 25px',
  fontSize: '1.1em',
  fontWeight: 600,
  color: 'white',
  backgroundColor: '#28a745',
  border: 'none',
  borderRadius: '8px', // Match LoginPage button radius
  cursor: 'pointer',
  textDecoration: 'none',
  transition: 'background-color 0.2s ease, transform 0.1s ease',
  width: '100%',
  maxWidth: '300px',
  boxSizing: 'border-box',
};

const smallTextStyles: React.CSSProperties = {
  fontSize: '0.85em',
  color: '#777',
  marginTop: '25px',
};

// --- Component ---
export const OpenInExternalBrowserPage: React.FC<OpenInExternalBrowserPageProps> = ({
    currentUrl,
}) => {

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentUrl)
      .then(() => alert('קישור הועתק! הדבק אותו בשורת הכתובת של הדפדפן הראשי שלך.'))
      .catch(err => {
        console.error('Failed to copy link: ', err);
        alert('שגיאה בהעתקת הקישור. אנא העתק את הכתובת משורת הכתובת באופן ידני.');
      });
  };

  return (
    <div style={containerStyles}>
      <div style={bgCircle1Styles}></div>
      <div style={bgCircle2Styles}></div>
      <div style={cardStyles}>
        <h1 style={titleStyles}>פתיחה בדפדפן חיצוני</h1>

        <p style={generalTextStyles}>
          כדי להתחבר לאתר וליהנות מכל האפשרויות, יש לפתוח דף זה בדפדפן הראשי של הטלפון שלך (כגון Safari או Chrome).
        </p>

        <div style={imageInstructionSectionStyles}>
          <p style={{...imageCaptionStyles, marginBottom: '10px', fontWeight: 'bold', textAlign: 'right'}}>
            הדרך הטובה ביותר היא להשתמש באפשרות המובנית באפליקציה:
          </p>
          <img src={instagramButtonsImage} alt="הוראות: פתח בדפדפן חיצוני" style={imageStyles} />
        </div>

        <p style={{...generalTextStyles, fontSize: '0.9em', marginTop: '25px', textAlign: 'right'}}>
            אם אינך מוצא את האפשרות בתפריט, או אם אתה מעדיף, תוכל להשתמש באחת מהאפשרויות הבאות:
        </p>

        <div style={buttonWrapperStyles}>
            <button
              onClick={handleCopyLink}
              style={copyButtonStyle}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#0056b3')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#007bff')}
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              העתק קישור לדפדפן
            </button>

            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={attemptLinkStyles}
              onMouseOver={(e) => { if (e.currentTarget) e.currentTarget.style.backgroundColor = '#1e7e34';}}
              onMouseOut={(e) => { if (e.currentTarget) e.currentTarget.style.backgroundColor = '#28a745';}}
              onMouseDown={(e) => { if (e.currentTarget) e.currentTarget.style.transform = 'scale(0.98)';}}
              onMouseUp={(e) => { if (e.currentTarget) e.currentTarget.style.transform = 'scale(1)';}}
            >
              נסה לפתוח קישור בדפדפן
            </a>
        </div>

        <p style={smallTextStyles}>
          אם הכפתור "נסה לפתוח קישור בדפדפן" אינו פותח את הדפדפן הראשי שלך, אנא השתמש בשיטה המוסברת למעלה (עם התמונה) או בכפתור "העתק קישור".
        </p>
      </div>
    </div>
  );
};