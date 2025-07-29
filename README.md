# RemindMe - Conversational Calendar Assistant

RemindMe is a chat-based calendar assistant that lets you manage Google Calendar events using natural language. Simply chat with your calendar assistant to create, list, or cancel events without dealing with complex forms or interfaces.

## ✨ Features

- **Natural Language Interface**: Create events by chatting naturally
- **AI-Powered**: Uses OpenAI GPT to understand and extract event details
- **Google Calendar Integration**: Seamless sync with your Google Calendar
- **Smart Confirmation**: AI asks follow-up questions and confirms details before creating events
- **Event Management**: List and cancel events through conversation
- **Modern UI**: Beautiful chat interface with real-time responses

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Google Cloud Platform account
- OpenAI API key

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd remindme-app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key_here

# NextAuth Configuration
NEXTAUTH_SECRET=your_nextauth_secret_here
NEXTAUTH_URL=http://localhost:3000
```

### 4. Set Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google Calendar API:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Calendar API" and enable it
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client IDs"
   - Set Application Type to "Web application"
   - Add Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   - Copy the Client ID and Client Secret to your `.env.local`

### 5. Get OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy the key to your `.env.local`

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 7. Sign In and Start Chatting

1. Click "Sign in with Google"
2. Grant Calendar permissions when prompted
3. Start creating events with natural language!

## 💬 Usage Examples

### Creating Events

```
"soccer practice at 9:30 AM for 3 hrs on Monday"
"Meeting with John tomorrow at 3pm"
"Workout every Tuesday at 6am for 1 hour"
"Coding session on Friday at 2:30 PM for 2 hours"
```

### Listing Events

```
"list soccer events"
"show my meetings"
"what's on my calendar"
"upcoming events"
```

### Canceling Events

```
"cancel soccer practice"
"delete the meeting with John"
"remove my workout"
```

## 🏗️ Architecture

- **Frontend**: Next.js 15 with App Router
- **Authentication**: NextAuth.js with Google OAuth
- **AI Processing**: OpenAI GPT-3.5/4 for natural language understanding
- **Calendar API**: Google Calendar API for event management
- **Styling**: Custom CSS with modern chat interface

## 🔧 API Endpoints

- `POST /api/create-event` - Main endpoint for event creation and management
- `GET /api/auth/[...nextauth]` - NextAuth.js authentication routes
- `GET /api/test-env` - Environment variable testing
- `GET /api/test-calendar` - Google Calendar API testing

## 🛠️ Development

### Project Structure

```
remindme-app/
├── app/
│   ├── api/
│   │   ├── auth/           # NextAuth.js configuration
│   │   ├── create-event/   # Main event management API
│   │   └── test-*/         # Testing endpoints
│   ├── globals.css         # Global styles
│   ├── layout.js           # Root layout
│   └── page.js             # Main chat interface
├── public/                 # Static assets
└── package.json
```

### Key Features Implementation

1. **Natural Language Processing**: Uses OpenAI to extract event details from user messages
2. **Multi-turn Conversations**: Maintains context for follow-up questions and confirmations
3. **Event Validation**: Validates dates, times, and durations before creating events
4. **Error Handling**: Comprehensive error handling with user-friendly messages
5. **Safety Features**: Confirmation dialogs prevent accidental deletions

## 🚨 Troubleshooting

### Common Issues

**400 Error - Event Creation Failed**
- Check that all environment variables are set correctly
- Verify Google Calendar API is enabled
- Ensure you're signed in with Google
- Check server console for detailed error logs

**Authentication Issues**
- Verify OAuth redirect URI matches exactly
- Check that Google Calendar API is enabled
- Ensure proper scopes are configured

**Environment Variables Not Loading**
- Restart the development server after adding `.env.local`
- Check that variable names match exactly
- Verify no extra spaces or quotes in `.env.local`

### Debug Endpoints

- `GET /api/test-env` - Check environment variables
- `GET /api/test-calendar` - Test Google Calendar API access
- `POST /api/simple-test` - Test basic event creation

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

If you encounter any issues or have questions, please:
1. Check the troubleshooting section above
2. Look at the server console logs for detailed error information
3. Open an issue on GitHub with detailed steps to reproduce

---

**RemindMe**: Your calendar, your way, through conversation! 🗓️💬
