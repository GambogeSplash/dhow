# Dhow, explained for the team

This is the plain-language version. No jargon, no pitch voice. If you read one doc to understand what we are building and why, read this one. The formal brief is in `BRIEF.md`.

---

## The one-sentence version

Dhow pays a UAE importer's overseas supplier in minutes using stablecoin, and every payment we settle quietly builds a verified track record that lets a bank or investor safely lend that importer money they could never get before.

Two things are happening at once: a **payment product** people will use today, and a **credit data engine** that runs in the background off those payments. The payment is the hook. The data is the moat.

---

## The problem (who hurts, and why)

A small import business in Dubai (call them Al Noor Trading) buys goods from a factory in Shenzhen. To pay that factory today they go through correspondent banking: the money hops across two or three banks, takes 7 to 10 days, loses a chunk to FX spread and fees, and nobody can see the status until it lands.

Worse, when Al Noor wants a small working-capital loan to buy the next container, the bank says no. Banks reject roughly **41% of SME trade-finance requests** (versus 7% for big multinationals). The reason is not that Al Noor is a bad bet. It is that the bank **cannot see** Al Noor's cashflow in a form it trusts. There is no clean, verifiable record of "this business reliably pays and gets paid." So the bank defaults to no.

That gap (good businesses that look invisible to lenders) is a **$2.5 trillion** global trade-finance shortfall. That is the hole we are climbing into.

---

## The idea (what Dhow actually does)

Dhow does the payment, and the payment leaves a trail we own.

1. **We settle the supplier payment** in native USDC on Polygon (a fast, sub-cent blockchain), with AED shown as the display currency so the importer thinks in dirhams. Minutes, not days. Transparent FX. Both sides see the same record.

2. **For higher-value shipments we use a Proof-Lock.** The money locks in escrow on-chain and only releases to the supplier when a shipment proof is attested (for example, an inspector confirms the container shipped). This is the safe, conditional version of a payment that a bank charges a fee and ten days to administer. It also produces a clean signal: this importer pays, and they pay on real fulfilment.

3. **Every settled payment writes to a Cashflow Record.** That is the importer's verified cashflow ledger, building up automatically as a by-product of paying suppliers. As it fills, a **Credit Score** rises. This is the underwriting data banks structurally cannot get, because we settled the payments ourselves so the data cannot be faked.

4. **Once the score crosses a threshold, Dhow surfaces that importer to financiers** (banks, funds, investors already in the UAE) who can now fund the exact SMEs they used to reject. We do not lend our own money. We match a de-risked borrower to a third-party financier and take a fee.

So the loop is: **pay supplier → record falls out → score rises → financing unlocks → importer keeps settling on us to keep the financing alive.** That last part is the lock-in: the loan stays safe only while the importer keeps using our rails, so they do not leave.

---

## What we are NOT (read this twice)

These distinctions matter, and people get them wrong constantly:

- **We are not a lender.** We never put our own balance sheet at risk. We hand the financing to the banks and funds in the room. This keeps us capital-light and sidesteps needing a lending licence.
- **We are not a wallet or a crypto app.** The importer thinks in dirhams and trade. Stablecoin is plumbing they barely notice.
- **We do not ask anyone to "digitize trade."** Earlier players (Marco Polo, we.trade, Contour) died asking corporates to change their whole process with no immediate payoff. We just pay your supplier faster and cheaper. The valuable data is a side effect, not a chore we ask the customer to do.

The shortest way to say it: **"We don't ask anyone to digitize trade. We pay their suppliers, and the ledger falls out."**

---

## A concrete use case

**Who:** Al Noor Trading, a Dubai importer of electronic components. Owner is Mariam. She buys from Meridian Components in Shenzhen and brings goods in through Jebel Ali port.

**Before Dhow:** Mariam wires Meridian through her bank. It takes 9 days, she loses on FX, and she spends a week not knowing if the money arrived. When she asks her bank for AED 50,000 to fund the next order, they decline because they cannot verify her cashflow.

