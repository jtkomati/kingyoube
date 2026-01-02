import { useEffect, useState } from 'react';

const PluggyOAuthCallback = () => {
  const [canClose, setCanClose] = useState(false);

  useEffect(() => {
    // Log the callback for debugging
    console.log('Pluggy OAuth callback received');
    console.log('Search:', window.location.search);
    console.log('Hash:', window.location.hash);

    // Try to notify opener/parent
    const message = {
      type: 'pluggy:oauth_callback',
      search: window.location.search,
      hash: window.location.hash,
    };

    if (window.opener) {
      window.opener.postMessage(message, '*');
    }
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(message, '*');
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
