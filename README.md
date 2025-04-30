# HairDresser.com - Appointment Booking App

A React application for booking hairdresser appointments with Firebase Realtime Database integration for real-time data synchronization.

## Features

- User authentication (simple name/phone number login)
- Admin dashboard for managing appointments
- Client booking interface
- Real-time appointment synchronization across devices
- Date and time selection
- Appointment cancellation

## Technical Stack

- React with TypeScript
- Firebase Realtime Database
- Vite for build tooling
- CSS for styling

## Installation and Setup

1. **Clone the repository**

```bash
git clone <repository-url>
cd hairdresser-app
```

2. **Install dependencies**

```bash
npm install
```

3. **Environment Variables**

Create a `.env` file in the root directory with your Firebase configuration:

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_DATABASE_URL=your_database_url
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

4. **Run the development server**

```bash
npm run dev
```

5. **Build for production**

```bash
npm run build
```

## Firebase Setup

1. Create a Firebase project in the [Firebase Console](https://console.firebase.google.com/)
2. Enable Realtime Database
3. Set up database rules (use the database-rules.json provided in this repo)
4. Add your web app to the project to get your configuration
5. Update the `.env` file with your Firebase configuration

## Deployment

This project is configured to deploy to Firebase Hosting:

1. Install Firebase CLI if you haven't already:

```bash
npm install -g firebase-tools
```

2. Login to Firebase:

```bash
firebase login
```

3. Initialize Firebase in your project (if not already done):

```bash
firebase init
```

4. Deploy to Firebase Hosting:

```bash
npm run build
firebase deploy
```

## Usage

### Admin Access
- Username: oriel
- Password: 1234

### Client Features
- Book appointments by selecting date and time
- View and cancel your appointments
- See which time slots are available or booked

### Admin Features
- View all appointments
- Cancel any appointment
- See statistics about bookings

## Database Structure

The application uses the following structure in Firebase Realtime Database:

```
/reservations/
  /{reservationId}
    - name: string
    - phone: string
    - date: string (YYYY-MM-DD)
    - time: string
    - id: string
```

## License

MIT