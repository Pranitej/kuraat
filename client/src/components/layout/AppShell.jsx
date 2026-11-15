import { Outlet } from 'react-router-dom';
import AppBar from './AppBar.jsx';
import { useIsDesktop } from '@/hooks';

/** Shell for signed-in screens: desktop app bar + page outlet. */
export default function AppShell() {
  const isDesktop = useIsDesktop();
  return (
    <div className="flex min-h-dvh flex-col">
      {isDesktop && <AppBar />}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

/** Standard page container: phone column on mobile/tablet, wide container on desktop. */
export function Page({ children, width = 'column', className }) {
  const widths = {
    column: 'max-w-column lg:max-w-[720px]',
    narrow: 'max-w-column lg:max-w-[600px]',
    wide: 'max-w-column lg:max-w-app lg:px-8',
  };
  return <div className={`mx-auto w-full px-5 ${widths[width]} ${className || ''}`}>{children}</div>;
}
