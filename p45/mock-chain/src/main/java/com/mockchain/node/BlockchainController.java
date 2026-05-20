package com.mockchain.node;

import com.mockchain.privacy.TesseraService;
import com.mockchain.simulator.MockBlockchainService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class BlockchainController {

    private final MockBlockchainService blockchainService;
    private final TesseraService tesseraService;

    @GetMapping("/blocks/latest")
    public ResponseEntity<Long> getLatestBlockNumber() {
        return ResponseEntity.ok(blockchainService.getLatestBlockNumber());
    }

    @GetMapping("/blocks/{number}")
    public ResponseEntity<Map<String, Object>> getBlockByNumber(@PathVariable Long number) {
        Map<String, Object> block = blockchainService.getBlockByNumber(number);
        if (block != null) {
            return ResponseEntity.ok(block);
        }
        return ResponseEntity.notFound().build();
    }

    @GetMapping("/blocks")
    public ResponseEntity<List<Map<String, Object>>> getLatestBlocks(
            @RequestParam(defaultValue = "10") int count) {
        return ResponseEntity.ok(blockchainService.getLatestBlocks(count));
    }

    @GetMapping("/transactions/{hash}")
    public ResponseEntity<Map<String, Object>> getTransactionByHash(@PathVariable String hash) {
        Map<String, Object> tx = blockchainService.getTransactionByHash(hash);
        if (tx != null) {
            return ResponseEntity.ok(tx);
        }
        return ResponseEntity.notFound().build();
    }

    @GetMapping("/orgs")
    public ResponseEntity<List<Organization>> getAllOrganizations() {
        return ResponseEntity.ok(tesseraService.getAllOrganizations());
    }

    @GetMapping("/orgs/{name}")
    public ResponseEntity<Organization> getOrganization(@PathVariable String name) {
        return tesseraService.getOrganization(name)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/privacy/participants/{privacyGroupId}")
    public ResponseEntity<List<String>> getParticipants(@PathVariable String privacyGroupId) {
        return ResponseEntity.ok(tesseraService.getParticipants(privacyGroupId));
    }

    @GetMapping("/privacy/public-key/{orgName}")
    public ResponseEntity<String> getPublicKey(@PathVariable String orgName) {
        try {
            return ResponseEntity.ok(tesseraService.getPublicKey(orgName));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/privacy/encrypt")
    public ResponseEntity<String> encryptPayload(
            @RequestParam String payload,
            @RequestParam String from,
            @RequestParam List<String> toOrgs) {
        return ResponseEntity.ok(tesseraService.encryptPayload(payload, from, toOrgs));
    }

    @PostMapping("/privacy/decrypt")
    public ResponseEntity<String> decryptPayload(
            @RequestParam String encryptedKey,
            @RequestParam String orgName) {
        try {
            return ResponseEntity.ok(tesseraService.decryptPayload(encryptedKey, orgName));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}