/** Effect text; the data keeps paragraphs apart with a blank line. */
export function Effect({ text, title = 'Effect' }: { text: string; title?: string }) {
  return (
    <div className="section">
      <h2>{title}</h2>
      {text ? (
        text.split('\n\n').map((para, i) => (
          <p className="flavor" key={i}>
            {para}
          </p>
        ))
      ) : (
        <p className="flavor">No description in the data yet.</p>
      )}
    </div>
  );
}
