# Rooms review

Per-room log of the realism pass (agent/staff, 2026-10-13). Each room was rendered offline with its NPCs mid-task and the player at every spot, on a 5% grid, and checked the way a player would see it. Rules: people face what they're working on, their hands do the job, nobody stands idle without a reason, the player's spots sit on real furniture, and feet stay on the floor.

New poses used below: `stand_talk`, `cook_hob`, `cut_hair`, `sew`, `sit_desk`, `eat_table` and `sit_table` (seated at a table; an invisible table hides the legs under it), plus the staff work poses (`check_patient`, `write_chart`, `take_order`, `pour_drink`, `serve_tray`, `carry_tray`, `cook_stir`, `wipe_counter`, `sick_sit`). `sit_eat` now holds a plate of jollof and a spoon. Seated sheets face all four directions.

Anchor for seated-at-table poses: the feet sit under the table, so the anchor is the seat plus (+0.03, +0.054) facing se, or (-0.03, +0.054) facing sw.

## Homes

| Room | What was wrong | Fix | Still open |
|---|---|---|---|
| home-villa-kitchen | The cook faced the viewer, with her hands idle. "Eat" stood the player at the island with no plate. | The cook uses `cook_hob` facing the hob (nw) and turns to chat now and then. The family sits on the bar stools facing the island (ne). Eat is `eat_table` on the free stool. | The stools are tall, so seated people are anchored a little above the floor. Check that on a phone. |
| home-kitchen | `serve` (stirring a pot) faced se, away from the cooker. Dad ate with no plate. | The cook uses `cook_hob` facing the cooker (nw). Dad uses `eat_table` at the table. Eat and sit go to the far chair (sw). | |
| home-duplex | No one was at the dining table. A girl stood idle. | The daughter uses `eat_table` at the dining table. Eat goes to the dining table. | |
| home-mansion | A man stood idle. | He uses `stand_talk` with the family on the sofa. | |
| home-crazy | A woman stood idle facing away. | She uses `stand_talk`, facing the man on the throne (nw). | |
| home-compound-yard | A schoolboy stood idle in the yard. | A neighbour uses `stand_talk` with the two under the mango tree. | |
| home-villa-pool | A man stood idle on the deck. Eat put the player beside the tiki bar. | The man sits on a tiki-bar stool (ne). Eat is `eat_table` on the second stool. | |
| home-face-me | Her sit_eat had no plate. | `sit_eat` now carries a plate. | |
| home-self-contain | `serve` faced sw, away from the counter. | `cook_hob` at the two-burner, facing ne. | The hob height is a guess (~0.9 m). |
| home-mini-flat | A girl stood idle by the TV. | Removed. The walker covers the room. | |
| home-bedroom, home-duplex-bedroom | A man stood idle. | Changed to `stand_talk`. | |
| home-villa-suite, home-villa-cinema | Reviewed, and look right. | | The boy by the popcorn machine still uses `stand_idle`. |

## Venues

