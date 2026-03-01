# Implementation & Architecture Guide

## 🎯 Overview

This Mental Health Resource Finder demonstrates a **privacy-first architecture** for sensitive data applications using GPT-4 as a query interpreter rather than a data processor.

## 🔐 Privacy Architecture

### Core Principle
**Separate data processing from intent parsing**

```
┌─────────────────────┐
│   User Query        │
│  (Natural Language) │
└──────────┬──────────┘
           │ (Only this)
           ▼
┌──────────────────────────┐
│   GPT-4 Intent Parser    │
│   (OpenAI Cloud)         │
│   Returns: Filter Params │
└──────────┬───────────────┘
           │ (Structured filters)
           ▼
┌──────────────────────────────┐
│  Local Filter Engine         │
│  (Client Browser)            │
│  Input: Pins + Filters       │
│  Never leaves client side    │
└──────────────────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  Filtered Results            │
│  (Stays in browser)          │
│  Mapped & Displayed          │
└──────────────────────────────┘
```

### Why This Design?

| Concern | Traditional | This Approach |
|---------|------------|---------------|
| **Data Exposure** | All data → AI | Query only → AI |
| **Privacy Control** | Lost to vendor | Retained locally |
| **Cost** | High (full data processing) | Low (intent only) |
| **Latency** | Full processing time | Intent parsing only |
| **Compliance** | HIPAA-unfriendly | HIPAA-friendly |

## 🧠 Intent Parsing Strategy

### What GPT-4 Does
- Parses natural language queries
- Extracts search intent
- Returns structured parameters
- **Never touches sensitive data**

### Example Flow

```
User: "I need an anxiety therapist near me that accepts insurance"
                    ↓
    GPT-4 Parses Intent
                    ↓
    Returns: {
      filters: {
        types: ["therapist"],
        specializations: ["anxiety"],
        acceptsInsurance: true,
        keywords: ["near", "proximity"]
      }
    }
                    ↓
    Local filtering applies these parameters
                    ↓
    7 matching therapists shown on map
```

### System Prompt Design

The system prompt in `gptIntentParser.js` teaches GPT-4 to:
1. Understand mental health terminology
2. Extract valid specializations
3. Parse filters for insurance, type, rating
4. Always return valid JSON
5. Never invent data

## 📍 Filter Logic

### How Local Filtering Works

[Open `src/utils/filterLogic.js`](src/utils/filterLogic.js)

```javascript
1. User asks: "Show therapists for anxiety"
2. Intent parsed: { types: ["therapist"], specializations: ["anxiety"] }
3. Local filter checks each pin:
   - Is Pin.type === "therapist"? 
   - Does Pin.specializations include "anxiety"?
4. Only matching pins returned
5. Map re-renders
```

### Filter Parameters

| Parameter | Type | Purpose |
|-----------|------|---------|
| `types` | Array | Resource type (therapist, clinic, etc) |
| `specializations` | Array | Mental health focus areas |
| `acceptsInsurance` | Boolean | Insurance acceptance |
| `minRating` | Number | Minimum quality rating |
| `keywords` | Array | Text search terms |

## 🗺️ Map Integration

### Leaflet Setup

[Open `src/components/MapView.jsx`](src/components/MapView.jsx)

- **Center**: Washington DC (38.9072, -77.0369)
- **Default Zoom**: 2
- **Tiles**: OpenStreetMap (free)
- **Markers**: React-Leaflet components

### Pin Data Structure

```json
{
  "id": 1,
  "name": "Therapy Center",
  "type": "therapist",
  "address": "123 K St NW",
  "lat": 38.8969,
  "lng": -77.0340,
  "phone": "202-555-0101",
  "specializations": ["anxiety", "depression"],
  "acceptsInsurance": true,
  "availability": "Mon-Fri 9am-6pm",
  "rating": 4.8
}
```

### Re-rendering on Filter

```javascript
// In App.jsx
{(filteredPins.length > 0 ? filteredPins : pins).map((pin) => (
  <Marker key={pin.id} position={[pin.lat, pin.lng]}>
    // Render popup with details
  </Marker>
))}
```

When `filteredPins` updates, only those markers render.

## 💬 Chat Interface

### Flow

1. **User Types**: Message in ChatBox
2. **OnSend**: 
   - Add message to UI
   - Call `handleUserQuery()`
3. **Processing**:
   - Parse intent with GPT-4
   - Filter pins locally
   - Generate summary
4. **Response**:
   - Add bot message to chat
   - Update filtered pins state
   - Map re-renders

### Message Structure

```javascript
{
  id: 1,
  text: "Hello!",
  sender: "user" // or "bot"
}
```

## 🔄 State Management

### App-Level State

```javascript
const [filteredPins, setFilteredPins] = useState([]);
const [isLoading, setIsLoading] = useState(false);
```

### Component Communication

```
App.jsx (parent)
├── MapView.jsx (receives: pins, filteredPins)
└── ChatBox.jsx (receives: onFilter callback, isLoading)
```

