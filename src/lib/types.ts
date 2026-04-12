// ─── Enumi ───────────────────────────────────────────────────────────────────

export type Role = 'admin' | 'staff';
export type ReservationStatus = 'active' | 'cancelled';
export type PaymentType =
  | 'credit_card'
  | 'cash'
  | 'bank_transfer'
  | 'airbnb'
  | 'booking_com';
export type TaskSource = 'manual' | 'cleaning_auto';
export type InvoiceGenerateOn = 'check_in' | 'check_out';
export type InviteRole = 'admin' | 'staff';

// ─── Modeli baze ─────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  has_logged_in: boolean;
  invited_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Apartment {
  id: string;
  name: string;
  address: string;
  postal_code: string;
  city: string;
  country: string;
  check_in_time: string;
  check_out_time: string;
  owner_name: string;
  owner_oib: string;
  owner_address: string;
  owner_postal_code: string;
  owner_city: string;
  owner_country: string;
  is_deleted: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ApartmentUser {
  id: string;
  apartment_id: string;
  user_id: string;
  role: Role;
  added_at: string;
  added_by: string | null;
}

export interface InviteToken {
  id: string;
  email: string;
  apartment_ids: string[];
  role: InviteRole;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface Reservation {
  id: string;
  apartment_id: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  num_guests: number;
  guest_phone: string | null;
  payment_type: PaymentType | null;
  documents_received: boolean;
  guests_registered: boolean;
  amount_gross: number | null;
  commission: number | null;
  is_paid: boolean;
  status: ReservationStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ReservationCleaning {
  id: string;
  reservation_id: string;
  user_id: string;
  notified_immediately_at: string | null;
  notified_reminder_at: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  apartment_id: string;
  title: string;
  due_date: string;
  due_time: string | null;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  source: TaskSource;
  reservation_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExternalMember {
  id: string;
  name: string;
  email: string;
  created_by: string | null;
  created_at: string;
}

export interface ApartmentExternalMember {
  id: string;
  apartment_id: string;
  external_member_id: string;
  created_at: string;
}

export interface TaskAssignee {
  id: string;
  task_id: string;
  user_id: string | null;
  external_member_id: string | null;
  completion_token: string | null;
  completed_at: string | null;
  assigned_at: string;
}

export interface Invoice {
  id: string;
  reservation_id: string;
  apartment_id: string;
  invoice_number: number;
  invoice_number_display: string;
  generated_at: string;
  generated_by: string | null;
  pdf_url: string | null;
  created_at: string;
}

export interface ApartmentInvoiceSettings {
  id: string;
  apartment_id: string;
  auto_generate: boolean;
  generate_on: InvoiceGenerateOn;
  starting_number: number;
  last_invoice_number: number;
  created_at: string;
  updated_at: string;
}

// ─── Prošireni tipovi (JOIN upiti) ────────────────────────────────────────────

export interface ReservationWithApartment extends Reservation {
  apartments: Pick<Apartment, 'name' | 'check_out_time'>;
}

export interface TaskWithDetails extends Task {
  apartments: Pick<Apartment, 'name'>;
  task_assignees: Array<{
    user_id: string | null;
    external_member_id: string | null;
    profiles: { full_name: string; email: string };
  }>;
}

export interface ApartmentUserWithProfile extends ApartmentUser {
  profiles: Pick<Profile, 'full_name' | 'email' | 'has_logged_in' | 'invited_at'>;
  apartments: Pick<Apartment, 'name'>;
}

export interface UserWithApartments extends Profile {
  apartment_users: Array<ApartmentUser & { apartments: Pick<Apartment, 'name'> }>;
}

// ─── Status rezervacije (computed) ───────────────────────────────────────────

export type ReservationComputedStatus =
  | 'upcoming'
  | 'active'
  | 'completed'
  | 'cancelled';

export function getReservationStatus(
  reservation: Pick<Reservation, 'status' | 'check_in' | 'check_out'>
): ReservationComputedStatus {
  if (reservation.status === 'cancelled') return 'cancelled';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkIn = new Date(reservation.check_in);
  const checkOut = new Date(reservation.check_out);
  if (checkIn > today) return 'upcoming';
  if (checkOut <= today) return 'completed';
  return 'active';
}

export const STATUS_LABELS: Record<ReservationComputedStatus, string> = {
  upcoming: 'Nadolazeća',
  active: 'U toku',
  completed: 'Završena',
  cancelled: 'Otkazana',
};

export const STATUS_COLORS: Record<ReservationComputedStatus, string> = {
  upcoming: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
};

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  credit_card: 'Kartica',
  cash: 'Gotovina',
  bank_transfer: 'Bankovni prijenos',
  airbnb: 'Airbnb',
  booking_com: 'Booking.com',
};
