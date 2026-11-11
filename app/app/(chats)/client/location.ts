"use client";

export function formatAddressFromNominatim(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const address = (raw as { address?: Record<string, unknown> }).address;
  const displayName = (raw as { display_name?: unknown }).display_name;
  if (!address || typeof address !== "object") {
    if (typeof displayName === "string" && displayName.trim()) {
      return displayName.split(",").slice(0, 2).join(", ").trim() || null;
    }
    return null;
  }

  const roadCandidates = ["road", "pedestrian", "footway", "path", "residential"] as const;
  const localityCandidates = ["city", "town", "village", "hamlet", "suburb", "city_district", "county"] as const;
  const road = roadCandidates
    .map((key) => address[key])
    .find((value) => typeof value === "string" && value.trim());
  const houseNumber = address.house_number;
  const locality = localityCandidates
    .map((key) => address[key])
    .find((value) => typeof value === "string" && value.trim());

  const roadText = typeof road === "string" ? road.trim() : "";
  const houseText = typeof houseNumber === "string" ? houseNumber.trim() : "";
  const localityText = typeof locality === "string" ? locality.trim() : "";

  const primary = [roadText, houseText].filter(Boolean).join(", ");
  if (primary && localityText) {
    return `${primary}, ${localityText}`;
  }
  if (primary) return primary;
  if (localityText) return localityText;

  if (typeof displayName === "string" && displayName.trim()) {
    return displayName.split(",").slice(0, 2).join(", ").trim() || null;
  }
  return null;
}

export async function resolveLocationAddress(latitude: number, longitude: number) {
  if (typeof fetch !== "function") return null;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = setTimeout(() => controller?.abort(), 4500);
  try {
    const query = new URLSearchParams({
      format: "jsonv2",
      lat: String(latitude),
      lon: String(longitude),
      zoom: "18",
      addressdetails: "1",
      "accept-language": "ru",
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${query.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller?.signal,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as unknown;
    return formatAddressFromNominatim(data);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
