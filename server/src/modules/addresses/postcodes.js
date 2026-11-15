/** Postcodes for known districts, falling back to the city's main postcode (copied from client/src/domain/address.js). */

const DISTRICT_POSTCODES = {
  'Al Rakah': '34445',
  'Al Yarmouk': '31952',
  Corniche: '31952',
  'Al Olaya': '12611',
  'Al Faisaliyah District': '32245',
  'Al Faisaliyah': '32245',
  'Al Rawdah': '23434',
};

const CITY_POSTCODES = {
  'Al Khobar': '31952',
  Dhahran: '34247',
  Dammam: '32245',
  'Al Ahsa': '36362',
  Riyadh: '12611',
  Jeddah: '23434',
};

export function postcodeFor(district, city) {
  return DISTRICT_POSTCODES[(district || '').trim()] || CITY_POSTCODES[(city || '').trim()] || '';
}
