import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  serverTimestamp,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

export async function sendFriendRequest(db, fromUid, fromUsername, toUid, toUsername) {
  const existing = await getDocs(
    query(
      collection(db, "friendRequests"),
      where("fromUid", "==", fromUid),
      where("toUid", "==", toUid),
      where("status", "==", "pending")
    )
  );

  if (!existing.empty) return null; // Already exists

  const req = await addDoc(collection(db, "friendRequests"), {
    fromUid,
    fromUsername,
    toUid,
    toUsername,
    status: "pending",
    createdAt: serverTimestamp(),
  });

  return req.id;
}

export async function acceptFriendRequest(db, requestId, uid1, uid2, username1, username2) {
  await updateDoc(doc(db, "friendRequests", requestId), {
    status: "accepted",
  });

  await addDoc(collection(db, "friends"), {
    users: [uid1, uid2],
    usernames: [username1, username2],
    createdAt: serverTimestamp(),
  });
}

export async function declineFriendRequest(db, requestId) {
  await updateDoc(doc(db, "friendRequests", requestId), {
    status: "declined",
  });
}

export async function getPendingRequests(db, uid, callback) {
  const q = query(
    collection(db, "friendRequests"),
    where("toUid", "==", uid),
    where("status", "==", "pending")
  );

  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(requests);
  });
}

export async function getFriends(db, uid, callback) {
  const q = query(
    collection(db, "friends"),
    where("users", "array-contains", uid)
  );

  return onSnapshot(q, (snapshot) => {
    const friends = snapshot.docs.map((d) => {
      const data = d.data();
      const friendUid = data.users.find((u) => u !== uid);
      const friendUsername = data.usernames[data.users.indexOf(friendUid)];
      return {
        id: d.id,
        uid: friendUid,
        username: friendUsername,
        createdAt: data.createdAt,
      };
    });
    callback(friends);
  });
}

export async function removeFriend(db, uid1, uid2) {
  const q = query(
    collection(db, "friends"),
    where("users", "==", [uid1, uid2])
  );

  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    await deleteDoc(doc(db, "friends", snapshot.docs[0].id));
  }
}

export async function blockUser(db, blockerUid, blockedUid) {
  await addDoc(collection(db, "blockedUsers"), {
    blockerUid,
    blockedUid,
    createdAt: serverTimestamp(),
  });
}

export async function unblockUser(db, blockerUid, blockedUid) {
  const q = query(
    collection(db, "blockedUsers"),
    where("blockerUid", "==", blockerUid),
    where("blockedUid", "==", blockedUid)
  );

  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    await deleteDoc(doc(db, "blockedUsers", snapshot.docs[0].id));
  }
}

export async function isBlocked(db, blockerUid, blockedUid) {
  const q = query(
    collection(db, "blockedUsers"),
    where("blockerUid", "==", blockerUid),
    where("blockedUid", "==", blockedUid)
  );

  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

export async function searchUsers(db, queryText, currentUid) {
  try {
    const q = query(collection(db, "users"));
    const snapshot = await getDocs(q);
    
    return snapshot.docs
      .map((d) => d.data())
      .filter(
        (u) =>
          u.uid !== currentUid &&
          u.username.toLowerCase().includes(queryText.toLowerCase())
      )
      .slice(0, 10);
  } catch (error) {
    console.error("Error searching users:", error);
    return [];
  }
}
