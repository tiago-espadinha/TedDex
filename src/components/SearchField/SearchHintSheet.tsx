import { useId } from 'react';
import { SEARCH_HINTS, SEARCH_OPERATORS, type HintList } from '../../data/searchHints';
import { Icon } from '../Icon/Icon';
import { useModalSheet } from '../../hooks/useModalSheet';

/** What a list's search takes: the operators, its keywords and examples that work there. */
export function SearchHintSheet({ list, onClose }: { list: HintList; onClose: () => void }) {
  const [sheet, close] = useModalSheet<HTMLElement>(onClose);
  const titleId = useId();
  const { keywords, examples } = SEARCH_HINTS[list];
  return (
    <>
      <div className="scrim" onClick={() => close()} />
      <section
        ref={sheet}
        tabIndex={-1}
        className="sheet hint-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="handle" />
        <div className="sheet-head">
          <h2 id={titleId}>Search tips</h2>
          <button className="icon-btn" aria-label="Close" onClick={() => close()}>
            <Icon name="close" />
          </button>
        </div>
        <h3>Operators</h3>
        <dl className="hint-ops">
          {SEARCH_OPERATORS.map((o) => (
            <div key={o.sign}>
              <dt>
                <code>{o.sign}</code>
              </dt>
              <dd>{o.meaning}</dd>
            </div>
          ))}
        </dl>
        <p className="hint">A space stays part of the name, so combine with &amp;.</p>
        <h3>Keywords</h3>
        <dl className="hint-words">
          {keywords.map((k) => (
            <div key={k.label}>
              <dt>{k.label}</dt>
              <dd>
                {k.words.map((w) => (
                  <code key={w}>{w}</code>
                ))}
                {k.note && <span>{k.note}</span>}
              </dd>
            </div>
          ))}
        </dl>
        <p className="hint">Any other word searches the names.</p>
        <h3>Examples</h3>
        <dl className="hint-examples">
          {examples.map((e) => (
            <div key={e.query}>
              <dt>
                <code>{e.query}</code>
              </dt>
              <dd>{e.meaning}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
