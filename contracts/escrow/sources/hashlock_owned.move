// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/// An enhanced escrow for atomic swap of objects with hashlock functionality
/// using a trusted custodian model.
///
/// This variant requires a trusted custodian to perform the swap, but provides
/// additional flexibility and can handle more complex swap scenarios.
/// The hashlock functionality enables cross-chain atomic swaps.
module escrow::hashlock_owned;

use sui::dynamic_object_field as dof;
use sui::event;
use sui::hash;
use sui::clock::{Self, Clock};

/// The `name` of the DOF that holds the Escrowed object.
public struct EscrowedObjectKey has copy, drop, store {}

/// An enhanced escrow object with hashlock functionality for custodian-based swaps
public struct HashlockEscrow<phantom T: key + store> has key, store {
    id: UID,
    /// Owner of the escrowed object
    sender: address,
    /// Intended recipient of the escrowed object
    recipient: address,
    /// Hash commitment for the secret (enables cross-chain compatibility)
    hash_commitment: vector<u8>,
    /// Timestamp when the escrow was created (in milliseconds)
    created_at: u64,
    /// Duration after which sender can reclaim (in milliseconds)
    timeout_duration: u64,
    /// ID of the object requested in exchange
    exchange_key: ID,
    /// Information about what the sender wants in return
    escrowed_key: ID,
}

// === Error codes ===

/// The provided secret does not hash to the committed hash
const EInvalidSecret: u64 = 0;

/// The hashlock has already timed out
const ETimedOut: u64 = 1;

/// Only the sender can perform this action
const ENotSender: u64 = 2;

/// The timeout has not been reached yet
const ETimeoutNotReached: u64 = 4;

// === Constants ===

/// Default timeout duration: 24 hours in milliseconds
const DEFAULT_TIMEOUT_DURATION: u64 = 86400000;

// === Public Functions ===

/// Create a hashlock escrow with default timeout (24 hours)
public fun create<T: key + store>(
    escrowed_key: ID,
    escrowed: T,
    exchange_key: ID,
    recipient: address,
    hash_commitment: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
): HashlockEscrow<T> {
    create_with_duration(
        escrowed_key, 
        escrowed, 
        exchange_key, 
        recipient, 
        hash_commitment, 
        DEFAULT_TIMEOUT_DURATION, 
        clock, 
        ctx
    )
}

/// Create a hashlock escrow with custom timeout duration
public fun create_with_duration<T: key + store>(
    escrowed_key: ID,
    escrowed: T,
    exchange_key: ID,
    recipient: address,
    hash_commitment: vector<u8>,
    timeout_duration: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): HashlockEscrow<T> {
    let current_time = clock::timestamp_ms(clock);

    let mut escrow = HashlockEscrow<T> {
        id: object::new(ctx),
        sender: ctx.sender(),
        recipient,
        hash_commitment,
        created_at: current_time,
        timeout_duration,
        exchange_key,
        escrowed_key,
    };

    event::emit(HashlockEscrowCreated {
        escrow_id: object::id(&escrow),
        sender: escrow.sender,
        recipient,
        exchange_key,
        escrowed_key,
        hash_commitment,
        created_at: current_time,
        expires_at: current_time + timeout_duration,
        item_id: object::id(&escrowed),
    });

    dof::add(&mut escrow.id, EscrowedObjectKey {}, escrowed);
    escrow
}

