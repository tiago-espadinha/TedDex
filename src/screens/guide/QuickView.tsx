import { useId, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { itemSpriteUrl, loadAbilities, loadItemReference, loadMoveReference, loadMoves, useLoad } from '../../data/api';
import { roman } from '../../data/format';
import { parsePeek, peekPage, peekValue, type Peek } from '../../data/peek';
import { Icon } from '../../components/Icon/Icon';
import { Loading } from '../../components/Loading/Loading';
import { useModalSheet } from '../../hooks/useModalSheet';
import { ItemFacts } from './ItemFacts';
import { MoveFacts } from './MoveFacts';
import './QuickView.css';

/** A button the opening screen adds to the sheet; the sheet closes as it runs. */
export interface PeekAction {
  label: string;
  /** The accessible name, which says what it acts on. */
  name: string;
  danger?: boolean;
  run: () => void;
}

/** The sheet for `?peek=`, wherever it is set; rendered once by the app shell, or by a screen that adds `actions`. */
export function QuickView({ actions }: { actions?: (peek: Peek) => PeekAction[] }) {
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
  return <PeekSheet key={peekValue(peek)} peek={peek} actions={actions?.(peek) ?? []} onClose={onClose} />;
}

const SUMMARIES = { move: MoveSummary, ability: AbilitySummary, item: ItemSummary };

function PeekSheet({ peek, actions, onClose }: { peek: Peek; actions: PeekAction[]; onClose: () => void }) {
  const [sheet, close] = useModalSheet<HTMLElement>(onClose);
  const titleId = useId();
  const Summary = SUMMARIES[peek.kind];
  return (
    <>
      <div className="scrim" onClick={() => close()} />
      <section
        ref={sheet}
        tabIndex={-1}
        className="sheet peek"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-morph={peekPage(peek)}
        data-morph-card
      >
        <div className="handle" />
        <Summary
          id={peek.id}
          titleId={titleId}
          close={() => close()}
          page={peekPage(peek)}
          actions={
            actions.length > 0 && (
              <div className="peek-actions">
                {actions.map((a) => (
                  <button
                    key={a.label}
                    className={a.danger ? 'primary-btn danger' : 'primary-btn'}
                    aria-label={a.name}
                    onClick={() =>
                      close(() => {
                        a.run();
                        onClose();
                      })
                    }
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )
          }
        />
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
  /** Stay available when the entry can't load, so an unknown item can still be removed. */
  actions: ReactNode;
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
function PeekFrame({ titleId, close, page, actions, one, name, error, loaded, head, art, text }: FrameProps) {
  let body: ReactNode = <p className="flavor">{text?.split('\n\n')[0] || 'No description in the data yet.'}</p>;
  if (error)
    body = (
      <p className="empty">
        Couldn't load this {one.toLowerCase()}. {error.message}
      </p>
    );
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
      {actions}
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
  const { data, error } = useLoad(
    () => loadMoves().then(async (moves) => [moves[id], moves[id] && (await loadMoveReference(id))] as const),
    id,
  );
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
