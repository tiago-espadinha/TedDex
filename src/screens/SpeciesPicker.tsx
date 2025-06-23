import Fuse from 'fuse.js';
import { useLiveQuery } from 'dexie-react-hooks';
import { memo, useCallback, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { loadIndex, useLoad } from '../data/api';
import { createCustomPokedex, db, setPokedexSpecies } from '../data/db';
import { DEFAULT_FILTERS, type DexFilters } from '../data/dexState';
import { FUSE_OPTIONS, applyFilters, dexRows } from '../data/filter';
import { useFavourites } from '../data/favourites';
import { formatNo } from '../data/format';
import { Icon } from '../components/Icon';
import { CountBadge, Loading, SearchField } from '../components/bits';
import { MonImg } from '../components/MonImg';
import { FilterSheet } from './FilterSheet';

/** Picks the species of a new custom Pokédex; Done creates it and opens it in the picker's place. */
export function NewCustomPokedex() {
  const navigate = useNavigate();
  return (
    <SpeciesPicker
      title="Custom Pokédex"
      initial={[]}
      back={() => navigate('/teams/pokedex/new', { replace: true })}
      onDone={async (species) => navigate(`/teams/pokedex/${await createCustomPokedex(species)}`, { replace: true })}
    />
  );
}

/** Changes a custom Pokédex's species; Done saves and goes back to it. */
export function EditPokedexSpecies() {
  const id = Number(useParams().id);
  const dex = useLiveQuery(() => db.pokedexes.get(id).then((d) => d ?? null), [id]);
  const navigate = useNavigate();
  const back = () => (history.length > 1 ? navigate(-1) : navigate(`/teams/pokedex/${id}`, { replace: true }));
  if (dex === undefined) return <Loading />;
  if (!dex) return <p className="empty">This Pokédex no longer exists.</p>;
  if (!dex.species) return <Navigate to={`/teams/pokedex/${id}`} replace />;
  return (
    <SpeciesPicker
      title={dex.name}
      initial={dex.species}
      back={back}
      onDone={async (species) => {
        await setPokedexSpecies(id, species);
        back();
      }}
    />
  );
}

/** Every species with search and the Dex's filter sheet; a tap selects or deselects one. Done needs at least one. */
function SpeciesPicker({ title, initial, back, onDone }: { title: string; initial: number[]; back: () => void; onDone: (species: number[]) => Promise<unknown> }) {
  const { data: index } = useLoad(loadIndex, 'index');
  const rows = useMemo(() => (index ? dexRows(index, []) : undefined), [index]);
  const fuse = useMemo(() => (rows ? new Fuse(rows, FUSE_OPTIONS) : null), [rows]);
  const [filters, setFilters] = useState<DexFilters>(DEFAULT_FILTERS);
  const favourites = useFavourites();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Set(initial));
  // A second tap on Done while the first save runs would create another Pokédex.
  const [busy, setBusy] = useState(false);
  const shown = useMemo(() => (rows ? applyFilters(rows, fuse, filters, undefined, favourites) : undefined), [rows, fuse, filters, favourites]);
  const active = filters.gens.length + filters.types.length + (filters.category ? 1 : 0) + (filters.sort !== 'number' ? 1 : 0);
  const toggle = useCallback(
    (id: number) =>
      setSelected((s) => {
        const next = new Set(s);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    [],
  );

  return (
    <>
      <header className="topbar dex-top">
        <button className="icon-btn" aria-label="Back" onClick={back}>
          <Icon name="back" />
        </button>
        <div className="grow">
          <h1 className="team-name">{title}</h1>
          <div className="sub">{selected.size ? `${selected.size} selected` : 'Pick at least one'}</div>
        </div>
        <button
          className="text-btn"
          disabled={busy || selected.size === 0}
          onClick={async () => {
            setBusy(true);
            try {
              await onDone([...selected]);
            } finally {
              setBusy(false);
            }
          }}
        >
          Done
        </button>
      </header>
      <div className="dex-search">
        <SearchField
          label="Search Pokémon"
          placeholder="Name, number, type"
          value={filters.query}
          onChange={(query) => setFilters({ ...filters, query })}
        />
      </div>
      {!shown ? (
        <Loading />
      ) : !shown.length ? (
        <p className="empty">No Pokémon match.</p>
      ) : (
        <ul className="dex-grid" aria-label="Pokémon, tap to select">
          {shown.map(({ id, name }) => (
            <PickCell key={id} id={id} name={name} on={selected.has(id)} onTap={toggle} />
          ))}
        </ul>
      )}
      <button className="fab" aria-label={active ? `Filter, ${active} active` : 'Filter'} onClick={() => setSheetOpen(true)}>
        <Icon name="filter" size={24} />
        <CountBadge count={active} held={sheetOpen} />
      </button>
      {sheetOpen && rows && (
        <FilterSheet
          value={filters}
          countFor={(f) => applyFilters(rows, fuse, f, undefined, favourites).length}
          onChange={setFilters}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}

/** A picker cell in the tracker's look: seen when not picked, caught with a check when picked. */
const PickCell = memo(function PickCell({ id, name, on, onTap }: { id: number; name: string; on: boolean; onTap: (id: number) => void }) {
  return (
    <li>
      <button className={`dex-cell ${on ? 's2' : 's1'}`} aria-pressed={on} aria-label={`${formatNo(id)} ${name}`} onClick={() => onTap(id)}>
        <MonImg id={id} alt="" loading="lazy" width={72} height={72} />
        <span className="no">{name}</span>
        {on && (
          <span className="badge">
            <Icon name="check" size={16} />
          </span>
        )}
      </button>
    </li>
  );
});
