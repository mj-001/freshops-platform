export interface OfflineAction {
  id: string;
  timestamp: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body: any;
  headers?: Record<string, string>;
  description: string;
  retryCount: number;
  status: 'pending' | 'failed' | 'syncing';
  error?: string;
  idempotencyKey: string;   // NEW
}

const STORAGE_KEY = 'wms_offline_actions_queue';
const OFFLINE_MODE_KEY = 'wms_simulated_offline_mode';

// Subscriptions for state changes
type Listener = (queue: OfflineAction[], isOfflineMode: boolean) => void;
const listeners: Set<Listener> = new Set();

const notifyListeners = () => {
  const q = getQueue();
  const offMode = isSimulatedOffline();
  listeners.forEach(l => l(q, offMode));
};

export function getQueue(): OfflineAction[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error('Failed to parse offline action queue', err);
    return [];
  }
}

export function saveQueue(queue: OfflineAction[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    notifyListeners();
  } catch (err) {
    console.error('Failed to save offline action queue', err);
  }
}

export function isSimulatedOffline(): boolean {
  return localStorage.getItem(OFFLINE_MODE_KEY) === 'true';
}

export function setSimulatedOffline(offline: boolean): void {
  localStorage.setItem(OFFLINE_MODE_KEY, String(offline));
  notifyListeners();
}

export function queueAction(
  endpoint: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body: any,
  description: string,
  headers?: Record<string, string>
): OfflineAction {
  const queue = getQueue();
  const newAction: OfflineAction = {
    id: 'TX-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
    timestamp: new Date().toISOString(),
    endpoint,
    method,
    body,
    headers,
    description,
    retryCount: 0,
    status: 'pending',
    idempotencyKey: headers?.['X-Idempotency-Key'] || 'IDK-' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36)
  };

  queue.push(newAction);
  saveQueue(queue);
  return newAction;
}

export function removeAction(id: string): void {
  const queue = getQueue();
  const filtered = queue.filter(a => a.id !== id);
  saveQueue(filtered);
}

export function updateAction(id: string, updates: Partial<OfflineAction>): void {
  const queue = getQueue();
  const index = queue.findIndex(a => a.id === id);
  if (index !== -1) {
    queue[index] = { ...queue[index], ...updates };
    saveQueue(queue);
  }
}

export function clearQueue(): void {
  saveQueue([]);
}

// Function to check actual health + simulated status
export async function checkServerStatus(): Promise<boolean> {
  if (isSimulatedOffline()) {
    return false;
  }
  if (!navigator.onLine) {
    return false;
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('/api/v1/health', { signal: controller.signal });
    clearTimeout(timeoutId);
    return res.status === 200;
  } catch {
    return false;
  }
}

// Synchronize all queued items iteratively
export async function syncOfflineQueue(
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void
): Promise<{ successCount: number; failureCount: number }> {
  const queue = getQueue();
  if (queue.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  // Double check connection
  const online = await checkServerStatus();
  if (!online) {
    return { successCount: 0, failureCount: queue.length };
  }

  let successCount = 0;
  let failureCount = 0;

  // Process actions sequentially to guarantee transaction order
  for (const action of queue) {
    if (action.status === 'syncing') continue;

    updateAction(action.id, { status: 'syncing' });
    try {
      const res = await fetch(action.endpoint, {
        method: action.method,
        headers: {
          'Content-Type': 'application/json',
          ...(action.headers || {})
        },
        body: JSON.stringify(action.body)
      });

      const payload = await res.json();
      if (res.ok && !payload.error) {
        // Success: remove from local storage queue
        removeAction(action.id);
        successCount++;
        triggerToast(`Offline sync success: ${action.description}`, 'success');
      } else {
        const errorMsg = payload.error?.message || payload.error || 'Server error';
        updateAction(action.id, {
          status: 'failed',
          retryCount: action.retryCount + 1,
          error: errorMsg
        });
        failureCount++;
      }
    } catch (err: any) {
      updateAction(action.id, {
        status: 'failed',
        retryCount: action.retryCount + 1,
        error: err.message || 'Network fetch failure'
      });
      failureCount++;
    }
  }

  return { successCount, failureCount };
}

export function subscribeToQueue(listener: Listener): () => void {
  listeners.add(listener);
  // initial call
  listener(getQueue(), isSimulatedOffline());
  return () => {
    listeners.delete(listener);
  };
}

// Intercept local actions or invoke on offline mode
export async function performQueueableRequest(
  endpoint: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body: any,
  description: string,
  headers?: Record<string, string>
): Promise<{ success: boolean; queued: boolean; data?: any; error?: string }> {
  const idempotencyKey = 'IDK-' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
  const requestHeaders = { ...(headers || {}), 'X-Idempotency-Key': idempotencyKey };

  const online = await checkServerStatus();

  if (!online) {
    queueAction(endpoint, method, body, description, requestHeaders);
    return { success: false, queued: true, error: `Action queued offline: ${description}` };
  }

  try {
    const res = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...requestHeaders
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (res.ok && !data.error) {
      return { success: true, queued: false, data: data.data };
    } else {
      return { success: false, queued: false, error: data.error?.message || data.error || 'Request rejected by server' };
    }
  } catch (err: any) {
    queueAction(endpoint, method, body, description, requestHeaders);
    return { success: false, queued: true, error: `Network error, queued offline: ${description}` };
  }
}
