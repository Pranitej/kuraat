import { useRouter } from 'expo-router';
import { Screen } from '@/components/layout';
import { SearchX } from '@/components/icons';
import { EmptyState } from '@/components/ui';
import { ROUTES } from '@/lib/routes';

/** Unknown link (e.g. an old deep link): same copy as the web's NotFoundPage. */
export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <Screen contentStyle={{ paddingTop: 40 }}>
      <EmptyState
        icon={SearchX}
        title="We could not find that page"
        message="The link may be out of date. Head back to our sweets to keep browsing."
        actionLabel="Back to home"
        onAction={() => router.replace(ROUTES.home)}
      />
    </Screen>
  );
}
