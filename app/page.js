'use client';

import './chat.css';
import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

const GoogleLogo = () => (
  <svg className="google-logo" viewBox="0 0 48 48">
    <g>
      <path fill="#4285F4" d="M24 9.5c3.54 0 6.04 1.53 7.43 2.81l5.48-5.48C33.64 3.99 29.28 2 24 2 14.82 2 6.98 7.98 3.67 15.44l6.91 5.36C12.13 14.09 17.56 9.5 24 9.5z"/>
      <path fill="#34A853" d="M46.1 24.55c0-1.64-.15-3.21-.43-4.73H24v9.18h12.4c-.54 2.9-2.18 5.36-4.65 7.02l7.18 5.59C43.98 37.01 46.1 31.28 46.1 24.55z"/>
      <path fill="#FBBC05" d="M10.58 28.09c-1.04-3.09-1.04-6.41 0-9.5l-6.91-5.36C1.64 17.1 0 20.36 0 24c0 3.64 1.64 6.9 3.67 10.36l6.91-5.36z"/>
      <path fill="#EA4335" d="M24 44c5.28 0 9.64-1.75 12.83-4.77l-7.18-5.59c-2.01 1.35-4.59 2.16-7.65 2.16-6.44 0-11.87-4.59-13.42-10.86l-6.91 5.36C6.98 40.02 14.82 46 24 46z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
    </g>
  </svg>
);

