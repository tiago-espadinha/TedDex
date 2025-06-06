import { useEffect, useRef, useState } from 'react';
import { loadVersions, useLoad } from '../data/api';
import { BackupError, exportBackup, importBackup } from '../data/db';
import { parseGamePref } from '../data/game';
import { FORM_KIND_LABELS } from '../data/dexState';
import { applyDesign, applyTheme, useDesign, useDexForms, useGame, useSpriteStyle, useTheme, type Theme } from '../data/settings';
import type { FormKind } from '../data/types';
import { Icon } from '../components/Icon';
import { useToast } from '../components/bits';

export function MoreScreen() {
  const [design, setDesign] = useDesign();
  const [theme, setTheme] = useTheme();
  const [sprite, setSprite] = useSpriteStyle();
  const [formKinds, setFormKinds] = useDexForms();
  const [game, setGame] = useGame();
  const versions = useLoad(loadVersions, 'versions').data;
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
      const { teams, pokedexes } = await importBackup(await file.text());
      const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;
      toast({ text: `Imported ${plural(teams, 'team')}${pokedexes ? ` and ${plural(pokedexes, 'Pokédex')}` : ''}` });
    } catch (err) {
      toast({ text: err instanceof BackupError ? err.message : "Couldn't import that file" });
    }
  }

  return (
    <div className="placeholder">
      <h1>Settings</h1>

      <div className="section" style={{ padding: 0 }}>
        <h2>Design</h2>
        <div className="segmented" role="radiogroup" aria-label="Design">
          <button role="radio" aria-checked={design === 'a'} onClick={() => setDesign('a')}>
            A: Material
          </button>
          <button role="radio" aria-checked={design === 'b'} onClick={() => setDesign('b')}>
            B: Dark
          </button>
        </div>

        <h2 style={{ marginTop: 22 }}>Theme</h2>
        {design === 'b' && (
          <p id="theme-hint" className="hint" style={{ marginBottom: 10 }}>
            Design B is dark only. Switch to Design A to choose a theme.
          </p>
        )}
        <div className="segmented" role="radiogroup" aria-label="Theme" aria-describedby={design === 'b' ? 'theme-hint' : undefined}>
          {(['system', 'light', 'dark'] as Theme[]).map((t) => (
            <button key={t} role="radio" aria-checked={theme === t} disabled={design === 'b'} onClick={() => setTheme(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <h2 style={{ marginTop: 22 }}>Dex images</h2>
        <div className="segmented" role="radiogroup" aria-label="Dex images">
          <button role="radio" aria-checked={sprite === 'sprite'} onClick={() => setSprite('sprite')}>
            Sprites
          </button>
          <button role="radio" aria-checked={sprite === 'art'} onClick={() => setSprite('art')}>
            Artwork
          </button>
        </div>

        <h2 style={{ marginTop: 22 }} id="forms-head">
          Forms in the Dex
        </h2>
        <p id="forms-hint" className="hint">
          Show these forms as their own rows, right after their species.
        </p>
        <div className="switch-list" role="group" aria-labelledby="forms-head" aria-describedby="forms-hint">
          {(Object.entries(FORM_KIND_LABELS) as [FormKind, string][]).map(([kind, label]) => {
            const on = formKinds.includes(kind);
            return (
              <button
                key={kind}
                type="button"
                className="switch-row"
                role="switch"
                aria-checked={on}
                onClick={() => setFormKinds(on ? formKinds.filter((k) => k !== kind) : [...formKinds, kind])}
              >
                {label}
                <span className="track" aria-hidden="true" />
              </button>
            );
          })}
        </div>

        <h2 style={{ marginTop: 22 }}>Game</h2>
        <p id="game-hint" className="hint" style={{ marginBottom: 10 }}>
          Moves and Locations open on this game. Latest shows each Pokémon's newest game.
        </p>
        <label className="game-select" hidden={!versions}>
          <span className="sr-only">Game</span>
          <select
            value={game}
            aria-describedby="game-hint"
            onChange={(e) => setGame(parseGamePref(e.target.value))}
          >
            <option value="latest">Latest</option>
            {versions?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
          <Icon name="next" size={18} />
        </label>

        <h2 style={{ marginTop: 22 }}>Backup</h2>
        <p className="hint" style={{ marginBottom: 10 }}>
          Teams and Pokédexes are stored only on this device. Export a backup, or move them to another device.
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
        <p className="hint" style={{ fontSize: 13, lineHeight: 1.5 }}>
          TedDex is an unofficial, non-commercial fan project. Pokémon names, images and sounds are © Nintendo, Game Freak and
          The Pokémon Company. Data from PokeAPI; Elite Four, Champion and Gym Leader teams and where to find items from Bulbapedia (CC BY-NC-SA); trainer sprites from Bulbagarden Archives.
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
