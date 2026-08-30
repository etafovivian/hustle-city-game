# Market research and go-to-market (Hermes, 2026-10-13)

Written by Hermes (the homelab agent) from the hustle-city skill's research playbook. Figures marked as guesses are guesses; check sources before quoting.

HUSTLE CITY — FULL REPORT (deliverable to be saved as Google Doc: "Hustle City - Market & GTM - 2026-10-13")
Executive verdict (short)
- Recommendation: Pursue with changes — early win potential if we prioritise merchant value (measurable redemptions) and a PWA-first, campus-seeding GTM. Network effects are the main barrier (Lagos Life is a direct network competitor), so focus on merchant-driven offline→online loops and tight campus communities to build initial clusters.

1) Market (summary + key numbers)
- Nigeria: population ≈ 216M (World Bank). Internet users ≈ 128M (~59%); smartphone users ≈ 110M (~51%). Many devices are low-end Androids. Lagos city population ≈ 15M (city/metro definitions vary).
- Target cohort (16–35): estimate ~36% of population. Estimated active mobile gamers (16–35) in Nigeria ≈ 15.6M (216M * 0.36 * 20% gamers) — behavioural estimate (low–medium confidence). Lagos 16–35 mobile gamers estimate ≈ 1.2M.
- Data & devices: Android-dominant (~85%+); low-end Androids common. Typical monthly mobile data spend (active users): ~$2–$8 (high variance).
- Browser vs native: PWA-first is viable and recommended to avoid install friction on low-end devices; Android wrapped APK later if needed.
Confidence: high on population; medium on internet/smartphone; low–medium on gamer counts and data-cost ranges.

Key numbers (CSV)
metric,value
population,216000000
internet_users,128000000
smartphone_users,110000000
estimated_gamers_16-35,15600000
lagos_population,15000000

Sources (primary)
1. DataReportal — Digital 2024 Nigeria: https://datareportal.com/reports/digital-2024-nigeria
2. GSMA Mobile Economy (Sub-Saharan Africa): https://www.gsma.com/mobileeconomy/sub-saharan-africa/
3. Statista — Nigeria smartphone users: https://www.statista.com/statistics/1124811/nigeria-smartphone-users-share/
4. World Bank — Nigeria: https://data.worldbank.org/country/nigeria
5. Lagos state overview: https://lagosstate.gov.ng/about-lagos/

2) Competitors & analogues (Lagos Life + patterns)
- Lagos Life: culturally-rooted Lagos life-sim with rapid adoption via social/press; main moat = network effects. Monetisation paths reported: cosmetics, sponsored locations and business listings (early-stage). Risk: if users' friends are on Lagos Life, switching is hard.
- Global analogues: Habbo, Avakin Life, Second Life, Pokémon GO — common playbook: strong avatar/customisation + cosmetics, player housing/rooms, sponsored real-world locations where footfall can be measured, and social events drive retention.
- African context: successful regional games combine local culture, low-friction access (web/PWA), and social shareability; payments and merchant behaviour shape monetisation.
Key learnings to adopt:
- Make merchant value explicit (track clicks → WhatsApp taps → redemptions).
- PWA-first experience; low friction merchant onboarding (WhatsApp-based).
- Monetise using both cosmetics/property and merchant sponsorships/promoted placements.
Sources (examples): press on Lagos Life, Habbo/Avakin analyses, Pokémon GO locative ads studies (detailed source list at the end).

3) Will Lagos SMEs pay? Pricing & pilot
Conclusion: Yes — if expected cost is small and ROI is clear. Most micro vendors are price-sensitive; salons and established stalls accept higher spend when outcomes are trackable.

Pilot segments (priority): Salons/barbers, bukas (small eateries), market stalls, campus vendors.

Recommended pricing matrix (CSV)
segment,offer,price_NGN_per_month,expected_merchant_conversion_rate,guess_flag
Salons,Listing only,2,000,8%,guess
Salons,Listing + 1 featured promo,10,000,12%,guess
Salons,Premium (top placement + analytics),25,000,4%,guess
Bukas (small eateries),Listing only,1,000,10%,guess
Bukas,Listing + 1 promo credit,5,000,15%,guess
Market stalls,Listing only,500,15%,guess
Market stalls,Listing + local boost,3,000,8%,guess
Campus vendors,Listing only,500,12%,guess
Campus vendors,Promo bundle (3 boosts),3,000,18%,guess
All segments,Pay-per-lead,per-lead 100–300,conversion depends on quality,guess

Operational notes:
- Offer free listing + paid boosts; accept mobile-money/USSD/bank transfer; use WhatsApp onboarding and small pilot credits.
- Measurement: coupon codes + merchant dashboard (even a shared Google Sheet) to show real redemptions.

Sources: PwC MSME survey (Nigeria), local marketing articles and MSME reports (full sources list at the end).

4) GTM — First 1,000 players (30/60/90, tiny budget)
Goal: 1,000 cumulative players in 13 weeks, budget ≤ $300; PWA-first, campus ambassadors + merchant coupons.

