# Onboarding call script

One continuous script to recite on the team kickoff call. It runs from the
opening through a live product walkthrough and into the per-lane handoffs, in the
order you'll actually say them. Bracketed lines are stage directions for you, not
to be read out.

How to use this:
- Read it close to verbatim. The product walkthrough in the middle is meant to be
  driven live with the app on your screen, so the spoken lines double as your
  click-through narration.
- Swap `[SC dev]` and `[backend dev]` for real names before the call.
- Companion reference: [`ONBOARDING.md`](ONBOARDING.md) is the written version the
  team reads afterward. This is the spoken version you deliver.

Paces to about 20 to 30 minutes, plus questions.

## Before the call

- Run the app: `npm run dev -- -p 4400`, open `http://localhost:4400`.
- Have two browser windows side by side: one signed in as the importer, one open
  on the financier side. Onboard the importer ahead of time, or do it live in the
  walkthrough if you want them to see it.
- If the live chain and database are wired (Privy, Neon, Amoy addresses), you can
  show real transactions and real Polygonscan links. If not, the surfaces still
  render and you narrate the flow. Say which mode you're in when you get there.

---

## 0. Open

"Thanks for jumping on. The goal today is simple. By the end of this call you
both know what Dhow is, how the system fits together, and exactly which part of
the codebase is yours to start on. I'll set up the idea, then I'll click through
the actual product so it's concrete, then I'll tell you who owns what, and then
we go to questions. And I want questions.

There's an onboarding doc in the repo at `docs/ONBOARDING.md`. Everything I say
maps to it, so you don't have to take notes. Read it properly after the call.
Right now just listen for the shape.

## 1. What Dhow is, in plain terms

"Here's the whole thing in a few sentences. Small importers move real goods and
have real cashflow, but banks won't lend to them because none of that history is
in a form a bank can read. The trade finance gap is about two and a half
trillion dollars. Roughly forty one percent of small business finance
applications get rejected, against seven percent for big corporates. The money
exists. It's just invisible.

Every previous attempt to fix this asked importers to change their behaviour
first. Digitise your documents, join our platform, adopt our standard. With
nothing in it for them up front, those efforts died.

Our move is the inversion. We lead with the payment. An importer already has to
pay their overseas supplier. If that payment settles through us, in stablecoin,
on Polygon, then the verified record of it is a by-product. We're not selling
them software and begging for data. We move their money, and the data falls out.
Do that across a few shipments and you have a clean, on-chain history of real
cashflow that nobody can fake. That history is the thing a financier can
underwrite against.

One more piece, because it matters for how we build. We are not the lender.
We're the marketplace. We match a de-risked importer to a third-party financier,
the financier carries the risk and earns the yield, and we take a fee. That
keeps us capital-light, and it means the region's banks become our customers,
not our competition.

This is for the Polygon, DIFC, and Ignyte challenge. The application is due July
thirteenth. So we have a real deadline and a real prize.

## 2. The one mental model

"Before I show you the product, I need both of you to hold one model in your
head, because everything we build sits on it. If you remember nothing else,
remember this.

**The chain is the source of truth.** Not our database. The chain. The reason is
the whole pitch. When a financier looks at a borrower's creditworthiness, they
read it off the same blockchain a contest judge could read. So when we say
verified, not trust-me, we mean it literally. The database is a convenience
layer on top. The truth is on-chain.

**There are two roles in the product.** The importer, who pays suppliers and
builds a score. And the financier, who reads scores and funds the good ones.
You'll see that split everywhere, including in the screens I'm about to show you.

**Now the rule I care about most. The signing rule.** There are two kinds of
on-chain action and they are signed by different people.

The user signs their own settlement. When an importer pays a supplier, locks
money in escrow, releases it, or refunds, that transaction is signed by the
user, from their own wallet. We never hold their funds and we never sign their
payment. That lives in `lib/chain-client.ts`, on the client.

The operator signs only two things. One, the trusted inspector attesting that a
shipment's paperwork is real. Two, posting the computed credit score on-chain.
Those are legitimately a third party's job, not the buyer's money, so the server
signs them. That lives in `lib/chain.ts` and `lib/eas.ts`.

If you ever find yourself writing code where our server signs a user's payment,
stop. That's the line. Don't cross it.

