export type VehicleCategory = 'SUV' | 'MPV' | 'Compact' | 'EV' | 'Scooter';
export type TransmissionType = 'Automatic' | 'Manual';
export type BaliHubCode = 'CANGGU' | 'KUTA' | 'AIRPORT_DPS' | 'UBUD' | 'SEMINYAK' | 'ULUWATU';

export interface BaliHub {
  code: BaliHubCode;
  name: string;
  area: string;
  address: string;
  latitude: number;
  longitude: number;
  hours: string;
  deliveryFeeIdr: number;
  highlights: string[];
}

export interface FleetVehicle {
  id: string;
  name: string;
  brand: string;
  year: number;
  category: VehicleCategory;
  transmission: TransmissionType;
  seats: number;
  luggageBags: number;
  fuelType: 'Petrol' | 'Hybrid' | 'Electric';
  dailyRateIdr: number;
  depositIdr: number;
  hubs: BaliHubCode[];
  surfRackReady: boolean;
  features: string[];
  recommendedFor: string[];
  rating: number;
  unitsTotal: number;
  tagline: string;
}

export const BALI_HUBS: Record<BaliHubCode, BaliHub> = {
  CANGGU: {
    code: 'CANGGU',
    name: 'Canggu Batu Bolong Hub',
    area: 'Canggu & Pererenan',
    address: 'Jl. Pantai Batu Bolong No. 88, Canggu, Kuta Utara',
    latitude: -8.6478,
    longitude: 115.1385,
    hours: '07:00 - 22:00 WITA',
    deliveryFeeIdr: 0,
    highlights: ['Free surf-rack mounting', '10 min villa drop-off in Berawa/Pererenan']
  },
  KUTA: {
    code: 'KUTA',
    name: 'Kuta Sunset Road HQ',
    area: 'Kuta & Legian',
    address: 'Jl. Sunset Road No. 112, Kuta, Badung',
    latitude: -8.7185,
    longitude: 115.1686,
    hours: '24 Hours Dispatch',
    deliveryFeeIdr: 0,
    highlights: ['Main fleet depot', '24/7 roadside swap & fast charger']
  },
  AIRPORT_DPS: {
    code: 'AIRPORT_DPS',
    name: 'Ngurah Rai Airport (DPS) Meet & Greet',
    area: 'Tuban / Airport Arrival',
    address: 'International Arrival Gate B, I Gusti Ngurah Rai Airport',
    latitude: -8.7467,
    longitude: 115.1668,
    hours: '05:00 - 01:00 WITA',
    deliveryFeeIdr: 75000,
    highlights: ['Curbside driver sign pickup', 'Flight-delay auto-sync']
  },
  UBUD: {
    code: 'UBUD',
    name: 'Ubud Monkey Forest Hub',
    area: 'Ubud, Tegallalang & Kintamani',
    address: 'Jl. Hanoman No. 45, Ubud, Gianyar',
    latitude: -8.5069,
    longitude: 115.2625,
    hours: '08:00 - 21:00 WITA',
    deliveryFeeIdr: 50000,
    highlights: ['Hill-climb tuned SUVs & MPVs', 'Child seats stocked on-site']
  },
  SEMINYAK: {
    code: 'SEMINYAK',
    name: 'Seminyak Oberoi Hub',
    area: 'Seminyak & Petitenget',
    address: 'Jl. Kayu Aya No. 27, Seminyak',
    latitude: -8.6913,
    longitude: 115.1682,
    hours: '08:00 - 22:00 WITA',
    deliveryFeeIdr: 0,
    highlights: ['Hotel concierge drop-off', 'EV & compact boutique city cars']
  },
  ULUWATU: {
    code: 'ULUWATU',
    name: 'Uluwatu Pecatu Cliff Hub',
    area: 'Uluwatu, Bingin & Nusa Dua',
    address: 'Jl. Labuansait No. 64, Pecatu, Kuta Selatan',
    latitude: -8.8291,
    longitude: 115.0849,
    hours: '08:00 - 21:00 WITA',
    deliveryFeeIdr: 50000,
    highlights: ['Soft-rack surf straps included', 'Cliff-road high clearance SUVs']
  }
};