/// Perform a swap between two hashlock escrows using a secret
/// Both escrows must have the same hash commitment
public fun swap_with_secret<T: key + store, U: key + store>(
    mut obj1: HashlockEscrow<T>, 
    mut obj2: HashlockEscrow<U>,
    secret: vector<u8>,
    clock: &Clock,
    ctx: &TxContext,
) {
    let secret_hash = hash::keccak256(&secret);
    assert!(secret_hash == obj1.hash_commitment, EInvalidSecret);
    assert!(secret_hash == obj2.hash_commitment, EInvalidSecret);
    
    let current_time = clock::timestamp_ms(clock);
    let expiry_time1 = obj1.created_at + obj1.timeout_duration;
    let expiry_time2 = obj2.created_at + obj2.timeout_duration;
    assert!(current_time < expiry_time1, ETimedOut);
    assert!(current_time < expiry_time2, ETimedOut);

    // Capture IDs and recipients before moving
    let escrow1_id = object::id(&obj1);
    let escrow2_id = object::id(&obj2);
    let recipient1 = obj1.recipient;
    let recipient2 = obj2.recipient;

    // Extract escrowed objects from DOF
    let escrowed1 = dof::remove<EscrowedObjectKey, T>(&mut obj1.id, EscrowedObjectKey {});
    let escrowed2 = dof::remove<EscrowedObjectKey, U>(&mut obj2.id, EscrowedObjectKey {});

    let HashlockEscrow {
        id: id1,
        sender: _,
        recipient: _,
        hash_commitment: _,
        created_at: _,
        timeout_duration: _,
        exchange_key: _,
        escrowed_key: _,
    } = obj1;

    let HashlockEscrow {
        id: id2,
        sender: _,
        recipient: _,
        hash_commitment: _,
        created_at: _,
        timeout_duration: _,
        exchange_key: _,
        escrowed_key: _,
    } = obj2;

    // Emit events
    event::emit(SecretRevealed {
        escrow_id: escrow1_id,
        secret,
        secret_hash,
        revealer: ctx.sender(),
    });

    event::emit(HashlockEscrowSwapped {
        escrow_id: escrow1_id,
    });

    event::emit(HashlockEscrowSwapped {
        escrow_id: escrow2_id,
    });

    // Transfer objects to recipients
    transfer::public_transfer(escrowed1, recipient1);
    transfer::public_transfer(escrowed2, recipient2);

    id1.delete();
    id2.delete();
}

/// Perform a swap between two hashlock escrows, both parties reveal their secrets
public fun swap_hashlocks_with_secret<T: key + store, U: key + store>(
    mut escrow1: HashlockEscrow<T>, 
    mut escrow2: HashlockEscrow<U>,
    secret: vector<u8>,
    clock: &Clock,
    ctx: &TxContext,
) {
    let secret_hash = hash::keccak256(&secret);
    assert!(secret_hash == escrow1.hash_commitment, EInvalidSecret);
    assert!(secret_hash == escrow2.hash_commitment, EInvalidSecret);
    
    let current_time = clock::timestamp_ms(clock);
    let expiry_time1 = escrow1.created_at + escrow1.timeout_duration;
    let expiry_time2 = escrow2.created_at + escrow2.timeout_duration;
    assert!(current_time < expiry_time1, ETimedOut);
    assert!(current_time < expiry_time2, ETimedOut);

    // Capture IDs and recipients before moving
    let escrow1_id = object::id(&escrow1);
    let escrow2_id = object::id(&escrow2);
    let recipient1 = escrow1.recipient;
    let recipient2 = escrow2.recipient;

    // Extract escrowed objects from DOF
    let escrowed1 = dof::remove<EscrowedObjectKey, T>(&mut escrow1.id, EscrowedObjectKey {});
    let escrowed2 = dof::remove<EscrowedObjectKey, U>(&mut escrow2.id, EscrowedObjectKey {});

    let HashlockEscrow {
        id: id1,
        sender: _,
        recipient: _,
        hash_commitment: _,
        created_at: _,
        timeout_duration: _,
        exchange_key: _,
        escrowed_key: _,
    } = escrow1;

    let HashlockEscrow {
        id: id2,
        sender: _,
        recipient: _,
        hash_commitment: _,
        created_at: _,
        timeout_duration: _,
        exchange_key: _,
        escrowed_key: _,
    } = escrow2;

    // Emit events
    event::emit(SecretRevealed {
        escrow_id: escrow1_id,
        secret,
        secret_hash,
        revealer: ctx.sender(),
    });

    event::emit(HashlockEscrowSwapped {
        escrow_id: escrow1_id,
    });

    event::emit(HashlockEscrowSwapped {
        escrow_id: escrow2_id,
    });

    // Cross-transfer: sender1's object goes to recipient1, sender2's object goes to recipient2
    transfer::public_transfer(escrowed1, recipient1);
    transfer::public_transfer(escrowed2, recipient2);

    id1.delete();
    id2.delete();
}

