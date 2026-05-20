package com.crafthub.artisan.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.crafthub.artisan.dto.ApplicationDTO;
import com.crafthub.artisan.entity.ArtisanApplication;
import com.crafthub.artisan.entity.TrainingCourse;
import com.crafthub.artisan.entity.TrainingEnrollment;
import com.crafthub.artisan.mapper.ArtisanApplicationMapper;
import com.crafthub.artisan.mapper.TrainingCourseMapper;
import com.crafthub.artisan.mapper.TrainingEnrollmentMapper;
import com.crafthub.common.result.Result;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class IncubationService {

    private static final Logger log = LoggerFactory.getLogger(IncubationService.class);

    private final ArtisanApplicationMapper applicationMapper;
    private final TrainingCourseMapper courseMapper;
    private final TrainingEnrollmentMapper enrollmentMapper;

    @Transactional(rollbackFor = Exception.class)
    public Result<ArtisanApplication> submitApplication(ApplicationDTO dto, Long userId) {
        log.info("提交匠人入驻申请, userId: {}", userId);

        ArtisanApplication exist = applicationMapper.selectOne(
            new LambdaQueryWrapper<ArtisanApplication>()
                .eq(ArtisanApplication::getUserId, userId)
        );
        if (exist != null) {
            if (exist.getStatus() == 0) {
                return Result.error("您的申请正在审核中");
            } else if (exist.getStatus() == 1) {
                return Result.error("您已经是匠人身份");
            }
        }

        ArtisanApplication application = new ArtisanApplication();
        application.setUserId(userId);
        application.setRealName(dto.getRealName());
        application.setIdCard(dto.getIdCard());
        application.setPhone(dto.getPhone());
        application.setEmail(dto.getEmail());
        application.setProvince(dto.getProvince());
        application.setCity(dto.getCity());
        application.setAddress(dto.getAddress());
        application.setCraftType(dto.getCraftType());
        application.setCraftTitle(dto.getCraftTitle());
        application.setExperienceYears(dto.getExperienceYears());
        application.setBio(dto.getBio());
        application.setSkillDesc(dto.getSkillDesc());
        application.setRepresentativeWorks(dto.getRepresentativeWorks());
        application.setIdCardFront(dto.getIdCardFront());
        application.setIdCardBack(dto.getIdCardBack());
        application.setCertificateImages(dto.getCertificateImages());
        application.setStatus(0);

        if (exist != null) {
            application.setId(exist.getId());
            applicationMapper.updateById(application);
        } else {
            applicationMapper.insert(application);
        }

        return Result.success("申请提交成功，请等待审核", application);
    }

    public Result<ArtisanApplication> getMyApplication(Long userId) {
        ArtisanApplication application = applicationMapper.selectOne(
            new LambdaQueryWrapper<ArtisanApplication>()
                .eq(ArtisanApplication::getUserId, userId)
        );
        return Result.success(application);
    }

    public Result<Page<ArtisanApplication>> getApplicationList(Integer status, Integer page, Integer size) {
        Page<ArtisanApplication> pageParam = new Page<>(page, size);
        Page<ArtisanApplication> result = applicationMapper.selectPage(pageParam,
            new LambdaQueryWrapper<ArtisanApplication>()
                .eq(status != null, ArtisanApplication::getStatus, status)
                .orderByDesc(ArtisanApplication::getCreateTime)
        );
        return Result.success(result);
    }

    @Transactional(rollbackFor = Exception.class)
    public Result<Void> auditApplication(Long applicationId, Integer status, String rejectReason, Long auditorId) {
        log.info("审核匠人入驻申请, applicationId: {}, status: {}", applicationId, status);

        ArtisanApplication application = applicationMapper.selectById(applicationId);
        if (application == null) {
            return Result.error("申请记录不存在");
        }
        if (application.getStatus() != 0) {
            return Result.error("申请已审核");
        }

        application.setStatus(status);
        if (status == 2) {
            application.setRejectReason(rejectReason);
        }
        application.setAuditorId(auditorId);
        application.setAuditTime(LocalDateTime.now());
        applicationMapper.updateById(application);

        return Result.success(status == 1 ? "审核通过" : "审核拒绝");
    }

    public Result<Page<TrainingCourse>> getCourseList(String category, Integer level, Integer page, Integer size) {
        Page<TrainingCourse> pageParam = new Page<>(page, size);
        Page<TrainingCourse> result = courseMapper.selectPage(pageParam,
            new LambdaQueryWrapper<TrainingCourse>()
                .eq(category != null && !category.isEmpty(), TrainingCourse::getCategory, category)
                .eq(level != null, TrainingCourse::getLevel, level)
                .eq(TrainingCourse::getStatus, 1)
                .orderByDesc(TrainingCourse::getCreateTime)
        );
        return Result.success(result);
    }

    public Result<TrainingCourse> getCourseDetail(Long courseId) {
        TrainingCourse course = courseMapper.selectById(courseId);
        if (course == null) {
            return Result.error("课程不存在");
        }

        course.setViewCount(course.getViewCount() + 1);
        courseMapper.updateById(course);

        return Result.success(course);
    }

    @Transactional(rollbackFor = Exception.class)
    public Result<TrainingEnrollment> enrollCourse(Long courseId, Long userId, String userName, String userPhone) {
        log.info("报名培训课程, courseId: {}, userId: {}", courseId, userId);

        TrainingCourse course = courseMapper.selectById(courseId);
        if (course == null || course.getStatus() != 1) {
            return Result.error("课程不存在或已下架");
        }

        if (course.getCurrentStudents() >= course.getMaxStudents()) {
            return Result.error("课程人数已满");
        }

        TrainingEnrollment exist = enrollmentMapper.selectOne(
            new LambdaQueryWrapper<TrainingEnrollment>()
                .eq(TrainingEnrollment::getCourseId, courseId)
                .eq(TrainingEnrollment::getUserId, userId)
        );
        if (exist != null && exist.getStatus() == 1) {
            return Result.error("您已报名此课程");
        }

        TrainingEnrollment enrollment = new TrainingEnrollment();
        enrollment.setCourseId(courseId);
        enrollment.setUserId(userId);
        enrollment.setUserName(userName);
        enrollment.setUserPhone(userPhone);
        enrollment.setStatus(1);
        enrollmentMapper.insert(enrollment);

        course.setCurrentStudents(course.getCurrentStudents() + 1);
        course.setEnrollCount(course.getEnrollCount() + 1);
        courseMapper.updateById(course);

        return Result.success("报名成功", enrollment);
    }

    public Result<List<TrainingEnrollment>> getMyEnrollments(Long userId) {
        List<TrainingEnrollment> enrollments = enrollmentMapper.selectList(
            new LambdaQueryWrapper<TrainingEnrollment>()
                .eq(TrainingEnrollment::getUserId, userId)
                .orderByDesc(TrainingEnrollment::getEnrollTime)
        );
        return Result.success(enrollments);
    }

    @Transactional(rollbackFor = Exception.class)
    public Result<Void> cancelEnrollment(Long enrollmentId, Long userId) {
        TrainingEnrollment enrollment = enrollmentMapper.selectById(enrollmentId);
        if (enrollment == null) {
            return Result.error("报名记录不存在");
        }
        if (!enrollment.getUserId().equals(userId)) {
            return Result.error("无权取消");
        }

        enrollment.setStatus(2);
        enrollmentMapper.updateById(enrollment);

        TrainingCourse course = courseMapper.selectById(enrollment.getCourseId());
        if (course != null) {
            course.setCurrentStudents(Math.max(0, course.getCurrentStudents() - 1));
            courseMapper.updateById(course);
        }

        return Result.success("取消成功");
    }

    public Result<List<TrainingCourse>> getRecommendedCourses(Integer limit) {
        List<TrainingCourse> courses = courseMapper.selectList(
            new LambdaQueryWrapper<TrainingCourse>()
                .eq(TrainingCourse::getStatus, 1)
                .orderByDesc(TrainingCourse::getEnrollCount)
                .orderByDesc(TrainingCourse::getRating)
                .last("limit " + (limit != null ? limit : 10))
        );
        return Result.success(courses);
    }
}
