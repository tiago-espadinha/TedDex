import { itemSpriteUrl } from '../../data/api';
import { formatPrice } from '../../data/format';
import { TypeChip } from '../../components/TypeChip/TypeChip';
import { MoveCells } from '../detail/MovesTab';
import type { Entry } from './guideEntries';

export function EntryBody({ entry: e }: { entry: Entry }) {
  if (e.move) return <MoveCells move={e.move} />;
  if (e.item) {
    return (
      <>
        <img className="item-sprite" src={itemSpriteUrl(e.id)} alt="" width={64} height={64} loading="lazy" />
        <span className="body">
          <span className="name">{e.name}</span>
          <span className="meta one-line">{e.item.effect || e.item.category}</span>
        </span>
        <span className="price">
          {e.item.cost ? (
            formatPrice(e.item.cost)
          ) : (
            <>
              <span aria-hidden="true">—</span>
              <span className="sr-only">Not sold</span>
            </>
          )}
        </span>
      </>
    );
  }
  if (e.type) {
    return (
      <span className="body">
        <span>
          <TypeChip type={e.type} large />
        </span>
      </span>
    );
  }
  return (
    <span className="body">
      <span className="name">{e.name}</span>
      {e.sub && <span className="meta one-line">{e.sub}</span>}
    </span>
  );
}
