/**
 * Helper utilities for mental health resource discovery
 */

/**
 * Calculate distance between two lat/lng coordinates (Haversine formula)
 * Returns distance in kilometers
 */
export function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Sort resources by distance from a given location
 */
export function sortByDistance(pins, userLat, userLng) {
  return [...pins].sort((a, b) => {
    const distA = calculateDistance(userLat, userLng, a.lat, a.lng);
    const distB = calculateDistance(userLat, userLng, b.lat, b.lng);
    return distA - distB;
  });
}

/**
 * Group resources by type
 */
export function groupByType(pins) {
  return pins.reduce((acc, pin) => {
    if (!acc[pin.type]) {
      acc[pin.type] = [];
    }
    acc[pin.type].push(pin);
    return acc;
  }, {});
}

/**
 * Get all unique specializations across resources
 */
export function getAllSpecializations(pins) {
  const specs = new Set();
  pins.forEach(pin => {
    pin.specializations.forEach(spec => specs.add(spec));
  });
  return Array.from(specs).sort();
}

/**
 * Get statistics about resources
 */
export function getResourceStats(pins) {
  return {
    total: pins.length,
    byType: groupByType(pins),
    avgRating: (pins.reduce((sum, p) => sum + p.rating, 0) / pins.length).toFixed(1),
    acceptingInsurance: pins.filter(p => p.acceptsInsurance).length,
    specializations: new Set(pins.flatMap(p => p.specializations)).size
  };
}

/**
 * Format phone number for display
 */
export function formatPhone(phone) {
  // Handle "Text HOME to 741741" style numbers
  if (phone.toLowerCase().includes('text')) {
    return phone;
  }
  // Standard 10-digit US phone
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

/**
 * Check if resource is open now (simplified - returns true for demo)
 */
export function isOpenNow(availability) {
  // In production, parse availability string and check against current time
  return availability !== 'By appointment only';
}

/**
 * Get rating display (star count)
 */
export function getRatingStars(rating) {
  return '⭐'.repeat(Math.floor(rating));
}
