import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon/Icon';

/** Topbar for the table pages: back to Reference, title and a subtitle. */
export function TableHead({ title, sub }: { title: string; sub: string }) {
  return (
    <header className="topbar">
      <Link to="/reference" className="icon-btn" aria-label="Back to Guide">
        <Icon name="back" />
      </Link>
      <div className="grow">
        <h1>{title}</h1>
        <div className="sub">{sub}</div>
      </div>
    </header>
  );
}
