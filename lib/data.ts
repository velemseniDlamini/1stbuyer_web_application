// NOTE: This is clearly-labelled SAMPLE catalogue data for the prototype.
// It is not a live scraping feed. Prices and specs are illustrative.

/**
 * Where the catalogue on screen actually came from. Any screen presenting
 * catalogue data must surface this, so bundled sample data is never mistaken
 * for a live feed, the same requirement that applies when a real backend falls
 * back to bundled constants after a failed fetch.
 */
export type CatalogueSource = {
  kind: 'bundled' | 'live' | 'stale-fallback'
  label: string
  detail: string
}

export const CATALOGUE_SOURCE: CatalogueSource = {
  kind: 'bundled',
  label: 'Sample catalogue, not a live feed',
  detail:
    'These listings ship with the app as illustrative examples. Prices, mileage and availability are not live, and no dealer has confirmed them. Treat every figure as a worked example, not an offer.',
}

export type Vehicle = {
  id: string
  make: string
  model: string
  variant: string
  year: number
  price: number
  mileage: number
  fuel: 'Petrol' | 'Diesel' | 'Hybrid'
  transmission: 'Manual' | 'Automatic'
  city: string
  province: string
  dealer: string
  image: string
}

export const VEHICLES: Vehicle[] = [
  {
    id: 'v1',
    make: 'Volkswagen',
    model: 'Polo',
    variant: '1.0 TSI Life',
    year: 2023,
    price: 329900,
    mileage: 24500,
    fuel: 'Petrol',
    transmission: 'Manual',
    city: 'Johannesburg',
    province: 'Gauteng',
    dealer: 'Super Group Constantia Kloof',
    image: '/cars/vw-polo.png',
  },
  {
    id: 'v2',
    make: 'Toyota',
    model: 'Corolla Cross',
    variant: '1.8 Hybrid XS',
    year: 2024,
    price: 469900,
    mileage: 12800,
    fuel: 'Hybrid',
    transmission: 'Automatic',
    city: 'Pretoria',
    province: 'Gauteng',
    dealer: 'Super Group Menlyn',
    image: '/cars/toyota-corolla-cross.png',
  },
  {
    id: 'v3',
    make: 'Suzuki',
    model: 'Swift',
    variant: '1.2 GL',
    year: 2023,
    price: 219900,
    mileage: 31200,
    fuel: 'Petrol',
    transmission: 'Manual',
    city: 'Cape Town',
    province: 'Western Cape',
    dealer: 'Super Group N1 City',
    image: '/cars/suzuki-swift.png',
  },
  {
    id: 'v4',
    make: 'Ford',
    model: 'Ranger',
    variant: '2.0 SiT XLT D/Cab',
    year: 2022,
    price: 589900,
    mileage: 48900,
    fuel: 'Diesel',
    transmission: 'Automatic',
    city: 'Durban',
    province: 'KwaZulu-Natal',
    dealer: 'Super Group Umhlanga',
    image: '/cars/ford-ranger.png',
  },
  {
    id: 'v5',
    make: 'Hyundai',
    model: 'i20',
    variant: '1.2 Motion',
    year: 2024,
    price: 289900,
    mileage: 9800,
    fuel: 'Petrol',
    transmission: 'Manual',
    city: 'Johannesburg',
    province: 'Gauteng',
    dealer: 'Super Group Constantia Kloof',
    image: '/cars/hyundai-i20.png',
  },
  {
    id: 'v6',
    make: 'Volkswagen',
    model: 'T-Cross',
    variant: '1.0 TSI Comfortline',
    year: 2023,
    price: 399900,
    mileage: 27600,
    fuel: 'Petrol',
    transmission: 'Automatic',
    city: 'Centurion',
    province: 'Gauteng',
    dealer: 'Super Group Menlyn',
    image: '/cars/vw-tcross.png',
  },
  {
    id: 'v7',
    make: 'Toyota',
    model: 'Starlet',
    variant: '1.5 Xi',
    year: 2023,
    price: 249900,
    mileage: 35400,
    fuel: 'Petrol',
    transmission: 'Manual',
    city: 'Port Elizabeth',
    province: 'Eastern Cape',
    dealer: 'Super Group Gqeberha',
    image: '/cars/toyota-starlet.png',
  },
  {
    id: 'v8',
    make: 'Kia',
    model: 'Sonet',
    variant: '1.5 EX',
    year: 2024,
    price: 359900,
    mileage: 14200,
    fuel: 'Petrol',
    transmission: 'Automatic',
    city: 'Cape Town',
    province: 'Western Cape',
    dealer: 'Super Group N1 City',
    image: '/cars/kia-sonet.png',
  },
]

export const VEHICLE_MAKES = Array.from(new Set(VEHICLES.map((v) => v.make))).sort()

export type Dealer = {
  id: string
  name: string
  city: string
  province: string
  brands: string[]
  website: string
}

