import { Link } from 'react-router-dom';
import { itemSpriteUrl } from '../../../data/api';
import type { LeagueMember } from '../../../data/types';
import { TypeChip } from '../../../components/TypeChip/TypeChip';
import { Fact, MonFacts, MonHead, MonMoves } from '../../../components/MonCard/MonCard';
import { usePeek } from '../../../hooks/usePeek';
import { typeTint } from '../../../data/typeColors';
import { monOf, type Tables } from './leagueTables';

const battleFormLabel = (key: string) => (key === 'gmax' ? 'Gigantamaxes' : 'Mega Evolves');

/** A team member as a saved team's card: the head links to the species, ability, item and moves open the quick view. */
export function TrainerMon({ member: m, tables }: { member: LeagueMember; tables: Tables }) {
  const peek = usePeek();
  const { mediaId, name, types } = monOf(m, tables);
  const item =
    m.item !== undefined && tables.items[m.item] ? { id: m.item, name: tables.items[m.item].name } : undefined;
  const ability =
    m.ability !== undefined && tables.abilities[m.ability]
      ? { id: m.ability, name: tables.abilities[m.ability].name }
      : undefined;
  return (
    <li className="team-mon trainer-mon" style={{ backgroundColor: types[0] ? typeTint(types[0]) : 'var(--surface)' }}>
      <Link className="evo-member" to={`/pokemon/${m.id}${m.form ? `?form=${m.form}` : ''}`}>
        <MonHead
          spriteId={mediaId}
          speciesId={m.id}
          name={name}
          types={types}
          aside={<span className="lv">Lv {m.level}</span>}
        />
      </Link>
      {(ability || item || m.tera || m.battleForm) && (
        <MonFacts>
          {ability && (
            <Fact k="Ability">
              <button className="league-chip" onClick={() => peek({ kind: 'ability', id: ability.id })}>
                {ability.name}
              </button>
            </Fact>
          )}
          {item && (
            <Fact k="Item">
              <button className="league-chip" onClick={() => peek({ kind: 'item', id: item.id })}>
                <img src={itemSpriteUrl(item.id)} alt="" width={24} height={24} loading="lazy" />
                {item.name}
              </button>
            </Fact>
          )}
          {m.tera && (
            <Fact k="Tera">
              <TypeChip type={m.tera} />
            </Fact>
          )}
          {m.battleForm && <Fact k="In battle">{battleFormLabel(m.battleForm)}</Fact>}
        </MonFacts>
      )}
      {m.moves.length > 0 && (
        <MonMoves name={name} moves={m.moves} table={tables.moves} onPeek={(id) => peek({ kind: 'move', id })} />
      )}
    </li>
  );
}
