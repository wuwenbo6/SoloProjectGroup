package com.crafthub.requirement.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.crafthub.common.result.Result;
import com.crafthub.requirement.dto.ProposalCreateDTO;
import com.crafthub.requirement.entity.Proposal;
import com.crafthub.requirement.service.ProposalService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/proposal")
@RequiredArgsConstructor
public class ProposalController {

    private final ProposalService proposalService;

    @PostMapping
    public Result<Proposal> createProposal(
            @Valid @RequestBody ProposalCreateDTO dto,
            @RequestHeader(required = false) Long artisanId) {
        if (artisanId == null) {
            artisanId = 20001L;
        }
        return proposalService.createProposal(dto, artisanId);
    }

    @GetMapping("/requirement/{requirementId}")
    public Result<Page<Proposal>> getProposalsByRequirement(
            @PathVariable Long requirementId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        return proposalService.getProposalsByRequirement(requirementId, page, size);
    }

    @GetMapping("/compare")
    public Result<List<Proposal>> compareProposals(@RequestParam List<Long> ids) {
        return proposalService.compareProposals(ids);
    }

    @GetMapping("/compare/report")
    public Result<String> generateComparisonReport(@RequestParam List<Long> ids) {
        return proposalService.generateComparisonReport(ids);
    }

    @PostMapping("/{id}/select")
    public Result<Void> selectProposal(
            @PathVariable Long id,
            @RequestHeader(required = false) Long userId) {
        if (userId == null) {
            userId = 1L;
        }
        return proposalService.selectProposal(id, userId);
    }

    @GetMapping("/{id}")
    public Result<Proposal> getProposalById(@PathVariable Long id) {
        return proposalService.getProposalById(id);
    }

    @GetMapping("/artisan")
    public Result<List<Proposal>> getArtisanProposals(
            @RequestHeader(required = false) Long artisanId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        if (artisanId == null) {
            artisanId = 20001L;
        }
        return proposalService.getArtisanProposals(artisanId, page, size);
    }
}