// Real-style branch metadata only. Deliberately no ratings, review counts,
// years-trading or compliance claims, none of that is verifiable here.
export const DEALERS: Dealer[] = [
  {
    id: 'd1',
    name: 'Super Group Constantia Kloof',
    city: 'Roodepoort',
    province: 'Gauteng',
    brands: ['Volkswagen', 'Hyundai', 'Audi'],
    website: 'https://www.supergroupdealerships.co.za',
  },
  {
    id: 'd2',
    name: 'Super Group Menlyn',
    city: 'Pretoria',
    province: 'Gauteng',
    brands: ['Toyota', 'Volkswagen', 'Lexus'],
    website: 'https://www.supergroupdealerships.co.za',
  },
  {
    id: 'd3',
    name: 'Super Group N1 City',
    city: 'Cape Town',
    province: 'Western Cape',
    brands: ['Suzuki', 'Kia', 'Renault'],
    website: 'https://www.supergroupdealerships.co.za',
  },
  {
    id: 'd4',
    name: 'Super Group Umhlanga',
    city: 'Durban',
    province: 'KwaZulu-Natal',
    brands: ['Ford', 'Mazda', 'Isuzu'],
    website: 'https://www.supergroupdealerships.co.za',
  },
  {
    id: 'd5',
    name: 'Super Group Gqeberha',
    city: 'Port Elizabeth',
    province: 'Eastern Cape',
    brands: ['Toyota', 'Suzuki'],
    website: 'https://www.supergroupdealerships.co.za',
  },
  {
    id: 'd6',
    name: 'Super Group Bloemfontein',
    city: 'Bloemfontein',
    province: 'Free State',
    brands: ['Volkswagen', 'Hyundai'],
    website: 'https://www.supergroupdealerships.co.za',
  },
  {
    id: 'd7',
    name: 'Super Group Nelspruit',
    city: 'Mbombela',
    province: 'Mpumalanga',
    brands: ['Ford', 'Kia', 'Mazda'],
    website: 'https://www.supergroupdealerships.co.za',
  },
]

export type Insurer = {
  id: string
  name: string
  baseMonthly: number // indicative placeholder, NOT a quote
  excess: number
  note: string
}

// Real companies, indicative placeholder pricing only. Not quotes.
export const INSURERS: Insurer[] = [
  { id: 'i1', name: 'Discovery Insure', baseMonthly: 1180, excess: 6500, note: 'Rewards safe driving via Vitality Drive.' },
  { id: 'i2', name: 'OUTsurance', baseMonthly: 1090, excess: 5900, note: 'OUTbonus cash-back after claim-free years.' },
  { id: 'i3', name: 'King Price', baseMonthly: 940, excess: 6900, note: 'Premium decreases as the car depreciates.' },
  { id: 'i4', name: 'MiWay', baseMonthly: 1010, excess: 6200, note: 'Fully online, flexible cover options.' },
  { id: 'i5', name: 'Santam', baseMonthly: 1260, excess: 5500, note: 'Established insurer, broad cover.' },
  { id: 'i6', name: 'Momentum Insure', baseMonthly: 1150, excess: 6000, note: 'Safety-linked premium adjustments.' },
]

export const PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
]

export const EMPLOYMENT_STATUSES = [
  'Permanently employed',
  'Contract / temporary',
  'Self-employed',
  'Commission-based',
  'Not currently earning',
]

export const BUYING_GOALS = [
  'My first car',
  'Upgrading my current car',
  'Buying for family',
  'Replacing a written-off car',
  'Just exploring for now',
]

export const CREDIT_BUREAUS = [
  { id: 'transunion', name: 'TransUnion MyCreditCheck', url: 'https://www.transunion.co.za' },
  { id: 'clearscore', name: 'ClearScore', url: 'https://www.clearscore.com/za' },
  { id: 'experian', name: 'Experian', url: 'https://www.experian.co.za' },
  { id: 'xds', name: 'XDS', url: 'https://www.xds.co.za' },
]

/**
 * Cities and towns offered per province.
 *
 * Free text here was a small disaster for data quality: "Jhb", "joburg",
 * "Johannesburg " and "Johanesburg" are four different values to any query that
 * groups by city, and a buyer typing on a phone should not be doing data entry
 * at all. This is not an exhaustive gazetteer, it is the places most first-time
 * buyers actually live, plus an "Other" escape so nobody is locked out.
 */
export const CITIES_BY_PROVINCE: Record<string, string[]> = {
  'Eastern Cape': ['Gqeberha (Port Elizabeth)', 'East London', 'Mthatha', 'Queenstown', 'Uitenhage'],
  'Free State': ['Bloemfontein', 'Welkom', 'Bethlehem', 'Sasolburg', 'Kroonstad'],
  Gauteng: [
    'Johannesburg',
    'Pretoria',
    'Centurion',
    'Soweto',
    'Sandton',
    'Roodepoort',
    'Benoni',
    'Boksburg',
    'Kempton Park',
    'Vereeniging',
    'Krugersdorp',
    'Midrand',
  ],
  'KwaZulu-Natal': ['Durban', 'Pietermaritzburg', 'Umhlanga', 'Newcastle', 'Richards Bay', 'Ladysmith'],
  Limpopo: ['Polokwane', 'Tzaneen', 'Mokopane', 'Thohoyandou', 'Lephalale'],
  Mpumalanga: ['Mbombela (Nelspruit)', 'Witbank (eMalahleni)', 'Secunda', 'Middelburg', 'Ermelo'],
  'Northern Cape': ['Kimberley', 'Upington', 'Springbok', 'De Aar', 'Kuruman'],
  'North West': ['Rustenburg', 'Potchefstroom', 'Klerksdorp', 'Mahikeng', 'Brits'],
  'Western Cape': ['Cape Town', 'Stellenbosch', 'Paarl', 'George', 'Worcester', 'Somerset West'],
}

/** Offered at the end of every city list, so an unlisted town is still usable. */
export const OTHER_CITY = 'Other'

export function citiesFor(province: string): string[] {
  const cities = CITIES_BY_PROVINCE[province]
  return cities ? [...cities, OTHER_CITY] : []
}
