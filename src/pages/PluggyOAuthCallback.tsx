import { useEffect, useState } from 'react';

const BROADCAST_CHANNEL_NAME = 'pluggy_oauth';
const STORAGE_KEY = 'pluggy_oauth_callback';

const PluggyOAuthCallback = () => {
  const [canClose, setCanClose] = useState(false);

  useEffect(() => {
    // Log the callback for debugging
    console.log('Pluggy OAuth callback received');
    console.log('Search:', window.location.search);
    console.log('Hash:', window.location.hash);

    const callbackData = {
      type: 'pluggy:oauth_callback',
      search: window.location.search,
      hash: window.location.hash,
      timestamp: Date.now(),
    };

    // 1. Try BroadcastChannel (most reliable for same-origin tabs)
    try {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.postMessage(callbackData);
      console.log('Sent via BroadcastChannel');
      channel.close();
    } catch (e) {
      console.log('BroadcastChannel not supported:', e);
    }

    // 2. Also store in localStorage as fallback
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(callbackData));
      // Trigger storage event manually for same-tab detection
      window.dispatchEvent(new StorageEvent('storage', {
        key: STORAGE_KEY,
        newValue: JSON.stringify(callbackData),
      }));
      console.log('Stored in localStorage');
    } catch (e) {
      console.log('localStorage not available:', e);
    }

    // 3. Try postMessage to opener (if available and same origin)
    if (window.opener) {
      try {
        window.opener.postMessage(callbackData, window.location.origin);
        console.log('Sent via postMessage to opener');
      } catch (e) {
        console.log('postMessage to opener failed:', e);
      }
    }

    // 4. Try postMessage to parent (if in iframe)
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage(callbackData, window.location.origin);
        console.log('Sent via postMessage to parent');
      } catch (e) {
        console.log('postMessage to parent failed:', e);
      }
    }

    // Try to close after a short delay
    const timer = setTimeout(() => {
      try {
        window.close();
      } catch {
        // Browser may block window.close()
        setCanClose(true);
      }
      // If still open after attempting close, show button
      setTimeout(() => setCanClose(true), 500);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    try {
      window.close();
    } catch {
      // Ignore
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-foreground mb-2">
          Autorização concluída
        </h1>
        <p className="text-muted-foreground mb-4">
          Esta janela será fechada automaticamente...
        </p>
        {canClose && (
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Fechar janela
          </button>
        )}
      </div>
    </div>
  );
};

export default PluggyOAuthCallback;
