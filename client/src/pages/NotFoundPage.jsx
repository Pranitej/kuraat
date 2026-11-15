import { SearchX } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import { ROUTES } from '@/config/routes.js';
import { useDocumentTitle } from '@/hooks';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <div className="mx-auto max-w-column pt-10 lg:pt-16">
      <EmptyState
        icon={SearchX}
        title="We could not find that page"
        message="The link may be out of date. Head back to our sweets to keep browsing."
        actionLabel="Back to home"
        actionTo={ROUTES.home}
      />
    </div>
  );
}
