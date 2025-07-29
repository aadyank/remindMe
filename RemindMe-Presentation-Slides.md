# RemindMe Project Presentation

---

## 1. Title Slide
**RemindMe**  
Team Name: [Your Team]  
Team Members: [Names]  
Event: [Hackathon Name]  
Date: [Date]

---

## 2. Problem Statement
- Managing calendar events is tedious and error-prone, especially when using traditional forms or interfaces.
- Many users want a more natural, conversational way to schedule, list, and manage events.
- Existing solutions lack true conversational intelligence and seamless integration with Google Calendar.

---

## 3. Solution Overview
**RemindMe** is a chat-based calendar assistant that lets users manage Google Calendar events using natural language.
- Sign in with Google
- Chat to create, list, or cancel events
- AI-powered follow-up questions for missing info
- Confirmation before event creation

---

## 4. Demo Flow
1. **User signs in with Google**
2. **User chats to create, list, or cancel events**
3. **Bot asks follow-up questions if needed**
4. **Bot summarizes and asks for confirmation before creating an event**
5. **Event is added to Google Calendar**
6. **User can list or cancel events via chat**

---

## 5. Architecture
- **Frontend:** Next.js (React, App Router)
- **Authentication:** NextAuth.js with Google OAuth
- **AI:** OpenAI GPT-3.5/4 for natural language understanding
- **Calendar:** Google Calendar API for event management
- **UI:** Modern chat interface with multi-turn conversation

---

## 6. Key Features
- Conversational event creation (with follow-up Q&A)
- Event listing
- Event cancellation (with selection and confirmation)
- Google sign-in and calendar sync
- Modern, user-friendly chat interface

---

## 7. Screenshots / Demo
- [Insert screenshot: Google sign-in]
- [Insert screenshot: Chat interface]
- [Insert screenshot: Event creation flow]
- [Insert screenshot: Event listing]
- [Insert screenshot: Event cancellation]

---

## 8. Technical Challenges & Solutions
- **Ambiguous user input:** Used OpenAI to extract and clarify event details
- **Multi-turn conversation:** Maintained context for follow-up questions and confirmations
- **API integration:** Combined NextAuth, Google Calendar API, and OpenAI in a seamless flow

---

## 9. Future Work
- Event editing (conversational flow)
- More advanced context and personalization
- Support for more calendar providers
- Enhanced UI/UX (avatars, event cards, etc.)

---

## 10. Q&A / Thank You
**Thank you!**  
Questions? 