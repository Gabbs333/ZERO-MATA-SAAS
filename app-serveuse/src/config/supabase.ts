import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuration Supabase
// Fallback hardcoded values to ensure APK build works even if .env is missing in EAS
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://gmwxcwvknlnydaajvlow.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdtd3hjd3ZrbmxueWRhYWp2bG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NTI2ODEsImV4cCI6MjA4NjQyODY4MX0.7MrC8kQWKHEoF6r2kQDCoeG6QgXLrVtmDTP9DMrzJ5s';

// Créer le client Supabase avec AsyncStorage pour la persistance de session
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
