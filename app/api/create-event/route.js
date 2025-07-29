import { getServerSession } from "next-auth";
import { authOptions } from "../auth/authOptions";
import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function isListIntent(message) {
  const lower = message.toLowerCase();
  
  // Check for explicit list/show commands first
  const listCommands = [
    "list", "show", "upcoming", "events", "meetings", 
    "what", "when", "schedule", "calendar"
  ];
  
  // If it contains a list command, it's likely a list intent
  if (listCommands.some(cmd => lower.includes(cmd))) {
    return true;
  }
  
  // Check for specific patterns that indicate listing
  const listPatterns = [
    /list\s+(soccer|football|basketball|tennis|workout|gym|practice|game)/i,
    /show\s+(soccer|football|basketball|tennis|workout|gym|practice|game)/i,
    /upcoming\s+(soccer|football|basketball|tennis|workout|gym|practice|game)/i,
    /my\s+(soccer|football|basketball|tennis|workout|gym|practice|game)/i,
    /what\s+(soccer|football|basketball|tennis|workout|gym|practice|game)/i
  ];
  
  if (listPatterns.some(pattern => pattern.test(message))) {
    return true;
  }
  
  // If the message contains time/date information, it's likely a creation intent, not a list intent
  const timeDatePatterns = [
    /\d{1,2}:\d{2}\s*(am|pm)/i,
    /\d{1,2}\s*(am|pm)/i,
    /(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    /\d{1,2}\/\d{1,2}/,
    /\d{4}-\d{2}-\d{2}/
  ];
  
  if (timeDatePatterns.some(pattern => pattern.test(message))) {
    return false;
  }
  
  // If it's just a single word like "soccer" without context, it might be a list intent
  const words = message.trim().split(/\s+/);
  if (words.length <= 2 && (lower.includes("soccer") || lower.includes("football") || lower.includes("basketball") || lower.includes("tennis") || lower.includes("workout") || lower.includes("gym") || lower.includes("practice") || lower.includes("game"))) {
    return true;
  }
  
  return false;
}

function isCancelIntent(message) {
  const lower = message.toLowerCase();
  return lower.includes("cancel") || lower.includes("delete") || lower.includes("remove") || lower.includes("delete event") || lower.includes("cancel event");
}

function mergeContext(eventData, context) {
  if (!context) return eventData;
  return {
    title: eventData.title || context.title || null,
    date: eventData.date || context.date || null,
    time: eventData.time || context.time || null,
    duration: eventData.duration || context.duration || 60, // Default to 60 minutes
    recurrence: eventData.recurrence || context.recurrence || null,
  };
}

function isConfirmation(message) {
  const lower = message.toLowerCase();
  return (
    lower === "yes" || lower === "confirm" || lower === "ok" || lower === "create" || lower === "sure" || lower === "y"
  );
}

function isNegativeResponse(message) {
  const lower = message.toLowerCase();
  return (
    lower === "no" || lower === "cancel" || lower === "abort" || lower === "nope" || lower === "nah" || lower === "n"
  );
}

function getNextDayOfWeek(dayName) {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDay = days.indexOf(dayName.toLowerCase());
  if (targetDay === -1) return null;
  
  const today = new Date();
  const currentDay = today.getDay();
  let daysToAdd = targetDay - currentDay;
  
  // If the target day is today or has already passed this week, get next week's occurrence
  if (daysToAdd <= 0) {
    daysToAdd += 7;
  }
  
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysToAdd);
  return targetDate.toISOString().split('T')[0];
}

function formatEventTime(dateTime) {
  const date = new Date(dateTime);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const eventDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  let dateStr;
  if (eventDate.getTime() === today.getTime()) {
    dateStr = "Today";
  } else if (eventDate.getTime() === tomorrow.getTime()) {
    dateStr = "Tomorrow";
  } else {
    dateStr = date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  }
  
  const timeStr = date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  
  return `${dateStr} at ${timeStr}`;
}

function formatEventDuration(start, end) {
  if (!start.dateTime || !end.dateTime) return "";
  
  const startTime = new Date(start.dateTime);
  const endTime = new Date(end.dateTime);
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationMinutes = Math.floor(durationMs / (1000 * 60));
  
  if (durationMinutes === 60) return " (1 hour)";
  if (durationMinutes < 60) return ` (${durationMinutes} min)`;
  
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  
  if (minutes === 0) return ` (${hours} hour${hours > 1 ? 's' : ''})`;
  return ` (${hours}h ${minutes}m)`;
}

