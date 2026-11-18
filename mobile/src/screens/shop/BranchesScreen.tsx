import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, TextInput, View, type ScrollViewInstance } from 'react-native';
import { BranchListCard } from '@/components/branch/BranchCard';
import { MapIllustration, type MapPin } from '@/components/branch/MapIllustration';
import { Screen, ScreenHeader } from '@/components/layout';
import { MapPinOff, Search, X } from '@/components/icons';
import { Chip, ChipRow, EmptyState, IconButton } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { useAddresses } from '@/context/AddressContext';
import { useBranches } from '@/context/BranchContext';
import { cityFilters, mapPins, withDistances } from '@/domain';
import { FONT_FAMILY, MAX_FONT_SCALE, colors, radii } from '@/theme/theme';
import type { Branch } from '@/types/api';

/** 25 · Our branches */
export default function BranchesScreen() {
  const params = useLocalSearchParams<{ branch?: string }>();
  const { defaultAddress } = useAddresses();
  const { branches } = useBranches();
  const [query, setQuery] = useState('');
  const [chosenCity, setCity] = useState('All');
  const [selected, setSelected] = useState<string | null>(params.branch ?? null);
  // A new ?branch= while this screen is open selects that branch (adjusting state during render).
  const [linked, setLinked] = useState(params.branch);
  if (params.branch !== linked) {
    setLinked(params.branch);
    if (params.branch) setSelected(params.branch);
  }
  const scroll = useRef<ScrollViewInstance>(null);
  const listY = useRef(0);
  const cardY = useRef<Record<string, number>>({});

  const all = useMemo(() => withDistances(branches, defaultAddress?.location) as Branch[], [branches, defaultAddress]);
  const nearestId = defaultAddress ? (all[0]?.id ?? null) : null;
  // Pills come from the branches we have; a city that is no longer there falls back to All.
  const filters: string[] = useMemo(() => cityFilters(all), [all]);
  const city = filters.includes(chosenCity) ? chosenCity : 'All';
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter(
      (b) => (city === 'All' || b.city === city) && (!q || [b.displayName, b.city, b.address].join(' ').toLowerCase().includes(q)),
    );
  }, [all, city, query]);

  const scrollTo = (id: string, delay = 60) =>
    setTimeout(() => {
      const y = cardY.current[id];
      if (y != null) scroll.current?.scrollTo({ y: Math.max(0, listY.current + y - 120), animated: true });
    }, delay);

  // "View branch details" / branch cards open with ?branch=: bring it into view once laid out.
  useEffect(() => {
    if (!params.branch) return undefined;
    const t = scrollTo(params.branch, 300);
    return () => clearTimeout(t);
  }, [params.branch]);

  const focusBranch = (id: string) => {
    setSelected(id);
    const branch = all.find((b) => b.id === id);
    if (branch && city !== 'All' && branch.city !== city) setCity('All');
    scrollTo(id);
  };

  // Pins keep their place by distance rank while the list is filtered.
  const visible = new Set(list.map((b) => b.id));
  const pins = (mapPins(all) as MapPin[]).filter((pin) => visible.has(pin.id));

  return (
    <Screen header={<ScreenHeader title="Our branches" backFallback={ROUTES.home} />} scrollRef={scroll}>
      <View style={styles.search}>
        <Search size={20} color={colors.maroon} strokeWidth={1.8} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by city or area"
          placeholderTextColor={colors.placeholder}
          accessibilityLabel="Search branches by city or area"
          returnKeyType="search"
          autoCorrect={false}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          selectionColor={colors.maroon}
          style={styles.searchInput}
        />
        {query ? <IconButton icon={X} label="Clear search" variant="plain" size="sm" iconSize={18} onPress={() => setQuery('')} /> : null}
      </View>

      {filters.length > 0 && (
        <ChipRow style={styles.chips}>
          {filters.map((c) => (
            <Chip key={c} active={city === c} onPress={() => setCity(c)}>
              {c}
            </Chip>
          ))}
        </ChipRow>
      )}

      <MapIllustration
        style={styles.map}
        height={190}
        pins={pins}
        selectedId={selected || nearestId}
        onSelect={focusBranch}
        you={{ x: 39, y: 66 }}
      />

      <View
        style={styles.list}
        onLayout={(e) => {
          listY.current = e.nativeEvent.layout.y;
        }}
      >
        {list.length ? (
          list.map((b) => (
            <BranchListCard
              key={b.id}
              branch={b}
              distanceKm={b.distanceKm}
              nearest={b.id === nearestId}
              highlighted={b.id === selected}
              onLayout={(e) => {
                cardY.current[b.id] = e.nativeEvent.layout.y;
              }}
            />
          ))
        ) : (
          <EmptyState
            compact
            icon={MapPinOff}
            title="No branches found"
            message={`We do not have a branch matching “${query || city}” yet.`}
            actionLabel="Show all branches"
            onAction={() => {
              setQuery('');
              setCity('All');
            }}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, height: '100%', paddingVertical: 0, fontSize: 15, fontFamily: FONT_FAMILY[400], color: colors.ink },
  chips: { marginTop: 14 },
  map: { marginTop: 14 },
  list: { marginTop: 14, gap: 12 },
});
