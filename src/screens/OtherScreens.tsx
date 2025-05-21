import { useEffect, useRef, useState } from 'react';
import { BackupError, exportTeams, importTeams } from '../data/db';
import { applyTheme, useSpriteStyle, useTheme, type Theme } from '../data/settings';
import { useToast } from '../components/bits';

export function MoreScreen() {
  const [theme, setTheme] = useTheme();
  const [sprite, setSprite] = useSpriteStyle();
  const [dataVersion, setDataVersion] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => applyTheme(theme), [theme]);
  useEffect(() => {
    fetch('/data/meta.json')
      .then((r) => r.json())
      .then((m: { version: string; species: number }) => setDataVersion(`${m.version} · ${m.species} species`))
      .catch(() => {});
  }, []);

  async function doExport() {
    const blob = new Blob([await exportTeams()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `material-dex-teams-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function doImport(file: File) {
    try {
      const n = await importTeams(await file.text());
      toast({ text: `Imported ${n} team${n === 1 ? '' : 's'}` });
    } catch (err) {
      toast({ text: err instanceof BackupError ? err.message : "Couldn't import that file" });
    }
  }

  return (
    <div className="placeholder">
      <h1>More</h1>

      <div className="section" style={{ padding: 0 }}>
        <h2>Theme</h2>
        <div className="segmented" role="radiogroup" aria-label="Theme">
          {(['system', 'light', 'dark'] as Theme[]).map((t) => (
            <button key={t} role="radio" aria-checked={theme === t} onClick={() => setTheme(t)}>
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

        <h2 style={{ marginTop: 22 }}>Team backup</h2>
        <p className="hint" style={{ marginBottom: 10 }}>
          Teams are stored only on this device. Export a backup, or move them to another device.
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
          An unofficial, non-commercial fan project. Pokémon names, images and sounds are © Nintendo, Game Freak and
          The Pokémon Company. Data from PokeAPI; Elite Four and Champion teams from Bulbapedia (CC BY-NC-SA).
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
