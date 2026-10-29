export function validCoordinates(value: { lat: number; lng: number } | undefined) {
  return !!value && Number.isFinite(value.lat) && Number.isFinite(value.lng) && Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180;
}
export function mapSettings(token = '') {
  if (!token) return { url: '', message: 'Map unavailable: configure VITE_MAPBOX_TOKEN. Report coordinates remain available.' };
  if (!token.startsWith('pk.') || /\s/.test(token)) return { url: '', message: 'Map unavailable: use a browser-safe Mapbox public token.' };
  return { url: 'https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}?access_token=' + encodeURIComponent(token), message: '' };
}
