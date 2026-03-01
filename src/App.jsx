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

const STUCK_PROMPT_PATTERN = /\b(stuck|out of my head|in my head|overthink|overthinking|mind racing|racing thoughts|spiral|trapped)\b/i;
const RECENT_PROMPT_PATTERN = /\b(just recently|recently|lately|past few days|few days|couple days|this week|not long)\b/i;
const NOT_READY_FOR_PHYSICAL_PATTERN = /\b(not wearing|not dressed|not appropriate|no shoes|in pajamas|in pyjamas|can't go out|cannot go out|not ready to go out)\b/i;
const DARK_THOUGHTS_PROMPT_PATTERN = /\b(dark thoughts?|something happened to me|happened to me a few years ago|trauma(?:tic)? memor(?:y|ies)|flashbacks?)\b/i;
const UNSURE_WHAT_TO_DO_PATTERN = /\b(don'?t know what to do|do not know what to do|not sure what to do|i am not sure what to do|i'm not sure what to do)\b/i;
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

  if (currentFunnel === 'dark_thoughts' && currentStep >= 1 && UNSURE_WHAT_TO_DO_PATTERN.test(normalizedQuery)) {
    return {
      reply: 'Have you heard of EMDR (Eye Movement Desensitization and Reprocessing)?',
      nextFunnel: 'dark_thoughts',
      nextStep: Math.max(2, currentStep),
      filterMode: 'emdr_severe',
      filterLimit: 12,
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
  const [isTourOptIn, setIsTourOptIn] = useState(true);
  const [isTourEnabled, setIsTourEnabled] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [userLocation, setUserLocation] = useState(DC_CENTER);
  const [locationLabel, setLocationLabel] = useState('Using approximate location');
  const [offlineConversationFunnel, setOfflineConversationFunnel] = useState('none');
  const [offlineConversationStep, setOfflineConversationStep] = useState(0);
  const [mapZoomOutLevels, setMapZoomOutLevels] = useState(0);

  const isTourActive = isTourEnabled && !isSupportModalOpen;
  const currentTourStep = isTourActive ? TOUR_STEPS[tourStepIndex] : null;
  const isCardsTourStep = currentTourStep?.target === 'cards';
  const isMapTourStep = currentTourStep?.target === 'map';
  const isChatTourStep = currentTourStep?.target === 'chat';

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsSupportModalOpen(false);
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
  }, [isSupportModalOpen]);

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
    setIsLoading(true);

    try {
      if (!isApiKeyConfigured()) {
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
              <button
                type="button"
                className="support-note-btn"
                onClick={() => {
                  setIsSupportModalOpen(true);
                  closeTour();
                }}
              >
                Support note
              </button>
            </div>
            <p className="map-info-subtitle">
              Explore local care options and refine results by your needs.
            </p>
            <p className="location-status">{locationLabel}</p>
           
            <p className="pin-count">
              {filteredPins.length > 0
                ? `${filteredPins.length} resource${filteredPins.length !== 1 ? 's' : ''} found`
                : `${mentalHealthPins.length} total resources available`}
            </p>
          </div>
          <div className={`map-canvas ${isMapTourStep ? 'tour-focus tour-focus-map' : ''}`}>
            <MapView
              pins={mentalHealthPins}
              filteredPins={filteredPins}
              userLocation={userLocation}
              nearestPins={mapFocusPins}
              zoomOutLevels={mapZoomOutLevels}
            />
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
          </div>
        </div>

        <div className={`chat-section ${isChatTourStep ? 'tour-focus tour-focus-chat' : ''}`}>
          <ChatBox onFilter={handleUserQuery} isLoading={isLoading} />
        </div>
      </div>

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
