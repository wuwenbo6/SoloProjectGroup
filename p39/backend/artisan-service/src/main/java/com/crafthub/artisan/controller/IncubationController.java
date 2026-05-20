package com.crafthub.artisan.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.crafthub.artisan.dto.ApplicationDTO;
import com.crafthub.artisan.entity.ArtisanApplication;
import com.crafthub.artisan.entity.TrainingCourse;
import com.crafthub.artisan.entity.TrainingEnrollment;
import com.crafthub.artisan.service.IncubationService;
import com.crafthub.common.result.Result;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/incubation")
@RequiredArgsConstructor
public class IncubationController {

    private final IncubationService incubationService;

    @PostMapping("/application")
    public Result<ArtisanApplication> submitApplication(
            @RequestBody ApplicationDTO dto,
            @RequestHeader(required = false) Long userId) {
        if (userId == null) {
            userId = 1L;
        }
        return incubationService.submitApplication(dto, userId);
    }

    @GetMapping("/application/my")
    public Result<ArtisanApplication> getMyApplication(
            @RequestHeader(required = false) Long userId) {
        if (userId == null) {
            userId = 1L;
        }
        return incubationService.getMyApplication(userId);
    }

    @GetMapping("/application/list")
    public Result<Page<ArtisanApplication>> getApplicationList(
            @RequestParam(required = false) Integer status,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "20") Integer size) {
        return incubationService.getApplicationList(status, page, size);
    }

    @PutMapping("/application/{id}/audit")
    public Result<Void> auditApplication(
            @PathVariable Long id,
            @RequestParam Integer status,
            @RequestParam(required = false) String rejectReason,
            @RequestHeader(required = false) Long auditorId) {
        if (auditorId == null) {
            auditorId = 999L;
        }
        return incubationService.auditApplication(id, status, rejectReason, auditorId);
    }

    @GetMapping("/course/list")
    public Result<Page<TrainingCourse>> getCourseList(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Integer level,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "20") Integer size) {
        return incubationService.getCourseList(category, level, page, size);
    }

    @GetMapping("/course/{id}")
    public Result<TrainingCourse> getCourseDetail(@PathVariable Long id) {
        return incubationService.getCourseDetail(id);
    }

    @GetMapping("/course/recommended")
    public Result<List<TrainingCourse>> getRecommendedCourses(
            @RequestParam(defaultValue = "10") Integer limit) {
        return incubationService.getRecommendedCourses(limit);
    }

    @PostMapping("/course/{courseId}/enroll")
    public Result<TrainingEnrollment> enrollCourse(
            @PathVariable Long courseId,
            @RequestParam String userName,
            @RequestParam String userPhone,
            @RequestHeader(required = false) Long userId) {
        if (userId == null) {
            userId = 1L;
        }
        return incubationService.enrollCourse(courseId, userId, userName, userPhone);
    }

    @GetMapping("/enrollment/my")
    public Result<List<TrainingEnrollment>> getMyEnrollments(
            @RequestHeader(required = false) Long userId) {
        if (userId == null) {
            userId = 1L;
        }
        return incubationService.getMyEnrollments(userId);
    }

    @DeleteMapping("/enrollment/{id}")
    public Result<Void> cancelEnrollment(
            @PathVariable Long id,
            @RequestHeader(required = false) Long userId) {
        if (userId == null) {
            userId = 1L;
        }
        return incubationService.cancelEnrollment(id, userId);
    }
}
