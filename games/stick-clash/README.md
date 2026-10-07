# Stick Clash

Wobbly neon stickmen, floppy weapons, big knockbacks. Stick Clash is a physics fighting game for one to eight players
(keyboard, gamepads or touch, with CPUs filling the empty seats) that runs in any modern browser. There is nothing to
install, and the whole game is one offline HTML file.

**To play:** open `dist/stick-clash.html` in Chrome, Edge, Firefox or Safari. If it isn't there yet, run
`node build.mjs` first. It works offline from your disk.

Everything you fight with is unlocked from the start: 51 weapons, 24 skills, 6 classes, 6 throwables, 8 ultimates,
23 arenas and 22 modes, plus the **Mythic Quest** campaign (24 stops across 4 realms) and **31 challenges**. Looks
(outfits, weapon skins, K.O. effects, pets, victory poses, titles) unlock on the free 100-level **Track**, and coins buy
hats and colour packs in the Shop. None of it changes how strong you are.

## Controls

| Action | Player 1 | Player 2 | Gamepad |
|---|---|---|---|
| Move | A / D | ← / → | Left stick or d-pad |
| Jump (press again in the air to double jump; tap for a short hop) | W | ↑ | A |
| Attack | S | ↓ | X |
| Skill 1 | Q | . | B |
| Skill 2 | E | / | Y |
| Dash (or double-tap left/right) | Left Shift | Right Shift | RB |
| Block (hold; a fresh press just before a hit parries) | F | , | LT |
| Grab, then again to throw (or block + attack) | C | L | RT |
| Throwable | R | ; | LB |
| Super (when the meter is full) | X | Enter | R3 (right stick click) or Back |
| Taunt (and your victory pose) | T | ' | D-pad up |
| Pause | Esc or P | Esc or P | Start |
| Mute | M | M | |

- **Playing alone:** Player 1 also answers to the arrow keys and to every gamepad.
- **Two players:** pad 1 drives P1 and pad 2 drives P2.
- **Rebinding:** every key can be changed under **Controls**.
- **Menus:** use the arrow keys or WASD, Enter to select and Esc to go back. A gamepad works the same way with the
  d-pad, A and B.
- **Touch screens:** put your left thumb down anywhere on the left half and a stick appears under it: slide to run,
  push up to jump, pull down to block. On the right, tap to attack, swipe up to jump, sideways to dash, down to grab.
  The action buttons sit in an arc around Attack (size and see-through-ness in Settings).
- **Gamepads:** up to 8 at once. Every button can be remapped per player (**Controls → Gamepad buttons**), and pads
  rumble on hits (Settings). In party modes, **press A to join** on the arena screen.
- **One-button mode** (Settings → Accessibility): you walk to the foe and hop by yourself; the one button attacks,
  hold it to block, double-tap for your super (or a skill or throwable).

### How fighting works

- Your weapon swings with your body. **Speed is damage:** a fast swing hits hard, and a lazy touch does nothing.
  Running, jumping or dashing into a swing adds power, and head hits count extra.
- Two weapons meeting at speed **clash**: sparks fly, both bounce back and nobody is hurt.
- **Guns and bows** aim themselves at the nearest foe. They have limited ammo and a reload. With an empty gun you can
  still club a foe who gets close.
- **Parry shots:** a fast melee swing bats a projectile back the way it came, and shields deflect them.
- **Heavy hits** send fighters flying, and the final blow hits hardest. On arenas without walls or floor you can be
  knocked off the stage for a **ring-out**.
- **Power-up orbs** float into most arenas. Touch one to grab it (see the list below).
- **Walls:** in the air, hold toward a wall to slide down it slowly, and press jump to kick off it (arena edges and tall
  blocks).
- A fight is first to 5 rounds unless the mode says otherwise. Change rounds, health, game speed, orbs and CPU level
  under **Settings**.

### Fighting depth

