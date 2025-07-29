import { getServerSession } from "next-auth";
import { authOptions } from "../auth/authOptions";

export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.accessToken) {
    return Response.json({ 
      error: "Not authenticated",
      hasSession: !!session,
      hasAccessToken: !!(session?.accessToken)
    });
  }

  try {
    // Test basic calendar access
    const calendarRes = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary",
      {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }
    );

    if (!calendarRes.ok) {
      const errorText = await calendarRes.text();
      return Response.json({
        error: "Calendar access failed",
        status: calendarRes.status,
        statusText: calendarRes.statusText,
        errorText: errorText
      });
    }

    const calendarData = await calendarRes.json();
    
    // Test creating a simple event
    const testEvent = {
      summary: "Test Event",
      start: {
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        timeZone: "America/New_York"
      },
      end: {
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(), // Tomorrow + 1 hour
        timeZone: "America/New_York"
      }
    };

    const createRes = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testEvent),
      }
    );

    if (!createRes.ok) {
      const errorText = await createRes.text();
      return Response.json({
        error: "Event creation failed",
        status: createRes.status,
        statusText: createRes.statusText,
        errorText: errorText,
        testEvent: testEvent
      });
    }

    const createdEvent = await createRes.json();
    
    // Clean up - delete the test event
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${createdEvent.id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }
    );

    return Response.json({
      success: true,
      message: "Calendar API is working correctly",
      calendar: calendarData,
      testEventCreated: true,
      testEventId: createdEvent.id
    });

  } catch (error) {
    return Response.json({
      error: "API test failed",
      message: error.message,
      stack: error.stack
    });
  }
} 