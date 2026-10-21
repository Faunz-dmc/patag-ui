import type { Photo } from "./types";
export const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:4100/api";
export const asset = (url: string) =>
  url.startsWith("data:") ? url : API.replace(/\/api$/, "") + "/api" + url;
export async function request<T>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const response = await fetch(API + path, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + (sessionStorage.getItem("patag-token") || ""),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Request failed. Please retry.");
  return data;
}
export async function upload(file: File, kind = "after"): Promise<Photo> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 8 * 1024 * 1024
  )
    throw new Error("Choose a JPEG, PNG or WebP photo under 8 MB.");
  const data = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read the photo."));
    r.readAsDataURL(file);
  });
  return request<Photo>("/uploads", { data, name: file.name, kind });
}
