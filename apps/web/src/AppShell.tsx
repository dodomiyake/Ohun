import { NavLink, Outlet } from 'react-router-dom';
import styles from './styles/AppShell.module.css';

const LINKS = [
  { to: '/auth', label: 'Auth' },
  { to: '/mobile', label: 'Mobile' },
  { to: '/tablet', label: 'Tablet' },
  { to: '/desktop', label: 'Desktop' },
  { to: '/loading', label: 'Loading' },
  { to: '/empty', label: 'Empty' },
  { to: '/offline', label: 'Offline' },
  { to: '/error', label: 'Error' },
] as const;

export function AppShell() {
  return (
    <div className={styles.shellRoot}>
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>
      <header className={styles.chrome}>
        <div className={styles.topBar}>
          <a className={styles.brand} href="/">
            <img src="/brand/ohun-icon.svg" alt="" width={36} height={36} />
            <span>Ohun</span>
          </a>
          <nav className={styles.nav} aria-label="Shell previews">
            {LINKS.map((link) => (
              <NavLink key={link.to} to={link.to}>
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <p className={styles.banner}>
          Milestone 1 static shells — authentication and messaging are not connected.
        </p>
      </header>
      <main id="main" className={styles.main} tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
