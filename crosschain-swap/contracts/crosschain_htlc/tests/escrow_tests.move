// Copyright (c) 2024
// SPDX-License-Identifier: MIT

#[test_only]
module crosschain_htlc::escrow_tests {
    use crosschain_htlc::escrow::{Self, EscrowFactory, SuiEscrow, ObjectEscrow};
    use sui::coin;
    use sui::sui::SUI;
    use sui::test_scenario::{Self, Scenario};
    use sui::clock::{Self, Clock};
    use sui::hash;
    use sui::object;

    const ALICE: address = @0xA11CE;
    const BOB: address = @0xB0B;
    const ETH_ADDRESS: vector<u8> = x"742d35Cc6635C0532925a3b8D0A9e2B9c2b6F5f1"; // 20 bytes

    // Test object for generic escrow testing
    public struct TestNFT has key, store {
        id: UID,
        name: vector<u8>,
        description: vector<u8>,
    }

    fun setup_test(): (Scenario, Clock) {
        let mut scenario = test_scenario::begin(ALICE);
        let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000); // Set initial timestamp
        
        // Initialize escrow factory
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            escrow::init_for_testing(test_scenario::ctx(&mut scenario));
        };
        
        (scenario, clock)
    }

    #[test]
    fun test_create_sui_escrow() {
        let (mut scenario, clock) = setup_test();
        
        // Create a test coin
        test_scenario::next_tx(&mut scenario, ALICE);
        let coin = coin::mint_for_testing<SUI>(1000000, test_scenario::ctx(&mut scenario));
        
        // Create hashlock
        let secret = b"my_secret_32_bytes_long_password";
        let hashlock = hash::keccak256(&secret);
        
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let mut factory = test_scenario::take_shared<EscrowFactory>(&scenario);
            
            escrow::setup_escrow(
                &mut factory,
                coin,
                500000, // 0.0005 SUI
                hashlock,
                ETH_ADDRESS,
                2000, // deadline at timestamp 2000
                &clock,
                test_scenario::ctx(&mut scenario)
            );
            
            test_scenario::return_shared(factory);
        };
        
        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_claim_sui_escrow() {
        let (mut scenario, clock) = setup_test();
        
        // Create escrow first
        test_scenario::next_tx(&mut scenario, ALICE);
        let coin = coin::mint_for_testing<SUI>(1000000, test_scenario::ctx(&mut scenario));
        let secret = b"my_secret_32_bytes_long_password";
        let hashlock = hash::keccak256(&secret);
        
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let mut factory = test_scenario::take_shared<EscrowFactory>(&scenario);
            
            escrow::setup_escrow(
                &mut factory,
                coin,
                500000,
                hashlock,
                ETH_ADDRESS,
                2000,
                &clock,
                test_scenario::ctx(&mut scenario)
            );
            
            test_scenario::return_shared(factory);
        };
        
        // Now claim the escrow
        test_scenario::next_tx(&mut scenario, BOB);
        {
            let mut factory = test_scenario::take_shared<EscrowFactory>(&scenario);
            let escrow = test_scenario::take_shared<SuiEscrow>(&scenario);
            
            // Verify preimage before claiming
            assert!(escrow::verify_sui_preimage(&escrow, &secret), 0);
            
            escrow::claim_escrow(
                &mut factory,
                escrow,
                secret,
                &clock,
                test_scenario::ctx(&mut scenario)
            );
            
            test_scenario::return_shared(factory);
        };
        
        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_create_nft_escrow() {
        let (mut scenario, clock) = setup_test();
        
        // Create a test NFT
        test_scenario::next_tx(&mut scenario, ALICE);
        let nft = TestNFT {
            id: object::new(test_scenario::ctx(&mut scenario)),
            name: b"Test NFT",
            description: b"A test NFT for escrow",
        };
        
        // Create hashlock
        let secret = b"nft_secret_32_bytes_long_password";
        let hashlock = hash::keccak256(&secret);
        
        escrow::create_object_escrow(
            nft,
            hashlock,
            ETH_ADDRESS,
            2000, // deadline
            &clock,
            test_scenario::ctx(&mut scenario)
        );
        
        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_claim_nft_escrow() {
        let (mut scenario, clock) = setup_test();
        
        // Create NFT escrow first
        test_scenario::next_tx(&mut scenario, ALICE);
        let nft = TestNFT {
            id: object::new(test_scenario::ctx(&mut scenario)),
            name: b"Test NFT",
            description: b"A test NFT for escrow",
        };
        
        let secret = b"nft_secret_32_bytes_long_password";
        let hashlock = hash::keccak256(&secret);
        
        escrow::create_object_escrow(
            nft,
            hashlock,
            ETH_ADDRESS,
            2000,
            &clock,
            test_scenario::ctx(&mut scenario)
        );
        
        // Now claim the NFT escrow
        test_scenario::next_tx(&mut scenario, BOB);
        {
            let escrow = test_scenario::take_shared<ObjectEscrow<TestNFT>>(&scenario);
            
            // Verify preimage before claiming
            assert!(escrow::verify_object_preimage(&escrow, &secret), 0);
            
            // Check that the object is escrowed
            assert!(escrow::has_escrowed_object(&escrow), 1);
            
            let claimed_nft = escrow::claim_object_escrow(
                escrow,
                secret,
                &clock,
                test_scenario::ctx(&mut scenario)
            );
            
            // Verify we got the correct NFT
            assert!(claimed_nft.name == b"Test NFT", 2);
            
            // Clean up
            let TestNFT { id, name: _, description: _ } = claimed_nft;
            object::delete(id);
        };
        
        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_refund_sui_after_deadline() {
        let (mut scenario, mut clock) = setup_test();
        
        // Create escrow
        test_scenario::next_tx(&mut scenario, ALICE);
        let coin = coin::mint_for_testing<SUI>(1000000, test_scenario::ctx(&mut scenario));
        let secret = b"my_secret_32_bytes_long_password";
        let hashlock = hash::keccak256(&secret);
        
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let mut factory = test_scenario::take_shared<EscrowFactory>(&scenario);
            
            escrow::setup_escrow(
                &mut factory,
                coin,
                500000,
                hashlock,
                ETH_ADDRESS,
                2000, // deadline
                &clock,
                test_scenario::ctx(&mut scenario)
            );
            
            test_scenario::return_shared(factory);
        };
        
        // Advance time past deadline
        clock::set_for_testing(&mut clock, 3000);
        
        // Refund the escrow
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let mut factory = test_scenario::take_shared<EscrowFactory>(&scenario);
            let escrow = test_scenario::take_shared<SuiEscrow>(&scenario);
            
            // Check that escrow has expired
            assert!(escrow::is_sui_escrow_expired(&escrow, &clock), 0);
            
            escrow::refund_escrow(
                &mut factory,
                escrow,
                &clock,
                test_scenario::ctx(&mut scenario)
            );
            
            test_scenario::return_shared(factory);
        };
        
        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_refund_nft_after_deadline() {
        let (mut scenario, mut clock) = setup_test();
        
        // Create NFT escrow
        test_scenario::next_tx(&mut scenario, ALICE);
        let nft = TestNFT {
            id: object::new(test_scenario::ctx(&mut scenario)),
            name: b"Test NFT",
            description: b"A test NFT for escrow",
        };
        
        let secret = b"nft_secret_32_bytes_long_password";
        let hashlock = hash::keccak256(&secret);
        
        escrow::create_object_escrow(
            nft,
            hashlock,
            ETH_ADDRESS,
            2000, // deadline
            &clock,
            test_scenario::ctx(&mut scenario)
        );
        
        // Advance time past deadline
        clock::set_for_testing(&mut clock, 3000);
        
        // Refund the NFT escrow
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let escrow = test_scenario::take_shared<ObjectEscrow<TestNFT>>(&scenario);
            
            // Check that escrow has expired
            assert!(escrow::is_object_escrow_expired(&escrow, &clock), 0);
            
            let refunded_nft = escrow::refund_object_escrow(
                escrow,
                &clock,
                test_scenario::ctx(&mut scenario)
            );
            
            // Verify we got the correct NFT back
            assert!(refunded_nft.name == b"Test NFT", 1);
            
            // Clean up
            let TestNFT { id, name: _, description: _ } = refunded_nft;
            object::delete(id);
        };
        
        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = crosschain_htlc::escrow::EInvalidPreimage)]
    fun test_claim_with_wrong_preimage() {
        let (mut scenario, clock) = setup_test();
        
        // Create escrow
        test_scenario::next_tx(&mut scenario, ALICE);
        let coin = coin::mint_for_testing<SUI>(1000000, test_scenario::ctx(&mut scenario));
        let secret = b"my_secret_32_bytes_long_password";
        let hashlock = hash::keccak256(&secret);
        
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let mut factory = test_scenario::take_shared<EscrowFactory>(&scenario);
            
            escrow::setup_escrow(
                &mut factory,
                coin,
                500000,
                hashlock,
                ETH_ADDRESS,
                2000,
                &clock,
                test_scenario::ctx(&mut scenario)
            );
            
            test_scenario::return_shared(factory);
        };
        
        // Try to claim with wrong preimage
        test_scenario::next_tx(&mut scenario, BOB);
        {
            let mut factory = test_scenario::take_shared<EscrowFactory>(&scenario);
            let escrow = test_scenario::take_shared<SuiEscrow>(&scenario);
            
            let wrong_secret = b"wrong_secret_32_bytes_long_pass1";
            
            escrow::claim_escrow(
                &mut factory,
                escrow,
                wrong_secret,
                &clock,
                test_scenario::ctx(&mut scenario)
            );
            
            test_scenario::return_shared(factory);
        };
        
        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }
} 