# Onboarding call: script and product walkthrough

A script to recite on the team kickoff call, plus a screen-by-screen product
walkthrough to drive live while sharing your screen.

How to use this:
- **Part A** is the spoken script. Read it close to verbatim. Bracketed lines
  are stage directions for you, not to be read out.
- **Part B** is the product walkthrough. Run it where Part A says
  "go to the walkthrough now," with the app open on your screen.
- Swap `[SC dev]` and `[backend dev]` for real names before the call.
- Companion reference: [`ONBOARDING.md`](ONBOARDING.md) is the written version
  the team reads afterward. This doc is the spoken version you deliver.

Paces to about 20 to 30 minutes with the walkthrough, plus questions.

---

# Part A: The script

## 0. Open (1 min)

"Thanks for jumping on. The goal today is simple. By the end of this call you
both know what Dhow is, how the system fits together, and exactly which part of
the codebase is yours to start on. I'll talk for about fifteen minutes, then
I'll click through the actual product so it's concrete, then we go to questions.
And I want questions.

There's an onboarding doc in the repo at `docs/ONBOARDING.md`. Everything I say
maps to it, so you don't have to take notes. Read it properly after the call.
Right now just listen for the shape.

## 1. What Dhow is, in plain terms (2 min)

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

## 2. The one mental model (3 min)

"Now the part I need both of you to hold in your head for everything we build.
If you remember nothing else, remember this.

**The chain is the source of truth.** Not our database. The chain. The reason is
the whole pitch. When a financier looks at a borrower's creditworthiness, they
read it off the same blockchain a contest judge could read. So when we say
verified, not trust-me, we mean it literally. The database is a convenience
layer on top. The truth is on-chain.

**There are two roles in the product.** The importer, who pays suppliers and
builds a score. And the financier, who reads scores and funds the good ones.
They live in different parts of the app and you'll see that split everywhere.

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

## 3. The flywheel, walked as a story (3 min)

"Let me walk the happy path once, as a sequence of real transactions, so the
abstract becomes concrete. Five steps. I'll show you all of this on screen in a
minute, so just hold the shape for now.

One. Lock. The importer sends what we call a Proof-Lock. They sign it from their
own wallet, and the escrow contract pulls their USDC in and holds it.

Two. Attest. The shipment arrives and a trusted inspector signs an attestation
that the paperwork checks out. That's an EAS attestation, and it returns a
unique id. This is one of the two operator-signed steps.

Three. Release. The escrow contract verifies that attestation. Correct schema,
not revoked, not expired, signed by the actual inspector, and bound to this
specific deal so it can't be replayed. If all that holds, the money releases to
the supplier. And here's the elegant part. Once a valid attestation exists, the
release is permissionless. The attestation itself is the authorisation. The user
signs the release from their wallet.

Four. Score. The server recomputes the credit score with that pure engine we
just talked about, and posts it on-chain to the score registry.

Five. Surface and fund. On the financier side, they read the borrower feed, see
the score has crossed the eligibility threshold, and fund the importer with a
real USDC transfer they sign from their own wallet.

That's the loop. Pay, prove, release, score, fund. Every step is a real on-chain
transaction. This already works end to end. Your job is to make each layer of it
more real and more robust.

[Go to the walkthrough now. Run Part B with the app on screen, then come back
here for section 4.]

## 4. The handoffs (5 min)

"Okay. Now that you've seen the product, I'm going to turn to each of you and
tell you what you own. Open `docs/ONBOARDING.md` while I do this, because the
file maps are all in there.

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
language.** I'll own how the two sides feel and how the flywheel reads to a
human. Where our work meets is the shared score visual, so the importer and the
financier read the exact same number in the same way.

## 5. How we work together (2 min)

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

## 6. Close (1 min)

"That's the tour. To recap the three things that matter most. The chain is the
source of truth. The user signs their own money, the operator signs only the
inspector attestation and the score. And nobody forks the scoring engine.

Read `docs/ONBOARDING.md` today, spend your first hour in your lane the way I
described, and bring me what's confusing. The honest list of what's real versus
what's still a placeholder is the maturity table in the README, and that table is
basically our backlog.

What's not clear? What did I rush?"

[Go to questions.]

---

# Part B: Product walkthrough

Drive this live with the app open. The order below is the flywheel in the order a
real user hits it. If you can, have two browser windows side by side: one signed
in as the importer, one as the financier. Say what you're clicking and why as you
go. The spoken cues in quotes are optional, use your own words.

## Setup before the call

- Run the app: `npm run dev -- -p 4400`, open `http://localhost:4400`.
- If the live chain and database are wired (Privy, Neon, Amoy addresses), you can
  show real transactions and real Polygonscan links. If not, the surfaces still
  render and you can narrate the flow. Say which mode you're in up front.
- Have the importer window onboarded already, or onboard live as step 2 if you
  want them to see it. Have the financier window open in a second tab.

## The map of surfaces