| Room | What was wrong | Fix | Still open |
|---|---|---|---|
| hospital-ward (old art) | A visitor stood idle, and the nurse faced away with idle hands. | The nurse uses `write_chart` at the desk and `check_patient` at each bed. A doctor visits. Patients `sick_sit` on the bed edge and then lie down. Visitors `stand_talk` at the foot of the middle bed, then leave. | The venue now uses hospital-ward-4. |
| hospital-ward-4 (new) | New room. | Marked up: nurse rounds, a visiting doctor, family visitors, two patients, and the player's bed. | |
| consulting-room (new) | New room. | The doctor uses `sit_desk` behind the desk. Patients sit in front of it, get on the couch, then leave. The nurse writes and checks. | No venue uses it yet, because a venue has a single room. |
| lounge | The barman used `serve` (stirring a pot), and the waitress was in everyday clothes. | The barman wears his uniform behind the bar (legs hidden by `behind`) for `pour_drink` and `wipe_counter`. The waitress does `take_order`, `carry_tray` and `serve_tray`. | |
| buka | Mama stirred facing the viewer. | The chef stirs a big pot on a low stove (the pot is part of the sheet) and dishes up. The boy carries plates to the tables. | The cook's pot is drawn in the sprite, not the room art. |
| hotel-lobby | No staff. | The receptionist uses `take_order` behind the desk. Room service brings a tray and takes an order. | |
| provision-shop | Madam stood idle in front of the counter. | She wipes the counter behind it and waits at the till. | |
| golf-lounge | No staff. | A barman behind the bar and a waitress serving the sofas. | |
| snooker-room | No staff. | An attendant wipes down the table and waits by the fridge. | |
| barbershop | `serve` (stirring) at the chair. The player's chair faced se. | A client sits in the front chair (sw) while a barber uses `cut_hair` beside him. A second barber waits at the player's chair. The chair spot faces sw. | |
| salon | `serve` at the chairs. | A client and stylist use `cut_hair` at the back chair. A second stylist waits at the player's front chair. | |
| tailor-shop | `serve` at the sewing machine. | Baba uses `sew` at the machine (nw). His wife cuts cloth at the table (`wipe_counter`, ne). | There's no stool under the machine in the art. |
| bank-hall | Two people stood idle. | One queues and one talks at the teller window (ne). | |
| police-desk | An officer stood idle in front of the cell. | The sergeant uses `sit_desk` behind the counter. A man reports a case at the desk (`stand_talk`, ne). | |
| radio-studio | A woman sat on air against the wall. | The presenter uses `sit_desk` at the mixer. The guest uses `stand_talk` across the desk. | |
| viewing-centre | Everyone faced se, away from the screen. | The audience and the player's seat face the screen (nw). | |
| car-showroom | People stood idle. | A salesman and a customer use `stand_talk` facing each other. | |
| classroom, lecture-hall | The teacher was idle, and the students faced away from the board. | The teacher or lecturer uses `stand_talk`. The classroom children face the board (ne). | The lecture-hall students still face se. |
| church | The pastor was idle. | `stand_talk` at the pulpit. | Check which way the pews face. |
| market-aisle | Traders stood idle. | Traders use `stand_talk` (haggling). | |
| boat-deck, hangout | `serve` (stirring) at the bar. | Changed to `pour_drink`. The singer at the hangout uses `stand_talk`. | |
| stadium-room, courtroom | The coach and the lawyer stood idle. | Both use `stand_talk`. The lawyer faces the bench. | |
| library-room | The librarian stood idle. | She uses `wipe_counter` at the desk. | The children at the reading tables use `sit_talk`, not `sit_table`. |
| restaurant (new) | New room. | Diners `eat_table` and `sit_table` at the four tables. The waiter takes orders and carries plates, the chef works at the pass, and a barman at the counter. Eat and sit go to the left table. | No venue uses it yet (there is no Terrace venue). |
| cocktail-bar (new) | New room. | Guests sit on the bar stools (ne). A barman works behind the bar. A waitress carries a tray to the front table. | Not assigned: Skyline Lounge keeps the lounge (dance floor, staff). |
| boxing-gym (new) | New room. | Two spar in the ring, one works the heavy bag, one skips, and a coach watches. | |
| beach-cabana (new) | New room. | A woman sunbathes on a lounger. An attendant brings a tray. | |
| lecture-theatre (new) | New room. | Students use `sit_desk` facing the board (ne). The lecturer uses `stand_talk`. | |
| uni-cafeteria (new) | New room. | Students eat at the long tables. The chef dishes up behind the counter. | Not assigned yet. The University venue has a single interior. |
| brt-bus, coach (new) | New rooms. | Passengers sit on the seats (sw). One stands holding the rail on the bus. | The coach's seat rows are dense. Check the seat positions on a phone. |
| theatre, crusade-tent (new) | New rooms. | Theatre: performers on stage, the audience faces it (ne). Crusade: the preacher at the pulpit, worshippers with raised hands. | Not assigned. |
| gym, mosque, event-centre | Reviewed earlier (workouts, salah, dancing). | | |
