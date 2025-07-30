// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/// An enhanced escrow for atomic swap of objects using shared objects with
/// hashlock functionality for cross-chain atomic swaps.
///
/// The protocol combines the existing escrow mechanism with hashlock (HTLC)
/// to enable trustless cross-chain swaps:
///
/// 1. Party A creates a hashlock commitment with a secret on Chain 1
/// 2. Party B creates an escrow on Chain 2 with the same hash commitment
/// 3. Party A can claim from Chain 2 by revealing the secret
/// 4. Party B uses the revealed secret to claim from Chain 1
/// 5. If timeouts occur, parties can reclaim their original assets
module escrow::hashlock_shared;

use escrow::lock::{Locked, Key};
use escrow::hashlock::{Hashlocked};
use sui::dynamic_object_field as dof;
use sui::event;
use sui::hash;
use sui::clock::{Self, Clock};

/// The `name` of the DOF that holds the Escrowed object.
public struct EscrowedObjectKey has copy, drop, store {}

/// An enhanced escrow object with hashlock functionality
///
/// The escrowed object is added as a Dynamic Object Field.
public struct HashlockEscrow<phantom T: key + store> has key, store {
    id: UID,
    /// Owner of `escrowed`
    sender: address,
    /// Intended recipient
    recipient: address,
    /// Hash commitment for the secret (same as used on other chains)
    hash_commitment: vector<u8>,
    /// Timestamp when the escrow was created (in milliseconds)
    created_at: u64,
    /// Duration after which sender can reclaim (in milliseconds)
    timeout_duration: u64,
    /// ID of the key that opens the lock on the object sender wants from recipient
    exchange_key: ID,
}

// === Error codes ===

/// The `sender` and `recipient` of the two objects do not match
const EMismatchedSenderRecipient: u64 = 0;

/// The `exchange_for` fields do not match
const EMismatchedExchangeObject: u64 = 1;

/// The provided secret does not hash to the committed hash
const EInvalidSecret: u64 = 2;

/// The hashlock has already timed out
const ETimedOut: u64 = 3;

/// Hash commitments do not match
const EMismatchedHashCommitment: u64 = 5;

// === Constants ===

/// Default timeout duration: 24 hours in milliseconds
const DEFAULT_TIMEOUT_DURATION: u64 = 86400000;

// === Public Functions ===

/// Create a hashlock-enabled escrow with default timeout (24 hours)
public fun create_hashlock_escrow<T: key + store>(
    escrowed: T,
    exchange_key: ID,
    recipient: address,
    hash_commitment: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    create_hashlock_escrow_with_duration(
        escrowed, 
        exchange_key, 
        recipient, 
        hash_commitment, 
        DEFAULT_TIMEOUT_DURATION, 
        clock, 
        ctx
    )
}

/// Create a hashlock-enabled escrow with custom timeout duration
public fun create_hashlock_escrow_with_duration<T: key + store>(
    escrowed: T,
    exchange_key: ID,
    recipient: address,
    hash_commitment: vector<u8>,
    timeout_duration: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let current_time = clock::timestamp_ms(clock);
    
    let mut escrow = HashlockEscrow<T> {
        id: object::new(ctx),
        sender: ctx.sender(),
        recipient,
        hash_commitment,
        created_at: current_time,
        timeout_duration,
        exchange_key,
    };

    event::emit(HashlockEscrowCreated {
        escrow_id: object::id(&escrow),
        key_id: exchange_key,
        sender: escrow.sender,
        recipient,
        hash_commitment,
        created_at: current_time,
        expires_at: current_time + timeout_duration,
        item_id: object::id(&escrowed),
    });

    dof::add(&mut escrow.id, EscrowedObjectKey {}, escrowed);
    transfer::public_share_object(escrow);
}

