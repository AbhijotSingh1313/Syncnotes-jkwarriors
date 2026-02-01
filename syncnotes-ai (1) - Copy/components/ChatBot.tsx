
import React, { useState, useRef, useEffect } from 'react';
import { chatWithMeeting } from '../services/geminiService';
import { Meeting, ChatMessage } from '../types';

interface ChatBotProps {
  meeting: Meeting;
}

const ChatBot: React.FC<ChatBotProps> = ({ meeting }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const context = `Meeting Title: ${meeting.title}. Agenda: ${meeting.agenda}. Summary: ${meeting.summary}. Transcript: ${meeting.transcript}. Tasks: ${JSON.stringify(meeting.tasks)}`;
      const reply = await chatWithMeeting(context, messages, input);
      setMessages(prev => [...prev, { role: 'model', text: reply || "I'm sorry, I couldn't process that." }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', text: "Error connecting to AI. Please check your API key." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white border rounded-xl flex flex-col h-[500px]">
      <div className="p-4 border-b bg-gray-50 rounded-t-xl">
        <h3 className="font-semibold text-gray-800">Meeting AI Assistant</h3>
        <p className="text-xs text-gray-500">Ask questions about this specific meeting</p>
      </div>
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-10">
            <p className="text-sm italic">"What were the key decisions?"</p>
            <p className="text-sm italic">"Who is assigned to the marketing task?"</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
              m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-2 text-sm text-gray-500 animate-pulse">
              SyncNotes is thinking...
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your question..."
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSend}
            disabled={isLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;
