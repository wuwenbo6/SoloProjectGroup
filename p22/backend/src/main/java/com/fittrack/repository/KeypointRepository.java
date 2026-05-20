package com.fittrack.repository;

import com.fittrack.entity.Keypoint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface KeypointRepository extends JpaRepository<Keypoint, Long> {

    List<Keypoint> findByFrameDataId(Long frameDataId);
}
