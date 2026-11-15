/**
 * Branch directory (demo data from PDF screen 25). Coordinates are placeholders chosen so that
 * distances from the demo "Home" address match the PDF (2.4, 6.8, 14.2, 128, 392, 1,285 km).
 * `map` positions (0–100 %) place pins on the stylised map illustration.
 */

export const BRANCHES = [
  {
    id: 'khobar-corniche',
    name: 'Al Khobar · Corniche',
    displayName: 'Kuraat · Al Khobar Corniche',
    shortName: 'Al Khobar · Corniche',
    city: 'Al Khobar',
    area: 'Corniche',
    address: 'Prince Faisal bin Fahd Rd, Al Khobar 31952',
    phone: '+966 13 555 0110',
    hours: { open: 10, close: 24 },
    location: { lat: 26.30696, lng: 50.21868 },
    map: { x: 43, y: 38 },
  },
  {
    id: 'dhahran-king-abdulaziz',
    name: 'Dhahran · King Abdulaziz Rd',
    displayName: 'Kuraat · Dhahran · King Abdulaziz Rd',
    shortName: 'Dhahran · King Abdulaziz',
    city: 'Dhahran',
    area: 'King Abdulaziz Rd',
    address: 'King Abdulaziz Rd, Dhahran 34247',
    phone: '+966 13 555 0120',
    hours: { open: 10, close: 24 },
    location: { lat: 26.31796, lng: 50.14941 },
    map: { x: 60, y: 30 },
  },
  {
    id: 'dammam-faisaliyah',
    name: 'Dammam · Al Faisaliyah',
    displayName: 'Kuraat · Dammam Al Faisaliyah',
    shortName: 'Dammam · Al Faisaliyah',
    city: 'Dammam',
    area: 'Al Faisaliyah',
    address: 'Prince Mohammed bin Fahd Rd, Dammam 32245',
    phone: '+966 13 555 0130',
    hours: { open: 10, close: 24 },
    location: { lat: 26.39798, lng: 50.13722 },
    map: { x: 17, y: 25 },
  },
  {
    id: 'alahsa-hofuf',
    name: 'Al Ahsa · Hofuf',
    displayName: 'Kuraat · Al Ahsa Hofuf',
    shortName: 'Al Ahsa · Hofuf',
    city: 'Al Ahsa',
    area: 'Hofuf',
    address: 'King Abdullah Rd, Hofuf 36362',
    phone: '+966 13 555 0140',
    hours: { open: 10, close: 24 },
    location: { lat: 25.30838, lng: 49.53596 },
    map: { x: 72, y: 60 },
  },
  {
    id: 'riyadh-olaya',
    name: 'Riyadh · Olaya',
    displayName: 'Kuraat · Riyadh Olaya',
    shortName: 'Riyadh · Olaya',
    city: 'Riyadh',
    area: 'Olaya',
    address: 'Olaya St, Al Olaya, Riyadh 12611',
    phone: '+966 11 555 0150',
    hours: { open: 10, close: 24 },
    location: { lat: 24.71282, lng: 46.71363 },
    map: { x: 86, y: 18 },
  },
  {
    id: 'jeddah-rawdah',
    name: 'Jeddah · Al Rawdah',
    displayName: 'Kuraat · Jeddah Al Rawdah',
    shortName: 'Jeddah · Al Rawdah',
    city: 'Jeddah',
    area: 'Al Rawdah',
    address: 'Prince Sultan Rd, Al Rawdah, Jeddah 23434',
    phone: '+966 12 555 0160',
    hours: { open: 10, close: 24 },
    location: { lat: 21.37088, lng: 38.76694 },
    map: { x: 30, y: 72 },
  },
];

/** City list used by branch filters and the address form. */
export const CITIES = ['Al Khobar', 'Dhahran', 'Dammam', 'Al Ahsa', 'Riyadh', 'Jeddah'];

/** Approximate city centres for addresses entered manually. */
export const CITY_CENTRES = {
  'Al Khobar': { lat: 26.293, lng: 50.21 },
  Dhahran: { lat: 26.31, lng: 50.14 },
  Dammam: { lat: 26.41, lng: 50.125 },
  'Al Ahsa': { lat: 25.32, lng: 49.55 },
  Riyadh: { lat: 24.72, lng: 46.7 },
  Jeddah: { lat: 21.38, lng: 38.78 },
};

export const HEAD_OFFICE = {
  address: 'Prince Faisal bin Fahd Rd, Al Khobar 31952',
  supportHours: '9 AM – 11 PM',
  supportPhone: '+966 13 555 0100',
  email: 'care@kuraat.com',
  location: { lat: 26.30696, lng: 50.21868 },
};

export function getBranch(id) {
  return BRANCHES.find((b) => b.id === id) || null;
}

/** "Open · 10 AM – 12 AM" */
export function formatHours(hours) {
  const fmt = (h) => {
    const hh = h % 24;
    const suffix = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${h12} ${suffix}`;
  };
  return `${fmt(hours.open)} – ${fmt(hours.close)}`;
}

export function isOpenNow(hours, now = new Date()) {
  const h = now.getHours() + now.getMinutes() / 60;
  return h >= hours.open && h < hours.close;
}

export function mapsUrl(location, label = '') {
  const q = `${location.lat},${location.lng}${label ? ` (${label})` : ''}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function directionsUrl(location) {
  return `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`;
}

export function telUrl(phone) {
  return `tel:${phone.replace(/\s/g, '')}`;
}
