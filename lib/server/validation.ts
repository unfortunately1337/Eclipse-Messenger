import { z } from "zod";
import { LINK_REGEX } from "@/lib/server/constants";

export function normalizeLink(link: string) {
  return link.trim().replace(/^@+/, "").toLowerCase();
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export const linkSchema = z
  .string()
  .transform(normalizeLink)
  .refine((value) => LINK_REGEX.test(value), {
    message: "Уникальное имя должно начинаться с буквы, заканчиваться буквой или цифрой и содержать 4-32 символа: a-z, 0-9, _",
  });

export const passwordSchema = z
  .string()
  .min(10, "Пароль должен быть не короче 10 символов")
  .max(128, "Пароль слишком длинный")
  .refine((value) => /[A-Z]/.test(value), "Пароль должен включать заглавную букву")
  .refine((value) => /[a-z]/.test(value), "Пароль должен включать строчную букву")
  .refine((value) => /[0-9]/.test(value), "Пароль должен включать цифру");

export const emailSchema = z
  .string()
  .email("Некорректный email")
  .transform(normalizeEmail);
