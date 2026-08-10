#![no_std]

//! Group bills, split on-chain.
//!
//! The contract computes the shares itself rather than storing numbers handed
//! to it. If it only recorded what the bill's creator typed, the creator could
//! quietly give themselves a smaller share, and putting any of this on a ledger
//! would buy nothing. Computing it here is the point: the arithmetic is as
//! public as the payments.
//!
//! Settlement runs through the asset's Stellar Asset Contract, so the transfer
//! and the record of it are one atomic event. There is no "mark as paid" that
//! can drift from what actually moved.
//!
//! The algorithm is the largest-remainder method, matching `src/money.ts` digit
//! for digit; `test::agrees_with_money_ts` pins the cases both must satisfy.
//! Amounts are integer counts of 1e-7 of the asset, Stellar's own precision, so
//! a share is never a rounded float.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, Env,
    String, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// A bill needs at least two participants.
    TooFewMembers = 1,
    /// One weight per member, no more and no less.
    WeightMismatch = 2,
    /// Totals and weights must be above zero.
    NotPositive = 3,
    /// The payer has to be one of the members.
    PayerNotMember = 4,
    /// No bill with that id.
    NoSuchBill = 5,
    /// That address is not on this bill.
    NotAMember = 6,
    /// Nothing left to pay.
    AlreadySettled = 7,
    /// The payer fronted the bill; they do not settle with themselves.
    PayerCannotSettle = 8,
    /// A payment larger than what is still owed.
    Overpayment = 9,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Share {
    pub member: Address,
    pub weight: u32,
    /// In units of 1e-7 of the asset.
    pub owes: i128,
    pub paid: i128,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Bill {
    pub id: u32,
    pub group: String,
    /// Stellar Asset Contract address of the settlement asset.
    pub asset: Address,
    pub payer: Address,
    pub total: i128,
    pub shares: Vec<Share>,
}

#[contracttype]
pub enum DataKey {
    Counter,
    Bill(u32),
    /// Bill ids this address is on. Without it, "my bills" means fetching every
    /// bill in the contract and filtering client-side — one RPC round trip per
    /// bill, every time anyone opens the app.
    Member(Address),
}

/// A bill was recorded. `id` is a topic so an indexer can subscribe to one bill
/// without reading the whole contract's history.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Created {
    #[topic]
    pub id: u32,
    pub payer: Address,
    pub total: i128,
}

/// A member paid their share. Emitted in the same invocation as the transfer,
/// so an indexer that sees this has seen money move.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Settled {
    #[topic]
    pub id: u32,
    pub member: Address,
    pub amount: i128,
}

const TTL_THRESHOLD: u32 = ledgers_in_days(20);
const TTL_EXTEND: u32 = ledgers_in_days(45);

/// Testnet closes a ledger about every five seconds.
const fn ledgers_in_days(days: u32) -> u32 {
    days * 24 * 60 * 60 / 5
}

#[contract]
pub struct SplitrSplit;

#[contractimpl]
impl SplitrSplit {
    /// Records a bill and computes what each member owes.
    ///
    /// The payer's own share is marked settled on creation. They fronted the
    /// money; the debt runs from everyone else to them.
    pub fn create_bill(
        env: Env,
        payer: Address,
        group: String,
        asset: Address,
        total: i128,
        members: Vec<Address>,
        weights: Vec<u32>,
    ) -> Result<u32, Error> {
        payer.require_auth();

        if members.len() < 2 {
            return Err(Error::TooFewMembers);
        }
        if members.len() != weights.len() {
            return Err(Error::WeightMismatch);
        }
        if total <= 0 {
            return Err(Error::NotPositive);
        }

        let owed = split_by_weights(&env, total, &weights)?;

        let mut shares = Vec::new(&env);
        let mut payer_is_member = false;
        for i in 0..members.len() {
            let member = members.get(i).unwrap();
            let is_payer = member == payer;
            payer_is_member |= is_payer;
            let owes = owed.get(i).unwrap();
            shares.push_back(Share {
                member,
                weight: weights.get(i).unwrap(),
                owes,
                paid: if is_payer { owes } else { 0 },
            });
        }
        if !payer_is_member {
            return Err(Error::PayerNotMember);
        }

        let id: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Counter)
            .unwrap_or(0u32)
            + 1;

        for i in 0..members.len() {
            index_member(&env, &members.get(i).unwrap(), id);
        }
        env.storage().instance().set(&DataKey::Counter, &id);
        env.storage()
            .instance()
            .extend_ttl(TTL_THRESHOLD, TTL_EXTEND);

        put(
            &env,
            &Bill {
                id,
                group,
                asset,
                payer: payer.clone(),
                total,
                shares,
            },
        );

        Created { id, payer, total }.publish(&env);