Top-level plan (highlights)
- Weeks 1–4 (seed): recruit 10 student ambassadors; host 2 play-nights/week; outreach to 50 merchants for free pilot coupons.
- Weeks 5–8 (scale): expand ambassadors, onboard 10 pilot merchants with redeemable coupons, run weekly online tournaments.
- Weeks 9–13 (convert & optimise): double down on top channels, merchant-driven challenges, aim for W1 retention ≥25%, CAC target ≤ $0.30/user (budget/1,000).

Referral mechanics:
- Invite reward: both get 50 coins; inviter gets 200 coins after invitee completes 3 sessions. Fraud controls: require session completions before releasing bonuses.

Tiny budget breakdown (example)
- Ambassadors: $120
- Events: $105
- Merchant outreach: $45
- Misc: $30
Total ≈ $300

Weekly targets CSV (sample rows)
week,weekly_new,cumulative_players,dau_target,weekly_referrals,merchant_interactions,play_nights,budget_allocated_usd
1,25,25,3,45,1,2,7.50
2,30,55,6,54,2,2,9.00
...
13,105,1000,180,189,5,0,31.50

Outreach templates (short)
- WhatsApp merchant: "Hi [Name], I’m [name] from Hustle City. We help Lagos merchants drive footfall with in‑game coupons customers redeem in‑store. Can I share a free pilot coupon set and show how it works in 15 minutes?"
- Student ambassador CTA: "Join our campus launch team! Earn data, airtime and weekly prizes for top referrers. Tasks: host/assist a play‑night, sign up 5 friends, share one WhatsApp post. Apply: [link]."
- In-game referral copy: "Invite a friend — you both get 50 coins. When they finish 3 games, you get a 200-coin bonus."

5) Risks & cheapest experiments (prioritised)
Top risks (impact / likelihood / cheapest experiment)
- Network effects (High / High): Experiment = campus WhatsApp seeding with 30 student testers. Cost ~$0–$50. Success: viral K-factor ≥ 0.3 or 200 organic invites from 30 seeds.
- Merchant willingness & payment friction (High / Medium): Experiment = merchant pre-signup landing page + Google Form to measure intent & preferred payment. Cost $0–$20. Success: ≥10% conversion; >30% indicate they'd pay a small monthly fee.
- Redemption ops friction (High / Medium): Experiment = single-shop in-person redemption pilot with one friendly merchant. Cost $5–$20. Success: successful redemption and reconciliation with <1 failure.

Three cheapest experiments (ranked)
1. Merchant pre-signup landing page + form (Cost $0–$20).
2. Campus WhatsApp seeding with 30 testers (Cost $0–$50).
3. Single-shop in-person redemption pilot (Cost $5–$20).

6) Next 3 actions for this week (practical)
1. Publish merchant pre-signup landing page + Google Form and drive to 50 local merchants (collect price sensitivity).
2. Recruit 10 student ambassadors (use the ambassador CTA template) and schedule first 4 play-nights.
3. Implement referral code logic + in-game messaging so ambassadors can start inviting.

7) Implementation constraints & notes
- PWA-first to reach low-end Android users; offline caching, small assets, progressive loading.
- Merchant payments: do not require bank transfer upfront for pilot. Use pay-per-redemption or free pilots to prove ROI.
- Moderation: run closed tests with community rules and basic reporting before open launch.

Appendix — Sources & evidence (selected)
- Digital 2024 Nigeria — DataReportal: https://datareportal.com/reports/digital-2024-nigeria
- GSMA Mobile Economy SSA 2024: https://www.gsma.com/mobileeconomy/sub-saharan-africa/
- Statista smartphone data for Nigeria: https://www.statista.com/statistics/1124811/nigeria-smartphone-users-share/
- World Bank Nigeria data: https://data.worldbank.org/country/nigeria
- Lagos state population page: https://lagosstate.gov.ng/about-lagos/
- PwC MSME Survey Nigeria 2024 (merchant behaviour): https://www.pwc.com/ng/en/assets/pdf/pwc-msme-survey-report-2024.pdf
- Lagos Life press & guides (example press): Vanguard coverage (Oct 2026) and Lagos Life site
- Habbo / Avakin / virtual goods analyses and Pokémon GO locative ad studies (sources collated from industry reports and academic papers — full reference list available if you want the raw URLs)

Memory saved
- I saved the Hustle City key facts and decisions into memory (Hustle City) so future runs reuse estimates, pilot decisions, pricing models and the GTM plan.

Files & CSVs (ready to save)
- key_numbers.csv (see Key numbers CSV above)
- pricing_matrix.csv (see Pricing matrix CSV above)
- weekly_targets_13weeks.csv (see Weekly targets CSV above)
- GTM plan (Markdown) — text above

Telegram summary (under 20 lines)
- Verdict: Pursue with changes — PWA-first, merchant-driven loops + campus seeding.  
- Top 3 opportunities: 1) Merchant deals → measurable footfall, 2) Campus ambassador clusters for viral seeding, 3) Cosmetics/property monetisation for engaged players.  
- Top 3 risks: 1) Network effects vs Lagos Life, 2) Merchant payment/onboarding friction, 3) Retention (players must return).  
- Next 3 actions this week: 1) Publish merchant pre-signup + form (50 merchants), 2) Recruit 10 student ambassadors and schedule play‑nights, 3) Implement referral code + in-game messaging.  
- Doc link: (Doc creation failed here — I will create and post the Drive link after you enable Google auth or provide credentials).

