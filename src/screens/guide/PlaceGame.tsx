import { Link } from 'react-router-dom';
import { bandStyle } from '../../data/gameColors';
import type { IndexEntry, ItemPlaceGame } from '../../data/types';
import { MonImg } from '../../components/MonImg/MonImg';

export function PlaceGame({ place, byId }: { place: ItemPlaceGame; byId: Map<number, IndexEntry> }) {
  const ways: [string, string][] = [
    ...(place.once ?? []).map((text): [string, string] => ['One time', text]),
    ...(place.repeat ?? []).map((text): [string, string] => ['Repeatable', text]),
  ];
  return (
    <div className="move-group place-game game-band" style={bandStyle(place.game)}>
      <h3>{place.game}</h3>
      {place.note?.map((text, i) => (
        <p key={i} className="flavor">
          {text}
        </p>
      ))}
      {(place.held || ways.length > 0) && (
        <ul>
          {place.held && (
            <li className="move-row place-row">
              <span className="body">
                <span className="meta">
                  <span>Held by wild Pokémon</span>
                </span>
                <span className="held-chips">
                  {place.held.map(([id, rarity]) => {
                    const m = byId.get(id);
                    return (
                      m && (
                        <Link key={id} className="held-chip" to={`/pokemon/${id}`}>
                          <MonImg id={id} alt="" width={32} height={32} loading="lazy" />
                          {m.name} <span className="pct">{rarity}%</span>
                        </Link>
                      )
                    );
                  })}
                </span>
              </span>
            </li>
          )}
          {ways.map(([kind, text], i) => (
            <li key={i} className="move-row place-row">
              <span className="body">
                <span className="meta">
                  <span>{kind}</span>
                </span>
                <span className="name">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
