// Copyright (c) 2024
// SPDX-License-Identifier: MIT

/// Cross-chain HTLC Escrow compatible with 1inch Solidity contracts
/// Uses Keccak-256 for hash compatibility across chains
/// Generic implementation that works with SUI coins and any object type (NFTs, etc.)
module crosschain_htlc::escrow {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::hash;
    use sui::transfer;
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::balance::{Self, Balance};
    use sui::dynamic_object_field as dof;
    use std::vector;

    // === Error codes ===
    
    /// Deadline has passed
    const EDeadlinePassed: u64 = 1;
    
    /// Deadline not reached yet (for refunds)
    const EDeadlineNotReached: u64 = 2;
    
    /// Invalid preimage - hash doesn't match
    const EInvalidPreimage: u64 = 3;
    
    /// Deadline must be in the future
    const EInvalidDeadline: u64 = 4;
    
    /// Hashlock must be exactly 32 bytes
    const EInvalidHashlock: u64 = 5;
    
    /// ETH address must be exactly 20 bytes
    const EInvalidEthAddress: u64 = 6;
    
    /// Insufficient coin amount
    const EInsufficientAmount: u64 = 7;
    
    /// Only creator can refund
    const EUnauthorized: u64 = 8;

    // === Dynamic Object Field Keys ===
    
    /// Key for storing the escrowed object as a dynamic field
    public struct EscrowedObjectKey has copy, drop, store {}

    // === Events ===
    
    /// Emitted when an escrow is created
    public struct EscrowCreated has copy, drop {
        escrow_id: ID,
        creator: address,
        hashlock: vector<u8>,
        eth_receiver: vector<u8>,
        amount: u64,
        deadline: u64,
        item_id: ID,
    }
    
    /// Emitted when preimage is revealed and escrow is claimed
    public struct PreimageRevealed has copy, drop {
        escrow_id: ID,
        preimage: vector<u8>,
        claimer: address,
        amount: u64,
        item_id: ID,
    }
    
    /// Emitted when escrow is refunded after deadline
    public struct EscrowRefunded has copy, drop {
        escrow_id: ID,
        creator: address,
        amount: u64,
        item_id: ID,
    }

    // === Structs ===
    
    /// Factory for creating and managing SUI coin escrows
    public struct EscrowFactory has key {
        id: UID,
        vault: Balance<SUI>,
    }
    
    /// Escrow specifically for SUI coins
    public struct SuiEscrow has key, store {
        id: UID,
        hashlock: vector<u8>,      // 32 bytes: keccak256 preimage
        creator: address,          // who locked the SUI
        eth_receiver: vector<u8>,  // 20-byte ETH address who may claim
        deadline: u64,             // Unix timestamp in milliseconds
        amount: u64,               // amount in MIST (smallest SUI units)
    }
    
    /// Generic escrow holding any asset type with key + store abilities
    /// Uses dynamic object fields to store the escrowed asset
    public struct ObjectEscrow<phantom T: key + store> has key, store {
        id: UID,
        hashlock: vector<u8>,      // 32 bytes: keccak256 preimage
        creator: address,          // who locked the asset
        eth_receiver: vector<u8>,  // 20-byte ETH address who may claim
        deadline: u64,             // Unix timestamp in milliseconds
        amount: u64,               // amount (always 1 for objects)
    }

    // === Init function ===
    
    /// Initialize the escrow factory for SUI coins
    fun init(ctx: &mut TxContext) {
        let factory = EscrowFactory {
            id: object::new(ctx),
            vault: balance::zero<SUI>(),
        };
        
        transfer::share_object(factory);
    }

