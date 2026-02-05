// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/AgentReputationRegistry.sol";

contract AgentReputationRegistryTest is Test {
    AgentReputationRegistry public registry;
    address public owner;
    address public user1;
    address public user2;

    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");

        registry = new AgentReputationRegistry("https://api.clawdaq.xyz/nft/");
    }

    // ============================================
    // Registration Tests
    // ============================================

    function test_RegisterAgent() public {
        uint256 tokenId = registry.registerAgent("agent_001", user1);

        assertEq(tokenId, 1);
        assertEq(registry.ownerOf(tokenId), user1);
        assertEq(registry.totalAgents(), 1);
        assertTrue(registry.isAgentRegistered("agent_001"));
    }

    function test_RegisterAgent_SetsInitialReputation() public {
        uint256 tokenId = registry.registerAgent("agent_001", user1);

        AgentReputationRegistry.AgentReputation memory rep = registry
            .getReputationByAgentId("agent_001");

        assertEq(rep.karma, 0);
        assertEq(rep.questionsAsked, 0);
        assertEq(rep.answersGiven, 0);
        assertEq(rep.acceptedAnswers, 0);
        assertTrue(rep.isActive);
        assertGt(rep.lastUpdated, 0);
    }

    function test_RegisterAgent_RevertsDuplicate() public {
        registry.registerAgent("agent_001", user1);

        vm.expectRevert("Agent already registered");
        registry.registerAgent("agent_001", user2);
    }

    function test_RegisterAgent_RevertsZeroAddress() public {
        vm.expectRevert("Invalid address");
        registry.registerAgent("agent_001", address(0));
    }

    function test_RegisterAgent_OnlyOwner() public {
        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        registry.registerAgent("agent_001", user1);
    }

    function test_BatchRegisterAgents() public {
        string[] memory agentIds = new string[](3);
        agentIds[0] = "agent_001";
        agentIds[1] = "agent_002";
        agentIds[2] = "agent_003";

        address[] memory owners = new address[](3);
        owners[0] = user1;
        owners[1] = user2;
        owners[2] = makeAddr("user3");

        registry.batchRegisterAgents(agentIds, owners);

        assertEq(registry.totalAgents(), 3);
        assertTrue(registry.isAgentRegistered("agent_001"));
        assertTrue(registry.isAgentRegistered("agent_002"));
        assertTrue(registry.isAgentRegistered("agent_003"));
    }

    function test_BatchRegisterAgents_SkipsDuplicates() public {
        registry.registerAgent("agent_001", user1);

        string[] memory agentIds = new string[](2);
        agentIds[0] = "agent_001"; // Already registered
        agentIds[1] = "agent_002";

        address[] memory owners = new address[](2);
        owners[0] = user2;
        owners[1] = user2;

        registry.batchRegisterAgents(agentIds, owners);

        // Only agent_002 should be added
        assertEq(registry.totalAgents(), 2);
        // agent_001 should still belong to user1
        assertEq(registry.ownerOf(1), user1);
    }

    // ============================================
    // Reputation Update Tests
    // ============================================

    function test_UpdateReputation() public {
        uint256 tokenId = registry.registerAgent("agent_001", user1);

        AgentReputationRegistry.ReputationUpdate memory update = AgentReputationRegistry
            .ReputationUpdate({
                tokenId: tokenId,
                karma: 100,
                questionsAsked: 5,
                answersGiven: 10,
                acceptedAnswers: 3,
                upvotesReceived: 120,
                downvotesReceived: 10
            });

        registry.updateReputation(tokenId, update);

        AgentReputationRegistry.AgentReputation memory rep = registry
            .reputations(tokenId);

        assertEq(rep.karma, 100);
        assertEq(rep.questionsAsked, 5);
        assertEq(rep.answersGiven, 10);
        assertEq(rep.acceptedAnswers, 3);
        assertEq(rep.upvotesReceived, 120);
        assertEq(rep.downvotesReceived, 10);
    }

    function test_UpdateReputation_OnlyOwner() public {
        uint256 tokenId = registry.registerAgent("agent_001", user1);

        AgentReputationRegistry.ReputationUpdate memory update = AgentReputationRegistry
            .ReputationUpdate({
                tokenId: tokenId,
                karma: 100,
                questionsAsked: 5,
                answersGiven: 10,
                acceptedAnswers: 3,
                upvotesReceived: 120,
                downvotesReceived: 10
            });

        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        registry.updateReputation(tokenId, update);
    }

    function test_BatchUpdateReputations() public {
        registry.registerAgent("agent_001", user1);
        registry.registerAgent("agent_002", user2);

        AgentReputationRegistry.ReputationUpdate[]
            memory updates = new AgentReputationRegistry.ReputationUpdate[](2);

        updates[0] = AgentReputationRegistry.ReputationUpdate({
            tokenId: 1,
            karma: 100,
            questionsAsked: 5,
            answersGiven: 10,
            acceptedAnswers: 3,
            upvotesReceived: 120,
            downvotesReceived: 10
        });

        updates[1] = AgentReputationRegistry.ReputationUpdate({
            tokenId: 2,
            karma: 50,
            questionsAsked: 2,
            answersGiven: 5,
            acceptedAnswers: 1,
            upvotesReceived: 60,
            downvotesReceived: 5
        });

        registry.batchUpdateReputations(updates);

        assertEq(registry.reputations(1).karma, 100);
        assertEq(registry.reputations(2).karma, 50);
    }

    function test_BatchUpdateReputations_SkipsNonexistent() public {
        registry.registerAgent("agent_001", user1);

        AgentReputationRegistry.ReputationUpdate[]
            memory updates = new AgentReputationRegistry.ReputationUpdate[](2);

        updates[0] = AgentReputationRegistry.ReputationUpdate({
            tokenId: 1,
            karma: 100,
            questionsAsked: 5,
            answersGiven: 10,
            acceptedAnswers: 3,
            upvotesReceived: 120,
            downvotesReceived: 10
        });

        updates[1] = AgentReputationRegistry.ReputationUpdate({
            tokenId: 999, // Does not exist
            karma: 50,
            questionsAsked: 2,
            answersGiven: 5,
            acceptedAnswers: 1,
            upvotesReceived: 60,
            downvotesReceived: 5
        });

        // Should not revert, just skip nonexistent
        registry.batchUpdateReputations(updates);

        assertEq(registry.reputations(1).karma, 100);
    }

    // ============================================
    // View Function Tests
    // ============================================

    function test_GetReputationByAgentId() public {
        registry.registerAgent("agent_001", user1);

        AgentReputationRegistry.ReputationUpdate memory update = AgentReputationRegistry
            .ReputationUpdate({
                tokenId: 1,
                karma: 100,
                questionsAsked: 5,
                answersGiven: 10,
                acceptedAnswers: 3,
                upvotesReceived: 120,
                downvotesReceived: 10
            });

        registry.updateReputation(1, update);

        AgentReputationRegistry.AgentReputation memory rep = registry
            .getReputationByAgentId("agent_001");

        assertEq(rep.karma, 100);
    }

    function test_GetTokenId() public {
        registry.registerAgent("agent_001", user1);

        uint256 tokenId = registry.getTokenId("agent_001");
        assertEq(tokenId, 1);
    }

    function test_GetTokenId_ReturnsZeroForUnregistered() public {
        uint256 tokenId = registry.getTokenId("nonexistent");
        assertEq(tokenId, 0);
    }

    // ============================================
    // Admin Function Tests
    // ============================================

    function test_SetAgentActive() public {
        uint256 tokenId = registry.registerAgent("agent_001", user1);

        assertTrue(registry.reputations(tokenId).isActive);

        registry.setAgentActive(tokenId, false);
        assertFalse(registry.reputations(tokenId).isActive);

        registry.setAgentActive(tokenId, true);
        assertTrue(registry.reputations(tokenId).isActive);
    }

    function test_SetBaseURI() public {
        registry.setBaseURI("https://new-api.clawdaq.xyz/nft/");

        uint256 tokenId = registry.registerAgent("agent_001", user1);
        string memory uri = registry.tokenURI(tokenId);

        assertEq(uri, "https://new-api.clawdaq.xyz/nft/1");
    }

    // ============================================
    // ERC721 Tests
    // ============================================

    function test_TokenURI() public {
        uint256 tokenId = registry.registerAgent("agent_001", user1);

        string memory uri = registry.tokenURI(tokenId);
        assertEq(uri, "https://api.clawdaq.xyz/nft/1");
    }

    function test_SupportsInterface() public {
        // ERC165
        assertTrue(registry.supportsInterface(0x01ffc9a7));
        // ERC721
        assertTrue(registry.supportsInterface(0x80ac58cd));
        // ERC721Metadata
        assertTrue(registry.supportsInterface(0x5b5e139f));
    }
}
