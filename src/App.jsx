import { useState } from "react";
import { uploadImage } from "./cloudinary";
import "./App.css";

const colors = ["#6c63ff", "#22c55e", "#f59e0b", "#ef4444", "#14b8a6"];

function initials(name) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function App() {
  const [convos, setConvos] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const active = convos.find((c) => c.id === activeId);

  function startChat() {
    if (!recipient.trim()) return;

    const existing = convos.find(
      (c) => c.name.toLowerCase() === recipient.trim().toLowerCase()
    );

    if (existing) {
      setActiveId(existing.id);
      setModalOpen(false);
      setRecipient("");
      setFirstMessage("");
      return;
    }

    const newConvo = {
      id: Date.now(),
      name: recipient.trim(),
      color: colors[Math.floor(Math.random() * colors.length)],
      messages: firstMessage.trim()
        ? [{ text: firstMessage.trim(), mine: true }]
        : [],
    };

    setConvos([newConvo, ...convos]);
    setActiveId(newConvo.id);
    setModalOpen(false);
    setRecipient("");
    setFirstMessage("");
  }

  function sendMessage() {
    if (!active || !message.trim()) return;

    setConvos((prev) =>
      prev.map((c) =>
        c.id === active.id
          ? {
              ...c,
              messages: [...c.messages, { text: message.trim(), mine: true }],
            }
          : c
      )
    );

    setMessage("");
  }

  async function sendImage(e) {
    const file = e.target.files[0];
    if (!file || !active) return;

    const imageUrl = await uploadImage(file);

    setConvos((prev) =>
      prev.map((c) =>
        c.id === active.id
          ? {
              ...c,
              messages: [...c.messages, { type: "image", imageUrl, mine: true }],
            }
          : c
      )
    );

    e.target.value = "";
  }

  const filtered = convos.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app">
      <nav className="rail">
        <div className="rail-logo">🔥</div>
        <button className="rail-btn active">💬</button>
        <button className="rail-btn">📞</button>
        <button className="rail-btn">👥</button>
        <button className="rail-btn">🔖</button>
        <div className="rail-spacer" />
        <button className="rail-btn">⚙️</button>
        <div className="user-avatar">P</div>
      </nav>

      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-title">Messages</span>
          <button className="icon-btn" onClick={() => setModalOpen(true)}>
            +
          </button>
        </div>

        <div className="search-wrap">
          <input
            className="search-input"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="tabs">
          <button className="tab active">All</button>
          <button className="tab">Unread</button>
          <button className="tab">Groups</button>
        </div>

        {filtered.length === 0 ? (
          <div className="sidebar-empty">
            <div className="sidebar-empty-icon">💬</div>
            <h3>No conversations yet</h3>
            <p>Start a new chat to connect with someone</p>
            <button className="new-chat-btn" onClick={() => setModalOpen(true)}>
              + New message
            </button>
          </div>
        ) : (
          <div className="convo-list">
            {filtered.map((c) => (
              <div
                key={c.id}
                className={activeId === c.id ? "convo-item active" : "convo-item"}
                onClick={() => setActiveId(c.id)}
              >
                <div
                  className="c-avatar"
                  style={{ background: `${c.color}22`, color: c.color }}
                >
                  {initials(c.name)}
                </div>
                <div className="convo-info">
                  <div className="convo-name">{c.name}</div>
                  <div className="convo-preview">
                    {c.messages.at(-1)?.mine ? "You: " : ""}
                    {c.messages.at(-1)?.text || "No messages yet"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </aside>

      <section className="chat">
        {!active ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">🔥</div>
            <h2>Welcome to Phoenix Messenger</h2>
            <p>Your messages live here. Start a conversation or search for someone to chat with.</p>
            <div className="chat-empty-actions">
              <button className="action-chip" onClick={() => setModalOpen(true)}>
                + New message
              </button>
              <button className="action-chip">Find contacts</button>
            </div>
          </div>
        ) : (
          <>
            <div className="chat-header visible">
              <div
                className="c-avatar"
                style={{ background: `${active.color}22`, color: active.color }}
              >
                {initials(active.name)}
              </div>
              <div>
                <div className="chat-user-name">{active.name}</div>
                <div className="chat-user-status">Click to start chatting</div>
              </div>
              <div className="chat-actions">
                <button className="icon-btn">📞</button>
                <button className="icon-btn">📹</button>
                <button className="icon-btn">⋯</button>
              </div>
            </div>

            <div className="messages visible">
              {active.messages.map((m, i) => (
                <div key={i} className={m.mine ? "msg-row mine" : "msg-row"}>
                  {!m.mine && (
                    <div
                      className="msg-avatar-sm"
                      style={{
                        background: `${active.color}22`,
                        color: active.color,
                      }}
                    >
                      {initials(active.name)}
                    </div>
                  )}
                  <div className={m.mine ? "bubble mine" : "bubble theirs"}>
                    {m.type === "image" ? (
                      <img src={m.imageUrl} style={{ maxWidth: "240px", borderRadius: "12px" }} />
                    ) : (
                      m.text
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="input-area visible">
              <div className="input-toolbar">
                <button className="toolbar-btn">📎</button>
                <label className="toolbar-btn">
                  🖼️
                  <input type="file" accept="image/*" hidden onChange={sendImage} />
                </label>
                <button className="toolbar-btn">😊</button>
              </div>

              <div className="input-row">
                <textarea
                  className="input-box"
                  placeholder={`Message ${active.name.split(" ")[0]}…`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <button className="send-btn" onClick={sendMessage}>
                  ➤
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {modalOpen && (
        <div className="modal-overlay open" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">New message</span>
              <button className="modal-close" onClick={() => setModalOpen(false)}>
                ✕
              </button>
            </div>

            <input
              className="modal-input"
              placeholder="Name or username…"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />

            <input
              className="modal-input"
              placeholder="Say something…"
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startChat()}
            />

            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={startChat}>
                Start chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}