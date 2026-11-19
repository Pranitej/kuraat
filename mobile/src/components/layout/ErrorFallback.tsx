import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { TriangleAlert } from '@/components/icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { captureError } from '@/lib/monitoring';
import { colors } from '@/theme/theme';
import { t } from '@/i18n';

/** Shown by a route's error boundary instead of a blank screen; reports the error once. */
export function ErrorFallback({ error, retry }: { error: Error; retry: () => void }) {
  useEffect(() => {
    captureError(error, { where: 'error-boundary' });
  }, [error]);
  return (
    <View style={styles.root}>
      <EmptyState
        icon={TriangleAlert}
        title={t('Something went wrong')}
        message={t('Please try again. If it keeps happening, close the app and open it again.')}
        actionLabel={t('Try again')}
        onAction={retry}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', backgroundColor: colors.cream },
});
