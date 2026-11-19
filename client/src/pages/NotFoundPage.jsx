import { SearchX } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import { ROUTES } from '@/config/routes.js';
import { useDocumentTitle } from '@/hooks';
import { t } from '@/i18n';

export default function NotFoundPage() {
  useDocumentTitle(t('Page not found'));
  return (
    <div className="mx-auto max-w-column pt-10 lg:pt-16">
      <EmptyState
        icon={SearchX}
        title={t('We could not find that page')}
        message={t('The link may be out of date. Head back to our sweets to keep browsing.')}
        actionLabel={t('Back to home')}
        actionTo={ROUTES.home}
      />
    </div>
  );
}
