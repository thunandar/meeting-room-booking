export type Role = 'admin' | 'owner' | 'user';

export interface User {
  id: string;
  name: string;
  role: Role;
  createdAt?: string;
}

export interface Booking {
  id: string;
  userId: string;
  startTime: string;
  endTime: string;
  createdAt: string;
  user: { id: string; name: string; role: Role };
}

export interface UserUsageSummary {
  user: { id: string; name: string; role: Role };
  totalBookings: number;
  totalMinutes: number;
  bookings: { id: string; startTime: string; endTime: string; createdAt: string }[];
}