- **Block and parry.** Hold block to raise your guard: hits from the front only chip you, but each drains the stamina
  bar under your health (holding the guard drains it slowly too). Run out and your **guard breaks**: you are stunned for
  a second. Raise the guard *just before* a hit lands (within about 0.15 s, with a fresh press) to **parry**: no damage,
  stamina back, and the attacker is staggered. A parried shot flies back at the shooter. Blasts can be blocked but not
  parried.
- **Grab and throw.** Up close, grab (or press attack while blocking). Grabs go straight through a guard. Press again to
  throw the foe the way you are holding; they tumble like a rag doll. Held? Mash any button to break free.
- **Disarms.** A big hit can knock the weapon out of a hand. It lands on the ground: walk over it bare-handed to take it,
  or press grab beside it to swap. The disarmed fighter fights with bare fists, and after 5 seconds a **supply crate**
  with a random weapon parachutes in beside them. A K.O.'d fighter's weapon drops too.
- **Super meter and ultimates.** Dealing and taking damage fills the gold bar. When it glows, press super to unleash the
  ultimate of your weapon's type. The meter carries over between rounds.
- **Weapon levels.** Your weapon levels up as it deals damage, for the rest of the match: **Lv2** reaches further and
  hits harder, **Lv3** hits harder still and leaves an elemental trail whose hits burn, chill, shock or poison.
- **Throwables.** Pick two in the loadout; each can be thrown once per round, lobbed at the nearest foe.
- **Combo weapons.** Elemental orbs (fire, ice, shock, poison) fuse with your weapon for the round: a *Flaming
  Chainsaw*, a *Shocking Katana*...
- **Mounts.** Rare orbs give you a ride for a few seconds; one big hit knocks you off.
- **Limb shatter.** Every K.O. pops the fighter apart into glowing neon pieces (no blood), replayed in the kill-cam.

### Classes

Pick one in the loadout (the **Class** tab). Every class wins 44-54% against the others in CPU tests.

| Class | Body | Passive |
|---|---|---|
| **Ninja** | Fast, light (knocked further) | Extra mid-air jump (triple jump) |
| **Brute** | Slow, heavy | Melee hits +8% and knock weapons loose more often |
| **Mage** | Balanced | Skill cooldowns 38% shorter; super meter fills 15% faster |
| **Gunner** | Balanced | +50% ammo, reloads 60% faster, one extra throwable |
| **Tank** | Slow, heavy, hits a little softer | +15% health, +50% guard stamina, hard to knock away |
| **Trickster** | A little faster | Dash goes 60% further, recharges faster and turns you invisible for a moment |

### Ultimates (one per weapon type)

| Weapon type | Ultimate |
|---|---|
| Blades | **Phantom Edge**: blink through everyone in front, then every foe passed is cut again |
| Heavy | **Earthbreaker**: leap, slam, and a shockwave launches everyone on the ground |
| Polearms | **Skyline Skewer**: three spectral thrusts down a long line, the last sends them flying |
| Chains | **Cyclone**: a whirlwind that pulls foes in, shreds them and blasts them away |
| Fists | **Meteor Flurry**: rush the nearest foe, a flurry of blows and a towering uppercut |
| Ranged | **Bullet Storm**: a rain of shots falls on every foe |
| Magic | **Arcane Nova**: float, gather power, then a huge nova |
| Exotic | **Chaos Parade**: a parade of bouncing, homing oddities with random effects |

### Throwables

| Throwable | |
|---|---|
| **Grenade** | Bounces about, then blows up after 1.5 s (or on contact). |
| **Sticky Bomb** | Sticks to the first fighter or wall it touches and explodes a moment later. |
| **Proximity Mine** | Lands and arms itself. The first foe to step close sets it off. |
| **Smoke Bomb** | A thick cloud: anyone inside is hidden from sight and aim. |
| **Ice Bomb** | Shatters on impact and freezes everyone nearby for 1.2 s. |
| **Cluster Bomb** | Pops after a second and scatters five bomblets. |

## Modes