/// Return escrowed object to sender (early cancellation or timeout reclaim)
public fun return_to_sender<T: key + store>(
    mut escrow: HashlockEscrow<T>,
    clock: &Clock,
    ctx: &TxContext,
): T {
    assert!(escrow.sender == ctx.sender(), ENotSender);
    
    let current_time = clock::timestamp_ms(clock);
    let expiry_time = escrow.created_at + escrow.timeout_duration;
    
    // Allow early cancellation or timeout reclaim
    let is_early_cancellation = current_time < expiry_time;

    let escrowed = dof::remove<EscrowedObjectKey, T>(&mut escrow.id, EscrowedObjectKey {});

    event::emit(HashlockEscrowCancelled {
        escrow_id: object::id(&escrow),
        reason: if (is_early_cancellation) { 0 } else { 1 }, // 0 = early cancel, 1 = timeout
    });

    let HashlockEscrow {
        id,
        sender: _,
        recipient: _,
        hash_commitment: _,
        created_at: _,
        timeout_duration: _,
        exchange_key: _,
        escrowed_key: _,
    } = escrow;

    id.delete();
    escrowed
}

/// Reclaim escrowed object after timeout (only sender, only after timeout)
public fun reclaim_after_timeout<T: key + store>(
    mut escrow: HashlockEscrow<T>,
    clock: &Clock,
    ctx: &TxContext,
): T {
    assert!(escrow.sender == ctx.sender(), ENotSender);
    
    let current_time = clock::timestamp_ms(clock);
    let expiry_time = escrow.created_at + escrow.timeout_duration;
    assert!(current_time >= expiry_time, ETimeoutNotReached);

    let escrowed = dof::remove<EscrowedObjectKey, T>(&mut escrow.id, EscrowedObjectKey {});

    event::emit(HashlockEscrowCancelled {
        escrow_id: object::id(&escrow),
        reason: 1, // 1 = timeout
    });

    let HashlockEscrow {
        id,
        sender: _,
        recipient: _,
        hash_commitment: _,
        created_at: _,
        timeout_duration: _,
        exchange_key: _,
        escrowed_key: _,
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

/// Get the escrowed key ID
public fun escrowed_key<T: key + store>(escrow: &HashlockEscrow<T>): ID {
    escrow.escrowed_key
}

// === Events ===

public struct HashlockEscrowCreated has copy, drop {
    escrow_id: ID,
    sender: address,
    recipient: address,
    exchange_key: ID,
    escrowed_key: ID,
    hash_commitment: vector<u8>,
    created_at: u64,
    expires_at: u64,
    item_id: ID,
}

public struct HashlockEscrowSwapped has copy, drop {
    escrow_id: ID,
}

public struct HashlockEscrowCancelled has copy, drop {
    escrow_id: ID,
    reason: u8, // 0 = early cancel, 1 = timeout
}

public struct SecretRevealed has copy, drop {
    escrow_id: ID,
    secret: vector<u8>,
    secret_hash: vector<u8>,
    revealer: address,
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
fun test_hashlock_owned_escrow_swap() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = clock::create_for_testing(ctx);

    // Create coins for trade
    let coin1 = coin::mint_for_testing<SUI>(100, ctx);
    let coin2 = coin::mint_for_testing<SUI>(200, ctx);
    
    let secret = b"secret123";
    let hash_commitment = test_hash_commitment(secret);

    // Create escrows
    let key1 = object::id(&coin1);
    let key2 = object::id(&coin2);
    
    let escrow1 = create(key1, coin1, key2, @0x2, hash_commitment, &clock, ctx);

    ts::next_tx(&mut scenario, @0x2);
    let ctx = ts::ctx(&mut scenario);
    let escrow2 = create(key2, coin2, key1, @0x1, hash_commitment, &clock, ctx);

    // Perform swap
    swap_with_secret(escrow1, escrow2, secret, &clock, ctx);

    clock::destroy_for_testing(clock);
    ts::end(scenario);
} 