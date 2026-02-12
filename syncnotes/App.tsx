
import React, { useState, useEffect, useRef } from 'react';
import { UserRole, Meeting, Participant, Task, MindMapData, AccessLogEntry } from './types';
import { processMeetingAudio, generateMindMap } from './services/geminiService';
import MindMap from './components/MindMap';
import ChatBot from './components/ChatBot';

const App: React.FC = () => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [view, setView] = useState<'list' | 'create' | 'detail' | 'report'>('list');
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('syncnotes_meetings');
    const parsedMeetings: Meeting[] = saved ? JSON.parse(saved) : [];
    setMeetings(parsedMeetings);

    const params = new URLSearchParams(window.location.search);
    const meetingId = params.get('meetingId');
    
    if (meetingId) {
      const found = parsedMeetings.find(m => m.id === meetingId);
      if (found && found.status === 'published') {
        const logEntry: AccessLogEntry = { timestamp: Date.now(), viewerRole: UserRole.MEMBER };
        const updatedMeeting = { ...found, accessLogs: [...(found.accessLogs || []), logEntry] };
        const newMeetings = parsedMeetings.map(m => m.id === meetingId ? updatedMeeting : m);
        setMeetings(newMeetings);
        localStorage.setItem('syncnotes_meetings', JSON.stringify(newMeetings));
        setRole(UserRole.MEMBER);
        setActiveMeeting(updatedMeeting);
        setView('detail');
      }
    }
  }, []);

  useEffect(() => {
    if (meetings.length > 0) {
      localStorage.setItem('syncnotes_meetings', JSON.stringify(meetings));
    }
  }, [meetings]);

  const createMeeting = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newMeeting: Meeting = {
      id: Math.random().toString(36).substr(2, 9),
      title: formData.get('title') as string,
      agenda: formData.get('agenda') as string,
      date: formData.get('date') as string,
      time: formData.get('time') as string,
      participants: (formData.get('participants') as string).split(',').map(p => ({
        id: Math.random().toString(36).substr(2, 5),
        name: p.trim(),
        email: `${p.trim().toLowerCase().replace(/\s+/g, '.')}@company.com`
      })),
      transcript: '',
      summary: '',
      conclusion: '',
      strategyShifts: [],
      tasks: [],
      mindMap: null,
      status: 'draft',
      createdAt: Date.now(),
      accessLogs: []
    };
    setMeetings([newMeeting, ...meetings]);
    setActiveMeeting(newMeeting);
    setView('detail');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          if (activeMeeting) handleProcessAudio(activeMeeting.id, base64, 'audio/webm');
        };
      };
      recorder.start();
      setIsRecording(true);
    } catch (err) { alert("Microphone access is required for recording."); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mimeType = file.type || 'audio/mpeg';
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      if (activeMeeting) handleProcessAudio(activeMeeting.id, base64, mimeType);
    };
  };

  const handleProcessAudio = async (meetingId: string, base64: string, mimeType: string) => {
    setIsProcessing(true);
    setProcessStatus('Transcribing verbatim (Whisper-grade)...');
    
    try {
      const target = meetings.find(m => m.id === meetingId);
      if (!target) throw new Error("Meeting context lost.");

      const result = await processMeetingAudio(base64, mimeType, target.agenda);
      setProcessStatus('Mapping meeting intelligence...');
      const mindMap = await generateMindMap(result.summary);

      const updatedMeeting: Meeting = {
        ...target,
        transcript: result.transcript,
        summary: result.summary,
        conclusion: result.conclusion,
        strategyShifts: result.strategyShifts,
        tasks: result.tasks.map((t: any) => ({ 
          ...t, 
          id: Math.random().toString(36).substr(2, 5), 
          status: 'pending' 
        })),
        mindMap
      };

      setMeetings(prev => prev.map(m => m.id === meetingId ? updatedMeeting : m));
      setActiveMeeting(updatedMeeting);
    } catch (err) {
      console.error(err);
      alert("AI Analysis Failed: " + (err instanceof Error ? err.message : "Possible timeout or invalid file."));
    } finally {
      setIsProcessing(false);
      setProcessStatus('');
    }
  };

  const updateMeeting = (updated: Meeting) => {
    setMeetings(meetings.map(m => m.id === updated.id ? updated : m));
    setActiveMeeting(updated);
  };

  const publishMeeting = async (meetingId: string) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?meetingId=${meetingId}`;
    const updatedMeetings = meetings.map(m => m.id === meetingId ? { ...m, status: 'published' } : m);
    setMeetings(updatedMeetings);
    navigator.clipboard.writeText(shareUrl);

    const meeting = updatedMeetings.find(m => m.id === meetingId);
    alert(`Meeting Published!\n\nShareable Link copied to clipboard:\n${shareUrl}\n\nSending report to participants...`);

    try {
      const resp = await fetch('http://localhost:3003/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting, recipients: meeting?.participants?.map(p => p.email) || [], link: shareUrl })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Email service error');
      alert('Email with report sent successfully ');
    } catch (err) {
      console.error('Failed to send report:', err);
      alert('Published but failed to send email: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 border border-slate-100">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-black text-blue-600 mb-2 italic">SyncNotes</h1>
            <p className="text-slate-400 font-medium uppercase text-[10px] tracking-widest">Meeting Intelligence Platform</p>
          </div>
          <div className="space-y-4">
            <button onClick={() => setRole(UserRole.ADMIN)} className="w-full flex flex-col items-center p-6 bg-white border-2 border-slate-100 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all group">
              <span className="text-3xl mb-2"></span>
              <span className="font-bold text-slate-800">Admin Portal</span>
              <span className="text-xs text-slate-400">Manage & Process Meetings</span>
            </button>
            <button onClick={() => setRole(UserRole.MEMBER)} className="w-full flex flex-col items-center p-6 bg-white border-2 border-slate-100 rounded-2xl hover:border-green-500 hover:shadow-lg transition-all group">
              <span className="text-3xl mb-2"></span>
              <span className="font-bold text-slate-800">Member Portal</span>
              <span className="text-xs text-slate-400">View Shared Insights</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const filteredMeetings = role === UserRole.ADMIN ? meetings : meetings.filter(m => m.status === 'published');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-50 no-print shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black text-blue-600 cursor-pointer italic" onClick={() => setView('list')}>SyncNotes</h1>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${role === UserRole.ADMIN ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{role}</span>
          </div>
          <div className="flex gap-4 items-center">
            {role === UserRole.ADMIN && view === 'list' && (
              <button onClick={() => setView('create')} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 shadow-md">New Meeting</button>
            )}
            <button onClick={() => { setRole(null); setActiveMeeting(null); setView('list'); }} className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wider">Sign Out</button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
        {view === 'list' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Intelligence Dashboard</h2>
            {filteredMeetings.length === 0 ? (
              <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-slate-300">
                <span className="text-5xl block mb-4"></span>
                <p className="text-slate-500 font-medium">No meetings available yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMeetings.map(m => (
                  <div key={m.id} onClick={() => { setActiveMeeting(m); setView('detail'); }} className="bg-white border rounded-3xl p-6 hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3">
                      <span className={`text-[10px] font-black px-2 py-1 rounded-bl-xl uppercase ${m.status === 'published' ? 'bg-green-500 text-white' : 'bg-amber-400 text-white'}`}>{m.status}</span>
                    </div>
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-tighter mb-2">{m.date}</p>
                    <h3 className="text-lg font-bold text-slate-800 mb-2 truncate group-hover:text-blue-600">{m.title}</h3>
                    <p className="text-xs text-slate-400 line-clamp-2 mb-4 leading-relaxed">{m.agenda}</p>
                    <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                       <span className="text-[10px] font-bold text-slate-400">{m.tasks.length} Action Items</span>
                       <span className="text-xs font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition">View Details →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'create' && (
          <div className="max-w-2xl mx-auto bg-white rounded-3xl p-8 border shadow-sm">
            <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Setup Meeting Agenda</h2>
            <form onSubmit={createMeeting} className="space-y-5">
              <input required name="title" className="w-full border-b-2 border-slate-100 py-3 text-xl font-bold focus:outline-none focus:border-blue-500 transition-colors" placeholder="Meeting Title (e.g., SyncNotes MVP Scope)" />
              <div className="grid grid-cols-2 gap-6">
                <input required name="date" type="date" className="w-full border rounded-xl px-4 py-3 bg-slate-50" />
                <input required name="time" type="time" className="w-full border rounded-xl px-4 py-3 bg-slate-50" />
              </div>
              <textarea required name="agenda" className="w-full border rounded-xl px-4 py-3 h-32 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Objectives & Agenda"></textarea>
              <input required name="participants" className="w-full border rounded-xl px-4 py-3 bg-slate-50" placeholder="Participants (Alex, Riya, Aman)" />
              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 shadow-lg transition">Create Meeting</button>
                <button type="button" onClick={() => setView('list')} className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {view === 'detail' && activeMeeting && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
              <div className="w-full">
                <button onClick={() => setView('list')} className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-2 flex items-center gap-1">← Dashboard</button>
                <div className="flex justify-between items-center">
                   <h2 className="text-4xl font-black text-slate-900 tracking-tight">{activeMeeting.title}</h2>
                   <div className="text-right">
                     <p className="text-sm font-bold text-slate-400 uppercase">{activeMeeting.date} @ {activeMeeting.time}</p>
                   </div>
                </div>
              </div>
              <div className="flex gap-2 w-full md:w-auto no-print">
                {role === UserRole.ADMIN && activeMeeting.summary && (
                  <>
                    <button onClick={() => publishMeeting(activeMeeting.id)} className={`px-6 py-3 rounded-2xl font-bold text-sm shadow-md transition ${activeMeeting.status === 'published' ? 'bg-slate-200 text-slate-500' : 'bg-green-600 text-white hover:bg-green-700'}`}>
                      {activeMeeting.status === 'published' ? ' Published' : ' Publish Intelligence'}
                    </button>
                    <button onClick={() => setView('report')} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-md hover:bg-indigo-700"> View Report</button>
                  </>
                )}
                <button onClick={() => window.print()} className="bg-white border px-6 py-3 rounded-2xl font-bold text-sm hover:bg-slate-50 shadow-sm"> PDF</button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                {role === UserRole.ADMIN && !activeMeeting.summary && !isProcessing && (
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-10 text-center text-white shadow-xl no-print">
                    <h3 className="text-2xl font-bold mb-2">Ready to Process Audio?</h3>
                    <p className="opacity-80 mb-8 italic">"Alex: Alright, let’s get started..."</p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                      <button onClick={isRecording ? stopRecording : startRecording} className={`flex-1 px-8 py-5 rounded-2xl font-black text-lg transition shadow-2xl ${isRecording ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-white text-blue-600 hover:scale-105'}`}>
                        {isRecording ? '⏹ STOP & ANALYZE' : ' RECORD SESSION'}
                      </button>
                      <button onClick={() => fileInputRef.current?.click()} className="flex-1 px-8 py-5 rounded-2xl font-black text-lg bg-blue-500/20 border border-white/30 text-white hover:bg-blue-500/40 transition">
                         UPLOAD AUDIO
                      </button>
                      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="audio/*" className="hidden" />
                    </div>
                  </div>
                )}

                {isProcessing && (
                  <div className="bg-white border rounded-3xl p-16 text-center shadow-lg no-print">
                    <div className="relative w-20 h-20 mx-auto mb-6">
                      <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <div className="absolute inset-2 border-4 border-indigo-200 border-b-transparent rounded-full animate-spin"></div>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">{processStatus}</h3>
                    <p className="text-slate-400 mt-2 text-sm">Our AI is meticulously transcribing every word...</p>
                  </div>
                )}

                {activeMeeting.summary && (
                  <div className="space-y-8">
                    <div className="bg-white border rounded-3xl p-8 shadow-sm">
                      <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 border-b pb-4">Executive Intelligence</h3>
                      <div className="space-y-6">
                        <textarea disabled={role !== UserRole.ADMIN} value={activeMeeting.summary} onChange={(e) => updateMeeting({...activeMeeting, summary: e.target.value})} className="w-full text-slate-700 leading-relaxed min-h-[120px] bg-transparent resize-none border-none focus:ring-0 p-0 font-medium" />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {activeMeeting.strategyShifts.map((shift, i) => (
                            <div key={i} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 group hover:border-blue-200 transition">
                                <span className="text-blue-600 font-black text-[10px] block mb-1">KEY SHIFT 0{i+1}</span>
                                <p className="text-xs font-bold text-slate-800 leading-snug">{shift}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {activeMeeting.mindMap && <MindMap data={activeMeeting.mindMap} />}

                    <div className="bg-white border rounded-3xl p-8 shadow-sm">
                       <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Verbatim Transcript</h3>
                       <div className="bg-slate-50 rounded-2xl p-6 max-h-[400px] overflow-y-auto text-sm text-slate-600 leading-relaxed font-mono whitespace-pre-wrap border border-slate-100">
                          {activeMeeting.transcript || "Transcription is empty. Please upload valid audio."}
                       </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="bg-white border rounded-3xl p-6 shadow-sm">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Action Pipeline</h3>
                  <div className="space-y-3">
                    {activeMeeting.tasks.length > 0 ? activeMeeting.tasks.map(t => (
                      <div key={t.id} className="p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-blue-200 transition">
                         <div className="flex gap-3">
                           <input type="checkbox" checked={t.status === 'completed'} onChange={() => {
                             const newTasks = activeMeeting.tasks.map(task => task.id === t.id ? {...task, status: task.status === 'completed' ? 'pending' : 'completed'} : task);
                             updateMeeting({...activeMeeting, tasks: newTasks as Task[]});
                           }} className="mt-1 accent-blue-600" />
                           <div>
                             <p className={`text-sm font-bold ${t.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{t.title}</p>
                             <p className="text-[10px] font-black text-blue-500 uppercase mt-1">Responsible: {t.assignee}</p>
                           </div>
                         </div>
                      </div>
                    )) : <p className="text-center text-slate-400 text-xs py-4 italic">No tasks assigned yet.</p>}
                  </div>
                </div>

                {activeMeeting.summary && <ChatBot meeting={activeMeeting} />}
              </div>
            </div>
          </div>
        )}

        {view === 'report' && activeMeeting && (
          <div className="bg-white min-h-screen p-12 rounded-3xl shadow-2xl border max-w-4xl mx-auto report-view">
            <div className="border-b-8 border-blue-600 pb-8 mb-10 flex justify-between items-end">
               <div>
                  <h1 className="text-5xl font-black italic text-blue-600 mb-2">SyncNotes</h1>
                  <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">Intelligence Report</p>
               </div>
               <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meeting ID</p>
                  <p className="font-bold text-slate-800 uppercase">#{activeMeeting.id}</p>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
               <div className="md:col-span-2 space-y-12">
                  <section>
                    <h2 className="text-2xl font-black text-slate-900 mb-4 uppercase tracking-tighter">I. Summary</h2>
                    <p className="text-slate-700 leading-relaxed text-lg font-medium">{activeMeeting.summary}</p>
                  </section>

                  <section>
                    <h2 className="text-2xl font-black text-slate-900 mb-4 uppercase tracking-tighter">II. Strategy Shifts</h2>
                    <div className="space-y-6">
                       {activeMeeting.strategyShifts.map((s, i) => (
                         <div key={i} className="flex gap-5 items-start bg-slate-50 p-6 rounded-3xl border border-slate-100">
                            <span className="bg-blue-600 text-white font-black px-4 py-2 rounded-2xl text-lg">0{i+1}</span>
                            <p className="text-slate-800 font-bold leading-tight pt-2 text-lg">{s}</p>
                         </div>
                       ))}
                    </div>
                  </section>

                  <section>
                    <h2 className="text-2xl font-black text-slate-900 mb-4 uppercase tracking-tighter">III. Conclusion</h2>
                    <p className="text-slate-600 leading-relaxed italic text-lg border-l-8 border-slate-100 pl-6">{activeMeeting.conclusion || "Strategic alignment confirmed."}</p>
                  </section>
               </div>

               <div className="space-y-12">
                  <section>
                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 border-b pb-2">Assignees</h2>
                    <div className="space-y-4">
                       {activeMeeting.tasks.map(t => (
                         <div key={t.id} className="text-sm">
                            <p className="font-black text-slate-900">{t.title}</p>
                            <p className="text-blue-600 font-bold uppercase text-[10px]">@{t.assignee}</p>
                         </div>
                       ))}
                    </div>
                  </section>
               </div>
            </div>

            <div className="mt-24 pt-10 border-t flex justify-between items-center text-[10px] font-black text-slate-300 uppercase no-print">
               <button onClick={() => setView('detail')} className="bg-slate-100 text-slate-600 px-8 py-3 rounded-2xl hover:bg-slate-200 transition">Back to Intelligence View</button>
               <p>© SyncNotes Intelligence v6.5</p>
            </div>
          </div>
        )}
      </main>

      {isRecording && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-red-600 text-white px-10 py-6 rounded-[2rem] shadow-2xl flex items-center gap-8 animate-bounce no-print">
          <div className="flex flex-col">
            <span className="font-black text-sm tracking-[0.15em] uppercase">Recording intelligence</span>
            <span className="text-[10px] font-bold opacity-70">LIVE STREAM ACTIVE</span>
          </div>
          <button onClick={stopRecording} className="bg-white text-red-600 px-8 py-3 rounded-2xl font-black uppercase text-xs hover:scale-110 transition shadow-lg">STOP & ANALYZE</button>
        </div>
      )}
    </div>
  );
};

export default App;
