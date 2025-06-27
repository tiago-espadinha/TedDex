import { itemSpriteUrl } from '../../data/api';
import type { TeamMember } from '../../data/db';
import type { MemberView } from '../../data/forms';
import { memberAbility } from '../../data/memberOptions';
import type { AbilityNameTable, ItemTable, MoveTable } from '../../data/types';
import { Fact, MonFacts, MonMoves } from '../../components/MonCard/MonCard';
import { usePeek } from '../../hooks/usePeek';

/**
 * What is set on a member under its head: ability in the left column and held item in the right (each column keeps
 * its place when the other is unset), then moves (the nature sits on the types row as a chip). Ability, item and moves open the quick view; the rest of the card is the editor link under them.
 */
export function MemberDetails({
  member: m,
  name,
  items,
  moves,
  abilities,
  own,
}: {
  member: TeamMember;
  name: string;
  /** The form's own abilities, when known; a same-named one (As One) then opens the form's. */
  own?: MemberView['abilities'];
  items?: ItemTable;
  moves?: MoveTable;
  abilities?: AbilityNameTable;
}) {
  const peek = usePeek();
  const item = m.item !== undefined && items?.[m.item] ? { id: m.item, name: items[m.item].name } : undefined;
  // A form's own abilities come with its species file; until then a name lookup could pick another form's (As One).
  const abilityId = m.formKey && !own ? undefined : memberAbility(own ?? [], m.ability, abilities)?.id;
  const chosen = moves && m.moves?.length ? m.moves : undefined;
  return (
    <>
      {(m.ability || item) && (
        <MonFacts>
          {m.ability && (
            <Fact k="Ability">
              {abilityId ? (
                <button className="league-chip" onClick={() => peek({ kind: 'ability', id: abilityId })}>
                  {m.ability}
                </button>
              ) : (
                <span className="league-chip">{m.ability}</span>
              )}
            </Fact>
          )}
          {item && (
            <Fact k="Item" className="item">
              <button className="league-chip" onClick={() => peek({ kind: 'item', id: item.id })}>
                <img src={itemSpriteUrl(item.id)} alt="" width={24} height={24} loading="lazy" />
                {item.name}
              </button>
            </Fact>
          )}
        </MonFacts>
      )}
      {chosen && moves && (
        <MonMoves name={name} moves={chosen} table={moves} onPeek={(id) => peek({ kind: 'move', id })} />
      )}
    </>
  );
}
