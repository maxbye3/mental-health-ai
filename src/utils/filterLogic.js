/**
 * Filters pins based on parsed intent filters
 * This is all done locally - the sensitive pin data never leaves the frontend
 */
export function filterPins(pins, filters) {
  if (!filters || Object.values(filters).every(v => !v || (Array.isArray(v) && v.length === 0))) {
    return [];
  }

  return pins.filter(pin => {
    // Filter by type
    if (filters.types && filters.types.length > 0) {
      if (!filters.types.includes(pin.type)) {
        return false;
      }
    }

    // Filter by specializations (match if ANY specialization matches)
    if (filters.specializations && filters.specializations.length > 0) {
      const hasMatchingSpecialization = filters.specializations.some(spec =>
        pin.specializations.some(s => s.toLowerCase().includes(spec.toLowerCase()))
      );
      if (!hasMatchingSpecialization) {
        return false;
      }
    }

    // Filter by insurance acceptance
    if (filters.acceptsInsurance !== null && filters.acceptsInsurance !== undefined) {
      if (pin.acceptsInsurance !== filters.acceptsInsurance) {
        return false;
      }
    }

    // Filter by rating
    if (filters.minRating !== null && filters.minRating !== undefined) {
      if (pin.rating < filters.minRating) {
        return false;
      }
    }

    // Filter by keywords (search in name, address, specialty descriptions)
    if (filters.keywords && filters.keywords.length > 0) {
      const searchText = `${pin.name} ${pin.address} ${pin.specializations.join(' ')}`.toLowerCase();
      const hasMatchingKeyword = filters.keywords.some(keyword =>
        searchText.includes(keyword.toLowerCase())
      );
      if (!hasMatchingKeyword) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Generate a user-friendly summary of filtering results
 */
export function generateFilterSummary(filteredPins, filters, totalPins) {
  let summary = '';

  if (filteredPins.length === 0) {
    summary = `Unfortunately, I didn't find any resources matching your criteria. Try:
    • Broadening your search (e.g., remove specific specialization)
    • Trying different keywords
    • Or browse all ${totalPins} available resources`;
  } else if (filteredPins.length === 1) {
    summary = `Found 1 resource matching your criteria: ${filteredPins[0].name}. Check the map for details!`;
  } else {
    summary = `Found ${filteredPins.length} resources matching your criteria. ${filters.specializations?.length > 0 ? `These providers specialize in ${filters.specializations.join(', ')}.` : ''} Check the map to explore them!`;
  }

  return summary;
}