| Mode | What it is |
|---|---|
| **1P vs CPU** | Duel the computer. First to 5 rounds wins. |
| **2 Players** | Two players, one keyboard (or gamepads). First to 5. |
| **CPU vs CPU** | Sit back and watch the bots brawl: a duel, or up to 8 in a free-for-all (Fighters on the arena screen). |
| **Tournament** | Beat 8 challengers of rising skill, then a giant champion. Best of 3 each; one loss ends the run. |
| **Survival** | Endless waves that keep getting tougher, with a boss every 5th. Your health carries over. How far can you go? |
| **Boss Rush** | Five giant bosses, each with its own trick. Extra health, refilled for every boss; one loss ends the run. |
| **Team 2v2** | You and a CPU partner against two rival CPUs. Your ally backs you up. First team to 3 rounds. |
| **Co-op 2v2** | Player 1 and Player 2 team up against two CPUs. First team to 3 rounds. |
| **Free-for-All** | Up to 8 fighters (4 by default), everyone for themselves. Last one standing takes the round. First to 3. |
| **One-Hit KO** | Every solid hit kills. Patience, spacing and timing win. You vs CPU, first to 5. |
| **Weapon Roulette** | Random weapons every round, re-spun every 15 s mid-fight. Adapt fast! First to 5. |
| **King of the Hill** | Stand in the glowing zone to score. It moves, and KOs respawn. First to 15 takes the round. |
| **Training** | An unkillable dummy, a damage meter and instant swaps: 1 weapon, 2/3 skills, 4 dummy mode, 5 dummy weapon. |
| **Mythic Quest** | The campaign: walk a world map through four realms (Ember Wastes, Frostspire, Sky Citadel, Shadow Depths), with battles, side quests, mini-bosses and four realm bosses (Ash Titan, Frost Queen, Storm Lord, the Warlord) who change their attacks and the arena as they weaken. Earn up to 3 stars per stop and spend them on a small skill tree (health, damage, cooldowns...) that only works in the campaign. |
| **Challenges** | 31 bite-size trials rated with 1–3 stars: win with only a frying pan, parry five blows, ring a giant off the edge, survive three Hard CPUs... |
| **Ranked** | Climb Bronze, Silver, Gold, Platinum, Diamond, Master and Grandmaster (three divisions each) against CPUs that get tougher with your rank. Best of 3; wins gain points (more on a streak), losses cost some, and you never drop out of a tier you reached. Your rank shows on the title screen. |
| **Capture the Flag** | 2v2 up to 4v4. Grab the other team's flag and run it to your base; touch your dropped flag to return it. First to 3 captures. |
| **Soccer** | A giant physics ball and two goals. Kick it, swing at it, shoot it or blast it in. First to 3 goals. |
| **Hot Potato** | One fighter carries a ticking bomb; hit or grab someone to pass it on. Plain hits barely hurt: the bomb decides. |
| **Gun Game** | Every K.O. moves you up a 7-weapon ladder that ends on a frying pan. First K.O. with the last weapon wins. |
| **Juggernaut** | One giant against everyone. K.O. it to become it. Points for K.O.s as the giant and for felling it; first to 5. |
| **Zombie Horde** | You and a CPU ally against 5 waves of shamblers (they grab), runners, bloaters (they burst) and a grave brute. |
| **Battle Royale** | Eight fighters, one winner. A storm closes in from the edges and supply drops (a weapon and health) fall inside the safe zone. |
| **Lava Rising** | The floor is lava and it keeps rising; new platforms appear above it. Last one up scores; first to 2. |

Free-for-All, CPU vs CPU and the party modes take up to 8 fighters (the **Fighters** stepper on the arena screen).
On the arena screen you can also add **mutators** (Low Gravity, Tiny Fighters, Vampire, Ricochet, Sudden Death, Random
Weapons, Supercharged, Orb Storm, Explosive K.O.s, Speed ×1.5, and a secret one) and pick the **weather**. In CPU vs
CPU and the party modes, every other round opens with a short **party mini-game** (Sumo Shove, Dodgeball Rain, Hot
Floor, Reflex Duel); the winner carries a small perk into the real round (Settings → Party mini-games).

