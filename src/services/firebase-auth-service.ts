// src/services/firebase-auth-service.ts
import { 
    getAuth, 
    RecaptchaVerifier, 
    signInWithPhoneNumber, 
    ConfirmationResult, 
    PhoneAuthProvider, 
    signOut, 
    User
  } from "firebase/auth";
  import app from "../firebase";
  
  // Initialize Firebase Auth
  const auth = getAuth(app);
  
  // Store confirmation result globally
  let confirmationResult: ConfirmationResult | null = null;
  
  // Initialize recaptcha verifier
  export const initializeRecaptcha = (containerId: string): RecaptchaVerifier => {
    // Create and render the recaptcha verifier
    const recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      'size': 'invisible',
      'callback': () => {
        // reCAPTCHA solved, allow signInWithPhoneNumber.
        console.log('reCAPTCHA verified!');
      },
      'expired-callback': () => {
        // Response expired. Ask user to solve reCAPTCHA again.
        console.log('reCAPTCHA expired!');
        // Re-initialize
        initializeRecaptcha(containerId);
      }
    });
    
    return recaptchaVerifier;
  };
  
  // Send verification code to the phone number
  export const sendVerificationCode = async (
    phoneNumber: string, 
    recaptchaVerifier: RecaptchaVerifier
  ): Promise<boolean> => {
    try {
      // Format the phone number to remove any spaces or special characters
      const formattedPhoneNumber = phoneNumber.trim();
      
      // Send verification code
      confirmationResult = await signInWithPhoneNumber(
        auth, 
        formattedPhoneNumber, 
        recaptchaVerifier
      );
      
      return true;
    } catch (error) {
      console.error("Error sending verification code:", error);
      return false;
    }
  };
  
  // Verify the code entered by the user
  export const verifyCode = async (verificationCode: string): Promise<boolean> => {
    if (!confirmationResult) {
      console.error("No confirmation result available");
      return false;
    }
    
    try {
      // Verify the code
      const result = await confirmationResult.confirm(verificationCode);
      
      // User signed in successfully
      return !!result.user;
    } catch (error) {
      console.error("Error verifying code:", error);
      return false;
    }
  };
  
  // Get the currently authenticated user
  export const getCurrentUser = (): User | null => {
    return auth.currentUser;
  };
  
  // Sign out the current user
  export const signOutUser = async (): Promise<void> => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  };
  
  // Listen to auth state changes
  export const onAuthStateChanged = (callback: (user: User | null) => void): () => void => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      callback(user);
    });
    
    return unsubscribe;
  };