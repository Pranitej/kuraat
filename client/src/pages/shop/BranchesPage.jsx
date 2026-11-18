import { createRef, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapPinOff, Search, X } from 'lucide-react';
import ScreenHeader from '@/components/layout/ScreenHeader.jsx';
import { Chip, ChipRow, EmptyState, IconButton } from '@/components/ui';
import MapIllustration from '@/components/branch/MapIllustration.jsx';
import { BranchListCard } from '@/components/branch/BranchCard.jsx';
import { useAddresses } from '@/context/AddressContext.jsx';
import { useBranches } from '@/context/BranchContext.jsx';
import { cityFilters, mapPins, withDistances } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { useDocumentTitle } from '@/hooks';

/** 25 · Our branches */
export default function BranchesPage() {
  useDocumentTitle('Our branches');
  const { defaultAddress } = useAddresses();
  const { branches } = useBranches();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [chosenCity, setCity] = useState('All');
  const [selected, setSelected] = useState(params.get('branch'));
  const cardRefs = useRef({});

  const all = useMemo(() => withDistances(branches, defaultAddress?.location), [branches, defaultAddress]);
  const nearestId = defaultAddress ? all[0]?.id : null;
  // Pills come from the branches we have; a city that is no longer there falls back to All.
  const filters = useMemo(() => cityFilters(all), [all]);
  const city = filters.includes(chosenCity) ? chosenCity : 'All';
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter(
      (b) => (city === 'All' || b.city === city) && (!q || [b.displayName, b.city, b.address].join(' ').toLowerCase().includes(q)),
    );
  }, [all, city, query]);

  all.forEach((b) => {
    if (!cardRefs.current[b.id]) cardRefs.current[b.id] = createRef();
  });

  // Deep link from "View branch details" / branch cards: highlight and scroll into view
  useEffect(() => {
    const id = params.get('branch');
    if (!id) return undefined;
    setSelected(id);
    const t = setTimeout(() => cardRefs.current[id]?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
    return () => clearTimeout(t);
  }, [params]);

  const focusBranch = (id) => {
    setSelected(id);
    const branch = all.find((b) => b.id === id);
    if (branch && city !== 'All' && branch.city !== city) setCity('All');
    setTimeout(() => cardRefs.current[id]?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
    setParams({ branch: id }, { replace: true });
  };

  // Pins keep their place by distance rank while the list is filtered.
  const visible = new Set(list.map((b) => b.id));
  const pins = mapPins(all).filter((pin) => visible.has(pin.id));

  return (
    <div className="pb-10">
      <div className="mx-auto max-w-column lg:max-w-app lg:px-8">
        <ScreenHeader title="Our branches" backFallback={ROUTES.home} />
      </div>
      <div className="mx-auto max-w-column px-5 lg:grid lg:max-w-app lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start lg:gap-10 lg:px-8">
        <div className="lg:sticky lg:top-[100px]">
          <div className="flex h-[52px] items-center gap-3 rounded-pill border border-line bg-white px-4 transition focus-within:border-maroon focus-within:shadow-ring">
            <Search size={20} strokeWidth={1.8} className="shrink-0 text-maroon" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by city or area"
              aria-label="Search branches by city or area"
              className="h-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-placeholder [&::-webkit-search-cancel-button]:hidden"
            />
            {query && <IconButton icon={X} label="Clear search" variant="plain" size="sm" iconSize={18} onClick={() => setQuery('')} />}
          </div>

          {filters.length > 0 && (
            <ChipRow className="mt-3.5">
              {filters.map((c) => (
                <Chip key={c} active={city === c} onClick={() => setCity(c)}>
                  {c}
                </Chip>
              ))}
            </ChipRow>
          )}

          <MapIllustration
            className="mt-3.5"
            height="h-[190px] lg:h-[420px]"
            pins={pins}
            selectedId={selected || nearestId}
            onSelect={focusBranch}
            you={{ x: 39, y: 66 }}
          />
          <p className="mt-2 hidden text-label font-normal text-muted lg:block">
            Distances are from your default address{defaultAddress ? ` in ${defaultAddress.district || defaultAddress.city}` : ''}. Select a pin to find the branch.
          </p>
        </div>

        <div className="mt-3.5 flex flex-col gap-3 lg:mt-0">
          {list.length ? (
            list.map((b) => (
              <BranchListCard
                key={b.id}
                ref={cardRefs.current[b.id]}
                branch={b}
                distanceKm={b.distanceKm}
                nearest={b.id === nearestId}
                highlighted={b.id === selected}
                onFocus={() => setSelected(b.id)}
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
        </div>
      </div>
    </div>
  );
}