Boss Rush bosses now have **phases**: at half health and at a quarter they change their attacks and the arena
(spikes or lava at the edges, rock and hail storms, sliding platforms, summoned guards, a howling wind).

The CPU has four levels: **Easy**, **Normal**, **Hard** and **Insane**. Each one beats the level below it in roughly
70–80% of rounds.

### CPU rivals

In 1P vs CPU (the loadout's **Rival** row), Tournament, Free-for-All and Ranked, CPUs can be one of ten named rivals,
each with a look, favourite gear and a fighting style: **Torque** the Rusher, **Mirage** the Trickster, **Vale** the
Zoner, **Dazzle** the Show-off, **Tamsin** the Parry Master, **Grizz** the Grappler, **Magpie** the Orb Hunter,
**Fenn** the Berserker, **Ivo** the Tactician and **Skitter** the Coward. They talk back in speech bubbles (Settings →
Taunts & reactions). When you play alone, **adaptive difficulty** nudges the CPU a little up or down to keep fights
close (never past the next level, never in Ranked), and CPUs **learn your habits**: lean on the same jump-in, dash-in,
guard or skill too often and they start countering it ("READ YOU!").

## Weapons

### Blades

| Weapon | |
|---|---|
| **Blade** | Balanced sword. Quick swings, reliable reach. The yardstick. |
| **Katana** | Long, light, curved. Wait a moment between swings and the next one is a lightning-fast draw cut. |
| **Broadsword** | Wide, heavy blade. Hits harder than the Blade and its flat can parry incoming shots. |
| **Greatsword** | Two-handed slab of steel. Slow to swing and to run with, but huge reach and crushing hits. Armour soaks 10%. |
| **Twin Fangs** | A venom-coated dagger in each hand. Short and relentless; hits may poison. |
| **Guardian** | Arming sword and kite shield. The shield often deflects projectiles and the guard soaks damage. |
| **Rapier** | Needle-thin duelling blade. Every attack is a fast lunge straight at the foe. |
| **Energy Saber** | Light, fast plasma blade. Hits hard for its weight and can bat away shots. |
| **Rimefang** | An ice-crystal sword. Each hit has a chance to freeze the foe solid for a moment. |
| **Emberbrand** | A sword wreathed in fire. Every hit sets the target burning. |
| **Tempest Fan** | Steel folding fan. Each swing also throws a short gust that shoves the foe away. |

### Heavy

| Weapon | |
|---|---|
| **Quake Hammer** | Slow and heavy. Smash the ground on a downswing to send out a shockwave. |
| **Reaver Axe** | Bearded war axe. Deep cuts make the target bleed. |
| **Twinblade Axe** | Double-bladed axe. Every attack is a two-chop whirl. |
| **Spiked Mace** | Flanged iron club. Solid blows may leave the foe stunned. |
| **Slugger** | Wooden bat. Massive knockback; head hits send them flying. Knock-outs are home runs. |

### Polearms

| Weapon | |
|---|---|
| **Spear** | Longest reach. Lunging pokes from safety; weaker up close. |
| **Halberd** | Axe blade, spike and hook on a long haft. Attacks alternate between a lunge and a sweeping chop. |
| **Tidecaller** | Three-pronged trident. Wide tip that is hard to dodge; hits drag the foe down with a slow. |
| **Reaper Scythe** | Long hooked blade. Hits reel the victim in toward you for the follow-up. |
| **Bo Staff** | Long wooden staff held in the middle. Both ends strike, so spins hit in front and behind. |

### Chains

| Weapon | |
|---|---|
| **Morning Star** | Spiked ball on a chain. Wild, heavy, hard to block. |
| **Nunchaku** | Two sticks on a short chain. Very fast flurries; the loose stick cracks at high speed. |
| **Viper Whip** | Very long leather whip. Low damage but huge reach; a full-speed crack slows the target. |
| **Kusarigama** | Sickle on a long chain. Hooks the target, makes it bleed and drags it closer. |

### Fists

| Weapon | |
|---|---|
| **Haymakers** | Boxing gloves. Short reach, but fast alternating jabs with huge knockback. |

### Exotic

| Weapon | |
|---|---|
| **Wingrang** | Hits on the way out and on the way back. Catch it to throw again. |
| **Iron Skillet** | A trusty frying pan. BONK. Big flat face, comedic clang, good odds of a stun. |
| **Ripper Saw** | Revving chainsaw. Attacks spin it up: while revving it grinds anything it touches for steady damage. |
| **Sugar Rush** | A giant swirly lollipop. Weak hits with silly knockback, and every hit gives you a sugar rush (haste). |
| **Bubble Blaster** | Silly slow bubbles. Trapped foes float helplessly upward. |
| **Party Popper** | A blast of confetti. Barely hurts, but it shoves hard. |

### Guns and bows

| Weapon | |
|---|---|
| **Pulse Pistol** | Six quick energy shots, then a reload. Keep your distance. |
| **Thunder Six** | Six slow, heavy rounds that knock foes back. Long reload. |
| **Boomstick** | Six pellets per blast. Brutal up close, kicks like a mule. |
| **Buzzsaw** | Hold attack to spin up, then a hail of bullets. Heavy: you walk slower. |
| **Longshot** | Huge damage, two shots, slow reload. Stand still for a steady aim. |
| **Skyrocket** | One big explosive rocket. Blast your own feet to rocket jump. |
| **Pop Launcher** | Lobs bouncing grenades that blow after a short fuse. |
| **Nailbow** | Fast heavy bolts that pin the target's legs in place. |
| **Moonbow** | Hold attack to draw, release to fire. A full draw pierces. |
| **Shadow Kunai** | Throw a fan of three spinning knives. Quick to restock. |
| **Photon Lance** | An instant beam that pierces two foes. Three charges per cell. |
| **Nova Cannon** | Hold to grow a plasma orb. Big orbs explode on impact. |
| **Dragon's Breath** | A short cone of fire. Sets foes alight; runs dry fast. |
| **Cryo Ray** | A stream of ice shards. Slows; a long burst freezes solid. |
| **Pebble Sling** | Bouncing pebbles with a big shove. Headshots stun. |

### Magic

| Weapon | |
|---|---|
| **Storm Staff** | Lightning leaps to the nearest foe, then chains to others. |
| **Starlight Wand** | Slow stars that curve toward the nearest foe. |
| **Void Orb** | Lob a dark orb that becomes a gravity well, then bursts. |
| **Twin Plasma Staff** | Double-ended energy staff. Both ends burn; every third hit releases a static blast. |

Pick **Random** in the loadout to roll a new weapon every round.

## Skills

Each fighter carries two skills (Skill 1 and Skill 2) with their own cooldowns, shown in seconds below.

| | Skill | Cooldown | What it does |
|---|---|---|---|
| ✦ | **Phase Step** | 4 s | Teleport behind the nearest foe with a moment of invulnerability. |
| ◉ | **Quake Stomp** | 7 s | Stomp a shockwave that launches and stuns grounded foes. In the air, dive first for a bigger quake. |
| ➤ | **Comet Lunge** | 7 s | Streak forward ~300px, untouchable, slicing every foe you pass through. |
| ⇑ | **Sky Splitter** | 6 s | Hop up with a rising slash that launches nearby foes skyward. |
| ⇈ | **Rocket Leap** | 7 s | Blast off the ground (or mid-air) ~360px up, scorching anyone beside you. Great for escapes and recovery. |
| ⤳ | **Grapple Line** | 6 s | Fire a hook. Hit a foe: yank them to you, dazed. Hit a wall or ledge: zip over to it. |
| ⊗ | **Riposte** | 8 s | For half a second you are untouchable: shots bounce back and the first swing at you is countered with a stun. |
| ✺ | **Ember Orb** | 7 s | Hurl a fireball that bursts on impact and sets foes burning. |
| ϟ | **Storm Call** | 8 s | Mark the ground under a foe; half a second later a lightning bolt strikes there and stuns. Move to dodge! |
| ❄ | **Frost Nova** | 9 s | Freeze every foe within 170px for about a second. |
| ☄ | **Starfall** | 11 s | Call a meteor onto where the foe is heading. A big burning blast after a short warning. |
| ☁ | **Toxic Cloud** | 11 s | Release a poison cloud on the foe (or ahead of you) that poisons anyone inside for 4 seconds. |
| ≋ | **Tremor** | 13 s | Shake the whole arena for 2.4 s: every pulse jolts and slows foes standing on the ground. Jump to avoid it. |
| ✢ | **Spinning Glaive** | 6 s | Throw a spinning blade that cuts through foes on the way out and again on the way back. |
| ◎ | **Singularity** | 10 s | Open a gravity well that drags foes and their shots toward it for 2 s, then implodes. |
| ❂ | **Force Push** | 8 s | A shockwave that hurls nearby foes away and sends their projectiles back. |
| ◈ | **Aegis Bubble** | 14 s | Wrap yourself in a bubble that blocks the next two hits (lasts 4.5 s). |
| ✙ | **Mending Pulse** | 15 s | Cleanse burns, poison and slows, then regenerate about 20 health over 4 seconds. |
| ⚔ | **Blood Frenzy** | 13 s | For 5 s: +40% damage, faster moves and attacks, but you take 25% more damage. |
| ⧗ | **Chrono Field** | 10 s | Foes within 320px move and attack at half speed for 3 s; their shots in range crawl. |
| ⧉ | **Mirror Decoy** | 15 s | Summon a fragile copy of yourself (30 hp, half damage) that fights for 5 s and draws enemy attention. |
| ◐ | **Vanish** | 10 s | Turn invisible for 3.5 s with a burst of speed. Your first hit from hiding deals +8 and reveals you. |
| ⌖ | **Snare Mine** | 7 s | Drop a mine at your feet (up to 2). It arms in 0.6 s; a foe stepping on it is stunned and popped into the air. |
| ⋒ | **Magnet Pulse** | 8 s | Yank nearby foes and their weapons toward you (throwing their guard off) and pull in power-up orbs. |

## Power-up orbs

| Orb | Effect |
|---|---|
| **+35 HP** | Restore 35 health. |
| **Haste** | Move and attack faster for 6 seconds. |
| **Giant Weapon** | Your weapon grows 50% for 8 seconds. |
| **Shield** | Blocks the next hit (lasts 20 seconds). |
| **Lifesteal** | For 8 seconds, heal 40% of the damage you deal. |
| **Double Damage** | Deal double damage for 5 seconds. |
| **Shrink Ray** | Shrinks every foe for 6 seconds: tiny bodies, weak hits. |
| **Skill Reset** | Both skills are ready again instantly. |
| **Sky Boots** | An extra mid-air jump (triple jump) for 10 seconds. |
| **Thorn Mail** | For 8 seconds, melee attackers take half the damage they deal you. |
| **Fire / Ice / Shock / Poison Orb** | Fuses that element into your weapon for the round (burn, chill and freeze, arcing stun, poison). |
| **Hoverboard** (rare) | 8 s: glide at high speed and ram foes. |
| **Mech Suit** (rare) | 6 s: armour softens damage and most knockback; attack throws a crushing mech punch. |
| **Jetpack** (rare) | 8 s: hold jump to fly; the exhaust burns anyone underneath. |
| **Dragon** (rare) | 8 s: fly with jump and hold attack to breathe fire. |

## Arenas

| Arena | |
|---|---|
| **Neon City** | The classic rooftop arena. Three ledges, lots of room, no tricks. |
| **Dojo Courtyard** | Open boards, no ledges, no power-ups. A pure duel of footwork and timing. |
| **Molten Foundry** | A lava pit splits the floor. A sliding platform crosses above it. |
| **Caldera** | Two lava pools bubble in the crater floor and erupt in geysers. Watch for the glow. |
| **Frost Peak** | The ice floor is slick: stopping and turning take longer. Snowy ledges give grip. |
| **Moon Base** | Low gravity: huge floaty jumps, long knockbacks, and lazy grenades. |
| **Sky Islands** | Floating isles over a bottomless sky. Knock them off the edge for a ring-out. |
| **Robo Factory** | Conveyor belts drag you toward the crushers by the walls. Lights flash before they slam. |
| **Spike Pit** | A bed of spikes fills the middle of the arena. A hovering bridge crosses it. |
| **Storm Rooftop** | Gusts shove everyone sideways and lightning hits the highest ground. Strikes are marked first. |
| **Desert Ruins** | Sandstorms push you around and old ledges crumble underfoot, then rebuild from the sand. |
| **Sunken Temple** | Underwater: heavy drag, floaty jumps and a slow current that sways everyone. |
| **Rainbow Bounce** | Trampolines launch you sky-high. Bounce over foes and land on top of them. |
| **Haunted Graveyard** | Dark and foggy: you only see what is near. Ghosts drift through and chill whoever they touch. |
| **Orbital Station** | Zero-g columns let you float up to the high decks. Fight mid-air or ride them to safety. |
| **Pirate Ship** | The deck rolls with the swell and footing slides downhill. Cannonballs land on the flashing red rings. |
| **Train Roof** | Fight on a speeding train into a headwind. When TUNNEL flashes, drop into a gap between the cars. |
| **Jungle Temple** | Grab a vine in mid-air (grab key) to swing over the spike pit; jump to let go. Stone faces spit darts. |
| **Candy Land** | Caramel puddles stick to your feet; marshmallow blocks bounce you sky-high. |
| **Volcano Eruption** | Mid-fight the volcano blows: side ledges sink into rising lava, new rock rises and lava bombs rain down. |
| **Space Asteroid** | Every planetoid has its own gravity: run right round it, jump to hop to the next. Deep space is a ring-out. |
| **Haunted Mansion** | The lights flicker and die every few seconds: fighters and blades glow in the dark. |
| **Giant's Kitchen** | Tiny fighters on a giant countertop: a toaster launcher, a whirring blender and runaway fruit. |

Arena traps always flash a warning before they strike, and they stay quiet for the first seconds of each round.
Crates, glass panes and stone pillars on many arenas break under hits, shots and blasts (and what stood on them falls).

**Weather** (the arena screen's Weather stepper, random by default): rain and snow make the ground slippery, fog hides
everything far from the fighters, wind gusts shove fighters and bend shots (each gust is announced), and night darkens
the arena so only lamps, fighters and glowing weapons light it.

## Your fighter and progress

- **Look tab** (in the loadout): an outfit with cloth physics (capes, scarves, coats that flap as you move), a skin for
  each weapon type, a K.O. effect, a helper **pet**, a victory pose and a title. Press **taunt** mid-fight for a little
  super meter (if you dare).
- **Pets** follow you and help a little: Bit-Bot zaps a shot out of the air, Sprig heals you when you are low, Zappy and
  Ember Wisp nip at nearby foes, Fetch brings orbs closer, Tick slows a bullet, Bubbles washes off a debuff and Glim
  tops up your super. Pets are off in Ranked.
- **Fighter Creator:** save named presets (weapon, skills, class, throwables, hat, colour and look) and load them in
  one click.
- **Track:** a free 100-level track. Every match, campaign stop, challenge and quest earns XP, and every level hands
  out a reward (looks, hats, coins, titles).
- **Quests:** three daily and one weekly task ("land 3 parries", "win on Candy Land"...) for bonus XP. You can re-roll
  one a day.
- **Codex:** every weapon, skill, class, arena, boss, realm and pet with two lines of its own lore and your stats with it.
- **Secrets:** a few hidden things unlock by typing codes on the title screen (or into the box on the Codex's Secrets
  tab) or by doing something unusual. The Codex gives hints, and found secrets get their lore too.
- **Coins and Shop:** coins come from every match (more for wins, harder CPUs, tournament runs and survival waves;
  Training earns nothing) and buy 34 hats and colour packs.
- **Trophies & Stats:** 28 trophies to unlock, plus your lifetime stats.
- **Highlights:** the best K.O.s of the session (big blows, combos, ring-outs, comebacks) are kept as clips. Replay them
  from the title screen and export one as a WebM video (in the downloaded file; some embedded viewers block downloads).
- **Transfer progress** (Settings): copy one code that holds all your saves and paste it on another device.

## Look and sound

- An arcade **announcer**, a **crowd** that reacts to big hits, and procedural synthwave **music** with a track per
  arena that builds as the fight heats up (all can be turned down or off in Settings).
- **Bloom** glow (WebGL, with a simpler fallback), dynamic lights from muzzle flashes and blasts, and punchier impacts.
  The **Effects** setting (Calm / Normal / Chaos) scales particles, shake, slow-motion and flashes.
- **Photo mode** (pause menu): freeze the fight, pan and zoom a free camera, add a filter and a frame, hide the HUD, and
  save a PNG.

## Accessibility

Settings → Accessibility: **colour-blind palettes** (deutan, protan, tritan) with a shape marker on every fighter and
health card, **reduce flashing** (softer flashes, little shake, no strobing lightning; on by default when your system
asks for reduced motion), **one-button mode** for P1, P2 or both, a **practice game speed** slider (25–100%, solo play,
never Ranked), and gamepad rumble and phone haptics strength. A match played at a slowed practice speed still earns
coins and XP, scaled by the slowest speed used (× 0.4 at 25%, the full reward at 100%); the results card says so.

## On a phone or iPad

Open the HTML file in the browser and play with the touch controls (landscape works best; on an iPad the health
cards sit in the band above the arena, and the camera keeps fighters out from under them). Settings → Controls has a
**touch mode** (Auto shows the on-screen controls whenever you last touched the screen, On and Off force them), and the
title and pause menus offer a **fullscreen** button where the browser allows it. **Performance** settings pick a quality
preset for older devices. Highlights can be **shared** or exported as a **GIF** as well as a WebM. Secret codes can be
typed into the **Codex's Secrets tab** (with arrow buttons), since a phone has no keyboard on the title screen. The
`mobile/` folder holds an Expo app that wraps the game for iOS (see `mobile/README.md`).

## Tips

- Don't mash. Wind up, then swing *into* your foe while moving.
- Dash and jump to dodge, and use the double jump to get back onto a ledge.
- Against guns, close the distance fast or bat the shots back with a quick swing (or a parry).
- Someone turtling behind a guard? Grab them. Someone grabbing? Hit them first.
- Bare-handed? Run for a weapon on the floor, or wait for the supply crate.
- Watch the arena: hazards glow or flash before they strike.
- The deciding blow of a match is replayed in slow motion (press any key to skip).
- Shield up against a rusher, parry the swing, then grab and throw. Rivals with a habit can be read too.
- Bosses fight in phases: save your super for the last one.

## For developers

The code is plain HTML, CSS and JavaScript with no libraries. `src/js/*.js` are slices of one script, joined in
filename order by `node build.mjs` into the single file `dist/stick-clash.html` (the build fails above 1.5 MB and
prints every slice's size). `node tools/smoke.cjs` tests every weapon, skill, map, mode, class, throwable, mount,
ultimate and element. `node tools/class-balance.cjs` measures class win rates. Read **ARCHITECTURE.md** before changing anything. The latest balance measurements are in
`tmp/balance.md`.
