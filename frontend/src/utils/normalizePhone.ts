export function normalizePhone(phone: string): string {
  if (!phone) return "";

  // hilangkan semua spasi, tanda hubung, titik, dll
  phone = phone.replace(/[^0-9+]/g, "");

  // jika mulai dengan +62 → ubah ke 62
  if (phone.startsWith("+62")) return "62" + phone.slice(3);

  // jika mulai dengan 62 → sudah benar
  if (phone.startsWith("62")) return phone;

  // jika mulai dengan 0 → ubah ke 62
  if (phone.startsWith("0")) return "62" + phone.slice(1);

  // jika mulai dengan 8 → tambahkan 62
  if (phone.startsWith("8")) return "62" + phone;

  // fallback: tetap kembalikan apa adanya
  return phone;
}
