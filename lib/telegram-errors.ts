import { errors } from "teleproto";

export const {
  FloodWaitError,
  PasswordHashInvalidError,
  PhoneCodeExpiredError,
  PhoneCodeInvalidError,
  PhoneNumberInvalidError,
} = errors;

export function describeTelegramError(err: unknown): string {
  if (err instanceof PhoneNumberInvalidError) {
    return "Telefon numarası geçersiz. Ülke koduyla birlikte girin (örn. +905551112233).";
  }
  if (err instanceof PhoneCodeInvalidError) {
    return "Girilen kod yanlış.";
  }
  if (err instanceof PhoneCodeExpiredError) {
    return "Kodun süresi doldu, girişi yeniden başlatın.";
  }
  if (err instanceof PasswordHashInvalidError) {
    return "İki adımlı doğrulama şifresi yanlış.";
  }
  if (err instanceof FloodWaitError) {
    return `Çok fazla deneme yapıldı, ${err.seconds} saniye sonra tekrar deneyin.`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Bilinmeyen bir hata oluştu.";
}
