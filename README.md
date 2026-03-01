# Mental Health Resource Finder

A privacy-first mental health resource discovery tool built with React, Leaflet, and GPT-4. Find mental health services across Washington DC through conversational AI while keeping sensitive client data completely local.

## 🎯 Key Features

- **Interactive Map**: 60 mental health resource pins across Washington DC
- **AI-Powered Search**: Natural language queries interpreted by GPT-4
- **Privacy-First Architecture**: Sensitive resource data never leaves your browser
  - Only user queries sent to GPT-4
  - All filtering happens locally
  - Full control over your data
- **Real-Time Filtering**: Pin results update instantly as you chat
- **Multiple Resource Types**: Therapists, psychiatrists, clinics, support groups, wellness centers, crisis resources

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- OpenAI API key (get one at [platform.openai.com](https://platform.openai.com))

### Installation

1. **Navigate to project**
```bash
cd /Users/maxbye/Sites/mental-health-ai
```

2. **Dependencies are already installed** (or run `npm install` if needed)

3. **Add your API key**
```bash
# Put this exact line in .env
VITE_OPENAI_API_KEY=your-api-key-here
```

4. **Start development server**
```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

## 💬 How to Use

1. **Open the Chat**: Type a query in the chat box on the right
2. **Ask Naturally**: Examples:
   - "Show me therapists specializing in anxiety"
   - "I need crisis support"
   - "Support groups for PTSD"
   - "Therapists with insurance" 
   - "Highly-rated wellness centers"

3. **View Results**: Matching pins appear on the map
4. **Click Pins**: View details, ratings, hours, contact info

## 🏗️ Architecture

```
User Query
    ↓
GPT-4 Intent Parsing (API - query only, no data)
    ↓
Filter Parameters Returned
    ↓
Local JavaScript Filtering (Client-Side)
    ↓
Map Updates with Results
```

### Privacy Strategy

| Data | Location | Risk |
|------|----------|------|
| User Query | Sent to OpenAI | Low (intent only, no client data) |
| Resource Pins | Browser Only | None (never leaves client) |
| Filtered Results | Browser Only | None (stays local) |
| Session History | Browser Only | None (local only) |

## 📁 Project Structure

```
src/
├── components/
│   ├── MapView.jsx           # Leaflet map component
│   ├── ChatBox.jsx           # Chat interface
│   └── ChatBox.css           # Chat styling
├── utils/
│   ├── gptIntentParser.js    # GPT-4 query handler
│   └── filterLogic.js        # Local filtering engine
├── data/
│   └── mentalHealthPins.json # 60 sample resources
├── App.jsx                   # Main app component
├── App.css                   # App styling
├── index.css                 # Global styles
└── main.jsx                  # Entry point
```

## 🔧 Configuration

### Environment Variables

Add to `.env`:
```
VITE_OPENAI_API_KEY=your-key-here
```

### Add More Resources

Edit `src/data/mentalHealthPins.json` to add or modify resources. Each pin requires:

```json
{
  "id": 1,
  "name": "Service Name",
  "type": "therapist|psychiatrist|clinic|support_group|wellness_center|crisis",
  "address": "Street Address",
  "lat": 38.9072,
  "lng": -77.0369,
  "phone": "202-555-0000",
  "specializations": ["anxiety", "depression"],
  "acceptsInsurance": true,
  "availability": "Mon-Fri 9am-5pm",
  "rating": 4.8
}
```

## 🎨 Customization

### Change Map Center
Edit `src/components/MapView.jsx`:
```javascript
const DC_CENTER = [38.9072, -77.0369]; // Change to your city
```

### Styling
- Main layout: `src/App.css`
- Chat box: `src/components/ChatBox.css`
- Global: `src/index.css`

## 🚢 Build for Production

```bash
npm run build
npm run preview
```

Outputs to `dist/` directory. Deploy to any static hosting (Vercel, Netlify, GitHub Pages, etc.)

## ⚖️ Ethical Considerations

This app was designed with mental health ethics at its core:

- **Informed Consent**: Users know only their query intent is shared, not client data
- **Data Sovereignty**: Sensitive mental health information stays fully under your control
- **Mission Integrity**: Builds trust by keeping client data private by default
- **Transparency**: Clear about what data flows where

## 🔐 Security Notes

- API key is client-side only (if deploying publicly, use a backend proxy)
- All filtering happens in-browser with no server communication
- No data persistence (session data is ephemeral)
- Consider backend wrapper for production to protect API key

## 📝 Example Queries

- "Therapists specializing in anxiety"
- "OCD specialists"
- "Support groups for grief"
- "Crisis hotline 24/7"
- "Psychiatrists accepting insurance"
- "Wellness yoga classes"
- "LGBTQ+ affirming therapists"
- "Couples counseling"

## 🤝 Extending This Project

1. Add more pins to `mentalHealthPins.json`
2. Update filter logic in `src/utils/filterLogic.js`
3. Enhance specializations in GPT prompt
4. Add location-based filtering (distance calculation)
5. Implement user location sharing (with permission)
6. Add filtering by insurance type
7. Add availability/scheduling integration

## 📜 License

MIT

## 🆘 Troubleshooting

**"API key not configured"** → Check `.env` file has `VITE_OPENAI_API_KEY` set and restart dev server

**"Map not showing"** → Check browser console for errors, ensure all dependencies installed

**"No results found"** → Try simplified queries or broaden search criteria

## Resources

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [React Documentation](https://react.dev)
- [Leaflet Documentation](https://leafletjs.com)
- [Vite Documentation](https://vitejs.dev)

---

**Built with ❤️ for mental health privacy and accessibility.**
