import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseAvailability, regionalParents, withAvailability } from '../scripts/availability';
import { unpackLocations, type PackedLocations } from '../src/data/chunks';
import { REGIONAL_FORM } from '../src/data/forms';
import { encountersIn, encountersInGroup, locationsOfForm } from '../src/data/locations';
import type { EncounterRow, EvolutionMember, Game, IndexEntry, Locations, SpeciesDetail } from '../src/data/types';
import { dataEntry, readData } from './data-files';

const page = (...entries: string[]) =>
  ['===Game locations===', '{{Availability/Header|type=Fire}}', '{{Availability/Gen|gen=I}}', ...entries, '|}', '|}', '{{Availability/Footer}}'].join('\n');
const texts = (wiki: string, game: number) => parseAvailability(wiki)![game]?.map((l) => l.text);

describe('parseAvailability', () => {
  test('"Evolve X" reads "Evolve from X", in both games of an entry', () => {
    const wiki = page('{{Availability/Entry2|v=Red|v2=Blue|t2=FFF|area=[[Evolution|Evolve]] {{p|Charmeleon}}}}');
    assert.deepEqual(texts(wiki, 1), ['Evolve from Charmeleon']);
    assert.deepEqual(texts(wiki, 2), ['Evolve from Charmeleon']);
  });

  test('a blank entry means Trade, as the template defaults it', () => {
    assert.deepEqual(texts(page('{{Availability/Entry1/None|v=Emerald}}'), 9), ['Trade']);
  });

  test('links and templates read as text; patch notes, tooltips and icons go', () => {
    const wiki = page(
      '{{Availability/Entry1|v=Emerald|area={{pkmn|breeding|Breed}} {{p|Marill}} or {{p|Azumarill}} holding a [[Sea Incense]]}}',
      '{{Availability/Entry2/None|v=Ruby|v2=Sapphire|area=[[Trade]]<sup>Version 1.2.0+</sup>, [[#In events|Event]]}}',
      "{{Availability/Entry1|v=Crystal|area=[[Burned Tower]]{{tt|*|Only one}}&nbsp;[[File:Alpha icon.png|link=Alpha Pokémon|14px]]{{sup/t|N}}}}",
    );
    assert.deepEqual(texts(wiki, 9), ['Breed Marill or Azumarill holding a Sea Incense']);
    assert.deepEqual(texts(wiki, 7), ['Trade, Event']);
    assert.deepEqual(texts(wiki, 6), ['Burned Tower']);
  });

  test('each <br> is a line, its form tag read off', () => {
    const wiki = page(
      "{{Availability/Entry1|v=Sun|area=[[Hau'oli City]] <small>('''{{rf|Alolan|Alolan Form}}''')</small><br>[[Pokémon Bank]] <small>('''[[Kanto]]nian Form''')</small>}}",
    );
    assert.deepEqual(parseAvailability(wiki)![27], [
      { text: "Hau'oli City", forms: ['Alolan'] },
      { text: 'Pokémon Bank', forms: ['Kantonian'] },
    ]);
  });

  test('slashed and repeated tags name every form, and all leave the text', () => {
    const wiki = page(
      "{{Availability/Entry1|v=Scarlet|area=[[Evolution|Evolve]] {{p|Growlithe}} <small>('''Kantonian/Hisuian Forms''')</small>}}",
      "{{Availability/Entry1|v=Violet|area=Raids (1★ <small>('''Kantonian Form''')</small>, 3★ <small>('''Alolan Form''')</small>)}}",
    );
    assert.deepEqual(parseAvailability(wiki)![40], [{ text: 'Evolve from Growlithe', forms: ['Kantonian', 'Hisuian'] }]);
    assert.deepEqual(parseAvailability(wiki)![41][0].forms, ['Kantonian', 'Alolan']);
    assert.doesNotMatch(parseAvailability(wiki)![41][0].text, /Form/);
  });

  test("a form tag's breeds pick those forms", () => {
    const wiki = page("{{Availability/Entry1|v=Scarlet|area=Area Two <small>('''Paldean Form (Combat and Blaze Breeds)''')</small>}}");
    const [line] = parseAvailability(wiki)![40];
    assert.deepEqual(line, { text: 'Area Two', forms: ['Paldean'], breeds: ['Combat', 'Blaze'] });
    const out = withAvailability({ strings: [''], games: {} }, { 40: [line] }, ['', 'paldea-combat-breed', 'paldea-blaze-breed', 'paldea-aqua-breed']);
    assert.equal(locationsOfForm(out, 'paldea-combat-breed').games[40].length, 1);
    assert.equal(locationsOfForm(out, 'paldea-aqua-breed').games[40], undefined);
  });

  test('Unobtainable gives no entry; side games and Japanese copies are left out; DLC folds into its base games', () => {
    const wiki = page(
      '{{Availability/Entry1/None|v=Legends: Arceus|area=Unobtainable}}',
      '{{Availability/Entry1|v=Pal Park|link=Pal Park|area=Field}}',
      '{{Availability/Entry1|v=Blue|ex=(Japan)|area=[[Route 1]]}}',
      '{{Availability/Entry2|v=Sword|v2=Shield|area=[[Route 2]]}}',
      '{{Availability/Entry1|v=Expansion Pass|color=FFF|area=[[Fields of Honor]]}}',
    );
    assert.deepEqual(Object.keys(parseAvailability(wiki)!), ['33', '34']);
    assert.deepEqual(texts(wiki, 34), ['Route 2', 'Fields of Honor']);
  });

  test('only the main table counts, not the side games after it', () => {
    const wiki = `${page('{{Availability/Entry1|v=Red|area=Route 1}}')}\n====In side games====\n{{Availability/Header|type=Fire}}\n{{Availability/Entry1|v=Trozei!|area=Secret}}\n{{Availability/Footer}}`;
    assert.deepEqual(Object.keys(parseAvailability(wiki)!), ['1']);
  });

  test('throws on an unknown template, game or markup', () => {
    assert.throws(() => parseAvailability(page('{{Availability/Mystery|v=Red}}')), /Unknown template/);
    assert.throws(() => parseAvailability(page('{{Availability/Entry1|v=Gray|area=Route 1}}')), /Unknown game/);
    assert.throws(() => parseAvailability(page('{{Availability/Entry1|v=Red|area={{nosuch}}}}')), /Unknown template/);
    assert.throws(() => parseAvailability(page('stray text')), /Unexpected text/);
  });

  test('a page without the section gives null', () => {
    assert.equal(parseAvailability('==Trivia=='), null);
  });
});

