import { getQueue, removeFromQueue, queueMutation } from "./idb-cache";

export interface OfflineMutation {
  id: string;
  method: string;
  url: string;
  body: unknown;
}

export async function enqueueOfflineMutation(
  method: string,
  url: string,
  body: unknown
): Promise<void> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await queueMutation({ id, method, url, body });
}

export async function replayOfflineQueue(): Promise<void> {
  const queue = await getQueue();
  for (const mutation of queue) {
    try {
      const res = await fetch(mutation.url, {
        method: mutation.method,
        headers: { "Content-Type": "application/json" },
        body: mutation.body ? JSON.stringify(mutation.body) : undefined,
      });
      if (res.ok || res.status < 500) {
        // Remove from queue whether success or client error (don't retry 4xx)
        await removeFromQueue(mutation.id);
      }
    } catch {
      // Network still unavailable — leave in queue
      break;
    }
  }
}