/// The recipient can swap by providing the secret and the locked object
public fun swap_with_secret<T: key + store, U: key + store>(
    mut escrow: HashlockEscrow<T>,
    key: Key,
    locked: Locked<U>,
    secret: vector<u8>,
    clock: &Clock,
    ctx: &TxContext,
): T {
    assert!(escrow.recipient == ctx.sender(), EMismatchedSenderRecipient);
    assert!(escrow.exchange_key == object::id(&key), EMismatchedExchangeObject);
    
    let current_time = clock::timestamp_ms(clock);
    let expiry_time = escrow.created_at + escrow.timeout_duration;
    assert!(current_time < expiry_time, ETimedOut);

    // Verify the secret matches the hash commitment
    let secret_hash = hash::keccak256(&secret);
    assert!(secret_hash == escrow.hash_commitment, EInvalidSecret);

    // Extract escrowed object
    let escrowed = dof::remove<EscrowedObjectKey, T>(&mut escrow.id, EscrowedObjectKey {});

    // Unlock and transfer the received object to sender
    let unlocked_obj = locked.unlock(key);
    transfer::public_transfer(unlocked_obj, escrow.sender);

    // Emit events
    event::emit(SecretRevealed {
        escrow_id: object::id(&escrow),
        secret,
        secret_hash,
        revealer: ctx.sender(),
    });

    event::emit(HashlockEscrowSwapped {
        escrow_id: object::id(&escrow),
        swapper: ctx.sender(),
    });

    // Clean up
    let HashlockEscrow { 
        id, 
        sender: _, 
        recipient: _, 
        hash_commitment: _, 
        created_at: _, 
        timeout_duration: _, 
        exchange_key: _ 
    } = escrow;
    id.delete();

    escrowed
}

/// Alternative swap function that works with regular Locked objects and existing secrets
/// This allows integration with existing lock/key systems
public fun swap_with_existing_secret<T: key + store, U: key + store>(
    escrow: HashlockEscrow<T>,
    key: Key,
    locked: Locked<U>,
    secret: vector<u8>,
    clock: &Clock,
    ctx: &TxContext,
): T {
    swap_with_secret(escrow, key, locked, secret, clock, ctx)
}

/// Swap using a hashlocked object from the other party
/// This enables true hashlock-to-hashlock swaps
public fun swap_hashlock_for_hashlock<T: key + store, U: key + store>(
    mut escrow: HashlockEscrow<T>,
    hashlocked: Hashlocked<U>,
    secret: vector<u8>,
    clock: &Clock,
    ctx: &TxContext,
): T {
    assert!(escrow.recipient == ctx.sender(), EMismatchedSenderRecipient);
    
    let current_time = clock::timestamp_ms(clock);
    let expiry_time = escrow.created_at + escrow.timeout_duration;
    assert!(current_time < expiry_time, ETimedOut);

    // Verify the secret matches both hash commitments
    let secret_hash = hash::keccak256(&secret);
    assert!(secret_hash == escrow.hash_commitment, EInvalidSecret);
    
    // Verify the hashlocked object has the same hash commitment
    let hashlocked_commitment = escrow::hashlock::hash_commitment(&hashlocked);
    assert!(hashlocked_commitment == escrow.hash_commitment, EMismatchedHashCommitment);

    // Extract escrowed object
    let escrowed = dof::remove<EscrowedObjectKey, T>(&mut escrow.id, EscrowedObjectKey {});

    // Claim the hashlocked object with the secret and transfer to sender
    let claimed_obj = escrow::hashlock::claim_with_secret(hashlocked, secret, clock, ctx);
    transfer::public_transfer(claimed_obj, escrow.sender);

    // Emit events
    event::emit(SecretRevealed {
        escrow_id: object::id(&escrow),
        secret,
        secret_hash,
        revealer: ctx.sender(),
    });

    event::emit(HashlockEscrowSwapped {
        escrow_id: object::id(&escrow),
        swapper: ctx.sender(),
    });

    // Clean up
    let HashlockEscrow { 
        id, 
        sender: _, 
        recipient: _, 
        hash_commitment: _, 
        created_at: _, 
        timeout_duration: _, 
        exchange_key: _ 
    } = escrow;
    id.delete();

    escrowed
}

/// The creator can cancel the escrow and get back the escrowed item before timeout
/// or reclaim after timeout
public fun return_to_sender<T: key + store>(
    mut escrow: HashlockEscrow<T>, 
    clock: &Clock,
    ctx: &TxContext
): T {
    assert!(escrow.sender == ctx.sender(), EMismatchedSenderRecipient);
    
    let current_time = clock::timestamp_ms(clock);
    let expiry_time = escrow.created_at + escrow.timeout_duration;
    
    // Allow sender to reclaim before timeout (early cancellation)
    // or after timeout (timeout reclaim)
    let is_early_cancellation = current_time < expiry_time;

    event::emit(HashlockEscrowCancelled {
        escrow_id: object::id(&escrow),
        reason: if (is_early_cancellation) { 0 } else { 1 }, // 0 = early cancel, 1 = timeout
    });

    let escrowed = dof::remove<EscrowedObjectKey, T>(&mut escrow.id, EscrowedObjectKey {});

    let HashlockEscrow { 
        id, 
        sender: _, 
        recipient: _, 
        hash_commitment: _, 
        created_at: _, 
        timeout_duration: _, 
        exchange_key: _ 
    } = escrow;
    id.delete();

    escrowed
}

