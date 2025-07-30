// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/// The `hashlock` module provides hash-based time-locked contracts (HTLC)
/// functionality for atomic swaps. This enables cross-chain atomic swaps
/// by requiring revelation of a secret that matches a committed hash.
///
/// The protocol works as follows:
/// 1. A party commits to a hash of a secret along with a time lock
/// 2. The counterparty can claim the locked object by revealing the secret
/// 3. If the secret is not revealed before the timeout, the original sender can reclaim
/// 4. This enables atomic swaps across different chains using the same secret
module escrow::hashlock;

use sui::event;
use sui::dynamic_object_field as dof;
use sui::hash;
use sui::clock::{Self, Clock};

/// The `name` of the DOF that holds the Hashlocked object.
public struct HashlockedObjectKey has copy, drop, store {}

/// A hash-time-locked contract that protects access to `obj` by requiring
/// revelation of a secret that hashes to the committed hash value.
///
/// Object is added as a Dynamic Object Field for discoverability.
public struct Hashlocked<phantom T: key + store> has key, store {
    id: UID,
    /// Hash commitment (keccak256 hash of the secret)
    hash_commitment: vector<u8>,
    /// Sender who can reclaim after timeout
    sender: address,
    /// Recipient who can claim by revealing the secret
    recipient: address,
    /// Timestamp when the hashlock was created (in milliseconds)
    created_at: u64,
    /// Duration after which sender can reclaim (in milliseconds)
    timeout_duration: u64,
}

/// Proof that the secret has been revealed
public struct SecretRevealed has copy, drop {
    /// The revealed secret
    secret: vector<u8>,
    /// Hash of the secret
    secret_hash: vector<u8>,
    /// ID of the hashlock that was unlocked
    hashlock_id: ID,
    /// Address that revealed the secret
    revealer: address,
}

// === Error codes ===

/// The caller is not the intended recipient
const ENotRecipient: u64 = 0;

/// The hashlock has already timed out
const ETimedOut: u64 = 1;

/// The provided secret does not hash to the committed hash
const EInvalidSecret: u64 = 2;

/// The caller is not the sender
const ENotSender: u64 = 3;

/// The timeout has not been reached yet
const ETimeoutNotReached: u64 = 4;

// === Constants ===

/// Default timeout duration: 24 hours in milliseconds
const DEFAULT_TIMEOUT_DURATION: u64 = 86400000;

// === Public Functions ===

/// Create a hashlock with default timeout (24 hours)
public fun create_hashlock<T: key + store>(
    obj: T,
    hash_commitment: vector<u8>,
    recipient: address,
    clock: &Clock,
    ctx: &mut TxContext,
): Hashlocked<T> {
    create_hashlock_with_duration(obj, hash_commitment, recipient, DEFAULT_TIMEOUT_DURATION, clock, ctx)
}

/// Create a hashlock with custom timeout duration
public fun create_hashlock_with_duration<T: key + store>(
    obj: T,
    hash_commitment: vector<u8>,
    recipient: address,
    timeout_duration: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): Hashlocked<T> {
    let current_time = clock::timestamp_ms(clock);
    
    let mut hashlock = Hashlocked<T> {
        id: object::new(ctx),
        hash_commitment,
        sender: ctx.sender(),
        recipient,
        created_at: current_time,
        timeout_duration,
    };

    event::emit(HashlockCreated {
        hashlock_id: object::id(&hashlock),
        hash_commitment,
        sender: hashlock.sender,
        recipient,
        created_at: current_time,
        expires_at: current_time + timeout_duration,
        item_id: object::id(&obj),
    });

    // Add the object as a DOF
    dof::add(&mut hashlock.id, HashlockedObjectKey {}, obj);

    hashlock
}

/// Claim the hashlocked object by revealing the secret.
/// Only the recipient can call this before the timeout.
public fun claim_with_secret<T: key + store>(
    mut hashlock: Hashlocked<T>,
    secret: vector<u8>,
    clock: &Clock,
    ctx: &TxContext,
): T {
    assert!(hashlock.recipient == ctx.sender(), ENotRecipient);
    
    let current_time = clock::timestamp_ms(clock);
    let expiry_time = hashlock.created_at + hashlock.timeout_duration;
    assert!(current_time < expiry_time, ETimedOut);

    // Verify the secret hashes to the commitment
    let secret_hash = hash::keccak256(&secret);
    assert!(secret_hash == hashlock.hash_commitment, EInvalidSecret);

    // Emit event with the revealed secret
    event::emit(SecretRevealed {
        secret,
        secret_hash,
        hashlock_id: object::id(&hashlock),
        revealer: ctx.sender(),
    });

    // Remove the object from DOF
    let obj = dof::remove<HashlockedObjectKey, T>(&mut hashlock.id, HashlockedObjectKey {});

    // Clean up the hashlock
    let Hashlocked { 
        id, 
        hash_commitment: _, 
        sender: _, 
        recipient: _, 
        created_at: _, 
        timeout_duration: _ 
    } = hashlock;
    id.delete();

    obj
}

