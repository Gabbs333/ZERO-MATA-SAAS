# Supabase Auth Configuration Guide

This guide provides step-by-step instructions for configuring Supabase Authentication for the Snack Bar Management System.

## Prerequisites

- A Supabase project created at https://supabase.com
- Admin access to the Supabase Dashboard

## Configuration Steps

### 1. Enable Email/Password Authentication

1. Navigate to your Supabase project dashboard
2. Go to **Authentication** > **Providers**
3. Find **Email** in the list of providers
4. Toggle the **Enable Email provider** switch to ON
5. Click **Save**

### 2. Configure Email Templates

1. Go to **Authentication** > **Email Templates**
2. Configure the following templates:

#### Confirmation Email (Signup)
- **Subject**: `Confirmez votre inscription - Snack Bar`
- **Body**: Customize with your branding (default template is acceptable)

#### Magic Link
- **Subject**: `Connexion à votre compte - Snack Bar`
- **Body**: Customize with your branding (default template is acceptable)

#### Reset Password
- **Subject**: `Réinitialisation de votre mot de passe - Snack Bar`
- **Body**: Customize with your branding (default template is acceptable)

#### Change Email Address
- **Subject**: `Confirmez votre nouvelle adresse email - Snack Bar`
- **Body**: Customize with your branding (default template is acceptable)

### 3. Configure JWT Settings

1. Go to **Authentication** > **Settings**
2. Scroll to **JWT Settings**
3. Configure the following:
   - **JWT Expiry**: `3600` seconds (1 hour)
   - **Refresh Token Expiry**: `604800` seconds (7 days)
4. Click **Save**

### 4. Configure Password Requirements

1. Go to **Authentication** > **Settings**
2. Scroll to **Password Requirements**
3. Configure the following:
   - **Minimum Password Length**: `8` characters
   - **Require Uppercase**: Optional (recommended: OFF for simplicity)
   - **Require Lowercase**: Optional (recommended: OFF for simplicity)
   - **Require Numbers**: Optional (recommended: OFF for simplicity)
   - **Require Special Characters**: Optional (recommended: OFF for simplicity)
4. Click **Save**

### 5. Configure Site URL and Redirect URLs

1. Go to **Authentication** > **URL Configuration**
2. Set **Site URL**: Your production frontend URL (e.g., `https://snackbar.example.com`)
3. Add **Redirect URLs**:
   - `http://localhost:3000/**` (for local development)
   - `https://your-production-url.com/**` (for production)
4. Click **Save**

### 6. Disable Unused Providers (Optional but Recommended)

1. Go to **Authentication** > **Providers**
2. Ensure the following providers are **disabled**:
   - Google
   - GitHub
   - GitLab
   - Bitbucket
   - Azure
   - Facebook
   - Twitter
   - Discord
   - Twitch
   - Spotify
   - Apple
   - Slack
   - LinkedIn

This reduces attack surface and simplifies the authentication flow.

### 7. Configure Rate Limiting (Recommended)

1. Go to **Authentication** > **Rate Limits**
2. Configure the following limits:
   - **Sign up**: 10 requests per hour per IP
   - **Sign in**: 30 requests per hour per IP
   - **Password reset**: 5 requests per hour per IP
3. Click **Save**

## Verification

After completing the configuration:

1. Test user registration:
   ```bash
   curl -X POST 'https://your-project.supabase.co/auth/v1/signup' \
     -H "apikey: YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "testpassword123"
     }'
   ```

2. Test user login:
   ```bash
   curl -X POST 'https://your-project.supabase.co/auth/v1/token?grant_type=password' \
     -H "apikey: YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "testpassword123"
     }'
   ```

3. Verify JWT expiry by checking the `expires_in` field in the response (should be 3600)

## Security Best Practices

1. **Never commit** your `SUPABASE_SERVICE_ROLE_KEY` to version control
2. Use the **anon key** for client-side applications
3. Use the **service role key** only for server-side operations
4. Enable **email confirmation** in production (Authentication > Settings > Email Auth)
5. Consider enabling **2FA** for admin accounts
6. Regularly review **Auth logs** in the Supabase Dashboard

## Troubleshooting

### Users not receiving confirmation emails
- Check your email provider settings in Authentication > Settings
- Verify SMTP configuration if using custom SMTP
- Check spam folder

### JWT token expired errors
- Implement automatic token refresh in your client application
- Use Supabase client libraries which handle refresh automatically

### Password too weak errors
- Ensure password meets the minimum 8 character requirement
- Check for any additional requirements you may have enabled

## Next Steps

After completing this configuration:
1. Proceed to task 2.2: Create the profiles table
2. Set up Row Level Security policies (task 2.4)
3. Implement authentication in your client applications

## References

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Auth API Reference](https://supabase.com/docs/reference/javascript/auth-signup)
- [JWT Configuration](https://supabase.com/docs/guides/auth/sessions)
