# Adjustable Duration Test Examples

The calendar event duration is now adjustable! Here are examples of how to use it:

## Examples of Duration Extraction

### 1. Explicit Duration
- "Meeting with John tomorrow at 3pm for 2 hours" → Duration: 120 minutes
- "30 minute call with Sarah today at 2pm" → Duration: 30 minutes
- "1.5 hour workshop on Friday at 10am" → Duration: 90 minutes

### 2. Implicit Duration (Default)
- "Meeting with John tomorrow at 3pm" → Duration: 60 minutes (default)
- "Call with client today at 4pm" → Duration: 60 minutes (default)

### 3. Mixed Formats
- "2 hour 30 minute presentation tomorrow at 9am" → Duration: 150 minutes
- "45 minute standup meeting every Monday at 9am" → Duration: 45 minutes

## How It Works

1. **AI Extraction**: The OpenAI model now extracts duration from natural language
2. **Default Fallback**: If no duration is specified, it defaults to 60 minutes
3. **User-Friendly Display**: Durations are shown in human-readable format:
   - 60 minutes → "1 hour"
   - 30 minutes → "30 minutes"
   - 120 minutes → "2 hours"
   - 90 minutes → "1 hour 30 minutes"

## Test the Functionality

1. Start the app: `npm run dev`
2. Sign in with Google
3. Try these example messages:
   - "Meeting with John tomorrow at 3pm for 2 hours"
   - "30 minute call with Sarah today at 2pm"
   - "1.5 hour workshop on Friday at 10am"
   - "Quick 15 minute chat today at 5pm"

The system will now show the duration in the confirmation message and create events with the correct duration! 