    #[test_only]
    /// Initialize the escrow factory for testing
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }

    // === Public entry functions for SUI coins ===
    
    /// Create a new escrow by locking SUI with a hashlock
    /// Called by Alice to lock SUI for cross-chain swap
    public entry fun setup_escrow(
        factory: &mut EscrowFactory,
        mut coin: Coin<SUI>,
        amount: u64,
        hashlock: vector<u8>,
        eth_receiver: vector<u8>,
        deadline: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Validate inputs
        assert!(vector::length(&hashlock) == 32, EInvalidHashlock);
        assert!(vector::length(&eth_receiver) == 20, EInvalidEthAddress);
        assert!(coin::value(&coin) >= amount, EInsufficientAmount);
        
        let current_time = clock::timestamp_ms(clock);
        assert!(deadline > current_time, EInvalidDeadline);
        
        // Extract the required amount from the coin
        let payment = coin::split(&mut coin, amount, ctx);
        let payment_balance = coin::into_balance(payment);
        
        // Add to factory vault
        balance::join(&mut factory.vault, payment_balance);
        
        // Create escrow object
        let escrow_id = object::new(ctx);
        let escrow_id_copy = object::uid_to_inner(&escrow_id);
        
        let escrow = SuiEscrow {
            id: escrow_id,
            hashlock,
            creator: tx_context::sender(ctx),
            eth_receiver,
            deadline,
            amount,
        };
        
        // Emit creation event
        event::emit(EscrowCreated {
            escrow_id: escrow_id_copy,
            creator: tx_context::sender(ctx),
            hashlock,
            eth_receiver,
            amount,
            deadline,
            item_id: object::id_from_address(@0x0), // No separate item for SUI
        });
        
        // Share the escrow object
        transfer::share_object(escrow);
        
        // Return remaining coin if any
        if (coin::value(&coin) > 0) {
            transfer::public_transfer(coin, tx_context::sender(ctx));
        } else {
            coin::destroy_zero(coin);
        };
    }
    
    /// Claim SUI funds by revealing the secret preimage
    /// Called when the preimage is revealed on either chain
    public entry fun claim_escrow(
        factory: &mut EscrowFactory,
        escrow: SuiEscrow,
        preimage: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Check timelock - must claim before deadline
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time <= escrow.deadline, EDeadlinePassed);
        
        // Verify preimage matches hashlock
        let computed_hash = hash::keccak256(&preimage);
        assert!(computed_hash == escrow.hashlock, EInvalidPreimage);
        
        // Extract fields before destroying escrow
        let escrow_id = object::uid_to_inner(&escrow.id);
        let amount = escrow.amount;
        let creator = escrow.creator;
        
        // Destroy escrow
        let SuiEscrow { 
            id, 
            hashlock: _, 
            creator: _, 
            eth_receiver: _, 
            deadline: _, 
            amount: _ 
        } = escrow;
        object::delete(id);
        
        // Release funds from vault to the creator (who will bridge to ETH)
        let payout = balance::split(&mut factory.vault, amount);
        let payout_coin = coin::from_balance(payout, ctx);
        transfer::public_transfer(payout_coin, creator);
        
        // Emit preimage revealed event (this is what the relayer watches for)
        event::emit(PreimageRevealed {
            escrow_id,
            preimage,
            claimer: tx_context::sender(ctx),
            amount,
            item_id: object::id_from_address(@0x0), // No separate item for SUI
        });
    }
    
    /// Refund locked SUI funds after deadline expires
    /// Only creator can call this after deadline
    public entry fun refund_escrow(
        factory: &mut EscrowFactory,
        escrow: SuiEscrow,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Check that deadline has passed
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time > escrow.deadline, EDeadlineNotReached);
        
        // Only creator can refund
        assert!(tx_context::sender(ctx) == escrow.creator, EUnauthorized);
        
        // Extract fields before destroying escrow
        let escrow_id = object::uid_to_inner(&escrow.id);
        let amount = escrow.amount;
        let creator = escrow.creator;
        
        // Destroy escrow
        let SuiEscrow { 
            id, 
            hashlock: _, 
            creator: _, 
            eth_receiver: _, 
            deadline: _, 
            amount: _ 
        } = escrow;
        object::delete(id);
        
        // Return funds to creator
        let refund = balance::split(&mut factory.vault, amount);
        let refund_coin = coin::from_balance(refund, ctx);
        transfer::public_transfer(refund_coin, creator);
        
        // Emit refund event
        event::emit(EscrowRefunded {
            escrow_id,
            creator,
            amount,
            item_id: object::id_from_address(@0x0), // No separate item for SUI
        });
    }

    // === Public functions for generic assets (NFTs, etc.) ===
    
    /// Create a new escrow with any asset type
    /// Generic version that works with NFTs, game items, etc.
    public fun create_object_escrow<T: key + store>(
        escrowed: T,
        hashlock: vector<u8>,
        eth_receiver: vector<u8>,
        deadline: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Validate inputs
        assert!(vector::length(&hashlock) == 32, EInvalidHashlock);
        assert!(vector::length(&eth_receiver) == 20, EInvalidEthAddress);
        
        let current_time = clock::timestamp_ms(clock);
        assert!(deadline > current_time, EInvalidDeadline);
        
        // Create escrow object
        let mut escrow = ObjectEscrow<T> {
            id: object::new(ctx),
            hashlock,
            creator: tx_context::sender(ctx),
            eth_receiver,
            deadline,
            amount: 1, // For objects, amount is always 1
        };
        
        let escrow_id = object::uid_to_inner(&escrow.id);
        let item_id = object::id(&escrowed);
        
        // Store the escrowed object as a dynamic field
        dof::add(&mut escrow.id, EscrowedObjectKey {}, escrowed);
        
        // Emit creation event
        event::emit(EscrowCreated {
            escrow_id,
            creator: tx_context::sender(ctx),
            hashlock,
            eth_receiver,
            amount: 1,
            deadline,
            item_id,
        });
        
        // Share the escrow object
        transfer::share_object(escrow);
    }
    
    /// Claim any asset type by revealing the secret preimage
    public fun claim_object_escrow<T: key + store>(
        mut escrow: ObjectEscrow<T>,
        preimage: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ): T {
        // Check timelock - must claim before deadline
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time <= escrow.deadline, EDeadlinePassed);
        
        // Verify preimage matches hashlock
        let computed_hash = hash::keccak256(&preimage);
        assert!(computed_hash == escrow.hashlock, EInvalidPreimage);
        
        // Extract the escrowed object
        let escrowed = dof::remove<EscrowedObjectKey, T>(&mut escrow.id, EscrowedObjectKey {});
        
        // Extract fields before destroying escrow
        let escrow_id = object::uid_to_inner(&escrow.id);
        let creator = escrow.creator;
        let item_id = object::id(&escrowed);
        
        // Destroy escrow
        let ObjectEscrow { 
            id, 
            hashlock: _, 
            creator: _, 
            eth_receiver: _, 
            deadline: _, 
            amount: _ 
        } = escrow;
        object::delete(id);
        
        // Emit preimage revealed event
        event::emit(PreimageRevealed {
            escrow_id,
            preimage,
            claimer: tx_context::sender(ctx),
            amount: 1,
            item_id,
        });
        
        escrowed
    }
    
    /// Refund any asset type after deadline expires
    public fun refund_object_escrow<T: key + store>(
        mut escrow: ObjectEscrow<T>,
        clock: &Clock,
        ctx: &mut TxContext
    ): T {
        // Check that deadline has passed
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time > escrow.deadline, EDeadlineNotReached);
        
        // Only creator can refund
        assert!(tx_context::sender(ctx) == escrow.creator, EUnauthorized);
        
        // Extract the escrowed object
        let escrowed = dof::remove<EscrowedObjectKey, T>(&mut escrow.id, EscrowedObjectKey {});
        
        // Extract fields before destroying escrow
        let escrow_id = object::uid_to_inner(&escrow.id);
        let creator = escrow.creator;
        let item_id = object::id(&escrowed);
        
        // Destroy escrow
        let ObjectEscrow { 
            id, 
            hashlock: _, 
            creator: _, 
            eth_receiver: _, 
            deadline: _, 
            amount: _ 
        } = escrow;
        object::delete(id);
        
        // Emit refund event
        event::emit(EscrowRefunded {
            escrow_id,
            creator,
            amount: 1,
            item_id,
        });
        
        escrowed
    }

    // === View functions ===
    
    /// Get escrow details for SUI escrows
    public fun get_sui_escrow_info(escrow: &SuiEscrow): (vector<u8>, address, vector<u8>, u64, u64) {
        (escrow.hashlock, escrow.creator, escrow.eth_receiver, escrow.deadline, escrow.amount)
    }
    
    /// Get escrow details for generic escrows
    public fun get_object_escrow_info<T: key + store>(escrow: &ObjectEscrow<T>): (vector<u8>, address, vector<u8>, u64, u64) {
        (escrow.hashlock, escrow.creator, escrow.eth_receiver, escrow.deadline, escrow.amount)
    }
    
    /// Check if SUI escrow has expired
    public fun is_sui_escrow_expired(escrow: &SuiEscrow, clock: &Clock): bool {
        let current_time = clock::timestamp_ms(clock);
        current_time > escrow.deadline
    }
    
    /// Check if object escrow has expired
    public fun is_object_escrow_expired<T: key + store>(escrow: &ObjectEscrow<T>, clock: &Clock): bool {
        let current_time = clock::timestamp_ms(clock);
        current_time > escrow.deadline
    }
    
    /// Verify a preimage against the SUI escrow's hashlock
    public fun verify_sui_preimage(escrow: &SuiEscrow, preimage: &vector<u8>): bool {
        let computed_hash = hash::keccak256(preimage);
        computed_hash == escrow.hashlock
    }
    
    /// Verify a preimage against the object escrow's hashlock
    public fun verify_object_preimage<T: key + store>(escrow: &ObjectEscrow<T>, preimage: &vector<u8>): bool {
        let computed_hash = hash::keccak256(preimage);
        computed_hash == escrow.hashlock
    }
    
    /// Check if an object is escrowed in a generic escrow
    public fun has_escrowed_object<T: key + store>(escrow: &ObjectEscrow<T>): bool {
        dof::exists_(&escrow.id, EscrowedObjectKey {})
    }
}
 