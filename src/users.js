import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

export async function createUserProfile(db, uid, username, email) {
  try {
    await addDoc(collection(db, "users"), {
      uid,
      username,
      email,
      createdAt: serverTimestamp(),
      bio: "",
      avatar: "",
    });
    return true;
  } catch (error) {
    console.error("Error creating user profile:", error);
    return false;
  }
}

export async function getUserProfile(db, uid) {
  try {
    const q = query(collection(db, "users"), where("uid", "==", uid));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs[0].data();
    }
    return null;
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
}

export async function searchUserByUsername(db, username) {
  try {
    const q = query(
      collection(db, "users"),
      where("username", "==", username)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }
    return null;
  } catch (error) {
    console.error("Error searching user:", error);
    return null;
  }
}

export async function searchUsersStartsWith(db, prefix, limit = 10) {
  try {
    const q = query(collection(db, "users"));
    const snapshot = await getDocs(q);
    
    return snapshot.docs
      .map((d) => d.data())
      .filter((u) => u.username.toLowerCase().startsWith(prefix.toLowerCase()))
      .slice(0, limit);
  } catch (error) {
    console.error("Error searching users:", error);
    return [];
  }
}

export async function updateUserProfile(db, uid, updates) {
  try {
    const q = query(collection(db, "users"), where("uid", "==", uid));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const userRef = snapshot.docs[0];
      await userRef.ref.update(updates);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error updating user profile:", error);
    return false;
  }
}