**With Dhow:**
- She pays Meridian through Dhow. Settles in minutes, FX is shown up front, both she and Meridian see the same confirmed record.
- For her big quarterly order she uses a Proof-Lock: the funds lock on-chain and release the moment the shipment is attested. No bank fee, no ten-day wait.
- After a few of these, her Cashflow Record shows three clean, verified settlements. Her Credit Score crosses the line.
- Dhow surfaces her to Creek Capital, a financier on the platform. Creek can see three real shipments settled and verified on our rails, so they extend AED 50,000 in working capital. Mariam accepts in one tap. The money lands.
- The morning of, she was an unfundable 41%-rejection SME. By the afternoon she drew working capital, because a third party could finally see her cashflow.

---

## The 90-second demo (the scenario we show judges)

This is the script for Demo Day. The whole point: the credit offer must **visibly derive** from payments the judge just watched settle. If it just appears, it is a mockup. If it derives, the flywheel is proven.

| Time | What happens on screen |
|---|---|
| 0:00 to 0:20 | **Send a Proof-Lock.** Al Noor pays Meridian. AED-quoted USDC locks in escrow on Polygon (a real testnet transaction). This is the conditional payment a bank charges a fee and ten days for. |
| 0:20 to 0:35 | **Condition fires.** The shipment proof is attested. Funds release automatically to Meridian, settled in seconds, FX shown. Seven to ten days just became this. |
| 0:35 to 0:55 | **Record updates, live.** The settlement writes to the Cashflow Record and the score ticks up off the payment that just cleared. The third payment crosses the threshold. |
| 0:55 to 1:20 | **Capital, from a real counterparty.** Crossing the threshold surfaces Al Noor to Creek Capital, which extends AED 50,000 against the payment. Al Noor accepts in one tap. The capital lands. A third party funded it, not us. |
| 1:20 to 1:30 | **Close.** "Al Noor was a 41%-rejection SME this morning. It just drew working capital, because Creek Capital can see three shipments settled and verified on our rails. We don't lend. We make the unfundable legible, and we hand the financing to the room." |

---

## How we make money

- **Settlement fee:** a small cut (basis points) on payment volume, cheaper than correspondent banking plus the FX spread. We earn from day one, with zero credit risk.
- **Proof-Lock premium:** a small fee on conditional settlements (the higher-value flows).
- **Capital match fee:** a take-rate on each financing facility we match.
- **Data feed subscription:** a financier pays for the ongoing verified cashflow stream. This is the recurring revenue and the anti-disintermediation lock at the same time.

---

## Why this is allowed (the regulatory short version)

People worry "is crypto payment even legal in the UAE?" The answer for our setup is yes, and here is the careful version:

- There is **no AED stablecoin on Polygon** today, so we settle in **native USDC** and use **AED only as the display and invoicing currency**.
- We sit in the **DIFC free zone under the DFSA**, in their innovation sandbox (the Innovation Testing Licence). The onshore UAE rule that governs merchants accepting stablecoins (PTSR) **excludes the free zones**, so it does not apply to us. We are a cross-border B2B trade-finance settlement product, not an onshore shop taking crypto at the till.
- Three phrases we never use, because they are wrong or legally loaded: "letter of credit" (we say Proof-Lock), "we lend" (we match), and "world's first stablecoin regulation" (the EU's MiCA came first).

---

## Where the project is right now

- The full product is built and runs: four surfaces (Send, Cashflow Record, Capital, plus a Receipt view), real accounts and onboarding, free-form payments, a refund and dispute path.
- The on-chain settlement works on a local blockchain (real escrow contract, lock and release verified). Going live on Polygon's public testnet (Amoy) is the one parked step, waiting on funding a test wallet.
- It is deployed and clickable at **https://dhow-pi.vercel.app** (running in simulation mode, so it demos without needing live chain config).
- The written application to the challenge is drafted in `docs/APPLICATION.md`. The team section still needs filling in.

If anything here is unclear, that is a bug in this doc, not in your understanding. Tell me and I will fix the doc.
