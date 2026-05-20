package com.crafthub.requirement.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.crafthub.common.result.Result;
import com.crafthub.requirement.dto.ProposalCreateDTO;
import com.crafthub.requirement.entity.Proposal;
import com.crafthub.requirement.entity.ProposalAttachment;
import com.crafthub.requirement.mapper.ProposalAttachmentMapper;
import com.crafthub.requirement.mapper.ProposalMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProposalService extends ServiceImpl<ProposalMapper, Proposal> {

    private static final Logger log = LoggerFactory.getLogger(ProposalService.class);

    private final ProposalAttachmentMapper attachmentMapper;

    @Transactional(rollbackFor = Exception.class)
    public Result<Proposal> createProposal(ProposalCreateDTO dto, Long artisanId) {
        log.info("创建方案，需求ID: {}, 匠人ID: {}", dto.getRequirementId(), artisanId);

        Proposal proposal = new Proposal();
        proposal.setRequirementId(dto.getRequirementId());
        proposal.setArtisanId(artisanId);
        proposal.setTitle(dto.getTitle());
        proposal.setDescription(dto.getDescription());
        proposal.setPrice(dto.getPrice());
        proposal.setDeliveryDays(dto.getDeliveryDays());
        proposal.setMaterialDesc(dto.getMaterialDesc());
        proposal.setCraftDesc(dto.getCraftDesc());
        proposal.setRevision(1);
        proposal.setStatus(1);
        proposal.setIsFinal(0);

        save(proposal);
        log.info("方案创建成功，方案ID: {}", proposal.getId());

        if (dto.getAttachments() != null && !dto.getAttachments().isEmpty()) {
            for (ProposalCreateDTO.AttachmentDTO attDTO : dto.getAttachments()) {
                ProposalAttachment attachment = new ProposalAttachment();
                attachment.setProposalId(proposal.getId());
                attachment.setFileName(attDTO.getFileName());
                attachment.setFileUrl(attDTO.getFileUrl());
                attachment.setFileType(attDTO.getFileType());
                attachment.setFileSize(attDTO.getFileSize());
                attachment.setSortOrder(attDTO.getSortOrder());
                attachmentMapper.insert(attachment);
            }
        }

        return Result.success("方案提交成功", proposal);
    }

    public Result<Page<Proposal>> getProposalsByRequirement(Long requirementId, Integer page, Integer size) {
        Page<Proposal> pageParam = new Page<>(page, size);
        Page<Proposal> resultPage = page(pageParam,
            new LambdaQueryWrapper<Proposal>()
                .eq(Proposal::getRequirementId, requirementId)
                .eq(Proposal::getStatus, 1)
                .orderByDesc(Proposal::getCreateTime)
        );

        for (Proposal proposal : resultPage.getRecords()) {
            List<ProposalAttachment> attachments = attachmentMapper.selectList(
                new LambdaQueryWrapper<ProposalAttachment>()
                    .eq(ProposalAttachment::getProposalId, proposal.getId())
                    .orderByAsc(ProposalAttachment::getSortOrder)
            );
            proposal.setAttachments(attachments);
        }

        return Result.success(resultPage);
    }

    public Result<List<Proposal>> compareProposals(List<Long> proposalIds) {
        log.info("对比方案，方案ID列表: {}", proposalIds);

        if (proposalIds == null || proposalIds.size() < 2) {
            return Result.error("至少选择2个方案进行对比");
        }
        if (proposalIds.size() > 5) {
            return Result.error("最多只能对比5个方案");
        }

        List<Proposal> proposals = listByIds(proposalIds);
        proposals.removeIf(p -> p.getStatus() != 1);

        for (Proposal proposal : proposals) {
            List<ProposalAttachment> attachments = attachmentMapper.selectList(
                new LambdaQueryWrapper<ProposalAttachment>()
                    .eq(ProposalAttachment::getProposalId, proposal.getId())
                    .orderByAsc(ProposalAttachment::getSortOrder)
            );
            proposal.setAttachments(attachments);
        }

        return Result.success(proposals);
    }

    @Transactional(rollbackFor = Exception.class)
    public Result<Void> selectProposal(Long proposalId, Long userId) {
        log.info("选中方案，方案ID: {}, 用户ID: {}", proposalId, userId);

        Proposal proposal = getById(proposalId);
        if (proposal == null) {
            return Result.error("方案不存在");
        }

        List<Proposal> allProposals = list(
            new LambdaQueryWrapper<Proposal>()
                .eq(Proposal::getRequirementId, proposal.getRequirementId())
        );

        for (Proposal p : allProposals) {
            if (p.getId().equals(proposalId)) {
                p.setStatus(2);
                p.setIsFinal(1);
            } else {
                p.setStatus(3);
            }
            updateById(p);
        }

        return Result.success("方案选中成功");
    }

    public Result<Proposal> getProposalById(Long id) {
        Proposal proposal = getById(id);
        if (proposal == null) {
            return Result.error("方案不存在");
        }

        List<ProposalAttachment> attachments = attachmentMapper.selectList(
            new LambdaQueryWrapper<ProposalAttachment>()
                .eq(ProposalAttachment::getProposalId, id)
                .orderByAsc(ProposalAttachment::getSortOrder)
        );
        proposal.setAttachments(attachments);

        return Result.success(proposal);
    }

    public Result<List<Proposal>> getArtisanProposals(Long artisanId, Integer page, Integer size) {
        Page<Proposal> pageParam = new Page<>(page, size);
        Page<Proposal> resultPage = page(pageParam,
            new LambdaQueryWrapper<Proposal>()
                .eq(Proposal::getArtisanId, artisanId)
                .orderByDesc(Proposal::getCreateTime)
        );
        return Result.success(resultPage.getRecords());
    }

    public Result<String> generateComparisonReport(List<Long> proposalIds) {
        Result<List<Proposal>> result = compareProposals(proposalIds);
        if (!result.isSuccess()) {
            return Result.error(result.getMessage());
        }

        List<Proposal> proposals = result.getData();
        StringBuilder report = new StringBuilder();
        report.append("## 方案对比分析报告\n\n");

        report.append("### 基础信息对比\n\n");
        report.append("| 方案 | 匠人 | 价格 | 交付周期 |\n");
        report.append("|------|------|------|----------|\n");
        for (Proposal p : proposals) {
            report.append(String.format("| %s | 匠人%d | ¥%.2f | %d天 |\n",
                p.getTitle(), p.getArtisanId(), p.getPrice(), p.getDeliveryDays()));
        }

        report.append("\n### 方案详情\n\n");
        for (Proposal p : proposals) {
            report.append(String.format("#### %s\n\n", p.getTitle()));
            report.append(String.format("- **价格**: ¥%.2f\n", p.getPrice()));
            report.append(String.format("- **交付周期**: %d天\n", p.getDeliveryDays()));
            if (p.getDescription() != null) {
                report.append(String.format("- **方案描述**: %s\n", p.getDescription()));
            }
            if (p.getMaterialDesc() != null) {
                report.append(String.format("- **用材说明**: %s\n", p.getMaterialDesc()));
            }
            if (p.getCraftDesc() != null) {
                report.append(String.format("- **工艺说明**: %s\n", p.getCraftDesc()));
            }
            report.append("\n");
        }

        Proposal cheapest = proposals.stream()
            .min(Comparator.comparing(Proposal::getPrice))
            .orElse(null);
        Proposal fastest = proposals.stream()
            .min(Comparator.comparing(Proposal::getDeliveryDays))
            .orElse(null);

        if (cheapest != null && fastest != null) {
            report.append("### 推荐建议\n\n");
            if (cheapest.getId().equals(fastest.getId())) {
                report.append(String.format("> **推荐方案**: %s（性价比最高）\n", cheapest.getTitle()));
            } else {
                report.append(String.format("> **最经济方案**: %s（¥%.2f）\n", cheapest.getTitle(), cheapest.getPrice()));
                report.append(String.format("> **最快速方案**: %s（%d天）\n", fastest.getTitle(), fastest.getDeliveryDays()));
            }
        }

        return Result.success(report.toString());
    }
}
