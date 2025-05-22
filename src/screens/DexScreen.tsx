import Fuse from 'fuse.js';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { artworkUrl, loadIndex, spriteUrl, useLoad } from '../data/api';
import { cap, formatNo, roman } from '../data/format';
import { addToTeam, db } from '../data/db';
import { saveOrder, useDexFilters } from '../data/dexState';
import { typeTint } from '../data/typeColors';
import type { IndexEntry } from '../data/types';
import { applyFilters } from '../data/filter';
import { Icon } from '../components/Icon';
import { Loading, TypeChip, useToast } from '../components/bits';
import { FilterSheet } from './FilterSheet';
import { useSpriteStyle } from '../data/settings';

const ROW_H = 118; // card 108 + gap 10

function useColumns() {
  const get = () => (window.innerWidth >= 600 ? 3 : 2);
  const [cols, setCols] = useState(get);
  useEffect(() => {
    const on = () => setCols(get());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return cols;
}

export function DexScreen() {
  const { data: all, error } = useLoad(loadIndex, 'index');
  const [filters, setFilters] = useDexFilters();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [params] = useSearchParams();
  const pickTeam = params.get('pick') ? Number(params.get('pick')) : null;
  const navigate = useNavigate();
  const toast = useToast();
  const cols = useColumns();
  const [spriteStyle, setSpriteStyle] = useSpriteStyle();

  const fuse = useMemo(() => (all ? new Fuse(all, { keys: ['name'], threshold: 0.3, ignoreLocation: true }) : null), [all]);
  const list = useMemo(() => (all ? applyFilters(all, fuse, filters) : []), [all, fuse, filters]);
  useEffect(() => saveOrder(list.map((m) => m.id)), [list]);

  const rows = Math.ceil(list.length / cols);
  const virtual = useWindowVirtualizer({ count: rows, estimateSize: () => ROW_H, overscan: 4 });

  const activeCount = filters.gens.length + filters.types.length + (filters.sort !== 'number' ? 1 : 0);

  async function pick(id: number) {
    if (pickTeam == null) return;
    const ok = await addToTeam(pickTeam, id);
    const team = await db.teams.get(pickTeam);
    if (!ok) toast({ text: 'That team is already full' });
    navigate(`/teams/${pickTeam}`, { replace: true });
    if (ok && team) toast({ text: `Added to ${team.name}` });
  }

  const genLabel = filters.gens.length ? `Gen ${filters.gens.map(roman).join(', ')}` : 'All gens';
  const typeLabel = filters.types.length ? filters.types.map(cap).join(' / ') : 'All types';
  const sortLabel = { number: 'Number', name: 'Name', total: 'Base total' }[filters.sort];

  return (
    <>
      <header className="dex-head">
        <h1>{pickTeam != null ? 'Pick a Pokémon' : 'Dex'}</h1>
        <div>
          <button
            className="icon-btn"
            aria-label={spriteStyle === 'sprite' ? 'Show artwork' : 'Show sprites'}
            onClick={() => setSpriteStyle(spriteStyle === 'sprite' ? 'art' : 'sprite')}
          >
            <Icon name="grid" />
          </button>
        </div>
      </header>

      <label className="search">
        <Icon name="search" size={20} />
        <span className="sr-only">Search</span>
        <input
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder="Search name, number or type"
          value={filters.query}
          onChange={(e) => setFilters({ ...filters, query: e.target.value })}
        />
        {filters.query && (
          <button className="icon-btn" style={{ width: 32, height: 32 }} aria-label="Clear search" onClick={() => setFilters({ ...filters, query: '' })}>
            <Icon name="close" size={18} />
          </button>
        )}
      </label>

      <div className="chip-row">
        <button className={`filter-chip ${filters.gens.length ? 'on' : ''}`} onClick={() => setSheetOpen(true)}>
          {genLabel}
        </button>
        <button className={`filter-chip ${filters.types.length ? 'on' : ''}`} onClick={() => setSheetOpen(true)}>
          {typeLabel}
        </button>
        <button className={`filter-chip ${filters.sort !== 'number' ? 'on' : ''}`} onClick={() => setSheetOpen(true)}>
          Sort: {sortLabel}
        </button>
      </div>

      {pickTeam != null && (
        <div className="pick-banner">
          Tap a Pokémon to add it
          <button onClick={() => navigate(`/teams/${pickTeam}`, { replace: true })}>Cancel</button>
        </div>
      )}

      {error && <p className="empty">Couldn't load the dex data. {error.message}</p>}
      {!all && !error && <Loading />}
      {all && list.length === 0 && <p className="empty">No Pokémon match these filters.</p>}

      <div className="dex-list" style={{ height: virtual.getTotalSize(), position: 'relative' }}>
        {virtual.getVirtualItems().map((row) => {
          const items = list.slice(row.index * cols, row.index * cols + cols);
          return (
            <div
              key={row.key}
              className="grid-row"
              style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${row.start}px)` }}
            >
              {items.map((m) => (
                <MonCard key={m.id} mon={m} art={spriteStyle === 'art'} onPick={pickTeam != null ? () => pick(m.id) : undefined} />
              ))}
            </div>
          );
        })}
      </div>

      <button
        className="fab"
        aria-label={activeCount ? `Filter and sort, ${activeCount} active` : 'Filter and sort'}
        onClick={() => setSheetOpen(true)}
      >
        <Icon name="filter" size={24} />
        {activeCount > 0 && (
          <span className="badge" aria-hidden="true">
            {activeCount}
          </span>
        )}
      </button>

      {sheetOpen && (
        <FilterSheet
          value={filters}
          countFor={(f) => (all ? applyFilters(all, fuse, f).length : 0)}
          onApply={(f) => {
            setFilters(f);
            setSheetOpen(false);
            window.scrollTo({ top: 0 });
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}

function MonCard({ mon, art, onPick }: { mon: IndexEntry; art: boolean; onPick?: () => void }) {
  const body = (
    <>
      <div className="no">{formatNo(mon.id)}</div>
      <div className="name">{mon.name}</div>
      <div className="types">
        {mon.types.map((t) => (
          <TypeChip key={t} type={t} />
        ))}
      </div>
      <img
        src={art ? artworkUrl(mon.id) : spriteUrl(mon.id)}
        onError={(e) => {
          // Artwork that was never viewed isn't cached offline: show the precached sprite instead.
          const sprite = spriteUrl(mon.id);
          if (!e.currentTarget.src.endsWith(sprite)) e.currentTarget.src = sprite;
        }}
        alt=""
        loading="lazy"
        decoding="async"
        width={84}
        height={84}
      />
    </>
  );
  const style = { backgroundColor: typeTint(mon.types[0]) };
  const cls = `mon-card ${art ? 'sprite-art' : ''}`;
  if (onPick)
    return (
      <button className={cls} style={{ ...style, border: 0, textAlign: 'left', font: 'inherit', width: '100%' }} onClick={onPick}>
        {body}
      </button>
    );
  return (
    <Link to={`/pokemon/${mon.id}`} className={cls} style={style}>
      {body}
    </Link>
  );
}
