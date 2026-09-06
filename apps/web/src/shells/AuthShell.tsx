import styles from './AuthShell.module.css';

/** Static authentication shell — no auth logic in M1. */
export function AuthShell() {
  return (
    <section className={styles.page} aria-labelledby="auth-title">
      <div className={styles.card}>
        <div className={styles.logoRow}>
          <img src="/brand/ohun-icon.svg" alt="" width={64} height={64} />
        </div>
        <h1 id="auth-title" className={styles.title}>
          Ohun
        </h1>
        <p className={styles.subtitle}>
          Sign in to continue private conversations with friends and family.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
          }}
          noValidate
        >
          <div className={styles.field}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="you@example.com"
              disabled
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              disabled
            />
          </div>
          <div className={styles.actions}>
            <button type="submit" className={styles.primary} disabled>
              Sign in
            </button>
            <button type="button" className={styles.secondary} disabled>
              Create account
            </button>
          </div>
        </form>
        <p className={styles.note}>Authentication is deferred to a later milestone.</p>
      </div>
    </section>
  );
}
