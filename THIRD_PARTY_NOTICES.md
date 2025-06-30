# Third-party notices

The MIT licence in [`LICENSE`](LICENSE) covers this project's source code only. Everything below keeps its own terms.
Each licence was read at the linked source on 2025-06-30.

TedDex is an unofficial, non-commercial fan project, not affiliated with or endorsed by Nintendo, Game Freak, Creatures
Inc. or The Pokémon Company. Pokémon names, images and sounds belong to them.

## Game content

| Content                                           | Where it is                                                                  | Source                                                    | Terms                                                                                                                                                                                                                          |
| ------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pokémon, item and Guide sprites, official artwork | `public/media/sprites/`, `artwork/`, `items/`, `guide/` (except `mint.webp`) | [PokeAPI/sprites](https://github.com/PokeAPI/sprites)     | [Its licence file](https://github.com/PokeAPI/sprites/blob/master/LICENCE.txt) says the images are copyright The Pokémon Company and distributes the repository under CC0 1.0. The CC0 does not remove the original copyright. |
| Cries                                             | `public/media/cries/`                                                        | [PokeAPI/cries](https://github.com/PokeAPI/cries)         | [Its licence file](https://github.com/PokeAPI/cries/blob/main/LICENSE) says the audio is copyright The Pokémon Company and distributes the repository under CC0 1.0. The same limit applies.                                   |
| Speed Mint sprite                                 | `public/media/guide/mint.webp`                                               | [msikma/pokesprite](https://github.com/msikma/pokesprite) | [Its readme](https://github.com/msikma/pokesprite#license) says the sprites are © Nintendo/Creatures Inc./GAME FREAK Inc. and everything else is [MIT](https://github.com/msikma/pokesprite/blob/master/license.md).           |
| Trainer sprites and Pokédex art                   | `public/media/trainers/`, `public/media/dexes/`                              | [Bulbagarden Archives](https://archives.bulbagarden.net/) | Game art. A sampled trainer sprite's file page is tagged as fair use, not as openly licensed. The tag was checked on one file, not on each.                                                                                    |

## Data

| Content                                                                                                   | Where it is                                                                                                        | Source                                                | Terms                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Species, moves, abilities, items, learnsets, evolutions, wild encounters                                  | `public/data/`, except as below                                                                                    | [PokeAPI/pokeapi](https://github.com/PokeAPI/pokeapi) | [BSD 3-Clause](https://github.com/PokeAPI/pokeapi/blob/master/LICENSE.md); full notice below. Its notice adds that Pokémon and Pokémon character names are trademarks of Nintendo.                                                                                        |
| Elite Four, Champion and Gym Leader teams; where to find items; text rows for other ways to get a Pokémon | `public/data/league/`, `public/data/gyms/`, `public/data/reference/places/`, text rows in `public/data/locations/` | [Bulbapedia](https://bulbapedia.bulbagarden.net/)     | Original Bulbapedia content is [CC BY-NC-SA 2.5](https://creativecommons.org/licenses/by-nc-sa/2.5/), per [its copyright page](https://bulbapedia.bulbagarden.net/wiki/Bulbapedia:Copyrights). These files stay under that licence, so they may not be used commercially. |

## Fonts

Loaded from Google Fonts at runtime, not stored in this repository.

| Font    | Licence                                                                                    |
| ------- | ------------------------------------------------------------------------------------------ |
| Manrope | [SIL Open Font License 1.1](https://github.com/google/fonts/blob/main/ofl/manrope/OFL.txt) |
| Poppins | [SIL Open Font License 1.1](https://github.com/google/fonts/blob/main/ofl/poppins/OFL.txt) |

## Software in the built app

Licences as declared by each installed package (`package-lock.json` pins the versions). Build tools are not listed, as
they don't ship in the app.

| Package                                             | Licence                                                   |
| --------------------------------------------------- | --------------------------------------------------------- |
| `react`, `react-dom`, `scheduler`                   | MIT                                                       |
| `react-router`, `react-router-dom`                  | MIT                                                       |
| `cookie`, `set-cookie-parser`                       | MIT                                                       |
| `@tanstack/react-virtual`, `@tanstack/virtual-core` | MIT                                                       |
| Workbox runtime, through `vite-plugin-pwa`          | MIT                                                       |
| `dexie`, `dexie-react-hooks`                        | [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) |
| `fuse.js`                                           | [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) |

## PokeAPI licence

Copyright (c) © 2013–2023 Paul Hallett and PokéAPI contributors (https://github.com/PokeAPI/pokeapi#contributing). Pokémon and Pokémon character names are trademarks of Nintendo.

All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

- Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

- Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

- Neither the name of PokéAPI nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
