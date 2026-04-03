import { getRequestConfig } from "next-intl/server";
import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";
import { cookies, headers } from "next/headers";

export default getRequestConfig(async () => {
  const locales = ["en", "zh"];

  const cookieSet = await cookies();
  let locale = cookieSet.get("NEXT_LOCALE")?.value;

  if (!locale || !locales.includes(locale)) {
    const negotiatorHeaders: Record<string, string> = {};
    (await headers()).forEach((value, key) => (negotiatorHeaders[key] = value));

    const languages = new Negotiator({ headers: negotiatorHeaders }).languages(
      locales,
    );
    locale = match(languages, locales, "en");
  }

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
