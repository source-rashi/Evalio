# Clerk Authentication Setup Guide

This application uses Clerk for authentication. Follow these steps to set up Clerk:

## 1. Create a Clerk Account

1. Go to [https://clerk.com/](https://clerk.com/)
2. Sign up for a free account
3. Create a new application

## 2. Get Your API Keys

1. In your Clerk Dashboard, go to **API Keys**
2. Copy your **Publishable Key** (starts with `pk_test_` or `pk_live_`)
3. Copy your **Secret Key** (starts with `sk_test_` or `sk_live_`)

## 3. Configure Environment Variables

### Backend Configuration

Create a `.env` file in the root directory:

```env
CLERK_SECRET_KEY=sk_test_your_actual_secret_key_here
PORT=5000
MONGO_URI=mongodb://localhost:27017/evalio
CORS_ORIGIN=http://localhost:3000
# ... other vars from .env.example
```

### Frontend Configuration

Create a `.env` file in the `frontend` directory:

```env
REACT_APP_CLERK_PUBLISHABLE_KEY=pk_test_your_actual_publishable_key_here
REACT_APP_API_URL=http://localhost:5000
```

## 4. Configure Clerk Settings

In your Clerk Dashboard:

### User Metadata Setup

1. Go to **User & Authentication** → **Metadata**
2. Enable both **Public Metadata** and **Private Metadata**
3. You can add a `role` field in public metadata for users (teacher/student)

### Email/Password Authentication

1. Go to **User & Authentication** → **Email, Phone, Username**
2. Ensure **Email address** is enabled
3. Go to **User & Authentication** → **Authentication**
4. Enable **Email verification code** or **Email verification link**

### Session Configuration

1. Go to **Configure** → **Sessions**
2. Set session lifetime as needed (default is fine)

## 5. Setting User Roles

After a user signs up, you can set their role via:

1. **Clerk Dashboard**: Go to Users → Select User → Edit Public Metadata
   ```json
   {
     "role": "teacher"
   }
   ```
   or
   ```json
   {
     "role": "student"
   }
   ```

2. **Programmatically**: You can update user metadata through Clerk's API or during signup

## 6. Run the Application

### Backend
```bash
npm install
npm start
```

### Frontend
```bash
cd frontend
npm install
npm start
```

## 7. Testing

1. Visit `http://localhost:3000/signup` to create a new account
2. After signing up, set the user's role in Clerk Dashboard
3. Visit `http://localhost:3000/login` to sign in
4. You'll be redirected based on your role (teacher → `/teacher`, student → `/student`)

## Authentication Flow

1. User signs up/signs in through Clerk's UI
2. Clerk issues a JWT session token
3. Frontend gets the token using `getToken()` from `useAuth()` hook
4. Frontend sends token in `Authorization: Bearer <token>` header
5. Backend verifies token using Clerk's `@clerk/express` package
6. Backend extracts user info (ID, email, role) from Clerk user object

## Troubleshooting

### "Missing Clerk Publishable Key" Error
- Ensure `.env` file exists in the frontend directory
- Restart the React dev server after adding env vars

### "Invalid token" on API calls
- Verify CLERK_SECRET_KEY is correctly set in backend `.env`
- Ensure the same Clerk application is used for both keys
- Check token is being sent in the Authorization header

### User Role Not Detected
- Verify user's public metadata contains the `role` field
- Check in Clerk Dashboard → Users → Select User → Metadata
