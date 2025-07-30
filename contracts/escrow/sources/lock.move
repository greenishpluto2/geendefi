// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0
/// The `lock` module offers an API for wrapping any object that has
/// `store` and protecting it with a single-use `Key`.
///
/// This is used to commit to swapping a particular object in a
/// particular, fixed state during escrow.
module escrow::lock;
use sui::dynamic_object_field as dof;
use sui::event;
use sui::clock::{Self, Clock};

/// The `name` of the DOF that holds the Locked object.
/// Allows better discoverability for the locked object.
public struct LockedObjectKey has copy, drop, store {}

/// A wrapper that protects access to `obj` by requiring access to a `Key`.
///
/// Used to ensure an object is not modified if it might be involved in a
/// swap.
///
/// Object is added as a Dynamic Object Field so that it can still be looked-up.
public struct Locked<phantom T: key + store> has key, store {
    id: UID,
    key: ID,
    /// Timestamp when the lock was created (in milliseconds)
    created_at: u64,
    /// Duration after which the lock can be broken without key (in milliseconds)
    timelock_duration: u64,
}

/// Key to open a locked object (consuming the `Key`)
public struct Key has key, store { id: UID }

// === Error codes ===
/// The key does not match this lock.
const ELockKeyMismatch: u64 = 0;
/// The timelock has not expired yet.
const ETimelockNotExpired: u64 = 1;

// === Constants ===
/// Default timelock duration: 30 seconds in milliseconds
const DEFAULT_TIMELOCK_DURATION: u64 = 30000;

// === Public Functions ===

/// Lock `obj` and get a key that can be used to unlock it.
/// Uses default timelock duration of 30 seconds.
public fun lock<T: key + store>(obj: T, clock: &Clock, ctx: &mut TxContext): (Locked<T>, Key) {
    lock_with_timelock(obj, DEFAULT_TIMELOCK_DURATION, clock, ctx)
}

/// Lock `obj` with a custom timelock duration and get a key that can be used to unlock it.
public fun lock_with_timelock<T: key + store>(
    obj: T, 
    timelock_duration: u64, 
    clock: &Clock, 
    ctx: &mut TxContext
): (Locked<T>, Key) {
    let key = Key { id: object::new(ctx) };
    let current_time = clock::timestamp_ms(clock);
    
    let mut lock = Locked {
        id: object::new(ctx),
        key: object::id(&key),
        created_at: current_time,
        timelock_duration,
    };
    
    event::emit(LockCreated {
        lock_id: object::id(&lock),
        key_id: object::id(&key),
        creator: ctx.sender(),
        item_id: object::id(&obj),
        created_at: current_time,
        expires_at: current_time + timelock_duration,
    });
    
    // Adds the `object` as a DOF for the `lock` object
    dof::add(&mut lock.id, LockedObjectKey {}, obj);
    (lock, key)
}

/// Unlock the object in `locked`, consuming the `key`.  Fails if the wrong
/// `key` is passed in for the locked object.
public fun unlock<T: key + store>(mut locked: Locked<T>, key: Key): T {
    assert!(locked.key == object::id(&key), ELockKeyMismatch);
    let Key { id } = key;
    id.delete();
    
    let obj = dof::remove<LockedObjectKey, T>(&mut locked.id, LockedObjectKey {});
    event::emit(LockDestroyed { 
        lock_id: object::id(&locked),
        unlocked_with_key: true,
    });
    
    let Locked { id, key: _, created_at: _, timelock_duration: _ } = locked;
    id.delete();
    obj
}

/// Break the timelock and retrieve the object without the key.
/// Only works if the timelock duration has expired.
public fun break_timelock<T: key + store>(mut locked: Locked<T>, clock: &Clock): T {
    let current_time = clock::timestamp_ms(clock);
    let expiry_time = locked.created_at + locked.timelock_duration;
    
    assert!(current_time >= expiry_time, ETimelockNotExpired);
    
    let obj = dof::remove<LockedObjectKey, T>(&mut locked.id, LockedObjectKey {});
    event::emit(LockDestroyed { 
        lock_id: object::id(&locked),
        unlocked_with_key: false,
    });
    
    let Locked { id, key: _, created_at: _, timelock_duration: _ } = locked;
    id.delete();
    obj
}

/// Check if the timelock has expired
public fun is_timelock_expired<T: key + store>(locked: &Locked<T>, clock: &Clock): bool {
    let current_time = clock::timestamp_ms(clock);
    let expiry_time = locked.created_at + locked.timelock_duration;
    current_time >= expiry_time
}

/// Get the expiry timestamp of the lock
public fun get_expiry_time<T: key + store>(locked: &Locked<T>): u64 {
    locked.created_at + locked.timelock_duration
}

/// Get the creation timestamp of the lock
public fun get_created_at<T: key + store>(locked: &Locked<T>): u64 {
    locked.created_at
}

/// Get the timelock duration
public fun get_timelock_duration<T: key + store>(locked: &Locked<T>): u64 {
    locked.timelock_duration
}

// === Events ===
public struct LockCreated has copy, drop {
    /// The ID of the `Locked` object.
    lock_id: ID,
    /// The ID of the key that unlocks a locked object in a `Locked`.
    key_id: ID,
    /// The creator of the locked object.
    creator: address,
    /// The ID of the item that is locked.
    item_id: ID,
    /// Timestamp when the lock was created
    created_at: u64,
    /// Timestamp when the timelock expires
    expires_at: u64,
}

public struct LockDestroyed has copy, drop {
    /// The ID of the `Locked` object.
    lock_id: ID,
    /// Whether the lock was unlocked with a key (true) or timelock expired (false)
    unlocked_with_key: bool,
}


// === Tests ===
// #[test_only]
// use sui::coin::{Self, Coin};
// #[test_only]
// use sui::sui::SUI;
// #[test_only]
// use sui::test_scenario::{Self as ts, Scenario};

// #[test_only]
// fun test_coin(ts: &mut Scenario): Coin<SUI> {
//     coin::mint_for_testing<SUI>(42, ts.ctx())
// }

// #[test]
// fun test_lock_unlock() {
//     let mut ts = ts::begin(@0xA);
//     let coin = test_coin(&mut ts);

//     let (lock, key) = lock(coin, ts.ctx());
//     let coin = lock.unlock(key);

//     coin.burn_for_testing();
//     ts.end();
// }

// #[test]
// fun test_break_after_timeout() {
//     let mut ts = ts::begin(@0xA);
//     let coin = test_coin(&mut ts);
//     let mut clock = clock::create_for_testing(ts.ctx());
//     let (lock, _key) = lock(coin, &clock, ts.ctx());

//     // Not expired yet
//     assert!(break_if_expired(lock, &clock).is_none());

//     // Fast forward time
//     clock::increment_for_testing(&mut clock, 31_000);
//     let result = break_if_expired(lock, &clock);
//     assert!(result.is_some());
//     result.some().burn_for_testing();
//     ts.end();
// }

// #[test]
// #[expected_failure(abort_code = ELockKeyMismatch)]
// fun test_lock_key_mismatch() {
//     let mut ts = ts::begin(@0xA);
//     let coin = test_coin(&mut ts);
//     let another_coin = test_coin(&mut ts);
//     let (l, _k) = lock(coin, ts.ctx());
//     let (_l, k) = lock(another_coin, ts.ctx());

//     let _key = l.unlock(k);
//     abort 1337
// }