export const FLEET_CATALOG: FleetVehicle[] = [
  {
    id: 'TOY-RAZ-04',
    name: 'Toyota Raize Turbo Sport',
    brand: 'Toyota',
    year: 2024,
    category: 'SUV',
    transmission: 'Automatic',
    seats: 5,
    luggageBags: 3,
    fuelType: 'Petrol',
    dailyRateIdr: 550000,
    depositIdr: 1000000,
    hubs: ['CANGGU', 'KUTA', 'SEMINYAK', 'AIRPORT_DPS', 'ULUWATU'],
    surfRackReady: true,
    features: ['5 Seater', 'Apple CarPlay', 'Cold A/C', 'Surf Rack Ready', 'Full Insurance'],
    recommendedFor: ['Canggu beach hops', 'Uluwatu cliffs', 'Couples & surf trips'],
    rating: 4.9,
    unitsTotal: 4,
    tagline: 'Nimble compact turbo SUV ideal for narrow Canggu shortcuts & surf racks'
  },
  {
    id: 'TOY-FRT-02',
    name: 'Toyota Fortuner GR Sport 4x2',
    brand: 'Toyota',
    year: 2024,
    category: 'SUV',
    transmission: 'Automatic',
    seats: 7,
    luggageBags: 5,
    fuelType: 'Petrol',
    dailyRateIdr: 1150000,
    depositIdr: 2000000,
    hubs: ['KUTA', 'AIRPORT_DPS', 'CANGGU', 'UBUD'],
    surfRackReady: true,
    features: ['7 Seater', '360° Camera', 'Leather Interior', 'High Clearance', 'Full Insurance'],
    recommendedFor: ['Kintamani & Bedugul hills', 'VIP airport transfers', 'Luxury villa groups'],
    rating: 4.95,
    unitsTotal: 2,
    tagline: 'Flagship 7-seat diesel SUV built for steep Bali mountain passes & long-distance comfort'
  },
  {
    id: 'SUZ-JMN-01',
    name: 'Suzuki Jimny 5-Door Adventure',
    brand: 'Suzuki',
    year: 2024,
    category: 'SUV',
    transmission: 'Automatic',
    seats: 4,
    luggageBags: 2,
    fuelType: 'Petrol',
    dailyRateIdr: 850000,
    depositIdr: 1500000,
    hubs: ['CANGGU', 'ULUWATU', 'UBUD'],
    surfRackReady: true,
    features: ['4x4 AllGrip', 'Roof Rack Included', 'Apple CarPlay', 'Off-road Ready'],
    recommendedFor: ['West Bali coastal surf', 'Uluwatu cliff beaches', 'Adventure photography'],
    rating: 4.92,
    unitsTotal: 2,
    tagline: 'Iconic boxy 4x4 adventure SUV with integrated surf & gear roof rack'
  },
  {
    id: 'MIT-XPN-02',
    name: 'Mitsubishi Xpander Cross',
    brand: 'Mitsubishi',
    year: 2024,
    category: 'MPV',
    transmission: 'Automatic',
    seats: 7,
    luggageBags: 4,
    fuelType: 'Petrol',
    dailyRateIdr: 480000,
    depositIdr: 1000000,
    hubs: ['KUTA', 'AIRPORT_DPS', 'UBUD', 'SEMINYAK', 'CANGGU'],
    surfRackReady: false,
    features: ['7 Seater', 'Dual Zone A/C', 'Child Seat Compatible', 'Android Auto'],
    recommendedFor: ['Family holidays', 'Airport luggage runs', 'Ubud temple tours'],
    rating: 4.85,
    unitsTotal: 5,
    tagline: 'Spacious 7-seat family crossover MPV with plush suspension over Bali roads'
  },
  {
    id: 'TOY-ZIX-01',
    name: 'Toyota Innova Zenix Hybrid',
    brand: 'Toyota',
    year: 2025,
    category: 'MPV',
    transmission: 'Automatic',
    seats: 7,
    luggageBags: 5,
    fuelType: 'Hybrid',
    dailyRateIdr: 820000,
    depositIdr: 1500000,
    hubs: ['AIRPORT_DPS', 'KUTA', 'SEMINYAK', 'UBUD'],
    surfRackReady: false,
    features: ['7 Seater', 'Captain Seats', 'Hybrid Quiet Ride', 'Panoramic Roof'],
    recommendedFor: ['Executive charters', 'Long island loops', 'Families with strollers'],
    rating: 4.94,
    unitsTotal: 3,
    tagline: 'Whisper-quiet hybrid MPV with captain seats & top fuel efficiency across Bali'
  },
  {
    id: 'HYU-ION-01',
    name: 'Hyundai Ioniq 5 Signature EV',
    brand: 'Hyundai',
    year: 2024,
    category: 'EV',
    transmission: 'Automatic',
    seats: 5,
    luggageBags: 3,
    fuelType: 'Electric',
    dailyRateIdr: 1250000,
    depositIdr: 2000000,
    hubs: ['SEMINYAK', 'CANGGU', 'KUTA', 'AIRPORT_DPS'],
    surfRackReady: false,
    features: ['450km Range', 'Free Fast Charging', 'V2L Power Outlet', 'ADAS Safety'],
    recommendedFor: ['Zero-emission island cruising', 'Seminyak & Canggu luxury stays'],
    rating: 4.96,
    unitsTotal: 2,
    tagline: 'All-electric luxury crossover with complimentary charging at Easy Rent hubs'
  },
  {
    id: 'HON-BRIO-03',
    name: 'Honda Brio RS Urbanite',
    brand: 'Honda',
    year: 2024,
    category: 'Compact',
    transmission: 'Automatic',
    seats: 4,
    luggageBags: 2,
    fuelType: 'Petrol',
    dailyRateIdr: 320000,
    depositIdr: 750000,
    hubs: ['KUTA', 'CANGGU', 'SEMINYAK', 'UBUD', 'AIRPORT_DPS'],
    surfRackReady: false,
    features: ['Compact Parking', 'Cold A/C', 'Bluetooth Audio', 'Fuel Saver'],
    recommendedFor: ['Budget city driving', 'Rainy day scooter alternative', 'Tight Seminyak alleys'],
    rating: 4.78,
    unitsTotal: 6,
    tagline: 'Agile, super-economical city hatchback that fits easily into tight Bali lanes'
  },
  {
    id: 'YAM-NMX-05',
    name: 'Yamaha NMAX 155 Connected',
    brand: 'Yamaha',
    year: 2024,
    category: 'Scooter',
    transmission: 'Automatic',
    seats: 2,
    luggageBags: 1,
    fuelType: 'Petrol',
    dailyRateIdr: 150000,
    depositIdr: 500000,
    hubs: ['CANGGU', 'UBUD', 'SEMINYAK', 'KUTA', 'ULUWATU'],
    surfRackReady: true,
    features: ['155cc VVA', 'Dual ABS', '2 SNI Helmets', 'Phone Mount + USB', 'Side Surf Rack Optional'],
    recommendedFor: ['Solo & couple riders', 'Traffic-free Canggu commute', 'Sunset beach runs'],
    rating: 4.91,
    unitsTotal: 10,
    tagline: 'Bali’s favorite maxi-scooter with ABS braking, phone holder & 2 fresh helmets'
  },
  {
    id: 'HON-PCX-02',
    name: 'Honda PCX 160 ABS',
    brand: 'Honda',
    year: 2024,
    category: 'Scooter',
    transmission: 'Automatic',
    seats: 2,
    luggageBags: 1,
    fuelType: 'Petrol',
    dailyRateIdr: 165000,
    depositIdr: 500000,
    hubs: ['UBUD', 'CANGGU', 'SEMINYAK', 'ULUWATU'],
    surfRackReady: false,
    features: ['160cc eSP+', 'Smart Key', '30L Underseat Storage', '2 SNI Helmets', 'Rain Ponchos'],
    recommendedFor: ['Ubud scenic rides', 'Comfortable two-up touring'],
    rating: 4.88,
    unitsTotal: 8,
    tagline: 'Plush maxi-scooter with huge underseat storage & keyless ignition'
  },
  {
    id: 'VES-SPT-01',
    name: 'Vespa Sprint S 150 i-Get',
    brand: 'Vespa',
    year: 2024,
    category: 'Scooter',
    transmission: 'Automatic',
    seats: 2,
    luggageBags: 1,
    fuelType: 'Petrol',
    dailyRateIdr: 240000,
    depositIdr: 750000,
    hubs: ['CANGGU', 'SEMINYAK', 'ULUWATU'],
    surfRackReady: false,
    features: ['Italian Style', 'Front ABS', '2 Retro Helmets', 'Phone Mount'],
    recommendedFor: ['Seminyak cafe hopping', 'Canggu coastal cruising', 'Editorial shoots'],
    rating: 4.9,
    unitsTotal: 4,
    tagline: 'Stylish Vespa Sprint S curated for effortless Seminyak & Canggu boulevard rides'
  }
];

export function normalizeHub(input?: string): BaliHubCode | undefined {
  if (!input) return undefined;
  const upper = input.trim().toUpperCase();
  if (upper.includes('CANGGU') || upper.includes('BERAWA') || upper.includes('PERERENAN')) return 'CANGGU';
  if (upper.includes('AIRPORT') || upper.includes('DPS') || upper.includes('NGURAH')) return 'AIRPORT_DPS';
  if (upper.includes('KUTA') || upper.includes('LEGIAN') || upper.includes('SUNSET')) return 'KUTA';
  if (upper.includes('UBUD') || upper.includes('GIANYAR') || upper.includes('TEGALLALANG')) return 'UBUD';
  if (upper.includes('SEMINYAK') || upper.includes('OBEROI') || upper.includes('PETITENGET')) return 'SEMINYAK';
  if (upper.includes('ULUWATU') || upper.includes('PECATU') || upper.includes('BINGIN') || upper.includes('NUSA DUA')) return 'ULUWATU';
  return undefined;
}

