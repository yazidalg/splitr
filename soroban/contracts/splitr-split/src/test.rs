#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events},
    token::{StellarAssetClient, TokenClient},
    vec, Address, Env, Event as _, String,
};

/// One unit of currency, in the 1e-7 units both the contract and `money.ts` use.
const ONE: i128 = 10_000_000;

fn setup(env: &Env) -> (Address, StellarAssetClient<'_>, TokenClient<'_>) {
    let issuer = Address::generate(env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let address = sac.address();
    (
        address.clone(),
        StellarAssetClient::new(env, &address),
        TokenClient::new(env, &address),
    )
}

fn weights(env: &Env, ws: &[u32]) -> Vec<u32> {
    let mut v = Vec::new(env);
    for w in ws {
        v.push_back(*w);
    }
    v
}

/// The weights every caller here passes are positive, so the only error
/// `split_by_weights` can return is unreachable — unwrapping keeps the
/// assertions below about the arithmetic rather than about plumbing.
fn parts(env: &Env, total: i128, ws: &[u32]) -> soroban_sdk::Vec<i128> {
    split_by_weights(env, total, &weights(env, ws)).unwrap()
}

/// The cases in `scripts/parity.ts`, which runs the same numbers through
/// `src/money.ts`. Both engines have to produce these, or the preview on the
/// landing page is telling people something the chain will not honour.
#[test]
fn agrees_with_money_ts() {
    let env = Env::default();

    // 300,000 across three, evenly. Divides cleanly.
    assert_eq!(
        parts(&env, 300_000 * ONE, &[1, 1, 1]),
        vec![&env, 100_000 * ONE, 100_000 * ONE, 100_000 * ONE],
    );

    // 100,000 across three. Does not divide: one unit is left over and goes to
    // the first largest remainder, which is index 0 on a tie.
    assert_eq!(
        parts(&env, 100_000 * ONE, &[1, 1, 1]),
        vec![&env, 333_333_333_334, 333_333_333_333, 333_333_333_333],
    );

    // Weighted 2:1:1.
    assert_eq!(
        parts(&env, 300_000 * ONE, &[2, 1, 1]),
        vec![&env, 150_000 * ONE, 75_000 * ONE, 75_000 * ONE],
    );

    // 40,000 across seven. Six units left over, so the first six indices take
    // one each and the last is a unit short.
    assert_eq!(
        parts(&env, 40_000 * ONE, &[1, 1, 1, 1, 1, 1, 1]),
        vec![
            &env,
            57_142_857_143,
            57_142_857_143,
            57_142_857_143,
            57_142_857_143,
            57_142_857_143,
            57_142_857_143,
            57_142_857_142,
        ],
    );
}

/// The property the whole design rests on, over a wide spread of inputs.
#[test]
fn parts_always_sum_back_to_the_total() {
    let env = Env::default();
    let cases: [(i128, &[u32]); 8] = [
        (1, &[1, 1, 1]),
        (7, &[1, 1, 1, 1, 1, 1, 1]),
        (100_000 * ONE, &[1, 1, 1]),
        (40_000 * ONE, &[1, 1, 1, 1, 1, 1, 1]),
        (999_999, &[3, 1, 1, 1]),
        (123_456_789, &[5, 3, 2]),
        (1, &[1, 1]),
        (i128::from(u32::MAX) * ONE, &[9, 8, 7, 6, 5, 4, 3, 2, 1]),
    ];

    for (total, ws) in cases {
        let split = parts(&env, total, ws);
        let mut sum: i128 = 0;
        for i in 0..split.len() {
            let part = split.get(i).unwrap();
            assert!(part >= 0, "no share may be negative");
            sum += part;
        }
        assert_eq!(sum, total, "shares must sum back to {}", total);
    }
}

/// Heavier weights never receive less than lighter ones.
#[test]
fn weights_are_respected() {
    let env = Env::default();
    let split = parts(&env, 300_000 * ONE, &[3, 2, 1]);
    assert!(split.get(0).unwrap() > split.get(1).unwrap());
    assert!(split.get(1).unwrap() > split.get(2).unwrap());
}

#[test]
fn settling_moves_the_asset_and_records_it_together() {
    let env = Env::default();
    env.mock_all_auths();

    let (asset, minter, token) = setup(&env);
    let contract = env.register(SplitrSplit, ());
    let client = SplitrSplitClient::new(&env, &contract);

    let rani = Address::generate(&env);
    let dimas = Address::generate(&env);
    let sari = Address::generate(&env);
    minter.mint(&dimas, &(100_000 * ONE));
    minter.mint(&sari, &(100_000 * ONE));

    let id = client.create_bill(
        &rani,
        &String::from_str(&env, "Dinner Sudirman"),
        &asset,
        &(300_000 * ONE),
        &vec![&env, rani.clone(), dimas.clone(), sari.clone()],
        &weights(&env, &[1, 1, 1]),
    );

    // Events are the contract's public log, and an off-chain indexer has nothing
    // else to follow — so assert their exact shape, not just that some were
    // emitted. They have to be read straight after the call that emits them:
    // `Env::default` enables invocation metering, which resets the event buffer
    // at every top-level invocation, so even a read like `outstanding` clears it.
    assert_eq!(
        env.events().all().filter_by_contract(&contract),
        [Created {
            id,
            payer: rani.clone(),
            total: 300_000 * ONE,
        }
        .to_xdr(&env, &contract)],
    );

    // The payer fronted it, so only the other two owe anything.
    assert_eq!(client.outstanding(&id), 200_000 * ONE);

    let moved = client.settle(&id, &dimas);
    // Filtering by contract drops the SAC's own transfer event, which rides in
    // the same invocation — proof the two really are one atomic move.
    assert_eq!(
        env.events().all().filter_by_contract(&contract),
        [Settled {
            id,
            member: dimas.clone(),
            amount: 100_000 * ONE,
        }
        .to_xdr(&env, &contract)],
    );
    assert_eq!(moved, 100_000 * ONE);
    assert_eq!(token.balance(&dimas), 0);
    assert_eq!(token.balance(&rani), 100_000 * ONE);
    assert_eq!(client.outstanding(&id), 100_000 * ONE);

    client.settle(&id, &sari);
    assert_eq!(
        env.events().all().filter_by_contract(&contract),
        [Settled {
            id,
            member: sari.clone(),
            amount: 100_000 * ONE,
        }
        .to_xdr(&env, &contract)],
    );
    assert_eq!(client.outstanding(&id), 0);
    assert_eq!(token.balance(&rani), 200_000 * ONE);
}

#[test]
fn settling_twice_is_refused() {
    let env = Env::default();
    env.mock_all_auths();

    let (asset, minter, _) = setup(&env);
    let client = SplitrSplitClient::new(&env, &env.register(SplitrSplit, ()));

    let rani = Address::generate(&env);
    let dimas = Address::generate(&env);
    minter.mint(&dimas, &(100_000 * ONE));

    let id = client.create_bill(
        &rani,
        &String::from_str(&env, "Kopi"),
        &asset,
        &(100_000 * ONE),
        &vec![&env, rani.clone(), dimas.clone()],
        &weights(&env, &[1, 1]),
    );

    client.settle(&id, &dimas);
    assert_eq!(
        client.try_settle(&id, &dimas),
        Err(Ok(Error::AlreadySettled)),
    );
}

#[test]
fn the_payer_does_not_settle_with_themselves() {
    let env = Env::default();
    env.mock_all_auths();

    let (asset, _, _) = setup(&env);
    let client = SplitrSplitClient::new(&env, &env.register(SplitrSplit, ()));
    let rani = Address::generate(&env);
    let dimas = Address::generate(&env);

    let id = client.create_bill(
        &rani,
        &String::from_str(&env, "Kopi"),
        &asset,
        &(100_000 * ONE),
        &vec![&env, rani.clone(), dimas.clone()],
        &weights(&env, &[1, 1]),
    );

    assert_eq!(
        client.try_settle(&id, &rani),
        Err(Ok(Error::PayerCannotSettle)),
    );
}

#[test]
fn a_stranger_cannot_settle() {
    let env = Env::default();
    env.mock_all_auths();

    let (asset, _, _) = setup(&env);
    let client = SplitrSplitClient::new(&env, &env.register(SplitrSplit, ()));
    let rani = Address::generate(&env);
    let dimas = Address::generate(&env);
    let stranger = Address::generate(&env);

    let id = client.create_bill(
        &rani,
        &String::from_str(&env, "Kopi"),
        &asset,
        &(100_000 * ONE),
        &vec![&env, rani.clone(), dimas.clone()],
        &weights(&env, &[1, 1]),
    );

    assert_eq!(
        client.try_settle(&id, &stranger),
        Err(Ok(Error::NotAMember))
    );
}

#[test]
fn the_payer_has_to_be_on_the_bill() {
    let env = Env::default();
    env.mock_all_auths();

    let (asset, _, _) = setup(&env);
    let client = SplitrSplitClient::new(&env, &env.register(SplitrSplit, ()));
    let outsider = Address::generate(&env);

    assert_eq!(
        client.try_create_bill(
            &outsider,
            &String::from_str(&env, "Kopi"),
            &asset,
            &(100_000 * ONE),
            &vec![&env, Address::generate(&env), Address::generate(&env)],
            &weights(&env, &[1, 1]),
        ),
        Err(Ok(Error::PayerNotMember)),
    );
}

#[test]
fn a_bill_needs_two_people_and_a_weight_each() {
    let env = Env::default();
    env.mock_all_auths();

    let (asset, _, _) = setup(&env);
    let client = SplitrSplitClient::new(&env, &env.register(SplitrSplit, ()));
    let rani = Address::generate(&env);
    let dimas = Address::generate(&env);
    let group = String::from_str(&env, "Kopi");

    assert_eq!(
        client.try_create_bill(
            &rani,
            &group,
            &asset,
            &(100 * ONE),
            &vec![&env, rani.clone()],
            &weights(&env, &[1]),
        ),
        Err(Ok(Error::TooFewMembers)),
    );

    assert_eq!(
        client.try_create_bill(
            &rani,
            &group,
            &asset,
            &(100 * ONE),
            &vec![&env, rani.clone(), dimas.clone()],
            &weights(&env, &[1]),
        ),
        Err(Ok(Error::WeightMismatch)),
    );

    assert_eq!(
        client.try_create_bill(
            &rani,
            &group,
            &asset,
            &0,
            &vec![&env, rani.clone(), dimas.clone()],
            &weights(&env, &[1, 1]),
        ),
        Err(Ok(Error::NotPositive)),
    );
}

#[test]
fn ids_count_up_and_bills_stay_readable() {
    let env = Env::default();
    env.mock_all_auths();

    let (asset, _, _) = setup(&env);
    let client = SplitrSplitClient::new(&env, &env.register(SplitrSplit, ()));
    let rani = Address::generate(&env);
    let dimas = Address::generate(&env);
    let members = vec![&env, rani.clone(), dimas.clone()];

    let first = client.create_bill(
        &rani,
        &String::from_str(&env, "Kopi"),
        &asset,
        &(100 * ONE),
        &members,
        &weights(&env, &[1, 1]),
    );
    let second = client.create_bill(
        &rani,
        &String::from_str(&env, "Nasi goreng"),
        &asset,
        &(200 * ONE),
        &members,
        &weights(&env, &[1, 1]),
    );

    assert_eq!(first, 1);
    assert_eq!(second, 2);
    assert_eq!(client.count(), 2);

    let bill = client.bill(&second);
    assert_eq!(bill.total, 200 * ONE);
    assert_eq!(bill.group, String::from_str(&env, "Nasi goreng"));
    assert_eq!(bill.shares.len(), 2);
    assert_eq!(client.try_bill(&99), Err(Ok(Error::NoSuchBill)));
}

/// Authorisation is the contract's, not the caller's, to assert.
#[test]
fn settling_requires_the_member_to_authorise() {
    let env = Env::default();
    env.mock_all_auths();

    let (asset, minter, _) = setup(&env);
    let contract = env.register(SplitrSplit, ());
    let client = SplitrSplitClient::new(&env, &contract);

    let rani = Address::generate(&env);
    let dimas = Address::generate(&env);
    minter.mint(&dimas, &(100_000 * ONE));

    let id = client.create_bill(
        &rani,
        &String::from_str(&env, "Kopi"),
        &asset,
        &(100_000 * ONE),
        &vec![&env, rani.clone(), dimas.clone()],
        &weights(&env, &[1, 1]),
    );
    client.settle(&id, &dimas);

    let authorised = env.auths();
    assert!(
        authorised.iter().any(|(who, _)| who == &dimas),
        "the member who pays has to be the one who authorised it",
    );
}

/// Paying half now and half later is the ordinary case, not an edge case: the
/// `owes`/`paid` pair always supported it, only `settle` insisted on closing
/// the whole gap at once.
#[test]
fn a_share_can_be_paid_in_parts() {
    let env = Env::default();
    env.mock_all_auths();

    let (asset, minter, token) = setup(&env);
    let contract = env.register(SplitrSplit, ());
    let client = SplitrSplitClient::new(&env, &contract);

    let rani = Address::generate(&env);
    let dimas = Address::generate(&env);
    minter.mint(&dimas, &(100_000 * ONE));

    let id = client.create_bill(
        &rani,
        &String::from_str(&env, "Kopi"),
        &asset,
        &(100_000 * ONE),
        &vec![&env, rani.clone(), dimas.clone()],
        &weights(&env, &[1, 1]),
    );

    assert_eq!(
        client.settle_part(&id, &dimas, &(20_000 * ONE)),
        20_000 * ONE
    );
    // The money moves for the part, not for the whole share.
    assert_eq!(token.balance(&rani), 20_000 * ONE);
    assert_eq!(token.balance(&dimas), 80_000 * ONE);
    assert_eq!(client.outstanding(&id), 30_000 * ONE);

    // A plain `settle` closes whatever is left, so the two compose.
    assert_eq!(client.settle(&id, &dimas), 30_000 * ONE);
    assert_eq!(client.outstanding(&id), 0);
    assert_eq!(token.balance(&rani), 50_000 * ONE);
}

/// Refused rather than clamped: quietly taking less than asked for would make
/// the returned amount disagree with what the caller meant.
#[test]
fn paying_more_than_is_owed_is_refused() {
    let env = Env::default();
    env.mock_all_auths();

    let (asset, minter, _) = setup(&env);
    let client = SplitrSplitClient::new(&env, &env.register(SplitrSplit, ()));

    let rani = Address::generate(&env);
    let dimas = Address::generate(&env);
    minter.mint(&dimas, &(100_000 * ONE));

    let id = client.create_bill(
        &rani,
        &String::from_str(&env, "Kopi"),
        &asset,
        &(100_000 * ONE),
        &vec![&env, rani.clone(), dimas.clone()],
        &weights(&env, &[1, 1]),
    );

    assert_eq!(
        client.try_settle_part(&id, &dimas, &(50_000 * ONE + 1)),
        Err(Ok(Error::Overpayment)),
    );
    // And nothing moved.
    assert_eq!(client.outstanding(&id), 50_000 * ONE);

    for bad in [0i128, -1] {
        assert_eq!(
            client.try_settle_part(&id, &dimas, &bad),
            Err(Ok(Error::NotPositive)),
        );
    }
}

/// `settle` delegates to `settle_part`, so it must fail identically — otherwise
/// the same mistake reports two different reasons depending on which one the
/// caller reached for.
#[test]
fn both_settle_paths_refuse_for_the_same_reasons() {
    let env = Env::default();
    env.mock_all_auths();

    let (asset, _, _) = setup(&env);
    let client = SplitrSplitClient::new(&env, &env.register(SplitrSplit, ()));
    let rani = Address::generate(&env);
    let dimas = Address::generate(&env);
    let stranger = Address::generate(&env);

    let id = client.create_bill(
        &rani,
        &String::from_str(&env, "Kopi"),
        &asset,
        &(100_000 * ONE),
        &vec![&env, rani.clone(), dimas.clone()],
        &weights(&env, &[1, 1]),
    );

    let amount = 1_000 * ONE;
    assert_eq!(
        client.try_settle(&id, &rani),
        client.try_settle_part(&id, &rani, &amount)
    );
    assert_eq!(
        client.try_settle(&id, &stranger),
        client.try_settle_part(&id, &stranger, &amount),
    );
    assert_eq!(
        client.try_settle(&99, &dimas),
        client.try_settle_part(&99, &dimas, &amount)
    );
}

/// Without this index, "my bills" means reading every bill in the contract and
/// filtering client-side — one round trip per bill, every time anyone opens
/// the app.
#[test]
fn a_member_can_find_their_own_bills() {
    let env = Env::default();
    env.mock_all_auths();

    let (asset, _, _) = setup(&env);
    let client = SplitrSplitClient::new(&env, &env.register(SplitrSplit, ()));
    let rani = Address::generate(&env);
    let dimas = Address::generate(&env);
    let sari = Address::generate(&env);

    let first = client.create_bill(
        &rani,
        &String::from_str(&env, "Kopi"),
        &asset,
        &(100 * ONE),
        &vec![&env, rani.clone(), dimas.clone()],
        &weights(&env, &[1, 1]),
    );
    let second = client.create_bill(
        &sari,
        &String::from_str(&env, "Nasi goreng"),
        &asset,
        &(200 * ONE),
        &vec![&env, sari.clone(), dimas.clone()],
        &weights(&env, &[1, 1]),
    );

    // Everyone sees exactly the bills they are on, payer or debtor.
    assert_eq!(client.bills_for(&dimas), vec![&env, first, second]);
    assert_eq!(client.bills_for(&rani), vec![&env, first]);
    assert_eq!(client.bills_for(&sari), vec![&env, second]);

    // Somebody with no bills gets an empty list, not an error.
    assert_eq!(
        client.bills_for(&Address::generate(&env)),
        Vec::<u32>::new(&env)
    );
}

/// A member named twice on one bill is indexed once, or their list would grow
/// a duplicate that the app would render as two separate bills.
#[test]
fn the_index_does_not_repeat_a_bill() {
    let env = Env::default();
    env.mock_all_auths();

    let (asset, _, _) = setup(&env);
    let client = SplitrSplitClient::new(&env, &env.register(SplitrSplit, ()));
    let rani = Address::generate(&env);
    let dimas = Address::generate(&env);

    let id = client.create_bill(
        &rani,
        &String::from_str(&env, "Kopi"),
        &asset,
        &(300 * ONE),
        &vec![&env, rani.clone(), dimas.clone(), dimas.clone()],
        &weights(&env, &[1, 1, 1]),
    );

    assert_eq!(client.bills_for(&dimas), vec![&env, id]);
}
