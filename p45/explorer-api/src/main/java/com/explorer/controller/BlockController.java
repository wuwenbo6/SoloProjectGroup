package com.explorer.controller;

import com.explorer.entity.Block;
import com.explorer.service.BlockService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/blocks")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class BlockController {

    private final BlockService blockService;

    @GetMapping
    public ResponseEntity<Page<Block>> getBlocks(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(blockService.getBlocks(page, size));
    }

    @GetMapping("/hash/{hash}")
    public ResponseEntity<Block> getBlockByHash(@PathVariable String hash) {
        return blockService.getBlockByHash(hash)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/number/{number}")
    public ResponseEntity<Block> getBlockByNumber(@PathVariable Long number) {
        return blockService.getBlockByNumber(number)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/latest")
    public ResponseEntity<Long> getLatestBlockNumber() {
        return blockService.getLatestBlockNumber()
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.ok(0L));
    }
}