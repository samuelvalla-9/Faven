// Minimal API client for the Faven backend.
// Auto-detects the dev machine's LAN IP from Expo's dev server, so it works
// in Expo Go on a real phone (same Wi-Fi), Android emulator, and web alike.
import Constants from 'expo-constants';
import { Platform } from 'react-native';

function resolveBaseUrl(): string {
  // Explicit override (used for tunnel mode): set in app/.env as EXPO_PUBLIC_API_URL
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override) return override;
  // hostUri looks like "10.64.137.127:8081" when served by `expo start`
  const hostUri = (Constants.expoConfig as any)?.hostUri as string | undefined;
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:4000`;
  if (Platform.OS === 'android') return 'http://10.0.2.2:4000';
  return 'http://localhost:4000';
}

export const BASE_URL = resolveBaseUrl();

let authToken: string | null = null;
export function setToken(token: string | null) {
  authToken = token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  requestOtp: (phone: string) =>
    request<{ ok: boolean; message: string }>('/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),
  verifyOtp: (phone: string, code: string) =>
    request<{ token: string; user: any }>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    }),
  me: () => request<{ user: any }>('/auth/me'),
  updateMe: (fields: { name?: string; username?: string; city?: string }) =>
    request<{ user: any }>('/auth/me', { method: 'PATCH', body: JSON.stringify(fields) }),
  feed: () => request<{ reviews: any[] }>('/reviews/feed'),
  restaurants: (q = '') => request<{ restaurants: any[] }>(`/restaurants?q=${encodeURIComponent(q)}`),
  restaurant: (id: number) => request<{ restaurant: any; reviews: any[] }>(`/restaurants/${id}`),
  leaderboard: (city = 'Bangalore') =>
    request<{ city: string; leaderboard: any[] }>(`/leaderboard?city=${encodeURIComponent(city)}`),
  rewards: () =>
    request<{ entries: any[]; totals: { inr: number; coins: number } }>('/rewards'),
  submitReview: (form: FormData) =>
    request<{ review: any; rewards: any[]; verification?: { tier: string; signals: Record<string, number>; details: any } }>('/reviews', { method: 'POST', body: form }),
};
