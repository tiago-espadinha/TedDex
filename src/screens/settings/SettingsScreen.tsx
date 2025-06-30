import { useEffect, useRef, useState } from 'react';
import { BackupError, exportBackup, importBackup } from '../../data/db';
import { FORM_KIND_EXAMPLES, FORM_KIND_LABELS } from '../../data/dexState';
import { applyDesign, applyTheme, useDesign, useDexForms, useTheme, type Theme } from '../../data/settings';
import type { FormKind } from '../../data/types';
import { Icon } from '../../components/Icon/Icon';
import { MonImg } from '../../components/MonImg/MonImg';
import { Segmented } from '../../components/Segmented/Segmented';
import { useToast } from '../../hooks/useToast';
import { ArtStyleTiles } from './ArtStyleTiles';
import './SettingsScreen.css';

export function SettingsScreen() {
  const [design, setDesign] = useDesign();
  const [theme, setTheme] = useTheme();
  const [formKinds, setFormKinds] = useDexForms();
  const [dataVersion, setDataVersion] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => applyDesign(design), [design]);
  useEffect(() => applyTheme(theme), [theme]);
  useEffect(() => {
    fetch('/data/meta.json')
      .then((r) => r.json())
      .then((m: { version: string; species: number }) => setDataVersion(`${m.version} · ${m.species} species`))
      .catch(() => {});
  }, []);

  async function doExport() {
    const blob = new Blob([await exportBackup()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `teddex-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function doImport(file: File) {
    try {
      const { teams, pokedexes, favourites } = await importBackup(await file.text());
      const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;
      const parts = [
        plural(teams, 'team'),
        ...(pokedexes ? [plural(pokedexes, 'Pokédex')] : []),
        ...(favourites ? [plural(favourites, 'favourite')] : []),
      ];
      toast({ text: `Imported ${parts.slice(0, -1).join(', ')}${parts.length > 1 ? ' and ' : ''}${parts.at(-1)}` });
    } catch (err) {
      toast({ text: err instanceof BackupError ? err.message : "Couldn't import that file" });
    }
  }

  return (
    <div className="placeholder">
      <h1>Settings</h1>

      <div className="section" style={{ padding: 0 }}>
        <h2>Design</h2>
        <Segmented aria-label="Design">
          <button role="radio" aria-checked={design === 'a'} onClick={() => setDesign('a')}>
            A: Material
          </button>
          <button role="radio" aria-checked={design === 'b'} onClick={() => setDesign('b')}>
            B: Dark
          </button>
        </Segmented>

        <h2 style={{ marginTop: 22 }}>Theme</h2>
        {design === 'b' && (
          <p id="theme-hint" className="hint" style={{ marginBottom: 10 }}>
            Design B is dark only. Switch to Design A to choose a theme.
          </p>
        )}
        <Segmented aria-label="Theme" aria-describedby={design === 'b' ? 'theme-hint' : undefined}>
          {(['system', 'light', 'dark'] as Theme[]).map((t) => (
            <button
              key={t}
              role="radio"
              aria-checked={theme === t}
              disabled={design === 'b'}
              onClick={() => setTheme(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </Segmented>

        <h2 style={{ marginTop: 22 }} id="art-style-head">
          Dex images
        </h2>
        <ArtStyleTiles />

        <h2 style={{ marginTop: 22 }} id="forms-head">
          Forms in the Dex
        </h2>
        <p id="forms-hint" className="hint">
          Show these forms as their own rows, right after their species.
        </p>
        <div className="form-tiles" role="group" aria-labelledby="forms-head" aria-describedby="forms-hint">
          {(Object.entries(FORM_KIND_LABELS) as [FormKind, string][]).map(([kind, label]) => {
            const on = formKinds.includes(kind);
            return (
              <button
                key={kind}
                type="button"
                className="form-tile"
                role="switch"
                aria-checked={on}
                onClick={() => setFormKinds(on ? formKinds.filter((k) => k !== kind) : [...formKinds, kind])}
              >
                <span className="tick" aria-hidden="true">
                  {on && <Icon name="check" size={14} />}
                </span>
                <MonImg {...FORM_KIND_EXAMPLES[kind]} alt="" width={64} height={64} />
                {label}
              </button>
            );
          })}
        </div>

        <h2 style={{ marginTop: 22 }}>Backup</h2>
        <p className="hint" style={{ marginBottom: 10 }}>
          Teams, Pokédexes and favourites are stored only on this device. Export a backup, or move them to another
          device.
        </p>
        <div className="add-grid">
          <button className="add-slot" style={{ borderStyle: 'solid' }} onClick={doExport}>
            Export
          </button>
          <button className="add-slot" style={{ borderStyle: 'solid' }} onClick={() => fileInput.current?.click()}>
            Import
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) doImport(f);
            e.target.value = '';
          }}
        />

        <h2 style={{ marginTop: 22 }}>About</h2>
        <p className="hint" style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.5 }}>
          TedDex is an unofficial, non-commercial fan project. Pokémon names, images and sounds are © Nintendo, Game
          Freak and The Pokémon Company. Data from PokeAPI; Elite Four, Champion and Gym Leader teams, where to find
          items and other ways to get a Pokémon from{' '}
          <a href="https://bulbapedia.bulbagarden.net/" target="_blank" rel="noreferrer">
            Bulbapedia<span className="sr-only"> (opens in a new tab)</span>
          </a>{' '}
          (CC BY-NC-SA 2.5); trainer sprites and Pokédex art from{' '}
          <a href="https://archives.bulbagarden.net/" target="_blank" rel="noreferrer">
            Bulbagarden Archives<span className="sr-only"> (opens in a new tab)</span>
          </a>
          .
          {dataVersion && (
            <>
              <br />
              Data {dataVersion}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
