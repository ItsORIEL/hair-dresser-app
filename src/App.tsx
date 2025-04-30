import React, { useState, useEffect } from 'react';
import { LoginPage } from './components/LoginPage';
import { ClientPage } from './components/ClientPage';
import { AdminDashboard } from './components/AdminDashboard';
import { PinVerificationPage } from './components/PinVerificationPage';
import './App.css';

// Import Firebase services
import { 
  getReservations, 
  createReservation, 
  deleteReservation, 
  getUserReservationForDate,
  isTimeSlotAvailable,
  Reservation
} from './services/firebase-service';

// Import Firebase Authentication services
import {
  initializeRecaptcha,
  sendVerificationCode,
  verifyCode,
  getCurrentUser,
  onAuthStateChanged
} from './services/firebase-auth-service';
import { RecaptchaVerifier } from 'firebase/auth';

// Utility function to get current date in format YYYY-MM-DD
const getCurrentDate = (offset: number = 0) => {
  const today = new Date();
  today.setDate(today.getDate() + offset);
  return today.toISOString().split('T')[0];
};

const App: React.FC = () => {
  // Page states: 'login', 'verification', 'client', 'admin'
  const [page, setPage] = useState<'login' | 'verification' | 'client' | 'admin'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDate());
  const [loading, setLoading] = useState<boolean>(false);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);
  const [verificationInProgress, setVerificationInProgress] = useState<boolean>(false);

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged((user) => {
      // If we have a verified user, we can allow them to proceed
      if (user) {
        console.log("User is signed in:", user.phoneNumber);
        // Automatically move to client page if verification is complete
        if (page === 'verification') {
          navigateAfterLogin();
        }
      } else {
        console.log("User is signed out");
        // If user signs out, redirect to login
        if (page !== 'login') {
          setPage('login');
        }
      }
    });

    // Clean up the listener
    return () => unsubscribeAuth();
  }, [page]);

  // Subscribe to reservations from Firebase
  useEffect(() => {
    const unsubscribe = getReservations((fetchedReservations) => {
      setReservations(fetchedReservations);
    });

    // Clean up the listener when component unmounts
    return () => unsubscribe();
  }, []);

  // Initialize reCAPTCHA when component mounts
  useEffect(() => {
    const initRecaptcha = () => {
      // Make sure we have a recaptcha-container in the DOM
      if (document.getElementById('recaptcha-container')) {
        try {
          const recaptcha = initializeRecaptcha('recaptcha-container');
          setRecaptchaVerifier(recaptcha);
        } catch (error) {
          console.error("Error initializing reCAPTCHA:", error);
        }
      }
    };

    // Initialize when on login page
    if (page === 'login') {
      initRecaptcha();
    }
  }, [page]);

  const generateNextFiveDays = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return Array.from({ length: 5 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + i);
      return {
        day: days[date.getDay()],
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: date.toISOString().split('T')[0]
      };
    });
  };

  // Start phone verification
  const startPhoneVerification = async (phoneNumber: string): Promise<boolean> => {
    if (!recaptchaVerifier) {
      console.error("reCAPTCHA not initialized");
      return false;
    }

    setLoading(true);
    try {
      // Send verification code
      const success = await sendVerificationCode(phoneNumber, recaptchaVerifier);
      
      if (success) {
        // Move to verification page
        setVerificationInProgress(true);
        setPage('verification');
      }
      
      return success;
    } catch (error) {
      console.error("Error starting verification:", error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Verify the SMS code
  const handleVerifyCode = async (code: string): Promise<boolean> => {
    try {
      const isVerified = await verifyCode(code);
      return isVerified;
    } catch (error) {
      console.error("Error verifying code:", error);
      return false;
    }
  };

  // After successful phone verification
  const handleVerificationComplete = () => {
    setVerificationInProgress(false);
    navigateAfterLogin();
  };

  // Resend verification code
  const handleResendCode = async () => {
    if (recaptchaVerifier) {
      await sendVerificationCode(phone, recaptchaVerifier);
    }
  };

  // Cancel verification and go back to login
  const handleCancelVerification = () => {
    setVerificationInProgress(false);
    setPage('login');
  };

  // Navigate to appropriate page after login
  const navigateAfterLogin = () => {
    if (name.toLowerCase() === 'oriel' && phone === '+9721234') {
      setPage('admin');
    } else {
      setPage('client');
    }
  };

  const handleLogin = () => {
    if (!name.trim() || !phone.trim()) {
      alert('Please enter both name and phone number');
      return;
    }

    // This function is no longer directly called from the login page
    // We now use startPhoneVerification first
    navigateAfterLogin();
  };

  const handleReservation = async (time: string) => {
    setLoading(true);
    try {
      // Check if this time slot is available
      const isAvailable = await isTimeSlotAvailable(
        selectedDate, 
        time, 
        { name, phone } // Exclude the current user's existing reservation
      );

      if (!isAvailable) {
        alert('This time slot has just been booked by someone else. Please select another time.');
        return;
      }

      // Check if user already has a reservation for this date
      const existingReservation = await getUserReservationForDate(name, phone, selectedDate);
      
      if (existingReservation) {
        // Delete the old reservation
        await deleteReservation(existingReservation.id!);
      }
      
      // Create new reservation
      const newReservation: Reservation = {
        name,
        phone,
        time,
        date: selectedDate
      };
      
      await createReservation(newReservation);
      alert(`Reservation confirmed for ${selectedDate} at ${time}`);
    } catch (error) {
      console.error("Error making reservation:", error);
      alert('Failed to make reservation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReservation = async (id: string) => {
    try {
      await deleteReservation(id);
    } catch (error) {
      console.error("Error deleting reservation:", error);
      alert('Failed to delete reservation.');
    }
  };

  const handleCancelUserReservation = async () => {
    setLoading(true);
    try {
      // Find user's reservation for the current date
      const userReservation = await getUserReservationForDate(name, phone, selectedDate);
      
      if (userReservation && userReservation.id) {
        await deleteReservation(userReservation.id);
        alert('Your appointment has been cancelled.');
      } else {
        alert('No appointment found to cancel.');
      }
    } catch (error) {
      console.error("Error cancelling reservation:", error);
      alert('Failed to cancel reservation.');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setPage('login');
  };

  const availableTimes = [
    '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
    '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', 
    '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM',
    '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', 
    '5:00 PM', '5:30 PM'
  ];

  const getUserReservationForSelectedDate = () => {
    return reservations.find(
      res => res.name === name && 
             res.phone === phone && 
             res.date === selectedDate
    ) || null;
  };

  const isReservedByCurrentUser = (time: string) => {
    const