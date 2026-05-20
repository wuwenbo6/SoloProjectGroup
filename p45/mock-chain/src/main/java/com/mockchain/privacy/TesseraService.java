package com.mockchain.privacy;

import com.mockchain.node.Organization;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;

@Slf4j
@Service
public class TesseraService {

    private final List<Organization> organizations = new ArrayList<>();
    private final Map<String, String> encryptedPayloads = new ConcurrentHashMap<>();

    public TesseraService(@Value("${orgs}") List<Map<String, String>> orgConfigs) {
        for (Map<String, String> config : orgConfigs) {
            Organization org = new Organization();
            org.setName(config.get("name"));
            org.setNodeUrl(config.get("node-url"));
            org.setTesseraUrl(config.get("tessera-url"));
            org.setPublicKey(config.get("public-key"));
            organizations.add(org);
        }
    }

    public List<Organization> getAllOrganizations() {
        return new ArrayList<>(organizations);
    }

    public Optional<Organization> getOrganization(String name) {
        return organizations.stream()
                .filter(o -> o.getName().equals(name))
                .findFirst();
    }

    public String encryptPayload(String payload, String from, List<String> toOrgs) {
        String encryptedKey = "ENCRYPTED_" + UUID.randomUUID().toString();
        encryptedPayloads.put(encryptedKey, payload);
        log.info("Encrypted payload from {} to {}: {}", from, toOrgs, encryptedKey);
        return encryptedKey;
    }

    public String decryptPayload(String encryptedKey, String orgName) {
        String payload = encryptedPayloads.get(encryptedKey);
        if (payload != null) {
            log.info("Decrypted payload for {}: {}", orgName, payload);
            return payload;
        }
        throw new IllegalArgumentException("Invalid or unauthorized payload key");
    }

    public List<String> getParticipants(String privacyGroupId) {
        List<String> participants = new ArrayList<>();
        participants.add("Org1");
        participants.add("Org2");
        if (privacyGroupId.equals("privacyGroup3")) {
            participants.add("Org3");
        }
        return participants;
    }

    public String getPublicKey(String orgName) {
        return getOrganization(orgName)
                .map(Organization::getPublicKey)
                .orElseThrow(() -> new IllegalArgumentException("Organization not found: " + orgName));
    }
}