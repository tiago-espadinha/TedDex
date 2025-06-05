import { useId, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { itemSpriteUrl, loadAbilities, loadItemReference, loadMoveReference, loadMoves, useLoad } from '../data/api';
import { roman } from '../data/format';
import { parsePeek, peekPage, peekValue, type Peek } from '../data/peek';
import { Icon } from '../components/Icon';
import { Loading, useModalSheet } from '../components/bits';
import { ItemFacts, MoveFacts } from './ReferenceScreens';

/** The sheet for `?peek=`, wherever it is set; rendered once by the app shell. */
export function QuickView() {
  const [params, setParams] = useSearchParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const peek = parsePeek(params.get('peek'));
  if (!peek) return null;
  // Opened in the app: step back off its history entry. Opened from a link: drop the param.
  const onClose = () =>
    (state as { peek?: boolean } | null)?.peek
      ? navigate(-1)
      : setParams(
          (p) => {
            p.delete('peek');
            return p;
          },
          { replace: true, preventScrollReset: true },
        );
  return <PeekSheet key={peekValue(peek)} peek={peek} onClose={onClose} />;
}

const SUMMARIES = { move: MoveSummary, ability: AbilitySummary, item: ItemSummary };

function PeekSheet({ peek, onClose }: { peek: Peek; onClose: () => void }) {
  const [sheet, close] = useModalSheet<HTMLElement>(onClose);
  const titleId = useId();
  const Summary = SUMMARIES[peek.kind];
  return (
    <>
      <div className="scrim" onClick={() => close()} />
      <section ref={sheet} tabIndex={-1} className="sheet peek" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="handle" />
        <Summary id={peek.id} titleId={titleId} close={() => close()} page={peekPage(peek)} />
      </section>
    </>
  );
}

interface SummaryProps {
  id: number;
  titleId: string;
  close: () => void;
  /** The Guide page, for "See Details". */
  page: string;
}

interface FrameProps extends SummaryProps {
  one: string;
  name?: string;
  error?: Error;
  loaded: boolean;
  /** Shown under the title, once loaded. */
  head?: ReactNode;
  /** Picture beside the title (item sprites), once loaded. */
  art?: ReactNode;
  /** The short effect. */
  text?: string;
}

/** Title and close, then the summary once loaded and "See Details"; the same states as the Guide pages. */
function PeekFrame({ titleId, close, page, one, name, error, loaded, head, art, text }: FrameProps) {
  let body: ReactNode = <p className="flavor">{text?.split('\n\n')[0] || 'No description in the data yet.'}</p>;
  if (error) body = <p className="empty">Couldn't load this {one.toLowerCase()}. {error.message}</p>;
  else if (!loaded) body = <Loading minHeight={120} />;
  else if (!name) body = <p className="empty">This {one.toLowerCase()} isn't in the data.</p>;
  return (
    <>
      <div className="peek-head">
        {name && art}
        <div className="grow">
          <h2 id={titleId}>{name ?? one}</h2>
          {name && <div className="sub">{one}</div>}
        </div>
        <button className="icon-btn" aria-label="Close" onClick={close}>
          <Icon name="close" />
        </button>
      </div>
      {name && head}
      {body}
      {name && (
        <Link className="primary-btn" to={page} replace>
          See Details
        </Link>
      )}
    </>
  );
}

function MoveSummary(props: SummaryProps) {
  const { id } = props;
  const { data, error } = useLoad(() => loadMoves().then(async (moves) => [moves[id], moves[id] && (await loadMoveReference(id))] as const), id);
  const [move, ref] = data ?? [];
  return (
    <PeekFrame
      {...props}
      one="Move"
      name={move?.name}
      error={error}
      loaded={!!data}
      head={move && <MoveFacts move={move} />}
      text={ref?.description || ref?.effect}
    />
  );
}

function AbilitySummary(props: SummaryProps) {
  const { data, error } = useLoad(loadAbilities, 'abilities');
  const ability = data?.[props.id];
  return (
    <PeekFrame
      {...props}
      one={ability ? `Ability · Gen ${roman(ability.gen)}` : 'Ability'}
      name={ability?.name}
      error={error}
      loaded={!!data}
      text={ability?.effect}
    />
  );
}

function ItemSummary(props: SummaryProps) {
  const { data, error } = useLoad(loadItemReference, 'items');
  const item = data?.[props.id];
  return (
    <PeekFrame
      {...props}
      one="Item"
      name={item?.name}
      error={error}
      loaded={!!data}
      head={item && <ItemFacts item={item} />}
      art={<img className="item-art" src={itemSpriteUrl(props.id)} alt="" width={40} height={40} />}
      text={item?.effect}
    />
  );
}