export async function POST(req) {
  // Debug environment variables
  console.log("Environment check:", {
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    hasNextAuthUrl: !!process.env.NEXTAUTH_URL
  });

  const session = await getServerSession(authOptions);
  if (!session || !session.accessToken) {
    console.log("Session check failed:", { hasSession: !!session, hasAccessToken: !!(session?.accessToken) });
    return Response.json({ reply: "You must be signed in to use this feature." }, { status: 401 });
  }

  const { message, context, cancelContext, deleteAllContext } = await req.json();

  // 1. Handle delete all confirmation
  if (deleteAllContext && isConfirmation(message)) {
    console.log(`Attempting to delete ${deleteAllContext.events.length} events`);
    
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    
    for (const event of deleteAllContext.events) {
      try {
        const delRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.eventId}`,
          {
            method: "DELETE",
            headers: { 
              Authorization: `Bearer ${session.accessToken}`,
              "Content-Type": "application/json"
            },
          }
        );
        
        if (delRes.status === 204) {
          successCount++;
          results.push(`✅ **${event.summary}** - Deleted successfully`);
        } else {
          failureCount++;
          results.push(`❌ **${event.summary}** - Failed to delete (Status: ${delRes.status})`);
        }
      } catch (error) {
        failureCount++;
        results.push(`❌ **${event.summary}** - Error: ${error.message}`);
      }
    }
    
    const summary = `🗑️ **Bulk Delete Results**\n\n${results.join('\n')}\n\n📊 **Summary**: ${successCount} deleted, ${failureCount} failed`;
    return Response.json({ 
      reply: summary,
      clearContext: true
    });
  }
  
  // 2. Cancel event intent
  if (isCancelIntent(message) || cancelContext) {
    // If cancelContext and confirmation, delete the event
    if (cancelContext && isConfirmation(message)) {
      // Delete the event
      const eventId = cancelContext.eventId;
      console.log(`Attempting to delete event: ${eventId}`);
      
      try {
        const delRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
          {
            method: "DELETE",
            headers: { 
              Authorization: `Bearer ${session.accessToken}`,
              "Content-Type": "application/json"
            },
          }
        );
        
        console.log(`Delete response status: ${delRes.status}`);
        
        if (delRes.status === 204) {
          return Response.json({ 
            reply: `✅ Event **"${cancelContext.summary}"** has been successfully cancelled.`,
            clearContext: true
          });
        } else {
          const errorText = await delRes.text();
          console.error(`Delete failed with status ${delRes.status}:`, errorText);
          return Response.json({ 
            reply: `❌ Failed to cancel the event (Status: ${delRes.status}). Please try again or check your permissions.`,
            clearContext: true
          });
        }
          } catch (error) {
      console.error("Error deleting event:", error);
      return Response.json({ 
        reply: "❌ An error occurred while trying to cancel the event. Please try again.",
        clearContext: true
      });
    }
    }
    // If cancelContext and user says no/negative response, abort cancellation
    if (cancelContext && (message.toLowerCase() === "no" || message.toLowerCase() === "cancel" || message.toLowerCase() === "abort")) {
      return Response.json({ 
        reply: "❌ Event cancellation aborted.",
        clearContext: true
      });
    }
    // If cancelContext exists but not handled above, continue with cancellation flow
    if (cancelContext) {
      return Response.json({ reply: "Please reply with 'yes' to confirm cancellation or 'no' to abort." });
    }
    // Otherwise, search for matching events
    const now = new Date().toISOString();
    console.log("Fetching events for cancellation...");
    
    let matches = [];
    let eventsData = null;
    
    try {
      const eventsRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=50&orderBy=startTime&singleEvents=true&timeMin=${now}`,
        {
          headers: { Authorization: `Bearer ${session.accessToken}` },
        }
      );
      
      if (!eventsRes.ok) {
        console.error(`Failed to fetch events: ${eventsRes.status}`);
        return Response.json({ reply: "❌ Failed to fetch your events. Please try again." });
      }
      
      eventsData = await eventsRes.json();
      console.log(`Found ${eventsData.items?.length || 0} events`);
      
      if (!eventsData.items || eventsData.items.length === 0) {
        return Response.json({ reply: "📅 You have no upcoming events to cancel." });
      }
      
      // Try to find matches by title and event type
      const lowerMsg = message.toLowerCase();
      
      // First, try to find exact title matches
      const exactMatches = eventsData.items.filter(e =>
        e.summary && lowerMsg.includes(e.summary.toLowerCase())
      );
      
      // Define event type keywords
      const eventTypeKeywords = {
        'soccer': ['soccer', 'football', 'futbol', 'match', 'game', 'practice', 'training'],
        'basketball': ['basketball', 'bball', 'hoops', 'game', 'practice', 'training'],
        'tennis': ['tennis', 'match', 'game', 'practice', 'training'],
        'workout': ['workout', 'gym', 'exercise', 'training', 'fitness', 'cardio'],
        'meeting': ['meeting', 'call', 'conference', 'discussion', 'sync'],
        'coding': ['coding', 'programming', 'development', 'code', 'hackathon', 'project']
      };
      
      // Check for "delete all" commands first
      const isDeleteAllCommand = lowerMsg.includes('delete all') || lowerMsg.includes('cancel all') || lowerMsg.includes('remove all');
      
      if (isDeleteAllCommand) {
        // For "delete all" commands, prioritize event type filtering over exact matches
        for (const [eventType, keywords] of Object.entries(eventTypeKeywords)) {
          if (keywords.some(keyword => lowerMsg.includes(keyword))) {
            matches = eventsData.items.filter(e =>
              e.summary && keywords.some(keyword => 
                e.summary.toLowerCase().includes(keyword)
              )
            );
            console.log(`Found ${matches.length} ${eventType} events for bulk deletion`);
            break;
          }
        }
        
        // If no event type found, use exact matches
        if (matches.length === 0) {
          matches = exactMatches;
        }
      } else {
        // For regular deletion, use exact matches first, then event type filtering
        matches = exactMatches;
        
        if (matches.length === 0) {
          for (const [eventType, keywords] of Object.entries(eventTypeKeywords)) {
            if (keywords.some(keyword => lowerMsg.includes(keyword))) {
              matches = eventsData.items.filter(e =>
                e.summary && keywords.some(keyword => 
                  e.summary.toLowerCase().includes(keyword)
                )
              );
              break;
            }
          }
        }
      }
      
      if (isDeleteAllCommand && matches.length > 0) {
        const eventCount = matches.length;
        const eventList = matches.map((e, i) => {
          const timeStr = e.start.dateTime ? formatEventTime(e.start.dateTime) : e.start.date;
          const durationStr = formatEventDuration(e.start, e.end);
          const recurring = e.recurrenceRule ? " 🔄" : "";
          return `${i + 1}. **${e.summary}**\n    📅 ${timeStr}${durationStr}${recurring}`;
        }).join('\n\n');
        
        return Response.json({
          reply: `🗑️ **Delete All Confirmation**\n\nYou want to delete ${eventCount} event(s):\n\n${eventList}\n\n⚠️ This action cannot be undone!\n\nReply with 'yes' to delete all or 'no' to cancel.`,
          deleteAllContext: { 
            events: matches.map(e => ({ eventId: e.id, summary: e.summary, isRecurring: !!e.recurrenceRule })),
            eventType: 'soccer' // or whatever type was detected
          }
        });
      }
      
    } catch (error) {
      console.error("Error fetching events:", error);
      return Response.json({ reply: "❌ An error occurred while fetching your events. Please try again." });
    }
    
    if (matches.length === 1) {
      // Ask for confirmation to delete
      const event = matches[0];
      const timeStr = event.start.dateTime ? formatEventTime(event.start.dateTime) : event.start.date;
      const durationStr = formatEventDuration(event.start, event.end);
      const recurring = event.recurrenceRule ? " 🔄" : "";
      
      const recurringNote = event.recurrenceRule ? "\n⚠️ This is a recurring event. Deleting it will remove ALL future occurrences." : "";
      
      return Response.json({
        reply: `🗑️ Do you want to cancel this event?\n\n**${event.summary}**\n📅 ${timeStr}${durationStr}${recurring}${recurringNote}\n\nReply with 'yes' to confirm or 'no' to cancel.` ,
        cancelContext: { 
          eventId: event.id, 
          summary: event.summary,
          isRecurring: !!event.recurrenceRule
        },
      });
    } else if (matches.length > 1) {
      // List matches and ask which one
      const formattedMatches = matches.map((e, i) => {
        const timeStr = e.start.dateTime ? formatEventTime(e.start.dateTime) : e.start.date;
        const durationStr = formatEventDuration(e.start, e.end);
        const recurring = e.recurrenceRule ? " 🔄" : "";
        const recurringNote = e.recurrenceRule ? " (recurring)" : "";
        
        return `${i + 1}. **${e.summary}**${recurringNote}\n    📅 ${timeStr}${durationStr}${recurring}`;
      });
      
      return Response.json({
        reply: `🔍 I found multiple events matching your request:\n\n${formattedMatches.join("\n\n")}\n\nPlease reply with the number of the event you want to cancel.` ,
        cancelList: matches.map((e, i) => ({ eventId: e.id, summary: e.summary, index: i + 1 })),
      });
    } else {
      // No direct matches, list all and ask
      const formattedEvents = eventsData.items.map((e, i) => {
        const timeStr = e.start.dateTime ? formatEventTime(e.start.dateTime) : e.start.date;
        const durationStr = formatEventDuration(e.start, e.end);
        const recurring = e.recurrenceRule ? " 🔄" : "";
        
        return `${i + 1}. **${e.summary}**\n    📅 ${timeStr}${durationStr}${recurring}`;
      });
      
      return Response.json({
        reply: `🔍 I couldn't find an exact match. Here are your upcoming events:\n\n${formattedEvents.join("\n\n")}\n\nPlease reply with the number of the event you want to cancel.` ,
        cancelList: eventsData.items.map((e, i) => ({ eventId: e.id, summary: e.summary, index: i + 1 })),
      });
    }
  }

  // 2. List events intent
  if (isListIntent(message)) {
    // List events with filtering
    const nowForList = new Date().toISOString();
    const lowerMsg = message.toLowerCase();
    
    try {
      const eventsRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=20&orderBy=startTime&singleEvents=true&timeMin=${nowForList}`,
        {
          headers: { Authorization: `Bearer ${session.accessToken}` },
        }
      );
      
      if (!eventsRes.ok) {
        return Response.json({ reply: "❌ Failed to fetch your events. Please try again." });
      }
      
      const eventsData = await eventsRes.json();
      if (!eventsData.items || eventsData.items.length === 0) {
        return Response.json({ reply: "📅 You have no upcoming events." });
      }
      
      // Filter events by type if specified
      let filteredEvents = eventsData.items;
      const eventTypeKeywords = {
        'soccer': ['soccer', 'football', 'futbol', 'match', 'game', 'practice', 'training'],
        'basketball': ['basketball', 'bball', 'hoops', 'game', 'practice', 'training'],
        'tennis': ['tennis', 'match', 'game', 'practice', 'training'],
        'workout': ['workout', 'gym', 'exercise', 'training', 'fitness', 'cardio'],
        'meeting': ['meeting', 'call', 'conference', 'discussion', 'sync'],
        'coding': ['coding', 'programming', 'development', 'code', 'hackathon', 'project']
      };
      
      // Check if user is asking for specific event type
      for (const [eventType, keywords] of Object.entries(eventTypeKeywords)) {
        if (keywords.some(keyword => lowerMsg.includes(keyword))) {
          console.log(`Filtering for ${eventType} events with keywords:`, keywords);
          filteredEvents = eventsData.items.filter(e =>
            e.summary && keywords.some(keyword => 
              e.summary.toLowerCase().includes(keyword)
            )
          );
          console.log(`Found ${filteredEvents.length} ${eventType} events out of ${eventsData.items.length} total events`);
          break;
        }
      }
      
      if (filteredEvents.length === 0) {
        const eventType = Object.keys(eventTypeKeywords).find(type => 
          eventTypeKeywords[type].some(keyword => lowerMsg.includes(keyword))
        );
        return Response.json({ reply: `📅 You have no upcoming ${eventType || 'events'} scheduled.` });
      }
      
      const formattedEvents = filteredEvents.map((e, index) => {
      const title = e.summary || "(No title)";
      const timeStr = e.start.dateTime ? formatEventTime(e.start.dateTime) : e.start.date;
      const durationStr = formatEventDuration(e.start, e.end);
      const recurring = e.recurrenceRule ? " 🔄" : "";
      
      return `${index + 1}. **${title}**\n    📅 ${timeStr}${durationStr}${recurring}`;
    });
    
    const reply = `📅 **Your Upcoming Events**\n\n${formattedEvents.join("\n\n")}`;
    return Response.json({ reply });
    } catch (error) {
      console.error("Error listing events:", error);
      return Response.json({ reply: "❌ An error occurred while fetching your events. Please try again." });
    }
  }

  // 3. Event creation intent (with OpenAI extraction)
  const nowForCreation = new Date();
  const todayStr = nowForCreation.toISOString().split("T")[0];

  const systemPrompt = `
You are an assistant that extracts event details for calendar scheduling.

Today's date is ${todayStr}.

IMPORTANT: Always create only ONE event unless the user explicitly asks for multiple events or specifies a recurring pattern.

If the user says "today", "tomorrow", or another relative date, convert it to an absolute date in YYYY-MM-DD format.

For day names (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday):
- If the user mentions a specific day name (e.g., "soccer practice on Saturday"), calculate the next occurrence of that day from today's date.
- For example, if today is Monday and user says "Saturday", set the date to the upcoming Saturday.
- If today is Saturday and user says "Saturday", set the date to today.
- Always return the date in YYYY-MM-DD format.
- Use the following logic: find the next occurrence of the specified day from today's date.
- IMPORTANT: A single day name (like "Tuesday") should create a ONE-TIME event, not a recurring event. Only create recurring events if the user explicitly says "every Tuesday" or "weekly" or similar recurring language.

For recurring events (e.g., "every Tuesday and Thursday", "every Monday", "weekly meetings"):
- If the user specifies a recurring pattern but doesn't mention a start date, automatically set the start date to the next occurrence of that pattern.
- For "every Tuesday and Thursday", set the date to the next Tuesday or Thursday (whichever comes first).
- For "every Monday", set the date to the next Monday.
- Extract the recurrence pattern and return an RRULE string.
- DO NOT ask for a start date if the recurring pattern is clear.
- Recurring events create a single event with a recurrence rule, not multiple separate events.
- Use correct Google Calendar RRULE format:
  - "every Tuesday" → "FREQ=WEEKLY;BYDAY=TU"
  - "every Monday" → "FREQ=WEEKLY;BYDAY=MO"
  - "every Wednesday" → "FREQ=WEEKLY;BYDAY=WE"
  - "every Thursday" → "FREQ=WEEKLY;BYDAY=TH"
  - "every Friday" → "FREQ=WEEKLY;BYDAY=FR"
  - "every Saturday" → "FREQ=WEEKLY;BYDAY=SA"
  - "every Sunday" → "FREQ=WEEKLY;BYDAY=SU"

For duration, extract the event duration in minutes. 
- If the user says "2 hour meeting" or "2 hrs", duration should be 120. 
- If they say "30 minute call" or "30 min", duration should be 30. 
- If the user specifies a time range like "9 - 11 am" or "from 2pm to 4pm", calculate the duration in minutes between the start and end times.
- If no duration is specified, use 60 minutes as default.
- Common abbreviations: "hr" = hour, "hrs" = hours, "min" = minutes

For time format, always return time in 24-hour format (HH:MM):
- "9 am" should be "09:00"
- "2:30 pm" should be "14:30"
- "3:30 pm" should be "15:30"
- "11 pm" should be "23:00"
- Always convert PM times by adding 12 to the hour (except for 12 PM which stays 12)
- Always convert AM times by keeping the hour as is (except for 12 AM which becomes 00)

If the user mentions multiple events in one message (e.g., "meeting at 2pm and dinner at 7pm"), extract only the FIRST event mentioned unless they explicitly ask for multiple events.

If you cannot find a required field (title, time, etc.), respond with a JSON object with a "missing" array listing what is missing, and a "questions" array with a follow-up question for each missing field.

Always respond ONLY with a valid JSON object in this format:
{ "title": "...", "date": "YYYY-MM-DD or null", "time": "HH:MM or null", "duration": number (minutes), "recurrence": "RRULE or null", "missing": ["field1", ...], "questions": ["question for field1", ...] }

Examples:
- "soccer practice on monday from 9 - 11 am" → { "title": "soccer practice", "date": "2025-01-27", "time": "09:00", "duration": 120, "recurrence": null }
- "soccer practice on saturday at 3:30 pm for 2 hours" → { "title": "soccer practice", "date": "2025-01-25", "time": "15:30", "duration": 120, "recurrence": null }
- "soccer practice on Saturday for 2 hrs at 3:30 PM" → { "title": "soccer practice", "date": "2025-07-26", "time": "15:30", "duration": 120, "recurrence": null }
- "coding on Tuesday at 10:00 AM" → { "title": "coding", "date": "2025-07-29", "time": "10:00", "duration": 60, "recurrence": null }
- "every Tuesday coding session at 10:00 AM" → { "title": "coding session", "date": "2025-07-29", "time": "10:00", "duration": 60, "recurrence": "FREQ=WEEKLY;BYDAY=TU" }
- "meeting tomorrow at 3pm" → { "title": "meeting", "date": "2025-01-24", "time": "15:00", "duration": 60, "recurrence": null }
`;

  let userPrompt = `Message: "${message}"`;
  if (context) {
    userPrompt += `\nPartial info: ${JSON.stringify(context)}`;
  }

  // 4. If the user is confirming or rejecting, handle the response
  if (context && (isConfirmation(message) || isNegativeResponse(message))) {
    if (isNegativeResponse(message)) {
      return Response.json({ reply: "❌ Meeting request cancelled." });
    }
    const merged = context;
    // Validate date/time
    if (
      !merged.date ||
      !merged.time ||
      merged.date === "null" ||
      merged.time === "null" ||
      isNaN(new Date(`${merged.date}T${merged.time}:00`).getTime())
    ) {
      return Response.json({
        reply: "I couldn't find a valid date or time in your request. Please specify the event with a clear date and time, e.g., 'Meeting with John tomorrow at 3pm'."
      });
    }
    // Create dates with proper timezone handling
    const timeZone = 'America/New_York';
    
    // Ensure time is in proper format (HH:MM)
    let timeStr = merged.time;
    if (!timeStr.includes(':')) {
      // If time is just a number, assume it's hours and add minutes
      timeStr = `${timeStr}:00`;
    }
    
    // Create the start date in the specified timezone
    const startDateTime = new Date(`${merged.date}T${timeStr}:00`);
    const endDateTime = new Date(startDateTime.getTime() + (merged.duration || 60) * 60 * 1000);
    
    // Validate that dates are valid
    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      console.error("Invalid date/time parsing:", { date: merged.date, time: timeStr, startDateTime, endDateTime });
      return Response.json({ 
        reply: "Invalid date or time format. Please try rephrasing your request.",
        clearContext: true
      });
    }
    
    console.log("Parsed dates:", {
      start: startDateTime.toISOString(),
      end: endDateTime.toISOString(),
      duration: merged.duration,
      originalDate: merged.date,
      originalTime: merged.time,
      timeStr: timeStr
    });
    
    // Ensure we're only creating a single event
    const eventBody = {
      summary: merged.title,
      start: { 
        dateTime: startDateTime.toISOString(),
        timeZone: timeZone
      },
      end: { 
        dateTime: endDateTime.toISOString(),
        timeZone: timeZone
      },
    };
    
    // Add recurrence rule if specified (this creates a single recurring event, not multiple events)
    if (merged.recurrence && merged.recurrence !== "null") {
      eventBody.recurrence = [merged.recurrence];
    }
    
    // Validate event body
    if (!eventBody.summary || !eventBody.start.dateTime || !eventBody.end.dateTime) {
      console.error("Invalid event body:", eventBody);
      return Response.json({ 
        reply: "Invalid event data. Please try rephrasing your request.",
        clearContext: true
      });
    }
    
    // Ensure end time is after start time
    if (new Date(eventBody.end.dateTime) <= new Date(eventBody.start.dateTime)) {
      console.error("End time must be after start time:", eventBody);
      return Response.json({ 
        reply: "End time must be after start time. Please check your event details.",
        clearContext: true
      });
    }
    console.log("Creating event with body:", JSON.stringify(eventBody, null, 2));
    console.log("Access token present:", !!session.accessToken);
    console.log("Access token length:", session.accessToken?.length);
    
    const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventBody),
    });
    
    console.log("Google API response status:", res.status);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error("GOOGLE API ERROR:", errorText);
      console.error("Event body that failed:", JSON.stringify(eventBody, null, 2));
      console.error("Request details:", {
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries())
      });
      
      // Provide more specific error messages
      let errorMessage = `Failed to create event (Status: ${res.status}). `;
      if (res.status === 400) {
        errorMessage += "This usually means there's an issue with the event data format. Please check the console for details.";
      } else if (res.status === 401) {
        errorMessage += "Authentication failed. Please sign in again.";
      } else if (res.status === 403) {
        errorMessage += "Permission denied. Please check your Google Calendar permissions.";
      }
      
      return Response.json({ 
        reply: errorMessage,
        clearContext: true
      }, { status: 500 });
    }
    const durationText = merged.duration === 60 ? "1 hour" : 
                        merged.duration < 60 ? `${merged.duration} minutes` : 
                        `${Math.floor(merged.duration / 60)} hour${Math.floor(merged.duration / 60) > 1 ? 's' : ''}${merged.duration % 60 > 0 ? ` ${merged.duration % 60} minutes` : ''}`;
    const recurring = merged.recurrence && merged.recurrence !== "null" ? " 🔄" : "";
    return Response.json({ 
      reply: `✅ Event **"${merged.title}"** has been successfully created!\n\n📅 ${startDateTime.toLocaleString()} (${durationText})${recurring}`,
      // Clear all context to prevent infinite loops
      clearContext: true
    });
  }

  // 5. Otherwise, extract event details as before
  console.log("Sending request to OpenAI with prompt:", userPrompt);
  
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
  });

  let eventData;
  try {
    eventData = JSON.parse(completion.choices[0].message.content);
    console.log("AI extracted event data:", JSON.stringify(eventData, null, 2));
  } catch (e) {
    console.error("Failed to parse AI response:", e);
    console.error("AI response was:", completion.choices[0].message.content);
    return Response.json({ reply: "Sorry, I couldn't understand your request. Please try rephrasing." });
  }

  // Merge with context/partial info if provided
  const merged = mergeContext(eventData, context);

  // 6. If missing fields, ask for them
  if (eventData.missing && eventData.missing.length > 0) {
    return Response.json({
      reply: eventData.questions && eventData.questions.length > 0
        ? eventData.questions.join(" ")
        : `I need more information: ${eventData.missing.join(", ")}. Please provide these details.`,
      missing: eventData.missing,
      questions: eventData.questions,
      partial: merged,
    });
  }

  // 7. Validate date/time
  console.log("Validating merged data:", JSON.stringify(merged, null, 2));
  
  if (
    !merged.date ||
    !merged.time ||
    merged.date === "null" ||
    merged.time === "null"
  ) {
    console.error("Missing date or time in merged data:", merged);
    return Response.json({
      reply: "I couldn't find a valid date or time in your request. Please specify the event with a clear date and time, e.g., 'Meeting with John tomorrow at 3pm'."
    });
  }
  
  // Test date/time parsing
  const testDateTime = new Date(`${merged.date}T${merged.time}:00`);
  if (isNaN(testDateTime.getTime())) {
    console.error("Invalid date/time:", `${merged.date}T${merged.time}:00`);
    return Response.json({
      reply: `I couldn't parse the date/time: ${merged.date} at ${merged.time}. Please try rephrasing your request.`
    });
  }

  // 8. Instead of creating the event, ask for confirmation
  const durationText = merged.duration === 60 ? "1 hour" : 
                      merged.duration < 60 ? `${merged.duration} minutes` : 
                      `${Math.floor(merged.duration / 60)} hour${Math.floor(merged.duration / 60) > 1 ? 's' : ''}${merged.duration % 60 > 0 ? ` ${merged.duration % 60} minutes` : ''}`;
  const recurring = merged.recurrence && merged.recurrence !== "null" ? " 🔄" : "";
  const summary = `📅 **Event Summary**\n\n**Title:** ${merged.title}\n**Date:** ${merged.date}\n**Time:** ${merged.time}\n**Duration:** ${durationText}${recurring}`;
  return Response.json({
    reply: `${summary}\n\n✅ Do you want to create this event? (yes/no)`,
    confirm: true,
    partial: merged,
  });
} 