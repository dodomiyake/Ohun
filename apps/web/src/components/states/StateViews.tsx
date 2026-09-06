import styles from './StateViews.module.css';

export function LoadingState() {
  return (
    <div className={styles.state} role="status" aria-live="polite">
      <div className={styles.spinner} aria-hidden="true" />
      <h1 className={styles.title}>Loading</h1>
      <p className={styles.body}>Preparing your Ohun workspace.</p>
      <span className={styles.srOnly}>Content is loading</span>
    </div>
  );
}

export function EmptyState() {
  return (
    <div className={styles.state}>
      <div className={styles.icon} aria-hidden="true" />
      <h1 className={styles.title}>No conversations yet</h1>
      <p className={styles.body}>
        When you connect with friends and family, your chats will appear here.
      </p>
      <button type="button" className={styles.action} disabled>
        Find people
      </button>
    </div>
  );
}

export function OfflineState() {
  return (
    <div className={styles.state} role="alert">
      <div className={styles.iconOffline} aria-hidden="true" />
      <h1 className={styles.title}>You are offline</h1>
      <p className={styles.body}>
        Check your connection. Ohun will reconnect when the network is available.
      </p>
      <button type="button" className={styles.action} disabled>
        Try again
      </button>
    </div>
  );
}

export function ErrorState() {
  return (
    <div className={styles.state} role="alert">
      <div className={styles.iconError} aria-hidden="true" />
      <h1 className={styles.title}>Something went wrong</h1>
      <p className={styles.body}>
        We could not load this screen. Please try again in a moment.
      </p>
      <button type="button" className={styles.action} disabled>
        Retry
      </button>
    </div>
  );
}
