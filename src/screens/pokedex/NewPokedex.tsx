import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadPokedexes, loadVersions, useLoad } from '../../data/api';
import { createPokedex } from '../../data/db';
import { bandStyle } from '../../data/gameColors';
import { gameDexes, lastSpecies } from '../../data/pokedex';
import { Icon } from '../../components/Icon/Icon';
import { Loading } from '../../components/Loading/Loading';
import { DexArt } from './DexArt';

/**
 * The national dex, custom, then every game with its regional dex sizes; a pick creates the Pokédex and opens it.
 * Custom opens the species picker in this screen's place, so the new Pokédex replaces it in turn.
 */
export function NewPokedex() {
  const { data: versions } = useLoad(loadVersions, 'versions');
  const { data: regional } = useLoad(loadPokedexes, 'pokedexes');
  const navigate = useNavigate();
  // A second tap while the first Pokédex is being saved would create another.
  const [busy, setBusy] = useState(false);
  const create = async (game?: number) => {
    setBusy(true);
    navigate(`/teams/pokedex/${await createPokedex(game)}`, { replace: true });
  };

  return (
    <>
      <header className="topbar">
        <Link to="/teams/pokedex" className="icon-btn" aria-label="Back to Pokédex">
          <Icon name="back" />
        </Link>
        <div className="grow">
          <h1>New Pokédex</h1>
          <div className="sub">Pick a game</div>
        </div>
      </header>
      {!versions || !regional ? (
        <Loading />
      ) : (
        <ul className="list dex-games">
          <li>
            <button className="team-row dex-row" disabled={busy} onClick={() => create()}>
              <DexArt />
              <span className="head">
                <span className="name">National</span>
                <span className="meta">{lastSpecies()} Pokémon, every game</span>
              </span>
            </button>
          </li>
          <li>
            <Link className="team-row dex-row" to="/teams/pokedex/new/custom" replace>
              <DexArt />
              <span className="head">
                <span className="name">Custom</span>
                <span className="meta">Pick any Pokémon</span>
              </span>
            </Link>
          </li>
          {versions.map((v) => {
            const dexes = gameDexes(regional, v.id);
            return (
              <li key={v.id}>
                <button
                  className="team-row dex-row game-band"
                  style={bandStyle(v.label)}
                  disabled={busy}
                  aria-label={`${v.label}: ${dexes.map((d) => `${d.name} ${d.species.length}`).join(', ')}`}
                  onClick={() => create(v.id)}
                >
                  <DexArt game={v.id} />
                  <span className="head">
                    <span className="name">{v.label}</span>
                    <span className="meta">{dexes.map((d) => d.species.length).join(' · ')}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
