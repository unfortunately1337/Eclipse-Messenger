import { describe, expect, it } from "vitest";
import { buildLoginCodeEmailHtml, buildPasswordResetCodeEmailHtml } from "./email";

describe("localized account emails", () => {
  it("uses English by default and keeps the code intact", () => {
    const html = buildLoginCodeEmailHtml("123456");
    expect(html).toContain('lang="en"');
    expect(html).toContain("123456");
    expect(html).toContain("Your code");
    expect(html).not.toMatch(/[А-Яа-яЁё]/);
  });
  it("keeps the Russian version when explicitly selected", () => {
    const html = buildLoginCodeEmailHtml("654321", "ru");
    expect(html).toContain('lang="ru"');
    expect(html).toContain("654321");
    expect(html).toContain("Ваш код");
    expect(html).toContain("Не сообщайте его никому");
  });
  it("localizes password recovery without changing its purpose", () => {
    const html = buildPasswordResetCodeEmailHtml("246810", "en");
    expect(html).toContain("reset your Eclipse account password");
    expect(html).toContain("246810");
    expect(html).not.toMatch(/[А-Яа-яЁё]/);
  });
});
