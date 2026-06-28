import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function uploadToCloudinary(file: File, uploadData: {
  upload_url: string; signature: string; timestamp: number;
  api_key: string; folder: string;
}): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("signature", uploadData.signature);
  form.append("timestamp", String(uploadData.timestamp));
  form.append("api_key", uploadData.api_key);
  form.append("folder", uploadData.folder);
  const res = await fetch(uploadData.upload_url, { method: "POST", body: form });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.secure_url as string;
}
