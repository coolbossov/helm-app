"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AuthState } from "@/types";

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setState({
        user: user ? { id: user.id, email: user.email! } : null,
        loading: false,
      });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({
        user: session?.user
          ? { id: session.user.id, email: session.user.email! }
          : null,
        loading: false,
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  return state;
}
