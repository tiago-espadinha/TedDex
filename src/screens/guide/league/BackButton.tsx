import { useNavigate } from 'react-router-dom';
import { Icon } from '../../../components/Icon/Icon';

/** Back to where the user came from, or to `fallback` when the page was opened directly. */
export function BackButton({ fallback }: { fallback: string }) {
  const navigate = useNavigate();
  return (
    <button
      className="icon-btn"
      aria-label="Back"
      onClick={() => (history.length > 1 ? navigate(-1) : navigate(fallback))}
    >
      <Icon name="back" />
    </button>
  );
}
