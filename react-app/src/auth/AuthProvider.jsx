import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/firebase/client";

const Ctx = createContext(null);
const AUTH_INITIAL_TIMEOUT_MS = 15000;
const PROFILE_TIMEOUT_MS = 10000;

function withTimeout(promise, timeoutMs, code) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => {
        const error = new Error(code);
        error.code = code;
        reject(error);
      }, timeoutMs);
    }),
  ]);
}

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    status: "loading",
    user: null,
    profile: null,
    error: null,
  });

  useEffect(() => {
    let alive = true;
    let requestId = 0;
    let initialResolved = false;

    const resolveUser = async user => {
      const currentRequest = ++requestId;
      if (!alive) return;

      if (!user) {
        setState({ status: "ready", user: null, profile: null, error: null });
        return;
      }

      setState({ status: "loading", user, profile: null, error: null });
      try {
        const snap = await withTimeout(
          getDoc(doc(db, "users", user.uid)),
          PROFILE_TIMEOUT_MS,
          "AUTH_PROFILE_TIMEOUT",
        );
        if (!alive || currentRequest !== requestId) return;
        if (!snap.exists()) {
          setState({ status: "ready", user, profile: null, error: null });
          return;
        }

        const profile = {
          uid: user.uid,
          email: user.email || "",
          ...snap.data(),
        };
        if (!profile.role || profile.active === false) {
          throw new Error("ACCOUNT_NOT_ALLOWED");
        }
        if (alive && currentRequest === requestId) {
          setState({ status: "ready", user, profile, error: null });
        }
      } catch (error) {
        if (alive && currentRequest === requestId) {
          setState({ status: "error", user, profile: null, error });
        }
      }
    };

    const stop = onAuthStateChanged(
      auth,
      user => {
        initialResolved = true;
        resolveUser(user);
      },
      error => {
        initialResolved = true;
        if (alive) setState({ status: "error", user: null, profile: null, error });
      },
    );

    if (typeof auth.authStateReady === "function") {
      auth.authStateReady().then(() => {
        if (!alive || initialResolved) return;
        initialResolved = true;
        resolveUser(auth.currentUser);
      }).catch(error => {
        if (!alive || initialResolved) return;
        initialResolved = true;
        setState({ status: "error", user: auth.currentUser, profile: null, error });
      });
    }

    const watchdog = window.setTimeout(() => {
      if (!alive || initialResolved) return;
      initialResolved = true;
      if (auth.currentUser) {
        console.warn("AUTH_INITIAL_STATE_TIMEOUT_USING_CURRENT_USER");
        resolveUser(auth.currentUser);
        return;
      }
      const error = new Error("AUTH_INITIAL_STATE_TIMEOUT");
      error.code = "AUTH_INITIAL_STATE_TIMEOUT";
      console.error("AUTH_INITIAL_STATE_TIMEOUT");
      setState({ status: "error", user: null, profile: null, error });
    }, AUTH_INITIAL_TIMEOUT_MS);

    return () => {
      alive = false;
      requestId += 1;
      window.clearTimeout(watchdog);
      stop();
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const value = useContext(Ctx);
  if (!value) throw new Error("AUTH_PROVIDER_REQUIRED");
  return value;
}
