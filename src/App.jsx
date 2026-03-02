import { useState, useEffect, useMemo } from 'react';
import './App.css';
import { MapView } from './components/MapView';
import { ChatBox } from './components/ChatBox';
import mentalHealthPins from './data/mentalHealthPins.json';
import { parseUserIntent } from './utils/gptIntentParser';
import { filterPins, generateFilterSummary } from './utils/filterLogic';

const DC_CENTER = { lat: 38.9072, lng: -77.0369 };
const KM_TO_MILES = 0.621371;
const WALK_SPEED_KM_PER_HOUR = 4.8;
const WALKABLE_RADIUS_KM = 3.2;
const OPENAI_PLACEHOLDER_KEY = 'your_openai_api_key_here';
const PRIORITY_YOGA_RESOURCE_NAME = 'Yoga at updogyogacommunity';
const YOGA_CLASSES_URL = 'https://www.updogyogacommunity.com/classes';
const CALL_RESOURCE_TYPES = new Set(['therapist', 'clinic', 'psychiatrist', 'crisis']);
const ETHERAPY_PIN_COUNT = 250;

const STUCK_PROMPT_PATTERN = /\b(stuck|out of my head|in my head|overthink|overthinking|mind racing|racing thoughts|spiral|trapped)\b/i;
const RECENT_PROMPT_PATTERN = /\b(just recently|recently|lately|past few days|few days|couple days|this week|not long)\b/i;
const NOT_READY_FOR_PHYSICAL_PATTERN = /\b(not wearing|not dressed|not appropriate|no shoes|in pajamas|in pyjamas|can't go out|cannot go out|not ready to go out)\b/i;
const DARK_THOUGHTS_PROMPT_PATTERN = /\b(dark thoughts?|something happened to me|happened to me a few years ago|trauma(?:tic)? memor(?:y|ies)|flashbacks?)\b/i;
const EXACT_NOT_SURE_WHAT_TO_DO_PATTERN = /^\s*i(?:'|’)?m not sure what to do\?\s*$/i;
const DONT_KNOW_WHAT_TO_DO_PATTERN = /^\s*i\s*(?:do not|don't|don’t)\s+know what to do[.!?]?\s*$/i;
const NO_PROMPT_PATTERN = /^\s*no[.!?]?\s*$/i;
const TRAUMA_SUPPORT_PATTERN = /\b(ptsd|trauma|trauma_informed|suicide_prevention|emdr)\b/i;
const EMDR_PATTERN = /\bemdr\b/i;
const SEVERE_DARK_THOUGHTS_PATTERN = /\b(ptsd|trauma|suicide_prevention|intrusive_thoughts|mood_disorders|bipolar|psychosis|schizophrenia|medication_management|crisis)\b/i;
const SUPPORT_MESSAGE_PATTERN = /\b(stuck|overwhelm|anxious|anxiety|sad|depress|panic|stress|out of my head|in my head|need help)\b/i;
const RESOURCE_QUERY_PATTERN = /\b(therap|clinic|psychiat|support group|resource|near me|insurance|rating|show me|find|specializ)\b/i;
const HIGH_ACUITY_RESOURCE_TYPES = new Set(['therapist', 'clinic', 'psychiatrist', 'crisis']);
const TOUR_STEPS = [
  {
    target: 'cards',
    title: 'Nearest resources',
    description: 'These are the nearest places to your location you can get help.'
  },
  {
    target: 'chat',
    title: 'Chat guidance',
    description: "Let us find the help you're looking for. Unless you specifically want us to remember you, all chats are anonymous."
  },
  {
    target: 'map',
    title: 'Map view',
    description: 'Each pin maps to a resource card so you can compare distance and location.'
  }
];

const ETHERAPY_LAND_SEEDS = [
  { lat: 40.7128, lng: -74.0060 }, // New York
  { lat: 34.0522, lng: -118.2437 }, // Los Angeles
  { lat: 41.8781, lng: -87.6298 }, // Chicago
  { lat: 29.7604, lng: -95.3698 }, // Houston
  { lat: 33.4484, lng: -112.0740 }, // Phoenix
  { lat: 39.7392, lng: -104.9903 }, // Denver
  { lat: 47.6062, lng: -122.3321 }, // Seattle
  { lat: 25.7617, lng: -80.1918 }, // Miami
  { lat: 45.5017, lng: -73.5673 }, // Montreal
  { lat: 43.6532, lng: -79.3832 }, // Toronto
  { lat: 49.2827, lng: -123.1207 }, // Vancouver
  { lat: 19.4326, lng: -99.1332 }, // Mexico City
  { lat: -23.5505, lng: -46.6333 }, // Sao Paulo
  { lat: -22.9068, lng: -43.1729 }, // Rio de Janeiro
  { lat: -34.6037, lng: -58.3816 }, // Buenos Aires
  { lat: -33.4489, lng: -70.6693 }, // Santiago
  { lat: -12.0464, lng: -77.0428 }, // Lima
  { lat: 4.7110, lng: -74.0721 }, // Bogota
  { lat: -16.4897, lng: -68.1193 }, // La Paz
  { lat: 51.5074, lng: -0.1278 }, // London
  { lat: 48.8566, lng: 2.3522 }, // Paris
  { lat: 52.5200, lng: 13.4050 }, // Berlin
  { lat: 40.4168, lng: -3.7038 }, // Madrid
  { lat: 41.9028, lng: 12.4964 }, // Rome
  { lat: 52.3676, lng: 4.9041 }, // Amsterdam
  { lat: 50.8503, lng: 4.3517 }, // Brussels
  { lat: 48.2082, lng: 16.3738 }, // Vienna
  { lat: 50.0755, lng: 14.4378 }, // Prague
  { lat: 52.2297, lng: 21.0122 }, // Warsaw
  { lat: 59.3293, lng: 18.0686 }, // Stockholm
  { lat: 59.9139, lng: 10.7522 }, // Oslo
  { lat: 60.1699, lng: 24.9384 }, // Helsinki
  { lat: 38.7223, lng: -9.1393 }, // Lisbon
  { lat: 53.3498, lng: -6.2603 }, // Dublin
  { lat: 37.9838, lng: 23.7275 }, // Athens
  { lat: 44.4268, lng: 26.1025 }, // Bucharest
  { lat: 47.4979, lng: 19.0402 }, // Budapest
  { lat: 50.4501, lng: 30.5234 }, // Kyiv
  { lat: 47.3769, lng: 8.5417 }, // Zurich
  { lat: 30.0444, lng: 31.2357 }, // Cairo
  { lat: 6.5244, lng: 3.3792 }, // Lagos
  { lat: -1.2921, lng: 36.8219 }, // Nairobi
  { lat: -26.2041, lng: 28.0473 }, // Johannesburg
  { lat: -33.9249, lng: 18.4241 }, // Cape Town
  { lat: 9.03, lng: 38.74 }, // Addis Ababa
  { lat: 5.6037, lng: -0.1870 }, // Accra
  { lat: 33.5731, lng: -7.5898 }, // Casablanca
  { lat: 36.7538, lng: 3.0588 }, // Algiers
  { lat: 14.7167, lng: -17.4677 }, // Dakar
  { lat: 41.0082, lng: 28.9784 }, // Istanbul
  { lat: 32.0853, lng: 34.7818 }, // Tel Aviv
  { lat: 24.7136, lng: 46.6753 }, // Riyadh
  { lat: 25.2048, lng: 55.2708 }, // Dubai
  { lat: 35.6892, lng: 51.3890 }, // Tehran
  { lat: 33.3152, lng: 44.3661 }, // Baghdad
  { lat: 31.9539, lng: 35.9106 }, // Amman
  { lat: 33.8938, lng: 35.5018 }, // Beirut
  { lat: 28.6139, lng: 77.2090 }, // Delhi
  { lat: 19.0760, lng: 72.8777 }, // Mumbai
  { lat: 12.9716, lng: 77.5946 }, // Bangalore
  { lat: 22.5726, lng: 88.3639 }, // Kolkata
  { lat: 24.8607, lng: 67.0011 }, // Karachi
  { lat: 31.5204, lng: 74.3587 }, // Lahore
  { lat: 23.8103, lng: 90.4125 }, // Dhaka
  { lat: 27.7172, lng: 85.3240 }, // Kathmandu
  { lat: 6.9271, lng: 79.8612 }, // Colombo
  { lat: 13.7563, lng: 100.5018 }, // Bangkok
  { lat: 21.0278, lng: 105.8342 }, // Hanoi
  { lat: 10.8231, lng: 106.6297 }, // Ho Chi Minh City
  { lat: 3.1390, lng: 101.6869 }, // Kuala Lumpur
  { lat: 1.3521, lng: 103.8198 }, // Singapore
  { lat: -6.2088, lng: 106.8456 }, // Jakarta
  { lat: 14.5995, lng: 120.9842 }, // Manila
  { lat: 25.0330, lng: 121.5654 }, // Taipei
  { lat: 22.3193, lng: 114.1694 }, // Hong Kong
  { lat: 31.2304, lng: 121.4737 }, // Shanghai
  { lat: 39.9042, lng: 116.4074 }, // Beijing
  { lat: 22.5431, lng: 114.0579 }, // Shenzhen
  { lat: 37.5665, lng: 126.9780 }, // Seoul
  { lat: 35.6762, lng: 139.6503 }, // Tokyo
  { lat: 34.6937, lng: 135.5023 }, // Osaka
  { lat: 43.0618, lng: 141.3545 }, // Sapporo
  { lat: 47.8864, lng: 106.9057 }, // Ulaanbaatar
  { lat: 43.2220, lng: 76.8512 }, // Almaty
  { lat: -33.8688, lng: 151.2093 }, // Sydney
  { lat: -37.8136, lng: 144.9631 }, // Melbourne
  { lat: -27.4698, lng: 153.0251 }, // Brisbane
  { lat: -31.9505, lng: 115.8605 }, // Perth
  { lat: -34.9285, lng: 138.6007 }, // Adelaide
  { lat: -36.8485, lng: 174.7633 }, // Auckland
  { lat: -41.2866, lng: 174.7756 }, // Wellington
  { lat: -43.5321, lng: 172.6362 } // Christchurch
];

const createSeededRandom = (seed) => {
  let currentSeed = seed >>> 0;
  return () => {
    currentSeed += 0x6D2B79F5;
    let t = currentSeed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const clampLatitude = (latitude) => Math.max(-58, Math.min(75, latitude));

const wrapLongitude = (longitude) => ((((longitude + 180) % 360) + 360) % 360) - 180;

const generateEtherapyPins = (count) => {
  const random = createSeededRandom(20260302);

  return Array.from({ length: count }, (_, index) => {
    const seed = ETHERAPY_LAND_SEEDS[Math.floor(random() * ETHERAPY_LAND_SEEDS.length)];
    const jitterStrength = 0.2 + random() * 0.9;
    const lat = clampLatitude(seed.lat + (random() - 0.5) * 1.6 * jitterStrength);
    const lng = wrapLongitude(seed.lng + (random() - 0.5) * 2.8 * jitterStrength);

    return {
      id: `etherapy-${index + 1}`,
      name: 'Generic e-therapy service',
      type: 'telehealth',
      address: 'Online',
      lat,
      lng
    };
  });
};

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const getDistanceKm = (from, to) => {
  const earthRadiusKm = 6371;
  const latDiff = toRadians(to.lat - from.lat);
  const lngDiff = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);

  const a = Math.sin(latDiff / 2) ** 2
    + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDiff / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
};

const formatDistanceMiles = (distanceKm) => `${(distanceKm * KM_TO_MILES).toFixed(1)} mi`;

const normalizePhoneForDial = (phone = '') => phone.replace(/[^\d+]/g, '');

const getPinsByDistance = (pins, center) => pins
  .map((pin) => ({
    pin,
    distanceKm: getDistanceKm(center, { lat: pin.lat, lng: pin.lng })
  }))
  .sort((a, b) => a.distanceKm - b.distanceKm);

const getClosestPins = (pins, center, limit) => getPinsByDistance(pins, center)
  .slice(0, Math.min(limit, pins.length))
  .map(({ pin }) => pin);

const getTraumaSupportPins = (pins, center, limit) => {
  const traumaRelevantPins = pins.filter((pin) =>
    pin.type === 'crisis'
    || pin.specializations.some((specialization) => TRAUMA_SUPPORT_PATTERN.test(specialization))
  );

  const sourcePins = traumaRelevantPins.length > 0 ? traumaRelevantPins : pins;
  return getClosestPins(sourcePins, center, limit);
};

const getEmdrSevereSupportPins = (pins, center, limit) => {
  const highAcuityPins = pins.filter((pin) => HIGH_ACUITY_RESOURCE_TYPES.has(pin.type));

  const emdrPins = highAcuityPins.filter((pin) =>
    pin.specializations.some((specialization) => EMDR_PATTERN.test(specialization))
  );

  const severeSupportPins = highAcuityPins.filter((pin) =>
    pin.type === 'crisis'
    || pin.specializations.some((specialization) => SEVERE_DARK_THOUGHTS_PATTERN.test(specialization))
  );

  const prioritizedPool = emdrPins.length > 0 ? emdrPins : severeSupportPins;
  const prioritizedIds = new Set(prioritizedPool.map((pin) => pin.id));
  const combinedPool = [
    ...prioritizedPool,
    ...severeSupportPins.filter((pin) => !prioritizedIds.has(pin.id))
  ];

  if (combinedPool.length === 0) {
    return getTraumaSupportPins(pins, center, limit);
  }

  return getClosestPins(combinedPool, center, limit);
};

const getPrioritizedClosestPins = (pins, center, limit, prioritizedName) => {
  const normalizedName = prioritizedName.trim().toLowerCase();
  const prioritizedPin = pins.find((pin) => pin.name.trim().toLowerCase() === normalizedName);

  if (!prioritizedPin) {
    return getClosestPins(pins, center, limit);
  }

  const remainingPins = pins.filter((pin) => pin.id !== prioritizedPin.id);
  const remainingClosest = getClosestPins(remainingPins, center, Math.max(0, limit - 1));

  return [prioritizedPin, ...remainingClosest];
};

const getCardCtaConfig = (pin) => {
  const isYogaCard = pin.name.trim().toLowerCase() === PRIORITY_YOGA_RESOURCE_NAME.toLowerCase();
  const shouldCall = CALL_RESOURCE_TYPES.has(pin.type);

  if (shouldCall) {
    const phone = normalizePhoneForDial(pin.phone);
    return {
      label: 'Call now',
      variant: 'call',
      href: phone ? `tel:${phone}` : '#'
    };
  }

  if (isYogaCard) {
    return {
      label: 'Book now',
      variant: 'book',
      href: YOGA_CLASSES_URL,
      target: '_blank',
      rel: 'noopener noreferrer'
    };
  }

  return {
    label: 'Book now',
    variant: 'book',
    href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pin.address)}`,
    target: '_blank',
    rel: 'noopener noreferrer'
  };
};

const getCtaIcon = (variant) => {
  if (variant === 'call') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path
          d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V21c0 .6-.4 1-1 1C10.1 22 2 13.9 2 3c0-.6.4-1 1-1h4.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1l-2.2 2.2z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 2v3M17 2v3M3 9h18" strokeLinecap="round" />
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="m9 14 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const isApiKeyConfigured = () => {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY?.trim();
  return Boolean(apiKey) && apiKey !== OPENAI_PLACEHOLDER_KEY;
};

const getOfflineConversationReply = (query, currentFunnel, currentStep) => {
  const normalizedQuery = query.replace(/[’‘]/g, "'").trim();

  if (EXACT_NOT_SURE_WHAT_TO_DO_PATTERN.test(normalizedQuery)) {
    return {
      reply: 'People who are here to help are now prioritized on your map. Please try calling one of these resources.',
      nextFunnel: 'dark_thoughts',
      nextStep: 2,
      filterMode: 'emdr_severe',
      filterLimit: 12,
      zoomOutLevels: 0,
      showHighAcuityOverlay: true
    };
  }

  if (DARK_THOUGHTS_PROMPT_PATTERN.test(normalizedQuery)) {
    return {
      reply: "Okay, we've filtered resources in your area based on the information you provided. Feel free to keep chatting so I can further refine suggestions and help.",
      nextFunnel: 'dark_thoughts',
      nextStep: 1,
      filterMode: 'trauma',
      filterLimit: 12,
      zoomOutLevels: 0
    };
  }

  if (currentFunnel === 'dark_thoughts' && currentStep >= 1 && DONT_KNOW_WHAT_TO_DO_PATTERN.test(normalizedQuery)) {
    return {
      reply: 'Have you heard of EMDR (Eye Movement Desensitization and Reprocessing)?',
      nextFunnel: 'dark_thoughts',
      nextStep: Math.max(2, currentStep),
      zoomOutLevels: 0
    };
  }

  if (currentFunnel === 'dark_thoughts' && currentStep >= 2 && NO_PROMPT_PATTERN.test(normalizedQuery)) {
    return {
      reply: 'EMDR helps reprocess traumatic memories so they lose emotional intensity. You might consider asking about it about it to see if it could be appropriate for you.',
      nextFunnel: 'dark_thoughts',
      nextStep: 3,
      zoomOutLevels: 0
    };
  }

  if (STUCK_PROMPT_PATTERN.test(normalizedQuery)) {
    return {
      reply: "Totally hear you, and we're here to help. Have you been feeling this way for long?",
      nextFunnel: 'stuck',
      nextStep: 1,
      zoomOutLevels: 0
    };
  }

  if (currentFunnel === 'stuck' && currentStep >= 1 && RECENT_PROMPT_PATTERN.test(normalizedQuery)) {
    return {
      reply: 'Would you like to speak to someone or do something perhaps physical?',
      nextFunnel: 'stuck',
      nextStep: 2,
      filterLimit: 45,
      zoomOutLevels: 0
    };
  }

  if (currentFunnel === 'stuck' && currentStep >= 2 && NOT_READY_FOR_PHYSICAL_PATTERN.test(normalizedQuery)) {
    return {
      reply: 'Hmm... Have you tried breath work? No yoga mat required.',
      nextFunnel: 'stuck',
      nextStep: 3,
      filterLimit: 6,
      zoomOutLevels: 1,
      prioritizeResourceName: PRIORITY_YOGA_RESOURCE_NAME,
      followupReply:
        "Found 6 resources matching your criteria. Check the map to explore them or let's keep chatting if these recommendations don't resonate."
    };
  }

  if (SUPPORT_MESSAGE_PATTERN.test(normalizedQuery) && !RESOURCE_QUERY_PATTERN.test(normalizedQuery)) {
    return {
      reply: "Thanks for sharing that. If you'd like, tell me if this started recently or has been around for a while.",
      nextFunnel: currentFunnel,
      nextStep: currentStep
    };
  }

  return null;
};

const getOfflineFilteredPins = (pins, center, offlineReply) => {
  const limit = offlineReply.filterLimit;
  if (typeof limit !== 'number') return null;

  if (offlineReply.filterMode === 'trauma') {
    return getTraumaSupportPins(pins, center, limit);
  }

  if (offlineReply.filterMode === 'emdr_severe') {
    return getEmdrSevereSupportPins(pins, center, limit);
  }

  if (offlineReply.prioritizeResourceName) {
    return getPrioritizedClosestPins(
      pins,
      center,
      limit,
      offlineReply.prioritizeResourceName
    );
  }

  return getClosestPins(pins, center, limit);
};

function App() {
  const [filteredPins, setFilteredPins] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(true);
  const [isHighAcuityOverlayOpen, setIsHighAcuityOverlayOpen] = useState(false);
  const [isRememberMeModalOpen, setIsRememberMeModalOpen] = useState(false);
  const [isRememberMeEnabled, setIsRememberMeEnabled] = useState(false);
  const [rememberMeMethod, setRememberMeMethod] = useState('');
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackResourceName, setFeedbackResourceName] = useState('');
  const [feedbackAnswers, setFeedbackAnswers] = useState({ useful: '', booked: '' });
  const [isEtherapyMode, setIsEtherapyMode] = useState(false);
  const [isTourOptIn, setIsTourOptIn] = useState(true);
  const [isTourEnabled, setIsTourEnabled] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [userLocation, setUserLocation] = useState(DC_CENTER);
  const [locationLabel, setLocationLabel] = useState('Using approximate location');
  const [offlineConversationFunnel, setOfflineConversationFunnel] = useState('none');
  const [offlineConversationStep, setOfflineConversationStep] = useState(0);
  const [mapZoomOutLevels, setMapZoomOutLevels] = useState(0);
  const etherapyPins = useMemo(() => generateEtherapyPins(ETHERAPY_PIN_COUNT), []);

  const isTourActive = isTourEnabled && !isSupportModalOpen;
  const isHighAcuityOverlayActive = isHighAcuityOverlayOpen && !isSupportModalOpen;
  const currentTourStep = isTourActive ? TOUR_STEPS[tourStepIndex] : null;
  const isCardsTourStep = currentTourStep?.target === 'cards';
  const isMapTourStep = currentTourStep?.target === 'map';
  const isChatTourStep = currentTourStep?.target === 'chat';

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        if (isRememberMeModalOpen) {
          setIsRememberMeModalOpen(false);
          return;
        }

        if (isSupportModalOpen) {
          setIsSupportModalOpen(false);
          return;
        }

        setIsHighAcuityOverlayOpen(false);
      }
    };

    if (isSupportModalOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isRememberMeModalOpen, isSupportModalOpen]);

  useEffect(() => {
    if (!isTourActive) return undefined;

    const handleTourEscape = (event) => {
      if (event.key === 'Escape') {
        setIsTourEnabled(false);
        setTourStepIndex(0);
      }
    };

    window.addEventListener('keydown', handleTourEscape);
    return () => {
      window.removeEventListener('keydown', handleTourEscape);
    };
  }, [isTourActive]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationLabel('Location not supported - using DC center');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setLocationLabel('Using your live location');
      },
      () => {
        setLocationLabel('Location permission denied - using DC center');
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000
      }
    );
  }, []);

  const visiblePins = filteredPins.length > 0 ? filteredPins : mentalHealthPins;

  const mapPanelPins = useMemo(() => {
    const pinsByDistance = getPinsByDistance(visiblePins, userLocation)
      .map(({ pin, distanceKm }) => ({
        ...pin,
        distanceKm
      }));

    const walkablePins = pinsByDistance.filter((pin) => pin.distanceKm <= WALKABLE_RADIUS_KM);
    const nearestCandidates = (walkablePins.length >= 3 ? walkablePins : pinsByDistance).slice(0, 3);

    const isRecommendationMode = filteredPins.length === 6
      && filteredPins.some(
        (pin) => pin.name.trim().toLowerCase() === PRIORITY_YOGA_RESOURCE_NAME.toLowerCase()
      );

    let selectedPins = nearestCandidates;
    if (isRecommendationMode) {
      const recommendedPin = pinsByDistance.find(
        (pin) => pin.name.trim().toLowerCase() === PRIORITY_YOGA_RESOURCE_NAME.toLowerCase()
      );

      if (recommendedPin) {
        const nonRecommendedNearest = pinsByDistance
          .filter((pin) => pin.id !== recommendedPin.id)
          .slice(0, 2);
        selectedPins = [recommendedPin, ...nonRecommendedNearest];
      }
    }

    return selectedPins.map((pin, index) => ({
      ...pin,
      walkMinutes: Math.max(1, Math.round((pin.distanceKm / WALK_SPEED_KM_PER_HOUR) * 60)),
      distanceMilesLabel: formatDistanceMiles(pin.distanceKm),
      cardLabel: isRecommendationMode && index === 0
        ? '#1 recommended'
        : `#${index + 1} nearest`
    }));
  }, [filteredPins, userLocation, visiblePins]);

  const mapFocusPins = useMemo(() => {
    if (filteredPins.length > 0 && filteredPins.length <= 6) {
      return filteredPins;
    }

    return mapPanelPins;
  }, [filteredPins, mapPanelPins]);

  const handleUserQuery = async (query) => {
    setIsHighAcuityOverlayOpen(false);
    setIsLoading(true);

    try {
      const normalizedQuery = query.replace(/[’‘]/g, "'").trim();
      if (!isApiKeyConfigured() || EXACT_NOT_SURE_WHAT_TO_DO_PATTERN.test(normalizedQuery)) {
        const offlineReply = getOfflineConversationReply(
          query,
          offlineConversationFunnel,
          offlineConversationStep
        );
        if (offlineReply) {
          if (typeof offlineReply.nextFunnel === 'string') {
            setOfflineConversationFunnel(offlineReply.nextFunnel);
          }
          setOfflineConversationStep(offlineReply.nextStep);
          if (typeof offlineReply.showHighAcuityOverlay === 'boolean') {
            setIsHighAcuityOverlayOpen(offlineReply.showHighAcuityOverlay);
            if (offlineReply.showHighAcuityOverlay) {
              setIsTourEnabled(false);
              setTourStepIndex(0);
            }
          }
          const selectedPins = getOfflineFilteredPins(
            mentalHealthPins,
            userLocation,
            offlineReply
          );
          if (selectedPins) {
            setFilteredPins(selectedPins);
          }
          if (typeof offlineReply.zoomOutLevels === 'number') {
            setMapZoomOutLevels(offlineReply.zoomOutLevels);
          }
          if (window.addBotMessage) {
            await window.addBotMessage(offlineReply.reply);
            if (offlineReply.followupReply) {
              await window.addBotMessage(offlineReply.followupReply);
            }
          }
          return;
        }
      }

      // Step 1: Send only the user's query to GPT-4 (not any pin data)
      const intentResponse = await parseUserIntent(query);

      // Step 2: Apply filters locally on the frontend
      const results = filterPins(mentalHealthPins, intentResponse.filters);

      // Step 3: Generate user-friendly response
      const summary = generateFilterSummary(
        results,
        intentResponse.filters,
        mentalHealthPins.length
      );

      // Update state with filtered pins
      setFilteredPins(results);
      setMapZoomOutLevels(0);

      // Add bot response to chat
      if (window.addBotMessage) {
        window.addBotMessage(summary);
      }
    } catch (error) {
      console.error('Error processing query:', error);
      if (window.addBotMessage) {
        window.addBotMessage(
          "I encountered an error processing your request. Please try again or check if your API key is configured."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const closeTour = () => {
    setIsTourEnabled(false);
    setTourStepIndex(0);
  };

  const closeHighAcuityOverlay = () => {
    setIsHighAcuityOverlayOpen(false);
  };

  const openRememberMeModal = () => {
    setIsRememberMeModalOpen(true);
  };

  const closeRememberMeModal = () => {
    setIsRememberMeModalOpen(false);
  };

  const handleRememberMeChoice = (method) => {
    setRememberMeMethod(method);
    setIsRememberMeEnabled(true);
    setIsRememberMeModalOpen(false);
  };

  const openFeedbackModal = (resourceName) => {
    setFeedbackResourceName(resourceName);
    setFeedbackAnswers({ useful: '', booked: '' });
    setIsFeedbackModalOpen(true);
  };

  const closeFeedbackModal = () => {
    setIsFeedbackModalOpen(false);
  };

  const addFeedbackToChat = async (question, answer) => {
    const userFeedbackText = `${question} ${answer}.`;
    if (window.addUserMessage) {
      await window.addUserMessage(userFeedbackText);
    } else if (window.addBotMessage) {
      await window.addBotMessage(userFeedbackText);
    }

    if (window.addBotMessage) {
      await window.addBotMessage('Thanks. Your feedback helps improve recommendations.');
    }
  };

  const refreshRecommendationsAfterRejection = () => {
    const currentRecommendationSet = filteredPins.length > 0 ? filteredPins : mapPanelPins;
    const recommendationLimit = Math.max(
      filteredPins.length > 0 ? filteredPins.length : currentRecommendationSet.length,
      3
    );

    const excludedIds = new Set(currentRecommendationSet.map((pin) => pin.id));
    const rejectedPin = mentalHealthPins.find(
      (pin) => pin.name.trim().toLowerCase() === feedbackResourceName.trim().toLowerCase()
    );
    if (rejectedPin) {
      excludedIds.add(rejectedPin.id);
    }

    const primaryPool = mentalHealthPins.filter((pin) => !excludedIds.has(pin.id));
    const refreshedPins = getClosestPins(primaryPool, userLocation, recommendationLimit);

    if (refreshedPins.length < recommendationLimit) {
      const selectedIds = new Set(refreshedPins.map((pin) => pin.id));
      const fallbackPins = getClosestPins(
        mentalHealthPins.filter((pin) => !selectedIds.has(pin.id) && (!rejectedPin || pin.id !== rejectedPin.id)),
        userLocation,
        recommendationLimit - refreshedPins.length
      );
      setFilteredPins([...refreshedPins, ...fallbackPins]);
      return;
    }

    setFilteredPins(refreshedPins);
  };

  const handleUsefulFeedbackSelection = async (value) => {
    if (feedbackAnswers.useful) return;

    setFeedbackAnswers((previousAnswers) => ({
      ...previousAnswers,
      useful: value
    }));

    await addFeedbackToChat('Was this a useful recommendation?', value);

    if (value === 'No') {
      refreshRecommendationsAfterRejection();
      if (window.addBotMessage) {
        await window.addBotMessage(
          `Sorry you didn't think ${feedbackResourceName} was the right fit, here's some new recommendations for you to try.`
        );
      }
    }
  };

  const handleBookedFeedbackSelection = async (value) => {
    if (!feedbackAnswers.useful || feedbackAnswers.booked) return;

    setFeedbackAnswers((previousAnswers) => ({
      ...previousAnswers,
      booked: value
    }));

    await addFeedbackToChat('Did you book a session?', value);
    closeFeedbackModal();
  };

  const handleResourceCtaClick = (event, cta, pin) => {
    if (cta.variant !== 'call') return;
    if (cta.href === '#') {
      event.preventDefault();
    }
    openFeedbackModal(pin.name);
  };

  const handleEtherapyToggle = () => {
    setIsEtherapyMode((previousValue) => {
      const nextValue = !previousValue;

      if (nextValue) {
        closeHighAcuityOverlay();
        closeTour();
      }

      return nextValue;
    });
  };

  const startTour = () => {
    setIsTourEnabled(true);
    setTourStepIndex(0);
  };

  const handleContinueToResources = () => {
    setIsSupportModalOpen(false);

    if (isTourOptIn) {
      startTour();
      return;
    }

    closeTour();
  };

  const handleTourNext = () => {
    if (tourStepIndex >= TOUR_STEPS.length - 1) {
      closeTour();
      return;
    }
    setTourStepIndex((prev) => prev + 1);
  };

  const handleTourBack = () => {
    setTourStepIndex((prev) => Math.max(0, prev - 1));
  };

  return (
    <>
      <div className="app-container">
        <div className="map-section">
          <div className="map-info">
            <div className="map-info-row">
              <h1>Resources near you</h1>
              <div className="map-action-buttons">
                <button
                  type="button"
                  className="support-note-btn"
                  onClick={() => {
                    setIsSupportModalOpen(true);
                    closeRememberMeModal();
                    closeHighAcuityOverlay();
                    closeTour();
                  }}
                >
                  Support note
                </button>
                <button
                  type="button"
                  className="mode-toggle-btn"
                  onClick={handleEtherapyToggle}
                >
                  {isEtherapyMode ? 'show ne nearest resource' : "I'm open to e-therapy"}
                </button>
              </div>
            </div>
            <p className="map-info-subtitle">
              Explore local care options and refine results by your needs.
            </p>
            <p className="location-status">
              {isEtherapyMode ? 'Showing virtual providers worldwide' : locationLabel}
            </p>
           
            <p className="pin-count">
              {isEtherapyMode
                ? `${ETHERAPY_PIN_COUNT} e-therapy services found`
                : filteredPins.length > 0
                ? `${filteredPins.length} resource${filteredPins.length !== 1 ? 's' : ''} found`
                : `${mentalHealthPins.length} total resources available`}
            </p>
          </div>
          <div className={`map-canvas ${isMapTourStep ? 'tour-focus tour-focus-map' : ''}`}>
            <MapView
              pins={mentalHealthPins}
              filteredPins={filteredPins}
              userLocation={userLocation}
              nearestPins={isEtherapyMode ? [] : mapFocusPins}
              zoomOutLevels={isEtherapyMode ? 0 : mapZoomOutLevels}
              isEtherapyMode={isEtherapyMode}
              etherapyPins={etherapyPins}
            />
            {!isEtherapyMode && (
              <div
                className={`nearby-cards-panel ${isCardsTourStep ? 'tour-focus tour-focus-cards' : ''}`}
                aria-label="Nearest walkable resources"
              >
                {mapPanelPins.map((pin) => {
                  const cta = getCardCtaConfig(pin);

                  return (
                    <article
                      className={`nearby-card ${isCardsTourStep ? 'tour-focus-card' : ''}`}
                      key={pin.id}
                    >
                      <p className="nearby-card-rank">{pin.cardLabel}</p>
                      <h3>{pin.name}</h3>
                      <p className="nearby-card-metrics">
                        {pin.distanceMilesLabel} away • {pin.walkMinutes} min walk
                      </p>
                      <p><strong>Type:</strong> {pin.type.replace(/_/g, ' ')}</p>
                      <p><strong>Address:</strong> {pin.address}</p>
                      <p>
                        <strong>Top care focus:</strong> {pin.specializations.slice(0, 2).join(', ')}
                      </p>
                      <div className="nearby-card-actions">
                      <a
                        className={`nearby-card-cta nearby-card-cta-${cta.variant}`}
                        href={cta.href}
                        target={cta.target}
                        rel={cta.rel}
                        onClick={(event) => handleResourceCtaClick(event, cta, pin)}
                      >
                        <span className="nearby-card-cta-icon" aria-hidden="true">
                          {getCtaIcon(cta.variant)}
                        </span>
                          <span>{cta.label}</span>
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className={`chat-section ${isChatTourStep ? 'tour-focus tour-focus-chat' : ''}`}>
          <ChatBox
            onFilter={handleUserQuery}
            isLoading={isLoading}
            onRememberMeRequest={openRememberMeModal}
            isRememberMeEnabled={isRememberMeEnabled}
          />
        </div>
      </div>

      {isHighAcuityOverlayActive && (
        <>
          <div className="high-acuity-overlay" role="presentation" />
          <div
            className="high-acuity-popover"
            role="dialog"
            aria-modal="true"
            aria-label="People are here to help"
          >
            <h3>People are here to help</h3>
            <p>Please try calling one of these resources</p>
            <button
              type="button"
              className="tour-close"
              aria-label="Close recommendations guidance"
              onClick={closeHighAcuityOverlay}
            >
              &times;
            </button>
          </div>
        </>
      )}

      {isRememberMeModalOpen && (
        <div
          className="remember-me-modal-overlay"
          role="presentation"
          onClick={closeRememberMeModal}
        >
          <div
            className="remember-me-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Remember me"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="remember-me-modal-close"
              aria-label="Close remember me"
              onClick={closeRememberMeModal}
            >
              &times;
            </button>
            <h3>Remember me</h3>
            <p>Choose how you want to sign up or log in.</p>
            <p className="remember-me-disclaimer">
              Disclaimer: remembering will make data not anonymous anymore.
            </p>
            <div className="remember-me-actions">
              <button
                type="button"
                className="remember-me-auth-btn remember-me-auth-google"
                onClick={() => handleRememberMeChoice('google')}
              >
                Sign up / Log in with Google
              </button>
              <button
                type="button"
                className="remember-me-auth-btn remember-me-auth-email"
                onClick={() => handleRememberMeChoice('email')}
              >
                Sign up / Log in with Email
              </button>
            </div>
            {rememberMeMethod && (
              <p className="remember-me-status">
                Current method: {rememberMeMethod === 'google' ? 'Google' : 'Email'}
              </p>
            )}
          </div>
        </div>
      )}

      {isFeedbackModalOpen && (
        <div
          className="feedback-modal-overlay"
          role="presentation"
          onClick={closeFeedbackModal}
        >
          <div
            className="feedback-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Recommendation feedback"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="feedback-modal-close"
              aria-label="Close feedback"
              onClick={closeFeedbackModal}
            >
              &times;
            </button>
            <p className="feedback-resource-name">{feedbackResourceName}</p>
            <p className="feedback-question">Was this a useful recommendation?</p>
            <div className="feedback-options">
              {['Yes', 'No', 'Not sure'].map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`feedback-option-btn ${feedbackAnswers.useful === option ? 'is-selected' : ''}`}
                  onClick={() => handleUsefulFeedbackSelection(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            {feedbackAnswers.useful && (
              <>
                <p className="feedback-question">Did you book a session?</p>
                <div className="feedback-options">
                  {['Yes', 'No'].map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`feedback-option-btn ${feedbackAnswers.booked === option ? 'is-selected' : ''}`}
                      onClick={() => handleBookedFeedbackSelection(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {isTourActive && currentTourStep && (
        <>
          <div className="tour-overlay" role="presentation" />
          <div
            className={`tour-popover tour-popover-${currentTourStep.target}`}
            role="dialog"
            aria-modal="true"
            aria-label="Guided tour"
          >
            <p className="tour-step-index">
              Step {tourStepIndex + 1} of {TOUR_STEPS.length}
            </p>
            <h3>{currentTourStep.title}</h3>
            <p>{currentTourStep.description}</p>
            <div className="tour-actions">
              <button
                type="button"
                className="tour-btn tour-btn-ghost"
                onClick={handleTourBack}
                disabled={tourStepIndex === 0}
              >
                Back
              </button>
              <button
                type="button"
                className="tour-btn tour-btn-primary"
                onClick={handleTourNext}
              >
                {tourStepIndex === TOUR_STEPS.length - 1 ? 'Done' : 'Next'}
              </button>
            </div>
            <button
              type="button"
              className="tour-close"
              aria-label="Close tour"
              onClick={closeTour}
            >
              &times;
            </button>
          </div>
        </>
      )}

      {isSupportModalOpen && (
        <div
          className="support-modal-overlay"
          role="presentation"
          onClick={() => setIsSupportModalOpen(false)}
        >
          <div
            className="support-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="support-modal-glow support-modal-glow-a" />
            <div className="support-modal-glow support-modal-glow-b" />
            <button
              type="button"
              className="support-modal-close"
              aria-label="Close support note"
              onClick={() => setIsSupportModalOpen(false)}
            >
              &times;
            </button>
            <p className="support-modal-kicker">Confidential + caring guidance</p>
            <h2 id="support-modal-title">You are not alone.</h2>
            <p>
              If you're reaching out for help, know that you're not alone.
              Seeking support is a difficult but healthy decision, and you
              should be proud of taking that step.
            </p>
            <p>
              Your data will remain anonymous unless you choose to let us store
              it. While we cannot guarantee that every provider will be the
              right fit, we are here to guide you toward the most compatible
              care options available.
            </p>
            <div>

            <label className="support-tour-toggle">
              <input
                type="checkbox"
                className="support-tour-toggle-input"
                checked={isTourOptIn}
                onChange={(event) => setIsTourOptIn(event.target.checked)}
                />
              <span>Give me the tour</span>
            </label>
                </div>
            <button
              type="button"
              className="support-modal-cta"
              onClick={handleContinueToResources}
            >
              Continue to resources
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