// === View Functions ===

/// Get the hash commitment from the escrow
public fun hash_commitment<T: key + store>(escrow: &HashlockEscrow<T>): vector<u8> {
    escrow.hash_commitment
}

/// Get the timeout duration from the escrow
public fun timeout_duration<T: key + store>(escrow: &HashlockEscrow<T>): u64 {
    escrow.timeout_duration
}

/// Get the creation timestamp from the escrow
public fun created_at<T: key + store>(escrow: &HashlockEscrow<T>): u64 {
    escrow.created_at
}

/// Get the expiry timestamp of the escrow
public fun get_expiry_time<T: key + store>(escrow: &HashlockEscrow<T>): u64 {
    escrow.created_at + escrow.timeout_duration
}

/// Check if the escrow has timed out
public fun has_timed_out<T: key + store>(escrow: &HashlockEscrow<T>, clock: &Clock): bool {
    let current_time = clock::timestamp_ms(clock);
    let expiry_time = escrow.created_at + escrow.timeout_duration;
    current_time >= expiry_time
}

/// Get the sender address
public fun sender<T: key + store>(escrow: &HashlockEscrow<T>): address {
    escrow.sender
}

/// Get the recipient address
public fun recipient<T: key + store>(escrow: &HashlockEscrow<T>): address {
    escrow.recipient
}

/// Get the exchange key ID
public fun exchange_key<T: key + store>(escrow: &HashlockEscrow<T>): ID {
    escrow.exchange_key
}

// === Events ===

public struct HashlockEscrowCreated has copy, drop {
    /// the ID of the escrow that was created
    escrow_id: ID,
    /// The ID of the `Key` that unlocks the requested object
    key_id: ID,
    /// The id of the sender who'll receive the object upon swap
    sender: address,
    /// The recipient of the escrowed object
    recipient: address,
    /// The hash commitment for cross-chain compatibility
    hash_commitment: vector<u8>,
    /// The creation timestamp
    created_at: u64,
    /// The expiry timestamp
    expires_at: u64,
    /// The ID of the escrowed item
    item_id: ID,
}

public struct HashlockEscrowSwapped has copy, drop {
    escrow_id: ID,
    swapper: address,
}

public struct HashlockEscrowCancelled has copy, drop {
    escrow_id: ID,
    reason: u8, // 0 = early cancel, 1 = timeout
}

public struct SecretRevealed has copy, drop {
    /// The ID of the escrow where secret was revealed
    escrow_id: ID,
    /// The revealed secret
    secret: vector<u8>,
    /// Hash of the secret
    secret_hash: vector<u8>,
    /// Address that revealed the secret
    revealer: address,
}

// === Tests ===

#[test_only]
use escrow::lock;
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
fun test_hashlock_escrow_end_to_end() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = clock::create_for_testing(ctx);

    // Create objects to trade
    let coin1 = coin::mint_for_testing<SUI>(100, ctx);
    let coin2 = coin::mint_for_testing<SUI>(200, ctx);
    
    let secret = b"secret123";
    let hash_commitment = test_hash_commitment(secret);

    // Lock coin2
    let (locked_coin2, key) = lock::lock(coin2, &clock, ctx);
    let key_id = object::id(&key);

    // Create hashlock escrow with coin1
    create_hashlock_escrow(coin1, key_id, @0x2, hash_commitment, &clock, ctx);

    ts::next_tx(&mut scenario, @0x2);
    let mut escrow = ts::take_shared<HashlockEscrow<Coin<SUI>>>(&scenario);
    let ctx = ts::ctx(&mut scenario);

    // Recipient swaps by revealing secret
    let received_coin = swap_with_secret(escrow, key, locked_coin2, secret, &clock, ctx);
    
    assert!(coin::value(&received_coin) == 100);
    test_utils::destroy(received_coin);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
} 