describe('withAvailability', () => {
  const WILD: Locations = { strings: ['', 'Route 1', 'Grass', 'alola', 'Route 2'], games: { 27: [[4, 2, 3, 5, 30, 0, 0, 0, 3]], 1: [[1, 2, 3, 5, 30, 0, 0, 0]] } };
  const line = (text: string, ...forms: string[]) => ({ text, forms });

  test('PokeAPI rows win per game and form; text fills the gaps', () => {
    const out = withAvailability(WILD, { 1: [line('Gift')], 2: [line('Trade')], 27: [line('Route 2', 'Alolan'), line('Bank', 'Kantonian')] }, ['', 'alola']);
    assert.deepEqual(out.games[1], WILD.games[1]);
    assert.equal(out.strings[out.games[2][0][0]], 'Trade');
    assert.deepEqual(out.games[2][0].slice(1, 7), [0, 0, 0, 0, 0, 0]);
    const alola = locationsOfForm(out, 'alola').games[27];
    assert.deepEqual(alola, WILD.games[27]);
    assert.equal(out.strings[locationsOfForm(out, '').games[27][0][0]], 'Bank');
  });

  test('a regional line goes to every form of the region, and to a note when we ship none', () => {
    const out = withAvailability({ strings: [''], games: {} }, { 33: [line('Snowslide Slope', 'Galarian')] }, ['', 'galar-standard', 'galar-zen']);
    assert.equal(out.games[33].length, 2);
    assert.equal(locationsOfForm(out, 'galar-zen').games[33].length, 1);
    const none = withAvailability({ strings: [''], games: {} }, { 33: [line('Route 2', 'Galarian')] }, ['']);
    assert.equal(none.strings[none.games[33][0][7]], 'Galarian Form');
  });

  test('a home region reads as the species; other forms stay on its rows as a note', () => {
    const out = withAvailability({ strings: [''], games: {} }, { 40: [line('Route 3', 'Dusk'), line('Route 4', 'Kantonian')] }, ['', 'dusk']);
    const plain = locationsOfForm(out, '').games[40];
    assert.deepEqual(plain.map((row) => out.strings[row[7]]), ['Dusk Form', '']);
    assert.deepEqual(locationsOfForm(out, 'dusk').games[40], plain);
  });

  test('a line tagged with two forms gives a row to each', () => {
    const out = withAvailability({ strings: [''], games: {} }, { 40: [line('Evolve from Growlithe', 'Kantonian', 'Hisuian')] }, ['', 'hisui']);
    assert.equal(locationsOfForm(out, '').games[40].length, 1);
    assert.equal(locationsOfForm(out, 'hisui').games[40].length, 1);
  });

  describe('an untagged line and a regional form with no row in that game', () => {
    const area = (out: Locations, key: string, game: number) => locationsOfForm(out, key).games[game]?.map((row) => out.strings[row[0]]);

    test('the form gets the line; the species row stays', () => {
      const parents = { alola: { plain: 'Graveler', regional: 'Alolan Graveler' } };
      const out = withAvailability({ strings: [''], games: {} }, { 31: [line('Evolve from Graveler')] }, ['', 'alola'], { alola: [31] }, parents);
      assert.deepEqual(area(out, 'alola', 31), ['Evolve from Alolan Graveler']);
      assert.deepEqual(area(out, '', 31), ['Evolve from Graveler']);
    });

    test('other text carries over as it is, once for each line', () => {
      const out = withAvailability({ strings: [''], games: {} }, { 27: [line('Trade'), line('Pokémon Bank')] }, ['', 'alola'], { alola: [27] });
      assert.deepEqual(area(out, 'alola', 27), ['Trade', 'Pokémon Bank']);
    });

    test('not in a game the form is not in', () => {
      const out = withAvailability({ strings: [''], games: {} }, { 1: [line('Evolve from Graveler')] }, ['', 'alola'], { alola: [31] });
      assert.equal(area(out, 'alola', 1), undefined);
    });

    test('not when the form has a row of its own there, tagged or from PokeAPI', () => {
      const tagged = withAvailability({ strings: [''], games: {} }, { 27: [line('Bank'), line('Trade', 'Alolan')] }, ['', 'alola'], { alola: [27] });
      assert.deepEqual(area(tagged, 'alola', 27), ['Trade']);
      const wild = withAvailability(WILD, { 27: [line('Bank')] }, ['', 'alola'], { alola: [27] });
      assert.deepEqual(locationsOfForm(wild, 'alola').games[27], WILD.games[27]);
    });

    test('a non-regional form stays found as its species', () => {
      const out = withAvailability({ strings: [''], games: {} }, { 14: [line('Old Chateau')] }, ['', 'wash'], { wash: [14] });
      assert.equal(out.games[14].length, 1);
    });
  });

  describe('an evolve line and the form it comes from', () => {
    const NAMES: Record<number, string> = { 25: 'Pikachu', 75: 'Graveler', 52: 'Meowth' };
    const nameOf = (id: number) => NAMES[id];

    test('a form from a regional form names the region; one from the plain species does not', () => {
      const golem = [{ id: 76, from: 75, conditions: [], steps: [{ from: 'alola', into: 'alola', conditions: [] }] }];
      const raichu = [{ id: 26, from: 25, conditions: [], steps: [{ from: '', into: 'alola', conditions: [] }] }];
      assert.deepEqual(regionalParents(golem, 76, nameOf), { alola: { plain: 'Graveler', regional: 'Alolan Graveler' } });
      assert.deepEqual(regionalParents(raichu, 26, nameOf), {});
    });

    test('Kantonian Raticate reads plain Rattata while Alolan Raticate reads Alolan Rattata', () => {
      const raticate = [{ id: 20, from: 19, conditions: [], steps: [{ from: 'alola', into: 'alola', conditions: [] }] }];
      const parents = regionalParents(raticate, 20, () => 'Rattata');
      const out = withAvailability({ strings: [''], games: {} }, { 27: [line('Evolve from Rattata', 'Kantonian', 'Alolan')] }, ['', 'alola'], {}, parents);
      assert.equal(out.strings[locationsOfForm(out, '').games[27][0][0]], 'Evolve from Rattata');
      assert.equal(out.strings[locationsOfForm(out, 'alola').games[27][0][0]], 'Evolve from Alolan Rattata');
    });

    test('a species from a regional form names it and drops the form note', () => {
      const perrserker = [{ id: 863, from: 52, conditions: [], steps: [{ from: 'galar', into: '', conditions: [] }] }];
      const out = withAvailability({ strings: [''], games: {} }, { 40: [line('Evolve from Meowth', 'Galarian')] }, [''], {}, regionalParents(perrserker, 863, nameOf));
      const [row] = out.games[40];
      assert.deepEqual([out.strings[row[0]], out.strings[row[7]]], ['Evolve from Galarian Meowth', '']);
    });
  });

  test('a line on both a game and its DLC gives one row', () => {
    const out = withAvailability({ strings: [''], games: {} }, { 33: [line('Trade'), line('Route 1'), line('Trade')] }, ['']);
    assert.deepEqual(out.games[33].map((row) => out.strings[row[0]]), ['Trade', 'Route 1']);
  });

  test('the same line for two forms keeps a row for each', () => {
    const out = withAvailability({ strings: [''], games: {} }, { 33: [line('Trade', 'Kantonian', 'Galarian')] }, ['', 'galar']);
    assert.equal(out.games[33].length, 2);
  });

  test('identical PokeAPI rows read once', () => {
    const row: EncounterRow = [1, 2, 60, 60, 4, 0, 0, 0];
    const out = withAvailability({ strings: ['', 'Max Dens', 'Max Raid'], games: { 33: [row, row] } }, {}, ['']);
    assert.equal(out.games[33].length, 1);
  });

  test('running twice gives the same rows', () => {
    const lines = { 2: [line('Trade')] };
    const once = withAvailability(WILD, lines, ['']);
    assert.deepEqual(withAvailability(once, lines, ['']).games, once.games);
  });
});

