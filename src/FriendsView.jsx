import { useState, useEffect } from "react";
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  getPendingRequests,
  getFriends,
  removeFriend,
  blockUser,
  searchUsers,
} from "./friends";

export function FriendsView({ db, currentUid, currentUsername, onStartDM }) {
  const [tab, setTab] = useState("friends"); // friends, requests, search
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sentRequests, setSentRequests] = useState(new Set());

  useEffect(() => {
    const unsubFriends = getPendingRequests(db, currentUid, setRequests);
    const unsubRequests = getFriends(db, currentUid, setFriends);

    return () => {
      unsubFriends?.();
      unsubRequests?.();
    };
  }, [db, currentUid]);

  async function handleSearch() {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const results = await searchUsers(db, query, currentUid);
      setSearchResults(results);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendRequest(targetUser) {
    setLoading(true);
    try {
      await sendFriendRequest(
        db,
        currentUid,
        currentUsername,
        targetUser.uid,
        targetUser.username
      );
      setSentRequests((prev) => new Set([...prev, targetUser.uid]));
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(request) {
    await acceptFriendRequest(
      db,
      request.id,
      currentUid,
      request.fromUid,
      currentUsername,
      request.fromUsername
    );
  }

  async function handleDecline(request) {
    await declineFriendRequest(db, request.id);
  }

  async function handleRemoveFriend(friendUid) {
    await removeFriend(db, currentUid, friendUid);
  }

  async function handleBlockUser(friendUid) {
    await blockUser(db, currentUid, friendUid);
    await removeFriend(db, currentUid, friendUid);
  }

  return (
    <div className="friends-view">
      <div className="friends-tabs">
        <button
          className={tab === "friends" ? "tab active" : "tab"}
          onClick={() => setTab("friends")}
        >
          Friends ({friends.length})
        </button>
        <button
          className={tab === "requests" ? "tab active" : "tab"}
          onClick={() => setTab("requests")}
        >
          Requests ({requests.length})
        </button>
        <button
          className={tab === "search" ? "tab active" : "tab"}
          onClick={() => setTab("search")}
        >
          Add Friend
        </button>
      </div>

      {tab === "friends" && (
        <div className="friends-list">
          {friends.length === 0 ? (
            <div className="empty-state">
              <p>No friends yet. Search for users to add!</p>
            </div>
          ) : (
            friends.map((friend) => (
              <div key={friend.id} className="friend-item">
                <div className="friend-info">
                  <div className="friend-name">{friend.username}</div>
                  <div className="friend-meta">Added {new Date(friend.createdAt?.toDate?.()).toLocaleDateString()}</div>
                </div>
                <div className="friend-actions">
                  <button
                    className="action-btn primary"
                    onClick={() => onStartDM?.(friend.username)}
                  >
                    Message
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => handleRemoveFriend(friend.uid)}
                  >
                    Remove
                  </button>
                  <button
                    className="action-btn danger"
                    onClick={() => handleBlockUser(friend.uid)}
                  >
                    Block
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "requests" && (
        <div className="friend-requests">
          {requests.length === 0 ? (
            <div className="empty-state">
              <p>No pending friend requests</p>
            </div>
          ) : (
            requests.map((request) => (
              <div key={request.id} className="request-item">
                <div className="request-info">
                  <div className="request-name">{request.fromUsername}</div>
                  <div className="request-meta">sent you a friend request</div>
                </div>
                <div className="request-actions">
                  <button
                    className="action-btn primary"
                    onClick={() => handleAccept(request)}
                  >
                    Accept
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => handleDecline(request)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "search" && (
        <div className="friend-search">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search username…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button
              className="action-btn primary"
              onClick={handleSearch}
              disabled={loading}
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </div>

          <div className="search-results">
            {searchResults.length === 0 && searchQuery && !loading && (
              <div className="empty-state">
                <p>No users found matching "{searchQuery}"</p>
              </div>
            )}
            {searchResults.map((user) => (
              <div key={user.uid} className="user-item">
                <div className="user-info">
                  <div className="user-name">{user.username}</div>
                  {user.bio && <div className="user-bio">{user.bio}</div>}
                </div>
                <button
                  className="action-btn primary"
                  onClick={() => handleSendRequest(user)}
                  disabled={sentRequests.has(user.uid)}
                >
                  {sentRequests.has(user.uid) ? "Request Sent" : "Add Friend"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
