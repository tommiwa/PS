import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface ActiveLock {
  lockId: string;
  spotId: string;
  listingId: string;
  expiresAt: string;
  remainingSeconds: number;
}

interface LockContextType {
  userActiveLock: ActiveLock | null;
  lockedListings: Map<string, ActiveLock>;
  acquireLock: (spotId: string, listingId: string) => Promise<ActiveLock>;
  releaseLock: (lockId: string) => Promise<void>;
  clearUserLock: () => void;
}

const LockContext = createContext<LockContextType | null>(null);

export function useLock() {
  const context = useContext(LockContext);
  if (!context) {
    throw new Error("useLock must be used within LockProvider");
  }
  return context;
}

export function LockProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [userActiveLock, setUserActiveLock] = useState<ActiveLock | null>(null);
  const [lockedListings, setLockedListings] = useState<Map<string, ActiveLock>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    if (!user) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/locks`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[LockContext] WebSocket connected');
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[LockContext] Received:', message);

          switch (message.type) {
            case 'lock.created': {
              const { lockId, spotId, listingId, userId, expiresAt } = message.data;
              const remainingSeconds = Math.floor(
                (new Date(expiresAt).getTime() - Date.now()) / 1000
              );

              const lockInfo: ActiveLock = {
                lockId,
                spotId,
                listingId,
                expiresAt,
                remainingSeconds,
              };

              // Update locked listings map
              setLockedListings((prev) => {
                const updated = new Map(prev);
                updated.set(listingId, lockInfo);
                return updated;
              });

              // If it's the current user's lock, update userActiveLock
              if (userId === user?.id) {
                setUserActiveLock(lockInfo);
              }

              // Invalidate available spots query to refresh UI
              queryClient.invalidateQueries({ queryKey: ['/api/available-spots'] });
              break;
            }

            case 'lock.released':
            case 'lock.expired':
            case 'lock.confirmed': {
              const { lockId, listingId } = message.data;

              // Remove from locked listings
              setLockedListings((prev) => {
                const updated = new Map(prev);
                updated.delete(listingId);
                return updated;
              });

              // Clear user lock if it matches
              setUserActiveLock((prev) => {
                if (prev?.lockId === lockId) {
                  if (message.type === 'lock.expired') {
                    toast({
                      title: "Lock Expired",
                      description: "Your reservation expired. Please try again.",
                      variant: "destructive",
                    });
                  }
                  return null;
                }
                return prev;
              });

              // Invalidate available spots query
              queryClient.invalidateQueries({ queryKey: ['/api/available-spots'] });
              break;
            }

            case 'connected':
              console.log('[LockContext]', message.message);
              break;
          }
        } catch (error) {
          console.error('[LockContext] Error processing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[LockContext] WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('[LockContext] WebSocket disconnected');
        wsRef.current = null;

        // Attempt reconnection with exponential backoff
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current++;
          
          console.log(
            `[LockContext] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`
          );
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, delay);
        }
      };
    } catch (error) {
      console.error('[LockContext] Error creating WebSocket:', error);
    }
  }, [user, toast]);

  // Setup WebSocket connection when user logs in
  useEffect(() => {
    if (user) {
      connectWebSocket();
    } else {
      // Cleanup when user logs out
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setUserActiveLock(null);
      setLockedListings(new Map());
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [user, connectWebSocket]);

  // Acquire lock
  const acquireLock = useCallback(
    async (spotId: string, listingId: string): Promise<ActiveLock> => {
      try {
        const response = await apiRequest(`/api/spots/${spotId}/locks`, {
          method: 'POST',
          body: { listingId },
        });

        const data = await response.json();
        
        const lockInfo: ActiveLock = {
          lockId: data.lockId,
          spotId: data.spotId,
          listingId: data.listingId,
          expiresAt: data.expiresAt,
          remainingSeconds: data.remainingSeconds,
        };

        setUserActiveLock(lockInfo);
        
        // Also add to locked listings
        setLockedListings((prev) => {
          const updated = new Map(prev);
          updated.set(listingId, lockInfo);
          return updated;
        });

        return lockInfo;
      } catch (error: any) {
        console.error('[LockContext] Error acquiring lock:', error);
        throw error;
      }
    },
    []
  );

  // Release lock
  const releaseLock = useCallback(
    async (lockId: string): Promise<void> => {
      try {
        await apiRequest(`/api/spot-locks/${lockId}`, {
          method: 'DELETE',
        });

        // Clear user lock if it matches
        setUserActiveLock((prev) => {
          if (prev?.lockId === lockId) {
            return null;
          }
          return prev;
        });
      } catch (error: any) {
        console.error('[LockContext] Error releasing lock:', error);
        // Don't throw - lock may have already expired
      }
    },
    []
  );

  // Clear user lock (used after successful booking)
  const clearUserLock = useCallback(() => {
    setUserActiveLock(null);
  }, []);

  const value: LockContextType = {
    userActiveLock,
    lockedListings,
    acquireLock,
    releaseLock,
    clearUserLock,
  };

  return <LockContext.Provider value={value}>{children}</LockContext.Provider>;
}
