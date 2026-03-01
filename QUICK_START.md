# Quick Start Guide

## ⚡ Getting Started in 5 Minutes

### 1. Set Your API Key
```bash
# Add this line to .env
VITE_OPENAI_API_KEY=your-actual-key-here
```
Get your key from: https://platform.openai.com/api-keys

### 2. Start Dev Server
```bash
npm run dev
```
Open: **http://localhost:5173**

### 3. Try These Queries
- "Show me therapists for anxiety"
- "I need crisis help"
- "Support groups for depression"
- "PTSD specialists"
- "Therapists accepting insurance"

## 🐛 Troubleshooting

### Issue: "Cannot find module"
**Solution**: Run `npm install` again
```bash
npm install
```

### Issue: "Error processing request"
**Solution**: Check your API key
```bash
# Make sure .env has:
VITE_OPENAI_API_KEY=sk-xxxx...
```
Restart dev server after changing `.env`

### Issue: Map not showing
**Solution**: Check browser console (F12)
- Clear cache and reload (Ctrl+Shift+R)
- Check internet connection

### Issue: No results from chat
**Solution**: Try simpler queries
- Instead of: "Can you find LGBTQ+ therapists in NW DC with sliding scale?"
- Try: "LGBTQ+ therapists"
- Then refine from there

### Issue: Chat is slow
**Solution**: Normal for first query (API warming up)
- First query: 2-5 seconds
- Subsequent: 1-2 seconds
- If > 10 seconds: Check API status at https://status.openai.com

## 📝 Customization Cheat Sheet

### Add a New Mental Health Resource

Edit `src/data/mentalHealthPins.json`:

```json
{
  "id": 61,
  "name": "Your Clinic Name",
  "type": "clinic",
  "address": "123 Main St NW, Washington, DC 20001",
  "lat": 38.9012,
  "lng": -77.0373,
  "phone": "202-555-9999",
  "specializations": ["anxiety", "depression"],
  "acceptsInsurance": true,
  "availability": "Mon-Fri 9am-5pm",
  "rating": 4.5
}
```

### Change Map Center
Edit `src/components/MapView.jsx`, line 34:
```javascript
const DC_CENTER = [38.9072, -77.0369]; // Change these numbers
```

For other cities:
- NYC: [40.7128, -74.0060]
- LA: [34.0522, -118.2437]
- SF: [37.7749, -122.4194]
- Chicago: [41.8781, -87.6298]

### Change Chat Button Color
Edit `src/components/ChatBox.css`, line 118:
```css
.send-btn {
  background: #667eea; /* Change this color code */
}
```

## 🏃 Common Tasks

### Deploy to Production
```bash
npm run build
# Upload dist/ folder to hosting (Vercel, Netlify, etc)
```

### Add More Specializations
Edit `src/utils/gptIntentParser.js`, update the SYSTEM_PROMPT section listing specializations.

### Test Without API Key
You can't - GPT-4 integration requires valid API key. But you can mock it for development:

Create `src/utils/mockGptIntentParser.js`:
```javascript
export async function parseUserIntent(query) {
  // Mock responses based on query keywords
  if (query.includes('anxiety')) {
    return {
      filters: {
        types: ['therapist'],
        specializations: ['anxiety'],
        acceptsInsurance: null,
        minRating: null,
        keywords: []
      }
    };
  }
  // ... more mock cases
}
```

Then import from mock file in App.jsx.

## 💡 Pro Tips

### Make Better Queries
✅ Good:
- "anxiety therapists"
- "crisis support"
- "support groups"

❌ Avoid:
- "help me" (too vague)
- "I have problems" (not specific enough)

### Filter Multiple Ways
Ask about different combinations:
1. "Show therapists" (any therapists)
2. "ADHD specialists" (specific focus)
3. "Support groups for depression" (group setting)

### Clear Filtered View
Type: "Show all resources" or "Reset"
The app will consider it and show all 60 pins.

## 🔗 Useful Links

- [OpenAI Pricing](https://openai.com/pricing/)
- [Get API Key](https://platform.openai.com/account/api-keys)
- [Vite Docs](https://vitejs.dev/)
- [React Docs](https://react.dev)
- [Leaflet Docs](https://leafletjs.com/)

## 📞 Support

### Check These First
1. Is API key valid? (Try at https://platform.openai.com/account/billing/overview)
2. Is internet working?
3. Try a different browser
4. Clear browser cache (Ctrl+Shift+Delete)

### File Locations
- API Key: `.env` file
- Map: `src/components/MapView.jsx`
- Chat: `src/components/ChatBox.jsx`
- Data: `src/data/mentalHealthPins.json`
- Logic: `src/utils/filterLogic.js` and `src/utils/gptIntentParser.js`

---

**Questions? Check ARCHITECTURE.md for deep dives into each component.**