## 🛡️ Security Considerations

### Current Limitations
- API key exposed in browser
- No authentication/authorization
- No audit logging
- No rate limiting

### Production Recommendations

1. **Backend Proxy**
   ```
   Frontend → Your Server → OpenAI API
   ```
   Benefits: Hide API key, add logging, rate limit

2. **Authentication**
   - Require login
   - Track which users searched for what
   - Implement session management

3. **Audit Logging**
   - Log all queries
   - Track search patterns
   - Detect abuse

4. **Encryption**
   - HTTPS only
   - Encrypt sensitive queries
   - Use secure cookies

### Privacy Compliance

- **HIPAA** (US Healthcare): Consider BAA with OpenAI
- **GDPR** (EU): Subject to GDPR if users are EU residents
- **CCPA** (California): Comply with user rights
- **State Laws**: Various mental health privacy laws

## 🚀 Scaling Strategies

### Add More Cities

1. Create new pin datasets by city
2. Update map center dynamically
3. Add city selector to UI

```javascript
const CITIES = {
  'Washington DC': { lat: 38.9072, lng: -77.0369 },
  'New York': { lat: 40.7128, lng: -74.0060 },
  // ...
}
```

### Add User Location

```javascript
navigator.geolocation.getCurrentPosition((position) => {
  const { latitude, longitude } = position.coords;
  // Update map center & use for nearby filtering
});
```

### Add More Filters

```javascript
// Enhance filter logic to include:
- Distance radius
- Availability (open now)
- Insurance type specifics
- Languages spoken
- Cost/pricing tier
- Telehealth availability
```

### Performance Optimization

For 1000+ pins:
- Implement clustering (Leaflet.Markercluster)
- Virtualize chat messages
- Debounce filter function
- Cache filter results
- Lazy load pin details

## 📊 Data Enhancement

### Add Ratings/Reviews

```json
{
  "id": 1,
  "reviews": [
    {
      "author": "Patient",
      "rating": 5,
      "text": "Great therapist!"
    }
  ]
}
```

### Add Appointment Integration

```javascript
// Connect to scheduling system
// Show available times
// Allow direct booking
```

### Add Photo/Preview

```json
{
  "image": "url-to-photo",
  "description": "About this provider"
}
```

## 🧪 Testing Strategy

### Unit Tests
- Filter logic
- Intent parsing
- Distance calculations

### Integration Tests
- Chat → Filter → Map flow
- Error handling
- API failures

### E2E Tests
- User journeys
- Chat interactions
- Map interactions

## 📈 Analytics

### What to Track (Ethically)
- Popular searches (aggregated)
- Resource utilization (which services found most)
- Specialization demand
- Geographic hotspots

### NOT Track
- Individual user searches
- Personal mental health data
- Session details
- Patterns that identify individuals

## 🎨 UX/UI Considerations

### Current Features
- Real-time search
- Visual feedback (loading, results count)
- Mobile-responsive layout
- Accessible chat interface

### Enhancement Ideas
- Favorites/saved resources
- Print-friendly resource cards
- Share specific resources
- Dark mode
- Accessibility improvements
- Multi-language support

## 🔮 Future Enhancements

### Short Term
- [ ] Appointment booking integration
- [ ] User location-based search
- [ ] Insurance plan details
- [ ] Specialization tags filtering

### Medium Term
- [ ] User accounts & saved searches
- [ ] Community reviews & ratings
- [ ] Cost transparency
- [ ] Wait time estimates
- [ ] Telehealth availability

### Long Term
- [ ] AI-powered recommendations
- [ ] Personalized resource matching
- [ ] Integration with insurance networks
- [ ] Real-time availability sync
- [ ] Multi-city support

## 📝 Common Queries Reference

These are optimized in the system prompt:

```
Anxiety-Related
- "therapists for anxiety"
- "anxiety support groups"
- "panic attack help"

Crisis Support
- "crisis line"
- "emergency mental health"
- "suicidal thoughts help"

Specific Issues
- "PTSD therapy"
- "couples counseling"
- "addiction recovery"
- "ADHD specialists"

Insurance/Practical
- "therapists accepting insurance"
- "affordable counseling"
- "free support groups"

Location-Based
- "therapists near me"
- "wellness centers in x neighborhood"
```

## 📚 References

### Key Files
- [gptIntentParser.js](src/utils/gptIntentParser.js) - GPT-4 integration
- [filterLogic.js](src/utils/filterLogic.js) - Local filtering
- [MapView.jsx](src/components/MapView.jsx) - Map rendering
- [ChatBox.jsx](src/components/ChatBox.jsx) - Chat interface

### External Resources
- [OpenAI Cookbook](https://github.com/openai/openai-cookbook)
- [Leaflet Best Practices](https://leafletjs.com/examples.html)
- [React Best Practices](https://react.dev/learn)
- [Privacy by Design](https://www.privacybydesign.ca/)

---

**This architecture demonstrates how to build ethical, privacy-forward applications that leverage AI without compromising user data.**