export default function Home() {
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState([
    { sender: "bot", text: "Hello! 👋 I'm here to help you manage your calendar events. What would you like to do today?\n\n✨ **Quick Actions:**\n• Add a new event: \"Meeting with John tomorrow at 3pm\"\n• View events: \"list soccer events\" or \"show my meetings\"\n• Delete events: \"cancel soccer practice\" or \"delete all basketball games\"\n\n🎯 **I can help with:** soccer, basketball, tennis, workouts, meetings, and any other events!\n\nJust tell me what you need! 😊" }
  ]);
  const [input, setInput] = useState("");
  const [pendingContext, setPendingContext] = useState(null);
  const [pendingQuestions, setPendingQuestions] = useState(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const [pendingCancelContext, setPendingCancelContext] = useState(null);
  const [pendingCancelList, setPendingCancelList] = useState(null);
  const [pendingDeleteAllContext, setPendingDeleteAllContext] = useState(null);

  const sendMessage = async (overrideInput) => {
    const userText = overrideInput !== undefined ? overrideInput : input;
    if (!userText.trim()) return;
    setMessages((msgs) => [...msgs, { sender: "user", text: userText }]);
    setInput("");

    let body;
    if (pendingDeleteAllContext) {
      // If waiting for delete all confirmation, send deleteAllContext
      body = { message: userText, deleteAllContext: pendingDeleteAllContext };
    } else if (pendingCancelContext) {
      // If waiting for cancel confirmation, send cancelContext
      body = { message: userText, cancelContext: pendingCancelContext };
    } else if (pendingCancelList) {
      // If waiting for event selection, map user input to event
      const idx = parseInt(userText.trim(), 10);
      const selected = pendingCancelList.find(e => e.index === idx);
      if (selected) {
        setPendingCancelList(null);
        setPendingCancelContext(selected);
        setMessages((msgs) => [...msgs, { sender: "bot", text: `Do you want to cancel this event: "${selected.summary}"? (yes/no)` }]);
        return;
      } else {
        setMessages((msgs) => [...msgs, { sender: "bot", text: "Invalid selection. Please reply with the number of the event you want to cancel." }]);
        return;
      }
    } else if (pendingConfirmation) {
      body = { message: userText, context: pendingConfirmation };
    } else if (pendingContext) {
      body = { message: userText, context: pendingContext };
    } else {
      body = { message: userText };
    }

    const res = await fetch("/api/create-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
    let data;
    try {
      data = await res.json();
    } catch (e) {
      data = { reply: "An unexpected error occurred. Please try again." };
    }
    setMessages((msgs) => [...msgs, { sender: "bot", text: data.reply }]);

    // Handle context clearing (prevents infinite loops)
    if (data.clearContext) {
      setPendingDeleteAllContext(null);
      setPendingCancelList(null);
      setPendingCancelContext(null);
      setPendingQuestions(null);
      setPendingContext(null);
      setPendingConfirmation(null);
      return;
    }

    // Handle delete all flow
    if (data.deleteAllContext) {
      setPendingDeleteAllContext(data.deleteAllContext);
      setPendingCancelList(null);
      setPendingCancelContext(null);
      setPendingQuestions(null);
      setPendingContext(null);
      setPendingConfirmation(null);
      return;
    }
    
    // Handle cancel event flow
    if (data.cancelList) {
      setPendingCancelList(data.cancelList);
      setPendingCancelContext(null);
      setPendingDeleteAllContext(null);
      setPendingQuestions(null);
      setPendingContext(null);
      setPendingConfirmation(null);
      return;
    }
    if (data.cancelContext) {
      setPendingCancelContext(data.cancelContext);
      setPendingCancelList(null);
      setPendingDeleteAllContext(null);
      setPendingQuestions(null);
      setPendingContext(null);
      setPendingConfirmation(null);
      return;
    }
    // If there are follow-up questions, set them and context
    if (data.missing && data.missing.length > 0 && data.questions && data.questions.length > 0) {
      setPendingQuestions(data.questions);
      setPendingContext(data.partial);
      setPendingConfirmation(null);
      setPendingCancelContext(null);
      setPendingCancelList(null);
    } else if (data.confirm && data.partial) {
      // If confirmation is required, set confirmation context
      setPendingConfirmation(data.partial);
      setPendingQuestions(null);
      setPendingContext(null);
      setPendingCancelContext(null);
      setPendingCancelList(null);
    } else {
      setPendingQuestions(null);
      setPendingContext(null);
      setPendingConfirmation(null);
      setPendingCancelContext(null);
      setPendingCancelList(null);
      setPendingDeleteAllContext(null);
    }
  };

  const handleInputKeyDown = (e) => {
    if (e.key === "Enter") {
      if (pendingDeleteAllContext) {
        sendMessage(input);
      } else if (pendingCancelList) {
        sendMessage(input);
      } else if (pendingCancelContext) {
        sendMessage(input);
      } else if (pendingQuestions && pendingQuestions.length > 0) {
        sendMessage(input);
      } else if (pendingConfirmation) {
        sendMessage(input);
      } else {
        sendMessage();
      }
    }
  };

  if (status === "loading") {
    return <main>Loading...</main>;
  }

  if (!session) {
    return (
      <div className="chat-container">
        <div className="chat-title">RemindMe</div>
        <p style={{textAlign: 'center', marginBottom: 24}}>Please sign in with Google to use the chat.</p>
        <button className="google-btn" onClick={() => signIn("google")}> <GoogleLogo /> Sign in with Google</button>
      </div>
    );
  }

  let placeholder = "e.g. Meeting with John tomorrow at 3pm";
  if (pendingDeleteAllContext) {
    placeholder = "Type 'yes' to delete all or 'no' to cancel";
  } else if (pendingCancelList) {
    placeholder = "Enter the number of the event to cancel";
  } else if (pendingCancelContext) {
    placeholder = "Type 'yes' to confirm or 'no' to abort";
  } else if (pendingQuestions && pendingQuestions.length > 0) {
    placeholder = pendingQuestions[0];
  } else if (pendingConfirmation) {
    placeholder = "Type 'yes' to confirm or 'no' to cancel";
  }

  return (
    <div className="chat-container">
      <div className="chat-title">RemindMe Chat</div>
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message${msg.sender === "user" ? " user" : ""}`}>
            <span className="sender">{msg.sender === "user" ? "You" : "Bot"}</span>
            <span className="bubble">{msg.text}</span>
          </div>
        ))}
      </div>
      <div className="input-row">
        <input
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder}
        />
        <button className="send-btn" onClick={() => {
          if (pendingDeleteAllContext) {
            sendMessage(input);
          } else if (pendingCancelList) {
            sendMessage(input);
          } else if (pendingCancelContext) {
            sendMessage(input);
          } else if (pendingQuestions && pendingQuestions.length > 0) {
            sendMessage(input);
          } else if (pendingConfirmation) {
            sendMessage(input);
          } else {
            sendMessage();
          }
        }}>Send</button>
      </div>
      <button className="signout-btn" onClick={() => signOut()}>Sign out</button>
    </div>
  );
}
