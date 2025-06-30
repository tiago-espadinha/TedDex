import { Link } from 'react-router-dom';

export function Missing({ to, link, text }: { to: string; link: string; text: string }) {
  return (
    <div className="empty" role="alert">
      <p>{text}</p>
      <Link to={to}>{link}</Link>
    </div>
  );
}