**And the last piece of the model. The scoring engine.** There's one file,
`lib/corridor.ts`, that turns a history of settled payments into a credit score.
It's pure. No chain, no database, just math. And it's imported by both the front
end, for the optimistic UI, and the back end, for posting the score on-chain. So
here's the rule. Nobody forks it. Nobody writes a second copy. If the client and
the server ever compute the score differently, the number on screen and the
number on-chain disagree, and the entire trust story breaks. One file. Both
sides import it.

## 3. Let me show you the product

"Enough abstraction. Let me walk you through the whole thing as a product, in the
order a real user hits it. Watch for the flywheel underneath. Pay the supplier,
the record writes itself, the score lifts, capital unlocks, the financier funds.

[Share your screen. If you're in live-chain mode or render-only mode, say which.]

[Open the landing page.]

This is the public front door. The whole pitch in one line: settlement that makes
the unfundable legible. We pay the supplier, and the cashflow record falls out.
The call to action drops you into onboarding. One quiet technical note for you
two: this is the only page with no wallet or auth providers loaded. They only
mount once you enter the product. That boundary is deliberate.

[Click into onboarding.]

Onboarding is four beats. First, start with Dhow, which is signing in with Privy.
Email, a passkey, or an existing wallet. Behind the scenes that provisions a
non-custodial embedded wallet, so a user who has never touched crypto still ends
up with a wallet without having to know what one is. Second, set up your business,
the name and location. That business is the account, and everything the server
stores is scoped to this identity. Third, add a supplier, the person they pay.
And then connect the wallet to finish. From here on, that verified Privy identity
is the key the server trusts for every read and write.

[Go to the importer Overview.]

This is home after onboarding. Metric cards across the top, recent activity below.
A brand new account sees an empty state that says make your first payment, which
points them straight at Send. The entire product is built to pull a new user
toward that first settlement, because that first payment is our wedge.

[Go to Send.]

This is the heart of the importer side, so let me slow down. They pick a supplier,
or add one inline. They say what they're paying for. They enter the amount in AED,
and we show the live USDC equivalent. Notice that. We quote and display in AED,
the local currency, but we settle in USDC on Polygon. That split is deliberate and
it's part of our regulatory posture.

Then the settlement mode, and there are two. Open settlement, which is pay now,
straight through. Or Proof-Lock, which escrows the money on-chain and only
releases when shipment proof is attested. Proof-Lock is our version of a letter of
credit, except we never call it that. It de-risks the buyer. If the goods never
show, they get refunded, and that refund counts against their score. When they hit
send, remember, the user signs this from their own wallet. We never sign it for
them.

[Go to Cashflow Record.]

This is where the magic becomes legible, and there are two things on the page. At
the top, the Credit Score, with its full derivation shown. It is not a black box.
The importer can see exactly how the number is built from settled volume, proof
performance, and cadence. That's the same math the financier will read on-chain.
Below it, the ledger of every payment. Settled and in-flight, open settlements,
anything that failed, and a marker when working capital unlocks. A locked
Proof-Lock sits here waiting for proof, and this is also where a disputed shipment
gets refunded.

[If live: trigger the attestation on a locked Proof-Lock and show the release.]

Watch this. An inspector just attested the shipment. The escrow verified it, the
money released to the supplier, and the score moved. That score is now posted
on-chain. That's the loop closing in real time.

[Go to Capital.]

And this is the payoff. Below the eligibility threshold it reads not yet unlocked,
and it shows how close they are. Once enough verified cashflow lifts the score
across the line, a working-capital offer appears, sized to their settled history.
It even shows them the financier's view of the borrower a bank would otherwise
reject. The unfundable, made fundable.

[Go to Suppliers, briefly.]

Quick stop. Just the directory of who they pay. Add and list. Nothing clever, but
it's real account data, scoped to this business in the database.

[Switch to the financier window.]

Now the other side of the marketplace. This is the demand side, the people with
capital. And here's the important part. A borrower only appears over here once
their on-chain score crosses the threshold. So everything the financier sees is
earned.

The Desk is the shortlist, the eligible borrowers, the ones ready to fund.
Opportunities is wider, every scored borrower, so the financier can watch someone
climbing toward the line. Click into a borrower and you get the Deal view, the
underwriting screen. The Credit Score, the verified settlements that back it, and
the advance offer. And this is the whole thesis in one screen: the financier is
reading that score and those settlements off the chain, the same data a judge
could read independently. Then they fund, which is a real USDC transfer the
financier signs from their own wallet to the borrower. Finally, the Portfolio is
their book, every facility they've funded with the settlement transaction
recorded.

[Stop sharing, or leave it up.]

So that's the whole flywheel as a product. Pay the supplier, the record writes
itself, the score lifts, capital unlocks, the financier funds. The payment is the
wedge, the cashflow is the data, and the chain is what makes it trustworthy
without anyone having to take our word for it.

## 4. The handoffs

"Now that you've seen it, let me turn to each of you and tell you what you own.
Open `docs/ONBOARDING.md` while I do this, because the file maps are all in there.

[Turn to the smart contract dev.]

**[SC dev], you own the chain. Everything under `contracts/`.** That's the
Foundry workspace, Solidity. Three contracts matter. `DhowEscrow.sol` is the
Proof-Lock, the lock, release, and refund logic, and it's the one to read first.
`DhowScoreRegistry.sol` is the on-chain credit score the financier reads. And
`MockUSDC.sol`, which is our stand-in test token for now.

Your first hour is this. Run `forge install`, then `forge test`. There are
fifteen passing tests. Then read `DhowEscrow.sol` top to bottom, and then read
its test file, because the tests are the real spec. They cover every rejection
path on release and refund. We also have aderyn wired up for static analysis, so
run that and see what it flags.

Where the real work is for you. Right now the escrow verifies attestations
against an EAS-compatible stand-in, not canonical EAS. Wiring real EAS is open.
And the very first concrete task I want from you, once you're oriented, is taking
us live on Polygon Amoy. The contracts deploy, but the public deployment isn't
fully on testnet yet. That's your beachhead.

[Turn to the backend dev.]

**[Backend dev], you own the server. The server-side `lib` files, the API routes
under `app/api`, and the database schema.** The data model lives in
`db/schema.sql`. The access layer is `lib/store-server.ts`, and there's one thing
I need you to internalise about it. Every single function is scoped by the
business id, which is the verified Privy user id. A caller can only ever read or
write their own rows. That's not optional, that's the security model. Auth
verification is in `lib/privy-server.ts`, and every route that writes data checks
it.

Your first hour. Read `lib/store-server.ts` next to `db/schema.sql`, so you see
the data model in code and in SQL at the same time. Then read one route,
`app/api/corridors/route.ts`, because it shows the whole pattern. Check the auth,
write to the database, read derived state from the chain. Once you've seen that
one route, the others make sense.

One thing you'll notice. Everything is env-gated. If the database or Privy or the
chain isn't configured, the routes degrade gracefully instead of crashing. Keep
that property. It's what lets any of us run the app without every secret.

Where the real work is for you. There's no KYC or AML layer yet. The financier
funding flow can go deeper. And the event indexer caches in memory, which won't
survive at scale. Plenty to build.

[Turn back to yourself.]

**And I've got the product surface. The pages, the components, the design
language.** Everything I just walked you through is mine to own and refine. Where
our work meets is the shared score visual, so the importer and the financier read
the exact same number in the same way.

## 5. How we work together

"Three quick things on process, then questions.

First, the shared seam. Most of the time your lane is your lane and you won't
step on each other. But there are three things that, if you touch them, touch all
of us. The scoring engine `lib/corridor.ts`. The meaning of anything in the score
registry contract. And the EAS attestation schema. If you're changing one of
those, flag it in the pull request and pull the other two of us in before you
merge. Everything else, just ship it.

Second, git. Feature work branches off `main`, you open a pull request, `main`
auto-deploys to Vercel. There's a docs pull request open right now that's just
the onboarding guide. One of you can review and merge it as a warm-up, to check
your access works. Keep `forge test` and the type check green before you ask for
a review.

Third, secrets. A full local run needs three things. Privy keys for auth, a Neon
database url, and the deployed contract addresses on Amoy. Those are not in the
repo and never will be, the env files are gitignored. I'll get you each a set
separately after this call. You can clone and read everything today without them.
You just can't run the live chain path until you have them.

## 6. Close

"That's the tour. To recap the three things that matter most. The chain is the
source of truth. The user signs their own money, the operator signs only the
inspector attestation and the score. And nobody forks the scoring engine.

Read `docs/ONBOARDING.md` today, spend your first hour in your lane the way I
described, and bring me what's confusing. The honest list of what's real versus
what's still a placeholder is the maturity table in the README, and that table is
basically our backlog.

What's not clear? What did I rush?"

[Go to questions.]
</content>