        Ok(id)
    }

    /// Pays off the caller's remaining share and records it in one move.
    ///
    /// The transfer goes through the asset's SAC, so the ledger entry and the
    /// contract's record cannot disagree: either both happened or neither did.
    /// Returns the amount transferred.
    pub fn settle(env: Env, id: u32, member: Address) -> Result<i128, Error> {
        let remaining = remaining_of(&env, id, &member)?;
        Self::settle_part(env, id, member, remaining)
    }

    /// Pays part of the caller's share.
    ///
    /// Someone who cannot cover their whole share today can still pay half of
    /// it, and the bill records exactly that rather than staying at zero. The
    /// `owes`/`paid` pair already carried this state; only `settle` insisted on
    /// closing the gap in one move.
    pub fn settle_part(env: Env, id: u32, member: Address, amount: i128) -> Result<i128, Error> {
        member.require_auth();

        if amount <= 0 {
            return Err(Error::NotPositive);
        }

        let mut bill = load(&env, id)?;
        if member == bill.payer {
            return Err(Error::PayerCannotSettle);
        }

        let index = index_of(&bill.shares, &member).ok_or(Error::NotAMember)?;
        let mut share = bill.shares.get(index).unwrap();
        let remaining = share.owes - share.paid;
        if remaining <= 0 {
            return Err(Error::AlreadySettled);
        }
        // Refused rather than clamped: silently taking less than asked for
        // would make the returned amount disagree with the caller's intent.
        if amount > remaining {
            return Err(Error::Overpayment);
        }

        token::Client::new(&env, &bill.asset).transfer(&member, &bill.payer, &amount);

        share.paid += amount;
        bill.shares.set(index, share);
        put(&env, &bill);

        Settled { id, member, amount }.publish(&env);

        Ok(amount)
    }

    /// Bill ids this address is a member of, newest last.
    pub fn bills_for(env: Env, member: Address) -> Vec<u32> {
        env.storage()
            .persistent()
            .get(&DataKey::Member(member))
            .unwrap_or_else(|| Vec::new(&env))
    }

    pub fn bill(env: Env, id: u32) -> Result<Bill, Error> {
        load(&env, id)
    }

    /// What the group still owes the payer, in units of 1e-7.
    pub fn outstanding(env: Env, id: u32) -> Result<i128, Error> {
        let bill = load(&env, id)?;
        let mut total: i128 = 0;
        for i in 0..bill.shares.len() {
            let s = bill.shares.get(i).unwrap();
            let remaining = s.owes - s.paid;
            if remaining > 0 {
                total += remaining;
            }
        }
        Ok(total)
    }

    /// How many bills this contract has recorded.
    pub fn count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Counter)
            .unwrap_or(0u32)
    }
}

fn load(env: &Env, id: u32) -> Result<Bill, Error> {
    let key = DataKey::Bill(id);
    let bill: Bill = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(Error::NoSuchBill)?;
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);
    Ok(bill)
}

fn put(env: &Env, bill: &Bill) {
    let key = DataKey::Bill(bill.id);
    env.storage().persistent().set(&key, bill);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);
}

/// What `who` still owes on this bill, with the same checks and the same error
/// order `settle_part` applies — so `settle` can never fail differently from
/// the call it delegates to.
fn remaining_of(env: &Env, id: u32, who: &Address) -> Result<i128, Error> {
    let bill = load(env, id)?;
    if who == &bill.payer {
        return Err(Error::PayerCannotSettle);
    }
    let index = index_of(&bill.shares, who).ok_or(Error::NotAMember)?;
    let share = bill.shares.get(index).unwrap();
    let remaining = share.owes - share.paid;
    if remaining <= 0 {
        return Err(Error::AlreadySettled);
    }
    Ok(remaining)
}

/// Appends a bill id to a member's index, skipping ids already there so a
/// member listed twice on one bill is recorded once.
fn index_member(env: &Env, member: &Address, id: u32) {
    let key = DataKey::Member(member.clone());
    let mut ids: Vec<u32> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env));
    for i in 0..ids.len() {
        if ids.get(i).unwrap() == id {
            return;
        }
    }
    ids.push_back(id);
    env.storage().persistent().set(&key, &ids);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);
}

fn index_of(shares: &Vec<Share>, who: &Address) -> Option<u32> {
    for i in 0..shares.len() {
        if &shares.get(i).unwrap().member == who {
            return Some(i);
        }
    }
    None
}

/// Largest-remainder split.
///
/// Every part is floored, then the units left over by flooring are handed out
/// one each to the largest remainders, ties broken by position. The parts
/// therefore always sum back to `total` exactly: nothing is invented and
/// nothing is lost. This mirrors `splitByWeights` in `src/money.ts`, tie-break
/// included, because both have to produce the same number for the same bill.
pub fn split_by_weights(env: &Env, total: i128, weights: &Vec<u32>) -> Result<Vec<i128>, Error> {
    let n = weights.len();

    let mut weight_sum: i128 = 0;
    for i in 0..n {
        weight_sum += weights.get(i).unwrap() as i128;
    }
    if weight_sum <= 0 {
        return Err(Error::NotPositive);
    }

    let mut parts: Vec<i128> = Vec::new(env);
    let mut remainders: Vec<i128> = Vec::new(env);
    let mut assigned: i128 = 0;

    for i in 0..n {
        let w = weights.get(i).unwrap() as i128;
        let numerator = total * w;
        let part = numerator / weight_sum;
        parts.push_back(part);
        remainders.push_back(numerator % weight_sum);
        assigned += part;
    }

    // Order by remainder descending, ties by index ascending. A selection sort
    // is the right tool at this size: a bill has a handful of members, and the
    // ordering has to come out identical on every machine.
    let mut order: Vec<u32> = Vec::new(env);
    let mut taken: Vec<bool> = Vec::new(env);
    for _ in 0..n {
        taken.push_back(false);
    }
    for _ in 0..n {
        let mut best: Option<u32> = None;
        for i in 0..n {
            if taken.get(i).unwrap() {
                continue;
            }
            match best {
                None => best = Some(i),
                Some(b) => {
                    if remainders.get(i).unwrap() > remainders.get(b).unwrap() {
                        best = Some(i);
                    }
                }
            }
        }
        let b = best.ok_or(Error::TooFewMembers)?;
        taken.set(b, true);
        order.push_back(b);
    }

    let mut leftover = total - assigned;
    let mut k: u32 = 0;
    while leftover > 0 {
        let idx = order.get(k % n).unwrap();
        parts.set(idx, parts.get(idx).unwrap() + 1);
        k += 1;
        leftover -= 1;
    }

    Ok(parts)
}

mod test;