describe('the built location chunks', () => {
  const locations = (id: number) => unpackLocations(readData<PackedLocations>(`locations/c${Math.floor(id / 64)}.json`), id)!;
  const areas = (id: number, game: number) => encountersIn(locations(id), game).map((e) => e.area);

  test("the owner's examples", () => {
    assert.deepEqual(areas(6, 1), ['Evolve from Charmeleon']); // Charizard in Red
    assert.deepEqual(areas(252, 1), []); // Treecko in Red
    assert.deepEqual(areas(48, 9), ['Trade']); // Venonat in Emerald
    assert.deepEqual(areas(298, 9), ['Breed Marill or Azumarill holding a Sea Incense']); // Azurill in Emerald
    assert.deepEqual(areas(249, 7), ['Trade, Event']); // Lugia in Ruby
  });

  test('Bulbasaur in Red keeps its PokeAPI gift row', () => {
    const [gift] = encountersIn(locations(1), 1);
    assert.deepEqual([gift.area, gift.method, gift.levels], ['Pallet Town', 'Gift', 'Lv. 5']);
  });

  test('games PokeAPI lacks are covered, and games that differ name their versions', () => {
    assert.ok(areas(298, 40).length > 0); // Azurill in Scarlet
    const games = readData<Game[]>('games.json');
    assert.ok(games.some((g) => g.id === 39 && g.group === 24));
    const blackWhite = games.filter((g) => g.group === 11);
    const rows = encountersInGroup(locations(298), blackWhite); // Azurill: Trade in Black, White Forest in White
    assert.ok(rows.some((r) => r.area === 'White Forest' && r.versions.join() === 'White'));
  });

  test('a form gets its own lines', () => {
    assert.ok(encountersIn(locationsOfForm(locations(479), 'wash'), 14).length > 0); // Wash Rotom is found as Rotom in Platinum
    assert.ok(encountersIn(locationsOfForm(locations(128), 'paldea-aqua-breed'), 40).length > 0);
    assert.ok(encountersIn(locationsOfForm(locations(59), 'hisui'), 40).some((e) => e.area === 'Evolve from Hisuian Growlithe')); // Hisuian Arcanine
    assert.ok(encountersIn(locationsOfForm(locations(74), 'alola'), 40).some((e) => e.area.startsWith('Tera Raid Battles'))); // Alolan Geodude
  });

  test('Alolan Golem in Let\'s Go evolves from Alolan Graveler; Golem keeps its row', () => {
    for (const game of [31, 32]) {
      assert.deepEqual(encountersIn(locationsOfForm(locations(76), 'alola'), game).map((e) => e.area), ['Evolve from Alolan Graveler']);
      assert.deepEqual(encountersIn(locationsOfForm(locations(76), ''), game).map((e) => e.area), ['Evolve from Graveler']);
    }
  });

  test("evolve lines name the pre-evolution's own form: the owner's examples", () => {
    const areasOf = (id: number, form: string, game: number) => encountersIn(locationsOfForm(locations(id), form), game).map((e) => e.area);
    assert.deepEqual(areasOf(75, 'alola', 31), ['Evolve from Alolan Geodude']); // Alolan Graveler in Let's Go
    assert.deepEqual(areasOf(80, 'galar', 33), ['Evolve from Galarian Slowpoke']); // Galarian Slowbro in Sword, once though the DLC repeats it
    assert.deepEqual(areasOf(26, 'alola', 27), ['Evolve from Pikachu']); // Alolan Raichu in Sun
    assert.ok(areasOf(59, '', 40).includes('Evolve from Growlithe')); // Kantonian Arcanine in Scarlet, beside Hisuian Arcanine's line
    assert.deepEqual(areasOf(76, 'alola', 29), ['Evolve from Alolan Graveler']); // Alolan Golem in Ultra Sun, a tagged line
  });

  test('no form from a regional form still reads the plain name', () => {
    const index = readData<IndexEntry[]>('index.json');
    const nameOf = (id: number) => index.find((entry) => entry.id === id)!.name;
    for (const { id } of index) {
      const data = locations(id);
      const chainId = dataEntry<SpeciesDetail>('species', id).evolutionChainId;
      if (chainId === null) continue;
      const chain = dataEntry<EvolutionMember[]>('evolution', chainId);
      for (const [form, { plain }] of Object.entries(regionalParents(chain, id, nameOf))) {
        for (const rows of Object.values(locationsOfForm(data, form).games)) {
          for (const row of rows) assert.ok(!data.strings[row[0]].includes(`Evolve from ${plain}`), `${id} ${form}: ${data.strings[row[0]]}`);
        }
      }
    }
  });

  test('no game holds the same row twice', () => {
    for (const { id } of readData<IndexEntry[]>('index.json')) {
      for (const [game, rows] of Object.entries(locations(id).games)) {
        assert.equal(new Set(rows.map((row) => row.join())).size, rows.length, `${id} in game ${game}`);
      }
    }
  });

  test('an evolve line naming a region names a form we ship', () => {
    const index = readData<IndexEntry[]>('index.json');
    const regions: Record<string, string> = { Alolan: 'alola', Galarian: 'galar', Hisuian: 'hisui', Paldean: 'paldea' };
    for (const { id } of index) {
      for (const text of locations(id).strings) {
        const [, region, name] = text.match(/^Evolve from (Alolan|Galarian|Hisuian|Paldean) (.+)$/) ?? [];
        if (!region) continue;
        const from = index.find((entry) => entry.name === name);
        assert.ok(from?.forms?.some((f) => f.key.startsWith(regions[region])), `${id}: ${text}`);
      }
    }
  });

  test('a version-exclusive regional form reads Trade in the other game', () => {
    assert.deepEqual(encountersIn(locationsOfForm(locations(27), 'alola'), 32).map((e) => e.area), ['Trade']); // Alolan Sandshrew in Let's Go, Eevee!
    assert.deepEqual(encountersIn(locationsOfForm(locations(83), 'galar'), 34).map((e) => e.area), ['Trade, Wild Area News']); // Galarian Farfetch'd in Shield
  });

  test('no regional tag stays in the text, and every regional form has rows', () => {
    for (const { id, forms } of readData<IndexEntry[]>('index.json')) {
      const data = locations(id);
      for (const text of data.strings) assert.doesNotMatch(text, /\((?:[\w/]*\/)?(?:Alolan|Galarian|Hisuian|Paldean)[^)]* Forms?\)/, `${id}: ${text}`);
      for (const { key } of forms ?? []) if (REGIONAL_FORM.test(key)) assert.ok(Object.keys(locationsOfForm(data, key).games).length > 0, `${id} ${key}`);
    }
  });

  test('no markup is left in any string, and every species has a row', () => {
    for (const { id } of readData<{ id: number }[]>('index.json')) {
      const { strings, games } = locations(id);
      assert.ok(Object.keys(games).length > 0, `${id} has no rows`);
      for (const text of strings) assert.doesNotMatch(text, /[{}[\]|<>]|'''|&\w+;|^\*/, `${id}: ${text}`);
    }
  });
});
