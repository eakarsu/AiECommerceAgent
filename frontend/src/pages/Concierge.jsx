import { useEffect, useState, useRef } from 'react';
import { ConciergeApi } from '../services/api';

export const Concierge = () => {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [cart, setCart] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const logRef = useRef(null);

  const loadSessions = async () => {
    try {
      const r = await ConciergeApi.list({ limit: 20 });
      setSessions(r.data || []);
    } catch {}
  };

  const openSession = async (id) => {
    try {
      const r = await ConciergeApi.getSession(id);
      setActiveSession(r);
      setMessages(r.ConciergeChatMessages || []);
      setCart(r.cart_snapshot || []);
    } catch (e) { alert(e.message); }
  };

  const newSession = async () => {
    try {
      const r = await ConciergeApi.newSession(null, []);
      await loadSessions();
      openSession(r.id);
    } catch (e) { alert(e.message); }
  };

  const send = async () => {
    if (!draft.trim() || !activeSession) return;
    const text = draft;
    setDraft('');
    setMessages((m) => [...m, { role: 'user', content: text, id: 'tmp-' + Date.now() }]);
    setSending(true);
    try {
      const r = await ConciergeApi.send(activeSession.id, text);
      setMessages((m) => [...m, r.assistant_message]);
      setCart(r.cart || []);
    } catch (e) { alert(e.message); } finally { setSending(false); }
  };

  useEffect(() => { loadSessions(); }, []);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [messages]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Conversational Shopping Concierge</h1>
        <button className="btn btn-primary" onClick={newSession}>New Session</button>
      </div>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-3 card p-4">
          <h2 className="font-semibold mb-2">Sessions</h2>
          <ul className="space-y-1">
            {sessions.map((s) => (
              <li key={s.id}>
                <button className={`text-sm w-full text-left p-2 rounded hover:bg-gray-100 ${activeSession?.id === s.id ? 'bg-blue-100' : ''}`} onClick={() => openSession(s.id)}>
                  Session #{s.id} <span className="text-xs text-gray-500">({s.status})</span>
                </button>
              </li>
            ))}
            {sessions.length === 0 && <li className="text-sm text-gray-500">None yet</li>}
          </ul>
        </div>

        <div className="col-span-6 card p-4 flex flex-col" style={{ minHeight: 500 }}>
          {!activeSession ? <p className="text-gray-500 m-auto">Pick a session or start a new one</p> : (
            <>
              <div className="flex-1 overflow-auto space-y-2 mb-3" ref={logRef}>
                {messages.map((m, i) => (
                  <div key={m.id || i} className={`p-2 rounded ${m.role === 'user' ? 'bg-blue-50 ml-auto max-w-[80%]' : 'bg-gray-100 mr-auto max-w-[80%]'}`}>
                    <div className="text-xs text-gray-500 mb-1">{m.role}</div>
                    <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                    {m.tool_calls?.length > 0 && (
                      <div className="text-xs text-purple-600 mt-1">Tool calls: {m.tool_calls.map((t) => t.name).join(', ')}</div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input className="input flex-1" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Type a message... (try: 'add the desk lamp to my cart')" />
                <button className="btn btn-primary" onClick={send} disabled={sending}>{sending ? '...' : 'Send'}</button>
              </div>
            </>
          )}
        </div>

        <div className="col-span-3 card p-4">
          <h2 className="font-semibold mb-2">Cart</h2>
          {cart.length === 0 ? <p className="text-sm text-gray-500">Empty</p> : (
            <ul className="space-y-2">
              {cart.map((it, i) => (
                <li key={i} className="text-sm border-b pb-1">
                  <div className="font-medium">{it.name}</div>
                  <div className="text-xs">qty {it.qty} • ${it.price}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default Concierge;
