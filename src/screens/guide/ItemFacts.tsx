import { formatPrice, roman } from '../../data/format';
import type { ItemInfo } from '../../data/types';
import { Facts } from './Facts';

/** An item's header facts, on its page and in the quick view. */
export function ItemFacts({ item }: { item: ItemInfo }) {
  return (
    <Facts
      facts={[
        ['Category', item.category],
        ['Introduced', `Gen ${roman(item.gen)}`],
        ['Price', item.cost ? formatPrice(item.cost) : 'Not sold'],
      ]}
    />
  );
}
