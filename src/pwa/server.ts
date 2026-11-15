import "server-only";
import { createECDH } from "node:crypto";

export function pushSettings(env = process.env) {
  const publicKey = env.VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  const subject = env.VAPID_SUBJECT;
  if (
    !publicKey ||
    !privateKey ||
    !subject ||
    !/^mailto:[^\s@]+@[^\s@]+$/.test(subject)
  )
    return null;
  try {
    const key = createECDH("prime256v1");
    key.setPrivateKey(Buffer.from(privateKey, "base64url"));
    if (key.getPublicKey().toString("base64url") !== publicKey) return null;
  } catch {
    return null;
  }
  return { subject, publicKey, privateKey };
}

export function allowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    const host = url.hostname;
    return (
      url.protocol === "https:" &&
      !url.port &&
      !url.username &&
      !url.password &&
      (host === "fcm.googleapis.com" ||
        host === "updates.push.services.mozilla.com" ||
        host === "web.push.apple.com" ||
        host.endsWith(".push.apple.com") ||
        host.endsWith(".notify.windows.com"))
    );
  } catch {
    return false;
  }
}
