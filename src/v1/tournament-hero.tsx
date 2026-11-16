"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Tournament } from "./types";

export const heroBucket = "tournament-heroes";
const maxBytes = 5 * 1024 * 1024;
const accepted = ["image/jpeg", "image/png", "image/webp"];

async function prepareImage(file: File) {
  if (!accepted.includes(file.type) || file.size > maxBytes) {
    throw new Error("Choose a JPG, PNG or WebP image up to 5 MB.");
  }
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1920 / bitmap.width, 3840 / bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is unavailable.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.8),
    );
    if (blob?.type !== "image/webp" || blob.size > maxBytes) {
      throw new Error(
        "This image couldn’t be compressed to WebP. Try another image or paste a URL.",
      );
    }
    return blob;
  } finally {
    bitmap.close();
  }
}

export function TournamentHeroForm({
  event,
  busy,
  onSave,
}: {
  event: Tournament;
  busy: boolean;
  onSave: (
    fields: Record<string, unknown>,
    image: Blob | null,
  ) => Promise<void>;
}) {
  const [url, setUrl] = useState(event.hero_image_url ?? "");
  const [altText, setAltText] = useState(event.hero_image_alt ?? "");
  const [image, setImage] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const selection = useRef(0);

  useEffect(() => {
    if (!image) return;
    const objectUrl = URL.createObjectURL(image);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);

  async function pick(file: File) {
    const request = ++selection.current;
    setError("");
    setProcessing(true);
    try {
      const compressed = await prepareImage(file);
      if (request === selection.current) setImage(compressed);
    } catch (failure) {
      if (request === selection.current) {
        setError(
          accepted.includes(file.type) && file.size <= maxBytes
            ? "Couldn’t prepare this image. Try another file or paste an image URL."
            : (failure as Error).message,
        );
      }
    } finally {
      if (request === selection.current) setProcessing(false);
    }
  }

  function remove() {
    selection.current++;
    setProcessing(false);
    setError("");
    setImage(null);
    setUrl("");
    setAltText("");
  }

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = new FormData(formEvent.currentTarget);
    const alt = String(form.get("hero_image_alt") ?? "").trim();
    if ((image || url.trim()) && !alt) {
      setError("Add alt text that describes the hero image.");
      return;
    }
    setError("");
    await onSave({ ...Object.fromEntries(form), hero_image_alt: alt }, image);
  }

  let manualPreview = "";
  try {
    const candidate = new URL(url);
    if (candidate.protocol === "https:") manualPreview = candidate.href;
  } catch {
    // The field may still be incomplete.
  }
  const previewSrc = image ? preview : manualPreview;
  return (
    <form
      aria-label={`Hero for ${event.name}`}
      onSubmit={(e) => void submit(e)}
    >
      <h3>{event.name}</h3>
      <input type="hidden" name="tournament_id" value={event.id} />
      <label>
        City
        <input name="city" defaultValue={event.city ?? ""} maxLength={100} />
      </label>
      {previewSrc && (
        <Image
          unoptimized
          className="admin-hero-preview"
          src={previewSrc}
          alt="Tournament hero preview"
          width={480}
          height={240}
        />
      )}
      <label>
        {image || url ? "Replace hero image" : "Upload hero image"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            if (file) void pick(file);
          }}
        />
      </label>
      {processing && <p role="status">Preparing image…</p>}
      {image && <p>Image ready. Save hero to upload it.</p>}
      <label>
        Hero image URL
        <input
          name="hero_image_url"
          type="url"
          pattern="https://.+"
          maxLength={2048}
          value={url}
          disabled={busy || Boolean(image)}
          onChange={(e) => setUrl(e.target.value)}
        />
      </label>
      <label>
        Hero image alt text
        <input
          name="hero_image_alt"
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
          maxLength={200}
          required={Boolean(image || url.trim())}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button className="primary" disabled={busy || processing}>
        Save hero
      </button>
      {(image || url) && (
        <button type="button" disabled={busy} onClick={remove}>
          Remove hero image
        </button>
      )}
    </form>
  );
}