/// Reclaim the hashlocked object after timeout.
/// Only the sender can call this after the timeout expires.
public fun reclaim_after_timeout<T: key + store>(
    mut hashlock: Hashlocked<T>,
    clock: &Clock,
    ctx: &TxContext,
): T {
    assert!(hashlock.sender == ctx.sender(), ENotSender);
    
    let current_time = clock::timestamp_ms(clock);
    let expiry_time = hashlock.created_at + hashlock.timeout_duration;
    assert!(current_time >= expiry_time, ETimeoutNotReached);

    // Remove the object from DOF
    let obj = dof::remove<HashlockedObjectKey, T>(&mut hashlock.id, HashlockedObjectKey {});

    // Clean up the hashlock
    let Hashlocked { 
        id, 
        hash_commitment: _, 
        sender: _, 
        recipient: _, 
        created_at: _, 
        timeout_duration: _ 
    } = hashlock;
    id.delete();

    obj
}

// === View Functions ===

/// Get the hash commitment
public fun hash_commitment<T: key + store>(hashlock: &Hashlocked<T>): vector<u8> {
    hashlock.hash_commitment
}

/// Get the sender address
public fun sender<T: key + store>(hashlock: &Hashlocked<T>): address {
    hashlock.sender
}

/// Get the recipient address
public fun recipient<T: key + store>(hashlock: &Hashlocked<T>): address {
    hashlock.recipient
}

/// Check if the hashlock has timed out
public fun has_timed_out<T: key + store>(hashlock: &Hashlocked<T>, clock: &Clock): bool {
    let current_time = clock::timestamp_ms(clock);
    let expiry_time = hashlock.created_at + hashlock.timeout_duration;
    current_time >= expiry_time
}

/// Get the expiry timestamp of the hashlock
public fun get_expiry_time<T: key + store>(hashlock: &Hashlocked<T>): u64 {
    hashlock.created_at + hashlock.timeout_duration
}

/// Get the creation timestamp of the hashlock
public fun get_created_at<T: key + store>(hashlock: &Hashlocked<T>): u64 {
    hashlock.created_at
}

/// Get the timeout duration
public fun get_timeout_duration<T: key + store>(hashlock: &Hashlocked<T>): u64 {
    hashlock.timeout_duration
}

// === Events ===

public struct HashlockCreated has copy, drop {
    /// ID of the hashlock
    hashlock_id: ID,
    /// Hash commitment for the secret
    hash_commitment: vector<u8>,
    /// Sender address
    sender: address,
    /// Recipient address
    recipient: address,
    /// Creation timestamp
    created_at: u64,
    /// Expiry timestamp
    expires_at: u64,
    /// ID of the locked item
    item_id: ID,
}

// === Tests ===

#[test_only]
use sui::coin::{Self, Coin};
#[test_only]
use sui::sui::SUI;
#[test_only]
use sui::test_scenario::{Self as ts, Scenario};
#[test_only]
use sui::test_utils;

#[test_only]
fun test_hash_commitment(secret: vector<u8>): vector<u8> {
    hash::keccak256(&secret)
}

#[test]
fun test_hashlock_end_to_end() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = clock::create_for_testing(ctx);

    // Create a coin to lock
    let coin = coin::mint_for_testing<SUI>(100, ctx);
    let secret = b"my_secret_key_123";
    let hash_commitment = test_hash_commitment(secret);
    let recipient = @0x2;

    // Create hashlock
    let hashlock = create_hashlock(coin, hash_commitment, recipient, &clock, ctx);

    ts::next_tx(&mut scenario, recipient);
    let ctx = ts::ctx(&mut scenario);

    // Recipient claims with secret
    let claimed_coin = claim_with_secret(hashlock, secret, &clock, ctx);
    
    // Verify the coin
    assert!(coin::value(&claimed_coin) == 100);
    test_utils::destroy(claimed_coin);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
fun test_hashlock_timeout_reclaim() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let mut clock = clock::create_for_testing(ctx);

    // Create a coin to lock
    let coin = coin::mint_for_testing<SUI>(100, ctx);
    let secret = b"my_secret_key_123";
    let hash_commitment = test_hash_commitment(secret);
    let recipient = @0x2;

    // Create hashlock with short timeout
    let hashlock = create_hashlock_with_duration(coin, hash_commitment, recipient, 1000, &clock, ctx);

    // Advance time past timeout
    clock::increment_for_testing(&mut clock, 2000);

    // Sender reclaims after timeout
    let reclaimed_coin = reclaim_after_timeout(hashlock, &clock, ctx);
    
    // Verify the coin
    assert!(coin::value(&reclaimed_coin) == 100);
    test_utils::destroy(reclaimed_coin);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
} 