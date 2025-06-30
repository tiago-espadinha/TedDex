import { useMemo } from 'react';
import { loadIndex, loadSpecies, useLoad } from '../../data/api';
import type { TeamMember } from '../../data/db';
import { memberView } from '../../data/forms';

/**
 * Resolves members to how their slot looks, loading the species file of each member that has a form.
 * `view` is undefined until the grid index loads; until the species files load (`formsReady`), or if
 * any fails to load, members with a form show their default form.
 */
export function useMemberViews(members: TeamMember[] = []) {
  const { data: index } = useLoad(loadIndex, 'index');
  const rows = useMemo(() => new Map((index ?? []).map((m) => [m.id, m])), [index]);
  const formed = [...new Set(members.filter((m) => m.formKey).map((m) => m.speciesId))].sort((a, b) => a - b);
  const { data: details, error } = useLoad(() => Promise.all(formed.map(loadSpecies)), formed.join());
  if (!index) return {};
  const species = new Map((details ?? []).map((d) => [d.id, d]));
  const view = (m: TeamMember) => memberView(m, rows.get(m.speciesId), species.get(m.speciesId));
  return { view, formsReady: !!details || !!error };
}
