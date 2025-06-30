import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { typeTint } from '../../data/typeColors';
import type { TypeName } from '../../data/types';
import { Icon } from '../../components/Icon/Icon';
import { Loading } from '../../components/Loading/Loading';

export interface EntryProps {
  id: string;
  one: string;
}

interface FrameProps {
  one: string;
  name?: string;
  error?: Error;
  loaded: boolean;
  /** Tints the header with this type, like the detail hero. */
  tint?: TypeName;
  /** Shown in the header under the title, once loaded. */
  head?: ReactNode;
  /** Picture at the end of the header (item sprites), once loaded. */
  art?: ReactNode;
  /** The list above has no rows to morph from (the type chart). */
  noMorph?: boolean;
  children?: ReactNode;
}

/** Topbar, then the body once loaded; the same loading, error and not-found states for every kind. */
export function EntryFrame({ one, name, error, loaded, tint, head, art, noMorph, children }: FrameProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  let body = children;
  if (error)
    body = (
      <p className="empty">
        Couldn't load this {one.toLowerCase()}. {error.message}
      </p>
    );
  else if (!loaded) body = <Loading />;
  else if (!name) body = <p className="empty">This {one.toLowerCase()} isn't in the data.</p>;
  return (
    <>
      {/* A morph target only once loaded: until then the title is the placeholder. */}
      <header
        className={tint ? 'topbar tinted' : 'topbar'}
        style={tint && { backgroundColor: typeTint(tint) }}
        data-morph={name && !noMorph ? pathname : undefined}
      >
        <button
          className="icon-btn"
          aria-label="Back"
          onClick={() => (history.length > 1 ? navigate(-1) : navigate('/reference'))}
        >
          <Icon name="back" />
        </button>
        <div className="grow">
          <h1>{name ?? one}</h1>
          {name && <div className="sub">{one}</div>}
          {name && head}
        </div>
        {name && art}
      </header>
      {body}
    </>
  );
}