Two role areas, each with its own left-nav.

- **Importer** (`app/(app)`): Overview, Send, Cashflow Record, Capital,
  Suppliers.
- **Financier** (`app/(financier)`): Desk, Opportunities, Deal, Portfolio.

## 1. Landing (`app/page.tsx`)

"This is the public front door. The whole pitch in one line: settlement that
makes the unfundable legible. We pay the supplier, and the cashflow record falls
out. The call to action drops you into onboarding."

Point out: this is the only provider-free page, the wallet and auth providers
only load once you enter the product. That's a deliberate boundary.

## 2. Onboarding (`app/onboarding`)

Walk the steps in order. The headings on screen are the script:
- **Start with Dhow.** Sign in with Privy. Email, passkey, or an existing wallet.
  "This provisions a non-custodial embedded wallet behind the scenes. The user
  doesn't have to know what a wallet is."
- **Set up your business.** Name, city, country. "This is the account. Everything
  the server stores is scoped to this identity."
- **Add a supplier.** "Who they pay. You can add more later."
- Connect the wallet to finish.

Say: "The verified Privy identity is the key the server trusts for every read and
write from here on."

## 3. Importer: Overview (`/overview`)

"This is home after onboarding. Metric cards across the top, recent activity
below. A brand new account sees an empty state that says make your first payment,
which points them straight at Send. The whole product is built to pull a new user
toward that first settlement, because that first payment is the wedge."

## 4. Importer: Send (`/send`)

This is the heart of the importer side. Walk the form:
- Pick a supplier, or add a new one inline.
- **What are you paying for.** The goods.
- **Amount in AED**, with the live USDC equivalent shown. "We quote and display in
  AED, the local currency, but we settle in USDC on Polygon. That distinction is
  deliberate and it's part of our regulatory posture."
- **Settlement mode.** Two choices.
  - **Open settlement.** Pay now, straight through.
  - **Proof-Lock.** Escrow the money on-chain, and it only releases when shipment
    proof is attested. "This is our version of a letter of credit, except we never
    call it that. It de-risks the buyer. If the goods don't show, they get
    refunded, and that refund counts against the score."

Say: "When they hit send, the user signs this from their own wallet. We never
sign it for them."

## 5. Importer: Cashflow Record (`/corridor`)

"This is where the magic becomes legible. Two things on this page.

At the top, the **Credit Score**, with its full derivation shown. It's not a
black box. The importer can see exactly how the number is built from settled
volume, proof performance, and cadence. Same math the financier will read
on-chain.

Below it, the ledger of every payment. Settled and in-flight, open settlements,
anything that failed, and a marker when working capital unlocks. A locked
Proof-Lock sits here waiting for proof. This is also where a disputed shipment
gets refunded."

If live: trigger the attestation on a locked Proof-Lock and show the release. "An
inspector attested the shipment, the escrow verified it, the money released to the
supplier, and the score just moved. That score post is now on-chain."

## 6. Importer: Capital (`/capital`)

"This is the payoff. Below the eligibility threshold it reads not yet unlocked,
and it shows how close they are. Once enough verified cashflow lifts the score
across the line, a working-capital offer appears, sized to their settled history.
And it shows them the financier's view of the borrower a bank would otherwise
reject. The unfundable, made fundable."

## 7. Importer: Suppliers (`/suppliers`)

Quick stop. "Just the directory of who they pay. Add and list. Nothing clever,
but it's real account data, scoped to this business in the database."

## 8. Switch to the financier window

"Now the other side of the marketplace. This is the demand side, the people with
capital. A borrower only shows up over here once their on-chain score crosses the
threshold. So everything the financier sees is earned."

## 9. Financier: Desk (`/desk`)

"The desk is the shortlist. Eligible borrowers, the ones who have crossed the
line and are ready to fund. Empty until someone qualifies."

## 10. Financier: Opportunities (`/opportunities`)

"Wider than the desk. Every scored borrower, not just the eligible ones, so the
financier can watch someone climbing toward the threshold."

## 11. Financier: Deal (`/deal/[business]`)

"Click into a borrower and this is the underwriting view. The Credit Score, the
verified settlements that back it, and the advance offer. Crucially, the
financier is reading the score and the corridors off the chain, the same data a
judge could read independently. Then they fund. That's a real USDC transfer the
financier signs from their own wallet to the borrower."

## 12. Financier: Portfolio (`/portfolio`)

"And finally, the financier's book. Every facility they've funded, with the
settlement transaction recorded. This closes the loop. Money moved, on-chain,
verifiable, and the borrower who couldn't get a bank loan now has working
capital."

## Land the walkthrough

"So that's the whole flywheel as a product. Pay the supplier, the record writes
itself, the score lifts, capital unlocks, the financier funds. The payment is the
wedge, the cashflow is the data, and the chain is what makes it trustworthy
without anyone having to take our word for it. Now let me tell you who owns what."

[Return to Part A, section 4.]
</content>
