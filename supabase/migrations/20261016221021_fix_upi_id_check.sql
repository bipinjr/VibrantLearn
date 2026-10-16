-- Postgres regex repeat counts max out at 255; {2,256} made every UPI insert fail.
alter table internal.teacher_payout_details drop constraint teacher_payout_details_upi_id_check;
alter table internal.teacher_payout_details add constraint teacher_payout_details_upi_id_check
  check (upi_id ~ '^[A-Za-z0-9._-]{2,255}@[A-Za-z]{2,64}$');
