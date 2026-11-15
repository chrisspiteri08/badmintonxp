"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { SupabaseClient } from "@supabase/supabase-js";

type NativeInstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const worker = "/badmintonxp-sw.js";
const weekMs = 7 * 24 * 60 * 60 * 1000;
const InstallContext = createContext<{
  prompt: NativeInstallPrompt | null;
  installed: boolean;
  clearPrompt: () => void;
}>({ prompt: null, installed: false, clearPrompt: () => {} });

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [prompt, setPrompt] = useState<NativeInstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const display = window.matchMedia("(display-mode: standalone)");
    const detect = () =>
      setInstalled(
        display.matches ||
          Boolean(
            (navigator as Navigator & { standalone?: boolean }).standalone,
          ),
      );
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as NativeInstallPrompt);
    };
    const onInstall = () => {
      setInstalled(true);
      setPrompt(null);
    };
    detect();
    display.addEventListener("change", detect);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstall);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register(worker, { scope: "/play" })
        .catch(() => {});
    }
    return () => {
      display.removeEventListener("change", detect);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstall);
    };
  }, []);
  return (
    <InstallContext.Provider
      value={{ prompt, installed, clearPrompt: () => setPrompt(null) }}
    >
      {children}
    </InstallContext.Provider>
  );
}

function decodePublicKey(key: string) {
  const decoded = atob(
    key
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(key.length / 4) * 4, "="),
  );
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

export function PwaControls({
  client,
  userId,
  played,
  resultScreen,
  profile,
}: {
  client: SupabaseClient;
  userId: string;
  played: boolean;
  resultScreen: boolean;
  profile: boolean;
}) {
  const { prompt, installed, clearPrompt } = useContext(InstallContext);
  const [eligible, setEligible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [ios, setIos] = useState(false);
  const [supported, setSupported] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null,
  );
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const playedKey = `badmintonxp-played:${userId}`;
  const dismissKey = `badmintonxp-install-dismissed:${userId}`;

  useEffect(() => {
    if (played) localStorage.setItem(playedKey, "true");
    setEligible(played || localStorage.getItem(playedKey) === "true");
    setDismissed(
      Date.now() - Number(localStorage.getItem(dismissKey)) < weekMs,
    );
    setIos(
      /iP(?:hone|ad|od)/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );
    setSupported(
      "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window,
    );
  }, [played, playedKey, dismissKey]);

  useEffect(() => {
    if (!supported || (!profile && !eligible && !installed)) return;
    let active = true;
    void (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const local = await registration.pushManager.getSubscription();
        const [config, stored] = await Promise.all([
          fetch("/api/push/config").then((response) => response.json()),
          local
            ? client
                .from("push_subscriptions")
                .select("endpoint")
                .eq("endpoint", local.endpoint)
                .eq("user_id", userId)
                .maybeSingle()
            : null,
        ]);
        if (!active) return;
        setPublicKey(config.publicKey);
        setSubscription(stored?.data && local ? local : null);
      } catch {
        if (active) setNotice("Reminders are unavailable right now.");
      } finally {
        if (active) setChecked(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [client, eligible, installed, profile, supported, userId]);

  function dismiss() {
    localStorage.setItem(dismissKey, String(Date.now()));
    setDismissed(true);
  }

  async function install() {
    if (!prompt) return;
    try {
      await prompt.prompt();
      if ((await prompt.userChoice).outcome === "dismissed") dismiss();
    } catch {
      dismiss();
    } finally {
      clearPrompt();
    }
  }

  async function toggle() {
    setBusy(true);
    setNotice("");
    try {
      if (subscription) {
        const { error } = await client
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", subscription.endpoint)
          .eq("user_id", userId);
        if (error) throw error;
        setSubscription(null);
        await subscription.unsubscribe().catch(() => {});
        setNotice("Reminders are off on this device.");
      } else if (publicKey) {
        if ((await Notification.requestPermission()) !== "granted") {
          setNotice(
            "Allow notifications in your browser settings to turn on reminders.",
          );
          return;
        }
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (existing) await existing.unsubscribe();
        const next = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodePublicKey(publicKey),
        });
        const { error } = await client.from("push_subscriptions").upsert({
          user_id: userId,
          endpoint: next.endpoint,
          keys: next.toJSON().keys,
        });
        if (error) {
          await next.unsubscribe().catch(() => {});
          throw error;
        }
        setSubscription(next);
        setNotice("Reminders are on for this device.");
      }
    } catch {
      setNotice("Couldn’t update reminders. Try again shortly.");
    } finally {
      setBusy(false);
    }
  }

  const showInstall =
    resultScreen &&
    eligible &&
    !installed &&
    !dismissed &&
    (Boolean(prompt) || ios);
  const showReminder =
    (eligible || installed || profile) &&
    (profile ||
      Boolean(notice) ||
      (!subscription && checked && Boolean(publicKey)));
  const slot = showInstall ? document.getElementById("pwa-install-slot") : null;
  return (
    <>
      {slot &&
        createPortal(
          <aside
            className="pwa-install-strip"
            aria-label="Add BadmintonXP to your home screen"
          >
            <div>
              <strong>Add BadmintonXP to your home screen</strong>
              {!prompt && (
                <small>In Safari, tap Share → Add to Home Screen.</small>
              )}
            </div>
            {prompt && (
              <button
                type="button"
                className="primary"
                onClick={() => void install()}
              >
                Install BadmintonXP
              </button>
            )}
            <button
              type="button"
              className="pwa-install-dismiss"
              aria-label="Maybe later"
              onClick={dismiss}
            >
              ×
            </button>
          </aside>,
          slot,
        )}
      {showReminder && (
        <aside className="panel pwa-controls" aria-label="Game reminders">
          <h2>Game reminders</h2>
          {subscription || publicKey ? (
            <button type="button" disabled={busy} onClick={() => void toggle()}>
              {subscription
                ? "Turn off reminders on this device"
                : "Remind me when today's quiz goes live"}
            </button>
          ) : (
            <p>
              {ios && !installed
                ? "Install BadmintonXP from Safari to enable reminders."
                : "Reminders are unavailable on this device right now."}
            </p>
          )}
          {notice && <p role="status">{notice}</p>}
        </aside>
      )}
    </>
  );
}

export function AdminPush({ accessToken }: { accessToken: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function send(kind: "quiz" | "match") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ kind }),
      });
      const result = await response.json();
      setMessage(
        response.ok
          ? `Sent ${result.sent}. Removed ${result.expired} expired subscriptions. ${result.failed} failed.`
          : result.error,
      );
    } catch {
      setMessage("Couldn’t send reminders. Try again shortly.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel pwa-controls">
      <h2>Push reminders</h2>
      <button type="button" disabled={busy} onClick={() => void send("quiz")}>
        Send quiz reminder
      </button>
      <button type="button" disabled={busy} onClick={() => void send("match")}>
        Send featured match reminder
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
