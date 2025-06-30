import { itemSpriteUrl, loadIndex, loadItemPlaces, loadItemReference, useLoad } from '../../data/api';
import { EntryFrame, type EntryProps } from './EntryFrame';
import { ItemFacts } from './ItemFacts';
import { Effect } from './Effect';
import { WhereToFind } from './WhereToFind';

export function ItemEntry({ id, one }: EntryProps) {
  const n = Number(id);
  const { data, error } = useLoad(
    () =>
      Promise.all([loadItemReference(), loadIndex()]).then(
        async ([items, index]) => [items, index, items[n] && (await loadItemPlaces(n))] as const,
      ),
    n,
  );
  const item = data?.[0][n];
  return (
    <EntryFrame
      one={one}
      name={item?.name}
      error={error}
      loaded={!!data}
      head={item && <ItemFacts item={item} />}
      art={<img className="item-art" src={itemSpriteUrl(id)} alt="" width={64} height={64} />}
    >
      {item && data && (
        <>
          <Effect text={item.effect} />
          <WhereToFind places={data[2]} index={data[1]} />
        </>
      )}
    </EntryFrame>
  );
}
