import { trainerSpriteUrl } from '../../../data/api';
import { Icon } from '../../../components/Icon/Icon';
import './TrainerSprite.css';

export function TrainerSprite({ sprite }: { sprite?: string }) {
  return sprite ? (
    <img className="trainer-sprite" src={trainerSpriteUrl(sprite)} alt="" width={72} height={72} loading="lazy" />
  ) : (
    <span className="trainer-sprite placeholder" aria-hidden="true">
      <Icon name="person" size={32} />
    </span>
  );
}
