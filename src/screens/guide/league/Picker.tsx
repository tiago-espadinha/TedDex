import { useId } from 'react';
import { Segmented } from '../../../components/Segmented/Segmented';

/** "If you chose Bulbasaur", "If you chose Squirtle" → prefix "If you chose", options "Bulbasaur", "Squirtle". */
function splitLabels(labels: string[]): { prefix: string; options: string[] } {
  const words = labels.map((l) => l.split(' '));
  let n = 0;
  while (words.every((w) => n < w.length - 1 && w[n] === words[0][n])) n++;
  // "(before Stark Mountain)" → "Before Stark Mountain".
  const option = (w: string[]) =>
    w
      .slice(n)
      .join(' ')
      .replace(/^\((.*)\)$/, '$1')
      .replace(/^./, (c) => c.toUpperCase());
  return { prefix: words[0].slice(0, n).join(' '), options: words.map(option) };
}

/** A labelled row of radio buttons; `labels` share their leading words, which become the heading. */
export function Picker({
  labels,
  fallback,
  pick,
  onPick,
  labelledBy,
}: {
  labels: string[];
  /** Heading when the labels share no leading words. */
  fallback: string;
  pick: number;
  onPick: (i: number) => void;
  labelledBy: string;
}) {
  const { prefix, options } = splitLabels(labels);
  const id = useId();
  return (
    <>
      <div className="league-pick-label" id={id}>
        {prefix || fallback}
      </div>
      <Segmented className="league-pick" aria-labelledby={`${labelledBy} ${id}`}>
        {options.map((o, i) => (
          <button key={i} role="radio" aria-checked={i === pick} onClick={() => onPick(i)}>
            {o}
          </button>
        ))}
      </Segmented>
    </>
  );
}
